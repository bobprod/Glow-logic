// ============================================================
// patchTable — moteur de RE-PATCH logique -> physique (CONTRAT A7)
// ------------------------------------------------------------
// Module PUR (aucune dépendance DMX/IO). Mappe un canal LOGIQUE
// (fader/univers 1) vers un ou plusieurs canaux PHYSIQUES au point
// de sortie. ADDITIF & RÉTRO-COMPATIBLE :
//   - table VIDE / canal non patché => 1:1 (resolvePatch -> [channel])
//
// Syntaxe (style Show Buddy), une règle par ligne (séparateur '\n' ou ';') :
//   "F:C"          le fader/canal logique F pilote le canal physique C
//   "S/E:C"        la plage S..E pilote, EN SÉRIE, à partir de C
//                  (F=S->C, S+1->C+1, ...)
//   "F:C1,C2,.."   le fader F pilote PLUSIEURS canaux physiques (copie)
//   (plusieurs règles pour un même F s'additionnent : union triée, sans doublon)
//
// Parsing DÉFENSIF : lignes vides/invalides ignorées, clamp 1..512.
// ============================================================

export type PatchMap = Map<number, number[]>; // logique(1..512) -> liste de canaux physiques

const MIN_CHANNEL = 1;
const MAX_CHANNEL = 512;

/** Clamp + round vers un index de canal DMX valide (1..512), ou null si non numérique. */
function toChannel(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Accepte uniquement des entiers (signe optionnel). Rejette "5a", "1.5", etc.
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const n = Math.round(Number(trimmed));
  if (!Number.isFinite(n)) return null;
  return Math.max(MIN_CHANNEL, Math.min(MAX_CHANNEL, n));
}

/** Ajoute un canal physique à la liste d'un canal logique (union triée, sans doublon). */
function addTarget(map: PatchMap, logical: number, physical: number): void {
  const existing = map.get(logical);
  if (!existing) {
    map.set(logical, [physical]);
    return;
  }
  if (!existing.includes(physical)) {
    existing.push(physical);
    existing.sort((a, b) => a - b);
  }
}

/**
 * Parse une spécification de patch en PatchMap.
 * Parsing défensif : ignore toute ligne invalide, clamp 1..512.
 */
export function parsePatch(spec: string): PatchMap {
  const map: PatchMap = new Map();
  if (typeof spec !== "string" || spec.trim() === "") return map;

  // Séparateurs de règles : sauts de ligne OU point-virgule.
  const lines = spec.split(/[\n;]+/);

  for (const line of lines) {
    const rule = line.trim();
    if (rule === "" || rule.startsWith("#") || rule.startsWith("//")) continue;

    const colon = rule.indexOf(":");
    if (colon < 0) continue; // pas de séparateur logique:physique
    const left = rule.slice(0, colon).trim();
    const right = rule.slice(colon + 1).trim();
    if (left === "" || right === "") continue;

    // Canaux physiques de droite : "C" ou "C1,C2,..."
    const physicals: number[] = [];
    for (const part of right.split(",")) {
      const c = toChannel(part);
      if (c !== null) physicals.push(c);
    }
    if (physicals.length === 0) continue; // aucune cible valide

    if (left.includes("/")) {
      // Plage "S/E:C" -> série à partir de C : F=S->C, S+1->C+1, ...
      const slash = left.indexOf("/");
      const start = toChannel(left.slice(0, slash));
      const end = toChannel(left.slice(slash + 1));
      if (start === null || end === null) continue;
      // La série n'a de sens qu'avec UNE cible de base (premier canal physique).
      const base = physicals[0];
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let f = lo; f <= hi; f++) {
        const target = base + (f - lo);
        if (target > MAX_CHANNEL) break; // débordement -> on s'arrête proprement
        addTarget(map, f, target);
      }
    } else {
      // Simple "F:C" ou multi "F:C1,C2,..."
      const logical = toChannel(left);
      if (logical === null) continue;
      for (const c of physicals) addTarget(map, logical, c);
    }
  }

  return map;
}

/**
 * Sérialise une PatchMap en spec lisible (round-trip).
 * Une règle "F:C1,C2,.." par canal logique, triée par canal logique.
 */
export function serializePatch(map: PatchMap): string {
  const logicals = Array.from(map.keys()).sort((a, b) => a - b);
  const lines: string[] = [];
  for (const logical of logicals) {
    const targets = map.get(logical);
    if (!targets || targets.length === 0) continue;
    const sorted = [...targets].sort((a, b) => a - b);
    lines.push(`${logical}:${sorted.join(",")}`);
  }
  return lines.join("\n");
}

/**
 * Résout un canal logique en sa liste de canaux physiques.
 * Si patché -> liste physique ; sinon -> [channel] (1:1, comportement actuel).
 */
export function resolvePatch(map: PatchMap, channel: number): number[] {
  const mapped = map.get(channel);
  if (mapped && mapped.length > 0) return mapped.slice();
  return [channel];
}
