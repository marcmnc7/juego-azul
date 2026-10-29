import * as THREE from 'three';
import type { Input } from '../core/input';
import { audio } from '../core/audio';
import { Sky, Sun, toon, glowTexture, vibrate, makeSea } from '../core/gfx';
import { Surf } from '../core/surfaces';
import { MOTO } from '../data/story';
import { MARGAUX_LOOK, MARC_LOOK } from '../data/characters';
import { G, Merger, makeMoto, makePerson, type Person } from '../entities/models';
import { boneAnchor } from '../entities/rig';
import { CHATS } from '../data/chats';
import { Particles } from '../entities/fx';
import { hud, dialogue, toast, phoneChat, fadeFlash, Hud, DebugItem, later } from '../ui/ui';
import { packBag } from '../ui/minis';
import { disposeScene, type Level, type LevelDone } from './level';

// Capítulo 5 · MotoTrip4life (Costa Brava, 30 de abril – 4 de mayo de 2026).
// Bucle: el plan (chat) → la mochila con la lista real de Gas → de paquete por la carretera de la costa
// hasta Cap de Creus: Gas conduce y tú acompañas las curvas inclinándote con él, y en tres miradores
// sacas la foto → cena y helado → el chat del lunes al devolver la moto.

type Phase = 'intro' | 'pack' | 'ride' | 'creus' | 'done';

