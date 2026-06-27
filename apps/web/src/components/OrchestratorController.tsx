"use client";

import React, { useState, useRef, useEffect } from "react";
import { dmxEngine } from "@/lib/dmxEngine";
import { socket } from "@/lib/socket";
import { API_BASE } from "@/lib/config";
import { filterUnsafeAiActions } from "@/lib/safetyClient";
import { validateOrchestratorActions } from "@/lib/orchestratorSafety";
import {
  Sparkles, Send, Loader2, Wand2, Zap, Music, Flame, Droplets, Wind,
  Plus, Power, HelpCircle, Palette, Layers, Radio, SkipForward,
  SlidersHorizontal, Mic, ChevronDown, ChevronRight, X
} from "lucide-react";
import useStore from "@/store/useStore";
import {
  inferFixtureCategory,
  getCategory,
  isArmingRequired,
  isHazard,
  type FixtureCategoryId,
} from "../lib/fixtureCategories";

// Nombre de slots par page de pads (aligné sur LooksBoard/SceneController).
const SLOTS_PER_PAGE = 16;

// Premier slot libre (page, slot) — réplique EXACTEMENT la logique de création
// d'un pad par défaut de LooksBoard.firstFreeSlot : parcourt 4 pages × 16 slots
// et renvoie la première position non occupée par un pad existant.
const firstFreePadSlot = (
  pads: Array<{ page: number; slot: number }>,
): { page: number; slot: number } => {
  for (let page = 0; page < 4; page += 1) {
    for (let slot = 0; slot < SLOTS_PER_PAGE; slot += 1) {
      if (!pads.some((pad) => pad.page === page && pad.slot === slot)) {
        return { page, slot };
      }
    }
  }
  return { page: 0, slot: 0 };
};

// Catégorie effective d'une fixture : explicite (fixture.category) sinon inférée
// depuis le nom + les types de canaux. Tolère les formes de fixture variées
// (store PatchedFixture ou objet brut passé en prop).
const effectiveCategory = (f: any): FixtureCategoryId => {
  if (f?.category) return f.category as FixtureCategoryId;
  const channelTypes = (f?.channels || []).map((c: any) => String(c?.type ?? ""));
  return inferFixtureCategory(String(f?.name ?? ""), channelTypes);
};

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

interface HistoryEntry {
  prompt: string;
  response: string;
  commands: DmxCommand[];
  actions: AiAction[];
}

interface ScenePreset {
  name: string;
  icon: React.ReactNode;
  prompt: string;
  color: string;
}

const PRESETS: ScenePreset[] = [
  { name: "Disco", icon: <Zap className="w-4 h-4" />, prompt: "Crée une scène disco: couleurs vives rose/cyan/violet alternées, strobe rapide, dimmer 80%", color: "#ec4899" },
  { name: "Calme", icon: <Droplets className="w-4 h-4" />, prompt: "Ambiance calme et relaxante, lumière blanche douce, dimmer 30%, pas de strobe", color: "#3b82f6" },
  { name: "Concert", icon: <Music className="w-4 h-4" />, prompt: "Scène de concert rock: lumières blanches et ambrées, faisceaux étroits, strobe moyen, dimmer 100%", color: "#f97316" },
  { name: "Club", icon: <Flame className="w-4 h-4" />, prompt: "Ambiance club: couleurs néon vert/bleu électrique, UV, mouvements rapides, strobe intense", color: "#22c55e" },
  { name: "Théâtre", icon: <Wind className="w-4 h-4" />, prompt: "Éclairage théâtral dramatique: lumière chaude ambrée, spot central, mouvements lents, pas de strobe", color: "#eab308" },
  { name: "Jazz", icon: <Radio className="w-4 h-4" />, prompt: "Ambiance jazz chaleureuse: teintes cuivrées et ambrées douces, transitions lentes et fluides, pas de strobe", color: "#d97706" },
  { name: "Rock", icon: <Layers className="w-4 h-4" />, prompt: "Mode IA Lumière preset Rock: groupe Face rouge vif, Douche 1-3 en strobe blanc, Latéral et Contre en rouge pulsé sur les graves", color: "#ef4444" },
  { name: "Soirée", icon: <SlidersHorizontal className="w-4 h-4" />, prompt: "Configure 8 pads de scènes pour une soirée DJ complète: entrée, warm-up, build-up, drop, break, outro, blackout, couleurs coordonnées", color: "#8b5cf6" },
];

