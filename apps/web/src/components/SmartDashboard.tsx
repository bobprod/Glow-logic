"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Activity, Flame, Zap, Droplets, Plus, X, Check, Sparkles, AudioLines, Mic2 } from 'lucide-react';
import { socket } from '../lib/socket';
import useStore from '../store/useStore';

const ZONE_MAP: Record<string, { pageId: number; widgetId: number }> = {
    Master: { pageId: 1, widgetId: 1 },
    Stage: { pageId: 1, widgetId: 2 },
    Bar: { pageId: 1, widgetId: 3 },
    Dancefloor: { pageId: 1, widgetId: 4 },
};

const SCENE_COLORS = [
    { label: 'Cyan', bg: 'bg-cyan-500', text: 'text-cyan-400' },
    { label: 'Rouge', bg: 'bg-red-500', text: 'text-red-400' },
    { label: 'Violet', bg: 'bg-purple-500', text: 'text-purple-400' },
    { label: 'Vert', bg: 'bg-green-500', text: 'text-green-400' },
    { label: 'Orange', bg: 'bg-orange-500', text: 'text-orange-400' },
    { label: 'Rose', bg: 'bg-pink-500', text: 'text-pink-400' },
    { label: 'Blanc', bg: 'bg-white', text: 'text-slate-100' },
    { label: 'Bleu', bg: 'bg-blue-500', text: 'text-blue-400' },
];

const ICONS: Record<string, React.ReactNode> = {
    'Droplets': <Droplets className="w-6 h-6" />,
    'Flame': <Flame className="w-6 h-6" />,
    'Zap': <Zap className="w-6 h-6" />,
    'Activity': <Activity className="w-6 h-6" />
};

