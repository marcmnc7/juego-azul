import * as THREE from 'three';
import { G, Merger, palmCrown, araucaria } from '../entities/models';
import { glowTexture } from '../core/gfx';
import { setSurface, Surf } from '../core/surfaces';
import { ROOF_GEO, rand, type Box2 } from './ferreries';
import { menorcaWindow, MARES, LOUVRE_GREEN, LOUVRE_BLUE } from './menorcaHouse';
import { canvasTex } from './deco';

// Del Born a casa de Gas (cap. 2): la carretera de la urbanización Son Oleo, como en Street View. Dos carriles con
// la línea discontinua; a la derecha, carril bici rojo separado por «armadillos» negros y amarillos, acera de baldosa
// roja y la pared de piedra seca con remate de marès, con lentisco y acebuche detrás; a la izquierda, acera y las
// casas encaladas de la urbanización con su murete blanco y sus pilares, palmeras y araucarias; farolas altas de un
// brazo y alguna señal. Curvas suaves, como la de verdad. Entra en la calle de casa por el este (la calle es de
// sentido único hacia el oeste) y el coche sigue por ella hasta delante del vecino.

/** El eje de la carretera, de principio a fin (y = 0). Acaba en el eje de la calle de casa (z = -23,5). */
const AXIS = new THREE.CatmullRomCurve3(
  [
    [262, -70],
    [222, -60],
    [184, -46],
    [146, -38],
    [110, -33],
    [80, -26.5],
    [58, -23.6],
    [45, -23.5],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);

/** Medio ancho del asfalto (dos carriles de 3,3 m). */
const HALF = 3.3;
/** El carril de la derecha: el coche va por él (a la derecha del eje, en el sentido de la marcha). */
const LANE = 1.65;
/** Carril de la calle de casa por donde entra el coche (ver homeStreet: laneZ). */
const STREET_LANE_Z = -21.8;

// Colores propios (cada uno con su dibujo de superficie)
const BIKE_RED = 0xa94b3f;
const WALK_RED = 0xb8786a;
const KERB = 0xd8d2c4;
const WALL_STONE = 0x9a8f80;
const WALL_WHITE = 0xf4efe2;
const LAMP_GREY = 0x5c6168;
setSurface(BIKE_RED, Surf.Asphalt);
setSurface(WALK_RED, Surf.Paving);
setSurface(WALL_STONE, Surf.DryStone);

const axisPts = AXIS.getSpacedPoints(360);
const tmp = new THREE.Vector3();
/** Punto del eje, su tangente y su normal izquierda (en el sentido de la marcha) en u ∈ [0, 1]. */
function frame(u: number) {
  const p = AXIS.getPointAt(u);
  AXIS.getTangentAt(u, tmp);
  // (arriba × tangente: hacia el oeste, la izquierda es el norte)
  return { p, left: new THREE.Vector3(tmp.z, 0, -tmp.x), t: tmp.clone() };
}

/** El recorrido del coche: por el carril de la derecha y, ya en la calle de casa, por su carril. */
export const DRIVE_PATH = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const { p, left } = frame(i / 60);
    const q = p.clone().addScaledVector(left, -LANE);
    // los últimos metros, del carril de la carretera al de la calle (que está al otro lado del eje)
    if (p.x < 62) q.z = THREE.MathUtils.lerp(q.z, STREET_LANE_Z, THREE.MathUtils.smoothstep(62 - p.x, 0, 15));
    pts.push(q);
  }
  pts.push(new THREE.Vector3(30, 0, STREET_LANE_Z), new THREE.Vector3(11, 0, STREET_LANE_Z));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
})();

/** Donde empieza el coche (u del recorrido): unos metros dentro, que no se vea dónde nace la carretera. */
export const DRIVE_START_U = 30 / DRIVE_PATH.getLength();

/** Lo que no se puede rellenar con casas de los alrededores (la carretera pasa por ahí). */
export const ROAD_KEEP_OUT: Box2 = { minX: 38, maxX: 120, minZ: -52, maxZ: -6 };

/** Lejos de la carretera: ahí sí puede haber lomas (una loma encima la enterraba). */
export function farFromRoad(x: number, z: number, d = 85) {
  return axisPts.every((p) => Math.hypot(p.x - x, p.z - z) > d);
}

/**
 * Banda a lo largo del eje entre los desplazamientos laterales a y b (izquierda positiva), de y0 a y1: con y1 > y0 es
 * un prisma (bordillo, acera, pared); si no, una cinta plana a la altura y0. Solo donde el eje va por x ≥ xMin.
 */
