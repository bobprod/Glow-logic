import { StateCreator } from 'zustand';
import type { AutomationTrackContract, Keyframe, MediaClip } from '../../types/show';
import { isReplayingHistory, pushHistory } from '../history';

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
  /** Masking A2: absolute DMX channels (1..512) enabled for this clip. undefined = all channels, [] = none. */
  enabledChannels?: number[];
  /** Crossfade A3: fade duration in seconds applied when the clip triggers its DMX. undefined/0 = instant. */
  fadeSeconds?: number;
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

export type AutomationEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold';

export interface AutomationKeyframe {
  id: string;
  timeMs: number;
  value: number;
  easing?: AutomationEasing;
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

export interface AutomationTrackMeta {
  label: string;
  universe: number;
  channel: number;
  color: string;
  enabled?: boolean;
}

export type AutomationKeyframeInput = Pick<AutomationKeyframe, 'timeMs' | 'value'> &
  Partial<Pick<AutomationKeyframe, 'id' | 'easing'>>;

export interface TimelineSlice {
  clips: TimelineClip[];
  markers: CueMarker[];
  automationTracks: AutomationTrack[];
  automationRecArmed: boolean;
  recTargetFixtureId: string | null;
  timelinePlaying: boolean;
  playheadMs: number;
  duration: number;
  zoom: number; // facteur zoom (1 = vue complète)
  viewStart: number; // ms visible début
  trackSequences: Record<string, { clips: TimelineClip[], markers: CueMarker[], automationTracks?: AutomationTrack[], duration: number }>;
  /**
   * Inter-morceau marker clipboard (B5). Stores raw copies of the selected markers
   * (absolute time at copy moment). The relative-offset / playhead positioning transform
   * stays in MacroTimeline (A4 behaviour). Living in the store means the clipboard SURVIVES
   * a trackSequences save/load (song switch), since loadActiveTimeline only swaps
   * clips/markers/automationTracks/duration and never touches markerClipboard.
   * Transient de session: non persisté (voir partialize côté store si persist actif).
   */
  markerClipboard: CueMarker[];

