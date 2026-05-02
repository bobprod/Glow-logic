import { StateCreator } from "zustand";

export interface PatchedFixture {
  id: number;
  name: string;
  fixture_type: string;
  manufacturer: string | null;
  model: string | null;
  universe: number;
  start_address: number;
  channel_count: number;
  profile: string[];
  mode_name: string | null;
  grp: string;
  height_3d: number;
  rotation_3d: number;
  sort_order: number;
}

export interface PatchSlice {
  patch: PatchedFixture[];
  patchLoaded: boolean;
  loadPatch: () => Promise<void>;
  getPatchByGroup: (grp: string) => PatchedFixture[];
}

export const createPatchSlice: StateCreator<PatchSlice, [], [], PatchSlice> = (set, get) => ({
  patch: [],
  patchLoaded: false,

  loadPatch: async () => {
    try {
      const res = await fetch("http://localhost:3005/api/patch");
      if (!res.ok) return;
      const data = await res.json();
      set({ patch: data, patchLoaded: true });
    } catch {
      // server not reachable — keep empty patch
    }
  },

  getPatchByGroup: (grp: string) => {
    return get().patch.filter((f) => f.grp === grp);
  },
});
