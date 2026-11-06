import * as THREE from 'three';
import { G, Merger, streetLamp } from '../entities/models';
import { hdSurfaces, makeSea } from '../core/gfx';
import { ROOF_GEO } from './ferreries';
import { TownHD } from './hd/townHD';

// La llegada a Logroño desde la carretera: el Ebro, el Puente de Piedra con sus arcos y, detrás, el casco viejo
// (casas de ladrillo y revoco de cuatro o cinco alturas, con su tejado, sus balcones y sus chimeneas) del que
// salen las dos torres barrocas de la Concatedral de La Redonda.

const WALLS = [0xc98f62, 0xdcc096, 0xb5714c, 0xe6d3ae, 0xcfa476, 0xa9694a, 0xe0c7a0];
const TILE = 0xb5603b;
const STONE = 0xc9b48c;
const STONE_D = 0xa8926c;
const RED = 0xd2b07a;
const RED_D = 0xb8945e;
const DARK = 0x2a2420;

/** Una cuña: base en y = 0 y la cara de arriba subiendo de 0 (en z = -0,5) a 1 (en z = +0,5). */
const WEDGE = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5 && p.getZ(i) < 0) p.setY(i, 0);
  g.computeVertexNormals();
  return g;
})();

/** Una de las torres de La Redonda: fuste con pilastras e impostas, cuerpo de campanas abierto, tambor y cúpula. */
function tower(m: Merger, x: number, z: number) {
  const W = 5;
  m.add(G.box, RED, x, 11, z, 0, 0, 0, W, 22, W);
  m.add(G.box, RED_D, x, 0.8, z, 0, 0, 0, W + 0.5, 1.6, W + 0.5);
  for (const y of [8, 15, 22]) m.add(G.box, RED_D, x, y, z, 0, 0, 0, W + 0.45, 0.45, W + 0.45);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(G.box, RED_D, x + sx * (W / 2 - 0.05), 11, z + sz * (W / 2 - 0.05), 0, 0, 0, 0.6, 22, 0.6);
  // Ventanas del fuste en la cara que se ve
  for (const y of [5, 12, 18.5]) {
    m.add(G.box, DARK, x, y, z - W / 2 - 0.01, 0, 0, 0, 1, 2.2, 0.06);
    m.add(G.cyl, DARK, x, y + 1.1, z - W / 2 - 0.01, Math.PI / 2, 0, 0, 1, 0.06, 1);
    m.add(G.box, RED_D, x, y - 1.2, z - W / 2 - 0.08, 0, 0, 0, 1.5, 0.16, 0.2);
  }
  // Cuerpo de campanas, abierto por sus cuatro lados
  const B = 4.2;
  m.add(G.box, RED, x, 25, z, 0, 0, 0, B, 6, B);
  for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const fx = x + (nx * B) / 2, fz = z + (nz * B) / 2;
    const alongX = nz !== 0;
    m.add(G.box, DARK, fx, 24.6, fz, 0, 0, 0, alongX ? 1.7 : 0.08, 3.4, alongX ? 0.08 : 1.7);
    m.add(G.cyl, DARK, fx, 26.3, fz, alongX ? Math.PI / 2 : 0, 0, alongX ? 0 : Math.PI / 2, 1.7, 0.08, 1.7);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(G.cyl, RED_D, x + (sx * B) / 2, 25, z + (sz * B) / 2, 0, 0, 0, 0.42, 6, 0.42);
  m.add(G.box, RED_D, x, 28.2, z, 0, 0, 0, B + 0.7, 0.45, B + 0.7);
  // Tambor, cúpula de pizarra, linterna y cruz
  m.add(new THREE.CylinderGeometry(1.75, 1.95, 3, 8), RED, x, 30, z);
  m.add(new THREE.CylinderGeometry(1.95, 1.95, 0.25, 8), RED_D, x, 31.55, z);
  m.add(G.dome, 0x4f545c, x, 31.6, z, 0, 0, 0, 3.7, 3.6, 3.7);
  m.add(new THREE.CylinderGeometry(0.34, 0.38, 1.1, 8), RED, x, 33.8, z);
  m.add(G.dome, 0x4f545c, x, 34.3, z, 0, 0, 0, 0.85, 0.8, 0.85);
  m.add(G.box, 0x1e1e1e, x, 35.2, z, 0, 0, 0, 0.06, 0.9, 0.06);
  m.add(G.box, 0x1e1e1e, x, 35.35, z, 0, 0, 0, 0.42, 0.06, 0.06);
}

