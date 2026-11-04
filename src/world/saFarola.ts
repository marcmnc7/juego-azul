import * as THREE from 'three';
import { G, Merger, makePerson, palmCrown, type Person } from '../entities/models';
import { toon, glowTexture, makeSea } from '../core/gfx';
import { ROOF_GEO, type Box2 } from './ferreries';
import { canvasTex } from './deco';

// Alrededores de la casa de los padres de Azul, en Ciutadella, hasta la punta de Sa Farola, como en
// las fotos de Street View:
// - La calle de la casa baja al Camí de sa Farola, que va pegado al mar: asfalto gastado, arcén de
//   tierra con matorral y un pretil bajo de marès; al otro lado, muros de piedra seca con pilares
//   blancos, adelfas, palmeras datileras, pinos, coches aparcados y postes de madera con el cable.
// - La placita del faro: adoquín, bancos, un árbol grande, el panel y la casita blanca de teja blanca.
// - El faro de Ciutadella: torre con franjas verticales blancas y negras pegada a la casa del farero,
//   dos galerías y linterna; un muro de hormigón la protege del mar.
// - Al otro lado de la bocana, el Castell de Sant Nicolau (torre octogonal) y algún llaüt navegando.

export const COAST_Z = -46;
/** El faro está al final de la calle de Azul: saliendo de casa a la derecha, al fondo. */
export const LIGHTHOUSE = new THREE.Vector3(-79, 0, 13.5);
/** Desde el mar (el kayak) se ve en la punta, sobre las rocas. */
export const LIGHTHOUSE_SEA = new THREE.Vector3(-33, 0, -52.5);
/** Al final de la calle, delante del faro: el final del paseo con Joy y Eric. */
export const FAROLA_WALK = new THREE.Vector3(-69, 0, 13.5);

const WHITE = 0xf6f1e6;
const SHUTTER = 0x2f7a4a;

/** Franjas verticales blancas y negras de la torre. */
function stripeTexture() {
  return canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#f4f2ec';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c1c20';
    for (let i = 0; i < 8; i++) ctx.fillRect((i * w) / 8, 0, w / 16, h);
  }, 256, 64);
}

/** Chalet menorquín: blanco, persianas verdes, tejado de teja o azotea con pretil, muro y buganvilla. */
function villa(m: Merger, x: number, z: number, faceX: 1 | -1, colliders: Box2[], seed: number) {
  const w = 8 + (seed % 3);
  const d = 7 + (seed % 2) * 2;
  const h = seed % 2 ? 5.6 : 3.2;
  m.add(G.box, WHITE, x, h / 2, z, 0, 0, 0, d, h, w);
  if (seed % 3 === 0) m.add(G.box, WHITE, x, h + 0.25, z, 0, 0, 0, d + 0.2, 0.5, w + 0.2); // azotea con pretil
  else m.add(ROOF_GEO, 0xb8623e, x, h, z, 0, 0, 0, w + 0.4, 1.4, d + 0.4);
  const fx = x + faceX * (d / 2 + 0.05);
  for (const wz of [-w / 4, w / 4])
    for (const y of h > 4 ? [1.4, 4.1] : [1.4]) {
      m.add(G.box, 0x30384a, fx, y, z + wz, 0, 0, 0, 0.05, 1.1, 0.9);
      for (const s of [-1, 1]) m.add(G.box, SHUTTER, fx + faceX * 0.06, y, z + wz + s * 0.7, 0, 0, 0, 0.05, 1.2, 0.48);
    }
  m.add(G.box, 0x6b4a2e, fx, 1.05, z, 0, 0, 0, 0.06, 2.1, 1.0); // puerta
  // Por detrás (lo que se ve desde el mar): ventanas con persiana, un toldo y la chimenea
  const bx = x - faceX * (d / 2 + 0.05);
  for (const wz of [-w / 3, 0, w / 3])
    for (const y of h > 4 ? [1.5, 4.2] : [1.5]) {
      m.add(G.box, 0x30384a, bx, y, z + wz, 0, 0, 0, 0.05, 1.0, 0.8);
      for (const s of [-1, 1]) m.add(G.box, SHUTTER, bx - faceX * 0.06, y, z + wz + s * 0.62, 0, 0, 0, 0.05, 1.1, 0.42);
    }
  m.add(G.box, seed % 2 ? 0x2f6a9a : 0xb8453a, bx - faceX * 0.7, 2.55, z, 0, 0, faceX * 0.35, 1.5, 0.05, w * 0.5);
  m.add(G.box, WHITE, x + faceX * 1.5, h + 0.9, z + w / 2 - 1.2, 0, 0, 0, 0.6, 1.4, 0.6);
  // Jardín delante con muro encalado y buganvilla
  const gx = x + faceX * (d / 2 + 3.2);
  for (const [z0, z1] of [[z - w / 2 - 1, z - 0.8], [z + 0.8, z + w / 2 + 1]]) {
    m.add(G.box, WHITE, gx, 0.6, (z0 + z1) / 2, 0, 0, 0, 0.3, 1.2, z1 - z0);
    colliders.push({ minX: gx - 0.2, maxX: gx + 0.2, minZ: z0, maxZ: z1, low: true });
  }
  for (let i = 0; i < 8; i++) m.add(G.bush, i % 3 ? 0xc2307a : 0x2f6b3a, gx, 1.3 + Math.sin(i + seed) * 0.15, z - w / 2 + i * 0.6, 0, 0, 0, 0.45, 0.5, 0.6);
  colliders.push({ minX: Math.min(x - d / 2, gx) - 0.1, maxX: Math.max(x + d / 2, gx) + 0.1, minZ: z - w / 2 - 1, maxZ: z + w / 2 + 1 });
  // Palmera o pino en el jardín
  const tx = x + faceX * (d / 2 + 1.6);
  const tz = z + (seed % 2 ? w / 3 : -w / 3);
  m.add(G.cyl, 0x6b5a40, tx, 2.5, tz, 0.05, 0, 0.05, 0.3, 5, 0.3);
  palmCrown(m, tx, 5, tz, 2.3, 12);
}

