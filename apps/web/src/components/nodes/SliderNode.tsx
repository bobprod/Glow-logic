import React from 'react';
import { Handle, Position } from 'reactflow';
import useStore from '../../store/useStore';
import { NodeData } from '../../types/nodes';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export default function SliderNode({ id, data, selected }: { id: string, data: NodeData, selected?: boolean }) {
    const updateNodeData = useStore((state) => state.updateNodeData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNodeData(id, { value: parseInt(e.target.value, 10) });
    };

    return (
        <>
            <NodeResizer minWidth={160} minHeight={140} isVisible={selected} color="#ec4899" />
            <div className={`bg-[#12141a] border ${selected ? 'border-pink-500' : 'border-[#262c36]'} rounded-md shadow-[0_0_20px_rgba(0,0,0,0.8)] w-full h-full flex flex-col relative overflow-hidden group`}>
                {/* Top Bar */}
                <div className="h-6 bg-[#1a1c23] border-b border-[#262c36] flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full bg-pink-500`}></div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">UI FADER</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider text-center mb-2 truncate">{data.label}</span>

                    {/* Le curseur (Fader) */}
                    <input
                        type="range"
                        min="0"
                        max="255"
                        value={data.value || 0}
                        onChange={handleChange}
                        className="w-full h-1.5 bg-[#1a1c23] border border-[#262c36] rounded-none appearance-none cursor-pointer accent-pink-500 my-auto"
                    />

                    {/* Valeur actuelle affichée sous forme digitale */}
                    <div className="flex justify-between items-end mt-2 border-t border-slate-800 pt-1">
                        <span className="text-[8px] font-mono text-slate-500">VAL</span>
                        <div className="text-pink-400 font-mono text-xs">{String(data.value || 0).padStart(3, '0')}</div>
                    </div>
                </div>

                <Handle type="source" position={Position.Right} className="w-2 h-4 rounded-sm bg-pink-500 border border-[#1a1c23] !right-[-4px]" />
            </div>
        </>
    );
}
