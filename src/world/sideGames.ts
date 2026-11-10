import * as THREE from 'three';
import { audio } from '../core/audio';
import { cinema } from '../core/cinema';
import { Sky, Sun, settleAmbient, applyShadows, glowTexture, makeSea, vibrate } from '../core/gfx';
import { steerTo, type SteerState } from '../core/steer';
import type { Walker } from '../core/walker';
import { MARC_LOOK, MARGAUX_LOOK } from '../data/characters';
import { SIDE } from '../data/story';
import { twoBone } from '../entities/embrace';
import type { Particles } from '../entities/fx';
import { G, Merger, animatePerson, makePerson, type Person, type PersonLook } from '../entities/models';
import { rigPost } from '../entities/rig';
import { bark, comicWord, dialogue, later, timingGauge, toast } from '../ui/ui';
import type { Box2 } from './ferreries';

// Los minijuegos que hay que pasar para seguir con la historia. Fallar nunca hace perder: se repite ahí mismo.

const uiRoot = () => document.getElementById('ui')!;
const el = (tag: string, cls: string, text = '') => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Gotas de agua (o lo que sea) con su gravedad: un solo dibujado para todas. */
class Droplets {
  private im: THREE.InstancedMesh;
  private list: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }[] = [];
  private m = new THREE.Matrix4();
  constructor(sc: THREE.Scene, private cap = 160) {
    this.im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xc8eeff, transparent: true, opacity: 0.9 }), cap);
    this.im.frustumCulled = false;
    this.im.count = 0;
    this.im.userData.noCast = true;
    sc.add(this.im);
  }
  /** Chorro de `from` a `to`, que tarda `time` segundos en llegar. */
  jet(from: THREE.Vector3, to: THREE.Vector3, time: number, n = 16) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.cap) this.list.shift();
      const t = time * (0.9 + Math.random() * 0.2);
      const k = i / n;
      this.list.push({
        x: from.x, y: from.y, z: from.z,
        vx: (to.x - from.x) / t + (Math.random() - 0.5) * 0.9,
        vy: (to.y - from.y) / t + 4.9 * t + (Math.random() - 0.5) * 0.7,
        vz: (to.z - from.z) / t + (Math.random() - 0.5) * 0.9,
        life: t + 0.3 - k * 0.1,
      });
    }
  }
  update(dt: number) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i];
      d.life -= dt;
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.life <= 0 || d.y < 0.02) L.splice(i, 1);
    }
    this.im.count = L.length;
    L.forEach((d, i) => this.im.setMatrixAt(i, this.m.makeTranslation(d.x, d.y, d.z)));
    this.im.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.im.removeFromParent();
  }
}

// ---------------- Capítulo 1: guerra de pistolas de agua ----------------

const KIDS: PersonLook[] = [
  { skin: 0xf0c8a6, shirt: 0xe2547a, pants: 0x3b4a6b, hair: 0x6b3f22, hairStyle: 'pony', shorts: true },
  { skin: 0xe2b08c, shirt: 0x3cc6b0, pants: 0x2d2d3a, hair: 0x2b1d14, hairStyle: 'short', male: true, shorts: true },
  { skin: 0xf3d2b6, shirt: 0xf4c95d, pants: 0x3b4a6b, hair: 0xa8743c, hairStyle: 'short', male: true, shorts: true },
  { skin: 0xd9a27c, shirt: 0x5aa9e6, pants: 0x6f8fb8, hair: 0x1f1610, hairStyle: 'long', shorts: true },
  { skin: 0xf0c8a6, shirt: 0xf26b3a, pants: 0x2d2d3a, hair: 0x4a2c18, hairStyle: 'short', male: true, shorts: true },
];
const WET_NEED = 2;

let warnTex: THREE.CanvasTexture | null = null;
/** El «!» de tebeo de un crío que va a disparar (disco amarillo con su aro de tinta, como el de los burros). */
function warnTexture() {
  if (warnTex) return warnTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#2a1a2e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a2e';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 70);
  warnTex = new THREE.CanvasTexture(c);
  warnTex.colorSpace = THREE.SRGBColorSpace;
  return warnTex;
}

function toyGun(c: number) {
  return new Merger(false)
    .add(G.rbox, c, 0, 0, 0.05, 0, 0, 0, 0.05, 0.08, 0.2)
    .add(G.rbox, 0xffd23f, 0, 0.055, 0.03, 0, 0, 0, 0.09, 0.05, 0.09)
    .add(G.rbox, 0x2a7ac8, 0, -0.06, -0.015, 0, 0, 0, 0.038, 0.1, 0.05)
    .mesh();
}

export class WaterFight {
  private kids: { p: Person; st: SteerState; goal: THREE.Vector3; goalT: number; wet: number; fireT: number; warn: number; out: boolean; flinch: number; alert: THREE.Sprite }[] = [];
  private drops: Droplets;
  private cool = 0;
  private armT = 0;
  private gun: THREE.Object3D;
  private pending: { t: number; run: () => void }[] = [];
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  soaked = 0;
  out = 0;
  finished = false;

  constructor(sc: THREE.Scene, private player: Person, private walker: Walker, private fx: Particles, private colliders: readonly Box2[], private people: readonly { x: number; z: number; r: number }[], private zone: Box2, private onChange: () => void, private onDone: () => void) {
    this.drops = new Droplets(sc);
    this.gun = toyGun(0x2fb24a);
    this.gun.position.set(0, -0.05, 0.05);
    player.handR.add(this.gun);
    KIDS.forEach((look, i) => {
      // (un niño de verdad, no un adulto encogido)
      const p = makePerson({ ...look, kid: true });
      const x = zone.minX + ((i + 0.5) / KIDS.length) * (zone.maxX - zone.minX);
      p.root.position.set(x, 0, (i % 2 ? 1 : -1) * 1.4);
      const g = toyGun(i % 2 ? 0xe2547a : 0x3b7bd8);
      g.position.set(0, -0.05, 0.05);
      p.handR.add(g);
      sc.add(p.root);
      // (el aviso de que va a disparar: un «!» de tebeo encima de la cabeza; antes, el emoji del sistema)
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: warnTexture(), depthTest: false, transparent: true }));
      alert.scale.setScalar(0.55);
      alert.renderOrder = 5;
      alert.visible = false;
      sc.add(alert);
      this.kids.push({ p, st: {}, goal: p.root.position.clone(), goalT: 0, wet: 0, fireT: 1.6 + i * 0.7, warn: 0, out: false, flinch: 0, alert });
    });
  }

  /** El crío que hay que perseguir. */
  nearest() {
    const pp = this.player.root.position;
    let best: THREE.Vector3 | null = null, bd = 1e9;
    for (const k of this.kids) {
      if (k.out) continue;
      const d = k.p.root.position.distanceTo(pp);
      if (d < bd) {
        bd = d;
        best = k.p.root.position;
      }
    }
    return best;
  }

  shoot() {
    if (this.cool > 0 || this.finished) return;
    this.cool = 0.32;
    this.armT = 0.5;
    const pp = this.player.root.position;
    // Apunta sola al que tiene delante, si lo hay
    let target: (typeof this.kids)[number] | null = null;
    let score = 1e9;
    for (const k of this.kids) {
      if (k.out) continue;
      const q = k.p.root.position;
      const d = Math.hypot(q.x - pp.x, q.z - pp.z);
      const ang = Math.abs(wrap(Math.atan2(q.x - pp.x, q.z - pp.z) - this.walker.facing));
      if (d > 7.5 || ang > 0.75) continue;
      if (d + ang * 2 < score) {
        score = d + ang * 2;
        target = k;
      }
    }
    if (target) this.walker.facing = Math.atan2(target.p.root.position.x - pp.x, target.p.root.position.z - pp.z);
    const f = this.v1.set(Math.sin(this.walker.facing), 0, Math.cos(this.walker.facing));
    const from = this.v2.copy(pp).addScaledVector(f, 0.45).setY(1.22).clone();
    const to = target ? target.p.root.position.clone().setY(0.85) : pp.clone().addScaledVector(f, 7).setY(0.3);
    const time = Math.max(0.16, from.distanceTo(to) / 15);
    this.drops.jet(from, to, time, 20);
    audio.knock(0.25, 1400, 0.06);
    if (target) {
      const k = target;
      const moved = k.p.root.position.clone();
      this.pending.push({
        t: time,
        run: () => {
          // Si se ha apartado mucho, falla
          if (k.out || k.p.root.position.distanceTo(moved) > 1.15) return;
          k.wet++;
          k.flinch = 0.5;
          this.fx.burst(k.p.root.position.clone().setY(1), 'spray', 10, 1.6, 0.8);
          audio.pop();
          vibrate(18);
          if (k.wet >= WET_NEED) {
            k.out = true;
            this.out++;
            audio.luck();
            // (los toast no se ven en el cómic: la cuenta, como onomatopeya; el contador del HUD dice cuántos)
            comicWord(SIDE.water.out[Math.min(this.out - 1, SIDE.water.out.length - 1)], 'splash');
            this.onChange();
            if (this.out >= KIDS.length) this.finish();
          }
        },
      });
    }
  }

  private finish() {
    this.finished = true;
    this.gun.removeFromParent();
    dialogue(SIDE.water.end, () => {
      this.onDone();
    });
  }

  update(dt: number, busy: boolean) {
    this.cool -= dt;
    this.drops.update(dt);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].t -= dt;
      if (this.pending[i].t <= 0) {
        const r = this.pending[i].run;
        this.pending.splice(i, 1);
        r();
      }
    }
    const pp = this.player.root.position;
    for (const k of this.kids) {
      const r = k.p.root;
      k.flinch -= dt;
      k.alert.visible = k.warn > 0 && !k.out && !busy;
      if (k.alert.visible) {
        k.p.head.getWorldPosition(k.alert.position);
        k.alert.position.y += 0.55;
        k.alert.scale.setScalar(0.5 + Math.abs(Math.sin(k.warn * 18)) * 0.12);
      }
      if (k.out) {
        // Rendido: se aparta a un lado, celebrando que le han mojado
        animatePerson(k.p, dt, 'cheer');
        r.rotation.y = Math.atan2(pp.x - r.position.x, pp.z - r.position.z);
        continue;
      }
      if (busy) {
        animatePerson(k.p, dt, 'idle');
        continue;
      }
      const d = Math.hypot(pp.x - r.position.x, pp.z - r.position.z);
      k.goalT -= dt;
      if (k.goalT <= 0 || (d < 3 && k.goalT < 0.9)) {
        k.goalT = 1 + Math.random() * 1.2;
        const z = this.zone;
        // Si te acercas, corren en dirección contraria; si no, van a su aire
        const a = d < 4.5 ? Math.atan2(r.position.x - pp.x, r.position.z - pp.z) + (Math.random() - 0.5) * 1.3 : Math.random() * 6.28;
        k.goal.set(THREE.MathUtils.clamp(r.position.x + Math.sin(a) * 4, z.minX, z.maxX), 0, THREE.MathUtils.clamp(r.position.z + Math.cos(a) * 3, z.minZ, z.maxZ));
      }
      if (k.warn > 0) {
        // A punto de disparar: se para y te apunta (se ve venir)
        k.warn -= dt;
        r.rotation.y = Math.atan2(pp.x - r.position.x, pp.z - r.position.z);
        animatePerson(k.p, dt, 'idle');
        k.p.armR.rotation.x = -1.4;
        if (k.warn <= 0) {
          const from = r.position.clone().setY(0.92);
          const land = pp.clone().setY(0.9);
          this.drops.jet(from, land, 0.5, 18);
          audio.knock(0.18, 1300, 0.06);
          this.pending.push({
            t: 0.5,
            run: () => {
              if (Math.hypot(pp.x - land.x, pp.z - land.z) > 1) return;
              this.soaked++;
              this.walker.shake(0.22);
              this.fx.burst(pp.clone().setY(1.5), 'spray', 10, 1.6, 0.8);
              audio.hit();
              vibrate(40);
              comicWord(SIDE.water.soaked, 'splash');
            },
          });
          k.fireT = 2.4 + Math.random() * 2.4;
        }
        continue;
      }
      k.fireT -= dt;
      if (k.fireT <= 0 && d < 8) k.warn = 0.65;
      steerTo(r, k.st, k.goal.x, k.goal.z, 3.1, dt, this.people as never, 6, 0.26, undefined, this.colliders as Box2[]);
      animatePerson(k.p, dt, 'walk', 0.9);
    }
  }

  /** La pose de disparar, encima de la animación. */
  pose(dt: number) {
    this.armT -= dt;
    if (!this.finished && this.armT > 0) {
      this.player.armR.rotation.x = -1.45;
      this.player.elbowR.rotation.x = -0.15;
    }
  }

  dispose() {
    this.drops.dispose();
    this.gun.removeFromParent();
    for (const k of this.kids) {
      k.p.root.removeFromParent();
      k.alert.removeFromParent();
    }
    this.kids.length = 0;
  }
}

