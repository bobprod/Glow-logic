// ─────────────────────────────────────────────────────────────────────────
// fixtureCategories.ts — Socle « équipements typés » de DESIGN.
//
// L'app ne connaissait jusqu'ici que des CANAUX (dimmer, pan, tilt…), pas des
// FAMILLES de matériel. Ce module est la source de vérité unique de la
// taxonomie : lyres, beams, washes LED, barres, strobes, lasers, fumigènes,
// pyro, vidéo… Chaque famille porte son groupe, sa classe de sécurité, une
// icône (nom lucide, résolu côté UI) et des indices d'inférence.
//
// Tout est PUR et testable sous node (aucune API navigateur). C'est ce socle
// que consommeront l'IA Lumière (raisonner par type), le plan (icône/3D), la
// sécurité (armement des effets/dangers) et le mapping contrôleur.
// ─────────────────────────────────────────────────────────────────────────

// Grand groupe d'affichage dans la bibliothèque DESIGN.
export type FixtureGroup = "movement" | "static" | "effect" | "video";

// Classe de sécurité :
//  - normal  : aucune contrainte
//  - effect  : effet à armer (fumigène, hazer, CO₂…) — pas physiquement dangereux
//              mais ne doit pas se déclencher par accident
//  - hazard  : dangereux pour les personnes (laser, pyro, flamme) — armement strict
export type SafetyClass = "normal" | "effect" | "hazard";

export type FixtureCategoryId =
  // Mouvement
  | "lyre_spot"
  | "lyre_wash"
  | "lyre_beam"
  | "scanner"
  // Lumière statique
  | "par_led"
  | "led_bar"
  | "strobe"
  | "blinder"
  | "uv"
  | "conventional"
  | "gobo_projector"
  // Effets (armement)
  | "laser"
  | "smoke"
  | "hazer"
  | "co2"
  | "fan"
  | "pyro"
  // Vidéo
  | "video"
  // Repli
  | "generic";

export interface FixtureCategory {
  id: FixtureCategoryId;
  label: string;            // libellé FR affiché
  group: FixtureGroup;
  safety: SafetyClass;
  icon: string;             // nom d'icône lucide (résolu côté UI)
  // Mots-clés cherchés dans le nom/fabricant (minuscule) pour l'inférence.
  keywords: string[];
  // Indique si la famille est typiquement une tête mobile (signature pan+tilt).
  moving?: boolean;
}

// ─── Registre canonique des familles ─────────────────────────────────────
// L'ordre = ordre d'affichage suggéré dans la bibliothèque.
export const FIXTURE_CATEGORIES: Record<FixtureCategoryId, FixtureCategory> = {
  lyre_spot: {
    id: "lyre_spot", label: "Lyre Spot", group: "movement", safety: "normal",
    icon: "Lightbulb", moving: true,
    keywords: ["spot", "moving head", "movinghead", "lyre", "tete mobile", "tête mobile"],
  },
  lyre_wash: {
    id: "lyre_wash", label: "Lyre Wash", group: "movement", safety: "normal",
    icon: "Sun", moving: true,
    keywords: ["wash", "moving wash", "zoom wash"],
  },
  lyre_beam: {
    id: "lyre_beam", label: "Lyre Beam", group: "movement", safety: "normal",
    icon: "FlashlightIcon", moving: true,
    keywords: ["beam", "sharpy", "pointe"],
  },
  scanner: {
    id: "scanner", label: "Scanner", group: "movement", safety: "normal",
    icon: "ScanLine", moving: true,
    keywords: ["scanner", "scan", "miroir", "mirror"],
  },
  par_led: {
    id: "par_led", label: "PAR / Wash LED", group: "static", safety: "normal",
    icon: "Lightbulb",
    keywords: ["par", "wash", "led par", "rgbw", "rgbwa", "rgb", "flood", "pixel par"],
  },
  led_bar: {
    id: "led_bar", label: "Barre LED / Pixels", group: "static", safety: "normal",
    icon: "AlignJustify",
    keywords: ["bar", "barre", "pixel", "tube", "batten", "strip", "ruban"],
  },
  strobe: {
    id: "strobe", label: "Strobe", group: "static", safety: "normal",
    icon: "Zap",
    keywords: ["strobe", "strob", "stroboscope", "flash"],
  },
  blinder: {
    id: "blinder", label: "Blinder", group: "static", safety: "normal",
    icon: "SunMedium",
    keywords: ["blinder", "blind", "aveuglant", "audience"],
  },
  uv: {
    id: "uv", label: "UV / Lumière noire", group: "static", safety: "normal",
    icon: "Moon",
    keywords: ["uv", "ultraviolet", "black light", "blacklight", "lumiere noire", "lumière noire"],
  },
  conventional: {
    id: "conventional", label: "Projecteur trad.", group: "static", safety: "normal",
    icon: "Lamp",
    keywords: ["par 64", "par64", "pc", "fresnel", "decoupe", "découpe", "profile", "conventional", "halogen", "halogène", "lanterne"],
  },
  gobo_projector: {
    id: "gobo_projector", label: "Projecteur à gobo", group: "static", safety: "normal",
    icon: "CircleDot",
    keywords: ["gobo projector", "projecteur gobo", "image projector", "logo"],
  },
  laser: {
    id: "laser", label: "Laser", group: "effect", safety: "hazard",
    icon: "Crosshair",
    keywords: ["laser"],
  },
  smoke: {
    id: "smoke", label: "Fumigène", group: "effect", safety: "effect",
    icon: "Cloud",
    keywords: ["smoke", "fog", "fumigene", "fumigène", "fumée", "fumee", "machine a fumee", "machine à fumée"],
  },
  hazer: {
    id: "hazer", label: "Hazer / Brouillard", group: "effect", safety: "effect",
    icon: "CloudFog",
    keywords: ["hazer", "haze", "brouillard", "brume"],
  },
  co2: {
    id: "co2", label: "CO₂ / Confettis / Bulles", group: "effect", safety: "effect",
    icon: "Sparkles",
    keywords: ["co2", "cryo", "jet", "confetti", "confettis", "bubble", "bulle", "foam", "mousse", "snow", "neige"],
  },
  fan: {
    id: "fan", label: "Ventilateur", group: "effect", safety: "normal",
    icon: "Fan",
    keywords: ["fan", "ventilateur", "wind", "vent", "blower"],
  },
  pyro: {
    id: "pyro", label: "Pyro / Flamme", group: "effect", safety: "hazard",
    icon: "Flame",
    keywords: ["pyro", "flame", "flamme", "firework", "feu", "sparkular", "cold spark", "etincelle", "étincelle"],
  },
  video: {
    id: "video", label: "Vidéo / Mapping", group: "video", safety: "normal",
    icon: "MonitorPlay",
    keywords: ["video", "vidéo", "projection", "mapping", "screen", "ecran", "écran", "media"],
  },
  generic: {
    id: "generic", label: "Générique", group: "static", safety: "normal",
    icon: "Box",
    keywords: [],
  },
};

