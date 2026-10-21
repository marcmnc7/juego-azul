import * as THREE from 'three';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Walker, type Circle } from '../core/walker';
import { Sky, Sun, Fireworks, Confetti, glowTexture, toon, vibrate } from '../core/gfx';
import { SANTJOAN, type Line } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makePerson, makeDonkey, animatePerson, personGeometry, vertexMat, type Person, type Donkey, type PersonLook } from '../entities/models';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, Hud, DebugItem } from '../ui/ui';
import { canvasTex } from './deco';
import type { Box2 } from './ferreries';
import { clock, type Level, type LevelDone } from './level';

// Capítulo 5 (el último) · Sant Joan en Ciutadella, 23 de junio de 2026.
// Ciutadella de verdad: el Born con el obelisco, el Ajuntament almenado, Correus, Ses Voltes con sus
// arcos blancos y la Plaça Espanya. Gas no sabe dónde está y te va mandando ubicaciones que cambian:
// Plaça Espanya → Correus → el obelisco → «Dime exacto pls». Entonces le mandas la tuya y viene él.
// Por el camino, jaleo: caballos negros que se ponen de manos (tocarlos arriba da suerte) y avellanes.

type Phase = 'intro' | 'hunt' | 'exact' | 'coming' | 'meet' | 'ending' | 'done';

const TXT = SANTJOAN as unknown as Record<string, unknown>;
const txt = <T,>(k: string, d: T): T => (TXT[k] as T | undefined) ?? d;
const T_INTRO = () =>
  txt<Line[]>('huntIntro', [
    { who: 'Narrador', text: 'Ciutadella, 23 de junio. Sant Joan. Banderas, caballos negros, avellanes volando y el Born a reventar.' },
    { who: 'Narrador', text: 'Gas lleva tu camiseta. Todo el día. Y lleva treinta minutos dando vueltas por el pueblo sin encontrarte.' },
    { who: 'Narrador', text: 'Te va mandando su ubicación. Síguela… aunque con él nunca se sabe.' },
  ]);
const T_PINS = () => txt<string[]>('pins', ['📍 Gas: «Estoy en la Plaça Espanya»', '📍 Gas: «Ahora al lado de Correos. Creo»', '📍 Gas: «Por el Born. Al lado del obelisco»', '📍 Gas: «Llevo 30’ dando vueltas. Dime exacto pls»']);
const T_PIN_HINT = () => txt<string>('pinHint', 'Sigue el último pin de Gas en el mapa 📍');
const T_MOVED = () => txt<string[]>('gasMoves', ['Gas: «Aceptame la UBI… que ya no estoy aquí» 📍', 'Gas: «Estoy al lado de Correos. Creo» 📍']);
const T_EXACT_HINT = () => txt<string>('exactHint', 'Mándale tu ubicación exacta 📍');
const T_SENT = () => txt<string>('sentLoc', '📍 «Obelisco. Lado del Ajuntament. No te muevas»');
const T_ALL_PINS = ['Plaça Espanya', 'Correus', 'Obelisc des Born'];

// Plano (metros): el Born en el origen, Ses Voltes hacia el este y la Plaça Espanya al final
const BORN = { minX: -18, maxX: 18, minZ: -13, maxZ: 13 };
const STREET = { minX: 18, maxX: 70, minZ: -4.4, maxZ: 4.4 };
const ESPANYA = { minX: 70, maxX: 90, minZ: -12, maxZ: 12 };
const PINS = [new THREE.Vector3(81, 0, 3), new THREE.Vector3(5, 0, -11.2), new THREE.Vector3(0, 0, 3.2)];
const REACH = 6;
const AISLES: [number, number][] = [[19, 0], [5.5, -14], [-4, 14], [-19, 7]];
/** Distancia de (x, z) al segmento que va del obelisco a (ax, az). */
function segDist(x: number, z: number, ax: number, az: number) {
  const t = Math.max(0, Math.min(1, (x * ax + z * az) / (ax * ax + az * az)));
  return Math.hypot(x - ax * t, z - az * t);
}
const HORSE_R = 7.6;
const WARN = 0.8;
const REAR = 1.8;
const TOUCH_R = 3.2;

interface Horse {
  d: Donkey;
  angle: number;
  warnT: number;
  rearT: number;
  nextRear: number;
  walk: number;
  alert: THREE.Sprite;
  touched: boolean;
}

let alertTex: THREE.Texture | null = null;
function alertTexture() {
  if (alertTex) return alertTex;
  alertTex = canvasTex((ctx) => {
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
  }, 128, 128);
  return alertTex;
}

const LOOKS: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x2b1d14, hairStyle: 'short' },
  { skin: 0xd9a27c, shirt: 0xffffff, pants: 0x222222, hair: 0x5a3a22, hairStyle: 'long', skirt: true },
  { skin: 0xf0c8a6, shirt: 0x1f5fbf, pants: 0xf2efe6, hair: 0xb07a3a, hairStyle: 'cap' },
  { skin: 0xc98e64, shirt: 0xd7263d, pants: 0x3b4a6b, hair: 0x111111, hairStyle: 'bun' },
  { skin: 0xe2b08c, shirt: 0xffffff, pants: 0x2a2a2a, hair: 0x3a2414, hairStyle: 'pony' },
];

