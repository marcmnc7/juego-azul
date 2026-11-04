import * as THREE from 'three';
import photoUrl from '../assets/surf-photo.jpg';
import colorUrl from '../assets/pbr/color.jpg';
import normalUrl from '../assets/pbr/normal.jpg';
import roughUrl from '../assets/pbr/rough.jpg';

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
  /** Sin foto: su brillo. Hierro, acero, barandillas. */
  Metal = 16,
  /** Cristal de ventana: refleja el cielo. */
  Glass = 17,
}
const LAYERS = 16;
const N = 256;

/** Metros que ocupa cada repetición de la textura, y cuánto se nota sobre el color. */
export const SURF_SCALE = [1, 2.6, 2.2, 2.4, 3, 5, 2, 1.6, 2.5, 0.9, 2.4, 1.2, 4, 1.6, 2.6, 1.2];
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
  if (photo) applyPhoto(data);
  tex = new THREE.DataArrayTexture(data, N, N, LAYERS);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------- Texturas fotográficas ----------
// Detalle sacado de fotos reales (arena, tierra, césped, madera, adoquín, baldosa de barro y la piedra
// seca del Camí de sa Farola): una tira en escala de grises con una capa por superficie. Las capas
// negras de la tira se quedan con el dibujo procedural (teja, persiana, corteza).
let photo: Uint8ClampedArray | null = null;
let photoLoading: Promise<void> | null = null;

function applyPhoto(data: Uint8Array) {
  if (!photo) return;
  for (let l = 0; l < LAYERS; l++) {
    const src = photo.subarray(l * N * N * 4, (l + 1) * N * N * 4);
    let sum = 0;
    for (let i = 0; i < src.length; i += 4) sum += src[i];
    const mean = sum / (N * N) / 255;
    if (mean < 0.05) continue;
    data.set(src, l * N * N * 4);
    surfMeans[l] = mean;
  }
}

/** Carga la tira de fotos una vez (al arrancar el juego) y, si la textura ya existe, la actualiza. */
export function loadSurfacePhotos() {
  if (photoLoading) return photoLoading;
  photoLoading = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = N;
        c.height = N * LAYERS;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, N, N * LAYERS);
        photo = ctx.getImageData(0, 0, N, N * LAYERS).data;
        if (tex) {
          applyPhoto(tex.image.data as Uint8Array);
          tex.needsUpdate = true;
        }
      } catch {
        photo = null;
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = photoUrl;
  });
  return photoLoading;
}

// ---------- Calidad de la prueba de concepto (de momento, solo el capítulo 1) ----------
// Resolución de cada capa en la GPU. Se pinta a 256 y se dibuja al doble para que las fotos
// (estuco, teja, marès y losas de Sponza) se vean nítidas.
const M = 512;
/** Relieve de cada superficie (cuánto se nota el mapa de normales). */
export const SURF_NORMAL = [0, 0.9, 1.1, 1.0, 0.9, 0.55, 0.8, 0.7, 0.6, 0.6, 1.0, 0.8, 0.6, 1.0, 1.1, 0.9];

let hdTex: THREE.DataArrayTexture | null = null;
let hdNrmTex: THREE.DataArrayTexture | null = null;
/** Color medio de cada capa (RGB), para que la textura cambie el detalle pero no el color elegido. */
export const hdMeans = new Float32Array(LAYERS * 3).fill(0.5);
/** Rugosidad media de cada capa: la textura la varía alrededor de la del material. */
export const hdRoughMeans = new Float32Array(LAYERS).fill(0.5);
let procedural: Uint8Array | null = null;

function paintProcedural() {
  if (procedural) return procedural;
  const data = new Uint8Array(M * M * 4 * LAYERS);
  const c = document.createElement('canvas');
  c.width = c.height = M;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  for (let l = 0; l < LAYERS; l++) {
    seed = 1000 + l * 7919;
    ctx.setTransform(M / N, 0, 0, M / N, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, N, N);
    painters[l](ctx);
    data.set(ctx.getImageData(0, 0, M, M).data, l * M * M * 4);
  }
  return (procedural = data);
}

