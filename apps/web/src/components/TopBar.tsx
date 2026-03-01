"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Radio, Activity, StopCircle, PanelLeftClose, PanelLeft, Clock } from 'lucide-react';
import useStore from '../store/useStore';
import { socket } from '../lib/socket';
import { SettingsModal } from './ui/SettingsModal';
import { calcBPM, MAX_TAPS } from '../utils/bpm';

export default function TopBar() {
    const {
        appMode, setAppMode,
        isTimelineVisible, setIsTimelineVisible,
        isSidebarVisible, setIsSidebarVisible,
        smartBlackout, setSmartBlackout,
        smartAutoPilot, setSmartAutoPilot,
        bpm, setBpm
    } = useStore();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const tapTimesRef = useRef<number[]>([]);
    const [currentTime, setCurrentTime] = useState<string>('00:00:00');

    // Update digital clock
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // BPM TAP Handler
    const handleTap = () => {
        const now = Date.now();
        let newTaps = [...tapTimesRef.current, now];

        // Reset if gap > 2 seconds
        if (newTaps.length > 1 && now - newTaps[newTaps.length - 2] > 2000) {
            newTaps = [now];
        }
        if (newTaps.length > MAX_TAPS) {
            newTaps.shift();
        }

        tapTimesRef.current = newTaps;

        const calculatedBpm = calcBPM(newTaps);
        if (calculatedBpm > 0) {
            setBpm(calculatedBpm);
            // Send OSC command via Socket
            socket.emit('osc_send', { address: '/vkb_midi/0/bpm', args: [calculatedBpm] });
        }

        // Small tap animation on the button
        const btn = document.getElementById('tap-btn');
        if (btn) {
            btn.classList.add('scale-95', 'bg-cyan-500/20');
            setTimeout(() => btn.classList.remove('scale-95', 'bg-cyan-500/20'), 100);
        }
    };

    const handleBlackout = () => {
        const newState = !smartBlackout;
        setSmartBlackout(newState);
        socket.emit('osc_send', { address: '/qlc/blackout', args: [newState ? 1 : 0] });
    };

    return (
        <div className="h-16 bg-[#0a0c10]/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-50 shrink-0 sticky top-0">

            {/* LEFT : Mode & Toggle */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                        className="text-slate-500 hover:text-white transition-colors"
                        title="Toggle Left Panel"
                    >
                        {isSidebarVisible ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
                        <h1 className="text-white font-black tracking-widest text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">GLOW <span className="font-light">LOGIC</span></h1>
                    </div>
                </div>

                <div className="h-6 w-[1px] bg-white/10" />

                {/* MODE SWITCHER */}
                <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                    <button
                        onClick={() => setAppMode('smart')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === 'smart' ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <Play className="w-3.5 h-3.5" />
                        SMART
                    </button>
                    <button
                        onClick={() => setAppMode('live')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === 'live' ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        LIVE
                    </button>
                    <button
                        onClick={() => setAppMode('creator')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === 'creator' ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        CREATOR
                    </button>
                </div>
            </div>

            {/* MIDDLE: Global Controls (BPM, Blackout, etc.) */}
            <div className="flex items-center gap-4">

                {/* BPM Controls */}
                <div className="flex items-center gap-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                    <button
                        id="tap-btn"
                        onClick={handleTap}
                        className="px-4 py-2 hover:bg-white/5 text-slate-400 hover:text-white transition-all border-r border-white/5"
                    >
                        <Activity className="w-4 h-4" />
                    </button>
                    <div className="px-4 py-1.5 text-center min-w-[100px] flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 font-bold tracking-widest leading-none mb-1">BPM</span>
                        <span className="text-cyan-400 font-mono text-sm leading-none font-bold">{bpm.toFixed(1)}</span>
                    </div>
                </div>

                <button
                    onClick={() => setSmartAutoPilot(!smartAutoPilot)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${smartAutoPilot
                        ? 'bg-purple-500/20 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        : 'bg-black/40 border-white/5 text-slate-400 hover:bg-black/60 hover:text-white'
                        }`}
                >
                    <Radio className={`w-4 h-4 ${smartAutoPilot ? 'animate-pulse' : ''}`} />
                    AUTO
                </button>

                <button
                    onClick={handleBlackout}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${smartBlackout
                        ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                        : 'bg-black/40 border-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
                        }`}
                >
                    <StopCircle className="w-4 h-4" />
                    BLACKOUT
                </button>
            </div>

            {/* RIGHT : User & System */}
            <div className="flex items-center gap-4">

                {/* Digital Clock */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-white/5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm font-mono text-slate-300 tracking-wider font-semibold">{currentTime}</span>
                </div>

                {/* Timeline Toggle */}
                <button
                    onClick={() => setIsTimelineVisible(!isTimelineVisible)}
                    className={`p-2 rounded-xl transition-all border ${isTimelineVisible ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-black/40 text-slate-500 border-white/5 hover:bg-white/5'
                        }`}
                    title="Toggle Timeline"
                >
                    <Clock className="w-4 h-4" />
                </button>

                {/* Settings Toggle */}
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-2 bg-black/40 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-slate-400 hover:text-white group relative"
                    title="Settings"
                >
                    <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                    {/* Tiny status dot */}
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]"></div>
                </button>
            </div>

            {/* Settings Modal Extracted */}
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        </div>
    );
}
