/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const {
  pixelColorAt,
  computePixelColors,
  hexToRgb,
  renderPixelMapToCanvas,
  DEFAULT_PIXELMAP_CONFIG,
} = require("../src/lib/pixelMapEngine");

const TYPES = ["solid", "sweep", "pulse", "rainbow"];

// (0) DEFAULT_PIXELMAP_CONFIG conforme au contrat.
assert.equal(DEFAULT_PIXELMAP_CONFIG.type, "solid");
assert.equal(DEFAULT_PIXELMAP_CONFIG.colorA, "#22d3ee");
assert.equal(DEFAULT_PIXELMAP_CONFIG.colorB, "#f43f5e");
assert.equal(DEFAULT_PIXELMAP_CONFIG.speed, 1);

// (a) solid => colorA exact, quels que soient temps/position.
{
  const cfg = { type: "solid", colorA: "#22d3ee", colorB: "#f43f5e", speed: 1 };
  const expected = hexToRgb("#22d3ee"); // { r:34, g:211, b:238 }
  assert.deepEqual(expected, { r: 34, g: 211, b: 238 });
  for (let t = 0; t < 5000; t += 311) {
    for (const x of [0, 0.25, 0.5, 0.73, 1]) {
      for (const y of [0, 0.4, 1]) {
        const c = pixelColorAt(cfg, t, x, y);
        assert.deepEqual(c, expected, `solid doit rendre colorA exact (t=${t}, x=${x}, y=${y})`);
      }
    }
  }
}

// (b) Déterminisme : mêmes entrées => même sortie sur les 4 types.
{
  for (const type of TYPES) {
    const cfg = { type, colorA: "#22d3ee", colorB: "#f43f5e", speed: 1.7 };
    const c1 = pixelColorAt(cfg, 1234, 0.42, 0.18);
    const c2 = pixelColorAt(cfg, 1234, 0.42, 0.18);
    assert.deepEqual(c1, c2, `déterminisme attendu pour ${type}`);
  }
}

// (c) Bornes 0..255 entiers sur les 4 types, positions et temps variés, configs extrêmes.
{
  for (const type of TYPES) {
    for (const speed of [0, 0.5, 1, 4, 100, -2]) {
      for (let t = 0; t < 6000; t += 271) {
        for (const x of [0, 0.13, 0.5, 0.87, 1, -0.3, 1.4]) {
          for (const y of [0, 0.5, 1, -0.2, 1.6]) {
            const c = pixelColorAt(
              { type, colorA: "#ffffff", colorB: "#000000", speed },
              t,
              x,
              y,
            );
            for (const ch of ["r", "g", "b"]) {
              assert.ok(
                Number.isInteger(c[ch]) && c[ch] >= 0 && c[ch] <= 255,
                `borne dépassée ${ch}=${c[ch]} (${type}, speed=${speed}, t=${t}, x=${x}, y=${y})`,
              );
            }
          }
        }
      }
    }
  }
}

// (d) sweep varie avec x (à un instant donné, deux x distincts => couleurs différentes).
{
  const cfg = { type: "sweep", colorA: "#000000", colorB: "#ffffff", speed: 1 };
  // gradient horizontal : x=0 -> proche A (noir), x=0.5 -> proche B (blanc) à t=0.
  const c0 = pixelColorAt(cfg, 0, 0, 0.5);
  const c1 = pixelColorAt(cfg, 0, 0.5, 0.5);
  assert.notDeepEqual(c0, c1, "sweep doit varier avec x");
  // y n'a aucun effet sur sweep.
  const cy0 = pixelColorAt(cfg, 0, 0.3, 0);
  const cy1 = pixelColorAt(cfg, 0, 0.3, 1);
  assert.deepEqual(cy0, cy1, "sweep ne dépend pas de y");
}

// (e) rainbow varie avec x.
{
  const cfg = { type: "rainbow", colorA: "#22d3ee", colorB: "#f43f5e", speed: 4 };
  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    const x = i / 10;
    const a = pixelColorAt(cfg, 0, 0, 0.5);
    const b = pixelColorAt(cfg, 0, x, 0.5);
    if (a.r !== b.r || a.g !== b.g || a.b !== b.b) found = true;
  }
  assert.ok(found, "rainbow doit varier avec x");
}

