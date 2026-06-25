"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircuitBoard,
  Eye,
  EyeOff,
  FilePlus2,
  GripVertical,
  LayoutGrid,
  Library,
  Music2,
  Package,
  Search,
  SlidersHorizontal,
  Terminal,
  Wand2,
  X,
} from "lucide-react";
import useStore from "../../store/useStore";
import { API_BASE } from "../../lib/config";
import { DEFAULT_WIDGETS, type SmartWidgetType } from "../../store/slices/smartModeSlice";
import OrchestratorController from "../OrchestratorController";
import AiInspectorPanel from "./AiInspectorPanel";
import FixtureInspectorPanel from "./FixtureInspectorPanel";
import GroupInspectorPanel from "./GroupInspectorPanel";

type LibraryKind = "fixture_profile" | "look_preset" | "show_template" | "venue_template";
type LibraryScope = "system" | "user" | "community";

interface LibraryItem {
  id: number;
  kind: LibraryKind;
  scope: LibraryScope;
  name: string;
  description: string | null;
  tags: string[];
  data: Record<string, unknown>;
  updated_at: string;
}

type FixtureListing = {
  id: number;
  name: string;
  manufacturer: string | null;
  total_channels: number;
  start_address: number;
};

type NodePaletteItem = {
  type: string;
  label: string;
  sub: string;
  accent: string;
};

const NODE_PALETTE: NodePaletteItem[] = [
  { type: "audioIn", label: "Audio IN", sub: "Microphone / loopback", accent: "text-cyan-300" },
  { type: "sliderInput", label: "UI Slider", sub: "Controle intensite", accent: "text-pink-300" },
  { type: "padInput", label: "UI Pad", sub: "Flash / trigger", accent: "text-amber-300" },
  { type: "lfoInput", label: "LFO Oscillator", sub: "Sine / square / triangle", accent: "text-green-300" },
  { type: "colorPicker", label: "RGB Color", sub: "Canaux R/G/B", accent: "text-orange-300" },
  { type: "artnetOut", label: "Art-Net", sub: "Sortie univers", accent: "text-cyan-300" },
  { type: "dmxOutput", label: "DMX Fixture", sub: "Lampe individuelle", accent: "text-purple-300" },
];

const WIDGET_PRESETS: Array<{ id: string; label: string; visible: SmartWidgetType[] }> = [
  { id: "stage-only", label: "Plan seul", visible: ["stagePlan"] },
  { id: "live", label: "Live", visible: ["scenePads", "groupStrips", "stagePlan", "zoneControls", "outputHealth"] },
  { id: "all", label: "Tout", visible: DEFAULT_WIDGETS.map((widget) => widget.id) },
  { id: "none", label: "Aucun", visible: [] },
];

const KIND_LABELS: Record<LibraryKind, string> = {
  fixture_profile: "Profil fixture",
  look_preset: "Look",
  show_template: "Show",
  venue_template: "Lieu",
};

function onNodeDragStart(event: React.DragEvent, item: NodePaletteItem) {
  event.dataTransfer.setData("application/reactflow", JSON.stringify({ type: item.type, label: item.label }));
  event.dataTransfer.effectAllowed = "move";
}

function onFixtureDragStart(event: React.DragEvent, fixture: FixtureListing) {
  event.dataTransfer.setData("application/reactflow", JSON.stringify({
    type: "fixtureNode",
    label: fixture.name,
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    manufacturer: fixture.manufacturer,
    totalChannels: fixture.total_channels,
    startAddress: fixture.start_address,
    universe: 1,
  }));
  event.dataTransfer.effectAllowed = "move";
}

function lookClasses(rgb: { r?: number; g?: number; b?: number }) {
  const r = rgb.r || 0;
  const g = rgb.g || 0;
  const b = rgb.b || 0;
  if (r > 220 && g > 220 && b > 220) return { color: "bg-white", textColor: "text-slate-900" };
  if (r >= g && r >= b) return { color: r > 220 && b > 120 ? "bg-pink-500" : "bg-red-500", textColor: r > 220 && b > 120 ? "text-pink-300" : "text-red-300" };
  if (g >= r && g >= b) return { color: "bg-green-500", textColor: "text-green-300" };
  return { color: b > 180 && r > 100 ? "bg-purple-500" : "bg-blue-500", textColor: b > 180 && r > 100 ? "text-purple-300" : "text-blue-300" };
}