function band(a: number, b: number, y0: number, y1: number, xMin = 44, step = 2) {
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
  const n = Math.ceil(AXIS.getLength() / step);
  let prev: { R0: THREE.Vector3; L0: THREE.Vector3; R1: THREE.Vector3; L1: THREE.Vector3 } | null = null;
  const top = Math.max(y0, y1);
  for (let i = 0; i <= n; i++) {
    const { p, left } = frame(i / n);
    if (p.x < xMin) {
      prev = null;
      continue;
    }
    const R = p.clone().addScaledVector(left, lo), Lf = p.clone().addScaledVector(left, hi);
    const cur = { R0: R.clone().setY(y0), L0: Lf.clone().setY(y0), R1: R.clone().setY(top), L1: Lf.clone().setY(top) };
    if (prev) {
      // (vistos desde arriba, en el sentido de la marcha: el borde derecho, el izquierdo)
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
  const flat = new Merger();
  const L = AXIS.getLength();

  // Campo bajo todo (los alrededores no llegan tan lejos al este)
  flat.add(G.box, 0x5f6f3c, 190, -0.13, -40, 0, 0, 0, 300, 0.1, 200);

  // --- Calzada: asfalto, líneas, carril bici, bordillos y aceras ---
  flat.add(band(-HALF, HALF, 0.0, 0.0), 0x4a4a50);
  for (const off of [HALF - 0.25, -(HALF - 0.25)]) flat.add(band(off - 0.06, off + 0.06, 0.012, 0.012), 0xe8e2d0); // líneas de borde
  // Línea discontinua del centro: trazos de 3 m cada 9 m
  for (let d = 4; d < L - 2; d += 9) {
    const { p, t } = frame(d / L);
    if (p.x < 46) continue;
    m.add(G.box, 0xe8e2d0, p.x, 0.012, p.z, 0, Math.atan2(t.x, t.z), 0, 0.12, 0.02, 3);
  }
  // A la derecha: carril bici rojo con armadillos, bordillo, acera roja y la pared seca con su remate de marès
  flat.add(band(-HALF - 1.6, -HALF, 0.006, 0.006), BIKE_RED);
  for (let d = 2; d < L; d += 3.2) {
    const { p, t, left } = frame(d / L);
    if (p.x < 46) continue;
    const a = p.clone().addScaledVector(left, -HALF - 0.08);
    const yaw = Math.atan2(t.x, t.z);
    m.add(G.sphere, 0x1d1d20, a.x, 0.02, a.z, 0, yaw, 0, 0.28, 0.12, 0.62); // armadillo
    m.add(G.box, 0xe8c02a, a.x, 0.07, a.z, 0, yaw, 0, 0.22, 0.03, 0.1); // su franja amarilla
  }
  m.add(band(-HALF - 1.8, -HALF - 1.6, 0, 0.14), KERB);
  m.add(band(-HALF - 3.9, -HALF - 1.8, 0, 0.12), WALK_RED);
  m.add(band(-HALF - 4.5, -HALF - 3.9, 0, 1.0), WALL_STONE);
  m.add(band(-HALF - 4.58, -HALF - 3.82, 1.0, 1.16), MARES); // remate de marès
  // A la izquierda: bordillo y acera roja
  m.add(band(HALF, HALF + 0.2, 0, 0.14), KERB);
  m.add(band(HALF + 0.2, HALF + 2.1, 0, 0.12), WALK_RED);

  // --- Detrás de la pared seca: lentisco y acebuche, apretados ---
  for (let d = 6; d < L; d += 4.5) {
    const { p, left } = frame(d / L);
    if (p.x < 70) continue;
    const q = p.clone().addScaledVector(left, -HALF - 6 - r() * 4);
    m.add(G.bush, r() < 0.5 ? 0x4f6a3a : 0x5a7044, q.x, 0.9, q.z, 0, r() * 6, 0, 3.4 + r() * 1.6, 2.2 + r() * 1.2, 3.0 + r());
    if (r() < 0.18) {
      // un acebuche que sobresale
      m.add(G.cyl, 0x5a4a38, q.x + 2, 1.4, q.z, 0.12, 0, 0.08, 0.34, 2.8, 0.34);
      m.add(G.bush, 0x5a7044, q.x + 2.3, 3.4, q.z, 0, r() * 6, 0, 3.6, 2.2, 3.2);
    }
  }

  // --- Farolas altas de un brazo, en la acera de la derecha, cada 28 m (de noche, solo su bombilla encendida) ---
  const lampPos: number[] = [];
  for (let d = 10; d < L - 6; d += 28) {
    const { p, left } = frame(d / L);
    if (p.x < 48) continue;
    const q = p.clone().addScaledVector(left, -HALF - 3.4);
    m.add(G.cyl, LAMP_GREY, q.x, 4.3, q.z, 0, 0, 0, 0.16, 8.6, 0.16);
    const head = q.clone().addScaledVector(left, 1.3);
    const yaw = Math.atan2(left.x, left.z);
    m.add(G.box, LAMP_GREY, (q.x + head.x) / 2, 8.55, (q.z + head.z) / 2, 0, yaw, 0, 0.08, 0.08, 1.4);
    m.add(G.box, LAMP_GREY, head.x, 8.45, head.z, 0, yaw, 0, 0.32, 0.12, 0.6);
    lampPos.push(head.x, 8.3, head.z);
  }

  // --- Las casas de la urbanización, a la izquierda: murete blanco con pilares, casa encalada, palmeras ---
  const tones = [0xfbf7ee, 0xf6f0e3, 0xfdfaf3, 0xf3ead8];
  let k = 0;
  for (let d = 12; d < L - 20; d += 19) {
    const { p, t, left } = frame(d / L);
    if (p.x < 70) continue;
    const yaw = Math.atan2(t.x, t.z);
    const wall = p.clone().addScaledVector(left, HALF + 2.35);
    // murete (con un hueco: la puerta de la parcela) y sus pilares
    for (const [s0, s1] of [[-8.75, -1.2], [1.2, 8.75]]) {
      const c = (s0 + s1) / 2;
      m.add(G.box, WALL_WHITE, wall.x + t.x * c, 0.5, wall.z + t.z * c, 0, yaw, 0, 0.25, 1.0, s1 - s0);
    }
    for (const s of [-8.6, -1.2, 1.2, 8.6]) m.add(G.box, WALL_WHITE, wall.x + t.x * s, 0.65, wall.z + t.z * s, 0, yaw, 0, 0.55, 1.3, 0.55);
    // la casa, separada del murete por el jardín, de cara a la carretera
    const c = p.clone().addScaledVector(left, HALF + 11);
    const two = r() < 0.5;
    const h = two ? 6 : 3.4;
    m.add(G.box, tones[k++ % tones.length], c.x, h / 2, c.z, 0, yaw, 0, 8, h, 10);
    m.add(ROOF_GEO, 0xb8623e, c.x, h, c.z, 0, yaw + Math.PI / 2, 0, 10.6, 1.7, 8.6);
    // ventanas en la fachada que da a la carretera (alguna con luz: es la una de la noche)
    const face = c.clone().addScaledVector(left, -4.02);
    const ax: 'x' | 'z' = Math.abs(left.x) > Math.abs(left.z) ? 'x' : 'z';
    const sgn = (ax === 'x' ? -left.x : -left.z) > 0 ? 1 : -1;
    for (const ws of [-2.4, 2.4])
      for (const y of two ? [1.6, 4.3] : [1.6]) {
        const lit = r() < 0.2;
        menorcaWindow(m, face.x + t.x * ws, y, face.z + t.z * ws, 1.0, 1.2, { axis: ax, s: sgn }, { lit, shutter: k % 2 ? LOUVRE_GREEN : LOUVRE_BLUE, closed: !lit && r() < 0.5 });
      }
    // en el jardín: una palmera, una araucaria o una buganvilla
    const g = p.clone().addScaledVector(left, HALF + 5.5).addScaledVector(t, (r() - 0.5) * 8);
    const kind = r();
    if (kind < 0.4) {
      const ph = 7 + r() * 3;
      m.add(G.cyl, 0x6b5a40, g.x, ph / 2, g.z, 0, 0, 0.04, 0.42, ph, 0.42);
      palmCrown(m, g.x, ph, g.z, 2.6, 12);
    } else if (kind < 0.62) araucaria(m, g.x, 0, g.z, 13 + r() * 4, 3.6);
    else for (let b = 0; b < 4; b++) m.add(G.bush, b % 2 ? 0xd6338a : 0x3e7a3a, g.x + (r() - 0.5) * 2, 1.2 + r(), g.z + (r() - 0.5) * 2, 0, r() * 6, 0, 1.8, 1.4, 1.6);
  }

  // --- Señales, de cara a quien llega ---
  const sign = (d: number, text: string, sub: string, bg: string) => {
    const { p, t, left } = frame(d / L);
    const q = p.clone().addScaledVector(left, HALF + 1.2);
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
  sign(L * 0.22, 'Urb. Son Oleo', 'Sa Farola · Sant Nicolau', '#1f5f9e');
  sign(L * 0.72, 'Son Oleo', '↓ Ciutadella centre', '#2b6b3a');

  const mesh = m.mesh();
  sc.add(mesh);
  const ground = flat.mesh();
  ground.userData.noCast = true;
  sc.add(ground);
  if (lampPos.length)
    sc.add(
      new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3)),
        new THREE.PointsMaterial({ map: glowTexture(), color: 0xffe2a8, size: 1.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    );
  return { mesh };
}
