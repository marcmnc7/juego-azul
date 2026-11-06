import * as THREE from 'three';
import { canvasTex } from './deco';
import { Surf } from '../core/surfaces';
import { steerTo, type SteerState } from '../core/steer';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker } from '../core/walker';
import { Sky, Sun, toon, glowTexture, vibrate } from '../core/gfx';
import { CENA } from '../data/story';
import { makeHelmet } from '../entities/helmet';
import { TableMemory } from './sideGames';
import { cinema } from '../core/cinema';
import { SIDE } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { araucaria, CarRig, G, Merger, makePerson, makeCar, makeMoto, animatePerson, seatedRootY, seatPose, Person, PersonLook } from '../entities/models';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { buildSaFarola, COAST_Z } from './saFarola';
import { buildSurroundings } from './surround';
import { hud, dialogue, toast, timingGauge, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { radar } from '../ui/minis';
import { ROOF_GEO, type Box2 } from './ferreries';
import type { Level, LevelDone } from './level';
import { disposeScene } from './level';
import { beacon } from '../core/beacon';
import { Door } from './door';

// Capítulo 6 · La cena a escondidas (13 de julio de 2026), en casa de los padres de Azul, junto a Sa Farola.
// Es el espejo de la piscinita: aquella noche se coló Azul en casa de los padres de Gas; ahora se cuela él.
// Bucle: vigilar a los padres y decirle «Ven» solo cuando se hayan ido → Gas llega en 30 segundos →
// cocinar la carbonara en la cocina de fuera (guanciale, pasta y crema, sin nata) → Gas pone nota →
// cenar en la terraza → 22:50, Gas se va en su moto → 23:39, el WhatsApp real de esa noche.

type Phase = 'intro' | 'wait' | 'gasComing' | 'toKitchen' | 'cook' | 'toTable' | 'dinner' | 'alarm' | 'leaving' | 'tidy' | 'done';

export const STREET_Z = 13.5;
export const GATE = new THREE.Vector3(0, 0, 10.2);
export const DOOR = new THREE.Vector3(0, 0, 0.4);
const STOVE = new THREE.Vector3(-3.1, 0, 2.3);
const TABLE = new THREE.Vector3(2.6, 0, 5.2);
const WATCH = new THREE.Vector3(-2.2, 0, 9.3);
const PARENT_CAR_X = -4.5;
const GAS_CAR_X = 24;
const GARDEN: Box2 = { minX: -5, maxX: 5, minZ: 0.6, maxZ: 9.7 };
/** Cuánto tardan los faros en pasar por delante de casa. */
const ALARM_SECS = 12;

export const DAD_LOOK: PersonLook = { skin: 0xf0c8a8, shirt: 0x2c3e66, pants: 0xcbb994, hair: 0xb8b8b8, hairStyle: 'short', beard: true };
export const MOM_LOOK: PersonLook = { skin: 0xf2cdb0, shirt: 0xf4efe2, pants: 0x9a4d5e, hair: 0x7a5232, hairStyle: 'straight', skirt: true };

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
  private parentCar = makeCar(0x8c8f94, { luggage: false, joy: false, driver: DAD_LOOK });
  private gasCar = makeMoto(0x1b1d22, MARC_LOOK);
  private beam!: THREE.Mesh;
  private pan!: THREE.Group;
  private steam: THREE.Sprite[] = [];
  private busy = true;
  private t = 0;
  private waitT = 0;
  private beats: Beat[] = [];
  private beatI = 0;
  // Camino de cada uno: puntos por los que pasa (por la puerta del jardín, nunca a través del muro)
  private dadPath: THREE.Vector3[] = [];
  private momPath: THREE.Vector3[] = [];
  private carGoing = false;
  private carSpeed = 0;
  private gasCarT = -1;
  /** La cancela y la puerta de casa: se abren para quien llega y se cierran detrás. */
  private doors: Door[] = [];
  private doorWho: THREE.Vector3[] = [];
  private gasWalk: THREE.Vector3[] = [];
  private tableGame: TableMemory | null = null;
  private alarmT = 0;
  private alarmItems: { key: 'plates' | 'pan' | 'helmet'; at: THREE.Vector3; obj: THREE.Object3D; ring: THREE.Mesh }[] = [];
  private neighbor: ReturnType<typeof makeCar> | null = null;
  private neighborRig: CarRig | null = null;
  private tidied = 0;
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

    const place = buildAzulHouse(sc, this.colliders);
    this.doors = [place.gate, place.door];
    this.pan = place.pan;
    this.steam = place.steam;
    this.beam = place.beam;
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

  // ---------------- Construcción ----------------

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
    this.hud.setCounters(`<span class="chip">${clock}</span>${this.scares ? `<span class="chip">😱 ${this.scares}</span>` : ''}${this.grade ? `<span class="chip">🍝 ${this.grade}/10</span>` : ''}`);
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
      { at: 8.7, dad: DOOR.clone().setZ(-0.9) }, // entra en casa (por la puerta, que se abre)
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
    // (por el mismo camino de siempre: si aún venía de la cancela, en línea recta cruzaba la moto)
    this.gasWalk = [new THREE.Vector3(-1.3, 0, 4.2), new THREE.Vector3(STOVE.x - 1.7, 0, STOVE.z + 0.5)];
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
      // Rodea la mesa por detrás (en línea recta la cruzaba por el medio)
      this.gasWalk = [new THREE.Vector3(0.7, 0, 3.6), new THREE.Vector3(TABLE.x + 1.65, 0, 3.9), new THREE.Vector3(TABLE.x + 1.6, 0, TABLE.z + 1.2)];
      this.updateHud();
    }, 1800);
  }

  private sitDown() {
    this.phase = 'dinner';
    this.busy = true;
    this.hud.setAction(null);
    this.player.root.position.set(TABLE.x - 0.95, seatedRootY(this.player, 0.48), TABLE.z);
    this.player.root.rotation.y = Math.PI / 2;
    this.gas.root.position.set(TABLE.x + 0.95, seatedRootY(this.gas, 0.48), TABLE.z);
    this.gas.root.rotation.y = -Math.PI / 2;
    this.gasWalk = [];
    this.minutes = 21 * 60 + 50;
    this.updateHud();
    dialogue(CENA.dinner, () => {
      this.minutes = 22 * 60 + 50;
      this.updateHud();
      toast('🕙 22:50');
      audio.warn();
      later(() => this.startAlarm(), 1200);
    });
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
    // De pie, cada uno a un lado de la mesa
    this.gas.root.position.set(TABLE.x + 1.5, 0, TABLE.z);
    this.player.root.position.set(TABLE.x - 1.5, 0, TABLE.z);
    this.walker.stop();
    this.walker.facing = this.walker.yaw = Math.PI;
    const sc = this.scene;
    // Los platos, en la mesa
    const plates = new Merger(false);
    for (const dx of [-0.34, 0.34]) {
      plates.add(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 20), 0xfbf7ee, dx, 0, 0);
      plates.add(new THREE.CylinderGeometry(0.09, 0.09, 0.016, 16), 0xe8c978, dx, 0.014, 0);
      plates.add(G.box, 0xc8ccd0, dx + 0.17, 0, 0.02, 0, 0, 0, 0.012, 0.006, 0.17);
    }
    const pm = plates.mesh();
    pm.position.set(TABLE.x, 0.8, TABLE.z);
    sc.add(pm);
    // El casco de Gas, encima de un murete del patio
    const helmet = makeHelmet({ color: 0xb02a2a, stripe: 0xf2f2ee });
    helmet.position.set(-3.6, 0.72, 7.9);
    helmet.rotation.set(0.1, 0.8, 0);
    sc.add(helmet);
    const ringGeo = new THREE.RingGeometry(0.42, 0.56, 28).rotateX(-Math.PI / 2);
    const ring = (x: number, z: number) => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(x, 0.04, z);
      m.userData.noCast = true;
      sc.add(m);
      return m;
    };
    this.alarmItems = [
      { key: 'plates', at: TABLE.clone(), obj: pm, ring: ring(TABLE.x, TABLE.z - 1.2) },
      { key: 'pan', at: STOVE.clone(), obj: this.pan, ring: ring(STOVE.x, STOVE.z) },
      { key: 'helmet', at: new THREE.Vector3(-3.6, 0, 7.9), obj: helmet, ring: ring(-3.6, 7.9) },
    ];
    // El coche que llega por la calle, muy despacio, con los faros encendidos
    if (!this.neighbor) {
      this.neighbor = makeCar(0x2c3a4a, { luggage: false, joy: false, empty: true });
      this.neighbor.root.rotation.y = -Math.PI / 2;
      const glow = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      for (const s of [-0.62, 0.62]) {
        const g = new THREE.Sprite(glow);
        g.position.set(s, 0.74, 2.3);
        g.scale.setScalar(1.5);
        this.neighbor.root.add(g);
      }
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffe9b8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.set(0, 0.06, 6);
      beam.userData.noCast = true;
      this.neighbor.root.add(beam);
      sc.add(this.neighbor.root);
      this.neighborRig = new CarRig(this.neighbor);
    }
    this.neighbor.root.position.set(62, 0, STREET_Z + 0.6);
    audio.warn();
    vibrate([60, 40, 60]);
    this.updateHud();
    dialogue(CENA.alarm, () => {
      this.busy = false;
      toast(CENA.alarmHint);
    });
  }

  private endAlarm() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    for (const it of this.alarmItems) it.ring.removeFromParent();
    const late = this.tidied < 3;
    if (late) this.scares++;
    dialogue(late ? CENA.falseAlarmLate : CENA.falseAlarm, () => this.gasLeaves());
  }

  private updateAlarm(dt: number) {
    const c = this.neighbor!;
    const before = Math.ceil(this.alarmT);
    if (!this.busy) this.alarmT = Math.max(0, this.alarmT - dt);
    if (Math.ceil(this.alarmT) !== before) this.updateHud();
    // El coche llega a la altura de la cancela justo cuando se acaba el tiempo, y sigue
    const prev = c.root.position.x;
    c.root.position.x = 62 * (this.alarmT / ALARM_SECS) + (this.alarmT <= 0 ? c.root.position.x : 0);
    this.neighborRig?.update(dt, dt > 0 ? Math.abs(prev - c.root.position.x) / dt : 0, 0, 1.2);
    if (this.busy) return;
    const pp = this.player.root.position;
    for (const it of this.alarmItems) {
      if (!it.ring.parent) continue;
      (it.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.abs(Math.sin(this.t * 5)) * 0.4;
      const reach = it.key === 'plates' ? 2.1 : 1.5;
      if (Math.hypot(pp.x - it.at.x, pp.z - it.at.z) < reach) {
        it.ring.removeFromParent();
        if (it.key === 'pan') this.steam.forEach((s) => (s.visible = false));
        it.obj.visible = false;
        this.tidied++;
        toast(CENA.alarmItems[it.key]);
        audio.pickup();
        vibrate(25);
        this.updateHud();
      }
    }
    if (this.tidied >= 3 || this.alarmT <= 0) this.endAlarm();
  }

  private gasLeaves() {
    this.phase = 'leaving';
    this.gas.root.position.set(TABLE.x + 1.5, 0, TABLE.z);
    // Ella también se levanta: de pie junto a su silla (si no, se quedaba a la altura de sentada)
    this.player.root.position.set(TABLE.x - 1.5, 0, TABLE.z);
    // Primero por fuera de la mesa y de la pérgola, y luego a la cancela
    this.gasWalk = [new THREE.Vector3(TABLE.x + 1.6, 0, TABLE.z + 1.4), GATE.clone().setZ(8.8), GATE.clone().setZ(11.5), new THREE.Vector3(2.4, 0, STREET_Z - 1.6)];
    later(() => {
      if (this.phase !== 'leaving') return;
      fadeFlash(() => this.startTidy(), 500);
    }, 5200);
  }

  /** Se ha ido: hay que dejar la mesa igual que en la foto que hizo antes de empezar. */
  private startTidy() {
    this.phase = 'tidy';
    this.gas.root.visible = false;
    this.gasCar.root.visible = false;
    for (const it of this.alarmItems) it.obj.visible = false;
    this.player.root.visible = false;
    this.walker.stop();
    this.hud.setAction(null);
    this.hud.setArrow(null);
    beacon.at(null);
    this.updateHud();
    cinema.play([{ dur: Infinity, pos: new THREE.Vector3(TABLE.x, 2.2, TABLE.z - 1.05), look: new THREE.Vector3(TABLE.x, 0.8, TABLE.z + 0.04), fov: 44 }]);
    dialogue(SIDE.table.intro, () => {
      this.tableGame = new TableMemory(this.scene, TABLE, 0.8, () => {
        this.tableGame?.dispose();
        this.tableGame = null;
        this.player.root.visible = true;
        cinema.stop();
        fadeFlash(() => this.ending(), 500);
      });
    });
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

  /** Ruta de un padre: del jardín a la calle (o al revés) siempre por la cancela, recto por el camino. */
  private route(from: THREE.Vector3, to: THREE.Vector3) {
    const wallZ = GATE.z + 0.1;
    const inside = (z: number) => z < wallZ;
    const side = Math.sign(to.x - GATE.x || from.x - GATE.x) * 0.35;
    const path: THREE.Vector3[] = [];
    if (inside(from.z) !== inside(to.z)) {
      // Primero al eje del camino, luego cruza la cancela y sigue por la acera
      if (inside(from.z)) path.push(new THREE.Vector3(GATE.x + side, 0, Math.min(from.z, GATE.z - 0.9)), new THREE.Vector3(GATE.x + side, 0, GATE.z + 1.2));
      else path.push(new THREE.Vector3(GATE.x + side, 0, Math.max(from.z, GATE.z + 1.2)), new THREE.Vector3(GATE.x + side, 0, GATE.z - 0.9));
    }
    path.push(to.clone());
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

  private sit(p: Person) {
    animatePerson(p, 0.016, 'idle');
    seatPose(p);
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
          this.dadPath = this.route(this.dad.root.position, b.dad);
        }
        if (b.mom === 'hide') this.mom.root.visible = false;
        else if (b.mom) {
          this.mom.root.visible = true;
          this.momPath = this.route(this.mom.root.position, b.mom);
        }
        if (b.carGo) {
          this.carGoing = true;
          const l = this.parentCar.root.getObjectByName('lights');
          if (l) l.visible = true;
          audio.whoosh();
        }
      }
    }
    if (this.dadPath.length && this.dad.root.visible) {
      if (this.moveTo(this.dad, this.dadPath[0], dt, 2.2, this.dadPath.length > 1 ? 0.35 : 0.08)) this.dadPath.shift();
    } else if (this.dad.root.visible) animatePerson(this.dad, dt, 'idle');
    if (this.momPath.length && this.mom.root.visible) {
      if (this.moveTo(this.mom, this.momPath[0], dt, 1.9, this.momPath.length > 1 ? 0.35 : 0.08)) this.momPath.shift();
    } else if (this.mom.root.visible) animatePerson(this.mom, dt, this.phase === 'wait' && this.beatI >= 6 && this.beatI < 8 ? 'talk' : 'idle');
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
    // Quien esté cerca de la cancela o de la puerta la abre (y al alejarse se cierra)
    this.doorWho.length = 0;
    for (const p of [this.dad, this.mom, this.gas, this.player]) if (p.root.visible) this.doorWho.push(p.root.position);
    for (const d of this.doors) d.update(dt, this.doorWho, this.camera.position);

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
    const free = !this.busy && (this.phase === 'toKitchen' || this.phase === 'toTable' || this.phase === 'alarm');
    if (this.phase === 'alarm') this.updateAlarm(dt);
    this.tableGame?.update(this.camera);
    // Mientras hay susto, corre: el coche no espera
    this.walker.speed = this.phase === 'alarm' ? 5.8 : 5.2;
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

    const pending = this.phase === 'alarm' ? this.alarmItems.filter((i) => i.ring.parent).sort((a, b) => pp.distanceTo(a.at) - pp.distanceTo(b.at))[0] : null;
    const tgt = this.phase === 'toKitchen' ? STOVE : this.phase === 'toTable' ? TABLE : (pending?.at ?? null);
    this.marker.visible = !!tgt && free;
    if (tgt) {
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
    if (free) this.walker.camera(this.camera, dt, this.colliders, 6, pp.z < 10.4 && Math.abs(pp.x) < 5.4 ? 2.3 : 3.4);
    else {
      const [pos, look] =
        this.phase === 'cook'
          ? // Por delante de la encimera, bajo el toldo y sin la buganvilla del porche en primer plano
            [this.v1.set(STOVE.x + 1.9, 2.35, STOVE.z + 3.5), new THREE.Vector3(STOVE.x + 0.1, 1.05, STOVE.z - 0.6)]
          : this.phase === 'dinner'
            ? // Entre los dos pies de la pérgola, que quedan a los lados y no delante de ellos
              [this.v1.set(TABLE.x + 0.5, 2.15, TABLE.z + 3.7), new THREE.Vector3(TABLE.x, 0.9, TABLE.z)]
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
    disposeScene(this.scene);
  }
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
  // El agua de la cala
  // (de noche, casi mate: con el brillo de día, la luna dejaba una raya blanca quemada en el agua)
  const waterMat = toon({ color: day ? 0x2a93ad : 0x0d2340, emissive: day ? 0x06303c : 0x030a18, roughness: day ? 0.12 : 0.55, metalness: day ? 0.25 : 0, transparent: true, opacity: 0.93 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(X, 62).rotateX(-Math.PI / 2), waterMat);
  water.position.set(0, WATER, Z0 + 28);
  water.userData.noCast = true;
  sc.add(water);
  // Y al fondo de la calle, detrás del faro, el mar: la misma agua abierta hacia el oeste
  for (const [x0, x1, z0, z1] of [[-520, -190, -46, 320], [-190, -86, -46, Z0 - 3], [-190, -86, Z0 + 59, 320]] as const) {
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), waterMat);
    w2.position.set((x0 + x1) / 2, WATER, (z0 + z1) / 2);
    w2.userData.noCast = true;
    sc.add(w2);
  }

  const m = new Merger();
  // El muro de marès de la calle, y lo que crece en la ladera
  m.add(G.box, 0xc9b48f, 53, 0.3, Z0 + 0.15, 0, 0, 0, 274, 0.6, 0.35);
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
  // Unas sombrillas en la playita
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
  m.add(G.box, 0xc8ccd0, -1.6, 4.25, 0.95, 0, 0, 0, 4.7, 0.05, 0.05);
  m.add(G.box, 0xc8ccd0, -1.6, 3.95, 0.95, 0, 0, 0, 4.7, 0.04, 0.04);
  for (let k = 0; k <= 10; k++) m.add(G.box, 0xc8ccd0, -3.9 + k * 0.46, 3.85, 0.95, 0, 0, 0, 0.03, 0.8, 0.03);
  // Ventana pequeña del primer piso a la derecha
  m.add(G.box, 0x2a3138, 3.2, 4.4, -1.18, 0, 0, 0, 1.0, 1.2, 0.05);
  for (const sx of [-1, 1]) m.add(G.box, SHUTTER, 3.2 + sx * 0.75, 4.4, -1.15, 0, 0, 0, 0.5, 1.25, 0.05);
  // Azotea: pretil, barandilla tubular y la antena
  m.add(G.box, WHITE, 0.9, 6.2, -3.6, 0, 0, 0, 8.4, 0.3, 8.6);
  for (let k = 0; k <= 14; k++) m.add(G.box, 0xc8ccd0, -3.3 + k * 0.6, 6.75, 0.62, 0, 0, 0, 0.04, 0.8, 0.04);
  m.add(G.box, 0xc8ccd0, 0.9, 7.15, 0.62, 0, 0, 0, 8.4, 0.05, 0.05);
  m.add(G.box, 0xc8ccd0, 4.8, 7.15, -3.6, 0, 0, 0, 0.05, 0.05, 8.4);
  m.add(G.box, 0x9a9ea2, 3.6, 7.6, -2.2, 0, 0, 0, 0.05, 2.4, 0.05);
  for (let k = 0; k < 5; k++) m.add(G.box, 0x9a9ea2, 3.6, 8.2 + k * 0.08, -2.2 - k * 0.1, 0, 0, 0, 0.9 - k * 0.12, 0.02, 0.02);
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
    m.add(G.cyl, 0x8d9096, SC + s2 * 0.2, 1.2, 6.2, 0, 0, s2 * -0.3, 0.012, 0.18, 0.012); // retrovisor
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
  m.add(G.box, 0xe9e2d2, STOVE.x, 0.45, STOVE.z - 1.0, 0, 0, 0, 2.6, 0.9, 0.8);
  m.add(G.box, 0x7a6a58, STOVE.x, 0.92, STOVE.z - 1.0, 0, 0, 0, 2.7, 0.06, 0.85);
  m.add(G.box, 0x2a2a2e, STOVE.x + 0.3, 0.97, STOVE.z - 1.0, 0, 0, 0, 0.8, 0.04, 0.6);
  m.add(G.cyl, 0xe0662a, STOVE.x + 1.6, 0.35, STOVE.z - 1.1, 0, 0, 0, 0.42, 0.7, 0.42); // butano naranja
  m.add(G.cyl, 0x444444, STOVE.x + 1.6, 0.76, STOVE.z - 1.1, 0, 0, 0, 0.12, 0.12, 0.12);
  m.add(G.box, 0x8a6a44, STOVE.x, 1.9, STOVE.z - 1.35, 0, 0, 0, 2.4, 0.06, 0.35);
  for (let i = 0; i < 4; i++) m.add(G.cyl, [0xd8b04a, 0x2f6b3a, 0xc23030, 0xf4efe2][i], STOVE.x - 0.9 + i * 0.6, 2.08, STOVE.z - 1.35, 0, 0, 0, 0.18, 0.3, 0.18);
  colliders.push({ minX: STOVE.x - 1.4, maxX: STOVE.x + 1.9, minZ: STOVE.z - 1.5, maxZ: STOVE.z - 0.6, low: true });
  // Sartén y olla sobre el fuego
  const pan = new THREE.Group();
  const pm = new Merger();
  pm.add(G.cyl, 0x2b2b2b, 0, 0, 0, 0, 0, 0, 0.5, 0.06, 0.5);
  pm.add(G.box, 0x2b2b2b, 0.42, 0.02, 0, 0, 0, 0, 0.4, 0.04, 0.06);
  pm.add(G.cyl, 0x9a9aa0, -0.55, 0.15, 0.05, 0, 0, 0, 0.45, 0.32, 0.45); // olla de la pasta
  pan.add(pm.mesh());
  pan.position.set(STOVE.x + 0.2, 1.02, STOVE.z - 1.0);
  sc.add(pan);
  const steamMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(steamMat);
    s.scale.setScalar(0.4);
    s.visible = false;
    sc.add(s);
    steam.push(s);
  }
  // Mesa de la terraza con mantel, dos sillas y guirnalda de luces
  m.add(G.cyl, 0xf4efe2, TABLE.x, 0.76, TABLE.z, 0, 0, 0, 1.3, 0.05, 1.3);
  m.add(G.cyl, 0x5aa9e6, TABLE.x, 0.79, TABLE.z, 0, 0, 0, 1.0, 0.01, 1.0);
  m.add(G.cyl, 0x777777, TABLE.x, 0.38, TABLE.z, 0, 0, 0, 0.08, 0.76, 0.08);
  // Dos sillas de madera de verdad (asiento a 48 cm, patas y respaldo hacia fuera): antes eran bloques
  // macizos de 90 cm y se sentaban encima, a la altura de la mesa
  for (const sx of [-1, 1]) {
    const cx = TABLE.x + sx * 0.95;
    m.add(G.box, 0x8a6a44, cx, 0.46, TABLE.z, 0, 0, 0, 0.44, 0.04, 0.42);
    for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) m.add(G.box, 0x6e5234, cx + dx, 0.23, TABLE.z + dz, 0, 0, 0, 0.035, 0.46, 0.035);
    for (const dz of [-0.18, 0.18]) m.add(G.box, 0x6e5234, cx + sx * 0.2, 0.72, TABLE.z + dz, 0, 0, 0, 0.035, 0.55, 0.035);
    m.add(G.box, 0x8a6a44, cx + sx * 0.2, 0.88, TABLE.z, 0, 0, 0, 0.035, 0.2, 0.4);
  }
  for (const sx of [-1, 1]) m.add(G.cyl, 0xf4efe2, TABLE.x + sx * 0.3, 0.82, TABLE.z, 0, 0, 0, 0.32, 0.03, 0.32); // platos
  colliders.push({ minX: TABLE.x - 1.3, maxX: TABLE.x + 1.3, minZ: TABLE.z - 0.7, maxZ: TABLE.z + 0.7 });
  for (const [x, z] of [[-4.6, 9.6], [4.6, 9.6], [4.6, 0.8]] as [number, number][]) m.add(G.cyl, 0x8a6a44, x, 1.4, z, 0, 0, 0, 0.1, 2.8, 0.1);
  const bulbs = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    const b = new THREE.Sprite(bulbs);
    b.position.set(4.6, 2.75 - Math.sin(k * Math.PI) * 0.4, 0.8 + k * 8.8);
    b.scale.setScalar(0.35);
    sc.add(b);
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
  m.add(G.box, 0x1e1e22, 7, 8.5, STREET_Z - 3.0, 0, 0, 0, 46, 0.03, 0.03);
  m.add(G.box, 0x1e1e22, 2.2, 7.4, 2.0, -0.28, -0.35, 0, 0.03, 0.03, 13); // el cable que baja a la casa
  for (const x of [-26, 20]) {
    m.add(G.cyl, 0x333338, x, 2, STREET_Z - 3.2, 0, 0, 0, 0.12, 4, 0.12);
    colliders.push({ minX: x - 0.08, maxX: x + 0.08, minZ: STREET_Z - 3.28, maxZ: STREET_Z - 3.12, round: true });
    const l = new THREE.Sprite(bulbs);
    l.position.set(x, 4.1, STREET_Z - 3.2);
    l.scale.setScalar(1.2);
    sc.add(l);
  }
  sc.add(m.mesh());
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
  return { pan, steam, beam, bulbs, walkers: farola.walkers, gate, door };
}
