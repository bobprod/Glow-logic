"use client";

import React, { useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import useStore from "../../store/useStore";
import DmxSetupWizard from "./DmxSetupWizard";
import ApcMiniMapper from "./ApcMiniMapper";
import { testLLMKey, type LLMProvider } from "../../services/llm";
import { API_BASE, setAuthToken } from "../../lib/config";
import { dmxEngine } from "../../lib/dmxEngine";
import { socket } from "../../lib/socket";
import type { DmxOutputsConfig } from "../../types/dmx";
import {
  Settings,
  X,
  Save,
  Radio,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Music,
  HardDrive,
  Info,
  RefreshCw,
  Zap,
  Plug,
  Sliders,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

export type Config = {
  qlcHost: string;
  qlcPort: number;
  oscPort: number;
  artnetUniverse: number;
};

const DEFAULT_CONFIG: Config = {
  qlcHost: "127.0.0.1",
  qlcPort: 9999,
  oscPort: 7700,
  artnetUniverse: 1,
};

type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "nvidia"
  | "huggingface"
  | "openrouter"
  | "opencode"
  | "opencode-zen";

type AuthInfo = {
  token: string;
  masked: string;
  allowedOrigins: string[];
};

type Provider = {
  id: ProviderId;
  name: string;
  color: string;
  keyPlaceholder: string;
  docsUrl: string;
  models: string[];
  defaultModel: string;
  baseURL?: string;
  apiFormat?: "openai-compatible" | "anthropic";
  note?: string;
};

const LLM_PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    color: "emerald",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"],
    defaultModel: "gpt-4o-mini",
    baseURL: "https://api.openai.com/v1/chat/completions",
    apiFormat: "openai-compatible",
  },
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    color: "orange",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
    defaultModel: "claude-3-5-sonnet-20241022",
    baseURL: "https://api.anthropic.com/v1/messages",
    apiFormat: "anthropic",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    color: "blue",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    defaultModel: "gemini-1.5-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiFormat: "openai-compatible",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    color: "indigo",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    baseURL: "https://api.deepseek.com/v1/chat/completions",
    apiFormat: "openai-compatible",
  },
  {
    id: "qwen",
    name: "Qwen (Alibaba)",
    color: "purple",
    keyPlaceholder: "sk-...",
    docsUrl: "https://dashscope.console.aliyun.com/apiKey",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen2.5-72b-instruct"],
    defaultModel: "qwen-plus",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiFormat: "openai-compatible",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    color: "green",
    keyPlaceholder: "nvapi-...",
    docsUrl: "https://build.nvidia.com/explore/discover",
    models: [
      "meta/llama-3.3-70b-instruct",
      "mistralai/mixtral-8x22b-instruct-v0.1",
      "nvidia/llama-3.1-nemotron-70b-instruct",
    ],
    defaultModel: "meta/llama-3.3-70b-instruct",
    note: "Endpoint: integrate.api.nvidia.com",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    color: "yellow",
    keyPlaceholder: "hf_...",
    docsUrl: "https://huggingface.co/settings/tokens",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "Qwen/Qwen2.5-72B-Instruct",
    ],
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    color: "pink",
    keyPlaceholder: "sk-or-...",
    docsUrl: "https://openrouter.ai/keys",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "google/gemini-pro-1.5",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    defaultModel: "anthropic/claude-3.5-sonnet",
    note: "Accès unifié à 300+ modèles",
  },
  {
    id: "opencode",
    name: "OpenCode Go",
    color: "teal",
    keyPlaceholder: "oc-...",
    docsUrl: "https://opencode.ai/auth",
    models: [
      "glm-5",
      "glm-5.1",
      "kimi-k2.5",
      "kimi-k2.6",
      "mimo-v2.5",
      "mimo-v2.5-pro",
      "minimax-m2.5",
      "minimax-m2.7",
      "qwen3.6-plus",
      "qwen3.7-max",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ],
    defaultModel: "kimi-k2.6",
    baseURL: "https://opencode.ai/zen/go/v1/chat/completions",
    apiFormat: "openai-compatible",
    note: "1. Connectez-vous sur opencode.ai/auth  2. Copiez votre clé API  3. Collez-la ci-dessus",
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    color: "teal",
    keyPlaceholder: "oc-...",
    docsUrl: "https://opencode.ai/auth",
    // Endpoint Zen actuel (OpenAI-compatible). Modèles gratuits = suffixe -free.
    models: [
      "deepseek-v4-flash-free",
      "mimo-v2.5-free",
      "qwen3.6-plus-free",
      "deepseek-v4-pro",
      "qwen3.6-plus",
      "kimi-k2.6",
      "glm-5.1",
      "minimax-m2.7",
    ],
    defaultModel: "deepseek-v4-flash-free",
    baseURL: "https://opencode.ai/zen/v1/chat/completions",
    apiFormat: "openai-compatible",
    note: "Endpoint Zen actuel. Modèles gratuits (suffixe -free) : deepseek-v4-flash-free, mimo-v2.5-free, qwen3.6-plus-free. Clé sur opencode.ai/auth.",
  },
];

const PROVIDER_THEMES: Record<ProviderId, {
  border: string;
  bg: string;
  text: string;
  glow: string;
  activeBorder: string;
  activeBg: string;
}> = {
  openai: {
    border: "border-emerald-500/10",
    bg: "bg-emerald-500/[0.02]",
    text: "text-emerald-400",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    activeBorder: "border-emerald-500/50",
    activeBg: "bg-emerald-500/10",
  },
  anthropic: {
    border: "border-orange-500/10",
    bg: "bg-orange-500/[0.02]",
    text: "text-orange-400",
    glow: "shadow-[0_0_15px_rgba(249,115,22,0.1)]",
    activeBorder: "border-orange-500/50",
    activeBg: "bg-orange-500/10",
  },
  gemini: {
    border: "border-blue-500/10",
    bg: "bg-blue-500/[0.02]",
    text: "text-blue-400",
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    activeBorder: "border-blue-500/50",
    activeBg: "bg-blue-500/10",
  },
  deepseek: {
    border: "border-indigo-500/10",
    bg: "bg-indigo-500/[0.02]",
    text: "text-indigo-400",
    glow: "shadow-[0_0_15px_rgba(99,102,241,0.1)]",
    activeBorder: "border-indigo-500/50",
    activeBg: "bg-indigo-500/10",
  },
  qwen: {
    border: "border-purple-500/10",
    bg: "bg-purple-500/[0.02]",
    text: "text-purple-400",
    glow: "shadow-[0_0_15px_rgba(168,85,247,0.1)]",
    activeBorder: "border-purple-500/50",
    activeBg: "bg-purple-500/10",
  },
  nvidia: {
    border: "border-green-500/10",
    bg: "bg-green-500/[0.02]",
    text: "text-green-400",
    glow: "shadow-[0_0_15px_rgba(34,197,94,0.1)]",
    activeBorder: "border-green-500/50",
    activeBg: "bg-green-500/10",
  },
  huggingface: {
    border: "border-yellow-500/10",
    bg: "bg-yellow-500/[0.02]",
    text: "text-yellow-400",
    glow: "shadow-[0_0_15px_rgba(234,179,8,0.1)]",
    activeBorder: "border-yellow-500/50",
    activeBg: "bg-yellow-500/10",
  },
  openrouter: {
    border: "border-pink-500/10",
    bg: "bg-pink-500/[0.02]",
    text: "text-pink-400",
    glow: "shadow-[0_0_15px_rgba(236,72,153,0.1)]",
    activeBorder: "border-pink-500/50",
    activeBg: "bg-pink-500/10",
  },
  opencode: {
    border: "border-teal-500/10",
    bg: "bg-teal-500/[0.02]",
    text: "text-teal-400",
    glow: "shadow-[0_0_15px_rgba(20,184,166,0.1)]",
    activeBorder: "border-teal-500/50",
    activeBg: "bg-teal-500/10",
  },
  "opencode-zen": {
    border: "border-teal-500/10",
    bg: "bg-teal-500/[0.02]",
    text: "text-teal-400",
    glow: "shadow-[0_0_15px_rgba(20,184,166,0.1)]",
    activeBorder: "border-teal-500/50",
    activeBg: "bg-teal-500/10",
  },
};

