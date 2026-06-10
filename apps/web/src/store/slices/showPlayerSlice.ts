import { StateCreator } from 'zustand';

export interface ShowTrack {
  id: string;
  name: string;
  fileUrl: string; // URL.createObjectURL or media source
  fileName?: string;
  fileType: 'audio' | 'video';
  volume: number; // 0 to 1
  lightMode: 'manuel' | 'ia' | 'programme';
  aiPreset: 'rock' | 'jazz' | 'club' | 'tv';
  duration: number; // in seconds
  isPause: boolean; // if true, acts as a playlist pause card
  pauseDuration: number; // 0 for manual pause, >0 for timed pause in seconds
}

export interface ShowPlayerSlice {
  playlist: ShowTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  masterVolume: number; // 0 to 1
  audioSource: 'player' | 'mic';
  groupLevels: Record<string, number>; // Group levels (Face, Douche 1-3, Latéral, Contre) 0 to 100
  groupMutes: Record<string, boolean>; // Group mutes
  groupColors: Record<string, string>; // Group RGB hex values
  isRecording: boolean; // Rec Lumière state
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
  setGroupLevel: (group: string, val: number) => void;
  setGroupMute: (group: string, val: boolean) => void;
  setGroupColor: (group: string, hex: string) => void;
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
    name: 'Pause Régie (10s)',
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
  }
];

export const createShowPlayerSlice: StateCreator<ShowPlayerSlice, [], [], ShowPlayerSlice> = (set) => ({
  playlist: DEFAULT_PLAYLIST,
  currentTrackIndex: 0,
  isPlaying: false,
  masterVolume: 0.8,
  audioSource: 'player',
  
  groupLevels: {
    'Face': 100,
    'Douche 1': 80,
    'Douche 2': 80,
    'Douche 3': 80,
    'Latéral': 80,
    'Contre': 80,
  },
  groupMutes: {
    'Face': false,
    'Douche 1': false,
    'Douche 2': false,
    'Douche 3': false,
    'Latéral': false,
    'Contre': false,
  },
  groupColors: {
    'Face': '#ffffff',
    'Douche 1': '#3b82f6',
    'Douche 2': '#22c55e',
    'Douche 3': '#ef4444',
    'Latéral': '#a855f7',
    'Contre': '#e879f9',
  },
  isRecording: false,
  recordingStartTime: null,

  setPlaylist: (list) => set({ playlist: list }),
  addTrack: (track) => set((s) => ({ playlist: [...s.playlist, track] })),
  removeTrack: (id) => set((s) => ({ playlist: s.playlist.filter((t) => t.id !== id) })),
  reorderTracks: (startIndex, endIndex) => set((s) => {
    const next = [...s.playlist];
    const [removed] = next.splice(startIndex, 1);
    next.splice(endIndex, 0, removed);
    return { playlist: next };
  }),
  setCurrentTrackIndex: (idx) => set((s) => {
    const bounded = Math.max(0, Math.min(s.playlist.length - 1, idx));
    return { currentTrackIndex: bounded, isPlaying: false };
  }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setMasterVolume: (vol) => set({ masterVolume: vol }),
  setTrackVolume: (id, vol) => set((s) => ({
    playlist: s.playlist.map((t) => t.id === id ? { ...t, volume: vol } : t)
  })),
  updateTrackSettings: (id, updates) => set((s) => ({
    playlist: s.playlist.map((t) => t.id === id ? { ...t, ...updates } : t)
  })),
  setAudioSource: (src) => set({ audioSource: src }),
  setGroupLevel: (group, val) => set((s) => ({
    groupLevels: { ...s.groupLevels, [group]: Math.max(0, Math.min(100, val)) }
  })),
  setGroupMute: (group, val) => set((s) => ({
    groupMutes: { ...s.groupMutes, [group]: val }
  })),
  setGroupColor: (group, hex) => set((s) => ({
    groupColors: { ...s.groupColors, [group]: hex }
  })),
  setIsRecording: (rec) => set(() => ({
    isRecording: rec,
    recordingStartTime: rec ? Date.now() : null
  })),
});