// (f) sweep/rainbow varient aussi dans le temps (champ animé).
{
  const sweep = { type: "sweep", colorA: "#000000", colorB: "#ffffff", speed: 1 };
  let movedSweep = false;
  for (let t = 0; t < 1000 && !movedSweep; t += 50) {
    const a = pixelColorAt(sweep, 0, 0.3, 0.5);
    const b = pixelColorAt(sweep, t, 0.3, 0.5);
    if (a.r !== b.r || a.g !== b.g || a.b !== b.b) movedSweep = true;
  }
  assert.ok(movedSweep, "sweep doit défiler dans le temps");
}

// (g) hexToRgb robuste.
{
  assert.deepEqual(hexToRgb("#22d3ee"), { r: 34, g: 211, b: 238 });
  assert.deepEqual(hexToRgb("#22D3EE"), { r: 34, g: 211, b: 238 }, "casse indifférente");
  assert.deepEqual(hexToRgb("  #22d3ee  "), { r: 34, g: 211, b: 238 }, "espaces tolérés");
  assert.deepEqual(hexToRgb("22d3ee"), { r: 34, g: 211, b: 238 }, "sans #");
  assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 }, "format court #rgb");
  assert.deepEqual(hexToRgb("#f00"), { r: 255, g: 0, b: 0 }, "format court #rgb rouge");
  // invalides => noir
  for (const bad of ["", "#", "#xyz", "#12", "#1234567", "nope", "#gggggg", null, undefined, 42]) {
    assert.deepEqual(hexToRgb(bad), { r: 0, g: 0, b: 0 }, `invalide => noir: ${String(bad)}`);
  }
}

// (h) computePixelColors == appels unitaires.
{
  const cfg = { type: "pulse", colorA: "#22d3ee", colorB: "#f43f5e", speed: 2 };
  const positions = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 1 },
    { x: 0.3, y: 0.7 },
  ];
  const batch = computePixelColors(cfg, 999, positions);
  assert.equal(batch.length, positions.length);
  positions.forEach((p, i) => {
    assert.deepEqual(batch[i], pixelColorAt(cfg, 999, p.x, p.y), `batch[${i}] doit égaler pixelColorAt`);
  });
}

// (i) renderPixelMapToCanvas — garde défensive : ne throw pas avec ctx null/undefined
//     ni avec des dimensions invalides (<=0, NaN, Infinity).
{
  const cfg = { type: "sweep", colorA: "#22d3ee", colorB: "#f43f5e", speed: 1, text: "HELLO", imageUrl: "blob:fake" };
  assert.doesNotThrow(() => renderPixelMapToCanvas(null, cfg, 0, 100, 100), "ctx null => no-op");
  assert.doesNotThrow(() => renderPixelMapToCanvas(undefined, cfg, 0, 100, 100), "ctx undefined => no-op");
  // ctx minimal sans fillRect => garde (typeof fillRect !== 'function').
  assert.doesNotThrow(() => renderPixelMapToCanvas({}, cfg, 0, 100, 100), "ctx sans fillRect => no-op");
  // dimensions invalides avec un ctx mock complet => no-op silencieux.
  const mockCtx = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 0,
    strokeStyle: "",
    fillRect() {},
    drawImage() {},
    strokeText() {},
    fillText() {},
    save() {},
    restore() {},
  };
  for (const [w, h] of [[0, 100], [100, 0], [-5, 100], [100, -5], [NaN, 100], [100, Infinity]]) {
    assert.doesNotThrow(() => renderPixelMapToCanvas(mockCtx, cfg, 0, w, h), `dim invalide (${w}x${h}) => no-op`);
  }
}

// (j) renderPixelMapToCanvas — avec un ctx mock valide, dessine le champ (fillRect appelé)
//     et n'altère pas la pureté de pixelColorAt.
{
  let fillRectCalls = 0;
  let fillTextCalls = 0;
  const mockCtx = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 0,
    strokeStyle: "",
    fillRect() { fillRectCalls++; },
    drawImage() {},
    strokeText() {},
    fillText() { fillTextCalls++; },
    save() {},
    restore() {},
  };
  const cfg = { type: "sweep", colorA: "#000000", colorB: "#ffffff", speed: 1, text: "X" };
  assert.doesNotThrow(() => renderPixelMapToCanvas(mockCtx, cfg, 123, 200, 150));
  assert.ok(fillRectCalls > 0, "le champ de fond doit appeler fillRect (grille)");
  assert.ok(fillTextCalls > 0, "le texte doit être dessiné si cfg.text fourni");
}

