import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function DmxOutputNode({ data, selected }: { data: NodeData, selected?: boolean }) {
    return (
        <>
            <NodeResizer minWidth={200} minHeight={120} isVisible={selected} lineClassName="border-cyan-500" handleClassName="h-3 w-3 bg-cyan-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-300
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7)]'}`}>

                {/* Glow Behind */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none transition-opacity duration-300 opacity-50 group-hover:opacity-100"></div>

                {/* Top Bar */}
                <div className="h-7 bg-gradient-to-l from-cyan-500/10 to-transparent border-b border-white/5 flex items-center justify-between px-3 relative z-10 w-full">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
                        <span className="text-[10px] font-bold text-cyan-50 uppercase tracking-[0.2em]">{data.label} <span className="text-cyan-500/80 tracking-normal">(RDM)</span></span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 flex flex-col justify-between relative z-10">
                    <div className="flex gap-2 text-[10px] font-mono">
                        <div className="flex-1 bg-black/40 border border-white/5 rounded-md p-1.5 flex flex-col justify-center items-center">
                            <span className="text-white/40 uppercase tracking-widest text-[8px] mb-0.5">Universe</span>
                            <span className="text-cyan-300 text-sm font-semibold">{data.universe || 1}</span>
                        </div>
                        <div className="flex-1 bg-black/40 border border-white/5 rounded-md p-1.5 flex flex-col justify-center items-center">
                            <span className="text-white/40 uppercase tracking-widest text-[8px] mb-0.5">Channel</span>
                            <span className="text-cyan-300 text-sm font-semibold">{data.channel || 1}</span>
                        </div>
                    </div>

                    {/* Sparkline / Mock Data */}
                    <div className="mt-3 text-[9px] flex justify-between items-center px-1 font-mono uppercase tracking-widest">
                        <div className="flex gap-1.5 items-center">
                            <span className="text-white/40">Temp</span>
                            <span className="text-emerald-400 bg-emerald-900/40 px-1 py-0.5 rounded border border-emerald-500/20">42°C</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className="text-white/40">Mode</span>
                            <span className="text-cyan-100/70">32CH EX</span>
                        </div>
                    </div>

                    {/* Bar */}
                    <div className="mt-2 h-1.5 w-full bg-black/60 rounded-full shadow-inner border border-white/5 overflow-hidden flex relative">
                        {/* Fake activity wave */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[200%] animate-[slide_2s_linear_infinite]" style={{ transform: 'translateX(-50%)' }}></div>
                        <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 w-1/3 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.6)]"></div>
                    </div>
                </div>

                {/* Handle */}
                <Handle type="target" position={Position.Left} className="w-3 h-6 rounded-md bg-cyan-400 border-2 border-[#12141a] !-left-1.5 shadow-[0_0_10px_rgba(34,211,238,0.6)] transition-transform hover:scale-110" />
            </div>
        </>
    );
}
