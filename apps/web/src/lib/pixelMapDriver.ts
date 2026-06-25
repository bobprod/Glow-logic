/**
 * pixelMapDriver — pilote temps reel qui echantillonne le CHAMP DE COULEUR pur
 * de pixelMapEngine a la position de chaque fixture RGB et le pousse au DMX
 * (~40Hz), de maniere ADDITIVE (source 'background').
 *
 * Modele : oscillatorDriver. Le driver ne tourne que si pixelMap.enabled est
 * vrai. INVARIANT : enabled=false => RIEN n'est emis, 0 impact.
 *
 * Pour chaque tick :
 *  1) on calcule la bounding box des positions (gridPosition x/y) des fixtures ;
 *  2) on normalise chaque fixture dans [0,1] sur cette bbox ;
 *  3) pour chaque fixture ayant des canaux RGB absolus (start_address + channel - 1),
 *     pixelColorAt(cfg, performance.now(), nx, ny) -> dmxEngine.setChannel(...).
 */

import { dmxEngine } from './dmxEngine';
import { pixelColorAt, type PixelMapConfig } from './pixelMapEngine';

// ~40Hz -> 25ms par tick.
const TICK_MS = 25;
// Univers par defaut (convention projet : universe 1).
const DEFAULT_UNIVERSE = 1;

type PixelMapState = { enabled: boolean } & PixelMapConfig;

// Forme minimale d'une fixture telle que lue depuis le store.
type FixtureLike = {
  startAddress?: number;
  start_address?: number;
  universe?: number;
  gridPosition?: { x?: number; y?: number; z?: number };
  channels?: Array<{ type?: string; channel?: number }>;
};

type PixelMapSnapshot = {
  pixelMap: PixelMapState;
  fixtures: FixtureLike[];
};

type RgbChannels = {
  universe: number;
  red?: number;
  green?: number;
  blue?: number;
  x: number;
  y: number;
};

class PixelMapDriver {
  private timer: ReturnType<typeof setInterval> | null = null;
  private getSnapshot: (() => PixelMapSnapshot) | null = null;

  /** Fournit la source de verite (lecture du store). */
  configure(getSnapshot: () => PixelMapSnapshot) {
    this.getSnapshot = getSnapshot;
  }

  private get running() {
    return this.timer !== null;
  }

  private start() {
    if (this.running || typeof window === 'undefined') return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * (Re)evalue l'etat : demarre la boucle si pixelMap.enabled, sinon l'arrete.
   * Idempotent.
   */
  sync() {
    if (!this.getSnapshot) return;
    const { pixelMap } = this.getSnapshot();
    if (pixelMap && pixelMap.enabled) this.start();
    else this.stop();
  }

  /**
   * Resout les canaux RGB absolus (red/green/blue) et la position de chaque
   * fixture qui possede au moins un canal RGB.
   */
  private resolveFixtures(fixtures: FixtureLike[]): RgbChannels[] {
    const out: RgbChannels[] = [];
    for (const fixture of fixtures) {
      const start = Number(fixture?.startAddress ?? fixture?.start_address ?? 1);
      const universe = Number(fixture?.universe ?? DEFAULT_UNIVERSE) || DEFAULT_UNIVERSE;
      const channels = Array.isArray(fixture?.channels) ? fixture.channels : [];

      let red: number | undefined;
      let green: number | undefined;
      let blue: number | undefined;
      for (const ch of channels) {
        const type = String(ch?.type ?? '').toLowerCase();
        const offset = Number(ch?.channel ?? 1);
        const abs = start + offset - 1;
        if (type === 'red') red = abs;
        else if (type === 'green') green = abs;
        else if (type === 'blue') blue = abs;
      }

      if (red === undefined && green === undefined && blue === undefined) continue;

      const gx = Number(fixture?.gridPosition?.x);
      const gy = Number(fixture?.gridPosition?.y);
      out.push({
        universe,
        red,
        green,
        blue,
        x: Number.isFinite(gx) ? gx : 0,
        y: Number.isFinite(gy) ? gy : 0,
      });
    }
    return out;
  }

  private tick() {
    if (!this.getSnapshot) return;
    const { pixelMap, fixtures } = this.getSnapshot();

    // INVARIANT : rien n'est emis si desactive.
    if (!pixelMap || !pixelMap.enabled) {
      this.stop();
      return;
    }

    const resolved = this.resolveFixtures(Array.isArray(fixtures) ? fixtures : []);
    if (resolved.length === 0) return;

    // Bounding box des positions (gridPosition x/y).
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const f of resolved) {
      if (f.x < minX) minX = f.x;
      if (f.x > maxX) maxX = f.x;
      if (f.y < minY) minY = f.y;
      if (f.y > maxY) maxY = f.y;
    }
    const spanX = maxX - minX;
    const spanY = maxY - minY;

    const timeMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (const f of resolved) {
      // Normalisation [0,1] sur la bbox ; si une dimension est plate, centre a 0.5.
      const nx = spanX > 0 ? (f.x - minX) / spanX : 0.5;
      const ny = spanY > 0 ? (f.y - minY) / spanY : 0.5;
      const { r, g, b } = pixelColorAt(pixelMap, timeMs, nx, ny);

      if (f.red !== undefined && f.red > 0) {
        dmxEngine.setChannel(f.universe, f.red, r, { source: 'background' });
      }
      if (f.green !== undefined && f.green > 0) {
        dmxEngine.setChannel(f.universe, f.green, g, { source: 'background' });
      }
      if (f.blue !== undefined && f.blue > 0) {
        dmxEngine.setChannel(f.universe, f.blue, b, { source: 'background' });
      }
    }
  }

  /** Arret total (cleanup). */
  dispose() {
    this.stop();
  }
}

export const pixelMapDriver = new PixelMapDriver();
