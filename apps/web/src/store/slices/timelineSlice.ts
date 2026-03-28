import { StateCreator } from 'zustand';

export interface TimelineClip {
  id: string;
  track: 'lights' | 'visuals' | 'fx';
  name: string;
  startTime: number; // ms
  duration: number;  // ms
  color: string;
  textColor: string;
  qlcPage?: number;
  qlcWidget?: number;
}

export interface CueMarker {
  id: string;
  name: string;
  time: number; // ms
  color: string;
}

export interface TimelineSlice {
  clips: TimelineClip[];
  markers: CueMarker[];
  duration: number;
  zoom: number; // facteur zoom (1 = vue complète)
  viewStart: number; // ms visible début
  addClip: (clip: TimelineClip) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  deleteClip: (id: string) => void;
  addMarker: (marker: CueMarker) => void;
  deleteMarker: (id: string) => void;
  setDuration: (ms: number) => void;
  setZoom: (zoom: number) => void;
  setViewStart: (ms: number) => void;
}

export const createTimelineSlice: StateCreator<TimelineSlice, [], [], TimelineSlice> = (set) => ({
  clips: [
    { id: 'clip-1', track: 'lights',  name: 'INTRO BUILD',      startTime: 5000,  duration: 35000, color: 'bg-cyan-500',   textColor: 'text-cyan-400',   qlcPage: 1, qlcWidget: 10 },
    { id: 'clip-2', track: 'lights',  name: 'MAIN DROP STROBE', startTime: 60000, duration: 60000, color: 'bg-pink-500',   textColor: 'text-pink-400',   qlcPage: 1, qlcWidget: 11 },
    { id: 'clip-3', track: 'visuals', name: 'VJ LOOP 04',       startTime: 60000, duration: 40000, color: 'bg-purple-500', textColor: 'text-purple-400', qlcPage: 1, qlcWidget: 20 },
  ],
  markers: [
    { id: 'mkr-1', name: 'INTRO',    time: 0,      color: '#22d3ee' },
    { id: 'mkr-2', name: 'DROP',     time: 60000,  color: '#f43f5e' },
    { id: 'mkr-3', name: 'OUTRO',    time: 180000, color: '#a78bfa' },
  ],
  duration: 5 * 60 * 1000,
  zoom: 1,
  viewStart: 0,

  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  updateClip: (id, updates) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
  deleteClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),

  addMarker: (marker) => set((s) => ({ markers: [...s.markers, marker] })),
  deleteMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),

  setDuration: (ms) => set({ duration: ms }),
  setZoom: (zoom) => set({ zoom }),
  setViewStart: (ms) => set({ viewStart: ms }),
});