function Accordion({
  title,
  count,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-white/5 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-cyan-300">{icon}</span>
        <span className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-widest text-slate-300">{title}</span>
        {typeof count === "number" && (
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">
            {count}
          </span>
        )}
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
      </button>
      {open && <div className="space-y-2 border-t border-white/5 p-2.5">{children}</div>}
    </section>
  );
}

export default function SmartSidebar() {
  const {
    appMode,
    smartSidebarPanel,
    setSmartSidebarPanel,
    selectedFixtureId,
    selectFixture,
    selectedStageGroup,
    setSelectedStageGroup,
    fixtures,
    dmxGroups,
  } = useStore();
  const selectedFixture = fixtures.find((fixture) => String(fixture.nodeId) === selectedFixtureId || String(fixture.id) === selectedFixtureId);
  const selectedGroup = dmxGroups.find((group) => group.id === selectedStageGroup || group.name === selectedStageGroup);
  const panelTitle = smartSidebarPanel === "widgets"
    ? "Widgets"
    : smartSidebarPanel === "library"
      ? "Bibliotheque"
      : smartSidebarPanel === "aiInspector"
        ? "AI Inspector"
        : smartSidebarPanel === "aiLight"
          ? "IA Lumiere"
          : "Inspecteur";

  const closeInspector = React.useCallback(() => {
    selectFixture(null);
    setSelectedStageGroup(null);
    setSmartSidebarPanel("widgets");
  }, [selectFixture, setSelectedStageGroup, setSmartSidebarPanel]);

  useEffect(() => {
    if (smartSidebarPanel !== "inspector") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeInspector();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeInspector, smartSidebarPanel]);

  return (
    <aside className="h-full w-[316px] shrink-0 border-r border-white/5 pr-3">
      <div className="flex h-full overflow-hidden rounded-xl border border-white/5 bg-[#12141A] shadow-xl">
        <nav className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-black/25 py-2">
          <RailButton active={smartSidebarPanel === "widgets"} title="Widgets" onClick={() => setSmartSidebarPanel("widgets")}>
            <SlidersHorizontal className="h-4 w-4" />
          </RailButton>
          <RailButton active={smartSidebarPanel === "inspector"} title="Inspecteur" onClick={() => setSmartSidebarPanel("inspector")}>
            <Activity className="h-4 w-4" />
          </RailButton>
          <RailButton active={smartSidebarPanel === "library"} title="Bibliotheque" onClick={() => setSmartSidebarPanel("library")}>
            <Library className="h-4 w-4" />
          </RailButton>
          <RailButton active={smartSidebarPanel === "aiInspector"} title="AI Inspector" onClick={() => setSmartSidebarPanel("aiInspector")}>
            <Terminal className="h-4 w-4" />
          </RailButton>
          <RailButton active={smartSidebarPanel === "aiLight"} title="IA Lumiere" onClick={() => setSmartSidebarPanel("aiLight")}>
            <Wand2 className="h-4 w-4" />
          </RailButton>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/5 px-3">
            <span className="truncate text-[10px] font-black uppercase tracking-widest text-slate-400">{panelTitle}</span>
            {appMode === "creator" && (
              <span className="rounded-md border border-purple-400/20 bg-purple-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-purple-200">
                Build
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
            {smartSidebarPanel === "widgets" ? (
              <WidgetToolboxPanel />
            ) : smartSidebarPanel === "library" ? (
              <SmartLibraryPanel buildMode={appMode === "creator"} />
            ) : smartSidebarPanel === "aiInspector" ? (
              <AiInspectorPanel />
            ) : smartSidebarPanel === "aiLight" ? (
              <OrchestratorController />
            ) : selectedStageGroup ? (
              <div className="space-y-3">
                <InspectorHeader title={selectedGroup?.name || selectedStageGroup} onBack={closeInspector} />
                <GroupInspectorPanel groupName={selectedStageGroup} />
              </div>
            ) : selectedFixtureId ? (
              <div className="space-y-3">
                <InspectorHeader title={selectedFixture?.name || "Projecteur"} onBack={closeInspector} />
                <FixtureInspectorPanel fixtureId={selectedFixtureId} layout="sidebar" />
              </div>
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-white">Inspecteur</p>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                  Selectionnez un projecteur, un groupe ou un element de bibliotheque.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function RailButton({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
          : "border-transparent text-slate-500 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function InspectorHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/25 p-2">
      <button onClick={onBack} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Widgets">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <p className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-widest text-white">{title}</p>
      <button onClick={onBack} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Fermer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function WidgetToolboxPanel() {
  const {
    smartWidgets,
    setSmartWidgets,
    updateSmartWidget,
    reorderSmartWidgets,
  } = useStore();
  const sortedWidgets = useMemo(() => [...smartWidgets].sort((a, b) => a.order - b.order), [smartWidgets]);
  const visibleCount = sortedWidgets.filter((widget) => widget.visible).length;

  const applyPreset = (visibleIds: SmartWidgetType[]) => {
    const visible = new Set<SmartWidgetType>(visibleIds);
    setSmartWidgets(
      DEFAULT_WIDGETS.map((widget) => ({
        ...widget,
        visible: visible.has(widget.id),
        collapsed: visible.has(widget.id) ? false : true,
      })),
    );
  };

  const keepOnlyWidget = (id: SmartWidgetType) => {
    setSmartWidgets(
      sortedWidgets.map((widget) => ({
        ...widget,
        visible: widget.id === id,
        collapsed: widget.id === id ? false : true,
      })),
    );
  };

  const moveWidget = (id: SmartWidgetType, direction: -1 | 1) => {
    const index = sortedWidgets.findIndex((widget) => widget.id === id);
    const target = sortedWidgets[index + direction];
    const current = sortedWidgets[index];
    if (!current || !target) return;
    reorderSmartWidgets(current.order, target.order);
  };

  const onWidgetDragStart = (event: React.DragEvent, id: SmartWidgetType) => {
    event.dataTransfer.setData("application/glow-widget-id", id);
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/5 bg-black/20 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
            <LayoutGrid className="h-3.5 w-3.5 text-cyan-300" />
            Dashboard
          </span>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">
            {visibleCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {WIDGET_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.visible)}
              className="min-h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-[9px] font-black uppercase tracking-wider text-slate-400 transition-colors hover:border-cyan-500/30 hover:text-cyan-200"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Selection</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{visibleCount}/{sortedWidgets.length}</span>
        </div>
        {sortedWidgets.map((widget, index) => (
          <div
            key={widget.id}
            draggable
            onDragStart={(event) => onWidgetDragStart(event, widget.id)}
            className={`group rounded-xl border p-2.5 transition-colors ${
              widget.visible
                ? "border-cyan-500/20 bg-cyan-500/[0.04]"
                : "border-white/5 bg-black/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-600 transition-colors group-hover:text-slate-300" />
              <button
                type="button"
                onClick={() => updateSmartWidget(widget.id, { visible: !widget.visible, collapsed: widget.visible ? widget.collapsed : false })}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title={widget.visible ? "Masquer le widget" : "Afficher le widget"}
              >
                <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-wider text-white">
                  {widget.label}
                </span>
                {widget.visible ? (
                  <Eye className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => keepOnlyWidget(widget.id)}
                className="mr-auto rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 transition-colors hover:border-cyan-500/30 hover:text-cyan-200"
                title="Garder uniquement ce widget"
              >
                Solo
              </button>
              <button
                type="button"
                onClick={() => moveWidget(widget.id, -1)}
                disabled={index === 0}
                className="rounded-md border border-white/10 bg-black/25 p-1 text-slate-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Monter"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveWidget(widget.id, 1)}
                disabled={index === sortedWidgets.length - 1}
                className="rounded-md border border-white/10 bg-black/25 p-1 text-slate-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                title="Descendre"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function SmartLibraryPanel({ buildMode }: { buildMode: boolean }) {
  const {
    smartPads,
    addSmartPad,
    fetchFixtures,
    addToast,
    addClip,
    addMarker,
    setDuration,
    playlist,
    selectedFixtureId,
    selectFixture,
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fixtures, setFixtures] = useState<FixtureListing[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const loadFixtures = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fixtures`);
      setFixtures(response.ok ? await response.json() : []);
    } catch {
      setFixtures([]);
    }
  }, []);

  const loadItems = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/library`);
      if (!response.ok) throw new Error("Bibliotheque indisponible");
      setItems(await response.json());
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bibliotheque indisponible");
    }
  }, []);

  useEffect(() => {
    void loadFixtures();
    void loadItems();
  }, [loadFixtures, loadItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const text = `${item.name} ${item.description || ""} ${item.tags.join(" ")} ${KIND_LABELS[item.kind]}`.toLowerCase();
      return !q || text.includes(q);
    });
  }, [items, query]);

  const fixtureProfiles = filteredItems.filter((item) => item.kind === "fixture_profile");
  const looksAndPresets = filteredItems.filter((item) => item.kind !== "fixture_profile");

  const handleUseItem = async (item: LibraryItem) => {
    try {
      if (item.kind === "fixture_profile") {
        const channels = Array.isArray(item.data.channels) ? item.data.channels : [];
        const response = await fetch(`${API_BASE}/api/fixtures`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            manufacturer: typeof item.data.manufacturer === "string" ? item.data.manufacturer : "Glow Logic Library",
            channels,
            startAddress: 1,
            notes: `Bibliotheque locale - ${item.description || item.name}`,
            modes: [{ name: typeof item.data.modeName === "string" ? item.data.modeName : item.name, channels }],
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.details || result.error || "Fixture impossible");
        await fetchFixtures();
        await loadFixtures();
        setStatus("Profil ajoute aux fixtures");
        addToast({ type: "success", message: "Bibliotheque", detail: `${item.name} ajoute aux fixtures` });
        return;
      }

      if (item.kind === "look_preset") {
        const pads = Array.isArray(item.data.pads) ? item.data.pads as Array<Record<string, unknown>> : [];
        const nextWidget = smartPads.length > 0 ? Math.max(...smartPads.map((pad) => pad.qlcWidget)) + 1 : 20;
        pads.forEach((pad, index) => {
          const rgb = typeof pad.rgb === "object" && pad.rgb ? pad.rgb as { r?: number; g?: number; b?: number } : {};
          const classes = lookClasses(rgb);
          addSmartPad({
            id: Date.now() + index,
            name: typeof pad.name === "string" ? pad.name : `${item.name} ${index + 1}`,
            color: classes.color,
            textColor: classes.textColor,
            iconName: pad.strobe ? "Zap" : "Sparkles",
            qlcPage: 1,
            qlcWidget: nextWidget + index,
            dmxValues: {
              1: Number(pad.intensity ?? 200),
              2: Number(rgb.r ?? 0),
              3: Number(rgb.g ?? 0),
              4: Number(rgb.b ?? 0),
              5: Number((rgb as { w?: number }).w ?? 0),
              6: Number(pad.strobe ?? 0),
            },
            midiNote: -1,
            midiChannel: 1,
            gridCol: index % 4,
            gridRow: Math.floor(index / 4),
            gridW: 1,
            gridH: 1,
          });
        });
        setStatus(`${pads.length} pad(s) crees`);
        addToast({ type: "success", message: "Look applique", detail: item.name });
        return;
      }

      if (item.kind === "show_template") {
        const sections = Array.isArray(item.data.sections) ? item.data.sections as Array<Record<string, unknown>> : [];
        sections.forEach((section, index) => {
          const startTime = Math.round(Number(section.startMin || 0) * 60_000);
          addMarker({ id: `lib-mkr-${Date.now()}-${index}`, name: String(section.name || `Section ${index + 1}`), time: startTime, color: ["#22d3ee", "#a855f7", "#f43f5e", "#fb923c"][index % 4] });
          addClip({ id: `lib-clip-${Date.now()}-${index}`, track: "lights", name: String(section.name || `Section ${index + 1}`), startTime, duration: 5 * 60_000, color: "bg-cyan-500", textColor: "text-cyan-300", qlcPage: 1, qlcWidget: 20 + index });
        });
        const maxMin = sections.reduce((max, section) => Math.max(max, Number(section.startMin || 0)), 0);
        if (maxMin > 0) setDuration((maxMin + 10) * 60_000);
        setStatus(`${sections.length} section(s) ajoutees`);
        addToast({ type: "success", message: "Show template applique", detail: item.name });
        return;
      }

      if (item.kind === "venue_template") {
        const response = await fetch(`${API_BASE}/api/venue-profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Library - ${item.name}`, data: item.data || {} }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.details || result.error || "Venue impossible");
        setStatus("Lieu ajoute aux profils");
        addToast({ type: "success", message: "Lieu ajoute", detail: item.name });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Application impossible";
      setStatus(detail);
      addToast({ type: "error", message: "Bibliotheque", detail });
    }
  };

  const handleCreateUserLook = async () => {
    const response = await fetch(`${API_BASE}/api/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "look_preset",
        scope: "user",
        name: `Look utilisateur ${new Date().toLocaleTimeString("fr-FR")}`,
        description: "Preset local cree depuis la bibliotheque.",
        tags: ["user", "offline"],
        data: { pads: [{ name: "Clean", rgb: { r: 255, g: 255, b: 255 }, intensity: 160 }] },
      }),
    });
    if (response.ok) {
      await loadItems();
      setStatus("Look utilisateur ajoute");
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const response = await fetch(`${API_BASE}/api/library/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || "Import impossible");
      setStatus(`${result.imported} item(s) importes`);
      await loadItems();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import impossible");
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher fixture, look, lieu..."
          className="w-full rounded-xl border border-white/10 bg-black/35 py-2.5 pl-9 pr-3 text-xs font-semibold text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
        />
      </div>

      <Accordion title="Fixtures patchees" count={fixtures.length} icon={<Package className="h-4 w-4" />}>
        {fixtures.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[11px] font-semibold text-slate-500">
            Aucune fixture locale.
          </p>
        ) : fixtures.map((fixture) => {
          const id = String(fixture.id);
          const selected = selectedFixtureId === id || selectedFixtureId === `fixture-${fixture.id}`;
          return (
          <div
            key={fixture.id}
            draggable={buildMode}
            onDragStart={(event) => onFixtureDragStart(event, fixture)}
            onClick={() => selectFixture(`fixture-${fixture.id}`, { openInspector: true })}
            className={`flex items-center gap-2 rounded-lg border p-2.5 ${
              selected ? "border-cyan-300/50 bg-cyan-500/10" : "border-purple-500/15 bg-purple-500/[0.04]"
            } ${buildMode ? "cursor-grab hover:border-purple-400/40" : "cursor-pointer"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/5 bg-black/30 text-[10px] font-black text-purple-200">
              {fixture.total_channels}ch
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-black text-white">{fixture.name}</p>
              <p className="truncate text-[10px] font-semibold text-slate-500">Ch {fixture.start_address} {fixture.manufacturer || ""}</p>
            </div>
            {buildMode && <span className="text-[8px] font-black uppercase tracking-widest text-purple-300">Drag</span>}
          </div>
        );
        })}
      </Accordion>

      {buildMode && (
        <Accordion title="Noeuds" count={NODE_PALETTE.length} icon={<CircuitBoard className="h-4 w-4" />} defaultOpen={false}>
          {NODE_PALETTE.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(event) => onNodeDragStart(event, item)}
              className="flex cursor-grab items-center gap-2 rounded-lg border border-white/5 bg-black/25 p-2.5 hover:border-cyan-400/30"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-slate-900 ${item.accent}`}>
                <CircuitBoard className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-white">{item.label}</p>
                <p className="truncate text-[10px] font-semibold text-slate-500">{item.sub}</p>
              </div>
            </div>
          ))}
        </Accordion>
      )}

      <Accordion title="Looks & presets" count={looksAndPresets.length + fixtureProfiles.length} icon={<BookOpen className="h-4 w-4" />} defaultOpen>
        <div className="flex gap-1">
          <button onClick={handleCreateUserLook} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-2 text-[10px] font-black text-cyan-200 hover:bg-cyan-500/20">
            <FilePlus2 className="h-3.5 w-3.5" />
            Look
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-[10px] font-black text-slate-300 hover:bg-white/5">
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
        {[...fixtureProfiles, ...looksAndPresets].map((item) => (
          <LibraryItemRow key={item.id} item={item} onUse={() => void handleUseItem(item)} />
        ))}
        {filteredItems.length === 0 && <p className="p-3 text-center text-[11px] font-semibold text-slate-500">Aucun item trouve.</p>}
      </Accordion>

      <Accordion title="Medias" count={playlist.length} icon={<Music2 className="h-4 w-4" />} defaultOpen={false}>
        {playlist.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[11px] font-semibold text-slate-500">
            Aucun media dans la playlist.
          </p>
        ) : playlist.map((track) => (
          <div key={track.id} className="rounded-lg border border-white/5 bg-black/25 p-2.5">
            <p className="truncate text-[11px] font-black text-white">{track.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{track.fileType}</p>
          </div>
        ))}
      </Accordion>

      {status && (
        <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-[11px] font-semibold text-slate-400">
          {status}
        </div>
      )}
    </div>
  );
}

function LibraryItemRow({ item, onUse }: { item: LibraryItem; onUse: () => void }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/25 p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">{item.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold text-slate-500">{item.description || KIND_LABELS[item.kind]}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-cyan-300">{KIND_LABELS[item.kind]}</span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-400">{item.scope}</span>
          </div>
        </div>
        <button onClick={onUse} className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-black uppercase text-cyan-200 hover:bg-cyan-500/20">
          Utiliser
        </button>
      </div>
    </div>
  );
}
