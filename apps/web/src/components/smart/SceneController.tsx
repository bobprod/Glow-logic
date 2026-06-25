"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  AudioLines,
  Check,
  Copy,
  Droplets,
  Edit2,
  Flame,
  Music2,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import useStore, { type SmartPad } from "../../store/useStore";
import { padToClip } from "../../lib/sceneBridge";
import SceneMaskEditor from "./SceneMaskEditor";

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
  Droplets: <Droplets className="h-6 w-6" />,
  Flame: <Flame className="h-6 w-6" />,
  Zap: <Zap className="h-6 w-6" />,
  Activity: <Activity className="h-6 w-6" />,
  Sparkles: <Sparkles className="h-6 w-6" />,
  AudioLines: <AudioLines className="h-6 w-6" />,
};

type EditingState = {
  mode: "create" | "edit";
  page: number;
  slot: number;
  pad: SmartPad | null;
};

type ContextState = {
  pad: SmartPad;
  x: number;
  y: number;
} | null;

type SceneControllerProps = {
  variant?: "sidebar" | "widget" | "performance";
  readonly?: boolean;
};

const PAGES = [0, 1, 2, 3];
const SLOTS = Array.from({ length: 16 }, (_, slot) => slot);
const MIDI_ROWS = [7, 6, 5, 4, 3, 2, 1, 0];
const MIDI_COLS = [0, 1, 2, 3, 4, 5, 6, 7];

function padControlId(page: number, slot: number) {
  return `pad_${page}_${slot}`;
}

function firstFreeSlot(pads: SmartPad[], page: number) {
  return SLOTS.find((slot) => !pads.some((pad) => pad.page === page && pad.slot === slot)) ?? null;
}

