import { StateCreator } from 'zustand';
import { Connection, Edge, EdgeChange, Node, NodeChange, addEdge, OnNodesChange, OnEdgesChange, OnConnect, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { socket } from '../../lib/socket';

export interface ReactFlowSlice {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateNodeData: (nodeId: string, data: any) => void;
    addNode: (node: Node) => void;
    selectedNode: Node | null;
    setSelectedNode: (node: Node | null) => void;
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
    setSelectedNode: (node: Node | null) => set({ selectedNode: node }),

    addNode: (node: Node) => {
        set({ nodes: [...get().nodes, node] });
    },

    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection: Connection) => {
        set({
            edges: addEdge({
                ...connection,
                type: 'default', // React flow uses bezier by default, but let's make it look like the mockup
                animated: false,
                style: { stroke: '#06b6d4', strokeWidth: 2 }
            }, get().edges),
        });
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateNodeData: (nodeId: string, data: any) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    const newData = { ...node.data, ...data };

                    // Magie Live : Si un pad ou slider bouge, on regarde à quoi c'est connecté
                    if ((node.type === 'sliderInput' || node.type === 'padInput') && data.value !== undefined) {
                        const connectedEdges = get().edges.filter(e => e.source === nodeId);

                        connectedEdges.forEach(edge => {
                            const targetNode = get().nodes.find(n => n.id === edge.target);
                            // Si connecté à un Nœud DMX, on envoie la commande par WebSocket OS !
                            if (targetNode?.type === 'dmxOutput') {
                                socket?.emit("dmx_update", {
                                    universe: targetNode.data.universe,
                                    channel: targetNode.data.channel,
                                    value: data.value
                                });
                            }
                        })
                    }

                    return { ...node, data: newData };
                }
                return node;
            }),
        });
    },
});
