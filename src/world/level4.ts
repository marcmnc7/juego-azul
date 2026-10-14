import * as THREE from 'three';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate } from '../core/gfx';
import { NIGHT } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeDog, animatePerson, Person, Dog } from '../entities/models';
import { Particles } from '../entities/fx';
import { hud, dialogue, fadeFlash, Hud, DebugItem } from '../ui/ui';
import { ROOF_GEO, type Box2 } from './ferreries';
import { canvasTex } from './deco';
import { clock, type Level, type LevelDone } from './level';

// Capítulo 4 · Noche de piscina y estrellas, en casa.
// La casa sigue la foto de satélite: adosado de tejado plano con placas solares, terraza,
// jardín de césped con camino de losas por la derecha y la piscina al fondo.
// Bucle: bajar al jardín → tirarse a la piscina → recoger 6 velitas → tumbarse en las toallas →
// unir las estrellas que forman un corazón → estrella fugaz → final.

type Phase = 'intro' | 'toPool' | 'diving' | 'swim' | 'toTowels' | 'stars' | 'ending' | 'done';

// Piscina (interior del vaso)
const POOL = { minX: -1.5, maxX: 2.5, minZ: 8.8, maxZ: 13.6 };
const WATER_Y = -0.22;
const SWIM_Y = -1.12;
const TOWELS = new THREE.Vector3(-2.6, 0, 5.4);
const PLOT = { minX: -4.1, maxX: 4.1, minZ: 0.25, maxZ: 14.1 };

interface Candle {
  obj: THREE.Group;
  taken: boolean;
  ph: number;
}

