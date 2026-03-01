/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';

export default function TimelineView() {
    return (
        <div className="w-full h-full flex flex-col bg-[#12141a] p-8 overflow-y-auto">

            {/* HEADER */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></svg>
                </div>
                <h1 className="text-white text-xl font-black tracking-widest">AI SHOW GENERATOR</h1>
            </div>

            <div className="max-w-5xl flex flex-col gap-6">

                {/* TOP ROW: PALETTES & GOBOS */}
                <div className="grid grid-cols-2 gap-6">

                    {/* DYNAMIC COLOR PALETTES */}
                    <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-6 shadow-lg">
                        <h2 className="text-slate-300 text-sm font-bold tracking-widest mb-6">DYNAMIC COLOR PALETTES</h2>

                        <div className="grid grid-cols-4 gap-6">
                            {[
                                { name: 'Rouge Maison', color: 'bg-orange-500', glow: 'shadow-[#f97316]' },
                                { name: 'Bleu Océan', color: 'bg-pink-500', glow: 'shadow-[#ec4899]' },
                                { name: 'Vert Forêt', color: 'bg-cyan-400', glow: 'shadow-[#22d3ee]' },
                                { name: 'Orange Brûlant', color: 'bg-purple-500', glow: 'shadow-[#a855f7]' },
                                { name: 'Scene Oitalon', color: 'bg-white', glow: 'shadow-[#ffffff]' },
                                { name: 'Motion FX', color: 'bg-slate-500', glow: 'shadow-none' },
                                { name: 'Movement FX', color: 'bg-cyan-300', glow: 'shadow-[#67e8f9]' },
                                { name: 'Dictro Off', color: 'bg-slate-400', glow: 'shadow-none' },
                            ].map((c, i) => (
                                <div key={i} className="flex flex-col items-center gap-3 cursor-pointer group">
                                    <div className={`w-16 h-16 rounded-full border-2 border-[#262c36] ${c.color} group-hover:border-white transition-all ${c.glow ? `group-hover:shadow-[0_0_20px_${c.color.replace('bg-', '')}]` : ''}`} />
                                    <span className={`text-[11px] text-center font-bold ${c.color === 'bg-cyan-500' || c.color === 'bg-cyan-400' || c.color === 'bg-cyan-300' ? 'text-cyan-400' : 'text-slate-400'}`}>{c.name}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex items-center justify-between px-4">
                            <div className="w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded relative">
                                <div className="absolute top-1/2 -translate-y-1/2 left-3/4 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_white]"></div>
                            </div>
                            <div className="w-8 h-8 rounded border border-slate-600 ml-4 flex items-center justify-center text-slate-400 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                            </div>
                        </div>
                    </div>

                    {/* GOBO & BEAM SHAPING */}
                    <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-6 shadow-lg">
                        <h2 className="text-slate-300 text-sm font-bold tracking-widest mb-6">GOBO & BEAM SHAPING</h2>

                        <div className="grid grid-cols-4 gap-4 mb-8">
                            {[1, 2, 3, 4, 5, 6, 7].map(g => (
                                <div key={g} className="aspect-square rounded-full border-2 border-cyan-500/50 flex items-center justify-center cursor-pointer hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                                    <div className="w-[60%] h-[60%] border-2 border-cyan-400/80 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-6 mt-auto">
                            <div>
                                <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono uppercase">
                                    <span>Zoom</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-full h-1 bg-gradient-to-r from-pink-500/20 to-pink-500 relative rounded">
                                        <div className="absolute top-1/2 -translate-y-1/2 left-3/4 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_white]"></div>
                                    </div>
                                    <span className="text-slate-500">ZOOM</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono uppercase">
                                    <span>Focus</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-full h-1 bg-gradient-to-r from-cyan-500/20 to-cyan-500 relative rounded">
                                        <div className="absolute top-1/2 -translate-y-1/2 left-2/3 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_white]"></div>
                                    </div>
                                    <span className="text-slate-500">FOCUS</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* BOTTOM TIMELINE GENERATOR */}
                <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-6 shadow-lg flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-slate-300 text-sm font-bold tracking-widest">AI SHOW GENERATOR</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="h-12 px-6 rounded border border-pink-500 text-pink-500 bg-pink-500/10 font-bold uppercase tracking-widest hover:bg-pink-500/20 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all flex items-center gap-3">
                            ▶ ANALYZE & GENERATE TIMELINE
                        </button>
                        <div className="flex-1 h-12 bg-[#0a0c10] border border-[#262c36] rounded flex items-center px-4">
                            <span className="text-slate-400 font-mono text-sm">/music/banger_mix.mp3</span>
                        </div>
                    </div>

                    {/* THE TIMELINE GRID */}
                    <div className="w-full h-32 bg-[#0a0c10] border border-[#262c36] rounded relative mt-4 overflow-hidden">

                        {/* Timeline Grids */}
                        <div className="absolute inset-0 w-full h-full flex justify-between px-4 pointer-events-none opacity-20">
                            {[...Array(10)].map((_, i) => <div key={i} className="w-[1px] h-full bg-slate-500 border-dashed"></div>)}
                        </div>

                        {/* Playhead */}
                        <div className="absolute top-0 bottom-0 left-[80%] w-[2px] bg-red-500 shadow-[0_0_10px_red] z-10"></div>

                        {/* Blocks */}
                        <div className="absolute top-4 left-[5%] w-[15%] h-8 bg-pink-500 rounded text-black font-bold text-[10px] flex items-center justify-center">BUILD UP</div>
                        <div className="absolute top-4 left-[35%] w-[15%] h-8 bg-green-500 rounded text-black font-bold text-[10px] flex items-center justify-center">COLOR FX</div>
                        <div className="absolute top-4 left-[55%] w-[20%] h-8 bg-cyan-400 rounded text-black font-bold text-[10px] flex items-center justify-center">DROP / STROBE</div>
                        <div className="absolute top-4 left-[75%] w-[15%] h-8 bg-cyan-500 rounded text-black font-bold text-[10px] flex items-center justify-center">DROP / STROBE</div>
                    </div>

                    {/* TIMELINE TRACKS INFO */}
                    <div className="flex flex-col gap-2">
                        <div className="flex h-8 bg-[#262c36]/30 border-y border-[#262c36] items-center px-2">
                            <span className="text-slate-500 text-xs w-32">Color FX</span>
                        </div>
                        <div className="flex h-8 bg-[#262c36]/30 border-y border-[#262c36] items-center px-2">
                            <span className="text-slate-500 text-xs w-32">Movement FX</span>
                            <span className="text-slate-600 text-[10px]">▶</span>
                            {/* Fake blocks inside track */}
                            <div className="w-full h-full relative overflow-hidden">
                                <div className="absolute left-[20%] top-1 bottom-1 w-[40%] bg-white/5 rounded"></div>
                            </div>
                            <span className="text-slate-600 font-bold ml-auto">+</span>
                        </div>
                    </div>

                    {/* AI MESSAGE BOX */}
                    <div className="mt-4 flex gap-4">
                        <div className="flex-1"></div>
                        <div className="w-1/3 bg-[#262c36]/50 border border-[#262c36] p-4 rounded-lg relative">
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#262c36]/50 transform rotate-45 border-l border-b border-[#262c36]"></div>
                            <h3 className="text-cyan-400 font-bold text-[10px] mb-2 tracking-widest">ANTIGRAVITY AI</h3>
                            <p className="text-slate-400 text-xs leading-tight">Audio analysis successfully completed. Generated 4 scenes mapping dynamic tempo. Say "Go" to start the show!</p>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