// ---------------- Capítulo 3: ruta de pinchos en la Laurel ----------------

const PINCHOS: { name: string; icon: string; build: (m: Merger, x: number, y: number, z: number) => void }[] = [
  {
    name: 'Champiñón', icon: '🍄',
    build: (m, x, y, z) => {
      m.add(G.rbox, 0xd9b27a, x, y + 0.02, z, 0, 0, 0, 0.17, 0.035, 0.1);
      for (let i = 0; i < 3; i++) {
        m.add(G.dome, 0xe7dcc6, x, y + 0.045 + i * 0.05, z, 0, 0, 0, 0.1, 0.1, 0.1);
        m.add(G.cyl, 0xcfc0a4, x, y + 0.08 + i * 0.05, z, 0, 0, 0, 0.018, 0.04, 0.018);
      }
      m.add(G.cyl, 0xb9a988, x, y + 0.16, z, 0, 0, 0, 0.006, 0.26, 0.006);
      m.add(G.sphere, 0x8c1f1f, x + 0.04, y + 0.055, z + 0.03, 0, 0, 0, 0.018, 0.012, 0.018);
    },
  },
  {
    name: 'Tortilla', icon: '🍳',
    build: (m, x, y, z) => {
      m.add(G.rbox, 0xd9b27a, x, y + 0.02, z, 0, 0, 0, 0.17, 0.035, 0.1);
      m.add(G.rbox, 0xeec95a, x, y + 0.075, z, 0, 0, 0, 0.14, 0.07, 0.09);
      m.add(G.rbox, 0xc99a3c, x, y + 0.115, z, 0, 0, 0, 0.13, 0.012, 0.085);
      m.add(G.cyl, 0xb9a988, x, y + 0.13, z, 0, 0, 0, 0.006, 0.2, 0.006);
    },
  },
  {
    name: 'Jamón', icon: '🍖',
    build: (m, x, y, z) => {
      m.add(G.rbox, 0xd9b27a, x, y + 0.02, z, 0, 0, 0, 0.17, 0.035, 0.1);
      for (let i = 0; i < 3; i++) m.add(G.rbox, i % 2 ? 0xa83a44 : 0xbc4a50, x + (i - 1) * 0.03, y + 0.05 + i * 0.012, z + (i % 2) * 0.012, 0.2, 0, (i - 1) * 0.3, 0.13, 0.016, 0.08);
      m.add(G.cyl, 0xb9a988, x, y + 0.11, z, 0, 0, 0, 0.006, 0.18, 0.006);
    },
  },
  {
    name: 'Gamba', icon: '🍤',
    build: (m, x, y, z) => {
      m.add(G.rbox, 0xd9b27a, x, y + 0.02, z, 0, 0, 0, 0.17, 0.035, 0.1);
      m.add(new THREE.TorusGeometry(0.045, 0.02, 8, 12, 4.4).rotateX(Math.PI / 2 - 0.5), 0xf07a54, x, y + 0.075, z);
      m.add(G.sphere, 0xf6c04a, x - 0.02, y + 0.05, z + 0.03, 0, 0, 0, 0.05, 0.02, 0.04);
      m.add(G.cyl, 0xb9a988, x, y + 0.12, z, 0, 0, 0, 0.006, 0.18, 0.006);
    },
  },
  {
    name: 'Pimiento', icon: '🌶️',
    build: (m, x, y, z) => {
      m.add(G.rbox, 0xd9b27a, x, y + 0.02, z, 0, 0, 0, 0.17, 0.035, 0.1);
      m.add(G.capsule, 0xb82a22, x, y + 0.06, z, 0, 0, Math.PI / 2, 0.045, 0.1, 0.045);
      m.add(G.capsule, 0x8f1f1a, x, y + 0.09, z + 0.01, 0, 0.2, Math.PI / 2, 0.04, 0.09, 0.04);
      m.add(G.cyl, 0xb9a988, x, y + 0.12, z, 0, 0, 0, 0.006, 0.18, 0.006);
    },
  },
];
const PINCHO_ROUNDS = [3, 4, 5];

export class PinchoGame {
  private root = new THREE.Group();
  readonly waiter: Person;
  private items: { obj: THREE.Mesh; at: THREE.Vector3; btn: HTMLButtonElement; k: number }[] = [];
  private t = 0;
  private round = 0;
  private seq: number[] = [];
  private i = 0;
  private asking = false;
  private timers: number[] = [];
  private box: HTMLElement;
  private info: HTMLElement;
  private done = false;
  errors = 0;

  constructor(sc: THREE.Scene, z: number, private onDone: () => void) {
    // Una barra de madera en plena calle, con el camarero detrás y los pinchos en fila
    const m = new Merger();
    const y = 1.08;
    m.add(G.box, 0x4a2c1a, 0, 0.53, z, 0, 0, 0, 2.5, 1.06, 0.62);
    m.add(G.box, 0xc9a06a, 0, y - 0.02, z, 0, 0, 0, 2.66, 0.05, 0.76);
    for (const dx of [-1, -0.5, 0, 0.5, 1]) m.add(G.box, 0x38210f, dx, 0.53, z + 0.315, 0, 0, 0, 0.03, 1, 0.01);
    for (let i = 0; i < 2; i++) m.add(new THREE.CylinderGeometry(0.11, 0.09, 0.01, 18), 0xf4f0e6, -1.05 + i * 2.1, y + 0.01, z + 0.18);
    for (let i = 0; i < 5; i++) {
      m.add(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8), [0x2f5a3a, 0x6b2a2a, 0x3a2a18][i % 3], -1.15 + i * 0.09, y + 0.12, z - 0.27);
    }
    this.root.add(m.mesh());
    const plate = new THREE.CylinderGeometry(0.135, 0.11, 0.018, 20);
    PINCHOS.forEach((pz, i) => {
      const x = -0.62 + i * 0.31;
      const g = new Merger(false);
      g.add(plate, 0xf7f3ea, 0, 0.01, 0);
      pz.build(g, 0, 0.018, 0);
      const obj = g.mesh();
      obj.position.set(x, y, z + 0.08);
      this.root.add(obj);
      const btn = el('button', 'side-spot', pz.icon) as HTMLButtonElement;
      btn.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.press(i);
      };
      uiRoot().append(btn);
      this.items.push({ obj, at: new THREE.Vector3(x, y + 0.26, z + 0.08), btn, k: 0 });
    });
    sc.add(this.root);
    this.waiter = makePerson({ skin: 0xe2b08c, shirt: 0xf6f6f2, pants: 0x1a1a1a, hair: 0x2b1d14, hairStyle: 'short', male: true, beard: true });
    this.waiter.root.position.set(0.25, 0, z - 0.72);
    sc.add(this.waiter.root);
    this.box = el('div', 'side-panel');
    this.info = el('div', 'side-info');
    this.box.append(this.info);
    uiRoot().append(this.box);
    this.showButtons(false);
    this.startRound();
  }

  private showButtons(on: boolean) {
    this.asking = on;
    for (const it of this.items) it.btn.classList.toggle('off', !on);
  }

  private wait(ms: number, f: () => void) {
    this.timers.push(later(f, ms));
  }

  private startRound() {
    const n = PINCHO_ROUNDS[this.round];
    this.seq = [];
    for (let i = 0; i < n; i++) {
      let c = Math.floor(Math.random() * PINCHOS.length);
      if (i && c === this.seq[i - 1]) c = (c + 1) % PINCHOS.length;
      this.seq.push(c);
    }
    this.i = 0;
    this.showButtons(false);
    this.info.textContent = SIDE.pinchos.listen(this.round + 1, PINCHO_ROUNDS.length);
    this.seq.forEach((c, k) => {
      this.wait(700 + k * 1050, () => {
        this.items[c].k = 1;
        audio.chime(c);
        bark('Camarero', PINCHOS[c].name + '!');
      });
    });
    this.wait(700 + n * 1050 + 200, () => {
      document.querySelectorAll('.bark').forEach((b) => b.remove());
      this.info.textContent = SIDE.pinchos.yourTurn(0, n);
      this.showButtons(true);
    });
  }

  private press(c: number) {
    if (!this.asking || this.done) return;
    this.items[c].k = 1;
    if (c !== this.seq[this.i]) {
      this.errors++;
      this.showButtons(false);
      audio.boo();
      vibrate(40);
      this.info.textContent = '';
      bark('Camarero', SIDE.pinchos.wrong[this.errors % SIDE.pinchos.wrong.length]);
      this.wait(1900, () => this.startRound());
      return;
    }
    audio.pickup();
    vibrate(15);
    this.i++;
    this.info.textContent = SIDE.pinchos.yourTurn(this.i, this.seq.length);
    if (this.i >= this.seq.length) {
      this.showButtons(false);
      this.round++;
      audio.perfect();
      if (this.round >= PINCHO_ROUNDS.length) {
        this.done = true;
        this.info.textContent = SIDE.pinchos.won;
        this.wait(1500, () => {
          this.close();
          dialogue(SIDE.pinchos.end, this.onDone);
        });
      } else {
        this.info.textContent = '';
        comicWord(SIDE.pinchos.good, 'perfect');
        this.wait(1300, () => this.startRound());
      }
    }
  }

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    animatePerson(this.waiter, dt, 'talk');
    const W = window.innerWidth, H = window.innerHeight;
    const v = new THREE.Vector3();
    for (const it of this.items) {
      it.k = Math.max(0, it.k - dt * 1.7);
      it.obj.position.y = 1.08 + it.k * 0.16;
      it.obj.scale.setScalar(1 + it.k * 0.28);
      v.copy(it.at).project(camera);
      it.btn.style.left = `${((v.x + 1) / 2) * W}px`;
      it.btn.style.top = `${((1 - v.y) / 2) * H - 8}px`;
    }
  }

  private close() {
    this.timers.forEach((t) => clearTimeout(t));
    for (const it of this.items) it.btn.remove();
    this.box.remove();
    document.querySelectorAll('.bark').forEach((b) => b.remove());
  }

  dispose() {
    this.close();
    this.root.removeFromParent();
    this.waiter.root.removeFromParent();
  }
}

