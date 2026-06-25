import { StateCreator } from 'zustand';
import { API_BASE } from '../../lib/config';
import { isReplayingHistory, pushHistory } from '../history';

export interface ShowTrack {
  id: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  fileType: 'audio' | 'video';
  volume: number;
  lightMode: 'manuel' | 'ia' | 'programme';
  aiPreset: 'rock' | 'jazz' | 'club' | 'tv';
  duration: number;
  isPause: boolean;
  pauseDuration: number;
}

export interface DmxGroup {
  id: string;
  name: string;
  color: string;
  fixtureIds: string[];
  order: number;
  backendZone?: string;
}

export interface GroupPreset {
  id: string;
  name: string;
  groups: DmxGroup[];
  levels: Record<string, number>;
}

export interface ShowPlayerSlice {
  playlist: ShowTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  masterVolume: number;
  audioSource: 'player' | 'mic';
  dmxGroups: DmxGroup[];
  groupPresets: GroupPreset[];
  groupLevels: Record<string, number>;
  groupMutes: Record<string, boolean>;
  groupColors: Record<string, string>;
  isRecording: boolean;
  recordingStartTime: number | null;

  setPlaylist: (list: ShowTrack[]) => void;
  addTrack: (track: ShowTrack) => void;
  removeTrack: (id: string) => void;
  reorderTracks: (startIndex: number, endIndex: number) => void;
  setCurrentTrackIndex: (idx: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setMasterVolume: (vol: number) => void;
  setTrackVolume: (id: string, vol: number) => void;
  updateTrackSettings: (id: string, updates: Partial<ShowTrack>) => void;
  setAudioSource: (src: 'player' | 'mic') => void;
  fetchDmxGroups: () => Promise<void>;
  setDmxGroups: (groups: DmxGroup[]) => void;
  addDmxGroup: () => void;
  updateDmxGroup: (id: string, updates: Partial<DmxGroup>) => void;
  deleteDmxGroup: (id: string) => void;
  reorderDmxGroups: (fromOrder: number, toOrder: number) => void;
  setGroupLevel: (group: string, val: number) => void;
  setGroupMute: (group: string, val: boolean) => void;
  setGroupColor: (group: string, hex: string) => void;
  saveGroupPreset: (name: string) => void;
  applyGroupPreset: (id: string) => void;
  deleteGroupPreset: (id: string) => void;
  setIsRecording: (rec: boolean) => void;
}

const DEFAULT_PLAYLIST: ShowTrack[] = [
  {
    id: 'demo-1',
    name: 'Intro Glow (Rock Ambient)',
    fileUrl: '',
    fileName: 'intro_glow.mp3',
    fileType: 'audio',
    volume: 0.8,
    lightMode: 'ia',
    aiPreset: 'rock',
    duration: 124,
    isPause: false,
    pauseDuration: 0,
  },
  {
    id: 'demo-pause',
    name: 'Pause Regie (10s)',
    fileUrl: '',
    fileType: 'audio',
    volume: 0,
    lightMode: 'manuel',
    aiPreset: 'tv',
    duration: 10,
    isPause: true,
    pauseDuration: 10,
  },
  {
    id: 'demo-2',
    name: 'Neon Dream Visuals (Drop Club)',
    fileUrl: '',
    fileName: 'neon_dream.mp4',
    fileType: 'video',
    volume: 0.9,
    lightMode: 'programme',
    aiPreset: 'club',
    duration: 180,
    isPause: false,
    pauseDuration: 0,
  },
];

export const DEFAULT_DMX_GROUPS: DmxGroup[] = [
  { id: 'face', name: 'Face', color: '#ffffff', fixtureIds: [], order: 0, backendZone: 'Face' },
  { id: 'douche-1', name: 'Douche 1', color: '#3b82f6', fixtureIds: [], order: 1, backendZone: 'Piste' },
  { id: 'douche-2', name: 'Douche 2', color: '#22c55e', fixtureIds: [], order: 2, backendZone: 'Dancefloor' },
  { id: 'douche-3', name: 'Douche 3', color: '#ef4444', fixtureIds: [], order: 3, backendZone: 'Bar' },
  { id: 'lateral', name: 'Lateral', color: '#a855f7', fixtureIds: [], order: 4, backendZone: 'Fond' },
  { id: 'contre', name: 'Contre', color: '#e879f9', fixtureIds: [], order: 5, backendZone: 'Fond' },
];

const LEGACY_GROUP_ALIASES: Record<string, string> = {
  Face: 'face',
  'Douche 1': 'douche-1',
  'Douche 2': 'douche-2',
  'Douche 3': 'douche-3',
  Lateral: 'lateral',
  'Latéral': 'lateral',
  Contre: 'contre',
};

const BACKEND_ZONE_BY_NAME: Record<string, string> = {
  Face: 'Face',
  'Douche 1': 'Piste',
  'Douche 2': 'Dancefloor',
  'Douche 3': 'Bar',
  Lateral: 'Fond',
  Contre: 'Fond',
};

function clampPercent(value: unknown, fallback = 80) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'groupe';
}

