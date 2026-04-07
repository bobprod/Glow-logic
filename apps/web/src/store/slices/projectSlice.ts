import { StateCreator } from 'zustand';

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005';

export interface ProjectListing {
    id: number;
    name: string;
    updated_at: string;
}

export interface ProjectSlice {
    availableProjects: ProjectListing[];
    currentProjectName: string | null;
    fetchProjects: () => Promise<void>;
    saveProject: (name: string) => Promise<void>;
    loadProject: (id: number) => Promise<void>;
    deleteProject: (id: number) => Promise<void>;
}

export const createProjectSlice: StateCreator<any, [], [], ProjectSlice> = (set, get) => ({
    availableProjects: [],
    currentProjectName: null,

    fetchProjects: async () => {
        try {
            const response = await fetch(`${SERVER_URL}/api/projects`);
            const data = await response.json();
            set({ availableProjects: data });
        } catch (error) {
            console.error('Failed to fetch projects', error);
        }
    },

    saveProject: async (name: string) => {
        try {
            const state = get();
            const projectData = {
                nodes: state.nodes,
                edges: state.edges,
                smartPads: state.smartPads,
                smartZoneValues: state.smartZoneValues,
                midiMappings: state.midiMappings,
                appMode: state.appMode,
                clips: state.clips,
                duration: state.duration,
            };

            const response = await fetch(`${SERVER_URL}/api/projects`, {
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
            const response = await fetch(`${SERVER_URL}/api/projects/${id}`);
            const project = await response.json();

            if (project && project.data) {
                set({
                    nodes: project.data.nodes || [],
                    edges: project.data.edges || [],
                    smartPads: project.data.smartPads || [],
                    smartZoneValues: project.data.smartZoneValues || {},
                    midiMappings: project.data.midiMappings || [],
                    appMode: project.data.appMode || 'creator',
                    clips: project.data.clips || [],
                    duration: project.data.duration || 60,
                    currentProjectName: project.name
                });
            }
        } catch (error) {
            console.error('Failed to load project', error);
        }
    },

    deleteProject: async (id: number) => {
        try {
            const response = await fetch(`${SERVER_URL}/api/projects/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                await get().fetchProjects();
            }
        } catch (error) {
            console.error('Failed to delete project', error);
        }
    },
});