let leavesData: Uint8ClampedArray | null = null;
/**
 * La capa de follaje: cientos de hojas dibujadas una a una, de la sombra hacia la luz, que empalman por
 * los bordes. En RGB, su luz; en alfa, su silueta (lo que hay entre hojas se recorta en el shader).
 */
function paintLeaves() {
  if (leavesData) return leavesData;
  const c = document.createElement('canvas');
  c.width = c.height = M;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  seed = 4242;
  ctx.clearRect(0, 0, M, M);
  const COUNT = 1500;
  for (let i = 0; i < COUNT; i++) {
    const k = i / COUNT; // primero las de dentro, oscuras; al final, las de fuera, al sol
    const x = rnd() * M, y = rnd() * M, a = rnd() * Math.PI * 2, L = rr(11, 21), W = L * rr(0.3, 0.46);
    const v = 70 + k * 150 + rr(-22, 22);
    const r = v * rr(0.78, 0.96), g = v, b = v * rr(0.58, 0.74);
    for (const ox of [-M, 0, M])
      for (const oy of [-M, 0, M]) {
        if (x + ox < -30 || x + ox > M + 30 || y + oy < -30 || y + oy > M + 30) continue;
        ctx.save();
        ctx.translate(x + ox, y + oy);
        ctx.rotate(a);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.beginPath();
        ctx.moveTo(-L, 0);
        ctx.quadraticCurveTo(0, -W, L, 0);
        ctx.quadraticCurveTo(0, W, -L, 0);
        ctx.fill();
        // Nervio central, y media hoja algo más clara
        ctx.strokeStyle = `rgba(${(r * 0.62) | 0},${(g * 0.62) | 0},${(b * 0.55) | 0},0.7)`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-L * 0.9, 0);
        ctx.lineTo(L * 0.9, 0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,235,0.12)';
        ctx.beginPath();
        ctx.moveTo(-L, 0);
        ctx.quadraticCurveTo(0, -W, L, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
  }
  const d = ctx.getImageData(0, 0, M, M).data;
  // Entre hojas, oscuro: así el borde filtrado no brilla
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] < 12) {
      d[i] = 34;
      d[i + 1] = 46;
      d[i + 2] = 26;
    }
  return (leavesData = d);
}

/** Rellena los datos de color y de relieve con lo pintado y, encima, las fotos ya cargadas. */
function fill(col: Uint8Array, nrm: Uint8Array) {
  col.set(paintProcedural());
  const S = M * M * 4;
  for (let l = 0; l < LAYERS; l++) {
    const o = l * S;
    if (hdPhoto) {
      const src = hdPhoto.color.subarray(o, o + S);
      let sum = 0;
      for (let i = 0; i < S; i += 4) sum += src[i] + src[i + 1] + src[i + 2];
      if (sum / (M * M * 3 * 255) > 0.05) col.set(src, o);
    }
    const leaves = l === Surf.Foliage;
    if (leaves) col.set(paintLeaves(), o);
    let r = 0, g = 0, b = 0, cnt = 0;
    for (let i = o; i < o + S; i += 4) {
      if (leaves && col[i + 3] < 128) continue;
      r += col[i]; g += col[i + 1]; b += col[i + 2]; cnt++;
    }
    const k = 1 / (Math.max(1, cnt) * 255);
    hdMeans[l * 3] = Math.max(0.05, r * k);
    hdMeans[l * 3 + 1] = Math.max(0.05, g * k);
    hdMeans[l * 3 + 2] = Math.max(0.05, b * k);
    // Relieve: el mapa de normales de la foto si lo hay; si no, sacado del propio dibujo
    const pn = hdPhoto?.normal.subarray(o, o + S);
    let pnSum = 0;
    if (pn && !leaves) for (let i = 0; i < S; i += 64) pnSum += pn[i + 2];
    const pr = hdPhoto?.rough.subarray(o, o + S);
    let prSum = 0;
    if (pr && !leaves) for (let i = 0; i < S; i += 64) prSum += pr[i];
    const lum = (x: number, y: number) => {
      const i = o + (((y + M) % M) * M + ((x + M) % M)) * 4;
      return (col[i] * 0.3 + col[i + 1] * 0.59 + col[i + 2] * 0.11) / 255;
    };
    const mean = (hdMeans[l * 3] * 0.3 + hdMeans[l * 3 + 1] * 0.59 + hdMeans[l * 3 + 2] * 0.11);
    let rs = 0;
    for (let y = 0; y < M; y++)
      for (let x = 0; x < M; x++) {
        const i = o + (y * M + x) * 4;
        if (pnSum > 0) {
          nrm[i] = pn![i - o]; nrm[i + 1] = pn![i - o + 1]; nrm[i + 2] = pn![i - o + 2];
        } else {
          // Lo oscuro (juntas, grietas) se hunde
          const dx = (lum(x + 1, y) - lum(x - 1, y)) * 2.2;
          const dy = (lum(x, y + 1) - lum(x, y - 1)) * 2.2;
          const il = 1 / Math.hypot(dx, dy, 1);
          nrm[i] = (-dx * il * 0.5 + 0.5) * 255;
          nrm[i + 1] = (dy * il * 0.5 + 0.5) * 255;
          nrm[i + 2] = (il * 0.5 + 0.5) * 255;
        }
        const rv = prSum > 0 ? pr![i - o] : Math.max(8, Math.min(255, (0.55 + (mean - lum(x, y)) * 0.8) * 255));
        nrm[i + 3] = rv;
        rs += rv;
      }
    hdRoughMeans[l] = Math.max(0.05, rs / (M * M * 255));
  }
}

