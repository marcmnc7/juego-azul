import * as THREE from 'three';

// Texturas de superficie para todo el decorado, sin descargar imágenes: cada material del mundo
// (encalado, teja árabe, marès, piedra seca, asfalto, madera, losas, adoquín, arena…) se dibuja en
// un canvas como un mapa de detalle en escala de grises que se repite sin costuras. Todas van en
// una única textura por capas (sampler2DArray) y el shader las proyecta en coordenadas del mundo
// (triplanar), así que valen también para la geometría fusionada, que no tiene UV.

export enum Surf {
  None = 0,
  Plaster = 1,
  Roof = 2,
  Mares = 3,
  Stone = 4,
  Asphalt = 5,
  Wood = 6,
  Foliage = 7,
  Grass = 8,
  Louvre = 9,
  Paving = 10,
  Terracotta = 11,
  Sand = 12,
  Cobble = 13,
  DryStone = 14,
  Bark = 15,
}
const LAYERS = 16;
const N = 256;

/** Metros que ocupa cada repetición de la textura, y cuánto se nota sobre el color. */
export const SURF_SCALE = [1, 2.6, 2.2, 2.4, 3, 3.5, 2, 1.6, 2.5, 0.9, 2.4, 1.2, 4, 1.6, 2.6, 1.2];
export const SURF_STRENGTH = [0, 0.75, 0.85, 0.9, 0.9, 0.8, 0.8, 0.85, 0.8, 0.75, 0.75, 0.8, 0.6, 0.9, 0.95, 0.9];

type Ctx = CanvasRenderingContext2D;

// Generador pseudoaleatorio con semilla, para que las texturas sean siempre las mismas
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a: number, b: number) => a + rnd() * (b - a);
const gray = (v: number, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

/** Dibuja una forma repetida en las 9 posiciones para que el borde case con el lado contrario. */
function wrap(fn: (ox: number, oy: number) => void) {
  for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy);
}

