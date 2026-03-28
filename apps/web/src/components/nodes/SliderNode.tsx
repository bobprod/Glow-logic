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
            <NodeResizer minWidth={160} minHeight={140} isVisible={selected} lineClassName="border-pink-500" handleClassName="h-3 w-3 bg-pink-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-300
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7)]'}`}>

                {/* Glow Behind */}
                <div className="absolute -top-10 -left-10 w-24 h-24 bg-pink-500/20 rounded-full blur-[40px] pointer-events-none transition-opacity duration-300 opacity-50 group-hover:opacity-100"></div>

                {/* Top Bar */}
                <div className="h-7 bg-gradient-to-r from-pink-500/10 to-transparent border-b border-white/5 flex items-center justify-between px-3 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]`}></div>
                        <span className="text-[10px] font-bold text-pink-100/90 uppercase tracking-[0.2em]">Fader</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 flex flex-col justify-between relative z-10">
                    <span className="text-[11px] font-medium text-white/90 uppercase tracking-widest text-center truncate mb-3">{data.label}</span>

                    {/* Fader Track */}
                    <div className="relative w-full h-2 bg-black/50 rounded-full shadow-inner border border-white/5 flex items-center my-auto">
                        <div
                            className="absolute left-0 h-full bg-gradient-to-r from-pink-600 to-pink-400 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                            style={{ width: `${(data.value || 0) / 255 * 100}%` }}
                        ></div>
                        <input
                            type="range"
                            min="0"
                            max="255"
                            value={data.value || 0}
                            onChange={handleChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer nodrag"
                        />
                    </div>

                    {/* Digital display */}
                    <div className="flex justify-between items-end mt-4 pt-2 border-t border-white/5 text-[9px] uppercase tracking-wider">
                        <span className="text-white/40">Value</span>
                        <div className="text-pink-400 font-mono text-sm leading-none bg-pink-950/30 px-2 py-1 rounded shadow-inner border border-pink-500/20">
                            {String(data.value || 0).padStart(3, '0')}
                        </div>
                    </div>
                </div>

                <Handle type="source" position={Position.Right} className="w-3 h-6 rounded-md bg-pink-500 border-2 border-[#12141a] !-right-1.5 shadow-[0_0_10px_rgba(236,72,153,0.6)] transition-transform hover:scale-110" />
            </div>
        </>
    );
}
