import * as THREE from 'three';
import { Surf } from '../core/surfaces';
import { audio } from '../core/audio';
import { Sky, Sun, glowTexture, toon } from '../core/gfx';
import { Lost } from '../core/lost';
import { AZUL_DIARIO, GAS_DIARIO } from '../data/characters';
import { G, Merger, makePerson, animatePerson, seatedRootY, seatPose, Person } from '../entities/models';
import { makeCarHD } from '../entities/vehiclesHD';
import { Particles } from '../entities/fx';
import { later, type Hud } from '../ui/ui';
import { Walker } from '../core/walker';
import type { Input } from '../core/input';
import { Trail } from '../core/follow';
import { beacon } from '../core/beacon';
import { Door } from './door';
import { canvasTex } from './deco';
import type { Box2 } from './ferreries';

// Capítulo 3, entre Cafetería Marcial y San Vicente: iba a ser cenita de camping (estrellas, cartas y
// el camping gas) y a él se le olvidó precisamente el gas. De ahí el nombre. Escena de cine: en un claro
// entre matorral y pinos, de noche, con la mesa plegable, las cartas, el farolillo y un hornillo que no enciende.

/** Medidas de la cabaña: media anchura (x), medio fondo (z; la puerta, en -Z) y alto de las paredes. */
const CX = 5.4, CZ = 3.2, CH = 2.4;

export type CampSpot = 'estufa' | 'abridor' | 'sofa';
const SPOT_LABEL: Record<CampSpot, string> = { estufa: '🔥 Probar la estufa', abridor: '🍷 Buscar el abridor', sofa: '🛋️ Al sofá, con el vino' };

export class Camp {
  scene = new THREE.Scene();
  private sky: Sky;
  private fx: Particles;
  readonly azul: Person;
  readonly gas: Person;
  private glow: THREE.Sprite;
  private t = 0;
  private lost = new Lost();
  private carCircles: { x: number; z: number; r: number }[] = [];
  private v = new THREE.Vector3();
  private colliders: Box2[] = [];
  private door!: Door;
  private walker: Walker | null = null;
  private gasTrail = new Trail();
  private who: THREE.Vector3[] = [];
  /** Ya has entrado: el nivel sigue con la escena de la mesa. */
  inside = false;
  /** Chispitas del encendedor del hornillo (pequeñas, que no tapen nada). */
  private sparks: THREE.Sprite[] = [];
  private sparkT = 0;
  /** El hornillo, para encuadrarlo. */
  readonly stove = new THREE.Vector3(0.12, 0.8, 0.02);
  /** Centro de la mesa. */
  readonly table = new THREE.Vector3(0, 0.75, 0);
  /**
   * Sin gas (Gas contaba con comprarlo en la gasolinera de al lado): a pie a la gasolinera, que no tiene, y de vuelta
   * a probar la estufa de pellets de la cabaña, que solo echa humo. searching: hay un sitio al que ir (active);
   * onSearched: se ha llegado y se ha pulsado. El nivel decide qué viene después.
   */
  searching = false;
  active: CampSpot | null = null;
  onSearched: ((key: CampSpot) => void) | null = null;
  private spots: Record<CampSpot, { at: THREE.Vector3; reach: number }> = {
    estufa: { at: new THREE.Vector3(-3.9, 0, 1.75), reach: 1.25 },
    // (21 nov) El abridor, en la guantera del coche: un paseo por fuera de la cabaña; luego, vino en el sofá
    abridor: { at: new THREE.Vector3(-9.95, 0, -4.75), reach: 1.45 },
    sofa: { at: new THREE.Vector3(-3.95, 0, -1.0), reach: 1.3 },
  };
  /** Gas se queda dentro, junto a la estufa, mientras ella va al coche. */
  private gasStay: THREE.Vector3 | null = null;
  /** En el sofá, con una copa de vino cada uno, mientras el pollo se hace en la estufa. */
  private onSofa = false;
  private glasses: THREE.Object3D[] = [];
  private glassQ = new THREE.Quaternion();
  private glassP = new THREE.Vector3();
  /** La estufa de pellets (para encuadrarla) y su humo. */
  readonly pellet = new THREE.Vector3(-4.7, 0.9, 2.55);
  private puffs: { s: THREE.Sprite; t: number }[] = [];
  private pot = new THREE.Group();
  /** De pie junto a la estufa (sin andar ni sentarse). */
  private standing = false;
  private puffTex: THREE.Texture | null = null;
  private smokeT = 0;