function speckle(ctx: Ctx, n: number, lo: number, hi: number, r0: number, r1: number, a0 = 0.15, a1 = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * N, y = rnd() * N, r = rr(r0, r1);
    ctx.fillStyle = gray(rr(lo, hi), rr(a0, a1));
    wrap((ox, oy) => {
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, r, r * rr(0.5, 1), rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function blotches(ctx: Ctx, n: number, lo: number, hi: number, r0: number, r1: number, a = 0.12) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * N, y = rnd() * N, r = rr(r0, r1);
    const v = rr(lo, hi);
    wrap((ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, gray(v, a));
      g.addColorStop(1, gray(v, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
}

function crack(ctx: Ctx, x: number, y: number, len: number, v = 70, w = 0.8) {
  ctx.strokeStyle = gray(v, 0.55);
  ctx.lineWidth = w;
  const pts: [number, number][] = [[0, 0]];
  let a = rnd() * Math.PI * 2, px = 0, py = 0;
  for (let i = 0; i < len; i++) {
    a += (rnd() - 0.5) * 1.1;
    px += Math.cos(a) * 3;
    py += Math.sin(a) * 3;
    pts.push([px, py]);
  }
  wrap((ox, oy) => {
    ctx.beginPath();
    pts.forEach(([qx, qy], k) => (k ? ctx.lineTo(x + ox + qx, y + oy + qy) : ctx.moveTo(x + ox + qx, y + oy + qy)));
    ctx.stroke();
  });
}

/** Bloques en hileras (marès, piedra, ladrillo): cada fila desplazada media pieza. */
function blocks(ctx: Ctx, rows: number, cols: number, mortar: number, base: number, varr: number, mortarV: number, bevel = true) {
  ctx.fillStyle = gray(mortarV);
  ctx.fillRect(0, 0, N, N);
  const bh = N / rows, bw = N / cols;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let c = 0; c <= cols; c++) {
      const x = c * bw - off, y = r * bh;
      const v = base + rr(-varr, varr);
      wrap((ox) => {
        ctx.fillStyle = gray(v);
        ctx.fillRect(x + ox + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar);
        if (bevel) {
          ctx.fillStyle = gray(255, 0.12);
          ctx.fillRect(x + ox + mortar / 2, y + mortar / 2, bw - mortar, 2);
          ctx.fillStyle = gray(0, 0.14);
          ctx.fillRect(x + ox + mortar / 2, y + bh - mortar / 2 - 2, bw - mortar, 2);
        }
      });
    }
  }
}

const painters: ((ctx: Ctx) => void)[] = [];

// 0 · Nada
painters[Surf.None] = (ctx) => {
  ctx.fillStyle = gray(128);
  ctx.fillRect(0, 0, N, N);
};

// 1 · Encalado: capas de cal, marcas de brocha, manchas de humedad y alguna grieta fina
painters[Surf.Plaster] = (ctx) => {
  ctx.fillStyle = gray(200);
  ctx.fillRect(0, 0, N, N);
  blotches(ctx, 30, 150, 235, 20, 70, 0.18);
  for (let i = 0; i < 140; i++) {
    const y = rnd() * N, x = rnd() * N, l = rr(20, 80);
    ctx.strokeStyle = gray(rr(170, 235), 0.18);
    ctx.lineWidth = rr(1, 3);
    wrap((ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + l, y + oy + rr(-3, 3));
      ctx.stroke();
    });
  }
  speckle(ctx, 900, 150, 230, 0.4, 1.4, 0.1, 0.35);
  for (let i = 0; i < 3; i++) crack(ctx, rnd() * N, rnd() * N, 14, 120, 0.7);
};

// 2 · Teja árabe: hileras de canales curvos que se solapan
painters[Surf.Roof] = (ctx) => {
  ctx.fillStyle = gray(70);
  ctx.fillRect(0, 0, N, N);
  const cols = 8, rows = 6, w = N / cols, h = N / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * w + (r % 2 ? w / 2 : 0), y = r * h;
      const v = rr(140, 200);
      wrap((ox, oy) => {
        const g = ctx.createLinearGradient(x + ox, 0, x + ox + w, 0);
        g.addColorStop(0, gray(v * 0.55));
        g.addColorStop(0.5, gray(v));
        g.addColorStop(1, gray(v * 0.55));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + ox + w / 2, y + oy + h * 0.55, w * 0.46, h * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  speckle(ctx, 500, 40, 220, 0.5, 2, 0.1, 0.35);
  blotches(ctx, 14, 60, 90, 15, 40, 0.25); // líquenes oscuros
};

// 3 · Marès: sillares dorados, porosos, con el canto gastado
painters[Surf.Mares] = (ctx) => {
  blocks(ctx, 6, 3, 4, 175, 22, 120);
  speckle(ctx, 2600, 90, 230, 0.4, 1.8, 0.15, 0.5);
  blotches(ctx, 20, 110, 150, 10, 30, 0.18);
};

// 4 · Roca: caliza / marès salvaje, con grietas y hoyos
painters[Surf.Stone] = (ctx) => {
  ctx.fillStyle = gray(150);
  ctx.fillRect(0, 0, N, N);
  blotches(ctx, 40, 90, 210, 15, 60, 0.3);
  speckle(ctx, 2000, 60, 230, 0.5, 2.5, 0.15, 0.55);
  speckle(ctx, 120, 40, 80, 1.5, 4, 0.4, 0.7); // hoyos
  for (let i = 0; i < 10; i++) crack(ctx, rnd() * N, rnd() * N, 20, 50, 1.2);
};

// 5 · Asfalto: grava fina, algún parche y grieta
painters[Surf.Asphalt] = (ctx) => {
  ctx.fillStyle = gray(110);
  ctx.fillRect(0, 0, N, N);
  speckle(ctx, 5000, 60, 190, 0.4, 1.3, 0.3, 0.8);
  blotches(ctx, 10, 80, 140, 20, 60, 0.2);
  for (let i = 0; i < 4; i++) crack(ctx, rnd() * N, rnd() * N, 18, 40, 1);
};

// 6 · Madera: tablas con veta y juntas
painters[Surf.Wood] = (ctx) => {
  const boards = 5, w = N / boards;
  for (let b = 0; b < boards; b++) {
    const base = rr(120, 170);
    ctx.fillStyle = gray(base);
    ctx.fillRect(b * w, 0, w, N);
    for (let i = 0; i < 26; i++) {
      const x = b * w + rr(2, w - 2), ph = rr(0, 6), amp = rr(1, 4);
      ctx.strokeStyle = gray(base + rr(-45, 25), rr(0.25, 0.6));
      ctx.lineWidth = rr(0.5, 1.8);
      ctx.beginPath();
      for (let y = 0; y <= N; y += 8) {
        const xx = x + Math.sin((y / N) * Math.PI * 2 * 2 + ph) * amp; // periodo entero: casa arriba y abajo
        if (y === 0) ctx.moveTo(xx, y);
        else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = gray(40, 0.8);
    ctx.fillRect(b * w, 0, 2, N);
  }
};

// 7 · Follaje: hojas pequeñas con huecos de sombra
painters[Surf.Foliage] = (ctx) => {
  ctx.fillStyle = gray(90);
  ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * N, y = rnd() * N, r = rr(2, 6), a = rnd() * 3;
    ctx.fillStyle = gray(rr(100, 220), rr(0.5, 0.9));
    wrap((ox, oy) => {
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, r, r * 0.45, a, 0, Math.PI * 2);
      ctx.fill();
    });
  }
};

// 8 · Hierba: briznas cortas y calvas
painters[Surf.Grass] = (ctx) => {
  ctx.fillStyle = gray(130);
  ctx.fillRect(0, 0, N, N);
  blotches(ctx, 16, 90, 190, 20, 60, 0.3);
  for (let i = 0; i < 3500; i++) {
    const x = rnd() * N, y = rnd() * N, l = rr(2, 6);
    ctx.strokeStyle = gray(rr(80, 230), rr(0.4, 0.9));
    ctx.lineWidth = rr(0.6, 1.3);
    wrap((ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + rr(-1.5, 1.5), y + oy - l);
      ctx.stroke();
    });
  }
};

// 9 · Persiana menorquina: lamas horizontales con sombra debajo de cada una
painters[Surf.Louvre] = (ctx) => {
  const n = 16, h = N / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(0, i * h, 0, (i + 1) * h);
    g.addColorStop(0, gray(215));
    g.addColorStop(0.7, gray(165));
    g.addColorStop(1, gray(70));
    ctx.fillStyle = g;
    ctx.fillRect(0, i * h, N, h);
  }
  speckle(ctx, 300, 90, 220, 0.5, 1.5, 0.1, 0.3);
};

// 10 · Losas de piedra clara (aceras, paseo, plazas)
painters[Surf.Paving] = (ctx) => {
  ctx.fillStyle = gray(95);
  ctx.fillRect(0, 0, N, N);
  const n = 4, s = N / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = gray(rr(160, 205));
      ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    }
  speckle(ctx, 1800, 110, 230, 0.4, 1.4, 0.1, 0.4);
  blotches(ctx, 12, 120, 150, 10, 30, 0.25); // manchas de chicle y agua
};

// 11 · Baldosa de barro / ladrillo
painters[Surf.Terracotta] = (ctx) => {
  ctx.fillStyle = gray(90);
  ctx.fillRect(0, 0, N, N);
  const n = 4, s = N / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = gray(rr(150, 200));
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  speckle(ctx, 900, 100, 220, 0.5, 2, 0.15, 0.4);
};

// 12 · Arena: grano fino y ondulaciones del viento
painters[Surf.Sand] = (ctx) => {
  ctx.fillStyle = gray(170);
  ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 12; i++) {
    const y0 = (i / 12) * N;
    ctx.strokeStyle = gray(rr(130, 150), 0.35);
    ctx.lineWidth = rr(1.5, 3);
    ctx.beginPath();
    for (let x = 0; x <= N; x += 4) {
      const y = y0 + Math.sin((x / N) * Math.PI * 2 * 3 + i) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  speckle(ctx, 6000, 110, 240, 0.3, 0.9, 0.2, 0.6);
};

// 13 · Adoquín: piedras redondeadas en hileras (centros históricos)
painters[Surf.Cobble] = (ctx) => {
  ctx.fillStyle = gray(70);
  ctx.fillRect(0, 0, N, N);
  const rows = 8, cols = 8, w = N / cols, h = N / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c <= cols; c++) {
      const x = c * w + (r % 2 ? w / 2 : 0), y = r * h;
      const v = rr(140, 200);
      wrap((ox, oy) => {
        const g = ctx.createRadialGradient(x + ox + w * 0.4, y + oy + h * 0.4, 1, x + ox + w / 2, y + oy + h / 2, w * 0.6);
        g.addColorStop(0, gray(v + 30));
        g.addColorStop(1, gray(v - 50));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + ox + w / 2, y + oy + h / 2, w * 0.44, h * 0.42, rr(-0.2, 0.2), 0, Math.PI * 2);
        ctx.fill();
      });
    }
  speckle(ctx, 800, 80, 220, 0.4, 1.2, 0.1, 0.3);
};

