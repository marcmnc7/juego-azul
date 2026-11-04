import * as THREE from 'three';
import type { Box2 } from '../world/ferreries';

// Lo que ve la cámara: los colisionadores de los niveles son cajas en 2D y no saben de balcones,
// toldos, copas de árbol o arcos. Esto guarda los triángulos fijos del escenario en una rejilla para
// lanzar rayos contra ellos, de modo que la cámara no se meta nunca dentro de nada ni quede tapada.
// Solo cuenta lo grande: postes, barandillas y hojitas no la hacen dar saltos.

const CELL = 2;
const key = (x: number, y: number, z: number) => ((x + 1024) * 2048 + (z + 1024)) * 64 + (y + 16);

class CamWorld {
  private scene: THREE.Object3D | null = null;
  private built = false;
  private P = new Float32Array(0);
  private grid = new Map<number, number[]>();
  private stamp = new Uint32Array(0);
  private tick = 0;

  attach(sc: THREE.Object3D) {
    if (sc !== this.scene) {
      this.scene = sc;
      this.built = false;
      this.grid.clear();
    }
  }

  /** Para las pruebas. */
  get triangles() {
    return this.P.length / 9;
  }
  buildMs = 0;

  private build(walls: readonly Box2[]) {
    this.built = true;
    this.grid.clear();
    const sc = this.scene;
    if (!sc) return;
    // Solo cerca de donde se puede andar (los alrededores lejanos no le pueden estorbar)
    const AREA = 8;
    const zone = new Set<number>();
    for (const b of walls)
      for (let x = Math.floor(b.minX / AREA) - 2; x <= Math.floor(b.maxX / AREA) + 2; x++)
        for (let z = Math.floor(b.minZ / AREA) - 2; z <= Math.floor(b.maxZ / AREA) + 2; z++) zone.add(x * 4096 + z);
    const out: number[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), bc = new THREE.Vector3();
    const mi = new THREE.Matrix4(), mw = new THREE.Matrix4();
    const visit = (o: THREE.Object3D) => {
      if (!o.visible || o.userData.noCam) return;
      const m = o as THREE.Mesh;
      if (m.isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh && m.geometry?.attributes?.position) {
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
        if (mat && !mat.transparent && mat.depthWrite !== false && mat.blending === THREE.NormalBlending && (mat as THREE.MeshBasicMaterial).side !== THREE.BackSide) {
          const g = m.geometry;
          if (!g.boundingSphere) g.computeBoundingSphere();
          const pos = g.attributes.position as THREE.BufferAttribute, idx = g.index, cnt = idx ? idx.count : pos.count;
          const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh) : null;
          // Decorado fundido: el Merger ya dice qué piezas son finas
          const parts = !!g.userData.parts && !idx;
          let skip: Uint8Array | null = null;
          if (parts) {
            skip = new Uint8Array(Math.ceil(cnt / 3));
            const thin = g.userData.thin as number[];
            for (let t = 0; t < thin.length; t += 2) skip.fill(1, thin[t] / 3, (thin[t] + thin[t + 1]) / 3);
          }
          // (nada de gentíos ni flotas instanciadas: se mueven o son pequeños)
          if (g.boundingSphere!.radius < 300 && !(inst && cnt > 3000)) {
            m.updateWorldMatrix(true, false);
            for (let k = 0; k < (inst ? inst.count : 1); k++) {
              if (inst) {
                inst.getMatrixAt(k, mi);
                mw.multiplyMatrices(o.matrixWorld, mi);
              } else mw.copy(o.matrixWorld);
              for (let i = 0; i < cnt; i += 3) {
                if (skip && skip[i / 3]) continue;
                const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
                a.fromBufferAttribute(pos, ia).applyMatrix4(mw);
                b.fromBufferAttribute(pos, ib).applyMatrix4(mw);
                c.fromBufferAttribute(pos, ic).applyMatrix4(mw);
                // El suelo no cuenta; lo muy alto, tampoco
                const top = Math.max(a.y, b.y, c.y);
                if (top < 0.7 || Math.min(a.y, b.y, c.y) > 14) continue;
                if (zone.size && !zone.has(Math.floor((a.x + b.x + c.x) / 3 / AREA) * 4096 + Math.floor((a.z + b.z + c.z) / 3 / AREA))) continue;
                // Solo lo grande: ni postes ni barandillas (triángulos largos y finos) ni matitas
                ab.subVectors(b, a);
                ac.subVectors(c, a);
                bc.subVectors(c, b);
                const area2 = ab.clone().cross(ac).length();
                const long = Math.max(ab.length(), ac.length(), bc.length());
                if (!parts && (long < 0.45 || area2 / long < 0.16)) continue;
                out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
              }
            }
          }
        }
      }
      for (const k of o.children) visit(k);
    };
    visit(sc);
    this.P = new Float32Array(out);
    const n = out.length / 9;
    this.stamp = new Uint32Array(n);
    const P = this.P;
    for (let id = 0; id < n; id++) {
      const q = id * 9;
      const x0 = Math.floor(Math.min(P[q], P[q + 3], P[q + 6]) / CELL), x1 = Math.floor(Math.max(P[q], P[q + 3], P[q + 6]) / CELL);
      const y0 = Math.floor(Math.min(P[q + 1], P[q + 4], P[q + 7]) / CELL), y1 = Math.floor(Math.max(P[q + 1], P[q + 4], P[q + 7]) / CELL);
      const z0 = Math.floor(Math.min(P[q + 2], P[q + 5], P[q + 8]) / CELL), z1 = Math.floor(Math.max(P[q + 2], P[q + 5], P[q + 8]) / CELL);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 5000) continue;
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const k = key(x, y, z);
            const l = this.grid.get(k);
            if (l) l.push(id);
            else this.grid.set(k, [id]);
          }
    }
  }

  /** Distancia hasta el primer triángulo en la dirección unitaria (dx, dy, dz); max si no hay nada. */
  cast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number, walls: readonly Box2[]) {
    if (!this.built) {
      const t0 = performance.now();
      this.build(walls);
      this.buildMs = performance.now() - t0;
    }
    if (!this.P.length) return max;
    const P = this.P;
    const tick = ++this.tick;
    const stamp = this.stamp;
    let best = max;
    let cx = NaN, cy = NaN, cz = NaN;
    for (let s = 0; s <= best; s += CELL * 0.45) {
      const X = Math.floor((ox + dx * s) / CELL), Y = Math.floor((oy + dy * s) / CELL), Z = Math.floor((oz + dz * s) / CELL);
      if (X === cx && Y === cy && Z === cz) continue;
      cx = X;
      cy = Y;
      cz = Z;
      const l = this.grid.get(key(X, Y, Z));
      if (!l) continue;
      for (let i = 0; i < l.length; i++) {
        const id = l[i];
        if (stamp[id] === tick) continue;
        stamp[id] = tick;
        const q = id * 9;
        // Möller-Trumbore, por las dos caras
        const ax = P[q], ay = P[q + 1], az = P[q + 2];
        const e1x = P[q + 3] - ax, e1y = P[q + 4] - ay, e1z = P[q + 5] - az;
        const e2x = P[q + 6] - ax, e2y = P[q + 7] - ay, e2z = P[q + 8] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-7 && det < 1e-7) continue;
        const inv = 1 / det;
        const tx = ox - ax, ty = oy - ay, tz = oz - az;
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 0.02 && t < best) best = t;
      }
    }
    return best;
  }
}

export const camWorld = new CamWorld();
