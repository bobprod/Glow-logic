// Shared type for all Glow Logic node data payloads
export type NodeData = {
    label?: string;
    value?: number;
    universe?: number;
    channel?: number;
    device?: string;
    sublabel?: string;
    // 3D positioning in the Visualizer
    x3d?: number;
    y3d?: number;
    z3d?: number;
    [key: string]: unknown; // Allow extra keys for extensibility
};