// ---------------- Capítulo 4: las cervezas sin derramar ----------------

export const BEERS_NEED = 2;

export class BeerRun {
  /** done: ya se las ha dado (a partir de ahí, chocar con alguien no tira nada). */
  stage: 'toBar' | 'carry' | 'done' = 'toBar';
  private tray = new THREE.Group();
  private cups: THREE.Object3D[] = [];
  cupsLeft = 3;
  private level = 0;
  private pvx = 0;
  private pvz = 0;
  private post: (() => void) | null = null;
  private meter: HTMLElement;
  private fill: HTMLElement;
  private cross: { p: Person; z: number; x0: number; x1: number; u: number; v: number; hit: number }[] = [];
  private tilt = new THREE.Vector2();
  rounds = 0;

  /** Las cervezas son para Azul (estaban los dos solos): se las lleva hasta su sitio del pasillo. */
  constructor(sc: THREE.Scene, private gas: Person, private walker: Walker, private fx: Particles, readonly friendAt: THREE.Vector3, aisleX: number, zs: number[], private onChange: () => void) {
    const m = new Merger(false);
    m.add(new THREE.CylinderGeometry(0.2, 0.17, 0.018, 24), 0x2b2f35, 0, 0, 0);
    this.tray.add(m.mesh());
    const cup = new Merger(false)
      .add(new THREE.CylinderGeometry(0.04, 0.032, 0.13, 12), 0xe9b53a, 0, 0.065, 0)
      .add(new THREE.CylinderGeometry(0.041, 0.041, 0.022, 12), 0xfffaf0, 0, 0.135, 0)
      .mesh();
    for (let i = 0; i < 3; i++) {
      const c = cup.clone();
      const a = (i / 3) * 6.283 + 0.5;
      c.position.set(Math.cos(a) * 0.09, 0.01, Math.sin(a) * 0.09);
      this.tray.add(c);
      this.cups.push(c);
    }
    this.tray.visible = false;
    sc.add(this.tray);
    // Gente que cruza el pasillo: hay que esquivarla
    const looks: PersonLook[] = [
      { skin: 0xf0c8a6, shirt: 0xb4364c, pants: 0x222222, hair: 0x6b3f22, hairStyle: 'straight' },
      { skin: 0xd9a27c, shirt: 0x3a6a5a, pants: 0x2a2a2a, hair: 0x1f1610, hairStyle: 'short', male: true },
      { skin: 0xf3d2b6, shirt: 0x5a4a78, pants: 0x3b4a6b, hair: 0x9a6a3a, hairStyle: 'pony' },
      { skin: 0xe2b08c, shirt: 0xd8cfc0, pants: 0x222222, hair: 0x3a2414, hairStyle: 'short', male: true },
    ];
    zs.forEach((z, i) => {
      const p = makePerson(looks[i % looks.length]);
      const x0 = aisleX - 2.6, x1 = aisleX + 2.6;
      p.root.position.set(x0, 0, z);
      sc.add(p.root);
      this.cross.push({ p, z, x0, x1, u: i * 0.31, v: 0.26 + (i % 3) * 0.05, hit: 0 });
    });
    this.meter = el('div', 'tray-meter');
    this.fill = el('div', 'tray-fill');
    this.meter.append(this.fill);
    this.meter.hidden = true;
    uiRoot().append(this.meter);
  }

  /** En la barra: tres cervezas a la bandeja. */
  pick() {
    this.stage = 'carry';
    this.rounds++;
    this.cupsLeft = 3;
    this.level = 0;
    this.pvx = this.pvz = 0;
    this.cups.forEach((c) => (c.visible = true));
    this.tray.visible = true;
    this.meter.hidden = false;
    this.walker.speed = 3.5;
    audio.pickup();
    if (this.gas.rig && !this.post) {
      const t = new THREE.Vector3(), pole = new THREE.Vector3();
      const r = this.gas.rig;
      this.post = () => {
        if (!this.tray.visible) return;
        this.tray.updateWorldMatrix(true, false);
        for (const [side, sx] of [['Left', 1], ['Right', -1]] as const) {
          t.set(sx * 0.18, -0.035, -0.04).applyMatrix4(this.tray.matrixWorld);
          r.bones.get(side + 'Arm')!.getWorldPosition(pole);
          pole.y -= 0.5;
          twoBone(r.bones.get(side + 'Arm')!, r.bones.get(side + 'ForeArm')!, r.bones.get(side + 'Hand')!, t, pole, 1);
        }
      };
      rigPost.add(this.post);
    }
  }

  /** Vuelve a la barra (no han llegado suficientes). */
  reset() {
    this.stage = 'toBar';
    this.tray.visible = false;
    this.meter.hidden = true;
    this.walker.speed = 4.0; // la velocidad normal del jugador (core/walker.ts)
  }

  private spill() {
    this.cupsLeft--;
    this.level = 0.42;
    const c = this.cups.find((x) => x.visible);
    if (c) c.visible = false;
    this.fx.burst(this.tray.position.clone(), '🍺', 6, 1.8, 0.6);
    audio.hit();
    vibrate(60);
    this.walker.shake(0.2);
    this.onChange();
    if (this.cupsLeft <= 0) {
      toast(SIDE.beers.empty);
      this.reset();
      this.onChange();
    } else toast(SIDE.beers.spilled[Math.min(this.cupsLeft - 1, 1)]);
  }

  update(dt: number, busy: boolean) {
    const pp = this.gas.root.position;
    for (const c of this.cross) {
      const live = !busy;
      c.hit -= dt;
      if (live) c.u += dt * c.v;
      const k = (Math.sin(c.u * 2.2) + 1) / 2;
      const x = c.x0 + (c.x1 - c.x0) * k;
      const dx = x - c.p.root.position.x;
      c.p.root.position.x = x;
      if (Math.abs(dx) > 1e-4) c.p.root.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
      animatePerson(c.p, dt, 'walk', 0.6);
      if (this.stage === 'carry' && c.hit <= 0 && Math.hypot(pp.x - x, pp.z - c.z) < 0.85) {
        c.hit = 1.4;
        this.level += 0.62;
        toast(SIDE.beers.bump);
        audio.knock(0.4, 240, 0.08);
      }
    }
    if (this.stage !== 'carry') return;
    // Cuanto más brusco el cambio de velocidad y cuanto más contra la gente, más se mueve el líquido
    const vx = this.walker.vx, vz = this.walker.vz;
    const ax = dt > 0 ? (vx - this.pvx) / dt : 0, az = dt > 0 ? (vz - this.pvz) / dt : 0;
    this.pvx = vx;
    this.pvz = vz;
    const acc = Math.hypot(ax, az);
    if (!busy) {
      this.level += Math.max(0, acc - 13) * dt * 0.07;
      if (this.walker.bump) this.level += Math.min(0.3, this.walker.bump * 0.09);
      this.level = Math.max(0, this.level - dt * 0.26);
      if (this.level >= 1) this.spill();
    }
    this.fill.style.width = `${Math.min(100, this.level * 100)}%`;
    this.fill.style.background = this.level > 0.7 ? '#e2543a' : this.level > 0.4 ? '#f4c95d' : '#5fcf80';
    // La bandeja: delante del pecho, inclinada según frenas y giras
    const f = this.walker.facing;
    const lean = Math.min(1, this.level);
    this.tilt.x += (THREE.MathUtils.clamp(az * 0.012, -0.14, 0.14) + Math.sin(performance.now() * 0.019) * lean * 0.08 - this.tilt.x) * Math.min(1, dt * 8);
    this.tilt.y += (THREE.MathUtils.clamp(-ax * 0.012, -0.14, 0.14) + Math.cos(performance.now() * 0.023) * lean * 0.08 - this.tilt.y) * Math.min(1, dt * 8);
    this.tray.position.set(pp.x + Math.sin(f) * 0.43, 1.2, pp.z + Math.cos(f) * 0.43);
    this.tray.rotation.set(this.tilt.x, f, this.tilt.y);
  }

  dispose() {
    if (this.post) rigPost.delete(this.post);
    this.tray.removeFromParent();
    this.meter.remove();
    for (const c of this.cross) c.p.root.removeFromParent();
    this.cross.length = 0;
  }