  constructor() {
    const sc = this.scene;
    sc.fog = new THREE.Fog(0x1a2347, 30, 130);
    // La noche del cap. 2: se ve de noche, pero sin oscuridad exagerada (luna azulada con sombras, poco ambiente)
    sc.userData.comicLook = 'noche';
    sc.userData.hemiScale = 0.32;
    this.colliders.push({ minX: -0.55, maxX: 0.55, minZ: -0.36, maxZ: 0.36 }); // la mesa
    // Noche de finales de octubre: a la hora de cenar ya no queda resplandor en el horizonte, solo estrellas
    this.sky = new Sky({ top: 0x0a1440, mid: 0x1a2a66, bottom: 0x34437a, stars: 2200 });
    sc.add(this.sky.group);
    sc.add(new THREE.HemisphereLight(0x6f7fc0, 0x1a2030, 1.1));
    const moon = new Sun(sc, 0xb8c8ff, 2.0, new THREE.Vector3(-0.4, 1, 0.5), 12);
    moon.light.shadow.normalBias = 0.16;
    moon.light.shadow.bias = -0.0012;
    this.fx = new Particles(sc);

    const m = new Merger();
    // Tierra, el claro de grava y matorral bajo alrededor, menos donde está la mesa
    // (el suelo, de hierba y el claro de tierra: con el color de antes el tebeo lo dibujaba como un enlosado de ladrillo)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), toon({ color: 0x4f6234, surf: Surf.Grass }));
    ground.receiveShadow = true;
    sc.add(ground);
    const clearing = new THREE.Mesh(new THREE.CircleGeometry(9, 32).rotateX(-Math.PI / 2), toon({ color: 0x8a7656, surf: Surf.Sand }));
    clearing.position.set(0, 0.01, -5);
    clearing.scale.set(1.5, 1, 1.2);
    clearing.receiveShadow = true;
    sc.add(clearing);
    // El matorral, instanciado y de pocos polígonos (es mucho: con esferas normales la escena iba a tirones)
    const vines: THREE.Matrix4[] = [];
    const tint: THREE.Color[] = [];
    const VC = [0x3f5a2e, 0x4b6a34, 0x5a6e2c].map((c) => new THREE.Color(c));
    for (let row = -12; row <= 12; row++) {
      const x = row * 2.6;
      for (let z = -40; z <= 40; z += 1.6) {
        if (Math.abs(x) < 6.5 && Math.abs(z) < 6.5) continue;
        const j = Math.sin(row * 12.9 + z * 3.7);
        const sx = x + Math.sin(z * 9.1 + row) * 1.2, sz = z + Math.cos(row * 5.3 + z) * 0.7;
        if (Math.abs(sx) < 13.5 && sz > -14.5 && sz < 8) continue; // por donde se anda, despejado: nada de atravesar matas
        vines.push(new THREE.Matrix4().compose(new THREE.Vector3(sx, 0.32, sz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), j * 3), new THREE.Vector3(0.7 + j * 0.2, 0.42 + j * 0.12, 0.8)));
        tint.push(VC[Math.abs(row + Math.round(z)) % 3]);
      }
    }
    // Unos pinos, recortados contra las estrellas
    for (const [px, pz, h] of [[-14, 12, 8], [11, 15, 9], [18, -6, 7.5], [-20, -9, 8.5], [6, -19, 9], [-8, -22, 7], [25, 10, 8], [-27, 6, 9.5]]) {
      m.add(G.cyl, 0x3f3026, px, h / 2, pz, 0.04, 0, 0.05, 0.42, h, 0.42);
      for (let k = 0; k < 5; k++) m.add(G.bush, k % 2 ? 0x24402a : 0x2c4c30, px + Math.cos(k * 1.3) * 1.9, h + Math.sin(k * 2) * 0.5, pz + Math.sin(k * 1.3) * 1.9, 0, k, 0, 3.2, 1.5, 3.0);
    }
    const vineMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), toon({ color: 0xffffff, roughness: 0.9, surf: Surf.Foliage, leafy: true, side: THREE.DoubleSide }), vines.length);
    vines.forEach((mx, i) => {
      vineMesh.setMatrixAt(i, mx);
      vineMesh.setColorAt(i, tint[i]);
    });
    vineMesh.userData.noCast = true;
    sc.add(vineMesh);
    this.buildCabin(m);
    // Mesa plegable y dos sillas de camping
    m.add(G.box, 0xd9d4c8, 0, 0.72, 0, 0, 0, 0, 0.95, 0.03, 0.62);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(G.box, 0x9a9a9a, sx * 0.42, 0.36, sz * 0.26, 0, 0, sz * 0.1, 0.025, 0.72, 0.025);
    for (const sx of [-1, 1]) {
      m.add(G.box, 0x2f5f8a, sx * 0.85, 0.42, 0, 0, 0, 0, 0.45, 0.04, 0.45);
      m.add(G.box, 0x2f5f8a, sx * 1.07, 0.7, 0, 0, 0, sx * 0.15, 0.04, 0.55, 0.45);
      this.colliders.push({ minX: Math.min(sx * 0.6, sx * 1.12), maxX: Math.max(sx * 0.6, sx * 1.12), minZ: -0.26, maxZ: 0.26 });
      for (const sz of [-1, 1]) m.add(G.box, 0x777777, sx * 0.85, 0.21, sz * 0.2, 0, 0, sx * sz * 0.35, 0.02, 0.48, 0.02);
    }
    // Las cartas: un mazo y la partida a medias
    m.add(G.box, 0xf4f1ea, -0.3, 0.75, -0.16, 0, 0.2, 0, 0.06, 0.03, 0.09);
    for (let i = 0; i < 7; i++) m.add(G.box, i % 2 ? 0xf4f1ea : 0xc9302c, -0.15 + i * 0.045, 0.738, 0.12 - (i % 3) * 0.02, 0, 0.3 * Math.sin(i * 2.1), 0, 0.06, 0.002, 0.09);
    // El hornillo de camping, con su olla… y sin cartucho de gas
    m.add(G.cyl, 0x2a4f9a, this.stove.x, 0.77, this.stove.z, 0, 0, 0, 0.2, 0.06, 0.2);
    m.add(G.cyl, 0x2a2a2a, this.stove.x, 0.81, this.stove.z, 0, 0, 0, 0.12, 0.02, 0.12);
    m.add(G.cyl, 0xb8bcc2, this.stove.x, 0.89, this.stove.z, 0, 0, 0, 0.17, 0.12, 0.17);
    // Base del farolillo
    m.add(G.cyl, 0x333333, -0.32, 0.76, 0.16, 0, 0, 0, 0.08, 0.04, 0.08);
    // La estufa de pellets, en el rincón: cuerpo negro con su ventanita hacia la sala, tolva arriba y el tubo
    {
      const [px, pz] = [this.pellet.x, this.pellet.z];
      m.add(G.rbox, 0x26282c, px, 0.5, pz, 0, 0, 0, 0.55, 1.0, 0.5);
      m.add(G.box, 0x5a2a10, px - 0.02, 0.5, pz - 0.255, 0, 0, 0, 0.3, 0.3, 0.02); // ventanita
      m.add(G.box, 0x9a9ca0, px - 0.02, 0.5, pz - 0.262, 0, 0, 0, 0.34, 0.03, 0.01);
      m.add(G.box, 0x1a1b1e, px, 1.02, pz, 0, 0, 0, 0.5, 0.05, 0.46);
      m.add(G.cyl, 0x2f3136, px + 0.1, 1.9, pz + 0.1, 0, 0, 0, 0.13, 1.75, 0.13);
      m.add(G.box, 0x6b4a2e, px + 0.66, 0.14, pz + 0.1, 0, 0.3, 0, 0.4, 0.28, 0.3); // saco de pellets
      this.colliders.push({ minX: px - 0.32, maxX: px + 0.32, minZ: pz - 0.3, maxZ: pz + 0.3 });
    }
    sc.add(m.mesh());

    // El coche de Azul (el Ford Focus gris), aparcado al lado
    const car = makeCarHD(0x8c9096, { empty: true });
    car.root.position.set(-9, 0, -6.5);
    car.root.rotation.y = 1.1;
    // (el coche está girado: su choque, unos círculos a lo largo, no una caja recta que sobraba por las esquinas)
    {
      const fx = Math.sin(1.1), fz = Math.cos(1.1);
      for (const d of [-1.55, -0.52, 0.52, 1.55]) this.carCircles.push({ x: -9 + fx * d, z: -6.5 + fz * d, r: 0.98 });
    }
    sc.add(car.root);

    // El farolillo: la única luz cálida en toda la noche
    const lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc070, emissiveIntensity: 2.4 }));
    lampGlass.position.set(-0.32, 0.83, 0.16);
    sc.add(lampGlass);
    // (sin luz de punto: como en el cap. 2, una lámpara solo se ve encendida; su luz pintaba dianas en la mesa)
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    this.glow.position.copy(lampGlass.position);
    this.glow.scale.setScalar(0.3);
    sc.add(this.glow);

    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(0.04);
      sp.visible = false;
      this.sparks.push(sp);
      sc.add(sp);
    }

    // El pollo, que solo aparece cuando se intenta cocinar: directamente encima de la estufa, sin olla (muslos y contramuslos)
    {
      const pm = new Merger(false);
      for (const [x, z, r] of [[-0.12, -0.06, 0.4], [0.06, 0.08, -0.7], [0.14, -0.1, 1.6], [-0.06, 0.12, 2.6]] as const) {
        pm.add(G.sphere, 0xf1c9a5, x, 0.05, z, 0, r, 0.15, 0.17, 0.09, 0.12); // la carne
        pm.add(G.cyl, 0xf4ead8, x + Math.cos(r) * 0.11, 0.04, z - Math.sin(r) * 0.11, 0, r, Math.PI / 2, 0.025, 0.09, 0.025); // el hueso
      }
      this.pot.add(pm.mesh());
      this.pot.position.set(this.pellet.x - 0.02, 1.045, this.pellet.z - 0.02);
      this.pot.visible = false;
      sc.add(this.pot);
    }
    // Azul y Gas, sentados uno frente al otro
    this.azul = makePerson(AZUL_DIARIO);
    this.gas = makePerson(GAS_DIARIO);
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, seatedRootY(p, 0.44), 0); // asiento de la silla a 44 cm
      p.root.rotation.y = -sx * Math.PI / 2;
      sc.add(p.root);
    }
  }

  /** La cabaña de leña: troncos apilados con sus esquinas cruzadas, tejado de tablas, puerta y leña al lado. */
  private buildCabin(m: Merger) {
    const X = CX, Z = CZ, H = CH, LOG = 0.25, DOOR = 0.6;
    const C = [0x6b4a2e, 0x5f4128, 0x74522f];
    const n = Math.round(H / LOG);
    for (let i = 0; i < n; i++) {
      const y = LOG / 2 + i * LOG;
      const c = C[i % 3];
      // Paredes de los lados y del fondo: enteras, con los troncos sobresaliendo en las esquinas
      for (const s of [-1, 1]) m.add(G.cyl, c, s * X, y, 0, Math.PI / 2, 0, 0, LOG, Z * 2 + 0.6, LOG);
      m.add(G.cyl, C[(i + 1) % 3], 0, y + 0.01, Z, 0, 0, Math.PI / 2, LOG, X * 2 + 0.6, LOG);
      // La de delante, con el hueco de la puerta (hasta 2 m)
      if (y < 2) {
        const len = X - DOOR + 0.3;
        for (const s of [-1, 1]) m.add(G.cyl, C[(i + 1) % 3], s * (DOOR + len / 2), y + 0.01, -Z, 0, 0, Math.PI / 2, LOG, len, LOG);
      } else m.add(G.cyl, C[(i + 1) % 3], 0, y + 0.01, -Z, 0, 0, Math.PI / 2, LOG, X * 2 + 0.6, LOG);
    }
    // Marco de la puerta y suelo de tablas
    for (const s of [-1, 1]) m.add(G.box, 0x3f2c1c, s * DOOR, 1, -Z, 0, 0, 0, 0.1, 2, 0.32);
    m.add(G.box, 0x3f2c1c, 0, 2.02, -Z, 0, 0, 0, DOOR * 2 + 0.1, 0.1, 0.32);
    for (let i = 0; i < 9; i++) m.add(G.box, i % 2 ? 0x6a4d32 : 0x5f452c, 0, 0.015, -Z + 0.33 + i * 0.67, 0, 0, 0, X * 2, 0.03, 0.64);
    // Tejado a dos aguas, de tablas, con los piñones de madera
    const rise = 1.25, half = Z + 0.45;
    const slope = Math.atan2(rise, half), len = Math.hypot(rise, half);
    for (const s of [1, -1]) {
      for (let k = 0; k < 9; k++) {
        const u = (k + 0.5) / 9;
        m.add(G.box, k % 2 ? 0x4c3722 : 0x423021, 0, H + rise * (1 - u) + 0.03, s * half * u, s * slope, 0, 0, X * 2 + 0.9, 0.07, len / 9 + 0.03);
      }
      const tri = new THREE.Shape([new THREE.Vector2(-Z, 0), new THREE.Vector2(Z, 0), new THREE.Vector2(0, rise)]);
      m.add(new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }).rotateY(Math.PI / 2), 0x5a4128, s * X - 0.06, H, 0, 0, 0, 0, 1, 1, 1);
    }
    // Ventanitas con luz, una a cada lado
    for (const s of [-1, 1]) {
      m.add(G.box, 0x3f2c1c, s * (X + 0.1), 1.45, s > 0 ? -1.6 : 0.6, 0, 0, 0, 0.1, 0.8, 0.8);
      m.add(G.box, 0xffc680, s * (X + 0.16), 1.45, s > 0 ? -1.6 : 0.6, 0, 0, 0, 0.03, 0.62, 0.62);
    }
    this.buildInterior(m);
    // La pila de leña, junto a la puerta
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 7 - row; k++) m.add(G.cyl, k % 2 ? 0x8a6a44 : 0x9a7a52, 1.45 + k * 0.22 + row * 0.11, 0.11 + row * 0.19, -Z - 0.42, Math.PI / 2, 0, 0, 0.2, 0.7, 0.2);
    this.colliders.push(
      { minX: -X - 0.3, maxX: X + 0.3, minZ: Z - 0.2, maxZ: Z + 0.2 },
      { minX: -X - 0.2, maxX: -X + 0.2, minZ: -Z, maxZ: Z },
      { minX: X - 0.2, maxX: X + 0.2, minZ: -Z, maxZ: Z },
      { minX: -X - 0.3, maxX: -DOOR, minZ: -Z - 0.2, maxZ: -Z + 0.2 },
      { minX: DOOR, maxX: X + 0.3, minZ: -Z - 0.2, maxZ: -Z + 0.2 },
      { minX: 1.3, maxX: 3.2, minZ: -Z - 0.8, maxZ: -Z - 0.2, low: true },
    );
    this.door = new Door({ hinge: new THREE.Vector3(-DOOR + 0.05, 0, -Z), ry: 0, width: DOOR * 2 - 0.1, swing: -1.7, reach: 1.7, speed: 0.5 });
    const dm = new Merger();
    for (let k = 0; k < 6; k++) dm.add(G.box, k % 2 ? 0x5a4128 : 0x644a2e, 0.09 + k * 0.185, 1, 0, 0, 0, 0, 0.175, 1.96, 0.05);
    for (const y of [0.4, 1.6]) dm.add(G.box, 0x3f2c1c, 0.55, y, 0.03, 0, 0, 0, 1.08, 0.09, 0.02);
    this.door.leaf.add(dm.mesh());
    this.scene.add(this.door.group);
  }

  /**
   * Dentro, como una cabaña de verdad: a la izquierda el salón (sofá, mesita, alfombra, lámpara y la estufa de pellets
   * en el rincón), en medio la mesa, y a la derecha, tras un tabique, el dormitorio con su cama, mesilla, dos armarios
   * y el baño con ducha, váter y lavabo.
   */
  private buildInterior(m: Merger) {
    const X = CX, Z = CZ, H = CH;
    const col = (minX: number, maxX: number, minZ: number, maxZ: number, low = false) => this.colliders.push({ minX, maxX, minZ, maxZ, low });
    const PLANK = [0x8a6440, 0x7d5a38, 0x936b45];
    /** Tabique de tablas verticales, de (x0,z0) a (x1,z1) (recto en x o en z), con su choque. */
    const wall = (x0: number, z0: number, x1: number, z1: number) => {
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      const n = Math.max(1, Math.round(len / 0.2));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        m.add(G.box, PLANK[k % 3], x, H / 2, z, 0, 0, 0, alongX ? len / n + 0.002 : 0.1, H, alongX ? 0.1 : len / n + 0.002);
      }
      if (alongX) col(Math.min(x0, x1), Math.max(x0, x1), z0 - 0.08, z0 + 0.08);
      else col(x0 - 0.08, x0 + 0.08, Math.min(z0, z1), Math.max(z0, z1));
    };
    const frame = (x: number, z: number, alongX: boolean, w: number) => {
      for (const s of [-1, 1]) m.add(G.box, 0x4a3220, alongX ? x + s * w / 2 : x, 1.0, alongX ? z : z + s * w / 2, 0, 0, 0, 0.08, 2.0, 0.14);
      m.add(G.box, 0x4a3220, x, 2.03, z, 0, 0, 0, alongX ? w + 0.08 : 0.14, 0.08, alongX ? 0.14 : w + 0.08);
    };

    // --- El salón ---
    // Alfombra, sofá de tres plazas contra la pared (mira a la sala), sus cojines, mesita y lámpara de pie
    // (la alfombra, aparte y sin dibujo de superficie: con el de la escena salía como un enlosado de ladrillo)
    const rug = new Merger(false);
    rug.add(G.box, 0x8e3b2c, 0, 0.035, 0, 0, 0, 0, 2.4, 0.02, 2.6);
    rug.add(G.box, 0xd8b98a, 0, 0.04, 0, 0, 0, 0, 2.1, 0.02, 2.3);
    rug.add(G.box, 0x8e3b2c, 0, 0.045, 0, 0, 0, 0, 1.5, 0.02, 1.7);
    rug.add(G.box, 0xd8b98a, 0, 0.05, 0, 0, 0, 0, 1.3, 0.02, 1.5);
    const rugMesh = rug.mesh();
    rugMesh.position.set(-3.6, 0, -1.0);
    this.scene.add(rugMesh);
    const SOFA = 0x3f6a6a, SOFA_D = 0x335858;
    m.add(G.rbox, SOFA_D, -4.75, 0.22, -1.0, 0, 0, 0, 0.9, 0.44, 2.2); // base
    m.add(G.rbox, SOFA, -4.7, 0.5, -1.0, 0, 0, 0, 0.75, 0.16, 2.0); // asiento
    m.add(G.rbox, SOFA, -5.1, 0.78, -1.0, 0, 0, -0.1, 0.22, 0.7, 2.1); // respaldo
    for (const z of [-2.1, 0.1]) m.add(G.rbox, SOFA_D, -4.75, 0.6, z, 0, 0, 0, 0.9, 0.42, 0.2); // brazos
    for (const [z, c] of [[-1.6, 0xe0b23a], [-0.4, 0xe0b23a], [-1.0, 0x2a3b55]] as const) m.add(G.rbox, c, -4.88, 0.78, z, 0, 0, -0.25, 0.14, 0.4, 0.42); // cojines
    col(-5.3, -4.25, -2.25, 0.25);
    m.add(G.rbox, 0x6b4a2e, -3.55, 0.36, -1.0, 0, 0, 0, 0.62, 0.05, 1.0); // mesita
    for (const [dx, dz] of [[-0.25, -0.42], [0.25, -0.42], [-0.25, 0.42], [0.25, 0.42]]) m.add(G.box, 0x5a3d24, -3.55 + dx, 0.17, -1.0 + dz, 0, 0, 0, 0.05, 0.34, 0.05);
    m.add(G.cyl, 0xf4efe2, -3.6, 0.43, -1.15, 0, 0, 0, 0.12, 0.1, 0.12); // taza
    m.add(G.box, 0x7a2a2a, -3.5, 0.4, -0.8, 0, 0.4, 0, 0.22, 0.03, 0.3); // un libro
    col(-3.9, -3.2, -1.55, -0.45, true);
    m.add(G.cyl, 0x2a2a2a, -4.95, 0.75, -2.65, 0, 0, 0, 0.04, 1.5, 0.04); // lámpara de pie
    m.add(G.cyl, 0x2a2a2a, -4.95, 0.02, -2.65, 0, 0, 0, 0.32, 0.04, 0.32);
    m.add(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 14, 1, true), 0xf0d9a8, -4.95, 1.55, -2.65);
    // Un cuadro y una estantería con libros encima del sofá
    m.add(G.box, 0x4a3220, -X + 0.18, 1.55, -1.0, 0, 0, 0, 0.05, 0.62, 0.9);
    m.add(G.box, 0x6f9ec2, -X + 0.21, 1.55, -1.0, 0, 0, 0, 0.02, 0.5, 0.78);
    m.add(G.box, 0x4f8a4a, -X + 0.22, 1.42, -1.0, 0, 0, 0, 0.02, 0.18, 0.78);

    // --- El dormitorio, tras el tabique (puerta hacia la sala) ---
    const PX = 1.9;
    wall(PX, -Z + 0.15, PX, -0.45);
    wall(PX, 0.55, PX, Z - 0.15);
    frame(PX, 0.05, false, 1.0);
    m.add(G.box, 0x4a3220, PX, H - 0.1, 0.05, 0, 0, 0, 0.1, 0.2, 1.0); // dintel hasta el techo
    // La cama de matrimonio, con el cabecero contra la pared: colcha clara, manta mostaza y cojines (como en la foto)
    const BZ = -0.85, BX = 4.25;
    m.add(G.box, 0x3a2a1c, BX, 0.18, BZ, 0, 0, 0, 2.05, 0.28, 1.65); // somier
    m.add(G.rbox, 0xf1ece0, BX, 0.42, BZ, 0, 0, 0, 2.0, 0.22, 1.6); // colchón y sábanas
    m.add(G.rbox, 0xb8862e, BX - 0.55, 0.55, BZ, 0, 0, 0, 0.7, 0.05, 1.66); // la manta a los pies
    m.add(G.box, 0x6b4a2e, X - 0.12, 0.85, BZ, 0, 0, 0, 0.1, 1.05, 1.8); // cabecero de madera
    m.add(G.rbox, 0xcdb89a, X - 0.17, 0.95, BZ, 0, 0, 0, 0.06, 0.6, 1.6); // y su tapizado
    for (const [dz, c] of [[-0.4, 0xd9a43a], [0.4, 0xd9a43a], [0, 0x2a2f45]] as const) m.add(G.rbox, c, X - 0.38, 0.68, BZ + dz, 0, 0, 0.35, 0.16, 0.38, 0.5);
    col(BX - 1.05, X, BZ - 0.85, BZ + 0.85);
    // Mesilla con su lámpara
    m.add(G.rbox, 0x6b4a2e, X - 0.3, 0.27, 0.35, 0, 0, 0, 0.45, 0.54, 0.4);
    m.add(G.cyl, 0x2a2a2a, X - 0.3, 0.62, 0.35, 0, 0, 0, 0.08, 0.16, 0.08);
    m.add(new THREE.CylinderGeometry(0.1, 0.15, 0.18, 12, 1, true), 0xf0d9a8, X - 0.3, 0.78, 0.35);
    col(X - 0.55, X, 0.15, 0.55);
    // Dos armarios contra la pared de la entrada
    for (const ax of [2.6, 3.72]) {
      m.add(G.box, 0x6b4a2e, ax, 1.0, -Z + 0.42, 0, 0, 0, 1.05, 2.0, 0.6);
      m.add(G.box, 0x5a3d24, ax, 1.0, -Z + 0.725, 0, 0, 0, 0.02, 1.9, 0.01); // la raja entre las dos puertas
      for (const s of [-1, 1]) m.add(G.box, 0xc8ccd0, ax + s * 0.07, 1.05, -Z + 0.74, 0, 0, 0, 0.03, 0.22, 0.03); // tiradores
      m.add(G.box, 0x4a3220, ax, 2.02, -Z + 0.42, 0, 0, 0, 1.1, 0.05, 0.64);
    }
    col(2.05, 4.28, -Z + 0.1, -Z + 0.75);
    // --- El baño, en el rincón del fondo ---
    const BW = 3.0, BZ0 = 1.05;
    wall(BW, BZ0, BW, Z - 0.15);
    wall(BW + 0.85, BZ0, X - 0.15, BZ0);
    frame(BW + 0.43, BZ0, true, 0.75);
    m.add(G.box, 0x4a3220, BW + 0.43, H - 0.1, BZ0, 0, 0, 0, 0.8, 0.2, 0.1);
    m.add(G.box, 0xe6e4de, (BW + X) / 2, 0.025, (BZ0 + Z) / 2, 0, 0, 0, X - BW - 0.2, 0.02, Z - BZ0 - 0.2); // suelo de baldosa
    // Ducha: plato, mampara de cristal y el rociador
    m.add(G.box, 0xf4f4f2, X - 0.62, 0.05, Z - 0.6, 0, 0, 0, 0.95, 0.08, 0.95);
    m.add(G.box, 0xc8ccd0, X - 0.2, 1.9, Z - 0.25, 0, 0, 0, 0.04, 0.04, 0.04);
    m.add(G.cyl, 0xc8ccd0, X - 0.35, 1.95, Z - 0.35, 0, 0, 0, 0.14, 0.03, 0.14);
    m.add(G.cyl, 0xc8ccd0, X - 0.22, 1.35, Z - 0.22, 0, 0, 0, 0.025, 1.2, 0.025);
    col(X - 1.12, X, Z - 1.1, Z);
    // (la mampara, de cristal: aparte, transparente)
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false });
    for (const [w, x, z, ry] of [[0.95, X - 0.62, Z - 1.1, 0], [0.95, X - 1.1, Z - 0.62, Math.PI / 2]] as const) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.9), glass);
      g.position.set(x, 1.05, z);
      g.rotation.y = ry;
      g.userData.noCast = true;
      this.scene.add(g);
    }
    // Váter contra el fondo y lavabo con espejo en la pared de la derecha
    m.add(G.rbox, 0xf4f4f2, BW + 0.72, 0.22, Z - 0.42, 0, 0, 0, 0.4, 0.44, 0.5);
    m.add(G.rbox, 0xf4f4f2, BW + 0.72, 0.6, Z - 0.22, 0, 0, 0, 0.42, 0.36, 0.16);
    m.add(G.box, 0xe8e6e0, BW + 0.72, 0.45, Z - 0.5, 0, 0, 0, 0.38, 0.03, 0.42);
    col(BW + 0.48, BW + 0.96, Z - 0.7, Z);
    m.add(G.rbox, 0x6b4a2e, X - 0.3, 0.42, BZ0 + 0.55, 0, 0, 0, 0.5, 0.84, 0.7); // mueble del lavabo
    m.add(G.cyl, 0xf4f4f2, X - 0.32, 0.88, BZ0 + 0.55, 0, 0, 0, 0.42, 0.08, 0.5);
    m.add(G.box, 0x9fb8c8, X - 0.13, 1.5, BZ0 + 0.55, 0, 0, 0, 0.03, 0.6, 0.5); // espejo
    col(X - 0.58, X, BZ0 + 0.18, BZ0 + 0.92);
    // Toallas colgadas
    m.add(G.box, 0xd9a43a, BW + 0.08, 1.2, Z - 1.3, 0, 0, 0, 0.06, 0.6, 0.35);
  }

  /** Llegas en coche: Azul y Gas se bajan y hay que entrar en la cabaña a pie. */
  startWalk(camera: THREE.Camera) {
    this.azul.root.position.set(-1.6, 0, -8);
    this.azul.root.rotation.set(0, 0, 0);
    this.gas.root.position.set(-2.8, 0, -8.6);
    this.gas.root.rotation.set(0, 0, 0);
    this.walker = new Walker(this.azul.root.position);
    this.walker.yaw = this.walker.facing = 0.2;
    this.gasTrail = new Trail();
    this.inside = false;
    this.searching = false;
    this.active = null;
    camera.position.set(-2, 3, -12.5);
  }

  /**
   * Hay que ir a un sitio (la estufa, el coche, el sofá): andando, y Gas detrás (o, con `gasStay`, esperando dentro).
   * from: dónde empieza ella, si venía de una escena sin andar.
   */
  startSearch(key: CampSpot, from?: { x: number; z: number; yaw: number }, gasStay?: THREE.Vector3) {
    this.searching = true;
    this.active = key;
    this.standing = false;
    this.onSofa = false;
    this.unforce();
    this.gasStay = gasStay ?? null;
    if (from) {
      this.azul.root.position.set(from.x, 0, from.z);
      this.azul.root.rotation.set(0, from.yaw, 0);
      this.walker = new Walker(this.azul.root.position);
      this.walker.yaw = this.walker.facing = from.yaw;
      this.gasTrail = new Trail();
    } else if (!this.walker) {
      this.azul.root.position.set(-1.3, 0, -0.75);
      this.azul.root.rotation.set(0, Math.PI, 0);
      this.gas.root.position.set(0.9, 0, -0.4);
      this.gas.root.rotation.set(0, Math.PI, 0);
      this.walker = new Walker(this.azul.root.position);
      this.walker.yaw = this.walker.facing = Math.PI;
      this.gasTrail = new Trail();
    }
    this.lost.reset();
  }

  /** Humo de la estufa: bocanadas grises que suben y se deshacen. */
  smoke(secs = 5) {
    this.smokeT = secs;
    this.pot.visible = true;
  }

  /** Nubecilla de tebeo para el humo: bolas que se juntan, blancas con su raya de tinta (se tiñen de gris). */
  private puffTexture() {
    if (!this.puffTex)
      this.puffTex = canvasTex((ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const blobs: [number, number, number][] = [[0.5, 0.56, 0.26], [0.32, 0.6, 0.18], [0.68, 0.6, 0.18], [0.42, 0.38, 0.2], [0.6, 0.4, 0.17]];
        ctx.fillStyle = '#2b2233';
        for (const [x, y, r] of blobs) {
          ctx.beginPath();
          ctx.arc(x * w, y * h, r * w + 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        for (const [x, y, r] of blobs) {
          ctx.beginPath();
          ctx.arc(x * w, y * h, r * w, 0, Math.PI * 2);
          ctx.fill();
        }
      }, 128, 128);
    return this.puffTex;
  }

  /** Para el plano de la estufa: ella y él, a un lado, mirándola. */
  standAtPellet() {
    this.unforce();
    this.walker = null;
    this.searching = false;
    this.standing = true;
    const p = this.pellet;
    this.azul.root.position.set(p.x + 1.05, 0, p.z - 0.15);
    this.azul.root.rotation.set(0, Math.atan2(-1.05, 0.15), 0);
    this.gas.root.position.set(p.x + 0.35, 0, p.z - 1.05);
    this.gas.root.rotation.set(0, Math.atan2(-0.35, 1.05), 0);
  }

  /** Una copa de vino (tinto) para la mano. */
  private wineGlass() {
    const g = new THREE.Group();
    const glass = new THREE.MeshBasicMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.55, depthWrite: false });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.08, 12, 1, true), glass);
    bowl.position.y = 0.11;
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.04, 12), toon({ color: 0x6e1023 }));
    wine.position.y = 0.09;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), glass);
    stem.position.y = 0.035;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 12), glass);
    g.add(bowl, wine, stem, foot);
    g.userData.noCam = true;
    for (const c of g.children) c.userData.noCast = true;
    return g;
  }

  /** En el sofá los dos, con su copa, mirando a la estufa donde se hace el pollo. */
  sitOnSofa() {
    this.walker = null;
    this.searching = false;
    this.active = null;
    this.standing = false;
    this.onSofa = true;
    this.gasStay = null;
    for (const [p, z] of [[this.azul, -1.45], [this.gas, -0.55]] as const) {
      p.root.position.set(-4.62, seatedRootY(p, 0.58), z);
      p.root.rotation.set(0, Math.PI / 2, 0);
    }
    if (!this.glasses.length) {
      for (const p of [this.azul, this.gas]) {
        const g = this.wineGlass();
        // (el puño en el tallo: la copa, un poco por debajo de la muñeca para que la mano la rodee)
        g.position.set(0, -0.07, 0.03);
        p.handR.add(g);
        this.glasses.push(g);
      }
    }
    for (const g of this.glasses) g.visible = true;
  }

  /** Dentro: cada uno a su silla. */
  sitDown() {
    this.walker = null;
    this.searching = false;
    this.active = null;
    this.standing = false;
    this.onSofa = false;
    this.gasStay = null;
    for (const g of this.glasses) g.visible = false;
    for (const [p, sx] of [[this.azul, -1], [this.gas, 1]] as const) {
      p.root.position.set(sx * 0.85, seatedRootY(p, 0.44), 0);
      p.root.rotation.y = -sx * Math.PI / 2;
    }
  }

  /** Él intenta encender el hornillo: clic, clic, clic… y nada. */
  tryStove() {
    for (let i = 0; i < 3; i++)
      later(() => {
        audio.knock(0.5, 3200, 0.03);
        this.sparkT = 0.14;
        for (const sp of this.sparks) {
          sp.position.set(this.stove.x + (Math.random() - 0.5) * 0.05, 0.835 + Math.random() * 0.02, this.stove.z + (Math.random() - 0.5) * 0.05);
          sp.visible = true;
        }
      }, 250 + i * 420);
  }

  private sit(p: Person) {
    // (en los VRM, que manden las piernas y el brazo del muñeco: si no, se quedaban de pie, hundidos en el suelo)
    if (p.rig) p.rig.force = { legL: 1, legR: 1, body: 1, armR: 1 };
    animatePerson(p, 0.016, 'idle');
    seatPose(p);
  }

  /** De pie otra vez: el cuerpo vuelve a su animación. */
  private unforce() {
    for (const p of [this.azul, this.gas]) if (p.rig) p.rig.force = undefined;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, input: Input | null, hud: Hud) {
    this.t += dt;
    this.fx.update(dt);
    if (this.walker) {
      const w = this.walker;
      const pp = this.azul.root.position;
      w.turn(input ? input.consumeCam() : 0);
      w.canJump = false;
      // (todo el claro, también por detrás de la cabaña: antes el límite cortaba por la cabaña y era una pared invisible)
      const mag = w.move(dt, input ? input.axes() : { x: 0, y: 0 }, this.colliders, { minX: -13, maxX: 13, minZ: -14, maxZ: 7.5 }, this.carCircles);
      this.azul.root.rotation.y = w.facing;
      animatePerson(this.azul, dt, mag > 0.03 ? 'walk' : 'idle', mag, w.walk, w);
      this.who.length = 0;
      if (this.gasStay) {
        // (él, dentro, junto a la estufa)
        this.gas.root.position.copy(this.gasStay);
        this.gas.root.rotation.y = Math.atan2(this.pellet.x - this.gasStay.x, this.pellet.z - this.gasStay.z);
        animatePerson(this.gas, dt, 'idle');
      } else {
        const moving = this.gasTrail.step(this.gas.root, pp, 1.4, 3.8, dt, this.colliders, 0.26);
        animatePerson(this.gas, dt, moving ? 'walk' : 'idle', moving ? 0.8 : 0);
      }
      this.who.push(pp, this.gas.root.position);
      this.door.update(dt, this.who, camera.position);
      // A dónde hay que ir: al llegar, su botón
      const sp = this.searching && this.active ? this.spots[this.active] : null;
      const near = !!sp && Math.hypot(pp.x - sp.at.x, pp.z - sp.at.z) < sp.reach;
      if (this.searching) hud.setAction(near ? SPOT_LABEL[this.active!] : null, near);
      if (near && input && input.consumeAction()) {
        const key = this.active!;
        this.searching = false;
        audio.pop();
        hud.setAction(null);
        this.onSearched?.(key);
      }
      // Pistas, solo si se ha perdido (40 s sin avanzar): la flecha y la columna sobre la puerta o el sitio que falta
      const goal = sp ? sp.at : !this.searching && pp.z < -CZ - 0.6 && !this.inside ? this.v.set(0, 0, -CZ) : null;
      if (this.lost.tick(this.searching ? `go-${this.active}` : 'cabin', dt, !input) && goal) {
        const ang = Math.atan2(goal.x - pp.x, (sp ? goal.z : -CZ + 1) - pp.z);
        const rel = Math.atan2(Math.sin(ang - w.yaw), Math.cos(ang - w.yaw));
        hud.setArrow(pp.distanceTo(goal) < 1.6 ? null : -rel);
        beacon.at(pp.distanceTo(goal) < 1.6 ? null : goal);
      } else {
        hud.setArrow(null);
        beacon.at(null);
      }
      // Pasada la puerta, ya estás dentro
      // (dentro de verdad: entre la puerta y la pared del fondo; antes bastaba con pasar de la puerta hacia el fondo y
      // rodeando la cabaña por fuera, por detrás, contaba como haber entrado)
      if (pp.z > -CZ + 1.2 && pp.z < CZ - 0.1 && Math.abs(pp.x) < CX - 0.3 && !this.inside) this.inside = true;
      const indoor = pp.z > -CZ - 0.2 && pp.z < CZ && Math.abs(pp.x) < CX;
      w.camera(camera, dt, this.colliders, indoor ? 2.6 : 5.5, indoor ? 1.9 : 2.8);
    } else if (this.onSofa) {
      this.sit(this.azul);
      this.sit(this.gas);
      this.door.update(dt, this.who.slice(0, 0), camera.position);
      // La copa en la mano y, de vez en cuando, un sorbo (cada uno a su ritmo)
      for (const [p, ph] of [[this.azul, 0], [this.gas, 2.1]] as const) {
        const sip = Math.max(0, Math.sin(this.t * 0.9 + ph) - 0.75) * 4;
        // (brazo pegado al cuerpo y el codo doblado: la copa delante del pecho, cogida por el tallo; antes, el brazo
        // estirado hacia las rodillas y la copa flotando)
        p.armR.rotation.x = -0.45 - sip * 0.35;
        p.armR.rotation.z = 0.12;
        p.elbowR.rotation.x = -1.55 - sip * 0.45;
      }
      // La copa, siempre derecha (la mano gira con el brazo)
      for (const g of this.glasses) {
        const hand = g.parent!;
        hand.updateWorldMatrix(true, true);
        hand.getWorldQuaternion(this.glassQ).invert();
        g.quaternion.copy(this.glassQ);
        // El tallo, dentro del puño (en los VRM, el nudillo del dedo corazón; la muñeca quedaba lejos y la copa flotaba)
        const bone = hand.parent;
        const fist = (g.userData.fist ??= (bone && (bone.getObjectByName(bone.name + 'Middle1') ?? bone.getObjectByName(bone.name.replace('Hand', 'MiddleProximal')))) ?? null) as THREE.Object3D | null;
        if (fist) {
          fist.getWorldPosition(this.glassP);
          this.glassP.y -= 0.06;
          g.position.copy(hand.worldToLocal(this.glassP));
        }
      }
    } else if (this.standing) {
      animatePerson(this.azul, dt, 'idle');
      animatePerson(this.gas, dt, 'idle');
      this.door.update(dt, this.who.slice(0, 0), camera.position);
    } else {
      this.sit(this.azul);
      this.sit(this.gas);
      this.door.update(dt, this.who.slice(0, 0), camera.position);
      // Él con la mano en el hornillo; ella con las cartas
      this.gas.armR.rotation.x = -0.9 + Math.sin(this.t * 1.7) * 0.04;
      this.azul.armL.rotation.x = -0.7;
    }
    // El humo de la estufa de pellets
    if (this.smokeT > 0) {
      this.smokeT -= dt;
      if (Math.random() < dt * 9) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTexture(), color: 0x9a9a9a, transparent: true, depthWrite: false, opacity: 0.95 }));
        sp.position.set(this.pellet.x + (Math.random() - 0.5) * 0.25, 1.15, this.pellet.z - 0.05 + (Math.random() - 0.5) * 0.25);
        sp.scale.setScalar(0.3);
        this.scene.add(sp);
        this.puffs.push({ s: sp, t: 0 });
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      p.s.position.y += dt * 0.45;
      p.s.position.x -= dt * 0.12;
      p.s.scale.setScalar(0.3 + p.t * 0.55);
      p.s.material.opacity = Math.max(0, 0.95 - p.t * 0.33);
      if (p.t > 2.8) {
        this.scene.remove(p.s);
        p.s.material.dispose();
        this.puffs.splice(i, 1);
      }
    }
    if (this.sparkT > 0) {
      this.sparkT -= dt;
      for (const sp of this.sparks) {
        sp.visible = this.sparkT > 0;
        sp.material.opacity = Math.max(0, this.sparkT / 0.14);
      }
    }
    // La llama del farolillo tiembla un poco
    const fl = 1 + Math.sin(this.t * 13) * 0.04 + Math.sin(this.t * 7.3) * 0.05;
    this.glow.scale.setScalar(0.3 * fl); // (de noche el tebeo lo pinta como halo con su aro: pequeño, solo el farolillo)
    this.sky.update(camera, dt);
  }
}
