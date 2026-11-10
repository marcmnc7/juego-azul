import * as THREE from 'three';
import { G, Merger, palmCrown, araucaria } from '../entities/models';
import { glowTexture, paintMat, toon } from '../core/gfx';
import { setSurface, Surf } from '../core/surfaces';
import { ROOF_GEO, rand, type Box2 } from './ferreries';
import { menorcaWindow, MARES, LOUVRE_GREEN, LOUVRE_BLUE } from './menorcaHouse';
import { canvasTex } from './deco';

// Del Born a casa de Gas (cap. 2): la carretera de la urbanización Son Oleo, como en Street View. Dos carriles con
// la línea discontinua; a un lado, carril bici rojo separado por «armadillos» negros y amarillos, acera de baldosa
// roja y la pared de piedra seca con remate de marès, con lentisco y acebuche detrás; al otro, acera y las casas
// encaladas con su murete blanco y sus pilares, palmeras y araucarias; farolas altas de un brazo y alguna señal.
//
// La calle de casa sale de esta carretera: es un cruce en T. La carretera pasa de largo por delante (de sur a norte,
// por x = 52) y la calle de casa entra hacia el oeste; el coche llega por el carril de la derecha, frena y gira a la
// derecha para entrar en la calle (de sentido único) hasta delante del vecino. Así la calle de casa no «cambia de
// tipo» de golpe: es otra calle, la de la urbanización.

/** Eje de la carretera, de sur a norte (y = 0). Recta delante del cruce, con curvas suaves más al sur. */
const AXIS = new THREE.CatmullRomCurve3(
  [
    [62, -300],
    [58, -250],
    [44, -205],
    [41, -160],
    [49, -118],
    [52, -80],
    [52, -40],
    [52, -23.5],
    [52, 20],
    [52, 75],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
const AXIS_X = 52;

/** Medio ancho del asfalto (dos carriles de 3,3 m). */
const HALF = 3.3;
/** El carril de la derecha (yendo al norte, el de la x menor). */
const LANE = 1.65;
/** La calle de casa (homeStreet): su eje, su carril y por dónde se abre al cruce. */
const STREET_Z = -23.5;
const STREET_LANE_Z = -21.8;
const MOUTH = { minZ: -28.3, maxZ: -18.9 };
/** Radio del giro a la derecha para entrar en la calle. */
const TURN_R = 5.5;

// Colores propios (cada uno con su dibujo de superficie)
const ASPHALT = 0x4a4a50;
const BIKE_RED = 0xa94b3f;
const WALK_RED = 0xb8786a;
const KERB = 0xd8d2c4;
const WALL_STONE = 0x9a8f80;
const WALL_WHITE = 0xf4efe2;
const LAMP_GREY = 0x5c6168;
const LINE = 0xe8e2d0;
setSurface(BIKE_RED, Surf.Asphalt);
setSurface(WALK_RED, Surf.Paving);
setSurface(WALL_STONE, Surf.DryStone);

const LEN = AXIS.getLength();
const axisPts = AXIS.getSpacedPoints(400);
const tmp = new THREE.Vector3();
/** Punto del eje, su tangente y su normal izquierda (en el sentido de la marcha, hacia el norte) en u ∈ [0, 1]. */
function frame(u: number) {
  const p = AXIS.getPointAt(u);
  AXIS.getTangentAt(u, tmp);
  // (con y arriba, mirando hacia +z la izquierda es +x)
  return { p, left: new THREE.Vector3(tmp.z, 0, -tmp.x), t: tmp.clone() };
}

/** El recorrido del coche: por el carril de la derecha, giro a la derecha en el cruce y por la calle de casa. */
export const DRIVE_PATH = (() => {
  const pts: THREE.Vector3[] = [];
  const turnZ = STREET_LANE_Z - TURN_R; // donde empieza a girar
  for (let i = 0; i <= 80; i++) {
    const { p, left } = frame(i / 80);
    if (p.z > turnZ - 1) break;
    pts.push(p.clone().addScaledVector(left, -LANE));
  }
  // el giro: un cuarto de círculo de la dirección norte a la oeste
  const laneX = AXIS_X - LANE;
  const cx = laneX - TURN_R, cz = turnZ;
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector3(cx + TURN_R * Math.cos(a), 0, cz + TURN_R * Math.sin(a)));
  }
  pts.push(new THREE.Vector3(32, 0, STREET_LANE_Z), new THREE.Vector3(11, 0, STREET_LANE_Z));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
})();

