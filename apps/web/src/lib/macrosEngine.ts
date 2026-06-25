/**
 * macrosEngine — moteur pur pour les macros busking (couleurs, fan, centrage).
 *
 * Aucune dépendance DMX/UI : ce module ne fait que des calculs déterministes.
 * Il est consommé par le panneau MacrosPanel qui, lui, écrit au DMX via
 * dmxEngine.setChannel.
 */

export interface RGBW {
  r: number;
  g: number;
  b: number;
  /** Canal white optionnel (fixtures RGBW). */
  w?: number;
}

/**
 * Palette de couleurs nommées (valeurs 0..255).
 * `off` = noir total (0,0,0). `white` inclut un canal white plein.
 */
export const NAMED_COLORS: Record<string, RGBW> = {
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  white: { r: 255, g: 255, b: 255, w: 255 },
  amber: { r: 255, g: 140, b: 0 },
  cyan: { r: 0, g: 255, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  orange: { r: 255, g: 80, b: 0 },
  pink: { r: 255, g: 80, b: 120 },
  off: { r: 0, g: 0, b: 0 },
};

/**
 * Résout une couleur par son nom (insensible à la casse et aux espaces).
 * Renvoie undefined si le nom est inconnu.
 */
export function colorByName(name: string): RGBW | undefined {
  if (typeof name !== "string") return undefined;
  const key = name.trim().toLowerCase();
  return NAMED_COLORS[key];
}

/**
 * Répartit `count` valeurs linéairement et inclusivement entre min et max
 * (utile pour un effet fan sur une rangée de projecteurs).
 *
 * - count <= 1  => [min]
 * - count >= 2  => [min, ..., max] réparti uniformément, arrondi entier,
 *                  monotone croissant (si min <= max).
 */
export function linearSpread(count: number, min: number, max: number): number[] {
  const n = Math.floor(count);
  if (n <= 1) return [Math.round(min)];
  const out: number[] = [];
  const step = (max - min) / (n - 1);
  for (let i = 0; i < n; i++) {
    out.push(Math.round(min + step * i));
  }
  return out;
}