export class LevelSantJoan implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private fireworks = new Fireworks();
  private confetti: Confetti | null = null;
  private phase: Phase = 'intro';
  private player: Person;
  private walker: Walker;
  private gas: Person;
  private gasWalk = { walk: 0 };
  private horses: Horse[] = [];
  private colliders: Box2[] = [];
  private people: Circle[] = [];
  private crowds: { mesh: THREE.InstancedMesh; base: { x: number; z: number; ry: number; ph: number }[] }[] = [];
  private bags: { obj: THREE.Object3D; taken: boolean }[] = [];
  private bagCount = 0;
  private luck = 0;
  private hits = 0;
  private invuln = 0;
  private pin = 0;
  private reached = 0;
  private pinPos = new THREE.Vector3();
  private pinObj: THREE.Group;
  private map: HTMLCanvasElement;
  private mapT = 0;
  private sky: Sky;
  private sun: Sun;
  private busy = true;
  private t = 0;
  private playTime = 0;
  private endT = 0;
  private v1 = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private bounds: Box2 = { minX: BORN.minX + 0.5, maxX: ESPANYA.maxX - 0.5, minZ: BORN.minZ + 0.5, maxZ: BORN.maxZ - 0.5 };

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x2a2a52, 45, 170);
    // Atardecer de junio que se va haciendo de noche
    this.sky = new Sky({ top: 0x141a4a, mid: 0x5a3f78, bottom: 0xf09a6a, stars: 500 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xb7a8ff, 0x5a4636, 1.35));
    this.sun = new Sun(sc, 0xffc59a, 1.2, new THREE.Vector3(-0.6, 0.6, 0.5), 24);

    this.buildTown();
    this.buildCrowd();
    this.buildHorses();
    this.buildBags();
    this.fx = new Particles(sc);
    sc.add(this.fireworks.points);

    this.player = makePerson(MARGAUX_LOOK);
    this.player.root.position.set(40, 0, 0.5);
    sc.add(this.player.root);
    this.walker = new Walker(this.player.root.position);
    this.walker.yaw = this.walker.facing = Math.PI / 2;

    // Gas, con la camiseta de Azul (blanca con el azul de ella)
    this.gas = makePerson({ ...MARC_LOOK, shirt: MARGAUX_LOOK.shirt });
    this.gas.root.visible = false;
    sc.add(this.gas.root);

    // Pin de ubicación flotando sobre donde dice Gas que está
    this.pinObj = new THREE.Group();
    const pm = toon({ color: 0xe53935, emissive: 0x7a0f0f });
    this.pinObj.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12), pm), new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 16).rotateX(Math.PI).translate(0, -0.65, 0), pm));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.z = 0.4;
    this.pinObj.add(dot);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff6b6b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(4);
    this.pinObj.add(halo);
    this.pinObj.visible = false;
    sc.add(this.pinObj);

    this.map = document.createElement('canvas');
    this.map.width = 260;
    this.map.height = 74;
    this.map.style.cssText = 'position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 74px);width:200px;height:57px;border-radius:12px;background:rgba(20,18,40,.72);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;z-index:4;display:none';
    document.body.append(this.map);

    this.hud = hud(() => this.input.queueAction(), onMenu);
    this.camera.position.set(34, 4, 0);
    this.updateHud();
    audio.startMusic('jaleo');
    audio.ambience(0.15);
    setTimeout(() => {
      if (this.phase !== 'intro') return;
      dialogue(T_INTRO(), () => {
        if (this.phase !== 'intro') return;
        this.busy = false;
        this.phase = 'hunt';
        this.setPin(0);
      });
    }, 900);
  }

  get threeScene() {
    return this.scene;
  }

  // ---------------- Ciutadella ----------------

  private block(m: Merger, x0: number, x1: number, z0: number, z1: number, h: number, color: number, collide = true) {
    m.add(G.box, color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0, h, z1 - z0);
    m.add(G.box, 0xcdbb98, (x0 + x1) / 2, h + 0.12, (z0 + z1) / 2, 0, 0, 0, x1 - x0 + 0.2, 0.24, z1 - z0 + 0.2);
    if (collide) this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  }

  /** Ventanas con persianas verdes menorquinas y balcones en la cara que da a la calle. */
  private facade(m: Merger, x0: number, x1: number, z: number, face: 1 | -1, floors: number, alongX = true) {
    const len = Math.abs(x1 - x0);
    const n = Math.max(1, Math.floor(len / 3));
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        const a = Math.min(x0, x1) + (i + 0.5) * (len / n);
        const y = 1.6 + f * 3.1 + (f > 0 ? 0.6 : 0);
        const off = face * 0.06;
        if (alongX) {
          m.add(G.box, f === 0 ? 0x5a3a26 : 0x2f6b4f, a, y, z + off, 0, 0, 0, 1.1, f === 0 ? 2.4 : 1.7, 0.08);
          if (f > 0 && i % 2 === 0) m.add(G.box, 0x2a2a2a, a, y - 0.95, z + face * 0.4, 0, 0, 0, 1.6, 0.08, 0.8);
        } else {
          m.add(G.box, f === 0 ? 0x5a3a26 : 0x2f6b4f, z + off, y, a, 0, 0, 0, 0.08, f === 0 ? 2.4 : 1.7, 1.1);
          if (f > 0 && i % 2 === 0) m.add(G.box, 0x2a2a2a, z + face * 0.4, y - 0.95, a, 0, 0, 0, 0.8, 0.08, 1.6);
        }
      }
    }
  }

  private sign(text: string, x: number, y: number, z: number, ry: number, w = 3.2, bg = '#f4efe2', fg = '#2a1a2e') {
    const tex = canvasTex(
      (ctx, cw, ch) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = fg;
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, cw - 16, ch - 16);
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let size = 84;
        do ctx.font = `bold ${size}px Georgia, serif`;
        while (ctx.measureText(text).width > cw - 60 && (size -= 4) > 20);
        ctx.fillText(text, cw / 2, ch / 2 + 4);
      },
      512,
      128,
    );
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), new THREE.MeshBasicMaterial({ map: tex }));
    s.position.set(x, y, z);
    s.rotation.y = ry;
    this.scene.add(s);
  }

  private buildTown() {
    const sc = this.scene;
    // Suelo de losas de marès
    const stone = canvasTex((ctx, w, h) => {
      ctx.fillStyle = '#cdbb98';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const v = 180 + Math.random() * 40;
          ctx.fillStyle = `rgb(${v},${v - 14},${v - 40})`;
          ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
        }
    });
    stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    stone.repeat.set(60, 20);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 90).rotateX(-Math.PI / 2), toon({ map: stone, roughness: 0.9 }));
    ground.position.x = 35;
    ground.userData.noCast = true;
    sc.add(ground);

    const m = new Merger();
    const SAND = 0xe6d2a8;
    const OCHRE = 0xd8b483;
    const WHITE = 0xf4f0e6;

    // Obelisco del Born (homenaje a 1558), con su verja
    m.add(G.box, 0xbfae8c, 0, 0.5, 0, 0, 0, 0, 2.6, 1, 2.6);
    m.add(G.box, 0xcfbf9c, 0, 1.4, 0, 0, 0, 0, 1.8, 0.8, 1.8);
    m.add(new THREE.CylinderGeometry(0.35, 0.65, 1, 4), 0xd9c9a6, 0, 5.6, 0, 0, Math.PI / 4, 0, 1, 7.6, 1);
    m.add(new THREE.ConeGeometry(0.5, 1, 4), 0xd9c9a6, 0, 9.8, 0, 0, Math.PI / 4, 0, 0.75, 0.9, 0.75);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      m.add(G.cyl, 0x222222, Math.cos(a) * 2.2, 0.55, Math.sin(a) * 2.2, 0, 0, 0, 0.06, 1.1, 0.06);
    }
    this.colliders.push({ minX: -2.3, maxX: 2.3, minZ: -2.3, maxZ: 2.3 });

    // Norte: el Ajuntament, almenado, con su gran portal
    this.block(m, -14, 8, 13.5, 22, 11, OCHRE);
    for (let x = -13.6; x <= 7.6; x += 1.2) m.add(G.box, OCHRE, x, 11.6, 13.7, 0, 0, 0, 0.7, 1.2, 0.5);
    m.add(G.box, 0x4a3020, -3, 2.2, 13.45, 0, 0, 0, 3, 4.4, 0.1);
    m.add(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16, 1, false, 0, Math.PI), 0x4a3020, -3, 4.4, 13.45, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1);
    this.facade(m, -14, 8, 13.5, -1, 3);
    this.block(m, 8, 18, 13.5, 20, 9, SAND);
    this.facade(m, 8, 18, 13.5, -1, 2);
    // Oeste: los palacios (Salort, Torresaura) mirando al Born
    this.block(m, -26, -18.5, -13, 0, 12, SAND);
    this.block(m, -26, -18.5, 0, 13.5, 13, 0xe9dcbc);
    this.facade(m, -13, 0, -18.5, 1, 3, false);
    this.facade(m, 0, 13.5, -18.5, 1, 3, false);
    // Sur: casas con Correus
    this.block(m, -18, -6, -21, -13.5, 9, 0xeee3c8);
    this.block(m, -6, 10, -21, -13.5, 10, 0xf1d9a0);
    this.block(m, 10, 18.5, -21, -13.5, 9, SAND);
    this.facade(m, -18, -6, -13.5, -1 as 1 | -1, 2);
    this.facade(m, -6, 10, -13.5, -1 as 1 | -1, 2);
    this.facade(m, 10, 18.5, -13.5, -1 as 1 | -1, 2);
    // Este: dos manzanas y entre ellas la entrada a Ses Voltes
    this.block(m, 18.5, 30, -13.5, STREET.minZ - 0.2, 10, 0xeee3c8);
    this.block(m, 18.5, 30, STREET.maxZ + 0.2, 13.5, 10, SAND);
    this.facade(m, -13.5, STREET.minZ, 18.5, -1, 2, false);
    this.facade(m, STREET.maxZ, 13.5, 18.5, -1, 2, false);

    // Ses Voltes: calle de arcos blancos a los dos lados
    for (const side of [-1, 1] as const) {
      const wallZ = side * (STREET.maxZ + 0.2);
      this.block(m, 30, STREET.maxX, side < 0 ? wallZ - 8 : wallZ, side < 0 ? wallZ : wallZ + 8, 8, WHITE);
      const pz = side * 2.9;
      for (let x = 31.2; x < STREET.maxX - 0.5; x += 2.6) {
        m.add(G.box, WHITE, x, 1.6, pz, 0, 0, 0, 0.5, 3.2, 0.5);
        this.colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: pz - 0.25, maxZ: pz + 0.25 });
        // Arco entre pilar y pilar
        m.add(new THREE.TorusGeometry(1.05, 0.22, 6, 12, Math.PI), WHITE, x + 1.3, 3.15, pz, 0, 0, 0, 1, 0.8, 1.2);
      }
      m.add(G.box, WHITE, (30 + STREET.maxX) / 2, 4.3, side * 3.6, 0, 0, 0, STREET.maxX - 30, 1.2, 1.9);
      this.facade(m, 31, STREET.maxX - 1, wallZ, (-side) as 1 | -1, 2);
    }
    // Plaça Espanya: árboles, bancos y casas alrededor
    this.block(m, ESPANYA.maxX, ESPANYA.maxX + 8, -14, 14, 9, SAND);
    this.block(m, STREET.maxX, ESPANYA.maxX, ESPANYA.maxZ, ESPANYA.maxZ + 7, 9, 0xeee3c8);
    this.block(m, STREET.maxX, ESPANYA.maxX, ESPANYA.minZ - 7, ESPANYA.minZ, 9, WHITE);
    this.block(m, STREET.maxX - 0.01, STREET.maxX + 0.01, STREET.maxZ + 0.2, ESPANYA.maxZ, 9, WHITE);
    this.block(m, STREET.maxX - 0.01, STREET.maxX + 0.01, ESPANYA.minZ, STREET.minZ - 0.2, 9, WHITE);
    this.facade(m, STREET.maxX, ESPANYA.maxX, ESPANYA.maxZ, -1, 2);
    this.facade(m, STREET.maxX, ESPANYA.maxX, ESPANYA.minZ, 1, 2);
    for (const [x, z] of [[74, -8], [74, 8], [86, -8], [86, 8], [80, -9.5], [80, 9.5]]) {
      m.add(G.cyl, 0x6b5a40, x, 1.5, z, 0, 0, 0, 0.35, 3, 0.35);
      m.add(G.sphere, 0x2f6b3a, x, 4, z, 0, 0, 0, 3.6, 2.8, 3.6);
      this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
    for (const [x, z, ry] of [[77, -6, 0], [83, 6, 0], [77, 6, 0], [83, -6, 0]]) {
      m.add(G.box, 0x6b4a2e, x, 0.45, z, 0, ry, 0, 1.8, 0.1, 0.5);
      m.add(G.box, 0x333333, x, 0.22, z, 0, ry, 0, 1.6, 0.44, 0.1);
    }
    sc.add(m.mesh());

    // Rótulos de verdad
    this.sign('AJUNTAMENT', -3, 7.2, 13.4, Math.PI, 5);
    this.sign('CORREUS', 2, 3.6, -13.4, 0, 3.6, '#f6c700', '#1f3f8f');
    this.sign('Plaça des Born', 17.9, 3, -6, -Math.PI / 2, 3.2);
    this.sign('Ses Voltes', 30.4, 4.4, 0, -Math.PI / 2, 3);
    this.sign('Plaça Espanya', 70.6, 3, -6.5, -Math.PI / 2, 3.4);
    this.sign('Bar Imperi', -18.4, 3.1, 6, Math.PI / 2, 3);
    this.sign('Maramao', 40, 3.6, 4.55, Math.PI, 2.6);

    // Banderas de fiesta cruzando el Born y Ses Voltes
    const flags = new Merger();
    const flagGeo = new THREE.ConeGeometry(0.28, 0.6, 3).rotateZ(Math.PI);
    const colors = [0xd7263d, 0xffffff, 0x1f5fbf, 0xf4d35e];
    for (const [ax, az, bx, bz, h] of [[-14, 13, -14, -13, 7], [-6, 13, -6, -13, 7], [6, 13, 6, -13, 7], [14, 13, 14, -13, 7], [-18, 6, 18, 6, 7.5], [-18, -6, 18, -6, 7.5], [24, 4.4, 24, -4.4, 5.5], [36, 4.4, 36, -4.4, 5.5], [48, 4.4, 48, -4.4, 5.5], [60, 4.4, 60, -4.4, 5.5]]) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.floor(len / 0.8);
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const sag = Math.sin(k * Math.PI) * 1.2;
        flags.add(flagGeo, colors[i % colors.length], ax + (bx - ax) * k, h - sag, az + (bz - az) * k, 0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0, 1, 1, 0.15);
      }
    }
    const fm = flags.mesh();
    fm.userData.noCast = true;
    sc.add(fm);

    // Farolas: luces cálidas
    const lamp = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const [x, z] of [[-17.3, -8], [-17.3, 8], [17.3, -10], [17.3, 10], [-10, 12.8], [8, -12.8], [40, 3.9], [55, -3.9], [72, 0], [88, 0]]) {
      const s = new THREE.Sprite(lamp);
      s.position.set(x, 4.2, z);
      s.scale.setScalar(2.2);
      sc.add(s);
    }
    for (const [x, z] of [[0, 9], [-9, -7], [45, 0], [80, 0]]) {
      const l = new THREE.PointLight(0xffb070, 18, 20, 1.6);
      l.position.set(x, 6, z);
      sc.add(l);
    }
  }

  /** El jaleo: gente alrededor del círculo de los caballos y algo en Ses Voltes y la Plaça Espanya. */
  private buildCrowd() {
    const pts: { x: number; z: number }[] = [];
    const ok = (x: number, z: number) => !pts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.95) && !PINS.some((p) => Math.hypot(p.x - x, p.z - z) < 2.5);
    for (let i = 0; i < 9000 && pts.length < 170; i++) {
      const x = BORN.minX + 1 + Math.random() * (BORN.maxX - BORN.minX - 2);
      const z = BORN.minZ + 1 + Math.random() * (BORN.maxZ - BORN.minZ - 2);
      const r = Math.hypot(x, z);
      if (r < HORSE_R + 2.2 || r > 15.5) continue;
      // Pasillos entre la gente: hacia Ses Voltes, Correus, el Ajuntament y los palacios
      if (AISLES.some(([ax, az]) => segDist(x, z, ax, az) < 1.5)) continue;
      if (ok(x, z)) pts.push({ x, z });
    }
    for (let i = 0; i < 4000 && pts.length < 215; i++) {
      const x = 32 + Math.random() * 56;
      const z = x < 70 ? (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 0.6) : -10 + Math.random() * 20;
      if (ok(x, z)) pts.push({ x, z });
    }
    LOOKS.forEach((lk, li) => {
      const mine = pts.filter((_, i) => i % LOOKS.length === li);
      const mesh = new THREE.InstancedMesh(personGeometry(lk, li % 2 === 0), vertexMat(), mine.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
      // Miran hacia el centro del Born (o hacia la calle)
      this.crowds.push({ mesh, base: mine.map((p) => ({ ...p, ry: p.x < 20 ? Math.atan2(-p.x, -p.z) : Math.random() * 6, ph: Math.random() * 6 })) });
    });
    this.people = pts.map((p) => ({ x: p.x, z: p.z, r: 0.33 }));
  }

  /** Caballos negros con sus caixers dando vueltas al obelisco. */
  private buildHorses() {
    for (let i = 0; i < 4; i++) {
      const d = makeDonkey(0x15110f);
      // Orejas de caballo: más cortas que las del ase
      d.head.scale.set(1, 0.85, 1.1);
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false }));
      alert.position.set(0, 3.6, 0);
      alert.visible = false;
      d.root.add(alert);
      this.scene.add(d.root);
      this.horses.push({ d, angle: (i / 4) * Math.PI * 2, warnT: 0, rearT: 0, nextRear: 2 + i * 1.7, walk: 0, alert, touched: false });
    }
  }

  /** Bolsitas de avellanes repartidas por el recorrido. */
  private buildBags() {
    const geo = new Merger().add(G.sphere, 0xc8a26a, 0, 0.22, 0, 0, 0, 0, 0.45, 0.42, 0.45).add(G.cyl, 0xd7263d, 0, 0.44, 0, 0, 0, 0, 0.2, 0.08, 0.2).build();
    for (const [x, z] of [[50, 2], [62, -2], [84, -4], [76, 9], [25, -2], [-12, -10], [12, 10.5], [-15, 2]]) {
      const o = new THREE.Mesh(geo, vertexMat());
      o.position.set(x, 0, z);
      this.scene.add(o);
      this.bags.push({ obj: o, taken: false });
    }
  }

  // ---------------- Ubicaciones ----------------

  private setPin(i: number) {
    this.pin = i;
    const lines = T_PINS();
    toast(lines[Math.min(i, lines.length - 1)]);
    audio.pop();
    vibrate(20);
    if (i < PINS.length) {
      this.pinPos.copy(PINS[i]);
      this.pinObj.visible = true;
    } else {
      this.pinObj.visible = false;
      this.phase = 'exact';
    }
    this.map.style.display = 'block';
    this.updateHud();
  }

  private reachedPin() {
    const moved = T_MOVED();
    const next = this.pin + 1;
    this.reached++;
    this.pinObj.visible = false;
    if (next < PINS.length) {
      // Ya no está: se ha ido a otro sitio
      toast(moved[this.pin % moved.length]);
      setTimeout(() => this.phase === 'hunt' && this.setPin(next), 1900);
    } else this.setPin(next);
    this.updateHud();
  }

  private sendLocation() {
    this.phase = 'coming';
    toast(T_SENT());
    audio.luck();
    vibrate(25);
    // Gas aparece entre la gente del Born y viene hacia ella
    const pp = this.player.root.position;
    const a = Math.atan2(pp.z, pp.x) + Math.PI * 0.7;
    this.gas.root.visible = true;
    this.gas.root.position.set(THREE.MathUtils.clamp(pp.x + Math.cos(a) * 11, BORN.minX + 1, BORN.maxX - 1), 0, THREE.MathUtils.clamp(pp.z + Math.sin(a) * 11, BORN.minZ + 1, BORN.maxZ - 1));
    this.updateHud();
  }

  private drawMap() {
    const c = this.map.getContext('2d')!;
    const W = this.map.width;
    const H = this.map.height;
    const sx = (x: number) => ((x + 22) / 116) * W;
    const sz = (z: number) => ((z + 16) / 32) * H;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (const r of [BORN, STREET, ESPANYA]) c.fillRect(sx(r.minX), sz(r.minZ), sx(r.maxX) - sx(r.minX), sz(r.maxZ) - sz(r.minZ));
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.arc(sx(0), sz(0), 2.5, 0, Math.PI * 2);
    c.fill();
    c.font = '600 10px Fredoka, sans-serif';
    c.fillText('Born', sx(-15), sz(-9));
    c.fillText('Ses Voltes', sx(36), sz(-6));
    c.fillText('Pl. Espanya', sx(71), sz(-8));
    if (this.pinObj.visible) {
      const px = sx(this.pinPos.x);
      const pz = sz(this.pinPos.z);
      c.fillStyle = '#ff4d4d';
      c.beginPath();
      c.arc(px, pz - 6, 5, 0, Math.PI * 2);
      c.moveTo(px - 4, pz - 4);
      c.lineTo(px, pz + 2);
      c.lineTo(px + 4, pz - 4);
      c.fill();
    }
    if (this.gas.root.visible) {
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(sx(this.gas.root.position.x), sz(this.gas.root.position.z), 4, 0, Math.PI * 2);
      c.fill();
    }
    const pp = this.player.root.position;
    c.fillStyle = '#4fc3ff';
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx(pp.x), sz(pp.z), 4.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // ---------------- Bucle ----------------

  private updateHud() {
    const h = this.hud;
    h.setCounters(`<span class="chip">📍 ${this.reached}/3</span><span class="chip">🌰 ${this.bagCount}</span><span class="chip">🐎 ${this.luck}</span>`);
    if (this.phase === 'hunt') h.setObjective(`${T_PIN_HINT()} · ${T_ALL_PINS[Math.min(2, this.pin)]}`);
    else if (this.phase === 'exact') h.setObjective(T_EXACT_HINT());
    else if (this.phase === 'coming') h.setObjective('Gas viene hacia ti: búscalo con tu camiseta');
    else if (this.phase === 'intro') h.setObjective('Ciutadella, Sant Joan');
    else h.setObjective('💙 Feliz cumpleaños 💙');
  }

  private target(): THREE.Vector3 | null {
    if (this.phase === 'hunt' && this.pinObj.visible) return this.pinPos;
    if (this.phase === 'coming') return this.gas.root.position;
    return null;
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.fireworks.update(dt);
    this.confetti?.update(dt, this.player.root.position, this.t);
    if (this.phase !== 'intro' && this.phase !== 'ending' && this.phase !== 'done') this.playTime += dt;
    this.invuln -= dt;
    const pp = this.player.root.position;

    // Gente saltando; más cuando un caballo se pone de manos
    const rearing = this.horses.some((h) => h.rearT > 0);
    const energy = this.phase === 'ending' ? 0.45 : rearing ? 0.3 : 0.12;
    for (const c of this.crowds) {
      c.base.forEach((b, i) => {
        const y = Math.abs(Math.sin(this.t * 4 + b.ph)) * energy;
        this.tmpQ.setFromAxisAngle(this.up, b.ry);
        c.mesh.setMatrixAt(i, this.tmpM.compose(this.v1.set(b.x, y, b.z), this.tmpQ, this.one));
      });
      c.mesh.instanceMatrix.needsUpdate = true;
    }
    const rearNear = this.updateHorses(dt);

    // Azul
    const walking = !this.busy && (this.phase === 'hunt' || this.phase === 'exact' || this.phase === 'coming');
    this.walker.turn(this.input.consumeCam());
    const mag = this.walker.move(dt, walking ? this.input.axes() : { x: 0, y: 0 }, this.colliders, this.bounds, this.people);
    this.player.root.rotation.y = this.walker.facing;
    if (this.phase === 'ending' || this.phase === 'done') animatePerson(this.player, dt, 'dance', 0, this.t * 6);
    else if (this.phase === 'meet') animatePerson(this.player, dt, 'talk');
    else animatePerson(this.player, dt, mag > 0.03 ? 'walk' : 'idle', mag, this.walker.walk, this.walker);

    // Gas
    if (this.gas.root.visible) {
      const g = this.gas.root.position;
      if (this.phase === 'coming') {
        const d = g.distanceTo(pp);
        if (d > 1.3) {
          const k = Math.min(d - 1.2, 2.2 * dt);
          g.x += ((pp.x - g.x) / d) * k;
          g.z += ((pp.z - g.z) / d) * k;
          this.gas.root.rotation.y = Math.atan2(pp.x - g.x, pp.z - g.z);
          this.gasWalk.walk += k / 0.53;
          animatePerson(this.gas, dt, 'walk', 0.4, this.gasWalk.walk);
          if (Math.random() < dt * 1.2) this.fx.burst(this.v1.copy(g).setY(2.4), '👋', 1, 0.4, 0.6);
        } else this.meet();
      } else if (this.phase === 'ending' || this.phase === 'done') animatePerson(this.gas, dt, 'dance', 0, this.t * 6 + 1);
      else animatePerson(this.gas, dt, 'talk');
    }

    // Pin flotando, que se mueve un poco (Gas no para quieto)
    if (this.pinObj.visible) {
      const base = PINS[Math.min(2, this.pin)];
      this.pinPos.set(base.x + Math.sin(this.t * 0.6) * 1.5, 0, base.z + Math.cos(this.t * 0.45) * 1.2);
      this.pinObj.position.set(this.pinPos.x, 3.4 + Math.sin(this.t * 3) * 0.2, this.pinPos.z);
      this.pinObj.rotation.y += dt * 1.5;
      if (this.phase === 'hunt' && !this.busy && Math.hypot(pp.x - this.pinPos.x, pp.z - this.pinPos.z) < REACH) this.reachedPin();
    }

    // Avellanes
    for (const b of this.bags) {
      if (b.taken) continue;
      b.obj.rotation.y += dt * 2;
      b.obj.position.y = 0.1 + Math.abs(Math.sin(this.t * 2 + b.obj.position.x)) * 0.15;
      if (Math.hypot(b.obj.position.x - pp.x, b.obj.position.z - pp.z) < 1) {
        b.taken = true;
        b.obj.visible = false;
        this.bagCount++;
        audio.pickup();
        toast(SANTJOAN.hints.pomada);
        this.fx.burst(this.v1.copy(b.obj.position).setY(1), '🌰', 5, 1.4);
        this.updateHud();
      }
    }

    // Acción contextual
    let label: string | null = null;
    let action: (() => void) | null = null;
    if (walking && rearNear) {
      label = SANTJOAN.hints.rear;
      action = () => this.touchHorse(rearNear);
    } else if (!this.busy && this.phase === 'exact') {
      label = '📍 Mandar ubicación';
      action = () => this.sendLocation();
    }
    this.hud.setAction(label, !!label);
    if (this.input.consumeAction() && action) action();

    const tgt = this.target();
    if (tgt) {
      const ang = Math.atan2(tgt.x - pp.x, tgt.z - pp.z);
      const rel = Math.atan2(Math.sin(ang - this.walker.yaw), Math.cos(ang - this.walker.yaw));
      this.hud.setArrow(pp.distanceTo(tgt) < 4 ? null : -rel);
    } else this.hud.setArrow(null);

    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 1 / 12;
      this.drawMap();
    }

    if (this.phase === 'ending') {
      this.endT += dt;
      if (Math.random() < dt * 1.8) this.fireworks.burst(new THREE.Vector3(-25 + Math.random() * 50, 24 + Math.random() * 10, 30 + Math.random() * 20));
      if (Math.random() < dt * 3) this.fx.burst(pp.clone().lerp(this.gas.root.position, 0.5).setY(2.4), '❤️', 1, 1.2);
    }

    if (this.phase === 'ending' || this.phase === 'done') {
      // Plano de los dos bailando con el obelisco y los caballos detrás
      const mid = this.v1.copy(pp).lerp(this.gas.root.position, 0.5);
      const a = this.t * 0.15;
      this.camera.position.lerp(new THREE.Vector3(mid.x + Math.sin(a) * 6, 2.8, mid.z + Math.cos(a) * 6), 1 - Math.exp(-dt * 2));
      this.camera.lookAt(mid.x, 1.6, mid.z);
    } else this.walker.camera(this.camera, dt, this.colliders);
    this.sun.follow(pp);
    this.sky.update(this.camera, dt);
  }

  private updateHorses(dt: number) {
    const pp = this.player.root.position;
    let near: Horse | null = null;
    let nearest = Infinity;
    for (const s of this.horses) {
      const r = s.d.root;
      const dist = r.position.distanceTo(pp);
      if (s.rearT > 0) {
        const before = s.rearT;
        s.rearT -= dt;
        const k = Math.sin(Math.min(1, 1 - s.rearT / REAR) * Math.PI);
        s.d.pivot.rotation.x = -k * 0.85;
        s.d.legs[0].rotation.x = s.d.legs[1].rotation.x = -k * 1.2 + Math.sin(this.t * 16) * 0.35 * k;
        s.d.head.rotation.x = -k * 0.4;
        if (before > 0.3 && s.rearT <= 0.3) {
          r.localToWorld(this.v1.set(0, 0.1, 0.9));
          this.fx.burst(this.v1, 'dust', 6, 1.6, 0.4);
          if (dist < 8) this.walker.shake(0.18);
        }
        if (s.rearT <= 0) {
          s.d.pivot.rotation.x = 0;
          s.nextRear = 3 + Math.random() * 4;
          s.touched = false;
        }
      } else if (s.warnT > 0) {
        s.warnT -= dt;
        s.alert.visible = true;
        s.alert.scale.setScalar(0.9 + Math.abs(Math.sin(this.t * 12)) * 0.25);
        s.d.head.rotation.y = Math.sin(this.t * 25) * 0.25;
        if (s.warnT <= 0) {
          s.alert.visible = false;
          s.d.head.rotation.y = 0;
          s.rearT = REAR;
          if (dist < 14) {
            audio.whoosh();
            audio.cheer(0.25);
          }
        }
      } else {
        s.angle += dt * 0.28;
        r.position.set(Math.cos(s.angle) * HORSE_R, 0, Math.sin(s.angle) * HORSE_R);
        r.rotation.y = -s.angle;
        s.walk += dt * 7;
        const w = Math.sin(s.walk) * 0.5;
        s.d.legs[0].rotation.x = s.d.legs[3].rotation.x = w;
        s.d.legs[1].rotation.x = s.d.legs[2].rotation.x = -w;
        s.d.pivot.rotation.x = Math.sin(s.walk * 2) * 0.015;
        s.nextRear -= dt;
        if (s.nextRear <= 0 && this.phase !== 'intro') {
          s.warnT = WARN;
          if (dist < 12) audio.warn();
        }
      }
      if (!s.touched && s.rearT > 0.2 && dist < TOUCH_R && dist < nearest && this.phase !== 'ending') {
        near = s;
        nearest = dist;
      }
      // Choque: el caballo te aparta (si no está de manos)
      if (s.rearT <= 0 && dist < 1.4 && this.invuln <= 0 && !this.busy) {
        this.v1.subVectors(pp, r.position).setY(0).normalize().multiplyScalar(10);
        this.walker.knock.copy(this.v1);
        this.walker.shake(0.4);
        this.invuln = 1.5;
        this.hits++;
        audio.hit();
        vibrate(80);
        toast(SANTJOAN.hints.dropped.replace('se te han caído las avellanes', 'cuidado'));
      }
    }
    return near;
  }

  private touchHorse(s: Horse) {
    const k = Math.sin(Math.min(1, 1 - s.rearT / REAR) * Math.PI);
    s.touched = true;
    this.luck++;
    const at = this.v1.copy(s.d.root.position).setY(2.4);
    if (k > 0.85) {
      audio.perfect();
      toast(SANTJOAN.hints.perfect);
      this.fx.burst(at, '✨', 10, 3.5, 1.4);
      vibrate([20, 30, 20]);
    } else {
      audio.luck();
      toast(k < 0.4 ? SANTJOAN.hints.late : SANTJOAN.hints.luck);
      vibrate(25);
    }
    this.updateHud();
  }

  private meet() {
    this.phase = 'meet';
    this.busy = true;
    this.input.reset();
    this.hud.setAction(null);
    const pp = this.player.root.position;
    const g = this.gas.root.position;
    this.walker.facing = Math.atan2(g.x - pp.x, g.z - pp.z);
    this.gas.root.rotation.y = Math.atan2(pp.x - g.x, pp.z - g.z);
    this.updateHud();
    dialogue(SANTJOAN.marcMeet, () => this.finish());
  }

  private finish() {
    this.phase = 'ending';
    this.endT = 0;
    this.map.style.display = 'none';
    this.confetti = new Confetti(180, 12, 9);
    this.scene.add(this.confetti.mesh);
    audio.fanfare();
    audio.cheer(0.6);
    this.horses.forEach((h, i) => {
      h.warnT = 0;
      h.rearT = REAR + i * 0.2;
    });
    this.updateHud();
    setTimeout(() => {
      if (this.phase !== 'ending') return;
      dialogue(SANTJOAN.afterKiss, () => {
        setTimeout(() => {
          if (this.phase !== 'ending') return;
          this.phase = 'done';
          audio.ambience(0);
          const stars = 1 + (this.bagCount >= 5 ? 1 : 0) + (this.luck >= 2 ? 1 : 0);
          this.onComplete({
            stars,
            stats: [
              ['Ubicaciones seguidas', '3 + la tuya 📍'],
              ['Avellanes', `${this.bagCount}/${this.bags.length} 🌰`],
              ['Toques a los caballos', `${this.luck} 🐎`],
              ['Tiempo dando vueltas', clock(this.playTime)],
            ],
          });
        }, 2000);
      });
    }, 2500);
  }

  debug(): DebugItem[] {
    const tp = (x: number, z: number, yaw = 0) => {
      this.busy = false;
      this.input.reset();
      this.player.root.position.set(x, 0, z);
      this.walker.stop();
      this.walker.yaw = this.walker.facing = yaw;
    };
    return [
      { label: '1 · Plaça Espanya', run: () => { this.phase = 'hunt'; this.setPin(0); tp(66, 0, Math.PI / 2); } },
      { label: '2 · Correus', run: () => { this.phase = 'hunt'; this.setPin(1); tp(12, 0, -Math.PI / 2); } },
      { label: '3 · Obelisco', run: () => { this.phase = 'hunt'; this.setPin(2); tp(12, -6, -Math.PI / 2); } },
      { label: '4 · Mandar ubicación', run: () => { this.reached = 3; this.setPin(3); tp(1, 4.5, Math.PI); } },
      { label: '5 · Final', run: () => { tp(1, 4.5); this.gas.root.visible = true; this.gas.root.position.set(2, 0, 5.5); this.meet(); } },
      { label: '✓ Completar capítulo', run: () => { this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.map.remove();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
