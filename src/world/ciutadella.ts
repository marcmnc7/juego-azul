import * as THREE from 'three';
import { toon, paintMat } from '../core/gfx';
import { comicHaloTexture } from '../core/comicTiles';
import { setSurface, Surf } from '../core/surfaces';
import { G, Merger, streetLamp } from '../entities/models';
import { canvasTex, mergedPlanes } from './deco';
import type { Box2 } from './ferreries';
import { buildBorn } from './born';
import { TownHD } from './hd/townHD';

// Ciutadella, compartida por el capítulo 2 (de noche, con coches, el Imperi con su terraza y poca gente) y Sant Joan
// (de día y de noche, con banderas, el Imperi sin sillas, la calle cerrada a los coches y mucha gente).
// Plano (metros, locales: el obelisco del Born en el origen):
// - el Born; hacia el este, el Carrer Major des Born con la Catedral, Ses Voltes y, al final, la Plaça Nova y la
//   Plaça Espanya; pasada la Plaça Espanya, por una calle, Sa Plaça d'es Bè;
// - por el sur del Born, entre el Casino y la esquina, una calle corta lleva a Sa Plaça d'es Pins (los pinos, los
//   bancos y la calle por donde pasan los coches, al sur).

export const STREET = { minX: 18, maxX: 70, minZ: -4.4, maxZ: 4.4 };
export const SHOP_KINDS = [
  { name: 'Avarques', bg: '#7a3a22', wood: 0x4a2c1a },
  { name: 'Sobrassada', bg: '#7a1f1f', wood: 0x3a2a20 },
  { name: 'Moda', bg: '#1f3a5a', wood: 0x1f3a2a },
  { name: 'Joieria', bg: '#2a2a3a', wood: 0x2a2424 },
];
export const ESPANYA = { minX: 70, maxX: 90, minZ: -12, maxZ: 12 };
/** Sa Plaça d'es Bè: la plaza donde se hacen botar los caballos. */
export const BE = new THREE.Vector3(113, 0, 0); // pasada la Plaça Espanya, por una calle: se llega andando
export const BE_BOX: Box2 = { minX: BE.x - 15, maxX: BE.x + 15, minZ: BE.z - 11, maxZ: BE.z + 11 };
/** Sa Plaça d'es Pins (la explanada de los pinos), al sur del Born. */
export const PINS_SQ = { minX: -4, maxX: 36, minZ: -40, maxZ: -23 };
/** La calle del sur de Pins: el carril por donde llega el coche (hacia +x), y dónde se espera en la acera. */
export const PINS_LANE_Z = -42.6;
export const PINS_WAIT = new THREE.Vector3(14, 0, PINS_LANE_Z + 1.9);
/** La calle corta del Born a Pins (entre el Casino y la esquina). */
export const PINS_STREET = { minX: 12, maxX: 18, minZ: -23, maxZ: -14 };
/** Todo lo que se puede pisar (cerrado por las manzanas). */
export const CIUTADELLA_BOUNDS: Box2 = { minX: -45.5, maxX: BE_BOX.maxX - 0.5, minZ: PINS_LANE_Z - 2, maxZ: 13.5 };

// La piedra de la Catedral, su pórtico y las casas de marès: sillares (D6a), no encalado
const MARES = 0xdcc49a;
const MARES_D = 0xc9ad80;
const PORTICO = 0xe6d9bc;
setSurface(MARES, Surf.Mares);
setSurface(MARES_D, Surf.Mares);
setSurface(PORTICO, Surf.Mares);
const IRON = 0x1e1e1e;
/** Cristal de los faroles de Ses Voltes (el mismo de las farolas del Born): brilla solo de noche (Surf.Glow). */
const LANTERN = 0xf4e6c0;

/** Halo de una lámpara encendida de noche, ya en versión de tebeo (si no, salía un segundo de foto y luego cambiaba). */
let haloMat: THREE.SpriteMaterial | null = null;
export function nightHalo() {
  if (haloMat) return haloMat;
  haloMat = new THREE.SpriteMaterial({ map: comicHaloTexture(), color: 0xffc070, transparent: true, depthWrite: false });
  haloMat.userData.comicGlow = true;
  return haloMat;
}

/** Una cuerda de banderines o un cable: barra fina entre dos puntos (3,5 cm: más fina, la tinta tiembla). */
export function cord(m: Merger, a: THREE.Vector3, b: THREE.Vector3, t = 0.035, color = IRON) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const L = Math.hypot(dx, dy, dz) || 1;
  m.add(G.box, color, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, Math.atan2(dz, dy), 0, -Math.asin(dx / L), t, L, t);
}

export interface CiutadellaOpts {
  night?: boolean;
  /** Banderas de Sant Joan. */
  fiesta?: boolean;
  /** Coches aparcados (en Sant Joan la calle está cerrada). */
  cars?: boolean;
  /** La terraza del Imperi con sus mesas y sillas (abierto). */
  terrace?: boolean;
}

export interface Ciutadella {
  group: THREE.Group;
  /** Halos de faroles y farolas (Ses Voltes, Plaça Espanya, Pins): de noche se ven. */
  halos: THREE.Sprite[];
  /** Los de las farolas del Born (su propio material). */
  bornHalos: THREE.Sprite[];
}

/** Construye Ciutadella con el obelisco en `origin`; añade sus obstáculos a `colliders` en coordenadas del mundo. */
export function buildCiutadella(sc: THREE.Scene, colliders: Box2[], origin: THREE.Vector3, o: CiutadellaOpts = {}): Ciutadella {
  const b = new Builder(sc, colliders, origin, o);
  b.buildTown();
  return { group: b.g, halos: b.halos, bornHalos: b.bornHalos };
}

