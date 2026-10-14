import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Texturas dibujadas a mano en canvas: banderas de Menorca, senyeres, pancartas de las fiestas
// y placas de calle. Así no hay que descargar imágenes.

export function canvasTex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function senyera(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, vertical = false) {
  // Cuatro barras rojas sobre fondo amarillo (nueve franjas)
  ctx.fillStyle = '#f6c724';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d4202a';
  for (let i = 0; i < 4; i++) {
    if (vertical) ctx.fillRect(x + (w / 9) * (1 + i * 2), y, w / 9, h);
    else ctx.fillRect(x, y + (h / 9) * (1 + i * 2), w, h / 9);
  }
}

/** Castillo con torre central dentro de un octógono, como en el escudo de la Universitat de Menorca. */
function menorcaEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#f4efe2';
  ctx.fill();
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = '#b8902a';
  ctx.stroke();
  // Muralla y torres
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(-r * 0.6, r * 0.05, r * 1.2, r * 0.45);
  for (const sx of [-0.6, 0.45]) ctx.fillRect(r * sx, -r * 0.15, r * 0.18, r * 0.65);
  ctx.fillRect(-r * 0.14, -r * 0.55, r * 0.28, r * 0.75);
  ctx.fillRect(-r * 0.02, -r * 0.8, r * 0.04, r * 0.28);
  ctx.fillRect(-r * 0.1, -r * 0.72, r * 0.2, r * 0.04);
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(-r * 0.09, r * 0.22, r * 0.18, r * 0.28); // puerta
  // Escuditos de las barras a los lados
  for (const sx of [-1, 1]) senyera(ctx, sx * r * 0.62 - r * 0.13, -r * 0.62, r * 0.26, r * 0.32, true);
  ctx.restore();
}

/** Bandera de Menorca: senyera con el escudo desplazado hacia el asta. */
export function menorcaFlagTexture() {
  return canvasTex(
    (ctx, w, h) => {
      senyera(ctx, 0, 0, w, h);
      menorcaEmblem(ctx, w * 0.3, h * 0.5, h * 0.3);
    },
    256,
    170,
  );
}

/** Senyera vertical para colgar del balcón (domàs). */
export function senyeraTexture() {
  return canvasTex((ctx, w, h) => senyera(ctx, 0, 0, w, h, true), 128, 192);
}

/** Pancarta de tela de las fiestas. */
export function bannerTexture(lines: string[], sub?: string) {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = '#fff6e4';
      ctx.fillRect(0, 0, w, h);
      // Ribete con las barras
      senyera(ctx, 0, 0, w, 18);
      senyera(ctx, 0, h - 18, w, 18);
      ctx.fillStyle = '#9b2335';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 66px Fredoka, sans-serif';
      ctx.fillText(lines[0], w / 2, h * 0.36);
      ctx.fillStyle = '#2a1a2e';
      ctx.font = '600 44px Fredoka, sans-serif';
      ctx.fillText(lines[1] ?? '', w / 2, h * 0.64);
      if (sub) {
        ctx.font = '600 26px Fredoka, sans-serif';
        ctx.fillStyle = '#6a5a4a';
        ctx.fillText(sub, w / 2, h * 0.82);
      }
      // Herraduras a los lados (Jaleo)
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 10;
      for (const x of [70, w - 70]) {
        ctx.beginPath();
        ctx.arc(x, h * 0.5, 30, Math.PI * 0.85, Math.PI * 2.15, false);
        ctx.stroke();
      }
    },
    1024,
    256,
  );
}

/** Placa de calle de cerámica. */
export function streetSignTexture(name: string) {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = '#fbf7ee';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2b5f8a';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#2b5f8a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 44px Fredoka, sans-serif';
      ctx.fillText(name, w / 2, h / 2 + 2);
    },
    512,
    112,
  );
}

/** Rótulo de letras sobre fachada (Ajuntament, bares). */
export function letteringTexture(text: string, color = '#2a1a2e', bg = 'rgba(0,0,0,0)') {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 60px Georgia, serif';
      ctx.fillText(text, w / 2, h / 2 + 4);
    },
    1024,
    96,
  );
}

/** Junta varios planos con la misma textura en una sola malla. */
export function mergedPlanes(planes: { w: number; h: number; x: number; y: number; z: number; ry: number; rx?: number }[], mat: THREE.Material) {
  const geos = planes.map((p) => {
    const g = new THREE.PlaneGeometry(p.w, p.h);
    g.rotateX(p.rx ?? 0);
    g.rotateY(p.ry);
    g.translate(p.x, p.y, p.z);
    return g;
  });
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  geos.forEach((g) => g.dispose());
  return m;
}
