"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../lib/config";
import {
  FIXTURE_CATEGORY_LIST,
  inferFixtureCategory,
  type FixtureCategoryId,
  type FixtureGroup,
} from "../lib/fixtureCategories";
import {
  Upload, Loader2, Save, Trash2, Plus, Wand2,
  FileImage, AlertCircle, CheckCircle2, X, ArrowLeft,
  Sparkles, Cpu, RefreshCw, Eye,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
const DMX_TYPES = [
  "dimmer","red","green","blue","white","amber","uv",
  "pan","tilt","pan_fine","tilt_fine","gobo","color_wheel",
  "strobe","shutter","zoom","focus","iris","prism",
  "speed","macro","sound","reset","other",
] as const;

type DmxType = (typeof DMX_TYPES)[number];

interface DmxChannel {
  channel: number;
  function: string;
  type: DmxType;
  minValue?: number;
  maxValue?: number;
  notes?: string;
}

interface AiFixtureMode {
  name: string;
  channels: DmxChannel[];
}

interface AiFixtureResult {
  manufacturer: string;
  model: string;
  modes: AiFixtureMode[];
  provider: string;
  usedVision: boolean;
}

interface ScanInfo {
  usedAI: boolean;
  aiProvider: string | null;
  imageCount?: number;
  fallbackReason: "no_key" | "rate_limit" | "timeout" | "network" | "parse_error" | "model_error" | null;
}

interface ScanResponse {
  channels: DmxChannel[];
  rawText: string;
  confidence: number;
  fixtureName?: string;
  totalChannels: number;
  ai?: AiFixtureResult;
  scanInfo?: ScanInfo;
}

interface Fixture {
  id: number;
  name: string;
  manufacturer: string | null;
  total_channels: number;
  start_address: number;
  updated_at: string;
}

type ScanPhase = "idle" | "ocr" | "ai" | "done";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "GPT-4o",
  anthropic: "Claude",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  nvidia: "NVIDIA NIM",
  huggingface: "HuggingFace",
  openrouter: "OpenRouter",
  opencode: "OpenCode",
};

// ─── Libellés FR des groupes d'équipement ────────────────────────
const FIXTURE_GROUP_LABELS: Record<FixtureGroup, string> = {
  movement: "Mouvement",
  static: "Lumière statique",
  effect: "Effets",
  video: "Vidéo",
};
const FIXTURE_GROUP_ORDER: FixtureGroup[] = ["movement", "static", "effect", "video"];

// ─── Props optionnelles (mode embarqué dans PatchPanel) ──────────
interface FixturesPageProps {
  onSaved?: (data: { id: number; name: string; totalChannels: number; startAddress: number }) => void;
  embedded?: boolean;
}