// Liste ordonnée (pratique pour le rendu d'une bibliothèque/sélecteur).
export const FIXTURE_CATEGORY_LIST: FixtureCategory[] = Object.values(FIXTURE_CATEGORIES);

// Ordre de priorité d'inférence par NOM : on teste d'abord les familles les
// plus spécifiques / dangereuses pour éviter qu'un mot générique (ex: "wash"
// dans "Laser Wash") ne l'emporte sur "laser".
const NAME_INFERENCE_ORDER: FixtureCategoryId[] = [
  "laser", "pyro", "co2", "hazer", "smoke", "fan",
  "uv", "scanner", "lyre_beam", "lyre_wash", "lyre_spot",
  "strobe", "blinder", "gobo_projector", "led_bar",
  "conventional", "par_led", "video",
];

// ─── Accès ────────────────────────────────────────────────────────────────
export function getCategory(id: FixtureCategoryId): FixtureCategory {
  return FIXTURE_CATEGORIES[id] ?? FIXTURE_CATEGORIES.generic;
}

export function getSafetyClass(id: FixtureCategoryId): SafetyClass {
  return getCategory(id).safety;
}

// L'équipement doit-il être armé avant de pouvoir sortir (effet ou danger) ?
export function isArmingRequired(id: FixtureCategoryId): boolean {
  return getSafetyClass(id) !== "normal";
}

export function isHazard(id: FixtureCategoryId): boolean {
  return getSafetyClass(id) === "hazard";
}

// ─── Inférence de catégorie ──────────────────────────────────────────────
// PARTIE TESTÉE. Combine deux signaux :
//   1. mots-clés dans le nom (le plus fiable, ordre de priorité ci-dessus) ;
//   2. signature des canaux (pan+tilt ⇒ tête mobile, RGB ⇒ wash LED, dimmer seul
//      ⇒ projecteur trad.) en repli quand le nom ne tranche pas.
// Retourne toujours une catégorie (au pire "generic").
export function inferFixtureCategory(
  name: string,
  channelTypes: string[] = [],
): FixtureCategoryId {
  const haystack = (name || "").toLowerCase();

  // 1) Inférence par nom, dans l'ordre de priorité.
  for (const id of NAME_INFERENCE_ORDER) {
    const cat = FIXTURE_CATEGORIES[id];
    if (cat.keywords.some((kw) => kw && haystack.includes(kw))) {
      return id;
    }
  }

  // 2) Inférence par signature de canaux.
  const types = new Set(channelTypes.map((t) => (t || "").toLowerCase()));
  const hasMovement = types.has("pan") || types.has("tilt");
  const hasColor =
    types.has("red") || types.has("green") || types.has("blue") ||
    types.has("white") || types.has("amber") || types.has("color_wheel") || types.has("color");
  const hasGobo = types.has("gobo");
  const hasUv = types.has("uv");
  const hasStrobeOnly = types.has("strobe") && types.size <= 2;

  if (hasUv && !hasMovement) return "uv";
  if (hasMovement) {
    // Tête mobile : gobo ⇒ spot, sinon couleur ⇒ wash, sinon beam.
    if (hasGobo) return "lyre_spot";
    if (hasColor) return "lyre_wash";
    return "lyre_beam";
  }
  if (hasStrobeOnly) return "strobe";
  if (hasColor) return "par_led";
  if (types.has("dimmer") && types.size <= 2) return "conventional";

  return "generic";
}
