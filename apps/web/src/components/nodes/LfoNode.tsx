"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import useStore from '../../store/useStore';
import { NodeData } from '../../types/nodes';
import { dmxEngine } from '../../lib/dmxEngine';

type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';

const WAVES: { id: Wave; label: string; path: string }[] = [
    { id: 'sine',     label: '~', path: 'M0,16 C8,2 16,2 24,16 S40,30 48,16' },
    { id: 'square',   label: '⊓', path: 'M0,28 L0,4 L24,4 L24,28 L48,28' },
    { id: 'triangle', label: '∧', path: 'M0,28 L24,4 L48,28' },
    { id: 'sawtooth', label: '⊿', path: 'M0,28 L48,4 L48,28' },
];

function computeWave(wave: Wave, phase: number): number {
    const t = phase % 1;
    switch (wave) {
        case 'sine':     return Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
        case 'square':   return t < 0.5 ? 1 : 0;
        case 'triangle': return t < 0.5 ? t * 2 : 2 - t * 2;
        case 'sawtooth': return t;
    }
}

export default function LfoNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
    const updateNodeData = useStore(s => s.updateNodeData);
    const edges = useStore(s => s.edges);
    const nodes = useStore(s => s.nodes);

    const freq: number     = (data.freq as number)    ?? 0.5;   // Hz
    const depth: number    = (data.depth as number)   ?? 255;
    const offset: number   = (data.offset as number)  ?? 0;
    const wave: Wave       = (data.wave as Wave)      ?? 'sine';
    const universe: number = (data.universe as number) ?? 1;
    const channel: number  = (data.channel as number)  ?? 1;

    const [phase, setPhase] = useState(0);
    const rafRef = useRef<number | null>(null);
    const lastTsRef = useRef<number>(performance.now());

    // Animate phase
    useEffect(() => {
        const tick = (ts: number) => {
            const dt = (ts - lastTsRef.current) / 1000;
            lastTsRef.current = ts;
            setPhase(p => p + freq * dt);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [freq]);

    // ── Signal Flow: route via edges or use own universe/channel ──
    useEffect(() => {
        const raw = computeWave(wave, phase);
        const dmxValue = Math.round(Math.min(255, Math.max(0, offset + raw * depth)));
        const targets = edges
            .filter(e => e.source === id)
            .map(e => nodes.find(n => n.id === e.target))
            .filter(n => n?.type === 'dmxOutput');
        if (targets.length > 0) {
            targets.forEach(t => { if (t) dmxEngine.setChannel((t.data.universe as number) ?? 1, (t.data.channel as number) ?? 1, dmxValue); });
        } else {
            dmxEngine.setChannel(universe, channel, dmxValue);
        }
    }, [phase, wave, depth, offset, universe, channel, edges, nodes, id]);

    const currentRaw = computeWave(wave, phase);
    const displayVal = Math.round(offset + currentRaw * depth);
    const pct = displayVal / 255;

    return (
        <>
            <NodeResizer minWidth={180} minHeight={220} isVisible={selected}
                lineClassName="border-green-500"
                handleClassName="h-3 w-3 bg-green-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-200
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20'}`}>

                {/* Glow */}
                <div className="absolute -top-6 -left-6 w-20 h-20 bg-green-500/20 rounded-full blur-[30px] pointer-events-none opacity-60" />

                {/* Header */}
                <div className="h-7 bg-gradient-to-r from-green-500/10 to-transparent border-b border-white/5 flex items-center px-3 gap-2 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                    <span className="text-[10px] font-bold text-green-100/90 uppercase tracking-[0.2em]">LFO</span>
                    <span className="text-[9px] text-green-400/60 ml-auto">{freq.toFixed(2)} Hz</span>
                </div>

                {/* Waveform selector */}
                <div className="flex gap-1 px-3 pt-2 flex-shrink-0">
                    {WAVES.map(w => (
                        <button
                            key={w.id}
                            onClick={() => updateNodeData(id, { wave: w.id })}
                            className={`flex-1 text-[9px] py-1 rounded font-bold transition-all nodrag ${wave === w.id
                                ? 'bg-green-500/30 text-green-400 border border-green-500/40'
                                : 'bg-black/20 text-slate-500 border border-white/5 hover:text-slate-300'}`}
                        >
                            {w.label}
                        </button>
                    ))}
                </div>

                {/* Mini oscilloscope */}
                <div className="px-3 pt-2 flex-shrink-0">
                    <svg viewBox="0 0 100 32" className="w-full h-8 rounded bg-black/30">
                        <polyline
                            points={Array.from({ length: 101 }, (_, i) => {
                                const v = computeWave(wave, phase + (i - 50) / 100 * (1 / freq * 2));
                                return `${i},${32 - v * 28}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#4ade80"
                            strokeWidth="1.5"
                        />
                        {/* Cursor */}
                        <line x1="50" y1="0" x2="50" y2="32" stroke="#4ade80" strokeWidth="0.5" strokeDasharray="2 2" />
                    </svg>
                </div>

                {/* Controls */}
                <div className="flex-1 px-3 py-2 flex flex-col gap-2 overflow-y-auto">
                    {/* Freq */}
                    <label className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500 uppercase tracking-wider">Fréq.</span>
                            <span className="text-green-400 font-mono">{freq.toFixed(2)} Hz</span>
                        </div>
                        <input type="range" min="0.05" max="10" step="0.05" value={freq}
                            onChange={e => updateNodeData(id, { freq: parseFloat(e.target.value) })}
                            className="nodrag w-full accent-green-400 h-1.5" />
                    </label>

                    {/* Depth */}
                    <label className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500 uppercase tracking-wider">Profondeur</span>
                            <span className="text-green-400 font-mono">{depth}</span>
                        </div>
                        <input type="range" min="0" max="255" step="1" value={depth}
                            onChange={e => updateNodeData(id, { depth: parseInt(e.target.value) })}
                            className="nodrag w-full accent-green-400 h-1.5" />
                    </label>

                    {/* Offset */}
                    <label className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500 uppercase tracking-wider">Offset</span>
                            <span className="text-green-400 font-mono">{offset}</span>
                        </div>
                        <input type="range" min="0" max="255" step="1" value={offset}
                            onChange={e => updateNodeData(id, { offset: parseInt(e.target.value) })}
                            className="nodrag w-full accent-green-400 h-1.5" />
                    </label>

                    {/* Target channel */}
                    <div className="flex gap-1 text-[9px] mt-1">
                        <label className="flex-1 flex flex-col gap-0.5">
                            <span className="text-slate-500 uppercase tracking-wider">Univers</span>
                            <input type="number" min="1" max="8" value={universe}
                                onChange={e => updateNodeData(id, { universe: parseInt(e.target.value) })}
                                className="nodrag w-full bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] outline-none focus:border-green-500/50" />
                        </label>
                        <label className="flex-1 flex flex-col gap-0.5">
                            <span className="text-slate-500 uppercase tracking-wider">Canal</span>
                            <input type="number" min="1" max="512" value={channel}
                                onChange={e => updateNodeData(id, { channel: parseInt(e.target.value) })}
                                className="nodrag w-full bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] outline-none focus:border-green-500/50" />
                        </label>
                    </div>
                </div>

                {/* DMX value indicator */}
                <div className="flex items-center gap-2 px-3 pb-2 flex-shrink-0">
                    <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full transition-none" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="text-green-400 font-mono text-[10px] w-8 text-right">{displayVal}</span>
                </div>

                <Handle type="source" position={Position.Right}
                    className="w-3 h-6 rounded-md bg-green-500 border-2 border-[#12141a] !-right-1.5 shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
            </div>
        </>
    );
}
