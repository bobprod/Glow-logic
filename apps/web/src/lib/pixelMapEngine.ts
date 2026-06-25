/**
 * pixelMapEngine — champ de couleur pur et déterministe pour le pixel-mapping analytique.
 *
 * La couleur d'un pixel est dérivée uniquement de la configuration, de l'instant `timeMs`
 * et de la position normalisée (x,y) dans [0,1]. Aucun état interne, aucun effet de bord,
 * aucun Date.now()/Math.random : `pixelColorAt` est une fonction pure et déterministe.
 */

export type PixelEffectType = 'solid' | 'sweep' | 'pulse' | 'rainbow';

export interface PixelMapConfig {
  type: PixelEffectType;
  /** Couleur principale, hex '#rrggbb'. */
  colorA: string;
  /** Couleur secondaire, hex '#rrggbb'. */
  colorB: string;
  /** Vitesse de défilement (0..4 typiquement). */
  speed: number;
  /** (v2, optionnel) Texte à superposer, centré, sur le rendu canvas. */
  text?: string;
  /** (v2, optionnel) URL de l'image à superposer (cover) sur le rendu canvas. */
  imageUrl?: string;
  /** (v3, optionnel) URL de la vidéo à superposer (cover) sur le rendu canvas, calque projecteur. */
  videoUrl?: string;
}

export const DEFAULT_PIXELMAP_CONFIG: PixelMapConfig = {
  type: 'solid',
  colorA: '#22d3ee',
  colorB: '#f43f5e',
  speed: 1,
};

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Borne une valeur dans [min,max]. NaN -> min. */
function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Interpolation linéaire entre a et b par t (non borné sur t). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Partie fractionnaire dans [0,1) (gère les valeurs négatives). */
function fract(v: number): number {
  return v - Math.floor(v);
}

/**
 * Convertit un hex '#rrggbb' (ou 'rrggbb', '#rgb') en {r,g,b} 0..255 entiers.
 * Robuste : casse indifférente, espaces tolérés, toute entrée invalide => noir (0,0,0).
 */
export function hexToRgb(hex: string): Rgb {
  const black: Rgb = { r: 0, g: 0, b: 0 };
  if (typeof hex !== 'string') return black;
  let h = hex.trim().toLowerCase();
  if (h.startsWith('#')) h = h.slice(1);

  // Format court #rgb -> #rrggbb
  if (h.length === 3 && /^[0-9a-f]{3}$/.test(h)) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  if (h.length !== 6 || !/^[0-9a-f]{6}$/.test(h)) return black;

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return black;
  return { r, g, b };
}

/**
 * Conversion HSV -> RGB. h,s,v dans [0,1]. Retourne r,g,b 0..255 entiers.
 */
function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hh = fract(h) * 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r: number;
  let g: number;
  let b: number;
  switch (i % 6) {
    case 0:
      r = v; g = t; b = p; break;
    case 1:
      r = q; g = v; b = p; break;
    case 2:
      r = p; g = v; b = t; break;
    case 3:
      r = p; g = q; b = v; break;
    case 4:
      r = t; g = p; b = v; break;
    default:
      r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(clamp(r * 255, 0, 255)),
    g: Math.round(clamp(g * 255, 0, 255)),
    b: Math.round(clamp(b * 255, 0, 255)),
  };
}

/** Mélange deux couleurs RGB par t (0..1), résultat entier borné 0..255. */
function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const tt = clamp(t, 0, 1);
  return {
    r: Math.round(clamp(lerp(a.r, b.r, tt), 0, 255)),
    g: Math.round(clamp(lerp(a.g, b.g, tt), 0, 255)),
    b: Math.round(clamp(lerp(a.b, b.b, tt), 0, 255)),
  };
}

/**
 * Couleur 0..255 (entiers) à la position normalisée (x,y in [0,1]) à l'instant timeMs.
 * Déterministe et borné. Effets :
 *  - solid   : colorA.
 *  - sweep   : gradient horizontal A->B qui défile : phase = fract(x + (t/1000)*speed).
 *  - pulse   : anneaux radiaux depuis (0.5,0.5) : d = dist/0.7071 ;
 *              phase = fract(d - (t/1000)*speed) ; mix triangle ; lerp(A,B,mix).
 *  - rainbow : hue = fract(x + (t/1000)*speed*0.2) ; HSV(hue,1,1)->RGB.
 */
export function pixelColorAt(
  cfg: PixelMapConfig,
  timeMs: number,
  x: number,
  y: number,
): Rgb {
  const a = hexToRgb(cfg.colorA);
  const b = hexToRgb(cfg.colorB);
  const speed = Number.isFinite(cfg.speed) ? cfg.speed : 0;
  const t = Number.isFinite(timeMs) ? timeMs : 0;
  const nx = clamp(x, 0, 1);
  const ny = clamp(y, 0, 1);
  const seconds = t / 1000;

  switch (cfg.type) {
    case 'solid':
      return { r: a.r, g: a.g, b: a.b };

    case 'sweep': {
      const phase = fract(nx + seconds * speed);
      return mixRgb(a, b, phase);
    }

    case 'pulse': {
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const d = dist / 0.7071; // normalisation : distance max du centre au coin
      const phase = fract(d - seconds * speed);
      // Triangle : 0->0, 0.5->1, 1->0
      const mix = 1 - Math.abs(phase * 2 - 1);
      return mixRgb(a, b, mix);
    }

    case 'rainbow': {
      const hue = fract(nx + seconds * speed * 0.2);
      return hsvToRgb(hue, 1, 1);
    }

    default:
      return { r: a.r, g: a.g, b: a.b };
  }
}

