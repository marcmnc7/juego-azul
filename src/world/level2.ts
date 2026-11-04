import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { ROAD } from '../data/story';
import { G, Merger, makeCar, makeScallop, vertexMat, CarRig } from '../entities/models';
import { spring } from '../core/walker';
import { Sky, Sun, toon, vibrate, addOutline, applyShadows, makeSea } from '../core/gfx';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, fadeFlash, Hud, DebugItem, later, phoneChat } from '../ui/ui';
import { CHATS } from '../data/chats';
import { Terrace } from './terrace';
import { Camp } from './camp';
import { Laurel } from './laurel';
import { cowGeometry, makeRoadCow, type RoadCow } from '../entities/cow';
import { cinema, cineTitle, headOf, rel } from '../core/cinema';
import { Surf } from '../core/surfaces';
import { beacon } from '../core/beacon';
import { clock, type Level, type LevelDone, disposeScene } from './level';
import { MARC_LOOK, MARGAUX_LOOK } from '../data/characters';

// Capítulo 3 · La ruta de las zamburiñas, en el orden en que pasó:
// Madrid → Cafetería Marcial → la noche del camping sin gas → San Vicente de la Barquera (la plancha y
// la zamburiña en El Ancla, a cámara lenta) → carretera entre viñedos → Logroño, de fiesta.
// Por el camino, además de fotos, gasolina y tabaco, alguna vaca en mitad de la carretera: hay que parar,
// saludarla y preguntarle hacia dónde vamos.

type Phase = 'intro' | 'drive1' | 'marcial' | 'camp' | 'cow' | 'arriveSV' | 'grill' | 'zambDone' | 'drive2' | 'logrono' | 'terrace' | 'done';
type Region = 'madrid' | 'meseta' | 'cantabria' | 'rioja';

const LANES = [-2.6, 0, 2.6];
const LEG1 = 1500; // metros hasta San Vicente
const LEG2 = 650; // metros de San Vicente a Logroño
const MAX_SPEED = 26;
const NEED_ZAMB = 8;

const REGION_STYLE: Record<Region, { ground: number; fog: number; sky: number; top: number }> = {
  madrid: { ground: 0xb9a27a, fog: 0xf3d9b0, sky: 0x9cc9ec, top: 0x3f7fd0 },
  meseta: { ground: 0xd9b75e, fog: 0xf4e1b0, sky: 0x8fc3ef, top: 0x2f72cc },
  cantabria: { ground: 0x5f9e4c, fog: 0xcfe3e8, sky: 0x9fc6e0, top: 0x5a8fc0 },
  rioja: { ground: 0xa8704a, fog: 0xf6c9a0, sky: 0xf2a77d, top: 0x5a4a9a },
};
const TURBO = 1.45;
// El juego del viaje: parar en el primer restaurante que empiece por M
const EATERIES: { name: string; z: number; m?: boolean }[] = [
  { name: 'Asador El Cruce', z: 520 },
  { name: 'Bar Los Arcos', z: 610 },
  { name: 'Hostal La Parada', z: 690 },
  { name: 'Cafetería Marcial', z: 770, m: true },
];
const MARCIAL_Z = 770;
/** Donde paráis a hacer noche: entre Marcial y San Vicente. */
const CAMP_Z = 985;
/** Las vacas de la carretera. */
const COW_Z = [1110, 1345, LEG1 + 40 + 340];
const COW_NEAR = 60;
const COW_BRAKE = 21; // a esta distancia se frena sí o sí (frenando, para unos metros antes)

function canvasTex(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSign(lines: string[], bg = '#1f5fbf') {
  const tex = canvasTex((ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.font = `bold ${i === 0 ? 46 : 34}px sans-serif`;
      ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 56);
    });
  }, 512, 256);
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: tex }));
  board.position.y = 4;
  board.rotation.y = Math.PI;
  g.add(board);
  g.add(new Merger().add(G.cyl, 0x888888, -2, 2, 0.05, 0, 0, 0, 0.15, 4, 0.15).add(G.cyl, 0x888888, 2, 2, 0.05, 0, 0, 0, 0.15, 4, 0.15).mesh());
  return g;
}

