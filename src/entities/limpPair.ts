import * as THREE from 'three';
import { Trail } from '../core/follow';
import type { Box2 } from '../world/ferreries';
import type { Person } from './models';
import { limpPose } from './limp';
import { boneFrame, rigPost } from './rig';
import { sideNames, twoBone } from './embrace';

// Gas, cojo, con el brazo por encima de los hombros de Azul; ella le sujeta por la cintura. Van pegados, al mismo
// paso: él a la izquierda de ella (el pie malo, el derecho, es el que queda de su lado). Si se separan (una esquina,
// un coche), él va por donde ha pasado ella y las manos se sueltan hasta que vuelve a su lado.

const SIDE = 0.4;
const _fr = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const _pole = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class LimpPair {
  private trail = new Trail();
  private yaw = 0;
  /** 0 = cada uno a lo suyo; 1 = abrazados. */
  private k = 0;
  private post: ((dt: number) => void) | null = null;
  private moving = false;

  constructor(private her: Person, private him: Person) {}

  /** Los pone juntos (dentro de un fundido). */
  start(yaw: number) {
    this.yaw = yaw;
    this.k = 1;
    const p = this.her.root.position;
    this.him.root.position.set(p.x + Math.cos(yaw) * SIDE, this.him.root.position.y, p.z - Math.sin(yaw) * SIDE);
    this.him.root.rotation.y = yaw;
    this.trail.reset();
    if (this.post) rigPost.delete(this.post);
    this.post = (dt) => this.arms(dt);
    rigPost.add(this.post);
  }

  stop() {
    if (this.post) rigPost.delete(this.post);
    this.post = null;
  }

  /** La velocidad a la que puede ir ella: tira de él y avanzan a tirones, cuando él apoya el pie bueno. */
  speed() {
    return 1.05 + 1 * Math.max(0, Math.sin(this.him.auto?.ph ?? 0));
  }

  /** Después de mover a Azul: Gas, a su lado. Devuelve si anda (para su animación). */
  step(dt: number, facing: number, walls: readonly Box2[]) {
    const p = this.her.root.position, g = this.him.root.position;
    const da = Math.atan2(Math.sin(facing - this.yaw), Math.cos(facing - this.yaw));
    this.yaw += THREE.MathUtils.clamp(da, -dt * 2.6, dt * 2.6);
    const tx = p.x + Math.cos(this.yaw) * SIDE, tz = p.z - Math.sin(this.yaw) * SIDE;
    const dist = Math.hypot(p.x - g.x, p.z - g.z);
    this.trail.note(p);
    let moved = 0;
    if (dist > 1.25) {
      // Se ha quedado atrás: por donde ha pasado ella
      this.moving = this.trail.step(this.him.root, p, 0.7, 1.9, dt, walls, 0.24, 2.6);
      return this.moving;
    }
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    if (d > 0.004) {
      const st = Math.min(d, 2.8 * dt);
      const bx = g.x, bz = g.z;
      this.trail.nudge(this.him.root, (dx / d) * st, (dz / d) * st, walls, 0.2);
      moved = Math.hypot(g.x - bx, g.z - bz);
    }
    const dy = Math.atan2(Math.sin(this.yaw - this.him.root.rotation.y), Math.cos(this.yaw - this.him.root.rotation.y));
    this.him.root.rotation.y += dy * Math.min(1, dt * 9);
    this.moving = dt > 0 && moved / dt > 0.18;
    return this.moving;
  }

  /** Su pose encima de la animación (después de animatePerson). */
  pose() {
    limpPose(this.him, this.moving);
  }

  private arms(dt: number) {
    const her = this.her, him = this.him;
    if (!her.rig || !him.rig || !her.root.parent || !him.root.parent) return;
    const near = her.root.position.distanceTo(him.root.position) < 0.72;
    this.k += ((near ? 1 : 0) - this.k) * Math.min(1, dt * 4);
    const w = THREE.MathUtils.smoothstep(this.k, 0.05, 0.9);
    if (w <= 0.001) return;
    // Él está a la izquierda de ella (+x); ella, a la derecha de él (-x)
    const [herNear, herFar] = sideNames(her);
    const [, hisNear] = sideNames(him);
    const B = (p: Person, n: string) => p.rig!.bones.get(n)!;

    // Su mano, sobre el hombro de ella que queda lejos; el brazo le pasa por detrás de la nuca
    boneFrame(her, 'Spine2', _fr);
    const herBack = _a.copy(Z).applyQuaternion(_fr).multiplyScalar(-1);
    // (lo que se apunta es la muñeca: los dedos ya caen sobre el hombro)
    B(her, herFar + 'Arm').getWorldPosition(_t).lerp(B(her, 'Neck').getWorldPosition(_b), 0.62);
    _t.addScaledVector(herBack, 0.05);
    _t.y += 0.075;
    const shoulder = B(him, hisNear + 'Arm').getWorldPosition(_b);
    _pole.copy(shoulder).addScaledVector(herBack, 0.45);
    _pole.y += 0.04;
    twoBone(B(him, hisNear + 'Arm'), B(him, hisNear + 'ForeArm'), B(him, hisNear + 'Hand'), _t, _pole, w);

    // Su mano, a la cintura de él, por el lado de fuera
    boneFrame(him, 'Spine', _fr);
    const hisLeft = _a.copy(X).applyQuaternion(_fr);
    const hisBack = _b.copy(Z).applyQuaternion(_fr).multiplyScalar(-1);
    B(him, 'Spine').getWorldPosition(_t);
    _t.addScaledVector(hisLeft, 0.05).addScaledVector(hisBack, 0.15);
    B(her, herNear + 'Arm').getWorldPosition(_pole);
    _pole.addScaledVector(hisBack, 0.5);
    _pole.y -= 0.2;
    twoBone(B(her, herNear + 'Arm'), B(her, herNear + 'ForeArm'), B(her, herNear + 'Hand'), _t, _pole, w);
  }
}
