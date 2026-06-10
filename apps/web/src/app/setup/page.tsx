 
'use client';

import React from 'react';

export default function SetupView() {
    return (
        <div className="w-full h-full bg-[#12141a] p-10 flex flex-col overflow-y-auto">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-10 w-full max-w-6xl mx-auto">
                <h1 className="text-white text-2xl font-black tracking-widest">DEVICE & ROOM SETUP</h1>

                <button className="flex items-center gap-2 bg-[#1a1c23] border border-[#262c36] hover:bg-[#262c36] text-slate-300 px-4 py-2 rounded-lg text-sm font-bold transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Settings
                </button>
            </div>

            <div className="flex gap-12 max-w-6xl mx-auto w-full relative">

                {/* SVG DRAWN LINE (Visual Connection) */}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" style={{ transform: 'translate(0,0)' }}>
                    {/* Ligne reliant le Device 1 à la Stage 2 */}
                    <line x1="280" y1="130" x2="680" y2="130" stroke="#06b6d4" strokeWidth="2" />
                    <polyline points="280,130 500,130 680,130" stroke="#06b6d4" strokeWidth="2" fill="none" />
                    <circle cx="280" cy="130" r="4" fill="#06b6d4" className="animate-pulse" />

                    {/* Indicateur de "plus" */}
                    <g transform="translate(480, 115)">
                        <circle cx="15" cy="15" r="12" fill="#12141a" stroke="#06b6d4" strokeWidth="2" />
                        <line x1="8" y1="15" x2="22" y2="15" stroke="#06b6d4" strokeWidth="2" />
                        <line x1="15" y1="8" x2="15" y2="22" stroke="#06b6d4" strokeWidth="2" />
                    </g>

                    <polygon points="675,125 685,130 675,135" fill="#06b6d4" />
                </svg>

                {/* LEFT COLUMN: DEVICES */}
                <div className="w-[350px] flex flex-col gap-4">

                    {/* New Device Detected Badge */}
                    <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 w-max px-3 py-1.5 rounded-lg mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        <span className="text-blue-400 text-xs font-bold">New Device Detected</span>
                    </div>

                    {/* Active Detected Device */}
                    <div className="bg-[#1a1c23] border-2 border-blue-500/50 rounded-xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(59,130,246,0.15)] relative">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#12141a] border border-[#262c36] rounded-lg flex items-center justify-center p-2">
                                <div className="w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_10px_cyan]"></div>
                            </div>
                            <div>
                                <h3 className="text-white text-sm font-bold leading-tight">CHAUVET DJ <br />INTIMIDATOR SPOT 360</h3>
                            </div>
                        </div>
                        <button className="bg-transparent border border-slate-600 text-slate-400 hover:text-white hover:border-white px-4 py-1.5 rounded text-xs font-bold transition-all">
                            PATCH
                        </button>
                        {/* Connection anchor */}
                        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full"></div>
                    </div>

                    {/* Existing Devices */}
                    <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-4 flex items-center justify-between opacity-70">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#12141a] border border-[#262c36] rounded-lg flex items-center justify-center p-2">
                                <div className="w-8 h-2 rounded bg-pink-500 shadow-[0_0_10px_pink]"></div>
                            </div>
                            <h3 className="text-white text-sm font-bold leading-tight">AMERICAN DJ<br />LED BAR</h3>
                        </div>
                        <button className="bg-transparent border border-slate-600 text-slate-400 px-4 py-1.5 rounded text-xs font-bold">PATCH</button>
                    </div>

                    <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-4 flex items-center justify-between opacity-70">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#12141a] border border-[#262c36] rounded-lg flex items-center justify-center p-2">
                                <div className="w-8 h-2 rounded bg-blue-500 shadow-[0_0_10px_blue]"></div>
                            </div>
                            <h3 className="text-white text-sm font-bold leading-tight">AMERICAN DJ<br />LED BAR</h3>
                        </div>
                        <button className="bg-transparent border border-slate-600 text-slate-400 px-4 py-1.5 rounded text-xs font-bold">PATCH</button>
                    </div>

                    <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-4 flex items-center justify-between opacity-70">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#12141a] border border-[#262c36] rounded-lg flex items-center justify-center p-2">
                                <div className="w-6 h-6 rounded-full bg-white shadow-[0_0_10px_white]"></div>
                            </div>
                            <h3 className="text-white text-sm font-bold leading-tight">GENERIC<br />PAR CAN</h3>
                        </div>
                        <button className="bg-transparent border border-slate-600 text-slate-400 px-4 py-1.5 rounded text-xs font-bold">PATCH</button>
                    </div>

                </div>

                {/* RIGHT COLUMN: ROOMS AND AI CHAT */}
                <div className="flex-1 flex flex-col gap-8">

                    <div>
                        <h2 className="text-slate-400 text-sm font-bold tracking-widest mb-6">ROOMS</h2>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Room 1 */}
                            <div className="h-32 bg-gradient-to-t from-[#1a1c23] to-[#12141a] border border-[#262c36] rounded-xl relative overflow-hidden flex flex-col items-center justify-end pb-4">
                                <div className="absolute top-2 w-[80%] h-4 bg-black/50 rounded flex justify-around items-center px-4">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_10px_30px_rgba(59,130,246,0.5)] flex items-center justify-center"><div className="w-1 h-30 absolute top-3 bg-gradient-to-b from-blue-500/30 to-transparent"></div></div>
                                    <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_10px_30px_rgba(59,130,246,0.5)] flex items-center justify-center"><div className="w-1 h-30 absolute top-3 bg-gradient-to-b from-blue-500/30 to-transparent"></div></div>
                                </div>
                                <span className="text-white font-bold text-sm">Stage</span>
                            </div>

                            {/* Room 2 (Target) */}
                            <div className="h-32 bg-gradient-to-t from-[#1a1c23] to-[#12141a] border-2 border-cyan-500/50 rounded-xl relative overflow-hidden flex flex-col items-center justify-end pb-4 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                                <div className="absolute top-2 w-[80%] h-4 bg-black/50 rounded flex justify-around items-center px-4">
                                    <div className="w-3 h-3 bg-pink-500 rounded-full shadow-[0_10px_30px_rgba(236,72,153,0.5)]"></div>
                                    <div className="w-3 h-3 bg-pink-500 rounded-full shadow-[0_10px_30px_rgba(236,72,153,0.5)]"></div>
                                </div>
                                <span className="text-white font-bold text-sm">Stage</span>
                            </div>

                            {/* Room 3 */}
                            <div className="h-32 bg-gradient-to-t from-[#1a1c23] to-[#12141a] border border-[#262c36] rounded-xl relative overflow-hidden flex flex-col items-center justify-end pb-4">
                                <div className="absolute top-2 w-[80%] h-4 bg-black/50 rounded flex justify-around items-center px-4">
                                    <div className="w-3 h-3 bg-white rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.3)]"></div>
                                    <div className="w-3 h-3 bg-white rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.3)]"></div>
                                </div>
                                <span className="text-white font-bold text-sm">Bar</span>
                            </div>

                            {/* Room 4 */}
                            <div className="h-32 bg-gradient-to-t from-[#1a1c23] to-[#12141a] border border-[#262c36] rounded-xl relative overflow-hidden flex flex-col items-center justify-end pb-4">
                                <div className="absolute top-2 w-[80%] h-4 bg-black/50 rounded flex justify-around items-center px-4">
                                    <div className="w-3 h-3 bg-white/80 rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.2)]"></div>
                                    <div className="w-3 h-3 bg-white/80 rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.2)]"></div>
                                </div>
                                <span className="text-white font-bold text-sm">Dancefloor</span>
                            </div>
                        </div>
                    </div>

                    {/* AI Chat Box */}
                    <div className="mt-auto self-end w-[80%]">
                        <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-4 flex gap-4 shadow-lg">
                            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-cyan-500 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                                {/* Fake AI Avatar */}
                                <span className="text-xl">🤖</span>
                            </div>
                            <div>
                                <span className="text-slate-400 text-xs font-bold mb-1 block">Antigravity AI:</span>
                                <p className="text-white text-sm">I've detected a new device. Where should I assign it?</p>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}
