"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Activity,
  Flame,
  Zap,
  Droplets,
  Plus,
  X,
  Check,
  Sparkles,
  AudioLines,
  Wifi,
  WifiOff,
  Settings,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Volume2,
  Sliders,
  Film,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Grid,
  MonitorUp,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { socket } from "../lib/socket";
import useStore, { type SmartPad } from "../store/useStore";
import MiniOverlay from "./three/MiniOverlay";
import VisualizerView from "./VisualizerView";
import PatchPanel from "./PatchPanel";
import OrchestratorController from "./OrchestratorController";
import MediaGeneratorPanel from "./MediaGeneratorPanel";
import ProceduralVjCanvas, { type VjShaderMode } from "./ui/ProceduralVjCanvas";
import VideoProjectionWindow from "./ui/VideoProjectionWindow";
import { dmxEngine } from "../lib/dmxEngine";
import { API_BASE } from "../lib/config";
import { showAudioEngine } from "../lib/ShowAudioEngine";
import { useOfflineReadiness } from "../hooks/useOfflineReadiness";

const ZONE_MAP: Record<string, { pageId: number; widgetId: number }> = {
  Master: { pageId: 1, widgetId: 1 },
  Stage: { pageId: 1, widgetId: 2 },
  Bar: { pageId: 1, widgetId: 3 },
  Dancefloor: { pageId: 1, widgetId: 4 },
};

interface FixtureGroup {
  id: number;
  name: string;
  role: string | null;
  color: string | null;
  fixtureIds: number[];
}

interface ResolumeStatus {
  enabled: boolean;
  host: string;
  port: number;
  localPort: number;
  ready: boolean;
  lastActionAt: string | null;
  protocol: string;
  notes: string;
}

const LIVE_GROUP_ALIASES: Record<string, string> = {
  Master: "Master",
  Stage: "Piste",
  Face: "Face",
  Piste: "Piste",
  Bar: "Bar",
  Dancefloor: "Dancefloor",
  Fond: "Fond",
  Contre: "Fond",
  "Latéral": "Fond",
  "Douche 1": "Piste",
  "Douche 2": "Dancefloor",
  "Douche 3": "Bar",
};

const LIVE_GROUP_ZONE_IDS: Record<string, number> = {
  Master: 1,
  Piste: 2,
  Bar: 3,
  Dancefloor: 4,
};

const CRASH_SNAPSHOT_KEY = "glow-logic-crash-snapshot";
const MAX_RECOVERY_AGE_MS = 48 * 60 * 60 * 1000;

function resolveBackendGroupName(groupName: string) {
  return LIVE_GROUP_ALIASES[groupName] || groupName;
}

function formatRecoveryAge(timestamp?: number) {
  if (!timestamp) return "Aucun";
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

function readCrashSnapshotMeta() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CRASH_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { updatedAt?: number; clean?: boolean; state?: unknown };
    if (!parsed.updatedAt || !parsed.state) return null;
    return {
      updatedAt: parsed.updatedAt,
      clean: Boolean(parsed.clean),
      fresh: Date.now() - parsed.updatedAt < MAX_RECOVERY_AGE_MS,
    };
  } catch {
    return null;
  }
}

const SCENE_COLORS = [
  { label: "Cyan", bg: "bg-cyan-500", text: "text-cyan-400" },
  { label: "Rouge", bg: "bg-red-500", text: "text-red-400" },
  { label: "Violet", bg: "bg-purple-500", text: "text-purple-400" },
  { label: "Vert", bg: "bg-green-500", text: "text-green-400" },
  { label: "Orange", bg: "bg-orange-500", text: "text-orange-400" },
  { label: "Rose", bg: "bg-pink-500", text: "text-pink-400" },
  { label: "Blanc", bg: "bg-white", text: "text-slate-100" },
  { label: "Bleu", bg: "bg-blue-500", text: "text-blue-400" },
];

const ICONS: Record<string, React.ReactNode> = {
  Droplets: <Droplets className="w-6 h-6" />,
  Flame: <Flame className="w-6 h-6" />,
  Zap: <Zap className="w-6 h-6" />,
  Activity: <Activity className="w-6 h-6" />,
  Sparkles: <Sparkles className="w-6 h-6" />,
  AudioLines: <AudioLines className="w-6 h-6" />,
};

