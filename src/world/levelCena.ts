import * as THREE from 'three';
import { steerTo, type SteerState } from '../core/steer';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate } from '../core/gfx';
import { CENA } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeCar, makeMoto, animatePerson, Person, PersonLook } from '../entities/models';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, timingGauge, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { ROOF_GEO, type Box2 } from './ferreries';
import type { Level, LevelDone } from './level';
import { disposeObj } from './level';

// Capítulo 6 · La cena a escondidas (13 de julio de 2026), en casa de los padres de Azul, junto a Sa Farola.
// Es el espejo de la piscinita: aquella noche se coló Azul en casa de los padres de Gas; ahora se cuela él.
// Bucle: vigilar a los padres y decirle «Ven» solo cuando se hayan ido → Gas llega en 30 segundos →
// cocinar la carbonara en la cocina de fuera (guanciale, pasta y crema, sin nata) → Gas pone nota →
// cenar en la terraza → 22:50, Gas se va en su moto → 23:39, el WhatsApp real de esa noche.

type Phase = 'intro' | 'wait' | 'gasComing' | 'toKitchen' | 'cook' | 'toTable' | 'dinner' | 'leaving' | 'done';

const STREET_Z = 13.5;
const GATE = new THREE.Vector3(0, 0, 10.2);
const DOOR = new THREE.Vector3(0, 0, 0.4);
const STOVE = new THREE.Vector3(-3.1, 0, 2.3);
const TABLE = new THREE.Vector3(2.6, 0, 5.2);
const WATCH = new THREE.Vector3(-2.2, 0, 9.3);
const PARENT_CAR_X = -4.5;
const GAS_CAR_X = 24;
const GARDEN: Box2 = { minX: -5, maxX: 5, minZ: 0.6, maxZ: 9.7 };

const DAD_LOOK: PersonLook = { skin: 0xf0c8a8, shirt: 0x2c3e66, pants: 0xcbb994, hair: 0xb8b8b8, hairStyle: 'short', beard: true };
const MOM_LOOK: PersonLook = { skin: 0xf2cdb0, shirt: 0xf4efe2, pants: 0x9a4d5e, hair: 0x7a5232, hairStyle: 'bun', skirt: true };

/** Un paso del guion de los padres: hacia dónde va cada uno y qué pasa al llegar. */
interface Beat {
  at: number;
  dad?: THREE.Vector3 | 'hide';
  mom?: THREE.Vector3 | 'hide';
  msg?: string;
  carGo?: boolean;
}