// 14 · Pared seca menorquina: piedras irregulares sin mortero, con huecos oscuros
painters[Surf.DryStone] = (ctx) => {
  ctx.fillStyle = gray(35);
  ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * N, y = rnd() * N, w = rr(18, 40), h = rr(10, 22), a = rr(-0.3, 0.3);
    const v = rr(130, 210);
    const pts: [number, number][] = [];
    for (let k = 0; k < 7; k++) {
      const t = (k / 7) * Math.PI * 2;
      pts.push([Math.cos(t) * w * rr(0.75, 1), Math.sin(t) * h * rr(0.75, 1)]);
    }
    wrap((ox, oy) => {
      ctx.save();
      ctx.translate(x + ox, y + oy);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, gray(v + 25));
      g.addColorStop(1, gray(v - 55));
      ctx.fillStyle = g;
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }
  speckle(ctx, 900, 80, 230, 0.4, 1.5, 0.1, 0.35);
};

// 15 · Corteza: surcos verticales
painters[Surf.Bark] = (ctx) => {
  ctx.fillStyle = gray(130);
  ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * N;
    ctx.strokeStyle = gray(rr(40, 90), rr(0.4, 0.8));
    ctx.lineWidth = rr(1, 3);
    ctx.beginPath();
    for (let y = 0; y <= N; y += 8) {
      const xx = x + Math.sin((y / N) * Math.PI * 4 + i) * 3;
      if (y === 0) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  speckle(ctx, 600, 90, 200, 0.5, 2, 0.15, 0.4);
};

let tex: THREE.DataArrayTexture | null = null;
export const surfMeans = new Float32Array(LAYERS).fill(0.5);

/** Textura por capas con todos los mapas de detalle (se genera una vez, ~4 MB en GPU). */
export function surfaceTexture() {
  if (tex) return tex;
  const data = new Uint8Array(N * N * 4 * LAYERS);
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  for (let l = 0; l < LAYERS; l++) {
    seed = 1000 + l * 7919;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, N, N);
    painters[l](ctx);
    const px = ctx.getImageData(0, 0, N, N).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i];
    surfMeans[l] = Math.max(0.05, sum / (N * N) / 255);
    data.set(px, l * N * N * 4);
  }
  tex = new THREE.DataArrayTexture(data, N, N, LAYERS);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------- Qué superficie corresponde a cada color ----------

