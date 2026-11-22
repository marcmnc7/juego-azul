import * as THREE from 'three';
import { steerTo, type SteerState } from '../core/steer';
import { Trail } from '../core/follow';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, WALK_SPEED, type Circle } from '../core/walker';
import { Sky, Sun, toon, vibrate, applyShadows } from '../core/gfx';
import { comicMood } from '../core/comic';
import { dust } from '../core/dust';
import { Lost } from '../core/lost';
import { SANTJOAN, SANTJOAN_CHATTER, SANTJOAN_BYE, SANTJOAN_HINTS, FAIL, type Line } from '../data/story';
import { AZUL_SANTJOAN, GAS_SANTJOAN } from '../data/characters';
import { G, Merger, makePerson, makeHorse, animatePerson, vertexMat, makeCrowd, type CrowdLike, crowdPose, newCrowdPose, type Person, type Donkey, type PersonLook } from '../entities/models';
import type { Behave } from '../entities/crowdRig';
import { Particles } from '../entities/fx';
import { livesChip, hud, dialogue, Hud, DebugItem, later, phoneChat, fadeFlash, bark, comicWord, closeDialogue, failCard, viewfinder } from '../ui/ui';
import { hugFor } from '../entities/embrace';
import { horsePrint, shirtPrint } from '../entities/print';
import { buildAzulHouse, STREET_Z, DOOR, UP_DOOR, GARLAND_OFF, STAIR_PATH, TERRACE, TERRACE_Y, stairY, stairAt, pathLen } from './levelCena';
import type { Door } from './door';
import { CHATS } from '../data/chats';
import { canvasTex } from './deco';
import type { Box2 } from './ferreries';
import { makeTaxi, TaxiRide, taxiFree, taxiSeat, taxiSide, type Taxi } from './camiFarola';
import { limpPose } from '../entities/limp';
import { LimpPair } from '../entities/limpPair';
import { HandPair } from '../entities/handPair';
import { NutThrow, NUTS_NEED } from './sideGames';
import { SIDE } from '../data/story';
import { rigPost } from '../entities/rig';
import { twoBone } from '../entities/embrace';
import { CarRig } from '../entities/models';
import { cinema } from '../core/cinema';
import { buildSurroundings, collidersBox } from './surround';
import { BORN, BORN_RISE, CORREUS, bornHeight } from './born';
import { buildCiutadella, nightHalo, STREET, ESPANYA, BE, BE_BOX, CIUTADELLA_BOUNDS } from './ciutadella';
import { clock, type Level, type LevelDone, disposeScene } from './level';
import { beacon } from '../core/beacon';


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

type Phase = 'intro' | 'hunt' | 'exact' | 'coming' | 'meet' | 'nuts' | 'cross' | 'be' | 'taxi' | 'ride' | 'home' | 'ending' | 'done';

// Plano (metros): el Born en el origen; hacia el este, el Carrer Major des Born con la Catedral, Ses Voltes
// y, al final, la Plaça Nova y la Plaça Espanya
const PINS = [new THREE.Vector3(CORREUS.x + 2, 0, CORREUS.z - 1.2)]; // Correus
const START = new THREE.Vector3(82, 0, 0); // Plaça Espanya
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
/** Una persona de la gente: de pie (gesticulando, con el móvil, bebiendo) o paseando por su tramo. */
type Folk = { x: number; z: number; ry: number; ph: number; pi: number; walk?: { ax: 'x' | 'z'; a0: number; a1: number; dir: 1 | -1 }; turnT?: number };
const FOLK_SPEED = 0.85;
/**
 * La calzada que rodea la explanada del Born (entre la explanada y la acera): por ella dan la vuelta los caballos
 * cuando hay que cruzar. Centro del carril: x = ±14,1 y z = ±10,6, con las esquinas redondeadas.
 */
