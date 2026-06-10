import { StateCreator } from 'zustand';
import type { AutomationTrackContract, Keyframe, MediaClip } from '../../types/show';

export interface TimelineClip extends Partial<MediaClip> {
  id: string;
  track: 'lights' | 'visuals' | 'fx';
  name: string;
  startTime: number; // ms
  duration: number;  // ms
  color: string;
  secondaryColor?: string; // Optional secondary color for bi-color clips
  textColor: string;
  qlcPage?: number;
  qlcWidget?: number;
  dmxCommands?: Array<{ universe: number; channel: number; value: number }>;
  sourceType?: 'pad' | 'scene' | 'cue' | 'chaser' | 'media' | 'manual';
  sourceId?: string;
}

export interface CueMarker {
  id: string;
  name: string;
  time: number; // ms
  color: string;
}

export type AutomationChannelType =
  | 'dimmer'
  | 'pan'
  | 'tilt'
  | 'red'
  | 'green'
  | 'blue'
  | 'strobe'
  | 'color'
  | 'custom';

export interface AutomationKeyframe {
  id: string;
  timeMs: number;
  value: number;
}

export interface AutomationTrack extends Partial<AutomationTrackContract> {
  id: string;
  label: string;
  fixtureId: string;
  universe: number;
  channel: number;
  channelType: AutomationChannelType;
  color: string;
  enabled: boolean;
  keyframes: Array<AutomationKeyframe & Keyframe>;
}

export interface TimelineSlice {
  clips: TimelineClip[];
  markers: CueMarker[];
  automationTracks: AutomationTrack[];
  duration: number;
  zoom: number; // facteur zoom (1 = vue complète)
  viewStart: number; // ms visible début
  trackSequences: Record<string, { clips: TimelineClip[], markers: CueMarker[], automationTracks?: AutomationTrack[], duration: number }>;

  addClip: (clip: TimelineClip) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  deleteClip: (id: string) => void;
  addMarker: (marker: CueMarker) => void;
  deleteMarker: (id: string) => void;
  addAutomationTrack: (track: AutomationTrack) => void;
  updateAutomationTrack: (id: string, updates: Partial<AutomationTrack>) => void;
  deleteAutomationTrack: (id: string) => void;
  addAutomationKeyframe: (trackId: string, keyframe: AutomationKeyframe) => void;
  updateAutomationKeyframe: (trackId: string, keyframeId: string, updates: Partial<AutomationKeyframe>) => void;
  deleteAutomationKeyframe: (trackId: string, keyframeId: string) => void;
  setDuration: (ms: number) => void;
  setZoom: (zoom: number) => void;
  setViewStart: (ms: number) => void;
  saveActiveTimeline: (trackId: string) => void;
  loadActiveTimeline: (trackId: string) => void;
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
  automationTracks: [
    {
      id: 'auto-dimmer-6',
      label: 'Dimmer U1 CH6',
      fixtureId: 'universe-1-channel-6',
      universe: 1,
      channel: 6,
      channelType: 'dimmer',
      color: '#22d3ee',
      enabled: true,
      keyframes: [
        { id: 'kf-dim-0', timeMs: 0, value: 0 },
        { id: 'kf-dim-1', timeMs: 30000, value: 255 },
        { id: 'kf-dim-2', timeMs: 60000, value: 180 },
      ],
    },
    {
      id: 'auto-pan-1',
      label: 'Pan U1 CH1',
      fixtureId: 'universe-1-channel-1',
      universe: 1,
      channel: 1,
      channelType: 'pan',
      color: '#a78bfa',
      enabled: true,
      keyframes: [
        { id: 'kf-pan-0', timeMs: 0, value: 96 },
        { id: 'kf-pan-1', timeMs: 60000, value: 192 },
      ],
    },
  ],
  duration: 5 * 60 * 1000,
  zoom: 1,
  viewStart: 0,
  trackSequences: {},

  addClip: (clip) => set((s) => ({ clips: [...s.clips, clip] })),
  updateClip: (id, updates) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
  deleteClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),

  addMarker: (marker) => set((s) => ({ markers: [...s.markers, marker] })),
  deleteMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),

  addAutomationTrack: (track) => set((s) => ({ automationTracks: [...s.automationTracks, track] })),
  updateAutomationTrack: (id, updates) =>
    set((s) => ({
      automationTracks: s.automationTracks.map((track) => (track.id === id ? { ...track, ...updates } : track)),
    })),
  deleteAutomationTrack: (id) =>
    set((s) => ({ automationTracks: s.automationTracks.filter((track) => track.id !== id) })),
  addAutomationKeyframe: (trackId, keyframe) =>
    set((s) => ({
      automationTracks: s.automationTracks.map((track) =>
        track.id === trackId
          ? { ...track, keyframes: [...track.keyframes, keyframe].sort((a, b) => a.timeMs - b.timeMs) }
          : track
      ),
    })),
  updateAutomationKeyframe: (trackId, keyframeId, updates) =>
    set((s) => ({
      automationTracks: s.automationTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              keyframes: track.keyframes
                .map((keyframe) => (keyframe.id === keyframeId ? { ...keyframe, ...updates } : keyframe))
                .sort((a, b) => a.timeMs - b.timeMs),
            }
          : track
      ),
    })),
  deleteAutomationKeyframe: (trackId, keyframeId) =>
    set((s) => ({
      automationTracks: s.automationTracks.map((track) =>
        track.id === trackId
          ? { ...track, keyframes: track.keyframes.filter((keyframe) => keyframe.id !== keyframeId) }
          : track
      ),
    })),

  setDuration: (ms) => set({ duration: ms }),
  setZoom: (zoom) => set({ zoom }),
  setViewStart: (ms) => set({ viewStart: ms }),

  saveActiveTimeline: (trackId) => set((s) => ({
    trackSequences: {
      ...s.trackSequences,
      [trackId]: { clips: s.clips, markers: s.markers, automationTracks: s.automationTracks, duration: s.duration }
    }
  })),

  loadActiveTimeline: (trackId) => set((s) => {
    const saved = s.trackSequences[trackId];
    if (saved) {
      return {
        clips: saved.clips,
        markers: saved.markers,
        automationTracks: saved.automationTracks ?? [],
        duration: saved.duration,
      };
    } else {
      // Initialize fresh timeline
      return { clips: [], markers: [], automationTracks: [], duration: 3 * 60 * 1000 };
    }
  }),
});