// ─── Composant principal ─────────────────────────────────────────
export default function FixturesPage({ onSaved, embedded }: FixturesPageProps = {}) {
  const router = useRouter();

  // État scan
  const [scanPhase, setScanPhase]   = useState<ScanPhase>("idle");
  const [previews, setPreviews]     = useState<string[]>([]);
  const [rawOcrText, setRawOcrText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [aiResult, setAiResult]     = useState<AiFixtureResult | null>(null);
  const [scanInfo, setScanInfo]     = useState<ScanInfo | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [lastImageFiles, setLastImageFiles] = useState<File[]>([]);
  const [allModes, setAllModes]     = useState<AiFixtureMode[]>([]);

  // État éditeur
  const [channels, setChannels]         = useState<DmxChannel[]>([]);
  const [fixtureName, setFixtureName]   = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [notes, setNotes]               = useState("");
  const [startAddress, setStartAddress] = useState(1);
  const [currentFixtureId, setCurrentFixtureId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Catégorie d'équipement (type de matériel). undefined ⇒ on laisse l'inférence
  // proposer une valeur. categoryManual=true dès que l'utilisateur choisit lui-même.
  const [category, setCategory] = useState<FixtureCategoryId | undefined>(undefined);
  const [categoryManual, setCategoryManual] = useState(false);

  // État UI
  const [fixtures, setFixtures]   = useState<Fixture[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [showTips, setShowTips]   = useState(true);
  const [showRaw, setShowRaw]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Bibliothèque ──────────────────────────────────────────────
  const loadFixtures = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fixtures`);
      if (res.ok) setFixtures(await res.json());
    } catch { /* offline */ }
  }, []);

  useEffect(() => { loadFixtures(); }, [loadFixtures]);

  // ─── Sélection de mode IA ──────────────────────────────────────
  const applyMode = useCallback((modeName: string) => {
    if (!aiResult) return;
    const mode = aiResult.modes.find((m) => m.name === modeName);
    if (mode) {
      setChannels(mode.channels);
      setSelectedMode(modeName);
    }
  }, [aiResult]);

  // ─── Pré-remplissage de la catégorie (inférence, sans écraser un choix manuel) ─
  useEffect(() => {
    if (categoryManual) return; // l'utilisateur a tranché : on n'y touche plus
    const inferred = inferFixtureCategory(fixtureName, channels.map((c) => c.type));
    setCategory(inferred);
  }, [fixtureName, channels, categoryManual]);

  // ─── Helper : lire la config LLM depuis localStorage ──────────
  const readLLMConfig = (): { provider: string; key: string; model: string; baseURL: string; apiFormat: string } | null => {
    try {
      const llmKeys  = JSON.parse(localStorage.getItem("glowlogic_llm") ?? "{}") as Record<string, { key: string; model: string }>;
      const uiPrefs  = JSON.parse(localStorage.getItem("glowlogic_ui") ?? "{}") as { defaultProvider?: string };
      const provider = uiPrefs.defaultProvider || "openai";
      const entry    = llmKeys[provider];
      if (!entry?.key) {
        // Chercher n'importe quel provider avec une clé
        for (const [id, val] of Object.entries(llmKeys)) {
          if (val?.key) return buildProviderConfig(id, val.key, val.model || "");
        }
        return null;
      }
      return buildProviderConfig(provider, entry.key, entry.model || "");
    } catch { return null; }
  };

  const PROVIDER_META: Record<string, { baseURL: string; apiFormat: string; defaultModel: string }> = {
    openai:      { baseURL: "https://api.openai.com/v1/chat/completions",          apiFormat: "openai-compatible", defaultModel: "gpt-4o" },
    anthropic:   { baseURL: "https://api.anthropic.com/v1/messages",               apiFormat: "anthropic",         defaultModel: "claude-3-5-sonnet-20241022" },
    gemini:      { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiFormat: "openai-compatible", defaultModel: "gemini-1.5-flash" },
    deepseek:    { baseURL: "https://api.deepseek.com/v1/chat/completions",        apiFormat: "openai-compatible", defaultModel: "deepseek-chat" },
    qwen:        { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", apiFormat: "openai-compatible", defaultModel: "qwen-plus" },
    nvidia:      { baseURL: "https://integrate.api.nvidia.com/v1/chat/completions",apiFormat: "openai-compatible", defaultModel: "meta/llama-3.3-70b-instruct" },
    openrouter:  { baseURL: "https://openrouter.ai/api/v1/chat/completions",       apiFormat: "openai-compatible", defaultModel: "anthropic/claude-3.5-sonnet" },
    opencode:    { baseURL: "https://opencode.ai/zen/go/v1/chat/completions",      apiFormat: "openai-compatible", defaultModel: "kimi-k2.6" },
    huggingface: { baseURL: "https://api-inference.huggingface.co/v1/chat/completions", apiFormat: "openai-compatible", defaultModel: "meta-llama/Llama-3.3-70B-Instruct" },
  };

  function buildProviderConfig(id: string, key: string, model: string) {
    const meta = PROVIDER_META[id] || { baseURL: "", apiFormat: "openai-compatible", defaultModel: "" };
    return { provider: id, key, model: model || meta.defaultModel, baseURL: meta.baseURL, apiFormat: meta.apiFormat };
  }

  // ─── Compression image avant envoi (max 1600px, qualité 85%) ──
  const compressImage = (file: File): Promise<Blob> =>
    new Promise((resolve) => {
      const MAX_PX = 1280;
      const QUALITY = 0.82;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > MAX_PX || height > MAX_PX) {
          if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
          else                { width  = Math.round(width  * MAX_PX / height); height = MAX_PX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", QUALITY);
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });

  // ─── Scan principal (multi-images) ─────────────────────────────
  const handleFiles = async (fileList: File[]) => {
    setError(null);
    setSuccess(null);
    setAiResult(null);
    setSelectedMode("");

    const imgs = fileList.filter((f) => f.type.startsWith("image/")).slice(0, 8);
    if (imgs.length === 0) {
      setError("Merci de sélectionner au moins une image (PNG, JPG, WebP...)");
      return;
    }

    setLastImageFiles(imgs);

    // Prévisualisations
    const previewUrls = await Promise.all(
      imgs.map((f) => new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target?.result as string);
        r.readAsDataURL(f);
      })),
    );
    setPreviews(previewUrls);

    setScanPhase("ocr");

    try {
      // Compresser chaque image (réduit payload, évite timeouts)
      const compressed = await Promise.all(
        imgs.map(async (f) => {
          const blob = await compressImage(f);
          return new File([blob], f.name, { type: "image/jpeg" });
        }),
      );

      const formData = new FormData();
      compressed.forEach((f) => formData.append("images", f));

      const llmCfg = readLLMConfig();
      if (llmCfg) {
        formData.append("llmProvider",  llmCfg.provider);
        formData.append("llmKey",       llmCfg.key);
        formData.append("llmModel",     llmCfg.model);
        formData.append("llmBaseURL",   llmCfg.baseURL);
        formData.append("llmApiFormat", llmCfg.apiFormat);
      }

      // Vision peut être lente : on bascule visuellement sur "ai" pendant l'attente
      setScanPhase("ai");

      const res = await fetch(`${API_BASE}/api/fixtures/scan`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ScanResponse = await res.json();

      setRawOcrText(data.rawText || "");
      setConfidence(data.confidence ?? null);
      if (data.scanInfo) setScanInfo(data.scanInfo);

      const imgCount = data.scanInfo?.imageCount ?? imgs.length;

      if (data.ai) {
        setAiResult(data.ai);
        setAllModes(data.ai.modes);
        const firstMode = data.ai.modes[0];
        setChannels(firstMode.channels);
        setSelectedMode(firstMode.name);
        if (!fixtureName && data.ai.model)         setFixtureName(data.ai.model);
        if (!manufacturer && data.ai.manufacturer)  setManufacturer(data.ai.manufacturer);
        const providerLabel = PROVIDER_LABELS[data.ai.provider] || data.ai.provider;
        const visionTag = data.ai.usedVision ? "Vision" : "Texte";
        setSuccess(
          `IA ${visionTag} (${providerLabel}) · ${imgCount} image(s) · ${data.ai.modes.length} mode(s) · ${firstMode.channels.length} channels`
        );
      } else {
        setChannels(data.channels || []);
        if (!fixtureName && data.fixtureName) {
          setFixtureName(data.fixtureName);
        } else if (!fixtureName && data.channels?.length > 0) {
          // Génère un nom par défaut si l'OCR n'a pas trouvé le nom
          setFixtureName(`Fixture ${data.channels.length}ch`);
        }
        const n = data.channels?.length || 0;
        const conf = data.confidence?.toFixed(0) || "?";
        const fallback = data.scanInfo?.fallbackReason;

        if (n === 0 && !fallback) {
          setError("Aucun channel détecté. Essaye une photo plus nette ou édite manuellement.");
        } else if (fallback === "no_key") {
          setSuccess(`OCR — ${n} channels (${conf}%). Configure une clé IA dans Settings pour de meilleurs résultats.`);
        } else if (fallback === "rate_limit") {
          setError(`Limite API IA atteinte — OCR utilisé (${n} channels). Réessaie dans quelques secondes.`);
        } else if (fallback === "timeout") {
          setError(`IA trop lente — OCR utilisé (${n} channels). Réessaie, ou choisis un modèle plus rapide dans Settings.`);
        } else if (fallback === "network") {
          setError(`Erreur réseau vers l'IA — OCR utilisé (${n} channels). Vérifie ta connexion.`);
        } else if (fallback === "parse_error") {
          setError(`L'IA a répondu un format invalide — OCR utilisé (${n} channels). Réessaie.`);
        } else if (fallback) {
          setError(`IA indisponible (${fallback}) — OCR utilisé (${n} channels).`);
        } else {
          setSuccess(`OCR: ${n} channels (${conf}%)`);
        }
      }
    } catch (err) {
      setError(`Erreur scan: ${err instanceof Error ? err.message : "inconnue"}. Vérifie que le serveur tourne.`);
    } finally {
      setScanPhase("done");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) handleFiles(files);
  };

  // ─── Édition channels ──────────────────────────────────────────
  const updateChannel = (idx: number, patch: Partial<DmxChannel>) =>
    setChannels((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const removeChannel = (idx: number) =>
    setChannels((prev) => prev.filter((_, i) => i !== idx));

  const addChannel = () => {
    const nextNum = Math.max(0, ...channels.map((c) => c.channel)) + 1;
    setChannels((prev) => [...prev, { channel: nextNum, function: "", type: "other" }]);
  };

  // ─── Sauvegarde ────────────────────────────────────────────────
  const saveFixture = async () => {
    setError(null); setSuccess(null);
    if (!fixtureName.trim()) { setError("Donne un nom à la fixture avant de sauvegarder."); return; }
    if (channels.length === 0) { setError("Aucun channel à sauvegarder."); return; }
    setSaveState("saving");
    try {
      // Construire les modes à sauvegarder
      const modesPayload = allModes.length > 0
        ? allModes.map((m) => m.name === selectedMode ? { ...m, channels } : m)
        : [{ name: selectedMode || "Default", channels }];

      const res = await fetch(`${API_BASE}/api/fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:           currentFixtureId || undefined,
          name:         fixtureName,
          manufacturer: manufacturer || undefined,
          channels,
          notes:        notes || undefined,
          startAddress,
          category:     category || undefined,
          modes:        modesPayload,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      if (!currentFixtureId && saved.id) setCurrentFixtureId(saved.id);
      setSuccess(currentFixtureId ? "Fixture mise à jour !" : "Fixture sauvegardée !");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      await loadFixtures();
      // Callback mode embarqué → déclenche le panneau "Patcher"
      if (onSaved && saved.id) {
        onSaved({ id: saved.id, name: fixtureName, totalChannels: channels.length, startAddress });
      }
    } catch (err) {
      setError(`Erreur sauvegarde: ${err instanceof Error ? err.message : "inconnue"}`);
      setSaveState("idle");
    }
  };

  const loadFixture = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/fixtures/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCurrentFixtureId(data.id);
      setFixtureName(data.name);
      setManufacturer(data.manufacturer || "");
      setNotes(data.notes || "");
      setChannels(data.channels || []);
      setStartAddress(data.start_address ?? 1);
      // Restaurer la catégorie sauvegardée (choix explicite ⇒ figé contre l'inférence)
      if (data.category) {
        setCategory(data.category as FixtureCategoryId);
        setCategoryManual(true);
      } else {
        setCategoryManual(false);
      }
      // Restaurer les modes si sauvegardés
      if (data.modes?.length > 0) {
        setAllModes(data.modes);
        setSelectedMode(data.modes[0].name);
        // Reconstruire un AiFixtureResult minimal pour afficher le sélecteur de modes
        if (data.modes.length > 1) {
          setAiResult({
            manufacturer: data.manufacturer || "",
            model: data.name,
            modes: data.modes,
            provider: "saved",
            usedVision: false,
          });
        }
      } else {
        setAllModes([]);
        setAiResult(null);
        setSelectedMode("");
      }
      setPreviews([]); setRawOcrText(""); setScanInfo(null); setLastImageFiles([]);
      setSuccess(`Fixture "${data.name}" chargée — adresse ${data.start_address ?? 1}.`);
      setScanPhase("done");
    } catch { setError("Chargement impossible."); }
  };

  const removeFixture = async (id: number) => {
    if (!confirm("Supprimer cette fixture ?")) return;
    try {
      await fetch(`${API_BASE}/api/fixtures/${id}`, { method: "DELETE" });
      await loadFixtures();
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setChannels([]); setPreviews([]); setRawOcrText("");
    setFixtureName(""); setManufacturer(""); setNotes("");
    setConfidence(null); setError(null); setSuccess(null);
    setAiResult(null); setScanInfo(null); setSelectedMode("");
    setAllModes([]); setStartAddress(1); setCurrentFixtureId(null);
    setScanPhase("idle"); setLastImageFiles([]);
    setCategory(undefined); setCategoryManual(false);
  };

  const sortChannels = () =>
    setChannels((prev) => [...prev].sort((a, b) => a.channel - b.channel));

  const reAnalyzeWithAI = async () => {
    if (lastImageFiles.length === 0) return;
    await handleFiles(lastImageFiles);
  };

  // ─── Phase label ───────────────────────────────────────────────
  const isScanning = scanPhase === "ocr" || scanPhase === "ai";

  // ─── Config LLM détectée (après mount pour éviter mismatch SSR) ─
  const [detectedLLM, setDetectedLLM] = useState<ReturnType<typeof readLLMConfig>>(null);
  useEffect(() => {
    setDetectedLLM(readLLMConfig());
  // read once after mount to avoid SSR/localStorage mismatch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-full bg-[#0a0c10] text-gray-100 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">

        {/* HEADER — masqué en mode embarqué */}
        {!embedded && <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push("/")}
              className="mt-1 flex items-center gap-1 text-slate-300 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/60 px-3 py-2 rounded-lg transition text-xs font-bold"
            >
              <ArrowLeft size={14} /> Dashboard
            </button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-wider text-white flex items-center gap-3">
                <Wand2 className="text-cyan-400" size={28} />
                SCAN FIXTURE IA
              </h1>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
                Photo du manuel → OCR + LLM Vision → patch DMX automatique
                {detectedLLM ? (
                  <span className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Sparkles size={10} />
                    IA : {PROVIDER_LABELS[detectedLLM.provider] || detectedLLM.provider} · {detectedLLM.model}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-500/20"
                    onClick={() => router.push("/?settings=llm")}
                    title="Configurer une clé LLM dans Settings"
                  >
                    <AlertCircle size={10} />
                    Pas de clé IA — Settings → IA &amp; LLM
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="text-slate-400 hover:text-white text-xs border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition shrink-0"
          >
            Nouveau scan
          </button>
        </div>}

        {/* TIPS */}
        {showTips && (
          <div className="mb-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4 relative">
            <button onClick={() => setShowTips(false)} className="absolute top-2 right-2 text-slate-500 hover:text-white">
              <X size={16} />
            </button>
            <h3 className="text-cyan-400 font-bold text-sm mb-2 flex items-center gap-2">
              <Sparkles size={14} /> Tips — Meilleure qualité de scan
            </h3>
            <ul className="text-slate-300 text-xs space-y-1 ml-5 list-disc">
              <li>Cadre <strong>uniquement</strong> le tableau des DMX channels de ton manuel.</li>
              <li>Éclairage uniforme, sans reflet ni ombre sur la page.</li>
              <li>Photo droite, de face — résolution min ~1200px de large.</li>
              <li>Le LLM détecte <strong>tous les modes</strong> (5CH, 7CH, 15CH...) automatiquement.</li>
              <li>Configure ta clé API dans <strong>Settings → IA & LLM</strong> pour activer l'analyse IA.</li>
            </ul>
          </div>
        )}

        {/* MESSAGES */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg flex gap-2 items-start text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-500/10 border border-green-500/40 text-green-300 px-4 py-3 rounded-lg flex gap-2 items-start text-sm">
            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COL 1 : Upload + Bibliothèque */}
          <div className="lg:col-span-1 space-y-4">

            {/* Zone d'upload */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => !isScanning && fileInputRef.current?.click()}
              className={`bg-[#12141a] border-2 border-dashed rounded-xl p-8 text-center transition ${
                isScanning ? "cursor-wait border-cyan-500/50" : "cursor-pointer border-slate-700 hover:border-cyan-500/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) handleFiles(fs); }}
                className="hidden"
              />

              {isScanning ? (
                <>
                  <Loader2 className="mx-auto text-cyan-400 animate-spin mb-3" size={36} />
                  <div className="space-y-2">
                    <div className={`flex items-center justify-center gap-2 text-sm ${scanPhase === "ocr" ? "text-cyan-300 font-semibold" : "text-slate-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${scanPhase === "ocr" ? "bg-cyan-400 animate-pulse" : "bg-slate-600"}`} />
                      Phase 1 — OCR Tesseract
                    </div>
                    <div className={`flex items-center justify-center gap-2 text-sm ${scanPhase === "ai" ? "text-purple-300 font-semibold" : "text-slate-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${scanPhase === "ai" ? "bg-purple-400 animate-pulse" : "bg-slate-600"}`} />
                      Phase 2 — Analyse IA
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-3">
                    {scanPhase === "ocr"
                      ? `Lecture OCR de ${previews.length} image(s)...`
                      : "Le LLM génère le patch DMX (peut prendre 30-90s)..."}
                  </p>
                </>
              ) : scanPhase === "done" && scanInfo ? (
                <div className="space-y-2 text-xs w-full">
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <CheckCircle2 size={13} />
                    <span>Phase 1 — OCR ({confidence?.toFixed(0) ?? "?"}%)</span>
                  </div>
                  <div className={`flex items-center justify-center gap-2 ${
                    scanInfo.usedAI ? "text-green-400"
                    : scanInfo.fallbackReason === "no_key" ? "text-slate-500"
                    : "text-amber-400"
                  }`}>
                    {scanInfo.usedAI
                      ? <CheckCircle2 size={13} />
                      : scanInfo.fallbackReason === "no_key"
                        ? <span className="text-[11px]">—</span>
                        : <AlertCircle size={13} />}
                    <span>
                      Phase 2 — {scanInfo.usedAI
                        ? `IA OK`
                        : scanInfo.fallbackReason === "no_key" ? "Pas de clé IA"
                        : scanInfo.fallbackReason === "rate_limit" ? "Rate limit → OCR"
                        : scanInfo.fallbackReason === "timeout" ? "Timeout → OCR"
                        : scanInfo.fallbackReason === "network" ? "Réseau → OCR"
                        : "IA indispo → OCR"}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[10px] mt-1">Clique pour scanner de nouvelles photos</p>
                </div>
              ) : previews.length > 0 ? (
                <>
                  <FileImage className="mx-auto text-cyan-400" size={32} />
                  <p className="text-slate-300 text-sm mt-2 font-semibold">{previews.length} image(s) chargée(s)</p>
                  <p className="text-slate-500 text-xs">Clique pour en choisir d&apos;autres</p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto text-slate-500 mb-3" size={36} />
                  <p className="text-slate-300 text-sm font-semibold">Glisse une ou plusieurs photos</p>
                  <p className="text-slate-500 text-xs mt-1">Multi-pages OK (max 8) · clique pour sélectionner</p>
                </>
              )}
            </div>

            {/* Prévisualisations (grille si plusieurs) */}
            {previews.length > 0 && (
              <div className={`grid gap-2 ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {previews.map((src, i) => (
                  <div key={i} className="bg-[#12141a] border border-[#262c36] rounded-lg overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Page ${i + 1}`} className="w-full object-contain max-h-48" />
                    {previews.length > 1 && (
                      <span className="absolute top-1 left-1 bg-black/70 text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {i + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Confiance OCR */}
            {confidence !== null && (
              <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-3 text-xs text-slate-400">
                <div className="flex justify-between mb-1">
                  <span>Confiance OCR</span>
                  <span className={confidence > 70 ? "text-green-400" : confidence > 40 ? "text-yellow-400" : "text-red-400"}>
                    {confidence.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                  <div
                    className={`h-full transition-all ${confidence > 70 ? "bg-green-500" : confidence > 40 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bibliothèque */}
            <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-4">
              <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
                Ma bibliothèque ({fixtures.length})
              </h3>
              {fixtures.length === 0 ? (
                <p className="text-slate-600 text-xs">Aucune fixture enregistrée.</p>
              ) : (
                <ul className="space-y-1 max-h-56 overflow-y-auto">
                  {fixtures.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between group hover:bg-slate-800/40 rounded px-2 py-1.5 cursor-pointer"
                      onClick={() => loadFixture(f.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{f.name}</div>
                        <div className="text-slate-500 text-[10px]">
                          {f.manufacturer ? `${f.manufacturer} · ` : ""}{f.total_channels} ch
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFixture(f.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* COL 2+3 : Éditeur */}
          <div className="lg:col-span-2 space-y-4">

            {/* Carte résumé IA */}
            {aiResult && (
              <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 bg-purple-500/20 rounded-lg">
                      <Cpu size={16} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        {aiResult.manufacturer && aiResult.model
                          ? `${aiResult.manufacturer} — ${aiResult.model}`
                          : aiResult.manufacturer || aiResult.model || "Fixture détectée"}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {aiResult.modes.length} mode(s) détecté(s) · Vision {PROVIDER_LABELS[aiResult.provider] || aiResult.provider}
                      </p>
                    </div>
                  </div>
                  {/* Sélecteur de modes (si > 1) */}
                  {aiResult.modes.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {aiResult.modes.map((m) => (
                        <button
                          key={m.name}
                          onClick={() => applyMode(m.name)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            selectedMode === m.name
                              ? "bg-purple-500/30 border-purple-400/60 text-purple-200"
                              : "bg-white/5 border-white/10 text-slate-400 hover:border-purple-500/40 hover:text-white"
                          }`}
                        >
                          {m.name}
                          <span className="ml-1 opacity-60">({m.channels.length}ch)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bouton Ré-analyser (visible si images déjà scannées) */}
            {lastImageFiles.length > 0 && scanPhase === "done" && (
              <div className="flex justify-end">
                <button
                  onClick={reAnalyzeWithAI}
                  disabled={isScanning}
                  className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 rounded-lg transition-all"
                >
                  <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
                  Ré-analyser avec IA
                </button>
              </div>
            )}

            {/* Métadonnées */}
            <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Nom de la fixture *
                </label>
                <input
                  value={fixtureName}
                  onChange={(e) => setFixtureName(e.target.value)}
                  placeholder="Ex : Intimidator Spot 360"
                  className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none transition"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Fabricant
                </label>
                <input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Ex : Chauvet DJ"
                  className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none transition"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  Adresse DMX
                  <span className="text-slate-600 normal-case font-normal">(1–512)</span>
                </label>
                <input
                  type="number"
                  min={1} max={512}
                  value={startAddress}
                  onChange={(e) => setStartAddress(Math.max(1, Math.min(512, parseInt(e.target.value) || 1)))}
                  className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none transition font-mono"
                />
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Type d&apos;équipement
                </label>
                <select
                  value={category ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCategoryManual(true);
                    setCategory(v ? (v as FixtureCategoryId) : undefined);
                  }}
                  className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none transition"
                >
                  <option value="">— Non défini —</option>
                  {FIXTURE_GROUP_ORDER.map((group) => (
                    <optgroup key={group} label={FIXTURE_GROUP_LABELS[group]}>
                      {FIXTURE_CATEGORY_LIST.filter((cat) => cat.group === group).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="col-span-2 md:col-span-4">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Infos complémentaires (mode, commentaires...)"
                  rows={2}
                  className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none transition resize-none"
                />
              </div>
            </div>

            {/* Éditeur channels */}
            <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-white font-bold text-sm flex items-center gap-2 flex-1">
                  DMX Channels
                  <span className="text-slate-500 font-normal">({channels.length})</span>
                  {aiResult && (
                    <span className="text-[10px] bg-purple-500/15 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded font-bold">
                      IA
                    </span>
                  )}
                  {channels.length > 0 && startAddress > 1 && (
                    <span className="text-[10px] text-cyan-400/70 font-mono">
                      Abs: {startAddress}–{startAddress + channels.length - 1}
                    </span>
                  )}
                </h3>
                <button
                  onClick={sortChannels}
                  title="Trier par numéro de channel"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition"
                >
                  ↑↓ Trier
                </button>
                <button
                  onClick={addChannel}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 hover:border-cyan-500 px-2 py-1 rounded transition"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              {channels.length === 0 ? (
                <div className="text-center py-12">
                  <Upload className="mx-auto text-slate-700 mb-3" size={32} />
                  <p className="text-slate-500 text-sm">Scanne une photo ou ajoute manuellement des channels.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
                        <th className="text-left pb-2 pl-2 w-14">Ch</th>
                        <th className="text-left pb-2 w-14 text-slate-600">Abs</th>
                        <th className="text-left pb-2">Fonction</th>
                        <th className="text-left pb-2 w-32">Type</th>
                        <th className="text-left pb-2 w-16">Min</th>
                        <th className="text-left pb-2 w-16">Max</th>
                        <th className="text-left pb-2">Notes</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((c, idx) => (
                        <tr key={idx} className="border-t border-slate-800/60 hover:bg-white/[0.01]">
                          <td className="py-1.5 pl-2">
                            <input
                              type="number"
                              value={c.channel}
                              onChange={(e) => updateChannel(idx, { channel: parseInt(e.target.value, 10) || 0 })}
                              className="w-12 bg-[#0a0c10] border border-slate-700 rounded px-1.5 py-1 text-center text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-center">
                            <span className="text-slate-600 text-[11px] font-mono">
                              {startAddress + c.channel - 1}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              value={c.function}
                              onChange={(e) => updateChannel(idx, { function: e.target.value })}
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <select
                              value={c.type}
                              onChange={(e) => updateChannel(idx, { type: e.target.value as DmxType })}
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:border-cyan-500"
                            >
                              {DMX_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={c.minValue ?? ""}
                              onChange={(e) => updateChannel(idx, { minValue: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-1.5 py-1 text-center text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={c.maxValue ?? ""}
                              onChange={(e) => updateChannel(idx, { maxValue: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-1.5 py-1 text-center text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              value={c.notes ?? ""}
                              onChange={(e) => updateChannel(idx, { notes: e.target.value || undefined })}
                              placeholder="—"
                              className="w-full bg-transparent border border-transparent focus:border-slate-600 rounded px-1.5 py-1 text-xs text-slate-400 outline-none"
                            />
                          </td>
                          <td>
                            <button onClick={() => removeChannel(idx)} className="text-slate-500 hover:text-red-400 p-1">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                {/* Bouton voir OCR brut */}
                {rawOcrText && (
                  <button
                    onClick={() => setShowRaw(!showRaw)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition"
                  >
                    <Eye size={12} />
                    {showRaw ? "Cacher" : "Voir"} texte OCR brut
                  </button>
                )}
                <div className="ml-auto flex flex-col items-end gap-1">
                  {/* Erreur inline visible sans scroll */}
                  {(!fixtureName.trim() || channels.length === 0) && (
                    <p className="text-red-400 text-[11px] font-medium">
                      {!fixtureName.trim() ? "⚠ Remplis le nom de la fixture" : "⚠ Aucun channel détecté"}
                    </p>
                  )}
                  <button
                    onClick={saveFixture}
                    disabled={channels.length === 0 || !fixtureName.trim() || saveState === "saving"}
                    className={`flex items-center gap-2 font-bold text-sm px-5 py-2 rounded transition disabled:cursor-not-allowed ${
                      saveState === "saved"
                        ? "bg-green-500 text-white"
                        : "bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 text-black"
                    }`}
                  >
                    {saveState === "saving" ? (
                      <><Loader2 size={16} className="animate-spin" /> Sauvegarde...</>
                    ) : saveState === "saved" ? (
                      <><CheckCircle2 size={16} /> {currentFixtureId ? "Mis à jour !" : "Sauvegardé !"}</>
                    ) : (
                      <><Save size={16} /> Sauvegarder la fixture</>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* OCR brut (collapsible) */}
            {rawOcrText && showRaw && (
              <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-4">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Texte OCR brut</p>
                <pre className="text-slate-500 text-xs font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {rawOcrText}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
