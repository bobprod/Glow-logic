#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Tools
import {
  DMX_TOOLS,
  DmxSetChannelSchema,
  DmxSetGroupSchema,
  DmxSetColorSchema,
  DmxBlackoutSchema,
  DmxBpmSchema,
  handleDmxSetChannel,
  handleDmxSetGroup,
  handleDmxSetColor,
  handleDmxBlackout,
  handleDmxBpm,
} from "./tools/dmx.js";

import {
  PATCH_TOOLS,
  PatchGetSchema,
  PatchAddSchema,
  PatchUpdateSchema,
  PatchDeleteSchema,
  PatchLocalizeSchema,
  handlePatchGet,
  handlePatchAdd,
  handlePatchUpdate,
  handlePatchDelete,
  handlePatchLocalize,
} from "./tools/patch.js";

import {
  GROUP_TOOLS,
  GroupGetStatusSchema,
  GroupSetConfigSchema,
  GroupSetLevelsSchema,
  handleGroupGetStatus,
  handleGroupSetConfig,
  handleGroupSetLevels,
} from "./tools/groups.js";

import {
  SCENE_TOOLS,
  SceneSaveSchema,
  SceneLoadSchema,
  SceneListSchema,
  SceneDeleteSchema,
  SceneSequenceSchema,
  handleSceneSave,
  handleSceneLoad,
  handleSceneList,
  handleSceneDelete,
  handleSceneSequence,
} from "./tools/scene.js";

// Resources
import { MCP_RESOURCES, getResourceContent } from "./resources/patch.js";

// Prompts
import { MCP_PROMPTS, getPromptMessages } from "./prompts/lighting.js";

// ============================================================
// Glow Logic MCP Server
// ============================================================
// This server exposes Glow Logic DMX lighting control as MCP tools.
// It can be used by LLMs (Claude, GPT, etc.) to control lighting.
//
// Transport: stdio (child process)
// Backend: http://localhost:3005
// ============================================================

const BACKEND_URL = process.env.GLOW_LOGIC_BACKEND_URL || "http://localhost:3005";

// Create MCP server
const server = new McpServer({
  name: "glow-logic-mcp",
  version: "1.0.0",
});

// ============================================================
// Register DMX Tools
// ============================================================

