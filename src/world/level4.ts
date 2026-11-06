import * as THREE from 'three';
import { faceTo } from '../core/steer';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate } from '../core/gfx';
import { NIGHT, type Line } from '../data/story';
import { CHATS } from '../data/chats';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { POT_CORE, woodChair, CarRig, G, Merger, makePerson, makeCar, animatePerson, palmCrown, grassTufts, Person, type PersonLook } from '../entities/models';
import { buildStreet, STREET, CORRIDOR } from './homeStreet';
import { Door } from './door';
import { buildSurroundings } from './surround';
import { buildBorn, bornHeight, BORN, BORN_SOUTH_LANE, IMPERI } from './born';
import { Particles } from '../entities/fx';
import { PoolWater } from '../core/poolWater';
import { Trail } from '../core/follow';
import { PhysicsWorld, Body, beachBallTexture, type Mover } from '../core/physics';
import { hud, dialogue, fadeFlash, toast, phoneChat, Hud, DebugItem, later } from '../ui/ui';
import { embrace, type Embrace } from '../entities/embrace';
import { ROOF_GEO, type Box2 } from './ferreries';
import { canvasTex } from './deco';
import { clock, type Level, type LevelDone, disposeScene } from './level';
import { beacon } from '../core/beacon';

// Capítulo 2 · La piscinita: noche de piscina y estrellas, en casa de los padres de Gas.
// La casa sigue la foto de satélite: adosado de tejado plano con placas solares, terraza,
// jardín de césped con camino de losas por la derecha y la piscina al fondo.
// Empieza en el Bar Imperi con el chat real de esa noche. Azul va hacia Pins, Gas llega en el coche azul,
// van a Sa Son 69 B4 y no entran por la puerta: por el pasillo de la derecha hasta la piscina.
// Bucle: cruzar sin despertar a sus padres (la grava cruje, correr hace ruido y se encienden las
// ventanas de arriba) → desnudarse, al agua y abrazarse → nadar un rato juntos → salir por la escalera
// de la piscina → a pie hasta las toallas, en el césped del lado de la casa → hacer el amor (a pixeles) → hablar un
// rato → unir las estrellas → el chat real de la 01:01.
//
// El nado es de verdad: crol con el cuerpo tumbado en el agua, brazos que entran y salen, patada,
// y cada brazada empuja el agua de la malla de ondas (PoolWater); de pie, se mantiene a flote.

type Phase = 'intro' | 'atBar' | 'drive' | 'arrive' | 'toPool' | 'diving' | 'hug' | 'swim' | 'toTowels' | 'love' | 'stars' | 'ending' | 'done';

// Piscina (interior del vaso)
// La piscina ocupa todo el ancho de la casa; las tumbonas, al fondo
const POOL = { minX: -4.1, maxX: 4.1, minZ: 5.6, maxZ: 10.1 };
/** Todo el patio al mismo nivel: las únicas escaleras son las de la piscina. */
const LAWN_Y = 0;
/** Tumbados en la toalla: la espalda sobre la tela, en el suelo. */
const LIE_Y = LAWN_Y + 0.14;
const WATER_Y = -0.22;
// Nadando, el agua por los hombros (con -1,12 la cadera quedaba por encima del agua y parecían flotar de pie)
const SWIM_Y = -1.4;
/** Las dos toallas, en el césped entre la casa y la piscina. */
const TOWELS = new THREE.Vector3(1.6, LAWN_Y, 3.35);
/** Largo de la toalla: cabe él (1,85 m) de la cabeza a los pies. */
const TOWEL_LEN = 2.3;
/** Tumbado, la raíz (a los pies) queda en este z: los pies hacia la piscina y la cabeza hacia la casa. */
const LIE_FEET_Z = TOWELS.z + TOWEL_LEN / 2 - 0.3; // (los zapatos, dentro de la toalla)
/** La escalera para salir de la piscina, en su lado oeste. */
const LADDER = new THREE.Vector3(POOL.minX + 0.12, 0, 7.2);
const PLOT = { minX: CORRIDOR.minX + 0.2, maxX: 4.1, minZ: -26.6, maxZ: 13.62 };
// El Born de Ciutadella (con el Bar Imperi), lejos de casa: su calle del sur coincide con el carril
// de la carretera, así el coche azul usa el mismo carril en los dos sitios
const BORN_O = new THREE.Vector3(-600, 0, STREET.laneZ - BORN_SOUTH_LANE);
const BAR_AREA = { minX: BORN_O.x + BORN.minX + 0.4, maxX: BORN_O.x + 29.6, minZ: BORN_O.z + BORN.minZ + 0.4, maxZ: BORN_O.z + BORN.maxZ - 0.4 };
const BAR_START = new THREE.Vector3(BORN_O.x + IMPERI.x + 3.2, 0, BORN_O.z + IMPERI.z - 1);
/** Llegada a casa: calle, patio delantero y el pasillo lateral hasta el jardín. */
const HOME_AREA = PLOT;
// «Ve hacia Pins»: la esquina sureste de la explanada, junto a la calle por donde llega el coche
const PINS = new THREE.Vector3(BORN_O.x + 11, 0, STREET.laneZ + 1.9);
const CAR_START_X = PINS.x + 1.2;
const CAR_FAR_X = BORN_O.x - 14;
/** En la calle de casa, el coche entra desde aquí. */
const DRIVE_FROM_X = -46;
const CAR_STOP_X = -0.6;
const DRIVE_TIME = 7;
// Franja de grava entre la terraza y el césped: cruje al pisarla; las losas no
const GRAVEL = { minX: CORRIDOR.minX, maxX: -0.3, minZ: 1.9, maxZ: 4.6 };
const STONES: [number, number][] = [[-5.5, 2.2], [-5.35, 3.0], [-5.5, 3.8]];
const GAS_POOL = new THREE.Vector3(-5.45, 0, 8.6);
const NOISE_LIGHT = 0.55;
// Textos nuevos: si story.ts los trae, mandan esos; si no, estos.
const TXT = NIGHT as unknown as Record<string, unknown>;
const txt = <T,>(k: string, d: T): T => (TXT[k] as T | undefined) ?? d;
const T_SNEAK_HINT = () => txt<string>('sneakHint', 'Llega a la piscina sin hacer ruido: despacio y por las losas');
const T_LIGHT_ON = () => txt<string>('lightOn', '💡 Se ha encendido una luz arriba… ¡quieta!');
const T_CAUGHT = () => txt<Line[]>('caught', [{ who: 'Narrador', text: 'Se enciende una ventana. Quietos… y se apaga.' }]);
// Sin ropa: el mismo muñeco con todo del color de la piel
const nude = (l: PersonLook): PersonLook => ({ ...l, shirt: l.skin, pants: l.skin, shoes: l.skin, skirt: false, jumpsuit: false, shorts: false, stripes: undefined, nude: true });
/** Altura de la cadera sobre los pies, para tumbar al que nada con la espalda a ras de agua. */
const hipsOf = (p: Person) => p.rig?.hipsHeight ?? 0.7;

