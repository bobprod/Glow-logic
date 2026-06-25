"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { API_BASE } from "../../lib/config";
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Save,
  Info,
  Download,
  Loader2,
  AlertTriangle
} from "lucide-react";

interface FixtureProfileBuilderProps {
  onClose: () => void;
  onSuccess: (savedId: number) => void;
}

interface ChannelDef {
  channel: number;
  name: string;
  type: string;
  defaultValue?: number;
}

// Available channel types matching backend validation
const CHANNEL_PALETTE = [
  { type: "red", label: "R", bg: "bg-red-500", text: "text-white" },
  { type: "green", label: "G", bg: "bg-green-500", text: "text-white" },
  { type: "blue", label: "B", bg: "bg-blue-500", text: "text-white" },
  { type: "white", label: "W", bg: "bg-slate-200", text: "text-black" },
  { type: "dimmer", label: "Dimmer", bg: "bg-yellow-600", text: "text-white" },
  { type: "strobe", label: "Strobe", bg: "bg-orange-500", text: "text-white" },
  { type: "pan", label: "Pan", bg: "bg-sky-500", text: "text-white" },
  { type: "pan_fine", label: "PanFine", bg: "bg-sky-700", text: "text-white" },
  { type: "tilt", label: "Tilt", bg: "bg-cyan-500", text: "text-white" },
  { type: "tilt_fine", label: "TiltFine", bg: "bg-cyan-700", text: "text-white" },
  { type: "gobo", label: "Gobo1", bg: "bg-amber-500", text: "text-white" },
  { type: "prism", label: "Prism", bg: "bg-purple-600", text: "text-white" },
  { type: "color_wheel", label: "ColorWhee", bg: "bg-pink-600", text: "text-white" },
  { type: "shutter", label: "Shutter", bg: "bg-rose-500", text: "text-white" },
  { type: "zoom", label: "Zoom", bg: "bg-indigo-600", text: "text-white" },
  { type: "focus", label: "Focus", bg: "bg-emerald-600", text: "text-white" },
  { type: "amber", label: "Ambre", bg: "bg-amber-700", text: "text-white" },
  { type: "uv", label: "UV", bg: "bg-violet-800", text: "text-white" },
  { type: "speed", label: "Speed", bg: "bg-lime-600", text: "text-white" },
  { type: "reset", label: "Reset", bg: "bg-red-700", text: "text-white" },
  { type: "other", label: "Autre", bg: "bg-slate-700", text: "text-white" }
];

