import React from 'react';
import { socket } from '../../lib/socket';
import useStore, { SmartPad as PadType } from '../../store/useStore';
import { Activity, Flame, Zap, Droplets, Sparkles, AudioLines } from 'lucide-react';

const IconMap: Record<string, React.ElementType> = {
    Activity, Flame, Zap, Droplets, Sparkles, AudioLines
};

export const Pad = ({ pad }: { pad: PadType }) => {
    const { smartActiveScene, setSmartActiveScene, midiLearnMode, midiLearnActiveControl, setMidiLearnActiveControl, midiMappings } = useStore();
    const active = smartActiveScene === pad.qlcWidget;
    const Icon = IconMap[pad.iconName || 'Zap'] || Zap;

    const controlId = `pad_${pad.id}`;
    const isLearning = midiLearnMode && midiLearnActiveControl === controlId;
    const hasMapping = !!midiMappings[controlId];

    const handlePress = () => {
        if (useStore.getState().midiLearnMode) {
            setMidiLearnActiveControl(isLearning ? null : controlId);
            return;
        }

        const isActive = active;
        if (pad.qlcWidget && socket) socket.emit('smart:trigger_scene', { pageId: pad.qlcPage || 1, widgetId: pad.qlcWidget, active: !isActive });
        setSmartActiveScene(!isActive && pad.qlcWidget ? pad.qlcWidget : null);
    };

    return (
        <button
            onMouseDown={handlePress}
            onTouchStart={handlePress}
            className={`w-full aspect-square md:aspect-[4/3] rounded-xl border-2 transition-all outline-none flex flex-col items-center justify-center p-2 gap-2 relative overflow-hidden group
                ${isLearning
                    ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse'
                    : active
                        ? 'border-white scale-95 brightness-150 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                        : 'border-[#262c36] hover:border-white/20'} 
                ${pad.color} ${pad.textColor || 'text-white'} font-bold
            `}
        >
            <div className={`absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors ${active || isLearning ? 'opacity-0' : ''}`} />
            {hasMapping && midiLearnMode && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400"></div>}
            <Icon className="w-6 h-6 z-10 opacity-90 drop-shadow-md" />
            <span className="text-xs lg:text-sm text-center tracking-widest leading-tight uppercase z-10 drop-shadow-md opacity-90">{pad.name}</span>
        </button>
    );
};
