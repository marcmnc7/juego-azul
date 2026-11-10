import * as THREE from 'three';
import { Builder, ARCH_DOOR, BARRED_WIN } from './builder';
import { makeHdMaterials, shutterMat, type HdMats } from './materials';

// Las manzanas de Ciutadella con la misma calidad que Ferreries: estuco fotográfico con relieve del color
// de cada casa, cornisa y zócalo de marès, puertas y rejas del atlas, persianas de lamas y balcones de
// hierro. El Born y Sant Joan lo usan en lugar de las cajas de color.

const tints = new Map<number, THREE.Material>();
const stones = new Map<number, THREE.Material>();
const IN = 0.03;

export interface WallOpts {
  /**
   * Sillería de marès en vez de encalado (D6a): la Catedral, el campanario, el Ajuntament, las casas de piedra.
   * El color tiñe los sillares dibujados. Por defecto, encalado como siempre.
   */
  stone?: boolean;
}

export class TownHD {
  b = new Builder();
  M: HdMats = makeHdMaterials();
  private n = 0;

  private tint(color: number) {
    let m = tints.get(color);
    if (!m) {
      m = this.M.whites[0].clone();
      (m as THREE.MeshStandardMaterial).color.set(color);
      tints.set(color, m);
    }
    return m;
  }

  /** Los sillares de marès teñidos del color de la piedra de cada edificio. */
  private stoneTint(color: number) {
    let m = stones.get(color);
    if (!m) {
      m = this.M.mares.clone();
      (m as THREE.MeshStandardMaterial).color.set(color);
      stones.set(color, m);
    }
    return m;
  }

  /** La manzana entera, con su cornisa. Cada una unos milímetros distinta: dos en el mismo plano parpadean. */
  wall(x0: number, x1: number, z0: number, z1: number, h: number, color: number, o: WallOpts = {}) {
    const e = (this.n++ % 6) * 0.012 + 0.006;
    const w = Math.max(0.02, x1 - x0 - e), d = Math.max(0.02, z1 - z0 - e);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // (los sillares, a la escala del cap. 1: 1,5 m por repetición, piezas de ~0,14 m)
    if (o.stone) this.b.box(this.stoneTint(color), [cx, h / 2, cz], [w, h, d], { tile: 1.5 });
    else this.b.box(this.tint(color), [cx, h / 2, cz], [w, h, d], { tile: 3 });
    this.b.box(this.M.mares, [cx, h + 0.12 + e / 2, cz], [w + 0.22, 0.24, d + 0.22], { tile: 2 });
  }

  /**
   * Fachada con la cara hacia `face`: along x a la altura z = at, o along z a la altura x = at.
   * groundFloor false: sin planta baja (detrás de los soportales de Ses Voltes).
   */
  facade(a0: number, a1: number, at: number, face: 1 | -1, floors: number, alongX = true, groundFloor = true) {
    const { b, M } = this;
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const len = hi - lo;
    const n = Math.max(1, Math.floor(len / 3));
    const ry = alongX ? (face > 0 ? 0 : Math.PI) : face > 0 ? Math.PI / 2 : -Math.PI / 2;
    const Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    const at0 = (a: number) => new THREE.Matrix4().compose(alongX ? new THREE.Vector3(a, 0, at) : new THREE.Vector3(at, 0, a), Q, new THREE.Vector3(1, 1, 1));
    const sh = shutterMat(M, 0x2f6b46);
    if (groundFloor) b.box(M.maresDark, [0, 0.38, IN], [len, 0.76, 0.1], { parent: at0((lo + hi) / 2), tile: 2 });
    for (let f = groundFloor ? 0 : 1; f < floors; f++)
      for (let i = 0; i < n; i++) {
        const P = at0(lo + (i + 0.5) * (len / n));
        const y = 1.6 + f * 3;
        if (f === 0 && i % 3 === 1) {
          b.box(M.mares, [0, 1.3, IN], [1.6, 2.7, 0.08], { parent: P, tile: 1.5 });
          b.decal(M.doors, [0, 1.2, IN + 0.05], 1.25, 2.35, ARCH_DOOR, P);
        } else if (f === 0) {
          b.box(M.mares, [0, y, IN], [1.45, 1.75, 0.08], { parent: P, tile: 1.5 });
          b.decal(M.doors, [0, y, IN + 0.05], 1.2, 1.45, BARRED_WIN, P);
          b.box(M.mares, [0, y - 0.85, IN + 0.09], [1.55, 0.1, 0.26], { parent: P, tile: 1.5 });
        } else {
          b.box(M.mares, [0, y, IN], [1.45, 1.8, 0.08], { parent: P, tile: 1.5 });
          b.decal(sh, [0, y, IN + 0.05], 1.18, 1.5, null, P);
          if (f === 1 && i % 2 === 0) {
            b.box(M.mares, [0, y - 0.85, IN + 0.39], [1.9, 0.14, 0.84], { parent: P, tile: 1.5 });
            for (let k = 0; k < 9; k++) b.box(M.iron, [-0.85 + k * 0.2125, y - 0.4, IN + 0.77], [0.03, 0.8, 0.03], { parent: P });
            b.box(M.iron, [0, y - 0.02, IN + 0.77], [1.85, 0.05, 0.05], { parent: P });
            for (const sx of [-1, 1]) b.box(M.iron, [sx * 0.92, y - 0.02, IN + 0.39], [0.05, 0.05, 0.78], { parent: P });
          } else b.box(M.mares, [0, y - 0.88, IN + 0.09], [1.55, 0.1, 0.28], { parent: P, tile: 1.5 });
        }
      }
  }

  finish(group: THREE.Object3D) {
    this.b.finish(group);
  }
}
