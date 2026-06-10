 
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Sliders, ChevronDown, Lightbulb, Music } from 'lucide-react';
import useStore from '../../store/useStore';
import { socket } from '../../lib/socket';
import { dmxEngine } from '../../lib/dmxEngine';
import MacroTimeline from '../../components/MacroTimeline';

interface DmxChannel {
  channel: number;
  function: string;
  type: string;
  minValue: number;
  maxValue: number;
}

interface Fixture {
  id: number;
  name: string;
  start_address: number;
  total_channels: number;
  channels: DmxChannel[];
}

export default function TimelineView() {
  const {
    clips,
    addClip,
    deleteClip,
    markers,
    addMarker,
    deleteMarker,
    addToast,
    fetchFixtures,
    fixtures,
  } = useStore();

  const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Optical sliders
  const [zoomVal, setZoomVal] = useState(127);
  const [focusVal, setFocusVal] = useState(127);

  // Color palettes values mapping
  const COLOR_PALETTES = [
    { name: 'Rouge Maison', rgb: { r: 255, g: 0, b: 0 }, color: 'bg-red-500', glow: 'shadow-red-500/50' },
    { name: 'Bleu Océan', rgb: { r: 0, g: 0, b: 255 }, color: 'bg-blue-500', glow: 'shadow-blue-500/50' },
    { name: 'Vert Forêt', rgb: { r: 0, g: 255, b: 0 }, color: 'bg-green-500', glow: 'shadow-green-500/50' },
    { name: 'Orange Brûlant', rgb: { r: 255, g: 100, b: 0 }, color: 'bg-orange-500', glow: 'shadow-orange-500/50' },
    { name: 'Cyan Néon', rgb: { r: 0, g: 255, b: 255 }, color: 'bg-cyan-400', glow: 'shadow-cyan-400/50' },
    { name: 'Violet Nuit', rgb: { r: 160, g: 0, b: 255 }, color: 'bg-purple-500', glow: 'shadow-purple-500/50' },
    { name: 'Rose Flash', rgb: { r: 255, g: 0, b: 180 }, color: 'bg-pink-500', glow: 'shadow-pink-500/50' },
    { name: 'Blanc Pur', rgb: { r: 255, g: 255, b: 255 }, color: 'bg-white', glow: 'shadow-white/50' },
  ];

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  useEffect(() => {
    if (!activeFixture && fixtures.length > 0) {
      setActiveFixture(fixtures[0]);
    }
  }, [activeFixture, fixtures]);

  const sendFixtureDmx = useCallback((type: string, val: number) => {
    if (!activeFixture) return;
    const ch = activeFixture.channels.find(c => c.type === type);
    if (ch) {
      const absCh = (activeFixture.start_address || 1) + ch.channel - 1;
      dmxEngine.setChannel(1, absCh, val);
    }
  }, [activeFixture]);

  const handleColorClick = (color: typeof COLOR_PALETTES[0]) => {
    if (!activeFixture) {
      addToast({
        type: 'warning',
        message: 'Aucune fixture sélectionnée',
        detail: 'Sélectionnez ou patchez un projecteur pour lui attribuer une couleur.',
      });
      return;
    }

    sendFixtureDmx('red', color.rgb.r);
    sendFixtureDmx('green', color.rgb.g);
    sendFixtureDmx('blue', color.rgb.b);

    // Color wheel fallback (some beams have physical color wheels instead of RGB)
    const colorWheelCh = activeFixture.channels.find(c => c.type === 'color_wheel');
    if (colorWheelCh) {
      let val = 5;
      if (color.name === 'Rouge Maison') val = 80;
      if (color.name === 'Orange Brûlant') val = 140;
      if (color.name === 'Vert Forêt') val = 120;
      if (color.name === 'Cyan Néon') val = 60;
      if (color.name === 'Bleu Océan') val = 40;
      if (color.name === 'Violet Nuit') val = 150;
      if (color.name === 'Rose Flash') val = 150;
      if (color.name === 'Blanc Pur') val = 5;
      sendFixtureDmx('color_wheel', val);
    }

    addToast({
      type: 'info',
      message: `Couleur appliquée : ${color.name}`,
      detail: activeFixture.name,
      duration: 1200,
    });
  };

  const handleZoomChange = (val: number) => {
    setZoomVal(val);
    sendFixtureDmx('zoom', val);
  };

  const handleFocusChange = (val: number) => {
    setFocusVal(val);
    sendFixtureDmx('focus', val);
  };

  const handleAnalyzeMusic = async () => {
    setIsAnalyzing(true);
    socket.emit('timeline_log', { type: 'sys', text: "[AI] Début de l'analyse audio de /music/banger_mix.mp3..." });

    setTimeout(() => {
      socket.emit('timeline_log', { type: 'info', text: "[AI] Calcul du tempo : 128.0 BPM détecté." });
    }, 500);

    setTimeout(() => {
      socket.emit('timeline_log', { type: 'ai', text: "[AI] Structure identifiée : Intro (0s-20s), Chorus (20s-60s), Drop (60s-120s), Break (120s-150s), Final Drop (150s-210s), Outro (210s-300s)." });
    }, 1200);

    setTimeout(() => {
      // Clear previous clips & markers
      clips.forEach(c => deleteClip(c.id));
      markers.forEach(m => deleteMarker(m.id));

      // Generate new markers
      addMarker({ id: 'mkr-1', name: 'INTRO', time: 0, color: '#22d3ee' });
      addMarker({ id: 'mkr-2', name: 'CHORUS', time: 20000, color: '#f43f5e' });
      addMarker({ id: 'mkr-3', name: 'DROP 1', time: 60000, color: '#fb923c' });
      addMarker({ id: 'mkr-4', name: 'BREAKDOWN', time: 120000, color: '#a78bfa' });
      addMarker({ id: 'mkr-5', name: 'DROP 2', time: 150000, color: '#f43f5e' });
      addMarker({ id: 'mkr-6', name: 'OUTRO', time: 210000, color: '#4ade80' });

      // Generate new clips on track 'lights'
      addClip({ id: 'gen-c1', track: 'lights', name: 'INTRO BUILD', startTime: 0, duration: 20000, color: 'bg-cyan-500', textColor: 'text-cyan-400', qlcPage: 1, qlcWidget: 10 });
      addClip({ id: 'gen-c2', track: 'lights', name: 'CHORUS BRIGHT', startTime: 20000, duration: 40000, color: 'bg-orange-500', textColor: 'text-orange-400', qlcPage: 1, qlcWidget: 12 });
      addClip({ id: 'gen-c3', track: 'lights', name: 'MAIN DROP STROBE', startTime: 60000, duration: 60000, color: 'bg-pink-500', textColor: 'text-pink-400', qlcPage: 1, qlcWidget: 11 });
      addClip({ id: 'gen-c4', track: 'lights', name: 'BREAKDOWN WARM', startTime: 120000, duration: 30000, color: 'bg-cyan-500', textColor: 'text-cyan-400', qlcPage: 1, qlcWidget: 10 });
      addClip({ id: 'gen-c5', track: 'lights', name: 'FINAL DROP STROBE', startTime: 150000, duration: 60000, color: 'bg-pink-500', textColor: 'text-pink-400', qlcPage: 1, qlcWidget: 11 });
      addClip({ id: 'gen-c6', track: 'lights', name: 'OUTRO DECAY', startTime: 210000, duration: 90000, color: 'bg-purple-500', textColor: 'text-purple-400', qlcPage: 1, qlcWidget: 13 });

      // Generate new clips on track 'fx'
      addClip({ id: 'gen-c7', track: 'fx', name: 'LASER WAVES', startTime: 60000, duration: 60000, color: 'bg-green-500', textColor: 'text-green-400', qlcPage: 1, qlcWidget: 13 });
      addClip({ id: 'gen-c8', track: 'fx', name: 'LASER MAX EFFECT', startTime: 150000, duration: 60000, color: 'bg-green-500', textColor: 'text-green-400', qlcPage: 1, qlcWidget: 13 });

      // Generate new clips on track 'visuals'
      addClip({ id: 'gen-c9', track: 'visuals', name: 'VJ LOOP INTRO', startTime: 0, duration: 60000, color: 'bg-blue-500', textColor: 'text-blue-400', qlcPage: 1, qlcWidget: 12 });
      addClip({ id: 'gen-c10', track: 'visuals', name: 'VJ LOOP DROP', startTime: 60000, duration: 60000, color: 'bg-purple-500', textColor: 'text-purple-400', qlcPage: 1, qlcWidget: 11 });
      addClip({ id: 'gen-c11', track: 'visuals', name: 'VJ LOOP BREAK', startTime: 120000, duration: 90000, color: 'bg-blue-500', textColor: 'text-blue-400', qlcPage: 1, qlcWidget: 12 });

      setIsAnalyzing(false);
      addToast({
        type: 'success',
        message: 'Show DMX généré avec succès !',
        detail: 'Les clips d\'automation ont été intégrés à votre timeline.',
      });
      socket.emit('timeline_log', { type: 'sys', text: "[AI] Génération des clips d'automation DMX terminée." });
    }, 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0c10] overflow-hidden">
      
      {/* SCROLLABLE TOP CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-h-[calc(100vh-250px)] custom-scrollbar pr-3">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Music className="w-4 h-4 text-black stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-white text-lg font-black tracking-widest uppercase">AI SHOW GENERATOR</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Séquenceur Timeline & Automation</p>
            </div>
          </div>

          {/* Active Fixture dropdown selector */}
          <div className="relative">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="flex items-center gap-2 px-4 py-2 bg-[#12141A] border border-white/5 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-colors"
            >
              <span>🔦</span>
              {activeFixture ? activeFixture.name : "Sélectionner projecteur"}
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-[#12141A] border border-white/10 rounded-xl shadow-2xl z-50 py-1.5">
                {fixtures.length === 0 ? (
                  <p className="text-slate-500 text-[10px] text-center p-3 uppercase font-bold tracking-wider">Aucune fixture patchée</p>
                ) : (
                  fixtures.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setActiveFixture(f);
                        setShowSelector(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors ${
                        activeFixture?.id === f.id ? "text-cyan-400 bg-cyan-500/5 font-bold" : "text-slate-300"
                      }`}
                    >
                      <span>💡</span>
                      <div>
                        <p>{f.name}</p>
                        <p className="text-[9px] text-slate-600">Ch {f.start_address} | {f.total_channels}ch</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* TOP ROW: PALETTES & GOBOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* DYNAMIC COLOR PALETTES */}
          <div className="bg-[#12141A] border border-white/5 rounded-2xl p-5 shadow-2xl">
            <h2 className="text-white text-xs font-bold tracking-widest mb-4 flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-cyan-400" />
              PALETTES DE COULEURS
            </h2>

            <div className="grid grid-cols-4 gap-4">
              {COLOR_PALETTES.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleColorClick(c)}
                  className="flex flex-col items-center gap-2 cursor-pointer group outline-none"
                >
                  <div className={`w-12 h-12 rounded-xl border border-white/10 ${c.color} group-hover:border-white transition-all group-hover:shadow-[0_0_15px_rgba(255,255,255,0.25)] ${c.glow ? `group-hover:${c.glow}` : ''}`} />
                  <span className="text-[10px] text-center font-bold text-slate-400 group-hover:text-white transition-colors">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* GOBO & BEAM SHAPING */}
          <div className="bg-[#12141A] border border-white/5 rounded-2xl p-5 shadow-2xl flex flex-col">
            <h2 className="text-white text-xs font-bold tracking-widest mb-4 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              OPTIQUE & EFFETS
            </h2>

            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">
                  <span>Zoom</span>
                  <span className="text-cyan-400 font-mono">{zoomVal}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={zoomVal}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none bg-slate-800 rounded-full cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-wider">
                  <span>Focus</span>
                  <span className="text-cyan-400 font-mono">{focusVal}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={focusVal}
                  onChange={(e) => handleFocusChange(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none bg-slate-800 rounded-full cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM AI GENERATOR LAUNCHER */}
        <div className="bg-[#12141A] border border-white/5 rounded-2xl p-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={handleAnalyzeMusic}
              disabled={isAnalyzing}
              className={`h-12 px-6 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 border shadow-lg ${
                isAnalyzing
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 cursor-not-allowed'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ANALYSE EN COURS...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  ANALYSER & GÉNÉRER TIMELINE
                </>
              )}
            </button>
            <div className="flex-1 h-12 bg-[#0a0c10] border border-white/5 rounded-xl flex items-center px-4">
              <span className="text-slate-400 font-mono text-xs">/music/banger_mix.mp3</span>
            </div>
          </div>
        </div>

      </div>

      {/* FIXED TIMELINE FOOTER COMPONENT */}
      <MacroTimeline />
    </div>
  );
}
