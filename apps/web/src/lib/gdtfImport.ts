// ─────────────────────────────────────────────────────────────────────────
// gdtfImport.ts — Import GDTF (.gdtf) → fixture de l'app
//
// Un fichier .gdtf est une archive ZIP contenant "description.xml".
// Le XML décrit un FixtureType (Name, Manufacturer) et un ou plusieurs DMXMode ;
// chaque DMXMode contient des DMXChannel ; chaque DMXChannel porte un attribut
// logique (Pan, Tilt, Dimmer, ColorAdd_R, …).
//
// Ce module est PUR côté logique : mapGdtfAttributeToType et toAppFixture ne
// dépendent d'aucune API navigateur et sont testables sous node.
// parseGdtfDescription (DOMParser) et extractGdtfXml (DecompressionStream)
// sont gardés derrière un guard navigateur.
// ─────────────────────────────────────────────────────────────────────────

// Types de canaux RÉELS de l'app (cf. FixturesPage DMX_TYPES).
// On n'invente aucune valeur hors de cette liste ; fallback générique = "other".
export const APP_CHANNEL_TYPES = [
  "dimmer", "red", "green", "blue", "white", "amber", "uv",
  "pan", "tilt", "pan_fine", "tilt_fine", "gobo", "color_wheel",
  "strobe", "shutter", "zoom", "focus", "iris", "prism",
  "speed", "macro", "sound", "reset", "other",
] as const;

export type AppChannelType = (typeof APP_CHANNEL_TYPES)[number];

// ─── Mapping attribut GDTF → type de canal app ───────────────────────────
// PARTIE TESTÉE. Insensible à la casse et aux suffixes numériques (Gobo1, Color2).
export function mapGdtfAttributeToType(attr: string): AppChannelType {
  if (!attr) return "other";

  // Normalise : minuscules, on retire les suffixes numériques de désambiguïsation
  // GDTF (Gobo1, Color2, ColorAdd_R, Shutter1…) tout en gardant les _fine.
  const raw = attr.trim().toLowerCase();
  // Supprime les chiffres en fin de jeton (Gobo1 → gobo, Color2 → color).
  const base = raw.replace(/\d+$/, "").replace(/_\d+$/, "");

  // Couleurs additives GDTF (ColorAdd_R / Red / ColorRGB_R …) et soustractives.
  if (/(coloradd_r|colorrgb_r|colorsub_c|^red$|_red$)/.test(base) || base === "r") return "red";
  if (/(coloradd_g|colorrgb_g|colorsub_m|^green$|_green$)/.test(base) || base === "g") return "green";
  if (/(coloradd_b|colorrgb_b|colorsub_y|^blue$|_blue$)/.test(base) || base === "b") return "blue";
  if (/(coloradd_w|colorrgb_w|^white$|_white$)/.test(base) || base === "w") return "white";
  if (/(coloradd_a|^amber$|_amber$)/.test(base)) return "amber";
  if (/(coloradd_uv|^uv$|_uv$|ultraviolet)/.test(base)) return "uv";

  // Position. _fine en priorité.
  if (base.includes("pan")) return base.includes("fine") ? "pan_fine" : "pan";
  if (base.includes("tilt")) return base.includes("fine") ? "tilt_fine" : "tilt";

  // Intensité.
  if (/(dimmer|intensity)/.test(base)) return "dimmer";

  // Obturateur / strobe : Shutter logique GDTF couvre souvent le strobe.
  if (base.includes("strob")) return "strobe";
  if (base.includes("shutter")) return "shutter";

  // Roues à gobo / couleur.
  if (base.includes("gobo")) return "gobo";
  if (base.includes("color") || base.includes("colour")) return "color_wheel";

  // Optique / effets directs présents dans la liste app.
  if (base.includes("zoom")) return "zoom";
  if (base.includes("focus")) return "focus";
  if (base.includes("iris")) return "iris";
  if (base.includes("prism")) return "prism";

  // Vitesse / macros / reset.
  if (/(speed|rate|mspeed|pantiltspeed)/.test(base)) return "speed";
  if (base.includes("macro")) return "macro";
  if (base.includes("reset") || base.includes("control")) return "reset";

  // Fallback générique présent dans la liste.
  return "other";
}

// ─── Modèle intermédiaire d'une fixture GDTF parsée ──────────────────────
export interface ParsedGdtfChannel {
  attribute: string;       // attribut logique GDTF brut (ex: "ColorAdd_R")
  type: AppChannelType;    // type canonique app
  offset: number;          // 1er offset DMX (1-based) du canal dans le mode
}

export interface ParsedGdtfMode {
  name: string;
  channels: ParsedGdtfChannel[];
}

export interface ParsedGdtfFixture {
  name: string;
  manufacturer: string;
  modes: ParsedGdtfMode[];
}

// ─── Payload attendu par POST /api/fixtures (cf. saveFixture) ────────────
export interface AppFixtureChannel {
  channel: number;         // index 1-based dans le mode
  function: string;        // libellé lisible (= attribut GDTF)
  type: AppChannelType;
}

export interface AppFixtureMode {
  name: string;
  channels: AppFixtureChannel[];
}

