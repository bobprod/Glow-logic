import { socket } from './socket';
import { dmxForFader, EasingType } from './DmxFader';
import { effectEngine, EffectConfig } from './EffectEngine';

type ChannelMap = Map<number, number>;
type DmxSource = 'manual' | 'timeline' | 'background';
type DmxOutputGate = {
    qlcOsc: boolean;
    qlcWs: boolean;
    artNet: boolean;
    usbDmx: boolean;
};

interface DmxWriteOptions {
    source?: DmxSource;
    priority?: number;
    lockMs?: number;
    force?: boolean;
}

const SOURCE_PRIORITY: Record<DmxSource, number> = {
    background: 1,
    timeline: 2,
    manual: 3,
};

const SOURCE_LOCK_MS: Record<DmxSource, number> = {
    background: 0,
    timeline: 120,
    manual: 1200,
};

class DmxEngine {
    private frames = new Map<number, ChannelMap>();
    private prev   = new Map<number, ChannelMap>();
    private tid: ReturnType<typeof setInterval> | null = null;
    private forceNext = new Map<number, Set<number>>();
    private locks = new Map<string, { priority: number; until: number; source: DmxSource }>();
    readonly FPS = 44;
    private started = false;
    private outputGate: DmxOutputGate = { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false };

    constructor() {
        if (typeof window !== 'undefined') {
            socket.on('connect', () => {
                console.log('[DmxEngine] Socket connected, forcing full resync');
                this.forceAll();
            });

            // Wire DmxFader output into dmxEngine
            dmxForFader.setOnTick((universe, channel, value) => {
                this.setChannel(universe, channel, value, { source: 'manual' });
            });

            // Wire EffectEngine output into dmxEngine
            effectEngine.setOnTick((universe, channel, value) => {
                this.setChannel(universe, channel, value, { source: 'background' });
            });
        }
    }

    private channelKey(universe: number, channel: number) {
        return `${universe}:${channel}`;
    }

    private resolvePriority(options?: DmxWriteOptions) {
        const source = options?.source ?? 'manual';
        return {
            source,
            priority: options?.priority ?? SOURCE_PRIORITY[source],
            lockMs: options?.lockMs ?? SOURCE_LOCK_MS[source],
        };
    }

    setChannel(universe: number, channel: number, value: number, options?: DmxWriteOptions) {
        const now = performance.now();
        const key = this.channelKey(universe, channel);
        const { source, priority, lockMs } = this.resolvePriority(options);
        const activeLock = this.locks.get(key);

        if (!options?.force && activeLock && activeLock.until > now && activeLock.priority > priority) {
            return false;
        }

        if (!this.frames.has(universe)) this.frames.set(universe, new Map());
        this.frames.get(universe)!.set(channel, Math.round(Math.max(0, Math.min(255, value))));
        if (!this.forceNext.has(universe)) this.forceNext.set(universe, new Set());
        this.forceNext.get(universe)!.add(channel);

        if (lockMs > 0) {
            this.locks.set(key, { priority, source, until: now + lockMs });
        } else if (activeLock?.source === source || options?.force) {
            this.locks.delete(key);
        }

        return true;
    }

    setRGB(universe: number, rCh: number, gCh: number, bCh: number, r: number, g: number, b: number) {
        this.setChannel(universe, rCh, r);
        this.setChannel(universe, gCh, g);
        this.setChannel(universe, bCh, b);
    }

    getChannel(universe: number, channel: number): number {
        return this.frames.get(universe)?.get(channel) ?? 0;
    }

    forceAll() {
        this.prev.clear();
        this.frames.forEach((_, universe) => {
            this.forceNext.set(universe, new Set(this.frames.get(universe)!.keys()));
        });
    }

    releaseChannel(universe: number, channel: number, source?: DmxSource) {
        const key = this.channelKey(universe, channel);
        const activeLock = this.locks.get(key);
        if (!activeLock) return;
        if (!source || activeLock.source === source) {
            this.locks.delete(key);
        }
    }

    clearPriorityLocks(source?: DmxSource) {
        if (!source) {
            this.locks.clear();
            return;
        }
        this.locks.forEach((lock, key) => {
            if (lock.source === source) this.locks.delete(key);
        });
    }

    flash(universe: number, channel: number, value: number, durationMs = 500) {
        const prev = this.getChannel(universe, channel);
        this.setChannel(universe, channel, value);
        this.forceNext.get(universe)?.add(channel);
        setTimeout(() => {
            this.setChannel(universe, channel, prev);
            this.forceNext.get(universe)?.add(channel);
        }, durationMs);
    }