export class LevelCena implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private phase: Phase = 'intro';
  private player: Person;
  private walker: Walker;
  private gas: Person;
  private dad: Person;
  private mom: Person;
  private sky: Sky;
  private sun: Sun;
  private colliders: Box2[] = [];
  private marker: THREE.Group;
  private parentCar = makeCar(0x8c8f94, { luggage: false, joy: false });
  private gasCar = makeMoto(0x1b1d22, MARC_LOOK);
  private beam!: THREE.Mesh;
  private pan!: THREE.Group;
  private steam: THREE.Sprite[] = [];
  private busy = true;
  private t = 0;
  private waitT = 0;
  private beats: Beat[] = [];
  private beatI = 0;
  private dadTo: THREE.Vector3 | null = null;
  private momTo: THREE.Vector3 | null = null;
  private carGoing = false;
  private carSpeed = 0;
  private gasCarT = -1;
  private gasWalk: THREE.Vector3[] = [];
  private scares = 0;
  private grade = 0;
  private tries = 0;
  private nata = 0;
  private minutes = 21 * 60 + 5;
  private cancelGauge: (() => void) | null = null;
  private v1 = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x14183a, 40, 160);
    this.sky = new Sky({ top: 0x050820, mid: 0x1a2458, bottom: 0x3a3a6a, stars: 900 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x8090d0, 0x2a2430, 1.15));
    this.sun = new Sun(sc, 0xb0c0ff, 0.9, new THREE.Vector3(0.4, 1, 0.6), 18);
    const porch = new THREE.PointLight(0xffc27a, 16, 12, 1.6);
    porch.position.set(0, 2.8, 2);
    sc.add(porch);
    const kitchen = new THREE.PointLight(0xffe0b0, 10, 6, 1.6);
    kitchen.position.set(STOVE.x, 2.4, STOVE.z + 0.6);
    sc.add(kitchen);

    this.buildPlace();
    this.fx = new Particles(sc);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.copy(WATCH);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = 0;

    this.gas = makePerson(MARC_LOOK);
    this.gas.root.visible = false;
    sc.add(this.gas.root);
    this.dad = makePerson(DAD_LOOK);
    this.mom = makePerson(MOM_LOOK);
    this.dad.root.position.set(0.5, 0, 0.6);
    this.mom.root.position.set(-0.5, 0, 0.6);
    sc.add(this.dad.root, this.mom.root);

    this.parentCar.azul.visible = false;
    for (const [car, x, lights] of [[this.parentCar, PARENT_CAR_X, true], [this.gasCar, GAS_CAR_X, true]] as const) {
      car.root.rotation.y = -Math.PI / 2; // mira hacia -X (hacia el faro)
      car.root.position.set(x, 0, STREET_Z);
      if (lights) {
        const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff3c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        head.position.set(0, 0.7, 2.4);
        head.scale.set(2.6, 1.2, 1);
        head.visible = false;
        head.name = 'lights';
        car.root.add(head);
      }
      sc.add(car.root);
    }

    this.marker = new THREE.Group();
    const am = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    this.marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16).rotateX(Math.PI), am), new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 10).translate(0, 0.4, 0), am));
    this.marker.visible = false;
    sc.add(this.marker);

    this.hud = hud(() => this.input.queueAction(), onMenu, 'Arrastra a la izquierda para andar · a la derecha para girar la cámara');
    this.updateHud();
    this.camera.position.set(-6, 5.5, 18);
    this.camLook.set(0, 1.5, 4);
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(CENA.intro, () => phoneChat([CHATS.cenaMenu, CHATS.cenaEspera], () => this.phase === 'intro' && this.startWait()));
    }, 2300);
    audio.startMusic('night');
    audio.ambience(0.03);
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Construcción ----------------

  private buildPlace() {
    const sc = this.scene;
    const m = new Merger();
    const WHITE = 0xf6f1e6;
    const SHUTTER = 0x2f7a4a; // persianas verdes menorquinas
    // Suelo: terraza de baldosa, calle de asfalto y acera
    m.add(G.box, 0xd9c7a6, 0, -0.05, 5, 0, 0, 0, 10.4, 0.1, 10.4);
    m.add(G.box, 0x3a3a40, 0, -0.06, STREET_Z, 0, 0, 0, 140, 0.1, 5);
    m.add(G.box, 0xbdb4a4, 0, 0.0, STREET_Z - 2.9, 0, 0, 0, 140, 0.12, 1.2);
    m.add(G.box, 0x6b6150, 0, -0.08, -30, 0, 0, 0, 140, 0.1, 80); // descampado de marès hacia el mar
    // Casa: planta baja y primer piso, blanca, con tejado de teja
    m.add(G.box, WHITE, 0, 2.7, -4, 0, 0, 0, 10, 5.4, 8);
    m.add(ROOF_GEO, 0xb8623e, 0, 5.4, -4, 0, Math.PI / 2, 0, 8.4, 1.6, 10.6);
    this.colliders.push({ minX: -5, maxX: 5, minZ: -8, maxZ: 0 });
    const lit = new Merger();
    for (const [x, y] of [[-3, 1.5], [3, 1.5], [-3, 4], [0, 4], [3, 4]] as [number, number][]) {
      lit.add(G.box, y < 3 ? 0xffd9a0 : 0x6a6a80, x, y, 0.02, 0, 0, 0, 1.1, 1.3, 0.05);
      for (const s of [-1, 1]) m.add(G.box, SHUTTER, x + s * 0.85, y, 0.08, 0, s * 0.35, 0, 0.55, 1.4, 0.06);
    }
    lit.add(G.box, 0xffcf8a, 0, 1.1, 0.02, 0, 0, 0, 1.2, 2.2, 0.05); // puerta abierta con luz
    sc.add(new THREE.Mesh(lit.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    // Muro del jardín con cancela y buganvilla
    for (const [x0, x1] of [[-5.2, -0.9], [0.9, 5.2]]) {
      m.add(G.box, WHITE, (x0 + x1) / 2, 0.55, 10.3, 0, 0, 0, x1 - x0, 1.1, 0.3);
      this.colliders.push({ minX: x0, maxX: x1, minZ: 10.1, maxZ: 10.5 });
    }
    for (const sx of [-5.2, 5.2]) {
      m.add(G.box, WHITE, sx, 0.75, 5.1, 0, 0, 0, 0.3, 1.5, 10.4);
      this.colliders.push({ minX: sx - 0.2, maxX: sx + 0.2, minZ: 0, maxZ: 10.5 });
    }
    m.add(G.box, SHUTTER, 0, 0.5, 10.3, 0, 0, 0, 1.7, 1.0, 0.08); // cancela de madera verde (abierta a ratos)
    for (let i = 0; i < 14; i++) m.add(G.sphere, i % 3 ? 0xc2307a : 0x2f6b3a, -4.8 + i * 0.35, 1.2 + Math.sin(i) * 0.12, 10.25, 0, 0, 0, 0.55, 0.45, 0.4);
    // Cocina de fuera: encimera, fogón, bombona de butano (guiño a «Gas») y estantería
    m.add(G.box, 0xe9e2d2, STOVE.x, 0.45, STOVE.z - 1.0, 0, 0, 0, 2.6, 0.9, 0.8);
    m.add(G.box, 0x7a6a58, STOVE.x, 0.92, STOVE.z - 1.0, 0, 0, 0, 2.7, 0.06, 0.85);
    m.add(G.box, 0x2a2a2e, STOVE.x + 0.3, 0.97, STOVE.z - 1.0, 0, 0, 0, 0.8, 0.04, 0.6);
    m.add(G.cyl, 0xe0662a, STOVE.x + 1.6, 0.35, STOVE.z - 1.1, 0, 0, 0, 0.42, 0.7, 0.42); // butano naranja
    m.add(G.cyl, 0x444444, STOVE.x + 1.6, 0.76, STOVE.z - 1.1, 0, 0, 0, 0.12, 0.12, 0.12);
    m.add(G.box, 0x8a6a44, STOVE.x, 1.9, STOVE.z - 1.35, 0, 0, 0, 2.4, 0.06, 0.35);
    for (let i = 0; i < 4; i++) m.add(G.cyl, [0xd8b04a, 0x2f6b3a, 0xc23030, 0xf4efe2][i], STOVE.x - 0.9 + i * 0.6, 2.08, STOVE.z - 1.35, 0, 0, 0, 0.18, 0.3, 0.18);
    this.colliders.push({ minX: STOVE.x - 1.4, maxX: STOVE.x + 1.9, minZ: STOVE.z - 1.5, maxZ: STOVE.z - 0.6 });
    // Sartén y olla sobre el fuego
    this.pan = new THREE.Group();
    const pm = new Merger();
    pm.add(G.cyl, 0x2b2b2b, 0, 0, 0, 0, 0, 0, 0.5, 0.06, 0.5);
    pm.add(G.box, 0x2b2b2b, 0.42, 0.02, 0, 0, 0, 0, 0.4, 0.04, 0.06);
    pm.add(G.cyl, 0x9a9aa0, -0.55, 0.15, 0.05, 0, 0, 0, 0.45, 0.32, 0.45); // olla de la pasta
    this.pan.add(pm.mesh());
    this.pan.position.set(STOVE.x + 0.2, 1.02, STOVE.z - 1.0);
    sc.add(this.pan);
    const steamMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(steamMat);
      s.scale.setScalar(0.4);
      s.visible = false;
      sc.add(s);
      this.steam.push(s);
    }
    // Mesa de la terraza con mantel, dos sillas y guirnalda de luces
    m.add(G.cyl, 0xf4efe2, TABLE.x, 0.76, TABLE.z, 0, 0, 0, 1.3, 0.05, 1.3);
    m.add(G.cyl, 0x5aa9e6, TABLE.x, 0.79, TABLE.z, 0, 0, 0, 1.0, 0.01, 1.0);
    m.add(G.cyl, 0x777777, TABLE.x, 0.38, TABLE.z, 0, 0, 0, 0.08, 0.76, 0.08);
    for (const sx of [-1, 1]) m.add(G.rbox, 0x8a6a44, TABLE.x + sx * 0.95, 0.45, TABLE.z, 0, 0, 0, 0.45, 0.9, 0.45);
    for (const sx of [-1, 1]) m.add(G.cyl, 0xf4efe2, TABLE.x + sx * 0.3, 0.82, TABLE.z, 0, 0, 0, 0.32, 0.03, 0.32); // platos
    this.colliders.push({ minX: TABLE.x - 1.3, maxX: TABLE.x + 1.3, minZ: TABLE.z - 0.7, maxZ: TABLE.z + 0.7 });
    for (const [x, z] of [[-4.6, 9.6], [4.6, 9.6], [4.6, 0.8]] as [number, number][]) m.add(G.cyl, 0x8a6a44, x, 1.4, z, 0, 0, 0, 0.1, 2.8, 0.1);
    const bulbs = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      const b = new THREE.Sprite(bulbs);
      b.position.set(4.6, 2.75 - Math.sin(k * Math.PI) * 0.4, 0.8 + k * 8.8);
      b.scale.setScalar(0.35);
      sc.add(b);
    }
    // Calle: casas vecinas y farolas
    for (const sx of [-1, 1]) {
      m.add(G.box, 0xf1eadc, sx * 11.5, 2.4, -2, 0, 0, 0, 12, 4.8, 12);
      m.add(ROOF_GEO, 0xb8623e, sx * 11.5, 4.8, -2, 0, Math.PI / 2, 0, 12.2, 1.4, 12.4);
      m.add(G.box, 0xf6f1e6, sx * 11.5, 0.75, 10.3, 0, 0, 0, 12, 1.5, 0.3);
    }
    for (const x of [-14, 6, 26]) {
      m.add(G.cyl, 0x333338, x, 2, STREET_Z - 3.2, 0, 0, 0, 0.12, 4, 0.12);
      const l = new THREE.Sprite(bulbs);
      l.position.set(x, 4.1, STREET_Z - 3.2);
      l.scale.setScalar(1.2);
      sc.add(l);
    }
    // Sa Farola al fondo, sobre las rocas, con su haz girando, y el mar
    const fx = -34;
    const fz = -46;
    m.add(G.cyl, 0x8a7a64, fx, 1, fz, 0, 0, 0, 9, 2, 7);
    m.add(G.cyl, 0xf6f1e6, fx, 6, fz, 0, 0, 0, 1.6, 9, 1.6);
    m.add(G.cyl, 0x2f2f36, fx, 10.9, fz, 0, 0, 0, 1.9, 0.8, 1.9);
    sc.add(new THREE.Mesh(m.build(), toon({ vertexColors: true })));
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lamp.position.set(fx, 11, fz);
    lamp.scale.setScalar(5);
    sc.add(lamp);
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(4, 60, 16, 1, true).translate(0, -30, 0).rotateZ(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.beam.position.set(fx, 11, fz);
    sc.add(this.beam);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 200).rotateX(-Math.PI / 2), toon({ color: 0x0d1f45, emissive: 0x050a1c, roughness: 0.2 }));
    sea.position.set(0, -0.4, -150);
    sea.userData.noCast = true;
    sc.add(sea);
  }

  // ---------------- Fases ----------------

  private updateHud() {
    const hh = Math.floor(this.minutes / 60);
    const mm = Math.floor(this.minutes % 60).toString().padStart(2, '0');
    const clock = `🕘 ${hh}:${mm}`;
    const objective =
      this.phase === 'wait'
        ? 'Vigila a tus padres. «Ven» solo cuando se hayan ido'
        : this.phase === 'gasComing'
          ? 'Gas llega en 30 segundos…'
          : this.phase === 'toKitchen'
            ? 'Ve a la cocina de fuera'
            : this.phase === 'cook'
              ? 'Carbonara de verdad: sin nata'
              : this.phase === 'toTable'
                ? 'Lleva la carbonara a la mesa'
                : this.phase === 'dinner' || this.phase === 'leaving'
                  ? 'Antes de las 22:50…'
                  : '13 de julio · Ciutadella';
    this.hud.setObjective(objective);
    this.hud.setCounters(`<span>${clock}</span>${this.scares ? `<span>😱 ${this.scares}</span>` : ''}${this.grade ? `<span>🍝 ${this.grade}/10</span>` : ''}`);
  }

  private startWait() {
    this.phase = 'wait';
    this.busy = false;
    this.waitT = 0;
    this.beatI = 0;
    const out = (x: number) => new THREE.Vector3(x, 0, 12.2);
    // El guion de los padres. El padre vuelve a por algo, la madre busca las llaves… y luego se van al faro.
    this.beats = [
      { at: 0.5, dad: GATE.clone().setX(0.4), mom: GATE.clone().setX(-0.4), msg: CENA.waitEvents[0] },
      { at: 3.5, dad: out(PARENT_CAR_X + 1.2), mom: out(PARENT_CAR_X - 0.8) },
      { at: 6, dad: DOOR.clone(), msg: CENA.waitEvents[1] },
      { at: 8, msg: CENA.waitEvents[2] },
      { at: 9.5, dad: 'hide' },
      { at: 10, mom: out(PARENT_CAR_X - 2), msg: CENA.waitEvents[3] },
      { at: 12, dad: GATE.clone() },
      { at: 14, dad: out(PARENT_CAR_X + 1.2), mom: out(PARENT_CAR_X - 0.8) },
      { at: 16.5, dad: 'hide', mom: 'hide', carGo: true },
    ];
    this.hud.setAction('📱 «Ven»', false);
    this.updateHud();
  }

  private parentsGone() {
    return this.carGoing && this.parentCar.root.position.x < PARENT_CAR_X - 16;
  }

  private sayCome() {
    if (this.phase !== 'wait') return;
    if (!this.parentsGone()) {
      this.scares++;
      audio.boo();
      vibrate([60, 40, 60]);
      // Los padres se giran a mirar: casi os pillan
      for (const p of [this.dad, this.mom]) if (p.root.visible) p.root.rotation.y = Math.atan2(this.player.root.position.x - p.root.position.x, this.player.root.position.z - p.root.position.z);
      this.updateHud();
      this.busy = true;
      phoneChat(CHATS.cenaPronto, () => (this.busy = false));
      return;
    }
    this.phase = 'gasComing';
    this.hud.setAction(null);
    this.busy = true;
    audio.pickup();
    this.updateHud();
    phoneChat(CHATS.cenaVen, () => {
      // La moto de Gas llega desde el fondo de la calle y para delante de la cancela
      this.gasCarT = 0;
      const lights = this.gasCar.root.getObjectByName('lights');
      if (lights) lights.visible = true;
      audio.whoosh();
    });
  }

  private gasArrived() {
    // Se baja de la moto y entra
    if (this.gasCar.rider) this.gasCar.rider.root.visible = false;
    this.gas.root.visible = true;
    this.gas.root.position.set(2.5, 0, STREET_Z - 1.6);
    this.gasWalk = [GATE.clone().setZ(11), GATE.clone().setZ(8.6), new THREE.Vector3(-1.3, 0, 4.2)];
    this.phase = 'toKitchen';
    this.busy = false;
    this.minutes = 21 * 60 + 10;
    this.updateHud();
  }

  private startCook() {
    this.phase = 'cook';
    this.busy = true;
    this.hud.setAction(null);
    this.tries++;
    this.nata = 0;
    // Azul delante del fuego, Gas mirando apoyado en la encimera
    this.player.root.position.set(STOVE.x + 0.2, 0, STOVE.z - 0.1);
    this.player.root.rotation.y = Math.PI;
    this.walker.facing = Math.PI;
    this.gasWalk = [new THREE.Vector3(STOVE.x - 1.7, 0, STOVE.z + 0.5)];
    this.updateHud();
    const run = () => {
      const scores: number[] = [];
      const trap = { label: '🥛 ¿Nata?', onPress: () => this.pressNata() };
      const step = (i: number) => {
        const opts = [
          { title: CENA.steps.guanciale, duration: 3.2, button: '¡Ya! 🥓', zones: [{ to: 0.5, label: 'Crudo', color: '#f3c4b5' }, { to: 0.74, label: 'Crujiente', color: '#e0a052', good: true }, { to: 1, label: 'Quemado', color: '#5a3a2a' }] },
          { title: CENA.steps.pasta, duration: 2.6, button: 'Escurrir ⏱️', zones: [{ to: 0.56, label: 'Dura', color: '#f4e7b8' }, { to: 0.76, label: 'Al dente', color: '#f2d27a', good: true }, { to: 1, label: 'Pasada', color: '#d9cfa8' }] },
          { title: CENA.steps.mix, duration: 2.2, button: 'Mezclar 🥚', zones: [{ to: 0.34, label: 'Revuelto', color: '#f7c94a' }, { to: 0.6, label: 'Cremosa', color: '#fff0b8', good: true }, { to: 1, label: 'Fría', color: '#e8e2d0' }] },
        ][i];
        this.steamOn(i);
        this.cancelGauge = timingGauge({ ...opts, trap }, (q, z) => {
          this.cancelGauge = null;
          scores.push(q);
          if (q >= 0.95) {
            audio.perfect();
            this.fx.burst(this.v1.copy(this.pan.position).setY(1.6), '✨', 6, 1.2);
          } else if (q > 0) audio.pickup();
          else {
            audio.boo();
            toast(i === 0 && z.to === 1 ? CENA.steps.burnt : i === 2 && z.to < 0.5 ? CENA.steps.scrambled : CENA.steps.raw);
          }
          if (this.phase !== 'cook') return;
          if (i < 2) later(() => this.phase === 'cook' && step(i + 1), 450);
          else this.finishCook(scores);
        });
      };
      step(0);
    };
    if (this.tries === 1) dialogue(CENA.cookIntro, run);
    else run();
  }

  private pressNata() {
    this.nata++;
    audio.warn();
    vibrate([30, 30]);
    toast(CENA.steps.nata);
  }

  private steamOn(step: number) {
    this.steam.forEach((s, i) => {
      s.visible = true;
      s.position.set(this.pan.position.x + (step === 1 ? -0.55 : 0) + (i - 1.5) * 0.12, 1.4 + i * 0.25, this.pan.position.z);
    });
  }

  private finishCook(scores: number[]) {
    // Cada paso vale hasta 3,4 puntos (≈10 si los tres son perfectos); la nata resta 2
    const raw = scores.reduce((a, q) => a + (q > 0 ? 1.6 + q * 1.8 : 0.6), 0) - this.nata * 2;
    this.grade = Math.max(1, Math.min(10, Math.round(raw)));
    this.steam.forEach((s) => (s.visible = false));
    this.updateHud();
    toast(CENA.grade(this.grade));
    if (this.grade < 7) {
      audio.boo();
      later(() => this.phase === 'cook' && this.startCook(), 2200);
      return;
    }
    audio.fanfare();
    vibrate([30, 40, 60]);
    this.fx.burst(this.v1.copy(this.player.root.position).setY(2.2), '❤️', 10, 2);
    later(() => {
      this.phase = 'toTable';
      this.busy = false;
      this.minutes = 21 * 60 + 40;
      this.gasWalk = [new THREE.Vector3(TABLE.x + 1.6, 0, TABLE.z + 1.2)];
      this.updateHud();
    }, 1800);
  }

  private sitDown() {
    this.phase = 'dinner';
    this.busy = true;
    this.hud.setAction(null);
    this.player.root.position.set(TABLE.x - 0.95, 0.05, TABLE.z);
    this.player.root.rotation.y = Math.PI / 2;
    this.gas.root.position.set(TABLE.x + 0.95, 0.05, TABLE.z);
    this.gas.root.rotation.y = -Math.PI / 2;
    this.gasWalk = [];
    this.minutes = 21 * 60 + 50;
    this.updateHud();
    dialogue(CENA.dinner, () => {
      this.minutes = 22 * 60 + 50;
      this.updateHud();
      toast('🕙 22:50');
      audio.warn();
      later(() => this.gasLeaves(), 1200);
    });
  }

  private gasLeaves() {
    this.phase = 'leaving';
    this.gas.root.position.set(TABLE.x + 1.5, 0, TABLE.z);
    this.gasWalk = [GATE.clone().setZ(8.8), GATE.clone().setZ(11.5), new THREE.Vector3(2.4, 0, STREET_Z - 1.6)];
    later(() => {
      if (this.phase !== 'leaving') return;
      fadeFlash(() => this.ending(), 500);
    }, 5200);
  }

  private ending() {
    this.phase = 'done';
    this.gas.root.visible = false;
    this.gasCar.root.visible = false;
    this.minutes = 23 * 60 + 49;
    this.updateHud();
    dialogue(CENA.leave, () => {
      phoneChat(
        [CHATS.teQuiero, CHATS.jazzbah],
        () => {
          const stars = this.scares === 0 && this.tries === 1 && this.grade >= 9 ? 3 : this.scares <= 1 && this.grade >= 8 ? 2 : 1;
          this.onComplete({
            stars,
            stats: [
              ['Nota de Gas', `${this.grade}/10`],
              ['Casi os pillan', `${this.scares}`],
              ['Nata', this.nata ? 'Sí 🙄' : 'Ni una gota'],
            ],
          });
        },
      );
    });
  }

  // ---------------- Bucle ----------------

  private moveTo(p: Person, to: THREE.Vector3, dt: number, speed = 2.2, reach = 0.08) {
    const d = this.v1.subVectors(to, p.root.position).setY(0);
    const len = d.length();
    if (len < reach) {
      const st0 = p.root.userData.steer as SteerState | undefined;
      if (st0 && reach < 0.1) st0.vx = st0.vz = 0;
      animatePerson(p, dt, reach < 0.1 ? 'idle' : 'walk');
      return true;
    }
    const st = (p.root.userData.steer ??= {}) as SteerState;
    steerTo(p.root, st, to.x, to.z, speed, dt);
    animatePerson(p, dt, 'walk');
    return false;
  }

  private sit(p: Person) {
    animatePerson(p, 0.016, 'idle');
    p.legL.rotation.x = p.legR.rotation.x = -Math.PI / 2;
    p.kneeL.rotation.x = p.kneeR.rotation.x = Math.PI / 2 - 0.15;
    p.footL.rotation.x = p.footR.rotation.x = 0.15;
    p.body.position.y = 0;
  }

  private updateParents(dt: number) {
    if (this.phase === 'wait') {
      this.waitT += dt;
      while (this.beatI < this.beats.length && this.waitT >= this.beats[this.beatI].at) {
        const b = this.beats[this.beatI++];
        if (b.msg) toast(`📱 Tú: «${b.msg}»`);
        if (b.dad === 'hide') this.dad.root.visible = false;
        else if (b.dad) {
          this.dad.root.visible = true;
          this.dadTo = b.dad;
        }
        if (b.mom === 'hide') this.mom.root.visible = false;
        else if (b.mom) {
          this.mom.root.visible = true;
          this.momTo = b.mom;
        }
        if (b.carGo) {
          this.carGoing = true;
          const l = this.parentCar.root.getObjectByName('lights');
          if (l) l.visible = true;
          audio.whoosh();
        }
      }
    }
    if (this.dadTo && this.dad.root.visible && this.moveTo(this.dad, this.dadTo, dt)) this.dadTo = null;
    else if (this.dad.root.visible && !this.dadTo) animatePerson(this.dad, dt, 'idle');
    if (this.momTo && this.mom.root.visible && this.moveTo(this.mom, this.momTo, dt, 1.9)) this.momTo = null;
    else if (this.mom.root.visible && !this.momTo) animatePerson(this.mom, dt, this.phase === 'wait' && this.beatI >= 6 && this.beatI < 8 ? 'talk' : 'idle');
    if (this.carGoing) {
      this.carSpeed = Math.min(12, this.carSpeed + dt * 6);
      this.parentCar.root.position.x -= this.carSpeed * dt;
      if (this.parentCar.root.position.x < -70) this.parentCar.root.visible = false;
    }
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.beam.rotation.y = this.t * 0.9;
    this.updateParents(dt);

    // Coche de Gas: del fondo de la calle a la cancela en ~2,5 s
    if (this.gasCarT >= 0) {
      this.gasCarT += dt;
      const k = Math.min(1, this.gasCarT / 2.5);
      const e = 1 - (1 - k) * (1 - k);
      this.gasCar.root.position.x = GAS_CAR_X + (3.2 - GAS_CAR_X) * e;
      if (k >= 1) {
        this.gasCarT = -1;
        this.gasArrived();
      }
    }
    // Gas sigue su camino (entrando, a la cocina, a la mesa o yéndose)
    if (this.gas.root.visible && this.phase !== 'dinner') {
      if (this.gasWalk.length) {
        if (this.moveTo(this.gas, this.gasWalk[0], dt, 2.6, this.gasWalk.length > 1 ? 0.45 : 0.08)) this.gasWalk.shift();
      } else {
        animatePerson(this.gas, dt, this.phase === 'cook' ? 'talk' : 'idle');
        if (this.phase === 'cook' || this.phase === 'toKitchen') this.gas.root.rotation.y = Math.atan2(this.player.root.position.x - this.gas.root.position.x, this.player.root.position.z - this.gas.root.position.z);
      }
    }
    if (this.phase === 'dinner') {
      this.sit(this.player);
      this.sit(this.gas);
      this.gas.armR.rotation.x = -0.7 + Math.sin(this.t * 3) * 0.2;
    }

    const pp = this.player.root.position;
    const free = !this.busy && (this.phase === 'toKitchen' || this.phase === 'toTable');
    this.walker.turn(this.input.consumeCam());
    if (free) {
      const move = this.walker.move(dt, this.input.axes(), this.colliders, GARDEN, [{ x: this.gas.root.position.x, z: this.gas.root.position.z, r: 0.35 }]);
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    } else if (this.phase === 'cook') {
      animatePerson(this.player, dt, 'talk');
      this.player.armR.rotation.x = -1.1 + Math.sin(this.t * 7) * 0.25; // remueve la sartén
    } else if (this.phase === 'wait' || this.phase === 'gasComing' || this.phase === 'intro') {
      this.player.root.rotation.y = Math.atan2(GATE.x - pp.x, STREET_Z - pp.z);
      animatePerson(this.player, dt, this.phase === 'wait' ? 'talk' : 'idle');
    } else if (this.phase !== 'dinner') animatePerson(this.player, dt, 'idle');

    // Vapor de la olla y la sartén
    this.steam.forEach((s, i) => {
      if (!s.visible) return;
      s.position.y += dt * 0.6;
      if (s.position.y > 2.6) s.position.y = 1.3 + i * 0.05;
      (s.material as THREE.SpriteMaterial).opacity = 0.25;
    });
    if (this.phase === 'cook') this.pan.rotation.y = Math.sin(this.t * 6) * 0.06;

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    if (this.phase === 'wait') {
      label = '📱 «Ven»';
      action = () => this.sayCome();
    } else if (free && this.phase === 'toKitchen' && pp.distanceTo(STOVE) < 1.6) {
      label = '🍳 Cocinar';
      action = () => this.startCook();
    } else if (free && this.phase === 'toTable' && pp.distanceTo(TABLE) < 2.1) {
      label = '🍝 Cenar';
      action = () => this.sitDown();
    }
    this.hud.setAction(label, !!label && this.phase !== 'wait');
    if (this.input.consumeAction() && action && (!this.busy || this.phase === 'wait')) action();
    if (this.phase === 'wait' && this.busy) this.hud.setAction(null);

    const tgt = this.phase === 'toKitchen' ? STOVE : this.phase === 'toTable' ? TABLE : null;
    this.marker.visible = !!tgt && free;
    if (tgt) {
      this.marker.position.set(tgt.x, 2.5 + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 2 ? null : -rel);
    } else this.hud.setArrow(null);

    // Cámara
    if (free) this.walker.camera(this.camera, dt, this.colliders, 6, 3.4);
    else {
      const [pos, look] =
        this.phase === 'cook'
          ? [this.v1.set(STOVE.x + 3.0, 2.7, STOVE.z + 2.4), new THREE.Vector3(STOVE.x + 0.2, 1.1, STOVE.z - 0.6)]
          : this.phase === 'dinner'
            ? [this.v1.set(TABLE.x - 0.2, 2.2, TABLE.z + 3.4), new THREE.Vector3(TABLE.x, 0.9, TABLE.z)]
            : this.phase === 'leaving' || this.phase === 'done'
              ? [this.v1.set(-1, 3.2, 6), new THREE.Vector3(1, 1, STREET_Z)]
              : this.phase === 'intro'
                ? [this.v1.set(-7, 5.5, 19), new THREE.Vector3(0, 2, 2)]
                : [this.v1.set(-1.2, 6.2, 4.6), new THREE.Vector3(-4, 0.4, STREET_Z)];
      this.camera.position.lerp(pos, Math.min(1, dt * 2.5));
      this.camLook.lerp(look, Math.min(1, dt * 3));
      this.camera.lookAt(this.camLook);
    }
    this.sun.follow(pp);
    this.sky.update(this.camera, dt);
  }

  debug(): DebugItem[] {
    const reset = () => {
      this.cancelGauge?.();
      this.cancelGauge = null;
      this.busy = false;
    };
    return [
      { label: '1 · Vigilar a los padres', run: () => { reset(); this.startWait(); } },
      {
        label: '2 · Gas ya está aquí',
        run: () => {
          reset();
          this.carGoing = true;
          this.parentCar.root.position.x = -80;
          this.dad.root.visible = this.mom.root.visible = false;
          this.phase = 'wait';
          this.sayCome();
        },
      },
      {
        label: '3 · Cocinar',
        run: () => {
          reset();
          this.dad.root.visible = this.mom.root.visible = false;
          this.gas.root.visible = true;
          this.gas.root.position.set(-1.3, 0, 4.2);
          this.startCook();
        },
      },
      {
        label: '4 · Cenar',
        run: () => {
          reset();
          this.dad.root.visible = this.mom.root.visible = false;
          this.gas.root.visible = true;
          this.grade = 10;
          this.sitDown();
        },
      },
      { label: '✓ Completar capítulo', run: () => { reset(); this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.cancelGauge?.();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.scene.traverse(disposeObj);
  }
}
