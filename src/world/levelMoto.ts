import { StoneSkip } from './sideGames';
import * as THREE from 'three';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Sky, Sun, toon, glowTexture, vibrate, makeSea } from '../core/gfx';
import { Surf } from '../core/surfaces';
import { MOTO } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makeMoto, makeCar, makePerson, type Person, type PersonLook } from '../entities/models';
import { canvasTex } from './deco';
import { boneAnchor, boneLevel, leanTorso, rigPost } from '../entities/rig';
import { twoBone } from '../entities/embrace';
import { makeHelmet } from '../entities/helmet';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { packBag } from '../ui/minis';
import { disposeScene, type Level, type LevelDone } from './level';

// Capítulo 5 · MotoTrip4life (Costa Brava, 30 de abril – 4 de mayo de 2026).
// Bucle: el plan (chat) → la mochila con la lista real de Gas → de paquete por la carretera de la costa
// hacia Cap de Creus: Gas conduce y tú acompañas las curvas inclinándote con él, saludas a las motos que
// vienen de frente (a los coches no) y en tres miradores sacas la foto → el último tramo hasta el faro
// está cortado: media vuelta → cena y helado → el chat del lunes al devolver la moto.

type Phase = 'intro' | 'pack' | 'ride' | 'creus' | 'done';

const SPEED = 14;
const ROAD_W = 8.4;
const SAMPLES = 420;
const PHOTO_AT = [0.27, 0.55, 0.8];
const PHOTO_WIN = 0.035;
/** Donde la carretera está cortada: el último tramo hasta el faro estaba cerrado. */
const CLOSED_AT = 0.95;
/** Dónde sopla la tramontana (metros de ruta desde la salida los pone el nivel). */
const WIND_AT = 0.58;
const WIND_SECS = 13;
// Lo que viene de frente por el otro carril (dónde os cruzáis): a las motos se las saluda, a los coches no
const ONCOMING: [number, 'moto' | 'car'][] = [[0.1, 'moto'], [0.17, 'car'], [0.36, 'moto'], [0.43, 'car'], [0.49, 'moto'], [0.63, 'car'], [0.7, 'moto'], [0.88, 'moto']];
const ONCOMING_V = 12;
const RIDERS: PersonLook[] = [
  { skin: 0xe2b08c, shirt: 0x1b1b22, pants: 0x2a3550, hair: 0x2b1d14, hairStyle: 'short', male: true },
  { skin: 0xf0c8a6, shirt: 0x8a2a2a, pants: 0x1b1b22, hair: 0x6a4a2a, hairStyle: 'short', male: true },
];
const DRIVERS: PersonLook[] = [
  { skin: 0xe8b894, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x5a3a22, hairStyle: 'short', male: true },
  { skin: 0xf0c8a6, shirt: 0x2e86ab, pants: 0x222222, hair: 0xb07a3a, hairStyle: 'long' },
];

interface Oncoming {
  kind: 'moto' | 'car';
  root: THREE.Object3D;
  wheels: THREE.Object3D[];
  rider: Person | null;
  s: number;
  live: boolean;
  /** Ya le has saludado (o lo has intentado, si era un coche). */
  greeted: boolean;
  passed: boolean;
  /** El de la moto de enfrente saluda: segundos que le quedan con la mano fuera. */
  waveT: number;
  waved: boolean;
  k: number;
}

// Carretera de la costa: el mar queda a la derecha de la moto
const PTS: [number, number][] = [
  [0, -20], [0, 0], [6, 60], [-10, 120], [4, 185], [28, 240], [20, 300], [-6, 350], [-4, 420], [22, 480], [40, 540], [30, 600], [10, 650], [18, 720], [40, 770], [52, 800],
];

