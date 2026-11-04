import * as THREE from 'three';
import type { Circle } from './walker';
import type { Box2 } from '../world/ferreries';
import { physFor } from './phys';

// Pasos de los personajes no jugadores: tienen masa (arrancan y frenan poco a poco), giran el
// cuerpo con una velocidad máxima en vez de rotar al instante, frenan al llegar y esquivan a los
// demás (y a la jugadora) con una fuerza de separación lateral, como la gente de verdad.

export interface SteerState {
  vx?: number;
  vz?: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Avanza `root` hacia (tx, tz). Devuelve la distancia que queda.
 * - speed: velocidad de crucero (m/s); accel: m/s² (por defecto 3,5, una persona andando).
 * - avoid: círculos a esquivar; self, el propio, que se salta.
 */
export function steerTo(
  root: THREE.Object3D,
  st: SteerState,
  tx: number,
  tz: number,
  speed: number,
  dt: number,
  avoid: readonly Circle[] = [],
  accel = 3.5,
  radius = 0.32,
  self?: Circle,
  walls?: readonly Box2[],
) {
  const r = root.position;
  let vx = st.vx ?? 0;
  let vz = st.vz ?? 0;
  const dx = tx - r.x;
  const dz = tz - r.z;
  const d = Math.hypot(dx, dz);
  // Llegada: la velocidad deseada cae para parar justo en el punto (v² = 2·a·d)
  const want = Math.min(speed, Math.sqrt(2 * accel * 0.8 * Math.max(0, d - 0.02)));
  let wx = d > 1e-4 ? (dx / d) * want : 0;
  let wz = d > 1e-4 ? (dz / d) * want : 0;
  // Separación: un empujoncito lateral para no atravesar a nadie
  for (const c of avoid) {
    if (c === self) continue;
    const ex = r.x - c.x;
    const ez = r.z - c.z;
    const e2 = ex * ex + ez * ez;
    const rr = c.r + radius + 0.35;
    if (e2 < 1e-6 || e2 > rr * rr) continue;
    const e = Math.sqrt(e2);
    const k = ((rr - e) / rr) * 2.2;
    // Mitad hacia fuera, mitad de lado (rodea en vez de rebotar)
    const side = ex * wz - ez * wx >= 0 ? 1 : -1;
    wx += (ex / e) * k + (-ez / e) * k * 0.6 * side;
    wz += (ez / e) * k + (ex / e) * k * 0.6 * side;
  }
  const ddx = wx - vx;
  const ddz = wz - vz;
  const dl = Math.hypot(ddx, ddz);
  if (dl > 1e-5) {
    const step = Math.min(dl, accel * 1.4 * dt);
    vx += (ddx / dl) * step;
    vz += (ddz / dl) * step;
  }
  // Con paredes: resbala en ellas como el personaje del jugador, sin cruzarlas
  const phys = walls ? physFor(walls as Box2[]) : null;
  if (phys) {
    const m = phys.move(st, { x: r.x, y: 0, z: r.z }, vx * dt, vz * dt, radius);
    r.x += m.x;
    r.z += m.z;
  } else {
    r.x += vx * dt;
    r.z += vz * dt;
  }
  // Nunca se queda dentro de otro
  for (const c of avoid) {
    if (c === self) continue;
    const ex = r.x - c.x;
    const ez = r.z - c.z;
    const rr = c.r + radius;
    const e2 = ex * ex + ez * ez;
    if (e2 < 1e-6 || e2 >= rr * rr) continue;
    const e = Math.sqrt(e2);
    r.x = c.x + (ex / e) * rr;
    r.z = c.z + (ez / e) * rr;
  }
  st.vx = vx;
  st.vz = vz;
  const sp = Math.hypot(vx, vz);
  // El cuerpo mira hacia donde va, girando como mucho ~6 rad/s
  if (sp > 0.15) {
    const diff = wrap(Math.atan2(vx, vz) - root.rotation.y);
    root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 6, Math.abs(diff) * Math.min(1, dt * 10));
  }
  return Math.hypot(tx - r.x, tz - r.z);
}

/** Gira con suavidad hacia un ángulo (para cuando ya ha llegado). */
export function faceTo(root: THREE.Object3D, ang: number, dt: number, rate = 6) {
  root.rotation.y += wrap(ang - root.rotation.y) * Math.min(1, dt * rate);
}

/** Velocidad actual de un SteerState. */
export const steerSpeed = (st: SteerState) => Math.hypot(st.vx ?? 0, st.vz ?? 0);
