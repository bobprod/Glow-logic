"use client";

import React, { useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import useStore from '../../store/useStore';
import { NodeData } from '../../types/nodes';
import { dmxEngine } from '../../lib/dmxEngine';

const PRESETS = [
    { name: 'Warm White', hex: '#ffd5a0' },
    { name: 'Cold White', hex: '#e8f4ff' },
    { name: 'Red',        hex: '#ff2020' },
    { name: 'Green',      hex: '#00ff44' },
    { name: 'Blue',       hex: '#0066ff' },
    { name: 'Magenta',    hex: '#ff00cc' },
    { name: 'Cyan',       hex: '#00ffee' },
    { name: 'Amber',      hex: '#ff8c00' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export default function ColorPickerNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
    const updateNodeData = useStore(s => s.updateNodeData);
    const edges = useStore(s => s.edges);
    const nodes = useStore(s => s.nodes);

    const hex: string      = (data.hex as string)      ?? '#ff0000';
    const universe: number = (data.universe as number)  ?? 1;
    const rCh: number      = (data.rCh as number)       ?? 1;
    const gCh: number      = (data.gCh as number)       ?? 2;
    const bCh: number      = (data.bCh as number)       ?? 3;

    const { r, g, b } = hexToRgb(hex);

    const emitColor = useCallback((newHex: string) => {
        const { r, g, b } = hexToRgb(newHex);
        // Signal flow: check if connected to a dmxOutput node
        const targets = edges
            .filter(e => e.source === id)
            .map(e => nodes.find(n => n.id === e.target))
            .filter(n => n?.type === 'dmxOutput');
        if (targets.length > 0) {
            // Route luminance to first connected target
            const lum = Math.round((r * 0.299 + g * 0.587 + b * 0.114));
            targets.forEach(t => { if (t) dmxEngine.setChannel((t.data.universe as number) ?? 1, (t.data.channel as number) ?? 1, lum); });
        }
        // Always also emit own RGB channels
        dmxEngine.setRGB(universe, rCh, gCh, bCh, r, g, b);
    }, [universe, rCh, gCh, bCh, edges, nodes, id]);

    const handleColorChange = (newHex: string) => {
        updateNodeData(id, { hex: newHex });
        emitColor(newHex);
    };

    return (
        <>
            <NodeResizer minWidth={180} minHeight={260} isVisible={selected}
                lineClassName="border-orange-500"
                handleClassName="h-3 w-3 bg-orange-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-200
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20'}`}>

                {/* Glow */}
                <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full blur-[30px] pointer-events-none opacity-40"
                    style={{ background: hex }} />

                {/* Header */}
                <div className="h-7 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-white/5 flex items-center px-3 gap-2 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_4px]" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
                    <span className="text-[10px] font-bold text-orange-100/90 uppercase tracking-[0.2em]">RGB Color</span>
                </div>

                {/* Color preview + picker */}
                <div className="px-3 pt-2 flex-shrink-0">
                    <div className="w-full h-12 rounded-lg border border-white/10 mb-2 relative overflow-hidden cursor-pointer"
                        style={{ background: hex }}
                        onClick={() => document.getElementById(`cp-input-${id}`)?.click()}>
                        <input
                            id={`cp-input-${id}`}
                            type="color"
                            value={hex}
                            onChange={e => handleColorChange(e.target.value)}
                            className="nodrag absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                        <span className="absolute bottom-1 right-2 text-[9px] font-mono text-white/60">{hex.toUpperCase()}</span>
                    </div>
                </div>

                {/* RGB bars */}
                <div className="px-3 flex flex-col gap-1.5 flex-shrink-0">
                    {[{ label: 'R', val: r, color: '#f87171' }, { label: 'G', val: g, color: '#4ade80' }, { label: 'B', val: b, color: '#60a5fa' }].map(ch => (
                        <div key={ch.label} className="flex items-center gap-2">
                            <span className="text-[9px] font-bold w-4" style={{ color: ch.color }}>{ch.label}</span>
                            <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(ch.val / 255) * 100}%`, background: ch.color }} />
                            </div>
                            <span className="text-[9px] font-mono w-7 text-right text-slate-400">{ch.val}</span>
                        </div>
                    ))}
                </div>

                {/* Color presets */}
                <div className="px-3 pt-3 flex-shrink-0">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Presets</span>
                    <div className="grid grid-cols-4 gap-1 mt-1.5">
                        {PRESETS.map(p => (
                            <button
                                key={p.hex}
                                onClick={() => handleColorChange(p.hex)}
                                title={p.name}
                                className={`h-6 rounded border transition-all nodrag ${hex === p.hex ? 'ring-1 ring-white scale-105' : 'border-white/10 hover:scale-105'}`}
                                style={{ background: p.hex }}
                            />
                        ))}
                    </div>
                </div>

                {/* DMX channels config */}
                <div className="px-3 pt-3 pb-2 flex-1 flex flex-col justify-end">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Canaux DMX</span>
                    <div className="flex gap-1 text-[9px]">
                        <label className="flex flex-col gap-0.5 flex-1">
                            <span className="text-red-400">Uni</span>
                            <input type="number" min="1" max="8" value={universe}
                                onChange={e => updateNodeData(id, { universe: parseInt(e.target.value) })}
                                className="nodrag bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none w-full" />
                        </label>
                        <label className="flex flex-col gap-0.5 flex-1">
                            <span className="text-red-400">R ch</span>
                            <input type="number" min="1" max="512" value={rCh}
                                onChange={e => updateNodeData(id, { rCh: parseInt(e.target.value) })}
                                className="nodrag bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none w-full" />
                        </label>
                        <label className="flex flex-col gap-0.5 flex-1">
                            <span className="text-green-400">G ch</span>
                            <input type="number" min="1" max="512" value={gCh}
                                onChange={e => updateNodeData(id, { gCh: parseInt(e.target.value) })}
                                className="nodrag bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none w-full" />
                        </label>
                        <label className="flex flex-col gap-0.5 flex-1">
                            <span className="text-blue-400">B ch</span>
                            <input type="number" min="1" max="512" value={bCh}
                                onChange={e => updateNodeData(id, { bCh: parseInt(e.target.value) })}
                                className="nodrag bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white text-[9px] outline-none w-full" />
                        </label>
                    </div>
                </div>

                <Handle type="source" position={Position.Right}
                    className="w-3 h-6 rounded-md border-2 border-[#12141a] !-right-1.5"
                    style={{ background: hex }} />
            </div>
        </>
    );
}
