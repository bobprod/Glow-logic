import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function AudioInNode({ data, selected }: { data: NodeData, selected?: boolean }) {
    return (
        <>
            <NodeResizer minWidth={220} minHeight={90} isVisible={selected} color="#8b5cf6" />
            <div className={`bg-[#12141a] border ${selected ? 'border-purple-500' : 'border-[#262c36]'} rounded-md shadow-[0_0_20px_rgba(0,0,0,0.8)] w-full h-full flex flex-col relative overflow-hidden group`}>
                {/* Top Bar */}
                <div className="h-6 bg-[#1a1c23] border-b border-[#262c36] flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.8)]"></div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">AUDIO SOURCE</span>
                    </div>
                    <span className="text-[9px] font-mono text-purple-400">IN</span>
                </div>

                {/* Content */}
                <div className="flex-1 p-2 flex items-center gap-3">
                    {/* VU Meter Visual */}
                    <div className="w-2.5 h-8 flex flex-col gap-[1px] justify-end">
                        <div className="w-full h-1/5 bg-red-500 opacity-20"></div>
                        <div className="w-full h-1/5 bg-yellow-400"></div>
                        <div className="w-full h-1/5 bg-green-400"></div>
                        <div className="w-full h-1/5 bg-green-400"></div>
                        <div className="w-full h-1/5 bg-green-500"></div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-white text-xs font-bold">{data.label || 'ASIO Driver'}</span>
                        <span className="text-slate-500 text-[9px] font-mono mt-0.5">{data.device || 'Focusrite USB'}</span>
                    </div>
                </div>

                {/* Handle */}
                <Handle type="source" position={Position.Right} className="w-2 h-4 rounded-sm bg-purple-500 border border-[#1a1c23] !right-[-4px]" />
            </div>
        </>
    );
}
