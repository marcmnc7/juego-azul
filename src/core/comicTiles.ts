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

/**
 * Atlas de puertas y ventanas dibujado (mismas posiciones que la foto de Sponza, ver builder.ts): puerta de
 * arco con su montante de rejilla, ventana de palacio con persianas y ventana de rejas. Marco de piedra,
 * madera verde menorquina, hierro negro, todo con tinta.
 */
function doors(g: CanvasRenderingContext2D) {
  const k = S / 1024;
  const stone = '#e6d7b4', stoneDark = '#c9b48a', wood = '#2f6b52', woodDark = '#214c3a', woodLight = '#3f8a6a', iron = '#16141a', glass = '#33424e';
  g.fillStyle = '#ddd6c8';
  g.fillRect(0, 0, S, S);
  g.lineJoin = 'round';
  const ink = (w = 3) => {
    g.strokeStyle = INK;
    g.lineWidth = w * k * 2;
    g.stroke();
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, fill: string, w = 3) => {
    g.beginPath();
    g.rect(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
    g.fillStyle = fill;
    g.fill();
    ink(w);
  };
  // --- Puerta de arco (4,62)-(505,1000) ---
  {
    const x0 = 4, x1 = 505, y0 = 62, y1 = 1000, cx = (x0 + x1) / 2, r = (x1 - x0) / 2;
    g.beginPath();
    g.moveTo(x0 * k, y1 * k);
    g.lineTo(x0 * k, (y0 + r) * k);
    g.arc(cx * k, (y0 + r) * k, r * k, Math.PI, 0);
    g.lineTo(x1 * k, y1 * k);
    g.closePath();
    g.fillStyle = stone;
    g.fill();
    ink(4);
    // dovelas del arco
    for (let a = 0; a <= 8; a++) {
      const t = Math.PI + (a / 8) * Math.PI;
      g.beginPath();
      g.moveTo((cx + Math.cos(t) * (r - 52)) * k, (y0 + r + Math.sin(t) * (r - 52)) * k);
      g.lineTo((cx + Math.cos(t) * r) * k, (y0 + r + Math.sin(t) * r) * k);
      ink(2);
    }
    // montante (media luna de cristal con rejilla)
    const ir = r - 52, top = y0 + r;
    g.beginPath();
    g.arc(cx * k, top * k, ir * k, Math.PI, 0);
    g.closePath();
    g.fillStyle = glass;
    g.fill();
    ink(3);
    g.save();
    g.clip();
    g.strokeStyle = iron;
    g.lineWidth = 7 * k;
    for (let i = -4; i <= 4; i++) {
      g.beginPath();
      g.moveTo(cx * k, top * k);
      g.lineTo((cx + Math.sin(i * 0.36) * ir * 1.2) * k, (top - Math.cos(i * 0.36) * ir * 1.2) * k);
      g.stroke();
    }
    g.beginPath();
    g.arc(cx * k, top * k, ir * 0.45 * k, Math.PI, 0);
    g.stroke();
    g.restore();
    // hojas de la puerta
    const dx0 = x0 + 52, dx1 = x1 - 52, dy0 = top + 14, dy1 = y1;
    rect(dx0, dy0, dx1, dy1, wood, 4);
    const mid = (dx0 + dx1) / 2;
    g.beginPath();
    g.moveTo(mid * k, dy0 * k);
    g.lineTo(mid * k, dy1 * k);
    ink(3);
    for (const [a, b] of [[dx0, mid], [mid, dx1]])
      for (const [p, q] of [[dy0 + 40, dy0 + (dy1 - dy0) * 0.45], [dy0 + (dy1 - dy0) * 0.52, dy1 - 50]]) {
        rect(a + 32, p, b - 32, q, woodDark, 2.5);
        g.fillStyle = woodLight;
        g.fillRect((a + 32) * k, p * k, (b - a - 64) * k, 10 * k);
      }
    // aldaba
    g.beginPath();
    g.arc((mid + 40) * k, (dy0 + (dy1 - dy0) * 0.48) * k, 16 * k, 0, Math.PI * 2);
    g.fillStyle = '#c9a24a';
    g.fill();
    ink(2);
  }
  // --- Ventana de palacio (510,6)-(928,588) ---
  {
    const x0 = 510, x1 = 928, y0 = 6, y1 = 588;
    rect(x0, y0 + 40, x1, y1, stone, 4);
    rect(x0 - 2, y0, x1 + 2, y0 + 56, stoneDark, 3); // cornisa
    const ix0 = x0 + 50, ix1 = x1 - 50, iy0 = y0 + 100, iy1 = y1 - 40;
    rect(ix0, iy0, ix1, iy1, wood, 4);
    const mid = (ix0 + ix1) / 2;
    g.beginPath();
    g.moveTo(mid * k, iy0 * k);
    g.lineTo(mid * k, iy1 * k);
    ink(3);
    // lamas de persiana mallorquina
    for (let y = iy0 + 24; y < iy1 - 10; y += 26) {
      for (const [a, b] of [[ix0, mid], [mid, ix1]]) {
        g.fillStyle = woodLight;
        g.fillRect((a + 16) * k, y * k, (b - a - 32) * k, 9 * k);
        g.fillStyle = woodDark;
        g.fillRect((a + 16) * k, (y + 9) * k, (b - a - 32) * k, 6 * k);
      }
    }
    rect(x0 - 10, y1 - 40, x1 + 10, y1, stoneDark, 3); // alféizar
  }
  // --- Ventana de rejas (507,600)-(870,1012) ---
  {
    const x0 = 507, x1 = 870, y0 = 600, y1 = 1012;
    rect(x0, y0, x1, y1, stone, 4);
    const ix0 = x0 + 46, ix1 = x1 - 46, iy0 = y0 + 46, iy1 = y1 - 56;
    rect(ix0, iy0, ix1, iy1, glass, 3);
    // un poco de reflejo en el cristal, en diagonal
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo((ix0 + 30) * k, iy1 * k);
    g.lineTo((ix0 + 120) * k, iy1 * k);
    g.lineTo((ix1 - 30) * k, (iy0 + 60) * k);
    g.lineTo((ix1 - 30) * k, iy0 * k);
    g.closePath();
    g.fill();
    g.fillStyle = iron;
    for (let x = ix0 + 22; x < ix1 - 10; x += 38) g.fillRect(x * k, (iy0 - 6) * k, 10 * k, (iy1 - iy0 + 12) * k);
    for (const y of [iy0 + (iy1 - iy0) * 0.33, iy0 + (iy1 - iy0) * 0.66]) g.fillRect((ix0 - 6) * k, y * k, (ix1 - ix0 + 12) * k, 10 * k);
    rect(x0 - 10, y1 - 56, x1 + 10, y1 - 20, stoneDark, 3);
  }
}

// ---------- Superficies del decorado (ver comicSurfaces.ts) ----------
// Mismo trazo que las de arriba, para lo que se construye con Merger: asfalto, hierba, adoquín, piedra seca…

/** Manchas planas (sin degradado) de un tono un poco más claro u oscuro. */
function patches(g: CanvasRenderingContext2D, base: THREE.Color, r: () => number, n: number, k: number, size: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rx = size * (0.5 + r()), ry = size * (0.3 + r() * 0.5), rot = r() * 3;
    const kk = k > 1 ? 1 + (k - 1) * (0.5 + r() * 0.5) : 1 - (1 - k) * (0.5 + r() * 0.5);
    wrapDraw((dx, dy) => {
      g.fillStyle = css(base, kk);
      g.beginPath();
      g.ellipse(x + dx, y + dy, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    });
  }
}
function dots(g: CanvasRenderingContext2D, base: THREE.Color, r: () => number, n: number, k: number, r0: number, r1: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = r0 + r() * (r1 - r0);
    wrapDraw((dx, dy) => {
      g.fillStyle = css(base, k);
      g.beginPath();
      g.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
      g.fill();
    });
  }
}
/** Grieta o trazo corto de plumilla. */
function strokes(g: CanvasRenderingContext2D, r: () => number, n: number, style: string, w: number, len: number, segs = 3) {
  for (let i = 0; i < n; i++) {
    const pts = [[r() * S, r() * S]];
    const a0 = r() * Math.PI * 2;
    for (let s = 0; s < segs; s++) {
      const a = a0 + (r() - 0.5) * 1.2;
      pts.push([pts[s][0] + Math.cos(a) * len * (0.5 + r()), pts[s][1] + Math.sin(a) * len * (0.5 + r())]);
    }
    wrapDraw((dx, dy) => {
      g.strokeStyle = style;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(pts[0][0] + dx, pts[0][1] + dy);
      for (const q of pts.slice(1)) g.lineTo(q[0] + dx, q[1] + dy);
      g.stroke();
    });
  }
}

