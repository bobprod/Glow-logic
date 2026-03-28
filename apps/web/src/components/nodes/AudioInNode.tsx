"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import useStore from '../../store/useStore';
import { dmxEngine } from '../../lib/dmxEngine';

type Band = 'rms' | 'bass' | 'mid' | 'high';
type BandValues = Record<Band, number>; // 0-255

function analyzeBands(analyser: AnalyserNode): BandValues {
    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);
    const bassBins = freq.slice(0, 4);
    const midBins  = freq.slice(4, 20);
    const highBins = freq.slice(20, 64);
    const avg = (arr: Uint8Array) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const time = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i++) { const v = (time[i] - 128) / 128; sum += v * v; }
    return {
        rms:  Math.min(255, Math.round(Math.sqrt(sum / time.length) * 255 * 3)),
        bass: Math.min(255, Math.round(avg(bassBins) * 1.5)),
        mid:  Math.min(255, Math.round(avg(midBins))),
        high: Math.min(255, Math.round(avg(highBins))),
    };
}

const BAND_COLORS: Record<Band, string> = {
    rms: '#a855f7', bass: '#ef4444', mid: '#22c55e', high: '#3b82f6',
};

export default function AudioInNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
    const updateNodeData = useStore(s => s.updateNodeData);
    const edges = useStore(s => s.edges);
    const nodes = useStore(s => s.nodes);

    const [active, setActive] = useState(false);
    const [bands, setBands] = useState<BandValues>({ rms: 0, bass: 0, mid: 0, high: 0 });
    const [micError, setMicError] = useState<string | null>(null);

    const ctxRef      = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef      = useRef<number | null>(null);
    const streamRef   = useRef<MediaStream | null>(null);

    const outputBand: Band  = (data.outputBand as Band)      ?? 'rms';
    const universe: number  = (data.universe as number)       ?? 1;
    const channel: number   = (data.channel as number)        ?? 1;
    const sensitivity: number = (data.sensitivity as number)  ?? 1.0;

    const startCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;
            const ctx = new AudioContext();
            ctxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.6;
            analyserRef.current = analyser;
            ctx.createMediaStreamSource(stream).connect(analyser);
            setActive(true);
            setMicError(null);
        } catch {
            setMicError('Microphone access denied');
        }
    }, []);

    const stopCapture = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        ctxRef.current?.close();
        ctxRef.current = null; analyserRef.current = null; streamRef.current = null;
        setActive(false);
        setBands({ rms: 0, bass: 0, mid: 0, high: 0 });
    }, []);

    // Analysis + DMX output loop
    useEffect(() => {
        if (!active || !analyserRef.current) return;
        const tick = () => {
            if (!analyserRef.current) return;
            const b = analyzeBands(analyserRef.current);
            const boosted: BandValues = {
                rms:  Math.min(255, Math.round(b.rms  * sensitivity)),
                bass: Math.min(255, Math.round(b.bass * sensitivity)),
                mid:  Math.min(255, Math.round(b.mid  * sensitivity)),
                high: Math.min(255, Math.round(b.high * sensitivity)),
            };
            setBands(boosted);
            const dmxValue = boosted[outputBand];
            const targets = edges
                .filter(e => e.source === id)
                .map(e => nodes.find(n => n.id === e.target))
                .filter(n => n?.type === 'dmxOutput');
            if (targets.length > 0) {
                targets.forEach(t => { if (t) dmxEngine.setChannel((t.data.universe as number) ?? 1, (t.data.channel as number) ?? 1, dmxValue); });
            } else {
                dmxEngine.setChannel(universe, channel, dmxValue);
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [active, outputBand, sensitivity, universe, channel, edges, nodes, id]);

    useEffect(() => () => stopCapture(), [stopCapture]);

    const activeColor = BAND_COLORS[outputBand];

    return (
        <>
            <NodeResizer minWidth={220} minHeight={270} isVisible={selected}
                lineClassName="border-purple-500"
                handleClassName="h-3 w-3 bg-purple-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-300
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20'}`}>

                <div className="absolute top-1/2 -translate-y-1/2 -left-6 w-24 h-24 bg-purple-500/10 rounded-full blur-[40px] pointer-events-none opacity-50" />

                {/* Header */}
                <div className="h-7 bg-gradient-to-r from-purple-500/10 to-transparent border-b border-white/5 flex items-center justify-between px-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${active ? 'bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-slate-600'}`} />
                        <span className="text-[10px] font-bold text-purple-100/90 uppercase tracking-[0.2em]">Audio IN</span>
                    </div>
                    {active && <span className="text-[8px] text-purple-400/70 font-mono animate-pulse">LIVE</span>}
                </div>

                {/* VU Bars — bass / mid / high / rms */}
                <div className="px-3 pt-3 flex gap-1.5 flex-shrink-0">
                    {(['bass', 'mid', 'high', 'rms'] as Band[]).map(band => (
                        <div key={band} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full h-16 bg-black/40 rounded border border-white/5 flex flex-col-reverse overflow-hidden">
                                <div
                                    className="w-full rounded-t"
                                    style={{
                                        height: `${(bands[band] / 255) * 100}%`,
                                        background: BAND_COLORS[band],
                                        boxShadow: bands[band] > 15 ? `0 0 8px ${BAND_COLORS[band]}80` : 'none',
                                        transition: 'height 60ms linear',
                                    }}
                                />
                            </div>
                            <span className="text-[7px] font-bold uppercase" style={{ color: BAND_COLORS[band] }}>
                                {band === 'rms' ? 'LVL' : band}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Output band selector */}
                <div className="px-3 pt-2 flex-shrink-0">
                    <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1">Output Band</p>
                    <div className="flex gap-1">
                        {(['rms', 'bass', 'mid', 'high'] as Band[]).map(b => (
                            <button
                                key={b}
                                onClick={() => updateNodeData(id, { outputBand: b })}
                                className={`flex-1 py-1 text-[8px] font-bold rounded nodrag transition-all border ${outputBand === b ? 'border-current' : 'border-white/5 text-slate-500 bg-black/20'}`}
                                style={outputBand === b ? { color: BAND_COLORS[b], background: `${BAND_COLORS[b]}20`, borderColor: `${BAND_COLORS[b]}60` } : {}}
                            >
                                {b === 'rms' ? 'LVL' : b.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sensitivity slider */}
                <div className="px-3 pt-2 flex-shrink-0">
                    <label className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500 uppercase tracking-wider">Sensibilité</span>
                            <span className="font-mono" style={{ color: activeColor }}>{sensitivity.toFixed(1)}x</span>
                        </div>
                        <input type="range" min="0.1" max="4" step="0.1" value={sensitivity}
                            onChange={e => updateNodeData(id, { sensitivity: parseFloat(e.target.value) })}
                            className="nodrag w-full h-1.5" style={{ accentColor: activeColor }} />
                    </label>
                </div>

                {/* Channel config */}
                <div className="flex gap-1 px-3 pt-2 text-[9px] flex-shrink-0">
                    <label className="flex-1 flex flex-col gap-0.5">
                        <span className="text-slate-500 uppercase tracking-wider">Univers</span>
                        <input type="number" min="1" max="8" value={universe}
                            onChange={e => updateNodeData(id, { universe: parseInt(e.target.value) })}
                            className="nodrag w-full bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-white text-[9px] outline-none" />
                    </label>
                    <label className="flex-1 flex flex-col gap-0.5">
                        <span className="text-slate-500 uppercase tracking-wider">Canal</span>
                        <input type="number" min="1" max="512" value={channel}
                            onChange={e => updateNodeData(id, { channel: parseInt(e.target.value) })}
                            className="nodrag w-full bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-white text-[9px] outline-none" />
                    </label>
                </div>

                {/* Start/Stop button */}
                <div className="px-3 pt-2 pb-2 flex-1 flex flex-col justify-end">
                    {micError && <p className="text-red-400 text-[8px] mb-1">{micError}</p>}
                    <button
                        onClick={() => active ? stopCapture() : startCapture()}
                        className={`nodrag w-full py-1.5 rounded-lg text-[10px] font-bold transition-all border ${active
                            ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                            : 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'}`}
                    >
                        {active ? 'Stop Capture' : 'Start Capture'}
                    </button>
                </div>

                <Handle type="source" position={Position.Right}
                    className="w-3 h-6 rounded-md border-2 border-[#12141a] !-right-1.5"
                    style={{ background: activeColor, boxShadow: `0 0 10px ${activeColor}60` }} />
            </div>
        </>
    );
}