export class LevelMoto implements Level {
  private scene = new THREE.Scene();
  private hud: Hud;
  private fx: Particles;
  private sky: Sky;
  private sun: Sun;
  private phase: Phase = 'intro';
  private curve: THREE.CatmullRomCurve3;
  private len: number;
  private moto = makeMoto(0xb02a2a, MARC_LOOK);
  private azul: Person;
  private s = 0.02;
  private speed = 0;
  private lean = 0;
  private azulLean = 0;
  private good = 0;
  private total = 0;
  private wobbleT = 0;
  private photos = 0;
  private photoTaken = PHOTO_AT.map(() => false);
  private oncoming: Oncoming[] = [];
  private nextEv = 0;
  private waves = 0;
  private motosMet = 0;
  private wrongWaves = 0;
  private azulWaveT = 0;
  private azulWaveK = 0;
  private flash: THREE.Sprite;
  private lighthouse = new THREE.Vector3();
  private t = 0;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private onComplete: LevelDone,
    onMenu: () => void,
  ) {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0xf2c99a, 70, 330);
    const sunDir = new THREE.Vector3(-0.6, 0.35, 0.7);
    this.sky = new Sky({ top: 0x3d6fb8, mid: 0xf0b483, bottom: 0xf7dcb0, sun: { color: 0xffd9a0, dir: sunDir, size: 90 }, clouds: { count: 9, tint: 0xfff0e0 } });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0xcfe0ff, 0x6a5a40, 1.1));
    this.sun = new Sun(sc, 0xffe2b8, 2.1, sunDir, 24);

    this.curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    this.len = this.curve.getLength();
    this.buildCoast();
    this.fx = new Particles(sc);

    // Azul de paquete, abrazada a Gas, con casco blanco
    this.azul = makePerson(MARGAUX_LOOK);
    const a = this.azul;
    a.root.position.set(0, 0.5, -0.88);
    a.legL.rotation.x = a.legR.rotation.x = -1.15;
    a.kneeL.rotation.x = a.kneeR.rotation.x = 1.45;
    a.legL.rotation.z = -0.2;
    a.legR.rotation.z = 0.2;
    a.armL.rotation.x = a.armR.rotation.x = -1.25;
    a.armL.rotation.z = 0.35;
    a.armR.rotation.z = -0.35;
    a.body.rotation.x = 0.2;
    if (a.rig) {
      // Personaje glTF: sentada de verdad (piernas, brazos y cadera mandan las articulaciones),
      // abrazada a la cintura de Gas, y casco blanco pegado a la cabeza
      a.rig.force = { body: 1, legL: 1, legR: 1, armL: 1, armR: 1 };
      a.root.position.set(0, 0.96 - a.rig.hipsHeight, -0.86); // cadera 7 cm sobre el asiento (a 0,86 se hundía en él)
      // Pies en las estriberas de atrás: sin esto la pierna colgaba y el escape se le metía por la pantorrilla
      a.legL.rotation.set(-1.6, 0, -0.48);
      a.legR.rotation.set(-1.6, 0, 0.48);
      a.kneeL.rotation.x = a.kneeR.rotation.x = 2.09;
      a.footL.rotation.x = a.footR.rotation.x = -0.77;
      a.armL.rotation.set(-1.2, 0, 0.55);
      a.armR.rotation.set(-1.2, 0, -0.55);
      a.elbowL.rotation.x = a.elbowR.rotation.x = -0.55;
      a.body.rotation.x = 0.28;
      // Casco integral blanco con la franja azul; algo más grande que el de Gas: le tapa también la melena
      const helmet = makeHelmet({ color: 0xf4f4f4, stripe: 0x3a8fd8 });
      helmet.position.set(0, 0.12, -0.02);
      helmet.scale.set(1.22, 1.22, 1.36);
      boneAnchor(a, 'Head').add(helmet);
      this.hugGas();
    } else {
      const helmet = makeHelmet({ color: 0xf4f4f4, stripe: 0x3a8fd8 });
      helmet.position.set(0, 0.3, -0.02);
      helmet.scale.setScalar(2.25);
      a.head.add(helmet);
    }
    this.moto.root.add(a.root);
    this.moto.root.rotation.order = 'YXZ';
    sc.add(this.moto.root);
    this.placeMoto(0);
    this.buildTraffic();
    this.buildClosure();

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.flash.scale.setScalar(6);
    sc.add(this.flash);

    this.hud = hud(() => this.input.queueAction(), onMenu, 'Arrastra a izquierda o derecha para inclinarte con Gas');
    this.updateHud();
    const p = this.moto.root.position;
    this.camera.position.set(p.x + 6, 3, p.z + 7);
    this.camLook.copy(p).setY(1);
    later(() => {
      if (this.phase !== 'intro') return;
      dialogue(MOTO.intro, () => phoneChat(CHATS.motoPlan, () => dialogue(MOTO.packIntro, () => phoneChat(CHATS.mochila, () => this.startPack()))));
    }, 2300);
    audio.startMusic('road');
  }

  get threeScene() {
    return this.stones ? this.stones.scene : this.scene;
  }

  // ---------------- Construcción ----------------

  private buildCoast() {
    const sc = this.scene;
    const pos: number[] = [];
    const col: number[] = [];
    const road: number[] = [];
    const rcol: number[] = [];
    // Perfil transversal (de la montaña al mar): distancia al centro de la carretera, altura y color
    const prof: [number, number, number][] = [
      [-70, 16, 0x6f7d45], [-26, 5, 0x7f8c4c], [-8, 0.6, 0x8d9356], [-4.2, 0.02, 0xa79a74],
      [4.2, 0.02, 0xa79a74], [6, -0.2, 0xb59a72], [9, -4.5, 0x9a7f62], [15, -8, 0x7a6450],
    ];
    const c = new THREE.Color();
    const centre = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const ring = (i: number) => {
      const u = i / SAMPLES;
      this.curve.getPointAt(u, centre);
      this.curve.getTangentAt(u, tan);
      const rx = -tan.z;
      const rz = tan.x;
      return { x: centre.x, z: centre.z, rx, rz };
    };
    let prev = ring(0);
    for (let i = 1; i <= SAMPLES; i++) {
      const cur = ring(i);
      for (let j = 0; j < prof.length - 1; j++) {
        if (j === 3) continue; // la carretera va aparte
        const q = (r: typeof cur, k: number) => [r.x + r.rx * prof[k][0], prof[k][1], r.z + r.rz * prof[k][0]];
        const a = q(prev, j), b = q(prev, j + 1), cc = q(cur, j + 1), d = q(cur, j);
        pos.push(...a, ...d, ...b, ...b, ...d, ...cc);
        for (const k of [j, j, j + 1, j + 1, j, j + 1]) {
          c.set(prof[k][2]);
          col.push(c.r, c.g, c.b);
        }
      }
      // Asfalto con línea discontinua en el centro
      const h = ROAD_W / 2;
      const q = (r: typeof cur, o: number) => [r.x + r.rx * o, 0.05, r.z + r.rz * o];
      const dash = Math.floor(i / 3) % 2 === 0;
      for (const [o0, o1, colr] of [[-h, -0.12, 0x55555a], [-0.12, 0.12, dash ? 0xf0ead8 : 0x55555a], [0.12, h, 0x55555a]] as [number, number, number][]) {
        const a = q(prev, o0), b = q(prev, o1), cc = q(cur, o1), d = q(cur, o0);
        road.push(...a, ...d, ...b, ...b, ...d, ...cc);
        c.set(colr);
        for (let k = 0; k < 6; k++) rcol.push(c.r, c.g, c.b);
      }
      prev = cur;
    }
    const mk = (p: number[], cl: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
      g.computeVertexNormals();
      return g;
    };
    const land = new THREE.Mesh(mk(pos, col), toon({ vertexColors: true, side: THREE.DoubleSide, surf: Surf.Grass }));
    land.userData.noCast = true;
    const asphalt = new THREE.Mesh(mk(road, rcol), toon({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, surf: Surf.Asphalt }));
    asphalt.userData.noCast = true;
    sc.add(land, asphalt);

    const sea = makeSea([1400, 1400], 0x14587a, new THREE.Vector3(-0.6, 0.35, 0.7));
    sea.position.set(0, -2.4, 400);
    sc.add(sea);

    // Pinos, matas, quitamiedos, rocas, casitas de L'Escala al principio y el faro de Cap de Creus al final
    const m = new Merger();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 4; i < SAMPLES - 6; i += 2) {
      const r = ring(i);
      // A lo largo de la carretera (antes los quitamiedos y los bancales salían de través)
      const yaw = Math.atan2(r.rz, -r.rx);
      // Quitamiedos del lado del mar: un tramo seguido hasta la muestra siguiente, con su poste
      const r2 = ring(i + 2);
      const ax = r.x + r.rx * 4.6, az = r.z + r.rz * 4.6, bx = r2.x + r2.rx * 4.6, bz = r2.z + r2.rz * 4.6;
      m.add(G.box, 0x8c8c92, ax, 0.35, az, 0, yaw, 0, 0.08, 0.7, 0.08);
      m.add(G.box, 0xc8c8cc, (ax + bx) / 2, 0.6, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0, 0.05, 0.22, Math.hypot(bx - ax, bz - az) + 0.04);
      const wild = i / SAMPLES > 0.45; // pasado Roses, el Cap de Creus: pizarra, matorral y bancales
      // Bancales de piedra seca en la ladera (las «feixes» abandonadas del Cap de Creus)
      if (i % 6 === 0) {
        for (const d of [-12, -18, -25]) {
          const y = THREE.MathUtils.lerp(0.6, 5, Math.min(1, (-d - 8) / 18));
          m.add(G.box, 0x8f877a, r.x + r.rx * d, y + 0.35, r.z + r.rz * d, 0, yaw, 0, 0.6, 0.9 + (i % 3) * 0.2, 6.4);
        }
      }
      // Olivos (troncos retorcidos, copa gris plateada) y matas de lentisco y brezo
      if (wild && rnd() < 0.35) {
        const d = -(7 + rnd() * 14);
        const x = r.x + r.rx * d, z = r.z + r.rz * d;
        const y = THREE.MathUtils.lerp(0.6, 5, Math.min(1, (-d - 8) / 18));
        m.add(G.cyl, 0x5a4a38, x, y + 0.8, z, 0.25, 0, 0.2, 0.35, 1.8, 0.35);
        m.add(G.bush, 0x8a9a78, x + 0.3, y + 2.2, z, 0, rnd() * 3, 0, 2.6, 1.5, 2.4);
      }
      // Pinos piñoneros del lado de la montaña (de L'Escala a Roses)
      if (!wild && rnd() < 0.55) {
        const d = -(7 + rnd() * 20);
        const x = r.x + r.rx * d, z = r.z + r.rz * d;
        const y = THREE.MathUtils.lerp(0.6, 5, Math.min(1, (-d - 8) / 18));
        const hgt = 3 + rnd() * 3;
        m.add(G.cyl, 0x5a4a38, x, y + hgt * 0.4, z, 0.08, 0, 0.06, 0.3, hgt * 0.8, 0.3);
        m.add(G.bush, rnd() < 0.5 ? 0x3f6a32 : 0x4d7a3a, x, y + hgt * 0.85, z, 0, rnd() * 3, 0, 4.2, 1.2, 4.0);
      }
      if (rnd() < 0.25) {
        const d = -(5 + rnd() * 3);
        m.add(G.bush, wild ? 0x6f7a4a : 0x86934a, r.x + r.rx * d, 0.6, r.z + r.rz * d, 0, rnd() * 3, 0, 1.6, 0.9, 1.6);
      }
      // El acantilado: roca viva desde el borde de la carretera hasta el agua
      for (const [d0, y0, k] of [[7.3, -1.3, 1], [9.5, -2.6, 1.3]] as const) {
        const s = (0.85 + rnd() * 0.5) * k;
        m.add(G.crag, wild ? (rnd() < 0.5 ? 0x5f5a54 : 0x6f6a62) : rnd() < 0.5 ? 0x8a7560 : 0x7a6a58, r.x + r.rx * (d0 + rnd()), y0, r.z + r.rz * (d0 + rnd()), rnd() * 0.4, rnd() * 3, 0, 5.2 * s, 3.4 * s, 4.4 * s);
      }
      // Rocas sueltas en el agua
      if (rnd() < 0.4) {
        const d = 9 + rnd() * 8;
        const s = 1.5 + rnd() * 2.5;
        m.add(rnd() < 0.5 ? G.rock : G.rock2, wild ? (rnd() < 0.5 ? 0x6f6a62 : 0x7d766b) : rnd() < 0.5 ? 0x8a7560 : 0x9c8770, r.x + r.rx * d, -2.6 + s * 0.3, r.z + r.rz * d, rnd(), rnd() * 3, 0, s * 1.4, s, s * 1.2);
      }
    }
    // L'Escala: casitas blancas junto a la salida
    for (let i = 0; i < 6; i++) {
      const r = ring(2 + i * 3);
      const d = -(10 + (i % 2) * 7);
      const x = r.x + r.rx * d, z = r.z + r.rz * d;
      m.add(G.box, 0xf6f1e6, x, 2, z, 0, 0.3 * i, 0, 5, 4, 5);
      m.add(G.box, 0xb8623e, x, 4.2, z, 0, 0.3 * i, 0, 5.4, 0.4, 5.4);
    }
    // Cadaqués al otro lado de la bahía: casas blancas apiñadas y la iglesia de Santa Maria arriba
    {
      const r = ring(Math.floor(SAMPLES * 0.72));
      const cx = r.x + r.rx * 70, cz = r.z + r.rz * 70;
      m.add(G.rock2, 0x6f6a62, cx, -3, cz, 0, 0.4, 0, 60, 14, 40);
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2;
        const rr2 = 6 + (k % 5) * 3.5;
        const hx = cx + Math.cos(a) * rr2 * 1.3, hz = cz + Math.sin(a) * rr2 * 0.8;
        const hy = 3.2 + (1 - rr2 / 22) * 4;
        m.add(G.box, 0xf6f1e6, hx, hy, hz, 0, a, 0, 3.4, 3.6 + (k % 3), 3.2);
        m.add(G.box, 0xb8623e, hx, hy + 2 + (k % 3) * 0.5, hz, 0, a, 0, 3.6, 0.3, 3.4);
      }
      m.add(G.box, 0xf6f1e6, cx, 10, cz, 0, 0, 0, 5, 7, 9);
      m.add(G.box, 0xf6f1e6, cx + 2, 14.5, cz - 4, 0, 0, 0, 2.4, 9, 2.4);
      m.add(G.box, 0x3a3a3a, cx + 2, 17, cz - 5.21, 0, 0, 0, 0.9, 1.4, 0.05);
    }
    // Cap de Creus: faro blanco sobre las rocas, al final de la carretera
    const end = ring(SAMPLES);
    const fx = end.x + end.rx * 14 + 10, fz = end.z + end.rz * 14 + 16;
    // El faro real: edificio blanco alargado de dos plantas con la torre cuadrada en medio y la linterna
    // encima, sobre el promontorio de pizarra gris que cae al mar
    this.lighthouse.set(fx, 13, fz);
    m.add(G.rock2, 0x6f6a62, fx, -2, fz, 0, 0.3, 0, 30, 18, 24);
    m.add(G.rock2, 0x7d766b, (fx + end.x) / 2, -3, (fz + end.z) / 2, 0, 1.1, 0, 22, 12, 18);
    m.add(G.rock, 0x6f6a62, fx + 12, -1, fz - 6, 0, 0.7, 0, 9, 6, 8);
    m.add(G.box, 0xf6f1e6, fx, 9.6, fz, 0, 0, 0, 11, 5, 5.5);
    m.add(G.box, 0xe9dcc2, fx, 12.2, fz, 0, 0, 0, 11.4, 0.3, 5.9);
    for (let k = 0; k < 4; k++) for (const sz of [-1, 1]) m.add(G.box, 0x2f6b46, fx - 4.2 + k * (k > 1 ? 2.8 : 2.8), 9.8, fz + sz * 2.77, 0, 0, 0, 0.9, 1.5, 0.05);
    m.add(G.box, 0xf6f1e6, fx, 14.6, fz, 0, 0, 0, 2.6, 4.6, 2.6);
    m.add(G.box, 0xe9dcc2, fx, 17, fz, 0, 0, 0, 3.2, 0.3, 3.2);
    m.add(G.cyl, 0xbfe4f0, fx, 17.9, fz, 0, 0, 0, 1.5, 1.5, 1.5);
    m.add(G.cyl, 0x2f2f36, fx, 18.9, fz, 0, 0, 0, 1.7, 0.5, 1.7);
    m.add(G.cone, 0x2f2f36, fx, 19.4, fz, 0, Math.PI / 4, 0, 1.6, 0.6, 1.6);
    // Montañas al fondo
    for (let i = 0; i < 10; i++) {
      const r = ring(Math.floor((i / 10) * SAMPLES));
      const d = -(90 + (i % 3) * 25);
      m.add(G.rock2, 0x7d8a5a, r.x + r.rx * d, -4, r.z + r.rz * d, 0, i, 0, 80, 34 + (i % 4) * 8, 64);
      // Bosque de encinas y pinos por la ladera
      for (let k = 0; k < 6; k++) m.add(G.bush, k % 2 ? 0x4d6e3a : 0x5a7a40, r.x + r.rx * (d + 12 + k * 4) + Math.sin(k * 2.1 + i) * 18, 6 + (k % 3) * 4, r.z + r.rz * (d + 12 + k * 4) + Math.cos(k * 1.7 + i) * 18, 0, k, 0, 22, 9, 18);
    }
    sc.add(m.mesh());
  }

  // ---------------- Fases ----------------

  private updateHud() {
    const pct = this.total > 0 ? Math.round((this.good / this.total) * 100) : 100;
    this.hud.setObjective(
      this.phase === 'ride' ? (this.windOn ? MOTO.windHint : MOTO.rideHint) : this.phase === 'pack' ? 'La mochila' : this.phase === 'creus' || this.phase === 'done' ? 'Cap de Creus · carretera cortada' : '30 de abril · Costa Brava',
    );
    this.hud.setCounters(this.phase === 'ride' || this.phase === 'creus' ? `<span class="chip">🏍️ ${pct}%</span><span class="chip">✌️ ${this.waves}/${this.motosMet}</span><span class="chip">📷 ${this.photos}/3</span>` : '');
  }

  private startPack() {
    this.phase = 'pack';
    this.updateHud();
    packBag(MOTO.pack, () => dialogue(MOTO.ride, () => this.startRide()));
  }

  private startRide() {
    this.phase = 'ride';
    this.windOn = false;
    this.windK = this.windOff = 0;
    this.windEl?.remove();
    this.windEl = null;
    this.s = 0.02;
    this.speed = 0;
    this.good = this.total = 0;
    this.waves = this.motosMet = this.wrongWaves = 0;
    this.nextEv = 0;
    for (const o of this.oncoming) o.live = o.root.visible = false;
    this.updateHud();
    toast(MOTO.rideHint);
  }

  /** Coloca la moto en la carretera (u de 0 a 1) y devuelve el giro por metro (signo: + izquierda). */
  private placeMoto(u: number) {
    const p = this.curve.getPointAt(Math.min(1, u));
    const t = this.curve.getTangentAt(Math.min(1, u));
    const t2 = this.curve.getTangentAt(Math.min(1, u + 6 / this.len));
    // Va por el carril derecho
    const lane = 1.6 + this.windOff;
    this.moto.root.position.set(p.x - t.z * lane, 0.05, p.z + t.x * lane);
    this.moto.root.rotation.y = Math.atan2(t.x, t.z);
    const dy = Math.atan2(t2.x, t2.z) - Math.atan2(t.x, t.z);
    return Math.atan2(Math.sin(dy), Math.cos(dy)) / 6;
  }

  private takePhoto(i: number) {
    this.photoTaken[i] = true;
    this.photos++;
    audio.pop();
    vibrate(30);
    this.flash.position.copy(this.moto.root.position).setY(2);
    (this.flash.material as THREE.SpriteMaterial).opacity = 1;
    toast(MOTO.photoOk[(this.photos - 1) % MOTO.photoOk.length]);
    this.fx.burst(this.v1.copy(this.moto.root.position).setY(2.4), '📷', 4, 1.2, 0.6);
    this.updateHud();
  }

  /** La tramontana: rachas de un lado y de otro. Hay que inclinarse hacia la flecha o la moto se va del carril. */
  private updateWind(dt: number, ax: number) {
    const u0 = WIND_AT, u1 = WIND_AT + (WIND_SECS * SPEED) / this.len;
    const inside = this.phase === 'ride' && this.s > u0 && this.s < u1;
    this.windK += ((inside ? 1 : 0) - this.windK) * Math.min(1, dt * 2.2);
    if (inside && !this.windOn) {
      this.windOn = true;
      toast(MOTO.wind);
      audio.warn();
      vibrate([60, 40, 60]);
      this.windSide = Math.random() < 0.5 ? -1 : 1;
      this.windT = 2.6;
      if (!this.windEl) {
        this.windEl = document.createElement('div');
        this.windEl.className = 'wind-arrow';
        document.getElementById('ui')!.append(this.windEl);
      }
      this.updateHud();
    } else if (!inside && this.windOn) {
      this.windOn = false;
      toast(MOTO.windOff);
      this.windEl?.remove();
      this.windEl = null;
      this.updateHud();
    }
    if (inside) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.windT = 2.2 + Math.random() * 1.2;
        this.windSide *= -1;
        audio.whoosh();
      }
      if (this.windEl) {
        this.windEl.textContent = this.windSide > 0 ? '🌬️ ➡️' : '⬅️ 🌬️';
        this.windEl.style.opacity = this.windT < 0.5 ? '0.45' : '1';
      }
      const ok = ax * this.windSide > 0.3;
      this.total += dt;
      if (ok) this.good += dt;
      else if (this.wobbleT <= 0) {
        this.wobbleT = 1.2;
        toast(MOTO.windBad);
        vibrate(40);
      }
      if (Math.random() < dt * 14) this.fx.burst(this.v1.copy(this.moto.root.position).setY(0.4), 'dust', 2, 1.6, 0.3);
    }
    // Sin compensar, la racha se lleva la moto hacia el otro lado (sin salirse de la carretera)
    const want = inside && ax * this.windSide <= 0.3 ? -this.windSide * 1.05 : 0;
    this.windOff += (want - this.windOff) * Math.min(1, dt * 1.6);
  }

  private arrive() {
    this.phase = 'creus';
    this.hud.setAction(null);
    audio.fanfare();
    dialogue(MOTO.creus, () =>
      // Como al faro no se llega, un rato en una cala: hasta ganarle a las ranas no volvéis
      fadeFlash(() => {
        this.stones = new StoneSkip(() =>
          fadeFlash(() => {
            this.stones?.dispose();
            this.stones = null;
            dialogue(MOTO.back, () =>
              phoneChat(CHATS.motoTrip, () => {
                this.phase = 'done';
                const pct = this.total > 0 ? Math.round((this.good / this.total) * 100) : 100;
                // Tres cosas: curvas fluidas, las tres fotos y el saludo motero sin fallos (dos de tres ya dan las tres estrellas)
                const ok = (pct >= 70 ? 1 : 0) + (this.photos >= 3 ? 1 : 0) + (this.waves >= this.motosMet && this.wrongWaves === 0 ? 1 : 0);
                this.onComplete({ stars: Math.min(3, 1 + ok), stats: MOTO.stats(pct, this.photos, this.waves, this.motosMet, this.wrongWaves) });
              }),
            );
          }),
        );
      }),
    );
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    if (this.stones) {
      this.stones.update(dt, this.camera);
      return;
    }
    let curv = 0;
    if (this.phase === 'ride') {
      const target = SPEED * (this.wobbleT > 0 ? 0.75 : 1);
      this.speed += (target - this.speed) * Math.min(1, dt * 1.5);
      this.s += (this.speed * dt) / this.len;
      // Frena antes de la valla (con 14 m/s y 8 m/s² se para a unos 7 m de ella)
      if (this.s >= CLOSED_AT - 19 / this.len) this.arrive();
      this.updateTraffic(dt);
    } else if (this.phase === 'creus') this.speed = Math.max(0, this.speed - dt * 8);
    if (this.phase === 'creus') this.s = Math.min(CLOSED_AT - 6 / this.len, this.s + (this.speed * dt) / this.len);
    this.updateWave(dt);
    this.updateWind(dt, this.phase === 'ride' ? this.input.axes().x : 0);
    curv = this.placeMoto(this.s);

    // Inclinación de la moto (la que manda Gas) y la de Azul (la que pone la jugadora)
    const want = THREE.MathUtils.clamp(Math.atan((this.speed * this.speed * -curv) / 9.8), -0.6, 0.6);
    this.lean += (want - this.lean) * Math.min(1, dt * 4);
    const ax = this.phase === 'ride' ? this.input.axes().x : 0;
    this.azulLean += (ax * 0.45 - this.azulLean) * Math.min(1, dt * 6);
    if (this.phase === 'ride' && Math.abs(want) > 0.03 && !this.windOn) {
      // En curva: acompañar hacia el mismo lado; en recta: ir derechita
      const strong = Math.abs(want) > 0.12;
      const ok = strong ? Math.sign(ax) === Math.sign(want) && Math.abs(ax) > 0.25 : Math.abs(ax) < 0.6 || Math.sign(ax) === Math.sign(want);
      this.total += dt;
      if (ok) this.good += dt;
      else if (strong && this.wobbleT <= 0) {
        this.wobbleT = 1.2;
        toast(MOTO.lean.bad);
        vibrate(40);
      }
      if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.updateHud();
    }
    if (this.wobbleT > 0) this.wobbleT -= dt;
    const wob = this.wobbleT > 0 ? Math.sin(this.t * 22) * 0.06 * this.wobbleT : 0;
    this.moto.root.rotation.z = this.lean + wob + this.windK * Math.sin(this.t * 6) * 0.025;
    // Se inclina de cintura para arriba: la cadera sigue en el asiento y las piernas no se mueven
    leanTorso(this.azul, this.azul.rig ? 0 : 0.2, 0, this.azulLean - this.lean * 0.3);
    for (const w of this.moto.wheels) w.rotation.x += (this.speed * dt) / 0.33;

    // Miradores: foto
    let label: string | null = null;
    let act: (() => void) | null = null;
    if (this.phase === 'ride') {
      PHOTO_AT.forEach((at, i) => {
        if (!this.photoTaken[i] && Math.abs(this.s - at) < PHOTO_WIN) {
          label = MOTO.photoHint;
          act = () => this.takePhoto(i);
        }
      });
      // Viene alguien de frente: el botón de saludar sale igual para motos y coches (hay que fijarse)
      const o = label ? null : this.waveTarget();
      if (o) {
        label = MOTO.wave.btn;
        act = () => this.wave(o);
      }
    }
    this.hud.setAction(label, !!label);
    const pressed = this.input.consumeAction();
    if (pressed && act) (act as () => void)();
    const fm = this.flash.material as THREE.SpriteMaterial;
    if (fm.opacity > 0) fm.opacity = Math.max(0, fm.opacity - dt * 3);

    // Cámara: detrás de la moto en marcha; en la intro, de lado; al llegar, mirando al faro
    const p = this.moto.root.position;
    const yaw = this.moto.root.rotation.y;
    const fwd = this.v2.set(Math.sin(yaw), 0, Math.cos(yaw));
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    if (this.phase === 'ride') {
      pos = this.v1.copy(p).addScaledVector(fwd, -5.5).setY(2.6);
      look = new THREE.Vector3().copy(p).addScaledVector(fwd, 7).setY(1.2);
    } else if (this.phase === 'creus' || this.phase === 'done') {
      // Por detrás y un poco de lado: la moto parada, la valla y, al fondo, el faro al que no se llega
      pos = this.v1.copy(p).addScaledVector(fwd, -5.5).add(new THREE.Vector3(-fwd.z * 1.8, 2.3, fwd.x * 1.8));
      look = this.lighthouse.clone().setY(5);
    } else {
      pos = this.v1.set(p.x + 5 * Math.cos(this.t * 0.15), 2.6, p.z + 5 * Math.sin(this.t * 0.15) + 1);
      look = new THREE.Vector3(p.x, 1, p.z);
    }
    // Si la moto salta lejos (modo prueba, cambio de tramo), la cámara no cruza el mapa persiguiéndola
    if (this.camera.position.distanceTo(pos) > 60) {
      this.camera.position.copy(pos);
      this.camLook.copy(look);
    }
    this.camera.position.lerp(pos, Math.min(1, dt * (this.phase === 'ride' ? 5 : 2)));
    this.camLook.lerp(look, Math.min(1, dt * 4));
    this.camera.lookAt(this.camLook);
    this.sun.follow(p);
    this.sky.update(this.camera, dt);
  }

  // ---------- Tráfico de frente y saludo motero ----------

  /** Dos motos y dos coches que se reutilizan (se crean al principio: así no hay tirones al cruzarse). */
  private buildTraffic() {
    const motoCols = [0x1f3a6b, 0xe8e8e4];
    for (let i = 0; i < 2; i++) {
      const mo = makeMoto(motoCols[i], RIDERS[i]);
      mo.root.visible = false;
      mo.root.rotation.order = 'YXZ';
      this.scene.add(mo.root);
      this.oncoming.push({ kind: 'moto', root: mo.root, wheels: mo.wheels, rider: mo.rider, s: 0, live: false, greeted: false, passed: false, waveT: 0, waved: false, k: 0 });
    }
    const carCols = [0xf2f2ee, 0x6b1f2a];
    for (let i = 0; i < 2; i++) {
      const car = makeCar(carCols[i], { luggage: false, joy: false, driver: DRIVERS[i] });
      // Solo el conductor
      const az = (car as { azul?: THREE.Object3D }).azul;
      if (az) az.visible = false;
      car.root.visible = false;
      this.scene.add(car.root);
      this.oncoming.push({ kind: 'car', root: car.root, wheels: (car as { wheels?: THREE.Object3D[] }).wheels ?? [], rider: null, s: 0, live: false, greeted: false, passed: false, waveT: 0, waved: false, k: 0 });
    }
  }

  private placeOncoming(o: Oncoming) {
    const u = THREE.MathUtils.clamp(o.s, 0, 1);
    const p = this.curve.getPointAt(u);
    const t = this.curve.getTangentAt(u);
    // Por el carril de la izquierda, en sentido contrario
    o.root.position.set(p.x + t.z * 1.7, 0.05, p.z - t.x * 1.7);
    o.root.rotation.y = Math.atan2(t.x, t.z) + Math.PI;
  }

  private updateTraffic(dt: number) {
    const len = this.len;
    // Cada uno sale cuando el punto de cruce queda a unos 85 m, desde donde llegue a tiempo (nunca de detrás de la valla)
    while (this.nextEv < ONCOMING.length) {
      const [meet, kind] = ONCOMING[this.nextEv];
      if ((meet - this.s) * len > 85) break;
      this.nextEv++;
      const o = this.oncoming.find((x) => x.kind === kind && !x.live);
      if (!o) continue;
      const t = Math.max(0, ((meet - this.s) * len) / SPEED);
      o.s = Math.min(meet + (ONCOMING_V * t) / len, CLOSED_AT - 10 / len);
      o.live = o.root.visible = true;
      o.greeted = o.passed = o.waved = false;
      o.waveT = 0;
      this.placeOncoming(o);
    }
    for (const o of this.oncoming) {
      if (!o.live) continue;
      o.s -= (ONCOMING_V * dt) / len;
      this.placeOncoming(o);
      for (const w of o.wheels) w.rotation.x += (ONCOMING_V * dt) / 0.33;
      const d = (o.s - this.s) * len; // metros por delante
      // El de la moto de enfrente saluda ya de cerca: brazo fuera, abajo, dos dedos
      if (o.kind === 'moto' && !o.waved && d < 24) {
        o.waved = true;
        o.waveT = 1.6;
      }
      if (!o.passed && d < -3) {
        o.passed = true;
        if (o.kind === 'moto') {
          this.motosMet++;
          if (!o.greeted) toast(MOTO.wave.missed);
          this.updateHud();
        }
      }
      if (d < -30) o.live = o.root.visible = false;
    }
  }

  /** Lo que viene de frente y aún no has saludado, si está a tiro (entre 45 m por delante y justo al cruzaros). */
  private waveTarget() {
    for (const o of this.oncoming) {
      if (!o.live || o.greeted) continue;
      const d = (o.s - this.s) * this.len;
      if (d < 45 && d > -3) return o;
    }
    return null;
  }

  private wave(o: Oncoming) {
    o.greeted = true;
    this.azulWaveT = 1.3;
    if (o.kind === 'moto') {
      this.waves++;
      if (o.waveT <= 0) o.waveT = 1.2;
      toast(MOTO.wave.ok[(this.waves - 1) % MOTO.wave.ok.length]);
      audio.pickup();
      vibrate(20);
    } else {
      this.wrongWaves++;
      toast(MOTO.wave.car[(this.wrongWaves - 1) % MOTO.wave.car.length]);
      audio.boo();
    }
    this.updateHud();
  }

  /** Brazos de los que saludan: Azul suelta la cintura de Gas; el de enfrente saca la mano del manillar. */
  private updateWave(dt: number) {
    this.azulWaveT -= dt;
    this.azulWaveK += ((this.azulWaveT > 0 ? 1 : 0) - this.azulWaveK) * Math.min(1, dt * 8);
    const a = this.azul;
    if (a.rig) {
      const k = this.azulWaveK;
      void k; // (el brazo lo lleva el IK de hugGas)
    }
    for (const o of this.oncoming) {
      if (!o.rider) continue;
      o.waveT -= dt;
      o.k += ((o.waveT > 0 ? 1 : 0) - o.k) * Math.min(1, dt * 8);
      o.rider.armR.rotation.set(THREE.MathUtils.lerp(-1.25, -0.45, o.k), 0, THREE.MathUtils.lerp(0.3, 0.75, o.k));
      o.rider.elbowR.rotation.x = THREE.MathUtils.lerp(-0.25, -0.05, o.k);
    }
  }

  /** Sus manos no se mueven de la cintura de Gas aunque ella se incline en las curvas. */
  private hugGas() {
    const a = this.azul;
    const r = a.rig!;
    a.root.updateWorldMatrix(true, true);
    const onLeft = a.root.worldToLocal(r.bones.get('LeftHand')!.getWorldPosition(new THREE.Vector3())).x > 0;
    const B = (n: string) => r.bones.get(n)!;
    const t = new THREE.Vector3();
    const pole = new THREE.Vector3();
    const post = () => {
      if (!a.root.parent) return;
      const root = this.moto.root;
      root.updateWorldMatrix(true, false);
      for (const sx of [1, -1]) {
        const left = sx > 0 ? onLeft : !onLeft;
        const side = left ? 'Left' : 'Right';
        // Saluda con la izquierda, como los moteros: ese brazo suelta a Gas
        const w = left ? 1 - this.azulWaveK : 1;
        if (w <= 0.01) continue;
        root.localToWorld(t.set(sx * 0.17, 1.17, -0.5));
        root.localToWorld(pole.set(sx * 0.62, 0.98, -0.72));
        twoBone(B(side + 'Arm'), B(side + 'ForeArm'), B(side + 'Hand'), t, pole, w);
      }
      // La mano izquierda, fuera y arriba, moviéndose: el saludo
      if (this.azulWaveK > 0.01) {
        const ls = onLeft ? 1 : -1;
        root.localToWorld(t.set(ls * 0.62, 1.62 + Math.sin(this.t * 13) * 0.05, -0.42 + Math.sin(this.t * 13) * 0.07));
        root.localToWorld(pole.set(ls * 1.0, 1.0, -0.7));
        twoBone(B('LeftArm'), B('LeftForeArm'), B('LeftHand'), t, pole, this.azulWaveK);
      }
      // Pies en las estriberas de atrás, con la rodilla hacia fuera (por los lados de Gas)
      for (const sx of [1, -1]) {
        const side = (sx > 0 ? onLeft : !onLeft) ? 'Left' : 'Right';
        root.localToWorld(t.set(sx * 0.22, 0.6, -0.71));
        root.localToWorld(pole.set(sx * 0.62, 1.05, -0.2));
        twoBone(B(side + 'UpLeg'), B(side + 'Leg'), B(side + 'Foot'), t, pole, 1);
        boneLevel(a, side + 'Foot', 0.1);
      }
    };
    rigPost.add(post);
  }

  // ---------- Carretera cortada ----------

  /** El último tramo hasta el faro, cerrado: bloques de hormigón rojos y blancos, valla y carteles. */
  private buildClosure() {
    const p = this.curve.getPointAt(CLOSED_AT);
    const t = this.curve.getTangentAt(CLOSED_AT);
    const g = new THREE.Group();
    g.position.set(p.x, 0.05, p.z);
    g.rotation.y = Math.atan2(t.x, t.z);
    const m = new Merger();
    // Bloques de hormigón de lado a lado (x a lo ancho, z a lo largo de la carretera)
    for (let i = 0; i < 4; i++) {
      const x = -3.15 + i * 2.1;
      m.add(G.box, i % 2 ? 0xd7263d : 0xf2f2ee, x, 0.38, 0, 0, 0, 0, 2.0, 0.76, 0.55);
      m.add(G.box, i % 2 ? 0xf2f2ee : 0xd7263d, x, 0.8, 0, 0, 0, 0, 2.0, 0.08, 0.34);
    }
    // Valla metálica de obra detrás, con sus pies
    for (let i = 0; i < 4; i++) {
      const x = -3.15 + i * 2.1;
      for (const dx of [-0.95, 0.95]) {
        m.add(G.box, 0x9a9ea4, x + dx, 1.05, 0.7, 0, 0, 0, 0.04, 2.0, 0.04);
        m.add(G.box, 0x3a3a3e, x + dx, 0.05, 0.7, 0, 0, 0, 0.12, 0.1, 0.5);
      }
      for (const y of [0.1, 2.0]) m.add(G.box, 0x9a9ea4, x, y, 0.7, 0, 0, 0, 1.9, 0.04, 0.04);
      for (let k = 0; k < 10; k++) m.add(G.box, 0xb8bcc2, x - 0.85 + k * 0.19, 1.05, 0.7, 0, 0, 0, 0.012, 1.9, 0.012);
    }
    // Conos naranjas delante
    for (const x of [-3.6, -1.2, 1.2, 3.6]) {
      m.add(G.cone, 0xff7a1a, x, 0.35, -1.6, 0, 0, 0, 0.36, 0.7, 0.36);
      m.add(G.cyl, 0xf2f2ee, x, 0.4, -1.6, 0, 0, 0, 0.24, 0.08, 0.24);
    }
    // Postes de las señales
    m.add(G.cyl, 0x9a9ea4, -4.6, 1.3, -0.3, 0, 0, 0, 0.08, 2.6, 0.08);
    m.add(G.cyl, 0x9a9ea4, 4.6, 1.2, -0.3, 0, 0, 0, 0.08, 2.4, 0.08);
    g.add(m.mesh());
    const sign = (draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, x: number, y: number, tw: number, th: number) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon({ map: canvasTex(draw, tw, th), roughness: 0.6, side: THREE.DoubleSide }));
      s.position.set(x, y, -0.36);
      s.rotation.y = Math.PI; // mirando a quien llega
      g.add(s);
    };
    // Entrada prohibida
    sign((c, w, h) => {
      c.fillStyle = '#c8202a';
      c.beginPath();
      c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 8;
      c.stroke();
      c.fillStyle = '#ffffff';
      c.fillRect(w * 0.2, h * 0.42, w * 0.6, h * 0.16);
    }, 0.9, 0.9, -4.6, 2.5, 256, 256);
    // Cartel de carretera cortada
    sign((c, w, h) => {
      c.fillStyle = '#f2f2ee';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c8202a';
      c.lineWidth = 18;
      c.strokeRect(9, 9, w - 18, h - 18);
      c.fillStyle = '#1b1b22';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = 'bold 74px Arial, sans-serif';
      c.fillText('CARRETERA', w / 2, h * 0.3);
      c.fillText('CORTADA', w / 2, h * 0.55);
      c.font = '600 38px Arial, sans-serif';
      c.fillText('Accés tancat · Cap de Creus', w / 2, h * 0.8);
    }, 2.2, 1.1, 4.6, 2.2, 512, 256);
    this.scene.add(g);
  }

  debug(): DebugItem[] {
    return [
      { label: '1 · La mochila', run: () => this.startPack() },
      { label: '2 · En moto', run: () => { document.querySelector('.pack-screen')?.remove(); this.startRide(); } },
      {
        label: '3 · Cap de Creus',
        run: () => {
          document.querySelector('.pack-screen')?.remove();
          this.phase = 'ride';
          this.s = CLOSED_AT - 60 / this.len;
          this.nextEv = ONCOMING.length;
          this.speed = SPEED;
          this.updateHud();
        },
      },
      { label: '✓ Completar capítulo', run: () => { this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  private stones: StoneSkip | null = null;
  private windK = 0;
  private windOff = 0;
  private windOn = false;
  private windSide = 1;
  private windT = 0;
  private windEl: HTMLElement | null = null;

  dispose() {
    this.stones?.dispose();
    this.windEl?.remove();
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}