function asphalt(g: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed), base = new THREE.Color(0x9a9a9e);
  g.fillStyle = css(base);
  g.fillRect(0, 0, S, S);
  patches(g, base, r, 9, 0.93, 60);
  patches(g, base, r, 5, 1.05, 40);
  dots(g, base, r, 420, 0.82, 0.8, 1.8);
  dots(g, base, r, 160, 1.12, 0.8, 1.5);
  strokes(g, r, 5, INK, 1.4, 14);
}

function grass(g: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed), base = new THREE.Color(0x7fb05a);
  g.fillStyle = css(base);
  g.fillRect(0, 0, S, S);
  patches(g, base, r, 10, 0.88, 55);
  patches(g, base, r, 8, 1.08, 45);
  // matas: una uve de tres trazos, oscura, y alguna clara al lado
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, h = 6 + r() * 7, dark = r() < 0.75;
    wrapDraw((dx, dy) => {
      g.strokeStyle = dark ? css(base, 0.55) : css(base, 1.2);
      g.lineWidth = dark ? 1.6 : 1.3;
      g.lineCap = 'round';
      g.beginPath();
      for (const a of [-0.45, 0, 0.45]) {
        g.moveTo(x + dx, y + dy);
        g.lineTo(x + dx + Math.sin(a) * h, y + dy - Math.cos(a) * h);
      }
      g.stroke();
    });
  }
}

