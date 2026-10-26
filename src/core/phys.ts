import RAPIER from '@dimforge/rapier3d-compat';
import type { Box2 } from '../world/ferreries';

// Motor de física Rapier (WebAssembly). Cada lista de obstáculos de un nivel (las cajas Box2 de
// siempre) se convierte en un mundo de Rapier con un colisionador sólido por caja, y se mantiene
// al día si el nivel añade, mueve o quita cajas. El controlador de personaje de Rapier se encarga
// de que Azul nunca atraviese nada (resbala a lo largo de las paredes y no se mete en las esquinas),
// y la cámara lanza una esfera contra esos mismos sólidos para no meterse dentro de un edificio.
// Si Rapier no arranca en algún dispositivo, el Walker vuelve a la colisión simple de antes.

let ready = false;
export const physReady = RAPIER.init()
  .then(() => void (ready = true))
  .catch((e) => console.warn('[phys] Rapier no arranca; se usa la colisión simple', e));
export const isPhysReady = () => ready;

// Grupos de interacción (16 bits de pertenencia << 16 | 16 bits de filtro)
const G_SOLID = 0x0001;
const G_BIG = 0x0004; // lo bastante grande para tapar la cámara (edificios, muros largos)
const G_CHAR = 0x0002;
const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);
const SOLID_COLLIDER = groups(G_SOLID, 0xffff);
const BIG_COLLIDER = groups(G_SOLID | G_BIG, 0xffff);
const CHAR_COLLIDER = groups(G_CHAR, 0);
const QUERY_SOLID = groups(0xffff, G_SOLID);
const QUERY_BIG = groups(0xffff, G_BIG);

/** Los muros no tienen altura en Box2: se extienden de -60 a 60 m, para cualquier nivel o piso. */
const HALF_H = 60;
const bigBox = (b: Box2) => b.maxX - b.minX > 3 || b.maxZ - b.minZ > 3;

interface Entry { c: RAPIER.Collider; minX: number; maxX: number; minZ: number; maxZ: number }

export class Phys {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  lastUsed = performance.now();
  private boxes = new Map<Box2, Entry>();
  private chars = new Map<object, { col: RAPIER.Collider; cc: RAPIER.KinematicCharacterController }>();
  private ball = new RAPIER.Ball(0.3);
  private dirty = true;
  private live = new Set<Box2>();

  /** Pone el mundo al día con la lista de cajas del nivel (O(n), barato para unos cientos). */
  sync(list: readonly Box2[]) {
    this.lastUsed = performance.now();
    const live = this.live;
    live.clear();
    for (const b of list) {
      live.add(b);
      const e = this.boxes.get(b);
      if (e && e.minX === b.minX && e.maxX === b.maxX && e.minZ === b.minZ && e.maxZ === b.maxZ) continue;
      const hx = Math.max(0.01, Math.abs(b.maxX - b.minX) / 2);
      const hz = Math.max(0.01, Math.abs(b.maxZ - b.minZ) / 2);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const g = bigBox(b) ? BIG_COLLIDER : SOLID_COLLIDER;
      if (e) {
        e.c.setTranslation({ x: cx, y: 0, z: cz });
        e.c.setHalfExtents({ x: hx, y: HALF_H, z: hz });
        e.c.setCollisionGroups(g);
        Object.assign(e, { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ });
      } else {
        const c = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, HALF_H, hz).setTranslation(cx, 0, cz).setCollisionGroups(g));
        this.boxes.set(b, { c, minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ });
      }
      this.dirty = true;
    }
    if (this.boxes.size !== live.size) {
      for (const [b, e] of this.boxes) if (!live.has(b)) {
        this.world.removeCollider(e.c, false);
        this.boxes.delete(b);
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.world.updateSceneQueries();
      this.dirty = false;
    }
  }

  /**
   * Movimiento horizontal de un personaje (cápsula de radio r) desde `pos` con el desplazamiento
   * deseado; devuelve el que de verdad puede hacer sin atravesar nada.
   */
  move(owner: object, pos: { x: number; y: number; z: number }, dx: number, dz: number, r: number) {
    let ch = this.chars.get(owner);
    if (!ch) {
      const col = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, r).setCollisionGroups(CHAR_COLLIDER));
      const cc = this.world.createCharacterController(0.01);
      cc.setUp({ x: 0, y: 1, z: 0 });
      cc.setSlideEnabled(true);
      cc.setMaxSlopeClimbAngle(Math.PI / 2);
      this.chars.set(owner, (ch = { col, cc }));
    }
    ch.col.setTranslation({ x: pos.x, y: pos.y + 0.5 + r, z: pos.z });
    ch.cc.computeColliderMovement(ch.col, { x: dx, y: 0, z: dz }, undefined, QUERY_SOLID);
    const m = ch.cc.computedMovement();
    return { x: m.x, z: m.z };
  }

  /**
   * Hasta dónde puede ir una esfera de cámara desde `from` en la dirección (unitaria) `dir` antes de
   * chocar con un edificio o un muro grande. Devuelve `max` si no choca.
   */
  camCast(from: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, max: number) {
    const hit = this.world.castShape(from, { x: 0, y: 0, z: 0, w: 1 }, dir, this.ball, 0, max, true, undefined, QUERY_BIG);
    return hit ? hit.time_of_impact : max;
  }

  free() {
    this.world.free();
    this.boxes.clear();
    this.chars.clear();
  }
}

// Un mundo por lista de cajas. Los mundos que llevan un rato sin usarse (nivel cerrado) se liberan.
const byList = new WeakMap<readonly Box2[], Phys>();
const all: { list: readonly Box2[]; phys: Phys }[] = [];

/** Solo para el modo prueba: las listas de cajas en uso (para dibujarlas encima del nivel). */
export function physLists() {
  const now = performance.now();
  return all.filter((e) => now - e.phys.lastUsed < 2000).map((e) => e.list);
}

export function physFor(list: readonly Box2[]): Phys | null {
  if (!ready || list.length === 0) return null;
  let p = byList.get(list);
  if (!p) {
    const now = performance.now();
    for (let i = all.length - 1; i >= 0; i--) {
      if (now - all[i].phys.lastUsed > 20000) {
        all[i].phys.free();
        byList.delete(all[i].list);
        all.splice(i, 1);
      }
    }
    p = new Phys();
    byList.set(list, p);
    all.push({ list, phys: p });
  }
  p.sync(list);
  return p;
}
