// ============================================================
// LLM Service for Fixture Analysis
// Uses AI to improve OCR results and suggest fixture metadata
// ============================================================

import { DmxChannel, DmxChannelType, ScanResult } from "./ocr.js";
import * as fs from "fs";
import * as path from "path";

// LLM Provider configuration
interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Get LLM config from database settings
function getLlmConfig(): LlmConfig | null {
  try {
    // In production, fetch from database
    // For now, return a default config
    return {
      provider: "opencode_go",
      apiKey: process.env.OPENCODE_API_KEY || "",
      model: "kimi-k2.6",
      baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
    };
  } catch {
    return null;
  }
}

// LLM Response interface
interface LlmResponse {
  fixtureName?: string;
  manufacturer?: string;
  channels: DmxChannel[];
  confidence: number;
  reasoning: string;
}

// Suggestion response interface
export interface FixtureSuggestion {
  fixture_type: string;
  profile: string[];
  manufacturer: string | null;
  mode_name: string | null;
  suggested_group: string;
  suggested_address: number;
  suggested_height: number;
  suggested_rotation: number;
  confidence: number;
}

// Multi-fixture result
export interface MultiFixtureResult {
  fixtures: ScanResult[];
  totalFixtures: number;
}

// Library fixture interface
interface LibraryFixture {
  manufacturer: string;
  model: string;
  fixture_type: string;
  modes: { name: string; channels: string[]; num_channels: number }[];
}

// Learning data interface
interface LearningEntry {
  originalName: string;
  correctedType: string;
  correctedProfile: string[];
  timestamp: Date;
}

// Learning storage
const LEARNING_FILE = path.resolve(__dirname, "../../data/fixture_learning.json");