export interface SaFarola {
  lamp: THREE.Vector3;
  sea: THREE.Mesh;
  walkers: Person[];
}

/** Construye la calle, el paseo y el faro. day: colores de día (el eclipse) o de noche (la cena). */
export function buildSaFarola(sc: THREE.Scene, colliders: Box2[], day: boolean, faro = LIGHTHOUSE): SaFarola {
  const m = new Merger();
  // Como en Street View: la calle de la casa baja hasta el Camí de sa Farola, que va pegado al mar
  // (asfalto gastado, arcén de tierra y un pretil bajo de marès sobre las rocas) con casas detrás de
  // muros de piedra seca con pilares blancos, adelfas, palmeras datileras, pinos y postes de madera.
  // Al final, la placita del faro: adoquín, bancos, un árbol grande, el panel, la casita blanca de
  // tejado de teja blanca y el faro.
  const ROAD_Z = COAST_Z + 5.5;
  m.add(G.box, 0x4a4a50, -20, -0.03, -14, 0, 0, 0, 6, 0.1, 54); // calle que baja al mar
  m.add(G.box, 0x4a4a50, 13, -0.02, ROAD_Z, 0, 0, 0, 74, 0.1, 6); // Camí de sa Farola
  for (let x = -22; x < 50; x += 3) m.add(G.box, 0xe8e4da, x, 0.035, ROAD_Z, 0, 0, 0, 1.6, 0.01, 0.12); // línea discontinua
  m.add(G.box, 0xc9b48a, 13, -0.01, COAST_Z + 1.85, 0, 0, 0, 74, 0.1, 1.3); // arcén de tierra
  // Pretil bajo de marès sobre las rocas
  m.add(G.box, 0xc9b48f, 13, 0.25, COAST_Z + 1.0, 0, 0, 0, 74, 0.5, 0.45);
  m.add(G.box, 0xb8a37e, 13, 0.52, COAST_Z + 1.0, 0, 0, 0, 74, 0.06, 0.5);
  colliders.push({ minX: -21.5, maxX: 50, minZ: COAST_Z + 0.7, maxZ: COAST_Z + 1.3, low: true });
  // Matorral seco en el arcén y alguna señal
  for (let i = 0; i < 14; i++) m.add(G.bush, i % 2 ? 0x7d8a52 : 0x8f9a5e, -12 + i * 5.1 + Math.sin(i) * 1.2, 0.35, COAST_Z + 1.9, 0, i, 0, 1.2, 0.7, 0.8);
  for (const x of [-14, 22]) {
    m.add(G.cyl, 0x9a9ea2, x, 1.2, COAST_Z + 2.2, 0, 0, 0, 0.07, 2.4, 0.07);
    m.add(G.cone, 0xf4f4f2, x, 2.5, COAST_Z + 2.2, 0, 0, 0, 0.9, 0.8, 0.1);
  }
  // Lado de tierra: muros de piedra seca con pilares blancos y cancelas, adelfas, palmeras y pinos
  const LAND_Z = ROAD_Z + 3.4;
  for (let x = -16.5; x < 50; x += 9) {
    m.add(G.box, 0xbfae92, x + 4.5, 0.6, LAND_Z, 0, 0, 0, 7.6, 1.2, 0.6);
    m.add(G.box, WHITE, x, 0.75, LAND_Z, 0, 0, 0, 0.6, 1.5, 0.7);
    m.add(G.box, WHITE, x + 9 - 0.6, 0.75, LAND_Z, 0, 0, 0, 0.6, 1.5, 0.7);
    m.add(G.box, 0x8a6a44, x + 9 - 0.3 - 0.6, 0.6, LAND_Z, 0, 0, 0, 0.1, 1.1, 0.06); // cancela
    for (let k = 0; k < 5; k++) m.add(G.bush, k % 2 ? 0xe0457b : 0x3d6e34, x + 1.5 + k * 1.3, 1.6 + (k % 2) * 0.3, LAND_Z + 0.8, 0, k, 0, 1.4, 1.3, 1.0); // adelfas
  }
  colliders.push({ minX: -17, maxX: 50, minZ: LAND_Z - 0.35, maxZ: LAND_Z + 4 });
  const palm = (x: number, z: number, h: number) => {
    // Palmera datilera: tronco grueso escamado y copa densa de hojas arqueadas
    for (let k = 0; k < 5; k++) m.add(G.cyl, k % 2 ? 0x7a6448 : 0x6b5a40, x, (k + 0.5) * (h / 5), z, 0, 0, 0, 0.75 - k * 0.04, h / 5, 0.75 - k * 0.04);
    palmCrown(m, x, h + 0.1, z, 3.3, 18);
  };
  for (const [x, z, h] of [[-12, LAND_Z + 3, 6], [8, LAND_Z + 2.5, 7], [27, LAND_Z + 3.5, 5.5], [41, LAND_Z + 2.8, 6.5]] as [number, number, number][]) palm(x, z, h);
  for (const [x, z] of [[-4, LAND_Z + 7], [17, LAND_Z + 6], [35, LAND_Z + 7]] as [number, number][]) {
    m.add(G.cyl, 0x6b4a32, x, 4, z, 0.1, 0, 0.06, 0.45, 8, 0.45);
    for (let k = 0; k < 6; k++) m.add(G.bush, k % 2 ? 0x2f5a2c : 0x3a6a34, x + Math.cos(k) * 2.4, 8.4 + Math.sin(k * 2) * 0.5, z + Math.sin(k) * 2.4, 0, k, 0, 3.6, 1.7, 3.2);
  }
  // Chalets blancos detrás de los muros (y los de la calle que baja)
  let seed = 1;
  for (const z of [-6, -19, -31]) villa(m, -31, z, 1, colliders, seed++);
  for (const z of [-19, -31]) villa(m, -8.5, z, -1, colliders, seed++);
  for (let x = 2; x < 50; x += 12) {
    const h = seed % 2 ? 5.6 : 3.2;
    m.add(G.box, WHITE, x, h / 2, LAND_Z + 9, 0, 0, 0, 8, h, 7);
    if (seed % 3) m.add(ROOF_GEO, 0xb8623e, x, h, LAND_Z + 9, 0, 0, 0, 8.4, 1.4, 7.4);
    else m.add(G.box, WHITE, x, h + 0.25, LAND_Z + 9, 0, 0, 0, 8.2, 0.5, 7.2);
    for (const wx of [-2, 2]) {
      m.add(G.box, 0x30384a, x + wx, 1.4, LAND_Z + 5.48, 0, 0, 0, 0.9, 1.1, 0.05);
      for (const sx of [-1, 1]) m.add(G.box, SHUTTER, x + wx + sx * 0.7, 1.4, LAND_Z + 5.45, 0, 0, 0, 0.48, 1.2, 0.05);
    }
    seed++;
  }
  // Coches aparcados en el lado de las casas
  for (const [x, c] of [[-2, 0x2a2e3a], [11, 0xf0f0f0], [33, 0x8a2a2a]] as [number, number][]) {
    m.add(G.rbox, c, x, 0.7, LAND_Z - 1.2, 0, Math.PI / 2, 0, 1.7, 0.9, 3.9);
    m.add(G.rbox, 0x9fb8c8, x - 0.2, 1.35, LAND_Z - 1.2, 0, Math.PI / 2, 0, 1.5, 0.5, 2.1);
    for (const dx of [-1.3, 1.3]) for (const dz of [-0.85, 0.85]) m.add(G.cyl, 0x1e1e22, x + dx, 0.32, LAND_Z - 1.2 + dz, Math.PI / 2, 0, 0, 0.64, 0.2, 0.64);
    colliders.push({ minX: x - 2, maxX: x + 2, minZ: LAND_Z - 2.1, maxZ: LAND_Z - 0.3, low: true });
  }
  // Postes de madera con el cable a lo largo del camino, y un par de farolas
  const lampPos: number[] = [];
  for (let x = -10; x <= 46; x += 14) {
    m.add(G.cyl, 0x8a7a60, x, 4.2, LAND_Z - 0.7, 0, 0, 0, 0.22, 8.4, 0.22);
    m.add(G.box, 0x6a5a48, x, 8.1, LAND_Z - 0.7, 0, 0, 0, 0.1, 0.1, 0.9);
    m.add(G.box, 0x2b2f36, x + 0.6, 6.0, LAND_Z - 1.2, 0, 0, -0.3, 0.06, 1.0, 0.06);
    m.add(G.sphere, 0xf4f0e0, x + 0.8, 5.5, LAND_Z - 1.4, 0, 0, 0, 0.3, 0.2, 0.3);
    lampPos.push(x + 0.8, 5.4, LAND_Z - 1.4);
  }
  m.add(G.box, 0x1e1e22, 18, 8.0, LAND_Z - 0.7, 0, 0, 0, 56, 0.03, 0.03);
  if (!day) {
    const lamps = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)),
      new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd38a, size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sc.add(lamps);
  }

  // La placita del faro: adoquín gris, acera de hormigón impreso rojizo, bancos de madera y hierro,
  // el árbol grande con su alcorque, el panel informativo, la papelera y el muro blanco con seto
  m.add(G.box, 0xa9a39a, -29, -0.004, COAST_Z + 5, 0, 0, 0, 16, 0.1, 9);
  m.add(G.box, 0xc4977e, -29, 0.04, COAST_Z + 9.8, 0, 0, 0, 16, 0.1, 1.6);
  m.add(G.box, 0xe0d6c4, -29, 0.12, COAST_Z + 9.0, 0, 0, 0, 16, 0.16, 0.2); // bordillo
  for (const [x, z, ry] of [[-34, COAST_Z + 2.4, 0], [-30.5, COAST_Z + 2.0, 0.1], [-24.5, COAST_Z + 2.3, -0.1]] as [number, number, number][]) {
    m.add(G.box, 0x8a6a44, x, 0.45, z, 0, ry, 0, 1.8, 0.07, 0.45);
    m.add(G.box, 0x8a6a44, x, 0.72, z - 0.22, 0.2, ry, 0, 1.8, 0.35, 0.05);
    for (const sx of [-0.8, 0.8]) m.add(G.box, 0x2b2f36, x + sx, 0.25, z, 0, ry, 0, 0.06, 0.5, 0.45);
    colliders.push({ minX: x - 1, maxX: x + 1, minZ: z - 0.4, maxZ: z + 0.4 });
  }
  m.add(G.box, 0xd8cfbd, -27.5, 0.08, COAST_Z + 4.6, 0, 0, 0, 3.2, 0.16, 3.2); // alcorque
  m.add(G.box, 0x4f7a3a, -27.5, 0.17, COAST_Z + 4.6, 0, 0, 0, 2.9, 0.02, 2.9);
  m.add(G.cyl, 0x7a6a56, -27.5, 1.4, COAST_Z + 4.6, 0.12, 0, 0.1, 0.5, 2.8, 0.5);
  for (let k = 0; k < 9; k++) m.add(G.bush, k % 3 ? 0x4f8a3a : 0x5f9a44, -27.5 + Math.cos(k * 0.7) * 2.6, 3.6 + Math.sin(k * 1.9) * 0.6, COAST_Z + 4.6 + Math.sin(k * 0.7) * 2.6, 0, k, 0, 2.6, 1.6, 2.4);
  colliders.push({ minX: -28.2, maxX: -26.8, minZ: COAST_Z + 3.9, maxZ: COAST_Z + 5.3 });
  m.add(G.box, 0x6b5a46, -32.5, 0.6, COAST_Z + 1.6, 0, 0, 0, 0.08, 1.2, 0.08); // panel
  m.add(G.box, 0xd8cfb4, -32.5, 1.2, COAST_Z + 1.6, -0.5, 0, 0, 1.0, 0.04, 0.7);
  m.add(G.cyl, 0x2b2f36, -26.4, 0.45, COAST_Z + 1.7, 0, 0, 0, 0.45, 0.9, 0.45); // papelera
  // Muro bajo de piedra seca hacia el agua, en la plaza
  m.add(G.box, 0xbfae92, -29, 0.35, COAST_Z + 0.9, 0, 0, 0, 16, 0.7, 0.5);
  colliders.push({ minX: -37, maxX: -30.5, minZ: COAST_Z + 0.6, maxZ: COAST_Z + 1.2, low: true });
  // Casita blanca con tejado de teja pintada de blanco, seto delante y muro encalado
  m.add(G.box, WHITE, -24, 1.7, COAST_Z + 14, 0, 0, 0, 9, 3.4, 5);
  m.add(ROOF_GEO, 0xeeebe4, -24, 3.4, COAST_Z + 14, 0, 0, 0, 9.4, 1.5, 5.4);
  for (const x of [-26.5, -21.5]) m.add(G.box, 0x2a3138, x, 1.6, COAST_Z + 11.47, 0, 0, 0, 1.0, 1.0, 0.05);
  m.add(G.box, WHITE, -24, 0.5, COAST_Z + 10.6, 0, 0, 0, 10, 1.0, 0.3);
  for (let k = 0; k < 9; k++) m.add(G.bush, 0x3d6e34, -28 + k * 1.0, 1.25, COAST_Z + 10.9, 0, k, 0, 1.2, 0.8, 0.7);
  colliders.push({ minX: -29, maxX: -19, minZ: COAST_Z + 10.4, maxZ: COAST_Z + 16.5 });

  // Plataforma de rocas de marès que baja al agua, con charcos
  for (let i = 0; i < 26; i++) {
    const x = -66 + i * 4.6 + Math.sin(i * 7) * 1.5;
    const z = COAST_Z - 4 - Math.abs(Math.sin(i * 3.1)) * 6;
    m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xb09a78 : 0x9a8466, x, -0.9, z, Math.sin(i) * 0.3, i, 0, 4 + (i % 4), 1.2 + (i % 3) * 0.3, 3 + (i % 3));
  }
  for (let i = 0; i < 6; i++) m.add(G.cyl, 0x3a7a9a, -50 + i * 15, -0.05, COAST_Z - 5 - (i % 2) * 2, 0, 0, 0, 1.2 + (i % 2), 0.02, 0.9);

  // El faro: casa del farero blanca, torre con franjas, dos galerías y linterna, y el muro contra el mar
  const L = faro;
  m.add(G.rock, 0xbf9a62, L.x, -0.8, L.z, 0, 0.4, 0, 14, 3.2, 11);
  m.add(G.box, 0xa8a49a, L.x, 1.2, L.z - 4.6, 0, 0, 0, 12, 2.6, 0.8); // muro de hormigón
  m.add(G.box, WHITE, L.x - 2.5, 2.3, L.z + 0.5, 0, 0, 0, 6.5, 3.6, 5.5); // casa del farero
  m.add(G.box, 0xe8e0cc, L.x - 2.5, 4.15, L.z + 0.5, 0, 0, 0, 6.7, 0.2, 5.7);
  for (const s of [-1, 1]) m.add(G.box, 0x30384a, L.x - 2.5 + s * 1.6, 2.4, L.z + 3.26, 0, 0, 0, 0.9, 1.1, 0.05);
  colliders.push({ minX: L.x - 6, maxX: L.x + 2.2, minZ: L.z - 3, maxZ: L.z + 3.3 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 11, 24, 1, true), toon({ map: stripeTexture(), color: 0xffffff }));
  tower.position.set(L.x + 1.2, 6.5, L.z);
  sc.add(tower);
  m.add(G.cyl, 0x2b2f36, L.x + 1.2, 9.4, L.z, 0, 0, 0, 2.9, 0.15, 2.9); // galería baja
  m.add(G.cyl, 0x2b2f36, L.x + 1.2, 12.1, L.z, 0, 0, 0, 2.7, 0.15, 2.7); // galería alta
  m.add(G.cyl, 0xf4f2ec, L.x + 1.2, 11.2, L.z, 0, 0, 0, 1.9, 1.7, 1.9);
  m.add(G.cyl, 0x9fd3e8, L.x + 1.2, 12.9, L.z, 0, 0, 0, 1.4, 1.4, 1.4); // linterna
  m.add(G.sphere, 0x2b2f36, L.x + 1.2, 13.7, L.z, 0, 0, 0, 1.5, 0.8, 1.5);
  // Castell de Sant Nicolau al otro lado de la bocana
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.add(G.box, 0xd4b47c, 70 + Math.cos(a) * 3.6, 4, -58 + Math.sin(a) * 3.6, 0, -a + Math.PI / 2, 0, 3, 8, 0.8);
  }
  m.add(G.rock2, 0xbf9a62, 70, -0.6, -58, 0, 0, 0, 14, 3, 10);
  // Llaüts navegando
  for (const [x, z] of [[-10, -80], [25, -95], [-55, -110]] as [number, number][]) {
    m.add(G.capsule, 0xf4f4f0, x, -0.1, z, Math.PI / 2, 0.4, 0, 0.9, 2.6, 0.6);
    m.add(G.box, 0x2f6b8a, x, 0.35, z, 0, 0.4, 0, 1.2, 0.5, 1.4);
  }
  sc.add(m.mesh());

  // El mar
  const sea = day ? makeSea([600, 300], 0x0f5a7a, new THREE.Vector3(0.4, 1, 0.6)) : makeSea([600, 300], 0x0a1630, new THREE.Vector3(-0.3, 0.4, -1), { night: true, emissive: 0x050a1c });
  sea.position.set(0, -0.4, COAST_Z - 155);
  sc.add(sea);

  // Gente paseando (de día)
  const walkers: Person[] = [];
  if (day) {
    const looks = [
      { skin: 0xf0c8a6, shirt: 0xffffff, pants: 0x3b4a6b, hair: 0x6b4a2e, hairStyle: 'short' as const },
      { skin: 0xd9a27c, shirt: 0xd7263d, pants: 0x2d2d3a, hair: 0x2b1d14, hairStyle: 'long' as const, skirt: true },
      { skin: 0xf3d2b6, shirt: 0x5aa9e6, pants: 0xe8e0cc, hair: 0xbababa, hairStyle: 'short' as const },
    ];
    looks.forEach((lk, i) => {
      const p = makePerson(lk);
      p.root.position.set(-45 + i * 30, 0, COAST_Z + 3 + (i % 2));
      p.root.userData.dir = i % 2 ? 1 : -1;
      sc.add(p.root);
      walkers.push(p);
    });
  }
  return { lamp: new THREE.Vector3(L.x + 1.2, 12.9, L.z), sea, walkers };
}