/** Baldosas cuadradas en retícula (barro, gres). */
function pavers(g: CanvasRenderingContext2D, base: THREE.Color, n: number, seed: number) {
  const r = rng(seed), w = S / n;
  g.fillStyle = INK;
  g.fillRect(0, 0, S, S);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const c = base.clone().multiplyScalar(0.93 + r() * 0.12);
      const X0 = i * w + 1.8, Y0 = j * w + 1.8, X1 = (i + 1) * w - 1.8, Y1 = (j + 1) * w - 1.8;
      g.fillStyle = css(c);
      g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      g.fillStyle = css(c, 1.07);
      g.fillRect(X0, Y0, X1 - X0, w * 0.06);
      g.fillStyle = css(c, 0.85);
      g.fillRect(X0, Y1 - w * 0.08, X1 - X0, w * 0.08);
      if (r() < 0.2) {
        const px = X0 + 8 + r() * (w - 20), py = Y0 + 8 + r() * (w - 20);
        g.strokeStyle = css(c, 0.66);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + 6 + r() * 8, py + (r() - 0.5) * 8);
        g.stroke();
      }
    }
}

/** Adoquín: piedras redondeadas en hileras al tresbolillo. */
function cobble(g: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed), base = new THREE.Color(0xb4b0a8);
  const rows = 10, rh = S / rows;
  g.fillStyle = '#4a4038';
  g.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const cols = 9, cw = S / cols, off = (row % 2) * cw * 0.5;
    for (let c = 0; c < cols; c++) {
      const col = base.clone().multiplyScalar(0.88 + r() * 0.2);
      const x = c * cw + off + 2.5, y = row * rh + 2.5, w = cw - 5 - r() * 3, h = rh - 5 - r() * 2;
      wrapDraw((dx) => {
        g.fillStyle = css(col);
        g.beginPath();
        g.roundRect(x + dx, y, w, h, 9);
        g.fill();
        g.fillStyle = css(col, 1.1);
        g.fillRect(x + dx + 6, y + 3, w - 12, h * 0.16);
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(x + dx, y, w, h, 9);
        g.stroke();
      });
    }
  }
}

