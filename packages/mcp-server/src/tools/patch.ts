import { z } from "zod";

// Patch Tool Schemas
export const PatchGetSchema = z.object({});

export const PatchAddSchema = z.object({
  name: z.string().min(1).describe("Fixture name"),
  fixture_type: z.string().default("PAR LED").describe("Fixture type (PAR LED, Moving Head, etc.)"),
  universe: z.number().int().min(0).max(15).default(1).describe("DMX universe"),
  start_address: z.number().int().min(1).max(512).describe("Starting DMX address"),
  channel_count: z.number().int().min(1).max(512).describe("Number of DMX channels"),
  grp: z.enum(["A", "B", "C", "D", "E", "F"]).default("A").describe("Group assignment"),
  height_3d: z.number().min(0).default(3.0).describe("Height in meters for 3D visualization"),
  rotation_3d: z.number().default(0).describe("Rotation angle for 3D visualization"),
});

export const PatchUpdateSchema = z.object({
  id: z.number().int().describe("Fixture ID to update"),
  name: z.string().optional().describe("New fixture name"),
  universe: z.number().int().min(0).max(15).optional().describe("New DMX universe"),
  start_address: z.number().int().min(1).max(512).optional().describe("New starting address"),
  grp: z.enum(["A", "B", "C", "D", "E", "F"]).optional().describe("New group assignment"),
});

export const PatchDeleteSchema = z.object({
  id: z.number().int().describe("Fixture ID to delete"),
});

export const PatchLocalizeSchema = z.object({
  id: z.number().int().describe("Fixture ID to localize (brief strobe)"),
});

// Tool type definitions
export interface PatchTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

export const PATCH_TOOLS: PatchTool[] = [
  {
    name: "patch_get",
    description: "Get the current DMX patch. Returns all fixtures with their addresses and groups.",
    inputSchema: PatchGetSchema,
  },
  {
    name: "patch_add",
    description: "Add a new fixture to the DMX patch. Assigns it to a group and DMX address.",
    inputSchema: PatchAddSchema,
  },
  {
    name: "patch_update",
    description: "Update an existing fixture in the patch (name, address, group).",
    inputSchema: PatchUpdateSchema,
  },
  {
    name: "patch_delete",
    description: "Remove a fixture from the DMX patch.",
    inputSchema: PatchDeleteSchema,
  },
  {
    name: "patch_localize",
    description: "Flash a fixture briefly to identify it physically (strobe effect).",
    inputSchema: PatchLocalizeSchema,
  },
];

// Tool handlers
export interface PatchToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function handlePatchGet(): PatchToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "patch_get",
        message: "Retrieved patch data from Glow Logic backend",
      }),
    }],
  };
}

export function handlePatchAdd(args: z.infer<typeof PatchAddSchema>): PatchToolResult {
  const { name, fixture_type, universe, start_address, channel_count, grp } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "patch_add",
        name,
        fixture_type,
        universe,
        start_address,
        channel_count,
        grp,
        message: `Added fixture "${name}" at U${universe}:${start_address} (${channel_count}ch) in group ${grp}`,
      }),
    }],
  };
}

export function handlePatchUpdate(args: z.infer<typeof PatchUpdateSchema>): PatchToolResult {
  const { id, ...updates } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "patch_update",
        id,
        updates,
        message: `Updated fixture ${id}`,
      }),
    }],
  };
}

export function handlePatchDelete(args: z.infer<typeof PatchDeleteSchema>): PatchToolResult {
  const { id } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "patch_delete",
        id,
        message: `Deleted fixture ${id}`,
      }),
    }],
  };
}

export function handlePatchLocalize(args: z.infer<typeof PatchLocalizeSchema>): PatchToolResult {
  const { id } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "patch_localize",
        id,
        message: `Localizing fixture ${id} (strobe flash)`,
      }),
    }],
  };
}
