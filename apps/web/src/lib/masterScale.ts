/**
 * masterScale.ts — Moteur de master dimmer "intelligent" (A9).
 *
 * Le master dimmer global ne doit atténuer QUE les canaux d'intensité.
 * La position (pan/tilt) et les canaux discrets (gobo / color wheel / prism /
 * mode / macro / effect / zoom / focus / iris / shutter / speed / custom...)
 * NE doivent JAMAIS être atténués — sinon baisser le master ferait dériver les
 * têtes mobiles et changerait les gobos.
 *
 * Module pur : aucune dépendance DMX / UI / store.
 *
 * INVARIANT (rétro-compatibilité stricte) :
 *   applyMaster(v, anyType, 255) === Math.round(clamp(v, 0, 255))  pour TOUT type.
 *   => à master plein (défaut), comportement identique au scaleValue actuel,
 *      sur dimmables ET non-dimmables : 0 régression.
 */

/** Types de canaux atténués par le master dimmer (intensité / couleur additive / strobe). */
export const DIMMABLE_CHANNEL_TYPES: ReadonlyArray<string> = [
  "dimmer",
  "intensity",
  "red",
  "green",
  "blue",
  "white",
  "amber",
  "uv",
  "strobe",
];

const DIMMABLE_SET: ReadonlySet<string> = new Set(DIMMABLE_CHANNEL_TYPES);

/**
 * true si le type de canal est dimmable (intensité) — donc atténuable par le master.
 * Casse-insensible. `undefined` / type inconnu => false (jamais atténué : sûr).
 */
export function isDimmableChannelType(type: string | undefined): boolean {
  if (type === undefined || type === null) return false;
  return DIMMABLE_SET.has(String(type).toLowerCase());
}

/**
 * Applique le master dimmer UNIQUEMENT aux canaux dimmables.
 *
 * @param value        Valeur DMX brute (sera clampée 0..255).
 * @param type         Type du canal (cf. DmxChannelType). Casse-insensible.
 * @param masterDimmer Niveau du master 0..255.
 * @returns            Entier 0..255.
 *
 * - dimmable     => round(clamp(value, 0, 255) * masterDimmer / 255)
 * - non-dimmable => round(clamp(value, 0, 255))  (inchangé, master ignoré)
 */
export function applyMaster(
  value: number,
  type: string | undefined,
  masterDimmer: number,
): number {
  const clamped = Math.max(0, Math.min(255, value));
  if (!isDimmableChannelType(type)) {
    return Math.round(clamped);
  }
  const master = Math.max(0, Math.min(255, masterDimmer));
  return Math.round(clamped * (master / 255));
}
