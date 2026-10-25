import * as THREE from 'three';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate, applyShadows } from '../core/gfx';
import { ECLIPSE } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeCar, makeDog, animatePerson, CarRig, type Person, type PersonLook, type Dog } from '../entities/models';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { princesaGame } from '../ui/minis';
import { buildAzulHouse, STREET_Z, GATE, DOOR, DAD_LOOK, MOM_LOOK } from './levelCena';
import { buildStreet, STREET } from './homeStreet';
import type { Box2 } from './ferreries';
import { disposeObj, type Level, type LevelDone } from './level';

// Capítulo 8 · El eclipse (12 de agosto de 2026). «Ready para un dia que vas a recordar toda tu vida?»
// 1. El plan de Gas: kayak de Sa Farola a Sa Caleta. Imposible: un ferry os pasa por encima (ese plan nunca
//    pasó, al final no hubo kayak) y empieza el día de verdad.
// 2. Casa de Azul (la de la cena, de día): Gas conoce a sus padres y salís a dar una vuelta con Joy y Eric.
// 3. Casa de Gas (la de la piscinita): aparcar marcha atrás dentro, por la corredera; Azul conoce a sus padres.
// 4. Solos en las rocas: una partida a La Princesa (gana ella) y el eclipse con las gafas puestas.

type Phase = 'kayak' | 'ferry' | 'gate' | 'parents' | 'walk' | 'park' | 'marcParents' | 'cards' | 'eclipse' | 'done';