/** Metros del recorrido: total, y dónde empieza y acaba el giro (para frenar antes). */
export const DRIVE = (() => {
  const n = 1200;
  const L = DRIVE_PATH.getLength();
  let s0 = L, s1 = L;
  const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    DRIVE_PATH.getPointAt(i / n, p);
    // (solo cerca del cruce: en las curvas del sur el carril también pasa por x menores)
    if (s0 === L && p.z > STREET_LANE_Z - TURN_R - 2 && p.x < AXIS_X - LANE - 0.15) s0 = (i / n) * L;
    if (s0 < L && p.z > STREET_LANE_Z - 0.2) {
      s1 = (i / n) * L;
      break;
    }
  }
  return { length: L, turnFrom: s0, turnTo: s1, start: 30 };
})();

/** Lo que no se puede rellenar con casas de los alrededores (la carretera y su campo del este). */
export const ROAD_KEEP_OUT: Box2 = { minX: 38, maxX: 90, minZ: -120, maxZ: 90 };

/** Lejos de la carretera: ahí sí puede haber lomas (una loma encima la enterraba). */
export function farFromRoad(x: number, z: number, d = 85) {
  return axisPts.every((p) => Math.hypot(p.x - x, p.z - z) > d);
}

const inMouth = (z: number) => z > MOUTH.minZ && z < MOUTH.maxZ;

/**
 * Banda a lo largo del eje entre los desplazamientos laterales a y b (izquierda/este positiva), de y0 a y1: con y1 > y0
 * es un prisma (bordillo, acera, pared); si no, una cinta plana a la altura y0. gap: no se hace donde se abre la calle.
 */
