import * as THREE from 'three';
import { canvasTex } from './deco';
import { Surf } from '../core/surfaces';
import { steerTo, type SteerState } from '../core/steer';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate, makeSea } from '../core/gfx';
import { comicBulbTexture } from '../core/comicTiles';
import { LOOK_LIGHT } from '../core/comic';
import { Lost } from '../core/lost';
import { CENA, SIDE } from '../data/story';
import { makeHelmet } from '../entities/helmet';
import { rigPost } from '../entities/rig';
import { TableMemory, TableDecor, tableLayout, shuffledLayout } from './sideGames';
import { cinema } from '../core/cinema';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { araucaria, CarRig, G, Merger, makePerson, makeCar, makeMoto, animatePerson, seatedRootY, seatPose, Person, PersonLook } from '../entities/models';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { buildSaFarola, COAST_Z } from './saFarola';
import { buildSurroundings } from './surround';
import { hud, dialogue, bark, timingGauge, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { radar } from '../ui/minis';
import { ROOF_GEO, type Box2 } from './ferreries';
import type { Level, LevelDone } from './level';
import { disposeScene } from './level';
import { beacon } from '../core/beacon';
import { Door } from './door';

// Capítulo 7 · La cena a escondidas (13 de julio de 2026), en casa de los padres de Azul, junto a Sa Farola.
// Es el espejo de la piscinita: aquella noche se coló Azul en casa de los padres de Gas; ahora se cuela él.
// Bucle: vigilar a los padres y decirle «Ven» solo cuando se hayan ido → Gas llega en moto, aparca más adelante y
// espera en la cancela → cocinar la carbonara en la cocina de fuera (guanciale, pasta y crema, sin nata) → Gas pone
// nota → encender la guirnalda y cenar en la terraza → unos faros: recoger lo que os delataría → era el vecino; Gas
// recupera su casco y se va en la moto → la mesa como en la foto → a la cama → 23:39, el WhatsApp real de esa noche.
//
// La hora, como fue: el 13 de julio el sol se pone en Ciutadella a las 21:13 (por el noroeste, sobre el mar), la
// luz del crepúsculo dura hasta las 21:45 y a las 22:25 ya es de noche cerrada. Esa noche no había luna: era la
// víspera de la luna nueva (la del eclipse del 12 de agosto fue la siguiente). Por eso el capítulo empieza con
// el cielo del atardecer y se va haciendo de noche con el reloj.

type Phase = 'intro' | 'wait' | 'gasComing' | 'toGate' | 'toKitchen' | 'cook' | 'toTable' | 'dinner' | 'alarm' | 'seeOff' | 'gasRide' | 'tidy' | 'toBed' | 'done';

export const STREET_Z = 13.5;
export const GATE = new THREE.Vector3(0, 0, 10.2);
export const DOOR = new THREE.Vector3(0, 0, 0.4);
const STOVE = new THREE.Vector3(-3.1, 0, 2.3);
const TABLE = new THREE.Vector3(2.6, 0, 5.2);
const WATCH = new THREE.Vector3(-2.2, 0, 9.3);
/** Junto a la cancela, por dentro (donde ella le abre a Gas y se despiden). */
const GATE_IN = new THREE.Vector3(0, 0, 9.35);
/** Por fuera de la cancela, donde Gas espera a que le abran. */
const GATE_OUT = new THREE.Vector3(0.15, 0, 11.3);
/** Donde se pone ella para darle a la luz de la guirnalda (el interruptor está en la fachada, junto a la puerta). */
const SWITCH_AT = new THREE.Vector3(-1.4, 0, 0.75);
const PARENT_CAR_X = -4.5;
/** Aparcado en el lado del valle, mirando al pueblo (+x), con sitio para que la madre abra su puerta. */
const PARK_Z = 14.95;
/** Gas aparca «más adelante» (como ella le pidió a las 20:58), junto al muro del vecino: no delante de casa. */
const MOTO_PARK = new THREE.Vector3(13.4, 0, 11.15);
/** Por dónde se baja y se sube (el lado izquierdo de la moto, que mira a -x). */
const MOTO_SIDE = new THREE.Vector3(13.5, 0, 11.8);
/** Donde deja el casco al entrar: en el suelo, junto al escúter. */
const HELMET_SPOT = new THREE.Vector3(-1.95, 0, 7.75);
/** Donde lo esconde ella con el susto: entre el contenedor y el muro. */
const HIDE_SPOT = new THREE.Vector3(-3.2, 0, 9.72);
/** Centro del casco apoyado en el suelo (el ribete de abajo queda a ras). */
const HELMET_Y = 0.105;
/** Carril por el que pasa el coche del vecino (lejos de la moto aparcada). */
const NEIGHBOR_Z = 12.9;
const GARDEN: Box2 = { minX: -5, maxX: 5, minZ: 0.6, maxZ: 9.7 };
/** Cuánto tardan los faros en pasar por delante de casa. */
const ALARM_SECS = 12;
const T = (h: number, m: number) => h * 60 + m;

export const DAD_LOOK: PersonLook = { skin: 0xf0c8a8, shirt: 0x2c3e66, pants: 0xcbb994, hair: 0xb8b8b8, hairStyle: 'short', beard: true };
export const MOM_LOOK: PersonLook = { skin: 0xf2cdb0, shirt: 0xf4efe2, pants: 0x9a4d5e, hair: 0x7a5232, hairStyle: 'straight', skirt: true };
const NEIGHBOR_LOOK: PersonLook = { skin: 0xe8b894, shirt: 0x6a7a5a, pants: 0x3a3a40, hair: 0x4a3a2a, hairStyle: 'short', male: true };

// ---------------- La hora: del atardecer a la noche ----------------

/** Minutos del reloj → cuánto se ha hecho de noche (0, el sol en el horizonte; 1, noche cerrada). */
const DUSK: [number, number][] = [[T(21, 5), 0], [T(21, 13), 0.1], [T(21, 45), 0.5], [T(22, 25), 0.9], [T(22, 45), 1]];
function duskOf(min: number) {
  if (min <= DUSK[0][0]) return DUSK[0][1];
  for (let i = 1; i < DUSK.length; i++) {
    const [m1, k1] = DUSK[i];
    const [m0, k0] = DUSK[i - 1];
    if (min <= m1) return k0 + ((min - m0) / (m1 - m0)) * (k1 - k0);
  }
  return 1;
}

interface Tint {
  top: number; mid: number; bottom: number; fog: number; fogNear: number; fogFar: number;
  sun: number; sunI: number; dir: THREE.Vector3;
  sky: number; ground: number; hemi: number;
  csky: number; cground: number; chemi: number;
}
// (la cúpula de noche como la aclara Sky: casi negra no, azul ultramar)
const NIGHT_TOP = new THREE.Color(0x050820).lerp(new THREE.Color(0x0b1846), 0.7).getHex();
const TINTS: [Tint, Tint, Tint] = [
  // 21:05: el sol a punto de ponerse por el noroeste, sobre el mar; azul claro arriba, melocotón abajo; luz baja y cálida
  {
    top: 0x3c66b2, mid: 0x86a7d8, bottom: 0xf0b88e, fog: 0xd2b0a6, fogNear: 60, fogFar: 220,
    sun: 0xffb98a, sunI: 1.6, dir: new THREE.Vector3(-0.82, 0.34, -0.46),
    sky: 0xb4bce0, ground: 0x5a4a48, hemi: 0.55, csky: 0xd4cbe6, cground: 0x6a5462, chemi: 1.1,
  },
  // 21:45: la hora azul, con el horizonte aún lila
  {
    top: 0x1e357c, mid: 0x3f5ea8, bottom: 0xa88cb0, fog: 0x4f5a8a, fogNear: 50, fogFar: 190,
    sun: 0xb8b8f0, sunI: 1.7, dir: new THREE.Vector3(-0.55, 0.75, -0.2),
    sky: 0x8090d0, ground: 0x2a2430, hemi: 0.45, csky: 0xa4ade6, cground: 0x4e4a72, chemi: 1.05,
  },
  // Noche cerrada, como el cap. 2: se ve de noche, pero se ve todo (la «luna» es solo la luz que dibuja)
  {
    top: NIGHT_TOP, mid: 0x1a2458, bottom: 0x3a3a6a, fog: 0x14183a, fogNear: 40, fogFar: 160,
    sun: 0xb8c8ff, sunI: 2.0, dir: new THREE.Vector3(0.4, 1, 0.6),
    sky: 0x6f7fc0, ground: 0x1a2030, hemi: 1.1 * 0.32, csky: LOOK_LIGHT.noche.sky, cground: LOOK_LIGHT.noche.ground, chemi: LOOK_LIGHT.noche.hemi,
  },
];
/** El mar al atardecer (el de noche es el de makeSea({ night })). */
const SEA_DUSK = 0x2c6c94;
const _ca = new THREE.Color(), _cb = new THREE.Color();
const mixHex = (a: number, b: number, f: number) => _ca.setHex(a).lerp(_cb.setHex(b), f);

/**
 * Un vehículo que sigue un camino: sale ya en marcha y coge su velocidad enseguida (acelera fuerte), frena antes
 * de girar y, si se le pide, se para al final. Coloca el objeto y deja su giro (para el balanceo).
 */
class Drive {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  s = 0;
  yaw: number;
  yawRate = 0;
  done = false;
  constructor(pts: THREE.Vector3[], public v: number, private o: { vmax: number; accel?: number; brake?: number; slow?: [number, number, number][]; stop?: boolean }) {
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.length = this.curve.getLength();
    const t = this.curve.getTangentAt(0);
    this.yaw = Math.atan2(t.x, t.z);
  }

  step(dt: number, obj: THREE.Object3D) {
    if (dt <= 0) return this.v;
    const { vmax, accel = 4.5, brake = 3.5, slow = [], stop = false } = this.o;
    let target = vmax;
    for (const [s0, s1, vs] of slow) {
      if (this.s < s0) target = Math.min(target, Math.sqrt(vs * vs + 2 * brake * (s0 - this.s)));
      else if (this.s < s1) target = Math.min(target, vs);
    }
    const left = this.length - this.s;
    if (stop) target = Math.min(target, Math.sqrt(2 * brake * Math.max(0, left)));
    this.v = this.v < target ? Math.min(target, this.v + accel * dt) : Math.max(target, this.v - brake * 1.6 * dt);
    this.s = Math.min(this.length, this.s + this.v * dt);
    if (stop && this.length - this.s < 0.04) {
      this.s = this.length;
      this.v = 0;
    }
    const u = this.s / this.length;
    this.curve.getPointAt(u, obj.position);
    const t = this.curve.getTangentAt(u);
    const yaw = Math.atan2(t.x, t.z);
    this.yawRate = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw)) / dt;
    this.yaw = yaw;
    obj.rotation.y = yaw;
    if (this.s >= this.length) this.done = true;
    return this.v;
  }
}

