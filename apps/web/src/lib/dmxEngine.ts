/**
 * DMX Engine — centralized output buffer.
 * All nodes write via setChannel(); the engine flushes at 44 Hz,
 * only emitting channels whose value has actually changed.
 */
import { socket } from './socket';

type ChannelMap = Map<number, number>; // channel → value 0-255

class DmxEngine {
    private frames = new Map<number, ChannelMap>(); // universe → channels
    private prev   = new Map<number, ChannelMap>(); // last-sent snapshot
    private tid: ReturnType<typeof setInterval> | null = null;
    readonly FPS = 44;

    setChannel(universe: number, channel: number, value: number) {
        if (!this.frames.has(universe)) this.frames.set(universe, new Map());
        this.frames.get(universe)!.set(channel, Math.round(Math.max(0, Math.min(255, value))));
    }

    setRGB(universe: number, rCh: number, gCh: number, bCh: number, r: number, g: number, b: number) {
        this.setChannel(universe, rCh, r);
        this.setChannel(universe, gCh, g);
        this.setChannel(universe, bCh, b);
    }

    getChannel(universe: number, channel: number): number {
        return this.frames.get(universe)?.get(channel) ?? 0;
    }

    start() {
        if (this.tid !== null) return;
        this.tid = setInterval(() => this.flush(), Math.round(1000 / this.FPS));
    }

    stop() {
        if (this.tid !== null) { clearInterval(this.tid); this.tid = null; }
    }

    private flush() {
        this.frames.forEach((chMap, universe) => {
            if (!this.prev.has(universe)) this.prev.set(universe, new Map());
            const prevMap = this.prev.get(universe)!;
            chMap.forEach((value, channel) => {
                if (prevMap.get(channel) !== value) {
                    socket.emit('dmx_update', { universe, channel, value });
                    prevMap.set(channel, value);
                }
            });
        });
    }
}

export const dmxEngine = new DmxEngine();

// Auto-start on client side
if (typeof window !== 'undefined') {
    dmxEngine.start();
}
