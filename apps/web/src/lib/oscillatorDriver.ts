/**
 * oscillatorDriver — pilote temps reel qui transforme les oscillateurs 'enabled'
 * du store en sorties DMX a ~40Hz.
 *
 * Pour chaque oscillateur active, et pour chaque canal de osc.channels (index i
 * sur count = channels.length), on calcule oscillatorValue(cfg, { index, count,
 * bpm, timeMs }) puis on l'ecrit via dmxEngine.setChannel comme une source
 * d'automation normale (source 'background'), respectant ainsi la precedence
 * canal definie par dmxEngine.
 *
 * Le driver ne tourne que s'il existe au moins un oscillateur 'enabled' afin de
 * ne pas spammer le reseau quand rien n'est actif. Il est entierement piloté par
 * `sync()` (idempotent) : appeler sync() lorsqu'on veut (re)evaluer l'etat.
 */

import { dmxEngine } from './dmxEngine';
import { oscillatorValue } from './oscillatorEngine';
import type { OscillatorAssignment } from '../store/slices/oscillatorSlice';

// ~40Hz -> 25ms par tick.
const TICK_MS = 25;
// Univers par defaut (convention projet : universe 1).
const DEFAULT_UNIVERSE = 1;

type OscillatorSnapshot = {
  oscillators: OscillatorAssignment[];
  bpm: number;
  effectSpeed?: number;
};

class OscillatorDriver {
  private timer: ReturnType<typeof setInterval> | null = null;
  private getSnapshot: (() => OscillatorSnapshot) | null = null;

  /** Fournit la source de verite (lecture du store). Appelable une seule fois. */
  configure(getSnapshot: () => OscillatorSnapshot) {
    this.getSnapshot = getSnapshot;
  }

  private get running() {
    return this.timer !== null;
  }

  /** Demarre la boucle si elle ne tourne pas deja. */
  private start() {
    if (this.running || typeof window === 'undefined') return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Arrete proprement la boucle. */
  private stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * (Re)evalue l'etat : demarre la boucle s'il y a au moins un oscillateur
   * 'enabled' avec des canaux, sinon l'arrete. Idempotent.
   */
  sync() {
    if (!this.getSnapshot) return;
    const { oscillators } = this.getSnapshot();
    const active = oscillators.some(
      (osc) => osc.enabled && osc.channels.length > 0,
    );
    if (active) this.start();
    else this.stop();
  }

  private tick() {
    if (!this.getSnapshot) return;
    const { oscillators, bpm, effectSpeed } = this.getSnapshot();
    const speedMultiplier = effectSpeed && effectSpeed > 0 ? effectSpeed : 1;
    const timeMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    let anyActive = false;
    for (const osc of oscillators) {
      if (!osc.enabled || osc.channels.length === 0) continue;
      anyActive = true;
      const count = osc.channels.length;
      for (let i = 0; i < count; i += 1) {
        const channel = osc.channels[i];
        if (!Number.isFinite(channel) || channel <= 0) continue;
        const value = oscillatorValue(osc.config, { index: i, count, bpm, timeMs, speedMultiplier });
        dmxEngine.setChannel(DEFAULT_UNIVERSE, channel, value, { source: 'background' });
      }
    }

    // Si plus rien n'est actif, on s'arrete pour ne pas spammer le reseau.
    if (!anyActive) this.stop();
  }

  /** Arret total (cleanup). */
  dispose() {
    this.stop();
  }
}

export const oscillatorDriver = new OscillatorDriver();
