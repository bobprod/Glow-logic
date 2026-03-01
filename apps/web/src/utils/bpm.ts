export const MAX_TAPS = 8;

export function calcBPM(taps: number[]): number {
    if (taps.length < 2) return 0;
    const intervals = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avg > 0 ? Math.round((60000 / avg) * 10) / 10 : 0;
}
