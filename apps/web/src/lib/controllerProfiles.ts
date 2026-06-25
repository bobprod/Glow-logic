// ─────────────────────────────────────────────────────────────────────────
// controllerProfiles.ts — Profils de contrôleurs + mapping couleur → LED.
//
// Le feedback LED (allumer les pads d'un APC/Launchpad à la couleur du Look,
// faire clignoter le pad actif) a besoin de traduire une couleur de scène
// (classe Tailwind "bg-cyan-500" OU hex "#22d3ee") en une VÉLOCITÉ MIDI
// comprise par le contrôleur. Chaque modèle a son modèle de LED :
//   - velocity3 : APC mini d'origine = 3 couleurs (vert/rouge/jaune) + variantes
//                 clignotantes. On réduit toute couleur à la plus proche.
//   - rgb       : APC mini mk2 / Launchpad = palette indexée par vélocité.
//   - none      : pas de feedback.
//
// Tout est PUR et testable sous node (aucune API navigateur). La sortie MIDI
// réelle (output.send) vit dans MidiListener et consomme ce module.
// ─────────────────────────────────────────────────────────────────────────

export type LedModel = "velocity3" | "rgb" | "none";

// Famille de couleur grossière, déduite d'une classe Tailwind ou d'un hex.
export type ColorFamily =
  | "off" | "red" | "orange" | "amber" | "yellow" | "lime"
  | "green" | "teal" | "cyan" | "blue" | "indigo" | "purple" | "pink" | "white";

export interface ControllerProfile {
  id: string;
  label: string;
  // Sous-chaînes (minuscule) pour reconnaître le port MIDI par son nom.
  matchPatterns: string[];
  grid: { cols: number; rows: number };
  ledModel: LedModel;
  // Pour les modèles RGB : le clignotement/pulsation se fait via le CANAL MIDI
  // (status byte), pas la vélocité. solidStatus = pad fixe pleine luminosité ;
  // activeStatus = pad pulsé/clignotant (scène active). La vélocité porte la
  // couleur (palette). Absent pour velocity3 (status toujours 0x90, le
  // clignotement est encodé dans la vélocité).
  rgb?: { solidStatus: number; activeStatus: number };
}

export const CONTROLLER_PROFILES: Record<string, ControllerProfile> = {
  apc_mini: {
    id: "apc_mini", label: "Akai APC mini",
    matchPatterns: ["apc mini", "apc_mini", "apcmini"],
    grid: { cols: 8, rows: 8 }, ledModel: "velocity3",
  },
  apc_mini_mk2: {
    id: "apc_mini_mk2", label: "Akai APC mini mk2",
    matchPatterns: ["apc mini mk2", "apc mini mkii", "mk2"],
    grid: { cols: 8, rows: 8 }, ledModel: "rgb",
    // Protocole Akai : canal 6 = fixe 100% (0x96=150), canal 10 = pulse 1/2 (0x9A=154).
    rgb: { solidStatus: 0x96, activeStatus: 0x9a },
  },
  apc40_mk2: {
    id: "apc40_mk2", label: "Akai APC40 mk2",
    matchPatterns: ["apc40", "apc 40"],
    grid: { cols: 8, rows: 5 }, ledModel: "rgb",
    // Best-effort : canal 0 fixe (0x90), canal 6 clignotant (0x96).
    rgb: { solidStatus: 0x90, activeStatus: 0x96 },
  },
  launchpad_mk3: {
    id: "launchpad_mk3", label: "Novation Launchpad (mini/X mk3)",
    matchPatterns: ["launchpad"],
    grid: { cols: 8, rows: 8 }, ledModel: "rgb",
    // Protocole Novation : canal 0 = statique (0x90), canal 2 = pulse (0x92).
    rgb: { solidStatus: 0x90, activeStatus: 0x92 },
  },
  generic: {
    id: "generic", label: "Générique (Note On)",
    matchPatterns: [],
    grid: { cols: 8, rows: 8 }, ledModel: "velocity3",
  },
};

export const CONTROLLER_PROFILE_LIST: ControllerProfile[] = Object.values(CONTROLLER_PROFILES);

export function getControllerProfile(id: string | undefined | null): ControllerProfile {
  return (id && CONTROLLER_PROFILES[id]) || CONTROLLER_PROFILES.generic;
}

// Reconnaît un profil depuis le nom d'un port MIDI (ex: "APC mini MIDI 1").
export function matchControllerByPortName(portName: string): ControllerProfile | null {
  const hay = (portName || "").toLowerCase();
  // mk2 avant apc_mini pour éviter qu'"apc mini" capture le mk2.
  for (const id of ["apc_mini_mk2", "apc40_mk2", "launchpad_mk3", "apc_mini"]) {
    const p = CONTROLLER_PROFILES[id];
    if (p.matchPatterns.some((m) => m && hay.includes(m))) return p;
  }
  return null;
}

