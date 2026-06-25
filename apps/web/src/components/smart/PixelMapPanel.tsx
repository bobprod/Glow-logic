"use client";

import React, { useMemo, useRef } from "react";
import { Grid3x3, Power, Sparkles, Type, ImageIcon, Video, X, Monitor } from "lucide-react";
import useStore from "../../store/useStore";
import {
  DEFAULT_PIXELMAP_CONFIG,
  type PixelEffectType,
  type PixelMapConfig,
} from "../../lib/pixelMapEngine";
import PixelMapProjector from "./PixelMapProjector";

const ACCENT = "#22d3ee"; // cyan-400

const EFFECT_TYPES: { value: PixelEffectType; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "sweep", label: "Sweep" },
  { value: "pulse", label: "Pulse" },
  { value: "rainbow", label: "Rainbow" },
];

interface PixelMapState extends PixelMapConfig {
  enabled: boolean;
}

const RGB_TYPES = new Set(["red", "green", "blue"]);

function hasRgbChannels(fixture: any): boolean {
  const channels = Array.isArray(fixture?.channels) ? fixture.channels : [];
  return channels.some((ch: any) => RGB_TYPES.has(String(ch?.type || "").toLowerCase()));
}

export default function PixelMapPanel(): React.JSX.Element {
  // Tolerant access: the slice may not be fully typed during isolated compilation.
  const store = useStore() as any;

  const pixelMap: PixelMapState =
    (store?.pixelMap as PixelMapState) ?? { enabled: false, ...DEFAULT_PIXELMAP_CONFIG };
  const setPixelMapEnabled: (v: boolean) => void =
    store?.setPixelMapEnabled ?? (() => {});
  const setPixelMapConfig: (patch: Partial<PixelMapConfig>) => void =
    store?.setPixelMapConfig ?? (() => {});
  const setProjectorOpen: (v: boolean) => void =
    store?.setProjectorOpen ?? (() => {});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const fixtures = useStore((s) => s.fixtures);

  const rgbCount = useMemo<number>(() => {
    const list = Array.isArray(fixtures) ? (fixtures as any[]) : [];
    return list.filter(hasRgbChannels).length;
  }, [fixtures]);

  const enabled = !!pixelMap.enabled;
  const cfg: PixelMapConfig = {
    type: pixelMap.type ?? DEFAULT_PIXELMAP_CONFIG.type,
    colorA: pixelMap.colorA ?? DEFAULT_PIXELMAP_CONFIG.colorA,
    colorB: pixelMap.colorB ?? DEFAULT_PIXELMAP_CONFIG.colorB,
    speed: pixelMap.speed ?? DEFAULT_PIXELMAP_CONFIG.speed,
    text: pixelMap.text ?? "",
    imageUrl: pixelMap.imageUrl ?? "",
    videoUrl: pixelMap.videoUrl ?? "",
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPixelMapConfig({ imageUrl: url });
    // Allow re-selecting the same file later.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearImage = () => {
    setPixelMapConfig({ imageUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPixelMapConfig({ videoUrl: url });
    // Allow re-selecting the same file later.
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const clearVideo = () => {
    setPixelMapConfig({ videoUrl: "" });
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-[#090b0e] p-3 text-slate-300">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-cyan-400" />
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Pixel Mapping</h2>
          {rgbCount > 0 && (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              {rgbCount} RGB
            </span>
          )}
        </div>
        <button
          onClick={() => setPixelMapEnabled(!enabled)}
          title={enabled ? "Desactiver" : "Activer"}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors"
          style={{
            borderColor: enabled ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.06)",
            background: enabled ? "rgba(34,211,238,0.1)" : "rgba(0,0,0,0.25)",
            color: enabled ? ACCENT : "#94a3b8",
          }}
        >
          <Power className="h-3.5 w-3.5" />
          {enabled ? "Active" : "Inactif"}
        </button>
      </header>

      {rgbCount === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
          <Sparkles className="h-8 w-8 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">Aucune fixture RGB</p>
          <p className="max-w-[220px] text-[11px] text-slate-500">
            Ajoute des projecteurs avec des canaux rouge/vert/bleu pour utiliser le pixel mapping.
          </p>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Effet
          </span>
          <div className="grid grid-cols-4 gap-1">
            {EFFECT_TYPES.map((t) => {
              const active = cfg.type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setPixelMapConfig({ type: t.value })}
                  className="rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors"
                  style={{
                    borderColor: active ? ACCENT : "rgba(255,255,255,0.06)",
                    background: active ? "rgba(34,211,238,0.12)" : "rgba(0,0,0,0.25)",
                    color: active ? ACCENT : "#94a3b8",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Couleur A
            </span>
            <input
              type="color"
              value={cfg.colorA}
              onChange={(e) => setPixelMapConfig({ colorA: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40 p-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Couleur B
            </span>
            <input
              type="color"
              value={cfg.colorB}
              onChange={(e) => setPixelMapConfig({ colorB: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40 p-1"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Vitesse</span>
            <span className="font-mono text-cyan-300">{cfg.speed.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={4}
            step={0.01}
            value={cfg.speed}
            onChange={(e) => setPixelMapConfig({ speed: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/40 accent-cyan-400"
            style={{ accentColor: ACCENT }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Type className="h-3 w-3" />
            Texte (calque)
          </span>
          <input
            type="text"
            value={cfg.text ?? ""}
            onChange={(e) => setPixelMapConfig({ text: e.target.value })}
            placeholder="Texte affiche sur le projecteur..."
            className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <ImageIcon className="h-3 w-3" />
            Image (calque)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageFile}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {cfg.imageUrl ? "Remplacer l'image" : "Charger une image"}
            </button>
            {cfg.imageUrl && (
              <button
                type="button"
                onClick={clearImage}
                title="Retirer l'image"
                className="flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {cfg.imageUrl && (
            <p className="truncate text-[10px] text-slate-500" title={cfg.imageUrl}>
              Image chargee
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Video className="h-3 w-3" />
            Video (calque)
          </span>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoFile}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
            >
              <Video className="h-3.5 w-3.5" />
              {cfg.videoUrl ? "Remplacer la video" : "Charger une video"}
            </button>
            {cfg.videoUrl && (
              <button
                type="button"
                onClick={clearVideo}
                title="Retirer la video"
                className="flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {cfg.videoUrl && (
            <p className="truncate text-[10px] text-slate-500" title={cfg.videoUrl}>
              Video chargee
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setProjectorOpen(true)}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
          style={{
            borderColor: "rgba(34,211,238,0.4)",
            background: "rgba(34,211,238,0.1)",
            color: ACCENT,
          }}
        >
          <Monitor className="h-4 w-4" />
          Projecteur
        </button>
      </div>

      <PixelMapProjector />
    </div>
  );
}
