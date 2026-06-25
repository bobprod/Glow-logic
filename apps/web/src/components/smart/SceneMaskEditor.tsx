"use client";

import React, { useMemo } from "react";
import { CheckSquare, Eye, EyeOff, Square } from "lucide-react";
import useStore from "../../store/useStore";
import type { SmartPad } from "../../store/slices/smartModeSlice";

const ACCENT = "#22d3ee"; // cyan-400

/**
 * Signature des actions de "channel masking" exposees par la slice qui possede
 * les scenes (smartModeSlice). On accede a ces actions via un cast tolerant afin
 * que ce composant compile seul, meme si la slice ne les a pas encore typees.
 */
type MaskActions = {
  setSceneMask?: (sceneId: number, channels: number[]) => void;
  clearSceneMask?: (sceneId: number) => void;
  toggleSceneChannel?: (sceneId: number, channel: number) => void;
};

/** Derive l'ensemble des canaux representes par une scene (dmxValues + dmxCommands). */
function deriveSceneChannels(pad: SmartPad | undefined): number[] {
  if (!pad) return [];
  const channels = new Set<number>();
  if (pad.dmxValues) {
    for (const key of Object.keys(pad.dmxValues)) {
      const ch = Number(key);
      if (Number.isFinite(ch)) channels.add(ch);
    }
  }
  if (Array.isArray(pad.dmxCommands)) {
    for (const cmd of pad.dmxCommands) {
      const ch = Number(cmd?.channel);
      if (Number.isFinite(ch)) channels.add(ch);
    }
  }
  return Array.from(channels)
    .filter((ch) => ch >= 1 && ch <= 512)
    .sort((a, b) => a - b);
}

/** Derive les canaux DMX absolus a partir de la selection de projecteurs courante. */
function useSelectionChannels(): number[] {
  const fixtures = useStore((s) => s.fixtures);
  const selectedFixtureIds = useStore((s) => s.selectedFixtureIds);
  const selectedFixtureId = useStore((s) => s.selectedFixtureId);

  return useMemo<number[]>(() => {
    const ids = new Set<string>(selectedFixtureIds);
    if (selectedFixtureId) ids.add(selectedFixtureId);
    if (ids.size === 0) return [];

    const channels: number[] = [];
    for (const fixture of fixtures as any[]) {
      const nodeId: string = fixture?.nodeId || `fixture-${fixture?.id}`;
      if (!ids.has(nodeId)) continue;
      const start = Number(fixture?.startAddress || fixture?.start_address || 1);
      const fixtureChannels = Array.isArray(fixture?.channels) ? fixture.channels : [];
      if (fixtureChannels.length > 0) {
        for (const ch of fixtureChannels) {
          const offset = Number(ch?.channel || 1);
          channels.push(start + offset - 1);
        }
      } else {
        channels.push(start);
      }
    }
    return Array.from(new Set(channels))
      .filter((ch) => ch >= 1 && ch <= 512)
      .sort((a, b) => a - b);
  }, [fixtures, selectedFixtureIds, selectedFixtureId]);
}