const SPEED = 14;
const ROAD_W = 8.4;
const SAMPLES = 420;
const PHOTO_AT = [0.27, 0.55, 0.8];
const PHOTO_WIN = 0.035;

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
    this.sky = new Sky({ top: 0x3d6fb8, mid: 0xf0b483, bottom: 0xf7dcb0, sun: { color: 0xffd9a0, dir: sunDir, size: 90 }, clouds: { count: 9, tint: 0xfff0e0 }, physical: { sunDir, turbidity: 6, rayleigh: 2 } });
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
      a.armL.rotation.set(-1.2, 0, 0.55);
      a.armR.rotation.set(-1.2, 0, -0.55);
      a.elbowL.rotation.x = a.elbowR.rotation.x = -0.55;
      a.body.rotation.x = 0.28;
      const helmet = new THREE.Group();
      const shell = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, roughness: 0.25, clearcoat: 1 });
      const visor = new THREE.MeshPhysicalMaterial({ color: 0x223040, metalness: 0.2, roughness: 0.05, clearcoat: 1 });
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), shell);
      const vi = new THREE.Mesh(new THREE.SphereGeometry(0.152, 24, 12, -0.9, 1.8, 1.05, 0.75), visor);
      for (const m of [sh, vi]) {
        // Algo más grande que el de Gas: le tapa también el moño
        m.position.set(0, 0.12, -0.02);
        m.scale.set(1.3, 1.3, 1.45);
        m.castShadow = true;
        helmet.add(m);
      }
      boneAnchor(a, 'Head').add(helmet);
    } else a.head.add(new Merger().add(G.ball, 0xf4f4f4, 0, 0.3, -0.02, 0, 0, 0, 0.68, 0.64, 0.66).add(G.box, 0x223040, 0, 0.3, 0.3, 0, 0, 0, 0.5, 0.2, 0.06).mesh());
    this.moto.root.add(a.root);
    this.moto.root.rotation.order = 'YXZ';
    sc.add(this.moto.root);
    this.placeMoto(0);

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
    return this.scene;
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
      for (const [o0, o1, colr] of [[-h, -0.12, 0x34343a], [-0.12, 0.12, dash ? 0xf0ead8 : 0x34343a], [0.12, h, 0x34343a]] as [number, number, number][]) {
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
      const yaw = Math.atan2(-r.rz, r.rx) + Math.PI / 2;
      // Quitamiedos del lado del mar
      if (i % 4 === 0) m.add(G.box, 0x8c8c92, r.x + r.rx * 4.6, 0.35, r.z + r.rz * 4.6, 0, yaw, 0, 0.08, 0.7, 0.08);
      m.add(G.box, 0xc8c8cc, r.x + r.rx * 4.6, 0.6, r.z + r.rz * 4.6, 0, yaw, 0, 0.05, 0.22, 2.0);
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
      for (const [d0, y0, k] of [[6.2, -0.9, 1], [8.5, -2.2, 1.3]] as const) {
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
      this.phase === 'ride' ? MOTO.rideHint : this.phase === 'pack' ? 'La mochila' : this.phase === 'creus' || this.phase === 'done' ? 'Cap de Creus' : '30 de abril · Costa Brava',
    );
    this.hud.setCounters(this.phase === 'ride' || this.phase === 'creus' ? `<span class="chip">🏍️ ${pct}%</span><span class="chip">📷 ${this.photos}/3</span>` : '');
  }

  private startPack() {
    this.phase = 'pack';
    this.updateHud();
    packBag(MOTO.pack, () => dialogue(MOTO.ride, () => this.startRide()));
  }

  private startRide() {
    this.phase = 'ride';
    this.s = 0.02;
    this.speed = 0;
    this.good = this.total = 0;
    this.updateHud();
    toast(MOTO.rideHint);
  }

  /** Coloca la moto en la carretera (u de 0 a 1) y devuelve el giro por metro (signo: + izquierda). */
  private placeMoto(u: number) {
    const p = this.curve.getPointAt(Math.min(1, u));
    const t = this.curve.getTangentAt(Math.min(1, u));
    const t2 = this.curve.getTangentAt(Math.min(1, u + 6 / this.len));
    // Va por el carril derecho
    this.moto.root.position.set(p.x - t.z * 1.6, 0.05, p.z + t.x * 1.6);
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

  private arrive() {
    this.phase = 'creus';
    this.hud.setAction(null);
    audio.fanfare();
    dialogue(MOTO.creus, () =>
      fadeFlash(() =>
        dialogue(MOTO.back, () =>
          phoneChat(CHATS.motoTrip, () => {
            this.phase = 'done';
            const pct = this.total > 0 ? Math.round((this.good / this.total) * 100) : 100;
            this.onComplete({ stars: 1 + (pct >= 70 ? 1 : 0) + (this.photos >= 3 ? 1 : 0), stats: MOTO.stats(pct, this.photos) });
          }),
        ),
      ),
    );
  }

  update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    let curv = 0;
    if (this.phase === 'ride') {
      const target = SPEED * (this.wobbleT > 0 ? 0.75 : 1);
      this.speed += (target - this.speed) * Math.min(1, dt * 1.5);
      this.s += (this.speed * dt) / this.len;
      if (this.s >= 0.995) {
        this.s = 0.995;
        this.arrive();
      }
    } else if (this.phase === 'creus') this.speed = Math.max(0, this.speed - dt * 8);
    if (this.phase === 'creus') this.s = Math.min(0.999, this.s + (this.speed * dt) / this.len);
    curv = this.placeMoto(this.s);

    // Inclinación de la moto (la que manda Gas) y la de Azul (la que pone la jugadora)
    const want = THREE.MathUtils.clamp(Math.atan((this.speed * this.speed * -curv) / 9.8), -0.6, 0.6);
    this.lean += (want - this.lean) * Math.min(1, dt * 4);
    const ax = this.phase === 'ride' ? this.input.axes().x : 0;
    this.azulLean += (ax * 0.45 - this.azulLean) * Math.min(1, dt * 6);
    if (this.phase === 'ride' && Math.abs(want) > 0.03) {
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
    this.moto.root.rotation.z = this.lean + wob;
    this.azul.body.rotation.z = this.azulLean - this.lean * 0.3;
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
      pos = this.v1.copy(p).addScaledVector(fwd, -6).add(new THREE.Vector3(-fwd.z * 4, 3.5, fwd.x * 4));
      look = this.lighthouse.clone();
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

  debug(): DebugItem[] {
    return [
      { label: '1 · La mochila', run: () => this.startPack() },
      { label: '2 · En moto', run: () => { document.querySelector('.pack-screen')?.remove(); this.startRide(); } },
      {
        label: '3 · Cap de Creus',
        run: () => {
          document.querySelector('.pack-screen')?.remove();
          this.phase = 'ride';
          this.s = 0.97;
          this.speed = SPEED;
          this.updateHud();
        },
      },
      { label: '✓ Completar capítulo', run: () => { this.phase = 'done'; this.onComplete({ stars: 3, stats: [['Modo prueba', '✓']] }); } },
    ];
  }

  dispose() {
    this.hud.remove();
    audio.stopMusic();
    audio.ambience(0);
    disposeScene(this.scene);
  }
}
