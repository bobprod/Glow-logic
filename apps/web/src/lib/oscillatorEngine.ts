/**
 * oscillatorEngine — générateur d'oscillateurs LFO purs et déterministes pour la modulation DMX.
 *
 * Une valeur d'oscillateur est dérivée uniquement de sa configuration et de paramètres
 * temporels (bpm, timeMs) plus la position de l'élément dans une sélection (index/count).
 * Aucun état interne, aucun effet de bord : `oscillatorValue` est une fonction pure.
 */

export type OscWaveform = 'sine' | 'square' | 'triangle' | 'sawUp' | 'sawDown';

export interface OscillatorConfig {
  /** Forme d'onde de base. */
  waveform: OscWaveform;
  /** Profondeur de modulation 0..1 (0 = onde plate sur le centre). */
  amount: number;
  /** Nombre de mesures pour un cycle complet (>0). 1 mesure = 4 temps. */
  speedBars: number;
  /** Déphasage 0..1 réparti sur la sélection -> effet chase. */
  chase: number;
  /** Morph de l'onde 0..1 (plus pointue / plus arrondie selon la forme). */
  shape: number;
  /** Valeur centrale 0..255 autour de laquelle l'onde oscille. */
  center: number;
  /** Décalage de phase absolu 0..1 (défaut 0) ajouté au cycle avant fract(). */
  phase?: number;
}

export const DEFAULT_OSC_CONFIG: OscillatorConfig = {
  waveform: 'sine',
  amount: 0.5,
  speedBars: 1,
  chase: 0,
  shape: 0,
  center: 128,
  phase: 0,
};

const TWO_PI = Math.PI * 2;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Réduit une valeur de cycle (potentiellement >1 ou négative) dans la plage [0,1).
 * `phase` représente la fraction parcourue d'un cycle complet.
 */
function fract(cycle: number): number {
  const f = cycle - Math.floor(cycle);
  // Sécurité numérique : Math.floor d'un nombre déjà entier peut produire f===0, OK.
  return f;
}

/**
 * Onde brute dans [-1,1] pour une phase normalisée `p` dans [0,1).
 * Le morph `shape` (0..1) interpole vers une version plus marquée de l'onde :
 *   - sine : interpole vers une sinusoïde « surcompressée » (plus pointue aux extrêmes)
 *   - triangle : interpole vers un signal plus carré (flancs plus raides)
 *   - sawUp/sawDown : applique une courbe puissance qui creuse/accélère la rampe
 *   - square : applique un rapport cyclique (duty) variable
 */
function rawWave(waveform: OscWaveform, p: number, shape: number): number {
  const s = clamp01(shape);
  switch (waveform) {
    case 'sine': {
      const base = Math.sin(p * TWO_PI);
      if (s === 0) return base;
      // Version « pointue » : sign(sin) * |sin|^k avec k<1 rapproche des plateaux,
      // on inverse pour rendre plus pointu en augmentant l'exposant.
      const k = 1 + s * 3; // 1..4
      const sharp = Math.sign(base) * Math.pow(Math.abs(base), k);
      return base * (1 - s) + sharp * s;
    }
    case 'triangle': {
      // Triangle classique : monte 0->1 puis descend, mappé sur [-1,1].
      const tri = 1 - 4 * Math.abs(p - 0.5); // p=0 ->-1, p=.25->0? recompute
      // tri ci-dessus : p=0 -> 1-4*0.5=-1 ; p=0.5 -> 1 ; p=1 -> -1. C'est un triangle.
      if (s === 0) return tri;
      // Morph vers carré : durcit les flancs.
      const sq = tri >= 0 ? 1 : -1;
      return tri * (1 - s) + sq * s;
    }
    case 'square': {
      // Duty cycle variable : shape décale le seuil de bascule de 0.5 vers 0.25.
      const duty = 0.5 - s * 0.25; // 0.5..0.25
      return p < duty ? 1 : -1;
    }
    case 'sawUp': {
      // Rampe montante -1 -> 1 sur le cycle.
      const lin = p * 2 - 1;
      if (s === 0) return lin;
      // Courbe puissance : creuse le début de la rampe.
      const k = 1 + s * 2; // 1..3
      const curved = Math.pow(p, k) * 2 - 1;
      return lin * (1 - s) + curved * s;
    }
    case 'sawDown': {
      // Rampe descendante 1 -> -1 sur le cycle.
      const lin = 1 - p * 2;
      if (s === 0) return lin;
      const k = 1 + s * 2;
      const curved = 1 - Math.pow(p, k) * 2;
      return lin * (1 - s) + curved * s;
    }
    default:
      return 0;
  }
}

/**
 * Valeur DMX 0..255 (entier) d'un oscillateur pour le membre `index` d'une sélection
 * de taille `count`, à l'instant `timeMs`, au tempo `bpm`.
 *
 * Modèle temporel :
 *   secondsPerBar = (60 / bpm) * 4         // 1 mesure = 4 temps
 *   cyclesPerSecond = 1 / (speedBars * secondsPerBar)
 *   cyclesPerSecond *= speedMultiplier     // accélère/ralentit globalement (défaut 1)
 *   cycle = (timeMs / 1000) * cyclesPerSecond
 *   cycle += chase * index / max(1, count)  // chase : déphasage réparti
 *   phase = fract(cycle)
 *   value = clamp(round(center + amount * 127 * wave(phase)))
 *
 * `opts.speedMultiplier` (optionnel, défaut 1) est un multiplicateur global de
 * vitesse indépendant du tempo : >1 accélère, <1 ralentit. Une valeur <=0 (ou
 * non finie) est traitée comme 1. INVARIANT : absent ou ===1 => valeur identique
 * au comportement historique.
 */
export function oscillatorValue(
  cfg: OscillatorConfig,
  opts: { index: number; count: number; bpm: number; timeMs: number; speedMultiplier?: number },
): number {
  const speedBars = cfg.speedBars > 0 ? cfg.speedBars : DEFAULT_OSC_CONFIG.speedBars;
  const bpm = opts.bpm > 0 ? opts.bpm : 120;
  const count = opts.count > 0 ? opts.count : 1;
  const index = Number.isFinite(opts.index) ? opts.index : 0;
  const speedMultiplier =
    Number.isFinite(opts.speedMultiplier) && (opts.speedMultiplier as number) > 0
      ? (opts.speedMultiplier as number)
      : 1;

  const secondsPerBar = (60 / bpm) * 4;
  const cyclesPerSecond = (1 / (speedBars * secondsPerBar)) * speedMultiplier;

  let cycle = (opts.timeMs / 1000) * cyclesPerSecond;
  cycle += clamp01(cfg.phase ?? 0);
  cycle += clamp01(cfg.chase) * (index / Math.max(1, count));

  const phase = fract(cycle);
  const wave = rawWave(cfg.waveform, phase, cfg.shape);

  const center = cfg.center;
  const amount = clamp01(cfg.amount);
  let value = Math.round(center + amount * 127 * wave);

  if (value < 0) value = 0;
  if (value > 255) value = 255;
  return value;
}
