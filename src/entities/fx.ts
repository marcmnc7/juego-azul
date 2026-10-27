import * as THREE from 'three';

// Partículas sencillas (corazones, tréboles, chispas) con un pool fijo de sprites.
function emojiTexture(ch: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 32, 36);
  const t = new THREE.CanvasTexture(c);
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
  small?: boolean;
}

function dustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(235,220,190,0.9)');
  g.addColorStop(1, 'rgba(235,220,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Gotas de agua: un punto blanco azulado y brillante. */
function sprayTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(225,242,255,0.85)');
  g.addColorStop(1, 'rgba(200,230,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Particles {
  private pool: P[] = [];
  private tex: Record<string, THREE.Texture> = {};

  constructor(parent: THREE.Object3D, size = 60) {
    for (const k of ['❤️', '🍀', '✨', '🍋']) this.tex[k] = emojiTexture(k);
    this.tex.dust = dustTexture();
    this.tex.spray = sprayTexture();
    for (let i = 0; i < size; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex['❤️'], depthWrite: false, transparent: true }));
      s.visible = false;
      parent.add(s);
      this.pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1 });
    }
  }

  burst(at: THREE.Vector3, kind: string, n = 8, spread = 2.5, up = 1) {
    this.tex[kind] ??= emojiTexture(kind);
    for (let i = 0; i < n; i++) {
      const p = this.pool.find((q) => q.life <= 0);
      if (!p) return;
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
        p.v.y -= 2.5 * dt;
        p.s.scale.setScalar(p.spray ? 0.12 + (1 - k) * 0.25 : p.small ? 0.22 + (1 - k) * 0.1 : 0.5 + (1 - k) * 0.3);
        p.s.material.opacity = p.small ? Math.min(0.75, k * 1.5) : Math.min(1, k * 2);
      }
      p.s.position.addScaledVector(p.v, dt);
      if (p.life <= 0) p.s.visible = false;
    }
  }
}
