/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState } from 'react';

export default function VisualizerView() {
    const [beamColor, setBeamColor] = useState('#06b6d4'); // Default cyan
    const [red, setRed] = useState(6);
    const [green, setGreen] = useState(182);
    const [blue, setBlue] = useState(212);

    // Helper to update from sliders to hex
    const updateColorFromSliders = (r: number, g: number, b: number) => {
        setRed(r); setGreen(g); setBlue(b);
        const rgbToHex = (c: number) => {
            const hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        };
        setBeamColor(`#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`);
    };

    return (
        <div className="w-full h-full bg-[#0a0c10] p-6 flex flex-col font-mono text-xs">

            {/* WINDOW FRAME (Antigravity OS) */}
            <div className="flex-1 border border-cyan-500/30 rounded flex flex-col overflow-hidden bg-[#12141a]">

                {/* Top OS Bar */}
                <div className="h-10 bg-black border-b border-cyan-500/30 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2 text-cyan-400 font-sans font-bold text-sm tracking-widest">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></svg>
                        Antigravity OS
                    </div>

                    <div className="flex items-center gap-4 text-slate-500">
                        <span className="hover:text-white cursor-pointer">_</span>
                        <span className="hover:text-white cursor-pointer select-none">□</span>
                        <span className="hover:text-white cursor-pointer">✕</span>
                    </div>
                </div>

                {/* Menu Bar */}
                <div className="flex items-center h-8 bg-[#1a1c23] border-b border-[#262c36] px-4 gap-6 text-slate-400">
                    <span className="hover:text-cyan-400 cursor-pointer">File</span>
                    <span className="hover:text-cyan-400 cursor-pointer">Render Settings</span>
                    <span className="hover:text-cyan-400 cursor-pointer">Fixtures</span>
                    <span className="hover:text-cyan-400 cursor-pointer">Console</span>
                    <span className="hover:text-cyan-400 cursor-pointer">Panels</span>
                    <span className="hover:text-cyan-400 cursor-pointer">Antigravity Hub</span>
                </div>

                {/* MAIN SPLIT */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT VIEW: 3D STAGE */}
                    <div className="flex-[2] relative overflow-hidden flex flex-col bg-[#05070a]">
                        {/* Tab Header */}
                        <div className="h-8 bg-[#12141a] border-b border-cyan-500/30 flex items-center px-4 justify-between text-cyan-400">
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
                                Chauvet DJ Intimidator Spot 360
                            </div>
                            <span className="text-slate-500 font-sans tracking-tight">Source 1</span>
                        </div>

                        {/* Stage Viewport */}
                        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                            {/* Fake 3D Truss & Floor */}
                            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10] to-[#1a1c23] opacity-50"></div>

                            {/* Floor Grid */}
                            <div
                                className="absolute bottom-0 w-[200%] h-[40%] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"
                                style={{ transform: 'perspective(500px) rotateX(60deg) translateY(50px)' }}
                            ></div>

                            <div className="w-[80%] h-32 border-4 border-slate-700 rounded-sm absolute top-20 flex justify-between px-10 items-start">
                                {/* Fixture Nodes */}
                                {[1, 2, 3, 4, 5].map(f => (
                                    <div key={f} className="w-8 h-10 bg-slate-900 border-2 border-slate-700 relative flex flex-col items-center shadow-lg -mt-4 rounded-b-lg">
                                        {/* Lens flare */}
                                        <div className={`w-full h-full rounded-b-lg opacity-20`} style={{ background: `linear-gradient(to bottom, ${beamColor}, transparent)` }}></div>
                                    </div>
                                ))}
                            </div>

                            {/* Beams (CSS Magic) */}
                            <div className="absolute top-[136px] w-[80%] flex justify-between px-[52px] pointer-events-none mix-blend-screen transition-colors duration-200">
                                {/* Beam 1 Pink */}
                                <div className="w-[150px] h-[300px] bg-gradient-to-b to-transparent flex flex-col justify-end items-center pb-4 ml-[-58px] rotate-[15deg] origin-top opacity-50 transition-colors duration-200" style={{ backgroundImage: `linear-gradient(to bottom, ${beamColor}80, transparent)` }}>
                                    <div className="w-24 h-12 rounded-[50%] opacity-50 shadow-[0_0_20px_pink] transform scale-y-50 transition-colors duration-200" style={{ backgroundColor: beamColor, boxShadow: `0 0 20px ${beamColor}` }}></div>
                                </div>
                                {/* Beam 2 Cyan */}
                                <div className="w-[150px] h-[300px] bg-gradient-to-b to-transparent flex flex-col justify-end items-center pb-4 ml-[-120px] rotate-[5deg] origin-top opacity-80" style={{ backgroundImage: `linear-gradient(to bottom, ${beamColor}80, transparent)` }}>
                                    <div className="w-24 h-12 rounded-[50%] transform scale-y-50 border-4 border-white/50 border-dotted flex items-center justify-center transition-colors duration-200" style={{ backgroundColor: beamColor, boxShadow: `0 0 20px ${beamColor}` }}><div className="w-8 h-8 rounded-full border border-white"></div></div>
                                </div>
                                {/* Beam 3 White */}
                                <div className="w-[150px] h-[300px] bg-gradient-to-b to-transparent flex flex-col justify-end items-center pb-4 ml-[-120px] -rotate-[5deg] origin-top animate-pulse" style={{ backgroundImage: `linear-gradient(to bottom, ${beamColor}99, transparent)` }}>
                                    <div className="w-24 h-12 rounded-[50%] transform scale-y-50 border-4 flex items-center justify-center transition-colors duration-200" style={{ backgroundColor: beamColor, boxShadow: `0 0 20px ${beamColor}`, borderColor: beamColor }}><div className="w-8 h-8 rounded-full border border-white"></div></div>
                                </div>
                                {/* Beam 4 Cyan */}
                                <div className="w-[150px] h-[300px] bg-gradient-to-b to-transparent flex flex-col justify-end items-center pb-4 ml-[-120px] -rotate-[15deg] origin-top opacity-80" style={{ backgroundImage: `linear-gradient(to bottom, ${beamColor}80, transparent)` }}>
                                    <div className="w-24 h-12 rounded-[50%] transform scale-y-50 border-4 border-white/50 border-dotted flex items-center justify-center transition-colors duration-200" style={{ backgroundColor: beamColor, boxShadow: `0 0 20px ${beamColor}` }}><div className="w-8 h-8 outline outline-white outline-offset-4"></div></div>
                                </div>
                                {/* Beam 5 Pink */}
                                <div className="w-[150px] h-[300px] bg-gradient-to-b to-transparent flex flex-col justify-end items-center pb-4 ml-[-120px] -rotate-[25deg] origin-top opacity-50" style={{ backgroundImage: `linear-gradient(to bottom, ${beamColor}80, transparent)` }}>
                                    <div className="w-24 h-12 rounded-[50%] transform scale-y-50 border-dashed border-2 border-white transition-colors duration-200" style={{ backgroundColor: beamColor, boxShadow: `0 0 20px ${beamColor}` }}></div>
                                </div>
                            </div>

                            {/* Console Desk (Center) */}
                            <div className="absolute bottom-[20%] w-[250px] h-[80px] perspective-[500px]">
                                <div className="w-full h-full bg-[#1a1c23] border border-[#262c36] transform rotateX(60deg) shadow-2xl skew-x-12 grid grid-cols-4 grid-rows-2 gap-1 p-2">
                                    {[...Array(8)].map((_, i) => <div key={i} className="bg-slate-800 rounded"></div>)}
                                </div>
                            </div>

                        </div>

                        {/* Float Widget (Color Picker inside 3D View) */}
                        <div className="absolute right-4 bottom-4 w-60 bg-[#12141a]/90 backdrop-blur border border-cyan-500/30 rounded shadow-xl flex flex-col">
                            <div className="h-6 border-b border-slate-700 flex justify-between items-center px-4 font-sans font-bold text-slate-400">
                                <span>XY Color Picker</span>
                            </div>
                            <div className="p-4 flex flex-col items-center gap-4">

                                {/* Native Color Input on top of fake wheel */}
                                <div className="relative w-32 h-32 rounded-full shadow-inner overflow-hidden cursor-pointer" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
                                    <div className="absolute inset-2 bg-black rounded-full shadow-inner pointer-events-none flex items-center justify-center"><div className="w-16 h-16 rounded-full" style={{ backgroundColor: beamColor }}></div></div>
                                    <input
                                        type="color"
                                        value={beamColor}
                                        onChange={(e) => {
                                            setBeamColor(e.target.value);
                                            // Basic hex to rgb
                                            const hex = e.target.value.replace('#', '');
                                            setRed(parseInt(hex.substring(0, 2), 16));
                                            setGreen(parseInt(hex.substring(2, 4), 16));
                                            setBlue(parseInt(hex.substring(4, 6), 16));
                                        }}
                                        className="w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>

                                {/* RGB Bars (Native inputs styled vertically) */}
                                <div className="flex w-full justify-between items-end gap-2 px-2 mt-4">

                                    <div className="flex-1 flex flex-col items-center gap-2">
                                        <input type="range" min="0" max="255" value={red} onChange={(e) => updateColorFromSliders(parseInt(e.target.value), green, blue)}
                                            className="w-16 h-1 -rotate-90 appearance-none bg-red-900 rounded-full mt-6 mb-8 cursor-pointer" style={{ accentColor: '#ef4444' }} />
                                        <span className="text-slate-500 text-[9px] uppercase">Red</span>
                                    </div>

                                    <div className="flex-1 flex flex-col items-center gap-2">
                                        <input type="range" min="0" max="255" value={green} onChange={(e) => updateColorFromSliders(red, parseInt(e.target.value), blue)}
                                            className="w-16 h-1 -rotate-90 appearance-none bg-green-900 rounded-full mt-6 mb-8 cursor-pointer" style={{ accentColor: '#22c55e' }} />
                                        <span className="text-slate-500 text-[9px] uppercase">Green</span>
                                    </div>

                                    <div className="flex-1 flex flex-col items-center gap-2">
                                        <input type="range" min="0" max="255" value={blue} onChange={(e) => updateColorFromSliders(red, green, parseInt(e.target.value))}
                                            className="w-16 h-1 -rotate-90 appearance-none bg-blue-900 rounded-full mt-6 mb-8 cursor-pointer" style={{ accentColor: '#3b82f6' }} />
                                        <span className="text-slate-500 text-[9px] uppercase">Blue</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>


                    {/* RIGHT VIEWS: Data & Terminal */}
                    <div className="flex-1 flex flex-col bg-[#0f1115] border-l border-cyan-500/30 font-sans">

                        {/* TOP TERMINAL */}
                        <div className="flex-1 flex flex-col">
                            <div className="h-8 bg-[#12141a] border-b border-slate-700 flex justify-between items-center px-4 font-bold text-slate-400">
                                <span className="text-cyan-400 tracking-wider">GLOW DATA</span>
                                <span className="cursor-pointer hover:text-white">✕</span>
                            </div>

                            <div className="flex-1 p-2 overflow-y-auto font-mono text-[9px] text-[#0f0] flex flex-col gap-1 opacity-80 pl-4">
                                <span>[SYS] System init OK at 18:42:15</span>
                                <span className="text-cyan-400">[OSC] Sending /dmx/universe/1/channel/124 255</span>
                                <span>[QLC] Acknowledged CH124</span>
                                <span className="text-cyan-400">[OSC] Sending /dmx/universe/1/channel/125 100</span>
                                <span>[ART-NET] Node "CHAUVET DJ" active on 192.168.1.52</span>
                                <span className="text-orange-400">[WARN] Frame drop detected (2 FPS lag)</span>
                                <span>{`[DATA] Array [124:255, 125:100, 126:0, 127:255]`}</span>
                                <span>[SYNC] External clock (Ableton Link) beat = 4.0</span>
                                <span className="text-cyan-400">[OSC] Triggering preset "Blue Ocean"</span>
                                <span>[RENDER] WebGL context active</span>
                                <span>...</span>
                            </div>
                        </div>

                        {/* BOTTOM AI PROMPT */}
                        <div className="h-44 border-t border-cyan-500/30 flex flex-col bg-[#12141a]">
                            <div className="h-8 bg-[#12141a] flex justify-between items-center px-4 font-bold text-slate-400">
                                <span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></svg> Antigravity AI</span>
                                <span className="cursor-pointer hover:text-white">✕</span>
                            </div>

                            <div className="flex-1 p-4 flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-cyan-500 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm">👩‍💻</span>
                                </div>

                                <div className="flex flex-col gap-2 w-full">
                                    <p className="text-slate-300 text-xs font-semibold leading-relaxed">
                                        Adlumbing pl Visualizer Module... it is running.
                                        <br />Stage is ready. How can I assist you?
                                    </p>
                                    <div className="mt-auto flex justify-end gap-2">
                                        <button className="bg-cyan-500 hover:bg-cyan-400 text-black px-3 py-1 text-[10px] font-bold rounded">Yes</button>
                                        <button className="bg-[#1a1c23] border border-cyan-500 text-cyan-500 hover:bg-cyan-500/20 px-3 py-1 text-[10px] font-bold rounded">No</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
}