function recordByGroupId<T>(record: Record<string, T> | undefined, groups: DmxGroup[], fallback: (group: DmxGroup) => T) {
  const source = record || {};
  return groups.reduce<Record<string, T>>((acc, group) => {
    const legacyKey = Object.entries(LEGACY_GROUP_ALIASES).find(([, id]) => id === group.id)?.[0];
    acc[group.id] = source[group.id] ?? (legacyKey ? source[legacyKey] : undefined) ?? fallback(group);
    return acc;
  }, {});
}

export function normalizeDmxGroups(input: unknown, fallbackGroups: DmxGroup[] = DEFAULT_DMX_GROUPS): DmxGroup[] {
  const source = Array.isArray(input) && input.length > 0 ? input : fallbackGroups;
  return source
    .map((raw, index) => {
      const group = raw as Partial<DmxGroup> & { role?: string | null };
      const name = String(group.name || DEFAULT_DMX_GROUPS[index]?.name || `Groupe ${index + 1}`);
      const id = String(group.id || slugify(name));
      return {
        id,
        name,
        color: String(group.color || DEFAULT_DMX_GROUPS[index]?.color || '#06b6d4'),
        fixtureIds: Array.isArray(group.fixtureIds) ? group.fixtureIds.map(String) : [],
        order: Number.isFinite(group.order) ? Number(group.order) : index,
        backendZone: group.backendZone || group.role || BACKEND_ZONE_BY_NAME[name] || undefined,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((group, order) => ({ ...group, order }));
}

export function migrateGroupState(input: {
  dmxGroups?: unknown;
  groupLevels?: Record<string, number>;
  groupMutes?: Record<string, boolean>;
  groupColors?: Record<string, string>;
  groupPresets?: unknown;
}) {
  const groups = normalizeDmxGroups(input.dmxGroups);
  const groupLevels = recordByGroupId(input.groupLevels, groups, () => 80);
  const groupMutes = recordByGroupId(input.groupMutes, groups, () => false);
  const groupColors = recordByGroupId(input.groupColors, groups, (group) => group.color);
  const groupPresets = Array.isArray(input.groupPresets) ? input.groupPresets as GroupPreset[] : [];
  return { dmxGroups: groups, groupLevels, groupMutes, groupColors, groupPresets };
}

function groupToApiPayload(group: DmxGroup) {
  return {
    id: Number.isFinite(Number(group.id)) ? Number(group.id) : undefined,
    name: group.name,
    role: group.backendZone ?? null,
    color: group.color,
    fixtureIds: group.fixtureIds.map((id) => Number(id)).filter(Number.isFinite),
  };
}

async function syncGroupToBackend(group: DmxGroup) {
  const response = await fetch(`${API_BASE}/api/fixture-groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupToApiPayload(group)),
  });
  if (!response.ok) throw new Error('Groupe non synchronise');
  return await response.json() as { id: number; name: string; role?: string | null; color?: string; fixtureIds?: number[] };
}

export const createShowPlayerSlice: StateCreator<any, [], [], ShowPlayerSlice> = (set, get) => {
  const migrated = migrateGroupState({});

  return {
    playlist: DEFAULT_PLAYLIST,
    currentTrackIndex: 0,
    isPlaying: false,
    masterVolume: 0.8,
    audioSource: 'player',
    dmxGroups: migrated.dmxGroups,
    groupPresets: migrated.groupPresets,
    groupLevels: migrated.groupLevels,
    groupMutes: migrated.groupMutes,
    groupColors: migrated.groupColors,
    isRecording: false,
    recordingStartTime: null,

    setPlaylist: (list) => set({ playlist: list }),
    addTrack: (track) => set((s: ShowPlayerSlice) => ({ playlist: [...s.playlist, track] })),
    removeTrack: (id) => set((s: ShowPlayerSlice) => ({ playlist: s.playlist.filter((t) => t.id !== id) })),
    reorderTracks: (startIndex, endIndex) => set((s: ShowPlayerSlice) => {
      const next = [...s.playlist];
      const [removed] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, removed);
      return { playlist: next };
    }),
    setCurrentTrackIndex: (idx) => set((s: ShowPlayerSlice) => {
      const bounded = Math.max(0, Math.min(s.playlist.length - 1, idx));
      return { currentTrackIndex: bounded, isPlaying: false };
    }),
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setMasterVolume: (vol) => set({ masterVolume: vol }),
    setTrackVolume: (id, vol) => set((s: ShowPlayerSlice) => ({
      playlist: s.playlist.map((t) => t.id === id ? { ...t, volume: vol } : t),
    })),
    updateTrackSettings: (id, updates) => set((s: ShowPlayerSlice) => ({
      playlist: s.playlist.map((t) => t.id === id ? { ...t, ...updates } : t),
    })),
    setAudioSource: (src) => set({ audioSource: src }),

    fetchDmxGroups: async () => {
      try {
        const response = await fetch(`${API_BASE}/api/fixture-groups`);
        if (!response.ok) throw new Error('API fixture-groups indisponible');
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return;
        const current = get();
        const orderById = new Map((current.dmxGroups || []).map((group: DmxGroup) => [group.id, group.order]));
        const groups = normalizeDmxGroups(data.map((group: any, index: number) => ({
          id: String(group.id),
          name: group.name,
          color: group.color || '#06b6d4',
          fixtureIds: Array.isArray(group.fixtureIds) ? group.fixtureIds.map(String) : [],
          order: orderById.get(String(group.id)) ?? index,
          backendZone: group.role || undefined,
        })));
        const migratedState = migrateGroupState({
          dmxGroups: groups,
          groupLevels: current.groupLevels,
          groupMutes: current.groupMutes,
          groupColors: current.groupColors,
          groupPresets: current.groupPresets,
        });
        set(migratedState);
      } catch {
        get().addToast?.({
          type: 'warning',
          message: 'Groupe non synchronise (hors ligne)',
          detail: 'Cache local utilise pour les groupes DMX.',
        });
      }
    },
    setDmxGroups: (groups) => set((s: ShowPlayerSlice) => migrateGroupState({
      dmxGroups: groups,
      groupLevels: s.groupLevels,
      groupMutes: s.groupMutes,
      groupColors: s.groupColors,
      groupPresets: s.groupPresets,
    })),
    addDmxGroup: () => {
      const state = get();
      if (state.dmxGroups.length >= 12) return;
      const order = state.dmxGroups.length;
      const group: DmxGroup = {
        id: `${slugify(`Groupe ${order + 1}`)}-${Date.now().toString(36)}`,
        name: `Groupe ${order + 1}`,
        color: '#22d3ee',
        fixtureIds: [],
        order,
      };
      let activeGroupId = group.id;
      if (!isReplayingHistory()) {
        pushHistory({
          label: `Groupe ajoute: ${group.name}`,
          undo: () => set((s: ShowPlayerSlice) => {
            const groupLevels = { ...s.groupLevels };
            const groupMutes = { ...s.groupMutes };
            const groupColors = { ...s.groupColors };
            delete groupLevels[activeGroupId];
            delete groupMutes[activeGroupId];
            delete groupColors[activeGroupId];
            return {
              dmxGroups: s.dmxGroups.filter((candidate) => candidate.id !== activeGroupId).map((candidate, index) => ({ ...candidate, order: index })),
              groupLevels,
              groupMutes,
              groupColors,
            };
          }),
          redo: () => set((s: ShowPlayerSlice) => {
            if (s.dmxGroups.some((candidate) => candidate.id === activeGroupId)) return {};
            const restored = { ...group, id: activeGroupId, order: s.dmxGroups.length };
            return {
              dmxGroups: [...s.dmxGroups, restored],
              groupLevels: { ...s.groupLevels, [activeGroupId]: 80 },
              groupMutes: { ...s.groupMutes, [activeGroupId]: false },
              groupColors: { ...s.groupColors, [activeGroupId]: restored.color },
            };
          }),
        });
      }
      set((s: ShowPlayerSlice) => ({
        dmxGroups: [...s.dmxGroups, group],
        groupLevels: { ...s.groupLevels, [group.id]: 80 },
        groupMutes: { ...s.groupMutes, [group.id]: false },
        groupColors: { ...s.groupColors, [group.id]: group.color },
      }));
      void syncGroupToBackend(group)
        .then((saved) => {
          const savedId = String(saved.id);
          const previousId = activeGroupId;
          activeGroupId = savedId;
          set((s: ShowPlayerSlice) => {
            const groupLevels = { ...s.groupLevels, [savedId]: s.groupLevels[previousId] ?? 80 };
            const groupMutes = { ...s.groupMutes, [savedId]: s.groupMutes[previousId] ?? false };
            const groupColors = { ...s.groupColors, [savedId]: s.groupColors[previousId] ?? group.color };
            delete groupLevels[previousId];
            delete groupMutes[previousId];
            delete groupColors[previousId];
            return {
              dmxGroups: s.dmxGroups.map((candidate) => candidate.id === previousId ? { ...candidate, id: savedId } : candidate),
              groupLevels,
              groupMutes,
              groupColors,
            };
          });
        })
        .catch(() => get().addToast?.({ type: 'warning', message: 'Groupe non synchronise (hors ligne)' }));
    },
    updateDmxGroup: (id, updates) => {
      const current = get().dmxGroups.find((group: DmxGroup) => group.id === id);
      if (!current) return;
      const next = { ...current, ...updates };
      if (!isReplayingHistory()) {
        const beforeGroups = get().dmxGroups;
        const beforeColors = get().groupColors;
        const afterGroups = beforeGroups.map((group: DmxGroup) => group.id === id ? next : group);
        const afterColors = updates.color ? { ...beforeColors, [id]: updates.color } : beforeColors;
        pushHistory({
          label: updates.name ? `Groupe renomme: ${updates.name}` : `Groupe modifie: ${current.name}`,
          coalesceKey: `dmx-group:${id}`,
          undo: () => set({ dmxGroups: beforeGroups, groupColors: beforeColors }),
          redo: () => set({ dmxGroups: afterGroups, groupColors: afterColors }),
        });
      }
      set((s: ShowPlayerSlice) => ({
        dmxGroups: s.dmxGroups.map((group) => group.id === id ? next : group),
        groupColors: updates.color ? { ...s.groupColors, [id]: updates.color } : s.groupColors,
      }));
      void syncGroupToBackend(next).catch(() => get().addToast?.({ type: 'warning', message: 'Groupe non synchronise (hors ligne)' }));
    },
    deleteDmxGroup: (id) => {
      const state = get();
      if (state.showLock) return;
      const target = state.dmxGroups.find((group: DmxGroup) => group.id === id);
      if (!target) return;
      const beforeGroups = state.dmxGroups;
      const beforeLevels = state.groupLevels;
      const beforeMutes = state.groupMutes;
      const beforeColors = state.groupColors;
      const afterGroups = beforeGroups.filter((group: DmxGroup) => group.id !== id).map((group: DmxGroup, order: number) => ({ ...group, order }));
      const afterLevels = { ...beforeLevels };
      const afterMutes = { ...beforeMutes };
      const afterColors = { ...beforeColors };
      delete afterLevels[id];
      delete afterMutes[id];
      delete afterColors[id];
      if (!isReplayingHistory()) {
        pushHistory({
          label: `Groupe supprime: ${target.name}`,
          undo: () => set({
            dmxGroups: beforeGroups,
            groupLevels: beforeLevels,
            groupMutes: beforeMutes,
            groupColors: beforeColors,
          }),
          redo: () => set({
            dmxGroups: afterGroups,
            groupLevels: afterLevels,
            groupMutes: afterMutes,
            groupColors: afterColors,
          }),
        });
      }
      set((s: ShowPlayerSlice) => {
        const groupLevels = { ...s.groupLevels };
        const groupMutes = { ...s.groupMutes };
        const groupColors = { ...s.groupColors };
        delete groupLevels[id];
        delete groupMutes[id];
        delete groupColors[id];
        return {
          dmxGroups: s.dmxGroups.filter((group) => group.id !== id).map((group, order) => ({ ...group, order })),
          groupLevels,
          groupMutes,
          groupColors,
        };
      });
      if (Number.isFinite(Number(id))) {
        void fetch(`${API_BASE}/api/fixture-groups/${id}`, { method: 'DELETE' })
          .catch(() => get().addToast?.({ type: 'warning', message: 'Groupe non synchronise (hors ligne)' }));
      }
    },
    reorderDmxGroups: (fromOrder, toOrder) => {
      const before = get().dmxGroups;
      const next = [...before].sort((a, b) => a.order - b.order);
      const [removed] = next.splice(fromOrder, 1);
      if (!removed) return;
      next.splice(toOrder, 0, removed);
      const after = next.map((group, order) => ({ ...group, order }));
      if (!isReplayingHistory()) {
        pushHistory({
          label: `Groupe deplace: ${removed.name}`,
          undo: () => set({ dmxGroups: before }),
          redo: () => set({ dmxGroups: after }),
        });
      }
      set({ dmxGroups: after });
    },
    setGroupLevel: (group, val) => set((s: ShowPlayerSlice) => ({
      groupLevels: { ...s.groupLevels, [group]: clampPercent(val) },
    })),
    setGroupMute: (group, val) => set((s: ShowPlayerSlice) => ({
      groupMutes: { ...s.groupMutes, [group]: val },
    })),
    setGroupColor: (group, hex) => set((s: ShowPlayerSlice) => {
      const dmxGroups = s.dmxGroups.map((candidate) => candidate.id === group ? { ...candidate, color: hex } : candidate);
      return {
        dmxGroups,
        groupColors: { ...s.groupColors, [group]: hex },
      };
    }),
    saveGroupPreset: (name) => set((s: ShowPlayerSlice) => ({
      groupPresets: [
        {
          id: `preset-${Date.now()}`,
          name,
          groups: s.dmxGroups.map((group) => ({ ...group, fixtureIds: [...group.fixtureIds] })),
          levels: { ...s.groupLevels },
        },
        ...s.groupPresets,
      ].slice(0, 12),
    })),
    applyGroupPreset: (id) => set((s: ShowPlayerSlice) => {
      const preset = s.groupPresets.find((candidate) => candidate.id === id);
      if (!preset) return {};
      const migratedPreset = migrateGroupState({
        dmxGroups: preset.groups,
        groupLevels: preset.levels,
        groupMutes: s.groupMutes,
        groupColors: s.groupColors,
        groupPresets: s.groupPresets,
      });
      return migratedPreset;
    }),
    deleteGroupPreset: (id) => set((s: ShowPlayerSlice) => ({
      groupPresets: s.groupPresets.filter((preset) => preset.id !== id),
    })),
    setIsRecording: (rec) => set(() => ({
      isRecording: rec,
      recordingStartTime: rec ? Date.now() : null,
    })),
  };
};
