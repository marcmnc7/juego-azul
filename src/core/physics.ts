import * as THREE from 'three';
import type { Box2 } from '../world/ferreries';

// Física de objetos sueltos: pelotas que botan, ruedan y frenan con el aire; vasos y latas que
// aguantan de pie un toque suave pero se vuelcan con uno fuerte y luego ruedan de lado; todo choca
// entre sí, con las paredes y con la gente, y flota si cae al agua. Sin motor externo: integración
// semi-implícita con impulsos, suficiente y barata para un móvil.

export type BodyKind = 'ball' | 'cup';

export interface BodyOpts {
  kind: BodyKind;
  /** Radio (pelota) o radio del vaso. */
  r: number;
  /** Altura del vaso/lata (para la pelota se ignora). */
  h?: number;
  mass: number;
  /** Rebote 0..1 */
  bounce?: number;
  /** Densidad relativa al agua (<1 flota). */
  density?: number;
  /** Coeficiente de arrastre del aire (pelota de playa: alto). */
  drag?: number;
}

export class Body {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  kind: BodyKind;
  r: number;
  h: number;
  mass: number;
  bounce: number;
  density: number;
  drag: number;
  /** Vuelco: ángulo desde vertical (0 de pie, π/2 tumbado), su velocidad y el eje sobre el que cae. */
  tilt = 0;
  tiltV = 0;
  tiltAxis = new THREE.Vector3(1, 0, 0);
  /** Giro de rodadura acumulado (pelota: cuaternión; vaso tumbado: ángulo sobre su eje). */
  spin = new THREE.Quaternion();
  rollAngle = 0;
  asleep = false;
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private ax = new THREE.Vector3();

  constructor(public obj: THREE.Object3D, o: BodyOpts) {
    this.kind = o.kind;
    this.r = o.r;
    this.h = o.h ?? o.r * 2;
    this.mass = o.mass;
    this.bounce = o.bounce ?? 0.3;
    this.density = o.density ?? 1.2;
    this.drag = o.drag ?? 0.02;
  }

  get fallen() {
    return this.kind === 'cup' && this.tilt >= Math.PI / 2 - 1e-3;
  }

  /** Altura del centro sobre el suelo cuando reposa. */
  get rest() {
    if (this.kind === 'ball') return this.r;
    return this.fallen ? this.r : (this.h / 2) * Math.cos(this.tilt) + this.r * Math.sin(this.tilt);
  }

  wake() {
    this.asleep = false;
  }

  sync() {
    const o = this.obj;
    o.position.copy(this.pos);
    if (this.kind === 'ball') {
      o.quaternion.copy(this.spin);
      return;
    }
    // Vaso: primero rueda sobre su propio eje (si está tumbado) y después se inclina
    this.q.setFromAxisAngle(this.ax.set(0, 1, 0), this.rollAngle);
    this.q2.setFromAxisAngle(this.tiltAxis, this.tilt);
    o.quaternion.copy(this.q2).multiply(this.q);
  }

  /** Rodar una pelota: gira sobre el eje perpendicular al avance. */
  rollBall(dx: number, dz: number) {
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return;
    this.ax.set(dz / d, 0, -dx / d);
    this.q.setFromAxisAngle(this.ax, d / this.r);
    this.spin.premultiply(this.q);
  }
}

/** Algo que empuja sin ser empujado (personas, Joy): círculo con altura y velocidad. */
export interface Mover {
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  height: number;
}

export interface Water {
  box: Box2;
  level: number;
}

export interface Impact {
  at: THREE.Vector3;
  strength: number;
  kind: BodyKind;
}

const G = 9.81;
const tmp = new THREE.Vector3();

export class PhysicsWorld {
  bodies: Body[] = [];
  walls: Box2[] = [];
  bounds: Box2 | null = null;
  water: Water | null = null;
  floor = 0;
  impacts: Impact[] = [];
  private sub = 1 / 120;
  private time = 0;

