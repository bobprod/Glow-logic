import { StateCreator } from 'zustand';
import { API_BASE } from '../../lib/config';
import { CURRENT_PROJECT_SCHEMA_VERSION, normalizeProjectState } from '../../lib/projectMigration';

export interface ProjectListing {
    id: number;
    name: string;
    updated_at: string;
}

export interface ShowSnapshot {
    id: string;
    label: string;
    createdAt: number;
    state: Record<string, unknown>;
}

const SHOW_SNAPSHOT_KEY = 'glow-logic-show-snapshots';
const MAX_SHOW_SNAPSHOTS = 12;

type FixtureGroupSnapshot = {
    id?: number;
    name: string;
    role?: string | null;
    color?: string | null;
    fixtureIds: number[];
};

async function fetchFixtureGroupsSnapshot(): Promise<FixtureGroupSnapshot[]> {
    try {
        const response = await fetch(`${API_BASE}/api/fixture-groups`);
        if (!response.ok) return [];
        return await response.json();
    } catch {
        return [];
    }
}

async function restoreFixtureGroupsSnapshot(groups: FixtureGroupSnapshot[] | undefined) {
    if (!Array.isArray(groups)) return;
    await Promise.all(groups.map((group) => fetch(`${API_BASE}/api/fixture-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: group.name,
            role: group.role ?? null,
            color: group.color ?? '#06b6d4',
            fixtureIds: Array.isArray(group.fixtureIds) ? group.fixtureIds : [],
        }),
    })));
}

function buildProjectStateSnapshot(state: any) {
    return {
        version: CURRENT_PROJECT_SCHEMA_VERSION,
        nodes: state.nodes,
        edges: state.edges,
        smartPads: state.smartPads,
        smartZoneValues: state.smartZoneValues,
        smartZoneMappings: state.smartZoneMappings,
        smartWidgets: state.smartWidgets,
        smartPadColumns: state.smartPadColumns,
        midiMappings: state.midiMappings,
        appMode: state.appMode,
        proView: state.proView,
        clips: state.clips,
        markers: state.markers,
        automationTracks: state.automationTracks,
        duration: state.duration,
        zoom: state.zoom,
        viewStart: state.viewStart,
        playlist: state.playlist,
        currentTrackIndex: state.currentTrackIndex,
        isPlaying: state.isPlaying,
        masterVolume: state.masterVolume,
        audioSource: state.audioSource,
        groupLevels: state.groupLevels,
        groupMutes: state.groupMutes,
        groupColors: state.groupColors,
        showLock: state.showLock,
        currentProjectName: state.currentProjectName,
    };
}

function readShowSnapshots(): ShowSnapshot[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(SHOW_SNAPSHOT_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeShowSnapshots(snapshots: ShowSnapshot[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SHOW_SNAPSHOT_KEY, JSON.stringify(snapshots.slice(0, MAX_SHOW_SNAPSHOTS)));
}

export interface ProjectSlice {
    availableProjects: ProjectListing[];
    currentProjectName: string | null;
    fetchProjects: () => Promise<void>;
    saveProject: (name: string) => Promise<void>;
    loadProject: (id: number) => Promise<void>;
    deleteProject: (id: number) => Promise<void>;
    showSnapshots: ShowSnapshot[];
    refreshShowSnapshots: () => void;
    createShowSnapshot: (label: string) => void;
    restoreShowSnapshot: (id: string) => void;
    deleteShowSnapshot: (id: string) => void;
}

export const createProjectSlice: StateCreator<any, [], [], ProjectSlice> = (set, get) => ({
    availableProjects: [],
    currentProjectName: null,
    showSnapshots: [],

    fetchProjects: async () => {
        try {
            const response = await fetch(`${API_BASE}/api/projects`);
            const data = await response.json();
            set({ availableProjects: data });
        } catch (error) {
            console.error('Failed to fetch projects', error);
        }
    },

    saveProject: async (name: string) => {
        try {
            const state = get();
            const fixtureGroups = await fetchFixtureGroupsSnapshot();
            const projectData = {
                version: CURRENT_PROJECT_SCHEMA_VERSION,
                nodes: state.nodes,
                edges: state.edges,
                smartPads: state.smartPads,
                smartZoneValues: state.smartZoneValues,
                smartZoneMappings: state.smartZoneMappings,
                smartWidgets: state.smartWidgets,
                smartPadColumns: state.smartPadColumns,
                midiMappings: state.midiMappings,
                dmxOutputs: state.dmxOutputs,
                networkState: state.networkState,
                appMode: state.appMode,
                proView: state.proView,
                clips: state.clips,
                markers: state.markers,
                automationTracks: state.automationTracks,
                duration: state.duration,
                zoom: state.zoom,
                viewStart: state.viewStart,
                playlist: state.playlist,
                currentTrackIndex: state.currentTrackIndex,
                isPlaying: state.isPlaying,
                masterVolume: state.masterVolume,
                masterDimmer: state.masterDimmer,
                blackout: state.blackout,
                smartBlackout: state.smartBlackout,
                audioSource: state.audioSource,
                groupLevels: state.groupLevels,
                groupMutes: state.groupMutes,
                groupColors: state.groupColors,
                showLock: state.showLock,
                laserArmed: state.laserArmed,
                pyroArmed: state.pyroArmed,
                fixtureGroups,
            };

            const response = await fetch(`${API_BASE}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data: projectData }),
            });

            if (response.ok) {
                set({ currentProjectName: name });
                await get().fetchProjects();
            }
        } catch (error) {
            console.error('Failed to save project', error);
        }
    },

    loadProject: async (id: number) => {
        try {
            const response = await fetch(`${API_BASE}/api/projects/${id}`);
            const project = await response.json();

            if (project && project.data) {
                await restoreFixtureGroupsSnapshot(project.data.fixtureGroups);
                const normalized = normalizeProjectState(project.data, get(), { projectName: project.name });
                set(normalized.state as any);
                if (normalized.migrations.length > 0) {
                    get().addToast?.({
                        type: 'info',
                        message: 'Projet migre',
                        detail: normalized.migrations[0],
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load project', error);
        }
    },

    deleteProject: async (id: number) => {
        try {
            await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
            // If we just deleted the currently loaded project, clear its name
            const state = get();
            if (state.availableProjects.find((p: ProjectListing) => p.id === id)?.name === state.currentProjectName) {
                set({ currentProjectName: null });
            }
            await get().fetchProjects();
        } catch (error) {
            console.error('Failed to delete project', error);
        }
    },

    refreshShowSnapshots: () => {
        set({ showSnapshots: readShowSnapshots() });
    },

    createShowSnapshot: (label: string) => {
        const state = get();
        const snapshot: ShowSnapshot = {
            id: `snapshot-${Date.now()}`,
            label: label.trim() || 'Snapshot show',
            createdAt: Date.now(),
            state: buildProjectStateSnapshot(state),
        };
        const next = [snapshot, ...readShowSnapshots()].slice(0, MAX_SHOW_SNAPSHOTS);
        writeShowSnapshots(next);
        set({ showSnapshots: next });
        state.addToast?.({
            type: 'success',
            message: 'Snapshot créé',
            detail: snapshot.label,
        });
    },

    restoreShowSnapshot: (id: string) => {
        const snapshot = readShowSnapshots().find(s => s.id === id);
        if (!snapshot) return;
        const normalized = normalizeProjectState(snapshot.state, get());
        set(normalized.state as any);
        get().addToast?.({
            type: 'success',
            message: 'Snapshot restauré',
            detail: normalized.migrations[0] || snapshot.label,
        });
    },

    deleteShowSnapshot: (id: string) => {
        const next = readShowSnapshots().filter(s => s.id !== id);
        writeShowSnapshots(next);
        set({ showSnapshots: next });
    },
});
