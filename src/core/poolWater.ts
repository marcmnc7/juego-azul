import * as THREE from 'three';
import { makeSea } from './gfx';

// El agua de la piscina: la misma del mar del kayak (reflejos, oleaje fino, sol o luna) pero en un
// vaso pequeño y con olas de verdad: una malla con la ecuación de ondas, donde cada brazada, patada,
// salto o pelota empuja el agua, las ondas se abren, rebotan en las paredes y se apagan.

const NX = 72;
const NZ = 42;
const C2 = 2.3 * 2.3; // velocidad de las ondas (m/s)²
const DAMP = 0.992;
const H = 1 / 60;
/** Lo más que sube o baja una ola (m): el agua está 22 cm por debajo del borde. */
const MAX_WAVE = 0.14;

export class PoolWater {
  readonly mesh: THREE.Mesh;
  private h = new Float32Array(NX * NZ);
  private v = new Float32Array(NX * NZ);
  private dx: number;
  private dz: number;
  private pos: THREE.BufferAttribute;
  private nor: THREE.BufferAttribute;
  private acc = 0;

  constructor(
    private box: { minX: number; maxX: number; minZ: number; maxZ: number },
    y: number,
    color: number,
    moon: THREE.Vector3,
  ) {
    const w = box.maxX - box.minX;
    const d = box.maxZ - box.minZ;
    const geo = new THREE.PlaneGeometry(w, d, NX - 1, NZ - 1);
    this.dx = w / (NX - 1);
    this.dz = d / (NZ - 1);
    this.mesh = makeSea([w, d], color, moon, { night: true, emissive: 0x124a66, alpha: 0.66, geometry: geo, ripples: true });
    this.mesh.position.set((box.minX + box.maxX) / 2, y, (box.minZ + box.maxZ) / 2);
    this.pos = geo.attributes.position as THREE.BufferAttribute;
    this.nor = geo.attributes.normal as THREE.BufferAttribute;
    this.pos.setUsage(THREE.DynamicDrawUsage);
    this.nor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
  }

  private at(x: number, z: number) {
    return [(x - this.box.minX) / this.dx, (z - this.box.minZ) / this.dz] as const;
  }

  /** Empuja el agua en (x, z). amp < 0 la hunde (una mano que entra); radio en metros. */
  disturb(x: number, z: number, amp: number, radius = 0.28) {
    const [fi, fj] = this.at(x, z);
    const ri = Math.ceil(radius / this.dx) + 1;
    const rj = Math.ceil(radius / this.dz) + 1;
    const i0 = Math.max(1, Math.floor(fi) - ri), i1 = Math.min(NX - 2, Math.ceil(fi) + ri);
    const j0 = Math.max(1, Math.floor(fj) - rj), j1 = Math.min(NZ - 2, Math.ceil(fj) + rj);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const ddx = (i - fi) * this.dx, ddz = (j - fj) * this.dz;
        const g = Math.exp(-(ddx * ddx + ddz * ddz) / (radius * radius));
        this.v[j * NX + i] += amp * g;
      }
  }

  /** Altura del agua en (x, z), para que flote lo que flota. */
  height(x: number, z: number) {
    const [fi, fj] = this.at(x, z);
    const i = Math.max(0, Math.min(NX - 1, Math.round(fi)));
    const j = Math.max(0, Math.min(NZ - 1, Math.round(fj)));
    return this.h[j * NX + i];
  }

  update(dt: number) {
    this.acc = Math.min(this.acc + dt, H * 3);
    const { h, v } = this;
    const kx = C2 / (this.dx * this.dx);
    const kz = C2 / (this.dz * this.dz);
    let steps = 0;
    while (this.acc >= H) {
      this.acc -= H;
      steps++;
      for (let j = 0; j < NZ; j++) {
        const jm = j > 0 ? j - 1 : j + 1; // paredes: la onda rebota
        const jp = j < NZ - 1 ? j + 1 : j - 1;
        for (let i = 0; i < NX; i++) {
          const k = j * NX + i;
          const l = i > 0 ? k - 1 : k + 1;
          const r = i < NX - 1 ? k + 1 : k - 1;
          const lap = (h[l] + h[r] - 2 * h[k]) * kx + (h[jm * NX + i] + h[jp * NX + i] - 2 * h[k]) * kz;
          v[k] = (v[k] + lap * H) * DAMP;
        }
      }
      // El agua no se crea ni se pierde: cada brazada, patada o chapuzón empuja hacia arriba o hacia abajo, y sin
      // esto el nivel medio se iba desplazando hasta salirse del vaso (o vaciarlo). Se quita lo que se ha movido
      // de media, y las olas, con tope (más que un palmo, por encima del borde)
      let mh = 0, mv = 0;
      for (let k = 0; k < h.length; k++) {
        h[k] += v[k] * H;
        mh += h[k];
        mv += v[k];
      }
      mh /= h.length;
      mv /= v.length;
      for (let k = 0; k < h.length; k++) {
        h[k] = Math.max(-MAX_WAVE, Math.min(MAX_WAVE, h[k] - mh));
        v[k] -= mv;
      }
    }
    if (!steps) return;
    // Plano: x local = x del mundo; y local = -z del mundo; z local = altura
    const P = this.pos, N = this.nor;
    for (let j = 0; j < NZ; j++) {
      const jm = j > 0 ? j - 1 : j;
      const jp = j < NZ - 1 ? j + 1 : j;
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        P.setZ(k, h[k]);
        const sx = (h[j * NX + Math.min(NX - 1, i + 1)] - h[j * NX + Math.max(0, i - 1)]) / (2 * this.dx);
        const sz = (h[jp * NX + i] - h[jm * NX + i]) / (2 * this.dz);
        N.setXYZ(k, -sx, sz, 1);
      }
    }
    P.needsUpdate = true;
    N.needsUpdate = true;
  }
}
