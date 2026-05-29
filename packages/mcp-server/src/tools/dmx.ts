import { z } from "zod";

// DMX Tool Schemas
export const DmxSetChannelSchema = z.object({
  universe: z.number().int().min(0).max(15).describe("DMX universe (0-15)"),
  channel: z.number().int().min(1).max(512).describe("DMX channel (1-512)"),
  value: z.number().int().min(0).max(255).describe("DMX value (0-255)"),
});

export const DmxSetGroupSchema = z.object({
  group: z.enum(["A", "B", "C", "D", "E", "F"]).describe("Group identifier (A-F)"),
  intensity: z.number().int().min(0).max(100).describe("Intensity percentage (0-100)"),
});

export const DmxSetColorSchema = z.object({
  group: z.enum(["A", "B", "C", "D", "E", "F"]).describe("Group identifier (A-F)"),
  r: z.number().int().min(0).max(255).describe("Red value (0-255)"),
  g: z.number().int().min(0).max(255).describe("Green value (0-255)"),
  b: z.number().int().min(0).max(255).describe("Blue value (0-255)"),
  intensity: z.number().int().min(0).max(100).optional().default(100).describe("Intensity percentage (0-100)"),
});

export const DmxBlackoutSchema = z.object({
  active: z.boolean().describe("true to activate blackout, false to deactivate"),
});

export const DmxBpmSchema = z.object({
  bpm: z.number().int().min(20).max(300).describe("Beats per minute (20-300)"),
});

// Tool type definitions
export interface DmxTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
}

export const DMX_TOOLS: DmxTool[] = [
  {
    name: "dmx_set_channel",
    description: "Set a single DMX channel value. Use this for precise control of individual DMX channels.",
    inputSchema: DmxSetChannelSchema,
  },
  {
    name: "dmx_set_group",
    description: "Set the intensity of a lighting group (A-F). Groups map to zones in Smart Mode.",
    inputSchema: DmxSetGroupSchema,
  },
  {
    name: "dmx_set_color",
    description: "Set RGB color for a lighting group. Maps RGB values to DMX channels automatically.",
    inputSchema: DmxSetColorSchema,
  },
  {
    name: "dmx_blackout",
    description: "Activate or deactivate blackout mode. All DMX output goes to 0 when active.",
    inputSchema: DmxBlackoutSchema,
  },
  {
    name: "dmx_set_bpm",
    description: "Set the BPM (beats per minute) for synchronized lighting effects.",
    inputSchema: DmxBpmSchema,
  },
];

// Tool handlers
export interface DmxToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function handleDmxSetChannel(args: z.infer<typeof DmxSetChannelSchema>): DmxToolResult {
  const { universe, channel, value } = args;
  // This will be called via HTTP to the Glow Logic backend
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "dmx_set_channel",
        universe,
        channel,
        value,
        message: `Set universe ${universe}, channel ${channel} to value ${value}`,
      }),
    }],
  };
}

export function handleDmxSetGroup(args: z.infer<typeof DmxSetGroupSchema>): DmxToolResult {
  const { group, intensity } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "dmx_set_group",
        group,
        intensity,
        message: `Set group ${group} intensity to ${intensity}%`,
      }),
    }],
  };
}

export function handleDmxSetColor(args: z.infer<typeof DmxSetColorSchema>): DmxToolResult {
  const { group, r, g, b, intensity } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "dmx_set_color",
        group,
        r,
        g,
        b,
        intensity,
        message: `Set group ${group} to RGB(${r}, ${g}, ${b}) at ${intensity}%`,
      }),
    }],
  };
}

export function handleDmxBlackout(args: z.infer<typeof DmxBlackoutSchema>): DmxToolResult {
  const { active } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "dmx_blackout",
        active,
        message: active ? "Blackout activated" : "Blackout deactivated",
      }),
    }],
  };
}

export function handleDmxBpm(args: z.infer<typeof DmxBpmSchema>): DmxToolResult {
  const { bpm } = args;
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        action: "dmx_set_bpm",
        bpm,
        message: `Set BPM to ${bpm}`,
      }),
    }],
  };
}