type LlmKeys = Record<string, { key: string; model: string }>;

type UiPrefs = {
  compactMode: boolean;
  showTooltips: boolean;
  defaultProvider: ProviderId;
};

const DEFAULT_UI: UiPrefs = {
  compactMode: false,
  showTooltips: true,
  defaultProvider: "openai",
};

type MidiConfig = {
  inputId: string;
  outputId: string;
  channel: number;
  clockOut: boolean;
  controllerId: string;
  enableLedFeedback: boolean;
};

const DEFAULT_MIDI: MidiConfig = {
  inputId: "",
  outputId: "",
  channel: 1,
  clockOut: false,
  controllerId: "",
  enableLedFeedback: true,
};

type ControllerProfile = {
  id: string;
  name: string;
  brand: string;
  matchPatterns: string[];
  type: "pad" | "fader" | "hybrid";
  padCount: number;
  faderCount: number;
  noteRange: [number, number];
  ccRange: [number, number];
  ledFeedback: boolean;
  ledColors: Record<string, number>;
  description: string;
};

const CONTROLLER_PROFILES: ControllerProfile[] = [
  {
    id: "akai-apc-mini",
    name: "APC Mini",
    brand: "Akai",
    matchPatterns: ["apc mini", "apc mini mk2"],
    type: "hybrid",
    padCount: 64,
    faderCount: 9,
    noteRange: [0, 63],
    ccRange: [48, 56],
    ledFeedback: true,
    ledColors: {
      off: 0,
      green: 1,
      "green-blink": 2,
      red: 3,
      "red-blink": 4,
      yellow: 5,
      "yellow-blink": 6,
    },
    description: "64 pads RGB + 9 faders. LED feedback auto pour pads actifs.",
  },
  {
    id: "akai-apc-40",
    name: "APC 40 / APC 40 mkII",
    brand: "Akai",
    matchPatterns: ["apc40", "apc 40"],
    type: "hybrid",
    padCount: 40,
    faderCount: 9,
    noteRange: [0, 39],
    ccRange: [48, 56],
    ledFeedback: true,
    ledColors: { off: 0, green: 1, red: 3, yellow: 5 },
    description: "40 pads + 9 faders + encodeurs. Mode Ableton natif.",
  },
  {
    id: "akai-mpd218",
    name: "MPD218",
    brand: "Akai",
    matchPatterns: ["mpd218", "mpd 218"],
    type: "pad",
    padCount: 16,
    faderCount: 0,
    noteRange: [36, 51],
    ccRange: [0, 0],
    ledFeedback: false,
    ledColors: {},
    description: "16 pads pressure-sensitive. Idéal pour trigger de scènes.",
  },
  {
    id: "novation-launchpad-mini",
    name: "Launchpad Mini",
    brand: "Novation",
    matchPatterns: ["launchpad mini", "launchpad mk"],
    type: "pad",
    padCount: 64,
    faderCount: 0,
    noteRange: [0, 63],
    ccRange: [104, 111],
    ledFeedback: true,
    ledColors: { off: 12, red: 15, green: 60, yellow: 62, amber: 63 },
    description: "64 pads RGB. Grille 8x8 avec LED feedback bidirectionnel.",
  },
  {
    id: "novation-launch-control-xl",
    name: "Launch Control XL",
    brand: "Novation",
    matchPatterns: ["launch control xl"],
    type: "fader",
    padCount: 16,
    faderCount: 8,
    noteRange: [41, 56],
    ccRange: [13, 29],
    ledFeedback: true,
    ledColors: { off: 12, red: 15, green: 60, yellow: 62 },
    description: "8 faders + 24 encodeurs + 16 pads. Mapping faders DMX idéal.",
  },
  {
    id: "korg-nanokontrol2",
    name: "nanoKONTROL2",
    brand: "Korg",
    matchPatterns: ["nanokontrol", "nano kontrol", "nanokontrol2"],
    type: "fader",
    padCount: 0,
    faderCount: 8,
    noteRange: [0, 0],
    ccRange: [0, 7],
    ledFeedback: false,
    ledColors: {},
    description:
      "8 faders + 8 knobs + transport. Parfait pour dimmer/zone control.",
  },
  {
    id: "korg-nanopad2",
    name: "nanoPAD2",
    brand: "Korg",
    matchPatterns: ["nanopad", "nano pad"],
    type: "pad",
    padCount: 16,
    faderCount: 0,
    noteRange: [36, 51],
    ccRange: [0, 0],
    ledFeedback: false,
    ledColors: {},
    description: "16 pads velocity-sensitive + X-Y touchpad.",
  },
  {
    id: "arturia-minilab",
    name: "MiniLab MkII / 3",
    brand: "Arturia",
    matchPatterns: ["minilab", "arturia minilab"],
    type: "hybrid",
    padCount: 16,
    faderCount: 0,
    noteRange: [36, 51],
    ccRange: [1, 16],
    ledFeedback: true,
    ledColors: { off: 0, on: 127 },
    description:
      "16 pads RGB + 16 encodeurs. Pads pour scènes, knobs pour parametres.",
  },
  {
    id: "behringer-x-touch-mini",
    name: "X-TOUCH MINI",
    brand: "Behringer",
    matchPatterns: ["x-touch mini", "xtouch mini"],
    type: "hybrid",
    padCount: 16,
    faderCount: 1,
    noteRange: [0, 15],
    ccRange: [1, 8],
    ledFeedback: true,
    ledColors: { off: 0, on: 127 },
    description:
      "16 boutons + 8 encodeurs LED + 1 fader. Compact et polyvalent.",
  },
  {
    id: "generic",
    name: "Contrôleur Générique",
    brand: "Autre",
    matchPatterns: [],
    type: "hybrid",
    padCount: 16,
    faderCount: 8,
    noteRange: [0, 127],
    ccRange: [0, 127],
    ledFeedback: false,
    ledColors: {},
    description:
      "Mapping manuel. Compatible avec tout contrôleur MIDI standard.",
  },
];

type BackupConfig = {
  autosave: boolean;
  autosaveInterval: number;
};

function normalizeDmxOutputs(raw: unknown, fallback: DmxOutputsConfig): DmxOutputsConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<Record<keyof DmxOutputsConfig, unknown>>;
  return {
    qlcOsc: Boolean(data.qlcOsc ?? fallback.qlcOsc),
    qlcWs: Boolean(data.qlcWs ?? fallback.qlcWs),
    artNet: Boolean(data.artNet ?? fallback.artNet),
    usbDmx: Boolean(data.usbDmx ?? fallback.usbDmx),
  };
}

type LicenseStatus = {
  mode: "trial" | "activated" | "expired" | "invalid";
  offlineReady: boolean;
  machineId: string;
  licenseName: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  message: string;
};

type SafetyState = {
  operatorRole: "beginner" | "expert" | "admin";
  dangerousPhysicalOutputsEnabled: boolean;
  armed: Record<"laser" | "pyro" | "drone" | "external_api", boolean>;
  rules: Array<{ id: string; label: string; active: boolean }>;
};

const DEFAULT_BACKUP: BackupConfig = {
  autosave: true,
  autosaveInterval: 5,
};

const APP_VERSION = "2.0.0";

