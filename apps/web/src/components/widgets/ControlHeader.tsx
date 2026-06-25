import React, { useState } from 'react';
import { Play, Square, FastForward } from 'lucide-react';

export const ControlHeader = ({ title }: { title: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    return (
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2">
            <button
                onClick={() => setIsPlaying(false)}
                className={`h-10 w-12 flex items-center justify-center bg-[#1a1c23] rounded-lg border border-[#262c36] hover:bg-[#262c36] transition-colors ${!isPlaying ? 'text-red-500 shadow-[inset_0_0_10px_rgba(239,68,68,0.2)]' : 'text-slate-500'}`}
            >
                <Square className="w-4 h-4" fill="currentColor" />
            </button>
            <button
                onClick={() => setIsPlaying(true)}
                className={`h-10 px-4 bg-[#1a1c23] rounded-lg border border-[#262c36] hover:bg-[#262c36] flex items-center justify-center gap-2 transition-colors ${isPlaying ? 'text-green-500 shadow-[inset_0_0_10px_rgba(34,197,94,0.2)]' : 'text-slate-500'}`}
            >
                <Play className="w-4 h-4" fill={isPlaying ? "currentColor" : "none"} />
                <span className="text-xs font-bold tracking-widest uppercase">{title}</span>
            </button>
            <button className="h-10 px-6 bg-[#1a1c23] rounded-lg border border-[#262c36] flex items-center justify-center font-bold text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-xs tracking-widest">
                SYNC
            </button>
            <button className="h-10 w-12 flex items-center justify-center bg-[#1a1c23] rounded-lg border border-[#262c36] hover:bg-[#262c36] text-slate-400 transition-colors hover:text-white">
                <FastForward className="w-4 h-4" />
            </button>
        </div>
    );
};
