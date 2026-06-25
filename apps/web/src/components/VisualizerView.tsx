"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import ThreeCanvas from "./three/ThreeCanvas";
import FixtureRenderer from "./three/FixtureRenderer";
import SafetySimulationLayer from "./three/SafetySimulationLayer";
import useStore from "../store/useStore";

export default function VisualizerView() {
  const {
    laserArmed,
    nodes,
    previewMode,
    pyroArmed,
    setPreviewMode,
  } = useStore();

  return (
    <div className="w-full h-full bg-[#0a0c10] relative overflow-hidden">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {previewMode && (
          <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-200">
            Preview DMX
          </span>
        )}
        <button
          type="button"
          onClick={() => setPreviewMode(!previewMode)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest backdrop-blur ${
            previewMode
              ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-black/40 text-slate-300 hover:bg-white/5"
          }`}
        >
          {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {previewMode ? "Preview" : "Live"}
        </button>
      </div>

      {/* 3D Canvas */}
      <ThreeCanvas
        cameraPosition={[10, 8, 10]}
        orbitControls={true}
        className="w-full h-full"
      >
        <FixtureRenderer nodes={nodes} />
        <SafetySimulationLayer laserArmed={laserArmed} pyroArmed={pyroArmed} />
      </ThreeCanvas>

      {/* Bottom hint bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/60 backdrop-blur-sm border-t border-white/5 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          Click-drag = orbiter · Molette = zoom · Double-click = reset · Click fixture = contrôler
        </span>
        <span className="text-[10px] text-cyan-500 font-mono">
          {nodes.filter((n) => n.type === "fixtureNode" || n.type === "dmxOutput").length} fixtures
        </span>
      </div>
    </div>
  );
}