function sand(g: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed), base = new THREE.Color(0xe2cfa2);
  g.fillStyle = css(base);
  g.fillRect(0, 0, S, S);
  patches(g, base, r, 8, 0.95, 70);
  dots(g, base, r, 700, 0.84, 0.7, 1.4);
  dots(g, base, r, 250, 1.08, 0.7, 1.3);
  // ondas del viento: trazos suaves y largos
  for (let i = 0; i < 9; i++) {
    const y = r() * S, x = r() * S, len = 60 + r() * 90;
    wrapDraw((dx, dy) => {
      g.strokeStyle = css(base, 0.86);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.bezierCurveTo(x + dx + len * 0.3, y + dy - 5, x + dx + len * 0.6, y + dy + 5, x + dx + len, y + dy);
      g.stroke();
    });
  }
}

/** Piedra seca (paret seca menorquina): piedras irregulares con mucha junta oscura y contorno gordo. */
function drystone(g: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed), base = new THREE.Color(0xc4b8a2);
  g.fillStyle = '#4a3f36';
  g.fillRect(0, 0, S, S);
  const n = 8, cell = S / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * cell + (r() - 0.5) * cell * 0.3, cy = (j + 0.5) * cell + (r() - 0.5) * cell * 0.25;
      const k = 6 + Math.floor(r() * 3);
      const pts: [number, number][] = [];
      for (let p = 0; p < k; p++) {
        const a = (p / k) * Math.PI * 2 + (r() - 0.5) * 0.4;
        const rad = cell * (0.42 + r() * 0.16);
        pts.push([cx + Math.cos(a) * rad * 1.15, cy + Math.sin(a) * rad * 0.85]);
      }
      const col = base.clone().multiplyScalar(0.84 + r() * 0.24);
      wrapDraw((dx, dy) => {
        g.beginPath();
        g.moveTo(pts[0][0] + dx, pts[0][1] + dy);
        for (const q of pts.slice(1)) g.lineTo(q[0] + dx, q[1] + dy);
        g.closePath();
        g.fillStyle = css(col);
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = css(col, 1.1);
        g.beginPath();
        g.ellipse(cx + dx - cell * 0.06, cy + dy - cell * 0.14, cell * 0.2, cell * 0.06, 0, 0, Math.PI * 2);
        g.fill();
      });
    }
}

/** Persiana de lamas: franjas horizontales con su luz arriba, sombra abajo y una línea de tinta. */
function louvre(g: CanvasRenderingContext2D) {
  const base = new THREE.Color(0xd8d8d8), n = 16, h = S / n;
  for (let i = 0; i < n; i++) {
    const y = i * h;
    g.fillStyle = css(base);
    g.fillRect(0, y, S, h);
    g.fillStyle = css(base, 1.12);
    g.fillRect(0, y, S, h * 0.25);
    g.fillStyle = css(base, 0.7);
    g.fillRect(0, y + h * 0.72, S, h * 0.28);
    g.fillStyle = INK;
    g.fillRect(0, y + h - 2, S, 2);
  }
}