  /** Entregadas: los que cruzan y la bandeja se van, y ya no se puede derramar nada. */
  finish() {
    this.stage = 'done';
    this.tray.visible = false;
    this.meter.remove();
    if (this.post) rigPost.delete(this.post);
    this.post = null;
    for (const c of this.cross) c.p.root.removeFromParent();
    this.cross.length = 0;
    this.walker.speed = 4.0; // la velocidad normal del jugador (core/walker.ts)
  }
}

// ---------------- Capítulo 5: hacer la rana con piedras ----------------

export const GAS_SKIPS = 5;

export class StoneSkip {
  scene = new THREE.Scene();
  private sky: Sky;
  private sun: Sun;
  private azul: Person;
  private gas: Person;
  private stone: THREE.Mesh;
  private rings: { m: THREE.Mesh; t: number }[] = [];
  private flight: { hops: { x: number; z: number; x2: number; z2: number; dur: number; h: number }[]; i: number; t: number; onEnd: () => void } | null = null;
  private t = 0;
  private throwT = 0;
  private thrower: Person;
  private chip: HTMLElement;
  private count = 0;
  private tries = 0;
  private finished = false;
  private camLook = new THREE.Vector3(0, 0.8, 30);

  constructor(private onDone: () => void) {
    const sc = this.scene;
    const sunDir = new THREE.Vector3(-0.55, 0.62, -0.3).normalize();
    sc.fog = new THREE.Fog(0xbcd8ea, 90, 520);
    this.sky = new Sky({ top: 0x2f7cc9, mid: 0x8cc4e8, bottom: 0xd8ecf6, clouds: { count: 3, tint: 0xffffff }, avoid: sunDir });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xcfe6ff, 0x5a5048, 1.3));
    this.sun = new Sun(sc, 0xfff0d6, 2.4, sunDir, 22);
    const sea = makeSea([900, 900], 0x12577f, sunDir, {});
    sea.position.y = 0;
    sc.add(sea);
    // Cap de Creus: pizarra oscura y roca retorcida, con matas de sal
    const m = new Merger();
    const SLATE = [0x7a7468, 0x8c8578, 0x696459, 0x9a9284];
    m.add(G.rock2, SLATE[0], 0, -0.45, -4.2, 0, 0.3, 0, 13, 2.4, 11);
    for (let i = 0; i < 46; i++) {
      const a = i * 2.399, r = 2 + (i % 9) * 1.1;
      const x = Math.cos(a) * r, z = -5 + Math.sin(a) * r * 0.7;
      const s = 0.5 + (i % 5) * 0.34;
      if (z > -1.1) continue;
      m.add(i % 2 ? G.rock : G.crag, SLATE[i % 4], x, 0.02 + (i % 3) * 0.18, z, i * 0.3, i, 0, s * 1.5, s * 0.7, s);
    }
    // Los dos brazos de la cala y el cabo del fondo
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -2 + i * 3.6;
      const x = side * (11 + Math.sin(i * 1.4) * 2.4 + i * 0.55);
      const s = 3.4 + (i % 4) * 1.8;
      m.add(i % 3 ? G.rock2 : G.rock, SLATE[i % 4], x, s * 0.2, z, 0, i, 0, s * 1.5, s * (0.9 + (i % 3) * 0.3), s * 1.4);
      if (i % 3 === 0) m.add(G.bush, 0x5d6b3a, x - side * 1.5, s * 0.72, z, 0, i, 0, 1.6, 0.65, 1.6);
    }
    for (let i = 0; i < 18; i++) m.add(G.rock2, SLATE[i % 4], -80 + i * 11, 3 + (i % 3) * 3, 210 + Math.sin(i) * 16, 0, i, 0, 22, 12 + (i % 4) * 5, 22);
    for (let i = 0; i < 16; i++) {
      const x = -5 + i * 0.7, z = -0.7 + Math.sin(i * 2.1) * 0.25;
      m.add(G.crag, SLATE[i % 4], x, 0.05, z, 0, i, 0, 0.7, 0.28, 0.5);
    }
    sc.add(m.mesh());
    this.azul = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    this.azul.root.position.set(-0.5, 0.55, -1.9);
    this.gas.root.position.set(0.55, 0.55, -1.9);
    sc.add(this.azul.root, this.gas.root);
    this.thrower = this.gas;
    this.stone = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 7).scale(1, 0.4, 1), new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.75 }));
    this.stone.visible = false;
    sc.add(this.stone);
    applyShadows(sc);
    settleAmbient(sc);
    this.chip = el('div', 'side-count');
    this.chip.hidden = true;
    uiRoot().append(this.chip);
    cinema.stop();
    later(() => dialogue(SIDE.stones.start, () => this.gasThrow()), 700);
  }

  private path(x0: number, skips: number) {
    const hops: { x: number; z: number; x2: number; z2: number; dur: number; h: number }[] = [];
    let z = -1.2, x = x0, len = 7.5;
    const drift = (Math.random() - 0.5) * 0.14;
    // El primer tramo cae de la mano; luego, botes cada vez más cortos
    for (let i = 0; i <= skips; i++) {
      const z2 = z + len, x2 = x + drift * len;
      hops.push({ x, z, x2, z2, dur: 0.18 + len * 0.045, h: i === 0 ? 0.55 : Math.max(0.06, 0.1 * len * 0.55) });
      x = x2;
      z = z2;
      len *= 0.78;
    }
    return hops;
  }

  private launch(p: Person, skips: number, onEnd: () => void) {
    this.thrower = p;
    this.throwT = 0.55;
    this.count = 0;
    this.chip.hidden = false;
    this.chip.textContent = '🪨 0';
    audio.whoosh();
    later(() => {
      this.stone.visible = true;
      this.flight = { hops: this.path(p.root.position.x, skips), i: 0, t: 0, onEnd };
    }, 220);
  }

  private gasThrow() {
    this.launch(this.gas, GAS_SKIPS, () => {
      dialogue(SIDE.stones.gasDone, () => this.playerThrow());
    });
  }

  private playerThrow() {
    const slow = 1 + this.tries * 0.12;
    timingGauge(
      {
        title: SIDE.stones.angle,
        duration: 1.25 * slow,
        button: '🪨 Agacharse',
        zones: [
          { to: 0.3, label: 'Muy alto', color: '#c76a4a' },
          { to: 0.62, label: 'Rasante', color: '#5fcf80', good: true },
          { to: 1, label: 'Al agua', color: '#c76a4a' },
        ],
      },
      (qa) => {
        timingGauge(
          {
            title: SIDE.stones.power,
            duration: 1 * slow,
            button: '💪 ¡Lanzar!',
            zones: [
              { to: 0.5, label: 'Flojo', color: '#c76a4a' },
              { to: 0.82, label: 'Fuerte', color: '#5fcf80', good: true },
              { to: 1, label: 'Demasiado', color: '#c76a4a' },
            ],
          },
          (qf) => {
            const skips = Math.max(1, Math.round(1.6 + qa * 3 + qf * 3));
            this.tries++;
            this.launch(this.azul, skips, () => this.judge(skips));
          },
        );
      },
    );
  }

  private judge(skips: number) {
    if (skips > GAS_SKIPS) {
      this.finished = true;
      audio.fanfare();
      this.fxWin();
      dialogue(SIDE.stones.win(skips), () => {
        this.onDone();
      });
    } else {
      audio.boo();
      dialogue(SIDE.stones.lose(skips, this.tries), () => this.playerThrow());
    }
  }

  private fxWin() {
    this.chip.textContent = '🏆 ' + this.chip.textContent;
  }

  private splash(x: number, z: number) {
    const g = new THREE.RingGeometry(0.1, 0.18, 24).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, 0.05, z);
    m.userData.noCast = true;
    this.scene.add(m);
    this.rings.push({ m, t: 0 });
  }

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    const f = this.flight;
    if (f) {
      const h = f.hops[f.i];
      f.t += dt;
      const k = Math.min(1, f.t / h.dur);
      this.stone.position.set(THREE.MathUtils.lerp(h.x, h.x2, k), 0.04 + (f.i === 0 ? THREE.MathUtils.lerp(1.2, 0, k) : 0) + Math.sin(k * Math.PI) * h.h, THREE.MathUtils.lerp(h.z, h.z2, k));
      this.stone.rotation.y += dt * 24;
      if (k >= 1) {
        this.splash(h.x2, h.z2);
        f.i++;
        f.t = 0;
        if (f.i < f.hops.length) {
          this.count++;
          this.chip.textContent = `🪨 ${this.count}`;
          audio.knock(0.35, 900 + this.count * 90, 0.05);
        } else {
          // Se hunde
          audio.pop();
          this.stone.visible = false;
          this.flight = null;
          const end = f.onEnd;
          later(end, 900);
        }
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      r.m.scale.setScalar(1 + r.t * 7);
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 - r.t * 0.7);
      if (r.t > 1.25) {
        r.m.removeFromParent();
        this.rings.splice(i, 1);
      }
    }
    this.throwT -= dt;
    for (const [p, o] of [[this.gas, this.azul], [this.azul, this.gas]] as const) {
      const me = p === this.thrower && this.throwT > 0;
      animatePerson(p, dt, this.finished ? (p === this.azul ? 'cheer' : 'idle') : 'idle');
      if (me) {
        // Lanzamiento de costado: atrás y barrido hacia delante
        const k = 1 - this.throwT / 0.55;
        const swing = k < 0.45 ? THREE.MathUtils.lerp(0, 1.4, k / 0.45) : THREE.MathUtils.lerp(1.4, -1.5, (k - 0.45) / 0.55);
        p.armR.rotation.x = swing * 0.9 - 0.5;
        p.armR.rotation.z = -0.9;
        p.body.rotation.x = 0.2;
      }
      void o;
    }
    // La cámara, detrás de los dos, siguiendo un poco la piedra
    const cam = camera as THREE.PerspectiveCamera;
    const z = this.flight ? this.stone.position.z : 22;
    this.camLook.lerp(new THREE.Vector3(this.flight ? this.stone.position.x : 0, 0.6, Math.min(40, z + 6)), 1 - Math.exp(-dt * 2.4));
    cam.position.lerp(new THREE.Vector3(0.7, 2.5, -7), 1 - Math.exp(-dt * 4));
    cam.lookAt(this.camLook);
    this.sun.follow(new THREE.Vector3(0, 0, 8));
    this.sky.update(camera, dt);
  }

  dispose() {
    this.chip.remove();
    document.querySelectorAll('.gauge').forEach((g) => g.remove());
  }
}

