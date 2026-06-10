// ============================================================
// EffectEngine — Movement patterns & effects generator
// Glow Logic v2
//
// Generates automated DMX patterns:
//   - Circle, Figure-8, Sweep (pan/tilt movement)
//   - Rainbow cycle (color wheel)
//   - Pulse/Dimmer wave
//   - Random movement
// All patterns run at configurable speed/size and BPM sync.
// ============================================================

export type EffectType = "circle" | "figure8" | "sweep" | "rainbow" | "pulse" | "random" | "strobe";
export type EffectStatus = "running" | "paused" | "stopped";

export interface EffectConfig {
  id: string;
  type: EffectType;
  channels: {
    pan?: number;       // DMX channel for pan
    tilt?: number;      // DMX channel for tilt
    colorWheel?: number;// DMX channel for color wheel
    dimmer?: number;    // DMX channel for dimmer
    strobe?: number;    // DMX channel for strobe
  };
  universe: number;
  centerPan: number;    // Center position (0-255), default 127
  centerTilt: number;   // Center position (0-255), default 127
  size: number;         // Pattern amplitude 0-255, default 80
  speed: number;        // Cycles per minute, default 10
  bpm?: number;         // BPM sync override
}

interface RunningEffect extends EffectConfig {
  status: EffectStatus;
  startTime: number;
  pauseTime?: number;
}

class EffectEngine {
  private effects = new Map<string, RunningEffect>();
  private rafId: number | null = null;
  private running = false;
  private onTick: ((universe: number, channel: number, value: number) => void) | null = null;
  private lastValues = new Map<string, number>();

  constructor() {}

  setOnTick(cb: (universe: number, channel: number, value: number) => void) {
    this.onTick = cb;
  }

  startEffect(config: EffectConfig): string {
    const effect: RunningEffect = {
      ...config,
      status: "running",
      startTime: performance.now(),
    };
    this.effects.set(config.id, effect);
    this.lastValues.set(config.id, 0);

    if (!this.running) {
      this.running = true;
      this.tick();
    }
    return config.id;
  }

  stopEffect(id: string) {
    this.effects.delete(id);
    this.lastValues.delete(id);
    if (this.effects.size === 0) {
      this.stopLoop();
    }
  }

  pauseEffect(id: string) {
    const effect = this.effects.get(id);
    if (effect && effect.status === "running") {
      effect.status = "paused";
      effect.pauseTime = performance.now();
    }
  }

  resumeEffect(id: string) {
    const effect = this.effects.get(id);
    if (effect && effect.status === "paused" && effect.pauseTime) {
      const pausedDuration = performance.now() - effect.pauseTime;
      effect.startTime += pausedDuration;
      effect.status = "running";
      if (!this.running) {
        this.running = true;
        this.tick();
      }
    }
  }

  updateEffect(id: string, partial: Partial<EffectConfig>) {
    const effect = this.effects.get(id);
    if (!effect) return;
    Object.assign(effect, partial);
  }

  getEffectStatus(id: string): EffectStatus | null {
    return this.effects.get(id)?.status ?? null;
  }

  getRunningEffects(): string[] {
    return Array.from(this.effects.values())
      .filter((e) => e.status === "running")
      .map((e) => e.id);
  }

  stopAll() {
    this.effects.clear();
    this.lastValues.clear();
    this.stopLoop();
  }

  // --- Pattern generators ---

  private computeCircle(effect: RunningEffect, t: number): Map<number, number> {
    const values = new Map<number, number>();
    if (!effect.channels.pan || !effect.channels.tilt) return values;

    const angle = t * Math.PI * 2;
    const panVal = Math.round(effect.centerPan + effect.size * Math.sin(angle) * 0.5);
    const tiltVal = Math.round(effect.centerTilt + effect.size * Math.cos(angle) * 0.5);
    values.set(effect.channels.pan, Math.max(0, Math.min(255, panVal)));
    values.set(effect.channels.tilt, Math.max(0, Math.min(255, tiltVal)));
    return values;
  }

  private computeFigure8(effect: RunningEffect, t: number): Map<number, number> {
    const values = new Map<number, number>();
    if (!effect.channels.pan || !effect.channels.tilt) return values;

    // Lissajous curve: pan uses sin(θ), tilt uses sin(2θ) → figure-8
    const angle = t * Math.PI * 2;
    const panVal = Math.round(effect.centerPan + effect.size * Math.sin(angle) * 0.5);
    const tiltVal = Math.round(effect.centerTilt + effect.size * Math.sin(angle * 2) * 0.5);
    values.set(effect.channels.pan, Math.max(0, Math.min(255, panVal)));
    values.set(effect.channels.tilt, Math.max(0, Math.min(255, tiltVal)));
    return values;
  }

