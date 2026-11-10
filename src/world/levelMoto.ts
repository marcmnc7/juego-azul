import { StoneSkip } from './sideGames';
import * as THREE from 'three';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Sky, Sun, toon, vibrate, makeSea, paintMat } from '../core/gfx';
import { comicFlash } from '../core/comic';
import { setSurface, Surf } from '../core/surfaces';
import { Lost } from '../core/lost';
import { MOTO } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makeMoto, makeCar, makePerson, type Person, type PersonLook } from '../entities/models';
import { canvasTex } from './deco';
import { ROOF_GEO } from './ferreries';
import { menorcaWindow, LOUVRE_GREEN, LOUVRE_BLUE } from './menorcaHouse';
import { boneAnchor, boneLevel, leanTorso, rigPost } from '../entities/rig';
import { twoBone } from '../entities/embrace';
import { makeHelmet } from '../entities/helmet';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, phoneChat, fadeFlash, Hud, DebugItem, later, bark, comicWord, timingGauge } from '../ui/ui';
import { packBag } from '../ui/minis';
import { disposeScene, type Level, type LevelDone } from './level';

// Capítulo 5 · MotoTrip4life (Costa Brava, 30 de abril – 4 de mayo de 2026).
// Bucle: el plan (chat) → la mochila con la lista real de Gas → el sábado, de paquete por la carretera de la costa
// de L'Escala hacia Cap de Creus: Gas conduce y tú acompañas las curvas inclinándote con él, saludas a las motos
// que vienen de frente (a los coches no), en los tres miradores Gas frena y sacas la foto, y la tramontana empuja
// → el último tramo hasta el faro está cortado: Gas para con el pie en el suelo, la foto del faro, media vuelta
// y al apartadero del Camí de Ronda → la cala de las ranas → cena y helado → el chat del lunes al devolver la moto.
//
// La carretera es como las de verdad de allí (GI-614): dos carriles de 3 m con arcén de medio metro, líneas de
// borde, la del centro discontinua en las rectas y continua en las curvas (con su aviso antes), bionda del lado
// del mar, apartaderos de mirador con su pretil de piedra y señales de verdad (límite, curva, mirador, parque).

type Phase = 'intro' | 'pack' | 'ride' | 'creus' | 'uturn' | 'back' | 'cala' | 'done';

/** Velocidad de crucero (50 km/h, la de la señal) y cómo se cambia de velocidad. */
const SPEED = 14;
/** Ya en marcha al empezar (arrancar desde parado se hacía eterno), y acelera fuerte a su velocidad. */
const START_V = 4;
const ACCEL = 4.5;
/** Frenada que planea Gas (cómoda, con paquete) y la más fuerte que llega a hacer. */
const BRAKE = 3.2;
const BRAKE_MAX = 5;
/** Aceleración lateral cómoda en curva: en las cerradas frena. */
const LAT_G = 3.6;
/** En los miradores, despacio para que dé tiempo a la foto. */
const PHOTO_V = 6.5;
/** Medio ancho del asfalto: carril de 3 m y arcén de 0,6. La línea de borde, de 3,0 a 3,12. */
const HALF = 3.6;
const EDGE = 3.0;
/** La moto va por el centro de su carril; para delante de la valla, arrimada al borde (para dar la vuelta). */
const OFF_RIDE = 1.5;
const OFF_STOP = 2.8;
/** Al volver, por el otro carril (hasta el apartadero). */
const OFF_BACK = -1.9;
const SAMPLES = 420;
const PHOTO_AT = [0.27, 0.5, 0.8];
const PHOTO_WIN = 0.035;
/** Donde la carretera está cortada: el último tramo hasta el faro estaba cerrado. */
const CLOSED_AT = 0.95;
/** Gas para a estos metros de la valla. */
const STOP_GAP = 7;
/** El apartadero de donde baja el Camí de Ronda a la cala. */
const CALA_AT = 0.9;
/** Apartaderos: medio largo (con 4 m de cuña a cada lado) y cuánto se abren hacia el mar. */
const BAY_HALF = 13;
const BAY_W = 3.4;
/** Dónde sopla la tramontana. */
const WIND_AT = 0.58;
const WIND_SECS = 11;
// Lo que viene de frente por el otro carril (dónde os cruzáis): a las motos se las saluda, a los coches no.
// (nada después de 0,78: lo de más allá saldría de detrás de la valla)
const ONCOMING: [number, 'moto' | 'car'][] = [[0.16, 'moto'], [0.22, 'car'], [0.36, 'moto'], [0.41, 'car'], [0.44, 'moto'], [0.63, 'car'], [0.7, 'moto'], [0.76, 'moto']];
const ONCOMING_V = 12;
/** Salen a esta distancia (lejos, ya casi en la niebla). */
const SPAWN_AHEAD = 120;
const RIDERS: PersonLook[] = [
  { skin: 0xe2b08c, shirt: 0x1b1b22, pants: 0x2a3550, hair: 0x2b1d14, hairStyle: 'short', male: true },
  { skin: 0xf0c8a6, shirt: 0x8a2a2a, pants: 0x1b1b22, hair: 0x6a4a2a, hairStyle: 'short', male: true },
];
const DRIVERS: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x5a3a22, hairStyle: 'short', male: true },
  { skin: 0xf0c8a6, shirt: 0x2e86ab, pants: 0x222222, hair: 0xb07a3a, hairStyle: 'long' },
];
/**
 * Con el conjunto de moto de la lista (tejanos y chupa): la chupa, oscura. (El color es inventado; el modelo no
 * tiene chaqueta, solo cambia el color de arriba.)
 */
export const AZUL_MOTO: PersonLook = { ...MARGAUX_LOOK, shirt: 0x2a2624 };
export const GAS_MOTO: PersonLook = { ...MARC_LOOK, shirt: 0x24201e };

// Colores con su dibujo de superficie
const ASPHALT = 0x4a4a50;
const LINE = 0xe8e2d0;
const RAIL = 0xb4b7bc; // bionda galvanizada
const RAIL_POST = 0x8d9096;
const PARAPET = 0x8f877a; // pretil de piedra seca de los miradores
const PATH_STONE = 0x8a7a68;
const SIGN_POST = 0x9a9ea2;
const FENCE = 0x9a9ea4;
const FENCE_BAR = 0xb8bcc2;
const LANTERN = 0xbfe4f0;
const LANTERN_TOP = 0x2f2f36;
setSurface(FENCE, Surf.Metal);
setSurface(FENCE_BAR, Surf.Metal);
setSurface(LANTERN, Surf.Glass);
setSurface(LANTERN_TOP, Surf.Metal);
setSurface(0x3a3a3e, Surf.Metal); // pies de la valla de obra

const INK = '#2b2233';
const FONT = 'Fredoka, "Arial Narrow", Arial, sans-serif';
const barkTime = (text: string) => (2100 + Math.min(2400, text.length * 55)) / 1000;
const isGas = (who: string) => /^(Gas|Marc)$/.test(who);
const isAzul = (who: string) => /^(Azul|Margaux)$/.test(who);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface Oncoming {
  kind: 'moto' | 'car';
  root: THREE.Object3D;
  wheels: THREE.Object3D[];
  rider: Person | null;
  s: number;
  live: boolean;
  /** Ya le has saludado (o lo has intentado, si era un coche). */
  greeted: boolean;
  passed: boolean;
  /** El de la moto de enfrente saluda: segundos que le quedan con la mano fuera. */
  waveT: number;
  waved: boolean;
  k: number;
}

// Carretera de la costa: el mar queda a la derecha de la moto
const PTS: [number, number][] = [
  [0, -20], [0, 0], [6, 60], [-10, 120], [4, 185], [28, 240], [20, 300], [-6, 350], [-4, 420], [22, 480], [40, 540], [30, 600], [10, 650], [18, 720], [40, 770], [52, 800],
];