const explicit = new Map<number, Surf>();
/** Fija la superficie de un color concreto (gana a la heurística). */
export function setSurface(color: number, s: Surf) {
  explicit.set(color, s);
}
// Colores con nombre en el decorado
setSurface(0x2f7a4a, Surf.Louvre); // persianas verdes menorquinas
setSurface(0x2f6b46, Surf.Louvre);
setSurface(0xb8623e, Surf.Roof);
setSurface(0xb5603b, Surf.Roof);
setSurface(0x3a3a40, Surf.Asphalt);
setSurface(0x4a4a50, Surf.Asphalt);
setSurface(0xd8cfbd, Surf.Paving);
setSurface(0xbdb4a4, Surf.Paving);
setSurface(0xd8d2c4, Surf.Paving);
setSurface(0xd9c7a6, Surf.Terracotta);
setSurface(0x5a4a38, Surf.Bark);
setSurface(0x6b5a40, Surf.Bark);
setSurface(0x6b4a2e, Surf.Wood);
setSurface(0x8a6a44, Surf.Wood);
setSurface(0x7a5a3a, Surf.Wood);
setSurface(0x8f877a, Surf.DryStone); // pared seca
setSurface(0x6f6a62, Surf.Stone); // pizarra del Cap de Creus
setSurface(0x7d766b, Surf.Stone);

const hsl = { h: 0, s: 0, l: 0 };
const tmp = new THREE.Color();
const cache = new Map<number, Surf>();

/** Superficie por defecto de un color: blanco → encalado, teja, marès, asfalto, madera, verdes… */
export function surfaceFor(color: number): Surf {
  const e = explicit.get(color);
  if (e !== undefined) return e;
  const c = cache.get(color);
  if (c !== undefined) return c;
  tmp.set(color).getHSL(hsl, THREE.SRGBColorSpace);
  const h = hsl.h * 360, s = hsl.s, l = hsl.l;
  let r = Surf.None;
  if (l > 0.74 && s < 0.55) r = Surf.Plaster;
  else if (h >= 8 && h <= 26 && s > 0.4 && l > 0.3 && l < 0.55) r = Surf.Roof;
  else if (h >= 28 && h <= 46 && s > 0.25 && s < 0.65 && l > 0.45 && l < 0.72) r = Surf.Mares;
  else if (h >= 20 && h <= 45 && s < 0.3 && l > 0.3 && l < 0.62) r = Surf.Stone;
  else if (l < 0.3 && s < 0.12 && l > 0.12) r = Surf.Asphalt;
  else if (h >= 18 && h <= 40 && s > 0.25 && l > 0.17 && l < 0.42) r = Surf.Wood;
  else if (h >= 70 && h <= 160 && s > 0.15 && l > 0.12 && l < 0.55) r = Surf.Foliage;
  cache.set(color, r);
  return r;
}
