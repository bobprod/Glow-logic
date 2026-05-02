"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { socket } from "../../lib/socket";
import {
  Zap,
  ZapOff,
  ChevronLeft,
  ChevronRight,
  Send,
  SkipForward,
} from "lucide-react";

const UNIVERSE_SIZE = 512;
const COLS = 32;
const ROWS = UNIVERSE_SIZE / COLS; // 16

export default function DmxTesterPage() {
  const [universe, setUniverse] = useState(1);
  const [values, setValues] = useState<number[]>(new Array(UNIVERSE_SIZE).fill(0));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sliderVal, setSliderVal] = useState(0);
  const lastClickedRef = useRef<number | null>(null);

  // Group assistant state
  const [groupSize, setGroupSize] = useState(5);
  const [groupOffset, setGroupOffset] = useState(0); // 0-based start of current group window

  const sendDmx = useCallback(
    (channel: number, value: number) => {
      socket.emit("dmx_update", { universe, channel, value });
    },
    [universe]
  );

  const sendAll = useCallback(
    (val: number) => {
      const next = new Array(UNIVERSE_SIZE).fill(val);
      setValues(next);
      for (let ch = 1; ch <= UNIVERSE_SIZE; ch++) {
        sendDmx(ch, val);
      }
    },
    [sendDmx]
  );

  const applySliderToSelected = useCallback(
    (val: number) => {
      if (selected.size === 0) return;
      setValues((prev) => {
        const next = [...prev];
        selected.forEach((ch) => {
          next[ch - 1] = val;
          sendDmx(ch, val);
        });
        return next;
      });
    },
    [selected, sendDmx]
  );

  const handleCellClick = (ch: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRef.current !== null) {
      const a = Math.min(lastClickedRef.current, ch);
      const b = Math.max(lastClickedRef.current, ch);
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = a; i <= b; i++) next.add(i);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(ch)) next.delete(ch);
        else next.add(ch);
        return next;
      });
      lastClickedRef.current = ch;
    } else {
      setSelected(new Set([ch]));
      lastClickedRef.current = ch;
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSliderVal(val);
    applySliderToSelected(val);
  };

  // Keep slider in sync with selection
  useEffect(() => {
    if (selected.size === 1) {
      const [ch] = selected;
      setSliderVal(values[ch - 1]);
    }
  }, [selected, values]);

  // ── ASSISTANT ──────────────────────────────────────────────
  const assistantStart = groupOffset * groupSize + 1; // 1-based first channel
  const assistantEnd = Math.min(assistantStart + groupSize - 1, UNIVERSE_SIZE);
  const assistantLabel = `${assistantStart}→${assistantEnd}`;

  const prevGroup = () => {
    if (groupOffset > 0) setGroupOffset((p) => p - 1);
  };

  const nextGroup = () => {
    if ((groupOffset + 1) * groupSize < UNIVERSE_SIZE) setGroupOffset((p) => p + 1);
  };

  const sendGroupAt100 = () => {
    setValues((prev) => {
      const next = [...prev];
      for (let ch = assistantStart; ch <= assistantEnd; ch++) {
        next[ch - 1] = 255;
        sendDmx(ch, 255);
      }
      return next;
    });
  };

  const sendGroupOnly = () => {
    // zero all, then set this group to 255
    const next = new Array(UNIVERSE_SIZE).fill(0);
    for (let ch = assistantStart; ch <= assistantEnd; ch++) {
      next[ch - 1] = 255;
    }
    setValues(next);
    for (let ch = 1; ch <= UNIVERSE_SIZE; ch++) {
      sendDmx(ch, next[ch - 1]);
    }
  };

  const sendNextGroup = () => {
    if ((groupOffset + 1) * groupSize >= UNIVERSE_SIZE) return;
    const nextOffset = groupOffset + 1;
    const start = nextOffset * groupSize + 1;
    const end = Math.min(start + groupSize - 1, UNIVERSE_SIZE);
    const next = new Array(UNIVERSE_SIZE).fill(0);
    for (let ch = start; ch <= end; ch++) {
      next[ch - 1] = 255;
    }
    setValues(next);
    for (let ch = 1; ch <= UNIVERSE_SIZE; ch++) {
      sendDmx(ch, next[ch - 1]);
    }
    setGroupOffset(nextOffset);
  };

  // cell color based on value
  const cellBg = (val: number) => {
    if (val === 0) return "bg-[#0d1117] hover:bg-white/5";
    const pct = val / 255;
    if (pct < 0.25) return "bg-cyan-900/40 hover:bg-cyan-900/60";
    if (pct < 0.5) return "bg-cyan-700/50 hover:bg-cyan-700/70";
    if (pct < 0.75) return "bg-cyan-500/60 hover:bg-cyan-500/80";
    return "bg-cyan-400/80 hover:bg-cyan-400";
  };

  const selLabel =
    selected.size === 0
      ? "Aucun canal sélectionné"
      : selected.size === 1
      ? `Canal ${[...selected][0]}`
      : `${selected.size} canaux sélectionnés`;

  return (
    <div className="flex flex-col h-full bg-[#07090d] text-white">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0c10]">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-cyan-400" />
          <h1 className="font-bold tracking-widest text-sm uppercase text-white">
            Testeur DMX
          </h1>
        </div>

        {/* Universe selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Univers
          </span>
          {[1, 2, 3, 4].map((u) => (
            <button
              key={u}
              onClick={() => {
                setUniverse(u);
                setValues(new Array(UNIVERSE_SIZE).fill(0));
                setSelected(new Set());
              }}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                universe === u
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-black/40 text-slate-500 border-white/5 hover:text-white hover:bg-white/5"
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Full ON / OFF */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => sendAll(255)}
            className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-bold text-cyan-400 transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            Full ON
          </button>
          <button
            onClick={() => sendAll(0)}
            className="flex items-center gap-2 px-4 py-1.5 bg-black/40 hover:bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all"
          >
            <ZapOff className="w-3.5 h-3.5" />
            Full OFF
          </button>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* GRID */}
        <div className="flex-1 overflow-auto p-4">
          <div
            className="grid gap-[2px] select-none"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: UNIVERSE_SIZE }, (_, i) => {
              const ch = i + 1;
              const val = values[i];
              const isSel = selected.has(ch);
              return (
                <div
                  key={ch}
                  onClick={(e) => handleCellClick(ch, e)}
                  className={`
                    relative flex flex-col items-center justify-between p-[3px] rounded cursor-pointer
                    border transition-all text-[9px] leading-none
                    ${cellBg(val)}
                    ${isSel ? "border-cyan-400 ring-1 ring-cyan-400/50" : "border-white/5"}
                  `}
                  style={{ minHeight: 40 }}
                  title={`Canal ${ch} — ${val}`}
                >
                  <span className="text-white/40 font-mono">{ch}</span>
                  <span
                    className={`font-bold font-mono ${
                      val === 0
                        ? "text-slate-600"
                        : val === 255
                        ? "text-cyan-300"
                        : "text-cyan-400"
                    }`}
                  >
                    {val}
                  </span>
                  {/* Value bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b bg-white/5">
                    <div
                      className="h-full bg-cyan-400 rounded-b"
                      style={{ width: `${(val / 255) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ASSISTANT PANEL ──────────────────────────────── */}
        <div className="w-64 border-l border-white/5 bg-[#0a0c10] flex flex-col p-4 gap-4 overflow-y-auto">
          <div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              Assistant
            </h3>

            {/* Group size */}
            <label className="text-xs text-slate-400 block mb-1">
              Canaux par groupe
            </label>
            <input
              type="number"
              min={1}
              max={32}
              value={groupSize}
              onChange={(e) =>
                setGroupSize(Math.max(1, Math.min(32, parseInt(e.target.value) || 1)))
              }
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 font-mono"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={prevGroup}
              disabled={groupOffset === 0}
              className="p-2 bg-black/40 hover:bg-white/5 border border-white/5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-mono text-cyan-400 font-bold flex-1 text-center">
              {assistantLabel}
            </span>
            <button
              onClick={nextGroup}
              disabled={(groupOffset + 1) * groupSize >= UNIVERSE_SIZE}
              className="p-2 bg-black/40 hover:bg-white/5 border border-white/5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Group actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={sendGroupAt100}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-bold text-cyan-400 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Envoyer à 100%
            </button>
            <button
              onClick={sendGroupOnly}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-black/40 hover:bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all"
            >
              Envoyer uniquement ces canaux
            </button>
            <button
              onClick={sendNextGroup}
              disabled={(groupOffset + 1) * groupSize >= UNIVERSE_SIZE}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-black/40 hover:bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Envoyer les suivants
            </button>
          </div>

          <div className="border-t border-white/5 pt-4">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Cliquez sur une cellule pour la sélectionner.
              <br />
              <span className="text-slate-600">Shift+clic</span> pour une plage.
              <br />
              <span className="text-slate-600">Ctrl+clic</span> pour ajouter.
            </p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────── */}
      <div className="border-t border-white/5 bg-[#0a0c10] px-6 py-3 flex items-center gap-6">
        <span className="text-xs text-slate-500 font-mono min-w-[200px]">
          {selLabel}
        </span>

        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs text-slate-600 font-mono w-4">0</span>
          <input
            type="range"
            min={0}
            max={255}
            value={sliderVal}
            onChange={handleSliderChange}
            disabled={selected.size === 0}
            className="flex-1 accent-cyan-400 disabled:opacity-30"
          />
          <span className="text-xs text-slate-600 font-mono w-6">255</span>
        </div>

        <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 min-w-[80px] justify-center">
          <span className="text-sm font-mono text-cyan-400 font-bold">
            {sliderVal}
          </span>
          <span className="text-xs text-slate-600">/ 255</span>
        </div>

        <button
          onClick={() => {
            setSelected(new Set());
            lastClickedRef.current = null;
          }}
          className="text-xs text-slate-500 hover:text-white transition-colors"
        >
          Désélectionner
        </button>
      </div>
    </div>
  );
}
