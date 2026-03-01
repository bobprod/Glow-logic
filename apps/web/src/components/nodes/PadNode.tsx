import React from 'react';
import { Handle, Position } from 'reactflow';
import useStore from '../../store/useStore';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function PadNode({ id, data, selected }: { id: string, data: NodeData, selected?: boolean }) {
    const updateNodeData = useStore((state) => state.updateNodeData);

    const handlePress = () => updateNodeData(id, { value: 255 });
    const handleRelease = () => updateNodeData(id, { value: 0 });

    return (
        <>
            <NodeResizer minWidth={140} minHeight={120} isVisible={selected} color="#eab308" />
            <div className={`bg-[#12141a] border ${selected ? 'border-yellow-500' : 'border-[#262c36]'} rounded-md shadow-[0_0_20px_rgba(0,0,0,0.8)] w-full h-full flex flex-col relative overflow-hidden group`}>
                {/* Top Bar */}
                <div className="h-6 bg-[#1a1c23] border-b border-[#262c36] flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${data.value === 255 ? 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'bg-slate-600'}`}></div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">UI PAD</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-2 flex flex-col items-center justify-center">
                    <button
                        onMouseDown={handlePress}
                        onMouseUp={handleRelease}
                        onMouseLeave={handleRelease}
                        onTouchStart={handlePress}
                        onTouchEnd={handleRelease}
                        className={`w-full flex-1 rounded-sm border transition-all duration-75 outline-none flex items-center justify-center
            ${data.value === 255
                                ? 'bg-yellow-500 border-yellow-300 shadow-[inset_0_0_10px_rgba(255,255,255,0.5)]'
                                : 'bg-[#1a1c23] border-[#262c36] shadow-none hover:bg-slate-800'
                            }`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${data.value === 255 ? 'text-black' : 'text-slate-400'}`}>
                            {data.label}
                        </span>
                    </button>
                    <div className="w-full mt-2 flex justify-between text-[8px] font-mono text-slate-500">
                        <span>STATE: {data.value === 255 ? '1' : '0'}</span>
                        <span>INT</span>
                    </div>
                </div>

                <Handle type="source" position={Position.Right} className="w-2 h-4 rounded-sm bg-yellow-500 border border-[#1a1c23] !right-[-4px]" />
            </div>
        </>
    );
}