function band(a: number, b: number, y0: number, y1: number, gap = false, step = gap ? 0.4 : 2) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const pos: number[] = [];
  const nrm: number[] = [];
  const quad = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, n: THREE.Vector3) => {
    for (const q of [p0, p1, p2, p0, p2, p3]) {
      pos.push(q.x, q.y, q.z);
      nrm.push(n.x, n.y, n.z);
    }
  };
  const up = new THREE.Vector3(0, 1, 0);
  const n = Math.ceil(LEN / step);
  const top = Math.max(y0, y1);
  let prev: { R0: THREE.Vector3; L0: THREE.Vector3; R1: THREE.Vector3; L1: THREE.Vector3 } | null = null;
  for (let i = 0; i <= n; i++) {
    const { p, left } = frame(i / n);
    if (gap && inMouth(p.z)) {
      prev = null;
      continue;
    }
    const R = p.clone().addScaledVector(left, lo), Lf = p.clone().addScaledVector(left, hi);
    const cur = { R0: R.clone().setY(y0), L0: Lf.clone().setY(y0), R1: R.clone().setY(top), L1: Lf.clone().setY(top) };
    if (prev) {
      quad(cur.L1, prev.L1, prev.R1, cur.R1, up);
      if (y1 > y0) {
        quad(prev.L0, prev.L1, cur.L1, cur.L0, left);
        quad(cur.R0, cur.R1, prev.R1, prev.R0, left.clone().negate());
      }
    }
    prev = cur;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

export function buildCountryRoad(sc: THREE.Scene) {
  const r = rand(23);
  const m = new Merger();

  // Campo bajo todo al este (los alrededores no llegan tan lejos) y al sur
  const field = new Merger();
  field.add(G.box, 0x5f6f3c, 150, -0.13, -110, 0, 0, 0, 220, 0.1, 420);
  const fieldMesh = field.mesh();
  fieldMesh.userData.noCast = true;
  sc.add(fieldMesh);

  // --- Calzada (cada capa en su malla, a ras de suelo y adelantada en profundidad: sin escalones, sin dientes) ---
  const asphalt = new Merger();
  asphalt.add(band(-HALF, HALF, 0, 0), ASPHALT);
  // la boca de la calle de casa, hasta el asfalto de la calle (que acaba en x = 45)
  asphalt.add(G.box, ASPHALT, (44.6 + AXIS_X - HALF) / 2, -0.05, STREET_Z, 0, 0, 0, AXIS_X - HALF - 44.6 + 0.2, 0.1, 7);
  const asphaltMesh = new THREE.Mesh(asphalt.build(), toon({ vertexColors: true }));
  asphaltMesh.userData.noCast = true;
  sc.add(asphaltMesh);

  const bike = new Merger();
  bike.add(band(HALF, HALF + 1.6, 0, 0), BIKE_RED);
  const bikeMesh = new THREE.Mesh(bike.build(), paintMat(1));
  bikeMesh.userData.noCast = true;
  sc.add(bikeMesh);

  const paint = new Merger();
  const flatG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // líneas de borde (la del oeste, cortada en la boca de la calle) y discontinua del centro
  paint.add(band(HALF - 0.32, HALF - 0.2, 0, 0), LINE);
  paint.add(band(-HALF + 0.2, -HALF + 0.32, 0, 0, true), LINE);
  for (let d = 4; d < LEN - 2; d += 9) {
    const { p, t } = frame(d / LEN);
    if (Math.abs(p.z - STREET_Z) < 5) continue; // (en el cruce, sin raya)
    paint.add(flatG, LINE, p.x, 0, p.z, 0, Math.atan2(t.x, t.z), 0, 0.12, 1, 3);
  }
  const paintMesh = new THREE.Mesh(paint.build(), paintMat(2));
  paintMesh.userData.noCast = true;
  sc.add(paintMesh);

  // Armadillos entre el carril y el carril bici
  for (let d = 2; d < LEN; d += 3.2) {
    const { p, t, left } = frame(d / LEN);
    const a = p.clone().addScaledVector(left, HALF + 0.08);
    const yaw = Math.atan2(t.x, t.z);
    m.add(G.sphere, 0x1d1d20, a.x, 0.02, a.z, 0, yaw, 0, 0.28, 0.12, 0.62);
    m.add(G.box, 0xe8c02a, a.x, 0.07, a.z, 0, yaw, 0, 0.22, 0.03, 0.1);
  }
  // Este: bordillo, acera roja, la pared seca con su remate de marès
  m.add(band(HALF + 1.6, HALF + 1.8, 0, 0.14), KERB);
  m.add(band(HALF + 1.8, HALF + 3.9, 0, 0.12), WALK_RED);
  m.add(band(HALF + 3.9, HALF + 4.5, 0, 1.0), WALL_STONE);
  m.add(band(HALF + 3.82, HALF + 4.58, 1.0, 1.16), MARES);
  // Oeste: bordillo y acera roja, abiertos donde entra la calle de casa (que sigue con sus propias aceras)
  m.add(band(-HALF - 0.2, -HALF, 0, 0.14, true), KERB);
  m.add(band(-HALF - 2.3, -HALF - 0.2, 0, 0.12, true), WALK_RED);
  // entre la acera y el final de la calle de casa (x = 45), su pavimento sigue hasta la acera
  m.add(G.box, 0xbdb5a3, 45.7, -0.05, -9.5, 0, 0, 0, 1.6, 0.1, 19);
  m.add(G.box, 0x9a9384, 45.7, -0.05, -38, 0, 0, 0, 1.6, 0.1, 20);
  // las esquinas de la calle: su bordillo y su acera llegan hasta la de la carretera
  for (const [z, w] of [
    [-20.08, 0.16],
    [-26.92, 0.16],
  ])
    m.add(G.box, KERB, (44.9 + AXIS_X - HALF) / 2, 0.06, z, 0, 0, 0, AXIS_X - HALF - 44.9, 0.14, w);
  for (const [z0, z1] of [
    [-20.0, -18.9],
    [-28.3, -27.0],
  ])
    m.add(G.box, WALK_RED, (44.9 + AXIS_X - HALF - 0.2) / 2, 0.06, (z0 + z1) / 2, 0, 0, 0, AXIS_X - HALF - 0.2 - 44.9, 0.12, z1 - z0);

  // --- Tras la pared seca: lentisco y acebuche, apretados ---
  for (let d = 6; d < LEN; d += 4.5) {
    const { p, left } = frame(d / LEN);
    const q = p.clone().addScaledVector(left, HALF + 6 + r() * 4);
    m.add(G.bush, r() < 0.5 ? 0x4f6a3a : 0x5a7044, q.x, 0.9, q.z, 0, r() * 6, 0, 3.4 + r() * 1.6, 2.2 + r() * 1.2, 3.0 + r());
    if (r() < 0.18) {
      m.add(G.cyl, 0x5a4a38, q.x + 2, 1.4, q.z, 0.12, 0, 0.08, 0.34, 2.8, 0.34);
      m.add(G.bush, 0x5a7044, q.x + 2.3, 3.4, q.z, 0, r() * 6, 0, 3.6, 2.2, 3.2);
    }
  }

  // --- Farolas altas de un brazo, en la acera del este, cada 28 m (de noche, solo su bombilla encendida) ---
  const lampPos: number[] = [];
  for (let d = 10; d < LEN - 6; d += 28) {
    const { p, left } = frame(d / LEN);
    const q = p.clone().addScaledVector(left, HALF + 3.4);
    m.add(G.cyl, LAMP_GREY, q.x, 4.3, q.z, 0, 0, 0, 0.16, 8.6, 0.16);
    const head = q.clone().addScaledVector(left, -1.3);
    const yaw = Math.atan2(left.x, left.z);
    m.add(G.box, LAMP_GREY, (q.x + head.x) / 2, 8.55, (q.z + head.z) / 2, 0, yaw, 0, 0.08, 0.08, 1.4);
    m.add(G.box, LAMP_GREY, head.x, 8.45, head.z, 0, yaw, 0, 0.32, 0.12, 0.6);
    lampPos.push(head.x, 8.3, head.z);
  }

  // --- Al oeste, más al sur de la urbanización de los alrededores: casas encaladas con su murete ---
  const tones = [0xfbf7ee, 0xf6f0e3, 0xfdfaf3, 0xf3ead8];
  let k = 0;
  for (let d = 12; d < LEN - 20; d += 19) {
    const { p, t, left } = frame(d / LEN);
    if (p.z > -125) break;
    const yaw = Math.atan2(t.x, t.z);
    const wall = p.clone().addScaledVector(left, -HALF - 2.55);
    for (const [s0, s1] of [
      [-8.75, -1.2],
      [1.2, 8.75],
    ]) {
      const c = (s0 + s1) / 2;
      m.add(G.box, WALL_WHITE, wall.x + t.x * c, 0.5, wall.z + t.z * c, 0, yaw, 0, 0.25, 1.0, s1 - s0);
    }
    for (const s of [-8.6, -1.2, 1.2, 8.6]) m.add(G.box, WALL_WHITE, wall.x + t.x * s, 0.65, wall.z + t.z * s, 0, yaw, 0, 0.55, 1.3, 0.55);
    const c = p.clone().addScaledVector(left, -HALF - 11.5);
    const two = r() < 0.5;
    const h = two ? 6 : 3.4;
    m.add(G.box, tones[k++ % tones.length], c.x, h / 2, c.z, 0, yaw, 0, 8, h, 10);
    m.add(ROOF_GEO, 0xb8623e, c.x, h, c.z, 0, yaw + Math.PI / 2, 0, 10.6, 1.7, 8.6);
    // ventanas en la fachada que da a la carretera (alguna con luz: es la una de la noche)
    const face = c.clone().addScaledVector(left, 4.02);
    const ax: 'x' | 'z' = Math.abs(left.x) > Math.abs(left.z) ? 'x' : 'z';
    const sgn = (ax === 'x' ? left.x : left.z) > 0 ? 1 : -1;
    for (const ws of [-2.4, 2.4])
      for (const y of two ? [1.6, 4.3] : [1.6]) {
        const lit = r() < 0.2;
        menorcaWindow(m, face.x + t.x * ws, y, face.z + t.z * ws, 1.0, 1.2, { axis: ax, s: sgn }, { lit, shutter: k % 2 ? LOUVRE_GREEN : LOUVRE_BLUE, closed: !lit && r() < 0.5 });
      }
    const g = p.clone().addScaledVector(left, -HALF - 5.5).addScaledVector(t, (r() - 0.5) * 8);
    const kind = r();
    if (kind < 0.4) {
      const ph = 7 + r() * 3;
      m.add(G.cyl, 0x6b5a40, g.x, ph / 2, g.z, 0, 0, 0.04, 0.42, ph, 0.42);
      palmCrown(m, g.x, ph, g.z, 2.6, 12);
    } else if (kind < 0.62) araucaria(m, g.x, 0, g.z, 13 + r() * 4, 3.6);
    else for (let b = 0; b < 4; b++) m.add(G.bush, b % 2 ? 0xd6338a : 0x3e7a3a, g.x + (r() - 0.5) * 2, 1.2 + r(), g.z + (r() - 0.5) * 2, 0, r() * 6, 0, 1.8, 1.4, 1.6);
  }

  // --- Señales, de cara a quien llega desde el sur ---
  const sign = (z: number, text: string, sub: string, bg: string, side: 1 | -1) => {
    let u = 0;
    for (let i = 0; i < axisPts.length; i++) if (axisPts[i].z <= z) u = i / (axisPts.length - 1);
    const { p, t, left } = frame(u);
    const q = p.clone().addScaledVector(left, side * (HALF + 1.0));
    m.add(G.cyl, 0x9a9ea2, q.x, 1.3, q.z, 0, 0, 0, 0.08, 2.6, 0.08);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.9),
      new THREE.MeshStandardMaterial({
        map: canvasTex(
          (ctx, w, h) => {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 10;
            ctx.strokeRect(10, 10, w - 20, h - 20);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 64px "Arial Narrow", Arial, sans-serif';
            ctx.fillText(text, w / 2, h * 0.47);
            ctx.font = '42px "Arial Narrow", Arial, sans-serif';
            ctx.fillText(sub, w / 2, h * 0.8);
          },
          512,
          256,
        ),
        roughness: 1,
      }),
    );
    panel.position.set(q.x, 2.75, q.z);
    panel.rotation.y = Math.atan2(-t.x, -t.z);
    sc.add(panel);
  };
  sign(-235, 'Urb. Son Oleo', 'Ciutadella', '#1f5f9e', 1);
  sign(-70, 'Son Oleo', '← Sa Son', '#2b6b3a', -1);

  const mesh = m.mesh();
  sc.add(mesh);
  if (lampPos.length)
    sc.add(
      new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)),
        new THREE.PointsMaterial({ map: glowTexture(), color: 0xffe2a8, size: 1.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    );
  return { mesh };
}
