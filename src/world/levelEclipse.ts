import { Surf } from '../core/surfaces';
import * as THREE from 'three';
import { Trail } from '../core/follow';
import { RockHop } from './sideGames';
import { SIDE } from '../data/story';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate, applyShadows, makeSea } from '../core/gfx';
import { ECLIPSE } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { POT_CORE, G, Merger, makePerson, makeCar, makeDog, animatePerson, seatedRootY, woodChair, CarRig, type Person, type PersonLook, type Dog } from '../entities/models';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { princesaGame, lostMoto, type LoveLetterStage } from '../ui/minis';
import { cardCanvas } from '../ui/cards';
import { buildAzulHouse, STREET_Z, DOOR, DAD_LOOK, MOM_LOOK } from './levelCena';
import { FAROLA_WALK, COAST_Z, LIGHTHOUSE_SEA, buildSaFarola } from './saFarola';
import { buildKayak as kayakBoat, buildFerry, type Kayak } from './kayak';
import { Door } from './door';
import { stage } from '../core/stage';
import { canvasTex } from './deco';
import { buildStreet } from './homeStreet';
import { buildSurroundings } from './surround';
import type { Box2 } from './ferreries';
import { disposeScene, type Level, type LevelDone } from './level';
import { cinema, headOf } from '../core/cinema';
import { boneAnchor } from '../entities/rig';
import { juice } from '../core/juice';
import { beacon } from '../core/beacon';

/**
 * Corona del sol en la totalidad: un halo nacarado pegado al disco y cientos de rayos finos (más largos
 * hacia el ecuador del sol), dibujados una vez en un lienzo. El disco ocupa el 14 % del ancho.
 */
function coronaTexture() {
  const S = 512, c = S / 2, R = S * 0.14;
  const t = canvasTex((g) => {
    const halo = g.createRadialGradient(c, c, R * 0.92, c, c, c);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.08, 'rgba(240,244,255,0.6)');
    halo.addColorStop(0.3, 'rgba(210,222,255,0.16)');
    halo.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, S, S);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const a = rnd() * Math.PI * 2;
      // Serpentinas largas hacia el ecuador, plumas cortas en los polos
      const eq = Math.abs(Math.cos(a));
      const len = R * (0.25 + rnd() * (0.6 + eq * 1.9));
      const bend = (rnd() - 0.5) * 0.25;
      const x0 = c + Math.cos(a) * R * 0.97, y0 = c + Math.sin(a) * R * 0.97;
      const x1 = c + Math.cos(a + bend) * (R + len), y1 = c + Math.sin(a + bend) * (R + len);
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      const al = 0.05 + rnd() * 0.16;
      gr.addColorStop(0, `rgba(255,255,255,${al})`);
      gr.addColorStop(1, 'rgba(220,230,255,0)');
      g.strokeStyle = gr;
      g.lineWidth = 0.6 + rnd() * 2.4;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(c + Math.cos(a) * (R + len * 0.5), c + Math.sin(a) * (R + len * 0.5), x1, y1);
      g.stroke();
    }
  }, S, S);
  return t;
}

// Capítulo 8 · El eclipse (12 de agosto de 2026). «Ready para un dia que vas a recordar toda tu vida?»
// 1. El plan de Gas: kayak de Sa Farola a Sa Caleta. Imposible: un ferry os pasa por encima (ese plan nunca
//    pasó, al final no hubo kayak) y empieza el día de verdad.
// 2. Casa de Azul (la de la cena, de día): llegáis juntos en el coche, Gas conoce a sus padres y salís a dar una
//    vuelta con Joy y Eric hasta el faro; de vuelta en casa, os despedís de su padre y al coche.
// 3. Casa de Gas (la de la piscinita): aparcar marcha atrás dentro, por la corredera; entráis los dos y Azul conoce
//    a sus padres en la cocina.
// 4. Solos en las rocas: una partida a La Princesa (gana ella) y el eclipse con las gafas puestas.

/** Nivel del mar en Sa Farola (el plano del agua de buildSaFarola). */
const WATER_Y = -0.4;

type Phase = 'kayak' | 'ferry' | 'arrive' | 'parents' | 'walk' | 'back' | 'toCar' | 'park' | 'marcParents' | 'hop' | 'cards' | 'eclipse' | 'done';

const ERIC_LOOK: PersonLook = { skin: 0xf3d2b6, shirt: 0xf2c94c, pants: 0x3b6ea8, hair: 0xd9b56a, hairStyle: 'short', male: true };
// Los padres de Gas: él y ella, de unos cincuenta, como los de Azul (sin moños)
const MARC_DAD: PersonLook = { skin: 0xe2b08c, shirt: 0x6b8fb5, pants: 0x4a4a52, hair: 0x7d7672, hairStyle: 'short', male: true };
const MARC_MOM: PersonLook = { skin: 0xeec4a2, shirt: 0xc85a6a, pants: 0x2d2d3a, hair: 0x5a3a26, hairStyle: 'straight' };
const WALK_BOUNDS: Box2 = { minX: -72, maxX: 40, minZ: 0.6, maxZ: 15.5 }; // (la calle y el patio: los muros cierran lo demás)
/** En el patio, donde espera su padre. */
const DAD_AT = new THREE.Vector3(-1.25, 0, 1.3);
const HOME_BOUNDS: Box2 = { minX: -9, maxX: 12, minZ: 0.6, maxZ: 15.5 };
/** Cocina de casa de Gas: los padres, junto a la encimera. */
const KITCHEN_PARENTS = new THREE.Vector3(0, 0, -1.6);
const PARK = { minX: 1.7, maxX: 3.1, minZ: -17.9, maxZ: -16.5 };
const WHEELBASE = 2.5;

export class LevelEclipse implements Level {
  private scene = new THREE.Scene();
  private scenes: THREE.Scene[] = [];
  private hud: Hud;
  private fx!: Particles;
  private sky!: Sky;
  private sun!: Sun;
  private phase: Phase = 'kayak';
  private busy = true;
  private t = 0;
  private colliders: Box2[] = [];
  private marker = new THREE.Group();
  private v1 = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  // Personajes de la escena actual
  private player!: Person;
  private walker!: Walker;
  private gas!: Person;
  private others: { p: Person; mode: 'idle' | 'talk' | 'wave' }[] = [];
  private followers: { p: Person | Dog; lead: () => THREE.Vector3; gap: number; speed: number; trail?: Trail }[] = [];
  private walkers: Person[] = [];

  // Kayak
  private kayak = new THREE.Group();
  private ferry = new THREE.Group();
  private kayakV = 0;
  private boat: Kayak | null = null;
  private stroke = 0;
  private ferryT = 0;
  private ferryV = 26;
  /** Cancela y puerta de casa de Azul (o la verja de casa de Gas): se abren a quien llega. */
  private doors: Door[] = [];
  private doorWho: THREE.Vector3[] = [];
  // Love Letter en las rocas
  private llStage: LoveLetterStage | null = null;
  private llTurn: 'me' | 'gas' = 'me';
  private llPiles: { me: THREE.Object3D[]; gas: THREE.Object3D[] } = { me: [], gas: [] };
  private flying: { c: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; spin: number }[] = [];
  private handFans = new Map<Person, THREE.Group>();
  private llPlayT = new Map<Person, number>();
  private llCheerT = 0;
  private llWinner: Person | null = null;
  private cardTexs = new Map<string, THREE.Texture>();
  private llFill: THREE.PointLight | null = null;
  private flipT = 0;
  private getOutT = -1;
  private getInT = -1;
  private getInFrom = new THREE.Vector3();
  /** Minutos que quedan para el eclipse: cuenta desde que os despedís. Cada golpe aparcando, dos menos. */
  private rockHop: RockHop | null = null;
  private clockMin = 26;
  private clockSaid = false;
  private joy: Dog | null = null;
  private joyOutT = -1;
  private houseDoor: Door | null = null;

  // Coches y aparcamiento
  private car = makeCar(0x1f3a6b, { luggage: false, joy: false });
  /** Obstáculo del coche aparcado delante de casa de Azul (sigue al coche cuando llega). */
  private carBox: Box2 | null = null;
  private rig: CarRig | null = null;
  private carSpeed = 0;
  private carT = 0;
  private bumps = 0;
  private bumpT = 0;
  private parkedT = 0;
  private parkZone!: THREE.Mesh;

