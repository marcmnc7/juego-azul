import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Mats, labelTexture, clockTexture } from './materials';

// La Plaça des Born de Ciutadella, simplificada pero a escala real (metros).
// Plaza: x ∈ [-22, 22], z ∈ [-15, 15]. Norte (-z): balaustrada sobre el puerto. Oeste: el Ajuntament
// con su torre almenada. Sur: Palau Torre-Saura, Es Casino y el Bar Imperi. Este: Ses Voltes.
// En el centro, el obelisco sobre sus escalones.
// Toda la geometría estática se fusiona por material (pocas llamadas de dibujo) y cada volumen
// sólido tiene su colisionador en Rapier.

export const PLAZA = { minX: -22, maxX: 22, minZ: -15, maxZ: 15 };
type V3 = [number, number, number];

/** Acumula geometría por material y crea los colisionadores. */
export class Builder {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private m4 = new THREE.Matrix4();
  constructor(public world: RAPIER.World) {}

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    if (m) geo.applyMatrix4(m);
    if (geo.index) geo = geo.toNonIndexed();
    let arr = this.parts.get(mat);
    if (!arr) this.parts.set(mat, (arr = []));
    arr.push(geo);
  }

  /** Caja con UV en metros (la textura no se estira) y, si se pide, su colisionador. */
  box(mat: THREE.Material, c: V3, s: V3, o: { ry?: number; rx?: number; tile?: number; collide?: boolean; parent?: THREE.Matrix4 } = {}) {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
    const tile = o.tile ?? 2.5;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const dims: [number, number][] = [[s[2], s[1]], [s[2], s[1]], [s[0], s[2]], [s[0], s[2]], [s[0], s[1]], [s[0], s[1]]];
    const off = Math.random() * 8;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile + off, uv.getY(i) * dims[f][1] / tile);
    }
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx ?? 0, o.ry ?? 0, 0)), new THREE.Vector3(1, 1, 1));
    if (o.parent) m.premultiply(o.parent);
    this.add(g, mat, m);
    if (o.collide !== false) this.colliderFromMatrix(m, s);
  }

  colliderFromMatrix(m: THREE.Matrix4, s: V3) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(p, q, sc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(s[0] / 2, s[1] / 2, s[2] / 2).setTranslation(p.x, p.y, p.z).setRotation(q).setFriction(0.8));
  }

  /** Muro invisible (límites del mundo). */
  wall(c: V3, s: V3) {
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(s[0] / 2, s[1] / 2, s[2] / 2).setTranslation(...c));
  }

  /** Plano con un recorte del atlas de puertas/ventanas (u0,v0,u1,v1 en 0..1). */
  decal(mat: THREE.Material, c: V3, w: number, h: number, rect: [number, number, number, number] | null, parent: THREE.Matrix4) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rect) {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < 4; i++) uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1]));
    }
    this.add(g, mat, this.m4.makeTranslation(...c).premultiply(parent));
  }

  finish(scene: THREE.Scene) {
    for (const [mat, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      mesh.castShadow = mat !== (mat as any).__noShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    this.parts.clear();
  }
}

// Recortes del atlas de puertas (píxeles de una imagen de 1024, origen arriba a la izquierda)
const px = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => [x0 / 1024, 1 - y1 / 1024, x1 / 1024, 1 - y0 / 1024];
const ARCH_DOOR = px(4, 62, 505, 1000);
const PALACE_WIN = px(510, 6, 928, 588);
const BARRED_WIN = px(507, 600, 870, 1012);

interface BuildingOpts {
  cx: number; cz: number; by?: number; w: number; d: number; h: number; ry: number;
  wall: THREE.Material; floors: number; win: number;
  door?: 'arch' | 'shop'; balcony?: boolean; roof?: 'flat' | 'tiles' | 'battlements';
  palace?: boolean; skipWin?: number[];
}

function building(b: Builder, M: Mats, o: BuildingOpts) {
  const P = new THREE.Matrix4().compose(new THREE.Vector3(o.cx, o.by ?? 0, o.cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry), new THREE.Vector3(1, 1, 1));
  const fz = o.d / 2;
  b.box(o.wall, [0, o.h / 2, 0], [o.w, o.h, o.d], { parent: P, tile: 3 });
  // Zócalo y cornisa de marès
  b.box(M.maresDark, [0, 0.45, fz + 0.06], [o.w, 0.9, 0.14], { parent: P, collide: false, tile: 2 });
  b.box(M.mares, [0, o.h - 0.25, fz + 0.2], [o.w + 0.2, 0.42, 0.42], { parent: P, collide: false, tile: 2 });
  const fh = (o.h - 1) / o.floors;
  for (let i = 1; i < o.floors; i++) b.box(M.mares, [0, i * fh + 0.1, fz + 0.08], [o.w, 0.2, 0.16], { parent: P, collide: false, tile: 2 });
  // Ventanas
  const step = o.w / o.win;
  for (let k = 0; k < o.win; k++) {
    const x = -o.w / 2 + step * (k + 0.5);
    for (let f = 0; f < o.floors; f++) {
      const y0 = f * fh;
      if (f === 0) {
        if (o.skipWin?.includes(k)) continue;
        if (o.door === 'arch' && k === Math.floor(o.win / 2)) b.decal(M.doors, [x, 2.5, fz + 0.03], 2.7, 5.0, ARCH_DOOR, P);
        else if (o.door === 'shop' && k % 2 === 0) b.decal(M.doors, [x, 1.55, fz + 0.03], 1.7, 3.1, ARCH_DOOR, P);
        else b.decal(M.doors, [x, 1.9, fz + 0.03], 1.5, 1.7, BARRED_WIN, P);
        continue;
      }
      const wh = Math.min(2.3, fh * 0.62);
      const yc = y0 + fh * 0.48;
      if (o.palace) b.decal(M.doors, [x, yc, fz + 0.03], wh * 0.72, wh, PALACE_WIN, P);
      else {
        // Marco de piedra y persiana verde
        b.box(M.mares, [x, yc, fz + 0.04], [1.5, wh + 0.3, 0.08], { parent: P, collide: false, tile: 1.5 });
        b.decal(M.shutter, [x, yc, fz + 0.09], 1.2, wh, null, P);
      }
      if (o.balcony && f === 1) {
        b.box(M.mares, [x, y0 + 0.2, fz + 0.45], [1.9, 0.14, 0.8], { parent: P, collide: false, tile: 1.5 });
        for (let r = 0; r < 9; r++) b.box(M.iron, [x - 0.85 + r * 0.2125, y0 + 0.75, fz + 0.82], [0.03, 1.0, 0.03], { parent: P, collide: false });
        b.box(M.iron, [x, y0 + 1.25, fz + 0.82], [1.85, 0.05, 0.05], { parent: P, collide: false });
        for (const sx of [-1, 1]) b.box(M.iron, [x + sx * 0.92, y0 + 1.25, fz + 0.45], [0.05, 0.05, 0.75], { parent: P, collide: false });
      }
    }
  }
  // Tejado
  if (o.roof === 'tiles') {
    const slope = 0.42;
    const len = (o.d * 0.6) / Math.cos(slope);
    b.box(M.roof, [0, o.h + Math.sin(slope) * len / 2 - 0.1, fz - Math.cos(slope) * len / 2 + 0.35], [o.w + 0.3, 0.12, len], { parent: P, rx: -slope, collide: false, tile: 2 });
  } else if (o.roof === 'battlements') {
    const n = Math.floor(o.w / 1.6);
    for (let i = 0; i < n; i++) b.box(M.mares, [-o.w / 2 + (i + 0.5) * (o.w / n), o.h + 0.5, fz - 0.25], [0.8, 1.0, 0.5], { parent: P, collide: false, tile: 1.5 });
  } else {
    b.box(o.wall, [0, o.h + 0.45, fz - 0.15], [o.w, 0.9, 0.3], { parent: P, collide: false, tile: 3 });
  }
  return P;
}

export interface WorldInfo { lamps: THREE.Vector3[]; water: THREE.Mesh; }

export function buildPlaza(scene: THREE.Scene, world: RAPIER.World, M: Mats): WorldInfo {
  const b = new Builder(world);

  // Suelo de losas de la plaza y calles
  b.box(M.slabs, [0, -0.5, 0], [44, 1, 30], { tile: 3.2 });
  b.box(M.slabs, [28, -0.5, 0], [12, 1, 9], { tile: 3.2 });

  // --- Obelisco sobre tres escalones, con verja ---
  const steps = [[11, 0.17], [9.4, 0.17], [7.8, 0.17]];
  let y = 0;
  for (const [s, h] of steps) { b.box(M.mares, [0, y + h / 2, 0], [s, h, s], { tile: 2 }); y += h; }
  b.box(M.mares, [0, y + 1.6, 0], [2.6, 3.2, 2.6], { tile: 1.8 });
  b.box(M.mares, [0, y + 3.3, 0], [3.0, 0.3, 3.0], { tile: 1.8, collide: false });
  const ob = new THREE.CylinderGeometry(0.42, 0.85, 17, 4, 1, true);
  scaleUV(ob, 4, 17 / 2);
  b.add(ob, M.mares, new THREE.Matrix4().compose(new THREE.Vector3(0, y + 3.45 + 8.5, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(1, 1, 1)));
  const tip = new THREE.ConeGeometry(0.42, 1.1, 4);
  b.add(tip, M.mares, new THREE.Matrix4().compose(new THREE.Vector3(0, y + 3.45 + 17 + 0.55, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4), new THREE.Vector3(1, 1, 1)));
  // Verja de hierro alrededor del pedestal
  const R = 2.6, top = y;
  for (const side of [0, 1, 2, 3]) {
    const P = new THREE.Matrix4().makeRotationY((side * Math.PI) / 2);
    for (let i = 0; i <= 26; i++) b.box(M.iron, [-R + (i * 2 * R) / 26, top + 0.55, R], [0.035, 1.1, 0.035], { parent: P, collide: false });
    b.box(M.iron, [0, top + 1.08, R], [2 * R + 0.05, 0.05, 0.05], { parent: P, collide: false });
    b.box(M.iron, [0, top + 0.12, R], [2 * R + 0.05, 0.04, 0.04], { parent: P, collide: false });
    const pp = new THREE.Vector3(0, top + 0.9, R).applyMatrix4(P);
    world.createCollider(RAPIER.ColliderDesc.cuboid(side % 2 ? 0.05 : R, 0.9, side % 2 ? R : 0.05).setTranslation(pp.x, pp.y, pp.z));
  }

  // --- Ajuntament (oeste), de marès, almenado, con torre del reloj ---
  const aj = building(b, M, { cx: -27, cz: 0, w: 30, d: 10, h: 12.5, ry: Math.PI / 2, wall: M.mares, floors: 2, win: 7, door: 'arch', roof: 'battlements', palace: true });
  const towerP = new THREE.Matrix4().makeTranslation(-25.5, 0, -10);
  b.box(M.mares, [0, 10.5, 0], [5.2, 21, 5.2], { parent: towerP, tile: 2 });
  b.box(M.mares, [0, 21.15, 0], [5.8, 0.3, 5.8], { parent: towerP, collide: false, tile: 2 });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    b.box(M.mares, [-2.1 + i * 1.4, 21.8, s * 2.6], [0.75, 1.0, 0.45], { parent: towerP, collide: false, tile: 1.5 });
    b.box(M.mares, [s * 2.6, 21.8, -2.1 + i * 1.4], [0.45, 1.0, 0.75], { parent: towerP, collide: false, tile: 1.5 });
  }
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.6 }));
  clock.position.set(-25.5 + 2.62, 17.5, -10);
  clock.rotation.y = Math.PI / 2;
  scene.add(clock);
  void aj;

  // --- Fachadas del sur ---
  const south = [
    { x0: -22, x1: -7, h: 13, wall: M.plasterOchre, floors: 3, win: 5, palace: true, door: 'arch' as const, roof: 'flat' as const },
    { x0: -7, x1: 7, h: 11.5, wall: M.plasterCream, floors: 3, win: 5, balcony: true, door: 'shop' as const, roof: 'flat' as const },
    { x0: 7, x1: 22, h: 10, wall: M.plasterOchre, floors: 3, win: 5, balcony: true, door: 'shop' as const, roof: 'tiles' as const },
  ];
  for (const s of south) building(b, M, { cx: (s.x0 + s.x1) / 2, cz: 20, w: s.x1 - s.x0, d: 10, ry: Math.PI, ...s });

  // --- Fachadas del este, con la boca de Ses Voltes en medio ---
  building(b, M, { cx: 28, cz: -9.75, w: 10.5, d: 12, h: 11, ry: -Math.PI / 2, wall: M.plasterCream, floors: 3, win: 3, balcony: true, door: 'shop', roof: 'tiles' });
  building(b, M, { cx: 28, cz: 9.75, w: 10.5, d: 12, h: 12, ry: -Math.PI / 2, wall: M.plasterWhite, floors: 3, win: 3, balcony: true, door: 'shop', roof: 'flat' });
  building(b, M, { cx: 39, cz: 0, w: 9, d: 10, h: 12, ry: -Math.PI / 2, wall: M.plasterOchre, floors: 3, win: 3, balcony: true, door: 'shop', roof: 'flat' });
  // Arco de Ses Voltes
  b.box(M.mares, [23.2, 6.6, 0], [2.4, 1.6, 9], { tile: 2 });

  // --- Balaustrada sobre el puerto (norte) ---
  for (let x = -21.6; x <= 21.6; x += 0.45) {
    const bal = new THREE.CylinderGeometry(0.09, 0.13, 0.7, 10);
    b.add(bal, M.mares, new THREE.Matrix4().makeTranslation(x, 0.45, -14.75));
  }
  b.box(M.mares, [0, 0.05, -14.75], [44, 0.1, 0.4], { tile: 2, collide: false });
  b.box(M.mares, [0, 0.88, -14.75], [44, 0.16, 0.45], { tile: 2 });
  for (let x = -22; x <= 22; x += 5.5) b.box(M.mares, [x, 0.5, -14.75], [0.5, 1.0, 0.5], { tile: 1.5, collide: false });
  b.wall([0, 2, -14.75], [44, 4, 0.45]); // no se puede saltar al puerto

  // Muro del acantilado bajo la plaza y la otra orilla del puerto
  b.box(M.maresDark, [0, -6, -15.6], [120, 12, 1.2], { tile: 3, collide: false });
  b.box(M.maresDark, [10, -8.5, -100], [150, 9, 20], { tile: 4, collide: false });
  for (let i = 0; i < 14; i++) {
    const w = 6 + Math.random() * 6, h = 6 + Math.random() * 7, x = -50 + i * 9.5;
    const mats = [M.plasterWhite, M.plasterCream, M.plasterOchre];
    building(b, M, { cx: x, cz: -96, by: -4, w, d: 8, h, ry: 0, wall: mats[i % 3], floors: 2, win: 2, roof: i % 3 ? 'flat' : 'tiles' });
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -10, -170);
  water.receiveShadow = true;
  scene.add(water);

  // --- Bar Imperi: rótulo, toldo y terraza ---
  const imperi = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshStandardMaterial({ map: labelTexture('Bar Imperi', '#f4ecd9', '#6b1420'), roughness: 0.6 }));
  imperi.position.set(-14.5, 4.0, 14.9);
  imperi.rotation.y = Math.PI;
  scene.add(imperi);
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.2), M.awning);
  aw.position.set(-14.5, 3.3, 13.95);
  aw.rotation.set(-Math.PI / 2 + 0.45, 0, 0);
  aw.castShadow = true;
  scene.add(aw);
  for (const [tx, tz] of [[-19, 11.3], [-16, 11.6], [-13, 11.2], [-10, 11.5]]) {
    const tt = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24);
    b.add(tt, M.mares, new THREE.Matrix4().makeTranslation(tx, 0.74, tz));
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), M.iron, new THREE.Matrix4().makeTranslation(tx, 0.36, tz));
    b.add(new THREE.CylinderGeometry(0.22, 0.25, 0.03, 16), M.iron, new THREE.Matrix4().makeTranslation(tx, 0.015, tz));
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.38, 0.42).setTranslation(tx, 0.38, tz));
    for (const s of [-1, 1]) {
      const cx = tx + s * 0.75;
      b.box(M.wood, [cx, 0.45, tz], [0.42, 0.05, 0.42], { collide: false, tile: 0.6 });
      b.box(M.wood, [cx + s * 0.2, 0.75, tz], [0.04, 0.6, 0.42], { collide: false, tile: 0.6 });
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) b.box(M.iron, [cx + lx, 0.22, tz + lz], [0.025, 0.45, 0.025], { collide: false });
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.22, 0.45, 0.22).setTranslation(cx, 0.45, tz));
    }
  }

  // --- Farolas ---
  const lamps: THREE.Vector3[] = [];
  for (const [lx, lz] of [[-13, -9], [13, -9], [-13, 9], [13, 9], [-6, -13.6], [6, -13.6]]) {
    b.add(new THREE.CylinderGeometry(0.07, 0.11, 3.8, 10), M.iron, new THREE.Matrix4().makeTranslation(lx, 1.9, lz));
    b.add(new THREE.CylinderGeometry(0.2, 0.24, 0.35, 10), M.iron, new THREE.Matrix4().makeTranslation(lx, 0.18, lz));
    b.add(new THREE.CylinderGeometry(0.22, 0.12, 0.5, 6), M.lantern, new THREE.Matrix4().makeTranslation(lx, 4.0, lz));
    b.add(new THREE.ConeGeometry(0.3, 0.3, 6), M.iron, new THREE.Matrix4().makeTranslation(lx, 4.4, lz));
    world.createCollider(RAPIER.ColliderDesc.cylinder(1.9, 0.12).setTranslation(lx, 1.9, lz));
    lamps.push(new THREE.Vector3(lx, 4, lz));
  }

  // Límites invisibles por si acaso (encima de los tejados, etc.)
  b.wall([0, 10, -16], [60, 40, 1]);
  b.wall([0, 10, 16], [60, 40, 1]);
  b.wall([-23, 10, 0], [1, 40, 40]);
  b.wall([35, 10, 0], [1, 40, 12]);

  b.finish(scene);
  return { lamps, water };
}

function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}
