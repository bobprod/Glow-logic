"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Send,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Sparkles,
  Bot,
  User,
  Volume2,
  VolumeX,
  HelpCircle,
  Zap,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { usePathname } from "next/navigation";
import useStore from "../store/useStore";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  isTyping: boolean;
  messages: Message[];
}

// ─── Page Context Map ───────────────────────────────────────────────────────
const PAGE_CONTEXT: Record<string, { title: string; description: string; tips: string[] }> = {
  "/": {
    title: "Dashboard Principal",
    description: "Vue d'ensemble de votre éclairage",
    tips: ["Utilisez les sliders pour régler l'intensité", "Cliquez sur les pads pour activer des scènes"],
  },
  "/smart": {
    title: "Smart Mode",
    description: "Mode simplifié avec sliders par zone",
    tips: ["Réglez les zones Master, Stage, Bar, Dancefloor", "Activez le blackout en cas d'urgence"],
  },
  "/patch": {
    title: "Patch DMX",
    description: "Gestion des fixtures et adresses DMX",
    tips: [
      "Commencez par ajouter une fixture depuis la bibliothèque",
      "Assignez chaque fixture à un groupe (A-F)",
      "Vérifiez qu'il n'y a pas de conflit d'adresses",
      "L'IA peut scanner un manuel pour créer le patch automatiquement",
    ],
  },
  "/fixtures": {
    title: "Scanner Fixture",
    description: "Scan OCR + IA de manuels DMX",
    tips: [
      "Prenez une photo nette du tableau DMX dans le manuel",
      "L'IA analyse le texte et améliore la détection",
      "Validez les résultats avant de sauvegarder",
    ],
  },
  "/ai-lighting": {
    title: "IA Lumière",
    description: "Analyse audio et contrôle d'éclairage",
    tips: ["Activez le micro pour l'analyse audio", "Ajustez la nervosité pour les transitions"],
  },
  "/agents": {
    title: "Agents ACP",
    description: "Agents IA pour l'orchestration",
    tips: ["Démarrez les agents pour l'analyse", "Utilisez l'orchestration pour coordonner"],
  },
  "/settings": {
    title: "Paramètres",
    description: "Configuration de l'application",
    tips: ["Configurez vos clés API LLM", "Testez la connexion avec le bouton dédié"],
  },
};

// ─── Patch Guide for Beginners ──────────────────────────────────────────────
const PATCH_GUIDE = `🎭 **GUIDE DU PATCH DMX pour débutants**

Le patch DMX c'est comme assigner une adresse à chaque luminaire pour que le système sache où envoyer les commandes.

**Étapes pour créer un patch :**

1️⃣ **Ajoutez vos fixtures**
   - Allez sur /fixtures ou /patch
   - Cliquez "Ajouter une fixture"
   - Choisissez le type (PAR LED, Moving Head, etc.)

2️⃣ **Assignez les adresses DMX**
   - Chaque fixture a une adresse unique (1-512)
   - Commencez par 1, puis incrémentez
   - Ex: PAR LED 1 = adresse 1-4, PAR LED 2 = adresse 5-8

3️⃣ **Organisez par groupes**
   - Groupe A = Face (face à la scène)
   - Groupe B = Latéraux (côtés)
   - Groupe C = Contres (derrière)
   - Groupe D = Douches (spots mobiles)

4️⃣ **Testez chaque fixture**
   - Utilisez le DMX Tester pour vérifier
   - Vérifiez que chaque lumière répond

5️⃣ **Connectez vos protocoles**
   - QLC+ pour le contrôle via OSC
   - Art-Net pour le contrôle réseau
   - USB DMX pour les interfaces physiques

**Besoin d'aide ?** Demandez-moi "scan fixture" pour créer un patch à partir d'un manuel !`;

// ─── System Prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'assistant IA de Glow Logic, un système de contrôle d'éclairage DMX pour spectacles live. Tu es patient, pédagogue et tu expliques les choses simplement.

