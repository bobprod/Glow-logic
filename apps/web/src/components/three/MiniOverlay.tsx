"use client";

import React, { useState, useEffect, useRef } from "react";
import { Minus, Plus, Maximize2, Minimize2, Move, X } from "lucide-react";
import ThreeCanvas from "./ThreeCanvas";
import FixtureRenderer from "./FixtureRenderer";
import SafetySimulationLayer from "./SafetySimulationLayer";
import { Node } from "reactflow";
import useStore from "../../store/useStore";
import { socket } from "../../lib/socket";

interface MiniOverlayProps {
  nodes: Node[];
  className?: string;
}

type WindowSize = "sm" | "md" | "lg";

export default function MiniOverlay({ nodes, className = "" }: MiniOverlayProps) {
  const {
    groupLevels,
    groupMutes,
    groupColors,
    laserArmed,
    pyroArmed,
    setGroupLevel,
    setGroupMute,
    setGroupColor,
  } = useStore();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState<WindowSize>("sm");
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeView, setActiveView] = useState<'3d' | '2d'>('3d');
  const [selectedStageGroup, setSelectedStageGroup] = useState<string | null>(null);
  
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Event handlers for dragging the floating window via the header handle
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and not on action buttons
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Size configurations
  const sizeConfig = {
    sm: { width: 320, height: 220 },
    md: { width: 480, height: 320 },
    lg: { width: 640, height: 420 },
  };

  const dimensions = sizeConfig[size];
  const fixturesCount = nodes.filter((n) => n.type === "fixtureNode" || n.type === "dmxOutput").length;

  const renderStagePlan = () => {
    const isSelected = (group: string) => selectedStageGroup === group;
    
    const getGroupStyle = (groupName: string) => {
      const isMuted = groupMutes[groupName] === true;
      const level = groupLevels[groupName] ?? 80;
      const hexColor = groupColors[groupName] || '#ffffff';
      
      return {
        borderColor: isMuted || level === 0 ? '#475569' : hexColor,
        backgroundColor: isMuted || level === 0 ? '#1e293b' : `${hexColor}22`,
        boxShadow: isMuted || level === 0 ? 'none' : `0 0 10px ${hexColor}66`,
        color: isMuted || level === 0 ? '#64748b' : hexColor,
        opacity: isMuted ? 0.45 : 1
      };
    };

    return (
      <div className="w-full h-full bg-[#050608] relative flex flex-col justify-between p-3 overflow-hidden select-none">
        
        {/* Lyres Row (Top) */}
        <div className="flex flex-col items-center w-full mt-1">
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-1">Lyre</span>
          <div className="flex gap-6 justify-center w-full">
            {[1, 2, 3, 4].map((id) => {
              const group = 'Contre';
              const style = getGroupStyle(group);
              const active = isSelected(group);
              return (
                <div 
                  key={id} 
                  onClick={() => setSelectedStageGroup(group)}
                  className="flex flex-col items-center relative cursor-pointer"
                >
                  <div 
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-200 ${
                      active ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                    }`}
                    style={{
                      borderColor: style.borderColor,
                      backgroundColor: style.backgroundColor,
                      boxShadow: style.boxShadow,
                    }}
                  >
                    <span className="text-[8px] font-bold" style={{ color: style.color }}>LY{id}</span>
                  </div>

                  {/* Tiny Beam Cones */}
                  {!groupMutes[group] && (groupLevels[group] ?? 0) > 0 && (
                    <div 
                      className="absolute top-6 w-8 h-12 blur-[2px] rounded-b-full origin-top pointer-events-none transition-all duration-200"
                      style={{
                        background: `linear-gradient(to bottom, ${groupColors[group] || '#ffffff'}aa, transparent)`,
                        opacity: ((groupLevels[group] ?? 80) / 100) * 0.4,
                        height: `${20 + (((groupLevels[group] ?? 80) / 100) * 40)}px`
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Row (Lat & Dch) */}
        <div className="flex justify-between items-center w-full px-2 py-1">
          {/* Lat Left */}
          <div 
            onClick={() => setSelectedStageGroup('Latéral')}
            className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 ${
              isSelected('Latéral') ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
            }`}
            style={getGroupStyle('Latéral')}
          >
            <span className="text-[7px] font-bold">L1</span>
          </div>

          {/* Douches */}
          <div className="flex gap-4">
            {['Douche 1', 'Douche 2', 'Douche 3'].map((name, idx) => {
              const style = getGroupStyle(name);
              const active = isSelected(name);
              return (
                <div 
                  key={name}
                  onClick={() => setSelectedStageGroup(name)}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 ${
                    active ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  }`}
                  style={style}
                >
                  <span className="text-[7px] font-bold">D{idx+1}</span>
                </div>
              );
            })}
          </div>

          {/* Lat Right */}
          <div 
            onClick={() => setSelectedStageGroup('Latéral')}
            className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 ${
              isSelected('Latéral') ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
            }`}
            style={getGroupStyle('Latéral')}
          >
            <span className="text-[7px] font-bold">L2</span>
          </div>
        </div>

        {/* Bottom Row (Face) */}
        <div className="flex flex-col items-center w-full mb-1">
          <div className="flex gap-6 justify-center w-full">
            {[1, 2, 3, 4].map((id) => {
              const group = 'Face';
              const style = getGroupStyle(group);
              const active = isSelected(group);
              return (
                <div 
                  key={id}
                  onClick={() => setSelectedStageGroup(group)}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 ${
                    active ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  }`}
                  style={style}
                >
                  <span className="text-[8px] font-bold" style={{ color: style.color }}>FC{id}</span>
                </div>
              );
            })}
          </div>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-1">Face</span>
        </div>

        {/* Drawer for selected group controls */}
        {selectedStageGroup && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#0e1016]/95 border-t border-cyan-500/25 p-2 z-20 flex flex-col gap-1.5 animate-in slide-in-from-bottom duration-150">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-white uppercase tracking-wider">{selectedStageGroup}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGroupMute(selectedStageGroup, !groupMutes[selectedStageGroup!])}
                  className={`px-1.5 py-0.5 rounded text-[7px] font-bold border transition-colors ${
                    groupMutes[selectedStageGroup!]
                      ? 'bg-red-500/20 border-red-500/30 text-red-400'
                      : 'bg-green-500/10 border-green-500/20 text-green-400'
                  }`}
                >
                  {groupMutes[selectedStageGroup!] ? 'MUTÉ' : 'MUTE'}
                </button>
                <button 
                  onClick={() => setSelectedStageGroup(null)}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-3">
              {/* Slider horizontal */}
              <div className="flex-1 flex items-center gap-1.5">
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={groupLevels[selectedStageGroup] ?? 80}
                  onChange={(e) => {
                    const level = Number(e.target.value);
                    setGroupLevel(selectedStageGroup, level);
                    
                    let zoneId = 0;
                    if (selectedStageGroup === 'Face') zoneId = 1;
                    if (selectedStageGroup === 'Douche 1') zoneId = 2;
                    if (selectedStageGroup === 'Douche 2') zoneId = 4;
                    if (zoneId && socket) {
                      socket.emit("smart:zone_intensity", { zoneId, value: Math.round((level/100)*255) });
                    }
                  }}
                  className="w-full h-1 bg-slate-800 rounded-full cursor-pointer accent-cyan-400"
                />
                <span className="font-mono text-[9px] text-slate-300 font-bold w-6 text-right">
                  {(groupLevels[selectedStageGroup] ?? 0)}%
                </span>
              </div>

              {/* Color boxes & Color picker */}
              <div className="flex items-center gap-1">
                {[
                  { label: "R", hex: "#ef4444" },
                  { label: "V", hex: "#22c55e" },
                  { label: "B", hex: "#3b82f6" },
                  { label: "C", hex: "#22d3ee" }
                ].map((colorObj) => {
                  const isColSelected = groupColors[selectedStageGroup!] === colorObj.hex;
                  return (
                    <button
                      key={colorObj.hex}
                      onClick={() => setGroupColor(selectedStageGroup, colorObj.hex)}
                      style={{ backgroundColor: colorObj.hex }}
                      className={`w-3.5 h-3.5 rounded border transition-all ${
                        isColSelected 
                          ? 'border-white scale-110' 
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                      title={colorObj.label}
                    />
                  );
                })}
                {/* Hex Picker circle */}
                <div className="relative w-4 h-4 rounded-full border border-white/20 hover:scale-105 transition-transform" style={{ backgroundColor: groupColors[selectedStageGroup] || '#ffffff' }}>
                  <input 
                    type="color" 
                    value={groupColors[selectedStageGroup] || '#ffffff'} 
                    onChange={(e) => setGroupColor(selectedStageGroup, e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Palette"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`relative bg-[#0a0c10]/95 rounded-xl border border-cyan-500/30 overflow-hidden shadow-2xl flex flex-col backdrop-blur-md transition-shadow duration-200 select-none ${
        isDragging ? "shadow-cyan-500/10 border-cyan-400/50" : ""
      } ${className}`}
      style={{
        width: isMinimized ? 220 : dimensions.width,
        height: isMinimized ? 38 : dimensions.height,
        transform: `translate(${position.x}px, ${position.y}px)`,
        // Disable transitions during drag for smooth framerate
        transition: isDragging ? "none" : "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), height 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header (Acts as dragging handle) */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between px-3 py-2 bg-black/70 backdrop-blur-sm border-b border-white/5 select-none shrink-0 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Move className="w-3.5 h-3.5 text-cyan-400/70" />
          <span className="text-[10px] font-black text-cyan-400 tracking-wider uppercase truncate">
            {isMinimized ? "Mini 3D" : activeView === '3d' ? "3D Live Visualizer" : "2D Stage Plan"}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 3D / 2D View Switch (Hidden when minimized) */}
          {!isMinimized && (
            <div className="flex bg-[#12141a]/80 p-0.5 rounded-lg border border-white/10 mr-1">
              <button
                onClick={() => {
                  setActiveView('3d');
                  setSelectedStageGroup(null);
                }}
                className={`px-1.5 py-0.5 rounded-md text-[8px] font-black transition-all ${
                  activeView === '3d' 
                    ? 'bg-cyan-500 text-black shadow' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                3D
              </button>
              <button
                onClick={() => {
                  setActiveView('2d');
                  setSelectedStageGroup(null);
                }}
                className={`px-1.5 py-0.5 rounded-md text-[8px] font-black transition-all ${
                  activeView === '2d' 
                    ? 'bg-cyan-500 text-black shadow' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                2D
              </button>
            </div>
          )}

          <span className="text-[9px] text-slate-500 font-mono font-bold mr-1">
            {fixturesCount} FX
          </span>

          {/* Resize Toggle Button (Hidden when minimized) */}
          {!isMinimized && (
            <button
              onClick={() => setSize((prev) => (prev === "sm" ? "md" : prev === "md" ? "lg" : "sm"))}
              className="p-1 rounded bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Changer la taille"
            >
              {size === "lg" ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </button>
          )}

          {/* Minimize / Restore Button */}
          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="p-1 rounded bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors"
            title={isMinimized ? "Restaurer" : "Réduire"}
          >
            {isMinimized ? (
              <Plus className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* 3D Canvas / 2D Stage Map Container (Hidden when minimized) */}
      <div 
        className="flex-1 min-h-0 w-full relative"
        style={{ display: isMinimized ? "none" : "block" }}
      >
        {activeView === '3d' ? (
          <ThreeCanvas
            cameraPosition={[6, 6, 6]}
            orbitControls={true}
            style={{ width: "100%", height: "100%" }}
          >
            <FixtureRenderer nodes={nodes} />
            <SafetySimulationLayer laserArmed={laserArmed} pyroArmed={pyroArmed} />
          </ThreeCanvas>
        ) : (
          renderStagePlan()
        )}
      </div>
    </div>
  );
}
