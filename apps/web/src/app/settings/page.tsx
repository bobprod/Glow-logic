"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import useStore from "../../store/useStore";
import {
  ArrowLeft, Radio, Music, Sparkles, Monitor, HardDrive,
  Info, Save, CheckCircle2, AlertCircle, Eye, EyeOff,
  ExternalLink, Loader2, RefreshCw, Wifi, WifiOff,
  Layers, Mic, Zap, Activity,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type ProviderId = "openai" | "anthropic" | "gemini" | "deepseek" | "qwen" | "nvidia" | "huggingface" | "openrouter" | "nvidia_nim" | "opencode_go";
type LlmKeys = Record<string, { key: string; model: string }>;

interface ProtocolCfg { qlcHost: string; qlcPort: number; oscPort: number; artnetHost: string; artnetPort: number; artnetUniverse: number; }
interface MidiCfg { inputId: string; outputId: string; channel: number; clockOut: boolean; controllerId: string; }
interface UiCfg { defaultProvider: ProviderId; compactMode: boolean; showTooltips: boolean; }
interface BackupCfg { autosave: boolean; autosaveInterval: number; }
interface GroupCfg { label: string; color: string; zoneId: number; active: boolean; }

type Section = "protocol" | "midi" | "llm" | "groups" | "interface" | "backup" | "about";

// ─── Constants ───────────────────────────────────────────────────────────────
const LLM_PROVIDERS = [
  { id: "openai",      name: "OpenAI",             color: "#10b981", ph: "sk-...",      docs: "https://platform.openai.com/api-keys",            models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini"], def: "gpt-4o-mini" },
  { id: "anthropic",   name: "Claude (Anthropic)",  color: "#f97316", ph: "sk-ant-...", docs: "https://console.anthropic.com/settings/keys",      models: ["claude-opus-4-20250514", "claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"], def: "claude-sonnet-4-20250514" },
  { id: "gemini",      name: "Google Gemini",       color: "#3b82f6", ph: "AIza...",   docs: "https://aistudio.google.com/app/apikey",           models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"], def: "gemini-1.5-flash" },
  { id: "deepseek",    name: "DeepSeek",            color: "#6366f1", ph: "sk-...",     docs: "https://platform.deepseek.com/api_keys",           models: ["deepseek-chat", "deepseek-reasoner"], def: "deepseek-chat" },
  { id: "openrouter",  name: "OpenRouter",          color: "#ec4899", ph: "sk-or-...", docs: "https://openrouter.ai/keys",                       models: ["openai/gpt-4o", "anthropic/claude-opus-4", "google/gemini-2.5-pro", "qwen/qwen3-coder-480b-a35b-instruct"], def: "openai/gpt-4o", note: "300+ modèles" },
  { id: "nvidia_nim",  name: "NVIDIA NIM",          color: "#76b900", ph: "nvapi-...", docs: "https://build.nvidia.com",                          models: ["nvidia/llama-3.3-nemotron-super-49b-v1", "qwen/qwen3-coder-480b-a35b-instruct", "deepseek-ai/deepseek-v4-pro", "meta/llama-3.1-405b-instruct"], def: "nvidia/llama-3.3-nemotron-super-49b-v1", note: "Free tier available" },
  { id: "opencode_go", name: "OpenCode Go",         color: "#06b6d4", ph: "sk-opencode-...", docs: "https://opencode.ai/zen",                    models: ["kimi-k2.6", "kimi-k2.5", "glm-5.1", "glm-5", "deepseek-v4-pro", "deepseek-v4-flash", "mimo-v2.5", "mimo-v2.5-pro", "minimax-m2.7", "minimax-m2.5", "qwen3.7-max", "qwen3.6-plus", "qwen3.5-plus"], def: "kimi-k2.6", note: "5$/mois - Modèles open source" },
] as const;

const CONTROLLER_PROFILES = [
  { id: "akai-apc-mini-mk2", name: "APC Mini MK2", brand: "Akai",     pads: 64, faders: 9, leds: true  },
  { id: "akai-apc-40",       name: "APC 40 MkII",  brand: "Akai",     pads: 40, faders: 9, leds: true  },
  { id: "novation-lp-mini",  name: "Launchpad Mini",brand: "Novation", pads: 64, faders: 0, leds: true  },
  { id: "korg-nanokontrol2", name: "nanoKONTROL2",  brand: "Korg",     pads: 0,  faders: 8, leds: false },
  { id: "arturia-minilab",   name: "MiniLab Mk3",   brand: "Arturia",  pads: 16, faders: 0, leds: true  },
  { id: "generic",           name: "Générique",     brand: "Autre",    pads: 16, faders: 8, leds: false },
];

const DEFAULT_GROUPS: Record<string, GroupCfg> = {
  A: { label: "Face",      color: "#22d3ee", zoneId: 1, active: true  },
  B: { label: "Latéraux",  color: "#a78bfa", zoneId: 2, active: true  },
  C: { label: "Contres",   color: "#f472b6", zoneId: 3, active: true  },
  D: { label: "Douche 1",  color: "#34d399", zoneId: 4, active: true  },
  E: { label: "Douche 2",  color: "#fb923c", zoneId: 0, active: false },
  F: { label: "Douche 3",  color: "#fbbf24", zoneId: 0, active: false },
};

const APP_VERSION = "3.0.0";
const API = "http://localhost:3005";

// ─── Small helpers ───────────────────────────────────────────────────────────
function load<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try { return { ...def, ...JSON.parse(localStorage.getItem(key) ?? "{}") } as T; }
  catch { return def; }
}

function cls(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full rounded-lg border border-white/8 bg-[#0d0f14] px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none transition-colors" />
  );
}

function Select({ ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full rounded-lg border border-white/8 bg-[#0d0f14] px-3 py-2.5 text-sm text-white focus:border-cyan-500/40 focus:outline-none transition-colors" />
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3 cursor-pointer hover:border-white/10 transition-colors">
      <div>
        <span className="text-sm text-white block">{label}</span>
        {sub && <span className="text-xs text-slate-500">{sub}</span>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={cls(
          "relative w-10 h-5 rounded-full transition-colors shrink-0",
          checked ? "bg-cyan-500" : "bg-white/10"
        )}
      >
        <div className={cls(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )} />
      </div>
    </label>
  );
}

function StatusDot({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={cls(
        "w-2 h-2 rounded-full shrink-0",
        ok === null ? "bg-slate-600 animate-pulse" : ok ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-400"
      )} />
      <span className={ok ? "text-emerald-400" : ok === null ? "text-slate-500" : "text-red-400"}>{label}</span>
    </div>
  );
}

function KeyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/8 bg-[#0d0f14] px-3 py-2.5 pr-10 text-sm text-white font-mono placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none transition-colors"
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Section: Protocol ───────────────────────────────────────────────────────
function ProtocolSection({ cfg, setCfg, status }: {
  cfg: ProtocolCfg;
  setCfg: React.Dispatch<React.SetStateAction<ProtocolCfg>>;
  status: { backend: boolean | null; qlc: boolean | null; artnet: boolean | null };
}) {
  return (
    <div className="space-y-8">
      {/* Live status */}
      <div className="rounded-xl border border-white/6 bg-white/[0.02] p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Statut en direct</p>
        <div className="grid grid-cols-3 gap-4">
          <StatusDot ok={status.backend} label={`Backend :3005`} />
          <StatusDot ok={status.qlc}     label={`QLC+ OSC :${cfg.oscPort}`} />
          <StatusDot ok={status.artnet}  label={`ArtNet :${cfg.artnetPort}`} />
        </div>
      </div>

      {/* QLC+ / OSC */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400/70">QLC+ / OSC</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="QLC+ Host IP">
            <Input value={cfg.qlcHost} onChange={e => setCfg(c => ({ ...c, qlcHost: e.target.value }))} placeholder="127.0.0.1" />
          </Field>
          <Field label="OSC Port (IN)">
            <Input type="number" value={cfg.oscPort} onChange={e => setCfg(c => ({ ...c, oscPort: +e.target.value }))} />
          </Field>
        </div>
        <Field label="Web API Port (QLC+)" hint="Port de l'API web interne de QLC+">
          <Input type="number" value={cfg.qlcPort} onChange={e => setCfg(c => ({ ...c, qlcPort: +e.target.value }))} />
        </Field>
      </div>

      {/* Art-Net */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400/70">Art-Net</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="IP de destination">
            <Input value={cfg.artnetHost} onChange={e => setCfg(c => ({ ...c, artnetHost: e.target.value }))} placeholder="255.255.255.255" />
          </Field>
          <Field label="Port UDP">
            <Input type="number" value={cfg.artnetPort} onChange={e => setCfg(c => ({ ...c, artnetPort: +e.target.value }))} />
          </Field>
        </div>
        <Field label="Univers par défaut (0–15)">
          <Input type="number" min={0} max={15} value={cfg.artnetUniverse} onChange={e => setCfg(c => ({ ...c, artnetUniverse: +e.target.value }))} />
        </Field>
      </div>
    </div>
  );
}

// ─── Section: MIDI ───────────────────────────────────────────────────────────
function MidiSection({ cfg, setCfg }: { cfg: MidiCfg; setCfg: React.Dispatch<React.SetStateAction<MidiCfg>> }) {
  const [ins, setIns] = useState<{ id: string; name: string }[]>([]);
  const [outs, setOuts] = useState<{ id: string; name: string }[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);

  const scan = useCallback(() => {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) { setReady(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).requestMIDIAccess({ sysex: false }).then((acc: any) => {
      const i: { id: string; name: string }[] = [];
      const o: { id: string; name: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      acc.inputs.forEach((v: any) => i.push({ id: v.id, name: v.name ?? v.id }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      acc.outputs.forEach((v: any) => o.push({ id: v.id, name: v.name ?? v.id }));
      setIns(i); setOuts(o); setReady(true);
    }).catch(() => setReady(false));
  }, []);

  useEffect(() => { scan(); }, [scan]);

  const profile = CONTROLLER_PROFILES.find(p => p.id === cfg.controllerId);

  return (
    <div className="space-y-8">
      {/* Status + scan */}
      <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <div className={cls("w-2 h-2 rounded-full", ready === true ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : ready === false ? "bg-red-400" : "bg-slate-600 animate-pulse")} />
          <span className="text-sm text-slate-300">
            {ready === null ? "Vérification..." : ready ? `${ins.length} entrée(s) · ${outs.length} sortie(s)` : "Web MIDI API indisponible (Chrome requis)"}
          </span>
        </div>
        <button onClick={scan} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Entrée MIDI (IN)">
          <Select value={cfg.inputId} onChange={e => setCfg(m => ({ ...m, inputId: e.target.value }))}>
            <option value="">-- Aucun --</option>
            {ins.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Sortie MIDI (OUT)">
          <Select value={cfg.outputId} onChange={e => setCfg(m => ({ ...m, outputId: e.target.value }))}>
            <option value="">-- Aucun --</option>
            {outs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Canal (1–16)">
          <Input type="number" min={1} max={16} value={cfg.channel} onChange={e => setCfg(m => ({ ...m, channel: Math.max(1, Math.min(16, +e.target.value)) }))} />
        </Field>
        <div className="flex items-end">
          <Toggle checked={cfg.clockOut} onChange={v => setCfg(m => ({ ...m, clockOut: v }))} label="MIDI Clock OUT" sub="Sync BPM → Ableton, QLC+" />
        </div>
      </div>

      {/* Controller */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400/70">Profil contrôleur</h3>
        <Field label="Contrôleur MIDI">
          <Select value={cfg.controllerId} onChange={e => setCfg(m => ({ ...m, controllerId: e.target.value }))}>
            <option value="">-- Sélectionner --</option>
            {CONTROLLER_PROFILES.map(c => <option key={c.id} value={c.id}>{c.brand} — {c.name}</option>)}
          </Select>
        </Field>

        {profile && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 grid grid-cols-3 gap-3">
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Pads</p>
              <p className="text-xl font-black text-white">{profile.pads}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Faders</p>
              <p className="text-xl font-black text-white">{profile.faders}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">LEDs</p>
              <p className="text-xl font-black text-white">{profile.leds ? "✓" : "–"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: LLM ────────────────────────────────────────────────────────────
function LlmSection({ keys, setKeys }: { keys: LlmKeys; setKeys: React.Dispatch<React.SetStateAction<LlmKeys>> }) {
  const [active, setActive] = useState<string>("openai");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const provider = LLM_PROVIDERS.find(p => p.id === active)!;
  const configured = LLM_PROVIDERS.filter(p => (keys[p.id]?.key ?? "").length > 0).length;

  const handleTestKey = async () => {
    const key = keys[provider.id]?.key;
    const model = keys[provider.id]?.model ?? provider.def;
    if (!key) {
      setTestResult({ success: false, message: "Aucune clé API configurée" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`${API}/api/settings/test-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: key, model }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? `Connexion réussie (${data.latency}ms)` : data.error || "Échec de la connexion",
        latency: data.latency,
      });
    } catch (e) {
      setTestResult({ success: false, message: `Erreur: ${e}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex gap-6 min-h-[480px]">
      {/* Sidebar */}
      <div className="w-44 shrink-0 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-2 mb-3">{configured} configuré(s)</p>
        {LLM_PROVIDERS.map(p => {
          const hasKey = (keys[p.id]?.key ?? "").length > 0;
          const isActive = active === p.id;
          return (
            <button key={p.id} onClick={() => setActive(p.id)}
              className={cls(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left",
                isActive ? "bg-white/8 text-white border border-white/10" : "text-slate-400 hover:text-white hover:bg-white/4"
              )}>
              <span className="font-medium truncate">{p.name}</span>
              {hasKey && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
            </button>
          );
        })}
      </div>

      {/* Detail */}
      <div className="flex-1 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-base">{provider.name}</h3>
            {"note" in provider && provider.note && <p className="text-xs text-slate-500 mt-0.5">{provider.note}</p>}
          </div>
          <a href={provider.docs} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
            Obtenir une clé <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <Field label="Clé API">
          <KeyInput
            value={keys[provider.id]?.key ?? ""}
            onChange={v => setKeys(prev => ({ ...prev, [provider.id]: { key: v, model: prev[provider.id]?.model ?? provider.def } }))}
            placeholder={provider.ph}
          />
        </Field>

        <Field label="Modèle">
          <Select
            value={keys[provider.id]?.model ?? provider.def}
            onChange={e => setKeys(prev => ({ ...prev, [provider.id]: { key: prev[provider.id]?.key ?? "", model: e.target.value } }))}>
            {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>

        {/* Test Connection Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestKey}
            disabled={testing || !keys[provider.id]?.key}
            className={cls(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              testing
                ? "bg-white/5 text-slate-500 cursor-wait"
                : !keys[provider.id]?.key
                ? "bg-white/5 text-slate-600 cursor-not-allowed"
                : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
            )}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {testing ? "Test en cours..." : "Tester la connexion"}
          </button>

          {testResult && (
            <div className={cls(
              "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg",
              testResult.success
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}>
              {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-500 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <AlertCircle className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
          <span>Les clés sont stockées localement et masquées côté serveur. Elles ne transitent jamais en clair.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Groups ─────────────────────────────────────────────────────────
function GroupsSection({ groups, setGroups }: { groups: Record<string, GroupCfg>; setGroups: React.Dispatch<React.SetStateAction<Record<string, GroupCfg>>> }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">Les groupes A–F sont utilisés par le pipeline groupDispatch (Effets, IA Lumière, Timeline). Chaque groupe mappe vers une zone Smart Mode et un slider QLC+.</p>

      <div className="grid grid-cols-1 gap-3">
        {Object.entries(groups).map(([key, g]) => (
          <div key={key} className="rounded-xl border border-white/6 bg-white/[0.02] p-4">
            <div className="flex items-center gap-4">
              {/* Color dot + key */}
              <div className="flex items-center gap-3 w-16 shrink-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color, boxShadow: `0 0 8px ${g.color}60` }} />
                <span className="text-lg font-black text-white">{key}</span>
              </div>

              {/* Label */}
              <input
                value={g.label}
                onChange={e => setGroups(prev => ({ ...prev, [key]: { ...prev[key], label: e.target.value } }))}
                className="flex-1 rounded-lg border border-white/8 bg-[#0d0f14] px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
                placeholder={`Groupe ${key}`}
              />

              {/* Zone ID */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Zone</span>
                <input
                  type="number" min={0} max={9} value={g.zoneId}
                  onChange={e => setGroups(prev => ({ ...prev, [key]: { ...prev[key], zoneId: +e.target.value } }))}
                  className="w-14 rounded-lg border border-white/8 bg-[#0d0f14] px-2 py-2 text-sm text-white text-center focus:border-cyan-500/40 focus:outline-none"
                />
              </div>

              {/* Color picker */}
              <input
                type="color" value={g.color}
                onChange={e => setGroups(prev => ({ ...prev, [key]: { ...prev[key], color: e.target.value } }))}
                className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent shrink-0"
                title="Couleur du groupe"
              />

              {/* Active toggle */}
              <div
                onClick={() => setGroups(prev => ({ ...prev, [key]: { ...prev[key], active: !prev[key].active } }))}
                className={cls(
                  "relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0",
                  g.active ? "bg-cyan-500" : "bg-white/10"
                )}>
                <div className={cls("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", g.active ? "translate-x-5" : "translate-x-0.5")} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-3 text-xs text-cyan-400/70">
        Zone 1–4 → Sliders Smart Mode + QLC+. Zone 0 = groupe sans zone Smart.
      </div>
    </div>
  );
}

// ─── Section: Interface ───────────────────────────────────────────────────────
function InterfaceSection({ cfg, setCfg }: { cfg: UiCfg; setCfg: React.Dispatch<React.SetStateAction<UiCfg>> }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400/70">Préférences</h3>
        <Field label="Fournisseur IA par défaut">
          <Select value={cfg.defaultProvider} onChange={e => setCfg(u => ({ ...u, defaultProvider: e.target.value as ProviderId }))}>
            {LLM_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Toggle checked={cfg.compactMode} onChange={v => setCfg(u => ({ ...u, compactMode: v }))} label="Mode compact" sub="Réduit l'espacement des éléments" />
        <Toggle checked={cfg.showTooltips} onChange={v => setCfg(u => ({ ...u, showTooltips: v }))} label="Info-bulles" sub="Affiche les conseils au survol" />
      </div>

      <div className="rounded-xl border border-white/6 bg-white/[0.02] p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Raccourcis clavier</p>
        {[["S", "Smart Mode"], ["C", "Creator Mode"], ["L", "Live Mode"], ["Space", "Play / Pause"], ["B", "Blackout"], ["Ctrl+S", "Sauvegarder"]].map(([k, label]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-sm text-slate-300">{label}</span>
            <kbd className="px-2 py-0.5 rounded bg-white/8 text-white text-xs font-mono font-bold border border-white/10">{k}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Backup ─────────────────────────────────────────────────────────
function BackupSection({ cfg, setCfg }: { cfg: BackupCfg; setCfg: React.Dispatch<React.SetStateAction<BackupCfg>> }) {
  const handleExport = () => {
    const data = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      config: JSON.parse(localStorage.getItem("glowlogic_config") ?? "{}"),
      storage: JSON.parse(localStorage.getItem("glow-logic-storage") ?? "{}"),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `glow-logic-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Toggle checked={cfg.autosave} onChange={v => setCfg(b => ({ ...b, autosave: v }))}
          label="Sauvegarde automatique" sub="Sauvegarde le projet en cours périodiquement" />

        {cfg.autosave && (
          <Field label="Intervalle">
            <Select value={cfg.autosaveInterval} onChange={e => setCfg(b => ({ ...b, autosaveInterval: +e.target.value }))}>
              <option value={1}>Chaque minute</option>
              <option value={5}>Toutes les 5 minutes</option>
              <option value={10}>Toutes les 10 minutes</option>
              <option value={30}>Toutes les 30 minutes</option>
            </Select>
          </Field>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400/70">Export / Import</h3>
        <button onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-3 text-sm text-white font-semibold hover:border-white/20 hover:bg-white/5 transition-all">
          <HardDrive className="w-4 h-4" /> Exporter la configuration
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-500 rounded-lg border border-white/5 p-3">
        <AlertCircle className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
        <span>Les projets (nodes/edges) sont en SQLite côté serveur. L'export télécharge uniquement la config locale (localStorage).</span>
      </div>
    </div>
  );
}

// ─── Section: About ───────────────────────────────────────────────────────────
function AboutSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5 rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/8 to-purple-500/8 p-6">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
            <Activity className="w-7 h-7 text-cyan-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0a0c10] shadow-[0_0_8px_#34d399]" />
        </div>
        <div>
          <h2 className="text-white font-black text-2xl tracking-widest">GLOW LOGIC</h2>
          <p className="text-cyan-400 font-mono text-sm">v{APP_VERSION}</p>
          <p className="text-slate-400 text-xs mt-1">Contrôleur d&apos;éclairage live No-Code</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Frontend",  "Next.js 16 · React 19 · Tailwind"],
          ["Backend",   "Express · Socket.IO · ts-node"],
          ["Database",  "SQLite (better-sqlite3)"],
          ["Protocoles","Art-Net · OSC · WebMIDI API"],
          ["Canvas",    "ReactFlow 11"],
          ["IA / LLM",  "OpenAI · Claude · Gemini · …"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">{k}</p>
            <p className="text-sm text-white font-mono">{v}</p>
          </div>
        ))}
      </div>

      <a href="https://github.com/bobprod/Glow-logic" target="_blank" rel="noreferrer"
        className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 px-4 py-3 rounded-xl border border-white/6 hover:border-cyan-500/30 transition-all">
        <ExternalLink className="w-4 h-4" /> GitHub — bobprod/Glow-logic
      </a>

      <p className="text-xs text-slate-700 text-center">© {new Date().getFullYear()} Glow Logic — Open Source MIT</p>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const addToast = useStore(s => s.addToast);

  const [section, setSection] = useState<Section>("protocol");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"ok" | "err" | null>(null);

  const [status, setStatus] = useState<{ backend: boolean | null; qlc: boolean | null; artnet: boolean | null }>({
    backend: null, qlc: null, artnet: null,
  });

  // State
  const [protocol, setProtocol] = useState<ProtocolCfg>(() => load("glowlogic_config", {
    qlcHost: "127.0.0.1", qlcPort: 9999, oscPort: 7700,
    artnetHost: "255.255.255.255", artnetPort: 6454, artnetUniverse: 1,
  }));
  const [midi, setMidi] = useState<MidiCfg>(() => load("glowlogic_midi", { inputId: "", outputId: "", channel: 1, clockOut: false, controllerId: "" }));
  const [llmKeys, setLlmKeys] = useState<LlmKeys>(() => {
    const stored = load<LlmKeys>("glowlogic_llm", {});
    const result: LlmKeys = {};
    for (const p of LLM_PROVIDERS) {
      result[p.id] = { key: stored[p.id]?.key ?? "", model: stored[p.id]?.model ?? p.def };
    }
    return result;
  });
  const [groups, setGroups] = useState<Record<string, GroupCfg>>(() => load("glowlogic_groups", DEFAULT_GROUPS));
  const [ui, setUi] = useState<UiCfg>(() => load("glowlogic_ui", { defaultProvider: "openai", compactMode: false, showTooltips: true }));
  const [backup, setBackup] = useState<BackupCfg>(() => load("glowlogic_backup", { autosave: true, autosaveInterval: 5 }));

  // Load settings from backend on mount
  useEffect(() => {
    const loadFromBackend = async () => {
      try {
        const res = await fetch(`${API}/api/settings`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          // Update LLM keys from backend (unmasked)
          const newKeys: LlmKeys = {};
          for (const p of LLM_PROVIDERS) {
            const key = data[`${p.id}_key`];
            const model = data[`${p.id}_model`];
            if (key) {
              newKeys[p.id] = { key, model: model || p.def };
            }
          }
          if (Object.keys(newKeys).length > 0) {
            setLlmKeys(prev => ({ ...prev, ...newKeys }));
          }
          // Update groups from backend
          if (data.groups_config) {
            try {
              const parsed = JSON.parse(data.groups_config);
              setGroups(prev => ({ ...prev, ...parsed }));
            } catch {}
          }
        }
      } catch {}
    };
    loadFromBackend();
  }, []);

  // Ping backend status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API}/api/settings`, { signal: AbortSignal.timeout(2000) });
        setStatus(s => ({ ...s, backend: res.ok }));
      } catch { setStatus(s => ({ ...s, backend: false })); }
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, midi, llmKeys, groups, ui, backup]);

  async function handleSave() {
    setSaving(true); setSaved(null);
    try {
      localStorage.setItem("glowlogic_config", JSON.stringify(protocol));
      localStorage.setItem("glowlogic_midi", JSON.stringify(midi));
      localStorage.setItem("glowlogic_llm", JSON.stringify(llmKeys));
      localStorage.setItem("glowlogic_groups", JSON.stringify(groups));
      localStorage.setItem("glowlogic_ui", JSON.stringify(ui));
      localStorage.setItem("glowlogic_backup", JSON.stringify(backup));

      // Flatten for backend
      const flat: Record<string, string> = {
        qlc_host: protocol.qlcHost,
        qlc_port: String(protocol.qlcPort),
        osc_port: String(protocol.oscPort),
        artnet_host: protocol.artnetHost,
        artnet_port: String(protocol.artnetPort),
        artnet_universe: String(protocol.artnetUniverse),
        default_llm_provider: ui.defaultProvider,
        midi_input_id: midi.inputId,
        midi_output_id: midi.outputId,
        midi_channel: String(midi.channel),
        midi_clock_out: String(midi.clockOut),
        midi_controller_id: midi.controllerId,
        backup_autosave: String(backup.autosave),
        backup_interval: String(backup.autosaveInterval),
        groups_config: JSON.stringify(groups),
      };
      for (const [id, v] of Object.entries(llmKeys)) {
        if (v.key) flat[`${id}_key`] = v.key;
        if (v.model) flat[`${id}_model`] = v.model;
      }

      const res = await fetch(`${API}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flat),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSaved("ok");
      setTimeout(() => setSaved(null), 2000);
      addToast({ type: "success", message: "Paramètres sauvegardés", detail: "Configuration synchronisée" });
    } catch (e) {
      setSaved("err");
      setTimeout(() => setSaved(null), 3000);
      addToast({ type: "error", message: "Échec de la sauvegarde", detail: String(e), duration: 4000 });
    } finally {
      setSaving(false);
    }
  }

  // ─── Sidebar nav ──────────────────────────────────────────────────────────
  const nav: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "protocol",  label: "Protocoles",  icon: <Radio className="w-4 h-4" />,     badge: status.backend === true ? "live" : undefined },
    { id: "midi",      label: "MIDI",        icon: <Music className="w-4 h-4" />     },
    { id: "llm",       label: "IA & LLM",    icon: <Sparkles className="w-4 h-4" />  },
    { id: "groups",    label: "Groupes DMX", icon: <Layers className="w-4 h-4" />    },
    { id: "interface", label: "Interface",   icon: <Monitor className="w-4 h-4" />   },
    { id: "backup",    label: "Sauvegarde",  icon: <HardDrive className="w-4 h-4" /> },
    { id: "about",     label: "À propos",    icon: <Info className="w-4 h-4" />      },
  ];

  const titles: Record<Section, { title: string; sub: string }> = {
    protocol:  { title: "Protocoles", sub: "QLC+ OSC, Art-Net et connectivité réseau" },
    midi:      { title: "MIDI", sub: "Périphériques, horloge et profils contrôleurs" },
    llm:       { title: "IA & LLM", sub: "Clés API, modèles et fournisseur par défaut" },
    groups:    { title: "Groupes DMX", sub: "Configuration des groupes A–F du pipeline" },
    interface: { title: "Interface", sub: "Préférences d'affichage et raccourcis" },
    backup:    { title: "Sauvegarde", sub: "Autosave et export de configuration" },
    about:     { title: "À propos", sub: "Version, stack technique et liens" },
  };

  return (
    <div className="min-h-screen bg-[#08090d] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-sm px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div>
            <h1 className="text-white font-black text-base leading-tight">Paramètres</h1>
            <p className="text-[11px] text-slate-500">Glow Logic v{APP_VERSION}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-2 text-xs">
            {status.backend === true
              ? <><Wifi className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Backend OK</span></>
              : status.backend === false
              ? <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">Backend hors ligne</span></>
              : <><div className="w-3.5 h-3.5 rounded-full border border-slate-600 animate-pulse" /><span className="text-slate-500">...</span></>
            }
          </div>

          {/* Save button */}
          <button onClick={handleSave} disabled={saving}
            className={cls(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all",
              saved === "ok"
                ? "bg-emerald-500 text-black"
                : saved === "err"
                ? "bg-red-500 text-white"
                : "bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]"
            )}>
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved === "ok"
              ? <CheckCircle2 className="w-4 h-4" />
              : saved === "err"
              ? <AlertCircle className="w-4 h-4" />
              : <Save className="w-4 h-4" />}
            {saving ? "Sauvegarde..." : saved === "ok" ? "Sauvegardé !" : saved === "err" ? "Erreur" : "Sauvegarder"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-white/5 bg-[#0a0c10] p-4 space-y-1">
          {nav.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)}
              className={cls(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                section === item.id
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/4"
              )}>
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          {/* Quick links at bottom */}
          <div className="pt-4 mt-4 border-t border-white/5 space-y-1">
            {[
              { href: "/patch", icon: <Zap className="w-3.5 h-3.5" />, label: "Patch DMX" },
              { href: "/ai-lighting", icon: <Mic className="w-3.5 h-3.5" />, label: "IA Lumière" },
            ].map(link => (
              <a key={link.href} href={link.href}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/4 transition-colors">
                {link.icon} {link.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {/* Section header */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-white">{titles[section].title}</h2>
              <p className="text-slate-400 text-sm mt-1">{titles[section].sub}</p>
            </div>

            {section === "protocol"  && <ProtocolSection  cfg={protocol} setCfg={setProtocol} status={status} />}
            {section === "midi"      && <MidiSection      cfg={midi}     setCfg={setMidi} />}
            {section === "llm"       && <LlmSection       keys={llmKeys} setKeys={setLlmKeys} />}
            {section === "groups"    && <GroupsSection    groups={groups} setGroups={setGroups} />}
            {section === "interface" && <InterfaceSection cfg={ui}       setCfg={setUi} />}
            {section === "backup"    && <BackupSection    cfg={backup}   setCfg={setBackup} />}
            {section === "about"     && <AboutSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