TU PEUX AIDER AVEC :
- Le contrôle des luminaires (groupes A-F, intensité, couleurs)
- La gestion du patch DMX (ajout, modification, suppression de fixtures)
- La création et le chargement de scènes
- Le mode IA Lumière (analyse audio → couleurs)
- Les diagnostics et dépannage
- Les paramètres de l'application
- Le scan OCR de manuels DMX
- L'orchestration des agents IA

TU AS ACCÈS À L'ÉTAT ACTUEL :
- Mode actuel (Smart/Creator/Live)
- Patch DMX chargé (fixtures, adresses, groupes)
- Valeurs des zones
- Statut IA
- BPM actuel

POUR LES DÉBUTANTS :
- Explique toujours les termes techniques
- Donnes des exemples concrets
- Proposes des actions pratiques
- Sois encourageant et rassurant

POUR LE PATCH DMX :
- Guide pas à pas
- Explique le système d'adresses (1-512)
- Aide à organiser les fixtures par groupes
- Détecte et signale les conflits d'adresses
- Propose des corrections automatiques

RÉPONDS TOUJOURS EN FRANÇAIS. Sois concis mais complet. Si l'utilisateur demande une action, confirme-la et explique ce qui a été fait.`;

// ─── Helper: Generate unique ID ─────────────────────────────────────────────
const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ─── Chat Assistant Component ────────────────────────────────────────────────
export default function ChatAssistant() {
  const [chatState, setChatState] = useState<ChatState>({
    isOpen: false,
    isMinimized: false,
    isTyping: false,
    messages: [],
  });
  const [inputValue, setInputValue] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Get application state from store
  const {
    appMode,
    patch,
    smartZoneValues,
    smartBlackout,
    bpm,
    aiEnabled,
    aiDetectedBpm,
  } = useStore();

  // Current page context
  const currentPage = PAGE_CONTEXT[pathname] || {
    title: "Glow Logic",
    description: "Système de contrôle d'éclairage",
    tips: [],
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatState.messages]);

  // Focus input when opened
  useEffect(() => {
    if (chatState.isOpen && !chatState.isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [chatState.isOpen, chatState.isMinimized]);

  // Build context from application state
  const buildContext = useCallback(() => {
    const patchInfo =
      patch.length > 0
        ? `Patch DMX: ${patch.length} fixtures:\n${patch
            .map(
              (f) =>
                `  - ${f.name} (Groupe ${f.grp}, Univers ${f.universe}, Adresse ${f.start_address}, ${f.channel_count}ch)`
            )
            .join("\n")}`
        : "Patch DMX: AUCUNE FIXTURE (vide)";

    const zoneInfo = Object.entries(smartZoneValues)
      .map(([zone, value]) => `${zone}: ${value}%`)
      .join(", ");

    const groupsSummary = ["A", "B", "C", "D", "E", "F"]
      .map((g) => {
        const count = patch.filter((f) => f.grp === g).length;
        return `Groupe ${g}: ${count} fixture(s)`;
      })
      .join(", ");

    return `
=== CONTEXTE APPLICATION ===
Page actuelle: ${currentPage.title} (${pathname})
${currentPage.description}

État:
- Mode: ${appMode.toUpperCase()}
- ${patchInfo}
- Groupes: ${groupsSummary}
- Zones: ${zoneInfo}
- Blackout: ${smartBlackout ? "ACTIVÉ" : "désactivé"}
- BPM: ${bpm}
- IA Lumière: ${aiEnabled ? "activée" : "désactivée"}${aiEnabled ? ` (${aiDetectedBpm} BPM détectés)` : ""}
=== FIN CONTEXTE ===`.trim();
  }, [appMode, patch, smartZoneValues, smartBlackout, bpm, aiEnabled, aiDetectedBpm, currentPage, pathname]);

  // Send message to LLM
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isTyping: true,
      }));
      setInputValue("");

      try {
        const context = buildContext();
        const response = await fetch("http://localhost:3005/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: SYSTEM_PROMPT + "\n\n" + context },
              ...chatState.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              { role: "user", content },
            ],
          }),
        });

        if (!response.ok) throw new Error("Erreur de connexion");

        const data = await response.json();
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content:
            data.response ||
            "Désolé, je n'ai pas pu traiter votre demande.",
          timestamp: new Date(),
        };

        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isTyping: false,
        }));
      } catch (error) {
        const errorMessage: Message = {
          id: generateId(),
          role: "assistant",
          content:
            "⚠️ Erreur de connexion. Vérifie que le serveur tourne sur localhost:3005.",
          timestamp: new Date(),
        };
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isTyping: false,
        }));
      }
    },
    [chatState.messages, buildContext]
  );

  // Handle quick actions
  const handleQuickAction = useCallback(
    (action: string) => {
      const quickActions: Record<string, string> = {
        // Global actions
        blackout: "Active le blackout",
        status: "Montre-moi l'état actuel complet de l'application",
        scenes: "Liste les scènes disponibles",
        help: "Aide-moi avec les commandes disponibles",
        groups: "Explique-moi le système de groupes (A-F) et comment les utiliser",
        ai: "Comment fonctionne l'IA Lumière ?",
        bpm: "Quel est le BPM actuel et comment le synchroniser?",

        // Patch actions
        patch_guide:
          "Je suis débutant, explique-moi étape par étape comment faire un patch DMX",
        patch_scan:
          "Comment scanner un manuel DMX avec l'IA pour créer un patch automatiquement?",
        patch_add:
          "Comment ajouter une fixture à mon patch? Guide-moi étape par étape.",
        patch_groups:
          "Comment organiser mes fixtures par groupes (A-F)?",
        patch_conflicts:
          "Vérifie s'il y a des conflits d'adresses dans mon patch",
        patch_auto:
          "Propose-moi un patch automatique pour mes fixtures",

        // Page-specific
        fixtures_help:
          "Comment utiliser le scanner de fixtures avec l'IA?",
        settings_help:
          "Comment configurer ma clé API pour utiliser l'IA?",
        agents_help:
          "Comment fonctionnent les agents ACP?",
      };

      const message = quickActions[action] || action;
      sendMessage(message);
    },
    [sendMessage]
  );

  // Toggle chat
  const toggleChat = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
    }));
  }, []);

  // Minimize chat
  const toggleMinimize = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isMinimized: !prev.isMinimized,
    }));
  }, []);

  // Clear chat
  const clearChat = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      messages: [],
    }));
  }, []);

  // Get context-aware quick actions
  const getContextualActions = useCallback(() => {
    const baseActions = [
      { icon: "🔇", label: "Blackout", action: "blackout", color: "text-red-400" },
      { icon: "📊", label: "Statut", action: "status", color: "text-blue-400" },
      { icon: "❓", label: "Aide", action: "help", color: "text-yellow-400" },
    ];

    const patchActions = [
      { icon: "📖", label: "Guide Patch", action: "patch_guide", color: "text-emerald-400" },
      { icon: "📷", label: "Scanner IA", action: "patch_scan", color: "text-cyan-400" },
      { icon: "➕", label: "Ajouter fixture", action: "patch_add", color: "text-purple-400" },
      { icon: "👥", label: "Groupes", action: "patch_groups", color: "text-orange-400" },
      { icon: "🔍", label: "Vérifier conflits", action: "patch_conflicts", color: "text-pink-400" },
      { icon: "🤖", label: "Auto-patch", action: "patch_auto", color: "text-indigo-400" },
    ];

    switch (pathname) {
      case "/patch":
      case "/fixtures":
        return [...patchActions, ...baseActions];
      case "/ai-lighting":
        return [
          { icon: "🎤", label: "IA Lumière", action: "ai", color: "text-cyan-400" },
          { icon: "🎵", label: "BPM", action: "bpm", color: "text-purple-400" },
          ...baseActions,
        ];
      case "/agents":
        return [
          { icon: "🤖", label: "Agents ACP", action: "agents_help", color: "text-cyan-400" },
          ...baseActions,
        ];
      case "/settings":
        return [
          { icon: "🔑", label: "Config API", action: "settings_help", color: "text-cyan-400" },
          ...baseActions,
        ];
      default:
        return [
          { icon: "📖", label: "Guide Patch", action: "patch_guide", color: "text-emerald-400" },
          { icon: "🎭", label: "Scènes", action: "scenes", color: "text-purple-400" },
          { icon: "✨", label: "IA Lumière", action: "ai", color: "text-cyan-400" },
          ...baseActions,
        ];
    }
  }, [pathname]);

  return (
    <>
      {/* Floating Bubble */}
      <motion.button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          chatState.isOpen
            ? "bg-slate-700 hover:bg-slate-600"
            : "bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400"
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {chatState.isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Wand2 className="w-6 h-6 text-white" />
        )}

        {/* Notification dot */}
        {!chatState.isOpen && chatState.messages.length === 0 && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1 }}
          >
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </motion.div>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatState.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: chatState.isMinimized ? 60 : 550,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[420px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                  <Wand2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    Assistant Glow
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
                      {currentPage.title}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {chatState.isTyping
                      ? "En train d'écrire..."
                      : "En ligne • Posez une question"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                  title="Guide débutant"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={toggleMinimize}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  {chatState.isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            {!chatState.isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Welcome message */}
                  {chatState.messages.length === 0 && (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                        <Wand2 className="w-8 h-8 text-cyan-400" />
                      </div>
                      <h4 className="text-white font-bold mb-2">
                        Bienvenue !{" "}
                        <span className="text-slate-400 font-normal text-sm">
                          Je suis votre assistant IA
                        </span>
                      </h4>
                      <p className="text-slate-400 text-xs mb-4">
                        {pathname === "/patch" || pathname === "/fixtures"
                          ? "Je vois que vous êtes sur la page Patch. Besoin d'aide pour configurer vos fixtures ?"
                          : "Posez-moi une question ou utilisez les actions rapides ci-dessous."}
                      </p>

                      {/* Quick actions */}
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {getContextualActions().map((item) => (
                          <button
                            key={item.action}
                            onClick={() => handleQuickAction(item.action)}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs transition text-left group"
                          >
                            <span className="text-base">{item.icon}</span>
                            <span className="flex-1">{item.label}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        ))}
                      </div>

                      {/* Patch guide button */}
                      {(pathname === "/patch" || pathname === "/fixtures") && (
                        <button
                          onClick={() => handleQuickAction("patch_guide")}
                          className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-cyan-400 text-sm font-bold transition border border-cyan-500/20"
                        >
                          <Lightbulb className="w-4 h-4" />
                          Guide du Patch DMX pour débutants
                        </button>
                      )}
                    </div>
                  )}

                  {/* Messages list */}
                  {chatState.messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          message.role === "user"
                            ? "bg-cyan-500/20 text-white"
                            : "bg-white/5 text-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {message.role === "assistant" && (
                            <Bot className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                          )}
                          <div className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </div>
                          {message.role === "user" && (
                            <User className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {message.timestamp.toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {chatState.isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        <span className="text-slate-400 text-sm">
                          L'assistant réfléchit...
                        </span>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Contextual tips */}
                {currentPage.tips.length > 0 &&
                  chatState.messages.length === 0 && (
                    <div className="px-4 py-2 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                          Astuces pour cette page
                        </span>
                      </div>
                      <div className="space-y-1">
                        {currentPage.tips.slice(0, 2).map((tip, i) => (
                          <p key={i} className="text-[11px] text-slate-500">
                            • {tip}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Input */}
                <div className="p-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(inputValue);
                        }
                      }}
                      placeholder="Demandez-moi n'importe quoi..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition"
                      disabled={chatState.isTyping}
                    />
                    <button
                      onClick={() => sendMessage(inputValue)}
                      disabled={!inputValue.trim() || chatState.isTyping}
                      className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Patch Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-black text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  Guide du Patch DMX
                </h2>
                <button
                  onClick={() => setShowGuide(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                {PATCH_GUIDE}
              </pre>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowGuide(false);
                    handleQuickAction("patch_guide");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-sm font-bold transition"
                >
                  <Bot className="w-4 h-4" />
                  Demander à l'IA
                </button>
                <button
                  onClick={() => setShowGuide(false)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 text-sm font-bold transition"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
