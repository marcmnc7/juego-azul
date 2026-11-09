import * as THREE from 'three';

// Partículas sencillas (corazones, tréboles, chispas) con un pool fijo de sprites.
function heart(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.1, x, y - r * 0.35);
  c.bezierCurveTo(x + r * 0.75, y - r * 1.1, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  c.fill();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, R: number, r: number, n: number, fill: string, rot = 0) {
  c.fillStyle = fill;
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2, q = i % 2 ? r : R;
    c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  c.closePath();
  c.fill();
}

/** Dibujos propios para las partículas: los emojis cambian de un móvil a otro y se ven pegados en el 3D. */
const PAINT: Record<string, (c: CanvasRenderingContext2D) => void> = {
  '❤️': (c) => {
    heart(c, 64, 62, 42, '#e8294f');
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath();
    c.ellipse(44, 44, 10, 6, -0.7, 0, 7);
    c.fill();
  },
  '✨': (c) => {
    // destello de tebeo: estrella de cuatro puntas plana (sin halo borroso)
    star(c, 64, 64, 56, 12, 4, '#fff1a8');
    star(c, 64, 64, 30, 8, 4, '#ffffff');
  },
  '🍀': (c) => {
    c.strokeStyle = '#2c7a34';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(64, 66);
    c.quadraticCurveTo(70, 96, 84, 112);
    c.stroke();
    for (const [dx, dy, a] of [[0, -22, 0], [24, 0, Math.PI / 2], [0, 22, Math.PI], [-24, 0, -Math.PI / 2]] as const) {
      c.save();
      c.translate(64 + dx, 62 + dy);
      c.rotate(a);
      heart(c, 0, 0, 22, '#3fa648');
      c.restore();
    }
  },
  '🍋': (c) => {
    c.fillStyle = '#f4d43a';
    c.beginPath();
    c.ellipse(64, 66, 44, 32, -0.35, 0, 7);
    c.fill();
    c.beginPath();
    c.ellipse(108, 50, 10, 7, -0.35, 0, 7);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.beginPath();
    c.ellipse(50, 54, 14, 7, -0.35, 0, 7);
    c.fill();
  },
  '💥': (c) => {
    star(c, 64, 64, 60, 26, 9, '#ff8a1e', 0.2);
    star(c, 64, 64, 36, 16, 9, '#ffe066', 0.5);
  },
  '💨': (c) => {
    c.fillStyle = 'rgba(240,244,248,.9)';
    for (const [x, y, r] of [[40, 70, 24], [70, 58, 30], [96, 74, 20]] as const) {
      c.beginPath();
      c.arc(x, y, r, 0, 7);
      c.fill();
    }
  },
  '⚡': (c) => {
    c.fillStyle = '#ffd92e';
    c.beginPath();
    for (const [x, y] of [[74, 6], [28, 72], [60, 72], [46, 122], [100, 50], [66, 50]] as const) c.lineTo(x, y);
    c.closePath();
    c.fill();
  },
  '📍': (c) => {
    c.fillStyle = '#e0303e';
    c.beginPath();
    c.arc(64, 46, 34, Math.PI * 0.85, Math.PI * 0.15);
    c.lineTo(64, 120);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(64, 46, 13, 0, 7);
    c.fill();
  },
  '🧳': (c) => {
    c.fillStyle = '#8a5a34';
    c.fillRect(26, 44, 76, 66);
    c.fillStyle = '#5e3c20';
    c.fillRect(26, 62, 76, 6);
    c.fillRect(26, 88, 76, 6);
    c.strokeStyle = '#3a2a20';
    c.lineWidth = 8;
    c.strokeRect(50, 24, 28, 20);
  },
  '🎵': (c) => {
    c.fillStyle = '#ff5fa8';
    c.beginPath();
    c.ellipse(46, 98, 20, 15, -0.3, 0, 7);
    c.fill();
    c.fillRect(60, 22, 8, 76);
    c.beginPath();
    c.moveTo(68, 22);
    c.quadraticCurveTo(100, 34, 92, 66);
    c.quadraticCurveTo(88, 46, 68, 44);
    c.fill();
  },
};
PAINT['🎶'] = PAINT['🎵'];
PAINT['📸'] = PAINT['📷'] = PAINT['✨'];

/**
 * Contorno de tinta alrededor de un dibujo (como una pegatina de tebeo): la silueta, en tinta, desplazada en
 * todas direcciones por detrás del dibujo.
 */
