'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/config';

interface FixtureListing {
    id: number;
    name: string;
    manufacturer: string | null;
    total_channels: number;
    start_address: number;
}

export default function Sidebar() {
    const [width, setWidth] = useState(300);
    const [isResizing, setIsResizing] = useState(false);
    const [fixtures, setFixtures] = useState<FixtureListing[]>([]);
    const [fixturesOpen, setFixturesOpen] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/api/fixtures`)
            .then(r => r.ok ? r.json() : [])
            .then(setFixtures)
            .catch(() => {});
    }, []);

    const onDragStart = (event: React.DragEvent, nodeType: string, label: string, extra?: object) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label, ...extra }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onFixtureDragStart = (event: React.DragEvent, fixture: FixtureListing) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify({
            type: 'fixtureNode',
            label: fixture.name,
            fixtureId: fixture.id,
            fixtureName: fixture.name,
            manufacturer: fixture.manufacturer,
            totalChannels: fixture.total_channels,
            startAddress: fixture.start_address,
            universe: 1,
        }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing  = useCallback(() => setIsResizing(false), []);
    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) setWidth(Math.max(220, Math.min(600, e.clientX)));
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <aside
            className="relative border-r border-[#262c36] bg-[#12141a] p-6 flex flex-col pt-8 z-10 shadow-xl h-full overflow-y-auto"
            style={{ width: `${width}px` }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={startResizing}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors z-20"
            />

            <div className="text-white text-lg font-black tracking-wider mb-6 pb-2 border-b border-[#262c36] flex items-center justify-between">
                <span>VISUAL PATCHING</span>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
            </div>

            {/* ── INPUTS ─────────────────────────────────────── */}
            <div className="mb-8">
                <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em] mb-4">Inputs</h3>
                <div className="flex flex-col gap-3">
                    {[
                        { type: 'audioIn',    label: 'Audio IN',      sub: 'Microphone / Loopback',  color: 'group-hover:text-cyan-400',   icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5v14M7 5v14M22 10v4M2 10v4"/></svg> },
                        { type: 'sliderInput',label: 'UI Slider',     sub: 'Dimmer Panel Control',   color: 'group-hover:text-pink-400',   icon: <div className="w-4 h-4 rounded-full bg-current"/> },
                        { type: 'padInput',   label: 'UI Pad',        sub: 'Flash Triggering',       color: 'group-hover:text-yellow-400', icon: <div className="w-4 h-4 rounded border-2 border-current bg-current/20"/> },
                    ].map(({ type, label, sub, color, icon }) => (
                        <div key={type}
                            className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-cyan-500/50 hover:bg-[#1a1c23]/80 transition-all"
                            onDragStart={(e) => onDragStart(e, type, label)} draggable
                        >
                            <div className={`w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 ${color} transition-colors`}>{icon}</div>
                            <div>
                                <div className="text-white text-sm font-semibold">{label}</div>
                                <div className="text-slate-500 text-[10px] mt-0.5">{sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── GENERATORS ─────────────────────────────────── */}
            <div className="mb-8">
                <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em] mb-4">Generators</h3>
                <div className="flex flex-col gap-3">
                    <div className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-green-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(e) => onDragStart(e, 'lfoInput', 'LFO Wave')} draggable>
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-green-400 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M0,16 C8,2 16,2 24,16 S40,30 48,16"/></svg>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">LFO Oscillator</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Sine · Square · Triangle · Saw</div>
                        </div>
                    </div>
                    <div className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-orange-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(e) => onDragStart(e, 'colorPicker', 'RGB Color')} draggable>
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <div className="w-full h-full" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}/>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">RGB Color Picker</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">DMX R/G/B Channels</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── OUTPUTS ────────────────────────────────────── */}
            <div className="mb-8">
                <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em] mb-4">Outputs</h3>
                <div className="flex flex-col gap-3">
                    <div className="group relative overflow-hidden flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-cyan-500/80 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(e) => onDragStart(e, 'artnetOut', 'Art-Net Universe')} draggable>
                        <div className="w-1 h-full bg-cyan-500 absolute left-0 top-0"/>
                        <div className="pl-3">
                            <div className="text-white text-sm font-semibold">Art-Net Interface</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Univers 1</div>
                        </div>
                    </div>
                    <div className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-cyan-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(e) => onDragStart(e, 'dmxOutput', 'DMX Fixture')} draggable>
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors">
                            <div className="w-4 h-4 bg-current transform rotate-45"/>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">DMX Fixture</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Individual Lamp</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FIXTURES LIBRARY ───────────────────────────── */}
            <div>
                <button
                    onClick={() => setFixturesOpen(o => !o)}
                    className="w-full flex items-center justify-between mb-3 group"
                >
                    <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em]">
                        Fixtures
                        <span className="ml-2 text-[9px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 rounded-full px-1.5 py-0.5">
                            {fixtures.length}
                        </span>
                    </h3>
                    <span className="text-slate-500 text-xs">{fixturesOpen ? '▲' : '▼'}</span>
                </button>

                {fixturesOpen && (
                    <div className="flex flex-col gap-2">
                        {fixtures.length === 0 ? (
                            <p className="text-slate-600 text-xs text-center py-4 border border-dashed border-slate-800 rounded-lg">
                                Aucune fixture. Scanne un manuel via SCAN FIXTURE IA.
                            </p>
                        ) : (
                            fixtures.map((f) => (
                                <div
                                    key={f.id}
                                    draggable
                                    onDragStart={(e) => onFixtureDragStart(e, f)}
                                    className="group flex gap-3 items-center p-3 rounded-lg bg-gradient-to-r from-purple-500/5 to-cyan-500/5 border border-purple-500/15 hover:border-purple-500/40 cursor-grab hover:bg-purple-500/10 transition-all"
                                >
                                    {/* Canal dots */}
                                    <div className="w-10 h-10 rounded-md bg-[#0a0c10] border border-white/5 flex items-center justify-center shrink-0 relative overflow-hidden">
                                        <span className="text-[11px] font-black text-purple-300">{f.total_channels}</span>
                                        <span className="text-[8px] text-slate-500 absolute bottom-1">ch</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-sm font-semibold truncate">{f.name}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                            {f.manufacturer && <span className="truncate">{f.manufacturer}</span>}
                                            <span className="shrink-0 font-mono text-cyan-500/70">
                                                @{f.start_address}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="text-[9px] text-purple-400 font-bold border border-purple-500/30 px-1.5 py-0.5 rounded">
                                            DRAG
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
