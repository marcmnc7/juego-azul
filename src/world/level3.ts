import * as THREE from 'three';
import { Surf, setSurface } from '../core/surfaces';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { steerTo, steerSpeed, faceTo, type SteerState } from '../core/steer';
import { CONCERT, SIDE } from '../data/story';
import { FITO_SONG, SONG_OF } from '../core/songs';
import { BeerRun, BEERS_NEED, Cabin3D, PeeAim3D } from './sideGames';
import { MARC_LOOK, castLook, AZUL_DIARIO } from '../data/characters';
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

type Phase = 'intro' | 'airport' | 'gateQueue' | 'arrivals' | 'beers' | 'show' | 'toWc' | 'wc' | 'glasses' | 'film' | 'seek' | 'found' | 'rhythm' | 'ending' | 'done';

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
// Terminal del aeropuerto, lejos del estadio (mismo mundo, otra zona): el pasillo largo de tiendas; al fondo, la
// sala de embarque, ancha, con las puertas 20 a 25; y, por un pasillito al final de la sala (detrás de las tiendas),
// el ala de las puertas 26 a 29. Cuál es la suya lo dicen las pantallas: nadie más
const AIR = { minX: 290, maxX: 302, minZ: -30, maxZ: 30 };
/** Línea de los mostradores de embarque (las puertas, 3,2 m más allá: la cristalera de la pista). */
const GZ = 43;
/** La sala de embarque, de lado a lado, entre el final del pasillo y la cristalera de las puertas. */
const LOUNGE = { minX: 254, maxX: 338, minZ: AIR.maxZ, maxZ: GZ + 3.2 };
/** El pasillito que sale del extremo de la sala, y el ala de las puertas 26 a 29. */
const CONN = { minX: 234, maxX: 254, minZ: 31, maxZ: 35.5 };
const PIER = { minX: 182, maxX: 234, minZ: 31, maxZ: GZ + 3.2 };
/** Las puertas (la de Azul, la 26: «Yo tengo 26D», del chat; al fondo del ala). */
const GATES: { n: number; x: number; to: string; code: string; time: string; status: string; plane?: number }[] = [
  { n: 20, x: 260, to: 'Sevilla', code: 'IB 0122', time: '16:50', status: 'CERRADO' },
  { n: 21, x: 273, to: 'Tenerife Norte', code: 'IB 1843', time: '16:55', status: 'CERRADO', plane: 0x1f4fa8 },
  { n: 22, x: 286, to: 'París-Orly', code: 'VY 8002', time: '17:05', status: 'EN HORA' },
  { n: 23, x: 306, to: 'Lisboa', code: 'TP 1027', time: '17:10', status: 'RETRASADO', plane: 0x2f7d4b },
  { n: 24, x: 319, to: 'Palma', code: 'UX 6075', time: '17:20', status: 'EN HORA' },
  { n: 25, x: 332, to: 'Bilbao', code: 'IB 0451', time: '17:35', status: 'EN HORA' },
  { n: 26, x: 188.5, to: 'Gran Canaria', code: 'VY 3112', time: '17:15', status: 'EMBARCANDO', plane: 0xf2c233 },
  { n: 27, x: 201.5, to: 'Lanzarote', code: 'FR 6324', time: '17:25', status: 'EN HORA' },
  { n: 28, x: 214.5, to: 'Roma', code: 'VY 6102', time: '17:40', status: 'EN HORA', plane: 0xd7263d },
  { n: 29, x: 227.5, to: 'Ámsterdam', code: 'KL 1704', time: '17:50', status: 'EN HORA' },
];
/** Hasta dónde se anda en la terminal: el pasillo y la sala de embarque, hasta los mostradores. */
const AIR_WALK = { minX: PIER.minX + 0.32, maxX: LOUNGE.maxX - 0.32, minZ: AIR.minZ - 2.65, maxZ: GZ };
const GATE_X = 188.5;
/** La cristalera de las puertas, y el finger de la 26: sube desde la puerta hasta la del avión. */
const GATE_WALL = GZ + 3.2;
const FINGER_LEN = 10.5;
const FINGER_RISE = 1.25;
/** Altura del suelo del finger a esa z (fuera del finger, 0). */
const fingerY = (z: number) => THREE.MathUtils.clamp((z - GATE_WALL) / FINGER_LEN, 0, 1) * FINGER_RISE;
/** Donde se enseña la tarjeta, delante del torno de la puerta 26. */
const GATE_SCAN = new THREE.Vector3(GATE_X, 0, GZ + 0.9);
/** Sitio k de la cola de embarque (por el pasillo de cintas del centro, desde el torno hacia atrás). */
const gateSlot = (k: number): [number, number] => [GATE_X, GZ - 0.2 - k * 0.85];
/** La papelera de la terminal, junto a un pilar: Azul puede tirar ahí su tabaco. */
const BIN_POS = new THREE.Vector3(290.8, 0, 8.6);
// (entre pilar y pilar: con un pilar delante, de «PRENSA» se leía «PR SA»)
const BURGERS: [number, number][] = [[302.6, -4.75], [289.4, 2.75], [302.6, 17.75]];
// Llegadas del aeropuerto de Gran Canaria, esa noche (otra zona del mismo mundo, también x > 100: luz de interior)
// La sala de recogida de equipajes (z < ARR_SPLIT) y, pasada la aduana, el vestíbulo de llegadas: gente esperando,
// alquiler de coches, tiendas, una cafetería en medio y la de Gas, «justo en la salida (dentro aún)»
const ARR = { minX: 370, maxX: 432, minZ: -34, maxZ: 24 };
const ARR_SPLIT = -14;
const ARR_WALK = { minX: ARR.minX + 0.4, maxX: ARR.maxX - 0.4, minZ: ARR.minZ + 0.6, maxZ: ARR.maxZ - 0.7 };
// (a 5 m de la pared del fondo: pegada a ella, la cámara no cabía detrás y se quedaba encima mirando al suelo)
const ARR_START = new THREE.Vector3(410, 0, -29);
const CAFE_GAS = new THREE.Vector3(414.2, 0, 18.4);
/** La otra cafetería, la de en medio (no es esa). */
const CAFE_OTHER = new THREE.Vector3(381, 0, 6);
/** Las dos cintas de equipaje (centro del óvalo). */
const BELTS: [number, number, string][] = [[386, -24, 'Cinta 1 · Barcelona'], [414, -24, 'Cinta 2 · Madrid']];
const BELT_LEN = 9, BELT_R = 1.5;
/** Punto del óvalo de una cinta a una distancia u (en metros) de su recorrido. */
function beltPoint(cx: number, cz: number, u: number, out: THREE.Vector3) {
  const P = 2 * BELT_LEN + 2 * Math.PI * BELT_R;
  u = ((u % P) + P) % P;
  const h = BELT_LEN / 2;
  if (u < BELT_LEN) return out.set(cx - h + u, 0, cz - BELT_R);
  u -= BELT_LEN;
  if (u < Math.PI * BELT_R) {
    const a = -Math.PI / 2 + u / BELT_R;
    return out.set(cx + h + Math.cos(a) * BELT_R, 0, cz + Math.sin(a) * BELT_R);
  }
  u -= Math.PI * BELT_R;
  if (u < BELT_LEN) return out.set(cx + h - u, 0, cz + BELT_R);
  u -= BELT_LEN;
  const a = Math.PI / 2 + u / BELT_R;
  return out.set(cx - h + Math.cos(a) * BELT_R, 0, cz + Math.sin(a) * BELT_R);
}
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
for (const c of [0xf4c430, 0xf2d24a, 0xf2c232, 0xf2c233, 0xd8c7a5, 0xe9eef5, 0xeceef1, 0x9c4a2a, 0x2e9e5b, 0x1b2a4a, 0x1f6f8b, 0xdedbd3]) setSurface(c, Surf.None);
setSurface(0x7d8087, Surf.Asphalt); // la pista del aeropuerto

/** Alguien del público con vida propia: hace cola, entra al baño, sale, o intenta colarse. */
interface Npc extends SteerState {
  p: Person;
  mode: 'free' | 'queue' | 'toWc' | 'closing' | 'leave' | 'tail';
  tx: number;
  tz: number;
  wc: number;
  walk: number;
  circle: Circle;
  /** Siguiente punto del camino (para no cortar por las cabinas al entrar o salir del WC). */
  next?: [number, number];
  /** Cómo espera en la cola: mirando el móvil, bailando lo que suena, impaciente o quieto. */
  mood?: 'phone' | 'dance' | 'impatient' | 'idle';
  /** Ya dentro de la cabina, de cara a la puerta mientras se cierra. */
  t?: number;
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
/**
 * Maleta de cabina de ruedas, de verdad: cuerpo, ruedas, asa extensible de dos varillas con su empuñadura. El punto
 * de giro, en las ruedas. Va en la raíz de quien la lleva (ver caseStep).
 */
function rollCase(color: number) {
  const g = new THREE.Group();
  const m = new Merger();
  m.add(G.rbox, color, 0, 0.31, 0, 0, 0, 0, 0.36, 0.5, 0.22);
  m.add(G.box, new THREE.Color(color).multiplyScalar(0.7).getHex(), 0, 0.31, 0.112, 0, 0, 0, 0.3, 0.42, 0.01); // bolsillo
  for (const x of [-0.13, 0.13]) {
    m.add(G.cyl, 0x111111, x, 0.04, -0.07, 0, 0, Math.PI / 2, 0.08, 0.04, 0.08); // rueda
    m.add(G.cyl, 0x9aa3ad, x * 0.75, 0.7, -0.085, 0, 0, 0, 0.018, 0.34, 0.018); // varilla del asa
  }
  m.add(G.box, 0x222222, 0, 0.87, -0.085, 0, 0, 0, 0.24, 0.035, 0.04); // empuñadura
  m.add(G.box, 0x222222, 0, 0.58, 0.0, 0, 0, 0, 0.12, 0.025, 0.05); // asa de arriba
  const mesh = m.mesh();
  mesh.userData.comicBent = true;
  g.add(mesh);
  return g;
}

/**
 * Le pone a alguien su maleta de ruedas (a su izquierda) y, al andar, la mano izquierda agarra la empuñadura de
 * verdad (IK del brazo, después de animar). `posts`: donde se apuntan esas funciones (se quitan al salir).
 */
function giveCase(p: Person, color: number, posts: ((dt: number) => void)[]) {
  const c = rollCase(color);
  c.position.set(0.38, 0, 0.02);
  p.root.add(c);
  p.root.userData.case = c;
  p.root.userData.caseK = 0;
  markProps(p);
  const r = p.rig;
  if (!r) return;
  const grip = new THREE.Vector3(), pole = new THREE.Vector3();
  const post = () => {
    if (!p.root.visible || !p.root.parent || (p.root.userData.caseK as number) < 0.35) return;
    const up = r.bones.get('LeftArm'), lo = r.bones.get('LeftForeArm'), hand = r.bones.get('LeftHand');
    if (!up || !lo || !hand) return;
    c.updateWorldMatrix(true, false);
    grip.set(0, 0.87, -0.085).applyMatrix4(c.matrixWorld);
    // (el codo hacia fuera y abajo)
    pole.set(0.6, 0.6, 0.1).applyMatrix4(p.root.matrixWorld);
    twoBone(up, lo, hand, grip, pole, Math.min(1, ((p.root.userData.caseK as number) - 0.35) / 0.4));
  };
  rigPost.add(post);
  posts.push(post);
}

/**
 * La maleta, cada fotograma (después de animar): andando, tirada de la empuñadura, detrás y algo a la izquierda,
 * inclinada hacia la mano, con el brazo izquierdo un poco atrás; quieto, de pie a su lado y el brazo suelto.
 */
function caseStep(p: Person, walking: boolean, dt: number) {
  const c = p.root.userData.case as THREE.Group | undefined;
  if (!c) return;
  const k = (p.root.userData.caseK = THREE.MathUtils.clamp((p.root.userData.caseK as number) + (walking ? dt : -dt) * 3, 0, 1));
  c.position.set(THREE.MathUtils.lerp(0.38, 0.21, k), 0, THREE.MathUtils.lerp(0.02, -0.52, k));
  c.rotation.x = 0.46 * k;
}

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
  /** El urinario, dentro de la cabina (en 3D: manda sobre la cámara mientras dura). */
  private side: PeeAim3D | null = null;
  /** La cabina por dentro (lejos de todo, bajo el estadio) y la cámara cuando se mira dentro. */
  private cabin!: Cabin3D;
  private cabinView: ((dt: number) => void) | null = null;
  /** Gas el primero de la cola: los demás, un sitio más atrás. */
  private qShift = 0;
  /** Gas en la cola del baño (como uno más), si puede ya entrar, y qué pasa al entrar y al salir. */
  private gasNpc: Npc | null = null;
  private gasMayEnter = false;
  /** La cabina a la que va Gas (para abrirle la puerta), y lo que se dice en la cola. */
  private gasDoor = -1;
  /** Gas girándose dentro de la cabina antes de cerrar (hacia dónde). */
  private gasTurn: number | null = null;
  private banterT = 4;
  private banterI = 0;
  private wcPlan: { hard: number; lines: Line[]; next: () => void } | null = null;
  /** Las gafas: cabinas ya miradas, y puertas que traquetean (averiadas u ocupadas). */
  private glassOpened = new Set<number>();
  /** La cabina de las gafas (ocupada hasta que se llama), si ya ha salido quien estaba, llamadas y a qué puerta se ha dicho algo. */
  private glassCab = -1;
  private glassOut = false;
  private knocks = 0;
  private doorSaid = -1;
  private wcShake = WC_Z.map(() => 0);
  private gateStage = 0;
  /** La cola de embarque de la puerta 26 y en qué punto está Azul. */
  private gateQ: GateNpc[] = [];
  private gateStep: 'none' | 'line' | 'scan' | 'ask' | 'pass' | 'finger' = 'none';
  /** Barajas y llegadas (fuera de la escena cuando se está en el estadio: así no se animan para nada). */
  private airGroup = new THREE.Group();
  private arrGroup = new THREE.Group();
  private glassMat = toon({ color: 0xbfe2f4, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false });
  private gateSeats: { x: number; z: number; face: number }[] = [];
  /** Las hojas de cristal de la puerta del finger de la 26. */
  private slideLeaves: { o: THREE.Object3D; x0: number; s: number }[] = [];
  private slideK = 0;
  /** Gente sentada en el aeropuerto (se les pone la pose cada fotograma). */
  private seated: Person[] = [];
  /** Gente quieta (mirando aviones) y gente de paso por la sala y el ala. */
  private idlers: Person[] = [];
  private wanderers: ({ p: Person; a: [number, number]; b: [number, number]; toB: boolean; wait: number; walk: number; c: Circle } & SteerState)[] = [];
  /** Maletas dando vueltas en las cintas de llegadas, y la gente de llegadas (para animarla). */
  private belts: { o: THREE.Mesh; cx: number; cz: number; u: number }[] = [];
  private arrPeople: Person[] = [];
  private arrSeated: Person[] = [];
  private arrWanderers: ({ p: Person; a: [number, number]; b: [number, number]; toB: boolean; wait: number; walk: number; c: Circle } & SteerState)[] = [];
  private otherCafeSaid = -99;
  /** Cuándo dijo Azul que una puerta no era la suya. */
  private wrongSaid = new Map<number, number>();
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

    this.azul = makePerson(AZUL_DIARIO);
    this.player = this.azul;
    this.walker = new Walker(this.player.root.position);
    this.player.root.position.set(0, 0, -18);
    sc.add(this.player.root);

    // Gas vuela por su cuenta. Lleva su camiseta de Fito, azul y roja
    this.gas = makePerson(castLook({ ...MARC_LOOK, shirt: 0x1f4fa8 }, 'gas_fito'));
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

