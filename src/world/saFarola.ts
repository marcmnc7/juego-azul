import * as THREE from 'three';
import { G, Merger, makePerson, type Person } from '../entities/models';
import { toon, glowTexture, makeSea } from '../core/gfx';
import { ROOF_GEO, type Box2 } from './ferreries';
import { canvasTex } from './deco';

// Alrededores de la casa de los padres de Azul, en Ciutadella, hasta la punta de Sa Farola:
// - Una calle de chalets blancos con persianas verdes, muros encalados, buganvillas, palmeras y tamarindos.
// - El paseo marítimo: pavimento claro, muro bajo encalado, farolas, bancos y la plataforma de marès
//   rocoso que baja al mar.
// - El faro de Ciutadella (Punta de Sa Farola): torre cilíndrica de 13 m con franjas verticales blancas y
//   negras, pegada a la casa del farero, dos galerías y linterna; un muro de hormigón la protege del mar.
// - Al otro lado de la bocana, el Castell de Sant Nicolau (torre octogonal) y algún llaüt navegando.

export const COAST_Z = -46;
export const LIGHTHOUSE = new THREE.Vector3(-33, 0, -52.5);
/** Punto del paseo junto al faro: el final del paseo con Joy y Eric. */
export const FAROLA_WALK = new THREE.Vector3(-26, 0, -42);

const WHITE = 0xf6f1e6;
const SHUTTER = 0x2f7a4a;

function noiseTex(base: string, tones: string[], n: number, size: [number, number], w = 256, h = 256) {
  return canvasTex(
    (ctx) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = tones[i % tones.length];
        ctx.globalAlpha = 0.25 + Math.random() * 0.5;
        const r = size[0] + Math.random() * (size[1] - size[0]);
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, r, r * (0.5 + Math.random() * 0.6), Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    w,
    h,
  );
}

/** Marès: piedra arenisca dorada y porosa de Menorca. */
function maresTexture() {
  const t = noiseTex('#cfae74', ['#b8925c', '#e0c48e', '#a8834f', '#d9b97f', '#8f6d40'], 900, [1, 5]);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Losas claras del paseo marítimo. */
function pavingTexture() {
  const t = canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#d8cfbd';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const v = 200 + Math.floor(Math.random() * 25);
        ctx.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
        ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(90,80,60,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function asphaltTexture() {
  const t = noiseTex('#4a4a50', ['#3a3a40', '#5a5a60', '#44444a', '#6a6a6e'], 1400, [0.5, 1.6]);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Franjas verticales blancas y negras de la torre. */
function stripeTexture() {
  return canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#f4f2ec';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c1c20';
    for (let i = 0; i < 8; i++) ctx.fillRect((i * w) / 8, 0, w / 16, h);
  }, 256, 64);
}

function plane(tex: THREE.Texture, w: number, d: number, x: number, y: number, z: number, rep: [number, number]) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(...rep);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), toon({ map: t, color: 0xffffff, roughness: 0.95 }));
  p.position.set(x, y, z);
  p.userData.noCast = true;
  return p;
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
  // Jardín delante con muro encalado y buganvilla
  const gx = x + faceX * (d / 2 + 3.2);
  for (const [z0, z1] of [[z - w / 2 - 1, z - 0.8], [z + 0.8, z + w / 2 + 1]]) {
    m.add(G.box, WHITE, gx, 0.6, (z0 + z1) / 2, 0, 0, 0, 0.3, 1.2, z1 - z0);
    colliders.push({ minX: gx - 0.2, maxX: gx + 0.2, minZ: z0, maxZ: z1 });
  }
  for (let i = 0; i < 8; i++) m.add(G.bush, i % 3 ? 0xc2307a : 0x2f6b3a, gx, 1.3 + Math.sin(i + seed) * 0.15, z - w / 2 + i * 0.6, 0, 0, 0, 0.45, 0.5, 0.6);
  colliders.push({ minX: Math.min(x - d / 2, gx) - 0.1, maxX: Math.max(x + d / 2, gx) + 0.1, minZ: z - w / 2 - 1, maxZ: z + w / 2 + 1 });
  // Palmera o pino en el jardín
  const tx = x + faceX * (d / 2 + 1.6);
  const tz = z + (seed % 2 ? w / 3 : -w / 3);
  m.add(G.cyl, 0x6b5a40, tx, 2.5, tz, 0.05, 0, 0.05, 0.3, 5, 0.3);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    m.add(G.box, 0x4f7a3a, tx + Math.cos(a) * 1.0, 4.9, tz + Math.sin(a) * 1.0, Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5, 2.2, 0.08, 0.5);
  }
}

/** Tamarindo (tamariu) del paseo: tronco retorcido y copa gris verdosa. */
function tamarisk(m: Merger, x: number, z: number, s = 1) {
  m.add(G.cyl, 0x5a4a38, x, 1.2 * s, z, 0.15, 0, 0.1, 0.3 * s, 2.4 * s, 0.3 * s);
  m.add(G.bush, 0x7f9474, x + 0.3, 3.0 * s, z, 0, 0, 0, 3.2 * s, 2.0 * s, 2.8 * s);
  m.add(G.bush, 0x8aa07e, x - 0.6, 2.7 * s, z + 0.5, 0, 0, 0, 2.2 * s, 1.5 * s, 2.0 * s);
}

export interface SaFarola {
  lamp: THREE.Vector3;
  sea: THREE.Mesh;
  walkers: Person[];
}

