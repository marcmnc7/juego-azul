import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { ROAD } from '../data/story';
import { G, Merger, makeCar, makeScallop, vertexMat } from '../entities/models';
import { Sky, Sun, toon, vibrate, addOutline, applyShadows } from '../core/gfx';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, fadeFlash, Hud, DebugItem } from '../ui/ui';
import { Terrace } from './terrace';
import { clock, type Level, type LevelDone } from './level';

// Capítulo 2 · La ruta de las zamburiñas.
// Carretera Madrid → San Vicente de la Barquera (recoger fotos, esquivar) → plancha de zamburiñas
// → carretera entre viñedos → Logroño.

type Phase = 'intro' | 'drive1' | 'arriveSV' | 'grill' | 'zambDone' | 'drive2' | 'logrono' | 'terrace' | 'done';
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
  rioja: { ground: 0x9a7a4a, fog: 0xf6c9a0, sky: 0xf2a77d, top: 0x5a4a9a },
};
const TURBO = 1.45;

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
    this.mesh = new THREE.InstancedMesh(geo, vertexMat, count);
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
  private eating = false;
  private busy = false;
  private hud: Hud;
  private fx: Particles;
  private phase: Phase = 'intro';
  private car = makeCar(0xd7263d);
  private carZ = 0;
  private carX = 0;
  private lane = 1;
  private speed = 0;
  private hitT = 0;
  private photos = 0;
  private t = 0;
  private dist = 0; // metros recorridos en el tramo actual
  private legStart = 0;
  private region: Region = 'madrid';
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

    this.groundTex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const v = 200 + Math.random() * 55;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 6, 6);
      }
    });
    this.groundTex.wrapS = this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.repeat.set(20, 20);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), toon({ map: this.groundTex, color: REGION_STYLE.madrid.ground }));
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

    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 400).rotateX(-Math.PI / 2), toon({ color: 0x2f7fb5 }));
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
    setTimeout(() => {
      if (this.phase !== 'intro') return;
      dialogue(ROAD.intro, () => {
        this.phase = 'drive1';
        this.updateHud();
      });
    }, 500);
  }

  get threeScene() {
    return this.terrace && this.phase === 'terrace' ? this.terrace.scene : this.scene;
  }

  private regionAt = (z: number): Region => {
    if (z > LEG1 + 40) return 'rioja';
    if (z > 1000) return 'cantabria';
    if (z > 420) return 'meseta';
    return 'madrid';
  };

  private buildScatters() {
    const building = new Merger()
      .add(G.box, 0xd9cfc0, 0, 6, 0, 0, 0, 0, 6, 12, 6)
      .add(G.box, 0x7a8fa6, 0, 6, 3.01, 0, 0, 0, 5, 10, 0.05)
      .add(G.box, 0xb5603b, 0, 12.2, 0, 0, 0, 0, 6.2, 0.4, 6.2)
      .build();
    const brick = new Merger()
      .add(G.box, 0xb36a4a, 0, 4, 0, 0, 0, 0, 7, 8, 5)
      .add(G.box, 0xe8e2d0, 0, 4, 2.51, 0, 0, 0, 6, 6, 0.05)
      .build();
    const pine = new Merger()
      .add(G.cyl, 0x6b4a30, 0, 1.5, 0, 0, 0, 0, 0.4, 3, 0.4)
      .add(G.sphere, 0x4f7a3a, 0, 4, 0, 0, 0, 0, 4, 2.2, 4)
      .build();
    const oak = new Merger()
      .add(G.cyl, 0x5a3e28, 0, 1.2, 0, 0, 0, 0, 0.5, 2.4, 0.5)
      .add(G.sphere, 0x3f7f35, 0, 3.6, 0, 0, 0, 0, 3.6, 3.2, 3.6)
      .add(G.sphere, 0x4a8f3f, 0.8, 4.4, 0.4, 0, 0, 0, 2.4, 2.2, 2.4)
      .build();
    const hay = new Merger().add(G.cyl, 0xe0c060, 0, 0.75, 0, 0, 0, Math.PI / 2, 1.5, 1.6, 1.5).build();
    const mill = new Merger()
      .add(G.cyl, 0xf2efe6, 0, 3, 0, 0, 0, 0, 2.4, 6, 2.4)
      .add(G.cone, 0x2b2b2b, 0, 6.8, 0, 0, Math.PI / 4, 0, 3.2, 1.8, 3.2)
      .add(G.box, 0x6b4428, 0, 4.8, 1.3, 0, 0, 0.6, 0.3, 7, 0.1)
      .add(G.box, 0x6b4428, 0, 4.8, 1.3, 0, 0, -0.95, 0.3, 7, 0.1)
      .build();
    const hill = new Merger().add(G.sphere, 0x4f8f3e, 0, 0, 0, 0, 0, 0, 30, 14, 26).build();
    const cow = new Merger()
      .add(G.box, 0xf4f1ea, 0, 1.1, 0, 0, 0, 0, 0.9, 0.9, 1.8)
      .add(G.box, 0x2a2420, 0.2, 1.25, 0.3, 0, 0, 0, 0.92, 0.5, 0.6)
      .add(G.box, 0xf4f1ea, 0, 1.4, 1.05, 0, 0, 0, 0.5, 0.5, 0.6)
      .add(G.box, 0xe9a3a3, 0, 1.25, 1.36, 0, 0, 0, 0.4, 0.25, 0.1)
      .add(G.cyl, 0x2a2420, -0.3, 0.35, 0.6, 0, 0, 0, 0.18, 0.7, 0.18)
      .add(G.cyl, 0x2a2420, 0.3, 0.35, 0.6, 0, 0, 0, 0.18, 0.7, 0.18)
      .add(G.cyl, 0xf4f1ea, -0.3, 0.35, -0.6, 0, 0, 0, 0.18, 0.7, 0.18)
      .add(G.cyl, 0xf4f1ea, 0.3, 0.35, -0.6, 0, 0, 0, 0.18, 0.7, 0.18)
      .build();
    const vines = new Merger();
    for (let i = 0; i < 5; i++) {
      vines.add(G.box, 0x4f7a2a, i * 2.2, 0.7, 0, 0, 0, 0, 0.7, 1.2, 9);
      vines.add(G.box, 0x6a3d7a, i * 2.2 + 0.3, 0.6, 0, 0, 0, 0, 0.2, 0.3, 8);
    }
    const vineGeo = vines.build();
    const bull = new Merger()
      .add(G.box, 0x111111, 0, 7, 0, 0, 0, 0, 0.2, 5, 11)
      .add(G.box, 0x111111, 0, 9.8, 5.2, 0, 0, 0, 0.2, 2.6, 2.6)
      .add(G.box, 0x111111, 0, 3, 3.5, 0, 0, 0, 0.2, 3.5, 1.2)
      .add(G.box, 0x111111, 0, 3, -3.8, 0, 0, 0, 0.2, 3.5, 1.2)
      .add(G.box, 0x111111, 0, 11.5, 5.5, 0, 0, 0.6, 0.2, 2.5, 0.4)
      .add(G.box, 0x111111, 0, 11.5, 5.5, 0, 0, 0, 0.2, 0.4, 2.8)
      .build();

    this.scatters = [
      new Scatter(building, 24, 9, ['madrid'], [10, 30], true, [0.8, 1.6]),
      new Scatter(brick, 16, 14, ['madrid'], [12, 40], true, [0.8, 1.3]),
      new Scatter(pine, 18, 12, ['madrid', 'meseta'], [8, 40], true, [0.7, 1.3]),
      new Scatter(hay, 20, 9, ['meseta'], [8, 50], true, [0.8, 1.2]),
      new Scatter(mill, 6, 45, ['meseta'], [25, 60], true, [1, 1.2]),
      new Scatter(bull, 1, 260, ['meseta'], [22, 24], false, [1, 1], false),
      new Scatter(hill, 10, 30, ['cantabria'], [40, 90], false, [0.7, 1.4]),
      new Scatter(oak, 22, 9, ['cantabria'], [8, 35], true, [0.8, 1.3]),
      new Scatter(cow, 10, 16, ['cantabria'], [-9, -30], false, [1, 1]),
      new Scatter(vineGeo, 24, 10, ['rioja'], [8, 30], true, [1, 1], false),
    ];
    for (const s of this.scatters) this.scene.add(s.mesh);
  }

  private buildObstacles(): Record<Region, { geo: THREE.BufferGeometry; speed: number }[]> {
    const cone = new Merger().add(G.cone, 0xff7a1a, 0, 0.45, 0, 0, Math.PI / 4, 0, 0.6, 0.9, 0.6).add(G.box, 0xffffff, 0, 0.45, 0, 0, 0, 0, 0.36, 0.12, 0.36).build();
    const otherCar = (c: number) =>
      new Merger().add(G.box, c, 0, 0.6, 0, 0, 0, 0, 1.8, 0.6, 3.8).add(G.box, c, 0, 1.12, -0.3, 0, 0, 0, 1.6, 0.5, 2).add(G.box, 0x9fd3e8, 0, 1.12, -0.3, 0, 0, 0, 1.62, 0.36, 1.8).add(G.box, 0x1a1a1a, 0, 0.32, 0, 0, 0, 0, 1.9, 0.5, 2.6).build();
    const tractor = new Merger()
      .add(G.box, 0x2f8f3a, 0, 1.1, 0.3, 0, 0, 0, 1.4, 1, 2)
      .add(G.box, 0x9fd3e8, 0, 2, -0.4, 0, 0, 0, 1.2, 1, 1)
      .add(G.cyl, 0x1a1a1a, -0.8, 0.8, -0.6, 0, 0, Math.PI / 2, 1.6, 0.5, 1.6)
      .add(G.cyl, 0x1a1a1a, 0.8, 0.8, -0.6, 0, 0, Math.PI / 2, 1.6, 0.5, 1.6)
      .build();
    const cow = new Merger()
      .add(G.box, 0xf4f1ea, 0, 1.1, 0, 0, Math.PI / 2, 0, 0.9, 0.9, 1.8)
      .add(G.box, 0x2a2420, 0.3, 1.25, 0.2, 0, Math.PI / 2, 0, 0.92, 0.5, 0.6)
      .add(G.box, 0xf4f1ea, 1.05, 1.4, 0, 0, Math.PI / 2, 0, 0.5, 0.5, 0.6)
      .add(G.cyl, 0x2a2420, -0.6, 0.35, 0.3, 0, 0, 0, 0.18, 0.7, 0.18)
      .add(G.cyl, 0x2a2420, 0.6, 0.35, 0.3, 0, 0, 0, 0.18, 0.7, 0.18)
      .add(G.cyl, 0xf4f1ea, -0.6, 0.35, -0.3, 0, 0, 0, 0.18, 0.7, 0.18)
      .add(G.cyl, 0xf4f1ea, 0.6, 0.35, -0.3, 0, 0, 0, 0.18, 0.7, 0.18)
      .build();
    const barrel = new Merger().add(G.cyl, 0x8a5a36, 0, 0.6, 0, 0, 0, 0, 1, 1.2, 1).add(G.cyl, 0x333333, 0, 0.3, 0, 0, 0, 0, 1.03, 0.08, 1.03).add(G.cyl, 0x333333, 0, 0.9, 0, 0, 0, 0, 1.03, 0.08, 1.03).build();
    // speed > 0: va en nuestro sentido, más lento que nosotros
    return {
      madrid: [{ geo: cone, speed: 0 }, { geo: otherCar(0x3a6ab0), speed: 10 }, { geo: otherCar(0xf4f1ea), speed: 12 }],
      meseta: [{ geo: otherCar(0xf4d35e), speed: 11 }, { geo: tractor, speed: 5 }, { geo: cone, speed: 0 }],
      cantabria: [{ geo: cow, speed: 0 }, { geo: cow, speed: 0 }, { geo: otherCar(0x2f6b46), speed: 10 }],
      rioja: [{ geo: barrel, speed: 0 }, { geo: otherCar(0x7a1f3d), speed: 11 }, { geo: barrel, speed: 0 }],
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
    // Terraza con mesa (donde se cocinan las zamburiñas)
    m.add(G.box, 0xd9c7a5, -9, 0.05, -22, 0, 0, 0, 8, 0.1, 8);
    g.add(m.mesh());
    return g;
  }

  private buildGrill() {
    const g = new THREE.Group();
    g.add(
      new Merger()
        .add(G.box, 0x6b6b70, 0, 0.5, 0, 0, 0, 0, 4.2, 1, 3.2)
        .add(G.box, 0x2a2a2e, 0, 1.02, 0, 0, 0, 0, 4, 0.06, 3)
        .add(G.box, 0x8a5a36, 3.2, 0.5, 0, 0, 0, 0, 1.8, 1, 1.8)
        .add(G.cyl, 0xffffff, 3.2, 1.05, 0, 0, 0, 0, 1.4, 0.06, 1.4) // plato
        .add(G.cyl, 0xf9e04b, -1.6, 1.1, 1.2, 0, 0, Math.PI / 2, 0.3, 0.06, 0.3) // limón
        .mesh(),
    );
    for (let i = 0; i < 6; i++) {
      const s = makeScallop();
      s.root.position.set(-1.3 + (i % 3) * 1.3, 1.05, -0.6 + Math.floor(i / 3) * 1.2);
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
    if (this.phase === 'drive1' || this.phase === 'intro') k = (this.dist / LEG1) * 0.55;
    else if (this.phase === 'arriveSV' || this.phase === 'grill' || this.phase === 'zambDone') k = 0.55;
    else if (this.phase === 'drive2') k = 0.55 + (this.dist / LEG2) * 0.45;
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
    for (const s of this.scatters) s.reset(z, this.regionAt);
  }

  private spawnRow() {
    const z = this.nextSpawn;
    const reg = this.regionAt(z);
    const end = this.phase === 'drive1' ? LEG1 - 60 : this.legStart + LEG2 - 60;
    if (z > end) return;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    // Una o dos fotos y, a veces, un obstáculo (nunca bloquea los tres carriles)
    const obstacle = Math.random() < 0.7;
    if (obstacle) {
      const defs = this.obstacleGeos[reg];
      const d = defs[Math.floor(Math.random() * defs.length)];
      const o = new THREE.Mesh(d.geo, vertexMat);
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
    this.input.consumeAction();
    this.input.consumeCam();

    // Velocidad
    this.turboT -= dt;
    const turbo = drive && this.turboT > 0 && this.hitT <= 0;
    const target = drive ? (this.hitT > 0 ? MAX_SPEED * 0.4 : MAX_SPEED * (turbo ? TURBO : 1)) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (drive ? (turbo ? 2.5 : 1.2) : 2.5));
    this.hitT -= dt;
    if (drive) this.driveTime += dt;
    // Sensación de velocidad: el plano se abre con el turbo
    const fov = this.baseFov + Math.max(0, this.speed - MAX_SPEED) * 0.9;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
    if (turbo && Math.random() < dt * 20) this.fx.burst(this.car.root.position.clone().setY(0.3).setZ(this.carZ - 2), 'dust', 1, 0.8, 0.2);
    this.carZ += this.speed * dt;
    if (drive) this.dist = this.carZ - this.legStart;
    this.carX += (LANES[this.lane] - this.carX) * Math.min(1, dt * 8);

    const car = this.car;
    car.root.position.set(this.carX, 0, this.carZ);
    car.root.rotation.y = (LANES[this.lane] - this.carX) * 0.08;
    car.body.position.y = Math.abs(Math.sin(this.t * 18)) * 0.03 * (this.speed / MAX_SPEED);
    car.body.rotation.z = this.hitT > 0 ? Math.sin(this.t * 30) * 0.06 : 0;
    car.wheels.forEach((w) => (w.rotation.x += (this.speed * dt) / 0.34));
    car.joy.rotation.y = Math.sin(this.t * 3) * 0.3;
    car.joy.position.y = 1.18 + Math.sin(this.t * 6) * 0.03 + (this.combo % 5 === 0 && this.combo > 0 ? Math.abs(Math.sin(this.t * 14)) * 0.12 : 0);

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
      th.z += th.speed * dt;
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
            audio.bark();
            this.fx.burst(at, '🐾', 5, 1.8);
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

    if (this.phase === 'grill' || this.phase === 'zambDone') this.updateGrill(dt);
    this.updateRoute();
    this.updateCamera(dt);
    this.skyDome.update(this.camera, dt);
  }

  private arriveSV() {
    this.phase = 'arriveSV';
    this.lane = 1;
    this.updateHud();
    audio.bark();
    setTimeout(() => {
      dialogue(ROAD.arriveSV, () => this.startGrill());
    }, 1200);
  }

  private startGrill() {
    this.phase = 'grill';
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
    if (!hits.length) return;
    const s = this.scallops.find((sc) => hits[0].object.parent === sc.root);
    if (!s || s.wait > 0) return;
    if (s.p >= 0.62 && s.p <= 1) {
      this.served++;
      audio.pickup();
      toast(ROAD.zamb.served);
      this.fx.burst(s.root.getWorldPosition(new THREE.Vector3()).setY(1.6), '✨', 6, 1.2);
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
    setTimeout(() => dialogue(ROAD.zambDone, () => this.sitOnTerrace()), 600);
  }

  private startDrive2() {
    this.legStart = LEG1 + 40;
    this.reset(this.legStart);
    this.dist = 0;
    this.speed = 0;
    this.lane = 1;
    this.carX = 0;
    this.phase = 'drive2';
    this.updateHud();
  }

  private arriveLogrono() {
    this.phase = 'logrono';
    this.updateHud();
    audio.bark();
    setTimeout(() => dialogue(ROAD.arriveLogrono, () => this.finish()), 1500);
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
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      this.updateHud();
      this.busy = true;
      dialogue(ROAD.terrace, () => (this.busy = false));
    }, 500);
  }

  private eatZamburina() {
    if (!this.terrace) return;
    this.eating = true;
    this.hud.setAction(null);
    this.terrace.eat(() => {
      audio.fanfare();
      dialogue(ROAD.terraceDone, () =>
        fadeFlash(() => {
          this.route.style.display = '';
          this.startDrive2();
        }, 400),
      );
    });
  }

  private finish() {
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
    const raw = new THREE.Color(0xf3e6d3);
    const gold = new THREE.Color(0xe0a040);
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
      s.root.scale.setScalar(s.p >= 0.62 && s.p <= 1 ? 1 + Math.sin(this.t * 12) * 0.06 : 1);
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
      this.camTarget.set(g.x + 0.3, 6.2, g.z - 3.2);
      this.camLook.set(g.x + 0.3, 1, g.z);
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
      this.route.style.display = '';
      this.eating = false;
      this.busy = false;
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
        label: '2 · Entrar en Cantabria',
        run: () => {
          clean();
          this.legStart = 0;
          this.reset(980);
          this.phase = 'drive1';
          this.updateHud();
        },
      },
      {
        label: '3 · Llegar a San Vicente',
        run: () => {
          clean();
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
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.laneBtns.forEach((b) => b.remove());
    audio.stopMusic();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