export default function SmartDashboard() {
    // Persistance via Zustand — survit aux changements de mode
    const {
        smartActiveScene: activeScene, setSmartActiveScene: setActiveScene,
        smartZoneValues: zoneValues, setSmartZoneValue,
        smartPads: pads, addSmartPad
    } = useStore();

    // Modal "New Scene"
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(SCENE_COLORS[0]);
    const [newWidget, setNewWidget] = useState(20);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showModal) setTimeout(() => nameInputRef.current?.focus(), 50);
    }, [showModal]);

    const handleZoneChange = useCallback((zoneName: string, rawValue: number) => {
        setSmartZoneValue(zoneName, rawValue);
        const map = ZONE_MAP[zoneName];
        if (!map) return;
        const value255 = Math.round((rawValue / 100) * 255);
        socket.emit('smart:zone_intensity', { zoneId: map.widgetId, value: value255 });
    }, [setSmartZoneValue]);

    const handlePadClick = useCallback((pad: typeof pads[0]) => {
        const isActive = activeScene === pad.id;
        if (activeScene !== null && activeScene !== pad.id) {
            const prev = pads.find(p => p.id === activeScene);
            if (prev) socket.emit('smart:trigger_scene', { pageId: prev.qlcPage, widgetId: prev.qlcWidget, active: false });
        }
        socket.emit('smart:trigger_scene', { pageId: pad.qlcPage, widgetId: pad.qlcWidget, active: !isActive });
        setActiveScene(isActive ? null : pad.id);
    }, [activeScene, pads, setActiveScene]);

    const handleCreateScene = useCallback(() => {
        if (!newName.trim()) return;
        const newId = Date.now();
        addSmartPad({
            id: newId,
            name: newName.trim(),
            color: newColor.bg,
            textColor: newColor.text,
            iconName: 'Zap',
            qlcPage: 1,
            qlcWidget: newWidget,
        });
        setShowModal(false);
        setNewName('');
        setNewColor(SCENE_COLORS[0]);
        setNewWidget(prev => prev + 1);
    }, [newName, newColor, newWidget, addSmartPad]);

    return (
        <div className="w-full h-full bg-[#0a0c10] overflow-y-auto p-6 flex gap-6 relative">

            {/* ====== MODAL NEW SCENE ====== */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div
                        className="bg-[#12141A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header modal */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-white font-black text-lg tracking-tight flex items-center gap-2">
                                <Plus className="w-5 h-5 text-cyan-400" />
                                Nouvelle Scène
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Nom */}
                        <div className="mb-5">
                            <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">Nom de la scène</label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateScene()}
                                placeholder="Ex: Golden Hour, Acid Drop…"
                                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm"
                            />
                        </div>

                        {/* Couleur */}
                        <div className="mb-5">
                            <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">Couleur</label>
                            <div className="grid grid-cols-8 gap-2">
                                {SCENE_COLORS.map(c => (
                                    <button
                                        key={c.label}
                                        title={c.label}
                                        onClick={() => setNewColor(c)}
                                        className={`w-8 h-8 rounded-lg ${c.bg} transition-all ${newColor.label === c.label
                                            ? 'ring-2 ring-white ring-offset-2 ring-offset-[#12141A] scale-110'
                                            : 'opacity-60 hover:opacity-100 hover:scale-105'
                                            }`}
                                    >
                                        {newColor.label === c.label && (
                                            <Check className="w-4 h-4 text-black mx-auto" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Widget QLC+ */}
                        <div className="mb-6">
                            <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2 block">
                                QLC+ Widget ID
                                <span className="ml-2 text-slate-600 normal-case font-normal">(Virtual Console)</span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={512}
                                value={newWidget}
                                onChange={e => setNewWidget(Number(e.target.value))}
                                className="w-full bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-sm font-mono"
                            />
                        </div>

                        {/* Preview */}
                        <div className="mb-6">
                            <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 block">Aperçu</label>
                            <div className={`rounded-2xl relative overflow-hidden border-2 min-h-[100px] ${newColor.text} border-current`}>
                                <div className={`absolute inset-0 ${newColor.bg} opacity-30`} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="relative h-full flex flex-col justify-end p-4">
                                    <div className={`mb-2 p-2 rounded-xl bg-white/10 w-fit ${newColor.text}`}>
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-white font-black text-sm">{newName || 'Ma Scène'}</h3>
                                    <p className={`text-xs mt-0.5 ${newColor.text}`}>Click to Trigger</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 font-bold transition-all text-sm"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateScene}
                                disabled={!newName.trim()}
                                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${newName.trim()
                                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                    }`}
                            >
                                <Plus className="w-4 h-4" />
                                Créer la scène
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Colonne Gauche */}
            <div className="w-64 flex flex-col gap-4 shrink-0">
                <div className="bg-[#12141A] rounded-xl border border-white/5 p-5 shadow-2xl">
                    <h2 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
                        <AudioLines className="w-4 h-4 text-cyan-400" />
                        Zone Controls
                    </h2>
                    <div className="flex flex-col gap-5">
                        {Object.keys(ZONE_MAP).map((zone, i) => (
                            <div key={zone} className="flex flex-col gap-2">
                                <div className="flex justify-between text-xs text-gray-400 font-medium">
                                    <span>{zone}</span>
                                    {/* FIX BUG #1 : valeur dynamique liée au state */}
                                    <span className={i === 0 ? 'text-cyan-400 font-bold' : ''}>
                                        {zoneValues[zone]}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={zoneValues[zone]}
                                    className={`w-full h-2 rounded-full appearance-none bg-slate-800 cursor-pointer ${i === 0 ? 'accent-cyan-400' : 'accent-slate-400'}`}
                                    onChange={(e) => handleZoneChange(zone, Number(e.target.value))}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Context */}
                <div className="bg-[#12141A] rounded-xl border border-white/5 p-5 flex-1 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent opacity-50 pointer-events-none" />
                    <h2 className="text-white font-bold mb-4 flex items-center gap-2 text-sm relative z-10">
                        <Mic2 className="w-4 h-4 text-purple-400" />
                        Live Context
                    </h2>
                    <div className="relative z-10">
                        <p className="text-xs text-purple-400 font-bold mb-1">NOW PLAYING</p>
                        <p className="text-white font-black text-xl leading-tight">Losing It</p>
                        <p className="text-gray-400 text-sm mb-4">FISHER</p>
                        <div className="bg-black/50 rounded-lg p-3 border border-white/5 mt-4">
                            <p className="text-center text-gray-300 italic text-sm font-serif">
                                &quot;I&apos;m losing it...&quot;
                            </p>
                            <p className="text-center text-white font-black mt-2 animate-pulse">
                                DROP IN 4 BEATS
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Colonne Centrale */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Scene Launcher Grid */}
                <div className="grid grid-cols-4 gap-4 flex-1">

                    {pads.map((pad) => {
                        const isActive = activeScene === pad.id;
                        return (
                            <div
                                key={pad.id}
                                onClick={() => handlePadClick(pad)}
                                className={`rounded-2xl relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 min-h-[140px] ${isActive
                                    ? `border-current ${pad.textColor} shadow-[0_0_30px_rgba(6,182,212,0.3)]`
                                    : 'border-transparent hover:border-white/10'
                                    }`}
                            >
                                <div className={`absolute inset-0 ${pad.color} ${isActive ? 'opacity-30' : 'opacity-10'} transition-opacity`} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                {isActive && (
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-current animate-ping" />
                                )}
                                <div className="relative h-full flex flex-col justify-end p-4">
                                    <div className={`mb-3 p-2.5 rounded-xl bg-white/10 w-fit ${pad.textColor}`}>
                                        {ICONS[pad.iconName] || <Zap className="w-6 h-6" />}
                                    </div>
                                    <h3 className="text-white font-black text-base">{pad.name}</h3>
                                    <p className={`text-xs mt-1 font-medium ${isActive ? pad.textColor : 'text-gray-500'}`}>
                                        {isActive ? '● ACTIVE' : 'Click to Trigger'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add New Scene — ouvre la modal */}
                    <div
                        onClick={() => setShowModal(true)}
                        className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all min-h-[140px] group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-cyan-500/20 flex items-center justify-center mb-2 transition-all">
                            <Plus className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 group-hover:text-cyan-400 transition-colors">New Scene</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