export class LevelMoto implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private sky: Sky;
  private sun: Sun;
  private phase: Phase = 'intro';
  private curve: THREE.CatmullRomCurve3;
  private len: number;
  /** Curvatura de la carretera metro a metro (rad/m; + a la izquierda). */
  private kap: Float32Array = new Float32Array(1);
  private moto = makeMoto(0xb02a2a, GAS_MOTO);
  private azul: Person;
  /** Posición en la ruta (0 a 1), sentido (1 hacia el faro, -1 de vuelta), desplazamiento lateral (+ hacia el mar). */
  private s = 0.02;
  private dir = 1;
  private off = OFF_RIDE;
  private offV = 0;
  private speed = 0;
  private yaw = 0;
  private yawRate = 0;
  private lean = 0;
  private azulLean = 0;
  private good = 0;
  private total = 0;
  private wobbleT = 0;
  private photos = 0;
  private photoTaken = PHOTO_AT.map(() => false);
  private oncoming: Oncoming[] = [];
  private nextEv = 0;
  private waves = 0;
  private motosMet = 0;
  private wrongWaves = 0;
  private azulWaveT = 0;
  private azulWaveK = 0;
  /** Ella saca el móvil con la mano del lado del mar (las fotos de los miradores y la del faro). */
  private photoT = 0;
  private photoK = 0;
  private phone: THREE.Object3D | null = null;
  /** Gas pone el pie en el suelo al parar (0..1). */
  private footK = 0;
  private lighthouse = new THREE.Vector3();
  private t = 0;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private snapCam = true;
  /** Lo que se dicen por el camino: la siguiente frase y hasta cuándo dura la que está saliendo. */
  private talkI = 0;
  private sayUntil = 0;
  private nagAt = 0;
  private lost = new Lost();
  private lostNag = false;
  /** Parados ante la valla: la foto del faro (lista, abierta, intentos). */
  private faroReady = false;
  private faroOpen = false;
  private faroTries = 0;
  private faroDone = false;
  private cancelGauge: (() => void) | null = null;
  /** La media vuelta: centro, radio, ejes de la carretera y ángulo recorrido. */
  private uC = new THREE.Vector3();
  private uT = new THREE.Vector3();
  private uR = new THREE.Vector3();
  private uRad = 2.35;
  private uOff0 = OFF_STOP;
  private uTh = 0;
  private uCam = new THREE.Vector3();
  private completed = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    // Sábado 2 de mayo por la tarde: sol alto del suroeste, a la espalda yendo hacia el norte (el mismo en la cala)
    sc.fog = new THREE.Fog(0xcfe2ee, 110, 520);
    sc.userData.hemiScale = 0.35; // el reparto de la luz de ambiente del cap. 1
    sc.userData.speedLines = 0; // (las líneas de velocidad, solo al acelerar fuerte: ver update)
    const sunDir = new THREE.Vector3(0.45, 0.75, -0.48).normalize();
    this.sky = new Sky({ top: 0x2a6fd0, mid: 0x7fbdf2, bottom: 0xdcebf4, sun: { color: 0xfff1d0, dir: sunDir, size: 70 }, clouds: { count: 9, tint: 0xffffff } });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xcfe0ff, 0x6a5a40, 1.0));
    this.sun = new Sun(sc, 0xfff0d6, 2.1, sunDir, 24);

    this.curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    this.len = this.curve.getLength();
    this.measureCurves();
    this.buildCoast();
    this.fx = new Particles(sc);

    // Azul de paquete, abrazada a Gas, con casco blanco
    this.azul = makePerson(AZUL_MOTO);
    const a = this.azul;
    a.root.position.set(0, 0.5, -0.88);
    a.legL.rotation.x = a.legR.rotation.x = -1.15;
    a.kneeL.rotation.x = a.kneeR.rotation.x = 1.45;
    a.legL.rotation.z = -0.2;
    a.legR.rotation.z = 0.2;
    a.armL.rotation.x = a.armR.rotation.x = -1.25;
    a.armL.rotation.z = 0.35;
    a.armR.rotation.z = -0.35;
    a.body.rotation.x = 0.2;
    if (a.rig) {
      // Personaje glTF: sentada de verdad (piernas, brazos y cadera mandan las articulaciones),
      // abrazada a la cintura de Gas, y casco blanco pegado a la cabeza
      a.rig.force = { body: 1, legL: 1, legR: 1, armL: 1, armR: 1 };
      a.root.position.set(0, 0.96 - a.rig.hipsHeight, -0.86); // cadera 7 cm sobre el asiento (a 0,86 se hundía en él)
      // Pies en las estriberas de atrás: sin esto la pierna colgaba y el escape se le metía por la pantorrilla
      a.legL.rotation.set(-1.6, 0, -0.48);
      a.legR.rotation.set(-1.6, 0, 0.48);
      a.kneeL.rotation.x = a.kneeR.rotation.x = 2.09;
      a.footL.rotation.x = a.footR.rotation.x = -0.77;
      a.armL.rotation.set(-1.2, 0, 0.55);
      a.armR.rotation.set(-1.2, 0, -0.55);
      a.elbowL.rotation.x = a.elbowR.rotation.x = -0.55;
      a.body.rotation.x = 0.28;
      // Casco integral blanco con la franja azul; algo más grande que el de Gas: le tapa también la melena
      const helmet = makeHelmet({ color: 0xf4f4f4, stripe: 0x3a8fd8 });
      helmet.position.set(0, 0.12, -0.02);
      helmet.scale.set(1.22, 1.22, 1.36);
      helmet.add(intercom());
      boneAnchor(a, 'Head').add(helmet);
      // El intercomunicador también en el casco de Gas (si no, a 50 km/h y con integral no se oirían)
      const gr = this.moto.rider;
      if (gr?.rig) {
        const anc = boneAnchor(gr, 'Head');
        const ic = intercom();
        ic.position.set(0.16, 0.1, 0.02);
        anc.add(ic);
      }
      this.hugGas();
      this.gasFoot();
    } else {
      const helmet = makeHelmet({ color: 0xf4f4f4, stripe: 0x3a8fd8 });
      helmet.position.set(0, 0.3, -0.02);
      helmet.scale.setScalar(2.25);
      a.head.add(helmet);
    }
    this.moto.root.add(a.root);
    this.moto.root.rotation.order = 'YXZ';
    // (se mueve: el cómic no la dobla a mano alzada; la de alta calidad ya lo lleva)
    this.moto.root.userData.comicBent = true;
    sc.add(this.moto.root);
    // En la presentación y la mochila se ve la costa, sin la moto (es Barcelona, la víspera)
    this.moto.root.visible = false;
    this.placeMoto();
    this.buildTraffic();
    this.buildClosure();

    this.hud = hud(() => this.input.queueAction(), onMenu, 'Arrastra a izquierda o derecha para inclinarte con Gas');
    this.hud.setArrow(null);
    this.updateHud();
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(MOTO.intro, () => phoneChat(CHATS.motoPlan, () => dialogue(MOTO.packIntro, () => phoneChat(CHATS.mochila, () => this.startPack()))));
    }, 2300);
    audio.startMusic('road');
  }

  get threeScene() {
    return this.stones ? this.stones.scene : this.scene;
  }

  // ---------------- Construcción ----------------

  /** Punto del eje a m metros de la salida, su tangente y el lado del mar (a la derecha yendo al faro). */
  private frame(m: number) {
    const u = THREE.MathUtils.clamp(m / this.len, 0, 1);
    const p = this.curve.getPointAt(u);
    const t = this.curve.getTangentAt(u);
    return { p, t, r: new THREE.Vector3(-t.z, 0, t.x) };
  }

  private measureCurves() {
    const N = Math.ceil(this.len);
    const yaws = new Float32Array(N + 1);
    const t = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      this.curve.getTangentAt(Math.min(1, i / this.len), t);
      yaws[i] = Math.atan2(t.x, t.z);
    }
    this.kap = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - 3), b = Math.min(N, i + 3);
      this.kap[i] = wrap(yaws[b] - yaws[a]) / Math.max(1, b - a);
    }
  }

  private kapAt(m: number) {
    return this.kap[THREE.MathUtils.clamp(Math.round(m), 0, this.kap.length - 1)];
  }

  /** Metros (del centro) de los apartaderos: los tres miradores y el del Camí de Ronda. */
  private bays() {
    return [...PHOTO_AT.map((u) => ({ m: u * this.len, cala: false })), { m: CALA_AT * this.len, cala: true }];
  }

  private inBay(m: number, pad = 0) {
    return this.bays().some((b) => Math.abs(m - b.m) < BAY_HALF + pad);
  }

  /** Dónde acaba el apartadero (hacia el mar) en el metro m: la cuña de 4 m a cada lado. */
  private bayOuter(m: number, c: number) {
    const x = Math.abs(m - c);
    const k = x < BAY_HALF - 4 ? 1 : THREE.MathUtils.smoothstep(BAY_HALF - x, 0, 4);
    return HALF + BAY_W * k;
  }

  /**
   * Cinta a lo largo de la carretera entre los desplazamientos a y b (+ hacia el mar), de m0 a m1 metros: plana a la
   * altura y0, o con y1 > y0 un prisma (pretil, muro) con sus dos caras.
   */
  private band(a: number | ((m: number) => number), b: number | ((m: number) => number), y0: number, y1: number, m0: number, m1: number, step = 2) {
    const A = typeof a === 'number' ? () => a : a;
    const B = typeof b === 'number' ? () => b : b;
    const pos: number[] = [];
    const tri = (...q: THREE.Vector3[]) => {
      for (const v of q) pos.push(v.x, v.y, v.z);
    };
    const n = Math.max(1, Math.ceil((m1 - m0) / step));
    const top = Math.max(y0, y1);
    let prev: THREE.Vector3[] | null = null;
    for (let i = 0; i <= n; i++) {
      const m = m0 + ((m1 - m0) * i) / n;
      const { p, r } = this.frame(m);
      const pa = p.clone().addScaledVector(r, A(m)), pb = p.clone().addScaledVector(r, B(m));
      const cur = [pa.clone().setY(y0), pb.clone().setY(y0), pa.clone().setY(top), pb.clone().setY(top)];
      if (prev) {
        // [0] a abajo, [1] b abajo, [2] a arriba, [3] b arriba (b, más hacia el mar)
        tri(prev[2], prev[3], cur[3], prev[2], cur[3], cur[2]);
        if (y1 > y0) {
          tri(prev[1], cur[1], cur[3], prev[1], cur[3], prev[3]);
          tri(prev[0], cur[2], cur[0], prev[0], prev[2], cur[2]);
        }
      }
      prev = cur;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  private buildCoast() {
    const sc = this.scene;
    const L = this.len;
    // Perfil transversal (de la montaña al mar): distancia al centro de la carretera, altura y color. La cuneta y el
    // arcén de tierra, aparte de la ladera y del acantilado: cada uno con su dibujo
    const prof: [number, number, number][] = [
      [-70, 16, 0x6f7d45], [-26, 5, 0x7f8c4c], [-9, 0.9, 0x8d9356], [-4.6, 0.06, 0xa89c78], [-HALF, 0.03, 0xa89c78],
      [HALF, 0.03, 0xa89c78], [5.2, -0.06, 0xa89c78], [6.6, -0.7, 0x9a8a6a], [9, -4.5, 0x8a7560], [15, -8, 0x7a6450],
    ];
    const ROAD_J = 4;
    const groupOf = (j: number) => (j <= 2 ? 0 : j === 3 || j === 5 ? 1 : 2);
    const geo = [0, 1, 2].map(() => ({ pos: [] as number[], col: [] as number[] }));
    const c = new THREE.Color();
    // Hacia Cap de Creus el monte se vuelve más seco y gris (pizarra y matorral bajo), sin cambiar de golpe
    const DRY = new THREE.Color(0x8c8a62);
    const SLATE = new THREE.Color(0x6f6a62);
    const wildK = (u: number) => THREE.MathUtils.smoothstep(u, 0.36, 0.58);
    const ringAt = (i: number) => {
      const u = i / SAMPLES;
      const f = this.frame(u * L);
      return { x: f.p.x, z: f.p.z, rx: f.r.x, rz: f.r.z, u };
    };
    let prev = ringAt(0);
    for (let i = 1; i <= SAMPLES; i++) {
      const cur = ringAt(i);
      for (let j = 0; j < prof.length - 1; j++) {
        if (j === ROAD_J) continue; // la carretera va aparte
        const q = (r: typeof cur, k: number) => [r.x + r.rx * prof[k][0], prof[k][1], r.z + r.rz * prof[k][0]];
        const a = q(prev, j), b = q(prev, j + 1), cc = q(cur, j + 1), d = q(cur, j);
        const G0 = geo[groupOf(j)];
        G0.pos.push(...a, ...d, ...b, ...b, ...d, ...cc);
        for (const [k, r] of [[j, prev], [j, cur], [j + 1, prev], [j + 1, prev], [j, cur], [j + 1, cur]] as const) {
          c.set(prof[k][2]);
          const w = wildK(r.u);
          if (k <= 2) c.lerp(DRY, w * 0.55);
          else if (k >= 7) c.lerp(SLATE, w * 0.8);
          G0.col.push(c.r, c.g, c.b);
        }
      }
      prev = cur;
    }
    const mk = (p: number[], cl: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
      g.computeVertexNormals();
      return g;
    };
    const surf = [Surf.Grass, Surf.Sand, Surf.Stone];
    geo.forEach((gg, k) => {
      const mesh = new THREE.Mesh(mk(gg.pos, gg.col), toon({ vertexColors: true, side: THREE.DoubleSide, surf: surf[k] }));
      mesh.userData.noCast = true;
      sc.add(mesh);
    });

    // --- Calzada: el asfalto y los apartaderos en una malla, la pintura en otra a ras (sin grosor: sin dientes) ---
    const asphalt = new Merger();
    asphalt.add(this.band(-HALF, HALF, 0.05, 0.05, 0, L, L / SAMPLES), ASPHALT);
    // (el de los apartaderos, 2 mm por encima: monta sobre el borde de la calzada sin parpadear)
    for (const b of this.bays()) asphalt.add(this.band(HALF - 0.05, (m) => this.bayOuter(m, b.m), 0.052, 0.052, b.m - BAY_HALF, b.m + BAY_HALF, 1), ASPHALT);
    const asphaltMesh = new THREE.Mesh(asphalt.build(), toon({ vertexColors: true }));
    asphaltMesh.userData.noCast = true;
    sc.add(asphaltMesh);

    const paint = new Merger();
    const Y = 0.05;
    // Línea de borde de la montaña, seguida; la del mar, discontinua delante de cada apartadero (se puede entrar)
    paint.add(this.band(-EDGE - 0.12, -EDGE, Y, Y, 0, L, L / SAMPLES), LINE);
    let m0 = 0;
    for (const b of this.bays().sort((x, y) => x.m - y.m)) {
      paint.add(this.band(EDGE, EDGE + 0.12, Y, Y, m0, b.m - BAY_HALF, L / SAMPLES), LINE);
      for (let d = b.m - BAY_HALF; d < b.m + BAY_HALF - 0.5; d += 2) paint.add(this.band(EDGE, EDGE + 0.12, Y, Y, d, d + 1, 1), LINE);
      m0 = b.m + BAY_HALF;
    }
    paint.add(this.band(EDGE, EDGE + 0.12, Y, Y, m0, L, L / SAMPLES), LINE);
    // Línea del centro: continua donde no se ve lo que viene (curvas de menos de ~110 m de radio, con margen),
    // con sus trazos largos de aviso antes, y discontinua en las rectas (2,5 m de trazo y 5,5 de vano, la de ≤ 60 km/h)
    const N = this.kap.length - 1;
    const cont = new Uint8Array(N + 1);
    for (let i = 0; i <= N; i++) {
      let k = 0;
      for (let j = Math.max(0, i - 35); j <= Math.min(N, i + 35); j += 5) k = Math.max(k, Math.abs(this.kap[j]));
      cont[i] = k > 1 / 110 ? 1 : 0;
    }
    const contAt = (m: number) => cont[THREE.MathUtils.clamp(Math.round(m), 0, N)] === 1;
    let m = 2;
    while (m < L - 2) {
      if (contAt(m)) {
        let e = m;
        while (e < L - 2 && contAt(e)) e += 1;
        paint.add(this.band(-0.06, 0.06, Y, Y, m, e, 2), LINE);
        m = e;
        continue;
      }
      let warn = false;
      for (let d = 0; d <= 25 && !warn; d += 2) warn = contAt(m + d);
      const on = warn ? 3.5 : 2.5, gap = warn ? 1.5 : 5.5;
      let e = Math.min(m + on, L - 2);
      while (e > m + 0.5 && contAt(e)) e -= 0.5;
      paint.add(this.band(-0.06, 0.06, Y, Y, m, e, on), LINE);
      m = e + gap;
    }
    const paintMesh = new THREE.Mesh(paint.build(), paintMat(2));
    paintMesh.userData.noCast = true;
    sc.add(paintMesh);

    const sea = makeSea([1400, 1400], 0x14587a, new THREE.Vector3(-0.6, 0.35, 0.7));
    sea.position.set(0, -2.4, 400);
    sc.add(sea);

    // Bionda, bancales, pinos, matas, rocas, las casas de L'Escala al principio y el faro de Cap de Creus al final
    const md = new Merger();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 4; i < SAMPLES - 6; i += 2) {
      const r = ringAt(i);
      const mi = r.u * L;
      // A lo largo de la carretera (antes los quitamiedos y los bancales salían de través)
      const yaw = Math.atan2(r.rz, -r.rx);
      // Bionda del lado del mar: un tramo seguido hasta la muestra siguiente, con su poste (abierta en los apartaderos)
      const r2 = ringAt(i + 2);
      if (!this.inBay(mi, 1) && !this.inBay(r2.u * L, 1)) {
        const ax = r.x + r.rx * 4.6, az = r.z + r.rz * 4.6, bx = r2.x + r2.rx * 4.6, bz = r2.z + r2.rz * 4.6;
        md.add(G.box, RAIL_POST, ax, 0.35, az, 0, yaw, 0, 0.08, 0.7, 0.08);
        md.add(G.box, RAIL, (ax + bx) / 2, 0.6, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0, 0.05, 0.22, Math.hypot(bx - ax, bz - az) + 0.04);
      }
      const wild = rnd() < wildK(r.u); // hacia el Cap de Creus: pizarra, matorral y bancales
      // (entre las casas de L'Escala, ni bancales ni pinos: se les metían dentro)
      const town = mi < 46;
      // Bancales de piedra seca en la ladera (las «feixes» abandonadas del Cap de Creus)
      if (i % 6 === 0 && !town) {
        for (const d of [-12, -18, -25]) {
          const y = THREE.MathUtils.lerp(0.6, 5, Math.min(1, (-d - 8) / 18));
          md.add(G.box, 0x8f877a, r.x + r.rx * d, y + 0.35, r.z + r.rz * d, 0, yaw, 0, 0.6, 0.9 + (i % 3) * 0.2, 6.4);
        }
      }
      // Olivos (troncos retorcidos, copa gris plateada) y matas de lentisco y brezo
      if (wild && rnd() < 0.35) {
        const d = -(7 + rnd() * 14);
        const x = r.x + r.rx * d, z = r.z + r.rz * d;
        const y = THREE.MathUtils.lerp(0.6, 5, Math.min(1, (-d - 8) / 18));
        md.add(G.cyl, 0x5a4a38, x, y + 0.8, z, 0.25, 0, 0.2, 0.35, 1.8, 0.35);
        md.add(G.bush, 0x8a9a78, x + 0.3, y + 2.2, z, 0, rnd() * 3, 0, 2.6, 1.5, 2.4);
      }
      // Pinos piñoneros del lado de la montaña (de L'Escala a Roses)
      if (!wild && rnd() < 0.55 && !town) {
        const d = -(7 + rnd() * 20);
        const x = r.x + r.rx * d, z = r.z + r.rz * d;
        const y = THREE.MathUtils.lerp(0.6, 5, Math.min(1, (-d - 8) / 18));
        const hgt = 3 + rnd() * 3;
        md.add(G.cyl, 0x5a4a38, x, y + hgt * 0.4, z, 0.08, 0, 0.06, 0.3, hgt * 0.8, 0.3);
        md.add(G.bush, rnd() < 0.5 ? 0x3f6a32 : 0x4d7a3a, x, y + hgt * 0.85, z, 0, rnd() * 3, 0, 4.2, 1.2, 4.0);
      }
      if (rnd() < 0.25) {
        const d = -(5.2 + rnd() * 3);
        md.add(G.bush, wild ? 0x6f7a4a : 0x86934a, r.x + r.rx * d, 0.6, r.z + r.rz * d, 0, rnd() * 3, 0, 1.6, 0.9, 1.6);
      }
      // El acantilado: roca viva desde el borde de la carretera hasta el agua (la de arriba, no en los apartaderos:
      // asomaba por encima del pretil)
      for (const [d0, y0, k] of [[7.3, -1.3, 1], [9.5, -2.6, 1.3]] as const) {
        const s = (0.85 + rnd() * 0.5) * k;
        const slate = rnd() < wildK(r.u);
        const col = slate ? (rnd() < 0.5 ? 0x5f5a54 : 0x6f6a62) : rnd() < 0.5 ? 0x8a7560 : 0x7a6a58;
        const jx = rnd(), jy = rnd(), jr = rnd();
        if (d0 < 8 && this.inBay(mi, 2)) continue;
        md.add(G.crag, col, r.x + r.rx * (d0 + jx), y0, r.z + r.rz * (d0 + jx), jr * 0.4, jy * 3, 0, 5.2 * s, 3.4 * s, 4.4 * s);
      }
      // Rocas sueltas en el agua
      if (rnd() < 0.4) {
        const d = 9 + rnd() * 8;
        const s = 1.5 + rnd() * 2.5;
        const slate = rnd() < wildK(r.u);
        md.add(rnd() < 0.5 ? G.rock : G.rock2, slate ? (rnd() < 0.5 ? 0x6f6a62 : 0x7d766b) : rnd() < 0.5 ? 0x8a7560 : 0x9c8770, r.x + r.rx * d, -2.6 + s * 0.3, r.z + r.rz * d, rnd(), rnd() * 3, 0, s * 1.4, s, s * 1.2);
      }
    }
    // Los apartaderos: pretil de piedra seca por fuera (tapa también el hueco bajo el asfalto); en el del Camí de
    // Ronda, abierto donde baja el sendero
    for (const b of this.bays()) {
      const outer = (mm: number) => this.bayOuter(mm, b.m);
      const outer2 = (mm: number) => this.bayOuter(mm, b.m) + 0.45;
      const spans: [number, number][] = b.cala ? [[b.m - BAY_HALF, b.m - 0.8], [b.m + 0.8, b.m + BAY_HALF]] : [[b.m - BAY_HALF, b.m + BAY_HALF]];
      for (const [s0, s1] of spans) md.add(this.band(outer, outer2, -2.8, 0.75, s0, s1, 1), PARAPET);
      if (b.cala) {
        // El sendero: losas de pizarra que bajan por la ladera hacia la cala, apoyadas en ella
        const { p, r, t } = this.frame(b.m);
        const yaw = Math.atan2(t.x, t.z);
        for (let k = 0; k < 7; k++) {
          const d = HALF + BAY_W + 0.55 + k * 0.6;
          const along = Math.sin(k * 1.3) * 0.5;
          md.add(G.box, PATH_STONE, p.x + r.x * d + t.x * along, seaSideGround(d) + 0.04, p.z + r.z * d + t.z * along, 0, yaw + k * 0.2, 0, 0.8, 0.12, 0.6);
        }
      }
    }
    // L'Escala: casitas encaladas de tejado de teja junto a la salida, con sus ventanas de cara a la carretera
    for (let i = 0; i < 6; i++) {
      const { p, r } = this.frame(4 + i * 7);
      const d = -(11 + (i % 2) * 8);
      const cx = p.x + r.x * d, cz = p.z + r.z * d;
      const two = i % 3 === 1;
      const h = two ? 6 : 3.4, w = 6, dd = 7;
      md.add(G.box, 0xf6f1e6, cx, h / 2, cz, 0, 0, 0, w, h, dd);
      md.add(ROOF_GEO, 0xb8623e, cx, h, cz, 0, Math.PI / 2, 0, dd + 0.6, 1.5, w + 0.6);
      const ax: 'x' | 'z' = Math.abs(r.x) > Math.abs(r.z) ? 'x' : 'z';
      const sg = ((ax === 'x' ? r.x : r.z) > 0 ? 1 : -1) as 1 | -1;
      const fx = cx + (ax === 'x' ? (sg * w) / 2 : 0), fz = cz + (ax === 'z' ? (sg * dd) / 2 : 0);
      for (const along of [-1.7, 1.7])
        for (const y of two ? [1.5, 4.2] : [1.5])
          menorcaWindow(md, fx + (ax === 'z' ? along : 0), y, fz + (ax === 'x' ? along : 0), 0.9, 1.1, { axis: ax, s: sg }, { shutter: i % 2 ? LOUVRE_GREEN : LOUVRE_BLUE, closed: (i + (y > 2 ? 1 : 0) + (along > 0 ? 1 : 0)) % 3 === 0 });
    }
    // Cadaqués al otro lado de la bahía: casas blancas apiñadas y la iglesia de Santa Maria arriba
    {
      const r = ringAt(Math.floor(SAMPLES * 0.72));
      const cx = r.x + r.rx * 70, cz = r.z + r.rz * 70;
      md.add(G.rock2, 0x6f6a62, cx, -3, cz, 0, 0.4, 0, 60, 14, 40);
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2;
        const rr2 = 6 + (k % 5) * 3.5;
        const hx = cx + Math.cos(a) * rr2 * 1.3, hz = cz + Math.sin(a) * rr2 * 0.8;
        const hy = 3.2 + (1 - rr2 / 22) * 4;
        md.add(G.box, 0xf6f1e6, hx, hy, hz, 0, a, 0, 3.4, 3.6 + (k % 3), 3.2);
        md.add(G.box, 0xb8623e, hx, hy + 2 + (k % 3) * 0.5, hz, 0, a, 0, 3.6, 0.3, 3.4);
      }
      md.add(G.box, 0xf6f1e6, cx, 10, cz, 0, 0, 0, 5, 7, 9);
      md.add(G.box, 0xf6f1e6, cx + 2, 14.5, cz - 4, 0, 0, 0, 2.4, 9, 2.4);
      md.add(G.box, 0x3a3a3a, cx + 2, 17, cz - 5.21, 0, 0, 0, 0.9, 1.4, 0.05);
    }
    // Cap de Creus: faro blanco sobre las rocas, al final de la carretera. De día, apagado
    const end = ringAt(SAMPLES);
    const fx = end.x + end.rx * 14 + 10, fz = end.z + end.rz * 14 + 16;
    // El faro real: edificio blanco alargado de dos plantas con la torre cuadrada en medio y la linterna
    // encima, sobre el promontorio de pizarra gris que cae al mar
    this.lighthouse.set(fx, 13, fz);
    md.add(G.rock2, 0x6f6a62, fx, -2, fz, 0, 0.3, 0, 30, 18, 24);
    md.add(G.rock2, 0x7d766b, (fx + end.x) / 2, -3, (fz + end.z) / 2, 0, 1.1, 0, 22, 12, 18);
    md.add(G.rock, 0x6f6a62, fx + 12, -1, fz - 6, 0, 0.7, 0, 9, 6, 8);
    md.add(G.box, 0xf6f1e6, fx, 9.6, fz, 0, 0, 0, 11, 5, 5.5);
    md.add(G.box, 0xe9dcc2, fx, 12.2, fz, 0, 0, 0, 11.4, 0.3, 5.9);
    for (let k = 0; k < 4; k++) for (const sz of [-1, 1]) md.add(G.box, 0x2f6b46, fx - 4.2 + k * 2.8, 9.8, fz + sz * 2.77, 0, 0, 0, 0.9, 1.5, 0.05);
    md.add(G.box, 0xf6f1e6, fx, 14.6, fz, 0, 0, 0, 2.6, 4.6, 2.6);
    md.add(G.box, 0xe9dcc2, fx, 17, fz, 0, 0, 0, 3.2, 0.3, 3.2);
    md.add(G.cyl, LANTERN, fx, 17.9, fz, 0, 0, 0, 1.5, 1.5, 1.5);
    md.add(G.cyl, LANTERN_TOP, fx, 18.9, fz, 0, 0, 0, 1.7, 0.5, 1.7);
    md.add(G.cone, LANTERN_TOP, fx, 19.4, fz, 0, Math.PI / 4, 0, 1.6, 0.6, 1.6);
    // Montañas al fondo
    for (let i = 0; i < 10; i++) {
      const r = ringAt(Math.floor((i / 10) * SAMPLES));
      const d = -(90 + (i % 3) * 25);
      md.add(G.rock2, 0x7d8a5a, r.x + r.rx * d, -4, r.z + r.rz * d, 0, i, 0, 80, 34 + (i % 4) * 8, 64);
      // Bosque de encinas y pinos por la ladera
      for (let k = 0; k < 6; k++) md.add(G.bush, k % 2 ? 0x4d6e3a : 0x5a7a40, r.x + r.rx * (d + 12 + k * 4) + Math.sin(k * 2.1 + i) * 18, 6 + (k % 3) * 4, r.z + r.rz * (d + 12 + k * 4) + Math.cos(k * 1.7 + i) * 18, 0, k, 0, 22, 9, 18);
    }
    this.buildSigns(md);
    sc.add(md.mesh());
  }

  /**
   * Una señal de cara a quien va hacia el faro: el dibujo (colores planos, letra de tebeo y borde de tinta) delante
   * y la chapa gris detrás, en su poste. off: lado (+ mar); y: centro de la placa.
   */
  private sign(md: Merger, m: number, off: number, y: number, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number, back: boolean) => void, tw = 256, th = 256, posts: number[] = [0], ground?: number) {
    const { p, t, r } = this.frame(m);
    const q = p.clone().addScaledVector(r, off);
    const yaw = Math.atan2(-t.x, -t.z);
    const g = new THREE.Group();
    g.position.set(q.x, y, q.z);
    g.rotation.y = yaw;
    for (const back of [false, true]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon({ map: canvasTex((c, cw, ch) => draw(c, cw, ch, back), tw, th), roughness: 0.7, transparent: true, alphaTest: 0.5 }));
      s.position.z = back ? -0.015 : 0.015;
      if (back) s.rotation.y = Math.PI;
      g.add(s);
    }
    g.userData.comicBent = true;
    this.scene.add(g);
    // Postes hasta el suelo (por detrás de la placa), un poco hundidos
    const base = (ground ?? seaSideGround(off)) - 0.1;
    for (const px of posts) {
      const pp = q.clone().addScaledVector(r, 0).add(new THREE.Vector3(Math.cos(yaw) * px, 0, -Math.sin(yaw) * px)).addScaledVector(t, 0.05);
      const top = y + h / 2 - 0.05;
      md.add(G.cyl, SIGN_POST, pp.x, (top + base) / 2, pp.z, 0, 0, 0, 0.07, top - base, 0.07);
    }
  }

  /** Las señales de la carretera, las de verdad de allí: salida del pueblo, límite, curvas, miradores y el parque. */
  private buildSigns(md: Merger) {
    const L = this.len;
    const S = HALF + 1.5; // del lado del mar, detrás de la bionda
    // Fin de L'Escala (letras negras sobre blanco, tachado en rojo)
    this.sign(md, 48, S, 2.1, 1.6, 0.8, (c, w, h, back) => {
      if (back) return plate(c, w, h);
      plate(c, w, h, '#ffffff');
      c.fillStyle = '#1b1b22';
      c.font = `bold 96px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('L’Escala', w / 2, h / 2 + 4);
      c.strokeStyle = '#c8202a';
      c.lineWidth = 22;
      c.beginPath();
      c.moveTo(w * 0.08, h * 0.82);
      c.lineTo(w * 0.92, h * 0.18);
      c.stroke();
    }, 512, 256);
    // Destinos, a la salida
    this.sign(md, 62, S, 2.3, 1.8, 0.9, (c, w, h, back) => {
      if (back) return plate(c, w, h);
      plate(c, w, h, '#ffffff');
      c.fillStyle = '#1b1b22';
      c.font = `bold 70px ${FONT}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('↑ Cadaqués', 40, h * 0.33);
      c.fillText('↑ Cap de Creus', 40, h * 0.7);
    }, 512, 256);
    // Velocidad máxima 50
    this.sign(md, 80, S, 2.0, 0.7, 0.7, (c, w, h, back) => roundSign(c, w, h, back, (cc) => {
      cc.fillStyle = '#1b1b22';
      cc.font = `bold 110px ${FONT}`;
      cc.textAlign = 'center';
      cc.textBaseline = 'middle';
      cc.fillText('50', w / 2, h / 2 + 6);
    }));
    // Curvas peligrosas: un triángulo 70 m antes de las más cerradas
    const peaks: { m: number; k: number }[] = [];
    for (let i = 90; i < this.kap.length - 40; i++) {
      const k = this.kap[i];
      if (Math.abs(k) < 1 / 80) continue;
      if (Math.abs(k) < Math.abs(this.kap[i - 1]) || Math.abs(k) < Math.abs(this.kap[i + 1])) continue;
      if (peaks.some((p) => Math.abs(p.m - i) < 120)) continue;
      peaks.push({ m: i, k });
    }
    for (const pk of peaks.slice(0, 3)) {
      const at = pk.m - 70;
      if (this.inBay(at, 4)) continue;
      const left = pk.k > 0;
      this.sign(md, at, S, 2.0, 0.85, 0.75, (c, w, h, back) => triSign(c, w, h, back, (cc) => {
        // la flecha que dobla hacia su lado
        cc.strokeStyle = '#1b1b22';
        cc.lineWidth = 16;
        cc.lineCap = 'round';
        cc.beginPath();
        const sx = left ? 1 : -1;
        cc.moveTo(w / 2 + sx * 18, h * 0.86);
        cc.quadraticCurveTo(w / 2 + sx * 20, h * 0.52, w / 2 - sx * 22, h * 0.46);
        cc.stroke();
        cc.fillStyle = '#1b1b22';
        cc.beginPath();
        cc.moveTo(w / 2 - sx * 46, h * 0.45);
        cc.lineTo(w / 2 - sx * 14, h * 0.34);
        cc.lineTo(w / 2 - sx * 14, h * 0.58);
        cc.closePath();
        cc.fill();
      }));
    }
    // Miradores: cartel marrón de turismo, 55 m antes
    for (const u of PHOTO_AT)
      this.sign(md, u * L - 55, S, 2.2, 1.3, 0.65, (c, w, h, back) => {
        if (back) return plate(c, w, h);
        plate(c, w, h, '#7a4a2a', '#ffffff');
        c.fillStyle = '#ffffff';
        c.font = `bold 78px ${FONT}`;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText('Mirador', 150, h / 2 + 4);
        // la cámara de fotos
        c.fillRect(40, h / 2 - 30, 84, 58);
        c.fillRect(62, h / 2 - 42, 30, 14);
        c.fillStyle = '#7a4a2a';
        c.beginPath();
        c.arc(82, h / 2, 18, 0, Math.PI * 2);
        c.fill();
      }, 512, 256);
    // Parc Natural de Cap de Creus: tablón de madera con dos postes
    this.sign(md, 0.525 * L, S + 0.6, 1.7, 2.4, 0.9, (c, w, h, back) => {
      plate(c, w, h, back ? '#6b4a2e' : '#8a6a44');
      if (back) return;
      c.fillStyle = '#fbf1d8';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `600 58px ${FONT}`;
      c.fillText('Parc Natural de', w / 2, h * 0.34);
      c.font = `bold 84px ${FONT}`;
      c.fillText('Cap de Creus', w / 2, h * 0.7);
    }, 640, 256, [-1.0, 1.0]);
    // Camí de Ronda, en el apartadero de la cala, junto al hueco del pretil
    const cm = CALA_AT * L;
    this.sign(md, cm - 1.6, HALF + BAY_W - 0.35, 1.2, 0.9, 0.42, (c, w, h, back) => {
      plate(c, w, h, back ? '#6b4a2e' : '#8a6a44');
      if (back) return;
      // las marcas del GR: blanca y roja
      c.fillStyle = '#ffffff';
      c.fillRect(30, h * 0.28, 70, 22);
      c.fillStyle = '#c8202a';
      c.fillRect(30, h * 0.28 + 26, 70, 22);
      c.fillStyle = '#fbf1d8';
      c.font = `bold 66px ${FONT}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('Camí de Ronda', 120, h / 2 + 4);
    }, 512, 192, [0], 0.05);
  }

  // ---------------- Fases ----------------

  private updateHud() {
    const pct = this.total > 0 ? Math.round((this.good / this.total) * 100) : 100;
    // Objetivos mínimos: un emoji, sin decir qué hacer
    const obj: Record<Phase, string> = { intro: '', pack: '🎒', ride: this.windOn ? '🌬️' : '🏍️', creus: '📷', uturn: '🏍️', back: '🏍️', cala: '🪨', done: '' };
    this.hud.setObjective(obj[this.phase]);
    const riding = this.phase === 'ride' || this.phase === 'creus' || this.phase === 'uturn' || this.phase === 'back';
    this.hud.setCounters(riding ? `<span class="chip">🏍️ ${pct}%</span><span class="chip">✌️ ${this.waves}/${this.motosMet}</span><span class="chip">📷 ${this.photos}/4</span>` : '');
  }

  /** Lo que se dice en la moto: cada uno desde su asiento (Gas delante a la izquierda del globo, ella a la derecha). */
  private say(who: string, text: string) {
    bark(who, text, isGas(who) ? 'l' : 'r');
    this.sayUntil = this.t + barkTime(text);
  }

  /** Una reacción que no se repite enseguida (si se tambalea cada segundo, no está Gas diciéndolo cada segundo). */
  private react(who: string, text: string, gap = 6) {
    if (this.t < this.nagAt) return;
    this.nagAt = this.t + gap;
    this.say(who, text);
  }

  /** Lo de en medio de una fase que hay que deshacer al saltar a otra (modo prueba) o al empezar. */
  private clearTransient() {
    this.stones?.dispose();
    this.stones = null;
    this.cancelGauge?.();
    this.cancelGauge = null;
    this.windOn = false;
    this.windK = this.windOff = 0;
    this.windEl?.remove();
    this.windEl = null;
    for (const o of this.oncoming) {
      o.live = o.root.visible = false;
      o.waveT = o.k = 0;
    }
    this.wobbleT = 0;
    this.azulWaveT = this.photoT = 0;
    this.faroReady = this.faroOpen = this.faroDone = false;
    this.faroTries = 0;
    this.lostNag = false;
    this.lost.reset();
    this.hud.setAction(null);
    document.querySelector('.pack-screen')?.remove();
  }

  private startPack() {
    this.clearTransient();
    this.phase = 'pack';
    this.moto.root.visible = false;
    this.snapCam = true;
    this.updateHud();
    packBag(MOTO.pack, () => dialogue(MOTO.ride, () => this.startRide()));
  }

  /** Sale ya en marcha, con la cámara detrás de la moto desde el primer fotograma. */
  private startRide(at = 0.02, v = START_V) {
    this.clearTransient();
    this.phase = 'ride';
    this.s = at;
    this.dir = 1;
    this.off = OFF_RIDE;
    this.offV = 0;
    this.speed = v;
    this.lean = this.azulLean = 0;
    this.footK = 0;
    this.good = this.total = 0;
    this.photos = 0;
    this.photoTaken = PHOTO_AT.map((u) => u < at - PHOTO_WIN);
    this.waves = this.motosMet = this.wrongWaves = 0;
    this.nextEv = ONCOMING.findIndex(([meet]) => (meet - at) * this.len > 10);
    if (this.nextEv < 0) this.nextEv = ONCOMING.length;
    this.talkI = MOTO.talk.findIndex((l) => l.at >= at);
    if (this.talkI < 0) this.talkI = MOTO.talk.length;
    this.sayUntil = this.t + 0.6;
    this.completed = false;
    this.moto.root.visible = true;
    this.placeMoto();
    this.yawRate = 0;
    this.snapCam = true;
    this.updateHud();
  }

  /** Coloca la moto en la carretera (s, sentido y desplazamiento) y su rumbo, el de su movimiento. */
  private placeMoto(dt = 0) {
    const u = THREE.MathUtils.clamp(this.s, 0, 1);
    const p = this.curve.getPointAt(u, this.v1);
    const t = this.curve.getTangentAt(u, this.v2);
    const rx = -t.z, rz = t.x;
    const off = this.off + this.windOff;
    this.moto.root.position.set(p.x + rx * off, 0.05, p.z + rz * off);
    const vx = t.x * this.dir * Math.max(this.speed, 0.05) + rx * this.offV;
    const vz = t.z * this.dir * Math.max(this.speed, 0.05) + rz * this.offV;
    this.setYaw(Math.atan2(vx, vz), dt);
  }

  private setYaw(y: number, dt: number) {
    if (dt > 0) {
      const rate = wrap(y - this.yaw) / dt;
      this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 8);
    } else this.yawRate = 0;
    this.yaw = y;
    this.moto.root.rotation.y = y;
  }

  /** La velocidad que quiere Gas aquí: crucero, frenando a tiempo para las curvas cerradas, los miradores y la valla. */
  private planSpeed() {
    const m = this.s * this.len;
    let v = SPEED * (this.wobbleT > 0 ? 0.8 : 1);
    for (let d = 0; d <= 50; d += 2) {
      const k = Math.abs(this.kapAt(m + d));
      if (k < 1e-4) continue;
      v = Math.min(v, Math.sqrt(LAT_G / k + 2 * BRAKE * d));
    }
    PHOTO_AT.forEach((at, i) => {
      if (this.photoTaken[i]) return;
      const a = (at - PHOTO_WIN) * this.len, b = (at + PHOTO_WIN) * this.len;
      if (m > b) return;
      v = Math.min(v, Math.sqrt(PHOTO_V * PHOTO_V + 2 * BRAKE * Math.max(0, a - m)));
    });
    v = Math.min(v, Math.sqrt(2 * BRAKE * Math.max(0, this.stopM() - m)));
    return v;
  }

  private stopM() {
    return CLOSED_AT * this.len - STOP_GAP;
  }

  private approach(target: number, dt: number) {
    this.speed = this.speed < target ? Math.min(target, this.speed + ACCEL * dt) : Math.max(target, this.speed - BRAKE_MAX * dt);
  }

  /** Se arrima a un desplazamiento lateral (con su velocidad lateral, para el rumbo). */
  private steerOff(want: number, dt: number) {
    const prev = this.off;
    this.off = want;
    this.offV = dt > 0 ? (this.off - prev) / dt : 0;
  }

  private updateRide(dt: number, ax: number) {
    this.approach(this.planSpeed(), dt);
    this.s += (this.speed * dt) / this.len;
    // Antes de parar, se arrima al borde (para luego dar la vuelta en lo ancho de la carretera)
    const m = this.s * this.len;
    this.steerOff(THREE.MathUtils.lerp(OFF_RIDE, OFF_STOP, THREE.MathUtils.smoothstep(m, this.stopM() - 30, this.stopM() - 4)), dt);
    if (m >= this.stopM() - 0.3 && this.speed < 0.4) this.arrive();
    this.updateTraffic(dt);
    // Lo que se dicen por el camino, entre una cosa y otra
    const T = MOTO.talk;
    if (this.talkI < T.length && this.s >= T[this.talkI].at && this.t > this.sayUntil + 0.5) {
      const l = T[this.talkI++];
      this.say(l.who, l.text);
    }
    void ax;
  }

  private takePhoto(i: number) {
    this.photoTaken[i] = true;
    this.photos++;
    this.photoT = 1.4;
    audio.pop();
    vibrate(30);
    // (de día no hay flash: el clic, un destello de pantalla y la onomatopeya)
    comicFlash(0xffffff, 0.5);
    comicWord('¡CLIC!', 'perfect');
    this.say('Margaux', MOTO.photoOk[(this.photos - 1) % MOTO.photoOk.length]);
    this.fx.burst(this.v1.copy(this.moto.root.position).setY(2.4), '📷', 4, 1.2, 0.6);
    this.updateHud();
  }

  /**
   * La tramontana: rachas de un lado y de otro. Hay que echarse contra el viento (hacia donde sopla la cara de la
   * flecha) o la racha se lleva la moto hacia donde sopla.
   */
  private updateWind(dt: number, ax: number) {
    const u0 = WIND_AT, u1 = WIND_AT + (WIND_SECS * 12.5) / this.len;
    const inside = this.phase === 'ride' && this.s > u0 && this.s < u1;
    this.windK += ((inside ? 1 : 0) - this.windK) * Math.min(1, dt * 2.2);
    if (inside && !this.windOn) {
      this.windOn = true;
      this.say('Gas', MOTO.wind);
      audio.warn();
      vibrate([60, 40, 60]);
      this.windSide = Math.random() < 0.5 ? -1 : 1;
      this.windT = 2.6;
      if (!this.windEl) {
        this.windEl = document.createElement('div');
        this.windEl.className = 'wind-arrow';
        document.getElementById('ui')!.append(this.windEl);
      }
      this.updateHud();
    } else if (!inside && this.windOn) {
      this.windOn = false;
      this.say('Margaux', MOTO.windOff);
      this.windEl?.remove();
      this.windEl = null;
      this.updateHud();
    }
    const against = ax * this.windSide < -0.3;
    if (inside) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.windT = 2.2 + Math.random() * 1.2;
        this.windSide *= -1;
        audio.whoosh();
      }
      if (this.windEl) {
        // De dónde sopla (la cara) y hacia dónde empuja (la flecha)
        this.windEl.textContent = this.windSide > 0 ? '🌬️ ➡️' : '⬅️ 🌬️';
        this.windEl.style.opacity = this.windT < 0.5 ? '0.45' : '1';
      }
      this.total += dt;
      if (against) this.good += dt;
      else if (this.wobbleT <= 0) {
        this.wobbleT = 1.2;
        this.react('Margaux', MOTO.windBad, 4);
        vibrate(40);
      }
      if (Math.random() < dt * 14) this.fx.burst(this.v1.copy(this.moto.root.position).setY(0.4), 'dust', 2, 1.6, 0.3);
    }
    // Sin compensar, la racha se lleva la moto hacia donde sopla (sin salirse de su carril)
    const want = inside && !against ? this.windSide * 1.0 * this.dir : 0;
    this.windOff += (want - this.windOff) * Math.min(1, dt * 1.6);
  }

  /** Delante de la valla: para con el pie en el suelo. */
  private arrive() {
    this.phase = 'creus';
    this.speed = 0;
    this.offV = 0;
    this.hud.setAction(null);
    this.windEl?.remove();
    this.windEl = null;
    this.updateHud();
    this.say('Gas', MOTO.closed);
    later(() => {
      if (this.phase !== 'creus') return;
      dialogue(MOTO.creus, () => {
        if (this.phase !== 'creus') return;
        this.faroReady = true;
        this.lost.reset();
        this.say('Gas', MOTO.faroAsk);
      });
    }, 2200);
  }

  /** La foto del faro, antes de dar la vuelta (punto justo: que salga entero). */
  private faroPhoto() {
    this.faroOpen = true;
    this.hud.setAction(null);
    this.photoT = 99;
    this.cancelGauge = timingGauge(
      {
        title: MOTO.faroPhoto.title,
        duration: 1.3 + this.faroTries * 0.2,
        button: '📷 ¡Foto!',
        zones: [
          { to: 0.34, label: MOTO.faroPhoto.zones[0], color: '#c76a4a' },
          { to: 0.66, label: MOTO.faroPhoto.zones[1], color: '#5fcf80', good: true },
          { to: 1, label: MOTO.faroPhoto.zones[2], color: '#c76a4a' },
        ],
      },
      (q) => {
        this.cancelGauge = null;
        if (this.phase !== 'creus') return;
        this.photoT = 0.8;
        audio.pop();
        vibrate(30);
        comicFlash(0xffffff, 0.6);
        if (q > 0) {
          this.photos++;
          comicWord('¡CLIC!', 'perfect');
        }
        if (q > 0 || this.faroTries >= 1) {
          this.faroDone = true;
          this.say('Margaux', q > 0 ? MOTO.faroPhoto.good : MOTO.faroPhoto.meh);
          this.updateHud();
          later(() => this.phase === 'creus' && this.beginUturn(), 2600);
        } else {
          this.faroTries++;
          this.faroOpen = false;
          this.say('Margaux', MOTO.faroPhoto.bad);
        }
      },
    );
  }

  private beginUturn() {
    this.say('Gas', MOTO.uturn);
    later(() => this.phase === 'creus' && this.startUturn(), 1800);
  }

  /** Media vuelta en lo ancho de la carretera: medio círculo despacio, del borde al otro carril. */
  private startUturn() {
    this.phase = 'uturn';
    this.faroReady = false;
    this.hud.setAction(null);
    const u = THREE.MathUtils.clamp(this.s, 0, 1);
    this.uT.copy(this.curve.getTangentAt(u));
    this.uR.set(-this.uT.z, 0, this.uT.x);
    this.uOff0 = this.off;
    this.uRad = (this.off - OFF_BACK) / 2;
    this.uC.copy(this.moto.root.position).addScaledVector(this.uR, -this.uRad).setY(0.05);
    this.uTh = 0;
    this.speed = 0;
    this.windOff = 0;
    // La cámara se queda en el plano de la valla (de lado, con el faro) y mira la maniobra
    this.creusCam(this.uCam);
    this.updateHud();
  }

  private updateUturn(dt: number) {
    this.speed = Math.min(2.2, this.speed + 1.6 * dt);
    this.uTh += (this.speed * dt) / this.uRad;
    const th = Math.min(Math.PI, this.uTh);
    const r = this.moto.root.position;
    r.copy(this.uC).addScaledVector(this.uR, this.uRad * Math.cos(th)).addScaledVector(this.uT, this.uRad * Math.sin(th));
    const vx = -this.uR.x * Math.sin(th) + this.uT.x * Math.cos(th);
    const vz = -this.uR.z * Math.sin(th) + this.uT.z * Math.cos(th);
    this.setYaw(Math.atan2(vx, vz), dt);
    if (this.uTh >= Math.PI) {
      this.phase = 'back';
      this.dir = -1;
      this.off = this.uOff0 - 2 * this.uRad;
      this.offV = 0;
      this.updateHud();
    }
  }

  /** De vuelta por el otro carril y al apartadero del Camí de Ronda, cruzando la carretera (vacía) hacia el mar. */
  private updateBack(dt: number) {
    const m = this.s * this.len;
    const cm = CALA_AT * this.len;
    const remain = Math.max(0, m - cm);
    let target = Math.min(8, Math.sqrt(2 * BRAKE * remain));
    for (let d = 0; d <= 30; d += 2) {
      const k = Math.abs(this.kapAt(m - d));
      if (k > 1e-4) target = Math.min(target, Math.sqrt(LAT_G / k + 2 * BRAKE * d));
    }
    this.approach(target, dt);
    this.s -= (this.speed * dt) / this.len;
    const k = 1 - THREE.MathUtils.smoothstep(remain, 4, 24);
    const base = THREE.MathUtils.lerp(OFF_BACK, -OFF_RIDE, THREE.MathUtils.smoothstep(this.stopM() - m, 0, 8));
    this.steerOff(THREE.MathUtils.lerp(base, HALF + BAY_W * 0.55, k), dt);
    if (remain < 0.3 && this.speed < 0.4) this.stopAtCala();
  }

  private stopAtCala() {
    this.phase = 'cala';
    this.speed = 0;
    this.offV = 0;
    this.updateHud();
    this.say('Gas', MOTO.calaStop);
    later(() => this.phase === 'cala' && !this.stones && this.startCala(), 2800);
  }

  /** La cala de las ranas: escena aparte (se baja a pie por el sendero: corte). Hasta ganarle no volvéis. */
  private startCala() {
    fadeFlash(() => {
      this.clearTransient();
      this.phase = 'cala';
      this.updateHud();
      this.stones = new StoneSkip(() => this.endCala(), { azul: AZUL_MOTO, gas: GAS_MOTO });
    });
  }

  private endCala() {
    fadeFlash(() => {
      this.stones?.dispose();
      this.stones = null;
      this.finish();
    });
  }

  /** Esa noche, cena y helado; el lunes devolvéis la moto (con la costa de fondo). */
  private finish() {
    this.clearTransient();
    this.phase = 'done';
    this.moto.root.visible = false;
    this.snapCam = true;
    this.updateHud();
    dialogue(MOTO.back, () =>
      phoneChat(CHATS.motoTrip, () => {
        if (this.completed) return;
        this.completed = true;
        const pct = this.total > 0 ? Math.round((this.good / this.total) * 100) : 100;
        // Tres cosas: curvas fluidas, tres de las cuatro fotos y el saludo motero sin fallos (dos de tres ya dan las tres estrellas)
        const ok = (pct >= 70 ? 1 : 0) + (this.photos >= 3 ? 1 : 0) + (this.waves >= this.motosMet && this.wrongWaves === 0 ? 1 : 0);
        this.onComplete({ stars: Math.min(3, 1 + ok), stats: MOTO.stats(pct, this.photos, this.waves, this.motosMet, this.wrongWaves) });
      }),
    );
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    if (this.stones) {
      this.stones.update(dt, this.camera);
      return;
    }
    const riding = this.phase === 'ride';
    const ax = riding ? this.input.axes().x : 0;
    const v0 = this.speed;
    if (this.phase === 'ride') this.updateRide(dt, ax);
    else if (this.phase === 'uturn') this.updateUturn(dt);
    else if (this.phase === 'back') this.updateBack(dt);
    else this.speed = Math.max(0, this.speed - BRAKE_MAX * dt);
    this.updateWave(dt);
    this.updateWind(dt, ax);
    if (this.phase !== 'uturn') this.placeMoto(dt);
    // Las líneas de velocidad del tebeo, solo al acelerar fuerte (en crucero, todo el viaje, cansaban)
    const acc = dt > 0 ? (this.speed - v0) / dt : 0;
    const lines = (this.scene.userData.speedLines as number) ?? 0;
    this.scene.userData.speedLines = lines + ((acc > 2.5 && this.speed > 6 ? 1 : 0) - lines) * Math.min(1, dt * 3);

    // Gas pone el pie izquierdo en el suelo cuando va casi parado, y la moto se apoya en ese lado
    const moving = this.moto.root.visible && this.speed > 1.0;
    this.footK += ((this.moto.root.visible && !moving ? 1 : 0) - this.footK) * Math.min(1, dt * 5);
    // Inclinación de la moto (la que manda Gas: la de la curva que traza) y la de Azul (la que pone la jugadora)
    const want = moving ? THREE.MathUtils.clamp(-Math.atan((this.speed * this.yawRate) / 9.8), -0.6, 0.6) : 0;
    this.lean += (want * (1 - this.footK) - 0.08 * this.footK - this.lean) * Math.min(1, dt * 4);
    this.azulLean += (ax * 0.45 - this.azulLean) * Math.min(1, dt * 6);
    if (riding && Math.abs(want) > 0.03 && !this.windOn) {
      // En curva: acompañar hacia el mismo lado; en recta: ir derechita
      const strong = Math.abs(want) > 0.12;
      const ok = strong ? Math.sign(ax) === Math.sign(want) && Math.abs(ax) > 0.25 : Math.abs(ax) < 0.6 || Math.sign(ax) === Math.sign(want);
      this.total += dt;
      if (ok) this.good += dt;
      else if (strong && this.wobbleT <= 0) {
        this.wobbleT = 1.2;
        this.react('Gas', MOTO.lean.bad[Math.floor(Math.random() * MOTO.lean.bad.length)], 7);
        vibrate(40);
      }
      if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.updateHud();
    }
    if (this.wobbleT > 0) this.wobbleT -= dt;
    const wob = this.wobbleT > 0 ? Math.sin(this.t * 22) * 0.06 * this.wobbleT : 0;
    this.moto.root.rotation.z = this.lean + wob + this.windK * Math.sin(this.t * 6) * 0.025;
    // Se inclina de cintura para arriba: la cadera sigue en el asiento y las piernas no se mueven
    leanTorso(this.azul, this.azul.rig ? 0 : 0.2, 0, this.azulLean - this.lean * 0.3);
    for (const w of this.moto.wheels) w.rotation.x += (this.speed * dt) / 0.33;

    // Botón: la foto en los miradores, el saludo a lo que viene de frente, la foto del faro
    let label: string | null = null;
    let act: (() => void) | null = null;
    if (riding) {
      PHOTO_AT.forEach((at, i) => {
        if (!this.photoTaken[i] && Math.abs(this.s - at) < PHOTO_WIN) {
          label = MOTO.photoHint;
          act = () => this.takePhoto(i);
        }
      });
      // Viene alguien de frente: el botón de saludar sale igual para motos y coches (hay que fijarse)
      const o = label ? null : this.waveTarget();
      if (o) {
        label = MOTO.wave.btn;
        act = () => this.wave(o);
      }
    } else if (this.phase === 'creus' && this.faroReady && !this.faroOpen && !this.faroDone && !document.querySelector('.dialogue')) {
      label = MOTO.faroPhoto.btn;
      act = () => this.faroPhoto();
    }
    this.hud.setAction(label, !!label);
    const pressed = this.input.consumeAction();
    if (pressed && act) (act as () => void)();

    // Pistas, solo si se ha perdido: parados ante la valla, si en 40 s no hace la foto, Gas se lo recuerda
    const busy = !!document.querySelector('.dialogue, .phone-overlay, .gauge, .pack-screen');
    const key = `${this.phase}|${this.faroReady}|${this.faroOpen}|${this.photos}`;
    if (this.lost.tick(key, dt, busy) && this.phase === 'creus' && this.faroReady && !this.faroOpen && !this.lostNag) {
      this.lostNag = true;
      this.say('Gas', MOTO.faroLost);
    }

    this.updateCamera(dt);
    this.sun.follow(this.moto.root.visible ? this.moto.root.position : this.camLook);
    this.sky.update(this.camera, dt);
  }

  /** Ante la valla: por detrás y un poco de lado, la moto parada, la valla y, al fondo, el faro al que no se llega. */
  private creusCam(out: THREE.Vector3) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    return out.copy(this.moto.root.position).add(new THREE.Vector3(-fx * 5.5 - fz * 1.8, 2.3, -fz * 5.5 + fx * 1.8));
  }

  private updateCamera(dt: number) {
    const p = this.moto.root.position;
    const fwd = this.v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    let rate = 5;
    if (this.phase === 'ride' || this.phase === 'back') {
      // Detrás de la moto en marcha
      pos = this.v1.copy(p).addScaledVector(fwd, -5.5).setY(2.6);
      look = new THREE.Vector3().copy(p).addScaledVector(fwd, 7).setY(1.2);
      rate = this.phase === 'back' ? 3 : 5;
    } else if (this.phase === 'creus') {
      pos = this.creusCam(this.v1);
      look = this.lighthouse.clone().setY(5);
      rate = 2;
    } else if (this.phase === 'uturn') {
      pos = this.v1.copy(this.uCam);
      look = new THREE.Vector3().copy(p).setY(1.0);
      rate = 3;
    } else if (this.phase === 'cala') {
      // Parados en el apartadero: de lado, con el mar detrás
      pos = this.v1.copy(p).addScaledVector(fwd, -4.5).add(new THREE.Vector3(-fwd.z * 2.5, 2.2, fwd.x * 2.5));
      look = new THREE.Vector3().copy(p).setY(1.0);
      rate = 2;
    } else {
      // La presentación, la mochila y el final: la costa desde lo alto, de postal, con un barrido lento
      const a = this.frame(0.33 * this.len);
      const b = this.frame(0.6 * this.len);
      pos = this.v1.copy(a.p).addScaledVector(a.r, -38).setY(26);
      look = b.p.clone().addScaledVector(b.r, 55).addScaledVector(b.t, Math.sin(this.t * 0.05) * 25).setY(0);
      rate = 1;
    }
    // Al empezar una fase o si la moto salta lejos (modo prueba), la cámara ya está en su sitio: no cruza el mapa
    if (this.snapCam || this.camera.position.distanceTo(pos) > 60) {
      this.snapCam = false;
      this.camera.position.copy(pos);
      this.camLook.copy(look);
    }
    this.camera.position.lerp(pos, Math.min(1, dt * rate));
    this.camLook.lerp(look, Math.min(1, dt * 4));
    this.camera.lookAt(this.camLook);
  }

  /** Dónde habla quien va en la moto (para que el bocadillo salga de su casco, cada uno a su lado). */
  speakerPoint(who: string) {
    if (this.stones) return this.stones.speakerPoint(who);
    if (!this.moto.root.visible) return null;
    const p = isGas(who) ? this.moto.rider : isAzul(who) ? this.azul : null;
    if (!p) return null;
    const head = p.rig?.bones.get('Head') ?? p.head;
    const out = head.getWorldPosition(new THREE.Vector3());
    out.y += 0.38;
    return out;
  }

  /** De qué lado sale el globo de cada uno en la moto (main.ts lo pregunta si speakerPoint responde). */
  speakerSide(who: string): 'l' | 'r' | undefined {
    if (this.stones) return this.stones.speakerSide(who);
    return isGas(who) ? 'l' : isAzul(who) ? 'r' : undefined;
  }

  // ---------- Tráfico de frente y saludo motero ----------

  /** Dos motos y dos coches que se reutilizan (se crean al principio: así no hay tirones al cruzarse). */
  private buildTraffic() {
    const motoCols = [0x1f3a6b, 0xe8e8e4];
    for (let i = 0; i < 2; i++) {
      const mo = makeMoto(motoCols[i], RIDERS[i]);
      mo.root.visible = false;
      mo.root.rotation.order = 'YXZ';
      mo.root.userData.comicBent = true;
      this.scene.add(mo.root);
      const o: Oncoming = { kind: 'moto', root: mo.root, wheels: mo.wheels, rider: mo.rider, s: 0, live: false, greeted: false, passed: false, waveT: 0, waved: false, k: 0 };
      this.oncoming.push(o);
      this.riderWave(o);
    }
    const carCols = [0xf2f2ee, 0x6b1f2a];
    for (let i = 0; i < 2; i++) {
      const car = makeCar(carCols[i], { luggage: false, joy: false, driver: DRIVERS[i] });
      // Solo el conductor
      const az = (car as { azul?: THREE.Object3D }).azul;
      if (az) az.visible = false;
      car.root.visible = false;
      car.root.userData.comicBent = true;
      this.scene.add(car.root);
      this.oncoming.push({ kind: 'car', root: car.root, wheels: (car as { wheels?: THREE.Object3D[] }).wheels ?? [], rider: null, s: 0, live: false, greeted: false, passed: false, waveT: 0, waved: false, k: 0 });
    }
  }

  /**
   * El motero de enfrente saluda con la izquierda (la derecha va en el gas): la mano fuera y abajo, hacia el
   * centro de la carretera, con la V.
   */
  private riderWave(o: Oncoming) {
    const r = o.rider;
    if (!r?.rig) return;
    const B = (n: string) => r.rig!.bones.get(n)!;
    let side: string | null = null;
    const t = new THREE.Vector3(), pole = new THREE.Vector3();
    rigPost.add(() => {
      if (!o.live || o.k < 0.01 || !o.root.parent) return;
      if (!side) {
        o.root.updateWorldMatrix(true, true);
        side = o.root.worldToLocal(B('LeftHand').getWorldPosition(t)).x > 0 ? 'Left' : 'Right';
      }
      o.root.localToWorld(t.set(0.6, 0.72, 0.18));
      o.root.localToWorld(pole.set(0.55, 0.95, -0.35));
      twoBone(B(side + 'Arm'), B(side + 'ForeArm'), B(side + 'Hand'), t, pole, o.k);
    });
  }

  private placeOncoming(o: Oncoming) {
    const u = THREE.MathUtils.clamp(o.s, 0, 1);
    const p = this.curve.getPointAt(u);
    const t = this.curve.getTangentAt(u);
    // Por el centro del carril de la izquierda, en sentido contrario
    o.root.position.set(p.x + t.z * OFF_RIDE, 0.05, p.z - t.x * OFF_RIDE);
    o.root.rotation.y = Math.atan2(t.x, t.z) + Math.PI;
  }

  private updateTraffic(dt: number) {
    const len = this.len;
    // Cada uno sale cuando el punto de cruce queda a SPAWN_AHEAD m, desde donde llegue a tiempo (nunca de detrás de la valla)
    while (this.nextEv < ONCOMING.length) {
      const [meet, kind] = ONCOMING[this.nextEv];
      if ((meet - this.s) * len > SPAWN_AHEAD) break;
      this.nextEv++;
      const o = this.oncoming.find((x) => x.kind === kind && !x.live);
      if (!o) continue;
      const t = Math.max(0, ((meet - this.s) * len) / SPEED);
      o.s = Math.min(meet + (ONCOMING_V * t) / len, CLOSED_AT - 12 / len);
      o.live = o.root.visible = true;
      o.greeted = o.passed = o.waved = false;
      o.waveT = 0;
      this.placeOncoming(o);
    }
    for (const o of this.oncoming) {
      if (!o.live) continue;
      o.s -= (ONCOMING_V * dt) / len;
      this.placeOncoming(o);
      for (const w of o.wheels) w.rotation.x += (ONCOMING_V * dt) / 0.33;
      const d = (o.s - this.s) * len; // metros por delante
      // El de la moto de enfrente saluda ya de cerca
      if (o.kind === 'moto' && !o.waved && d < 24) {
        o.waved = true;
        o.waveT = 1.6;
      }
      if (!o.passed && d < -3) {
        o.passed = true;
        if (o.kind === 'moto') {
          this.motosMet++;
          if (!o.greeted) this.say('Gas', MOTO.wave.missed);
          this.updateHud();
        }
      }
      if (d < -30) o.live = o.root.visible = false;
    }
  }

  /** Lo que viene de frente y aún no has saludado, si está a tiro (entre 45 m por delante y justo al cruzaros). */
  private waveTarget() {
    for (const o of this.oncoming) {
      if (!o.live || o.greeted) continue;
      const d = (o.s - this.s) * this.len;
      if (d < 45 && d > -3) return o;
    }
    return null;
  }

  private wave(o: Oncoming) {
    o.greeted = true;
    this.azulWaveT = 1.3;
    if (o.kind === 'moto') {
      this.waves++;
      if (o.waveT <= 0) o.waveT = 1.2;
      this.say('Gas', MOTO.wave.ok[(this.waves - 1) % MOTO.wave.ok.length]);
      comicWord('¡✌️!', 'luck');
      audio.pickup();
      vibrate(20);
    } else {
      this.wrongWaves++;
      this.say('Gas', MOTO.wave.car[(this.wrongWaves - 1) % MOTO.wave.car.length]);
      audio.boo();
    }
    this.updateHud();
  }

  /** Brazos de los que saludan: Azul suelta la cintura de Gas; el de enfrente saca la mano del manillar. */
  private updateWave(dt: number) {
    this.azulWaveT -= dt;
    this.azulWaveK += ((this.azulWaveT > 0 ? 1 : 0) - this.azulWaveK) * Math.min(1, dt * 8);
    this.photoT -= dt;
    this.photoK += ((this.photoT > 0 ? 1 : 0) - this.photoK) * Math.min(1, dt * 6);
    if (this.phone) this.phone.visible = this.photoK > 0.4;
    for (const o of this.oncoming) {
      if (!o.rider) continue;
      o.waveT -= dt;
      o.k += ((o.waveT > 0 ? 1 : 0) - o.k) * Math.min(1, dt * 8);
      // (sin esqueleto: el brazo izquierdo, a mano)
      if (!o.rider.rig) {
        o.rider.armL.rotation.set(THREE.MathUtils.lerp(-1.1, -0.45, o.k), 0, THREE.MathUtils.lerp(-0.3, -0.75, o.k));
        o.rider.elbowL.rotation.x = THREE.MathUtils.lerp(-0.25, -0.05, o.k);
      }
    }
  }

  /** Sus manos no se mueven de la cintura de Gas aunque ella se incline en las curvas (salvo al saludar o la foto). */
  private hugGas() {
    const a = this.azul;
    const r = a.rig!;
    a.root.updateWorldMatrix(true, true);
    const onLeft = a.root.worldToLocal(r.bones.get('LeftHand')!.getWorldPosition(new THREE.Vector3())).x > 0;
    const B = (n: string) => r.bones.get(n)!;
    const t = new THREE.Vector3();
    const pole = new THREE.Vector3();
    // El móvil de las fotos, en la mano del lado del mar
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.01), new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4 }));
    phone.position.set(0, -0.06, 0.03);
    phone.visible = false;
    boneAnchor(a, 'RightHand').add(phone);
    this.phone = phone;
    const post = () => {
      if (!a.root.parent || !this.moto.root.visible) return;
      const root = this.moto.root;
      root.updateWorldMatrix(true, false);
      for (const sx of [1, -1]) {
        const left = sx > 0 ? onLeft : !onLeft;
        const side = left ? 'Left' : 'Right';
        // Saluda con la izquierda, como los moteros: ese brazo suelta a Gas; la derecha, para el móvil
        const w = left ? 1 - this.azulWaveK : 1 - this.photoK;
        if (w <= 0.01) continue;
        root.localToWorld(t.set(sx * 0.17, 1.17, -0.5));
        root.localToWorld(pole.set(sx * 0.62, 0.98, -0.72));
        twoBone(B(side + 'Arm'), B(side + 'ForeArm'), B(side + 'Hand'), t, pole, w);
      }
      // La mano izquierda, fuera y arriba, moviéndose: el saludo
      if (this.azulWaveK > 0.01) {
        const ls = onLeft ? 1 : -1;
        root.localToWorld(t.set(ls * 0.62, 1.62 + Math.sin(this.t * 13) * 0.05, -0.42 + Math.sin(this.t * 13) * 0.07));
        root.localToWorld(pole.set(ls * 1.0, 1.0, -0.7));
        twoBone(B('LeftArm'), B('LeftForeArm'), B('LeftHand'), t, pole, this.azulWaveK);
      }
      // La derecha, con el móvil en alto hacia el mar (o hacia el faro, delante)
      if (this.photoK > 0.01) {
        const rs = onLeft ? -1 : 1;
        if (this.phase === 'creus') root.localToWorld(t.set(rs * 0.32, 1.78, -0.25));
        else root.localToWorld(t.set(rs * 0.55, 1.6, -0.6));
        root.localToWorld(pole.set(rs * 0.9, 1.0, -0.9));
        twoBone(B('RightArm'), B('RightForeArm'), B('RightHand'), t, pole, this.photoK);
      }
      // Pies en las estriberas de atrás, con la rodilla hacia fuera (por los lados de Gas)
      for (const sx of [1, -1]) {
        const side = (sx > 0 ? onLeft : !onLeft) ? 'Left' : 'Right';
        root.localToWorld(t.set(sx * 0.22, 0.6, -0.71));
        root.localToWorld(pole.set(sx * 0.62, 1.05, -0.2));
        twoBone(B(side + 'UpLeg'), B(side + 'Leg'), B(side + 'Foot'), t, pole, 1);
        boneLevel(a, side + 'Foot', 0.1);
      }
    };
    rigPost.add(post);
  }

  /** Gas, parado: el pie izquierdo en el suelo, al lado de la moto (la moto se apoya un poco en ese lado). */
  private gasFoot() {
    const g = this.moto.rider;
    if (!g?.rig) return;
    const B = (n: string) => g.rig!.bones.get(n)!;
    let side: string | null = null;
    const t = new THREE.Vector3(), pole = new THREE.Vector3();
    rigPost.add(() => {
      if (this.footK < 0.01 || !this.moto.root.visible || !g.root.parent) return;
      const root = this.moto.root;
      if (!side) {
        root.updateWorldMatrix(true, true);
        side = root.worldToLocal(B('LeftUpLeg').getWorldPosition(t)).x > 0 ? 'Left' : 'Right';
      }
      // En el suelo de verdad (y = 0), no en los ejes de la moto inclinada
      const y = this.yaw;
      const lx = Math.cos(y), lz = -Math.sin(y), fx = Math.sin(y), fz = Math.cos(y);
      const p = root.position;
      t.set(p.x + lx * 0.42 - fx * 0.12, 0.1, p.z + lz * 0.42 - fz * 0.12);
      pole.set(p.x + lx * 0.55 + fx * 0.5, 0.7, p.z + lz * 0.55 + fz * 0.5);
      twoBone(B(side + 'UpLeg'), B(side + 'Leg'), B(side + 'Foot'), t, pole, this.footK);
      boneLevel(g, side + 'Foot', 0);
    });
  }

  // ---------- Carretera cortada ----------

  /** El último tramo hasta el faro, cerrado: bloques de hormigón rojos y blancos, valla y carteles. */
  private buildClosure() {
    const p = this.curve.getPointAt(CLOSED_AT);
    const t = this.curve.getTangentAt(CLOSED_AT);
    const g = new THREE.Group();
    g.position.set(p.x, 0.05, p.z);
    g.rotation.y = Math.atan2(t.x, t.z);
    const m = new Merger();
    // Bloques de hormigón de lado a lado (x a lo ancho, z a lo largo de la carretera)
    for (let i = 0; i < 4; i++) {
      const x = -3.15 + i * 2.1;
      m.add(G.box, i % 2 ? 0xd7263d : 0xf2f2ee, x, 0.38, 0, 0, 0, 0, 2.0, 0.76, 0.55);
      m.add(G.box, i % 2 ? 0xf2f2ee : 0xd7263d, x, 0.8, 0, 0, 0, 0, 2.0, 0.08, 0.34);
    }
    // Valla metálica de obra detrás, con sus pies
    for (let i = 0; i < 4; i++) {
      const x = -3.15 + i * 2.1;
      for (const dx of [-0.95, 0.95]) {
        m.add(G.box, FENCE, x + dx, 1.05, 0.7, 0, 0, 0, 0.04, 2.0, 0.04);
        m.add(G.box, 0x3a3a3e, x + dx, 0.05, 0.7, 0, 0, 0, 0.12, 0.1, 0.5);
      }
      for (const y of [0.1, 2.0]) m.add(G.box, FENCE, x, y, 0.7, 0, 0, 0, 1.9, 0.04, 0.04);
      for (let k = 0; k < 10; k++) m.add(G.box, FENCE_BAR, x - 0.85 + k * 0.19, 1.05, 0.7, 0, 0, 0, 0.012, 1.9, 0.012);
    }
    // Conos naranjas delante
    for (const x of [-3.6, -1.2, 1.2, 3.6]) {
      m.add(G.cone, 0xff7a1a, x, 0.35, -1.6, 0, 0, 0, 0.36, 0.7, 0.36);
      m.add(G.cyl, 0xf2f2ee, x, 0.4, -1.6, 0, 0, 0, 0.24, 0.08, 0.24);
    }
    // Postes de las señales
    m.add(G.cyl, SIGN_POST, -4.6, 1.3, -0.3, 0, 0, 0, 0.08, 2.6, 0.08);
    m.add(G.cyl, SIGN_POST, 4.6, 1.2, -0.3, 0, 0, 0, 0.08, 2.4, 0.08);
    g.add(m.mesh());
    const sign = (draw: (c: CanvasRenderingContext2D, w: number, h: number, back: boolean) => void, w: number, h: number, x: number, y: number, tw: number, th: number) => {
      for (const back of [false, true]) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon({ map: canvasTex((c, cw, ch) => draw(c, cw, ch, back), tw, th), roughness: 0.6, transparent: true, alphaTest: 0.5 }));
        s.position.set(x, y, back ? -0.33 : -0.36);
        s.rotation.y = back ? 0 : Math.PI; // de cara a quien llega
        g.add(s);
      }
    };
    // Entrada prohibida
    sign((c, w, h, back) => roundSign(c, w, h, back, (cc) => {
      cc.fillStyle = '#c8202a';
      cc.beginPath();
      cc.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2);
      cc.fill();
      cc.fillStyle = '#ffffff';
      cc.fillRect(w * 0.2, h * 0.42, w * 0.6, h * 0.16);
    }), 0.9, 0.9, -4.6, 2.5, 256, 256);
    // Carretera cortada, en catalán como las de allí
    sign((c, w, h, back) => {
      if (back) return plate(c, w, h);
      plate(c, w, h, '#f2f2ee');
      c.strokeStyle = '#c8202a';
      c.lineWidth = 18;
      c.strokeRect(22, 22, w - 44, h - 44);
      c.fillStyle = '#1b1b22';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `bold 70px ${FONT}`;
      c.fillText('CARRETERA', w / 2, h * 0.3);
      c.fillText('TALLADA', w / 2, h * 0.55);
      c.font = `600 36px ${FONT}`;
      c.fillText('Accés al far tancat', w / 2, h * 0.8);
    }, 2.2, 1.1, 4.6, 2.2, 512, 256);
    g.userData.comicBent = true;
    this.scene.add(g);
  }

  debug(): DebugItem[] {
    const L = this.len;
    const stopHere = () => {
      this.startRide(this.stopM() / L, 0);
      this.nextEv = ONCOMING.length;
      this.talkI = MOTO.talk.length;
      this.off = OFF_STOP;
      this.placeMoto();
      this.phase = 'creus';
      this.footK = 1;
      this.snapCam = true;
      this.updateHud();
    };
    return [
      { label: '1 · La mochila', run: () => this.startPack() },
      { label: '2 · En moto (desde L’Escala)', run: () => this.startRide() },
      { label: '3 · Primer mirador (foto)', run: () => this.startRide(PHOTO_AT[0] - 60 / L, SPEED) },
      { label: '4 · Tramontana', run: () => this.startRide(WIND_AT - 40 / L, SPEED) },
      { label: '5 · Llegada a la valla', run: () => { this.startRide(CLOSED_AT - 90 / L, SPEED); this.nextEv = ONCOMING.length; this.talkI = MOTO.talk.findIndex((l) => l.at >= CLOSED_AT - 90 / L); if (this.talkI < 0) this.talkI = MOTO.talk.length; } },
      { label: '6 · Foto del faro', run: () => { stopHere(); this.faroReady = true; this.say('Gas', MOTO.faroAsk); } },
      { label: '7 · Media vuelta', run: () => { stopHere(); this.faroDone = true; this.startUturn(); } },
      { label: '8 · Al apartadero', run: () => { stopHere(); this.faroDone = true; this.startUturn(); this.uTh = Math.PI; this.updateUturn(0.016); } },
      { label: '9 · La cala (ranas)', run: () => { this.clearTransient(); this.phase = 'cala'; this.speed = 0; this.moto.root.visible = false; this.startCala(); } },
      { label: '10 · Esa noche y el lunes', run: () => this.finish() },
      { label: '✓ Completar capítulo', run: () => { this.clearTransient(); this.phase = 'done'; this.completed = true; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  private stones: StoneSkip | null = null;
  private windK = 0;
  private windOff = 0;
  private windOn = false;
  private windSide = 1;
  private windT = 0;
  private windEl: HTMLElement | null = null;

  dispose() {
    this.stones?.dispose();
    this.stones = null;
    this.cancelGauge?.();
    this.windEl?.remove();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}

/** Altura del terreno del lado del mar a `off` m del eje (el perfil de buildCoast: arcén, ladera y acantilado). */
function seaSideGround(off: number) {
  const P: [number, number][] = [[HALF, 0.03], [5.2, -0.06], [6.6, -0.7], [9, -4.5]];
  if (off <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (off <= P[i][0]) return THREE.MathUtils.lerp(P[i - 1][1], P[i][1], (off - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
  return P[P.length - 1][1];
}

/** Intercomunicador de casco: la cajita negra con su antena corta, en el lado izquierdo. */
function intercom() {
  const m = new Merger(false);
  m.add(G.rbox, 0x1e1e22, 0, 0, 0, 0, 0, 0, 0.016, 0.042, 0.064);
  m.add(G.cyl, 0x1e1e22, 0, 0.03, -0.022, 0, 0, 0, 0.008, 0.03, 0.008);
  const g = m.mesh();
  g.position.set(0.158, -0.02, 0.01);
  return g;
}

/** Chapa rectangular de señal con su borde de tinta (de espaldas, la chapa gris). */
function plate(c: CanvasRenderingContext2D, w: number, h: number, fill = '#9a9ea2', inner?: string) {
  c.fillStyle = fill;
  c.fillRect(0, 0, w, h);
  if (inner) {
    c.strokeStyle = inner;
    c.lineWidth = 8;
    c.strokeRect(20, 20, w - 40, h - 40);
  }
  c.strokeStyle = INK;
  c.lineWidth = 10;
  c.strokeRect(5, 5, w - 10, h - 10);
}

/** Señal redonda de reglamentación: blanca con el aro rojo y el contorno de tinta. */
function roundSign(c: CanvasRenderingContext2D, w: number, h: number, back: boolean, inside: (c: CanvasRenderingContext2D) => void) {
  const R = w / 2 - 6;
  c.beginPath();
  c.arc(w / 2, h / 2, R, 0, Math.PI * 2);
  c.fillStyle = back ? '#9a9ea2' : '#ffffff';
  c.fill();
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.stroke();
  if (back) return;
  c.beginPath();
  c.arc(w / 2, h / 2, R - 20, 0, Math.PI * 2);
  c.lineWidth = 30;
  c.strokeStyle = '#c8202a';
  c.stroke();
  inside(c);
}

/** Señal triangular de peligro: blanca con el borde rojo y el contorno de tinta. */
function triSign(c: CanvasRenderingContext2D, w: number, h: number, back: boolean, inside: (c: CanvasRenderingContext2D) => void) {
  const tri = (k: number) => {
    c.beginPath();
    c.moveTo(w / 2, 10 + k);
    c.lineTo(w - 10 - k * 1.2, h - 10 - k * 0.6);
    c.lineTo(10 + k * 1.2, h - 10 - k * 0.6);
    c.closePath();
  };
  tri(0);
  c.fillStyle = back ? '#9a9ea2' : '#c8202a';
  c.fill();
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.lineJoin = 'round';
  c.stroke();
  if (back) return;
  tri(30);
  c.fillStyle = '#ffffff';
  c.fill();
  inside(c);
}