class Builder {
  readonly g = new THREE.Group();
  readonly halos: THREE.Sprite[] = [];
  readonly bornHalos: THREE.Sprite[] = [];
  private hd: TownHD | null = new TownHD();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  constructor(private sc: THREE.Scene, private outer: Box2[], private origin: THREE.Vector3, private o: CiutadellaOpts) {
    this.g.position.copy(origin);
    sc.add(this.g);
  }
  private col(b: Box2) {
    this.outer.push({ ...b, minX: b.minX + this.origin.x, maxX: b.maxX + this.origin.x, minZ: b.minZ + this.origin.z, maxZ: b.maxZ + this.origin.z });
  }

  blockN = 0;
  block(m: Merger, x0: number, x1: number, z0: number, z1: number, h: number, color: number, collide = true, stone = false) {
    // Cada bloque unos milímetros distinto (y distinto de los del Born): dos manzanas en el mismo plano parpadean
    const e = Math.min(x1 - x0, 0.006 + (this.blockN++ % 6) * 0.012 + 0.012);
    if (this.hd) {
      this.hd.wall(x0, x1, z0, z1, h, color, { stone });
      if (collide) this.col({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
      return;
    }
    m.add(G.box, color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0 - (x1 - x0 > 0.1 ? e : 0), h, z1 - z0 - e);
    m.add(G.box, 0xcdbb98, (x0 + x1) / 2, h + 0.12 + e / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0 + 0.2 - e, 0.24, z1 - z0 + 0.2 - e);
    if (collide) this.col({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  }
  /** Ventanas con persianas verdes menorquinas y balcones en la cara que da a la calle. */
  /** Una tienda bajo los soportales: marco, zócalo, puerta, rótulo, estantes y su género, según el oficio. */
  shopFront(m: Merger, x: number, wz: number, side: number, k: number, signs: Map<string, { w: number; h: number; x: number; y: number; z: number; ry: number }[]>) {
    const kind = SHOP_KINDS[k % SHOP_KINDS.length];
    const z = (d: number) => wz - side * d; // d metros hacia la calle
    const wood = kind.wood;
    m.add(G.box, 0x241a14, x, 1.45, wz, 0, 0, 0, 2.1, 2.9, 0.12); // hueco oscuro
    m.add(G.box, 0xefdcb4, x, 1.48, z(0.07), 0, 0, 0, 1.92, 2.0, 0.02); // el fondo iluminado
    for (const s of [-1, 1]) m.add(G.box, wood, x + s * 1.0, 1.45, z(0.1), 0, 0, 0, 0.12, 2.9, 0.1);
    m.add(G.box, wood, x, 2.74, z(0.1), 0, 0, 0, 2.1, 0.32, 0.1);
    m.add(G.box, wood, x, 0.27, z(0.1), 0, 0, 0, 2.1, 0.54, 0.1);
    // Puerta de madera con cristal arriba, a un lado
    const dx = k % 2 ? -0.62 : 0.62;
    m.add(G.box, wood, x + dx, 1.24, z(0.11), 0, 0, 0, 0.72, 2.2, 0.06);
    m.add(G.box, 0x9fc4e0, x + dx, 1.72, z(0.145), 0, 0, 0, 0.5, 0.92, 0.015);
    m.add(G.sphere, 0xc8ccd0, x + dx - 0.27 * Math.sign(dx), 1.08, z(0.16), 0, 0, 0, 0.05, 0.05, 0.05);
    // El escaparate: del lado contrario a la puerta
    const wx = x - dx * 0.56, W = 1.1;
    m.add(G.box, wood, wx, 1.48, z(0.11), 0, 0, 0, 0.03, 1.9, 0.03);
    for (const y of [1.02, 1.56]) m.add(G.box, 0x7a5a3a, wx, y, z(0.12), 0, 0, 0, W, 0.03, 0.12);
    const row = (n: number) => Array.from({ length: n }, (_, i) => wx - W / 2 + (W * (i + 0.5)) / n);
    if (kind.name === 'Avarques') {
      for (const y of [0.6, 1.04, 1.58]) row(3).forEach((px, i) => {
        const c = [0xb5482e, 0x2f6b8a, 0xd8a23a, 0x3f7a4a, 0xc23030][(i + Math.round(y * 3) + k) % 5];
        for (const o of [-0.055, 0.055]) m.add(G.rbox, c, px + o, y + 0.035, z(0.13), 0, 0, 0, 0.09, 0.06, 0.24);
      });
    } else if (kind.name === 'Sobrassada') {
      m.add(G.box, 0x7a5a3a, wx, 2.2, z(0.13), 0, 0, 0, W, 0.03, 0.03);
      row(5).forEach((px, i) => {
        m.add(G.box, 0xd8cfb4, px, 2.14, z(0.13), 0, 0, 0, 0.01, 0.1, 0.01);
        m.add(G.capsule, i % 2 ? 0xa23a22 : 0x8a2e1c, px, 1.94 - (i % 2) * 0.05, z(0.13), 0, 0, 0, 0.11, 0.17, 0.11);
      });
      for (const y of [0.6, 1.04, 1.58]) row(4).forEach((px, i) => m.add(G.cyl, i % 2 ? 0xe2c79a : 0xd9a441, px, y + 0.1, z(0.13), 0, 0, 0, 0.14, 0.2, 0.14));
    } else if (kind.name === 'Moda') {
      m.add(G.box, 0x9aa3ad, wx, 2.22, z(0.13), 0, 0, 0, W, 0.02, 0.02);
      row(4).forEach((px, i) => {
        const c = [0xd7263d, 0xf2f2f0, 0x2a3a5a, 0xe8b23a][(i + k) % 4];
        m.add(G.rbox, c, px, 1.86, z(0.13), 0, 0, 0, 0.22, 0.56, 0.06);
        for (const s of [-1, 1]) m.add(G.rbox, c, px + s * 0.12, 1.98, z(0.13), 0, 0, s * 0.25, 0.06, 0.26, 0.05);
      });
      for (const y of [0.6, 1.04]) row(3).forEach((px, i) => m.add(G.rbox, [0xf2f2f0, 0x6b8fb0, 0xc98e64][(i + k) % 3], px, y + 0.06, z(0.13), 0, 0, 0, 0.26, 0.1, 0.18));
    } else {
      for (const y of [0.6, 1.04, 1.58]) row(3).forEach((px, i) => {
        m.add(G.box, 0x241a24, px, y + 0.02, z(0.13), 0, 0, 0, 0.28, 0.03, 0.16);
        for (let g = 0; g < 3; g++) m.add(G.sphere, i % 2 ? 0xe8c75a : 0xd9dde2, px - 0.08 + g * 0.08, y + 0.05, z(0.13), 0, 0, 0, 0.05, 0.05, 0.05);
      });
    }
    let list = signs.get(kind.name);
    if (!list) signs.set(kind.name, (list = []));
    list.push({ w: 1.9, h: 0.27, x, y: 2.74, z: z(0.16), ry: side > 0 ? Math.PI : 0 });
  }

  facade(m: Merger, x0: number, x1: number, z: number, face: 1 | -1, floors: number, alongX = true, groundFloor = true) {
    if (this.hd) return this.hd.facade(x0, x1, z, face, floors, alongX, groundFloor);
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

  sign(text: string, x: number, y: number, z: number, ry: number, w = 3.2, bg = '#f4efe2', fg = '#2a1a2e') {
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
    // (con luz: de noche, una placa no brilla sola; partida en trozos para que se combe con la pared de detrás)
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25, Math.max(1, Math.ceil(w / 0.4)), 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    s.position.set(x, y, z);
    s.rotation.y = ry;
    this.g.add(s);
  }

  buildTown() {
    const sc = this.g;
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
    if (this.hd) this.hd.b.box(this.hd.M.slabs, [35, -0.06, -8], [260, 0.1, 106], { tile: 3 });
    else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 106).rotateX(-Math.PI / 2), toon({ map: stone, roughness: 0.9 }));
      ground.position.set(35, 0, -8);
      ground.userData.noCast = true;
      sc.add(ground);
    }

    // El Born (compartido con el capítulo 2): explanada alta con el obelisco y calle alrededor
    // (de piedra el Ajuntament y con barandilla de barrotes el balcón del Casino, desde donde tiran las avellanes)
    const born = buildBorn(this.sc, this.outer, this.origin, { voltes: true, stone: true, casinoRail: true, pins: true, terrace: this.o.terrace, cars: this.o.cars, night: this.o.night });
    // Los halos de sus farolas, solo de noche (de día, en un tebeo, una farola no brilla)
    for (const h of born.halos) {
      h.visible = !!this.o.night;
      this.bornHalos.push(h);
    }
    const m = new Merger();
    const SAND = 0xe6d2a8;
    const WHITE = 0xf4f0e6;
    const lanterns = new Merger();

    // Ses Voltes: calle de arcos blancos a los dos lados
    const shopSigns = new Map<string, { w: number; h: number; x: number; y: number; z: number; ry: number }[]>();
    for (const side of [-1, 1] as const) {
      const wallZ = side * (STREET.maxZ + 0.2);
      this.block(m, 30, STREET.maxX, side < 0 ? wallZ - 8 : wallZ, side < 0 ? wallZ : wallZ + 8, 8, WHITE);
      const pz = side * 2.9;
      for (let x = 31.2; x < STREET.maxX - 0.5; x += 2.6) {
        m.add(G.box, WHITE, x, 1.6, pz, 0, 0, 0, 0.5, 3.2, 0.5);
        this.col({ minX: x - 0.25, maxX: x + 0.25, minZ: pz - 0.25, maxZ: pz + 0.25 });
        // Arco entre pilar y pilar
        m.add(new THREE.TorusGeometry(1.05, 0.22, 6, 12, Math.PI), WHITE, x + 1.3, 3.15, pz, 0, 0, 0, 1, 0.8, 1.2);
      }
      // (en dos tramos: una caja de 40 m ya no se parte y no se combaba como las paredes de detrás)
      for (const [a, b] of [[30, 50], [50, STREET.maxX]]) m.add(G.box, WHITE, (a + b) / 2, 4.3, side * 3.6, 0, 0, 0, b - a, 1.2, 1.9);
      // Faroles de hierro colgados de los soportales, encima de un pilar (antes, solo halos flotando sin farol)
      for (let k = side > 0 ? 3 : 5; k <= 13; k += 5) this.lantern(lanterns, 31.2 + k * 2.6, side);
      // Bajo los arcos, escaparates de tiendas (avarques, sobrasada, ropa, joyerías) con su luz
      for (let x = 31.6, k = 0; x < STREET.maxX - 2.4; x += 2.6, k++) {
        const wz = side * (STREET.maxZ + 0.15);
        this.shopFront(m, x + 1.3, wz, side, k + (side > 0 ? 2 : 0), shopSigns);
      }
      this.facade(m, 31, STREET.maxX - 1, wallZ, (-side) as 1 | -1, 3, true, false); // abajo van los soportales
    }
    // Entre el Born y Ses Voltes, como en Ciutadella: el Carrer Major des Born y la Catedral de Menorca
    // (gótica, de marès, con el pórtico neoclásico de 1813 y el campanario). Ses Voltes empieza en la
    // plaza de la Catedral y acaba en la Plaça Nova, junto a la Plaça Espanya.
    {
      const cz0 = STREET.maxZ + 2.2; // fachada que da a la plaza de la Catedral, junto a la calle
      // (de sillería de marès: antes, encalada de color marès)
      this.block(m, 19, 30, cz0, cz0 + 16, 16, MARES, true, true);
      // Contrafuertes góticos a lo largo de la nave
      for (let x = 20; x <= 29; x += 3) {
        m.add(G.box, MARES_D, x, 7, cz0 - 0.35, 0, 0, 0, 0.9, 14, 0.7);
        this.col({ minX: x - 0.45, maxX: x + 0.45, minZ: cz0 - 0.7, maxZ: cz0 });
      }
      // Pórtico neoclásico: cuatro columnas, entablamento y frontón
      for (const x of [21.6, 23.6, 25.6, 27.6]) {
        m.add(G.cyl, PORTICO, x, 3.6, cz0 - 1.6, 0, 0, 0, 0.42, 7.2, 0.42);
        this.col({ minX: x - 0.4, maxX: x + 0.4, minZ: cz0 - 2, maxZ: cz0 - 1.2 });
      }
      m.add(G.box, PORTICO, 24.6, 7.6, cz0 - 1.0, 0, 0, 0, 8.2, 0.8, 1.8);
      const tri = new THREE.Shape([new THREE.Vector2(-4.1, 0), new THREE.Vector2(4.1, 0), new THREE.Vector2(0, 2.2)]);
      m.add(new THREE.ExtrudeGeometry(tri, { depth: 1.6, bevelEnabled: false }).translate(0, 0, -0.8), PORTICO, 24.6, 8, cz0 - 1.0, 0, 0, 0, 1, 1, 1);
      m.add(G.box, 0x3a2a20, 24.6, 2.4, cz0 - 0.02, 0, 0, 0, 2.2, 4.4, 0.1); // portal
      m.add(G.cyl, 0x24303c, 24.6, 12.4, cz0 - 0.05, Math.PI / 2, 0, 0, 1.5, 0.12, 1.5); // rosetón (cristal)
      m.add(G.cyl, MARES_D, 24.6, 12.4, cz0 - 0.08, Math.PI / 2, 0, 0, 1.75, 0.08, 1.75);
      // Campanario: torre cuadrada que remata en octógono
      // (de sillería, con su cornisa: era una caja de Merger encalada)
      this.block(m, 27, 31, cz0 + 1, cz0 + 5, 22, MARES, false, true);
      m.add(G.cyl, MARES_D, 29, 23.5, cz0 + 3, 0, Math.PI / 8, 0, 3.6, 3, 3.6);
      // Los huecos de las campanas, oscuros
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) m.add(G.box, 0x14181f, 29 + dx * 1.01, 18.5, cz0 + 3 + dz * 1.01, 0, 0, 0, dx ? 0.05 : 1.1, 2.4, dz ? 0.05 : 1.1);
      // Al otro lado, casas señoriales de marès con balcón (de sillería)
      this.block(m, 19, 30, -22, STREET.minZ - 0.2, 10, 0xe9dcc0, true, true);
      this.facade(m, 19, 30, STREET.minZ - 0.2, 1, 3);
    }
    // Al fondo de la Plaça Espanya, la calle que lleva a Sa Plaça d'es Bè
    this.block(m, ESPANYA.maxX, BE_BOX.minX, 3, 18, 9, SAND);
    this.block(m, ESPANYA.maxX, BE_BOX.minX, -18, -3, 9, 0xeee3c8);
    this.facade(m, 3, 12, ESPANYA.maxX, -1, 2, false);
    this.facade(m, -12, -3, ESPANYA.maxX, -1, 2, false);
    this.block(m, STREET.maxX, ESPANYA.maxX, ESPANYA.maxZ, ESPANYA.maxZ + 7, 9, 0xeee3c8);
    this.block(m, STREET.maxX, ESPANYA.maxX, ESPANYA.minZ - 7, ESPANYA.minZ, 9, WHITE);
    this.block(m, STREET.maxX - 0.01, STREET.maxX + 0.01, STREET.maxZ + 0.2, ESPANYA.maxZ, 9, WHITE);
    this.block(m, STREET.maxX - 0.01, STREET.maxX + 0.01, ESPANYA.minZ, STREET.minZ - 0.2, 9, WHITE);
    this.facade(m, STREET.maxX, ESPANYA.maxX, ESPANYA.maxZ, -1, 2);
    this.facade(m, STREET.maxX, ESPANYA.maxX, ESPANYA.minZ, 1, 2);
    for (const [x, z] of [[74, -8], [74, 8], [86, -8], [86, 8], [80, -9.5], [80, 9.5]]) {
      m.add(G.cyl, 0x6b5a40, x, 1.5, z, 0, 0, 0, 0.35, 3, 0.35);
      m.add(G.sphere, 0x2f6b3a, x, 4, z, 0, 0, 0, 3.6, 2.8, 3.6);
      this.col({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
    // Farolas fernandinas en la Plaça Espanya, como las del Born (antes, dos halos flotando en mitad de la plaza)
    for (const [x, z] of [[73.5, -3.6], [73.5, 3.6], [86.5, -3.6], [86.5, 3.6]]) {
      streetLamp(m, x, 0, z);
      this.col({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
      this.addHalo(x, 4.18, z, 2.6);
    }
    for (const [x, z] of [[77, -6], [83, 6], [77, 6], [83, -6]]) {
      // Banco: tablas de madera, respaldo y dos pies de hierro (no un cajón negro debajo)
      for (const o of [-0.16, 0, 0.16]) m.add(G.box, 0x8a6a44, x, 0.46, z + o, 0, 0, 0, 1.8, 0.05, 0.14);
      const bz = z > 0 ? 0.26 : -0.26;
      for (const y of [0.68, 0.84]) m.add(G.box, 0x8a6a44, x, y, z + bz, 0, 0, 0, 1.8, 0.1, 0.04);
      for (const sx of [-0.75, 0.75]) {
        m.add(G.box, 0x2b2f36, x + sx, 0.22, z, 0, 0, 0, 0.06, 0.44, 0.46);
        m.add(G.box, 0x2b2f36, x + sx, 0.66, z + bz, 0, 0, 0, 0.05, 0.5, 0.05);
      }
      this.col({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.25, maxZ: z + 0.25 });
    }
    // La barra de hierro de la que cuelga el rótulo de Ses Voltes, entre los dos soportales
    m.add(G.box, 0x2b2f36, 31.2, 4.7, 0, 0, 0, 0, 0.07, 0.07, 5.4);
    for (const z of [-1.2, 1.2]) m.add(G.box, 0x2b2f36, 31.2, 4.57, z, 0, 0, 0, 0.04, 0.26, 0.04);
    sc.add(m.mesh());
    sc.add(lanterns.mesh());
    // Los rótulos de las tiendas (uno por oficio, un material por rótulo)
    for (const [text, planes] of shopSigns) {
      const tex = canvasTex((ctx, w, h) => {
        ctx.fillStyle = SHOP_KINDS.find((k) => k.name === text)!.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#e8d7a8';
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.fillStyle = '#f6ecd0';
        ctx.font = 'bold 40px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 2);
      }, 256, 72);
      // (con luz: de noche, con las tiendas cerradas, un rótulo pintado no brilla solo)
      sc.add(mergedPlanes(planes, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })));
    }

    // Rótulos de verdad
    // (cada uno donde se ve: Ses Voltes colgado de su barra, nada detrás de balcones ni dentro de un muro)
    this.sign('Ses Voltes', 31.12, 4.08, 0, -Math.PI / 2, 3);
    this.sign('Carrer Major des Born', 19.2, 3.12, -4.5, 0, 3.6);
    this.sign('Catedral de Menorca', 24.6, 7.6, STREET.maxZ + 2.2 - 1.95, Math.PI, 3);
    this.sign('Plaça Nova', 70.06, 3, 6.5, Math.PI / 2, 3);
    this.sign('Plaça Espanya', 70.06, 3, -6.5, Math.PI / 2, 3.4);
    this.sign('Maramao', 40, 3.25, 4.47, Math.PI, 2.6);

    // Sa Plaça d'es Bè: plaza cerrada de casas de marès con persianas verdes, y los caballos en medio
    {
      const pm = new Merger();
      const { minX: x0, maxX: x1, minZ: z0, maxZ: z1 } = BE_BOX;
      // (casas de marès: sillería; la blanca, encalada)
      this.block(pm, x1 + 0.2, x1 + 7, z0 - 7, z1 + 7, 9, SAND, true, true);
      this.block(pm, x0, x1, z0 - 7, z0 - 0.2, 10, WHITE);
      this.block(pm, x0, x1, z1 + 0.2, z1 + 7, 8, 0xeee3c8, true, true);
      this.facade(pm, x0, x1, z0 - 0.2, 1, 3);
      this.facade(pm, x0, x1, z1 + 0.2, -1, 2);
      this.facade(pm, 3, z1, x0, 1, 2, false);
      this.facade(pm, z0, -3, x0, 1, 2, false);
      this.facade(pm, z0, z1, x1 + 0.2, -1, 2, false);
      // Banderas de punta a punta
      const fg = new THREE.ConeGeometry(0.28, 0.6, 3).rotateZ(Math.PI);
      const fc = [0xd7263d, 0xffffff, 0x1f5fbf, 0xf4d35e];
      for (const dz of this.o.fiesta ? [-6, 0, 6] : [])
        for (let i = 0; i <= 36; i++) {
          const k = i / 36;
          const y = 7 - Math.sin(k * Math.PI) * 1.4;
          pm.add(fg, fc[i % fc.length], x0 + (x1 - x0) * k, y, BE.z + dz, 0, Math.PI / 2, 0, 1, 1, 0.15);
          // La cuerda de la que cuelgan (antes flotaban en fila)
          if (i < 36) {
            const k2 = (i + 1) / 36;
            cord(pm, this.v1.set(x0 + (x1 - x0) * k, y + 0.3, BE.z + dz), this.v2.set(x0 + (x1 - x0) * k2, 7 - Math.sin(k2 * Math.PI) * 1.4 + 0.3, BE.z + dz));
          }
        }
      // (con las casas en HD, en pm solo van las banderas: sin fiesta queda vacío y no se monta)
      if (this.o.fiesta || !this.hd) sc.add(pm.mesh());
      this.buildBeStatue(sc);
      this.sign('Sa Plaça d’es Bè', x0 + 0.05, 3.12, 4.6, Math.PI / 2, 3.6);
      this.sign('A Sa Plaça d’es Bè →', ESPANYA.maxX - 0.05, 3.12, 5, -Math.PI / 2, 3.2);
      // (sin luz de punto encima de la plaza: las lámparas no iluminan nada)
    }

    if (this.o.fiesta) {
      // Banderas de fiesta cruzando el Born y Ses Voltes
      const flags = new Merger();
      const flagGeo = new THREE.ConeGeometry(0.28, 0.6, 3).rotateZ(Math.PI);
      const colors = [0xd7263d, 0xffffff, 0x1f5fbf, 0xf4d35e];
      for (const [ax, az, bx, bz, h] of [[-14, 13, -14, -13, 7], [-6, 13, -6, -13, 7], [6, 13, 6, -13, 7], [14, 13, 14, -13, 7], [-18, 6, 18, 6, 7.5], [-18, -6, 18, -6, 7.5], [24, 4.4, 24, -4.4, 5.5], [36, 4.4, 36, -4.4, 5.5], [48, 4.4, 48, -4.4, 5.5], [60, 4.4, 60, -4.4, 5.5]]) {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.floor(len / 0.8);
        const at = (k: number, out: THREE.Vector3) => out.set(ax + (bx - ax) * k, h - Math.sin(k * Math.PI) * 1.2, az + (bz - az) * k);
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          at(k, this.v1);
          flags.add(flagGeo, colors[i % colors.length], this.v1.x, this.v1.y, this.v1.z, 0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0, 1, 1, 0.15);
          // La cuerda, de banderín a banderín (antes flotaban en fila sin nada que los sujetara)
          if (i < n) cord(flags, this.v1.setY(this.v1.y + 0.3), at((i + 1) / n, this.v2).setY(this.v2.y + 0.3));
        }
      }
      const fm = flags.mesh();
      fm.userData.noCast = true;
      sc.add(fm);
    }

    this.buildPins();
    // (fuera las luces de punto de la calle y la plaza: hacían charcos de luz que no salían de ninguna lámpara)
    this.hd?.finish(this.g);
  }

  /**
   * Farol de hierro colgado de la viga de los soportales de Ses Voltes (side: lado de la calle), con su brazo, su
   * sombrerete y el cristal que de noche se ve encendido (con su halo de tebeo).
   */
  lantern(m: Merger, x: number, side: number) {
    const face = side * 2.65, z = side * 2.28, y = 3.92;
    m.add(G.box, IRON, x, 4.3, (face + z) / 2, 0, 0, 0, 0.04, 0.04, Math.abs(face - z) + 0.04); // brazo
    m.add(G.box, IRON, x, 4.2, z, 0, 0, 0, 0.035, 0.16, 0.035); // colgadero
    m.add(G.cone, IRON, x, 4.16, z, 0, Math.PI / 4, 0, 0.42, 0.16, 0.42); // sombrerete
    m.add(G.box, LANTERN, x, y, z, 0, 0, 0, 0.22, 0.36, 0.22); // cristal
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(G.box, IRON, x + dx * 0.115, y, z + dz * 0.115, 0, 0, 0, 0.035, 0.38, 0.035);
    m.add(G.box, IRON, x, y - 0.21, z, 0, 0, 0, 0.27, 0.05, 0.27); // base
    this.addHalo(x, y, z, 1.7);
  }

  /** Halo de tebeo de una lámpara, escondido de día. */
  addHalo(x: number, y: number, z: number, size: number) {
    const s = new THREE.Sprite(nightHalo());
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    s.visible = !!this.o.night;
    this.g.add(s);
    this.halos.push(s);
  }

  /**
   * El Bè, en medio de la plaza: la columna blanca, gastada abajo, con su placa de bronce y, en lo alto, el
   * cordero de bronce con la bandera.
   */
  buildBeStatue(sc: THREE.Object3D) {
    const H = 4.1, R0 = 0.215;
    const col = new Merger();
    col.add(new THREE.CylinderGeometry(R0 - 0.01, R0, H, 28), 0xeee9dd, 0, H / 2, 0);
    // Los desconchones de abajo y un zócalo apenas marcado
    col.add(new THREE.CylinderGeometry(R0 + 0.004, R0 + 0.006, 0.24, 28), 0xc9c1ae, 0, 0.12, 0);
    for (let i = 0; i < 9; i++) col.add(G.box, i % 2 ? 0x9a927f : 0xb5ad99, Math.cos(i * 1.9) * R0, 0.1 + (i % 4) * 0.07, Math.sin(i * 1.9) * R0, 0, -i * 1.9, 0, 0.012, 0.05 + (i % 3) * 0.03, 0.07);
    col.add(new THREE.CylinderGeometry(0.3, 0.27, 0.05, 28), 0xc9c1ae, 0, 0.025, 0);
    // Placa de bronce, mirando a quien entra en la plaza
    col.add(G.box, 0x2c2f2c, -R0 - 0.012, 2.3, 0, 0, 0, 0, 0.02, 0.28, 0.4);
    col.add(G.box, 0x4a4c44, -R0 - 0.024, 2.3, 0, 0, 0, 0, 0.008, 0.2, 0.32);
    const cm = col.mesh();
    cm.position.set(BE.x, 0, BE.z);
    sc.add(cm);

    const B = 0x2e3230, B2 = 0x3c403a;
    const r = new Merger(false);
    r.add(new THREE.CylinderGeometry(0.29, 0.27, 0.07, 24), B, 0, 0.035, 0);
    // Cuerpo: una masa de vellones pequeños sobre un tonel, como un cordero de bronce de verdad
    r.add(G.sphere, B, 0, 0.5, 0, 0, 0, 0, 0.42, 0.4, 0.74);
    for (let i = 0; i < 70; i++) {
      const a = i * 2.399, py = 1 - ((i + 0.5) / 70) * 1.55, rr = Math.sqrt(Math.max(0, 1 - py * py));
      const s = 0.085 + (i % 3) * 0.012;
      r.add(G.sphere, i % 3 ? B : B2, Math.cos(a) * rr * 0.205, 0.5 + py * 0.195, Math.sin(a) * rr * 0.36, 0, i, 0, s, s * 0.9, s);
    }
    // Cuello, cabeza alargada con su hocico, orejas y cuernos enroscados
    r.add(G.capsule, B, 0, 0.72, 0.36, 0.65, 0, 0, 0.17, 0.12, 0.17);
    r.add(G.sphere, B, 0, 0.92, 0.5, 0.25, 0, 0, 0.17, 0.19, 0.27);
    r.add(G.sphere, B2, 0, 0.87, 0.63, 0.25, 0, 0, 0.1, 0.1, 0.13);
    for (let i = 0; i < 9; i++) r.add(G.sphere, B2, Math.cos(i * 2.4) * 0.05, 1.0 + (i % 2) * 0.012, 0.46 + Math.sin(i * 2.4) * 0.05, 0, 0, 0, 0.055, 0.05, 0.055);
    for (const s of [-1, 1]) {
      r.add(new THREE.TorusGeometry(0.05, 0.017, 7, 16), B2, s * 0.105, 0.95, 0.44, 0, Math.PI / 2, 0);
      r.add(G.sphere, B, s * 0.125, 0.93, 0.52, 0, 0, s * 0.7, 0.085, 0.03, 0.045);
    }
    // Patas: tres apoyadas en el disco, con su pezuña, y la mano delantera levantada, sujetando el asta
    for (const [x, z] of [[-0.11, -0.25], [0.11, -0.25], [0.11, 0.24]] as const) {
      r.add(G.cyl, B, x, 0.2, z, 0, 0, 0, 0.06, 0.34, 0.06);
      r.add(G.cyl, B2, x, 0.09, z, 0, 0, 0, 0.075, 0.05, 0.075);
    }
    r.add(G.cyl, B, -0.13, 0.42, 0.37, 1.05, 0, 0, 0.055, 0.28, 0.055);
    r.add(G.sphere, B, 0, 0.56, -0.4, 0, 0, 0, 0.09, 0.12, 0.1); // rabo
    // El asta, inclinada, con la bandera grande cayendo hacia atrás
    r.add(G.cyl, 0x1e201e, -0.16, 0.68, 0.46, 0.08, 0, 0.02, 0.022, 1.36, 0.022);
    r.add(G.sphere, B2, -0.14, 1.37, 0.51, 0, 0, 0, 0.05, 0.05, 0.05);
    const fl = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.14, 0.04), new THREE.Vector2(-0.46, -0.18), new THREE.Vector2(-0.78, -0.62), new THREE.Vector2(-0.46, -0.58), new THREE.Vector2(-0.3, -0.72), new THREE.Vector2(-0.04, -0.5)]);
    r.add(new THREE.ExtrudeGeometry(fl, { depth: 0.012, bevelEnabled: false }).translate(0, 0, -0.006), 0x262a28, -0.14, 1.33, 0.5, 0, Math.PI / 2 + 0.25, 0);
    const rm = r.mesh();
    // Mira hacia la calle por donde se entra
    rm.position.set(BE.x, H, BE.z);
    rm.rotation.y = -Math.PI / 2;
    sc.add(rm);
    this.col({ minX: BE.x - 0.3, maxX: BE.x + 0.3, minZ: BE.z - 0.3, maxZ: BE.z + 0.3, round: true });
  }

