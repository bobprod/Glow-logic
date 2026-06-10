"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import useStore from "../../store/useStore";

const TOUR_EVENT = "glowlogic:start-tour";

type TourStep = {
  selector: string;
  title: string;
  body: string;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function GuidedTour() {
  const {
    setAppMode,
    setProView,
    setIsTimelineVisible,
    setIsSidebarVisible,
    updateSmartWidget,
    addToast,
  } = useStore();

  const steps = useMemo<TourStep[]>(() => [
    {
      selector: ".scene-pads-grid",
      title: "Pads tactiles",
      body: "Lance les looks du show au doigt, a la souris ou depuis un controleur MIDI. Pour debuter vite, commence par les templates puis ajuste.",
    },
    {
      selector: ".dmx-groups-mixer",
      title: "Groupes DMX",
      body: "Regle les familles de projecteurs comme une petite console: intensite, couleur et mute sans toucher aux adresses DMX.",
    },
    {
      selector: ".virtual-apc-mini",
      title: "Surface MIDI",
      body: "Visualise les notes d'un controleur type APC/Launchpad et verifie quels pads sont deja associes.",
    },
    {
      selector: ".macro-timeline-container",
      title: "Arrangement",
      body: "Programme le show dans le temps: lecture, clips, markers et conversion des pads session vers une timeline.",
    },
    {
      selector: ".timeline-arrangement-generate-button",
      title: "Pads vers timeline",
      body: "Transforme les pads de session en arrangement de depart, puis cale les clips, markers et transitions au tempo du show.",
    },
    {
      selector: ".timeline-auto-track-button",
      title: "Automations DMX",
      body: "Ajoute une piste d'automation pour piloter un canal precis depuis la timeline: dimmer, pan, tilt, couleur ou strobe.",
    },
    {
      selector: ".timeline-tab-automations",
      title: "Edition automation",
      body: "L'onglet Auto centralise les pistes, les keyframes, l'univers DMX et le canal cible. Une keyframe peut etre posee au temps courant ou en double-clic dans la lane AUTO.",
    },
    {
      selector: ".fixture-profile-import-entry",
      title: "Import profils fixtures",
      body: "Dans le patch, cree ou importe un profil depuis un manuel, un fichier QLC+ .qxf, un GDTF .gdtf ou un XML pour remplir proprement le footprint.",
    },
    {
      selector: ".ai-prompt-input",
      title: "Assistant IA",
      body: "Avec ta cle BYOK dans Settings, l'IA peut proposer des looks, reparer un mapping ou expliquer un diagnostic sans remplacer les verrous de securite.",
    },
  ], []);

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const step = steps[index];

  const close = useCallback(() => {
    setActive(false);
    setTargetRect(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("glowlogic-guided-tour-done", "true");
    }
  }, []);

  const start = useCallback(() => {
    setAppMode("smart");
    setProView("canvas");
    setIsTimelineVisible(true);
    setIsSidebarVisible(true);
    updateSmartWidget("apcVirtual", { visible: true, collapsed: false });
    setIndex(0);
    setActive(true);
    addToast({
      type: "info",
      message: "Guide interactif",
      detail: "Tour rapide des zones importantes du live.",
    });
  }, [addToast, setAppMode, setIsSidebarVisible, setIsTimelineVisible, setProView, updateSmartWidget]);

  const measureTarget = useCallback(() => {
    if (!active || !step) return;

    if (step.selector.includes("timeline")) {
      setAppMode("smart");
      setProView("canvas");
      setIsTimelineVisible(true);
    }

    if (step.selector.startsWith(".fixture-profile")) {
      setAppMode("creator");
      setProView("canvas");
      setIsTimelineVisible(false);
    }

    if (step.selector === ".ai-prompt-input") {
      setAppMode("smart");
      setProView("canvas");
      window.dispatchEvent(new CustomEvent("glowlogic:show-ai-panel"));
    }

    const element = document.querySelector(step.selector) as HTMLElement | null;
    if (!element) {
      setTargetRect(null);
      return;
    }

    element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    window.setTimeout(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setTargetRect(null);
        return;
      }
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }, 180);
  }, [active, setAppMode, setIsTimelineVisible, setProView, step]);

  useEffect(() => {
    const handler = () => start();
    window.addEventListener(TOUR_EVENT, handler);
    return () => window.removeEventListener(TOUR_EVENT, handler);
  }, [start]);

  useEffect(() => {
    measureTarget();
    if (!active) return;

    const onResize = () => measureTarget();
    const onScroll = () => measureTarget();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((current) => Math.min(steps.length - 1, current + 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, close, measureTarget, steps.length]);

  useEffect(() => {
    measureTarget();
  }, [index, measureTarget]);

  if (!active || !step) return null;

  const margin = 10;
  const highlight = targetRect
    ? {
      top: targetRect.top - margin,
      left: targetRect.left - margin,
      width: targetRect.width + margin * 2,
      height: targetRect.height + margin * 2,
    }
    : null;

  const tooltipWidth = 360;
  const tooltipLeft = highlight
    ? clamp(highlight.left, 16, window.innerWidth - tooltipWidth - 16)
    : Math.max(16, Math.round((window.innerWidth - tooltipWidth) / 2));
  const tooltipTop = highlight
    ? (highlight.top + highlight.height + 16 < window.innerHeight - 190
      ? highlight.top + highlight.height + 16
      : Math.max(16, highlight.top - 190))
    : Math.max(90, Math.round(window.innerHeight / 2 - 110));

  return (
    <div className="fixed inset-0 z-[240] pointer-events-none">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px]" />

      {highlight && (
        <div
          className="absolute rounded-2xl border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_36px_rgba(34,211,238,0.35)] transition-all duration-200"
          style={highlight}
        />
      )}

      <div
        className="absolute pointer-events-auto w-[360px] max-w-[calc(100vw-32px)] rounded-2xl border border-cyan-500/25 bg-[#10141c] p-4 shadow-2xl"
        style={{ left: tooltipLeft, top: tooltipTop }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
              Guide {index + 1}/{steps.length}
            </p>
            <h3 className="mt-1 text-base font-black text-white">{step.title}</h3>
          </div>
          <button
            onClick={close}
            className="rounded-lg border border-white/10 bg-black/30 p-1.5 text-slate-400 hover:text-white"
            title="Fermer le guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">{step.body}</p>

        {!targetRect && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
            Cette zone n'est pas visible dans la vue actuelle. Ouvre le module correspondant puis continue le tour.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={index === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-black text-slate-300 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          <button
            onClick={() => {
              if (index === steps.length - 1) close();
              else setIndex((current) => Math.min(steps.length - 1, current + 1));
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-3 text-xs font-black text-cyan-100 hover:bg-cyan-500/25"
          >
            {index === steps.length - 1 ? "Terminer" : "Suivant"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
