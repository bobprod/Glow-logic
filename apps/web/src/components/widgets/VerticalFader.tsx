import React from 'react';
import { socket } from '../../lib/socket';
import useStore from '../../store/useStore';

export const VerticalFader = ({ label, zoneId, zoneName }: { label: string, zoneId?: number, zoneName: string }) => {
    const { smartZoneValues, setSmartZoneValue, midiLearnMode, midiLearnActiveControl, setMidiLearnActiveControl, midiMappings } = useStore();
    const value = smartZoneValues[zoneName] || 0;

    const controlId = `fader_${zoneName}`;
    const isLearning = midiLearnMode && midiLearnActiveControl === controlId;
    const hasMapping = !!midiMappings[controlId];

    const handleClick = () => {
        if (midiLearnMode) {
            setMidiLearnActiveControl(isLearning ? null : controlId);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (midiLearnMode) return;
        const val = parseInt(e.target.value);
        setSmartZoneValue(zoneName, val);
        if (zoneId && socket) {
            const val255 = Math.round((val / 100) * 255);
            socket.emit('smart:zone_intensity', { zoneId, value: val255 });
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`flex flex-col items-center justify-between h-full py-4 gap-4 bg-[#1a1c23] border ${isLearning ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-blue-500/10' : 'border-[#262c36]'} rounded-xl flex-1 shadow-inner relative group cursor-pointer`}
        >
            {hasMapping && midiLearnMode && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400"></div>}
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase group-hover:text-cyan-400 transition-colors">{label}</span>

            <div className="relative h-48 w-12 flex justify-center py-2">
                <input
                    type="range"
                    min="0" max="100"
                    value={value}
                    onChange={handleChange}
                    className="w-48 h-2 absolute top-1/2 -translate-y-1/2 -rotate-90 appearance-none bg-black rounded-full shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] border border-[#262c36] cursor-pointer"
                    style={{
                        accentColor: '#38bdf8'
                    }}
                />
                <div className="absolute bottom-[-20px] bg-black/50 px-2 py-0.5 rounded text-[10px] text-cyan-400 font-mono font-bold shadow-sm">{value}%</div>
            </div>

            <span className="text-[10px] text-slate-600 font-bold tracking-widest uppercase mt-4">CH {zoneId}</span>
        </div>
    );
};
