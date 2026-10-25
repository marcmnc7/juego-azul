import { Surf } from '../core/surfaces';
import * as THREE from 'three';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate, applyShadows, makeSea } from '../core/gfx';
import { ECLIPSE } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeCar, makeDog, animatePerson, CarRig, type Person, type PersonLook, type Dog } from '../entities/models';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { princesaGame, lostMoto } from '../ui/minis';
import { buildAzulHouse, STREET_Z, DOOR, DAD_LOOK, MOM_LOOK } from './levelCena';
import { FAROLA_WALK, COAST_Z } from './saFarola';
import { canvasTex } from './deco';
import { buildStreet } from './homeStreet';
import type { Box2 } from './ferreries';
import { disposeObj, type Level, type LevelDone } from './level';

// Capítulo 8 · El eclipse (12 de agosto de 2026). «Ready para un dia que vas a recordar toda tu vida?»
// 1. El plan de Gas: kayak de Sa Farola a Sa Caleta. Imposible: un ferry os pasa por encima (ese plan nunca
//    pasó, al final no hubo kayak) y empieza el día de verdad.
// 2. Casa de Azul (la de la cena, de día): llegáis juntos en el coche, Gas conoce a sus padres y salís a dar una
//    vuelta con Joy y Eric hasta Sa Farola.
// 3. Casa de Gas (la de la piscinita): aparcar marcha atrás dentro, por la corredera; entráis los dos y Azul conoce
//    a sus padres en la cocina.
// 4. Solos en las rocas: una partida a La Princesa (gana ella) y el eclipse con las gafas puestas.

type Phase = 'kayak' | 'ferry' | 'arrive' | 'parents' | 'walk' | 'park' | 'marcParents' | 'cards' | 'eclipse' | 'done';