    this.barman = makePerson(castLook({ skin: 0xc98e64, shirt: 0x111111, pants: 0x111111, hair: 0x1a1a1a, hairStyle: 'short', male: true }, 'camarero_fito'));
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
    sc.add(this.airGroup, this.arrGroup);
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
        phoneChat([CHATS.fitoEntradas, CHATS.burger], () => {
          this.busy = false;
          this.phase = 'airport';
          this.lost.reset();
          this.updateHud();
          later(() => bark('Azul', CONCERT.whichGate), 400);
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
   * Una puerta de embarque de la sala: su tramo de cristalera con vistas a la pista, la puerta al finger, la pantalla
   * con el número, el destino y cómo va, los mostradores y las filas de asientos. La 26 (`real`) además tiene su
   * personal, el torno de la tarjeta, la cola con su cinta, la gente esperando y el finger de verdad, por dentro.
   */
  private buildGate(m: Merger, g: (typeof GATES)[number], real: boolean) {
    const sc = this.airGroup;
    const cx = g.x;
    const Z = GATE_WALL;
    const X0 = cx - 6.5, X1 = cx + 6.5;
    const DW = 1.1; // media anchura de la puerta
    // Dintel y faldón de la cristalera
    m.add(G.box, 0xd8dde3, cx, 6.1, Z, 0, 0, 0, X1 - X0, 3.4, 0.3);
    m.add(G.box, 0x4a525c, cx, 0.12, Z, 0, 0, 0, X1 - X0, 0.24, 0.3);
    for (let x = X0; x <= X1 + 0.01; x += 1.625) if (Math.abs(x - cx) > DW + 0.1) m.add(G.box, 0x3f4750, x, 2.3, Z, 0, 0, 0, 0.09, 4.4, 0.16);
    m.add(G.box, 0x3f4750, cx, 3.0, Z, 0, 0, 0, X1 - X0, 0.08, 0.14);
    for (const s of [-1, 1]) m.add(G.box, 0x3f4750, cx + s * (DW + 0.05), 1.5, Z, 0, 0, 0, 0.14, 3, 0.2);
    const glass = this.glassMat;
    for (const [a, b] of [[X0, cx - DW], [cx + DW, X1]]) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 4.4), glass);
      gl.position.set((a + b) / 2, 2.3, Z + 0.02);
      gl.rotation.y = Math.PI;
      gl.userData.noCast = true;
      sc.add(gl);
    }
    // Pantalla de la puerta (letreros de Aena: amarillo sobre oscuro): número, destino, vuelo y cómo va
    const screen = comicTex((ctx, w, h) => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b2433';
      ctx.fillRect(8, 8, w - 16, h - 16);
      ctx.textAlign = 'left';
      inkText(ctx, String(g.n), 26, h * 0.32, 78, '#ffd23f');
      inkText(ctx, g.to, 150, h * 0.32, 56, PAPER, w - 170);
      const col = g.status === 'EMBARCANDO' ? '#4ade80' : g.status === 'CERRADO' ? '#f87171' : g.status === 'RETRASADO' ? '#fbbf24' : '#b9c6d6';
      inkText(ctx, g.status, 26, h * 0.74, 46, col);
      inkText(ctx, `${g.code} · ${g.time}`, 400, h * 0.74, 38, '#b9c6d6', w - 420);
    }, 720, 180);
    const scr = new THREE.Mesh(flatPlane(4.2, 1.05), new THREE.MeshBasicMaterial({ map: screen }));
    scr.position.set(cx, 3.72, Z - 0.21);
    scr.rotation.y = Math.PI;
    sc.add(scr);
    m.add(G.box, 0x1a1f28, cx, 3.72, Z - 0.13, 0, 0, 0, 4.36, 1.2, 0.08);
    // Mostradores de embarque a los dos lados de la puerta
    for (const s of [-1, 1]) {
      const x = cx + s * 3.4;
      m.add(G.rbox, 0x2b3a55, x, 0.55, GZ + 0.2, 0, 0, 0, 2.4, 1.1, 0.75);
      m.add(G.box, 0xe9ecef, x, 1.12, GZ + 0.2, 0, 0, 0, 2.5, 0.05, 0.85);
      m.add(G.box, 0x14181f, x - 0.5, 1.33, GZ + 0.32, -0.25, 0, 0, 0.46, 0.32, 0.03); // monitor
      m.add(G.box, 0xd7263d, x, 0.62, GZ - 0.18, 0, 0, 0, 2.3, 0.2, 0.02);
      this.colliders.push({ minX: x - 1.3, maxX: x + 1.3, minZ: GZ - 0.2, maxZ: GZ + 0.6, low: true });
    }
    // Entre mostrador y mostrador, sin torno, una cinta: por ahí no se pasa
    if (!real) {
      m.add(G.cyl, 0x8f98a4, cx - 2.1, 0.48, GZ + 0.2, 0, 0, 0, 0.06, 0.96, 0.06);
      m.add(G.cyl, 0x8f98a4, cx + 2.1, 0.48, GZ + 0.2, 0, 0, 0, 0.06, 0.96, 0.06);
      m.add(G.box, 0xd7263d, cx, 0.88, GZ + 0.2, 0, 0, 0, 4.2, 0.06, 0.02);
      this.colliders.push({ minX: cx - 2.2, maxX: cx + 2.2, minZ: GZ, maxZ: GZ + 0.4, low: true });
    }
    // Filas de asientos de la zona de embarque, mirando al pasillo de la puerta
    for (const s of [-1, 1])
      for (let k = 0; k < 2; k++) {
        const x = cx + s * 4.7, z0 = GZ - 10 + k * 3.2;
        // (la viga justo debajo de los asientos: si no, parecían flotar)
        m.add(G.box, 0x4a525c, x, 0.395, z0, 0, 0, 0, 0.4, 0.05, 2.4);
        // Las patas: dos pies de acero con su placa en el suelo
        for (const dz of [-0.85, 0.85]) {
          m.add(G.box, 0x9aa3ad, x, 0.2, z0 + dz, 0, 0, 0, 0.08, 0.4, 0.08);
          m.add(G.box, 0x9aa3ad, x, 0.015, z0 + dz, 0, 0, 0, 0.46, 0.03, 0.12);
        }
        for (let j = 0; j < 4; j++) {
          m.add(G.rbox, 0x2b3a55, x, 0.47, z0 - 0.9 + j * 0.6, 0, 0, 0, 0.5, 0.1, 0.5);
          m.add(G.rbox, 0x2b3a55, x + s * 0.22, 0.75, z0 - 0.9 + j * 0.6, 0, 0, 0, 0.08, 0.5, 0.5);
        }
        this.colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z0 - 1.25, maxZ: z0 + 1.25 });
        this.gateSeats.push({ x, z: z0 - 0.9 + ((k + s + 4) % 4) * 0.6, face: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    // Fuera: el finger (en las demás, recogido y con su puerta cerrada) y, en algunas, el avión
    const av = new Merger();
    if (!real) {
      // La puerta de la terminal, cerrada: dos hojas opacas con su ventanuco
      for (const s of [-1, 1]) {
        m.add(G.box, 0x8f98a4, cx + s * DW * 0.5, 1.5, Z - 0.02, 0, 0, 0, DW - 0.04, 2.96, 0.06);
        m.add(G.box, 0x3a4250, cx + s * DW * 0.5, 2.1, Z - 0.06, 0, 0, 0, 0.4, 0.6, 0.02);
      }
      // Finger recogido, corto, junto a la cristalera
      av.add(G.box, 0xdfe3e9, cx, 2.0, Z + 3.2, 0, 0, 0, 2.7, 2.8, 6);
      av.add(G.box, 0x3a4250, cx, 2.3, Z + 3.2, 0, 0, 0, 2.74, 0.5, 4.6);
      av.add(G.cyl, 0x8f98a4, cx, 0.3, Z + 5.4, 0, 0, 0, 0.45, 0.6, 0.45);
      av.add(G.cyl, 0x8f98a4, cx, 1.0, Z + 5.4, 0, 0, 0, 0.25, 1.4, 0.25);
    } else this.buildFinger(m, av, cx);
    if (g.plane !== undefined) this.buildPlane(av, cx, g.plane);
    const avm = av.mesh();
    avm.userData.noCam = true;
    sc.add(avm);
    if (!real) return;

    // ---- La 26: personal, torno, cola y gente ----
    for (const s of [-1, 1]) {
      const x = cx + s * 3.4;
      const staff = makePerson(castLook({ skin: s < 0 ? 0xe8b894 : 0xd9a27c, shirt: 0x1f2d4d, pants: 0x1f2d4d, hair: s < 0 ? 0x2b1d14 : 0x5a3a22, hairStyle: s < 0 ? 'short' : 'straight', male: s < 0 }, s < 0 ? 'agente_aeropuerto_h' : 'agente_aeropuerto_m'));
      // (el de la izquierda, junto al torno: es quien pide la tarjeta; mira a la cola)
      staff.root.position.set(s < 0 ? cx - 1.55 : x + 0.2, 0, GZ + (s < 0 ? 1.05 : 1.0));
      staff.root.rotation.y = s < 0 ? Math.PI * 0.85 : Math.PI;
      sc.add(staff.root);
      if (s < 0) this.agent = staff;
    }
    // Torno de la tarjeta de embarque: dos cuerpos y sus aletas de cristal, que se recogen al pasar la tarjeta
    const flapMat = toon({ color: 0xbfe2f4, transparent: true, opacity: 0.6, roughness: 0.1 });
    for (const s of [-1, 1]) {
      m.add(G.rbox, 0x8f98a4, cx + s * 0.86, 0.5, GZ + 1.6, 0, 0, 0, 0.26, 1, 0.9);
      m.add(G.box, 0x4ade80, cx + s * 0.86, 1.02, GZ + 1.35, 0, 0, 0, 0.18, 0.02, 0.18);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.02).translate(-s * 0.35, 0, 0), flapMat);
      f.position.set(cx + s * 0.73, 0.62, GZ + 1.6);
      f.userData.comicBent = true;
      f.userData.noCast = true;
      sc.add(f);
      this.flaps.push(f);
    }
    // Mamparas de cristal entre el torno y los mostradores: no se pasa sin tarjeta
    for (const s of [-1, 1]) {
      const a = cx + s * 0.99, b = cx + s * 2.1;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(b - a), 1.1), glass);
      gl.position.set((a + b) / 2, 0.55, GZ + 1.6);
      gl.userData.noCast = true;
      sc.add(gl);
      m.add(G.box, 0x8f98a4, (a + b) / 2, 1.1, GZ + 1.6, 0, 0, 0, Math.abs(b - a), 0.04, 0.05);
    }
    // La cola: postes con cinta que hacen un pasillo en el centro, hasta el torno
    for (const s of [-1, 1])
      for (let k = 0; k < 4; k++) {
        const z = GZ - 8 + k * 2.1;
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
      giveCase(p, [0x222222, 0xd7263d, 0x1f5fbf][i], this.posts);
      sc.add(p.root);
      const circle = { x, z, r: 0.32 };
      this.gateQ.push({ p, walk: 0, state: 'line', t: 0, circle });
      this.gateCircles.push(circle);
    });
  }

  /**
   * El finger de la 26, de verdad: la puerta de cristal de la terminal (se abre sola al acercarse alguien) y el túnel,
   * hueco, que sube hasta la puerta del avión: suelo de moqueta, paredes con su ventana corrida, techo con luces y
   * la cabina del final pegada al avión. Por fuera, el mismo túnel sobre su pata.
   */
  private buildFinger(m: Merger, av: Merger, cx: number) {
    const sc = this.airGroup;
    const Z = GATE_WALL;
    const a = Math.atan2(FINGER_RISE, FINGER_LEN);
    const L = Math.hypot(FINGER_LEN, FINGER_RISE);
    const zm = Z + FINGER_LEN / 2, ym = FINGER_RISE / 2;
    const W = 2.4, H = 2.6;
    // (piezas inclinadas: el suelo empieza a ras de la terminal y acaba a la altura de la puerta del avión)
    const fm = new Merger(false);
    fm.add(G.box, 0x4b5868, cx, ym - 0.07, zm, -a, 0, 0, W + 0.3, 0.14, L + 0.1); // suelo (moqueta)
    for (const s of [-1, 1]) {
      // Pared: zócalo, ventana corrida (cristal oscuro) y franja de arriba
      fm.add(G.box, 0xdfe3e9, cx + s * (W / 2 + 0.07), ym + 0.5, zm, -a, 0, 0, 0.14, 1.0, L);
      fm.add(G.box, 0x2a3240, cx + s * (W / 2 + 0.07), ym + 1.45, zm, -a, 0, 0, 0.1, 0.9, L);
      fm.add(G.box, 0xdfe3e9, cx + s * (W / 2 + 0.07), ym + 2.25, zm, -a, 0, 0, 0.14, 0.7, L);
      // Pasamanos por dentro
      fm.add(G.box, 0x9aa3ad, cx + s * (W / 2 - 0.05), ym + 0.95, zm, -a, 0, 0, 0.05, 0.05, L - 0.4);
    }
    fm.add(G.box, 0xdfe3e9, cx, ym + H + 0.07, zm, -a, 0, 0, W + 0.3, 0.14, L); // techo
    // Fuelles del acordeón cada tramo (marcos un poco más gruesos)
    for (let k = 0; k <= 4; k++) {
      const z = Z + 0.3 + (k * (FINGER_LEN - 0.6)) / 4;
      const y = fingerY(z);
      // (marco hueco: arriba y a los lados; por dentro se ve el túnel)
      fm.add(G.box, 0xc9ced6, cx, y + H + 0.12, z, -a, 0, 0, W + 0.42, 0.18, 0.16);
      for (const sx of [-1, 1]) fm.add(G.box, 0xc9ced6, cx + sx * (W / 2 + 0.12), y + H / 2, z, -a, 0, 0, 0.18, H + 0.4, 0.16);
    }
    // Las luces del techo (no iluminan: se ven encendidas)
    const lights = new Merger(false);
    for (let k = 0; k < 5; k++) {
      const z = Z + 1 + k * 2;
      lights.add(G.box, 0xfffbe8, cx, fingerY(z) + H - 0.03, z, -a, 0, 0, 0.9, 0.03, 0.5);
    }
    const lm = new THREE.Mesh(lights.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    // La cabina del final, girada hacia el avión, y la pata con sus ruedas
    const ze = Z + FINGER_LEN;
    fm.add(G.box, 0xdfe3e9, cx + 0.4, FINGER_RISE + H / 2, ze + 0.9, 0, 0, 0, W + 1.2, H + 0.3, 1.8);
    fm.add(G.box, 0x3a4250, cx + 0.4, FINGER_RISE + H / 2, ze - 0.02, 0, 0, 0, W + 1.0, H - 0.2, 0.05);
    av.add(G.cyl, 0x8f98a4, cx, FINGER_RISE / 2 + 0.2, ze - 1.2, 0, 0, 0, 0.32, FINGER_RISE + 0.4, 0.32);
    av.add(G.box, 0x4a525c, cx, 0.35, ze - 1.2, 0, 0, 0, 2.2, 0.3, 0.6);
    for (const s of [-1, 1]) av.add(G.cyl, 0x22262c, cx + s * 0.9, 0.3, ze - 1.2, 0, 0, Math.PI / 2, 0.55, 0.3, 0.55);
    const fmesh = fm.mesh();
    for (const o of [fmesh, lm]) {
      o.userData.comicBent = true;
      o.userData.noCam = true;
      sc.add(o);
    }
    // Lo de dentro, al fondo: la puerta del avión abierta y luz
    const end = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9), new THREE.MeshBasicMaterial({ color: 0xfdfbf2 }));
    end.position.set(cx, FINGER_RISE + 0.95, ze - 0.06);
    end.rotation.y = Math.PI;
    sc.add(end);
    // La puerta de la terminal: dos hojas de cristal que se apartan a los lados cuando se acerca alguien
    const leafMat = toon({ color: 0xbfe2f4, transparent: true, opacity: 0.38, roughness: 0.05, depthWrite: false });
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.9, 0.03), leafMat);
      pane.userData.noCast = true;
      const frame = new Merger(false);
      frame.add(G.box, 0x5a6470, 0, 1.44, 0, 0, 0, 0, 1.1, 0.05, 0.05);
      frame.add(G.box, 0x5a6470, 0, -1.44, 0, 0, 0, 0, 1.1, 0.05, 0.05);
      frame.add(G.box, 0x5a6470, s * 0.52, 0, 0, 0, 0, 0, 0.05, 2.9, 0.05);
      frame.add(G.box, 0xc0c4cc, -s * 0.46, 0, -0.04, 0, 0, 0, 0.04, 0.5, 0.04); // tirador
      leaf.add(pane, frame.mesh());
      leaf.position.set(cx + s * 0.55, 1.47, Z - 0.05);
      leaf.userData.comicBent = true;
      leaf.userData.noCam = true;
      sc.add(leaf);
      this.slideLeaves.push({ o: leaf, x0: cx + s * 0.55, s });
    }
    void m;
  }

  /**
   * Un avión aparcado de morro hacia la terminal (fuselaje a lo largo de z, morro hacia -z), con la puerta delantera
   * a la izquierda, del lado del finger: fuselaje, ventanillas, cabina, alas con sus motores, cola y tren.
   */
  private buildPlane(av: Merger, cx: number, tail: number) {
    const x = cx + 3.35, z0 = GATE_WALL + 8.8, y = 2.45;
    av.add(G.capsule, 0xf6f7f8, x, y, z0 + 10.5, Math.PI / 2, 0, 0, 3.7, 19, 3.7);
    // Ventanillas a los dos lados y la franja de color
    for (const s of [-1, 1]) {
      for (let i = 0; i < 22; i++) av.add(G.rbox, 0x1b2430, x + s * 1.8, y + 0.42, z0 + 4 + i * 0.75, 0, 0, 0, 0.06, 0.4, 0.28);
      av.add(G.box, tail, x + s * 1.82, y - 0.35, z0 + 11, 0, 0, 0, 0.05, 0.22, 18);
    }
    // La puerta delantera (lado del finger) y las ventanas de la cabina
    av.add(G.box, 0x9aa3ad, x - 1.84, y - 0.2, GATE_WALL + FINGER_LEN + 0.2, 0, 0, 0, 0.05, 1.9, 1.0);
    av.add(G.box, 0x1b2430, x, y + 0.75, z0 + 1.3, -0.5, 0, 0, 2.2, 0.35, 0.6);
    // Alas, motores, estabilizadores y deriva
    for (const s of [-1, 1]) {
      av.add(G.box, 0xdfe3e9, x + s * 5.2, y - 0.6, z0 + 11.5, 0, s * 0.35, 0, 8.5, 0.26, 2.8);
      av.add(G.cyl, 0xc9ced6, x + s * 3.6, y - 1.25, z0 + 10.2, Math.PI / 2, 0, 0, 1.3, 3, 1.3);
      av.add(G.cyl, 0x2a2e36, x + s * 3.6, y - 1.25, z0 + 8.68, Math.PI / 2, 0, 0, 1.1, 0.06, 1.1);
      av.add(G.box, 0xdfe3e9, x + s * 2.4, y + 0.6, z0 + 19.6, 0, s * 0.3, 0, 3.6, 0.2, 1.6);
    }
    av.add(G.box, tail, x, y + 2.9, z0 + 19.4, -0.45, 0, 0, 0.3, 4.6, 2.6);
    av.add(G.cyl, 0x22262c, x, 0.3, z0 + 2.5, 0, 0, Math.PI / 2, 0.6, 0.3, 0.6);
    for (const s of [-1, 1]) av.add(G.cyl, 0x22262c, x + s * 1.4, 0.35, z0 + 12.5, 0, 0, Math.PI / 2, 0.7, 0.5, 0.7);
  }

  /**
   * Terminal de Barajas: el pasillo largo con sus tiendas (el burger del «NUNCA más» fue el de Gas, en Barcelona) y, al
   * fondo, la sala de embarque, ancha, con seis puertas a destinos distintos, tiendas en la pared de atrás y pantallas
   * de salidas: cuál es la puerta de Azul no lo dice nadie, lo dicen las pantallas.
   */
  private buildAirport() {
    const sc = this.airGroup;
    const A = AIR;
    const cx = (A.minX + A.maxX) / 2;
    const Lg = LOUNGE;
    const lcx = (Lg.minX + Lg.maxX) / 2;
    const paving = toon({ color: 0xe9ecef, roughness: 0.25, metalness: 0.05, surf: Surf.Paving });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.maxX - A.minX + 2, A.maxZ - A.minZ + 3).rotateX(-Math.PI / 2), paving);
    floor.position.set(cx, 0.01, (A.minZ + A.maxZ) / 2 - 1.5);
    floor.userData.noCast = true;
    sc.add(floor);
    const lfloor = new THREE.Mesh(new THREE.PlaneGeometry(Lg.maxX - Lg.minX + 1, Lg.maxZ - Lg.minZ + 0.6).rotateX(-Math.PI / 2), paving);
    lfloor.position.set(lcx, 0.011, (Lg.minZ + Lg.maxZ) / 2);
    lfloor.userData.noCast = true;
    sc.add(lfloor);
    // El ala de las puertas 26 a 29 y el pasillito que llega a ella desde la sala
    for (const R of [PIER, CONN]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(R.maxX - R.minX + 0.4, R.maxZ - R.minZ + 0.3).rotateX(-Math.PI / 2), paving);
      f.position.set((R.minX + R.maxX) / 2, 0.012, (R.minZ + R.maxZ) / 2);
      f.userData.noCast = true;
      sc.add(f);
    }
    const m = new Merger();
    // Cristaleras a los dos lados del pasillo, en tramos de 3 m: así se comban a mano alzada con la cubierta y no se
    // abre una rendija arriba (de una pieza de 66 m solo se movían las esquinas)
    for (const x of [A.minX - 0.15, A.maxX + 0.15]) {
      for (let z = A.minZ - 3; z < A.maxZ; z += 3) {
        m.add(G.box, 0xb4d4ea, x, 3.9, z + 1.5, 0, 0, 0, 0.2, 7.8, 3.02);
        for (const y of [2.4, 4.6]) m.add(G.box, 0x5a6470, x, y, z + 1.5, 0, 0, 0, 0.26, 0.08, 3.02);
      }
      for (let z = A.minZ - 2; z <= A.maxZ; z += 3) m.add(G.box, 0x5a6470, x, 3.9, z, 0, 0, 0, 0.3, 7.8, 0.15);
    }
    // Lamas finas de bambú, una al lado de la otra, por debajo de la cubierta (sin sombra: si no, rayaban el suelo)
    const ceil = new Merger();
    for (let z = A.minZ - 3; z <= A.maxZ; z += 0.42) ceil.add(G.box, 0xd9b26a, cx, 6.62 + Math.sin(z * 0.3) * 0.35, z, 0, 0, 0, A.maxX - A.minX + 0.6, 0.06, 0.24);
    for (let x = A.minX + 2.6; x < A.maxX - 2; x += 3.2) for (let z = A.minZ - 2; z <= A.maxZ - 2; z += 4) ceil.add(G.box, 0xb8905a, x, 6.72 + Math.sin(z * 0.3) * 0.35, z, 0, 0, 0, 0.1, 0.1, 4.05);
    // En la sala, las lamas van de lado a lado (a lo ancho), a la altura de la cubierta del pasillo
    for (let z = Lg.minZ + 0.2; z <= Lg.maxZ; z += 0.42) ceil.add(G.box, 0xd9b26a, lcx, 6.9, z, 0, 0, 0, Lg.maxX - Lg.minX + 0.6, 0.06, 0.24);
    for (let x = Lg.minX + 2; x < Lg.maxX; x += 4) ceil.add(G.box, 0xb8905a, x, 7.0, (Lg.minZ + Lg.maxZ) / 2, 0, 0, 0, 0.1, 0.1, Lg.maxZ - Lg.minZ);
    for (let z = PIER.minZ + 0.2; z <= PIER.maxZ; z += 0.42) ceil.add(G.box, 0xd9b26a, (PIER.minX + PIER.maxX) / 2, 6.9, z, 0, 0, 0, PIER.maxX - PIER.minX + 0.6, 0.06, 0.24);
    const cm = ceil.mesh();
    cm.userData.noCast = true;
    sc.add(cm);
    // La cubierta: una sola pieza ondulada que cierra el pasillo, con lucernarios redondos, como en la T4; la de la sala,
    // plana y algo más alta
    const roofMat = toon({ color: 0xc9a468, roughness: 0.8, side: THREE.DoubleSide });
    {
      const W = A.maxX - A.minX + 1.4, D = A.maxZ - A.minZ + 3.5;
      const roof = new THREE.PlaneGeometry(W, D, 6, 90).rotateX(Math.PI / 2);
      const rp = roof.attributes.position;
      const z0 = (A.minZ + A.maxZ) / 2 - 1.75;
      for (let i = 0; i < rp.count; i++) rp.setY(i, 6.86 + Math.sin((rp.getZ(i) + z0) * 0.3) * 0.35);
      roof.computeVertexNormals();
      const rm = new THREE.Mesh(roof, roofMat);
      rm.position.set(cx, 0, z0);
      rm.userData.noCast = true;
      sc.add(rm);
      const lroof = new THREE.Mesh(new THREE.PlaneGeometry(Lg.maxX - Lg.minX + 1.4, Lg.maxZ - Lg.minZ + 1).rotateX(Math.PI / 2), roofMat);
      lroof.position.set(lcx, 7.15, (Lg.minZ + Lg.maxZ) / 2);
      lroof.userData.noCast = true;
      sc.add(lroof);
      const proof = new THREE.Mesh(new THREE.PlaneGeometry(PIER.maxX - PIER.minX + 1.4, PIER.maxZ - PIER.minZ + 1).rotateX(Math.PI / 2), roofMat);
      proof.position.set((PIER.minX + PIER.maxX) / 2, 7.15, (PIER.minZ + PIER.maxZ) / 2);
      proof.userData.noCast = true;
      sc.add(proof);
      // (el pasillito, bajo: techo plano a 3,6 m)
      const croof = new THREE.Mesh(new THREE.PlaneGeometry(CONN.maxX - CONN.minX + 0.6, CONN.maxZ - CONN.minZ + 0.4).rotateX(Math.PI / 2), toon({ color: 0xe9ecef, side: THREE.DoubleSide }));
      croof.position.set((CONN.minX + CONN.maxX) / 2, 3.6, (CONN.minZ + CONN.maxZ) / 2);
      croof.userData.noCast = true;
      sc.add(croof);
      // (el disco de cielo y su aro, sin doblar los dos: si no, el aro se separaba del disco)
      const skyMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, fog: false, toneMapped: false });
      const ringMat = toon({ color: 0xf2f2ee, roughness: 0.5 });
      const skylight = (x: number, y: number, z: number) => {
        const sk = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20).rotateX(Math.PI / 2), skyMat);
        sk.position.set(x, y + 0.02, z);
        sk.userData.comicBent = true;
        sc.add(sk);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.05, 6, 22).rotateX(Math.PI / 2), ringMat);
        ring.position.set(x, y, z);
        ring.userData.comicBent = true;
        ring.userData.noCast = true;
        sc.add(ring);
      };
      for (let z = A.minZ - 1; z <= A.maxZ - 3; z += 7.5) for (const x of [cx - 3, cx + 3]) skylight(x, 6.5 + Math.sin(z * 0.3) * 0.35, z);
      for (let x = Lg.minX + 7; x < Lg.maxX - 4; x += 12) skylight(x, 6.82, (Lg.minZ + Lg.maxZ) / 2 - 1);
      for (let x = PIER.minX + 7; x < PIER.maxX - 4; x += 12) skylight(x, 6.82, (PIER.minZ + PIER.maxZ) / 2 - 1);
    }
    m.add(G.box, 0xd8dde3, cx, 3.9, A.minZ - 3.2, 0, 0, 0, A.maxX - A.minX + 0.6, 7.8, 0.3);
    // La sala: la pared de atrás (a los lados de la boca del pasillo) con sus tiendas, y cristaleras en los extremos
    for (const [x0, x1] of [[Lg.minX, A.minX - 0.15], [A.maxX + 0.15, Lg.maxX]]) {
      for (let x = x0; x < x1 - 0.01; x += 3) {
        const xb = Math.min(x1, x + 3);
        m.add(G.box, 0xd8dde3, (x + xb) / 2, 3.9, Lg.minZ - 0.15, 0, 0, 0, xb - x + 0.02, 7.8, 0.3);
      }
    }
    // (el extremo de la sala que da al pasillito tiene su hueco, con dintel encima)
    m.add(G.box, 0xd8dde3, Lg.minX - 0.15, 5.7, (CONN.minZ + CONN.maxZ) / 2, 0, 0, 0, 0.3, 4.2, CONN.maxZ - CONN.minZ + 0.02);
    m.add(G.box, 0xd8dde3, Lg.minX - 0.15, 3.9, (Lg.minZ + CONN.minZ) / 2, 0, 0, 0, 0.3, 7.8, CONN.minZ - Lg.minZ + 0.02);
    for (const x of [Lg.minX - 0.15, Lg.maxX + 0.15]) {
      for (let z = x < Lg.minX ? CONN.maxZ : Lg.minZ; z < Lg.maxZ - 0.01; z += 3) {
        const zb = Math.min(Lg.maxZ, z + 3);
        m.add(G.box, 0xb4d4ea, x, 3.9, (z + zb) / 2, 0, 0, 0, 0.2, 7.8, zb - z + 0.02);
        for (const y of [2.4, 4.6]) m.add(G.box, 0x5a6470, x, y, (z + zb) / 2, 0, 0, 0, 0.26, 0.08, zb - z + 0.02);
      }
    }
    // El ala: pared de atrás, cristalera del fondo, y la pared que la separa de la sala (con el hueco del pasillito)
    for (let x = PIER.minX; x < PIER.maxX - 0.01; x += 3) {
      const xb = Math.min(PIER.maxX, x + 3);
      m.add(G.box, 0xd8dde3, (x + xb) / 2, 3.9, PIER.minZ - 0.15, 0, 0, 0, xb - x + 0.02, 7.8, 0.3);
    }
    for (let z = PIER.minZ; z < PIER.maxZ - 0.01; z += 3) {
      const zb = Math.min(PIER.maxZ, z + 3);
      m.add(G.box, 0xb4d4ea, PIER.minX - 0.15, 3.9, (z + zb) / 2, 0, 0, 0, 0.2, 7.8, zb - z + 0.02);
      for (const y of [2.4, 4.6]) m.add(G.box, 0x5a6470, PIER.minX - 0.15, y, (z + zb) / 2, 0, 0, 0, 0.26, 0.08, zb - z + 0.02);
      if (z >= CONN.maxZ - 0.01) m.add(G.box, 0xd8dde3, PIER.maxX + 0.15, 3.9, (z + zb) / 2, 0, 0, 0, 0.3, 7.8, zb - z + 0.02);
    }
    m.add(G.box, 0xd8dde3, PIER.maxX + 0.15, 3.9, (CONN.maxZ + 37) / 2, 0, 0, 0, 0.3, 7.8, 37 - CONN.maxZ + 0.02);
    m.add(G.box, 0xd8dde3, PIER.maxX + 0.15, 5.7, (CONN.minZ + CONN.maxZ) / 2, 0, 0, 0, 0.3, 4.2, CONN.maxZ - CONN.minZ + 0.02);
    // El pasillito: paredes con carteles de Canarias y de la T4, y su techo bajo
    for (const z of [CONN.minZ - 0.12, CONN.maxZ + 0.12])
      for (let x = CONN.minX; x < CONN.maxX - 0.01; x += 3) {
        const xb = Math.min(CONN.maxX, x + 3);
        m.add(G.box, 0xd8dde3, (x + xb) / 2, 1.8, z, 0, 0, 0, xb - x + 0.02, 3.6, 0.24);
      }
    // Entre puerta y puerta, el mismo tramo de cristalera hasta el siguiente (la de la pista, de lado a lado)
    const covered = GATES.map((g) => [g.x - 6.5, g.x + 6.5] as const);
    for (let x = Lg.minX; x < Lg.maxX - 0.01; x += 1.625) {
      const xb = Math.min(Lg.maxX, x + 1.625);
      if (covered.some(([a, b]) => x >= a - 0.01 && xb <= b + 0.01)) continue;
      m.add(G.box, 0xd8dde3, (x + xb) / 2, 6.1, GATE_WALL, 0, 0, 0, xb - x + 0.02, 3.4, 0.3);
      m.add(G.box, 0x4a525c, (x + xb) / 2, 0.12, GATE_WALL, 0, 0, 0, xb - x + 0.02, 0.24, 0.3);
      m.add(G.box, 0x3f4750, x, 2.3, GATE_WALL, 0, 0, 0, 0.09, 4.4, 0.16);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(xb - x, 4.4), this.glassMat);
      gl.position.set((x + xb) / 2, 2.3, GATE_WALL + 0.02);
      gl.rotation.y = Math.PI;
      gl.userData.noCast = true;
      sc.add(gl);
    }
    this.colliders.push(
      // Pasillo: cristaleras hasta la sala y muro del fondo
      { minX: A.minX - 0.4, maxX: A.minX - 0.02, minZ: A.minZ - 3.4, maxZ: A.maxZ },
      { minX: A.maxX + 0.02, maxX: A.maxX + 0.4, minZ: A.minZ - 3.4, maxZ: A.maxZ },
      { minX: A.minX - 0.4, maxX: A.maxX + 0.4, minZ: A.minZ - 3.4, maxZ: A.minZ - 3.04 },
      // Sala: pared de atrás a los lados del pasillo, extremos y cristalera de las puertas
      { minX: Lg.minX - 0.4, maxX: A.minX - 0.02, minZ: Lg.minZ - 0.4, maxZ: Lg.minZ + 0.02 },
      { minX: A.maxX + 0.02, maxX: Lg.maxX + 0.4, minZ: Lg.minZ - 0.4, maxZ: Lg.minZ + 0.02 },
      { minX: Lg.minX - 0.4, maxX: Lg.minX - 0.02, minZ: CONN.maxZ, maxZ: Lg.maxZ + 0.4 },
      { minX: Lg.minX - 0.4, maxX: Lg.minX - 0.02, minZ: Lg.minZ - 0.4, maxZ: CONN.minZ },
      // Pasillito y ala
      { minX: CONN.minX, maxX: CONN.maxX, minZ: CONN.minZ - 0.5, maxZ: CONN.minZ },
      { minX: CONN.minX, maxX: CONN.maxX, minZ: CONN.maxZ, maxZ: CONN.maxZ + 0.5 },
      { minX: PIER.minX - 0.4, maxX: PIER.maxX + 0.4, minZ: PIER.minZ - 0.5, maxZ: PIER.minZ },
      { minX: PIER.minX - 0.4, maxX: PIER.minX - 0.02, minZ: PIER.minZ - 0.4, maxZ: PIER.maxZ + 0.4 },
      { minX: PIER.maxX + 0.02, maxX: PIER.maxX + 0.4, minZ: CONN.maxZ, maxZ: PIER.maxZ + 0.4 },
      { minX: Lg.maxX + 0.02, maxX: Lg.maxX + 0.4, minZ: Lg.minZ - 0.4, maxZ: Lg.maxZ + 0.4 },
    );
    // Muros del fondo como obstáculo para la cámara (si no, se sale de la terminal y no se ve nada)
    this.colliders.push({ minX: A.minX - 1, maxX: A.maxX + 1, minZ: A.minZ - 7, maxZ: A.minZ - 3.1 }, { minX: PIER.minX - 1, maxX: Lg.maxX + 1, minZ: GATE_WALL - 0.1, maxZ: GATE_WALL + 4 });
    for (const g of GATES) this.buildGate(m, g, g.n === 26);
    // Fuera, la pista: asfalto de lado a lado de la sala, con sus líneas amarillas de guiado hasta cada puerta
    {
      const ap = new Merger();
      ap.add(G.box, 0x7d8087, lcx, -0.03, GATE_WALL + 40, 0, 0, 0, Lg.maxX - Lg.minX + 160, 0.1, 80);
      for (let i = -12; i < 13; i++) ap.add(G.box, 0xf2d24a, lcx + i * 8, 0.03, GATE_WALL + 7, 0, 0, 0, 5, 0.01, 0.16);
      for (const g of GATES) ap.add(G.box, 0xf2d24a, g.x + 3.35, 0.03, GATE_WALL + 20, 0, 0, 0, 0.16, 0.01, 22);
      const apm = ap.mesh();
      apm.userData.noCam = true;
      apm.userData.noCast = true;
      sc.add(apm);
    }
    // Barajas T4: pilares en «Y» de acero pintado que van del amarillo al rojo a lo largo de la terminal
    const pillar = (x: number, z: number, col: number) => {
      setSurface(col, Surf.Metal);
      m.add(G.cyl, col, x, 2.2, z, 0, 0, 0, 0.5, 4.4, 0.5);
      m.add(G.cyl, col, x - 0.6, 5.4, z, 0, 0, 0.45, 0.3, 2.6, 0.3);
      m.add(G.cyl, col, x + 0.6, 5.4, z, 0, 0, -0.45, 0.3, 2.6, 0.3);
      this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    };
    for (let z = A.minZ - 1, k = 0; z <= A.maxZ - 3; z += 7.5, k++) {
      const col = new THREE.Color(0xf2c231).lerp(new THREE.Color(0xd7263d), k / 8).getHex();
      for (const x of [A.minX + 1.2, A.maxX - 1.2]) pillar(x, z, col);
    }
    // (en la sala, una fila de pilares rojos entre las puertas, lejos de las colas)
    for (const x of [266.5, 279.5, 296, 312.5, 325.5]) pillar(x, 34.5, 0xd7263d);
    for (const x of [195, 208, 221]) pillar(x, 33.6, 0xd7263d);
    // Bancos de espera del pasillo
    for (const z of [-27.25, -19.75, -12.25, 10.25, 25.25]) {
      for (const x of [A.minX + 0.6, A.maxX - 0.6]) {
        m.add(G.box, 0x4a5a6c, x, 0.45, z, 0, 0, 0, 0.6, 0.1, 3);
        m.add(G.box, 0x4a5a6c, x + (x < cx ? -0.25 : 0.25), 0.75, z, 0, 0, 0, 0.1, 0.6, 3);
        for (const dz of [-1.2, 1.2]) m.add(G.box, 0x9aa3ad, x, 0.2, z + dz, 0, 0, 0, 0.5, 0.4, 0.06);
        this.colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 1.5, maxZ: z + 1.5 });
      }
    }
    // Tiendas a los dos lados del pasillo; de ellas sale gente con prisa empujando maletas de ruedas
    for (const [x, z] of BURGERS) {
      const side = x > cx ? 1 : -1;
      m.add(G.box, 0xd7263d, x + side * 0.4, 1.1, z, 0, 0, 0, 2.2, 2.2, 4);
      m.add(G.box, 0xf4c430, x + side * 0.4, 2.5, z, 0, 0, 0, 2.4, 0.6, 4.2);
      m.add(G.box, 0xffffff, x - side * 0.75, 1.05, z, 0, 0, 0, 0.2, 0.1, 3.6);
      this.colliders.push({ minX: x + side * 0.4 - 1.1, maxX: x + side * 0.4 + 1.1, minZ: z - 2, maxZ: z + 2 });
    }
    // Tiendas de la sala, en la pared de atrás: escaparate con su rótulo, mostrador y estanterías
    const SHOPS: [number, string, number][] = [[262, 'LIBRERÍA', 0x1f6f8b], [276, 'CAFÉ', 0x7a3b1a], [310, 'DUTY FREE', 0x1b2a4a], [326, 'FARMACIA', 0x2e9e5b]];
    for (const [x, , col] of SHOPS) {
      m.add(G.box, col, x, 3.3, Lg.minZ + 0.25, 0, 0, 0, 7.2, 0.9, 0.3); // banda del rótulo
      m.add(G.box, 0x3f4750, x - 3.55, 1.5, Lg.minZ + 0.25, 0, 0, 0, 0.12, 3, 0.3);
      m.add(G.box, 0x3f4750, x + 3.55, 1.5, Lg.minZ + 0.25, 0, 0, 0, 0.12, 3, 0.3);
      m.add(G.box, 0xe9ecef, x, 0.5, Lg.minZ + 1.4, 0, 0, 0, 2.4, 1.0, 0.7); // mostrador
      for (let k = 0; k < 3; k++) {
        m.add(G.box, 0x8a5a37, x - 2.4 + k * 2.4, 1.2, Lg.minZ + 0.45, 0, 0, 0, 1.8, 2.4, 0.4); // estantería
        for (let j = 0; j < 3; j++) m.add(G.box, [0xd7263d, 0xf2c233, 0x1f5fbf, 0x2e9e5b][(k + j) % 4], x - 2.4 + k * 2.4, 0.55 + j * 0.7, Lg.minZ + 0.68, 0, 0, 0, 1.5, 0.3, 0.06);
      }
      this.colliders.push({ minX: x - 1.25, maxX: x + 1.25, minZ: Lg.minZ + 1.0, maxZ: Lg.minZ + 1.8, low: true }, { minX: x - 3.6, maxX: x + 3.6, minZ: Lg.minZ, maxZ: Lg.minZ + 0.7 });
    }
    // La papelera de reciclaje, junto a un pilar
    m.add(G.cyl, 0x8f98a4, BIN_POS.x, 0.45, BIN_POS.z, 0, 0, 0, 0.5, 0.9, 0.5);
    m.add(G.cyl, 0x4a525c, BIN_POS.x, 0.92, BIN_POS.z, 0, 0, 0, 0.54, 0.06, 0.54);
    m.add(G.box, 0xf2d24a, BIN_POS.x + 0.25, 0.55, BIN_POS.z, 0, 0, 0, 0.02, 0.18, 0.2);
    this.colliders.push({ minX: BIN_POS.x - 0.27, maxX: BIN_POS.x + 0.27, minZ: BIN_POS.z - 0.27, maxZ: BIN_POS.z + 0.27, round: true });
    // Pantallas de salidas: una a la entrada del pasillo y un tótem en medio de la sala (de cara al pasillo y a la sala)
    const dep = this.departuresTex();
    const board = (x: number, y: number, z: number, ry: number, w: number) => {
      const p = new THREE.Mesh(flatPlane(w, w * 0.7), new THREE.MeshBasicMaterial({ map: dep }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
    };
    // (colgada sobre el pasillo, de cara a quien llega: se ve nada más empezar)
    board(cx, 4.4, A.minZ + 9.85, Math.PI, 4.4);
    m.add(G.box, 0x1a1f28, cx, 4.4, A.minZ + 9.95, 0, 0, 0, 4.6, 3.3, 0.1);
    for (const s of [-1, 1]) m.add(G.box, 0x3f4750, cx + s * 1.6, 6.0, A.minZ + 9.95, 0, 0, 0, 0.05, 1.0, 0.05);
    m.add(G.box, 0x1a1f28, lcx, 2.95, 37.5, 0, 0, 0, 3.4, 2.5, 0.3);
    m.add(G.box, 0x4a525c, lcx, 0.85, 37.5, 0, 0, 0, 0.4, 1.7, 0.3);
    board(lcx, 2.95, 37.33, Math.PI, 3.2);
    board(lcx, 2.95, 37.67, 0, 3.2);
    this.colliders.push({ minX: lcx - 0.3, maxX: lcx + 0.3, minZ: 37.3, maxZ: 37.7 });
    sc.add(m.mesh());
    const sign = (text: string, x: number, y: number, z: number, ry: number, w: number, bg: string, fg: string) => {
      const p = new THREE.Mesh(flatPlane(w, w / 4), new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg) }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
    };
    BURGERS.forEach(([x, z], i) => sign(['DUTY FREE', 'CAFÉ', 'PRENSA'][i % 3], x + (x > cx ? -0.78 : 0.78), 1.75, z, x > cx ? -Math.PI / 2 : Math.PI / 2, 3.6, '#1b2a4a', PAPER));
    for (const [x, name, col] of SHOPS) sign(name, x, 3.3, Lg.minZ + 0.42, 0, 3.2, '#' + col.toString(16).padStart(6, '0'), PAPER);
    sign('Salidas · Departures', cx, 6.05, A.minZ + 9.88, Math.PI, 3.2, '#262b33', '#ffd23f');
    // Carteles de dirección a la salida del pasillo, como en Barajas: amarillo sobre negro
    // (mirando hacia la sala, las puertas 25 a 27 quedan a la izquierda: x mayor)
    sign('← Puertas 23 – 25', cx + 2.8, 5.0, A.maxZ - 0.6, Math.PI, 4.6, '#141018', '#ffd23f');
    sign('Puertas 20 – 22 →', cx - 2.8, 5.0, A.maxZ - 0.6, Math.PI, 4.6, '#141018', '#ffd23f');
    // (las 26 a 29, solo encima del pasillito del fondo de la sala, y dentro de él)
    sign('Puertas 26 – 29', Lg.minX + 0.1, 4.6, (CONN.minZ + CONN.maxZ) / 2, Math.PI / 2, 2.8, '#141018', '#ffd23f');
    sign('Puertas 26 – 29', PIER.maxX - 0.1, 4.6, (CONN.minZ + CONN.maxZ) / 2, -Math.PI / 2, 2.8, '#141018', '#ffd23f');
    // Carteles de las paredes del pasillito (Canarias, y el aviso de siempre)
    sign('Gran Canaria · Isla de Sol', 244, 1.9, CONN.maxZ - 0.01, Math.PI, 3, '#1f6f8b', PAPER);
    sign('No deje su equipaje', 247, 1.9, CONN.minZ + 0.01, 0, 2.6, '#262b33', '#ffd23f');
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
    // Viajeros con prisa, de un lado a otro del pasillo (se dan la vuelta antes de la sala de embarque)
    for (let i = 0; i < 4; i++) {
      const p = makePerson({ ...LOOKS[i], shirt: [0x34495e, 0x8e44ad, 0x16a085, 0xc0392b][i] });
      giveCase(p, [0x222222, 0xd7263d, 0x1f5fbf, 0x777777][i], this.posts);
      p.root.position.set(A.minX + 2 + i * 2.6, 0, -22 + i * 11);
      sc.add(p.root);
      this.travelers.push({ p, dir: i % 2 ? 1 : -1, x: p.root.position.x, walk: 0, c: { x: 0, z: 0, r: 0.35 } });
    }
    this.allPeople.push(...this.travelers.map((t) => t.c));
    // Gente esperando su vuelo, sentada en las otras puertas
    const seatLooks: PersonLook[] = [
      { skin: 0xd9a27c, shirt: 0x6b4a8a, pants: 0x2a2a2a, hair: 0x1f1610, hairStyle: 'long' },
      { skin: 0xf0c8a6, shirt: 0x3a6a5a, pants: 0x3b4a6b, hair: 0x9a6a3a, hairStyle: 'short', male: true },
      { skin: 0xc98e64, shirt: 0xd8cfc0, pants: 0x222222, hair: 0x111111, hairStyle: 'bun' },
      { skin: 0xe2b08c, shirt: 0xb4364c, pants: 0x2a2a2a, hair: 0x3a2414, hairStyle: 'short', male: true, beard: true },
    ];
    const hue = (i: number) => new THREE.Color().setHSL((i * 0.137) % 1, 0.5, 0.45).getHex();
    for (let i = 0; i < 6; i++) seatLooks.push({ ...LOOKS[i % LOOKS.length], shirt: hue(i + 3) });
    const seats = this.gateSeats.filter((st) => Math.abs(st.x - GATE_X) > 7);
    seatLooks.forEach((lk, i) => {
      const st = seats[(i * 7 + 3) % seats.length];
      const p = makePerson(lk);
      p.root.position.set(st.x - Math.sign(Math.sin(st.face)) * 0.05, 0, st.z);
      p.root.position.y = seatedRootY(p, 0.52);
      p.root.rotation.y = st.face;
      sc.add(p.root);
      this.seated.push(p);
    });
    // Gente mirando los aviones por la cristalera
    for (const [x, i] of [[279.5, 0], [299, 1], [208, 2], [325.5, 3]] as const) {
      const p = makePerson({ ...LOOKS[(i + 2) % LOOKS.length], shirt: hue(i + 11) });
      p.root.position.set(x, 0, GATE_WALL - 0.7);
      p.root.rotation.y = 0;
      sc.add(p.root);
      this.idlers.push(p);
      this.gateCircles.push({ x, z: GATE_WALL - 0.7, r: 0.35 });
    }
    // Y gente de paso, con su maleta: por la sala, del pasillo a las puertas, y por el ala
    const routes: [number, number, number, number][] = [
      [258, 38.8, 336, 38.8],
      [262, 39.8, 330, 39.8],
      [299, 18, 299, 40.2],
      [293, 22, 268, 40.6],
      [194, 39.2, 232, 39.2],
      [252, 33.2, 200, 38.4],
      [303, 31.8, 334, 38],
    ];
    routes.forEach(([ax, az, bx, bz], i) => {
      const p = makePerson({ ...LOOKS[(i + 1) % LOOKS.length], shirt: hue(i + 20) });
      giveCase(p, [0x222222, 0xd7263d, 0x1f5fbf, 0x777777, 0x2e9e5b][i % 5], this.posts);
      const k = (i * 0.37) % 1;
      p.root.position.set(ax + (bx - ax) * k, 0, az + (bz - az) * k);
      sc.add(p.root);
      const c = { x: p.root.position.x, z: p.root.position.z, r: 0.35 };
      this.gateCircles.push(c);
      this.wanderers.push({ p, a: [ax, az], b: [bx, bz], toB: i % 2 === 0, wait: 0, walk: 0, c });
    });
  }

  /** La pantalla de salidas: hora, destino, vuelo, puerta y cómo va (las horas y los vuelos, inventados). */
  private departuresTex() {
    return comicTex((g, w, h) => {
      g.fillStyle = INK;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b2433';
      g.fillRect(8, 8, w - 16, h - 16);
      g.textAlign = 'left';
      inkText(g, 'SALIDAS · DEPARTURES', 24, 44, 40, '#ffd23f');
      for (const [t, x] of [['HORA', 24], ['DESTINO', 130], ['VUELO', 450], ['PUERTA', 600], ['ESTADO', 690]] as const) inkText(g, t, x, 92, 22, '#b9c6d6');
      const rows = [...GATES].sort((a, b) => a.time.localeCompare(b.time));
      rows.forEach((r, i) => {
        const y = 136 + i * 50;
        const col = r.status === 'EMBARCANDO' ? '#4ade80' : r.status === 'CERRADO' ? '#f87171' : r.status === 'RETRASADO' ? '#fbbf24' : PAPER;
        inkText(g, r.time, 24, y, 30, PAPER);
        inkText(g, r.to, 130, y, 30, PAPER, 300);
        inkText(g, r.code, 450, y, 28, '#b9c6d6');
        inkText(g, String(r.n), 610, y, 34, '#ffd23f');
        inkText(g, r.status, 690, y, 26, col, w - 710);
      });
    }, 900, 630);
  }

  /**
   * Llegadas del aeropuerto de Gran Canaria, esa noche. Primero la sala de recogida de equipajes, con sus dos cintas
   * dando vueltas con maletas; por la aduana («Nada que declarar»), el vestíbulo: gente esperando a los suyos tras la
   * barandilla, la pantalla de llegadas, los mostradores de alquiler de coches, la farmacia, la prensa, los recuerdos,
   * una cafetería en medio (no es esa) y, al lado de las puertas de la calle, la cafetería donde espera Gas, cerrada
   * por los lados: no se le ve hasta llegar a la salida. Luz de interior: paneles planos en el techo (no iluminan).
   */
  private buildArrivals() {
    const sc = this.arrGroup;
    const A = ARR;
    const H = 5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(A.maxX - A.minX, A.maxZ - A.minZ).rotateX(-Math.PI / 2), toon({ color: 0xdedbd3, roughness: 0.3, surf: Surf.Paving }));
    floor.position.set((A.minX + A.maxX) / 2, 0.01, (A.minZ + A.maxZ) / 2);
    floor.userData.noCast = true;
    sc.add(floor);
    const m = new Merger();
    const WALL = 0xeceef1;
    /** Pared de (x0,z0) a (x1,z1), recta en x o en z, en tramos de 3 m (se comban como las de Barajas), con su colisión. */
    const wall = (x0: number, z0: number, x1: number, z1: number, h = H, col = WALL, collide = true) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.ceil(len / 3));
      for (let i = 0; i < n; i++) {
        const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
        const za = z0 + ((z1 - z0) * i) / n, zb = z0 + ((z1 - z0) * (i + 1)) / n;
        m.add(G.box, col, (xa + xb) / 2, h / 2 + 0.01, (za + zb) / 2, 0, 0, 0, Math.abs(xb - xa) + 0.25, h, Math.abs(zb - za) + 0.25);
      }
      if (collide) this.colliders.push({ minX: Math.min(x0, x1) - 0.14, maxX: Math.max(x0, x1) + 0.14, minZ: Math.min(z0, z1) - 0.14, maxZ: Math.max(z0, z1) + 0.14 });
    };
    /** Silla de cafetería: asiento, respaldo y cuatro patas (mirando a ry). */
    const chair = (x: number, z: number, ry: number, col = 0x9c4a2a) => {
      const fx = Math.sin(ry), fz = Math.cos(ry);
      m.add(G.rbox, col, x, 0.46, z, 0, ry, 0, 0.42, 0.05, 0.42);
      m.add(G.rbox, col, x - fx * 0.19, 0.72, z - fz * 0.19, 0, ry, 0, 0.42, 0.46, 0.04);
      for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        const lx = a * 0.17, lz = b * 0.17;
        m.add(G.cyl, 0x22262c, x + lx * Math.cos(ry) + lz * Math.sin(ry), 0.22, z - lx * Math.sin(ry) + lz * Math.cos(ry), 0, 0, 0, 0.03, 0.44, 0.03);
      }
    };
    /** Mesa redonda de cafetería con su pie y su base. */
    const table = (x: number, z: number, top = 0x2b2f35) => {
      m.add(G.cyl, top, x, 0.74, z, 0, 0, 0, 0.75, 0.04, 0.75);
      m.add(G.cyl, 0x22262c, x, 0.37, z, 0, 0, 0, 0.06, 0.72, 0.06);
      m.add(G.cyl, 0x22262c, x, 0.02, z, 0, 0, 0, 0.45, 0.03, 0.45);
      this.colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, round: true });
    };
    /** Palmera de interior en su jardinera redonda de hormigón, con tierra y piedrecitas. */
    const palmPot = (x: number, z: number, h = 3.1) => {
      m.add(G.cyl, 0xb9b4aa, x, 0.35, z, 0, 0, 0, 1.3, 0.7, 1.3);
      m.add(G.cyl, 0x5a4632, x, 0.69, z, 0, 0, 0, 1.15, 0.04, 1.15);
      for (let i = 0; i < 5; i++) m.add(G.cyl, 0x7a6448, x + Math.sin(i * 0.4) * 0.12, 0.7 + (i + 0.5) * ((h - 0.7) / 5), z, 0, 0, 0.04, 0.24 - i * 0.02, (h - 0.7) / 5, 0.24 - i * 0.02);
      palmCrown(m, x + 0.15, h, z, 1.5, 13);
      this.colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7, round: true });
    };
    /** Carro de equipaje (con maletas, si lleva). */
    const trolley = (x: number, z: number, ry: number, loaded: boolean) => {
      const fx = Math.sin(ry), fz = Math.cos(ry);
      m.add(G.box, 0x9aa3ad, x, 0.32, z, 0, ry, 0, 0.5, 0.04, 0.95);
      m.add(G.box, 0x9aa3ad, x - fx * 0.45, 0.62, z - fz * 0.45, 0, ry, 0, 0.5, 0.6, 0.04);
      m.add(G.box, 0x22262c, x - fx * 0.5, 0.95, z - fz * 0.5, 0, ry, 0, 0.52, 0.05, 0.05);
      for (const a of [-1, 1]) for (const b of [-0.4, 0.4]) m.add(G.cyl, 0x22262c, x + a * 0.2 * Math.cos(ry) + b * fx, 0.07, z - a * 0.2 * Math.sin(ry) + b * fz, 0, ry, Math.PI / 2, 0.14, 0.04, 0.14);
      if (loaded) {
        m.add(G.rbox, [0x1f5fbf, 0xd7263d, 0x222222][Math.abs(Math.round(x + z)) % 3], x, 0.55, z, 0, ry, 0, 0.44, 0.42, 0.7);
        m.add(G.rbox, [0xf2c233, 0x2e9e5b, 0x7a5cff][Math.abs(Math.round(x * 3 + z)) % 3], x + fx * 0.05, 0.86, z + fz * 0.05, 0, ry + 0.2, 0, 0.36, 0.22, 0.5);
      }
      this.colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, low: true });
    };
    /** Cartel de anuncio retroiluminado en la pared, con su marco. */
    const poster = (x: number, y: number, z: number, ry: number, title: string, sky: string, ground: string) => {
      const t = comicTex((g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h * 0.6);
        gr.addColorStop(0, sky);
        gr.addColorStop(1, '#fde7b0');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.arc(w * 0.75, h * 0.28, h * 0.11, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2a7fc0';
        g.fillRect(0, h * 0.55, w, h * 0.12);
        g.fillStyle = ground;
        g.beginPath();
        g.moveTo(0, h);
        g.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.7);
        g.quadraticCurveTo(w * 0.85, h * 0.6, w, h * 0.75);
        g.lineTo(w, h);
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 6;
        g.strokeRect(3, 3, w - 6, h - 6);
        g.textAlign = 'left';
        inkText(g, title, 18, h * 0.16, 34, PAPER, w - 36);
      }, 256, 384);
      const p = new THREE.Mesh(flatPlane(1.4, 2.1), new THREE.MeshBasicMaterial({ map: t }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
      m.add(G.box, 0x3f4750, x - Math.sin(ry) * 0.04, y, z - Math.cos(ry) * 0.04, 0, ry, 0, 1.55, 2.25, 0.06);
    };
    // Rodapié oscuro a lo largo de las paredes de fuera (y de la aduana)
    for (const [x0, z0, x1, z1] of [[A.minX, A.minZ, A.minX, A.maxZ], [A.maxX, A.minZ, A.maxX, A.maxZ], [A.minX, A.minZ, A.maxX, A.minZ]] as const)
      m.add(G.box, 0x4a525c, (x0 + x1) / 2 + (x0 === x1 ? (x0 < 400 ? 0.02 : -0.02) : 0), 0.06, (z0 + z1) / 2 + (z0 === z1 ? 0.02 : 0), 0, 0, 0, Math.abs(x1 - x0) + 0.04, 0.12, Math.abs(z1 - z0) + 0.04);
    // Paredes de fuera; la de delante, con el hueco de las puertas de la calle (x 398…404)
    wall(A.minX - 0.12, A.minZ, A.minX - 0.12, A.maxZ);
    wall(A.maxX + 0.12, A.minZ, A.maxX + 0.12, A.maxZ);
    wall(A.minX, A.minZ - 0.12, A.maxX, A.minZ - 0.12);
    wall(A.minX, A.maxZ + 0.12, 398, A.maxZ + 0.12);
    wall(404, A.maxZ + 0.12, A.maxX, A.maxZ + 0.12);
    m.add(G.box, WALL, 401, H - 0.9, A.maxZ + 0.12, 0, 0, 0, 6.2, 1.8, 0.25); // dintel de la salida
    // La aduana: pared entre las dos salas con el paso en medio (x 398…404) y sus puertas de cristal, abiertas
    wall(A.minX, ARR_SPLIT, 398, ARR_SPLIT);
    wall(404, ARR_SPLIT, A.maxX, ARR_SPLIT);
    m.add(G.box, WALL, 401, H - 0.9, ARR_SPLIT, 0, 0, 0, 6.2, 1.8, 0.25);
    for (const s of [-1, 1]) m.add(G.box, 0xbfe2f4, 401 + s * 2.4, 1.4, ARR_SPLIT + 0.2, 0, 0, 0, 1.2, 2.8, 0.05);
    // Techo (en piezas, para que se combe con las paredes) y paneles de luz planos colgados un poco por debajo
    const roof = new Merger();
    for (let x = A.minX; x < A.maxX; x += 3.1) for (let z = A.minZ; z < A.maxZ; z += 3.2) roof.add(G.box, 0xf2f1ef, x + 1.55, H + 0.05, z + 1.6, 0, 0, 0, 3.12, 0.1, 3.22);
    const rm = roof.mesh();
    rm.userData.noCast = true;
    rm.userData.noCam = true;
    sc.add(rm);
    const panels = new Merger(false);
    for (let x = A.minX + 2.5; x < A.maxX - 1; x += 4.5) for (let z = A.minZ + 2.5; z < A.maxZ - 1; z += 5) panels.add(G.box, 0xfff8e6, x, H - 0.2, z, 0, 0, 0, 1.6, 0.03, 0.7);
    const pm = new THREE.Mesh(panels.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    pm.userData.noCast = true;
    sc.add(pm);

    // ---- Recogida de equipajes: las dos cintas, con maletas dando vueltas ----
    for (const [bx, bz] of BELTS) {
      // Base de acero, la goma negra de encima (dos rectas y dos curvas) y la isla del centro
      m.add(G.box, 0x8f98a4, bx, 0.25, bz, 0, 0, 0, BELT_LEN, 0.5, BELT_R * 2 + 0.9);
      for (const s of [-1, 1]) m.add(G.cyl, 0x8f98a4, bx + s * (BELT_LEN / 2), 0.25, bz, 0, 0, 0, BELT_R * 2 + 0.9, 0.5, BELT_R * 2 + 0.9);
      m.add(G.box, 0x1c1d20, bx, 0.52, bz, 0, 0, 0, BELT_LEN, 0.04, BELT_R * 2 + 0.7);
      for (const s of [-1, 1]) m.add(G.cyl, 0x1c1d20, bx + s * (BELT_LEN / 2), 0.52, bz, 0, 0, 0, BELT_R * 2 + 0.7, 0.04, BELT_R * 2 + 0.7);
      m.add(G.box, 0x4a525c, bx, 0.62, bz, 0, 0, 0, BELT_LEN, 0.2, BELT_R * 2 - 0.9);
      for (const s of [-1, 1]) m.add(G.cyl, 0x4a525c, bx + s * (BELT_LEN / 2), 0.62, bz, 0, 0, 0, BELT_R * 2 - 0.9, 0.2, BELT_R * 2 - 0.9);
      // La boca por donde salen las maletas, con sus tiras de goma
      m.add(G.box, 0x5a6470, bx - BELT_LEN / 2 - 1.6, 1.3, bz - BELT_R, 0, 0, 0, 1.2, 2.6, 1.4);
      m.add(G.box, 0x1c1d20, bx - BELT_LEN / 2 - 1.0, 0.85, bz - BELT_R, 0, 0, 0, 0.04, 0.8, 1.0);
      this.colliders.push({ minX: bx - BELT_LEN / 2 - BELT_R - 2.3, maxX: bx + BELT_LEN / 2 + BELT_R + 0.45, minZ: bz - BELT_R - 0.75, maxZ: bz + BELT_R + 0.45, low: true });
    }
    const caseGeo = new Merger()
      .add(G.rbox, 0xffffff, 0, 0.2, 0, 0, 0, 0, 0.62, 0.4, 0.26)
      .add(G.box, 0x222222, 0, 0.42, 0, 0, 0, 0, 0.2, 0.04, 0.04)
      .build();
    const caseCols = [0x1f5fbf, 0xd7263d, 0x222222, 0x2e9e5b, 0xf2c233, 0x7a5cff, 0x8a5a37, 0x34495e];
    BELTS.forEach(([bx, bz], bi) => {
      for (let i = 0; i < 7; i++) {
        const mat = vertexMat();
        const o = new THREE.Mesh(caseGeo, mat);
        o.userData.comicBent = true;
        o.scale.setScalar(0.85 + ((i * 7) % 4) * 0.08);
        sc.add(o);
        const col = new THREE.Color(caseCols[(i + bi * 3) % caseCols.length]);
        const cols = o.geometry.attributes.color;
        // (cada maleta de su color: geometría propia, para no teñir todas)
        o.geometry = caseGeo.clone();
        const c2 = o.geometry.attributes.color as THREE.BufferAttribute;
        for (let k = 0; k < c2.count; k++) if (c2.getX(k) > 0.9 && c2.getY(k) > 0.9) c2.setXYZ(k, col.r, col.g, col.b);
        void cols;
        this.belts.push({ o, cx: bx, cz: bz, u: i * 4.1 + bi });
      }
    });
    // Las pantallas de cada cinta, colgadas
    BELTS.forEach(([bx, bz, label]) => {
      const t = comicTex((g, w, h) => {
        g.fillStyle = INK;
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#1b2433';
        g.fillRect(6, 6, w - 12, h - 12);
        g.textAlign = 'center';
        inkText(g, label, w / 2, h * 0.42, 44, '#ffd23f', w - 30);
        inkText(g, label.includes('Madrid') ? 'VY 3112 · 21:15' : 'VY 3076 · 20:35', w / 2, h * 0.8, 30, PAPER);
      }, 512, 160);
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(flatPlane(2.6, 0.81), new THREE.MeshBasicMaterial({ map: t }));
        p.position.set(bx, 3.4, bz + s * 0.06);
        p.rotation.y = s > 0 ? 0 : Math.PI;
        sc.add(p);
      }
      m.add(G.box, 0x1a1f28, bx, 3.4, bz, 0, 0, 0, 2.8, 0.95, 0.1);
      m.add(G.box, 0x3f4750, bx, 4.4, bz, 0, 0, 0, 0.06, 1.1, 0.06);
    });
    // Carros de equipaje en fila, junto a la pared
    for (let i = 0; i < 6; i++) {
      const x = 395 + i * 0.5;
      m.add(G.box, 0x9aa3ad, x, 0.4, A.minZ + 0.9, 0, 0, 0, 0.42, 0.06, 0.9);
      m.add(G.box, 0x9aa3ad, x, 0.75, A.minZ + 0.5, 0, 0, 0, 0.42, 0.7, 0.04);
    }
    this.colliders.push({ minX: 394.6, maxX: 398.2, minZ: A.minZ, maxZ: A.minZ + 1.4, low: true });

    // ---- Vestíbulo de llegadas ----
    // El pasillo de salida de la aduana, con barandillas; detrás, la gente que espera
    for (const x of [397.3, 404.7]) {
      m.add(G.box, 0xc0c4cc, x, 0.95, -9.5, 0, 0, 0, 0.06, 0.06, 9);
      for (let z = -14; z <= -5; z += 1.5) m.add(G.cyl, 0xc0c4cc, x, 0.48, z, 0, 0, 0, 0.06, 0.96, 0.06);
      this.colliders.push({ minX: x - 0.08, maxX: x + 0.08, minZ: -14, maxZ: -5, low: true });
    }
    // Mostradores de alquiler de coches, en la pared de la izquierda («nos han dado un coche mejor»)
    for (let i = 0; i < 3; i++) {
      const z = -10 + i * 4.2;
      m.add(G.rbox, [0x1f6f8b, 0xd7263d, 0x2e9e5b][i], A.minX + 1.1, 0.55, z, 0, 0, 0, 0.8, 1.1, 2.8);
      m.add(G.box, 0xe9ecef, A.minX + 1.1, 1.12, z, 0, 0, 0, 0.95, 0.05, 2.9);
      m.add(G.box, 0x14181f, A.minX + 1.0, 1.33, z - 0.6, 0, 0, 0, 0.03, 0.32, 0.46);
      this.colliders.push({ minX: A.minX, maxX: A.minX + 1.6, minZ: z - 1.5, maxZ: z + 1.5, low: true });
    }
    // La cafetería de en medio, abierta: barra, cafetera, vitrina, taburetes y mesas
    {
      const [x, z] = [CAFE_OTHER.x, CAFE_OTHER.z];
      m.add(G.box, 0x6b4a31, x + 3.2, 0.52, z, 0, 0, 0, 0.8, 1.04, 5);
      m.add(G.box, 0xe9ecef, x + 3.15, 1.07, z, 0, 0, 0, 0.95, 0.05, 5.1);
      m.add(G.box, 0x22222a, x + 4.2, 1.2, z - 1.2, 0, 0, 0, 0.5, 0.55, 0.7);
      m.add(G.box, 0x9fd3e8, x + 3.2, 1.35, z + 1.4, 0, 0, 0, 0.7, 0.5, 1.4);
      m.add(G.box, 0x6b4a31, x + 4.4, 1.5, z, 0, 0, 0, 0.4, 3, 5.5); // estantería del fondo
      this.colliders.push({ minX: x + 2.75, maxX: x + 4.7, minZ: z - 2.6, maxZ: z + 2.6, low: true });
      // Frente de la barra con su franja de color, carta colgada, tazas y bollería en la vitrina
      m.add(G.box, 0x1f6f8b, x + 2.78, 0.75, z, 0, 0, 0, 0.04, 0.25, 4.9);
      for (let i = 0; i < 5; i++) m.add(G.cyl, 0xffffff, x + 3.1, 1.13, z - 2 + i * 0.25, 0, 0, 0, 0.08, 0.07, 0.08);
      for (let i = 0; i < 4; i++) m.add(G.sphere, 0xd9a35a, x + 3.2, 1.2, z + 0.9 + i * 0.3, 0, 0, 0, 0.16, 0.08, 0.12);
      m.add(G.box, 0x1a1f28, x + 4.55, 2.6, z, 0, 0, 0, 0.05, 0.9, 2.2); // carta
      // Mesas con sus sillas (en dos, alguien tomando algo)
      for (const [tx, tz] of [[x, z - 2], [x - 1.4, z + 1.0], [x + 0.6, z + 2.8], [x - 2.2, z - 1.6]] as const) {
        table(tx, tz);
        chair(tx - 0.62, tz, Math.PI / 2);
        chair(tx + 0.62, tz, -Math.PI / 2);
      }
    }
    // Tiendas del lado derecho: farmacia y prensa (cuartos con su escaparate) y una isla de recuerdos
    const room = (x0: number, z0: number, x1: number, z1: number, col: number) => {
      // Tres paredes y el frente con un hueco de entrada en el centro (mirando a -x)
      wall(x0, z0, x1, z0, 3.2, col);
      wall(x0, z1, x1, z1, 3.2, col);
      wall(x1, z0, x1, z1, 3.2, col);
      const zm = (z0 + z1) / 2;
      wall(x0, z0, x0, zm - 1, 3.2, col);
      wall(x0, zm + 1, x0, z1, 3.2, col);
      m.add(G.box, col, x0, 2.9, zm, 0, 0, 0, 0.25, 0.6, 2.2);
      m.add(G.box, 0x8a5a37, x1 - 0.4, 1.1, zm, 0, 0, 0, 0.5, 2.2, z1 - z0 - 1); // estantería del fondo
      for (let j = 0; j < 3; j++) m.add(G.box, [0xd7263d, 0x1f5fbf, 0xf2c233][j], x1 - 0.66, 0.5 + j * 0.65, zm, 0, 0, 0, 0.06, 0.3, z1 - z0 - 1.6);
      m.add(G.box, 0xe9ecef, x0 + 1.6, 0.5, zm - 1.6, 0, 0, 0, 1.6, 1.0, 0.6);
      this.colliders.push({ minX: x0 + 0.75, maxX: x0 + 2.45, minZ: zm - 1.95, maxZ: zm - 1.25, low: true });
      return zm;
    };
    const zFar = room(421, -12, A.maxX, -4, 0x2e9e5b);
    const zPre = room(421, -2, A.maxX, 6, 0x1b2a4a);
    // Isla de recuerdos de Gran Canaria (estanterías bajas con camisetas, sombreros y cactus)
    m.add(G.box, 0xd8c7a5, 412, 0.6, -2, 0, 0, 0, 3.2, 1.2, 1.6);
    for (let i = 0; i < 6; i++) m.add(G.box, [0xf2c233, 0x1f5fbf, 0xd7263d, 0x2e9e5b, 0xffffff, 0x7a5cff][i], 411 - 0.5 + (i % 3) * 0.9, 1.3, -2.4 + Math.floor(i / 3) * 0.8, 0, 0, 0, 0.6, 0.2, 0.45);
    this.colliders.push({ minX: 410.3, maxX: 413.7, minZ: -2.85, maxZ: -1.15 });
    // Pilares cuadrados y macetas con palmeritas a lo largo del vestíbulo (cortan la vista de punta a punta)
    for (const [x, z] of [[392, 2], [410, 2], [392, 12], [410, 10]] as const) {
      m.add(G.box, 0xdedbd3, x, H / 2, z, 0, 0, 0, 0.7, H, 0.7);
      this.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
    }
    for (const [x, z] of [[396, 7], [406, 7], [396, 16], [406, 15.5], [386, -26], [416, -30]] as const) palmPot(x, z);
    // Pilares revestidos: zócalo y cabeza de acero
    for (const [x, z] of [[392, 2], [410, 2], [392, 12], [410, 10]] as const) {
      m.add(G.box, 0x9aa3ad, x, 0.15, z, 0, 0, 0, 0.78, 0.3, 0.78);
      m.add(G.box, 0x9aa3ad, x, H - 0.15, z, 0, 0, 0, 0.78, 0.3, 0.78);
    }
    // Lo de un aeropuerto: carros de equipaje, máquinas de vending, papeleras, reloj, cartel de suelo mojado
    for (const [x, z, ry, l] of [[392, -18, 0.3, true], [407.5, -27, -1.2, true], [380, -30, 0.1, false], [380.6, -30, 0.1, false], [381.2, -30, 0.1, false], [399, 9.5, 2.6, true], [389, 17, -0.4, false]] as const) trolley(x, z, ry, l);
    for (const [x, col] of [[A.minX + 0.45, 0xd7263d], [A.minX + 0.45, 0x1f5fbf]] as const) {
      const z = col === 0xd7263d ? 0.5 : 1.5;
      m.add(G.rbox, col, x, 0.95, z, 0, 0, 0, 0.7, 1.9, 0.85);
      m.add(G.box, 0x9fd3e8, x + 0.36, 1.15, z - 0.1, 0, 0, 0, 0.02, 1.0, 0.55);
      for (let j = 0; j < 4; j++) m.add(G.box, [0xf2c233, 0x2e9e5b, 0xd7263d, 0xffffff][j], x + 0.34, 0.8 + j * 0.24, z - 0.1, 0, 0, 0, 0.03, 0.12, 0.5);
      this.colliders.push({ minX: A.minX, maxX: A.minX + 0.85, minZ: z - 0.45, maxZ: z + 0.45 });
    }
    for (const [x, z] of [[398.8, -15], [403.2, -15], [391, 6], [411, 6], [388, -18], [420, 9]] as const) {
      m.add(G.cyl, 0x5a6470, x, 0.4, z, 0, 0, 0, 0.42, 0.8, 0.42);
      m.add(G.cyl, 0x22262c, x, 0.82, z, 0, 0, 0, 0.46, 0.04, 0.46);
      this.colliders.push({ minX: x - 0.24, maxX: x + 0.24, minZ: z - 0.24, maxZ: z + 0.24, round: true });
    }
    m.add(G.cone, 0xf2c233, 404, 0.3, 0, 0, 0.6, 0, 0.35, 0.6, 0.35); // suelo mojado
    m.add(G.cyl, 0xffffff, 401, 3.6, ARR_SPLIT - 0.2, Math.PI / 2, 0, 0, 0.7, 0.06, 0.7); // reloj
    // Aduana: mostrador con su agente, junto al paso
    m.add(G.rbox, 0x2f5d3a, 395.5, 0.55, ARR_SPLIT - 1.6, 0, 0, 0, 1.8, 1.1, 0.7);
    m.add(G.box, 0xe9ecef, 395.5, 1.12, ARR_SPLIT - 1.6, 0, 0, 0, 1.9, 0.05, 0.8);
    this.colliders.push({ minX: 394.5, maxX: 396.5, minZ: ARR_SPLIT - 2, maxZ: ARR_SPLIT - 1.2, low: true });
    // Reclamación de equipajes (objetos perdidos): un cuarto con su mostrador en la sala de equipajes
    wall(424, -34, 424, -27, 3.2, 0x1f6f8b);
    wall(424, -27, 426, -27, 3.2, 0x1f6f8b);
    m.add(G.rbox, 0xe9ecef, 427.5, 0.55, -27.4, 0, 0, 0, 3, 1.1, 0.7);
    this.colliders.push({ minX: 425.8, maxX: A.maxX, minZ: -27.8, maxZ: -27 });
    // Carteles de Gran Canaria en las paredes
    poster(A.minX + 0.08, 2.2, -20, Math.PI / 2, 'Maspalomas', '#5aa9e6', '#f2c97a');
    poster(A.minX + 0.08, 2.2, -27, Math.PI / 2, 'Roque Nublo', '#7cc0ef', '#8a6a4a');
    poster(A.maxX - 0.08, 2.2, -16.5, -Math.PI / 2, 'Las Canteras', '#4a9be0', '#f6d89a');
    poster(A.minX + 0.08, 2.2, 3, Math.PI / 2, 'Bienvenidos', '#5aa9e6', '#2f7d4b');
    poster(409.4, 2.2, ARR_SPLIT + 0.14, 0, 'Gran Canaria', '#7cc0ef', '#f2c97a');
    poster(392.6, 2.2, ARR_SPLIT + 0.14, 0, 'Welcome', '#4a9be0', '#d9a35a');
    // (las paredes de la cafetería de Gas, por fuera: carteles y una franja de azulejo)
    poster(407.36, 1.9, 13.2, -Math.PI / 2, 'Café canario', '#d98a4a', '#6b4a31');
    poster(407.36, 1.9, 16.2, -Math.PI / 2, 'Bocadillos', '#e6b05a', '#9c4a2a');
    m.add(G.box, 0xe9d8b8, 407.34, 0.45, 14.6, 0, 0, 0, 0.04, 0.9, 7.2);
    // La cafetería de Gas: junto a las puertas de la calle, cerrada por la pared del vestíbulo; se entra por el lado
    // de la salida. Barra contra la pared de delante, cafetera, vitrina, mesas altas
    wall(407.5, 11, 407.5, 18.2, 3.2, 0x9c4a2a);
    wall(407.5, 11, A.maxX, 11, 3.2, 0x9c4a2a);
    m.add(G.box, 0x7a5434, 418, 0.52, A.maxZ - 0.8, 0, 0, 0, 6, 1.04, 0.8);
    m.add(G.box, 0xe9ecef, 418, 1.07, A.maxZ - 0.75, 0, 0, 0, 6.1, 0.05, 0.95);
    m.add(G.box, 0x22222a, 416.4, 1.2, A.maxZ - 0.3, 0, 0, 0, 0.7, 0.55, 0.5); // cafetera
    m.add(G.box, 0x9fd3e8, 419.8, 1.35, A.maxZ - 0.8, 0, 0, 0, 1.6, 0.5, 0.7); // vitrina de bocadillos
    m.add(G.box, 0x7a5434, A.maxX - 0.3, 1.6, 17, 0, 0, 0, 0.4, 3.2, 10); // estantería de botellas, al fondo
    m.add(G.box, 0x9c4a2a, 418, 0.75, A.maxZ - 1.22, 0, 0, 0, 6, 0.25, 0.04); // franja del frente de la barra
    m.add(G.box, 0x1a1f28, 418, 2.6, A.maxZ - 0.05, 0, 0, 0, 3.2, 0.9, 0.05); // carta sobre la barra
    for (let i = 0; i < 6; i++) m.add(G.cyl, 0xffffff, 415.6 + i * 0.3, 1.13, A.maxZ - 0.75, 0, 0, 0, 0.08, 0.07, 0.08);
    for (let i = 0; i < 5; i++) m.add(G.sphere, 0xd9a35a, 419.3 + i * 0.25, 1.2, A.maxZ - 0.8, 0, 0, 0, 0.14, 0.07, 0.11);
    // Taburetes altos con respaldo, en las mesas altas
    for (const [x, z] of [[416.3, 15], [417.7, 15], [419.7, 18.6], [421.1, 18.6], [411, 13.3], [411, 14.7]] as const) {
      m.add(G.cyl, 0x9c4a2a, x, 0.76, z, 0, 0, 0, 0.36, 0.05, 0.36);
      m.add(G.cyl, 0x22262c, x, 0.38, z, 0, 0, 0, 0.04, 0.76, 0.04);
      m.add(G.cyl, 0x22262c, x, 0.3, z, Math.PI / 2, 0, 0, 0.3, 0.02, 0.3);
      m.add(G.cyl, 0x22262c, x, 0.02, z, 0, 0, 0, 0.32, 0.03, 0.32);
    }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) m.add(G.cyl, [0x2f7d4b, 0x8a5a37, 0xf4c95e][(i + j) % 3], A.maxX - 0.42, 0.8 + j * 0.7, 13 + i * 1.1, 0, 0, 0, 0.12, 0.34, 0.12);
    this.colliders.push({ minX: 414.9, maxX: 421.1, minZ: A.maxZ - 1.3, maxZ: A.maxZ }, { minX: A.maxX - 0.6, maxX: A.maxX, minZ: 12, maxZ: 22 });
    for (const [x, z] of [[CAFE_GAS.x + 0.75, CAFE_GAS.z + 0.2], [417, 15], [420.4, 18.6], [411, 14]] as const) {
      m.add(G.cyl, 0x22262c, x, 0.53, z, 0, 0, 0, 0.07, 1.05, 0.07);
      m.add(G.cyl, 0x22262c, x, 0.02, z, 0, 0, 0, 0.4, 0.04, 0.4);
      m.add(G.cyl, 0xe9ecef, x, 1.07, z, 0, 0, 0, 0.7, 0.04, 0.7);
      this.colliders.push({ minX: x - 0.36, maxX: x + 0.36, minZ: z - 0.36, maxZ: z + 0.36, round: true });
    }
    // Mostrador de información en medio del vestíbulo, y un cajero en la pared de la izquierda
    m.add(G.rbox, 0x1f6f8b, 401, 0.55, 2.5, 0, 0, 0, 2.6, 1.1, 1.1);
    m.add(G.box, 0xe9ecef, 401, 1.12, 2.5, 0, 0, 0, 2.7, 0.05, 1.2);
    this.colliders.push({ minX: 399.6, maxX: 402.4, minZ: 1.85, maxZ: 3.15, low: true });
    m.add(G.box, 0x4a525c, A.minX + 0.3, 1.0, 9, 0, 0, 0, 0.5, 2, 0.9);
    m.add(G.box, 0x14181f, A.minX + 0.56, 1.4, 9, 0, 0, 0, 0.02, 0.3, 0.4);
    // Bancos de espera junto a la pared izquierda, delante
    for (const z of [14, 19]) {
      m.add(G.box, 0x4a5a6c, A.minX + 0.6, 0.45, z, 0, 0, 0, 0.6, 0.1, 3);
      m.add(G.box, 0x4a5a6c, A.minX + 0.35, 0.75, z, 0, 0, 0, 0.1, 0.6, 3);
      for (const dz of [-1.2, 1.2]) m.add(G.box, 0x9aa3ad, A.minX + 0.6, 0.2, z + dz, 0, 0, 0, 0.5, 0.4, 0.06);
      this.colliders.push({ minX: A.minX, maxX: A.minX + 0.95, minZ: z - 1.5, maxZ: z + 1.5 });
    }
    // Los aseos, en la pared de la derecha de la sala de equipajes (una puerta con su letrero)
    m.add(G.box, 0x8f98a4, A.maxX - 0.02, 1.1, -19, 0, 0, 0, 0.06, 2.2, 1.1);

    // ---- Lo pintado: la noche de la calle y la sala de equipajes por la aduana ----
    const night = new THREE.Mesh(
      flatPlane(6, 3.2),
      new THREE.MeshBasicMaterial({
        map: comicTex((g, w, h) => {
          g.fillStyle = '#141a3a';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#2a2a33';
          g.fillRect(0, h * 0.72, w, h * 0.28);
          for (const x of [w * 0.12, w * 0.88]) {
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
        }, 384, 192),
      }),
    );
    night.position.set(401, 1.6, A.maxZ + 0.3);
    night.rotation.y = Math.PI;
    sc.add(night);
    for (const dx of [-3, -1.5, 0, 1.5, 3]) m.add(G.box, 0x5a6470, 401 + dx, 1.5, A.maxZ + 0.15, 0, 0, 0, 0.08, 3, 0.1);
    const sign = (text: string, x: number, y: number, z: number, ry: number, w: number, bg: string, fg: string) => {
      const p = new THREE.Mesh(flatPlane(w, w / 4), new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg) }));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      sc.add(p);
    };
    sign('Recogida de equipajes', 401, 4.0, A.minZ + 0.1, 0, 4, '#262b33', '#ffd23f');
    sign('Salida · Exit →', 401, 3.85, ARR_SPLIT - 0.15, Math.PI, 3, '#1f7a46', PAPER);
    sign('Nada que declarar', 401, 3.85, ARR_SPLIT + 0.15, 0, 3, '#1f7a46', PAPER);
    sign('Llegadas · Arrivals', 401, 3.9, -4.5, Math.PI, 3.6, '#262b33', '#ffd23f');
    sign('Salida · Exit', 401, 3.85, A.maxZ - 0.1, Math.PI, 2.6, '#1f7a46', PAPER);
    sign('Alquiler de coches', A.minX + 0.1, 3.0, -6, Math.PI / 2, 3.6, '#1f6f8b', PAPER);
    sign('Café Atlántico', CAFE_OTHER.x + 4.15, 3.2, CAFE_OTHER.z, -Math.PI / 2, 3, '#1f6f8b', PAPER);
    sign('Farmacia', 420.85, 3.6, zFar, -Math.PI / 2, 2.6, '#2e9e5b', PAPER);
    sign('Prensa', 420.85, 3.6, zPre, -Math.PI / 2, 2.6, '#1b2a4a', PAPER);
    sign('Recuerdos', 412, 2.2, -1.15, Math.PI, 2, '#f2c233', '#141018');
    sign('Aseos', A.maxX - 0.1, 2.6, -19, -Math.PI / 2, 1.6, '#262b33', PAPER);
    sign('Información · i', 401, 2.0, 1.92, Math.PI, 2.2, '#1f6f8b', PAPER);
    sign('Cajero', A.minX + 0.08, 2.3, 9, Math.PI / 2, 1.2, '#262b33', PAPER);
    // (el rótulo de la cafetería de Gas, sobre su entrada, de cara a la salida)
    sign('Cafetería', 407.36, 3.6, 20.8, -Math.PI / 2, 2.4, '#7a3b1a', PAPER);
    sign('Cafetería', 414, 3.6, 10.86, Math.PI, 2.4, '#7a3b1a', PAPER);
    // Pantalla de llegadas, en un pilar del vestíbulo
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
    board.position.set(392, 2.8, 1.62);
    board.rotation.y = Math.PI;
    sc.add(board);
    const mm = m.mesh();
    // (paredes y techo sin sombra: la luz de la sala llega a todo el suelo)
    mm.userData.noCast = true;
    sc.add(mm);
    // Gente: esperando a los suyos tras la barandilla, en las cintas, en el alquiler de coches y en las cafeterías
    const W: [PersonLook, number, number, number][] = [
      [{ skin: 0xd9a27c, shirt: 0x3a6a5a, pants: 0x2a2a2a, hair: 0x1f1610, hairStyle: 'short', male: true }, 395.8, -8.4, Math.PI * 0.62],
      [{ skin: 0xf0c8a6, shirt: 0xb4364c, pants: 0x3b4a6b, hair: 0x6b3f22, hairStyle: 'pony' }, 406.3, -9.6, -Math.PI * 0.6],
      [{ skin: 0xc98e64, shirt: 0xe9e2d0, pants: 0x222222, hair: 0x111111, hairStyle: 'bun' }, 395.9, -11.2, Math.PI * 0.7],
      [{ skin: 0xe2b08c, shirt: 0x34495e, pants: 0x2a2a2a, hair: 0x3a2414, hairStyle: 'short', male: true }, 388, -21.6, Math.PI],
      [{ skin: 0xf3d2b6, shirt: 0x5a4a78, pants: 0x3b4a6b, hair: 0x9a6a3a, hairStyle: 'long' }, 417.5, -21.7, Math.PI],
      [{ skin: 0xd9a27c, shirt: 0x1f6f8b, pants: 0x1f2d4d, hair: 0x2b1d14, hairStyle: 'straight' }, A.minX + 0.45, -5.8, Math.PI / 2],
      [{ skin: 0xc98e64, shirt: 0x1f6f8b, pants: 0x222222, hair: 0x1a1a1a, hairStyle: 'short', male: true }, CAFE_OTHER.x + 3.85, CAFE_OTHER.z + 0.3, -Math.PI / 2],
    ];
    for (const [lk, x, z, ry] of W) {
      const p = makePerson(lk);
      p.root.position.set(x, 0, z);
      p.root.rotation.y = ry;
      sc.add(p.root);
      this.arrPeople.push(p);
      this.arrCircles.push({ x, z, r: 0.35 });
    }
    const worker = makePerson({ skin: 0xe2b08c, shirt: 0x7a3b1a, pants: 0x222222, hair: 0x3a2414, hairStyle: 'straight' });
    worker.root.position.set(417.6, 0, A.maxZ - 0.35);
    worker.root.rotation.y = Math.PI;
    sc.add(worker.root);
    this.arrPeople.push(worker);
    // Más gente: en las cintas, con cartel esperando, en la aduana, en objetos perdidos, en información, limpiando,
    // sentada en el Café Atlántico y en la cafetería de Gas, y de paso con sus maletas
    const hue = (i: number) => new THREE.Color().setHSL((i * 0.173) % 1, 0.5, 0.45).getHex();
    const more: [PersonLook, number, number, number, 'stand' | 'sign' | 'sit'][] = [
      [{ ...LOOKS[0], shirt: hue(1) }, 384, -21.6, Math.PI, 'stand'],
      [{ ...LOOKS[3], shirt: hue(2) }, 412, -21.8, Math.PI, 'stand'],
      [{ ...LOOKS[4], shirt: hue(3) }, 410.2, -26.3, 0, 'stand'],
      [{ ...LOOKS[5], shirt: hue(4) }, 406.3, -11.4, -Math.PI * 0.55, 'sign'],
      [{ ...LOOKS[1], shirt: hue(5) }, 395.8, -6.4, Math.PI * 0.6, 'sign'],
      [{ skin: 0xd9a27c, shirt: 0x2f5d3a, pants: 0x2f5d3a, hair: 0x1f1610, hairStyle: 'short', male: true }, 395.5, ARR_SPLIT - 0.8, Math.PI, 'stand'],
      [{ skin: 0xf0c8a6, shirt: 0x1f6f8b, pants: 0x1f2d4d, hair: 0x6b3f22, hairStyle: 'pony' }, 427.5, -28.3, 0, 'stand'],
      [{ skin: 0xe2b08c, shirt: 0x1f6f8b, pants: 0x1f2d4d, hair: 0x3a2414, hairStyle: 'bun' }, 401, 3.4, Math.PI, 'stand'],
      [{ skin: 0xc98e64, shirt: 0x7a8a5a, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'short', male: true }, 403.8, 0.6, 2.2, 'stand'],
      [{ ...LOOKS[2], shirt: hue(6) }, CAFE_OTHER.x - 0.62, CAFE_OTHER.z - 2, Math.PI / 2, 'sit'],
      [{ ...LOOKS[4], shirt: hue(7) }, CAFE_OTHER.x - 1.4 + 0.62, CAFE_OTHER.z + 1.0, -Math.PI / 2, 'sit'],
      [{ ...LOOKS[0], shirt: hue(8) }, CAFE_OTHER.x - 2.2 - 0.62, CAFE_OTHER.z - 1.6, Math.PI / 2, 'sit'],
    ];
    for (const [lk, x, z, ry, mode] of more) {
      const p = makePerson(lk);
      p.root.position.set(x, 0, z);
      p.root.rotation.y = ry;
      if (mode === 'sit') {
        p.root.position.y = seatedRootY(p, 0.49);
        this.arrSeated.push(p);
      } else this.arrPeople.push(p);
      if (mode === 'sign') {
        // Con su cartel en alto: un nombre escrito a mano
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ map: signTex(x > 400 ? 'Sra. Pérez' : 'Hans', '#fffbf0', '#141018', 256, 160), side: THREE.DoubleSide }));
        sg.position.set(0, 1.35, 0.32);
        p.body.add(sg);
        p.armL.rotation.set(-1.2, 0, 0.1);
        p.armR.rotation.set(-1.2, 0, -0.1);
      }
      sc.add(p.root);
      if (mode !== 'sit') this.arrCircles.push({ x, z, r: 0.35 });
    }
    // De paso: de las cintas a la salida, del alquiler de coches a la calle, por el vestíbulo
    const routes: [number, number, number, number][] = [
      [400, -26, 401, -9],
      [374, -8, 398, 22],
      [418, -3.5, 399, 8],
      [380, -22, 420, -20],
    ];
    routes.forEach(([ax, az, bx, bz], i) => {
      const p = makePerson({ ...LOOKS[(i + 2) % LOOKS.length], shirt: hue(i + 12) });
      giveCase(p, [0x1f5fbf, 0xd7263d, 0x222222, 0x2e9e5b][i], this.posts);
      p.root.position.set(ax, 0, az);
      sc.add(p.root);
      const c = { x: ax, z: az, r: 0.35 };
      this.arrCircles.push(c);
      this.arrWanderers.push({ p, a: [ax, az], b: [bx, bz], toB: true, wait: 0, walk: 0, c });
    });
  }

  private startAirport() {
    this.phase = 'airport';
    this.scene.add(this.airGroup, this.arrGroup);
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
    // (sin reloj: el tiempo que haga falta para encontrar la puerta)
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
      const tw = steerSpeed(t) > 0.1;
      animatePerson(t.p, dt, tw ? 'walk' : 'idle');
      caseStep(t.p, tw, dt);
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
    if (Math.hypot(pp.x - tail[0], pp.z - tail[1]) < 1.4 || (Math.abs(pp.x - GATE_X) < 2.3 && pp.z > GZ - 2.6)) this.startGateQueue();
    // En otra puerta: lee la pantalla y no es la suya (lo piensa en voz alta, una vez por puerta y rato)
    for (const g of GATES) {
      if (g.n === 26 || Math.abs(pp.x - g.x) > 2.6 || pp.z < GZ - 3.4) continue;
      const last = this.wrongSaid.get(g.n) ?? -99;
      if (this.t - last > 9) {
        this.wrongSaid.set(g.n, this.t);
        bark('Azul', CONCERT.wrongGate(g.to));
        this.talk(this.azul, 1.5);
      }
    }
  }

  /** La gente de paso por la sala y el ala, y la que mira los aviones (también mientras Azul hace cola). */
  private stepAirPeople(dt: number) {
    // La gente de paso por la sala y el ala: va de un sitio a otro, espera un poco y vuelve
    const avoid = [this.playerCircle, ...this.wanderers.map((w) => w.c)];
    for (const w of this.wanderers) {
      const [tx, tz] = w.toB ? w.b : w.a;
      if (w.wait > 0) {
        w.wait -= dt;
        animatePerson(w.p, dt, 'idle');
        caseStep(w.p, false, dt);
        if (w.wait <= 0) w.toB = !w.toB;
      } else if (steerTo(w.p.root, w, tx, tz, 1.3, dt, avoid, 2.5, 0.32, w.c) < 0.4) w.wait = 1.5 + Math.random() * 4;
      else {
        const ww = steerSpeed(w) > 0.1;
        animatePerson(w.p, dt, ww ? 'walk' : 'idle');
        caseStep(w.p, ww, dt);
      }
      w.c.x = w.p.root.position.x;
      w.c.z = w.p.root.position.z;
    }
    for (const p of this.idlers) animatePerson(p, dt, 'idle');
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
    // La puerta de cristal del finger: se aparta cuando alguien se acerca (de la cola o Azul)
    {
      let near = false;
      const dz = (o: THREE.Object3D) => o.visible && Math.abs(o.position.x - GATE_X) < 1.6 && Math.abs(o.position.z - GATE_WALL) < 2.4;
      for (const g of this.gateQ) if (g.state === 'pass' && dz(g.p.root)) near = true;
      if (dz(this.azul.root) && (this.gateStep === 'pass' || this.gateStep === 'finger')) near = true;
      const was = this.slideK;
      this.slideK = THREE.MathUtils.clamp(this.slideK + (near ? dt : -dt) * 1.6, 0, 1);
      if (was === 0 && this.slideK > 0 && this.player.root.position.x > 100 && this.player.root.position.x < 350) audio.whoosh();
      const e = THREE.MathUtils.smoothstep(this.slideK, 0, 1);
      for (const l of this.slideLeaves) l.o.position.x = l.x0 + l.s * e * 1.05;
    }
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
        // Por el torno, a la puerta (se abre sola) y finger arriba, hasta la puerta del avión
        if (this.stepTo(g.p, g, GATE_X, g.t === 0 ? GZ + 2.9 : GATE_WALL + FINGER_LEN - 0.9, 1.3, dt)) {
          if (g.t === 0) g.t = 1;
          else {
            g.state = 'gone';
            g.p.root.visible = false;
          }
        }
        g.p.root.position.y = fingerY(g.p.root.position.z);
      }
      if (g.state !== 'gone') caseStep(g.p, steerSpeed(g) > 0.1, dt);
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
      if (this.stepTo(az, this.azSt, GATE_X, GZ + 2.9, 1.4, dt)) this.gateStep = 'finger';
    } else if (this.gateStep === 'finger') {
      // Cruza la puerta y entra en el finger (sube con él)
      if (this.stepTo(az, this.azSt, GATE_X, GATE_WALL + 2.6, 1.4, dt)) this.board();
      az.root.position.y = fingerY(az.root.position.z);
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
    // (Barajas ya no hace falta: fuera de la escena, que su gente no se anime para nada)
    this.scene.add(this.arrGroup);
    this.airGroup.removeFromParent();
    this.azul.root.visible = true;
    this.azul.root.position.copy(ARR_START);
    this.azul.root.position.y = 0;
    this.azul.root.rotation.y = 0;
    this.azCircle.x = this.azCircle.z = 1e4;
    this.walker.yaw = this.walker.facing = 0;
    this.walker.stop();
    this.gas.root.visible = true;
    this.gas.root.position.copy(CAFE_GAS);
    this.gas.root.rotation.y = Math.atan2(ARR_START.x - CAFE_GAS.x, ARR_START.z - CAFE_GAS.z);
    this.camera.position.set(ARR_START.x, 2.6, ARR_START.z - 3.8);
    this.camera.lookAt(ARR_START.x, 1.4, ARR_START.z + 6);
  }

  private stepArrivals(dt: number) {
    const pp = this.azul.root.position;
    const gp = this.gas.root.position;
    // Las cintas dan vueltas con sus maletas, y la gente de llegadas espera
    for (const b of this.belts) {
      b.u += dt * 0.7;
      beltPoint(b.cx, b.cz, b.u, b.o.position);
      b.o.position.y = 0.55;
      beltPoint(b.cx, b.cz, b.u + 0.2, this.tmpV);
      b.o.rotation.y = Math.atan2(this.tmpV.x - b.o.position.x, this.tmpV.z - b.o.position.z) + Math.PI / 2;
    }
    for (const p of this.arrPeople) animatePerson(p, dt, 'idle');
    for (const p of this.arrSeated) {
      animatePerson(p, dt, 'idle');
      seatPose(p);
    }
    {
      const me = { x: pp.x, z: pp.z, r: 0.38 };
      const avoid = [me, ...this.arrCircles];
      for (const w of this.arrWanderers) {
        const [tx, tz] = w.toB ? w.b : w.a;
        if (w.wait > 0) {
          w.wait -= dt;
          animatePerson(w.p, dt, 'idle');
          caseStep(w.p, false, dt);
          if (w.wait <= 0) w.toB = !w.toB;
        } else if (steerTo(w.p.root, w, tx, tz, 1.25, dt, avoid, 2.5, 0.32, w.c) < 0.4) w.wait = 2 + Math.random() * 4;
        else {
          const ww = steerSpeed(w) > 0.1;
          animatePerson(w.p, dt, ww ? 'walk' : 'idle');
          caseStep(w.p, ww, dt);
        }
        w.c.x = w.p.root.position.x;
        w.c.z = w.p.root.position.z;
      }
    }
    // Gas, en su mesa: mirando el móvil hasta que la ve entrar en la cafetería
    const d = Math.hypot(pp.x - gp.x, pp.z - gp.z);
    const sees = d < 9 && pp.x > 407 && pp.z > 11;
    animatePerson(this.gas, dt, sees ? 'wave' : 'idle');
    faceTo(this.gas.root, sees ? Math.atan2(pp.x - gp.x, pp.z - gp.z) : -Math.PI * 0.35, dt, 3);
    if (!sees) {
      this.gas.armR.rotation.x = -1.3;
      this.gas.elbowR.rotation.x = -1.1;
      this.gas.head.rotation.x = 0.35;
    }
    // En la otra cafetería: no está («justo en la salida», dijo)
    if (!this.busy && pp.distanceTo(CAFE_OTHER) < 4.5 && this.t - this.otherCafeSaid > 14) {
      this.otherCafeSaid = this.t;
      bark('Azul', CONCERT.otherCafe);
      this.talk(this.azul, 1.5);
    }
    if (!this.busy && d < 1.6) this.meetGas();
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
    this.airGroup.removeFromParent();
    this.arrGroup.removeFromParent();
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
    const bassist = makePerson(castLook({ skin: 0xd9a27c, shirt: 0x3a3a44, pants: 0x111111, hair: 0x5a3a22, hairStyle: 'long' }, 'bajista'));
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
    const sax = makePerson(castLook({ skin: 0xc98e64, shirt: 0xf4d35e, pants: 0x111111, hair: 0x222222, hairStyle: 'short', male: true }, 'saxofonista'));
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
    const drummer = makePerson(castLook({ skin: 0xe8b894, shirt: 0xffffff, pants: 0x111111, hair: 0x888888, hairStyle: 'short', male: true }, 'bateria'));
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
      // Cabina de plástico, hueca: fondo, laterales, el marco de la puerta (dintel y jambas), techo blanco y base
      m.add(G.box, 0x2a63c4, WC_X + 0.58, 1.15, z, 0, 0, 0, 0.05, 2.3, 1.3);
      for (const sz of [-1, 1]) m.add(G.box, 0x2a63c4, WC_X, 1.15, z + sz * 0.63, 0, 0, 0, 1.2, 2.3, 0.05);
      m.add(G.box, 0x2a63c4, fx + 0.02, 2.2, z, 0, 0, 0, 0.06, 0.2, 1.3);
      for (const sz of [-1, 1]) m.add(G.box, 0x2a63c4, fx + 0.02, 1.1, z + sz * 0.6, 0, 0, 0, 0.06, 2.2, 0.1);
      m.add(G.cyl, 0xe9eef5, WC_X, 2.36, z, 0, 0, 0, 1.45, 0.14, 1.45); // techo blanco
      m.add(G.box, 0xe9eef5, WC_X, 0.04, z, 0, 0, 0, 1.3, 0.08, 1.4); // base
      // Dentro (se ve con la puerta abierta): suelo oscuro, el váter al fondo con su asiento negro, el rollo y la rejilla
      m.add(G.box, 0x4c535c, WC_X, 0.085, z, 0, 0, 0, 1.1, 0.01, 1.2);
      m.add(G.box, 0xe9eef5, WC_X + 0.4, 0.62, z, 0, 0, 0, 0.18, 0.5, 0.46); // depósito
      m.add(G.box, 0xe9eef5, WC_X + 0.2, 0.25, z, 0, 0, 0, 0.42, 0.34, 0.36); // taza
      m.add(G.box, 0x2a2d33, WC_X + 0.2, 0.43, z, 0, 0, 0, 0.44, 0.03, 0.38); // asiento
      m.add(G.cyl, 0xf6f2e8, WC_X + 0.1, 0.95, z + 0.52, Math.PI / 2, 0, 0, 0.12, 0.12, 0.12);
      m.add(G.box, 0x5d7fa8, WC_X + 0.55, 2.0, z, 0, 0, 0, 0.02, 0.12, 0.45);
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
      if (WC_BROKEN.includes(i)) {
        // Averiada: un folio pegado con cinta y dos tiras de cinta de obra en aspa
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshBasicMaterial({ map: signTex('AVERIADO', '#fffbf0', '#c0392b', 256, 180) }));
        paper.position.set(0.45, 1.05, -0.035);
        paper.rotation.set(0, Math.PI, 0.06);
        const tape = new Merger(false);
        for (const sgn of [-1, 1]) {
          tape.add(G.box, 0xd7263d, 0.5, 1.15, -0.03, 0, 0, sgn * 0.75, 1.1, 0.06, 0.005);
          for (let k = -2; k <= 2; k++) tape.add(G.box, 0xfffbf0, 0.5 + Math.cos(sgn * 0.75) * k * 0.2, 1.15 + Math.sin(sgn * 0.75) * k * 0.2, -0.033, 0, 0, sgn * 0.75, 0.08, 0.062, 0.005);
        }
        door.leaf.add(paper, tape.mesh());
      }
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
    this.cabin = new Cabin3D(new THREE.Vector3(0, -40, -60));
    sc.add(this.cabin.group);
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
    return out.set(Q_X0 - (k + this.qShift) * Q_GAP, 0, Q_Z);
  }

  /** Gente para la cola de los baños y una reserva para entrar, salir y unirse al final. */
  private buildQueue() {
    for (let i = 0; i < 13; i++) {
      const lk = LOOKS[i % LOOKS.length];
      const p = makePerson({ ...lk, shirt: i < LOOKS.length ? lk.shirt : new THREE.Color().setHSL(Math.random(), 0.55, 0.5).getHex() });
      p.root.visible = false;
      p.root.position.set(1e4, 0, 1e4);
      this.scene.add(p.root);
      const n: Npc = { p, mode: 'free', tx: 0, tz: 0, wc: -1, walk: Math.random() * 6, circle: { x: 1e4, z: 1e4, r: 0.32 }, mood: (['phone', 'dance', 'impatient', 'idle'] as const)[i % 4] };
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
      if (this.wcBusyT[i] < 0.6 && !this.wcRes[i]) this.wcDoors[i].hold(2.2);
      if (this.wcBusyT[i] <= 0 && !this.wcRes[i]) {
        // Sale alguien (de dentro, por la puerta abierta) y se vuelve al concierto
        const n = this.spawn(WC_X - 0.2, WC_Z[i]);
        n.mode = 'leave';
        n.p.root.rotation.y = -Math.PI / 2; // (de cara a la puerta: sale andando hacia delante)
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
      if (i >= 0 && head === this.gasNpc) {
        // Le toca a Gas (si ya puede: no en mitad del vídeo o de un diálogo)
        if (this.gasMayEnter && !this.busyDialog()) {
          this.queue.shift();
          this.headT = 0.8;
          this.gasEnterWc(i);
        }
      } else if (i >= 0) {
        this.queue.shift();
        head.mode = 'toWc';
        head.wc = i;
        // Delante de su puerta y luego dentro (la puerta se le abre al llegar)
        head.tx = WC_X - 1.0;
        head.tz = WC_Z[i];
        head.next = [WC_X - 0.2, WC_Z[i]];
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
    // Gas en la cola: avanza con ella (le lleva el juego)
    if (this.gasNpc && !this.auto && this.queue.includes(this.gasNpc)) this.stepTo(this.gas, this.gasNpc, this.gasNpc.tx, this.gasNpc.tz, 1.5, dt, Math.PI / 2);
    // Los que andan sueltos esquivan a Gas y a los que caminan (no a la cola, que es apretada)
    this.playerCircle.x = pp.x;
    this.playerCircle.z = pp.z;
    this.movingAvoid.length = 0;
    this.movingAvoid.push(this.playerCircle);
    for (const n of this.npcs) if (n.mode === 'toWc' || n.mode === 'leave' || n.mode === 'tail') this.movingAvoid.push(n.circle);
    for (const n of this.npcs) {
      if (n.mode === 'free') continue;
      const r = n.p.root.position;
      if (n.mode === 'queue') {
        // Avanza andando; parado, cada uno a lo suyo
        this.stepTo(n.p, n, n.tx, n.tz, 1.5, dt, Math.PI / 2, false);
        if (steerSpeed(n) > 0.08) animatePerson(n.p, dt, 'walk');
        else this.queueMood(n, dt);
      } else if (n.mode === 'toWc') {
        // Al acercarse a su cabina, la abre
        if (Math.hypot(r.x - (WC_X - 0.62), r.z - WC_Z[n.wc]) < 1.3) this.wcDoors[n.wc].hold(0.5);
        if (this.stepTo(n.p, n, n.tx, n.tz, 1.6, dt, undefined, true, this.movingAvoid, n.circle) && n.next) {
          [n.tx, n.tz] = n.next;
          n.next = undefined;
        } else if (!n.next && Math.hypot(n.p.root.position.x - n.tx, n.p.root.position.z - n.tz) < 0.12) {
          // Dentro: se da la vuelta, de cara a la puerta, y la cierra
          n.mode = 'closing';
          n.t = 0.7;
          this.wcBusyT[n.wc] = this.gasNpc ? 4 + Math.random() * 3 : 12 + Math.random() * 10;
          this.wcRes[n.wc] = false;
          this.wcDoors[n.wc].hold(0.7);
        }
      } else if (n.mode === 'closing') {
        faceTo(n.p.root, -Math.PI / 2, dt, 8);
        animatePerson(n.p, dt, 'idle');
        n.t = (n.t ?? 0) - dt;
        if (n.t <= 0 && this.wcDoors[n.wc].open < 0.3) {
          this.hide(n);
          const d = pp.distanceTo(this.v1.set(WC_X, 0, WC_Z[n.wc]));
          if (d < 12) audio.knock(0.5 / (1 + d * 0.3), 160, 0.1); // el pestillo
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
    // Las puertas no se abren solas al pasar alguien: solo cuando alguien entra o sale (las ocupadas, con alguien
    // dentro, siempre cerradas; las averiadas, nunca). Gas, al entrar en la suya, la abre al llegar
    if (this.gasDoor >= 0 && Math.hypot(pp.x - (WC_X - 0.62), pp.z - WC_Z[this.gasDoor]) < 1.3) this.wcDoors[this.gasDoor].hold(0.5);
    this.wcWho.length = 0;
    for (const d of this.wcDoors) d.update(dt, this.wcWho, this.camera.position);
    // De vez en cuando, en una ocupada, alguien se mueve dentro (la puerta da un golpecito)
    if (Math.random() < dt * 0.25) {
      const busy = WC_Z.map((_, k) => k).filter((k) => !WC_BROKEN.includes(k) && !this.wcFree(k) && this.wcDoors[k].open === 0);
      const k = busy[Math.floor(Math.random() * busy.length)];
      if (k !== undefined && pp.distanceTo(this.v1.set(WC_X, 0, WC_Z[k])) < 9) {
        this.wcShake[k] = 0.18;
        audio.knock(0.18, 200, 0.05);
      }
    }
    // Lo que se dice en la cola mientras Gas espera en ella
    if (this.gasNpc && this.queue.includes(this.gasNpc) && !this.busyDialog()) {
      this.banterT -= dt;
      if (this.banterT <= 0) {
        this.banterT = 7 + Math.random() * 5;
        bark('Un señor de Telde', CONCERT.queueBanter[this.banterI++ % CONCERT.queueBanter.length]);
      }
    }
    // (la puerta que no se abre traquetea un momento)
    this.wcShake.forEach((t, i) => {
      if (t <= 0) return;
      this.wcShake[i] = t - dt;
      this.wcDoors[i].leaf.rotation.y += Math.sin(this.t * 70) * 0.04 * Math.min(1, t * 3);
    });
    this.paintToilets();
  }

  /** Cómo espera cada uno en la cola, parado: con el móvil, bailando lo que suena, impaciente o quieto. */
  private queueMood(n: Npc, dt: number) {
    const p = n.p;
    faceTo(p.root, Math.PI / 2, dt, 4);
    switch (n.mood) {
      case 'dance':
        animatePerson(p, dt, 'dance', 0, this.t * Math.PI * 2 + n.walk);
        break;
      case 'impatient':
        // Gesticula de vez en cuando, mirando a las cabinas
        animatePerson(p, dt, Math.sin(this.t * 0.7 + n.walk) > 0.6 ? 'talk' : 'idle');
        break;
      case 'phone':
        animatePerson(p, dt, 'idle');
        p.armR.rotation.x = -1.3;
        p.elbowR.rotation.x = -1.1;
        p.head.rotation.x = 0.35;
        break;
      default:
        animatePerson(p, dt, 'idle');
    }
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
    const t = this.tailSpot(new THREE.Vector3());
    const first = this.trip === 1;
    // A la cola, de verdad: avanza cuando los de delante entran; cuando le toca y hay cabina, entra y dentro, el urinario
    this.wcPlan = { hard: first ? 0 : 1, lines: first ? SIDE.pee.first : [], next: first ? () => this.startSeek() : () => this.afterTrip() };
    this.gasMayEnter = false;
    this.auto = { p: this.gas, st: { walk: 0 }, pts: [[t.x, t.z]], speed: 1.3, face: Math.PI / 2, done: () => this.gasJoinQueue() };
    audio.whoosh();
    this.updateHud();
    const chat = CHATS.temon;
    if (first) {
      // Fito empieza el temón: Gas se lo cuenta por el chat y Azul lo graba desde su sitio (mientras, la cola avanza)
      later(() => phoneChat({ ...chat, msgs: chat.msgs.slice(0, 2) }, () => {
        this.phase = 'film';
        dialogue(CONCERT.filmIntro, () => this.startFilm());
      }), 1500);
    } else {
      later(() => dialogue(SIDE.pee.again, () => (this.gasMayEnter = true)), 1500);
    }
  }

  /** Gas se pone el último de la cola (y la cola va más deprisa: cada uno entra y sale en un momento). */
  private gasJoinQueue() {
    const st: Npc = { p: this.gas, mode: 'queue', tx: 0, tz: 0, wc: -1, walk: 0, circle: { x: 1e4, z: 1e4, r: 0.32 } };
    this.gasNpc = st;
    if (!this.queue.includes(st)) this.queue.push(st);
    // (los de delante ya no tardan tanto: si no, era esperar un minuto mirando)
    WC_Z.forEach((_, i) => {
      if (!WC_BROKEN.includes(i) && this.wcBusyT[i] > 0 && this.wcBusyT[i] < Infinity) this.wcBusyT[i] = Math.min(this.wcBusyT[i], 1.5 + Math.random() * 3);
    });
    while (this.queue.indexOf(st) > 4) {
      // (como mucho cuatro delante: los primeros entran ya)
      const n = this.queue.shift()!;
      this.hide(n);
    }
  }

  /** Le toca a Gas y la cabina i está libre: va, se le abre la puerta, entra y, dentro, el urinario. */
  private gasEnterWc(i: number) {
    const plan = this.wcPlan;
    this.gasNpc = null;
    this.wcRes[i] = true;
    this.gasDoor = i;
    this.auto = {
      p: this.gas,
      st: { walk: 0 },
      pts: [[WC_X - 1.0, WC_Z[i]], [WC_X - 0.2, WC_Z[i]]],
      speed: 1.3,
      done: () => {
        // Dentro, se da la vuelta (de cara a la puerta) y la cierra: la cabina queda ocupada (en rojo)
        this.gasDoor = -1;
        this.gasTurn = -Math.PI / 2;
        this.wcRes[i] = false;
        this.wcBusyT[i] = Infinity;
        later(() => {
          this.gasTurn = null;
          this.gas.root.visible = false;
          audio.knock(0.4, 160, 0.1);
          const go = () => later(() => fadeFlash(() => this.enterCabin(plan?.hard ?? 0, i, plan?.next ?? (() => this.startSeek())), 450), 300);
          if (plan?.lines.length) later(() => dialogue(plan.lines, go), 400);
          else go();
        }, 900);
      },
    };
  }

  /**
   * La segunda vez: las gafas de sol se las ha dejado en una cabina. Va directo a mirar (sin hacer cola: los de la
   * cola protestan) y las busca puerta por puerta, andando por la fila de cabinas de verdad: las averiadas no se
   * abren, en las ocupadas contestan desde dentro y en las libres se asoma (se ve la cabina por dentro, con su repisa).
   */
  private glassesTrip() {
    this.input.reset();
    this.hud.setAction(null);
    this.walker.stop();
    this.trip++;
    this.phase = 'glasses';
    this.glassOpened.clear();
    this.pickGlassesCabin();
    this.updateHud();
    bark('Un señor de Telde', CONCERT.queueComplain);
    later(() => bark('Gas', CONCERT.glassesReply), 1700);
    later(() => bark('Gas', SIDE.glasses.title), 3600);
  }

  /** Las gafas están en una cabina ocupada (quien está dentro las ha visto): hay que llamar y esperar a que salga. */
  private pickGlassesCabin() {
    const ok = WC_Z.map((_, k) => k).filter((k) => !WC_BROKEN.includes(k));
    const busy = ok.filter((k) => !this.wcFree(k));
    const g = busy.length ? busy[busy.length - 1] : ok[ok.length - 1];
    this.wcBusyT[g] = Infinity;
    this.wcRes[g] = false;
    this.glassCab = g;
    this.glassOut = false;
  }

  /** Llama a una cabina ocupada: le contestan desde dentro (en la de las gafas, quien está dentro sale). */
  private knockCabin(i: number) {
    this.wcShake[i] = 0.35;
    audio.knock(0.45, 240, 0.06);
    later(() => audio.knock(0.45, 240, 0.06), 160);
    if (i === this.glassCab && !this.glassOut) {
      this.busy = true;
      this.input.reset();
      this.walker.stop();
      this.hud.setAction(null);
      bark('Alguien', SIDE.glasses.hasThem);
      later(() => {
        // Sale: la puerta se abre, se aparta y la cabina se queda abierta para Gas
        const n = this.spawn(WC_X - 0.2, WC_Z[i]);
        n.mode = 'leave';
        n.p.root.rotation.y = -Math.PI / 2;
        n.tx = WC_X - 1.1;
        n.tz = WC_Z[i] + (WC_Z[i] > WC_Z[2] ? 0.9 : -0.9);
        n.next = [2 + Math.random() * 6, -2 + Math.random() * 6];
        this.wcDoors[i].hold(6);
        this.wcBusyT[i] = 0;
        this.wcRes[i] = true; // (nadie de la cola se la quita: es para Gas)
        this.glassOut = true;
        later(() => {
          bark('Alguien', SIDE.glasses.handed);
          this.busy = false;
        }, 900);
      }, 2400);
      return;
    }
    bark('Alguien', SIDE.glasses.knockReply[this.knocks++ % SIDE.glasses.knockReply.length]);
  }

  /** Abre una cabina libre y se asoma: la cabina por dentro, desde la puerta, mirando a la repisa. */
  private peekCabin(i: number) {
    const isIt = i === this.glassCab;
    this.glassOpened.add(i);
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.wcRes[i] = true;
    this.wcDoors[i].hold(4);
    audio.knock(0.25, 420, 0.06);
    later(() =>
      fadeFlash(() => {
        this.cabin.group.visible = true;
        this.cabin.glasses.visible = isIt;
        const fov0 = this.camera.fov;
        this.cabinView = (dt) => {
          const c = this.camera;
          this.cabin.world(0.12, 1.62, -0.5, c.position);
          c.lookAt(this.cabin.world(this.cabin.shelf.x, this.cabin.shelf.y - 0.05, this.cabin.shelf.z, this.tmpV));
          c.fov += ((c.aspect < 1 ? 78 : 64) - c.fov) * Math.min(1, dt * 6);
          c.updateProjectionMatrix();
        };
        later(() => {
          if (isIt) {
            bark('Gas', SIDE.glasses.found);
            comicWord('¡AQUÍ!', 'perfect');
            audio.luck();
            vibrate([20, 30, 20]);
          } else bark('Gas', SIDE.glasses.empty[(this.glassOpened.size - 1) % SIDE.glasses.empty.length]);
        }, 700);
        later(
          () =>
            fadeFlash(() => {
              this.cabinView = null;
              this.cabin.group.visible = false;
              this.camera.fov = fov0;
              this.camera.updateProjectionMatrix();
              this.wcRes[i] = false;
              if (isIt) {
                this.glassCab = -1;
                this.phase = 'wc';
                this.updateHud();
                this.afterTrip();
              } else this.busy = false;
            }, 450),
          2600,
        );
      }, 400),
    450);
  }

  /** ¿Hay un diálogo o un chat abierto? */
  private busyDialog() {
    return !!document.querySelector('.dialogue, .phone-overlay') || this.phase === 'film';
  }

  /** Vuelve del baño: otra canción que se ha perdido, y a buscar a Azul. */
  private afterTrip() {
    this.missed++;
    bark('Gas', CONCERT.songLost[Math.min(this.missed - 1, CONCERT.songLost.length - 1)]);
    later(() => this.startSeek(), 900);
  }

  private enterCabin(hard: number, i: number, next: () => void) {
    this.side = new PeeAim3D(this.cabin, this.camera, hard, () => {
      this.side = null;
      fadeFlash(() => {
        // Sale: la puerta se abre, la cabina queda libre y él vuelve al concierto
        this.qShift = 0;
        this.gas.root.visible = true;
        this.gas.root.position.set(WC_X - 0.2, 0, WC_Z[i]);
        this.gas.root.rotation.y = this.walker.facing = -Math.PI / 2;
        this.wcBusyT[i] = 0;
        this.wcRes[i] = true; // (hasta que salga, que no entre nadie)
        this.wcDoors[i].hold(2.2);
        this.auto = {
          p: this.gas,
          st: { walk: 0 },
          pts: [[WC_X - 1.8, WC_Z[i]]],
          speed: 1.3,
          done: () => {
            this.wcRes[i] = false;
            next();
          },
        };
      }, 450);
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
    later(() => phoneChat({ ...chat, msgs: chat.msgs.slice(2, 6) }, () => (this.gasMayEnter = true)), 1500);
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
        setObj('🛫 Gran Canaria');
        break;
      case 'gateQueue':
        setObj(this.gateStep === 'ask' ? '🎫' : '🛫 Gran Canaria');
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
      case 'glasses':
        setObj('🕶️');
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
      // (en el aeropuerto, ni flecha ni marcador: la puerta y a Gas se los encuentra ella)
      case 'gateQueue':
        return this.gateStep === 'ask' ? GATE_SCAN : null;
      case 'beers':
        return this.beers ? (this.beers.stage === 'carry' ? this.beers.friendAt : BAR_POS) : null;
      case 'toWc':
        return this.trip === 1 ? this.v1.set(WC_X - 1.3, 0, WC_Z[2]) : this.tailSpot(this.v1);
      case 'glasses': {
        // La siguiente cabina libre sin mirar
        const k = WC_Z.findIndex((_, i) => !WC_BROKEN.includes(i) && this.wcFree(i) && !this.glassOpened.has(i));
        return k >= 0 ? this.v1.set(WC_X - 1.2, 0, WC_Z[k]) : null;
      }
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
    const walking = !this.busy && !this.auto && (this.phase === 'beers' || this.phase === 'toWc' || this.phase === 'glasses' || this.phase === 'airport' || this.phase === 'seek' || this.phase === 'arrivals');
    // (andando sola por la cola de embarque o hasta la del baño: la lleva el juego, no el joystick)
    // (Gas en la cola del baño también: anda con la cola, no con el joystick)
    const scripted = !!this.auto || this.phase === 'gateQueue' || this.gasTurn !== null || (!!this.gasNpc && this.queue.includes(this.gasNpc));
    this.invuln -= dt;
    if (this.phase === 'airport' && !this.busy) this.stepAirport(dt);
    if (this.airGroup.parent && this.player.root.position.x > 100 && this.player.root.position.x < 350) this.stepAirPeople(dt);
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
    this.side?.update(dt);
    if (this.gasTurn !== null) {
      faceTo(this.gas.root, this.gasTurn, dt, 7);
      animatePerson(this.gas, dt, 'idle');
    }
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
      // (hablando y andando a la vez: anda; si no, se deslizaba con los gestos de hablar)
      else if (this.talkers.has(this.player) && mag < 0.03) animatePerson(this.player, dt, 'talk');
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
    // La gente sentada en las puertas de embarque
    if (this.airGroup.parent)
      for (const p of this.seated) {
        animatePerson(p, dt, 'idle');
        seatPose(p);
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
    // (los puntitos de las linternas se veían como manchas blancas sobre la gente: fuera)
    this.phones.visible = false;
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
    } else if (walking && this.phase === 'glasses') {
      // Delante de la puerta de una cabina: según cómo esté, abrirla, llamar o nada (y Gas lo comenta)
      let near = -1;
      for (let i = 0; i < WC_Z.length; i++) if (Math.abs(pp.z - WC_Z[i]) < 0.62 && pp.x > WC_X - 2.3 && pp.x < WC_X - 0.5) near = i;
      if (near >= 0) {
        const i = near;
        if (i === this.glassCab && this.glassOut) {
          label = SIDE.glasses.door;
          action = () => this.peekCabin(i);
        } else if (WC_BROKEN.includes(i) || this.glassOpened.has(i)) {
          if (this.doorSaid !== i) {
            this.doorSaid = i;
            bark('Gas', WC_BROKEN.includes(i) ? SIDE.glasses.broken : SIDE.glasses.already);
          }
        } else if (!this.wcFree(i)) {
          label = SIDE.glasses.knock;
          action = () => this.knockCabin(i);
        } else {
          label = SIDE.glasses.door;
          action = () => this.peekCabin(i);
        }
      } else this.doorSaid = -1;
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
      dialogue(CONCERT.ending, () => phoneChat(CHATS.hastaLuego, () => {
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
    if (this.phase === 'film' || this.side) return;
    if (this.cabinView) {
      this.cabinView(dt);
      return;
    }
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
      this.cabinView = null;
      this.cabin.group.visible = false;
      this.qShift = 0;
      this.queue = this.queue.filter((n) => n.p !== this.gas);
      this.gasNpc = null;
      this.gasMayEnter = false;
      if (this.glassCab >= 0) this.wcBusyT[this.glassCab] = 5;
      this.glassCab = -1;
      this.glassOut = false;
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
          this.azul.root.position.set(GATE_X, 0, GZ - 4.2);
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
          this.wcPlan = { hard: 0, lines: SIDE.pee.first, next: () => this.startSeek() };
          this.gasMayEnter = false;
          this.gasJoinQueue();
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
