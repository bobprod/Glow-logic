import { StateCreator } from 'zustand';
import { Connection, Edge, EdgeChange, Node, NodeChange, addEdge, OnNodesChange, OnEdgesChange, OnConnect, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { dmxEngine } from '../../lib/dmxEngine';

export interface ReactFlowSlice {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
     
    updateNodeData: (nodeId: string, data: any) => void;
    updateFixturePosition: (id: string, pos: { x: number; y: number; z: number }) => void;
    addNode: (node: Node) => void;
    selectedNode: Node | null;
    setSelectedNode: (node: Node | null) => void;
    // Undo / Redo
    past: Array<{ nodes: Node[]; edges: Edge[] }>;
    future: Array<{ nodes: Node[]; edges: Edge[] }>;
    undo: () => void;
    redo: () => void;
}

export const createReactFlowSlice: StateCreator<ReactFlowSlice, [], [], ReactFlowSlice> = (set, get) => ({
    nodes: [
        {
            id: 'dmx-1',
            type: 'dmxOutput',
            position: { x: 500, y: 200 },
            data: { label: 'PAR LED 1', universe: 1, channel: 1 },
        },
        {
            id: 'slider-1',
            type: 'sliderInput',
            position: { x: 100, y: 200 },
            data: { label: 'Dimmer', value: 0 },
        },
    ],
    edges: [],
    selectedNode: null,
    past: [],
    future: [],
    setSelectedNode: (node: Node | null) => set({ selectedNode: node }),

    addNode: (node: Node) => {
        const { nodes, edges, past } = get();
        set({
            nodes: [...nodes, node],
            past: [...past.slice(-49), { nodes: [...nodes], edges: [...edges] }],
            future: [],
        });
    },

    onNodesChange: (changes: NodeChange[]) => {
        const hasRemove = changes.some(c => c.type === 'remove');
        if (hasRemove) {
            const { nodes, edges, past } = get();
            set({ past: [...past.slice(-49), { nodes: [...nodes], edges: [...edges] }], future: [] });
        }
        set({ nodes: applyNodeChanges(changes, get().nodes) });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        const hasRemove = changes.some(c => c.type === 'remove');
        if (hasRemove) {
            const { nodes, edges, past } = get();
            set({ past: [...past.slice(-49), { nodes: [...nodes], edges: [...edges] }], future: [] });
        }
        set({ edges: applyEdgeChanges(changes, get().edges) });
    },

    onConnect: (connection: Connection) => {
        const { nodes, edges, past } = get();
        const sourceNode = nodes.find(n => n.id === connection.source);
        // Edge color based on source type
        const colorMap: Record<string, string> = {
            sliderInput: '#ec4899', padInput: '#eab308',
            lfoInput: '#22c55e',   colorPicker: '#fb923c',
            audioIn: '#a855f7',
        };
        const stroke = colorMap[sourceNode?.type ?? ''] ?? '#6366f1';
        set({
            edges: addEdge({
                ...connection,
                animated: true,
                style: { stroke, strokeWidth: 2.5, filter: `drop-shadow(0 0 5px ${stroke}80)` },
            }, edges),
            past: [...past.slice(-49), { nodes: [...nodes], edges: [...edges] }],
            future: [],
        });
    },

     
    updateNodeData: (nodeId: string, data: any) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    const newData = { ...node.data, ...data };

                    // ── Signal flow: valeur scalaire (Slider, Pad, LFO…) ──────
                    if (data.value !== undefined) {
                        get().edges.filter(e => e.source === nodeId).forEach(edge => {
                            const target = get().nodes.find(n => n.id === edge.target);
                            if (!target) return;

                            // → DmxOutput ou ArtNetOut (un seul canal)
                            if (target.type === 'dmxOutput' || target.type === 'artnetOut') {
                                dmxEngine.setChannel(
                                    (target.data.universe as number) ?? 1,
                                    (target.data.channel as number) ?? 1,
                                    data.value,
                                );
                            }

                            // → FixtureNode : le targetHandle encode "ch-N"
                            if (target.type === 'fixtureNode' && edge.targetHandle) {
                                const chNum = parseInt(edge.targetHandle.replace('ch-', ''), 10);
                                if (!isNaN(chNum)) {
                                    const startAddr = (target.data.startAddress as number) ?? 1;
                                    const universe  = (target.data.universe  as number) ?? 1;
                                    dmxEngine.setChannel(universe, startAddr + chNum - 1, data.value);
                                }
                            }
                        });
                    }

                    // ── Signal flow: ColorPicker (r, g, b) ───────────────────
                    if (data.r !== undefined || data.g !== undefined || data.b !== undefined) {
                        const r = data.r ?? (node.data.r as number) ?? 0;
                        const g = data.g ?? (node.data.g as number) ?? 0;
                        const b = data.b ?? (node.data.b as number) ?? 0;
                        get().edges.filter(e => e.source === nodeId).forEach(edge => {
                            const target = get().nodes.find(n => n.id === edge.target);
                            if (!target) return;
                            if (target.type === 'dmxOutput' || target.type === 'artnetOut') {
                                // Envoie R vers le canal configuré, G=+1, B=+2
                                const u  = (target.data.universe as number) ?? 1;
                                const ch = (target.data.channel  as number) ?? 1;
                                dmxEngine.setRGB(u, ch, ch + 1, ch + 2, r, g, b);
                            }
                            // → FixtureNode : routes R/G/B sur les bons channels par type
                            if (target.type === 'fixtureNode') {
                                const universe  = (target.data.universe  as number) ?? 1;
                                const startAddr = (target.data.startAddress as number) ?? 1;
                                const channels  = (target.data.channels as any[]) ?? [];
                                channels.forEach(ch => {
                                    const abs = startAddr + ch.channel - 1;
                                    if (ch.type === 'red')   dmxEngine.setChannel(universe, abs, r);
                                    if (ch.type === 'green') dmxEngine.setChannel(universe, abs, g);
                                    if (ch.type === 'blue')  dmxEngine.setChannel(universe, abs, b);
                                });
                            }
                        });
                    }

                    return { ...node, data: newData };
                }
                return node;
            }),
        });
    },

    updateFixturePosition: (id, pos) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id !== id) return node;
                return {
                    ...node,
                    position: { x: pos.x, y: pos.y },
                    data: {
                        ...node.data,
                        x3d: pos.x,
                        y3d: pos.y,
                        z3d: pos.z,
                        gridPosition: pos,
                    },
                };
            }),
        });
    },

    undo: () => {
        const { nodes, edges, past, future } = get();
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        set({
            nodes: prev.nodes,
            edges: prev.edges,
            past: past.slice(0, -1),
            future: [{ nodes: [...nodes], edges: [...edges] }, ...future].slice(0, 50),
        });
    },

    redo: () => {
        const { nodes, edges, past, future } = get();
        if (future.length === 0) return;
        const next = future[0];
        set({
            nodes: next.nodes,
            edges: next.edges,
            future: future.slice(1),
            past: [...past, { nodes: [...nodes], edges: [...edges] }].slice(-50),
        });
    },
});