const ERIC_LOOK: PersonLook = { skin: 0xf3d2b6, shirt: 0xf2c94c, pants: 0x3b6ea8, hair: 0xd9b56a, hairStyle: 'short' };
const MARC_DAD: PersonLook = { skin: 0xe2b08c, shirt: 0x6b8fb5, pants: 0x4a4a52, hair: 0x9a9a9a, hairStyle: 'short' };
const MARC_MOM: PersonLook = { skin: 0xeec4a2, shirt: 0xc85a6a, pants: 0x2d2d3a, hair: 0x4a2c1a, hairStyle: 'bun' };
const WALK_BOUNDS: Box2 = { minX: -60, maxX: 40, minZ: COAST_Z - 4, maxZ: 15.5 };
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
  private followers: { p: Person | Dog; lead: () => THREE.Vector3; gap: number; speed: number }[] = [];
  private walkers: Person[] = [];

  // Kayak
  private kayak = new THREE.Group();
  private ferry = new THREE.Group();
  private kayakV = 0;
  private stroke = 0;
  private ferryT = 0;
  private flipT = 0;

  // Coches y aparcamiento
  private car = makeCar(0x1f3a6b, { luggage: false, joy: false });
  private rig: CarRig | null = null;
  private carSpeed = 0;
  private carT = 0;
  private bumps = 0;
  private bumpT = 0;
  private parkedT = 0;
  private parkZone!: THREE.Mesh;

  // Rocas y eclipse
  private rounds = 1;
  private sunDir = new THREE.Vector3(0.15, 0.13, 1).normalize();
  private sunDisk!: THREE.Mesh;
  private moon!: THREE.Mesh;
  private corona!: THREE.Sprite;
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
    audio.ambience(0.05);
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Escenas ----------------

  /** Escena nueva con su cielo y su sol; la anterior se libera. */
  private newScene(sky: ConstructorParameters<typeof Sky>[0], fog: number, sunCol: number, sunI: number, dir: THREE.Vector3) {
    const old = this.scene;
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
    this.others = [];
    this.followers = [];
    this.scene = sc;
    if (old !== sc && this.scenes.length) {
      old.remove(this.marker);
      old.traverse(disposeObj);
    }
    this.scenes = [sc];
    return sc;
  }

  private daySky() {
    return { top: 0x3f86d8, mid: 0x8ec4ee, bottom: 0xd9ecf7, clouds: { count: 8, tint: 0xffffff }, physical: { sunDir: new THREE.Vector3(0.4, 0.9, 0.6) } };
  }

  private sitPose(p: Person) {
    p.legL.rotation.x = p.legR.rotation.x = -Math.PI / 2;
    p.kneeL.rotation.x = p.kneeR.rotation.x = 0.1;
    p.body.position.y = 0;
  }

  private buildKayak() {
    const sc = this.newScene(this.daySky(), 0xbfe0f4, 0xfff4e0, 2.2, new THREE.Vector3(0.5, 1, 0.3));
    sc.add(makeSea([900, 900], 0x0f5a7a, new THREE.Vector3(0.5, 1, 0.3)));
    const m = new Merger();
    // Costa a la izquierda: rocas de marès, Sa Farola y casas blancas
    for (let i = 0; i < 18; i++) m.add(i % 2 ? G.rock : G.rock2, i % 2 ? 0xc9a36a : 0xb8925c, -38 + Math.sin(i) * 4, -1, -40 + i * 14, 0, i, 0, 22, 7, 16);
    m.add(G.cyl, 0xf6f1e6, -30, 7, -24, 0, 0, 0, 1.6, 10, 1.6);
    m.add(G.cyl, 0x2f2f36, -30, 12.4, -24, 0, 0, 0, 1.9, 0.8, 1.9);
    for (let i = 0; i < 8; i++) m.add(G.box, 0xf6f1e6, -50 - (i % 3) * 7, 3, 10 + i * 18, 0, 0.4 * i, 0, 6, 5, 6);
    sc.add(m.mesh());
    // Kayak doble, amarillo, con Azul delante y Gas detrás
    const k = new Merger();
    k.add(G.capsule, 0xf2c230, 0, 0.18, 0, Math.PI / 2, 0, 0, 0.7, 2.0, 0.45);
    k.add(G.cyl, 0x222222, 0, 0.36, 0.55, 0, 0, 0, 0.5, 0.06, 0.6);
    k.add(G.cyl, 0x222222, 0, 0.36, -0.75, 0, 0, 0, 0.5, 0.06, 0.6);
    this.kayak = new THREE.Group();
    this.kayak.add(k.mesh());
    this.player = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    for (const [p, z] of [[this.player, 0.55], [this.gas, -0.75]] as [Person, number][]) {
      p.root.position.set(0, 0.05, z);
      this.sitPose(p);
      p.armL.rotation.x = p.armR.rotation.x = -1.0;
      // Remo de doble pala
      p.handR.add(new Merger().add(G.cyl, 0x333333, -0.4, 0, 0.1, 0, 0, Math.PI / 2, 0.04, 1.8, 0.04).add(G.box, 0xd7263d, -1.3, 0, 0.1, 0, 0, 0, 0.05, 0.4, 0.2).add(G.box, 0xd7263d, 0.5, 0, 0.1, 0, 0, 0, 0.05, 0.4, 0.2).mesh());
      this.kayak.add(p.root);
    }
    this.kayak.position.set(0, 0, 0);
    sc.add(this.kayak);
    // El ferry: casco blanco con franja azul, puente y chimenea
    const f = new Merger();
    f.add(G.box, 0xf4f4f4, 0, 3, 0, 0, 0, 0, 44, 6, 9);
    f.add(G.box, 0x1f4f9a, 0, 1.4, 0, 0, 0, 0, 44.2, 1.2, 9.2);
    f.add(G.box, 0xe8e8e8, -4, 8, 0, 0, 0, 0, 26, 4, 8);
    f.add(G.box, 0x2a3a50, -4, 8.6, 0, 0, 0, 0, 26.2, 1, 8.2);
    f.add(G.box, 0xd7263d, -10, 12, 0, 0, 0, 0, 3, 4, 3);
    f.add(G.box, 0xf4f4f4, 22, 3, 0, 0, Math.PI / 4, 0, 6.4, 6, 6.4);
    this.ferry = new THREE.Group();
    this.ferry.add(f.mesh());
    this.ferry.visible = false;
    sc.add(this.ferry);
    this.camera.position.set(-3, 3, -7);
    this.camLook.set(0, 1, 6);
  }

  private buildAzul() {
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 1.8, new THREE.Vector3(0.4, 1, 0.6));
    const place = buildAzulHouse(sc, this.colliders, true);
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
    dad.root.position.set(-0.8, 0, 1.2);
    mom.root.position.set(0.6, 0, 1.0);
    const eric = makePerson(ERIC_LOOK, 0.55);
    eric.root.position.set(1.4, 0, 1.6);
    const joy = makeDog();
    joy.root.position.set(2.2, 0, 3.2);
    sc.add(dad.root, mom.root, eric.root, joy.root);
    this.others = [{ p: dad, mode: 'idle' }, { p: mom, mode: 'idle' }, { p: eric, mode: 'idle' }];
    for (const p of [dad, mom]) this.colliders.push({ minX: p.root.position.x - 0.3, maxX: p.root.position.x + 0.3, minZ: p.root.position.z - 0.3, maxZ: p.root.position.z + 0.3 });
    // Joy no se separa de Azul; Eric va con Gas cuando salen
    this.followers = [{ p: joy, lead: () => this.player.root.position, gap: 1.3, speed: 5.5 }];
    this.car = makeCar(0x1f3a6b, { luggage: false, joy: false });
    this.car.root.rotation.y = -Math.PI / 2;
    this.car.root.position.set(40, 0, STREET_Z + 0.6);
    sc.add(this.car.root);
    this.rig = new CarRig(this.car);
    this.carT = 0;
  }

  private buildMarc() {
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 1.8, new THREE.Vector3(-0.4, 1, -0.5));
    const street = buildStreet(sc, { gateOpen: true });
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
    this.hemi.intensity = 1.0;
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
    const m = new Merger();
    const WALL = 0xf6f1e6;
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
    for (let i = 0; i < 4; i++) m.add(G.box, 0x5f8f6a, -3.2 + i * 1.3, 1.9, -D + 0.2, 0, 0, 0, 1.2, 0.8, 0.35);
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
    m.add(G.box, 0xf4f1ea, W - 0.12, 1.6, -1.6, 0, 0, 0, 0.02, 0.6, 0.42);
    m.add(G.box, 0xc23030, W - 0.13, 1.84, -1.6, 0, 0, 0, 0.02, 0.12, 0.42);
    // Lámpara colgando sobre la mesa y alfombra de esparto
    m.add(G.box, 0x333333, 0.4, 2.3, 0.9, 0, 0, 0, 0.02, 1.0, 0.02);
    m.add(G.cone, 0x2f6b46, 0.4, 1.72, 0.9, 0, 0, 0, 0.5, 0.3, 0.5);
    m.add(G.box, 0xc9ae7a, 0.4, 0.01, 0.9, 0, 0, 0, 2.8, 0.01, 2.0);
    // Maceta con potos en una esquina
    m.add(G.cyl, 0xb5603b, W - 0.5, 0.25, 2.2, 0, 0, 0, 0.5, 0.5, 0.5);
    m.add(G.sphere, 0x3e7a3a, W - 0.5, 0.75, 2.2, 0, 0, 0, 0.7, 0.6, 0.7);
    // Mesa de madera con hule, sillas, frutero y una ensaimada
    m.add(G.box, 0x8a6a44, 0.4, 0.74, 0.9, 0, 0, 0, 1.8, 0.06, 1.0);
    for (const [x, z] of [[-0.4, 0.5], [1.2, 0.5], [-0.4, 1.3], [1.2, 1.3]]) m.add(G.box, 0x6b4a2e, x, 0.37, z, 0, 0, 0, 0.07, 0.74, 0.07);
    m.add(G.box, 0xf4efe2, 0.4, 0.78, 0.9, 0, 0, 0, 1.5, 0.01, 0.8);
    for (const s of [-1, 1]) m.add(G.rbox, 0x8a6a44, 0.4 + s * 1.2, 0.45, 0.9, 0, 0, 0, 0.45, 0.9, 0.45);
    m.add(G.cyl, 0xd8b04a, 0.1, 0.82, 0.8, 0, 0, 0, 0.5, 0.06, 0.5);
    m.add(G.sphere, 0xe08a2a, 0.75, 0.86, 1.0, 0, 0, 0, 0.14, 0.14, 0.14);
    m.add(G.sphere, 0xc23030, 0.85, 0.86, 0.9, 0, 0, 0, 0.13, 0.13, 0.13);
    this.colliders.push({ minX: -1.1, maxX: 1.9, minZ: 0.3, maxZ: 1.5 });
    sc.add(m.mesh());
    const light = new THREE.PointLight(0xfff0d0, 6, 12, 1.4);
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
    const dusk = { top: 0x2b4a8a, mid: 0xf0985a, bottom: 0xffcf8a, clouds: { count: 5, tint: 0xffc9a0 }, stars: 600 };
    const sc = this.newScene(dusk, 0xf3b27a, 0xffc98a, 1.8, this.sunDir.clone().setY(0.35));
    this.sky.group.traverse((o) => {
      if ((o as THREE.Points).isPoints) this.stars = o as THREE.Points;
    });
    if (this.stars) (this.stars.material as THREE.PointsMaterial).opacity = 0;
    const sea = makeSea([900, 900], 0x1d4f6e, this.sunDir.clone().setY(0.35), { emissive: 0x2a1a20 });
    sea.position.y = -1.6;
    sc.add(sea);
    const m = new Merger();
    m.add(G.sphere, 0xc9a36a, 0, -1.6, 0, 0, 0, 0, 16, 3.2, 12);
    m.add(G.rock2, 0xb8925c, -7, -1.2, -4, 0, 0.5, 0, 10, 3.6, 9);
    m.add(G.rock, 0xd1ad74, 6, -1.4, -3, 0, 1, 0, 9, 3.2, 8);
    for (let i = 0; i < 9; i++) m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xc9a36a : 0xb48a54, -14 + i * 3.6, -1.5, 5 + Math.sin(i * 2.3) * 2, i, i * 0.7, 0, 3 + (i % 3), 1.4, 2.6);
    m.add(G.box, 0x5aa9e6, 0, 0.0, 0.2, -0.05, 0, 0, 2.4, 0.04, 1.6); // toalla
    for (let i = 0; i < 3; i++) m.add(G.box, 0xf4efe2, -0.3 + i * 0.25, 0.04, 0.8, 0, i * 0.4, 0, 0.18, 0.01, 0.26); // cartas
    sc.add(m.mesh());
    this.player = makePerson(MARGAUX_LOOK);
    this.gas = makePerson(MARC_LOOK);
    for (const [p, x] of [[this.player, -0.45], [this.gas, 0.45]] as [Person, number][]) {
      p.root.position.set(x, 0.02, 0);
      p.root.rotation.y = 0;
      this.sitPose(p);
      sc.add(p.root);
      // Gafas de eclipse (se ven cuando se las ponen)
      const g = new Merger().add(G.box, 0x111111, 0, 0.32, 0.27, 0, 0, 0, 0.5, 0.12, 0.05).mesh();
      g.name = 'gafas';
      g.visible = false;
      p.head.add(g);
    }
    // Sol bajo sobre el mar, la luna que se le pone delante y la corona
    const dist = 300;
    this.sunDisk = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }));
    this.sunDisk.position.copy(this.sunDir).multiplyScalar(dist);
    this.sunDisk.lookAt(0, 0, 0);
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(9.2 * 0.97, 40), new THREE.MeshBasicMaterial({ color: 0x0c0c14, fog: false }));
    this.moon.lookAt(this.v1.copy(this.sunDir).multiplyScalar(-1));
    this.corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xdfe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    this.corona.position.copy(this.sunDisk.position);
    this.corona.scale.setScalar(60);
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
      park: ECLIPSE.parkHint,
      marcParents: ECLIPSE.kitchenHint,
      cards: 'En las rocas',
      eclipse: this.glasses ? 'Mira cómo la luna tapa el sol' : ECLIPSE.glassesHint,
      done: '12 de agosto de 2026',
    };
    this.hud.setObjective(o[this.phase]);
    this.hud.setCounters(this.phase === 'park' ? `<span class="chip">💥 ${this.bumps}</span>` : this.phase === 'eclipse' ? `<span class="chip">🌘 ${Math.round(this.progress * 100)}%</span>` : '');
  }

  private startKayak() {
    this.phase = 'kayak';
    this.busy = false;
    this.ferryT = 0;
    this.flipT = 0;
    this.kayakV = 0;
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
    this.updateHud();
  }

  /** El coche ya está aparcado delante de casa: os bajáis y Gas te sigue hasta la puerta. */
  private getOut() {
    this.car.azul.visible = false;
    this.player.root.visible = this.gas.root.visible = true;
    this.player.root.position.set(5.2, 0, STREET_Z - 1.7);
    this.gas.root.position.set(6.4, 0, STREET_Z - 1.2);
    this.walker.facing = this.walker.yaw = Math.PI;
    this.followers.push({ p: this.gas, lead: () => this.player.root.position, gap: 1.4, speed: 4.2 });
    audio.pop();
    dialogue(ECLIPSE.arriveAzul, () => {
      this.phase = 'parents';
      this.busy = false;
      this.updateHud();
    });
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
    dialogue(ECLIPSE.walkDone, () =>
      fadeFlash(() => {
        this.buildMarc();
        applyShadows(this.scene);
        this.phase = 'park';
        this.busy = true;
        this.updateHud();
        dialogue(ECLIPSE.driveIntro, () => {
          this.busy = false;
          toast('Arriba avanza · abajo, marcha atrás · los lados giran el volante');
        });
      }, 500),
    );
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
    dialogue(ECLIPSE.meetMarcParents, () => fadeFlash(() => this.startRocks(), 500));
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
    this.phase = 'cards';
    this.busy = true;
    this.updateHud();
    audio.startMusic('night');
    dialogue(ECLIPSE.rocks, () =>
      princesaGame((rounds) => {
        this.rounds = rounds;
        dialogue(ECLIPSE.afterCards, () => {
          this.phase = 'eclipse';
          this.busy = false;
          this.progress = 0;
          this.bareT = 0;
          this.updateHud();
        });
      }),
    );
  }

  private setGlasses(on: boolean) {
    this.glasses = on;
    for (const p of [this.player, this.gas]) {
      const g = p.head.getObjectByName('gafas');
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

  private finish() {
    this.phase = 'done';
    this.busy = true;
    this.hud.setAction(null);
    dialogue(ECLIPSE.end, () =>
      phoneChat([CHATS.eclipseFin, CHATS.luna], () => {
        this.setGlasses(false);
        this.onComplete({ stars: 1 + (this.bumps <= 3 ? 1 : 0) + (this.rounds <= 2 ? 1 : 0), stats: ECLIPSE.stats(this.rounds, this.bumps) });
      }),
    );
  }

  // ---------------- Bucle ----------------

  private moveFollowers(dt: number) {
    for (const f of this.followers) {
      const root = f.p.root;
      const lead = f.lead();
      const dx = lead.x - root.position.x, dz = lead.z - root.position.z;
      const d = Math.hypot(dx, dz);
      const moving = d > f.gap;
      if (moving) {
        const step = Math.min(d - f.gap, f.speed * dt * Math.min(1, (d - f.gap) * 1.5 + 0.3));
        root.position.x += (dx / d) * step;
        root.position.z += (dz / d) * step;
      }
      if (d > 0.05) root.rotation.y = Math.atan2(dx, dz);
      if ('body' in f.p) animatePerson(f.p, dt, moving ? 'walk' : 'idle', moving ? 0.8 : 0);
      else {
        const k = moving ? Math.sin(this.t * 14) * 0.6 : 0;
        f.p.legs.forEach((l, i) => (l.rotation.x = i % 2 ? k : -k));
        f.p.tail.rotation.z = Math.sin(this.t * 12) * 0.5;
      }
    }
  }

  private updateKayak(dt: number) {
    if (this.phase === 'kayak') {
      this.ferryT += dt;
      if (this.input.consumeAction()) {
        this.kayakV = Math.min(2.6, this.kayakV + 0.45);
        this.stroke = 1;
        audio.splash();
      }
      if (this.ferryT > 6) {
        this.phase = 'ferry';
        this.ferry.visible = true;
        this.ferry.position.set(140, 0, this.kayak.position.z + 6);
        toast(ECLIPSE.ferryWarn);
        audio.warn();
        vibrate([80, 60, 80]);
        this.updateHud();
      }
    } else if (this.phase === 'ferry') {
      this.input.consumeAction();
      // Da igual lo que remes: el ferry siempre llega
      this.ferry.position.x -= dt * 26;
      this.ferry.position.z += (this.kayak.position.z + 1 - this.ferry.position.z) * Math.min(1, dt * 2);
      if (this.flipT === 0 && this.ferry.position.x < 24) {
        this.flipT = 0.001;
        audio.hit();
        audio.splash();
        vibrate([200, 50, 200]);
        this.fx.burst(this.v1.copy(this.kayak.position).setY(1), '💦', 16, 3, 1.5);
      }
      if (this.flipT > 0) {
        this.flipT += dt;
        this.kayak.rotation.z = Math.min(Math.PI, this.flipT * 4);
        this.kayak.position.y = -Math.min(1, this.flipT) * 0.6;
        if (this.flipT > 1.4 && !this.busy) this.sunk();
      }
    }
    this.kayakV = Math.max(0, this.kayakV - dt * 0.6);
    this.kayak.position.z += this.kayakV * dt;
    this.kayak.position.y = this.flipT > 0 ? this.kayak.position.y : Math.sin(this.t * 1.6) * 0.05;
    this.kayak.rotation.x = Math.sin(this.t * 1.3) * 0.03;
    this.stroke = Math.max(0, this.stroke - dt * 2.5);
    const sw = Math.sin(this.t * 6) * this.stroke;
    for (const p of [this.player, this.gas]) p.body.rotation.y = sw * 0.5;
    this.hud.setAction(this.phase === 'kayak' ? '🛶 Remar' : null, this.phase === 'kayak');
    const k = this.kayak.position;
    const pos = this.phase === 'ferry' ? this.v1.set(k.x - 9, 5, k.z - 9) : this.v1.set(k.x - 2.5, 2.8, k.z - 6.5);
    const look = this.phase === 'ferry' ? new THREE.Vector3((k.x + this.ferry.position.x) / 2, 3, k.z) : new THREE.Vector3(k.x, 1, k.z + 6);
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

    const free = !this.busy && (this.phase === 'parents' || this.phase === 'walk');
    this.walker.turn(this.input.consumeCam());
    if (free) {
      const bounds = this.phase === 'walk' ? WALK_BOUNDS : HOME_BOUNDS;
      const move = this.walker.move(dt, this.input.axes(), this.colliders, bounds);
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    } else animatePerson(this.player, dt, this.busy && this.phase === 'parents' ? 'talk' : 'idle');

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
    } else this.hud.setArrow(null);

    if (free || this.phase === 'walk') this.walker.camera(this.camera, dt, this.colliders, 6, 3.4);
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
          toast(ECLIPSE.parkBump);
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
      const facing = Math.abs(Math.atan2(Math.sin(c.rotation.y - Math.PI), Math.cos(c.rotation.y - Math.PI))) < 0.32;
      (this.parkZone.material as THREE.MeshBasicMaterial).color.set(inZone && facing ? 0x5cff8a : inZone ? 0xffd23f : 0x5cff8a);
      if (inZone && facing && Math.abs(this.carSpeed) < 0.4) {
        this.parkedT += dt;
        if (this.parkedT > 0.6) this.parked();
      } else this.parkedT = 0;
    }
    this.rig?.update(dt, this.carSpeed, 0, 1.2);
    this.hud.setAction(null);
    // Cámara alta desde la calle, mirando hacia casa
    const pos = this.v1.set(c.position.x * 0.6 + 1, 11, Math.min(c.position.z - 9, -26));
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
      if (this.totalT > 1.2 && !this.busy) {
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
    (this.corona.material as THREE.SpriteMaterial).opacity = Math.max(0, (k - 0.85) / 0.15) * 0.9;
    const halo = this.scene.getObjectByName('halo') as THREE.Sprite | undefined;
    if (halo) (halo.material as THREE.SpriteMaterial).opacity = 1 - dark;
    this.camera.position.lerp(this.v1.set(-1.6, 1.7, -3.4), Math.min(1, dt * 2));
    this.camLook.lerp(this.phase === 'eclipse' || this.phase === 'done' ? this.v1.copy(this.sunDir).multiplyScalar(40) : new THREE.Vector3(0, 1.2, 6), Math.min(1, dt * 1.5));
    this.camera.lookAt(this.camLook);
    this.sun.follow(this.player.root.position);
  }

  update(dt: number) {
    this.t += dt;
    if (this.phase === 'kayak' || this.phase === 'ferry') this.updateKayak(dt);
    else if (this.phase === 'arrive' || this.phase === 'parents' || this.phase === 'walk') this.updateAzul(dt);
    else if (this.phase === 'park') this.updatePark(dt);
    else if (this.phase === 'marcParents') this.updateKitchen(dt);
    else this.updateRocks(dt);
    this.sky.update(this.camera, dt);
  }

  debug(): DebugItem[] {
    const reset = () => {
      this.busy = false;
      this.input.reset();
      this.setGlasses(false);
      document.querySelectorAll('.mini-screen, .dialogue, .phone-overlay, .princesa-screen').forEach((e) => e.remove());
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
    this.scene.traverse(disposeObj);
  }
}