const STARTER_SHOWS = {
  wedding: {
    label: "Mariage",
    detail: "Entrée, dîner, ouverture, dancefloor, final.",
    pads: [
      { name: "Accueil doux", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Droplets", values: { 1: 95, 3: 120, 6: 180, 7: 0, 8: 40 } },
      { name: "Diner chaud", color: "bg-orange-500", textColor: "text-orange-400", iconName: "Sparkles", values: { 1: 70, 3: 90, 6: 150, 7: 30, 8: 15 } },
      { name: "Ouverture bal", color: "bg-white", textColor: "text-slate-100", iconName: "Activity", values: { 1: 150, 3: 150, 6: 255, 7: 0, 8: 0 } },
      { name: "Dancefloor", color: "bg-purple-500", textColor: "text-purple-400", iconName: "Zap", values: { 1: 170, 3: 170, 6: 255, 7: 80, 8: 120 } },
      { name: "Slow", color: "bg-pink-500", textColor: "text-pink-400", iconName: "Droplets", values: { 1: 90, 3: 110, 6: 180, 7: 20, 8: 70 } },
      { name: "Final blanc", color: "bg-white", textColor: "text-slate-100", iconName: "Sparkles", values: { 1: 220, 3: 220, 6: 255, 7: 0, 8: 0 } },
    ],
  },
  club: {
    label: "Club / DJ",
    detail: "Warmup, build, drop, strobe, blackout contrôlé.",
    pads: [
      { name: "Warmup blue", color: "bg-blue-500", textColor: "text-blue-400", iconName: "Droplets", values: { 1: 80, 3: 100, 6: 180, 7: 0, 8: 140 } },
      { name: "Build amber", color: "bg-amber-500", textColor: "text-amber-400", iconName: "Activity", values: { 1: 130, 3: 130, 6: 220, 7: 40, 8: 60 } },
      { name: "Drop neon", color: "bg-purple-500", textColor: "text-purple-400", iconName: "Zap", values: { 1: 210, 3: 210, 6: 255, 7: 120, 8: 90, 9: 90 } },
      { name: "Bass pulse", color: "bg-red-500", textColor: "text-red-400", iconName: "Flame", values: { 1: 190, 3: 160, 6: 255, 7: 70, 8: 30 } },
      { name: "Strobe safe", color: "bg-white", textColor: "text-slate-100", iconName: "Activity", values: { 1: 180, 3: 180, 6: 255, 7: 180, 8: 0 } },
      { name: "Reset look", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Sparkles", values: { 1: 120, 3: 120, 6: 180, 7: 0, 8: 0 } },
    ],
  },
  live_vj: {
    label: "Live / VJ",
    detail: "Lumière basse pour garder la vidéo lisible.",
    pads: [
      { name: "Video readable", color: "bg-blue-500", textColor: "text-blue-400", iconName: "AudioLines", values: { 1: 55, 3: 70, 6: 120, 7: 0, 8: 100 } },
      { name: "Face propre", color: "bg-white", textColor: "text-slate-100", iconName: "Sparkles", values: { 1: 110, 3: 80, 6: 170, 7: 0, 8: 0 } },
      { name: "Silhouette", color: "bg-purple-500", textColor: "text-purple-400", iconName: "Droplets", values: { 1: 75, 3: 90, 6: 150, 7: 10, 8: 130 } },
      { name: "Chorus lift", color: "bg-cyan-500", textColor: "text-cyan-400", iconName: "Activity", values: { 1: 145, 3: 145, 6: 210, 7: 0, 8: 70 } },
      { name: "Solo focus", color: "bg-amber-500", textColor: "text-amber-400", iconName: "Zap", values: { 1: 130, 3: 110, 6: 180, 7: 20, 8: 20 } },
      { name: "Interlude dark", color: "bg-slate-500", textColor: "text-slate-300", iconName: "Droplets", values: { 1: 30, 3: 45, 6: 90, 7: 0, 8: 160 } },
    ],
  },
};

const CONTROL_SURFACE_PRESETS = {
  apc_mini: {
    label: "APC Mini",
    detail: "Rangée basse 56-63",
    midiChannel: 1,
    notes: [56, 57, 58, 59, 60, 61, 62, 63],
    columns: 4,
  },
  launchpad: {
    label: "Launchpad",
    detail: "User mode 36-43",
    midiChannel: 1,
    notes: [36, 37, 38, 39, 40, 41, 42, 43],
    columns: 4,
  },
  keyboard: {
    label: "Clavier MIDI",
    detail: "C3 a B3",
    midiChannel: 1,
    notes: [60, 61, 62, 63, 64, 65, 66, 67],
    columns: 4,
  },
};

export default function SmartDashboard() {
  // Persistance via Zustand
  const {
    smartActiveScene: activeScene,
    smartZoneValues: zoneValues,
    setSmartZoneValue,
    smartZoneMappings,
    setSmartZoneMapping,
    smartPads: pads,
    setSmartPads,
    addSmartPad,
    updateSmartPad,
    deleteSmartPad,
    reorderSmartPads,
    bpm,
    addToast,
    createShowSnapshot,
    refreshShowSnapshots,
    restoreShowSnapshot,
    showSnapshots,
    saveProject,
    currentProjectName,
    nodes,
    fixtures,
    fetchFixtures,
    triggerSmartPad,
    
    // New Smart Mode Slices
    smartEditMode,
    setSmartEditMode,
    smartPadColumns,
    setSmartPadColumns,
    smartWidgets,
    updateSmartWidget,
    reorderSmartWidgets,
    setSmartWidgets,
    showLock,
    setShowLock,
    masterDimmer,
    setMasterDimmer,
    
    // showPlayerSlice
    groupLevels,
    groupMutes,
    groupColors,
    setGroupLevel,
    setGroupMute,
    setGroupColor,
    masterVolume,
    setMasterVolume,
    playlist,
    currentTrackIndex,
    isPlaying,
    setIsPlaying,
    setCurrentTrackIndex,

    isSidebarVisible,
    proView,
    midiLearnMode,
    setMidiLearnMode,
    midiLearnActiveControl,
    setMidiLearnActiveControl,
    midiMappings,
    setMidiMapping,
    removeMidiMapping,
  } = useStore();
  const offlineReadiness = useOfflineReadiness();

  // Load fixtures globally
  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  useEffect(() => {
    const vjWidget = smartWidgets.find((widget) => widget.id === "vjDeck");
    if (vjWidget) {
      if (!vjWidget.visible || vjWidget.collapsed) {
        setSmartWidgets(smartWidgets.map((widget) => (
          widget.id === "vjDeck" ? { ...widget, visible: true, collapsed: false } : widget
        )));
      }
      return;
    }
    setSmartWidgets([
      ...smartWidgets,
      {
        id: "vjDeck",
        label: "VJ / Mapping / Resolume",
        order: smartWidgets.length,
        collapsed: false,
        visible: true,
      },
    ]);
  }, [setSmartWidgets, smartWidgets]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'controls' | 'ai' | 'automations'>('controls');

  useEffect(() => {
    const openAiPanel = () => setActiveTab('ai');
    window.addEventListener("glowlogic:show-ai-panel", openAiPanel);
    return () => window.removeEventListener("glowlogic:show-ai-panel", openAiPanel);
  }, []);

  // Zone Config Modal State
  const [showZoneConfig, setShowZoneConfig] = useState(false);
  const [editingZoneKey, setEditingZoneKey] = useState<string>("Master");

  // Pad Config Modal State
  const [showPadConfigModal, setShowPadConfigModal] = useState(false);
  const [editingPad, setEditingPad] = useState<(typeof pads)[0] | null>(null);
  const [editingPadName, setEditingPadName] = useState("");
  const [editingPadColor, setEditingPadColor] = useState(SCENE_COLORS[0]);
  const [editingPadIcon, setEditingPadIcon] = useState("Zap");
  const [editingPadMidiNote, setEditingPadMidiNote] = useState(-1);
  const [editingPadMidiChannel, setEditingPadMidiChannel] = useState(1);
  const [isListeningMidi, setIsListeningMidi] = useState(false);

  // Selected group inside interactive stage plan
  const [selectedStageGroup, setSelectedStageGroup] = useState<string | null>(null);
  const [fixtureGroups, setFixtureGroups] = useState<FixtureGroup[]>([]);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [safetySummary, setSafetySummary] = useState<{
    operatorRole: string;
    dangerousPhysicalOutputsEnabled: boolean;
    armed: Record<string, boolean>;
  } | null>(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [vjShaderMode, setVjShaderMode] = useState<VjShaderMode>("gradient");
  const [vjShaderIntensity, setVjShaderIntensity] = useState(0.72);
  const vjAudioBandsRef = useRef<[number, number, number]>([0, 0, 0]);
  const [resolumeStatus, setResolumeStatus] = useState<ResolumeStatus | null>(null);
  const [resolumeHost, setResolumeHost] = useState("127.0.0.1");
  const [resolumePort, setResolumePort] = useState(7000);
  const [resolumeLayer, setResolumeLayer] = useState(1);
  const [resolumeClip, setResolumeClip] = useState(1);
  const [resolumeOpacity, setResolumeOpacity] = useState(1);
  const [isResolumeBusy, setIsResolumeBusy] = useState(false);

  // Diagnostics State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showE2eGuide, setShowE2eGuide] = useState(false);
  const [showRecoveryGuide, setShowRecoveryGuide] = useState(false);
  const [crashSnapshotMeta, setCrashSnapshotMeta] = useState<ReturnType<typeof readCrashSnapshotMeta>>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<{
    hasAnomalies: boolean;
    status: {
      serialPorts: Array<{ path: string; manufacturer: string; friendlyName: string }>;
      pythonDmx: { active: boolean; port: string; pid: number | null };
      usbDmx: { connected: boolean; portPath: string; error: string | null };
      qlcWs: { connected: boolean; port: string };
      recentAnomalies: Array<{ timestamp: string; source: string; message: string; severity: string }>;
      supportLogs?: Array<{ timestamp: string; source: string; message: string; severity: string }>;
      supportLogPath?: string;
    };
    diagnosis: string;
  } | null>(null);

  const loadFixtureGroups = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fixture-groups`);
      if (!response.ok) throw new Error("Impossible de charger les groupes");
      const data = await response.json();
      setFixtureGroups(data);
    } catch (error) {
      console.warn("[SmartDashboard] Fixture groups unavailable", error);
    }
  }, []);

  const refreshResolumeStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/video/resolume`);
      if (!response.ok) return;
      const data = await response.json();
      setResolumeStatus(data);
      setResolumeHost(data.host || "127.0.0.1");
      setResolumePort(Number(data.port) || 7000);
    } catch {
      setResolumeStatus(null);
    }
  }, []);

  const saveResolumeConfig = useCallback(async (enabled: boolean) => {
    setIsResolumeBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/video/resolume/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, host: resolumeHost, port: resolumePort }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Configuration Resolume impossible");
      setResolumeStatus(data);
      addToast({
        type: "success",
        message: enabled ? "Resolume OSC actif" : "Resolume OSC desactive",
        detail: `${data.host}:${data.port}`,
      });
    } catch (error: any) {
      addToast({ type: "error", message: "Resolume indisponible", detail: error.message });
    } finally {
      setIsResolumeBusy(false);
    }
  }, [addToast, resolumeHost, resolumePort]);

  const sendResolumeAction = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    setIsResolumeBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/video/resolume/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action Resolume impossible");
      setResolumeStatus(data.status || data);
      addToast({
        type: data.sent ? "success" : "warning",
        message: data.sent ? "OSC envoye a Resolume" : "Resolume OSC desactive",
        detail: data.address || data.reason,
      });
    } catch (error: any) {
      addToast({ type: "error", message: "Action Resolume echouee", detail: error.message });
    } finally {
      setIsResolumeBusy(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadFixtureGroups();
  }, [loadFixtureGroups]);

  useEffect(() => {
    refreshResolumeStatus();
  }, [refreshResolumeStatus]);

  const refreshPreflightData = useCallback(async () => {
    try {
      const [libraryResponse, safetyResponse] = await Promise.all([
        fetch(`${API_BASE}/api/library`),
        fetch(`${API_BASE}/api/safety`),
      ]);
      if (libraryResponse.ok) {
        const library = await libraryResponse.json();
        setLibraryCount(Array.isArray(library) ? library.length : 0);
      }
      if (safetyResponse.ok) {
        setSafetySummary(await safetyResponse.json());
      }
    } catch {
      setLibraryCount(null);
      setSafetySummary(null);
    }
  }, []);

  useEffect(() => {
    refreshPreflightData();
  }, [refreshPreflightData]);

  useEffect(() => {
    refreshShowSnapshots();
    setCrashSnapshotMeta(readCrashSnapshotMeta());
  }, [refreshShowSnapshots]);

  const emitLiveGroupIntensity = useCallback((groupName: string, level: number) => {
    const backendGroup = resolveBackendGroupName(groupName);
    const zoneId = LIVE_GROUP_ZONE_IDS[backendGroup] || undefined;
    socket.emit("smart:zone_intensity", {
      zoneId,
      groupName: backendGroup,
      value: Math.round(((level / 100) * 255) * (masterDimmer / 255)),
    });
  }, [masterDimmer]);

  useEffect(() => {
    Object.entries(groupLevels).forEach(([groupName, level]) => {
      emitLiveGroupIntensity(groupName, level);
    });
  }, [emitLiveGroupIntensity, groupLevels]);

  // Ensure core widgets are always visible and expanded (fix stale persisted state)
  useEffect(() => {
    const CORE_VISIBLE = ['groupStrips', 'stagePlan', 'pads', 'zoneControls'];
    const ALWAYS_VISIBLE_COLLAPSED = ['miniPlaylist', 'spectro', 'apcVirtual'];
    let needsUpdate = false;
    const updated = smartWidgets.map(w => {
      const changes: Partial<typeof w> = {};
      if (CORE_VISIBLE.includes(w.id)) {
        if (!w.visible) { changes.visible = true; needsUpdate = true; }
        if (w.collapsed) { changes.collapsed = false; needsUpdate = true; }
      }
      if (ALWAYS_VISIBLE_COLLAPSED.includes(w.id) && !w.visible) {
        changes.visible = true; needsUpdate = true;
      }
      return { ...w, ...changes };
    });
    // Add stagePlan if missing
    if (!updated.some(w => w.id === 'stagePlan')) {
      updated.push({ id: 'stagePlan' as any, label: 'Plan de Scène Interactif', order: 1, collapsed: false, visible: true });
      needsUpdate = true;
    }
    if (needsUpdate) {
      const sorted = updated.sort((a, b) => a.order - b.order);
      setSmartWidgets(sorted.map((w, i) => ({ ...w, order: i })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const runDiagnostics = useCallback(async () => {
    setIsDiagnosing(true);
    try {
      const response = await fetch(`${API_BASE}/api/diagnose`);
      if (response.ok) {
        const data = await response.json();
        setDiagnosisResult(data);
        setShowDiagnosisModal(true);
      } else {
        const err = await response.json();
        addToast({
          type: "error",
          message: "Erreur Diagnostic",
          detail: err.details || "Erreur lors de l'exécution du diagnostic.",
        });
      }
    } catch (error: any) {
      addToast({
        type: "error",
        message: "Erreur de connexion",
        detail: error.message || "Impossible de contacter l'API.",
      });
    } finally {
      setIsDiagnosing(false);
    }
  }, [addToast]);

  const downloadSupportReport = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/support/report`);
      if (!response.ok) throw new Error("Rapport support indisponible");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `glow-logic-support-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      addToast({ type: "success", message: "Rapport support exporté" });
    } catch (error: any) {
      addToast({
        type: "error",
        message: "Export support impossible",
        detail: error.message || "Erreur inconnue",
      });
    }
  }, [addToast]);

  // Socket connection status for Live Context
  const [socketConnected, setSocketConnected] = useState(false);
  useEffect(() => {
    setSocketConnected(socket.connected);
    const on = () => setSocketConnected(true);
    const off = () => setSocketConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
    };
  }, []);

  // Synchronise l'état physique du DMX avec l'état local persisté au démarrage/reconnexion
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!socketConnected) {
      hasSyncedRef.current = false;
      return;
    }
    if (hasSyncedRef.current || fixtures.length === 0) return;

    hasSyncedRef.current = true;
    console.log("[SmartDashboard] Synchro de l'état DMX au démarrage/reconnexion...");

    // 1. Renvoyer les intensités des zones
    Object.entries(zoneValues).forEach(([zoneKey, rawValue]) => {
      const value255 = Math.round(((rawValue / 100) * 255) * (masterDimmer / 255));
      const map = ZONE_MAP[zoneKey];
      if (map) {
        socket.emit("smart:zone_intensity", {
          zoneId: map.widgetId,
          groupName: resolveBackendGroupName(zoneKey),
          value: value255,
        });
      }

      const mapping = smartZoneMappings[zoneKey];
      let assignedFixtures = mapping?.fixtures || [];
      if (zoneKey === "Master" && assignedFixtures.length === 0) {
        assignedFixtures = fixtures.map((f) => f.id);
      }

      assignedFixtures.forEach((fixtureId) => {
        const f = fixtures.find((fixture) => fixture.id === fixtureId);
        if (!f) return;
        const startAddr = f.start_address || f.startAddress || 1;
        const universe = f.universe || 1;
        const dimmers = (f.channels || []).filter(
          (ch: any) => ch.type === "dimmer" || ch.type === "intensity"
        );
        if (dimmers.length > 0) {
          dimmers.forEach((ch: any) => {
            dmxEngine.setChannel(universe, startAddr + ch.channel - 1, value255);
          });
        } else {
          const colors = (f.channels || []).filter(
            (ch: any) => ["red", "green", "blue", "white", "amber", "uv"].includes(ch.type)
          );
          colors.forEach((ch: any) => {
            dmxEngine.setChannel(universe, startAddr + ch.channel - 1, value255);
          });
        }
      });
    });

    // 2. Renvoyer la scène active
    if (activeScene !== null) {
      const activePad = pads.find((p) => p.qlcWidget === activeScene);
      if (activePad) {
        socket.emit("smart:trigger_scene", {
          pageId: activePad.qlcPage,
          widgetId: activePad.qlcWidget,
          active: true,
        });
        if (activePad.dmxValues) {
          Object.entries(activePad.dmxValues).forEach(([chStr, val]) => {
            dmxEngine.setChannel(1, Number(chStr), Math.round(Number(val) * (masterDimmer / 255)));
          });
        }
      }
    }
  }, [socketConnected, fixtures, zoneValues, smartZoneMappings, activeScene, pads, masterDimmer]);

  // Modal "New Scene"
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SCENE_COLORS[0]);
  const [newWidget, setNewWidget] = useState(20);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showModal) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [showModal]);

  // Dynamic DMX dispatching based on configured Zone Mappings
  const handleZoneChange = useCallback(
    (zoneKey: string, rawValue: number) => {
      setSmartZoneValue(zoneKey, rawValue);
      const value255 = Math.round(((rawValue / 100) * 255) * (masterDimmer / 255));

      // Emit QLC+ zone intensity socket event for compatibility
      const map = ZONE_MAP[zoneKey];
      if (map) {
        socket.emit("smart:zone_intensity", {
          zoneId: map.widgetId,
          groupName: resolveBackendGroupName(zoneKey),
          value: value255,
        });
      }

      // Dispatch DMX changes based on user assignments
      const mapping = smartZoneMappings[zoneKey];
      let assignedFixtures = mapping?.fixtures || [];

      // Fallback for Master: if no fixtures are assigned, control all patched fixtures
      if (zoneKey === "Master" && assignedFixtures.length === 0) {
        assignedFixtures = fixtures.map((f) => f.id);
      }

      assignedFixtures.forEach((fixtureId) => {
        const f = fixtures.find((fixture) => fixture.id === fixtureId);
        if (!f) return;
        
        const startAddr = f.start_address || f.startAddress || 1;
        const universe = f.universe || 1;

        // Find dimmer or intensity channels
        const dimmers = (f.channels || []).filter(
          (ch: any) => ch.type === "dimmer" || ch.type === "intensity"
        );

        if (dimmers.length > 0) {
          dimmers.forEach((ch: any) => {
            const absCh = startAddr + ch.channel - 1;
            dmxEngine.setChannel(universe, absCh, value255);
          });
        } else {
          // If no dimmer, scale color channels (RGB)
          const colors = (f.channels || []).filter(
            (ch: any) => ["red", "green", "blue", "white", "amber", "uv"].includes(ch.type)
          );
          colors.forEach((ch: any) => {
            const absCh = startAddr + ch.channel - 1;
            dmxEngine.setChannel(universe, absCh, value255);
          });
        }
      });
    },
    [setSmartZoneValue, smartZoneMappings, fixtures, masterDimmer],
  );

  // Synchronize zone sliders with physical DMX values when changed externally (dmx_sync)
  useEffect(() => {
    const onDmxSync = (data: { universe: number; channel: number; value: number }) => {
      Object.entries(smartZoneMappings).forEach(([zoneKey, mapping]) => {
        let assignedFixtures = mapping.fixtures || [];
        if (zoneKey === "Master" && assignedFixtures.length === 0) {
          assignedFixtures = fixtures.map((f) => f.id);
        }

        for (const fixtureId of assignedFixtures) {
          const f = fixtures.find((fixture) => fixture.id === fixtureId);
          if (!f) continue;

          const startAddr = f.start_address || f.startAddress || 1;
          const universe = f.universe || 1;

          if (data.universe !== universe) continue;

          const dimmers = (f.channels || []).filter(
            (ch: any) => ch.type === "dimmer" || ch.type === "intensity"
          );

          let matched = false;
          if (dimmers.length > 0) {
            matched = dimmers.some((ch: any) => startAddr + ch.channel - 1 === data.channel);
          } else {
            const colors = (f.channels || []).filter(
              (ch: any) => ["red", "green", "blue"].includes(ch.type)
            );
            matched = colors.some((ch: any) => startAddr + ch.channel - 1 === data.channel);
          }

          if (matched) {
            const percent = Math.round((data.value / 255) * 100);
            setSmartZoneValue(zoneKey, percent);
            break; // Done with this zone
          }
        }
      });
    };

    socket.on("dmx_sync", onDmxSync);
    return () => {
      socket.off("dmx_sync", onDmxSync);
    };
  }, [smartZoneMappings, fixtures, setSmartZoneValue]);

  const handlePadClick = useCallback(
    (pad: (typeof pads)[0]) => {
      triggerSmartPad(pad);
    },
    [triggerSmartPad],
  );

  const handleCreateScene = useCallback(() => {
    if (!newName.trim()) return;
    const newId = Date.now();
    addSmartPad({
      id: newId,
      name: newName.trim(),
      color: newColor.bg,
      textColor: newColor.text,
      iconName: "Zap",
      qlcPage: 1,
      qlcWidget: newWidget,
      midiNote: -1,
      midiChannel: 1,
      gridCol: 0, gridRow: 0, gridW: 1, gridH: 1,
    });
    addToast({
      type: "success",
      message: "Nouvelle scène créée",
      detail: newName.trim(),
    });
    setShowModal(false);
    setNewName("");
    setNewColor(SCENE_COLORS[0]);
    setNewWidget((prev) => prev + 1);
  }, [newName, newColor, newWidget, addSmartPad, addToast]);

  const handleSavePadConfig = useCallback(() => {
    if (!editingPad) return;
    if (showLock) {
      addToast({
        type: "error",
        message: "Show Lock actif",
        detail: "Désactivez le verrou pour supprimer une scène.",
      });
      return;
    }
    updateSmartPad(editingPad.id, {
      name: editingPadName.trim(),
      color: editingPadColor.bg,
      textColor: editingPadColor.text,
      iconName: editingPadIcon,
      midiNote: editingPadMidiNote,
      midiChannel: editingPadMidiChannel,
    });
    addToast({
      type: "success",
      message: "Configuration pad enregistrée",
      detail: editingPadName.trim(),
    });
    setShowPadConfigModal(false);
    setEditingPad(null);
  }, [editingPad, editingPadName, editingPadColor, editingPadIcon, editingPadMidiNote, editingPadMidiChannel, showLock, updateSmartPad, addToast]);

  const handleDeletePad = useCallback(() => {
    if (!editingPad) return;
    if (!window.confirm(`Supprimer la scène "${editingPad.name}" ?`)) return;
    deleteSmartPad(editingPad.id);
    addToast({
      type: "info",
      message: "Scène supprimée",
      detail: editingPad.name,
    });
    setShowPadConfigModal(false);
    setEditingPad(null);
  }, [editingPad, deleteSmartPad, addToast]);

  const startMidiLearnForPad = useCallback(() => {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      addToast({
        type: "error",
        message: "Web MIDI API non disponible",
      });
      return;
    }

    setIsListeningMidi(true);
     
    (navigator as any).requestMIDIAccess({ sysex: false }).then((access: any) => {
      const inputs = Array.from(access.inputs.values());
      if (inputs.length === 0) {
        setIsListeningMidi(false);
        addToast({
          type: "warning",
          message: "Aucun périphérique MIDI connecté",
        });
        return;
      }

      let mapped = false;

      inputs.forEach((input: any) => {
        const originalOnMessage = input.onmidimessage;
        input.onmidimessage = (msg: any) => {
          if (mapped) return;
          const data = msg.data;
          if (!data || data.length === 0) return;
          const command = data[0];
          const type = command & 0xf0;
          const channel = (command & 0x0f) + 1; // 1-indexed for display

          if (type === 144 || type === 176) {
            const note = data[1];
            setEditingPadMidiNote(note);
            setEditingPadMidiChannel(channel);
            mapped = true;
            setIsListeningMidi(false);

            addToast({
              type: "success",
              message: "Note MIDI détectée",
              detail: `Note: ${note}, Canal: ${channel}`,
            });

            inputs.forEach((inp: any) => {
              inp.onmidimessage = originalOnMessage;
            });
          }
        };
      });
    }).catch(() => {
      setIsListeningMidi(false);
    });
  }, [addToast]);

  // Pad drag and drop local state
  const [, setDraggedPadId] = useState<number | null>(null);

  const handlePadDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("text/plain", id.toString());
    setDraggedPadId(id);
  };

  const handlePadDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handlePadDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const sourceId = Number(e.dataTransfer.getData("text/plain"));
    if (sourceId && sourceId !== targetId) {
      reorderSmartPads(sourceId, targetId);
    }
    setDraggedPadId(null);
  };

  const applyStarterShow = useCallback((templateId: keyof typeof STARTER_SHOWS) => {
    if (showLock) {
      addToast({
        type: "error",
        message: "Show Lock actif",
        detail: "Desactivez le verrou pour remplacer les pads.",
      });
      return;
    }

    const template = STARTER_SHOWS[templateId];
    if (pads.length > 0 && !window.confirm(`Remplacer les pads actuels par le show "${template.label}" ?`)) {
      return;
    }

    const starterPads: SmartPad[] = template.pads.map((pad, index) => ({
      id: Date.now() + index,
      name: pad.name,
      color: pad.color,
      textColor: pad.textColor,
      iconName: pad.iconName,
      qlcPage: 1,
      qlcWidget: 80 + index,
      dmxValues: { ...pad.values } as Record<number, number>,
      midiNote: 56 + index,
      midiChannel: 1,
      gridCol: index % 4,
      gridRow: Math.floor(index / 4),
      gridW: 1,
      gridH: 1,
    }));

    setSmartPads(starterPads);
    setSmartPadColumns(4);
    addToast({
      type: "success",
      message: "Show starter cree",
      detail: `${template.label} - ${template.pads.length} pads prets a jouer.`,
    });
  }, [addToast, pads.length, setSmartPadColumns, setSmartPads, showLock]);

  const applyControlSurfacePreset = useCallback((presetId: keyof typeof CONTROL_SURFACE_PRESETS) => {
    const preset = CONTROL_SURFACE_PRESETS[presetId];
    if (!pads.length) {
      addToast({
        type: "warning",
        message: "Aucun pad a mapper",
        detail: "Genere ou ajoute des pads avant d'appliquer un controleur.",
      });
      return;
    }

    if (showLock) {
      addToast({
        type: "warning",
        message: "Show Lock actif",
        detail: "Desactive Show Lock pour modifier les mappings MIDI des pads.",
      });
      return;
    }

    const existingPadMappings = Object.keys(midiMappings).filter((key) => key.startsWith("pad_"));
    const hasExistingPadMidi = pads.some((pad) => pad.midiNote >= 0) || existingPadMappings.length > 0;
    if (hasExistingPadMidi && !window.confirm(`Remplacer les mappings MIDI des pads par ${preset.label} ?`)) {
      return;
    }

    existingPadMappings.forEach(removeMidiMapping);

    setSmartPads(pads.map((pad, index) => {
      const midiNote = preset.notes[index] ?? -1;
      if (midiNote >= 0) {
        setMidiMapping(`pad_${pad.id}`, {
          type: 144,
          channel: preset.midiChannel - 1,
          data1: midiNote,
        });
      }
      return {
        ...pad,
        midiNote,
        midiChannel: preset.midiChannel,
      };
    }));
    setSmartPadColumns(preset.columns);

    addToast({
      type: "success",
      message: "Controleur mappe",
      detail: `${preset.label}: ${Math.min(pads.length, preset.notes.length)} pad(s) assignes.`,
    });
  }, [
    addToast,
    midiMappings,
    pads,
    removeMidiMapping,
    setMidiMapping,
    setSmartPadColumns,
    setSmartPads,
    showLock,
  ]);

  // Render sub-widgets
  const renderGroupStrips = () => {
    const groups = ['Face', 'Douche 1', 'Douche 2', 'Douche 3', 'Latéral', 'Contre'];
    const masterPercent = Math.round((masterDimmer / 255) * 100);
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-black/25 rounded-xl p-3.5 border border-white/5">
          <div className="min-w-[130px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Master dimmer</p>
            <p className="text-[10px] text-slate-500">Scale global DMX</p>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={masterDimmer}
            onChange={(event) => setMasterDimmer(Number(event.target.value))}
            className="flex-1 min-w-[180px] accent-cyan-400"
          />
          <span className="w-14 text-right text-cyan-300 text-xs font-mono font-black">
            {masterPercent}%
          </span>
        </div>

        <div className="dmx-groups-mixer grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-end">
        {groups.map((groupName) => {
          const val = groupLevels[groupName] ?? 80;
          const isMuted = groupMutes[groupName] === true;
          const hexColor = groupColors[groupName] || '#ffffff';
          const backendGroup = resolveBackendGroupName(groupName);
          const savedGroup = fixtureGroups.find((group) => group.name.toLowerCase() === backendGroup.toLowerCase());
          const assignmentLabel = savedGroup ? `${savedGroup.fixtureIds.length} fx` : 'A assigner';
          
          return (
            <div key={groupName} className="flex flex-col items-center bg-black/25 rounded-xl p-3.5 border border-white/5 gap-3 shadow-inner">
              {/* Color circle input */}
              <div className="relative w-8 h-8 rounded-full border border-white/20 hover:scale-105 transition-transform shadow-[0_0_10px_rgba(255,255,255,0.05)] cursor-pointer" style={{ backgroundColor: hexColor }}>
                <input 
                  type="color" 
                  value={hexColor} 
                  onChange={(e) => setGroupColor(groupName, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Modifier la couleur du groupe"
                />
              </div>

              {/* Slider vertical */}
              <div className="h-32 flex items-center justify-center py-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={val}
                  style={{
                    writingMode: 'vertical-lr' as any,
                    direction: 'rtl' as any,
                    height: '7.5rem',
                    width: '1.25rem',
                  }}
                  onChange={(e) => {
                    const level = Number(e.target.value);
                    setGroupLevel(groupName, level);
                    emitLiveGroupIntensity(groupName, level);
                  }}
                  className="w-1.25 h-28 bg-slate-950 border border-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Mute and labels */}
              <div className="flex flex-col items-center gap-1.5 w-full">
                <button
                  onClick={() => setGroupMute(groupName, !isMuted)}
                  className={`w-full py-1.5 rounded-lg text-[9px] font-bold border transition-colors ${
                    isMuted 
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' 
                      : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  {isMuted ? 'MUTÉ' : 'MUTE'}
                </button>
                <span className="text-[10px] font-bold text-slate-400 truncate max-w-full text-center">{groupName}</span>
                <span className="text-[10px] font-mono font-bold text-slate-300">{val}%</span>
                <span className="text-[9px] font-bold text-cyan-400/80 truncate max-w-full text-center">{backendGroup} - {assignmentLabel}</span>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    );
  };

  const renderStagePlan = () => {
    const isSelected = (group: string) => selectedStageGroup === group;
    
    const getGroupStyle = (groupName: string) => {
      const isMuted = groupMutes[groupName] === true;
      const level = groupLevels[groupName] ?? 80;
      const hexColor = groupColors[groupName] || '#ffffff';
      
      return {
        borderColor: isMuted || level === 0 ? '#475569' : hexColor,
        backgroundColor: isMuted || level === 0 ? '#1e293b' : `${hexColor}22`,
        boxShadow: isMuted || level === 0 ? 'none' : `0 0 15px ${hexColor}88`,
        color: isMuted || level === 0 ? '#64748b' : hexColor,
        opacity: isMuted ? 0.4 : 1
      };
    };

    return (
      <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
        {/* Visual Stage Plan */}
        <div className="flex-1 bg-[#050608] border border-white/5 rounded-2xl relative overflow-hidden py-10 px-8 min-h-[380px] flex flex-col justify-between items-center shadow-inner">
          <div className="absolute top-4 left-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Plan de Scène Interactif</div>
          
          {/* Lyres row (Top) */}
          <div className="flex flex-col items-center w-full mt-4">
            <span className="text-[10px] text-slate-500 font-black tracking-widest mb-3 uppercase">Lyre</span>
            <div className="flex gap-12 justify-center w-full">
              {[1, 2, 3, 4].map((id) => {
                const group = 'Contre';
                const style = getGroupStyle(group);
                const active = isSelected(group);
                return (
                  <div 
                    key={id} 
                    onClick={() => setSelectedStageGroup(group)}
                    className="flex flex-col items-center relative cursor-pointer"
                  >
                    {/* Fixture Circle */}
                    <div 
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        active ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-105'
                      }`}
                      style={{
                        borderColor: style.borderColor,
                        backgroundColor: style.backgroundColor,
                        boxShadow: style.boxShadow,
                      }}
                    >
                      <span className="text-[9px] font-bold" style={{ color: style.color }}>LY{id}</span>
                    </div>

                    {/* Beam Cone */}
                    {!groupMutes[group] && (groupLevels[group] ?? 0) > 0 && (
                      <div 
                        className="absolute top-8 w-10 h-24 blur-[4px] rounded-b-full origin-top pointer-events-none transition-all duration-300"
                        style={{
                          background: `linear-gradient(to bottom, ${groupColors[group] || '#ffffff'}ee, transparent)`,
                          opacity: ((groupLevels[group] ?? 80) / 100) * 0.45,
                          height: `${40 + (((groupLevels[group] ?? 80) / 100) * 80)}px`
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Middle row: Latéraux & Douches */}
          <div className="flex justify-between items-center w-full px-4 py-8">
            {/* Lateral Left */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-purple-400 font-black tracking-wider uppercase mb-1">Lat</span>
              <div 
                onClick={() => setSelectedStageGroup('Latéral')}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
                  isSelected('Latéral') ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-105'
                }`}
                style={getGroupStyle('Latéral')}
              >
                <span className="text-[9px] font-bold">LAT1</span>
              </div>
            </div>

            {/* Douches 1, 2, 3 grid */}
            <div className="flex gap-10">
              {['Douche 1', 'Douche 2', 'Douche 3'].map((name, idx) => {
                const style = getGroupStyle(name);
                const active = isSelected(name);
                const colors = ['text-green-400', 'text-yellow-400', 'text-pink-400'];
                return (
                  <div key={name} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[9px] font-black tracking-wider uppercase ${colors[idx]}`}>{`Dch ${idx+1}`}</span>
                    <div className="flex gap-2">
                      {[1, 2].map((subId) => (
                        <div 
                          key={subId}
                          onClick={() => setSelectedStageGroup(name)}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
                            active ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-105'
                          }`}
                          style={style}
                        >
                          <span className="text-[8px] font-bold">D{idx+1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lateral Right */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-purple-400 font-black tracking-wider uppercase mb-1">Lat</span>
              <div 
                onClick={() => setSelectedStageGroup('Latéral')}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
                  isSelected('Latéral') ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-105'
                }`}
                style={getGroupStyle('Latéral')}
              >
                <span className="text-[9px] font-bold">LAT2</span>
              </div>
            </div>
          </div>

          {/* Face row (Bottom) */}
          <div className="flex flex-col items-center w-full mb-4">
            <span className="text-[10px] text-slate-500 font-black tracking-widest mb-2 uppercase">Face</span>
            <div className="flex gap-12 justify-center w-full">
              {[1, 2, 3, 4].map((id) => {
                const group = 'Face';
                const style = getGroupStyle(group);
                const active = isSelected(group);
                return (
                  <div 
                    key={id}
                    onClick={() => setSelectedStageGroup(group)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
                      active ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-105'
                    }`}
                    style={style}
                  >
                    <span className="text-[9px] font-bold" style={{ color: style.color }}>FC{id}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Group Quick Controls */}
        <div className="w-full lg:w-[260px] bg-[#0c0d12] border border-white/5 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          {selectedStageGroup ? (
            <div className="flex flex-col h-full justify-between gap-4">
              {/* Header Info */}
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-bold text-xs uppercase tracking-wider">{selectedStageGroup}</h4>
                  <button 
                    onClick={() => setSelectedStageGroup(null)}
                    className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Ajustement rapide du groupe</p>
              </div>

              {/* Slider Horizontal */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Intensité</span>
                  <span className="text-cyan-400 font-bold">{groupLevels[selectedStageGroup] ?? 0}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={groupLevels[selectedStageGroup] ?? 80}
                  onChange={(e) => {
                    const level = Number(e.target.value);
                    setGroupLevel(selectedStageGroup, level);
                    emitLiveGroupIntensity(selectedStageGroup, level);
                  }}
                  className="w-full h-1.5 bg-slate-900 rounded-full cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Color Grid Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Couleur</span>
                  {/* Hex Picker Trigger */}
                  <div className="relative w-6 h-6 rounded-full border border-white/20 cursor-pointer" style={{ backgroundColor: groupColors[selectedStageGroup] || '#ffffff' }}>
                    <input 
                      type="color" 
                      value={groupColors[selectedStageGroup] || '#ffffff'} 
                      onChange={(e) => setGroupColor(selectedStageGroup, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Cyan", hex: "#22d3ee" },
                    { label: "Rouge", hex: "#ef4444" },
                    { label: "Violet", hex: "#a855f7" },
                    { label: "Vert", hex: "#22c55e" },
                    { label: "Orange", hex: "#f97316" },
                    { label: "Rose", hex: "#ec4899" },
                    { label: "Blanc", hex: "#ffffff" },
                    { label: "Bleu", hex: "#3b82f6" }
                  ].map((colorObj) => {
                    const isColSelected = groupColors[selectedStageGroup!] === colorObj.hex;
                    return (
                      <button
                        key={colorObj.hex}
                        onClick={() => setGroupColor(selectedStageGroup, colorObj.hex)}
                        style={{ backgroundColor: colorObj.hex }}
                        className={`h-6 rounded border transition-all ${
                          isColSelected 
                            ? 'border-white scale-110 shadow-lg ring-1 ring-white/30' 
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        title={colorObj.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Mute and Level Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupMute(selectedStageGroup, !groupMutes[selectedStageGroup!])}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    groupMutes[selectedStageGroup!]
                      ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                      : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  {groupMutes[selectedStageGroup!] ? 'Activer (Muted)' : 'Muter'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-4">
              <Sparkles className="w-8 h-8 text-slate-700 animate-pulse mb-3" />
              <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Sélectionner un Groupe</p>
              <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed font-semibold">
                Cliquez sur un des groupes du plan de scène (Lyres, Face, Douches, Latéraux) pour ouvrir ses contrôles rapides de couleur et d'intensité.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPadsGrid = () => {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Assistant debutant
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                Genere une grille de looks prets a jouer selon le type d'evenement.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:w-[560px]">
              {(Object.entries(STARTER_SHOWS) as Array<[keyof typeof STARTER_SHOWS, typeof STARTER_SHOWS[keyof typeof STARTER_SHOWS]]>).map(([id, template]) => (
                <button
                  key={id}
                  onClick={() => applyStarterShow(id)}
                  className="min-h-[48px] rounded-xl bg-black/35 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all px-3 py-2 text-left"
                >
                  <span className="block text-xs text-white font-black">{template.label}</span>
                  <span className="block text-[10px] text-slate-500 font-semibold truncate">{template.detail}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                <Grid className="w-3.5 h-3.5 text-cyan-400" />
                Mapping tactile / MIDI rapide
              </p>
              <p className="text-[10px] text-slate-600 mt-1 font-semibold">
                Assigne les pads courants a une surface sans refaire MIDI Learn un par un.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:w-[560px]">
              {(Object.entries(CONTROL_SURFACE_PRESETS) as Array<[keyof typeof CONTROL_SURFACE_PRESETS, typeof CONTROL_SURFACE_PRESETS[keyof typeof CONTROL_SURFACE_PRESETS]]>).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => applyControlSurfacePreset(id)}
                  className="min-h-[44px] rounded-lg bg-black/30 border border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all px-3 py-2 text-left"
                >
                  <span className="block text-[11px] text-white font-black">{preset.label}</span>
                  <span className="block text-[9px] text-slate-500 font-semibold truncate">{preset.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grille Options (Columns selection in edit mode) */}
        {smartEditMode && (
          <div className="flex items-center gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs">
            <span className="text-slate-400 font-bold">Colonnes de la grille :</span>
            <div className="flex gap-1.5 bg-slate-900 p-0.5 rounded-lg border border-white/5">
              {[2, 3, 4, 5, 6, 8].map((c) => (
                <button
                  key={c}
                  onClick={() => setSmartPadColumns(c)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                    smartPadColumns === c 
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grille responsive */}
        <div 
          className="scene-pads-grid grid gap-4"
          style={{ gridTemplateColumns: `repeat(${smartPadColumns}, minmax(0, 1fr))` }}
        >
          {pads.map((pad) => {
            const isActive = activeScene === pad.qlcWidget;
            const controlId = `pad_${pad.id}`;
            const isLearning = midiLearnMode && midiLearnActiveControl === controlId;
            const hasMapping = !!midiMappings[controlId];
            
            const handleSaveCurrentDmx = (e: React.MouseEvent) => {
              e.stopPropagation();
              const activeDmx: Record<number, number> = {};
              for (let ch = 1; ch <= 512; ch++) {
                const val = dmxEngine.getChannel(1, ch);
                if (val > 0) {
                  activeDmx[ch] = val;
                }
              }
              updateSmartPad(pad.id, { dmxValues: activeDmx });
              addToast({
                type: "success",
                message: "Configuration DMX enregistrée",
                detail: `Pad "${pad.name}" mis à jour (${Object.keys(activeDmx).length} canaux DMX)`,
              });
            };

            const handleEditClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              setEditingPad(pad);
              setEditingPadName(pad.name);
              setEditingPadColor(SCENE_COLORS.find(c => c.bg === pad.color) || SCENE_COLORS[0]);
              setEditingPadIcon(pad.iconName);
              setEditingPadMidiNote(pad.midiNote);
              setEditingPadMidiChannel(pad.midiChannel);
              setShowPadConfigModal(true);
            };

            return (
              <div
                key={pad.id}
                draggable={smartEditMode}
                onDragStart={(e) => handlePadDragStart(e, pad.id)}
                onDragOver={handlePadDragOver}
                onDrop={(e) => handlePadDrop(e, pad.id)}
                onClick={() => {
                  if (midiLearnMode) {
                    setMidiLearnActiveControl(isLearning ? null : controlId);
                  } else if (smartEditMode) {
                    setEditingPad(pad);
                    setEditingPadName(pad.name);
                    setEditingPadColor(SCENE_COLORS.find(c => c.bg === pad.color) || SCENE_COLORS[0]);
                    setEditingPadIcon(pad.iconName);
                    setEditingPadMidiNote(pad.midiNote);
                    setEditingPadMidiChannel(pad.midiChannel);
                    setShowPadConfigModal(true);
                  } else {
                    handlePadClick(pad);
                  }
                }}
                className={`rounded-2xl relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 min-h-[140px] group/pad ${
                  isLearning
                    ? "border-blue-500 bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.6)] animate-pulse"
                    : isActive
                      ? `border-current ${pad.textColor} shadow-[0_0_30px_rgba(6,182,212,0.25)]`
                      : "border-transparent hover:border-white/10"
                } ${smartEditMode ? "ring-1 ring-cyan-500/20" : ""}`}
              >
                <div
                  className={`absolute inset-0 ${pad.color} ${isActive ? "opacity-30" : "opacity-10"} transition-opacity`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Save Current DMX Button */}
                {!smartEditMode && !midiLearnMode && (
                  <button
                    onClick={handleSaveCurrentDmx}
                    className="absolute top-3 right-3 z-20 px-2 py-1 rounded bg-black/60 hover:bg-black/90 text-slate-400 hover:text-cyan-400 text-[9px] font-bold uppercase tracking-wider border border-white/10 opacity-0 group-hover/pad:opacity-100 transition-all duration-150"
                    title="Enregistrer les valeurs DMX actuelles sur ce pad"
                  >
                    Sauver DMX
                  </button>
                )}

                {/* MIDI Mapped Indicator */}
                {hasMapping && midiLearnMode && (
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-blue-400 z-30 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                )}

                {/* Edit indicators when Edit Mode is active */}
                {smartEditMode && !midiLearnMode && (
                  <div className="absolute top-3 right-3 z-20 flex gap-1">
                    <button
                      onClick={handleEditClick}
                      className="p-1.5 rounded-lg bg-slate-800/90 text-slate-300 hover:text-cyan-400 border border-white/10 transition-colors shadow-md"
                      title="Modifier le pad"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {isActive && !showModal && !smartEditMode && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-current animate-ping" />
                )}
                
                <div className="relative h-full flex flex-col justify-end p-4">
                  <div className={`mb-3 p-2.5 rounded-xl bg-white/10 w-fit ${pad.textColor}`}>
                    {ICONS[pad.iconName] || <Zap className="w-6 h-6" />}
                  </div>
                  <h3 className="text-white font-black text-base truncate max-w-full">
                    {pad.name}
                  </h3>
                  <div className="flex items-center justify-between mt-1 w-full">
                    <p className={`text-xs font-medium ${isActive ? pad.textColor : "text-gray-500"}`}>
                      {smartEditMode ? "Paramétrer" : isActive ? "● ACTIVE" : "Click to Trigger"}
                    </p>
                    
                    {/* MIDI note display badge */}
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                      {pad.midiNote >= 0 ? `🎹 ${pad.midiNote}` : "🎹 NC"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Scene Card */}
          <div
            onClick={() => setShowModal(true)}
            className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all min-h-[140px] group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-cyan-500/20 flex items-center justify-center mb-2 transition-all">
              <Plus className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
            </div>
            <span className="text-xs font-bold text-slate-600 group-hover:text-cyan-400 transition-colors">
              New Scene
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderZoneControls = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(smartZoneMappings).map(([zoneKey, mapping], i) => (
          <div key={zoneKey} className="bg-black/20 p-4 border border-white/5 rounded-xl flex flex-col gap-2 shadow-inner">
            <div className="flex justify-between text-xs text-gray-400 font-medium">
              <span className="font-bold text-slate-300">{mapping.name || zoneKey}</span>
              <span className={i === 0 ? "text-cyan-400 font-bold" : "text-white"}>
                {zoneValues[zoneKey] ?? 0}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={zoneValues[zoneKey] ?? 0}
                className={`flex-1 h-1.5 rounded-full appearance-none bg-slate-800 cursor-pointer ${i === 0 ? "accent-cyan-400" : "accent-slate-400"}`}
                onChange={(e) => handleZoneChange(zoneKey, Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMiniPlaylist = () => {
    if (playlist.length === 0) {
      return (
        <div className="text-center py-6 text-slate-500 text-xs">
          La playlist est vide. Ajoutez des médias en mode Live.
        </div>
      );
    }
    
    return (
      <div className="flex flex-col gap-3">
        {/* Mini Controls */}
        <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => {
                if (currentTrackIndex > 0) setCurrentTrackIndex(currentTrackIndex - 1);
              }}
              className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => {
                if (isPlaying) {
                  showAudioEngine.pause();
                  setIsPlaying(false);
                } else {
                  showAudioEngine.play();
                  setIsPlaying(true);
                }
              }}
              className="p-2 rounded bg-cyan-500 hover:bg-cyan-400 text-black transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
            </button>
            <button 
              onClick={() => {
                if (currentTrackIndex < playlist.length - 1) setCurrentTrackIndex(currentTrackIndex + 1);
              }}
              className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="flex items-center gap-2 flex-1 max-w-[200px] ml-4">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="w-full h-1 appearance-none bg-black rounded-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Tracks List */}
        <div className="max-h-[180px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
          {playlist.map((track, idx) => {
            const isActive = idx === currentTrackIndex;
            return (
              <div
                key={track.id}
                onClick={() => setCurrentTrackIndex(idx)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer text-left flex items-center justify-between ${
                  isActive
                    ? 'bg-[#171b26] border-cyan-500/40 text-white'
                    : 'bg-[#0a0c10] border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-[9px] text-slate-600">#{idx + 1}</span>
                  <span className="text-xs font-bold truncate">{track.name}</span>
                </div>
                {isActive && isPlaying && (
                  <span className="text-[10px] text-green-400 font-bold animate-pulse font-mono">LECTURE</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderVjDeck = () => {
    const currentTrack = playlist[currentTrackIndex];
    const videoTracks = playlist.filter((track) => track.fileType === "video" && !track.isPause);
    const hasVideoTrack = Boolean(currentTrack && currentTrack.fileType === "video" && !currentTrack.isPause);

    return (
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-xl border border-white/5 bg-black/25 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Film className="w-4 h-4 text-pink-400" />
                VJ Deck
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                Clips video, sortie projection et preparation mapping sans casser la conduite lumiere.
              </p>
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${
              hasVideoTrack
                ? "text-pink-300 border-pink-500/30 bg-pink-500/10"
                : "text-slate-500 border-white/10 bg-black/30"
            }`}>
              {videoTracks.length} VIDEO
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px]">
            <div className="relative aspect-video min-h-[180px] overflow-hidden rounded-xl border border-white/10 bg-black">
              <ProceduralVjCanvas
                mode={vjShaderMode}
                bpm={bpm}
                intensity={vjShaderIntensity}
                playing={isPlaying}
                colorShift={0}
                speed={1}
                scale={1}
                audioReactive={true}
                audioBandsRef={vjAudioBandsRef}
              />
              <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white/80">
                GPU {vjShaderMode}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                ["gradient", "Noise"],
                ["waves", "Waves"],
                ["strobe", "Strobe"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setVjShaderMode(mode as VjShaderMode)}
                  className={`min-h-[42px] rounded-xl border px-3 text-left text-xs font-black transition-all ${
                    vjShaderMode === mode
                      ? "border-pink-500/45 bg-pink-500/15 text-white"
                      : "border-white/10 bg-black/35 text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}

              <label className="rounded-xl border border-white/10 bg-black/30 p-3">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Intensite shader
                </span>
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.01}
                  value={vjShaderIntensity}
                  onChange={(event) => setVjShaderIntensity(Number(event.target.value))}
                  className="w-full accent-pink-400"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-[#0a0c10] border border-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Clip courant</p>
                <p className="text-sm text-white font-black truncate mt-1">
                  {currentTrack ? currentTrack.name : "Aucun media"}
                </p>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">
                  {hasVideoTrack ? "Pret pour projection et sync Resolume." : "Selectionnez un clip video dans la playlist."}
                </p>
              </div>
              <button
                onClick={() => setProjectionActive((value) => !value)}
                disabled={!hasVideoTrack}
                className={`shrink-0 min-h-[44px] px-4 rounded-xl text-xs font-black border transition-all flex items-center gap-2 disabled:opacity-40 ${
                  projectionActive
                    ? "bg-pink-500/20 border-pink-500/40 text-pink-100"
                    : "bg-black/40 border-white/10 text-white hover:bg-white/5"
                }`}
                title="Ouvrir la sortie video dans une fenetre de projection"
              >
                <MonitorUp className="w-4 h-4" />
                {projectionActive ? "Projection ON" : "Projection"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {videoTracks.slice(0, 8).map((track) => {
              const index = playlist.findIndex((item) => item.id === track.id);
              const active = index === currentTrackIndex;
              return (
                <button
                  key={track.id}
                  onClick={() => setCurrentTrackIndex(index)}
                  className={`min-h-[54px] rounded-xl border px-3 py-2 text-left transition-all ${
                    active
                      ? "bg-pink-500/10 border-pink-500/40 text-white"
                      : "bg-black/30 border-white/5 text-slate-400 hover:text-white hover:border-white/15"
                  }`}
                >
                  <span className="block text-[10px] font-mono text-slate-500">#{index + 1}</span>
                  <span className="block text-xs font-black truncate">{track.name}</span>
                </button>
              );
            })}
            {videoTracks.length === 0 && (
              <div className="col-span-2 md:col-span-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
                <p className="text-xs text-slate-500 font-semibold">Ajoutez un MP4/MOV dans la playlist pour activer le deck VJ.</p>
              </div>
            )}
          </div>

          <MediaGeneratorPanel />
        </div>

        <div className="rounded-xl border border-white/5 bg-black/25 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                Resolume OSC
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                Sync future Arena: clips, colonnes, opacite layer, BPM.
              </p>
            </div>
            <button
              onClick={() => saveResolumeConfig(!resolumeStatus?.enabled)}
              disabled={isResolumeBusy}
              className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all disabled:opacity-50 ${
                resolumeStatus?.enabled
                  ? "bg-green-500/10 border-green-500/30 text-green-300"
                  : "bg-black/40 border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              {resolumeStatus?.enabled ? "OSC ON" : "OSC OFF"}
            </button>
          </div>

          <div className="grid grid-cols-[1fr_86px] gap-2">
            <input
              value={resolumeHost}
              onChange={(event) => setResolumeHost(event.target.value)}
              className="bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/40"
              placeholder="127.0.0.1"
            />
            <input
              type="number"
              value={resolumePort}
              onChange={(event) => setResolumePort(Number(event.target.value))}
              className="bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Layer</span>
              <input
                type="number"
                min={1}
                value={resolumeLayer}
                onChange={(event) => setResolumeLayer(Number(event.target.value))}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Clip</span>
              <input
                type="number"
                min={1}
                value={resolumeClip}
                onChange={(event) => setResolumeClip(Number(event.target.value))}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Opacity</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(resolumeOpacity * 100)}
                onChange={(event) => setResolumeOpacity(Math.max(0, Math.min(1, Number(event.target.value) / 100)))}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendResolumeAction("clip", { layer: resolumeLayer, clip: resolumeClip })}
              disabled={isResolumeBusy}
              className="min-h-[42px] rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-100 text-xs font-black hover:bg-cyan-500/20 disabled:opacity-50"
            >
              Lancer clip
            </button>
            <button
              onClick={() => sendResolumeAction("layer_opacity", { layer: resolumeLayer, value: resolumeOpacity })}
              disabled={isResolumeBusy}
              className="min-h-[42px] rounded-xl bg-black/40 border border-white/10 text-white text-xs font-black hover:bg-white/5 disabled:opacity-50"
            >
              Opacity layer
            </button>
            <button
              onClick={() => sendResolumeAction("bpm", { bpm })}
              disabled={isResolumeBusy}
              className="min-h-[42px] rounded-xl bg-black/40 border border-white/10 text-white text-xs font-black hover:bg-white/5 disabled:opacity-50"
            >
              Sync BPM
            </button>
            <button
              onClick={() => sendResolumeAction(isPlaying ? "play" : "pause")}
              disabled={isResolumeBusy}
              className="min-h-[42px] rounded-xl bg-black/40 border border-white/10 text-white text-xs font-black hover:bg-white/5 disabled:opacity-50"
            >
              {isPlaying ? "Play Arena" : "Pause Arena"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const spectroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  useEffect(() => {
    const canvas = spectroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const freqHandler = (freqs: number[]) => {
      vjAudioBandsRef.current = [
        Math.max(0, Math.min(255, freqs[0] ?? 0)),
        Math.max(0, Math.min(255, freqs[1] ?? 0)),
        Math.max(0, Math.min(255, freqs[2] ?? 0)),
      ];
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const colors = ["#06b6d4", "#eab308", "#ec4899"];
      freqs.forEach((bar, idx) => {
        const x = idx * 60 + 20;
        const height = (bar / 255) * 55;
        const grad = ctx.createLinearGradient(0, 80, 0, 80 - height);
        grad.addColorStop(0, colors[idx] + "33");
        grad.addColorStop(1, colors[idx]);
        ctx.fillStyle = grad;
        ctx.fillRect(x, 80 - height, 40, height);
      });
    };

    showAudioEngine.setOnFrequencyData(freqHandler);
    return () => {
      showAudioEngine.setOnFrequencyData(() => {});
    };
  }, [smartWidgets]);

  const renderSpectro = () => {
    return (
      <div className="flex items-center gap-5">
        <canvas ref={spectroCanvasRef} width="200" height="95" className="bg-black/40 border border-white/5 rounded-xl shrink-0 shadow-inner" />
        <div>
          <p className="text-white text-xs font-bold uppercase tracking-wider">Visualiseur de Spectre</p>
          <p className="text-[10px] text-slate-500 mt-1 font-semibold leading-relaxed">
            Affiche en temps réel l'intensité des 3 bandes de fréquences audio (Graves, Médiums, Aigus) qui synchronisent automatiquement les canaux DMX en mode Sound-to-Light.
          </p>
        </div>
      </div>
    );
  };

  const renderApcVirtual = () => {
    const rows = [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = [0, 1, 2, 3, 4, 5, 6, 7];

    return (
      <div className="virtual-apc-mini flex flex-col items-center gap-4">
        <div className="bg-[#0e1017] p-4 rounded-2xl border border-white/5 shadow-inner">
          <div className="grid grid-cols-8 gap-2">
            {rows.map((row) =>
              cols.map((col) => {
                const note = row * 8 + col;
                const mappedPad = pads.find(p => p.midiNote === note);
                
                const handleVirtualApcClick = () => {
                  if (mappedPad) {
                    triggerSmartPad(mappedPad);
                  } else if (editingPad) {
                    updateSmartPad(editingPad.id, { midiNote: note });
                    setEditingPadMidiNote(note);
                    addToast({
                      type: "success",
                      message: "Mappage MIDI affecté",
                      detail: `Pad "${editingPad.name}" lié au bouton APC Note ${note}`,
                    });
                  }
                };

                return (
                  <button
                    key={note}
                    onClick={handleVirtualApcClick}
                    style={{
                      backgroundColor: mappedPad 
                        ? (activeScene === mappedPad.qlcWidget ? '#06b6d4' : '#1e293b') 
                        : '#0a0c10',
                      borderColor: mappedPad 
                        ? (activeScene === mappedPad.qlcWidget ? '#22d3ee' : '#334155') 
                        : '#1e293b',
                    }}
                    className={`w-8 h-8 rounded-lg border transition-all text-[9px] font-mono text-slate-500 font-bold hover:scale-105 active:scale-95 flex items-center justify-center ${
                      mappedPad ? 'shadow-[0_0_8px_rgba(6,182,212,0.2)] text-cyan-400' : ''
                    }`}
                    title={mappedPad ? `${mappedPad.name} (Note: ${note})` : `Note: ${note}`}
                  >
                    {mappedPad ? mappedPad.name.slice(0, 2).toUpperCase() : note}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-500 text-center max-w-md font-semibold leading-relaxed">
          Cliquez sur un bouton pour déclencher sa scène associée. En mode édition, cliquez sur un bouton de la grille pour y affecter directement la note MIDI du pad en cours d'édition.
        </p>
      </div>
    );
  };

  const midiMappingCount = Object.keys(midiMappings || {}).length;
  const dmxOutputReady = Boolean(
    diagnosisResult?.status.pythonDmx.active ||
    diagnosisResult?.status.usbDmx.connected ||
    diagnosisResult?.status.qlcWs.connected
  );
  const dangerousArmed = safetySummary
    ? Object.values(safetySummary.armed || {}).some(Boolean)
    : false;
  const e2eRequiredOk = [
    socketConnected,
    fixtures.length > 0,
    fixtureGroups.length > 0,
    pads.length > 0,
    dmxOutputReady,
    offlineReadiness.ready,
    libraryCount !== 0,
    safetySummary ? !safetySummary.dangerousPhysicalOutputsEnabled && !dangerousArmed : true,
  ].every(Boolean);
  const e2eSteps = useMemo(() => [
    {
      label: "Backend live",
      ok: socketConnected,
      detail: socketConnected ? "Socket connecte, les commandes temps reel peuvent partir." : "Demarrer apps/server puis recharger l'interface.",
    },
    {
      label: "Fixtures patchees",
      ok: fixtures.length > 0,
      detail: fixtures.length > 0 ? `${fixtures.length} fixture(s) dans le patch.` : "Ajouter au moins une fixture via Patch.",
    },
    {
      label: "Groupes de lieu",
      ok: fixtureGroups.length > 0,
      detail: fixtureGroups.length > 0 ? `${fixtureGroups.length} groupe(s) live disponibles.` : "Creer les groupes Master/Piste/Bar/Dancefloor dans l'assistant.",
    },
    {
      label: "Scenes/pads",
      ok: pads.length > 0,
      detail: pads.length > 0 ? `${pads.length} pad(s) pret(s) pour le test.` : "Generer les pads de depart depuis l'assistant debutant.",
    },
    {
      label: "Sortie DMX validee",
      ok: dmxOutputReady,
      detail: diagnosisResult
        ? (dmxOutputReady ? "Au moins une sortie DMX est active." : "Diagnostic lance, aucune sortie active detectee.")
        : "Lancer le diagnostic DMX avant le test physique.",
    },
    {
      label: "Offline/PWA",
      ok: offlineReadiness.ready,
      detail: offlineReadiness.ready ? "App, bibliotheque et show disponibles localement." : "Ouvrir le badge Offline dans la barre haute et corriger les points manquants.",
    },
    {
      label: "Bibliotheque locale",
      ok: libraryCount !== null && libraryCount > 0,
      detail: libraryCount === null ? "Verification en cours." : `${libraryCount} item(s) fixture/look/show/venue disponibles.`,
    },
    {
      label: "Safety Gate",
      ok: safetySummary ? !safetySummary.dangerousPhysicalOutputsEnabled && !dangerousArmed : false,
      detail: safetySummary
        ? `Role ${safetySummary.operatorRole}, sorties sensibles physiques bloquees${dangerousArmed ? ", armement actif a verifier" : "."}`
        : "Ouvrir Settings > Safety et verifier les roles.",
    },
    {
      label: "Crash recovery",
      ok: true,
      optional: true,
      detail: "Autosnapshot live actif: une session recente peut etre restauree apres fermeture brutale.",
    },
    {
      label: "Pack show",
      ok: Boolean(currentProjectName || pads.length > 0),
      optional: true,
      detail: "Exporter un .glowpack depuis Projets avant de partir sur site.",
    },
    {
      label: "Controle tactile/MIDI",
      ok: midiMappingCount > 0,
      optional: true,
      detail: midiMappingCount > 0 ? `${midiMappingCount} mapping(s) MIDI detecte(s).` : "Optionnel: mapper APC/Launchpad/clavier MIDI apres le test tactile.",
    },
    {
      label: "Playlist show",
      ok: playlist.length > 0,
      optional: true,
      detail: playlist.length > 0 ? `${playlist.length} piste(s) dans la playlist.` : "Optionnel: ajouter audio/video pour tester sync show.",
    },
    {
      label: "Show Lock",
      ok: showLock,
      optional: true,
      detail: showLock ? "Actions dangereuses verrouillees." : "Activer avant un vrai show pour eviter les suppressions.",
    },
  ], [
    currentProjectName,
    dangerousArmed,
    diagnosisResult,
    dmxOutputReady,
    fixtureGroups.length,
    fixtures.length,
    libraryCount,
    midiMappingCount,
    offlineReadiness.ready,
    pads.length,
    playlist.length,
    safetySummary,
    showLock,
    socketConnected,
  ]);

  const latestShowSnapshot = showSnapshots?.[0] || null;
  const recoveryRequiredOk = [
    socketConnected,
    offlineReadiness.backendOnline !== false,
    Boolean(crashSnapshotMeta?.fresh || latestShowSnapshot),
    pads.length > 0,
  ].every(Boolean);
  const recoverySteps = [
    {
      label: "Backend local",
      ok: socketConnected,
      detail: socketConnected ? "Socket live connecte." : "Relancer Glow Logic Server puis recharger l'app.",
    },
    {
      label: "Autosnapshot crash",
      ok: Boolean(crashSnapshotMeta?.fresh),
      detail: crashSnapshotMeta
        ? `${crashSnapshotMeta.clean ? "Fermeture propre" : "Session recuperable"} - age ${formatRecoveryAge(crashSnapshotMeta.updatedAt)}.`
        : "Aucun autosnapshot detecte sur ce navigateur.",
    },
    {
      label: "Snapshot manuel",
      ok: Boolean(latestShowSnapshot),
      detail: latestShowSnapshot
        ? `${latestShowSnapshot.label} - ${formatRecoveryAge(latestShowSnapshot.createdAt)}.`
        : "Creer un snapshot avant le show ou apres chaque gros changement.",
    },
    {
      label: "Projet / pack",
      ok: Boolean(currentProjectName),
      detail: currentProjectName ? currentProjectName : "Sauvegarder le projet ou exporter un .glowpack.",
    },
    {
      label: "Offline",
      ok: offlineReadiness.ready,
      detail: offlineReadiness.ready ? "App et donnees critiques pretes hors ligne." : "Verifier le badge Offline dans la barre haute.",
    },
    {
      label: "Show Lock",
      ok: showLock,
      detail: showLock ? "Actions dangereuses limitees pendant le show." : "Activer pour eviter les suppressions en live.",
    },
  ];

  const openRecoveryGuide = useCallback(() => {
    refreshShowSnapshots();
    setCrashSnapshotMeta(readCrashSnapshotMeta());
    refreshPreflightData();
    setShowRecoveryGuide(true);
  }, [refreshPreflightData, refreshShowSnapshots]);

  const handleRecoverySnapshot = useCallback(() => {
    createShowSnapshot(`Recovery point - ${currentProjectName || "Glow Logic"}`);
    refreshShowSnapshots();
    setCrashSnapshotMeta(readCrashSnapshotMeta());
  }, [createShowSnapshot, currentProjectName, refreshShowSnapshots]);

  const handleRecoverySave = useCallback(async () => {
    const name = currentProjectName || `Projet ${new Date().toLocaleString("fr-FR")}`;
    try {
      await saveProject(name);
      addToast({
        type: "success",
        message: "Projet sauvegarde",
        detail: name,
      });
    } catch (error: any) {
      addToast({
        type: "error",
        message: "Sauvegarde impossible",
        detail: error.message || "Verifier le backend local.",
      });
    }
  }, [addToast, currentProjectName, saveProject]);

  const handleRestoreLatestSnapshot = useCallback(() => {
    if (!latestShowSnapshot) return;
    if (!confirm(`Restaurer le snapshot "${latestShowSnapshot.label}" ? L'etat actuel sera remplace.`)) return;
    restoreShowSnapshot(latestShowSnapshot.id);
    refreshShowSnapshots();
  }, [latestShowSnapshot, refreshShowSnapshots, restoreShowSnapshot]);

  const handlePreflightSnapshot = useCallback(() => {
    createShowSnapshot(`Preflight show - ${currentProjectName || "Glow Logic"}`);
    addToast({
      type: "success",
      message: "Snapshot preflight cree",
      detail: "Pense aussi a exporter le .glowpack.",
    });
  }, [addToast, createShowSnapshot, currentProjectName]);

  const exportPreflightReport = useCallback(() => {
    const report = {
      kind: "glow-logic-preflight-report",
      version: 1,
      generatedAt: new Date().toISOString(),
      projectName: currentProjectName || "Untitled Project",
      verdict: e2eRequiredOk ? "ready_for_real_test" : "needs_attention",
      show: {
        fixtures: fixtures.length,
        fixtureGroups: fixtureGroups.length,
        pads: pads.length,
        playlist: playlist.length,
        midiMappings: midiMappingCount,
        showLock,
      },
      offline: offlineReadiness,
      safety: safetySummary,
      dmx: diagnosisResult ? {
        pythonDmx: diagnosisResult.status.pythonDmx,
        usbDmx: diagnosisResult.status.usbDmx,
        qlcWs: diagnosisResult.status.qlcWs,
        serialPorts: diagnosisResult.status.serialPorts,
        hasAnomalies: diagnosisResult.hasAnomalies,
      } : null,
      library: {
        itemCount: libraryCount,
      },
      checks: e2eSteps.map((step) => ({
        label: step.label,
        ok: step.ok,
        optional: Boolean(step.optional),
        detail: step.detail,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `glow-logic-preflight-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    addToast({
      type: "success",
      message: "Rapport preflight exporte",
      detail: report.verdict,
    });
  }, [
    addToast,
    currentProjectName,
    diagnosisResult,
    e2eRequiredOk,
    e2eSteps,
    fixtureGroups.length,
    fixtures.length,
    libraryCount,
    midiMappingCount,
    offlineReadiness,
    pads.length,
    playlist.length,
    safetySummary,
    showLock,
  ]);

  return (
    <div className="w-full h-full bg-[#0a0c10] overflow-y-auto p-6 flex gap-6 relative">
      {projectionActive && <VideoProjectionWindow onClose={() => setProjectionActive(false)} />}

      {/* ====== MODAL CONFIGURATION INDIVIDUELLE PAD ====== */}
      {showPadConfigModal && editingPad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div
            className="bg-[#12141A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                Configuration du Pad
              </h2>
              <button
                onClick={() => {
                  setShowPadConfigModal(false);
                  setEditingPad(null);
                }}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Name */}
            <div className="mb-4">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                Nom de la scène
              </label>
              <input
                type="text"
                value={editingPadName}
                onChange={(e) => setEditingPadName(e.target.value)}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all text-sm font-bold"
              />
            </div>

            {/* Form Colors */}
            <div className="mb-4">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                Thème de couleur
              </label>
              <div className="grid grid-cols-8 gap-2">
                {SCENE_COLORS.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setEditingPadColor(c)}
                    className={`w-8 h-8 rounded-lg ${c.bg} transition-all ${
                      editingPadColor.label === c.label
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#12141A] scale-110"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {editingPadColor.label === c.label && (
                      <Check className="w-4 h-4 text-black mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Icons */}
            <div className="mb-4">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                Icône
              </label>
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(ICONS).map((iconKey) => (
                  <button
                    key={iconKey}
                    onClick={() => setEditingPadIcon(iconKey)}
                    className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                      editingPadIcon === iconKey
                        ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                        : "bg-[#0a0c10] border-white/5 text-slate-500 hover:text-white"
                    }`}
                  >
                    {ICONS[iconKey]}
                  </button>
                ))}
              </div>
            </div>

            {/* MIDI Mappings */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Note MIDI (0-127)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (isListeningMidi) {
                        setIsListeningMidi(false);
                      } else {
                        startMidiLearnForPad();
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all flex items-center gap-1 ${
                      isListeningMidi
                        ? "bg-blue-500/20 border-blue-500 text-blue-400 animate-pulse font-black"
                        : "bg-slate-800 border-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    🎹 Learn
                  </button>
                </div>
                <input
                  type="number"
                  min={-1}
                  max={127}
                  value={editingPadMidiNote}
                  onChange={(e) => setEditingPadMidiNote(Number(e.target.value))}
                  className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none"
                  placeholder="-1 = Aucun"
                />
              </div>
              <div>
                <div className="h-6 flex items-center mb-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Canal MIDI (1-16)
                  </label>
                </div>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={editingPadMidiChannel}
                  onChange={(e) => setEditingPadMidiChannel(Number(e.target.value))}
                  className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleDeletePad}
                className="px-3.5 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                title="Supprimer la scène"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowPadConfigModal(false);
                  setEditingPad(null);
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 font-bold transition-all text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleSavePadConfig}
                disabled={!editingPadName.trim()}
                className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL DIAGNOSTICS IA ====== */}
      {showDiagnosisModal && diagnosisResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div
            className="bg-[#12141A] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 w-full max-w-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                Rapport de Diagnostic IA
              </h2>
              <button
                onClick={() => setShowDiagnosisModal(false)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hardware Status Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <h4 className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-3">Statut Connexions</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pont DMX Python (COM5) :</span>
                    <span className={`font-mono font-bold ${diagnosisResult.status.pythonDmx.active ? 'text-green-400' : 'text-red-400'}`}>
                      {diagnosisResult.status.pythonDmx.active ? 'ACTIF' : 'INACTIF'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sortie Native USB-DMX :</span>
                    <span className={`font-mono font-bold ${diagnosisResult.status.usbDmx.connected ? 'text-green-400' : 'text-red-400'}`}>
                      {diagnosisResult.status.usbDmx.connected ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">WebSocket QLC+ (9999) :</span>
                    <span className={`font-mono font-bold ${diagnosisResult.status.qlcWs.connected ? 'text-green-400' : 'text-red-400'}`}>
                      {diagnosisResult.status.qlcWs.connected ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <h4 className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-3">Ports COM Détectés</h4>
                <div className="space-y-1.5 max-h-[80px] overflow-y-auto custom-scrollbar text-xs">
                  {diagnosisResult.status.serialPorts.length === 0 ? (
                    <span className="text-red-400 font-bold">Aucun port COM trouvé</span>
                  ) : (
                    diagnosisResult.status.serialPorts.map(p => (
                      <div key={p.path} className="flex justify-between font-mono text-[11px] text-slate-300">
                        <span>{p.path}</span>
                        <span className="text-slate-500 truncate max-w-[150px]">{p.friendlyName || p.manufacturer}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* AI Diagnosis Output */}
            <div className="mb-6">
              <h4 className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                Analyse & Solutions Recommandées
              </h4>
              <div className="bg-[#0a0c10] border border-purple-500/10 rounded-xl p-4 text-sm text-slate-300 leading-relaxed font-medium overflow-y-auto max-h-[220px] custom-scrollbar whitespace-pre-line">
                {diagnosisResult.diagnosis}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">
                Journal Support
              </h4>
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-[11px] font-mono max-h-[120px] overflow-y-auto custom-scrollbar space-y-1.5">
                {(diagnosisResult.status.supportLogs || []).length === 0 ? (
                  <div className="text-slate-500">Aucun log support récent.</div>
                ) : (
                  (diagnosisResult.status.supportLogs || []).slice(0, 8).map((log, idx) => (
                    <div key={`${log.timestamp}-${idx}`} className="grid grid-cols-[72px_70px_1fr] gap-2 text-slate-300">
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString("fr-FR")}</span>
                      <span className={log.severity === "error" ? "text-red-400" : log.severity === "warning" ? "text-amber-400" : "text-cyan-400"}>
                        {log.source}
                      </span>
                      <span className="truncate">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
              {diagnosisResult.status.supportLogPath && (
                <p className="text-[10px] text-slate-500 mt-2 font-mono truncate">
                  {diagnosisResult.status.supportLogPath}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3">
              <button
                onClick={downloadSupportReport}
                className="flex-1 py-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all text-center"
              >
                Export support
              </button>
              <button
                onClick={() => setShowDiagnosisModal(false)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-black text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] text-center"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL GUIDE TEST END-TO-END ====== */}
      {showE2eGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div
            className="bg-[#12141A] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar p-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Preflight show end-to-end
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-semibold">
                  Validez le chemin complet avant evenement: DMX, offline, safety, bibliotheque, backup et controle.
                </p>
              </div>
              <button
                onClick={() => setShowE2eGuide(false)}
                title="Fermer"
                aria-label="Fermer"
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {e2eSteps.map((step) => (
                <div
                  key={step.label}
                  className={`rounded-xl border p-4 bg-black/30 ${
                    step.ok
                      ? "border-green-500/20"
                      : step.optional
                        ? "border-amber-500/20"
                        : "border-red-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-white text-xs font-black uppercase tracking-wider">{step.label}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        step.ok ? "text-green-400" : step.optional ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {step.ok ? "OK" : step.optional ? "Optionnel" : "A faire"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">{step.detail}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-xs text-slate-300 font-black uppercase tracking-widest">Verdict preflight</h3>
                <span className={`text-[10px] font-black uppercase tracking-widest ${e2eRequiredOk ? "text-green-400" : "text-amber-400"}`}>
                  {e2eRequiredOk ? "Pret pour test reel" : "Points a verifier"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400 font-semibold leading-relaxed">
                <div>
                  <span className="block text-cyan-400 font-black mb-1">1. Preparation</span>
                  Ouvrir Patch, choisir un profil de lieu, creer les fixtures et verifier les groupes.
                </div>
                <div>
                  <span className="block text-cyan-400 font-black mb-1">2. Commande live</span>
                  Lancer un pad, bouger Master/Piste/Bar/Dancefloor, puis tester tactile et MIDI.
                </div>
                <div>
                  <span className="block text-cyan-400 font-black mb-1">3. Securite</span>
                  Lancer le diagnostic, creer un snapshot, exporter un pack show et activer Show Lock.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={runDiagnostics}
                disabled={isDiagnosing}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 text-cyan-400 ${isDiagnosing ? "animate-spin" : ""}`} />
                {isDiagnosing ? "Diagnostic..." : "Lancer diagnostic DMX"}
              </button>
              <button
                onClick={handlePreflightSnapshot}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                Snapshot preflight
              </button>
              <button
                onClick={exportPreflightReport}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                Export rapport
              </button>
              <button
                onClick={() => setShowE2eGuide(false)}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black font-black text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] text-center"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL SHOW HEALTH / RECOVERY ====== */}
      {showRecoveryGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div
            className="bg-[#12141A] border border-amber-500/20 rounded-2xl shadow-2xl shadow-amber-500/5 w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar p-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Sante show & recovery
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-semibold">
                  Reprendre vite apres crash, coupure backend ou mauvaise manipulation.
                </p>
              </div>
              <button
                onClick={() => setShowRecoveryGuide(false)}
                title="Fermer"
                aria-label="Fermer"
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Verdict</p>
                <p className={`text-sm font-black ${recoveryRequiredOk ? "text-green-400" : "text-amber-400"}`}>
                  {recoveryRequiredOk ? "Reprise prete" : "A securiser"}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Dernier autosnapshot</p>
                <p className="text-sm text-white font-black">
                  {crashSnapshotMeta ? formatRecoveryAge(crashSnapshotMeta.updatedAt) : "Aucun"}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Snapshot manuel</p>
                <p className="text-sm text-white font-black truncate">
                  {latestShowSnapshot ? latestShowSnapshot.label : "Aucun"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {recoverySteps.map((step) => (
                <div
                  key={step.label}
                  className={`rounded-xl border p-4 bg-black/30 ${step.ok ? "border-green-500/20" : "border-amber-500/20"}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-white text-xs font-black uppercase tracking-wider">{step.label}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${step.ok ? "text-green-400" : "text-amber-400"}`}>
                      {step.ok ? "OK" : "A verifier"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">{step.detail}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-4 mb-5">
              <h3 className="text-xs text-slate-300 font-black uppercase tracking-widest mb-3">Procedure en cas de souci</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400 font-semibold leading-relaxed">
                <div>
                  <span className="block text-amber-400 font-black mb-1">1. Garder la sortie stable</span>
                  Ne pas supprimer le patch. Baisser Master ou Blackout seulement si necessaire.
                </div>
                <div>
                  <span className="block text-amber-400 font-black mb-1">2. Restaurer</span>
                  Recharger le dernier snapshot manuel si l'interface est incoherente.
                </div>
                <div>
                  <span className="block text-amber-400 font-black mb-1">3. Tracer</span>
                  Lancer diagnostic puis exporter support si le probleme revient.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={handleRecoverySnapshot}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                Snapshot maintenant
              </button>
              <button
                onClick={handleRecoverySave}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all flex items-center justify-center gap-2"
              >
                Sauvegarder projet
              </button>
              <button
                onClick={handleRestoreLatestSnapshot}
                disabled={!latestShowSnapshot}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-white font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Restaurer dernier
              </button>
              <button
                onClick={runDiagnostics}
                disabled={isDiagnosing}
                className="min-h-[48px] py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-black font-black text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] text-center disabled:opacity-50"
              >
                {isDiagnosing ? "Diagnostic..." : "Diagnostic"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL NEW SCENE ====== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="bg-[#12141A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Nouvelle Scène
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nom */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">
                Nom de la scène
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateScene()}
                placeholder="Ex: Golden Hour, Acid Drop…"
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm font-bold"
              />
            </div>

            {/* Couleur */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">
                Couleur
              </label>
              <div className="grid grid-cols-8 gap-2">
                {SCENE_COLORS.map((c) => (
                  <button
                    key={c.label}
                    title={c.label}
                    onClick={() => setNewColor(c)}
                    className={`w-8 h-8 rounded-lg ${c.bg} transition-all ${
                      newColor.label === c.label
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#12141A] scale-110"
                        : "opacity-60 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {newColor.label === c.label && (
                      <Check className="w-4 h-4 text-black mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Widget QLC+ */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">
                QLC+ Widget ID
                <span className="ml-2 text-slate-600 normal-case font-normal">
                  (Virtual Console)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={512}
                value={newWidget}
                onChange={(e) => setNewWidget(Number(e.target.value))}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm font-mono"
              />
            </div>

            {/* Preview */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">
                Aperçu
              </label>
              <div
                className={`rounded-2xl relative overflow-hidden border-2 min-h-[100px] ${newColor.text} border-current`}
              >
                <div className={`absolute inset-0 ${newColor.bg} opacity-30`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="relative h-full flex flex-col justify-end p-4">
                  <div
                    className={`mb-2 p-2 rounded-xl bg-white/10 w-fit ${newColor.text}`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-white font-black text-sm">
                    {newName || "Ma Scène"}
                  </h3>
                  <p className={`text-xs mt-0.5 ${newColor.text}`}>
                    Click to Trigger
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 font-bold transition-all text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateScene}
                disabled={!newName.trim()}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  newName.trim()
                    ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                <Plus className="w-4 h-4" />
                Créer la scène
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL CONFIGURATION DES ZONES ====== */}
      {showZoneConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="bg-[#12141A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                Configuration des Zones
              </h2>
              <button
                onClick={() => setShowZoneConfig(false)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Zone Selector Tabs inside Modal */}
            <div className="flex gap-1 bg-black/40 p-1 rounded-xl mb-6 border border-white/5">
              {Object.keys(smartZoneMappings).map((zoneKey) => {
                const isSelected = editingZoneKey === zoneKey;
                return (
                  <button
                    key={zoneKey}
                    onClick={() => setEditingZoneKey(zoneKey)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15"
                        : "text-slate-400 hover:text-white border border-transparent"
                    }`}
                  >
                    {smartZoneMappings[zoneKey]?.name || zoneKey}
                  </button>
                );
              })}
            </div>

            {/* Zone Name Input */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">
                Nom de la zone
              </label>
              <input
                type="text"
                value={smartZoneMappings[editingZoneKey]?.name || ""}
                onChange={(e) => {
                  const currentMapping = smartZoneMappings[editingZoneKey] || { name: editingZoneKey, fixtures: [] };
                  setSmartZoneMapping(editingZoneKey, {
                    ...currentMapping,
                    name: e.target.value,
                  });
                }}
                placeholder={`Nom pour ${editingZoneKey}...`}
                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm font-bold"
              />
            </div>

            {/* Fixtures Selector Checklist */}
            <div className="mb-6">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">
                Assignation des projecteurs (fixtures)
              </label>
              
              {fixtures.length === 0 ? (
                <div className="text-center py-6 bg-black/20 rounded-xl border border-dashed border-white/5">
                  <p className="text-xs text-slate-500">Aucune fixture configurée.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Patchez des fixtures dans l'onglet Creator.</p>
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {fixtures.map((f) => {
                    const isAssigned = smartZoneMappings[editingZoneKey]?.fixtures.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          const currentMapping = smartZoneMappings[editingZoneKey] || { name: editingZoneKey, fixtures: [] };
                          let updatedFixtures = [...currentMapping.fixtures];
                          if (isAssigned) {
                            updatedFixtures = updatedFixtures.filter((id) => id !== f.id);
                          } else {
                            updatedFixtures.push(f.id);
                          }
                          setSmartZoneMapping(editingZoneKey, {
                            ...currentMapping,
                            fixtures: updatedFixtures,
                          });
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                          isAssigned
                            ? "bg-cyan-500/5 border-cyan-500/30 text-white"
                            : "bg-[#0a0c10] border-white/5 text-slate-400 hover:border-white/10 hover:text-white"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold">{f.name}</p>
                          <p className="text-[10px] text-slate-500">
                            Ch {f.start_address || f.startAddress || 1} | {f.total_channels || f.totalChannels} canaux
                          </p>
                        </div>
                        {isAssigned ? (
                          <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-white/15" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer / Done Button */}
            <div className="flex">
              <button
                onClick={() => setShowZoneConfig(false)}
                className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] text-center"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== COLONNE GAUCHE (SIDEBAR) ====== */}
      {isSidebarVisible && (
        <div className="w-[280px] flex flex-col gap-3 shrink-0 h-full border-r border-white/5 pr-3">
          {/* Navigation par onglets */}
          <div className="bg-[#12141A] rounded-xl border border-white/5 p-1 flex gap-1 shadow-md shrink-0">
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'controls'
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Contrôles
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ai'
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              IA
            </button>
            <button
              onClick={() => setActiveTab('automations')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'automations'
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Flame className="w-4 h-4" />
              Automations
            </button>
          </div>

          {/* Contenu de la sidebar selon l'onglet actif */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-420px)] custom-scrollbar pr-1 min-h-0">
            {activeTab === 'controls' && (
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
                <p className="text-white text-xs font-black uppercase tracking-widest mb-2">
                  Capture scenes
                </p>
                <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                  Les scenes, cues et chenillards sont maintenant regroupes dans la MacroTimeline en bas d'ecran. Ouvrez les onglets Scenes, Cues ou Chasers dans la timeline pour programmer l'arrangement du show.
                </p>
              </div>
            )}

            {activeTab === 'ai' && (
              <OrchestratorController />
            )}

            {activeTab === 'automations' && (
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
                <p className="text-white text-xs font-black uppercase tracking-widest mb-2">
                  Automations timeline
                </p>
                <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                  Les cues et chenillards ont ete deplaces dans la MacroTimeline pour que l'arrangement reste la source unique pendant le show.
                </p>
              </div>
            )}
          </div>

          {/* Fixed Bottom: Live Status Card & Diagnostics */}
          <div className="bg-[#12141A] rounded-xl border border-white/5 p-4 shadow-2xl relative overflow-hidden shrink-0 mt-auto">
            <div
              className={`absolute inset-0 bg-gradient-to-b ${socketConnected ? "from-green-500/10" : "from-red-500/10"} to-transparent opacity-50 pointer-events-none`}
            />
            <h2 className="text-white font-bold mb-3 flex items-center gap-2 text-xs relative z-10">
              {socketConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              Live Status
            </h2>
            <div className="relative z-10 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 uppercase tracking-widest font-bold">
                  Backend
                </span>
                <span
                  className={`font-mono font-bold ${socketConnected ? "text-green-400" : "text-red-400"}`}
                >
                  {socketConnected ? "CONNECTED" : "OFFLINE"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 uppercase tracking-widest font-bold">
                  BPM
                </span>
                <span className="text-cyan-400 font-mono font-bold">
                  {bpm.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 uppercase tracking-widest font-bold">
                  Scènes
                </span>
                <span className="text-white font-mono font-bold">
                  {pads.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 uppercase tracking-widest font-bold">
                  Scène active
                </span>
                <span className="text-white font-mono font-bold truncate max-w-[120px]">
                  {activeScene !== null
                    ? (pads.find((p) => p.qlcWidget === activeScene)?.name ?? "—")
                    : "—"}
                </span>
              </div>
              
              <button
                onClick={runDiagnostics}
                disabled={isDiagnosing}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-purple-500/30 text-white font-black text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-lg hover:shadow-cyan-500/10 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className={`w-3 h-3 text-cyan-400 ${isDiagnosing ? 'animate-spin' : 'animate-pulse'}`} />
                {isDiagnosing ? "Diagnostic..." : "Diagnostic IA du DMX"}
              </button>
              <button
                onClick={() => {
                  refreshPreflightData();
                  setShowE2eGuide(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-black/40 border border-white/10 hover:bg-white/5 text-white font-black text-[10px] transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Activity className="w-3 h-3 text-amber-400" />
                Preflight show
              </button>
              <button
                onClick={openRecoveryGuide}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-100 font-black text-[10px] transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Recovery show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== COLONNE CENTRALE MODULAIRE (WIDGETS) ====== */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {proView === "visualizer" ? (
          <VisualizerView />
        ) : proView === "patch" ? (
          <PatchPanel />
        ) : (
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1 pb-8 custom-scrollbar">
            {/* Smart Top Header Toolbar */}
            <div className="bg-[#12141A] rounded-2xl border border-white/5 p-4 flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-4">
                <h1 className="text-white font-black text-sm tracking-widest uppercase flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  SMART DASHBOARD
                </h1>
                <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-slate-400 font-bold">
                  <span className="flex items-center gap-1">
                    BPM: <span className="text-cyan-400 font-black">{bpm.toFixed(1)}</span>
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* MIDI Learn Toggle */}
                <button
                  onClick={() => setMidiLearnMode(!midiLearnMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    midiLearnMode
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)] animate-pulse"
                      : "bg-black/20 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  🎹 MIDI Learn
                </button>

                <div className="flex items-center gap-2 bg-black/20 border border-white/5 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-400">Show Lock</span>
                  <button
                    onClick={() => setShowLock(!showLock)}
                    className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showLock ? "bg-amber-500" : "bg-slate-800"
                    }`}
                    title="Verrouille les actions dangereuses pendant le show"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                        showLock ? "translate-x-4.5 bg-white" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Edit Mode Toggle */}
                <div className="flex items-center gap-2 bg-black/20 border border-white/5 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-slate-400">Mode Édition</span>
                  <button
                    onClick={() => setSmartEditMode(!smartEditMode)}
                    className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      smartEditMode ? "bg-cyan-500" : "bg-slate-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                        smartEditMode ? "translate-x-4.5 bg-white" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Render widgets in sorted order */}
            <div className="space-y-6 flex-1">
              {smartWidgets
                .slice() // copy to avoid modifying original array order
                .sort((a, b) => a.order - b.order)
                .map((widget) => {
                  if (!widget.visible && !smartEditMode) return null;
                  
                  const isCollapsed = widget.collapsed;
                  
                  const toggleCollapse = () => {
                    updateSmartWidget(widget.id, { collapsed: !isCollapsed });
                  };
                  
                  const moveUp = () => {
                    if (widget.order > 0) reorderSmartWidgets(widget.order, widget.order - 1);
                  };
                  
                  const moveDown = () => {
                    if (widget.order < smartWidgets.length - 1) reorderSmartWidgets(widget.order, widget.order + 1);
                  };
                  
                  const toggleVisibility = () => {
                    updateSmartWidget(widget.id, { visible: !widget.visible });
                  };

                  return (
                    <div 
                      key={widget.id}
                      className={`bg-[#12141A]/95 border rounded-2xl shadow-xl transition-all duration-200 ${
                        !widget.visible 
                          ? 'border-dashed border-red-500/20 opacity-60 bg-red-500/[0.01]' 
                          : 'border-white/5'
                      }`}
                    >
                      {/* Widget Header */}
                      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-xs uppercase tracking-wider">{widget.label}</span>
                          {!widget.visible && (
                            <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Masqué</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Edit actions (visible only in Edit Mode) */}
                          {smartEditMode && (
                            <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
                              <button onClick={moveUp} className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/5 transition-colors" title="Monter">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={moveDown} className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/5 transition-colors" title="Descendre">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={toggleVisibility} className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/5 transition-colors" title={widget.visible ? "Masquer" : "Afficher"}>
                                {widget.visible ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                              </button>
                            </div>
                          )}
                          
                          {/* Collapse/Expand Toggle */}
                          <button onClick={toggleCollapse} className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/5 transition-colors">
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      
                      {/* Widget Content */}
                      {!isCollapsed && (
                        <div className="p-5">
                          {widget.id === 'groupStrips' && renderGroupStrips()}
                          {widget.id === 'stagePlan' && renderStagePlan()}
                          {widget.id === 'pads' && renderPadsGrid()}
                          {widget.id === 'zoneControls' && renderZoneControls()}
                          {widget.id === 'vjDeck' && renderVjDeck()}
                          {widget.id === 'miniPlaylist' && renderMiniPlaylist()}
                          {widget.id === 'spectro' && renderSpectro()}
                          {widget.id === 'apcVirtual' && renderApcVirtual()}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Mini 3D Overlay (Absolute Bottom Right) */}
        {proView === "canvas" && (
          <div className="fixed bottom-6 right-6 z-30">
            <MiniOverlay nodes={nodes} />
          </div>
        )}
      </div>
    </div>
  );
}
