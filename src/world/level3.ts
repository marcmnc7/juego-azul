import * as THREE from 'three';
import { Surf, setSurface } from '../core/surfaces';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { steerTo, steerSpeed, faceTo, type SteerState } from '../core/steer';
import { CONCERT, SIDE } from '../data/story';
import { FITO_SONG, SONG_OF } from '../core/songs';
import { BeerRun, BEERS_NEED, PeeAim, GlassesHunt } from './sideGames';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { fitoPrint, shirtPrint } from '../entities/print';
import { G, Merger, makePerson, animatePerson, Person, makeCrowd, type CrowdLike, crowdPose, newCrowdPose, vertexMat, palmCrown, PersonLook, seatPose, seatedRootY } from '../entities/models';
import { Sky, Sun, toon, glowTexture, vibrate } from '../core/gfx';
import { LOOK_LIGHT } from '../core/comic';
import { comicBulbTexture, comicStarTexture } from '../core/comicTiles';
import { Particles } from '../entities/fx';
import { PhysicsWorld, Body, beachBallTexture, type Mover } from '../core/physics';
import { hud, dialogue, fadeFlash, Hud, DebugItem, later, phoneChat, bark, comicWord } from '../ui/ui';
import { hugFor, twoBone } from '../entities/embrace';
import { boneAnchor, rigPost } from '../entities/rig';
import { CHATS } from '../data/chats';
import type { Line } from '../data/story';
import type { Box2 } from './ferreries';
import type { Level, LevelDone } from './level';
import { disposeScene } from './level';
import { cinema, headOf, rel } from '../core/cinema';
import { juice } from '../core/juice';
import { beacon } from '../core/beacon';
import { Lost } from '../core/lost';
import { Door } from './door';
import { Fito } from '../entities/fito';

// Capítulo 4 · Fito en Gran Canaria (12-16 de marzo de 2026).
// Barajas, de día: Azul corre esquivando maletas hasta la puerta 26, hace la cola de embarque y enseña la tarjeta →
// esa noche, llegadas del aeropuerto de Gran Canaria: Gas la espera en la cafetería («dentro aún») → al día
// siguiente, el estadio: Gas va a por cervezas, se apagan las luces y sale la banda, y Gas tiene que ir al baño una y
// otra vez (la cola de los WC; la primera vez, Azul le graba el temón) → en una canción lenta la pista está a oscuras,
// todo el mundo con el móvil en alto, y cuesta encontrarla (ella hace doble flash; cada canción que pasa buscándola,
// se la pierde) → minijuego de ritmo juntos en primera fila → final.
//
// Estilo de tebeo (como el cap. 2): las lámparas no iluminan nada (ni focos ni luces de punto: solo se ven
// encendidas); la luz del escenario son haces planos y pantallas; las pistas (marcador y flecha) solo salen si se
// lleva 40 s sin avanzar (Lost); los avisos los dice alguien, en un bocadillo.

type Phase = 'intro' | 'airport' | 'gateQueue' | 'arrivals' | 'beers' | 'show' | 'toWc' | 'wc' | 'film' | 'seek' | 'found' | 'rhythm' | 'ending' | 'done';

const INK = '#141018';
const PAPER = '#fffbf0';
const COMIC_FONT = "Bangers, 'Arial Black', Impact, sans-serif";

const BAR_POS = new THREE.Vector3(-17, 0, -8);
const GAS_POS = new THREE.Vector3(-8.5, 0, 24.2);
const AISLE_X = -8.5;
// WC portátiles a la derecha, con la puerta mirando al recinto
const WC_X = 17;
const WC_Z = [-17, -15.5, -14, -12.5, -11, -9.5];
const FILM_SECS = 15;
// Terminal del aeropuerto, lejos del estadio (mismo mundo, otra zona)
const AIR = { minX: 290, maxX: 302, minZ: -30, maxZ: 30 };
/** Segundos hasta que cierran la puerta 26 (y cada maleta que te da, dos menos). */
const GATE_SECS = 26;
/** Hasta dónde se anda en la terminal: a un cuerpo de las cristaleras y hasta el muro del fondo. */
const AIR_WALK = { minX: AIR.minX + 0.32, maxX: AIR.maxX - 0.32, minZ: AIR.minZ - 2.65, maxZ: AIR.maxZ };
const GATE_X = (AIR.minX + AIR.maxX) / 2;
/** Donde se enseña la tarjeta, delante del torno de la puerta 26. */
const GATE_SCAN = new THREE.Vector3(GATE_X, 0, AIR.maxZ + 0.9);
/** Sitio k de la cola de embarque (por el pasillo de cintas del centro, desde el torno hacia atrás). */
const gateSlot = (k: number): [number, number] => [GATE_X, AIR.maxZ - 0.2 - k * 0.85];
/** La papelera de la terminal, junto a un pilar: Azul puede tirar ahí su tabaco. */
const BIN_POS = new THREE.Vector3(290.8, 0, 8.6);
// (entre pilar y pilar: con un pilar delante, de «PRENSA» se leía «PR SA»)
const BURGERS: [number, number][] = [[302.6, -4.75], [289.4, 2.75], [302.6, 17.75]];
// Llegadas del aeropuerto de Gran Canaria, esa noche (otra zona del mismo mundo, también x > 100: luz de interior)
const ARR = { minX: 393, maxX: 407, minZ: -12, maxZ: 12 };
const ARR_WALK = { minX: ARR.minX + 0.4, maxX: ARR.maxX - 0.4, minZ: ARR.minZ + 0.6, maxZ: ARR.maxZ - 0.7 };
const ARR_START = new THREE.Vector3(398, 0, -10.6);
const CAFE_GAS = new THREE.Vector3(404.2, 0, 3.3);
// La mesa de sonido (FOH) en medio de la pista, como en todos los conciertos de estadio
const FOH = new THREE.Vector3(-1, 0, -12);
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
/** Luz principal: en Barajas, el día que entra por la cubierta (alto, para que las cristaleras no llenen el suelo
 * de sombra); en el estadio, desde la torre de sonido, detrás del público (ilumina a la banda de frente). */
const DAY_SUN = new THREE.Vector3(0.25, 1, -0.3);
const NIGHT_SUN = new THREE.Vector3(-0.3, 0.95, -0.75);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const LOOKS: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
  { skin: 0xd9a27c, shirt: 0x1b998b, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
  { skin: 0xf0c8a6, shirt: 0xd7263d, pants: 0x222222, hair: 0xb07a3a, hairStyle: 'cap' },
  { skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'bun' },
  { skin: 0xe2b08c, shirt: 0x7a5cff, pants: 0x2a2a2a, hair: 0x3a2414, hairStyle: 'pony' },
  { skin: 0xb98060, shirt: 0x2d6a4f, pants: 0x4a4a52, hair: 0x1a1a1a, hairStyle: 'short', beard: true },
];

// Colores propios de este capítulo que la heurística ponía en la superficie equivocada (D2): montantes y bancos de
// acero que salían de piedra, lamas de bambú de sillares de marès, la barra de teja, botellas de hojas, cabinas de cal…
// (colores únicos de este capítulo: no cambian nada en los demás)
for (const c of [0x5a6470, 0x4a5a6c, 0x3f4750, 0xf6f7f8, 0xdfe3e9, 0xc9ced6, 0x9a9aa6, 0x22222a, 0x3a3a45, 0xcccccd, 0xe8c66a, 0x777780, 0xc0c4cc]) setSurface(c, Surf.Metal);
for (const c of [0xd9b26a, 0xb8905a, 0x8a5a37, 0x6b4a31, 0x7a5434]) setSurface(c, Surf.Wood);
for (const c of [0xf4c95e, 0x2f7d4b]) setSurface(c, Surf.Glass);
for (const c of [0xf4c430, 0xf2d24a, 0xf2c232, 0xf2c233, 0xd8c7a5, 0xe9eef5, 0xeceef1]) setSurface(c, Surf.None);
setSurface(0x7d8087, Surf.Asphalt); // la pista del aeropuerto

/** Alguien del público con vida propia: hace cola, entra al baño, sale, o intenta colarse. */
interface Npc extends SteerState {
  p: Person;
  mode: 'free' | 'queue' | 'toWc' | 'leave' | 'tail';
  tx: number;
  tz: number;
  wc: number;
  walk: number;
  circle: Circle;
  /** Siguiente punto del camino (para no cortar por las cabinas al entrar o salir del WC). */
  next?: [number, number];
}
/** Los de la cola de embarque de la puerta 26: esperan, enseñan la tarjeta en el torno y entran al finger. */
interface GateNpc extends SteerState {
  p: Person;
  walk: number;
  state: 'line' | 'scan' | 'pass' | 'gone';
  t: number;
  circle: Circle;
}
/** Alguien que el juego lleva andando por su cuenta (Azul en la cola de embarque, Gas a la cola del baño). */
interface Auto {
  p: Person;
  st: SteerState & { walk: number };
  pts: [number, number][];
  speed: number;
  face?: number;
  done?: () => void;
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

/** Lienzo de tebeo: se vuelve a dibujar cuando llega la letra de tebeo (Bangers), que se carga aparte. */
function comicTex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256) {
  const t = canvasTex(draw, w, h);
  document.fonts
    ?.load(`40px Bangers`)
    .then(() => {
      const ctx = (t.image as HTMLCanvasElement).getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h);
      t.needsUpdate = true;
    })
    .catch(() => {});
  return t;
}

/** Texto de tebeo: letra de tebeo con su contorno de tinta. */
function inkText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, maxW = Infinity) {
  let s = size;
  do ctx.font = `${s}px ${COMIC_FONT}`;
  while (ctx.measureText(text).width > maxW && (s -= 3) > 12);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, s * 0.14);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Rótulo de tebeo: fondo plano, marco de tinta y letra de tebeo (como los carteles del cap. 1). */
function signTex(text: string, bg: string, fg: string, w = 512, h = 128) {
  return comicTex(
    (ctx, cw, ch) => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = bg;
      ctx.fillRect(7, 7, cw - 14, ch - 14);
      ctx.textAlign = 'center';
      inkText(ctx, text, cw / 2, ch / 2 + 3, ch * 0.6, fg, cw - 48);
    },
    w,
    h,
  );
}

/**
 * Plano partido en trozos de ~0,4 m (rótulos, pantallas): así se comba a mano alzada igual que la pared o el marco
 * que tiene detrás y no lo atraviesan (receta `bendable` del cap. 2).
 */
const flatPlane = (w: number, h: number) => new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / 0.4)), Math.max(1, Math.ceil(h / 0.4)));

/** El flash de un móvil, en tebeo: estallido de puntas blanco con su contorno de tinta (no un halo borroso). */
let flashTex: THREE.CanvasTexture | null = null;
function flashTexture() {
  if (flashTex) return flashTex;
  flashTex = canvasTex(
    (g, w) => {
      const c = w / 2;
      const burst = (R: number, r: number, n: number, rot: number) => {
        g.beginPath();
        for (let i = 0; i < n * 2; i++) {
          const a = rot + (i / (n * 2)) * Math.PI * 2;
          const q = i % 2 ? r : R * (0.82 + 0.18 * ((i * 7) % 3) / 2);
          g.lineTo(c + Math.cos(a) * q, c + Math.sin(a) * q);
        }
        g.closePath();
      };
      burst(60, 26, 12, 0.1);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineJoin = 'round';
      g.lineWidth = 5;
      g.strokeStyle = INK;
      g.stroke();
      burst(30, 14, 8, 0.4);
      g.fillStyle = '#dff2ff';
      g.fill();
    },
    128,
    128,
  );
  return flashTex;
}

/**
 * Haz de luz del escenario en tebeo: cono de color plano semitransparente, un poco más denso junto al foco, con el
 * borde marcado (su silueta, en una raya más opaca). Sin degradado y sin iluminar nada.
 */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0xffffff) }, opacity: { value: 0.16 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float opacity;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        if (vY < 0.02) discard;
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = opacity * (vY > 0.72 ? 1.5 : 1.0);
        if (rim > 0.86) a = min(0.9, opacity * 3.4);
        gl_FragColor = vec4(color, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Fuegos de tebeo: estrellas planas con su contorno de tinta, del color de cada palmera, que se apagan por
 * transparencia (los de siempre se apagaban oscureciendo el color y en el tebeo quedaban discos negros colgados).
 */
class ComicFireworks {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private next = 0;
  private readonly N = 600;

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3).fill(-999);
    this.col = new Float32Array(this.N * 4);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    // (color con alfa por punto: así cada estrella se apaga sola)
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const m = new THREE.PointsMaterial({ size: 1.3, map: comicStarTexture(), vertexColors: true, transparent: true, depthWrite: false, fog: false, alphaTest: 0.02 });
    m.userData.comicGlow = true;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }

  burst(at: THREE.Vector3) {
    const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    for (let k = 0; k < 70; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.N;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 8 + Math.random() * 3;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], i * 3);
      this.col.set([c.r, c.g, c.b, 1], i * 4);
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
      }
      // Plana casi toda la vida; al final, se va
      this.col[i * 4 + 3] = k > 0.35 ? 1 : k / 0.35;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.pos.fill(-999);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/**
 * Marca como «persona» lo que lleva encima (maletas, instrumentos, sombrero, estampados): con el cambio D6b de
 * comic.ts, se pintan con la sombra clara de los personajes y sin tinta por dentro, en vez de como decorado.
 */