export default function FixtureProfileBuilder({ onClose, onSuccess }: FixtureProfileBuilderProps) {
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [type, setType] = useState("PAR LED");
  const [modeName, setModeName] = useState("Standard (8ch)");
  const [channels, setChannels] = useState<ChannelDef[]>([]);

  // AI Footprint scan modal states
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiText, setAiText] = useState("");
  const [parsingAi, setParsingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTab, setAiTab] = useState<"file" | "text">("file");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const isProfileFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith(".qxf") || fileName.endsWith(".gdtf") || fileName.endsWith(".xml");
  };

  const handleAddChannel = (typeInfo: typeof CHANNEL_PALETTE[0]) => {
    setChannels((prev) => [
      ...prev,
      {
        channel: prev.length + 1,
        name: typeInfo.label,
        type: typeInfo.type,
        defaultValue: 0
      }
    ]);
  };

  const handleRemoveChannel = (index: number) => {
    setChannels((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // Re-index channels
      return filtered.map((ch, idx) => ({ ...ch, channel: idx + 1 }));
    });
  };

  const handleMoveChannel = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === channels.length - 1) return;

    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const reordered = [...channels];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    // Reset channel index property
    const indexed = reordered.map((ch, idx) => ({ ...ch, channel: idx + 1 }));
    setChannels(indexed);
  };

  const handleSave = async () => {
    if (!name.trim()) return alert("Veuillez saisir un nom de projecteur.");
    if (channels.length === 0) return alert("Veuillez ajouter au moins un canal DMX.");

    // Format fields for backend database schema
    const payload = {
      name: name.trim(),
      manufacturer: manufacturer.trim() || "Generic",
      channels: channels.map((c) => ({
        channel: c.channel,
        name: c.name,
        type: c.type,
        min: 0,
        max: 255
      })),
      notes: `${type} · Mode ${modeName} (${channels.length} canaux)`,
      startAddress: 1,
      modes: [
        {
          name: modeName,
          channels: channels.map((c) => c.type)
        }
      ]
    };

    try {
      const res = await fetch(`${API_BASE}/api/fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.id);
        onClose();
      } else {
        alert("Erreur lors de la sauvegarde du projecteur.");
      }
    } catch (err) {
      console.error("Save fixture failed:", err);
    }
  };

  const handleRunAiParsing = async () => {
    if (!aiText.trim()) return;
    setParsingAi(true);
    setAiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/fixtures/scan-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: aiText })
      });
      
      const data = await res.json();
      if (res.ok && data.success && data.ai) {
        const aiResult = data.ai;
        if (aiResult.manufacturer) setManufacturer(aiResult.manufacturer);
        if (aiResult.model) setName(aiResult.model);
        
        // Load first mode
        const firstMode = aiResult.modes?.[0];
        if (firstMode) {
          setModeName(firstMode.name || "Standard");
          const loadedChs = firstMode.channels.map((c: any, idx: number) => ({
            channel: c.channel || idx + 1,
            name: c.function || c.name || "Canal",
            type: c.type || "other",
            defaultValue: 0
          }));
          setChannels(loadedChs);
        }
        
        setShowAiModal(false);
        setAiText("");
      } else {
        setAiError(data.error || "L'IA n'a pas pu structurer ce footprint. Veuillez réessayer.");
      }
    } catch (err: any) {
      setAiError(err.message || "Erreur de connexion avec le serveur.");
    } finally {
      setParsingAi(false);
    }
  };

  const handleRunFileParsing = async () => {
    if (selectedFiles.length === 0) return;
    setParsingAi(true);
    setAiError(null);

    try {
      const profileFile = selectedFiles.find(isProfileFile);
      if (profileFile) {
        const formData = new FormData();
        formData.append("profile", profileFile);
        const res = await fetch(`${API_BASE}/api/fixtures/import-profile`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.details || data.error || "Import profil impossible");
        }
        onSuccess(data.id);
        onClose();
        return;
      }

      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });

      const res = await fetch(`${API_BASE}/api/fixtures/scan`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && (data.ai || data.channels)) {
        const aiResult = data.ai || {
          manufacturer: data.manufacturer || "Generic",
          model: data.fixtureName || "OCR Scanned Fixture",
          modes: [{ name: "Standard", channels: data.channels }]
        };
        
        if (aiResult.manufacturer) setManufacturer(aiResult.manufacturer);
        if (aiResult.model) setName(aiResult.model);

        const firstMode = aiResult.modes?.[0];
        if (firstMode) {
          setModeName(firstMode.name || "Standard");
          const loadedChs = firstMode.channels.map((c: any, idx: number) => ({
            channel: c.channel || idx + 1,
            name: c.function || c.name || "Canal",
            type: c.type || "other",
            defaultValue: 0
          }));
          setChannels(loadedChs);
        }

        setShowAiModal(false);
        setSelectedFiles([]);
        setAiText("");
      } else {
        setAiError(data.error || "L'IA n'a pas pu analyser ces fichiers. Veuillez réessayer.");
      }
    } catch (err: any) {
      setAiError(err.message || "Erreur de connexion avec le serveur.");
    } finally {
      setParsingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans text-slate-200">
      <div className="relative w-full max-w-4xl bg-[#111318] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
          <div>
            <h2 className="text-white text-md font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Nouveau Projecteur
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Éditeur visuel de profil DMX</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/20 text-purple-300 text-xs font-bold rounded-xl transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Importer Footprint IA
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WORKSPACE PANELS */}
        <div className="flex-1 overflow-hidden flex divide-x divide-white/5">
          
          {/* LEFT PANEL: CONFIG FORM */}
          <div className="w-[320px] p-6 space-y-4 overflow-y-auto shrink-0">
            <h3 className="text-white text-xs font-black uppercase tracking-wider text-cyan-400">Paramètres de base</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Marque / Fabricant</label>
                <input
                  type="text"
                  placeholder="Ex: Chauvet, Robe, Clay Paky"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Nom du modèle</label>
                <input
                  type="text"
                  placeholder="Ex: Intimidator Spot 360, PAR LED 18"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Type de projecteur</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="PAR LED">PAR LED / Wash</option>
                  <option value="Lyre Spot">Lyre Spot (Moving Head)</option>
                  <option value="Lyre Beam">Lyre Beam (Moving Head)</option>
                  <option value="Barre LED">Barre LED (Bar)</option>
                  <option value="Stroboscope">Stroboscope</option>
                  <option value="Laser">Laser</option>
                  <option value="Autre">Autre projecteur</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Nom du Mode</label>
                <input
                  type="text"
                  placeholder="Ex: Standard (12ch), Extended (15ch)"
                  value={modeName}
                  onChange={(e) => setModeName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex gap-2 text-[10px] text-slate-400 leading-normal">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Glissez les canaux ou cliquez sur la palette de droite pour ordonner la table DMX de ce projecteur.</span>
            </div>
          </div>

          {/* MIDDLE PANEL: ACTIVE CHANNELS LIST */}
          <div className="flex-1 flex flex-col overflow-hidden bg-black/10">
            <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-black/20">
              <span className="text-white text-[10px] font-black uppercase tracking-wider">
                Profil DMX ({channels.length} canaux)
              </span>
              <button
                onClick={() => setChannels([])}
                className="text-[9px] text-slate-500 hover:text-red-400 transition-colors font-bold"
              >
                Vider la liste
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {channels.map((ch, index) => {
                const paletteMatch = CHANNEL_PALETTE.find((p) => p.type === ch.type);
                const bgCls = paletteMatch?.bg || "bg-slate-700";
                const txtCls = paletteMatch?.text || "text-white";

                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-[#181b21] border border-white/5 rounded-xl px-4 py-2.5 hover:border-white/10 transition-colors group"
                  >
                    <span className="font-mono text-xs text-slate-500 font-bold w-6">
                      {String(ch.channel).padStart(2, "0")}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black shrink-0 ${bgCls} ${txtCls} w-20 text-center`}>
                      {paletteMatch?.label || ch.type}
                    </span>

                    <input
                      type="text"
                      value={ch.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChannels((prev) =>
                          prev.map((c, i) => (i === index ? { ...c, name: val } : c))
                        );
                      }}
                      className="flex-1 bg-transparent border-b border-transparent focus:border-white/20 px-1 py-0.5 text-xs text-white font-bold placeholder:text-slate-600 focus:outline-none"
                    />

                    {/* Controls */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleMoveChannel(index, "up")}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveChannel(index, "down")}
                        disabled={index === channels.length - 1}
                        className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveChannel(index)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {channels.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 gap-3">
                  <Download className="w-8 h-8 text-slate-600 animate-bounce" />
                  <div>
                    <p className="text-xs font-bold text-slate-400">Aucun canal configuré</p>
                    <p className="text-[10px] text-slate-600 mt-1 max-w-[220px]">
                      Ajoutez des canaux de commande en cliquant sur la palette à droite.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: CHANNELS PALETTE */}
          <div className="w-[280px] p-6 space-y-4 overflow-y-auto shrink-0 bg-black/20">
            <h3 className="text-white text-xs font-black uppercase tracking-wider text-cyan-400">Palette de canaux</h3>
            
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_PALETTE.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddChannel(item)}
                  className={`px-3 py-2 rounded-xl text-left border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between group ${item.bg} ${item.text}`}
                >
                  <span className="text-[10px] font-black uppercase">{item.label}</span>
                  <Plus className="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-white/5 hover:bg-white/5 rounded-xl text-xs font-bold transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            <Save className="w-4 h-4" />
            Enregistrer le projecteur
          </button>
        </div>

        {/* NESTED MODAL: AI TEXT IMPORT */}
        <AnimatePresence>
          {showAiModal && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
              <div className="w-full max-w-lg bg-[#14171d] border border-white/10 rounded-2xl flex flex-col h-[520px] shadow-2xl">
                
                {/* AI modal header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-white/5 bg-black/15">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span className="text-white text-xs font-black uppercase tracking-wider">Importer un footprint — IA</span>
                  </div>
                  <button
                    onClick={() => { setShowAiModal(false); setAiText(""); setSelectedFiles([]); setAiError(null); }}
                    className="p-1 rounded-full hover:bg-white/5 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs selection */}
                <div className="flex bg-black/35 rounded-xl p-1 mb-2 border border-white/5 mx-5 mt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAiTab("file")}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      aiTab === "file"
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📁 Déposer Manuel (PDF/Image)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiTab("text")}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                      aiTab === "text"
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📝 Coller Texte
                  </button>
                </div>

                {/* AI modal body */}
                <div className="flex-1 p-5 flex flex-col justify-between overflow-hidden min-h-0">
                  
                  {aiTab === "file" ? (
                    <div className="flex-1 flex flex-col justify-between min-h-0 gap-3">
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (e.dataTransfer.files) {
                            const files = Array.from(e.dataTransfer.files);
                            setSelectedFiles(prev => [...prev, ...files]);
                          }
                        }}
                        onClick={() => document.getElementById("manual-file-input")?.click()}
                        className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                          isDragging
                            ? "border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.25)] animate-pulse"
                            : "border-white/10 hover:border-white/20 bg-black/20"
                        }`}
                      >
                        <input
                          type="file"
                          id="manual-file-input"
                          multiple
                          accept="image/*,.qxf,.gdtf,.xml"
                          onChange={(e) => {
                            if (e.target.files) {
                              const files = Array.from(e.target.files);
                              setSelectedFiles(prev => [...prev, ...files]);
                            }
                          }}
                          className="hidden"
                        />
                        <Download className="w-8 h-8 text-purple-400 mb-2 animate-bounce" />
                        <p className="text-xs font-bold text-slate-300">Glisser-déposer vos fichiers ici</p>
                        <p className="text-[9px] text-slate-500 mt-1">Images de manuel, profils QLC+ .qxf, GDTF .gdtf ou XML</p>
                      </div>

                      {selectedFiles.length > 0 && (
                        <div className="max-h-[110px] overflow-y-auto space-y-1.5 custom-scrollbar bg-black/45 rounded-xl p-3 border border-white/5 shrink-0">
                          {selectedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                              <span className="truncate max-w-[320px]">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col gap-2 min-h-0">
                      <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Coller ton footprint</p>
                      <textarea
                        placeholder="Exemple : 
CH 1 - Pan (0-255)
CH 2 - Tilt (0-255)
CH 3 - Dimmer (0-255)..."
                        value={aiText}
                        onChange={(e) => setAiText(e.target.value)}
                        className="w-full h-full min-h-[180px] bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 resize-none font-mono"
                      />
                    </div>
                  )}

                  {aiError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-2.5 rounded-lg flex items-center gap-2 mt-2 shrink-0">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center gap-3 mt-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setShowAiModal(false); setAiText(""); setSelectedFiles([]); setAiError(null); }}
                      className="px-4 py-2 border border-white/5 hover:bg-white/5 rounded-xl text-xs font-bold text-slate-400"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={aiTab === "file" ? handleRunFileParsing : handleRunAiParsing}
                      disabled={parsingAi || (aiTab === "file" ? selectedFiles.length === 0 : !aiText.trim())}
                      className="fixture-profile-import-button flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-40 disabled:hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                    >
                      {parsingAi ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyse en cours...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {selectedFiles.some(isProfileFile) ? "Importer le profil" : "Analyser le footprint"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
