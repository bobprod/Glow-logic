'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { showAudioEngine } from '@/lib/ShowAudioEngine';

/**
 * WaveformView — lane waveform additive rendue SOUS la règle de la timeline.
 *
 * INVARIANT: composant purement visuel. Ne s'affiche (côté MacroTimeline) que
 * lorsqu'une piste audio est chargée. Aligné sur la fenêtre visible
 * [viewStartMs, viewEndMs] (zoom/pan). Clic/drag => onSeek(ms).
 *
 * Les données d'amplitude proviennent de showAudioEngine.getWaveformData(url, points)
 * (Promise<number[]> normalisé 0..1, longueur = points, sur TOUTE la piste).
 */
export interface WaveformViewProps {
  positionMs: number; // playhead courant (elapsed)
  viewStartMs: number; // début fenêtre visible (zoom/pan)
  viewEndMs: number; // fin fenêtre visible
  durationMs: number;
  onSeek: (ms: number) => void;
  heightPx?: number; // défaut ~48
  /**
   * URL de l'objet audio courant (audioObjectUrlRef.current côté intégration).
   * Sert à récupérer les données d'amplitude. Optionnel : si absent =>
   * placeholder discret, aucune erreur.
   */
  audioUrl?: string | null;
  /** Nombre de points d'échantillonnage de l'enveloppe (défaut 500). */
  points?: number;
}

const BG_COLOR = '#0a0c10';
const BAR_COLOR = '#22d3ee'; // cyan-400
const BAR_COLOR_DIM = '#334155'; // slate-700
const PLAYHEAD_COLOR = '#f8fafc'; // slate-50
const MIDLINE_COLOR = '#1e293b'; // slate-800

export default function WaveformView({
  positionMs,
  viewStartMs,
  viewEndMs,
  durationMs,
  onSeek,
  heightPx = 48,
  audioUrl = null,
  points = 500,
}: WaveformViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: heightPx });
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const draggingRef = useRef(false);

  // --- Récupération des données d'amplitude (par URL, avec cache interne moteur) ---
  useEffect(() => {
    let cancelled = false;
    if (!audioUrl) {
      setWaveform(null);
      return;
    }
    void showAudioEngine
      .getWaveformData(audioUrl, points)
      .then((data) => {
        if (!cancelled) setWaveform(Array.isArray(data) && data.length > 0 ? data : null);
      })
      .catch(() => {
        if (!cancelled) setWaveform(null);
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl, points]);

  // --- ResizeObserver : redessine au resize ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(0, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [heightPx]);

  // --- Conversion x(px) -> ms via interpolation viewStart..viewEnd sur la largeur ---
  const xToMs = useCallback(
    (xPx: number, widthPx: number): number => {
      const span = viewEndMs - viewStartMs;
      if (widthPx <= 0 || span <= 0) return viewStartMs;
      const ratio = Math.min(1, Math.max(0, xPx / widthPx));
      let ms = viewStartMs + ratio * span;
      if (durationMs > 0) ms = Math.min(durationMs, Math.max(0, ms));
      return ms;
    },
    [viewStartMs, viewEndMs, durationMs],
  );

  // --- Rendu canvas ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cssW = size.w;
    const cssH = size.h;
    if (cssW <= 0 || cssH <= 0) return;

    // Backing store HiDPI
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fond
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cssW, cssH);

    // Ligne médiane
    const midY = cssH / 2;
    ctx.strokeStyle = MIDLINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY + 0.5);
    ctx.lineTo(cssW, midY + 0.5);
    ctx.stroke();

    const span = viewEndMs - viewStartMs;
    const hasData = !!waveform && waveform.length > 0 && durationMs > 0 && span > 0;

    if (!hasData) {
      // Placeholder discret : pointillé médian, pas d'erreur.
      ctx.strokeStyle = BAR_COLOR_DIM;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, midY + 0.5);
      ctx.lineTo(cssW, midY + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const data = waveform as number[];
    const n = data.length;

    // Chaque point de la piste couvre [i/n, (i+1)/n] * durationMs.
    // On ne dessine QUE les points dont l'intervalle intersecte la fenêtre visible.
    const msPerPoint = durationMs / n;
    const firstIdx = Math.max(0, Math.floor(viewStartMs / msPerPoint));
    const lastIdx = Math.min(n - 1, Math.ceil(viewEndMs / msPerPoint));

    const maxBarH = cssH * 0.92;
    ctx.fillStyle = BAR_COLOR;

    for (let i = firstIdx; i <= lastIdx; i++) {
      const pointStartMs = i * msPerPoint;
      const pointEndMs = (i + 1) * msPerPoint;
      // bornes en px dans la fenêtre visible
      const x0 = ((pointStartMs - viewStartMs) / span) * cssW;
      const x1 = ((pointEndMs - viewStartMs) / span) * cssW;
      const left = Math.max(0, x0);
      const right = Math.min(cssW, x1);
      let bw = right - left;
      if (bw <= 0) continue;
      // petit espacement visuel si les barres sont larges
      const gap = bw > 3 ? 1 : 0;
      bw = Math.max(0.75, bw - gap);

      const amp = Math.min(1, Math.max(0, data[i]));
      const barH = Math.max(1, amp * maxBarH);
      ctx.fillRect(left, midY - barH / 2, bw, barH);
    }

    // Playhead vertical si dans la fenêtre visible
    if (positionMs >= viewStartMs && positionMs <= viewEndMs) {
      const px = ((positionMs - viewStartMs) / span) * cssW;
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, 0);
      ctx.lineTo(px + 0.5, cssH);
      ctx.stroke();
    }
  }, [waveform, size.w, size.h, viewStartMs, viewEndMs, durationMs, positionMs]);

  // --- Interactions clic / drag => seek ---
  const seekFromEvent = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ms = xToMs(clientX - rect.left, rect.width);
      onSeek(ms);
    },
    [xToMs, onSeek],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      draggingRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: heightPx, background: BG_COLOR }}
      className="relative w-full select-none"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  );
}
