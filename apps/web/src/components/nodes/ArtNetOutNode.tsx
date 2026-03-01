import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function ArtNetOutNode({ data, selected }: { data: NodeData, selected?: boolean }) {
    return (
        <>
            <NodeResizer minWidth={220} minHeight={90} isVisible={selected} color="#06b6d4" />
            <div className={`bg-[#12141a] border ${selected ? 'border-cyan-500' : 'border-[#262c36]'} rounded-md shadow-[0_0_20px_rgba(0,0,0,0.8)] w-full h-full flex flex-col relative overflow-hidden group`}>
                {/* Top Bar */}
                <div className="h-6 bg-[#1a1c23] border-b border-[#262c36] flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">ART-NET NODE</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">192.168.1.150</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-2 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-white text-xs font-bold">{data.label || 'Art-Net Universe 1'}</span>
                        <span className="text-slate-500 text-[9px] font-mono mt-0.5">FPS: 44.1 | DROPS: 0</span>
                    </div>

                    {/* Visual TX blinker */}
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] text-cyan-500 font-bold tracking-widest">TX</span>
                        <div className="w-8 h-1.5 bg-slate-800 rounded flex gap-0.5 overflow-hidden">
                            <div className="w-1/3 h-full bg-cyan-400 animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                            <div className="w-1/3 h-full bg-slate-700"></div>
                            <div className="w-1/3 h-full bg-cyan-400 animate-pulse"></div>
                        </div>
                    </div>
                </div>

                {/* Handle */}
                <Handle type="target" position={Position.Left} className="w-2 h-4 rounded-sm bg-cyan-500 border border-[#1a1c23] !left-[-4px]" />
            </div>
        </>
    );
}
