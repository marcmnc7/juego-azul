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
}

export class Particles {
  private pool: P[] = [];
  private tex: Record<string, THREE.Texture> = {};

  constructor(parent: THREE.Object3D, size = 40) {
    for (const k of ['❤️', '🍀', '✨', '🍋']) this.tex[k] = emojiTexture(k);
    for (let i = 0; i < size; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex['❤️'], depthWrite: false, transparent: true }));
      s.visible = false;
      parent.add(s);
      this.pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1 });
    }
  }

  burst(at: THREE.Vector3, kind: '❤️' | '🍀' | '✨' | '🍋', n = 8, spread = 2.5) {
    for (let i = 0; i < n; i++) {
      const p = this.pool.find((q) => q.life <= 0);
      if (!p) return;
      p.s.material.map = this.tex[kind];
      p.s.position.copy(at);
      p.v.set((Math.random() - 0.5) * spread, 2 + Math.random() * 2.5, (Math.random() - 0.5) * spread);
      p.max = p.life = 1.2 + Math.random() * 0.6;
      p.s.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 2.5 * dt;
      p.s.position.addScaledVector(p.v, dt);
      const k = p.life / p.max;
      p.s.scale.setScalar(0.5 + (1 - k) * 0.3);
      p.s.material.opacity = Math.min(1, k * 2);
      if (p.life <= 0) p.s.visible = false;
    }
  }
}
