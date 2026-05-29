import { z } from "zod";

// Prompt definitions for MCP
export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export const MCP_PROMPTS: McpPrompt[] = [
  {
    name: "lighting_scene_suggestion",
    description: "Suggest lighting scenes based on event type and mood",
    arguments: [
      { name: "event_type", description: "Type of event (concert, party, theater, etc.)", required: true },
      { name: "mood", description: "Desired mood (energetic, calm, dramatic, etc.)", required: false },
      { name: "duration", description: "Duration in minutes", required: false },
    ],
  },
  {
    name: "lighting_transition",
    description: "Create a smooth transition between two lighting states",
    arguments: [
      { name: "from_scene", description: "Starting scene name", required: true },
      { name: "to_scene", description: "Ending scene name", required: true },
      { name: "fade_time", description: "Transition time in seconds", required: false },
    ],
  },
  {
    name: "lighting_analysis",
    description: "Analyze current lighting setup and suggest improvements",
    arguments: [
      { name: "focus", description: "Area to focus on (coverage, color balance, energy)", required: false },
    ],
  },
  {
    name: "lighting_emergency",
    description: "Handle lighting emergency (fixture failure, DMX issues)",
    arguments: [
      { name: "issue", description: "Description of the issue", required: true },
      { name: "fixture_id", description: "Affected fixture ID if known", required: false },
    ],
  },
];

// Prompt message generators
export interface McpPromptMessage {
  role: "user" | "assistant";
  content: {
    type: "text";
    text: string;
  };
}

export function getPromptMessages(
  name: string,
  args: Record<string, string>
): McpPromptMessage[] {
  switch (name) {
    case "lighting_scene_suggestion":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Suggest lighting scenes for a ${args.event_type || "general event"}${args.mood ? ` with a ${args.mood} mood` : ""}${args.duration ? ` lasting ${args.duration} minutes` : ""}.

Available groups:
- A: Face (zone 1)
- B: Latéraux (zone 2)
- C: Contres (zone 3)
- D: Douche 1 (zone 4)
- E: Douche 2 (disabled)
- F: Douche 3 (disabled)

Please suggest 3-5 scenes with specific RGB values and intensity levels for each group.`,
          },
        },
      ];

    case "lighting_transition":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a smooth lighting transition from "${args.from_scene || "current state"}" to "${args.to_scene || "target state"}"${args.fade_time ? ` over ${args.fade_time} seconds` : ""}.

Provide step-by-step instructions for transitioning each group's intensity and color.`,
          },
        },
      ];

    case "lighting_analysis":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the current lighting setup and suggest improvements.
Focus area: ${args.focus || "overall coverage"}

Consider:
- Color balance across groups
- Intensity distribution
- Potential DMX conflicts
- Energy efficiency

Provide specific recommendations with RGB values and intensity levels.`,
          },
        },
      ];

    case "lighting_emergency":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Lighting emergency reported: ${args.issue || "Unknown issue"}
${args.fixture_id ? `Affected fixture ID: ${args.fixture_id}` : ""}

Please provide:
1. Immediate actions to take
2. Backup lighting configuration
3. Diagnostic steps to identify root cause
4. Long-term fixes to prevent recurrence`,
          },
        },
      ];

    default:
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: "How can I help you with Glow Logic lighting control?",
          },
        },
      ];
  }
}
