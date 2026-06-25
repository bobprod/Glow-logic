"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  X,
  Check,
  Settings,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Volume2,
  Sliders,
  Film,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  MonitorUp,
  Send,
  GripVertical,
  LayoutGrid,
} from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import type { SmartWidget, SmartWidgetType } from "../store/slices/smartModeSlice";
import { socket } from "../lib/socket";
import useStore, { type VjShaderMode } from "../store/useStore";
import MiniOverlay from "./three/MiniOverlay";
import VisualizerView from "./VisualizerView";
import PatchPanel from "./PatchPanel";
import MediaGeneratorPanel from "./MediaGeneratorPanel";
import SmartSidebar from "./smart/SmartSidebar";
import SmartToolsModals from "./smart/SmartToolsModals";
import GroupStrips from "./smart/GroupStrips";
import SceneController from "./smart/SceneController";
import StagePlan from "./smart/StagePlan";
import ProceduralVjCanvas from "./ui/ProceduralVjCanvas";
import VideoProjectionWindow from "./ui/VideoProjectionWindow";
import { dmxEngine } from "../lib/dmxEngine";
import { oscillatorDriver } from "../lib/oscillatorDriver";
import { pixelMapDriver } from "../lib/pixelMapDriver";
import OscillatorPanel from "./smart/OscillatorPanel";
import MacrosPanel from "./smart/MacrosPanel";
import PixelMapPanel from "./smart/PixelMapPanel";
import { API_BASE } from "../lib/config";
import { showAudioEngine } from "../lib/ShowAudioEngine";
import { useOfflineReadiness } from "../hooks/useOfflineReadiness";
import { useSmartHotkeys } from "../hooks/useSmartHotkeys";
import OutputHealthWidget from "./smart/OutputHealthWidget";
import { readOfflineProjectBackup } from "../lib/offlineProjectBackup";
import { normalizeProjectState } from "../lib/projectMigration";
import { DEFAULT_WIDGETS } from "../store/slices/smartModeSlice";
import { clearHistory } from "../store/history";

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

type LayoutPresetId = "live" | "prepa" | "vj";
type WidgetPartial = { visible: boolean; collapsed: boolean };
const LAYOUT_PRESETS: Record<LayoutPresetId, Record<string, WidgetPartial>> = {
  live: {
    scenePads:   { visible: true, collapsed: false },
    groupStrips: { visible: true, collapsed: false },
    stagePlan:   { visible: true, collapsed: false },
    zoneControls:{ visible: true, collapsed: true },
    vjDeck:      { visible: false, collapsed: true },
    miniPlaylist:{ visible: false, collapsed: true },
    spectro:     { visible: false, collapsed: true },
    outputHealth:{ visible: true, collapsed: true },
  },
  prepa: {
    scenePads:   { visible: true, collapsed: false },
    groupStrips: { visible: true, collapsed: false },
    stagePlan:   { visible: true, collapsed: false },
    zoneControls:{ visible: true, collapsed: false },
    vjDeck:      { visible: true, collapsed: false },
    miniPlaylist:{ visible: true, collapsed: false },
    spectro:     { visible: true, collapsed: false },
    outputHealth:{ visible: true, collapsed: false },
  },
  vj: {
    scenePads:   { visible: true, collapsed: false },
    groupStrips: { visible: true, collapsed: false },
    stagePlan:   { visible: true, collapsed: true },
    zoneControls:{ visible: false, collapsed: true },
    vjDeck:      { visible: true, collapsed: false },
    miniPlaylist:{ visible: false, collapsed: true },
    spectro:     { visible: true, collapsed: false },
    outputHealth:{ visible: false, collapsed: true },
  },
};

const SMART_WIDGET_IDS = new Set<SmartWidgetType>(DEFAULT_WIDGETS.map((widget) => widget.id));

function isSmartWidgetType(value: string): value is SmartWidgetType {
  return SMART_WIDGET_IDS.has(value as SmartWidgetType);
}

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

