 
'use client';

import React, { useState } from 'react';
import { Sparkles, Send, Loader2, FlaskConical } from 'lucide-react';
import useStore from '../store/useStore';
import { socket } from '../lib/socket';
import { API_BASE } from '../lib/config';
import { dmxEngine } from '../lib/dmxEngine';
import { filterUnsafeAiActions, validateSafetyAction } from '../lib/safetyClient';

// AI Response & Command interfaces matching OrchestratorController
interface DmxCommand {
  universe: number;
  channel: number;
  value: number;
  description: string;
}

interface AiAction {
  type: string;
   
  payload: any;
}

interface AiResponse {
  description: string;
  commands?: DmxCommand[];
  actions?: AiAction[];
}

export default function SmartSyncHub() {
  const {
    bpm,
    smartAutoPilot,
    setSmartAutoPilot,
    smartActiveScene,
    smartPads,
    triggerSmartPad,
    addSmartPad,
    updateSmartPad,
    deleteSmartPad,
    setGroupLevel,
    setGroupMute,
    setGroupColor,
    groupLevels,
    groupMutes,
    groupColors,
    playlist,
    updateTrackSettings,
    setCurrentTrackIndex,
    setIsPlaying,
    setMasterVolume,
    addToast,
    clips,
    addClip,
    deleteClip,
    markers,
    addMarker,
    deleteMarker,
  } = useStore();

  // Pixel & Shape Engine States
  const [activeShape, setActiveShape] = useState('cercle');
  const [shapeSpeed, setShapeSpeed] = useState(40);
  const [shapeSize, setShapeSize] = useState(80);
  const [syncToBpm, setSyncToBpm] = useState(true);

  // AI Chat states
  const [prompt, setPrompt] = useState("");
  const [aiMessage, setAiMessage] = useState("Prêt pour live. Lyres sychronisées sur réticule. Tape ton ordre ci-dessous pour contrôler le show par IA !");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // AI Show Generator states
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Reticle position (static).
  // NOTE (honnêteté UI): l'ancienne animation déplaçait le réticule au hasard
  // (Math.random) pour SIMULER un tracking IA qui n'existe pas. Aucune caméra,
  // aucune détection réelle n'est câblée. On fige donc la position pour ne plus
  // faire croire à un suivi autonome. Le réticule reste affiché comme maquette/démo.
  const [reticlePos] = useState({ x: 45, y: 40 });

  // Color helper to match the active DMX color in Stage View
  const getActiveFixtureColor = () => {
    if (smartActiveScene !== null) {
      const activePad = smartPads.find(p => p.qlcWidget === smartActiveScene);
      if (activePad) {
        if (activePad.color.includes('cyan')) return '#06b6d4';
        if (activePad.color.includes('red')) return '#ef4444';
        if (activePad.color.includes('purple')) return '#a855f7';
        if (activePad.color.includes('green')) return '#22c55e';
        if (activePad.color.includes('orange')) return '#f97316';
        if (activePad.color.includes('pink')) return '#ec4899';
        if (activePad.color.includes('yellow')) return '#eab308';
        if (activePad.color.includes('white')) return '#ffffff';
      }
    }
    return '#22d3ee'; // default cyan
  };

  const fixtureColor = getActiveFixtureColor();

  // AI Show Generator — DÉMO non câblée.
  // NOTE (honnêteté UI): il n'y a AUCUNE analyse audio réelle ici. L'ancienne
  // version émettait via setTimeout de faux logs ("128.5 BPM détecté",
  // "analyse audio de banger_mix.mp3", "structure identifiée") pour simuler une
  // détection IA inexistante. On a retiré ces fausses promesses. Le bouton charge
  // désormais un GABARIT DE DÉMO statique (marqueurs + clips d'exemple), clairement
  // étiqueté comme tel, sans prétendre analyser un MP3.
  const handleGenerateShow = async () => {
    setIsAnalyzing(true);
    addToast({
      type: 'warning',
      message: 'Gabarit de démo (non câblé)',
      detail: 'Aucune analyse audio réelle. Insertion d\'un exemple de timeline statique.',
      duration: 3000
    });

    socket.emit('timeline_log', { type: 'warn', text: "[DÉMO] Gabarit de show statique inséré — pas d'analyse audio réelle (feature expérimentale non câblée)." });

    // Clear previous clips & markers
    clips.forEach(c => deleteClip(c.id));
    markers.forEach(m => deleteMarker(m.id));

    // Demo markers (exemple statique, pas issu d'une analyse)
    addMarker({ id: 'mkr-1', name: 'INTRO (démo)', time: 0, color: '#22d3ee' });
    addMarker({ id: 'mkr-2', name: 'CHORUS (démo)', time: 20000, color: '#f43f5e' });
    addMarker({ id: 'mkr-3', name: 'DROP 1 (démo)', time: 60000, color: '#fb923c' });
    addMarker({ id: 'mkr-4', name: 'BREAKDOWN (démo)', time: 120000, color: '#a78bfa' });

    // Demo clips on track 'lights'
    addClip({ id: 'gen-c1', track: 'lights', name: 'INTRO BUILD (démo)', startTime: 0, duration: 20000, color: 'bg-cyan-500', textColor: 'text-cyan-400', qlcPage: 1, qlcWidget: 10 });
    addClip({ id: 'gen-c2', track: 'lights', name: 'CHORUS BRIGHT (démo)', startTime: 20000, duration: 40000, color: 'bg-orange-500', textColor: 'text-orange-400', qlcPage: 1, qlcWidget: 12 });
    addClip({ id: 'gen-c3', track: 'lights', name: 'MAIN DROP STROBE (démo)', startTime: 60000, duration: 60000, color: 'bg-pink-500', textColor: 'text-pink-400', qlcPage: 1, qlcWidget: 11 });

    // Demo clip on track 'fx' only if Safety Gate allows simulated laser content.
    try {
      const safety = await validateSafetyAction({
        hazard: 'laser',
        outputMode: 'simulation',
        source: 'ai',
        description: 'Demo show generator: LASER WAVES timeline clip',
      });
      if (safety.allowed) {
        addClip({ id: 'gen-c7', track: 'fx', name: 'LASER WAVES (démo)', startTime: 60000, duration: 60000, color: 'bg-green-500', textColor: 'text-green-400', qlcPage: 1, qlcWidget: 13 });
      } else {
        addClip({ id: 'gen-c7-safe', track: 'fx', name: 'BEAM WAVES SAFE (démo)', startTime: 60000, duration: 60000, color: 'bg-green-500', textColor: 'text-green-400', qlcPage: 1, qlcWidget: 13 });
        addToast({
          type: 'warning',
          message: 'Safety Gate',
          detail: `Laser remplace par effet beam: ${safety.reason}`,
          duration: 4500,
        });
      }
    } catch {
      addClip({ id: 'gen-c7-safe', track: 'fx', name: 'BEAM WAVES SAFE (démo)', startTime: 60000, duration: 60000, color: 'bg-green-500', textColor: 'text-green-400', qlcPage: 1, qlcWidget: 13 });
    }

    // Demo clip on track 'visuals'
    addClip({ id: 'gen-c9', track: 'visuals', name: 'VJ LOOP INTRO (démo)', startTime: 0, duration: 60000, color: 'bg-blue-500', textColor: 'text-blue-400', qlcPage: 1, qlcWidget: 12 });

    setIsAnalyzing(false);
    addToast({
      type: 'info',
      message: 'Gabarit de démo inséré',
      detail: 'Exemple de timeline statique (non issu d\'une analyse audio).',
    });
  };

  // AI LLM Chat Action applier (identical to OrchestratorController)
  const applyAiActions = async (actions: AiAction[]) => {
    const safetyResult = await filterUnsafeAiActions(actions, "ai", addToast);
    for (const action of safetyResult.accepted) {
      try {
        switch (action.type) {
          case "CREATE_PAD": {
            const p = action.payload;
            const nextWidget = smartPads.length > 0 ? Math.max(...smartPads.map(x => x.qlcWidget)) + 1 : 20;
            addSmartPad({
              id: Date.now() + Math.random(),
              name: p.name || "Pad IA",
              color: p.color || "bg-purple-500",
              textColor: p.textColor || "text-purple-400",
              iconName: p.iconName || "Sparkles",
              qlcPage: 1,
              qlcWidget: nextWidget,
              dmxValues: p.dmxValues || {},
              midiNote: p.midiNote ?? -1,
              midiChannel: p.midiChannel ?? 1,
              gridCol: 0, gridRow: 0, gridW: 1, gridH: 1,
            });
            break;
          }
          case "UPDATE_PAD":
            if (action.payload.id) updateSmartPad(action.payload.id, action.payload);
            break;
          case "DELETE_PAD":
            if (action.payload.id) deleteSmartPad(action.payload.id);
            break;
          case "SET_GROUP_LEVEL":
            if (action.payload.group) setGroupLevel(action.payload.group, action.payload.value ?? 80);
            break;
          case "SET_GROUP_COLOR":
            if (action.payload.group) setGroupColor(action.payload.group, action.payload.hex ?? "#ffffff");
            break;
          case "SET_GROUP_MUTE":
            if (action.payload.group) setGroupMute(action.payload.group, !!action.payload.muted);
            break;
          case "SET_LIGHT_MODE":
            if (action.payload.trackIndex !== undefined) {
              const trackId = playlist[action.payload.trackIndex]?.id;
              if (trackId) {
                updateTrackSettings(trackId, {
                  lightMode: action.payload.mode ?? "ia",
                  ...(action.payload.preset ? { aiPreset: action.payload.preset } : {}),
                });
              }
            }
            break;
          case "SET_MASTER_VOLUME":
            setMasterVolume(action.payload.value ?? 0.8);
            break;
          case "PLAY_TRACK":
            if (action.payload.index !== undefined) setCurrentTrackIndex(action.payload.index);
            setIsPlaying(true);
            break;
          case "TOGGLE_PLAY":
            setIsPlaying(true);
            break;
          case "BLACKOUT": {
            const active = !!action.payload.active;
            socket.emit("smart:blackout", { active });
            break;
          }
        }
      } catch (e) {
        console.warn(`[SmartSyncHub AI] Action ${action.type} error:`, e);
      }
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isAiLoading) return;
    
    setIsAiLoading(true);
    const userMessage = prompt.trim();
    setPrompt("");

    try {
      const groupsInfo = Object.entries(groupLevels).map(([g, lvl]) =>
        `  - ${g}: niveau=${lvl}%, muet=${groupMutes[g] ? 'oui' : 'non'}, couleur=${groupColors[g]}`
      ).join('\n');

      const systemPrompt = `Tu es l'IA Lumière de Glow Logic, intégrée dans le Smart Sync Hub.
BPM actuel: ${bpm.toFixed(1)} | Autopilot: ${smartAutoPilot ? 'oui' : 'non'}
Groupes DMX:
${groupsInfo}
Réponds avec un JSON valide contenant:
{
  "description": "Explication en français court (1 phrase) de ton action",
  "commands": [],
  "actions": []
}`;

      const res = await fetch(`${API_BASE}/api/llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, prompt: userMessage }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const content = data.choices?.[0]?.message?.content || data.content || data.text || "";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

      let parsed: AiResponse = { description: "Action appliquée", commands: [], actions: [] };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { description: content, commands: [], actions: [] };
      }

      // Apply commands
      if (parsed.commands) {
        parsed.commands.forEach(cmd => {
          dmxEngine.setChannel(cmd.universe, cmd.channel, cmd.value);
          socket.emit("dmx_update", { universe: cmd.universe, channel: cmd.channel, value: cmd.value });
        });
      }

      // Apply actions
      if (parsed.actions) {
        await applyAiActions(parsed.actions);
      }

      setAiMessage(`"${parsed.description}"`);
      addToast({
        type: 'success',
        message: 'IA Lumière',
        detail: parsed.description,
        duration: 2500
      });
      socket.emit('timeline_log', { type: 'ai', text: `[IA] ${parsed.description}` });

    } catch (err) {
      console.error(err);
      setAiMessage("Erreur: connexion à l'IA Lumière impossible. Vérifiez l'état du serveur.");
      addToast({ type: 'error', message: 'IA Lumière', detail: 'Connexion impossible' });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#12141a] p-8 overflow-y-auto custom-scrollbar">

      {/* HEADER BAR (Identique à la maquette) */}
      <div className="flex items-center justify-between h-16 bg-[#1a1c23]/80 border border-[#262c36] rounded-xl px-6 shadow-lg mb-8 shrink-0">

        {/* Left: BPM & Sync */}
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-1">
            <span className="text-cyan-400 text-3xl font-black tracking-tighter">{bpm.toFixed(1)}</span>
            <span className="text-cyan-400/50 text-sm font-bold tracking-widest">BPM</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-green-500/20 absolute animate-ping"></div>
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-[#1a1c23] z-10"></div>
            </div>
            <span className="text-slate-300 text-xs font-bold font-mono">Sync: Ableton 1</span>
          </div>
        </div>

        {/* Center: Waveform & Vibe */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-[2px] h-6 opacity-70">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-cyan-500 rounded-full animate-pulse"
                style={{
                  height: `${20 + ((i * 37) % 80)}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              ></div>
            ))}
          </div>

          <div className="bg-pink-500/10 border border-pink-500/30 px-3 py-1 rounded-full">
            <span className="text-pink-400 text-xs font-bold">Vibe: Drop / Agressif</span>
          </div>
        </div>

        {/* Right: SMART Toggle & Network */}
        <div className="flex items-center gap-4">
          {/* Badge honnêteté UI: Autopilot est une démo, pas une IA autonome */}
          <span
            title="Autopilot est une maquette de démonstration. Aucun tracking caméra ni décision IA autonome n'est câblé : le réticule et la timeline générée sont des exemples statiques."
            className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider select-none cursor-help"
          >
            <FlaskConical className="w-2.5 h-2.5" /> Expérimental (démo)
          </span>
          <div
            title="Bascule visuelle de démonstration — ne pilote aucune automation IA réelle."
            onClick={() => {
              setSmartAutoPilot(!smartAutoPilot);
              addToast({
                type: 'info',
                message: smartAutoPilot ? 'Autopilot (démo) désactivé' : 'Autopilot (démo) activé',
                detail: 'Démo visuelle uniquement — aucune IA autonome ni tracking réel n\'est câblé.'
              });
            }}
            className="bg-[#262c36] border border-slate-700 rounded-full p-1 flex items-center h-8 cursor-pointer relative w-32 select-none"
          >
            <div className="absolute left-3 text-cyan-400 text-xs font-black tracking-widest z-10">SMART</div>
            <div className="absolute right-3 text-pink-500 text-[10px] font-bold z-10">(PRO)</div>
            {/* Toggle Handle */}
            <div 
              className="w-6 h-6 rounded-full bg-slate-400 shadow absolute transition-all duration-200"
              style={{ transform: smartAutoPilot ? 'translateX(90px)' : 'translateX(0px)' }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content Title */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-white text-lg font-black tracking-widest">SMART SYNC HUB</h1>

        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div> Art-Net</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div> RDM</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div> Wi-Fi</div>
        </div>
      </div>

      {/* TOP SECTIONS */}
      <div className="grid grid-cols-[1fr_350px] gap-6 mb-6 min-h-[420px] shrink-0">

        {/* STAGE VIEW & AI TRACKING */}
        <div className="flex flex-col gap-3 h-full">
          <h2 className="text-slate-300 text-xs font-bold tracking-widest uppercase">STAGE VIEW & AI TRACKING</h2>
          <div className="w-full h-full min-h-[380px] bg-[#0a0c10] border border-[#262c36] rounded-xl relative overflow-hidden flex items-center justify-center">

            {/* Fake Video Feed Background (Using a dark green/gray gradient to simulate raw camera feed) */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#111e1c] to-[#0d1414] opacity-80 mix-blend-screen"></div>

            {/* Fake silhouette (Simulating the person in the mockup) */}
            <div className="w-32 h-64 bg-slate-800/50 rounded-full blur-md absolute bottom-0"></div>

            {/* UI Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
              <span className="text-slate-300 text-xs font-bold tracking-wider">REC - Caméra 1</span>
            </div>

            {/* AI Tracking Reticle */}
            <div 
              className="absolute transition-all duration-1000 ease-in-out"
              style={{ top: `${reticlePos.y}%`, left: `${reticlePos.x}%` }}
            >
              <div className="w-32 h-32 rounded-full border border-green-500/50 bg-green-500/10 flex items-center justify-center absolute -translate-x-1/2 -translate-y-1/2">
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]"></div>
              </div>
              {/* Label */}
              <div className="absolute top-4 left-4 border border-green-500 bg-[#12141a]/80 px-2 py-1 select-none backdrop-blur-sm rounded">
                <span className="text-green-400 text-[10px] font-mono whitespace-nowrap">Cible IA (démo — non câblé)</span>
              </div>

              {/* Tracking Lines */}
              <svg className="absolute top-0 left-0 w-[500px] h-[300px] overflow-visible pointer-events-none" style={{ transform: 'translate(0, 0)' }}>
                <line x1="0" y1="0" x2="180" y2="-80" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
                <line x1="0" y1="0" x2="120" y2="120" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
              </svg>
            </div>

            {/* Fixtures Nodes in Video Feed */}
            <div className="absolute top-[30%] right-[20%] flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-full border flex items-center justify-center bg-[#12141a] transition-all duration-300"
                style={{ borderColor: fixtureColor, boxShadow: `0 0 10px ${fixtureColor}` }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fixtureColor }}></div>
              </div>
              <span className="text-slate-300 text-xs font-bold font-mono">Lyre 1</span>
            </div>

            <div className="absolute bottom-[20%] right-[30%] flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-full border flex items-center justify-center bg-[#12141a] transition-all duration-300"
                style={{ borderColor: fixtureColor, boxShadow: `0 0 10px ${fixtureColor}` }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fixtureColor }}></div>
              </div>
              <span className="text-slate-300 text-xs font-bold font-mono">Lyre 2</span>
            </div>

          </div>
        </div>

        {/* PIXEL & SHAPE ENGINE */}
        <div className="flex flex-col gap-3 h-full">
          <div className="flex justify-between items-end">
            <h2 className="text-slate-300 text-xs font-bold tracking-widest uppercase">PIXEL & SHAPE ENGINE</h2>
            <span className="text-slate-500 text-[10px] font-bold">Moteurs & Formes</span>
          </div>

          <div className="w-full h-full bg-[#1a1c23] border border-[#262c36] rounded-xl p-6 flex flex-col justify-between">

            {/* Shapes Grid */}
            <div className="grid grid-cols-3 gap-3">
              {/* Cercle */}
              <button 
                onClick={() => setActiveShape('cercle')}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeShape === 'cercle'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-bold'
                    : 'border-[#262c36] bg-[#12141a] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="w-8 h-8 rounded-full border-2 border-current"></div>
                <span className="text-[10px] uppercase font-bold tracking-wider">Cercle</span>
              </button>

              {/* Infini */}
              <button 
                onClick={() => setActiveShape('infini')}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeShape === 'infini'
                    ? 'border-pink-500 bg-pink-500/10 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)] font-bold'
                    : 'border-[#262c36] bg-[#12141a] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4Z" /></svg>
                <span className="text-[10px] uppercase font-bold tracking-wider">Infini</span>
              </button>

              {/* Sweep */}
              <button 
                onClick={() => setActiveShape('sweep')}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeShape === 'sweep'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-bold'
                    : 'border-[#262c36] bg-[#12141a] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3v6h-6" /><path d="M21 3 9 15" /><path d="M15 21H3V9" /></svg>
                <span className="text-[10px] uppercase font-bold tracking-wider">Sweep</span>
              </button>

              {/* Vague */}
              <button 
                onClick={() => setActiveShape('vague')}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeShape === 'vague'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)] font-bold'
                    : 'border-[#262c36] bg-[#12141a] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-9 5 18 3-9h5" /></svg>
                <span className="text-[10px] uppercase font-bold tracking-wider">Vague</span>
              </button>

              {/* Bounce */}
              <button 
                onClick={() => setActiveShape('bounce')}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeShape === 'bounce'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] font-bold'
                    : 'border-[#262c36] bg-[#12141a] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 6 7 16" /><path d="M7 6v10h10" /></svg>
                <span className="text-[10px] uppercase font-bold tracking-wider">Bounce</span>
              </button>

              {/* Random */}
              <button 
                onClick={() => setActiveShape('random')}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeShape === 'random'
                    ? 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)] font-bold'
                    : 'border-[#262c36] bg-[#12141a] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM3 15h6v6H3z" /></svg>
                <span className="text-[10px] uppercase font-bold tracking-wider">Random</span>
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-4 my-4">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  <span>Vitesse</span>
                  <span className="text-cyan-400 font-mono">{shapeSpeed}</span>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min={0}
                    max={100}
                    value={shapeSpeed}
                    onChange={(e) => setShapeSpeed(Number(e.target.value))}
                    className="flex-1 accent-cyan-400 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  <span>Taille</span>
                  <span className="text-slate-400 font-mono">{shapeSize}</span>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min={0}
                    max={100}
                    value={shapeSize}
                    onChange={(e) => setShapeSize(Number(e.target.value))}
                    className="flex-1 accent-slate-400 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            {/* Checkbox */}
            <div 
              onClick={() => setSyncToBpm(!syncToBpm)}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                syncToBpm 
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' 
                  : 'border-slate-700 bg-black/20 text-transparent'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <span className="text-slate-300 text-xs font-bold">Synchroniser au BPM</span>
            </div>

          </div>
        </div>

      </div>

      {/* SMART SCENE LAUNCHER */}
      <h2 className="text-slate-300 text-xs font-bold tracking-widest uppercase mb-3 shrink-0">SMART SCENE LAUNCHER</h2>

      <div className="bg-[#1a1c23] border border-[#262c36] rounded-xl p-4 shadow-lg flex flex-col gap-4 shrink-0 mb-6">

        {/* Buttons Row */}
        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-1">

          {/* AI Generator Button — démo (gabarit statique, aucune analyse MP3 réelle) */}
          <button
            onClick={handleGenerateShow}
            disabled={isAnalyzing}
            title="Démo : insère un gabarit de timeline statique. Aucune analyse audio réelle n'est effectuée."
            className={`flex-1 min-w-[200px] h-16 rounded-xl border flex items-center gap-3 px-4 transition-all active:scale-95 ${
              isAnalyzing 
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 cursor-not-allowed'
                : 'bg-[#12141a] hover:bg-orange-500/10 border-orange-500/40 text-orange-400 hover:border-orange-500/60'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg border-2 text-current flex items-center justify-center font-black ${isAnalyzing ? 'border-purple-400' : 'border-orange-500'}`}>
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              )}
            </div>
            <span className="text-xs font-black w-2/3 text-left leading-tight uppercase tracking-wider">
              {isAnalyzing ? 'Insertion...' : 'Gabarit Show (démo)'}
            </span>
          </button>

          {/* Dynamic Scene Buttons based on Zustand smartPads */}
          {smartPads.map((pad, idx) => {
            const isActive = smartActiveScene === pad.qlcWidget;
            return (
              <button
                key={pad.id}
                onClick={() => triggerSmartPad(pad)}
                className={`flex-1 min-w-[180px] h-16 rounded-xl border transition-all flex flex-col justify-center px-4 relative active:scale-95 ${
                  isActive
                    ? `${pad.textColor} border-current bg-white/5 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-bold`
                    : "border-[#262c36] bg-[#12141a] hover:border-slate-500 text-slate-400"
                }`}
              >
                <span className="text-white text-xs font-black block tracking-wide truncate max-w-full">
                  {idx + 1}. {pad.name}
                </span>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold">
                    <div className={`w-2.5 h-2.5 rounded-full ${pad.color}`} />
                    DMX Actif
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono">
                    Fade: 1s
                  </div>
                </div>
              </button>
            );
          })}

        </div>

        {/* AI MessageBox Bottom */}
        <div className="w-full bg-[#12141a] border border-[#262c36] p-3 rounded-xl flex gap-4 items-center">
          <span className="text-purple-400 font-black px-2 text-lg animate-pulse">&gt;</span>
          <div className="flex flex-col flex-1 pl-3 border-l border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="text-slate-400 font-bold text-xs tracking-widest uppercase">Antigravity AI Lumière :</span>
            </div>
            <p className="text-slate-300 text-[11px] font-mono leading-tight whitespace-pre-line">
              {aiMessage}
            </p>
          </div>
        </div>

        {/* AI Command input box */}
        <form onSubmit={handleAiSubmit} className="flex gap-2 items-center w-full bg-[#12141a]/50 p-1.5 rounded-xl border border-white/5">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={`Ordonne à l'IA Lumière... Ex: "Groupe Face en rouge à 80%" ou "Passe en blackout"`}
            disabled={isAiLoading}
            className="flex-1 bg-transparent border-0 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            disabled={isAiLoading || !prompt.trim()}
            className="shrink-0 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs disabled:opacity-30 transition-all flex items-center gap-1.5 shadow"
          >
            {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Envoyer
          </button>
        </form>

      </div>

    </div>
  );
}
