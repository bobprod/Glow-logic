"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, Search, ChevronRight, X, Check, RefreshCw,
  Crosshair, ArrowLeft, Save, Zap, Edit3, Copy, Camera,
  Loader2, Wand2, Upload, FileImage, AlertCircle, CheckCircle2,
} from "lucide-react";
import AiSuggestButton from "../../components/AiSuggestButton";
import ImageQualityIndicator from "../../components/ImageQualityIndicator";

const API = "http://localhost:3005";

// ── Channel type colours (matches MyStrow style) ─────────────
const CHANNEL_COLORS: Record<string, string> = {
  R: "bg-red-600", G: "bg-green-600", B: "bg-blue-600",
  W: "bg-gray-400", Dim: "bg-yellow-500", Strobe: "bg-purple-600",
  UV: "bg-violet-800", Ambre: "bg-amber-600", Orange: "bg-orange-500",
  Zoom: "bg-teal-500", Smoke: "bg-slate-500", Fan: "bg-cyan-600",
  Pan: "bg-emerald-600", PanFine: "bg-emerald-400", Tilt: "bg-pink-600",
  TiltFine: "bg-pink-400", Gobo1: "bg-lime-700", Gobo1Rot: "bg-lime-500",
  Gobo2: "bg-yellow-700", Prism: "bg-fuchsia-700", PrismRot: "bg-fuchsia-500",
  Focus: "bg-sky-600", ColorWheel: "bg-rose-600", Shutter: "bg-gray-700",
  Speed: "bg-indigo-600", Mode: "bg-neutral-600", other: "bg-slate-600",
};

const GROUP_COLORS: Record<string, string> = {
  A: "bg-blue-500", B: "bg-green-500", C: "bg-orange-500", D: "bg-purple-500",
  E: "bg-pink-500", F: "bg-yellow-500", G: "bg-red-500", H: "bg-teal-500",
  I: "bg-cyan-500", J: "bg-indigo-500",
};

function getGroupColor(grp: string) {
  return GROUP_COLORS[grp] ?? "bg-slate-500";
}

function ChannelTag({ name }: { name: string }) {
  const bg = CHANNEL_COLORS[name] ?? CHANNEL_COLORS.other;
  return (
    <span className={`inline-flex items-center justify-center ${bg} text-white text-[10px] font-bold rounded px-1.5 py-0.5 min-w-[28px]`}>
      {name}
    </span>
  );
}

interface PatchedFixture {
  id: number; name: string; fixture_type: string;
  manufacturer: string | null; model: string | null;
  universe: number; start_address: number; channel_count: number;
  profile: string[]; mode_name: string | null; grp: string;
  height_3d: number; rotation_3d: number; sort_order: number;
}

interface LibraryFixture {
  manufacturer: string; model: string; fixture_type: string;
  modes: { name: string; channels: string[]; num_channels: number }[];
}

// ── PROFILE PRESETS ───────────────────────────────────────────
const PROFILE_PRESETS: Record<string, string[]> = {
  "RGB": ["R", "G", "B"],
  "RGBD": ["R", "G", "B", "Dim"],
  "DRGB": ["Dim", "R", "G", "B"],
  "RGBDS": ["R", "G", "B", "Dim", "Strobe"],
  "RGBW": ["R", "G", "B", "W"],
  "RGBWD": ["R", "G", "B", "W", "Dim"],
  "RGBWA": ["R", "G", "B", "W", "Ambre"],
  "Dim 1ch": ["Dim"],
  "Dim+Strobe": ["Dim", "Strobe"],
};

const AVAILABLE_CHANNELS = [
  "R","G","B","W","Dim","Strobe","UV","Ambre",
  "Orange","Zoom","Smoke","Fan","Pan","PanFine","Tilt","TiltFine",
  "Gobo1","Gobo1Rot","Gobo2","Prism","PrismRot","Focus","ColorWheel","Shutter",
  "Speed","Mode",
];

const GROUPS = ["A","B","C","D","E","F","G","H","I","J"];

