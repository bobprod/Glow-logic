"use client";
import { useEffect } from "react";
import useStore from "../store/useStore";

/**
 * useSmartHotkeys — keyboard shortcuts for Smart mode operator control.
 *
 * Space / b    → toggle blackout
 * ArrowRight   → next track in playlist
 * ArrowLeft    → previous track in playlist
 * l            → toggle show lock
 * Escape       → exit smart edit mode (if active)
 * 1-9          → trigger pad #N (0-based index N-1)
 */
export function useSmartHotkeys() {
  const blackout = useStore((s) => s.blackout);
  const setBlackout = useStore((s) => s.setBlackout);
  const playlist = useStore((s) => s.playlist);
  const currentTrackIndex = useStore((s) => s.currentTrackIndex);
  const setCurrentTrackIndex = useStore((s) => s.setCurrentTrackIndex);
  const showLock = useStore((s) => s.showLock);
  const setShowLock = useStore((s) => s.setShowLock);
  const smartPads = useStore((s) => s.smartPads);
  const triggerSmartPad = useStore((s) => s.triggerSmartPad);
  const smartEditMode = useStore((s) => s.smartEditMode);
  const setSmartEditMode = useStore((s) => s.setSmartEditMode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
        case "b": {
          e.preventDefault();
          setBlackout(!blackout);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (playlist.length > 0) {
            setCurrentTrackIndex(Math.min(currentTrackIndex + 1, playlist.length - 1));
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (playlist.length > 0) {
            setCurrentTrackIndex(Math.max(currentTrackIndex - 1, 0));
          }
          break;
        }
        case "l": {
          setShowLock(!showLock);
          break;
        }
        case "Escape": {
          if (smartEditMode) setSmartEditMode(false);
          break;
        }
        default: {
          if (e.key >= "1" && e.key <= "9") {
            const padIndex = parseInt(e.key, 10) - 1;
            const pad = smartPads[padIndex];
            if (pad) triggerSmartPad(pad);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    blackout,
    currentTrackIndex,
    playlist.length,
    setBlackout,
    setCurrentTrackIndex,
    setShowLock,
    setSmartEditMode,
    showLock,
    smartEditMode,
    smartPads,
    triggerSmartPad,
  ]);
}