// (k) La config étendue (text/imageUrl) N'ALTÈRE PAS pixelColorAt :
//     mêmes sorties qu'une config v1 sans ces champs, pour solid & sweep.
{
  for (const type of ["solid", "sweep"]) {
    const base = { type, colorA: "#22d3ee", colorB: "#f43f5e", speed: 1.3 };
    const extended = { ...base, text: "OVERLAY", imageUrl: "blob:whatever" };
    for (let t = 0; t < 3000; t += 397) {
      for (const x of [0, 0.25, 0.5, 0.77, 1]) {
        for (const y of [0, 0.5, 1]) {
          assert.deepEqual(
            pixelColorAt(extended, t, x, y),
            pixelColorAt(base, t, x, y),
            `text/imageUrl ne doivent pas altérer pixelColorAt (${type}, t=${t}, x=${x}, y=${y})`,
          );
        }
      }
    }
  }
}

// (l) v3 — renderPixelMapToCanvas accepte un dernier paramètre vidéo optionnel :
//     ne throw pas avec video null/undefined ni avec ctx null.
{
  const cfg = { type: "sweep", colorA: "#22d3ee", colorB: "#f43f5e", speed: 1, videoUrl: "blob:fakevideo" };
  // ctx null + video null/undefined => no-op silencieux.
  assert.doesNotThrow(() => renderPixelMapToCanvas(null, cfg, 0, 100, 100, null, null), "ctx null + video null => no-op");
  assert.doesNotThrow(() => renderPixelMapToCanvas(null, cfg, 0, 100, 100, null, undefined), "ctx null + video undefined => no-op");
  assert.doesNotThrow(() => renderPixelMapToCanvas(undefined, cfg, 0, 100, 100, undefined, undefined), "ctx undefined + video undefined => no-op");

  // ctx mock valide : video null/undefined ne doit pas throw, fond toujours dessiné.
  let fillRectCalls = 0;
  let drawImageCalls = 0;
  const mockCtx = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 0,
    strokeStyle: "",
    fillRect() { fillRectCalls++; },
    drawImage() { drawImageCalls++; },
    strokeText() {},
    fillText() {},
    save() {},
    restore() {},
  };
  assert.doesNotThrow(() => renderPixelMapToCanvas(mockCtx, cfg, 7, 120, 90, null, null), "video null => no-op vidéo");
  assert.ok(fillRectCalls > 0, "le champ de fond reste dessiné même sans vidéo");
  assert.equal(drawImageCalls, 0, "aucune image/vidéo => drawImage non appelé");

  // (l2) une source vidéo "prête" (videoWidth/videoHeight) déclenche drawImage (calque cover).
  const fakeVideo = { videoWidth: 320, videoHeight: 240 };
  drawImageCalls = 0;
  assert.doesNotThrow(() => renderPixelMapToCanvas(mockCtx, cfg, 7, 120, 90, null, fakeVideo));
  assert.ok(drawImageCalls > 0, "une vidéo prête doit appeler drawImage (cover)");

  // (l3) une source vidéo "pas prête" (dimensions 0) => pas de drawImage, pas de throw.
  const notReadyVideo = { videoWidth: 0, videoHeight: 0 };
  drawImageCalls = 0;
  assert.doesNotThrow(() => renderPixelMapToCanvas(mockCtx, cfg, 7, 120, 90, null, notReadyVideo));
  assert.equal(drawImageCalls, 0, "vidéo non prête (dim 0) => drawImage non appelé");
}

// (m) La config étendue (videoUrl) N'ALTÈRE PAS pixelColorAt :
//     mêmes sorties qu'une config sans ce champ, pour solid & sweep.
{
  for (const type of ["solid", "sweep"]) {
    const base = { type, colorA: "#22d3ee", colorB: "#f43f5e", speed: 1.3 };
    const extended = { ...base, text: "OVERLAY", imageUrl: "blob:img", videoUrl: "blob:video" };
    for (let t = 0; t < 3000; t += 397) {
      for (const x of [0, 0.25, 0.5, 0.77, 1]) {
        for (const y of [0, 0.5, 1]) {
          assert.deepEqual(
            pixelColorAt(extended, t, x, y),
            pixelColorAt(base, t, x, y),
            `videoUrl ne doit pas altérer pixelColorAt (${type}, t=${t}, x=${x}, y=${y})`,
          );
        }
      }
    }
  }
}

console.log("pixelMapEngine tests passed");
