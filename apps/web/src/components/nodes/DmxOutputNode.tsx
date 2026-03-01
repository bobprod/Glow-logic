import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function DmxOutputNode({ data, selected }: { data: NodeData, selected?: boolean }) {
    return (
        <>
            <NodeResizer minWidth={200} minHeight={120} isVisible={selected} color="#06b6d4" />
            <div className={`bg-[#12141a] border ${selected ? 'border-cyan-500' : 'border-[#262c36]'} rounded-md shadow-[0_0_20px_rgba(0,0,0,0.8)] w-full h-full flex flex-col relative overflow-hidden group`}>
                {/* Top Bar */}
                <div className="h-6 bg-[#1a1c23] border-b border-[#262c36] flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_5px_rgba(6,182,212,0.8)]"></div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{data.label} (RDM)</span>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-400">OUT</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-2 flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>UNIVERSE: <span className="text-white bg-slate-800 px-1 rounded">{data.universe}</span></span>
                        <span>CH: <span className="text-white bg-slate-800 px-1 rounded">{data.channel}</span></span>
                    </div>

                    {/* Sparkline / Mock Data */}
                    <div className="mt-2 text-[8px] text-slate-500 flex flex-col gap-1">
                        <div className="flex justify-between"><span>TEMP</span><span className="text-green-400">42°C</span></div>
                        <div className="flex justify-between"><span>MODE</span><span className="text-slate-300">32CH EX</span></div>
                    </div>

                    {/* Bar */}
                    <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 w-1/3"></div>
                    </div>
                </div>

                {/* Handle */}
                <Handle type="target" position={Position.Left} className="w-2 h-4 rounded-sm bg-cyan-500 border border-[#1a1c23] !left-[-4px]" />
            </div>
        </>
    );
}