  private computeSweep(effect: RunningEffect, t: number): Map<number, number> {
    const values = new Map<number, number>();
    if (!effect.channels.pan) return values;

    // Triangle wave: pan sweeps left-right
    const sweep = t <= 0.5 ? t * 2 : 2 - t * 2;
    const panVal = Math.round(effect.centerPan + (effect.size * (sweep - 0.5)));
    values.set(effect.channels.pan, Math.max(0, Math.min(255, panVal)));

    // Tilt stays at center (or subtle oscillation)
    if (effect.channels.tilt) {
      const tiltVal = Math.round(effect.centerTilt + effect.size * Math.sin(t * Math.PI * 2) * 0.1);
      values.set(effect.channels.tilt, Math.max(0, Math.min(255, tiltVal)));
    }
    return values;
  }

  private computeRainbow(effect: RunningEffect, t: number): Map<number, number> {
    const values = new Map<number, number>();
    if (!effect.channels.colorWheel) return values;

    // Cycle through color wheel range 0-255
    const wheelVal = Math.round(t * 255);
    values.set(effect.channels.colorWheel, wheelVal);
    return values;
  }

  private computePulse(effect: RunningEffect, t: number): Map<number, number> {
    const values = new Map<number, number>();
    if (!effect.channels.dimmer) return values;

    // Sine wave dimmer pulse: 0-255 with configurable range
    const wave = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0→1→0
    const dimmerVal = Math.round(wave * effect.size);
    values.set(effect.channels.dimmer, Math.max(0, Math.min(255, dimmerVal)));
    return values;
  }

  private computeRandom(effect: RunningEffect): Map<number, number> {
    const values = new Map<number, number>();
    const speedMul = effect.speed / 10;
    const now = performance.now() * speedMul;
    // Smoothed random movement using noise-like step
    const chaos = Math.sin(now * 0.002) * 0.5 + 0.5 +
                  Math.sin(now * 0.0037) * 0.3 +
                  Math.sin(now * 0.0071) * 0.2;

    if (effect.channels.pan) {
      const panVal = Math.round(effect.centerPan + (chaos - 0.5) * effect.size);
      values.set(effect.channels.pan, Math.max(0, Math.min(255, panVal)));
    }
    if (effect.channels.tilt) {
      const chaosTilt = Math.sin(now * 0.0029) * 0.5 + 0.5 +
                        Math.sin(now * 0.0049) * 0.3 +
                        Math.sin(now * 0.0083) * 0.2;
      const tiltVal = Math.round(effect.centerTilt + (chaosTilt - 0.5) * effect.size);
      values.set(effect.channels.tilt, Math.max(0, Math.min(255, tiltVal)));
    }
    return values;
  }

  private computeStrobe(effect: RunningEffect, t: number): Map<number, number> {
    const values = new Map<number, number>();
    if (!effect.channels.strobe) return values;

    const strobeRate = effect.speed / 60;
    const phase = (t * strobeRate) % 1;
    const onTime = 0.3;
    values.set(effect.channels.strobe, phase < onTime ? 255 : 0);
    return values;
  }

  private computeEffect(effect: RunningEffect, now: number): Map<number, number> {
    const elapsed = (now - effect.startTime) / 1000;
    const speedHz = effect.speed / 60;
    const t = (elapsed * speedHz) % 1;

    switch (effect.type) {
      case "circle":    return this.computeCircle(effect, t);
      case "figure8":   return this.computeFigure8(effect, t);
      case "sweep":     return this.computeSweep(effect, t);
      case "rainbow":   return this.computeRainbow(effect, t);
      case "pulse":     return this.computePulse(effect, t);
      case "random":    return this.computeRandom(effect);
      case "strobe":    return this.computeStrobe(effect, t);
      default:          return new Map();
    }
  }

  // --- Loop ---

  private tick() {
    if (this.effects.size === 0) {
      this.stopLoop();
      return;
    }

    const now = performance.now();

    this.effects.forEach((effect) => {
      if (effect.status !== "running") return;

      const values = this.computeEffect(effect, now);
      values.forEach((value, channel) => {
        this.onTick?.(effect.universe, channel, value);
      });
    });

    this.rafId = requestAnimationFrame(() => this.tick());
  }

  private stopLoop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const effectEngine = new EffectEngine();