function inkOutline(src: HTMLCanvasElement, px = 5) {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext('2d')!;
  const sil = document.createElement('canvas');
  sil.width = src.width;
  sil.height = src.height;
  const sg = sil.getContext('2d')!;
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = '#2b2233';
  sg.fillRect(0, 0, sil.width, sil.height);
  for (let a = 0; a < 16; a++) g.drawImage(sil, Math.cos((a / 16) * Math.PI * 2) * px, Math.sin((a / 16) * Math.PI * 2) * px);
  g.drawImage(src, 0, 0);
  return out;
}

function emojiTexture(ch: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const paint = PAINT[ch];
  // (un poco más pequeño que el lienzo: el contorno de tinta tiene que caber)
  ctx.translate(64, 64);
  ctx.scale(0.88, 0.88);
  ctx.translate(-64, -64);
  if (paint) paint(ctx);
  else {
    ctx.font = '104px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 64, 72);
  }
  const t = new THREE.CanvasTexture(inkOutline(c));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface P {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
  dust?: boolean;
  spray?: boolean;
  drop?: boolean;
  small?: boolean;
}

/** Polvo: una nubecilla de tebeo (tres bolas planas color arena con su contorno). */
function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ebdcbe';
  for (const [x, y, r] of [[22, 36, 13], [36, 28, 15], [44, 40, 11]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(inkOutline(c, 2.5));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Gotas de agua: una gota de tebeo, blanca azulada con su brillo y su contorno de tinta. */
function sprayTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d4ecff';
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(13, 13, 3.5, 0, 7);
  ctx.fill();
  const t = new THREE.CanvasTexture(inkOutline(c, 2));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Texturas compartidas por todas las partículas del juego (una por emoji). Antes cada capítulo creaba las
// suyas y las que no estaban en uso al salir nunca se liberaban: la memoria de vídeo crecía sin parar
const TEX: Record<string, THREE.Texture> = {};

export class Particles {
  private pool: P[] = [];
  private tex = TEX;

  constructor(parent: THREE.Object3D, size = 60) {
    for (const k of ['❤️', '🍀', '✨', '🍋']) this.tex[k] ??= emojiTexture(k);
    this.tex.dust ??= dustTexture();
    this.tex.spray ??= sprayTexture();
    for (let i = 0; i < size; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex['❤️'], depthWrite: false, transparent: true }));
      s.visible = false;
      parent.add(s);
      this.pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1 });
    }
  }

  burst(at: THREE.Vector3, kind: string, n = 8, spread = 2.5, up = 1) {
    const drop = kind === 'drop'; // gotitas finas (la piscina): como 'spray', pero del tamaño de una gota
    if (drop) kind = 'spray';
    this.tex[kind] ??= emojiTexture(kind);
    for (let i = 0; i < n; i++) {
      const p = this.pool.find((q) => q.life <= 0);
      if (!p) return;
      p.drop = drop;
      p.s.material.map = this.tex[kind];
      p.s.position.copy(at);
      p.v.set((Math.random() - 0.5) * spread, (2 + Math.random() * 2.5) * up, (Math.random() - 0.5) * spread);
      p.dust = kind === 'dust';
      p.spray = kind === 'spray';
      p.small = kind === '🎵' || kind === '🎶';
      p.max = p.life = 1.2 + Math.random() * 0.6;
      p.s.visible = true;
    }
  }

  /** Chorro de pistola de agua: gotas en línea que salen en `dir` y caen en arco. */
  jet(at: THREE.Vector3, dir: THREE.Vector3, n = 14, speed = 7) {
    for (let i = 0; i < n; i++) {
      const p = this.pool.find((q) => q.life <= 0);
      if (!p) return;
      p.s.material.map = this.tex.spray;
      p.s.position.copy(at).addScaledVector(dir, i * 0.04);
      const sp = speed * (0.85 + Math.random() * 0.3);
      p.v.copy(dir).multiplyScalar(sp).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
      p.dust = p.small = p.drop = false;
      p.spray = true;
      // Las gotas del final salen más tarde: un chorro, no una nube
      p.max = p.life = 0.7 + i * 0.03;
      p.s.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = p.life / p.max;
      if (p.dust) {
        p.v.multiplyScalar(1 - dt * 3);
        p.s.scale.setScalar(0.6 + (1 - k) * 1.6);
        p.s.material.opacity = k * 0.7;
      } else {
        p.v.y -= (p.spray ? 7 : 2.5) * dt;
        p.s.scale.setScalar(p.drop ? 0.035 + (1 - k) * 0.03 : p.spray ? 0.12 + (1 - k) * 0.25 : p.small ? 0.22 + (1 - k) * 0.1 : 0.5 + (1 - k) * 0.3);
        p.s.material.opacity = p.small ? Math.min(0.75, k * 1.5) : Math.min(1, k * 2);
      }
      p.s.position.addScaledVector(p.v, dt);
      if (p.life <= 0) p.s.visible = false;
    }
  }
}
