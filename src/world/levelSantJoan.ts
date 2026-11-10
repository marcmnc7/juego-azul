import * as THREE from 'three';
import { steerTo, type SteerState } from '../core/steer';
import { Trail } from '../core/follow';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { Sky, Sun, toon, vibrate, applyShadows } from '../core/gfx';
import { comicMood } from '../core/comic';
import { comicHaloTexture } from '../core/comicTiles';
import { setSurface, Surf } from '../core/surfaces';
import { dust } from '../core/dust';
import { Lost } from '../core/lost';
import { TownHD } from './hd/townHD';
import { SANTJOAN } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeHorse, animatePerson, vertexMat, makeCrowd, streetLamp, type CrowdLike, crowdPose, newCrowdPose, type Person, type Donkey, type PersonLook } from '../entities/models';
import { Particles } from '../entities/fx';
import { hud, dialogue, Hud, DebugItem, later, phoneChat, fadeFlash, bark, comicWord, closeDialogue } from '../ui/ui';
import { hugFor } from '../entities/embrace';
import { horsePrint, shirtPrint } from '../entities/print';
import { buildAzulHouse, STREET_Z, DOOR, GARLAND_OFF } from './levelCena';
import type { Door } from './door';
import { CHATS } from '../data/chats';
import { canvasTex, mergedPlanes } from './deco';
import type { Box2 } from './ferreries';
import { makeTaxi, TaxiRide, taxiFree, taxiSeat, taxiSide, type Taxi } from './camiFarola';
import { limpPose } from '../entities/limp';
import { LimpPair } from '../entities/limpPair';
import { NutThrow, NUTS_NEED } from './sideGames';
import { SIDE } from '../data/story';
import { rigPost } from '../entities/rig';
import { twoBone } from '../entities/embrace';
import { CarRig } from '../entities/models';
import { cinema } from '../core/cinema';
import { buildSurroundings, collidersBox } from './surround';
import { BORN, BORN_RISE, CORREUS, bornHeight, buildBorn } from './born';
import { clock, type Level, type LevelDone, disposeScene } from './level';
import { beacon } from '../core/beacon';

/** La víspera, solo lo bonito: que viene a las 10.45 y el «Te quiero» (Marc pidió recortar el resto). */
const LA_NOCHE = {
  ...CHATS.laNoche,
  msgs: CHATS.laNoche.msgs.filter((m) => ['Mañana a las 10.45 estoy ahi', 'Descansa ahora', 'Bona nit', 'Te quiero', 'Buenas noches 🫂'].includes(m.text)),
};

// Capítulo 6 · Sant Joan en Ciutadella, 23 de junio de 2026. «Dime exacto».
// Por la tarde, al acabar la bandera, Azul va desde la Plaça Espanya hacia el Born por Ses Voltes,
// entre la gente y los caballos que se ponen de manos (tocarles el pecho da suerte). En Correus, Gas lleva
// media hora dando vueltas: «Dime exacto pls». Le mandas una foto exacta, con el obelisco, y te encuentra.
// Se abrazan (sin bailes), y van juntos a Sa Plaça d'es Bè a hacer botar caballos. Ya de noche, Gas cojo, al
// taxi de la Plaça Espanya (a medio camino se tiene que parar), el taxi por el Camí de sa Farola hablando, pagar,
// y en casa de Azul, de madrugada, abrir sin hacer ruido: a dormir, los dos.
// Todos los chats son trozos literales; lo inventado está marcado en story.ts.
//
// Estilo de tebeo como el cap. 1 (y lo aprendido en el 2, docs/estilo-comic/GUIA-migracion.md):
// - De día, la luz y el cielo del cap. 1 (nubes, sol, ambiente ×0,35). De noche, el perfil «noche» del cap. 2.
// - Ninguna lámpara ilumina nada: ni farolas ni faroles ni faros. Solo se ven encendidas (su halo de tebeo).
// - Sin pistas: la flecha, la columna y el pin de ubicación solo salen a los 40 s sin avanzar (Lost).
// - Los avisos de texto, en boca de quien los diría (bark); los aciertos y golpes, onomatopeyas (comicWord).

type Phase = 'intro' | 'hunt' | 'exact' | 'coming' | 'meet' | 'nuts' | 'be' | 'taxi' | 'ride' | 'home' | 'ending' | 'done';

// Plano (metros): el Born en el origen; hacia el este, el Carrer Major des Born con la Catedral, Ses Voltes
// y, al final, la Plaça Nova y la Plaça Espanya
const STREET = { minX: 18, maxX: 70, minZ: -4.4, maxZ: 4.4 };
const SHOP_KINDS = [
  { name: 'Avarques', bg: '#7a3a22', wood: 0x4a2c1a },
  { name: 'Sobrassada', bg: '#7a1f1f', wood: 0x3a2a20 },
  { name: 'Moda', bg: '#1f3a5a', wood: 0x1f3a2a },
  { name: 'Joieria', bg: '#2a2a3a', wood: 0x2a2424 },
];
const ESPANYA = { minX: 70, maxX: 90, minZ: -12, maxZ: 12 };
const PINS = [new THREE.Vector3(CORREUS.x + 2, 0, CORREUS.z - 1.2)]; // Correus
const START = new THREE.Vector3(82, 0, 0); // Plaça Espanya
/** Sa Plaça d'es Bè: la plaza donde se hacen botar los caballos. */
const BE = new THREE.Vector3(113, 0, 0); // pasada la Plaça Espanya, por una calle: se llega andando
const BE_BOX: Box2 = { minX: BE.x - 15, maxX: BE.x + 15, minZ: BE.z - 11, maxZ: BE.z + 11 };
const BE_HORSES = 3;
const BE_R = 4.4;
const BE_NEED = 3;
/** El taxi, en la Plaça Espanya, junto a las casas del norte. */
const TAXI = new THREE.Vector3(77, 0, 10.9); // (junto a la fachada, entre dos árboles: la puerta queda libre)
/** Dónde se sube (la puerta de atrás, del lado de la plaza). */
const TAXI_DOOR = new THREE.Vector3(TAXI.x + 0.3, 0, TAXI.z - 1.55);
/** Cuánto dura el empujón a un caballo (s). */
const PUSH = 1.05;
const STREET_HORSES = 2;
const REACH = 6;
const AISLES: [number, number][] = [[19, 0], [2, 14.5], [-19, -6.5], [-19, 7]];
/** Distancia de (x, z) al segmento que va del obelisco a (ax, az). */
function segDist(x: number, z: number, ax: number, az: number) {
  const t = Math.max(0, Math.min(1, (x * ax + z * az) / (ax * ax + az * az)));
  return Math.hypot(x - ax * t, z - az * t);
}
const HORSE_R = 7.6;
const WARN = 0.8;
const REAR = 1.8;
const TOUCH_R = 3.2;
/** Lo que dura un bocadillo en pantalla (la misma cuenta que ui.ts): para repartir lo que hablan en el taxi. */
const barkTime = (text: string) => (2100 + Math.min(2400, text.length * 55)) / 1000;

// La piedra de la Catedral, su pórtico y las casas de marès: sillares (D6a), no encalado
const MARES = 0xdcc49a;
const MARES_D = 0xc9ad80;
const PORTICO = 0xe6d9bc;
setSurface(MARES, Surf.Mares);
setSurface(MARES_D, Surf.Mares);
setSurface(PORTICO, Surf.Mares);
const IRON = 0x1e1e1e;
/** Cristal de los faroles de Ses Voltes (el mismo de las farolas del Born): brilla solo de noche (Surf.Glow). */
const LANTERN = 0xf4e6c0;

interface Horse {
  d: Donkey;
  /** Los de Ses Voltes van y vienen por la calle; los del Born dan vueltas al obelisco. */
  street?: { dir: number };
  /** Los de Sa Plaça d'es Bè dan vueltas en corro y se ponen de manos más a menudo. */
  plaza?: boolean;
  angle: number;
  warnT: number;
  rearT: number;
  /** El empujón que le dan al pecho: sube más y da un bote. */
  boostT?: number;
  /** Se ha desbocado: viene corriendo por la calle. */
  charge?: boolean;
  nextRear: number;
  walk: number;
  /** Velocidad con signo (calle) o angular (Born): cambia poco a poco, un caballo pesa 500 kg. */
  v?: number;
  alert: THREE.Sprite;
  touched: boolean;
}

/** El final del día, en casa de Azul. */
interface Home {
  scene: THREE.Scene;
  sky: Sky;
  sun: Sun;
  colliders: Box2[];
  gate: Door;
  door: Door;
  /** El haz de Sa Farola, que gira. */
  beam: THREE.Object3D;
  who: THREE.Vector3[];
  marker: THREE.Object3D;
  taxi: Taxi;
  rig: CarRig;
  /** El taxi llega en marcha y frena, se paga, se bajan, se va; luego, a pie hasta la puerta. */
  stage: 'arrive' | 'pay' | 'out' | 'leave' | 'gone';
  v: number;
  outT: number;
  leaveT: number;
  homeLine: boolean;
  /** La puerta de casa, abierta con la llave (si no, no se abre al acercarse). */
  unlocked: boolean;
}

let alertTex: THREE.Texture | null = null;
function alertTexture() {
  if (alertTex) return alertTex;
  alertTex = canvasTex((ctx) => {
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
  }, 128, 128);
  return alertTex;
}

/** Halo de una lámpara encendida de noche, ya en versión de tebeo (si no, salía un segundo de foto y luego cambiaba). */
let haloMat: THREE.SpriteMaterial | null = null;
function nightHalo() {
  if (haloMat) return haloMat;
  haloMat = new THREE.SpriteMaterial({ map: comicHaloTexture(), color: 0xffc070, transparent: true, depthWrite: false });
  haloMat.userData.comicGlow = true;
  return haloMat;
}

/**
 * D6b: lo que va pegado a un hueso (el bombín del caixer, el estampado de la camiseta) es parte de la persona. Se
 * marca con userData.person para que el cómic lo trate como a ella (cuando comic.ts lo respete en mallas normales:
 * ver el informe de la migración).
 */
function markAccessories(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) return;
    for (let a = o.parent; a && a !== root; a = a.parent)
      if ((a as THREE.Bone).isBone) {
        o.userData.person = true;
        return;
      }
  });
}

/** Una cuerda de banderines o un cable: barra fina entre dos puntos (3,5 cm: más fina, la tinta tiembla). */
function cord(m: Merger, a: THREE.Vector3, b: THREE.Vector3, t = 0.035, color = IRON) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const L = Math.hypot(dx, dy, dz) || 1;
  m.add(G.box, color, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, Math.atan2(dz, dy), 0, -Math.asin(dx / L), t, L, t);
}

