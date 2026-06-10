"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import useStore from "../store/useStore";
import DmxOutputNode from "../components/nodes/DmxOutputNode";
import SliderNode from "../components/nodes/SliderNode";
import PadNode from "../components/nodes/PadNode";
import AudioInNode from "../components/nodes/AudioInNode";
import ArtNetOutNode from "../components/nodes/ArtNetOutNode";
import LfoNode from "../components/nodes/LfoNode";
import ColorPickerNode from "../components/nodes/ColorPickerNode";
import FixtureNode from "../components/nodes/FixtureNode";
import Sidebar from "../components/Sidebar";

import SmartDashboard from "../components/SmartDashboard";
import MacroTimeline from "../components/MacroTimeline";
import TopBar from "../components/TopBar";
import VisualizerView from "../components/VisualizerView";
import PatchPanel from "../components/PatchPanel";
import FixtureController from "../components/FixtureController";
import OrchestratorController from "../components/OrchestratorController";
import MidiListener from "../components/MidiListener";
import { ToastContainer } from "../components/ui/ToastContainer";
import GuidedTour from "../components/ui/GuidedTour";
import { socket } from "../lib/socket";
import { useAutosave } from "../hooks/useAutosave";
import { useCrashRecovery } from "../hooks/useCrashRecovery";

// Custom node types
const nodeTypes = {
  dmxOutput: DmxOutputNode,
  sliderInput: SliderNode,
  padInput: PadNode,
  audioIn: AudioInNode,
  artnetOut: ArtNetOutNode,
  lfoInput: LfoNode,
  colorPicker: ColorPickerNode,
  fixtureNode: FixtureNode,
};

let idCounter = 10;
const getId = () => `node-${idCounter++}`;

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    undo,
    redo,
  } = useStore();

  // Ctrl+Z / Ctrl+Y keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      )
        return;
      if (e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);
  const { project } = useReactFlow();

  // Drop zone highlight state
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
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
      const rawData = event.dataTransfer.getData("application/reactflow");

      if (!rawData || !reactFlowBounds) return;

       
      const parsedData = JSON.parse(rawData) as { type: string; label: string; [key: string]: any };

      // ✅ FIX: use `project()` to convert screen coords → ReactFlow canvas coords
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Snap to a 20px grid for clean alignment
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;

      // Build data payload per node type
       
      const data: any = { label: parsedData.label };
      if (parsedData.type === "sliderInput" || parsedData.type === "padInput") {
        data.value = 0;
      }
      if (parsedData.type === "dmxOutput") {
        data.universe = 1;
        data.channel = 1;
      }
      if (parsedData.type === "artnetOut") {
        data.universe = 1;
      }
      if (parsedData.type === "lfoInput") {
        data.freq = 0.5;
        data.depth = 255;
        data.offset = 0;
        data.wave = "sine";
        data.universe = 1;
        data.channel = 1;
      }
      if (parsedData.type === "colorPicker") {
        data.hex = "#ff0000";
        data.universe = 1;
        data.rCh = 1;
        data.gCh = 2;
        data.bCh = 3;
      }
      if (parsedData.type === "fixtureNode") {
        data.fixtureId    = parsedData.fixtureId;
        data.fixtureName  = parsedData.fixtureName || parsedData.label;
        data.manufacturer = parsedData.manufacturer;
        data.totalChannels = parsedData.totalChannels;
        data.startAddress = parsedData.startAddress ?? 1;
        data.universe     = parsedData.universe ?? 1;
        data.channels     = [];  // chargés par le composant via API
        data.modes        = [];
      }

      addNode({ id: getId(), type: parsedData.type, position, data });
    },
    [project, addNode],
  );

  return (
    <div
      className={`flex-1 h-full relative transition-all duration-300 bg-[#0A0A0C] ${isDragOver ? "ring-2 ring-cyan-500/40 ring-inset shadow-[inset_0_0_50px_rgba(6,182,212,0.1)]" : ""}`}
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
        onInit={() => console.log("✅ Flow initialisé")}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onNodeClick={(_, node) => setSelectedNode(node)}
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

    </div>
  );
}