  add(b: Body) {
    this.bodies.push(b);
    b.pos.y = Math.max(b.pos.y, this.floor + b.rest);
    b.sync();
    return b;
  }

  step(dt: number, movers: readonly Mover[] = []) {
    this.impacts.length = 0;
    if (dt <= 0) return;
    this.time += dt;
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const h = Math.min(this.sub, left);
      left -= h;
      for (const b of this.bodies) if (!b.asleep) this.integrate(b, h);
      this.collideMovers(movers);
      this.collidePairs();
    }
    for (const b of this.bodies) b.sync();
  }

  private inWater(b: Body) {
    const w = this.water;
    return !!w && b.pos.x > w.box.minX && b.pos.x < w.box.maxX && b.pos.z > w.box.minZ && b.pos.z < w.box.maxZ;
  }

  private integrate(b: Body, h: number) {
    const v = b.vel;
    const p = b.pos;
    const wet = this.inWater(b);
    const floor = wet && this.water ? this.water.level - 1.3 : this.floor;
    const rest = floor + b.rest;
    const grounded = p.y <= rest + 1e-3 && v.y <= 0.01;

    // Gravedad, flotación y arrastre (aire ∝ v², agua mucho más denso)
    v.y -= G * h;
    if (wet && this.water) {
      const lvl = this.water.level;
      const sub = THREE.MathUtils.clamp((lvl - (p.y - b.r)) / (2 * b.r), 0, 1);
      if (sub > 0) {
        v.y += (G * sub) / b.density * h;
        const k = Math.exp(-h * (1.2 + 3 * sub));
        v.x *= k;
        v.z *= k;
        v.y *= Math.exp(-h * 4 * sub);
        // Olas: un vaivén suave en la superficie
        v.x += Math.sin(this.time * 0.7 + p.z * 1.3) * 0.06 * sub * h;
        v.z += Math.cos(this.time * 0.5 + p.x * 1.1) * 0.06 * sub * h;
      }
    }
    const sp = v.length();
    if (sp > 1e-4) v.multiplyScalar(Math.max(0, 1 - b.drag * sp * h));

    // Vuelco de un vaso: gira sobre el borde de la base. Por debajo del ángulo crítico (centro de
    // masas aún dentro de la base) la gravedad lo endereza; por encima, lo tumba.
    if (b.kind === 'cup' && b.tilt > 0 && !b.fallen) {
      const lever = Math.hypot(b.h / 2, b.r);
      const crit = Math.atan2(b.r, b.h / 2);
      b.tiltV += (G / lever) * Math.sin(b.tilt - crit) * h;
      b.tiltV *= Math.exp(-h * 1.5);
      b.tilt += b.tiltV * h;
      if (b.tilt <= 0) {
        // Al asentarse da un pequeño golpe y se queda quieto
        b.tilt = 0;
        b.tiltV = -b.tiltV * 0.25 > 0.3 ? -b.tiltV * 0.25 : 0;
      } else if (b.tilt >= Math.PI / 2) {
        b.tilt = Math.PI / 2;
        if (b.tiltV > 1.5) this.impacts.push({ at: p.clone(), strength: b.tiltV * 0.15, kind: b.kind });
        b.tiltV = 0;
      }
    }

    p.addScaledVector(v, h);

    // Suelo: rebote con pérdida y rozamiento (deslizar → rodar)
    if (p.y < rest) {
      p.y = rest;
      if (v.y < -0.4) {
        this.impacts.push({ at: p.clone(), strength: -v.y * b.mass, kind: b.kind });
        v.y = -v.y * b.bounce;
        if (v.y < 0.25) v.y = 0;
      } else v.y = 0;
    }
    if (grounded || p.y <= rest + 1e-3) {
      const hs = Math.hypot(v.x, v.z);
      if (hs > 1e-4) {
        let decel: number;
        if (b.kind === 'ball') decel = 0.35; // rodadura
        else if (b.fallen) {
          // Tumbado: rueda de lado fácil, a lo largo de su eje arrastra
          const ax = tmp.set(0, 1, 0).applyAxisAngle(b.tiltAxis, b.tilt);
          const along = v.x * ax.x + v.z * ax.z;
          v.x -= ax.x * along * Math.min(1, h * 9);
          v.z -= ax.z * along * Math.min(1, h * 9);
          decel = 0.9;
        } else decel = 0.55 * G; // de pie: arrastrar el culo del vaso
        const nh = Math.max(0, Math.hypot(v.x, v.z) - decel * h);
        const k = nh / (Math.hypot(v.x, v.z) || 1);
        v.x *= k;
        v.z *= k;
      }
    }

    // Rodadura visual
    const dx = v.x * h;
    const dz = v.z * h;
    if (b.kind === 'ball') b.rollBall(dx, dz);
    else if (b.fallen) {
      const ax = tmp.set(0, 1, 0).applyAxisAngle(b.tiltAxis, b.tilt);
      // avance perpendicular al eje → giro sobre el eje
      const perp = dx * ax.z - dz * ax.x;
      b.rollAngle += perp / b.r;
    }

    // Paredes y límites
    const R = b.kind === 'ball' ? b.r : b.fallen ? b.h / 2 : b.r;
    for (const c of this.walls) this.wall(b, c, R);
    if (this.bounds) {
      const B = this.bounds;
      if (p.x < B.minX + R) ((p.x = B.minX + R), (v.x = Math.abs(v.x) * b.bounce));
      if (p.x > B.maxX - R) ((p.x = B.maxX - R), (v.x = -Math.abs(v.x) * b.bounce));
      if (p.z < B.minZ + R) ((p.z = B.minZ + R), (v.z = Math.abs(v.z) * b.bounce));
      if (p.z > B.maxZ - R) ((p.z = B.maxZ - R), (v.z = -Math.abs(v.z) * b.bounce));
    }
    // Agua: no sale de la piscina flotando
    if (wet && this.water) {
      const W = this.water.box;
      if (p.x < W.minX + R) ((p.x = W.minX + R), (v.x = Math.abs(v.x) * 0.3));
      if (p.x > W.maxX - R) ((p.x = W.maxX - R), (v.x = -Math.abs(v.x) * 0.3));
      if (p.z < W.minZ + R) ((p.z = W.minZ + R), (v.z = Math.abs(v.z) * 0.3));
      if (p.z > W.maxZ - R) ((p.z = W.maxZ - R), (v.z = -Math.abs(v.z) * 0.3));
    }

    // Dormir cuando ya no se mueve (ahorra CPU)
    if (!wet && p.y <= rest + 1e-3 && v.lengthSq() < 0.0004 && (b.kind === 'ball' || b.tilt === 0 || b.fallen)) {
      v.set(0, 0, 0);
      b.asleep = true;
    }
  }

  private wall(b: Body, c: Box2, R: number) {
    const p = b.pos;
    const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) return;
    let nx: number;
    let nz: number;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      nx = dx / d;
      nz = dz / d;
      p.x = cx + nx * R;
      p.z = cz + nz * R;
    } else {
      const opts = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z];
      const i = opts.indexOf(Math.min(...opts));
      nx = i === 0 ? -1 : i === 1 ? 1 : 0;
      nz = i === 2 ? -1 : i === 3 ? 1 : 0;
      if (i === 0) p.x = c.minX - R;
      else if (i === 1) p.x = c.maxX + R;
      else if (i === 2) p.z = c.minZ - R;
      else p.z = c.maxZ + R;
    }
    const vn = b.vel.x * nx + b.vel.z * nz;
    if (vn < 0) {
      b.vel.x -= (1 + b.bounce) * vn * nx;
      b.vel.z -= (1 + b.bounce) * vn * nz;
      if (vn < -1) this.impacts.push({ at: p.clone(), strength: -vn * b.mass, kind: b.kind });
    }
  }

  /** Golpe de un pie o un cuerpo: velocidad relativa a lo largo de la normal, con algo de elevación si es una patada. */
  private collideMovers(movers: readonly Mover[]) {
    for (const m of movers) {
      for (const b of this.bodies) {
        if (b.pos.y - b.r > m.height) continue;
        const R = (b.kind === 'cup' && b.fallen ? b.h / 2 : b.r) + m.r;
        const dx = b.pos.x - m.x;
        const dz = b.pos.z - m.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const nx = dx / d;
        const nz = dz / d;
        b.pos.x = m.x + nx * R;
        b.pos.z = m.z + nz * R;
        // El que empuja es mucho más pesado: masa efectiva infinita
        const rel = (b.vel.x - m.vx) * nx + (b.vel.z - m.vz) * nz;
        if (rel >= 0) continue;
        const wet = this.inWater(b);
        // En el agua se empuja, no se golpea: casi sin rebote y sin levantarla
        const dv = -(1 + (wet ? 0.1 : b.bounce)) * rel;
        b.vel.x += dv * nx;
        b.vel.z += dv * nz;
        b.wake();
        const low = b.pos.y < 0.6;
        if (b.kind === 'ball' && low && !wet) b.vel.y += dv * 0.35; // patada: la pelota sube un poco
        if (b.kind === 'cup' && !b.fallen) {
          // El golpe lo hace girar sobre el borde; la gravedad decide si se tumba o se endereza
          b.tiltAxis.set(nz, 0, -nx).normalize();
          b.tilt = Math.max(b.tilt, 0.001);
          b.tiltV = Math.max(b.tiltV, (dv * 0.4) / Math.hypot(b.h / 2, b.r));
        }
        if (dv > 0.8) this.impacts.push({ at: b.pos.clone(), strength: dv * b.mass * 3, kind: b.kind });
      }
    }
  }

  private collidePairs() {
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (a.asleep && b.asleep) continue;
        const ra = a.kind === 'cup' && a.fallen ? a.h / 2 : a.r;
        const rb = b.kind === 'cup' && b.fallen ? b.h / 2 : b.r;
        const R = ra + rb;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const dy = b.pos.y - a.pos.y;
        if (Math.abs(dy) > Math.max(a.h, a.r * 2, b.h, b.r * 2)) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-3;
        const nx = dx / d;
        const nz = dz / d;
        const im = 1 / a.mass + 1 / b.mass;
        const pen = R - d;
        a.pos.x -= (nx * pen * (1 / a.mass)) / im;
        a.pos.z -= (nz * pen * (1 / a.mass)) / im;
        b.pos.x += (nx * pen * (1 / b.mass)) / im;
        b.pos.z += (nz * pen * (1 / b.mass)) / im;
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rel >= 0) continue;
        const e = Math.min(a.bounce, b.bounce);
        const jImp = (-(1 + e) * rel) / im;
        a.vel.x -= (jImp * nx) / a.mass;
        a.vel.z -= (jImp * nz) / a.mass;
        b.vel.x += (jImp * nx) / b.mass;
        b.vel.z += (jImp * nz) / b.mass;
        a.wake();
        b.wake();
        // Una pelota que da a un vaso de pie lo puede tumbar
        for (const [c, s] of [[a, -1], [b, 1]] as const) {
          if (c.kind !== 'cup' || c.fallen) continue;
          const dv = jImp / c.mass;
          if (dv > 0.3) {
            c.tiltAxis.set(nz * s, 0, -nx * s).normalize();
            c.tilt = Math.max(c.tilt, 0.001);
            c.tiltV = Math.max(c.tiltV, (dv * 0.4) / Math.hypot(c.h / 2, c.r));
          }
        }
        if (-rel > 1) this.impacts.push({ at: a.pos.clone(), strength: jImp, kind: a.kind });
      }
    }
  }
}

/** Pelota de playa de gajos de colores. */
export function beachBallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const cols = ['#e63946', '#ffffff', '#ffbe0b', '#ffffff', '#3a86ff', '#ffffff'];
  cols.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect((i * 256) / cols.length, 0, 256 / cols.length + 1, 128);
  });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 118, 256, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
