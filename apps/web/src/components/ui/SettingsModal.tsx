"use client";

import React, { useState } from 'react';
import { Settings, X, Save } from 'lucide-react';

export type Config = {
    qlcHost: string;
    qlcPort: number;
    oscPort: number;
    artnetUniverse: number;
};

const DEFAULT_CONFIG: Config = {
    qlcHost: '127.0.0.1',
    qlcPort: 9999,
    oscPort: 7700,
    artnetUniverse: 1,
};

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const [cfg, setCfg] = useState<Config>(() => {
        if (typeof window === 'undefined') return DEFAULT_CONFIG;
        try {
            return JSON.parse(localStorage.getItem('glowlogic_config') ?? '') as Config;
        } catch {
            return DEFAULT_CONFIG;
        }
    });

    const handleSave = () => {
        localStorage.setItem('glowlogic_config', JSON.stringify(cfg));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-end pt-16 pr-4" onClick={onClose}>
            <div
                className="bg-[#12141A] border border-white/10 rounded-2xl shadow-2xl w-80 p-6 animate-in fade-in slide-in-from-top-2 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-white font-black text-base flex items-center gap-2">
                        <Settings className="w-4 h-4 text-cyan-400" />
                        Configuration
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4">

                    {/* QLC+ */}
                    <div>
                        <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest mb-3">QLC+ / OSC</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">QLC+ Host IP</label>
                                <input
                                    type="text"
                                    value={cfg.qlcHost}
                                    onChange={e => setCfg(c => ({ ...c, qlcHost: e.target.value }))}
                                    className="w-full bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">OSC In Port</label>
                                    <input
                                        type="number"
                                        value={cfg.oscPort}
                                        onChange={e => setCfg(c => ({ ...c, oscPort: +e.target.value }))}
                                        className="w-full bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Web API Port</label>
                                    <input
                                        type="number"
                                        value={cfg.qlcPort}
                                        onChange={e => setCfg(c => ({ ...c, qlcPort: +e.target.value }))}
                                        className="w-full bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Art-Net */}
                    <div>
                        <p className="text-xs text-purple-400/70 font-bold uppercase tracking-widest mb-3">Art-Net</p>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Universe par défaut</label>
                            <input
                                type="number"
                                min={0}
                                max={32}
                                value={cfg.artnetUniverse}
                                onChange={e => setCfg(c => ({ ...c, artnetUniverse: +e.target.value }))}
                                className="w-full bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="bg-black/30 rounded-lg p-3 border border-white/5 space-y-1.5">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Statut</p>
                        <div className="flex items-center gap-2 text-xs text-green-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Backend : localhost:3005
                        </div>
                        <div className="flex items-center gap-2 text-xs text-green-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            QLC+ OSC → {cfg.qlcHost}:{cfg.oscPort}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    className="mt-5 w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                    <Save className="w-4 h-4" />
                    Sauvegarder
                </button>
            </div>
        </div>
    );
}
