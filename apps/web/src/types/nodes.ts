// Shared type for all Glow Logic node data payloads
export type NodeData = {
    label?: string;
    value?: number;
    universe?: number;
    channel?: number;
    device?: string;
    sublabel?: string;
    gridPosition?: { x: number; y: number; z: number };
    [key: string]: unknown; // Allow extra keys for extensibility
};