export class Level4 implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private phase: Phase = 'intro';
  private player: Person;
  private walker: Walker;
  private gas: Person;
  /** La puerta peatonal de casa: se abre al llegar y se cierra detrás. */
  private gate!: Door;
  private gateWho: THREE.Vector3[] = [];
  private looks!: { azul: [Person, Person]; gas: [Person, Person] };
  private clothes!: THREE.Object3D;
  private nudeOn = false;
  private pickedUp = false;
  private carT = 0;
  private hugT = 0;
  private hugE: Embrace | null = null;
  // Sigilo: ruido acumulado, ventanas de los padres y las veces que casi os pillan
  private noise = 0;
  private lightOn = false;
  private caught = 0;
  private winMat = new THREE.MeshBasicMaterial({ color: 0x1b2135 });
  private lastStep = 0;
  private hudChips = '-';
  private sky: Sky;
  private sun: Sun;
  private colliders: Box2[] = [];
  private solids: Circle[] = [];
  private swimT = 0;
  private waterTex: THREE.Texture;
  private pool!: PoolWater;
  private swimOut = false;
  private gasTrail = new Trail();
  /** Por dónde va Marc a pie, delante de ti: del coche a la verja, por el pasillo y hasta la piscina. */
  private gasPath: [number, number][] = [];
  private swimSt = new Map<Person, { k: number; ph: number; prev: number }>();
  /** La censura de la hamaca: un mosaico de píxeles grandes que tapa a los dos. */
  private mosaic!: THREE.Mesh;
  private mosaicData!: THREE.DataTexture;
  private mosaicT = 0;
  private ballMesh!: THREE.Mesh;
  private fireflies!: THREE.Points;
  private marker: THREE.Group;
  private busy = false;
  private t = 0;
  private diveT = 0;
  private diveV = new THREE.Vector3();
  private diveStage = 0;
  private divePitch = 0;
  // Física: pelota de playa que flota en la piscina, Azul la empuja; ondas en el agua
  private phys = new PhysicsWorld();
  private ball!: Body;
  private movers: Mover[] = [{ x: 0, z: 0, vx: 0, vz: 0, r: 0.35, height: 1.8 }];
  private rippleT = 0;
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
  private winTarget = new THREE.Color();
  private v2 = new THREE.Vector3();
  // Coche y viaje
  private car = makeCar(0x1f3a6b, { luggage: false, joy: false });
  private rig: CarRig | null = null;
  private carBox = { minX: 0, maxX: 0, minZ: STREET.laneZ - 0.95, maxZ: STREET.laneZ + 0.95, low: true };
  private driveT = 0;
  private driveTalkDone = false;
  private camLook = new THREE.Vector3();
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

    const street = buildStreet(sc);
    this.gate = street.gate;
    buildBorn(sc, this.colliders, BORN_O, { cars: true, night: true });
    for (const [x, z, i] of [[-8, 9, 14], [8, -9, 14], [IMPERI.x + 2, IMPERI.z, 12]]) {
      const l = new THREE.PointLight(0xffc27a, i, 16, 1.5);
      l.position.set(BORN_O.x + x, 4, BORN_O.z + z);
      sc.add(l);
    }
    this.colliders.push(...street.colliders, this.carBox);
    this.car.root.rotation.y = Math.PI / 2;
    this.car.azul.visible = false;
    this.placeCar(CAR_FAR_X);
    sc.add(this.car.root);
    // Faros encendidos
    const beams = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff3c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    beams.position.set(0, 0.7, 2.3);
    beams.scale.set(2.6, 1.2, 1);
    this.car.root.add(beams);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.copy(BAR_START);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = Math.PI / 2;

    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.copy(GAS_POOL);
    this.gas.root.rotation.y = Math.PI;
    this.gas.root.visible = false; // va en el coche
    sc.add(this.gas.root);
    // Versiones sin ropa para la piscina
    this.looks = { azul: [this.player, makePerson(nude(MARGAUX_LOOK))], gas: [this.gas, makePerson(nude(MARC_LOOK))] };
    for (const p of [this.looks.azul[1], this.looks.gas[1]]) {
      p.root.visible = false;
      // (la sombra de pega se quedaría flotando dentro del agua)
      p.root.traverse((o) => {
        if (o.userData.blob) o.visible = false;
      });
      sc.add(p.root);
    }
    // La ropa en el borde de la piscina, para cuando os la quitéis
    this.clothes = new Merger()
      .add(G.rbox, MARGAUX_LOOK.shirt, -4.95, 0.08, 5.6, 0, 0.4, 0, 0.6, 0.14, 0.45)
      .add(G.rbox, MARC_LOOK.shirt, -5.5, 0.08, 6.1, 0, -0.3, 0, 0.6, 0.16, 0.5)
      .add(G.rbox, MARC_LOOK.pants, -5.45, 0.2, 6.15, 0, 0.2, 0, 0.5, 0.1, 0.4)
      .mesh();
    this.clothes.visible = false;
    sc.add(this.clothes);


    // Flecha de objetivo
    this.marker = new THREE.Group();
    const am = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    this.marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16).rotateX(Math.PI), am), new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 10).translate(0, 0.4, 0), am));
    sc.add(this.marker);

    this.buildConstellation();
    this.buildMosaic();

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.updateHud();
    this.camera.position.set(BAR_START.x + 6, 2.4, BAR_START.z - 1);
    this.camLook.set(BORN_O.x + IMPERI.x, 2.2, BORN_O.z + IMPERI.z);
    this.busy = true;
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(NIGHT.intro, () =>
        phoneChat(CHATS.imperi, () => {
          if (this.phase !== 'intro') return;
          this.busy = false;
          this.phase = 'atBar';
          this.updateHud();
        }),
      );
    }, 2300);
    audio.startMusic('night');
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Construcción ----------------

  /** Cáusticas del fondo: la red de líneas de luz de una piscina (ruido celular que empalma por los bordes). */
  private causticTexture() {
    const S = 256, N = 34;
    const pts = Array.from({ length: N }, () => [Math.random() * S, Math.random() * S]);
    const t = canvasTex((ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let f1 = 1e9, f2 = 1e9;
          for (const [px, py] of pts) {
            let dx = Math.abs(px - x), dy = Math.abs(py - y);
            if (dx > S / 2) dx = S - dx;
            if (dy > S / 2) dy = S - dy;
            const d = Math.hypot(dx, dy);
            if (d < f1) {
              f2 = f1;
              f1 = d;
            } else if (d < f2) f2 = d;
          }
          const l = Math.pow(Math.max(0, 1 - (f2 - f1) / 9), 3);
          const i = (y * w + x) * 4;
          img.data[i] = 26 + l * 150;
          img.data[i + 1] = 138 + l * 105;
          img.data[i + 2] = 190 + l * 60;
          img.data[i + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    }, S, S);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1.2);
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
    const WALL = 0xeec26a; // amarillo, como la fachada a la calle

    // Suelo: césped alrededor del hueco de la piscina, y los jardines vecinos
    const lawn = new Merger();
    this.ground(lawn, -4.5, POOL.minX - 0.35, 1.5, 14.5, GRASS);
    this.ground(lawn, POOL.maxX + 0.35, 4.5, 1.5, 14.5, GRASS);
    this.ground(lawn, POOL.minX - 0.35, POOL.maxX + 0.35, 1.5, POOL.minZ - 0.35, GRASS);
    this.ground(lawn, POOL.minX - 0.35, POOL.maxX + 0.35, POOL.maxZ + 0.35, 14.5, GRASS);
    for (const [x0, x1] of [[-16, CORRIDOR.wallX], [4.5, 13.6]]) this.ground(lawn, x0, x1, 0, 14.7, NEIGH);
    this.ground(lawn, -16, 13.6, 14.5, 15, NEIGH);
    const lawnMesh = lawn.mesh();
    lawnMesh.userData.noCast = true;
    sc.add(lawnMesh);
    // Alrededores: el resto de la urbanización, con casas, pinos y lomas al fondo (nada de horizonte vacío)
    buildSurroundings(sc, {
      keepOut: [{ minX: -66, maxX: 36, minZ: -40, maxZ: -5 }, { minX: -16.5, maxX: 14, minZ: -6, maxZ: 15.2 }],
      half: 90,
      center: { x: -15, z: -10 },
      night: true,
      seed: 11,
      colliders: this.colliders,
      hole: { minX: POOL.minX - 0.4, maxX: POOL.maxX + 0.4, minZ: POOL.minZ - 0.4, maxZ: POOL.maxZ + 0.4 },
    });

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
    // El fondo, con las cáusticas moviéndose: se ve a través del agua
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2), toon({ map: this.waterTex, color: 0x8fd8ee, emissive: 0x1c7fa8, emissiveMap: this.waterTex, emissiveIntensity: 1.1, roughness: 0.6 }));
    floor.position.set(cx, -1.44, cz);
    floor.userData.noCast = true;
    sc.add(floor);
    m.add(G.box, 0x3584c8, cx, -0.75, POOL.minZ - 0.05, 0, 0, 0, pw, 1.5, 0.1);
    m.add(G.box, 0x3584c8, cx, -0.75, POOL.maxZ + 0.05, 0, 0, 0, pw, 1.5, 0.1);
    m.add(G.box, 0x3584c8, POOL.minX - 0.05, -0.75, cz, 0, 0, 0, 0.1, 1.5, pd);
    m.add(G.box, 0x3584c8, POOL.maxX + 0.05, -0.75, cz, 0, 0, 0, 0.1, 1.5, pd);
    // Escalera de la piscina, en el lado de las losas: pasamanos curvos y peldaños
    for (const dz of [-0.28, 0.28]) {
      m.add(G.cyl, 0xd0d6dc, LADDER.x - 0.08, -0.3, LADDER.z + dz, 0, 0, 0.08, 0.05, 1.5, 0.05);
      m.add(G.cyl, 0xd0d6dc, LADDER.x - 0.34, 0.62, LADDER.z + dz, 0, 0, 1.2, 0.05, 0.62, 0.05);
      m.add(G.cyl, 0xd0d6dc, LADDER.x - 0.62, 0.42, LADDER.z + dz, 0, 0, 0, 0.05, 0.6, 0.05);
    }
    for (const y of [-0.15, -0.5, -0.85]) m.add(G.box, 0xe8ecef, LADDER.x + 0.02, y, LADDER.z, 0, 0, 0, 0.14, 0.03, 0.54);
    this.pool = new PoolWater(POOL, WATER_Y, 0x1c9ec8, new THREE.Vector3(-0.5, 1, 0.4));
    sc.add(this.pool.mesh);
    this.colliders.push({ minX: POOL.minX - 0.1, maxX: POOL.maxX + 0.1, minZ: POOL.minZ - 0.1, maxZ: POOL.maxZ + 0.1, low: true });
    this.buildPoolPhysics();

    // Pasillo lateral de baldosas: de la calle a la piscina sin entrar en casa
    this.ground(m, CORRIDOR.wallX, -4.45, -15, 14.5, 0xcfc4ae, 0.015);
    for (let z = -14.5; z < 14.5; z += 1.2) m.add(G.box, 0xb9ad96, (CORRIDOR.wallX - 4.45) / 2, 0.022, z, 0, 0, 0, 1.95, 0.01, 0.04);
    // Muro del pasillo con apliques bajos
    m.add(G.box, 0xf4efe2, CORRIDOR.wallX, 1.0, -0.25, 0, 0, 0, 0.25, 2.0, 29.5);
    this.colliders.push({ minX: CORRIDOR.wallX - 0.15, maxX: CORRIDOR.wallX + 0.15, minZ: -15, maxZ: 14.6, low: true });
    for (const z of [-11, -5, 1]) m.add(G.box, 0xffd9a0, CORRIDOR.wallX + 0.15, 1.6, z, 0, 0, 0, 0.06, 0.18, 0.3);

    // La casa: adosado de tejado plano. Cuerpo delantero (2 plantas) y trasero más alto.
    m.add(G.box, WALL, 0, 3.2, -4.5, 0, 0, 0, 9, 6.4, 9);
    m.add(G.box, 0xe9dcc2, 0, 6.55, -4.5, 0, 0, 0, 9.2, 0.3, 9.2); // pretil
    // (por detrás de la fachada amarilla de la calle, no en su mismo plano: se pisaban y parpadeaban a cuadros)
    m.add(G.box, 0xe4d6bb, 0, 3.6, -11.93, 0, 0, 0, 9, 7.2, 5.86);
    m.add(G.box, 0x3a3030, 0, 7.3, -9.17, 0, 0, 0, 8.96, 0.5, 0.6); // franja oscura de la terraza de arriba
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
    const wm = new THREE.Mesh(windows.build(), glow);
    sc.add(wm);
    // Ventanas del dormitorio de los padres: a oscuras… hasta que hacéis ruido
    const up = new Merger();
    up.add(G.box, 0xffffff, -2.2, 4.6, 0.03, 0, 0, 0, 1.6, 1.4, 0.05);
    up.add(G.box, 0xffffff, 2.2, 4.6, 0.03, 0, 0, 0, 1.6, 1.4, 0.05);
    sc.add(new THREE.Mesh(up.build(), this.winMat));
    // Grava entre la terraza y el césped, con losas para pasar sin ruido
    const gravelTex = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#9d988d';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) {
        const v = 120 + Math.random() * 110;
        ctx.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
    gravelTex.repeat.set(4, 1);
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(GRAVEL.maxX - GRAVEL.minX, GRAVEL.maxZ - GRAVEL.minZ).rotateX(-Math.PI / 2), toon({ map: gravelTex, roughness: 1 }));
    gravel.position.set((GRAVEL.minX + GRAVEL.maxX) / 2, 0.025, (GRAVEL.minZ + GRAVEL.maxZ) / 2);
    gravel.userData.noCast = true;
    sc.add(gravel);
    for (const [x, z] of STONES) m.add(G.cyl, 0xe8dcc0, x, 0.04, z, 0, 0, 0, 0.7, 0.06, 0.6);
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
    woodChair(m, -1.75, 0.8, Math.PI / 2);
    woodChair(m, -0.25, 0.8, -Math.PI / 2);
    this.colliders.push({ minX: -2.1, maxX: 0.1, minZ: 0.3, maxZ: 1.3 });
    // Sombrilla azul en la esquina de la terraza
    m.add(G.cyl, 0xdddddd, 3.6, 1.2, 0.7, 0, 0, 0, 0.08, 2.4, 0.08);
    m.add(G.cone, 0x2b4fa0, 3.6, 2.5, 0.7, 0, 0, 0, 2.4, 0.6, 2.4);
    this.colliders.push({ minX: 3.45, maxX: 3.75, minZ: 0.55, maxZ: 0.85 });
    {
      // Dos toallas de playa, una al lado de la otra: rayas, rizo de la tela, flecos y alguna arruga
      const towel = (a: string, b: string) =>
        canvasTex((ctx, w, h) => {
          ctx.fillStyle = a;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = b;
          for (let y = 26; y < h - 20; y += 54) ctx.fillRect(0, y, w, 20);
          for (let i = 0; i < 7000; i++) {
            ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
          }
          ctx.fillStyle = '#efe9da';
          for (let x = 2; x < w; x += 7) {
            ctx.fillRect(x, 0, 3, 9);
            ctx.fillRect(x, h - 9, 3, 9);
          }
        }, 256, 512);
      for (const [sx, a, b, ry] of [[-0.42, '#2f6fb5', '#e9eef3', 0.015], [0.42, '#e8e0cc', '#c0503f', -0.02]] as const) {
        const g = new THREE.PlaneGeometry(0.8, TOWEL_LEN, 8, 20).rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) * 11 + pos.getZ(i) * 4 + sx * 5) * 0.004 + Math.sin(pos.getZ(i) * 13) * 0.003);
        g.computeVertexNormals();
        const t = new THREE.Mesh(g, toon({ map: towel(a, b), roughness: 1 }));
        t.position.set(TOWELS.x + sx, LAWN_Y + 0.022, TOWELS.z);
        t.rotation.y = ry;
        t.userData.noCast = true;
        sc.add(t);
      }
    }

    // Muros del jardín y setos
    m.add(G.box, 0xf4efe2, 4.6, 0.9, 7.25, 0, 0, 0, 0.25, 1.8, 14.5);
    this.colliders.push({ minX: 4.47, maxX: 4.73, minZ: 0, maxZ: 14.5, low: true });
    m.add(G.box, 0xf4efe2, (CORRIDOR.wallX + 4.6) / 2, 0.9, 14.6, 0, 0, 0, 4.6 - CORRIDOR.wallX + 0.2, 1.8, 0.25);
    m.add(G.box, 0x5f8f4e, -0.8, 1.0, 14.2, 0, 0, 0, 10, 2, 0.4); // (más claro: de noche, con la luna azul, un verde oscuro se quedaba en un muro negro)
    for (const [x, z] of [[-5.5, 10.9], [-3.8, 1.8], [3.9, 4.8]]) {
      m.add(G.cyl, 0xb5603b, x, 0.3, z, 0, 0, 0, 0.6, 0.6, 0.6);
      // La mata de la maceta: hojas de verdad (una bola de hojas recortadas parecía de alambre)
      m.add(G.sphere, POT_CORE, x, 0.92, z, 0, 0, 0, 0.703, 0.629, 0.703); // (por dentro, macizo: que no se vea a través de las hojas)
      m.add(G.bush, 0x3e7a3a, x, 0.92, z, 0, 0, 0, 0.95, 0.85, 0.95);
      m.add(G.bush, 0x4a8a44, x + 0.1, 1.1, z - 0.06, 0, 1.4, 0, 0.66, 0.6, 0.66);
      this.colliders.push({ minX: x - 0.42, maxX: x + 0.42, minZ: z - 0.42, maxZ: z + 0.42, round: true });
    }

    // Vecinos: casas de teja y sus piscinas
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? -11.5 : 9;
      m.add(G.box, 0xf3ead8, x, 3, -6, 0, 0, 0, 9, 6, 12);
      m.add(ROOF_GEO, 0xb8623e, x, 6, -6, 0, Math.PI / 2, 0, 12.2, 1.8, 9.4);
      m.add(G.box, 0xffd9a0, x, 1.3, 0.03, 0, 0, 0, 3, 2.2, 0.05);
      m.add(G.box, 0xf4efe2, x + sx * 4.5, 0.9, 7.25, 0, 0, 0, 0.25, 1.8, 14.5);
      m.add(G.box, 0xf4efe2, x, 0.9, 14.6, 0, 0, 0, 9, 1.8, 0.25);
    }
    // Piscinas vecinas: agua con su borde de piedra blanca
    for (const [x, z, w, d] of [[-12.1, 6.5, 3.2, 5], [-10.9, 12.2, 2.6, 2.4], [9.5, 8.5, 3, 4.6]]) {
      m.add(G.box, 0xe8e2d4, x, 0.04, z, 0, 0, 0, w + 0.7, 0.08, d + 0.7);
      m.add(G.box, 0x2f8fc0, x, 0.06, z, 0, 0, 0, w, 0.06, d);
    }
    // Palmera junto a la casa del vecino
    for (let i = 0; i < 6; i++) m.add(G.cyl, 0x6b5a40, -8.4 + Math.sin(i * 0.3) * 0.3, (i + 0.5) * 1.2, 2.6, 0, 0, 0.05, 0.4 - i * 0.03, 1.2, 0.4 - i * 0.03);
    palmCrown(m, -8.1, 7.1, 2.6, 2.8, 15);
    // Hierba de verdad en el césped: matas sueltas, menos debajo de las toallas
    grassTufts(m, -4.4, 4.4, 10.55, 14.1, 260, [0x47803c, 0x3f7236, 0x568a42], 5);
    grassTufts(m, -0.2, 4.4, 1.6, 5.15, 120, [0x47803c, 0x3f7236, 0x568a42], 8, (x, z) => (Math.abs(x - TOWELS.x) < 0.95 && Math.abs(z - TOWELS.z) < 1.15) || Math.hypot(x - 3.9, z - 4.8) < 0.5);
    grassTufts(m, -4.4, -4.5 + 0.1, 1.6, 10.5, 30, [0x47803c, 0x3f7236], 6);
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

  /** La censura: píxeles grandes de colores de piel, pelo y colchoneta, en un cartel que mira a la cámara. */
  private buildMosaic() {
    const W = 11, H = 7;
    this.mosaicData = new THREE.DataTexture(new Uint8Array(W * H * 4), W, H, THREE.RGBAFormat);
    this.mosaicData.magFilter = this.mosaicData.minFilter = THREE.NearestFilter;
    this.mosaicData.colorSpace = THREE.SRGBColorSpace;
    this.mosaic = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.72), new THREE.MeshBasicMaterial({ map: this.mosaicData, transparent: true, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    this.mosaic.visible = false;
    this.mosaic.renderOrder = 50;
    this.scene.add(this.mosaic);
    this.shuffleMosaic();
  }

  private shuffleMosaic() {
    const d = this.mosaicData.image.data as Uint8Array;
    const W = this.mosaicData.image.width, H = this.mosaicData.image.height;
    const pal = [MARGAUX_LOOK.skin, MARC_LOOK.skin, MARGAUX_LOOK.hair, MARC_LOOK.hair, 0xf1ecdf, 0xe2a98c, 0xc98e64];
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const e = Math.hypot((i - (W - 1) / 2) / (W / 2), (j - (H - 1) / 2) / (H / 2));
        const c = pal[Math.floor(Math.random() * pal.length)];
        const k = (j * W + i) * 4;
        const shade = 0.8 + Math.random() * 0.25;
        d[k] = Math.min(255, ((c >> 16) & 255) * shade);
        d[k + 1] = Math.min(255, ((c >> 8) & 255) * shade);
        d[k + 2] = Math.min(255, (c & 255) * shade);
        d[k + 3] = e > 1.02 ? 0 : 255;
      }
    this.mosaicData.needsUpdate = true;
  }

  /** Estrellas grandes que forman un corazón en el cielo, vistas desde las toallas. */
  private buildConstellation() {
    this.starCamPos.set(TOWELS.x, LIE_Y + 0.5, TOWELS.z - 0.9);
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
    let chips = '';
    if (this.phase === 'toPool') {
      const n = Math.min(6, Math.round(this.noise * 6));
      const seg = (on: boolean, i: number) =>
        `<i style="display:inline-block;width:7px;height:14px;margin-left:2px;border-radius:2px;vertical-align:-2px;background:${on ? (i >= 4 ? '#ff6b6b' : '#ffd166') : 'rgba(255,255,255,.25)'}"></i>`;
      chips = `<span class="chip">🤫 ${Array.from({ length: 6 }, (_, i) => seg(i < n, i)).join('')}</span>`;
    }
    if (chips !== this.hudChips) h.setCounters((this.hudChips = chips));
    switch (this.phase) {
      case 'intro':
      case 'atBar':
        h.setObjective(this.pickedUp ? 'Sube al coche azul' : 'Ve hacia Pins');
        break;
      case 'drive':
        h.setObjective('De camino a casa…');
        break;
      case 'arrive':
        h.setObjective('Por la puerta no: por el pasillo de la derecha, hasta la piscina 🤫');
        break;
      case 'toPool':
        h.setObjective(T_SNEAK_HINT());
        break;
      case 'hug':
        h.setObjective('🫂');
        break;
      case 'swim':
        h.setObjective(this.swimOut ? 'Sal por la escalera de la piscina' : 'Nada un rato con Marc 💙');
        break;
      case 'toTowels':
        h.setObjective('Ve a las toallas, al otro lado de la piscina');
        break;
      case 'love':
        h.setObjective('💙');
        break;
      case 'stars':
        h.setObjective('Une las estrellas en orden');
        break;
      default:
        h.setObjective('💙');
    }
  }

  private target(): THREE.Vector3 | null {
    if (this.phase === 'atBar') return this.pickedUp ? this.carDoor() : PINS;
    if (this.phase === 'arrive') {
      // Desde la calle, primero a la verja peatonal (el pasillo queda detrás del muro); ya dentro, al pasillo
      if (this.player.root.position.z < STREET.wallZ + 0.4) return this.v2.set((STREET.gate.minX + STREET.gate.maxX) / 2, 0, STREET.wallZ + 2.2); // (algo dentro: la flecha no se apaga hasta haber pasado la verja)
      return this.v2.set((CORRIDOR.minX + CORRIDOR.maxX) / 2, 0, -14.4);
    }
    if (this.phase === 'toPool') return this.v2.set(-4.95, 0, (POOL.minZ + POOL.maxZ) / 2);
    if (this.phase === 'swim' && this.swimOut) return LADDER;
    if (this.phase === 'toTowels') {
      return TOWELS;
    }
    return null;
  }

  // ---------------- Bucle ----------------

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.gateWho.length = 0;
    for (const p of [this.player, this.gas]) if (p.root.visible) this.gateWho.push(p.root.position);
    this.gate.update(dt, this.gateWho, this.camera.position);
    if (this.phase !== 'intro' && this.phase !== 'done' && this.phase !== 'ending') this.playTime += dt;
    this.waterTex.offset.set(Math.sin(this.t * 0.3) * 0.2, this.t * 0.03);
    if (this.player.root.position.x > -100) this.pool.update(dt);
    const ffp = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ffp.count; i++) ffp.setY(i, ffp.getY(i) + Math.sin(this.t * 1.3 + i) * dt * 0.25);
    ffp.needsUpdate = true;
    (this.fireflies.material as THREE.PointsMaterial).opacity = 0.6 + Math.sin(this.t * 3) * 0.3;

    const swimming = this.phase === 'swim';
    const onFoot = this.phase === 'atBar' || this.phase === 'arrive' || this.phase === 'toPool' || this.phase === 'toTowels';
    const walking = !this.busy && (onFoot || swimming);
    this.walker.turn(this.input.consumeCam());
    const pp = this.player.root.position;

    if (this.phase === 'diving') this.updateDive(dt);
    else if (this.phase === 'drive') this.updateDrive(dt);
    else if (this.phase === 'hug') this.updateHug(dt);
    else if (this.phase === 'love') this.updateLove(dt);
    else if (this.phase !== 'stars' && this.phase !== 'ending' && this.phase !== 'done') {
      // Nadando no se corre: la velocidad sube y baja con cada brazada y el agua frena y deja deslizar
      const stroke = this.swimSt.get(this.player);
      this.walker.speed = swimming ? 1.5 + 0.8 * Math.max(0, Math.sin(stroke?.ph ?? 0)) : 5.0;
      this.walker.traction = swimming ? 0.28 : 1;
      this.solids.length = 0;
      if (this.phase !== 'toTowels') this.solids.push({ x: this.gas.root.position.x, z: this.gas.root.position.z, r: 0.35 });
      const bounds = swimming
        ? { minX: POOL.minX + 0.85, maxX: POOL.maxX - 0.85, minZ: POOL.minZ + 0.85, maxZ: POOL.maxZ - 0.85 } // (tumbado, la cabeza va por delante)
        : this.phase === 'intro' || this.phase === 'atBar'
          ? BAR_AREA
          : this.phase === 'arrive'
            ? HOME_AREA
            : PLOT;
      this.walker.canJump = walking && !swimming;
      const move = this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, swimming ? [] : this.colliders, bounds, this.solids);
      // En el Born, la explanada del obelisco está un escalón más alta que la calle (más el salto)
      if (this.phase === 'intro' || this.phase === 'atBar') pp.y = bornHeight(pp.x - BORN_O.x, pp.z - BORN_O.z) + this.walker.hop;
      this.player.root.rotation.y = this.walker.facing;
      if (swimming) this.swimPose(this.player, move, dt);
      else animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    }

    this.updateGas(dt);
    if (this.phase === 'atBar') this.updatePickup(dt);
    // (en cuanto se llega a donde marcaba la columna de luz: si no, se quedaba una parada delante del pasillo sin que pasara nada)
    if (this.phase === 'arrive' && !this.busy && pp.x < CORRIDOR.maxX + 0.1 && pp.z > -15.7) this.enterCorridor();
    if (this.phase === 'toPool' && !this.busy) this.updateSneak(dt);
    this.updatePoolPhysics(dt);

    // Un rato nadando juntos, sin prisa; luego, por la escalera y al césped, a pie
    if (this.phase === 'swim' && swimming && !this.busy && !this.swimOut) {
      this.swimT += dt;
      if (this.swimT > 12) {
        this.swimOut = true;
        this.updateHud();
      }
    }

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    if (!this.busy && this.phase === 'atBar' && this.pickedUp && pp.distanceTo(this.carDoor()) < 1.5) {
      label = '🚗 Subir al coche';
      action = () => this.boardCar();
    } else if (!this.busy && this.phase === 'toPool' && this.nearPoolEdge()) {
      label = '👙 Fuera ropa';
      action = () => this.undress();
    } else if (!this.busy && this.phase === 'swim' && this.swimOut && Math.hypot(pp.x - LADDER.x, pp.z - LADDER.z) < 1.7) {
      label = '🪜 Salir del agua';
      action = () => this.climbOut();
    } else if (!this.busy && this.phase === 'toTowels' && Math.hypot(pp.x - TOWELS.x, pp.z - TOWELS.z) < 2.2 && pp.y > LAWN_Y - 0.1) {
      label = '💙 Hacer el amor';
      action = () => this.makeLove();
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
      beacon.at(pp.distanceTo(tgt) < 2 ? null : tgt);
    } else {
      this.hud.setArrow(null);
      beacon.at(null);
    }

    this.updateShooting(dt);
    if (this.phase === 'stars' || this.phase === 'ending' || this.phase === 'done') this.updateStars(dt);
    else if (this.phase === 'intro') {
      // Plano fijo de la fachada del bar mientras se presenta la escena
      this.camera.lookAt(this.camLook);
    } else if (this.phase === 'drive') {
      const c = this.car.root.position;
      this.v1.set(c.x - 7.5, 3.2, c.z - 4.2);
      this.camera.position.lerp(this.v1, Math.min(1, dt * 3));
      this.camLook.lerp(this.v2.set(c.x + 3, 1, c.z), Math.min(1, dt * 4));
      this.camera.lookAt(this.camLook);
    } else if (this.phase === 'love') {
      this.camera.lookAt(this.camLook);
    } else {
      // En el pasillo estrecho, la cámara se pone en su eje: detrás de Azul, sin atravesar la casa ni
      // ver solo tejados desde arriba
      const inCorridor = pp.x < -4.4 && pp.x > CORRIDOR.wallX && pp.z > -15 && pp.z < 8;
      if (inCorridor) {
        const axis = Math.abs(Math.atan2(Math.sin(this.walker.yaw), Math.cos(this.walker.yaw))) < Math.PI / 2 ? 0 : Math.PI;
        this.walker.yaw += Math.atan2(Math.sin(axis - this.walker.yaw), Math.cos(axis - this.walker.yaw)) * Math.min(1, dt * 4);
      }
      // Nadando, plano alto y abierto: se ve la piscina entera y no solo su nuca
      const swimCam = swimming || this.phase === 'hug';
      this.walker.camera(this.camera, dt, this.colliders, swimCam ? 5.6 : 6.5, swimCam ? 5.4 : 3.6);
    }
    this.sun.follow(this.phase === 'drive' ? this.car.root.position : pp);
    this.sky.update(this.camera, dt);
  }

  private nearPoolEdge() {
    const p = this.player.root.position;
    const dx = Math.max(POOL.minX - p.x, 0, p.x - POOL.maxX);
    const dz = Math.max(POOL.minZ - p.z, 0, p.z - POOL.maxZ);
    return Math.hypot(dx, dz) < 1.2;
  }

  private buildPoolPhysics() {
    const ph = this.phys;
    ph.walls = this.colliders.filter((c) => !(c.minX === POOL.minX - 0.1 && c.maxZ === POOL.maxZ + 0.1));
    ph.bounds = PLOT;
    ph.water = { box: POOL, level: WATER_Y };
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), toon({ map: beachBallTexture(), roughness: 0.35 }));
    ball.castShadow = true;
    this.scene.add(ball);
    this.ballMesh = ball;
    this.ball = new Body(ball, { kind: 'ball', r: 0.3, mass: 0.12, bounce: 0.7, drag: 0.22, density: 0.06 });
    this.ball.pos.set(2.6, WATER_Y + 0.4, 8.2);
    ph.add(this.ball);
  }

  /** Empuja el agua: la onda sale de ahí y rebota en las paredes. */
  private ripple(x: number, z: number, size = 1) {
    this.pool.disturb(x, z, -0.55 * size, 0.2 + size * 0.1);
  }

  private updatePoolPhysics(dt: number) {
    const pp = this.player.root.position;
    const a = this.movers[0];
    const swimming = this.phase === 'swim' || this.phase === 'diving';
    a.x = pp.x;
    a.z = pp.z;
    a.vx = this.walker.vx;
    a.vz = this.walker.vz;
    a.height = this.player.root.visible ? 1.8 : -10;
    const wasY = this.ball.pos.y;
    this.phys.step(dt, this.movers);
    const bp = this.ball.pos;
    const inPool = bp.x > POOL.minX && bp.x < POOL.maxX && bp.z > POOL.minZ && bp.z < POOL.maxZ;
    if (inPool) this.ballMesh.position.y += this.pool.height(bp.x, bp.z);
    if (inPool && wasY - this.ball.r > WATER_Y && bp.y - this.ball.r <= WATER_Y) {
      this.ripple(bp.x, bp.z, 1.2);
      audio.knock(0.35, 700, 0.18);
    }
    for (const im of this.phys.impacts) if (im.at.distanceTo(pp) < 12) audio.knock(Math.min(0.5, im.strength * 2), 520, 0.1);
    // La pelota, al moverse, también abre ondas (las de los que nadan las hace cada brazada)
    this.rippleT -= dt;
    if (this.rippleT <= 0) {
      this.rippleT = 0.25;
      if (inPool && Math.hypot(this.ball.vel.x, this.ball.vel.z) > 0.25) this.ripple(bp.x, bp.z, 0.5);
      if (swimming && this.phase === 'swim' && this.walker.currentSpeed > 0.5) this.pool.disturb(pp.x + Math.sin(this.walker.facing) * 0.75, pp.z + Math.cos(this.walker.facing) * 0.75, 0.35, 0.3); // la ola de proa
    }
  }

  /**
   * Nadar de verdad. Parado: de pie en el agua, a flote, moviendo brazos y piernas despacio. En marcha:
   * crol, con el cuerpo tumbado a ras de agua (gira desde la cadera, y las piernas con él), brazos que
   * entran por delante, tiran bajo el agua y vuelven por encima con el codo alto, patada corta, el cuerpo
   * rodando con cada brazada y la cabeza mirando al frente. Cada mano que entra empuja el agua y salpica.
   */
  private swimPose(p: Person, move: number, dt: number) {
    let st = this.swimSt.get(p);
    if (!st) this.swimSt.set(p, (st = { k: 0, ph: Math.random() * 6, prev: 0 }));
    st.k += ((move > 0.12 ? 1 : 0) - st.k) * Math.min(1, dt * 2.6);
    const k = st.k;
    const K = k * k * (3 - 2 * k);
    st.ph += dt * (1.2 + K * (2.4 + move * 2));
    const ph = st.ph;
    animatePerson(p, dt, 'idle');
    if (p.rig) p.rig.force = { body: 1, head: 1, armL: 1, armR: 1, legL: 1, legR: 1 };
    const lerp = THREE.MathUtils.lerp;
    const TAU = Math.PI * 2;
    // Altura: de pie, con los hombros fuera; tumbado, la espalda a ras de agua. Sube y baja con la brazada
    const lay = WATER_Y - 0.05 - hipsOf(p);
    const pos = p.root.position;
    const surf = this.pool.height(pos.x, pos.z);
    pos.y = lerp(SWIM_Y + Math.sin(this.t * 1.7 + ph * 0.1) * 0.05, lay + Math.sin(ph * 2) * 0.025, K) + surf;
    p.body.rotation.x = lerp(0.1, 1.36, K);
    p.body.rotation.y = Math.sin(ph) * 0.24 * K; // rueda a un lado y a otro
    p.body.rotation.z = 0;
    p.head.rotation.x = lerp(0.05, -1.05, K);
    p.head.rotation.y = K * Math.max(0, Math.sin(ph)) * Math.sin(ph) * -0.5; // respira de lado
    const arm = (a: THREE.Object3D, el: THREE.Object3D, off: number, side: number) => {
      const w = (ph + off) % TAU;
      const rx = -Math.PI + w; // -π por delante · 0 a la altura de la cadera, ya bajo el agua · π/2 por encima de la espalda
      const rec = rx > 0 ? Math.sin(rx) : 0; // vuelve por fuera del agua
      const pull = rx < 0 ? Math.sin(-rx) : 0;
      const tread = Math.sin(this.t * 1.6 + off) * 0.35;
      a.rotation.x = lerp(-0.45 + tread * 0.5, rx, K);
      a.rotation.y = 0;
      a.rotation.z = side * lerp(1.05 + tread * 0.4, 0.12 + rec * 0.3, K);
      el.rotation.x = lerp(-0.5 + tread * 0.3, -0.25 - rec * 1.25 - pull * 0.55, K);
    };
    arm(p.armL, p.elbowL, 0, -1);
    arm(p.armR, p.elbowR, Math.PI, 1);
    const kick = Math.sin(ph * 3) * 0.2 * K;
    const tr = Math.sin(this.t * 1.3) * 0.3 * (1 - K);
    p.legL.rotation.set(kick + tr - 0.05, 0, 0.03);
    p.legR.rotation.set(-kick - tr - 0.05, 0, -0.03);
    p.kneeL.rotation.x = lerp(0.35 + Math.max(0, tr), 0.14 + Math.max(0, kick), K);
    p.kneeR.rotation.x = lerp(0.35 + Math.max(0, -tr), 0.14 + Math.max(0, -kick), K);
    p.footL.rotation.x = p.footR.rotation.x = K * 0.7; // punta estirada
    // Una mano entra en el agua: empuja el agua y salpica. Y al patear, espuma detrás
    const yaw = p.root.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const q = Math.floor((ph % TAU) / Math.PI);
    if (K > 0.5 && q !== st.prev) {
      st.prev = q;
      const sx = q ? 0.22 : -0.22;
      const hx = pos.x + fx * 0.85 + fz * sx, hz = pos.z + fz * 0.85 - fx * sx;
      this.pool.disturb(hx, hz, -1.5, 0.2);
      this.fx.burst(this.v1.set(hx, WATER_Y + 0.08, hz), 'drop', 7, 0.7, 0.55);
      audio.knock(0.1, 900 + Math.random() * 300, 0.05);
    }
    if (K > 0.5 && Math.random() < dt * 9) {
      const bx = pos.x - fx * 0.85, bz = pos.z - fz * 0.85;
      this.pool.disturb(bx, bz, 0.5, 0.18);
      if (Math.random() < 0.35) this.fx.burst(this.v1.set(bx, WATER_Y + 0.05, bz), 'drop', 2, 0.35, 0.3);
    }
  }

  private updateGas(dt: number) {
    const g = this.gas;
    if (!g.root.visible) return;
    if (this.phase !== 'swim') g.root.rotation.z = 0;
    if (this.phase === 'swim') {
      // Gas nada en círculos lentos por la piscina
      const a = this.t * 0.3;
      const x = Math.cos(a) * 2.6;
      const z = 7.6 + Math.sin(a) * 1.1;
      // Flota: sube y baja con cada brazada y se balancea un poco
      g.root.position.set(x, g.root.position.y, z);
      g.root.rotation.y = Math.atan2(-Math.sin(a) * 2.6, Math.cos(a) * 1.1);
      this.swimPose(g, 0.6, dt);
    } else if (this.phase === 'toTowels') {
      // Te sigue a pie
      const pp = this.player.root.position;
      const moving = this.gasTrail.step(g.root, pp, 1.5, 4.2, dt, this.colliders, 0.26);
      g.root.position.y = 0;
      animatePerson(g, dt, moving ? 'walk' : 'idle', moving ? Math.max(0.35, this.gasTrail.pace) : 0);
      if (!moving) g.root.rotation.y = Math.atan2(pp.x - g.root.position.x, pp.z - g.root.position.z);
    } else if (this.phase === 'love' || this.phase === 'stars' || this.phase === 'ending' || this.phase === 'done') {
      animatePerson(g, dt, 'idle');
      g.eyes.scale.y = 1;
    } else if (this.phase === 'diving') {
      this.swimPose(g, 0, dt);
    } else if (this.phase === 'hug') {
      return;
    } else if (this.gasPath.length) {
      // Va delante a su paso; si te quedas atrás, te espera
      const p = this.player.root.position;
      const gp = g.root.position;
      const [tx, tz] = this.gasPath[0];
      const dx = tx - gp.x, dz = tz - gp.z, d = Math.hypot(dx, dz);
      if (d < 0.15) this.gasPath.shift();
      if (Math.hypot(p.x - gp.x, p.z - gp.z) > 9 || (this.busy && this.gasPath.length < 3)) {
        animatePerson(g, dt, 'idle');
        faceTo(g.root, Math.atan2(p.x - gp.x, p.z - gp.z), dt, 4);
      } else if (d > 0.01) {
        const st = Math.min(d, 2.5 * dt);
        gp.x += (dx / d) * st;
        gp.z += (dz / d) * st;
        faceTo(g.root, Math.atan2(dx, dz), dt, 7);
        animatePerson(g, dt, 'walk', 0.7);
      }
    } else {
      animatePerson(g, dt, 'wave');
      const p = this.player.root.position;
      faceTo(g.root, Math.atan2(p.x - g.root.position.x, p.z - g.root.position.z), dt, 4);
    }
  }

  private onStone(x: number, z: number) {
    return STONES.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.4);
  }

  /** Sigilo: la grava cruje, correr retumba, y si el ruido sube se encienden las ventanas de los padres. */
  private updateSneak(dt: number) {
    const p = this.player.root.position;
    const sp = Math.min(this.walker.speed, this.walker.currentSpeed);
    const gravel = p.x > GRAVEL.minX && p.x < GRAVEL.maxX && p.z > GRAVEL.minZ && p.z < GRAVEL.maxZ && !this.onStone(p.x, p.z);
    if (gravel && sp > 0.3) this.noise += dt * (0.3 + sp * 0.22);
    else this.noise += dt * Math.max(0, sp - 2.6) * 0.6;
    this.noise = Math.max(0, this.noise - dt * 0.2);
    // Cada pisada en la grava, un crujido
    const step = Math.floor(this.walker.walk / Math.PI);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if (gravel) audio.knock(0.25 + sp * 0.06, 2600 + Math.random() * 900, 0.05);
    }
    if (this.noise > 0.35 && Math.random() < dt * 1.5) this.fx.burst(this.v1.copy(this.gas.root.position).setY(2.3), '🤫', 1, 0.5, 0.6);
    const on = this.noise > NOISE_LIGHT;
    if (on !== this.lightOn) {
      this.lightOn = on;
      if (on) {
        toast(T_LIGHT_ON());
        audio.warn();
        vibrate(20);
      }
    }
    this.winMat.color.lerp(this.winTarget.setRGB(on ? 1 : 0.105, on ? 0.86 : 0.13, on ? 0.6 : 0.21), Math.min(1, dt * 6));
    if (this.noise >= 1) this.wakeParents();
    this.updateHud();
  }

  private wakeParents() {
    this.busy = true;
    this.caught++;
    this.walker.stop();
    this.input.reset();
    this.hud.setAction(null);
    audio.hit();
    vibrate(60);
    dialogue(T_CAUGHT(), () => {
      fadeFlash(() => {
        this.noise = 0;
        this.lightOn = false;
        this.player.root.position.set(-5.45, 0, -1.2);
        this.walker.yaw = this.walker.facing = 0;
        this.walker.stop();
        this.busy = false;
        this.updateHud();
      });
    });
  }

  // ---------------- Bar Imperi y viaje a casa ----------------

  private placeCar(x: number) {
    this.car.root.position.set(x, 0, STREET.laneZ);
    this.carBox.minX = x - 2.0;
    this.carBox.maxX = x + 2.0;
  }

  /** Puerta del copiloto, del lado de la acera. */
  private carDoor() {
    return this.v2.set(this.car.root.position.x + 0.2, 0, STREET.laneZ + 1.35);
  }

  private boardCar() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    audio.pop();
    fadeFlash(() => {
      this.player.root.visible = false;
      this.car.azul.visible = true;
      this.phase = 'drive';
      this.driveT = 0;
      this.driveTalkDone = false;
      // Del Born a casa: el coche aparece ya en la calle de casa
      this.placeCar(DRIVE_FROM_X);
      this.camera.position.set(DRIVE_FROM_X - 7.5, 3.2, STREET.laneZ - 4.2);
      this.camLook.copy(this.car.root.position);
      this.driveTalkDone = true;
      this.updateHud();
    }, 250);
  }

  private updateDrive(dt: number) {
    this.driveT += dt;
    const k = Math.min(1, this.driveT / DRIVE_TIME);
    const e = k * k * (3 - 2 * k);
    const prev = this.car.root.position.x;
    this.placeCar(THREE.MathUtils.lerp(DRIVE_FROM_X, CAR_STOP_X, e));
    const dx = this.car.root.position.x - prev;
    if (!this.rig) this.rig = new CarRig(this.car);
    this.rig.update(dt, dt > 0 ? dx / dt : 0, 0, 1.4); // calle de pueblo: algo más de bache
    if (k >= 1 && this.driveTalkDone && this.busy && this.phase === 'drive') {
      this.phase = 'arrive';
      fadeFlash(() => this.arriveHome());
    }
  }

  /** Bajan del coche delante de casa; Gas abre la puerta peatonal. */
  private arriveHome() {
    this.phase = 'arrive';
    this.placeCar(CAR_STOP_X);
    this.car.azul.visible = false;
    this.player.root.visible = true;
    this.player.root.position.set(CAR_STOP_X - 1.2, 0, STREET.laneZ + 1.6);
    this.walker.yaw = this.walker.facing = 0;
    this.camera.position.set(this.player.root.position.x, 3.6, this.player.root.position.z - 6.5);
    // Marc se baja por su lado, rodea el morro y va delante: abre la verja y entra por el pasillo
    this.gas.root.visible = true;
    const gx = (STREET.gate.minX + STREET.gate.maxX) / 2;
    const cx = (CORRIDOR.minX + CORRIDOR.maxX) / 2;
    this.gas.root.position.set(CAR_STOP_X + 0.3, 0, STREET.laneZ - 1.15);
    this.gasPath = [[CAR_STOP_X + 3, STREET.laneZ - 1.15], [CAR_STOP_X + 3, STREET.laneZ + 1.5], [gx, STREET.laneZ + 1.5], [gx, STREET.wallZ + 1.6], [cx, STREET.wallZ + 2.6], [cx, -15.4], [GAS_POOL.x, GAS_POOL.z]];
    this.updateHud();
    dialogue(NIGHT.arrive, () => {
      this.busy = false;
    });
  }

  /** Entra en el pasillo: Gas va delante hasta la piscina y empieza el sigilo. */
  private enterCorridor() {
    this.phase = 'toPool';
    this.noise = 0;
    this.updateHud();
    toast('🤫 Silencio full');
  }

  /** Bar Imperi → Pins: al llegar, el chat real de la recogida mientras llega el coche azul. */
  private updatePickup(dt: number) {
    const pp = this.player.root.position;
    if (!this.pickedUp && !this.busy && this.carT === 0 && Math.hypot(pp.x - PINS.x, pp.z - PINS.z) < 2.4) {
      this.busy = true;
      this.walker.stop();
      this.input.reset();
      this.hud.setAction(null);
      this.carT = 0.001;
      phoneChat(CHATS.pins, () => {
        this.pickedUp = true;
        this.busy = false;
        this.updateHud();
      });
    }
    if (this.carT > 0 && this.carT < 5) {
      const prev = this.car.root.position.x;
      this.carT += dt;
      const k = Math.min(1, this.carT / 5);
      this.placeCar(THREE.MathUtils.lerp(CAR_FAR_X, CAR_START_X, 1 - (1 - k) * (1 - k)));
      if (!this.rig) this.rig = new CarRig(this.car);
      this.rig.update(dt, dt > 0 ? (this.car.root.position.x - prev) / dt : 0, 0, 1.4);
    }
  }

  /** Sin ropa (o vestidos otra vez): cambia los muñecos manteniendo sitio y postura. */
  private setNude(on: boolean) {
    if (on === this.nudeOn) return;
    this.nudeOn = on;
    const swap = (pair: [Person, Person]) => {
      const [from, to] = on ? pair : [pair[1], pair[0]];
      to.root.position.copy(from.root.position);
      to.root.rotation.copy(from.root.rotation);
      to.root.visible = from.root.visible;
      from.root.visible = false;
      return to;
    };
    this.player = swap(this.looks.azul);
    this.gas = swap(this.looks.gas);
    // El control (y la cámara) siguen al modelo visible: si no, al nadar se movía el vestido, invisible
    this.walker.attach(this.player.root.position);
    this.clothes.visible = on;
  }

  private undress() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    this.walker.stop();
    fadeFlash(() => {
      this.setNude(true);
      this.gas.root.position.set(-2.4, SWIM_Y, 7.6);
      this.startDive();
    }, 500);
  }

  /** En el agua, Gas viene nadando y os abrazáis antes de jugar. */
  private startHug() {
    this.phase = 'hug';
    this.hugT = 0;
    this.busy = true;
    this.updateHud();
  }

  private updateHug(dt: number) {
    this.hugT += dt;
    const p = this.player.root.position;
    const g = this.gas.root.position;
    const yaw = this.walker.facing;
    // Gas se pone delante de ella y se miran
    this.v1.set(p.x + Math.sin(yaw) * 0.5, SWIM_Y, p.z + Math.cos(yaw) * 0.5);
    g.lerp(this.v1, Math.min(1, dt * (this.hugT < 1.6 ? 1.6 : 6)));
    this.gas.root.rotation.y = Math.atan2(p.x - g.x, p.z - g.z);
    this.player.root.rotation.y = Math.atan2(g.x - p.x, g.z - p.z);
    const close = g.distanceTo(this.v1) < 0.15;
    for (const q of [this.player, this.gas]) {
      if (close) {
        // Abrazados no nadan: el abrazo manda en los brazos
        if (q.rig) q.rig.force = undefined;
        animatePerson(q, dt, 'idle');
        q.body.rotation.set(0, 0, 0);
        q.head.rotation.set(0, 0, 0);
        q.root.position.y = SWIM_Y + 0.12;
      } else this.swimPose(q, 0, dt);
    }
    // El abrazo: se rodean con los brazos de verdad y se sueltan al final
    if (close) this.hugE ??= embrace(this.player, this.gas, 'hug');
    if (this.hugE) this.hugE.k = THREE.MathUtils.clamp(this.hugE.k + dt * (this.hugT < 4.3 ? 1.2 : -1.6), 0, 1);
    if (this.hugT > 5) {
      this.hugE?.stop();
      this.hugE = null;
      this.phase = 'swim';
      this.swimT = 0;
      this.busy = false;
      this.updateHud();
    }
  }

  /** Coloca a todos en el jardín, saliendo por la cristalera. */
  private toGarden() {
    this.player.root.visible = true;
    this.player.root.position.set(-5.45, 0, -3);
    this.walker.yaw = this.walker.facing = 0;
    this.camera.position.set(-5.45, 4, -9);
    this.car.azul.visible = false;
    this.placeCar(CAR_STOP_X);
    this.gas.root.visible = true;
    this.gas.root.position.copy(GAS_POOL);
    this.gas.root.rotation.set(0, Math.PI, 0);
    this.gasPath = [];
    this.walker.stop();
    this.noise = 0;
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
    // Salto balístico: impulso hacia arriba y hacia delante, la gravedad hace el resto
    const vy = 3.6;
    const entryY = SWIM_Y - 0.5;
    const T = (vy + Math.sqrt(vy * vy + 2 * 9.81 * (p.y - entryY))) / 9.81;
    this.diveV.set((this.diveTo.x - p.x) / T, vy, (this.diveTo.z - p.z) / T);
    this.diveStage = 0;
    this.divePitch = 0.2;
    this.walker.stop();
    this.hud.setAction(null);
    audio.whoosh();
  }

  private updateDive(dt: number) {
    this.diveT += dt;
    const p = this.player.root.position;
    const v = this.diveV;
    const h = Math.min(dt, 1 / 30);
    if (this.diveStage === 0) {
      // En el aire: parábola y el cuerpo apunta hacia donde va (cabeza abajo al entrar)
      v.y -= 9.81 * h;
      p.addScaledVector(v, h);
      animatePerson(this.player, dt, 'cheer');
      const pitch = Math.PI / 2 - Math.atan2(v.y, Math.hypot(v.x, v.z));
      this.divePitch += (Math.min(2.6, pitch) - this.divePitch) * Math.min(1, h * 10);
      this.player.body.rotation.x = this.divePitch;
      if (p.y <= WATER_Y - 0.25 && v.y < 0) {
        this.diveStage = 1;
        audio.splash();
        vibrate(50);
        this.fx.burst(this.v1.copy(p).setY(WATER_Y + 0.1), 'drop', 40, 1.9, 1.3);
        this.pool.disturb(p.x, p.z, -5, 0.5);
        // El agua frena de golpe: se pierde casi toda la velocidad
        v.multiplyScalar(0.35);
        // Ola que empuja la pelota si está cerca
        const bp = this.ball.pos;
        const d = Math.hypot(bp.x - p.x, bp.z - p.z);
        if (d < 3) {
          this.ball.vel.x += ((bp.x - p.x) / (d || 1)) * (3 - d) * 0.8;
          this.ball.vel.z += ((bp.z - p.z) / (d || 1)) * (3 - d) * 0.8;
          this.ball.vel.y += (3 - d) * 0.6;
          this.ball.wake();
        }
      }
      return;
    }
    // Bajo el agua: el empuje la devuelve a la superficie con un par de rebotes amortiguados
    const W = 4.5;
    v.y += (-W * W * (p.y - SWIM_Y) - 2 * 0.45 * W * v.y) * h;
    const k = Math.exp(-h * 3);
    v.x *= k;
    v.z *= k;
    p.addScaledVector(v, h);
    p.x = Math.max(POOL.minX + 0.4, Math.min(POOL.maxX - 0.4, p.x));
    p.z = Math.max(POOL.minZ + 0.4, Math.min(POOL.maxZ - 0.4, p.z));
    const y = p.y;
    this.swimPose(this.player, 0, h);
    p.y = y; // la altura la manda la física, no la pose
    // Bajo el agua se va enderezando hasta la postura de nado
    this.divePitch += (0.35 - this.divePitch) * Math.min(1, h * 3);
    this.player.body.rotation.x = this.divePitch;
    if (this.diveT > 0.5 && ((Math.abs(p.y - SWIM_Y) < 0.04 && Math.abs(v.y) < 0.15) || this.diveT > 2.6)) {
      this.player.body.rotation.x = 0;
      this.startHug();
    }
  }

  /** Por la escalera de la piscina: ya secos y vestidos (la ropa estaba en el borde), y a pie al césped. */
  private climbOut() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    this.walker.stop();
    audio.splash();
    fadeFlash(() => {
      this.setNude(false);
      this.phase = 'toTowels';
      this.player.root.position.set(LADDER.x - 0.95, 0, LADDER.z);
      this.walker.yaw = this.walker.facing = Math.PI; // (mirando hacia las toallas, hacia la casa)
      this.gas.root.position.set(LADDER.x - 1.5, 0, LADDER.z + 1.2);
      this.gas.root.rotation.set(0, Math.PI, 0);
      this.gasTrail = new Trail();
      this.busy = false;
      this.updateHud();
    }, 400);
  }

  /** Los dos tumbados uno al lado del otro, cada uno en su toalla. */
  private layDown() {
    for (const [p, sx] of [[this.player, -0.42], [this.gas, 0.42]] as const) {
      p.root.position.set(TOWELS.x + sx, LIE_Y, LIE_FEET_Z);
      p.root.rotation.set(-Math.PI / 2, 0, 0);
      p.body.rotation.set(0, 0, 0);
      animatePerson(p, 0.016, 'idle');
    }
  }

  /**
   * En las toallas. Es la censura de toda la vida: un plano fijo de lejos, el mosaico tapándolos del todo
   * y nada más. Luego hablan un rato tumbados y, ya, las estrellas.
   */
  private makeLove() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    this.walker.stop();
    fadeFlash(() => {
      this.phase = 'love';
      this.layDown();
      // La pelota, a la piscina: podía haberse quedado rodando encima de las toallas
      this.ball.pos.set(2.6, WATER_Y + 0.4, 8.2);
      this.ball.vel.set(0, 0, 0);
      this.updateHud();
      this.camera.position.set(TOWELS.x + 1.6, LAWN_Y + 2.7, TOWELS.z + 4.4); // (desde encima de la piscina, mirando a la casa)
      this.camLook.set(TOWELS.x, LIE_Y + 0.1, TOWELS.z);
      this.camera.lookAt(this.camLook);
      this.mosaic.position.set(TOWELS.x, LIE_Y + 0.28, TOWELS.z);
      this.mosaic.quaternion.copy(this.camera.quaternion);
      this.mosaic.visible = true;
      later(() => {
        if (this.phase !== 'love') return;
        dialogue(NIGHT.love, () =>
          fadeFlash(() => {
            this.mosaic.visible = false;
            // Hablando, de cerca: las dos caras sobre las toallas
            this.camera.position.set(TOWELS.x + 1.5, LIE_Y + 0.75, TOWELS.z - 1.7);
            this.camLook.set(TOWELS.x, LIE_Y + 0.1, TOWELS.z - 0.45);
            this.camera.lookAt(this.camLook);
            later(() => dialogue(NIGHT.talk, () => fadeFlash(() => this.startStars(), 400)), 500);
          }, 500),
        );
      }, 4200);
    }, 500);
  }

  private updateLove(dt: number) {
    this.mosaicT -= dt;
    if (this.mosaic.visible && this.mosaicT <= 0) {
      this.mosaicT = 0.22;
      this.shuffleMosaic();
    }
    animatePerson(this.player, dt, 'idle');
  }

  // ---------------- Estrellas ----------------

  private startStars() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    this.phase = 'stars';
    this.layDown();
    this.camera.position.copy(this.starCamPos);
    this.camera.lookAt(this.starCamLook);
    this.starSprites.forEach((s) => (s.visible = true));
    this.updateHud();
    dialogue(NIGHT.lie, () => {
      this.busy = false;
      window.addEventListener('pointerdown', this.onTap);
    });
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
    for (let i = 0; i < 4; i++) later(() => this.launchShootingStar(), i * 700);
    later(() => {
      phoneChat([CHATS.cesped, CHATS.meGustas], () => {
        later(() => {
          if (this.phase !== 'ending') return;
          this.phase = 'done';
          audio.ambience(0);
          const stars = 1 + (this.misses <= 6 ? 1 : 0) + (this.playTime < 240 ? 1 : 0);
          this.onComplete({ stars, stats: [['Estrellas unidas', '10/10 ✨'], ['Casi os pillan', this.caught ? `${this.caught} ${this.caught === 1 ? 'vez' : 'veces'} 💡` : 'nunca 🤫'], ['Tiempo', clock(this.playTime)]] });
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
      // (lejos de la cámara, que está en las toallas: de cerca tapaban la pantalla entera)
      if (Math.random() < dt * 3) this.fx.burst(this.v1.copy(this.starCamLook).sub(this.starCamPos).setLength(11).add(this.starCamPos), '❤️', 1, 1, 0.6);
    }
    animatePerson(this.player, dt, 'idle');
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
      this.setNude(false);
      this.pickedUp = true;
      this.carT = 5;
      this.busy = false;
      this.input.reset();
      this.player.root.rotation.set(0, 0, 0);
      this.gas.root.rotation.set(0, Math.PI, 0);
      this.player.root.visible = this.gas.root.visible = true;
      this.car.azul.visible = false;
      this.mosaic.visible = false;
      this.swimOut = false;
      this.swimT = 0;
    };
    return [
      {
        label: 'A · Bar Imperi',
        run: () => {
          reset();
          this.phase = 'atBar';
          this.pickedUp = false;
          this.carT = 0;
          this.placeCar(CAR_FAR_X);
          this.car.azul.visible = false;
          this.player.root.visible = true;
          this.gas.root.visible = false;
          this.player.root.position.copy(BAR_START);
          this.walker.yaw = this.walker.facing = Math.PI / 2;
          this.updateHud();
        },
      },
      {
        label: 'B · Llegar a casa',
        run: () => {
          reset();
          this.busy = true;
          this.arriveHome();
        },
      },
      {
        label: '1 · Ir a la piscina',
        run: () => {
          reset();
          this.toGarden();
          this.phase = 'toPool';
          this.player.root.position.set(-5.0, 0, 6.4);
          this.updateHud();
        },
      },
      {
        label: '2 · Nadar',
        run: () => {
          reset();
          this.toGarden();
          this.phase = 'toPool';
          this.player.root.position.set(-4.95, 0, 7.4);
          this.undress();
        },
      },
      {
        label: '3 · Al césped',
        run: () => {
          reset();
          this.phase = 'toTowels';
          this.player.root.position.set(LADDER.x - 0.95, 0, LADDER.z);
          this.gas.root.position.set(LADDER.x - 1.5, 0, LADDER.z + 1.2);
          this.gas.root.rotation.set(0, Math.PI, 0);
          this.walker.yaw = this.walker.facing = Math.PI;
          this.gasTrail = new Trail();
          this.updateHud();
        },
      },
      {
        label: '4 · Unir estrellas',
        run: () => {
          reset();
          this.nextStar = 0;
          this.startStars();
        },
      },
      {
        label: '5 · Final',
        run: () => {
          reset();
          this.startStars();
          later(() => {
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
    disposeScene(this.scene);
  }
}