// ---------------- Capítulo 6: lanzar avellanes ----------------

export const NUTS_NEED = 6;
let targetTex: THREE.Texture | null = null;
function targetTexture() {
  if (targetTex) return targetTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  for (const [r, col] of [[60, '#ffffff'], [47, '#d9352b'], [33, '#ffffff'], [20, '#d9352b']] as const) {
    x.fillStyle = col;
    x.beginPath();
    x.arc(64, 64, r, 0, 7);
    x.fill();
  }
  targetTex = new THREE.CanvasTexture(c);
  targetTex.colorSpace = THREE.SRGBColorSpace;
  return targetTex;
}
const BAL: PersonLook[] = [
  { skin: 0xf0c8a6, shirt: 0xf6f6f2, pants: 0x25304a, hair: 0x4a2c18, hairStyle: 'long', shorts: true },
  { skin: 0xdcae88, shirt: 0xf6f6f2, pants: 0x25304a, hair: 0x1c1410, hairStyle: 'short', male: true },
  { skin: 0xf3d2b6, shirt: 0xf6f6f2, pants: 0x3b4a6b, hair: 0xa8743c, hairStyle: 'pony' },
  { skin: 0xe2b08c, shirt: 0xf6f6f2, pants: 0x25304a, hair: 0x2b1d14, hairStyle: 'short', male: true, beard: true },
];

export class NutThrow {
  private folk: { p: Person; x: number; goal: number; stop: number; fire: number; hit: number; warn: number; mark: THREE.Sprite }[] = [];
  private nuts: { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; onLand: () => void; h: number }[] = [];
  private pool: THREE.Mesh[] = [];
  private rings: { m: THREE.Mesh; t: number; dur: number }[] = [];
  private rail: THREE.Mesh;
  private cool = 0;
  private armT = 0;
  private z: number;
  private y = 5.29;
  private nutGeo = new THREE.SphereGeometry(0.055, 8, 6);
  private nutMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.55 });
  private ringGeo = new THREE.RingGeometry(0.42, 0.54, 24).rotateX(-Math.PI / 2);
  hits = 0;
  pelted = 0;
  finished = false;

  constructor(private sc: THREE.Scene, private player: Person, private walker: Walker, private fx: Particles, private x0: number, private x1: number, wallZ: number, private onChange: () => void, private onDone: () => void) {
    this.z = wallZ + 0.84;
    const m = new Merger();
    const rz = wallZ + 1.08;
    m.add(G.box, 0x2a2a2a, (x0 + x1) / 2, this.y + 0.95, rz, 0, 0, 0, x1 - x0 + 0.8, 0.05, 0.05);
    m.add(G.box, 0x2a2a2a, (x0 + x1) / 2, this.y + 0.08, rz, 0, 0, 0, x1 - x0 + 0.8, 0.04, 0.04);
    for (let x = x0 - 0.4; x <= x1 + 0.4; x += 0.17) m.add(G.box, 0x2a2a2a, x, this.y + 0.5, rz, 0, 0, 0, 0.018, 0.9, 0.018);
    this.rail = m.mesh();
    sc.add(this.rail);
    BAL.forEach((l, i) => {
      const p = makePerson(l, 1.12);
      const x = x0 + ((i + 0.5) / BAL.length) * (x1 - x0);
      p.root.position.set(x, this.y, this.z);
      sc.add(p.root);
      // Una diana encima de cada uno: brilla cuando está parado, que es cuando hay que tirar
      const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: targetTexture(), transparent: true, depthTest: false, fog: false }));
      mark.scale.setScalar(0.85);
      mark.position.set(x, this.y + 2.55, this.z);
      mark.userData.noCast = true;
      sc.add(mark);
      this.folk.push({ p, x, goal: x, stop: 0.8 + i * 0.5, fire: 1.8 + i * 1.3, hit: 0, warn: 0, mark });
    });
  }

  /** Hacia dónde mirar: el más cercano. */
  nearest() {
    const pp = this.player.root.position;
    let best: THREE.Vector3 | null = null, bd = 1e9;
    for (const f of this.folk) {
      const d = Math.hypot(f.p.root.position.x - pp.x, f.p.root.position.z - pp.z);
      if (d < bd) {
        bd = d;
        best = f.p.root.position;
      }
    }
    return { at: best, dist: bd };
  }

  private spawn(from: THREE.Vector3, to: THREE.Vector3, dur: number, h: number, onLand: () => void) {
    const m = this.pool.pop() ?? new THREE.Mesh(this.nutGeo, this.nutMat);
    m.position.copy(from);
    m.userData.noCast = true;
    this.sc.add(m);
    this.nuts.push({ m, from: from.clone(), to: to.clone(), t: 0, dur, onLand, h });
  }

  throw() {
    if (this.cool > 0 || this.finished) return;
    const pp = this.player.root.position;
    let t: (typeof this.folk)[number] | null = null;
    let score = 1e9;
    for (const f of this.folk) {
      const q = f.p.root.position;
      const d = Math.hypot(q.x - pp.x, q.z - pp.z);
      const ang = Math.abs(wrap(Math.atan2(q.x - pp.x, q.z - pp.z) - this.walker.yaw));
      if (d > 17) continue;
      const s = ang * 6 + d * 0.12 + (f.hit > 0 ? 4 : 0);
      if (s < score) {
        score = s;
        t = f;
      }
    }
    if (!t) {
      toast(SIDE.nuts.far);
      this.cool = 0.5;
      return;
    }
    this.cool = 0.6;
    this.armT = 0.42;
    const tq = t.p.root.position;
    this.walker.facing = Math.atan2(tq.x - pp.x, tq.z - pp.z);
    audio.whoosh();
    const from = pp.clone().setY(1.65);
    const to = tq.clone().setY(this.y + 1.2);
    const who = t;
    this.spawn(from, to, 0.62, 1.2, () => {
      // A donde estaba cuando la lanzaste: si se ha movido, falla
      const miss = Math.abs(who.p.root.position.x - to.x);
      if (miss > 0.62) {
        audio.knock(0.25, 1200, 0.05);
        toast(SIDE.nuts.miss);
        return;
      }
      this.hits++;
      who.hit = 1.5;
      this.fx.burst(to, '🌰', 6, 2, 0.8);
      audio.perfect();
      vibrate(22);
      this.onChange();
      if (this.hits >= NUTS_NEED) {
        this.finished = true;
        audio.cheer(0.7);
        dialogue(SIDE.nuts.end, this.onDone);
      }
    });
  }

  update(dt: number, busy: boolean) {
    this.cool -= dt;
    const pp = this.player.root.position;
    for (let i = this.nuts.length - 1; i >= 0; i--) {
      const n = this.nuts[i];
      n.t += dt;
      const k = Math.min(1, n.t / n.dur);
      n.m.position.lerpVectors(n.from, n.to, k);
      n.m.position.y += Math.sin(k * Math.PI) * n.h;
      n.m.rotation.x += dt * 12;
      if (k >= 1) {
        n.m.removeFromParent();
        this.pool.push(n.m);
        this.nuts.splice(i, 1);
        n.onLand();
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(r.t * 18) * 0.25 + (r.t / r.dur) * 0.4;
      if (r.t >= r.dur) {
        r.m.removeFromParent();
        this.rings.splice(i, 1);
      }
    }
    for (const f of this.folk) {
      const r = f.p.root;
      f.hit -= dt;
      r.rotation.y = 0;
      f.mark.position.x = r.position.x;
      const ready = !this.finished && f.hit <= 0 && f.warn <= 0 && f.stop > 0;
      const mm = f.mark.material as THREE.SpriteMaterial;
      mm.opacity += ((ready ? 1 : 0.22) - mm.opacity) * Math.min(1, dt * 10);
      f.mark.scale.setScalar(ready ? 0.85 + Math.sin(performance.now() * 0.009) * 0.07 : 0.62);
      if (this.finished || busy) {
        animatePerson(f.p, dt, this.finished ? 'cheer' : 'idle');
        continue;
      }
      if (f.hit > 0) {
        animatePerson(f.p, dt, 'cheer');
        continue;
      }
      if (f.warn > 0) {
        // A punto de tirar: brazo atrás, se ve venir
        f.warn -= dt;
        animatePerson(f.p, dt, 'idle');
        f.p.armR.rotation.x = -2.4;
        r.rotation.y = Math.atan2(pp.x - r.position.x, pp.z - r.position.z);
        if (f.warn <= 0) {
          const land = pp.clone().setY(0.05);
          // Anillo en el suelo: ahí va a caer
          const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
          m.position.copy(land).setY(0.07);
          m.userData.noCast = true;
          this.sc.add(m);
          const dur = 0.85;
          this.rings.push({ m, t: 0, dur });
          this.spawn(r.position.clone().setY(this.y + 1.5), land.clone().setY(1), dur, 0.9, () => {
            this.fx.burst(land.clone().setY(0.2), '🌰', 3, 1.2, 0.5);
            audio.knock(0.25, 1500, 0.04);
            if (Math.hypot(pp.x - land.x, pp.z - land.z) < 1) {
              this.pelted++;
              audio.hit();
              this.walker.shake(0.2);
              vibrate(35);
              toast(SIDE.nuts.pelted[this.pelted % SIDE.nuts.pelted.length]);
            }
          });
          f.fire = 2.8 + Math.random() * 2.6;
        }
        continue;
      }
      f.fire -= dt;
      if (f.fire <= 0) {
        f.warn = 0.55;
        continue;
      }
      // Andan por el balcón a tramos, y se paran: ese es el momento de tirar
      f.stop -= dt;
      if (f.stop > 0) {
        animatePerson(f.p, dt, 'talk');
        continue;
      }
      if (Math.abs(f.goal - r.position.x) < 0.05) {
        f.stop = 0.8 + Math.random() * 1.1;
        const seg = (this.x1 - this.x0) / BAL.length;
        const idx = this.folk.indexOf(f);
        const base = this.x0 + (idx + 0.5) * seg;
        f.goal = base + (Math.random() - 0.5) * seg * 0.85;
        continue;
      }
      const dir = Math.sign(f.goal - r.position.x);
      r.position.x += dir * Math.min(Math.abs(f.goal - r.position.x), 1.45 * dt);
      r.rotation.y = (dir * Math.PI) / 2;
      animatePerson(f.p, dt, 'walk', 0.6);
    }
  }

  pose(dt: number) {
    this.armT -= dt;
    if (this.armT > 0) {
      const k = this.armT / 0.42;
      this.player.armR.rotation.x = THREE.MathUtils.lerp(-1.3, -2.8, k);
    }
  }

  dispose() {
    for (const n of this.nuts) n.m.removeFromParent();
    for (const r of this.rings) r.m.removeFromParent();
    this.rail.removeFromParent();
    for (const f of this.folk) {
      f.p.root.removeFromParent();
      f.mark.removeFromParent();
    }
    this.folk.length = 0;
  }
}

