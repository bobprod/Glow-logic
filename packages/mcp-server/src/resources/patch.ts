import { z } from "zod";

// Resource definitions for MCP
export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const MCP_RESOURCES: McpResource[] = [
  {
    uri: "glow-logic://patch",
    name: "DMX Patch",
    description: "Current DMX patch with all fixtures, addresses, and group assignments",
    mimeType: "application/json",
  },
  {
    uri: "glow-logic://config",
    name: "Configuration",
    description: "Glow Logic configuration including protocol settings and LLM keys",
    mimeType: "application/json",
  },
  {
    uri: "glow-logic://groups",
    name: "Groups",
    description: "Current group configuration (A-F) with labels, colors, and zones",
    mimeType: "application/json",
  },
  {
    uri: "glow-logic://scenes",
    name: "Scenes",
    description: "List of saved lighting scenes",
    mimeType: "application/json",
  },
  {
    uri: "glow-logic://status",
    name: "Status",
    description: "Real-time status of Glow Logic backend, QLC+, and ArtNet",
    mimeType: "application/json",
  },
];

// Resource content generators
export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export function getResourceContent(uri: string): McpResourceContent {
  switch (uri) {
    case "glow-logic://patch":
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          description: "Current DMX patch",
          note: "Fetch from backend via GET /api/patch",
        }, null, 2),
      };

    case "glow-logic://config":
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          backend_port: 3005,
          osc_port: 7700,
          artnet_port: 6454,
          qlc_port: 9999,
          note: "Fetch from backend via GET /api/settings",
        }, null, 2),
      };

    case "glow-logic://groups":
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          A: { label: "Face", color: "#22d3ee", zoneId: 1, active: true },
          B: { label: "Latéraux", color: "#a78bfa", zoneId: 2, active: true },
          C: { label: "Contres", color: "#f472b6", zoneId: 3, active: true },
          D: { label: "Douche 1", color: "#34d399", zoneId: 4, active: true },
          E: { label: "Douche 2", color: "#fb923c", zoneId: 0, active: false },
          F: { label: "Douche 3", color: "#fbbf24", zoneId: 0, active: false },
        }, null, 2),
      };

    case "glow-logic://scenes":
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          description: "Saved scenes",
          note: "Fetch from backend via GET /api/scenes",
        }, null, 2),
      };

    case "glow-logic://status":
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          backend: "http://localhost:3005",
          status: "running",
          note: "Check backend health via GET /api/settings",
        }, null, 2),
      };

    default:
      throw new Error(`Unknown resource URI: ${uri}`);
  }
}
