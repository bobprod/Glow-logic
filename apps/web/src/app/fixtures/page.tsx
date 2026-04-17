"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  Loader2,
  Save,
  Trash2,
  Plus,
  Wand2,
  FileImage,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowLeft,
} from "lucide-react";

const DMX_TYPES = [
  "dimmer",
  "red",
  "green",
  "blue",
  "white",
  "amber",
  "uv",
  "pan",
  "tilt",
  "pan_fine",
  "tilt_fine",
  "gobo",
  "color_wheel",
  "strobe",
  "shutter",
  "zoom",
  "focus",
  "iris",
  "prism",
  "speed",
  "macro",
  "sound",
  "reset",
  "other",
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

interface Fixture {
  id: number;
  name: string;
  manufacturer: string | null;
  total_channels: number;
  updated_at: string;
}

const API_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3005"
    : "";

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [channels, setChannels] = useState<DmxChannel[]>([]);
  const [fixtureName, setFixtureName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [notes, setNotes] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFixtures = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fixtures`);
      if (res.ok) setFixtures(await res.json());
    } catch {
      /* serveur offline : on reste avec la liste vide */
    }
  }, []);

  React.useEffect(() => {
    loadFixtures();
  }, [loadFixtures]);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    if (!file.type.startsWith("image/")) {
      setError("Merci de sélectionner une image (PNG, JPG, WebP...)");
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${API_BASE}/api/fixtures/scan`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChannels(data.channels || []);
      setRawOcrText(data.rawText || "");
      setConfidence(data.confidence ?? null);
      if (data.fixtureName && !fixtureName) setFixtureName(data.fixtureName);
      if (data.channels?.length === 0) {
        setError(
          "Aucun channel détecté. Essaye une photo plus nette ou édite manuellement ci-dessous.",
        );
      } else {
        setSuccess(
          `${data.channels.length} channels extraits (confiance ${data.confidence?.toFixed(0)}%)`,
        );
      }
    } catch (err) {
      setError(
        `Erreur OCR : ${err instanceof Error ? err.message : "inconnue"}. Vérifie que le serveur tourne.`,
      );
    } finally {
      setScanning(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const updateChannel = (idx: number, patch: Partial<DmxChannel>) => {
    setChannels((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  };

  const removeChannel = (idx: number) => {
    setChannels((prev) => prev.filter((_, i) => i !== idx));
  };

  const addChannel = () => {
    const nextNum = Math.max(0, ...channels.map((c) => c.channel)) + 1;
    setChannels((prev) => [
      ...prev,
      { channel: nextNum, function: "", type: "other" },
    ]);
  };

  const saveFixture = async () => {
    setError(null);
    setSuccess(null);
    if (!fixtureName.trim()) {
      setError("Donne un nom à la fixture avant de sauvegarder.");
      return;
    }
    if (channels.length === 0) {
      setError("Aucun channel à sauvegarder.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fixtureName,
          manufacturer: manufacturer || undefined,
          channels,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess("Fixture sauvegardée !");
      await loadFixtures();
    } catch (err) {
      setError(
        `Erreur sauvegarde : ${err instanceof Error ? err.message : "inconnue"}`,
      );
    }
  };

  const loadFixture = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/fixtures/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setFixtureName(data.name);
      setManufacturer(data.manufacturer || "");
      setNotes(data.notes || "");
      setChannels(data.channels || []);
      setPreview(null);
      setRawOcrText("");
      setSuccess(`Fixture "${data.name}" chargée.`);
    } catch {
      setError("Chargement impossible.");
    }
  };

  const removeFixture = async (id: number) => {
    if (!confirm("Supprimer cette fixture ?")) return;
    try {
      await fetch(`${API_BASE}/api/fixtures/${id}`, { method: "DELETE" });
      await loadFixtures();
    } catch {
      /* ignore */
    }
  };

  const resetForm = () => {
    setChannels([]);
    setPreview(null);
    setRawOcrText("");
    setFixtureName("");
    setManufacturer("");
    setNotes("");
    setConfidence(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="w-full h-full bg-[#0a0c10] text-gray-100 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        {/* HEADER */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => (window.location.href = "/")}
              className="mt-1 flex items-center gap-1 text-slate-300 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/60 px-3 py-2 rounded-lg transition text-xs font-bold"
              title="Retour au dashboard"
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-wider text-white flex items-center gap-3">
                <Wand2 className="text-cyan-400" size={28} />
                SCAN FIXTURE IA
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Photographie la page DMX de ton manuel : l'OCR extrait
                automatiquement les channels.
              </p>
            </div>
          </div>
          <button
            onClick={resetForm}
            className="text-slate-400 hover:text-white text-xs border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition shrink-0"
          >
            Nouveau scan
          </button>
        </div>

        {/* TIPS BANNER pour débutants */}
        {showTips && (
          <div className="mb-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4 relative">
            <button
              onClick={() => setShowTips(false)}
              className="absolute top-2 right-2 text-slate-500 hover:text-white"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
            <h3 className="text-cyan-400 font-bold text-sm mb-2 flex items-center gap-2">
              💡 Premiers pas — pour prendre la meilleure photo
            </h3>
            <ul className="text-slate-300 text-xs space-y-1 ml-6 list-disc">
              <li>
                Cadre UNIQUEMENT le tableau des DMX channels (page du manuel).
              </li>
              <li>Éclairage uniforme, pas de reflet ni d'ombre sur la page.</li>
              <li>Photo bien droite, de face (pas en biais).</li>
              <li>
                Résolution minimum ~1200px de large pour une bonne lecture.
              </li>
              <li>
                Après le scan, vérifie et corrige manuellement les erreurs —
                c'est normal.
              </li>
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
          {/* COL 1: UPLOAD + PREVIEW */}
          <div className="lg:col-span-1 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#12141a] border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-8 text-center cursor-pointer transition"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
              />
              {scanning ? (
                <>
                  <Loader2
                    className="mx-auto text-cyan-400 animate-spin"
                    size={36}
                  />
                  <p className="text-slate-300 text-sm mt-3">
                    Analyse en cours...
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    L'OCR peut prendre 10-30 secondes au premier lancement.
                  </p>
                </>
              ) : preview ? (
                <>
                  <FileImage className="mx-auto text-cyan-400" size={32} />
                  <p className="text-slate-300 text-sm mt-2">Image chargée</p>
                  <p className="text-slate-500 text-xs">
                    Clique pour en choisir une autre
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mx-auto text-slate-500" size={36} />
                  <p className="text-slate-300 text-sm font-semibold mt-3">
                    Glisse une photo ici
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    ou clique pour sélectionner un fichier
                  </p>
                </>
              )}
            </div>

            {preview && (
              <div className="bg-[#12141a] border border-[#262c36] rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Aperçu"
                  className="w-full object-contain max-h-96"
                />
              </div>
            )}

            {confidence !== null && (
              <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-3 text-xs text-slate-400">
                <div className="flex justify-between mb-1">
                  <span>Confiance OCR</span>
                  <span
                    className={
                      confidence > 70
                        ? "text-green-400"
                        : confidence > 40
                          ? "text-yellow-400"
                          : "text-red-400"
                    }
                  >
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

            {/* LIBRARY */}
            <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-4">
              <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3">
                Ma bibliothèque ({fixtures.length})
              </h3>
              {fixtures.length === 0 ? (
                <p className="text-slate-600 text-xs">
                  Aucune fixture enregistrée.
                </p>
              ) : (
                <ul className="space-y-1 max-h-60 overflow-y-auto">
                  {fixtures.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between group hover:bg-slate-800/40 rounded px-2 py-1.5 cursor-pointer"
                      onClick={() => loadFixture(f.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">
                          {f.name}
                        </div>
                        <div className="text-slate-500 text-[10px]">
                          {f.manufacturer ? `${f.manufacturer} · ` : ""}
                          {f.total_channels} ch
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFixture(f.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition p-1"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* COL 2+3: EDITOR */}
          <div className="lg:col-span-2 space-y-4">
            {/* Metadata */}
            <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
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
              <div className="md:col-span-2">
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

            {/* Channels editor */}
            <div className="bg-[#12141a] border border-[#262c36] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-sm">
                  DMX Channels ({channels.length})
                </h3>
                <button
                  onClick={addChannel}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 hover:border-cyan-500 px-2 py-1 rounded transition"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>

              {channels.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  Scanne une photo ou ajoute manuellement des channels.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs uppercase tracking-wider">
                        <th className="text-left pb-2 pl-2 w-14">Ch</th>
                        <th className="text-left pb-2">Fonction</th>
                        <th className="text-left pb-2 w-32">Type</th>
                        <th className="text-left pb-2 w-20">Min</th>
                        <th className="text-left pb-2 w-20">Max</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((c, idx) => (
                        <tr key={idx} className="border-t border-slate-800">
                          <td className="py-1.5 pl-2">
                            <input
                              type="number"
                              value={c.channel}
                              onChange={(e) =>
                                updateChannel(idx, {
                                  channel: parseInt(e.target.value, 10) || 0,
                                })
                              }
                              className="w-12 bg-[#0a0c10] border border-slate-700 rounded px-1.5 py-1 text-center text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5">
                            <input
                              value={c.function}
                              onChange={(e) =>
                                updateChannel(idx, { function: e.target.value })
                              }
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <select
                              value={c.type}
                              onChange={(e) =>
                                updateChannel(idx, {
                                  type: e.target.value as DmxType,
                                })
                              }
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:border-cyan-500"
                            >
                              {DMX_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={c.minValue ?? ""}
                              onChange={(e) =>
                                updateChannel(idx, {
                                  minValue: e.target.value
                                    ? parseInt(e.target.value, 10)
                                    : undefined,
                                })
                              }
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-1.5 py-1 text-center text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number"
                              value={c.maxValue ?? ""}
                              onChange={(e) =>
                                updateChannel(idx, {
                                  maxValue: e.target.value
                                    ? parseInt(e.target.value, 10)
                                    : undefined,
                                })
                              }
                              className="w-full bg-[#0a0c10] border border-slate-700 rounded px-1.5 py-1 text-center text-sm outline-none focus:border-cyan-500"
                            />
                          </td>
                          <td>
                            <button
                              onClick={() => removeChannel(idx)}
                              className="text-slate-500 hover:text-red-400 p-1"
                              aria-label="Supprimer le channel"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end mt-4 pt-4 border-t border-slate-800">
                <button
                  onClick={saveFixture}
                  disabled={channels.length === 0 || !fixtureName.trim()}
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-black font-bold text-sm px-5 py-2 rounded transition"
                >
                  <Save size={16} /> Sauvegarder la fixture
                </button>
              </div>
            </div>

            {/* Raw OCR debug */}
            {rawOcrText && (
              <details className="bg-[#12141a] border border-[#262c36] rounded-xl">
                <summary className="cursor-pointer px-4 py-3 text-slate-400 text-xs font-bold uppercase tracking-wider hover:text-white">
                  Texte brut OCR (debug)
                </summary>
                <pre className="px-4 pb-4 text-slate-500 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {rawOcrText}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
