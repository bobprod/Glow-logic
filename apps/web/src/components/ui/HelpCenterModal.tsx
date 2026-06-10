"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BookOpen,
  Check,
  ChevronRight,
  HelpCircle,
  MonitorPlay,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

type TutorialId =
  | "dmx"
  | "fixture"
  | "light-test"
  | "show"
  | "midi"
  | "vj"
  | "safety";

type Tutorial = {
  id: TutorialId;
  title: string;
  tag: string;
  minutes: string;
  icon: React.ReactNode;
  goal: string;
  steps: string[];
  checks: string[];
  actionLabel: string;
  action: () => void;
};

interface HelpCenterModalProps {
  onClose: () => void;
  onGoPatch: () => void;
  onGoSmart: () => void;
  onGoSettings: () => void;
  onGoVisualizer: () => void;
}

const STORAGE_KEY = "glow-logic-help-progress";

export function HelpCenterModal({
  onClose,
  onGoPatch,
  onGoSmart,
  onGoSettings,
  onGoVisualizer,
}: HelpCenterModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<TutorialId>("dmx");
  const [progress, setProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
    try {
      setProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      setProgress({});
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [mounted, progress]);

  const tutorials = useMemo<Tutorial[]>(() => [
    {
      id: "dmx",
      title: "Brancher une sortie DMX",
      tag: "Materiel",
      minutes: "5 min",
      icon: <Settings className="w-4 h-4" />,
      goal: "Obtenir une sortie USB-DMX, Art-Net ou QLC+ detectee avant de lancer le show.",
      steps: [
        "Brancher l'interface USB-DMX ou connecter le node Art-Net au reseau.",
        "Ouvrir les reglages DMX et choisir le port ou le protocole actif.",
        "Lancer le diagnostic DMX et verifier qu'au moins une sortie est active.",
      ],
      checks: ["Interface branchee", "Port ou protocole choisi", "Diagnostic DMX lance"],
      actionLabel: "Ouvrir reglages",
      action: onGoSettings,
    },
    {
      id: "fixture",
      title: "Ajouter une fixture",
      tag: "Patch",
      minutes: "7 min",
      icon: <SlidersHorizontal className="w-4 h-4" />,
      goal: "Creer un patch propre avec adresse, univers et groupe de lieu.",
      steps: [
        "Passer dans Fixtures puis choisir un profil ou un template debutant.",
        "Verifier l'univers, l'adresse de depart et le nombre de canaux.",
        "Affecter la fixture a un groupe clair comme Piste, Face, Bar ou Fond.",
      ],
      checks: ["Fixture creee", "Adresse DMX verifiee", "Groupe assigne"],
      actionLabel: "Ouvrir patch",
      action: onGoPatch,
    },
    {
      id: "light-test",
      title: "Tester une lumiere",
      tag: "Live",
      minutes: "3 min",
      icon: <Activity className="w-4 h-4" />,
      goal: "Verifier que Glow Logic envoie bien une intensite visible sur la fixture.",
      steps: [
        "Mettre le Master a une valeur visible.",
        "Monter le groupe de la fixture, par exemple Piste ou Face.",
        "Lancer un pad simple, puis couper avec Blackout si besoin.",
      ],
      checks: ["Master monte", "Groupe teste", "Blackout verifie"],
      actionLabel: "Ouvrir live",
      action: onGoSmart,
    },
    {
      id: "show",
      title: "Creer un show simple",
      tag: "Show",
      minutes: "10 min",
      icon: <Sparkles className="w-4 h-4" />,
      goal: "Preparer une session vendable: pads, groupes, snapshot et export portable.",
      steps: [
        "Generer ou creer quelques pads: intro, energie, calme, blackout visuel.",
        "Ajouter audio/video dans la playlist si le show doit suivre un media.",
        "Creer un snapshot, puis exporter un pack show portable.",
      ],
      checks: ["Pads prets", "Playlist optionnelle", "Snapshot et pack exportes"],
      actionLabel: "Ouvrir live",
      action: onGoSmart,
    },
    {
      id: "midi",
      title: "Mapper un controleur MIDI",
      tag: "Controle",
      minutes: "6 min",
      icon: <BookOpen className="w-4 h-4" />,
      goal: "Controler Glow Logic au tactile, APC, Launchpad, clavier MIDI ou autre surface.",
      steps: [
        "Brancher le controleur MIDI avant ou pendant l'ouverture de l'app.",
        "Activer MIDI Learn et cliquer sur le pad ou le fader a mapper.",
        "Appuyer sur le bouton physique, puis tester le declenchement.",
      ],
      checks: ["Controleur detecte", "Mapping cree", "Declenchement teste"],
      actionLabel: "Ouvrir reglages",
      action: onGoSettings,
    },
    {
      id: "vj",
      title: "VJ et projection video",
      tag: "Video",
      minutes: "8 min",
      icon: <MonitorPlay className="w-4 h-4" />,
      goal: "Preparer la partie video avant les futures integrations Resolume et mapping avance.",
      steps: [
        "Ajouter un fichier video dans la playlist live.",
        "Ouvrir la sortie projection et verifier le second ecran.",
        "Synchroniser lecture, pause et changement de piste avec le show.",
      ],
      checks: ["Video chargee", "Projection ouverte", "Sync lecture testee"],
      actionLabel: "Ouvrir visualiseur",
      action: onGoVisualizer,
    },
    {
      id: "safety",
      title: "Check avant public",
      tag: "Securite",
      minutes: "4 min",
      icon: <ShieldCheck className="w-4 h-4" />,
      goal: "Eviter les erreurs pendant un evenement: diagnostic, sauvegarde et verrouillage.",
      steps: [
        "Lancer le guide test end-to-end dans SmartDashboard.",
        "Verifier le diagnostic DMX et exporter le rapport support si besoin.",
        "Creer un snapshot, sauvegarder le projet et activer Show Lock.",
      ],
      checks: ["Guide E2E passe", "Snapshot cree", "Show Lock actif"],
      actionLabel: "Ouvrir live",
      action: onGoSmart,
    },
  ], [onGoPatch, onGoSettings, onGoSmart, onGoVisualizer]);

  const activeTutorial = tutorials.find((tutorial) => tutorial.id === activeId) || tutorials[0];
  const totalChecks = tutorials.reduce((sum, tutorial) => sum + tutorial.checks.length, 0);
  const doneChecks = tutorials.reduce(
    (sum, tutorial) => sum + tutorial.checks.filter((_, idx) => progress[`${tutorial.id}:${idx}`]).length,
    0,
  );
  const progressPercent = totalChecks === 0 ? 0 : Math.round((doneChecks / totalChecks) * 100);

  const toggleCheck = (tutorialId: TutorialId, index: number) => {
    const key = `${tutorialId}:${index}`;
    setProgress((current) => ({ ...current, [key]: !current[key] }));
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-5xl max-h-[88vh] bg-[#12141A] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 overflow-hidden flex">
        <aside className="w-72 border-r border-white/5 bg-black/25 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Aide
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">Tutoriels locaux hors ligne</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-black/35 border border-white/5 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Progression</span>
              <span className="text-xs text-cyan-400 font-black">{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1">
            {tutorials.map((tutorial) => {
              const isActive = tutorial.id === activeTutorial.id;
              const checked = tutorial.checks.filter((_, idx) => progress[`${tutorial.id}:${idx}`]).length;
              return (
                <button
                  key={tutorial.id}
                  onClick={() => setActiveId(tutorial.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/30 text-white"
                      : "bg-black/25 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                      <span className={isActive ? "text-cyan-400" : "text-slate-500"}>{tutorial.icon}</span>
                      {tutorial.title}
                    </span>
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] font-bold">
                    <span className="text-slate-500">{tutorial.tag} - {tutorial.minutes}</span>
                    <span className={checked === tutorial.checks.length ? "text-green-400" : "text-slate-500"}>
                      {checked}/{tutorial.checks.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-start justify-between gap-5 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest">
                  {activeTutorial.icon}
                  {activeTutorial.tag}
                </span>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{activeTutorial.minutes}</span>
              </div>
              <h3 className="text-white text-2xl font-black tracking-tight">{activeTutorial.title}</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">{activeTutorial.goal}</p>
            </div>
            <button
              onClick={() => {
                activeTutorial.action();
                onClose();
              }}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-all"
            >
              {activeTutorial.actionLabel}
            </button>
          </div>

          <section className="mb-6">
            <h4 className="text-xs text-slate-500 font-black uppercase tracking-widest mb-3">Etapes</h4>
            <div className="grid gap-3">
              {activeTutorial.steps.map((step, index) => (
                <div key={step} className="flex gap-3 bg-black/30 border border-white/5 rounded-xl p-4">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-black shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed font-semibold">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-6">
            <h4 className="text-xs text-slate-500 font-black uppercase tracking-widest mb-3">Checklist</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeTutorial.checks.map((check, index) => {
                const key = `${activeTutorial.id}:${index}`;
                const isDone = !!progress[key];
                return (
                  <button
                    key={check}
                    onClick={() => toggleCheck(activeTutorial.id, index)}
                    className={`min-h-24 rounded-xl border p-4 text-left transition-all ${
                      isDone
                        ? "bg-green-500/10 border-green-500/25"
                        : "bg-black/30 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg border mb-3 flex items-center justify-center ${
                      isDone ? "bg-green-500 border-green-400 text-black" : "border-slate-700 text-slate-600"
                    }`}>
                      {isDone && <Check className="w-4 h-4" />}
                    </div>
                    <span className="text-xs text-white font-bold leading-relaxed">{check}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-[#0a0c10] border border-white/5 rounded-xl p-4">
            <h4 className="text-xs text-slate-500 font-black uppercase tracking-widest mb-3">Depannage rapide</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-400 font-semibold leading-relaxed">
              <p><span className="text-amber-400 font-black">Pas de lumiere:</span> verifier Master, Blackout, adresse DMX, univers, puis diagnostic.</p>
              <p><span className="text-amber-400 font-black">Mauvais canal:</span> comparer le mode fixture physique avec le profil choisi.</p>
              <p><span className="text-amber-400 font-black">MIDI muet:</span> reconnecter le controleur, activer MIDI Learn, refaire un mapping.</p>
              <p><span className="text-amber-400 font-black">Show instable:</span> sauvegarder, creer un snapshot, exporter le rapport support.</p>
            </div>
          </section>
        </main>
      </div>
    </div>,
    document.body,
  );
}
