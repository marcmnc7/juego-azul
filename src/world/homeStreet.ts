import * as THREE from 'three';
import { G, Merger } from '../entities/models';
import { toon, glowTexture } from '../core/gfx';
import { ROOF_GEO, type Box2 } from './ferreries';
import { canvasTex } from './deco';
import { Door } from './door';

// La calle de casa de Gas, la carretera y la fachada vista desde la calle, sacadas de las fotos
// que pasó Marc (las texturas del Bar Imperi se usan en el Born, born.ts):
// - Bar Imperi: fachada amarilla, zócalo y marco de puerta blancos, puerta verde de dos hojas con
//   cristales, rótulo "Bar Imperi" en letra cursiva, farolillos y persianas verdes.
// - Casa: dos plantas amarilla con alero de teja, ventanas con contraventanas blancas y garaje;
//   delante, muro blanco con pilares, puerta corredera blanca, paño de piedra seca con placa,
//   puerta peatonal y buzón negro. Palmeras y seto al lado, vecinos blancos de teja.

/** El lado de la casa que da a la calle está en z = -15; el muro de la calle en z = -19. */
/** Pasillo lateral de casa (a la derecha mirando desde la calle): de la calle a la piscina sin entrar en casa. */
export const CORRIDOR = { minX: -6.3, maxX: -4.6, wallX: -6.45 };

export const STREET = {
  wallZ: -19,
  laneZ: -21.8,
  door: new THREE.Vector3(-3.3, 0, -15.6),
  gate: { minX: -3.65, maxX: -2.4 },
};

const YELLOW = 0xeec26a;
const WHITE = 0xf7f4ec;

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

export function barSignTexture() {
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

export function barDoorTexture() {
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

export function shutterTexture(color = '#1f5a45') {
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
  /** Puerta peatonal (se abre hacia dentro al llegar alguien). */
  gate: Door;
  /** Corredera del coche (se desliza detrás del muro de piedra). */
  slider: Door;
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
  // La fachada termina justo en FZ: todo lo que va pegado a ella (ventanas, garaje, puerta) queda unos
  // centímetros por delante (antes el fondo del garaje estaba en el mismo plano que la pared y parpadeaba)
  m.add(G.box, YELLOW, 0, 3.3, FZ + 0.06, 0, 0, 0, 9, 6.6, 0.12);
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
  m.add(G.box, 0x3a3630, 2.3, 1.15, FZ - 0.13, 0, 0, 0, 3.0, 2.3, 0.04);
  m.add(G.box, 0xdddddd, 2.3, 2.2, FZ - 0.2, 0, 0, 0, 3.0, 0.25, 0.06); // puerta basculante recogida
  m.add(G.box, 0xff9a3a, 2.3, 0.9, FZ - 0.16, 0, 0, 0, 1.2, 0.5, 0.02);
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
  // Puerta corredera blanca de lamas verticales: corre por detrás del muro de piedra (se abre para el coche)
  const slider = new Door({ hinge: new THREE.Vector3(0.75, 0, S.wallZ + 0.24), ry: 0, width: 3.3, slide: 3.2, reach: 9, speed: 1.6, sound: 'metal' });
  {
    const gm = new Merger();
    gm.add(G.box, 0xf2f2ee, 1.65, 0.75, 0, 0, 0, 0, 3.3, 1.35, 0.08);
    for (let i = 0; i < 9; i++) gm.add(G.box, 0xdcdcd6, 0.2 + i * 0.36, 0.75, -0.05, 0, 0, 0, 0.03, 1.25, 0.02);
    gm.add(G.box, 0xdcdcd6, 1.65, 1.0, -0.05, 0, 0, 0, 3.2, 0.04, 0.02);
    slider.leaf.add(gm.mesh());
  }
  sc.add(slider.group);
  // Muro de piedra seca con remate blanco
  m.add(G.box, WHITE, -0.8, 0.65, S.wallZ, 0, 0, 0, 2.2, 1.3, 0.3);
  m.add(G.box, WHITE, -0.8, 1.35, S.wallZ, 0, 0, 0, 2.3, 0.12, 0.36);
  // Muro tras el buzón, hasta el muro del pasillo
  m.add(G.box, WHITE, (-3.95 + CORRIDOR.wallX) / 2, 0.65, S.wallZ, 0, 0, 0, -3.95 - CORRIDOR.wallX, 1.3, 0.3);
  m.add(G.box, 0x1b1b1b, -3.95, 1.25, S.wallZ - 0.36, 0, 0, 0, 0.36, 0.42, 0.12); // buzón negro
  // Puerta peatonal: se abre hacia dentro cuando llega alguien y se cierra cuando ha pasado. La
  // bisagra, del lado de la corredera: abierta queda pegada a ese lado y no estorba el camino al pasillo
  const gw = S.gate.maxX - S.gate.minX - 0.06;
  const gate = new Door({ hinge: new THREE.Vector3(S.gate.maxX - 0.03, 0, S.wallZ), ry: Math.PI, width: gw, swing: 1.65, reach: 1.6, speed: 0.5, sound: 'metal' });
  {
    const pm = new Merger();
    pm.add(G.box, 0xf2f2ee, gw / 2, 0.75, 0, 0, 0, 0, gw, 1.35, 0.06);
    // (girada media vuelta: su +z local mira a la calle)
    for (let i = 0; i < 4; i++) pm.add(G.box, 0xdcdcd6, 0.16 + i * ((gw - 0.32) / 3), 0.75, 0.04, 0, 0, 0, 0.03, 1.25, 0.02);
    pm.add(G.box, 0x9a9a9a, gw - 0.1, 0.9, 0.06, 0, 0, 0, 0.03, 0.14, 0.03); // manilla
    gate.leaf.add(pm.mesh());
  }
  sc.add(gate.group);
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

  // Más casas hacia el oeste (el Bar Imperi está en el Born, en Ciutadella)
  for (const x of [-51, -61]) {
    genericHouse(m, x, -15, -1, tones[k++ % tones.length], colliders);
    m.add(G.box, WHITE, x, 0.65, S.wallZ, 0, 0, 0, 9, 1.3, 0.3);
  }

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
  lampPos.push(S.door.x, 2.6, FZ - 0.3);
  const lamps = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)),
    new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd38a, size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sc.add(lamps);
  const homeLight = new THREE.PointLight(0xffc27a, 9, 9, 1.5);
  homeLight.position.set(-1.5, 2.6, -17.5);
  sc.add(homeLight);

  const mesh = m.mesh();
  sc.add(mesh);
  return { colliders, lamps, gate, slider };
}
