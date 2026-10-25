import * as THREE from 'three';
import type { Box2 } from '../world/ferreries';

// Movimiento en tercera persona relativo a la cámara, con colisión círculo-contra-cajas,
// empujones, y una cámara que se coloca sola detrás al andar y se acerca si hay una pared.
const R = 0.4;

/** Obstáculo redondo (personas, ases): x, z y radio. */
export interface Circle {
  x: number;
  z: number;
  r: number;
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Muelle amortiguado crítico: sigue un objetivo sin pasarse, como un músculo o una suspensión. */
export function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = 1 / (f + hhoo);
  return [(f * x + dt * v + hhoo * target) * det, (v + hoo * (target - x)) * det];
}

// Física de andar: la velocidad no cambia de golpe (hay masa), girar en seco frena, un empujón te
// desplaza y te hace perder el control un momento, y la pared frena de verdad en vez de resbalar.
const ACCEL = 16; // m/s² arrancando (≈0,35 s hasta correr)
const BRAKE = 24; // m/s² frenando o cambiando de sentido
const STUMBLE_DECEL = 8; // m/s² mientras te recuperas de un empujón
const STRIDE = 0.53; // metros por radián de ciclo de paso (una zancada ≈ 1,65 m)

export class Walker {
  facing = 0;
  yaw = 0;
  /** Fase del ciclo de paso: avanza con la distancia recorrida, así los pies no patinan. */
  walk = 0;
  speed = 5.8;
  /** Agarre: 1 en suelo; en el agua bajo, para que se deslice y cueste arrancar y frenar. */
  traction = 1;
  knock = new THREE.Vector3();
  /** Inclinación hacia delante (aceleración) y hacia el lado (curvas), suavizadas, en radianes. */
  leanFwd = 0;
  leanSide = 0;
  private leanFwdV = 0;
  private leanSideV = 0;
  /** Velocidad que la jugadora quiere llevar (hacia donde empuja), aunque algo se lo impida. */
  wish = new THREE.Vector2();
  private turnRate = 0;
  private stumble = 0;
  /** Choque contra una persona este fotograma (m/s de impacto; 0 si no hubo), para sonido o reacción. */
  bump = 0;
  /** Persona contra la que se ha chocado (el círculo), si alguna. */
  bumped: Circle | null = null;
  private bumpCd = 0;
  private manualCam = 0;
  private velocity = new THREE.Vector3();
  private prevSpeed = 0;
  private camPos = new THREE.Vector3();
  private camVel = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lookVel = new THREE.Vector3();
  private camInit = false;
  private baseFov = 0;
  private shakeT = 0;

  constructor(public pos: THREE.Vector3) {}

  /** Giro de cámara manual (arrastre con el dedo). */
  turn(delta: number) {
    if (delta !== 0) {
      this.yaw -= delta;
      this.manualCam = 1.5;
    }
  }

  shake(t = 0.35) {
    this.shakeT = t;
  }

  /** Velocidad real en x y z. */
  get vx() {
    return this.velocity.x;
  }
  get vz() {
    return this.velocity.z;
  }

  /** Velocidad actual (m/s). */
  get currentSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Para teletransportes y escenas: parar en seco sin inercia. */
  stop() {
    this.velocity.set(0, 0, 0);
    this.knock.set(0, 0, 0);
    this.stumble = 0;
  }