// ---------------- Capítulo 7: dejar la mesa como estaba ----------------

const TABLE_ITEMS: { name: string; icon: string; build: (m: Merger) => void }[] = [
  {
    name: 'Flores', icon: '💐',
    build: (m) => {
      m.add(new THREE.CylinderGeometry(0.05, 0.035, 0.16, 14), 0x2f6b8a, 0, 0.08, 0);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        m.add(G.cyl, 0x3a6a30, Math.cos(a) * 0.02, 0.2, Math.sin(a) * 0.02, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2, 0.008, 0.12, 0.008);
        m.add(G.sphere, [0xe2547a, 0xf4c95d, 0xf6f6f2][i % 3], Math.cos(a) * 0.05, 0.27, Math.sin(a) * 0.05, 0, 0, 0, 0.055, 0.055, 0.055);
      }
    },
  },
  {
    name: 'Frutero', icon: '🍋',
    build: (m) => {
      m.add(new THREE.CylinderGeometry(0.13, 0.07, 0.06, 18), 0xcbb48a, 0, 0.03, 0);
      for (const [x, z, c] of [[-0.05, 0, 0xf4d23a], [0.05, 0.02, 0xf4a23a], [0, -0.05, 0xd14a3a], [0.01, 0.05, 0xf4d23a]] as const) m.add(G.sphere, c, x, 0.085, z, 0, 0, 0, 0.075, 0.075, 0.075);
    },
  },
  {
    name: 'Vela', icon: '🕯️',
    build: (m) => {
      m.add(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 14), 0xb5a06a, 0, 0.01, 0);
      m.add(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 10), 0xf5efe0, 0, 0.11, 0);
      m.add(G.sphere, 0xffb83a, 0, 0.215, 0, 0, 0, 0, 0.02, 0.04, 0.02);
    },
  },
  {
    name: 'Jarra', icon: '🫗',
    build: (m) => {
      m.add(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 14), 0xdfe9ee, 0, 0.09, 0);
      m.add(new THREE.CylinderGeometry(0.052, 0.058, 0.12, 14), 0x9cc8dc, 0, 0.065, 0);
      m.add(new THREE.TorusGeometry(0.04, 0.008, 6, 12), 0xdfe9ee, 0.065, 0.1, 0);
    },
  },
  {
    name: 'Sal', icon: '🧂',
    build: (m) => {
      m.add(new THREE.CylinderGeometry(0.022, 0.03, 0.08, 10), 0xf0ece0, -0.03, 0.04, 0);
      m.add(new THREE.CylinderGeometry(0.022, 0.03, 0.08, 10), 0x4a3a2a, 0.03, 0.04, 0);
      m.add(G.dome, 0xb9bdc2, -0.03, 0.08, 0, 0, 0, 0, 0.04, 0.03, 0.04);
      m.add(G.dome, 0xb9bdc2, 0.03, 0.08, 0, 0, 0, 0, 0.04, 0.03, 0.04);
    },
  },
];
const TABLE_SLOTS: [number, number][] = [[-0.19, -0.33], [0.19, -0.33], [0, 0], [-0.19, 0.33], [0.19, 0.33]];

export class TableMemory {
  private root = new THREE.Group();
  private items: THREE.Object3D[] = [];
  private answer: number[] = [];
  /** Qué objeto hay en cada sitio (o -1). */
  private placed: number[] = [];
  private selected = -1;
  private shelf: HTMLElement;
  private spots: HTMLButtonElement[] = [];
  private frame: HTMLElement;
  private info: HTMLElement;
  private shelfBtns: HTMLButtonElement[] = [];
  private y: number;
  private locked = true;
  private timers: number[] = [];
  private v = new THREE.Vector3();
  tries = 0;

  constructor(sc: THREE.Scene, private center: THREE.Vector3, topY: number, private onDone: () => void) {
    this.y = topY;
    TABLE_ITEMS.forEach((d) => {
      const m = new Merger(false);
      d.build(m);
      const o = m.mesh();
      o.visible = false;
      this.root.add(o);
      this.items.push(o);
    });
    sc.add(this.root);
    this.frame = el('div', 'table-photo');
    this.frame.innerHTML = `<span>${SIDE.table.caption}</span>`;
    uiRoot().append(this.frame);
    this.info = el('div', 'side-info');
    const p = el('div', 'side-panel');
    p.append(this.info);
    uiRoot().append(p);
    this.shelf = el('div', 'table-shelf');
    TABLE_ITEMS.forEach((d, i) => {
      const b = el('button', 'table-item', `${d.icon}`) as HTMLButtonElement;
      b.append(el('small', '', d.name));
      b.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.pick(i);
      };
      this.shelf.append(b);
      this.shelfBtns.push(b);
    });
    uiRoot().append(this.shelf);
    TABLE_SLOTS.forEach((_, i) => {
      const b = el('button', 'side-spot slot') as HTMLButtonElement;
      b.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.drop(i);
      };
      uiRoot().append(b);
      this.spots.push(b);
    });
    this.answer = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    this.showPhoto(4600);
  }

  private wait(ms: number, f: () => void) {
    this.timers.push(later(f, ms));
  }

  /** La foto que hizo antes de que llegara Gas: cada cosa en su sitio. */
  private showPhoto(ms: number) {
    this.locked = true;
    this.selected = -1;
    this.placed = TABLE_SLOTS.map(() => -1);
    this.frame.classList.add('on');
    this.shelf.classList.add('off');
    this.spots.forEach((s) => s.classList.add('off'));
    this.answer.forEach((it, slot) => this.put(it, slot));
    this.info.textContent = SIDE.table.memorize;
    audio.chime(2);
    this.wait(ms, () => {
      this.frame.classList.remove('on');
      this.items.forEach((o) => (o.visible = false));
      this.locked = false;
      this.shelf.classList.remove('off');
      this.spots.forEach((s) => s.classList.remove('off'));
      this.info.textContent = SIDE.table.place;
      this.refresh();
      audio.whoosh();
    });
  }

  private put(it: number, slot: number) {
    const [dx, dz] = TABLE_SLOTS[slot];
    const o = this.items[it];
    o.visible = true;
    o.position.set(this.center.x + dx, this.y, this.center.z + dz);
  }

  private refresh() {
    this.shelfBtns.forEach((b, i) => {
      b.classList.toggle('sel', this.selected === i);
      b.classList.toggle('used', this.placed.includes(i));
    });
  }

  private pick(i: number) {
    if (this.locked) return;
    this.selected = this.selected === i ? -1 : i;
    audio.knock(0.2, 900, 0.03);
    this.refresh();
  }

  private drop(slot: number) {
    if (this.locked) return;
    if (this.selected < 0) {
      // Tocar lo que hay: se recoge
      const was = this.placed[slot];
      if (was >= 0) {
        this.placed[slot] = -1;
        this.items[was].visible = false;
        this.selected = was;
        this.refresh();
      }
      return;
    }
    const it = this.selected;
    const old = this.placed.indexOf(it);
    if (old >= 0) this.placed[old] = -1;
    const was = this.placed[slot];
    if (was >= 0) this.items[was].visible = false;
    this.placed[slot] = it;
    this.put(it, slot);
    this.selected = -1;
    audio.pickup();
    vibrate(15);
    this.refresh();
    if (this.placed.every((p) => p >= 0)) this.check();
  }

  private check() {
    this.locked = true;
    this.tries++;
    const right = this.placed.filter((p, i) => p === this.answer[i]).length;
    if (right === TABLE_SLOTS.length) {
      audio.fanfare();
      this.info.textContent = SIDE.table.good;
      this.wait(1200, () => {
        this.close();
        dialogue(SIDE.table.end, this.onDone);
      });
      return;
    }
    audio.boo();
    vibrate(40);
    this.info.textContent = SIDE.table.wrong(right);
    this.wait(1700, () => {
      // Se quita lo que está mal y se vuelve a mirar la foto (más corto cada vez)
      this.showPhoto(Math.max(2200, 3600 - this.tries * 300));
    });
  }

  update(camera: THREE.Camera) {
    const W = window.innerWidth, H = window.innerHeight;
    TABLE_SLOTS.forEach(([dx, dz], i) => {
      this.v.set(this.center.x + dx, this.y + 0.03, this.center.z + dz).project(camera);
      const s = this.spots[i].style;
      s.left = `${((this.v.x + 1) / 2) * W}px`;
      s.top = `${((1 - this.v.y) / 2) * H}px`;
      this.spots[i].classList.toggle('full', this.placed[i] >= 0);
    });
  }

  private close() {
    this.timers.forEach((t) => clearTimeout(t));
    this.frame.remove();
    this.shelf.remove();
    this.info.parentElement?.remove();
    this.spots.forEach((s) => s.remove());
  }

  dispose() {
    this.close();
    this.root.removeFromParent();
  }
}

// ---------------- Capítulo 8: de roca en roca ----------------

const HOP_ROCKS: { x: number; z: number; safe: boolean }[] = [
  { x: -21.5, z: 2.4, safe: true },
  { x: -19.6, z: 1.9, safe: false },
  { x: -17.8, z: 2.4, safe: false },
  { x: -15.9, z: 1.7, safe: true },
  { x: -14.1, z: 2.1, safe: false },
  { x: -12.3, z: 1.4, safe: false },
  { x: -10.5, z: 1.7, safe: true },
  { x: -8.7, z: 1, safe: false },
  { x: -6.8, z: 1.3, safe: true },
];
const SAFE_Y = -0.75;
const LOW_Y = -1.32;
const SWELL_EVERY = 4.1;
const SWELL_SPEED = 8;