  addClip: (clip: TimelineClip) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  setClipMask: (clipId: string, channels: number[] | undefined) => void;
  setClipFade: (clipId: string, seconds: number) => void;
  deleteClip: (id: string) => void;
  addMarker: (marker: CueMarker) => void;
  updateMarker: (id: string, updates: Partial<CueMarker>) => void;
  deleteMarker: (id: string) => void;
  addMarkers: (markers: CueMarker[]) => void;
  setMarkerClipboard: (markers: CueMarker[]) => void;
  updateMarkers: (updates: Array<{ id: string; changes: Partial<CueMarker> }>) => void;
  moveMarkers: (ids: string[], deltaMs: number) => void;
  deleteMarkers: (ids: string[]) => void;
  addAutomationTrack: (track: AutomationTrack) => void;
  updateAutomationTrack: (id: string, updates: Partial<AutomationTrack>) => void;
  deleteAutomationTrack: (id: string) => void;
  addAutomationKeyframe: (trackId: string, keyframe: AutomationKeyframe) => void;
  updateAutomationKeyframe: (trackId: string, keyframeId: string, updates: Partial<AutomationKeyframe>) => void;
  deleteAutomationKeyframe: (trackId: string, keyframeId: string) => void;
  setAutomationRecArmed: (armed: boolean, fixtureId?: string | null) => void;
  setTimelinePlaybackState: (playing: boolean, playheadMs?: number) => void;
  getOrCreateAutomationTrack: (fixtureId: string, channelType: 'pan' | 'tilt', meta: AutomationTrackMeta) => string;
  recordKeyframeBatch: (trackId: string, keyframes: AutomationKeyframeInput[], range: { fromMs: number; toMs: number }) => void;
  setDuration: (ms: number) => void;
  setZoom: (zoom: number) => void;
  setViewStart: (ms: number) => void;
  saveActiveTimeline: (trackId: string) => void;
  loadActiveTimeline: (trackId: string) => void;
}

export const createTimelineSlice: StateCreator<TimelineSlice, [], [], TimelineSlice> = (set, get) => ({
  clips: [],
  markers: [],
  automationTracks: [],
  automationRecArmed: false,
  recTargetFixtureId: null,
  timelinePlaying: false,
  playheadMs: 0,
  duration: 5 * 60 * 1000,
  zoom: 1,
  viewStart: 0,
  trackSequences: {},
  markerClipboard: [],

  addClip: (clip) => {
    const before = get().clips;
    const after = [...before, clip];
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Clip ajoute: ${clip.name}`,
        undo: () => set({ clips: before }),
        redo: () => set({ clips: after }),
      });
    }
    set({ clips: after });
  },
  updateClip: (id, updates) => {
    const before = get().clips;
    const clip = before.find((candidate) => candidate.id === id);
    if (!clip) return;
    const afterClip = { ...clip, ...updates };
    const after = before.map((candidate) => (candidate.id === id ? afterClip : candidate));
    const structural = updates.startTime !== undefined || updates.duration !== undefined || updates.track !== undefined;
    if (!isReplayingHistory() && structural) {
      pushHistory({
        label: `Clip modifie: ${clip.name}`,
        coalesceKey: `timeline-clip:${id}`,
        undo: () => set({ clips: before }),
        redo: () => set({ clips: after }),
      });
    }
    set({ clips: after });
  },
  setClipMask: (clipId, channels) => {
    const before = get().clips;
    const clip = before.find((candidate) => candidate.id === clipId);
    if (!clip) return;
    const normalized =
      channels === undefined
        ? undefined
        : Array.from(
            new Set(
              channels.filter((channel) => Number.isInteger(channel) && channel >= 1 && channel <= 512),
            ),
          ).sort((a, b) => a - b);
    const afterClip = { ...clip, enabledChannels: normalized };
    const after = before.map((candidate) => (candidate.id === clipId ? afterClip : candidate));
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Clip masque: ${clip.name}`,
        coalesceKey: `timeline-clip-mask:${clipId}`,
        undo: () => set({ clips: before }),
        redo: () => set({ clips: after }),
      });
    }
    set({ clips: after });
  },
  setClipFade: (clipId, seconds) => {
    const before = get().clips;
    const clip = before.find((candidate) => candidate.id === clipId);
    if (!clip) return;
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const afterClip = { ...clip, fadeSeconds: safeSeconds };
    const after = before.map((candidate) => (candidate.id === clipId ? afterClip : candidate));
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Clip fondu: ${clip.name}`,
        coalesceKey: `timeline-clip-fade:${clipId}`,
        undo: () => set({ clips: before }),
        redo: () => set({ clips: after }),
      });
    }
    set({ clips: after });
  },
  deleteClip: (id) => {
    const before = get().clips;
    const deleted = before.find((clip) => clip.id === id);
    if (!deleted) return;
    const after = before.filter((clip) => clip.id !== id);
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Clip supprime: ${deleted.name}`,
        undo: () => set({ clips: before }),
        redo: () => set({ clips: after }),
      });
    }
    set({ clips: after });
  },

  addMarker: (marker) => {
    const before = get().markers;
    const after = [...before, marker];
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Marker ajoute: ${marker.name}`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },
  updateMarker: (id, updates) => {
    const before = get().markers;
    const target = before.find((marker) => marker.id === id);
    if (!target) return;
    const after = before.map((marker) => (marker.id === id ? { ...marker, ...updates } : marker));
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Marker modifie: ${target.name}`,
        coalesceKey: `marker:${id}`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },
  deleteMarker: (id) => {
    const before = get().markers;
    const deleted = before.find((marker) => marker.id === id);
    if (!deleted) return;
    const after = before.filter((marker) => marker.id !== id);
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Marker supprime: ${deleted.name}`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },

  addMarkers: (markers) => {
    if (markers.length === 0) return;
    const before = get().markers;
    const sanitized = markers.map((marker) => ({
      ...marker,
      time: Math.max(0, marker.time),
    }));
    const after = [...before, ...sanitized];
    if (!isReplayingHistory()) {
      pushHistory({
        label: `${sanitized.length} markers ajoutes`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },
  setMarkerClipboard: (markers) =>
    // Copie défensive (snapshot immuable) — pas d'historique (action de presse-papier, non destructive).
    set({ markerClipboard: markers.map((marker) => ({ ...marker })) }),
  updateMarkers: (updates) => {
    if (updates.length === 0) return;
    const before = get().markers;
    const changeById = new Map(updates.map((entry) => [entry.id, entry.changes]));
    let touched = false;
    const after = before.map((marker) => {
      const changes = changeById.get(marker.id);
      if (!changes) return marker;
      touched = true;
      const next = { ...marker, ...changes };
      if (changes.time !== undefined) next.time = Math.max(0, changes.time);
      return next;
    });
    if (!touched) return;
    const ids = updates.map((entry) => entry.id).sort();
    if (!isReplayingHistory()) {
      pushHistory({
        label: `${ids.length} markers modifies`,
        coalesceKey: `marker-bulk:${ids.join(',')}`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },
  moveMarkers: (ids, deltaMs) => {
    if (ids.length === 0) return;
    const before = get().markers;
    const idSet = new Set(ids);
    let touched = false;
    const after = before.map((marker) => {
      if (!idSet.has(marker.id)) return marker;
      touched = true;
      return { ...marker, time: Math.max(0, marker.time + deltaMs) };
    });
    if (!touched) return;
    const sortedIds = [...ids].sort();
    if (!isReplayingHistory()) {
      pushHistory({
        label: `${ids.length} markers deplaces`,
        coalesceKey: `marker-bulk:${sortedIds.join(',')}`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },
  deleteMarkers: (ids) => {
    if (ids.length === 0) return;
    const before = get().markers;
    const idSet = new Set(ids);
    const after = before.filter((marker) => !idSet.has(marker.id));
    if (after.length === before.length) return;
    if (!isReplayingHistory()) {
      pushHistory({
        label: `${before.length - after.length} markers supprimes`,
        undo: () => set({ markers: before }),
        redo: () => set({ markers: after }),
      });
    }
    set({ markers: after });
  },

  addAutomationTrack: (track) => {
    const before = get().automationTracks;
    const after = [...before, track];
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Automation ajoutee: ${track.label}`,
        undo: () => set({ automationTracks: before }),
        redo: () => set({ automationTracks: after }),
      });
    }
    set({ automationTracks: after });
  },
  updateAutomationTrack: (id, updates) => {
    const before = get().automationTracks;
    const target = before.find((track) => track.id === id);
    if (!target) return;
    const after = before.map((track) => (track.id === id ? { ...track, ...updates } : track));
    const structural = updates.label !== undefined || updates.universe !== undefined || updates.channel !== undefined || updates.channelType !== undefined || updates.enabled !== undefined;
    if (!isReplayingHistory() && structural) {
      pushHistory({
        label: `Automation modifiee: ${target.label}`,
        coalesceKey: `automation-track:${id}`,
        undo: () => set({ automationTracks: before }),
        redo: () => set({ automationTracks: after }),
      });
    }
    set({ automationTracks: after });
  },
  deleteAutomationTrack: (id) => {
    const before = get().automationTracks;
    const deleted = before.find((track) => track.id === id);
    if (!deleted) return;
    const after = before.filter((track) => track.id !== id);
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Automation supprimee: ${deleted.label}`,
        undo: () => set({ automationTracks: before }),
        redo: () => set({ automationTracks: after }),
      });
    }
    set({ automationTracks: after });
  },
  addAutomationKeyframe: (trackId, keyframe) => {
    const before = get().automationTracks;
    const target = before.find((track) => track.id === trackId);
    if (!target) return;
    const after = before.map((track) =>
      track.id === trackId
        ? { ...track, keyframes: [...track.keyframes, keyframe].sort((a, b) => a.timeMs - b.timeMs) }
        : track
    );
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Keyframe ajoutee: ${target.label}`,
        undo: () => set({ automationTracks: before }),
        redo: () => set({ automationTracks: after }),
      });
    }
    set({ automationTracks: after });
  },
  updateAutomationKeyframe: (trackId, keyframeId, updates) => {
    const before = get().automationTracks;
    const target = before.find((track) => track.id === trackId);
    const keyframe = target?.keyframes.find((candidate) => candidate.id === keyframeId);
    if (!target || !keyframe) return;
    const after = before.map((track) =>
      track.id === trackId
        ? {
            ...track,
            keyframes: track.keyframes
              .map((candidate) => (candidate.id === keyframeId ? { ...candidate, ...updates } : candidate))
              .sort((a, b) => a.timeMs - b.timeMs),
          }
        : track
    );
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Keyframe modifiee: ${target.label}`,
        coalesceKey: `automation-keyframe:${trackId}:${keyframeId}`,
        undo: () => set({ automationTracks: before }),
        redo: () => set({ automationTracks: after }),
      });
    }
    set({ automationTracks: after });
  },
  deleteAutomationKeyframe: (trackId, keyframeId) => {
    const before = get().automationTracks;
    const target = before.find((track) => track.id === trackId);
    const deleted = target?.keyframes.find((keyframe) => keyframe.id === keyframeId);
    if (!target || !deleted) return;
    const after = before.map((track) =>
      track.id === trackId
        ? { ...track, keyframes: track.keyframes.filter((keyframe) => keyframe.id !== keyframeId) }
        : track
    );
    if (!isReplayingHistory()) {
      pushHistory({
        label: `Keyframe supprimee: ${target.label}`,
        undo: () => set({ automationTracks: before }),
        redo: () => set({ automationTracks: after }),
      });
    }
    set({ automationTracks: after });
  },
  setAutomationRecArmed: (armed, fixtureId = null) =>
    set((s) => ({
      automationRecArmed: armed,
      recTargetFixtureId: armed ? fixtureId ?? s.recTargetFixtureId : null,
    })),
  setTimelinePlaybackState: (playing, playheadMs) =>
    set((s) => ({
      timelinePlaying: playing,
      playheadMs: playheadMs ?? s.playheadMs,
    })),
  getOrCreateAutomationTrack: (fixtureId, channelType, meta) => {
    const existing = get().automationTracks.find(
      (track) => track.fixtureId === fixtureId && track.channelType === channelType,
    );
    if (existing) {
      set((s) => ({
        automationTracks: s.automationTracks.map((track) =>
          track.id === existing.id ? { ...track, ...meta, enabled: meta.enabled ?? track.enabled } : track
        ),
      }));
      return existing.id;
    }

    const id = `auto-${fixtureId}-${channelType}-${Date.now()}`;
    const track: AutomationTrack = {
      id,
      fixtureId,
      channelType,
      label: meta.label,
      universe: meta.universe,
      channel: meta.channel,
      color: meta.color,
      enabled: meta.enabled ?? true,
      keyframes: [],
    };
    set((s) => ({ automationTracks: [...s.automationTracks, track] }));
    return id;
  },
  recordKeyframeBatch: (trackId, keyframes, range) =>
    set((s) => {
      const fromMs = Math.min(range.fromMs, range.toMs);
      const toMs = Math.max(range.fromMs, range.toMs);
      return {
        automationTracks: s.automationTracks.map((track) => {
          if (track.id !== trackId) return track;
          const incoming = keyframes.map((keyframe, index) => ({
            ...keyframe,
            id: keyframe.id ?? `kf-${trackId}-${Math.round(keyframe.timeMs)}-${index}-${Date.now()}`,
            timeMs: Math.max(0, Math.round(keyframe.timeMs)),
            value: Math.max(0, Math.min(255, Math.round(keyframe.value))),
            easing: keyframe.easing ?? 'linear',
          }));
          return {
            ...track,
            keyframes: [
              ...track.keyframes.filter((keyframe) => keyframe.timeMs < fromMs || keyframe.timeMs > toMs),
              ...incoming,
            ].sort((a, b) => a.timeMs - b.timeMs),
          };
        }),
      };
    }),

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
