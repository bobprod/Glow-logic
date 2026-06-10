"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Film, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import useStore from "../store/useStore";
import {
  generateMediaJob,
  getMediaGenerationStatus,
  type MediaJob,
  type MediaProvider,
} from "../services/mediaGeneration";

function providerLabel(provider?: MediaProvider) {
  if (!provider) return "Offline";
  if (provider.id === "offline") return "Offline";
  return provider.configured ? `${provider.label} pret` : `${provider.label} sans cle`;
}

export default function MediaGeneratorPanel() {
  const addToast = useStore((state) => state.addToast);
  const [providers, setProviders] = useState<MediaProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("offline");
  const [kind, setKind] = useState<MediaJob["kind"]>("vj_loop");
  const [prompt, setPrompt] = useState("boucle neon club, basses lourdes, faisceaux cyan et magenta");
  const [durationSec, setDurationSec] = useState(8);
  const [isBusy, setIsBusy] = useState(false);
  const [job, setJob] = useState<MediaJob | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider),
    [providers, selectedProvider],
  );

  const loadProviders = useCallback(async () => {
    try {
      const data = await getMediaGenerationStatus();
      const nextProviders = Array.isArray(data.providers) ? data.providers : [];
      setProviders(nextProviders);
      if (nextProviders.length > 0 && !nextProviders.some((provider) => provider.id === selectedProvider)) {
        setSelectedProvider(nextProviders[0].id);
      }
      if (!job && Array.isArray(data.jobs) && data.jobs.length > 0) {
        setJob(data.jobs[0]);
      }
    } catch {
      setProviders([]);
    }
  }, [job, selectedProvider]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const generate = useCallback(async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      addToast({ type: "warning", message: "Prompt media requis" });
      return;
    }

    setIsBusy(true);
    try {
      const data = await generateMediaJob({
        provider: selectedProvider,
        kind,
        prompt: cleanPrompt,
        durationSec,
        aspectRatio: "16:9",
        source: "manual",
      });
      setJob(data.job);
      if (Array.isArray(data.providers)) setProviders(data.providers);
      addToast({
        type: data.job.mode === "cloud_ready" ? "success" : "info",
        message: data.job.mode === "cloud_ready" ? "Job media pret" : "Storyboard offline cree",
        detail: providerLabel(activeProvider),
      });
    } catch (error) {
      addToast({
        type: "error",
        message: "Generation media echouee",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsBusy(false);
    }
  }, [activeProvider, addToast, durationSec, kind, prompt, selectedProvider]);

  return (
    <div className="border-t border-white/5 pt-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            IA Media
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            Storyboard local pour boucles VJ, avec cloud optionnel quand une cle est configuree.
          </p>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${
          activeProvider?.configured
            ? "text-green-300 border-green-500/30 bg-green-500/10"
            : "text-amber-300 border-amber-500/30 bg-amber-500/10"
        }`}>
          {providerLabel(activeProvider)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[130px_130px_1fr] gap-2">
        <select
          value={selectedProvider}
          onChange={(event) => setSelectedProvider(event.target.value)}
          className="bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-500/40"
        >
          {providers.length === 0 ? (
            <option value="offline">Offline</option>
          ) : (
            providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))
          )}
        </select>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as MediaJob["kind"])}
          className="bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-500/40"
        >
          <option value="vj_loop">VJ loop</option>
          <option value="video">Video</option>
          <option value="image">Image</option>
        </select>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="bg-[#0a0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-amber-500/40"
          placeholder="Decris le rendu voulu..."
        />
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-2">
        <label className="flex items-center gap-3 rounded-xl bg-[#0a0c10] border border-white/10 px-3 py-2">
          <Film className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="range"
            min={1}
            max={30}
            value={durationSec}
            onChange={(event) => setDurationSec(Number(event.target.value))}
            className="w-full accent-amber-400"
          />
          <span className="text-xs text-white font-mono w-10 text-right">{durationSec}s</span>
        </label>
        <button
          onClick={generate}
          disabled={isBusy}
          className="min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          Generer
        </button>
      </div>

      {job && (
        <div className="rounded-xl bg-[#0a0c10] border border-white/5 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
              {job.status === "queued" ? "Job cloud" : "Plan offline"} / {job.durationSec}s / {job.aspectRatio}
            </p>
            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{job.id}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {job.storyboard.slice(0, 3).map((step) => (
              <div key={`${job.id}-${step.timeSec}`} className="min-h-[84px] rounded-lg bg-black/30 border border-white/5 p-2">
                <p className="text-[10px] text-amber-300 font-black mb-1">{step.timeSec}s</p>
                <p className="text-[11px] text-slate-300 font-semibold leading-relaxed line-clamp-2">{step.visual}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-1 line-clamp-1">{step.lightingHint}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-2">{job.nextStep}</p>
        </div>
      )}
    </div>
  );
}
