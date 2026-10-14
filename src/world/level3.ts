import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { CONCERT } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, animatePerson, Person, personGeometry, vertexMat, PersonLook } from '../entities/models';
import { Sky, Sun, toon, glowTexture, vibrate, Fireworks } from '../core/gfx';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, fadeFlash, Hud, DebugItem } from '../ui/ui';
import type { Box2 } from './ferreries';
import type { Level, LevelDone } from './level';

// Capítulo 3 · Fito bajo las estrellas (Canarias).
// Pista en la barra (tabaco opcional a la papelera) → ir 4 veces a los WC portátiles (uno libre cada vez)
// → abrirse paso entre la multitud hasta Gas → minijuego de ritmo → fuegos artificiales → regalo.

type Phase = 'intro' | 'findBar' | 'wc' | 'back' | 'findGas' | 'rhythm' | 'ending' | 'done';

const BAR_POS = new THREE.Vector3(-17, 0, -8);
const GAS_POS = new THREE.Vector3(-8.5, 0, 24.2);
const SMOKE_POS = new THREE.Vector3(-12.5, 0, 2);
const AISLE_X = -8.5;
// WC portátiles a la derecha, con la puerta mirando al recinto
const WC_X = 17;
const WC_Z = [-17, -15.5, -14, -12.5, -11, -9.5];
const WC_NEED = 4;
const CONCERT_SPOT = new THREE.Vector3(0, 0, 2);
// Camino serpenteante entre el público hasta Gas
const CROWD_PATH: [number, number][] = [[-8.5, 4], [-5.5, 9], [-10, 13.5], [-6, 18], [-9.5, 21.5], [GAS_POS.x, GAS_POS.z]];
function distToPath(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < CROWD_PATH.length - 1; i++) {
    const [ax, az] = CROWD_PATH[i];
    const [bx, bz] = CROWD_PATH[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

function canvasTex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface RNote {
  t: number;
  lane: number;
  semi: number;
  done: boolean;
  scheduled: boolean;
}

// Riff original en Mi menor (semitonos respecto a La4). Índice = corchea dentro de 2 compases.
const RIFF_A: [number, number][] = [[0, -17], [2, -17], [3, -14], [4, -12], [6, -14], [8, -17], [10, -17], [11, -14], [12, -10], [13, -12], [14, -14]];
const RIFF_B: [number, number][] = [[0, -12], [2, -12], [3, -10], [4, -7], [6, -10], [8, -12], [10, -14], [12, -17], [14, -17]];
const SONG = [RIFF_A, RIFF_A, RIFF_B, RIFF_A, RIFF_B, RIFF_B, RIFF_A];
const EIGHTH = 0.25;
const TRAVEL = 1.6; // segundos que tarda una nota en bajar

/** Minijuego de ritmo en un canvas 2D sobre la escena. */
class Rhythm {
  private wrap: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private notes: RNote[] = [];
  private t0: number;
  private flash = [0, 0, 0];
  private label = '';
  private labelT = 0;
  hits = 0;
  combo = 0;
  maxCombo = 0;
  perfects = 0;
  onHit: (lane: number, perfect: boolean, combo: number) => void = () => {};
  private rings: { lane: number; t: number; perfect: boolean }[] = [];
  total = 0;
  finished = false;
  beat = 0; // para animar el público
  private end: number;
  private nextDrum = 0;
  private colors = ['#e2547a', '#f4c95d', '#3cc6b0'];
  private onKey = (e: KeyboardEvent) => {
    const m: Record<string, number> = { KeyA: 0, KeyS: 1, KeyD: 2, KeyJ: 0, KeyK: 1, KeyL: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 };
    if (e.code in m) this.press(m[e.code]);
  };

  constructor() {
    this.wrap = document.createElement('div');
    this.wrap.className = 'rhythm';
    this.canvas = document.createElement('canvas');
    this.wrap.append(this.canvas);
    const btns = document.createElement('div');
    btns.className = 'rhythm-btns';
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('button');
      b.style.background = this.colors[i];
      b.textContent = ['♪', '♫', '♬'][i];
      b.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.press(i);
      };
      btns.append(b);
    }
    this.wrap.append(btns);
    document.getElementById('ui')!.append(this.wrap);
    this.ctx = this.canvas.getContext('2d')!;
    window.addEventListener('keydown', this.onKey);

    this.t0 = audio.time() + 2.2;
    let bar = 0;
    for (const riff of SONG) {
      for (const [e, semi] of riff) {
        const lane = semi <= -16 ? 0 : semi <= -11 ? 1 : 2;
        this.notes.push({ t: this.t0 + (bar * 16 + e) * EIGHTH, lane, semi, done: false, scheduled: false });
      }
      bar++;
    }
    // Acorde final largo
    this.notes.push({ t: this.t0 + bar * 16 * EIGHTH, lane: 0, semi: -17, done: false, scheduled: false });
    this.total = this.notes.length;
    this.end = this.t0 + (bar * 16 + 8) * EIGHTH;
  }

  private press(lane: number) {
    const now = audio.time();
    this.flash[lane] = 1;
    let best: RNote | null = null;
    let bd = 0.24;
    for (const n of this.notes) {
      if (n.done || n.lane !== lane) continue;
      const d = Math.abs(n.t - now);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (!best) return;
    best.done = true;
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const perfect = bd < 0.09;
    if (perfect) this.perfects++;
    this.label = perfect ? '¡Perfecto!' : '¡Bien!';
    if (this.combo > 0 && this.combo % 10 === 0) this.label = `¡${this.combo} seguidas! 🔥`;
    this.labelT = 0.6;
    this.rings.push({ lane, t: 0, perfect });
    this.onHit(lane, perfect, this.combo);
  }

  update(dt: number) {
    const now = audio.time();
    // Programar audio con margen
    for (const n of this.notes) {
      if (!n.scheduled && n.t < now + 0.3) {
        n.scheduled = true;
        audio.guitarAt(n.semi, Math.max(now, n.t), n === this.notes[this.notes.length - 1] ? 1.6 : 0.22);
      }
      if (!n.done && now - n.t > 0.24) {
        n.done = true;
        if (this.combo >= 5) {
          this.label = 'Buu…';
          this.labelT = 0.5;
        }
        this.combo = 0;
      }
    }
    while (this.t0 + this.nextDrum * EIGHTH * 2 < now + 0.3 && this.t0 + this.nextDrum * EIGHTH * 2 < this.end) {
      const t = Math.max(now, this.t0 + this.nextDrum * EIGHTH * 2);
      if (this.nextDrum % 2 === 0) audio.kickAt(t);
      else audio.snareAt(t);
      this.nextDrum++;
    }
    this.beat = Math.max(0, (now - this.t0) / (EIGHTH * 2));
    if (now > this.end + 0.8) this.finished = true;
    this.labelT -= dt;
    for (let i = 0; i < 3; i++) this.flash[i] = Math.max(0, this.flash[i] - dt * 4);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.35);
    this.draw(now);
  }

  private draw(now: number) {
    const c = this.canvas;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const x = this.ctx;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    const lw = w / 3;
    const hitY = h - 18;
    for (let i = 0; i < 3; i++) {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(20,10,30,0.15)');
      g.addColorStop(1, `rgba(20,10,30,${0.6 + this.flash[i] * 0.2})`);
      x.fillStyle = g;
      x.fillRect(i * lw + 2, 0, lw - 4, h);
      if (this.flash[i] > 0) {
        x.fillStyle = this.colors[i];
        x.globalAlpha = this.flash[i] * 0.35;
        x.fillRect(i * lw + 2, hitY - 40, lw - 4, 40);
        x.globalAlpha = 1;
      }
      // Diana de cada carril
      x.strokeStyle = this.colors[i];
      x.lineWidth = 3;
      x.beginPath();
      x.arc(i * lw + lw / 2, hitY, Math.min(lw * 0.32, 20) + 3, 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.fillRect(0, hitY - 1, w, 2);
    for (const r of this.rings) {
      const k = r.t / 0.35;
      x.strokeStyle = r.perfect ? '#fff4a0' : this.colors[r.lane];
      x.globalAlpha = 1 - k;
      x.lineWidth = 5;
      x.beginPath();
      x.arc(r.lane * lw + lw / 2, hitY, 20 + k * 30, 0, Math.PI * 2);
      x.stroke();
      x.globalAlpha = 1;
    }
    for (const n of this.notes) {
      if (n.done) continue;
      const k = 1 - (n.t - now) / TRAVEL;
      if (k < 0 || k > 1.2) continue;
      const y = k * hitY;
      x.fillStyle = this.colors[n.lane];
      x.shadowColor = this.colors[n.lane];
      x.shadowBlur = 14;
      x.beginPath();
      x.arc(n.lane * lw + lw / 2, y, Math.min(lw * 0.32, 20), 0, Math.PI * 2);
      x.fill();
      x.shadowBlur = 0;
      x.strokeStyle = 'white';
      x.lineWidth = 3;
      x.stroke();
    }
    if (now < this.t0) {
      x.fillStyle = 'white';
      x.font = '600 22px Fredoka, sans-serif';
      x.textAlign = 'center';
      x.fillText(String(Math.ceil(this.t0 - now)), w / 2, h / 2);
    }
    if (this.labelT > 0) {
      x.fillStyle = 'white';
      x.font = '600 18px Fredoka, sans-serif';
      x.textAlign = 'center';
      x.fillText(this.label, w / 2, h * 0.35);
    }
    x.fillStyle = 'white';
    x.font = '600 14px Fredoka, sans-serif';
    x.textAlign = 'left';
    x.fillText(`🎵 ${this.hits}/${this.total}`, 6, 18);
    if (this.combo >= 3) {
      x.textAlign = 'right';
      x.fillStyle = '#f4d35e';
      x.fillText(`x${this.combo}`, w - 6, 18);
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    this.wrap.remove();
  }
}

export class Level3 implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private fireworks = new Fireworks();
  private phase: Phase = 'intro';
  private player: Person;
  private walker: Walker;
  private gas: Person;
  private barman: Person;
  private smoke: THREE.Group;
  private smokeThrown = false;
  private colliders: Box2[] = [];
  private people: Circle[] = [];
  private wcVisits = 0;
  private wcFree = [false, true, false, false, true, false];
  private wcLights: THREE.MeshBasicMaterial[] = [];
  private pushT = 0;
  private v1 = new THREE.Vector3();
  private bounds: Box2 = { minX: -22, maxX: 22, minZ: -22, maxZ: 27.5 };
  private crowds: { mesh: THREE.InstancedMesh; base: { x: number; z: number; ry: number; ph: number }[] }[] = [];
  private spots: { mesh: THREE.Mesh; ph: number }[] = [];
  private band: Person[] = [];
  private marker: THREE.Mesh;
  private rhythm: Rhythm | null = null;
  private sky: Sky;
  private sun: Sun;
  private screenCtx: CanvasRenderingContext2D[] = [];
  private screenTex: THREE.CanvasTexture[] = [];
  private screenT = 0;
  private lasers: THREE.Group = new THREE.Group();
  private lighters!: THREE.Points;
  private result = { hits: 0, total: 0, perfects: 0, maxCombo: 0 };
  private t = 0;
  private busy = false;
  private endT = 0;
  private camTarget = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a1340, 40, 260);
    this.sky = new Sky({ top: 0x05041a, mid: 0x1a1446, bottom: 0x3a2050, stars: 900 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x9a8cff, 0x4a3a50, 1.5));
    // Luz principal desde el escenario (rosa), con sombras que siguen a Azul
    this.sun = new Sun(sc, 0xffc0e0, 1.6, new THREE.Vector3(0.3, 0.9, 1), 22);

    this.buildWorld();
    this.fx = new Particles(sc);
    sc.add(this.fireworks.points);

    this.player = makePerson(MARGAUX_LOOK);
    this.walker = new Walker(this.player.root.position);
    this.player.root.position.set(0, 0, -18);
    sc.add(this.player.root);

    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.copy(GAS_POS);
    this.gas.root.rotation.y = Math.PI;
    sc.add(this.gas.root);
    // El público y Gas no se pueden atravesar
    this.people = this.crowds.flatMap((c) => c.base.map((b) => ({ x: b.x, z: b.z, r: 0.35 })));
    this.people.push({ x: GAS_POS.x, z: GAS_POS.z, r: 0.35 });

    this.barman = makePerson({ skin: 0xc98e64, shirt: 0x111111, pants: 0x111111, hair: 0x1a1a1a, hairStyle: 'short' });
    this.barman.root.position.set(BAR_POS.x - 1.6, 0, BAR_POS.z);
    this.barman.root.rotation.y = Math.PI / 2;
    sc.add(this.barman.root);

    // Paquete de tabaco (opcional: a la papelera)
    this.smoke = new THREE.Group();
    this.smoke.add(new Merger().add(G.box, 0xd7263d, 0, 0.12, 0, 0, 0.4, 0, 0.35, 0.2, 0.5).add(G.box, 0xffffff, 0, 0.23, 0, 0, 0.4, 0, 0.36, 0.02, 0.2).mesh());
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.position.y = 0.03;
    this.smoke.add(ring);
    this.smoke.position.copy(SMOKE_POS);
    sc.add(this.smoke);

    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffd23f, fog: false }));
    sc.add(this.marker);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.walker.yaw = 0;
    this.walker.facing = 0;
    this.camera.position.set(0, 5, -27);
    this.updateHud();
    audio.startMusic('road');
    audio.ambience(0.12);
    this.busy = true;
    setTimeout(() => {
      if (this.phase !== 'intro') return;
      dialogue(CONCERT.intro, () => {
        this.busy = false;
        this.phase = 'findBar';
        this.updateHud();
      });
    }, 500);
  }

  get threeScene() {
    return this.scene;
  }

  private buildWorld() {
    const sc = this.scene;
    // Suelo de picón volcánico
    const tex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#3b3430';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) {
        const v = 40 + Math.random() * 40;
        ctx.fillStyle = `rgb(${v + 10},${v},${v - 5})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    }, 256, 256);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), toon({ map: tex }));
    ground.userData.noCast = true;
    sc.add(ground);

    // Luna
    const moon = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
    moon.position.set(-90, 110, 220);
    sc.add(moon);

    const m = new Merger();
    // El Teide al fondo
    m.add(new THREE.ConeGeometry(1, 1, 7), 0x2a2238, 70, 0, 230, 0, 0, 0, 120, 70, 120);
    m.add(new THREE.ConeGeometry(1, 1, 7), 0xe8e6f0, 70, 62, 230, 0, 0, 0, 17, 12, 17);
    m.add(new THREE.ConeGeometry(1, 1, 6), 0x231d30, -60, 0, 210, 0, 0, 0, 90, 30, 70);

    // Escenario
    m.add(G.box, 0x1b1b22, 0, 0.8, 34, 0, 0, 0, 26, 1.6, 9);
    m.add(G.box, 0x111116, 0, 6, 38.6, 0, 0, 0, 26, 10, 0.3); // telón
    for (const x of [-13, 13]) {
      m.add(G.box, 0x9a9aa6, x, 5.5, 30, 0, 0, 0, 0.4, 11, 0.4);
      m.add(G.box, 0x9a9aa6, x, 5.5, 38, 0, 0, 0, 0.4, 11, 0.4);
      m.add(G.box, 0x222228, x * 1.12, 2.6, 31, 0, 0, 0, 2.4, 5.2, 2); // altavoces
      m.add(G.box, 0x3a3a44, x * 1.12, 3.4, 29.99, 0, 0, 0, 1.4, 1.4, 0.02);
      m.add(G.box, 0x3a3a44, x * 1.12, 1.6, 29.99, 0, 0, 0, 1.4, 1.4, 0.02);
    }
    m.add(G.box, 0x9a9aa6, 0, 11, 30, 0, 0, 0, 26.4, 0.4, 0.4);
    m.add(G.box, 0x9a9aa6, 0, 11, 38, 0, 0, 0, 26.4, 0.4, 0.4);
    // Batería
    m.add(G.cyl, 0xd7263d, 0, 2.2, 36, Math.PI / 2, 0, 0, 1.2, 0.8, 1.2);
    m.add(G.cyl, 0xcccccc, -1.1, 2.6, 35.6, 0, 0, 0, 0.7, 0.3, 0.7);
    m.add(G.cyl, 0xe8c66a, 1.3, 3.2, 35.6, 0.2, 0, 0, 1, 0.04, 1);
    // Valla delante del escenario
    m.add(G.box, 0x777780, 0, 0.6, 28.6, 0, 0, 0, 30, 1.2, 0.2);
    this.colliders.push({ minX: -15, maxX: 15, minZ: 28.4, maxZ: 40 });

    // Barra
    m.add(G.box, 0x8a5a36, BAR_POS.x, 0.6, BAR_POS.z, 0, 0, 0, 1, 1.2, 8);
    m.add(G.box, 0xd9c7a5, BAR_POS.x, 1.23, BAR_POS.z, 0, 0, 0, 1.3, 0.06, 8.2);
    m.add(G.box, 0x3a2a20, BAR_POS.x - 2.6, 1.6, BAR_POS.z, 0, 0, 0, 0.4, 3.2, 8);
    for (let i = 0; i < 8; i++) m.add(G.cyl, i % 2 ? 0xf4c95d : 0x2f7d4a, BAR_POS.x - 2.2, 1.5 + (i % 2) * 0.8, BAR_POS.z - 3 + i * 0.8, 0, 0, 0, 0.15, 0.5, 0.15);
    this.colliders.push({ minX: BAR_POS.x - 0.5, maxX: BAR_POS.x + 0.5, minZ: BAR_POS.z - 4, maxZ: BAR_POS.z + 4 });

    // Palmeras
    const palm = (x: number, z: number, h: number) => {
      for (let i = 0; i < 6; i++) m.add(G.cyl, 0x6b5a40, x + Math.sin(i * 0.3) * 0.4, (i + 0.5) * (h / 6), z, 0, 0, 0.05, 0.5 - i * 0.03, h / 6, 0.5 - i * 0.03);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        m.add(G.box, 0x2f6b3a, x + Math.cos(a) * 1.6, h - 0.2, z + Math.sin(a) * 1.6, 0, -a, 0.45, 3.2, 0.1, 0.8);
      }
      this.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
    };
    for (const [x, z, h] of [[-21, -16, 8], [21, -4, 9], [-21, 6, 9], [21, 8, 7.5], [-20, 22, 8.5], [20, 22, 9], [-28, 30, 10], [28, 30, 10]]) palm(x, z, h);
    this.buildToilets(m);
    sc.add(m.mesh());

    // Pantallas animadas: ecualizador al ritmo de la música
    for (const x of [-18.5, 18.5]) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.screenCtx.push(c.getContext('2d')!);
      this.screenTex.push(tex);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      s.position.set(x, 7, 30);
      s.rotation.y = Math.PI + (x > 0 ? 0.25 : -0.25);
      sc.add(s);
      const p = new Merger().add(G.box, 0x222228, x, 2.4, 30.2, 0, 0, 0, 0.3, 4.8, 0.3).mesh();
      sc.add(p);
    }
    this.drawScreens(0, 0);

    // Láseres que barren el cielo durante el concierto
    const laserGeo = new THREE.BoxGeometry(0.08, 0.08, 60).translate(0, 0, -30);
    const laserColors = [0x3cc6b0, 0xe2547a, 0xf4d35e, 0x7a5cff];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: laserColors[i % 4], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      l.position.set(-12 + (i % 4) * 8, 11, 31);
      l.userData.ph = i * 0.8;
      this.lasers.add(l);
    }
    this.lasers.visible = false;
    sc.add(this.lasers);

    // Focos (conos aditivos que barren el público)
    const spotGeo = new THREE.ConeGeometry(2.4, 14, 16, 1, true).translate(0, -7, 0);
    [-10, -5, 0, 5, 10].forEach((x, i) => {
      const mesh = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      mesh.position.set(x, 10.8, 30.4);
      sc.add(mesh);
      this.spots.push({ mesh, ph: i * 1.3 });
    });

    // Banda
    const guitarist = makePerson({ skin: 0xe2b08c, shirt: 0x111111, pants: 0x222244, hair: 0x111111, hairStyle: 'cap' });
    guitarist.root.position.set(0, 1.6, 32.5);
    guitarist.root.rotation.y = Math.PI;
    guitarist.body.add(new Merger().add(G.box, 0x9b2335, 0.1, 1.05, 0.28, 0, 0, -0.6, 0.45, 0.9, 0.12).add(G.box, 0x6b4428, -0.35, 1.45, 0.28, 0, 0, -0.6, 0.08, 0.9, 0.06).mesh());
    const bassist = makePerson({ skin: 0xd9a27c, shirt: 0x3a3a44, pants: 0x111111, hair: 0x5a3a22, hairStyle: 'long' });
    bassist.root.position.set(-6, 1.6, 33);
    bassist.root.rotation.y = Math.PI;
    bassist.body.add(new Merger().add(G.box, 0x1f5fbf, 0.1, 1.05, 0.28, 0, 0, -0.6, 0.42, 0.85, 0.12).mesh());
    const sax = makePerson({ skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x111111, hair: 0x222222, hairStyle: 'short' });
    sax.root.position.set(6, 1.6, 33);
    sax.root.rotation.y = Math.PI;
    const drummer = makePerson({ skin: 0xe8b894, shirt: 0xffffff, pants: 0x111111, hair: 0x888888, hairStyle: 'short' });
    drummer.root.position.set(0, 1.6, 36.8);
    drummer.root.rotation.y = Math.PI;
    this.band = [guitarist, bassist, sax, drummer];
    this.band.forEach((b) => sc.add(b.root));

    // Público (instanciado), con un pasillo a la izquierda por donde llegar hasta Gas
    const looks: PersonLook[] = [
      { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
      { skin: 0xd9a27c, shirt: 0x1b998b, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
      { skin: 0xf0c8a6, shirt: 0xd7263d, pants: 0x222222, hair: 0xb07a3a, hairStyle: 'cap' },
      { skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'bun' },
    ];
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < 6000 && pts.length < 230; i++) {
      const x = -13 + Math.random() * 26;
      const z = 6 + Math.random() * 21.5;
      if (distToPath(x, z) < 0.85) continue;
      if (Math.hypot(x - GAS_POS.x, z - GAS_POS.z) < 1.6) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.92)) continue;
      pts.push({ x, z });
    }
    looks.forEach((lk, li) => {
      const mine = pts.filter((_, i) => i % looks.length === li);
      const mesh = new THREE.InstancedMesh(personGeometry(lk, li % 2 === 0), vertexMat(), mine.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sc.add(mesh);
      this.crowds.push({ mesh, base: mine.map((p) => ({ ...p, ry: Math.PI + (Math.random() - 0.5) * 0.6, ph: Math.random() * 6 })) });
    });
    // Mecheros (y móviles) en alto entre el público
    const lp = new Float32Array(pts.length * 3);
    let n = 0;
    pts.forEach((p, i) => {
      if (i % 3) return;
      lp.set([p.x + 0.3, 2.15, p.z], n * 3);
      n++;
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp.slice(0, n * 3), 3));
    this.lighters = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffc070, size: 0.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lighters.visible = false;
    sc.add(this.lighters);
  }

  /** Fila de WC portátiles azules, con la luz de libre/ocupado en cada puerta. */
  private buildToilets(m: Merger) {
    const sc = this.scene;
    const sign = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1f4fa8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 120px Arial, sans-serif';
      ctx.fillText('WC', w / 2, h * 0.36);
      // Hombre y mujer
      for (const [cx, skirt] of [[w * 0.33, false], [w * 0.67, true]] as const) {
        ctx.beginPath();
        ctx.arc(cx, h * 0.66, 14, 0, Math.PI * 2);
        ctx.fill();
        if (skirt) {
          ctx.beginPath();
          ctx.moveTo(cx, h * 0.72);
          ctx.lineTo(cx - 22, h * 0.95);
          ctx.lineTo(cx + 22, h * 0.95);
          ctx.fill();
        } else ctx.fillRect(cx - 12, h * 0.72, 24, h * 0.23);
      }
    }, 256, 256);
    const signMat = new THREE.MeshBasicMaterial({ map: sign, color: 0xcfd6e6 });
    for (let i = 0; i < WC_Z.length; i++) {
      const z = WC_Z[i];
      const fx = WC_X - 0.62; // cara de la puerta
      m.add(G.box, 0x2a63c4, WC_X, 1.15, z, 0, 0, 0, 1.2, 2.3, 1.3); // cabina de plástico
      m.add(G.cyl, 0xe9eef5, WC_X, 2.36, z, 0, 0, 0, 1.45, 0.14, 1.45); // techo blanco
      m.add(G.box, 0xe9eef5, WC_X, 0.04, z, 0, 0, 0, 1.3, 0.08, 1.4); // base
      m.add(G.box, 0x2457b3, fx - 0.02, 1.08, z, 0, 0, 0, 0.04, 2.0, 1.0); // puerta
      for (let k = 0; k < 4; k++) m.add(G.box, 0x1b3f80, fx - 0.05, 1.9 + k * 0.07, z, 0, 0, 0, 0.02, 0.025, 0.6); // rejilla
      m.add(G.box, 0xc0c4cc, fx - 0.06, 1.05, z - 0.36, 0, 0, 0, 0.05, 0.22, 0.06); // tirador
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), signMat);
      pl.position.set(fx - 0.05, 1.45, z + 0.1);
      pl.rotation.y = -Math.PI / 2;
      sc.add(pl);
      // Indicador libre / ocupado
      const mat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.22), mat);
      ind.position.set(fx - 0.06, 1.2, z - 0.36);
      // Piloto grande encima de la puerta, visible desde lejos
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
      lamp.position.set(fx - 0.05, 2.15, z);
      sc.add(ind, lamp);
      this.wcLights.push(mat);
    }
    this.colliders.push({ minX: WC_X - 0.65, maxX: WC_X + 0.65, minZ: WC_Z[0] - 0.7, maxZ: WC_Z[WC_Z.length - 1] + 0.7 });
    // Foco que ilumina la zona de baños
    m.add(G.cyl, 0x3a3a44, WC_X + 1.5, 3, WC_Z[2] + 0.75, 0, 0, 0, 0.12, 6, 0.12);
    m.add(G.box, 0x3a3a44, WC_X + 1.2, 6, WC_Z[2] + 0.75, 0, 0, 0.5, 0.6, 0.3, 0.9);
    const flood = new THREE.PointLight(0xdfe8ff, 22, 16, 1.6);
    flood.position.set(WC_X - 1, 5.6, WC_Z[2] + 0.75);
    sc.add(flood);
    this.paintToilets();
  }

  private paintToilets() {
    this.wcLights.forEach((m, i) => m.color.set(this.wcFree[i] ? 0x2ecc71 : 0xe74c3c));
  }

  /** Índice del WC más cercano a la puerta (si Azul está delante de alguno). */
  private toiletAt(p: THREE.Vector3) {
    for (let i = 0; i < WC_Z.length; i++) if (Math.abs(p.x - (WC_X - 1.3)) < 1.1 && Math.abs(p.z - WC_Z[i]) < 0.65) return i;
    return -1;
  }

  private nearestFreeToilet() {
    const p = this.player.root.position;
    let best = -1;
    let bd = Infinity;
    this.wcFree.forEach((f, i) => {
      const d = Math.abs(p.z - WC_Z[i]);
      if (f && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  private useToilet(i: number) {
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    this.wcFree[i] = false;
    this.paintToilets();
    audio.pop();
    fadeFlash(() => {
      this.wcVisits++;
      audio.splash();
      // Otra persona se mete en ese y se libera otro
      const others = this.wcFree.map((f, k) => (!f && k !== i ? k : -1)).filter((k) => k >= 0);
      this.wcFree.fill(false);
      this.wcFree[others[Math.floor(Math.random() * others.length)]] = true;
      if (Math.random() < 0.5) this.wcFree[others[Math.floor(Math.random() * others.length)]] = true;
      this.paintToilets();
      this.player.root.position.set(WC_X - 1.6, 0, WC_Z[i]);
      this.walker.facing = this.walker.yaw = -Math.PI / 2;
      this.updateHud();
    }, 900);
    setTimeout(() => {
      this.fx.burst(this.player.root.position.clone().setY(2.2), '🧻', 2, 0.8, 0.6);
      if (this.wcVisits >= WC_NEED) {
        dialogue(CONCERT.wcDone, () => {
          this.busy = false;
          this.phase = 'findGas';
          this.updateHud();
        });
      } else {
        toast(CONCERT.wcBack[this.wcVisits - 1]);
        this.busy = false;
        this.phase = 'back';
        this.updateHud();
      }
    }, 1700);
  }

  private updateHud() {
    const h = this.hud;
    const wcChip = this.wcVisits > 0 || this.phase === 'wc' || this.phase === 'back' ? `<span class="chip">🚻 ${this.wcVisits}/${WC_NEED}</span>` : '';
    h.setCounters(wcChip + (this.smokeThrown ? '<span class="chip">🚭</span>' : ''));
    switch (this.phase) {
      case 'intro':
      case 'findBar':
        h.setObjective('Pregunta por Gas en la barra');
        break;
      case 'wc':
        h.setObjective(`Ve a un WC portátil libre (luz verde) · ${this.wcVisits + 1}ª vez`);
        break;
      case 'back':
        h.setObjective('Vuelve al concierto');
        break;
      case 'findGas':
        h.setObjective('Ábrete paso entre la multitud hasta Gas');
        break;
      case 'rhythm':
        h.setObjective(CONCERT.rhythm);
        break;
      default:
        h.setObjective('💙 Feliz cumpleaños 💙');
    }
  }

  private target(): THREE.Vector3 | null {
    if (this.phase === 'findBar') return BAR_POS;
    if (this.phase === 'findGas') return GAS_POS;
    if (this.phase === 'back') return CONCERT_SPOT;
    if (this.phase === 'wc') {
      const i = this.nearestFreeToilet();
      return i >= 0 ? this.v1.set(WC_X - 1.3, 0, WC_Z[i]) : null;
    }
    return null;
  }

  /** Pantallas del escenario: ecualizador, nombre y luces al ritmo. */
  private drawScreens(beat: number, pulse: number) {
    const live = this.phase === 'rhythm' || this.phase === 'ending';
    for (const ctx of this.screenCtx) {
      const w = 512;
      const h = 256;
      const hue = (Math.floor(beat / 4) * 40) % 360;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `hsl(${hue + 260}, 60%, ${12 + pulse * 8}%)`);
      g.addColorStop(1, `hsl(${hue + 330}, 70%, ${30 + pulse * 15}%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Barras del ecualizador
      const bars = 24;
      for (let i = 0; i < bars; i++) {
        const v = live ? 0.25 + 0.75 * Math.abs(Math.sin(beat * 1.7 + i * 0.7) * Math.cos(beat * 0.6 + i * 0.31)) * (0.6 + pulse * 0.4) : 0.08 + 0.05 * Math.sin(this.t * 2 + i);
        const bh = v * h * 0.55;
        ctx.fillStyle = `hsla(${(hue + i * 8) % 360}, 90%, 65%, 0.75)`;
        ctx.fillRect(8 + i * ((w - 16) / bars), h - bh, (w - 16) / bars - 4, bh);
      }
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff7ab0';
      ctx.shadowBlur = 20 + pulse * 20;
      ctx.font = `bold ${100 + pulse * 12}px sans-serif`;
      ctx.fillText('FITO', w / 2, h / 2 - 4);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('& Fitipaldis · Canarias', w / 2, h / 2 + 44);
    }
    this.screenTex.forEach((t) => (t.needsUpdate = true));
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.fireworks.update(dt);
    if (this.rhythm) {
      this.rhythm.update(dt);
      if (this.rhythm.finished) this.finishRhythm();
    }
    const beat = this.rhythm ? this.rhythm.beat : this.t * 2;
    const pulse = Math.pow(1 - (beat % 1), 3);

    // Público y banda
    const jump = this.phase === 'rhythm' || this.phase === 'ending' ? 0.35 : 0.12;
    for (const c of this.crowds) {
      c.base.forEach((b, i) => {
        const y = Math.abs(Math.sin(beat * Math.PI + b.ph * (this.phase === 'rhythm' ? 0.15 : 1))) * jump;
        this.tmpQ.setFromAxisAngle(this.up, b.ry);
        c.mesh.setMatrixAt(i, this.tmpM.compose(this.tmpV.set(b.x, y, b.z), this.tmpQ, this.one));
      });
      c.mesh.instanceMatrix.needsUpdate = true;
    }
    this.band.forEach((b, i) => {
      b.body.position.y = pulse * 0.1;
      b.armR.rotation.x = -0.8 + Math.sin(beat * Math.PI * 2 + i) * 0.5;
      b.armL.rotation.x = -0.9;
    });
    this.spots.forEach((s, i) => {
      s.mesh.rotation.z = Math.sin(this.t * 0.8 + s.ph) * 0.5;
      s.mesh.rotation.x = -0.7 + Math.cos(this.t * 0.6 + s.ph) * 0.25;
      const hue = (Math.floor(beat / 4) * 0.17 + i * 0.2) % 1;
      (s.mesh.material as THREE.MeshBasicMaterial).color.setHSL(hue, 0.9, 0.55 + pulse * 0.15);
    });

    // Jugadora
    const walking = !this.busy && (this.phase === 'findBar' || this.phase === 'wc' || this.phase === 'back' || this.phase === 'findGas');
    this.walker.turn(this.input.consumeCam());
    const mag = this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, this.colliders, this.bounds, this.people);
    this.player.root.rotation.y = this.walker.facing;
    const live = this.phase === 'rhythm' || this.phase === 'ending';
    if (live) animatePerson(this.player, dt, this.phase === 'ending' ? 'cheer' : 'dance', 0, beat * Math.PI);
    else animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);
    if (live) animatePerson(this.gas, dt, 'dance', 0, beat * Math.PI + 1);
    else animatePerson(this.gas, dt, 'wave');
    animatePerson(this.barman, dt, this.player.root.position.distanceTo(BAR_POS) < 4 ? 'talk' : 'idle');

    // Escenario vivo: pantallas, láseres y mecheros
    this.screenT -= dt;
    if (this.screenT <= 0) {
      this.screenT = 1 / 15;
      this.drawScreens(beat, pulse);
    }
    this.lasers.visible = live;
    if (live) {
      this.lasers.children.forEach((l) => {
        const ph = l.userData.ph as number;
        l.rotation.set(-0.5 + Math.sin(this.t * 0.9 + ph) * 0.35, Math.PI + Math.sin(this.t * 0.7 + ph * 1.3) * 0.7, 0);
        ((l as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 + pulse * 0.6;
      });
    }
    this.lighters.visible = live || this.phase === 'findGas';
    (this.lighters.material as THREE.PointsMaterial).size = 0.6 + Math.sin(this.t * 13) * 0.08;
    this.lighters.position.x = Math.sin(this.t * 1.2) * 0.25;

    // Tabaco
    this.smoke.visible = !this.smokeThrown;
    this.smoke.rotation.y += dt;

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    const pp = this.player.root.position;
    if (walking) {
      if (!this.smokeThrown && pp.distanceTo(SMOKE_POS) < 1.8) {
        label = 'Tirar 🚭';
        action = () => {
          this.smokeThrown = true;
          audio.luck();
          toast(CONCERT.smokeFound);
          this.fx.burst(SMOKE_POS.clone().setY(1), '✨', 8);
          this.updateHud();
        };
      } else if (this.phase === 'wc' && this.toiletAt(pp) >= 0) {
        const i = this.toiletAt(pp);
        if (this.wcFree[i]) {
          label = '🚻 Entrar';
          action = () => this.useToilet(i);
        } else {
          label = '🚫 Ocupado';
          action = () => {
            audio.warn();
            toast(CONCERT.wcBusy[Math.floor(Math.random() * CONCERT.wcBusy.length)]);
          };
        }
      } else if (pp.distanceTo(BAR_POS) < 3.2) {
        label = 'Hablar';
        action = () => this.talk(this.phase === 'findBar' ? CONCERT.barman : CONCERT.barmanAgain, () => (this.phase === 'findBar' ? 'wc' : this.phase));
      } else if (this.phase === 'findGas' && pp.distanceTo(GAS_POS) < 3) {
        label = 'Hablar';
        action = () => this.meetGas();
      }
    }
    this.hud.setAction(label, label === 'Tirar 🚭' || label === '🚻 Entrar');
    if (this.input.consumeAction() && action) action();

    // Vuelta al concierto entre visita y visita al baño
    if (this.phase === 'back' && !this.busy && pp.distanceTo(CONCERT_SPOT) < 3) {
      this.phase = 'wc';
      audio.warn();
      toast(CONCERT.wcAgain[Math.min(CONCERT.wcAgain.length - 1, this.wcVisits - 1)]);
      this.updateHud();
    }

    // Entre la multitud: empujones de vez en cuando
    this.pushT -= dt;
    if (this.phase === 'findGas' && walking && this.pushT <= 0) {
      const near = this.people.find((c) => Math.hypot(c.x - pp.x, c.z - pp.z) < 1.0);
      if (near && Math.random() < dt * 2.5) {
        const dx = pp.x - near.x;
        const dz = pp.z - near.z;
        const d = Math.hypot(dx, dz) || 1;
        this.walker.knock.set((dx / d) * 4, 0, (dz / d) * 4 - 2.5);
        this.walker.shake(0.25);
        vibrate(25);
        audio.hit();
        toast(CONCERT.pushes[Math.floor(Math.random() * CONCERT.pushes.length)]);
        this.fx.burst(pp.clone().setY(2.2), '💥', 1, 0.6, 0.5);
        this.pushT = 2.2;
      }
    }

    // Marcador y flecha
    const tgt = this.target();
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, 3.6 + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 3 ? null : -rel);
    } else this.hud.setArrow(null);

    // Final
    if (this.phase === 'ending') {
      this.endT += dt;
      if (Math.random() < dt * 2.2) this.fireworks.burst(new THREE.Vector3(-20 + Math.random() * 40, 22 + Math.random() * 12, 45 + Math.random() * 20));
      if (Math.random() < dt * 3) this.fx.burst(pp.clone().lerp(this.gas.root.position, 0.5).setY(2.4), '❤️', 1, 1.2);
    }

    this.updateCamera(dt);
    this.sun.follow(this.player.root.position);
    this.sky.update(this.camera, dt);
  }

  private talk(lines: { who: string; text: string }[], next: () => Phase) {
    this.busy = true;
    this.input.reset();
    dialogue(lines, () => {
      this.busy = false;
      this.phase = next();
      this.updateHud();
    });
  }

  private meetGas() {
    this.busy = true;
    this.input.reset();
    const pp = this.player.root.position;
    this.walker.facing = Math.atan2(GAS_POS.x - pp.x, GAS_POS.z - pp.z);
    this.gas.root.rotation.y = Math.atan2(pp.x - GAS_POS.x, pp.z - GAS_POS.z);
    dialogue([...CONCERT.gasFound, this.smokeThrown ? CONCERT.gasSmoke : CONCERT.gasNoSmoke], () => this.startRhythm());
  }

  private startRhythm() {
    this.busy = true;
    this.phase = 'rhythm';
    this.player.root.position.set(GAS_POS.x + 1.1, 0, GAS_POS.z);
    this.walker.facing = 0;
    this.gas.root.rotation.y = 0;
    this.hud.setAction(null);
    this.updateHud();
    audio.stopMusic();
    this.rhythm = new Rhythm();
    this.rhythm.onHit = (lane, perfect, combo) => {
      const x = [-6, 0, 6][lane];
      this.fx.burst(new THREE.Vector3(x, 4.5, 30), perfect ? '✨' : '🎵', perfect ? 3 : 2, 2, 1.2);
      if (combo > 0 && combo % 10 === 0) {
        this.fireworks.burst(new THREE.Vector3(-15 + Math.random() * 30, 18 + Math.random() * 6, 40));
        audio.cheer(0.4);
        vibrate(40);
      } else if (perfect) vibrate(12);
    };
  }

  private finishRhythm() {
    const r = this.rhythm!;
    this.result = { hits: r.hits, total: r.total, perfects: r.perfects, maxCombo: r.maxCombo };
    toast(`¡Has clavado ${r.hits} de ${r.total} notas! 🎸`);
    audio.cheer(0.7);
    audio.ambience(0.2);
    r.dispose();
    this.rhythm = null;
    this.phase = 'ending';
    this.endT = 0;
    this.updateHud();
    audio.fanfare();
    setTimeout(() => {
      if (this.phase !== 'ending') return;
      dialogue(CONCERT.ending, () => {
        setTimeout(() => {
          if (this.phase !== 'ending') return;
          this.phase = 'done';
          audio.ambience(0);
          const { hits, total, perfects, maxCombo } = this.result;
          const acc = total ? hits / total : 1;
          this.onComplete({
            stars: acc >= 0.9 ? 3 : acc >= 0.65 ? 2 : 1,
            stats: [
              ['Notas', `${hits}/${total}`],
              ['Perfectas', `${perfects}`],
              ['Mejor racha', `x${maxCombo}`],
              ['Tabaco', this.smokeThrown ? 'a la papelera 🚭' : 'sigue ahí… 🚬'],
            ],
          });
        }, 2500);
      });
    }, 2500);
  }

  private updateCamera(dt: number) {
    if (this.phase === 'rhythm' || this.phase === 'ending') {
      const p = this.player.root.position;
      const swing = this.phase === 'ending' ? Math.sin(this.t * 0.3) * 3 : 0;
      this.camTarget.set(p.x - 0.5 + swing, 3.1, p.z - 6.5);
      this.camLook.set(p.x * 0.4, this.phase === 'ending' ? 9 : 4.2, 34);
      this.camera.position.lerp(this.camTarget, 1 - Math.exp(-dt * 3));
      this.camera.lookAt(this.camLook);
      return;
    }
    this.walker.camera(this.camera, dt, this.colliders);
  }

  debug(): DebugItem[] {
    const stop = () => {
      this.rhythm?.dispose();
      this.rhythm = null;
      this.busy = false;
      this.input.reset();
    };
    const tp = (x: number, z: number, yaw = 0) => {
      this.player.root.position.set(x, 0, z);
      this.walker.yaw = yaw;
      this.walker.facing = yaw;
    };
    return [
      { label: '1 · Buscar la barra', run: () => { stop(); this.phase = 'findBar'; tp(0, -18); this.updateHud(); } },
      { label: '2 · WC portátiles', run: () => { stop(); this.phase = 'wc'; tp(WC_X - 4, -13, Math.PI / 2); this.updateHud(); } },
      { label: '3 · Buscar a Gas', run: () => { stop(); this.wcVisits = WC_NEED; this.phase = 'findGas'; tp(AISLE_X, 3); this.updateHud(); } },
      { label: '4 · Concierto (ritmo)', run: () => { stop(); this.startRhythm(); } },
      {
        label: '5 · Final con fuegos',
        run: () => {
          stop();
          this.startRhythm();
          this.finishRhythm();
        },
      },
      { label: '✓ Completar capítulo', run: () => { stop(); this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.rhythm?.dispose();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
