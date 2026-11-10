import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Constructor de decorado de la prueba de concepto: cajas con UV en metros (la textura no se
// estira), recortes del atlas de puertas y ventanas, y toda la geometría fusionada por material
// para dibujar con pocas llamadas.

export type V3 = [number, number, number];

/**
 * Trozos en que se parte una cara en el estilo cómic (uno cada ~0,6 m), para que se doble suave a mano alzada.
 * Con trozos grandes, los quiebros entre ellos se entintaban como rayas en las paredes.
 */
const segs = (v: number) => Math.min(20, Math.max(1, Math.round(v / 0.6)));

export class Builder {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private m4 = new THREE.Matrix4();
  private seed = 3;
  private rnd = () => ((this.seed = (this.seed * 16807) % 2147483647) / 2147483647);

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    if (m) geo.applyMatrix4(m);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    let arr = this.parts.get(mat);
    if (!arr) this.parts.set(mat, (arr = []));
    arr.push(geo);
  }

  /** Caja con UV en metros; tile = metros que ocupa una repetición de la textura. */
  box(mat: THREE.Material, c: V3, s0: V3, o: { ry?: number; rx?: number; rz?: number; tile?: number; parent?: THREE.Matrix4 } = {}) {
    // Cómic: lo fino (marcos, alféizares, barrotes, cornisas) más grueso, como lo dibujaría un dibujante; y las
    // caras grandes partidas en trozos para que la pared pueda combarse (ver handDrawn en core/comic)
    // (solo lo fino en dos dimensiones, como un barrote o un marco: las placas finas llevan persianas y puertas
    // pegadas delante, y al engordarlas las tapaban)
    const thin = s0.filter((v) => v < 0.2).length >= 2;
    const s: V3 = thin ? (s0.map((v) => (v < 0.2 ? Math.max(v * 1.5, v + 0.03) : v)) as V3) : s0;
    const seg = s.map((v) => segs(v));
    const g = new THREE.BoxGeometry(s[0], s[1], s[2], seg[0], seg[1], seg[2]);
    const tile = o.tile ?? 2.5;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const dims: [number, number][] = [[s[2], s[1]], [s[2], s[1]], [s[0], s[2]], [s[0], s[2]], [s[0], s[1]], [s[0], s[1]]];
    // vértices de cada cara (en el orden de BoxGeometry: +x, -x, +y, -y, +z, -z)
    const fseg: [number, number][] = [[seg[2], seg[1]], [seg[2], seg[1]], [seg[0], seg[2]], [seg[0], seg[2]], [seg[0], seg[1]], [seg[0], seg[1]]];
    const off = this.rnd() * 8;
    let i = 0;
    for (let f = 0; f < 6; f++)
      for (let k = 0; k < (fseg[f][0] + 1) * (fseg[f][1] + 1); k++, i++) uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile + off, (uv.getY(i) * dims[f][1]) / tile);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)), new THREE.Vector3(1, 1, 1));
    if (o.parent) m.premultiply(o.parent);
    this.add(g, mat, m);
  }

  /** Cilindro con UV en metros. */
  cyl(mat: THREE.Material, c: V3, rTop0: number, rBot0: number, h: number, o: { seg?: number; tile?: number; parent?: THREE.Matrix4; rx?: number } = {}) {
    // (cómic: barrotes y postes finos, más gruesos)
    const fat = (r: number) => (r < 0.06 ? r * 1.6 : r);
    const rTop = fat(rTop0), rBot = fat(rBot0);
    const g = new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? 12, segs(h));
    const tile = o.tile ?? 1;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const circ = Math.PI * 2 * Math.max(rTop, rBot);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx ?? 0, 0, 0)), new THREE.Vector3(1, 1, 1));
    if (o.parent) m.premultiply(o.parent);
    this.add(g, mat, m);
  }

  /** Plano con un recorte del atlas (u0,v0,u1,v1 en 0..1), o la textura entera. */
  decal(mat: THREE.Material, c: V3, w: number, h: number, rect: [number, number, number, number] | null, parent: THREE.Matrix4) {
    // (en el cómic, partido como las paredes: si no, al doblarse la pared tapaba media puerta)
    const g = new THREE.PlaneGeometry(w, h, segs(w), segs(h));
    if (rect) {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1]));
    }
    this.add(g, mat, this.m4.makeTranslation(...c).premultiply(parent));
  }

  /** Triángulo vertical (piñón del tejado) en el plano local x = 0, mirando a +x. */
  gable(mat: THREE.Material, base: number, h: number, parent: THREE.Matrix4, tile = 3) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, base / 2, 0, 0, -base / 2, 0, h, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, base / tile, 0, base / 2 / tile, h / tile], 2));
    this.add(g, mat, parent.clone());
  }

  finish(group: THREE.Object3D) {
    for (const [mat, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    this.parts.clear();
  }
}

// Recortes del atlas de puertas (píxeles de una imagen de 1024, origen arriba a la izquierda)
const px = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => [x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024];
export const ARCH_DOOR = px(4, 62, 505, 1000);
export const BARRED_WIN = px(507, 600, 870, 1012);
