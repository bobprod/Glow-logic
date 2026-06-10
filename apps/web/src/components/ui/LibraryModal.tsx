"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Download,
  FilePlus2,
  Package,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { API_BASE } from "../../lib/config";
import useStore from "../../store/useStore";

type LibraryKind = "fixture_profile" | "look_preset" | "show_template" | "venue_template";
type LibraryScope = "system" | "user" | "community";

interface LibraryItem {
  id: number;
  kind: LibraryKind;
  scope: LibraryScope;
  name: string;
  description: string | null;
  tags: string[];
  data: any;
  updated_at: string;
}

interface LibraryModalProps {
  onClose: () => void;
}

const KIND_LABELS: Record<LibraryKind | "all", string> = {
  all: "Tout",
  fixture_profile: "Fixtures",
  look_preset: "Looks",
  show_template: "Shows",
  venue_template: "Venues",
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function lookClasses(rgb: { r?: number; g?: number; b?: number }) {
  const r = rgb?.r || 0;
  const g = rgb?.g || 0;
  const b = rgb?.b || 0;
  if (r > 220 && g > 220 && b > 220) return { color: "bg-white", textColor: "text-slate-900" };
  if (r >= g && r >= b) return { color: r > 220 && b > 120 ? "bg-pink-500" : "bg-red-500", textColor: r > 220 && b > 120 ? "text-pink-300" : "text-red-300" };
  if (g >= r && g >= b) return { color: "bg-green-500", textColor: "text-green-300" };
  return { color: b > 180 && r > 100 ? "bg-purple-500" : "bg-blue-500", textColor: b > 180 && r > 100 ? "text-purple-300" : "text-blue-300" };
}

function markerColor(index: number) {
  return ["#22d3ee", "#a855f7", "#f43f5e", "#fb923c", "#84cc16", "#ffffff"][index % 6];
}

function clipClass(index: number) {
  return [
    { color: "bg-cyan-500", textColor: "text-cyan-300" },
    { color: "bg-purple-500", textColor: "text-purple-300" },
    { color: "bg-pink-500", textColor: "text-pink-300" },
    { color: "bg-amber-500", textColor: "text-amber-300" },
    { color: "bg-blue-500", textColor: "text-blue-300" },
  ][index % 5];
}

export function LibraryModal({ onClose }: LibraryModalProps) {
  const {
    smartPads,
    addSmartPad,
    fetchFixtures,
    addToast,
    addClip,
    addMarker,
    setDuration,
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [activeKind, setActiveKind] = useState<LibraryKind | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const loadItems = async () => {
    setStatus("Chargement...");
    try {
      const response = await fetch(`${API_BASE}/api/library`);
      if (!response.ok) throw new Error("Bibliotheque indisponible");
      const data = await response.json();
      setItems(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
      setStatus("");
    } catch (error: any) {
      setStatus(error.message || "Erreur bibliotheque");
    }
  };

  useEffect(() => {
    setMounted(true);
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const kindOk = activeKind === "all" || item.kind === activeKind;
      const text = `${item.name} ${item.description || ""} ${item.tags.join(" ")}`.toLowerCase();
      return kindOk && (!q || text.includes(q));
    });
  }, [activeKind, items, query]);

  const selected = items.find((item) => item.id === selectedId) || filteredItems[0] || null;
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {});

  const handleExport = async () => {
    const response = await fetch(`${API_BASE}/api/library/export`);
    const data = await response.json();
    downloadJson(`glow-logic-library-${new Date().toISOString().slice(0, 10)}.json`, data);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const response = await fetch(`${API_BASE}/api/library/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || "Import impossible");
      setStatus(`${result.imported} item(s) importes`);
      await loadItems();
    } catch (error: any) {
      setStatus(error.message || "Import impossible");
    }
  };

  const handleCreateUserLook = async () => {
    const response = await fetch(`${API_BASE}/api/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "look_preset",
        scope: "user",
        name: `Look utilisateur ${new Date().toLocaleTimeString("fr-FR")}`,
        description: "Preset local cree depuis la bibliotheque.",
        tags: ["user", "offline"],
        data: {
          pads: [
            { name: "Clean", rgb: { r: 255, g: 255, b: 255 }, intensity: 160 },
            { name: "Energy", rgb: { r: 255, g: 0, b: 180 }, intensity: 220, strobe: 60 },
          ],
        },
      }),
    });
    const item = await response.json();
    if (response.ok) {
      await loadItems();
      setSelectedId(item.id);
      setStatus("Look utilisateur ajoute");
    } else {
      setStatus(item.details || item.error || "Creation impossible");
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    if (item.scope === "system") {
      setStatus("Les items systeme restent proteges");
      return;
    }
    if (!confirm(`Supprimer "${item.name}" de la bibliotheque locale ?`)) return;
    const response = await fetch(`${API_BASE}/api/library/${item.id}`, { method: "DELETE" });
    if (response.ok) {
      setSelectedId(null);
      await loadItems();
      setStatus("Item supprime");
    }
  };

  const handleUseSelected = async (item: LibraryItem) => {
    try {
      if (item.kind === "fixture_profile") {
        const channels = Array.isArray(item.data?.channels) ? item.data.channels : [];
        const response = await fetch(`${API_BASE}/api/fixtures`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            manufacturer: item.data?.manufacturer || "Glow Logic Library",
            channels,
            startAddress: 1,
            notes: `Bibliotheque locale - ${item.description || item.name}`,
            modes: [{
              name: item.data?.modeName || item.name,
              channels,
            }],
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.details || result.error || "Fixture impossible");
        await fetchFixtures();
        setStatus("Profil fixture ajoute au patch");
        addToast({ type: "success", message: "Bibliotheque", detail: `${item.name} ajoute aux fixtures` });
        return;
      }

      if (item.kind === "look_preset") {
        const pads = Array.isArray(item.data?.pads) ? item.data.pads : [];
        const nextWidget = smartPads.length > 0 ? Math.max(...smartPads.map((pad) => pad.qlcWidget)) + 1 : 20;
        pads.forEach((pad: any, index: number) => {
          const rgb = pad.rgb || {};
          const classes = lookClasses(rgb);
          addSmartPad({
            id: Date.now() + index,
            name: pad.name || `${item.name} ${index + 1}`,
            color: classes.color,
            textColor: classes.textColor,
            iconName: pad.strobe ? "Zap" : "Sparkles",
            qlcPage: 1,
            qlcWidget: nextWidget + index,
            dmxValues: {
              1: pad.intensity ?? 200,
              2: rgb.r ?? 0,
              3: rgb.g ?? 0,
              4: rgb.b ?? 0,
              5: rgb.w ?? 0,
              6: pad.strobe ?? 0,
            },
            midiNote: -1,
            midiChannel: 1,
            gridCol: index % 4,
            gridRow: Math.floor(index / 4),
            gridW: 1,
            gridH: 1,
          });
        });
        setStatus(`${pads.length} pad(s) crees depuis le look`);
        addToast({ type: "success", message: "Look applique", detail: item.name });
        return;
      }

      if (item.kind === "venue_template") {
        const response = await fetch(`${API_BASE}/api/venue-profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Library - ${item.name}`,
            data: item.data || {},
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.details || result.error || "Venue impossible");
        setStatus("Venue template ajoute aux profils de lieu");
        addToast({ type: "success", message: "Venue ajoutee", detail: item.name });
        return;
      }

      if (item.kind === "show_template") {
        const sections = Array.isArray(item.data?.sections) ? item.data.sections : [];
        sections.forEach((section: any, index: number) => {
          const startTime = Math.round(Number(section.startMin || 0) * 60_000);
          const style = clipClass(index);
          addMarker({
            id: `lib-mkr-${Date.now()}-${index}`,
            name: section.name || `Section ${index + 1}`,
            time: startTime,
            color: markerColor(index),
          });
          addClip({
            id: `lib-clip-${Date.now()}-${index}`,
            track: "lights",
            name: section.name || `Section ${index + 1}`,
            startTime,
            duration: 5 * 60_000,
            color: style.color,
            textColor: style.textColor,
            qlcPage: 1,
            qlcWidget: 20 + index,
          });
        });
        const maxMin = sections.reduce((max: number, section: any) => Math.max(max, Number(section.startMin || 0)), 0);
        if (maxMin > 0) setDuration((maxMin + 10) * 60_000);
        setStatus(`${sections.length} section(s) ajoutees a la timeline`);
        addToast({ type: "success", message: "Show template applique", detail: item.name });
      }
    } catch (error: any) {
      setStatus(error.message || "Application impossible");
      addToast({ type: "error", message: "Bibliotheque", detail: error.message || "Application impossible" });
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-6xl h-[86vh] bg-[#12141A] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 overflow-hidden flex flex-col">
        <header className="h-16 border-b border-white/5 px-5 flex items-center justify-between bg-black/25 shrink-0">
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Bibliotheque locale
            </h2>
            <p className="text-[11px] text-slate-500 mt-1 font-semibold">System, user et future community marketplace - fonctionne offline.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateUserLook}
              className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-black flex items-center gap-2 transition-all"
            >
              <FilePlus2 className="w-4 h-4" />
              Nouveau look
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl bg-black/30 hover:bg-white/5 border border-white/10 text-slate-300 transition-all"
              title="Importer"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              className="p-2 rounded-xl bg-black/30 hover:bg-white/5 border border-white/10 text-slate-300 transition-all"
              title="Exporter"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
              event.currentTarget.value = "";
            }}
          />
        </header>

        <div className="grid grid-cols-[320px_1fr] min-h-0 flex-1">
          <aside className="border-r border-white/5 bg-black/20 p-4 flex flex-col min-h-0">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chercher fixture, look, venue..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(KIND_LABELS) as Array<LibraryKind | "all">).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setActiveKind(kind)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeKind === kind
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                      : "bg-black/25 border-white/5 text-slate-500 hover:text-white"
                  }`}
                >
                  {KIND_LABELS[kind]} {counts[kind] ? counts[kind] : ""}
                </button>
              ))}
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    selected?.id === item.id
                      ? "bg-cyan-500/10 border-cyan-500/30"
                      : "bg-black/25 border-white/5 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white text-xs font-black uppercase tracking-wider truncate">{item.name}</span>
                    <span className={`text-[9px] font-black uppercase ${
                      item.scope === "system" ? "text-green-400" : item.scope === "community" ? "text-purple-400" : "text-cyan-400"
                    }`}>
                      {item.scope}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.description || KIND_LABELS[item.kind]}</p>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-center text-xs text-slate-500 py-10">Aucun item trouve.</div>
              )}
            </div>
          </aside>

          <main className="p-6 overflow-y-auto custom-scrollbar">
            {selected ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest">
                        <Package className="w-3.5 h-3.5" />
                        {KIND_LABELS[selected.kind]}
                      </span>
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{selected.scope}</span>
                    </div>
                    <h3 className="text-white text-2xl font-black tracking-tight">{selected.name}</h3>
                    <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">{selected.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleUseSelected(selected)}
                      className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black flex items-center gap-2 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Utiliser
                    </button>
                    <button
                      onClick={() => handleDelete(selected)}
                      disabled={selected.scope === "system"}
                      className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-30 disabled:hover:bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black flex items-center gap-2 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-400 font-bold">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Offline</p>
                    <p className="text-green-400 text-xs font-black">Disponible localement</p>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Marketplace</p>
                    <p className="text-slate-300 text-xs font-black">Pret pour synchro future</p>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Mis a jour</p>
                    <p className="text-slate-300 text-xs font-mono">{new Date(selected.updated_at).toLocaleString("fr-FR")}</p>
                  </div>
                </div>

                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-4">
                  <h4 className="text-xs text-slate-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Donnees
                  </h4>
                  <pre className="text-[11px] text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.data, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                Selectionnez un item.
              </div>
            )}
          </main>
        </div>

        {status && (
          <div className="h-10 border-t border-white/5 bg-black/30 px-5 flex items-center text-xs text-slate-400 font-semibold">
            {status}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
