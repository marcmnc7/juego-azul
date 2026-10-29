import * as THREE from 'three';
import { Surf } from '../core/surfaces';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { steerTo, steerSpeed, faceTo, type SteerState } from '../core/steer';
import { CONCERT } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, animatePerson, Person, makeCrowd, type CrowdLike, crowdPose, newCrowdPose, vertexMat, PersonLook } from '../entities/models';
import { Sky, Sun, toon, glowTexture, vibrate, Fireworks } from '../core/gfx';
import { Particles } from '../entities/fx';
import { PhysicsWorld, Body, beachBallTexture, type Mover } from '../core/physics';
import { hud, dialogue, toast, fadeFlash, Hud, DebugItem, later, phoneChat } from '../ui/ui';
import { hugFor } from '../entities/embrace';
import { CHATS } from '../data/chats';
import type { Line } from '../data/story';
import type { Box2 } from './ferreries';
import type { Level, LevelDone } from './level';
import { disposeScene } from './level';
import { cinema, headOf, rel } from '../core/cinema';
import { juice } from '../core/juice';
import { beacon } from '../core/beacon';

// Capítulo 4 · Fito en Gran Canaria.
// Aeropuerto (Azul esquiva maletas camino de la puerta 26, asiento 26D «pasillo») → en el estadio juegas con Gas, que tiene que ir al baño una y
// otra vez: cola de los WC, y mientras Azul le graba el temón → al volver está oscuro entre canciones y
// cuesta encontrarla entre la gente (ella hace flash con el móvil) y cada canción que pasa buscándola
// se la pierde → minijuego de ritmo juntos en primera fila → fuegos.

type Phase = 'airport' | 'intro' | 'toWc' | 'film' | 'seek' | 'found' | 'rhythm' | 'ending' | 'done';

// Textos nuevos: si story.ts los trae, mandan esos; si no, estos.
const TXT = CONCERT as unknown as Record<string, unknown>;
const txt = <T,>(k: string, d: T): T => (TXT[k] as T | undefined) ?? d;
const T_AIRPORT_HINT = () => txt<string>('airportHint', 'Esquiva las maletas y llega a la puerta 26 🧳');
const T_BURGER_HIT = () => txt<string[]>('burgerHit', ['🧳 ¡Uy! Una maleta', '🧳 «Tengo miedísimo de quedarme en Madrid»', '🧳 26D: 26 palo, pero D top ✨pasillo✨']);
const T_WC_AGAIN = () => txt<string[]>('wcAgain', ['🚻 Otra vez a la cola del baño…', '🚻 Y otra vez. Cola eterna', '🚻 La última, lo promete']);
const T_FILM_INTRO = () =>
  txt<Line[]>('filmIntro', [
    { who: 'Narrador', text: 'Y justo ahora Fito toca un temazo. Gas, en el baño.' },
    { who: 'Azul', text: '(WhatsApp) Hize vídeo, don’t worry.' },
    { who: 'Narrador', text: 'Grábale la canción: mantén a Fito dentro del encuadre aunque la gente salte delante.' },
  ]);
const T_FILM_DONE = () => txt<string>('filmDone', '🎥 Vídeo guardado. Gas no se lo pierde (casi)');
const T_SEEK_HINT = () => txt<string>('seekHint', 'Busca a Azul: hace doble flash ✨✨ con el móvil');
const T_SONG_LOST = () => txt<string[]>('songLost', ['🎵 Una canción que Gas se pierde', '🎵 Y otra… Gas sigue buscando', '🎵 Fito ya va por la siguiente']);
const T_FOUND = () =>
  txt<Line[][]>('foundLines', [
    [
      { who: 'Gas', text: '¡Por fin! Con tanta gente no veía nada.' },
      { who: 'Azul', text: 'Te he grabado el temón. Toma.' },
    ],
    [{ who: 'Gas', text: '¡Aquí estás! Te has movido…' }],
    [{ who: 'Gas', text: 'Ahora sí. No me muevo de aquí.' }],
  ]);
const T_GO_AGAIN = () =>
  txt<Line[][]>('goAgain', [
    [],
    [{ who: 'Narrador', text: 'Dos canciones después, Gas tiene que volver al baño.' }],
    [{ who: 'Narrador', text: 'Y otra vez. La cola, eterna.' }],
  ]);
const BAR_POS = new THREE.Vector3(-17, 0, -8);
const GAS_POS = new THREE.Vector3(-8.5, 0, 24.2);
const SMOKE_POS = new THREE.Vector3(292.2, 0, 7);
const AISLE_X = -8.5;
// WC portátiles a la derecha, con la puerta mirando al recinto
const WC_X = 17;
const WC_Z = [-17, -15.5, -14, -12.5, -11, -9.5];
const FILM_SECS = 15;
// Terminal del aeropuerto, lejos del estadio (mismo mundo, otra zona)
const AIR = { minX: 290, maxX: 302, minZ: -30, maxZ: 30 };
const BURGERS: [number, number][] = [[302.6, -14], [289.4, 0], [302.6, 14]];
// Una sola cola delante de los baños, hacia el recinto
const Q_Z = -13.25;
const WC_BROKEN = [0, 4, 5];
const Q_X0 = WC_X - 3.2;
const Q_GAP = 0.85;
const FLASH_SPOT = new THREE.Vector3(AISLE_X, 0, 4);
// Dónde está Azul cada vez que Gas vuelve del baño (en el pasillo, entre el público)
const AZUL_SPOTS = [FLASH_SPOT, new THREE.Vector3(-6, 0, 18), new THREE.Vector3(-10, 0, 13.5)];
const TRIPS = AZUL_SPOTS.length;
const SONG_SECS = 36;
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const LOOKS: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
  { skin: 0xd9a27c, shirt: 0x1b998b, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
  { skin: 0xf0c8a6, shirt: 0xd7263d, pants: 0x222222, hair: 0xb07a3a, hairStyle: 'cap' },
  { skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'bun' },
  { skin: 0xe2b08c, shirt: 0x7a5cff, pants: 0x2a2a2a, hair: 0x3a2414, hairStyle: 'pony' },
  { skin: 0xb98060, shirt: 0x2d6a4f, pants: 0x4a4a52, hair: 0x1a1a1a, hairStyle: 'short', beard: true },
];

