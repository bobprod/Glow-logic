"use client";

import React, { useRef, useCallback, useState, useEffect } from 'react';
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
import LfoNode from '../components/nodes/LfoNode';
import ColorPickerNode from '../components/nodes/ColorPickerNode';
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
  lfoInput: LfoNode,
  colorPicker: ColorPickerNode,
};

let idCounter = 10;
const getId = () => `node-${idCounter++}`;

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNode, undo, redo } = useStore();

  // Ctrl+Z / Ctrl+Y keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);
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
      if (parsedData.type === 'lfoInput') {
        data.freq = 0.5; data.depth = 255; data.offset = 0; data.wave = 'sine';
        data.universe = 1; data.channel = 1;
      }
      if (parsedData.type === 'colorPicker') {
        data.hex = '#ff0000'; data.universe = 1;
        data.rCh = 1; data.gCh = 2; data.bCh = 3;
      }

      addNode({ id: getId(), type: parsedData.type, position, data });
    },
    [project, addNode]
  );

  return (
    <div
      className={`flex-1 h-full relative transition-all duration-300 bg-[#0A0A0C] ${isDragOver ? 'ring-2 ring-cyan-500/40 ring-inset shadow-[inset_0_0_50px_rgba(6,182,212,0.1)]' : ''}`}
      ref={reactFlowWrapper}
    >
      {/* Premium Radial Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.4)_100%)] z-10" />

      {/* Drop zone hint banner */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="bg-cyan-950/40 border-2 border-dashed border-cyan-500/60 rounded-2xl px-10 py-5 text-cyan-400 font-bold text-lg shadow-[0_0_30px_rgba(6,182,212,0.2)] backdrop-blur-md animate-pulse">
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
        className="[&_.react-flow__pane]:cursor-crosshair"
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Background color="#1e293b" gap={24} size={2} className="opacity-60" />
        <Controls
          className="fill-white bg-black/60 backdrop-blur-md border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden rounded-lg mb-52 ml-4 [&>button]:border-b [&>button]:border-white/5 [&>button:hover]:bg-white/10 [&>button]:transition-colors"
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