/** Construye la calle, el paseo y el faro. day: colores de día (el eclipse) o de noche (la cena). */
export function buildSaFarola(sc: THREE.Scene, colliders: Box2[], day: boolean): SaFarola {
  const m = new Merger();
  // Suelos con textura: calle del paseo, paseo marítimo y plataforma de marès
  const asphalt = asphaltTexture();
  const paving = pavingTexture();
  const mares = maresTexture();
  sc.add(plane(asphalt, 6, 54, -20, 0.01, -14, [3, 27])); // calle que baja al mar
  sc.add(plane(paving, 120, 5, -10, 0.02, COAST_Z + 3.5, [60, 2.5])); // paseo
  sc.add(plane(paving, 1.6, 54, -16.2, 0.04, -14, [1, 27])); // acera
  sc.add(plane(paving, 1.6, 54, -23.8, 0.04, -14, [1, 27]));
  const rocks = plane(mares, 120, 16, -10, -0.1, COAST_Z - 7, [24, 4]);
  sc.add(rocks);
  // Bordillos
  for (const x of [-17, -23]) m.add(G.box, 0xd8d2c4, x, 0.06, -14, 0, 0, 0, 0.16, 0.14, 54);
  m.add(G.box, 0xd8d2c4, -10, 0.06, COAST_Z + 6.1, 0, 0, 0, 120, 0.14, 0.16);

  // Chalets a los dos lados de la calle que baja al paseo
  let seed = 1;
  for (const z of [-6, -19, -31]) villa(m, -31, z, 1, colliders, seed++);
  for (const z of [-19, -31]) villa(m, -8.5, z, -1, colliders, seed++);
  // Coches aparcados (cajas redondeadas sencillas)
  for (const [z, c] of [[-10, 0xb8c4d0], [-26, 0x8a2a2a], [-36, 0xf0f0f0]] as [number, number][]) {
    m.add(G.rbox, c, -17.9, 0.7, z, 0, 0, 0, 1.7, 0.9, 3.9);
    m.add(G.rbox, 0x9fb8c8, -17.9, 1.35, z - 0.2, 0, 0, 0, 1.5, 0.5, 2.1);
    colliders.push({ minX: -18.8, maxX: -17, minZ: z - 2, maxZ: z + 2 });
  }

  // Paseo: muro bajo encalado con remate, bancos, farolas y tamarindos
  m.add(G.box, WHITE, -10, 0.45, COAST_Z + 0.9, 0, 0, 0, 120, 0.9, 0.45);
  m.add(G.box, 0xe8e0cc, -10, 0.93, COAST_Z + 0.9, 0, 0, 0, 120, 0.08, 0.6);
  colliders.push({ minX: -70, maxX: -30.5, minZ: COAST_Z + 0.6, maxZ: COAST_Z + 1.2 }, { minX: -21.5, maxX: 50, minZ: COAST_Z + 0.6, maxZ: COAST_Z + 1.2 });
  const lampPos: number[] = [];
  for (let x = -60; x <= 46; x += 12) {
    m.add(G.cyl, 0x2b2f36, x, 1.9, COAST_Z + 1.6, 0, 0, 0, 0.12, 3.8, 0.12);
    m.add(G.sphere, 0xf4f0e0, x, 3.95, COAST_Z + 1.6, 0, 0, 0, 0.42, 0.42, 0.42);
    lampPos.push(x, 3.95, COAST_Z + 1.6);
    m.add(G.box, 0x7a5a3a, x + 6, 0.45, COAST_Z + 1.7, 0, 0, 0, 1.8, 0.08, 0.5); // banco
    m.add(G.box, 0x7a5a3a, x + 6, 0.75, COAST_Z + 1.45, 0, 0, 0, 1.8, 0.4, 0.06);
    m.add(G.box, 0x2b2f36, x + 6, 0.22, COAST_Z + 1.7, 0, 0, 0, 1.6, 0.44, 0.4);
    colliders.push({ minX: x + 5, maxX: x + 7, minZ: COAST_Z + 1.3, maxZ: COAST_Z + 2 });
    if (Math.abs(x + 20) > 6) tamarisk(m, x + 2.5, COAST_Z + 5.2, 0.9 + ((x / 12) % 2) * 0.15);
  }
  if (!day) {
    const lamps = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)),
      new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd38a, size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sc.add(lamps);
  }

  // Plataforma de rocas de marès que baja al agua, con charcos
  for (let i = 0; i < 26; i++) {
    const x = -66 + i * 4.6 + Math.sin(i * 7) * 1.5;
    const z = COAST_Z - 4 - Math.abs(Math.sin(i * 3.1)) * 6;
    m.add(i % 2 ? G.rock : G.rock2, i % 3 ? 0xc9a36a : 0xb48a54, x, -0.6, z, Math.sin(i), i, 0, 4 + (i % 4), 1.4 + (i % 3) * 0.4, 3 + (i % 3));
  }
  for (let i = 0; i < 6; i++) m.add(G.cyl, 0x3a7a9a, -50 + i * 15, -0.05, COAST_Z - 5 - (i % 2) * 2, 0, 0, 0, 1.2 + (i % 2), 0.02, 0.9);

  // El faro: casa del farero blanca, torre con franjas, dos galerías y linterna, y el muro contra el mar
  const L = LIGHTHOUSE;
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
