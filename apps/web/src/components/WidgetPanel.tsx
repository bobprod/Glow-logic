"use client";

import React, { useState } from "react";
import useStore from "../store/useStore";
import { socket } from "../lib/socket";

type PaletteColor = {
  name: string;
  color: string;
  rgb: [number, number, number];
};

const PALETTE: PaletteColor[] = [
  { name: "Rouge", color: "bg-orange-500", rgb: [249, 115, 22] },
  { name: "Magenta", color: "bg-pink-500", rgb: [236, 72, 153] },
  { name: "Cyan", color: "bg-cyan-400", rgb: [34, 211, 238] },
  { name: "Violet", color: "bg-purple-500", rgb: [168, 85, 247] },
  { name: "Blanc", color: "bg-white", rgb: [255, 255, 255] },
  { name: "Off", color: "bg-slate-800", rgb: [0, 0, 0] },
];

export default function WidgetPanel() {
  const { selectedNode, setSelectedNode, updateNodeData, addToast } =
    useStore();
  const [zoom, setZoom] = useState(45);
  const [focus, setFocus] = useState(70);
  const [activeGobo, setActiveGobo] = useState(1);
  const [activeColor, setActiveColor] = useState<number | null>(null);

  if (!selectedNode) return null;

  const nodeData = selectedNode.data as Record<string, unknown>;
  const padMode = (nodeData?.mode as "flash" | "toggle") ?? "flash";

  const applyColor = (idx: number, c: PaletteColor) => {
    setActiveColor(idx);
    socket?.emit("smart:color", {
      nodeId: selectedNode.id,
      rgb: c.rgb,
      name: c.name,
    });
    addToast({
      type: "success",
      message: `Couleur: ${c.name}`,
      duration: 1500,
    });
  };

  const applyGobo = (g: number) => {
    setActiveGobo(g);
    socket?.emit("smart:gobo", { nodeId: selectedNode.id, gobo: g });
  };

  const setPadMode = (mode: "flash" | "toggle") => {
    updateNodeData(selectedNode.id, { mode });
    addToast({
      type: "info",
      message: `Pad en mode ${mode === "flash" ? "FLASH (momentary)" : "TOGGLE (latch)"}`,
      duration: 1800,
    });
  };

  const sendRange = (param: string, value: number) => {
    socket?.emit("smart:param", {
      nodeId: selectedNode.id,
      param,
      value,
    });
  };

  return (
    <div className="absolute right-6 top-24 bottom-6 w-[400px] min-w-[300px] max-w-[600px] resize-x overflow-y-auto bg-[#1a1c23] border border-[#262c36] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 flex flex-col animate-in slide-in-from-right-8 duration-200">
      <div className="flex justify-between items-center p-4 border-b border-[#262c36] bg-[#12141a]">
        <div>
          <h2 className="text-white font-bold tracking-wider">
            {selectedNode.data.label || "Widget"}
          </h2>
          <span className="text-xs text-slate-500 font-mono uppercase">
            {selectedNode.type}
          </span>
        </div>
        <button
          onClick={() => setSelectedNode(null)}
          className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-pink-500/20 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {selectedNode.type === "dmxOutput" && (
          <>
            <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
                Dynamic Color Palettes
              </h3>

              <div className="grid grid-cols-4 gap-4 mb-4">
                {PALETTE.map((c, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => applyColor(i, c)}
                    className={`flex flex-col items-center gap-2 group rounded-lg p-1 transition-all ${
                      activeColor === i
                        ? "bg-white/10 ring-1 ring-cyan-400"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-full border-2 ${activeColor === i ? "border-cyan-400" : "border-[#262c36]"} ${c.color} group-hover:border-white transition-all`}
                    />
                    <span className="text-[10px] text-slate-400 text-center font-medium leading-tight">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
                Gobo & Beam Shaping
              </h3>

              <div className="flex gap-2 mb-6">
                {[1, 2, 3, 4].map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => applyGobo(g)}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                      activeGobo === g
                        ? "border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] bg-cyan-500/10"
                        : "border-cyan-500/30 hover:border-cyan-400"
                    }`}
                    title={`Gobo ${g}`}
                  >
                    <div className="w-6 h-6 rounded-full border border-cyan-400/50 flex items-center justify-center">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono uppercase">
                    <span>Zoom</span>
                    <span>{zoom}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={zoom}
                    onChange={(e) => {
                      const v = +e.target.value;
                      setZoom(v);
                      sendRange("zoom", v);
                    }}
                    className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-full appearance-none"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono uppercase">
                    <span>Focus</span>
                    <span>{focus}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={focus}
                    onChange={(e) => {
                      const v = +e.target.value;
                      setFocus(v);
                      sendRange("focus", v);
                    }}
                    className="w-full accent-pink-500 h-1 bg-slate-800 rounded-full appearance-none"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {selectedNode.type === "sliderInput" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
              Dimmer Configuration
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Valeur actuelle :{" "}
              <span className="text-cyan-400 font-mono">
                {String(nodeData.value ?? 0)}
              </span>
            </p>

            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">
              Label du fader
            </label>
            <input
              type="text"
              value={String(nodeData.label ?? "")}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { label: e.target.value })
              }
              className="w-full bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50 mb-4"
            />

            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">
              Assignation rapide
            </label>
            <div className="space-y-2">
              {["Dimmer Group 1", "Speed Control", "Strobe Rate"].map(
                (preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      updateNodeData(selectedNode.id, { label: preset });
                      addToast({
                        type: "success",
                        message: `Assigné à ${preset}`,
                        duration: 1500,
                      });
                    }}
                    className="w-full text-left bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 p-3 rounded text-sm text-white transition-colors"
                  >
                    {preset}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {selectedNode.type === "padInput" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4">
              Pad Settings
            </h3>

            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">
              Label
            </label>
            <input
              type="text"
              value={String(nodeData.label ?? "")}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { label: e.target.value })
              }
              className="w-full bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50 mb-4"
            />

            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">
              Mode de déclenchement
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPadMode("flash")}
                className={`border p-2 rounded text-xs font-bold transition-colors ${
                  padMode === "flash"
                    ? "bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                    : "bg-yellow-500/20 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/30"
                }`}
              >
                FLASH (MOMENTARY)
              </button>
              <button
                onClick={() => setPadMode("toggle")}
                className={`border p-2 rounded text-xs font-bold transition-colors ${
                  padMode === "toggle"
                    ? "bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                TOGGLE (LATCH)
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              {padMode === "flash"
                ? "Flash : actif uniquement pendant que le pad est maintenu."
                : "Toggle : bascule ON/OFF à chaque appui."}
            </p>
          </div>
        )}

        {selectedNode.type === "lfoInput" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">
              LFO Oscillator
            </h3>
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">
                Forme d&apos;onde
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["sine", "square", "triangle", "saw"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => updateNodeData(selectedNode.id, { wave: w })}
                    className={`py-2 rounded text-[10px] font-bold uppercase transition-colors ${
                      nodeData.wave === w
                        ? "bg-green-500 text-black"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono uppercase">
                <span>Fréquence</span>
                <span>{Number(nodeData.freq ?? 0.5).toFixed(2)} Hz</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={10}
                step={0.05}
                value={Number(nodeData.freq ?? 0.5)}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { freq: +e.target.value })
                }
                className="w-full accent-green-400 h-1 bg-slate-800 rounded-full appearance-none"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono uppercase">
                <span>Profondeur</span>
                <span>{Number(nodeData.depth ?? 255)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={255}
                value={Number(nodeData.depth ?? 255)}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { depth: +e.target.value })
                }
                className="w-full accent-green-400 h-1 bg-slate-800 rounded-full appearance-none"
              />
            </div>
          </div>
        )}

        {selectedNode.type === "colorPicker" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">
              RGB Color
            </h3>
            <input
              type="color"
              value={String(nodeData.hex ?? "#ff0000")}
              onChange={(e) =>
                updateNodeData(selectedNode.id, { hex: e.target.value })
              }
              className="w-full h-14 rounded-lg bg-transparent border border-white/10 cursor-pointer"
            />
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <label className="text-slate-500">
                R ch
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={Number(nodeData.rCh ?? 1)}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { rCh: +e.target.value })
                  }
                  className="w-full mt-1 bg-[#0a0c10] border border-white/10 rounded px-2 py-1 text-white"
                />
              </label>
              <label className="text-slate-500">
                G ch
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={Number(nodeData.gCh ?? 2)}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { gCh: +e.target.value })
                  }
                  className="w-full mt-1 bg-[#0a0c10] border border-white/10 rounded px-2 py-1 text-white"
                />
              </label>
              <label className="text-slate-500">
                B ch
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={Number(nodeData.bCh ?? 3)}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { bCh: +e.target.value })
                  }
                  className="w-full mt-1 bg-[#0a0c10] border border-white/10 rounded px-2 py-1 text-white"
                />
              </label>
            </div>
          </div>
        )}

        {selectedNode.type === "artnetOut" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">
              Art-Net Output
            </h3>
            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Univers
              <input
                type="number"
                min={0}
                max={15}
                value={Number(nodeData.universe ?? 1)}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { universe: +e.target.value })
                }
                className="w-full mt-2 bg-[#0a0c10] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </label>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Broadcast UDP sur le port 6454. Vérifier la configuration réseau
              dans Paramètres → Protocoles.
            </p>
          </div>
        )}

        {selectedNode.type === "audioIn" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">
              Audio Input
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ce nœud capte le signal du microphone (ou loopback système) pour
              générer une enveloppe rythmique.
            </p>
            <button
              onClick={async () => {
                try {
                  await navigator.mediaDevices.getUserMedia({ audio: true });
                  addToast({ type: "success", message: "Micro autorisé" });
                } catch {
                  addToast({
                    type: "error",
                    message: "Accès micro refusé",
                    detail: "Autoriser dans les réglages du navigateur",
                  });
                }
              }}
              className="w-full py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 text-xs font-bold transition-colors"
            >
              Autoriser le microphone
            </button>
          </div>
        )}

        {selectedNode.type === "dmxOutput" && (
          <div className="bg-[#12141a] border border-[#262c36] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">
              Patch DMX
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <label className="text-slate-500">
                Univers
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={Number(nodeData.universe ?? 1)}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, {
                      universe: +e.target.value,
                    })
                  }
                  className="w-full mt-1 bg-[#0a0c10] border border-white/10 rounded px-2 py-1 text-white"
                />
              </label>
              <label className="text-slate-500">
                Canal
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={Number(nodeData.channel ?? 1)}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, {
                      channel: +e.target.value,
                    })
                  }
                  className="w-full mt-1 bg-[#0a0c10] border border-white/10 rounded px-2 py-1 text-white"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
