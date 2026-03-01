"use client";

import React, { useRef, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import useStore from '../store/useStore';
import DmxOutputNode from '../components/nodes/DmxOutputNode';
import SliderNode from '../components/nodes/SliderNode';
import PadNode from '../components/nodes/PadNode';
import AudioInNode from '../components/nodes/AudioInNode';
import ArtNetOutNode from '../components/nodes/ArtNetOutNode';
import Sidebar from '../components/Sidebar';
import WidgetPanel from '../components/WidgetPanel';
import SmartDashboard from '../components/SmartDashboard';
import MacroTimeline from '../components/MacroTimeline';
import TopBar from '../components/TopBar';
import VisualizerView from './visualizer/page';
import LivePerformanceView from '../components/LivePerformanceView';
import MidiListener from '../components/MidiListener';

// Custom node types
const nodeTypes = {
  dmxOutput: DmxOutputNode,
  sliderInput: SliderNode,
  padInput: PadNode,
  audioIn: AudioInNode,
  artnetOut: ArtNetOutNode,
};

let idCounter = 10;
const getId = () => `node-${idCounter++}`;

// ─── Inner canvas component (needs access to useReactFlow hook) ───
function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNode } = useStore();
  const { project } = useReactFlow();

  // Drop zone highlight state
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const rawData = event.dataTransfer.getData('application/reactflow');

      if (!rawData || !reactFlowBounds) return;

      const parsedData = JSON.parse(rawData) as { type: string; label: string };

      // ✅ FIX: use `project()` to convert screen coords → ReactFlow canvas coords
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Snap to a 20px grid for clean alignment
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;

      // Build data payload per node type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { label: parsedData.label };
      if (parsedData.type === 'sliderInput' || parsedData.type === 'padInput') {
        data.value = 0;
      }
      if (parsedData.type === 'dmxOutput') {
        data.universe = 1;
        data.channel = 1;
      }
      if (parsedData.type === 'artnetOut') {
        data.universe = 1;
      }

      addNode({ id: getId(), type: parsedData.type, position, data });
    },
    [project, addNode]
  );

  return (
    <div
      className={`flex-1 h-full relative transition-all duration-200 ${isDragOver ? 'ring-2 ring-cyan-500/40 ring-inset' : ''}`}
      ref={reactFlowWrapper}
    >
      {/* Drop zone hint banner */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="bg-cyan-500/10 border-2 border-dashed border-cyan-500/60 rounded-2xl px-8 py-4 text-cyan-400 font-bold text-lg shadow-xl backdrop-blur-sm animate-pulse">
            ⬇ Déposer ici pour créer le nœud
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onInit={() => console.log('✅ Flow initialisé')}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onNodeClick={(_, node) => setSelectedNode(node)}
        onPaneClick={() => setSelectedNode(null)}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
        className="bg-[#0f1115]"
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls
          className="fill-white bg-slate-800 border-none shadow-xl flex flex-col overflow-hidden rounded-lg mb-52 ml-2"
          showInteractive={false}
        />
      </ReactFlow>

      {/* Widget inspector panel */}
      <WidgetPanel />
    </div>
  );
}

// ─── Root page — handles Smart/Pro switch ────────────────────────
export default function LogicCanvas() {
  const { appMode, proView } = useStore();

  return (
    <div className="flex flex-col w-screen h-screen bg-black overflow-hidden relative">
      <MidiListener />
      <TopBar />

      <div className="flex-1 flex overflow-hidden relative">
        {appMode === 'smart' && <SmartDashboard />}
        {appMode === 'live' && <LivePerformanceView />}
        {appMode === 'creator' && (
          proView === 'visualizer' ? (
            <VisualizerView />
          ) : (
            <ReactFlowProvider>
              <Sidebar />
              <FlowCanvas />
            </ReactFlowProvider>
          )
        )}
      </div>
      <MacroTimeline />
    </div>
  );
}

