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

    const isPressed = data.value === 255;

    return (
        <>
            <NodeResizer minWidth={140} minHeight={120} isVisible={selected} lineClassName="border-yellow-500" handleClassName="h-3 w-3 bg-yellow-500 border-2 border-black rounded-sm" />
            <div className={`w-full h-full flex flex-col relative overflow-hidden group rounded-xl backdrop-blur-xl transition-all duration-300
                ${selected
                    ? 'bg-[#12141a]/90 ring-1 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]'
                    : 'bg-[#12141a]/60 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:ring-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7)]'}`}>

                {/* Glow Behind */}
                <div className={`absolute -top-10 -left-10 w-24 h-24 bg-yellow-500/20 rounded-full blur-[40px] pointer-events-none transition-all duration-300 ${isPressed ? 'opacity-100 scale-150' : 'opacity-30 group-hover:opacity-60'}`}></div>

                {/* Top Bar */}
                <div className="h-7 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-white/5 flex items-center justify-between px-3 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full transition-all duration-150 ${isPressed ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,1)] scale-110' : 'bg-yellow-500/40'}`}></div>
                        <span className="text-[10px] font-bold text-yellow-100/90 uppercase tracking-[0.2em]">Pad</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 flex flex-col items-center justify-center relative z-10 w-full">
                    <button
                        onMouseDown={handlePress}
                        onMouseUp={handleRelease}
                        onMouseLeave={handleRelease}
                        onTouchStart={handlePress}
                        onTouchEnd={handleRelease}
                        className={`w-full flex-1 rounded-lg transition-all duration-100 outline-none flex items-center justify-center nodrag select-none
                            ${isPressed
                                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 ring-2 ring-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.6)] translate-y-0.5'
                                : 'bg-black/40 ring-1 ring-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] hover:bg-[#1a1c23] hover:ring-white/20'
                            }`}
                    >
                        <span className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-150 ${isPressed ? 'text-yellow-950 font-extrabold' : 'text-slate-300'}`}>
                            {data.label}
                        </span>
                    </button>

                    {/* Status Footer */}
                    <div className="w-full mt-3 flex justify-between items-center text-[9px] uppercase tracking-wider text-white/40 border-t border-white/5 pt-2">
                        <span>State</span>
                        <div className={`font-mono text-sm leading-none px-2 rounded ${isPressed ? 'text-yellow-400' : 'text-slate-500'}`}>
                            {isPressed ? '1' : '0'}
                        </div>
                    </div>
                </div>

                <Handle type="source" position={Position.Right} className="w-3 h-6 rounded-md bg-yellow-500 border-2 border-[#12141a] !-right-1.5 shadow-[0_0_10px_rgba(234,179,8,0.6)] transition-transform hover:scale-110" />
            </div>
        </>
    );
}