// ─── Classification de couleur ───────────────────────────────────────────
// Accepte une classe Tailwind ("bg-cyan-500", "text-rose-400") OU un hex.
// PARTIE TESTÉE.
const TAILWIND_FAMILY: Record<string, ColorFamily> = {
  red: "red", rose: "pink", pink: "pink", fuchsia: "purple", purple: "purple",
  violet: "purple", indigo: "indigo", blue: "blue", sky: "cyan", cyan: "cyan",
  teal: "teal", emerald: "green", green: "green", lime: "lime", yellow: "yellow",
  amber: "amber", orange: "orange", white: "white", slate: "off", gray: "off",
  zinc: "off", neutral: "off", stone: "off", black: "off",
};

export function classifyColor(input: string): ColorFamily {
  if (!input) return "off";
  const raw = input.trim().toLowerCase();

  // Hex (#rgb / #rrggbb) → classification par teinte.
  const hex = raw.startsWith("#") ? raw.slice(1) : /^[0-9a-f]{6}$/.test(raw) ? raw : "";
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return classifyRgb(r, g, b);
    }
  }

  // Classe Tailwind : on cherche un nom de famille connu dans la chaîne.
  for (const [name, fam] of Object.entries(TAILWIND_FAMILY)) {
    if (raw.includes(name)) return fam;
  }
  return "off";
}

export function classifyRgb(r: number, g: number, b: number): ColorFamily {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 24) return "off";
  if (max - min < 24) return "white"; // gris/blanc désaturé

  const rn = r / 255, gn = g / 255, bn = b / 255;
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn);
  const d = mx - mn;
  let h = 0;
  if (mx === rn) h = ((gn - bn) / d) % 6;
  else if (mx === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 55) return "amber";
  if (h < 70) return "yellow";
  if (h < 90) return "lime";
  if (h < 160) return "green";
  if (h < 185) return "teal";
  if (h < 200) return "cyan";
  if (h < 250) return "blue";
  if (h < 270) return "indigo";
  if (h < 320) return "purple";
  return "pink";
}

// ─── Réduction famille → vélocité ────────────────────────────────────────
// APC mini d'origine : 0 off, 1 vert, 2 vert clignotant, 3 rouge, 4 rouge
// clignotant, 5 jaune, 6 jaune clignotant.
const V3_STATIC: Record<"green" | "red" | "yellow", number> = { green: 1, red: 3, yellow: 5 };
const V3_BLINK: Record<"green" | "red" | "yellow", number> = { green: 2, red: 4, yellow: 6 };

function familyToV3(fam: ColorFamily): "off" | "green" | "red" | "yellow" {
  switch (fam) {
    case "off": return "off";
    case "red": case "orange": case "pink": case "purple": case "indigo": return "red";
    case "amber": case "yellow": case "lime": case "white": return "yellow";
    default: return "green"; // green/teal/cyan/blue
  }
}

// Palette RGB approximative (vélocités type Launchpad mk3 / APC mini mk2,
// mode programmer). Best-effort : couleurs distinctes et visibles.
const RGB_VELOCITY: Record<ColorFamily, number> = {
  off: 0, red: 5, orange: 9, amber: 96, yellow: 13, lime: 17,
  green: 21, teal: 33, cyan: 37, blue: 45, indigo: 49, purple: 53,
  pink: 57, white: 3,
};

// ─── API principale : couleur → vélocité MIDI ────────────────────────────
// PARTIE TESTÉE. `active` ⇒ variante clignotante (velocity3) si dispo.
export function colorToVelocity(
  profileId: string | undefined | null,
  color: string,
  active = false,
): number {
  const profile = getControllerProfile(profileId);
  if (profile.ledModel === "none") return 0;

  const fam = classifyColor(color);

  if (profile.ledModel === "velocity3") {
    const v3 = familyToV3(fam);
    if (v3 === "off") return 0;
    return active ? V3_BLINK[v3] : V3_STATIC[v3];
  }

  // rgb : vélocité de palette (le clignotement est géré par le canal MIDI,
  // cf. ledNoteMessage / le champ rgb du profil).
  return RGB_VELOCITY[fam] ?? RGB_VELOCITY.green;
}

// ─── Message MIDI complet d'allumage d'un pad ────────────────────────────
// PARTIE TESTÉE. Retourne [status, note, velocity] prêt pour output.send().
// - velocity3 (APC mini d'origine) : status 0x90, le clignotement (pad actif)
//   est encodé dans la vélocité.
// - rgb (APC mini mk2 / Launchpad…) : la couleur est la vélocité (palette) et
//   le comportement fixe/pulsé est porté par le CANAL (status byte du profil).
export function ledNoteMessage(
  profileId: string | undefined | null,
  note: number,
  color: string,
  active = false,
): [number, number, number] {
  const profile = getControllerProfile(profileId);

  if (profile.ledModel === "rgb" && profile.rgb) {
    const velocity = colorToVelocity(profileId, color, false);
    const status = velocity === 0
      ? 0x90 // éteint : note off "solide" canal 0
      : active ? profile.rgb.activeStatus : profile.rgb.solidStatus;
    return [status, note, velocity];
  }

  // velocity3 / generic / none : canal 0, clignotement encodé dans la vélocité.
  return [0x90, note, colorToVelocity(profileId, color, active)];
}
