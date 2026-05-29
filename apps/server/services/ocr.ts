import { createWorker } from "tesseract.js";

/**
 * Vérification de qualité d'image pour le scan OCR
 */
export interface ImageQuality {
  score: number;        // 0-100
  isBlurry: boolean;
  isTooDark: boolean;
  isTooLight: boolean;
  isAngled: boolean;
  resolution: { width: number; height: number };
  suggestions: string[];
}

/**
 * Vérifie la qualité d'une image avant le scan OCR
 * Analyse : netteté, luminosité, résolution
 */
export async function checkImageQuality(imageBuffer: Buffer): Promise<ImageQuality> {
  const suggestions: string[] = [];
  let score = 100;
  
  // Créer un canvas pour analyser l'image
  const uint8Array = new Uint8Array(imageBuffer);
  const blob = new Blob([uint8Array]);
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  
  // 1. Vérifier la résolution
  const resolution = { width, height };
  if (width < 800 || height < 600) {
    score -= 30;
    suggestions.push("Résolution trop basse. Utilisez une image d'au moins 1200px de large.");
  } else if (width < 1200) {
    score -= 10;
    suggestions.push("Résolution moyenne. Une image plus nette améliorerait la détection.");
  }
  
  // 2. Analyser la luminosité et la netteté via un canvas temporaire
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Calculer la luminosité moyenne
  let totalBrightness = 0;
  let pixelCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    totalBrightness += brightness;
    pixelCount++;
  }
  const avgBrightness = totalBrightness / pixelCount;
  
  // Vérifier la luminosité
  const isTooDark = avgBrightness < 80;
  const isTooLight = avgBrightness > 200;
  
  if (isTooDark) {
    score -= 25;
    suggestions.push("Image trop sombre. Améliorez l'éclairage ou augmentez la luminosité.");
  } else if (isTooLight) {
    score -= 20;
    suggestions.push("Image trop claire. Réduisez la luminosité ou évitez les reflets.");
  }
  
  // 3. Estimer la netteté (variance du Laplacien simplifié)
  let laplacianVariance = 0;
  const grayValues: number[] = [];
  
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const center = data[idx];
      const top = data[((y - 1) * width + x) * 4];
      const bottom = data[((y + 1) * width + x) * 4];
      const left = data[(y * width + (x - 1)) * 4];
      const right = data[(y * width + (x + 1)) * 4];
      
      // Laplacien simplifié
      const laplacian = Math.abs(-4 * center + top + bottom + left + right);
      grayValues.push(laplacian);
    }
  }
  
  // Calculer la variance
  if (grayValues.length > 0) {
    const mean = grayValues.reduce((a, b) => a + b, 0) / grayValues.length;
    laplacianVariance = grayValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / grayValues.length;
  }
  
  const isBlurry = laplacianVariance < 100;
  if (isBlurry) {
    score -= 30;
    suggestions.push("Image floue. Prenez une photo plus nette ou stabilisez l'appareil.");
  }
  
  // 4. Détecter l'angle (simplifié - on vérifie si les bords sont droits)
  // Pour une détection complète, on utiliserait la transformée de Hough
  // Ici on fait une estimation basée sur la distribution des pixels sombres
  let topDarkPixels = 0;
  let bottomDarkPixels = 0;
  const threshold = 128;
  
  for (let y = 0; y < height / 4; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      if (brightness < threshold) topDarkPixels++;
    }
  }
  
  for (let y = Math.floor(height * 3 / 4); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      if (brightness < threshold) bottomDarkPixels++;
    }
  }
  
  // Si la différence est trop grande, l'image est probablement inclinée
  const darkRatio = Math.abs(topDarkPixels - bottomDarkPixels) / Math.max(topDarkPixels, bottomDarkPixels, 1);
  const isAngled = darkRatio > 0.5;
  
  if (isAngled) {
    score -= 15;
    suggestions.push("Image possiblement inclinée. Essayez de prendre la photo de face.");
  }
  
  // Limiter le score entre 0 et 100
  score = Math.max(0, Math.min(100, score));
  
  // Si pas de suggestions, ajouter un message positique
  if (suggestions.length === 0) {
    suggestions.push("Image de bonne qualité. Le scan devrait bien fonctionner.");
  }
  
  return {
    score,
    isBlurry,
    isTooDark,
    isTooLight,
    isAngled,
    resolution,
    suggestions,
  };
}

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
