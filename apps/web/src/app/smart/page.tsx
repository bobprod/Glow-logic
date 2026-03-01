/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';

export default function SmartSyncHub() {
    return (
        <div className="w-full h-full flex flex-col bg-[#12141a] p-8 overflow-y-auto">

            {/* HEADER BAR (Identique à la maquette) */}
            <div className="flex items-center justify-between h-16 bg-[#1a1c23]/80 border border-[#262c36] rounded-xl px-6 shadow-lg mb-8">

                {/* Left: BPM & Sync */}
                <div className="flex items-center gap-6">
                    <div className="flex items-baseline gap-1">
                        <span className="text-cyan-400 text-3xl font-black tracking-tighter">128.5</span>
                        <span className="text-cyan-400/50 text-sm font-bold tracking-widest">BPM</span>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-700"></div>
                    <div className="flex items-center gap-2">
                        <div className="relative flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-green-500/20 absolute animate-ping"></div>
                            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-[#1a1c23] z-10"></div>
                        </div>
                        <span className="text-slate-300 text-xs font-bold font-mono">Sync: Ableton 1</span>
                    </div>
                </div>

                {/* Center: Waveform & Vibe */}
                <div className="flex items-center gap-6">
                    {/* Waveform CSS */}
                    <div className="flex items-center gap-[2px] h-6 opacity-70">
                        {[...Array(15)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-cyan-500 rounded-full animate-pulse"
                                style={{
                                    height: `${20 + ((i * 37) % 80)}%`,
                                    animationDelay: `${i * 0.1}s`
                                }}
                            ></div>
                        ))}
                    </div>

                    <div className="bg-pink-500/10 border border-pink-500/30 px-3 py-1 rounded-full">
                        <span className="text-pink-400 text-xs font-bold">Vibe: Drop / Agressif</span>
                    </div>
                </div>

                {/* Right: SMART Toggle & Network */}
                <div className="flex items-center gap-6">
                    {/* SMART Toggle */}
                    <div className="bg-[#262c36] border border-slate-700 rounded-full p-1 flex items-center h-8 cursor-pointer relative w-32">
                        <div className="absolute left-3 text-cyan-400 text-xs font-black tracking-widest z-10">SMART</div>
                        <div className="absolute right-3 text-pink-500 text-[10px] font-bold z-10">(PRO)</div>
                        {/* Toggle Handle */}
                        <div className="w-6 h-6 rounded-full bg-slate-400 shadow absolute right-1"></div>
                    </div>
                </div>
            </div>

            {/* Main Content Title */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-white text-lg font-black tracking-widest">SMART SYNC HUB</h1>

                {/* Network Status Inline */}
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-600"></div> Art-Net</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div> RDM</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div> Wi-Fi</div>
                </div>
            </div>


            {/* TOP SECTIONS */}
            <div className="grid grid-cols-[1fr_350px] gap-6 mb-6">

                {/* STAGE VIEW & AI TRACKING */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-slate-300 text-xs font-bold tracking-widest uppercase">STAGE VIEW & AI TRACKING</h2>
                    <div className="w-full h-[400px] bg-[#0a0c10] border border-[#262c36] rounded-xl relative overflow-hidden flex items-center justify-center">

                        {/* Fake Video Feed Background (Using a dark green/gray gradient to simulate raw camera feed) */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#111e1c] to-[#0d1414] opacity-80 mix-blend-screen"></div>

                        {/* Fake silhouette (Simulating the person in the mockup) */}
                        <div className="w-32 h-64 bg-slate-800/50 rounded-full blur-md absolute bottom-0"></div>

                        {/* UI Overlay */}
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
                            <span className="text-slate-300 text-xs font-bold tracking-wider">REC - Caméra 1</span>
                        </div>

                        {/* AI Tracking Reticle */}
                        <div className="absolute top-[40%] left-[45%]">
                            <div className="w-32 h-32 rounded-full border border-green-500/50 bg-green-500/10 flex items-center justify-center absolute -translate-x-1/2 -translate-y-1/2">
                                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]"></div>
                            </div>
                            {/* Label */}
                            <div className="absolute top-4 left-4 border border-green-500 bg-[#12141a]/80 px-2 py-1 select-none backdrop-blur-sm">
                                <span className="text-green-400 text-[10px] font-mono whitespace-nowrap">Cible IA (Conférencier)</span>
                            </div>

                            {/* Tracking Lines */}
                            <svg className="absolute top-0 left-0 w-[500px] h-[300px] overflow-visible pointer-events-none" style={{ transform: 'translate(0, 0)' }}>
                                <line x1="0" y1="0" x2="250" y2="-50" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
                                <line x1="0" y1="0" x2="180" y2="150" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
                            </svg>
                        </div>

                        {/* Fixtures Nodes in Video Feed */}
                        <div className="absolute top-[30%] right-[20%] flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center bg-[#12141a]">
                                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_cyan]"></div>
                            </div>
                            <span className="text-slate-300 text-xs font-bold">Lyre 1</span>
                        </div>

                        <div className="absolute bottom-[20%] right-[30%] flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center bg-[#12141a]">
                                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_cyan]"></div>
                            </div>
                            <span className="text-slate-300 text-xs font-bold">Lyre 2</span>
                        </div>

                    </div>
                </div>

                {/* PIXEL & SHAPE ENGINE */}
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-end">
                        <h2 className="text-slate-300 text-xs font-bold tracking-widest uppercase">PIXEL & SHAPE ENGINE</h2>
                        <span className="text-slate-500 text-[10px] font-bold">Médias (GIF)</span>
                    </div>

                    <div className="w-full h-[400px] bg-[#1a1c23] border border-[#262c36] rounded-xl p-6 flex flex-col">

                        {/* Shapes Grid */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {/* Cercle */}
                            <button className="aspect-square rounded border border-cyan-500 bg-cyan-500/10 flex flex-col items-center justify-center gap-2 hover:bg-cyan-500/20 transition-all text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                <div className="w-8 h-8 rounded-full border-2 border-current"></div>
                                <span className="text-[10px] font-bold">Cercle</span>
                            </button>

                            {/* Infini */}
                            <button className="aspect-square rounded border border-pink-500/50 hover:border-pink-500 bg-[#12141a] flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-pink-400 transition-all group">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4Z" /></svg>
                                <span className="text-[10px] font-bold">Infini</span>
                            </button>

                            {/* Sweep */}
                            <button className="aspect-square rounded border border-cyan-500/50 hover:border-cyan-500 bg-[#12141a] flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-cyan-400 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3v6h-6" /><path d="M21 3 9 15" /><path d="M15 21H3V9" /></svg>
                                <span className="text-[10px] font-bold">Sweep</span>
                            </button>

                            {/* Vague */}
                            <button className="aspect-square rounded border border-[#262c36] hover:border-slate-500 bg-[#12141a] flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-white transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-9 5 18 3-9h5" /></svg>
                                <span className="text-[10px] font-bold">—</span>
                            </button>

                            {/* Vague 2 */}
                            <button className="aspect-square rounded border border-[#262c36] hover:border-slate-500 bg-[#12141a] flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-white transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v.01" /><path d="M8 12v.01" /><path d="M12 12v.01" /><path d="M16 12v.01" /><path d="M20 12v.01" /></svg>
                                <span className="text-[10px] font-bold">Vage</span>
                            </button>

                            {/* Arrow */}
                            <button className="aspect-square rounded border border-[#262c36] hover:border-slate-500 bg-[#12141a] flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-white transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 7 10 10" /><path d="M17 7v10H7" /></svg>
                                <span className="text-[10px] font-bold">—</span>
                            </button>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-6 mt-auto">
                            <div className="flex items-center gap-4">
                                <span className="text-slate-400 text-xs w-16">Vitesse:</span>
                                <input type="range" className="flex-1 accent-cyan-400 h-1 bg-slate-800 rounded-full appearance-none" />
                                <span className="text-slate-500 text-xs w-8 text-right">40</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-slate-400 text-xs w-16">Taille:</span>
                                <input type="range" className="flex-1 accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none" />
                                <span className="text-slate-500 text-xs w-8 text-right">80</span>
                            </div>
                        </div>

                        {/* Checkbox */}
                        <div className="mt-6 flex items-center gap-3">
                            <div className="w-4 h-4 rounded border border-cyan-500 flex items-center justify-center bg-cyan-500/20 text-cyan-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </div>
                            <span className="text-slate-300 text-xs font-bold">Synchroniser au BPM</span>
                        </div>

                    </div>
                </div>

            </div>

            {/* SMART SCENE LAUNCHER */}
            <h2 className="text-slate-300 text-xs font-bold tracking-widest uppercase mb-3">SMART SCENE LAUNCHER</h2>

            <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-4 shadow-lg flex flex-col gap-4">

                {/* Buttons Row */}
                <div className="flex gap-4">

                    <button className="flex-1 max-w-[200px] h-16 rounded border border-orange-500/50 bg-[#12141a] hover:bg-[#1a1c23] transition-all flex items-center gap-3 px-4">
                        <div className="w-8 h-8 rounded border-2 border-orange-500 text-orange-500 flex items-center justify-center font-black">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                        </div>
                        <span className="text-orange-400 text-xs font-bold w-1/2 text-left leading-tight">Générer Show IA (MP3)</span>
                    </button>

                    <button className="flex-1 h-16 rounded border border-[#262c36] bg-[#12141a] hover:border-slate-500 transition-all flex flex-col justify-center px-4 relative">
                        <span className="text-white text-sm font-bold block">1. Intro</span>
                        <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Rouge Maison</div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Fade: 1s</div>
                        </div>
                    </button>

                    <button className="flex-1 h-16 rounded border border-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all flex flex-col justify-center px-4 relative shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                        <span className="text-white text-sm font-bold block">2. Le Discours</span>
                        <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs"><div className="w-2 h-2 rounded-full bg-white"></div> Blanc Chaud</div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Fade: 1s</div>
                        </div>
                    </button>

                    <button className="flex-1 h-16 rounded border border-red-500/50 bg-[#12141a] hover:bg-[#1a1c23] transition-all flex flex-col justify-center px-4 relative">
                        <span className="text-white text-sm font-bold block">3. Main Drop</span>
                        <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs"><div className="w-2 h-2 rounded-full border-2 border-red-500"></div> Audio-React</div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Fade: 1s</div>
                        </div>
                    </button>

                </div>

                {/* AI MessageBox Bottom */}
                <div className="w-full bg-[#12141a] border border-[#262c36] p-3 rounded flex gap-4 items-center">
                    <span className="text-slate-500 font-black px-2">&gt;</span>
                    <div className="flex flex-col flex-1 pl-2 border-l border-slate-700">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 border-2 border-slate-400 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-slate-400 rounded-full"></div></div>
                            <span className="text-slate-400 font-bold text-xs tracking-widest">Antigravity AI:</span>
                        </div>
                        <p className="text-slate-500 text-[11px] font-mono leading-tight">
                            "Prêt pour live. Lyres synchronisées sur réticule.<br />
                            _(Tape ton ordre ici ou utilise micro...._
                        </p>
                    </div>
                </div>

            </div>

        </div>
    );
}