export interface AppFixturePayload {
  name: string;
  manufacturer?: string;
  startAddress: number;
  channels: AppFixtureChannel[];   // canaux du mode choisi
  total_channels: number;
  modes: AppFixtureMode[];         // tous les modes (le mode choisi inclus)
}

// ─── Conversion d'un mode GDTF → payload fixture app ─────────────────────
// PARTIE TESTABLE (pure). mappe offset→channel, attribute→type.
export function toAppFixture(
  parsed: ParsedGdtfFixture,
  modeIndex: number,
  startAddress: number,
): AppFixturePayload {
  const mode = parsed.modes[modeIndex];
  if (!mode) {
    throw new Error(`Mode GDTF introuvable à l'index ${modeIndex}`);
  }

  // On ordonne par offset et on réindexe en channel 1-based séquentiel.
  const ordered = [...mode.channels].sort((a, b) => a.offset - b.offset);
  const channels: AppFixtureChannel[] = ordered.map((c, i) => ({
    channel: i + 1,
    function: c.attribute,
    type: c.type,
  }));

  const modes: AppFixtureMode[] = parsed.modes.map((m) => {
    const ord = [...m.channels].sort((a, b) => a.offset - b.offset);
    return {
      name: m.name,
      channels: ord.map((c, i) => ({ channel: i + 1, function: c.attribute, type: c.type })),
    };
  });

  return {
    name: parsed.name,
    manufacturer: parsed.manufacturer || undefined,
    startAddress,
    channels,
    total_channels: channels.length,
    modes,
  };
}

// ─── Parse du description.xml (DOMParser, navigateur uniquement) ─────────
export function parseGdtfDescription(xml: string): ParsedGdtfFixture {
  if (typeof DOMParser === "undefined") {
    throw new Error("DOMParser indisponible (hors navigateur)");
  }

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("description.xml invalide (erreur de parsing XML)");
  }

  const fixtureType = doc.querySelector("FixtureType");
  if (!fixtureType) {
    throw new Error("FixtureType absent du description.xml");
  }

  const name = fixtureType.getAttribute("Name")?.trim() || "Fixture GDTF";
  const manufacturer = fixtureType.getAttribute("Manufacturer")?.trim() || "";

  const modes: ParsedGdtfMode[] = [];
  doc.querySelectorAll("DMXModes > DMXMode, DMXMode").forEach((modeEl) => {
    // querySelectorAll peut renvoyer des doublons selon le DOM ; on déduplique par référence.
    if (modes.some((m) => m.name === (modeEl.getAttribute("Name") || ""))) {
      // garde le premier mode portant ce nom
    }
    const modeName = modeEl.getAttribute("Name")?.trim() || `Mode ${modes.length + 1}`;
    if (modes.some((m) => m.name === modeName)) return;

    const channels: ParsedGdtfChannel[] = [];
    modeEl.querySelectorAll("DMXChannels > DMXChannel, DMXChannel").forEach((chEl) => {
      // L'attribut logique est porté par LogicalChannel/@Attribute (sinon DMXChannel/@Attribute).
      const logical = chEl.querySelector("LogicalChannel");
      const attribute =
        logical?.getAttribute("Attribute")?.trim() ||
        chEl.getAttribute("Attribute")?.trim() ||
        "";

      // Offset : "1,2" (coarse,fine) ou "None". On garde le coarse (premier).
      const offsetAttr = chEl.getAttribute("Offset")?.trim() || "";
      const first = offsetAttr.split(",")[0];
      const offset = Number.parseInt(first, 10);

      channels.push({
        attribute,
        type: mapGdtfAttributeToType(attribute),
        // Si Offset="None" → on place le canal en fin (offset très grand préservant l'ordre).
        offset: Number.isFinite(offset) ? offset : channels.length + 1000,
      });
    });

    modes.push({ name: modeName, channels });
  });

  if (modes.length === 0) {
    throw new Error("Aucun DMXMode trouvé dans le description.xml");
  }

  return { name, manufacturer, modes };
}

// ─── Extraction de description.xml depuis le ZIP .gdtf (navigateur) ──────
// Lecture des en-têtes locaux ZIP (signature 0x04034b50), localisation de
// l'entrée "description.xml", inflate via DecompressionStream('deflate-raw').
export async function extractGdtfXml(buffer: ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream indisponible (hors navigateur)");
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");
  let offset = 0;

  while (offset + 4 <= view.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // plus d'en-tête local (Central Directory atteint)

    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    const entryName = decoder.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    // description.xml peut être à la racine ; on compare le nom de base.
    const baseName = entryName.split("/").pop()?.toLowerCase();
    if (baseName === "description.xml") {
      if (method === 0) {
        // Stocké (non compressé) → décodage UTF-8 direct.
        return decoder.decode(raw);
      }
      if (method === 8) {
        // Deflate brut → inflate via DecompressionStream.
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(stream).text();
      }
      throw new Error(`Méthode de compression ZIP non supportée: ${method}`);
    }

    offset = dataStart + compressedSize;
  }

  throw new Error("description.xml introuvable dans l'archive GDTF");
}