// ─── Root page — handles Smart/Pro switch ────────────────────────
export default function LogicCanvas() {
  const {
    appMode, setAppMode, proView, setProView,
    isSidebarVisible,
    isBottomPanelVisible, setIsBottomPanelVisible,
    isRightPanelVisible, setIsRightPanelVisible,
    activeRightTab, setActiveRightTab,
    setSelectedFixtureId,
    addToast, saveProject, currentProjectName,
  } = useStore();

  useAutosave();
  useCrashRecovery();

  // Lire le query param ?mode= (utilisé par les shortcuts PWA du manifest)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "smart" || mode === "creator") {
      setAppMode(mode);
    } else if (mode === "live") {
      setAppMode("smart");
    }
  }, [setAppMode]);

  // Socket connection feedback via toasts
  useEffect(() => {
    const onConnect = () =>
      addToast({
        type: "success",
        message: "Backend connecté",
        detail: "Socket.IO OK",
      });
    const onDisconnect = () =>
      addToast({
        type: "error",
        message: "Backend déconnecté",
        detail: "Tentative de reconnexion…",
        duration: 5000,
      });
    const onError = (err: Error) =>
      addToast({
        type: "error",
        message: "Erreur socket",
        detail: err.message,
        duration: 5000,
      });
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, [addToast]);

  // Ctrl+S → quick save project
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const name =
          currentProjectName || `Projet ${new Date().toLocaleString("fr-FR")}`;
        try {
          await saveProject(name);
          addToast({
            type: "success",
            message: "Projet sauvegardé",
            detail: name,
          });
        } catch {
          addToast({ type: "error", message: "Échec de la sauvegarde" });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addToast, saveProject, currentProjectName]);

  // Mode keyboard shortcuts: S = Smart, C = Creator, L = Live
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) return;
      if (e.key === "s") setAppMode("smart");
      if (e.key === "c") setAppMode("creator");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setAppMode]);

  // Pro Layout & Navigation Keyboard Shortcuts (Ableton style)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (appMode !== "creator") return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      // Tab / Shift+Tab keys
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          setIsBottomPanelVisible(!isBottomPanelVisible);
        } else {
          setProView(
            proView === "canvas"
              ? "patch"
              : proView === "patch"
              ? "visualizer"
              : "canvas"
          );
        }
      }

      // Keys 1, 2, 3 -> Right Tab selector
      if (e.key === "1") {
        e.preventDefault();
        setIsRightPanelVisible(true);
        setActiveRightTab("ai");
      }
      if (e.key === "2") {
        e.preventDefault();
        setIsRightPanelVisible(true);
        setActiveRightTab("scenes");
      }
      if (e.key === "3") {
        e.preventDefault();
        setIsRightPanelVisible(true);
        setActiveRightTab("cues");
      }

      // Escape -> Deselect fixture
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedFixtureId(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    appMode,
    proView,
    setProView,
    isBottomPanelVisible,
    setIsBottomPanelVisible,
    isRightPanelVisible,
    setIsRightPanelVisible,
    setActiveRightTab,
    setSelectedFixtureId,
  ]);

  return (
    <div className="flex flex-col w-screen h-screen bg-black overflow-hidden relative select-none">
      <MidiListener />
      <ToastContainer />
      <GuidedTour />
      <TopBar />

      <div className="flex-1 flex overflow-hidden relative">
        {appMode === "smart" && <SmartDashboard />}
        {appMode === "creator" && (
          <div className="relative flex-1 flex overflow-hidden bg-[#07090e]">
            {/* Main Workspace + Horizontal Bottom Panel */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-w-0 h-full">
              {/* Central Viewport */}
              <div className="flex-1 flex overflow-hidden relative min-h-0">
                {proView === "visualizer" ? (
                  <VisualizerView />
                ) : proView === "patch" ? (
                  <PatchPanel />
                ) : (
                  <ReactFlowProvider>
                    {isSidebarVisible && <Sidebar />}
                    <FlowCanvas />
                  </ReactFlowProvider>
                )}
              </div>

              {/* Bottom horizontal Device Panel (Fixture Controller) */}
              {isBottomPanelVisible && (
                <div className="h-[260px] min-h-[180px] max-h-[380px] border-t border-white/5 bg-[#0a0c10] flex flex-col relative shrink-0 z-30 shadow-[0_-5px_25px_rgba(0,0,0,0.5)]">
                  {/* Tab handle button */}
                  <button
                    onClick={() => setIsBottomPanelVisible(false)}
                    className="absolute -top-6 left-6 px-3 py-1.5 rounded-t-xl bg-[#0a0c10] border-t border-x border-white/5 text-[9px] font-black tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer z-50 shadow-[0_-3px_10px_rgba(0,0,0,0.3)] font-mono"
                    title="Masquer (Shift+Tab)"
                  >
                    <span>▼</span> CONTROLES
                  </button>

                  <div className="flex-1 overflow-hidden h-full">
                    <FixtureController className="h-full border-0 rounded-none bg-transparent" />
                  </div>
                </div>
              )}

              {/* Restore bottom panel button */}
              {!isBottomPanelVisible && (
                <button
                  onClick={() => setIsBottomPanelVisible(true)}
                  className="absolute bottom-4 left-6 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-[10px] font-black tracking-wider text-cyan-400 hover:text-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer z-50 font-mono"
                  title="Afficher (Shift+Tab)"
                >
                  ▲ CONTROLES
                </button>
              )}
            </div>

            {/* Right Tabbed Panel (AI, Scenes, Cues) */}
            {isRightPanelVisible && (
              <div className="w-[380px] min-w-[320px] max-w-[480px] bg-[#0c0e12] border-l border-white/5 flex flex-col z-40 relative h-full overflow-hidden shadow-2xl">
                {/* Tab selector */}
                <div className="flex bg-[#07090e] border-b border-white/5 p-1 gap-1 shrink-0 items-center justify-between">
                  <div className="flex gap-1 flex-1">
                    <button
                      onClick={() => setActiveRightTab("ai")}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest text-center transition-all cursor-pointer ${
                        activeRightTab === "ai"
                          ? "bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      🤖 IA
                    </button>
                    <button
                      onClick={() => setActiveRightTab("scenes")}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest text-center transition-all cursor-pointer ${
                        activeRightTab === "scenes"
                          ? "bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      🎬 SCENES
                    </button>
                    <button
                      onClick={() => setActiveRightTab("cues")}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest text-center transition-all cursor-pointer ${
                        activeRightTab === "cues"
                          ? "bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      🎛 CUES
                    </button>
                  </div>
                  <button
                    onClick={() => setIsRightPanelVisible(false)}
                    className="p-2 text-slate-600 hover:text-slate-300 transition-colors ml-1 cursor-pointer"
                    title="Masquer le panneau"
                  >
                    <span>▶</span>
                  </button>
                </div>

                {/* Tab content wrapper */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                  {activeRightTab === "ai" && <OrchestratorController />}
                  {activeRightTab === "scenes" && (
                    <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
                      <p className="text-white text-xs font-black uppercase tracking-widest mb-2">
                        Scenes dans la timeline
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                        Le refactoring centralise les scenes dans la MacroTimeline. Utilisez l'onglet Scenes en bas d'ecran pour capturer, charger et arranger les looks.
                      </p>
                    </div>
                  )}
                  {activeRightTab === "cues" && (
                    <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4">
                      <p className="text-white text-xs font-black uppercase tracking-widest mb-2">
                        Cues dans la timeline
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                        Les cue lists et chasers sont maintenant accessibles dans la MacroTimeline pour garder une seule conduite d'arrangement.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Restore right panel floating tab */}
            {!isRightPanelVisible && (
              <button
                onClick={() => setIsRightPanelVisible(true)}
                className="absolute top-20 right-4 p-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-400 hover:text-purple-300 transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)] cursor-pointer z-50"
                title="Afficher le panneau"
              >
                ◀
              </button>
            )}
          </div>
        )}
      </div>
      <MacroTimeline />
    </div>
  );
}