export class Level4 implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private phase: Phase = 'intro';
  private player: Person;
  private walker: Walker;
  private gas: Person;
  private joy: Dog;
  private joyWalk = 0;
  private barkT = 4;
  private sky: Sky;
  private sun: Sun;
  private colliders: Box2[] = [];
  private solids: Circle[] = [];
  private candles: Candle[] = [];
  private collected = 0;
  private waterTex: THREE.Texture;
  private fireflies!: THREE.Points;
  private marker: THREE.Group;
  private busy = false;
  private t = 0;
  private diveT = 0;
  private diveFrom = new THREE.Vector3();
  private diveTo = new THREE.Vector3();
  private playTime = 0;
  // Constelación
  private starPts: THREE.Vector3[] = [];
  private starSprites: THREE.Sprite[] = [];
  private starLine!: THREE.Line;
  private nextStar = 0;
  private misses = 0;
  private shooting: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
  private starCamPos = new THREE.Vector3();
  private starCamLook = new THREE.Vector3();
  private endT = 0;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private onTap = (e: PointerEvent) => this.tapStar(e.clientX, e.clientY, e.target as HTMLElement);

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x0b1030, 35, 140);
    this.sky = new Sky({ top: 0x02030f, mid: 0x0b1440, bottom: 0x1d2350, stars: 1400 });
    sc.add(this.sky.group);
    this.addMilkyWay();
    sc.add(new THREE.HemisphereLight(0x6f7fc0, 0x1a2030, 1.1));
    // Luz de luna con sombras
    this.sun = new Sun(sc, 0xa9bcff, 1.0, new THREE.Vector3(-0.5, 1, 0.4), 18);
    const poolLight = new THREE.PointLight(0x5fe3ff, 14, 10, 1.6);
    poolLight.position.set((POOL.minX + POOL.maxX) / 2, -0.4, (POOL.minZ + POOL.maxZ) / 2);
    sc.add(poolLight);
    const porch = new THREE.PointLight(0xffc27a, 10, 9, 1.6);
    porch.position.set(0, 2.6, 0.9);
    sc.add(porch);

    this.waterTex = this.causticTexture();
    this.buildHouse();
    this.fx = new Particles(sc);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(-1.2, 0, 1.2);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = 0;

    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.set(1.0, 0, 7.9);
    this.gas.root.rotation.y = Math.PI;
    sc.add(this.gas.root);

    this.joy = makeDog();
    this.joy.root.position.set(0.6, 0, 2.4);
    sc.add(this.joy.root);

    // Velitas flotando en la piscina
    const candleGeo = new Merger()
      .add(G.cyl, 0xf4efe2, 0, 0.06, 0, 0, 0, 0, 0.32, 0.14, 0.32)
      .add(G.cyl, 0xffffff, 0, 0.18, 0, 0, 0, 0, 0.2, 0.18, 0.2)
      .build();
    const flameMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb347, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const spots: [number, number][] = [[-0.8, 9.6], [1.8, 9.4], [0.4, 11.0], [-0.9, 12.8], [1.9, 12.6], [0.6, 13.0]];
    spots.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(candleGeo, toon({ vertexColors: true, emissive: 0x2a1800 })));
      const f = new THREE.Sprite(flameMat);
      f.position.y = 0.42;
      f.scale.setScalar(0.7);
      g.add(f);
      g.position.set(x, WATER_Y, z);
      sc.add(g);
      this.candles.push({ obj: g, taken: false, ph: i * 1.3 });
    });

    // Flecha de objetivo
    this.marker = new THREE.Group();
    const am = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    this.marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16).rotateX(Math.PI), am), new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 10).translate(0, 0.4, 0), am));
    sc.add(this.marker);

    this.buildConstellation();

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.updateHud();
    this.camera.position.set(0, 9, -6);
    this.busy = true;
    setTimeout(() => {
      if (this.phase !== 'intro') return;
      dialogue(NIGHT.intro, () => {
        this.busy = false;
        this.phase = 'toPool';
        this.updateHud();
      });
    }, 2300);
    audio.startMusic('night');
    audio.ambience(0.03); // grillos y brisa de fondo
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Construcción ----------------

  private causticTexture() {
    const t = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#1f9fd0';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(200,250,255,0.55)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 + Math.random() * 18, 6 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2.5);
    return t;
  }

  private addMilkyWay() {
    // Banda de la Vía Láctea: miles de estrellas tenues a lo largo de un círculo inclinado
    const n = 2500;
    const p = new Float32Array(n * 3);
    const axis = new THREE.Vector3(0.3, 0.4, 1).normalize();
    const a = new THREE.Vector3(1, 0, -0.3).normalize();
    const b = new THREE.Vector3().crossVectors(axis, a).normalize();
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const spread = (Math.random() + Math.random() - 1) * 0.16;
      const v = a.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th)).addScaledVector(axis, spread).normalize().multiplyScalar(390);
      if (v.y < 10) v.y = Math.abs(v.y) + 10;
      p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d0ff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    pts.renderOrder = -9;
    this.sky.group.add(pts);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6d8, fog: false, depthWrite: false }));
    moon.position.set(-160, 230, 220);
    moon.scale.setScalar(60);
    this.sky.group.add(moon);
  }

  private ground(m: Merger, x0: number, x1: number, z0: number, z1: number, color: number, y = 0) {
    m.add(G.box, color, (x0 + x1) / 2, y - 0.05, (z0 + z1) / 2, 0, 0, 0, x1 - x0, 0.1, z1 - z0);
  }

  private buildHouse() {
    const sc = this.scene;
    const m = new Merger();
    const GRASS = 0x3f7a3a;
    const NEIGH = 0x4a7a40;
    const WALL = 0xf1e6cf;

    // Suelo: césped alrededor del hueco de la piscina, y los jardines vecinos
    const grassTex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const v = 170 + Math.random() * 85;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 5);
      }
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(4, 4);
    const lawn = new Merger();
    this.ground(lawn, -4.5, POOL.minX - 0.35, 1.5, 14.5, GRASS);
    this.ground(lawn, POOL.maxX + 0.35, 4.5, 1.5, 14.5, GRASS);
    this.ground(lawn, POOL.minX - 0.35, POOL.maxX + 0.35, 1.5, POOL.minZ - 0.35, GRASS);
    this.ground(lawn, POOL.minX - 0.35, POOL.maxX + 0.35, POOL.maxZ + 0.35, 14.5, GRASS);
    for (const [x0, x1] of [[-40, -4.5], [4.5, 40]]) this.ground(lawn, x0, x1, 0, 30, NEIGH);
    this.ground(lawn, -40, 40, 14.5, 40, NEIGH);
    const lawnMesh = new THREE.Mesh(lawn.build(), toon({ vertexColors: true, map: grassTex }));
    lawnMesh.userData.noCast = true;
    sc.add(lawnMesh);
    // Calle de atrás
    this.ground(m, -40, 40, -40, -15, 0x3a3a44);

    // Terraza y borde de la piscina
    this.ground(m, -4.5, 4.5, 0, 1.5, 0xd8c7a5, 0.02);
    for (const [x, z, w, d] of [
      [(POOL.minX + POOL.maxX) / 2, POOL.minZ - 0.17, POOL.maxX - POOL.minX + 0.7, 0.35],
      [(POOL.minX + POOL.maxX) / 2, POOL.maxZ + 0.17, POOL.maxX - POOL.minX + 0.7, 0.35],
      [POOL.minX - 0.17, (POOL.minZ + POOL.maxZ) / 2, 0.35, POOL.maxZ - POOL.minZ],
      [POOL.maxX + 0.17, (POOL.minZ + POOL.maxZ) / 2, 0.35, POOL.maxZ - POOL.minZ],
    ])
      m.add(G.box, 0xf4efe2, x, 0.02, z, 0, 0, 0, w, 0.12, d);
    // Vaso de la piscina
    const cx = (POOL.minX + POOL.maxX) / 2;
    const cz = (POOL.minZ + POOL.maxZ) / 2;
    const pw = POOL.maxX - POOL.minX;
    const pd = POOL.maxZ - POOL.minZ;
    m.add(G.box, 0x2b6fb0, cx, -1.5, cz, 0, 0, 0, pw, 0.1, pd);
    m.add(G.box, 0x3584c8, cx, -0.75, POOL.minZ - 0.05, 0, 0, 0, pw, 1.5, 0.1);
    m.add(G.box, 0x3584c8, cx, -0.75, POOL.maxZ + 0.05, 0, 0, 0, pw, 1.5, 0.1);
    m.add(G.box, 0x3584c8, POOL.minX - 0.05, -0.75, cz, 0, 0, 0, 0.1, 1.5, pd);
    m.add(G.box, 0x3584c8, POOL.maxX + 0.05, -0.75, cz, 0, 0, 0, 0.1, 1.5, pd);
    // Escalera
    for (const sx of [-0.25, 0.25]) m.add(G.cyl, 0xd0d6dc, POOL.maxX - 0.6 + sx, 0.3, POOL.minZ + 0.05, 0.25, 0, 0, 0.05, 1.2, 0.05);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.waterTex, color: 0x9ff0ff, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    water.position.set(cx, WATER_Y, cz);
    sc.add(water);
    this.colliders.push({ minX: POOL.minX - 0.1, maxX: POOL.maxX + 0.1, minZ: POOL.minZ - 0.1, maxZ: POOL.maxZ + 0.1 });

    // Camino de losas por la derecha, de la terraza a la piscina
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      m.add(G.box, 0xe8dcc0, 3.5 - t * 0.6, 0.02, 1.9 + t * 6.4, 0, 0.3, 0, 0.7, 0.06, 0.45);
    }

    // La casa: adosado de tejado plano. Cuerpo delantero (2 plantas) y trasero más alto.
    m.add(G.box, WALL, 0, 3.2, -4.5, 0, 0, 0, 9, 6.4, 9);
    m.add(G.box, 0xe9dcc2, 0, 6.55, -4.5, 0, 0, 0, 9.2, 0.3, 9.2); // pretil
    m.add(G.box, 0xe4d6bb, 0, 3.6, -12, 0, 0, 0, 9, 7.2, 6);
    m.add(G.box, 0x3a3030, 0, 7.3, -9.2, 0, 0, 0, 9, 0.5, 0.6); // franja oscura de la terraza de arriba
    m.add(G.box, 0xd8cab0, 0, 7.35, -12, 0, 0, 0, 9.2, 0.3, 6.2);
    this.colliders.push({ minX: -4.5, maxX: 4.5, minZ: -15, maxZ: 0 });
    // Placas solares en el tejado (dos grupos, como en la foto)
    const panel = (x: number, z: number, rows: number, cols: number, y: number) => {
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          m.add(G.box, 0x1b2440, x + (c - (cols - 1) / 2) * 0.9, y + 0.35, z + r * 1.5, -0.35, 0, 0, 0.85, 0.05, 1.4);
          m.add(G.box, 0x8a93a6, x + (c - (cols - 1) / 2) * 0.9, y + 0.15, z + r * 1.5 - 0.5, 0, 0, 0, 0.05, 0.3, 0.05);
        }
    };
    panel(-2.3, -6.5, 2, 4, 6.4);
    panel(2.0, -4.2, 2, 4, 6.4);
    panel(1.5, -13.5, 2, 5, 7.2);
    // Fachada al jardín: cristaleras iluminadas abajo y ventanas arriba
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const windows = new Merger();
    windows.add(G.box, 0xffd9a0, -2, 1.3, 0.03, 0, 0, 0, 3.2, 2.4, 0.05);
    windows.add(G.box, 0xffd9a0, 2.2, 1.3, 0.03, 0, 0, 0, 2.4, 2.4, 0.05);
    windows.add(G.box, 0xffe7c0, -2.2, 4.6, 0.03, 0, 0, 0, 1.6, 1.4, 0.05);
    windows.add(G.box, 0xffe7c0, 2.2, 4.6, 0.03, 0, 0, 0, 1.6, 1.4, 0.05);
    const wm = new THREE.Mesh(windows.build(), glow);
    sc.add(wm);
    for (const [x, w] of [[-2, 3.2], [2.2, 2.4]]) {
      m.add(G.box, 0x333338, x, 2.55, 0.06, 0, 0, 0, w + 0.1, 0.1, 0.08);
      m.add(G.box, 0x333338, x, 1.3, 0.07, 0, 0, 0, 0.06, 2.4, 0.06);
    }
    m.add(G.box, 0xe9dcc2, 0, 2.85, 0.3, 0, 0, 0, 9, 0.12, 0.6); // voladizo (bajo, para que la cámara no lo atraviese)
    // Pérgola con guirnalda sobre la terraza, mesa y sillas
    m.add(G.cyl, 0x8a6a44, 4.2, 1.3, 1.3, 0, 0, 0, 0.12, 2.6, 0.12);
    m.add(G.cyl, 0x8a6a44, -4.2, 1.3, 1.3, 0, 0, 0, 0.12, 2.6, 0.12);
    m.add(G.cyl, 0xf4efe2, -1.0, 0.75, 0.8, 0, 0, 0, 1.2, 0.05, 1.2);
    m.add(G.cyl, 0x777777, -1.0, 0.37, 0.8, 0, 0, 0, 0.08, 0.75, 0.08);
    for (const sx of [-1.8, -0.2]) m.add(G.rbox, 0x8a6a44, sx, 0.45, 0.8, 0, 0, 0, 0.45, 0.9, 0.45);
    this.colliders.push({ minX: -2.1, maxX: 0.1, minZ: 0.3, maxZ: 1.3 });
    // Sombrilla azul en la esquina de la terraza
    m.add(G.cyl, 0xdddddd, 3.6, 1.2, 0.7, 0, 0, 0, 0.08, 2.4, 0.08);
    m.add(G.cone, 0x2b4fa0, 3.6, 2.5, 0.7, 0, 0, 0, 2.4, 0.6, 2.4);
    this.colliders.push({ minX: 3.45, maxX: 3.75, minZ: 0.55, maxZ: 0.85 });
    // Tumbonas junto a la piscina
    for (const z of [10, 12]) {
      m.add(G.box, 0xf4efe2, -3.2, 0.3, z, 0, 0, 0, 0.7, 0.12, 1.8);
      m.add(G.box, 0xf4efe2, -3.2, 0.55, z - 0.75, 0.6, 0, 0, 0.7, 0.1, 0.6);
      m.add(G.box, 0x2b4fa0, -3.2, 0.38, z + 0.1, 0, 0, 0, 0.6, 0.04, 1.4);
      this.colliders.push({ minX: -3.6, maxX: -2.8, minZ: z - 1, maxZ: z + 0.9 });
    }
    // Toallas en el césped para mirar las estrellas
    m.add(G.box, 0xe2547a, TOWELS.x - 0.45, 0.03, TOWELS.z, 0, 0, 0, 0.8, 0.02, 1.9);
    m.add(G.box, 0x5aa9e6, TOWELS.x + 0.45, 0.03, TOWELS.z, 0, 0, 0, 0.8, 0.02, 1.9);

    // Muros del jardín y setos
    for (const sx of [-4.6, 4.6]) {
      m.add(G.box, 0xf4efe2, sx, 0.9, 7.25, 0, 0, 0, 0.25, 1.8, 14.5);
      this.colliders.push({ minX: sx - 0.13, maxX: sx + 0.13, minZ: 0, maxZ: 14.5 });
    }
    m.add(G.box, 0xf4efe2, 0, 0.9, 14.6, 0, 0, 0, 9.4, 1.8, 0.25);
    m.add(G.box, 0x2f5f2a, -4.2, 1.1, 8, 0, 0, 0, 0.55, 2.2, 7);
    this.colliders.push({ minX: -4.5, maxX: -3.9, minZ: 4.5, maxZ: 11.5 });
    m.add(G.box, 0x2f5f2a, 0, 1.0, 14.2, 0, 0, 0, 8, 2, 0.5);
    for (const [x, z] of [[3.9, 13.6], [-3.8, 1.8], [3.9, 4.8]]) {
      m.add(G.cyl, 0xb5603b, x, 0.3, z, 0, 0, 0, 0.6, 0.6, 0.6);
      m.add(G.sphere, 0x3e7a3a, x, 0.9, z, 0, 0, 0, 0.9, 0.9, 0.9);
    }

    // Vecinos: casas de teja y sus piscinas
    for (const sx of [-1, 1]) {
      const x = sx * 9;
      m.add(G.box, 0xf3ead8, x, 3, -6, 0, 0, 0, 9, 6, 12);
      m.add(ROOF_GEO, 0xb8623e, x, 6, -6, 0, Math.PI / 2, 0, 12.2, 1.8, 9.4);
      m.add(G.box, 0xffd9a0, x, 1.3, 0.03, 0, 0, 0, 3, 2.2, 0.05);
      m.add(G.box, 0xf4efe2, x + sx * 4.5, 0.9, 7.25, 0, 0, 0, 0.25, 1.8, 14.5);
      m.add(G.box, 0xf4efe2, x, 0.9, 14.6, 0, 0, 0, 9, 1.8, 0.25);
    }
    m.add(G.box, 0x7fd3ef, -9.6, 0.03, 6.5, 0, 0, 0, 3.2, 0.03, 5); // piscina vecina (más clara)
    m.add(G.box, 0x7fd3ef, -8.4, 0.03, 12.2, 0, 0, 0, 2.6, 0.03, 2.4);
    // Palmera junto a la casa del vecino
    for (let i = 0; i < 6; i++) m.add(G.cyl, 0x6b5a40, -6.4 + Math.sin(i * 0.3) * 0.3, (i + 0.5) * 1.2, 2.6, 0, 0, 0.05, 0.4 - i * 0.03, 1.2, 0.4 - i * 0.03);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      m.add(G.box, 0x2f5f2a, -6.4 + Math.cos(a) * 1.4, 7, 2.6 + Math.sin(a) * 1.4, 0, -a, 0.45, 2.8, 0.1, 0.7);
    }
    sc.add(m.mesh());

    // Guirnalda de bombillas sobre la terraza y luciérnagas en el jardín
    const lp: number[] = [];
    for (let i = 0; i <= 16; i++) lp.push(-4.2 + i * 0.525, 2.55 - Math.sin((i / 16) * Math.PI) * 0.35, 1.3);
    const lights = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)),
      new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd38a, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sc.add(lights);
    const ff = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) ff.set([-4 + Math.random() * 8, 0.4 + Math.random() * 1.6, 2 + Math.random() * 12], i * 3);
    this.fireflies = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ff, 3)),
      new THREE.PointsMaterial({ map: glowTexture(), color: 0xd8ff7a, size: 0.25, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sc.add(this.fireflies);
  }

  /** Estrellas grandes que forman un corazón en el cielo, vistas desde las toallas. */
  private buildConstellation() {
    this.starCamPos.set(TOWELS.x, 1.0, TOWELS.z - 1.2);
    const dir = new THREE.Vector3(0.05, 0.78, 0.62).normalize();
    const center = this.starCamPos.clone().addScaledVector(dir, 90);
    this.starCamLook.copy(center);
    const right = new THREE.Vector3(-1, 0, 0);
    const up = new THREE.Vector3().crossVectors(dir, right).normalize().negate();
    const n = 10;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      this.starPts.push(center.clone().addScaledVector(right, hx * 1.05).addScaledVector(up, hy * 1.05 + 2));
    }
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff4c0, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const p of this.starPts) {
      const s = new THREE.Sprite(mat.clone());
      s.position.copy(p);
      s.scale.setScalar(5);
      s.visible = false;
      this.scene.add(s);
      this.starSprites.push(s);
    }
    const g = new THREE.BufferGeometry().setFromPoints(this.starPts.map((p) => p.clone()).concat([this.starPts[0].clone()]));
    g.setDrawRange(0, 0);
    this.starLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd6ea, fog: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.starLine.frustumCulled = false;
    this.scene.add(this.starLine);
  }

  // ---------------- HUD ----------------

  private updateHud() {
    const h = this.hud;
    h.setCounters(this.phase === 'swim' ? `<span class="chip">${NIGHT.candle(this.collected)}</span>` : '');
    switch (this.phase) {
      case 'intro':
      case 'toPool':
        h.setObjective('Baja al jardín y tírate a la piscina');
        break;
      case 'swim':
        h.setObjective('Recoge las velitas que flotan');
        break;
      case 'toTowels':
        h.setObjective('Túmbate en las toallas del césped');
        break;
      case 'stars':
        h.setObjective('Une las estrellas en orden');
        break;
      default:
        h.setObjective('💙 Feliz cumpleaños 💙');
    }
  }

  private target(): THREE.Vector3 | null {
    if (this.phase === 'toPool') return this.v2.set(0.5, 0, POOL.minZ - 0.6);
    if (this.phase === 'toTowels') return TOWELS;
    return null;
  }

  // ---------------- Bucle ----------------

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    if (this.phase !== 'intro' && this.phase !== 'done' && this.phase !== 'ending') this.playTime += dt;
    this.waterTex.offset.set(Math.sin(this.t * 0.3) * 0.2, this.t * 0.03);
    this.candles.forEach((c) => {
      if (c.taken) return;
      c.obj.position.y = WATER_Y + Math.sin(this.t * 1.5 + c.ph) * 0.04;
      c.obj.rotation.z = Math.sin(this.t + c.ph) * 0.08;
      (c.obj.children[1] as THREE.Sprite).scale.setScalar(0.65 + Math.sin(this.t * 13 + c.ph) * 0.06);
    });
    const ffp = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ffp.count; i++) ffp.setY(i, ffp.getY(i) + Math.sin(this.t * 1.3 + i) * dt * 0.25);
    ffp.needsUpdate = true;
    (this.fireflies.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(this.t * 3) * 0.3;

    const swimming = this.phase === 'swim';
    const walking = !this.busy && (this.phase === 'toPool' || this.phase === 'toTowels' || swimming);
    this.walker.turn(this.input.consumeCam());
    const pp = this.player.root.position;

    if (this.phase === 'diving') this.updateDive(dt);
    else if (this.phase !== 'stars' && this.phase !== 'ending' && this.phase !== 'done') {
      this.walker.speed = swimming ? 3.0 : 5.0;
      this.solids.length = 0;
      if (swimming) this.solids.push({ x: this.gas.root.position.x, z: this.gas.root.position.z, r: 0.35 });
      else this.solids.push({ x: this.joy.root.position.x, z: this.joy.root.position.z, r: 0.3 }, { x: this.gas.root.position.x, z: this.gas.root.position.z, r: 0.35 });
      const bounds = swimming ? { minX: POOL.minX + 0.4, maxX: POOL.maxX - 0.4, minZ: POOL.minZ + 0.4, maxZ: POOL.maxZ - 0.4 } : PLOT;
      const move = this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, swimming ? [] : this.colliders, bounds, this.solids);
      this.player.root.rotation.y = this.walker.facing;
      if (swimming) {
        this.swimPose(this.player, move);
        if (move > 0.3 && Math.random() < dt * 6) this.fx.burst(this.v1.copy(pp).setY(WATER_Y + 0.2), '💦', 1, 1, 0.4);
      } else animatePerson(this.player, dt, move > 0.05 ? 'walk' : 'idle', move, this.walker.walk);
    }

    this.updateGas(dt);
    this.updateJoy(dt);

    // Velitas
    if (swimming) {
      for (const c of this.candles) {
        if (c.taken) continue;
        if (Math.hypot(c.obj.position.x - pp.x, c.obj.position.z - pp.z) < 0.85) {
          c.taken = true;
          c.obj.visible = false;
          this.collected++;
          audio.pickup();
          vibrate(20);
          this.fx.burst(this.v1.copy(c.obj.position).setY(0.6), '✨', 6, 1.5);
          this.updateHud();
          if (this.collected >= 6) this.finishSwim();
        }
      }
    }

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    if (!this.busy && this.phase === 'toPool' && this.nearPoolEdge()) {
      label = '🏊 Tirarse al agua';
      action = () => this.startDive();
    } else if (!this.busy && this.phase === 'toTowels' && pp.distanceTo(TOWELS) < 1.8) {
      label = '✨ Tumbarse';
      action = () => this.lieDown();
    }
    this.hud.setAction(label, !!label);
    if (this.input.consumeAction() && action) action();

    const tgt = this.target();
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, 2.4 + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 2 ? null : -rel);
    } else this.hud.setArrow(null);

    this.updateShooting(dt);
    if (this.phase === 'stars' || this.phase === 'ending' || this.phase === 'done') this.updateStars(dt);
    else this.walker.camera(this.camera, this.phase === 'intro' ? dt * 0.4 : dt, this.colliders, swimming ? 5.5 : 6.5, swimming ? 3.2 : 3.6);
    this.sun.follow(pp);
    this.sky.update(this.camera, dt);
  }

  private nearPoolEdge() {
    const p = this.player.root.position;
    const dx = Math.max(POOL.minX - p.x, 0, p.x - POOL.maxX);
    const dz = Math.max(POOL.minZ - p.z, 0, p.z - POOL.maxZ);
    return Math.hypot(dx, dz) < 1.2;
  }

  /** Nadar: el cuerpo medio sumergido y brazos de crol. */
  private swimPose(p: Person, move: number) {
    animatePerson(p, 0.016, 'idle');
    const t = this.t * (3 + move * 4);
    p.root.position.y = SWIM_Y + Math.sin(this.t * 2) * 0.04;
    p.body.rotation.x = 0.35 * move;
    p.armL.rotation.x = -Math.PI / 2 + Math.sin(t) * (0.6 + move * 1.2);
    p.armR.rotation.x = -Math.PI / 2 - Math.sin(t) * (0.6 + move * 1.2);
    p.armL.rotation.z = -0.4;
    p.armR.rotation.z = 0.4;
    p.legL.rotation.x = Math.sin(t * 2) * 0.4;
    p.legR.rotation.x = -Math.sin(t * 2) * 0.4;
  }

  private updateGas(dt: number) {
    const g = this.gas;
    if (this.phase === 'swim') {
      // Gas nada en círculos lentos por la piscina
      const a = this.t * 0.35;
      const x = 0.5 + Math.cos(a) * 1.1;
      const z = 11.2 + Math.sin(a) * 1.6;
      g.root.position.set(x, SWIM_Y, z);
      g.root.rotation.y = Math.atan2(-Math.sin(a) * 1.1, Math.cos(a) * 1.6);
      this.swimPose(g, 0.6);
    } else if (this.phase === 'stars' || this.phase === 'ending' || this.phase === 'done') {
      animatePerson(g, dt, 'idle');
      g.eyes.scale.y = 1;
    } else if (this.phase === 'diving') {
      animatePerson(g, dt, 'cheer');
    } else {
      animatePerson(g, dt, 'wave');
      const p = this.player.root.position;
      g.root.rotation.y = Math.atan2(p.x - g.root.position.x, p.z - g.root.position.z);
    }
  }

  /** Joy sigue a Azul (sin meterse en la piscina), mueve la cola y ladra de vez en cuando. */
  private updateJoy(dt: number) {
    const j = this.joy.root;
    const p = this.player.root.position;
    let tx = p.x - 1.0;
    let tz = p.z - 0.9;
    if (this.phase === 'stars' || this.phase === 'ending' || this.phase === 'done') {
      tx = TOWELS.x - 1.3;
      tz = TOWELS.z + 0.3;
    }
    // Si Azul está en el agua, Joy corre por el borde
    if (tx > POOL.minX - 0.6 && tx < POOL.maxX + 0.6 && tz > POOL.minZ - 0.6 && tz < POOL.maxZ + 0.6) {
      const opts = [tx - (POOL.minX - 0.7), POOL.maxX + 0.7 - tx, tz - (POOL.minZ - 0.7), POOL.maxZ + 0.7 - tz];
      const i = opts.indexOf(Math.min(...opts));
      if (i === 0) tx = POOL.minX - 0.7;
      else if (i === 1) tx = POOL.maxX + 0.7;
      else if (i === 2) tz = POOL.minZ - 0.7;
      else tz = POOL.maxZ + 0.7;
    }
    const dx = tx - j.position.x;
    const dz = tz - j.position.z;
    const d = Math.hypot(dx, dz);
    let speed = 0;
    if (d > 0.5) {
      speed = Math.min(5.5, d * 3);
      j.position.x += (dx / d) * speed * dt;
      j.position.z += (dz / d) * speed * dt;
      j.rotation.y = Math.atan2(dx, dz);
    }
    j.position.x = Math.max(PLOT.minX, Math.min(PLOT.maxX, j.position.x));
    j.position.z = Math.max(PLOT.minZ, Math.min(PLOT.maxZ, j.position.z));
    this.joyWalk += dt * speed * 3;
    const w = Math.sin(this.joyWalk) * 0.6 * Math.min(1, speed / 2);
    this.joy.legs[0].rotation.x = this.joy.legs[3].rotation.x = w;
    this.joy.legs[1].rotation.x = this.joy.legs[2].rotation.x = -w;
    this.joy.tail.rotation.z = Math.sin(this.t * 14) * 0.6;
    if (this.phase === 'stars' || this.phase === 'ending') j.rotation.y = Math.PI / 2;
    this.barkT -= dt;
    if (this.barkT <= 0 && this.phase !== 'stars' && this.phase !== 'ending' && this.phase !== 'done') {
      this.barkT = 5 + Math.random() * 6;
      audio.bark();
      this.fx.burst(this.v1.copy(j.position).setY(1.2), '🐾', 2, 0.8, 0.6);
    }
  }

  // ---------------- Piscina ----------------

  private startDive() {
    this.phase = 'diving';
    this.busy = true;
    this.diveT = 0;
    this.input.reset();
    const p = this.player.root.position;
    this.diveFrom.copy(p);
    this.diveTo.set(Math.max(POOL.minX + 0.8, Math.min(POOL.maxX - 0.8, p.x)), SWIM_Y, Math.max(POOL.minZ + 0.9, Math.min(POOL.maxZ - 0.9, p.z + 1.6)));
    this.walker.facing = Math.atan2(this.diveTo.x - p.x, this.diveTo.z - p.z);
    this.player.root.rotation.y = this.walker.facing;
    this.hud.setAction(null);
    audio.whoosh();
  }

  private updateDive(dt: number) {
    this.diveT += dt;
    const k = Math.min(1, this.diveT / 0.8);
    const p = this.player.root.position;
    p.lerpVectors(this.diveFrom, this.diveTo, k);
    p.y = THREE.MathUtils.lerp(this.diveFrom.y, SWIM_Y, k) + Math.sin(k * Math.PI) * 1.4;
    animatePerson(this.player, dt, 'cheer');
    this.player.body.rotation.x = k * 1.2;
    if (k >= 1) {
      this.player.body.rotation.x = 0;
      audio.splash();
      vibrate(50);
      this.fx.burst(this.v1.copy(p).setY(0.2), '💦', 10, 3, 1.2);
      this.phase = 'swim';
      this.busy = true;
      this.updateHud();
      dialogue(NIGHT.swim, () => (this.busy = false));
    }
  }

  private finishSwim() {
    this.busy = true;
    this.hud.setAction(null);
    audio.fanfare();
    setTimeout(() => {
      dialogue(NIGHT.swimDone, () => {
        fadeFlash(() => {
          // Fuera del agua, ya secos, junto a las toallas
          this.phase = 'toTowels';
          this.player.root.position.set(0.6, 0, 4.2);
          this.player.body.rotation.x = 0;
          this.gas.root.position.set(TOWELS.x + 0.45, 0.06, TOWELS.z);
          this.gas.root.rotation.set(-Math.PI / 2, 0, 0);
          this.gas.body.rotation.x = 0;
          this.walker.yaw = this.walker.facing = Math.atan2(TOWELS.x - 0.6, TOWELS.z - 4.2);
          this.busy = false;
          this.updateHud();
        });
      });
    }, 500);
  }

  // ---------------- Estrellas ----------------

  private lieDown() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    fadeFlash(() => {
      this.phase = 'stars';
      this.player.root.position.set(TOWELS.x - 0.45, 0.06, TOWELS.z);
      this.player.root.rotation.set(-Math.PI / 2, 0, 0);
      animatePerson(this.player, 0.016, 'idle');
      this.camera.position.copy(this.starCamPos);
      this.camera.lookAt(this.starCamLook);
      this.starSprites.forEach((s) => (s.visible = true));
      this.updateHud();
      dialogue(NIGHT.lie, () => {
        this.busy = false;
        window.addEventListener('pointerdown', this.onTap);
      });
    }, 500);
  }

  /** Toque en pantalla: ¿está cerca de la estrella que toca? */
  private tapStar(x: number, y: number, target?: HTMLElement) {
    if (this.phase !== 'stars' || this.busy) return;
    if (target?.closest?.('button, .dialogue')) return;
    const s = this.starPts[this.nextStar];
    const v = this.v1.copy(s).project(this.camera);
    const sx = ((v.x + 1) / 2) * window.innerWidth;
    const sy = ((1 - v.y) / 2) * window.innerHeight;
    if (Math.hypot(sx - x, sy - y) < Math.max(44, window.innerWidth * 0.05)) this.hitStar();
    else this.misses++;
  }

  /** Para el modo prueba: unir la siguiente estrella. */
  hitStar() {
    if (this.phase !== 'stars') return;
    audio.chime(this.nextStar);
    vibrate(15);
    this.nextStar++;
    this.starLine.geometry.setDrawRange(0, this.nextStar);
    if (this.nextStar >= this.starPts.length) {
      this.starLine.geometry.setDrawRange(0, this.starPts.length + 1);
      this.finishStars();
    }
  }

  private finishStars() {
    this.phase = 'ending';
    this.endT = 0;
    this.busy = true;
    window.removeEventListener('pointerdown', this.onTap);
    audio.fanfare();
    vibrate([40, 60, 120]);
    for (let i = 0; i < 4; i++) setTimeout(() => this.launchShootingStar(), i * 700);
    setTimeout(() => {
      dialogue(NIGHT.starsDone, () => {
        setTimeout(() => {
          if (this.phase !== 'ending') return;
          this.phase = 'done';
          audio.ambience(0);
          const stars = 1 + (this.misses <= 6 ? 1 : 0) + (this.playTime < 240 ? 1 : 0);
          this.onComplete({ stars, stats: [['Velitas', '6/6 🕯️'], ['Estrellas unidas', '10/10 ✨'], ['Tiempo', clock(this.playTime)]] });
        }, 1500);
      });
    }, 2200);
  }

  private updateStars(dt: number) {
    // La cámara mira al cielo desde las toallas, con un vaivén suave
    this.camera.position.copy(this.starCamPos);
    this.v1.copy(this.starCamLook).add(this.v2.set(Math.sin(this.t * 0.2) * 1.5, Math.sin(this.t * 0.15) * 1, 0));
    this.camera.lookAt(this.v1);
    const done = this.phase !== 'stars';
    this.starSprites.forEach((s, i) => {
      const next = i === this.nextStar && !done;
      const lit = i < this.nextStar || done;
      const base = lit ? 6.5 : next ? 5 + Math.abs(Math.sin(this.t * 5)) * 4 : 4;
      s.scale.setScalar(base + (done ? Math.sin(this.t * 3 + i) * 1.2 : 0));
      (s.material as THREE.SpriteMaterial).color.set(lit ? (done ? 0xffa3c8 : 0xfff4c0) : next ? 0xffffff : 0xc8d0ff);
    });
    (this.starLine.material as THREE.LineBasicMaterial).opacity = done ? 0.7 + Math.sin(this.t * 4) * 0.3 : 0.9;
    if (this.phase === 'stars' && Math.random() < dt * 0.25) this.launchShootingStar();
    if (this.phase === 'ending') {
      this.endT += dt;
      if (Math.random() < dt * 1.5) this.launchShootingStar();
      if (Math.random() < dt * 3) this.fx.burst(this.v1.copy(TOWELS).setY(0.8), '❤️', 1, 1, 0.6);
    }
    // Azul y Gas tumbados respiran
    for (const p of [this.player, this.gas]) p.body.position.y = Math.sin(this.t * 1.5) * 0.01;
  }

  private launchShootingStar() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const start = this.starCamLook.clone().add(this.v1.set(-40 + Math.random() * 30, 20 + Math.random() * 15, 0));
    s.position.copy(start);
    s.scale.set(3, 3, 1);
    this.scene.add(s);
    this.shooting.push({ s, v: new THREE.Vector3(55 + Math.random() * 20, -25 - Math.random() * 10, 0), life: 1.2 });
  }

  private updateShooting(dt: number) {
    for (const sh of this.shooting) {
      sh.life -= dt;
      sh.s.position.addScaledVector(sh.v, dt);
      (sh.s.material as THREE.SpriteMaterial).opacity = Math.max(0, sh.life / 1.2);
      sh.s.scale.set(3 + (1.2 - sh.life) * 6, 2, 1);
      sh.s.material.rotation = Math.atan2(sh.v.y, sh.v.x);
      if (sh.life <= 0) this.scene.remove(sh.s);
    }
    this.shooting = this.shooting.filter((s) => s.life > 0);
  }

  // ---------------- Modo prueba ----------------

  debug(): DebugItem[] {
    const reset = () => {
      window.removeEventListener('pointerdown', this.onTap);
      this.busy = false;
      this.input.reset();
      this.player.root.rotation.set(0, 0, 0);
      this.gas.root.rotation.set(0, Math.PI, 0);
    };
    return [
      {
        label: '1 · Ir a la piscina',
        run: () => {
          reset();
          this.phase = 'toPool';
          this.player.root.position.set(0.5, 0, 7.2);
          this.gas.root.position.set(1.0, 0, 7.9);
          this.updateHud();
        },
      },
      {
        label: '2 · Nadar',
        run: () => {
          reset();
          this.player.root.position.set(0.5, 0, 7.6);
          this.startDive();
        },
      },
      {
        label: '3 · Tumbarse',
        run: () => {
          reset();
          this.candles.forEach((c) => {
            c.taken = true;
            c.obj.visible = false;
          });
          this.collected = 6;
          this.phase = 'toTowels';
          this.player.root.position.set(TOWELS.x + 1.2, 0, TOWELS.z - 0.6);
          this.gas.root.position.set(TOWELS.x + 0.45, 0.06, TOWELS.z);
          this.gas.root.rotation.set(-Math.PI / 2, 0, 0);
          this.updateHud();
        },
      },
      {
        label: '4 · Unir estrellas',
        run: () => {
          reset();
          this.gas.root.position.set(TOWELS.x + 0.45, 0.06, TOWELS.z);
          this.gas.root.rotation.set(-Math.PI / 2, 0, 0);
          this.nextStar = 0;
          this.lieDown();
        },
      },
      {
        label: '5 · Final',
        run: () => {
          reset();
          this.gas.root.position.set(TOWELS.x + 0.45, 0.06, TOWELS.z);
          this.gas.root.rotation.set(-Math.PI / 2, 0, 0);
          this.lieDown();
          setTimeout(() => {
            while (this.phase === 'stars') {
              this.busy = false;
              this.hitStar();
            }
          }, 900);
        },
      },
      { label: '✓ Completar capítulo', run: () => { reset(); this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onTap);
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
