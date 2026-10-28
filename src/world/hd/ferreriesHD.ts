import * as THREE from 'three';
import { G, Merger } from '../../entities/models';
import { Builder, ARCH_DOOR, BARRED_WIN } from './builder';
import { makeHdMaterials, shutterMat, type HdMats } from './materials';

// Ferreries con la calidad de la prueba de concepto: las mismas casas, en el mismo sitio y con las
// mismas colisiones, pero construidas como la Plaça des Born de la prueba: estuco, marès, teja y
// losas fotográficas con relieve, puertas y rejas del atlas de Sponza, persianas de lamas y
// balcones de hierro.

const FLOWERS = [0xe0245e, 0xff5a7a, 0xd7263d, 0xf28f3b];

export interface HdHouseOut {
  lamps: { p: THREE.Vector3 }[];
  hangs: { x: number; y: number; z: number; facing: 1 | -1 }[];
}

export class FerreriesHD {
  b = new Builder();
  M: HdMats = makeHdMaterials();

  /**
   * Casa menorquina con la fachada hacia +z local. ry gira la casa (0: fachada a +z del mundo).
   * w a lo ancho de la fachada, d de fondo.
   */
  house(m: Merger, cx: number, cz: number, w: number, d: number, floors: number, ry: number, shutter: number, r: () => number, out: HdHouseOut, opts: { roof?: boolean; balconies?: boolean } = {}) {
    const { b, M } = this;
    const P = new THREE.Matrix4().compose(new THREE.Vector3(cx, 0, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    const world = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(P);
    const facing: 1 | -1 = Math.cos(ry) >= 0 ? 1 : -1;
    const h = floors * 3 + 0.4;
    const fz = d / 2;
    const wall = M.whites[Math.floor(r() * M.whites.length)];
    const sh = shutterMat(M, shutter);
    b.box(wall, [0, h / 2, 0], [w, h, d], { parent: P, tile: 3 });
    // Zócalo, esquinas de marès y alero
    b.box(M.maresDark, [0, 0.35, fz + 0.04], [w, 0.7, 0.1], { parent: P, tile: 2 });
    for (const sx of [-1, 1]) b.box(M.mares, [sx * (w / 2 - 0.2), h / 2, fz - 0.12], [0.42, h, 0.34], { parent: P, tile: 1.5 });
    b.box(M.mares, [0, h - 0.12, fz + 0.12], [w + 0.1, 0.26, 0.3], { parent: P, tile: 2 });
    // Tejado a dos aguas de teja árabe, con los piñones encalados
    if (opts.roof !== false) {
      const rise = 1.5;
      const half = d / 2 + 0.25;
      const slope = Math.atan2(rise, half);
      const len = Math.hypot(rise, half) + 0.1;
      for (const s of [1, -1]) b.box(M.roof, [0, h + rise / 2, (s * half) / 2], [w + 0.3, 0.12, len], { parent: P, rx: -s * slope, tile: 2 });
      for (const sx of [-1, 1]) {
        const GP = P.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3((sx * w) / 2, h, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sx > 0 ? 0 : Math.PI), new THREE.Vector3(1, 1, 1)));
        b.gable(wall, d, rise, GP);
      }
    }
    const cols = Math.max(1, Math.floor(w / 2.4));
    const balconyFloor = opts.balconies !== false && floors > 1 && r() < 0.7 ? 1 : -1;
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < cols; i++) {
        const x = -w / 2 + (w / cols) * (i + 0.5);
        const y = f * 3 + 1.6;
        if (f === 0 && i === Math.floor(cols / 2)) {
          // Puerta de madera con marco de marès, escalón y farol de hierro al lado
          b.box(M.mares, [x, 1.3, fz + 0.03], [1.6, 2.7, 0.08], { parent: P, tile: 1.5 });
          b.decal(M.doors, [x, 1.2, fz + 0.08], 1.25, 2.35, ARCH_DOOR, P);
          b.box(M.mares, [x, 0.06, fz + 0.3], [1.7, 0.12, 0.5], { parent: P, tile: 1.5 });
          if (r() < 0.6) {
            b.box(M.iron, [x + 1.0, 2.6, fz + 0.15], [0.05, 0.05, 0.3], { parent: P });
            b.box(M.iron, [x + 1.0, 2.68, fz + 0.3], [0.3, 0.06, 0.3], { parent: P });
            b.cyl(M.lantern, [x + 1.0, 2.45, fz + 0.3], 0.13, 0.09, 0.3, { parent: P, seg: 6 });
            out.lamps.push({ p: world(x + 1.0, 2.45, fz + 0.3) });
          }
        } else if (f === 0) {
          // Ventana baja con reja
          b.box(M.mares, [x, y, fz + 0.03], [1.45, 1.75, 0.08], { parent: P, tile: 1.5 });
          b.decal(M.doors, [x, y, fz + 0.08], 1.2, 1.45, BARRED_WIN, P);
          b.box(M.mares, [x, y - 0.85, fz + 0.12], [1.55, 0.1, 0.26], { parent: P, tile: 1.5 });
        } else {
          // Marco de piedra y persiana de lamas
          b.box(M.mares, [x, y, fz + 0.03], [1.45, 1.8, 0.08], { parent: P, tile: 1.5 });
          b.decal(sh, [x, y, fz + 0.08], 1.18, 1.5, null, P);
          if (f === balconyFloor) {
            b.box(M.mares, [x, y - 0.85, fz + 0.42], [1.9, 0.14, 0.84], { parent: P, tile: 1.5 });
            for (let k = 0; k < 9; k++) b.box(M.iron, [x - 0.85 + k * 0.2125, y - 0.4, fz + 0.8], [0.03, 0.8, 0.03], { parent: P });
            b.box(M.iron, [x, y - 0.02, fz + 0.8], [1.85, 0.05, 0.05], { parent: P });
            for (const sx of [-1, 1]) b.box(M.iron, [x + sx * 0.92, y - 0.02, fz + 0.42], [0.05, 0.05, 0.78], { parent: P });
            const hp = world(x, y - 0.2, fz + 0.82);
            out.hangs.push({ x: hp.x, y: hp.y, z: hp.z, facing });
            for (let k = -1; k <= 1; k++) {
              const pp = world(x + k * 0.55, 0, fz + 0.5);
              m.add(G.cyl, 0xb5603b, pp.x, y - 0.65, pp.z, 0, 0, 0, 0.28, 0.28, 0.28);
              m.add(G.sphere, 0x3e7a3a, pp.x, y - 0.4, pp.z, 0, 0, 0, 0.42, 0.3, 0.42);
              m.add(G.sphere, FLOWERS[Math.floor(r() * 4)], pp.x, y - 0.28, pp.z, 0, 0, 0, 0.3, 0.18, 0.3);
            }
          } else {
            b.box(M.mares, [x, y - 0.88, fz + 0.12], [1.55, 0.1, 0.28], { parent: P, tile: 1.5 });
            if (r() < 0.35) {
              const pp = world(x, 0, fz + 0.18);
              m.add(G.cyl, 0xb5603b, pp.x, y - 0.71, pp.z, 0, 0, 0, 0.3, 0.26, 0.3);
              m.add(G.sphere, FLOWERS[Math.floor(r() * 4)], pp.x, y - 0.48, pp.z, 0, 0, 0, 0.4, 0.28, 0.4);
            }
          }
        }
      }
    }
    // Chimenea encalada, bajante de zinc
    if (opts.roof !== false && r() < 0.55) {
      const chx = (r() - 0.5) * (w - 1.6);
      const chz = -d / 4;
      b.box(wall, [chx, h + 1.1, chz], [0.7, 2.2, 0.7], { parent: P, tile: 3 });
      b.box(M.mares, [chx, h + 2.25, chz], [0.85, 0.1, 0.85], { parent: P, tile: 1.5 });
      b.box(M.roof, [chx, h + 2.42, chz], [0.9, 0.25, 0.9], { parent: P, tile: 2 });
    }
    b.cyl(M.zinc, [w / 2 - 0.5, h / 2, fz + 0.1], 0.06, 0.06, h, { parent: P, seg: 8 });
    // Buganvilla y maceta grande junto a la puerta
    if (r() < 0.25) {
      const bx = (r() - 0.5) * (w - 2);
      for (let k = 0; k < 6; k++) {
        const pp = world(bx + (r() - 0.5) * 1.6, 0, fz + 0.2);
        m.add(G.sphere, k % 2 ? 0xd6338a : 0x3e7a3a, pp.x, 1 + r() * 2.5, pp.z, 0, ry, 0, 0.9, 0.7, 0.4);
      }
    }
    if (r() < 0.5) {
      const pp = world((r() < 0.5 ? -1 : 1) * (w / 2 - 0.8), 0, fz + 0.4);
      m.add(G.cyl, 0xb5603b, pp.x, 0.3, pp.z, 0, 0, 0, 0.6, 0.6, 0.6);
      m.add(G.sphere, 0x3e7a3a, pp.x, 0.9, pp.z, 0, 0, 0, 0.9, 0.9, 0.9);
    }
  }

  /** Barra de bar de verbena: madera, sobre de marès, botellas y vasos de cristal a tamaño real. */
  bar(x: number, z: number, facing: 1 | -1) {
    const { b, M } = this;
    b.box(M.wood, [x, 0.53, z], [4, 1.06, 0.8], { tile: 1.2 });
    b.box(M.mares, [x, 1.1, z], [4.2, 0.08, 1], { tile: 1.5 });
    const bz = z - facing * 0.25;
    for (let i = 0; i < 9; i++) {
      const g = M.glass[i % 3];
      const bx = x - 1.7 + i * 0.32;
      b.cyl(g, [bx, 1.14 + 0.11, bz], 0.04, 0.04, 0.22, { seg: 14 });
      b.cyl(g, [bx, 1.14 + 0.25, bz], 0.014, 0.04, 0.06, { seg: 10 });
      b.cyl(g, [bx, 1.14 + 0.32, bz], 0.014, 0.014, 0.09, { seg: 8 });
    }
    for (let i = 0; i < 6; i++) {
      const gx = x - 1.2 + i * 0.36;
      b.cyl(M.cup, [gx, 1.14 + 0.055, z + facing * 0.22], 0.038, 0.032, 0.11, { seg: 14 });
      b.cyl(M.lemonade, [gx, 1.14 + 0.04, z + facing * 0.22], 0.034, 0.03, 0.07, { seg: 14 });
    }
    // Garrafa de gin de Menorca, con su asa
    const gz = z + facing * 0.15;
    b.cyl(M.gin, [x + 1.6, 1.14 + 0.17, gz], 0.1, 0.11, 0.34, { seg: 18 });
    b.cyl(M.gin, [x + 1.6, 1.14 + 0.38, gz], 0.03, 0.1, 0.08, { seg: 14 });
    b.cyl(M.gin, [x + 1.6, 1.14 + 0.45, gz], 0.03, 0.03, 0.07, { seg: 10 });
    const handle = new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI);
    b.add(handle, M.gin, new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(x + 1.7, 1.14 + 0.26, gz));
    b.box(M.label, [x + 1.6, 1.14 + 0.18, gz + facing * 0.105], [0.11, 0.12, 0.004], { ry: facing < 0 ? Math.PI : 0 });
    // Barril
    b.cyl(M.wood, [x + 2.6, 0.5, z], 0.36, 0.4, 1, { seg: 16, tile: 0.8 });
  }

  /** Suelo de losas de piedra (calle y plaza). */
  ground(size: number) {
    this.b.box(this.M.slabs, [0, -0.5, 0], [size, 1, size], { tile: 3.2 });
  }

  /** Iglesia de Sant Bartomeu de marès: nave, frontón, pilastras, portal y campanario. */
  church(m: Merger) {
    const { b, M } = this;
    b.box(M.mares, [0, 5, 30], [14, 10, 8], { tile: 2.2 });
    // Frontón (piñón de marès) y tejado de teja
    const half = 7.2, rise = 3;
    const slope = Math.atan2(rise, half);
    const len = Math.hypot(rise, half) + 0.1;
    for (const s of [1, -1]) b.box(M.roof, [(s * half) / 2, 10 + rise / 2, 30], [len, 0.14, 8.4], { rz: -s * slope, tile: 2 });
    const FP = new THREE.Matrix4().compose(new THREE.Vector3(0, 10, 26), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1));
    b.gable(M.mares, 14.2, 3.2, FP, 2.2);
    const FB = new THREE.Matrix4().compose(new THREE.Vector3(0, 10, 34), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1));
    b.gable(M.mares, 14.2, 3.2, FB, 2.2);
    b.box(M.maresDark, [0, 10.05, 25.95], [14.4, 0.3, 0.4], { tile: 1.5 });
    for (const sx of [-7, 7]) b.box(M.maresDark, [sx, 5, 26.2], [0.8, 10, 0.6], { tile: 1.5 });
    for (const sx of [-3.6, 3.6]) b.box(M.maresDark, [sx, 5, 25.95], [0.5, 10, 0.2], { tile: 1.5 });
    b.box(M.maresDark, [0, 13.4, 26.0], [0.15, 1.2, 0.15]);
    b.box(M.maresDark, [0, 13.6, 26.0], [0.7, 0.15, 0.15]);
    // Portal con la puerta grande de madera y escalones
    b.box(M.maresDark, [0, 2.4, 25.95], [3.6, 4.8, 0.1], { tile: 1.5 });
    b.decal(M.doors, [0, 2.2, 0], 2.6, 4.4, ARCH_DOOR, new THREE.Matrix4().makeTranslation(0, 0, 25.88).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
    for (let k = 0; k < 3; k++) b.box(M.mares, [0, 0.1 + k * 0.2, 25.3 - k * 0.4], [6 - k, 0.2, 1.2], { tile: 1.5 });
    // Rosetón (vidriera) con su aro de piedra
    m.add(G.cyl, 0x8fb3d9, 0, 7.4, 25.9, Math.PI / 2, 0, 0, 2.2, 0.1, 2.2);
    b.cyl(M.maresDark, [0, 7.4, 25.93], 1.4, 1.4, 0.1, { rx: Math.PI / 2, seg: 32 });
    for (let k = 0; k < 8; k++) m.add(G.box, 0xd8c39a, 0, 7.4, 25.84, 0, 0, (k * Math.PI) / 8, 0.1, 2.2, 0.05);
    // Campanario
    const TX = 8.6, TZ = 27.4;
    b.box(M.mares, [TX, 8, TZ], [3.6, 16, 3.6], { tile: 2.2 });
    for (const y of [5.3, 10.6]) b.box(M.maresDark, [TX, y, TZ], [3.9, 0.3, 3.9], { tile: 1.5 });
    b.box(M.maresDark, [TX, 16.15, TZ], [4.1, 0.35, 4.1], { tile: 1.5 });
    b.box(M.mares, [TX, 18, TZ], [3.2, 3.4, 3.2], { tile: 2.2 });
    for (const [dx, dz, ry] of [[0, -1.61, 0], [0, 1.61, 0], [-1.61, 0, Math.PI / 2], [1.61, 0, Math.PI / 2]]) {
      m.add(G.box, 0x2a1d16, TX + dx, 17.8, TZ + dz, 0, ry, 0, 1.3, 2.2, 0.06);
      m.add(G.cyl, 0x2a1d16, TX + dx, 18.9, TZ + dz, Math.PI / 2, ry, 0, 1.3, 0.06, 1.3);
    }
    m.add(G.cone, 0xd9a83a, TX, 17.5, TZ - 1.0, 0, 0, 0, 0.9, 1.0, 0.9);
    b.box(M.maresDark, [TX, 19.85, TZ], [3.6, 0.3, 3.6], { tile: 1.5 });
    const cone = new THREE.ConeGeometry(1.8 * Math.SQRT2, 2.5, 4, 1);
    const cuv = cone.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 5, cuv.getY(i) * 1.6);
    b.add(cone, M.roof, new THREE.Matrix4().compose(new THREE.Vector3(TX, 21.25, TZ), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(1, 1, 1)));
    b.box(M.iron, [TX, 23.1, TZ], [0.08, 1.4, 0.08]);
    b.box(M.iron, [TX, 23.3, TZ], [0.7, 0.08, 0.08]);
    m.add(G.cyl, 0xfbf7ee, TX, 13.2, TZ - 1.82, Math.PI / 2, 0, 0, 1.8, 0.08, 1.8);
    m.add(G.cyl, 0x2a1d16, TX, 13.2, TZ - 1.88, Math.PI / 2, 0, 0, 0.2, 0.05, 0.2);
    m.add(G.box, 0x2a1d16, TX, 13.45, TZ - 1.9, 0, 0, 0, 0.06, 0.55, 0.03);
    m.add(G.box, 0x2a1d16, TX + 0.17, 13.2, TZ - 1.9, 0, 0, 0, 0.38, 0.06, 0.03);
  }

  finish(group: THREE.Object3D) {
    this.b.finish(group);
  }
}