export default function SmartDashboard() {
  // Persistance via Zustand
  const {
    smartActiveScene: activeScene,
    smartZoneValues: zoneValues,
    setSmartZoneValue,
    smartZoneMappings,
    setSmartZoneMapping,
    smartPads: pads,
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

    // New Smart Mode Slices
    smartEditMode,
    setSmartEditMode,
    smartWidgets,
    updateSmartWidget,
    setSmartWidgets,
    showLock,
    setShowLock,
    openTool,
    setOpenTool,
    masterDimmer,
    vjShaderMode,
    setVjShaderMode,
    vjShaderIntensity,
    setVjShaderIntensity,
    projectionActive,
    setProjectionActive,
    resolumeHost,
    setResolumeHost,
    resolumePort,
    setResolumePort,
    resolumeLayer,
    setResolumeLayer,
    resolumeClip,
    setResolumeClip,
    resolumeOpacity,
    setResolumeOpacity,
    // showPlayerSlice
    groupLevels,
    dmxGroups,
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
    midiMappings,
  } = useStore();
  const offlineReadiness = useOfflineReadiness();
  useSmartHotkeys();

  // Load fixtures globally
  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  // Pilote des oscillateurs -> sorties DMX (~40Hz).
  // Le driver lit l'etat global (oscillateurs + bpm) et n'ecrit sur le DMX que
  // s'il existe au moins un oscillateur 'enabled'. On (re)evalue son etat a
  // chaque changement du store via subscribe.
  useEffect(() => {
    oscillatorDriver.configure(() => {
      const state = useStore.getState();
      return { oscillators: state.oscillators, bpm: state.bpm, effectSpeed: state.effectSpeed };
    });
    oscillatorDriver.sync();
    const unsubscribe = useStore.subscribe(() => oscillatorDriver.sync());
    return () => {
      unsubscribe();
      oscillatorDriver.dispose();
    };
  }, []);

  // Pilote du pixel-mapping -> sorties DMX (~40Hz). ADDITIF : n'ecrit sur le DMX
  // que si pixelMap.enabled. INVARIANT : desactive => RIEN n'est emis.
  useEffect(() => {
    pixelMapDriver.configure(() => {
      const state = useStore.getState();
      return { pixelMap: state.pixelMap, fixtures: state.fixtures };
    });
    pixelMapDriver.sync();
    const unsubscribe = useStore.subscribe(() => pixelMapDriver.sync());
    return () => {
      unsubscribe();
      pixelMapDriver.dispose();
    };
  }, []);

  // Migration one-shot au montage : ajoute uniquement les sections manquantes
  // (ex: apres une mise a jour qui introduit un nouveau widget) SANS jamais
  // ecraser les choix visible/collapsed/order de l'utilisateur. C'est ce qui
  // rend la personnalisation des sections reellement persistante.
  useEffect(() => {
    const existing = new Set(smartWidgets.map((widget) => widget.id));
    const missing = DEFAULT_WIDGETS.filter((widget) => !existing.has(widget.id));
    if (missing.length === 0) return;
    const maxOrder = smartWidgets.reduce((max, widget) => Math.max(max, widget.order), -1);
    setSmartWidgets([
      ...smartWidgets,
      ...missing.map((widget, index) => ({ ...widget, order: maxOrder + 1 + index })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setResolumeHost, setResolumePort]);

  const handleWidgetCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (!Array.from(event.dataTransfer.types).includes("application/glow-widget-id")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleWidgetCanvasDrop = useCallback((event: React.DragEvent) => {
    const widgetId = event.dataTransfer.getData("application/glow-widget-id");
    if (!isSmartWidgetType(widgetId)) return;
    event.preventDefault();
    const sorted = [...smartWidgets].sort((a, b) => a.order - b.order);
    const fromIndex = sorted.findIndex((widget) => widget.id === widgetId);
    if (fromIndex === -1) return;
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.push({ ...moved, visible: true, collapsed: false });
    setSmartWidgets(sorted);
  }, [setSmartWidgets, smartWidgets]);

  // Zone Config Modal State
  const [showZoneConfig, setShowZoneConfig] = useState(false);
  const [editingZoneKey, setEditingZoneKey] = useState<string>("Master");

  const [fixtureGroups, setFixtureGroups] = useState<FixtureGroup[]>([]);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [safetySummary, setSafetySummary] = useState<{
    operatorRole: string;
    dangerousPhysicalOutputsEnabled: boolean;
    armed: Record<string, boolean>;
  } | null>(null);
  const vjAudioBandsRef = useRef<[number, number, number]>([0, 0, 0]);
  const [resolumeStatus, setResolumeStatus] = useState<ResolumeStatus | null>(null);
  const [isResolumeBusy, setIsResolumeBusy] = useState(false);

  // Diagnostics State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
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
  }, [setResolumeHost, setResolumePort]);

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

  useEffect(() => {
    if (openTool === "preflight") {
      void refreshPreflightData();
    }
    if (openTool === "recovery") {
      refreshShowSnapshots();
      setCrashSnapshotMeta(readCrashSnapshotMeta());
      void refreshPreflightData();
    }
  }, [openTool, refreshPreflightData, refreshShowSnapshots]);

  const emitLiveGroupIntensity = useCallback((backendGroup: string, level: number) => {
    const zoneId = LIVE_GROUP_ZONE_IDS[backendGroup] || undefined;
    socket.emit("smart:zone_intensity", {
      zoneId,
      groupName: backendGroup,
      value: Math.round(((level / 100) * 255) * (masterDimmer / 255)),
    });
  }, [masterDimmer]);

  useEffect(() => {
    dmxGroups.forEach((group) => {
      if (group.backendZone) emitLiveGroupIntensity(group.backendZone, groupLevels[group.id] ?? 80);
    });
  }, [dmxGroups, emitLiveGroupIntensity, groupLevels]);

  const runDiagnostics = useCallback(async () => {
    setIsDiagnosing(true);
    try {
      const response = await fetch(`${API_BASE}/api/diagnose`);
      if (response.ok) {
        const data = await response.json();
        setDiagnosisResult(data);
        setOpenTool("diagnostic");
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
  }, [addToast, setOpenTool]);

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

  // Render sub-widgets
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
                onClick={() => setProjectionActive(!projectionActive)}
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

          {/* Panneau Oscillateurs (LFO -> modulation DMX temps reel) */}
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/25">
            <OscillatorPanel />
          </div>

          {/* Panneau Macros (actions sur selection de fixtures) */}
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/25">
            <MacrosPanel />
          </div>

          {/* Panneau Pixel-Mapping (champ de couleur -> fixtures RGB temps reel) */}
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/25">
            <PixelMapPanel />
          </div>
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
      detail: offlineReadiness.ready
        ? `App, bibliotheque et snapshot local prets (${offlineReadiness.offlineProjectBackup?.pads ?? 0} pads).`
        : "Ouvrir le badge Offline dans la barre haute et corriger les points manquants.",
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
    offlineReadiness.offlineProjectBackup?.pads,
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
      label: "Snapshot offline",
      ok: Boolean(offlineReadiness.offlineProjectBackup),
      detail: offlineReadiness.offlineProjectBackup
        ? `${offlineReadiness.offlineProjectBackup.projectName || "Projet local"} - ${offlineReadiness.offlineProjectBackup.pads} pad(s), age ${formatRecoveryAge(offlineReadiness.offlineProjectBackup.updatedAt)}.`
        : "Aucun backup offline local detecte dans ce navigateur.",
    },
    {
      label: "Projet / pack",
      ok: Boolean(currentProjectName),
      detail: currentProjectName ? currentProjectName : "Sauvegarder le projet ou exporter un .glowpack.",
    },
    {
      label: "Offline",
      ok: offlineReadiness.ready,
      detail: offlineReadiness.ready
        ? `App et donnees critiques pretes hors ligne. Queue DMX: ${offlineReadiness.dmxQueue.pending}.`
        : "Verifier le badge Offline dans la barre haute.",
    },
    {
      label: "Show Lock",
      ok: showLock,
      detail: showLock ? "Actions dangereuses limitees pendant le show." : "Activer pour eviter les suppressions en live.",
    },
  ];

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

  const handleRestoreOfflineBackup = useCallback(() => {
    const backup = readOfflineProjectBackup();
    if (!backup) {
      addToast({
        type: "warning",
        message: "Backup offline absent",
        detail: "Aucun snapshot local restaurable sur ce navigateur.",
      });
      return;
    }
    const label = backup.projectName || "Projet offline";
    if (!confirm(`Restaurer le snapshot offline "${label}" ? L'etat actuel sera remplace.`)) return;

    const normalized = normalizeProjectState(backup.state, useStore.getState(), { projectName: backup.projectName });
    clearHistory();
    useStore.setState(normalized.state as Partial<ReturnType<typeof useStore.getState>>);
    addToast({
      type: "success",
      message: "Snapshot offline restaure",
      detail: normalized.migrations[0] || `${backup.pads} pad(s), ${backup.clips} clip(s)`,
    });
  }, [addToast]);

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
      <SmartToolsModals
        diagnosisResult={diagnosisResult}
        isDiagnosing={isDiagnosing}
        e2eSteps={e2eSteps}
        e2eRequiredOk={e2eRequiredOk}
        recoverySteps={recoverySteps}
        recoveryRequiredOk={recoveryRequiredOk}
        crashSnapshotMeta={crashSnapshotMeta}
        latestShowSnapshot={latestShowSnapshot}
        offlineProjectBackup={offlineReadiness.offlineProjectBackup}
        runDiagnostics={runDiagnostics}
        downloadSupportReport={downloadSupportReport}
        handlePreflightSnapshot={handlePreflightSnapshot}
        exportPreflightReport={exportPreflightReport}
        handleRecoverySnapshot={handleRecoverySnapshot}
        handleRecoverySave={handleRecoverySave}
        handleRestoreLatestSnapshot={handleRestoreLatestSnapshot}
        handleRestoreOfflineBackup={handleRestoreOfflineBackup}
        formatRecoveryAge={formatRecoveryAge}
      />

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
      {isSidebarVisible && <SmartSidebar />}

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

                {/* Layout Presets */}
                <div className="flex items-center gap-1 bg-black/20 border border-white/5 px-2 py-1 rounded-xl">
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-500 mr-1" />
                  {(["live", "prepa", "vj"] as LayoutPresetId[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        const preset = LAYOUT_PRESETS[key];
                        setSmartWidgets(
                          smartWidgets.map((w) => ({ ...w, ...(preset[w.id] || {}) }))
                        );
                      }}
                      className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300 transition-colors"
                    >
                      {key === "prepa" ? "Prépa" : key.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Render widgets — drag & drop via framer-motion Reorder */}
            {(() => {
              const sorted = [...smartWidgets].sort((a, b) => a.order - b.order);
              const displayed = sorted.filter((w) => w.visible);
              return (
                <Reorder.Group
                  axis="y"
                  values={displayed}
                  onDragOver={handleWidgetCanvasDragOver}
                  onDrop={handleWidgetCanvasDrop}
                  onReorder={(newOrder) => {
                    // Rebuild full list: update order for displayed items, keep hidden items at their relative positions
                    const hiddenItems = sorted.filter((w) => !w.visible && !smartEditMode);
                    const reindexed = newOrder.map((w, i) => ({ ...w, order: i }));
                    const hiddenReindexed = hiddenItems.map((w, i) => ({ ...w, order: newOrder.length + i }));
                    setSmartWidgets([...reindexed, ...hiddenReindexed]);
                  }}
                  className="flex-1 space-y-6"
                  style={{ listStyle: "none" }}
                >
                  {displayed.length === 0 && (
                    <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-cyan-500/20 bg-cyan-500/[0.03] px-6 text-center">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Aucun widget actif
                      </p>
                    </div>
                  )}
                  {displayed.map((widget) => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      smartEditMode={smartEditMode}
                      onToggleCollapse={() => updateSmartWidget(widget.id, { collapsed: !widget.collapsed })}
                      onToggleVisibility={() => updateSmartWidget(widget.id, { visible: !widget.visible })}
                      onRemove={() => updateSmartWidget(widget.id, { visible: false, collapsed: true })}
                    >
                      {widget.id === "scenePads" && <SceneController variant="widget" />}
                      {widget.id === "groupStrips" && <GroupStrips />}
                      {widget.id === "stagePlan" && <StagePlan />}
                      {widget.id === "zoneControls" && renderZoneControls()}
                      {widget.id === "vjDeck" && renderVjDeck()}
                      {widget.id === "miniPlaylist" && renderMiniPlaylist()}
                      {widget.id === "spectro" && (
                        <div className="flex items-center gap-5">
                          <canvas ref={spectroCanvasRef} width="200" height="95" className="bg-black/40 border border-white/5 rounded-xl shrink-0 shadow-inner" />
                          <div>
                            <p className="text-white text-xs font-bold uppercase tracking-wider">Visualiseur de Spectre</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-semibold leading-relaxed">
                              Affiche en temps réel l'intensité des 3 bandes de fréquences audio (Graves, Médiums, Aigus) qui synchronisent automatiquement les canaux DMX en mode Sound-to-Light.
                            </p>
                          </div>
                        </div>
                      )}
                      {widget.id === "outputHealth" && <OutputHealthWidget />}
                    </WidgetCard>
                  ))}
                </Reorder.Group>
              );
            })()}
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

function WidgetCard({
  widget,
  smartEditMode,
  onToggleCollapse,
  onToggleVisibility,
  onRemove,
  children,
}: {
  widget: SmartWidget;
  smartEditMode: boolean;
  onToggleCollapse: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={widget}
      dragListener={false}
      dragControls={controls}
      className={`bg-[#12141A]/95 border rounded-2xl shadow-xl transition-all duration-200 ${
        !widget.visible
          ? "border-dashed border-red-500/20 opacity-60 bg-red-500/[0.01]"
          : "border-white/5"
      }`}
    >
      {/* Widget Header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-black/20 rounded-t-2xl">
        {/* Drag handle — only in edit mode */}
        {smartEditMode && (
          <span
            className="cursor-grab touch-none text-slate-600 hover:text-slate-300 transition-colors shrink-0"
            onPointerDown={(e) => controls.start(e)}
            title="Glisser pour réordonner"
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-xs font-bold uppercase tracking-wider text-white">{widget.label}</span>
          {!widget.visible && (
            <span className="shrink-0 rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400">
              Masqué
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Visibility toggle — only in edit mode */}
          {smartEditMode && (
            <button
              onClick={onToggleVisibility}
              className="rounded p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              title={widget.visible ? "Masquer" : "Afficher"}
            >
              {widget.visible ? (
                <Eye className="h-3.5 w-3.5 text-cyan-400" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-red-400" />
              )}
            </button>
          )}

          {smartEditMode && (
            <button
              onClick={onRemove}
              className="rounded p-1 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
              title="Retirer du dashboard"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Collapse / Expand */}
          <button
            onClick={onToggleCollapse}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            {widget.collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Widget Content */}
      {!widget.collapsed && <div className="p-5">{children}</div>}
    </Reorder.Item>
  );
}