/**
 * Dessine une source (image ou vidéo) en mode "cover" : remplit toute la surface
 * en conservant le ratio, recadrage centré. No-op silencieux si la source est
 * absente, pas encore prête (dimensions nulles/invalides) ou si `drawImage` lève.
 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource | null | undefined,
  width: number,
  height: number,
): void {
  if (!src) return;
  const anySrc = src as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
  const iw = Number(anySrc.width ?? anySrc.videoWidth ?? 0);
  const ih = Number(anySrc.height ?? anySrc.videoHeight ?? 0);
  if (!(Number.isFinite(iw) && Number.isFinite(ih) && iw > 0 && ih > 0)) return;
  const scale = Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  try {
    ctx.drawImage(src, dx, dy, dw, dh);
  } catch {
    // Source non encore prête / invalide : on ignore sans interrompre le rendu.
  }
}

/**
 * v2/v3 (ADDITIF) — Rendu CANVAS du même champ de couleur que la chaîne DMX v1,
 * plus calques optionnels image (cover), vidéo (cover) puis texte centré.
 *
 * Le fond échantillonne `pixelColorAt` sur une grille ~48x48 dont chaque cellule
 * est peinte via `fillRect` à l'échelle de la surface. L'image éventuelle est
 * dessinée en mode "cover" (remplit toute la surface en conservant le ratio,
 * recadrage centré). La vidéo éventuelle (v3) est dessinée par-dessus l'image,
 * en mode "cover" également. Le texte éventuel est dessiné centré, lisible et
 * contrasté.
 *
 * Ordre de dessin : fond (champ) -> image (si) -> vidéo (si) -> texte (si).
 *
 * Garde défensive : si `ctx` est absent/invalide ou si width/height <= 0, ne fait
 * rien (return) et ne lève jamais. La logique de fond reste pure (s'appuie sur
 * `pixelColorAt`, sans Date.now/Math.random) ; le chargement de l'image et de la
 * vidéo en CanvasImageSource est de la responsabilité de l'appelant (composant
 * projecteur).
 */
export function renderPixelMapToCanvas(
  ctx: CanvasRenderingContext2D,
  cfg: PixelMapConfig,
  timeMs: number,
  width: number,
  height: number,
  image?: CanvasImageSource | null,
  video?: CanvasImageSource | null,
): void {
  // Garde défensive : contexte ou dimensions invalides => no-op.
  if (!ctx || typeof ctx.fillRect !== 'function') return;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  if (width <= 0 || height <= 0) return;

  // 1) Fond = champ de couleur échantillonné sur une grille ~48x48.
  const grid = 48;
  const cellW = width / grid;
  const cellH = height / grid;
  // +1 px pour éviter les coutures (seams) entre cellules dues à l'arrondi.
  const drawW = cellW + 1;
  const drawH = cellH + 1;
  for (let gy = 0; gy < grid; gy++) {
    // Centre de la cellule en coordonnées normalisées [0,1].
    const ny = (gy + 0.5) / grid;
    for (let gx = 0; gx < grid; gx++) {
      const nx = (gx + 0.5) / grid;
      const c = pixelColorAt(cfg, timeMs, nx, ny);
      ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
      ctx.fillRect(gx * cellW, gy * cellH, drawW, drawH);
    }
  }

  // 2) Image optionnelle en mode "cover" (recadrage centré, ratio conservé).
  drawCover(ctx, image, width, height);

  // 3) Vidéo optionnelle (v3) en mode "cover", par-dessus l'image, sous le texte.
  drawCover(ctx, video, width, height);

  // 4) Texte optionnel centré, lisible et contrasté.
  if (typeof cfg.text === 'string' && cfg.text.length > 0) {
    const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.12));
    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = width / 2;
    const cy = height / 2;
    // Contour sombre pour garantir le contraste sur fond clair comme sombre.
    ctx.lineWidth = Math.max(2, fontSize * 0.08);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = '#ffffff';
    try {
      ctx.strokeText(cfg.text, cx, cy);
      ctx.fillText(cfg.text, cx, cy);
    } catch {
      // Méthodes texte indisponibles (ctx minimal) : on ignore.
    }
    ctx.restore();
  }
}

/**
 * Variante batch : calcule la couleur pour un ensemble de positions normalisées
 * au même instant. Déterministe, équivalent à un appel par position.
 */
export function computePixelColors(
  cfg: PixelMapConfig,
  timeMs: number,
  positions: Array<{ x: number; y: number }>,
): Rgb[] {
  return positions.map((p) => pixelColorAt(cfg, timeMs, p.x, p.y));
}
