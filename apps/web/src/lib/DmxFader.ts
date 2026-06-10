// ============================================================
// DmxFader — Smooth DMX transitions with easing curves
// Glow Logic v2
//
// Provides per-channel interpolation from current → target value
// over a configurable duration, with selectable easing functions.
// Used for scene crossfades, cue transitions, and smooth fader
// movement instead of instant DMX snaps.
// ============================================================

export type EasingType = "linear" | "easeIn" | "easeOut" | "easeInOut" | "sCurve" | "snap";

// Easing functions: input t = 0..1, output = 0..1
export const EASING: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // S-curve: smooth start AND end (cosine-based, softer than cubic easeInOut)
  sCurve: (t) => (1 - Math.cos(t * Math.PI)) / 2,
  // Snap: instant at midpoint (useful for gobo/color wheel changes)
  snap: (t) => t < 0.5 ? 0 : 1,
};

interface FadeEntry {
  universe: number;
  channel: number;
  fromValue: number;
  toValue: number;
  startTime: number;
  duration: number;
  easing: EasingType;
  onCancel?: () => void;
}

class DmxFader {
  private activeFades = new Map<string, FadeEntry>();
  private rafId: number | null = null;
  private running = false;
  private onTick: ((universe: number, channel: number, value: number) => void) | null = null;
  private readonly TICK_RATE = 40; // 40Hz = smooth at 25ms per frame

  constructor() {}

  setOnTick(cb: (universe: number, channel: number, value: number) => void) {
    this.onTick = cb;
  }

  private fadeKey(universe: number, channel: number): string {
    return `${universe}:${channel}`;
  }

  fadeTo(
    universe: number,
    channel: number,
    targetValue: number,
    durationMs: number = 0,
    easing: EasingType = "linear",
    onCancel?: () => void,
  ): void {
    const key = this.fadeKey(universe, channel);
    const current = this.getCurrentValue(universe, channel, targetValue);
    const clampedTarget = Math.round(Math.max(0, Math.min(255, targetValue)));

    if (durationMs <= 0 || current === clampedTarget) {
      this.cancelFade(universe, channel);
      this.onTick?.(universe, channel, clampedTarget);
      return;
    }

    const entry: FadeEntry = {
      universe,
      channel,
      fromValue: current,
      toValue: clampedTarget,
      startTime: performance.now(),
      duration: durationMs,
      easing,
      onCancel,
    };

    this.activeFades.set(key, entry);

    if (!this.running) {
      this.startLoop();
    }
  }

  fadeChannels(
    channels: Array<{ universe: number; channel: number; value: number }>,
    durationMs: number = 0,
    easing: EasingType = "linear",
  ): void {
    channels.forEach(({ universe, channel, value }) => {
      this.fadeTo(universe, channel, value, durationMs, easing);
    });
  }

  crossfade(
    channelsA: Array<{ universe: number; channel: number; value: number }>,
    channelsB: Array<{ universe: number; channel: number; value: number }>,
    durationMs: number = 1000,
    easing: EasingType = "sCurve",
  ): void {
    // Scene A fades OUT (→ 0) while scene B fades IN (→ target)
    channelsA.forEach(({ universe, channel }) => {
      this.fadeTo(universe, channel, 0, durationMs, easing);
    });
    channelsB.forEach(({ universe, channel, value }) => {
      this.fadeTo(universe, channel, value, durationMs, easing);
    });
  }

  // Fade a group of channels proportionally (like a dimmer master)
  fadeGroupScale(
    channels: Array<{ universe: number; channel: number; baseValue: number }>,
    scaleFrom: number,
    scaleTo: number,
    durationMs: number,
    easing: EasingType = "easeOut",
  ): void {
    channels.forEach(({ universe, channel, baseValue }) => {
      const toVal = Math.round(baseValue * scaleTo);
      this.fadeTo(universe, channel, toVal, durationMs, easing);
    });
  }

  cancelFade(universe: number, channel: number) {
    const key = this.fadeKey(universe, channel);
    const entry = this.activeFades.get(key);
    if (entry?.onCancel) entry.onCancel();
    this.activeFades.delete(key);
  }

  cancelAll() {
    this.activeFades.forEach((entry) => {
      entry.onCancel?.();
    });
    this.activeFades.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
  }

  isFading(universe: number, channel: number): boolean {
    return this.activeFades.has(this.fadeKey(universe, channel));
  }

  getActiveFadeCount(): number {
    return this.activeFades.size;
  }

  // --- Private ---

  private getCurrentValue(universe: number, channel: number, defaultValue: number): number {
    const key = this.fadeKey(universe, channel);
    const existing = this.activeFades.get(key);
    if (existing) {
      const progress = Math.min(1, (performance.now() - existing.startTime) / existing.duration);
      const easedProgress = EASING[existing.easing](progress);
      return Math.round(existing.fromValue + (existing.toValue - existing.fromValue) * easedProgress);
    }
    return defaultValue;
  }

  private startLoop() {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  private tick() {
    const now = performance.now();
    const completedKeys: string[] = [];

    this.activeFades.forEach((entry, key) => {
      const elapsed = now - entry.startTime;
      const progress = Math.min(1, elapsed / entry.duration);
      const easedProgress = EASING[entry.easing](progress);
      const currentValue = Math.round(entry.fromValue + (entry.toValue - entry.fromValue) * easedProgress);

      this.onTick?.(entry.universe, entry.channel, currentValue);

      if (progress >= 1) {
        this.onTick?.(entry.universe, entry.channel, entry.toValue);
        completedKeys.push(key);
      }
    });

    completedKeys.forEach((key) => this.activeFades.delete(key));

    if (this.activeFades.size > 0) {
      this.rafId = requestAnimationFrame(() => this.tick());
    } else {
      this.running = false;
      this.rafId = null;
    }
  }
}

export const dmxForFader = new DmxFader();