server.tool(
  "dmx_set_channel",
  "Set a single DMX channel value. Use this for precise control of individual DMX channels.",
  DmxSetChannelSchema.shape,
  async (args) => {
    try {
      // Forward to backend
      const res = await fetch(`${BACKEND_URL}/api/dmx/channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      return handleDmxSetChannel(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "dmx_set_group",
  "Set the intensity of a lighting group (A-F). Groups map to zones in Smart Mode.",
  DmxSetGroupSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dmx/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleDmxSetGroup(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "dmx_set_color",
  "Set RGB color for a lighting group. Maps RGB values to DMX channels automatically.",
  DmxSetColorSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dmx/color`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleDmxSetColor(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "dmx_blackout",
  "Activate or deactivate blackout mode. All DMX output goes to 0 when active.",
  DmxBlackoutSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dmx/blackout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleDmxBlackout(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "dmx_set_bpm",
  "Set the BPM (beats per minute) for synchronized lighting effects.",
  DmxBpmSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dmx/bpm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleDmxBpm(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Register Patch Tools
// ============================================================

server.tool(
  "patch_get",
  "Get the current DMX patch. Returns all fixtures with their addresses and groups.",
  PatchGetSchema.shape,
  async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/patch`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "patch_add",
  "Add a new fixture to the DMX patch. Assigns it to a group and DMX address.",
  PatchAddSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      return handlePatchAdd({ ...args, id: data.id });
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "patch_update",
  "Update an existing fixture in the patch (name, address, group).",
  PatchUpdateSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/patch/${args.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handlePatchUpdate(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "patch_delete",
  "Remove a fixture from the DMX patch.",
  PatchDeleteSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/patch/${args.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handlePatchDelete(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "patch_localize",
  "Flash a fixture briefly to identify it physically (strobe effect).",
  PatchLocalizeSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/patch/${args.id}/localize`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handlePatchLocalize(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Register Group Tools
// ============================================================

server.tool(
  "group_get_status",
  "Get the status of all groups (A-F) including their labels, colors, zones, and active state.",
  GroupGetStatusSchema.shape,
  async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const groups = JSON.parse(data.groups_config || "{}");
      return {
        content: [{ type: "text", text: JSON.stringify(groups, null, 2) }],
      };
    } catch (error) {
      return handleGroupGetStatus();
    }
  }
);

server.tool(
  "group_set_config",
  "Configure a group's properties (label, color, zone, active state).",
  GroupSetConfigSchema.shape,
  async (args) => {
    try {
      // Get current config
      const res = await fetch(`${BACKEND_URL}/api/settings`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const groups = JSON.parse(data.groups_config || "{}");

      // Update group
      groups[args.group] = {
        ...groups[args.group],
        ...(args.label && { label: args.label }),
        ...(args.color && { color: args.color }),
        ...(args.zone_id !== undefined && { zoneId: args.zone_id }),
        ...(args.active !== undefined && { active: args.active }),
      };

      // Save back
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups_config: JSON.stringify(groups) }),
      });

      return handleGroupSetConfig(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "group_set_levels",
  "Set intensity levels for multiple groups at once. Useful for scene transitions.",
  GroupSetLevelsSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dmx/levels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.levels),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleGroupSetLevels(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Register Scene Tools
// ============================================================

server.tool(
  "scene_save",
  "Save the current lighting state as a named scene. Captures all group intensities and colors.",
  SceneSaveSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleSceneSave(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "scene_load",
  "Load a saved scene. Applies the stored group settings with optional fade time.",
  SceneLoadSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/scenes/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleSceneLoad(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "scene_list",
  "List all saved scenes with their names and descriptions.",
  SceneListSchema.shape,
  async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/scenes`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return handleSceneList();
    }
  }
);

server.tool(
  "scene_delete",
  "Delete a saved scene by name.",
  SceneDeleteSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/scenes/${encodeURIComponent(args.name)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleSceneDelete(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "scene_sequence",
  "Create and play a sequence of scenes. Can loop and sync to BPM.",
  SceneSequenceSchema.shape,
  async (args) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/scenes/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      return handleSceneSequence(args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error}` }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Register Resources
// ============================================================

for (const resource of MCP_RESOURCES) {
  server.resource(
    resource.name,
    resource.uri,
    async (uri) => {
      const content = getResourceContent(uri.href);
      return {
        contents: [{
          uri: content.uri,
          mimeType: content.mimeType,
          text: content.text,
        }],
      };
    }
  );
}

// ============================================================
// Register Prompts
// ============================================================

for (const prompt of MCP_PROMPTS) {
  const argSchema: Record<string, z.ZodString> = {};
  for (const arg of prompt.arguments || []) {
    argSchema[arg.name] = z.string().describe(arg.description);
  }

  server.prompt(
    prompt.name,
    prompt.description,
    argSchema,
    async (args) => {
      const messages = getPromptMessages(prompt.name, args as Record<string, string>);
      return { messages };
    }
  );
}

// ============================================================
// Start Server
// ============================================================

async function main() {
  console.error("🔌 Starting Glow Logic MCP Server...");
  console.error(`   Backend: ${BACKEND_URL}`);
  console.error(`   Tools: ${DMX_TOOLS.length + PATCH_TOOLS.length + GROUP_TOOLS.length + SCENE_TOOLS.length}`);
  console.error(`   Resources: ${MCP_RESOURCES.length}`);
  console.error(`   Prompts: ${MCP_PROMPTS.length}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("✅ Glow Logic MCP Server ready");
}

main().catch((error) => {
  console.error("❌ Failed to start MCP server:", error);
  process.exit(1);
});
