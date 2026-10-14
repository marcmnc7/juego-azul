import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { CONCERT } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, Person, personGeometry, vertexMat, PersonLook } from '../entities/models';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, Hud, DebugItem } from '../ui/ui';
import type { Box2 } from './ferreries';
import type { Level } from './level';

// Capítulo 3 · Fito bajo las estrellas (Canarias).
// Buscar a Gas (pista en la barra, tabaco opcional a la papelera) → minijuego de ritmo → fuegos artificiales → regalo.

type Phase = 'intro' | 'findBar' | 'findGas' | 'rhythm' | 'ending' | 'done';

const BAR_POS = new THREE.Vector3(-17, 0, -8);
const GAS_POS = new THREE.Vector3(-8.5, 0, 24.2);
const SMOKE_POS = new THREE.Vector3(-12.5, 0, 2);
const AISLE_X = -8.5;

function canvasTex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fuegos artificiales con un único THREE.Points y mezcla aditiva. */
class Fireworks {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private base: Float32Array;
  private next = 0;
  private N = 600;

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3).fill(-999);
    this.col = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    this.base = new Float32Array(this.N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.points.frustumCulled = false;
  }

  burst(at: THREE.Vector3) {
    const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    for (let k = 0; k < 80; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.N;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 9 + Math.random() * 3;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], i * 3);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.life[i] = 1.6;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / 1.6);
      this.vel[i * 3 + 1] -= 6 * dt;
      for (let a = 0; a < 3; a++) {
        this.vel[i * 3 + a] *= 1 - dt * 1.5;
        this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
        this.col[i * 3 + a] = this.base[i * 3 + a] * k;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
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
    this.label = bd < 0.11 ? '¡Perfecto!' : '¡Bien!';
    if (this.combo > 0 && this.combo % 10 === 0) this.label = `¡${this.combo} seguidas! 🔥`;
    this.labelT = 0.6;
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
      x.fillStyle = `rgba(20,10,30,${0.45 + this.flash[i] * 0.3})`;
      x.fillRect(i * lw + 2, 0, lw - 4, h);
    }
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.fillRect(0, hitY - 2, w, 4);
    for (const n of this.notes) {
      if (n.done) continue;
      const k = 1 - (n.t - now) / TRAVEL;
      if (k < 0 || k > 1.2) continue;
      const y = k * hitY;
      x.fillStyle = this.colors[n.lane];
      x.beginPath();
      x.arc(n.lane * lw + lw / 2, y, Math.min(lw * 0.32, 20), 0, Math.PI * 2);
      x.fill();
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
  private bounds: Box2 = { minX: -22, maxX: 22, minZ: -22, maxZ: 27.5 };
  private crowds: { mesh: THREE.InstancedMesh; base: { x: number; z: number; ry: number; ph: number }[] }[] = [];
  private spots: { mesh: THREE.Mesh; ph: number }[] = [];
  private band: Person[] = [];
  private marker: THREE.Mesh;
  private rhythm: Rhythm | null = null;
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
    private onComplete: () => void,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.background = new THREE.Color(0x0d0b26);
    sc.fog = new THREE.Fog(0x1a1340, 40, 260);
    sc.add(new THREE.HemisphereLight(0x9a8cff, 0x4a3a50, 1.9));
    const key = new THREE.DirectionalLight(0xffc9e0, 1.0);
    key.position.set(0, 20, 40);
    sc.add(key);

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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    sc.add(ground);

    // Estrellas y luna
    const starPos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.45;
      starPos.set([Math.sin(ph) * Math.cos(th) * 300, Math.cos(ph) * 300 + 10, Math.sin(ph) * Math.sin(th) * 300], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
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
    for (const [x, z, h] of [[-21, -16, 8], [21, -14, 9], [-21, 6, 9], [21, 8, 7.5], [-20, 22, 8.5], [20, 22, 9], [-28, 30, 10], [28, 30, 10]]) palm(x, z, h);
    sc.add(m.mesh());

    // Pantallas
    const screenTex = canvasTex((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2b1840');
      g.addColorStop(1, '#e2547a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 110px sans-serif';
      ctx.fillText('FITO', w / 2, h / 2 + 10);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('& Fitipaldis · Canarias', w / 2, h / 2 + 70);
    });
    for (const x of [-18.5, 18.5]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ map: screenTex, fog: false }));
      s.position.set(x, 7, 30);
      s.rotation.y = Math.PI + (x > 0 ? 0.25 : -0.25);
      sc.add(s);
      const p = new Merger().add(G.box, 0x222228, x, 2.4, 30.2, 0, 0, 0, 0.3, 4.8, 0.3).mesh();
      sc.add(p);
    }

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
    for (let i = 0; i < 2000 && pts.length < 150; i++) {
      const x = -13 + Math.random() * 26;
      const z = 6 + Math.random() * 21.5;
      if (Math.abs(x - AISLE_X) < 1.4) continue;
      if (Math.hypot(x - GAS_POS.x, z - GAS_POS.z) < 2) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 1)) continue;
      pts.push({ x, z });
    }
    looks.forEach((lk, li) => {
      const mine = pts.filter((_, i) => i % looks.length === li);
      const mesh = new THREE.InstancedMesh(personGeometry(lk, li % 2 === 0), vertexMat, mine.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sc.add(mesh);
      this.crowds.push({ mesh, base: mine.map((p) => ({ ...p, ry: Math.PI + (Math.random() - 0.5) * 0.6, ph: Math.random() * 6 })) });
    });
  }

  private updateHud() {
    const h = this.hud;
    h.setCounters(this.smokeThrown ? '<span class="chip">🚭</span>' : '');
    switch (this.phase) {
      case 'intro':
      case 'findBar':
        h.setObjective('Pregunta por Gas en la barra');
        break;
      case 'findGas':
        h.setObjective('Busca a Gas cerca del escenario, por la izquierda');
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
    return null;
  }

  private animatePerson(p: Person, speed01: number, phase: number, dance = false) {
    const s = Math.sin(phase);
    if (dance) {
      p.body.position.y = Math.abs(Math.sin(phase * 0.5)) * 0.3;
      p.armL.rotation.z = -2.4 + s * 0.4;
      p.armR.rotation.z = 2.4 - s * 0.4;
      p.legL.rotation.x = p.legR.rotation.x = 0;
      return;
    }
    p.body.position.y = Math.abs(s) * 0.08 * speed01;
    p.legL.rotation.x = s * 0.7 * speed01;
    p.legR.rotation.x = -s * 0.7 * speed01;
    p.armL.rotation.x = -s * 0.6 * speed01;
    p.armR.rotation.x = s * 0.6 * speed01;
    p.armL.rotation.z = -0.1;
    p.armR.rotation.z = 0.1;
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
    const walking = !this.busy && (this.phase === 'findBar' || this.phase === 'findGas');
    this.walker.yaw -= this.input.consumeCam();
    const mag = this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, this.colliders, this.bounds);
    this.player.root.rotation.y = this.walker.facing;
    if (this.phase === 'rhythm' || this.phase === 'ending') this.animatePerson(this.player, 0, beat * Math.PI, true);
    else this.animatePerson(this.player, mag, this.walker.walk);
    if (this.phase === 'rhythm' || this.phase === 'ending') this.animatePerson(this.gas, 0, beat * Math.PI + 1, true);
    else {
      this.animatePerson(this.gas, 0, 0);
      this.gas.armR.rotation.z = 2.6 + Math.sin(this.t * 6) * 0.3; // saluda
    }
    this.animatePerson(this.barman, 0, 0);

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
      } else if (pp.distanceTo(BAR_POS) < 3.2) {
        label = 'Hablar';
        action = () => this.talk(CONCERT.barman, () => (this.phase === 'findBar' ? 'findGas' : this.phase));
      } else if (this.phase === 'findGas' && pp.distanceTo(GAS_POS) < 3) {
        label = 'Hablar';
        action = () => this.meetGas();
      }
    }
    this.hud.setAction(label, label === 'Tirar 🚭');
    if (this.input.consumeAction() && action) action();

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
  }

  private finishRhythm() {
    const r = this.rhythm!;
    toast(`¡Has clavado ${r.hits} de ${r.total} notas! 🎸`);
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
          this.onComplete();
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
      { label: '2 · Buscar a Gas', run: () => { stop(); this.phase = 'findGas'; tp(AISLE_X, 4); this.updateHud(); } },
      { label: '3 · Concierto (ritmo)', run: () => { stop(); this.startRhythm(); } },
      {
        label: '4 · Final con fuegos',
        run: () => {
          stop();
          this.startRhythm();
          this.finishRhythm();
        },
      },
      { label: '✓ Completar capítulo', run: () => { stop(); this.phase = 'done'; this.onComplete(); } },
    ];
  }

  dispose() {
    this.rhythm?.dispose();
    this.hud.remove();
    audio.stopMusic();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