type HelmetAt = 'rider' | 'gas' | 'ground' | 'hidden' | 'azul';

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
  private hemi: THREE.HemisphereLight;
  private stars: THREE.Points | null;
  /** El agua de tebeo (la cala y el mar del faro): del azul del atardecer al de la noche. */
  private seas: THREE.ShaderMaterial[] = [];
  private colliders: Box2[] = [];
  private marker: THREE.Group;
  /** Pistas (flecha, marcador, columna) solo a los 40 s sin avanzar. */
  private lost = new Lost();
  private place: ReturnType<typeof buildAzulHouse>;
  private parentCar = makeCar(0x8c8f94, { luggage: false, joy: false, driver: DAD_LOOK, passenger: MOM_LOOK });
  private parentDriver: THREE.Object3D | null;
  private parentRig: CarRig;
  private parentDrive: Drive | null = null;
  private moto = makeMoto(0x1b1d22, MARC_LOOK);
  private motoDrive: Drive | null = null;
  private motoState: 'away' | 'arriving' | 'parked' | 'leaving' | 'gone' = 'away';
  private motoLean = 0;
  private mountT = -1;
  private neighbor = makeCar(0x2c3a4a, { luggage: false, joy: false, driver: NEIGHBOR_LOOK });
  private neighborRig: CarRig;
  private neighborDrive: Drive | null = null;
  private neighborLights: THREE.Sprite[] = [];
  private neighborParkT = -1;
  private pan: THREE.Group;
  private steam: THREE.Sprite[];
  private helmet: THREE.Group;
  private helmetAt: HelmetAt = 'rider';
  private helmetBox: Box2 = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, low: true, round: true };
  private phone: THREE.Mesh;
  private dinnerPlates: THREE.Mesh;
  private decor: TableDecor;
  /** La foto de la mesa antes de que llegara Gas: así está puesta al empezar, y así hay que dejarla. */
  private photo = tableLayout();
  private garlandOn = false;
  private busy = true;
  private t = 0;
  private waitT = 0;
  private beats: Beat[] = [];
  private beatI = 0;
  // Camino de cada uno: puntos por los que pasa (por la puerta del jardín, nunca a través del muro)
  private dadPath: THREE.Vector3[] = [];
  private momPath: THREE.Vector3[] = [];
  private carGoing = false;
  /** La cancela y la puerta de casa: se abren para quien llega y se cierran detrás. */
  private doors: Door[] = [];
  private doorWho: THREE.Vector3[] = [];
  private gasWalk: THREE.Vector3[] = [];
  /** Gas ha llegado a la cancela (y espera a que le abran) / ya le han abierto. */
  private gasAtGate = false;
  private letIn = false;
  private gateT = 0;
  private nagged = false;
  private tableGame: TableMemory | null = null;
  private alarmT = 0;
  private alarmItems: { key: 'plates' | 'pan' | 'helmet'; at: THREE.Vector3; done: boolean }[] = [];
  private tidied = 0;
  private scares = 0;
  private grade = 0;
  private tries = 0;
  private nata = 0;
  private minutes = T(21, 5);
  /** Cuánto se ha hecho de noche (0..1), que sigue al reloj poco a poco. */
  private dusk = 0;
  private duskShown = -1;
  private cancelGauge: (() => void) | null = null;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private sunDir = new THREE.Vector3();
  /** Lo que se lleva en la mano (el casco, el móvil), colocado después de la animación de los huesos. */
  private post = () => this.placeCarried();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(TINTS[0].fog, TINTS[0].fogNear, TINTS[0].fogFar);
    this.sky = new Sky({ top: 0x050820, mid: 0x1a2458, bottom: 0x3a3a6a, stars: 1400 });
    sc.add(this.sky.group);
    this.stars = (this.sky.group.children.find((o) => (o as THREE.Points).isPoints) as THREE.Points | undefined) ?? null;
    this.hemi = new THREE.HemisphereLight(TINTS[0].sky, TINTS[0].ground, TINTS[0].hemi);
    sc.add(this.hemi);
    // (la del capítulo la pone el propio nivel con la hora: el reparto de settleAmbient se sobrescribe)
    sc.userData.hemiScale = 1;
    // (nadie va deprisa: las líneas de velocidad del tebeo solo saldrían en los cortes de cámara)
    sc.userData.speedLines = 0.3;
    this.sun = new Sun(sc, TINTS[0].sun, TINTS[0].sunI, TINTS[0].dir, 18);
    // (la luz baja del atardecer y la de la noche rozan las paredes largas: sin esto salían rayas de sombra)
    this.sun.light.shadow.normalBias = 0.16;
    this.sun.light.shadow.bias = -0.0012;
    // (sin luces de lámpara: ni el porche, ni la cocina, ni las farolas, ni el faro, ni los faros de los coches dan
    // luz a nada; solo se ven encendidas)

    const place = buildAzulHouse(sc, this.colliders);
    this.place = place;
    this.doors = [place.gate, place.door];
    this.pan = place.pan;
    this.steam = place.steam;
    if (place.tablePlates) place.tablePlates.visible = false; // (los platos los pone ella para cenar)
    // La guirnalda, apagada hasta la cena
    if (place.garland) (place.garland.material as THREE.PointsMaterial).color.setHex(GARLAND_OFF);
    this.fx = new Particles(sc);
    sc.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (mat?.isShaderMaterial && mat.uniforms?.uNight) this.seas.push(mat);
    });
    this.decor = new TableDecor(sc, TABLE, 0.795);
    this.decor.show(this.photo);
    // Los platos de la cena, con la carbonara (salen al sentarse; con el susto, fuera)
    {
      const plates = new Merger(false);
      for (const dx of [-0.34, 0.34]) {
        plates.add(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 20), 0xfbf7ee, dx, 0.01, 0);
        plates.add(new THREE.CylinderGeometry(0.09, 0.09, 0.016, 16), 0xe8c978, dx, 0.024, 0);
        plates.add(G.box, 0xc8ccd0, dx + (dx < 0 ? -0.17 : 0.17), 0.003, 0.02, 0, 0, 0, 0.02, 0.006, 0.17);
      }
      this.dinnerPlates = plates.mesh();
      this.dinnerPlates.position.set(TABLE.x, 0.795, TABLE.z);
      this.dinnerPlates.userData.comicBent = true;
      this.dinnerPlates.visible = false;
      sc.add(this.dinnerPlates);
    }
    // El casco de Gas (en la mano, en el suelo junto al escúter o escondido): se crea ya, para que el cómic lo
    // convierta al cargar
    this.helmet = makeHelmet({ color: 0xb02a2a, stripe: 0xf2f2ee });
    this.helmet.visible = false;
    this.helmet.userData.comicBent = true;
    sc.add(this.helmet);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.copy(WATCH);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = 0;
    // El móvil en la mano mientras vigila y le escribe a Gas
    this.phone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.01), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdfe8ff, emissiveIntensity: 0.6 }));
    this.phone.rotation.x = -Math.PI / 2;
    // (el radar y los chats del principio, también en el móvil)
    this.phone.visible = true;
    this.player.handR.add(this.phone);

    this.gas = makePerson(MARC_LOOK);
    this.gas.root.visible = false;
    sc.add(this.gas.root);
    this.dad = makePerson(DAD_LOOK);
    this.mom = makePerson(MOM_LOOK);
    this.dad.root.position.set(0.5, 0, 0.6);
    this.mom.root.position.set(-0.5, 0, 0.6);
    sc.add(this.dad.root, this.mom.root);
    // (quietos, sin el «asentir» de la gente que charla)
    for (const p of [this.player, this.gas, this.dad, this.mom]) if (p.rig) p.rig.noFidget = true;

    // El coche de los padres, aparcado mirando al pueblo; el padre conduce y la madre va al lado (hasta que suben,
    // el coche está vacío: antes el padre salía dos veces, andando y al volante)
    this.parentCar.root.rotation.y = Math.PI / 2;
    this.parentCar.root.position.set(PARENT_CAR_X, 0, PARK_Z);
    this.parentDriver = this.parentCar.body.children.find((o) => (o as THREE.Group).isGroup && o !== this.parentCar.azul) ?? null;
    this.parentRig = new CarRig(this.parentCar);
    sc.add(this.parentCar.root);
    // La moto de Gas: aún no está (espera «en un lugar estratégico», lejos)
    this.moto.root.visible = false;
    sc.add(this.moto.root);
    // El coche del vecino (el susto de las 22.50): vacío de pasajero, con su conductor y los faros encendidos
    // (solo se ven encendidos: su luz de tebeo; no alumbran el suelo)
    this.neighbor.azul.visible = false;
    for (const s of [-0.62, 0.62]) {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.position.set(s, 0.74, 2.25);
      g.scale.setScalar(0.7);
      this.neighbor.root.add(g);
      this.neighborLights.push(g);
    }
    this.neighbor.root.visible = false;
    this.neighborRig = new CarRig(this.neighbor);
    sc.add(this.neighbor.root);
    this.stageParents();

    this.marker = new THREE.Group();
    const am = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    this.marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16).rotateX(Math.PI), am), new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.35, 10).translate(0, 0.4, 0), am));
    this.marker.visible = false;
    sc.add(this.marker);

    rigPost.add(this.post);
    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.setClock(T(21, 5), true);
    this.updateHud();
    this.camera.position.set(-7, 5.5, 19);
    this.camLook.set(0, 2, 2);
    this.camera.lookAt(this.camLook);
    later(() => {
      if (this.phase !== 'intro') return;
      // 9 de julio: antes de la cena, Azul sigue el vuelo de Gas en el radar
      dialogue(CENA.radarIntro, () =>
        radar(() => dialogue(CENA.intro, () => phoneChat([CHATS.cenaMenu, CHATS.cenaEspera], () => this.phase === 'intro' && this.startWait()))),
      );
    }, 2300);
    audio.startMusic('night');
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Hora y luces ----------------

  /** Pone el reloj; la luz y el cielo lo siguen poco a poco (snap: de golpe, al saltar de fase en el modo prueba). */
  private setClock(min: number, snap = false) {
    this.minutes = min;
    if (snap) this.dusk = duskOf(min);
    this.updateHud();
  }

  private updateSky(dt: number) {
    const want = duskOf(this.minutes);
    // (unos diez segundos de transición: los saltos de reloj pasan durante los diálogos)
    this.dusk += THREE.MathUtils.clamp(want - this.dusk, -dt * 0.1, dt * 0.1);
    const k = this.dusk;
    const [a, b, f] = k < 0.5 ? [TINTS[0], TINTS[1], k / 0.5] : [TINTS[1], TINTS[2], (k - 0.5) / 0.5];
    if (Math.abs(k - this.duskShown) > 0.002) {
      this.duskShown = k;
      const top = mixHex(a.top, b.top, f).getHex();
      const mid = mixHex(a.mid, b.mid, f).getHex();
      this.sky.setColors(top, mid, mixHex(a.bottom, b.bottom, f).getHex());
      const fog = this.scene.fog as THREE.Fog;
      fog.color.copy(mixHex(a.fog, b.fog, f));
      fog.near = THREE.MathUtils.lerp(a.fogNear, b.fogNear, f);
      fog.far = THREE.MathUtils.lerp(a.fogFar, b.fogFar, f);
      this.sun.light.color.copy(mixHex(a.sun, b.sun, f));
      this.sun.light.intensity = Math.min(2.5, THREE.MathUtils.lerp(a.sunI, b.sunI, f));
      this.sunDir.copy(a.dir).lerp(b.dir, f).normalize();
      this.hemi.color.copy(mixHex(a.sky, b.sky, f));
      this.hemi.groundColor.copy(mixHex(a.ground, b.ground, f));
      this.hemi.intensity = THREE.MathUtils.lerp(a.hemi, b.hemi, f);
      // El mar: al atardecer aún azul y reflejando el cielo claro; de noche, azul marino
      for (const m of this.seas) {
        m.uniforms.uColor.value.copy(mixHex(SEA_DUSK, 0x0a1630, THREE.MathUtils.smoothstep(k, 0.05, 0.8)));
        m.uniforms.uEmissive.value.copy(mixHex(0x000000, 0x050a1c, THREE.MathUtils.smoothstep(k, 0.4, 0.9))).multiplyScalar(0.6);
        m.uniforms.uNight.value = k > 0.45 ? 1 : 0;
      }
      // Las estrellas salen cuando oscurece (a las 21:05 aún no se ve ninguna)
      if (this.stars) (this.stars.material as THREE.PointsMaterial).opacity = 0.9 * THREE.MathUtils.smoothstep(k, 0.4, 0.85);
      // Las farolas se encienden al ponerse el sol; las lámparas de la casa, cuando ya no se ve bien
      for (const l of this.place.streetLamps) l.visible = k > 0.18;
      for (const l of this.place.wallLamps) l.visible = k > 0.3;
      this.place.lighthouse.visible = k > 0.1;
    }
    // La hemisférica del cómic (la crea al montar la escena), del tono del atardecer al de la noche
    const ch = this.scene.userData.comicHemi as THREE.HemisphereLight | undefined;
    if (ch && ch.userData.duskAt !== this.duskShown) {
      ch.userData.duskAt = this.duskShown;
      ch.color.copy(mixHex(a.csky, b.csky, f));
      ch.groundColor.copy(mixHex(a.cground, b.cground, f));
      ch.intensity = THREE.MathUtils.lerp(a.chemi, b.chemi, f);
    }
    // La luz principal sigue a quien se mueve (ajustada a la rejilla del mapa de sombras para que no tiemble)
    const p = this.player.root.position;
    const x = Math.round(p.x / 0.5) * 0.5, z = Math.round(p.z / 0.5) * 0.5;
    this.sun.light.position.set(x + this.sunDir.x * 40, this.sunDir.y * 40, z + this.sunDir.z * 40);
    this.sun.light.target.position.set(x, 0, z);
    // El faro: la óptica gira y la linterna destella cuando apunta hacia quien mira (sin haz en el aire)
    const L = this.place.lighthouse;
    if (L.visible) {
      const toCam = Math.atan2(this.camera.position.x - L.position.x, this.camera.position.z - L.position.z);
      const d = Math.abs(Math.atan2(Math.sin(this.t * 0.9 - toCam), Math.cos(this.t * 0.9 - toCam)));
      const flash = Math.pow(Math.max(0, 1 - d / 0.4), 2);
      L.scale.setScalar(3 + flash * 5);
    }
  }

  // ---------------- HUD ----------------

  private updateHud() {
    if (!this.hud) return;
    const hh = Math.floor(this.minutes / 60);
    const mm = Math.floor(this.minutes % 60).toString().padStart(2, '0');
    const clock = `🕘 ${hh}:${mm}`;
    // Objetivos de un emoji o dos palabras: sin decir qué hacer
    const objective: Record<Phase, string> = {
      intro: '13 de julio · Ciutadella',
      wait: '👀',
      gasComing: '🏍️',
      toGate: '🏍️',
      toKitchen: '🍝',
      cook: 'Carbonara de verdad',
      toTable: '🍝',
      dinner: '🕙',
      alarm: '🚗‼️',
      seeOff: '🪖',
      gasRide: '🏍️',
      tidy: '📷',
      toBed: '🛏️',
      done: '🤍',
    };
    this.hud.setObjective(objective[this.phase]);
    const left = this.phase === 'alarm' && !this.busy ? `<span class="chip">⏱️ ${Math.ceil(this.alarmT)}</span>` : '';
    this.hud.setCounters(`<span class="chip">${clock}</span>${left}${this.scares ? `<span class="chip">😱 ${this.scares}</span>` : ''}${this.grade ? `<span class="chip">🍝 ${this.grade}/10</span>` : ''}`);
  }

  // ---------------- Fases ----------------

  /** Los padres en casa, a punto de salir; su coche aparcado y vacío; la moto, lejos. */
  private stageParents() {
    this.dad.root.visible = this.mom.root.visible = true;
    this.dad.root.position.set(0.5, 0, 0.6);
    this.mom.root.position.set(-0.5, 0, 0.6);
    this.dadPath = [];
    this.momPath = [];
    this.carGoing = false;
    this.parentDrive = null;
    this.parentCar.root.visible = true;
    this.parentCar.root.position.set(PARENT_CAR_X, 0, PARK_Z);
    this.parentCar.root.rotation.y = Math.PI / 2;
    this.parentCar.azul.visible = false;
    if (this.parentDriver) this.parentDriver.visible = false;
  }

  private startWait() {
    this.phase = 'wait';
    this.busy = false;
    this.waitT = 0;
    this.beatI = 0;
    const driverDoor = new THREE.Vector3(PARENT_CAR_X + 0.3, 0, PARK_Z - 1.35);
    const passengerDoor = new THREE.Vector3(PARENT_CAR_X + 0.3, 0, PARK_Z + 1.3);
    // (la madre rodea el coche por delante para llegar a su puerta, entre el coche y el muro del valle)
    const aroundFront = new THREE.Vector3(PARENT_CAR_X + 2.9, 0, PARK_Z - 0.6);
    const aroundFront2 = new THREE.Vector3(PARENT_CAR_X + 2.7, 0, PARK_Z + 1.3);
    // El guion de los padres. El padre vuelve a por algo y la madre le espera junto a su puerta… y se van al pueblo.
    this.beats = [
      { at: 0.5, dad: [GATE.clone().setX(0.4)], mom: [GATE.clone().setX(-0.4)], msg: CENA.waitEvents[0] },
      { at: 3.5, dad: [driverDoor], mom: [aroundFront, aroundFront2, passengerDoor] },
      { at: 6, dad: [DOOR.clone()], msg: CENA.waitEvents[1] },
      { at: 8, msg: CENA.waitEvents[2] },
      { at: 8.7, dad: [DOOR.clone().setZ(-0.9)] }, // entra en casa (por la puerta, que se abre)
      { at: 9.5, dad: 'hide' },
      { at: 10, msg: CENA.waitEvents[3] },
      { at: 12, dad: [GATE.clone()] },
      { at: 14, dad: [driverDoor] },
      { at: 16.5, dad: 'hide', mom: 'hide', carGo: true },
    ];
    this.phone.visible = true;
    this.hud.setAction('📱 «Ven»', false);
    this.updateHud();
  }

  private parentsGone() {
    return this.carGoing && !!this.parentDrive && this.parentDrive.s > 16;
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
    this.setClock(T(21, 8));
    phoneChat(CHATS.cenaVen, () => this.motoArrives());
  }

  /** «Cuando me digas voy y tardo 30 sec»: llega por la calle ya en marcha, frena y aparca más adelante. */
  private motoArrives() {
    this.motoState = 'arriving';
    this.moto.root.visible = true;
    if (this.moto.rider) this.moto.rider.root.visible = true;
    this.helmetAt = 'rider';
    this.motoDrive = new Drive(
      [new THREE.Vector3(64, 0, 12.4), new THREE.Vector3(40, 0, 12.3), new THREE.Vector3(24, 0, 12.0), new THREE.Vector3(16.5, 0, 11.5), new THREE.Vector3(15.0, 0, 11.2), MOTO_PARK.clone()],
      8,
      { vmax: 9, brake: 3.2, stop: true },
    );
    this.motoDrive.step(1e-3, this.moto.root);
    audio.whoosh();
  }

  /** Aparca (en la pata de cabra), se baja y va andando a la cancela con el casco en la mano. */
  private motoParked() {
    this.motoState = 'parked';
    this.motoDrive = null;
    this.placeMotoParked();
    this.gas.root.visible = true;
    this.gas.root.position.copy(MOTO_SIDE);
    this.gas.root.rotation.y = -Math.PI / 2;
    this.helmetAt = 'gas';
    this.gasWalk = [new THREE.Vector3(11.5, 0, 11.75), new THREE.Vector3(2.2, 0, 11.6), GATE_OUT.clone()];
    this.gasAtGate = false;
    this.letIn = false;
    this.gateT = 0;
    this.nagged = false;
    this.phase = 'toGate';
    this.busy = false;
    this.phone.visible = false;
    this.setClock(T(21, 9));
  }

  private placeMotoParked() {
    this.moto.root.visible = true;
    this.moto.root.position.copy(MOTO_PARK);
    this.moto.root.rotation.set(0, -Math.PI / 2, 0);
    // (apoyada en la pata de cabra, a su izquierda)
    this.motoLean = -0.11;
    this.moto.root.rotation.z = this.motoLean;
    if (this.moto.rider) this.moto.rider.root.visible = false;
  }

  /** Ella llega a la cancela: le abre y entran (él deja el casco junto al escúter y va a la cocina). */
  private openGate() {
    this.letIn = true;
    bark('Margaux', CENA.letIn);
    this.place.gate.hold(3);
    // (entra por el lado de la cancela que no ocupa la hoja abierta, y pasa junto al escúter)
    this.gasWalk = [new THREE.Vector3(0.45, 0, 9.6), new THREE.Vector3(0.6, 0, 8.5), new THREE.Vector3(-1.7, 0, 7.95), new THREE.Vector3(-1.3, 0, 4.2)];
    this.phase = 'toKitchen';
    this.setClock(T(21, 10));
  }

  private startCook() {
    this.phase = 'cook';
    this.busy = true;
    this.hud.setAction(null);
    this.tries++;
    this.nata = 0;
    this.setClock(Math.max(this.minutes, T(21, 12)));
    // Azul delante del fuego, Gas mirando junto a la encimera
    this.player.root.position.set(STOVE.x + 0.2, 0, STOVE.z - 0.1);
    this.player.root.rotation.y = Math.PI;
    this.walker.stop();
    this.walker.facing = Math.PI;
    // (por el mismo camino de siempre: si aún venía de la cancela, en línea recta cruzaba el escúter)
    this.gasWalk = [new THREE.Vector3(-1.3, 0, 4.2), new THREE.Vector3(STOVE.x - 1.7, 0, STOVE.z + 0.5)];
    if (this.helmetAt === 'gas') this.dropHelmet();
    this.updateHud();
    const run = () => {
      const scores: number[] = [];
      const trap = { label: '🥛 ¿Nata?', onPress: () => this.pressNata() };
      const step = (i: number) => {
        const opts = [
          { title: CENA.steps.guanciale, duration: 3.6, button: '¡Ya! 🥓', zones: [{ to: 0.44, label: 'Crudo', color: '#f3c4b5' }, { to: 0.78, label: 'Crujiente', color: '#e0a052', good: true }, { to: 1, label: 'Quemado', color: '#5a3a2a' }] },
          { title: CENA.steps.pasta, duration: 3.0, button: 'Escurrir ⏱️', zones: [{ to: 0.5, label: 'Dura', color: '#f4e7b8' }, { to: 0.8, label: 'Al dente', color: '#f2d27a', good: true }, { to: 1, label: 'Pasada', color: '#d9cfa8' }] },
          { title: CENA.steps.mix, duration: 2.6, button: 'Mezclar 🥚', zones: [{ to: 0.3, label: 'Revuelto', color: '#f7c94a' }, { to: 0.64, label: 'Cremosa', color: '#fff0b8', good: true }, { to: 1, label: 'Fría', color: '#e8e2d0' }] },
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
            // (lo dice Gas, en su bocadillo: los avisos de texto no se ven en el cómic)
            bark('Gas', i === 0 && z.to === 1 ? CENA.steps.burnt : i === 2 && z.to < 0.5 ? CENA.steps.scrambled : CENA.steps.raw);
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
    bark('Gas', CENA.steps.nata);
  }

  private steamOn(step: number) {
    this.steam.forEach((s, i) => {
      s.visible = true;
      s.position.set(this.pan.position.x + (step === 1 ? -0.55 : 0) + (i - 1.5) * 0.12, 1.15 + i * 0.3, this.pan.position.z);
    });
  }

  private finishCook(scores: number[]) {
    // Cada paso vale hasta 3,4 puntos (≈10 si los tres son perfectos); la nata resta 2
    const raw = scores.reduce((a, q) => a + (q > 0 ? 1.6 + q * 1.8 : 0.6), 0) - this.nata * 2;
    this.grade = Math.max(1, Math.min(10, Math.round(raw)));
    this.steam.forEach((s) => (s.visible = false));
    this.updateHud();
    bark('Gas', CENA.grade(this.grade));
    if (this.grade < 7) {
      audio.boo();
      later(() => this.phase === 'cook' && this.startCook(), 2600);
      return;
    }
    audio.fanfare();
    vibrate([30, 40, 60]);
    this.fx.burst(this.v1.copy(this.player.root.position).setY(2.2), '❤️', 10, 2);
    later(() => {
      if (this.phase !== 'cook') return;
      this.phase = 'toTable';
      this.busy = false;
      this.nagged = false;
      this.gateT = 0;
      this.setClock(T(21, 40));
      // Rodea la mesa por detrás (en línea recta la cruzaba por el medio) y espera de pie junto a su silla
      this.gasWalk = [new THREE.Vector3(0.7, 0, 3.6), new THREE.Vector3(TABLE.x + 1.65, 0, 3.9), new THREE.Vector3(TABLE.x + 1.6, 0, TABLE.z + 1.2)];
    }, 1800);
  }

  /** Ya casi no se ve: la guirnalda de la terraza. */
  private switchGarland(on: boolean) {
    this.garlandOn = on;
    const g = this.place.garland;
    if (g) (g.material as THREE.PointsMaterial).color.setHex(on ? 0xffd38a : GARLAND_OFF);
    audio.knock(0.25, 1200, 0.03);
  }

  private sitDown() {
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    this.walker.stop();
    fadeFlash(() => {
      this.phase = 'dinner';
      this.seatBoth();
      this.setClock(T(21, 50));
      dialogue(CENA.dinner, () => {
        this.setClock(T(22, 45));
        bark('Gas', CENA.lateNow);
        audio.warn();
        later(() => this.phase === 'dinner' && this.startAlarm(), 2200);
      });
    }, 300);
  }

  private seatBoth() {
    this.player.root.position.set(TABLE.x - 0.95, seatedRootY(this.player, 0.48), TABLE.z);
    this.player.root.rotation.y = Math.PI / 2;
    this.gas.root.visible = true;
    this.gas.root.position.set(TABLE.x + 0.95, seatedRootY(this.gas, 0.48), TABLE.z);
    this.gas.root.rotation.y = -Math.PI / 2;
    this.gasWalk = [];
    // La cena servida; las cosas de la mesa, apartadas para los platos (luego habrá que dejarlas como en la foto)
    this.dinnerPlates.visible = true;
    this.decor.show(shuffledLayout(this.photo));
  }

  /**
   * Unos faros en la calle y una sola idea: tus padres. Se quita de en medio lo que os delataría (los platos, la
   * sartén y el casco de Gas) antes de que el coche llegue a la puerta. Luego pasa de largo: era el vecino.
   * (Tus padres no volvieron hasta la 1.30: esto solo es el susto.)
   */
  private startAlarm() {
    this.phase = 'alarm';
    this.busy = true;
    this.alarmT = ALARM_SECS;
    this.tidied = 0;
    // De pie de un salto, cada uno a un lado de la mesa
    this.gas.root.position.set(TABLE.x + 1.5, 0, TABLE.z);
    this.player.root.position.set(TABLE.x - 1.5, 0, TABLE.z);
    this.walker.stop();
    this.walker.facing = this.walker.yaw = Math.PI;
    this.alarmItems = [
      { key: 'plates', at: TABLE.clone(), done: false },
      { key: 'pan', at: STOVE.clone(), done: false },
      { key: 'helmet', at: HELMET_SPOT.clone(), done: false },
    ];
    // El coche que llega por la calle, muy despacio, con los faros encendidos
    this.neighborDrive = null;
    this.neighborParkT = -1;
    this.neighbor.root.visible = true;
    this.neighbor.root.position.set(62, 0, NEIGHBOR_Z);
    this.neighbor.root.rotation.y = -Math.PI / 2;
    for (const l of this.neighborLights) l.visible = true;
    audio.warn();
    vibrate([60, 40, 60]);
    this.updateHud();
    dialogue(CENA.alarm, () => {
      this.busy = false;
      bark('Gas', CENA.alarmHint);
      this.updateHud();
    });
  }

  private endAlarm() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    const late = this.tidied < 3;
    if (late) this.scares++;
    // El coche sigue calle abajo y aparca delante de su casa
    const c = this.neighbor.root.position;
    this.neighborDrive = new Drive([c.clone(), new THREE.Vector3(Math.min(c.x - 6, -12), 0, NEIGHBOR_Z), new THREE.Vector3(-30, 0, 12.6), new THREE.Vector3(-36, 0, 11.75), new THREE.Vector3(-39, 0, 11.55)], 62 / ALARM_SECS, { vmax: 6, brake: 2.5, stop: true });
    this.updateHud();
    dialogue(late ? CENA.falseAlarmLate : CENA.falseAlarm, () => this.startSeeOff());
  }

  private updateAlarm() {
    if (this.busy || this.neighborDrive) return;
    const pp = this.player.root.position;
    for (const it of this.alarmItems) {
      if (it.done) continue;
      const at = it.key === 'helmet' ? this.helmetPos(this.v2) : it.at;
      const reach = it.key === 'plates' ? 2.1 : 1.5;
      if (Math.hypot(pp.x - at.x, pp.z - at.z) < reach) {
        it.done = true;
        if (it.key === 'pan') {
          this.steam.forEach((s) => (s.visible = false));
          this.pan.visible = false;
        } else if (it.key === 'plates') this.dinnerPlates.visible = false;
        else this.setHelmet('hidden');
        this.tidied++;
        bark('Margaux', CENA.alarmItems[it.key]);
        audio.pickup();
        vibrate(25);
        this.updateHud();
      }
    }
    if (this.tidied >= 3 || this.alarmT <= 0) this.endAlarm();
  }

  /** El coche del vecino: con el susto avanza con la cuenta atrás (llega a la cancela al acabarse); luego sigue y aparca. */
  private updateNeighbor(dt: number) {
    if (!this.neighbor.root.visible) return;
    const c = this.neighbor.root;
    let v = 0;
    if (this.neighborDrive) {
      v = this.neighborDrive.step(dt, c);
      if (this.neighborDrive.done) {
        if (this.neighborParkT < 0) this.neighborParkT = 0;
        this.neighborParkT += dt;
        // Apaga el motor y los faros
        if (this.neighborParkT > 2) for (const l of this.neighborLights) l.visible = false;
      }
      this.neighborRig.update(dt, v, this.neighborDrive.yawRate * v, 1.2);
    } else if (this.phase === 'alarm') {
      const before = Math.ceil(this.alarmT);
      if (!this.busy) this.alarmT = Math.max(0, this.alarmT - dt);
      if (Math.ceil(this.alarmT) !== before) this.updateHud();
      const prev = c.position.x;
      c.position.x = 62 * (this.alarmT / ALARM_SECS);
      v = dt > 0 ? Math.abs(prev - c.position.x) / dt : 0;
      this.neighborRig.update(dt, v, 0, 1.2);
    }
  }

  /** Antes de irse, su casco: ella sabe dónde está (en el suelo o donde lo escondió). */
  private startSeeOff() {
    this.phase = 'seeOff';
    this.busy = false;
    this.nagged = false;
    this.gateT = 0;
    this.setClock(T(22, 48));
    this.gas.root.visible = true;
    this.gasWalk = [new THREE.Vector3(TABLE.x + 1.6, 0, TABLE.z + 1.4), new THREE.Vector3(1.0, 0, 8.6)];
    later(() => this.phase === 'seeOff' && this.helmetAt !== 'azul' && bark('Gas', CENA.helmetAsk), 900);
  }

  /** Le da el casco: él sale, se lo pone en la moto y se va. */
  private giveHelmet() {
    this.setHelmet('gas');
    this.phase = 'gasRide';
    this.busy = true;
    this.hud.setAction(null);
    this.input.reset();
    this.walker.stop();
    bark('Margaux', CENA.bye);
    audio.pop();
    this.setClock(T(22, 50));
    this.place.gate.hold(3);
    this.gasWalk = [new THREE.Vector3(0.3, 0, 9.4), GATE_OUT.clone(), new THREE.Vector3(2.2, 0, 11.6), new THREE.Vector3(11.5, 0, 11.75), MOTO_SIDE.clone()];
    this.mountT = -1;
  }

  /** Sube a la moto: arranca ya en marcha, da la vuelta en la calle y se va hacia el pueblo. */
  private updateRide(dt: number) {
    if (this.motoState === 'parked' && !this.gasWalk.length && this.gas.root.visible && this.gas.root.position.distanceTo(MOTO_SIDE) < 0.2) {
      // Se monta: el piloto (con su casco puesto) aparece y el que andaba se va
      this.gas.root.visible = false;
      this.setHelmet('rider');
      if (this.moto.rider) this.moto.rider.root.visible = true;
      this.mountT = 0;
      this.motoState = 'leaving';
      audio.whoosh();
    }
    if (this.motoState !== 'leaving') return;
    this.mountT += dt;
    if (this.mountT < 0.9) return;
    if (!this.motoDrive)
      this.motoDrive = new Drive(
        [MOTO_PARK.clone(), new THREE.Vector3(12.3, 0, 11.2), new THREE.Vector3(11.4, 0, 11.55), new THREE.Vector3(10.6, 0, 12.3), new THREE.Vector3(10.4, 0, 13.6), new THREE.Vector3(11.3, 0, 14.6), new THREE.Vector3(13.2, 0, 15.0), new THREE.Vector3(22, 0, 15.0), new THREE.Vector3(45, 0, 14.9), new THREE.Vector3(95, 0, 14.8)],
        2.5,
        { vmax: 10, slow: [[0, 7.5, 3.2]] },
      );
    if (this.motoState === 'leaving' && this.motoDrive.s > 60 && this.phase === 'gasRide') {
      this.motoState = 'gone';
      this.moto.root.visible = false;
      this.motoDrive = null;
      fadeFlash(() => this.phase === 'gasRide' && this.startTidy(), 500);
    }
  }

  /** Se ha ido: hay que dejar la mesa igual que en la foto que hizo antes de que llegara. */
  private startTidy() {
    this.phase = 'tidy';
    this.busy = true;
    this.gas.root.visible = false;
    this.moto.root.visible = false;
    this.dinnerPlates.visible = false;
    this.player.root.visible = false;
    this.walker.stop();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    this.setClock(T(23, 0));
    this.decor.show(null);
    cinema.play([{ dur: Infinity, pos: new THREE.Vector3(TABLE.x, 2.2, TABLE.z - 1.05), look: new THREE.Vector3(TABLE.x, 0.8, TABLE.z + 0.04), fov: 44 }]);
    dialogue([...CENA.gone, ...SIDE.table.intro], () => {
      this.tableGame = new TableMemory(
        this.scene,
        TABLE,
        0.795,
        () => {
          this.tableGame?.dispose();
          this.tableGame = null;
          this.decor.show(this.photo);
          cinema.stop();
          this.startToBed();
        },
        this.photo,
      );
    });
  }

  /** La mesa ya está: a la cama (por la puerta de casa, que se abre). */
  private startToBed() {
    this.phase = 'toBed';
    this.busy = false;
    this.player.root.visible = true;
    this.player.root.position.set(TABLE.x - 1.5, 0, TABLE.z);
    this.walker.yaw = this.walker.facing = Math.PI;
    this.setClock(T(23, 30));
  }

  private ending() {
    this.phase = 'done';
    this.busy = true;
    this.player.root.visible = false;
    this.gas.root.visible = false;
    this.moto.root.visible = false;
    // Al entrar, ella apaga la guirnalda (la de sus padres)
    if (this.garlandOn) this.switchGarland(false);
    this.setClock(T(23, 39));
    dialogue(CENA.leave, () => {
      phoneChat([CHATS.teQuiero, CHATS.jazzbah], () => {
        const stars = this.scares === 0 && this.tries === 1 && this.grade >= 9 ? 3 : this.scares <= 1 && this.grade >= 8 ? 2 : 1;
        this.onComplete({
          stars,
          stats: [
            ['Nota de Gas', `${this.grade}/10`],
            ['Casi os pillan', `${this.scares}`],
            ['Nata', this.nata ? 'Sí 🙄' : 'Ni una gota'],
          ],
        });
      });
    });
  }

  // ---------------- El casco y lo que se lleva en la mano ----------------

  private setHelmet(at: HelmetAt) {
    this.helmetAt = at;
    // En el suelo o escondido, se puede tropezar con él
    const i = this.colliders.indexOf(this.helmetBox);
    if (i >= 0) this.colliders.splice(i, 1);
    if (at === 'ground' || at === 'hidden') {
      const p = at === 'ground' ? HELMET_SPOT : HIDE_SPOT;
      Object.assign(this.helmetBox, { minX: p.x - 0.18, maxX: p.x + 0.18, minZ: p.z - 0.18, maxZ: p.z + 0.18 });
      this.colliders.push(this.helmetBox);
    }
    this.placeCarried();
  }

  /** Lo deja en el suelo, junto al escúter, al pasar por allí. */
  private dropHelmet() {
    this.setHelmet('ground');
    audio.knock(0.18, 500, 0.05);
  }

  private helmetPos(out: THREE.Vector3) {
    return out.copy(this.helmetAt === 'hidden' ? HIDE_SPOT : this.helmetAt === 'ground' ? HELMET_SPOT : this.helmet.position);
  }

  /** Después de animar los huesos: el casco colgando de la mano (siempre derecho) o apoyado en el suelo. */
  private placeCarried() {
    const h = this.helmet;
    const at = this.helmetAt;
    h.visible = at !== 'rider' && (at !== 'gas' || this.gas.root.visible) && (at !== 'azul' || this.player.root.visible);
    if (at === 'ground' || at === 'hidden') {
      h.position.copy(at === 'ground' ? HELMET_SPOT : HIDE_SPOT).setY(HELMET_Y);
      h.rotation.set(0, at === 'ground' ? 0.8 : 2.1, 0);
    } else if (at === 'gas' || at === 'azul') {
      const p = at === 'gas' ? this.gas : this.player;
      p.handR.getWorldPosition(h.position);
      // (cogido por la mentonera: cuelga un poco por debajo de la mano)
      h.position.y -= 0.16;
      h.rotation.set(0, p.root.rotation.y, 0);
    }
  }

  // ---------------- Bucle ----------------

  /** Ruta de un padre: del jardín a la calle (o al revés) siempre por la cancela, recto por el camino. */
  private route(from: THREE.Vector3, to: THREE.Vector3[]) {
    const wallZ = GATE.z + 0.1;
    const inside = (z: number) => z < wallZ;
    const end = to[to.length - 1];
    const side = Math.sign(to[0].x - GATE.x || from.x - GATE.x) * 0.35;
    const path: THREE.Vector3[] = [];
    if (inside(from.z) !== inside(end.z)) {
      // Primero al eje del camino, luego cruza la cancela y sigue por la calle
      if (inside(from.z)) path.push(new THREE.Vector3(GATE.x + side, 0, Math.min(from.z, GATE.z - 0.9)), new THREE.Vector3(GATE.x + side, 0, GATE.z + 1.2));
      else path.push(new THREE.Vector3(GATE.x + side, 0, Math.max(from.z, GATE.z + 1.2)), new THREE.Vector3(GATE.x + side, 0, GATE.z - 0.9));
    }
    path.push(...to.map((v) => v.clone()));
    return path;
  }

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

  /** Quieto mirando hacia un punto (la gente que espera no saluda: mira). */
  private faceIdle(p: Person, x: number, z: number, dt: number) {
    const want = Math.atan2(x - p.root.position.x, z - p.root.position.z);
    const d = Math.atan2(Math.sin(want - p.root.rotation.y), Math.cos(want - p.root.rotation.y));
    p.root.rotation.y += d * Math.min(1, dt * 5);
    animatePerson(p, dt, 'idle');
  }

  /** Sentados a la mesa: muslos en la silla, pies en el suelo y las manos hacia la mesa; él come a ratos. */
  private sit(p: Person, dt: number) {
    animatePerson(p, dt, 'idle');
    seatPose(p);
    p.armL.rotation.set(-0.5, 0, -0.08);
    p.armR.rotation.set(-0.5, 0, 0.08);
    p.elbowL.rotation.x = p.elbowR.rotation.x = -0.75;
    if (p === this.gas) {
      const eat = Math.max(0, Math.sin(this.t * 1.3));
      p.armR.rotation.x = -0.5 - eat * 0.45;
      p.elbowR.rotation.x = -0.75 - eat * 0.5;
    }
  }

  /** Con el móvil en la mano, escribiéndole (la mano delante, a la altura del pecho). */
  private phonePose(dt: number) {
    animatePerson(this.player, dt, 'idle');
    this.player.armR.rotation.set(-0.45, 0, 0.18);
    this.player.elbowR.rotation.x = -1.25;
  }

  private updateParents(dt: number) {
    if (this.phase === 'wait') {
      this.waitT += dt;
      while (this.beatI < this.beats.length && this.waitT >= this.beats[this.beatI].at) {
        const b = this.beats[this.beatI++];
        // Lo que ella le va escribiendo a Gas, en su bocadillo
        if (b.msg) bark('Margaux', `📱 ${b.msg}`);
        if (b.dad === 'hide') this.dad.root.visible = false;
        else if (b.dad) {
          this.dad.root.visible = true;
          this.dadPath = this.route(this.dad.root.position, b.dad);
        }
        if (b.mom === 'hide') this.mom.root.visible = false;
        else if (b.mom) {
          this.mom.root.visible = true;
          this.momPath = this.route(this.mom.root.position, b.mom);
        }
        if (b.carGo) {
          // Suben al coche y arranca: sale de su sitio y se va calle arriba, hacia el pueblo
          this.carGoing = true;
          this.parentCar.azul.visible = true;
          if (this.parentDriver) this.parentDriver.visible = true;
          this.parentDrive = new Drive(
            [new THREE.Vector3(PARENT_CAR_X, 0, PARK_Z), new THREE.Vector3(-2.5, 0, 14.85), new THREE.Vector3(1.5, 0, 14.45), new THREE.Vector3(10, 0, 14.35), new THREE.Vector3(40, 0, 14.35), new THREE.Vector3(95, 0, 14.35)],
            2.5,
            { vmax: 9 },
          );
          audio.whoosh();
        }
      }
    }
    if (this.dadPath.length && this.dad.root.visible) {
      if (this.moveTo(this.dad, this.dadPath[0], dt, 2.2, this.dadPath.length > 1 ? 0.35 : 0.08)) this.dadPath.shift();
    } else if (this.dad.root.visible) animatePerson(this.dad, dt, 'idle');
    if (this.momPath.length && this.mom.root.visible) {
      if (this.moveTo(this.mom, this.momPath[0], dt, 1.9, this.momPath.length > 1 ? 0.35 : 0.08)) this.momPath.shift();
    } else if (this.mom.root.visible) {
      // Esperando junto al coche, mirando hacia casa (a ver si sale ya)
      if (this.mom.root.position.z > GATE.z + 1) this.faceIdle(this.mom, GATE.x, GATE.z, dt);
      else animatePerson(this.mom, dt, 'idle');
    }
    if (this.parentDrive && this.parentCar.root.visible) {
      const v = this.parentDrive.step(dt, this.parentCar.root);
      this.parentRig.update(dt, v, this.parentDrive.yawRate * v, 1.2);
      if (this.parentDrive.done) this.parentCar.root.visible = false;
    }
  }

  private updateMoto(dt: number) {
    if (!this.moto.root.visible || !this.motoDrive) return;
    const v = this.motoDrive.step(dt, this.moto.root);
    // Se inclina hacia dentro en las curvas y las ruedas giran con lo que avanza
    const lean = THREE.MathUtils.clamp(-this.motoDrive.yawRate * v * 0.07, -0.4, 0.4);
    this.motoLean += (lean - this.motoLean) * Math.min(1, dt * 6);
    this.moto.root.rotation.z = this.motoLean;
    for (const w of this.moto.wheels) w.rotation.x += (v * dt) / 0.33;
    if (this.motoState === 'arriving' && this.motoDrive.done) this.motoParked();
  }

  /** A dónde iría alguien que se ha perdido (solo se enseña a los 40 s sin avanzar). */
  private target(): THREE.Vector3 | null {
    switch (this.phase) {
      case 'toGate':
        return GATE_IN;
      case 'toKitchen':
        return STOVE;
      case 'toTable':
        return this.garlandOn ? TABLE : SWITCH_AT;
      case 'alarm': {
        const pp = this.player.root.position;
        const left = this.alarmItems.filter((i) => !i.done).map((i) => (i.key === 'helmet' ? this.helmetPos(new THREE.Vector3()) : i.at));
        left.sort((a, b) => pp.distanceTo(a) - pp.distanceTo(b));
        return left[0] ?? null;
      }
      case 'seeOff':
        return this.helmetAt === 'azul' ? this.gas.root.position : this.helmetPos(this.v2);
      case 'toBed':
        return DOOR;
      default:
        return null;
    }
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.updateSky(dt);
    this.updateParents(dt);
    this.updateMoto(dt);
    this.updateNeighbor(dt);
    if (this.phase === 'gasRide') this.updateRide(dt);
    // Quien esté cerca de la cancela o de la puerta la abre (y al alejarse se cierra). Gas, esperando fuera, no:
    // le tiene que abrir ella
    this.doorWho.length = 0;
    for (const p of [this.dad, this.mom, this.player]) if (p.root.visible) this.doorWho.push(p.root.position);
    if (this.gas.root.visible && !(this.phase === 'toGate' && !this.letIn)) this.doorWho.push(this.gas.root.position);
    for (const d of this.doors) d.update(dt, this.doorWho, this.camera.position);

    const pp = this.player.root.position;
    // Gas sigue su camino (a la cancela, a la cocina, a la mesa o a la moto); si no, quieto mirándola
    if (this.gas.root.visible && this.phase !== 'dinner') {
      if (this.gasWalk.length) {
        if (this.moveTo(this.gas, this.gasWalk[0], dt, 2.6, this.gasWalk.length > 1 ? 0.45 : 0.08)) this.gasWalk.shift();
        // Al pasar junto al escúter, deja el casco en el suelo
        if (this.helmetAt === 'gas' && this.phase === 'toKitchen' && this.gas.root.position.distanceTo(HELMET_SPOT) < 0.9) this.dropHelmet();
      } else if (this.phase === 'toGate' && !this.letIn) this.faceIdle(this.gas, pp.x, pp.z, dt);
      else if (this.phase === 'gasRide') animatePerson(this.gas, dt, 'idle');
      else this.faceIdle(this.gas, pp.x, pp.z, dt);
    }
    if (this.phase === 'toGate' && !this.gasAtGate && !this.gasWalk.length && this.gas.root.visible) {
      this.gasAtGate = true;
      bark('Gas', CENA.atGate);
    }
    if (this.phase === 'dinner') {
      this.sit(this.player, dt);
      this.sit(this.gas, dt);
    }

    const walking = this.phase === 'toGate' || this.phase === 'toKitchen' || this.phase === 'toTable' || this.phase === 'alarm' || this.phase === 'seeOff' || this.phase === 'toBed';
    const free = !this.busy && walking;
    if (this.phase === 'alarm') this.updateAlarm();
    this.tableGame?.update(this.camera);
    // Mientras hay susto, corre: el coche no espera
    this.walker.speed = this.phase === 'alarm' ? 4.5 : 4.0;
    this.walker.turn(this.input.consumeCam());
    if (free) {
      const move = this.walker.move(dt, this.input.axes(), this.colliders, GARDEN, this.gas.root.visible ? [{ x: this.gas.root.position.x, z: this.gas.root.position.z, r: 0.35 }] : []);
      this.player.root.rotation.y = this.walker.facing;
      animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    } else if (this.phase === 'cook') {
      // Remueve la sartén mientras charlan
      animatePerson(this.player, dt, 'talk');
      this.player.armR.rotation.x = -1.1 + Math.sin(this.t * 7) * 0.25;
    } else if (this.phase === 'wait' || this.phase === 'gasComing' || this.phase === 'intro') {
      this.player.root.rotation.y = Math.atan2(GATE.x - pp.x, STREET_Z - pp.z);
      this.phonePose(dt);
    } else if (this.phase === 'gasRide') {
      // Le mira irse desde la cancela
      const m = this.moto.root.visible ? this.moto.root.position : this.gas.root.position;
      this.faceIdle(this.player, m.x, m.z, dt);
    } else if (this.phase !== 'dinner' && this.player.root.visible) animatePerson(this.player, dt, 'idle');

    // Vapor de la olla y la sartén: sube, crece y se deshace
    this.steam.forEach((s, i) => {
      if (!s.visible) return;
      s.position.y += dt * 0.55;
      if (s.position.y > 2.5) s.position.y = 1.15 + i * 0.04;
      const k = THREE.MathUtils.clamp((s.position.y - 1.15) / 1.35, 0, 1);
      s.scale.setScalar(0.22 + k * 0.32);
      (s.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - k * k);
    });
    if (this.phase === 'cook') this.pan.rotation.y = Math.sin(this.t * 6) * 0.06;

    // Pasos que se cumplen al llegar
    if (free && this.phase === 'toGate' && this.gasAtGate && !this.letIn && Math.hypot(pp.x - GATE_IN.x, pp.z - GATE_IN.z) < 1.3) this.openGate();
    if (this.phase === 'toGate' && this.gasAtGate && !this.letIn && !this.busy) {
      this.gateT += dt;
      if (this.gateT > 14 && !this.nagged) {
        this.nagged = true;
        bark('Gas', CENA.atGateWait);
      }
    }
    if (free && this.phase === 'toTable' && !this.garlandOn) {
      this.gateT += dt;
      // Si va a la mesa con todo a oscuras (o tarda), Gas lo dice
      if (!this.nagged && (Math.hypot(pp.x - TABLE.x, pp.z - TABLE.z) < 2.4 || this.gateT > 16)) {
        this.nagged = true;
        bark('Gas', CENA.lightsHint);
      }
    }
    if (free && this.phase === 'seeOff' && this.helmetAt !== 'azul' && !this.gasWalk.length) {
      this.gateT += dt;
      if (this.gateT > 15 && !this.nagged) {
        this.nagged = true;
        bark('Gas', CENA.helmetNag);
      }
    }
    if (free && this.phase === 'toBed' && Math.hypot(pp.x - DOOR.x, pp.z - DOOR.z) < 0.75) {
      this.busy = true;
      this.walker.stop();
      fadeFlash(() => this.phase === 'toBed' && this.ending(), 500);
    }

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    if (this.phase === 'wait') {
      label = '📱 «Ven»';
      action = () => this.sayCome();
    } else if (free && this.phase === 'toKitchen' && pp.distanceTo(STOVE) < 1.6) {
      label = '🍳 Cocinar';
      action = () => this.startCook();
    } else if (free && this.phase === 'toTable' && !this.garlandOn && pp.distanceTo(SWITCH_AT) < 1.1) {
      label = '💡 Luz';
      action = () => {
        this.switchGarland(true);
        later(() => this.phase === 'toTable' && bark('Gas', CENA.lightsOn), 500);
      };
    } else if (free && this.phase === 'toTable' && this.garlandOn && pp.distanceTo(TABLE) < 2.1) {
      label = '🍝 Cenar';
      action = () => this.sitDown();
    } else if (free && this.phase === 'seeOff' && this.helmetAt !== 'azul' && pp.distanceTo(this.helmetPos(this.v2)) < 1.4) {
      label = '🪖 Coger';
      action = () => {
        this.setHelmet('azul');
        audio.pop();
      };
    } else if (free && this.phase === 'seeOff' && this.helmetAt === 'azul' && !this.gasWalk.length && pp.distanceTo(this.gas.root.position) < 1.7) {
      label = '🪖 Dárselo';
      action = () => this.giveHelmet();
    }
    this.hud.setAction(label, !!label && this.phase !== 'wait');
    if (this.input.consumeAction() && action && (!this.busy || this.phase === 'wait')) action();
    if (this.phase === 'wait' && this.busy) this.hud.setAction(null);

    // Pistas, solo si se ha perdido: la flecha, la columna de luz y el marcador salen a los 40 s sin avanzar
    const key = `${this.phase}|${this.garlandOn}|${this.tidied}|${this.helmetAt}|${this.gasAtGate}`;
    const tgt = this.lost.tick(key, dt, this.busy || !walking) ? this.target() : null;
    this.marker.visible = !!tgt && free;
    if (tgt && free) {
      this.marker.position.set(tgt.x, 2.5 + Math.sin(this.t * 3) * 0.15, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 2 ? null : -rel);
      beacon.at(pp.distanceTo(tgt) < 2 ? null : tgt);
    } else {
      this.hud.setArrow(null);
      beacon.at(null);
    }

    // Cámara
    // Dentro del patio, por debajo del toldo y de la buganvilla: a más altura la cámara se metía entre las flores
    if (walking) this.walker.camera(this.camera, dt, this.colliders, 6, pp.z < 10.4 && Math.abs(pp.x) < 5.4 ? 2.3 : 3.4);
    else {
      const m = this.moto.root.position;
      const [pos, look] =
        this.phase === 'cook'
          ? // Por delante de la encimera, bajo el toldo y sin la buganvilla del porche en primer plano
            [this.v1.set(STOVE.x + 1.9, 2.35, STOVE.z + 3.5), this.v2.set(STOVE.x + 0.1, 1.05, STOVE.z - 0.6)]
          : this.phase === 'dinner'
            ? // Entre los dos pies de la pérgola, que quedan a los lados y no delante de ellos
              [this.v1.set(TABLE.x + 0.5, 2.15, TABLE.z + 3.7), this.v2.set(TABLE.x, 0.9, TABLE.z)]
            : this.phase === 'gasComing'
              ? // Desde el jardín, calle arriba: la moto que llega y aparca más adelante
                [this.v1.set(-1.0, 4.6, 6.2), this.v2.set(Math.max(3, Math.min(m.x, 30)), 0.8, 12.2)]
              : this.phase === 'gasRide'
                ? // Desde la cancela, Gas que sale, se monta y se va
                  [this.v1.set(-0.8, 3.0, 7.6), this.motoState === 'parked' && this.gas.root.visible ? this.v2.copy(this.gas.root.position).setY(1.0) : this.v2.set(Math.max(2, Math.min(m.x, 30)), 0.9, m.z)]
                : this.phase === 'done'
                  ? // La casa, con la ventana de arriba encendida: ya está en la cama
                    [this.v1.set(2.5, 2.2, 9.2), this.v2.set(-0.5, 3.6, 0)]
                  : this.phase === 'intro'
                    ? [this.v1.set(-7, 5.5, 19), this.v2.set(0, 2, 2)]
                    : // Vigilando: la cancela y el coche de los padres, en la calle
                      [this.v1.set(-1.2, 6.2, 4.6), this.v2.set(-3, 0.6, 14)];
      this.camera.position.lerp(pos, Math.min(1, dt * 2.5));
      this.camLook.lerp(look, Math.min(1, dt * 3));
      this.camera.lookAt(this.camLook);
    }
    this.sky.update(this.camera, dt);
  }

  /** Dónde habla Gas cuando va en la moto (el piloto lleva su casco): para que el bocadillo salga de él. */
  speakerPoint(who: string) {
    if (who !== 'Gas' && who !== 'Marc') return null;
    const r = this.moto.rider;
    if (!r || !this.moto.root.visible || !r.root.visible || this.gas.root.visible) return null;
    const bone = r.rig?.bones.get('Head') ?? r.head;
    const at = bone.getWorldPosition(new THREE.Vector3());
    at.y += 0.42; // (por encima del casco)
    return at;
  }

  // ---------------- Modo prueba ----------------

  /**
   * Deja el mundo como al principio de una fase: lo de antes ya hecho (los padres idos, la moto aparcada, el casco
   * en el suelo, la carbonara hecha…), sin minijuegos ni escenas a medias.
   */
  private prep(phase: Phase) {
    const order: Phase[] = ['intro', 'wait', 'gasComing', 'toGate', 'toKitchen', 'cook', 'toTable', 'dinner', 'alarm', 'seeOff', 'gasRide', 'tidy', 'toBed', 'done'];
    const after = (p: Phase) => order.indexOf(phase) > order.indexOf(p);
    this.cancelGauge?.();
    this.cancelGauge = null;
    this.tableGame?.dispose();
    this.tableGame = null;
    cinema.stop();
    this.input.reset();
    this.walker.stop();
    this.busy = false;
    this.lost.reset();
    this.phase = phase;
    // Los padres y su coche
    if (after('wait')) {
      this.dad.root.visible = this.mom.root.visible = false;
      this.dadPath = [];
      this.momPath = [];
      this.carGoing = true;
      this.parentDrive = null;
      this.parentCar.root.visible = false;
    } else this.stageParents();
    // La moto
    this.motoDrive = null;
    this.mountT = -1;
    if (after('gasComing') && !after('gasRide')) {
      this.motoState = 'parked';
      this.placeMotoParked();
    } else {
      this.motoState = after('gasRide') ? 'gone' : 'away';
      this.moto.root.visible = false;
    }
    // El vecino
    this.neighborDrive = null;
    this.neighborParkT = -1;
    this.neighbor.root.visible = false;
    // Las personas
    this.player.root.visible = true;
    this.player.root.position.set(WATCH.x, 0, WATCH.z);
    this.player.root.rotation.set(0, 0, 0);
    this.walker.yaw = this.walker.facing = 0;
    this.phone.visible = phase === 'intro' || phase === 'wait' || phase === 'gasComing';
    this.gas.root.visible = after('gasComing') && !after('gasRide');
    this.gas.root.position.set(-1.3, 0, 4.2);
    this.gas.root.rotation.set(0, Math.PI, 0);
    this.gasWalk = [];
    this.gasAtGate = after('toGate');
    this.letIn = after('toGate');
    this.gateT = 0;
    this.nagged = false;
    // Las cosas
    this.setHelmet(!after('toGate') ? (phase === 'toGate' ? 'gas' : 'rider') : 'ground');
    this.pan.visible = true;
    this.steam.forEach((s) => (s.visible = false));
    this.dinnerPlates.visible = false;
    this.decor.show(this.photo);
    this.switchGarland(after('toTable'));
    this.tidied = 0;
    this.alarmItems = [];
    if (after('cook') && !this.grade) this.grade = 10;
    if (after('cook') && !this.tries) this.tries = 1;
    this.hud.setAction(null);
    this.setClock(
      ({ intro: T(21, 5), wait: T(21, 5), gasComing: T(21, 8), toGate: T(21, 9), toKitchen: T(21, 10), cook: T(21, 12), toTable: T(21, 40), dinner: T(21, 50), alarm: T(22, 45), seeOff: T(22, 48), gasRide: T(22, 50), tidy: T(23, 0), toBed: T(23, 30), done: T(23, 39) } as Record<Phase, number>)[phase],
      true,
    );
  }

  debug(): DebugItem[] {
    return [
      { label: '1 · Vigilar a los padres', run: () => { this.prep('intro'); this.startWait(); } },
      {
        label: '2 · Gas llega en moto',
        run: () => {
          this.prep('gasComing');
          this.busy = true;
          this.motoArrives();
        },
      },
      {
        label: '3 · Abrirle la cancela',
        run: () => {
          this.prep('toGate');
          this.gas.root.position.copy(GATE_OUT);
          this.gasAtGate = true;
          this.letIn = false;
          this.player.root.position.set(-1.5, 0, 6.5);
        },
      },
      {
        label: '4 · A la cocina',
        run: () => {
          this.prep('toKitchen');
          this.player.root.position.set(0.2, 0, 8.6);
          this.walker.yaw = this.walker.facing = Math.PI;
        },
      },
      { label: '5 · Cocinar', run: () => { this.prep('toKitchen'); this.startCook(); } },
      {
        label: '6 · La guirnalda y a cenar',
        run: () => {
          this.prep('toTable');
          this.switchGarland(false);
          this.player.root.position.set(STOVE.x + 0.4, 0, STOVE.z + 0.4);
          this.gas.root.position.set(TABLE.x + 1.6, 0, TABLE.z + 1.2);
        },
      },
      { label: '7 · Cenar', run: () => { this.prep('toTable'); this.switchGarland(true); this.sitDown(); } },
      { label: '8 · Los faros (el susto)', run: () => { this.prep('dinner'); this.seatBoth(); this.startAlarm(); } },
      {
        label: '9 · El casco de Gas',
        run: () => {
          this.prep('seeOff');
          this.setHelmet('hidden');
          this.player.root.position.set(TABLE.x - 1.5, 0, TABLE.z);
          this.gas.root.position.set(TABLE.x + 1.5, 0, TABLE.z);
          this.startSeeOff();
        },
      },
      {
        label: '10 · Se va en moto',
        run: () => {
          this.prep('seeOff');
          this.player.root.position.copy(GATE_IN);
          this.gas.root.position.set(1.0, 0, 8.6);
          this.setHelmet('azul');
          this.giveHelmet();
        },
      },
      { label: '11 · La mesa como en la foto', run: () => { this.prep('tidy'); this.startTidy(); } },
      { label: '12 · A dormir', run: () => { this.prep('toBed'); this.startToBed(); } },
      { label: '✓ Completar capítulo', run: () => { this.prep('done'); this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.cancelGauge?.();
    this.tableGame?.dispose();
    rigPost.delete(this.post);
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}

/** Un paso del guion de los padres: hacia dónde va cada uno (por qué puntos) y qué pasa al llegar. */
interface Beat {
  at: number;
  dad?: THREE.Vector3[] | 'hide';
  mom?: THREE.Vector3[] | 'hide';
  msg?: string;
  carGo?: boolean;
}

/**
 * Lo que hay delante de casa de Azul: un vallecito que baja de la calle a una entrada de mar muy estrecha
 * con una playa pequeñísima al fondo. Casas, solo en la otra orilla.
 */
function buildValley(sc: THREE.Scene, day: boolean) {
  const X = 380, Z = 170; // de z = 16.7 hacia allá
  const Z0 = 16.7;
  const WATER = -7;
  const ss = THREE.MathUtils.smoothstep;
  const n = (x: number, z: number) => Math.sin(x * 0.13 + z * 0.07) * 0.6 + Math.sin(x * 0.37 - z * 0.23) * 0.3 + Math.sin(x * 0.9 + z * 0.8) * 0.12;
  const H = (x: number, z: number) => {
    const bank = -9.5 * ss(z, Z0 + 1.5, Z0 + 21) + 13.5 * ss(z, Z0 + 37, Z0 + 57); // baja, el fondo del agua y sube a la otra orilla
    const up = ss(z, Z0 + 57, Z0 + 150) * 4;
    // Al este, la entrada se acaba: el fondo sube y deja la playita
    const head = ss(x, 18, 46);
    const y = bank + up;
    const closed = Math.max(y, -5.2 - 0.0 * x + Math.abs(z - (Z0 + 28)) * 0.12);
    const land = THREE.MathUtils.lerp(y, closed, head) + n(x, z) * ss(z, Z0 + 1, Z0 + 6) * (y < WATER + 0.6 ? 0.2 : 1);
    return THREE.MathUtils.lerp(land, -13, ss(-x, 86, 104)); // pasada la punta del faro, mar abierto
  };
  const geo = new THREE.PlaneGeometry(X, Z, 150, 140).rotateX(-Math.PI / 2);
  geo.translate(0, 0, Z0 + Z / 2);
  const P = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(P.count * 3);
  const c = new THREE.Color();
  const SCRUB = new THREE.Color(0x6e7f46), SCRUB2 = new THREE.Color(0x56703c), ROCK = new THREE.Color(0xb7a27c), SAND = new THREE.Color(0xecdcb0), DEEP = new THREE.Color(0x2c6f7e);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    const y = H(x, z);
    P.setY(i, y);
    const v = 0.5 + 0.5 * Math.sin(x * 0.31 + z * 0.47) * Math.sin(x * 0.11 - z * 0.19);
    c.copy(SCRUB).lerp(SCRUB2, v);
    const shore = y - WATER;
    if (shore < 2.4) c.lerp(ROCK, ss(2.4 - shore + n(x * 3, z * 3) * 0.5, 0, 1.6));
    if (shore < 1.5 && x > 10 && x < 44) c.lerp(SAND, ss(1.5 - shore, 0, 0.7)); // la playita
    if (shore < -0.4) c.copy(DEEP);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // Cada triángulo con su material, según por dónde pasa
  const terr = geo.toNonIndexed();
  const TP = terr.attributes.position as THREE.BufferAttribute;
  const surf = new Float32Array(TP.count);
  for (let i = 0; i < TP.count; i += 3) {
    const y = (TP.getY(i) + TP.getY(i + 1) + TP.getY(i + 2)) / 3 - WATER;
    const x = TP.getX(i);
    const v = y < 1.3 && x > 10 && x < 44 ? Surf.Sand : y < 1.5 ? Surf.Stone : Surf.Grass;
    surf.fill(v, i, i + 3);
  }
  terr.setAttribute('surf', new THREE.BufferAttribute(surf, 1));
  const ground = new THREE.Mesh(terr, toon({ vertexColors: true, roughness: 1 }));
  ground.userData.noCast = true;
  sc.add(ground);
  // El agua de la cala y, al fondo de la calle, detrás del faro, el mar: la misma agua abierta hacia el oeste
  const pieces: [number, number, number, number][] = [[-X / 2, X / 2, Z0 - 3, Z0 + 59], [-520, -190, -46, 320], [-190, -86, -46, Z0 - 3], [-190, -86, Z0 + 59, 320]];
  if (day) {
    const waterMat = toon({ color: 0x2a93ad, emissive: 0x06303c, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.93 });
    for (const [x0, x1, z0, z1] of pieces) {
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), waterMat);
      w2.position.set((x0 + x1) / 2, WATER, (z0 + z1) / 2);
      w2.userData.noCast = true;
      sc.add(w2);
    }
  } else
    // De noche, el agua de tebeo del mar de Sa Farola (bandas planas y trazos blancos a saltos), con el mismo color:
    // la de toon era un plano liso azul oscuro
    for (const [x0, x1, z0, z1] of pieces) {
      const w2 = makeSea([x1 - x0, z1 - z0], 0x0a1630, new THREE.Vector3(-0.3, 0.4, -1), { night: true, emissive: 0x050a1c });
      w2.position.set((x0 + x1) / 2, WATER, (z0 + z1) / 2);
      sc.add(w2);
    }

  const m = new Merger();
  // El muro de marès de la calle, y lo que crece en la ladera
  if (day) m.add(G.box, 0xc9b48f, 53, 0.3, Z0 + 0.15, 0, 0, 0, 274, 0.6, 0.35);
  // (de noche, en tramos de 27 m: de una pieza de 274 m no se partía y quedaba a regla, sin el «a mano alzada»)
  else for (let i = 0; i < 10; i++) m.add(G.box, 0xc9b48f, 53 - 137 + 13.7 + i * 27.4, 0.3, Z0 + 0.15, 0, 0, 0, 27.4, 0.6, 0.35);
  // La punta: acantilado de marès donde se acaba la tierra, y las rocas que separan el mar de fuera
  for (let i = 0; i < 26; i++) {
    const z = -48 + i * 2.95;
    m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xb09a78 : 0x9a8466, -87 + Math.sin(i * 1.9) * 0.8, -3.6, z, Math.sin(i) * 0.3, i, 0, 7, 8.5, 5);
  }
  for (let i = 0; i < 34; i++) m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xb09a78 : 0x9a8466, -92 - i * 5, -3.6, -47 + Math.sin(i * 2.1), 0, i, 0, 7.5, 7.6, 6);
  let k = 0;
  for (let i = 0; i < 420 && k < 110; i++) {
    const x = -170 + ((i * 37.3) % 340), z = Z0 + 2.5 + ((i * 11.7) % 110);
    const y = H(x, z);
    if (y < WATER + 1.4 || x < -84) continue;
    k++;
    if (i % 9 === 0) {
      // Pino
      const h = 6 + (i % 4);
      m.add(G.cyl, 0x5a4634, x, y + h / 2, z, 0.05, 0, 0.05, 0.4, h, 0.4);
      for (let j = 0; j < 4; j++) m.add(G.bush, j % 2 ? 0x2f5a2c : 0x3a6a34, x + Math.cos(j * 1.7) * 1.7, y + h + Math.sin(j) * 0.4, z + Math.sin(j * 1.7) * 1.7, 0, j, 0, 3, 1.4, 2.8);
    } else m.add(G.bush, i % 3 ? 0x5f7a40 : 0x7d8a52, x, y + 0.45, z, 0, i, 0, 1.4 + (i % 4) * 0.5, 1 + (i % 3) * 0.3, 1.3 + (i % 3) * 0.5);
  }
  // Rocas de la orilla
  for (let i = 0; i < 60; i++) {
    const x = -84 + i * 1.7 + Math.sin(i) * 2;
    if (x > 16) break;
    for (const zz of [Z0 + 14 + Math.sin(i * 2.3) * 1.4, Z0 + 12.2 + Math.sin(i * 1.3) * 1.2, Z0 + 43 + Math.sin(i * 1.7) * 1.4, Z0 + 45 + Math.sin(i * 2.9) * 1.2])
      m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xb09a78 : 0x9a8466, x, WATER + 0.25, zz, 0, i, 0, 2.2 + (i % 3), 1 + (i % 2) * 0.5, 2 + (i % 3));
  }
  // Barcas fondeadas
  for (const [x, z, ry, cc] of [[-40, Z0 + 26, 0.4, 0xf4f4f0], [-14, Z0 + 31, -0.3, 0x2f6b8a], [-78, Z0 + 28, 1.1, 0xf4f4f0], [2, Z0 + 25, 0.9, 0xc23030]] as [number, number, number, number][]) {
    m.add(G.capsule, cc, x, WATER + 0.12, z, Math.PI / 2, ry, 0, 1.1, 1.7, 0.55);
    m.add(G.box, 0x8a6a44, x, WATER + 0.34, z, 0, ry, 0, 0.8, 0.05, 1.5);
  }
  // Solo en la otra orilla, casas blancas mirando al agua
  const WIN = day ? 0x30384a : 0xffd9a0;
  const ROOF = [0xb8623e, 0xc0653d, 0xf6f1e6];
  let s = 0;
  for (let x = -84; x < 170; x += 11.5, s++) {
    const z = Z0 + 66 + (s % 3) * 8 + Math.sin(s * 1.3) * 2;
    const y = H(x, z);
    const h = s % 2 ? 6 : 3.4;
    const w = 7 + (s % 3), d = 6;
    m.add(G.box, 0xf6f1e6, x, y + h / 2 - 0.4, z, 0, 0, 0, w, h + 0.8, d);
    if (s % 3 === 2) m.add(G.box, 0xf6f1e6, x, y + h + 0.2, z, 0, 0, 0, w + 0.2, 0.4, d + 0.2);
    else m.add(ROOF_GEO, ROOF[s % 2], x, y + h, z, 0, 0, 0, w + 0.4, 1.3, d + 0.4);
    for (const ox of [-w / 4, w / 4])
      for (const fy of h > 4 ? [1.5, 4.1] : [1.5]) {
        m.add(G.box, WIN, x + ox, y + fy, z - d / 2 - 0.03, 0, 0, 0, 0.9, 1.1, 0.05);
        for (const os of [-1, 1]) m.add(G.box, 0x2f7a4a, x + ox + os * 0.68, y + fy, z - d / 2 - 0.05, 0, 0, 0, 0.44, 1.15, 0.05);
      }
  }
  const mesh = m.mesh();
  mesh.userData.noCam = true;
  sc.add(mesh);
  // Unas sombrillas en la playita (solo de día: de noche ya no queda nadie en la playa)
  if (!day) return;
  const beach = new Merger();
  for (const [x, z, cc] of [[30, Z0 + 24.5, 0xd7263d], [34, Z0 + 31, 0x2b6fb0]] as [number, number, number][]) {
    const y = H(x, z);
    beach.add(G.cyl, 0xdddddd, x, y + 0.9, z, 0, 0, 0, 0.05, 1.9, 0.05);
    beach.add(G.cone, cc, x, y + 1.95, z, 0, 0, 0, 1.9, 0.5, 1.9);
  }
  sc.add(beach.mesh());
}

