"use client";

import React, { useState } from "react";
import {
  X,
  Sliders,
  CheckCircle2,
} from "lucide-react";

interface ApcMiniMapperProps {
  onClose: () => void;
  onSuccess: (config: any) => void;
}

export default function ApcMiniMapper({ onClose, onSuccess }: ApcMiniMapperProps) {
  // Option parameters
  const [effectsLayering, setEffectsLayering] = useState(true);
  const [goMode, setGoMode] = useState(false);

  // LED Brightness values
  const [brightnessOn, setBrightnessOn] = useState(100);
  const [brightnessOff, setBrightnessOff] = useState(20);

  // Active slider positions (for visual display / demo)
  const [faders] = useState<number[]>([45, 60, 30, 75, 40, 40, 40, 40, 30]);

  // Selected Preset
  const [selectedPreset, setSelectedPreset] = useState("default");

  const handleApply = () => {
    const config = {
      effectsLayering,
      goMode,
      brightnessOn,
      brightnessOff,
      preset: selectedPreset
    };
    onSuccess(config);
    onClose();
  };

  const faderMeta = [
    { label: "A", color: "bg-orange-500 shadow-orange-500/20" },
    { label: "B", color: "bg-sky-500 shadow-sky-500/20" },
    { label: "C", color: "bg-green-500 shadow-green-500/20" },
    { label: "D", color: "bg-yellow-500 shadow-yellow-500/20" },
    { label: "MEM 1", color: "bg-cyan-600 shadow-cyan-600/20" },
    { label: "MEM 2", color: "bg-cyan-600 shadow-cyan-600/20" },
    { label: "MEM 3", color: "bg-cyan-600 shadow-cyan-600/20" },
    { label: "MEM 4", color: "bg-cyan-600 shadow-cyan-600/20" },
    { label: "Vit. FX", color: "bg-blue-700 shadow-blue-700/20" }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans text-slate-200">
      <div className="relative w-full max-w-xl bg-[#111318] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
          <div>
            <h2 className="text-white text-md font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Configuration AKAI APC mini
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Configuration des potentiomètres et retours LED</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/40"
            >
              <option value="default">Preset Standard</option>
              <option value="live">Performance Live</option>
              <option value="custom">Personnalisé</option>
            </select>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between space-y-6">
          
          {/* SLIDERS GRAPHIC REPRESENTATION */}
          <div className="bg-[#181b21] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
            <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider text-left">
              Faders de contrôle ({faders.length})
            </p>
            
            <div className="flex justify-around items-end h-[160px] pb-2 relative">
              {faders.map((val, idx) => {
                const meta = faderMeta[idx];
                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end w-10">
                    <div className="relative w-1.5 h-[120px] bg-black/55 rounded-full flex justify-center items-end">
                      {/* Fader track filled part */}
                      <div
                        className="absolute bottom-0 w-full rounded-full bg-cyan-500/20"
                        style={{ height: `${val}%` }}
                      />
                      
                      {/* Fader cap thumb */}
                      <div
                        style={{ bottom: `calc(${val}% - 8px)` }}
                        className={`absolute w-4 h-4 rounded-md shadow-md border border-white/10 cursor-ns-resize transition-all ${meta.color}`}
                      />
                    </div>
                    
                    <span className="text-[8px] text-slate-500 font-bold mt-2 font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-[9px] font-black text-slate-300 mt-0.5 truncate max-w-[40px] text-center font-sans">
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PARAMETERS SECTION */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Options Checkboxes */}
            <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 justify-center text-left">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Options</p>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={effectsLayering}
                  onChange={(e) => setEffectsLayering(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded border-slate-600 bg-slate-800"
                />
                <div>
                  <p className="text-[11px] text-white font-medium">Superposition d'effets</p>
                  <p className="text-[8px] text-slate-500">Permet d'empiler plusieurs effets de zone</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group border-t border-white/5 pt-2">
                <input
                  type="checkbox"
                  checked={goMode}
                  onChange={(e) => setGoMode(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded border-slate-600 bg-slate-800"
                />
                <div>
                  <p className="text-[11px] text-white font-medium">Mode GO</p>
                  <p className="text-[8px] text-slate-500">Remplace le bouton TAP par le déclenchement Cue</p>
                </div>
              </label>
            </div>

            {/* LED Brightness Sliders */}
            <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 text-left">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Luminosité Leds</p>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300 font-medium">Leds allumées (ON)</span>
                  <span className="text-cyan-400 font-bold font-mono">{brightnessOn}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={brightnessOn}
                  onChange={(e) => setBrightnessOn(parseInt(e.target.value))}
                  className="w-full h-1 bg-black/40 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="space-y-1 border-t border-white/5 pt-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300 font-medium">Leds éteintes (OFF)</span>
                  <span className="text-slate-400 font-bold font-mono">{brightnessOff}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={brightnessOff}
                  onChange={(e) => setBrightnessOff(parseInt(e.target.value))}
                  className="w-full h-1 bg-black/40 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-white/5 hover:bg-white/5 rounded-xl text-xs font-bold transition-all text-slate-400 hover:text-white"
          >
            Annuler
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            <CheckCircle2 className="w-4 h-4" />
            Appliquer
          </button>
        </div>

      </div>
    </div>
  );
}