  // Rocas y eclipse
  private rounds = 1;
  // En Ciutadella la totalidad fue a las 20:30 con el sol a 1,9° sobre el mar, hacia el oeste-noroeste:
  // el eclipse coincidió con la puesta. El disco va un pelo más alto para que se vea entero.
  private sunDir = new THREE.Vector3(0.15, 0.046, 1).normalize();
  private sunDisk!: THREE.Mesh;
  private moon!: THREE.Mesh;
  private corona!: THREE.Sprite;
  /** El anillo de diamante: el último punto de sol justo antes de la totalidad. */
  private diamond!: THREE.Sprite;
  private stars: THREE.Points | null = null;
  private hemi!: THREE.HemisphereLight;
  private glasses = false;
  private glassesEl: HTMLElement | null = null;
  private progress = 0;
  private bareT = 0;
  private totalT = -1;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const am = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    this.marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 16).rotateX(Math.PI), am), new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 10).translate(0, 0.45, 0), am));
    this.hud = hud(() => this.input.queueAction(), onMenu, 'Arrastra a la izquierda para andar · a la derecha para girar la cámara');
    this.buildKayak();
    this.updateHud();
    later(() => dialogue(ECLIPSE.motoIntro, () => lostMoto(() => dialogue(ECLIPSE.afterMoto, () => phoneChat(CHATS.eclipseReady, () => dialogue(ECLIPSE.kayakIntro, () => this.startKayak()))))), 1800);
    audio.startMusic('road');
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Escenas ----------------

  /** Escena nueva con su cielo y su sol; la anterior se libera. */
  private newScene(sky: ConstructorParameters<typeof Sky>[0], fog: number, sunCol: number, sunI: number, dir: THREE.Vector3) {
    const old = this.scene;
    this.boat?.stop();
    this.boat = null;
    this.doors = [];
    const sc = new THREE.Scene();
    sc.fog = new THREE.Fog(fog, 110, 420);
    this.sky = new Sky(sky);
    sc.add(this.sky.group);
    this.hemi = new THREE.HemisphereLight(0xd8e6ff, 0x6a5a48, 0.75);
    sc.add(this.hemi);
    this.sun = new Sun(sc, sunCol, sunI, dir, 26);
    this.fx = new Particles(sc);
    sc.add(this.marker);
    this.marker.visible = false;
    this.colliders = [];
    this.carBox = null;
    this.others = [];
    this.followers = [];
    this.scene = sc;
    if (old !== sc && this.scenes.length) {
      old.remove(this.marker);
      disposeScene(old);
    }
    this.scenes = [sc];
    return sc;
  }

  private daySky() {
    return { top: 0x3f86d8, mid: 0x8ec4ee, bottom: 0xd9ecf7, clouds: { count: 8, tint: 0xffffff } };
  }

  /** Sentados en la roca: rodillas arriba, pies apoyados y las manos en la piedra, un poco por detrás. */
  private sitPose(p: Person) {
    p.legL.rotation.set(-2.05, 0, -0.14);
    p.legR.rotation.set(-2.05, 0, 0.14);
    p.kneeL.rotation.x = p.kneeR.rotation.x = 1.2;
    p.footL.rotation.x = p.footR.rotation.x = 0.85;
    p.armL.rotation.set(0.38, 0, -0.2);
    p.armR.rotation.set(0.38, 0, 0.2);
    p.elbowL.rotation.x = p.elbowR.rotation.x = -0.08;
    p.body.position.y = 0;
  }

  private buildKayak() {
    const sc = this.newScene(this.daySky(), 0xcfe6f4, 0xfff4e0, 2.2, new THREE.Vector3(0.4, 1, 0.6));
    // La costa de verdad: el Camí de sa Farola, las rocas de marès y el faro, vistos desde el agua
    const sf = buildSaFarola(sc, this.colliders, true, LIGHTHOUSE_SEA);
    for (const w of sf.walkers) w.root.parent?.remove(w.root);
    // Desde el agua se ve la costa baja de marès: una franja de rocas comidas por el mar
    const shore = new Merger();
    for (let i = 0; i < 60; i++) {
      const x = -100 + i * 3.6 + Math.sin(i * 2.7) * 1.5;
      const z = COAST_Z - 2.5 - Math.abs(Math.sin(i * 1.3)) * 3;
      shore.add(G.crag, [0xb8925c, 0xa8845a, 0xc29c66][i % 3], x, -0.9, z, Math.sin(i) * 0.3, i * 0.9, 0, 5 + (i % 3), 2.4 + (i % 4) * 0.5, 4.5);
      if (i % 3 === 0) shore.add(G.crag, 0x8f7450, x + 1.5, -1.1, z - 2.2, 0, i, 0, 3, 1.4, 2.5); // escollos con alga
    }
    sc.add(shore.mesh());
    this.player = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    this.boat = kayakBoat(this.player, this.gas);
    this.kayak = this.boat.root;
    // Saliendo de la bocana, por fuera de las rocas del faro, rumbo a Sa Caleta (hacia +x)
    this.kayak.position.set(-62, WATER_Y, COAST_Z - 17);
    this.kayak.rotation.y = Math.PI / 2;
    sc.add(this.kayak);
    this.ferry = buildFerry();
    this.ferry.visible = false;
    sc.add(this.ferry);
    const k = this.kayak.position;
    this.camera.position.set(k.x - 6.5, 2.8, k.z - 2.8);
    this.camLook.set(k.x + 6, 0.6, k.z + 1);
  }

  private buildAzul() {
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 1.8, new THREE.Vector3(0.4, 1, 0.6));
    const place = buildAzulHouse(sc, this.colliders, true);
    this.doors = [place.gate, place.door];
    place.beam.visible = false;
    place.steam.forEach((s) => (s.visible = false));
    this.walkers = place.walkers;
    // Muros de los jardines vecinos
    for (const sx of [-1, 1]) this.colliders.push({ minX: sx * 11.5 - 5.3, maxX: sx * 11.5 + 5.3, minZ: 10.1, maxZ: 10.5 });
    // Azul y Gas llegan juntos en el coche: hasta que aparca no se bajan
    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(5.2, 0, STREET_Z - 1.7);
    this.player.root.visible = false;
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = Math.PI;
    this.gas = makePerson(MARC_LOOK);
    this.gas.root.visible = false;
    sc.add(this.gas.root);
    const dad = makePerson(DAD_LOOK);
    const mom = makePerson(MOM_LOOK);
    dad.root.position.set(-1.25, 0, 1.3);
    mom.root.position.set(1.05, 0, 1.3);
    const eric = makePerson({ ...ERIC_LOOK, kid: true }, 0.85);
    eric.root.position.set(1.4, 0, 1.6);
    // Joy espera dentro de casa: saldrá por la puerta cuando lleguéis
    const joy = makeDog();
    joy.root.position.set(0, 0, -1.3);
    joy.root.visible = false;
    this.joy = joy;
    this.joyOutT = -1;
    this.getOutT = -1;
    this.houseDoor = place.door;
    sc.add(dad.root, mom.root, eric.root, joy.root);
    this.others = [{ p: dad, mode: 'idle' }, { p: mom, mode: 'idle' }, { p: eric, mode: 'idle' }];
    for (const p of [dad, mom]) this.colliders.push({ minX: p.root.position.x - 0.3, maxX: p.root.position.x + 0.3, minZ: p.root.position.z - 0.3, maxZ: p.root.position.z + 0.3 });
    // Eric va con Gas cuando salen
    this.followers = [];
    this.car = makeCar(0x1f3a6b, { luggage: false, joy: false });
    this.car.root.rotation.y = -Math.PI / 2;
    this.car.root.position.set(40, 0, STREET_Z + 0.6);
    sc.add(this.car.root);
    this.carBox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, low: true };
    this.colliders.push(this.carBox);
    this.rig = new CarRig(this.car);
    this.carT = 0;
  }

  private buildMarc() {
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 1.8, new THREE.Vector3(-0.4, 1, -0.5));
    const street = buildStreet(sc, { gateOpen: true });
    this.doors = [street.slider, street.gate];
    street.lamps.visible = false;
    this.colliders.push(...street.colliders, { minX: -4.6, maxX: 4.6, minZ: -15.05, maxZ: -12 }, { minX: -40, maxX: 40, minZ: -28.2, maxZ: -27.8 });
    this.car = makeCar(0x1f3a6b, { luggage: false, joy: false });
    this.car.root.position.set(12, 0, -22.2);
    this.car.root.rotation.y = -Math.PI / 2;
    sc.add(this.car.root);
    this.rig = new CarRig(this.car);
    this.carSpeed = 0;
    this.parkedT = 0;
    this.parkZone = new THREE.Mesh(
      new THREE.PlaneGeometry(PARK.maxX - PARK.minX + 1.8, PARK.maxZ - PARK.minZ + 3.8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.parkZone.position.set((PARK.minX + PARK.maxX) / 2, 0.06, (PARK.minZ + PARK.maxZ) / 2);
    sc.add(this.parkZone);
    this.player = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    this.player.root.visible = this.gas.root.visible = false;
    sc.add(this.player.root, this.gas.root);
    this.camera.position.set(12, 10, -32);
    this.camLook.set(6, 0, -20);
  }

  /** Cocina de casa de los padres de Gas: baldosa de barro, paredes encaladas, vigas, encimera, mesa y ventana. */
  private buildKitchen() {
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 1.6, new THREE.Vector3(-0.5, 1, 0.6));
    this.hemi.intensity = 0.62; // (con 1, la cocina salía quemada)
    const W = 4.6, D = 3.4, H = 2.8;
    const tiles = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#9c5a3a';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const v = Math.random() * 30;
          ctx.fillStyle = `rgb(${190 + v},${110 + v * 0.6},${74 + v * 0.4})`;
          ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
        }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(W, D);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2 + 2).rotateX(-Math.PI / 2), toon({ map: tiles, color: 0xffffff, roughness: 0.8 }));
    floor.position.z = 1;
    floor.userData.noCast = true;
    sc.add(floor);
    // Fuera de la cocina: el patio de la casa, para que no flote en el vacío
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), toon({ color: 0xbfae8a, surf: Surf.Paving }));
    yard.position.y = -0.02;
    yard.userData.noCast = true;
    sc.add(yard);
    // Y alrededor, el barrio: casas, muros y árboles hasta las lomas (nada de horizonte vacío)
    buildSurroundings(sc, { keepOut: [{ minX: -W - 7, maxX: W + 7, minZ: -D - 6, maxZ: D + 9 }], half: 70, seed: 31, groundY: -0.03 });
    const m = new Merger();
    const WALL = 0xf6f1e6;
    // Patio delante de la cocina: muro bajo encalado con macetas
    for (const sx of [-1, 1]) m.add(G.box, WALL, sx * (W + 2.5), 0.5, D + 3, 0, 0, 0, 0.25, 1.0, 6.5);
    m.add(G.box, WALL, 0, 0.5, D + 6.2, 0, 0, 0, W * 2 + 5, 1.0, 0.25);
    for (const sx of [-1, 1]) {
      m.add(G.box, WALL, sx * (W + 1.25), H / 2, -D, 0, 0, 0, 2.5, H, 0.2);
      m.add(G.cyl, 0xb5603b, sx * (W + 1.4), 0.25, D + 5.3, 0, 0, 0, 0.6, 0.5, 0.6);
      m.add(G.sphere, POT_CORE, sx * (W + 1.4), 0.8, D + 5.3, 0, 0, 0, 0.666, 0.592, 0.666); // (por dentro, macizo: que no se vea a través de las hojas)
      m.add(G.bush, 0x3e7a3a, sx * (W + 1.4), 0.8, D + 5.3, 0, 0, 0, 0.9, 0.8, 0.9);
    }
    // Paredes (la de delante no, para que se vea la cocina), zócalo y vigas de madera
    m.add(G.box, WALL, 0, H / 2, -D, 0, 0, 0, W * 2, H, 0.2);
    for (const sx of [-1, 1]) m.add(G.box, WALL, sx * W, H / 2, 1, 0, 0, 0, 0.2, H, D * 2 + 2);
    for (let i = 0; i < 4; i++) m.add(G.box, 0x6b4a2e, 0, H - 0.1, -D + 0.6 + i * 1.9, 0, 0, 0, W * 2, 0.18, 0.2);
    this.colliders.push({ minX: -W - 1, maxX: W + 1, minZ: -D - 1, maxZ: -D + 0.1 }, { minX: -W - 1, maxX: -W + 0.1, minZ: -D, maxZ: D + 2 }, { minX: W - 0.1, maxX: W + 1, minZ: -D, maxZ: D + 2 });
    // Encimera con fregadero y fogones, armarios altos y nevera
    m.add(G.box, 0xe9e2d2, -0.6, 0.45, -D + 0.35, 0, 0, 0, 6.4, 0.9, 0.7);
    m.add(G.box, 0x7a6a58, -0.6, 0.92, -D + 0.35, 0, 0, 0, 6.5, 0.06, 0.75);
    m.add(G.box, 0xbfc4c8, -2.2, 0.94, -D + 0.35, 0, 0, 0, 0.8, 0.04, 0.5);
    m.add(G.box, 0x2a2a2e, 1.2, 0.96, -D + 0.35, 0, 0, 0, 0.8, 0.03, 0.55);
    for (let i = 0; i < 4; i++) {
      const cx = -3.2 + i * 1.3;
      m.add(G.box, 0x5f8f6a, cx, 1.9, -D + 0.2, 0, 0, 0, 1.2, 0.8, 0.35);
      // Dos puertas con su junta y su tirador
      m.add(G.box, 0x37503c, cx, 1.9, -D + 0.378, 0, 0, 0, 0.012, 0.76, 0.006);
      for (const s of [-1, 1]) m.add(G.box, 0xc8ccd0, cx + s * 0.07, 1.68, -D + 0.385, 0, 0, 0, 0.02, 0.12, 0.012);
    }
    m.add(G.rbox, 0xeeeeee, 3.6, 0.95, -D + 0.45, 0, 0, 0, 0.8, 1.9, 0.7);
    this.colliders.push({ minX: -3.9, maxX: 4.1, minZ: -D, maxZ: -D + 0.8 });
    // Ventana con persianas verdes y la luz entrando
    m.add(G.box, 0x9fd3e8, -1, 1.75, -D + 0.11, 0, 0, 0, 1.4, 0.9, 0.02);
    for (const s of [-1, 1]) m.add(G.box, 0x2f7a4a, -1 + s * 1.05, 1.75, -D + 0.14, 0, 0, 0, 0.66, 1.0, 0.04);
    // Azulejos sobre la encimera, campana extractora, escurreplatos y botes
    for (let i = 0; i < 16; i++) m.add(G.box, i % 2 ? 0xdfe9ee : 0x5b8fb0, -3.6 + i * 0.4, 1.22, -D + 0.11, 0, 0, 0, 0.39, 0.5, 0.02);
    m.add(G.box, 0xc9ccd0, 1.2, 2.0, -D + 0.3, 0, 0, 0, 0.9, 0.35, 0.5);
    m.add(G.box, 0xc9ccd0, 1.2, 2.5, -D + 0.18, 0, 0, 0, 0.3, 0.7, 0.25);
    for (let i = 0; i < 3; i++) m.add(G.cyl, [0xd84a3a, 0xe8d6a8, 0x3a6a8a][i], -3.4 + i * 0.28, 1.06, -D + 0.25, 0, 0, 0, 0.2, 0.26, 0.2);
    m.add(G.cyl, 0x8a8e92, 1.0, 1.06, -D + 0.4, 0, 0, 0, 0.36, 0.22, 0.36); // olla
    // Aparador con platos en la pared izquierda, puerta a la derecha, reloj y calendario
    m.add(G.box, 0x7a5a3a, -W + 0.35, 0.5, -0.6, 0, 0, 0, 0.6, 1.0, 2.0);
    m.add(G.box, 0x6b4a2e, -W + 0.2, 1.6, -0.6, 0, 0, 0, 0.3, 1.2, 2.0);
    for (let i = 0; i < 5; i++) m.add(G.cyl, 0xf4f1ea, -W + 0.3, 1.5, -1.3 + i * 0.35, 0, 0, Math.PI / 2, 0.3, 0.02, 0.3);
    this.colliders.push({ minX: -W, maxX: -W + 0.7, minZ: -1.6, maxZ: 0.4 });
    m.add(G.box, 0x8a6a44, W - 0.11, 1.05, -0.2, 0, 0, 0, 0.04, 2.1, 0.95);
    m.add(G.sphere, 0xd9b45a, W - 0.15, 1.0, 0.15, 0, 0, 0, 0.06, 0.06, 0.06);
    m.add(G.cyl, 0xfbf7ee, 2.6, 2.3, -D + 0.12, Math.PI / 2, 0, 0, 0.36, 0.04, 0.36);
    m.add(G.box, 0x2a2a2e, 2.6, 2.36, -D + 0.15, 0, 0, 0, 0.02, 0.14, 0.01);
    // Calendario: taco blanco con su borde y sus filas de días (antes, una raya roja suelta en la pared)
    m.add(G.box, 0x8a6a44, W - 0.105, 1.6, -1.6, 0, 0, 0, 0.012, 0.64, 0.46);
    m.add(G.box, 0xfffdf6, W - 0.115, 1.58, -1.6, 0, 0, 0, 0.012, 0.56, 0.42);
    m.add(G.box, 0xc23030, W - 0.125, 1.82, -1.6, 0, 0, 0, 0.012, 0.12, 0.42);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) m.add(G.box, 0x4a4a50, W - 0.124, 1.68 - r * 0.09, -1.76 + c * 0.08, 0, 0, 0, 0.004, 0.04, 0.04);
    // Lámpara colgando sobre la mesa y alfombra de esparto
    m.add(G.box, 0x333333, 0.4, 2.3, 0.9, 0, 0, 0, 0.02, 1.0, 0.02);
    m.add(G.cone, 0x2f6b46, 0.4, 1.72, 0.9, 0, 0, 0, 0.5, 0.3, 0.5);
    m.add(G.box, 0xc9ae7a, 0.4, 0.01, 0.9, 0, 0, 0, 2.8, 0.01, 2.0);
    // Maceta con potos en una esquina
    m.add(G.cyl, 0xb5603b, W - 0.5, 0.25, 2.2, 0, 0, 0, 0.5, 0.5, 0.5);
    m.add(G.sphere, POT_CORE, W - 0.5, 0.78, 2.2, 0, 0, 0, 0.592, 0.488, 0.592); // (por dentro, macizo: que no se vea a través de las hojas)
    m.add(G.bush, 0x3e7a3a, W - 0.5, 0.78, 2.2, 0, 0, 0, 0.8, 0.66, 0.8);
    m.add(G.bush, 0x4a8a44, W - 0.45, 0.95, 2.14, 0, 1.2, 0, 0.5, 0.42, 0.5);
    this.colliders.push({ minX: W - 0.82, maxX: W - 0.18, minZ: 1.88, maxZ: 2.52, round: true });
    // Mesa de madera con hule, sillas, frutero y una ensaimada
    m.add(G.box, 0x8a6a44, 0.4, 0.74, 0.9, 0, 0, 0, 1.8, 0.06, 1.0);
    for (const [x, z] of [[-0.4, 0.5], [1.2, 0.5], [-0.4, 1.3], [1.2, 1.3]]) m.add(G.box, 0x6b4a2e, x, 0.37, z, 0, 0, 0, 0.07, 0.74, 0.07);
    m.add(G.box, 0xf4efe2, 0.4, 0.78, 0.9, 0, 0, 0, 1.5, 0.01, 0.8);
    woodChair(m, -0.8, 0.9, Math.PI / 2);
    woodChair(m, 1.6, 0.9, -Math.PI / 2);
    m.add(G.cyl, 0xd8b04a, 0.1, 0.82, 0.8, 0, 0, 0, 0.5, 0.06, 0.5);
    m.add(G.sphere, 0xe08a2a, 0.75, 0.86, 1.0, 0, 0, 0, 0.14, 0.14, 0.14);
    m.add(G.sphere, 0xc23030, 0.85, 0.86, 0.9, 0, 0, 0, 0.13, 0.13, 0.13);
    this.colliders.push({ minX: -1.1, maxX: 1.9, minZ: 0.3, maxZ: 1.5 });
    sc.add(m.mesh());
    const light = new THREE.PointLight(0xfff0d0, 3, 12, 1.4);
    light.position.set(0.4, 2.5, 0.5);
    sc.add(light);
    // Sus padres en la cocina; vosotros entráis por la puerta
    const dad = makePerson(MARC_DAD);
    const mom = makePerson(MARC_MOM);
    dad.root.position.set(KITCHEN_PARENTS.x - 0.6, 0, KITCHEN_PARENTS.z);
    mom.root.position.set(KITCHEN_PARENTS.x + 0.7, 0, KITCHEN_PARENTS.z - 0.2);
    sc.add(dad.root, mom.root);
    this.others = [{ p: dad, mode: 'idle' }, { p: mom, mode: 'idle' }];
    for (const p of [dad, mom]) this.colliders.push({ minX: p.root.position.x - 0.3, maxX: p.root.position.x + 0.3, minZ: p.root.position.z - 0.3, maxZ: p.root.position.z + 0.3 });
    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(-1.6, 0, D + 1.4);
    this.gas = makePerson(MARC_LOOK);
    this.gas.root.position.set(-2.4, 0, D + 2);
    sc.add(this.player.root, this.gas.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = Math.PI;
    this.followers = [{ p: this.gas, lead: () => this.player.root.position, gap: 1.2, speed: 4 }];
  }

  private buildRocks() {
    const dusk = { top: 0x2b4a8a, mid: 0xf0985a, bottom: 0xffcf8a, clouds: { count: 5, tint: 0xffc9a0 }, stars: 600, avoid: this.sunDir };
    const sc = this.newScene(dusk, 0xf3b27a, 0xffc98a, 1.8, this.sunDir.clone().setY(0.35));
    // Con la calidad de la prueba: luz de un atardecer fotografiado, que se apaga con el eclipse
    sc.userData.hemiScale = 0.4;
    this.sky.group.traverse((o) => {
      if ((o as THREE.Points).isPoints) this.stars = o as THREE.Points;
    });
    if (this.stars) (this.stars.material as THREE.PointsMaterial).opacity = 0;
    const sea = makeSea([900, 900], 0x1d4f6e, this.sunDir.clone().setY(0.35), { emissive: 0x2a1a20 });
    sea.position.y = -1.6;
    sc.add(sea);
    const m = new Merger();
    m.add(G.sphere, 0xc9a36b, 0, -1.6, 0, 0, 0, 0, 16, 3.2, 12);
    // Piedras y grietas sueltas por encima: la roca no es una bola lisa
    for (let i = 0; i < 26; i++) {
      const a = i * 2.399, r = 1.6 + (i % 7) * 0.85;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.74 - 0.4;
      const e = Math.hypot(x / 8, z / 6);
      if (e > 0.97) continue;
      const y = -1.6 + 1.6 * Math.sqrt(1 - e * e);
      const s = 0.14 + (i % 5) * 0.09;
      m.add(i % 2 ? G.rock : G.crag, i % 3 ? 0xb8925c : 0xa58150, x, y - 0.02, z, 0, i, 0, s * 1.6, s * 0.7, s * 1.3);
    }
    m.add(G.rock2, 0xb8925c, -7, -1.2, -4, 0, 0.5, 0, 10, 3.6, 9);
    m.add(G.rock, 0xd1ad74, 6, -1.4, -3, 0, 1, 0, 9, 3.2, 8);
    for (let i = 0; i < 9; i++) m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xc9a36a : 0xb48a54, -14 + i * 3.6, -1.5, 5 + Math.sin(i * 2.3) * 2, i, i * 0.7, 0, 3 + (i % 3), 1.4, 2.6);
    // Sentados directamente en la roca (sin toalla), con las cartas de La Princesa delante
    sc.add(m.mesh());
    this.player = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    for (const [p, x] of [[this.player, -0.45], [this.gas, 0.45]] as [Person, number][]) {
      // Sentados de verdad: la pose dobla las piernas, pero el cuerpo seguía a la altura de estar de pie
      // (las caderas a casi un metro de la roca). Se baja la altura de la cadera, como en el kayak,
      // y quedan apoyados en la piedra
      p.root.position.set(x, seatedRootY(p, 0.03), 0);
      p.root.rotation.y = 0;
      this.sitPose(p);
      sc.add(p.root);
      // Gafas de eclipse (se ven cuando se las ponen): en los personajes con esqueleto, a la altura de
      // los ojos y pegadas a la cara; en los muñecos, como siempre
      if (p.rig) {
        const g = new Merger().add(G.box, 0x111111, 0, 0.085, 0.1, 0, 0, 0, 0.15, 0.045, 0.02).add(G.box, 0x111111, 0.075, 0.085, 0.04, 0, 0, 0, 0.008, 0.012, 0.12).add(G.box, 0x111111, -0.075, 0.085, 0.04, 0, 0, 0, 0.008, 0.012, 0.12).mesh();
        g.name = 'gafas';
        g.visible = false;
        boneAnchor(p, 'Head').add(g);
      } else {
        const g = new Merger().add(G.box, 0x111111, 0, 0.32, 0.27, 0, 0, 0, 0.5, 0.12, 0.05).mesh();
        g.name = 'gafas';
        g.visible = false;
        p.head.add(g);
      }
    }
    // Sol bajo sobre el mar, la luna que se le pone delante y la corona
    const dist = 300;
    this.sunDisk = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }));
    this.sunDisk.position.copy(this.sunDir).multiplyScalar(dist);
    this.sunDisk.lookAt(0, 0, 0);
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(9.2 * 0.97, 40), new THREE.MeshBasicMaterial({ color: 0x0c0c14, fog: false }));
    this.moon.lookAt(this.v1.copy(this.sunDir).multiplyScalar(-1));
    this.corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: coronaTexture(), color: 0xeef2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    this.corona.position.copy(this.sunDisk.position);
    this.corona.scale.setScalar(9 / 0.14);
    // El último punto de sol: por el lado por donde sale la luna (ver placeMoon)
    const right = new THREE.Vector3().crossVectors(this.sunDir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, this.sunDir).normalize();
    this.diamond = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    this.diamond.position.copy(this.sunDisk.position).addScaledVector(right, 9 * 0.8).addScaledVector(up, -9 * 0.6).addScaledVector(this.sunDir, -2);
    this.diamond.renderOrder = -4;
    sc.add(this.diamond);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.position.copy(this.sunDisk.position);
    halo.scale.setScalar(110);
    halo.name = 'halo';
    for (const o of [halo, this.sunDisk, this.moon, this.corona]) o.renderOrder = -5;
    sc.add(halo, this.sunDisk, this.moon, this.corona);
    this.placeMoon(0);
    this.camera.position.set(-1.6, 1.7, -3.4);
    this.camLook.set(0, 1.2, 6);
  }

  private placeMoon(k: number) {
    const right = this.v1.crossVectors(this.sunDir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, this.sunDir).normalize();
    const off = (1 - k) * 22;
    this.moon.position.copy(this.sunDir).multiplyScalar(291).addScaledVector(right, -off * 0.8).addScaledVector(up, off * 0.6);
  }

  // ---------------- Fases ----------------

  private updateHud() {
    const o: Record<Phase, string> = {
      kayak: ECLIPSE.kayakHint,
      ferry: ECLIPSE.ferryWarn,
      arrive: ECLIPSE.arriveAzul[0].text,
      parents: ECLIPSE.parentsHint,
      walk: ECLIPSE.walkHint,
      back: ECLIPSE.backHint,
      toCar: ECLIPSE.carHint,
      park: ECLIPSE.parkHint,
      marcParents: ECLIPSE.kitchenHint,
      hop: SIDE.hop.hint,
      cards: 'En las rocas',
      eclipse: this.glasses ? 'Mira cómo la luna tapa el sol' : ECLIPSE.glassesHint,
      done: '12 de agosto de 2026',
    };
    this.hud.setObjective(o[this.phase]);
    const clock = `<span class="chip${this.clockMin <= 10 ? ' chip-alert' : ''}">🌘 faltan ${Math.ceil(this.clockMin)} min</span>`;
    this.hud.setCounters(this.phase === 'toCar' ? clock : this.phase === 'park' ? `${clock}<span class="chip">💥 ${this.bumps}</span>` : this.phase === 'eclipse' ? `<span class="chip">🌘 ${Math.round(this.progress * 100)}%</span>` : '');
  }

  private startKayak() {
    this.phase = 'kayak';
    this.busy = false;
    this.ferryT = 0;
    this.flipT = 0;
    this.kayakV = 0;
    // Sin restos de una vuelta anterior (modo prueba): ni ferry a la vista ni el kayak volcado
    this.ferry.visible = false;
    const roll = this.boat?.roll;
    if (roll) {
      roll.position.y = 0;
      roll.rotation.set(0, 0, 0);
    }
    this.updateHud();
  }

  private sunk() {
    this.busy = true;
    this.hud.setAction(null);
    fadeFlash(
      () =>
        dialogue(ECLIPSE.kayakEnd, () =>
          phoneChat(CHATS.eclipseCoche, () => {
            this.buildAzul();
            applyShadows(this.scene);
            this.startArrive();
          }),
        ),
      600,
    );
  }

  private startArrive() {
    this.phase = 'arrive';
    this.busy = true;
    this.carT = 0;
    // La cámara empieza ya en la calle: venía del mar y cruzaba volando media urbanización
    const pp = this.player.root.position;
    this.camera.position.set(pp.x - 2, 3.4, pp.z + 6);
    this.camLook.set(pp.x, 1.3, pp.z - 1);
    this.camera.lookAt(this.camLook);
    this.updateHud();
  }

  /** El coche ya está aparcado delante de casa: os bajáis y Gas te sigue hasta la puerta. */
  private getOut() {
    this.car.azul.visible = false;
    const c = this.car.root.position;
    this.player.root.visible = this.gas.root.visible = true;
    // Salen de dentro del coche: ella por su lado (el de casa) y él por el otro, y rodea el morro
    this.player.root.position.set(c.x + 0.2, -0.45, c.z - 0.2);
    this.player.root.rotation.y = Math.PI;
    this.gas.root.position.set(c.x + 0.3, -0.45, c.z + 0.3);
    this.gas.root.rotation.y = 0;
    this.walker.facing = this.walker.yaw = Math.PI;
    this.getOutT = 0;
    audio.pop();
  }

  /** Se bajan del coche a la vista, sin aparecer de golpe. */
  private stepGetOut(dt: number) {
    this.getOutT += dt;
    const t = this.getOutT;
    const ss = THREE.MathUtils.smoothstep;
    const c = this.car.root.position;
    const a = this.player.root.position;
    a.z = THREE.MathUtils.lerp(c.z - 0.2, c.z - 1.75, ss(t, 0, 0.95));
    a.y = THREE.MathUtils.lerp(-0.45, 0, ss(t, 0, 0.55));
    animatePerson(this.player, dt, t < 1 ? 'walk' : 'idle', 0.7);
    const g = this.gas.root;
    const WP: [number, number][] = [[c.x + 0.3, c.z + 1.45], [c.x - 3.1, c.z + 1.45], [c.x - 3.1, c.z - 1.75], [c.x - 1.3, c.z - 2.0]];
    if (t < 1.05) {
      g.position.z = THREE.MathUtils.lerp(c.z + 0.3, c.z + 1.45, ss(t, 0.15, 1.05));
      g.position.y = THREE.MathUtils.lerp(-0.45, 0, ss(t, 0.15, 0.7));
      animatePerson(this.gas, dt, 'walk', 0.7);
    } else {
      g.position.y = 0;
      let d = (t - 1.05) * 3.1;
      let moving = false;
      for (let i = 0; i + 1 < WP.length; i++) {
        const [x0, z0] = WP[i], [x1, z1] = WP[i + 1];
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (d <= L) {
          g.position.x = x0 + ((x1 - x0) * d) / L;
          g.position.z = z0 + ((z1 - z0) * d) / L;
          const want = Math.atan2(x1 - x0, z1 - z0);
          g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * Math.min(1, dt * 8);
          moving = true;
          break;
        }
        d -= L;
      }
      animatePerson(this.gas, dt, moving ? 'walk' : 'idle', 0.8);
      if (!moving) {
        this.getOutT = -1;
        this.followers.push({ p: this.gas, lead: () => this.player.root.position, gap: 1.4, speed: 4.2 });
        dialogue(ECLIPSE.arriveAzul, () => {
          this.phase = 'parents';
          this.busy = false;
          this.updateHud();
        });
      }
    }
  }

  /** Joy estaba esperando dentro: al oíros llegar, sale corriendo por la puerta y ya no se separa de Azul. */
  private updateJoy(dt: number) {
    const j = this.joy;
    if (!j || !this.houseDoor) return;
    const pp = this.player.root.position;
    if (this.joyOutT < 0) {
      if (this.phase === 'parents' && Math.hypot(pp.x - DOOR.x, pp.z - DOOR.z) < 6.5) {
        this.joyOutT = 0;
        this.houseDoor.hold(2.2);
      }
      return;
    }
    if (this.joyOutT >= 9) return;
    this.joyOutT += dt;
    if (this.houseDoor.open < 0.55) return;
    j.root.visible = true;
    j.root.position.z += dt * 3.6;
    j.root.rotation.y = 0;
    const k = Math.sin(this.t * 16) * 0.7;
    j.legs.forEach((l, i) => (l.rotation.x = i % 2 ? k : -k));
    j.tail.rotation.z = Math.sin(this.t * 14) * 0.6;
    if (j.root.position.z > 2.0) {
      this.joyOutT = 9;
      audio.pop();
      this.followers.push({ p: j, lead: () => this.player.root.position, gap: 1.3, speed: 5.5 });
    }
  }

  private meetParents() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    for (const o of this.others) o.mode = 'talk';
    this.others[0].mode = 'wave';
    dialogue(ECLIPSE.meetAzulParents, () => {
      for (const o of this.others) o.mode = 'idle';
      // Eric se apunta al paseo con Gas
      const eric = this.others.pop()!;
      this.followers.push({ p: eric.p, lead: () => this.gas.root.position, gap: 1.0, speed: 4.4 });
      this.phase = 'walk';
      this.busy = false;
      this.updateHud();
    });
  }

  private walkDone() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    dialogue(ECLIPSE.walkDone, () => {
      this.phase = 'back';
      this.busy = false;
      this.updateHud();
    });
  }

  /** De vuelta en casa: se despiden de su padre. Joy y Eric se quedan con ellos. */
  private sayBye() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    for (const o of this.others) o.mode = 'talk';
    this.others[0].mode = 'wave';
    dialogue(ECLIPSE.byeDad, () => {
      for (const o of this.others) o.mode = 'idle';
      this.others[0].mode = 'wave';
      // Eric, con su madre; Joy, a su lado: ya no os siguen
      const stay: [Person | Dog, THREE.Vector3][] = [];
      for (const f of this.followers) {
        if (f.p === this.gas) continue;
        stay.push([f.p, 'legs' in f.p ? new THREE.Vector3(0.3, 0, 2.1) : new THREE.Vector3(1.75, 0, 1.75)]);
      }
      this.followers = this.followers.filter((f) => f.p === this.gas);
      for (const [p, to] of stay) this.followers.push({ p, lead: () => to, gap: 0.12, speed: 3 });
      this.phase = 'toCar';
      this.busy = false;
      this.updateHud();
    });
  }

  /** Puerta del copiloto, por la acera. */
  private carDoor() {
    const c = this.car.root.position;
    return this.v1.set(c.x + 0.2, 0, c.z - 1.75);
  }

  /** Se suben: ella, por la acera, a la vista; él rodea el coche y el fundido corta. */
  private boardCar() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    beacon.at(null);
    audio.pop();
    this.getInT = 0;
    this.getInFrom.copy(this.player.root.position);
  }

  private stepGetIn(dt: number) {
    this.getInT += dt;
    const t = this.getInT;
    const c = this.car.root.position;
    const a = this.player.root.position;
    const k = Math.min(1, t / 0.8);
    const f = this.getInFrom;
    const e = THREE.MathUtils.smoothstep(k, 0, 1);
    a.x = THREE.MathUtils.lerp(f.x, c.x + 0.2, e);
    a.z = THREE.MathUtils.lerp(f.z, c.z - 0.2, e);
    a.y = THREE.MathUtils.lerp(0, -0.45, THREE.MathUtils.smoothstep(k, 0.3, 1));
    this.player.root.rotation.y = Math.atan2(c.x + 0.2 - f.x, c.z - 0.2 - f.z);
    animatePerson(this.player, dt, 'walk', 0.6);
    if (t > 0.8 && this.player.root.visible) {
      this.player.root.visible = false;
      this.car.azul.visible = true;
    }
    if (t > 1.25 && this.getInT < 90) {
      this.getInT = 99;
      fadeFlash(() => {
        this.getInT = -1;
        this.buildMarc();
        applyShadows(this.scene);
        this.phase = 'park';
        this.busy = true;
        this.updateHud();
        dialogue(ECLIPSE.driveIntro, () => {
          this.busy = false;
          toast('Arriba avanza · abajo, marcha atrás · los lados giran el volante');
        });
      }, 500);
    }
  }

  private parked() {
    this.phase = 'marcParents';
    this.busy = true;
    this.carSpeed = 0;
    this.hud.setAction(null);
    this.parkZone.visible = false;
    audio.fanfare();
    toast(ECLIPSE.parkOk);
    later(
      () =>
        fadeFlash(() => {
          this.buildKitchen();
          applyShadows(this.scene);
          this.busy = false;
          this.updateHud();
        }, 400),
      1300,
    );
  }

  private meetMarcParents() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.others[0].mode = 'wave';
    this.others[1].mode = 'talk';
    // Se colocan para hablar: ella delante de sus padres y Gas a su lado, junto a la mesa
    fadeFlash(() => {
      this.player.root.position.set(0.05, 0, -0.2);
      this.walker.facing = this.walker.yaw = Math.PI;
      this.player.root.rotation.y = Math.PI;
      this.gas.root.position.set(-1.2, 0, -0.1);
      this.gas.root.rotation.y = 2.6;
      this.followers = [];
    }, 250);
    const az = () => headOf(this.player);
    const dad = () => headOf(this.others[0].p);
    const mom = () => headOf(this.others[1].p);
    const mid = () => dad().lerp(mom(), 0.5).add(new THREE.Vector3(0, -0.12, 0));
    // Por encima de su hombro, a los padres; y luego, de entre los dos padres, a ella (y Gas al lado)
    cinema.play([
      { dur: Infinity, move: 7, pos: new THREE.Vector3(-0.62, 1.5, 1.0), pos2: new THREE.Vector3(-0.5, 1.46, 0.72), look: mid, fov: 44, focus: mid },
      { dur: Infinity, move: 7, pos: new THREE.Vector3(0.06, 1.4, -2.45), pos2: new THREE.Vector3(0.06, 1.38, -2.2), look: () => az().add(new THREE.Vector3(-0.25, -0.1, 0)), fov: 46, focus: az },
    ]);
    later(() => {
      this.others[0].mode = 'talk';
    }, 2600);
    dialogue(ECLIPSE.meetMarcParents, () => {
      cinema.next();
      dialogue(ECLIPSE.meetMarcParents2, () => {
        cinema.stop();
        fadeFlash(() => this.startRocks(), 500);
      });
    });
  }

  private updateKitchen(dt: number) {
    const pp = this.player.root.position;
    for (const o of this.others) {
      o.p.root.rotation.y = Math.atan2(pp.x - o.p.root.position.x, pp.z - o.p.root.position.z);
      animatePerson(o.p, dt, o.mode);
    }
    this.moveFollowers(dt);
    const free = !this.busy;
    this.walker.turn(this.input.consumeCam());
    if (free) {
      const move = this.walker.move(dt, this.input.axes(), this.colliders, { minX: -4.2, maxX: 4.2, minZ: -2.6, maxZ: 5.4 });
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    } else animatePerson(this.player, dt, 'talk');
    const near = pp.distanceTo(KITCHEN_PARENTS) < 2.2;
    this.hud.setAction(free && near ? '👋 Saludar' : null, near);
    if (this.input.consumeAction() && free && near) this.meetMarcParents();
    this.marker.visible = free && !near;
    if (this.marker.visible) {
      this.marker.position.set(KITCHEN_PARENTS.x, 2.4 + Math.sin(this.t * 3) * 0.12, KITCHEN_PARENTS.z);
      this.marker.rotation.y += dt * 2;
    }
    this.hud.setArrow(null);
    this.walker.camera(this.camera, dt, [], 4.2, 2.9);
    this.sun.follow(pp);
  }

  private startRocks() {
    this.buildRocks();
    applyShadows(this.scene);
    // Ellos dos, sentados en su sitio, esperan ocultos: antes hay que llegar hasta allí
    this.player.root.visible = this.gas.root.visible = false;
    this.phase = 'hop';
    this.busy = true;
    this.updateHud();
    audio.startMusic('night');
    this.rockHop = new RockHop(this.scene, this.fx, -1.6, () => {
      this.rockHop?.dispose();
      this.rockHop = null;
      this.busy = true;
      this.hud.setAction(null);
      fadeFlash(() => this.startCards(), 500);
    });
    dialogue(SIDE.hop.intro, () => {
      this.busy = false;
      this.updateHud();
    });
  }

  private startCards() {
    this.player.root.visible = this.gas.root.visible = true;
    this.phase = 'cards';
    this.busy = true;
    this.updateHud();
    this.setupCards();
    dialogue(ECLIPSE.rocks, () =>
      princesaGame((rounds) => {
        this.rounds = rounds;
        this.endCards();
        dialogue(ECLIPSE.afterCards, () => {
          this.phase = 'eclipse';
          this.busy = false;
          this.progress = 0;
          this.bareT = 0;
          this.updateHud();
        });
      }, this.llStage ?? undefined),
    );
  }

  // ---------------- Love Letter en las rocas ----------------

  /** Textura de una carta (cara v o dorso con null). */
  private cardTex(v: number | null) {
    const key = String(v);
    let t = this.cardTexs.get(key);
    if (!t) {
      t = new THREE.CanvasTexture(cardCanvas(v));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.cardTexs.set(key, t);
    }
    return t;
  }

  /** Una carta física: cara por delante y dorso por detrás. */
  private cardMesh(v: number | null) {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.09, 0.126);
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.cardTex(v), roughness: 0.6 }));
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.cardTex(null), roughness: 0.6 }));
    back.rotation.y = Math.PI;
    front.position.z = back.position.z = 0;
    back.position.z = -0.0006;
    for (const m of [front, back]) m.castShadow = true;
    g.add(front, back);
    return g;
  }

  /** Los dos sentados frente a frente en la roca, cada uno con sus cartas en la mano. */
  private setupCards() {
    // (frente a frente y un poco abiertos hacia tierra: la cámara les ve la cara con el mar detrás)
    // (con sitio para las rodillas: a 60 cm las piernas de los dos se metían unas en otras)
    const seats: [Person, number, number][] = [[this.player, -0.8, 1.85], [this.gas, 0.8, -1.85]];
    for (const [p, x, ry] of seats) {
      p.root.position.x = x;
      p.root.position.z = 0.1;
      p.root.rotation.y = ry;
    }
    // Con el sol de la tarde detrás quedaban a contraluz: una luz cálida de relleno desde la cámara
    this.llFill = new THREE.PointLight(0xffd2a8, 5, 6, 1.4);
    this.llFill.position.set(0, 1.5, -1.1);
    this.scene.add(this.llFill);
    for (const p of [this.player, this.gas]) {
      const fan = new THREE.Group();
      fan.name = 'mano-cartas';
      p.handR.add(fan);
      this.handFans.set(p, fan);
    }
    this.llStage = {
      play: (who, v) => {
        const p = who === 'me' ? this.player : this.gas;
        const from = p.handR.getWorldPosition(new THREE.Vector3());
        const pile = this.llPiles[who];
        const n = pile.length;
        const c = this.cardMesh(v);
        c.position.copy(from);
        this.scene.add(c);
        // Cae boca arriba en su lado de la roca, un poco torcida, encima de las anteriores
        const to = new THREE.Vector3(who === 'me' ? -0.2 : 0.2, 0.035 + n * 0.002, 0.42 + (n % 3) * 0.03);
        pile.push(c);
        this.flying.push({ c, from, to, t: 0, spin: (Math.random() - 0.5) * 0.8 + (who === 'me' ? 0.3 : -0.3) });
        audio.knock(0.25, 1800, 0.03);
        this.llPlayT.set(p, 0.5);
      },
      turn: (who) => (this.llTurn = who),
      hands: (me, gas) => {
        for (const [p, k] of [[this.player, me], [this.gas, gas]] as [Person, number][]) {
          const fan = this.handFans.get(p)!;
          while (fan.children.length > k) fan.remove(fan.children[fan.children.length - 1]);
          // Las de la mano se ven de dorso desde fuera (cada uno mira las suyas)
          while (fan.children.length < k) fan.add(this.cardMesh(null));
          fan.children.forEach((c, i) => {
            c.position.set(0, -0.06, 0.03 + i * 0.004);
            c.rotation.set(-Math.PI / 2 + 0.25, 0, (i - (k - 1) / 2) * 0.35);
          });
        }
      },
      reset: () => {
        for (const who of ['me', 'gas'] as const) {
          for (const c of this.llPiles[who]) c.removeFromParent();
          this.llPiles[who] = [];
        }
        this.flying = [];
      },
      end: (iWin) => {
        this.llCheerT = 2.2;
        this.llWinner = iWin ? this.player : this.gas;
      },
    };
  }

  /** Recoge las cartas y vuelven a sentarse juntos mirando al mar para el eclipse. */
  private endCards() {
    this.llStage?.reset();
    for (const fan of this.handFans.values()) fan.removeFromParent();
    this.handFans.clear();
    this.llStage = null;
    this.llFill?.removeFromParent();
    this.llFill?.dispose();
    this.llFill = null;
    for (const [p, x] of [[this.player, -0.45], [this.gas, 0.45]] as [Person, number][]) {
      p.root.position.set(x, p.root.position.y, 0);
      p.root.rotation.y = 0;
    }
  }

  /** Brazos con las cartas, cartas que vuelan al montón y la cámara por encima del hombro de quien no juega. */
  private updateCards(dt: number) {
    for (const p of [this.player, this.gas]) {
      const playT = (this.llPlayT.get(p) ?? 0) - dt;
      this.llPlayT.set(p, playT);
      const cheer = this.llCheerT > 0 && this.llWinner === p;
      // Mano con las cartas delante del pecho; al jugar, el brazo se estira hacia la roca
      const reach = playT > 0 ? Math.sin((playT / 0.5) * Math.PI) : 0;
      p.armR.rotation.set(cheer ? -2.6 : -1.0 - reach * 0.35, 0, cheer ? 0.4 : 0.28);
      p.elbowR.rotation.x = cheer ? -0.3 : -1.25 + reach * 0.9;
      p.armL.rotation.set(-0.5, 0, -0.15);
      p.elbowL.rotation.x = -0.9;
      p.head.rotation.x = -0.25;
    }
    this.llCheerT -= dt;
    for (const f of this.flying) {
      f.t = Math.min(1, f.t + dt / 0.5);
      const e = f.t * f.t * (3 - 2 * f.t);
      f.c.position.lerpVectors(f.from, f.to, e);
      f.c.position.y += Math.sin(f.t * Math.PI) * 0.18;
      f.c.rotation.set(-Math.PI / 2 * e, 0, f.spin * e);
    }
    this.flying = this.flying.filter((f) => f.t < 1);
    // Plano a dos desde tierra, con el mar y el sol de la tarde detrás; la cámara se arrima un poco a quien
    // le toca. Mira por debajo de las caras: así quedan en la franja libre entre el título y las cartas
    const lean = this.llTurn === 'me' ? -0.28 : 0.28;
    // Con el móvil en vertical, más atrás: que entren los dos enteros
    const back = this.camera.aspect < 1 ? 2.15 : 1;
    this.camera.position.lerp(this.v1.set(lean * back, 1.3 + (back - 1) * 0.35, -1.55 * back), Math.min(1, dt * 1.6));
    this.camLook.lerp(new THREE.Vector3(lean * 0.4, 0.42, 0.15), Math.min(1, dt * 2));
    this.camera.lookAt(this.camLook);
  }

  private setGlasses(on: boolean) {
    this.glasses = on;
    for (const p of [this.player, this.gas]) {
      const g = p.root.getObjectByName('gafas');
      if (g) g.visible = on;
    }
    if (on && !this.glassesEl) {
      const e = document.createElement('div');
      e.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle at 50% 45%, rgba(40,20,0,.55), rgba(10,5,0,.85));pointer-events:none;z-index:2;transition:opacity .4s';
      document.getElementById('ui')!.prepend(e);
      this.glassesEl = e;
    } else if (!on && this.glassesEl) {
      this.glassesEl.remove();
      this.glassesEl = null;
    }
    audio.pop();
    this.updateHud();
  }

  private takePhoto() {
    this.busy = true;
    this.hud.setAction(null);
    audio.pop();
    vibrate(30);
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.95;pointer-events:none;z-index:5;transition:opacity .6s';
    document.getElementById('ui')!.append(f);
    later(() => (f.style.opacity = '0'), 60);
    later(() => {
      f.remove();
      toast(ECLIPSE.photo);
      later(() => this.finish(), 1400);
    }, 700);
  }

  /**
   * La totalidad, como en el cine: la corona con teleobjetivo (y el anillo de diamante), los dos de
   * espaldas frente al mar con las gafas puestas, y su perfil iluminado por la corona.
   */
  private totalityScene() {
    const sun = this.sunDisk.position;
    const heads = () => this.player.root.position.clone().lerp(this.gas.root.position, 0.5).setY(0.85);
    const horizon = this.sunDir.clone().multiplyScalar(30).setY(1.5);
    // Detrás de los dos y alineada con el sol: el eclipse queda entre sus cabezas
    const back = new THREE.Vector3(this.sunDir.x, 0, this.sunDir.z).normalize();
    juice.fx?.flashScreen(0xffffff, 0.35);
    // Los planos son de fuera: sin el oscurecido de mirar a través de las gafas (ellos las llevan puestas)
    if (this.glassesEl) this.glassesEl.style.opacity = '0';
    cinema.play([
      // La corona, de cerca: el último punto de sol y luego los rayos
      { dur: 4.2, pos: new THREE.Vector3(0, 1.4, -0.4), look: sun, fov: 7.5, fov2: 5.5 },
      // Los dos de espaldas, sentados en la roca, frente al eclipse sobre el mar
      { dur: 4.2, pos: back.clone().multiplyScalar(-2.6).setY(0.55), pos2: back.clone().multiplyScalar(-1.9).setY(0.72), look: horizon, fov: 42, focus: heads },
      // De perfil, con las gafas, a la luz de la corona
      { dur: 4, pos: new THREE.Vector3(2.3, 0.95, 0.8), pos2: new THREE.Vector3(1.9, 0.92, 0.55), look: heads, fov: 38, focus: heads },
    ], () => {
      if (this.glassesEl) this.glassesEl.style.opacity = '1';
    });
  }

  private finish() {
    this.phase = 'done';
    this.busy = true;
    this.hud.setAction(null);
    dialogue(ECLIPSE.end, () =>
      phoneChat([CHATS.eclipseFin, CHATS.luna], () => {
        this.setGlasses(false);
        this.onComplete({ stars: 1 + (this.bumps <= 3 ? 1 : 0) + (this.rounds <= 5 ? 1 : 0), stats: ECLIPSE.stats(this.rounds, this.bumps) });
      }),
    );
  }

  // ---------------- Bucle ----------------

  private moveFollowers(dt: number) {
    for (const f of this.followers) {
      const lead = f.lead();
      // Van por donde ha pasado quien guía y chocan con las paredes como cualquiera: Joy entra por la puerta, no por el muro
      const moving = (f.trail ??= new Trail()).step(f.p.root, lead, f.gap, f.speed, dt, this.colliders, 'body' in f.p ? 0.26 : 0.2);
      if ('body' in f.p) animatePerson(f.p, dt, moving ? 'walk' : 'idle', moving ? Math.max(0.35, f.trail.pace) : 0);
      else {
        const k = moving ? Math.sin(this.t * 14) * 0.6 : 0;
        f.p.legs.forEach((l, i) => (l.rotation.x = i % 2 ? k : -k));
        f.p.tail.rotation.z = Math.sin(this.t * 12) * 0.5;
      }
    }
    // Van por el mismo rastro: que se abran a los lados en vez de atravesarse
    const fs = this.followers;
    const radius = (f: (typeof fs)[number]) => ('body' in f.p ? 0.42 : 0.56);
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i], ap = a.p.root.position;
      // Con quien lleva el mando solo se aparta quien sigue
      const toX = ap.x - this.player.root.position.x, toZ = ap.z - this.player.root.position.z;
      const dp = Math.hypot(toX, toZ);
      if (dp > 1e-3 && dp < radius(a) + 0.4) {
        const k = (radius(a) + 0.4 - dp) * Math.min(1, dt * 10);
        a.trail?.nudge(a.p.root, (toX / dp) * k, (toZ / dp) * k, this.colliders);
      }
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j], bp = b.p.root.position;
        const min = radius(a) + radius(b);
        let dx = bp.x - ap.x, dz = bp.z - ap.z;
        let d = Math.hypot(dx, dz);
        if (d >= min) continue;
        if (d < 1e-3) {
          dx = Math.cos(i + j);
          dz = Math.sin(i + j);
          d = 1;
        }
        const k = (min - Math.min(d, min)) * 0.5 * Math.min(1, dt * 10);
        a.trail?.nudge(a.p.root, (-dx / d) * k, (-dz / d) * k, this.colliders);
        b.trail?.nudge(b.p.root, (dx / d) * k, (dz / d) * k, this.colliders);
      }
    }
  }

  private updateKayak(dt: number) {
    const k = this.kayak.position;
    const roll = this.boat!.roll;
    if (this.phase === 'kayak') {
      // Mientras dura la introducción (diálogos y el minijuego de la moto) el kayak solo se mece: el
      // ferry no sale hasta que se puede remar (si no, volcaba en mitad de los diálogos)
      if (!this.busy) this.ferryT += dt;
      if (!this.busy && this.input.consumeAction()) {
        this.kayakV = Math.min(2.6, this.kayakV + 0.45);
        this.stroke = 1;
      }
      if (this.ferryT > 6) {
        this.phase = 'ferry';
        this.ferry.visible = true;
        // Sale de mar abierto hacia la bocana del puerto: de frente contra el costado del kayak
        this.ferry.rotation.y = -Math.PI / 2;
        this.ferry.position.set(k.x + 9, WATER_Y, k.z - 150);
        toast(ECLIPSE.ferryWarn);
        audio.warn();
        vibrate([80, 60, 80]);
        this.updateHud();
      }
    } else if (this.phase === 'ferry') {
      this.input.consumeAction();
      // Da igual lo que remes: el ferry siempre llega. Después del golpe da máquina atrás y vira, y se
      // queda en el agua: nunca se mete en la costa (antes seguía de largo y cruzaba rocas y muros)
      const f = this.ferry;
      if (this.flipT === 0) {
        this.ferryV = 26;
        f.position.x += (k.x + 1.5 - f.position.x) * Math.min(1, dt * 0.8);
      } else {
        this.ferryV *= Math.exp(-dt * 2.6);
        f.rotation.y += (-Math.PI / 2 + 0.35 - f.rotation.y) * Math.min(1, dt * 0.9);
      }
      const yaw = f.rotation.y;
      // El modelo mira a su +x local: hacia (cos, -sen) en el mundo
      f.position.x += Math.cos(yaw) * this.ferryV * dt;
      f.position.z += -Math.sin(yaw) * this.ferryV * dt;
      // La proa (31 m por delante del centro) siempre a más de 7 m de la orilla
      const bowZ = f.position.z - Math.sin(yaw) * 31;
      if (bowZ > COAST_Z - 7) {
        f.position.z -= bowZ - (COAST_Z - 7);
        this.ferryV = 0;
      }
      f.position.y = WATER_Y + Math.sin(this.t * 0.7) * 0.08;
      if (this.flipT === 0 && this.ferry.position.z + 31 > k.z - 1) {
        this.flipT = 0.001;
        audio.hit();
        audio.splash();
        vibrate([200, 50, 200]);
        this.fx.burst(this.v1.copy(k).setY(0.4), 'spray', 40, 4, 1.6);
      }
      if (this.flipT > 0) {
        this.flipT += dt;
        // El kayak se aparta de la roda y vuelca
        k.x += dt * 2.5;
        roll.rotation.z = -Math.min(Math.PI, this.flipT * 4);
        roll.position.y = -Math.min(1, this.flipT) * 0.5;
        if (this.flipT > 1.4 && !this.busy) this.sunk();
      }
    }
    this.kayakV = Math.max(0.35, this.kayakV - dt * 0.6);
    if (this.flipT === 0) {
      k.x += this.kayakV * dt;
      k.y = WATER_Y + Math.sin(this.t * 1.6) * 0.035;
      roll.rotation.x = Math.sin(this.t * 1.3) * 0.025;
      roll.rotation.z = Math.sin(this.t * 0.9) * 0.03;
    }
    this.stroke = Math.max(0, this.stroke - dt * 2.5);
    const splash = this.boat!.update(dt, this.flipT > 0 ? 0 : this.kayakV, WATER_Y);
    if (splash) {
      audio.splash();
      this.fx.burst(splash, 'spray', 7, 0.8, 0.6);
    }
    const rowing = this.phase === 'kayak' && !this.busy;
    this.hud.setAction(rowing ? '🛶 Remar' : null, rowing);
    const f = this.ferry.position;
    const pos = this.phase === 'ferry' ? this.v1.set(k.x - 14, 4.5, k.z + 9) : this.v1.set(k.x - 6.5, 2.4, k.z - 2.8);
    const look = this.phase === 'ferry' ? new THREE.Vector3((k.x + f.x) / 2, 3, Math.max(k.z - 28, (k.z + f.z) / 2)) : new THREE.Vector3(k.x + 6, 0.6, k.z + 1);
    this.camera.position.lerp(pos, Math.min(1, dt * 2.5));
    this.camLook.lerp(look, Math.min(1, dt * 3));
    this.camera.lookAt(this.camLook);
    this.sun.follow(k);
  }

  private updateAzul(dt: number) {
    // El coche azul de Gas llega por la calle y aparca delante
    if (this.carT < 4) {
      const prev = this.car.root.position.x;
      this.carT += dt;
      const e = Math.min(1, this.carT / 4);
      this.car.root.position.x = 40 + (6 - 40) * (1 - (1 - e) * (1 - e));
      this.rig?.update(dt, (prev - this.car.root.position.x) / Math.max(dt, 1e-3), 0, 1.3);
      if (this.carT >= 4 && this.phase === 'arrive') this.getOut();
    } else this.rig?.update(dt, 0);
    if (this.getOutT >= 0) this.stepGetOut(dt);
    if (this.getInT >= 0 && this.getInT < 90) this.stepGetIn(dt);
    this.updateJoy(dt);
    const pp = this.player.root.position;
    // Gente paseando por el paseo marítimo
    for (const p of this.walkers) {
      const w = p.root;
      const dir = w.userData.dir as number;
      w.position.x += dir * dt * 1.1;
      if (Math.abs(w.position.x + 10) > 50) w.userData.dir = -dir;
      w.rotation.y = (dir > 0 ? 1 : -1) * Math.PI / 2;
      animatePerson(p, dt, 'walk', 0.5);
    }
    for (const o of this.others) {
      o.p.root.rotation.y = Math.atan2(pp.x - o.p.root.position.x, pp.z - o.p.root.position.z);
      animatePerson(o.p, dt, o.mode);
    }
    this.moveFollowers(dt);

    const onFoot = this.phase === 'parents' || this.phase === 'walk' || this.phase === 'back' || this.phase === 'toCar';
    const free = !this.busy && onFoot;
    this.walker.turn(this.input.consumeCam());
    if (free) {
      const bounds = this.phase === 'parents' ? HOME_BOUNDS : WALK_BOUNDS;
      if (this.carBox) {
        const c = this.car.root.position;
        Object.assign(this.carBox, { minX: c.x - 2.2, maxX: c.x + 2.2, minZ: c.z - 0.95, maxZ: c.z + 0.95 });
      }
      const move = this.walker.move(dt, this.input.axes(), this.colliders, bounds);
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    } else if (this.getOutT < 0 && this.getInT < 0) animatePerson(this.player, dt, this.busy && (this.phase === 'parents' || this.phase === 'back') ? 'talk' : 'idle');

    let label: string | null = null;
    let act: (() => void) | null = null;
    let tgt: THREE.Vector3 | null = null;
    if (this.phase === 'parents') {
      tgt = DOOR.clone().setZ(1.1);
      if (pp.distanceTo(tgt) < 2.4) {
        label = '👋 Presentar';
        act = () => this.meetParents();
      }
    } else if (this.phase === 'walk') {
      tgt = FAROLA_WALK;
      if (pp.distanceTo(FAROLA_WALK) < 3) act = () => this.walkDone();
    } else if (this.phase === 'back') {
      tgt = DAD_AT;
      if (Math.hypot(pp.x - DAD_AT.x, pp.z - DAD_AT.z) < 2.6) {
        label = ECLIPSE.byeBtn;
        act = () => this.sayBye();
      }
    } else if (this.phase === 'toCar') {
      tgt = this.carDoor().clone();
      if (pp.distanceTo(tgt) < 2) {
        label = ECLIPSE.carBtn;
        act = () => this.boardCar();
      }
    }
    if (this.phase === 'walk' && act && !this.busy) act();
    else {
      this.hud.setAction(free ? label : null, !!label);
      if (this.input.consumeAction() && act && free) act();
    }
    this.marker.visible = !!tgt && free;
    if (tgt && free) {
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

    // (en el patio de Azul, por debajo del toldo y de la buganvilla)
    const pz = this.player.root.position;
    if (free || onFoot) this.walker.camera(this.camera, dt, this.colliders, 6, pz.z < 10.4 && pz.z > -0.5 && Math.abs(pz.x) < 5.4 ? 2.3 : 3.4);
    else {
      this.camera.position.lerp(this.v1.set(pp.x - 2, 3.4, pp.z + 6), Math.min(1, dt * 2));
      this.camLook.lerp(new THREE.Vector3(pp.x, 1.3, pp.z - 1), Math.min(1, dt * 3));
      this.camera.lookAt(this.camLook);
    }
    this.sun.follow(pp);
  }

  /** Círculos del coche (delante, medio y detrás) para chocar con los muros. */
  private carHits(x: number, z: number, yaw: number) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (const o of [-1.3, 0, 1.3]) {
      const cx = x + fx * o, cz = z + fz * o;
      for (const b of this.colliders) {
        const nx = Math.max(b.minX, Math.min(cx, b.maxX));
        const nz = Math.max(b.minZ, Math.min(cz, b.maxZ));
        if ((cx - nx) ** 2 + (cz - nz) ** 2 < 0.88 * 0.88) return true;
      }
    }
    return false;
  }

  private updatePark(dt: number) {
    const c = this.car.root;
    if (this.phase === 'park' && !this.busy) {
      const ax = this.input.axes();
      const want = ax.y * (ax.y > 0 ? 4.5 : 3);
      this.carSpeed += THREE.MathUtils.clamp(want - this.carSpeed, -dt * 6, dt * 6);
      const steer = -ax.x * 0.6;
      const yaw = c.rotation.y + (this.carSpeed / WHEELBASE) * Math.tan(steer) * dt;
      const nx = c.position.x + Math.sin(yaw) * this.carSpeed * dt;
      const nz = c.position.z + Math.cos(yaw) * this.carSpeed * dt;
      if (this.carHits(nx, nz, yaw)) {
        if (Math.abs(this.carSpeed) > 0.6 && this.bumpT <= 0) {
          this.bumps++;
          this.bumpT = 0.8;
          this.clockMin = Math.max(4, this.clockMin - 2);
          toast(ECLIPSE.clockHit);
          audio.hit();
          vibrate(60);
          this.rig?.kick(0.4, 0.2);
          this.updateHud();
        }
        this.carSpeed = 0;
      } else {
        c.rotation.y = yaw;
        c.position.x = nx;
        c.position.z = nz;
      }
      this.bumpT -= dt;
      // Aparcado: dentro de la zona, morro hacia la calle y casi parado
      const inZone = c.position.x > PARK.minX && c.position.x < PARK.maxX && c.position.z > PARK.minZ && c.position.z < PARK.maxZ;
      const facing = Math.abs(Math.atan2(Math.sin(c.rotation.y - Math.PI), Math.cos(c.rotation.y - Math.PI))) < 0.5;
      (this.parkZone.material as THREE.MeshBasicMaterial).color.set(inZone && facing ? 0x5cff8a : inZone ? 0xffd23f : 0x5cff8a);
      if (inZone && facing && Math.abs(this.carSpeed) < 0.8) {
        this.parkedT += dt;
        if (this.parkedT > 0.6) this.parked();
      } else this.parkedT = 0;
    }
    this.rig?.update(dt, this.carSpeed, 0, 1.2);
    this.hud.setAction(null);
    // Cámara alta desde la calle, mirando hacia casa
    // Sobre la calle: desde más atrás, medio plano eran los tejados de enfrente
    const pos = this.v1.set(c.position.x * 0.6 + 1, 11, Math.min(c.position.z - 7, -24.6));
    this.camera.position.lerp(pos, Math.min(1, dt * 2));
    this.camLook.lerp(new THREE.Vector3(c.position.x * 0.8 + 0.5, 0, c.position.z + 1), Math.min(1, dt * 3));
    this.camera.lookAt(this.camLook);
    this.sun.follow(c.position);
  }

  private updateRocks(dt: number) {
    for (const p of [this.player, this.gas]) {
      animatePerson(p, dt, 'idle');
      this.sitPose(p);
      p.head.rotation.x = -0.12;
    }
    if (this.llStage) this.updateCards(dt);
    if (this.phase === 'eclipse' && !this.busy && this.totalT < 0) {
      this.hud.setAction(this.glasses ? '🕶️ Quitarse las gafas' : '🕶️ Ponerse las gafas', !this.glasses);
      if (this.input.consumeAction()) this.setGlasses(!this.glasses);
      if (this.glasses) {
        this.bareT = 0;
        this.progress = Math.min(1, this.progress + dt / 14);
        if (Math.floor(this.progress * 20) !== Math.floor((this.progress - dt / 14) * 20)) this.updateHud();
        if (this.progress >= 1 && this.totalT < 0) {
          this.totalT = 0;
          toast(ECLIPSE.totality);
          audio.fanfare();
          vibrate([40, 40, 120]);
          this.totalityScene();
        }
      } else {
        this.bareT += dt;
        if (this.bareT > 2) {
          this.bareT = -2;
          toast(ECLIPSE.noGlasses);
          audio.warn();
        }
      }
    } else if (this.phase !== 'done') this.hud.setAction(null);
    if (this.totalT >= 0 && this.phase === 'eclipse') {
      // En el máximo: una foto juntos, con las gafas puestas
      this.totalT += dt;
      if (this.totalT > 1.2 && !this.busy && !cinema.active) {
        this.hud.setAction('📸 Foto juntos', true);
        if (this.input.consumeAction()) this.takePhoto();
      }
    }
    // La luna avanza y el cielo se oscurece; en el máximo, corona y estrellas
    const k = this.progress;
    this.placeMoon(k);
    const dark = Math.pow(k, 3);
    this.sky.setColors(
      new THREE.Color(0x2b4a8a).lerp(new THREE.Color(0x070a1e), dark).getHex(),
      new THREE.Color(0xf0985a).lerp(new THREE.Color(0x2a2a4a), dark).getHex(),
      new THREE.Color(0xffcf8a).lerp(new THREE.Color(0xc06a40), dark).getHex(),
    );
    this.hemi.intensity = 0.75 - dark * 0.5;
    this.sun.light.intensity = 1.8 * (1 - dark * 0.9);
    if (this.stars) (this.stars.material as THREE.PointsMaterial).opacity = dark;
    // La corona solo se ve en la totalidad (antes la tapa el brillo del sol) y gira muy despacio
    const cm = this.corona.material as THREE.SpriteMaterial;
    cm.opacity = this.totalT >= 0 ? Math.min(1, this.totalT / 1.6) : Math.max(0, (k - 0.97) / 0.03) * 0.25;
    cm.rotation += dt * 0.01;
    // Anillo de diamante: un destello al empezar la totalidad que se apaga en segundo y medio
    const dm = this.diamond.material as THREE.SpriteMaterial;
    const dk = this.totalT >= 0 ? Math.max(0, 1 - this.totalT / 1.5) : Math.max(0, (k - 0.95) / 0.05);
    dm.opacity = dk;
    this.diamond.scale.setScalar(6 + dk * 34);
    const halo = this.scene.getObjectByName('halo') as THREE.Sprite | undefined;
    if (halo) (halo.material as THREE.SpriteMaterial).opacity = 1 - dark;
    if (!this.llStage) {
      this.camera.position.lerp(this.v1.set(-1.6, 1.7, -3.4), Math.min(1, dt * 2));
      this.camLook.lerp(this.phase === 'eclipse' || this.phase === 'done' ? this.v1.copy(this.sunDir).multiplyScalar(40) : new THREE.Vector3(0, 1.2, 6), Math.min(1, dt * 1.5));
      this.camera.lookAt(this.camLook);
    }
    this.sun.follow(this.player.root.position);
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    // El reloj del eclipse no se para (ni mientras buscas sitio)
    if ((this.phase === 'toCar' || this.phase === 'park') && !this.busy) {
      const before = Math.ceil(this.clockMin);
      this.clockMin = Math.max(4, this.clockMin - dt / 2.4);
      if (Math.ceil(this.clockMin) !== before) this.updateHud();
      if (this.clockMin <= 10 && !this.clockSaid) {
        this.clockSaid = true;
        toast(ECLIPSE.clockLow);
        audio.warn();
      }
    }
    if (this.doors.length) {
      this.doorWho.length = 0;
      for (const p of [this.player, this.gas, ...this.others.map((o) => o.p), ...this.followers.map((f) => f.p)]) if (p?.root.visible && p.root.parent) this.doorWho.push(p.root.position);
      // Aparcando, la corredera se abre para el coche
      if (this.phase === 'park' && this.car.root.parent) this.doorWho.push(this.car.root.position);
      for (const d of this.doors) d.update(dt, this.doorWho, this.camera.position);
    }
    if (this.phase === 'kayak' || this.phase === 'ferry') this.updateKayak(dt);
    else if (this.phase === 'arrive' || this.phase === 'parents' || this.phase === 'walk' || this.phase === 'back' || this.phase === 'toCar') this.updateAzul(dt);
    else if (this.phase === 'park') this.updatePark(dt);
    else if (this.phase === 'marcParents') this.updateKitchen(dt);
    else if (this.rockHop) {
      this.rockHop.update(dt, this.camera, this.busy);
      if (this.rockHop) {
        const can = !this.busy && this.rockHop.canJump;
        this.hud.setAction(can ? SIDE.hop.btn : null, can);
        if (this.input.consumeAction() && can) this.rockHop.jump();
      }
    } else this.updateRocks(dt);
    this.sky.update(this.camera, dt);
  }

  debug(): DebugItem[] {
    const reset = () => {
      this.busy = false;
      this.input.reset();
      this.setGlasses(false);
      if (this.llStage) this.endCards();
      stage.end();
      document.querySelectorAll('.dialogue, .phone-overlay, .princesa-screen, .panel-overlay').forEach((e) => e.remove());
    };
    return [
      { label: '1 · Kayak', run: () => { reset(); this.buildKayak(); applyShadows(this.scene); this.startKayak(); } },
      { label: '2 · Casa de Azul', run: () => { reset(); this.buildAzul(); applyShadows(this.scene); this.startArrive(); } },
      {
        label: '3 · El paseo',
        run: () => {
          reset();
          this.buildAzul();
          applyShadows(this.scene);
          this.carT = 4;
          this.car.azul.visible = false;
          this.car.root.position.x = 6;
          this.player.root.visible = this.gas.root.visible = true;
          this.gas.root.position.set(0.6, 0, 6);
          this.player.root.position.set(0, 0, 11.5);
          this.followers.push({ p: this.gas, lead: () => this.player.root.position, gap: 1.4, speed: 4.2 });
          this.phase = 'walk';
          this.updateHud();
        },
      },
      {
        label: '3c · Vuelta a casa',
        run: () => {
          reset();
          this.buildAzul();
          applyShadows(this.scene);
          this.carT = 4;
          this.car.azul.visible = false;
          this.car.root.position.x = 6;
          this.player.root.visible = this.gas.root.visible = true;
          this.player.root.position.set(-30, 0, 13.5);
          this.gas.root.position.set(-29, 0, 13.5);
          this.followers.push({ p: this.gas, lead: () => this.player.root.position, gap: 1.4, speed: 4.2 });
          const eric = this.others.pop()!;
          eric.p.root.position.set(-28, 0, 13.5);
          this.followers.push({ p: eric.p, lead: () => this.gas.root.position, gap: 1, speed: 4.4 });
          this.joy!.root.visible = true;
          this.joy!.root.position.set(-27, 0, 13.5);
          this.joyOutT = 9;
          this.followers.push({ p: this.joy!, lead: () => this.player.root.position, gap: 1.3, speed: 5.5 });
          this.walker.facing = this.walker.yaw = Math.PI / 2;
          this.phase = 'back';
          this.updateHud();
        },
      },
      {
        label: '3b · Sa Farola',
        run: () => {
          reset();
          this.buildAzul();
          applyShadows(this.scene);
          this.carT = 4;
          this.car.azul.visible = false;
          this.car.root.position.x = 6;
          this.player.root.visible = true;
          this.player.root.position.set(-19, 0, -32);
          this.walker.facing = this.walker.yaw = Math.PI + 0.35;
          this.phase = 'walk';
          this.updateHud();
        },
      },
      { label: '4 · Aparcar', run: () => { reset(); this.buildMarc(); applyShadows(this.scene); this.phase = 'park'; this.updateHud(); } },
      { label: '5 · La cocina', run: () => { reset(); this.buildKitchen(); applyShadows(this.scene); this.phase = 'marcParents'; this.updateHud(); } },
      { label: '6 · Las rocas', run: () => { reset(); this.startRocks(); } },
      {
        label: '7 · El eclipse',
        run: () => {
          reset();
          this.buildRocks();
          applyShadows(this.scene);
          this.phase = 'eclipse';
          this.progress = 0.8;
          this.updateHud();
        },
      },
      { label: '✓ Completar capítulo', run: () => { reset(); this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.glassesEl?.remove();
    this.glassesEl = null;
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}