function markProps(p: Person) {
  p.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !o.userData.blob) o.userData.person = true;
  });
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
  private end = 0;
  private nextDrum = 0;
  /** Las notas salen de la canción que suena: no hay que tocar nada más encima. */
  private onSong = false;
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
    // Sobre los golpes de la canción que está sonando; sin canción, el riff de siempre
    const hits = audio.trackHits((SONG.length * 16 + 8) * EIGHTH, 2.2);
    if (hits && hits.length > 12) {
      this.onSong = true;
      for (const h of hits) this.notes.push({ t: h.t, lane: h.lane, semi: 0, done: false, scheduled: true });
      this.total = this.notes.length;
      this.end = hits[hits.length - 1].t + 0.6;
      return;
    }
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
    while (!this.onSong && this.t0 + this.nextDrum * EIGHTH * 2 < now + 0.3 && this.t0 + this.nextDrum * EIGHTH * 2 < this.end) {
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
    const hitY = h - 22;
    const R = Math.min(lw * 0.3, 19);
    x.lineJoin = x.lineCap = 'round';
    // Carriles en tebeo: color plano (sin degradado), separados por tinta; al pulsar, una franja del color del carril
    for (let i = 0; i < 3; i++) {
      x.fillStyle = 'rgba(30,20,46,.8)';
      x.fillRect(i * lw, 0, lw, h);
      if (this.flash[i] > 0.05) {
        x.fillStyle = this.colors[i];
        x.globalAlpha = 0.25 + this.flash[i] * 0.4;
        x.fillRect(i * lw + 3, hitY - 44, lw - 6, 44);
        x.globalAlpha = 1;
      }
    }
    x.fillStyle = INK;
    for (let i = 1; i < 3; i++) x.fillRect(i * lw - 1.5, 0, 3, h);
    // Línea de golpe: tinta y papel
    x.fillRect(0, hitY - 3, w, 6);
    x.fillStyle = PAPER;
    x.fillRect(0, hitY - 1, w, 2);
    // Diana de cada carril
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.arc(i * lw + lw / 2, hitY, R + 4, 0, Math.PI * 2);
      x.strokeStyle = INK;
      x.lineWidth = 7;
      x.stroke();
      x.strokeStyle = this.colors[i];
      x.lineWidth = 3;
      x.stroke();
    }
    // Aros de acierto: anillos planos que crecen a saltos (sin fundido)
    for (const r of this.rings) {
      const rad = R + 6 + Math.floor((r.t / 0.35) * 3) * 10;
      x.beginPath();
      x.arc(r.lane * lw + lw / 2, hitY, rad, 0, Math.PI * 2);
      x.strokeStyle = INK;
      x.lineWidth = 8;
      x.stroke();
      x.strokeStyle = r.perfect ? '#fff4a0' : this.colors[r.lane];
      x.lineWidth = 4;
      x.stroke();
    }
    // Notas: círculo de color con su contorno de tinta y un brillo
    for (const n of this.notes) {
      if (n.done) continue;
      const k = 1 - (n.t - now) / TRAVEL;
      if (k < 0 || k > 1.2) continue;
      const y = k * hitY;
      const cx = n.lane * lw + lw / 2;
      x.beginPath();
      x.arc(cx, y, R, 0, Math.PI * 2);
      x.fillStyle = this.colors[n.lane];
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 4;
      x.stroke();
      x.fillStyle = 'rgba(255,255,255,.85)';
      x.beginPath();
      x.ellipse(cx - R * 0.32, y - R * 0.34, R * 0.28, R * 0.18, -0.5, 0, Math.PI * 2);
      x.fill();
    }
    x.textAlign = 'center';
    if (now < this.t0) inkText(x, String(Math.ceil(this.t0 - now)), w / 2, h / 2, 36, '#ffcf1f');
    if (this.labelT > 0) inkText(x, this.label, w / 2, h * 0.35, 26, '#ffcf1f', w - 16);
    x.textAlign = 'left';
    inkText(x, `${this.hits}/${this.total}`, 8, 16, 18, PAPER);
    if (this.combo >= 3) {
      x.textAlign = 'right';
      inkText(x, `x${this.combo}`, w - 8, 16, 20, '#f4d35e');
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
  private fireworks = new ComicFireworks();
  private phase: Phase = 'intro';
  /** El personaje que se controla: Azul en el aeropuerto, Gas en el estadio. */
  private player: Person;
  private walker: Walker;
  private azul: Person;
  private gas: Person;
  private barman: Person;
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
  /** Lo que dice libre/ocupado en cada cabina: el indicador de la puerta y el piloto de encima. */
  private wcLights: { box: THREE.MeshBasicMaterial; lamp: THREE.SpriteMaterial }[] = [];
  private beers: BeerRun | null = null;
  private fito: Fito | null = null;
  /** Minijuego del baño en pantalla (urinario o cabinas). */
  private side: PeeAim | GlassesHunt | null = null;
  private gateT = GATE_SECS;
  private gateStage = 0;
  /** La cola de embarque de la puerta 26 y en qué punto está Azul. */
  private gateQ: GateNpc[] = [];
  private gateStep: 'none' | 'line' | 'scan' | 'ask' | 'pass' = 'none';
  private gateNext = 0;
  private gateCircles: Circle[] = [];
  private azSt: SteerState & { walk: number } = { walk: 0 };
  /** Las aletas del torno (se recogen al pasar la tarjeta). */
  private flaps: THREE.Mesh[] = [];
  private flapOpen = 0;
  private agent!: Person;
  /** Quien anda solo, llevado por el juego. */
  private auto: Auto | null = null;
  /** Gas en la cola del baño: la cola espera con él (si no, le adelantaba la gente que llega). */
  private gasQueued = false;
  /** Gente de llegadas (Gran Canaria) con la que no se puede chocar. */
  private arrCircles: Circle[] = [];
  /** Quien está hablando ahora (gesticula unos segundos). */
  private talkers = new Map<Person, number>();
  /** Manos en los instrumentos de la banda (se quitan al salir). */
  private posts: ((dt: number) => void)[] = [];
  private wcDoors: Door[] = [];
  private wcWho: THREE.Vector3[] = [];
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
  private decoys: { s: THREE.Sprite; t: number }[] = [];
  private filmT = 0;
  private filmIn = 0;
  private filmYaw = 0;
  private filmPitch = 0;
  private filmUi: HTMLDivElement | null = null;
  private filmDone = false;
  private baseFov = 0;
  private burgers: { o: THREE.Mesh; v: THREE.Vector3; live: boolean; from: THREE.Vector3 }[] = [];
  /** De qué tienda ha salido la última maleta (de ahí sale la voz de quien la ha perdido). */
  private suitcaseFrom: THREE.Vector3 | null = null;
  private travelers: ({ p: Person; dir: number; x: number; walk: number; c: Circle; tx?: number } & SteerState)[] = [];
  private burgerT = 1;
  private burgerHits = 0;
  private invuln = 0;
  private recordT = 0;
  private hudChips = '-';
  private hudObj = '';
  // Luz: el sitio (Barajas y llegadas, de día o de interior; el estadio, de noche) y la pista a oscuras
  private hemi!: THREE.HemisphereLight;
  private sunOff = new THREE.Vector3();
  private wasDay: boolean | null = null;
  private dark = false;
  private darkK = 0;
  private daySky: Sky;
  /** Lo que solo se ve de noche desde el estadio (montes, luces de los barrios, el estadio grande). */
  private nightOnly = new THREE.Group();
  private flashSprite!: THREE.Sprite;
  private v1 = new THREE.Vector3();
  private bounds: Box2 = { minX: -22, maxX: 22, minZ: -22, maxZ: 27.5 };
  private pose = newCrowdPose();
  private crowds: { people: CrowdLike; base: { x: number; z: number; ry: number; ph: number }[] }[] = [];
  private spots: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; ph: number }[] = [];
  private band: Person[] = [];
  /** La banda en el escenario (antes del concierto, el escenario vacío). */
  private showOn = false;
  private marker: THREE.Group;
  private lost = new Lost();
  private rhythm: Rhythm | null = null;
  private sky: Sky;
  private sun: Sun;
  private screenCtx: CanvasRenderingContext2D[] = [];
  private screenTex: THREE.CanvasTexture[] = [];
  private screenT = 0;
  private halftone: HTMLCanvasElement | null = null;
  private lasers: THREE.Group = new THREE.Group();
  /** Móviles en alto con la linterna (en la canción lenta y al final). */
  private phones!: THREE.Points;
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
    sc.fog = new THREE.Fog(0x161a40, 45, 230);
    // (las luces del capítulo llevan su intensidad final: applyLight las pone cada fotograma según el sitio)
    sc.userData.hemiScale = 1;
    // Cielo del estadio: sin luna (el 13-3-2026, dos días después del cuarto menguante, salía pasadas las dos)
    // y con pocas estrellas (las luces de Las Palmas)
    this.sky = new Sky({ top: 0x05041a, mid: 0x1a1446, bottom: 0x3a2050, stars: 450 });
    sc.add(this.sky.group);
    // Barajas es de día: el cielo de tebeo del capítulo 1, con sus nubes (se ve por la cristalera de la puerta 26)
    this.daySky = new Sky({ top: 0x2a6fd0, mid: 0x7fbdf2, bottom: 0xf6ead2, clouds: { count: 9, tint: 0xffffff } });
    this.daySky.group.visible = false;
    sc.add(this.daySky.group);
    this.hemi = new THREE.HemisphereLight(0x8f86d8, 0x2a2444, 0.4);
    sc.add(this.hemi);
    this.sun = new Sun(sc, 0xffe6cc, 1.8, NIGHT_SUN, 22);
    sc.add(this.nightOnly);

    this.buildWorld();
    this.fx = new Particles(sc);
    sc.add(this.fireworks.points);

    this.azul = makePerson(MARGAUX_LOOK);
    this.player = this.azul;
    this.walker = new Walker(this.player.root.position);
    this.player.root.position.set(0, 0, -18);
    sc.add(this.player.root);

    // Gas vuela por su cuenta. Lleva su camiseta de Fito, azul y roja
    this.gas = makePerson({ ...MARC_LOOK, shirt: 0x1f4fa8 });
    shirtPrint(this.gas, fitoPrint(), 0.3);
    markProps(this.gas);
    this.gas.root.position.set(AISLE_X + 1, 0, FLASH_SPOT.z + 0.4);
    sc.add(this.gas.root);
    // (sin el gesto de asentir de pie, como en el cap. 2)
    for (const p of [this.azul, this.gas]) if (p.rig) p.rig.noFidget = true;
    // El público y Azul (cuando no la llevas tú) no se pueden atravesar
    this.people = this.crowds.flatMap((c) => c.base.map((b) => ({ x: b.x, z: b.z, r: 0.35 })));
    this.azCircle = { x: 1e4, z: 1e4, r: 0.35 };
    this.people.push(this.azCircle);
    this.initCrowdPhysics();
    this.buildProps();
    this.buildQueue();
    this.buildFlash();

    this.barman = makePerson({ skin: 0xc98e64, shirt: 0x111111, pants: 0x111111, hair: 0x1a1a1a, hairStyle: 'short', male: true });
    this.barman.root.position.set(BAR_POS.x - 1.6, 0, BAR_POS.z);
    this.barman.root.rotation.y = Math.PI / 2;
    sc.add(this.barman.root);

    // Flecha de objetivo (la del cap. 2): solo si se ha perdido
    this.marker = new THREE.Group();
    const am = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    this.marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16).rotateX(Math.PI), am), new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 10).translate(0, 0.4, 0), am));
    this.marker.visible = false;
    sc.add(this.marker);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.walker.yaw = 0;
    this.walker.facing = 0;
    this.camera.position.set(0, 5, -27);
    audio.startMusic('road');
    this.busy = true;
    this.buildAirport();
    this.buildArrivals();
    this.startAirport();
    this.phase = 'intro';
    this.updateHud();
    // (la luz de Barajas ya desde el primer fotograma, antes de compilar)
    this.applyLight(1);
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(CONCERT.airport, () =>
        phoneChat([CHATS.somosLas, CHATS.burger], () => {
          this.busy = false;
          this.phase = 'airport';
          this.lost.reset();
          this.updateHud();
        }),
      );
    }, 500);
  }

  get threeScene() {
    return this.scene;
  }

  /** Barajas y las llegadas de Gran Canaria (lejos del estadio, en x > 100) van con luz de día; el estadio, de noche. */
  get mood(): 'day' | 'night' {
    return this.player.root.position.x > 100 ? 'day' : 'night';
  }

  /**
   * La luz de cada sitio, con su intensidad final (las lámparas no iluminan nada: solo el cielo y una luz principal).
   * Barajas y llegadas: interior claro. Estadio: la noche del cap. 2 con la luz de la torre de sonido. A oscuras
   * (la canción lenta), también la hemisférica del cómic baja (D1).
   */
  private applyLight(dt: number) {
    const day = this.mood === 'day';
    if (day !== this.wasDay) {
      this.wasDay = day;
      this.sky.group.visible = !day;
      this.daySky.group.visible = day;
      this.nightOnly.visible = !day;
      const f = this.scene.fog as THREE.Fog;
      f.color.setHex(day ? 0xcfe0ee : 0x161a40);
      f.near = day ? 70 : 45;
      f.far = day ? 180 : 230;
      this.sunOff.copy(day ? DAY_SUN : NIGHT_SUN).normalize().multiplyScalar(40);
      this.sun.light.color.setHex(day ? 0xfff2e0 : 0xffe6cc);
      this.hemi.color.setHex(day ? 0xf4f7ff : 0x8f86d8);
      this.hemi.groundColor.setHex(day ? 0xc9b9a2 : 0x2a2444);
    }
    this.darkK += ((this.dark && !day ? 1 : 0) - this.darkK) * Math.min(1, dt * 2.5);
    const k = this.darkK;
    this.hemi.intensity = day ? 0.6 : THREE.MathUtils.lerp(0.4, 0.15, k);
    // (topes del cómic: 2,1 de día y 2,5 de noche)
    this.sun.light.intensity = day ? 2.0 : THREE.MathUtils.lerp(1.8, 0.45, k);
    const ch = this.scene.userData.comicHemi as THREE.HemisphereLight | undefined;
    if (ch && !day) ch.intensity = LOOK_LIGHT.noche.hemi * THREE.MathUtils.lerp(1, 0.38, k);
    // El sol sigue a quien se lleva, ajustado a la rejilla del mapa de sombras (como Sun.follow)
    const p = this.player.root.position;
    const x = Math.round(p.x / 0.5) * 0.5;
    const z = Math.round(p.z / 0.5) * 0.5;
    this.sun.light.position.set(x + this.sunOff.x, this.sunOff.y, z + this.sunOff.z);
    this.sun.light.target.position.set(x, 0, z);
  }

  /** La pista a oscuras (canción lenta, o se apagan las luces antes de salir la banda). */
  private setDark(dark: boolean, now = false) {
    this.dark = dark;
    if (now) this.darkK = dark ? 1 : 0;
  }

  /** La banda en el escenario, con sus haces de luz, y su canción. */
  private setShow(on: boolean) {
    this.showOn = on;
    for (const b of this.band) b.root.visible = on;
    for (const s of this.spots) s.mesh.visible = on;
    if (on) audio.playTrack(FITO_SONG);
  }

  /** Alguien habla: gesticula un rato (y si no, nadie gesticula por nada). */
  private talk(p: Person, secs = 2) {
    this.talkers.set(p, secs);
  }

  /** Dónde habla quien no se resuelve por su nombre (la gente sin nombre del capítulo): de su cabeza. */
  speakerPoint(who: string) {
    const head = (p: Person) => headOf(p, 0.38);
    switch (who) {
      case 'Agente':
        return this.agent && this.player.root.position.x > 100 && this.player.root.position.x < 350 ? head(this.agent) : null;
      case 'Fito':
        return this.showOn ? head(this.band[0]) : null;
      case 'Uno que pasa':
        return this.beers?.lastBump?.root.parent ? head(this.beers.lastBump) : null;
      case 'Un señor de Telde': {
        // (el último de la cola de los baños)
        const n = this.queue[this.queue.length - 1];
        return n?.p.root.visible ? head(n.p) : null;
      }
      case 'Una de Telde': {
        // (alguien del público, al lado de Gas)
        const pp = this.player.root.position;
        let best: Circle | null = null;
        let bd = 6;
        for (let i = 0; i < this.cHome.length; i++) {
          const c = this.people[i];
          const d = Math.hypot(c.x - pp.x, c.z - pp.z);
          if (d < bd && d > 0.6) {
            bd = d;
            best = c;
          }
        }
        return best ? new THREE.Vector3(best.x, 2.15, best.z) : null;
      }
      case 'Una señora':
      case 'Un señor':
        // (desde la tienda de la que se ha escapado la maleta)
        return this.suitcaseFrom ? this.suitcaseFrom.clone() : null;
    }
    return null;
  }

  // ---------------- Aeropuerto ----------------

  /**
   * La puerta 26: cristalera con vistas a la pista y el avión esperando, finger conectado, puerta abierta
   * al túnel, pantalla de embarque, mostradores con su personal, torno de la tarjeta, cinta para la cola y
   * gente haciendo cola con la maleta.
   */
  private buildGate(m: Merger, cx: number) {
    const sc = this.scene;
    const Z = AIR.maxZ + 3.2;
    const X0 = AIR.minX - 0.3, X1 = AIR.maxX + 0.3;
    const DW = 1.1; // media anchura de la puerta
    // Dintel y faldón de la cristalera
    m.add(G.box, 0xd8dde3, cx, 6.1, Z, 0, 0, 0, X1 - X0, 3.4, 0.3);
    m.add(G.box, 0x4a525c, cx, 0.12, Z, 0, 0, 0, X1 - X0, 0.24, 0.3);
    // Montantes de la cristalera
    for (let x = X0; x <= X1 + 0.01; x += 1.5) if (Math.abs(x - cx) > DW + 0.1) m.add(G.box, 0x3f4750, x, 2.3, Z, 0, 0, 0, 0.09, 4.4, 0.16);
    m.add(G.box, 0x3f4750, cx, 3.0, Z, 0, 0, 0, X1 - X0, 0.08, 0.14);
    for (const s of [-1, 1]) m.add(G.box, 0x3f4750, cx + s * (DW + 0.05), 1.5, Z, 0, 0, 0, 0.14, 3, 0.2);
    const glass = toon({ color: 0xbfe2f4, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false });
    for (const [a, b] of [[X0, cx - DW], [cx + DW, X1]]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 4.4), glass);
      g.position.set((a + b) / 2, 2.3, Z + 0.02);
      g.rotation.y = Math.PI;
      g.userData.noCast = true;
      sc.add(g);
    }
    // La puerta abierta: se ve el túnel del finger, con luz al fondo (en tebeo: tonos planos con su tinta)
    const tunnel = comicTex((ctx, w, h) => {
      for (let i = 0; i < 6; i++) {
        const k = i / 6;
        const v = 120 + k * 120;
        ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
        ctx.fillRect(w * 0.42 * k, h * 0.42 * k, w * (1 - 0.84 * k), h * (1 - 0.84 * k));
        ctx.strokeStyle = 'rgba(20,16,24,.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(w * 0.42 * k, h * 0.42 * k, w * (1 - 0.84 * k), h * (1 - 0.84 * k));
      }
      ctx.fillStyle = '#fbfbff';
      ctx.fillRect(w * 0.42, h * 0.38, w * 0.16, h * 0.24);
      ctx.fillStyle = '#3a4250';
      ctx.fillRect(0, h * 0.86, w, h * 0.14);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    }, 256, 256);
    const hole = new THREE.Mesh(flatPlane(DW * 2, 3), new THREE.MeshBasicMaterial({ map: tunnel }));
    hole.position.set(cx, 1.5, Z + 0.1);
    hole.rotation.y = Math.PI;
    sc.add(hole);
    // Pantalla de embarque sobre la puerta (letreros de Aena: amarillo sobre oscuro)
    const screen = comicTex((ctx, w, h) => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b2433';
      ctx.fillRect(8, 8, w - 16, h - 16);
      ctx.textAlign = 'left';
      inkText(ctx, '26', 26, h * 0.32, 78, '#ffd23f');
      inkText(ctx, 'Gran Canaria · LPA', 150, h * 0.32, 52, PAPER, w - 170);
      inkText(ctx, 'EMBARCANDO', 26, h * 0.74, 46, '#4ade80');
      inkText(ctx, 'Filas 20 a 30', 410, h * 0.74, 38, '#b9c6d6');
    }, 720, 180);
    const scr = new THREE.Mesh(flatPlane(4.2, 1.05), new THREE.MeshBasicMaterial({ map: screen }));
    scr.position.set(cx, 3.72, Z - 0.21);
    scr.rotation.y = Math.PI;
    sc.add(scr);
    m.add(G.box, 0x1a1f28, cx, 3.72, Z - 0.13, 0, 0, 0, 4.36, 1.2, 0.08);
    // Mostradores de embarque a los dos lados de la puerta
    for (const s of [-1, 1]) {
      const x = cx + s * 3.4;
      m.add(G.rbox, 0x2b3a55, x, 0.55, AIR.maxZ + 0.2, 0, 0, 0, 2.4, 1.1, 0.75);
      m.add(G.box, 0xe9ecef, x, 1.12, AIR.maxZ + 0.2, 0, 0, 0, 2.5, 0.05, 0.85);
      m.add(G.box, 0x14181f, x - 0.5, 1.33, AIR.maxZ + 0.32, -0.25, 0, 0, 0.46, 0.32, 0.03); // monitor
      m.add(G.box, 0xd7263d, x, 0.62, AIR.maxZ - 0.18, 0, 0, 0, 2.3, 0.2, 0.02);
      this.colliders.push({ minX: x - 1.3, maxX: x + 1.3, minZ: AIR.maxZ - 0.2, maxZ: AIR.maxZ + 0.6, low: true });
      const staff = makePerson({ skin: s < 0 ? 0xe8b894 : 0xd9a27c, shirt: 0x1f2d4d, pants: 0x1f2d4d, hair: s < 0 ? 0x2b1d14 : 0x5a3a22, hairStyle: s < 0 ? 'short' : 'straight', male: s < 0 });
      // (la de la izquierda, junto al torno: es quien pide la tarjeta; mira a la cola)
      staff.root.position.set(s < 0 ? cx - 1.55 : x + 0.2, 0, AIR.maxZ + (s < 0 ? 1.05 : 1.0));
      staff.root.rotation.y = s < 0 ? Math.PI * 0.85 : Math.PI;
      sc.add(staff.root);
      if (s < 0) this.agent = staff;
    }
    // Torno de la tarjeta de embarque: dos cuerpos y sus aletas de cristal, que se recogen al pasar la tarjeta
    const flapMat = toon({ color: 0xbfe2f4, transparent: true, opacity: 0.6, roughness: 0.1 });
    for (const s of [-1, 1]) {
      m.add(G.rbox, 0x8f98a4, cx + s * 0.86, 0.5, AIR.maxZ + 1.6, 0, 0, 0, 0.26, 1, 0.9);
      m.add(G.box, 0x4ade80, cx + s * 0.86, 1.02, AIR.maxZ + 1.35, 0, 0, 0, 0.18, 0.02, 0.18);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.02).translate(-s * 0.35, 0, 0), flapMat);
      f.position.set(cx + s * 0.73, 0.62, AIR.maxZ + 1.6);
      f.userData.comicBent = true;
      f.userData.noCast = true;
      sc.add(f);
      this.flaps.push(f);
    }
    // Mamparas de cristal entre el torno y los mostradores: no se pasa sin tarjeta
    for (const s of [-1, 1]) {
      const a = cx + s * 0.99, b = cx + s * 2.1;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(b - a), 1.1), glass);
      g.position.set((a + b) / 2, 0.55, AIR.maxZ + 1.6);
      g.userData.noCast = true;
      sc.add(g);
      m.add(G.box, 0x8f98a4, (a + b) / 2, 1.1, AIR.maxZ + 1.6, 0, 0, 0, Math.abs(b - a), 0.04, 0.05);
    }
    // La cola: postes con cinta que hacen un pasillo en el centro, hasta el torno
    for (const s of [-1, 1])
      for (let k = 0; k < 4; k++) {
        const z = AIR.maxZ - 8 + k * 2.1;
        m.add(G.cyl, 0x8f98a4, cx + s * 1.45, 0.48, z, 0, 0, 0, 0.06, 0.96, 0.06);
        m.add(G.cyl, 0x8f98a4, cx + s * 1.45, 0.02, z, 0, 0, 0, 0.3, 0.04, 0.3);
        if (k < 3) m.add(G.box, 0xd7263d, cx + s * 1.45, 0.88, z + 1.05, 0, 0, 0, 0.02, 0.06, 2.1);
        this.colliders.push({ minX: cx + s * 1.45 - 0.08, maxX: cx + s * 1.45 + 0.08, minZ: z - 0.08, maxZ: z + 2.2 * (k < 3 ? 1 : 0) + 0.08, low: true });
      }
    // Los que esperan en la cola, cada uno con su maleta de cabina
    const Q: PersonLook[] = [
      { skin: 0xf0c8a6, shirt: 0x34495e, pants: 0x2a2a2a, hair: 0x6b4a2e, hairStyle: 'short', male: true },
      { skin: 0xd9a27c, shirt: 0xb4364c, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'straight' },
      { skin: 0xe2b08c, shirt: 0x7a8a5a, pants: 0x222222, hair: 0x3a2414, hairStyle: 'short', male: true },
    ];
    Q.forEach((lk, i) => {
      const p = makePerson(lk);
      const [x, z] = gateSlot(i);
      p.root.position.set(x, 0, z);
      p.body.add(new Merger().add(G.rbox, [0x222222, 0xd7263d, 0x1f5fbf][i], 0.42, 0.35, -0.22, 0, 0, 0, 0.34, 0.55, 0.24).mesh());
      markProps(p);
      sc.add(p.root);
      const circle = { x, z, r: 0.32 };
      this.gateQ.push({ p, walk: 0, state: 'line', t: 0, circle });
      this.gateCircles.push(circle);
    });
    // Filas de asientos de la zona de embarque
    for (const s of [-1, 1])
      for (let k = 0; k < 2; k++) {
        const x = cx + s * 4.7, z0 = AIR.maxZ - 10 + k * 3.2;
        m.add(G.box, 0x4a525c, x, 0.3, z0, 0, 0, 0, 0.5, 0.05, 2.4);
        for (let j = 0; j < 4; j++) {
          m.add(G.rbox, 0x2b3a55, x, 0.47, z0 - 0.9 + j * 0.6, 0, 0, 0, 0.5, 0.1, 0.5);
          m.add(G.rbox, 0x2b3a55, x + s * 0.22, 0.75, z0 - 0.9 + j * 0.6, 0, 0, 0, 0.08, 0.5, 0.5);
        }
        this.colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z0 - 1.25, maxZ: z0 + 1.25 });
      }
    // Fuera: la pista, el finger y el avión
    const av = new Merger();
    av.add(G.box, 0x7d8087, cx, -0.02, Z + 40, 0, 0, 0, 240, 0.1, 80);
    for (let i = -6; i < 7; i++) av.add(G.box, 0xf2d24a, cx + i * 8, 0.04, Z + 7, 0, 0, 0, 5, 0.01, 0.16);
    const AZ = Z + 13;
    av.add(G.capsule, 0xf6f7f8, cx + 3, 4, AZ, 0, 0, Math.PI / 2, 3.7, 15, 3.7);
    av.add(G.box, 0xd7263d, cx + 3, 3.3, AZ - 1.82, 0, 0, 0, 24, 0.22, 0.05);
    av.add(G.box, 0xf2c233, cx + 3, 3.05, AZ - 1.78, 0, 0, 0, 24, 0.12, 0.05);
    for (let i = 0; i < 26; i++) av.add(G.rbox, 0x1b2430, cx + 3 - 12 + i * 0.95, 4.42, AZ - 1.8, 0, 0, 0, 0.3, 0.42, 0.06);
    av.add(G.box, 0x9aa3ad, cx - 0.2, 3.9, AZ - 1.82, 0, 0, 0, 1.0, 2.0, 0.05); // la puerta del avión
    av.add(G.box, 0xdfe3e9, cx + 7, 2.9, AZ - 6, 0, 0.3, 0, 7, 0.28, 9); // ala
    av.add(G.cyl, 0xc9ced6, cx + 6, 1.7, AZ - 5.5, 0, 0, Math.PI / 2, 1.7, 3.4, 1.7); // motor
    av.add(G.cyl, 0x2a2e36, cx + 4.3, 1.7, AZ - 5.5, 0, 0, Math.PI / 2, 1.45, 0.1, 1.45);
    av.add(G.box, 0xd7263d, cx + 18.5, 8, AZ, 0, 0, -0.35, 4, 6, 0.3); // deriva
    av.add(G.box, 0xf2c233, cx + 19.8, 9.6, AZ, 0, 0, -0.35, 2.4, 1.2, 0.32);
    for (const dx of [-7, 6]) av.add(G.cyl, 0x22262c, cx + 3 + dx, 0.9, AZ, Math.PI / 2, 0, 0, 1.2, 1.5, 1.2); // ruedas
    // Finger: de la puerta 26 a la del avión, subiendo un poco
    av.add(G.box, 0xdfe3e9, cx, 2.35, Z + 5.4, -0.2, 0, 0, 2.7, 2.9, 11.6);
    av.add(G.box, 0x3a4250, cx, 2.5, Z + 5.4, -0.2, 0, 0, 2.74, 0.5, 8);
    av.add(G.cyl, 0x8f98a4, cx, 1.3, Z + 7.6, 0, 0, 0, 0.5, 2.6, 0.5);
    const avm = av.mesh();
    avm.userData.noCam = true;
    sc.add(avm);
  }

  /** Terminal de Barajas: pasillo largo, tiendas y la puerta del vuelo a Gran Canaria (el burger del «NUNCA más» fue el de Gas, en Barcelona). */
  private buildAirport() {
    const sc = this.scene;
    const A = AIR;
    const cx = (A.minX + A.maxX) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.maxX - A.minX + 2, A.maxZ - A.minZ + 6).rotateX(-Math.PI / 2), toon({ color: 0xe9ecef, roughness: 0.25, metalness: 0.05, surf: Surf.Paving }));
    floor.position.set(cx, 0.01, (A.minZ + A.maxZ) / 2);
    floor.userData.noCast = true;
    sc.add(floor);
    const m = new Merger();
    // Cristaleras a los dos lados, en tramos de 3 m: así se comban a mano alzada con la cubierta y no se abre una
    // rendija arriba (de una pieza de 66 m solo se movían las esquinas)
    for (const x of [A.minX - 0.15, A.maxX + 0.15]) {
      for (let z = A.minZ - 3; z < A.maxZ + 3; z += 3) {
        m.add(G.box, 0xb4d4ea, x, 3.9, z + 1.5, 0, 0, 0, 0.2, 7.8, 3.02);
        for (const y of [2.4, 4.6]) m.add(G.box, 0x5a6470, x, y, z + 1.5, 0, 0, 0, 0.26, 0.08, 3.02);
      }
      for (let z = A.minZ - 2; z <= A.maxZ + 2; z += 3) m.add(G.box, 0x5a6470, x, 3.9, z, 0, 0, 0, 0.3, 7.8, 0.15);
    }
    // Lamas finas de bambú, una al lado de la otra, por debajo de la cubierta (sin sombra: si no, rayaban el suelo)
    const ceil = new Merger();
    for (let z = A.minZ - 3; z <= A.maxZ + 3; z += 0.42) ceil.add(G.box, 0xd9b26a, cx, 6.62 + Math.sin(z * 0.3) * 0.35, z, 0, 0, 0, A.maxX - A.minX + 0.6, 0.06, 0.24);
    for (let x = A.minX + 2.6; x < A.maxX - 2; x += 3.2) for (let z = A.minZ - 2; z <= A.maxZ + 2; z += 4) ceil.add(G.box, 0xb8905a, x, 6.72 + Math.sin(z * 0.3) * 0.35, z, 0, 0, 0, 0.1, 0.1, 4.05);
    const cm = ceil.mesh();
    cm.userData.noCast = true;
    sc.add(cm);
    // La cubierta: una sola pieza ondulada que cierra toda la terminal, con lucernarios redondos, como en la T4
    {
      const W = A.maxX - A.minX + 1.4, D = A.maxZ - A.minZ + 7;
      const roof = new THREE.PlaneGeometry(W, D, 6, 90).rotateX(Math.PI / 2);
      const rp = roof.attributes.position;
      const z0 = (A.minZ + A.maxZ) / 2;
      for (let i = 0; i < rp.count; i++) rp.setY(i, 6.86 + Math.sin((rp.getZ(i) + z0) * 0.3) * 0.35);
      roof.computeVertexNormals();
      const rm = new THREE.Mesh(roof, toon({ color: 0xc9a468, roughness: 0.8, side: THREE.DoubleSide }));
      rm.position.set(cx, 0, z0);
      rm.userData.noCast = true;
      sc.add(rm);
      // (el disco de cielo y su aro, sin doblar los dos: si no, el aro se separaba del disco)
      const skyMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, fog: false, toneMapped: false });
      const ringMat = toon({ color: 0xf2f2ee, roughness: 0.5 });
      for (let z = A.minZ - 1; z <= A.maxZ + 1; z += 7.5)
        for (const x of [cx - 3, cx + 3]) {
          const y = 6.5 + Math.sin(z * 0.3) * 0.35;
          const sk = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20).rotateX(Math.PI / 2), skyMat);
          sk.position.set(x, y + 0.02, z);
          sk.userData.comicBent = true;
          sc.add(sk);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.05, 6, 22).rotateX(Math.PI / 2), ringMat);
          ring.position.set(x, y, z);
          ring.userData.comicBent = true;
          ring.userData.noCast = true;
          sc.add(ring);
        }
    }
    m.add(G.box, 0xd8dde3, cx, 3.9, A.minZ - 3.2, 0, 0, 0, A.maxX - A.minX + 0.6, 7.8, 0.3);
    this.colliders.push(
      { minX: A.minX - 0.4, maxX: A.minX - 0.02, minZ: A.minZ - 3.4, maxZ: A.maxZ + 3.4 },
      { minX: A.maxX + 0.02, maxX: A.maxX + 0.4, minZ: A.minZ - 3.4, maxZ: A.maxZ + 3.4 },
      { minX: A.minX - 0.4, maxX: A.maxX + 0.4, minZ: A.minZ - 3.4, maxZ: A.minZ - 3.04 },
    );
    // Muros del fondo como obstáculo para la cámara (si no, se sale de la terminal y no se ve nada)
    this.colliders.push({ minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.minZ - 7, maxZ: A.minZ - 3.1 }, { minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.maxZ + 3.1, maxZ: A.maxZ + 7 });
    this.buildGate(m, cx);
    // Barajas T4: pilares en «Y» de acero pintado que van del amarillo al rojo a lo largo de la terminal
    for (let z = A.minZ - 1, k = 0; z <= A.maxZ + 1; z += 7.5, k++) {
      const col = new THREE.Color(0xf2c231).lerp(new THREE.Color(0xd7263d), k / 8).getHex();
      setSurface(col, Surf.Metal);
      for (const x of [A.minX + 1.2, A.maxX - 1.2]) {
        m.add(G.cyl, col, x, 2.2, z, 0, 0, 0, 0.5, 4.4, 0.5);
        m.add(G.cyl, col, x - 0.6, 5.4, z, 0, 0, 0.45, 0.3, 2.6, 0.3);
        m.add(G.cyl, col, x + 0.6, 5.4, z, 0, 0, -0.45, 0.3, 2.6, 0.3);
        this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
      }
    }
    // Bancos de espera
    for (const z of [-27.25, -19.75, -12.25, 10.25, 25.25]) {
      for (const x of [A.minX + 0.6, A.maxX - 0.6]) {
        m.add(G.box, 0x4a5a6c, x, 0.45, z, 0, 0, 0, 0.6, 0.1, 3);
        m.add(G.box, 0x4a5a6c, x + (x < cx ? -0.25 : 0.25), 0.75, z, 0, 0, 0, 0.1, 0.6, 3);
        for (const dz of [-1.2, 1.2]) m.add(G.box, 0x9aa3ad, x, 0.2, z + dz, 0, 0, 0, 0.5, 0.4, 0.06);
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
    // La papelera de reciclaje, junto a un pilar
    m.add(G.cyl, 0x8f98a4, BIN_POS.x, 0.45, BIN_POS.z, 0, 0, 0, 0.5, 0.9, 0.5);
    m.add(G.cyl, 0x4a525c, BIN_POS.x, 0.92, BIN_POS.z, 0, 0, 0, 0.54, 0.06, 0.54);
    m.add(G.box, 0xf2d24a, BIN_POS.x + 0.25, 0.55, BIN_POS.z, 0, 0, 0, 0.02, 0.18, 0.2);
    this.colliders.push({ minX: BIN_POS.x - 0.27, maxX: BIN_POS.x + 0.27, minZ: BIN_POS.z - 0.27, maxZ: BIN_POS.z + 0.27, round: true });
    sc.add(m.mesh());
    const sign = (text: string, x: number, y: number, z: number, ry: number, w: number, bg: string, fg: string) => {
      const p = new THREE.Mesh(flatPlane(w, w / 4), new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg) }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
    };
    BURGERS.forEach(([x, z], i) => sign(['DUTY FREE', 'CAFÉ', 'PRENSA'][i % 3], x + (x > cx ? -0.78 : 0.78), 1.75, z, x > cx ? -Math.PI / 2 : Math.PI / 2, 3.6, '#1b2a4a', PAPER));
    sign('Salidas · Departures', cx, 4.6, A.minZ - 3.0, 0, 5, '#262b33', '#ffd23f');
    // (sin luces de punto en el techo: la luz es la del día que entra por la cubierta; las lámparas no iluminan)
    // Maletas de cabina que se escapan rodando de las tiendas por el pasillo
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
      o.userData.comicBent = true;
      sc.add(o);
      this.burgers.push({ o, v: new THREE.Vector3(), live: false, from: new THREE.Vector3() });
    }
    // Viajeros con prisa, de un lado a otro del pasillo (se dan la vuelta antes de la zona de embarque)
    for (let i = 0; i < 4; i++) {
      const p = makePerson({ ...LOOKS[i], shirt: [0x34495e, 0x8e44ad, 0x16a085, 0xc0392b][i] });
      p.body.add(new Merger().add(G.rbox, [0x222222, 0xd7263d, 0x1f5fbf, 0x777777][i], 0.45, 0.35, -0.2, 0, 0, 0, 0.35, 0.55, 0.25).mesh());
      markProps(p);
      p.root.position.set(A.minX + 2 + i * 2.6, 0, -22 + i * 11);
      sc.add(p.root);
      this.travelers.push({ p, dir: i % 2 ? 1 : -1, x: p.root.position.x, walk: 0, c: { x: 0, z: 0, r: 0.35 } });
    }
    this.allPeople.push(...this.travelers.map((t) => t.c));
  }

  /**
   * Llegadas del aeropuerto de Gran Canaria, esa noche: la salida de equipajes, la gente esperando, la pantalla de
   * llegadas, la cafetería «justo en la salida (dentro aún)» donde espera Gas, y las puertas a la calle, de noche.
   * Luz de interior: paneles planos en el techo (no iluminan: la luz es la de la sala).
   */
  private buildArrivals() {
    const sc = this.scene;
    const A = ARR;
    const cx = (A.minX + A.maxX) / 2;
    const H = 5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.maxX - A.minX, A.maxZ - A.minZ).rotateX(-Math.PI / 2), toon({ color: 0xdedbd3, roughness: 0.3, surf: Surf.Paving }));
    floor.position.set(cx, 0.01, (A.minZ + A.maxZ) / 2);
    floor.userData.noCast = true;
    sc.add(floor);
    const m = new Merger();
    const WALL = 0xeceef1;
    // Paredes en tramos de 3 m (se comban como las de Barajas); un hueco detrás (salida de equipajes) y otro delante
    // (la salida a la calle)
    for (const x of [A.minX - 0.12, A.maxX + 0.12]) for (let z = A.minZ; z < A.maxZ; z += 3) m.add(G.box, WALL, x, H / 2 + 0.15, z + 1.5, 0, 0, 0, 0.25, H + 0.3, 3.02);
    const wallZ = (z: number, gap0: number, gap1: number) => {
      for (let x = A.minX; x < A.maxX; x += 2) {
        const a = x, b = Math.min(A.maxX, x + 2);
        if (b <= gap0 || a >= gap1) m.add(G.box, WALL, (a + b) / 2, H / 2 + 0.15, z, 0, 0, 0, b - a + 0.02, H + 0.3, 0.25);
        else m.add(G.box, WALL, (a + b) / 2, H - 0.85, z, 0, 0, 0, b - a + 0.02, 2, 0.25); // dintel sobre el hueco
      }
    };
    wallZ(A.minZ - 0.12, cx - 4, cx);
    wallZ(A.maxZ + 0.12, cx - 2, cx + 2);
    // Techo (en piezas, para que se combe con las paredes) y paneles de luz planos colgados un poco por debajo
    for (let x = A.minX; x < A.maxX; x += 3.5) for (let z = A.minZ; z < A.maxZ; z += 3) m.add(G.box, 0xf2f1ef, x + 1.75, H + 0.05, z + 1.5, 0, 0, 0, 3.52, 0.1, 3.02);
    const panel = new THREE.MeshBasicMaterial({ color: 0xfff8e6 });
    for (let x = A.minX + 2; x < A.maxX - 1; x += 3.5)
      for (let z = A.minZ + 2; z < A.maxZ - 1; z += 4) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6).rotateX(Math.PI / 2), panel);
        p.position.set(x, H - 0.2, z);
        sc.add(p);
      }
    // Salida de equipajes: las puertas correderas de cristal, abiertas, y la sala de recogida detrás (con su cinta)
    for (const s of [-1, 1]) m.add(G.box, 0xbfe2f4, cx - 2 + s * 2.6, 1.4, A.minZ - 0.3, 0, 0, 0, 1.4, 2.8, 0.05);
    const hall = new THREE.Mesh(
      flatPlane(4, 3),
      new THREE.MeshBasicMaterial({
        map: comicTex((g, w, h) => {
          g.fillStyle = '#cfd8de';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#4a525c';
          g.fillRect(0, h * 0.68, w, h * 0.12);
          g.fillStyle = '#2b3a55';
          for (let i = 0; i < 4; i++) g.fillRect(w * (0.1 + i * 0.22), h * 0.56, w * 0.12, h * 0.12);
          g.strokeStyle = INK;
          g.lineWidth = 4;
          g.strokeRect(0, h * 0.68, w, h * 0.12);
          for (let i = 0; i < 4; i++) g.strokeRect(w * (0.1 + i * 0.22), h * 0.56, w * 0.12, h * 0.12);
        }, 256, 192),
      }),
    );
    hall.position.set(cx - 2, 1.5, A.minZ - 0.6);
    sc.add(hall);
    // La salida a la calle: puertas de cristal y, detrás, la noche (la parada de taxis y sus farolas, planas)
    for (const dx of [-2, -1, 0, 1, 2]) m.add(G.box, 0x5a6470, cx + dx, 1.5, A.maxZ + 0.1, 0, 0, 0, 0.08, 3, 0.1);
    m.add(G.box, 0x5a6470, cx, 3.02, A.maxZ + 0.1, 0, 0, 0, 4.1, 0.08, 0.1);
    const night = new THREE.Mesh(
      flatPlane(4, 3),
      new THREE.MeshBasicMaterial({
        map: comicTex((g, w, h) => {
          g.fillStyle = '#141a3a';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#2a2a33';
          g.fillRect(0, h * 0.72, w, h * 0.28);
          for (const x of [w * 0.18, w * 0.82]) {
            g.fillStyle = '#3a3a45';
            g.fillRect(x - 3, h * 0.28, 6, h * 0.44);
            g.fillStyle = '#ffe9a0';
            g.beginPath();
            g.arc(x, h * 0.26, 12, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = INK;
            g.lineWidth = 3;
            g.stroke();
          }
          g.fillStyle = '#ffd23f';
          g.fillRect(w * 0.4, h * 0.36, w * 0.2, h * 0.12);
          g.strokeStyle = INK;
          g.lineWidth = 3;
          g.strokeRect(w * 0.4, h * 0.36, w * 0.2, h * 0.12);
          g.textAlign = 'center';
          inkText(g, 'TAXI', w / 2, h * 0.42, 22, '#ffd23f');
        }, 256, 192),
      }),
    );
    night.position.set(cx, 1.5, A.maxZ + 0.2);
    night.rotation.y = Math.PI;
    sc.add(night);
    const sign = (text: string, x: number, y: number, z: number, ry: number, w: number, bg: string, fg: string) => {
      const p = new THREE.Mesh(flatPlane(w, w / 4), new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg) }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
    };
    sign('Llegadas · Arrivals', cx - 2, 3.7, A.minZ + 0.07, 0, 3.6, '#262b33', '#ffd23f');
    sign('Salida · Exit', cx, 3.6, A.maxZ - 0.07, Math.PI, 2.6, '#1f7a46', PAPER);
    sign('Cafetería', A.maxX - 0.07, 3.2, 3, -Math.PI / 2, 2.4, '#7a3b1a', PAPER);
    // Pantalla de llegadas (las horas, inventadas: Gas llegó antes, de Barcelona)
    const board = new THREE.Mesh(
      flatPlane(2.8, 1.4),
      new THREE.MeshBasicMaterial({
        map: comicTex((g, w, h) => {
          g.fillStyle = INK;
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#1b2433';
          g.fillRect(8, 8, w - 16, h - 16);
          g.textAlign = 'left';
          inkText(g, 'LLEGADAS · ARRIVALS', 24, 40, 34, '#ffd23f');
          inkText(g, 'Barcelona   20:35   En sala', 24, 110, 30, PAPER, w - 48);
          inkText(g, 'Madrid        21:15   En sala', 24, 160, 30, PAPER, w - 48);
          inkText(g, 'Tenerife N.  21:50   Aterrizado', 24, 210, 30, '#b9c6d6', w - 48);
        }, 512, 256),
      }),
    );
    board.position.set(A.minX + 0.07, 2.8, -3);
    board.rotation.y = Math.PI / 2;
    sc.add(board);
    // La cafetería: barra, cafetera, vitrina y mesas altas
    m.add(G.box, 0x7a5434, 405.6, 0.52, 3, 0, 0, 0, 0.8, 1.04, 6);
    m.add(G.box, 0xe9ecef, 405.55, 1.07, 3, 0, 0, 0, 0.95, 0.05, 6.1);
    m.add(G.box, 0x7a5434, 406.65, 0.45, 3, 0, 0, 0, 0.6, 0.9, 6);
    m.add(G.box, 0x22222a, 406.65, 1.2, 1.6, 0, 0, 0, 0.5, 0.55, 0.7); // cafetera
    m.add(G.box, 0xc0c4cc, 406.4, 1.05, 1.6, 0, 0, 0, 0.08, 0.06, 0.4);
    m.add(G.box, 0x9fd3e8, 405.6, 1.35, 4.6, 0, 0, 0, 0.7, 0.5, 1.6); // vitrina de bocadillos
    this.colliders.push({ minX: 405.15, maxX: 407, minZ: -0.05, maxZ: 6.05, low: true });
    for (const [x, z] of [[403.4, 2.4], [402.4, 4.6], [401.6, 1.6]] as const) {
      m.add(G.cyl, 0x22262c, x, 0.53, z, 0, 0, 0, 0.07, 1.05, 0.07);
      m.add(G.cyl, 0x22262c, x, 0.02, z, 0, 0, 0, 0.4, 0.04, 0.4);
      m.add(G.cyl, 0xe9ecef, x, 1.07, z, 0, 0, 0, 0.7, 0.04, 0.7);
      this.colliders.push({ minX: x - 0.36, maxX: x + 0.36, minZ: z - 0.36, maxZ: z + 0.36, round: true });
    }
    // Bancos y una columna de carteles
    for (const z of [-3, 4]) {
      m.add(G.box, 0x4a5a6c, A.minX + 0.6, 0.45, z, 0, 0, 0, 0.6, 0.1, 3);
      m.add(G.box, 0x4a5a6c, A.minX + 0.35, 0.75, z, 0, 0, 0, 0.1, 0.6, 3);
      this.colliders.push({ minX: A.minX, maxX: A.minX + 0.95, minZ: z - 1.5, maxZ: z + 1.5 });
    }
    // Paredes para andar y para la cámara
    this.colliders.push(
      { minX: A.minX - 0.6, maxX: A.minX - 0.01, minZ: A.minZ - 1, maxZ: A.maxZ + 1 },
      { minX: A.maxX + 0.01, maxX: A.maxX + 0.6, minZ: A.minZ - 1, maxZ: A.maxZ + 1 },
      { minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.minZ - 0.6, maxZ: A.minZ - 0.01 },
      { minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.maxZ + 0.01, maxZ: A.maxZ + 0.6 },
    );
    const mm = m.mesh();
    // (paredes y techo sin sombra: la luz de la sala llega a todo el suelo)
    mm.userData.noCast = true;
    sc.add(mm);
    // Gente esperando a los suyos, mirando a la salida de equipajes, y el camarero de la cafetería
    const W: [PersonLook, number, number][] = [
      [{ skin: 0xd9a27c, shirt: 0x3a6a5a, pants: 0x2a2a2a, hair: 0x1f1610, hairStyle: 'short', male: true }, 397.2, -7.4],
      [{ skin: 0xf0c8a6, shirt: 0xb4364c, pants: 0x3b4a6b, hair: 0x6b3f22, hairStyle: 'pony' }, 400.6, -7.9],
      [{ skin: 0xc98e64, shirt: 0xe9e2d0, pants: 0x222222, hair: 0x111111, hairStyle: 'bun' }, 395.4, -6.6],
    ];
    for (const [lk, x, z] of W) {
      const p = makePerson(lk);
      p.root.position.set(x, 0, z);
      p.root.rotation.y = Math.PI + (x - (cx - 2)) * 0.08;
      sc.add(p.root);
      this.arrCircles.push({ x, z, r: 0.35 });
    }
    const worker = makePerson({ skin: 0xe2b08c, shirt: 0x7a3b1a, pants: 0x222222, hair: 0x3a2414, hairStyle: 'straight' });
    worker.root.position.set(406.35, 0, 2.6);
    worker.root.rotation.y = -Math.PI / 2;
    sc.add(worker.root);
  }

  private startAirport() {
    this.phase = 'airport';
    this.gateT = GATE_SECS;
    this.gateStage = 0;
    this.resetGate();
    if (this.player !== this.azul) {
      this.player = this.azul;
      this.walker = new Walker(this.azul.root.position);
      this.azCircle.x = this.azCircle.z = 1e4;
    }
    this.gas.root.visible = false;
    this.azul.root.visible = true;
    for (const t of this.travelers) t.p.root.visible = true;
    this.player.root.position.set((AIR.minX + AIR.maxX) / 2, 0, AIR.minZ + 1);
    this.player.root.rotation.y = 0;
    this.walker.yaw = this.walker.facing = 0;
    this.walker.stop();
    this.camera.position.set((AIR.minX + AIR.maxX) / 2, 4, AIR.minZ - 4);
    this.updateHud();
  }

  /** La cola de embarque como al llegar: los tres esperando en su sitio, las aletas del torno cerradas. */
  private resetGate() {
    this.gateQ.forEach((g, k) => {
      const [x, z] = gateSlot(k);
      g.state = 'line';
      g.t = 0;
      g.vx = g.vz = 0;
      g.p.root.visible = true;
      g.p.root.position.set(x, 0, z);
      g.p.root.rotation.y = 0;
      g.circle.x = x;
      g.circle.z = z;
    });
    this.gateStep = 'none';
    this.gateNext = 0;
    this.flapOpen = 0;
  }

  private stepAirport(dt: number) {
    const pp = this.player.root.position;
    // La puerta se cierra. Si se acaba el tiempo, te llaman por megafonía y te esperan un poco: pero se nota
    const before = Math.ceil(this.gateT);
    this.gateT = Math.max(0, this.gateT - dt);
    if (Math.ceil(this.gateT) !== before) this.updateHud();
    if (this.gateStage === 0 && this.gateT < 10) {
      this.gateStage = 1;
      bark('Megafonía', CONCERT.gateLast);
      audio.warn();
      vibrate(40);
    } else if (this.gateStage === 1 && this.gateT <= 0) {
      this.gateStage = 2;
      this.gateT = 9;
      bark('Megafonía', CONCERT.gateClosing);
      audio.warn();
      vibrate([60, 40, 60]);
      this.walker.shake(0.25);
      // (a estas alturas, los de la cola ya han embarcado)
      for (const g of this.gateQ)
        if (g.state === 'line') {
          g.state = 'gone';
          g.p.root.visible = false;
          g.circle.x = g.circle.z = 1e4;
        }
    }
    // Viajeros: van y vuelven por el pasillo esquivando a Azul y entre ellos, sin girar en seco
    this.playerCircle.x = pp.x;
    this.playerCircle.z = pp.z;
    const others = [this.playerCircle, ...this.travelers.map((o) => o.c)];
    for (const t of this.travelers) {
      const r = t.p.root.position;
      t.tx ??= t.x;
      const tz = t.dir > 0 ? AIR.maxZ - 9 : AIR.minZ - 1;
      if (steerTo(t.p.root, t, t.tx, tz, 1.6, dt, others, 2.5, 0.32, t.c) < 0.4) t.dir *= -1;
      // Vuelve poco a poco a su carril tras esquivar
      r.x += (t.tx - r.x) * Math.min(1, dt * 0.6);
      animatePerson(t.p, dt, steerSpeed(t) > 0.1 ? 'walk' : 'idle');
      t.c.x = r.x;
      t.c.z = r.z;
    }
    // Cada poco, a alguien se le escapa una maleta rodando de una tienda y cruza el pasillo
    this.burgerT -= dt;
    if (this.burgerT <= 0) {
      this.burgerT = 0.6 + Math.random() * 0.6;
      const b = this.burgers.find((x) => !x.live);
      // Sale de la tienda más cercana a Azul (por delante de ella, para que dé tiempo a verla)
      const [bx, bz] = BURGERS.reduce((a, c) => (Math.abs(c[1] - pp.z - 3) < Math.abs(a[1] - pp.z - 3) ? c : a));
      if (b && Math.abs(bz - pp.z) < 12 && pp.z < AIR.maxZ - 6) {
        const side = bx > (AIR.minX + AIR.maxX) / 2 ? -1 : 1;
        b.live = true;
        b.o.visible = true;
        b.o.position.set(bx + side * 1.0, 0, bz + (Math.random() - 0.5) * 3);
        b.o.rotation.set(0, 0, 0);
        b.from.set(bx - side * 0.2, 1.7, bz);
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
      // A los viajeros no los atraviesa: les da en los pies y sale rebotada hacia donde venía
      for (const t of this.travelers) {
        const r = t.p.root.position;
        const dx = b.o.position.x - r.x;
        const dz = b.o.position.z - r.z;
        if (dx * dx + dz * dz < 0.55 * 0.55 && dx * b.v.x < 0) {
          b.v.x *= -0.5;
          b.v.z = (dz >= 0 ? 1 : -1) * (Math.abs(b.v.z) * 0.5 + 0.6);
          b.o.rotation.y = Math.atan2(b.v.x, b.v.z);
          const d = Math.hypot(r.x - pp.x, r.z - pp.z);
          if (d < 14) audio.knock(0.35 / (1 + d * 0.3), 260, 0.06);
        }
      }
      if (this.invuln <= 0 && Math.hypot(b.o.position.x - pp.x, b.o.position.z - pp.z) < 0.6 && b.o.position.y < 2) {
        this.invuln = 1.2;
        this.burgerHits++;
        this.gateT = Math.max(1, this.gateT - 2);
        this.walker.knock.set(Math.sign(b.v.x) * 6, 0, -2);
        this.walker.shake(0.3);
        audio.hit();
        vibrate(60);
        comicWord('¡PLAF!', 'hit');
        // Quien la ha perdido se disculpa desde la tienda (o Azul se queja)
        this.suitcaseFrom = b.from.clone();
        const say = CONCERT.suitcase[(this.burgerHits - 1) % CONCERT.suitcase.length];
        bark(say.who, say.text);
        this.fx.burst(pp.clone().setY(1.6), '🧳', 3, 1, 0.6);
        b.live = false;
        b.o.visible = false;
        this.updateHud();
      }
    }
    // A la cola de embarque: al llegar al final de la cola (o al pasillo de cintas), se pone en ella
    const tail = this.gateTail();
    if (Math.hypot(pp.x - tail[0], pp.z - tail[1]) < 1.4 || (Math.abs(pp.x - GATE_X) < 2.3 && pp.z > AIR.maxZ - 2.6)) this.startGateQueue();
  }

  /** El final de la cola de embarque (donde se pondría Azul ahora). */
  private gateTail(): [number, number] {
    return gateSlot(this.gateQ.filter((g) => g.state === 'line').length);
  }

  /** Azul se pone en la cola de embarque: el reloj de la puerta ya no corre (los de la cola embarcan todos). */
  private startGateQueue() {
    this.phase = 'gateQueue';
    this.gateStep = 'line';
    this.walker.stop();
    this.input.reset();
    this.hud.setAction(null);
    this.gateNext = 1.0;
    this.azSt.vx = this.azSt.vz = 0;
    for (const b of this.burgers) b.o.visible = b.live = false;
    if (this.gateStage === 2) {
      bark('Agente', CONCERT.gateRush);
      this.talk(this.agent);
    }
    this.updateHud();
  }

  /** La cola de embarque: cada uno enseña la tarjeta en el torno y entra al finger; luego le toca a Azul. */
  private stepGate(dt: number) {
    this.flapOpen = Math.max(0, this.flapOpen - dt);
    const k = THREE.MathUtils.smoothstep(this.flapOpen, 0, 0.3);
    for (const f of this.flaps) f.scale.x = 1 - 0.85 * k;
    if (this.player.root.position.x < 100 || this.player.root.position.x > 350) return;
    const line = this.gateQ.filter((g) => g.state === 'line');
    // (el torno está ocupado mientras alguien enseña la tarjeta o lo cruza; ya en la puerta, puede ir el siguiente)
    const using = this.gateQ.some((g) => g.state === 'scan' || (g.state === 'pass' && g.t === 0)) || this.gateStep === 'scan' || this.gateStep === 'ask' || this.gateStep === 'pass';
    if (this.phase === 'gateQueue' || this.phase === 'airport') this.gateNext -= dt;
    // El primero de la cola pasa al torno (de uno en uno)
    if (this.phase === 'gateQueue' && !using && line.length && this.gateNext <= 0) {
      line[0].state = 'scan';
      line[0].t = 0;
      this.gateNext = 1.4;
    }
    for (const g of this.gateQ) {
      if (g.state === 'gone') continue;
      if (g.state === 'line') {
        const [x, z] = gateSlot(line.indexOf(g));
        this.stepTo(g.p, g, x, z, 1.2, dt, 0);
      } else if (g.state === 'scan') {
        if (this.stepTo(g.p, g, GATE_SCAN.x, GATE_SCAN.z, 1.2, dt, 0)) {
          const t0 = g.t;
          g.t += dt;
          if (t0 < 0.3 && g.t >= 0.3) {
            audio.pop();
            this.flapOpen = 1.8;
          }
          if (g.t > 1.0) {
            g.state = 'pass';
            g.t = 0;
          }
        }
      } else if (g.state === 'pass') {
        // Por el torno, a la puerta y al finger (el túnel lo tapa)
        if (this.stepTo(g.p, g, GATE_X, g.t === 0 ? AIR.maxZ + 2.9 : AIR.maxZ + 4.6, 1.3, dt)) {
          if (g.t === 0) g.t = 1;
          else {
            g.state = 'gone';
            g.p.root.visible = false;
          }
        }
      }
      g.circle.x = g.state === 'gone' ? 1e4 : g.p.root.position.x;
      g.circle.z = g.state === 'gone' ? 1e4 : g.p.root.position.z;
    }
    if (this.phase !== 'gateQueue') return;
    // Azul avanza por la cola; cuando le toca, al torno, enseña la tarjeta y pasa
    const az = this.azul;
    if (this.gateStep === 'line') {
      if (!using && !line.length) this.gateStep = 'scan';
      else {
        const [x, z] = gateSlot(line.length);
        this.stepTo(az, this.azSt, x, z, 1.3, dt, 0);
      }
    }
    if (this.gateStep === 'scan') {
      if (this.stepTo(az, this.azSt, GATE_SCAN.x, GATE_SCAN.z, 1.3, dt, 0)) {
        this.gateStep = 'ask';
        bark('Agente', CONCERT.gateAsk);
        this.talk(this.agent);
        this.updateHud();
      }
    } else if (this.gateStep === 'ask') {
      animatePerson(az, dt, 'idle');
      faceTo(az.root, 0, dt);
    } else if (this.gateStep === 'pass') {
      if (this.stepTo(az, this.azSt, GATE_X, AIR.maxZ + 2.9, 1.4, dt)) this.board();
    }
  }

  /** La tarjeta y el DNI en el torno: pita, se recogen las aletas y a la puerta. */
  private showCard() {
    if (this.gateStep !== 'ask') return;
    audio.pop();
    comicWord('¡BIP!', 'luck');
    vibrate(20);
    this.flapOpen = 3;
    bark('Agente', CONCERT.gateThanks);
    this.talk(this.agent);
    this.gateStep = 'pass';
    this.hud.setAction(null);
    this.updateHud();
  }

  /** Por la puerta 26 al finger: fundido y, esa noche, las llegadas de Gran Canaria. */
  private board() {
    if (this.busy) return;
    this.gateStep = 'none';
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    audio.whoosh();
    if (this.gateStage === 2) bark('Azul', CONCERT.gateLate);
    for (const b of this.burgers) b.o.visible = b.live = false;
    fadeFlash(() => {
      this.phase = 'intro';
      for (const t of this.travelers) {
        t.p.root.visible = false;
        t.c.x = t.c.z = 1e4;
      }
      this.toArrivals();
      this.updateHud();
    }, 700);
    later(
      () =>
        dialogue(CONCERT.landed, () =>
          phoneChat(CHATS.vasTarde, () => {
            this.busy = false;
            this.phase = 'arrivals';
            this.lost.reset();
            this.updateHud();
          }),
        ),
      1500,
    );
  }

  /** Llegadas de Gran Canaria: Azul sale de recoger el equipaje y Gas la espera en la cafetería, mirándola. */
  private toArrivals() {
    if (this.player !== this.azul) {
      this.player = this.azul;
      this.walker = new Walker(this.azul.root.position);
    }
    this.auto = null;
    this.azul.root.visible = true;
    this.azul.root.position.copy(ARR_START);
    this.azul.root.rotation.y = 0;
    this.azCircle.x = this.azCircle.z = 1e4;
    this.walker.yaw = this.walker.facing = 0;
    this.walker.stop();
    this.gas.root.visible = true;
    this.gas.root.position.copy(CAFE_GAS);
    this.gas.root.rotation.y = Math.atan2(ARR_START.x - CAFE_GAS.x, ARR_START.z - CAFE_GAS.z);
    this.camera.position.set(ARR_START.x, 3.4, ARR_START.z - 0.2);
    this.camera.lookAt(CAFE_GAS);
  }

  private stepArrivals(dt: number) {
    const pp = this.azul.root.position;
    const gp = this.gas.root.position;
    animatePerson(this.gas, dt, 'idle');
    faceTo(this.gas.root, Math.atan2(pp.x - gp.x, pp.z - gp.z), dt, 3);
    if (!this.busy && Math.hypot(pp.x - gp.x, pp.z - gp.z) < 1.6) this.meetGas();
  }

  /** Se encuentran en la cafetería: abrazo, lo de «vas tarde» y, al día siguiente, el concierto. */
  private meetGas() {
    this.phase = 'intro';
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    const pp = this.azul.root.position;
    const gp = this.gas.root.position;
    this.walker.facing = Math.atan2(gp.x - pp.x, gp.z - pp.z);
    this.azul.root.rotation.y = this.walker.facing;
    this.gas.root.rotation.y = Math.atan2(pp.x - gp.x, pp.z - gp.z);
    hugFor(this.azul, this.gas, 2.4);
    audio.luck();
    this.fx.burst(pp.clone().lerp(gp, 0.5).setY(2.2), '❤️', 3, 0.8, 0.6);
    this.updateHud();
    later(
      () =>
        dialogue(CONCERT.arrivalsMeet, () => {
          fadeFlash(() => {
            this.toStadium();
            this.updateHud();
          }, 600);
          later(() => dialogue(CONCERT.stadium, () => this.startBeers()), 1300);
        }),
      1400,
    );
  }

  /** Antes de que salga la banda, la ronda: tres cervezas por el pasillo, entre la gente. */
  private startBeers() {
    this.beers?.dispose();
    this.phase = 'beers';
    this.busy = true;
    // Para ella, que espera en su sitio del pasillo; la gente cruza entre ella y la barra
    this.beers = new BeerRun(this.scene, this.gas, this.walker, this.fx, AZUL_SPOTS[0].clone(), AISLE_X, [-5.2, -1.6, 1.8], () => this.updateHud());
    this.updateHud();
    dialogue(SIDE.beers.intro, () => {
      this.busy = false;
      this.lost.reset();
      this.updateHud();
    });
  }

  private deliverBeers() {
    const b = this.beers!;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    if (b.cupsLeft < BEERS_NEED) {
      dialogue(SIDE.beers.few, () => {
        b.reset();
        this.busy = false;
        this.updateHud();
      });
      return;
    }
    const left = b.cupsLeft;
    b.finish();
    audio.cheer(0.5);
    dialogue(SIDE.beers.done(left), () => this.startShow());
  }

  /**
   * Empieza el concierto: se apagan las luces de la pista, grita todo el mundo y sale la banda. Fito saluda y, justo
   * entonces, a Gas le entran ganas de ir al baño.
   */
  private startShow() {
    this.phase = 'show';
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.setDark(true);
    audio.ambience(0.35);
    this.updateHud();
    const stage = new THREE.Vector3(0, 3.2, 33);
    const gp = () => headOf(this.gas);
    cinema.play(
      [
        { dur: 1.8, pos: () => rel(gp(), stage, 2.4, 0.6, 0.5), look: stage, fov: 50 },
        {
          dur: 3,
          pos: () => rel(gp(), stage, 2.4, 0.6, 0.5),
          pos2: () => rel(gp(), stage, 1.4, 0.4, 0.3),
          look: () => headOf(this.band[0]),
          fov: 30,
          at: () => {
            this.setShow(true);
            this.setDark(false);
            audio.cheer(0.8);
            comicWord('¡FITOOO!', 'cheer');
            later(() => {
              bark('Fito', CONCERT.showHello);
              this.talk(this.band[0], 1.5);
            }, 600);
          },
        },
      ],
      () =>
        dialogue(CONCERT.showWc, () => {
          this.busy = false;
          this.phase = 'toWc';
          this.lost.reset();
          this.updateHud();
        }),
    );
  }

  /** En el estadio se juega con Gas; Azul se queda en su sitio del pasillo. */
  private toStadium() {
    this.player = this.gas;
    this.walker = new Walker(this.gas.root.position);
    this.auto = null;
    this.gas.root.visible = true;
    this.gas.root.position.set(AISLE_X + 1, 0, FLASH_SPOT.z + 0.4);
    this.walker.yaw = this.walker.facing = Math.PI * 0.75;
    this.gas.root.rotation.y = this.walker.facing;
    this.walker.stop();
    this.placeAzul(AZUL_SPOTS[0]);
    for (const g of this.gateQ) g.p.root.visible = false;
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
    // Césped del anexo tapado con planchas protectoras de plástico gris (de un metro, como las de verdad) para el
    // concierto: en tebeo, planchas planas con la junta de tinta y alguna pisada
    const tex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#2a2d2c';
      ctx.fillRect(0, 0, w, h);
      const n = 4, cw = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 74 + ((i * 5 + j * 3) % 3) * 6;
          ctx.fillStyle = `rgb(${v},${v + 3},${v + 2})`;
          ctx.fillRect(i * cw + 3, j * cw + 3, cw - 6, cw - 6);
          // rejilla de la plancha, en trazo fino
          ctx.fillStyle = 'rgba(30,34,32,0.45)';
          for (let k = 10; k < cw - 6; k += 12) {
            ctx.fillRect(i * cw + k, j * cw + 6, 2, cw - 12);
            ctx.fillRect(i * cw + 6, j * cw + k, cw - 12, 2);
          }
        }
      // Pisadas: manchas planas
      ctx.fillStyle = 'rgba(40,36,30,0.35)';
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 8, 3 + Math.random() * 3, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 256, 256);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(125, 125);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), toon({ map: tex }));
    ground.userData.noCast = true;
    sc.add(ground);

    // (sin luna: esa noche no había; ver el cielo en el constructor)

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
        st.add(G.box, j % 5 === 0 ? 0xf2c232 : 0x1f6fb2, 50 + k * 0.9, 0.9 + k * 0.9, -18.5 + j * 1.28, 0, 0, 0, 0.5, 0.25, 0.9);
      for (const z of [-19, -6, 6, 19]) st.add(G.box, 0xe8e8e8, 57.5, 5, z, 0, 0, 0, 0.3, 10, 0.3);
      st.add(G.box, 0xeeeeee, 53.5, 10, 0, 0, 0, -0.12, 9, 0.3, 41);
      this.colliders.push({ minX: 49.5, maxX: 58, minZ: -20, maxZ: 20 });
      sc.add(st.mesh());
      // El estadio: gradas en anillo y la visera blanca (lejos; de día, desde Barajas, no está)
      const big = new Merger();
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const x = -150 + Math.cos(a) * 60, z = Math.sin(a) * 45;
        big.add(G.box, 0x6a7380, x, 10, z, 0, -a, 0, 6, 20, 10);
        big.add(G.box, 0xf2f2f2, -150 + Math.cos(a) * 54, 23, Math.sin(a) * 40, 0.3, -a, 0, 8, 0.6, 16);
      }
      this.nightOnly.add(big.mesh());
      // Las luces de los barrios en las laderas de Las Palmas: bombillas de tebeo pequeñas (sin escribir
      // profundidad: si no, la tinta rodeaba cada una de negro)
      const lights: number[] = [];
      for (let i = 0; i < 700; i++) {
        const a = Math.random() * Math.PI * 2, r = 140 + Math.random() * 120;
        lights.push(Math.cos(a) * r, 2 + Math.random() * 30 * (r / 260), Math.sin(a) * r);
      }
      const lm = new THREE.PointsMaterial({ map: comicBulbTexture(), color: 0xffc070, size: 1.7, sizeAttenuation: true, fog: false, transparent: true, alphaTest: 0.5, depthWrite: false });
      lm.userData.comicGlow = true;
      this.nightOnly.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lights, 3)), lm));
    }

    // Los montes de detrás de Las Palmas, de noche (el Teide, en Tenerife, de noche no se ve desde aquí)
    const hills = new Merger();
    hills.add(new THREE.ConeGeometry(1, 1, 7), 0x2a2238, 70, 0, 230, 0, 0, 0, 120, 55, 120);
    hills.add(new THREE.ConeGeometry(1, 1, 6), 0x231d30, -60, 0, 210, 0, 0, 0, 90, 30, 70);
    this.nightOnly.add(hills.mesh());

    const m = new Merger();
    // Escenario
    m.add(G.box, 0x1b1b22, 0, 0.8, 34, 0, 0, 0, 26, 1.6, 9);
    m.add(G.box, 0x111116, 0, 6, 38.6, 0, 0, 0, 26, 10, 0.3); // telón
    for (const x of [-13, 13]) {
      m.add(G.box, 0x9a9aa6, x, 5.5, 30, 0, 0, 0, 0.4, 11, 0.4);
      m.add(G.box, 0x9a9aa6, x, 5.5, 38, 0, 0, 0, 0.4, 11, 0.4);
      m.add(G.box, 0x22222a, x * 1.12, 2.6, 31, 0, 0, 0, 2.4, 5.2, 2); // altavoces
      m.add(G.box, 0x3a3a45, x * 1.12, 3.4, 29.99, 0, 0, 0, 1.4, 1.4, 0.02);
      m.add(G.box, 0x3a3a45, x * 1.12, 1.6, 29.99, 0, 0, 0, 1.4, 1.4, 0.02);
    }
    m.add(G.box, 0x9a9aa6, 0, 11, 30, 0, 0, 0, 26.4, 0.4, 0.4);
    m.add(G.box, 0x9a9aa6, 0, 11, 38, 0, 0, 0, 26.4, 0.4, 0.4);
    // Batería, al alcance de quien la toca (sentado en su taburete, detrás del bombo)
    m.add(G.cyl, 0xd7263d, 0, 2.2, 36.3, Math.PI / 2, 0, 0, 1.2, 0.8, 1.2); // bombo
    m.add(G.cyl, 0xcccccd, -0.4, 2.3, 36.7, 0, 0, 0, 0.62, 0.16, 0.62); // caja
    m.add(G.cyl, 0x9a9aa6, -0.4, 1.95, 36.7, 0, 0, 0, 0.04, 0.7, 0.04);
    m.add(G.cyl, 0xe8c66a, -0.75, 2.62, 36.85, 0, 0, 0, 0.7, 0.03, 0.7); // charles
    m.add(G.cyl, 0x9a9aa6, -0.75, 2.1, 36.85, 0, 0, 0, 0.04, 1.0, 0.04);
    m.add(G.cyl, 0xd7263d, 0.25, 2.92, 36.25, 0.3, 0, 0, 0.44, 0.24, 0.44); // tom
    m.add(G.cyl, 0xd7263d, 0.62, 2.0, 37.0, 0, 0, 0, 0.6, 0.5, 0.6); // base
    m.add(G.cyl, 0xe8c66a, 0.68, 2.95, 36.4, 0.25, 0, 0, 0.9, 0.03, 0.9); // crash
    m.add(G.cyl, 0x9a9aa6, 0.68, 2.25, 36.45, 0, 0, 0, 0.04, 1.3, 0.04);
    // El taburete del batería
    m.add(G.cyl, 0x9a9aa6, 0, 1.87, 37.25, 0, 0, 0, 0.06, 0.5, 0.06);
    m.add(G.cyl, 0x22222a, 0, 2.12, 37.25, 0, 0, 0, 0.36, 0.06, 0.36);
    // Valla delante del escenario
    m.add(G.box, 0x777780, 0, 0.6, 28.6, 0, 0, 0, 30, 1.2, 0.2);
    this.colliders.push({ minX: -15, maxX: 15, minZ: 28.4, maxZ: 40 });
    // Valla del recinto: el campo se acaba aquí (antes, una pared invisible)
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      for (const y of [0.35, 1.05]) m.add(G.box, 0x9a9a9a, cx, y, cz, 0, 0, 0, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len);
      for (let k = 0; k <= Math.round(len / 2.2); k++) {
        const u = k / Math.max(1, Math.round(len / 2.2));
        m.add(G.box, 0x9a9a9a, x0 + (x1 - x0) * u, 0.55, z0 + (z1 - z0) * u, 0, 0, 0, 0.06, 1.1, 0.06);
      }
    };
    rail(-22.45, -22.45, 22.45, -22.45);
    rail(-22.45, -22.45, -22.45, 27.95);
    rail(22.45, -22.45, 22.45, 27.95);
    rail(-22.45, 27.95, -15, 27.95);
    rail(15, 27.95, 22.45, 27.95);

    // La mesa de sonido (FOH): tarima, mesas de mezclas, toldo negro y su valla, con dos técnicos mirando al escenario
    {
      const { x, z } = FOH;
      m.add(G.box, 0x3a3a45, x, 0.18, z, 0, 0, 0, 4.2, 0.36, 3.2);
      for (const dx of [-0.95, 0.95]) {
        m.add(G.box, 0x22222a, x + dx, 0.8, z + 0.7, 0, 0, 0, 1.6, 0.85, 0.7);
        m.add(G.box, 0x1b1b23, x + dx, 1.25, z + 0.62, -0.35, 0, 0, 1.6, 0.05, 0.75);
      }
      for (const [dx, dz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]] as const) m.add(G.cyl, 0x9a9aa6, x + dx, 1.9, z + dz, 0, 0, 0, 0.08, 3.4, 0.08);
      m.add(G.box, 0x1e1e22, x, 3.62, z, 0, 0, 0, 4.6, 0.14, 3.6);
      const fx0 = x - 2.7, fx1 = x + 2.7, fz0 = z - 2.2, fz1 = z + 2.2;
      for (const [a, b, c, d] of [[fx0, fz0, fx1, fz0], [fx0, fz1, fx1, fz1], [fx0, fz0, fx0, fz1], [fx1, fz0, fx1, fz1]] as const) {
        m.add(G.box, 0x777780, (a + c) / 2, 1.0, (b + d) / 2, 0, 0, 0, Math.max(0.05, Math.abs(c - a)), 0.05, Math.max(0.05, Math.abs(d - b)));
        m.add(G.box, 0x777780, (a + c) / 2, 0.5, (b + d) / 2, 0, 0, 0, Math.max(0.05, Math.abs(c - a)), 0.05, Math.max(0.05, Math.abs(d - b)));
      }
      this.colliders.push({ minX: fx0 - 0.05, maxX: fx1 + 0.05, minZ: fz0 - 0.05, maxZ: fz1 + 0.05 });
      // Las pantallitas de las mesas (encendidas, planas)
      const scr = new THREE.MeshBasicMaterial({ color: 0x7fd0ff });
      for (const dx of [-0.95, 0.95]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), scr);
        p.position.set(x + dx, 1.55, z + 0.3);
        p.rotation.y = Math.PI;
        sc.add(p);
        m.add(G.box, 0x1b1b23, x + dx, 1.42, z + 0.32, 0, 0, 0, 0.56, 0.36, 0.04);
      }
      for (const dx of [-0.9, 0.9]) {
        const t = makePerson({ skin: dx < 0 ? 0xe8b894 : 0xb98060, shirt: 0x111111, pants: 0x2a2a2a, hair: dx < 0 ? 0x6b4a2e : 0x1a1a1a, hairStyle: 'short', male: true });
        t.root.position.set(x + dx, 0.36, z - 0.3);
        sc.add(t.root);
      }
    }

    // Barra
    m.add(G.box, 0x8a5a37, BAR_POS.x, 0.6, BAR_POS.z, 0, 0, 0, 1, 1.2, 8);
    m.add(G.box, 0xd8c7a5, BAR_POS.x, 1.23, BAR_POS.z, 0, 0, 0, 1.3, 0.06, 8.2);
    m.add(G.box, 0x3a2a20, BAR_POS.x - 2.6, 1.6, BAR_POS.z, 0, 0, 0, 0.4, 3.2, 8);
    for (let i = 0; i < 8; i++) m.add(G.cyl, i % 2 ? 0xf4c95e : 0x2f7d4b, BAR_POS.x - 2.2, 1.5 + (i % 2) * 0.8, BAR_POS.z - 3 + i * 0.8, 0, 0, 0, 0.15, 0.5, 0.15);
    // Laterales de la barra: detrás solo está el camarero (y la pared de botellas ya no se atraviesa)
    for (const s of [-1, 1]) m.add(G.box, 0x6b4a31, BAR_POS.x - 1.15, 0.6, BAR_POS.z + s * 4, 0, 0, 0, 2.5, 1.2, 0.12);
    this.colliders.push({ minX: BAR_POS.x - 2.85, maxX: BAR_POS.x + 0.5, minZ: BAR_POS.z - 4.06, maxZ: BAR_POS.z + 4.06, low: true });

    // Palmeras
    const palm = (x: number, z: number, h: number) => {
      for (let i = 0; i < 6; i++) m.add(G.cyl, 0x6b5a40, x + Math.sin(i * 0.3) * 0.4, (i + 0.5) * (h / 6), z, 0, 0, 0.05, 0.5 - i * 0.03, h / 6, 0.5 - i * 0.03);
      palmCrown(m, x + Math.sin(1.5) * 0.4, h, z, 3.1, 15);
      this.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
    };
    for (const [x, z, h] of [[-21, -16, 8], [21, -4, 9], [-21, 6, 9], [21, 8, 7.5], [-20, 22, 8.5], [20, 22, 9], [-28, 30, 10], [28, 30, 10]]) palm(x, z, h);
    this.buildToilets(m);
    sc.add(m.mesh());

    // Pantallas del escenario: en tebeo (colores planos, trama y letra de tebeo), con Fito en directo
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
      const p = new Merger().add(G.box, 0x22222a, x, 2.4, 30.2, 0, 0, 0, 0.3, 4.8, 0.3).mesh();
      sc.add(p);
    }
    // Y la grande del fondo, encima del telón (sin ella, el telón negro de 26 m parecía un agujero en el dibujo)
    {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 256;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.screenCtx.push(c.getContext('2d')!);
      this.screenTex.push(tex);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(15, 7.5), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      s.position.set(0, 6.6, 38.42);
      s.rotation.y = Math.PI;
      sc.add(s);
    }
    this.drawScreens(0, 0);

    // Láseres que barren el cielo durante el concierto: rayos de color opacos y finos, con su tinta
    const laserGeo = new THREE.BoxGeometry(0.07, 0.07, 60).translate(0, 0, -30);
    const laserColors = [0x3cc6b0, 0xe2547a, 0xf4d35e, 0x7a5cff];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: laserColors[i % 4], fog: false }));
      l.position.set(-12 + (i % 4) * 8, 11, 31);
      l.userData.ph = i * 0.8;
      l.userData.comicBent = true;
      l.userData.noCast = true;
      this.lasers.add(l);
    }
    this.lasers.visible = false;
    sc.add(this.lasers);

    // Haces de los focos: conos planos de tebeo que barren el escenario y el público (no iluminan nada)
    const spotGeo = new THREE.ConeGeometry(2.4, 14, 16, 1, true).translate(0, -7, 0);
    [-10, -5, 0, 5, 10].forEach((x, i) => {
      const mat = beamMaterial();
      const mesh = new THREE.Mesh(spotGeo, mat);
      mesh.position.set(x, 10.8, 30.4);
      mesh.userData.comicBent = true;
      mesh.visible = false;
      sc.add(mesh);
      this.spots.push({ mesh, mat, ph: i * 1.3 });
    });

    // Banda: Fito, delante, de negro, con sombrero y su guitarra (ver entities/fito.ts)
    this.fito = new Fito(sc, 0, 1.6, 32.5);
    // (su foco y sus luces de relleno, apagados: en el tebeo las lámparas no iluminan; le da la luz de la torre de sonido)
    this.fito.spot.visible = false;
    const guitarist = this.fito.person;
    markProps(guitarist);
    // El bajista, con su bajo colgado como la guitarra de Fito y las dos manos en él
    const bassist = makePerson({ skin: 0xd9a27c, shirt: 0x3a3a44, pants: 0x111111, hair: 0x5a3a22, hairStyle: 'long' });
    bassist.root.position.set(-6, 1.6, 33);
    bassist.root.rotation.y = Math.PI;
    const bass = new THREE.Group();
    bass.add(
      new Merger(false)
        .add(G.rbox, 0x1f5fbf, 0, 0, 0, 0, 0, 0, 0.32, 0.44, 0.05)
        .add(G.box, 0xefe6cf, 0.04, -0.02, 0.03, 0, 0, 0, 0.16, 0.2, 0.01)
        .add(G.box, 0x6b3a1e, 0, 0.6, 0, 0, 0, 0, 0.05, 0.8, 0.03)
        .add(G.box, 0x111111, 0, 1.04, 0, 0, 0, 0, 0.09, 0.16, 0.02)
        .mesh(),
    );
    const sax = makePerson({ skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x111111, hair: 0x222222, hairStyle: 'short', male: true });
    sax.root.position.set(6, 1.6, 33);
    sax.root.rotation.y = Math.PI;
    // El saxo (dorado): el tubo, la campana que sube y el cuello con la boquilla hacia la boca
    const saxo = new THREE.Group();
    saxo.add(
      new Merger(false)
        .add(G.cyl, 0xd8b25a, 0, 0.05, 0, 0, 0, 0, 0.08, 0.55, 0.08)
        .add(G.cyl, 0xd8b25a, 0.06, -0.25, 0, 0, 0, 0.9, 0.08, 0.14, 0.08)
        .add(new THREE.CylinderGeometry(0.09, 0.05, 0.18, 14, 1, true), 0xd8b25a, 0.13, -0.14, 0, 0, 0, 0, 1, 1, 1)
        .add(G.cyl, 0xd8b25a, -0.03, 0.36, 0.04, 0.7, 0, 0, 0.025, 0.16, 0.025)
        .add(G.cyl, 0x111111, -0.03, 0.43, 0.11, 1.1, 0, 0, 0.02, 0.06, 0.02)
        .mesh(),
    );
    const drummer = makePerson({ skin: 0xe8b894, shirt: 0xffffff, pants: 0x111111, hair: 0x888888, hairStyle: 'short', male: true });
    // Sentado en su taburete (el asiento, a 55 cm de la tarima), detrás del bombo
    drummer.root.position.set(0, 1.6 + seatedRootY(drummer, 0.55), 37.25);
    drummer.root.rotation.y = Math.PI;
    this.band = [guitarist, bassist, sax, drummer];
    this.band.forEach((b, i) => i > 0 && sc.add(b.root));
    if (bassist.rig) {
      const a = boneAnchor(bassist, 'Spine');
      bass.position.set(-0.04, -0.02, 0.17);
      bass.rotation.set(0.08, 0, -1.08);
      a.add(bass);
      this.holdInstrument(bassist, bass, new THREE.Vector3(0, 0.7, 0.035), new THREE.Vector3(0, 0.02, 0.06), (t, v) => (v.x += Math.sin(t * 9) * 0.03));
    } else {
      bass.position.set(0.1, 1.05, 0.28);
      bass.rotation.z = -0.6;
      bassist.body.add(bass);
    }
    if (sax.rig) {
      const a = boneAnchor(sax, 'Spine');
      saxo.position.set(0.06, 0.12, 0.2);
      saxo.rotation.set(0.2, 0, 0.2);
      a.add(saxo);
      this.holdInstrument(sax, saxo, new THREE.Vector3(-0.02, 0.24, 0.05), new THREE.Vector3(0.02, -0.04, 0.05), (t, v) => (v.y += Math.sin(t * 7) * 0.01));
    } else {
      saxo.position.set(0.05, 1.0, 0.24);
      sax.body.add(saxo);
    }
    for (const b of [bassist, sax, drummer]) markProps(b);
    for (const b of this.band) b.root.visible = false;

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
    // Móviles en alto con la linterna encendida entre el público (en 2026, más que mecheros): bombillas de tebeo
    const lp = new Float32Array(pts.length * 3);
    let n = 0;
    pts.forEach((p, i) => {
      if (i % 3) return;
      lp.set([p.x + 0.3, 2.15, p.z], n * 3);
      n++;
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp.slice(0, n * 3), 3));
    const pm = new THREE.PointsMaterial({ map: comicBulbTexture(), color: 0xfff6d0, size: 0.3, transparent: true, alphaTest: 0.5, depthWrite: false, fog: false });
    pm.userData.comicGlow = true;
    this.phones = new THREE.Points(lg, pm);
    this.phones.visible = false;
    sc.add(this.phones);
  }

  /**
   * Las dos manos del músico en su instrumento (como Fito con la guitarra): cada fotograma, ya con la pose hecha, la
   * mano más cercana al punto `a` va a él (el mástil, las llaves de arriba del saxo) y la otra a `b`, que se mueve.
   */
  private holdInstrument(p: Person, inst: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, move: (t: number, v: THREE.Vector3) => void) {
    const r = p.rig;
    if (!r) return;
    const ta = new THREE.Vector3(), tb = new THREE.Vector3(), pole = new THREE.Vector3(), v = new THREE.Vector3();
    let sideA: 'Left' | 'Right' | null = null;
    let t = 0;
    const post = (dt: number) => {
      if (!p.root.parent || !p.root.visible) return;
      t += dt;
      p.root.updateWorldMatrix(true, true);
      const mw = inst.matrixWorld;
      ta.copy(a).applyMatrix4(mw);
      tb.copy(b);
      move(t, tb);
      tb.applyMatrix4(mw);
      if (!sideA) {
        const l = r.bones.get('LeftHand')!.getWorldPosition(v).distanceTo(ta);
        const rr = r.bones.get('RightHand')!.getWorldPosition(v).distanceTo(ta);
        sideA = l < rr ? 'Left' : 'Right';
      }
      const sideB = sideA === 'Left' ? 'Right' : 'Left';
      const back = v.set(0, 0, -1).applyQuaternion(p.root.quaternion);
      for (const [side, target] of [[sideA, ta], [sideB, tb]] as const) {
        r.bones.get(side + 'Arm')!.getWorldPosition(pole);
        pole.addScaledVector(back, 0.35);
        pole.y -= 0.6;
        twoBone(r.bones.get(side + 'Arm')!, r.bones.get(side + 'ForeArm')!, r.bones.get(side + 'Hand')!, target, pole, 1);
      }
    };
    rigPost.add(post);
    this.posts.push(post);
  }

  /** La banda tocando: Fito se pasea; el bajista y el saxo, con sus instrumentos; el batería, sentado, a la batería. */
  private stepBand(dt: number, beat: number) {
    this.fito?.update(dt, beat);
    const [, bassist, sax, drummer] = this.band;
    animatePerson(bassist, dt, this.talkers.has(bassist) ? 'talk' : 'idle');
    animatePerson(sax, dt, 'idle');
    animatePerson(drummer, dt, 'idle');
    seatPose(drummer);
    // Las baquetas al ritmo: un brazo y luego el otro, con los codos doblados hacia la caja y los platos
    const hit = Math.max(0, Math.sin(beat * Math.PI * 2));
    drummer.armL.rotation.set(-0.6 - hit * 0.35, 0, -0.22);
    drummer.armR.rotation.set(-0.6 - (1 - hit) * 0.35, 0, 0.22);
    drummer.elbowL.rotation.x = drummer.elbowR.rotation.x = -0.95;
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
      // Ni a los pies de nadie del público ni en la cola de los baños (se quedaban metidos en los zapatos)
      if (this.people.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.3)) continue;
      if (Math.abs(z - Q_Z) < 0.7 && x > Q_X0 - 7 * Q_GAP - 0.6) continue;
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

  /** Fila de WC portátiles azules, con su indicador de libre/ocupado en cada puerta y un piloto encima. */
  private buildToilets(m: Merger) {
    const sc = this.scene;
    const sign = comicTex((ctx, w, h) => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 8, w - 16, h - 16);
      ctx.textAlign = 'center';
      inkText(ctx, 'WC', w / 2, h * 0.34, 118, '#1f4fa8');
      // Hombre y mujer, planos con su contorno
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      for (const [cx, skirt] of [[w * 0.33, false], [w * 0.67, true]] as const) {
        ctx.fillStyle = '#1f4fa8';
        ctx.beginPath();
        ctx.arc(cx, h * 0.66, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        if (skirt) {
          ctx.moveTo(cx, h * 0.72);
          ctx.lineTo(cx - 22, h * 0.95);
          ctx.lineTo(cx + 22, h * 0.95);
          ctx.closePath();
        } else ctx.rect(cx - 12, h * 0.72, 24, h * 0.23);
        ctx.fill();
        ctx.stroke();
      }
    }, 256, 256);
    const signMat = new THREE.MeshBasicMaterial({ map: sign, color: 0xcfd6e6 });
    for (let i = 0; i < WC_Z.length; i++) {
      const z = WC_Z[i];
      const fx = WC_X - 0.62; // cara de la puerta
      m.add(G.box, 0x2a63c4, WC_X, 1.15, z, 0, 0, 0, 1.2, 2.3, 1.3); // cabina de plástico
      m.add(G.cyl, 0xe9eef5, WC_X, 2.36, z, 0, 0, 0, 1.45, 0.14, 1.45); // techo blanco
      m.add(G.box, 0xe9eef5, WC_X, 0.04, z, 0, 0, 0, 1.3, 0.08, 1.4); // base
      // Lo de dentro, que se ve con la puerta abierta
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), new THREE.MeshBasicMaterial({ color: 0x0c1220 }));
      dark.position.set(fx - 0.004, 1.08, z);
      dark.rotation.y = -Math.PI / 2;
      sc.add(dark);
      // La puerta: bisagra en el lado de +z, se abre hacia fuera cuando alguien entra o sale. Su x local
      // va de la bisagra al tirador y su -z local mira hacia fuera
      const box = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
      const door = new Door({ hinge: new THREE.Vector3(fx - 0.02, 0, z + 0.5), ry: Math.PI / 2, width: 1.0, swing: 1.7, reach: 1.25, speed: 0.4, sound: 'plastic' });
      const dm = new Merger();
      dm.add(G.box, 0x2457b3, 0.5, 1.08, 0, 0, 0, 0, 1.0, 2.0, 0.04);
      for (let k = 0; k < 4; k++) dm.add(G.box, 0x1b3f80, 0.5, 1.9 + k * 0.07, -0.03, 0, 0, 0, 0.6, 0.025, 0.02); // rejilla
      dm.add(G.box, 0xc0c4cc, 0.86, 1.05, -0.04, 0, 0, 0, 0.06, 0.22, 0.05); // tirador
      door.leaf.add(dm.mesh());
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), signMat);
      pl.position.set(0.4, 1.45, -0.03);
      pl.rotation.y = Math.PI;
      // Indicador libre / ocupado junto al tirador
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.04), box);
      ind.position.set(0.86, 1.2, -0.04);
      door.leaf.add(pl, ind);
      sc.add(door.group);
      this.wcDoors.push(door);
      // Piloto grande encima de la puerta, visible desde lejos: bombilla de tebeo (verde o roja)
      const lamp = new THREE.SpriteMaterial({ map: comicBulbTexture(), color: 0x2ecc71, transparent: true, alphaTest: 0.5, fog: false });
      lamp.userData.comicGlow = true;
      const ls = new THREE.Sprite(lamp);
      ls.scale.setScalar(0.28);
      ls.position.set(fx - 0.08, 2.15, z);
      sc.add(ls);
      this.wcLights.push({ box, lamp });
    }
    this.colliders.push({ minX: WC_X - 0.65, maxX: WC_X + 0.65, minZ: WC_Z[0] - 0.7, maxZ: WC_Z[WC_Z.length - 1] + 0.7 });
    // El foco de la zona de baños: se ve encendido (cristal y su halo), pero no ilumina nada
    m.add(G.cyl, 0x3a3a45, WC_X + 1.5, 3, WC_Z[2] + 0.75, 0, 0, 0, 0.12, 6, 0.12);
    this.colliders.push({ minX: WC_X + 1.42, maxX: WC_X + 1.58, minZ: WC_Z[2] + 0.67, maxZ: WC_Z[2] + 0.83, round: true });
    m.add(G.box, 0x3a3a45, WC_X + 1.2, 6, WC_Z[2] + 0.75, 0, 0, 0.5, 0.6, 0.3, 0.9);
    // (el cristal, en la cara de la cabeza del foco que mira a las cabinas y un poco hacia abajo)
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.26), new THREE.MeshBasicMaterial({ color: 0xeef4ff, side: THREE.DoubleSide }));
    lens.position.set(WC_X + 0.93, 5.85, WC_Z[2] + 0.75);
    lens.rotation.set(0, -Math.PI / 2, 0);
    lens.rotateX(0.5);
    sc.add(lens);
    // (halo aditivo: de noche, el cómic lo dibuja como luz de tebeo)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xdfe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.scale.setScalar(1.6);
    halo.position.set(WC_X + 0.85, 5.75, WC_Z[2] + 0.75);
    sc.add(halo);
    this.paintToilets();
  }

  private paintToilets() {
    this.wcLights.forEach((m, i) => {
      const c = this.wcFree(i) ? 0x2ecc71 : 0xe74c3c;
      m.box.color.set(c);
      m.lamp.color.set(c);
    });
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
    n.next = undefined;
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
    // (en Barajas y en llegadas, y en primera fila, la cola de los baños ni se ve: quieta)
    if (this.player.root.position.x > 100 || this.phase === 'rhythm' || this.phase === 'ending' || this.phase === 'done') {
      for (const n of this.npcs) if (n.mode === 'queue') animatePerson(n.p, dt, 'idle');
      return;
    }
    const pp = this.player.root.position;
    for (let i = 0; i < WC_Z.length; i++) {
      if (this.wcBusyT[i] <= 0) continue;
      this.wcBusyT[i] -= dt;
      // Va a salir alguien: primero se abre la puerta
      if (this.wcBusyT[i] < 0.5 && !this.wcRes[i]) this.wcDoors[i].hold(1.3);
      if (this.wcBusyT[i] <= 0 && !this.wcRes[i]) {
        // Sale alguien (de dentro, por la puerta abierta) y se vuelve al concierto
        const n = this.spawn(WC_X - 0.3, WC_Z[i]);
        n.mode = 'leave';
        // Primero sale por la puerta, recto; luego al concierto
        n.tx = WC_X - 1.2;
        n.tz = WC_Z[i];
        n.next = [2 + Math.random() * 8, -2 + Math.random() * 6];
        const d = pp.distanceTo(n.p.root.position);
        if (d < 12) audio.knock(0.5 / (1 + d * 0.3), 180, 0.08);
      }
    }
    // (con Gas en la cola, la cola espera con él: si no, se le colaban y él no avanzaba)
    if (!this.gasQueued) this.headT -= dt;
    const head = this.queue[0];
    if (head && this.headT <= 0) {
      const i = this.freeToilet();
      if (i >= 0) {
        this.queue.shift();
        head.mode = 'toWc';
        head.wc = i;
        // Delante de su puerta y luego dentro (la puerta se le abre al llegar)
        head.tx = WC_X - 1.0;
        head.tz = WC_Z[i];
        head.next = [WC_X - 0.3, WC_Z[i]];
        this.wcRes[i] = true;
        this.headT = 0.8;
      }
    }
    // Siempre llega gente nueva al final (la cola nunca se acaba)
    if (!this.gasQueued) this.joinT -= dt;
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
        if (this.stepTo(n.p, n, n.tx, n.tz, 1.6, dt, undefined, true, this.movingAvoid, n.circle) && n.next) {
          [n.tx, n.tz] = n.next;
          n.next = undefined;
        } else if (!n.next && Math.hypot(n.p.root.position.x - n.tx, n.p.root.position.z - n.tz) < 0.12) {
          this.wcBusyT[n.wc] = 12 + Math.random() * 10;
          this.wcRes[n.wc] = false;
          this.wcDoors[n.wc].hold(0.4);
          this.hide(n);
          const d = pp.distanceTo(this.v1.set(WC_X, 0, WC_Z[n.wc]));
          if (d < 12) audio.knock(0.5 / (1 + d * 0.3), 160, 0.1);
        }
      } else if (n.mode === 'leave') {
        if (this.stepTo(n.p, n, n.tx, n.tz, 1.4, dt, undefined, true, this.movingAvoid, n.circle)) {
          if (n.next) {
            [n.tx, n.tz] = n.next;
            n.next = undefined;
          } else this.hide(n);
        }
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
    this.wcWho.length = 0;
    for (const n of this.npcs) if (n.p.root.visible) this.wcWho.push(n.p.root.position);
    if (this.player.root.visible) this.wcWho.push(this.player.root.position);
    for (const d of this.wcDoors) d.update(dt, this.wcWho, this.camera.position);
    this.paintToilets();
  }

  /** Final de la cola, donde Gas se pone. */
  private tailSpot(out = this.tmpV) {
    return this.slot(this.queue.length + 0.3, out);
  }

  /**
   * Gas se pone a la cola, andando hasta el final (sin fundido: se le ve esperar). La primera vez, mientras espera,
   * Fito toca un temón y Azul se lo graba; la tercera, el urinario otra vez. Cada vez, una canción que se pierde.
   */
  private wcTrip() {
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    this.walker.stop();
    this.trip++;
    this.phase = 'wc';
    this.gasQueued = true;
    const t = this.tailSpot(new THREE.Vector3());
    this.auto = { p: this.gas, st: { walk: 0 }, pts: [[t.x, t.z]], speed: 1.3, face: Math.PI / 2 };
    audio.whoosh();
    this.updateHud();
    const chat = CHATS.temon;
    if (this.trip === 1) {
      // Fito empieza el temón: Gas se lo cuenta por el chat y Azul lo graba desde su sitio
      later(() => phoneChat({ ...chat, msgs: chat.msgs.slice(0, 2) }, () => {
        this.phase = 'film';
        dialogue(CONCERT.filmIntro, () => this.startFilm());
      }), 1500);
    } else {
      later(() => dialogue(SIDE.pee.again, () => this.peeThen(1, () => this.afterTrip())), 1500);
    }
  }

  /**
   * La segunda vez: las gafas de sol se las ha dejado en una cabina. Va directo a mirar (sin hacer cola: los de la
   * cola protestan) y las busca puerta por puerta, en las mismas cabinas que se ven (las averiadas no se abren).
   */
  private glassesTrip() {
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    this.walker.stop();
    this.trip++;
    this.phase = 'wc';
    this.updateHud();
    bark('Un señor de Telde', CONCERT.queueComplain);
    later(() => bark('Gas', CONCERT.glassesReply), 1700);
    later(() => {
      const occupied = WC_Z.map((_, i) => i).filter((i) => !WC_BROKEN.includes(i) && !this.wcFree(i));
      this.side = new GlassesHunt(
        () => {
          this.side = null;
          this.afterTrip();
        },
        { n: WC_Z.length, broken: WC_BROKEN, occupied },
      );
    }, 3200);
  }

  /** Vuelve del baño: otra canción que se ha perdido, y a buscar a Azul. */
  private afterTrip() {
    this.missed++;
    bark('Gas', CONCERT.songLost[Math.min(this.missed - 1, CONCERT.songLost.length - 1)]);
    later(() => this.startSeek(), 900);
  }

  /** El urinario (Gas), y luego lo que siga. */
  private peeThen(hard: number, next: () => void) {
    this.hud.setAction(null);
    this.side = new PeeAim(hard, () => {
      this.side = null;
      next();
    });
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
    // (Gas sigue en la cola, lejos y detrás de ella: fuera del encuadre)
    this.gas.root.visible = false;
    this.filmUi?.remove();
    // El marco del móvil, en tebeo: borde de tinta, rótulos de tebeo y las manos de delante como siluetas negras
    const lab = "font:22px Bangers,'Arial Black',sans-serif;letter-spacing:.05em;color:#141018;background:#fffbf0;border:3px solid #141018;border-radius:6px;padding:0 8px";
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;inset:17% 12% 4%;border:5px solid #141018;outline:3px solid #fffbf0;outline-offset:-9px;border-radius:22px;pointer-events:none;z-index:5;box-shadow:0 0 0 2000px rgba(20,16,24,.42)';
    ui.innerHTML =
      `<div style="position:absolute;left:16px;top:10px;${lab}"><span data-rec style="color:#e2302a">●</span> REC <span data-t>0:00</span></div>` +
      `<div style="position:absolute;right:16px;top:10px;${lab}">🎸 <span data-q>0</span>%</div>` +
      '<div data-box style="position:absolute;left:29%;right:29%;top:25%;bottom:25%;border:4px dashed #fffbf0;border-radius:10px;box-shadow:0 0 0 2px #141018,inset 0 0 0 2px #141018"></div>' +
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
    // (andando: a más de 2 m/s ya no parece una persona)
    fito.root.position.x = Math.sin(this.filmT * 0.42) * 5.2 + Math.sin(this.filmT * 1.1) * 0.6;
    // El móvil: joystick o arrastrar para apuntar
    const ax = this.input.axes();
    this.filmYaw = THREE.MathUtils.clamp(this.filmYaw - ax.x * 1.6 * dt - this.input.consumeCam() * 0.6, -0.9, 0.9);
    this.filmPitch = THREE.MathUtils.clamp(this.filmPitch + ax.y * 1.0 * dt, -0.1, 0.5);
    const pp = this.azul.root.position;
    const shake = Math.sin(this.filmT * 23) * 0.006 + Math.sin(this.filmT * 7) * 0.01;
    this.camera.position.set(pp.x + 0.15, 1.75, pp.z + 0.3);
    // Con el zoom del móvil: Fito se ve entero y grande, no un muñequito al fondo
    this.camera.fov += ((this.camera.aspect < 1 ? 21 : 15) - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
    this.tmpV.set(pp.x + Math.sin(this.filmYaw + shake) * 10, 1.75 + Math.tan(this.filmPitch + shake) * 10, pp.z + Math.cos(this.filmYaw + shake) * 10);
    this.camera.lookAt(this.tmpV);
    this.camera.updateMatrixWorld();
    // ¿Fito dentro del recuadro?
    this.tmpV.copy(fito.root.position).setY(fito.root.position.y + 1.6).project(this.camera);
    const inside = Math.abs(this.tmpV.x) < 0.42 && Math.abs(this.tmpV.y) < 0.5 && this.tmpV.z < 1;
    if (inside) this.filmIn += dt;
    (ui.querySelector('[data-box]') as HTMLElement).style.borderColor = inside ? '#5fcf80' : '#fffbf0';
    (ui.querySelector('[data-t]') as HTMLElement).textContent = `0:${Math.floor(this.filmT).toString().padStart(2, '0')}`;
    (ui.querySelector('[data-q]') as HTMLElement).textContent = `${Math.round((this.filmIn / Math.max(0.1, this.filmT)) * 100)}`;
    (ui.querySelector('[data-rec]') as HTMLElement).style.opacity = this.filmT % 1 < 0.5 ? '1' : '0.2';
    // Gente que salta delante con las manos arriba (siluetas de tinta, a contraluz)
    if (Math.random() < dt * 0.7) {
      const h = document.createElement('div');
      h.textContent = Math.random() < 0.5 ? '🙌' : '🙋';
      h.style.cssText = `position:absolute;bottom:-90px;left:${10 + Math.random() * 70}%;font-size:90px;transition:transform .45s ease-out;filter:brightness(0);opacity:.9`;
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
    this.camera.fov = this.camera.userData.baseFov ?? this.baseFov;
    this.camera.updateProjectionMatrix();
    audio.luck();
    bark('Azul', CONCERT.filmDone);
    this.talk(this.azul);
    // Gas se ha perdido el temón; sigue en la cola (se le vuelve a ver) y Azul le escribe
    this.missed++;
    this.phase = 'wc';
    this.gas.root.visible = true;
    this.busy = true;
    this.updateHud();
    const chat = CHATS.temon;
    later(() => phoneChat({ ...chat, msgs: chat.msgs.slice(2, 6) }, () => dialogue(SIDE.pee.first, () => this.peeThen(0, () => this.startSeek()))), 1500);
  }

  private filmPct() {
    return Math.round((this.filmIn / Math.max(0.1, Math.min(this.filmT, FILM_SECS))) * 100);
  }

  /** El flash del móvil de Azul y los de otra gente que despistan: estallidos de tebeo (no iluminan nada). */
  private buildFlash() {
    const mat = new THREE.SpriteMaterial({ map: flashTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
    mat.userData.comicGlow = true;
    this.flashSprite = new THREE.Sprite(mat);
    this.flashSprite.scale.setScalar(1.9);
    this.scene.add(this.flashSprite);
    for (let i = 0; i < 3; i++) {
      const dm = new THREE.SpriteMaterial({ map: flashTexture(), color: 0xfff0c8, transparent: true, opacity: 0, depthWrite: false, fog: false });
      dm.userData.comicGlow = true;
      const s = new THREE.Sprite(dm);
      s.scale.setScalar(1.1);
      this.scene.add(s);
      this.decoys.push({ s, t: 0 });
    }
  }

  private flashOff() {
    (this.flashSprite.material as THREE.SpriteMaterial).opacity = 0;
    for (const d of this.decoys) {
      d.t = 0;
      (d.s.material as THREE.SpriteMaterial).opacity = 0;
    }
  }

  /**
   * Gas sale del baño en plena canción lenta: la pista a oscuras, todo el mundo con el móvil en alto, y tiene que
   * encontrar a Azul entre la gente (ella hace doble flash). La música sigue: cada canción que pasa, se la pierde.
   */
  private startSeek() {
    this.gasQueued = false;
    this.auto = null;
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
    audio.ambience(0.25);
    this.busy = true;
    this.updateHud();
    const chat = CHATS.temon;
    const go = () => {
      this.busy = false;
      this.lost.reset();
      this.updateHud();
    };
    // La primera vez, lo que le escribió al salir («Flash. Pls. Estoy. Xo no veo»)
    if (this.trip === 1) phoneChat({ ...chat, msgs: chat.msgs.slice(6) }, go);
    else {
      bark('Gas', CONCERT.seekAgain);
      go();
    }
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
      bark('Gas', CONCERT.songLost[Math.min(this.missed - 1, CONCERT.songLost.length - 1)]);
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
    this.flashSprite.position.set(ap.x + 0.25, 2.3, ap.z + 0.2);
    (this.flashSprite.material as THREE.SpriteMaterial).opacity = on ? 1 : 0;
    this.flashSprite.material.rotation = this.t * 0.7;
    this.recordT = 0.3; // Azul con el móvil en alto
    // Otros móviles: flashes sueltos por el público
    this.decoyT -= dt;
    if (this.decoyT <= 0) {
      this.decoyT = 0.5 + Math.random() * 0.9;
      const d = this.decoys.find((x) => x.t <= 0);
      const c = this.people[Math.floor(Math.random() * (this.people.length - 1))];
      if (d && c) {
        d.t = 0.12;
        d.s.position.set(c.x + 0.2, 2.25, c.z);
      }
    }
    for (const d of this.decoys) {
      d.t -= dt;
      (d.s.material as THREE.SpriteMaterial).opacity = d.t > 0 ? 1 : 0;
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
    this.flashOff();
    const pp = this.player.root.position;
    const ap = this.azul.root.position;
    this.walker.facing = Math.atan2(ap.x - pp.x, ap.z - pp.z);
    this.azul.root.rotation.y = Math.atan2(pp.x - ap.x, pp.z - ap.z);
    audio.luck();
    vibrate(25);
    comicWord('¡AQUÍ!', 'luck');
    this.fx.burst(ap.clone().lerp(pp, 0.5).setY(2.3), '❤️', 3, 0.8, 0.6);
    hugFor(this.azul, this.player, 2.6);
    const lines: Line[] = [...CONCERT.found[Math.min(this.trip - 1, 2)], ...(this.trip === 1 && this.smokeThrown ? [CONCERT.gasSmoke] : [])];
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
      this.flashSprite.position.set(ap.x + 0.25, 2.3, ap.z + 0.2);
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
      // Vuelve la luz con la siguiente canción, y Gas tiene que volver al baño
      this.setDark(false);
      later(() => {
        // (la segunda vez, se da cuenta de las gafas delante de ella, antes de ir)
        const again: Line[] = this.trip === 1 ? [...CONCERT.goAgain[1], ...SIDE.glasses.intro] : CONCERT.goAgain[2];
        dialogue(again, () => {
          this.busy = false;
          this.phase = 'toWc';
          this.lost.reset();
          this.updateHud();
        });
      }, 900);
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
    if (this.phase === 'airport') chips += `<span class="chip${this.gateT < 10 || this.gateStage === 2 ? ' chip-alert' : ''}">🚪 ${Math.ceil(this.gateT)}s</span>`;
    if (this.phase === 'airport' && this.burgerHits) chips += `<span class="chip">🧳 ${this.burgerHits}</span>`;
    if (chips !== this.hudChips) h.setCounters((this.hudChips = chips));
    const setObj = (t: string) => {
      if (t !== this.hudObj) h.setObjective((this.hudObj = t));
    };
    // Objetivos mínimos (un emoji o dos palabras), sin decir qué hacer
    switch (this.phase) {
      case 'intro':
        setObj('');
        break;
      case 'airport':
        setObj('🛫 Puerta 26');
        break;
      case 'gateQueue':
        setObj(this.gateStep === 'ask' ? '🎫' : '🛫 Puerta 26');
        break;
      case 'arrivals':
        setObj('☕');
        break;
      case 'beers':
        setObj(this.beers?.stage === 'carry' ? '🍺 💙' : '🍺');
        break;
      case 'show':
        setObj('🎸');
        break;
      case 'toWc':
        setObj(this.trip === 1 ? '🕶️' : '🚻');
        break;
      case 'wc':
        setObj('🚻');
        break;
      case 'film':
        setObj('🎥');
        break;
      case 'seek':
      case 'found':
        setObj('📸');
        break;
      case 'rhythm':
        setObj('🎸');
        break;
      default:
        setObj('💙');
    }
  }

  /** A dónde iría la pista (solo sale si lleva 40 s sin avanzar). */
  private target(): THREE.Vector3 | null {
    switch (this.phase) {
      case 'airport': {
        const [x, z] = this.gateTail();
        return this.v1.set(x, 0, z);
      }
      case 'gateQueue':
        return this.gateStep === 'ask' ? GATE_SCAN : null;
      case 'arrivals':
        return this.gas.root.position;
      case 'beers':
        return this.beers ? (this.beers.stage === 'carry' ? this.beers.friendAt : BAR_POS) : null;
      case 'toWc':
        return this.trip === 1 ? this.v1.set(WC_X - 1.3, 0, WC_Z[2]) : this.tailSpot(this.v1);
      case 'seek':
        return this.azul.root.position;
    }
    return null;
  }

  /** Lo que sale en las pantallas del escenario. */
  private drawScreens(beat: number, pulse: number) {
    const W = 512, H = 256;
    if (!this.halftone) {
      // Trama de puntos de imprenta, una vez
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(255,255,255,.16)';
      for (let y = 6; y < H; y += 12) for (let x = (y / 12) % 2 ? 12 : 6; x < W; x += 12) {
        g.beginPath();
        g.arc(x, y, 2.3, 0, Math.PI * 2);
        g.fill();
      }
      this.halftone = c;
    }
    const ballad = this.phase === 'seek' || this.phase === 'found';
    const live = this.phase === 'rhythm' || this.phase === 'ending';
    for (const ctx of this.screenCtx) {
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      if (!this.showOn) {
        // Antes del concierto: el nombre del grupo, quieto
        ctx.fillStyle = '#141832';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(this.halftone, 0, 0);
        inkText(ctx, 'FITO & FITIPALDIS', W / 2, H / 2 - 10, 64, '#ffcf1f', W - 40);
        inkText(ctx, 'Estadio de Gran Canaria', W / 2, H / 2 + 50, 28, PAPER, W - 60);
      } else {
        // En directo: Fito en primer plano, en colores planos que cambian con la música (en la lenta, azul y quieto)
        const pal = ['#d7263d', '#f4a020', '#7a5cff', '#1b998b'];
        ctx.fillStyle = ballad ? '#1a2350' : pal[Math.floor(beat / 4) % pal.length];
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(this.halftone, 0, 0);
        const s = 1 + (live ? pulse * 0.05 : 0);
        const cx = W / 2 + (ballad ? 0 : Math.sin(this.t * 0.6) * 24);
        const by = H + 10;
        ctx.lineWidth = 6;
        ctx.strokeStyle = INK;
        // Mástil de la guitarra
        ctx.fillStyle = '#7a4a26';
        ctx.beginPath();
        ctx.moveTo(cx + 40 * s, by - 30 * s);
        ctx.lineTo(cx + 210 * s, by - 170 * s);
        ctx.lineTo(cx + 222 * s, by - 156 * s);
        ctx.lineTo(cx + 54 * s, by - 18 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Hombros, de negro
        ctx.fillStyle = ballad ? '#0c0f22' : '#151515';
        ctx.beginPath();
        ctx.ellipse(cx, by, 130 * s, 80 * s, 0, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        // Cara y barba
        ctx.fillStyle = ballad ? '#8a7aa0' : '#e2b08c';
        ctx.beginPath();
        ctx.arc(cx, by - 118 * s, 44 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2a2420';
        ctx.beginPath();
        ctx.arc(cx, by - 108 * s, 40 * s, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.fill();
        // El sombrero
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(cx, by - 150 * s, 74 * s, 13 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 42 * s, by - 204 * s, 84 * s, 56 * s);
        ctx.fillStyle = '#5a1a14';
        ctx.fillRect(cx - 42 * s, by - 166 * s, 84 * s, 10 * s);
        // Rótulo de abajo
        ctx.fillStyle = INK;
        ctx.fillRect(0, H - 46, W, 46);
        inkText(ctx, 'FITO & FITIPALDIS', W / 2, H - 23, 30, ballad ? '#b9c6ff' : '#ffcf1f', W - 40);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, W - 10, H - 10);
    }
    this.screenTex.forEach((t) => (t.needsUpdate = true));
  }

  /** Quien el juego lleva andando (Azul en la cola de embarque, Gas a la cola del baño). */
  private stepAuto(dt: number) {
    const a = this.auto;
    if (!a) return;
    const [tx, tz] = a.pts[0];
    if (this.stepTo(a.p, a.st, tx, tz, a.speed, dt, a.pts.length === 1 ? a.face : undefined)) {
      a.pts.shift();
      if (!a.pts.length) {
        this.auto = null;
        if (a.face !== undefined) a.p.root.rotation.y = a.face;
        if (a.p === this.player) this.walker.facing = a.p.root.rotation.y;
        a.done?.();
      }
    }
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.fireworks.update(dt);
    this.applyLight(dt);
    if (this.rhythm) {
      this.rhythm.update(dt);
      if (this.rhythm.finished) this.finishRhythm();
    }
    const beat = this.rhythm ? this.rhythm.beat : this.t * 2;
    const pulse = Math.pow(1 - (beat % 1), 3);
    const live = this.phase === 'rhythm' || this.phase === 'ending';
    const ballad = this.phase === 'seek' || this.phase === 'found';

    // Público: de pie, gesticulando; en pleno concierto con los brazos arriba (antes de salir la banda, tranquilos)
    const energy = live ? 1 : ballad ? 0.25 : this.showOn ? 0.55 : 0.3;
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
    if (this.showOn) this.stepBand(dt, beat);
    // Haces de los focos: barren despacio; en la lenta, casi quietos y tenues; mientras se graba, casi invisibles
    this.spots.forEach((s, i) => {
      const slow = ballad ? 0.3 : 1;
      s.mesh.rotation.z = Math.sin(this.t * 0.8 * slow + s.ph) * 0.5;
      s.mesh.rotation.x = -0.7 + Math.cos(this.t * 0.6 * slow + s.ph) * 0.25;
      const u = s.mat.uniforms;
      if (ballad) (u.color.value as THREE.Color).setHSL(0.62, 0.6, 0.6);
      else (u.color.value as THREE.Color).setHSL((Math.floor(beat / 4) * 0.17 + i * 0.2) % 1, 0.85, 0.6);
      const want = this.phase === 'film' ? 0.04 : ballad ? 0.08 : 0.16 + (live ? pulse * 0.06 : 0);
      u.opacity.value += (want - (u.opacity.value as number)) * Math.min(1, dt * 3);
    });

    // Personaje que se lleva (Azul en el aeropuerto y en llegadas, Gas en el estadio)
    const walking = !this.busy && !this.auto && (this.phase === 'beers' || this.phase === 'toWc' || this.phase === 'airport' || this.phase === 'seek' || this.phase === 'arrivals');
    // (andando sola por la cola de embarque o hasta la del baño: la lleva el juego, no el joystick)
    const scripted = !!this.auto || this.phase === 'gateQueue';
    this.invuln -= dt;
    if (this.phase === 'airport' && !this.busy) this.stepAirport(dt);
    // Grabando, arrastrar apunta el móvil (lo lee stepFilm)
    if (this.phase !== 'film') this.walker.turn(this.input.consumeCam());
    this.walker.canJump = walking;
    const px = this.player.root.position.x;
    const circles = this.player === this.gas ? this.allPeople : px > 350 ? this.arrCircles : this.gateCircles;
    const mag = scripted ? 0 : this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, this.colliders, px > 350 ? ARR_WALK : px > 100 ? AIR_WALK : this.bounds, circles);
    if (!scripted && this.walker.bump) audio.knock(Math.min(0.45, this.walker.bump * 0.07), 200, 0.07); // choque sordo contra alguien
    this.stepCrowd(dt);
    this.stepQueue(dt);
    this.stepGate(dt);
    this.stepAuto(dt);
    this.beers?.update(dt, this.busy);
    if (this.phase === 'seek' && !this.busy) this.stepSeek(dt);
    if (this.phase === 'arrivals') this.stepArrivals(dt);
    if (this.phase === 'film') this.stepFilm(dt);
    {
      const pp0 = this.player.root.position;
      const m = this.movers[0];
      m.x = pp0.x;
      m.z = pp0.z;
      m.vx = this.walker.vx;
      m.vz = this.walker.vz;
      // Los demás también apartan los vasos con los pies: la otra (Azul o Gas) y la gente de la cola
      let k = 1;
      const push = (x: number, z: number, vx: number, vz: number) => {
        const o = (this.movers[k++] ??= { x: 0, z: 0, vx: 0, vz: 0, r: 0.3, height: 1.7 });
        o.x = x;
        o.z = z;
        o.vx = vx;
        o.vz = vz;
      };
      const other = this.player === this.gas ? this.azul : this.gas;
      if (other.root.visible) push(other.root.position.x, other.root.position.z, 0, 0);
      for (const n of this.npcs) if (n.p.root.visible) push(n.p.root.position.x, n.p.root.position.z, n.vx ?? 0, n.vz ?? 0);
      while (k < this.movers.length) push(1e4, 1e4, 0, 0);
      this.phys.step(dt, this.movers);
      this.stepBall();
      for (const im of this.phys.impacts) {
        const d = im.at.distanceTo(pp0);
        if (d < 14) audio.knock(Math.min(1, im.strength * (im.kind === 'cup' ? 6 : 2)) / (1 + d * 0.3), im.kind === 'ball' ? 520 : 2300);
      }
    }
    if (!scripted) {
      this.player.root.rotation.y = this.walker.facing;
      if (live) animatePerson(this.player, dt, this.phase === 'ending' ? 'cheer' : 'dance', 0, beat * Math.PI);
      else if (this.talkers.has(this.player)) animatePerson(this.player, dt, 'talk');
      else animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);
    }
    // Azul (si no la llevas): en su sitio, bailando, o con el móvil en alto haciendo flash; mira a Gas si viene
    if (this.player !== this.azul && this.azul.root.visible) {
      if (live) animatePerson(this.azul, dt, 'dance', 0, beat * Math.PI + 1);
      else animatePerson(this.azul, dt, this.phase === 'found' || this.talkers.has(this.azul) ? 'talk' : 'idle');
      if (!live && this.phase !== 'seek' && this.phase !== 'found') {
        const ap = this.azul.root.position, gp = this.gas.root.position;
        const near = this.gas.root.visible && Math.hypot(gp.x - ap.x, gp.z - ap.z) < 6;
        faceTo(this.azul.root, near ? Math.atan2(gp.x - ap.x, gp.z - ap.z) : 0, dt, 3);
      }
      this.recordT -= dt;
      if (this.recordT > 0) {
        this.azul.armR.rotation.x = -2.5;
        this.azul.elbowR.rotation.x = -0.5;
      }
    }

    // El camarero: atiende (habla) cuando le piden, y mira a quien llega a la barra
    {
      const bp = this.barman.root.position, pp = this.player.root.position;
      const near = this.player === this.gas && Math.hypot(pp.x - bp.x, pp.z - bp.z) < 5;
      faceTo(this.barman.root, near ? Math.atan2(pp.x - bp.x, pp.z - bp.z) : Math.PI / 2, dt, 3);
      animatePerson(this.barman, dt, this.talkers.has(this.barman) ? 'talk' : 'idle');
    }
    // Los demás que hablan (la agente de la puerta 26, Fito): gesticulan mientras dura su frase
    for (const [p, left] of this.talkers) {
      if (left - dt <= 0) this.talkers.delete(p);
      else this.talkers.set(p, left - dt);
      if (p === this.agent) animatePerson(p, dt, this.talkers.has(p) ? 'talk' : 'idle');
    }

    // Escenario vivo: pantallas, láseres y móviles en alto
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
      });
    }
    this.phones.visible = ballad || this.phase === 'ending';
    (this.phones.material as THREE.PointsMaterial).size = 0.3 + Math.sin(this.t * 2) * 0.02;
    this.phones.position.x = Math.sin(this.t * 1.2) * 0.2;

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    const pp = this.player.root.position;
    if (walking && !this.smokeThrown && this.phase === 'airport' && Math.hypot(pp.x - BIN_POS.x, pp.z - BIN_POS.z) < 1.6) {
      // El tabaco, a la papelera (opcional; Gas se fijará)
      label = CONCERT.smokeBtn;
      action = () => {
        this.smokeThrown = true;
        audio.luck();
        bark('Azul', CONCERT.smokeDone);
        this.fx.burst(BIN_POS.clone().setY(1.1), '✨', 5);
        this.updateHud();
      };
    } else if (this.phase === 'gateQueue' && this.gateStep === 'ask' && !this.busy) {
      label = CONCERT.gateBtn;
      action = () => this.showCard();
    } else if (walking && this.phase === 'beers' && this.beers) {
      if (this.beers.stage === 'toBar' && pp.distanceTo(BAR_POS) < 3.2) {
        label = SIDE.beers.btn;
        action = () => {
          this.beers!.pick();
          this.talk(this.barman, 1.6);
          this.updateHud();
        };
      } else if (this.beers.stage === 'carry' && pp.distanceTo(this.beers.friendAt) < 2.2) {
        label = SIDE.beers.give;
        action = () => this.deliverBeers();
      }
    } else if (walking && this.phase === 'toWc') {
      if (this.trip === 1) {
        if (Math.hypot(pp.x - (WC_X - 1.3), pp.z - WC_Z[2]) < 2.4) {
          label = CONCERT.glassesBtn;
          action = () => this.glassesTrip();
        }
      } else if (pp.distanceTo(this.tailSpot()) < 1.6) {
        label = '🚻 A la cola';
        action = () => this.wcTrip();
      }
      if (!label && pp.distanceTo(BAR_POS) < 3.2) {
        label = 'Hablar';
        action = () => this.talkTo(CONCERT.barmanAgain, () => this.phase);
      }
    }
    this.hud.setAction(label, !!label);
    if (this.input.consumeAction() && action) action();
    if (this.phase === 'seek') this.updateHud();

    // Pistas, solo si se ha perdido: el marcador, la flecha del HUD y la columna salen a los 40 s sin avanzar
    const key = `${this.phase}|${this.trip}|${this.beers?.stage ?? ''}|${this.gateStep}|${this.showOn}`;
    const tgt = this.lost.tick(key, dt, this.busy || !!this.auto) ? this.target() : null;
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, 2.6 + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 2.5 ? null : -rel);
      beacon.at(pp.distanceTo(tgt) < 2.5 ? null : tgt);
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
    (this.mood === 'day' ? this.daySky : this.sky).update(this.camera, dt);
  }

  private talkTo(lines: Line[], next: () => Phase) {
    this.busy = true;
    this.input.reset();
    if (lines.some((l) => l.who === 'Camarero')) this.talk(this.barman, 3);
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
    this.flashOff();
    if (this.player !== this.gas) this.toStadium();
    if (!this.showOn) this.setShow(true);
    this.gasQueued = false;
    this.auto = null;
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
        comicWord(`¡${combo}!`, 'perfect');
        audio.cheer(0.4);
        vibrate(40);
      } else if (perfect) vibrate(12);
    };
  }

  private finishRhythm() {
    const r = this.rhythm!;
    this.result = { hits: r.hits, total: r.total, perfects: r.perfects, maxCombo: r.maxCombo };
    bark('Gas', CONCERT.rhythmDone(r.hits, r.total));
    comicWord('¡BRAVO!', 'fanfare');
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
              ['Tabaco', this.smokeThrown ? 'a la papelera 🚭' : 'sigue en el bolso… 🚬'],
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

  // ---------------- Modo prueba ----------------

  debug(): DebugItem[] {
    // (el panel ya cierra diálogos, chats y escenas de cine y anula los temporizadores pendientes)
    const stop = () => {
      this.rhythm?.dispose();
      this.rhythm = null;
      this.side?.dispose();
      this.side = null;
      this.busy = false;
      this.auto = null;
      this.gasQueued = false;
      this.input.reset();
      this.walker.stop();
      this.hud.setAction(null);
      if (this.filmUi) {
        this.filmUi.remove();
        this.filmUi = null;
        this.camera.fov = this.camera.userData.baseFov ?? this.baseFov;
        this.camera.updateProjectionMatrix();
      }
      this.band[0].root.position.x = 0;
      this.azul.root.visible = true;
      this.setDark(false, true);
      this.flashOff();
      this.fireworks.clear();
      this.talkers.clear();
      this.lost.reset();
      audio.ambience(0);
    };
    /** El estadio, con lo de antes hecho: llegado, cervezas entregadas y, si `show`, la banda en el escenario. */
    const stadium = (show: boolean, trip: number, missed: number) => {
      stop();
      this.beers?.dispose();
      this.beers = null;
      this.toStadium();
      this.setShow(show);
      if (!show) audio.playTrack(SONG_OF[4]);
      this.trip = trip;
      this.missed = missed;
      this.filmDone = trip > 0;
    };
    const airport = () => {
      stop();
      this.beers?.dispose();
      this.beers = null;
      this.setShow(false);
      audio.playTrack(SONG_OF[4]);
      this.trip = this.missed = 0;
      this.filmDone = false;
      this.startAirport();
    };
    return [
      { label: '0 · Barajas', run: () => airport() },
      {
        label: '0b · Cola de embarque',
        run: () => {
          airport();
          this.azul.root.position.set(GATE_X, 0, AIR.maxZ - 4.2);
          this.startGateQueue();
        },
      },
      {
        label: '0c · Llegadas (Gran Canaria)',
        run: () => {
          airport();
          this.toArrivals();
          this.phase = 'arrivals';
          this.updateHud();
        },
      },
      {
        label: '1 · Estadio: cervezas',
        run: () => {
          stadium(false, 0, 0);
          this.startBeers();
        },
      },
      {
        label: '1b · Sale la banda',
        run: () => {
          stadium(false, 0, 0);
          this.startShow();
        },
      },
      {
        label: '2 · Al baño (1.ª)',
        run: () => {
          stadium(true, 0, 0);
          this.phase = 'toWc';
          this.updateHud();
        },
      },
      {
        label: '3 · Grabar el temón',
        run: () => {
          stadium(true, 1, 0);
          this.filmDone = false;
          // (Gas ya en la cola: al acabar de grabar se le ve ahí)
          this.gas.root.position.copy(this.tailSpot(new THREE.Vector3()));
          this.gas.root.rotation.y = this.walker.facing = Math.PI / 2;
          this.gasQueued = true;
          this.phase = 'film';
          this.startFilm();
        },
      },
      { label: '4 · Buscar a Azul (1.ª)', run: () => { stadium(true, 1, 1); this.startSeek(); } },
      {
        label: '5 · Las gafas (2.ª)',
        run: () => {
          stadium(true, 1, 1);
          this.gas.root.position.set(WC_X - 4.5, 0, Q_Z + 2.2);
          this.phase = 'toWc';
          this.updateHud();
        },
      },
      {
        label: '6 · Al baño (3.ª)',
        run: () => {
          stadium(true, 2, 2);
          this.phase = 'toWc';
          this.updateHud();
        },
      },
      { label: '7 · Buscar a Azul (3.ª)', run: () => { stadium(true, 3, 3); this.startSeek(); } },
      { label: '8 · Concierto (ritmo)', run: () => { stadium(true, 3, 3); this.startRhythm(); } },
      {
        label: '9 · Final con fuegos',
        run: () => {
          stadium(true, 3, 3);
          this.startRhythm();
          this.finishRhythm();
        },
      },
      { label: '✓ Completar capítulo', run: () => { stop(); this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.beers?.dispose();
    this.fito?.dispose();
    for (const p of this.posts) rigPost.delete(p);
    this.posts.length = 0;
    this.side?.dispose();
    this.rhythm?.dispose();
    this.filmUi?.remove();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}