function bark(g: CanvasRenderingContext2D, seed: number) {
  const r = rng(seed), base = new THREE.Color(0xa08060);
  g.fillStyle = css(base);
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) {
    const x = r() * S, len = 50 + r() * 120, y = r() * S;
    wrapDraw((dx, dy) => {
      g.strokeStyle = r() < 0.7 ? css(base, 0.6) : INK;
      g.lineWidth = 1.6 + r() * 1.4;
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.bezierCurveTo(x + dx + 4, y + dy + len * 0.3, x + dx - 4, y + dy + len * 0.6, x + dx + 2, y + dy + len);
      g.stroke();
    });
  }
}

/** Lienzo de 512 px con el dibujo de una superficie del decorado (o null si va lisa). */
export function comicSurfaceCanvas(kind: string): HTMLCanvasElement | null {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  switch (kind) {
    case 'wash': wash(g, new THREE.Color(0xffffff), 41); break;
    case 'roof': tiles(g, new THREE.Color(0xd0703f), 31); break;
    case 'mares': blocks(g, new THREE.Color(0xeee3cf), 11, 70, 150, 23, 3); break;
    case 'stone': blocks(g, new THREE.Color(0xc9c2b4), 7, 80, 190, 61, 4); break;
    case 'asphalt': asphalt(g, 71); break;
    case 'wood': wood(g, new THREE.Color(0xc08a55), 53); break;
    case 'grass': grass(g, 83); break;
    case 'louvre': louvre(g); break;
    case 'slabs': blocks(g, new THREE.Color(0xe6d3aa), 6, 95, 165, 11, 4); break;
    case 'terracotta': pavers(g, new THREE.Color(0xd9a07a), 6, 91); break;
    case 'sand': sand(g, 97); break;
    case 'cobble': cobble(g, 101); break;
    case 'drystone': drystone(g, 107); break;
    case 'bark': bark(g, 113); break;
    default: return null;
  }
  return cv;
}

// ---------- Luces y cielo de noche ----------

let halo: THREE.CanvasTexture | null = null;
/**
 * Luz de tebeo (farolas, ventanas, luciérnagas de noche): núcleo blanco con su aro de tinta y dos anillos planos
 * del color de la luz alrededor, en vez de un halo borroso. El color del material la tiñe.
 */
export function comicHaloTexture() {
  if (halo) return halo;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const ring = (rad: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(64, 64, rad, 0, Math.PI * 2);
    g.fill();
  };
  ring(62, 'rgba(255,255,255,0.16)');
  ring(44, 'rgba(255,255,255,0.32)');
  ring(20, '#ffffff');
  g.strokeStyle = 'rgba(43,34,51,0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 21, 0, Math.PI * 2);
  g.stroke();
  halo = new THREE.CanvasTexture(cv);
  halo.colorSpace = THREE.SRGBColorSpace;
  return halo;
}

let moon: THREE.CanvasTexture | null = null;
/** Luna de tebeo: disco crema plano con tres cráteres, contorno de tinta y un anillo de luz plano. */
export function comicMoonTexture() {
  if (moon) return moon;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = 'rgba(255,248,220,0.14)';
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fbf3d6';
  g.beginPath();
  g.arc(128, 128, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e6dab0';
  for (const [x, y, rad] of [[104, 108, 15], [150, 140, 11], [122, 160, 8]]) {
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#2b2233';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(128, 128, 70, 0, Math.PI * 2);
  g.stroke();
  moon = new THREE.CanvasTexture(cv);
  moon.colorSpace = THREE.SRGBColorSpace;
  return moon;
}

let star: THREE.CanvasTexture | null = null;
/** Estrella de cinco puntas dibujada, con contorno de tinta. El color del material la tiñe. */
export function comicStarTexture() {
  if (star) return star;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? 24 : 56;
    g.lineTo(64 + Math.cos(a) * rad, 66 + Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.strokeStyle = '#2b2233';
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.stroke();
  star = new THREE.CanvasTexture(cv);
  star.colorSpace = THREE.SRGBColorSpace;
  return star;
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
    case 'doors': doors(g); break;
    default: return null;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(kind, t);
  return t;
}
