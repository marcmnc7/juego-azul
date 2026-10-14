import * as THREE from 'three';
import type { Box2 } from '../world/ferreries';

// Movimiento en tercera persona relativo a la cámara, con colisión círculo-contra-cajas
// y cámara que se acerca si hay una pared detrás.
const R = 0.4;

export class Walker {
  facing = 0;
  yaw = 0;
  walk = 0;
  speed = 5.5;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  constructor(public pos: THREE.Vector3) {}

  /** Devuelve la intensidad del movimiento (0..1) para animar. */
  move(dt: number, ax: { x: number; y: number }, boxes: Box2[], b: Box2) {
    const mag = Math.min(1, Math.hypot(ax.x, ax.y));
    const p = this.pos;
    if (mag > 0.1) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const mx = fx * ax.y - fz * ax.x;
      const mz = fz * ax.y + fx * ax.x;
      const len = Math.hypot(mx, mz) || 1;
      p.x += (mx / len) * this.speed * mag * dt;
      p.z += (mz / len) * this.speed * mag * dt;
      let diff = Math.atan2(mx, mz) - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 12);
      this.walk += dt * 11 * mag;
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
    return mag > 0.1 ? mag : 0;
  }

  camera(cam: THREE.Camera, dt: number, walls: Box2[], dist = 7.5, h = 4) {
    const p = this.pos;
    const sx = -Math.sin(this.yaw);
    const sz = -Math.cos(this.yaw);
    let d = 1;
    for (; d < dist; d += 0.25) {
      const x = p.x + sx * d;
      const z = p.z + sz * d;
      if (walls.some((c) => c.maxX - c.minX > 2 && c.maxZ - c.minZ > 2 && x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3)) break;
    }
    this.camPos.set(p.x + sx * d, h + (dist - d) * 0.35, p.z + sz * d);
    cam.position.lerp(this.camPos, 1 - Math.exp(-dt * 6));
    this.camLook.set(p.x, 1.4, p.z);
    cam.lookAt(this.camLook);
  }
}