export default function PatchPage() {
  const [patch, setPatch] = useState<PatchedFixture[]>([]);
  const [selected, setSelected] = useState<PatchedFixture | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"address" | "name" | "group">("address");

  // Library state
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [selectedMfr, setSelectedMfr] = useState("");
  const [libSearch, setLibSearch] = useState("");
  const [libResults, setLibResults] = useState<LibraryFixture[]>([]);
  const [selectedLib, setSelectedLib] = useState<LibraryFixture | null>(null);
  const [selectedMode, setSelectedMode] = useState(0);
  const [libQty, setLibQty] = useState(1);
  const [libCustomName, setLibCustomName] = useState("");

  // Custom fixture creator state
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState("PAR LED");
  const [customModeName, setCustomModeName] = useState("");
  const [customProfile, setCustomProfile] = useState<string[]>(["R", "G", "B"]);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // AI Scan state
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>("");
  const [imageQuality, setImageQuality] = useState<any>(null);
  const [aiSuggesting, setAiSuggesting] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit in-place
  const [editing, setEditing] = useState(false);

  const loadPatch = useCallback(async () => {
    const r = await fetch(`${API}/api/patch`).catch(() => null);
    if (r?.ok) setPatch(await r.json());
  }, []);

  const loadManufacturers = useCallback(async () => {
    const r = await fetch(`${API}/api/fixture-library/manufacturers`).catch(() => null);
    if (r?.ok) setManufacturers(await r.json());
  }, []);

  useEffect(() => { loadPatch(); }, [loadPatch]);
  useEffect(() => {
    if (showLibrary) loadManufacturers();
  }, [showLibrary, loadManufacturers]);

  // Search library
  useEffect(() => {
    if (!showLibrary) return;
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ q: libSearch, manufacturer: selectedMfr });
      const r = await fetch(`${API}/api/fixture-library/search?${params}`).catch(() => null);
      if (r?.ok) setLibResults(await r.json());
    }, 200);
    return () => clearTimeout(t);
  }, [libSearch, selectedMfr, showLibrary]);

  const getNextAddr = useCallback(async (universe: number) => {
    const r = await fetch(`${API}/api/patch/next-address?universe=${universe}`).catch(() => null);
    if (r?.ok) return (await r.json()).address as number;
    return 1;
  }, []);

  const addFromLibrary = useCallback(async () => {
    if (!selectedLib) return;
    const mode = selectedLib.modes[selectedMode];
    const profile = mode?.channels ?? [];
    const count = mode?.num_channels ?? profile.length;
    let addr = await getNextAddr(1);
    for (let i = 0; i < libQty; i++) {
      const grp = GROUPS[patch.length % GROUPS.length];
      await fetch(`${API}/api/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: libCustomName || `${selectedLib.manufacturer} ${selectedLib.model}${libQty > 1 ? ` ${i + 1}` : ""}`,
          fixture_type: selectedLib.fixture_type,
          manufacturer: selectedLib.manufacturer,
          model: selectedLib.model,
          universe: 1,
          start_address: addr,
          channel_count: count,
          profile,
          mode_name: mode?.name ?? null,
          grp,
          height_3d: 3.0,
          rotation_3d: 0,
          sort_order: patch.length + i,
        }),
      });
      addr += count;
    }
    setShowLibrary(false);
    setSelectedLib(null);
    setLibQty(1);
    setLibCustomName("");
    loadPatch();
  }, [selectedLib, selectedMode, libQty, libCustomName, patch.length, getNextAddr, loadPatch]);

  const addCustomFixture = useCallback(async () => {
    if (!customName.trim() || customProfile.length === 0) return;
    const addr = await getNextAddr(1);
    const grp = GROUPS[patch.length % GROUPS.length];
    await fetch(`${API}/api/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: customName.trim(),
        fixture_type: customType,
        manufacturer: null,
        model: null,
        universe: 1,
        start_address: addr,
        channel_count: customProfile.length,
        profile: customProfile,
        mode_name: customModeName || null,
        grp,
        height_3d: 3.0,
        rotation_3d: 0,
        sort_order: patch.length,
      }),
    });
    setShowCustom(false);
    setCustomName("");
    setCustomProfile(["R", "G", "B"]);
    setCustomModeName("");
    loadPatch();
  }, [customName, customType, customProfile, customModeName, patch.length, getNextAddr, loadPatch]);

  const saveSelected = useCallback(async () => {
    if (!selected) return;
    await fetch(`${API}/api/patch/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    setEditing(false);
    loadPatch();
  }, [selected, loadPatch]);

  const deleteSelected = useCallback(async () => {
    if (!selected || !confirm(`Supprimer "${selected.name}" ?`)) return;
    await fetch(`${API}/api/patch/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    loadPatch();
  }, [selected, loadPatch]);

  const localize = useCallback(async () => {
    if (!selected) return;
    await fetch(`${API}/api/patch/${selected.id}/localize`, { method: "POST" });
  }, [selected]);

  // ── AI Functions ──────────────────────────────────────────────
  const handleImageUpload = useCallback(async (file: File) => {
    setScanFile(file);
    setScanning(true);
    setScanProgress("Vérification de la qualité...");
    setImageQuality(null);
    setScanResult(null);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setScanImage(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      // Step 1: Check image quality
      const qualityFormData = new FormData();
      qualityFormData.append("image", file);
      const qualityRes = await fetch(`${API}/api/fixtures/scan-quality`, {
        method: "POST",
        body: qualityFormData,
      });
      if (qualityRes.ok) {
        const qualityData = await qualityRes.json();
        setImageQuality(qualityData);
      }

      // Step 2: OCR + LLM scan
      setScanProgress("Analyse OCR + IA en cours...");
      const scanFormData = new FormData();
      scanFormData.append("image", file);
      const scanRes = await fetch(`${API}/api/fixtures/scan`, {
        method: "POST",
        body: scanFormData,
      });

      if (scanRes.ok) {
        const data = await scanRes.json();
        setScanResult(data);
        setScanProgress(`${data.channels?.length || 0} channels détectés`);

        // Auto-fill form fields
        if (data.fixtureName) setCustomName(data.fixtureName);
        if (data.channels?.length > 0) {
          const profile = data.channels.map((ch: any) => {
            // Map OCR types to channel names
            const typeMap: Record<string, string> = {
              dimmer: "Dim", red: "R", green: "G", blue: "B", white: "W",
              amber: "Ambre", uv: "UV", pan: "Pan", tilt: "Tilt",
              pan_fine: "PanFine", tilt_fine: "TiltFine", gobo: "Gobo1",
              color_wheel: "ColorWheel", strobe: "Strobe", shutter: "Shutter",
              zoom: "Zoom", focus: "Focus", iris: "Iris", prism: "Prism",
              speed: "Speed", macro: "Mode", sound: "Mode", reset: "Mode",
            };
            return typeMap[ch.type] || ch.function?.substring(0, 3) || "Dim";
          });
          setCustomProfile(profile);
        }
      }
    } catch (error) {
      console.error("Scan error:", error);
      setScanProgress("Erreur lors du scan");
    } finally {
      setScanning(false);
    }
  }, []);

  const handleAiSuggest = useCallback(async (field: string) => {
    setAiSuggesting(field);
    try {
      if (field === "name" || field === "type" || field === "profile") {
        // Suggest from name
        const res = await fetch(`${API}/api/ai/suggest-fixture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: customName, currentProfile: customProfile }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.fixture_type) setCustomType(data.fixture_type);
          if (data.profile?.length > 0) setCustomProfile(data.profile);
          if (data.mode_name) setCustomModeName(data.mode_name);
        }
      } else if (field === "group") {
        // Suggest group settings
        const res = await fetch(`${API}/api/ai/suggest-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtureType: customType }),
        });
        if (res.ok) {
          const data = await res.json();
          // Group suggestion is handled by the form
        }
      }
    } catch (error) {
      console.error("AI suggest error:", error);
    } finally {
      setAiSuggesting(null);
    }
  }, [customName, customType, customProfile]);

  const handleLearnCorrection = useCallback(async () => {
    if (!customName || !customType) return;
    try {
      await fetch(`${API}/api/ai/learn-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: customName,
          correctedType: customType,
          correctedProfile: customProfile,
        }),
      });
    } catch (error) {
      console.error("Learn correction error:", error);
    }
  }, [customName, customType, customProfile]);

  // Sorted + filtered list
  const displayed = patch
    .filter((f) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.manufacturer ?? "").toLowerCase().includes(q) || f.grp.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "address") return (a.universe * 1000 + a.start_address) - (b.universe * 1000 + b.start_address);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.grp.localeCompare(b.grp);
    });

  return (
    <div className="w-screen h-screen bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="h-14 shrink-0 bg-[#12141a] border-b border-white/5 flex items-center gap-3 px-5">
        <a href="/" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <h1 className="text-white font-black tracking-widest text-base">
          PATCH <span className="text-cyan-400">DMX</span>
        </h1>
        <span className="text-slate-600 text-xs ml-1">{patch.length} fixture{patch.length !== 1 ? "s" : ""}</span>
        <div className="flex-1" />
        <button
          onClick={() => { setShowCustom(true); setShowLibrary(false); }}
          className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg transition"
        >
          <Edit3 className="w-3.5 h-3.5" /> Créer fixture
        </button>
        <button
          onClick={() => { setShowLibrary(true); setShowCustom(false); }}
          className="flex items-center gap-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-3 py-1.5 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter fixture
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Fixture list */}
        <div className="w-72 shrink-0 bg-[#0d0f14] border-r border-white/5 flex flex-col">
          {/* Filter + sort */}
          <div className="p-3 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrer..."
                className="w-full bg-[#12141a] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex gap-1">
              {(["address", "name", "group"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-1 rounded transition ${sortBy === s ? "bg-cyan-500/20 text-cyan-400" : "text-slate-600 hover:text-slate-400"}`}
                >
                  {s === "address" ? "Adresse" : s === "name" ? "Nom" : "Groupe"}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600 text-sm">
                <p>Aucune fixture patchée</p>
                <p className="text-xs mt-1">Cliquez sur « Ajouter fixture »</p>
              </div>
            ) : (
              displayed.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setSelected(f); setEditing(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-white/3 hover:bg-white/5 transition text-left ${selected?.id === f.id ? "bg-white/10" : ""}`}
                >
                  <div className={`w-1.5 h-10 rounded-full ${getGroupColor(f.grp)} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{f.name}</div>
                    <div className="text-slate-500 text-[10px] flex items-center gap-1.5 mt-0.5">
                      <span className="text-cyan-500 font-mono font-bold">U{f.universe} · CH {f.start_address}–{f.start_address + f.channel_count - 1}</span>
                      <span>·</span>
                      <span>{f.fixture_type}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${getGroupColor(f.grp)} text-white`}>{f.grp}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <Zap className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez une fixture dans la liste</p>
            </div>
          ) : (
            <div className="max-w-2xl">
              {/* Detail header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-white text-xl font-black">{selected.name}</h2>
                  <p className="text-slate-400 text-sm mt-0.5">{selected.fixture_type}{selected.manufacturer ? ` · ${selected.manufacturer}` : ""}{selected.model ? ` ${selected.model}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={localize} className="flex items-center gap-1.5 text-xs border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg transition">
                    <Crosshair className="w-3.5 h-3.5" /> Localiser
                  </button>
                  {editing ? (
                    <button onClick={saveSelected} className="flex items-center gap-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-3 py-1.5 rounded-lg transition">
                      <Save className="w-3.5 h-3.5" /> Sauvegarder
                    </button>
                  ) : (
                    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs border border-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition">
                      <Edit3 className="w-3.5 h-3.5" /> Modifier
                    </button>
                  )}
                  <button onClick={deleteSelected} className="flex items-center gap-1.5 text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition">
                    <Trash2 className="w-3.5 h-3.5" /> Supprimer
                  </button>
                </div>
              </div>

              {/* IDENTITÉ */}
              <Section title="IDENTITÉ">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nom">
                    {editing ? (
                      <input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                        className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none" />
                    ) : <span>{selected.name}</span>}
                  </Field>
                  <Field label="Type">
                    {editing ? (
                      <input value={selected.fixture_type} onChange={(e) => setSelected({ ...selected, fixture_type: e.target.value })}
                        className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none" />
                    ) : <span>{selected.fixture_type}</span>}
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Groupe">
                    {editing ? (
                      <select value={selected.grp} onChange={(e) => setSelected({ ...selected, grp: e.target.value })}
                        className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none">
                        {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white ${getGroupColor(selected.grp)}`}>{selected.grp}</span>
                    )}
                  </Field>
                  <Field label="Univers">
                    {editing ? (
                      <input type="number" min={1} max={8} value={selected.universe}
                        onChange={(e) => setSelected({ ...selected, universe: parseInt(e.target.value) || 1 })}
                        className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none" />
                    ) : <span>U{selected.universe}</span>}
                  </Field>
                </div>
              </Section>

              {/* PATCH DMX */}
              <Section title="PATCH DMX">
                <div className="flex items-center gap-4">
                  <Field label="Adresse de départ">
                    {editing ? (
                      <input type="number" min={1} max={512} value={selected.start_address}
                        onChange={(e) => setSelected({ ...selected, start_address: parseInt(e.target.value) || 1 })}
                        className="w-28 bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none font-mono" />
                    ) : <span className="font-mono text-cyan-400 text-lg font-bold">{selected.start_address}</span>}
                  </Field>
                  <span className="text-slate-500 text-sm mt-4">→ CH {selected.start_address + selected.channel_count - 1} ({selected.channel_count} canaux)</span>
                </div>
              </Section>

              {/* VISUALISATION 3D */}
              <Section title="VISUALISATION 3D">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Hauteur de suspension">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.5" min={0} max={20} value={selected.height_3d}
                          onChange={(e) => setSelected({ ...selected, height_3d: parseFloat(e.target.value) || 0 })}
                          className="w-24 bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none font-mono" />
                        <span className="text-slate-500 text-xs">m</span>
                      </div>
                    ) : <span className="font-mono text-cyan-400">{selected.height_3d.toFixed(2)} m</span>}
                  </Field>
                  <Field label="Rotation corps">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <input type="number" step="15" min={0} max={360} value={selected.rotation_3d}
                          onChange={(e) => setSelected({ ...selected, rotation_3d: parseFloat(e.target.value) || 0 })}
                          className="w-24 bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none font-mono" />
                        <span className="text-slate-500 text-xs">°</span>
                      </div>
                    ) : <span className="font-mono text-cyan-400">{selected.rotation_3d}°</span>}
                  </Field>
                </div>
              </Section>

              {/* PROFIL DMX */}
              <Section title={`PROFIL DMX — ${selected.channel_count} canaux`}>
                <div className="flex flex-wrap gap-2">
                  {selected.profile.map((ch, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-600 font-mono">{selected.start_address + i}</span>
                      <ChannelTag name={ch} />
                    </div>
                  ))}
                  {selected.profile.length === 0 && (
                    <span className="text-slate-600 text-xs">Aucun profil défini</span>
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>

      {/* ═══ LIBRARY MODAL ════════════════════════════════════════ */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#12141a] border border-white/10 rounded-2xl shadow-2xl w-[840px] max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-white font-black text-lg">Bibliothèque de fixtures</h2>
              <button onClick={() => setShowLibrary(false)} className="text-slate-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Manufacturer list */}
              <div className="w-52 border-r border-white/5 overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={() => setSelectedMfr("")}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition ${!selectedMfr ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    Tous les fabricants
                  </button>
                  {manufacturers.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedMfr(m)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg transition truncate ${selectedMfr === m ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:bg-white/5"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model list + detail */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search */}
                <div className="p-3 border-b border-white/5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={libSearch}
                      onChange={(e) => setLibSearch(e.target.value)}
                      placeholder="Rechercher une fixture ou un fabricant..."
                      className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Results */}
                  <div className="w-72 border-r border-white/5 overflow-y-auto">
                    {libResults.length === 0 ? (
                      <p className="text-slate-600 text-sm text-center py-8">Aucun résultat</p>
                    ) : (
                      libResults.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedLib(f); setSelectedMode(0); }}
                          className={`w-full text-left px-3 py-2.5 border-b border-white/3 hover:bg-white/5 transition ${selectedLib === f ? "bg-white/10" : ""}`}
                        >
                          <div className="text-white text-sm font-medium truncate">{f.model}</div>
                          <div className="text-slate-500 text-xs">{f.fixture_type} · {f.modes[0]?.num_channels ?? "?"}ch</div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Mode + add */}
                  <div className="flex-1 p-4 overflow-y-auto">
                    {selectedLib ? (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-white font-bold">{selectedLib.manufacturer} — {selectedLib.model}</h3>
                          <p className="text-slate-400 text-xs">{selectedLib.fixture_type}</p>
                        </div>

                        {/* Mode selector */}
                        <div>
                          <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">Mode / Protocole</label>
                          <div className="space-y-1">
                            {selectedLib.modes.map((m, i) => (
                              <button
                                key={i}
                                onClick={() => setSelectedMode(i)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition border ${selectedMode === i ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-400 hover:bg-white/5"}`}
                              >
                                {m.name} · {m.num_channels} canaux
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Channel profile preview */}
                        {selectedLib.modes[selectedMode] && (
                          <div>
                            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">Profil DMX</label>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedLib.modes[selectedMode].channels.map((ch, i) => (
                                <div key={i} className="flex flex-col items-center gap-0.5">
                                  <span className="text-[8px] text-slate-600 font-mono">{i + 1}</span>
                                  <ChannelTag name={ch} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Name + qty */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Nom personnalisé</label>
                            <input
                              value={libCustomName}
                              onChange={(e) => setLibCustomName(e.target.value)}
                              placeholder="Optionnel"
                              className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Quantité</label>
                            <input
                              type="number" min={1} max={64}
                              value={libQty}
                              onChange={(e) => setLibQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-sm text-white outline-none font-mono text-center"
                            />
                          </div>
                        </div>

                        <button
                          onClick={addFromLibrary}
                          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-2.5 rounded-xl transition"
                        >
                          Ajouter au patch
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-600 text-sm text-center py-8">Sélectionnez une fixture</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CUSTOM FIXTURE MODAL ═════════════════════════════════ */}
      {showCustom && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#12141a] border border-white/10 rounded-2xl shadow-2xl w-[800px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <h2 className="text-white font-black text-lg">Créer votre fixture</h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                  🪄 IA Assistée
                </span>
              </div>
              <button onClick={() => { setShowCustom(false); setScanImage(null); setScanResult(null); setImageQuality(null); }} className="text-slate-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Image Scanner Section */}
              <div className="bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <label className="text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    Scanner un manuel DMX avec l'IA
                  </label>
                </div>
                
                {!scanImage ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl p-8 text-center cursor-pointer transition"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                      }}
                      className="hidden"
                    />
                    <Upload className="mx-auto text-slate-500 mb-3" size={32} />
                    <p className="text-slate-300 text-sm font-medium">
                      Glissez une photo du manuel ou cliquez
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      L'IA analysera automatiquement les channels DMX
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Image preview */}
                    <div className="flex gap-4">
                      <div className="w-48 h-32 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={scanImage} alt="Scan" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 space-y-2">
                        {/* Quality indicator */}
                        {imageQuality && (
                          <ImageQualityIndicator quality={imageQuality} />
                        )}
                        {/* Scan progress */}
                        {scanning && (
                          <div className="flex items-center gap-2 text-cyan-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs">{scanProgress}</span>
                          </div>
                        )}
                        {/* Scan result */}
                        {scanResult && !scanning && (
                          <div className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs">
                              {scanResult.channels?.length || 0} channels détectés 
                              (confiance: {scanResult.confidence?.toFixed(0)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Rescan button */}
                    <button
                      onClick={() => { setScanImage(null); setScanResult(null); setImageQuality(null); }}
                      className="text-xs text-slate-400 hover:text-white transition"
                    >
                      📷 Scanner une autre image
                    </button>
                  </div>
                )}
              </div>

              {/* Name + type with AI buttons */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                    Marque et modèle *
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex : Chauvet SlimPAR Pro H..."
                      className="flex-1 bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none"
                    />
                    <AiSuggestButton
                      onClick={() => handleAiSuggest("name")}
                      loading={aiSuggesting === "name"}
                      tooltip="L'IA détecte le type et le profil à partir du nom"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                    Type
                  </label>
                  <div className="flex gap-2">
                    <select value={customType} onChange={(e) => setCustomType(e.target.value)}
                      className="flex-1 bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none">
                      {["PAR LED","Moving Head","Effet","Stroboscope","Dimmer","Barre LED","Laser","Pixel Bar"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <AiSuggestButton
                      onClick={() => handleAiSuggest("type")}
                      loading={aiSuggesting === "type"}
                      tooltip="L'IA suggère le type basé sur le nom"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Nom du mode / protocole
                </label>
                <div className="flex gap-2">
                  <input value={customModeName} onChange={(e) => setCustomModeName(e.target.value)}
                    placeholder="Ex : Mode 8ch, Standard, Extended..."
                    className="flex-1 bg-[#0a0c10] border border-slate-700 focus:border-cyan-500 rounded px-3 py-2 text-sm text-white outline-none" />
                  <AiSuggestButton
                    onClick={() => handleAiSuggest("profile")}
                    loading={aiSuggesting === "profile"}
                    tooltip="L'IA suggère le profil DMX complet"
                  />
                </div>
              </div>

              {/* Profile presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Profil DMX — {customProfile.length} canaux
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs">Glisser pour réordonner · clic pour retirer</span>
                    <AiSuggestButton
                      onClick={() => handleAiSuggest("profile")}
                      loading={aiSuggesting === "profile"}
                      size="md"
                      tooltip="L'IA suggère les canaux appropriés"
                    />
                  </div>
                </div>
                <div className="text-slate-500 text-xs mb-2">Démarrer avec un profil :</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(PROFILE_PRESETS).map(([label, profile]) => (
                    <button
                      key={label}
                      onClick={() => setCustomProfile(profile)}
                      className="text-xs border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 px-2 py-1 rounded transition"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Current profile */}
                <div className="bg-[#0a0c10] border border-slate-800 rounded-xl p-3 min-h-[56px]">
                  <div className="flex flex-wrap gap-2">
                    {customProfile.map((ch, i) => (
                      <button
                        key={i}
                        onClick={() => setCustomProfile(customProfile.filter((_, idx) => idx !== i))}
                        className="flex flex-col items-center gap-0.5 group"
                        title="Clic pour retirer"
                      >
                        <span className="text-[9px] text-slate-600 font-mono">{i + 1}</span>
                        <div className={`${CHANNEL_COLORS[ch] ?? CHANNEL_COLORS.other} text-white text-xs font-bold px-2 py-1.5 rounded-lg group-hover:opacity-60 transition min-w-[36px] text-center`}>
                          {ch}
                        </div>
                      </button>
                    ))}
                    {customProfile.length === 0 && (
                      <p className="text-slate-600 text-xs self-center">Cliquez sur les canaux ci-dessous pour les ajouter</p>
                    )}
                  </div>
                </div>

                {/* Available channels */}
                <div className="mt-3">
                  <p className="text-slate-500 text-xs mb-2">Canaux disponibles — cliquer pour ajouter au profil :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setCustomProfile([...customProfile, ch])}
                        className={`${CHANNEL_COLORS[ch] ?? CHANNEL_COLORS.other} text-white text-xs font-bold px-2.5 py-1.5 rounded-lg hover:opacity-80 transition`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-white/5">
              <button onClick={() => { setShowCustom(false); setScanImage(null); setScanResult(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 font-bold transition text-sm">
                Annuler
              </button>
              <button
                onClick={() => { handleLearnCorrection(); addCustomFixture(); }}
                disabled={!customName.trim() || customProfile.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black transition text-sm flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                Enregistrer la fixture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">{title}</h3>
      <div className="bg-[#12141a] border border-white/5 rounded-xl p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mb-1">{label}</p>
      <div className="text-white text-sm">{children}</div>
    </div>
  );
}