export default function SceneMaskEditor({ sceneId }: { sceneId: string }): React.JSX.Element {
  const smartPads = useStore((s) => s.smartPads);
  // Acces tolerant aux actions de masking (ajoutees par l'agent store).
  const setSceneMask = useStore((s) => (s as unknown as MaskActions).setSceneMask);
  const clearSceneMask = useStore((s) => (s as unknown as MaskActions).clearSceneMask);
  const toggleSceneChannel = useStore((s) => (s as unknown as MaskActions).toggleSceneChannel);

  const selectionChannels = useSelectionChannels();

  const pad = useMemo<SmartPad | undefined>(
    () => smartPads.find((p) => String(p.id) === String(sceneId)),
    [smartPads, sceneId]
  );
  // Les actions du store matchent un id numerique ; la prop arrive en string.
  const numericSceneId = Number(sceneId);

  const sceneChannels = useMemo(() => deriveSceneChannels(pad), [pad]);

  // enabledChannels: undefined/absent => tous appliques ; [] => aucun.
  const enabled = pad?.enabledChannels;
  const maskActive = Array.isArray(enabled);
  const enabledSet = useMemo(
    () => (Array.isArray(enabled) ? new Set<number>(enabled) : null),
    [enabled]
  );

  const isChannelEnabled = (ch: number): boolean => (enabledSet ? enabledSet.has(ch) : true);

  // ----- Empty states -----
  if (!pad) {
    return (
      <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
        <EyeOff className="h-8 w-8 text-slate-600" />
        <p className="text-sm font-semibold text-slate-400">Scene introuvable</p>
        <p className="max-w-[220px] text-[11px] text-slate-500">
          Aucune scene ne correspond a l&apos;identifiant fourni.
        </p>
      </div>
    );
  }

  const enabledCount = maskActive ? (enabled as number[]).filter((ch) => ch >= 1 && ch <= 512).length : sceneChannels.length;

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-[#090b0e] p-3 text-slate-300">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0 text-cyan-400" />
          <h2 className="truncate text-xs font-black uppercase tracking-widest text-white">
            Masque de canaux
          </h2>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={
            maskActive
              ? { background: "rgba(34,211,238,0.12)", color: ACCENT }
              : { background: "rgba(255,255,255,0.06)", color: "#94a3b8" }
          }
        >
          {maskActive ? `${enabledCount} actif(s)` : "Tous"}
        </span>
      </header>

      <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-1.5 text-[10px] text-slate-500">
        {maskActive ? (
          <>
            Seuls les canaux actifs seront appliques au chargement. Les canaux
            masques conservent leur valeur courante (tracking).
          </>
        ) : (
          <>Aucun masque : tous les canaux de la scene s&apos;appliquent (comportement par defaut).</>
        )}
      </div>

      {/* ----- Macros ----- */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setSceneMask?.(numericSceneId, [])}
          title="Masquer tous les canaux"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-black/25 px-2 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-white/20"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Tout desactiver
        </button>
        <button
          onClick={() => clearSceneMask?.(numericSceneId)}
          title="Activer tous les canaux (supprime le masque)"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-black/25 px-2 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-white/20"
        >
          <Eye className="h-3.5 w-3.5" />
          Tout activer
        </button>
        <button
          onClick={() => {
            if (selectionChannels.length > 0) setSceneMask?.(numericSceneId, selectionChannels);
          }}
          disabled={selectionChannels.length === 0}
          title={
            selectionChannels.length > 0
              ? `Activer ${selectionChannels.length} canal(aux) de la selection`
              : "Selectionne des projecteurs d'abord"
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(34,211,238,0.4)", background: "rgba(34,211,238,0.1)", color: "#a5f3fc" }}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Activer selection
        </button>
      </div>

      {selectionChannels.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-1.5 text-[10px] text-slate-500">
          Selection: {selectionChannels.length} canal(aux) detecte(s).
        </div>
      )}

      {/* ----- Grille de toggles par canal ----- */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {sceneChannels.length === 0 ? (
          <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <Square className="h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">Aucun canal dans la scene</p>
            <p className="max-w-[220px] text-[11px] text-slate-500">
              Cette scene ne contient aucune valeur DMX a masquer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {sceneChannels.map((ch) => {
              const on = isChannelEnabled(ch);
              return (
                <button
                  key={ch}
                  onClick={() => toggleSceneChannel?.(numericSceneId, ch)}
                  title={on ? `Canal ${ch} actif — cliquer pour masquer` : `Canal ${ch} masque — cliquer pour activer`}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 text-[10px] font-bold transition-colors"
                  style={
                    on
                      ? { borderColor: ACCENT, background: "rgba(34,211,238,0.12)", color: ACCENT }
                      : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)", color: "#475569" }
                  }
                >
                  {on ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                  <span className="font-mono">{ch}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