/** Alguien del público con vida propia: hace cola, entra al baño, sale, o intenta colarse. */
interface Npc extends SteerState {
  p: Person;
  mode: 'free' | 'queue' | 'toWc' | 'leave' | 'tail';
  tx: number;
  tz: number;
  wc: number;
  walk: number;
  circle: Circle;
}
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
  /** El personaje que se controla: Azul en el aeropuerto, Gas en el estadio. */
  private player: Person;
  private walker: Walker;
  private azul: Person;
  private gas: Person;
  private barman: Person;
  private smoke: THREE.Group;
  private smokeThrown = false;
  private colliders: Box2[] = [];
  private people: Circle[] = [];
  // Física: vasos y pelota de playa, y un público que cede, se tambalea y vuelve a su sitio
  private phys = new PhysicsWorld();
  private ball!: Body;
  private movers: Mover[] = [{ x: 0, z: 0, vx: 0, vz: 0, r: 0.35, height: 1.75 }];
  private cHome: { x: number; z: number }[] = [];
  private cOff = new Float32Array(0);
  private cVel = new Float32Array(0);
  private cNbr: number[][] = [];
  private tiltQ = new THREE.Quaternion();
  private tiltAx = new THREE.Vector3();
  // Tres están averiados: de ahí la cola eterna
  private wcBusyT = WC_Z.map((_, i) => (WC_BROKEN.includes(i) ? Infinity : 4 + Math.random() * 16));
  private wcRes = WC_Z.map(() => false);
  private wcLights: THREE.MeshBasicMaterial[] = [];
  // La cola de los baños: gente que avanza, entra, sale y se une al final (Gas también, varias veces)
  private npcs: Npc[] = [];
  private queue: Npc[] = [];
  private allPeople: Circle[] = [];
  private headT = 0;
  private joinT = 0;
  private playerCircle: Circle = { x: 0, z: 0, r: 0.38 };
  private movingAvoid: Circle[] = [];
  private azCircle!: Circle;
  private trip = 0;
  private songT = 0;
  private missed = 0;
  private seekT = 0;
  private flashT = 1;
  private flashPulse = 0;
  private decoyT = 0;
  private decoys: { light: THREE.PointLight; t: number }[] = [];
  private filmT = 0;
  private filmIn = 0;
  private filmYaw = 0;
  private filmPitch = 0;
  private filmUi: HTMLDivElement | null = null;
  private filmDone = false;
  private baseFov = 0;
  private burgers: { o: THREE.Mesh; v: THREE.Vector3; live: boolean }[] = [];
  private travelers: ({ p: Person; dir: number; x: number; walk: number; c: Circle; tx?: number } & SteerState)[] = [];
  private burgerT = 1;
  private burgerHits = 0;
  private invuln = 0;
  private recordT = 0;
  private hudChips = '-';
  private hudObj = '';
  // A oscuras entre canciones: Azul hace flash con el móvil
  private hemi!: THREE.HemisphereLight;
  private flashLight = new THREE.PointLight(0xf4f8ff, 0, 22, 1.3);
  private flashSprite!: THREE.Sprite;
  private v1 = new THREE.Vector3();
  private bounds: Box2 = { minX: -22, maxX: 22, minZ: -22, maxZ: 27.5 };
  private pose = newCrowdPose();
  private crowds: { people: CrowdLike; base: { x: number; z: number; ry: number; ph: number }[] }[] = [];
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
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
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
    this.hemi = new THREE.HemisphereLight(0x9a8cff, 0x4a3a50, 1.5);
    sc.add(this.hemi);
    // Luz principal desde el escenario (rosa), con sombras que siguen a Azul
    this.sun = new Sun(sc, 0xffc0e0, 1.6, new THREE.Vector3(0.3, 0.9, 1), 22);

    this.buildWorld();
    this.fx = new Particles(sc);
    sc.add(this.fireworks.points);

    this.azul = makePerson(MARGAUX_LOOK);
    this.player = this.azul;
    this.walker = new Walker(this.player.root.position);
    this.player.root.position.set(0, 0, -18);
    sc.add(this.player.root);

    // Gas vuela por su cuenta: aparece ya en el estadio
    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.set(AISLE_X + 1, 0, FLASH_SPOT.z + 0.4);
    sc.add(this.gas.root);
    // El público y Azul (cuando no la llevas tú) no se pueden atravesar
    this.people = this.crowds.flatMap((c) => c.base.map((b) => ({ x: b.x, z: b.z, r: 0.35 })));
    this.azCircle = { x: 1e4, z: 1e4, r: 0.35 };
    this.people.push(this.azCircle);
    this.initCrowdPhysics();
    this.buildProps();
    this.buildQueue();
    this.buildFlash();

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
    this.buildAirport();
    this.startAirport();
    this.phase = 'intro';
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(CONCERT.airport, () =>
        phoneChat([CHATS.somosLas, CHATS.burger], () => {
          this.busy = false;
          this.phase = 'airport';
          this.updateHud();
        }),
      );
    }, 500);
  }

  get threeScene() {
    return this.scene;
  }

  /** Barajas es de día (y está lejos del estadio, en x > 100); todo lo demás, de noche. */
  get mood(): 'day' | 'night' {
    return this.player.root.position.x > 100 ? 'day' : 'night';
  }

  // ---------------- Aeropuerto ----------------

  /** Terminal de Barajas: pasillo largo, tiendas y la puerta del vuelo a Gran Canaria (el burger del «NUNCA más» fue el de Gas, en Barcelona). */
  private buildAirport() {
    const sc = this.scene;
    const A = AIR;
    const cx = (A.minX + A.maxX) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.maxX - A.minX + 2, A.maxZ - A.minZ + 6).rotateX(-Math.PI / 2), toon({ color: 0xe9ecef, roughness: 0.25, metalness: 0.05 }));
    floor.position.set(cx, 0.01, (A.minZ + A.maxZ) / 2);
    floor.userData.noCast = true;
    sc.add(floor);
    const m = new Merger();
    // Cristaleras a los dos lados y techo con lucernarios (las ondas de Barajas)
    for (const x of [A.minX - 0.15, A.maxX + 0.15]) {
      m.add(G.box, 0x9fc4e0, x, 3, (A.minZ + A.maxZ) / 2, 0, 0, 0, 0.2, 6, A.maxZ - A.minZ + 6);
      for (let z = A.minZ - 2; z <= A.maxZ + 2; z += 3) m.add(G.box, 0x5a6470, x, 3, z, 0, 0, 0, 0.3, 6, 0.15);
    }
    for (let z = A.minZ - 3; z <= A.maxZ + 3; z += 2.2) m.add(G.box, 0xd9b26a, cx, 6.6 + Math.sin(z * 0.3) * 0.35, z, 0, 0, 0, A.maxX - A.minX + 0.6, 0.12, 0.8);
    m.add(G.box, 0xd8dde3, cx, 3, A.minZ - 3.2, 0, 0, 0, A.maxX - A.minX + 0.6, 6, 0.3);
    // Muros del fondo como obstáculo para la cámara (si no, se sale de la terminal y no se ve nada)
    this.colliders.push({ minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.minZ - 7, maxZ: A.minZ - 3.1 }, { minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.maxZ + 3.1, maxZ: A.maxZ + 7 });
    m.add(G.box, 0xd8dde3, cx, 3, A.maxZ + 3.2, 0, 0, 0, A.maxX - A.minX + 0.6, 6, 0.3);
    // Barajas T4: pilares en «Y» que van del amarillo al rojo a lo largo de la terminal, y techo
    // ondulado de lamas de bambú
    for (let z = A.minZ - 1, k = 0; z <= A.maxZ + 1; z += 7.5, k++) {
      const col = new THREE.Color(0xf2c230).lerp(new THREE.Color(0xd7263d), k / 8).getHex();
      for (const x of [A.minX + 1.2, A.maxX - 1.2]) {
        m.add(G.cyl, col, x, 2.2, z, 0, 0, 0, 0.5, 4.4, 0.5);
        m.add(G.cyl, col, x - 0.6, 5.4, z, 0, 0, 0.45, 0.3, 2.6, 0.3);
        m.add(G.cyl, col, x + 0.6, 5.4, z, 0, 0, -0.45, 0.3, 2.6, 0.3);
        this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
      }
    }
    // Bancos de espera
    for (const z of [-20, -12, 12, 20]) {
      for (const x of [A.minX + 0.6, A.maxX - 0.6]) {
        m.add(G.box, 0x2b2f36, x, 0.45, z, 0, 0, 0, 0.6, 0.1, 3);
        m.add(G.box, 0x2b2f36, x + (x < cx ? -0.25 : 0.25), 0.75, z, 0, 0, 0, 0.1, 0.6, 3);
        this.colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 1.5, maxZ: z + 1.5 });
      }
    }
    // Tiendas a los dos lados; de ellas sale gente con prisa empujando maletas de ruedas
    for (const [x, z] of BURGERS) {
      const side = x > cx ? 1 : -1;
      m.add(G.box, 0xd7263d, x + side * 0.4, 1.1, z, 0, 0, 0, 2.2, 2.2, 4);
      m.add(G.box, 0xf4c430, x + side * 0.4, 2.5, z, 0, 0, 0, 2.4, 0.6, 4.2);
      m.add(G.box, 0xffffff, x - side * 0.75, 1.05, z, 0, 0, 0, 0.2, 0.1, 3.6);
      this.colliders.push({ minX: x + side * 0.4 - 1.1, maxX: x + side * 0.4 + 1.1, minZ: z - 2, maxZ: z + 2 });
    }
    sc.add(m.mesh());
    const sign = (text: string, x: number, y: number, z: number, ry: number, w: number, bg: string, fg: string) => {
      const tex = canvasTex((ctx, cw, ch) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let size = 80;
        do ctx.font = `bold ${size}px sans-serif`;
        while (ctx.measureText(text).width > cw - 40 && (size -= 4) > 18);
        ctx.fillText(text, cw / 2, ch / 2 + 4);
      }, 512, 128);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
    };
    BURGERS.forEach(([x, z], i) => sign(['DUTY FREE', 'CAFÉ', 'PRENSA'][i % 3], x + (x > cx ? -0.78 : 0.78), 1.75, z, x > cx ? -Math.PI / 2 : Math.PI / 2, 3.6, '#1b2a4a', '#ffffff'));
    sign('Puerta 26 · LPA', cx, 4.4, A.maxZ + 3.0, Math.PI, 5, '#1b2a4a', '#ffd23f');
    sign('Salidas · Departures', cx, 4.6, A.minZ - 3.0, 0, 5, '#1b2a4a', '#ffffff');
    for (const z of [-24, -12, 0, 12, 24]) {
      const l = new THREE.PointLight(0xfff6e8, 22, 20, 1.3);
      l.position.set(cx, 5.5, z);
      sc.add(l);
    }
    // Maletas de cabina que se escapan rodando por el pasillo
    const bun = new Merger()
      .add(G.rbox, 0x2b3a55, 0, 0.3, 0, 0, 0, 0, 0.4, 0.55, 0.24)
      .add(G.box, 0x9aa3ad, 0, 0.68, 0, 0, 0, 0, 0.26, 0.04, 0.03)
      .add(G.box, 0x9aa3ad, -0.12, 0.62, 0, 0, 0, 0, 0.02, 0.12, 0.02)
      .add(G.box, 0x9aa3ad, 0.12, 0.62, 0, 0, 0, 0, 0.02, 0.12, 0.02)
      .add(G.cyl, 0x111111, -0.15, 0.03, 0, 0, 0, 0, 0.06, 0.05, 0.06)
      .add(G.cyl, 0x111111, 0.15, 0.03, 0, 0, 0, 0, 0.06, 0.05, 0.06)
      .build();
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Mesh(bun, vertexMat());
      o.visible = false;
      sc.add(o);
      this.burgers.push({ o, v: new THREE.Vector3(), live: false });
    }
    // Viajeros con prisa, de un lado a otro del pasillo
    for (let i = 0; i < 4; i++) {
      const p = makePerson({ ...LOOKS[i], shirt: [0x34495e, 0x8e44ad, 0x16a085, 0xc0392b][i] });
      p.body.add(new Merger().add(G.rbox, [0x222222, 0xd7263d, 0x1f5fbf, 0x777777][i], 0.45, 0.35, -0.2, 0, 0, 0, 0.35, 0.55, 0.25).mesh());
      p.root.position.set(A.minX + 2 + i * 2.6, 0, -22 + i * 13);
      sc.add(p.root);
      this.travelers.push({ p, dir: i % 2 ? 1 : -1, x: p.root.position.x, walk: 0, c: { x: 0, z: 0, r: 0.35 } });
    }
    this.allPeople.push(...this.travelers.map((t) => t.c));
  }

  private startAirport() {
    this.phase = 'airport';
    if (this.player !== this.azul) {
      this.player = this.azul;
      this.walker = new Walker(this.azul.root.position);
      this.azCircle.x = this.azCircle.z = 1e4;
      this.gas.root.visible = false;
    }
    this.player.root.position.set((AIR.minX + AIR.maxX) / 2, 0, AIR.minZ + 1);
    this.walker.yaw = this.walker.facing = 0;
    this.walker.stop();
    this.camera.position.set((AIR.minX + AIR.maxX) / 2, 4, AIR.minZ - 4);
    this.updateHud();
  }

  private stepAirport(dt: number) {
    const pp = this.player.root.position;
    // Viajeros con maleta
    // Viajeros: van y vuelven por el pasillo esquivando a Azul y entre ellos, sin girar en seco
    this.playerCircle.x = pp.x;
    this.playerCircle.z = pp.z;
    const others = [this.playerCircle, ...this.travelers.map((o) => o.c)];
    for (const t of this.travelers) {
      const r = t.p.root.position;
      t.tx ??= t.x;
      const tz = t.dir > 0 ? AIR.maxZ + 1 : AIR.minZ - 1;
      if (steerTo(t.p.root, t, t.tx, tz, 1.6, dt, others, 2.5, 0.32, t.c) < 0.4) t.dir *= -1;
      // Vuelve poco a poco a su carril tras esquivar
      r.x += (t.tx - r.x) * Math.min(1, dt * 0.6);
      animatePerson(t.p, dt, steerSpeed(t) > 0.1 ? 'walk' : 'idle');
      t.c.x = r.x;
      t.c.z = r.z;
    }
    // Cada poco, una maleta se escapa rodando de una tienda y cruza el pasillo
    this.burgerT -= dt;
    if (this.burgerT <= 0) {
      this.burgerT = 0.6 + Math.random() * 0.6;
      const b = this.burgers.find((x) => !x.live);
      // Sale del burger más cercano a Azul (por delante de ella, para que dé tiempo a verla)
      const [bx, bz] = BURGERS.reduce((a, c) => (Math.abs(c[1] - pp.z - 3) < Math.abs(a[1] - pp.z - 3) ? c : a));
      if (b && Math.abs(bz - pp.z) < 12) {
        const side = bx > (AIR.minX + AIR.maxX) / 2 ? -1 : 1;
        b.live = true;
        b.o.visible = true;
        b.o.position.set(bx + side * 1.0, 0, bz + (Math.random() - 0.5) * 3);
        b.o.rotation.set(0, 0, 0);
        // Apunta a donde va a estar Azul (con algo de error, para que se pueda esquivar)
        const vx = 3.2 + Math.random() * 1.8;
        const tf = Math.abs(pp.x - b.o.position.x) / vx;
        const tz = pp.z + this.walker.vz * tf + (Math.random() - 0.5) * 1.2;
        b.v.set(side * vx, 0, THREE.MathUtils.clamp((tz - b.o.position.z) / Math.max(0.3, tf), -4, 4));
        b.o.rotation.y = Math.atan2(b.v.x, b.v.z);
      }
    }
    for (const b of this.burgers) {
      if (!b.live) continue;
      // Rueda por el suelo frenándose poco a poco y con un ligero traqueteo
      b.o.position.addScaledVector(b.v, dt);
      b.v.multiplyScalar(1 - dt * 0.25);
      b.o.rotation.z = Math.sin(performance.now() * 0.03) * 0.04;
      if (b.o.position.x < AIR.minX - 0.5 || b.o.position.x > AIR.maxX + 0.5 || Math.abs(b.v.x) < 0.4) {
        b.live = false;
        b.o.visible = false;
        continue;
      }
      if (this.invuln <= 0 && Math.hypot(b.o.position.x - pp.x, b.o.position.z - pp.z) < 0.6 && b.o.position.y < 2) {
        this.invuln = 1.2;
        this.burgerHits++;
        this.walker.knock.set(Math.sign(b.v.x) * 6, 0, -2);
        this.walker.shake(0.3);
        audio.hit();
        vibrate(60);
        toast(T_BURGER_HIT()[(this.burgerHits - 1) % T_BURGER_HIT().length]);
        this.fx.burst(pp.clone().setY(1.6), '🧳', 3, 1, 0.6);
        b.live = false;
        b.o.visible = false;
        this.updateHud();
      }
    }
  }

  /** Embarca: fundido y ya está en el estadio, con Gas en la cola. */
  private board() {
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    audio.whoosh();
    for (const b of this.burgers) b.o.visible = b.live = false;
    fadeFlash(() => {
      this.phase = 'intro';
      for (const t of this.travelers) {
        t.p.root.visible = false;
        t.c.x = t.c.z = 1e4;
      }
      this.toStadium();
      this.updateHud();
    }, 700);
    later(
      () =>
        dialogue(CONCERT.landed, () =>
          phoneChat(CHATS.vasTarde, () =>
            dialogue(CONCERT.stadium, () => {
              this.busy = false;
              this.phase = 'toWc';
              this.updateHud();
            }),
          ),
        ),
      1500,
    );
  }

  /** En el estadio se juega con Gas; Azul se queda en su sitio del pasillo. */
  private toStadium() {
    this.player = this.gas;
    this.walker = new Walker(this.gas.root.position);
    this.gas.root.visible = true;
    this.gas.root.position.set(AISLE_X + 1, 0, FLASH_SPOT.z + 0.4);
    this.walker.yaw = this.walker.facing = Math.PI * 0.75;
    this.walker.stop();
    this.placeAzul(AZUL_SPOTS[0]);
    this.camera.position.set(AISLE_X + 6, 5, FLASH_SPOT.z - 5);
  }

  private placeAzul(at: THREE.Vector3) {
    this.azul.root.visible = true;
    this.azul.root.position.copy(at);
    this.azul.root.rotation.y = 0;
    this.azCircle.x = at.x;
    this.azCircle.z = at.z;
  }

  private buildWorld() {
    const sc = this.scene;
    // Césped del anexo tapado con planchas protectoras (rejilla de plástico gris) para el concierto
    const tex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#3d4140';
      ctx.fillRect(0, 0, w, h);
      const n = 6, cw = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 58 + Math.random() * 14;
          ctx.fillStyle = `rgb(${v},${v + 3},${v + 2})`;
          ctx.fillRect(i * cw + 1, j * cw + 1, cw - 2, cw - 2);
          // Rejilla de la plancha
          ctx.fillStyle = 'rgba(20,24,22,0.35)';
          for (let k = 4; k < cw - 2; k += 5) {
            ctx.fillRect(i * cw + k, j * cw + 2, 1, cw - 4);
            ctx.fillRect(i * cw + 2, j * cw + k, cw - 4, 1);
          }
        }
      // Pisadas y suciedad
      for (let i = 0; i < 900; i++) {
        const v = 30 + Math.random() * 50;
        ctx.fillStyle = `rgba(${v},${v - 4},${v - 8},0.5)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
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

    // Anexo del Estadio de Gran Canaria: el concierto es sobre la pista de atletismo (tartán rojo con
    // calles blancas) y el césped tapado con planchas; al lado, el gran estadio con su visera
    {
      const pathPt = (t: number, r: number): [number, number] => {
        // Óvalo de atletismo: rectas a lo largo de z (x = ±r) y curvas de radio r en z = ±L
        const L = 34, P = 4 * L + 2 * Math.PI * r;
        let d = (t % 1) * P;
        if (d < 2 * L) return [r, -L + d];
        d -= 2 * L;
        if (d < Math.PI * r) { const a = d / r; return [r * Math.cos(a), L + r * Math.sin(a)]; }
        d -= Math.PI * r;
        if (d < 2 * L) return [-r, L - d];
        d -= 2 * L;
        const a = Math.PI + d / r;
        return [r * Math.cos(a), -L + r * Math.sin(a)];
      };
      const strip = (r0: number, r1: number, y: number, color: number) => {
        const pos: number[] = [];
        const N = 160;
        for (let i = 0; i < N; i++) {
          const a0 = pathPt(i / N, r0), b0 = pathPt(i / N, r1), a1 = pathPt((i + 1) / N, r0), b1 = pathPt((i + 1) / N, r1);
          pos.push(a0[0], y, a0[1], a1[0], y, a1[1], b0[0], y, b0[1], b0[0], y, b0[1], a1[0], y, a1[1], b1[0], y, b1[1]);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, toon({ color, roughness: 0.9, side: THREE.DoubleSide, surf: color === 0xa8433a ? Surf.Asphalt : color === 0x35603a ? Surf.Grass : Surf.None }));
        mesh.userData.noCast = true;
        sc.add(mesh);
      };
      strip(30, 39.6, 0.02, 0xa8433a);
      for (let k = 0; k <= 8; k++) strip(30 + k * 1.2 - 0.04, 30 + k * 1.2 + 0.04, 0.03, 0xf4f1ea);
      const st = new Merger();
      // Franja de césped alrededor de la pista y la pequeña tribuna cubierta del anexo
      strip(39.6, 47, 0.015, 0x35603a);
      for (let k = 0; k < 7; k++) st.add(G.box, 0x8d939a, 50 + k * 0.9, 0.35 + k * 0.45, 0, 0, 0, 0, 0.9, 0.7 + k * 0.9, 40);
      for (let k = 0; k < 7; k++) for (let j = 0; j < 30; j++)
        st.add(G.box, j % 5 === 0 ? 0xf2c230 : 0x1f6fb2, 50 + k * 0.9, 0.9 + k * 0.9, -18.5 + j * 1.28, 0, 0, 0, 0.5, 0.25, 0.9);
      for (const z of [-19, -6, 6, 19]) st.add(G.box, 0xe8e8e8, 57.5, 5, z, 0, 0, 0, 0.3, 10, 0.3);
      st.add(G.box, 0xeeeeee, 53.5, 10, 0, 0, 0, -0.12, 9, 0.3, 41);
      this.colliders.push({ minX: 49.5, maxX: 58, minZ: -20, maxZ: 20 });
      // El estadio: gradas en anillo y la visera blanca
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const x = -150 + Math.cos(a) * 60, z = Math.sin(a) * 45;
        st.add(G.box, 0x6a7380, x, 10, z, 0, -a, 0, 6, 20, 10);
        st.add(G.box, 0xf2f2f2, -150 + Math.cos(a) * 54, 23, Math.sin(a) * 40, 0.3, -a, 0, 8, 0.6, 16);
      }
      sc.add(st.mesh());
      // Las luces de los barrios en las laderas de Las Palmas
      const lights: number[] = [];
      for (let i = 0; i < 700; i++) {
        const a = Math.random() * Math.PI * 2, r = 140 + Math.random() * 120;
        lights.push(Math.cos(a) * r, 2 + Math.random() * 30 * (r / 260), Math.sin(a) * r);
      }
      const pts = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lights, 3)),
        new THREE.PointsMaterial({ color: 0xffc070, size: 1.4, sizeAttenuation: true, fog: false }),
      );
      sc.add(pts);
    }

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
      const beam = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      // Haz de luz, no cono macizo: se enciende donde pega (el escenario, el público) y se deshace hacia el foco
      Object.assign(beam, { defines: { USE_UV: '' } });
      beam.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'float toLamp = vUv.y;\ndiffuseColor.a *= ( 1.0 - smoothstep( 0.15, 1.0, toLamp ) ) * smoothstep( 0.0, 0.06, toLamp );\n#include <opaque_fragment>');
      };
      beam.customProgramCacheKey = () => 'beam';
      const mesh = new THREE.Mesh(spotGeo, beam);
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
      const people = makeCrowd(lk, mine.length, true);
      sc.add(people.group);
      this.crowds.push({ people, base: mine.map((p) => ({ ...p, ry: Math.PI + (Math.random() - 0.5) * 0.6, ph: Math.random() * 6 })) });
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

  private initCrowdPhysics() {
    const homes = this.crowds.flatMap((c) => c.base.map((b) => ({ x: b.x, z: b.z })));
    this.cHome = homes;
    this.cOff = new Float32Array(homes.length * 2);
    this.cVel = new Float32Array(homes.length * 2);
    this.cNbr = homes.map((h, i) => homes.flatMap((o, j) => (j !== i && Math.hypot(o.x - h.x, o.z - h.z) < 1.4 ? [j] : [])));
  }

  /** Vasos de plástico tirados por el suelo y una pelota de playa que el público va botando. */
  private buildProps() {
    const ph = this.phys;
    ph.walls = this.colliders.filter((c) => c.maxX - c.minX < 40);
    ph.bounds = this.bounds;
    const cupGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.17, 14);
    const mats = [toon({ color: 0xd62828, roughness: 0.45 }), toon({ color: 0xf0f0f0, roughness: 0.4 }), toon({ color: 0x2a64c8, roughness: 0.45 })];
    let n = 0;
    for (let i = 0; i < 400 && n < 34; i++) {
      const x = -12 + Math.random() * 28;
      const z = -16 + Math.random() * 21;
      if (this.colliders.some((c) => x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4)) continue;
      if (Math.hypot(x, z + 18) < 2) continue;
      const mesh = new THREE.Mesh(cupGeo, mats[n % mats.length]);
      mesh.castShadow = true;
      this.scene.add(mesh);
      const b = new Body(mesh, { kind: 'cup', r: 0.07, h: 0.17, mass: 0.03, bounce: 0.25, drag: 0.6 });
      b.pos.set(x, 0, z);
      if (Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2;
        b.tilt = Math.PI / 2;
        b.tiltAxis.set(Math.cos(a), 0, Math.sin(a));
        b.rollAngle = Math.random() * 6;
      }
      ph.add(b);
      b.asleep = true;
      n++;
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), toon({ map: beachBallTexture(), roughness: 0.35 }));
    ball.castShadow = true;
    this.scene.add(ball);
    this.ball = new Body(ball, { kind: 'ball', r: 0.32, mass: 0.12, bounce: 0.72, drag: 0.22, density: 0.05 });
    this.ball.pos.set(2, 3.5, 14);
    this.ball.vel.set(0.6, 2, -0.4);
    ph.add(this.ball);
  }

  /**
   * El público como cuerpos blandos: Azul empuja con su impulso y la gente cede (pesan más que ella,
   * así que menos de lo que empuja), choca con los de al lado en cadena, se tambalea y vuelve a su sitio.
   */
  private stepCrowd(dt: number) {
    const n = this.cHome.length;
    if (!n || dt <= 0) return;
    const h = Math.min(dt, 1 / 30);
    const pp = this.player.root.position;
    const wx = this.walker.wish.x;
    const wz = this.walker.wish.y;
    const off = this.cOff;
    const vel = this.cVel;
    const W = 2.4; // vuelta al sitio
    const Z = 0.75;
    for (let i = 0; i < n; i++) {
      const hx = this.cHome[i].x + off[2 * i];
      const hz = this.cHome[i].z + off[2 * i + 1];
      const dx = hx - pp.x;
      const dz = hz - pp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.85 * 0.85) {
        const d = Math.sqrt(d2) || 1e-3;
        const nx = dx / d;
        const nz = dz / d;
        const push = wx * nx + wz * nz;
        if (push > 0) {
          const vn = vel[2 * i] * nx + vel[2 * i + 1] * nz;
          const target = push * 0.4;
          if (vn < target) {
            const k = (target - vn) * Math.min(1, h * 12);
            vel[2 * i] += nx * k;
            vel[2 * i + 1] += nz * k;
          }
        }
        if (d < 0.75) {
          off[2 * i] += nx * (0.75 - d) * 0.5;
          off[2 * i + 1] += nz * (0.75 - d) * 0.5;
        }
      }
      // Muelle hacia su sitio (vuelven andando a donde estaban)
      const ox = off[2 * i];
      const oz = off[2 * i + 1];
      if (ox === 0 && oz === 0 && vel[2 * i] === 0 && vel[2 * i + 1] === 0) continue;
      vel[2 * i] += (-W * W * ox - 2 * Z * W * vel[2 * i]) * h;
      vel[2 * i + 1] += (-W * W * oz - 2 * Z * W * vel[2 * i + 1]) * h;
      off[2 * i] += vel[2 * i] * h;
      off[2 * i + 1] += vel[2 * i + 1] * h;
      if (Math.abs(off[2 * i]) + Math.abs(off[2 * i + 1]) < 0.003 && Math.abs(vel[2 * i]) + Math.abs(vel[2 * i + 1]) < 0.01) {
        off[2 * i] = off[2 * i + 1] = vel[2 * i] = vel[2 * i + 1] = 0;
      }
    }
    // Choques entre vecinos: la onda se propaga por la multitud
    for (let i = 0; i < n; i++) {
      if (off[2 * i] === 0 && off[2 * i + 1] === 0 && vel[2 * i] === 0 && vel[2 * i + 1] === 0) continue;
      const ax = this.cHome[i].x + off[2 * i];
      const az = this.cHome[i].z + off[2 * i + 1];
      for (const j of this.cNbr[i]) {
        const bx = this.cHome[j].x + off[2 * j];
        const bz = this.cHome[j].z + off[2 * j + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const d2 = dx * dx + dz * dz;
        if (d2 >= 0.7 * 0.7) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const nx = dx / d;
        const nz = dz / d;
        const pen = (0.7 - d) * 0.5;
        off[2 * i] -= nx * pen;
        off[2 * i + 1] -= nz * pen;
        off[2 * j] += nx * pen;
        off[2 * j + 1] += nz * pen;
        const rel = (vel[2 * j] - vel[2 * i]) * nx + (vel[2 * j + 1] - vel[2 * i + 1]) * nz;
        if (rel < 0) {
          const imp = -rel * 0.55;
          vel[2 * i] -= nx * imp;
          vel[2 * i + 1] -= nz * imp;
          vel[2 * j] += nx * imp;
          vel[2 * j + 1] += nz * imp;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      this.people[i].x = this.cHome[i].x + off[2 * i];
      this.people[i].z = this.cHome[i].z + off[2 * i + 1];
    }
  }

  /** La pelota: el público la devuelve hacia arriba con las manos; Azul la puede cabecear o chutar. */
  private stepBall() {
    const b = this.ball;
    const p = b.pos;
    const pp = this.player.root.position;
    const inCrowd = p.x > -13 && p.x < 13 && p.z > 6 && p.z < 27.5 && distToPath(p.x, p.z) > 0.6;
    if (inCrowd && p.y < 2.35 && b.vel.y < 0) {
      b.vel.y = 4.2 + Math.random() * 2.2;
      b.vel.x = b.vel.x * 0.4 + (Math.random() - 0.5) * 2.2 + -p.x * 0.06;
      b.vel.z = b.vel.z * 0.4 + (Math.random() - 0.5) * 2.2 + (16 - p.z) * 0.06;
      b.wake();
      const d = p.distanceTo(pp);
      if (d < 14) audio.knock(0.5 / (1 + d * 0.3), 480, 0.12);
    }
    const dx = p.x - pp.x;
    const dz = p.z - pp.z;
    if (Math.hypot(dx, dz) < 0.55 && p.y - b.r < 1.95 && p.y > 1.3 && b.vel.y < 0) {
      b.vel.y = -b.vel.y * 0.55 + 2.8;
      b.vel.x += this.walker.vx * 0.6 + dx * 2;
      b.vel.z += this.walker.vz * 0.6 + dz * 2;
      b.wake();
      audio.knock(0.45, 520, 0.12);
    }
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
    this.wcLights.forEach((m, i) => m.color.set(this.wcFree(i) ? 0x2ecc71 : 0xe74c3c));
  }

  private wcFree(i: number) {
    return this.wcBusyT[i] <= 0 && !this.wcRes[i];
  }

  private freeToilet() {
    const free = WC_Z.map((_, i) => i).filter((i) => this.wcFree(i));
    if (!free.length) return -1;
    // El más cercano a la cabeza de la cola
    return free.reduce((a, b) => (Math.abs(WC_Z[a] - Q_Z) <= Math.abs(WC_Z[b] - Q_Z) ? a : b));
  }

  private slot(k: number, out = this.v1) {
    return out.set(Q_X0 - k * Q_GAP, 0, Q_Z);
  }

  /** Gente para la cola de los baños y una reserva para entrar, salir y unirse al final. */
  private buildQueue() {
    for (let i = 0; i < 13; i++) {
      const lk = LOOKS[i % LOOKS.length];
      const p = makePerson({ ...lk, shirt: i < LOOKS.length ? lk.shirt : new THREE.Color().setHSL(Math.random(), 0.55, 0.5).getHex() });
      p.root.visible = false;
      p.root.position.set(1e4, 0, 1e4);
      this.scene.add(p.root);
      const n: Npc = { p, mode: 'free', tx: 0, tz: 0, wc: -1, walk: Math.random() * 6, circle: { x: 1e4, z: 1e4, r: 0.32 } };
      this.npcs.push(n);
    }
    for (let k = 0; k < 7; k++) {
      const n = this.spawn(this.slot(k).x, Q_Z + (Math.random() - 0.5) * 0.15);
      n.mode = 'queue';
      n.p.root.rotation.y = Math.PI / 2;
      this.queue.push(n);
    }
    this.allPeople = [...this.people, ...this.npcs.map((n) => n.circle)];
  }

  private spawn(x: number, z: number) {
    const n = this.npcs.find((m) => m.mode === 'free' && !m.p.root.visible) ?? this.npcs[0];
    n.p.root.visible = true;
    n.p.root.position.set(x, 0, z);
    n.tx = x;
    n.tz = z;
    n.vx = n.vz = 0;
    return n;
  }

  private hide(n: Npc) {
    n.mode = 'free';
    n.p.root.visible = false;
    n.p.root.position.set(1e4, 0, 1e4);
  }

  /** Paso de un personaje hacia un punto, con su ciclo de andar. Devuelve true al llegar. */
  private stepTo(p: Person, st: { walk: number } & SteerState, tx: number, tz: number, speed: number, dt: number, idleFace?: number, anim = true, avoid: readonly Circle[] = [], self?: Circle) {
    const r = p.root.position;
    const x0 = r.x;
    const z0 = r.z;
    const left = steerTo(p.root, st, tx, tz, speed, dt, avoid, 3.2, 0.32, self);
    st.walk += Math.hypot(r.x - x0, r.z - z0) / 0.53;
    const sp = steerSpeed(st);
    if (left < 0.08 && sp < 0.3) {
      if (idleFace !== undefined) faceTo(p.root, idleFace, dt);
      if (anim) animatePerson(p, dt, 'idle');
      return true;
    }
    if (anim) animatePerson(p, dt, sp > 0.08 ? 'walk' : 'idle');
    return left < 0.08;
  }

  /** La cola viva: los baños se ocupan y se vacían, la cabeza entra y la gente se une al final. */
  private stepQueue(dt: number) {
    if (this.phase === 'airport' || this.phase === 'rhythm' || this.phase === 'ending' || this.phase === 'done' || (this.phase === 'intro' && this.player.root.position.x > 100)) {
      for (const n of this.npcs) if (n.mode === 'queue') animatePerson(n.p, dt, 'idle');
      return;
    }
    const pp = this.player.root.position;
    for (let i = 0; i < WC_Z.length; i++) {
      if (this.wcBusyT[i] <= 0) continue;
      this.wcBusyT[i] -= dt;
      if (this.wcBusyT[i] <= 0 && !this.wcRes[i]) {
        // Sale alguien y se vuelve al concierto
        const n = this.spawn(WC_X - 0.9, WC_Z[i]);
        n.mode = 'leave';
        n.tx = 2 + Math.random() * 8;
        n.tz = -2 + Math.random() * 6;
        const d = pp.distanceTo(n.p.root.position);
        if (d < 12) audio.knock(0.5 / (1 + d * 0.3), 180, 0.08);
      }
    }
    this.headT -= dt;
    const head = this.queue[0];
    if (head && this.headT <= 0) {
      const i = this.freeToilet();
      if (i >= 0) {
        this.queue.shift();
        head.mode = 'toWc';
        head.wc = i;
        head.tx = WC_X - 0.95;
        head.tz = WC_Z[i];
        this.wcRes[i] = true;
        this.headT = 0.8;
      }
    }
    // Siempre llega gente nueva al final (la cola nunca se acaba)
    this.joinT -= dt;
    if (this.joinT <= 0 && this.queue.length < 7) {
      this.joinT = 1.5 + Math.random() * 2.5;
      const n = this.spawn(6 + Math.random() * 4, -4 - Math.random() * 3);
      n.mode = 'tail';
    }
    this.queue.forEach((e, k) => {
      this.slot(k);
      e.tx = this.v1.x;
      e.tz = Q_Z;
    });
    // Los que andan sueltos esquivan a Gas y a los que caminan (no a la cola, que es apretada)
    this.playerCircle.x = pp.x;
    this.playerCircle.z = pp.z;
    this.movingAvoid.length = 0;
    this.movingAvoid.push(this.playerCircle);
    for (const n of this.npcs) if (n.mode === 'toWc' || n.mode === 'leave' || n.mode === 'tail') this.movingAvoid.push(n.circle);
    for (const n of this.npcs) {
      if (n.mode === 'free') continue;
      const r = n.p.root.position;
      if (n.mode === 'queue') this.stepTo(n.p, n, n.tx, n.tz, 1.5, dt, Math.PI / 2);
      else if (n.mode === 'toWc') {
        if (this.stepTo(n.p, n, n.tx, n.tz, 1.6, dt, undefined, true, this.movingAvoid, n.circle)) {
          this.wcBusyT[n.wc] = 12 + Math.random() * 10;
          this.wcRes[n.wc] = false;
          this.hide(n);
          const d = pp.distanceTo(this.v1.set(WC_X, 0, WC_Z[n.wc]));
          if (d < 12) audio.knock(0.5 / (1 + d * 0.3), 160, 0.1);
        }
      } else if (n.mode === 'leave') {
        if (this.stepTo(n.p, n, n.tx, n.tz, 1.4, dt, undefined, true, this.movingAvoid, n.circle)) this.hide(n);
      } else if (n.mode === 'tail') {
        this.slot(this.queue.length);
        if (this.stepTo(n.p, n, this.v1.x, Q_Z, 1.7, dt, undefined, true, this.movingAvoid, n.circle) || Math.hypot(r.x - this.v1.x, r.z - Q_Z) < 0.5) {
          n.mode = 'queue';
          this.queue.push(n);
        }
      }
      n.circle.x = r.x;
      n.circle.z = r.z;
    }
    for (const n of this.npcs) if (n.mode === 'free') n.circle.x = n.circle.z = 1e4;
    this.paintToilets();
  }

  /** Final de la cola, donde Gas se pone. */
  private tailSpot(out = this.tmpV) {
    return this.slot(this.queue.length + 0.3, out);
  }

  /**
   * Gas se pone a la cola (otra vez). La primera, mientras espera, Fito toca un temón y Azul se lo graba;
   * las otras pasan rápido, pero cada cola es una canción que se pierde.
   */
  private wcTrip() {
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    this.walker.stop();
    this.trip++;
    if (this.trip > 1) toast(T_WC_AGAIN()[Math.min(this.trip - 2, 2)]);
    audio.whoosh();
    const chat = CHATS.temon;
    fadeFlash(() => {
      this.gas.root.visible = false;
      this.playerCircle.x = this.playerCircle.z = 1e4;
      this.updateHud();
    }, 500);
    if (this.trip === 1) {
      // Fito empieza el temón: Azul lo graba desde su sitio
      later(() => phoneChat({ ...chat, msgs: chat.msgs.slice(0, 6) }, () => {
        this.phase = 'film';
        dialogue(T_FILM_INTRO(), () => this.startFilm());
      }), 1100);
    } else {
      later(() => {
        this.missed++;
        toast(T_SONG_LOST()[Math.min(this.missed - 1, 2)]);
        this.startSeek();
      }, 1800);
    }
  }

  /** Grabar el temón con el móvil: la cámara es el móvil y Fito no para de moverse por el escenario. */
  private startFilm() {
    this.busy = false;
    this.input.reset();
    this.filmT = 0;
    this.filmIn = 0;
    this.filmYaw = 0;
    this.filmPitch = 0.12;
    if (!this.filmUi) this.baseFov = this.camera.fov;
    this.azul.root.visible = false;
    audio.startMusic('road');
    this.filmUi?.remove();
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;inset:17% 12% 4%;border:3px solid rgba(255,255,255,.85);border-radius:22px;pointer-events:none;z-index:5;box-shadow:0 0 0 2000px rgba(0,0,0,.35)';
    ui.innerHTML =
      '<div style="position:absolute;left:16px;top:10px;color:#fff;font:600 16px Fredoka,sans-serif"><span data-rec style="color:#ff3b3b">●</span> REC <span data-t>0:00</span></div>' +
      '<div style="position:absolute;right:16px;top:10px;color:#fff;font:600 16px Fredoka,sans-serif">🎸 <span data-q>0</span>%</div>' +
      '<div data-box style="position:absolute;left:29%;right:29%;top:25%;bottom:25%;border:2px dashed rgba(255,255,255,.6);border-radius:10px"></div>' +
      '<div data-hands style="position:absolute;inset:0;overflow:hidden"></div>';
    document.body.append(ui);
    this.filmUi = ui;
    this.updateHud();
  }

  private stepFilm(dt: number) {
    const ui = this.filmUi;
    if (!ui) return;
    this.filmT += dt;
    // Fito va y viene por el escenario
    const fito = this.band[0];
    fito.root.position.x = Math.sin(this.filmT * 0.75) * 7 + Math.sin(this.filmT * 2.3) * 1.6;
    // El móvil: joystick o arrastrar para apuntar
    const ax = this.input.axes();
    this.filmYaw = THREE.MathUtils.clamp(this.filmYaw - ax.x * 1.6 * dt - this.input.consumeCam() * 0.6, -0.9, 0.9);
    this.filmPitch = THREE.MathUtils.clamp(this.filmPitch + ax.y * 1.0 * dt, -0.1, 0.5);
    const pp = this.azul.root.position;
    const shake = Math.sin(this.filmT * 23) * 0.006 + Math.sin(this.filmT * 7) * 0.01;
    this.camera.position.set(pp.x + 0.15, 1.75, pp.z + 0.3);
    this.camera.fov += (34 - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
    this.tmpV.set(pp.x + Math.sin(this.filmYaw + shake) * 10, 1.75 + Math.tan(this.filmPitch + shake) * 10, pp.z + Math.cos(this.filmYaw + shake) * 10);
    this.camera.lookAt(this.tmpV);
    this.camera.updateMatrixWorld();
    // ¿Fito dentro del recuadro?
    this.tmpV.copy(fito.root.position).setY(fito.root.position.y + 1.6).project(this.camera);
    const inside = Math.abs(this.tmpV.x) < 0.42 && Math.abs(this.tmpV.y) < 0.5 && this.tmpV.z < 1;
    if (inside) this.filmIn += dt;
    (ui.querySelector('[data-box]') as HTMLElement).style.borderColor = inside ? 'rgba(80,255,140,.9)' : 'rgba(255,255,255,.6)';
    (ui.querySelector('[data-t]') as HTMLElement).textContent = `0:${Math.floor(this.filmT).toString().padStart(2, '0')}`;
    (ui.querySelector('[data-q]') as HTMLElement).textContent = `${Math.round((this.filmIn / Math.max(0.1, this.filmT)) * 100)}`;
    (ui.querySelector('[data-rec]') as HTMLElement).style.opacity = this.filmT % 1 < 0.5 ? '1' : '0.2';
    // Gente que salta delante con las manos arriba
    if (Math.random() < dt * 0.7) {
      const h = document.createElement('div');
      h.textContent = Math.random() < 0.5 ? '🙌' : '🙋';
      h.style.cssText = `position:absolute;bottom:-90px;left:${10 + Math.random() * 70}%;font-size:90px;transition:transform .45s ease-out;filter:brightness(.35)`;
      ui.querySelector('[data-hands]')!.append(h);
      requestAnimationFrame(() => (h.style.transform = 'translateY(-120px)'));
      later(() => (h.style.transform = 'translateY(0)'), 650);
      later(() => h.remove(), 1200);
      this.filmYaw += (Math.random() - 0.5) * 0.12;
    }
    if (this.filmT >= FILM_SECS) this.endFilm();
  }

  private endFilm() {
    this.filmUi?.remove();
    this.filmUi = null;
    this.filmDone = true;
    this.band[0].root.position.x = 0;
    this.azul.root.visible = true;
    this.camera.fov = (this.camera.userData.baseFov ?? this.baseFov);
    this.camera.updateProjectionMatrix();
    toast(`${T_FILM_DONE()} · ${this.filmPct()}%`);
    audio.luck();
    this.missed++;
    this.startSeek();
  }

  private filmPct() {
    return Math.round((this.filmIn / Math.max(0.1, Math.min(this.filmT, FILM_SECS))) * 100);
  }

  /** El flash del móvil de Azul (luz y destello) y los flashes de otra gente que despistan. */
  private buildFlash() {
    this.scene.add(this.flashLight);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xf4f8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.flashSprite.scale.setScalar(2.4);
    this.scene.add(this.flashSprite);
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xfff2dc, 0, 14, 1.5);
      this.scene.add(light);
      this.decoys.push({ light, t: 0 });
    }
  }

  private setDark(dark: boolean) {
    this.hemi.intensity = dark ? 0.42 : 1.5;
    this.sun.light.intensity = dark ? 0.3 : 1.6;
    this.spots.forEach((s) => (s.mesh.visible = !dark));
  }

  /** Gas sale del baño: entre canción y canción está oscuro y tiene que encontrar a Azul entre la gente. */
  private startSeek() {
    // Sale del baño hacia el público (de espaldas a las cabinas, para que la cámara no quede detrás)
    this.gas.root.visible = true;
    this.gas.root.position.set(WC_X - 4.5, 0, Q_Z + 2.2);
    this.walker.stop();
    this.walker.yaw = this.walker.facing = -0.75;
    this.placeAzul(AZUL_SPOTS[(this.trip - 1) % TRIPS]);
    this.phase = 'seek';
    this.songT = 0;
    this.seekT = 0;
    this.flashT = 1.2;
    this.setDark(true);
    audio.stopMusic();
    audio.ambience(0.25);
    this.busy = true;
    this.updateHud();
    const chat = CHATS.temon;
    const go = () => dialogue([{ who: 'Narrador', text: T_SEEK_HINT() }], () => {
      this.busy = false;
      this.updateHud();
    });
    // La primera vez, lo que le escribió al salir
    if (this.trip === 1) phoneChat({ ...chat, msgs: chat.msgs.slice(6) }, go);
    else go();
  }

  /** Buscando a Azul: ella hace doble flash cada poco; otros móviles despistan; las canciones pasan. */
  private stepSeek(dt: number) {
    const ap = this.azul.root.position;
    const pp = this.player.root.position;
    this.seekT += dt;
    this.songT += dt;
    if (this.songT > SONG_SECS) {
      this.songT = 0;
      this.missed++;
      toast(T_SONG_LOST()[Math.min(this.missed - 1, 2)]);
      audio.cheer(0.25);
      this.updateHud();
    }
    // Doble flash de Azul: más a menudo cuanto más tarda (ella también le busca)
    this.flashT -= dt;
    if (this.flashT <= 0) {
      this.flashT = Math.max(1.4, 3.2 - this.seekT * 0.04) + Math.random() * 0.8;
      this.flashPulse = 0.45;
    }
    const prevPulse = this.flashPulse;
    this.flashPulse = Math.max(0, this.flashPulse - dt);
    const on = (this.flashPulse > 0.33 && this.flashPulse <= 0.45) || (this.flashPulse > 0.05 && this.flashPulse <= 0.17);
    if (on && !(prevPulse > 0.33 && prevPulse <= 0.45) && this.flashPulse > 0.33) audio.pop();
    this.flashLight.position.set(ap.x, 2.3, ap.z);
    this.flashLight.intensity = on ? 60 : 0;
    this.flashSprite.position.set(ap.x + 0.25, 2.25, ap.z + 0.2);
    const sm = this.flashSprite.material as THREE.SpriteMaterial;
    sm.opacity = on ? 1 : 0;
    this.recordT = 0.3; // Azul con el móvil en alto
    // Otros móviles: flashes sueltos por el público
    this.decoyT -= dt;
    if (this.decoyT <= 0) {
      this.decoyT = 0.5 + Math.random() * 0.9;
      const d = this.decoys.find((x) => x.t <= 0);
      const c = this.people[Math.floor(Math.random() * (this.people.length - 1))];
      if (d && c) {
        d.t = 0.12;
        d.light.position.set(c.x, 2.2, c.z);
      }
    }
    for (const d of this.decoys) {
      d.t -= dt;
      d.light.intensity = d.t > 0 ? 40 : 0;
    }
    // Azul mira hacia Gas cuando está cerca
    const toG = Math.atan2(pp.x - ap.x, pp.z - ap.z);
    const near = Math.hypot(pp.x - ap.x, pp.z - ap.z);
    this.azul.root.rotation.y += wrapA((near < 6 ? toG : 0) - this.azul.root.rotation.y) * Math.min(1, dt * 4);
    if (near < 1.7) this.foundAzul();
  }

  private foundAzul() {
    this.phase = 'found';
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.flashLight.intensity = 0;
    (this.flashSprite.material as THREE.SpriteMaterial).opacity = 0;
    for (const d of this.decoys) d.light.intensity = d.t = 0;
    const pp = this.player.root.position;
    const ap = this.azul.root.position;
    this.walker.facing = Math.atan2(ap.x - pp.x, ap.z - pp.z);
    this.azul.root.rotation.y = Math.atan2(pp.x - ap.x, pp.z - ap.z);
    audio.luck();
    vibrate(25);
    this.fx.burst(ap.clone().lerp(pp, 0.5).setY(2.3), '❤️', 3, 0.8, 0.6);
    hugFor(this.azul, this.player, 2.6);
    const lines = [...T_FOUND()[Math.min(this.trip - 1, 2)], ...(this.trip === 1 && this.smokeThrown ? [CONCERT.gasSmoke] : [])];
    // La primera vez, escena de cine: el flash entre miles de personas a oscuras, ella con el móvil
    // en alto y la cámara dando la vuelta al abrazo. Las siguientes, directamente el abrazo
    const az = () => headOf(this.azul);
    const gs = () => headOf(this.player);
    const mid = () => az().lerp(gs(), 0.5).setY(1.45);
    let orbit0 = -1;
    const around = () => {
      if (orbit0 < 0) orbit0 = performance.now();
      const a = Math.atan2(pp.x - ap.x, pp.z - ap.z) + Math.PI / 2 + ((performance.now() - orbit0) / 1000) * 0.3;
      return mid().add(new THREE.Vector3(Math.sin(a) * 2.6, 0.35, Math.cos(a) * 2.6));
    };
    const flash = (on: boolean) => {
      this.flashLight.position.set(ap.x, 2.3, ap.z);
      this.flashLight.intensity = on ? 90 : 0;
      this.flashSprite.position.set(ap.x + 0.25, 2.25, ap.z + 0.2);
      (this.flashSprite.material as THREE.SpriteMaterial).opacity = on ? 1 : 0;
    };
    const first = this.trip === 1;
    if (first)
      cinema.play([
        // Desde detrás de Gas: entre la gente, a oscuras, se enciende un flash
        { dur: 1.8, slow: 0.25, pos: () => rel(gs(), az(), 1.1, 0.4, 0.2), pos2: () => rel(gs(), az(), 0.8, 0.3, 0.15), look: az, fov: 38, focus: az, at: () => { flash(true); audio.pop(); juice.fx?.flashScreen(0xffffff, 0.55); } },
        // Ella, con el móvil en alto
        { dur: 2.2, slow: 0.35, pos: () => rel(az(), gs(), -0.95, 0.8, 0.05), pos2: () => rel(az(), gs(), -0.7, 0.55, 0.02), look: az, fov: 42, focus: az, at: () => flash(true) },
        // El abrazo: la cámara les da la vuelta mientras dura la conversación
        { dur: Infinity, slow: 1, pos: around, look: mid, fov: 50, focus: mid, at: () => { flash(false); audio.cheer(0.4); } },
      ]);
    later(() => dialogue(lines, () => {
      if (first) cinema.stop();
      if (this.trip >= TRIPS) {
        this.startRhythm();
        return;
      }
      // Vuelve la luz, suena otra canción y Gas tiene que volver al baño
      this.setDark(false);
      audio.startMusic('road');
      later(() => dialogue(T_GO_AGAIN()[Math.min(this.trip, 2)], () => {
        this.busy = false;
        this.phase = 'toWc';
        this.updateHud();
      }), 900);
    }), first ? 4000 : 0);
  }

  private updateHud() {
    const h = this.hud;
    let chips = '';
    if (this.trip > 0 || this.phase === 'toWc') chips += `<span class="chip">🚻 ${this.trip}/${TRIPS}</span>`;
    if (this.missed > 0) chips += `<span class="chip">🎵 se pierde ${this.missed}</span>`;
    if (this.phase === 'seek') chips += `<span class="chip">⏱️ ${Math.max(0, Math.ceil(SONG_SECS - this.songT))}s</span>`;
    if (this.filmDone && this.phase !== 'seek') chips += '<span class="chip">📹</span>';
    chips += this.smokeThrown ? '<span class="chip">🚭</span>' : '';
    if (this.phase === 'airport' && this.burgerHits) chips += `<span class="chip">🧳 ${this.burgerHits}</span>`;
    if (chips !== this.hudChips) h.setCounters((this.hudChips = chips));
    const setObj = (t: string) => {
      if (t !== this.hudObj) h.setObjective((this.hudObj = t));
    };
    switch (this.phase) {
      case 'airport':
        setObj(T_AIRPORT_HINT());
        break;
      case 'intro':
      case 'toWc':
        setObj(this.trip === 0 ? 'Gas: ve a la cola del baño (al fondo, a la derecha)' : 'Otra vez al baño: a la cola');
        break;
      case 'film':
        setObj('Mantén a Fito dentro del recuadro');
        break;
      case 'seek':
      case 'found':
        setObj(T_SEEK_HINT());
        break;
      case 'rhythm':
        setObj(CONCERT.rhythm);
        break;
      default:
        setObj('💙 Feliz cumpleaños 💙');
    }
  }

  private target(): THREE.Vector3 | null {
    if (this.phase === 'airport') return this.v1.set((AIR.minX + AIR.maxX) / 2, 0, AIR.maxZ - 1);
    if (this.phase === 'toWc') return this.tailSpot(this.v1);
    return null;
  }

  /** Pantallas del escenario: ecualizador, nombre y luces al ritmo. */
  private drawScreens(beat: number, pulse: number) {
    const live = this.phase === 'rhythm' || this.phase === 'ending';
    const dark = this.phase === 'seek' || this.phase === 'found';
    for (const ctx of this.screenCtx) {
      const w = 512;
      const h = 256;
      if (dark) {
        ctx.fillStyle = '#05040c';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(this.t * 3)})`;
        ctx.textAlign = 'center';
        ctx.font = 'bold 60px sans-serif';
        ctx.fillText('· · ·', w / 2, h / 2 + 20);
        continue;
      }
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

    // Público y banda: de pie, gesticulando; en pleno concierto con los brazos arriba
    const energy = this.phase === 'rhythm' || this.phase === 'ending' ? 1 : this.phase === 'seek' ? 0.25 : 0.55;
    let gi = 0;
    for (const c of this.crowds) {
      c.base.forEach((b, i) => {
        const k = gi++;
        const ox = this.cOff[2 * k] ?? 0;
        const oz = this.cOff[2 * k + 1] ?? 0;
        const vx = this.cVel[2 * k] ?? 0;
        const vz = this.cVel[2 * k + 1] ?? 0;
        const pushed = Math.hypot(vx, vz);
        // Si le empujan se tambalea hacia donde le llevan y baja los brazos
        crowdPose(this.pose, this.t, b.ph, energy * Math.max(0.2, 1 - pushed * 2));
        this.tmpQ.setFromAxisAngle(this.up, b.ry);
        if (pushed > 0.01) {
          this.tiltAx.set(vz / pushed, 0, -vx / pushed);
          this.tiltQ.setFromAxisAngle(this.tiltAx, Math.min(0.35, pushed * 0.2 + Math.hypot(ox, oz) * 0.12));
          this.tmpQ.premultiply(this.tiltQ);
        }
        c.people.set(i, b.x + ox, b.z + oz, this.tmpQ, this.pose);
      });
      c.people.commit();
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

    // Personaje que se lleva (Azul en el aeropuerto, Gas en el estadio)
    const walking = !this.busy && (this.phase === 'toWc' || this.phase === 'airport' || this.phase === 'seek');
    this.invuln -= dt;
    if (this.phase === 'airport' && !this.busy) this.stepAirport(dt);
    // Grabando, arrastrar apunta el móvil (lo lee stepFilm)
    if (this.phase !== 'film') this.walker.turn(this.input.consumeCam());
    this.walker.canJump = walking;
    const mag = this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, this.colliders, this.player.root.position.x > 100 ? AIR : this.bounds, this.player === this.gas ? this.allPeople : []);
    if (this.walker.bump) audio.knock(Math.min(0.45, this.walker.bump * 0.07), 200, 0.07); // choque sordo contra alguien
    this.stepCrowd(dt);
    this.stepQueue(dt);
    if (this.phase === 'seek' && !this.busy) this.stepSeek(dt);
    if (this.phase === 'film') this.stepFilm(dt);
    {
      const pp0 = this.player.root.position;
      const m = this.movers[0];
      m.x = pp0.x;
      m.z = pp0.z;
      m.vx = this.walker.vx;
      m.vz = this.walker.vz;
      this.phys.step(dt, this.movers);
      this.stepBall();
      for (const im of this.phys.impacts) {
        const d = im.at.distanceTo(pp0);
        if (d < 14) audio.knock(Math.min(1, im.strength * (im.kind === 'cup' ? 6 : 2)) / (1 + d * 0.3), im.kind === 'ball' ? 520 : 2300);
      }
    }
    const live = this.phase === 'rhythm' || this.phase === 'ending';
    this.player.root.rotation.y = this.walker.facing;
    if (live) animatePerson(this.player, dt, this.phase === 'ending' ? 'cheer' : 'dance', 0, beat * Math.PI);
    else animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);
    // Azul (si no la llevas): en su sitio, bailando o con el móvil en alto haciendo flash
    if (this.player !== this.azul) {
      if (live) animatePerson(this.azul, dt, 'dance', 0, beat * Math.PI + 1);
      else animatePerson(this.azul, dt, this.phase === 'found' ? 'talk' : 'idle');
      this.recordT -= dt;
      if (this.recordT > 0) {
        this.azul.armR.rotation.x = -2.5;
        this.azul.elbowR.rotation.x = -0.5;
      }
    }

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
    this.lighters.visible = live || this.phase === 'seek' || this.phase === 'found';
    (this.lighters.material as THREE.PointsMaterial).size = 0.6 + Math.sin(this.t * 13) * 0.08;
    this.lighters.position.x = Math.sin(this.t * 1.2) * 0.25;

    // Tabaco
    this.smoke.visible = !this.smokeThrown;
    this.smoke.rotation.y += dt;

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    const pp = this.player.root.position;
    if (walking && !this.smokeThrown && this.phase === 'airport' && pp.distanceTo(SMOKE_POS) < 1.8) {
      // El tabaco, a la papelera (opcional; Gas se fijará)
      label = 'Tirar 🚭';
      action = () => {
        this.smokeThrown = true;
        audio.luck();
        toast(CONCERT.smokeFound);
        this.fx.burst(SMOKE_POS.clone().setY(1), '✨', 8);
        this.updateHud();
      };
    } else if (walking && this.phase === 'airport') {
      if (pp.z > AIR.maxZ - 2.5) {
        label = '🛫 Embarcar';
        action = () => this.board();
      }
    } else if (walking && this.phase === 'toWc') {
      if (pp.distanceTo(this.tailSpot()) < 1.6) {
        label = '🚻 A la cola';
        action = () => this.wcTrip();
      } else if (pp.distanceTo(BAR_POS) < 3.2) {
        label = 'Hablar';
        action = () => this.talk(CONCERT.barmanAgain, () => this.phase);
      }
    }
    this.hud.setAction(label, label === 'Tirar 🚭' || label === '🛫 Embarcar' || label === '🚻 A la cola');
    if (this.input.consumeAction() && action) action();
    if (this.phase === 'seek') this.updateHud();

    // Marcador y flecha
    const tgt = this.target();
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, 3.6 + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 3 ? null : -rel);
      beacon.at(pp.distanceTo(tgt) < 3 ? null : tgt);
    } else {
      this.hud.setArrow(null);
      beacon.at(null);
    }

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

  private startRhythm() {
    this.busy = true;
    this.phase = 'rhythm';
    // Se vuelve la luz y se van juntos a primera fila
    this.setDark(false);
    this.flashLight.intensity = 0;
    if (this.player !== this.gas) this.toStadium();
    this.gas.root.position.copy(GAS_POS);
    this.walker.stop();
    this.walker.facing = this.walker.yaw = 0;
    this.placeAzul(this.v1.set(GAS_POS.x + 1.1, 0, GAS_POS.z));
    this.gas.root.visible = true;
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
    later(() => {
      if (this.phase !== 'ending') return;
      dialogue(CONCERT.ending, () => phoneChat([CHATS.noQuieroNoVerte, { ...CHATS.iconico, msgs: CHATS.iconico.msgs.slice(-1) }], () => {
        later(() => {
          if (this.phase !== 'ending') return;
          this.phase = 'done';
          audio.ambience(0);
          const { hits, total, perfects, maxCombo } = this.result;
          const acc = total ? hits / total : 1;
          this.onComplete({
            stars: acc >= 0.9 ? 3 : acc >= 0.65 ? 2 : 1,
            stats: [
              ['Notas', `${hits}/${total}`],
              ['Perfectas', `${perfects} · racha x${maxCombo}`],
              ['Maletas esquivadas', this.burgerHits ? `chocaste con ${this.burgerHits} 🧳` : 'todas 🧳'],
              ['Vídeo del temón', `${this.filmPct()}% con Fito en plano 📹`],
              ['Viajes al baño', `${TRIPS} 🚻 · se perdió ${this.missed} ${this.missed === 1 ? 'canción' : 'canciones'}`],
              ['Tabaco', this.smokeThrown ? 'a la papelera 🚭' : 'sigue ahí… 🚬'],
            ],
          });
        }, 2500);
      }));
    }, 2500);
  }

  private updateCamera(dt: number) {
    if (this.phase === 'film') return;
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
      if (this.filmUi) {
        this.filmUi.remove();
        this.filmUi = null;
        this.azul.root.visible = true;
        this.camera.fov = this.camera.userData.baseFov ?? this.baseFov;
        this.camera.updateProjectionMatrix();
      }
      this.setDark(false);
      this.flashLight.intensity = 0;
    };
    return [
      { label: '0 · Aeropuerto', run: () => { stop(); this.startAirport(); } },
      { label: '1 · Estadio: al baño', run: () => { stop(); this.toStadium(); this.trip = 0; this.phase = 'toWc'; this.updateHud(); } },
      { label: '2 · Grabar el temón', run: () => { stop(); this.toStadium(); this.trip = 1; this.gas.root.visible = false; this.phase = 'film'; this.startFilm(); } },
      { label: '3 · Buscar a Azul a oscuras', run: () => { stop(); this.toStadium(); this.trip = 1; this.startSeek(); } },
      { label: '3b · Tercera vez al baño', run: () => { stop(); this.toStadium(); this.trip = 3; this.missed = 2; this.startSeek(); } },
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
    this.filmUi?.remove();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}
