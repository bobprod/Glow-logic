import React, { useState, useEffect, useCallback } from 'react';

export default function Sidebar() {
    const [width, setWidth] = useState(300);
    const [isResizing, setIsResizing] = useState(false);

    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label }));
        event.dataTransfer.effectAllowed = 'move';
    };

    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = Math.max(200, Math.min(600, mouseMoveEvent.clientX));
            setWidth(newWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <aside
            className="relative border-r border-[#262c36] bg-[#12141a] p-6 flex flex-col pt-8 z-10 shadow-xl h-full overflow-y-auto"
            style={{ width: `${width}px` }}
        >
            {/* Resize handle */}
            <div
                onMouseDown={startResizing}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors z-20"
            />

            <div className="text-white text-lg font-black tracking-wider mb-6 pb-2 border-b border-[#262c36] flex items-center justify-between">
                <span>VISUAL PATCHING</span>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
            </div>


            {/* SECTION: INPUTS */}
            <div className="mb-8">
                <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em] mb-4">Inputs</h3>
                <div className="flex flex-col gap-3">

                    <div
                        className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-cyan-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'audioIn', 'Audio IN')}
                        draggable
                    >
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5v14M7 5v14M22 10v4M2 10v4" /></svg>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">Audio Source</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Microphone / Loopback</div>
                        </div>
                    </div>

                    {/* Conservons nos UI existantes pour ne rien casser de ton usage actuel */}
                    <div
                        className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-pink-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'sliderInput', 'Nouveau Fader')}
                        draggable
                    >
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-pink-400 transition-colors">
                            <div className="w-4 h-4 rounded-full bg-current"></div>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">UI Slider</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Dimmer Panel Control</div>
                        </div>
                    </div>

                    <div
                        className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-yellow-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'padInput', 'Bouton Flash')}
                        draggable
                    >
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-yellow-400 transition-colors">
                            <div className="w-4 h-4 rounded border-2 border-current bg-current/20"></div>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">UI Pad</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Flash Triggering</div>
                        </div>
                    </div>

                </div>
            </div>

            {/* SECTION: GENERATORS */}
            <div className="mb-8">
                <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em] mb-4">Generators</h3>
                <div className="flex flex-col gap-3">

                    <div
                        className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-green-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'lfoInput', 'LFO Wave')}
                        draggable
                    >
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-green-400 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M0,16 C8,2 16,2 24,16 S40,30 48,16" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">LFO Oscillator</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Sine · Square · Triangle · Saw</div>
                        </div>
                    </div>

                    <div
                        className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-orange-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'colorPicker', 'RGB Color')}
                        draggable
                    >
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <div className="w-full h-full" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">RGB Color Picker</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">DMX R/G/B Channels</div>
                        </div>
                    </div>

                </div>
            </div>

            {/* SECTION: OUTPUTS */}
            <div>
                <h3 className="text-[#94a3b8] text-xs font-bold uppercase tracking-[0.2em] mb-4">Outputs</h3>
                <div className="flex flex-col gap-3">

                    <div
                        className="group relative overflow-hidden flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-cyan-500/80 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'artnetOut', 'Art-Net Universe')}
                        draggable
                    >
                        <div className="w-1 h-full bg-cyan-500 absolute left-0 top-0"></div>
                        <div className="pl-3">
                            <div className="text-white text-sm font-semibold">Art-Net Interface</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Univers 1 </div>
                        </div>
                    </div>

                    <div
                        className="group flex gap-3 items-center p-3 rounded-lg bg-[#1a1c23] border border-[#262c36] cursor-grab hover:border-cyan-500/50 hover:bg-[#1a1c23]/80 transition-all"
                        onDragStart={(event) => onDragStart(event, 'dmxOutput', 'Nouveau Proj.')}
                        draggable
                    >
                        <div className="w-10 h-10 rounded-md bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 transition-colors">
                            <div className="w-4 h-4 bg-current transform rotate-45"></div>
                        </div>
                        <div>
                            <div className="text-white text-sm font-semibold">DMX Fixture</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">Individual Lamp</div>
                        </div>
                    </div>

                </div>
            </div>
        </aside>
    );
}