const RING = { a: 14.1, b: 10.6, r: 2.2 };
const RING_LEN = 2 * (2 * (RING.a - RING.r)) + 2 * (2 * (RING.b - RING.r)) + 2 * Math.PI * RING.r;
/** Un punto de la vuelta (s en metros) y hacia dónde mira el coche. */
function ringAt(s: number, out: THREE.Vector3) {
  const { a, b, r } = RING;
  const ly = 2 * (b - r), lx = 2 * (a - r), q = (Math.PI * r) / 2;
  let d = ((s % RING_LEN) + RING_LEN) % RING_LEN;
  const arc = (cx: number, cz: number, a0: number) => {
    const t = a0 + (d / q) * (Math.PI / 2);
    out.set(cx + Math.cos(t) * r, 0, cz + Math.sin(t) * r);
    return Math.atan2(-Math.sin(t), Math.cos(t));
  };
  // Este (hacia +z), esquina, sur (hacia -x), esquina, oeste (hacia -z), esquina, norte (hacia +x), esquina
  if (d < ly) return out.set(a, 0, -b + r + d), 0;
  d -= ly;
  if (d < q) return arc(a - r, b - r, 0);
  d -= q;
  if (d < lx) return out.set(a - r - d, 0, b), -Math.PI / 2;
  d -= lx;
  if (d < q) return arc(-a + r, b - r, Math.PI / 2);
  d -= q;
  if (d < ly) return out.set(-a, 0, b - r - d), Math.PI;
  d -= ly;
  if (d < q) return arc(-a + r, -b + r, Math.PI);
  d -= q;
  if (d < lx) return out.set(-a + r + d, 0, -b), Math.PI / 2;
  d -= lx;
  return arc(a - r, -b + r, (3 * Math.PI) / 2);
}
const onRing = (x: number, z: number) => Math.abs(x) < 16.4 && Math.abs(z) < 12.4 && (Math.abs(x) > 11.8 || Math.abs(z) > 8.8);
/** Al otro lado: la entrada de Ses Voltes. */
const CROSS_GOAL = new THREE.Vector3(18.8, 0, 0);
/** Las avellanes, entre la gente de la calle: en el Born, delante del Casino (fuera del corro de los caballos). */
const NUT_BOX = { minX: -4, maxX: 11, minZ: -12.6, maxZ: -9.6 };
const WARN = 0.8;
const REAR = 1.8;
const TOUCH_R = 3.2;
/** Lo que dura un bocadillo en pantalla (la misma cuenta que ui.ts): para repartir lo que hablan en el taxi. */
const barkTime = (text: string) => (2100 + Math.min(2400, text.length * 55)) / 1000;


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
  /** La de verdad: arriba, al final de la escalera (la de abajo es la del porche y no se abre). */
  upDoor: Door;
  /** Subiendo la escalera (metros recorridos por ella), o ya arriba en la terraza. */
  climb: number | null;
  /** Los caminos de cada uno, desde donde estaban al pie de la escalera. */
  herPath: [number, number][];
  hisPath: [number, number][];
  up: boolean;
  /** Ya le ha dicho que por el porche no se entra. */
  porchSaid: boolean;
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
  private crowds: { people: CrowdLike; female: boolean; base: Folk[] }[] = [];
  /** Con quién se ha hablado ya (nombre, si sabe lo que toca y qué charla le toca). */
  private folkInfo = new Map<Folk, { name: string; hint: boolean; talk: number; times: number }>();
  private folkNext = 0;
  /** Cruzar la calle de la mano: los coches que dan la vuelta al Born y la pareja. */
  private cross: { cars: { d: Donkey; s: number; v: number; walk: number; surge: number }[]; hands: HandPair; hitT: number } | null = null;
  /** Con quién se está hablando (se para mientras tanto). */
  private talkTo: Folk | null = null;
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
  /** Adónde mira la cámara en la escalera y en la terraza de casa (suavizado). */
  private homeLook = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private bounds: Box2 = CIUTADELLA_BOUNDS;
  private beIn = false;

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

    // Ciutadella (compartida con el capítulo 2): de día, con banderas, el Imperi sin terraza y sin coches
    const town = buildCiutadella(sc, this.colliders, new THREE.Vector3(0, 0, 0), { fiesta: true, terrace: false });
    this.halos.push(...town.halos, ...town.bornHalos);
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
    this.player = makePerson(AZUL_SANTJOAN);
    shirtPrint(this.player, horsePrint(), 0.23);
    markAccessories(this.player.root);
    this.player.root.position.copy(START);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.yaw = this.walker.facing = -Math.PI / 2;

    this.gas = makePerson(GAS_SANTJOAN);
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
    this.map.style.cssText = 'position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 74px);width:200px;height:57px;border-radius:12px;background:rgba(20,18,40,.72);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;display:none';
    // (dentro de la interfaz y el primero: la pausa, los diálogos y los chats quedan por encima; antes iba suelto
    // en la página, con z-index, y se veía encima del botón de Seguir de la pausa)
    const uiRoot = document.getElementById('ui');
    if (uiRoot) uiRoot.prepend(this.map);
    else document.body.append(this.map);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.camera.position.set(START.x + 7, 4, 0);
    this.updateHud();
    audio.startMusic('jaleo');
    later(() => {
      if (this.phase !== 'intro') return;
      // Un solo chat, seguido: la tarde del 23, de «Aceptame la UBI» a «Vamos correos» (antes eran cuatro trozos)
      phoneChat(CHATS.santJoanDia, () =>
        dialogue(SANTJOAN.bandera, () => {
          if (this.phase !== 'intro') return;
          this.busy = false;
          this.phase = 'hunt';
          this.setPin(0);
        }),
      );
    }, 900);
  }

  get threeScene() {
    return this.home ? this.home.scene : this.ride ? this.ride.scene : this.scene;
  }

  // ---------------- Ciutadella ----------------

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
      // (la calzada, libre: por ella pasan los caballos)
      if (onRing(x, z)) continue;
      // (donde se tiran las avellanes, la gente que juega: nadie quieto en medio)
      if (x > NUT_BOX.minX - 1 && x < NUT_BOX.maxX + 1 && z > NUT_BOX.minZ - 1 && z < NUT_BOX.maxZ + 1) continue;
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
    // Como en Ferreries: unos pasean por su tramo (el más largo libre a su alrededor), otros beben, miran el móvil o
    // charlan. Antes estaban todos quietos en su sitio
    const inBorn = (x: number, z: number) => Math.abs(x) < BORN.maxX - 1 && Math.abs(z) < BORN.maxZ - 1 && Math.hypot(x, z) > HORSE_R + 2.2 && !onRing(x, z);
    const inVoltes = (x: number, z: number) => x > 32 && x < 70 && Math.abs(z) > 1.8 && Math.abs(z) < 4.2;
    const walkable = (x: number, z: number, born: boolean) => clear(x, z) && (born ? inBorn(x, z) : inVoltes(x, z)) && !(x > NUT_BOX.minX - 1 && x < NUT_BOX.maxX + 1 && z > NUT_BOX.minZ - 1 && z < NUT_BOX.maxZ + 1);
    const folk: (Folk & { behave: Behave })[] = pts.map((p, pi) => {
      const f: Folk & { behave: Behave } = { ...p, pi, ry: p.x >= BE_BOX.minX ? Math.atan2(BE.x - p.x, BE.z - p.z) : p.x < 20 ? Math.atan2(-p.x, -p.z) : Math.random() * 6, ph: Math.random() * 6, behave: 'idle' };
      const born = p.x < 20, voltes = p.x > 32 && p.x < 70;
      const k = Math.random();
      if ((born || voltes) && k < 0.42) {
        const ax: 'x' | 'z' = voltes ? 'x' : Math.abs(p.x) > Math.abs(p.z) ? 'z' : 'x';
        const base = ax === 'x' ? p.x : p.z;
        const at = (v: number) => (ax === 'x' ? walkable(v, p.z, born) : walkable(p.x, v, born));
        let a0 = base, a1 = base;
        while (a0 > base - 8 && at(a0 - 0.4)) a0 -= 0.4;
        while (a1 < base + 8 && at(a1 + 0.4)) a1 += 0.4;
        if (a1 - a0 > 3) {
          f.walk = { ax, a0, a1, dir: Math.random() < 0.5 ? 1 : -1 };
          f.behave = 'walk';
          return f;
        }
      }
      f.behave = k < 0.62 ? 'drink' : k < 0.8 ? 'phone' : 'idle';
      return f;
    });
    LOOKS.forEach((lk, li) => {
      const mine = folk.filter((_, i) => i % LOOKS.length === li);
      const people = makeCrowd(lk, mine.length, false, mine.map((f) => f.behave));
      this.scene.add(people.group);
      this.crowds.push({ people, female: !lk.male, base: mine });
    });
    this.people = pts.map((p) => ({ x: p.x, z: p.z, r: 0.33 }));
  }

  /**
   * La gente, cada fotograma: los que pasean avanzan por su tramo y dan media vuelta al final o si tienen a alguien
   * delante (a Azul y a Gas también); los demás, de pie, gesticulando. Su círculo de choque va con ellos.
   */
  private updateFolk(dt: number) {
    const pp = this.player.root.position, g = this.gas.root.position;
    for (const c of this.crowds) {
      c.base.forEach((b, i) => {
        if (b.walk && b !== this.talkTo) {
          const w = b.walk;
          const cur = w.ax === 'x' ? b.x : b.z;
          let nx = cur + w.dir * FOLK_SPEED * dt;
          const px = w.ax === 'x' ? nx : b.x, pz = w.ax === 'x' ? b.z : nx;
          const ahead = (o: { x: number; z: number }) => {
            const ox = o.x - b.x, oz = o.z - b.z;
            const a = (w.ax === 'x' ? ox : oz) * w.dir, side = Math.abs(w.ax === 'x' ? oz : ox);
            return a > 0.05 && a < 0.95 && side < 0.6;
          };
          let blocked = ahead(pp) || ahead(g);
          if (!blocked) for (const o of this.people) if (o !== this.people[b.pi] && Math.hypot(o.x - px, o.z - pz) < 0.62 && ahead(o)) { blocked = true; break; }
          b.turnT = Math.max(0, (b.turnT ?? 0) - dt);
          if (blocked) {
            nx = cur;
            if (b.turnT <= 0) {
              w.dir = (-w.dir) as 1 | -1;
              b.turnT = 1.3;
            }
          }
          if (nx > w.a1 || nx < w.a0) {
            w.dir = (-w.dir) as 1 | -1;
            nx = THREE.MathUtils.clamp(nx, w.a0, w.a1);
          }
          if (w.ax === 'x') b.x = nx;
          else b.z = nx;
          const want = w.ax === 'x' ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : w.dir > 0 ? 0 : Math.PI;
          b.ry += Math.atan2(Math.sin(want - b.ry), Math.cos(want - b.ry)) * Math.min(1, dt * 5);
          const pc = this.people[b.pi];
          if (pc) {
            pc.x = b.x;
            pc.z = b.z;
          }
          this.pose.sway = this.pose.twist = this.pose.shift = 0;
        } else crowdPose(this.pose, this.t, b.ph, this.cheer);
        this.tmpQ.setFromAxisAngle(this.up, b.ry);
        c.people.set(i, b.x, b.z, this.tmpQ, this.pose, bornHeight(b.x, b.z));
      });
      c.people.commit();
    }
  }

  /** La persona de la gente más cercana (a menos de 1,6 m), si hay. */
  private nearestFolk(pp: THREE.Vector3) {
    let best: { b: Folk; female: boolean } | null = null;
    let bd = 1.6;
    for (const c of this.crowds)
      for (const b of c.base) {
        const d = Math.hypot(b.x - pp.x, b.z - pp.z);
        if (d < bd) {
          bd = d;
          best = { b, female: c.female };
        }
      }
    return best;
  }

  /**
   * Hablar con alguien de la gente: se para, se gira hacia ella y dice algo. Uno de cada dos sabe lo que toca y te
   * lo cuenta a su manera (lo que tiene que ir descubriendo, poco a poco); los demás hablan de la fiesta.
   */
  private chatWith(w: { b: Folk; female: boolean }) {
    const pp = this.player.root.position;
    w.b.ry = Math.atan2(pp.x - w.b.x, pp.z - w.b.z);
    let who = this.folkInfo.get(w.b);
    if (!who) {
      const names = w.female ? ['Xisca', 'Aina', 'Joana', 'Marta', 'Neus', 'Bel', 'Laia', 'Cati'] : ['Biel', 'Toni', 'Pere', 'Llorenç', 'Joan', 'Xavi', 'Miquel', 'Jaume'];
      who = { name: names[Math.floor(Math.random() * names.length)], hint: this.folkInfo.size % 2 === 0, talk: this.folkNext++ % SANTJOAN_CHATTER.length, times: 0 };
      this.folkInfo.set(w.b, who);
    }
    const pool = SANTJOAN_HINTS[this.phase];
    let lines: Line[];
    if (who.hint && pool) lines = [{ who: who.name, text: pool[who.times % pool.length] }];
    else if (who.times > 0) lines = [{ who: who.name, text: SANTJOAN_BYE[(who.talk + who.times) % SANTJOAN_BYE.length] }];
    else lines = SANTJOAN_CHATTER[who.talk].map((l) => ({ who: l.who === '*' ? who!.name : l.who, text: l.text }));
    who.times++;
    this.talkTo = w.b;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    // Se gira hacia quien le habla y la cámara mira por encima de su hombro (se le ve, y su globo encima)
    const yaw = Math.atan2(w.b.x - pp.x, w.b.z - pp.z);
    this.walker.facing = yaw;
    this.player.root.rotation.y = yaw;
    this.walker.yaw = yaw - 0.4;
    dialogue(lines, () => {
      this.busy = false;
      this.talkTo = null;
    });
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
    this.map.style.display = 'none'; // (el minimapa, quitado: Marc no lo quiere en este capítulo)
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
        // (21 nov) Como en el faro: ella misma dice qué foto hay que hacer
        later(() => this.phase === 'exact' && bark('Margaux', SANTJOAN.exactPhoto.ask), 600);
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
    if (!this.obeliskInShot()) {
      audio.pop();
      vibrate(25);
      fadeFlash(() => {}, 120);
      this.misses++;
      const r = SANTJOAN.notExact;
      later(() => bark('Gas', r[(this.misses - 1) % r.length]), 700);
      return;
    }
    // (21 nov) Con el visor del móvil, como la foto del faro: que el obelisco salga dentro del marco
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    const v = new THREE.Vector3();
    viewfinder(
      {
        title: SANTJOAN.exactPhoto.title,
        sway: Math.max(0.55, 1 - this.misses * 0.2),
        target: () => {
          v.set(0, 6, 0).project(this.camera);
          if (v.z > 1) return null;
          return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
        },
      },
      (q) => {
        if (this.phase !== 'exact') return;
        audio.pop();
        vibrate(25);
        if (q <= 0) {
          this.misses++;
          this.busy = false;
          bark('Margaux', SANTJOAN.exactPhoto.bad);
          return;
        }
        comicWord('¡CLIC!', 'perfect');
        const ex = CHATS.dimeExacto;
        later(() => phoneChat({ ...ex, msgs: ex.msgs.slice(-1) }, () => this.sendLocation()), 500);
      },
    );
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
    // (alineado a la derecha, dentro del mapa: antes se cortaba la «a» final)
    c.textAlign = 'right';
    c.fillText('Pl. Espanya', W - 4, sz(-8));
    c.textAlign = 'left';
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
    h.setCounters(this.phase === 'nuts' ? `<span class="chip">🌰 ${this.nuts?.hits ?? 0}/${NUTS_NEED}</span>${livesChip('🤕', FAIL.peltMax - (this.nuts?.pelted ?? 0), FAIL.peltMax)}` : this.phase === 'be' ? `<span class="chip">${SANTJOAN.beCount(this.beTouched, BE_NEED)}</span>` : this.phase === 'home' || this.phase === 'taxi' || this.phase === 'ride' ? '' : ''); // (las avellanes y los toques sueltos son opcionales: al resumen)
    // Objetivos mínimos: un emoji o dos palabras, sin decir qué hacer
    if (this.phase === 'nuts') h.setObjective(SIDE.nuts.hint);
    else if (this.phase === 'cross') h.setObjective(SANTJOAN.cross.hint);
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
    // (buscando Correus, ni flecha ni luz: lo que toca te lo dice la gente)
    if (this.phase === 'hunt') return null;
    if (this.phase === 'coming') return this.gas.root.position;
    if (this.phase === 'exact') return this.v2.set(0, 0, 0);
    if (this.phase === 'be' && !this.beIn) return BE;
    if (this.phase === 'nuts' && this.nuts) {
      const near = this.nuts.nearest();
      return near.dist > 13 ? near.at : null;
    }
    if (this.phase === 'taxi') return TAXI_DOOR;
    if (this.phase === 'cross') return CROSS_GOAL;
    return null;
  }

  update(dt: number) {
    this.t += dt;
    // (el botón fijo: 📷 en la foto exacta, 🌰 con las avellanes; si no, ✋)
    this.hud.setIcon(this.phase === 'exact' ? '📷' : this.phase === 'nuts' ? '🌰' : '✋');
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
    this.updateFolk(dt);
    if (this.cross) this.updateCross(dt);
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
    const walking = !this.busy && (this.phase === 'hunt' || this.phase === 'exact' || this.phase === 'coming' || this.phase === 'nuts' || this.phase === 'cross' || this.phase === 'be' || this.phase === 'taxi');
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
      } else if (this.phase === 'cross' && this.cross) {
        const moving = this.cross.hands.step(dt, this.walker.facing, this.colliders);
        animatePerson(this.gas, dt, moving ? 'walk' : 'idle', moving ? 0.7 : 0);
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

    if (this.nuts && this.nuts.pelted >= FAIL.peltMax && !this.busy) {
      // Demasiadas avellanas en la cabeza: otra vez
      this.busy = true;
      this.walker.stop();
      failCard(FAIL.nuts.title, FAIL.nuts.text, () => {
        this.busy = false;
        this.debug().find((d) => d.label.startsWith('4b ·'))?.run();
      });
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
    // Con cualquiera de la gente: una charla (y, a veces, lo que toca)
    if (!label && walking && !pushing && !resting) {
      const who = this.nearestFolk(pp);
      if (who) {
        label = '💬 Hablar';
        action = () => this.chatWith(who);
      }
    }
    this.hud.setAction(label, !!label && (this.phase !== 'exact' || this.obeliskInShot()));
    if (this.input.consumeAction() && action) action();

    // Pistas, solo si se ha perdido: la flecha, la columna de luz y el pin salen a los 40 s sin avanzar
    const key = `${this.phase}|${this.pinOn}|${this.misses}|${this.beIn}|${this.beTouched}|${this.nuts?.hits ?? 0}|${this.restDone}|${this.bagCount}`;
    const lostNow = this.lost.tick(key, dt, this.busy);
    const tgt = lostNow ? this.target() : null;
    // (el pin rojo flotante sobre Correus, quitado: demasiada pista. A Correus se llega preguntando a la gente)
    this.pinObj.visible = false;
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
      // De perfil (antes, en diagonal: a veces quedaba a la espalda de Gas y a ella no se la veía), del lado que deja
      // el obelisco (en el centro del Born) detrás de ellos
      const g = this.gas.root.position;
      const mid = this.v1.copy(pp).lerp(g, 0.5);
      const ax = g.x - pp.x, az = g.z - pp.z, al = Math.hypot(ax, az) || 1;
      let nx = -az / al, nz = ax / al;
      if (nx * mid.x + nz * mid.z < 0) (nx = -nx), (nz = -nz);
      this.camera.position.lerp(this.v2.set(mid.x + nx * 4.4, 2.0, mid.z + nz * 4.4), 1 - Math.exp(-dt * 2));
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
      dialogue(SANTJOAN.toBe, () => this.startCross());
    }, { street: { box: NUT_BOX, ground: bornHeight } });
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
  /**
   * Antes de Es Bè: cruzar la calle del Born hasta Ses Voltes, de la mano de Gas, sin que os arrolle un caballo. Los
   * caballos, con sus caixers, dan la vuelta a la explanada por la calzada al trote (nadie aparece ni desaparece de
   * golpe); si uno os arrolla, a empezar desde la explanada.
   */
  private startCross() {
    this.phase = 'cross';
    this.gas.root.visible = true;
    const cars: NonNullable<typeof this.cross>['cars'] = [];
    // (21 nov: más difícil) Más caballos, más rápidos y sin un ritmo fijo: a ratos alguno se arranca
    const N = 8;
    for (let i = 0; i < N; i++) {
      const d = makeHorse();
      d.root.userData.comicBent = true;
      markAccessories(d.root);
      this.scene.add(d.root);
      cars.push({ d, s: (i / N) * RING_LEN + Math.random() * 3, v: 4.1 + Math.random() * 1.6, walk: Math.random() * 6, surge: 0 });
    }
    const hands = new HandPair(this.player, this.gas);
    hands.start(this.walker.facing);
    this.cross = { cars, hands, hitT: 0 };
    this.updateCross(0);
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.updateHud();
    dialogue(SANTJOAN.cross.intro, () => {
      this.busy = false;
      this.lost.reset();
    });
  }

  private updateCross(dt: number) {
    const cr = this.cross!;
    const pp = this.player.root.position, g = this.gas.root.position;
    cr.hitT -= dt;
    for (const c of cr.cars) {
      // Al trote, sin parar: hay que mirar antes de cruzar
      const r = c.d.root;
      // De vez en cuando se arranca un poco más rápido unos segundos
      if (c.surge > 0) c.surge -= dt;
      else if (Math.random() < dt * 0.18) c.surge = 1.2 + Math.random() * 1.2;
      const v = c.v * (c.surge > 0 ? 1.45 : 1);
      c.s += v * dt;
      const h = ringAt(c.s, r.position);
      r.rotation.y = h;
      r.position.y = bornHeight(r.position.x, r.position.z);
      // Las patas, al paso de la velocidad (como los del corro): no patinan
      c.walk += v * dt * 4.4;
      const w = Math.sin(c.walk) * 0.55;
      c.d.legs[0].rotation.x = c.d.legs[3].rotation.x = w;
      c.d.legs[1].rotation.x = c.d.legs[2].rotation.x = -w;
      c.d.pivot.rotation.x = Math.sin(c.walk * 2) * 0.025;
      c.d.head.rotation.x = Math.sin(c.walk * 2 + 0.6) * 0.08;
      if (this.phase !== 'cross' || this.busy || cr.hitT > 0) continue;
      // ¿Os arrolla? (en el sistema del caballo: medio metro a cada lado y 1,4 m delante y detrás)
      const sin = Math.sin(h), cos = Math.cos(h);
      for (const q of [pp, g]) {
        const dx = q.x - r.position.x, dz = q.z - r.position.z;
        const fwd = dx * sin + dz * cos, side = dx * cos - dz * sin;
        if (Math.abs(fwd) < 1.75 && Math.abs(side) < 0.85) {
          this.crossHit();
          break;
        }
      }
    }
    // Al otro lado: hacia Es Bè
    if (this.phase === 'cross' && !this.busy && pp.x > 18.3 && Math.abs(pp.z) < 4.2) this.crossDone();
  }

  private crossHit() {
    const cr = this.cross!;
    cr.hitT = 2.5;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.walker.shake(0.35);
    audio.hit();
    vibrate([40, 30, 60]);
    bark('Un caixer', SANTJOAN.cross.hit[Math.floor(Math.random() * SANTJOAN.cross.hit.length)]);
    later(() => {
      if (this.phase !== 'cross') return;
      fadeFlash(() => {
        // De vuelta a la explanada, al borde, delante del paso
        this.player.root.position.set(10.6, 0, 1.2);
        this.walker.yaw = this.walker.facing = Math.PI / 2;
        cr.hands.snap(Math.PI / 2);
        this.busy = false;
      }, 250);
    }, 700);
  }

  private crossDone() {
    const cr = this.cross!;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    audio.luck();
    bark('Gas', SANTJOAN.cross.ok);
    later(() => {
      for (const c of cr.cars) c.d.root.removeFromParent();
      cr.hands.stop();
      this.cross = null;
      this.startBe();
    }, 1400);
  }

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
      const taxi = makeTaxi({ front: AZUL_SANTJOAN });
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
    this.walker.speed = WALK_SPEED;
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
      // La escalera se sube (antes era un bloque): desde el patio solo se entra por abajo, por el primer peldaño
      const si = colliders.findIndex((c) => c.minX === 1.7 && c.maxX === 5 && c.minZ === 0 && c.maxZ === 1.1);
      if (si >= 0) colliders.splice(si, 1, { minX: 2.1, maxX: 5, minZ: 0, maxZ: 1.1 }, { minX: 1.7, maxX: 2.1, minZ: 0, maxZ: 0.45 });
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
      // (los dos con la ropa de Sant Joan, como en la fiesta: antes, en el taxi, con la de diario)
      const taxi = makeTaxi({ front: AZUL_SANTJOAN, back: GAS_SANTJOAN });
      taxi.azul.visible = true;
      taxiFree(taxi, false);
      taxi.root.rotation.y = -Math.PI / 2;
      taxi.root.position.set(HOME_STOP_X + HOME_BRAKE, 0, STREET_Z + 0.6);
      sc.add(taxi.root);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xffd23f, fog: false }));
      marker.position.set(1.5, 2.4, 1.2);
      marker.visible = false;
      sc.add(marker);
      this.home = {
        scene: sc, sky, sun, colliders, gate: place.gate, door: place.door, beam: place.beam, who: [], marker, taxi, rig: new CarRig(taxi),
        stage: 'arrive', v: HOME_V0, outT: 0, leaveT: 0, homeLine: false, unlocked: false,
        upDoor: place.upDoor, climb: null, herPath: [], hisPath: [], up: false, porchSaid: false,
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
    if (h.climb !== null) this.stepClimb(dt);
    else if (onFoot && h.up) {
      // Arriba, en la terraza: hasta la puerta (la barandilla delante, la fachada detrás)
      if (this.pair) this.walker.speed = this.pair.speed();
      this.walker.yaw = Math.PI;
      const mag = this.walker.move(dt, free ? this.input.axes() : { x: 0, y: 0 }, [], TERRACE);
      pp.y = TERRACE_Y;
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);
      if (this.pair) {
        const moving = this.pair.step(dt, this.walker.facing, []);
        // (él, en la terraza o aún en el rellano de la escalera)
        const g = this.gas.root.position;
        g.x = THREE.MathUtils.clamp(g.x, TERRACE.minX - 0.05, TERRACE.maxX + 0.1);
        g.z = THREE.MathUtils.clamp(g.z, TERRACE.minZ - 0.05, g.x > 4.62 ? 0.95 : TERRACE.maxZ + 0.1);
        g.y = stairY(g.x, g.z);
        animatePerson(this.gas, dt, moving ? 'walk' : 'idle', 0.32);
        this.pair.pose();
      }
      h.who.push(this.gas.root.position);
    } else if (onFoot) {
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
      // Al pie de la escalera: suben juntos, ella delante y él detrás, agarrado a la barandilla
      if (free && pp.x > 1.25 && pp.x < 2.15 && pp.z < 1.25) this.startClimb();
      // El porche no es la entrada (la puerta de verdad está arriba): ella misma lo dice, una vez
      if (free && !h.porchSaid && Math.hypot(pp.x - DOOR.x, pp.z - DOOR.z) < 1.5) {
        h.porchSaid = true;
        bark('Margaux', SANTJOAN.porch);
      }
    }
    // La cancela se abre al llegar; la puerta de casa, solo con la llave (la de abajo, la del porche, nunca)
    h.gate.update(dt, h.who, this.camera.position);
    h.door.update(dt, [], this.camera.position);
    h.upDoor.update(dt, h.unlocked ? h.who : [], this.camera.position);
    const near = h.up && h.climb === null && Math.hypot(pp.x - UP_DOOR.x, pp.z - UP_DOOR.z) < 1.25;
    let label: string | null = null;
    if (free && near) label = h.unlocked ? SANTJOAN.sleepBtn : SANTJOAN.keysBtn;
    this.hud.setAction(label, !!label);
    if (this.input.consumeAction() && label) {
      if (h.unlocked) this.finish();
      else this.unlock();
    }
    // Pistas, solo si se ha perdido
    const lostNow = this.lost.tick(`home|${h.stage}|${h.unlocked}`, dt, this.busy);
    const show = lostNow && free && !near && h.climb === null;
    h.marker.visible = false; // (21 nov: sin flechas que señalen; lo va descubriendo ella)
    h.marker.rotation.y += dt * 2;
    if (show) {
      // (abajo, el pie de la escalera; arriba, la puerta)
      const goal = h.up ? UP_DOOR : this.v2.set(1.6, 0, 0.9);
      h.marker.position.set(goal.x, goal.y + 2.4, goal.z + (h.up ? 0.5 : 0));
      const ang = Math.atan2(goal.x - pp.x, goal.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(-rel);
      beacon.at(goal);
    } else {
      this.hud.setArrow(null);
      beacon.at(null);
    }
    if (h.stage !== 'gone' && this.busy) this.homeCamera(1 - Math.exp(-dt * 2));
    else if (h.climb !== null || h.up) {
      // En la escalera y arriba, plano propio: la buganvilla de la pérgola y el cuerpo volado tapaban a la cámara
      // de siempre. Subiendo, desde atrás y por encima del porche; en la terraza, desde encima del patio.
      const k = 1 - Math.exp(-dt * 3);
      if (h.climb !== null) {
        this.camera.position.lerp(this.v1.set(pp.x - 1.5, pp.y + 3.4, 2.0), k);
        this.homeLook.lerp(this.v2.set(pp.x + 0.6, pp.y + 0.9, 0.7), k);
      } else {
        this.camera.position.lerp(this.v1.set(pp.x + 0.2, TERRACE_Y + 2.7, pp.z + 3.4), k);
        this.homeLook.lerp(this.v2.set(pp.x - 0.1, TERRACE_Y + 1.0, pp.z - 0.9), k);
      }
      this.camera.lookAt(this.homeLook);
    } else this.walker.camera(this.camera, dt, h.colliders, 6, pp.z < 10.4 && pp.z > -0.5 && Math.abs(pp.x) < 5.4 ? 2.3 : 3.4);
    h.sun.follow(pp);
    h.sky.update(this.camera, dt);
  }

  /** Al pie de la escalera: a partir de aquí suben solos, a su paso (ella delante; él, detrás y cojeando). */
  private startClimb() {
    const h = this.home!;
    h.climb = 0;
    const pp = this.player.root.position, g = this.gas.root.position;
    h.herPath = [[pp.x, pp.z], ...STAIR_PATH];
    this.homeLook.set(pp.x + 0.6, 0.9, 0.7);
    h.hisPath = [[g.x, g.z], ...h.herPath];
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    h.marker.visible = false;
  }

  private stepClimb(dt: number) {
    const h = this.home!;
    const pp = this.player.root.position, g = this.gas.root.position;
    // A tirones, como en la calle: cada peldaño con el pie bueno
    const pace = 0.55 + 0.45 * Math.max(0, Math.sin(this.gas.auto?.ph ?? this.t * 5));
    h.climb! += dt * pace;
    const d = h.climb!;
    const herLen = pathLen(h.herPath);
    // Él va 1 m por detrás de ella, por el mismo camino (y espera donde está hasta que ella le saca ese metro)
    const dg = d + Math.hypot(h.hisPath[0][0] - h.herPath[0][0], h.hisPath[0][1] - h.herPath[0][1]) - 1.05;
    const hisLen = pathLen(h.hisPath);
    const fa = stairAt(h.herPath, d, pp);
    const fg = dg > 0 ? stairAt(h.hisPath, dg, g) : this.gas.root.rotation.y;
    const turn = (r: THREE.Object3D, to: number) => (r.rotation.y += Math.atan2(Math.sin(to - r.rotation.y), Math.cos(to - r.rotation.y)) * Math.min(1, dt * 8));
    turn(this.player.root, fa);
    turn(this.gas.root, fg);
    this.walker.facing = this.player.root.rotation.y;
    this.walker.yaw += Math.atan2(Math.sin(fa - this.walker.yaw), Math.cos(fa - this.walker.yaw)) * Math.min(1, dt * 1.6);
    const hisEnd = hisLen - 1.05;
    const hisMoving = dg > 0 && dg < hisEnd;
    if (dg > hisEnd) stairAt(h.hisPath, hisEnd, g);
    animatePerson(this.player, dt, d < herLen ? 'walk' : 'idle', 0.45);
    animatePerson(this.gas, dt, hisMoving ? 'walk' : 'idle', 0.32);
    limpPose(this.gas, hisMoving);
    if (dg >= hisEnd) {
      // Arriba los dos: él se le vuelve a poner al lado (desde el rellano), y a la puerta
      h.climb = null;
      h.up = true;
      this.walker.yaw = this.walker.facing = this.player.root.rotation.y;
      this.lost.reset();
      this.busy = false;
    }
  }

  /** Paso nuevo (inventado): la llave, despacito, que duerme todo el mundo. */
  private unlock() {
    const h = this.home!;
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    const pp = this.player.root.position;
    this.walker.facing = Math.atan2(UP_DOOR.x - pp.x, UP_DOOR.z - pp.z);
    bark('Margaux', SANTJOAN.keys);
    // Las llaves: dos tintineos y la cerradura, flojito
    audio.knock(0.08, 2600, 0.025);
    later(() => audio.knock(0.08, 3000, 0.025), 260);
    later(() => {
      if (this.home !== h) return;
      audio.knock(0.14, 900, 0.05);
      h.unlocked = true;
      h.upDoor.hold(3);
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
    if (who === 'Un caixer' && this.cross) {
      // Cruzando: el caixer del caballo de la calzada más cercano
      let best: Donkey | null = null, bd = 1e9;
      for (const c of this.cross.cars) {
        const d = c.d.root.position.distanceTo(pp);
        if (d < bd) {
          bd = d;
          best = c.d;
        }
      }
      if (best) {
        best.pivot.updateWorldMatrix(true, false);
        return best.pivot.localToWorld(this.v3.set(0, 2.85, 0.7));
      }
    }
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
    // Con quien se está hablando de la gente: su cabeza
    if (this.talkTo && !['Margaux', 'Azul', 'Gas', 'Marc'].includes(who)) return this.v3.set(this.talkTo.x, bornHeight(this.talkTo.x, this.talkTo.z) + 2.0, this.talkTo.z);
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
    if (this.cross) {
      for (const c of this.cross.cars) c.d.root.removeFromParent();
      this.cross.hands.stop();
      this.cross = null;
    }
    this.pair?.stop();
    this.pair = null;
    this.endPush();
    this.setNight(night);
    this.showPlazaTaxi(night);
    this.player.root.visible = true;
    this.gas.root.visible = false;
    this.walker.speed = WALK_SPEED;
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
      { label: '3 · Foto exacta', run: () => { this.resetTo(false); this.phase = 'exact'; this.updateHud(); tp(5, -9.5, Math.PI); } },
      { label: '3b · Gas viene (después de la foto)', run: () => { this.resetTo(false); tp(5, -9.5, Math.PI); this.sendLocation(); } },
      { label: '4 · Se encuentran', run: () => { this.resetTo(false); tp(1, 4.5); gasAt(2, 5.5); this.meet(); } },
      { label: '4b · Avellanes', run: () => { this.resetTo(false); tp(4, -9, Math.PI); gasAt(5, -8); this.startNuts(); } },
      { label: '4c · Cruzar la calle (de la mano)', run: () => { this.resetTo(false); tp(10.6, 1.2, Math.PI / 2); gasAt(10.6, 0.6); this.startCross(); } },
      { label: '5 · Sa Plaça d’es Bè', run: () => { this.resetTo(false); tp(88, 0, Math.PI / 2); gasAt(86.5, 0.8); this.startBe(); } },
      { label: '5b · Al taxi, de noche', run: () => { this.resetTo(false); tp(100, 0, -Math.PI / 2); gasAt(100.5, 0.4); this.startTaxi(); } },
      { label: '5c · Al taxi: la parada de Gas', run: () => { this.resetTo(false); tp(100, 0, -Math.PI / 2); gasAt(100.5, 0.4); this.startTaxi(); later(() => { this.taxiFrom = 99; }, 900); } },
      { label: '5d · En el taxi', run: () => { this.resetTo(true); tp(80, 7, -Math.PI / 2); this.busy = true; fadeFlash(() => this.startRide(), 200); } },
      { label: '6 · Casa: llega el taxi', run: () => { this.resetTo(true); this.busy = true; this.startHome(); } },
      { label: '6b · Casa: hasta la puerta', run: () => { this.resetTo(true); this.busy = true; this.startHome(() => this.skipArrival()); } },
      { label: '6c · Casa: la escalera', run: () => { this.resetTo(true); this.busy = true; this.startHome(() => this.skipArrival(1.2, 2.2)); } },
      { label: '6d · Casa: arriba, la puerta con la llave', run: () => { this.resetTo(true); this.busy = true; this.startHome(() => { this.skipArrival(3.4, -0.3); this.home!.up = true; this.player.root.position.y = this.gas.root.position.y = TERRACE_Y; }); } },
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