/** Decorado repetido a los lados de la carretera (InstancedMesh que se recicla delante del coche). */
class Scatter {
  mesh: THREE.InstancedMesh;
  private z: number[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(
    geo: THREE.BufferGeometry,
    private count: number,
    private spacing: number,
    private region: Region[],
    private xRange: [number, number],
    private bothSides: boolean,
    private scaleRange: [number, number] = [1, 1],
    private yawRandom = true,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, vertexMat(), count);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) this.z.push(-40 + i * spacing);
  }

  reset(carZ: number, regionAt: (z: number) => Region) {
    for (let i = 0; i < this.count; i++) {
      this.z[i] = carZ - 30 + i * this.spacing;
      this.place(i, regionAt);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private place(i: number, regionAt: (z: number) => Region) {
    const z = this.z[i] + (Math.random() - 0.5) * this.spacing * 0.6;
    const on = this.region.includes(regionAt(z));
    const side = this.bothSides ? (Math.random() < 0.5 ? -1 : 1) : 1;
    const x = side * (this.xRange[0] + Math.random() * (this.xRange[1] - this.xRange[0]));
    const sc = on ? this.scaleRange[0] + Math.random() * (this.scaleRange[1] - this.scaleRange[0]) : 0.0001;
    this.q.setFromEuler(this.e.set(0, this.yawRandom ? Math.random() * Math.PI * 2 : 0, 0));
    this.mesh.setMatrixAt(i, this.m.compose(this.p.set(x, 0, z), this.q, this.s.set(sc, sc, sc)));
  }

  update(carZ: number, regionAt: (z: number) => Region) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      if (this.z[i] < carZ - 30) {
        this.z[i] += this.count * this.spacing;
        this.place(i, regionAt);
        dirty = true;
      }
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Thing {
  obj: THREE.Object3D;
  kind: 'photo' | 'obstacle' | 'turbo' | 'smoke';
  passed?: boolean;
  lane: number;
  z: number;
  speed: number; // los coches del carril se mueven
  alive: boolean;
}

export class Level2 implements Level {
  private scene = new THREE.Scene();
  private terrace: Terrace | null = null;
  /** La última noche: el camping sin gas (escena de cine). */
  private camp: Camp | null = null;
  private campDone = false;
  /** Logroño, de fiesta. */
  private laurel: Laurel | null = null;
  private cowIdx = 0;
  private roadCow: RoadCow | null = null;
  private cowLeaving = false;
  private cowFrom: Phase = 'drive1';
  private eating = false;
  private busy = false;
  private hud: Hud;
  private fx: Particles;
  private phase: Phase = 'intro';
  // Su Ford Focus gris: conduce ella («el tuyo. Y conduces tú») y Marc va de copiloto
  private car = makeCar(0x8d9298, { joy: false, driver: MARGAUX_LOOK, passenger: MARC_LOOK });
  private carZ = 0;
  private carX = 0;
  private carVX = 0;
  private rig: CarRig | null = null;
  private lane = 1;
  private speed = 0;
  private hitT = 0;
  private photos = 0;
  private t = 0;
  private dist = 0; // metros recorridos en el tramo actual
  private legStart = 0;
  private region: Region = 'madrid';
  private logronoTown: THREE.Object3D | null = null;
  private things: Thing[] = [];
  private nextSpawn = 60;
  private scatters: Scatter[] = [];
  private ground: THREE.Mesh;
  private road: THREE.Mesh;
  private roadTex: THREE.Texture;
  private groundTex: THREE.Texture;
  private sea: THREE.Mesh;
  private sky: THREE.Color;
  private skyTop: THREE.Color;
  private skyDome: Sky;
  private skyTimer = 0;
  private sun: Sun;
  private turboT = 0;
  private steerT = -9;
  private combo = 0;
  private hits = 0;
  private burnt = 0;
  private nearMisses = 0;
  private driveTime = 0;
  private shakeT = 0;
  private baseFov = 60;
  private route: HTMLElement;
  private routeCar: HTMLElement;
  private turboTex: THREE.Texture;
  private smokeTex: THREE.Texture;
  private swipeX: number | null = null;
  private onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .dialogue')) return;
    this.swipeX = e.clientX;
  };
  private onUp = (e: PointerEvent) => {
    if (this.swipeX === null) return;
    const dx = e.clientX - this.swipeX;
    this.swipeX = null;
    if (Math.abs(dx) > 35) this.steer(Math.sign(dx));
  };
  private svTown: THREE.Group;
  private logSign: THREE.Group;
  private grill: THREE.Group;
  private scallops: { root: THREE.Group; meat: THREE.Mesh; p: number; speed: number; wait: number }[] = [];
  private served = 0;
  private laneBtns: HTMLElement[] = [];
  private prevAx = 0;
  private photoTex: THREE.Texture;
  private obstacleGeos: Record<Region, { geo: THREE.BufferGeometry; speed: number }[]>;
  private marcialDone = false;
  private eateryTried = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private camTarget = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private tmpColor = new THREE.Color();
  private onTap = (e: PointerEvent) => this.tapGrill(e);

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    this.sky = new THREE.Color(REGION_STYLE.madrid.sky);
    this.skyTop = new THREE.Color(REGION_STYLE.madrid.top);
    sc.fog = new THREE.Fog(REGION_STYLE.madrid.fog, 60, 190);
    this.skyDome = new Sky({
      top: REGION_STYLE.madrid.top,
      mid: REGION_STYLE.madrid.sky,
      bottom: REGION_STYLE.madrid.fog,
      sun: { color: 0xfff0c0, dir: new THREE.Vector3(0.4, 0.5, 1), size: 110 },
      clouds: { count: 14, tint: 0xffffff },
    });
    sc.add(this.skyDome.group);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.6));
    this.sun = new Sun(sc, 0xfff1d6, 2.3, new THREE.Vector3(0.5, 1, 0.4), 26);

    // Manchas grandes y suaves (hierba más verde, tierra más clara, rodadas): el detalle fino lo pone
    // la textura de superficie (hierba o tierra) que se proyecta encima
    this.groundTex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 46;
        const v = Math.random() < 0.5 ? 180 + Math.random() * 40 : 245 + Math.random() * 10;
        for (const ox of [-w, 0, w])
          for (const oy of [-h, 0, h]) {
            const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
            g.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
            g.addColorStop(1, `rgba(${v},${v},${v},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
          }
      }
    });
    this.groundTex.wrapS = this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.repeat.set(5, 5);
    const gg = new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2);
    gg.setAttribute('surf', new THREE.BufferAttribute(new Float32Array(gg.attributes.position.count).fill(Surf.Grass), 1));
    this.ground = new THREE.Mesh(gg, toon({ map: this.groundTex, color: REGION_STYLE.madrid.ground }));
    sc.add(this.ground);

    this.roadTex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(6, 0, 8, h);
      ctx.fillRect(w - 14, 0, 8, h);
      ctx.fillRect(w / 3 - 3, 0, 6, h / 2);
      ctx.fillRect((2 * w) / 3 - 3, 0, 6, h / 2);
    });
    this.roadTex.wrapS = this.roadTex.wrapT = THREE.RepeatWrapping;
    this.roadTex.repeat.set(1, 400 / 8);
    this.road = new THREE.Mesh(new THREE.PlaneGeometry(9, 400).rotateX(-Math.PI / 2), toon({ map: this.roadTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.road.position.y = 0.02;
    this.ground.userData.noCast = this.road.userData.noCast = true;
    sc.add(this.road);

    this.sea = makeSea([300, 400], 0x175f86, new THREE.Vector3(0.3, 1, 0.4));
    this.sea.position.set(170, 0.05, 0);
    this.sea.visible = false;
    sc.add(this.sea);

    this.buildScatters();
    this.obstacleGeos = this.buildObstacles();
    this.photoTex = canvasTex((ctx) => {
      ctx.font = '200px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📸', 128, 140);
    });
    const emojiTex = (e: string) =>
      canvasTex((ctx) => {
        ctx.font = '200px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e, 128, 140);
      });
    this.turboTex = emojiTex('⛽');
    this.smokeTex = emojiTex('🚬');

    sc.add(this.car.root);
    this.fx = new Particles(sc);

    // San Vicente: puente de arcos, castillo y la iglesia en lo alto
    this.svTown = this.buildSanVicente();
    this.svTown.position.z = LEG1 + 30;
    sc.add(this.svTown);
    this.grill = this.buildGrill();
    this.grill.position.set(-9, 0, LEG1 + 8);
    sc.add(this.grill);

    this.logSign = makeSign(['LOGROÑO', 'Calle Laurel ↗'], '#7a1f3d');
    this.logSign.position.set(6, 0, LEG1 + 40 + LEG2 + 12);
    sc.add(this.logSign);
    const sv = makeSign(['San Vicente', 'de la Barquera'], '#1f5fbf');
    sv.position.set(6, 0, LEG1 - 20);
    sc.add(sv);
    for (const e of EATERIES) {
      const r = this.buildEatery(e.name, !!e.m);
      r.position.set(0, 0, e.z);
      sc.add(r);
    }
    const a1 = makeSign(['A-1 Burgos', 'Santander 390'], '#1f5fbf');
    a1.position.set(6, 0, 80);
    sc.add(a1);

    this.hud = hud(() => this.input.queueAction(), onMenu, 'Desliza o toca ◀ ▶ para cambiar de carril');
    this.makeLaneButtons();
    // Barra de ruta: Madrid → San Vicente → Logroño
    this.route = document.createElement('div');
    this.route.className = 'route';
    this.route.innerHTML = `<div class="track"><div class="fill"></div></div>${ROAD.stops.map((n, i) => `<span class="stop s${i}">${n}</span>`).join('')}`;
    this.routeCar = document.createElement('div');
    this.routeCar.className = 'route-car';
    this.routeCar.textContent = '🚗';
    this.route.append(this.routeCar);
    document.getElementById('ui')!.append(this.route);
    window.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    this.baseFov = this.camera.fov;
    this.camera.position.set(0, 5, -10);
    this.reset(0);
    this.updateHud();
    this.camera.lookAt(0, 1, 10);
    audio.startMusic('road');
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(ROAD.intro, () =>
        phoneChat(CHATS.pacto, () =>
          dialogue(ROAD.introTrain, () =>
            phoneChat([CHATS.muyJusto, CHATS.helado, CHATS.aparcao], () =>
              dialogue(ROAD.introGo, () => {
                this.phase = 'drive1';
                this.updateHud();
              }),
            ),
          ),
        ),
      );
    }, 500);
  }

  get threeScene() {
    if (this.camp && this.phase === 'camp') return this.camp.scene;
    if (this.laurel && this.phase === 'logrono') return this.laurel.scene;
    return this.terrace && this.phase === 'terrace' ? this.terrace.scene : this.scene;
  }

  private regionAt = (z: number): Region => {
    if (z > LEG1 + 40) return 'rioja';
    if (z > 1000) return 'cantabria';
    if (z > 420) return 'meseta';
    return 'madrid';
  };

  private buildScatters() {
    // Bloques de pisos de las afueras de Madrid: ventanas con persiana y marco, balcones con
    // barandilla, bajos con locales y cornisa; uno de ladrillo visto y otro revocado
    const block = (wall: number, w: number, d: number, floors: number) => {
      const m = new Merger();
      const H = 3.6 + floors * 2.9;
      m.add(G.box, wall, 0, H / 2, 0, 0, 0, 0, w, H, d);
      m.add(G.box, 0xcfc6b6, 0, 1.8, 0, 0, 0, 0, w + 0.15, 3.6, d + 0.15); // bajos
      m.add(G.box, 0xe6dfd2, 0, H + 0.15, 0, 0, 0, 0, w + 0.5, 0.3, d + 0.5); // cornisa
      m.add(G.box, wall, 0, H + 0.7, 0, 0, 0, 0, w, 0.8, d); // pretil de la azotea
      m.add(G.box, 0xb8b2a8, w * 0.25, H + 1.6, -d * 0.2, 0, 0, 0, 2.2, 1.8, 2); // casetón
      for (const [nx, nz, len] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]] as const) {
        const cols = Math.max(2, Math.floor(len / 2.6));
        const off = nx ? (d / 2 + 0.03) : (w / 2 + 0.03);
        for (let c = 0; c < cols; c++) {
          const u = -len / 2 + (c + 0.5) * (len / cols);
          const at = (dy: number, out: number) => (nz ? [u, dy, nz * (off + out)] : [nx * (off + out), dy, u]) as [number, number, number];
          const rot = nx ? Math.PI / 2 : 0;
          // Escaparate en los bajos
          { const [x, y, z] = at(1.6, 0.02); m.add(G.box, c % 3 ? 0x2c3a46 : 0x7a2a22, x, y, z, 0, rot, 0, len / cols - 0.6, 2.2, 0.05); }
          for (let f = 0; f < floors; f++) {
            const y = 3.6 + f * 2.9 + 1.4;
            const [x, , z] = at(y, 0.02);
            m.add(G.box, 0xefe9dc, x, y, z, 0, rot, 0, 1.45, 1.75, 0.06); // marco
            m.add(G.box, 0x24303c, ...at(y - 0.1, 0.05), 0, rot, 0, 1.15, 1.35, 0.05); // cristal
            m.add(G.box, 0xc8a46a, ...at(y + 0.62, 0.07), 0, rot, 0, 1.2, 0.3, 0.06); // persiana a medias
            if ((c + f) % 2 === 0) {
              m.add(G.box, 0xd8d0c2, ...at(y - 0.92, 0.45), 0, rot, 0, 1.7, 0.12, 0.9); // balcón
              m.add(G.box, 0x2a2a2a, ...at(y - 0.45, 0.88), 0, rot, 0, 1.7, 0.85, 0.04); // barandilla
            }
          }
        }
      }
      return m.build();
    };
    const building = block(0xe2d6c0, 12, 10, 4);
    const brick = block(0xa65a3e, 10, 9, 3);
    // Pino piñonero: tronco algo torcido y copa ancha y plana, hecha de varias matas
    const pine = new Merger().add(G.cyl, 0x6b4a30, 0.2, 2.4, 0, 0, 0, 0.08, 0.45, 4.8, 0.45).add(G.cyl, 0x6b4a30, 0.9, 4.6, 0.2, 0, 0, -0.7, 0.25, 1.8, 0.25);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      pine.add(G.bush, k % 2 ? 0x46703a : 0x3f6a34, 0.5 + Math.cos(a) * 1.7, 5.4 + Math.sin(k * 2.1) * 0.25, Math.sin(a) * 1.7, 0, k, 0, 2.8, 1.3, 2.6);
    }
    pine.add(G.bush, 0x4a7a3c, 0.5, 5.9, 0, 0, 0, 0, 3.2, 1.2, 3.2);
    const pineGeo = pine.build();
    // Roble cántabro: copa redonda de muchas matas, más oscura por debajo
    const oak = new Merger().add(G.cyl, 0x5a3e28, 0, 1.5, 0, 0, 0, 0, 0.6, 3, 0.6).add(G.cyl, 0x5a3e28, 0.6, 3.2, 0, 0, 0, -0.6, 0.3, 1.6, 0.3).add(G.cyl, 0x5a3e28, -0.5, 3.3, 0.3, 0.3, 0, 0.6, 0.3, 1.6, 0.3);
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4;
      const r = k ? 1.6 : 0;
      oak.add(G.bush, k % 3 ? 0x3f7f35 : 0x4a8f3f, Math.cos(a) * r, 4.4 + Math.sin(k * 1.7) * 0.6 + (k ? 0 : 0.8), Math.sin(a) * r, 0, k, 0, 2.8, 2.4, 2.8);
    }
    const oakGeo = oak.build();
    // Matas y piedras en las cunetas: rompen la línea recta entre el asfalto y el campo
    const verge = new Merger();
    for (let k = 0; k < 6; k++) verge.add(G.bush, k % 2 ? 0x7d8a4a : 0x6a7d3e, Math.cos(k * 2.3) * 2.2, 0.25, Math.sin(k * 1.7) * 3, 0, k, 0, 0.9 + (k % 3) * 0.3, 0.85, 0.9);
    verge.add(G.rock, 0x9a8f80, 1.4, 0.05, -1.5, 0, 1, 0, 0.8, 0.5, 0.7).add(G.rock2, 0xa89a86, -1.2, 0.05, 2, 0, 2, 0, 0.6, 0.4, 0.5);
    const vergeGeo = verge.build();
    const hay = new Merger().add(G.cyl, 0xe0c060, 0, 0.75, 0, 0, 0, Math.PI / 2, 1.5, 1.6, 1.5).build();
    const mill = new Merger()
      .add(G.cyl, 0xf2efe6, 0, 3, 0, 0, 0, 0, 2.4, 6, 2.4)
      .add(G.cone, 0x2b2b2b, 0, 6.8, 0, 0, Math.PI / 4, 0, 3.2, 1.8, 3.2)
      .add(G.box, 0x6b4428, 0, 4.8, 1.3, 0, 0, 0.6, 0.3, 7, 0.1)
      .add(G.box, 0x6b4428, 0, 4.8, 1.3, 0, 0, -0.95, 0.3, 7, 0.1)
      .build();
    const hill = new Merger().add(G.rock2, 0x4f8f3e, 0, -2, 0, 0, 0, 0, 34, 16, 28).add(G.bush, 0x3a6e30, 6, 5, 4, 0, 0, 0, 10, 5, 9).add(G.bush, 0x3a6e30, -8, 3, -5, 0, 1, 0, 8, 4, 8).build();
    // Viñedo riojano en vaso: cepas bajas y retorcidas, en hileras, sobre tierra arcillosa rojiza
    const vines = new Merger();
    for (let i = 0; i < 5; i++) {
      const vx = (i - 2) * 2.4; // centrado: si no, las hileras del lado izquierdo acababan en plena carretera
      vines.add(G.box, 0x8a5a3a, vx, 0.03, 0, 0, 0, 0, 0.9, 0.06, 10); // caballón de tierra
      for (let j = 0; j < 7; j++) {
        const z = -4.5 + j * 1.5;
        vines.add(G.cyl, 0x4a3426, vx, 0.3, z, 0.15 * ((j % 3) - 1), 0, 0.12, 0.12, 0.6, 0.12);
        vines.add(G.bush, j % 2 ? 0x5a7f2e : 0x4f7428, vx, 0.8, z, 0, j, 0, 1.0, 0.65, 1.0);
        if (j % 2) vines.add(G.box, 0x3a2050, vx + 0.35, 0.55, z, 0, 0, 0, 0.16, 0.22, 0.16); // racimo
      }
    }
    const vineGeo = vines.build();
    // Picos de Europa al fondo: caliza gris con nieve en las cumbres
    const peak = new Merger()
      .add(G.rock2, 0x8d8f94, 0, 0, 0, 0, 0, 0, 60, 46, 40)
      .add(G.rock, 0xf2f4f6, 0, 17, 0, 0, 0.6, 0, 22, 9, 16)
      .add(G.rock, 0x7c7f86, 30, -4, 6, 0, 1.2, 0, 40, 30, 30)
      .build();
    const bull = new Merger()
      .add(G.box, 0x111111, 0, 7, 0, 0, 0, 0, 0.2, 5, 11)
      .add(G.box, 0x111111, 0, 9.8, 5.2, 0, 0, 0, 0.2, 2.6, 2.6)
      .add(G.box, 0x111111, 0, 3, 3.5, 0, 0, 0, 0.2, 3.5, 1.2)
      .add(G.box, 0x111111, 0, 3, -3.8, 0, 0, 0, 0.2, 3.5, 1.2)
      .add(G.box, 0x111111, 0, 11.5, 5.5, 0, 0, 0.6, 0.2, 2.5, 0.4)
      .add(G.box, 0x111111, 0, 11.5, 5.5, 0, 0, 0, 0.2, 0.4, 2.8)
      .build();

    this.scatters = [
      new Scatter(building, 20, 14, ['madrid'], [14, 34], true, [0.85, 1.25]),
      new Scatter(brick, 14, 18, ['madrid'], [14, 44], true, [0.85, 1.2]),
      // (las distancias, contando lo que abulta cada cosa: nada de matas ni copas sobre el asfalto, que llega a x = 4,5)
      new Scatter(pineGeo, 18, 12, ['madrid', 'meseta'], [10, 40], true, [0.7, 1.3]),
      new Scatter(hay, 20, 9, ['meseta'], [8, 50], true, [0.8, 1.2]),
      new Scatter(mill, 6, 45, ['meseta'], [25, 60], true, [1, 1.2]),
      new Scatter(bull, 1, 260, ['meseta'], [22, 24], false, [1, 1], false),
      new Scatter(hill, 10, 30, ['cantabria'], [40, 90], false, [0.7, 1.4]),
      new Scatter(peak, 6, 70, ['cantabria'], [-150, -210], false, [0.9, 1.5], false),
      new Scatter(oakGeo, 22, 9, ['cantabria'], [10, 35], true, [0.8, 1.3]),
      new Scatter(cowGeometry('frisona'), 8, 20, ['cantabria'], [-12, -32], false, [1, 1]),
      new Scatter(cowGeometry('tudanca'), 5, 32, ['cantabria'], [-13, -34], false, [1, 1]),
      new Scatter(vineGeo, 24, 10, ['rioja'], [12, 32], true, [1, 1], false),
      new Scatter(vergeGeo, 40, 5, ['madrid', 'meseta', 'cantabria', 'rioja'], [9, 14], true, [0.7, 1.3]),
    ];
    // Las montañas lejanas no llevan niebla (si no, desaparecen): ya son de un gris azulado de lejanía
    this.scatters[7].mesh.material = toon({ vertexColors: true, fog: false });
    for (const s of this.scatters) this.scene.add(s.mesh);
  }

  private buildObstacles(): Record<Region, { geo: THREE.BufferGeometry; speed: number }[]> {
    const cone = new Merger().add(G.cone, 0xff7a1a, 0, 0.45, 0, 0, Math.PI / 4, 0, 0.6, 0.9, 0.6).add(G.box, 0xffffff, 0, 0.45, 0, 0, 0, 0, 0.36, 0.12, 0.36).build();
    // Tráfico: turismos, monovolumen y furgoneta con ruedas, lunas tintadas, pilotos y matrícula
    const otherCar = (c: number, kind: 'hatch' | 'sedan' | 'suv' | 'van' = 'sedan') => {
      const m = new Merger();
      const glass = 0x2b3a48;
      const L = kind === 'van' ? 4.6 : kind === 'hatch' ? 3.6 : 4.2;
      const W = kind === 'van' ? 1.9 : 1.78;
      const lowH = kind === 'suv' ? 0.75 : 0.6;
      const lowY = (kind === 'suv' ? 0.42 : 0.32) + lowH / 2;
      // Carrocería baja (capó + maletero), redondeada
      m.add(G.rbox, c, 0, lowY, 0, 0, 0, 0, W, lowH, L);
      if (kind === 'van') {
        // Furgoneta: caja alta casi entera, con cabina delante
        m.add(G.rbox, c, 0, 1.55, -0.35, 0, 0, 0, W - 0.02, 1.3, L - 1.0);
        m.add(G.box, glass, 0, 1.45, L / 2 - 1.0, -0.5, 0, 0, W - 0.25, 0.7, 0.05);
        m.add(G.box, 0x444448, 0, 1.45, -L / 2 + 0.16, 0, 0, 0, 0.03, 1.1, 0.02); // junta de puertas traseras
      } else {
        const cabL = kind === 'hatch' ? 2.1 : kind === 'suv' ? 2.5 : 2.2;
        const cabZ = kind === 'hatch' ? -0.35 : kind === 'suv' ? -0.3 : -0.2;
        const cabY = lowY + lowH / 2 + 0.27;
        m.add(G.rbox, c, 0, cabY, cabZ, 0, 0, 0, W - 0.16, 0.56, cabL);
        // Lunas: trasera, laterales y parabrisas
        m.add(G.box, glass, 0, cabY + 0.02, cabZ - cabL / 2 - 0.01, kind === 'hatch' ? 0.1 : 0.35, 0, 0, W - 0.4, 0.4, 0.04);
        m.add(G.box, glass, 0, cabY + 0.02, cabZ + cabL / 2 + 0.01, -0.35, 0, 0, W - 0.4, 0.4, 0.04);
        for (const sx of [-1, 1]) m.add(G.box, glass, sx * (W / 2 - 0.07), cabY + 0.04, cabZ, 0, 0, 0, 0.03, 0.34, cabL - 0.35);
        // Cabezas del conductor y acompañante (se ven por la luna trasera)
        m.add(G.sphere, 0x2a1f18, 0.38, cabY + 0.05, cabZ + 0.25, 0, 0, 0, 0.3, 0.32, 0.3);
        if (c % 3 === 0) m.add(G.sphere, 0x8a6a40, -0.38, cabY + 0.05, cabZ + 0.25, 0, 0, 0, 0.3, 0.32, 0.3);
        // Retrovisores
        for (const sx of [-1, 1]) m.add(G.rbox, c, sx * (W / 2 + 0.08), cabY - 0.12, cabZ + cabL / 2 - 0.15, 0, 0, 0, 0.14, 0.12, 0.08);
      }
      // Parte trasera: pilotos, matrícula europea, paragolpes y tubo de escape
      const rz = -L / 2 - 0.01;
      for (const sx of [-1, 1]) {
        m.add(G.rbox, 0xd0202a, sx * (W / 2 - 0.22), lowY + 0.12, rz, 0, 0, 0, 0.34, 0.14, 0.04);
        m.add(G.box, 0xff9a2a, sx * (W / 2 - 0.22), lowY + 0.02, rz - 0.005, 0, 0, 0, 0.3, 0.04, 0.03);
      }
      m.add(G.box, 0xf4f4f0, 0, lowY - 0.05, rz - 0.01, 0, 0, 0, 0.52, 0.12, 0.02);
      m.add(G.box, 0x1f4fbf, -0.23, lowY - 0.05, rz - 0.02, 0, 0, 0, 0.06, 0.12, 0.02);
      m.add(G.rbox, 0x2a2a2e, 0, lowY - lowH / 2 + 0.06, -L / 2 + 0.02, 0, 0, 0, W + 0.04, 0.16, 0.18);
      m.add(G.rbox, 0x2a2a2e, 0, lowY - lowH / 2 + 0.06, L / 2 - 0.02, 0, 0, 0, W + 0.04, 0.16, 0.18);
      m.add(G.cyl, 0x8a8a90, 0.5, lowY - lowH / 2 + 0.02, rz - 0.04, Math.PI / 2, 0, 0, 0.08, 0.12, 0.08);
      // Faros delanteros
      for (const sx of [-1, 1]) m.add(G.rbox, 0xfff6d8, sx * (W / 2 - 0.25), lowY + 0.08, L / 2 + 0.01, 0, 0, 0, 0.36, 0.14, 0.04);
      // Ruedas con llanta
      const wy = 0.34;
      const wz = L / 2 - 0.75;
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        m.add(G.cyl, 0x151515, sx * (W / 2 - 0.08), wy, sz * wz, 0, 0, Math.PI / 2, 0.68, 0.26, 0.68);
        m.add(G.cyl, 0xb8bcc4, sx * (W / 2 - 0.02), wy, sz * wz, 0, 0, Math.PI / 2, 0.38, 0.06, 0.38);
      }
      return m.build();
    };
    const tractor = new Merger()
      .add(G.box, 0x2f8f3a, 0, 1.1, 0.3, 0, 0, 0, 1.4, 1, 2)
      .add(G.box, 0x9fd3e8, 0, 2, -0.4, 0, 0, 0, 1.2, 1, 1)
      .add(G.cyl, 0x1a1a1a, -0.8, 0.8, -0.6, 0, 0, Math.PI / 2, 1.6, 0.5, 1.6)
      .add(G.cyl, 0x1a1a1a, 0.8, 0.8, -0.6, 0, 0, Math.PI / 2, 1.6, 0.5, 1.6)
      .build();
    const barrel = new Merger().add(G.cyl, 0x8a5a36, 0, 0.6, 0, 0, 0, 0, 1, 1.2, 1).add(G.cyl, 0x333333, 0, 0.3, 0, 0, 0, 0, 1.03, 0.08, 1.03).add(G.cyl, 0x333333, 0, 0.9, 0, 0, 0, 0, 1.03, 0.08, 1.03).build();
    // speed > 0: va en nuestro sentido, más lento que nosotros
    return {
      madrid: [{ geo: cone, speed: 0 }, { geo: otherCar(0x2f4f86, 'sedan'), speed: 10 }, { geo: otherCar(0xe9e9ec, 'van'), speed: 9 }, { geo: otherCar(0x9a9ea6, 'hatch'), speed: 12 }],
      meseta: [{ geo: otherCar(0x1d1f24, 'suv'), speed: 11 }, { geo: tractor, speed: 5 }, { geo: cone, speed: 0 }, { geo: otherCar(0xc8c2b4, 'sedan'), speed: 12 }],
      cantabria: [{ geo: tractor, speed: 5 }, { geo: otherCar(0x3d5a4a, 'suv'), speed: 10 }, { geo: otherCar(0xf2f2f2, 'hatch'), speed: 11 }],
      rioja: [{ geo: barrel, speed: 0 }, { geo: otherCar(0x6e1a2e, 'sedan'), speed: 11 }, { geo: otherCar(0xe9e9ec, 'van'), speed: 9 }],
    };
  }

  private buildSanVicente() {
    const g = new THREE.Group();
    const m = new Merger();
    // Ría a la derecha
    m.add(G.box, 0x2f7fb5, 40, 0.04, 20, 0, 0, 0, 70, 0.05, 60);
    // Puente de la Maza (arcos)
    for (let i = 0; i < 8; i++) {
      m.add(G.box, 0xb8ad97, 12 + i * 5, 2.4, 6, 0, 0, 0, 1.2, 4.8, 3);
      m.add(G.cyl, 0xb8ad97, 14.5 + i * 5, 4.4, 6, Math.PI / 2, 0, 0, 3.8, 3, 3.8);
    }
    m.add(G.box, 0xb8ad97, 32, 5.6, 6, 0, 0, 0, 42, 0.6, 3.2);
    // Casas del pueblo
    for (let i = 0; i < 7; i++) {
      const x = -12 - (i % 3) * 7;
      const z = -4 + Math.floor(i / 3) * 9 + (i % 2) * 2;
      const h = 5 + (i % 3) * 2;
      m.add(G.box, [0xf2ede2, 0xe9d8b4, 0xf4f1ea][i % 3], x, h / 2, z, 0, 0, 0, 6, h, 6);
      m.add(G.cone, 0xa9573a, x, h + 1, z, 0, Math.PI / 4, 0, 8.4, 2, 8.4);
      m.add(G.box, [0x2f6b46, 0x1f5fbf, 0x9b2335][i % 3], x + 3.02, h / 2, z, 0, 0, 0, 0.05, 1.2, 1);
    }
    // Castillo del Rey
    m.add(G.box, 0xa89c86, -16, 8, 26, 0, 0, 0, 10, 16, 10);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) m.add(G.box, 0xa89c86, -16 + dx, 17, 26 + dz, 0, 0, 0, 1.6, 2, 1.6);
    // Santa María de los Ángeles en la colina
    m.add(G.sphere, 0x5f9e4c, -36, -2, 30, 0, 0, 0, 34, 16, 30);
    m.add(G.box, 0xc9b98f, -36, 10, 30, 0, 0, 0, 14, 8, 7);
    m.add(G.box, 0xc9b98f, -31, 14, 30, 0, 0, 0, 4, 16, 4);
    m.add(G.cone, 0x8a7a66, -31, 23, 30, 0, Math.PI / 4, 0, 5, 3, 5);
    // La plancha de El Ancla: suelo de losas, la fachada de piedra con soportales detrás, el toldo
    // de rayas azules y blancas, la barra y unas mesas
    m.add(G.box, 0xbdb4a4, -9, 0.05, -22, 0, 0, 0, 22, 0.1, 16);
    m.add(G.box, 0xb8ad97, -9, 5, -12.5, 0, 0, 0, 22, 10, 3);
    for (let x = -18; x <= 0; x += 4.5) {
      m.add(G.box, 0x2a2420, x + 2.25, 1.6, -13.98, 0, 0, 0, 3, 3.2, 0.1);
      m.add(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 14, 1, false, 0, Math.PI), 0x2a2420, x + 2.25, 3.2, -13.95, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1);
    }
    for (let k = 0; k < 11; k++) m.add(G.box, k % 2 ? 0xf4f4f0 : 0x1f5fbf, -18.9 + k * 1.8 + 0.9, 4.6, -15.2, -0.45, 0, 0, 1.8, 0.06, 3); // toldo
    for (let k = 0; k < 4; k++) m.add(G.box, 0x6b4a2e, -16 + k * 4.5, 6.6, -14.2, 0, 0, 0, 2.6, 1.2, 0.8); // balcones de madera
    m.add(G.box, 0x6b4a2e, -3, 0.55, -19, 0, 0, 0, 0.8, 1.1, 5); // barra
    for (const [x, z] of [[-17, -24], [-14, -27], [-3, -26]]) {
      m.add(G.box, 0x8a6a44, x, 0.75, z, 0, 0, 0, 1.4, 0.06, 1.0);
      for (const sx of [-1, 1]) m.add(G.rbox, 0x1f5fbf, x + sx * 0.95, 0.45, z, 0, 0, 0, 0.45, 0.9, 0.45);
    }
    g.add(m.mesh());
    return g;
  }

  /** La plancha de un bar, a tamaño real: encimera de acero, plancha oscura, limón, plato y las zamburiñas. */
  private buildGrill() {
    const g = new THREE.Group();
    g.add(
      new Merger()
        .add(G.box, 0x8d9096, 0, 0.45, 0, 0, 0, 0, 1.6, 0.9, 0.9)
        .add(G.box, 0xb4b7bc, 0, 0.91, 0, 0, 0, 0, 1.66, 0.03, 0.96)
        .add(G.box, 0x24242a, -0.14, 0.93, 0, 0, 0, 0, 1.06, 0.02, 0.76)
        .add(G.cyl, 0xffffff, 0.62, 0.935, 0, 0, 0, 0, 0.26, 0.015, 0.26) // plato
        .add(G.sphere, 0xf0dc4a, -0.08, 0.955, 0.33, 0, 0, 0, 0.055, 0.045, 0.045) // limón
        .add(G.cyl, 0x6a7f3a, 0.62, 0.95, -0.28, 0, 0, 0, 0.08, 0.05, 0.08) // perejil picado
        .mesh(),
    );
    for (let i = 0; i < 6; i++) {
      const s = makeScallop();
      s.root.position.set(-0.46 + (i % 3) * 0.32, 0.942, -0.16 + Math.floor(i / 3) * 0.34);
      s.root.rotation.y = i * 1.1;
      g.add(s.root);
      this.scallops.push({ root: s.root, meat: s.meat, p: 0, speed: 0.18 + Math.random() * 0.1, wait: i * 0.4 });
    }
    return g;
  }

  private makeLaneButtons() {
    const mk = (label: string, side: 'left' | 'right', dir: number) => {
      const b = document.createElement('button');
      b.className = `lane-btn ${side}`;
      b.textContent = label;
      b.onpointerdown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.steer(dir);
      };
      document.getElementById('ui')!.append(b);
      this.laneBtns.push(b);
    };
    mk('◀', 'left', -1);
    mk('▶', 'right', 1);
    this.showLaneButtons(false);
  }

  private showLaneButtons(on: boolean) {
    this.laneBtns.forEach((b) => (b.hidden = !on));
  }

  private steer(dir: number) {
    if (this.phase !== 'drive1' && this.phase !== 'drive2') return;
    // El carril 0 queda a la izquierda del conductor (x positiva mirando a +Z)
    const before = this.lane;
    this.lane = Math.max(0, Math.min(2, this.lane - dir));
    if (this.lane !== before) this.steerT = this.t;
  }

  private updateHud() {
    const h = this.hud;
    h.setArrow(null);
    const drive = this.phase === 'drive1' || this.phase === 'drive2';
    this.showLaneButtons(drive);
    h.setAction(null);
    if (drive) {
      const total = this.phase === 'drive1' ? LEG1 : LEG2;
      const left = Math.max(0, Math.round((total - this.dist) / 10));
      h.setObjective(`${this.phase === 'drive1' ? 'San Vicente' : 'Logroño'} a ${left} km`);
      h.setCounters(`<span class="chip">📸 ${this.photos}</span>`);
    } else if (this.phase === 'terrace') {
      this.showLaneButtons(false);
      h.setObjective('Cómete una zamburiña en la terraza');
      h.setCounters('');
    } else if (this.phase === 'grill') {
      h.setObjective('Toca cada zamburiña cuando esté dorada');
      h.setCounters(`<span class="chip">🐚 ${this.served}/${NEED_ZAMB}</span>`);
    } else {
      h.setObjective('Madrid → San Vicente → Logroño');
      h.setCounters(`<span class="chip">📸 ${this.photos}</span>`);
    }
  }

  private updateRoute() {
    let k = 0;
    const leg1 = this.legStart === 0;
    if (this.phase === 'drive1' || this.phase === 'intro' || this.phase === 'marcial' || this.phase === 'camp' || (this.phase === 'cow' && leg1)) k = (this.dist / LEG1) * 0.55;
    else if (this.phase === 'arriveSV' || this.phase === 'grill' || this.phase === 'zambDone') k = 0.55;
    else if (this.phase === 'drive2' || this.phase === 'cow') k = 0.55 + (this.dist / LEG2) * 0.45;
    else k = 1;
    k = Math.max(0, Math.min(1, k));
    const pct = `${(k * 100).toFixed(1)}%`;
    this.routeCar.style.left = pct;
    (this.route.firstElementChild!.firstElementChild as HTMLElement).style.width = pct;
    this.route.classList.toggle('turbo', this.turboT > 0);
  }

  private reset(z: number) {
    this.carZ = z;
    this.things.forEach((t) => this.scene.remove(t.obj));
    this.things = [];
    this.nextSpawn = z + 60;
    while (this.cowIdx < COW_Z.length && COW_Z[this.cowIdx] < z + COW_BRAKE) this.cowIdx++;
    this.dropCow();
    for (const s of this.scatters) s.reset(z, this.regionAt);
  }

  private spawnRow() {
    const z = this.nextSpawn;
    const reg = this.regionAt(z);
    const end = this.phase === 'drive1' ? LEG1 - 60 : this.legStart + LEG2 - 60;
    if (z > end) return;
    if (!this.marcialDone && Math.abs(z - MARCIAL_Z) < 25) {
      this.nextSpawn += 30;
      return;
    }
    // Nada delante de una vaca: el tramo es para frenar y saludarla
    if (COW_Z.some((c) => Math.abs(z - c) < 48)) {
      this.nextSpawn += 30;
      return;
    }
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    // Una o dos fotos y, a veces, un obstáculo (nunca bloquea los tres carriles)
    const obstacle = Math.random() < 0.7;
    if (obstacle) {
      const defs = this.obstacleGeos[reg];
      const d = defs[Math.floor(Math.random() * defs.length)];
      const o = new THREE.Mesh(d.geo, vertexMat());
      o.castShadow = true;
      addOutline(o, 0.03);
      o.position.set(LANES[lanes[0]], 0, z);
      this.scene.add(o);
      this.things.push({ obj: o, kind: 'obstacle', lane: lanes[0], z, speed: d.speed, alive: true });
    }
    const np = Math.random() < 0.5 ? 2 : 1;
    for (let k = 0; k < np; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.photoTex, transparent: true }));
      s.scale.setScalar(1.4);
      const pz = z + (k ? 6 : 0);
      s.position.set(LANES[lanes[1 + (k % 2)]], 1.2, pz);
      this.scene.add(s);
      this.things.push({ obj: s, kind: 'photo', lane: lanes[1 + (k % 2)], z: pz, speed: 0, alive: true });
    }
    // De vez en cuando, gasolina para el turbo o un paquete de tabaco (que Gas confisca)
    const extra = Math.random();
    if (extra < 0.16 || extra > 0.9) {
      const turbo = extra < 0.16;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: turbo ? this.turboTex : this.smokeTex, transparent: true }));
      s.scale.setScalar(turbo ? 1.6 : 1.3);
      const lane = obstacle ? lanes[1 + Math.floor(Math.random() * 2)] : lanes[0];
      const pz = z + 13;
      s.position.set(LANES[lane], 1.2, pz);
      this.scene.add(s);
      this.things.push({ obj: s, kind: turbo ? 'turbo' : 'smoke', lane, z: pz, speed: 0, alive: true });
    }
    this.nextSpawn += 22 + Math.random() * 14;
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === 'camp' && this.camp) {
      const before = this.camp.inside;
      this.camp.update(dt, this.camera, this.busy ? null : this.input, this.hud);
      if (this.camp.inside && !before) this.campInside();
      return;
    }
    if (this.phase === 'logrono' && this.laurel) {
      this.laurel.update(dt, this.camera);
      return;
    }
    if (this.phase === 'terrace' && this.terrace) {
      this.terrace.update(dt, this.camera);
      const can = this.phase === 'terrace' && !this.eating && !this.busy;
      this.hud.setAction(can ? '🍽️ Comerse una zamburiña' : null, can);
      if (this.input.consumeAction() && can) this.eatZamburina();
      return;
    }
    this.fx.update(dt);
    const drive = this.phase === 'drive1' || this.phase === 'drive2';

    // Volante: joystick/teclado con detección de flanco
    const ax = this.input.axes().x;
    if (drive) {
      if (ax > 0.5 && this.prevAx <= 0.5) this.steer(1);
      if (ax < -0.5 && this.prevAx >= -0.5) this.steer(-1);
    }
    this.prevAx = ax;
    const acted = this.input.consumeAction();
    this.input.consumeCam();

    // Velocidad
    this.turboT -= dt;
    const turbo = drive && this.turboT > 0 && this.hitT <= 0;
    const target = drive ? (this.hitT > 0 ? MAX_SPEED * 0.4 : MAX_SPEED * (turbo ? TURBO : 1)) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (drive ? (turbo ? 2.5 : 1.2) : 2.5));
    this.hitT -= dt;
    if (drive) this.driveTime += dt;
    // Sensación de velocidad: el plano se abre con el turbo
    const fov = (this.camera.userData.baseFov ?? this.baseFov) + Math.max(0, this.speed - MAX_SPEED) * 0.9;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
    if (turbo && Math.random() < dt * 20) this.fx.burst(this.car.root.position.clone().setY(0.3).setZ(this.carZ - 2), 'dust', 1, 0.8, 0.2);
    this.carZ += this.speed * dt;
    if (drive) this.dist = this.carZ - this.legStart;
    // Cambio de carril con volante y masa: el coche se desplaza con un muelle, no de golpe
    const prevVX = this.carVX;
    [this.carX, this.carVX] = spring(this.carX, this.carVX, LANES[this.lane], 9, dt);
    const latAccel = dt > 0 ? (this.carVX - prevVX) / dt : 0;

    const car = this.car;
    car.root.position.set(this.carX, 0, this.carZ);
    // El morro apunta hacia donde va el coche
    car.root.rotation.y = Math.atan2(this.carVX, Math.max(this.speed, 3));
    if (!this.rig) this.rig = new CarRig(car);
    this.rig.update(dt, this.speed, latAccel);
    if (this.hitT > 0) car.body.rotation.z += Math.sin(this.t * 30) * 0.05 * Math.min(1, this.hitT * 2);

    // Mundo que sigue al coche
    this.ground.position.z = this.carZ;
    this.groundTex.offset.y = -this.carZ / 20;
    this.road.position.z = this.carZ + 100;
    this.roadTex.offset.y = (this.carZ + 100) / 8;
    this.sea.position.z = this.carZ;
    this.sun.follow(this.car.root.position);
    for (const s of this.scatters) s.update(this.carZ, this.regionAt);

    // Región: colores de cielo, suelo y niebla
    const reg = this.regionAt(this.carZ + 30);
    if (reg !== this.region) {
      this.region = reg;
      if (drive) toast(ROAD.regions[reg]);
    }
    const st = REGION_STYLE[this.region];
    const k = Math.min(1, dt * 0.8);
    this.sky.lerp(this.tmpColor.set(st.sky), k);
    this.skyTop.lerp(this.tmpColor.set(st.top), k);
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) {
      this.skyTimer = 0.15;
      this.skyDome.setColors(this.skyTop.getHex(), this.sky.getHex(), (this.scene.fog as THREE.Fog).color.getHex());
    }
    (this.scene.fog as THREE.Fog).color.lerp(this.tmpColor.set(st.fog), k);
    (this.ground.material as THREE.MeshToonMaterial).color.lerp(this.tmpColor.set(st.ground), k);
    this.sea.visible = this.region === 'cantabria';
    // Hierba seca o verde en casi todo el viaje; tierra roja de viñedo en La Rioja
    const gs = this.ground.geometry.attributes.surf as THREE.BufferAttribute;
    const want = this.region === 'rioja' ? Surf.Sand : Surf.Grass;
    if (gs.getX(0) !== want) {
      (gs.array as Float32Array).fill(want);
      gs.needsUpdate = true;
    }

    // Fotos y obstáculos
    if (drive) {
      while (this.nextSpawn < this.carZ + 160) {
        const before = this.nextSpawn;
        this.spawnRow();
        if (this.nextSpawn === before) break;
      }
    }
    for (const th of this.things) {
      if (!th.alive) continue;
      // Parados nosotros, para todo: nadie atraviesa el coche ni el pueblo
      if (drive) th.z += th.speed * dt;
      // El tráfico se queda antes de entrar en San Vicente y en Logroño
      if (th.speed > 0 && (th.z > LEG1 - 45 && th.z < LEG1 + 60 || th.z > LEG1 + 40 + LEG2 - 30)) {
        th.alive = false;
        this.scene.remove(th.obj);
        continue;
      }
      th.obj.position.z = th.z;
      if (th.kind === 'photo') {
        th.obj.position.y = 1.2 + Math.sin(this.t * 4 + th.z) * 0.15;
      }
      const dz = Math.abs(th.z - this.carZ);
      const dx = Math.abs(LANES[th.lane] - this.carX);
      const pickup = th.kind !== 'obstacle';
      if (drive && dz < (pickup ? 2.2 : 3.4) && dx < 1.5) {
        th.alive = false;
        this.scene.remove(th.obj);
        const at = this.car.root.position.clone().setY(2);
        if (th.kind === 'photo') {
          this.photos++;
          this.combo++;
          audio.pickup();
          this.fx.burst(at, '✨', 4, 1.5);
          if (this.combo % 5 === 0) {
            toast(ROAD.combo(this.combo));
            audio.fanfare();
            this.fx.burst(at, '📸', 5, 1.8);
          }
        } else if (th.kind === 'turbo') {
          this.turboT = 3;
          audio.whoosh();
          audio.perfect();
          vibrate(30);
          toast(ROAD.turbo);
          this.fx.burst(at, '⚡', 6, 2);
        } else if (th.kind === 'smoke') {
          this.photos = Math.max(0, this.photos - 1);
          audio.boo();
          toast(ROAD.smoke[Math.floor(Math.random() * ROAD.smoke.length)]);
          this.fx.burst(at, '💨', 5, 1.5);
        } else if (this.hitT <= 0) {
          this.hitT = 1.2;
          this.turboT = 0;
          this.hits++;
          this.combo = 0;
          this.shakeT = 0.45;
          this.photos = Math.max(0, this.photos - 2);
          audio.hit();
          audio.boo();
          vibrate(120);
          this.fx.burst(at, '💥', 4, 1.6);
          toast(ROAD.hit[Math.floor(Math.random() * ROAD.hit.length)]);
        }
        this.updateHud();
      } else if (drive && th.kind === 'obstacle' && !th.passed && th.z < this.carZ - 2.5) {
        th.passed = true;
        // Adelantamiento ajustado por el carril de al lado
        if (dx < 3.2 && this.hitT <= 0 && this.t - this.steerT < 0.8) {
          this.nearMisses++;
          this.photos++;
          audio.whoosh();
          toast(ROAD.nearMiss);
          this.updateHud();
        }
      }
      if (th.z < this.carZ - 20) {
        th.alive = false;
        this.scene.remove(th.obj);
      }
    }
    this.things = this.things.filter((t) => t.alive);

    // Llegadas
    if (this.phase === 'drive1' && this.dist >= LEG1 - 25) this.arriveSV();
    if (this.phase === 'drive2' && this.dist >= LEG2) this.arriveLogrono();
    if (drive && Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.updateHud();

    if (this.phase === 'drive1' && !this.marcialDone) this.updateEateries(acted);
    if (this.phase === 'drive1' && this.marcialDone && !this.campDone && this.carZ >= CAMP_Z) this.arriveCamp();
    this.updateCows(dt, acted);
    if (this.phase === 'grill' || this.phase === 'zambDone') this.updateGrill(dt);
    this.updateRoute();
    this.updateCamera(dt);
    this.skyDome.update(this.camera, dt);
  }

  private arriveSV() {
    this.things.forEach((t) => this.scene.remove(t.obj));
    this.things = [];
    this.phase = 'arriveSV';
    this.lane = 1;
    this.updateHud();
    audio.chime(2);
    later(() => {
      dialogue(ROAD.arriveSV, () => this.startGrill());
    }, 1200);
  }

  private startGrill() {
    this.phase = 'grill';
    // Las matas y piedras de la cuneta se quedan en la carretera: aquí salían debajo de la plancha
    for (const sc of this.scatters) sc.mesh.visible = false;
    const g = this.grill.position;
    this.camera.position.set(g.x - 0.14, 1.72, g.z - 0.72);
    this.served = 0;
    this.scallops.forEach((s, i) => {
      s.p = 0;
      s.wait = i * 0.5;
    });
    this.input.enabled = false;
    window.addEventListener('pointerdown', this.onTap);
    this.updateHud();
  }

  private tapGrill(e: PointerEvent) {
    if (this.phase !== 'grill') return;
    if ((e.target as HTMLElement).closest('button, .dialogue')) return;
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scallops.map((s) => s.root), true);
    let s = hits.length ? this.scallops.find((sc) => hits[0].object.parent === sc.root) : undefined;
    if (!s) {
      // Con el dedo es fácil tocar el borde de la concha: vale la zamburiña más cercana en pantalla
      let best = (Math.min(window.innerWidth, window.innerHeight) * 0.09) ** 2;
      for (const sc of this.scallops) {
        const v = sc.root.getWorldPosition(new THREE.Vector3()).project(this.camera);
        const dx = ((v.x + 1) / 2) * window.innerWidth - e.clientX;
        const dy = ((1 - v.y) / 2) * window.innerHeight - e.clientY;
        if (dx * dx + dy * dy < best) {
          best = dx * dx + dy * dy;
          s = sc;
        }
      }
    }
    if (!s || s.wait > 0) return;
    if (s.p >= 0.62 && s.p <= 1) {
      this.served++;
      audio.pickup();
      toast(ROAD.zamb.served);
      s.p = 0;
      s.wait = 0.6;
      s.speed = 0.18 + Math.random() * 0.12;
      this.updateHud();
      if (this.served >= NEED_ZAMB) this.finishGrill();
    } else if (s.p < 0.62) {
      toast(ROAD.zamb.raw);
    }
  }

  private finishGrill() {
    this.phase = 'zambDone';
    window.removeEventListener('pointerdown', this.onTap);
    this.input.enabled = true;
    this.updateHud();
    later(() => this.sitOnTerrace(), 600);
  }

  private startDrive2() {
    for (const sc of this.scatters) sc.mesh.visible = true;
    this.legStart = LEG1 + 40;
    this.reset(this.legStart);
    this.buildLogrono(this.legStart + LEG2 + 60);
    this.dist = 0;
    this.speed = 0;
    this.lane = 1;
    this.carX = 0;
    this.carVX = 0;
    this.phase = 'drive2';
    // La cámara salta detrás del coche (si no, vuela cientos de metros desde la terraza)
    this.camera.position.set(0, 4.6, this.carZ - 8.5);
    this.updateHud();
  }

  /** Logroño al final: el Ebro con el Puente de Piedra y las dos torres barrocas de La Redonda. */
  private buildLogrono(z: number) {
    if (this.logronoTown) this.scene.remove(this.logronoTown);
    const m = new Merger();
    m.add(G.box, 0x4f7f8f, 0, 0.03, z, 0, 0, 0, 260, 0.05, 26); // el Ebro
    for (let i = -6; i <= 6; i++) {
      if (Math.abs(i) < 1) continue;
      m.add(G.box, 0xc9b48c, i * 9, 1.8, z, 0, 0, 0, 2, 3.6, 4);
      m.add(new THREE.CylinderGeometry(3.6, 3.6, 3.8, 18, 1, false, 0, Math.PI), 0xc9b48c, i * 9 + 4.5, 2.2, z, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1);
    }
    m.add(G.box, 0xc9b48c, 0, 4.4, z, 0, 0, 0, 120, 0.8, 9);
    for (let i = 0; i < 18; i++) {
      const x = -60 + i * 7 + (i % 3);
      const h = 9 + (i * 7) % 11;
      m.add(G.box, [0xe8dcc0, 0xd8b88a, 0xf0e6d2, 0xc89a6a][i % 4], x, h / 2, z + 26 + (i % 2) * 6, 0, 0, 0, 6, h, 8);
      m.add(G.box, 0xa9573a, x, h + 0.3, z + 26 + (i % 2) * 6, 0, 0, 0, 6.2, 0.6, 8.2);
    }
    // Concatedral de Santa María de la Redonda: dos torres gemelas con chapitel
    for (const sx of [-5, 5]) {
      m.add(G.box, 0xd2b07a, sx + 12, 11, z + 40, 0, 0, 0, 4.4, 22, 4.4);
      m.add(G.box, 0xc29c66, sx + 12, 23.5, z + 40, 0, 0, 0, 3.6, 3, 3.6);
      m.add(G.cyl, 0xc29c66, sx + 12, 26.6, z + 40, 0, 0, 0, 3, 3.2, 3);
      m.add(G.cone, 0x5a5a60, sx + 12, 30, z + 40, 0, 0, 0, 2.6, 3.6, 2.6);
    }
    m.add(G.box, 0xd2b07a, 12, 8, z + 46, 0, 0, 0, 14, 16, 16);
    this.logronoTown = m.mesh();
    this.scene.add(this.logronoTown);
  }

  /** La vaca que toca, en mitad de la calzada; al acercarse, frenar y saludarla. */
  private updateCows(dt: number, acted: boolean) {
    const rc = this.roadCow;
    if (rc) {
      if (this.cowLeaving) {
        rc.root.position.x += dt * 1.7;
        rc.update(this.t, 1);
        if (rc.root.position.x > 11) this.dropCow();
      } else rc.update(this.t, 0);
    }
    if (this.phase !== 'drive1' && this.phase !== 'drive2') return;
    const z = COW_Z[this.cowIdx];
    if (z === undefined || (this.phase === 'drive1' && z > LEG1)) return;
    const d = z - this.carZ;
    if (d > 180) return;
    if (!this.roadCow) {
      this.cowLeaving = false;
      this.roadCow = makeRoadCow(this.cowIdx % 2 ? 'tudanca' : 'frisona');
      this.roadCow.root.position.set(-1, 0, z);
      this.roadCow.root.rotation.y = Math.PI / 2; // de través
      this.scene.add(this.roadCow.root);
    }
    if (d < COW_BRAKE) {
      toast(ROAD.cowMissed);
      this.photos = Math.max(0, this.photos - 1);
      audio.boo();
      this.stopForCow();
    } else if (d < COW_NEAR) {
      this.hud.setAction(ROAD.cowBtn, true);
      if (acted) this.stopForCow();
    }
  }

  private dropCow() {
    if (this.roadCow) this.scene.remove(this.roadCow.root);
    this.roadCow = null;
    this.cowLeaving = false;
  }

  private stopForCow() {
    this.cowFrom = this.phase;
    this.phase = 'cow';
    this.lane = 1;
    this.turboT = 0;
    this.speed = Math.min(this.speed, MAX_SPEED);
    this.hud.setAction(null);
    this.showLaneButtons(false);
    const lines = ROAD.cows[this.cowIdx % ROAD.cows.length];
    this.cowIdx++;
    later(
      () =>
        dialogue(lines, () => {
          this.cowLeaving = true;
          later(() => {
            if (this.phase !== 'cow') return;
            this.phase = this.cowFrom;
            this.updateHud();
          }, 1400);
        }),
      1500,
    );
  }

  /**
   * Nace Gas: esa noche iba a ser cenita de camping (estrellas, cartas y el camping gas) y a él se le
   * olvidó precisamente el gas. Escena de cine: plano general de la mesa bajo las estrellas, el hornillo
   * que no enciende, los dos, y el nombre. A la mañana siguiente, carretera otra vez.
   */
  private arriveCamp() {
    this.campDone = true;
    this.phase = 'camp';
    this.busy = true;
    this.updateHud();
    audio.chime(2);
    const [night] = ROAD.camp;
    later(() =>
      fadeFlash(() => {
        if (!this.camp) {
          this.camp = new Camp();
          applyShadows(this.camp.scene);
        }
        this.laneBtns.forEach((b) => (b.hidden = true));
        this.route.style.display = 'none';
        audio.stopMusic();
        audio.startMusic('night');
        this.camp.startWalk(this.camera);
        this.input.reset();
        this.hud.setObjective('Entra en la cabaña de leña');
        this.hud.setCounters('');
        dialogue([night], () => {
          this.busy = false;
        });
      }, 500),
    1200);
  }

  /** Ya dentro de la cabaña: se sientan a la mesa y el hornillo no enciende. */
  private campInside() {
    const c = this.camp!;
    const [, noGas] = ROAD.camp;
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    fadeFlash(() => {
      c.sitDown();
      this.hud.setObjective('');
      const mid = () => c.table.clone().setY(1.05);
      cinema.play([
        // El hornillo: clic, clic, clic… y nada
        { dur: Infinity, move: 4, pos: new THREE.Vector3(0.14, 1.22, -1.05), pos2: new THREE.Vector3(0.13, 1.02, -0.55), look: c.stove, fov: 40, focus: c.stove, at: () => c.tryStove() },
        // Los dos, frente a frente
        { dur: Infinity, move: 6, pos: new THREE.Vector3(0.1, 1.4, -2.4), pos2: new THREE.Vector3(0.05, 1.3, -1.9), look: mid, fov: 46, focus: mid },
      ]);
      later(() =>
        dialogue([noGas], () => {
          cinema.next();
          audio.fanfare();
          // Lo que le escribió ella después: «por nuestro intento fallido de camping gas»
          cineTitle('GAS', '«por nuestro intento fallido de camping gas»', 3.6);
          later(
            () =>
              dialogue(ROAD.campAfter, () =>
                fadeFlash(() => {
                  cinema.stop();
                  audio.stopMusic();
                  audio.startMusic('road');
                  this.route.style.display = '';
                  this.busy = false;
                  this.speed = 0;
                  this.phase = 'drive1';
                  this.camera.position.set(this.carX * 0.5, 4.6, this.carZ - 8.5);
                  this.nextSpawn = this.carZ + 60;
                  this.updateHud();
                }, 500),
              ),
            3800,
          );
        }),
      900);
    }, 500);
  }

  /** Logroño, de fiesta. Y al acabar, la vuelta en tren y el nombre: los chats de esos días. */
  private arriveLogrono() {
    this.phase = 'logrono';
    this.busy = true;
    this.updateHud();
    audio.chime(2);
    later(() =>
      fadeFlash(() => {
        if (!this.laurel) {
          this.laurel = new Laurel();
          applyShadows(this.laurel.scene);
        }
        const l = this.laurel;
        this.laneBtns.forEach((b) => (b.hidden = true));
        this.route.style.display = 'none';
        audio.stopMusic();
        audio.startMusic('jaleo');
        cinema.play([
          { dur: Infinity, move: 7, pos: new THREE.Vector3(0.6, 2.6, -15), pos2: new THREE.Vector3(0.4, 1.9, -6), look: new THREE.Vector3(0, 1.5, 4), look2: l.mid },
          { dur: Infinity, move: 7, pos: new THREE.Vector3(-1.9, 1.5, -2.4), pos2: new THREE.Vector3(-2.3, 1.55, 1.6), look: l.mid, fov: 44, focus: l.mid },
        ]);
        later(() =>
          dialogue(ROAD.arriveLogrono, () => {
            cinema.next();
            later(() =>
              dialogue(ROAD.logronoEnd, () => {
                cinema.stop();
                audio.stopMusic();
                // Solo el nacimiento del mote: el resto de chats de esos días va al álbum
                phoneChat([CHATS.porQueGas, CHATS.tuNombre], () => dialogue(ROAD.named, () => this.finish()));
              }),
            4200);
          }),
        1200);
      }, 500),
    1200);
  }

  /** En San Vicente: sentados en la terraza de El Ancla comiéndose una zamburiña. */
  private sitOnTerrace() {
    fadeFlash(() => {
      if (!this.terrace) {
        this.terrace = new Terrace();
        applyShadows(this.terrace.scene);
      }
      this.phase = 'terrace';
      this.eating = false;
      this.route.style.display = 'none';
      this.input.enabled = true;
      this.terrace.frame(this.camera);
      this.camera.fov = (this.camera.userData.baseFov ?? this.baseFov);
      this.camera.updateProjectionMatrix();
      this.updateHud();
      this.busy = true;
      dialogue(ROAD.terrace, () => (this.busy = false));
    }, 500);
  }

  /**
   * La zamburiña, como sus ojos en Ferreries: el tiempo casi se para. Por encima del hombro de Gas,
   * ella la coge; la zamburiña de cerca, camino de la boca; su cara mientras la prueba, con su frase;
   * y el contraplano de él.
   */
  private eatZamburina() {
    const t = this.terrace;
    if (!t) return;
    this.eating = true;
    this.hud.setAction(null);
    this.input.reset();
    t.eat();
    const az = () => headOf(t.azul);
    const gz = () => headOf(t.gas);
    const zb = () => t.bitePos();
    cinema.play([
      { dur: 2.2, slow: 0.34, pos: () => rel(gz(), az(), 0.85, 0.32, 0.06), pos2: () => rel(gz(), az(), 0.62, 0.26, 0.02), look: az, focus: az, at: () => audio.whoosh() },
      { dur: 2.8, slow: 0.13, pos: () => rel(zb(), gz(), -0.42, 0.12, 0.2), pos2: () => rel(zb(), gz(), -0.28, 0.08, 0.14), look: zb, fov: 38, fov2: 30, focus: zb, at: () => audio.chime(1) },
      { dur: Infinity, slow: 0.13, move: 3.4, pos: () => rel(az(), gz(), -1.05, 0.12, 0.0), pos2: () => rel(az(), gz(), -0.52, 0.06, -0.02), look: az, fov: 45, fov2: 32, focus: az, at: () => audio.chime(2) },
      { dur: Infinity, slow: 0.25, move: 3, pos: () => rel(gz(), az(), -0.95, -0.2, 0.0), pos2: () => rel(gz(), az(), -0.72, -0.18, 0.0), look: gz, fov: 40, focus: gz },
    ]);
    later(() =>
      dialogue(ROAD.zambEpic, () => {
        cinema.next();
        later(() =>
          dialogue(ROAD.zambDone, () =>
            fadeFlash(() => {
              cinema.stop();
              this.route.style.display = '';
              this.startDrive2();
            }, 400),
          ),
        1100);
      }),
    6600);
  }

  /** Restaurante de carretera con su cartel. */
  private buildEatery(name: string, isM: boolean) {
    const g = new THREE.Group();
    const wall = isM ? 0xf2e6c8 : [0xe8d9c0, 0xd9cfc0, 0xf0e2c8][name.length % 3];
    g.add(
      new Merger()
        .add(G.box, wall, 16, 2.4, 0, 0, 0, 0, 8, 4.8, 10)
        .add(G.box, 0xa9573a, 16, 5.0, 0, 0, 0, 0, 8.6, 0.4, 10.6)
        .add(G.box, 0x7a8fa6, 11.98, 1.8, -2, 0, 0, 0, 0.05, 1.6, 2.4)
        .add(G.box, 0x7a8fa6, 11.98, 1.8, 2.2, 0, 0, 0, 0.05, 1.6, 2.4)
        .add(G.box, 0x6b4428, 11.98, 1.3, 0, 0, 0, 0, 0.06, 2.6, 1.2)
        .add(G.box, isM ? 0xc0392b : 0x2f6b46, 11.4, 3.2, 0, 0, 0, 0, 1.2, 0.14, 8) // toldo
        .add(G.box, 0x9a9a9a, 9, 0.03, 0, 0, 0, 0, 6, 0.05, 12) // aparcamiento
        .mesh(),
    );
    const sign = makeSign(isM ? ['CAFETERÍA', 'MARCIAL'] : name.split(' ').length > 2 ? [name.split(' ')[0], name.split(' ').slice(1).join(' ')] : [name], isM ? '#b8322a' : '#5a4632');
    sign.position.set(6.2, 0, -6);
    g.add(sign);
    return g;
  }

  /** Avisa de cada restaurante de carretera y para en el primero que empieza por M. */
  private updateEateries(acted: boolean) {
    const near = EATERIES.find((e) => e.z - this.carZ < 55 && e.z - this.carZ > -4);
    if (near && !this.eateryTried.has(near.name)) {
      this.hud.setAction(`🍴 ¡Parar en ${near.name}!`, !!near.m);
      if (acted) {
        this.eateryTried.add(near.name);
        if (near.m) this.stopMarcial();
        else {
          audio.boo();
          toast(ROAD.notM(near.name));
          this.hud.setAction(null);
        }
      }
    } else this.hud.setAction(null);
    // Si se pasa de largo, Gas frena igualmente: es la primera con M
    if (!this.marcialDone && this.carZ > MARCIAL_Z + 6) {
      toast(ROAD.missedM);
      this.stopMarcial();
    }
  }

  private stopMarcial() {
    this.marcialDone = true;
    this.phase = 'marcial';
    this.hud.setAction(null);
    this.showLaneButtons(false);
    this.lane = 0;
    audio.fanfare();
    this.things.forEach((t) => this.scene.remove(t.obj));
    this.things = [];
    later(
      () =>
        dialogue(ROAD.marcial, () => {
          this.nextSpawn = this.carZ + 70;
          this.phase = 'drive1';
          this.updateHud();
        }),
      1400,
    );
  }

  private finish() {
    cinema.stop();
    this.phase = 'done';
    const stars = 1 + (this.photos >= 30 ? 1 : 0) + (this.hits <= 2 && this.burnt <= 1 ? 1 : 0);
    this.onComplete({
      stars,
      stats: [
        ['Fotos del viaje', `${this.photos} 📸`],
        ['Choques', `${this.hits}`],
        ['Zamburiñas quemadas', `${this.burnt}`],
        ['Al volante', clock(this.driveTime)],
      ],
    });
  }

  private updateGrill(dt: number) {
    const raw = new THREE.Color(0xf6efe2);
    const gold = new THREE.Color(0xe6bb80); // dorada por fuera, no amarilla
    const burnt = new THREE.Color(0x2e2018);
    for (const s of this.scallops) {
      if (s.wait > 0) {
        s.wait -= dt;
        s.root.visible = s.wait < 0.3 || this.phase !== 'grill';
        continue;
      }
      s.root.visible = true;
      if (this.phase === 'grill') s.p += s.speed * dt;
      const c = (s.meat.material as THREE.MeshLambertMaterial).color;
      if (s.p < 0.62) c.copy(raw).lerp(gold, s.p / 0.62 * 0.6);
      else if (s.p <= 1) c.copy(gold);
      else c.copy(gold).lerp(burnt, Math.min(1, (s.p - 1) * 4));
      // Brilla cuando está en su punto
      s.root.scale.setScalar(s.p >= 0.62 && s.p <= 1 ? 1 + Math.sin(this.t * 12) * 0.05 : 1);
      if (s.p > 1.35) {
        audio.boo();
        this.burnt++;
        toast(ROAD.zamb.burnt);
        s.p = 0;
        s.wait = 0.8;
      }
    }
  }

  private updateCamera(dt: number) {
    if (this.phase === 'grill' || this.phase === 'zambDone') {
      const g = this.grill.position;
      this.camTarget.set(g.x - 0.14, 1.72, g.z - 0.72);
      this.camLook.set(g.x - 0.14, 0.94, g.z + 0.02);
    } else if (this.phase === 'arriveSV' || this.phase === 'logrono') {
      this.camTarget.set(this.carX - 6, 4, this.carZ - 7);
      this.camLook.set(this.carX + 2, 2, this.carZ + 14);
    } else {
      this.camTarget.set(this.carX * 0.5, 4.6, this.carZ - 8.5);
      this.camLook.set(this.carX * 0.6, 1.2, this.carZ + 10);
    }
    this.camera.position.lerp(this.camTarget, 1 - Math.exp(-dt * 4));
    this.camera.lookAt(this.camLook);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shakeT * 0.6;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeT * 0.6;
    }
  }

  debug(): DebugItem[] {
    const clean = () => {
      for (const sc of this.scatters) sc.mesh.visible = true;
      cinema.stop();
      this.route.style.display = '';
      this.eating = false;
      this.busy = false;
      this.dropCow();
      window.removeEventListener('pointerdown', this.onTap);
      this.input.enabled = true;
    };
    return [
      {
        label: '1 · Salir de Madrid',
        run: () => {
          clean();
          this.legStart = 0;
          this.reset(0);
          this.speed = 0;
          this.photos = 0;
          this.phase = 'drive1';
          this.updateHud();
        },
      },
      {
        label: '1b · Cafetería Marcial',
        run: () => {
          clean();
          this.legStart = 0;
          this.marcialDone = false;
          this.campDone = false;
          this.cowIdx = 0;
          this.eateryTried.clear();
          this.reset(MARCIAL_Z - 120);
          this.phase = 'drive1';
          this.updateHud();
        },
      },
      {
        label: '1c · La noche del camping',
        run: () => {
          clean();
          this.legStart = 0;
          this.marcialDone = true;
          this.campDone = false;
          this.cowIdx = 0;
          this.reset(CAMP_Z - 60);
          this.phase = 'drive1';
          this.updateHud();
        },
      },
      {
        label: '2 · Entrar en Cantabria',
        run: () => {
          clean();
          this.legStart = 0;
          this.marcialDone = this.campDone = true;
          this.cowIdx = 0;
          this.reset(1000);
          this.phase = 'drive1';
          this.updateHud();
        },
      },
      {
        label: '3 · Llegar a San Vicente',
        run: () => {
          clean();
          this.marcialDone = this.campDone = true;
          this.reset(LEG1 - 60);
          this.legStart = 0;
          this.phase = 'drive1';
          this.updateHud();
        },
      },
      {
        label: '4 · Plancha de zamburiñas',
        run: () => {
          clean();
          this.reset(LEG1 - 25);
          this.speed = 0;
          this.startGrill();
        },
      },
      { label: '4b · Terraza de El Ancla', run: () => { clean(); this.sitOnTerrace(); } },
      { label: '5 · Camino de Logroño', run: () => { clean(); this.startDrive2(); } },
      {
        label: '6 · Llegar a Logroño',
        run: () => {
          clean();
          this.startDrive2();
          this.reset(this.legStart + LEG2 - 50);
        },
      },
      { label: '✓ Completar capítulo', run: () => { clean(); this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onTap);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    this.input.enabled = true;
    this.hud.remove();
    this.route.remove();
    this.camera.fov = (this.camera.userData.baseFov ?? this.baseFov);
    this.camera.updateProjectionMatrix();
    this.laneBtns.forEach((b) => b.remove());
    audio.stopMusic();
    disposeScene(this.scene);
    if (this.terrace) disposeScene(this.terrace.scene);
    if (this.camp) disposeScene(this.camp.scene);
    if (this.laurel) disposeScene(this.laurel.scene);
  }
}