// Ensure data directory exists
function ensureDataDir(): void {
  const dir = path.dirname(LEARNING_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadLearningData(): LearningEntry[] {
  try {
    ensureDataDir();
    if (fs.existsSync(LEARNING_FILE)) {
      return JSON.parse(fs.readFileSync(LEARNING_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveLearningData(data: LearningEntry[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save learning data:", error);
  }
}

/**
 * Analyze OCR text using LLM to improve fixture detection
 */
export async function analyzeFixtureWithLlm(
  ocrText: string,
  ocrChannels: DmxChannel[],
  ocrConfidence: number
): Promise<ScanResult> {
  const config = getLlmConfig();
  
  if (!config || !config.apiKey) {
    // No LLM available, return OCR results as-is
    return {
      channels: ocrChannels,
      rawText: ocrText,
      confidence: ocrConfidence,
      totalChannels: ocrChannels.length,
    };
  }

  try {
    const prompt = buildAnalysisPrompt(ocrText, ocrChannels);
    const llmResponse = await callLlm(config, prompt);
    const analyzed = parseLlmResponse(llmResponse);
    
    // Merge LLM analysis with OCR results
    const mergedChannels = mergeChannels(ocrChannels, analyzed.channels);
    
    // Calculate new confidence based on LLM agreement
    const newConfidence = calculateConfidence(ocrConfidence, analyzed.confidence, mergedChannels);
    
    return {
      channels: mergedChannels,
      rawText: ocrText,
      confidence: newConfidence,
      fixtureName: analyzed.fixtureName ?? extractFixtureName(ocrText) ?? undefined,
      totalChannels: mergedChannels.length,
    };
  } catch (error) {
    console.error("LLM analysis failed:", error);
    // Fallback to OCR results
    return {
      channels: ocrChannels,
      rawText: ocrText,
      confidence: ocrConfidence,
      totalChannels: ocrChannels.length,
    };
  }
}

/**
 * Build the prompt for LLM analysis
 */
function buildAnalysisPrompt(ocrText: string, ocrChannels: DmxChannel[]): string {
  const channelList = ocrChannels
    .map((c) => `CH${c.channel}: ${c.function} (${c.type})`)
    .join("\n");

  return `You are an expert in DMX lighting fixtures. Analyze this OCR text from a DMX manual and improve the channel detection.

## OCR Raw Text:
${ocrText}

## OCR Detected Channels:
${channelList || "No channels detected"}

## Task:
1. Analyze the OCR text and identify ALL DMX channels
2. For each channel, provide:
   - Channel number
   - Function name (correct any OCR errors)
   - Type (dimmer, red, green, blue, white, amber, uv, pan, tilt, pan_fine, tilt_fine, gobo, color_wheel, strobe, shutter, zoom, focus, iris, prism, speed, macro, sound, reset, other)
   - Min value (if specified)
   - Max value (if specified)
3. Try to identify the fixture name and manufacturer
4. Provide a confidence score (0-100)

## Response Format (JSON):
{
  "fixtureName": "string or null",
  "manufacturer": "string or null",
  "channels": [
    {
      "channel": number,
      "function": "string",
      "type": "string",
      "minValue": number or null,
      "maxValue": number or null
    }
  ],
  "confidence": number,
  "reasoning": "string explaining your analysis"
}

Respond ONLY with valid JSON, no markdown.`;
}

/**
 * Call the LLM API
 */
async function callLlm(config: LlmConfig, prompt: string): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  // Handle different providers
  let baseUrl = config.baseUrl;
  let body: any;

  if (config.provider === "opencode_go") {
    // OpenCode Go uses different endpoints for different models
    const openaiModels = ["kimi-k2.6", "kimi-k2.5", "glm-5.1", "glm-5", "deepseek-v4-pro", "deepseek-v4-flash", "mimo-v2.5", "mimo-v2.5-pro"];
    
    if (openaiModels.includes(config.model)) {
      baseUrl = "https://opencode.ai/zen/go/v1/chat/completions";
      body = {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      };
    } else {
      // Anthropic-compatible models
      baseUrl = "https://opencode.ai/zen/go/v1/messages";
      headers["x-api-key"] = config.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      delete headers["Authorization"];
      body = {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      };
    }
  } else if (config.provider === "openai") {
    baseUrl = "https://api.openai.com/v1/chat/completions";
    body = {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    };
  } else if (config.provider === "anthropic") {
    baseUrl = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    delete headers["Authorization"];
    body = {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    };
  } else if (config.provider === "openrouter") {
    baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    body = {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    };
  } else if (config.provider === "nvidia_nim") {
    baseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    body = {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    };
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // Extract content based on provider
  if (config.provider === "anthropic" || (config.provider === "opencode_go" && !["kimi-k2.6", "kimi-k2.5", "glm-5.1", "glm-5", "deepseek-v4-pro", "deepseek-v4-flash", "mimo-v2.5", "mimo-v2.5-pro"].includes(config.model))) {
    return data.content?.[0]?.text || "";
  } else {
    return data.choices?.[0]?.message?.content || "";
  }
}

/**
 * Parse LLM response JSON
 */
function parseLlmResponse(response: string): LlmResponse {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      fixtureName: parsed.fixtureName || null,
      manufacturer: parsed.manufacturer || null,
      channels: (parsed.channels || []).map((ch: any) => ({
        channel: ch.channel || 0,
        function: ch.function || "",
        type: validateChannelType(ch.type) || "other",
        minValue: ch.minValue || undefined,
        maxValue: ch.maxValue || undefined,
      })),
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning || "",
    };
  } catch (error) {
    console.error("Failed to parse LLM response:", error);
    return {
      channels: [],
      confidence: 0,
      reasoning: "Failed to parse LLM response",
    };
  }
}

/**
 * Validate channel type
 */
function validateChannelType(type: string): DmxChannelType | null {
  const validTypes: DmxChannelType[] = [
    "dimmer", "red", "green", "blue", "white", "amber", "uv",
    "pan", "tilt", "pan_fine", "tilt_fine", "gobo", "color_wheel",
    "strobe", "shutter", "zoom", "focus", "iris", "prism",
    "speed", "macro", "sound", "reset", "other",
  ];
  
  if (validTypes.includes(type as DmxChannelType)) {
    return type as DmxChannelType;
  }
  return null;
}

/**
 * Merge OCR channels with LLM channels
 */
function mergeChannels(ocrChannels: DmxChannel[], llmChannels: DmxChannel[]): DmxChannel[] {
  const merged = new Map<number, DmxChannel>();

  // Add OCR channels first
  for (const ch of ocrChannels) {
    merged.set(ch.channel, ch);
  }

  // Override with LLM channels (higher quality)
  for (const ch of llmChannels) {
    if (ch.channel > 0 && ch.function) {
      const existing = merged.get(ch.channel);
      if (existing) {
        // Merge: prefer LLM data but keep OCR fallbacks
        merged.set(ch.channel, {
          channel: ch.channel,
          function: ch.function || existing.function,
          type: ch.type !== "other" ? ch.type : existing.type,
          minValue: ch.minValue ?? existing.minValue,
          maxValue: ch.maxValue ?? existing.maxValue,
        });
      } else {
        merged.set(ch.channel, ch);
      }
    }
  }

  // Sort by channel number
  return Array.from(merged.values()).sort((a, b) => a.channel - b.channel);
}

/**
 * Calculate combined confidence score
 */
function calculateConfidence(
  ocrConfidence: number,
  llmConfidence: number,
  channels: DmxChannel[]
): number {
  // Base confidence from LLM
  let confidence = llmConfidence;

  // Boost if LLM and OCR agree on channels
  if (ocrConfidence > 50 && channels.length > 0) {
    confidence = Math.min(100, confidence + 10);
  }

  // Boost based on channel completeness
  const hasCompleteChannels = channels.every(
    (ch) => ch.function && ch.type !== "other"
  );
  if (hasCompleteChannels && channels.length > 0) {
    confidence = Math.min(100, confidence + 15);
  }

  return Math.round(confidence);
}

/**
 * Extract fixture name from OCR text
 */
function extractFixtureName(text: string): string | null {
  const lines = text.split("\n").slice(0, 10);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 60 && /[A-Za-z]/.test(trimmed)) {
      // Skip lines that look like channel descriptions
      if (!/^(ch|channel|canal|\d)/i.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * Suggest auto-patch based on fixture analysis
 */
export function suggestAutoPatch(
  channels: DmxChannel[],
  startAddress: number = 1,
  universe: number = 1
): {
  patches: Array<{
    channel: number;
    address: number;
    type: string;
    label: string;
  }>;
  totalChannels: number;
} {
  const patches = channels.map((ch, idx) => ({
    channel: ch.channel,
    address: startAddress + idx,
    type: ch.type,
    label: `${ch.function} (${ch.type})`,
  }));

  return {
    patches,
    totalChannels: channels.length,
  };
}

/**
 * Analyze OCR text for multiple fixtures
 */
export async function analyzeMultiFixtures(
  ocrText: string,
  ocrChannels: DmxChannel[],
  ocrConfidence: number
): Promise<MultiFixtureResult> {
  const config = getLlmConfig();
  
  if (!config || !config.apiKey) {
    // No LLM, return single fixture
    return {
      fixtures: [{
        channels: ocrChannels,
        rawText: ocrText,
        confidence: ocrConfidence,
        totalChannels: ocrChannels.length,
      }],
      totalFixtures: 1,
    };
  }

  try {
    const prompt = `Analyze this OCR text from DMX manuals and identify ALL separate fixtures.
For each fixture, provide:
- fixtureName
- manufacturer
- channels (with channel number, function, type)
- confidence score

OCR Text:
${ocrText}

Detected Channels:
${ocrChannels.map(c => `CH${c.channel}: ${c.function}`).join("\n")}

Response Format (JSON):
{
  "fixtures": [
    {
      "fixtureName": "string",
      "manufacturer": "string",
      "channels": [
        { "channel": number, "function": "string", "type": "string", "minValue": number|null, "maxValue": number|null }
      ],
      "confidence": number
    }
  ]
}

Respond ONLY with valid JSON.`;

    const llmResponse = await callLlm(config, prompt);
    const parsed = JSON.parse(llmResponse.match(/\{[\s\S]*\}/)?.[0] || "{}");
    
    if (parsed.fixtures && Array.isArray(parsed.fixtures)) {
      return {
        fixtures: parsed.fixtures.map((f: any) => ({
          channels: (f.channels || []).map((ch: any) => ({
            channel: ch.channel || 0,
            function: ch.function || "",
            type: validateChannelType(ch.type) || "other",
            minValue: ch.minValue || undefined,
            maxValue: ch.maxValue || undefined,
          })),
          rawText: ocrText,
          confidence: f.confidence || ocrConfidence,
          fixtureName: f.fixtureName || null,
          totalChannels: (f.channels || []).length,
        })),
        totalFixtures: parsed.fixtures.length,
      };
    }
  } catch (error) {
    console.error("Multi-fixture analysis failed:", error);
  }

  // Fallback to single fixture
  return {
    fixtures: [{
      channels: ocrChannels,
      rawText: ocrText,
      confidence: ocrConfidence,
      totalChannels: ocrChannels.length,
    }],
    totalFixtures: 1,
  };
}

/**
 * Match a fixture with the QLC+ library
 */
export async function matchWithLibrary(
  fixtureName: string,
  channels: DmxChannel[]
): Promise<LibraryFixture | null> {
  try {
    const libraryPath = path.resolve(__dirname, "../../data/fixtures_library.json");
    if (!fs.existsSync(libraryPath)) return null;
    
    const library: LibraryFixture[] = JSON.parse(fs.readFileSync(libraryPath, "utf-8"));
    const normalizedName = fixtureName.toLowerCase();
    
    // Find best match by name similarity
    let bestMatch: LibraryFixture | null = null;
    let bestScore = 0;
    
    for (const libFixture of library) {
      const libName = `${libFixture.manufacturer} ${libFixture.model}`.toLowerCase();
      
      // Calculate similarity score
      let score = 0;
      const nameWords = normalizedName.split(/\s+/);
      const libWords = libName.split(/\s+/);
      
      for (const word of nameWords) {
        if (libWords.some(lw => lw.includes(word) || word.includes(lw))) {
          score += 1;
        }
      }
      
      // Normalize score
      score = score / Math.max(nameWords.length, libWords.length);
      
      // Bonus for exact manufacturer match
      if (libFixture.manufacturer && normalizedName.includes(libFixture.manufacturer.toLowerCase())) {
        score += 0.3;
      }
      
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = libFixture;
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.error("Library match failed:", error);
    return null;
  }
}

/**
 * Suggest fixture settings based on type and existing patch
 */
export async function suggestFixtureSettings(
  fixtureType: string,
  existingPatch: Array<{ grp: string; start_address: number; channel_count: number }>
): Promise<FixtureSuggestion> {
  // Default suggestions based on fixture type
  const typeDefaults: Record<string, Partial<FixtureSuggestion>> = {
    "PAR LED": {
      suggested_height: 2.5,
      suggested_rotation: 0,
      profile: ["R", "G", "B"],
    },
    "Moving Head": {
      suggested_height: 4.0,
      suggested_rotation: 0,
      profile: ["Pan", "Tilt", "Dim", "Strobe", "ColorWheel", "Gobo1"],
    },
    "Effet": {
      suggested_height: 3.0,
      suggested_rotation: 45,
      profile: ["R", "G", "B", "Strobe", "Speed"],
    },
    "Stroboscope": {
      suggested_height: 3.0,
      suggested_rotation: 0,
      profile: ["Dim", "Strobe"],
    },
    "Dimmer": {
      suggested_height: 2.0,
      suggested_rotation: 0,
      profile: ["Dim"],
    },
    "Barre LED": {
      suggested_height: 2.0,
      suggested_rotation: 0,
      profile: ["R", "G", "B", "W"],
    },
    "Laser": {
      suggested_height: 3.0,
      suggested_rotation: 0,
      profile: ["Mode", "Speed"],
    },
    "Pixel Bar": {
      suggested_height: 2.0,
      suggested_rotation: 0,
      profile: ["R", "G", "B", "W"],
    },
  };
  
  const defaults = typeDefaults[fixtureType] || typeDefaults["PAR LED"];
  
  // Find next available address
  let suggestedAddress = 1;
  if (existingPatch.length > 0) {
    const maxAddress = Math.max(
      ...existingPatch.map(p => p.start_address + p.channel_count)
    );
    suggestedAddress = maxAddress;
  }
  
  // Find least used group
  const groupCounts: Record<string, number> = {};
  for (const p of existingPatch) {
    groupCounts[p.grp] = (groupCounts[p.grp] || 0) + 1;
  }
  
  const groups = ["A", "B", "C", "D", "E", "F"];
  let suggestedGroup = "A";
  let minCount = Infinity;
  
  for (const g of groups) {
    const count = groupCounts[g] || 0;
    if (count < minCount) {
      minCount = count;
      suggestedGroup = g;
    }
  }
  
  return {
    fixture_type: fixtureType,
    profile: defaults.profile || [],
    manufacturer: null,
    mode_name: null,
    suggested_group: suggestedGroup,
    suggested_address: suggestedAddress,
    suggested_height: defaults.suggested_height || 3.0,
    suggested_rotation: defaults.suggested_rotation || 0,
    confidence: 70,
  };
}

/**
 * Learn from user corrections to improve future scans
 */
export async function learnFromCorrection(
  originalName: string,
  correctedType: string,
  correctedProfile: string[]
): Promise<void> {
  const learningData = loadLearningData();
  
  // Add new learning entry
  learningData.push({
    originalName,
    correctedType,
    correctedProfile,
    timestamp: new Date(),
  });
  
  // Keep only last 1000 entries
  if (learningData.length > 1000) {
    learningData.splice(0, learningData.length - 1000);
  }
  
  saveLearningData(learningData);
}

/**
 * Get suggestions based on learning data
 */
export function getLearnedSuggestions(fixtureName: string): {
  type: string | null;
  profile: string[] | null;
} {
  const learningData = loadLearningData();
  const normalizedName = fixtureName.toLowerCase();
  
  // Find similar entries
  const matches = learningData.filter(entry => 
    entry.originalName.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(entry.originalName.toLowerCase())
  );
  
  if (matches.length === 0) {
    return { type: null, profile: null };
  }
  
  // Get most common type and profile
  const typeCounts: Record<string, number> = {};
  const profileCounts: Record<string, number> = {};
  
  for (const match of matches) {
    typeCounts[match.correctedType] = (typeCounts[match.correctedType] || 0) + 1;
    const profileKey = match.correctedProfile.join(",");
    profileCounts[profileKey] = (profileCounts[profileKey] || 0) + 1;
  }
  
  const bestType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const bestProfileKey = Object.entries(profileCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const bestProfile = bestProfileKey ? bestProfileKey.split(",") : null;
  
  return { type: bestType, profile: bestProfile };
}

/**
 * Suggest fixture from name using LLM
 */
export async function suggestFixtureFromName(
  name: string,
  currentProfile?: string[]
): Promise<FixtureSuggestion> {
  const config = getLlmConfig();
  
  // First check learning data
  const learned = getLearnedSuggestions(name);
  
  if (!config || !config.apiKey) {
    // No LLM, use learned data or defaults
    return {
      fixture_type: learned.type || "PAR LED",
      profile: learned.profile || currentProfile || ["R", "G", "B"],
      manufacturer: null,
      mode_name: null,
      suggested_group: "A",
      suggested_address: 1,
      suggested_height: 3.0,
      suggested_rotation: 0,
      confidence: learned.type ? 80 : 50,
    };
  }

  try {
    const prompt = `You are an expert in DMX lighting fixtures. Analyze this fixture name and suggest its configuration.

Fixture Name: "${name}"
${currentProfile ? `Current Profile: ${JSON.stringify(currentProfile)}` : ""}

Provide:
1. fixture_type: One of "PAR LED", "Moving Head", "Effet", "Stroboscope", "Dimmer", "Barre LED", "Laser", "Pixel Bar"
2. profile: Array of DMX channels from: R, G, B, W, Dim, Strobe, UV, Ambre, Orange, Zoom, Smoke, Fan, Pan, PanFine, Tilt, TiltFine, Gobo1, Gobo1Rot, Gobo2, Prism, PrismRot, Focus, ColorWheel, Shutter, Speed, Mode
3. manufacturer: Detected manufacturer name (or null)
4. mode_name: Suggested mode name (or null)

Response Format (JSON):
{
  "fixture_type": "string",
  "profile": ["string"],
  "manufacturer": "string or null",
  "mode_name": "string or null"
}

Respond ONLY with valid JSON.`;

    const llmResponse = await callLlm(config, prompt);
    const parsed = JSON.parse(llmResponse.match(/\{[\s\S]*\}/)?.[0] || "{}");
    
    // Merge with learned data
    const type = parsed.fixture_type || learned.type || "PAR LED";
    const profile = parsed.profile || learned.profile || currentProfile || ["R", "G", "B"];
    
    return {
      fixture_type: type,
      profile: Array.isArray(profile) ? profile : ["R", "G", "B"],
      manufacturer: parsed.manufacturer || null,
      mode_name: parsed.mode_name || null,
      suggested_group: "A",
      suggested_address: 1,
      suggested_height: 3.0,
      suggested_rotation: 0,
      confidence: 85,
    };
  } catch (error) {
    console.error("Fixture suggestion failed:", error);
    return {
      fixture_type: learned.type || "PAR LED",
      profile: learned.profile || currentProfile || ["R", "G", "B"],
      manufacturer: null,
      mode_name: null,
      suggested_group: "A",
      suggested_address: 1,
      suggested_height: 3.0,
      suggested_rotation: 0,
      confidence: learned.type ? 70 : 40,
    };
  }
}
