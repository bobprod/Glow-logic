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
import type { DesignStep } from "../store/slices/uiSlice";
import DmxOutputNode from "./nodes/DmxOutputNode";
import SliderNode from "./nodes/SliderNode";
import PadNode from "./nodes/PadNode";
import AudioInNode from "./nodes/AudioInNode";
import ArtNetOutNode from "./nodes/ArtNetOutNode";
import LfoNode from "./nodes/LfoNode";
import ColorPickerNode from "./nodes/ColorPickerNode";
import FixtureNode from "./nodes/FixtureNode";

import { Suspense, lazy } from "react";
import { Settings2, Check, ArrowRight, Wand2, X } from "lucide-react";
import TopBar from "./TopBar";
import MidiListener from "./MidiListener";
import { ToastContainer } from "./ui/ToastContainer";
import { socket } from "../lib/socket";
import { useAutosave } from "../hooks/useAutosave";
import { useCrashRecovery } from "../hooks/useCrashRecovery";
import { useOfflineProjectBackup } from "../hooks/useOfflineProjectBackup";
import { redoHistory, undoHistory } from "../store/history";
import { ensureAuthToken, setAuthToken } from "../lib/config";

// Lazy loading for heavy components
const SmartDashboard = lazy(() => import("./SmartDashboard"));
const MacroTimeline = lazy(() => import("./MacroTimeline"));
const VisualizerView = lazy(() => import("./VisualizerView"));
const StagePlan = lazy(() => import("./smart/StagePlan"));
const FixtureController = lazy(() => import("./FixtureController"));
const GuidedTour = lazy(() => import("./ui/GuidedTour"));
const LivePerformanceView = lazy(() => import("./smart/LivePerformanceView"));
const SceneController = lazy(() => import("./smart/SceneController"));
const FixturesPage = lazy(() => import("./FixturesPage"));
const OrchestratorController = lazy(() => import("./OrchestratorController"));

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

// Pipeline guidé du MODE DESIGN : 4 étapes numérotées + une échappatoire "Avancé".
const GUIDED_STEPS: { key: DesignStep; n: number; label: string; sub: string }[] = [
  { key: "patch", n: 1, label: "Patch", sub: "Qu'ai-je ?" },
  { key: "place", n: 2, label: "Placer", sub: "Où sont-ils ?" },
  { key: "program", n: 3, label: "Programmer", sub: "Quels états ?" },
  { key: "sequence", n: 4, label: "Séquencer", sub: "Dans quel ordre ?" },
];
const GUIDED_ORDER: DesignStep[] = GUIDED_STEPS.map((s) => s.key);

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
    selectFixture,
    toggleFixtureSelection,
  } = useStore();

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
        onNodeClick={(event, node) => {
          setSelectedNode(node);
          if (node.type === "fixtureNode" || node.type === "dmxOutput") {
            // Shift/Ctrl/Cmd → sélection additive partagée (multi-fixtures).
            const additive = Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
            if (additive) {
              toggleFixtureSelection(node.id, true);
            } else {
              selectFixture(node.id);
            }
          } else {
            selectFixture(null);
          }
        }}
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

interface AppShellProps {
  routeMode?: "smart" | "creator";
}