  /** Devuelve la intensidad del movimiento (0..1) para animar. */
  move(dt: number, ax: { x: number; y: number }, boxes: Box2[], b: Box2, circles: readonly Circle[] = []) {
    if (dt <= 0) return Math.min(1, this.currentSpeed / this.speed);
    let mag = Math.min(1, Math.hypot(ax.x, ax.y));
    const p = this.pos;
    const sx = p.x;
    const sz = p.z;
    const v = this.velocity;

    // Empujón: impulso de velocidad y un momento sin control total
    if (this.knock.lengthSq() > 0.01) {
      v.x += this.knock.x * 0.65;
      v.z += this.knock.z * 0.65;
      this.stumble = 0.45;
      this.knock.set(0, 0, 0);
    }
    this.stumble = Math.max(0, this.stumble - dt);
    if (this.stumble > 0) mag *= 0.25;

    let tx = 0;
    let tz = 0;
    const prevFacing = this.facing;
    const spd = this.currentSpeed;
    if (mag > 0.1) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const mx = fx * ax.y - fz * ax.x;
      const mz = fz * ax.y + fx * ax.x;
      const want = Math.atan2(mx, mz);
      // Se gira rápido parado y más despacio corriendo
      const maxTurn = THREE.MathUtils.lerp(14, 7, Math.min(1, spd / this.speed));
      const diff = wrap(want - this.facing);
      this.facing += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn * dt, Math.abs(diff) * Math.min(1, dt * 16));
      // Girar en seco frena: la velocidad deseada cae con el ángulo entre hacia dónde miras y hacia dónde vas
      const off = Math.abs(wrap(want - this.facing));
      const turnPenalty = 0.3 + 0.7 * Math.max(0, Math.cos(Math.min(Math.PI / 2, off * 1.2)));
      const len = Math.hypot(mx, mz) || 1;
      tx = (mx / len) * this.speed * mag * turnPenalty;
      tz = (mz / len) * this.speed * mag * turnPenalty;
      // La cámara se recoloca sola detrás, salvo si se camina hacia ella
      this.manualCam -= dt;
      if (this.manualCam <= 0 && ax.y > -0.35) this.yaw += wrap(this.facing - this.yaw) * Math.min(1, dt * 1.6 * mag);
    }
    this.turnRate = wrap(this.facing - prevFacing) / dt;
    this.wish.set(tx, tz);

    // Aceleración limitada: arrancar cuesta un poco más que frenar
    const dx = tx - v.x;
    const dz = tz - v.z;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-5) {
      const speeding = tx * v.x + tz * v.z > 0 && tx * tx + tz * tz > v.x * v.x + v.z * v.z;
      const a = (this.stumble > 0 ? STUMBLE_DECEL : speeding ? ACCEL : BRAKE) * this.traction;
      const step = Math.min(dl, a * dt);
      v.x += (dx / dl) * step;
      v.z += (dz / dl) * step;
    }
    p.x += v.x * dt;
    p.z += v.z * dt;

    for (const c of boxes) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const ex = p.x - cx;
      const ez = p.z - cz;
      const d2 = ex * ex + ez * ez;
      if (d2 < R * R) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (ex / d) * R;
          p.z = cz + (ez / d) * R;
        } else {
          const opts = [p.x - c.minX, c.maxX - p.x, p.z - c.minZ, c.maxZ - p.z];
          const i = opts.indexOf(Math.min(...opts));
          if (i === 0) p.x = c.minX - R;
          else if (i === 1) p.x = c.maxX + R;
          else if (i === 2) p.z = c.minZ - R;
          else p.z = c.maxZ + R;
        }
      }
    }
    // Personas y animales: empujar hacia fuera del círculo. Rozar a alguien te desvía (resbalas por
    // su lado); chocar de frente corriendo te hace rebotar un poco, como contra un cuerpo de verdad.
    this.bump = 0;
    this.bumped = null;
    this.bumpCd = Math.max(0, this.bumpCd - dt);
    for (const c of circles) {
      const ex = p.x - c.x;
      const ez = p.z - c.z;
      const rr = c.r + R;
      const d2 = ex * ex + ez * ez;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1e-3;
        const nx = ex / d;
        const nz = ez / d;
        p.x = c.x + nx * rr;
        p.z = c.z + nz * rr;
        const vn = -(v.x * nx + v.z * nz);
        if (vn > 2.6 && this.bumpCd <= 0) {
          this.bump = vn;
          this.bumped = c;
          this.bumpCd = 0.5;
          this.knock.set(nx * vn * 0.55, 0, nz * vn * 0.55);
          this.shake(0.12);
        }
      }
    }
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));

    // Lo que de verdad se ha movido manda: contra una pared la velocidad se pierde
    const realX = (p.x - sx) / dt;
    const realZ = (p.z - sz) / dt;
    if (Math.abs(realX - v.x) > 0.01) v.x = realX;
    if (Math.abs(realZ - v.z) > 0.01) v.z = realZ;

    const moved = Math.hypot(p.x - sx, p.z - sz);
    this.walk += moved / STRIDE;

    // Inclinación: hacia delante al acelerar (y un poco siempre al correr), hacia dentro en las curvas
    const now = this.currentSpeed;
    const accel = (now - this.prevSpeed) / dt;
    this.prevSpeed = now;
    const fwdTarget = THREE.MathUtils.clamp(accel * 0.012 + (now / this.speed) * 0.07, -0.12, 0.2);
    const sideTarget = THREE.MathUtils.clamp(-this.turnRate * now * 0.012, -0.22, 0.22);
    [this.leanFwd, this.leanFwdV] = spring(this.leanFwd, this.leanFwdV, fwdTarget, 10, dt);
    [this.leanSide, this.leanSideV] = spring(this.leanSide, this.leanSideV, sideTarget, 9, dt);
    return Math.min(1, now / this.speed);
  }

  camera(cam: THREE.Camera, dt: number, walls: Box2[], dist = 7, h = 3.6) {
    const p = this.pos;
    const sx = -Math.sin(this.yaw);
    const sz = -Math.cos(this.yaw);
    let d = 1.2;
    for (; d < dist; d += 0.25) {
      const x = p.x + sx * d;
      const z = p.z + sz * d;
      if (walls.some((c) => c.maxX - c.minX > 2 && c.maxZ - c.minZ > 2 && x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4)) break;
    }
    const run = Math.min(1, this.currentSpeed / this.speed);
    this.camPos.set(p.x + sx * d, h + (dist - d) * 0.3, p.z + sz * d);
    this.camLook.set(p.x - sx * 1.5, 1.3, p.z - sz * 1.5);
    if (!this.camInit || cam.position.distanceToSquared(this.camPos) > 400) {
      // Primera vez o teletransporte: sin muelle
      this.camInit = true;
      cam.position.copy(this.camPos);
      this.camVel.set(0, 0, 0);
      this.lookVel.set(0, 0, 0);
      cam.userData.look = this.camLook.clone();
    }
    // Cámara con muelle (como una steadicam): sigue con un pelín de retraso y frena sin tirones
    const look = (cam.userData.look as THREE.Vector3 | undefined) ?? (cam.userData.look = this.camLook.clone());
    const cp = cam.position;
    const k = dt <= 0 ? 0 : dt;
    for (const ax of ['x', 'y', 'z'] as const) {
      [cp[ax], this.camVel[ax]] = spring(cp[ax], this.camVel[ax], this.camPos[ax], 5.5, k);
      [look[ax], this.lookVel[ax]] = spring(look[ax], this.lookVel[ax], this.camLook[ax], 9, k);
    }
    // Un leve balanceo con los pasos al correr
    const bob = Math.abs(Math.sin(this.walk)) * 0.04 * run;
    cam.lookAt(look.x, look.y + bob, look.z);
    const pc = cam as THREE.PerspectiveCamera;
    if (pc.isPerspectiveCamera) {
      if (!this.baseFov) this.baseFov = pc.fov;
      const fov = (pc.userData.baseFov ?? this.baseFov) + run * 3;
      if (Math.abs(pc.fov - fov) > 0.05) {
        pc.fov += (fov - pc.fov) * Math.min(1, k * 3);
        pc.updateProjectionMatrix();
      }
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeT * 0.25;
      cp.x += (Math.random() - 0.5) * s;
      cp.y += (Math.random() - 0.5) * s;
    }
  }
}
