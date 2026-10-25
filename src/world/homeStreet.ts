import * as THREE from 'three';
import { G, Merger } from '../entities/models';
import { toon, glowTexture } from '../core/gfx';
import { ROOF_GEO, type Box2 } from './ferreries';
import { canvasTex } from './deco';

// La calle del capítulo 4: el Bar Imperi (donde Gas recoge a Azul), la carretera y la fachada
// de casa vista desde la calle, sacadas de las fotos que pasó Marc:
// - Bar Imperi: fachada amarilla, zócalo y marco de puerta blancos, puerta verde de dos hojas con
//   cristales, rótulo "Bar Imperi" en letra cursiva, farolillos, persianas verdes, toldo blanco y
//   terraza de adoquines con mesas de madera y sillas de director verdes.
// - Casa: dos plantas amarilla con alero de teja, ventanas con contraventanas blancas y garaje;
//   delante, muro blanco con pilares, puerta corredera blanca, paño de piedra seca con placa,
//   puerta peatonal y buzón negro. Palmeras y seto al lado, vecinos blancos de teja.

/** El lado de la casa que da a la calle está en z = -15; el muro de la calle en z = -19. */
/** Pasillo lateral de casa (a la derecha mirando desde la calle): de la calle a la piscina sin entrar en casa. */
export const CORRIDOR = { minX: -6.3, maxX: -4.6, wallX: -6.45 };

export const STREET = {
  wallZ: -19,
  laneZ: -21.8,
  bar: new THREE.Vector3(-62, 0, -15),
  door: new THREE.Vector3(-3.3, 0, -15.6),
  gate: { minX: -3.65, maxX: -2.4 },
};

const YELLOW = 0xeec26a;
const BAR_YELLOW = 0xf0c24f;
const WHITE = 0xf7f4ec;

function cobbleTexture() {
  const t = canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#8f887c';
    ctx.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s)
      for (let x = (y / s) % 2 ? -s / 2 : 0; x < w; x += s) {
        const v = 170 + Math.random() * 40;
        ctx.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y + 1.5, s - 3, s - 3, 4);
        ctx.fill();
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function tileTexture() {
  const t = canvasTex((ctx, w, h) => {
    ctx.fillStyle = '#b9b2a2';
    ctx.fillRect(0, 0, w, h);
    const s = 32;
    for (let y = 0; y < h; y += s)
      for (let x = 0; x < w; x += s) {
        const v = 196 + Math.random() * 18;
        ctx.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ctx.fillRect(x + 3 + i * 7, y + 3 + j * 7, 5, 5);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function barSignTexture() {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = '#f3efe4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#151515';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'italic 70px "Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive';
      ctx.fillText('Bar Imperi', w / 2, h / 2 + 4);
    },
    512,
    112,
  );
}

function barDoorTexture() {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = '#1d4537';
      ctx.fillRect(0, 0, w, h);
      for (const lx of [0, w / 2]) {
        const lw = w / 2;
        ctx.strokeStyle = '#163629';
        ctx.lineWidth = 4;
        ctx.strokeRect(lx + 2, 2, lw - 4, h - 4);
        // Cristales: 2 x 3, con la luz del bar detrás
        const px = lx + lw * 0.14;
        const pw = lw * 0.72;
        const py = h * 0.08;
        const ph = h * 0.5;
        ctx.fillStyle = '#ffd98a';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = '#f4f1e8';
        ctx.lineWidth = 6;
        ctx.strokeRect(px, py, pw, ph);
        ctx.beginPath();
        ctx.moveTo(px + pw / 2, py);
        ctx.lineTo(px + pw / 2, py + ph);
        for (const k of [1, 2]) {
          ctx.moveTo(px, py + (ph / 3) * k);
          ctx.lineTo(px + pw, py + (ph / 3) * k);
        }
        ctx.stroke();
        ctx.strokeStyle = '#163629';
        ctx.lineWidth = 3;
        ctx.strokeRect(px, h * 0.66, pw, h * 0.26);
      }
      ctx.fillStyle = '#d4a640';
      ctx.beginPath();
      ctx.arc(w / 2 - 12, h * 0.6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w / 2 - 2, 0, 4, h);
    },
    256,
    384,
  );
}

