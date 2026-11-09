import * as THREE from 'three';
import { G, Merger, palmCrown } from '../entities/models';
import { toon } from '../core/gfx';
import { Surf } from '../core/surfaces';
import { ROOF_GEO, rand, type Box2 } from './ferreries';
import { menorcaTrim, menorcaWindow, LOUVRE_GREEN } from './menorcaHouse';

// Del Born a casa de Gas (cap. 2): un camino de campo menorquín con curvas, entre paredes de piedra seca, con
// barreras de acebuche, acebuches, pinos y algún lloc encalado con luz en la ventana. Entra en la calle de casa por
// el este (la calle es de sentido único hacia el oeste) y sigue por ella hasta delante del vecino.

/** El recorrido del coche, de principio a fin (en el suelo, y = 0). */
export const DRIVE_PATH = new THREE.CatmullRomCurve3(
  [
    [222, -84],
    [196, -64],
    [175, -48],
    [152, -66],
    [128, -54],
    [108, -32],
    [86, -22.4],
    [62, -21.8],
    [45, -21.8],
    [11, -21.8],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);

/** Donde empieza el coche (u del recorrido): unos metros dentro del camino, que no se vea dónde nace. */
export const DRIVE_START_U = 30 / DRIVE_PATH.getLength();

/** Lo que no se puede rellenar con casas de los alrededores (el camino pasa por ahí). */
export const ROAD_KEEP_OUT: Box2 = { minX: 36, maxX: 112, minZ: -50, maxZ: -8 };

const HALF = 2.8; // medio ancho del asfalto
const WALL = 4.6; // las paredes secas, a cada lado

const samples = DRIVE_PATH.getSpacedPoints(240);
/** Lejos del camino: ahí sí puede haber lomas (una loma encima del camino lo enterraba). */
export function farFromRoad(x: number, z: number, d = 85) {
  return samples.every((p) => Math.hypot(p.x - x, p.z - z) > d);
}

export function buildCountryRoad(sc: THREE.Scene) {
  const r = rand(23);
  const m = new Merger();

  // Asfalto: una cinta a lo largo del camino hasta donde empieza la calle (x = 45); el resto ya es la calle
  const pts = DRIVE_PATH.getSpacedPoints(300).filter((p) => p.x > 44);
  const pos: number[] = [];
  const idx: number[] = [];
  const t = new THREE.Vector3(), n = new THREE.Vector3();
  pts.forEach((p, i) => {
    t.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    n.set(-t.z, 0, t.x);
    pos.push(p.x + n.x * HALF, 0, p.z + n.z * HALF, p.x - n.x * HALF, 0, p.z - n.z * HALF);
    if (i) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // (la normal, recta hacia arriba: el asfalto es plano)
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const road = new THREE.Mesh(geo, toon({ color: 0x4a4a50, roughness: 0.92, surf: Surf.Asphalt }));
  road.userData.noCast = true;
  sc.add(road);

  // Campo: paredes secas a los dos lados, con alguna barrera de acebuche; detrás, acebuches y pinos
  const along = DRIVE_PATH.getSpacedPoints(130);
  let gate = 18;
  for (let i = 1; i < along.length; i++) {
    const a = along[i - 1], b = along[i];
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
    if (cx < 72) continue; // (más allá ya es la urbanización)
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const nx = Math.cos(yaw), nz = -Math.sin(yaw); // a la derecha del sentido de la marcha
    gate -= len;
    for (const side of [-1, 1]) {
      const wx = cx + nx * WALL * side, wz = cz + nz * WALL * side;
      if (gate < 0 && side === 1) {
        // Barrera de acebuche entre dos pilares de piedra
        for (const s of [-1, 1]) m.add(G.box, 0x8f877a, wx + Math.sin(yaw) * s * 1.3, 0.7, wz + Math.cos(yaw) * s * 1.3, 0, yaw, 0, 0.6, 1.4, 0.6);
        for (const y of [0.35, 0.7, 1.05]) m.add(G.box, 0x7a6a56, wx, y, wz, 0, yaw, 0, 0.07, 0.08, 2.0);
        continue;
      }
      // (algo más largo que el tramo: en las curvas, los trozos se tocan y no queda hueco)
      m.add(G.box, side > 0 ? 0x8f877a : 0xbfae92, wx, 0.55, wz, 0, yaw, 0, 0.55, 1.1 + (i % 3) * 0.06, len + 0.7);
    }
    if (gate < 0) gate = 34 + r() * 22;
    // Árboles detrás de las paredes, a un lado o al otro
    if (r() < 0.42) {
      const side = r() < 0.5 ? -1 : 1;
      const off = WALL + 3 + r() * 9;
      const tx = cx + nx * off * side, tz = cz + nz * off * side;
      if (r() < 0.6) {
        // Acebuche, torcido por el viento
        m.add(G.cyl, 0x5a4a38, tx, 0.9, tz, 0.15, 0, 0.1, 0.32, 1.8, 0.32);
        m.add(G.bush, 0x5a7044, tx + 0.3, 2.2, tz, 0, r() * 6, 0, 3.0, 1.8, 2.6);
      } else {
        const h = 6 + r() * 3;
        m.add(G.cyl, 0x6b5a40, tx, h / 2, tz, 0, 0, 0.06, 0.38, h, 0.38);
        for (let k = 0; k < 3; k++) m.add(G.bush, k % 2 ? 0x2f5a2c : 0x386a32, tx + (r() - 0.5) * 1.6, h + 0.2 + k * 0.4, tz + (r() - 0.5) * 1.6, 0, r() * 6, 0, 3.6 - k * 0.6, 1.3, 3.2 - k * 0.5);
      }
    }
  }

  // Dos llocs encalados, apartados del camino, con alguna ventana encendida y una palmera
  for (const [x, z] of [
    [160, -90],
    [94, -52],
  ]) {
    m.add(G.box, 0xfbf7ee, x, 2.6, z, 0, 0, 0, 10, 5.2, 7);
    menorcaTrim(m, x, 0, z, 10, 7, 5.2);
    m.add(ROOF_GEO, 0xb8623e, x, 5.2, z, 0, 0, 0, 10.6, 1.8, 7.6);
    for (const [lx, y, lit] of [[-2.6, 1.6, true], [2.6, 1.6, false], [-2.6, 4.0, false], [2.6, 4.0, true]] as [number, number, boolean][])
      menorcaWindow(m, x + lx, y, z + 3.5, 1.0, 1.2, { axis: 'z', s: 1 }, { lit, shutter: LOUVRE_GREEN, closed: !lit });
    m.add(G.cyl, 0x6b5a40, x + 6.5, 3.5, z + 4, 0, 0, 0.04, 0.4, 7, 0.4);
    palmCrown(m, x + 6.5, 7, z + 4, 2.5, 11);
  }

  const mesh = m.mesh();
  sc.add(mesh);
  return { road, mesh };
}