export default function SceneController({ variant = "sidebar", readonly = false }: SceneControllerProps) {
  const {
    smartPads,
    smartActiveScene,
    activePadPage,
    setActivePadPage,
    smartPadViewMode,
    setSmartPadViewMode,
    smartEditMode,
    showLock,
    bpm,
    triggerSmartPad,
    addSmartPad,
    updateSmartPad,
    deleteSmartPad,
    movePad,
    applyPadTemplate,
    midiLearnMode,
    setMidiLearnMode,
    midiLearnActiveControl,
    setMidiLearnActiveControl,
    midiMappings,
    setMidiMapping,
    removeMidiMapping,
    addToast,
    addClip,
  } = useStore();

  // Bridge Pad -> Clip (Phase 3) : lecture tolérante du playhead courant.
  const playheadMs = useStore((s) => s.playheadMs);

  // A5 contract: flash actions read with tolerant cast (provided by logic agent).
  const flashActions = useStore(
    (s) =>
      s as unknown as {
        setPadFlash?: (sceneId: number, flash: boolean) => void;
        flashPadOn?: (sceneId: number) => void;
        flashPadOff?: (sceneId: number) => void;
      },
  );
  const setPadFlash = flashActions.setPadFlash;
  const flashPadOn = flashActions.flashPadOn;
  const flashPadOff = flashActions.flashPadOff;

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextState>(null);
  const [template, setTemplate] = useState<"mariage" | "club" | "livevj">("mariage");
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(SCENE_COLORS[0]);
  const [formIcon, setFormIcon] = useState("Zap");
  const [formMidiNote, setFormMidiNote] = useState(-1);
  const [formMidiChannel, setFormMidiChannel] = useState(1);
  const menuRef = useRef<HTMLDivElement>(null);
  // Source de vérité unique : isLive (uiSlice). Les props variant/readonly
  // restent en FALLBACK pour ne rien casser si le parent ne route pas encore.
  // live === "scène en lecture-seule / performance".
  const isLive = useStore((s) => s.isLive);
  // isPerformance pilote le LAYOUT, isReadOnly pilote l'édition.
  // Les deux dérivés d'origine (variant==="performance" / readonly) sont
  // entièrement couverts par `live` (qui les inclut en fallback).
  const isPerformance = isLive || variant === "performance";
  const isReadOnly = isLive || variant === "performance" || readonly;
  const effectiveEditMode = !isReadOnly && smartEditMode;
  const activePadViewMode = isPerformance ? "visual" : smartPadViewMode;

  const padsBySlot = useMemo(() => {
    const map = new Map<string, SmartPad>();
    smartPads.forEach((pad) => map.set(`${pad.page}:${pad.slot}`, pad));
    return map;
  }, [smartPads]);

  useEffect(() => {
    document.documentElement.style.setProperty("--bpm-pulse-duration", `${Math.max(0.2, 60 / Math.max(1, bpm))}s`);
  }, [bpm]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const openCreateModal = (page: number, slot: number) => {
    setEditing({ mode: "create", page, slot, pad: null });
    setFormName(`Scene P${page + 1}.${slot + 1}`);
    setFormColor(SCENE_COLORS[0]);
    setFormIcon("Zap");
    setFormMidiNote(-1);
    setFormMidiChannel(1);
  };

  const openEditModal = (pad: SmartPad) => {
    setEditing({ mode: "edit", page: pad.page, slot: pad.slot, pad });
    setFormName(pad.name);
    setFormColor(SCENE_COLORS.find((color) => color.bg === pad.color) || SCENE_COLORS[0]);
    setFormIcon(pad.iconName);
    setFormMidiNote(pad.midiNote);
    setFormMidiChannel(pad.midiChannel);
  };

  const savePad = () => {
    if (!editing || !formName.trim()) return;
    const midiChannel = Math.max(1, Math.min(16, Math.round(formMidiChannel)));
    const midiNote = Math.max(-1, Math.min(127, Math.round(formMidiNote)));
    const payload = {
      name: formName.trim(),
      color: formColor.bg,
      textColor: formColor.text,
      iconName: formIcon,
      midiNote,
      midiChannel,
      page: editing.page,
      slot: editing.slot,
    };

    if (editing.mode === "edit" && editing.pad) {
      updateSmartPad(editing.pad.id, payload);
    } else {
      addSmartPad({
        id: Date.now(),
        qlcPage: 1,
        qlcWidget: 80 + editing.page * 16 + editing.slot,
        dmxValues: {},
        gridCol: editing.slot % 4,
        gridRow: Math.floor(editing.slot / 4),
        gridW: 1,
        gridH: 1,
        ...payload,
      });
    }

    const controlId = padControlId(editing.page, editing.slot);
    if (midiNote >= 0) {
      setMidiMapping(controlId, { type: 144, channel: midiChannel - 1, data1: midiNote });
    } else {
      removeMidiMapping(controlId);
    }
    setEditing(null);
  };

  const duplicatePad = (pad: SmartPad) => {
    const slot = firstFreeSlot(smartPads, pad.page);
    if (slot === null) {
      addToast({ type: "warning", message: "Page pleine", detail: "Choisis une autre page pour dupliquer cette scene." });
      return;
    }
    addSmartPad({
      ...pad,
      id: Date.now(),
      name: `${pad.name} copie`,
      qlcWidget: 80 + pad.page * 16 + slot,
      page: pad.page,
      slot,
      midiNote: -1,
    });
    setContextMenu(null);
  };

  const deletePad = (pad: SmartPad) => {
    if (showLock) {
      addToast({ type: "error", message: "Show Lock actif", detail: "Desactive le verrou pour supprimer une scene." });
      return;
    }
    if (!window.confirm(`Supprimer la scene "${pad.name}" ?`)) return;
    deleteSmartPad(pad.id);
    removeMidiMapping(padControlId(pad.page, pad.slot));
    setContextMenu(null);
  };

  const startLearnForPad = (pad: SmartPad) => {
    setMidiLearnMode(true);
    setMidiLearnActiveControl(padControlId(pad.page, pad.slot));
    setContextMenu(null);
  };

  const sendPadToTimeline = (pad: SmartPad) => {
    const startTime = Number.isFinite(playheadMs) ? Math.max(0, Math.round(playheadMs)) : 0;
    addClip({ id: `pad-${pad.id}-${Date.now()}`, ...padToClip(pad, { startTime }) });
    addToast({ type: "success", message: "Pad envoyé vers la timeline", detail: pad.name });
    setContextMenu(null);
  };

  const handlePadClick = (pad: SmartPad) => {
    if (midiLearnMode) {
      setMidiLearnActiveControl(padControlId(pad.page, pad.slot));
      return;
    }
    triggerSmartPad(pad);
  };

  const handleTemplate = () => {
    const hasPadsOnPage = smartPads.some((pad) => pad.page === activePadPage);
    if (hasPadsOnPage && !window.confirm(`Remplacer les 16 pads de la page P${activePadPage + 1} ?`)) return;
    applyPadTemplate(template, activePadPage);
    addToast({ type: "success", message: "Scenes generees", detail: `Page P${activePadPage + 1}` });
  };

  return (
    <div className={isPerformance ? "flex h-full min-h-0 flex-col" : variant === "widget" ? "flex min-h-[540px] flex-col" : "flex h-full min-h-0 flex-col"}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          Scenes live
        </h2>
        {!isPerformance && <div className="flex rounded-lg border border-white/5 bg-black/35 p-0.5" role="tablist" aria-label="Vue scenes">
          {(["visual", "midi"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={smartPadViewMode === mode}
              onClick={() => setSmartPadViewMode(mode)}
              className={`rounded-md px-2 py-1 text-[9px] font-black uppercase transition-colors ${
                smartPadViewMode === mode ? "bg-cyan-500/20 text-cyan-300" : "text-slate-500 hover:text-white"
              }`}
            >
              {mode === "visual" ? "Visuel" : "MIDI"}
            </button>
          ))}
        </div>}
      </div>

      <div className={isPerformance ? "flex shrink-0 gap-2 border-b border-white/5 px-4 py-3" : "flex shrink-0 gap-1 border-b border-white/5 px-3 py-2"} role="tablist" aria-label="Pages scenes">
        {PAGES.map((page) => {
          const hasActive = smartPads.some((pad) => pad.page === page && smartActiveScene === pad.qlcWidget);
          return (
            <button
              key={page}
              type="button"
              role="tab"
              aria-selected={activePadPage === page}
              onClick={() => setActivePadPage(page)}
              onDragOver={(event) => effectiveEditMode && event.preventDefault()}
              onDrop={(event) => {
                if (!effectiveEditMode) return;
                event.preventDefault();
                const padId = Number(event.dataTransfer.getData("text/plain"));
                const slot = firstFreeSlot(smartPads, page);
                if (padId && slot !== null) movePad(padId, page, slot);
              }}
              className={`relative flex-1 rounded-lg border ${isPerformance ? "px-3 py-2 text-xs" : "px-2 py-1.5 text-[10px]"} font-black transition-all ${
                activePadPage === page
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                  : "border-white/5 bg-black/25 text-slate-500 hover:text-white"
              }`}
            >
              P{page + 1}
              {hasActive && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300" />}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
        {activePadViewMode === "visual" ? (
          <div className={isPerformance ? "scene-pads-grid grid grid-cols-4 gap-3 transition-opacity duration-150 sm:gap-4" : "scene-pads-grid grid grid-cols-4 gap-2 transition-opacity duration-150"}>
            {SLOTS.map((slot) => {
              const pad = padsBySlot.get(`${activePadPage}:${slot}`);
              return pad ? (
                <ScenePad
                  key={pad.id}
                  pad={pad}
                  active={smartActiveScene === pad.qlcWidget}
                  learning={midiLearnMode && midiLearnActiveControl === padControlId(pad.page, pad.slot)}
                  mapping={midiMappings[padControlId(pad.page, pad.slot)]}
                  editMode={effectiveEditMode}
                  readonly={isReadOnly}
                  performance={isPerformance}
                  flash={pad.flash === true && !midiLearnMode}
                  onFlashOn={() => flashPadOn?.(pad.id)}
                  onFlashOff={() => flashPadOff?.(pad.id)}
                  onClick={() => handlePadClick(pad)}
                  onEdit={() => openEditModal(pad)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!isReadOnly) setContextMenu({ pad, x: event.clientX, y: event.clientY });
                  }}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(pad.id))}
                  onDrop={(event) => {
                    event.preventDefault();
                    const padId = Number(event.dataTransfer.getData("text/plain"));
                    if (padId) movePad(padId, activePadPage, slot);
                  }}
                />
              ) : (
                <button
                  key={`empty-${slot}`}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && openCreateModal(activePadPage, slot)}
                  onDragOver={(event) => effectiveEditMode && event.preventDefault()}
                  onDrop={(event) => {
                    if (!effectiveEditMode) return;
                    event.preventDefault();
                    const padId = Number(event.dataTransfer.getData("text/plain"));
                    if (padId) movePad(padId, activePadPage, slot);
                  }}
                  className={`${isPerformance ? "min-h-[108px] sm:min-h-[132px] lg:min-h-[150px]" : "min-h-16"} flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-700 bg-black/20 text-slate-600 transition-colors ${isReadOnly ? "cursor-default opacity-45" : "hover:border-cyan-500/40 hover:text-cyan-300"}`}
                  aria-label={`Creer scene P${activePadPage + 1}.${slot + 1}`}
                >
                  <Plus className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-black/30 p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {MIDI_ROWS.map((row) =>
                MIDI_COLS.map((col) => {
                  const globalSlot = row * 8 + col;
                  const page = Math.floor(globalSlot / 16);
                  const slot = globalSlot % 16;
                  const pad = padsBySlot.get(`${page}:${slot}`);
                  const active = Boolean(pad && smartActiveScene === pad.qlcWidget);
                  return (
                    <button
                      key={globalSlot}
                      type="button"
                      onClick={() => pad && handlePadClick(pad)}
                      className={`flex h-7 items-center justify-center rounded border text-[8px] font-mono font-black transition-all ${
                        page === activePadPage ? "border-cyan-500/60" : "border-white/10"
                      } ${active ? "bg-cyan-400 text-black shadow-[0_0_14px_rgba(6,182,212,0.45)]" : pad ? `${pad.color} text-white` : "bg-[#0a0c10] text-slate-700"}`}
                      title={pad ? pad.name : `P${page + 1}.${slot + 1}`}
                    >
                      {midiMappings[padControlId(page, slot)]?.data1 ?? globalSlot}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        )}
      </div>

      {!isPerformance && <div className="shrink-0 space-y-2 border-t border-white/5 p-3">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">MIDI Learn</span>
          <button
            type="button"
            onClick={() => setMidiLearnMode(!midiLearnMode)}
            className={`rounded-lg border px-2 py-1 text-[10px] font-black transition-colors ${
              midiLearnMode ? "border-blue-500/40 bg-blue-500/15 text-blue-300" : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {midiLearnMode ? "ON" : "Activer"}
          </button>
        </div>
        {midiLearnMode && (
          <p className="text-[10px] font-semibold leading-relaxed text-slate-500">
            Clique un pad puis appuie sur une touche MIDI.
          </p>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as "mariage" | "club" | "livevj")}
            className="min-h-9 rounded-xl border border-white/10 bg-black/35 px-2 text-[11px] font-bold text-slate-200 outline-none"
          >
            <option value="mariage">Mariage</option>
            <option value="club">Club / DJ</option>
            <option value="livevj">Live / VJ</option>
          </select>
          <button
            type="button"
            onClick={handleTemplate}
            className="min-h-9 rounded-xl bg-cyan-500 px-3 text-[10px] font-black text-black transition-colors hover:bg-cyan-400"
          >
            Generer
          </button>
        </div>
      </div>}

      {contextMenu && !isReadOnly && (
        <div
          ref={menuRef}
          className="fixed z-[160] w-44 rounded-xl border border-white/10 bg-[#12141A] p-1.5 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <MenuItem icon={<Edit2 className="h-3.5 w-3.5" />} label="Editer" onClick={() => { openEditModal(contextMenu.pad); setContextMenu(null); }} />
          <MenuItem icon={<Copy className="h-3.5 w-3.5" />} label="Dupliquer" onClick={() => duplicatePad(contextMenu.pad)} />
          <MenuItem icon={<Music2 className="h-3.5 w-3.5" />} label="Assigner MIDI" onClick={() => startLearnForPad(contextMenu.pad)} />
          <MenuItem icon={<ArrowRight className="h-3.5 w-3.5" />} label="Envoyer vers Timeline" onClick={() => sendPadToTimeline(contextMenu.pad)} />
          <MenuItem danger icon={<Trash2 className="h-3.5 w-3.5" />} label="Supprimer" onClick={() => deletePad(contextMenu.pad)} />
        </div>
      )}

      {editing && !isReadOnly && (
        <PadConfigModal
          name={formName}
          setName={setFormName}
          color={formColor}
          setColor={setFormColor}
          icon={formIcon}
          setIcon={setFormIcon}
          midiNote={formMidiNote}
          setMidiNote={setFormMidiNote}
          midiChannel={formMidiChannel}
          setMidiChannel={setFormMidiChannel}
          onSave={savePad}
          onClose={() => setEditing(null)}
          onDelete={editing.pad ? () => deletePad(editing.pad as SmartPad) : undefined}
          sceneId={editing.pad ? String(editing.pad.id) : undefined}
          flash={editing.pad?.flash === true}
          onToggleFlash={editing.pad ? (value) => setPadFlash?.(editing.pad!.id, value) : undefined}
          onSendToTimeline={editing.pad ? () => { sendPadToTimeline(editing.pad as SmartPad); setEditing(null); } : undefined}
        />
      )}
    </div>
  );
}

function ScenePad({
  pad,
  active,
  learning,
  mapping,
  editMode,
  readonly,
  performance,
  flash,
  onFlashOn,
  onFlashOff,
  onClick,
  onEdit,
  onContextMenu,
  onDragStart,
  onDrop,
}: {
  pad: SmartPad;
  active: boolean;
  learning: boolean;
  mapping?: { data1: number };
  editMode: boolean;
  readonly: boolean;
  performance: boolean;
  flash: boolean;
  onFlashOn: () => void;
  onFlashOff: () => void;
  onClick: () => void;
  onEdit: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}) {
  const [holding, setHolding] = useState(false);
  const isFlashMode = flash && !readonly;
  const handleFlashOn = () => {
    if (!isFlashMode) return;
    setHolding(true);
    onFlashOn();
  };
  const handleFlashOff = () => {
    if (!isFlashMode) return;
    if (!holding) return;
    setHolding(false);
    onFlashOff();
  };
  return (
    <div
      role="button"
      aria-label={`Scene ${pad.name}`}
      aria-pressed={active}
      data-testid="scene-pad"
      tabIndex={0}
      draggable={!readonly && editMode}
      onDragStart={(event) => {
        if (readonly || !editMode) {
          event.preventDefault();
          return;
        }
        onDragStart(event);
      }}
      onDragOver={(event) => !readonly && editMode && event.preventDefault()}
      onDrop={(event) => {
        if (readonly || !editMode) return;
        onDrop(event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!readonly) onContextMenu(event);
      }}
      onClick={isFlashMode ? undefined : onClick}
      onPointerDown={isFlashMode ? handleFlashOn : undefined}
      onPointerUp={isFlashMode ? handleFlashOff : undefined}
      onPointerLeave={isFlashMode ? handleFlashOff : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (isFlashMode) {
          if (!event.repeat) handleFlashOn();
        } else {
          onClick();
        }
      }}
      onKeyUp={(event) => {
        if (isFlashMode && (event.key === "Enter" || event.key === " ")) handleFlashOff();
      }}
      className={`group relative flex aspect-square ${performance ? "min-h-[108px] p-3 sm:min-h-[132px] lg:min-h-[150px]" : "min-h-16 p-2"} ${isFlashMode ? "touch-none select-none" : ""} cursor-pointer flex-col justify-end overflow-hidden rounded-xl border transition-all ${
        learning
          ? "border-blue-400 bg-blue-500/20 shadow-[0_0_18px_rgba(59,130,246,0.55)] animate-pulse"
          : holding
            ? "ring-2 ring-amber-300 border-amber-200 shadow-[0_0_22px_rgba(251,191,36,0.5)] scale-95"
            : active
              ? "ring-2 ring-cyan-400 border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-[pulse_var(--bpm-pulse-duration)_ease-in-out_infinite]"
              : "border-white/10 hover:border-cyan-500/35"
      }`}
    >
      <div className={`absolute inset-0 ${pad.color} ${active ? "opacity-35" : "opacity-25"}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      {mapping && (
        <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-black text-blue-200">
          MIDI {mapping.data1}
        </span>
      )}
      {pad.flash === true && (
        <span
          className={`absolute ${mapping ? "right-1.5 top-6" : "right-1.5 top-1.5"} flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-black text-amber-300`}
          title="Flash (momentane)"
        >
          <Zap className="h-2.5 w-2.5" />
        </span>
      )}
      {editMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="absolute left-1.5 top-1.5 rounded bg-black/60 p-1 text-slate-300 opacity-0 transition-opacity hover:text-cyan-300 group-hover:opacity-100"
          title="Editer"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      )}
      <div className={`relative mb-1 ${pad.textColor} ${performance ? "scale-125 origin-bottom-left" : ""}`}>{ICONS[pad.iconName] || <Zap className="h-6 w-6" />}</div>
      <p className={`relative truncate font-black leading-tight text-white ${performance ? "text-sm" : "text-[10px]"}`}>{pad.name}</p>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-colors ${
        danger ? "text-red-300 hover:bg-red-500/10" : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PadConfigModal({
  name,
  setName,
  color,
  setColor,
  icon,
  setIcon,
  midiNote,
  setMidiNote,
  midiChannel,
  setMidiChannel,
  onSave,
  onClose,
  onDelete,
  sceneId,
  flash,
  onToggleFlash,
  onSendToTimeline,
}: {
  name: string;
  setName: (name: string) => void;
  color: (typeof SCENE_COLORS)[number];
  setColor: (color: (typeof SCENE_COLORS)[number]) => void;
  icon: string;
  setIcon: (icon: string) => void;
  midiNote: number;
  setMidiNote: (note: number) => void;
  midiChannel: number;
  setMidiChannel: (channel: number) => void;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  sceneId?: string;
  flash?: boolean;
  onToggleFlash?: (value: boolean) => void;
  onSendToTimeline?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12141A] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Scene</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Nom</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-500/50"
        />
        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Couleur</label>
        <div className="mb-4 grid grid-cols-8 gap-2">
          {SCENE_COLORS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setColor(item)}
              className={`h-8 rounded-lg ${item.bg} ${color.label === item.label ? "ring-2 ring-white ring-offset-2 ring-offset-[#12141A]" : "opacity-70"}`}
            >
              {color.label === item.label && <Check className="mx-auto h-4 w-4 text-black" />}
            </button>
          ))}
        </div>
        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Icone</label>
        <div className="mb-4 grid grid-cols-6 gap-2">
          {Object.keys(ICONS).map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => setIcon(iconName)}
              className={`flex h-10 items-center justify-center rounded-xl border ${
                icon === iconName ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-white/5 bg-black/30 text-slate-500"
              }`}
            >
              {ICONS[iconName]}
            </button>
          ))}
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Note MIDI</label>
            <input
              type="number"
              min={-1}
              max={127}
              value={midiNote}
              onChange={(event) => setMidiNote(Number(event.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-mono text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Canal</label>
            <input
              type="number"
              min={1}
              max={16}
              value={midiChannel}
              onChange={(event) => setMidiChannel(Number(event.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-mono text-white outline-none"
            />
          </div>
        </div>
        {onToggleFlash && (
          <button
            type="button"
            onClick={() => onToggleFlash(!flash)}
            aria-pressed={flash === true}
            className={`mb-5 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
              flash ? "border-amber-400/40 bg-amber-500/10" : "border-white/5 bg-black/30 hover:border-white/15"
            }`}
          >
            <span className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${flash ? "text-amber-300" : "text-slate-500"}`} />
              <span className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Flash (momentane)</span>
                <span className="text-[9px] font-semibold text-slate-500">Actif tant que le pad est maintenu</span>
              </span>
            </span>
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${flash ? "bg-amber-400" : "bg-slate-600"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${flash ? "left-4" : "left-0.5"}`}
              />
            </span>
          </button>
        )}
        {sceneId && (
          <div className="mb-5 max-h-72 overflow-hidden rounded-xl border border-white/5">
            <SceneMaskEditor sceneId={sceneId} />
          </div>
        )}
        {onSendToTimeline && (
          <button
            type="button"
            onClick={onSendToTimeline}
            title="Créer un clip Timeline depuis ce pad"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-xs font-black text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            <ArrowRight className="h-4 w-4" />
            Envoyer vers Timeline
          </button>
        )}
        <div className="flex gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete} className="rounded-xl border border-red-500/30 px-3 text-red-300 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-black text-slate-400 hover:bg-white/5">
            Annuler
          </button>
          <button type="button" onClick={onSave} disabled={!name.trim()} className="flex-1 rounded-xl bg-cyan-500 py-3 text-xs font-black text-black hover:bg-cyan-400 disabled:opacity-50">
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
