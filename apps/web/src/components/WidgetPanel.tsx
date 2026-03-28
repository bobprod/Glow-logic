import React from 'react';
import useStore from '../store/useStore';

export default function WidgetPanel() {
    const { selectedNode, setSelectedNode } = useStore();

    if (!selectedNode) return null;

    return (
        <div className="absolute right-6 top-24 bottom-6 w-[400px] min-w-[300px] max-w-[600px] resize-x overflow-y-auto bg-[#1a1c23] border border-[#262c36] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 flex flex-col animate-in slide-in-from-right-8 duration-200">

            {/* Header Modal */}
            <div className="flex justify-between items-center p-4 border-b border-[#262c36] bg-[#12141a]">
                <div>
                    <h2 className="text-white font-bold tracking-wider">{selectedNode.data.label || 'Widget'}</h2>
                    <span className="text-xs text-slate-500 font-mono uppercase">{selectedNode.type}</span>
                </div>
                <button
                    onClick={() => setSelectedNode(null)}
                    className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-pink-500/20 transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Contenu dynamique en fonction du type de noeud */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

                {selectedNode.type === 'dmxOutput' && (
                    <>
                        {/* DYNAMIC COLOR PALETTES (Basé sur la maquette AI) */}
                        <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Dynamic Color Palettes</h3>

                            <div className="grid grid-cols-4 gap-4 mb-4">
                                {/* Palette Colors */}
                                {[
                                    { name: 'Rouge Maison', color: 'bg-orange-500', glow: 'shadow-[#f97316]' },
                                    { name: 'Bleu Océan', color: 'bg-pink-500', glow: 'shadow-[#ec4899]' },
                                    { name: 'Vert Forêt', color: 'bg-cyan-400', glow: 'shadow-[#22d3ee]' },
                                    { name: 'Violet Nuit', color: 'bg-purple-500', glow: 'shadow-[#a855f7]' },
                                    { name: 'Blanc Pur', color: 'bg-white', glow: 'shadow-[#ffffff]' },
                                    { name: 'Off', color: 'bg-slate-800', glow: 'shadow-none' },
                                ].map((c, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 cursor-pointer group">
                                        <div className={`w-12 h-12 rounded-full border-2 border-[#262c36] ${c.color} group-hover:border-white transition-all ${c.glow ? `group-hover:shadow-[0_0_15px_${c.color.replace('bg-', '')}]` : ''}`} />
                                        <span className="text-[10px] text-slate-400 text-center font-medium leading-tight">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* GOBO & BEAM SHAPING */}
                        <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Gobo & Beam Shaping</h3>

                            <div className="flex gap-2 mb-6">
                                {[1, 2, 3, 4].map(g => (
                                    <div key={g} className="w-10 h-10 rounded-full border-2 border-cyan-500/30 flex items-center justify-center cursor-pointer hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                                        <div className="w-6 h-6 rounded-full border border-cyan-400/50 flex items-center justify-center">
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono uppercase">
                                        <span>Zoom</span>
                                        <span>45%</span>
                                    </div>
                                    <input type="range" className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono uppercase">
                                        <span>Focus</span>
                                        <span>Sharp</span>
                                    </div>
                                    <input type="range" className="w-full accent-pink-500 h-1 bg-slate-800 rounded-full appearance-none" />
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {selectedNode.type === 'sliderInput' && (
                    <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Dimmer Configuration</h3>
                        <p className="text-sm text-slate-400 mb-4">Assign this slider to a specific macro or group of lights.</p>

                        <div className="space-y-3">
                            <div className="bg-slate-800 p-3 rounded text-sm text-white cursor-pointer hover:bg-slate-700">Dimmer Group 1</div>
                            <div className="bg-slate-800 p-3 rounded text-sm text-white cursor-pointer hover:bg-slate-700">Speed Control</div>
                        </div>
                    </div>
                )}

                {selectedNode.type === 'padInput' && (
                    <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Pad Settings</h3>

                        <div className="grid grid-cols-2 gap-2">
                            <button className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 p-2 rounded text-xs font-bold hover:bg-yellow-500 hover:text-white transition-colors">FLASH MODE (MOMENTARY)</button>
                            <button className="bg-slate-800 border border-slate-700 text-slate-400 p-2 rounded text-xs font-bold hover:bg-slate-700 hover:text-white transition-colors">TOGGLE MODE (LATCH)</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
