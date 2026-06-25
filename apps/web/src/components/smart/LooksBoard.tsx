"use client";

import React from "react";
import {
  Activity,
  AudioLines,
  Droplets,
  Eye,
  Flame,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import useStore, { type SmartPad } from "../../store/useStore";

const ICONS: Record<string, React.ReactNode> = {
  Droplets: <Droplets className="h-5 w-5" />,
  Flame: <Flame className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  AudioLines: <AudioLines className="h-5 w-5" />,
};

export type LooksBoardProps = {
  onCreateWithAi?: () => void;
};

const SLOTS_PER_PAGE = 16;

function channelCount(pad: SmartPad): number {
  return pad.enabledChannels?.length ?? Object.keys(pad.dmxValues ?? {}).length;
}

function firstFreeSlot(pads: SmartPad[]): { page: number; slot: number } {
  for (let page = 0; page < 4; page += 1) {
    for (let slot = 0; slot < SLOTS_PER_PAGE; slot += 1) {
      if (!pads.some((pad) => pad.page === page && pad.slot === slot)) {
        return { page, slot };
      }
    }
  }
  return { page: 0, slot: 0 };
}

export default function LooksBoard({ onCreateWithAi }: LooksBoardProps) {
  const smartPads = useStore((s) => s.smartPads);
  const smartActiveScene = useStore((s) => s.smartActiveScene);
  const triggerSmartPad = useStore((s) => s.triggerSmartPad);
  const addSmartPad = useStore((s) => s.addSmartPad);
  const deleteSmartPad = useStore((s) => s.deleteSmartPad);
  const addToast = useStore((s) => s.addToast);

  const handleCreate = () => {
    if (onCreateWithAi) {
      onCreateWithAi();
      return;
    }
    const { page, slot } = firstFreeSlot(smartPads);
    addSmartPad({
      id: Date.now(),
      name: `Look ${smartPads.length + 1}`,
      color: "bg-cyan-500",
      textColor: "text-cyan-400",
      iconName: "Zap",
      qlcPage: 1,
      qlcWidget: 80 + page * SLOTS_PER_PAGE + slot,
      dmxValues: {},
      midiNote: -1,
      midiChannel: 1,
      gridCol: slot % 4,
      gridRow: Math.floor(slot / 4),
      gridW: 1,
      gridH: 1,
      page,
      slot,
    });
    addToast({ type: "success", message: "Nouveau look", detail: "Look ajoute au tableau." });
  };

  const handleDelete = (pad: SmartPad) => {
    if (!window.confirm(`Supprimer le look "${pad.name}" ?`)) return;
    deleteSmartPad(pad.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
          <Sparkles className="h-4 w-4 text-purple-400" />
          Tes Looks
        </h2>
        <span className="text-[9px] font-semibold text-slate-500">
          ce que PERFORM jouera · synchronisé
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
          {smartPads.map((pad) => {
            const active = smartActiveScene === pad.qlcWidget;
            const channels = channelCount(pad);
            return (
              <div
                key={pad.id}
                className={`group relative flex flex-col overflow-hidden rounded-lg border bg-black/30 transition-all ${
                  active
                    ? "border-cyan-400/60 ring-1 ring-cyan-400/40 shadow-[0_0_18px_rgba(6,182,212,0.25)]"
                    : "border-white/5 hover:border-purple-500/35"
                }`}
              >
                <div className={`relative h-12 ${pad.color}`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className={`absolute left-2 top-2 ${pad.textColor}`}>
                    {ICONS[pad.iconName] ?? <Zap className="h-5 w-5" />}
                  </div>
                  {active && (
                    <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-cyan-200">
                      actif
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 p-2">
                  <p className="truncate text-xs font-medium text-white">{pad.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {channels} canal{channels === 1 ? "" : "x"}
                  </p>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/85 to-transparent p-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => triggerSmartPad(pad)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-bold text-slate-200 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
                    title="Auditionner ce look"
                  >
                    <Eye className="h-3 w-3" />
                    Aperçu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pad)}
                    className="flex items-center justify-center rounded-md border border-red-500/20 bg-black/50 px-2 py-1 text-red-300 transition-colors hover:bg-red-500/10"
                    title="Supprimer ce look"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleCreate}
            className="flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-black/20 text-slate-500 transition-colors hover:border-purple-500/40 hover:text-purple-300"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[10px] font-bold">+ Nouveau look</span>
          </button>
        </div>
      </div>
    </div>
  );
}
