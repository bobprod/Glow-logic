import { createWorker } from "tesseract.js";

/**
 * Représentation d'un channel DMX extrait depuis une photo de manuel.
 */
export interface DmxChannel {
  channel: number;
  function: string;
  type: DmxChannelType;
  minValue?: number;
  maxValue?: number;
  notes?: string;
}

export type DmxChannelType =
  | "dimmer"
  | "red"
  | "green"
  | "blue"
  | "white"
  | "amber"
  | "uv"
  | "pan"
  | "tilt"
  | "pan_fine"
  | "tilt_fine"
  | "gobo"
  | "color_wheel"
  | "strobe"
  | "shutter"
  | "zoom"
  | "focus"
  | "iris"
  | "prism"
  | "speed"
  | "macro"
  | "sound"
  | "reset"
  | "other";

export interface ScanResult {
  channels: DmxChannel[];
  rawText: string;
  confidence: number;
  fixtureName?: string;
  totalChannels: number;
}

/**
 * Dictionnaire FR/EN de mots-clés vers type de channel.
 * Utilisé par le parseur pour deviner le type depuis la fonction OCR.
 */
const TYPE_KEYWORDS: Record<DmxChannelType, string[]> = {
  dimmer: [
    "dimmer",
    "intensity",
    "intensite",
    "intensité",
    "master",
    "brightness",
    "luminosite",
  ],
  red: ["red", "rouge"],
  green: ["green", "vert"],
  blue: ["blue", "bleu"],
  white: ["white", "blanc"],
  amber: ["amber", "ambre"],
  uv: ["uv", "ultraviolet"],
  pan: ["pan"],
  tilt: ["tilt"],
  pan_fine: ["pan fine", "pan f", "fine pan"],
  tilt_fine: ["tilt fine", "tilt f", "fine tilt"],
  gobo: ["gobo"],
  color_wheel: ["color wheel", "colour", "roue de couleur", "roue couleur"],
  strobe: ["strobe", "strob", "flash"],
  shutter: ["shutter", "obturateur"],
  zoom: ["zoom"],
  focus: ["focus", "mise au point"],
  iris: ["iris"],
  prism: ["prism", "prisme"],
  speed: ["speed", "vitesse"],
  macro: ["macro", "program", "programme"],
  sound: ["sound", "son", "audio", "mic"],
  reset: ["reset", "lamp", "lampe"],
  other: [],
};

function guessType(label: string): DmxChannelType {
  const normalized = label.toLowerCase().trim();
  // Ordre de priorité : types composés d'abord (pan_fine avant pan, etc.)
  const priorityOrder: DmxChannelType[] = [
    "pan_fine",
    "tilt_fine",
    "color_wheel",
    "pan",
    "tilt",
    "dimmer",
    "red",
    "green",
    "blue",
    "white",
    "amber",
    "uv",
    "gobo",
    "strobe",
    "shutter",
    "zoom",
    "focus",
    "iris",
    "prism",
    "speed",
    "macro",
    "sound",
    "reset",
    "other",
  ];
  for (const type of priorityOrder) {
    for (const kw of TYPE_KEYWORDS[type]) {
      if (normalized.includes(kw)) return type;
    }
  }
  return "other";
}

/**
 * Parse le texte OCR pour en extraire des lignes de channels DMX.
 * Supporte des formats variés :
 *   "1   Pan"
 *   "Ch.2 : Tilt"
 *   "CH3 - Dimmer 0-255"
 *   "4  Gobo wheel  0-127 Static / 128-255 Rotate"
 */
export function parseDmxChannels(rawText: string): DmxChannel[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const channels: DmxChannel[] = [];
  const seen = new Set<number>();

  // Regex : début de ligne avec éventuellement "Ch"/"CH"/"Channel"/"Canal", puis un numéro
  const channelRegex =
    /^(?:ch(?:annel)?\.?|canal)?\s*(\d{1,3})[\s:.\-)]+(.+)$/i;
  const rangeRegex = /(\d{1,3})\s*[-–]\s*(\d{1,3})/;

  for (const line of lines) {
    const match = line.match(channelRegex);
    if (!match) continue;

    const chNum = parseInt(match[1], 10);
    if (chNum < 1 || chNum > 512 || seen.has(chNum)) continue;

    // Nettoyage de la description
    const rest = match[2].replace(/\s{2,}/g, " ").trim();
    const functionName = rest
      .split(/[:|;]/)[0]
      .replace(/\s+0\s*[-–]\s*255.*$/i, "")
      .trim();
    if (functionName.length < 2 || functionName.length > 80) continue;

    // Valeurs min/max si présentes
    const rangeMatch = rest.match(rangeRegex);
    const minValue = rangeMatch ? parseInt(rangeMatch[1], 10) : undefined;
    const maxValue = rangeMatch ? parseInt(rangeMatch[2], 10) : undefined;

    channels.push({
      channel: chNum,
      function: functionName,
      type: guessType(functionName),
      minValue,
      maxValue,
      notes: rest !== functionName ? rest : undefined,
    });
    seen.add(chNum);
  }

  // Tri par numéro de channel
  channels.sort((a, b) => a.channel - b.channel);
  return channels;
}

/**
 * Lance un OCR Tesseract (français + anglais) sur le buffer d'image fourni
 * et retourne les channels DMX extraits.
 */
export async function scanDmxManual(imageBuffer: Buffer): Promise<ScanResult> {
  const worker = await createWorker(["eng", "fra"]);

  try {
    const { data } = await worker.recognize(imageBuffer);
    const channels = parseDmxChannels(data.text);

    // Tentative de récupération d'un nom de fixture (première ligne en majuscules)
    const firstLines = data.text.split(/\r?\n/).slice(0, 5);
    const fixtureName = firstLines
      .map((l) => l.trim())
      .find((l) => l.length > 3 && l.length < 60 && /[A-Za-z]/.test(l));

    return {
      channels,
      rawText: data.text,
      confidence: data.confidence,
      fixtureName,
      totalChannels: channels.length,
    };
  } finally {
    await worker.terminate();
  }
}
