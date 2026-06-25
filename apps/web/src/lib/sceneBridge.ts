/**
 * sceneBridge — Convertisseur PUR Pad <-> Clip (Phase 3).
 *
 * ADDITIF & RÉTRO-COMPATIBLE. Aucune fusion de modèle : seulement des transformations
 * déterministes et défensives entre `SmartPad` (Smart mode) et `TimelineClip` (Timeline).
 *
 * Aucune dépendance store/DOM. Pas de Date.now / Math.random : les ids sont générés
 * par les actions du store (addClip / addSmartPad), pas ici.
 */
import type { SmartPad } from '../store/slices/smartModeSlice';
import type { TimelineClip } from '../store/slices/timelineSlice';

type DmxCommand = { universe: number; channel: number; value: number };

const DEFAULT_DURATION_MS = 4000;
const DEFAULT_START_MS = 0;

/** Clamp défensif d'une valeur DMX dans 0..255 (entier). */
function clampDmxValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 255) return 255;
  return rounded;
}

/** Clamp défensif d'un canal DMX dans 1..512 (entier). 0/invalide => null (ignoré). */
function normalizeChannel(channel: number): number | null {
  if (!Number.isFinite(channel)) return null;
  const rounded = Math.round(channel);
  if (rounded < 1 || rounded > 512) return null;
  return rounded;
}

/** Univers défensif : entier >= 1, défaut 1. */
function normalizeUniverse(universe: number): number {
  if (!Number.isFinite(universe)) return 1;
  const rounded = Math.round(universe);
  return rounded >= 1 ? rounded : 1;
}

/**
 * Pad -> Clip.
 * Fusionne `pad.dmxValues` (univers 1 : { ch: val }) + `pad.dmxCommands` en UNE liste
 * `clip.dmxCommands` [{ universe, channel, value }], dédupliquée par (universe, channel).
 * En cas de conflit, `dmxCommands` (explicite, multi-univers) prime sur `dmxValues`.
 * Reporte enabledChannels, fadeSeconds, name, color/textColor.
 */
export function padToClip(
  pad: SmartPad,
  opts?: { startTime?: number; duration?: number; track?: 'lights' | 'visuals' | 'fx'; fadeSeconds?: number },
): Omit<TimelineClip, 'id'> {
  // Map (universe<<10 | channel) -> command, pour dédup déterministe.
  const merged = new Map<number, DmxCommand>();

  // 1) dmxValues (univers 1) en premier.
  const values = pad?.dmxValues;
  if (values && typeof values === 'object') {
    for (const [rawCh, rawVal] of Object.entries(values)) {
      const channel = normalizeChannel(Number(rawCh));
      if (channel === null) continue;
      const cmd: DmxCommand = { universe: 1, channel, value: clampDmxValue(Number(rawVal)) };
      merged.set(1 * 1024 + channel, cmd);
    }
  }

  // 2) dmxCommands (multi-univers) ensuite : prime en cas de conflit.
  const commands = pad?.dmxCommands;
  if (Array.isArray(commands)) {
    for (const raw of commands) {
      if (!raw || typeof raw !== 'object') continue;
      const channel = normalizeChannel(Number(raw.channel));
      if (channel === null) continue;
      const universe = normalizeUniverse(Number(raw.universe));
      const cmd: DmxCommand = { universe, channel, value: clampDmxValue(Number(raw.value)) };
      merged.set(universe * 1024 + channel, cmd);
    }
  }

  const dmxCommands = Array.from(merged.values());

  const startTime = Number.isFinite(opts?.startTime)
    ? Math.max(0, Math.round(opts!.startTime as number))
    : DEFAULT_START_MS;
  const duration = Number.isFinite(opts?.duration)
    ? Math.max(1, Math.round(opts!.duration as number))
    : DEFAULT_DURATION_MS;

  const clip: Omit<TimelineClip, 'id'> = {
    track: opts?.track ?? 'lights',
    name: typeof pad?.name === 'string' && pad.name.length > 0 ? pad.name : 'Pad',
    startTime,
    duration,
    color: typeof pad?.color === 'string' && pad.color.length > 0 ? pad.color : 'bg-cyan-500',
    textColor: typeof pad?.textColor === 'string' && pad.textColor.length > 0 ? pad.textColor : 'text-cyan-400',
    dmxCommands,
    sourceType: 'pad',
    sourceId: pad?.id != null ? String(pad.id) : undefined,
  };

  if (pad?.qlcPage != null) clip.qlcPage = pad.qlcPage;
  if (pad?.qlcWidget != null) clip.qlcWidget = pad.qlcWidget;
  if (Array.isArray(pad?.enabledChannels)) clip.enabledChannels = [...pad.enabledChannels];
  // fadeSeconds: report optionnel via opts (SmartPad n'a pas de champ fadeSeconds propre ;
  // le fondu Smart est un getter store global). On accepte un report explicite si fourni.
  if (Number.isFinite((opts as { fadeSeconds?: number })?.fadeSeconds)) {
    clip.fadeSeconds = (opts as { fadeSeconds?: number }).fadeSeconds as number;
  }

  return clip;
}

/**
 * Clip -> Pad.
 * `clip.dmxCommands` -> `pad.dmxValues` (univers 1 uniquement) + conserve `dmxCommands`
 * (tous univers, dédupliqué). Reporte enabledChannels, fadeSeconds, name, une couleur.
 */
export function clipToPad(
  clip: TimelineClip,
  opts?: { page?: number; slot?: number },
): Omit<SmartPad, 'id'> {
  const dmxValues: Record<number, number> = {};
  const merged = new Map<number, DmxCommand>();

  const commands = clip?.dmxCommands;
  if (Array.isArray(commands)) {
    for (const raw of commands) {
      if (!raw || typeof raw !== 'object') continue;
      const channel = normalizeChannel(Number(raw.channel));
      if (channel === null) continue;
      const universe = normalizeUniverse(Number(raw.universe));
      const value = clampDmxValue(Number(raw.value));
      merged.set(universe * 1024 + channel, { universe, channel, value });
      if (universe === 1) dmxValues[channel] = value;
    }
  }

  const dmxCommands = Array.from(merged.values());

  const pad: Omit<SmartPad, 'id'> = {
    name: typeof clip?.name === 'string' && clip.name.length > 0 ? clip.name : 'Clip',
    color: typeof clip?.color === 'string' && clip.color.length > 0 ? clip.color : 'bg-cyan-500',
    textColor: typeof clip?.textColor === 'string' && clip.textColor.length > 0 ? clip.textColor : 'text-cyan-400',
    iconName: 'Zap',
    qlcPage: clip?.qlcPage != null ? clip.qlcPage : 1,
    qlcWidget: clip?.qlcWidget != null ? clip.qlcWidget : 0,
    dmxValues,
    dmxCommands,
    midiNote: -1,
    midiChannel: 1,
    gridCol: 0,
    gridRow: 0,
    gridW: 1,
    gridH: 1,
    // page/slot requis par SmartPad : défaut 0 (réalloués par normalizeSmartPads via addSmartPad).
    page: 0,
    slot: 0,
  };

  if (Array.isArray(clip?.enabledChannels)) pad.enabledChannels = [...clip.enabledChannels];
  // Note: SmartPad n'a pas de champ fadeSeconds (fondu = getter store global), donc
  // clip.fadeSeconds n'est pas reporté sur le pad ; il sera réappliqué au déclenchement.
  if (Number.isFinite(opts?.page as number)) pad.page = opts!.page as number;
  if (Number.isFinite(opts?.slot as number)) pad.slot = opts!.slot as number;

  return pad;
}
