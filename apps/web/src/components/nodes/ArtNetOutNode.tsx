import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function ArtNetOutNode({ data, selected }: { data: NodeData, selected?: boolean }) {
    return (
        <>
            <NodeResizer minWidth={220} minHeight={90} isVisible={selected} lineClassName="border-emerald-500" handleClassName="h-3 w-3 bg-emerald-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-300
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7)]'}`}>

                {/* Glow Behind */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none transition-opacity duration-300 opacity-50 group-hover:opacity-100"></div>

                {/* Top Bar */}
                <div className="h-7 bg-gradient-to-l from-emerald-500/10 to-transparent border-b border-white/5 flex items-center justify-between px-3 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                        <span className="text-[10px] font-bold text-emerald-100/90 uppercase tracking-[0.2em]">Art-Net Node</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 flex justify-between items-center relative z-10 w-full gap-2">
                    <div className="flex flex-col flex-1">
                        <span className="text-white/90 text-[11px] font-semibold tracking-wider uppercase mb-1 truncate">{data.label || 'Art-Net Universe 1'}</span>
                        <div className="flex gap-1.5 items-center">
                            <span className="bg-black/40 border border-white/5 px-1.5 py-0.5 rounded text-emerald-400 text-[8px] font-mono tracking-widest whitespace-nowrap">IP: 192.168.1.150</span>
                            <span className="text-slate-500 text-[8px] font-mono tracking-widest whitespace-nowrap">44.1 FPS</span>
                        </div>
                    </div>

                    {/* Visual TX blinker */}
                    <div className="flex flex-col items-end gap-1 shrink-0 bg-black/30 p-1.5 rounded-lg border border-white/5 shadow-inner">
                        <span className="text-[8px] text-emerald-500/80 font-bold tracking-widest uppercase">TX</span>
                        <div className="w-6 h-1.5 bg-black/60 rounded-full flex gap-[1px] overflow-hidden">
                            <div className="w-1/3 h-full bg-emerald-400 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_5px_rgba(52,211,153,0.8)] rounded-full"></div>
                            <div className="w-1/3 h-full bg-emerald-700/30 rounded-full"></div>
                            <div className="w-1/3 h-full bg-emerald-400 animate-[pulse_1.2s_ease-in-out_infinite] shadow-[0_0_5px_rgba(52,211,153,0.8)] rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* Handle */}
                <Handle type="target" position={Position.Left} className="w-3 h-6 rounded-md bg-emerald-500 border-2 border-[#12141a] !-left-1.5 shadow-[0_0_10px_rgba(16,185,129,0.6)] transition-transform hover:scale-110" />
            </div>
        </>
    );
}
