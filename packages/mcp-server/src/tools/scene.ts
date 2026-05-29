import { z } from "zod";

// Scene Tool Schemas
export const SceneSaveSchema = z.object({
  name: z.string().min(1).describe("Scene name"),
  description: z.string().optional().describe("Scene description"),
  groups: z.record(
    z.enum(["A", "B", "C", "D", "E", "F"]),
    z.object({
      intensity: z.number().int().min(0).max(100).describe("Group intensity (0-100)"),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Group color (hex)"),
    })
  ).describe("Group settings for this scene"),
});

export const SceneLoadSchema = z.object({
  name: z.string().min(1).describe("Scene name to load"),
  fade_time: z.number().min(0).max(10).default(0).describe("Fade time in seconds"),
});

export const SceneListSchema = z.object({});

export const SceneDeleteSchema = z.object({
  name: z.string().min(1).describe("Scene name to delete"),
});

export const SceneSequenceSchema = z.object({
  scenes: z.array(z.string()).describe("Ordered list of scene names"),
  bpm: z.number().int().min(20).max(300).optional().describe("BPM for sequence timing"),
  loop: z.boolean().default(false).describe("Loop the sequence"),
});

// Tool type definitions
export interface SceneTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

export const SCENE_TOOLS: SceneTool[] = [
  {
    name: "scene_save",
    description: "Save the current lighting state as a named scene. Captures all group intensities and colors.",
    inputSchema: SceneSaveSchema,
  },
  {
    name: "scene_load",
    description: "Load a saved scene. Applies the stored group settings with optional fade time.",
    inputSchema: SceneLoadSchema,
  },
  {
    name: "scene_list",
    description: "List all saved scenes with their names and descriptions.",
    inputSchema: SceneListSchema,
  },
  {
    name: "scene_delete",
    description: "Delete a saved scene by name.",
    inputSchema: SceneDeleteSchema,
  },
  {
    name: "scene_sequence",
    description: "Create and play a sequence of scenes. Can loop and sync to BPM.",
    inputSchema: SceneSequenceSchema,
  },
];

// Tool handlers
export interface SceneToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function handleSceneSave(args: z.infer<typeof SceneSaveSchema>): SceneToolResult {
  const { name, description, groups } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "scene_save",
        name,
        description,
        groups,
        message: `Saved scene "${name}" with ${Object.keys(groups).length} groups`,
      }),
    }],
  };
}

export function handleSceneLoad(args: z.infer<typeof SceneLoadSchema>): SceneToolResult {
  const { name, fade_time } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "scene_load",
        name,
        fade_time,
        message: `Loaded scene "${name}" with ${fade_time}s fade`,
      }),
    }],
  };
}

export function handleSceneList(): SceneToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "scene_list",
        message: "Retrieved scene list from Glow Logic backend",
      }),
    }],
  };
}

export function handleSceneDelete(args: z.infer<typeof SceneDeleteSchema>): SceneToolResult {
  const { name } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "scene_delete",
        name,
        message: `Deleted scene "${name}"`,
      }),
    }],
  };
}

export function handleSceneSequence(args: z.infer<typeof SceneSequenceSchema>): SceneToolResult {
  const { scenes, bpm, loop } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "scene_sequence",
        scenes,
        bpm,
        loop,
        message: `Created sequence of ${scenes.length} scenes${bpm ? ` at ${bpm} BPM` : ""}${loop ? " (looping)" : ""}`,
      }),
    }],
  };
}