export class RockHop {
  private root = new THREE.Group();
  private azul: Person;
  private gas: Person;
  private idx = 0;
  private hop: { from: number; to: number; t: number } | null = null;
  private clock = 1.6;
  private swellX: number | null = null;
  private foam: THREE.Mesh;
  private splashT = 0;
  private lastWarn = false;
  private over = false;
  falls = 0;

  constructor(sc: THREE.Scene, private fx: Particles, private seaY: number, private onDone: () => void) {
    const m = new Merger();
    HOP_ROCKS.forEach((r, i) => {
      const h = r.safe ? SAFE_Y : LOW_Y;
      const s = r.safe ? 1.5 : 1.15;
      m.add(i % 2 ? G.rock : G.crag, r.safe ? 0xb8925c : 0x8e7350, r.x, h - 0.5, r.z, 0, i * 1.7, 0, s * 1.2, 1.05, s);
      // Cara plana, para apoyar los pies
      m.add(new THREE.CylinderGeometry(s * 0.46, s * 0.56, 0.1, 12), r.safe ? 0xc9a36b : 0x9c8058, r.x, h - 0.03, r.z, 0, i, 0);
    });
    this.root.add(m.mesh());
    const fg = new THREE.PlaneGeometry(2.6, 7).rotateX(-Math.PI / 2);
    const foamTex = glowTexture();
    this.foam = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: foamTex, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.foam.visible = false;
    this.foam.userData.noCast = true;
    this.root.add(this.foam);
    sc.add(this.root);
    this.azul = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    this.place(this.azul, 0);
    const end = HOP_ROCKS[HOP_ROCKS.length - 1];
    this.gas.root.position.set(end.x + 0.3, SAFE_Y + 0.02, end.z - 0.2);
    this.gas.root.rotation.y = -Math.PI / 2;
    sc.add(this.azul.root, this.gas.root);
  }

  private y(i: number) {
    return HOP_ROCKS[i].safe ? SAFE_Y : LOW_Y;
  }

  private place(p: Person, i: number) {
    const r = HOP_ROCKS[i];
    p.root.position.set(r.x, this.y(i) + 0.02, r.z);
  }

  /** Salto a la siguiente. */
  jump() {
    if (this.hop || this.over || this.idx >= HOP_ROCKS.length - 1) return;
    this.hop = { from: this.idx, to: this.idx + 1, t: 0 };
    audio.pop();
  }

  get canJump() {
    return !this.hop && !this.over;
  }

  /** La ola te ha pillado en una roca baja: al agua y a la última roca alta. */
  private wash() {
    this.falls++;
    this.hop = null;
    let back = this.idx;
    while (back > 0 && !HOP_ROCKS[back].safe) back--;
    this.idx = back;
    this.splashT = 0.7;
    const p = this.azul.root.position;
    this.fx.burst(p.clone().setY(this.seaY + 0.6), '💦', 12, 2.6, 1.4);
    audio.hit();
    vibrate([50, 30, 50]);
    toast(SIDE.hop.fall[this.falls % SIDE.hop.fall.length]);
    this.place(this.azul, back);
  }

  update(dt: number, camera: THREE.Camera, busy: boolean) {
    const az = this.azul;
    const cur = az.root.position;
    if (!busy && !this.over) {
      this.clock -= dt;
      if (this.clock < 1 && !this.lastWarn && this.swellX === null) {
        this.lastWarn = true;
        audio.whoosh();
      }
      if (this.clock <= 0 && this.swellX === null) {
        this.swellX = -3;
        this.foam.visible = true;
        this.clock = SWELL_EVERY;
        this.lastWarn = false;
      }
      if (this.swellX !== null) {
        this.swellX -= SWELL_SPEED * dt;
        const seaBob = 0.55;
        this.foam.position.set(this.swellX, this.seaY + seaBob * 0.7, 1.7);
        (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.85;
        if (this.swellX < -26) {
          this.swellX = null;
          this.foam.visible = false;
        } else if (!this.hop && !HOP_ROCKS[this.idx].safe && Math.abs(cur.x - this.swellX) < 0.9) this.wash();
      }
    }
    if (this.hop) {
      const h = this.hop;
      h.t += dt / 0.46;
      const k = Math.min(1, h.t);
      const a = HOP_ROCKS[h.from], b = HOP_ROCKS[h.to];
      const ya = this.y(h.from) + 0.02, yb = this.y(h.to) + 0.02;
      cur.set(THREE.MathUtils.lerp(a.x, b.x, k), THREE.MathUtils.lerp(ya, yb, k) + Math.sin(k * Math.PI) * 0.85, THREE.MathUtils.lerp(a.z, b.z, k));
      az.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      if (k >= 1) {
        this.idx = h.to;
        this.hop = null;
        audio.knock(0.3, 420, 0.06);
        if (this.idx >= HOP_ROCKS.length - 1) {
          this.over = true;
          audio.fanfare();
          dialogue(SIDE.hop.end, this.onDone);
        }
      }
    }
    if (this.splashT > 0) this.splashT -= dt;
    animatePerson(az, dt, this.hop ? 'walk' : 'idle', 0.9);
    if (this.hop) {
      az.armL.rotation.x = az.armR.rotation.x = -1.1;
    }
    animatePerson(this.gas, dt, this.over ? 'cheer' : 'wave');
    this.gas.root.rotation.y = Math.atan2(cur.x - this.gas.root.position.x, cur.z - this.gas.root.position.z);
    // La cámara, de lado, un poco por delante de ella
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.lerp(new THREE.Vector3(cur.x + 1.2, 1.15, cur.z + 6.4), 1 - Math.exp(-dt * 3.2));
    cam.lookAt(cur.x + 1.6, cur.y + 0.8, cur.z - 0.2);
  }

  dispose() {
    this.root.removeFromParent();
    this.azul.root.removeFromParent();
    this.gas.root.removeFromParent();
  }
}

// ---------------- Capítulo 4: apuntar en el urinario ----------------

/**
 * Primera persona en el urinario del estadio: el chorro va donde apunta el dedo, pero se desvía solo (las
 * cervezas) y al final pierde fuerza y cae más cerca. Dentro de la taza cuenta; en la mosca, más. Siempre se
 * acaba (cuando se vacía la vejiga): lo que cambia es el comentario.
 */
export class PeeAim {
  private wrap = el('div', 'pee-game');
  private cv = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private bg = document.createElement('canvas');
  private W = 0;
  private H = 0;
  private S = 0;
  private bowl = { x: 0, y: 0, rx: 0, ry: 0 };
  private fly = { x: 0, y: 0, r: 0 };
  private floorY = 0;
  private aim = { x: 0, y: 0 };
  private drift = { x: 0, y: 0 };
  private hit = { x: 0, y: 0 };
  private t = 0;
  private tank = 1;
  private inside = 0;
  private total = 0;
  private onFly = 0;
  private drops: { x: number; y: number; vx: number; vy: number; life: number; out: boolean }[] = [];
  private puddles: { x: number; y: number; r: number }[] = [];
  private raf = 0;
  private last = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  private fill: HTMLElement;
  private done = false;

  /** hard: 0 la primera vez, 1 la siguiente (se desvía más). */
  constructor(private hard: number, private onDone: (q: number) => void) {
    this.ctx = this.cv.getContext('2d')!;
    const head = el('div', 'pee-head');
    head.append(el('div', 'pee-title', SIDE.pee.title));
    const bar = el('div', 'pee-tank');
    bar.append(el('span', '', SIDE.pee.tank));
    const track = el('div', 'pee-track');
    this.fill = el('div', 'pee-fill');
    track.append(this.fill);
    bar.append(track);
    head.append(bar);
    this.wrap.append(this.cv, head, el('div', 'pee-hint', SIDE.pee.hint));
    uiRoot().append(this.wrap);
    this.layout();
    this.aim.x = this.bowl.x;
    this.aim.y = this.bowl.y;
    this.hit.x = this.aim.x;
    this.hit.y = this.aim.y;
    this.cv.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('resize', this.layout);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private down = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  private move = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.aim.x += (e.clientX - this.drag.x) * 1.1;
    this.aim.y += (e.clientY - this.drag.y) * 1.1;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
  };
  private up = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  };

