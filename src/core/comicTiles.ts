import * as THREE from 'three';

// Texturas dibujadas del estilo cómic: sustituyen a las fotos de material del pueblo (losas, sillares de marès,
// teja árabe, encalado, madera) con el mismo tamaño de pieza que la foto, para que encajen en los mismos UV.
// Cada pieza es de un color plano (con un poco de variación entre piezas), con un bisel de luz arriba y un
// tono de sombra abajo, y una línea de tinta en las juntas. El color del material las tiñe encima, como a la foto.

const S = 512;
const INK = 'rgba(52,38,30,0.92)';

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function css(c: THREE.Color, k = 1) {
  return '#' + c.clone().multiplyScalar(k).getHexString();
}

/** Repite un dibujo en las 9 posiciones vecinas, para que lo que se sale por un borde entre por el otro. */
function wrapDraw(f: (dx: number, dy: number) => void) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy);
}

/** Piezas rectangulares en hileras (losas del suelo, sillares de las paredes). */
function blocks(g: CanvasRenderingContext2D, base: THREE.Color, rows: number, minW: number, maxW: number, seed: number, pores: number) {
  const r = rng(seed);
  const rh = S / rows;
  g.fillStyle = INK;
  g.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    // la hilera se cierra justo un ancho S después de empezar, para que la junta case al repetirse
    const x0 = -r() * maxW;
    const cuts = [x0];
    let x = x0;
    for (;;) {
      const w = minW + r() * (maxW - minW);
      if (x + w > x0 + S - minW) break;
      x += w;
      cuts.push(x);
    }
    cuts.push(x0 + S);
    for (let i = 0; i < cuts.length - 1; i++) {
      const x0 = cuts[i], x1 = cuts[i + 1];
      const k = 0.94 + r() * 0.1;
      const c = base.clone().multiplyScalar(k);
      const hue = (r() - 0.5) * 0.03;
      c.offsetHSL(hue, (r() - 0.5) * 0.06, 0);
      wrapDraw((dx) => {
        const X0 = x0 + dx + 1.6, X1 = x1 + dx - 1.6, Y0 = y + 1.6, Y1 = y + rh - 1.6;
        if (X1 < -4 || X0 > S + 4) return;
        g.fillStyle = css(c);
        g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
        // bisel: luz arriba e izquierda, sombra abajo y derecha (tonos planos, sin degradado)
        g.fillStyle = css(c, 1.07);
        g.fillRect(X0, Y0, X1 - X0, rh * 0.07);
        g.fillRect(X0, Y0, rh * 0.05, Y1 - Y0);
        g.fillStyle = css(c, 0.84);
        g.fillRect(X0, Y1 - rh * 0.09, X1 - X0, rh * 0.09);
        g.fillRect(X1 - rh * 0.06, Y0, rh * 0.06, Y1 - Y0);
      });
      // poros y alguna grieta corta: trazo de plumilla, poco
      const w = x1 - x0;
      for (let p = 0; p < pores * (w / 100); p++) {
        const px = x0 + 6 + r() * (w - 12), py = y + 6 + r() * (rh - 14);
        const rad = 0.8 + r() * 1.6;
        wrapDraw((dx) => {
          g.fillStyle = css(c, 0.72);
          g.beginPath();
          g.arc(px + dx, py, rad, 0, Math.PI * 2);
          g.fill();
        });
      }
      if (r() < 0.35) {
        const px = x0 + 10 + r() * (w - 20), py = y + 8 + r() * (rh - 16);
        const pts = [[px, py]];
        for (let s = 0; s < 3; s++) pts.push([pts[s][0] + 4 + r() * 8, pts[s][1] + (r() - 0.5) * 8]);
        wrapDraw((dx) => {
          g.strokeStyle = css(c, 0.66);
          g.lineWidth = 1.3;
          g.beginPath();
          g.moveTo(pts[0][0] + dx, pts[0][1]);
          for (const q of pts.slice(1)) g.lineTo(q[0] + dx, q[1]);
          g.stroke();
        });
      }
    }
  }
}

