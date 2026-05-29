import { z } from "zod";

// Groups Tool Schemas
export const GroupGetStatusSchema = z.object({});

export const GroupSetConfigSchema = z.object({
  group: z.enum(["A", "B", "C", "D", "E", "F"]).describe("Group identifier"),
  label: z.string().optional().describe("Group display name"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Group color (hex format)"),
  zone_id: z.number().int().min(0).max(9).optional().describe("Smart Mode zone ID (0=disabled)"),
  active: z.boolean().optional().describe("Whether group is active"),
});

export const GroupSetLevelsSchema = z.object({
  levels: z.record(
    z.enum(["A", "B", "C", "D", "E", "F"]),
    z.number().int().min(0).max(100)
  ).describe("Object with group letters as keys and intensity levels (0-100) as values"),
});

// Tool type definitions
export interface GroupTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

export const GROUP_TOOLS: GroupTool[] = [
  {
    name: "group_get_status",
    description: "Get the status of all groups (A-F) including their labels, colors, zones, and active state.",
    inputSchema: GroupGetStatusSchema,
  },
  {
    name: "group_set_config",
    description: "Configure a group's properties (label, color, zone, active state).",
    inputSchema: GroupSetConfigSchema,
  },
  {
    name: "group_set_levels",
    description: "Set intensity levels for multiple groups at once. Useful for scene transitions.",
    inputSchema: GroupSetLevelsSchema,
  },
];

// Tool handlers
export interface GroupToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export const DEFAULT_GROUPS = {
  A: { label: "Face", color: "#22d3ee", zoneId: 1, active: true },
  B: { label: "Latéraux", color: "#a78bfa", zoneId: 2, active: true },
  C: { label: "Contres", color: "#f472b6", zoneId: 3, active: true },
  D: { label: "Douche 1", color: "#34d399", zoneId: 4, active: true },
  E: { label: "Douche 2", color: "#fb923c", zoneId: 0, active: false },
  F: { label: "Douche 3", color: "#fbbf24", zoneId: 0, active: false },
};

export function handleGroupGetStatus(): GroupToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "group_get_status",
        groups: DEFAULT_GROUPS,
        message: "Retrieved group status",
      }),
    }],
  };
}

export function handleGroupSetConfig(args: z.infer<typeof GroupSetConfigSchema>): GroupToolResult {
  const { group, label, color, zone_id, active } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "group_set_config",
        group,
        updates: { label, color, zone_id, active },
        message: `Updated group ${group} configuration`,
      }),
    }],
  };
}

export function handleGroupSetLevels(args: z.infer<typeof GroupSetLevelsSchema>): GroupToolResult {
  const { levels } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "group_set_levels",
        levels,
        message: `Set group levels: ${Object.entries(levels).map(([k, v]) => `${k}=${v}%`).join(", ")}`,
      }),
    }],
  };
}
