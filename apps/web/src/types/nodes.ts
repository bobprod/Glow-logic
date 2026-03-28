// Shared type for all Glow Logic node data payloads
export type NodeData = {
    label?: string;
    value?: number;
    universe?: number;
    channel?: number;
    device?: string;
    sublabel?: string;
    [key: string]: unknown; // Allow extra keys for extensibility
};
