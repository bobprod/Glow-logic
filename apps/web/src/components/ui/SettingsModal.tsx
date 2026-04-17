"use client";

import React, { useState, useEffect } from "react";
import useStore from "../../store/useStore";
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
  Mic,
  HardDrive,
  Info,
  RefreshCw,
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
  | "openrouter";

type Provider = {
  id: ProviderId;
  name: string;
  color: string;
  keyPlaceholder: string;
  docsUrl: string;
  models: string[];
  defaultModel: string;
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
  },
  {
    id: "gemini",
    name: "Google Gemini",
    color: "blue",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    defaultModel: "gemini-1.5-flash",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    color: "indigo",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
  },
  {
    id: "qwen",
    name: "Qwen (Alibaba)",
    color: "purple",
    keyPlaceholder: "sk-...",
    docsUrl: "https://dashscope.console.aliyun.com/apiKey",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen2.5-72b-instruct"],
    defaultModel: "qwen-plus",
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
];

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
};

const DEFAULT_MIDI: MidiConfig = {
  inputId: "",
  outputId: "",
  channel: 1,
  clockOut: false,
  controllerId: "",
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

const DEFAULT_BACKUP: BackupConfig = {
  autosave: true,
  autosaveInterval: 5,
};

const APP_VERSION = "2.0.0";

function KeyField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0a0c10] border border-white/10 rounded-lg pl-3 pr-10 py-2 text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded transition-colors"
        title={show ? "Masquer" : "Afficher"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const addToast = useStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<
    "protocol" | "midi" | "llm" | "interface" | "backup" | "about"
  >("protocol");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

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

  const scanMidi = () => {
    if (
      typeof navigator === "undefined" ||
      !("requestMIDIAccess" in navigator)
    ) {
      setMidiReady(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any)
      .requestMIDIAccess({ sysex: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((access: any) => {
        const ins: { id: string; name: string }[] = [];
        const outs: { id: string; name: string }[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        access.inputs.forEach((v: any) =>
          ins.push({ id: v.id, name: v.name ?? v.id }),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  };

  useEffect(() => {
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
  }, []);

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
      }

      const res = await fetch("http://localhost:3005/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flat),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
  const midiConnectedCount = midiInputs.length + midiOutputs.length;
  const tabMeta = {
    protocol: {
      label: "Protocoles",
      description: "OSC, Art-Net et connectivité backend.",
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
    about: {
      label: "À propos",
      description: "Version, stack et liens du projet.",
    },
  } as const;
  const activeTabMeta = tabMeta[activeTab];

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full sm:w-[440px] flex-col bg-[#0A0C10] shadow-[0_0_80px_rgba(0,0,0,0.8)] border-l sm:border border-white/10 animate-in slide-in-from-right-16 duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.15),transparent_70%)]" />

        {/* Header */}
        <div className="relative flex shrink-0 flex-col gap-4 border-b border-white/5 bg-black/20 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-white leading-tight">
                  Paramètres
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300 mr-2">
                    Système
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Configuration globale du studio
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-transparent p-2 text-slate-500 transition-all hover:bg-white/5 hover:text-white"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-white/5 bg-black/40 px-3 py-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            <TabBtn
              active={activeTab === "protocol"}
              onClick={() => setActiveTab("protocol")}
              icon={<Radio className="w-4 h-4" />}
              label="Protocoles"
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
              active={activeTab === "about"}
              onClick={() => setActiveTab("about")}
              icon={<Info className="w-4 h-4" />}
              label="À propos"
            />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)] p-5 sm:p-6">
          <div className="mb-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-400/80">
                {activeTabMeta.label}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {activeTabMeta.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <InfoChip
                tone={
                  saved === "ok" ? "green" : saved === "err" ? "red" : "slate"
                }
              >
                {saved === "ok"
                  ? "Sauvegarde OK"
                  : saved === "err"
                    ? "Erreur de sauvegarde"
                    : "Modifications locales"}
              </InfoChip>
              <InfoChip tone="slate">Ctrl+S pour sauvegarder</InfoChip>
            </div>
          </div>

          {activeTab === "protocol" && (
            <div className="space-y-5 max-w-lg">
              <div>
                <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest mb-3">
                  QLC+ / OSC
                </p>
                <div className="space-y-3">
                  <Field label="QLC+ Host IP">
                    <input
                      type="text"
                      value={cfg.qlcHost}
                      onChange={(e) =>
                        setCfg((c) => ({ ...c, qlcHost: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="OSC In Port">
                      <input
                        type="number"
                        value={cfg.oscPort}
                        onChange={(e) =>
                          setCfg((c) => ({ ...c, oscPort: +e.target.value }))
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Web API Port">
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

              <div>
                <p className="text-xs text-purple-400/70 font-bold uppercase tracking-widest mb-3">
                  Art-Net
                </p>
                <Field label="Universe par défaut">
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

              <div className="bg-black/30 rounded-lg p-3 border border-white/5 space-y-1.5">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">
                  Statut
                </p>
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Backend : localhost:3005
                </div>
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  QLC+ OSC → {cfg.qlcHost}:{cfg.oscPort}
                </div>
              </div>
            </div>
          )}

          {activeTab === "llm" && (
            <div className="flex gap-4 h-full min-h-[400px]">
              {/* Provider list */}
              <div className="w-56 shrink-0 space-y-1">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">
                  Fournisseurs
                </p>
                {LLM_PROVIDERS.map((p) => {
                  const hasKey = (llmKeys[p.id]?.key ?? "").length > 0;
                  const active = activeProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActiveProvider(p.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "text-slate-300 hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span className="font-semibold">{p.name}</span>
                      {hasKey && (
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Provider detail */}
              <div className="flex-1 space-y-4 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-base">
                    {currentProvider.name}
                  </h3>
                  <a
                    href={currentProvider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    Obtenir une clé
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {currentProvider.note && (
                  <div className="text-xs text-slate-400 bg-black/30 border border-white/5 rounded-lg p-2">
                    {currentProvider.note}
                  </div>
                )}

                <Field label="Clé API">
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
                  />
                </Field>

                <Field label="Modèle par défaut">
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

                <div className="text-xs text-slate-500 bg-black/20 rounded-lg p-3 border border-white/5">
                  <AlertCircle className="w-4 h-4 inline mr-1 text-amber-400" />
                  Les clés sont stockées localement et envoyées chiffrées au
                  backend. Elles sont masquées côté serveur.
                </div>
              </div>
            </div>
          )}

          {activeTab === "interface" && (
            <div className="space-y-5 max-w-lg">
              <div>
                <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest mb-3">
                  Préférences
                </p>
                <div className="space-y-3">
                  <Field label="Fournisseur IA par défaut">
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

                  <label className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-2.5 cursor-pointer hover:border-white/10">
                    <span className="text-sm text-white">Mode compact</span>
                    <input
                      type="checkbox"
                      checked={ui.compactMode}
                      onChange={(e) =>
                        setUi((u) => ({ ...u, compactMode: e.target.checked }))
                      }
                      className="accent-cyan-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-2.5 cursor-pointer hover:border-white/10">
                    <span className="text-sm text-white">
                      Afficher les info-bulles
                    </span>
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

              <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-lg p-4">
                <p className="text-xs text-cyan-300 font-bold mb-1">
                  Raccourcis clavier
                </p>
                <div className="text-xs text-slate-300 space-y-1 mt-2">
                  <div>
                    <kbd className={kbd}>S</kbd> Smart mode
                  </div>
                  <div>
                    <kbd className={kbd}>C</kbd> Creator mode
                  </div>
                  <div>
                    <kbd className={kbd}>L</kbd> Live mode
                  </div>
                  <div>
                    <kbd className={kbd}>Space</kbd> Play/Pause
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "midi" && (
            <div className="space-y-5 max-w-lg">
              <div className="flex items-center justify-between">
                <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest">
                  Périphériques MIDI
                </p>
                <button
                  type="button"
                  onClick={scanMidi}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualiser
                </button>
              </div>

              {midiReady === false && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Web MIDI API non disponible. Utilisez Chrome ou Edge.
                </div>
              )}

              {midiReady === true &&
                midiInputs.length === 0 &&
                midiOutputs.length === 0 && (
                  <div className="text-xs text-slate-500 bg-black/20 border border-white/5 rounded-lg p-3">
                    Aucun périphérique MIDI détecté. Branchez votre interface
                    puis cliquez sur Actualiser.
                  </div>
                )}

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

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-2.5 cursor-pointer hover:border-white/10">
                    <span className="text-xs text-white">MIDI Clock OUT</span>
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

              <div className="bg-black/30 rounded-lg p-3 border border-white/5 text-xs text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-cyan-400/70 shrink-0" />
                  <span>
                    MIDI IN alimente le MIDI Learn dans tous les modes.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400/70 shrink-0" />
                  <span>
                    MIDI Clock OUT synchronise QLC+, Ableton, etc. sur le BPM
                    interne.
                  </span>
                </div>
              </div>

              {/* Controller Profile Section */}
              <div className="border-t border-white/10 pt-5 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-purple-400/70 font-bold uppercase tracking-widest">
                    Profil contrôleur
                  </p>
                  {detectedProfile && (
                    <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Détecté : {detectedProfile.name}
                    </span>
                  )}
                </div>

                <Field label="Contrôleur MIDI">
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
                    <option value="">-- Sélectionner --</option>
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
                      <div className="mt-3 space-y-3">
                        <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="text-white font-bold text-sm">
                                {p.brand} {p.name}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1">
                                {p.description}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                p.type === "pad"
                                  ? "bg-cyan-500/20 text-cyan-300"
                                  : p.type === "fader"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {p.type === "pad"
                                ? "Pads"
                                : p.type === "fader"
                                  ? "Faders"
                                  : "Hybride"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3">
                            {p.padCount > 0 && (
                              <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                  Pads
                                </span>
                                <p className="text-sm text-white font-mono font-bold">
                                  {p.padCount}
                                </p>
                                <span className="text-[10px] text-slate-500">
                                  Note {p.noteRange[0]}–{p.noteRange[1]}
                                </span>
                              </div>
                            )}
                            {p.faderCount > 0 && (
                              <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                  Faders
                                </span>
                                <p className="text-sm text-white font-mono font-bold">
                                  {p.faderCount}
                                </p>
                                <span className="text-[10px] text-slate-500">
                                  CC {p.ccRange[0]}–{p.ccRange[1]}
                                </span>
                              </div>
                            )}
                          </div>

                          {p.ledFeedback && (
                            <div className="flex items-center gap-2 mt-3 text-xs text-green-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              LED Feedback activé —{" "}
                              {Object.keys(p.ledColors).length} couleurs
                            </div>
                          )}
                          {!p.ledFeedback && (
                            <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Pas de LED feedback sur ce contrôleur
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 bg-black/20 rounded-lg p-3 border border-white/5">
                          <p className="font-semibold text-white mb-1">
                            Mapping automatique :
                          </p>
                          <ul className="space-y-1 ml-3 list-disc list-outside">
                            {p.padCount > 0 && (
                              <li>Pads → Trigger de scènes (Note On/Off)</li>
                            )}
                            {p.faderCount > 0 && (
                              <li>Faders → Dimmers / Zones (CC)</li>
                            )}
                            {p.padCount > 0 && p.faderCount > 0 && (
                              <li>Dernier fader → Crossfader A↔B</li>
                            )}
                            {p.ledFeedback && (
                              <li>LEDs → Feedback visuel des scènes actives</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="space-y-5 max-w-lg">
              <div>
                <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest mb-3">
                  Sauvegarde automatique
                </p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-3 cursor-pointer hover:border-white/10">
                    <div>
                      <span className="text-sm text-white block">
                        Sauvegarde automatique
                      </span>
                      <span className="text-xs text-slate-500">
                        Sauvegarde le projet en cours périodiquement
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

              <div>
                <p className="text-xs text-purple-400/70 font-bold uppercase tracking-widest mb-3">
                  Export manuel
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-black/30 border border-white/10 text-sm text-white hover:bg-white/5 hover:border-white/20 transition-all font-semibold"
                >
                  <HardDrive className="w-4 h-4" />
                  Exporter la configuration
                </button>
              </div>

              <div className="bg-black/30 rounded-lg p-3 border border-white/5 text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 inline mr-1 text-amber-400" />
                Les projets sont sauvegardés en base SQLite côté serveur.
                L&apos;export télécharge uniquement la configuration locale.
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-5 max-w-lg">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg tracking-widest">
                    GLOW LOGIC
                  </h3>
                  <p className="text-cyan-400 text-sm font-mono">
                    v{APP_VERSION}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Contrôleur d&apos;éclairage live intelligent
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">
                  Stack technique
                </p>
                {(
                  [
                    ["Frontend", "Next.js 16 · React · Tailwind"],
                    ["Backend", "Node.js · Express · Socket.IO"],
                    ["Base de données", "SQLite (better-sqlite3)"],
                    ["Protocoles", "Art-Net · OSC · WebMIDI"],
                    ["IA / LLM", "OpenAI · Claude · Gemini · …"],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-2"
                  >
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="text-xs text-white font-mono">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">
                  Liens
                </p>
                <a
                  href="https://github.com/bobprod/Glow-logic"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 px-3 py-2 bg-black/30 border border-white/5 rounded-lg hover:border-cyan-500/30 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  GitHub — bobprod/Glow-logic
                </a>
              </div>

              <p className="text-xs text-slate-600 text-center">
                © {new Date().getFullYear()} Glow Logic — Open Source
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-white/10 bg-black/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            {saved === "ok" && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Configuration sauvegardée et synchronisée.
              </span>
            )}
            {saved === "err" && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertCircle className="w-4 h-4" />
                Échec de la sauvegarde côté client ou backend.
              </span>
            )}
            {saved === null && (
              <span>
                Les changements sont appliqués à ce poste et peuvent être
                envoyés au backend.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:bg-white/5"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-black transition-all shadow-[0_0_18px_rgba(6,182,212,0.28)] hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
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

function InfoChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "cyan" | "green" | "purple" | "red" | "slate";
}) {
  const tones = {
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    green: "border-green-500/20 bg-green-500/10 text-green-300",
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    slate: "border-white/10 bg-white/5 text-slate-300",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
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
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
        active
          ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.10)]"
          : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="ml-1 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">
          {badge}
        </span>
      )}
    </button>
  );
}