const LOOKS: PersonLook[] = [
  // Junio en Menorca: todo el mundo en manga corta y pantalón corto
  { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short', male: true, shorts: true },
  { skin: 0xd9a27c, shirt: 0xffffff, pants: 0x6f8fb8, hair: 0x5a3a22, hairStyle: 'long', shorts: true },
  { skin: 0xf0c8a6, shirt: 0x1f5fbf, pants: 0xc9b48a, hair: 0xb07a3a, hairStyle: 'short', male: true, shorts: true },
  { skin: 0xc98e64, shirt: 0xd7263d, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'bun', shorts: true },
  { skin: 0xe2b08c, shirt: 0xffffff, pants: 0x2a2a2a, hair: 0x3a2414, hairStyle: 'pony', shorts: true },
];

/** Sol de la tarde (las cinco y pico de un 23 de junio): todavía alto, desde el oeste. */
const SUN_DIR = new THREE.Vector3(-0.5, 0.8, 0.4).normalize();

export class LevelSantJoan implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private gasTrail = new Trail();
  /** De noche, él apoyado en ella. */
  private pair: LimpPair | null = null;
  private nuts: NutThrow | null = null;
  private beTouched = 0;
  private home: Home | null = null;
  private ride: TaxiRide | null = null;
  private chargeDone = false;
  private pushT = 0;
  private pushHorse: Horse | null = null;
  private pushGas = false;
  private pushPost: (() => void) | null = null;
  private phase: Phase = 'intro';
  private player: Person;
  private walker: Walker;
  private gas: Person;
  private gasSteer: SteerState = {};
  private horses: Horse[] = [];
  private colliders: Box2[] = [];
  private people: Circle[] = [];
  private pose = newCrowdPose();
  private cheer = 0.35;
  private crowds: { people: CrowdLike; female: boolean; base: { x: number; z: number; ry: number; ph: number }[] }[] = [];
  private bags: { obj: THREE.Object3D; taken: boolean }[] = [];
  private bagCount = 0;
  private luck = 0;
  private hits = 0;
  private invuln = 0;
  private reached = 0;
  private misses = 0;
  private pinPos = new THREE.Vector3();
  /** Gas ha mandado su ubicación (Correus): se llega allí. */
  private pinOn = false;
  /** El pin de la ubicación, flotando: solo si se ha perdido. */
  private pinObj: THREE.Group;
  private map: HTMLCanvasElement;
  private mapT = 0;
  private sky: Sky;
  private daySky: Sky;
  private nightSky: Sky | null = null;
  private sun: Sun;
  /** La luz de ambiente propia de la escena (de día, la del cap. 1; de noche, la del cap. 2). */
  private hemi: THREE.HemisphereLight;
  private night = false;
  /** Halos de las farolas del Born, de los faroles de Ses Voltes y de la Plaça Espanya: solo de noche. */
  private halos: THREE.Sprite[] = [];
  /** El taxi de la Plaça Espanya (de noche) y su obstáculo. */
  private plazaTaxi: Taxi | null = null;
  private plazaTaxiBox: Box2 = { minX: TAXI.x - 2.25, maxX: TAXI.x + 2.25, minZ: TAXI.z - 1, maxZ: TAXI.z + 1, low: true };
  /** El caballo cuyo caixer acaba de hablar (para que el bocadillo salga de él). */
  private talker: Horse | null = null;
  /** Gas la ve entre la gente (una vez). */
  private spotted = false;
  /** De camino al taxi, Gas tiene que pararse un momento: cuánto queda, si ya ha pasado y si ella ha tirado de él. */
  private restT = 0;
  private restDone = false;
  private restNag = false;
  private taxiFrom = 30;
  /** En el taxi: lo que llevan hablado y cuándo toca la siguiente frase. */
  private rideT = 0;
  private rideI = 0;
  private rideAt = 0;
  private rideTalk = false;
  /** Pistas (flecha, columna, pin, rombo de la puerta) solo a los 40 s sin avanzar. */
  private lost = new Lost();
  private busy = true;
  private t = 0;
  private playTime = 0;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private bounds: Box2 = { minX: BORN.minX + 0.5, maxX: BE_BOX.maxX - 0.5, minZ: BORN.minZ + 0.5, maxZ: BORN.maxZ - 0.5 };
  private beIn = false;
  private hd: TownHD | null = new TownHD();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    // Tarde de junio, como el día del cap. 1: el mismo cielo de tebeo con su sol y sus nubes, la misma niebla y el
    // mismo reparto de la luz de ambiente (antes, sin nubes ni sol, niebla cálida y el doble de ambiente)
    sc.fog = new THREE.Fog(0xcfe0ee, 70, 180);
    this.daySky = new Sky({ top: 0x2a6fd0, mid: 0x7fbdf2, bottom: 0xf6ead2, sun: { color: 0xfff4dc, dir: SUN_DIR, size: 70 }, clouds: { count: 11, tint: 0xffffff } });
    this.sky = this.daySky;
    sc.add(this.sky.group);
    sc.userData.hemiScale = 0.35;
    this.hemi = new THREE.HemisphereLight(0xeaf2ff, 0x8a7a64, 1.0);
    sc.add(this.hemi);
    this.sun = new Sun(sc, 0xfff1dc, 3.4, SUN_DIR, 24);

    this.buildTown();
    {
      // Ciutadella sigue alrededor: manzanas de casas y lomas al fondo
      const core = collidersBox(this.colliders);
      buildSurroundings(sc, { keepOut: [core], half: 120, center: { x: (core.minX + core.maxX) / 2, z: (core.minZ + core.maxZ) / 2 }, cell: 11, town: true, field: false, seed: 9 });
    }
    this.buildCrowd();
    this.buildHorses();
    this.buildBags();
    this.fx = new Particles(sc);

    // Los dos con la misma camiseta: blanca, con un caballo dibujado (y pantalón corto, como todos)
    this.player = makePerson({ ...MARGAUX_LOOK, shirt: 0xffffff, pants: 0x6f8fb8, skirt: false, shorts: true });
    shirtPrint(this.player, horsePrint(), 0.23);
    markAccessories(this.player.root);
    this.player.root.position.copy(START);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.yaw = this.walker.facing = -Math.PI / 2;

    this.gas = makePerson({ ...MARC_LOOK, shirt: 0xffffff, pants: 0x2d3a55, shorts: true });
    shirtPrint(this.gas, horsePrint(), 0.27);
    markAccessories(this.gas.root);
    this.gas.root.visible = false;
    sc.add(this.gas.root);

    // Pin de ubicación flotando sobre donde dice Gas que está (solo si se ha perdido; sin halo de foto)
    this.pinObj = new THREE.Group();
    const pm = toon({ color: 0xe53935, emissive: 0x7a0f0f });
    this.pinObj.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), pm), new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 16).rotateX(Math.PI).translate(0, -0.65, 0), pm));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.z = 0.4;
    this.pinObj.add(dot);
    this.pinObj.userData.comicBent = true;
    this.pinObj.visible = false;
    sc.add(this.pinObj);

    this.map = document.createElement('canvas');
    this.map.width = 260;
    this.map.height = 74;
    this.map.style.cssText = 'position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 74px);width:200px;height:57px;border-radius:12px;background:rgba(20,18,40,.72);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;z-index:4;display:none';
    document.body.append(this.map);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.camera.position.set(START.x + 7, 4, 0);
    this.updateHud();
    audio.startMusic('jaleo');
    later(() => {
      if (this.phase !== 'intro') return;
      const ex = CHATS.dimeExacto;
      phoneChat(CHATS.mar, () => dialogue(SANTJOAN.night, () =>
        phoneChat(LA_NOCHE, () =>
          dialogue(SANTJOAN.morning, () =>
            phoneChat([CHATS.ubi, CHATS.noTeHeVisto], () =>
              dialogue(SANTJOAN.bandera, () =>
                phoneChat({ ...ex, msgs: ex.msgs.slice(0, 6) }, () => {
                  if (this.phase !== 'intro') return;
                  this.busy = false;
                  this.phase = 'hunt';
                  this.setPin(0);
                }),
              ),
            ),
          ),
        ),
      ));
    }, 900);
  }

  get threeScene() {
    return this.home ? this.home.scene : this.ride ? this.ride.scene : this.scene;
  }

  // ---------------- Ciutadella ----------------

  private blockN = 0;
  private block(m: Merger, x0: number, x1: number, z0: number, z1: number, h: number, color: number, collide = true, stone = false) {
    // Cada bloque unos milímetros distinto (y distinto de los del Born): dos manzanas en el mismo plano parpadean
    const e = Math.min(x1 - x0, 0.006 + (this.blockN++ % 6) * 0.012 + 0.012);
    if (this.hd) {
      this.hd.wall(x0, x1, z0, z1, h, color, { stone });
      if (collide) this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
      return;
    }
    m.add(G.box, color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0 - (x1 - x0 > 0.1 ? e : 0), h, z1 - z0 - e);
    m.add(G.box, 0xcdbb98, (x0 + x1) / 2, h + 0.12 + e / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0 + 0.2 - e, 0.24, z1 - z0 + 0.2 - e);
    if (collide) this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  }
  /** Ventanas con persianas verdes menorquinas y balcones en la cara que da a la calle. */
  /** Una tienda bajo los soportales: marco, zócalo, puerta, rótulo, estantes y su género, según el oficio. */
  private shopFront(m: Merger, x: number, wz: number, side: number, k: number, signs: Map<string, { w: number; h: number; x: number; y: number; z: number; ry: number }[]>) {
    const kind = SHOP_KINDS[k % SHOP_KINDS.length];
    const z = (d: number) => wz - side * d; // d metros hacia la calle
    const wood = kind.wood;
    m.add(G.box, 0x241a14, x, 1.45, wz, 0, 0, 0, 2.1, 2.9, 0.12); // hueco oscuro
    m.add(G.box, 0xefdcb4, x, 1.48, z(0.07), 0, 0, 0, 1.92, 2.0, 0.02); // el fondo iluminado
    for (const s of [-1, 1]) m.add(G.box, wood, x + s * 1.0, 1.45, z(0.1), 0, 0, 0, 0.12, 2.9, 0.1);
    m.add(G.box, wood, x, 2.74, z(0.1), 0, 0, 0, 2.1, 0.32, 0.1);
    m.add(G.box, wood, x, 0.27, z(0.1), 0, 0, 0, 2.1, 0.54, 0.1);
    // Puerta de madera con cristal arriba, a un lado
    const dx = k % 2 ? -0.62 : 0.62;
    m.add(G.box, wood, x + dx, 1.24, z(0.11), 0, 0, 0, 0.72, 2.2, 0.06);
    m.add(G.box, 0x9fc4e0, x + dx, 1.72, z(0.145), 0, 0, 0, 0.5, 0.92, 0.015);
    m.add(G.sphere, 0xc8ccd0, x + dx - 0.27 * Math.sign(dx), 1.08, z(0.16), 0, 0, 0, 0.05, 0.05, 0.05);
    // El escaparate: del lado contrario a la puerta
    const wx = x - dx * 0.56, W = 1.1;
    m.add(G.box, wood, wx, 1.48, z(0.11), 0, 0, 0, 0.03, 1.9, 0.03);
    for (const y of [1.02, 1.56]) m.add(G.box, 0x7a5a3a, wx, y, z(0.12), 0, 0, 0, W, 0.03, 0.12);
    const row = (n: number) => Array.from({ length: n }, (_, i) => wx - W / 2 + (W * (i + 0.5)) / n);
    if (kind.name === 'Avarques') {
      for (const y of [0.6, 1.04, 1.58]) row(3).forEach((px, i) => {
        const c = [0xb5482e, 0x2f6b8a, 0xd8a23a, 0x3f7a4a, 0xc23030][(i + Math.round(y * 3) + k) % 5];
        for (const o of [-0.055, 0.055]) m.add(G.rbox, c, px + o, y + 0.035, z(0.13), 0, 0, 0, 0.09, 0.06, 0.24);
      });
    } else if (kind.name === 'Sobrassada') {
      m.add(G.box, 0x7a5a3a, wx, 2.2, z(0.13), 0, 0, 0, W, 0.03, 0.03);
      row(5).forEach((px, i) => {
        m.add(G.box, 0xd8cfb4, px, 2.14, z(0.13), 0, 0, 0, 0.01, 0.1, 0.01);
        m.add(G.capsule, i % 2 ? 0xa23a22 : 0x8a2e1c, px, 1.94 - (i % 2) * 0.05, z(0.13), 0, 0, 0, 0.11, 0.17, 0.11);
      });
      for (const y of [0.6, 1.04, 1.58]) row(4).forEach((px, i) => m.add(G.cyl, i % 2 ? 0xe2c79a : 0xd9a441, px, y + 0.1, z(0.13), 0, 0, 0, 0.14, 0.2, 0.14));
    } else if (kind.name === 'Moda') {
      m.add(G.box, 0x9aa3ad, wx, 2.22, z(0.13), 0, 0, 0, W, 0.02, 0.02);
      row(4).forEach((px, i) => {
        const c = [0xd7263d, 0xf2f2f0, 0x2a3a5a, 0xe8b23a][(i + k) % 4];
        m.add(G.rbox, c, px, 1.86, z(0.13), 0, 0, 0, 0.22, 0.56, 0.06);
        for (const s of [-1, 1]) m.add(G.rbox, c, px + s * 0.12, 1.98, z(0.13), 0, 0, s * 0.25, 0.06, 0.26, 0.05);
      });
      for (const y of [0.6, 1.04]) row(3).forEach((px, i) => m.add(G.rbox, [0xf2f2f0, 0x6b8fb0, 0xc98e64][(i + k) % 3], px, y + 0.06, z(0.13), 0, 0, 0, 0.26, 0.1, 0.18));
    } else {
      for (const y of [0.6, 1.04, 1.58]) row(3).forEach((px, i) => {
        m.add(G.box, 0x241a24, px, y + 0.02, z(0.13), 0, 0, 0, 0.28, 0.03, 0.16);
        for (let g = 0; g < 3; g++) m.add(G.sphere, i % 2 ? 0xe8c75a : 0xd9dde2, px - 0.08 + g * 0.08, y + 0.05, z(0.13), 0, 0, 0, 0.05, 0.05, 0.05);
      });
    }
    let list = signs.get(kind.name);
    if (!list) signs.set(kind.name, (list = []));
    list.push({ w: 1.9, h: 0.27, x, y: 2.74, z: z(0.16), ry: side > 0 ? Math.PI : 0 });
  }

  private facade(m: Merger, x0: number, x1: number, z: number, face: 1 | -1, floors: number, alongX = true, groundFloor = true) {
    if (this.hd) return this.hd.facade(x0, x1, z, face, floors, alongX, groundFloor);
    const len = Math.abs(x1 - x0);
    const n = Math.max(1, Math.floor(len / 3));
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        const a = Math.min(x0, x1) + (i + 0.5) * (len / n);
        const y = 1.6 + f * 3.1 + (f > 0 ? 0.6 : 0);
        const off = face * 0.06;
        if (alongX) {
          m.add(G.box, f === 0 ? 0x5a3a26 : 0x2f6b4f, a, y, z + off, 0, 0, 0, 1.1, f === 0 ? 2.4 : 1.7, 0.08);
          if (f > 0 && i % 2 === 0) m.add(G.box, 0x2a2a2a, a, y - 0.95, z + face * 0.4, 0, 0, 0, 1.6, 0.08, 0.8);
        } else {
          m.add(G.box, f === 0 ? 0x5a3a26 : 0x2f6b4f, z + off, y, a, 0, 0, 0, 0.08, f === 0 ? 2.4 : 1.7, 1.1);
          if (f > 0 && i % 2 === 0) m.add(G.box, 0x2a2a2a, z + face * 0.4, y - 0.95, a, 0, 0, 0, 0.8, 0.08, 1.6);
        }
      }
    }
  }

  private sign(text: string, x: number, y: number, z: number, ry: number, w = 3.2, bg = '#f4efe2', fg = '#2a1a2e') {
    const tex = canvasTex(
      (ctx, cw, ch) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = fg;
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, cw - 16, ch - 16);
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let size = 84;
        do ctx.font = `bold ${size}px Georgia, serif`;
        while (ctx.measureText(text).width > cw - 60 && (size -= 4) > 20);
        ctx.fillText(text, cw / 2, ch / 2 + 4);
      },
      512,
      128,
    );
    // (con luz: de noche, una placa no brilla sola; partida en trozos para que se combe con la pared de detrás)
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25, Math.max(1, Math.ceil(w / 0.4)), 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    s.position.set(x, y, z);
    s.rotation.y = ry;
    this.scene.add(s);
  }

  private buildTown() {
    const sc = this.scene;
    // Suelo de losas de marès
    const stone = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#cdbb98';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const v = 180 + Math.random() * 40;
          ctx.fillStyle = `rgb(${v},${v - 14},${v - 40})`;
          ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
        }
    });
    stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    stone.repeat.set(60, 20);
    if (this.hd) this.hd.b.box(this.hd.M.slabs, [35, -0.06, 0], [260, 0.1, 90], { tile: 3 });
    else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 90).rotateX(-Math.PI / 2), toon({ map: stone, roughness: 0.9 }));
      ground.position.x = 35;
      ground.userData.noCast = true;
      sc.add(ground);
    }

    // El Born (compartido con el capítulo 2): explanada alta con el obelisco y calle alrededor
    // (de piedra el Ajuntament y con barandilla de barrotes el balcón del Casino, desde donde tiran las avellanes)
    const born = buildBorn(sc, this.colliders, new THREE.Vector3(0, 0, 0), { voltes: true, stone: true, casinoRail: true });
    // Los halos de sus farolas, solo de noche (de día, en un tebeo, una farola no brilla)
    for (const h of born.halos) {
      h.visible = false;
      this.halos.push(h);
    }
    const m = new Merger();
    const SAND = 0xe6d2a8;
    const WHITE = 0xf4f0e6;
    const lanterns = new Merger();

    // Ses Voltes: calle de arcos blancos a los dos lados
    const shopSigns = new Map<string, { w: number; h: number; x: number; y: number; z: number; ry: number }[]>();
    for (const side of [-1, 1] as const) {
      const wallZ = side * (STREET.maxZ + 0.2);
      this.block(m, 30, STREET.maxX, side < 0 ? wallZ - 8 : wallZ, side < 0 ? wallZ : wallZ + 8, 8, WHITE);
      const pz = side * 2.9;
      for (let x = 31.2; x < STREET.maxX - 0.5; x += 2.6) {
        m.add(G.box, WHITE, x, 1.6, pz, 0, 0, 0, 0.5, 3.2, 0.5);
        this.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: pz - 0.25, maxZ: pz + 0.25 });
        // Arco entre pilar y pilar
        m.add(new THREE.TorusGeometry(1.05, 0.22, 6, 12, Math.PI), WHITE, x + 1.3, 3.15, pz, 0, 0, 0, 1, 0.8, 1.2);
      }
      // (en dos tramos: una caja de 40 m ya no se parte y no se combaba como las paredes de detrás)
      for (const [a, b] of [[30, 50], [50, STREET.maxX]]) m.add(G.box, WHITE, (a + b) / 2, 4.3, side * 3.6, 0, 0, 0, b - a, 1.2, 1.9);
      // Faroles de hierro colgados de los soportales, encima de un pilar (antes, solo halos flotando sin farol)
      for (let k = side > 0 ? 3 : 5; k <= 13; k += 5) this.lantern(lanterns, 31.2 + k * 2.6, side);
      // Bajo los arcos, escaparates de tiendas (avarques, sobrasada, ropa, joyerías) con su luz
      for (let x = 31.6, k = 0; x < STREET.maxX - 2.4; x += 2.6, k++) {
        const wz = side * (STREET.maxZ + 0.15);
        this.shopFront(m, x + 1.3, wz, side, k + (side > 0 ? 2 : 0), shopSigns);
      }
      this.facade(m, 31, STREET.maxX - 1, wallZ, (-side) as 1 | -1, 3, true, false); // abajo van los soportales
    }
    // Entre el Born y Ses Voltes, como en Ciutadella: el Carrer Major des Born y la Catedral de Menorca
    // (gótica, de marès, con el pórtico neoclásico de 1813 y el campanario). Ses Voltes empieza en la
    // plaza de la Catedral y acaba en la Plaça Nova, junto a la Plaça Espanya.
    {
      const cz0 = STREET.maxZ + 2.2; // fachada que da a la plaza de la Catedral, junto a la calle
      // (de sillería de marès: antes, encalada de color marès)
      this.block(m, 19, 30, cz0, cz0 + 16, 16, MARES, true, true);
      // Contrafuertes góticos a lo largo de la nave
      for (let x = 20; x <= 29; x += 3) {
        m.add(G.box, MARES_D, x, 7, cz0 - 0.35, 0, 0, 0, 0.9, 14, 0.7);
        this.colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: cz0 - 0.7, maxZ: cz0 });
      }
      // Pórtico neoclásico: cuatro columnas, entablamento y frontón
      for (const x of [21.6, 23.6, 25.6, 27.6]) {
        m.add(G.cyl, PORTICO, x, 3.6, cz0 - 1.6, 0, 0, 0, 0.42, 7.2, 0.42);
        this.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: cz0 - 2, maxZ: cz0 - 1.2 });
      }
      m.add(G.box, PORTICO, 24.6, 7.6, cz0 - 1.0, 0, 0, 0, 8.2, 0.8, 1.8);
      const tri = new THREE.Shape([new THREE.Vector2(-4.1, 0), new THREE.Vector2(4.1, 0), new THREE.Vector2(0, 2.2)]);
      m.add(new THREE.ExtrudeGeometry(tri, { depth: 1.6, bevelEnabled: false }).translate(0, 0, -0.8), PORTICO, 24.6, 8, cz0 - 1.0, 0, 0, 0, 1, 1, 1);
      m.add(G.box, 0x3a2a20, 24.6, 2.4, cz0 - 0.02, 0, 0, 0, 2.2, 4.4, 0.1); // portal
      m.add(G.cyl, 0x24303c, 24.6, 12.4, cz0 - 0.05, Math.PI / 2, 0, 0, 1.5, 0.12, 1.5); // rosetón (cristal)
      m.add(G.cyl, MARES_D, 24.6, 12.4, cz0 - 0.08, Math.PI / 2, 0, 0, 1.75, 0.08, 1.75);
      // Campanario: torre cuadrada que remata en octógono
      // (de sillería, con su cornisa: era una caja de Merger encalada)
      this.block(m, 27, 31, cz0 + 1, cz0 + 5, 22, MARES, false, true);
      m.add(G.cyl, MARES_D, 29, 23.5, cz0 + 3, 0, Math.PI / 8, 0, 3.6, 3, 3.6);
      // Los huecos de las campanas, oscuros
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) m.add(G.box, 0x14181f, 29 + dx * 1.01, 18.5, cz0 + 3 + dz * 1.01, 0, 0, 0, dx ? 0.05 : 1.1, 2.4, dz ? 0.05 : 1.1);
      // Al otro lado, casas señoriales de marès con balcón (de sillería)
      this.block(m, 19, 30, -22, STREET.minZ - 0.2, 10, 0xe9dcc0, true, true);
      this.facade(m, 19, 30, STREET.minZ - 0.2, 1, 3);
    }
    // Al fondo de la Plaça Espanya, la calle que lleva a Sa Plaça d'es Bè
    this.block(m, ESPANYA.maxX, BE_BOX.minX, 3, 18, 9, SAND);
    this.block(m, ESPANYA.maxX, BE_BOX.minX, -18, -3, 9, 0xeee3c8);
    this.facade(m, 3, 12, ESPANYA.maxX, -1, 2, false);
    this.facade(m, -12, -3, ESPANYA.maxX, -1, 2, false);
    this.block(m, STREET.maxX, ESPANYA.maxX, ESPANYA.maxZ, ESPANYA.maxZ + 7, 9, 0xeee3c8);
    this.block(m, STREET.maxX, ESPANYA.maxX, ESPANYA.minZ - 7, ESPANYA.minZ, 9, WHITE);
    this.block(m, STREET.maxX - 0.01, STREET.maxX + 0.01, STREET.maxZ + 0.2, ESPANYA.maxZ, 9, WHITE);
    this.block(m, STREET.maxX - 0.01, STREET.maxX + 0.01, ESPANYA.minZ, STREET.minZ - 0.2, 9, WHITE);
    this.facade(m, STREET.maxX, ESPANYA.maxX, ESPANYA.maxZ, -1, 2);
    this.facade(m, STREET.maxX, ESPANYA.maxX, ESPANYA.minZ, 1, 2);
    for (const [x, z] of [[74, -8], [74, 8], [86, -8], [86, 8], [80, -9.5], [80, 9.5]]) {
      m.add(G.cyl, 0x6b5a40, x, 1.5, z, 0, 0, 0, 0.35, 3, 0.35);
      m.add(G.sphere, 0x2f6b3a, x, 4, z, 0, 0, 0, 3.6, 2.8, 3.6);
      this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
    // Farolas fernandinas en la Plaça Espanya, como las del Born (antes, dos halos flotando en mitad de la plaza)
    for (const [x, z] of [[73.5, -3.6], [73.5, 3.6], [86.5, -3.6], [86.5, 3.6]]) {
      streetLamp(m, x, 0, z);
      this.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
      this.addHalo(x, 4.18, z, 2.6);
    }
    for (const [x, z] of [[77, -6], [83, 6], [77, 6], [83, -6]]) {
      // Banco: tablas de madera, respaldo y dos pies de hierro (no un cajón negro debajo)
      for (const o of [-0.16, 0, 0.16]) m.add(G.box, 0x8a6a44, x, 0.46, z + o, 0, 0, 0, 1.8, 0.05, 0.14);
      const bz = z > 0 ? 0.26 : -0.26;
      for (const y of [0.68, 0.84]) m.add(G.box, 0x8a6a44, x, y, z + bz, 0, 0, 0, 1.8, 0.1, 0.04);
      for (const sx of [-0.75, 0.75]) {
        m.add(G.box, 0x2b2f36, x + sx, 0.22, z, 0, 0, 0, 0.06, 0.44, 0.46);
        m.add(G.box, 0x2b2f36, x + sx, 0.66, z + bz, 0, 0, 0, 0.05, 0.5, 0.05);
      }
      this.colliders.push({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.25, maxZ: z + 0.25 });
    }
    // La barra de hierro de la que cuelga el rótulo de Ses Voltes, entre los dos soportales
    m.add(G.box, 0x2b2f36, 31.2, 4.7, 0, 0, 0, 0, 0.07, 0.07, 5.4);
    for (const z of [-1.2, 1.2]) m.add(G.box, 0x2b2f36, 31.2, 4.57, z, 0, 0, 0, 0.04, 0.26, 0.04);
    sc.add(m.mesh());
    sc.add(lanterns.mesh());
    // Los rótulos de las tiendas (uno por oficio, un material por rótulo)
    for (const [text, planes] of shopSigns) {
      const tex = canvasTex((ctx, w, h) => {
        ctx.fillStyle = SHOP_KINDS.find((k) => k.name === text)!.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#e8d7a8';
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.fillStyle = '#f6ecd0';
        ctx.font = 'bold 40px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 2);
      }, 256, 72);
      // (con luz: de noche, con las tiendas cerradas, un rótulo pintado no brilla solo)
      sc.add(mergedPlanes(planes, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })));
    }

    // Rótulos de verdad
    // (cada uno donde se ve: Ses Voltes colgado de su barra, nada detrás de balcones ni dentro de un muro)
    this.sign('Ses Voltes', 31.12, 4.08, 0, -Math.PI / 2, 3);
    this.sign('Carrer Major des Born', 19.2, 3.12, -4.5, 0, 3.6);
    this.sign('Catedral de Menorca', 24.6, 7.6, STREET.maxZ + 2.2 - 1.95, Math.PI, 3);
    this.sign('Plaça Nova', 70.06, 3, 6.5, Math.PI / 2, 3);
    this.sign('Plaça Espanya', 70.06, 3, -6.5, Math.PI / 2, 3.4);
    this.sign('Maramao', 40, 3.25, 4.47, Math.PI, 2.6);

    // Sa Plaça d'es Bè: plaza cerrada de casas de marès con persianas verdes, y los caballos en medio
    {
      const pm = new Merger();
      const { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } = BE_BOX;
      // (casas de marès: sillería; la blanca, encalada)
      this.block(pm, x1 + 0.2, x1 + 7, z0 - 7, z1 + 7, 9, SAND, true, true);
      this.block(pm, x0, x1, z0 - 7, z0 - 0.2, 10, WHITE);
      this.block(pm, x0, x1, z1 + 0.2, z1 + 7, 8, 0xeee3c8, true, true);
      this.facade(pm, x0, x1, z0 - 0.2, 1, 3);
      this.facade(pm, x0, x1, z1 + 0.2, -1, 2);
      this.facade(pm, 3, z1, x0, 1, 2, false);
      this.facade(pm, z0, -3, x0, 1, 2, false);
      this.facade(pm, z0, z1, x1 + 0.2, -1, 2, false);
      // Banderas de punta a punta
      const fg = new THREE.ConeGeometry(0.28, 0.6, 3).rotateZ(Math.PI);
      const fc = [0xd7263d, 0xffffff, 0x1f5fbf, 0xf4d35e];
      for (const dz of [-6, 0, 6])
        for (let i = 0; i <= 36; i++) {
          const k = i / 36;
          const y = 7 - Math.sin(k * Math.PI) * 1.4;
          pm.add(fg, fc[i % fc.length], x0 + (x1 - x0) * k, y, BE.z + dz, 0, Math.PI / 2, 0, 1, 1, 0.15);
          // La cuerda de la que cuelgan (antes flotaban en fila)
          if (i < 36) {
            const k2 = (i + 1) / 36;
            cord(pm, this.v1.set(x0 + (x1 - x0) * k, y + 0.3, BE.z + dz), this.v2.set(x0 + (x1 - x0) * k2, 7 - Math.sin(k2 * Math.PI) * 1.4 + 0.3, BE.z + dz));
          }
        }
      sc.add(pm.mesh());
      this.buildBeStatue(sc);
      this.sign('Sa Plaça d’es Bè', x0 + 0.05, 3.12, 4.6, Math.PI / 2, 3.6);
      this.sign('A Sa Plaça d’es Bè →', ESPANYA.maxX - 0.05, 3.12, 5, -Math.PI / 2, 3.2);
      // (sin luz de punto encima de la plaza: las lámparas no iluminan nada)
    }

    // Banderas de fiesta cruzando el Born y Ses Voltes
    const flags = new Merger();
    const flagGeo = new THREE.ConeGeometry(0.28, 0.6, 3).rotateZ(Math.PI);
    const colors = [0xd7263d, 0xffffff, 0x1f5fbf, 0xf4d35e];
    for (const [ax, az, bx, bz, h] of [[-14, 13, -14, -13, 7], [-6, 13, -6, -13, 7], [6, 13, 6, -13, 7], [14, 13, 14, -13, 7], [-18, 6, 18, 6, 7.5], [-18, -6, 18, -6, 7.5], [24, 4.4, 24, -4.4, 5.5], [36, 4.4, 36, -4.4, 5.5], [48, 4.4, 48, -4.4, 5.5], [60, 4.4, 60, -4.4, 5.5]]) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.floor(len / 0.8);
      const at = (k: number, out: THREE.Vector3) => out.set(ax + (bx - ax) * k, h - Math.sin(k * Math.PI) * 1.2, az + (bz - az) * k);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        at(k, this.v1);
        flags.add(flagGeo, colors[i % colors.length], this.v1.x, this.v1.y, this.v1.z, 0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0, 1, 1, 0.15);
        // La cuerda, de banderín a banderín (antes flotaban en fila sin nada que los sujetara)
        if (i < n) cord(flags, this.v1.setY(this.v1.y + 0.3), at((i + 1) / n, this.v2).setY(this.v2.y + 0.3));
      }
    }
    const fm = flags.mesh();
    fm.userData.noCast = true;
    sc.add(fm);

    // (fuera las luces de punto de la calle y la plaza: hacían charcos de luz que no salían de ninguna lámpara)
    this.hd?.finish(sc);
  }

  /**
   * Farol de hierro colgado de la viga de los soportales de Ses Voltes (side: lado de la calle), con su brazo, su
   * sombrerete y el cristal que de noche se ve encendido (con su halo de tebeo).
   */
  private lantern(m: Merger, x: number, side: number) {
    const face = side * 2.65, z = side * 2.28, y = 3.92;
    m.add(G.box, IRON, x, 4.3, (face + z) / 2, 0, 0, 0, 0.04, 0.04, Math.abs(face - z) + 0.04); // brazo
    m.add(G.box, IRON, x, 4.2, z, 0, 0, 0, 0.035, 0.16, 0.035); // colgadero
    m.add(G.cone, IRON, x, 4.16, z, 0, Math.PI / 4, 0, 0.42, 0.16, 0.42); // sombrerete
    m.add(G.box, LANTERN, x, y, z, 0, 0, 0, 0.22, 0.36, 0.22); // cristal
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(G.box, IRON, x + dx * 0.115, y, z + dz * 0.115, 0, 0, 0, 0.035, 0.38, 0.035);
    m.add(G.box, IRON, x, y - 0.21, z, 0, 0, 0, 0.27, 0.05, 0.27); // base
    this.addHalo(x, y, z, 1.7);
  }

  /** Halo de tebeo de una lámpara, escondido de día. */
  private addHalo(x: number, y: number, z: number, size: number) {
    const s = new THREE.Sprite(nightHalo());
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    s.visible = false;
    this.scene.add(s);
    this.halos.push(s);
  }

  /**
   * El Bè, en medio de la plaza: la columna blanca, gastada abajo, con su placa de bronce y, en lo alto, el
   * cordero de bronce con la bandera.
   */
  private buildBeStatue(sc: THREE.Scene) {
    const H = 4.1, R0 = 0.215;
    const col = new Merger();
    col.add(new THREE.CylinderGeometry(R0 - 0.01, R0, H, 28), 0xeee9dd, 0, H / 2, 0);
    // Los desconchones de abajo y un zócalo apenas marcado
    col.add(new THREE.CylinderGeometry(R0 + 0.004, R0 + 0.006, 0.24, 28), 0xc9c1ae, 0, 0.12, 0);
    for (let i = 0; i < 9; i++) col.add(G.box, i % 2 ? 0x9a927f : 0xb5ad99, Math.cos(i * 1.9) * R0, 0.1 + (i % 4) * 0.07, Math.sin(i * 1.9) * R0, 0, -i * 1.9, 0, 0.012, 0.05 + (i % 3) * 0.03, 0.07);
    col.add(new THREE.CylinderGeometry(0.3, 0.27, 0.05, 28), 0xc9c1ae, 0, 0.025, 0);
    // Placa de bronce, mirando a quien entra en la plaza
    col.add(G.box, 0x2c2f2c, -R0 - 0.012, 2.3, 0, 0, 0, 0, 0.02, 0.28, 0.4);
    col.add(G.box, 0x4a4c44, -R0 - 0.024, 2.3, 0, 0, 0, 0, 0.008, 0.2, 0.32);
    const cm = col.mesh();
    cm.position.set(BE.x, 0, BE.z);
    sc.add(cm);

    const B = 0x2e3230, B2 = 0x3c403a;
    const r = new Merger(false);
    r.add(new THREE.CylinderGeometry(0.29, 0.27, 0.07, 24), B, 0, 0.035, 0);
    // Cuerpo: una masa de vellones pequeños sobre un tonel, como un cordero de bronce de verdad
    r.add(G.sphere, B, 0, 0.5, 0, 0, 0, 0, 0.42, 0.4, 0.74);
    for (let i = 0; i < 70; i++) {
      const a = i * 2.399, py = 1 - ((i + 0.5) / 70) * 1.55, rr = Math.sqrt(Math.max(0, 1 - py * py));
      const s = 0.085 + (i % 3) * 0.012;
      r.add(G.sphere, i % 3 ? B : B2, Math.cos(a) * rr * 0.205, 0.5 + py * 0.195, Math.sin(a) * rr * 0.36, 0, i, 0, s, s * 0.9, s);
    }
    // Cuello, cabeza alargada con su hocico, orejas y cuernos enroscados
    r.add(G.capsule, B, 0, 0.72, 0.36, 0.65, 0, 0, 0.17, 0.12, 0.17);
    r.add(G.sphere, B, 0, 0.92, 0.5, 0.25, 0, 0, 0.17, 0.19, 0.27);
    r.add(G.sphere, B2, 0, 0.87, 0.63, 0.25, 0, 0, 0.1, 0.1, 0.13);
    for (let i = 0; i < 9; i++) r.add(G.sphere, B2, Math.cos(i * 2.4) * 0.05, 1.0 + (i % 2) * 0.012, 0.46 + Math.sin(i * 2.4) * 0.05, 0, 0, 0, 0.055, 0.05, 0.055);
    for (const s of [-1, 1]) {
      r.add(new THREE.TorusGeometry(0.05, 0.017, 7, 16), B2, s * 0.105, 0.95, 0.44, 0, Math.PI / 2, 0);
      r.add(G.sphere, B, s * 0.125, 0.93, 0.52, 0, 0, s * 0.7, 0.085, 0.03, 0.045);
    }
    // Patas: tres apoyadas en el disco, con su pezuña, y la mano delantera levantada, sujetando el asta
    for (const [x, z] of [[-0.11, -0.25], [0.11, -0.25], [0.11, 0.24]] as const) {
      r.add(G.cyl, B, x, 0.2, z, 0, 0, 0, 0.06, 0.34, 0.06);
      r.add(G.cyl, B2, x, 0.09, z, 0, 0, 0, 0.075, 0.05, 0.075);
    }
    r.add(G.cyl, B, -0.13, 0.42, 0.37, 1.05, 0, 0, 0.055, 0.28, 0.055);
    r.add(G.sphere, B, 0, 0.56, -0.4, 0, 0, 0, 0.09, 0.12, 0.1); // rabo
    // El asta, inclinada, con la bandera grande cayendo hacia atrás
    r.add(G.cyl, 0x1e201e, -0.16, 0.68, 0.46, 0.08, 0, 0.02, 0.022, 1.36, 0.022);
    r.add(G.sphere, B2, -0.14, 1.37, 0.51, 0, 0, 0, 0.05, 0.05, 0.05);
    const fl = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.14, 0.04), new THREE.Vector2(-0.46, -0.18), new THREE.Vector2(-0.78, -0.62), new THREE.Vector2(-0.46, -0.58), new THREE.Vector2(-0.3, -0.72), new THREE.Vector2(-0.04, -0.5)]);
    r.add(new THREE.ExtrudeGeometry(fl, { depth: 0.012, bevelEnabled: false }).translate(0, 0, -0.006), 0x262a28, -0.14, 1.33, 0.5, 0, Math.PI / 2 + 0.25, 0);
    const rm = r.mesh();
    // Mira hacia la calle por donde se entra
    rm.position.set(BE.x, H, BE.z);
    rm.rotation.y = -Math.PI / 2;
    sc.add(rm);
    this.colliders.push({ minX: BE.x - 0.3, maxX: BE.x + 0.3, minZ: BE.z - 0.3, maxZ: BE.z + 0.3, round: true });
  }

  /** El jaleo: gente alrededor del círculo de los caballos y algo en Ses Voltes y la Plaça Espanya. */
  private buildCrowd() {
    const pts: { x: number; z: number }[] = [];
    // Ni encima de otro ni dentro de nada: ni columnas de Ses Voltes, ni bancos, ni árboles
    const clear = (x: number, z: number) => !this.colliders.some((b) => !b.round && x > b.minX - 0.42 && x < b.maxX + 0.42 && z > b.minZ - 0.42 && z < b.maxZ + 0.42);
    const ok = (x: number, z: number) => clear(x, z) && !pts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.95) && !PINS.some((p) => Math.hypot(p.x - x, p.z - z) < 2.5) && Math.hypot(x - TAXI.x, z - TAXI.z) > 5.2;
    for (let i = 0; i < 9000 && pts.length < 170; i++) {
      const x = BORN.minX + 1 + Math.random() * (BORN.maxX - BORN.minX - 2);
      const z = BORN.minZ + 1 + Math.random() * (BORN.maxZ - BORN.minZ - 2);
      const r = Math.hypot(x, z);
      if (r < HORSE_R + 2.2 || r > 15.5) continue;
      // Pasillos entre la gente: hacia Ses Voltes, Correus, el Ajuntament y los palacios
      if (AISLES.some(([ax, az]) => segDist(x, z, ax, az) < 1.5)) continue;
      if (ok(x, z)) pts.push({ x, z });
    }
    for (let i = 0; i < 4000 && pts.length < 215; i++) {
      const x = 32 + Math.random() * 56;
      // En Ses Voltes, por dentro de los soportales (entre columna y columna caben; dentro de una, no)
      const z = x < 70 ? (Math.random() < 0.5 ? -1 : 1) * (1.9 + Math.random() * 2.2) : -10 + Math.random() * 20;
      if (x >= 70 && Math.abs(z) < 1.6) continue; // el paso hacia Sa Plaça d'es Bè
      if (ok(x, z)) pts.push({ x, z });
    }
    // Sa Plaça d'es Bè, llena: alrededor del corro, dejando pasillo hasta los caballos
    for (let i = 0; i < 6000 && pts.length < 290; i++) {
      const x = BE_BOX.minX + 0.8 + Math.random() * (BE_BOX.maxX - BE_BOX.minX - 1.6);
      const z = BE_BOX.minZ + 0.8 + Math.random() * (BE_BOX.maxZ - BE_BOX.minZ - 1.6);
      if (Math.hypot(x - BE.x, z - BE.z) < BE_R + 2.6) continue;
      if (x < BE.x - 8 && Math.abs(z - BE.z) < 2) continue; // por donde se entra
      if (ok(x, z)) pts.push({ x, z });
    }
    LOOKS.forEach((lk, li) => {
      const mine = pts.filter((_, i) => i % LOOKS.length === li);
      const people = makeCrowd(lk, mine.length);
      this.scene.add(people.group);
      // Miran hacia el centro del Born (o hacia la calle)
      this.crowds.push({ people, female: !lk.male, base: mine.map((p) => ({ ...p, ry: p.x >= BE_BOX.minX ? Math.atan2(BE.x - p.x, BE.z - p.z) : p.x < 20 ? Math.atan2(-p.x, -p.z) : Math.random() * 6, ph: Math.random() * 6 })) });
    });
    this.people = pts.map((p) => ({ x: p.x, z: p.z, r: 0.33 }));
  }

  /** Caballos negros con sus caixers dando vueltas al obelisco. */
  private buildHorses() {
    for (let i = 0; i < 4 + STREET_HORSES; i++) {
      const d = makeHorse();
      // (se mueven: el cómic no los dobla a mano alzada, o la silla y los arreos viajaban torcidos)
      d.root.userData.comicBent = true;
      markAccessories(d.root);
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false }));
      alert.position.set(0, 4.1, 0);
      alert.visible = false;
      d.root.add(alert);
      this.scene.add(d.root);
      const street = i >= 4 ? { dir: i % 2 ? 1 : -1 } : undefined;
      // En la calle, «angle» es la x por donde va
      this.horses.push({ d, street, angle: street ? 30 + (i - 4) * 22 : (i / 4) * Math.PI * 2, warnT: 0, rearT: 0, nextRear: 2 + i * 1.7, walk: 0, alert, touched: false });
    }
    for (let i = 0; i < BE_HORSES; i++) {
      const d = makeHorse();
      d.root.userData.comicBent = true;
      markAccessories(d.root);
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false }));
      alert.position.set(0, 4.1, 0);
      alert.visible = false;
      d.root.add(alert);
      this.scene.add(d.root);
      this.horses.push({ d, plaza: true, angle: (i / BE_HORSES) * Math.PI * 2, warnT: 0, rearT: 0, nextRear: 1 + i * 1.4, walk: 0, alert, touched: false });
    }
  }

  /** Bolsitas de avellanes repartidas por el recorrido. */
  private buildBags() {
    const geo = new Merger().add(G.sphere, 0xc8a26a, 0, 0.22, 0, 0, 0, 0, 0.45, 0.42, 0.45).add(G.cyl, 0xd7263d, 0, 0.44, 0, 0, 0, 0, 0.2, 0.08, 0.2).build();
    for (const [x, z] of [[50, 2], [62, -2], [84, -4], [76, 9], [25, -2], [-12, -10], [12, 10.5], [-15, 2]]) {
      const o = new THREE.Mesh(geo, vertexMat());
      o.position.set(x, 0, z);
      this.scene.add(o);
      this.bags.push({ obj: o, taken: false });
    }
  }

  // ---------------- Ubicaciones ----------------

  private setPin(_i: number) {
    audio.pop();
    vibrate(20);
    this.pinPos.copy(PINS[0]);
    this.pinOn = true;
    this.map.style.display = 'block';
    this.updateHud();
  }

  /** En Correus: Gas no la encuentra. «Dime exacto pls». */
  private reachedPin() {
    this.reached++;
    this.pinOn = false;
    this.pinObj.visible = false;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    const ex = CHATS.dimeExacto;
    dialogue(SANTJOAN.correus, () =>
      phoneChat({ ...ex, msgs: ex.msgs.slice(6, -1) }, () => {
        this.busy = false;
        this.phase = 'exact';
        this.updateHud();
      }),
    );
  }

  /** ¿Sale el obelisco en la foto? Hay que mirar hacia él y no estar demasiado lejos. */
  private obeliskInShot() {
    const pp = this.player.root.position;
    const d = Math.hypot(pp.x, pp.z);
    const ang = Math.atan2(-pp.x, -pp.z);
    const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
    return d < 20 && Math.abs(rel) < 0.5;
  }

  /** La foto exacta: si sale el obelisco, Gas sabe dónde está. Si no, se lo dice él por WhatsApp. */
  private takePhoto() {
    audio.pop();
    vibrate(25);
    fadeFlash(() => {}, 120);
    if (!this.obeliskInShot()) {
      this.misses++;
      const r = SANTJOAN.notExact;
      later(() => bark('Gas', r[(this.misses - 1) % r.length]), 700);
      return;
    }
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    const ex = CHATS.dimeExacto;
    later(() => phoneChat({ ...ex, msgs: ex.msgs.slice(-1) }, () => this.sendLocation()), 500);
  }

  private sendLocation() {
    this.phase = 'coming';
    this.busy = false;
    this.spotted = false;
    audio.luck();
    // Gas aparece por uno de los pasillos que deja la gente (hacia Ses Voltes, Correus, el Ajuntament o el Imperi),
    // a unos once metros: nunca dentro de la verja del obelisco ni en medio del corro de los caballos
    const pp = this.player.root.position;
    let best: [number, number] = [15, 0], bd = 1e9;
    for (const [ax, az] of AISLES) {
      const k = 15 / Math.hypot(ax, az);
      const x = ax * k, z = Math.min(az * k, BORN.maxZ - 1.4);
      const d = Math.hypot(x - pp.x, z - pp.z);
      const score = d < 6 ? 1e6 : Math.abs(d - 11);
      if (score < bd) {
        bd = score;
        best = [x, z];
      }
    }
    this.gas.root.visible = true;
    this.gas.root.position.set(best[0], 0, best[1]);
    this.gasSteer = {};
    this.updateHud();
  }

  private drawMap() {
    const c = this.map.getContext('2d')!;
    const W = this.map.width;
    const H = this.map.height;
    const sx = (x: number) => ((x + 22) / 116) * W;
    const sz = (z: number) => ((z + 16) / 32) * H;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (const r of [BORN, STREET, ESPANYA]) c.fillRect(sx(r.minX), sz(r.minZ), sx(r.maxX) - sx(r.minX), sz(r.maxZ) - sz(r.minZ));
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.arc(sx(0), sz(0), 2.5, 0, Math.PI * 2);
    c.fill();
    c.font = '600 10px Fredoka, sans-serif';
    c.fillText('Born', sx(-15), sz(-9));
    c.fillText('Ses Voltes', sx(36), sz(-6));
    c.fillText('Pl. Espanya', sx(71), sz(-8));
    // La ubicación que ha mandado Gas (es la del chat: la de verdad, en el móvil)
    if (this.pinOn) {
      const px = sx(this.pinPos.x);
      const pz = sz(this.pinPos.z);
      c.fillStyle = '#ff4d4d';
      c.beginPath();
      c.arc(px, pz - 6, 5, 0, Math.PI * 2);
      c.moveTo(px - 4, pz - 4);
      c.lineTo(px, pz + 2);
      c.lineTo(px + 4, pz - 4);
      c.fill();
    }
    if (this.gas.root.visible) {
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(sx(this.gas.root.position.x), sz(this.gas.root.position.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    const pp = this.player.root.position;
    c.fillStyle = '#4fc3ff';
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx(pp.x), sz(pp.z), 4.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // ---------------- Bucle ----------------

  private updateHud() {
    const h = this.hud;
    h.setCounters(this.phase === 'nuts' ? `<span class="chip">🌰 ${this.nuts?.hits ?? 0}/${NUTS_NEED}</span>` : this.phase === 'be' ? `<span class="chip">${SANTJOAN.beCount(this.beTouched, BE_NEED)}</span>` : this.phase === 'home' || this.phase === 'taxi' || this.phase === 'ride' ? '' : `<span class="chip">🌰 ${this.bagCount}</span><span class="chip">🐎 ${this.luck}</span>`);
    // Objetivos mínimos: un emoji o dos palabras, sin decir qué hacer
    if (this.phase === 'nuts') h.setObjective(SIDE.nuts.hint);
    else if (this.phase === 'be') h.setObjective(this.beIn ? SANTJOAN.beGo : SANTJOAN.beHint);
    else if (this.phase === 'taxi') h.setObjective(SANTJOAN.taxiHint);
    else if (this.phase === 'ride') h.setObjective('');
    else if (this.phase === 'home') h.setObjective(SANTJOAN.homeHint);
    else if (this.phase === 'hunt') h.setObjective(SANTJOAN.huntHint);
    else if (this.phase === 'exact') h.setObjective(SANTJOAN.exactHint);
    else if (this.phase === 'coming') h.setObjective(SANTJOAN.comingHint);
    else if (this.phase === 'intro') h.setObjective('Ciutadella, Sant Joan');
    else h.setObjective('💙');
  }

  private target(): THREE.Vector3 | null {
    if (this.phase === 'hunt' && this.pinOn) return this.pinPos;
    if (this.phase === 'coming') return this.gas.root.position;
    if (this.phase === 'exact') return this.v2.set(0, 0, 0);
    if (this.phase === 'be' && !this.beIn) return BE;
    if (this.phase === 'nuts' && this.nuts) {
      const near = this.nuts.nearest();
      return near.dist > 13 ? near.at : null;
    }
    if (this.phase === 'taxi') return TAXI_DOOR;
    return null;
  }

  update(dt: number) {
    this.t += dt;
    if (this.home) {
      this.updateHome(dt);
      return;
    }
    if (this.ride) {
      this.updateRide(dt);
      return;
    }
    this.fx.update(dt);
    if (this.phase !== 'intro' && this.phase !== 'ending' && this.phase !== 'done') this.playTime += dt;
    this.invuln -= dt;
    const pp = this.player.root.position;

    // Gente de pie gesticulando; levantan los brazos cuando un caballo se pone de manos
    const rearing = !this.night && this.horses.some((h) => h.rearT > 0);
    this.cheer += ((this.phase === 'ending' ? 1 : rearing ? 0.85 : 0.35) - this.cheer) * Math.min(1, dt * 3);
    for (const c of this.crowds) {
      c.base.forEach((b, i) => {
        crowdPose(this.pose, this.t, b.ph, this.cheer);
        this.tmpQ.setFromAxisAngle(this.up, b.ry);
        c.people.set(i, b.x, b.z, this.tmpQ, this.pose, bornHeight(b.x, b.z));
      });
      c.people.commit();
    }
    // Al entrar en Ses Voltes, el caballo que tiene delante se desboca: lo grita su caixer
    if (!this.chargeDone && this.phase === 'hunt' && !this.busy && pp.x < 66 && pp.x > 34) {
      const front = this.horses.filter((h) => h.street && h.angle < pp.x - 16 && h.rearT <= 0 && h.warnT <= 0).sort((a, b) => b.angle - a.angle)[0];
      if (front) {
        this.chargeDone = true;
        front.charge = true;
        front.alert.visible = false;
        this.talker = front;
        bark('Un caixer', SANTJOAN.charge);
        comicWord(SANTJOAN.hints.chargeWord, 'hit');
        audio.warn();
        audio.cheer(0.5);
        vibrate([60, 40, 60]);
        this.walker.shake(0.3);
      }
    }
    const rearNear = this.phase === 'taxi' || this.night ? null : this.updateHorses(dt);

    // Azul
    const walking = !this.busy && (this.phase === 'hunt' || this.phase === 'exact' || this.phase === 'coming' || this.phase === 'nuts' || this.phase === 'be' || this.phase === 'taxi');
    this.walker.turn(this.input.consumeCam());
    this.walker.canJump = walking && this.phase !== 'taxi';
    // (con Gas colgado del hombro no se corre)
    this.walker.canSprint = !this.pair;
    let resting = false;
    if (this.phase === 'taxi' && this.pair) {
      // Tira de él, a tirones; si se queda atrás, le espera
      const lag = Math.hypot(this.gas.root.position.x - pp.x, this.gas.root.position.z - pp.z);
      this.walker.speed = lag > 2.2 ? 0.7 : this.pair.speed();
      resting = this.updateRest(dt);
    }
    const pushing = this.pushT > 0;
    const mag = this.walker.move(dt, walking && !pushing && !resting ? this.input.axes() : { x: 0, y: 0 }, this.colliders, this.bounds, this.people);
    if (pushing) this.stepPush(dt);
    if (this.walker.bump) audio.knock(Math.min(0.45, this.walker.bump * 0.07), 200, 0.07); // choque sordo contra alguien
    // La explanada del obelisco está un escalón más alta que la calle
    for (const q of [this.player, this.gas]) q.root.position.y = bornHeight(q.root.position.x, q.root.position.z) + (q === this.player ? this.walker.hop : 0);
    this.player.root.rotation.y = this.walker.facing;
    if (this.phase === 'ending' || this.phase === 'done') animatePerson(this.player, dt, 'idle');
    else if (this.phase === 'meet') animatePerson(this.player, dt, 'talk');
    else animatePerson(this.player, dt, !pushing && mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);

    // Gas
    if (this.gas.root.visible) {
      const g = this.gas.root.position;
      if (this.phase === 'coming') {
        const d = g.distanceTo(pp);
        // (cuando la ve, la llama: sin emojis de saludo flotando encima)
        if (!this.spotted && d < 9) {
          this.spotted = true;
          bark('Gas', SANTJOAN.spotted);
        }
        if (d > 1.3) {
          // Viene hacia ella esquivando a la gente, con su arranque y su frenada
          steerTo(this.gas.root, this.gasSteer, pp.x - ((pp.x - g.x) / d) * 1.2, pp.z - ((pp.z - g.z) / d) * 1.2, 2.2, dt, this.people, 3.5, 0.32, undefined, this.colliders);
          animatePerson(this.gas, dt, 'walk');
        } else this.meet();
      } else if (this.phase === 'nuts') {
        const moving = this.gasTrail.step(this.gas.root, pp, 1.7, 4.2, dt, this.colliders, 0.26);
        animatePerson(this.gas, dt, moving ? 'walk' : 'idle', moving ? 0.8 : 0);
      } else if (this.phase === 'be') {
        // Va contigo, sin atravesar a nadie
        if (!this.beIn && pp.x > BE_BOX.minX + 1) {
          this.beIn = true;
          this.updateHud();
          audio.cheer(0.4);
        }
        if (this.pushT > 0 && this.pushGas) animatePerson(this.gas, dt, 'idle');
        else {
          const moving = this.gasTrail.step(this.gas.root, pp, 1.6, 4.2, dt, this.colliders, 0.26);
          animatePerson(this.gas, dt, moving ? 'walk' : 'idle', moving ? 0.8 : 0);
        }
      } else if (this.phase === 'taxi' && this.pair) {
        // Cojísimo, y apoyado en ella
        const moving = this.pair.step(dt, this.walker.facing, this.colliders);
        animatePerson(this.gas, dt, moving ? 'walk' : 'idle', 0.3);
        this.pair.pose();
      } else if (this.phase === 'ending' || this.phase === 'done' || this.phase === 'taxi') animatePerson(this.gas, dt, 'idle');
      else animatePerson(this.gas, dt, 'talk');
    }

    if (this.nuts) {
      this.nuts.update(dt, this.busy);
      this.nuts?.pose(dt);
    }

    // Correus: se llega a donde dice su ubicación (el pin flotante solo sale como pista, si se ha perdido)
    if (this.phase === 'hunt' && !this.busy && this.pinOn && Math.hypot(pp.x - this.pinPos.x, pp.z - this.pinPos.z) < REACH) this.reachedPin();

    // Avellanes (de día: de noche ya se ha acabado la guerra de avellanes)
    for (const b of this.bags) {
      if (b.taken || this.night) continue;
      b.obj.rotation.y += dt * 2;
      b.obj.position.y = bornHeight(b.obj.position.x, b.obj.position.z) + 0.1 + Math.abs(Math.sin(this.t * 2 + b.obj.position.x)) * 0.15;
      if (Math.hypot(b.obj.position.x - pp.x, b.obj.position.z - pp.z) < 1) {
        b.taken = true;
        b.obj.visible = false;
        this.bagCount++;
        audio.pickup();
        comicWord(SANTJOAN.hints.pomada, 'luck');
        this.fx.burst(this.v1.copy(b.obj.position).setY(1), '🌰', 5, 1.4);
        this.updateHud();
      }
    }

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    if (walking && this.phase === 'nuts') {
      label = SIDE.nuts.btn;
      action = () => this.nuts?.throw();
    } else if (walking && rearNear && !pushing) {
      label = SANTJOAN.hints.rear;
      action = () => this.touchHorse(rearNear);
    } else if (!this.busy && !resting && this.phase === 'taxi' && Math.hypot(pp.x - TAXI_DOOR.x, pp.z - TAXI_DOOR.z) < 2.1) {
      label = SANTJOAN.taxiBtn;
      action = () => this.boardTaxi();
    } else if (!this.busy && this.phase === 'exact') {
      label = '📷 Foto exacta';
      action = () => this.takePhoto();
    }
    this.hud.setAction(label, !!label && (this.phase !== 'exact' || this.obeliskInShot()));
    if (this.input.consumeAction() && action) action();

    // Pistas, solo si se ha perdido: la flecha, la columna de luz y el pin salen a los 40 s sin avanzar
    const key = `${this.phase}|${this.pinOn}|${this.misses}|${this.beIn}|${this.beTouched}|${this.nuts?.hits ?? 0}|${this.restDone}|${this.bagCount}`;
    const lostNow = this.lost.tick(key, dt, this.busy);
    const tgt = lostNow ? this.target() : null;
    this.pinObj.visible = lostNow && this.phase === 'hunt' && this.pinOn && !this.busy;
    if (this.pinObj.visible) {
      this.pinObj.position.set(this.pinPos.x, 3.4 + Math.sin(this.t * 3) * 0.2, this.pinPos.z);
      this.pinObj.rotation.y += dt * 1.5;
    }
    if (tgt) {
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 4 ? null : -rel);
      beacon.at(pp.distanceTo(tgt) < 4 ? null : tgt);
    } else {
      this.hud.setArrow(null);
      beacon.at(null);
    }

    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 1 / 12;
      this.drawMap();
    }

    if (this.phase === 'meet') {
      // Se encuentran: plano de los dos, parados, abrazados, con el obelisco detrás
      const mid = this.v1.copy(pp).lerp(this.gas.root.position, 0.5);
      this.camera.position.lerp(this.v2.set(mid.x + Math.sign(mid.x || 1) * 3.6, 2.2, mid.z + Math.sign(mid.z || 1) * 3.6), 1 - Math.exp(-dt * 2));
      this.camera.lookAt(mid.x, 1.4, mid.z);
    } else this.walker.camera(this.camera, dt, this.colliders);
    this.sun.follow(pp);
    this.sky.update(this.camera, dt);
  }

  /**
   * Paso nuevo (inventado): a medio camino del taxi, Gas no puede más y se para. Ella tiene que esperar quieta a que
   * recupere; si tira de él, se queja. Devuelve si están parados (ella no se mueve).
   */
  private updateRest(dt: number) {
    const pp = this.player.root.position;
    if (!this.restDone && this.restT <= 0 && !this.busy) {
      const d = Math.hypot(pp.x - TAXI_DOOR.x, pp.z - TAXI_DOOR.z);
      if (d < this.taxiFrom * 0.55 && d > 4) {
        this.restT = 3.6;
        this.restNag = false;
        this.walker.stop();
        bark('Gas', SANTJOAN.rest.stop);
      }
    }
    if (this.restT <= 0) return false;
    this.restT -= dt;
    const ax = this.input.axes();
    if (!this.restNag && Math.hypot(ax.x, ax.y) > 0.4) {
      this.restNag = true;
      this.restT = Math.max(this.restT, 1.8);
      bark('Gas', SANTJOAN.rest.pulled);
      audio.knock(0.2, 300, 0.06);
      vibrate(30);
    }
    if (this.restT <= 0) {
      this.restDone = true;
      bark('Gas', SANTJOAN.rest.go);
      return false;
    }
    return true;
  }

  private updateHorses(dt: number) {
    const pp = this.player.root.position;
    let near: Horse | null = null;
    let nearest = Infinity;
    for (const s of this.horses) {
      const r = s.d.root;
      const dist = r.position.distanceTo(pp);
      if (s.rearT > 0) {
        const before = s.rearT;
        // Con el empujón aguanta más arriba, y sube otro poco y da un bote
        let b = 0;
        if ((s.boostT ?? 0) > 0) {
          s.boostT! -= dt;
          b = Math.sin(Math.max(0, 1 - s.boostT! / PUSH) * Math.PI);
          s.rearT += dt * 0.72;
        }
        s.rearT -= dt;
        const k = Math.sin(Math.min(1, 1 - s.rearT / REAR) * Math.PI);
        s.d.pivot.rotation.x = -k * 0.85 - b * 0.16;
        s.d.pivot.position.y = b * 0.34;
        s.d.legs[0].rotation.x = s.d.legs[1].rotation.x = -k * 1.2 + Math.sin(this.t * 16) * 0.35 * k;
        s.d.head.rotation.x = -k * 0.4;
        if (before > 0.3 && s.rearT <= 0.3) {
          r.localToWorld(this.v1.set(0, 0.1, 0.9));
          this.fx.burst(this.v1, 'dust', 6, 1.6, 0.4);
          if (dist < 8) this.walker.shake(0.18);
        }
        if (s.rearT <= 0) {
          s.d.pivot.rotation.x = 0;
          s.d.pivot.position.y = 0;
          s.boostT = 0;
          s.nextRear = s.plaza ? 0.8 + Math.random() * 1.6 : 3 + Math.random() * 4;
          s.touched = false;
        }
      } else if (s.warnT > 0) {
        s.warnT -= dt;
        s.alert.visible = true;
        s.alert.scale.setScalar(0.9 + Math.abs(Math.sin(this.t * 12)) * 0.25);
        s.d.head.rotation.y = Math.sin(this.t * 25) * 0.25;
        if (s.warnT <= 0) {
          s.alert.visible = false;
          s.d.head.rotation.y = 0;
          s.rearT = REAR;
          if (dist < 14) {
            audio.whoosh();
            audio.cheer(0.25);
          }
        }
      } else {
        let sp: number;
        if (s.plaza) {
          s.v = (s.v ?? 0.34) + (0.34 - (s.v ?? 0)) * Math.min(1, dt * 0.8);
          s.angle += dt * s.v;
          r.position.set(BE.x + Math.cos(s.angle) * BE_R, 0, BE.z + Math.sin(s.angle) * BE_R);
          r.rotation.y = -s.angle;
          sp = s.v * BE_R;
        } else if (s.street) {
          // Frena antes del final de la calle, da la vuelta despacio y vuelve a arrancar
          if ((s.angle > 66 && s.street.dir > 0) || (s.angle < 24 && s.street.dir < 0)) s.street.dir *= -1;
          if (s.charge) {
            // Desbocado: va hacia ella por el centro de la calle, a galope, y se tuerce un poco si puede
            s.street.dir = pp.x > s.angle ? 1 : -1;
            s.v = (s.v ?? 0) + THREE.MathUtils.clamp(s.street.dir * 8.5 - (s.v ?? 0), -16 * dt, 16 * dt);
            r.position.z += THREE.MathUtils.clamp(THREE.MathUtils.clamp(pp.z, -1.3, 1.3) - r.position.z, -dt * 1.6, dt * 1.6);
            s.nextRear = 4;
            // Te ha pasado (o se acaba la calle): se le pasa y vuelve a su paso
            if (Math.abs(pp.x - s.angle) < 0.8 || s.angle > 68 || s.angle < 22) {
              s.charge = false;
              s.v = s.street.dir * 1.6;
              if (this.invuln <= 0) later(() => bark('Margaux', SANTJOAN.chargeOk), 500);
            }
          } else {
            s.v = (s.v ?? s.street.dir * 1.6) + THREE.MathUtils.clamp(s.street.dir * 1.6 - (s.v ?? 0), -1.2 * dt, 1.2 * dt);
            r.position.z += (0 - r.position.z) * Math.min(1, dt * 0.8);
          }
          s.angle += s.v * dt;
          r.position.x = s.angle;
          const face = s.v > 0.05 ? Math.PI / 2 : s.v < -0.05 ? -Math.PI / 2 : r.rotation.y;
          r.rotation.y += Math.atan2(Math.sin(face - r.rotation.y), Math.cos(face - r.rotation.y)) * Math.min(1, dt * 2.5);
          sp = Math.abs(s.v);
        } else {
          s.v = (s.v ?? 0.28) + (0.28 - (s.v ?? 0)) * Math.min(1, dt * 0.8);
          s.angle += dt * s.v;
          r.position.set(Math.cos(s.angle) * HORSE_R, BORN_RISE, Math.sin(s.angle) * HORSE_R);
          r.rotation.y = -s.angle;
          sp = s.v * HORSE_R;
        }
        // Paso ligado a la velocidad: las patas no patinan; cabeza y lomo cabecean con cada pisada
        s.walk += sp * dt * 4.4;
        const g = Math.min(1, sp / 1.2);
        const w = Math.sin(s.walk) * 0.5 * g;
        s.d.legs[0].rotation.x = s.d.legs[3].rotation.x = w;
        s.d.legs[1].rotation.x = s.d.legs[2].rotation.x = -w;
        s.d.pivot.rotation.x = Math.sin(s.walk * 2) * 0.02 * g;
        s.d.head.rotation.x = Math.sin(s.walk * 2 + 0.6) * 0.07 * g;
        s.nextRear -= dt;
        if (s.nextRear <= 0 && this.phase !== 'intro' && (!s.plaza || (this.phase === 'be' && this.beIn))) {
          s.warnT = WARN;
          if (dist < 12) audio.warn();
        }
      }
      if (!s.touched && s.rearT > 0.2 && dist < TOUCH_R && dist < nearest && this.phase !== 'ending') {
        near = s;
        nearest = dist;
      }
      // Choque: el caballo te aparta (si no está de manos); su caixer te lo grita
      if (s.rearT <= 0 && dist < 1.4 && this.invuln <= 0 && !this.busy) {
        this.v1.subVectors(pp, r.position).setY(0).normalize().multiplyScalar(10);
        this.walker.knock.copy(this.v1);
        this.walker.shake(0.4);
        this.invuln = 1.5;
        this.hits++;
        audio.hit();
        vibrate(80);
        comicWord(SANTJOAN.hints.hitWord, 'hit');
        this.talker = s;
        bark('Un caixer', SANTJOAN.hints.hit);
      }
    }
    return near;
  }

  /** El pecho del caballo, en el mundo: a donde van las manos. */
  private chest(s: Horse, side: number, out: THREE.Vector3) {
    s.d.pivot.updateWorldMatrix(true, false);
    return s.d.pivot.localToWorld(out.set(side * 0.17, 1.3, 1.75));
  }

  /** Se acerca y empuja con las dos manos: cada fotograma, después de la animación, las manos al pecho del caballo. */
  private startPush(s: Horse) {
    this.pushT = PUSH;
    this.pushHorse = s;
    s.boostT = PUSH;
    const gd = this.gas.root.visible ? this.gas.root.position.distanceTo(s.d.root.position) : 99;
    this.pushGas = this.phase === 'be' && gd < 5;
    if (this.pushPost) rigPost.delete(this.pushPost);
    const t = new THREE.Vector3(), pole = new THREE.Vector3(), hip = new THREE.Vector3();
    this.pushPost = () => {
      const h = this.pushHorse;
      if (!h || this.pushT <= 0) return;
      const e = PUSH - this.pushT;
      const w = THREE.MathUtils.smoothstep(e, 0, 0.16) * THREE.MathUtils.smoothstep(this.pushT, 0, 0.22);
      for (const p of this.pushGas ? [this.player, this.gas] : [this.player]) {
        const r = p.rig;
        if (!r) continue;
        const off = p === this.gas ? 0.5 : -0.1;
        for (const [side, sg] of [['Left', 1], ['Right', -1]] as const) {
          this.chest(h, off + sg * 0.85, t);
          // Las manos no llegan más arriba de donde da el brazo: empujan hacia allí
          const shoulder = r.bones.get(side + 'Arm')!.getWorldPosition(hip);
          pole.set(shoulder.x, shoulder.y - 0.6, shoulder.z);
          twoBone(r.bones.get(side + 'Arm')!, r.bones.get(side + 'ForeArm')!, r.bones.get(side + 'Hand')!, t, pole, w);
        }
      }
    };
    rigPost.add(this.pushPost);
  }

  private stepPush(dt: number) {
    this.pushT -= dt;
    const h = this.pushHorse;
    if (!h) return;
    const pp = this.player.root.position, c = h.d.root.position;
    const place = (p: THREE.Vector3, sx: number, r: THREE.Object3D, setFacing: boolean) => {
      this.chest(h, 0, this.v1);
      // Delante del pecho, a un brazo; un poco a un lado para no ponerse uno encima del otro
      const fx = Math.sin(h.d.root.rotation.y), fz = Math.cos(h.d.root.rotation.y);
      const wantX = c.x + fx * 1.75 + fz * sx, wantZ = c.z + fz * 1.75 - fx * sx;
      const dx = wantX - p.x, dz = wantZ - p.z, d = Math.hypot(dx, dz);
      const st = Math.min(d, 3.4 * dt);
      if (d > 0.02) {
        p.x += (dx / d) * st;
        p.z += (dz / d) * st;
      }
      const yaw = Math.atan2(this.v1.x - p.x, this.v1.z - p.z);
      if (setFacing) this.walker.facing = yaw;
      else r.rotation.y = yaw;
    };
    place(pp, -0.24, this.player.root, true);
    if (this.pushGas) place(this.gas.root.position, 0.62, this.gas.root, false);
    if (this.pushT <= 0) this.endPush();
  }

  private endPush() {
    this.pushT = 0;
    this.pushHorse = null;
    if (this.pushPost) rigPost.delete(this.pushPost);
    this.pushPost = null;
  }

  private touchHorse(s: Horse) {
    const k = Math.sin(Math.min(1, 1 - s.rearT / REAR) * Math.PI);
    s.touched = true;
    this.luck++;
    this.startPush(s);
    const at = this.v1.copy(s.d.root.position).setY(2.4);
    // (los avisos de texto no se ven en el cómic: el acierto, como onomatopeya de tebeo)
    if (k > 0.85) {
      audio.perfect();
      comicWord(SANTJOAN.hints.perfect, 'perfect');
      this.fx.burst(at, '✨', 10, 3.5, 1.4);
      vibrate([20, 30, 20]);
    } else {
      audio.luck();
      comicWord(k < 0.4 ? SANTJOAN.hints.late : SANTJOAN.hints.luck, 'luck');
      vibrate(25);
    }
    // En Sa Plaça d'es Bè cuentan los de la plaza (a los de la calle se les puede tocar, pero no es «hacer botar»)
    if (this.phase === 'be' && s.plaza) {
      this.beTouched++;
      if (this.beTouched >= BE_NEED) {
        this.busy = true;
        this.input.reset();
        this.walker.stop();
        this.hud.setAction(null);
        later(() => dialogue(SANTJOAN.beDone, () => this.startTaxi()), 1200);
      }
    }
    this.updateHud();
  }

  private meet() {
    this.phase = 'meet';
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    const pp = this.player.root.position;
    const g = this.gas.root.position;
    this.walker.facing = Math.atan2(g.x - pp.x, g.z - pp.z);
    this.gas.root.rotation.y = Math.atan2(pp.x - g.x, pp.z - g.z);
    this.updateHud();
    // Nada de bailes: se encuentran, se abrazan y a seguir
    hugFor(this.player, this.gas, 4);
    audio.luck();
    dialogue(SANTJOAN.meet, () => later(() => this.startNuts(), 700));
  }

  /** Los del balcón del Casino no paran de tirar avellanes: hasta devolvérselas, no se sale de aquí. */
  private startNuts() {
    this.phase = 'nuts';
    this.map.style.display = 'none';
    this.pinOn = false;
    this.pinObj.visible = false;
    this.gas.root.visible = true;
    this.gasTrail = new Trail();
    this.busy = true;
    this.input.reset();
    // (si ya había uno, fuera: desde el modo prueba se podía empezar dos veces y quedaban dos balcones de gente)
    this.nuts?.dispose();
    this.nuts = new NutThrow(this.scene, this.player, this.walker, this.fx, -3.2, 11.2, BORN.minZ, () => this.updateHud(), () => {
      this.nuts?.dispose();
      this.nuts = null;
      this.pushNothing();
      dialogue(SANTJOAN.toBe, () => this.startBe());
    }, { rail: false });
    this.updateHud();
    dialogue(SIDE.nuts.intro, () => (this.busy = false));
  }

  private pushNothing() {
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    this.busy = true;
    this.input.reset();
    this.walker.stop();
  }

  /** A Sa Plaça d'es Bè, los dos juntos y andando: por Ses Voltes y la Plaça Espanya. */
  private startBe() {
    this.phase = 'be';
    this.map.style.display = 'none';
    this.pinObj.visible = false;
    this.gas.root.visible = true;
    this.gasTrail = new Trail();
    this.beTouched = 0;
    this.beIn = false;
    this.busy = false;
    this.input.reset();
    this.walker.stop();
    this.updateHud();
  }

  /**
   * La misma plaza, de día o ya de noche. De noche, como el cap. 2: perfil «noche», cielo con estrellas (sin luna: a
   * esas horas ya se ha puesto), poco ambiente y la luz azul de luna con sombras; fuera los caballos y las avellanes,
   * y encendidas las farolas (solo su halo: no iluminan nada).
   */
  private setNight(on: boolean) {
    if (on === this.night) return;
    this.night = on;
    const sc = this.scene;
    this.sky.group.removeFromParent();
    this.sky = on ? (this.nightSky ??= new Sky({ top: 0x02030f, mid: 0x0b1440, bottom: 0x1d2350, stars: 1400 })) : this.daySky;
    sc.add(this.sky.group);
    const fog = sc.fog as THREE.Fog;
    fog.color.set(on ? 0x0b1030 : 0xcfe0ee);
    fog.near = on ? 35 : 70;
    fog.far = on ? 150 : 180;
    // (la hemisférica propia, ya repartida: de noche 1,1 × 0,32 como en el cap. 2; de día 1,0 × 0,35 como en el 1)
    this.hemi.color.set(on ? 0x6f7fc0 : 0xeaf2ff);
    this.hemi.groundColor.set(on ? 0x1a2030 : 0x8a7a64);
    this.hemi.intensity = on ? 1.1 * 0.32 : 1.0 * 0.35;
    const L = this.sun.light;
    L.color.set(on ? 0xb8c8ff : 0xfff1dc);
    L.intensity = on ? 2.0 : 2.1;
    // (la luna va baja: sin esto, rayas de sombra en las paredes largas, como en el cap. 2)
    L.shadow.normalBias = on ? 0.16 : 0.03;
    L.shadow.bias = on ? -0.0012 : -0.0006;
    comicMood(sc, on ? 'noche' : 'dia');
    dust.tint(on);
    for (const h of this.horses) {
      h.d.root.visible = !on;
      h.alert.visible = false;
      h.charge = false;
      h.rearT = h.warnT = 0;
      h.boostT = 0;
      h.d.pivot.rotation.x = 0;
      h.d.pivot.position.y = 0;
    }
    for (const b of this.bags) b.obj.visible = !on && !b.taken;
    for (const s of this.halos) {
      s.visible = on;
      if (on && s.material !== nightHalo()) {
        s.material = nightHalo();
        s.scale.setScalar(2.6);
      }
    }
  }

  /** El taxi de la Plaça Espanya, libre (luz verde), aparcado junto a la fachada. Uno solo, aunque se repita la fase. */
  private showPlazaTaxi(on: boolean) {
    if (on && !this.plazaTaxi) {
      const taxi = makeTaxi();
      taxi.azul.visible = false;
      taxiFree(taxi, true);
      taxi.root.position.copy(TAXI);
      taxi.root.rotation.y = -Math.PI / 2;
      this.scene.add(taxi.root);
      new CarRig(taxi).update(0.016, 0);
      this.plazaTaxi = taxi;
    }
    if (this.plazaTaxi) this.plazaTaxi.root.visible = on;
    const i = this.colliders.indexOf(this.plazaTaxiBox);
    if (on && i < 0) this.colliders.push(this.plazaTaxiBox);
    else if (!on && i >= 0) this.colliders.splice(i, 1);
  }

  /** Ya de noche, a coger un taxi: Gas va cojísimo. */
  private startTaxi() {
    fadeFlash(() => {
      this.setNight(true);
      this.showPlazaTaxi(true);
      this.phase = 'taxi';
      this.busy = true;
      const pp = this.player.root.position;
      this.gas.root.visible = true;
      this.gas.root.position.y = pp.y;
      this.walker.stop();
      this.walker.speed = 1.5;
      this.pair?.stop();
      this.pair = new LimpPair(this.player, this.gas);
      this.pair.start(this.walker.facing);
      // La parada de Gas, a medio camino
      this.taxiFrom = Math.max(12, Math.hypot(pp.x - TAXI_DOOR.x, pp.z - TAXI_DOOR.z));
      this.restT = 0;
      this.restDone = false;
      this.input.reset();
      this.updateHud();
      audio.stopMusic();
      audio.startMusic('night');
      dialogue(SANTJOAN.taxiNight, () => {
        this.busy = false;
      });
    }, 800);
  }

  /** Suben al taxi: le dicen adónde van y arranca. */
  private boardTaxi() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    dialogue(SANTJOAN.taxiPals, () => {
      audio.pop();
      fadeFlash(() => this.startRide(), 700);
    });
  }

  /**
   * El viaje: ya en marcha y con la cámara detrás del taxi desde el primer fotograma. Primero el cartucho del
   * narrador; luego hablan, cada uno desde su asiento, y el camino dura lo que tardan en decírselo.
   */
  private startRide() {
    // Del todo fuera de la plaza: los que quedan se van a la escena de casa
    this.pair?.stop();
    this.pair = null;
    this.walker.speed = 4.0;
    this.ride = new TaxiRide();
    this.phase = 'ride';
    this.rideT = 0;
    this.rideI = 0;
    this.rideAt = 0;
    this.rideTalk = false;
    const talk = SANTJOAN.rideTalk.reduce((t, l) => t + barkTime(l.text) * 0.9, 0) + 3.5;
    this.ride.start(this.camera, talk);
    this.updateHud();
    this.busy = false;
    later(() => {
      if (this.phase === 'ride' && this.ride) dialogue(SANTJOAN.ride, () => {
        this.rideTalk = true;
        this.rideAt = this.rideT + 0.5;
      });
    }, 700);
  }

  private updateRide(dt: number) {
    this.rideT += dt;
    const lines = SANTJOAN.rideTalk;
    if (this.rideTalk && this.rideI < lines.length && this.rideT >= this.rideAt) {
      const l = lines[this.rideI++];
      bark(l.who, l.text, taxiSide(l.who));
      this.rideAt = this.rideT + barkTime(l.text) * 0.9;
    }
    const talkDone = this.rideTalk && this.rideI >= lines.length && this.rideT > this.rideAt;
    if (this.ride!.update(dt, this.camera, !talkDone) && !this.busy) {
      this.busy = true;
      this.startHome();
    }
  }

  /** De madrugada, a casa de Azul: el taxi llega, se paga, se bajan; por la cancela, con la llave y a dormir. */
  private startHome(after?: () => void) {
    fadeFlash(() => {
      cinema.stop();
      closeDialogue();
      if (this.ride) disposeScene(this.ride.scene);
      this.ride = null;
      this.pair?.stop();
      this.pair = null;
      const sc = new THREE.Scene();
      // Como el taxi y la noche del cap. 2: perfil «noche», ambiente ×0,32, luna azul con sombras, sin lámparas que
      // iluminen (fuera la luz del porche y el foco de los faros)
      sc.userData.comicLook = 'noche';
      sc.userData.hemiScale = 0.32;
      sc.fog = new THREE.Fog(0x0b1030, 35, 150);
      const sky = new Sky({ top: 0x02030f, mid: 0x0b1440, bottom: 0x1d2350, stars: 1400 });
      sc.add(sky.group);
      sc.add(new THREE.HemisphereLight(0x6f7fc0, 0x1a2030, 1.1));
      const sun = new Sun(sc, 0xb8c8ff, 2.0, new THREE.Vector3(-0.4, 1, 0.5), 18);
      sun.light.shadow.normalBias = 0.16;
      sun.light.shadow.bias = -0.0012;
      const colliders: Box2[] = [];
      const place = buildAzulHouse(sc, colliders, false);
      place.steam.forEach((s) => (s.visible = false));
      this.sleepingHouse(sc);
      // (a las tres de la mañana, los apliques y la guirnalda de la terraza, apagados: los padres duermen)
      for (const l of place.wallLamps ?? []) l.visible = false;
      if (place.garland) (place.garland.material as THREE.PointsMaterial).color.setHex(GARLAND_OFF);
      for (const sx of [-1, 1]) colliders.push({ minX: sx * 11.5 - 5.3, maxX: sx * 11.5 + 5.3, minZ: 10.1, maxZ: 10.5 });
      sc.add(this.player.root, this.gas.root);
      const pp = this.player.root.position;
      // Todos dentro del taxi, que llega por la calle: se bajan al parar
      pp.set(1.5, -0.45, STREET_Z);
      this.walker.stop();
      this.walker.speed = 2.6;
      this.walker.yaw = this.walker.facing = Math.PI;
      this.player.root.visible = false;
      this.gas.root.position.set(1.5, -0.45, STREET_Z);
      this.gas.root.visible = false;
      // Llega ya en marcha (a la velocidad del viaje) y frena hasta parar delante de la cancela; ocupado: sin luz verde
      const taxi = makeTaxi({ back: MARC_LOOK });
      taxi.azul.visible = true;
      taxiFree(taxi, false);
      taxi.root.rotation.y = -Math.PI / 2;
      taxi.root.position.set(HOME_STOP_X + HOME_BRAKE, 0, STREET_Z + 0.6);
      sc.add(taxi.root);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xffd23f, fog: false }));
      marker.position.set(DOOR.x, 2.6, DOOR.z + 0.7);
      marker.visible = false;
      sc.add(marker);
      this.home = {
        scene: sc, sky, sun, colliders, gate: place.gate, door: place.door, beam: place.beam, who: [], marker, taxi, rig: new CarRig(taxi),
        stage: 'arrive', v: HOME_V0, outT: 0, leaveT: 0, homeLine: false, unlocked: false,
      };
      applyShadows(sc);
      // (la cámara ya en su sitio desde el primer fotograma: antes venía barriendo desde otro punto de la calle)
      this.homeCamera(1);
      this.phase = 'home';
      this.busy = true;
      this.lost.reset();
      this.updateHud();
      audio.stopMusic();
      audio.startMusic('night');
      after?.();
    }, 700);
  }

  /**
   * La casa duerme (son las tantas y su madre está dentro): las ventanas de arriba, apagadas, y la guirnalda de la
   * terraza, apagada. Se queda la luz del recibidor, que se ve por el cristal de la puerta.
   */
  private sleepingHouse(sc: THREE.Scene) {
    const box = new THREE.Box3();
    const dark = new THREE.Color(0x141a2a);
    for (const o of sc.children) {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !(m.material as THREE.MeshBasicMaterial).isMeshBasicMaterial || !m.geometry.attributes.color) continue;
      m.geometry.computeBoundingBox();
      box.copy(m.geometry.boundingBox!);
      // (lo encendido de la fachada de la casa: la puerta y los ventanales de arriba)
      if (box.min.x < -4 || box.max.x > 1 || box.max.y > 5 || box.min.z < -0.5 || box.max.z > 1.2) continue;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute, col = m.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 3) col.setXYZ(i, dark.r, dark.g, dark.b);
      col.needsUpdate = true;
    }
    sc.traverse((o) => {
      const s = o as THREE.Sprite;
      if (s.isSprite && s.position.x > 4 && s.position.x < 5.2 && s.position.z > 0.5 && s.position.z < 10 && s.position.y < 3) s.visible = false;
    });
  }

  /** Plano fijo de la calle mientras el taxi llega, se paga, se bajan y se va. */
  private homeCamera(k: number) {
    const c = this.home!.taxi.root.position;
    this.camera.position.lerp(this.v1.set(Math.max(c.x, 2) + 7, 2.5, STREET_Z + 5.5), k);
    this.camera.lookAt(Math.max(c.x, -3), 1.1, STREET_Z - 0.4);
  }

  /** El taxi entra por la calle en marcha, frena y para delante de casa; se paga, se bajan por la acera y se va. */
  private stepTaxiArrival(dt: number) {
    const h = this.home!;
    const c = h.taxi.root.position;
    const prev = c.x;
    const ss = THREE.MathUtils.smoothstep;
    if (h.stage === 'arrive') {
      const remain = c.x - HOME_STOP_X;
      h.v = Math.min(h.v, Math.sqrt(2 * HOME_DECEL * Math.max(0, remain)));
      c.x = Math.max(HOME_STOP_X, c.x - h.v * dt);
      if (c.x - HOME_STOP_X < 0.03) {
        c.x = HOME_STOP_X;
        h.v = 0;
        h.stage = 'pay';
        // (paso nuevo: nadie se baja de un taxi sin pagar)
        later(() => dialogue(SANTJOAN.pay, () => {
          if (this.home !== h) return;
          h.stage = 'out';
          h.outT = 0;
        }), 400);
      }
    } else if (h.stage === 'out') {
      h.outT += dt;
      // Ella, por la puerta de delante (la del lado de la acera); él, después, por la de atrás
      const who: [Person, number, number, THREE.Object3D][] = [[this.player, 0, SEAT_FRONT_X, h.taxi.azul], [this.gas, 1.1, SEAT_BACK_X, h.taxi.back]];
      for (const [p, t0, ox, seat] of who) {
        const k = h.outT - t0;
        if (k < 0) continue;
        seat.visible = false;
        const r = p.root;
        r.visible = true;
        const kk = Math.min(1, k / 0.95);
        r.position.set(c.x + ox, THREE.MathUtils.lerp(-0.45, 0, ss(kk, 0, 0.55)), THREE.MathUtils.lerp(c.z - 0.45, c.z - 1.8, ss(kk, 0, 1)));
        r.rotation.y = Math.PI;
        animatePerson(p, dt, k < 0.95 ? 'walk' : 'idle', 0.6);
        if (p === this.gas && k >= 0.95) limpPose(p, false);
      }
      if (h.outT > 2.4) {
        h.stage = 'leave';
        h.leaveT = 0;
        // Ya va libre: luz verde
        taxiFree(h.taxi, true);
        this.walker.facing = this.walker.yaw = Math.PI;
        this.pair = new LimpPair(this.player, this.gas);
        this.pair.start(Math.PI);
      }
    } else if (h.stage === 'leave') {
      // Se va por donde iba
      h.leaveT += dt;
      c.x -= dt * Math.min(9, h.leaveT * 4);
      if (h.leaveT > 2.2 && this.busy && !h.homeLine && !document.querySelector('.dialogue')) {
        h.homeLine = true;
        dialogue(SANTJOAN.home, () => {
          this.busy = false;
        });
      }
      if (c.x < -70) {
        h.taxi.root.visible = false;
        h.stage = 'gone';
      }
    }
    h.rig.update(dt, dt > 0 ? (prev - c.x) / dt : 0, 0, 1.2);
  }

  private updateHome(dt: number) {
    const h = this.home!;
    const pp = this.player.root.position;
    const free = !this.busy && this.phase === 'home';
    this.walker.turn(this.input.consumeCam());
    this.walker.canJump = false;
    this.walker.canSprint = false;
    if (h.stage !== 'gone') this.stepTaxiArrival(dt);
    h.beam.rotation.y = this.t * 0.9; // el faro de Sa Farola gira
    h.who.length = 0;
    h.who.push(pp);
    const onFoot = h.stage === 'leave' || h.stage === 'gone';
    if (onFoot) {
      if (this.pair) {
        const lag = Math.hypot(this.gas.root.position.x - pp.x, this.gas.root.position.z - pp.z);
        this.walker.speed = lag > 2.2 ? 0.7 : this.pair.speed();
      }
      const mag = this.walker.move(dt, free ? this.input.axes() : { x: 0, y: 0 }, h.colliders, { minX: -9, maxX: 12, minZ: 0.6, maxZ: 15.5 });
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);
      if (this.pair) {
        const moving = this.pair.step(dt, this.walker.facing, h.colliders);
        animatePerson(this.gas, dt, moving ? 'walk' : 'idle', 0.32);
        this.pair.pose();
      }
      h.who.push(this.gas.root.position);
    }
    // La cancela se abre al llegar; la puerta de casa, solo con la llave
    h.gate.update(dt, h.who, this.camera.position);
    h.door.update(dt, h.unlocked ? h.who : [], this.camera.position);
    const near = Math.hypot(pp.x - DOOR.x, pp.z - DOOR.z) < 2;
    let label: string | null = null;
    if (free && near) label = h.unlocked ? SANTJOAN.sleepBtn : SANTJOAN.keysBtn;
    this.hud.setAction(label, !!label);
    if (this.input.consumeAction() && label) {
      if (h.unlocked) this.finish();
      else this.unlock();
    }
    // Pistas, solo si se ha perdido
    const lostNow = this.lost.tick(`home|${h.stage}|${h.unlocked}`, dt, this.busy);
    const show = lostNow && free && !near;
    h.marker.visible = show;
    h.marker.rotation.y += dt * 2;
    if (show) {
      const ang = Math.atan2(DOOR.x - pp.x, DOOR.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(-rel);
      beacon.at(DOOR);
    } else {
      this.hud.setArrow(null);
      beacon.at(null);
    }
    if (h.stage !== 'gone' && this.busy) this.homeCamera(1 - Math.exp(-dt * 2));
    else this.walker.camera(this.camera, dt, h.colliders, 6, pp.z < 10.4 && pp.z > -0.5 && Math.abs(pp.x) < 5.4 ? 2.3 : 3.4);
    h.sun.follow(pp);
    h.sky.update(this.camera, dt);
  }

  /** Paso nuevo (inventado): la llave, despacito, que duerme todo el mundo. */
  private unlock() {
    const h = this.home!;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    const pp = this.player.root.position;
    this.walker.facing = Math.atan2(DOOR.x - pp.x, DOOR.z - pp.z);
    bark('Margaux', SANTJOAN.keys);
    // Las llaves: dos tintineos y la cerradura, flojito
    audio.knock(0.08, 2600, 0.025);
    later(() => audio.knock(0.08, 3000, 0.025), 260);
    later(() => {
      if (this.home !== h) return;
      audio.knock(0.14, 900, 0.05);
      h.unlocked = true;
      h.door.hold(3);
      this.busy = false;
    }, 1500);
  }

  private finish() {
    this.pair?.stop();
    this.phase = 'ending';
    this.busy = true;
    this.map.style.display = 'none';
    this.hud.setAction(null);
    this.updateHud();
    audio.fanfare();
    later(() => {
      if (this.phase !== 'ending') return;
      dialogue(SANTJOAN.after, () => phoneChat([CHATS.deslumbras, CHATS.miManchi], () => {
        later(() => {
          if (this.phase !== 'ending') return;
          this.phase = 'done';
          audio.ambience(0);
          const stars = 1 + (this.bagCount >= 5 ? 1 : 0) + (this.luck >= 2 ? 1 : 0);
          this.onComplete({
            stars,
            stats: [
              ['Fotos hasta la exacta', `${this.misses + 1} 📷`],
              ['Avellanes', `${this.bagCount}/${this.bags.length} 🌰`],
              ['Toques a los caballos', `${this.luck} 🐎`],
              ['Tiempo dando vueltas', clock(this.playTime)],
            ],
          });
        }, 2000);
      }));
    }, 2500);
  }

  // ---------------- Bocadillos ----------------

  /**
   * De dónde sale el bocadillo de quien no se encuentra por su nombre (main.ts, setSpeakerResolver): dentro del taxi,
   * cada uno desde su asiento; «Un caixer», el jinete del caballo que grita; «Una de Ciutadella», la mujer de la
   * gente más cercana a Azul. null: que lo busque main.ts (Azul y Gas a pie).
   */
  speakerPoint(who: string): THREE.Vector3 | null {
    if (this.ride) return this.ride.speakerPoint(who);
    if (this.home) {
      const h = this.home;
      if (!h.taxi.root.visible) return null;
      const inside = who === 'Taxista' || ((who === 'Margaux' || who === 'Azul') && !this.player.root.visible) || ((who === 'Gas' || who === 'Marc') && !this.gas.root.visible);
      return inside ? taxiSeat(h.taxi, who) : null;
    }
    if (who === 'Taxista') return this.plazaTaxi?.root.visible ? taxiSeat(this.plazaTaxi, who) : null;
    const pp = this.player.root.position;
    if (who === 'Un caixer') {
      let s = this.talker && this.talker.d.root.visible ? this.talker : null;
      if (!s) {
        let bd = 25;
        for (const h of this.horses) {
          const d = h.d.root.position.distanceTo(pp);
          if (h.d.root.visible && d < bd) {
            bd = d;
            s = h;
          }
        }
      }
      if (!s) return null;
      // La cabeza del caixer, montado: encima de la silla (y sube con el caballo de manos)
      s.d.pivot.updateWorldMatrix(true, false);
      return s.d.pivot.localToWorld(this.v3.set(0, 2.85, 0.7));
    }
    if (who === 'Una de Ciutadella') {
      let bd = 16, bx = 0, bz = 0;
      for (const c of this.crowds) {
        if (!c.female) continue;
        for (const b of c.base) {
          const d = Math.hypot(b.x - pp.x, b.z - pp.z);
          if (d < bd) {
            bd = d;
            bx = b.x;
            bz = b.z;
          }
        }
      }
      return bd < 16 ? this.v3.set(bx, bornHeight(bx, bz) + 2.0, bz) : null;
    }
    return null;
  }

  /** Hacia qué lado se abre el globo: en el taxi, el taxista y Gas a la izquierda, ella a la derecha. */
  speakerSide(who: string): 'l' | 'r' | undefined {
    const inTaxi = !!this.ride || (!!this.home && this.home.taxi.root.visible) || (who === 'Taxista' && !!this.plazaTaxi?.root.visible);
    return inTaxi && this.speakerPoint(who) ? taxiSide(who) : undefined;
  }

  // ---------------- Modo prueba ----------------

  /**
   * Deja el capítulo limpio para saltar a una fase (modo prueba): fuera el viaje y la casa, el minijuego, el empujón,
   * la pareja coja, los diálogos; de día o de noche; Azul y Gas de vuelta en la plaza.
   */
  private resetTo(night: boolean) {
    closeDialogue();
    cinema.stop();
    if (this.ride) disposeScene(this.ride.scene);
    this.ride = null;
    if (this.home) {
      // (Azul y Gas están en la escena de casa: primero de vuelta, si no se liberaban con ella)
      this.scene.add(this.player.root, this.gas.root);
      disposeScene(this.home.scene);
      this.home = null;
    }
    this.nuts?.dispose();
    this.nuts = null;
    this.pair?.stop();
    this.pair = null;
    this.endPush();
    this.setNight(night);
    this.showPlazaTaxi(night);
    this.player.root.visible = true;
    this.gas.root.visible = false;
    this.walker.speed = 4.0;
    this.walker.canSprint = true;
    this.walker.stop();
    this.input.reset();
    this.busy = false;
    this.lost.reset();
    this.pinOn = false;
    this.pinObj.visible = false;
    this.map.style.display = 'none';
    this.talker = null;
    this.spotted = false;
    this.chargeDone = false;
    this.beIn = false;
    this.beTouched = 0;
    this.restT = 0;
    this.restDone = false;
    this.rideTalk = false;
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    audio.stopMusic();
    audio.startMusic(night ? 'night' : 'jaleo');
  }

  debug(): DebugItem[] {
    const hunt = () => {
      this.resetTo(false);
      this.phase = 'hunt';
      this.reached = 0;
      this.setPin(0);
    };
    const tp = (x: number, z: number, yaw = 0) => {
      this.busy = false;
      this.input.reset();
      this.player.root.position.set(x, 0, z);
      this.walker.stop();
      this.walker.yaw = this.walker.facing = yaw;
    };
    const gasAt = (x: number, z: number) => {
      this.gas.root.visible = true;
      this.gas.root.position.set(x, 0, z);
    };
    return [
      { label: '1 · Plaça Espanya', run: () => { hunt(); tp(START.x, START.z, -Math.PI / 2); } },
      { label: '2 · Ses Voltes (caballo desbocado)', run: () => { hunt(); tp(40, 0, -Math.PI / 2); } },
      { label: '2b · Correus (llegar a la ubicación)', run: () => { hunt(); tp(6, 9.5, 0); } },
      { label: '3 · Foto exacta', run: () => { this.resetTo(false); this.phase = 'exact'; this.map.style.display = 'block'; this.updateHud(); tp(5, -9.5, Math.PI); } },
      { label: '3b · Gas viene (después de la foto)', run: () => { this.resetTo(false); tp(5, -9.5, Math.PI); this.map.style.display = 'block'; this.sendLocation(); } },
      { label: '4 · Se encuentran', run: () => { this.resetTo(false); tp(1, 4.5); gasAt(2, 5.5); this.meet(); } },
      { label: '4b · Avellanes del Casino', run: () => { this.resetTo(false); tp(4, -9, Math.PI); gasAt(5, -8); this.startNuts(); } },
      { label: '5 · Sa Plaça d’es Bè', run: () => { this.resetTo(false); tp(88, 0, Math.PI / 2); gasAt(86.5, 0.8); this.startBe(); } },
      { label: '5b · Al taxi, de noche', run: () => { this.resetTo(false); tp(100, 0, -Math.PI / 2); gasAt(100.5, 0.4); this.startTaxi(); } },
      { label: '5c · Al taxi: la parada de Gas', run: () => { this.resetTo(false); tp(100, 0, -Math.PI / 2); gasAt(100.5, 0.4); this.startTaxi(); later(() => { this.taxiFrom = 99; }, 900); } },
      { label: '5d · En el taxi', run: () => { this.resetTo(true); tp(80, 7, -Math.PI / 2); this.busy = true; fadeFlash(() => this.startRide(), 200); } },
      { label: '6 · Casa: llega el taxi', run: () => { this.resetTo(true); this.busy = true; this.startHome(); } },
      { label: '6b · Casa: hasta la puerta', run: () => { this.resetTo(true); this.busy = true; this.startHome(() => this.skipArrival()); } },
      { label: '6c · Casa: la puerta, con la llave', run: () => { this.resetTo(true); this.busy = true; this.startHome(() => this.skipArrival(DOOR.x + 0.4, DOOR.z + 1.5)); } },
      { label: '✓ Completar capítulo', run: () => { this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  /** Modo prueba: el taxi ya se ha ido; los dos, a pie (delante de la cancela, o donde se diga). */
  private skipArrival(x = 0.3, z = STREET_Z - 1.8) {
    const h = this.home!;
    h.stage = 'gone';
    h.taxi.root.visible = false;
    h.homeLine = true;
    this.player.root.visible = this.gas.root.visible = true;
    this.player.root.position.set(x, 0, z);
    this.gas.root.position.set(x + 0.4, 0, z);
    this.walker.yaw = this.walker.facing = Math.PI;
    this.pair = new LimpPair(this.player, this.gas);
    this.pair.start(Math.PI);
    this.busy = false;
  }

  dispose() {
    this.map.remove();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.pair?.stop();
    this.nuts?.dispose();
    disposeScene(this.scene);
    if (this.pushPost) rigPost.delete(this.pushPost);
    if (this.ride) disposeScene(this.ride.scene);
    if (this.home) disposeScene(this.home.scene);
  }
}

/** Casa de Azul: dónde para el taxi, cuánto frena y a qué va cuando entra en la calle (la del viaje). */
const HOME_STOP_X = 1.5;
const HOME_V0 = 8;
const HOME_DECEL = 1.6;
const HOME_BRAKE = (HOME_V0 * HOME_V0) / (2 * HOME_DECEL);
/** Por dónde se bajan, a lo largo del taxi (mira hacia -x): la puerta de delante y la de atrás. */
const SEAT_FRONT_X = 0.2;
const SEAT_BACK_X = 1.1;