  /**
   * Sa Plaça d'es Pins: explanada de tierra con pinos piñoneros, bancos y farolas; al norte, las traseras del Born y
   * la calle corta que sube a él; al sur, la calle de los coches con su acera y una fila de casas.
   */
  private buildPins() {
    const m = new Merger();
    const S = PINS_SQ;
    const SAND = 0xe6d2a8, WHITE = 0xf4f0e6, OCHRE = 0xeee3c8;
    // Manzanas alrededor (cerradas: no se sale del pueblo)
    this.block(m, -54, -4, S.minZ, S.maxZ, 9, SAND); // oeste
    this.block(m, -62, -46, -56, S.maxZ, 9, WHITE); // fondo oeste de la calle
    this.block(m, 30, 60, S.maxZ, -12.8, 10, OCHRE); // entre Pins y Ses Voltes
    this.block(m, S.maxX, 60, S.minZ, S.maxZ, 9, WHITE); // este
    this.block(m, 60, 68, -56, -12.8, 9, SAND); // fondo este de la calle
    for (const [x0, x1, c] of [[-46, -8, OCHRE], [-8, 22, SAND], [22, 60, WHITE]] as [number, number, number][]) this.block(m, x0, x1, -56, PINS_LANE_Z - 3, 9, c);
    // Fachadas que dan a la plaza, a la calle de los coches y a la calle corta
    this.facade(m, S.minX, 12, S.maxZ, -1, 2);
    this.facade(m, 18, 36, S.maxZ, -1, 2);
    this.facade(m, S.minZ, S.maxZ, S.minX, 1, 2, false);
    this.facade(m, S.minZ, S.maxZ, S.maxX, -1, 2, false);
    this.facade(m, -44, 58, PINS_LANE_Z - 3, 1, 2);
    this.facade(m, PINS_STREET.minZ, PINS_STREET.maxZ, PINS_STREET.minX, 1, 2, false);
    this.facade(m, PINS_STREET.minZ, PINS_STREET.maxZ, PINS_STREET.maxX, -1, 2, false);
    // La calle de los coches (asfalto, bordillo y acera)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(106, S.minZ - (PINS_LANE_Z - 1.8)).rotateX(-Math.PI / 2), toon({ color: 0x4a4a50, roughness: 0.92, surf: Surf.Asphalt }));
    road.position.set(7, 0.02, (S.minZ + PINS_LANE_Z - 1.8) / 2);
    road.userData.noCast = true;
    this.g.add(road);
    const KERB = 0xcfc6b4;
    m.add(G.box, KERB, 7, 0.06, S.minZ, 0, 0, 0, 106, 0.12, 0.18);
    m.add(G.box, KERB, 7, 0.06, PINS_LANE_Z - 1.8, 0, 0, 0, 106, 0.12, 0.18);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(106, 1.2).rotateX(-Math.PI / 2), toon({ color: 0xd8cfbd, roughness: 0.9, surf: Surf.Paving }));
    walk.position.set(7, 0.035, PINS_LANE_Z - 2.4);
    walk.userData.noCast = true;
    this.g.add(walk);
    // Línea discontinua en medio de la calle
    const lines = new Merger();
    const flatG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let x = -44; x < 58; x += 4) lines.add(flatG, 0xf2f0ea, x, 0.021, PINS_LANE_Z + 0.55, 0, 0, 0, 2, 1, 0.1);
    const lm = new THREE.Mesh(lines.build(), paintMat());
    lm.userData.noCast = true;
    this.g.add(lm);
    // La explanada: tierra clara apisonada
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(S.maxX - S.minX, S.maxZ - S.minZ).rotateX(-Math.PI / 2), toon({ color: 0xd9c49a, roughness: 1, surf: Surf.Paving }));
    dirt.position.set((S.minX + S.maxX) / 2, 0.03, (S.minZ + S.maxZ) / 2);
    dirt.userData.noCast = true;
    this.g.add(dirt);
    // Los pinos piñoneros: tronco alto e inclinado y la copa ancha y plana, como una sombrilla
    for (const [x, z, lean] of [[2, -27, 0.12], [9, -33, -0.1], [16, -27.5, 0.08], [23, -34, 0.14], [30, -28, -0.12], [4, -36.5, -0.08], [27, -37, 0.1], [12.5, -37.8, 0.05], [19.5, -31, -0.06]] as [number, number, number][]) {
      const h = 7 + ((x * 7) % 3) * 0.5;
      const tx = x + Math.sin(lean) * h * 0.5;
      m.add(G.cyl, 0x7a5a40, (x + tx) / 2, h / 2, z, 0, 0, -lean, 0.36, h, 0.36);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + x;
        m.add(G.bush, k % 2 ? 0x2f5a2c : 0x3a6a32, tx + Math.cos(a) * (k ? 2.1 : 0), h + 0.4 + (k % 3) * 0.25, z + Math.sin(a) * (k ? 1.9 : 0), 0, a, 0, 3.4, 1.3, 3.0);
      }
      this.col({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
    // Bancos de madera y farolas fernandinas
    for (const [x, z] of [[6, -29.5], [20, -36], [26, -25.5], [12, -25.5]]) {
      for (const dz of [-0.16, 0, 0.16]) m.add(G.box, 0x8a6a44, x, 0.46, z + dz, 0, 0, 0, 1.8, 0.05, 0.14);
      for (const y of [0.68, 0.84]) m.add(G.box, 0x8a6a44, x, y, z + 0.26, 0, 0, 0, 1.8, 0.1, 0.04);
      for (const sx of [-0.75, 0.75]) {
        m.add(G.box, 0x2b2f36, x + sx, 0.22, z, 0, 0, 0, 0.06, 0.44, 0.46);
        m.add(G.box, 0x2b2f36, x + sx, 0.66, z + 0.26, 0, 0, 0, 0.05, 0.5, 0.05);
      }
      this.col({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.25, maxZ: z + 0.25 });
    }
    for (const [x, z] of [[0, -39], [21, -39], [31, -39], [7, -24], [33, -24]]) {
      streetLamp(m, x, 0, z);
      this.col({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
      this.addHalo(x, 4.18, z, 2.6);
    }
    for (const [x, z] of [[14.5, PINS_STREET.minZ + 0.6], [30, -16]]) {
      streetLamp(m, x, 0, z);
      this.col({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
      this.addHalo(x, 4.18, z, 2.6);
    }
    this.g.add(m.mesh());
    // Rótulos: en la plaza y en la calle que baja del Born
    this.sign('Plaça des Pins', 4, 3.1, S.maxZ - 0.1, Math.PI, 3.4);
    this.sign('Plaça des Pins', PINS_STREET.maxX - 0.08, 3.1, -16.5, -Math.PI / 2, 3);
  }
}