const QUICK_PROMPTS = [
  "Crée 4 pads: Intro bleu, Rock rouge, Drop violet, Calme blanc",
  "Active le mode IA Lumière preset Club sur la piste en cours",
  "Mets tous les groupes DMX en rouge vif à 80%",
  "Groupe Face en blanc chaud, Contre en bleu profond",
  "Coupe le groupe Douche 2, double le Face",
  "Génère une scène BPM synchro avec le beat actuel",
  "Ajoute la scène actuelle à la timeline à la position courante",
  "Passe en mode Programme pour la piste sélectionnée",
];

export default function OrchestratorController({ fixtures: propFixtures = [] }: { fixtures?: any[] }) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentCommands, setCurrentCommands] = useState<DmxCommand[]>([]);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    fixtures: storeFixtures,
    addSmartPad, updateSmartPad, deleteSmartPad, smartPads: pads,
    setGroupLevel, setGroupMute, setGroupColor,
    groupLevels, groupMutes, groupColors,
    bpm, smartBlackout, setSmartBlackout,
    addClip, viewStart,
    playlist, currentTrackIndex, updateTrackSettings,
    setIsPlaying, setCurrentTrackIndex, masterVolume, setMasterVolume,
    addToast, laserArmed, pyroArmed,
  } = useStore();

  const activeFixtures = propFixtures.length > 0 ? propFixtures : storeFixtures;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  // ─── System prompt builder ────────────────────────────────────────────────
  const buildSystemPrompt = () => {
    const groupsInfo = Object.entries(groupLevels).map(([g, lvl]) =>
      `  - ${g}: niveau=${lvl}%, muet=${groupMutes[g] ? 'oui' : 'non'}, couleur=${groupColors[g]}`
    ).join('\n');

    const padsInfo = pads.map(p =>
      `  - Pad #${p.id} "${p.name}": couleur=${p.color}, midiNote=${p.midiNote}, canaux DMX=${p.dmxValues ? Object.keys(p.dmxValues).length : 0}`
    ).join('\n');

    const currentTrack = playlist[currentTrackIndex];
    const trackInfo = currentTrack
      ? `Piste active: "${currentTrack.name}", mode=${currentTrack.lightMode}, preset=${currentTrack.aiPreset}, volume=${Math.round(currentTrack.volume * 100)}%`
      : "Aucune piste active";

    let fixtureText = "Aucune fixture configurée (mode par défaut: beam adresse 1, canaux Pan=1, Tilt=3, Dimmer=6, Strobe=7, Color=8, Gobo=9)";
    if (activeFixtures.length > 0) {
      fixtureText = activeFixtures.map((f, i) => {
        const start = f.start_address || f.startAddress || 1;
        const universe = f.universe || 1;
        const catId = effectiveCategory(f);
        const cat = getCategory(catId);
        const flags: string[] = [];
        if (isArmingRequired(catId)) flags.push("EFFET A ARMER");
        if (isHazard(catId)) flags.push("DANGER (laser/pyro)");
        const flagText = flags.length > 0 ? ` ⚠ ${flags.join(' — ')}` : '';
        const channels = (f.channels || []).map((ch: any) => {
          const abs = start + ch.channel - 1;
          const live = dmxEngine.getChannel(universe, abs);
          return `Canal ${abs} (${ch.type}/${ch.function || ch.name}): ${live}`;
        }).join(', ');
        return `${i + 1}. "${f.name}" [${cat.label}]${flagText} U${universe} @ ${start}: ${channels}`;
      }).join('\n');
    }

    return `Tu es l'IA Lumière de Glow Logic, un assistant expert en éclairage de scène et contrôle DMX.
Tu peux tout contrôler via des commandes JSON structurées.

## ÉTAT ACTUEL DU SYSTÈME
BPM: ${bpm.toFixed(1)} | Blackout: ${smartBlackout ? 'OUI' : 'non'} | Master: ${Math.round(masterVolume * 100)}%

### Groupes DMX (6 groupes):
${groupsInfo}

### Pads de scènes actifs (${pads.length}):
${padsInfo}

### Show Player:
${trackInfo}
Volume master: ${Math.round(masterVolume * 100)}%
Playlist: ${playlist.length} piste(s)

### Fixtures DMX connectées:
${fixtureText}

## RAISONNEMENT PAR FAMILLES D'ÉQUIPEMENT
Chaque fixture est typée par sa FAMILLE (libellé entre crochets, ex: [Lyre Spot], [PAR / Wash LED], [Laser]).
Raisonne TOUJOURS par familles : adapte tes commandes au type (les lyres ont pan/tilt/gobo, les PAR sont des washes de couleur, les strobes flashent, les barres LED sont des pixels, etc.) — n'envoie pas de pan/tilt à un PAR ni de couleur RGB à un strobe simple.
SÉCURITÉ ABSOLUE : un équipement marqué « EFFET A ARMER » ou « DANGER (laser/pyro) » NE DOIT JAMAIS être activé tant qu'il n'est pas armé par l'opérateur. N'émets aucune commande vers ses canaux : la safety les bloquera et tu perdras l'action. Ignore ces fixtures dans tes scènes sauf demande explicite ET armement confirmé.

## FORMAT DE RÉPONSE (JSON strict)
Réponds UNIQUEMENT avec un objet JSON valide:
{
  "description": "Explication courte en français de ce que tu fais",
  "commands": [
    {"universe": 1, "channel": N, "value": 0-255, "description": "quoi"}
  ],
  "actions": [
    {
      "type": "CREATE_PAD",
      "payload": {"name": "...", "color": "bg-cyan-500", "textColor": "text-cyan-400", "iconName": "Zap", "midiNote": 56, "midiChannel": 1, "dmxValues": {}}
    },
    {
      "type": "UPDATE_PAD",
      "payload": {"id": N, "name": "...", "color": "...", "midiNote": N}
    },
    {
      "type": "DELETE_PAD",
      "payload": {"id": N}
    },
    {
      "type": "SET_GROUP_LEVEL",
      "payload": {"group": "Face", "value": 80}
    },
    {
      "type": "SET_GROUP_COLOR",
      "payload": {"group": "Face", "hex": "#ff0000"}
    },
    {
      "type": "SET_GROUP_MUTE",
      "payload": {"group": "Face", "muted": true}
    },
    {
      "type": "SET_LIGHT_MODE",
      "payload": {"trackIndex": N, "mode": "ia|manuel|programme", "preset": "rock|jazz|club|tv"}
    },
    {
      "type": "SET_MASTER_VOLUME",
      "payload": {"value": 0.8}
    },
    {
      "type": "PLAY_TRACK",
      "payload": {"index": N}
    },
    {
      "type": "TOGGLE_PLAY",
      "payload": {}
    },
    {
      "type": "BLACKOUT",
      "payload": {"active": true}
    },
    {
      "type": "ADD_TIMELINE_CLIP",
      "payload": {"name": "...", "startTime": N, "duration": N, "color": "bg-purple-500", "textColor": "text-purple-300"}
    }
  ]
}

Uniquement les champs "commands" et "actions" que tu as besoin d'utiliser. Tu peux combiner DMX + actions dans la même réponse.
Ne mets AUCUN texte en dehors du JSON.`;
  };

  // ─── Safety context builder (client-side, conservative) ──────────────────
  // Réplique côté client la détection de fixtures dangereuses du serveur
  // (dmxRouter.isDangerousFixture : regex laser/pyro/flame/firework sur nom +
  // canaux). Comme la liste exacte des canaux dangereux n'est pas publiée au
  // browser, on la recalcule depuis activeFixtures. Stratégie conservative :
  // un canal de fixture dangereuse est marqué "dangereux" UNIQUEMENT si le
  // hazard correspondant n'est PAS armé par l'opérateur (laserArmed/pyroArmed).
  // Les canaux d'un hazard armé ne sont pas dans le set => ils passent comme
  // avant. dangerousArmed reste false : tout canal présent dans le set est par
  // construction non armé, donc bloqué.
  const DANGER_RE = /\b(laser|pyro|flame|firework)\b/;

  const fixtureHazard = (f: any): "laser" | "pyro" | null => {
    const head = `${f?.name || ""} ${f?.manufacturer || ""}`.toLowerCase();
    const chanText = (f?.channels || [])
      .map((ch: any) => `${ch?.type || ""} ${ch?.function || ""} ${ch?.name || ""} ${ch?.notes || ""}`)
      .join(" ")
      .toLowerCase();
    const blob = `${head} ${chanText}`;
    if (!DANGER_RE.test(blob)) return null;
    // pyro/flame/firework => pyro ; sinon laser
    return /\b(pyro|flame|firework)\b/.test(blob) ? "pyro" : "laser";
  };

  const buildSafetyContext = (): { dangerousChannels: Set<number>; dangerousArmed: boolean } => {
    const dangerous = new Set<number>();
    for (const f of activeFixtures) {
      // Détection historique (regex laser/pyro sur nom + canaux).
      const hazard = fixtureHazard(f);

      // Détection par FAMILLE : tout équipement « à armer » (effet ou danger)
      // dont l'armement est absent doit être bloqué. Pour le laser on réutilise
      // laserArmed ; pour pyro ET tous les autres effets (fumigène/hazer/co2…)
      // on applique le gate conservateur pyroArmed (bloqué tant que non armé).
      const catId = effectiveCategory(f);
      const armingRequired = isArmingRequired(catId);
      const isLaser = hazard === "laser" || catId === "laser";

      // La fixture est concernée si l'un des deux signaux la marque dangereuse.
      if (!hazard && !armingRequired) continue;

      const armed = isLaser ? laserArmed : pyroArmed;
      if (armed) continue; // armé => ses canaux passent normalement
      const start = f.start_address || f.startAddress || 1;
      const total = Math.max(
        Number(f.total_channels || f.totalChannels || 0),
        ...((f.channels || []).map((ch: any) => Number(ch?.channel || 0))),
        0,
      );
      const count = total > 0 ? total : (f.channels || []).length || 1;
      for (let i = 0; i < count; i++) dangerous.add(start + i);
    }
    return { dangerousChannels: dangerous, dangerousArmed: false };
  };

  // ─── Apply AI actions to store ────────────────────────────────────────────
  const applyActions = (actions: AiAction[]) => {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "CREATE_PAD": {
            const p = action.payload;
            // Création canonique (alignée sur LooksBoard/SceneController) : on place le
            // Look sur le premier slot libre et on dérive qlcWidget = 80 + page*16 + slot.
            // C'est ce qui le rend VISIBLE dans LooksBoard (page/slot cohérents) et
            // jouable par PERFORM (qlcWidget = clé d'activation de triggerSmartPad).
            const { page, slot } = firstFreePadSlot(pads);
            // Accepte dmxValues OU dmxCommands renvoyés par l'IA pour que le Look
            // porte réellement des canaux (sinon carte "0 canal" non jouable).
            const dmxValues = (p.dmxValues && typeof p.dmxValues === "object") ? p.dmxValues : {};
            const dmxCommands = Array.isArray(p.dmxCommands) ? p.dmxCommands : undefined;
            addSmartPad({
              id: Date.now() + Math.floor(Math.random() * 1000),
              name: p.name || "Pad IA",
              color: p.color || "bg-purple-500",
              textColor: p.textColor || "text-purple-400",
              iconName: p.iconName || "Sparkles",
              qlcPage: 1,
              qlcWidget: 80 + page * SLOTS_PER_PAGE + slot,
              dmxValues,
              ...(dmxCommands ? { dmxCommands } : {}),
              midiNote: p.midiNote ?? -1,
              midiChannel: p.midiChannel ?? 1,
              gridCol: slot % 4,
              gridRow: Math.floor(slot / 4),
              gridW: 1,
              gridH: 1,
              page,
              slot,
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
            setSmartBlackout(active);
            socket.emit("smart:blackout", { active });
            break;
          }
          case "ADD_TIMELINE_CLIP": {
            const p = action.payload;
            const nextWidget = pads.length > 0 ? Math.max(...pads.map(x => x.qlcWidget)) + 1 : 20;
            addClip({
              id: `ai-clip-${Date.now()}`,
              track: "lights",
              name: p.name || "Clip IA",
              startTime: p.startTime ?? viewStart ?? 0,
              duration: p.duration ?? 15000,
              color: p.color || "bg-purple-500",
              textColor: p.textColor || "text-purple-300",
              qlcPage: 1,
              qlcWidget: nextWidget,
            });
            break;
          }
        }
      } catch (e) {
        console.warn(`[AI Lumière] Action ${action.type} error:`, e);
      }
    }
  };

  // ─── LLM call ─────────────────────────────────────────────────────────────
  const sendToLLM = async (userPrompt: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(),
          prompt: userPrompt,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        let serverDetail = errorText.slice(0, 180);
        try {
          const parsedError = JSON.parse(errorText) as { error?: unknown; message?: unknown; detail?: unknown };
          const detail = parsedError.error ?? parsedError.message ?? parsedError.detail;
          if (typeof detail === "string") serverDetail = detail;
        } catch {
          // Keep the plain response text when the backend did not return JSON.
        }

        const rateLimited = res.status === 429;
        const response = rateLimited
          ? "Limite IA atteinte: attends quelques secondes puis relance la demande, ou verifie le quota/cle LLM dans les reglages."
          : `Erreur IA: le serveur LLM a repondu HTTP ${res.status}.`;
        const detail = serverDetail ? `${response} (${serverDetail})` : response;

        setHistory(prev => [...prev, {
          prompt: userPrompt,
          response: detail,
          commands: [],
          actions: [],
        }]);
        socket.emit("timeline_log", {
          type: "warn",
          text: `[IA Lumiere] ${detail}`,
        });
        addToast({
          type: "warning",
          message: rateLimited ? "Limite IA atteinte" : "IA Lumiere indisponible",
          detail: rateLimited ? "Reessaie dans quelques secondes." : `HTTP ${res.status}`,
          duration: 4000,
        });
        return;
      }
      const data = await res.json();

      const content = data.choices?.[0]?.message?.content || data.content || data.text || "";
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

      let parsed: AiResponse = { description: "Action appliquée", commands: [], actions: [] };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = { description: content.slice(0, 100), commands: [], actions: [] };
      }

      const rawCommands = (parsed.commands || []).map(cmd => ({
        ...cmd,
        description: cmd.description || `Ch ${cmd.channel} = ${cmd.value}`,
      }));

      // ─── SAFETY GATE : valider les commandes DMX issues de l'IA AVANT exécution.
      // Bornes (canal 1..512, value 0..255, universe>=1) + canaux dangereux non
      // armés bloqués. L'IA ne peut pas armer la sécurité (laserArmed/pyroArmed
      // ne sont pilotés que par l'opérateur / le socket safety_status).
      const safetyCtx = buildSafetyContext();
      const dmxValidation = validateOrchestratorActions(
        rawCommands.map(cmd => ({ universe: cmd.universe, channel: cmd.channel, value: cmd.value })),
        safetyCtx,
      );

      // On ne garde que les commandes autorisées, en réassociant leur description
      // d'origine (par index : validateOrchestratorActions préserve l'ordre des applied
      // mais retire les bloquées). On filtre rawCommands selon la validation par action.
      const blockedKeys = new Set(
        dmxValidation.blocked.map(b => `${b.action.universe}:${b.action.channel}:${b.action.value}`),
      );
      const commands = rawCommands
        .filter(cmd => !blockedKeys.has(`${cmd.universe}:${cmd.channel}:${cmd.value}`))
        .map(cmd => {
          // Appliquer la valeur bornée si elle a été clampée.
          const appliedMatch = dmxValidation.applied.find(
            a => a.universe === cmd.universe && a.channel === cmd.channel,
          );
          return appliedMatch ? { ...cmd, value: appliedMatch.value } : cmd;
        });

      // Signaler chaque commande bloquée (toast + log timeline + entrée chat).
      if (dmxValidation.blocked.length > 0) {
        const summary = dmxValidation.blocked
          .map(b => `Ch${b.action.channel}: ${b.reason}`)
          .join(" · ");
        addToast({
          type: "warning",
          message: "Safety Gate — commandes DMX bloquées",
          detail: `${dmxValidation.blocked.length} bloquée(s) : ${summary}`.slice(0, 200),
          duration: 5000,
        });
        socket.emit("timeline_log", {
          type: "warn",
          text: `[IA Lumière] ${dmxValidation.blocked.length} commande(s) DMX bloquée(s) par la safety : ${summary}`,
        });
      }

      const safetyResult = await filterUnsafeAiActions(parsed.actions || [], "ai", addToast);
      const actions = safetyResult.accepted;

      // Apply DMX commands (uniquement les commandes validées)
      commands.forEach(cmd => {
        dmxEngine.setChannel(cmd.universe, cmd.channel, cmd.value);
        socket.emit("dmx_update", { universe: cmd.universe, channel: cmd.channel, value: cmd.value });
      });

      // Apply store actions
      applyActions(actions);

      setCurrentCommands(commands);
      setHistory(prev => [...prev, {
        prompt: userPrompt,
        response: parsed.description || "Action appliquée",
        commands,
        actions,
      }]);

      socket.emit("timeline_log", {
        type: "ai",
        text: `[IA Lumière] ${parsed.description || "Action appliquée"} (${commands.length} canaux · ${actions.length} actions)`,
      });

      if (actions.length > 0) {
        addToast({
          type: "success",
          message: "IA Lumière",
          detail: parsed.description || `${actions.length} action(s) appliquée(s)`,
          duration: 2500,
        });
      }

    } catch (err) {
      console.warn("[AI Lumiere] LLM unavailable:", err);
      setHistory(prev => [...prev, {
        prompt: userPrompt,
        response: "Connexion IA impossible. Verifie le backend et la configuration LLM.",
        commands: [],
        actions: [],
      }]);
      addToast({ type: "error", message: "IA Lumiere", detail: "Connexion LLM impossible" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    sendToLLM(prompt.trim());
    setPrompt("");
    setShowQuickPrompts(false);
  };

  const handleBlackoutToggle = () => {
    const next = !smartBlackout;
    setSmartBlackout(next);
    socket.emit("smart:blackout", { active: next });
    addToast({ type: next ? "warning" : "info", message: next ? "Blackout activé" : "Blackout désactivé" });
  };

  return (
    <div className="bg-[#12141a] border border-white/5 rounded-2xl w-full shrink-0 flex flex-col shadow-2xl relative overflow-hidden">

      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/3 via-transparent to-cyan-500/3 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5 relative z-10">
        <h3 className="text-white font-black text-xs tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          IA LUMIÈRE — Contrôle Total par Prompt
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleBlackoutToggle}
            className={`p-1.5 rounded-lg border transition-all ${
              smartBlackout
                ? "bg-red-500 border-red-400 text-black shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/25"
            }`}
            title="Blackout d'urgence"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick presets */}
      <div className="grid grid-cols-4 gap-1.5 px-4 pt-3 pb-2 relative z-10">
        {PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => sendToLLM(preset.prompt)}
            disabled={isLoading}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all disabled:opacity-50 group"
          >
            <span style={{ color: preset.color }} className="group-hover:scale-110 transition-transform">
              {preset.icon}
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
              {preset.name}
            </span>
          </button>
        ))}
      </div>

      {/* Chat capability badges */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-2 relative z-10">
        {[
          { icon: <Palette className="w-2.5 h-2.5" />, label: "Couleurs", color: "text-pink-400" },
          { icon: <Layers className="w-2.5 h-2.5" />, label: "Pads", color: "text-cyan-400" },
          { icon: <SlidersHorizontal className="w-2.5 h-2.5" />, label: "Groupes DMX", color: "text-green-400" },
          { icon: <Music className="w-2.5 h-2.5" />, label: "BPM/Mode", color: "text-yellow-400" },
          { icon: <Mic className="w-2.5 h-2.5" />, label: "Playlist", color: "text-purple-400" },
          { icon: <SkipForward className="w-2.5 h-2.5" />, label: "Timeline", color: "text-orange-400" },
        ].map(badge => (
          <span key={badge.label} className={`flex items-center gap-1 text-[9px] ${badge.color} bg-white/5 px-2 py-0.5 rounded-full font-bold`}>
            {badge.icon} {badge.label}
          </span>
        ))}
      </div>

      {/* History */}
      <div ref={scrollRef} className="flex-1 min-h-[120px] max-h-[240px] overflow-y-auto space-y-2 px-4 pb-2 relative z-10 custom-scrollbar">
        {history.length === 0 && (
          <div className="text-center py-8">
            <Wand2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-xs font-medium">Décris ce que tu veux en français...</p>
            <p className="text-slate-600 text-[10px] mt-1 font-mono">"Crée 6 pads colorés pour une soirée DJ"</p>
            <p className="text-slate-600 text-[10px] font-mono">"Groupe Face en rouge à 80%, Contre en bleu"</p>
            <p className="text-slate-600 text-[10px] font-mono">"Active mode IA Club sur la piste 2"</p>
            <div className="mt-4 p-3 bg-black/30 rounded-xl border border-white/5 text-[10px] text-slate-500 text-left leading-relaxed flex gap-2">
              <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>L'IA contrôle tout : DMX, pads, groupes, couleurs, modes lumineux, playlist, timeline — en une seule phrase naturelle.</span>
            </div>
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} className="bg-[#0a0c10] rounded-xl p-3 border border-white/5 space-y-2">
            <p className="text-xs text-slate-300 font-medium">→ {entry.prompt}</p>
            <p className="text-[10px] text-cyan-400 leading-relaxed">{entry.response}</p>
            {(entry.commands.length > 0 || entry.actions.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {entry.commands.slice(0, 4).map((cmd, j) => (
                  <button
                    key={`cmd-${j}`}
                    onClick={() => { dmxEngine.setChannel(cmd.universe, cmd.channel, cmd.value); socket.emit("dmx_update", cmd); }}
                    className="text-[9px] bg-slate-900 border border-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 rounded px-2 py-0.5 transition-colors font-mono"
                  >
                    Ch{cmd.channel}={cmd.value}
                  </button>
                ))}
                {entry.actions.map((act, j) => (
                  <span key={`act-${j}`} className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded px-2 py-0.5 font-bold">
                    {act.type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-purple-400 text-xs font-medium py-2 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            L'IA analyse et applique vos instructions…
          </div>
        )}
      </div>

      {/* Quick prompts dropdown */}
      {showQuickPrompts && (
        <div className="px-4 pb-2 relative z-20">
          <div className="bg-[#0a0c10] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Suggestions rapides</span>
              <button onClick={() => setShowQuickPrompts(false)} className="text-slate-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
            {QUICK_PROMPTS.map((qp, i) => (
              <button
                key={i}
                onClick={() => { setPrompt(qp); setShowQuickPrompts(false); inputRef.current?.focus(); }}
                className="w-full text-left text-[10px] text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 transition-colors border-b border-white/5 last:border-0"
              >
                {qp}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input zone */}
      <div className="px-4 pb-4 pt-2 relative z-10 border-t border-white/5">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowQuickPrompts(v => !v)}
            className="shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
            title="Suggestions rapides"
          >
            {showQuickPrompts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder='Ex: "Crée 4 pads: Intro bleu, Rock rouge, Drop violet, Calme blanc"'
            disabled={isLoading}
            className="ai-prompt-input flex-1 bg-[#0a0c10] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="shrink-0 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Envoyer</span>
          </button>
        </form>

        {/* Action bar */}
        <div className="flex justify-between items-center mt-2 text-[10px]">
          <button
            type="button"
            onClick={() => sendToLLM(`Génère des effets adaptés au BPM actuel de ${bpm.toFixed(1)} BPM pour la scène en cours`)}
            className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-lg font-bold transition-all flex items-center gap-1"
          >
            <Music className="w-3 h-3" />
            Sync {bpm.toFixed(0)} BPM
          </button>
          {currentCommands.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sendToLLM(`Sauvegarde la scène actuelle (${currentCommands.length} canaux DMX) comme un nouveau pad avec un nom approprié`)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5 rounded-lg font-bold transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Sauver Pad
              </button>
              <button
                type="button"
                onClick={() => sendToLLM(`Ajoute un clip timeline pour la scène actuelle (${currentCommands.length} canaux) à la position courante`)}
                className="px-2.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-black rounded-lg font-black transition-all flex items-center gap-1 shadow-md shadow-purple-500/10"
              >
                <Plus className="w-3 h-3" />
                → Timeline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
