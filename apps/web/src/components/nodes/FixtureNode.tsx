'use client';

import React, { useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { API_BASE } from '../../lib/config';

interface DmxChannel {
    channel: number;
    function: string;
    type: string;
    minValue?: number;
    maxValue?: number;
    notes?: string;
}

interface FixtureMode { name: string; channels: DmxChannel[]; }

interface FixtureNodeData {
    label: string;
    fixtureId?: number;
    fixtureName?: string;
    manufacturer?: string;
    totalChannels?: number;
    startAddress?: number;
    universe?: number;
    channels?: DmxChannel[];
    modes?: FixtureMode[];
    activeMode?: string;
}

// Couleur par type de channel DMX
const TYPE_COLOR: Record<string, string> = {
    dimmer: '#facc15', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
    white: '#e2e8f0', amber: '#f97316', uv: '#a855f7',
    pan: '#38bdf8', tilt: '#0ea5e9', pan_fine: '#7dd3fc', tilt_fine: '#bae6fd',
    gobo: '#c084fc', color_wheel: '#e879f9', strobe: '#fb923c',
    shutter: '#fbbf24', zoom: '#34d399', focus: '#6ee7b7',
    iris: '#2dd4bf', prism: '#818cf8', speed: '#a78bfa',
    macro: '#f472b6', sound: '#fb7185', reset: '#94a3b8', other: '#475569',
};

export default function FixtureNode({ data, selected }: { id: string; data: FixtureNodeData; selected?: boolean }) {
    const [channels, setChannels] = useState<DmxChannel[]>(data.channels || []);
    const [modes, setModes] = useState<FixtureMode[]>(data.modes || []);
    const [activeMode, setActiveMode] = useState(data.activeMode || '');
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        // Charger les channels depuis l'API si pas encore chargés
        if (data.fixtureId && channels.length === 0) {
            fetch(`${API_BASE}/api/fixtures/${data.fixtureId}`)
                .then(r => r.ok ? r.json() : null)
                .then(fx => {
                    if (!fx) { setLoadError(true); return; }
                    const mds: FixtureMode[] = fx.modes?.length > 0 ? fx.modes : [{ name: 'Default', channels: fx.channels }];
                    setModes(mds);
                    setChannels(mds[0].channels);
                    setActiveMode(mds[0].name);
                })
                .catch(() => setLoadError(true));
        }
    }, [data.fixtureId, channels.length]);

    const switchMode = (modeName: string) => {
        const m = modes.find(m => m.name === modeName);
        if (m) { setChannels(m.channels); setActiveMode(modeName); }
    };

    const startAddr = data.startAddress ?? 1;
    const universe  = data.universe  ?? 1;

    return (
        <>
            <NodeResizer
                minWidth={240} minHeight={120}
                isVisible={selected}
                lineClassName="border-purple-500"
                handleClassName="h-3 w-3 bg-purple-500 border-2 border-black rounded-sm"
            />
            <div className={`w-full h-full flex flex-col relative overflow-hidden rounded-xl backdrop-blur-xl transition-all duration-300 ${
                selected
                    ? 'bg-[#12141a]/95 ring-1 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
                    : 'bg-[#12141a]/70 ring-1 ring-purple-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-purple-500/60'
            }`}>

                {/* Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[50px] pointer-events-none" />

                {/* Header */}
                <div className="h-8 bg-gradient-to-r from-purple-500/15 to-transparent border-b border-purple-500/20 flex items-center justify-between px-3 relative z-10 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)] shrink-0" />
                        <span className="text-[10px] font-black text-purple-100 uppercase tracking-[0.15em] truncate">
                            {data.fixtureName || data.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[8px] font-mono text-purple-300/70 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            U{universe}/@{startAddr}
                        </span>
                    </div>
                </div>

                {/* Manufacturer + mode selector */}
                <div className="px-3 pt-1.5 pb-1 flex items-center justify-between gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 truncate">{data.manufacturer || ''}</span>
                    {modes.length > 1 && (
                        <select
                            value={activeMode}
                            onChange={(e) => switchMode(e.target.value)}
                            className="text-[9px] bg-black/40 border border-purple-500/20 text-purple-300 rounded px-1 py-0.5 outline-none nodrag"
                        >
                            {modes.map(m => <option key={m.name} value={m.name}>{m.name} ({m.channels.length}ch)</option>)}
                        </select>
                    )}
                </div>

                {/* Channel list */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 relative z-10 min-h-0">
                    {loadError && (
                        <p className="text-red-400 text-[10px] text-center py-2">Fixture introuvable</p>
                    )}
                    {channels.map((ch) => {
                        const color = TYPE_COLOR[ch.type] || TYPE_COLOR.other;
                        const absAddr = startAddr + ch.channel - 1;
                        return (
                            <div key={`${ch.channel}`} className="relative flex items-center gap-2 py-0.5 group/ch">
                                {/* Left label */}
                                <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-4">
                                    <span className="text-[9px] font-mono w-6 text-right shrink-0" style={{ color: `${color}99` }}>
                                        {absAddr}
                                    </span>
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-[10px] text-slate-300 truncate">{ch.function}</span>
                                    <span className="text-[8px] text-slate-600 shrink-0">{ch.type}</span>
                                </div>
                                {/* Handle target on the left (receive signal from Slider/LFO) */}
                                <Handle
                                    type="target"
                                    position={Position.Left}
                                    id={`ch-${ch.channel}`}
                                    style={{
                                        top: '50%',
                                        left: -8,
                                        width: 10,
                                        height: 10,
                                        background: color,
                                        border: '2px solid #12141a',
                                        borderRadius: 3,
                                        boxShadow: `0 0 6px ${color}80`,
                                    }}
                                />
                            </div>
                        );
                    })}

                    {channels.length === 0 && !loadError && (
                        <p className="text-slate-600 text-[10px] text-center py-3">Chargement...</p>
                    )}
                </div>

                {/* Footer */}
                <div className="h-5 border-t border-purple-500/10 bg-black/20 flex items-center px-3 shrink-0">
                    <span className="text-[9px] text-slate-600 font-mono">
                        {channels.length}ch · {activeMode || 'Default'}
                    </span>
                </div>
            </div>
        </>
    );
}