/**
 * Casa de los padres de Azul junto a Sa Farola: jardín con cancela, cocina de fuera, terraza y la calle.
 * La usan la cena a escondidas y el día del eclipse.
 */
export function buildAzulHouse(sc: THREE.Scene, colliders: Box2[], day = false) {
  const steam: THREE.Sprite[] = [];
  const m = new Merger();
  // Lo nuevo del cómic va solo de noche (los caps. 6 y 7): de día, el cap. 8 ve la casa como siempre.
  // Tubos y cables de 1 a 4 cm, algo más gruesos: la tinta los hacía parpadear
  const fat = (v: number) => (day || v >= 0.045 ? v : v + 0.02);
  // La mesa (con sus sillas) y la cocina de fuera, en su propia malla sin doblar: lo que se pone encima (platos,
  // sartén, la vela, el frutero) no se descoloca con el «a mano alzada» y los que se sientan quedan en su silla
  const tm = day ? m : new Merger();
  const km = day ? m : new Merger();
  const WHITE = 0xf6f1e6;
  const SHUTTER = 0x2f7a4a; // persianas verdes menorquinas
  // Como en la foto de Street View: casa blanca de dos plantas con azotea, el cuerpo del primer piso
  // en esquina con ventanales y persianas beis, toldo verde, persianas verdes abajo, porche con la cocina
  // de fuera, escalera blanca a la derecha, pérgola cubierta de buganvilla, limonero, cancela de
  // madera de acebuche entre pilares blancos y un seto de adelfas tras el muro.
  const SAND = 0xd9cfbd; // losas claras del patio
  m.add(G.box, SAND, 0, -0.05, 5, 0, 0, 0, 10.4, 0.1, 10.4);
  m.add(G.box, 0xb5b0a6, -8, -0.06, STREET_Z, 0, 0, 0, 156, 0.1, 6.4); // calle de hormigón claro, hasta el faro
  m.add(G.box, 0x6f7a48, 0, -0.08, -16, 0, 0, 0, 140, 0.1, 52); // tierra y jardines entre la calle y el paseo
  // Planta baja
  m.add(G.box, WHITE, 0, 1.55, -4, 0, 0, 0, 10, 3.1, 8);
  m.add(G.box, 0xe9e4d8, 0, 3.15, -3.92, 0, 0, 0, 10.2, 0.14, 8.24); // forjado
  // Primer piso más estrecho, con el cuerpo en esquina que vuela sobre el toldo
  m.add(G.box, WHITE, 1.4, 4.6, -4.6, 0, 0, 0, 7.2, 2.9, 6.8);
  m.add(G.box, WHITE, -1.6, 4.65, -0.4, 0, 0, 0, 4.6, 2.6, 2.2); // cuerpo saliente
  m.add(G.box, 0xe9e4d8, -1.6, 3.32, -0.4, 0, 0, 0, 4.7, 0.18, 2.3);
  // Ventanales con persianas enrollables beis a media altura y barandilla de acero
  for (const [x, z, w, ry] of [[-2.4, 0.72, 1.9, 0], [-0.4, 0.72, 1.6, 0], [-3.92, -0.4, 1.4, Math.PI / 2]] as [number, number, number, number][]) {
    m.add(G.box, 0x2a3138, x, 4.4, z, 0, ry, 0, w, 1.7, 0.05);
    m.add(G.box, 0xcbb894, x - (ry ? 0.02 : 0), 4.85, z + (ry ? 0 : 0.02), 0, ry, 0, w - 0.1, 0.85, 0.05);
    for (let k = 0; k < 6; k++) m.add(G.box, 0xb8a37e, x - (ry ? 0.03 : 0), 4.5 + k * 0.14, z + (ry ? 0 : 0.03), 0, ry, 0, w - 0.1, 0.02, 0.05);
  }
  m.add(G.box, 0xc8ccd0, -1.6, 4.25, 0.95, 0, 0, 0, 4.7, fat(0.05), fat(0.05));
  m.add(G.box, 0xc8ccd0, -1.6, 3.95, 0.95, 0, 0, 0, 4.7, fat(0.04), fat(0.04));
  for (let k = 0; k <= 10; k++) m.add(G.box, 0xc8ccd0, -3.9 + k * 0.46, 3.85, 0.95, 0, 0, 0, fat(0.03), 0.8, fat(0.03));
  // Ventana pequeña del primer piso a la derecha
  m.add(G.box, 0x2a3138, 3.2, 4.4, -1.18, 0, 0, 0, 1.0, 1.2, 0.05);
  for (const sx of [-1, 1]) m.add(G.box, SHUTTER, 3.2 + sx * 0.75, 4.4, -1.15, 0, 0, 0, 0.5, 1.25, 0.05);
  // Azotea: pretil, barandilla tubular y la antena
  m.add(G.box, WHITE, 0.9, 6.2, -3.6, 0, 0, 0, 8.4, 0.3, 8.6);
  for (let k = 0; k <= 14; k++) m.add(G.box, 0xc8ccd0, -3.3 + k * 0.6, 6.75, 0.62, 0, 0, 0, fat(0.04), 0.8, fat(0.04));
  m.add(G.box, 0xc8ccd0, 0.9, 7.15, 0.62, 0, 0, 0, 8.4, 0.05, 0.05);
  m.add(G.box, 0xc8ccd0, 4.8, 7.15, -3.6, 0, 0, 0, 0.05, 0.05, 8.4);
  m.add(G.box, 0x9a9ea2, 3.6, 7.6, -2.2, 0, 0, 0, 0.05, 2.4, 0.05);
  for (let k = 0; k < 5; k++) m.add(G.box, 0x9a9ea2, 3.6, 8.2 + k * 0.08, -2.2 - k * 0.1, 0, 0, 0, 0.9 - k * 0.12, fat(0.02), fat(0.02));
  m.add(G.box, 0xf2f2f0, -3.8, 7.0, -6.5, 0, 0, 0, 0.7, 1.2, 0.7); // chimenea
  colliders.push({ minX: -5, maxX: 5, minZ: -8, maxZ: 0 });
  // Planta baja: persianas verdes de lamas (porticones), puerta del porche y escalera blanca
  for (const x of [-4.1, -2.9]) {
    m.add(G.box, SHUTTER, x, 1.2, 0.06, 0, 0, 0, 1.15, 2.4, 0.08);
    for (let k = 0; k < 14; k++) m.add(G.box, 0x24603a, x, 0.2 + k * 0.155, 0.11, 0, 0, 0, 1.05, 0.03, 0.03);
  }
  m.add(G.box, 0xe9e4d8, 0, 2.18, 0.08, 0, 0, 0, 1.2, 0.1, 0.12);
  m.add(G.box, 0xd84a3a, 0.9, 2.35, 0.08, 0, 0, 0, 0.28, 0.28, 0.03); // la placa roja con la cruz de Malta
  // Escalera exterior: peldaños de barro sobre obra blanca, subiendo hacia la derecha
  for (let k = 0; k < 10; k++) {
    const sx = 1.9 + k * 0.3;
    m.add(G.box, WHITE, sx, (k + 1) * 0.15, 0.55, 0, 0, 0, 0.3, (k + 1) * 0.3, 1.0);
    m.add(G.box, 0xb5603b, sx, (k + 1) * 0.3 + 0.02, 0.55, 0, 0, 0, 0.32, 0.04, 1.02);
  }
  m.add(G.box, WHITE, 4.85, 1.6, 0.55, 0, 0, 0, 0.3, 3.2, 1.0);
  colliders.push({ minX: 1.7, maxX: 5, minZ: 0, maxZ: 1.1 });
  // Toldo verde sobre armazón metálico, a la izquierda
  m.add(G.box, 0x2c6a48, -3.0, 3.0, 1.6, -0.32, 0, 0, 4.2, 0.05, 3.3);
  m.add(G.box, 0x2c6a48, -3.0, 2.48, 3.2, 0, 0, 0, 4.2, 0.28, 0.03);
  for (const x of [-5.0, -1.0]) {
    m.add(G.box, 0x2c6a48, x, 2.0, 3.2, 0, 0, 0, 0.05, 4.0, 0.05);
    colliders.push({ minX: x - 0.06, maxX: x + 0.06, minZ: 3.14, maxZ: 3.26 });
  }
  const lit = new Merger();
  // Lo que se ve por la puerta abierta: la luz de dentro (de día, la penumbra de la casa)
  lit.add(G.box, day ? 0x4a4036 : 0xffcf8a, 0, 1.05, 0.012, 0, 0, 0, 1.0, 2.1, 0.02);
  for (const [x, z, w] of [[-2.4, 0.76, 1.8], [-0.4, 0.76, 1.5]] as [number, number, number][]) lit.add(G.box, 0xffd9a0, x, 4.15, z, 0, 0, 0, w, 0.5, 0.02);
  sc.add(new THREE.Mesh(lit.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  // Pérgola de hierro verde cubierta de buganvilla, del porche hasta la valla de la derecha
  for (const [x, z] of [[1.6, 6.4], [4.8, 6.4], [4.8, 9.7]] as [number, number][]) {
    m.add(G.box, 0x2c5a40, x, 1.35, z, 0, 0, 0, 0.1, 2.7, 0.1);
    colliders.push({ minX: x - 0.12, maxX: x + 0.12, minZ: z - 0.12, maxZ: z + 0.12 });
  }
  m.add(G.box, 0x2c5a40, 3.2, 2.7, 6.4, 0, 0, 0, 3.3, 0.08, 0.08);
  m.add(G.box, 0x2c5a40, 4.8, 2.7, 3.2, 0, 0, 0, 0.08, 0.08, 13);
  for (let i = 0; i < 190; i++) {
    // Sobre el porche (pegada a la fachada) y por encima de la pérgola de la derecha, siempre alta
    // para no tapar la cámara al cocinar ni al cenar. Muchas matas pequeñas: de cerca, flores y hojas, no bolas
    const onPergola = i % 3 !== 0;
    const x = onPergola ? 1.6 + ((i * 0.37) % 1) * 3.4 : -0.6 + ((i * 0.53) % 1) * 2.2;
    const z = onPergola ? 0.9 + ((i * 0.61) % 1) * 5.6 : 0.5 + ((i * 0.29) % 1) * 0.6;
    const y = onPergola ? 2.92 + Math.sin(i * 3.1) * 0.13 : 2.2 + ((i * 0.71) % 1) * 1.0;
    const c = i % 4 === 0 ? 0x3a6a32 : i % 2 ? 0xc72a5c : 0xdb4a78;
    m.add(G.bush, c, x, y, z, 0, i, 0, 0.3 + (i % 3) * 0.09, 0.2 + (i % 2) * 0.05, 0.28 + (i % 2) * 0.12);
  }
  // Trepando por los postes de la pérgola: pegada a ellos, de abajo arriba
  for (const [px, pz] of [[1.6, 6.4], [4.8, 6.4], [4.8, 9.7]] as [number, number][])
    for (let i = 0; i < 12; i++) m.add(G.bush, i % 3 === 0 ? 0x3a6a32 : i % 2 ? 0xc72a5c : 0xdb4a78, px + Math.cos(i * 2.4) * 0.09, 0.5 + i * 0.2, pz + Math.sin(i * 2.4) * 0.09, 0, i, 0, 0.26, 0.26, 0.26);
  // Limonero y ficus a la izquierda del patio, contenedor verde, moto blanca y una maceta de barro
  const tree = (x: number, z: number, h: number, c: number, fruit?: number) => {
    m.add(G.cyl, 0x6b5a46, x, h * 0.3, z, 0.05, 0, 0.04, 0.18, h * 0.6, 0.18);
    for (let k = 0; k < 5; k++) m.add(G.bush, c, x + Math.cos(k * 1.3) * 0.7, h * 0.72 + Math.sin(k * 2.1) * 0.4, z + Math.sin(k * 1.3) * 0.7, 0, k, 0, 1.6, 1.3, 1.5);
    if (fruit) for (let k = 0; k < 10; k++) m.add(G.sphere, fruit, x + Math.cos(k * 2.4) * 1.1, h * 0.62 + Math.sin(k * 1.7) * 0.6, z + Math.sin(k * 2.4) * 1.1, 0, 0, 0, 0.13, 0.15, 0.13);
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  };
  tree(-4.3, 5.6, 3.6, 0x4f8a3a, 0xe8d24a);
  m.add(G.bush, 0x3f7a34, -4.5, 0.6, 8.4, 0, 0, 0, 1.1, 1.1, 1.0); // arbusto junto al muro
  m.add(G.rbox, 0x2f6b3a, -3.2, 0.55, 8.9, 0, 0.1, 0, 0.6, 1.1, 0.7); // contenedor
  colliders.push({ minX: -5.05, maxX: -2.85, minZ: 8.5, maxZ: 10.2 }, { minX: -5.05, maxX: -4, minZ: 7.95, maxZ: 8.6 });
  m.add(G.cyl, 0x222222, -3.45, 0.12, 9.2, 0, 0, Math.PI / 2, 0.24, 0.06, 0.24);
  m.add(G.cyl, 0x222222, -2.95, 0.12, 9.2, 0, 0, Math.PI / 2, 0.24, 0.06, 0.24);
  // Escúter blanco con baúl: ruedas con buje, plataforma, escudo, guardabarros, trasera redonda, asiento y manillar
  const SC = -2.7, W_ = 0xf4f4f2;
  for (const z of [6.12, 7.28]) {
    m.add(G.cyl, 0x1e1e22, SC, 0.19, z, 0, 0, Math.PI / 2, 0.38, 0.1, 0.38);
    m.add(G.cyl, 0xc8ccd0, SC, 0.19, z, 0, 0, Math.PI / 2, 0.18, 0.11, 0.18);
  }
  m.add(G.rbox, W_, SC, 0.3, 6.66, 0, 0, 0, 0.34, 0.07, 0.72); // plataforma
  m.add(G.rbox, W_, SC, 0.66, 6.3, -0.22, 0, 0, 0.42, 0.74, 0.07); // escudo
  m.add(G.sphere, W_, SC, 0.32, 6.12, 0, 0, 0, 0.2, 0.2, 0.46); // guardabarros
  m.add(G.ball, W_, SC, 0.52, 7.08, 0, 0, 0, 0.44, 0.56, 0.86); // trasera
  m.add(G.box, 0xc23030, SC, 0.58, 7.5, 0, 0, 0, 0.16, 0.05, 0.02); // piloto
  m.add(G.rbox, 0x2a2a2e, SC, 0.82, 6.98, 0, 0, 0, 0.3, 0.09, 0.62); // asiento
  m.add(G.cyl, 0x8d9096, SC, 1.0, 6.2, -0.22, 0, 0, 0.05, 0.24, 0.05); // dirección
  m.add(G.cyl, 0x2a2a2e, SC, 1.12, 6.18, 0, 0, Math.PI / 2, 0.035, 0.58, 0.035); // manillar
  m.add(G.ball, 0xfff3b0, SC, 1.1, 6.1, 0, 0, 0, 0.12, 0.12, 0.1); // faro
  for (const s2 of [-1, 1]) {
    m.add(G.cyl, 0x8d9096, SC + s2 * 0.2, 1.2, 6.2, 0, 0, s2 * -0.3, fat(0.012), 0.18, fat(0.012)); // retrovisor
    m.add(G.cyl, 0x2a2a2e, SC + s2 * 0.23, 1.29, 6.2, Math.PI / 2, 0, 0, 0.09, 0.015, 0.09);
  }
  m.add(G.rbox, 0x2a2a2e, SC, 1.06, 7.4, 0, 0, 0, 0.38, 0.28, 0.34); // baúl
  colliders.push({ minX: -3.0, maxX: -2.4, minZ: 5.7, maxZ: 7.7 });
  m.add(G.cyl, 0xb5603b, 1.3, 0.25, 2.4, 0, 0, 0, 0.45, 0.5, 0.45);
  m.add(G.bush, 0x4f8a3a, 1.3, 0.75, 2.4, 0, 0, 0, 0.6, 0.6, 0.6);
  colliders.push({ minX: 1.02, maxX: 1.58, minZ: 2.12, maxZ: 2.68, round: true });
  // Muro bajo encalado con pilares gordos, la cancela de acebuche (abierta a ratos) y adelfas detrás
  for (const [x0, x1] of [[-5.2, -1.0], [1.0, 5.2]]) {
    m.add(G.box, WHITE, (x0 + x1) / 2, 0.5, 10.3, 0, 0, 0, x1 - x0, 1.0, 0.3);
    colliders.push({ minX: x0, maxX: x1, minZ: 10.1, maxZ: 10.5, low: true });
  }
  for (const x of [-1.1, 1.1]) {
    m.add(G.box, WHITE, x, 0.7, 10.3, 0, 0, 0, 0.6, 1.4, 0.6);
    m.add(G.box, 0xefeae0, x, 1.45, 10.3, 0, 0, 0, 0.72, 0.1, 0.72);
  }
  m.add(G.box, 0xd9cfa6, 2.2, 0.75, 10.47, 0, 0, 0, 0.5, 0.3, 0.03); // placa con el nombre de la casa
  m.add(G.box, 0x7a6a56, 1.6, 0.5, 10.48, 0, 0, 0, 0.04, 0.4, 0.04); // tirador
  // Cancela de madera de acebuche (travesaños algo torcidos): se abre hacia el jardín cuando llega
  // alguien y se cierra cuando ha pasado
  const gate = new Door({ hinge: new THREE.Vector3(-0.8, 0, 10.3), ry: 0, width: 1.6, swing: 1.6, reach: 1.7, speed: 0.55 });
  {
    const gm = new Merger();
    for (let k = 0; k < 6; k++) gm.add(G.box, 0x8a7a66, 0.8, 0.18 + k * 0.2, 0, 0, 0, Math.sin(k * 1.9) * 0.08, 1.56, 0.09, 0.07);
    gm.add(G.box, 0x7a6a56, 0.08, 0.65, 0, 0, 0, 0, 0.1, 1.3, 0.09);
    gm.add(G.box, 0x7a6a56, 1.52, 0.65, 0, 0, 0, 0, 0.1, 1.3, 0.09);
    gm.add(G.box, 0x7a6a56, 0.8, 0.65, 0, 0, 0, 0.62, 0.08, 1.75, 0.08);
    gate.leaf.add(gm.mesh());
  }
  sc.add(gate.group);
  // Puerta de la casa: acristalada con marco oscuro, se abre hacia fuera (a su izquierda)
  const door = new Door({ hinge: new THREE.Vector3(-0.5, 0, 0.07), ry: 0, width: 1.0, swing: -1.75, reach: 1.4, speed: 0.5 });
  {
    const dm = new Merger();
    for (const [x, y, w, h] of [[0.04, 1.05, 0.08, 2.1], [0.96, 1.05, 0.08, 2.1], [0.5, 2.06, 1.0, 0.08], [0.5, 0.06, 1.0, 0.12], [0.5, 1.0, 1.0, 0.06]] as const) dm.add(G.box, 0x1e1e22, x, y, 0, 0, 0, 0, w, h, 0.05);
    dm.add(G.box, 0xc8ccd0, 0.86, 1.0, 0.04, 0, 0, 0, 0.03, 0.18, 0.03); // manilla
    door.leaf.add(dm.mesh());
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.9, 0.015), new THREE.MeshStandardMaterial({ color: 0x3a4652, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.45 }));
    glass.position.set(0.5, 1.07, 0);
    door.leaf.add(glass);
  }
  sc.add(door.group);
  for (let i = 0; i < 12; i++) m.add(G.bush, i % 4 ? 0x3d6e34 : 0x4a7d3e, 1.6 + i * 0.3, 1.35 + Math.sin(i) * 0.1, 9.9, 0, i, 0, 0.7, 0.9, 0.6);
  for (const sx of [-5.2, 5.2]) {
    m.add(G.box, WHITE, sx, 0.75, 5.1, 0, 0, 0, 0.3, 1.5, 10.4);
    colliders.push({ minX: sx - 0.2, maxX: sx + 0.2, minZ: 0, maxZ: 10.5, low: true });
  }
  // Cocina de fuera: encimera, fogón, bombona de butano (guiño a «Gas») y estantería
  km.add(G.box, 0xe9e2d2, STOVE.x, 0.45, STOVE.z - 1.0, 0, 0, 0, 2.6, 0.9, 0.8);
  km.add(G.box, 0x7a6a58, STOVE.x, 0.92, STOVE.z - 1.0, 0, 0, 0, 2.7, 0.06, 0.85);
  km.add(G.box, 0x2a2a2e, STOVE.x + 0.3, 0.97, STOVE.z - 1.0, 0, 0, 0, 0.8, 0.04, 0.6);
  km.add(G.cyl, 0xe0662a, STOVE.x + 1.6, 0.35, STOVE.z - 1.1, 0, 0, 0, 0.42, 0.7, 0.42); // butano naranja
  km.add(G.cyl, 0x444444, STOVE.x + 1.6, 0.76, STOVE.z - 1.1, 0, 0, 0, 0.12, 0.12, 0.12);
  km.add(G.box, 0x8a6a44, STOVE.x, 1.9, STOVE.z - 1.35, 0, 0, 0, 2.4, 0.06, 0.35);
  for (let i = 0; i < 4; i++) km.add(G.cyl, [0xd8b04a, 0x2f6b3a, 0xc23030, 0xf4efe2][i], STOVE.x - 0.9 + i * 0.6, 2.08, STOVE.z - 1.35, 0, 0, 0, 0.18, 0.3, 0.18);
  colliders.push({ minX: STOVE.x - 1.4, maxX: STOVE.x + 1.9, minZ: STOVE.z - 1.5, maxZ: STOVE.z - 0.6, low: true });
  // Sartén y olla sobre el fuego
  const pan = new THREE.Group();
  const pm = new Merger();
  pm.add(G.cyl, 0x2b2b2b, 0, 0, 0, 0, 0, 0, 0.5, 0.06, 0.5);
  pm.add(G.box, 0x2b2b2b, 0.42, 0.02, 0, 0, 0, 0, 0.4, 0.04, 0.06);
  // (de noche, la olla apoyada en la encimera: antes flotaba 6 cm)
  pm.add(G.cyl, 0x9a9aa0, -0.55, day ? 0.15 : 0.09, 0.05, 0, 0, 0, 0.45, 0.32, 0.45); // olla de la pasta
  pan.add(pm.mesh());
  pan.position.set(STOVE.x + 0.2, 1.02, STOVE.z - 1.0);
  sc.add(pan);
  // El vapor: nubecillas de tebeo (blancas, con su contorno de tinta), cada una con su material para que se
  // desvanezca a su ritmo al subir (antes, un halo borroso)
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTexture(), color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    s.scale.setScalar(0.4);
    s.visible = false;
    sc.add(s);
    steam.push(s);
  }
  // Mesa de la terraza con mantel, dos sillas y guirnalda de luces
  tm.add(G.cyl, 0xf4efe2, TABLE.x, 0.76, TABLE.z, 0, 0, 0, 1.3, 0.05, 1.3);
  tm.add(G.cyl, 0x5aa9e6, TABLE.x, 0.79, TABLE.z, 0, 0, 0, 1.0, 0.01, 1.0);
  tm.add(G.cyl, 0x777777, TABLE.x, 0.38, TABLE.z, 0, 0, 0, 0.08, 0.76, 0.08);
  // Dos sillas de madera de verdad (asiento a 48 cm, patas y respaldo hacia fuera): antes eran bloques
  // macizos de 90 cm y se sentaban encima, a la altura de la mesa
  for (const sx of [-1, 1]) {
    const cx = TABLE.x + sx * 0.95;
    tm.add(G.box, 0x8a6a44, cx, 0.46, TABLE.z, 0, 0, 0, 0.44, 0.04, 0.42);
    for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) tm.add(G.box, 0x6e5234, cx + dx, 0.23, TABLE.z + dz, 0, 0, 0, fat(0.035), 0.46, fat(0.035));
    for (const dz of [-0.18, 0.18]) tm.add(G.box, 0x6e5234, cx + sx * 0.2, 0.72, TABLE.z + dz, 0, 0, 0, fat(0.035), 0.55, fat(0.035));
    tm.add(G.box, 0x8a6a44, cx + sx * 0.2, 0.88, TABLE.z, 0, 0, 0, 0.035, 0.2, 0.4);
  }
  // Los platos de siempre (de noche, aparte y apoyados en el mantel: antes flotaban un centímetro)
  let tablePlates: THREE.Mesh | null = null;
  if (day) for (const sx of [-1, 1]) m.add(G.cyl, 0xf4efe2, TABLE.x + sx * 0.3, 0.82, TABLE.z, 0, 0, 0, 0.32, 0.03, 0.32); // platos
  else {
    const pl = new Merger();
    for (const sx of [-1, 1]) pl.add(G.cyl, 0xf4efe2, TABLE.x + sx * 0.3, 0.81, TABLE.z, 0, 0, 0, 0.32, 0.03, 0.32);
    tablePlates = pl.mesh();
    tablePlates.userData.comicBent = true;
    sc.add(tablePlates);
  }
  colliders.push({ minX: TABLE.x - 1.3, maxX: TABLE.x + 1.3, minZ: TABLE.z - 0.7, maxZ: TABLE.z + 0.7 });
  for (const [x, z] of [[-4.6, 9.6], [4.6, 9.6], [4.6, 0.8]] as [number, number][]) m.add(G.cyl, 0x8a6a44, x, 1.4, z, 0, 0, 0, 0.1, 2.8, 0.1);
  const bulbs = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  let garland: THREE.Points | null = null;
  if (day)
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      const b = new THREE.Sprite(bulbs);
      b.position.set(4.6, 2.75 - Math.sin(k * Math.PI) * 0.4, 0.8 + k * 8.8);
      b.scale.setScalar(0.35);
      sc.add(b);
    }
  else {
    // De noche, bombillas de tebeo (un círculo con su aro de tinta), como la guirnalda del cap. 2: con el brillo de
    // farola cada una era un halo. Se encienden y se apagan cambiando su color (garland)
    const lp: number[] = [];
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      lp.push(4.6, 2.75 - Math.sin(k * Math.PI) * 0.4, 0.8 + k * 8.8);
    }
    const gm = new THREE.PointsMaterial({ map: comicBulbTexture(), color: GARLAND_ON, size: 0.2, alphaTest: 0.5 });
    gm.userData.comicGlow = true;
    garland = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), gm);
    sc.add(garland);
  }
  // Calle: a la izquierda la casa vecina con tejado de teja y chimenea, a la derecha pinos y la
  // araucaria; postes de madera con el cable y alguna farola
  m.add(G.box, 0xf1eadc, -11.5, 2.4, -2, 0, 0, 0, 10.6, 4.8, 12);
  m.add(ROOF_GEO, 0xb8623e, -11.5, 4.8, -2, 0, Math.PI / 2, 0, 12.2, 1.4, 11);
  m.add(G.box, 0xf2f2f0, -8.6, 6.0, -3, 0, 0, 0, 0.7, 2.0, 0.7);
  m.add(ROOF_GEO, 0xb8623e, -8.6, 7.0, -3, 0, 0, 0, 0.9, 0.4, 0.9);
  for (const [x, y] of [[-14, 1.5], [-9, 1.5], [-14, 3.6], [-9, 3.6]] as [number, number][]) {
    m.add(G.box, 0x2a3138, x, y, 4.02, 0, 0, 0, 1.0, 1.2, 0.05);
    for (const s2 of [-1, 1]) m.add(G.box, SHUTTER, x + s2 * 0.75, y, 4.06, 0, 0, 0, 0.5, 1.25, 0.05);
  }
  m.add(G.box, 0xf6f1e6, -11.5, 0.6, 10.3, 0, 0, 0, 10.6, 1.2, 0.3);
  colliders.push({ minX: -16.8, maxX: -6.2, minZ: -8, maxZ: 4 });
  // Derecha: muro de piedra seca, pinos y la araucaria
  m.add(G.box, 0xbfae92, 11.5, 0.7, 10.3, 0, 0, 0, 10.6, 1.4, 0.6);
  m.add(G.box, 0xf6f1e6, 11.5, 2.2, -2, 0, 0, 0, 9, 4.4, 10);
  m.add(G.box, 0xf6f1e6, 11.5, 4.6, -2, 0, 0, 0, 9.2, 0.4, 10.2);
  colliders.push({ minX: 6.2, maxX: 16.8, minZ: -8, maxZ: 10.6 });
  const pine = (x: number, z: number, h: number) => {
    m.add(G.cyl, 0x6b4a32, x, h / 2, z, 0.08, 0, 0.06, 0.45, h, 0.45);
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, round: true });
    for (let k = 0; k < 6; k++) m.add(G.bush, k % 2 ? 0x2f5a2c : 0x3a6a34, x + Math.cos(k) * 2.2, h + Math.sin(k * 2) * 0.6, z + Math.sin(k) * 2.2, 0, k, 0, 3.4, 1.6, 3.0);
  };
  pine(10, 6, 9);
  pine(15, 2, 10);
  pine(-20, -4, 9);
  // Araucaria (pino de Norfolk): tronco recto y pisos de ramas horizontales
  araucaria(m, 8.4, 0, -7, 14, 3.6);
  // La calle tiene sus muros de pared seca hasta el faro: de aquí no se sale a los descampados de detrás
  const dryWall = (x0: number, x1: number) => {
    m.add(G.box, 0xbfae92, (x0 + x1) / 2, 0.55, 10.35, 0, 0, 0, x1 - x0, 1.1, 0.45);
    m.add(G.box, 0xd9cfbd, (x0 + x1) / 2, 1.13, 10.35, 0, 0, 0, x1 - x0, 0.06, 0.5);
    for (let x = x0 + 9; x < x1 - 1; x += 9) {
      m.add(G.box, WHITE, x, 0.7, 10.35, 0, 0, 0, 0.55, 1.4, 0.55);
      m.add(G.box, 0xefeae0, x, 1.45, 10.35, 0, 0, 0, 0.66, 0.1, 0.66);
    }
    colliders.push({ minX: x0, maxX: x1, minZ: 10.1, maxZ: 10.6, low: true });
  };
  dryWall(-75.5, -16.8);
  dryWall(16.8, 60);
  // Los callejones de un metro a los dos lados de la casa de Azul
  for (const [x0, x1] of [[-6.2, -5.2], [5.2, 6.2]]) {
    m.add(G.box, WHITE, (x0 + x1) / 2, 0.55, 10.3, 0, 0, 0, x1 - x0, 1.1, 0.3);
    colliders.push({ minX: x0, maxX: x1, minZ: 10.1, maxZ: 10.5, low: true });
  }
  // Y en la boca de la calle que baja al mar, una cancela (la de Sa Farola es privada)
  for (const x of [-22.8, -21.6, -20.4, -19.2, -18]) m.add(G.box, 0x2b2f36, x, 1.5, 10.35, 0, 0, 0, 0.05, 0.75, 0.05);
  m.add(G.box, 0x2b2f36, -20.4, 1.86, 10.35, 0, 0, 0, 6.2, 0.05, 0.05);
  // Postes de madera con el cable
  for (const x of [-16, 7, 30]) {
    m.add(G.cyl, 0x8a7a60, x, 4.5, STREET_Z - 3.0, 0, 0, 0, 0.24, 9, 0.24);
    colliders.push({ minX: x - 0.14, maxX: x + 0.14, minZ: STREET_Z - 3.14, maxZ: STREET_Z - 2.86, round: true });
    m.add(G.box, 0x6a5a48, x, 8.6, STREET_Z - 3.0, 0, 0, 0, 0.1, 0.1, 1.0);
  }
  m.add(G.box, 0x1e1e22, 7, 8.5, STREET_Z - 3.0, 0, 0, 0, 46, fat(0.03), fat(0.03));
  m.add(G.box, 0x1e1e22, 2.2, 7.4, 2.0, -0.28, -0.35, 0, fat(0.03), fat(0.03), 13); // el cable que baja a la casa
  const streetLamps: THREE.Sprite[] = [];
  for (const x of [-26, 20]) {
    m.add(G.cyl, 0x333338, x, 2, STREET_Z - 3.2, 0, 0, 0, 0.12, 4, 0.12);
    colliders.push({ minX: x - 0.08, maxX: x + 0.08, minZ: STREET_Z - 3.28, maxZ: STREET_Z - 3.12, round: true });
    // (de noche, su propio material: el cómic lo pasa a luz de tebeo y el capítulo la enciende al ponerse el sol)
    const l = new THREE.Sprite(day ? bulbs : new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    l.position.set(x, 4.1, STREET_Z - 3.2);
    l.scale.setScalar(1.2);
    sc.add(l);
    streetLamps.push(l);
  }
  // De noche, las lámparas de la casa que se ven encendidas (solo su halo: no alumbran nada): un aplique a cada lado
  // de la puerta (el de la izquierda, bajo el toldo, da a la cocina de fuera); y el interruptor de la guirnalda
  const wallLamps: THREE.Sprite[] = [];
  if (!day) {
    for (const [x, y] of [[-1.6, 2.15], [1.4, 2.15]] as [number, number][]) {
      m.add(G.box, 0x2b2f36, x, y, 0.03, 0, 0, 0, 0.14, 0.2, 0.06);
      m.add(G.sphere, 0xfff3b0, x, y - 0.02, 0.12, 0, 0, 0, 0.16, 0.2, 0.16);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      h.position.set(x, y - 0.02, 0.24);
      h.scale.setScalar(0.6);
      sc.add(h);
      wallLamps.push(h);
    }
    m.add(G.box, 0xf2f2ee, SWITCH.x, 1.15, 0.02, 0, 0, 0, 0.09, 0.13, 0.03);
    m.add(G.box, 0xd8d8d2, SWITCH.x, 1.15, 0.04, 0, 0, 0, 0.03, 0.05, 0.02);
  }
  sc.add(m.mesh());
  if (!day) {
    for (const mm of [tm, km]) {
      const mesh = mm.mesh();
      mesh.userData.comicBent = true;
      sc.add(mesh);
    }
  }
  // Delante de casa, al otro lado de la calle: el valle con su calita
  buildValley(sc, day);
  // Al fondo, bajando por la calle, el paseo y Sa Farola con su haz girando
  const farola = buildSaFarola(sc, colliders, day);
  // Alrededores: la urbanización sigue tierra adentro y a los lados, y al fondo lomas; hacia el norte, el mar
  buildSurroundings(sc, {
    keepOut: [
      { minX: -400, maxX: 400, minZ: 10, maxZ: 400 }, // la calle y, delante, el valle: ahí no hay casas
      { minX: -18, maxX: 19, minZ: -10, maxZ: 17 }, // casa de Azul y vecinos
      { minX: -25, maxX: -15, minZ: -45, maxZ: 17 }, // calle que baja al mar
      { minX: -200, maxX: 200, minZ: -60, maxZ: -23 }, // Camí de sa Farola, casas de detrás y faro
      { minX: -38, maxX: -2, minZ: -38, maxZ: 0 }, // chalets de la calle que baja
    ],
    half: 110,
    center: { x: 0, z: 0 },
    night: !day,
    seed: 23,
    colliders,
    water: (x, z) => z < COAST_Z + 2 || x < -84,
    hole: { minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: COAST_Z + 1 },
    fieldMaxZ: 16.8,
    fieldMinX: -86,
  });
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  lamp.position.copy(farola.lamp);
  lamp.scale.setScalar(5);
  lamp.visible = !day;
  sc.add(lamp);
  // De noche, el faro solo se ve encendido: la linterna con su luz de tebeo, que destella cuando la óptica que gira
  // apunta hacia quien mira (lo hace el capítulo). Sin el haz de luz en el aire: las lámparas no iluminan nada
  if (!day) {
    const beam = new THREE.Group();
    beam.visible = false;
    beam.position.copy(farola.lamp);
    sc.add(beam);
    return { pan, steam, beam, bulbs, walkers: farola.walkers, gate, door, tablePlates, garland, streetLamps, wallLamps, lighthouse: lamp };
  }
  // El haz: fuerte junto a la linterna y se va deshaciendo (antes, un cono macizo gris colgado del cielo)
  const beamFade = canvasTex((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#6a6a6a');
    g.addColorStop(0.7, '#141414');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, 8, 128);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 46, 20, 1, true).translate(0, -23, 0).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: beamFade, color: 0xfff1b0, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
  );
  beam.visible = !day;
  beam.position.copy(farola.lamp);
  sc.add(beam);
  return { pan, steam, beam, bulbs, walkers: farola.walkers, gate, door, tablePlates, garland, streetLamps, wallLamps, lighthouse: lamp };
}

/** Color de las bombillas de la guirnalda encendidas y apagadas. */
const GARLAND_ON = 0xffd38a;
export const GARLAND_OFF = 0x6a6458;
/** El interruptor de la guirnalda, en la fachada junto a la puerta. */
const SWITCH = new THREE.Vector3(-1.4, 0, 0.02);

let steamTex: THREE.CanvasTexture | null = null;
/** Nubecilla de vapor de tebeo: tres bolas blancas con un solo contorno de tinta alrededor. */
function steamTexture() {
  if (steamTex) return steamTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const balls: [number, number, number][] = [[44, 74, 26], [74, 62, 30], [88, 86, 20]];
  g.fillStyle = 'rgba(43,34,51,0.85)';
  for (const [x, y, r] of balls) {
    g.beginPath();
    g.arc(x, y, r + 4, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f6f8fc';
  for (const [x, y, r] of balls) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  steamTex = new THREE.CanvasTexture(cv);
  steamTex.colorSpace = THREE.SRGBColorSpace;
  return steamTex;
}