const ERIC_LOOK: PersonLook = { skin: 0xf3d2b6, shirt: 0xf2c94c, pants: 0x3b6ea8, hair: 0xd9b56a, hairStyle: 'short' };
const MARC_DAD: PersonLook = { skin: 0xe2b08c, shirt: 0x6b8fb5, pants: 0x4a4a52, hair: 0x9a9a9a, hairStyle: 'short' };
const MARC_MOM: PersonLook = { skin: 0xeec4a2, shirt: 0xc85a6a, pants: 0x2d2d3a, hair: 0x4a2c1a, hairStyle: 'bun' };
const FAROLA_SPOT = new THREE.Vector3(-30, 0, -34);
const WALK_BOUNDS: Box2 = { minX: -60, maxX: 40, minZ: -50, maxZ: 15.5 };
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
    later(() => phoneChat(CHATS.eclipseReady, () => dialogue(ECLIPSE.kayakIntro, () => this.startKayak())), 1800);
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
    sc.fog = new THREE.Fog(fog, 60, 320);
    this.sky = new Sky(sky);
    sc.add(this.sky.group);
    this.hemi = new THREE.HemisphereLight(0xd8e6ff, 0x6a5a48, 1.15);
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
    return { top: 0x3f86d8, mid: 0x8ec4ee, bottom: 0xd9ecf7, clouds: { count: 8, tint: 0xffffff } };
  }

  private sitPose(p: Person) {
    p.legL.rotation.x = p.legR.rotation.x = -Math.PI / 2;
    p.kneeL.rotation.x = p.kneeR.rotation.x = 0.1;
    p.body.position.y = 0;
  }

  private buildKayak() {
    const sc = this.newScene(this.daySky(), 0xbfe0f4, 0xfff4e0, 2.2, new THREE.Vector3(0.5, 1, 0.3));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), toon({ color: 0x1f7fae, emissive: 0x062a44, roughness: 0.12, metalness: 0.1 }));
    sea.userData.noCast = true;
    sc.add(sea);
    const m = new Merger();
    // Costa a la izquierda: rocas de marès, Sa Farola y casas blancas
    for (let i = 0; i < 18; i++) m.add(G.sphere, i % 2 ? 0xc9a36a : 0xb8925c, -38 + Math.sin(i) * 4, -1, -40 + i * 14, 0, i, 0, 22, 7, 16);
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
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 2.2, new THREE.Vector3(0.4, 1, 0.6));
    const place = buildAzulHouse(sc, this.colliders);
    place.beam.visible = false;
    place.steam.forEach((s) => (s.visible = false));
    // Casas vecinas como obstáculo para el paseo
    for (const sx of [-1, 1]) this.colliders.push({ minX: sx * 11.5 - 6, maxX: sx * 11.5 + 6, minZ: -8, maxZ: 4 }, { minX: sx * 11.5 - 6, maxX: sx * 11.5 + 6, minZ: 10.1, maxZ: 10.5 });
    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(1.4, 0, 3);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = 0;
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
    this.car.azul.visible = false;
    this.car.root.rotation.y = -Math.PI / 2;
    this.car.root.position.set(40, 0, STREET_Z + 0.6);
    sc.add(this.car.root);
    this.rig = new CarRig(this.car);
    this.carT = 0;
  }

  private buildMarc() {
    const sc = this.newScene(this.daySky(), 0xd9ecf7, 0xfff1d8, 2.2, new THREE.Vector3(-0.4, 1, -0.5));
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

  private buildRocks() {
    const dusk = { top: 0x2b4a8a, mid: 0xf0985a, bottom: 0xffcf8a, clouds: { count: 5, tint: 0xffc9a0 }, stars: 600 };
    const sc = this.newScene(dusk, 0xf3b27a, 0xffc98a, 1.8, this.sunDir.clone().setY(0.35));
    this.sky.group.traverse((o) => {
      if ((o as THREE.Points).isPoints) this.stars = o as THREE.Points;
    });
    if (this.stars) (this.stars.material as THREE.PointsMaterial).opacity = 0;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), toon({ color: 0x2a6f9a, emissive: 0x2a1a20, roughness: 0.12, metalness: 0.15 }));
    sea.position.y = -1.6;
    sea.userData.noCast = true;
    sc.add(sea);
    const m = new Merger();
    m.add(G.sphere, 0xc9a36a, 0, -1.6, 0, 0, 0, 0, 16, 3.2, 12);
    m.add(G.sphere, 0xb8925c, -7, -1.2, -4, 0, 0.5, 0, 10, 3.6, 9);
    m.add(G.sphere, 0xd1ad74, 6, -1.4, -3, 0, 1, 0, 9, 3.2, 8);
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
      gate: 'Gas ya está en la puerta: ve a abrirle',
      parents: ECLIPSE.parentsHint,
      walk: ECLIPSE.walkHint,
      park: ECLIPSE.parkHint,
      marcParents: 'Casa de Gas',
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
            this.startGate();
          }),
        ),
      600,
    );
  }

  private startGate() {
    this.phase = 'gate';
    this.busy = true;
    this.carT = 0;
    this.updateHud();
    dialogue(ECLIPSE.arriveAzul, () => (this.busy = false));
  }

  private openGate() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.gas.root.position.set(0.6, 0, 9.4);
    this.phase = 'parents';
    audio.pop();
    this.updateHud();
    later(() => (this.busy = false), 400);
    this.followers.push({ p: this.gas, lead: () => this.player.root.position, gap: 1.4, speed: 4.2 });
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
          const c = this.car.root.position;
          this.player.root.visible = this.gas.root.visible = true;
          this.player.root.position.set(c.x - 1.6, 0, -17.6);
          this.gas.root.position.set(c.x - 2.4, 0, -17.0);
          const dad = makePerson(MARC_DAD);
          const mom = makePerson(MARC_MOM);
          dad.root.position.set(STREET.door.x - 0.5, 0, -15.8);
          mom.root.position.set(STREET.door.x + 0.5, 0, -16.0);
          this.scene.add(dad.root, mom.root);
          this.others = [{ p: dad, mode: 'wave' }, { p: mom, mode: 'talk' }];
          for (const p of [this.player, this.gas]) p.root.rotation.y = Math.atan2(STREET.door.x - p.root.position.x, -15.8 - p.root.position.z);
          for (const o of this.others) o.p.root.rotation.y = Math.atan2(this.player.root.position.x - o.p.root.position.x, this.player.root.position.z - o.p.root.position.z);
          this.camera.position.set(1.5, 3.2, -21.5);
          this.camLook.set(-2, 1.2, -16);
          dialogue(ECLIPSE.meetMarcParents, () => fadeFlash(() => this.startRocks(), 500));
        }, 400),
      1300,
    );
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
      if (this.carT >= 4) {
        this.gas.root.visible = true;
        this.gas.root.position.set(4.5, 0, STREET_Z - 1.6);
      }
    } else this.rig?.update(dt, 0);
    const pp = this.player.root.position;
    // Gas espera al otro lado de la cancela hasta que le abres
    if (this.phase === 'gate' && this.gas.root.visible) {
      const g = this.gas.root.position;
      const to = this.v1.set(GATE.x + 0.4, 0, GATE.z + 1.3);
      const d = Math.hypot(to.x - g.x, to.z - g.z);
      if (d > 0.1) {
        g.x += ((to.x - g.x) / d) * Math.min(d, dt * 2.6);
        g.z += ((to.z - g.z) / d) * Math.min(d, dt * 2.6);
        this.gas.root.rotation.y = Math.atan2(to.x - g.x, to.z - g.z);
      } else this.gas.root.rotation.y = Math.PI;
      animatePerson(this.gas, dt, d > 0.1 ? 'walk' : 'wave', d > 0.1 ? 0.8 : 0);
    }
    for (const o of this.others) {
      o.p.root.rotation.y = Math.atan2(pp.x - o.p.root.position.x, pp.z - o.p.root.position.z);
      animatePerson(o.p, dt, o.mode);
    }
    this.moveFollowers(dt);

    const free = !this.busy && (this.phase === 'gate' || this.phase === 'parents' || this.phase === 'walk');
    this.walker.turn(this.input.consumeCam());
    if (free) {
      const bounds = this.phase === 'walk' ? WALK_BOUNDS : { minX: -5, maxX: 5, minZ: 0.6, maxZ: 9.9 };
      const move = this.walker.move(dt, this.input.axes(), this.colliders, bounds);
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    } else animatePerson(this.player, dt, this.busy && this.phase === 'parents' ? 'talk' : 'idle');

    let label: string | null = null;
    let act: (() => void) | null = null;
    let tgt: THREE.Vector3 | null = null;
    if (this.phase === 'gate') {
      tgt = GATE;
      if (this.carT >= 4 && pp.distanceTo(GATE) < 1.8) {
        label = '🚪 Abrir';
        act = () => this.openGate();
      }
    } else if (this.phase === 'parents') {
      tgt = DOOR.clone().setZ(1.1);
      if (pp.distanceTo(tgt) < 2.4) {
        label = '👋 Presentar';
        act = () => this.meetParents();
      }
    } else if (this.phase === 'walk') {
      tgt = FAROLA_SPOT;
      if (pp.distanceTo(FAROLA_SPOT) < 3) act = () => this.walkDone();
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
    for (const o of this.others) animatePerson(o.p, dt, o.mode);
    if (this.phase === 'marcParents') {
      for (const p of [this.player, this.gas]) animatePerson(p, dt, 'idle');
      this.camera.lookAt(this.camLook);
      return;
    }
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
    if (this.phase === 'eclipse' && !this.busy) {
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
      this.totalT += dt;
      if (this.totalT > 3.5) this.finish();
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
    this.hemi.intensity = 1.15 - dark * 0.8;
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
    else if (this.phase === 'gate' || this.phase === 'parents' || this.phase === 'walk') this.updateAzul(dt);
    else if (this.phase === 'park' || this.phase === 'marcParents') this.updatePark(dt);
    else this.updateRocks(dt);
    this.sky.update(this.camera, dt);
  }

  debug(): DebugItem[] {
    const reset = () => {
      this.busy = false;
      this.input.reset();
      this.setGlasses(false);
    };
    return [
      { label: '1 · Kayak', run: () => { reset(); this.buildKayak(); applyShadows(this.scene); this.startKayak(); } },
      { label: '2 · Casa de Azul', run: () => { reset(); this.buildAzul(); applyShadows(this.scene); this.startGate(); } },
      {
        label: '3 · El paseo',
        run: () => {
          reset();
          this.buildAzul();
          applyShadows(this.scene);
          this.carT = 4;
          this.gas.root.visible = true;
          this.gas.root.position.set(0.6, 0, 6);
          this.player.root.position.set(0, 0, 11.5);
          this.followers.push({ p: this.gas, lead: () => this.player.root.position, gap: 1.4, speed: 4.2 });
          this.phase = 'walk';
          this.updateHud();
        },
      },
      { label: '4 · Aparcar', run: () => { reset(); this.buildMarc(); applyShadows(this.scene); this.phase = 'park'; this.updateHud(); } },
      { label: '5 · Las rocas', run: () => { reset(); this.startRocks(); } },
      {
        label: '6 · El eclipse',
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