/** Un chopo de la ribera del Ebro: alto, estrecho y de varias matas. */
function poplar(m: Merger, x: number, z: number, h: number) {
  m.add(G.cyl, 0x6b5a46, x, h * 0.3, z, 0, 0, 0, 0.32, h * 0.6, 0.32);
  for (let k = 0; k < 6; k++) {
    const y = h * (0.3 + k * 0.12);
    const r = 1.9 - Math.abs(k - 2) * 0.38;
    m.add(G.bush, k % 2 ? 0x56803c : 0x4a7436, x + Math.sin(k * 2.1) * 0.25, y, z + Math.cos(k * 1.7) * 0.25, 0, k, 0, r, h * 0.2, r);
  }
}

export function buildLogronoTown(z0: number) {
  const g = new THREE.Group();
  const m = new Merger();
  const hd = hdSurfaces.value ? new TownHD() : null;

  // Una casa: paredes, fachada con sus balcones hacia la orilla, alero, tejado a dos aguas y chimeneas
  let n = 0;
  const house = (x0: number, x1: number, z1: number, depth: number, floors: number) => {
    const c = WALLS[n % WALLS.length];
    const h = floors * 3 + 0.8;
    const cx = (x0 + x1) / 2, w = x1 - x0, cz = z1 + depth / 2;
    if (hd) {
      hd.wall(x0, x1, z1, z1 + depth, h, c);
      hd.facade(x0 + 0.2, x1 - 0.2, z1, -1, floors);
    } else m.add(G.box, c, cx, h / 2, cz, 0, 0, 0, w, h, depth);
    // Cumbrera a lo largo de la fachada
    m.add(ROOF_GEO, TILE, cx, h + 0.22, cz, 0, 0, 0, w + 0.5, 2 + (n % 3) * 0.3, depth + 0.7);
    m.add(G.box, 0xb98f6a, cx + w * 0.22, h + 2.2, cz + depth * 0.2, 0, 0, 0, 0.7, 1.5, 0.7);
    m.add(G.box, 0x8a6a4e, cx + w * 0.22, h + 3, cz + depth * 0.2, 0, 0, 0, 0.85, 0.12, 0.85);
    if (n % 2) m.add(G.box, 0xb98f6a, cx - w * 0.28, h + 1.7, cz + depth * 0.32, 0, 0, 0, 0.55, 1.1, 0.55);
    // Bajante de zinc en la medianera
    m.add(G.cyl, 0x7c8084, x1 - 0.1, h / 2, z1 - 0.07, 0, 0, 0, 0.09, h, 0.09);
    n++;
  };

  // Primera línea, sobre el río, con la calle que entra en el casco viejo por el centro
  const FRONT = z0 + 24;
  for (const [a0, a1, dir] of [[6.5, 100, 1], [-6.5, -100, -1]] as const) {
    let x = a0;
    let i = 0;
    while ((x - a1) * dir < 0) {
      const w = 7 + ((i * 5 + (dir > 0 ? 0 : 3)) % 4);
      const floors = 4 + ((i * 7 + (dir > 0 ? 1 : 0)) % 3 === 0 ? 1 : 0);
      house(Math.min(x, x + dir * w), Math.max(x, x + dir * w), FRONT + (i % 3) * 0.35, 11, floors);
      x += dir * w;
      i++;
    }
  }
  // Segunda línea, más alta: asoman sus tejados por encima
  for (let x = -90, i = 0; x < 90; i++) {
    const w = 8 + ((i * 3) % 4);
    if (x + w < -6 || x > 6) house(x, x + w, FRONT + 15, 12, 5 + (i % 3 === 0 ? 1 : 0));
    x += w;
  }
  // Por el fondo de la calle: la plaza de La Redonda, cerrada por casas
  for (const [x, w] of [[-26, 13], [-13, 9], [17, 10]] as const) house(x, x + w, z0 + 66, 12, 5);
  // Las calles del casco viejo: suelo de losa y dos filas de casas que acompañan a la calle
  m.add(G.box, 0xbdb4a4, 0, 0.02, z0 + 64, 0, 0, 0, 240, 0.08, 96);
  for (const s of [-1, 1]) {
    if (hd) {
      hd.wall(Math.min(s * 6.5, s * 7), Math.max(s * 6.5, s * 7), FRONT + 11, z0 + 60, 13, WALLS[(s + 3) % 7]);
    } else m.add(G.box, WALLS[(s + 3) % 7], s * 6.75, 6.5, (FRONT + 11 + z0 + 60) / 2, 0, 0, 0, 0.5, 13, z0 + 60 - FRONT - 11);
  }

  // La Concatedral: fachada entre las dos torres, retablo de piedra, gran arco y la nave con su tejado
  const CX = 2.5, CZ = z0 + 62;
  tower(m, CX - 7, CZ);
  tower(m, CX + 7, CZ);
  m.add(G.box, RED, CX, 9, CZ + 1.5, 0, 0, 0, 9.2, 18, 3);
  m.add(G.box, DARK, CX, 4, CZ - 0.02, 0, 0, 0, 4.2, 7.8, 0.1);
  m.add(G.cyl, DARK, CX, 7.9, CZ - 0.02, Math.PI / 2, 0, 0, 4.2, 0.1, 4.2);
  for (const s of [-1, 1]) m.add(G.cyl, RED_D, CX + s * 2.7, 5, CZ - 0.25, 0, 0, 0, 0.55, 10, 0.55);
  m.add(G.box, RED_D, CX, 10.2, CZ - 0.2, 0, 0, 0, 7, 0.5, 0.5);
  m.add(G.box, RED_D, CX, 14.2, CZ - 0.12, 0, 0, 0, 3, 5.5, 0.3);
  m.add(G.cyl, RED, CX, 14.2, CZ - 0.32, Math.PI / 2, 0, 0, 2, 0.1, 2);
  m.add(ROOF_GEO, RED_D, CX, 18, CZ + 1.4, 0, 0, 0, 9.6, 2.2, 3.2);
  m.add(G.box, RED, CX, 8, CZ + 16, 0, 0, 0, 16, 16, 28);
  m.add(ROOF_GEO, TILE, CX, 16, CZ + 16, 0, Math.PI / 2, 0, 28.5, 3.4, 16.5);

  // Otras dos torres del casco, que asoman a lo lejos: Santiago y San Bartolomé
  for (const [x, z, h] of [[-46, z0 + 54, 26], [41, z0 + 58, 24]] as const) {
    m.add(G.box, 0xb5714c, x, h / 2, z, 0, 0, 0, 5.2, h, 5.2);
    for (const y of [h * 0.5, h * 0.8]) m.add(G.box, 0xa9694a, x, y, z, 0, 0, 0, 5.6, 0.35, 5.6);
    m.add(G.box, DARK, x, h * 0.9, z - 2.62, 0, 0, 0, 1.3, 2.6, 0.06);
    m.add(ROOF_GEO, TILE, x, h, z, 0, 0, 0, 5.8, 2.2, 5.8);
  }

  // El Ebro, con sus muros de piedra, su barandilla y una fila de chopos en cada orilla
  const sea = makeSea([520, 30], 0x3f6f76, new THREE.Vector3(0.3, 1, 0.4));
  sea.position.set(0, 0.12, z0);
  g.add(sea);
  for (const s of [-1, 1]) {
    const qz = z0 + s * 15.4;
    m.add(G.box, STONE, 0, 0.4, qz, 0, 0, 0, 520, 0.8, 0.9);
    m.add(G.box, 0x2b2f36, 0, 1.3, qz + s * 0.1, 0, 0, 0, 520, 0.05, 0.05);
    for (let x = -240; x <= 240; x += 2) if (Math.abs(x) > 6) m.add(G.box, 0x2b2f36, x, 1.05, qz + s * 0.1, 0, 0, 0, 0.05, 0.5, 0.05);
    for (let x = -96, i = 0; x <= 96; x += 13, i++) {
      if (Math.abs(x) < 10) continue;
      const tz = z0 + s * (s > 0 ? 19.5 : 19);
      poplar(m, x + ((i * 3) % 4), tz, 12 + (i % 4) * 2);
      if (i % 2) streetLamp(m, x + 6, 0, qz + s * 1.2);
    }
  }
  // La ribera de este lado: un paseo de tierra y bancos antes de llegar al puente
  m.add(G.box, 0xc9b08a, 0, 0.03, z0 - 18, 0, 0, 0, 520, 0.05, 4.4);
  for (let x = -60; x <= 60; x += 15) if (Math.abs(x) > 8) {
    m.add(G.box, 0x6b4a2e, x, 0.45, z0 - 17, 0, 0, 0, 1.9, 0.07, 0.5);
    m.add(G.box, 0x6b4a2e, x, 0.75, z0 - 17.22, 0, 0, 0, 1.9, 0.4, 0.05);
    for (const d of [-0.8, 0.8]) m.add(G.box, 0x2b2f36, x + d, 0.22, z0 - 17, 0, 0, 0, 0.06, 0.45, 0.45);
  }

  // Antes del puente: el parque de la ribera, césped, plátanos de sombra a los lados de la carretera y parterres
  for (const sx of [-1, 1]) {
    m.add(G.box, 0x6f8a4a, sx * 135, 0.025, z0 - 41, 0, 0, 0, 260, 0.05, 41);
    m.add(G.box, 0xa89f90, sx * 5.2, 0.07, z0 - 58, 0, 0, 0, 0.3, 0.14, 12);
    m.add(G.box, 0xcfc6b6, sx * 6.6, 0.06, z0 - 41, 0, 0, 0, 2.4, 0.08, 41);
    for (let z = z0 - 60, i = 0; z < z0 - 22; z += 10, i++) {
      const x = sx * 9.2;
      m.add(G.cyl, 0x8a7a62, x, 2.1, z, 0.03, 0, sx * 0.03, 0.36, 4.2, 0.36);
      m.add(G.cyl, 0x6b5a46, x, 0.3, z, 0, 0, 0, 0.46, 0.6, 0.46);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + i;
        m.add(G.bush, k % 2 ? 0x58843e : 0x4c7838, x + Math.cos(a) * 2.1, 5.6 + Math.sin(k * 2.3) * 0.6, z + Math.sin(a) * 2.1, 0, k, 0, 3, 2.3, 3);
      }
      m.add(G.bush, 0x5e8a42, x, 6.8, z, 0, i, 0, 3.8, 2.3, 3.8);
    }
    // Más árboles y setos por el parque, hasta el fondo
    for (let i = 0; i < 26; i++) {
      const x = sx * (15 + ((i * 37) % 120));
      const z = z0 - 58 + ((i * 23) % 36);
      if (i % 3 === 0) {
        m.add(G.bush, 0x4f7a38, x, 0.7, z, 0, i, 0, 3.6, 1.5, 2);
      } else {
        m.add(G.cyl, 0x6b5a46, x, 1.7, z, 0, 0, 0, 0.3, 3.4, 0.3);
        for (let k = 0; k < 5; k++) m.add(G.bush, k % 2 ? 0x5a8640 : 0x4a7638, x + Math.cos(k * 1.3) * 1.5, 4.5 + Math.sin(k * 2) * 0.5, z + Math.sin(k * 1.3) * 1.5, 0, k, 0, 2.6, 2, 2.6);
      }
    }
    for (const z of [z0 - 52, z0 - 38, z0 - 26]) {
      m.add(G.box, 0x6b4a2e, sx * 7.7, 0.45, z, 0, 0, 0, 0.5, 0.07, 1.9);
      m.add(G.box, 0x6b4a2e, sx * 7.93, 0.75, z, 0, 0, 0, 0.05, 0.4, 1.9);
    }
  }

  // El Puente de Piedra: seis arcos rebajados, tajamares, pretil y las dos rampas de subida
  const DECK = 3.9, HW = 5.4, B0 = z0 - 17, B1 = z0 + 17;
  const sh = new THREE.Shape([new THREE.Vector2(B0, 0), new THREE.Vector2(B1, 0), new THREE.Vector2(B1, DECK), new THREE.Vector2(B0, DECK)]);
  const ARCH = 2.1, RISE = 2.75;
  for (let i = 0; i < 6; i++) {
    const c = B0 + 3.2 + i * 5.52;
    const hole = new THREE.Path();
    hole.moveTo(c - ARCH, 0.02);
    hole.lineTo(c + ARCH, 0.02);
    hole.lineTo(c + ARCH, 1.3);
    hole.absellipse(c, 1.3, ARCH, RISE - 1.3, 0, Math.PI, false);
    hole.lineTo(c - ARCH, 0.02);
    sh.holes.push(hole);
  }
  const bridge = new THREE.ExtrudeGeometry(sh, { depth: HW * 2, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -HW);
  m.add(bridge, STONE, 0, 0, 0, 0, -Math.PI / 2, 0);
  for (let i = 0; i < 5; i++) {
    const c = B0 + 3.2 + i * 5.52 + 2.76;
    for (const s of [-1, 1]) {
      m.add(new THREE.CylinderGeometry(0.72, 0.84, 2.3, 8), STONE_D, s * (HW + 0.05), 1.15, c);
      m.add(G.cone, STONE_D, s * (HW + 0.05), 2.65, c, 0, Math.PI / 8, 0, 1.55, 0.7, 1.55);
    }
  }
  const asphalt = 0x4a4a50;
  m.add(G.box, asphalt, 0, DECK + 0.02, z0, 0, 0, 0, HW * 2 - 2.4, 0.04, B1 - B0);
  for (const s of [-1, 1]) {
    m.add(G.box, STONE_D, s * (HW - 0.65), DECK + 0.08, z0, 0, 0, 0, 1.3, 0.16, B1 - B0); // acera
    m.add(G.box, STONE, s * (HW - 0.14), DECK + 0.55, z0, 0, 0, 0, 0.28, 1.1, B1 - B0); // pretil
    m.add(G.box, STONE_D, s * (HW - 0.14), DECK + 1.13, z0, 0, 0, 0, 0.36, 0.08, B1 - B0);
    for (const z of [z0 - 11, z0, z0 + 11]) streetLamp(m, s * (HW - 0.45), DECK + 0.16, z);
  }
  // Rampas: la de este lado se ve de frente y la del otro baja hacia la calle
  const L = 27;
  const slope = Math.atan2(DECK, L);
  const len = Math.hypot(DECK, L);
  for (const [zc, ry] of [[B0 - L / 2, 0], [B1 + L / 2, Math.PI]] as const) {
    const dir = ry ? 1 : -1;
    m.add(WEDGE, STONE, 0, 0, zc, 0, ry, 0, HW * 2, DECK, L);
    const tilt = ry ? slope : -slope;
    m.add(G.box, asphalt, 0, DECK / 2 + 0.04, zc, tilt, 0, 0, HW * 2 - 2.4, 0.05, len);
    for (const s of [-1, 1]) {
      m.add(G.box, 0xe8e4da, s * (HW - 1.5), DECK / 2 + 0.08, zc, tilt, 0, 0, 0.12, 0.02, len);
      m.add(G.box, STONE_D, s * (HW - 0.65), DECK / 2 + 0.1, zc, tilt, 0, 0, 1.3, 0.14, len);
      m.add(G.box, STONE, s * (HW - 0.14), DECK / 2 + 0.55, zc, tilt, 0, 0, 0.28, 1.1, len);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k + 0.5) / 6;
      m.add(G.box, 0xe8e4da, 0, DECK * a + 0.07, zc - dir * (L / 2) * (1 - a * 2), tilt, 0, 0, 0.14, 0.02, 1.6);
    }
  }
  for (let k = 0; k < 4; k++) m.add(G.box, 0xe8e4da, 0, DECK + 0.05, z0 - 13 + k * 9, 0, 0, 0, 0.14, 0.02, 1.6);

  // Al fondo, la sierra; y el campo a los lados hasta el horizonte (el suelo de la carretera acaba a 200 m)
  m.add(G.box, 0xa8704a, 0, -0.03, z0 + 120, 0, 0, 0, 1400, 0.02, 1000);
  for (let i = 0; i < 9; i++) m.add(G.rock2, 0x7d8496, -340 + i * 85, 8, z0 + 420 + (i % 3) * 30, 0, i, 0, 150, 60 + (i % 4) * 16, 80);

  g.add(m.mesh());
  hd?.finish(g);
  return g;
}