/** Teja árabe: columnas de tejas curvas solapadas, en tres tonos (lomo de luz, cara y sombra) y tinta. */
function tiles(g: CanvasRenderingContext2D, base: THREE.Color, seed: number) {
  const r = rng(seed);
  const cols = 16, cw = S / cols, th = S / 8;
  g.fillStyle = css(base, 0.38);
  g.fillRect(0, 0, S, S);
  for (let c = 0; c < cols; c++) {
    const x = c * cw;
    const off = (c % 2) * th * 0.5;
    for (let k = -1; k < 9; k++) {
      const y = k * th + off;
      const col = base.clone().multiplyScalar(0.9 + r() * 0.18);
      if (r() < 0.12) col.lerp(new THREE.Color(0xd9b48a), 0.35); // alguna teja más descolorida por el sol
      wrapDraw((dx, dy) => {
        const X = x + dx, Y = y + dy;
        if (Y > S + th || Y < -th * 2) return;
        // cuerpo de la teja
        g.fillStyle = css(col, 0.82);
        g.beginPath();
        g.roundRect(X + 1.5, Y, cw - 3, th * 1.08, [cw * 0.45, cw * 0.45, 4, 4]);
        g.fill();
        // cara iluminada y lomo de luz (la teja es un medio cilindro)
        g.fillStyle = css(col, 1);
        g.fillRect(X + cw * 0.22, Y + th * 0.12, cw * 0.5, th * 0.86);
        g.fillStyle = css(col, 1.13);
        g.fillRect(X + cw * 0.3, Y + th * 0.18, cw * 0.18, th * 0.74);
        // contorno de tinta y sombra de la teja de encima
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(X + 1.5, Y, cw - 3, th * 1.08, [cw * 0.45, cw * 0.45, 4, 4]);
        g.stroke();
        g.fillStyle = 'rgba(40,20,12,0.55)';
        g.fillRect(X + 2, Y + th * 0.98, cw - 4, th * 0.1);
      });
    }
  }
}

/** Encalado: blanco casi plano, con algún parche de cal más vieja y unos pocos trazos finos. */
function wash(g: CanvasRenderingContext2D, base: THREE.Color, seed: number) {
  const r = rng(seed);
  g.fillStyle = css(base);
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7; i++) {
    const x = r() * S, y = r() * S, rx = 30 + r() * 70, ry = 20 + r() * 40, rot = r() * 3;
    wrapDraw((dx, dy) => {
      g.fillStyle = css(base, 0.985);
      g.beginPath();
      g.ellipse(x + dx, y + dy, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    });
  }
  for (let i = 0; i < 10; i++) {
    const x = r() * S, y = r() * S, len = 8 + r() * 16, a = r() * Math.PI;
    wrapDraw((dx, dy) => {
      g.strokeStyle = css(base, 0.86);
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
      g.stroke();
    });
  }
}

/** Tablas de madera con veta a trazos y algún nudo. */
function wood(g: CanvasRenderingContext2D, base: THREE.Color, seed: number) {
  const r = rng(seed);
  const n = 5, ph = S / n;
  g.fillStyle = INK;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const y = i * ph;
    const c = base.clone().multiplyScalar(0.92 + r() * 0.14);
    g.fillStyle = css(c);
    g.fillRect(0, y + 2, S, ph - 4);
    g.fillStyle = css(c, 1.08);
    g.fillRect(0, y + 2, S, ph * 0.08);
    g.fillStyle = css(c, 0.84);
    g.fillRect(0, y + ph - 2 - ph * 0.1, S, ph * 0.1);
    g.strokeStyle = css(c, 0.74);
    g.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) {
      const yy = y + ph * (0.25 + r() * 0.5);
      const x0 = r() * S;
      const len = 90 + r() * 200;
      wrapDraw((dx) => {
        g.beginPath();
        g.moveTo(x0 + dx, yy);
        g.bezierCurveTo(x0 + dx + len * 0.3, yy - 3, x0 + dx + len * 0.6, yy + 3, x0 + dx + len, yy);
        g.stroke();
      });
    }
    if (r() < 0.6) {
      const x = r() * S, yy = y + ph * 0.5;
      wrapDraw((dx) => {
        g.beginPath();
        g.ellipse(x + dx, yy, 7, 4, 0, 0, Math.PI * 2);
        g.stroke();
      });
    }
  }
}