function shutterTexture(color = '#1f5a45') {
  return canvasTex(
    (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let y = 10; y < h - 8; y += 9) {
        ctx.fillRect(8, y, w / 2 - 12, 3);
        ctx.fillRect(w / 2 + 4, y, w / 2 - 12, 3);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(w / 2 - 2, 0, 4, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, w, h);
    },
    128,
    192,
  );
}

function palm(m: Merger, x: number, z: number, h: number) {
  const n = Math.round(h / 1.1);
  for (let i = 0; i < n; i++) m.add(G.cyl, 0x6b5a40, x + Math.sin(i * 0.25) * 0.25, (i + 0.5) * (h / n), z, 0, 0, 0.04, 0.42 - i * 0.02, h / n + 0.05, 0.42 - i * 0.02);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m.add(G.box, 0x2f6a34, x + Math.cos(a) * 1.3, h + 0.1, z + Math.sin(a) * 1.3, 0, -a, 0.5, 2.7, 0.08, 0.6);
  }
}

/** Ventana con marco blanco, luz dentro y contraventanas abiertas (o cerradas). */
function window_(m: Merger, x: number, y: number, z: number, w: number, h: number, shutter: number, lit: boolean, faceZ = -1) {
  const d = faceZ * 0.07;
  m.add(G.box, WHITE, x, y, z + d, 0, 0, 0, w + 0.3, h + 0.3, 0.06);
  m.add(G.box, lit ? 0xffd9a0 : 0x2a3348, x, y, z + d * 1.6, 0, 0, 0, w, h, 0.04);
  m.add(G.box, WHITE, x, y, z + d * 2, 0, 0, 0, 0.06, h, 0.04);
  for (const s of [-1, 1]) m.add(G.box, shutter, x + s * (w / 2 + 0.15 + w / 4), y, z + d * 1.4, 0, 0, 0, w / 2, h, 0.05);
}

/** Casa genérica de urbanización: blanca o amarilla, tejado de teja, muro delante. faceZ: hacia dónde da la fachada. */
function genericHouse(m: Merger, x: number, frontZ: number, faceZ: number, color: number, colliders: Box2[]) {
  const depth = 9;
  const cz = frontZ - faceZ * (depth / 2);
  m.add(G.box, color, x, 3, cz, 0, 0, 0, 8.6, 6, depth);
  m.add(ROOF_GEO, 0xb8623e, x, 6, cz, 0, 0, 0, 9.4, 2, depth + 0.6);
  m.add(G.box, WHITE, x - 2.6, 7.2, cz, 0, 0, 0, 0.6, 1.4, 0.6); // chimenea
  for (const wx of [-2, 2]) {
    window_(m, x + wx, 4.4, frontZ, 1.1, 1.3, 0xf4f4f0, Math.random() < 0.5, faceZ);
    window_(m, x + wx, 1.6, frontZ, 1.1, 1.3, 0xf4f4f0, Math.random() < 0.4, faceZ);
  }
  colliders.push({ minX: x - 4.3, maxX: x + 4.3, minZ: Math.min(frontZ, cz - faceZ * depth / 2), maxZ: Math.max(frontZ, cz - faceZ * depth / 2) });
}

export interface StreetWorld {
  colliders: Box2[];
  lamps: THREE.Points;
}

