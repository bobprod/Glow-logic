"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Terminal, Trash2 } from 'lucide-react';
import { socket } from '../lib/socket';
import useStore from '../store/useStore';

type LogEntry = {
    id: number;
    type: 'sys' | 'ai' | 'warn' | 'osc' | 'info';
    text: string;
};

const INIT_LOGS: LogEntry[] = [
    { id: 1, type: 'sys', text: '[SYS] Art-Net Broadcast OK (Uni 1)' },
    { id: 2, type: 'ai', text: '[AI] Drop in 4 beats. Queuing Scene "MAIN DROP STROBE".' },
    { id: 3, type: 'warn', text: '[WARN] Fixture "Moving Head 2" missed RDM ping.' },
    { id: 4, type: 'osc', text: '[OSC] /qlc/button/1/2 1.0 → 127.0.0.1:7700' },
];

const LOG_COLOR: Record<LogEntry['type'], string> = {
    sys: 'text-green-400',
    ai: 'text-cyan-400',
    warn: 'text-yellow-400',
    osc: 'text-slate-400',
    info: 'text-blue-400',
};

function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    const msFmt = (ms % 1000).toString().padStart(3, '0');
    return `${min}:${sec}.${msFmt}`;
}

export default function MacroTimeline() {
    const { isTimelineVisible } = useStore();
    const [isPlaying, setIsPlaying] = useState(false);

    const [elapsed, setElapsed] = useState(84500); // 1:24.500 initial
    const [logs, setLogs] = useState<LogEntry[]>(INIT_LOGS);
    const logEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logCountRef = useRef(100);

    // --- Timer ---
    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setElapsed(prev => prev + 100);
            }, 100);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying]);

    // --- AI Inspector : écoute les events Socket.IO réels ---
    useEffect(() => {
        if (!socket) return;

        const addLog = (type: LogEntry['type'], text: string) => {
            logCountRef.current += 1;
            setLogs(prev => [...prev.slice(-49), { id: logCountRef.current, type, text }]);
        };

        socket.on('connect', () => addLog('sys', '[SYS] Socket.IO connecté au backend.'));
        socket.on('disconnect', () => addLog('warn', '[WARN] Déconnecté du backend.'));
        socket.on('osc:sent', (data: { address: string; value: number }) =>
            addLog('osc', `[OSC] ${data.address} ${data.value.toFixed(2)} → 127.0.0.1:7700`)
        );
        socket.on('artnet:ok', (data: { universe: number }) =>
            addLog('sys', `[SYS] Art-Net OK Uni ${data.universe}`)
        );
        socket.on('smart:log', (data: { msg: string }) =>
            addLog('ai', `[AI] ${data.msg}`)
        );

        return () => {
            socket?.off('connect');
            socket?.off('disconnect');
            socket?.off('osc:sent');
            socket?.off('artnet:ok');
            socket?.off('smart:log');
        };
    }, []);

    // --- Auto-scroll vers le bas ---
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handlePlayPause = useCallback(() => setIsPlaying(p => !p), []);
    const handleSkipBack = useCallback(() => { setElapsed(0); setIsPlaying(false); }, []);
    const handleSkipForward = useCallback(() => { setElapsed(prev => prev + 10000); }, []);
    const handleClear = useCallback(() => setLogs([]), []);

    // Playhead position en % (sur 5min max)
    const playheadPct = Math.min((elapsed / (5 * 60 * 1000)) * 100, 100);

    if (!isTimelineVisible) return null;

    return (
        <div className="relative h-48 bg-[#12141A] border-t border-slate-800 z-40 flex shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0">

            {/* ===== Playback Controls & Timeline ===== */}
            <div className="flex-1 flex flex-col border-r border-[#262c36] p-4">
                <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-cyan-400 font-bold text-xs tracking-widest uppercase">Macro Timeline</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSkipBack}
                            title="Retour au début"
                            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-300"
                        >
                            <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handlePlayPause}
                            title={isPlaying ? 'Pause' : 'Play'}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-black transition-all pl-0.5 ${isPlaying
                                ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)] hover:bg-yellow-300'
                                : 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-400'
                                }`}
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </button>
                        <button
                            onClick={handleSkipForward}
                            title="+10 secondes"
                            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-300"
                        >
                            <SkipForward className="w-4 h-4" />
                        </button>
                    </div>
                    <span className="text-slate-400 font-mono text-xs font-bold bg-[#1a1c23] px-3 py-1 rounded-full border border-[#262c36] tabular-nums">
                        {formatTime(elapsed)}
                    </span>
                    {isPlaying && (
                        <span className="text-xs text-yellow-400 animate-pulse font-bold">● REC</span>
                    )}
                </div>

                {/* Tracks area */}
                <div className="flex-1 bg-[#1a1c23] rounded-lg border border-[#262c36] relative overflow-hidden flex flex-col">
                    {/* Playhead */}
                    <div
                        className="absolute top-0 bottom-0 w-[1px] bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,1)] z-10 transition-all duration-100"
                        style={{ left: `${playheadPct}%` }}
                    />

                    {/* Track LIGHTS */}
                    <div className="flex-1 border-b border-[#262c36] flex items-center px-4 relative">
                        <span className="text-[10px] text-slate-400 font-bold uppercase w-20">LIGHTS</span>
                        <div className="absolute top-1 bottom-1 left-[10%] w-32 bg-cyan-500/10 border border-cyan-500/50 rounded-md text-[9px] text-cyan-400 px-2 flex items-center justify-center font-bold shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:bg-cyan-500/20 cursor-pointer transition-colors">
                            INTRO BUILD
                        </div>
                        <div className="absolute top-1 bottom-1 left-[30%] w-48 bg-pink-500/10 border border-pink-500/50 rounded-md text-[9px] text-pink-400 px-2 flex items-center justify-center font-bold shadow-[0_0_10px_rgba(236,72,153,0.1)] hover:bg-pink-500/20 cursor-pointer transition-colors">
                            MAIN DROP STROBE
                        </div>
                    </div>

                    {/* Track VISUALS */}
                    <div className="flex-1 border-b border-[#262c36] flex items-center px-4 relative">
                        <span className="text-[10px] text-slate-400 font-bold uppercase w-20">VISUALS</span>
                        <div className="absolute top-1 bottom-1 left-[30%] w-48 bg-purple-500/10 border border-purple-500/50 rounded-md text-[9px] text-purple-400 px-2 flex items-center justify-center font-bold hover:bg-purple-500/20 cursor-pointer transition-colors">
                            VJ LOOP 04
                        </div>
                    </div>

                    {/* Track FX */}
                    <div className="flex-1 flex items-center px-4 relative">
                        <span className="text-[10px] text-slate-400 font-bold uppercase w-20">FX (LASER)</span>
                    </div>
                </div>
            </div>

            {/* ===== AI Inspector ===== */}
            <div className="w-96 flex flex-col p-4 bg-[#12141A]">
                <div className="flex items-center justify-between border-b border-[#262c36] pb-2 mb-3">
                    <h3 className="text-slate-400 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-cyan-500" />
                        AI Inspector
                    </h3>
                    <button
                        onClick={handleClear}
                        title="Vider la console"
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="flex-1 font-mono text-[10px] overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {logs.length === 0 && (
                        <p className="text-slate-600 italic">Console vide.</p>
                    )}
                    {logs.map(log => (
                        <p key={log.id} className={LOG_COLOR[log.type]}>
                            {log.text}
                        </p>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>

        </div>
    );
}