  /** Dibuja el fondo una vez (azulejos, urinario, suelo) a la medida de la pantalla. */
  private layout = () => {
    const W = (this.W = window.innerWidth), H = (this.H = window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.cv, this.bg]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    this.cv.style.width = `${W}px`;
    this.cv.style.height = `${H}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (this.S = Math.min(W * 0.95, H * 0.62));
    const cx = W / 2;
    const top = H * 0.2;
    const uw = S * 0.62, uh = S * 0.92;
    this.bowl = { x: cx, y: top + uh * 0.56, rx: uw * 0.34, ry: uh * 0.26 };
    this.fly = { x: cx + uw * 0.06, y: this.bowl.y + this.bowl.ry * 0.38, r: S * 0.028 };
    this.floorY = Math.min(H * 0.86, top + uh + S * 0.12);
    const g = this.bg.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Azulejos blancos algo gastados, con su junta
    g.fillStyle = '#dfe4e6';
    g.fillRect(0, 0, W, H);
    const tile = Math.max(26, S * 0.11);
    for (let y = 0; y < this.floorY; y += tile)
      for (let x = (Math.floor(y / tile) % 2) * -tile * 0.5; x < W; x += tile) {
        const v = 226 + ((x * 7 + y * 13) % 17) - 8;
        g.fillStyle = `rgb(${v},${v + 3},${v + 5})`;
        g.fillRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
      }
    // Suelo de gres oscuro, en perspectiva
    const fg = g.createLinearGradient(0, this.floorY, 0, H);
    fg.addColorStop(0, '#6f6a64');
    fg.addColorStop(1, '#3f3b37');
    g.fillStyle = fg;
    g.fillRect(0, this.floorY, W, H - this.floorY);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.lineWidth = 1;
    for (let i = -8; i <= 8; i++) {
      g.beginPath();
      g.moveTo(cx + i * tile * 0.6, this.floorY);
      g.lineTo(cx + i * tile * 2.4, H);
      g.stroke();
    }
    // Sombra del urinario en la pared
    g.fillStyle = 'rgba(40,50,60,.18)';
    g.beginPath();
    g.ellipse(cx + S * 0.03, top + uh * 0.5, uw * 0.56, uh * 0.56, 0, 0, Math.PI * 2);
    g.fill();
    // Tubo y pulsador
    g.fillStyle = '#b9c0c4';
    g.fillRect(cx - S * 0.018, 0, S * 0.036, top + 4);
    g.fillStyle = '#9aa2a7';
    g.fillRect(cx - S * 0.03, top - S * 0.05, S * 0.06, S * 0.03);
    // La porcelana: cuerpo redondeado con un poco de volumen
    const pg = g.createLinearGradient(cx - uw / 2, 0, cx + uw / 2, 0);
    pg.addColorStop(0, '#d9dfe2');
    pg.addColorStop(0.35, '#ffffff');
    pg.addColorStop(0.8, '#eef2f3');
    pg.addColorStop(1, '#c6cdd1');
    g.fillStyle = pg;
    g.beginPath();
    g.moveTo(cx - uw * 0.42, top);
    g.quadraticCurveTo(cx, top - uh * 0.08, cx + uw * 0.42, top);
    g.bezierCurveTo(cx + uw * 0.56, top + uh * 0.35, cx + uw * 0.55, top + uh * 0.8, cx + uw * 0.3, top + uh);
    g.quadraticCurveTo(cx, top + uh * 1.07, cx - uw * 0.3, top + uh);
    g.bezierCurveTo(cx - uw * 0.55, top + uh * 0.8, cx - uw * 0.56, top + uh * 0.35, cx - uw * 0.42, top);
    g.fill();
    g.strokeStyle = 'rgba(90,100,110,.35)';
    g.lineWidth = 2;
    g.stroke();
    // La taza: hueco en sombra
    const b = this.bowl;
    const bg2 = g.createRadialGradient(b.x, b.y - b.ry * 0.4, b.rx * 0.1, b.x, b.y, b.rx * 1.1);
    bg2.addColorStop(0, '#f4f7f8');
    bg2.addColorStop(0.7, '#d4dade');
    bg2.addColorStop(1, '#aeb6bb');
    g.fillStyle = bg2;
    g.beginPath();
    g.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(80,90,100,.4)';
    g.stroke();
    // Rejilla del desagüe
    g.fillStyle = '#8d969c';
    g.beginPath();
    g.ellipse(b.x, b.y + b.ry * 0.62, b.rx * 0.22, b.ry * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5f676c';
    g.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(b.x + i * b.rx * 0.07, b.y + b.ry * 0.53);
      g.lineTo(b.x + i * b.rx * 0.07, b.y + b.ry * 0.71);
      g.stroke();
    }
    // La mosca pintada (la de los urinarios de verdad)
    const f = this.fly;
    g.fillStyle = 'rgba(160,190,210,.55)';
    g.beginPath();
    g.ellipse(f.x - f.r * 0.6, f.y - f.r * 0.3, f.r * 0.8, f.r * 0.45, -0.5, 0, Math.PI * 2);
    g.ellipse(f.x + f.r * 0.6, f.y - f.r * 0.3, f.r * 0.8, f.r * 0.45, 0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1d1f22';
    g.beginPath();
    g.ellipse(f.x, f.y, f.r * 0.42, f.r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(f.x, f.y - f.r * 0.75, f.r * 0.3, 0, Math.PI * 2);
    g.fill();
  };

  private frame = (now: number) => {
    if (this.done) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    this.t += dt;
    // Se desvía solo: un vaivén y una deriva que cambia de rumbo (más la segunda vez)
    const k = 1 + this.hard * 0.8;
    this.drift.x += ((Math.random() - 0.5) * 900 * k - this.drift.x * 1.6) * dt;
    this.drift.y += ((Math.random() - 0.5) * 520 * k - this.drift.y * 1.6) * dt;
    this.aim.x += (this.drift.x + Math.sin(this.t * 1.7) * 26 * k) * dt;
    this.aim.y += (this.drift.y + Math.cos(this.t * 1.3) * 16 * k) * dt;
    this.aim.x = Math.max(10, Math.min(this.W - 10, this.aim.x));
    this.aim.y = Math.max(this.H * 0.08, Math.min(this.H - 10, this.aim.y));
    // Fuerza: al vaciarse cae más cerca (más abajo en pantalla)
    this.tank = Math.max(0, this.tank - dt / 8.5);
    const press = Math.min(1, 0.45 + this.tank * 2.2);
    const ox = this.W / 2 + Math.sin(this.t * 2.1) * 4, oy = this.H + 12;
    this.hit.x = ox + (this.aim.x - ox) * press;
    this.hit.y = oy + (this.aim.y - oy) * press;
    const b = this.bowl;
    const inBowl = ((this.hit.x - b.x) / b.rx) ** 2 + ((this.hit.y - b.y) / b.ry) ** 2 < 1;
    const onFly = Math.hypot(this.hit.x - this.fly.x, this.hit.y - this.fly.y) < this.fly.r * 2.2;
    this.total += dt;
    if (inBowl) this.inside += dt;
    if (onFly) this.onFly += dt;
    // Salpicaduras: en la taza, gotitas que rebotan; fuera, gotas que caen al suelo y hacen charco
    for (let i = 0; i < 3; i++)
      this.drops.push({ x: this.hit.x, y: this.hit.y, vx: (Math.random() - 0.5) * 140, vy: -40 - Math.random() * 90, life: 0.35 + Math.random() * 0.25, out: !inBowl });
    for (const d of this.drops) {
      d.life -= dt;
      d.vy += 900 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.out && d.y > this.floorY + 8 && d.life > 0) {
        d.life = 0;
        if (this.puddles.length < 60 && Math.random() < 0.25) this.puddles.push({ x: d.x, y: this.floorY + 10 + Math.random() * (this.H - this.floorY) * 0.4, r: 4 + Math.random() * 10 });
      }
    }
    this.drops = this.drops.filter((d) => d.life > 0);
    if (!inBowl && Math.random() < dt * 3) vibrate(8);
    this.draw(ox, oy, press, inBowl);
    this.fill.style.transform = `scaleX(${this.tank})`;
    if (this.tank <= 0) this.finish();
  };

  private draw(ox: number, oy: number, press: number, inBowl: boolean) {
    const g = this.ctx;
    g.clearRect(0, 0, this.W, this.H);
    g.drawImage(this.bg, 0, 0, this.W, this.H);
    // Charcos
    g.fillStyle = 'rgba(232,206,90,.28)';
    for (const p of this.puddles) {
      g.beginPath();
      g.ellipse(p.x, p.y, p.r * 1.6, p.r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    // El chorro: un arco que sale de abajo, más fino cuanto menos fuerza
    const mx = (ox + this.hit.x) / 2, my = Math.min(oy, this.hit.y) - this.S * 0.1 * press;
    const wide = 2 + press * 4;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(236,200,60,.55)';
    g.lineWidth = wide + 3;
    g.beginPath();
    g.moveTo(ox, oy);
    g.quadraticCurveTo(mx, my, this.hit.x, this.hit.y);
    g.stroke();
    g.strokeStyle = 'rgba(255,240,170,.85)';
    g.lineWidth = Math.max(1, wide * 0.45);
    g.stroke();
    // Gotas
    for (const d of this.drops) {
      g.fillStyle = d.out ? 'rgba(236,200,60,.8)' : 'rgba(255,248,210,.85)';
      g.beginPath();
      g.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    // La mira: dónde estás apuntando (y si cae dentro)
    g.strokeStyle = inBowl ? 'rgba(80,200,120,.9)' : 'rgba(230,80,70,.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(this.aim.x, this.aim.y, 13, 0, Math.PI * 2);
    g.stroke();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    const q = this.total > 0 ? this.inside / this.total : 0;
    toast((q > 0.85 ? SIDE.pee.great : q > 0.6 ? SIDE.pee.ok : SIDE.pee.bad) + (this.onFly > 1.4 ? SIDE.pee.fly : ''));
    audio.knock(0.3, 300, 0.2); // la cisterna
    later(() => {
      this.dispose();
      this.onDone(q);
    }, 900);
  }

  dispose() {
    this.done = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    window.removeEventListener('resize', this.layout);
    this.wrap.remove();
  }
}

// ---------------- Capítulo 4: las gafas de sol en el baño ----------------

/** Fila de cabinas: se abren tocándolas; dos están averiadas y en una, encima de la cisterna, las gafas. */
export class GlassesHunt {
  private wrap = el('div', 'gh-game');
  private say: HTMLElement;
  private tries = 0;
  private done = false;
  private timers: number[] = [];

  constructor(private onDone: () => void) {
    const N = 5;
    const broken = [1, 3];
    const working = [0, 2, 4];
    // Nunca en la primera que se mira: se decide al tocar la segunda que funciona
    let opened = 0;
    this.wrap.append(el('div', 'gh-title', SIDE.glasses.title), el('div', 'gh-hint', SIDE.glasses.hint));
    const row = el('div', 'gh-row');
    for (let i = 0; i < N; i++) {
      const d = el('button', 'gh-door' + (broken.includes(i) ? ' broken' : ''));
      const inside = el('div', 'gh-inside');
      inside.append(el('i', 'gh-cistern'), el('span', 'gh-wc', '🚽'));
      const panel = el('div', 'gh-panel');
      panel.append(el('span', 'gh-sign', broken.includes(i) ? 'AVERIADO' : 'WC'), el('i', 'gh-handle'));
      d.append(inside, panel);
      d.onpointerdown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.done || d.classList.contains('open')) return;
        if (broken.includes(i)) {
          d.classList.remove('shake');
          void d.offsetWidth;
          d.classList.add('shake');
          this.line(SIDE.glasses.broken);
          audio.knock(0.4, 160, 0.08);
          return;
        }
        d.classList.add('open');
        audio.knock(0.25, 420, 0.06);
        opened++;
        const isIt = opened >= 2 || (opened === 1 && working.length === 1);
        if (isIt) {
          inside.append(el('span', 'gh-glasses', '🕶️'));
          this.found();
        } else this.line(SIDE.glasses.empty[this.tries++ % SIDE.glasses.empty.length]);
      };
      row.append(d);
    }
    this.say = el('div', 'gh-say');
    this.wrap.append(row, this.say);
    uiRoot().append(this.wrap);
  }

  private line(t: string) {
    this.say.textContent = t;
    this.say.classList.remove('pop');
    void this.say.offsetWidth;
    this.say.classList.add('pop');
  }

  private found() {
    this.done = true;
    this.line(SIDE.glasses.found);
    audio.luck();
    vibrate([20, 30, 20]);
    this.timers.push(later(() => {
      this.dispose();
      this.onDone();
    }, 1900));
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    this.wrap.remove();
  }
}