let bulb: THREE.CanvasTexture | null = null;
/** Bombilla de tebeo: círculo de color con su aro de tinta y un brillo, en vez de un halo borroso. */
export function comicBulbTexture() {
  if (bulb) return bulb;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#2b2233';
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(32, 32, 23, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath();
  g.arc(25, 24, 7, 0, Math.PI * 2);
  g.fill();
  bulb = new THREE.CanvasTexture(cv);
  bulb.colorSpace = THREE.SRGBColorSpace;
  return bulb;
}

let clouds: THREE.CanvasTexture[] | null = null;
/**
 * Nubes de tebeo: cúmulos de bolas con la panza plana, blancas arriba y con un tono plano de sombra azulada
 * abajo, contorno de tinta y un par de rizos dentro. Tres formas.
 */
export function comicCloudTextures() {
  if (clouds) return clouds;
  const r = rng(5);
  clouds = [0, 1, 2].map(() => {
    const W = 512, H = 256;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    const base = H * 0.78;
    const blobs: [number, number, number][] = [];
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const mid = 1 - Math.abs(t - 0.5) * 1.5;
      const rad = 30 + mid * 50 + r() * 14;
      blobs.push([W * (0.17 + 0.66 * t) + (r() - 0.5) * 24, base - rad * (0.35 + r() * 0.35), rad]);
    }
    const circles = (dy: number, k: number) => {
      g.beginPath();
      for (const [x, y, rad] of blobs) {
        g.moveTo(x + rad * k, y + dy);
        g.arc(x, y + dy, rad * k, 0, Math.PI * 2);
      }
    };
    g.save();
    g.beginPath();
    g.rect(0, 0, W, base);
    g.clip();
    // contorno: las bolas trazadas gordas por debajo; el relleno tapa la mitad interior del trazo
    g.lineWidth = 9;
    g.strokeStyle = '#2b2b3d';
    circles(0, 1);
    g.stroke();
    g.fillStyle = '#c3d3f2';
    circles(0, 1);
    g.fill();
    g.fillStyle = '#ffffff';
    circles(-0.2 * 60, 0.86);
    g.fill();
    // rizos de tinta dentro, en el borde entre luz y sombra
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (const [x, y, rad] of blobs.slice(1, -1)) {
      if (r() < 0.4) continue;
      g.beginPath();
      g.arc(x - rad * 0.15, y + rad * 0.35, rad * 0.35, Math.PI * 0.15, Math.PI * 0.75);
      g.stroke();
    }
    // panza plana con su línea de tinta (solo donde hay nube)
    circles(0, 1);
    g.clip();
    g.fillStyle = '#2b2b3d';
    g.fillRect(0, base - 5, W, 5);
    g.restore();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  return clouds;
}

const cache = new Map<string, THREE.CanvasTexture>();
/** Textura dibujada de ese tipo (una por tipo; cada material la clona con su propia repetición). */
export function comicTile(kind: string): THREE.CanvasTexture | null {
  const hit = cache.get(kind);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  switch (kind) {
    // (losas casi cuadradas: alargadas, en perspectiva parecían tablas de madera)
    case 'slabs': blocks(g, new THREE.Color(0xe6d3aa), 6, 95, 165, 11, 4); break;
    case 'mares': blocks(g, new THREE.Color(0xeee3cf), 11, 70, 150, 23, 3); break;
    case 'roof': tiles(g, new THREE.Color(0xd0703f), 31); break;
    case 'roofGrey': tiles(g, new THREE.Color(0x9a9088), 37); break;
    case 'wash': wash(g, new THREE.Color(0xffffff), 41); break;
    case 'wood': wood(g, new THREE.Color(0xc08a55), 53); break;
    default: return null;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(kind, t);
  return t;
}
