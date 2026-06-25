import { dmxEngine } from './dmxEngine';

/** Source DMX optionnelle propagée à dmxEngine.setChannel (cf. DmxWriteOptions). */
export type CrossfadeSource = 'manual' | 'timeline' | 'background';

/**
 * CONTRAT A3 — Moteur de crossfade intelligent entre scènes Smart.
 *
 * Fond chaque canal de sa valeur COURANTE vers la valeur cible sur une durée.
 * - Canaux CONTINUS (intensité, couleur additive, position) : fondu LISSE (lerp linéaire).
 * - Canaux DISCRETS (gobo, color wheel, mode, prisme, macro, function) : SNAP à mi-course (t >= 0.5).
 *
 * Pas de dépendance UI. Pas de Date.now()/Math.random. ~40Hz via setInterval(25ms).
 */

/** Types de canaux considérés CONTINUS (interpolables). */
export const CONTINUOUS_CHANNEL_TYPES: ReadonlyArray<string> = [
  'dimmer',
  'intensity',
  'red',
  'green',
  'blue',
  'white',
  'amber',
  'uv',
  'pan',
  'tilt',
  'strobe',
  'zoom',
  'focus',
  'iris',
  'speed',
];

/** Types de canaux explicitement DISCRETS (non interpolables -> snap). */
const DISCRETE_CHANNEL_TYPES: ReadonlyArray<string> = [
  'color',
  'gobo',
  'prism',
  'macro',
  'effect',
  'shutter',
  'mode',
  'function',
];

/**
 * Détermine si un canal est continu (interpolable) ou discret (snap).
 * - Continu pour intensité / couleur additive / position.
 * - Discret pour gobo / color wheel / mode / prisme / macro / function.
 * - Défaut inconnu => true (sûr de fondre l'intensité plutôt que de snapper).
 */
export function isContinuousChannel(type: string | undefined): boolean {
  if (type == null) return true;
  const t = String(type).toLowerCase();
  if (DISCRETE_CHANNEL_TYPES.includes(t)) return false;
  if (CONTINUOUS_CHANNEL_TYPES.includes(t)) return true;
  // Type inconnu -> continu par défaut (sûr de fondre l'intensité).
  return true;
}

export interface CrossfadeTarget {
  universe: number;
  channel: number;
  value: number;
  continuous: boolean;
}

/**
 * Math PURE du crossfade — extraite pour testabilité (sans dépendance au temps réel).
 * @param from valeur de départ (snapshot au démarrage)
 * @param to valeur cible
 * @param t progression normalisée 0..1 (elapsed/duration)
 * @param continuous true = lerp lissé, false = snap discret à mi-course
 */
export function crossfadeValueAt(
  from: number,
  to: number,
  t: number,
  continuous: boolean,
): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (continuous) {
    return Math.round(from + (to - from) * clamped);
  }
  // Discret : reste sur 'from' jusqu'à mi-course, puis snap sur 'to'.
  return clamped < 0.5 ? Math.round(from) : Math.round(to);
}

const TICK_MS = 25; // ~40Hz

interface ActiveFade {
  cancel: () => void;
}

// Registre module-level des fondus actifs par 'universe:channel'.
const activeFades = new Map<string, ActiveFade>();

function keyOf(universe: number, channel: number): string {
  return `${universe}:${channel}`;
}

/** Options de fondu. `source` est propagée telle quelle à dmxEngine.setChannel. */
export interface CrossfadeOptions {
  source?: CrossfadeSource;
}

function applyTarget(target: CrossfadeTarget, source?: CrossfadeSource): void {
  dmxEngine.setChannel(
    target.universe,
    target.channel,
    target.value,
    source ? { source } : undefined,
  );
}

/**
 * Anime chaque canal de sa valeur courante (lue au démarrage) vers target.value
 * sur durationMs, à ~40Hz.
 * - Annule tout fondu en cours sur les mêmes canaux avant d'en démarrer un nouveau.
 * - Retourne un handle d'annulation { cancel }.
 */
export function startCrossfade(
  targets: CrossfadeTarget[],
  durationMs: number,
  opts?: CrossfadeOptions,
): { cancel: () => void } {
  // Source DMX optionnelle (défaut: undefined => comportement A3/Smart inchangé).
  const source = opts?.source;
  // Annule les fondus précédents sur les canaux repris (évite les conflits).
  for (const target of targets) {
    const k = keyOf(target.universe, target.channel);
    const prev = activeFades.get(k);
    if (prev) prev.cancel();
  }

  // Durée nulle/négative ou environnement sans timer -> application instantanée.
  if (
    durationMs <= 0 ||
    typeof setInterval === 'undefined' ||
    typeof window === 'undefined'
  ) {
    for (const target of targets) {
      applyTarget(target, source);
    }
    return { cancel: () => {} };
  }

  // Snapshot des valeurs de départ.
  const froms = targets.map((target) =>
    dmxEngine.getChannel(target.universe, target.channel),
  );

  let elapsed = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    // Désenregistre uniquement les canaux encore détenus par ce fondu.
    for (const target of targets) {
      const k = keyOf(target.universe, target.channel);
      if (activeFades.get(k) === handle) {
        activeFades.delete(k);
      }
    }
  };

  const cancel = () => {
    finish();
  };

  const handle: ActiveFade = { cancel };

  // Enregistre ce fondu comme propriétaire courant des canaux.
  for (const target of targets) {
    activeFades.set(keyOf(target.universe, target.channel), handle);
  }

  const tick = () => {
    elapsed += TICK_MS;
    const t = elapsed / durationMs;
    if (t >= 1) {
      // Application finale exacte des cibles, puis arrêt.
      for (const target of targets) {
        applyTarget(target, source);
      }
      finish();
      return;
    }
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const value = crossfadeValueAt(froms[i], target.value, t, target.continuous);
      dmxEngine.setChannel(
        target.universe,
        target.channel,
        value,
        source ? { source } : undefined,
      );
    }
  };

  timer = setInterval(tick, TICK_MS);

  return { cancel };
}
