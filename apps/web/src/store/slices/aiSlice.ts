import { StateCreator } from "zustand";

export type AIDropEffect = "aucun" | "flash_blanc" | "stroboscope" | "flash_couleur";

export interface AIGroupConfig {
  active: boolean;
  maxLevel: number; // 0–100
}

export interface AISlice {
  aiEnabled: boolean;
  setAIEnabled: (v: boolean) => void;

  aiNervosite: number; // 0–100 — smoothing speed (higher = more reactive)
  setAINervosite: (v: number) => void;

  aiDropEffect: AIDropEffect;
  setAIDropEffect: (v: AIDropEffect) => void;

  // Per-group config: A–F
  aiGroupConfig: Record<string, AIGroupConfig>;
  setAIGroupConfig: (grp: string, cfg: Partial<AIGroupConfig>) => void;

  // Runtime state (not persisted)
  aiDetectedBpm: number;
  setAIDetectedBpm: (bpm: number) => void;

  aiCurrentColors: Record<string, [number, number, number]>; // grp → [r,g,b]
  setAICurrentColor: (grp: string, rgb: [number, number, number]) => void;
}

const DEFAULT_GROUP_CONFIG: Record<string, AIGroupConfig> = {
  A: { active: true, maxLevel: 100 },
  B: { active: true, maxLevel: 100 },
  C: { active: true, maxLevel: 100 },
  D: { active: true, maxLevel: 80 },
  E: { active: false, maxLevel: 100 },
  F: { active: false, maxLevel: 100 },
};

export const createAISlice: StateCreator<AISlice, [], [], AISlice> = (set) => ({
  aiEnabled: false,
  setAIEnabled: (v) => set({ aiEnabled: v }),

  aiNervosite: 50,
  setAINervosite: (v) => set({ aiNervosite: v }),

  aiDropEffect: "flash_blanc",
  setAIDropEffect: (v) => set({ aiDropEffect: v }),

  aiGroupConfig: DEFAULT_GROUP_CONFIG,
  setAIGroupConfig: (grp, cfg) =>
    set((state) => ({
      aiGroupConfig: {
        ...state.aiGroupConfig,
        [grp]: { ...state.aiGroupConfig[grp], ...cfg },
      },
    })),

  aiDetectedBpm: 0,
  setAIDetectedBpm: (bpm) => set({ aiDetectedBpm: bpm }),

  aiCurrentColors: {},
  setAICurrentColor: (grp, rgb) =>
    set((state) => ({
      aiCurrentColors: { ...state.aiCurrentColors, [grp]: rgb },
    })),
});