function arrayTex(data: Uint8Array) {
  const t = new THREE.DataArrayTexture(data, M, M, LAYERS);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Textura por capas con el color de detalle de cada superficie (se genera una vez). */
export function hdSurfaceTexture() {
  if (!hdTex) {
    const col = new Uint8Array(M * M * 4 * LAYERS);
    const nrm = new Uint8Array(M * M * 4 * LAYERS);
    fill(col, nrm);
    hdTex = arrayTex(col);
    hdNrmTex = arrayTex(nrm);
  }
  return hdTex;
}

/** Relieve (normal en RGB) y rugosidad (en A) de cada superficie, a juego con surfaceTexture(). */
export function hdNormalTexture() {
  hdSurfaceTexture();
  return hdNrmTex!;
}

// ---------- Texturas fotográficas ----------
// Las mismas de la prueba de concepto: estuco, teja, marès y losas de Sponza (color, relieve y
// rugosidad), más el detalle sacado de fotos reales (arena, tierra, césped, madera, adoquín, baldosa
// de barro y la piedra seca del Camí de sa Farola). Una tira con una capa por superficie; las capas
// negras se quedan con el dibujo procedural (persiana, corteza).
let hdPhoto: { color: Uint8ClampedArray; normal: Uint8ClampedArray; rough: Uint8ClampedArray } | null = null;
let hdLoading: Promise<void> | null = null;

function loadStrip(url: string) {
  return new Promise<Uint8ClampedArray | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = M;
        c.height = M * LAYERS;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, M, M * LAYERS);
        resolve(ctx.getImageData(0, 0, M, M * LAYERS).data);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Carga las tiras HD una vez y, si las texturas ya existen, las actualiza. */
export function loadHdPhotos() {
  hdLoading ??= Promise.all([loadStrip(colorUrl), loadStrip(normalUrl), loadStrip(roughUrl)]).then(([color, normal, rough]) => {
    if (!color || !normal || !rough) return;
    hdPhoto = { color, normal, rough };
    if (hdTex && hdNrmTex) {
      fill(hdTex.image.data as Uint8Array, hdNrmTex.image.data as Uint8Array);
      hdTex.needsUpdate = true;
      hdNrmTex.needsUpdate = true;
    }
  });
  return hdLoading;
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
// Casa de Azul y Camí de sa Farola (fotos de Street View)
setSurface(0xd2245a, Surf.Foliage); // buganvilla
setSurface(0xe33a6e, Surf.Foliage);
setSurface(0xd9cfbd, Surf.Paving);
setSurface(0xb5b0a6, Surf.Asphalt); // calle de hormigón
setSurface(0xbfae92, Surf.DryStone);
setSurface(0x8a7a66, Surf.Wood); // cancela de acebuche
setSurface(0x7a6a56, Surf.Wood);
setSurface(0x24603a, Surf.Louvre);
setSurface(0x2c6a48, Surf.None); // lona del toldo
setSurface(0xc9b48a, Surf.Sand); // arcén de tierra
setSurface(0xa9a39a, Surf.Cobble); // adoquín de la placita del faro
setSurface(0xc4977e, Surf.Terracotta); // hormigón impreso
setSurface(0xeeebe4, Surf.Roof); // teja pintada de blanco
// Jardines y campo de alrededor
setSurface(0x3f7a3a, Surf.Grass);
setSurface(0x4a7a40, Surf.Grass);
setSurface(0x5f6f3c, Surf.Grass);
setSurface(0x4c5e34, Surf.Grass);
setSurface(0x56683a, Surf.Grass);
setSurface(0xf4efe2, Surf.Plaster);
// Cristal de las ventanas
for (const c of [0x30384a, 0x2a3138, 0x2c3a46, 0x24303c, 0x3a4250, 0x1b2430, 0x2b3a48, 0x9fd3e8, 0x7a8fa6, 0x9fc4e0, 0x9fb8c8, 0x14181f, 0x1b2440]) setSurface(c, Surf.Glass);
// Hierro y acero: farolas, barandillas, verjas, postes, encimeras
for (const c of [0xc8ccd0, 0x9a9ea2, 0x2b2f36, 0x1e1e22, 0x1e1e1e, 0x8a93a6, 0xd0d6dc, 0x8f98a4, 0x8d9096, 0xb4b7bc, 0x9aa3ad, 0x333338, 0x777777, 0x888888, 0x9a9a9a, 0xbdbdbd, 0x22262c, 0x2c5a40, 0x4a525c, 0xb8bcc4, 0xa8a8b0, 0xbbbbbb, 0x7c7f86, 0x111111, 0x1a1a1a]) setSurface(c, Surf.Metal);
// Flores de buganvilla y adelfa: también hojas, para que no sean bolas
for (const c of [0xc72a5c, 0xdb4a78, 0xe0457b, 0xc2307a, 0xe0245e, 0xff5a7a, 0xd6338a]) setSurface(c, Surf.Foliage);
// La roca de Es Castellar y los armarios pintados de la cocina
setSurface(0xc9a36b, Surf.Stone);
setSurface(0x5f8f6a, Surf.Wood);
setSurface(0x6a5444, Surf.Wood); // el fondo del bar de la terraza
// Troncos
for (const c of [0x6b4a32, 0x6b4a30, 0x5a3e28, 0x6b5a46, 0x7a6448, 0x3f3026, 0x5a4634, 0x4a3426]) setSurface(c, Surf.Bark);
// Lo que brilla por sí solo (ventanas encendidas, faroles) va liso
for (const c of [0xffd9a0, 0xffc680, 0xfff3b0, 0xffd890, 0xfff6d8, 0xfff4b0, 0xf4e6c0]) setSurface(c, Surf.None);

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
  // Grises medios: hormigón, bordillos, piedra de banco (antes quedaban lisos)
  else if (s < 0.1 && l >= 0.42 && l <= 0.72) r = Surf.Paving;
  else if (h >= 40 && h <= 70 && s > 0.2 && s < 0.6 && l > 0.3 && l < 0.6) r = Surf.Grass;
  // Lo que quedaba liso: piedra y hormigón en gris azulado, hierro casi negro y paredes de color
  else if (s < 0.28 && l >= 0.25 && l <= 0.72) r = Surf.Stone;
  else if (l < 0.14 && s < 0.3) r = Surf.Metal;
  else if (h >= 18 && h <= 62 && l > 0.5 && s < 0.95) r = Surf.Plaster;
  cache.set(color, r);
  return r;
}
