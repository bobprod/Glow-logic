'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import useStore from '../../store/useStore';
import { renderPixelMapToCanvas, DEFAULT_PIXELMAP_CONFIG } from '../../lib/pixelMapEngine';
import type { PixelMapConfig } from '../../lib/pixelMapEngine';

/**
 * PixelMapProjector — overlay plein écran (output projecteur) rendant le même champ
 * de couleur que le chemin DMX v1, plus calques image/texte, via renderPixelMapToCanvas.
 *
 * ADDITIF & inoffensif : retourne null tant que pixelMap.projectorOpen est faux.
 * Aucune incidence sur le chemin DMX (v1 intact).
 */

/** État pixelMap étendu (champs A10 v2 optionnels) lu de façon tolérante depuis le store. */
type PixelMapState = { enabled: boolean } & PixelMapConfig & {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  projectorOpen?: boolean;
};

export default function PixelMapProjector(): React.JSX.Element | null {
  // Accès tolérant : le slice peut ne pas encore exposer projectorOpen/setProjectorOpen
  // selon l'ordre de montage des agents. On lit avec des valeurs de repli sûres.
  const pixelMap = useStore((s) => (s as unknown as { pixelMap?: PixelMapState }).pixelMap)
    ?? ({ enabled: false, ...DEFAULT_PIXELMAP_CONFIG } as PixelMapState);
  const setProjectorOpen = useStore(
    (s) => (s as unknown as { setProjectorOpen?: (v: boolean) => void }).setProjectorOpen,
  );

  const projectorOpen = pixelMap.projectorOpen === true;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // Référence vivante de la config pour la boucle rAF (évite de relancer la boucle à chaque patch).
  const cfgRef = useRef<PixelMapState>(pixelMap);
  cfgRef.current = pixelMap;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const close = useCallback(() => {
    if (typeof setProjectorOpen === 'function') {
      setProjectorOpen(false);
    }
  }, [setProjectorOpen]);

  // --- Chargement de l'image depuis imageUrl ---
  useEffect(() => {
    if (!projectorOpen) {
      imageRef.current = null;
      return;
    }
    const url = pixelMap.imageUrl;
    if (!url) {
      imageRef.current = null;
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) imageRef.current = img;
    };
    img.onerror = () => {
      if (!cancelled) imageRef.current = null;
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [projectorOpen, pixelMap.imageUrl]);

  // --- Chargement de la vidéo depuis videoUrl (calque projecteur uniquement) ---
  useEffect(() => {
    if (!projectorOpen) {
      const prev = videoRef.current;
      if (prev) {
        try {
          prev.pause();
        } catch {
          /* noop */
        }
        prev.removeAttribute('src');
        try {
          prev.load();
        } catch {
          /* noop */
        }
      }
      videoRef.current = null;
      return;
    }
    const url = pixelMap.videoUrl;
    if (!url) {
      const prev = videoRef.current;
      if (prev) {
        try {
          prev.pause();
        } catch {
          /* noop */
        }
        prev.removeAttribute('src');
      }
      videoRef.current = null;
      return;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    void video.play().catch(() => {});
    videoRef.current = video;
    return () => {
      try {
        video.pause();
      } catch {
        /* noop */
      }
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* noop */
      }
      if (videoRef.current === video) videoRef.current = null;
    };
  }, [projectorOpen, pixelMap.videoUrl]);

  // --- Resize HiDPI (canvas plein écran) ---
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio
        ? window.devicePixelRatio
        : 1;
    const w = container?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0);
    const h = container?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  // --- Boucle de rendu requestAnimationFrame ---
  useEffect(() => {
    if (!projectorOpen) return;

    resize();

    const tick = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderPixelMapToCanvas(
            ctx,
            cfgRef.current,
            typeof performance !== 'undefined' ? performance.now() : Date.now(),
            canvas.width,
            canvas.height,
            imageRef.current,
            videoRef.current,
          );
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Resize listeners (window + ResizeObserver sur le conteneur)
    let observer: ResizeObserver | null = null;
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize);
    }
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => resize());
      observer.observe(containerRef.current);
    }

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', resize);
      }
      if (observer) observer.disconnect();
    };
  }, [projectorOpen, resize]);

  // --- Échap ferme + suivi de l'état plein écran ---
  useEffect(() => {
    if (!projectorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Si on est en fullscreen natif, l'API gère déjà la sortie ; sinon on ferme l'overlay.
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          return;
        }
        close();
      }
    };
    const onFsChange = () => {
      setIsFullscreen(
        typeof document !== 'undefined' && document.fullscreenElement != null,
      );
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [projectorOpen, close]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el || typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else if (typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => {});
    }
  }, []);

  if (!projectorOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#000000',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 8,
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.55)',
            color: '#22d3ee',
            fontSize: 13,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          {isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
        </button>
        <button
          type="button"
          onClick={close}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.55)',
            color: '#f43f5e',
            fontSize: 13,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
