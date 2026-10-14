import * as THREE from 'three';
import type { Box2 } from '../world/ferreries';

// Movimiento en tercera persona relativo a la cámara, con colisión círculo-contra-cajas,
// empujones, y una cámara que se coloca sola detrás al andar y se acerca si hay una pared.
const R = 0.4;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Walker {
  facing = 0;
  yaw = 0;
  walk = 0;
  speed = 5.8;
  knock = new THREE.Vector3();
  private manualCam = 0;
  private velocity = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
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

  /** Devuelve la intensidad del movimiento (0..1) para animar. */
  move(dt: number, ax: { x: number; y: number }, boxes: Box2[], b: Box2) {
    const mag = Math.min(1, Math.hypot(ax.x, ax.y));
    const p = this.pos;
    let tx = 0;
    let tz = 0;
    if (mag > 0.1) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const mx = fx * ax.y - fz * ax.x;
      const mz = fz * ax.y + fx * ax.x;
      const len = Math.hypot(mx, mz) || 1;
      tx = (mx / len) * this.speed * mag;
      tz = (mz / len) * this.speed * mag;
      this.facing += wrap(Math.atan2(mx, mz) - this.facing) * Math.min(1, dt * 12);
      this.walk += dt * 11 * mag;
      // La cámara se recoloca sola detrás, salvo si se camina hacia ella
      this.manualCam -= dt;
      if (this.manualCam <= 0 && ax.y > -0.35) this.yaw += wrap(this.facing - this.yaw) * Math.min(1, dt * 1.6 * mag);
    }
    // Aceleración suave
    const acc = 1 - Math.exp(-dt * 14);
    this.velocity.x += (tx - this.velocity.x) * acc;
    this.velocity.z += (tz - this.velocity.z) * acc;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    if (this.knock.lengthSq() > 0.01) {
      p.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
    for (const c of boxes) {
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * R;
          p.z = cz + (dz / d) * R;
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
    p.x = Math.max(b.minX, Math.min(b.maxX, p.x));
    p.z = Math.max(b.minZ, Math.min(b.maxZ, p.z));
    return Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / this.speed);
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
    this.camPos.set(p.x + sx * d, h + (dist - d) * 0.3, p.z + sz * d);
    cam.position.lerp(this.camPos, 1 - Math.exp(-dt * 7));
    // Mirar un poco por delante de la jugadora
    this.camLook.set(p.x - sx * 1.5, 1.3, p.z - sz * 1.5);
    cam.lookAt(this.camLook);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeT * 0.25;
      cam.position.x += (Math.random() - 0.5) * k;
      cam.position.y += (Math.random() - 0.5) * k;
    }
  }
}