function KeyField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const addToast = useStore((s) => s.addToast);
  const setMidiArmed = useStore((s) => s.setMidiArmed);
  const dmxOutputs = useStore((s) => s.dmxOutputs);
  const setDmxOutputs = useStore((s) => s.setDmxOutputs);
  const [mounted, setMounted] = useState(false);
  const [scanningMidi, setScanningMidi] = useState(false);
  const [showDmxWizard, setShowDmxWizard] = useState(false);
  const [showMidiMapper, setShowMidiMapper] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "protocol" | "dmx" | "midi" | "llm" | "interface" | "backup" | "safety" | "license" | "about"
  >("protocol");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [safetyState, setSafetyState] = useState<SafetyState | null>(null);
  const [safetyConfirmation, setSafetyConfirmation] = useState("");
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<
    null | "testing" | "ok" | "err"
  >(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [cfg, setCfg] = useState<Config>(() => {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    try {
      return JSON.parse(
        localStorage.getItem("glowlogic_config") ?? "",
      ) as Config;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [llmKeys, setLlmKeys] = useState<LlmKeys>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(
        localStorage.getItem("glowlogic_llm") ?? "{}",
      ) as LlmKeys;
    } catch {
      return {};
    }
  });

  const [ui, setUi] = useState<UiPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_UI;
    try {
      return {
        ...DEFAULT_UI,
        ...(JSON.parse(
          localStorage.getItem("glowlogic_ui") ?? "{}",
        ) as Partial<UiPrefs>),
      };
    } catch {
      return DEFAULT_UI;
    }
  });

  const [activeProvider, setActiveProvider] = useState<ProviderId>("openai");

  const [midi, setMidi] = useState<MidiConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_MIDI;
    try {
      return {
        ...DEFAULT_MIDI,
        ...(JSON.parse(
          localStorage.getItem("glowlogic_midi") ?? "{}",
        ) as Partial<MidiConfig>),
      };
    } catch {
      return DEFAULT_MIDI;
    }
  });
  const [midiInputs, setMidiInputs] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [midiOutputs, setMidiOutputs] = useState<
    { id: string; name: string }[]
  >([]);
  const [midiReady, setMidiReady] = useState<boolean | null>(null);
  const [detectedProfile, setDetectedProfile] =
    useState<ControllerProfile | null>(null);

  // -- DMX Output Config --------------------------------------------
  const [usbDmxConfig, setUsbDmxConfig] = useState({
    enabled: false,
    portPath: "",
    universe: 1,
  });
  const [availablePorts, setAvailablePorts] = useState<
    { path: string; manufacturer?: string }[]
  >([]);
  const [usbStatus, setUsbStatus] = useState<{
    connected: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    dmxEngine.setOutputGate(dmxOutputs);
  }, [dmxOutputs]);

  // Sortie "Bridge Python" : flag serveur uniquement (dispatch série), lu/écrit via /api/dmx/router
  const [pythonOutput, setPythonOutput] = useState(false);
  useEffect(() => {
    fetch(`${API_BASE}/api/dmx/router`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.python === "boolean") setPythonOutput(data.python);
      })
      .catch(() => {});
  }, []);

  const updateDmxOutputs = useCallback((outputs: Partial<DmxOutputsConfig>) => {
    const nextOutputs = { ...useStore.getState().dmxOutputs, ...outputs };
    setDmxOutputs(outputs);
    dmxEngine.setOutputGate(nextOutputs);
  }, [setDmxOutputs]);

  const [backup, setBackup] = useState<BackupConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_BACKUP;
    try {
      return {
        ...DEFAULT_BACKUP,
        ...(JSON.parse(
          localStorage.getItem("glowlogic_backup") ?? "{}",
        ) as Partial<BackupConfig>),
      };
    } catch {
      return DEFAULT_BACKUP;
    }
  });

  const scanMidi = useCallback(() => {
    if (
      typeof navigator === "undefined" ||
      !("requestMIDIAccess" in navigator)
    ) {
      setMidiReady(false);
      return;
    }
     
    (navigator as any)
      .requestMIDIAccess({ sysex: false })
       
      .then((access: any) => {
        const ins: { id: string; name: string }[] = [];
        const outs: { id: string; name: string }[] = [];
         
        access.inputs.forEach((v: any) =>
          ins.push({ id: v.id, name: v.name ?? v.id }),
        );
         
        access.outputs.forEach((v: any) =>
          outs.push({ id: v.id, name: v.name ?? v.id }),
        );
        setMidiInputs(ins);
        setMidiOutputs(outs);
        setMidiReady(true);
        // Auto-detect controller profile from device names
        const allNames = [...ins, ...outs].map((d) => d.name.toLowerCase());
        for (const profile of CONTROLLER_PROFILES) {
          if (profile.id === "generic") continue;
          const found = profile.matchPatterns.some((pat) =>
            allNames.some((n) => n.includes(pat)),
          );
          if (found) {
            setDetectedProfile(profile);
            setMidi((m) =>
              m.controllerId ? m : { ...m, controllerId: profile.id },
            );
            break;
          }
        }
      })
      .catch(() => setMidiReady(false));
  }, []);

  const refreshDmxAndUsbSettings = useCallback(() => {
    // Load DMX router config
    fetch(`${API_BASE}/api/dmx/router`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) updateDmxOutputs(normalizeDmxOutputs(data, useStore.getState().dmxOutputs));
      })
      .catch(() => {});

    // Load USB DMX config
    fetch(`${API_BASE}/api/dmx/usb-status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (status) {
          setUsbStatus(status);
          setUsbDmxConfig((prev) => ({
            ...prev,
            enabled: status.connected,
            portPath: status.portPath || prev.portPath,
          }));
        }
      })
      .catch(() => {});

    // Load available COM ports
    fetch(`${API_BASE}/api/dmx/ports`)
      .then((r) => (r.ok ? r.json() : []))
      .then((ports) => {
        setAvailablePorts(
          ports.map((p: any) => ({
            path: p.path,
            manufacturer: p.manufacturer || "Inconnu",
          }))
        );
      })
      .catch(() => {});
  }, [updateDmxOutputs]);

  const refreshSafetyState = useCallback(() => {
    fetch(`${API_BASE}/api/safety`)
      .then((r) => (r.ok ? r.json() : null))
      .then((state) => {
        if (state) {
          setSafetyState(state);
          setMidiArmed("laser", Boolean(state.armed?.laser));
          setMidiArmed("pyro", Boolean(state.armed?.pyro));
        }
      })
      .catch(() => setSafetyState(null));
  }, [setMidiArmed]);

  const refreshAuthInfo = useCallback(() => {
    fetch(`${API_BASE}/api/auth/token`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.token) setAuthInfo(data as AuthInfo);
      })
      .catch(() => setAuthInfo(null));
  }, []);

  useEffect(() => {
    // Check backend connectivity
    fetch(`${API_BASE}/api/settings`)
      .then((r) => setBackendOnline(r.ok))
      .catch(() => setBackendOnline(false));

    fetch(`${API_BASE}/api/license`)
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (status) setLicenseStatus(status);
      })
      .catch(() => setLicenseStatus(null));

    refreshDmxAndUsbSettings();
    refreshSafetyState();
    refreshAuthInfo();

    // Hydrate defaults for providers without a stored model
    setLlmKeys((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of LLM_PROVIDERS) {
        if (!next[p.id]) {
          next[p.id] = { key: "", model: p.defaultModel };
          changed = true;
        } else if (!next[p.id].model) {
          next[p.id] = { ...next[p.id], model: p.defaultModel };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    scanMidi();
    setMounted(true);
  }, [refreshAuthInfo, refreshDmxAndUsbSettings, refreshSafetyState, scanMidi]);

  async function handleRegenerateToken() {
    if (!window.confirm("Regenerer le token de pairing et deconnecter les appareils distants ?")) return;
    setAuthBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.token) throw new Error(data?.error || "Regeneration impossible");
      setAuthToken(data.token);
      setAuthInfo(data as AuthInfo);
      socket.disconnect();
      socket.connect();
      addToast({ type: "warning", message: "Token regenere", detail: "Les appareils distants doivent etre reappaires." });
    } catch (error: any) {
      addToast({ type: "error", message: "Token non regenere", detail: error.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleActivateLicense() {
    if (!licenseKey.trim()) return;
    setLicenseSaving(true);
    setSaved(null);
    try {
      const res = await fetch(`${API_BASE}/api/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: licenseKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Activation impossible");
      setLicenseStatus(data);
      setLicenseKey("");
      setSaved("ok");
    } catch {
      setSaved("err");
    } finally {
      setLicenseSaving(false);
    }
  }

  async function handleSafetyRole(role: SafetyState["operatorRole"]) {
    try {
      const res = await fetch(`${API_BASE}/api/safety/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Role refuse");
      setSafetyState(data);
      addToast({ type: "success", message: "Role safety mis a jour", detail: role });
    } catch (error: any) {
      addToast({ type: "error", message: "Role safety refuse", detail: error.message });
    }
  }

  async function handleHazardArm(hazard: keyof SafetyState["armed"], armed: boolean) {
    try {
      const res = await fetch(`${API_BASE}/api/safety/arm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hazard,
          armed,
          confirmation: armed ? safetyConfirmation.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Armement refuse");
      setSafetyState(data);
      if (hazard === "laser" || hazard === "pyro") {
        setMidiArmed(hazard, Boolean(data?.armed?.[hazard]));
      }
      setSafetyConfirmation("");
      addToast({
        type: armed ? "warning" : "info",
        message: armed ? "Fonction armee en simulation" : "Fonction desarmee",
        detail: hazard,
      });
    } catch (error: any) {
      addToast({ type: "error", message: "Safety Gate", detail: error.message });
    }
  }

  async function handleTestKey(providerId: ProviderId) {
    setTestStatus("testing");
    try {
      await testLLMKey(providerId as LLMProvider);
      setTestStatus("ok");
      setTimeout(() => setTestStatus(null), 2000);
    } catch {
      setTestStatus("err");
      setTimeout(() => setTestStatus(null), 3000);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(null);
    try {
      localStorage.setItem("glowlogic_config", JSON.stringify(cfg));
      localStorage.setItem("glowlogic_llm", JSON.stringify(llmKeys));
      localStorage.setItem("glowlogic_ui", JSON.stringify(ui));
      localStorage.setItem("glowlogic_midi", JSON.stringify(midi));
      localStorage.setItem("glowlogic_backup", JSON.stringify(backup));

      // Push to server (keys flattened)
      const flat: Record<string, string> = {
        qlc_host: cfg.qlcHost,
        qlc_port: String(cfg.qlcPort),
        osc_port: String(cfg.oscPort),
        artnet_universe: String(cfg.artnetUniverse),
        default_llm_provider: ui.defaultProvider,
        midi_input_id: midi.inputId,
        midi_output_id: midi.outputId,
        midi_channel: String(midi.channel),
        midi_clock_out: String(midi.clockOut),
        midi_controller_id: midi.controllerId,
        backup_autosave: String(backup.autosave),
        backup_interval: String(backup.autosaveInterval),
      };
      for (const [id, v] of Object.entries(llmKeys)) {
        if (v.key) flat[`${id}_key`] = v.key;
        if (v.model) flat[`${id}_model`] = v.model;
        const provider = LLM_PROVIDERS.find((p) => p.id === id);
        if (provider?.baseURL) flat[`${id}_baseURL`] = provider.baseURL;
        if (provider?.apiFormat) flat[`${id}_apiFormat`] = provider.apiFormat;
      }

      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flat),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Save DMX router config (python = flag serveur, hors gate frontend)
      await fetch(`${API_BASE}/api/dmx/router`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dmxOutputs, python: pythonOutput }),
      });

      // Save USB DMX config (enabled flag comes from router toggle)
      await fetch(`${API_BASE}/api/dmx/usb-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...usbDmxConfig,
          enabled: dmxOutputs.usbDmx,
        }),
      });
      setSaved("ok");
      setTimeout(() => setSaved(null), 1500);
      addToast({
        type: "success",
        message: "Configuration sauvegardée",
        detail: "Paramètres appliqués",
      });
    } catch (e) {
      console.error("[settings] save failed", e);
      setSaved("err");
      setTimeout(() => setSaved(null), 2500);
      addToast({
        type: "error",
        message: "Échec de la sauvegarde",
        detail: String(e),
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  }

  const currentProvider = LLM_PROVIDERS.find((p) => p.id === activeProvider)!;
  const providersWithKey = LLM_PROVIDERS.filter(
    (p) => (llmKeys[p.id]?.key ?? "").length > 0,
  ).length;
  const tabMeta = {
    protocol: {
      label: "Protocoles",
      description: "OSC, Art-Net et connectivité backend.",
    },
    dmx: {
      label: "Sorties DMX",
      description: "QLC+ OSC, Art-Net et USB DMX (UTD-10).",
    },
    midi: {
      label: "MIDI",
      description: "Entrées, sorties, horloge et profils contrôleurs.",
    },
    llm: {
      label: "IA & LLM",
      description: "Clés API, modèles actifs et fournisseur par défaut.",
    },
    interface: {
      label: "Interface",
      description: "Préférences d'affichage et comportement UI.",
    },
    backup: {
      label: "Sauvegarde",
      description: "Autosave et export de configuration locale.",
    },
    safety: {
      label: "Safety Gate",
      description: "Roles, armement manuel et blocage des fonctions sensibles.",
    },
    license: {
      label: "Licence",
      description: "Activation locale et fonctionnement hors ligne.",
    },
    about: {
      label: "À propos",
      description: "Version, stack et liens du projet.",
    },
  } as const;
  const activeTabMeta = tabMeta[activeTab];

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative flex h-full w-full md:w-[840px] flex-col md:flex-row bg-[#08090c]/98 shadow-[0_0_100px_rgba(0,0,0,0.8)] border-l border-white/10 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.1),transparent_70%)]" />

        {/* Navigation Sidebar */}
        <div className="flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-white/5 bg-black/40 md:w-60 md:h-full relative z-10">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-black text-white tracking-wider">Paramètres</h2>
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-400/70">
                Système Glow Logic
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex md:flex-col gap-1.5 p-3 overflow-x-auto md:overflow-x-visible no-scrollbar md:flex-1">
            <TabBtn
              active={activeTab === "protocol"}
              onClick={() => setActiveTab("protocol")}
              icon={<Radio className="w-4 h-4" />}
              label="Protocoles"
            />
            <TabBtn
              active={activeTab === "dmx"}
              onClick={() => setActiveTab("dmx")}
              icon={<Zap className="w-4 h-4" />}
              label="DMX"
            />
            <TabBtn
              active={activeTab === "midi"}
              onClick={() => setActiveTab("midi")}
              icon={<Music className="w-4 h-4" />}
              label="MIDI"
            />
            <TabBtn
              active={activeTab === "llm"}
              onClick={() => setActiveTab("llm")}
              icon={<Sparkles className="w-4 h-4" />}
              label="IA & LLM"
              badge={providersWithKey > 0 ? providersWithKey : undefined}
            />
            <TabBtn
              active={activeTab === "interface"}
              onClick={() => setActiveTab("interface")}
              icon={<Cpu className="w-4 h-4" />}
              label="Interface"
            />
            <TabBtn
              active={activeTab === "backup"}
              onClick={() => setActiveTab("backup")}
              icon={<HardDrive className="w-4 h-4" />}
              label="Sauvegarde"
            />
            <TabBtn
              active={activeTab === "safety"}
              onClick={() => setActiveTab("safety")}
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Safety"
            />
            <TabBtn
              active={activeTab === "license"}
              onClick={() => setActiveTab("license")}
              icon={<KeyRound className="w-4 h-4" />}
              label="Licence"
            />
            <TabBtn
              active={activeTab === "about"}
              onClick={() => setActiveTab("about")}
              icon={<Info className="w-4 h-4" />}
              label="À propos"
            />
          </div>

          {/* Sidebar Footer (Desktop only) */}
          <div className="hidden md:flex flex-col gap-2 p-4 border-t border-white/5 bg-black/25">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Version</span>
              <span className="text-cyan-400 font-bold">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Statut</span>
              {backendOnline === null ? (
                <span className="flex items-center gap-1 text-slate-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                  …
                </span>
              ) : backendOnline ? (
                <span className="flex items-center gap-1 text-green-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Connecté
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Hors ligne
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side settings content */}
        <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-white/[0.01] to-transparent relative z-10">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-white/5 bg-black/5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
                {activeTabMeta.label}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {activeTabMeta.description}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition-all hover:bg-white/5 hover:text-white"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {activeTab === "protocol" && (
                  <div className="space-y-6 max-w-xl">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                        QLC+ / OSC
                      </p>
                      <div className="space-y-4">
                        <Field label="Adresse QLC+ Host">
                          <input
                            type="text"
                            value={cfg.qlcHost}
                            onChange={(e) =>
                              setCfg((c) => ({ ...c, qlcHost: e.target.value }))
                            }
                            className={inputCls}
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Port Entrée OSC">
                            <input
                              type="number"
                              value={cfg.oscPort}
                              onChange={(e) =>
                                setCfg((c) => ({ ...c, oscPort: +e.target.value }))
                              }
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Port Web API">
                            <input
                              type="number"
                              value={cfg.qlcPort}
                              onChange={(e) =>
                                setCfg((c) => ({ ...c, qlcPort: +e.target.value }))
                              }
                              className={inputCls}
                            />
                          </Field>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-purple-400/80 font-bold uppercase tracking-wider">
                        Art-Net
                      </p>
                      <Field label="Univers par défaut">
                        <input
                          type="number"
                          min={0}
                          max={32}
                          value={cfg.artnetUniverse}
                          onChange={(e) =>
                            setCfg((c) => ({
                              ...c,
                              artnetUniverse: +e.target.value,
                            }))
                          }
                          className={inputCls}
                        />
                      </Field>
                    </div>

                    <div className="bg-black/35 rounded-xl p-4 border border-white/5 space-y-2">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Statut Réseau
                      </p>
                      <div className={`flex items-center gap-2.5 text-xs ${backendOnline ? "text-green-400" : backendOnline === false ? "text-red-400" : "text-slate-400"}`}>
                        <span className="relative flex h-2 w-2">
                          {backendOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${backendOnline ? "bg-green-500" : backendOnline === false ? "bg-red-500" : "bg-slate-500"}`}></span>
                        </span>
                        <span>Backend : {API_BASE} {backendOnline === false ? "(hors ligne)" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-green-400">
                        <span className="relative flex h-2 w-2">
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span>QLC+ OSC → {cfg.qlcHost}:{cfg.oscPort}</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "dmx" && (
                  <div className="space-y-6 max-w-xl">
                    {/* Setup Wizard Banner */}
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                            Assistant Configuration DMX Matériel
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Configurez pas-à-pas vos câbles, cartes réseau, adresses IP Art-Net et diagnostics USB.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDmxWizard(true)}
                          className="shrink-0 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                          Lancer l'assistant →
                        </button>
                      </div>
                    </div>

                    {/* DMX Router Outputs */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                        Routeur DMX
                      </p>
                      <p className="text-xs text-slate-500">
                        Active les sorties simultanées. Toutes les valeurs DMX sont dispatchées en parallèle.
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={dmxOutputs.qlcOsc}
                            onChange={(e) =>
                              updateDmxOutputs({ qlcOsc: e.target.checked })
                            }
                            className="w-4 h-4 accent-cyan-500 rounded border-slate-600 bg-slate-800"
                          />
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium">QLC+ OSC</p>
                            <p className="text-[10px] text-slate-500">UDP vers QLC+ sur le port 7700</p>
                          </div>
                          {dmxOutputs.qlcOsc && (
                            <span className="text-[10px] text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded">ACTIF</span>
                          )}
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={dmxOutputs.artNet}
                            onChange={(e) =>
                              updateDmxOutputs({ artNet: e.target.checked })
                            }
                            className="w-4 h-4 accent-cyan-500 rounded border-slate-600 bg-slate-800"
                          />
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium">Art-Net</p>
                            <p className="text-[10px] text-slate-500">UDP broadcast DMX vers le réseau (port 6454)</p>
                          </div>
                          {dmxOutputs.artNet && (
                            <span className="text-[10px] text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded">ACTIF</span>
                          )}
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={dmxOutputs.usbDmx}
                            onChange={(e) =>
                              updateDmxOutputs({ usbDmx: e.target.checked })
                            }
                            className="w-4 h-4 accent-cyan-500 rounded border-slate-600 bg-slate-800"
                          />
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium">USB DMX</p>
                            <p className="text-[10px] text-slate-500">Port COM FTDI (UTD-10 / UTD-11)</p>
                          </div>
                          {dmxOutputs.usbDmx && (
                            <span className="text-[10px] text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded">ACTIF</span>
                          )}
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={pythonOutput}
                            onChange={(e) => setPythonOutput(e.target.checked)}
                            className="w-4 h-4 accent-cyan-500 rounded border-slate-600 bg-slate-800"
                          />
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium">Bridge Python (port COM)</p>
                            <p className="text-[10px] text-slate-500">Sortie série via le bridge Python (SetCommBreak)</p>
                          </div>
                          {pythonOutput && (
                            <span className="text-[10px] text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded">ACTIF</span>
                          )}
                        </label>
                        {pythonOutput && dmxOutputs.usbDmx && (
                          <p className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                            ⚠ Bridge Python et USB DMX visent le même port COM : un seul peut le tenir. Désactivez l&apos;un des deux.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* USB DMX Config */}
                    {dmxOutputs.usbDmx && (
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                        <p className="text-xs text-purple-400/80 font-bold uppercase tracking-wider">
                          Configuration USB DMX
                        </p>
                        <div className="space-y-4">
                          <Field label="Port COM (FTDI)">
                            <select
                              value={usbDmxConfig.portPath}
                              onChange={(e) =>
                                setUsbDmxConfig((p) => ({ ...p, portPath: e.target.value }))
                              }
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                            >
                              <option value="">-- Sélectionner un port --</option>
                              {availablePorts.map((port) => (
                                <option key={port.path} value={port.path}>
                                  {port.path} {port.manufacturer ? `(${port.manufacturer})` : ""}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Univers DMX">
                            <input
                              type="number"
                              min={1}
                              max={16}
                              value={usbDmxConfig.universe}
                              onChange={(e) =>
                                setUsbDmxConfig((p) => ({
                                  ...p,
                                  universe: parseInt(e.target.value) || 1,
                                }))
                              }
                              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                            />
                          </Field>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={async () => {
                                const res = await fetch(`${API_BASE}/api/dmx/ports`);
                                const ports = res.ok ? await res.json() : [];
                                setAvailablePorts(
                                  ports.map((p: any) => ({
                                    path: p.path,
                                    manufacturer: p.manufacturer || "Inconnu",
                                  }))
                                );
                              }}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Actualiser ports
                            </button>
                            <button
                              onClick={async () => {
                                const testConfig = { ...usbDmxConfig, enabled: true };
                                await fetch(`${API_BASE}/api/dmx/usb-config`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(testConfig),
                                });
                                // Wait briefly for async connection + retry
                                await new Promise((r) => setTimeout(r, 400));
                                const statusRes = await fetch(`${API_BASE}/api/dmx/usb-status`);
                                const status = statusRes.ok ? await statusRes.json() : null;
                                setUsbStatus(status);
                                addToast({
                                  type: status?.connected ? "success" : "warning",
                                  message: status?.connected
                                    ? "USB DMX connecté"
                                    : "USB DMX non connecté",
                                  detail: status?.error || status?.portPath || "",
                                });
                              }}
                              disabled={!usbDmxConfig.portPath}
                              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 border border-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plug className="w-3.5 h-3.5" />
                              Tester connexion
                            </button>
                          </div>
                          {usbStatus && (
                            <div
                              className={`flex items-center gap-2 text-xs ${
                                usbStatus.connected ? "text-green-400" : "text-amber-400"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  usbStatus.connected ? "bg-green-500" : "bg-amber-500"
                                }`}
                              />
                              {usbStatus.connected
                                ? `Connecté sur ${usbDmxConfig.portPath || "?"}`
                                : usbStatus.error || "Non connecté"}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "midi" && (
                  <div className="space-y-6 max-w-xl">
                    {/* Setup APC Mini Banner */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-purple-400 animate-pulse" />
                            Configuration AKAI APC mini
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Mappez visuellement vos faders, ajustez la luminosité des LEDs et configurez le mode GO.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMidiMapper(true)}
                          className="shrink-0 px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                        >
                          Configurer →
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                        Connexion MIDI
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          setScanningMidi(true);
                          scanMidi();
                          await new Promise((r) => setTimeout(r, 800));
                          setScanningMidi(false);
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/5 hover:border-cyan-500/20 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${scanningMidi ? "animate-spin" : ""}`} />
                        Actualiser
                      </button>
                    </div>

                    {midiReady === false && (
                      <div className="flex items-start gap-3 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold mb-0.5">Web MIDI API non disponible</p>
                          <p className="text-slate-400">Veuillez utiliser un navigateur compatible comme Google Chrome, Microsoft Edge ou Opera.</p>
                        </div>
                      </div>
                    )}

                    {midiReady === true && midiInputs.length === 0 && midiOutputs.length === 0 && (
                      <div className="flex items-start gap-3 text-xs text-slate-400 bg-white/[0.01] border border-white/5 rounded-xl p-4">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
                        <div>
                          <p className="font-bold text-slate-300 mb-0.5">Aucun périphérique détecté</p>
                          <p className="text-slate-500">Connectez vos interfaces ou contrôleurs MIDI par USB et cliquez sur Actualiser.</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <Field label="Entrée MIDI (IN)">
                        <select
                          value={midi.inputId}
                          onChange={(e) =>
                            setMidi((m) => ({ ...m, inputId: e.target.value }))
                          }
                          className={inputCls}
                        >
                          <option value="">-- Aucun --</option>
                          {midiInputs.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Sortie MIDI (OUT)">
                        <select
                          value={midi.outputId}
                          onChange={(e) =>
                            setMidi((m) => ({ ...m, outputId: e.target.value }))
                          }
                          className={inputCls}
                        >
                          <option value="">-- Aucun --</option>
                          {midiOutputs.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Canal MIDI (1–16)">
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={midi.channel}
                            onChange={(e) =>
                              setMidi((m) => ({
                                ...m,
                                channel: Math.max(1, Math.min(16, +e.target.value)),
                              }))
                            }
                            className={inputCls}
                          />
                        </Field>
                        <div className="flex flex-col justify-end">
                          <label className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-3.5 py-3 cursor-pointer hover:border-white/10 transition-colors">
                            <span className="text-xs text-slate-300">MIDI Clock OUT</span>
                            <input
                              type="checkbox"
                              checked={midi.clockOut}
                              onChange={(e) =>
                                setMidi((m) => ({ ...m, clockOut: e.target.checked }))
                              }
                              className="accent-cyan-500 w-4 h-4"
                            />
                          </label>
                        </div>
                      </div>

                      <label className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-3.5 py-3 cursor-pointer hover:border-white/10 transition-colors">
                        <span className="text-xs text-slate-300">
                          Feedback LED (allumer les pads du contrôleur)
                        </span>
                        <input
                          type="checkbox"
                          checked={midi.enableLedFeedback}
                          onChange={(e) =>
                            setMidi((m) => ({
                              ...m,
                              enableLedFeedback: e.target.checked,
                            }))
                          }
                          className="accent-cyan-500 w-4 h-4"
                        />
                      </label>
                    </div>

                    {/* Controller Profile */}
                    <div className="border-t border-white/5 pt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          Profil Contrôleur
                        </span>
                        {detectedProfile && (
                          <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Détecté : {detectedProfile.name}
                          </span>
                        )}
                      </div>

                      <Field label="Sélectionner le profil">
                        <select
                          value={midi.controllerId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setMidi((m) => ({ ...m, controllerId: id }));
                            const p =
                              CONTROLLER_PROFILES.find((c) => c.id === id) ?? null;
                            setDetectedProfile(p);
                          }}
                          className={inputCls}
                        >
                          <option value="">-- Aucun profil (Mapping manuel) --</option>
                          {CONTROLLER_PROFILES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.brand} — {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {midi.controllerId &&
                        (() => {
                          const p = CONTROLLER_PROFILES.find(
                            (c) => c.id === midi.controllerId,
                          );
                          if (!p) return null;
                          return (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-gradient-to-br from-purple-500/[0.03] to-cyan-500/[0.03] border border-purple-500/20 rounded-2xl p-5 space-y-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h4 className="text-white font-bold text-sm">
                                    {p.brand} {p.name}
                                  </h4>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {p.description}
                                  </p>
                                </div>
                                <span
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                                    p.type === "pad"
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                      : p.type === "fader"
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  {p.type === "pad"
                                    ? "Pads"
                                    : p.type === "fader"
                                      ? "Faders"
                                      : "Hybride"}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {p.padCount > 0 && (
                                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                      Nombre de Pads
                                    </span>
                                    <p className="text-lg text-white font-mono font-bold mt-0.5">
                                      {p.padCount}
                                    </p>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      Notes {p.noteRange[0]}–{p.noteRange[1]}
                                    </span>
                                  </div>
                                )}
                                {p.faderCount > 0 && (
                                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                      Nombre de Faders
                                    </span>
                                    <p className="text-lg text-white font-mono font-bold mt-0.5">
                                      {p.faderCount}
                                    </p>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      CC {p.ccRange[0]}–{p.ccRange[1]}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {p.ledFeedback && (
                                <div className="flex items-center gap-2 text-xs text-green-400 font-medium">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Retour LED bidirectionnel actif ({Object.keys(p.ledColors).length} couleurs)</span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })()}
                    </div>
                  </div>
                )}

                {activeTab === "llm" && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">
                        Sélectionner le Fournisseur IA
                      </p>
                      
                      {/* Grid of providers */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {LLM_PROVIDERS.map((p) => {
                          const hasKey = (llmKeys[p.id]?.key ?? "").length > 0;
                          const active = activeProvider === p.id;
                          const theme = PROVIDER_THEMES[p.id];
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setActiveProvider(p.id)}
                              className={`relative flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all hover:scale-[1.02] cursor-pointer ${
                                active
                                  ? `${theme.activeBorder} ${theme.activeBg} ${theme.glow}`
                                  : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={`w-2.5 h-2.5 rounded-full bg-current ${active ? theme.text : "text-slate-500"}`} />
                                {hasKey && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                )}
                              </div>
                              <span className={`text-xs font-bold tracking-tight ${active ? "text-white" : "text-slate-300"}`}>
                                {p.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Provider Config */}
                    <motion.div
                      key={activeProvider}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full bg-current ${PROVIDER_THEMES[currentProvider.id].text}`} />
                          <h4 className="text-white font-bold text-sm">{currentProvider.name}</h4>
                        </div>
                        <a
                          href={currentProvider.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline transition-colors"
                        >
                          Obtenir une clé API
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {currentProvider.note && (
                        <div className="text-xs text-slate-400 bg-black/25 border border-white/5 rounded-xl p-3.5 font-mono">
                          <span className="text-cyan-400 font-bold">INFO: </span>
                          {currentProvider.note}
                        </div>
                      )}

                      <div className="space-y-4">
                        <Field label="Clé API du fournisseur">
                          <div className="flex items-center gap-2">
                            <KeyField
                              value={llmKeys[currentProvider.id]?.key ?? ""}
                              onChange={(v) =>
                                setLlmKeys((prev) => ({
                                  ...prev,
                                  [currentProvider.id]: {
                                    key: v,
                                    model:
                                      prev[currentProvider.id]?.model ??
                                      currentProvider.defaultModel,
                                  },
                                }))
                              }
                              placeholder={currentProvider.keyPlaceholder}
                              className="flex-1"
                            />
                            <button
                              onClick={() => handleTestKey(currentProvider.id)}
                              disabled={
                                testStatus === "testing" ||
                                !llmKeys[currentProvider.id]?.key
                              }
                              className="shrink-0 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {testStatus === "testing" && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                              )}
                              {testStatus === "ok" && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              {testStatus === "err" && (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              {testStatus === null && (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              {testStatus === "testing"
                                ? "Test..."
                                : testStatus === "ok"
                                ? "OK"
                                : testStatus === "err"
                                ? "Erreur"
                                : "Tester"}
                            </button>
                          </div>
                        </Field>

                        <Field label="Modèle actif par défaut">
                          <select
                            value={
                              llmKeys[currentProvider.id]?.model ??
                              currentProvider.defaultModel
                            }
                            onChange={(e) =>
                              setLlmKeys((prev) => ({
                                ...prev,
                                [currentProvider.id]: {
                                  key: prev[currentProvider.id]?.key ?? "",
                                  model: e.target.value,
                                },
                              }))
                            }
                            className={inputCls}
                          >
                            {currentProvider.models.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <div className="text-xs text-slate-500 bg-black/20 rounded-xl p-3.5 border border-white/5 flex gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>Les clés API sont stockées uniquement de manière locale et sécurisée dans votre navigateur. Elles ne transitent vers le backend que de façon chiffrée.</span>
                      </div>
                    </motion.div>
                  </div>
                )}

                {activeTab === "interface" && (
                  <div className="space-y-6 max-w-xl">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                        Préférences Générales
                      </p>
                      
                      <div className="space-y-4">
                        <Field label="Fournisseur IA par défaut pour l'Assistant">
                          <select
                            value={ui.defaultProvider}
                            onChange={(e) =>
                              setUi((u) => ({
                                ...u,
                                defaultProvider: e.target.value as ProviderId,
                              }))
                            }
                            className={inputCls}
                          >
                            {LLM_PROVIDERS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <label className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-3.5 cursor-pointer hover:border-white/10 transition-colors">
                          <div>
                            <span className="text-sm text-white font-medium block">Mode Compact</span>
                            <span className="text-xs text-slate-500">Réduit l'espacement global pour afficher plus d'éléments à l'écran.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={ui.compactMode}
                            onChange={(e) =>
                              setUi((u) => ({ ...u, compactMode: e.target.checked }))
                            }
                            className="accent-cyan-500 w-4 h-4"
                          />
                        </label>

                        <label className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-3.5 cursor-pointer hover:border-white/10 transition-colors">
                          <div>
                            <span className="text-sm text-white font-medium block">Info-bulles</span>
                            <span className="text-xs text-slate-500">Affiche des aides contextuelles sur les différents boutons.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={ui.showTooltips}
                            onChange={(e) =>
                              setUi((u) => ({
                                ...u,
                                showTooltips: e.target.checked,
                              }))
                            }
                            className="accent-cyan-500 w-4 h-4"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-500/[0.03] to-purple-500/[0.03] border border-cyan-500/20 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-cyan-300 font-bold uppercase tracking-wider">
                        Raccourcis Clavier Globaux
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 mt-2">
                        <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-lg border border-white/5">
                          <span>Smart Mode</span>
                          <span><kbd className={kbd}>S</kbd></span>
                        </div>
                        <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-lg border border-white/5">
                          <span>Creator Mode</span>
                          <span><kbd className={kbd}>C</kbd></span>
                        </div>
                        <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-lg border border-white/5">
                          <span>Live Mode</span>
                          <span><kbd className={kbd}>L</kbd></span>
                        </div>
                        <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-lg border border-white/5">
                          <span>Play / Pause</span>
                          <span><kbd className={kbd}>Espace</kbd></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "backup" && (
                  <div className="space-y-6 max-w-xl">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                        Sauvegarde Automatique
                      </p>
                      
                      <div className="space-y-4">
                        <label className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-3.5 cursor-pointer hover:border-white/10 transition-colors">
                          <div>
                            <span className="text-sm text-white font-medium block">
                              Autosave automatique
                            </span>
                            <span className="text-xs text-slate-500">
                              Enregistre vos modifications périodiquement sans confirmation.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={backup.autosave}
                            onChange={(e) =>
                              setBackup((b) => ({
                                ...b,
                                autosave: e.target.checked,
                              }))
                            }
                            className="accent-cyan-500 w-4 h-4"
                          />
                        </label>

                        {backup.autosave && (
                          <Field label="Intervalle de sauvegarde">
                            <select
                              value={backup.autosaveInterval}
                              onChange={(e) =>
                                setBackup((b) => ({
                                  ...b,
                                  autosaveInterval: +e.target.value,
                                }))
                              }
                              className={inputCls}
                            >
                              <option value={1}>Toutes les minutes</option>
                              <option value={5}>Toutes les 5 minutes</option>
                              <option value={10}>Toutes les 10 minutes</option>
                              <option value={30}>Toutes les 30 minutes</option>
                            </select>
                          </Field>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-purple-400/80 font-bold uppercase tracking-wider">
                        Exportation locale
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const data = {
                            config: JSON.parse(
                              localStorage.getItem("glowlogic_config") ?? "{}",
                            ),
                            storage: JSON.parse(
                              localStorage.getItem("glow-logic-storage") ?? "{}",
                            ),
                          };
                          const blob = new Blob([JSON.stringify(data, null, 2)], {
                            type: "application/json",
                          });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `glow-logic-backup-${new Date()
                            .toISOString()
                            .slice(0, 10)}.json`;
                          a.click();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white hover:bg-white/5 hover:border-white/20 transition-all font-bold cursor-pointer"
                      >
                        <HardDrive className="w-4 h-4 text-cyan-400" />
                        Exporter la configuration locale (.json)
                      </button>
                    </div>

                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-xs text-slate-500 flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>Les fichiers de projets complets sont enregistrés dans la base SQLite locale sur le serveur. Cet export comprend uniquement votre configuration matérielle et préférences locales.</span>
                    </div>
                  </div>
                )}

                {activeTab === "safety" && (
                  <div className="space-y-6 max-w-2xl">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                          Appairage API locale
                        </p>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          Bearer token
                        </span>
                      </div>
                      <div className="bg-black/25 border border-white/5 rounded-xl p-4 text-xs text-slate-400 flex gap-2">
                        <KeyRound className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span>
                          Utilise ce token pour appairer une tablette sur le meme reseau. Le token complet n'est affiche qu'ici, sur la machine regie authentifiee.
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={authVisible ? authInfo?.token || "" : authInfo?.masked || ""}
                          className={`${inputCls} font-mono`}
                          placeholder="Token indisponible"
                        />
                        <button
                          type="button"
                          onClick={() => setAuthVisible((visible) => !visible)}
                          className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 text-slate-300 hover:text-white hover:bg-white/5"
                          title={authVisible ? "Masquer" : "Afficher"}
                        >
                          {authVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={refreshAuthInfo}
                          className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Actualiser
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateToken}
                          disabled={authBusy}
                          className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {authBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          Regenerer le token
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Origines navigateur autorisees: {(authInfo?.allowedOrigins || ["http://localhost:3000"]).join(", ")}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-amber-400/90 font-bold uppercase tracking-wider">
                        Role operateur
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {(["beginner", "expert", "admin"] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleSafetyRole(role)}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              safetyState?.operatorRole === role
                                ? "bg-amber-500/10 border-amber-500/30 text-white"
                                : "bg-black/30 border-white/5 text-slate-400 hover:bg-white/5"
                            }`}
                          >
                            <span className="block text-xs font-black uppercase tracking-widest">{role}</span>
                            <span className="block text-[11px] text-slate-500 mt-2 leading-relaxed">
                              {role === "beginner"
                                ? "Bloque les fonctions sensibles."
                                : role === "expert"
                                  ? "Autorise les tests armes en simulation."
                                  : "Preparation admin, toujours journalisee."}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-amber-400/90 font-bold uppercase tracking-wider">
                          Armement manuel
                        </p>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          Sorties physiques sensibles: bloquees MVP
                        </span>
                      </div>

                      <div className="bg-black/25 border border-white/5 rounded-xl p-4 text-xs text-slate-400 flex gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          Pour armer en simulation, passer en expert/admin et taper exactement ARM LASER, ARM PYRO, ARM DRONE ou ARM EXTERNAL_API.
                        </span>
                      </div>

                      <Field label="Confirmation d'armement">
                        <input
                          value={safetyConfirmation}
                          onChange={(e) => setSafetyConfirmation(e.target.value)}
                          placeholder="ARM LASER"
                          className={`${inputCls} font-mono uppercase`}
                        />
                      </Field>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(["laser", "pyro", "drone", "external_api"] as const).map((hazard) => {
                          const armed = !!safetyState?.armed?.[hazard];
                          return (
                            <div key={hazard} className="bg-black/30 border border-white/5 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-white font-black uppercase tracking-wider">{hazard}</span>
                                <span className={`text-[10px] font-black uppercase ${armed ? "text-amber-400" : "text-slate-500"}`}>
                                  {armed ? "Arme" : "Desarme"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleHazardArm(hazard, true)}
                                  className="py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-black transition-all"
                                >
                                  Armer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHazardArm(hazard, false)}
                                  className="py-2 rounded-lg bg-black/30 hover:bg-white/5 border border-white/10 text-slate-300 text-xs font-black transition-all"
                                >
                                  Desarmer
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
                      <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                        Regles actives
                      </p>
                      {(safetyState?.rules || []).map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between gap-3 bg-black/25 border border-white/5 rounded-xl px-4 py-3">
                          <span className="text-xs text-slate-300 font-semibold">{rule.label}</span>
                          <span className={rule.active ? "text-green-400 text-xs font-black" : "text-slate-500 text-xs font-black"}>
                            {rule.active ? "ON" : "OFF"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "license" && (
                  <div className="space-y-6 max-w-xl">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                      <p className="text-xs text-cyan-400/80 font-bold uppercase tracking-wider">
                        Activation Locale
                      </p>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between bg-black/25 border border-white/5 rounded-xl px-4 py-3">
                          <span className="text-xs text-slate-400 font-medium">Statut</span>
                          <span className={`text-xs font-black uppercase ${
                            licenseStatus?.mode === "activated"
                              ? "text-green-400"
                              : licenseStatus?.mode === "trial"
                                ? "text-cyan-400"
                                : "text-amber-400"
                          }`}>
                            {licenseStatus?.mode || "indisponible"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-black/25 border border-white/5 rounded-xl px-4 py-3">
                          <span className="text-xs text-slate-400 font-medium">Machine ID</span>
                          <span className="text-xs text-white font-mono">{licenseStatus?.machineId || "..."}</span>
                        </div>
                        <div className="flex items-center justify-between bg-black/25 border border-white/5 rounded-xl px-4 py-3">
                          <span className="text-xs text-slate-400 font-medium">Mode offline</span>
                          <span className={licenseStatus?.offlineReady ? "text-green-400 text-xs font-bold" : "text-red-400 text-xs font-bold"}>
                            {licenseStatus?.offlineReady ? "Prêt" : "Non prêt"}
                          </span>
                        </div>
                        {licenseStatus?.licenseName && (
                          <div className="flex items-center justify-between bg-black/25 border border-white/5 rounded-xl px-4 py-3">
                            <span className="text-xs text-slate-400 font-medium">Licence</span>
                            <span className="text-xs text-white font-mono">{licenseStatus.licenseName}</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-xs text-slate-400 flex gap-2">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{licenseStatus?.message || "Le statut licence sera disponible quand le backend répond."}</span>
                      </div>

                      <Field label="Clé de licence offline">
                        <textarea
                          value={licenseKey}
                          onChange={(e) => setLicenseKey(e.target.value)}
                          placeholder="GL-..."
                          className={`${inputCls} min-h-24 font-mono text-xs`}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={handleActivateLicense}
                        disabled={licenseSaving || !licenseKey.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-black transition-all"
                      >
                        {licenseSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        Activer hors ligne
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "about" && (
                  <div className="space-y-6 max-w-xl">
                    <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-cyan-500/[0.05] to-purple-500/[0.05] border border-cyan-500/25 rounded-2xl shadow-xl">
                      <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-white font-black text-xl tracking-widest leading-none">
                          GLOW LOGIC
                        </h3>
                        <p className="text-cyan-400 text-xs font-mono font-bold mt-1.5">
                          Version {APP_VERSION}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">
                          Contrôleur d'éclairage scénique intelligent avec assistant IA.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Architecture du Système
                      </p>
                      <div className="grid gap-2">
                        {(
                          [
                            ["Interface Utilisateur", "Next.js 16 · React 19 · Tailwind CSS"],
                            ["Moteur Logiciel", "Node.js · Express · Socket.IO"],
                            ["Base de données", "SQLite local (better-sqlite3)"],
                            ["Protocoles Supportés", "Art-Net (DMX) · OSC · WebMIDI API"],
                            ["Intégration Intelligence Artificielle", "OpenAI · Claude · Gemini · DeepSeek"],
                          ] as [string, string][]
                        ).map(([label, value]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between bg-black/25 border border-white/5 rounded-xl px-4 py-3"
                          >
                            <span className="text-xs text-slate-400 font-medium">{label}</span>
                            <span className="text-xs text-white font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Ressources & Support
                      </p>
                      <a
                        href="https://github.com/bobprod/Glow-logic"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between text-sm text-cyan-400 hover:text-cyan-300 px-4 py-3.5 bg-black/20 border border-white/5 rounded-xl hover:border-cyan-500/30 transition-all hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-2.5">
                          <ExternalLink className="w-4 h-4" />
                          <span className="font-semibold text-white">GitHub Project</span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">bobprod/Glow-logic</span>
                      </a>
                    </div>

                    <p className="text-[10px] text-slate-600 text-center font-medium pt-4 border-t border-white/5">
                      © {new Date().getFullYear()} Glow Logic — Distribué sous licence MIT. Open Source.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-white/[0.06] bg-black/20 px-6 py-4 flex items-center justify-between gap-3 relative z-10">
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                {saved === "ok" && (
                  <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /><span className="truncate">Configuration sauvegardée</span>
                  </motion.span>
                )}
                {saved === "err" && (
                  <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                    <AlertCircle className="w-4 h-4" /><span className="truncate">Échec de sauvegarde</span>
                  </motion.span>
                )}
                {saved === null && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-slate-500 font-mono">
                    Ctrl+S pour sauvegarder
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-400 transition-all hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-xs font-bold text-black transition-all hover:opacity-90 disabled:opacity-50 shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer hover:shadow-[0_0_22px_rgba(6,182,212,0.4)]"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      {showDmxWizard && (
        <DmxSetupWizard
          onClose={() => setShowDmxWizard(false)}
          onSuccess={(type, target) => {
            addToast({
              type: "success",
              message: `Configuration matérielle réussie (${type})`,
              detail: `Sortie redirigée vers : ${target}`,
            });
            refreshDmxAndUsbSettings();
          }}
        />
      )}
      {showMidiMapper && (
        <ApcMiniMapper
          onClose={() => setShowMidiMapper(false)}
          onSuccess={(config) => {
            addToast({
              type: "success",
              message: "Contrôleur AKAI APC mini configuré",
              detail: `LEDs: ON ${config.brightnessOn}% / OFF ${config.brightnessOff}%. Mode GO: ${config.goMode ? "actif" : "inactif"}.`,
            });
            localStorage.setItem("glowlogic_apcmini_config", JSON.stringify(config));
          }}
        />
      )}
    </motion.div>,
    document.body
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0a0c10] px-3.5 py-2.5 text-sm font-mono text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all placeholder:text-slate-600 focus:border-cyan-500/50 focus:bg-black/70 focus:outline-none";

const kbd =
  "inline-block px-1.5 py-0.5 rounded bg-white/10 text-white text-[10px] font-mono font-bold mr-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 md:gap-3 w-auto md:w-full rounded-xl border px-3 py-2 md:px-4 md:py-3 text-xs font-semibold transition-all shrink-0 cursor-pointer ${
        active
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300 shadow-[inset_0_1px_0_rgba(6,182,212,0.15)]"
          : "border-transparent text-slate-400 hover:border-white/5 hover:bg-white/[0.03] hover:text-white"
      }`}
    >
      {icon}
      <span className="truncate flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
          {badge}
        </span>
      )}
    </button>
  );
}