/** gateOpen: la corredera abierta (día del eclipse: el coche entra marcha atrás al patio). */
export function buildStreet(sc: THREE.Scene, opts: { gateOpen?: boolean } = {}): StreetWorld {
  const open = !!opts.gateOpen;
  const m = new Merger();
  const colliders: Box2[] = [];
  const S = STREET;

  // --- Suelo: carretera, aceras y pavimento delante de las casas ---
  m.add(G.box, 0x2c2c34, -20, -0.06, -23.5, 0, 0, 0, 130, 0.1, 7);
  for (let x = -82; x < 44; x += 4) m.add(G.box, 0xe8e2d0, x, 0.0, -23.5, 0, 0, 0, 2, 0.02, 0.14); // línea discontinua
  for (const z of [-20.08, -26.92]) m.add(G.box, 0xd8d2c4, -20, 0.06, z, 0, 0, 0, 130, 0.14, 0.16); // bordillos
  const tileTex = tileTexture();
  tileTex.repeat.set(130, 1);
  const sidewalkN = new THREE.Mesh(new THREE.PlaneGeometry(130, 1.0).rotateX(-Math.PI / 2), toon({ map: tileTex, color: 0xffffff }));
  sidewalkN.position.set(-20, 0.04, -19.5);
  const tileTex2 = tileTex.clone();
  tileTex2.needsUpdate = true;
  const sidewalkS = new THREE.Mesh(new THREE.PlaneGeometry(130, 1.2).rotateX(-Math.PI / 2), toon({ map: tileTex2, color: 0xffffff }));
  sidewalkS.position.set(-20, 0.04, -27.6);
  sidewalkN.userData.noCast = sidewalkS.userData.noCast = true;
  sc.add(sidewalkN, sidewalkS);
  m.add(G.box, 0xbdb5a3, -20, -0.05, -9.5, 0, 0, 0, 130, 0.1, 19); // pavimento entre la calle y los jardines
  m.add(G.box, 0x9a9384, -20, -0.05, -38, 0, 0, 0, 130, 0.1, 20);

  // --- Casa: fachada a la calle (planta baja + piso, alero de teja) ---
  const FZ = -15;
  m.add(G.box, YELLOW, 0, 3.3, FZ - 0.06, 0, 0, 0, 9, 6.6, 0.12);
  m.add(G.box, WHITE, 0, 6.62, FZ - 0.18, 0, 0, 0, 9.3, 0.14, 0.36); // cornisa
  m.add(ROOF_GEO, 0xb8623e, 0, 6.68, FZ - 0.35, 0, 0, 0, 9.6, 0.55, 1.0); // alero de teja
  m.add(G.box, WHITE, -1.6, 8.0, -13.4, 0, 0, 0, 0.7, 1.8, 0.7); // chimenea
  m.add(G.box, 0x9a9a9a, -1.6, 8.95, -13.4, 0, 0, 0, 0.8, 0.1, 0.8);
  window_(m, 2.6, 4.7, FZ, 1.0, 1.7, 0xf4f4f0, true);
  window_(m, -0.4, 4.7, FZ, 1.0, 1.7, 0xf4f4f0, false);
  for (let i = 0; i < 5; i++) m.add(G.box, 0x222222, 2.25 + i * 0.18, 4.2, FZ - 0.2, 0, 0, 0, 0.03, 0.7, 0.03); // barandilla
  m.add(G.box, 0x222222, 2.6, 4.55, FZ - 0.2, 0, 0, 0, 0.8, 0.04, 0.04);
  window_(m, -0.4, 1.6, FZ, 1.0, 1.2, 0xf4f4f0, true);
  // Garaje abierto con luz dentro
  m.add(G.box, WHITE, 2.3, 1.25, FZ - 0.08, 0, 0, 0, 3.3, 2.7, 0.06);
  m.add(G.box, 0x3a3630, 2.3, 1.15, FZ - 0.1, 0, 0, 0, 3.0, 2.3, 0.04);
  m.add(G.box, 0xdddddd, 2.3, 2.2, FZ - 0.14, 0, 0, 0, 3.0, 0.25, 0.06); // puerta basculante recogida
  m.add(G.box, 0xff9a3a, 2.3, 0.9, FZ - 0.12, 0, 0, 0, 1.2, 0.5, 0.02);
  // Puerta de entrada
  m.add(G.box, WHITE, S.door.x, 1.2, FZ - 0.08, 0, 0, 0, 1.3, 2.5, 0.06);
  m.add(G.box, 0x6b4a2e, S.door.x, 1.1, FZ - 0.12, 0, 0, 0, 1.0, 2.2, 0.06);
  m.add(G.sphere, 0xd4a640, S.door.x - 0.35, 1.1, FZ - 0.17, 0, 0, 0, 0.08, 0.08, 0.08);
  m.add(G.box, 0x222222, S.door.x, 2.65, FZ - 0.16, 0, 0, 0, 0.18, 0.26, 0.14); // farolillo
  // Patio delantero
  m.add(G.box, 0xd9d0bd, 0, 0.0, -17, 0, 0, 0, 9, 0.04, 4);
  // Muro lateral del patio (derecha mirando desde la calle, -x): de él sale el pasillo hasta la piscina
  m.add(G.box, WHITE, 4.6, 0.65, -17, 0, 0, 0, 0.25, 1.3, 4);
  colliders.push({ minX: 4.45, maxX: 4.75, minZ: -19, maxZ: -15 });
  m.add(G.box, 0xd9d0bd, -5.5, 0.0, -17, 0, 0, 0, 1.9, 0.04, 4);
  m.add(G.box, WHITE, CORRIDOR.wallX, 1.0, -17, 0, 0, 0, 0.25, 2.0, 4);
  colliders.push({ minX: CORRIDOR.wallX - 0.15, maxX: CORRIDOR.wallX + 0.15, minZ: -19.3, maxZ: -15 });
  // Muro a la calle: pilar · corredera · pilar · piedra · pilar · puerta · pilar (buzón) · muro
  const pillar = (x: number) => {
    m.add(G.box, WHITE, x, 0.8, S.wallZ, 0, 0, 0, 0.6, 1.6, 0.6);
    m.add(G.cone, WHITE, x, 1.75, S.wallZ, 0, Math.PI / 4, 0, 0.85, 0.3, 0.85);
  };
  for (const x of [4.3, 0.55, -2.15, -3.95]) pillar(x);
  // Puerta corredera blanca de lamas verticales
  const gx = open ? -0.9 : 2.4; // abierta, queda recogida detrás del muro de piedra
  const gz = open ? S.wallZ + 0.3 : S.wallZ - 0.05;
  m.add(G.box, 0xf2f2ee, gx, 0.75, gz, 0, 0, 0, 3.3, 1.35, 0.08);
  for (let i = 0; i < 9; i++) m.add(G.box, 0xdcdcd6, gx - 1.45 + i * 0.36, 0.75, gz - 0.05, 0, 0, 0, 0.03, 1.25, 0.02);
  m.add(G.box, 0xdcdcd6, gx, 1.0, gz - 0.05, 0, 0, 0, 3.2, 0.04, 0.02);
  // Muro de piedra seca con remate blanco
  m.add(G.box, WHITE, -0.8, 0.65, S.wallZ, 0, 0, 0, 2.2, 1.3, 0.3);
  m.add(G.box, WHITE, -0.8, 1.35, S.wallZ, 0, 0, 0, 2.3, 0.12, 0.36);
  // Muro tras el buzón, hasta el muro del pasillo
  m.add(G.box, WHITE, (-3.95 + CORRIDOR.wallX) / 2, 0.65, S.wallZ, 0, 0, 0, -3.95 - CORRIDOR.wallX, 1.3, 0.3);
  m.add(G.box, 0x1b1b1b, -3.95, 1.25, S.wallZ - 0.36, 0, 0, 0, 0.36, 0.42, 0.12); // buzón negro
  // Puerta peatonal abierta hacia dentro
  m.add(G.box, 0xf2f2ee, S.gate.minX + 0.05, 0.75, S.wallZ + 0.6, 0, 0, 0, 0.06, 1.35, 1.1);
  if (open) {
    colliders.push({ minX: S.gate.maxX, maxX: 0.85, minZ: S.wallZ - 0.32, maxZ: S.wallZ + 0.32 });
    colliders.push({ minX: 3.95, maxX: 4.7, minZ: S.wallZ - 0.32, maxZ: S.wallZ + 0.32 });
  } else colliders.push({ minX: S.gate.maxX, maxX: 4.7, minZ: S.wallZ - 0.32, maxZ: S.wallZ + 0.32 });
  colliders.push({ minX: CORRIDOR.wallX - 0.2, maxX: S.gate.minX, minZ: S.wallZ - 0.32, maxZ: S.wallZ + 0.32 });

  // Paño de piedra seca: textura sacada de la piedra real del Camí de sa Farola
  m.add(G.box, 0xbfae92, -0.8, 0.62, S.wallZ - 0.1, 0, 0, 0, 2.0, 1.15, 0.14);
  m.add(G.box, 0x9a9a96, -0.75, 0.55, S.wallZ - 0.18, 0, 0, 0, 0.5, 0.3, 0.03); // placa metálica
  // Placa con la dirección
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.42),
    toon({
      map: canvasTex(
        (ctx, w, h) => {
          ctx.fillStyle = '#f4efe2';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#1f3a6b';
          ctx.lineWidth = 8;
          ctx.strokeRect(6, 6, w - 12, h - 12);
          ctx.fillStyle = '#1f3a6b';
          ctx.font = 'bold 58px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Sa Son 69 B4', w / 2, h / 2 + 2);
        },
        512,
        196,
      ),
    }),
  );
  plate.position.set(-0.75, 0.85, S.wallZ - 0.2);
  plate.rotation.y = Math.PI;
  sc.add(plate);
  m.add(G.box, 0xf4f4f4, 1.0, 1.25, S.wallZ - 0.32, 0, 0, 0, 0.3, 0.26, 0.02); // cartel de la alarma

  // Palmeras y seto junto a la casa, vecinos blancos con teja
  palm(m, -7.6, -16.9, 8.5);
  palm(m, -8.4, -14.4, 7.6);
  palm(m, -9.6, -12.6, 10.5);
  m.add(G.box, 0x2c5a2a, -11, 1.25, -17.8, 0, 0, 0, 7, 2.5, 0.9);
  for (let i = 0; i < 9; i++) m.add(G.bush, i % 2 ? 0x2c5a2a : 0x35682f, -14 + i * 0.8, 2.5, -17.8, 0, i, 0, 0.9, 0.5, 0.9); // copa irregular del seto
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? -11.5 : 9;
    m.add(G.box, WHITE, x, 3, -13.5, 0, 0, 0, 9, 6, 3);
    m.add(G.box, WHITE, x, 0.65, S.wallZ, 0, 0, 0, 9, 1.3, 0.3);
    window_(m, x - 1.5, 1.6, -15, 1.4, 1.1, 0xc9a77c, true);
    window_(m, x + 2, 4.4, -15, 0.9, 1.1, 0xc9a77c, false);
    colliders.push({ minX: x - 4.5, maxX: x + 4.5, minZ: S.wallZ - 0.3, maxZ: S.wallZ + 0.3 });
  }

  // Resto de la urbanización
  const tones = [WHITE, 0xf3ead8, WHITE, 0xf1d9a0];
  let k = 0;
  for (const x of [-21, -31, -41, 20, 30]) {
    genericHouse(m, x, -15, -1, tones[k++ % tones.length], colliders);
    m.add(G.box, WHITE, x, 0.65, S.wallZ, 0, 0, 0, 9, 1.3, 0.3);
  }
  for (const x of [-60, -50, -40, -30, -20, -10, 0, 10, 20, 30]) genericHouse(m, x, -30, 1, tones[k++ % tones.length], colliders);

  // --- Bar Imperi ---
  const B = S.bar;
  m.add(G.box, BAR_YELLOW, B.x, 3.6, B.z + 5, 0, 0, 0, 14, 7.2, 10);
  m.add(G.box, WHITE, B.x, 0.15, B.z - 0.03, 0, 0, 0, 14, 0.3, 0.08); // zócalo
  m.add(G.box, 0xd9b04a, B.x, 7.3, B.z + 5, 0, 0, 0, 14.2, 0.2, 10.2);
  // Marco blanco de la puerta
  m.add(G.box, WHITE, B.x, 1.6, B.z - 0.04, 0, 0, 0, 2.6, 3.2, 0.08);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.7), new THREE.MeshBasicMaterial({ map: barDoorTexture(), color: 0xe6e6e6 }));
  door.position.set(B.x, 1.35, B.z - 0.1);
  door.rotation.y = Math.PI;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.74), new THREE.MeshBasicMaterial({ map: barSignTexture(), color: 0xf0f0f0 }));
  sign.position.set(B.x, 3.75, B.z - 0.12);
  sign.rotation.y = Math.PI;
  m.add(G.box, 0x2b2b2b, B.x, 3.75, B.z - 0.07, 0, 0, 0, 3.5, 0.84, 0.06);
  const shutter = toon({ map: shutterTexture(), color: 0xffffff });
  const sh1 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), shutter);
  sh1.position.set(B.x, 6.0, B.z - 0.1);
  sh1.rotation.y = Math.PI;
  m.add(G.box, WHITE, B.x, 6.0, B.z - 0.05, 0, 0, 0, 2.4, 1.7, 0.06);
  const sh2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), shutter);
  sh2.position.set(B.x - 3.4, 1.35, B.z - 0.1);
  sh2.rotation.y = Math.PI;
  m.add(G.box, WHITE, B.x - 3.4, 0.9, B.z - 0.05, 0, 0, 0, 4.4, 1.8, 0.06); // zócalo blanco de la derecha
  sc.add(door, sign, sh1, sh2);
  // Farolillos de pared
  for (const sx of [-1, 1]) {
    m.add(G.box, 0x2b2b2b, B.x + sx * 2.3, 3.75, B.z - 0.25, 0, 0, 0, 0.06, 0.06, 0.5);
    m.add(G.cone, 0x2b2b2b, B.x + sx * 2.3, 3.65, B.z - 0.5, 0, 0, 0, 0.42, 0.22, 0.42);
  }
  // Toldo blanco a la izquierda de la puerta
  m.add(G.box, 0xf2efe6, B.x + 4.6, 3.05, B.z - 1.3, -0.28, 0, 0, 4.4, 0.06, 2.7);
  m.add(G.box, 0xe0dccf, B.x + 4.6, 2.62, B.z - 2.6, 0, 0, 0, 4.4, 0.3, 0.04);
  m.add(G.box, 0x9a9a9a, B.x + 4.6, 3.3, B.z - 0.06, 0, 0, 0, 4.4, 0.12, 0.12);
  // Edificios vecinos del bar, blancos con persianas verdes
  for (const sx of [-1, 1]) {
    const x = B.x + sx * 12;
    m.add(G.box, sx < 0 ? WHITE : 0xf3ead8, x, 3.4, B.z + 5, 0, 0, 0, 10, 6.8, 10);
    for (const wx of [-2.5, 2.5]) {
      window_(m, x + wx, 4.8, B.z, 1.0, 1.4, 0x2f6b46, false);
      window_(m, x + wx, 1.6, B.z, 1.0, 1.4, 0x2f6b46, false);
    }
  }
  colliders.push({ minX: B.x - 17, maxX: B.x + 17, minZ: B.z - 0.2, maxZ: B.z + 10 });
  // Terraza de adoquines con mesas de madera y sillas de director verdes
  const cob = cobbleTexture();
  cob.repeat.set(9, 1.8);
  const terrace = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.4).rotateX(-Math.PI / 2), toon({ map: cob, color: 0xffffff }));
  terrace.position.set(B.x, 0.03, B.z - 2.2);
  terrace.userData.noCast = true;
  sc.add(terrace);
  const chair = (x: number, z: number, ry: number) => {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    const p = (lx: number, y: number, lz: number, w: number, h: number, d: number, color: number, rz = 0) => {
      const [wx, wz] = at(lx, lz);
      m.add(G.box, color, wx, y, wz, 0, ry, rz, w, h, d);
    };
    for (const sx of [-1, 1]) {
      p(sx * 0.25, 0.24, 0, 0.04, 0.6, 0.04, 0x8a5a34, 0.7);
      p(sx * 0.25, 0.24, 0, 0.04, 0.6, 0.04, 0x8a5a34, -0.7);
      p(sx * 0.27, 0.7, -0.18, 0.05, 0.6, 0.05, 0x8a5a34);
      p(sx * 0.27, 0.66, 0.02, 0.06, 0.04, 0.46, 0x8a5a34);
    }
    p(0, 0.46, 0, 0.5, 0.04, 0.42, 0x1f5a45);
    p(0, 0.86, -0.19, 0.52, 0.24, 0.03, 0x1f5a45);
  };
  const table = (x: number, z: number) => {
    m.add(G.box, 0x9a6a40, x, 0.72, z, 0, 0, 0, 0.8, 0.05, 0.8);
    for (const [dx, dz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) m.add(G.box, 0x8a5a34, x + dx, 0.36, z + dz, 0, 0, 0, 0.05, 0.72, 0.05);
    m.add(G.cyl, 0xffffff, x + 0.15, 0.78, z, 0, 0, 0, 0.12, 0.08, 0.12); // café
    chair(x - 0.65, z, Math.PI / 2);
    chair(x + 0.65, z, -Math.PI / 2);
    chair(x, z - 0.7, 0);
    colliders.push({ minX: x - 1.0, maxX: x + 1.0, minZ: z - 1.0, maxZ: z + 0.5 });
  };
  table(B.x + 5.6, B.z - 1.5);
  table(B.x + 3.2, B.z - 2.4);
  table(B.x - 4.6, B.z - 1.6);

  // Farolas de la calle
  const lampPos: number[] = [];
  for (let x = -69; x <= 41; x += 14) {
    if (open && Math.abs(x - 2.4) < 3) continue; // la farola de delante de la corredera estorbaría al coche
    m.add(G.cyl, 0x3a3a3a, x, 2.2, -19.8, 0, 0, 0, 0.12, 4.4, 0.12);
    m.add(G.box, 0x3a3a3a, x, 4.4, -20.3, 0, 0, 0, 0.08, 0.08, 1.0);
    m.add(G.box, 0x3a3a3a, x, 4.3, -20.8, 0, 0, 0, 0.4, 0.15, 0.3);
    colliders.push({ minX: x - 0.15, maxX: x + 0.15, minZ: -19.95, maxZ: -19.65 });
    lampPos.push(x, 4.15, -20.8);
  }
  // Brillos: farolas, farolillos del bar y de casa
  lampPos.push(B.x - 2.3, 3.55, B.z - 0.5, B.x + 2.3, 3.55, B.z - 0.5, S.door.x, 2.6, FZ - 0.3);
  const lamps = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)),
    new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd38a, size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sc.add(lamps);
  const barLight = new THREE.PointLight(0xffc27a, 16, 12, 1.5);
  barLight.position.set(B.x, 3.2, B.z - 2.5);
  const homeLight = new THREE.PointLight(0xffc27a, 9, 9, 1.5);
  homeLight.position.set(-1.5, 2.6, -17.5);
  sc.add(barLight, homeLight);

  const mesh = m.mesh();
  sc.add(mesh);
  return { colliders, lamps };
}