// Shared shell for the Smart and Creator entrypoints.
export default function AppShell({ routeMode }: AppShellProps = {}) {
  const {
    appMode, setAppMode, proView, setProView,
    designStep, setDesignStep,
    isBottomPanelVisible, setIsBottomPanelVisible,
    isRightPanelVisible, setIsRightPanelVisible,
    activeRightTab, setActiveRightTab,
    selectFixture,
    addToast, saveProject, currentProjectName,
    livePerformanceMode, setLivePerformanceMode,
  } = useStore();
  const [placeView, setPlaceView] = useState<"2d" | "3d">("2d");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [needsPairing, setNeedsPairing] = useState(false);
  const [pairingToken, setPairingToken] = useState("");

  useAutosave();
  useCrashRecovery();
  useOfflineProjectBackup();

  useEffect(() => {
    let cancelled = false;
    ensureAuthToken().then((ready) => {
      if (cancelled) return;
      setAuthReady(ready);
      setNeedsPairing(!ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lire le query param ?mode= (utilisé par les shortcuts PWA du manifest)
  useEffect(() => {
    if (routeMode) {
      setAppMode(routeMode);
      return;
    }
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "smart" || mode === "creator") {
      setAppMode(mode);
    } else if (mode === "live") {
      setAppMode("smart");
      setLivePerformanceMode(true);
    }
  }, [routeMode, setAppMode, setLivePerformanceMode]);


  // F10 -> mode Live Performance plein ecran.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "F10") return;
      event.preventDefault();
      setAppMode("smart");
      setLivePerformanceMode(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setAppMode, setLivePerformanceMode]);
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

  // Ctrl+Z / Ctrl+Y -> global structural history
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) return;

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        const entry = e.shiftKey ? redoHistory() : undoHistory();
        addToast({
          type: entry ? "info" : "warning",
          message: entry ? (e.shiftKey ? "Retabli" : "Annule") : "Historique",
          detail: entry ? entry.label : "Rien a annuler.",
          duration: 1600,
        });
      }
      if (key === "y") {
        e.preventDefault();
        const entry = redoHistory();
        addToast({
          type: entry ? "info" : "warning",
          message: entry ? "Retabli" : "Historique",
          detail: entry ? entry.label : "Rien a retablir.",
          duration: 1600,
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addToast]);

  const pairDevice = () => {
    const token = pairingToken.trim();
    if (!token) return;
    setAuthToken(token);
    setAuthReady(true);
    setNeedsPairing(false);
    socket.disconnect();
    socket.connect();
    addToast({ type: "success", message: "Appareil appaire" });
  };

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

      // Keys 1, 2 -> Right panel tabs
      if (e.key === "1") {
        e.preventDefault();
        setIsRightPanelVisible(true);
        setActiveRightTab("scenes");
      }
      if (e.key === "2") {
        e.preventDefault();
        setIsRightPanelVisible(true);
        setActiveRightTab("cues");
      }

      // Escape -> Deselect fixture
      if (e.key === "Escape") {
        e.preventDefault();
        selectFixture(null);
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
    setIsRightPanelVisible,
    setActiveRightTab,
    selectFixture,
  ]);

  if (!authReady && needsPairing) {
    return (
      <div className="min-h-screen bg-[#08090c] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-white/10 bg-black/40 rounded-lg p-5 space-y-4">
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-cyan-300">Appairage local</h1>
            <p className="mt-2 text-sm text-slate-400">
              Saisis le token affiche dans Reglages puis Securite sur la machine regie.
            </p>
          </div>
          <input
            value={pairingToken}
            onChange={(event) => setPairingToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") pairDevice();
            }}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
            placeholder="Token 64 caracteres"
          />
          <button
            type="button"
            onClick={pairDevice}
            className="w-full rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 py-2 text-sm font-black uppercase tracking-widest text-cyan-200"
          >
            Appairer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-black overflow-hidden relative select-none">
      <MidiListener />
      <ToastContainer />
      <Suspense fallback={null}>
        <GuidedTour />
      </Suspense>
      <TopBar />

      <div className="flex-1 flex overflow-hidden relative">
        {appMode === "smart" && (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading Smart Dashboard...</div>}>
            <SmartDashboard />
          </Suspense>
        )}
        {appMode === "creator" && (() => {
          const activeIdx = GUIDED_ORDER.indexOf(designStep);
          const nextStep =
            activeIdx >= 0 && activeIdx < GUIDED_ORDER.length - 1
              ? GUIDED_ORDER[activeIdx + 1]
              : null;
          return (
          <div className="relative flex-1 flex overflow-hidden bg-[#07090e]">
            {/* RAIL GAUCHE : pipeline numéroté 4 étapes + Avancé */}
            <nav className="w-[150px] shrink-0 border-r border-white/5 bg-[#0a0c10] flex flex-col p-3 gap-1.5">
              {/* Copilote centrale : IA Lumière, dispo depuis toutes les étapes */}
              <button
                onClick={() => setAiPanelOpen((v) => !v)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs tracking-wide transition-all cursor-pointer border ${
                  aiPanelOpen
                    ? "bg-violet-500/25 border-violet-400/60 text-violet-200 shadow-[0_0_18px_rgba(139,92,246,0.35)]"
                    : "bg-violet-500/10 border-violet-500/40 text-violet-300 hover:bg-violet-500/20"
                }`}
                title="IA Lumière (copilote)"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white">
                  <Wand2 className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">IA Lumière</span>
                  <span className="block text-[10px] text-violet-400/70 leading-tight">Copilote</span>
                </span>
              </button>

              <div className="my-1.5 h-px bg-white/5" />

              {GUIDED_STEPS.map((step) => {
                const stepIdx = GUIDED_ORDER.indexOf(step.key);
                const isActive = designStep === step.key;
                // "Avant" l'étape courante dans l'ordre guidé → ✓.
                const isDone = activeIdx >= 0 && stepIdx < activeIdx;
                return (
                  <button
                    key={step.key}
                    onClick={() => setDesignStep(step.key)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs tracking-wide transition-all cursor-pointer border ${
                      isActive
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        isActive
                          ? "bg-purple-500 text-white"
                          : isDone
                          ? "bg-purple-500/25 text-purple-300"
                          : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : step.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{step.label}</span>
                      <span className="block text-[10px] text-slate-500 leading-tight">{step.sub}</span>
                    </span>
                  </button>
                );
              })}

              {/* Séparateur + échappatoire Avancé */}
              <div className="my-1.5 h-px bg-white/5" />
              <button
                onClick={() => setDesignStep("advanced")}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs tracking-wide transition-all cursor-pointer border ${
                  designStep === "advanced"
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    designStep === "advanced" ? "bg-purple-500 text-white" : "bg-white/5 text-slate-500"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">Avancé</span>
                  <span className="block text-[10px] text-slate-500 leading-tight">Graphe nodal</span>
                </span>
              </button>

              {/* Bouton Suivant → (masqué sur sequence/advanced) */}
              {nextStep && (
                <button
                  onClick={() => setDesignStep(nextStep)}
                  className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-2 text-xs font-bold tracking-wide text-purple-300 transition-all hover:bg-purple-500/20 cursor-pointer"
                >
                  Suivant <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </nav>

            {/* ZONE CENTRALE : viewport contextuel selon designStep */}
            <div className="flex-1 flex flex-col overflow-hidden relative min-w-0 h-full">
              <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                {designStep === "patch" && (
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading Fixtures...</div>}>
                    <FixturesPage embedded={true} />
                  </Suspense>
                )}

                {designStep === "place" && (
                  <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
                    {/* Toggle segmenté 2D / 3D */}
                    <div className="absolute top-3 right-3 z-30 flex bg-black/50 rounded-lg p-1 border border-white/5 backdrop-blur-md">
                      <button
                        onClick={() => setPlaceView("2d")}
                        className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                          placeView === "2d" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        2D
                      </button>
                      <button
                        onClick={() => setPlaceView("3d")}
                        className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                          placeView === "3d" ? "bg-purple-500/20 text-purple-400" : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        3D
                      </button>
                    </div>
                    {placeView === "2d" ? (
                      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading Stage Plan...</div>}>
                        <StagePlan capabilities="build" />
                      </Suspense>
                    ) : (
                      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading 3D Visualizer...</div>}>
                        <VisualizerView />
                      </Suspense>
                    )}
                  </div>
                )}

                {designStep === "program" && (
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading Stage Plan...</div>}>
                    <StagePlan capabilities="build" />
                  </Suspense>
                )}

                {designStep === "sequence" && (
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading 3D Visualizer...</div>}>
                    <VisualizerView />
                  </Suspense>
                )}

                {designStep === "advanced" && (
                  <ReactFlowProvider>
                    <FlowCanvas />
                  </ReactFlowProvider>
                )}
              </div>

              {/* Panneau bas (Fixture Controller) — uniquement à l'étape "program" */}
              {designStep === "program" && isBottomPanelVisible && (
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
                    <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading Fixture Controller...</div>}>
                      <FixtureController className="h-full border-0 rounded-none bg-transparent" />
                    </Suspense>
                  </div>
                </div>
              )}

              {/* Restore bottom panel button — uniquement à l'étape "program" */}
              {designStep === "program" && !isBottomPanelVisible && (
                <button
                  onClick={() => setIsBottomPanelVisible(true)}
                  className="absolute bottom-4 left-6 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-[10px] font-black tracking-wider text-cyan-400 hover:text-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer z-50 font-mono"
                  title="Afficher (Shift+Tab)"
                >
                  ▲ CONTROLES
                </button>
              )}
            </div>

            {/* PANNEAU DROIT : Scènes — uniquement à l'étape "program" */}
            {designStep === "program" && isRightPanelVisible && (
              <div className="w-[360px] min-w-[300px] border-l border-white/5 bg-[#0c0e12] flex flex-col z-40 relative h-full overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between bg-[#07090e] border-b border-white/5 px-3 py-2 shrink-0">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Scènes</h2>
                  <button
                    onClick={() => setIsRightPanelVisible(false)}
                    className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
                    title="Masquer le panneau"
                  >
                    <span>▶</span>
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading Scenes...</div>}>
                    <SceneController variant="sidebar" />
                  </Suspense>
                </div>
              </div>
            )}

            {/* Restore right panel floating tab — uniquement à l'étape "program" */}
            {designStep === "program" && !isRightPanelVisible && (
              <button
                onClick={() => setIsRightPanelVisible(true)}
                className="absolute top-20 right-4 p-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer z-50"
                title="Afficher le panneau"
              >
                ◀
              </button>
            )}

            {/* DRAWER IA Lumière — overlay droit, dispo depuis toutes les étapes DESIGN */}
            {aiPanelOpen && (
              <div className="absolute right-0 top-0 bottom-0 w-[380px] z-50 bg-[#0c0e12] border-l border-white/5 flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between bg-[#07090e] border-b border-white/5 px-3 py-2 shrink-0">
                  <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-violet-300">
                    <Wand2 className="h-3.5 w-3.5" />
                    IA Lumière
                  </h2>
                  <button
                    onClick={() => setAiPanelOpen(false)}
                    className="p-1.5 text-slate-600 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading IA Lumière...</div>}>
                    <OrchestratorController />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
          );
        })()}
      </div>
      <Suspense fallback={<div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">Loading Timeline...</div>}>
        <MacroTimeline />
      </Suspense>
      {livePerformanceMode && (
        <Suspense fallback={<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black text-sm text-slate-400">Loading Live Performance...</div>}>
          <LivePerformanceView />
        </Suspense>
      )}
    </div>
  );
}