    blackout(universe: number, startAddr: number, numChannels: number) {
        for (let i = 0; i < numChannels; i++) {
            this.setChannel(universe, startAddr + i, 0);
        }
    }

    fullOn(universe: number, startAddr: number, channels: { channel: number; type: string }[]) {
        channels.forEach(ch => {
            const absCh = startAddr + ch.channel - 1;
            if (ch.type === 'dimmer' || ch.type === 'intensity') {
                this.setChannel(universe, absCh, 255);
            } else if (['red', 'green', 'blue', 'white', 'amber', 'uv'].includes(ch.type)) {
                this.setChannel(universe, absCh, 255);
            } else if (ch.type === 'pan' || ch.type === 'tilt') {
                this.setChannel(universe, absCh, 127);
            } else if (ch.type === 'strobe' || ch.type === 'shutter') {
                this.setChannel(universe, absCh, 0);
            }
        });
    }

    // ══════════════════════════════════════════════
    // Smooth Fading — delegates to DmxFader
    // ══════════════════════════════════════════════

    fadeTo(universe: number, channel: number, target: number, durationMs: number, easing: EasingType = "sCurve") {
        dmxForFader.fadeTo(universe, channel, target, durationMs, easing);
    }

    fadeChannels(channels: Array<{ universe: number; channel: number; value: number }>, durationMs: number, easing: EasingType = "sCurve") {
        dmxForFader.fadeChannels(channels, durationMs, easing);
    }

    crossfade(
        channelsA: Array<{ universe: number; channel: number; value: number }>,
        channelsB: Array<{ universe: number; channel: number; value: number }>,
        durationMs: number = 1000,
        easing: EasingType = "sCurve",
    ) {
        dmxForFader.crossfade(channelsA, channelsB, durationMs, easing);
    }

    fadeGroupScale(
        channels: Array<{ universe: number; channel: number; baseValue: number }>,
        scaleFrom: number,
        scaleTo: number,
        durationMs: number,
        easing: EasingType = "easeOut",
    ) {
        dmxForFader.fadeGroupScale(channels, scaleFrom, scaleTo, durationMs, easing);
    }

    cancelFade(universe: number, channel: number) {
        dmxForFader.cancelFade(universe, channel);
    }

    cancelAllFades() {
        dmxForFader.cancelAll();
    }

    // ══════════════════════════════════════════════
    // Effects Engine — movement patterns
    // ══════════════════════════════════════════════

    startEffect(config: EffectConfig): string {
        return effectEngine.startEffect(config);
    }

    stopEffect(id: string) {
        effectEngine.stopEffect(id);
    }

    pauseEffect(id: string) {
        effectEngine.pauseEffect(id);
    }

    resumeEffect(id: string) {
        effectEngine.resumeEffect(id);
    }

    updateEffect(id: string, partial: Partial<EffectConfig>) {
        effectEngine.updateEffect(id, partial);
    }

    stopAllEffects() {
        effectEngine.stopAll();
    }

    getEffectStatus(id: string): string | null {
        return effectEngine.getEffectStatus(id);
    }

    // ══════════════════════════════════════════════
    // Core Loop
    // ══════════════════════════════════════════════

    start() {
        if (this.tid !== null) return;
        this.started = true;
        this.tid = setInterval(() => this.flush(), Math.round(1000 / this.FPS));
    }

    stop() {
        if (this.tid !== null) { clearInterval(this.tid); this.tid = null; }
        this.started = false;
    }

    isRunning(): boolean {
        return this.started;
    }

    setOutputGate(outputs: Partial<DmxOutputGate>) {
        this.outputGate = { ...this.outputGate, ...outputs };
    }

    getOutputGate(): DmxOutputGate {
        return { ...this.outputGate };
    }

    private flush() {
        if (!this.outputGate.qlcOsc && !this.outputGate.qlcWs && !this.outputGate.artNet && !this.outputGate.usbDmx) {
            return;
        }

        this.frames.forEach((chMap, universe) => {
            if (!this.prev.has(universe)) this.prev.set(universe, new Map());
            const prevMap = this.prev.get(universe)!;
            const forced = this.forceNext.get(universe);
            chMap.forEach((value, channel) => {
                if (forced?.has(channel) || prevMap.get(channel) !== value) {
                    if (socket.connected) {
                        socket.emit('dmx_update', { universe, channel, value });
                    }
                    prevMap.set(channel, value);
                }
            });
            if (forced) forced.clear();
        });
    }
}

export const dmxEngine = new DmxEngine();

if (typeof window !== 'undefined') {
    dmxEngine.start();
}
