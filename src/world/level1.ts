import * as THREE from 'three';
import { steerTo, type SteerState } from '../core/steer';
import { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { Confetti, Fireworks, Glitter, toon, vibrate } from '../core/gfx';
import { FERRERIES, FERRERIES_MEET } from '../data/story';
import { buildFerreries, animateCrowd, FerreriesWorld, type TownDressing } from './ferreries';
import { boneAnchor } from '../entities/rig';
import { makePerson, makeDonkey, animatePerson, Person, Donkey, Merger, G, type PersonLook } from '../entities/models';
import { Particles } from '../entities/fx';
import { PhysicsWorld, Body, type Mover } from '../core/physics';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { hud, dialogue, toast, phoneChat, Hud, DebugItem, later } from '../ui/ui';
import { embrace, hugFor, type Embrace } from '../entities/embrace';
import { CHATS, type ChatFrag } from '../data/chats';
import { clock, type Level, type LevelDone, disposeObj } from './level';

// Nivel 1 · Jaleo d'ases (Ferreries), con todos los textos en menorquín.
// Bucle: hablar con Tòfol → 3 pomadas + 3 caricias a los ases esquivando sus empujones → volver a Tòfol →
// ir al bar a bailar con Carme → Marc viene a hablar con Carme y se presenta → bailar → el chat de esa tarde.
// Los ases no saltan: se paran un momento (avisan con un "!") y entonces se les puede hacer una caricia.

/** El mismo jaleo sirve para Ferreries (Sant Bartomeu) y para Ciutadella (Sant Joan). */
export interface JaleoVariant {
  text: typeof FERRERIES & { gasMoves?: string[] };
  town?: TownDressing;
  guide: string;
  item: string;
  hud: { talk: string; collectItems: string; collectLuck: string; collect: string; back: string; find: string; give: string };
  bumped: string;
  statHits: string;
  horses?: boolean;
  /** Chats reales que salen después de la intro y al final (por defecto, los de aquella tarde). */
  introChats?: ChatFrag[];
  endChats?: ChatFrag[];
  /** Capítulo del año siguiente: Azul ya no va con el mono negro. */
  outfit?: Partial<PersonLook>;
  /** Un año después: primero se busca a Gas por sus ubicaciones y luego se hace el jaleo con él al lado. */
  findFirst?: { found: ChatFrag[] };
  /** Algo que pasa al final del capítulo, antes de cerrarlo (p. ej. un minijuego). */
  afterEnd?: (next: () => void) => void;
  /** Ferreries: la mirada a cámara lenta, el baile juntos, el beso y el Instagram. */
  meetScene?: typeof FERRERIES_MEET;
}

export const FERRERIES_VARIANT: JaleoVariant = {
  text: FERRERIES,
  guide: 'Tòfol',
  item: '🍋',
  hud: {
    talk: 'Habla con Tòfol, en el bar de la plaza',
    collectItems: 'Busca las pomadas que faltan por los bares',
    collectLuck: 'Acaricia a los burros cuando se paren',
    collect: 'Pomadas por los bares y caricias a los burros cuando se paren',
    back: '¡Ya está! Vuelve con Tòfol',
    find: 'Ve a bailar al bar de Sa Font, con Carme',
    give: '💃 Bailar',
  },
  bumped: '¡Uiii! Cuidado con los burros 🫏',
  statHits: 'Empujones de burro',
  meetScene: FERRERIES_MEET,
};

type Stage = 'intro' | 'talkTofol' | 'collect' | 'returnTofol' | 'findMarc' | 'barDance' | 'meet' | 'eyes' | 'pairDance' | 'kiss' | 'kissing' | 'ending' | 'done';

const WARN = 0.8;
const REAR = 1.8;
const TOUCH_R = 3.2;

interface DonkeyState {
  d: Donkey;
  mode: 'circle' | 'street';
  angle: number; // para el círculo
  dir: number; // para la calle
  warnT: number; // aviso antes de encabritarse
  rearT: number; // tiempo restante encabritado
  nextRear: number;
  touched: boolean;
  walkPhase: number;
  alert: THREE.Sprite;
  ring: THREE.Mesh;
}

interface Pomada {
  mesh: THREE.Object3D;
  home: THREE.Vector3;
  taken: boolean;
}

let alertTex: THREE.Texture | null = null;
function alertTexture() {
  if (alertTex) return alertTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#2a1a2e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a2e';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 70);
  alertTex = new THREE.CanvasTexture(c);
  alertTex.colorSpace = THREE.SRGBColorSpace;
  return alertTex;
}

export class Level1 implements Level {
  private scene = new THREE.Scene();
  private world: FerreriesWorld;
  private player: Person;
  private walker: Walker;
  private tofol: Person;
  private marc: Person;
  private carme: Person;
  private marcTo: THREE.Vector3 | null = null;
  private barT = 0;
  private eyesT = 0;
  private pairT = 0;
  private kissT = 0;
  private kiss: Embrace | null = null;
  private clearR = 0;
  private carmeTo: THREE.Vector3 | null = null;
  private carmeSteer: SteerState = {};
  private marcSteer: SteerState = {};
  private readonly clear = { x: 0, z: 0, r: 0 };
  /** La gente se aparta un poco al paso de la jugadora. */
  private readonly near = [{ x: 0, z: 0, r: 0.95 }];
  private donkeys: DonkeyState[] = [];
  // Vasos de plástico de pomada por el suelo: se patean, se vuelcan, ruedan y los ases los arrollan
  private phys = new PhysicsWorld();
  private movers: Mover[] = [];
  private moverPrev: THREE.Vector3[] = [];
  private pomadas: Pomada[] = [];
  private inHand: THREE.Object3D;
  private fx: Particles;
  private confetti = new Confetti(180, 12, 10);
  private marker: THREE.Group;
  private hud: Hud;
  private stage: Stage = 'intro';
  private pomadaCount = 0;
  private luckCount = 0;
  private perfects = 0;
  private hits = 0;
  private playTime = 0;
  private invuln = 0;
  private t = 0;
  private busy = false; // diálogo abierto
  private endingT = 0;
  private pendingAction: (() => void) | null = null;
  private fabiolera: Person;
  private fireworks = new Fireworks();
  // Es jaleo: confeti en el aire, purpurina y pistolas de agua entre la gente
  private airConfetti = new Confetti(110, 9, 7);
  private glitter = new Glitter();
  private shooters: { p: Person; gun: THREE.Group; yaw: number; aim: number; fireT: number; turnT: number }[] = [];
  private tossT = 2;
  private noteT = 0;
  private partyColors: Float32Array;
  private hue = 0;
  private tmpC = new THREE.Color();
  private solids: Circle[] = [];
  private T: JaleoVariant['text'];
  /** Sant Joan: Gas se cambia de sitio cuando te acercas (no encuentra la ubicación). */
  private gasMovesLeft = 0;
  private marcBox: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  /** Gas va al lado de Azul (capítulo 9, después de encontrarle). */
  private together = false;

  // temporales reutilizables
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
    private V: JaleoVariant = FERRERIES_VARIANT,
  ) {
    this.T = V.text;
    this.world = buildFerreries(this.scene, V.town);
    this.fx = new Particles(this.scene, 120);
    this.buildCups();

    // Esa noche, Margaux y Carme van con un mono negro de una pieza, ajustado
    const MONO = { shirt: 0x141418, pants: 0x141418, shoes: 0x111111, skirt: false, jumpsuit: true };
    this.player = makePerson({ ...MARGAUX_LOOK, ...(V.outfit ?? MONO) });
    this.player.root.position.copy(this.world.spawn);
    this.scene.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.facing = this.walker.yaw = Math.PI / 2;
    this.buildShooters();
    this.solids.push(...this.world.people);

    this.tofol = V.horses
      ? makePerson({ skin: 0xf0c8a6, shirt: 0xffffff, pants: 0x1f3a6b, hair: 0x6b3f22, hairStyle: 'long', skirt: true, eyes: 0x5a3a22 })
      : makePerson({ skin: 0xd9a27c, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x9a9a9a, hairStyle: 'short', beard: true, shorts: true });
    this.tofol.root.position.copy(this.world.tofolPos);
    // Delantal de Tòfol
    if (!V.horses && this.tofol.rig) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.012), new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2a7a50), roughness: 0.85 }));
      apron.position.set(0, -0.14, 0.135);
      apron.castShadow = true;
      boneAnchor(this.tofol, 'Hips').add(apron);
    } else if (!V.horses) this.tofol.body.add(new Merger().add(G.box, 0x2a7a50, 0, 0.92, 0.17, 0, 0, 0, 0.42, 0.5, 0.04).mesh());
    this.scene.add(this.tofol.root);

    // En Sant Joan, Gas lleva la camiseta azul de Azul
    this.marc = makePerson(V.horses ? { ...MARC_LOOK, shirt: MARGAUX_LOOK.shirt } : V.findFirst ? MARC_LOOK : { ...MARC_LOOK, shirt: 0x1d4f9c, stripes: [0x0a3d8f, 0xa50044], shorts: true }); // aquel día, con la del Barça
    this.gasMovesLeft = this.T.gasMoves?.length ?? 0;
    // En el bar: Carme (rubia, pelo corto) bailando; Marc, un poco más allá, bailando fatal
    this.carme = makePerson({ skin: 0xf3d2b6, hair: 0xf3dc8f, hairStyle: 'short', eyes: 0x3a6ea8, ...MONO });
    this.carme.root.position.copy(this.world.marcPos);
    this.carme.root.rotation.y = Math.atan2(-this.world.marcPos.x, 14 - this.world.marcPos.z);
    this.scene.add(this.carme.root);
    this.marc.root.position.copy(this.world.marcPos).add(new THREE.Vector3(3.2, 0, 2.2));
    this.marc.root.rotation.y = Math.atan2(-this.world.marcPos.x, 14 - this.world.marcPos.z);
    this.scene.add(this.marc.root);

    // La fabiolera: toca el fabiol y el tamborí delante de la iglesia
    this.fabiolera = makePerson({ skin: 0xf0c8a6, shirt: 0x1b1b22, pants: 0xf3f0ea, hair: 0x5a3a22, hairStyle: 'bun', shoes: 0x111111 });
    this.fabiolera.root.position.copy(this.world.fabioleraPos);
    this.fabiolera.root.rotation.y = Math.PI;
    if (this.fabiolera.rig) {
      // Personaje glTF: el bombín va en la cabeza y el tamborí en la cadera, siguiendo al cuerpo
      const mat = (c: number, r = 0.6) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: r });
      const hat = new THREE.Group();
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x111111, 0.55));
      crown.scale.y = 1.3;
      crown.position.y = 0.235;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 24), mat(0x111111, 0.55));
      brim.position.y = 0.235;
      hat.add(crown, brim);
      boneAnchor(this.fabiolera, 'Head').add(hat);
      // El fabiol sale de la boca hacia abajo y adelante
      const fabiol = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.38, 10), mat(0x6b4428, 0.45));
      fabiol.rotation.x = -0.65;
      fabiol.position.set(0, 0.07 - 0.19 * Math.cos(0.65), 0.1 + 0.19 * Math.sin(0.65));
      fabiol.castShadow = true;
      hat.parent!.add(fabiol);
      const drum = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.17, 24), mat(0xd9c7a5, 0.7));
      const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.03, 24), mat(0x9b2335, 0.6));
      drum.add(shell, hoop);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(-0.2, -0.02, 0.1);
      boneAnchor(this.fabiolera, 'Hips').add(drum);
      for (const o of [crown, brim, shell, hoop]) o.castShadow = true;
    } else this.fabiolera.body.add(
      new Merger()
        .add(G.cyl, 0x111111, 0, 2.08, 0, 0, 0, 0, 0.62, 0.18, 0.62) // bombín
        .add(G.cyl, 0x111111, 0, 1.99, 0, 0, 0, 0, 0.82, 0.03, 0.82)
        .add(G.cyl, 0xd9c7a5, 0.24, 0.95, 0.12, 0, 0, Math.PI / 2, 0.36, 0.22, 0.36) // tamborí
        .add(G.cyl, 0x9b2335, 0.24, 0.95, 0.12, 0, 0, Math.PI / 2, 0.37, 0.05, 0.37)
        .mesh(),
    );
    if (!this.fabiolera.rig) this.fabiolera.handR.add(new Merger().add(G.cyl, 0x6b4428, 0, 0.1, 0.05, 0.4, 0, 0, 0.04, 0.4, 0.04).mesh()); // fabiol
    this.scene.add(this.fabiolera.root);
    this.world.colliders.push({ minX: this.world.fabioleraPos.x - 0.4, maxX: this.world.fabioleraPos.x + 0.4, minZ: this.world.fabioleraPos.z - 0.4, maxZ: this.world.fabioleraPos.z + 0.4 });
    this.scene.add(this.fireworks.points);
    this.scene.add(this.airConfetti.mesh, this.glitter.points);
    this.partyColors = this.world.partyLights.geometry.attributes.color.array as Float32Array;
    for (const p of [this.world.tofolPos, this.world.marcPos]) {
      this.world.colliders.push({ minX: p.x - 0.35, maxX: p.x + 0.35, minZ: p.z - 0.35, maxZ: p.z + 0.35 });
    }
    this.marcBox = this.world.colliders[this.world.colliders.length - 1];

    // Ases: 3 dando vueltas en la plaza y 1 paseando por la calle
    // En Sant Joan son caballos negros, más grandes que los ases
    const coats = V.horses ? [0x15110f, 0x1c1714, 0x120e0c, 0x241c17] : [0x7d6b5d, 0x5e4f45, 0x8f8379, 0x6d5a4a];
    const ringGeo = new THREE.RingGeometry(TOUCH_R - 0.25, TOUCH_R, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const d = makeDonkey(coats[i]);
      if (V.horses) d.root.scale.set(1.15, 1.3, 1.25);
      this.scene.add(d.root);
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false, transparent: true }));
      alert.position.y = 3.6;
      alert.scale.setScalar(0.9);
      alert.visible = false;
      alert.renderOrder = 5;
      d.root.add(alert);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0.7, depthWrite: false }));
      ring.position.y = 0.04;
      ring.visible = false;
      d.root.add(ring);
      this.donkeys.push({
        d,
        mode: i < 3 ? 'circle' : 'street',
        angle: (i / 3) * Math.PI * 2,
        dir: 1,
        warnT: 0,
        rearT: 0,
        nextRear: 2 + i * 1.7,
        touched: false,
        walkPhase: i,
        alert,
        ring,
      });
      if (i === 3) d.root.position.set(-20, 0, 0);
    }

    // Pomadas: vaso con limonada y rodaja de limón, con un haz de luz para verlas de lejos
    const glassGeo = V.horses
      ? // Bolsita de avellanes: papel de estraza abierto con avellanes asomando
        new Merger()
          .add(new THREE.CylinderGeometry(0.17, 0.14, 0.34, 10), 0xc9a26b, 0, 0.17, 0)
          .add(G.sphere, 0x8a5a2b, 0.06, 0.36, 0.03, 0, 0, 0, 0.12, 0.11, 0.12)
          .add(G.sphere, 0x7a4b22, -0.07, 0.37, -0.02, 0, 0, 0, 0.12, 0.11, 0.12)
          .add(G.sphere, 0x95632f, 0.0, 0.4, -0.07, 0, 0, 0, 0.11, 0.1, 0.11)
          .build()
      : new Merger()
          .add(new THREE.CylinderGeometry(0.16, 0.12, 0.38, 12), 0xfff4b0, 0, 0.19, 0)
          .add(G.cyl, 0xf9e04b, 0.1, 0.4, 0, 0, 0, Math.PI / 2, 0.18, 0.03, 0.18)
          .add(G.cyl, 0x7fd36b, -0.05, 0.42, 0, 0.3, 0, 0.2, 0.03, 0.35, 0.03)
          .build();
    const glassMat = toon({ vertexColors: true, emissive: 0x4a3a00 });
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 16, 1, true).translate(0, 3.5, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (const home of this.world.pomadaSpots) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(glassGeo, glassMat));
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.6, depthWrite: false }));
      glow.position.y = 0.02;
      g.add(glow, new THREE.Mesh(beamGeo, beamMat));
      g.position.copy(home);
      g.visible = false;
      this.scene.add(g);
      this.pomadas.push({ mesh: g, home: home.clone(), taken: false });
    }
    // La pomada que lleva en la mano
    this.inHand = new THREE.Mesh(glassGeo, glassMat);
    this.inHand.scale.setScalar(0.7);
    this.inHand.position.set(0, -0.2, 0.02);
    this.inHand.visible = false;
    this.player.handR.add(this.inHand);

    // Marcador de objetivo: flecha dorada que flota
    this.marker = new THREE.Group();
    const arrowMat = toon({ color: 0xffd23f, emissive: 0x7a5200 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 16).rotateX(Math.PI), arrowMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12).translate(0, 0.45, 0), arrowMat);
    this.marker.add(cone, stem);
    this.scene.add(this.marker);

    this.confetti.mesh.visible = false;
    this.confetti.active = false;
    this.scene.add(this.confetti.mesh);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.updateHud();

    this.camera.position.set(-50, 9, 4);
    this.busy = true;
    later(() => {
      if (this.stage !== 'intro') return;
      const go = () => {
        this.busy = false;
        this.stage = V.findFirst ? 'findMarc' : 'talkTofol';
        this.updateHud();
      };
      dialogue(this.T.intro, () => (V.introChats ? phoneChat(V.introChats, go) : go()));
    }, 2300);
    audio.startMusic();
    audio.ambience(0.03);
  }

  get threeScene() {
    return this.scene;
  }

  private updateHud() {
    const h = this.hud;
    const counters = `<span class="chip">${this.V.item} ${this.pomadaCount}/3</span><span class="chip">🍀 ${this.luckCount}/3</span>`;
    switch (this.stage) {
      case 'intro':
      case 'talkTofol':
        h.setObjective(this.V.hud.talk);
        h.setCounters('');
        break;
      case 'collect':
        if (this.luckCount >= 3) h.setObjective(this.V.hud.collectItems);
        else if (this.pomadaCount >= 3) h.setObjective(this.V.hud.collectLuck);
        else h.setObjective(this.V.hud.collect);
        h.setCounters(counters);
        break;
      case 'returnTofol':
        h.setObjective(this.V.hud.back);
        h.setCounters(counters);
        break;
      case 'findMarc':
        h.setObjective(this.V.hud.find);
        h.setCounters('');
        break;
      case 'kiss':
      case 'kissing':
        h.setObjective('💋');
        h.setCounters('');
        break;
      case 'pairDance':
        h.setObjective('💃🕺');
        h.setCounters('');
        break;
      case 'barDance':
      case 'meet':
      case 'eyes':
        h.setObjective('…');
        h.setCounters('');
        break;
      default:
        h.setObjective('❤ Feliz cumpleaños ❤');
        h.setCounters('');
    }
  }

  private target(): THREE.Vector3 | null {
    switch (this.stage) {
      case 'talkTofol':
      case 'returnTofol':
        return this.world.tofolPos;
      case 'findMarc':
        return this.world.marcPos;
      case 'collect': {
        if (this.pomadaCount < 3) {
          let best: Pomada | null = null;
          let bd = Infinity;
          for (const p of this.pomadas) {
            if (p.taken) continue;
            const d = p.home.distanceToSquared(this.player.root.position);
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
          if (best && (this.luckCount >= 3 || bd < 30 * 30)) return best.home;
        }
        return this.world.plazaCenter;
      }
      default:
        return null;
    }
  }

  private updateDonkeys(dt: number) {
    const pp = this.player.root.position;
    let rearingNear: DonkeyState | null = null;
    let nearest = Infinity;
    for (const s of this.donkeys) {
      const r = s.d.root;
      const dist = r.position.distanceTo(pp);
      if (s.rearT > 0) {
        const before = s.rearT;
        s.rearT -= dt;
        const prog = Math.min(1, 1 - s.rearT / REAR);
        const k = Math.sin(prog * Math.PI);
        // Parado, con las cuatro patas en el suelo: baja la cabeza y mueve la cola, tranquilo
        s.d.pivot.rotation.x = 0;
        for (const l of s.d.legs) l.rotation.x *= 0.8;
        s.d.head.rotation.x = k * 0.35 + Math.sin(this.t * 3) * 0.05;
        if (before > 0.3 && s.rearT <= 0.3 && dist < 6) audio.knock(0.2, 300, 0.1);
        const touchable = !s.touched && this.luckCount < 3 && s.rearT > 0.2 && this.stage === 'collect';
        s.ring.visible = touchable;
        if (touchable) {
          const perfect = k > 0.85;
          (s.ring.material as THREE.MeshBasicMaterial).color.set(perfect ? 0xffd23f : 0x5cff8a);
          s.ring.scale.setScalar(perfect ? 1 + Math.sin(this.t * 20) * 0.03 : 1);
        }
        if (s.rearT <= 0) {
          s.d.pivot.rotation.x = 0;
          s.ring.visible = false;
          s.nextRear = 3 + Math.random() * 4;
        }
      } else if (s.warnT > 0) {
        // Aviso: se para, sacude la cabeza y aparece el "!"
        s.warnT -= dt;
        s.alert.visible = true;
        s.alert.scale.setScalar(0.9 + Math.abs(Math.sin(this.t * 12)) * 0.25);
        s.d.head.rotation.y = Math.sin(this.t * 10) * 0.15;
        if (s.warnT <= 0) {
          s.alert.visible = false;
          s.d.head.rotation.y = 0;
          s.rearT = REAR;
        }
      } else {
        const spd = s.mode === 'circle' ? 0.32 : 2.6;
        if (s.mode === 'circle') {
          s.angle += dt * spd;
          const c = this.world.plazaCenter;
          r.position.set(c.x + Math.cos(s.angle) * 5.2, 0, c.z + Math.sin(s.angle) * 4.4);
          r.rotation.y = -s.angle; // tangente al círculo
        } else {
          r.position.x += s.dir * spd * dt;
          if (Math.abs(r.position.x) > 40) s.dir *= -1;
          r.position.z = 0;
          r.rotation.y = (s.dir * Math.PI) / 2;
        }
        s.walkPhase += dt * 8;
        const w = Math.sin(s.walkPhase) * 0.5;
        s.d.legs[0].rotation.x = w;
        s.d.legs[3].rotation.x = w;
        s.d.legs[1].rotation.x = -w;
        s.d.legs[2].rotation.x = -w;
        s.d.head.rotation.x = Math.sin(s.walkPhase * 0.5) * 0.08;
        s.d.pivot.rotation.x = Math.sin(s.walkPhase * 2) * 0.015;
        s.nextRear -= dt;
        // En la calle solo se encabrita si estás cerca; en la plaza, siempre
        if (s.nextRear <= 0 && (s.mode === 'circle' || dist < 7)) {
          s.warnT = WARN;
          if (dist < 12) audio.warn();
        }
      }

      if (!s.touched && this.luckCount < 3 && s.rearT > 0.2 && dist < TOUCH_R && dist < nearest) {
        rearingNear = s;
        nearest = dist;
      }

      // Choque: el ase te empuja (solo si no está de manos)
      if (s.rearT <= 0 && dist < 1.35 && this.invuln <= 0 && !this.busy && this.stage !== 'ending') {
        this.v1.subVectors(pp, r.position).setY(0).normalize().multiplyScalar(10);
        this.walker.knock.copy(this.v1);
        this.walker.shake(0.4);
        this.invuln = 1.5;
        this.hits++;
        audio.hit();
        vibrate(90);
        this.fx.burst(this.v2.copy(pp).setY(0.1), 'dust', 5, 1.5, 0.3);
        if (this.stage === 'collect' && this.pomadaCount > 0) {
          this.pomadaCount--;
          const lost = this.pomadas.find((p) => p.taken);
          if (lost) {
            lost.taken = false;
            lost.mesh.visible = true;
          }
          toast(this.T.hints.dropped);
          this.fx.burst(this.v1.copy(pp).setY(1.5), '🍋', 5);
          this.updateHud();
        } else {
          toast(this.V.bumped);
        }
      }
    }
    return rearingNear;
  }

  private touchDonkey(s: DonkeyState) {
    const k = Math.sin(Math.min(1, 1 - s.rearT / REAR) * Math.PI);
    const perfect = k > 0.85;
    s.touched = true;
    s.ring.visible = false;
    this.luckCount++;
    const at = this.v1.copy(s.d.root.position).setY(2.4);
    if (perfect) {
      this.perfects++;
      audio.perfect();
      toast(this.T.hints.perfect);
      this.fx.burst(at, '✨', 10, 3.5, 1.4);
      vibrate([20, 30, 20]);
    } else {
      audio.luck();
      toast(k < 0.4 ? this.T.hints.late : this.T.hints.luck);
      vibrate(25);
    }
    this.fx.burst(at, '🍀', perfect ? 12 : 8);
    audio.cheer(perfect ? 0.45 : 0.3);
    if (this.luckCount === 3) later(() => toast(this.T.hints.allLuck), 1200);
    this.checkCollectDone();
  }

  private buildCups() {
    const ph = this.phys;
    const W = this.world;
    ph.walls = W.colliders.filter((c) => c.maxX - c.minX < 60 && c.maxZ - c.minZ < 60);
    ph.bounds = W.bounds;
    const geo = new THREE.CylinderGeometry(0.07, 0.05, 0.17, 14);
    // Vasos de plástico transparentes de pomada (gin con limonada): alguno con un culo de limonada
    const mats = [toon({ color: 0xf4f7f2, roughness: 0.15, transparent: true, opacity: 0.55 }), toon({ color: 0xf1ecb0, roughness: 0.2, transparent: true, opacity: 0.7 })];
    const B = W.bounds;
    let n = 0;
    for (let i = 0; i < 600 && n < 36; i++) {
      const x = B.minX + 1 + Math.random() * (B.maxX - B.minX - 2);
      const z = B.minZ + 1 + Math.random() * (B.maxZ - B.minZ - 2);
      if (W.colliders.some((c) => x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4)) continue;
      const mesh = new THREE.Mesh(geo, mats[n % mats.length]);
      mesh.castShadow = true;
      this.scene.add(mesh);
      const b = new Body(mesh, { kind: 'cup', r: 0.07, h: 0.17, mass: 0.03, bounce: 0.25, drag: 0.6 });
      b.pos.set(x, 0, z);
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        b.tilt = Math.PI / 2;
        b.tiltAxis.set(Math.cos(a), 0, Math.sin(a));
        b.rollAngle = Math.random() * 6;
      }
      ph.add(b);
      b.asleep = true;
      n++;
    }
    this.movers.push({ x: 0, z: 0, vx: 0, vz: 0, r: 0.35, height: 1.8 });
  }

  private stepCups(dt: number) {
    const pp = this.player.root.position;
    const m0 = this.movers[0];
    m0.x = pp.x;
    m0.z = pp.z;
    m0.vx = this.walker.vx;
    m0.vz = this.walker.vz;
    // Los ases (burros y caballos de la fiesta) también los arrollan
    this.donkeys.forEach((s, i) => {
      const r = s.d.root.position;
      const m = (this.movers[i + 1] ??= { x: 0, z: 0, vx: 0, vz: 0, r: 0.55, height: 1.6 });
      const prev = (this.moverPrev[i] ??= r.clone());
      m.vx = dt > 0 ? (r.x - prev.x) / dt : 0;
      m.vz = dt > 0 ? (r.z - prev.z) / dt : 0;
      m.x = r.x;
      m.z = r.z;
      prev.copy(r);
    });
    this.phys.step(dt, this.movers);
    for (const im of this.phys.impacts) {
      const d = im.at.distanceTo(pp);
      if (d < 12) audio.knock(Math.min(1, im.strength * 6) / (1 + d * 0.3), 2300);
    }
  }

  update(dt: number) {
    // La primera mirada: el mundo va a cámara lenta
    if (this.stage === 'eyes') {
      this.eyesT += dt;
      this.eyesCamera(dt);
      dt *= 0.2;
    }
    this.t += dt;
    const ending = this.stage === 'ending' || this.stage === 'done';
    const close0 = this.stage === 'meet' || this.stage === 'eyes' || this.stage === 'pairDance' || this.stage === 'kiss' || this.stage === 'kissing';
    this.clearR += ((close0 ? 4.2 : 0) - this.clearR) * Math.min(1, dt * 1.5);
    const cm = this.v1.copy(this.player.root.position).lerp(this.marc.root.position, 0.5);
    Object.assign(this.clear, { x: cm.x, z: cm.z, r: this.clearR });
    const pp0 = this.player.root.position;
    this.near[0].x = pp0.x;
    this.near[0].z = pp0.z;
    animateCrowd(this.world.crowds, this.t, ending ? 1.7 : 1, this.clear, dt, this.near);
    this.updateShooters(dt);
    this.jaleoFx(dt);
    this.fx.update(dt);
    (this.world.lights.material as THREE.PointsMaterial).size = 0.9 + Math.sin(this.t * 3) * 0.08;
    // Guirnaldas de los bares que cambian de color con la música
    this.hue += dt * 0.35;
    for (let i = 0; i < this.partyColors.length / 3; i++) {
      this.tmpC.setHSL((this.hue + i * 0.13) % 1, 0.95, 0.55 + 0.15 * Math.sin(this.t * 8 + i));
      this.partyColors[i * 3] = this.tmpC.r;
      this.partyColors[i * 3 + 1] = this.tmpC.g;
      this.partyColors[i * 3 + 2] = this.tmpC.b;
    }
    this.world.partyLights.geometry.attributes.color.needsUpdate = true;
    // Notas musicales saliendo de los bares cercanos
    this.noteT -= dt;
    if (this.noteT <= 0) {
      this.noteT = 0.9;
      for (const b of this.world.bars) {
        if (b.distanceTo(this.player.root.position) < 22) this.fx.burst(this.v1.copy(b).setY(2.8).setX(b.x + (Math.random() - 0.5) * 4), Math.random() < 0.5 ? '🎵' : '🎶', 1, 0.6, 0.3);
      }
    }
    this.fireworks.update(dt);
    if (this.stage === 'collect' || this.stage === 'returnTofol' || this.stage === 'findMarc') this.playTime += dt;

    const pp = this.player.root.position;
    this.walker.turn(this.input.consumeCam());
    const locked = this.busy || ending || close0 || this.stage === 'barDance';
    const ax = locked ? { x: 0, y: 0 } : this.input.axes();
    this.walker.canJump = !locked;
    // Obstáculos redondos: el público y los ases (dos círculos a lo largo del cuerpo)
    this.solids.length = this.world.people.length;
    let k = this.solids.length;
    for (const s of this.donkeys) {
      const r = s.d.root;
      const fx = Math.sin(r.rotation.y);
      const fz = Math.cos(r.rotation.y);
      for (const o of [0.55, -0.5]) this.solids[k++] = { x: r.position.x + fx * o, z: r.position.z + fz * o, r: 0.5 };
    }
    const move = this.walker.move(dt, ax, this.world.colliders, this.world.bounds, this.solids);
    if (this.walker.bump) audio.knock(Math.min(0.45, this.walker.bump * 0.07), 200, 0.07); // choque sordo contra alguien
    this.stepCups(dt);
    this.invuln -= dt;
    this.player.root.rotation.y = this.walker.facing;
    this.player.root.visible = this.invuln <= 0 || Math.floor(this.invuln * 10) % 2 === 0;

    if (ending || this.stage === 'barDance' || this.stage === 'pairDance') animatePerson(this.player, dt, 'dance', 0, this.t * 8);
    else if (this.stage === 'meet' || this.stage === 'eyes' || this.stage === 'kiss' || this.stage === 'kissing') animatePerson(this.player, dt, 'idle');
    else animatePerson(this.player, dt, move > 0.03 ? 'walk' : 'idle', move, this.walker.walk, this.walker);
    // Con una pomada en la mano, el brazo va un poco adelantado
    const carrying = this.pomadaCount > 0 && (this.stage === 'collect' || this.stage === 'returnTofol' || this.stage === 'findMarc');
    this.inHand.visible = carrying;
    if (carrying && !ending) this.player.armR.rotation.x = -0.7 + this.player.armR.rotation.x * 0.3;

    const dT = pp.distanceTo(this.world.tofolPos);
    if (this.stage === 'findMarc' && this.gasMovesLeft > 0 && !this.busy && pp.distanceTo(this.world.marcPos) < 6) this.moveGas();
    const dM = pp.distanceTo(this.world.marcPos);
    animatePerson(this.tofol, dt, dT < 5 && !ending ? 'wave' : 'idle');
    if (dT < 8) this.tofol.root.rotation.y = Math.atan2(pp.x - this.world.tofolPos.x, pp.z - this.world.tofolPos.z);
    // Marc baila hasta que va a hablar con Carme; luego, en el final, bailáis los tres
    if (this.marcTo) {
      const d = this.v1.subVectors(this.marcTo, this.marc.root.position).setY(0);
      const len = d.length();
      if (len > 0.08) {
        steerTo(this.marc.root, this.marcSteer, this.marcTo.x, this.marcTo.z, 2.2, dt);
        animatePerson(this.marc, dt, 'walk');
      } else {
        this.marcSteer.vx = this.marcSteer.vz = 0;
        this.marcTo = null;
        this.meetMarc();
      }
    } else if (this.stage === 'meet') animatePerson(this.marc, dt, 'talk');
    else if (this.stage === 'eyes' || this.stage === 'kiss' || this.stage === 'kissing') animatePerson(this.marc, dt, 'idle');
    else animatePerson(this.marc, dt, 'dance', 0, this.t * 8 + 1);
    if (this.carmeTo) {
      const cp = this.carme.root.position, d = this.v2.subVectors(this.carmeTo, cp).setY(0), l = d.length();
      if (l > 0.05) {
        steerTo(this.carme.root, this.carmeSteer, this.carmeTo.x, this.carmeTo.z, 1.4, dt);
        animatePerson(this.carme, dt, 'walk');
      } else {
        const m = this.v2.copy(this.player.root.position).lerp(this.marc.root.position, 0.5);
        this.carme.root.rotation.y = Math.atan2(m.x - cp.x, m.z - cp.z);
        animatePerson(this.carme, dt, this.stage === 'ending' ? 'dance' : 'idle', 0, this.t * 7);
      }
    } else animatePerson(this.carme, dt, this.stage === 'meet' ? 'talk' : 'dance', 0, this.t * 7);
    if (this.together && !this.marcTo && (this.stage === 'talkTofol' || this.stage === 'collect' || this.stage === 'returnTofol')) {
      // Gas la sigue a un paso
      const mp = this.marc.root.position;
      const dx = pp.x - mp.x, dz = pp.z - mp.z, d = Math.hypot(dx, dz);
      if (d > 1.5) {
        const step = Math.min(d - 1.5, dt * 5.2);
        mp.x += (dx / d) * step;
        mp.z += (dz / d) * step;
      }
      this.marc.root.rotation.y = Math.atan2(dx, dz);
      animatePerson(this.marc, dt, d > 1.55 ? 'walk' : 'idle', d > 1.55 ? 0.9 : 0);
      if (this.marcBox) Object.assign(this.marcBox, { minX: -999, maxX: -998, minZ: -999, maxZ: -998 });
    }
    if (this.stage === 'kissing') this.updateKiss(dt);
    // Bailan juntos un rato, cara a cara, y luego llega el beso
    if (this.stage === 'pairDance') {
      this.pairT += dt;
      if (this.pairT > 6.5) {
        this.faceToFace();
        this.stage = 'kiss';
        this.updateHud();
      }
    }
    if (this.stage === 'barDance') {
      this.barT += dt;
      animatePerson(this.player, dt, 'dance', 0, this.t * 8);
      if (this.barT > 2.6 && !this.marcTo && this.barT - dt <= 2.6) {
        // Marc se acerca a saludar a Carme
        const c = this.world.marcPos;
        this.marcTo = this.v2.subVectors(this.player.root.position, c).setY(0).normalize().multiplyScalar(-0.2).add(c).add(new THREE.Vector3(0.9, 0, 0.7)).clone();
      }
    }
    animatePerson(this.fabiolera, dt, 'talk');
    if (this.fabiolera.rig) {
      // Brazos de verdad (más largos que los del muñeco): codo doblado para llevar el fabiol a la boca
      this.fabiolera.armR.rotation.set(-0.55, 0, -0.35);
      this.fabiolera.elbowR.rotation.set(-1.6, 0, 0.5);
      this.fabiolera.armL.rotation.set(-0.35, 0, -0.15);
      this.fabiolera.elbowL.rotation.set(-0.9 - Math.abs(Math.sin(this.t * 9)) * 0.45, 0, 0);
    } else {
      this.fabiolera.armR.rotation.set(-1.9, 0, 0.5); // fabiol a la boca
      this.fabiolera.armL.rotation.set(-0.6 + Math.abs(Math.sin(this.t * 9)) * 0.5, 0, -0.2); // baqueta
    }

    const rearingNear = this.updateDonkeys(dt);

    // Pomadas
    if (this.stage === 'collect') {
      for (const p of this.pomadas) {
        if (p.taken) continue;
        p.mesh.visible = true;
        p.mesh.rotation.y += dt * 2;
        p.mesh.position.y = p.home.y + Math.sin(this.t * 3) * 0.08;
        this.v1.copy(p.home).setY(0);
        if (this.v1.distanceTo(this.v2.copy(pp).setY(0)) < 1.9) {
          p.taken = true;
          p.mesh.visible = false;
          this.pomadaCount++;
          audio.pickup();
          vibrate(20);
          toast(this.T.hints.pomada);
          this.fx.burst(this.v1.copy(p.home), '✨', 8);
          this.checkCollectDone();
        }
      }
    }

    // Acción contextual
    this.pendingAction = null;
    let label: string | null = null;
    let pulse = false;
    if (!this.busy && !ending) {
      if (this.stage === 'collect' && rearingNear) {
        label = this.T.hints.rear;
        pulse = true;
        const s = rearingNear;
        this.pendingAction = () => this.touchDonkey(s);
      } else if (this.stage === 'kiss') {
        label = '💋 Darle un beso';
        pulse = true;
        this.pendingAction = () => this.startKiss();
      } else if (dT < 3.5) {
        label = 'Hablar';
        this.pendingAction = () => this.talkTofol();
      } else if (this.V.findFirst && this.stage === 'findMarc' && this.gasMovesLeft <= 0 && dM < 3.5) {
        label = '📍 Aquí!';
        pulse = true;
        this.pendingAction = () => this.foundGas();
      } else if (dM < 3.5 && this.stage === 'findMarc' && !this.V.findFirst) {
        label = this.V.hud.give;
        pulse = true;
        this.pendingAction = () => this.startBarDance();
      } else if (dM < 3.5 && this.stage !== 'barDance' && this.stage !== 'meet' && this.stage !== 'eyes' && this.stage !== 'pairDance' && this.stage !== 'kissing') {
        label = 'Hablar';
        this.pendingAction = () => {
          this.busy = true;
          dialogue(this.T.carme, () => (this.busy = false));
        };
      }
    }
    this.hud.setAction(label, pulse);
    if (this.input.consumeAction() && this.pendingAction) this.pendingAction();

    // Marcador de objetivo
    const tgt = this.target();
    this.marker.visible = !!tgt && !this.busy;
    if (tgt) {
      this.marker.position.set(tgt.x, (tgt.y > 0.5 ? tgt.y + 1.0 : 3.9) + Math.sin(this.t * 3) * 0.18, tgt.z);
      this.marker.rotation.y += dt * 2;
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 3 ? null : -rel);
    } else this.hud.setArrow(null);

    // Final: la pareja baila, confeti y la cámara gira alrededor
    if (this.stage === 'ending') {
      this.endingT += dt;
      // Se sueltan poco a poco y se ponen a bailar
      if (this.kiss) {
        this.kiss.k = Math.max(0, 1 - this.endingT / 0.7);
        if (this.kiss.k === 0) {
          this.kiss.stop();
          this.kiss = null;
        }
      }
      this.walker.yaw += dt * 0.5;
      if (Math.random() < dt * 6) this.fx.burst(this.v1.copy(pp).lerp(this.world.marcPos, 0.5).setY(2.4), '❤️', 2, 1.5);
      if (Math.random() < dt * 1.8) this.fireworks.burst(this.v2.set(-14 + Math.random() * 28, 20 + Math.random() * 8, 34 + Math.random() * 10));
      if (this.endingT > 8) {
        this.stage = 'done';
        this.confetti.active = false;
        audio.ambience(0);
        const stars = 1 + (this.hits <= 2 ? 1 : 0) + (this.perfects >= 2 ? 1 : 0);
        // Esa misma tarde, a las 19:46, le escribe ella
        const insta = this.V.meetScene?.insta;
        const chats = (f: () => void) => phoneChat(this.V.endChats ?? [CHATS.ferreriesTarde, CHATS.atesoro], () => (this.V.afterEnd ? this.V.afterEnd(f) : f()));
        const finish = (f: () => void) => (insta ? dialogue(insta, () => chats(f)) : chats(f));
        finish(() =>
          this.onComplete({
            stars,
            stats: [
              ['Caricias perfectas', `${this.perfects}/3`],
              [this.V.statHits, `${this.hits}`],
              ['Tiempo', clock(this.playTime)],
            ],
          }),
        );
      }
    }
    if (this.confetti.mesh.visible) this.confetti.update(dt, this.world.marcPos, this.t);

    const intro = this.stage === 'intro';
    const close = this.stage === 'meet' || this.stage === 'pairDance' || this.stage === 'kiss' || this.stage === 'kissing';
    if (this.stage === 'pairDance') this.walker.yaw += dt * 0.35; // la cámara les da la vuelta mientras bailan
    if (this.stage === 'eyes') {
      // (la mueve eyesCamera al principio del fotograma)
    } else if (this.stage === 'kiss' || this.stage === 'kissing') this.kissCamera(dt);
    else this.walker.camera(this.camera, intro ? dt * 0.35 : dt, this.world.colliders, close ? 3.6 : ending ? 6.5 : intro ? 11 : 7.5, close ? 2.3 : ending ? 4.2 : intro ? 6 : 3.8);
    this.world.sun.follow(pp);
    this.world.sky.update(this.camera, dt);
  }

  /** Sant Joan: Gas no encuentra la ubicación y se va a otro rincón de la plaza. */
  private moveGas() {
    const moves = this.T.gasMoves ?? [];
    const i = moves.length - this.gasMovesLeft;
    this.gasMovesLeft--;
    toast(moves[i]);
    audio.whoosh();
    const c = this.world.plazaCenter;
    const spots = [new THREE.Vector3(c.x - 9, 0, c.z - 6), new THREE.Vector3(c.x + 9, 0, c.z + 2)];
    const mp = this.world.marcPos;
    this.fx.burst(this.v1.copy(mp).setY(2.2), '📍', 4, 1.5, 0.6);
    mp.copy(spots[i % spots.length]);
    this.marc.root.position.copy(mp);
    this.marc.root.rotation.y = Math.atan2(c.x - mp.x, c.z - mp.z);
    if (this.marcBox) Object.assign(this.marcBox, { minX: mp.x - 0.35, maxX: mp.x + 0.35, minZ: mp.z - 0.35, maxZ: mp.z + 0.35 });
  }

  private checkCollectDone() {
    if (this.pomadaCount >= 3 && this.luckCount >= 3) {
      this.stage = 'returnTofol';
      this.pomadas.forEach((p) => (p.mesh.visible = false));
      this.donkeys.forEach((d) => (d.ring.visible = false));
      audio.fanfare();
    }
    this.updateHud();
  }

  private talkTofol() {
    this.busy = true;
    this.input.reset();
    const done = (next?: Stage) => () => {
      this.busy = false;
      if (next) this.stage = next;
      this.updateHud();
    };
    if (this.stage === 'talkTofol') dialogue(this.T.tofolQuest, done('collect'));
    else if (this.stage === 'collect') dialogue(this.T.tofolNotYet, done());
    else if (this.stage === 'returnTofol')
      dialogue(this.T.tofolDone, this.V.findFirst ? () => { this.busy = false; this.faceToFace(); this.stage = 'kiss'; this.updateHud(); } : done('findMarc'));
    else dialogue(this.T.tofolAgain, done());
  }

  /** En el bar: bailas con Carme hasta que Marc se acerca a saludarla. */
  private startBarDance() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.stage = 'barDance';
    this.barT = 0;
    const pp = this.player.root.position;
    const c = this.world.marcPos;
    this.walker.facing = Math.atan2(c.x - pp.x, c.z - pp.z);
    this.carme.root.rotation.y = Math.atan2(pp.x - c.x, pp.z - c.z);
    this.updateHud();
  }

  /** Marc habla con Carme y aprovecha para presentarse. */
  private meetMarc() {
    this.stage = 'meet';
    const pp = this.player.root.position;
    const mp = this.marc.root.position;
    this.marc.root.rotation.y = Math.atan2(pp.x - mp.x, pp.z - mp.z);
    this.walker.facing = Math.atan2(mp.x - pp.x, mp.z - pp.z);
    this.walker.yaw = this.walker.facing - Math.PI / 2;
    this.updateHud();
    const M = this.V.meetScene;
    const toDance = () => {
      this.busy = false;
      this.faceToFace();
      // Carme se aparta discretamente al otro lado para no tapar la escena
      const dir = this.v1.subVectors(pp, mp).setY(0).normalize();
      const mid = this.v2.copy(pp).lerp(mp, 0.5);
      this.carmeTo = new THREE.Vector3(mid.x - dir.z * 2.2 + dir.x * 0.6, 0, mid.z + dir.x * 2.2 + dir.z * 0.6);
      this.stage = M ? 'pairDance' : 'kiss';
      this.pairT = 0;
      this.updateHud();
    };
    if (!M) {
      dialogue([...this.T.marcMeet, ...this.T.smallTalk], toDance);
      return;
    }
    // Se presenta; ella se gira, él le ve los ojos y todo va a cámara lenta; luego, la charla
    dialogue(this.T.marcMeet, () => {
      this.stage = 'eyes';
      this.eyesT = 0;
      this.updateHud();
      audio.ambience(0.008);
      dialogue(M.eyes, () => {
        this.stage = 'meet';
        audio.ambience(0.03);
        this.updateHud();
        dialogue([...M.name, ...this.T.smallTalk, ...M.dance], toDance);
      });
    });
  }

  /** Se acercan: cara a cara, a un palmo, y la cámara de lado. */
  private faceToFace() {
    const pp = this.player.root.position;
    const mp = this.marc.root.position;
    const dir = this.v1.subVectors(pp, mp).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
    dir.normalize();
    pp.copy(mp).addScaledVector(dir, 0.95);
    this.walker.knock.set(0, 0, 0);
    this.walker.facing = Math.atan2(-dir.x, -dir.z);
    this.walker.yaw = this.walker.facing - Math.PI / 2;
    this.marc.root.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /** Capítulo 9: por fin le encuentras; a partir de aquí va contigo. */
  private foundGas() {
    this.busy = true;
    this.input.reset();
    this.walker.stop();
    this.hud.setAction(null);
    const pp = this.player.root.position;
    const mp = this.marc.root.position;
    this.marc.root.rotation.y = Math.atan2(pp.x - mp.x, pp.z - mp.z);
    this.walker.facing = Math.atan2(mp.x - pp.x, mp.z - pp.z);
    hugFor(this.player, this.marc, 3);
    dialogue([...this.T.marcMeet, ...this.T.smallTalk], () =>
      phoneChat(this.V.findFirst!.found, () => {
        this.together = true;
        this.busy = false;
        this.stage = 'talkTofol';
        this.updateHud();
      }),
    );
  }

  /** La primera mirada: desde detrás del hombro de Marc, la cámara se acerca despacio a los ojos de ella. */
  /** Gente con pistolas de agua de colores, en el corro de la plaça y por la calle. */
  private buildShooters() {
    const c = this.world.plazaCenter;
    const spots: [number, number][] = [
      [c.x + Math.cos(0.4) * 7.6, c.z + Math.sin(0.4) * 6.6],
      [c.x + Math.cos(2.3) * 7.6, c.z + Math.sin(2.3) * 6.6],
      [c.x + Math.cos(3.6) * 7.6, c.z + Math.sin(3.6) * 6.6],
      [c.x + Math.cos(5.3) * 7.6, c.z + Math.sin(5.3) * 6.6],
      [-30, 1.6],
      [-15, -2.4],
      [20, 2.2],
    ];
    const looks: PersonLook[] = [
      { skin: 0xf0c8a6, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x5a3a22, hairStyle: 'long', shorts: true },
      { skin: 0xd9a27c, shirt: 0x1b998b, pants: 0x222222, hair: 0x2b1d14, hairStyle: 'short', male: true, shorts: true },
      { skin: 0xe8b894, shirt: 0xf4d35e, pants: 0x6b4a2b, hair: 0x111111, hairStyle: 'pony', shorts: true },
      { skin: 0xf0c8a6, shirt: 0xd7263d, pants: 0x3b4a6b, hair: 0x8a5a2a, hairStyle: 'short', male: true, shorts: true },
    ];
    const gunCols = [0xff7a1a, 0x2bc4ff, 0x7ed321, 0xff3fa4, 0xffd21a];
    spots.forEach(([x, z], i) => {
      const p = makePerson(looks[i % looks.length]);
      p.root.position.set(x, 0, z);
      const yaw = Math.atan2(c.x - x, c.z - z);
      p.root.rotation.y = yaw;
      this.scene.add(p.root);
      const col = gunCols[i % gunCols.length];
      const plastic = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: 0.35 });
      const gun = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.24), plastic);
      body.position.z = 0.06;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.05), plastic);
      grip.position.set(0, -0.07, -0.01);
      grip.rotation.x = -0.25;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color(0xbfe8ff), roughness: 0.1, transparent: true, opacity: 0.6 }));
      tank.rotation.x = Math.PI / 2;
      tank.position.set(0, 0.07, 0.04);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color(0xffffff), roughness: 0.4 }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.22;
      gun.add(body, grip, tank, barrel);
      gun.traverse((o) => (o.castShadow = true));
      this.scene.add(gun);
      this.shooters.push({ p, gun, yaw, aim: yaw, fireT: 0.5 + i * 0.6, turnT: 1 + Math.random() * 2 });
      this.world.people.push({ x, z, r: 0.35 });
    });
  }

  private updateShooters(dt: number) {
    const fire = this.stage !== 'eyes' && this.stage !== 'ending' && this.stage !== 'done';
    const pp = this.player.root.position;
    for (const s of this.shooters) {
      const r = s.p.root;
      // Van girándose: apuntan a otro lado del corro de vez en cuando
      if ((s.turnT -= dt) < 0) {
        s.turnT = 2 + Math.random() * 3;
        s.aim = s.yaw + (Math.random() - 0.5) * 2.2;
      }
      r.rotation.y += (s.aim - r.rotation.y) * Math.min(1, dt * 2);
      animatePerson(s.p, dt, 'idle');
      if (s.p.rig) s.p.rig.force = { armR: 1 };
      s.p.armR.rotation.set(-1.35, 0, 0.12);
      s.p.elbowR.rotation.x = -0.15;
      // La pistola va en la mano, apuntando hacia donde mira (y un poco arriba)
      const hand = s.p.rig?.bones.get('LeftHand'); // el brazo «R» del muñeco es la mano izquierda del modelo
      if (hand) hand.getWorldPosition(this.v1);
      else this.v1.set(r.position.x, 1.35, r.position.z);
      const pitch = 0.22;
      s.gun.position.copy(this.v1);
      s.gun.rotation.set(-pitch, r.rotation.y, 0, 'YXZ');
      if (!fire || Math.hypot(r.position.x - pp.x, r.position.z - pp.z) > 22) continue;
      if ((s.fireT -= dt) < 0) {
        s.fireT = 1.6 + Math.random() * 2.4;
        const dir = this.v2.set(Math.sin(r.rotation.y) * Math.cos(pitch), Math.sin(pitch), Math.cos(r.rotation.y) * Math.cos(pitch));
        const muzzle = this.v1.addScaledVector(dir, 0.28);
        this.fx.jet(muzzle, dir, 16, 7);
        if (Math.random() < 0.5) {
          const d2 = dir.clone();
          later(() => this.fx.jet(s.gun.position.clone().addScaledVector(d2, 0.28), d2, 12, 7), 250);
        }
      }
    }
  }

  /** Ambiente del jaleo: confeti y purpurina siempre alrededor; de vez en cuando alguien dispara su pistola de agua o tira un puñado de confeti. */
  private jaleoFx(dt: number) {
    const pp = this.player.root.position;
    this.airConfetti.update(dt, pp, this.t);
    this.glitter.update(dt, pp, this.t);
    if (this.stage === 'eyes' || this.stage === 'ending' || this.stage === 'done') return;
    const pick = () => {
      const c = this.world.crowds[Math.floor(Math.random() * this.world.crowds.length)];
      const b = c.base[Math.floor(Math.random() * c.base.length)] as { x: number; z: number; ox?: number; oz?: number };
      const x = b.x + (b.ox ?? 0), z = b.z + (b.oz ?? 0);
      return Math.hypot(x - pp.x, z - pp.z) < 13 ? this.v2.set(x, 0, z) : null;
    };
    if ((this.tossT -= dt) < 0) {
      this.tossT = 1.2 + Math.random() * 2;
      const at = pick();
      if (at) this.airConfetti.toss(at.setY(2.4), 18);
    }
  }

  private eyesCamera(dt: number) {
    const head = this.player.rig?.bones.get('Head');
    const eye = head ? head.getWorldPosition(this.v2) : this.v2.copy(this.player.root.position).setY(1.55);
    eye.y += 0.06;
    const mp = this.marc.root.position;
    const dx = eye.x - mp.x, dz = eye.z - mp.z, l = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, this.eyesT / 3);
    const back = THREE.MathUtils.lerp(1.3, 0.45, k * k * (3 - 2 * k));
    const target = this.v1.set(eye.x - (dx / l) * back + (dz / l) * 0.18, eye.y + 0.02, eye.z - (dz / l) * back - (dx / l) * 0.18);
    this.camera.position.lerp(target, Math.min(1, dt * 4));
    this.camera.lookAt(eye);
  }

  /** Plano de perfil de la pareja, que se acerca poco a poco durante el beso. */
  private kissCamera(dt: number) {
    const pp = this.player.root.position, mp = this.marc.root.position;
    const mid = this.v1.copy(pp).lerp(mp, 0.5);
    const dx = mp.x - pp.x, dz = mp.z - pp.z, l = Math.hypot(dx, dz) || 1;
    const dist = this.stage === 'kissing' ? 3.4 - Math.min(1, this.kissT / 2) * 0.9 : 3.4;
    const target = this.v2.set(mid.x - (dz / l) * dist, 1.75, mid.z + (dx / l) * dist);
    this.camera.position.lerp(target, Math.min(1, dt * 3));
    this.camera.lookAt(mid.x, 1.45, mid.z);
  }

  private startKiss() {
    this.stage = 'kissing';
    this.kissT = 0;
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    audio.stopMusic();
    audio.ambience(0.015);
  }

  /** El beso: se acercan, ella le rodea el cuello, él la coge de la cintura; corazones y fuegos artificiales. */
  private updateKiss(dt: number) {
    this.kissT += dt;
    this.kiss ??= embrace(this.player, this.marc, 'kiss');
    this.kiss.k = Math.min(1, this.kissT / 1.3);
    for (const p of [this.player, this.marc]) p.eyes.scale.y = this.kissT > 1 ? 0.15 : 1; // ojos cerrados
    if (this.kissT > 1.2 && this.kissT - dt <= 1.2) {
      const mid = this.v1.copy(this.player.root.position).lerp(this.marc.root.position, 0.5).setY(2.5);
      this.fx.burst(mid, '❤️', 14, 3, 1.2);
      this.fx.burst(mid, '💋', 3, 1, 0.8);
      audio.fanfare();
      audio.cheer(0.7);
      vibrate([60, 40, 120]);
      for (let i = 0; i < 3; i++) this.fireworks.burst(this.v2.set(-12 + i * 12, 22 + Math.random() * 5, 38));
    }
    if (this.kissT > 3.8) {
      for (const p of [this.player, this.marc]) p.eyes.scale.y = 1;
      this.busy = false;
      this.stage = 'ending';
      this.endingT = 0;
      this.confetti.mesh.visible = true;
      this.confetti.active = true;
      audio.startMusic();
      audio.ambience(0.04);
      audio.cheer(0.6);
      this.updateHud();
    }
  }

  debug(): DebugItem[] {
    const tp = (x: number, z: number) => {
      this.player.root.position.set(x, 0, z);
      this.walker.knock.set(0, 0, 0);
    };
    const go = (stage: Stage, setup?: () => void) => () => {
      this.busy = false;
      this.input.reset();
      setup?.();
      this.stage = stage;
      if (stage !== 'collect') this.pomadas.forEach((p) => (p.mesh.visible = false));
      this.updateHud();
    };
    return [
      { label: `1 · Hablar con ${this.V.guide}`, run: go('talkTofol', () => tp(9, 9.6)) },
      {
        label: '2 · Pomadas y ases',
        run: go('collect', () => {
          this.pomadaCount = this.luckCount = this.perfects = this.hits = 0;
          this.pomadas.forEach((p) => (p.taken = false));
          this.donkeys.forEach((d) => (d.touched = false));
          tp(0, 6);
        }),
      },
      { label: `3 · Volver a ${this.V.guide}`, run: go('returnTofol', () => { this.pomadaCount = this.luckCount = 3; tp(9, 9.6); }) },
      { label: '4 · Ir al bar', run: go('findMarc', () => tp(this.world.marcPos.x + 2.2, this.world.marcPos.z - 1.4)) },
      {
        label: '5 · Ver el final',
        run: () => {
          go('findMarc', () => tp(this.world.marcPos.x + 2.2, this.world.marcPos.z - 1.4))();
          this.startBarDance();
        },
      },
      {
        label: '✓ Completar capítulo',
        run: () => {
          this.stage = 'done';
          this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] });
        },
      },
    ];
  }

  dispose() {
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.scene.traverse(disposeObj);
  }
}
