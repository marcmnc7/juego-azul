import * as THREE from 'three';
import { Trail } from '../core/follow';
import type { Box2 } from '../world/ferreries';
import type { Person } from './models';
import { rigPost } from './rig';
import { sideNames, twoBone } from './embrace';

// De la mano: Gas va a la izquierda de Azul, a su paso, y las dos manos de en medio se cogen (cada brazo baja hasta
// un punto entre los dos, a la altura de la cadera y un poco por delante). Si se separan (una esquina, alguien en
// medio), él va por donde ha pasado ella y las manos se sueltan hasta que vuelve a su lado.

const SIDE = 0.56;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _fw = new THREE.Vector3();

export class HandPair {
  private trail = new Trail();
  private yaw = 0;
  /** 0 = sueltos; 1 = de la mano. */
  private k = 0;
  private post: ((dt: number) => void) | null = null;
  private moving = false;

  constructor(private her: Person, private him: Person) {}

  start(yaw: number) {
    this.yaw = yaw;
    this.trail.reset();
    if (this.post) rigPost.delete(this.post);
    this.post = (dt) => this.arms(dt);
    rigPost.add(this.post);
  }

  /** Los pone juntos de golpe (dentro de un fundido). */
  snap(yaw: number) {
    this.yaw = yaw;
    const p = this.her.root.position;
    this.him.root.position.set(p.x + Math.cos(yaw) * SIDE, this.him.root.position.y, p.z - Math.sin(yaw) * SIDE);
    this.him.root.rotation.y = yaw;
    this.trail.reset();
    this.k = 1;
  }

  stop() {
    if (this.post) rigPost.delete(this.post);
    this.post = null;
  }

  /** Después de mover a Azul: Gas, a su lado. Devuelve si anda (para su animación). */
  step(dt: number, facing: number, walls: readonly Box2[]) {
    const p = this.her.root.position, g = this.him.root.position;
    const da = Math.atan2(Math.sin(facing - this.yaw), Math.cos(facing - this.yaw));
    this.yaw += THREE.MathUtils.clamp(da, -dt * 3.2, dt * 3.2);
    const tx = p.x + Math.cos(this.yaw) * SIDE, tz = p.z - Math.sin(this.yaw) * SIDE;
    this.trail.note(p);
    if (Math.hypot(p.x - g.x, p.z - g.z) > 1.5) {
      this.moving = this.trail.step(this.him.root, p, 0.8, 2.6, dt, walls, 0.24, 3.2);
      return this.moving;
    }
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    let moved = 0;
    if (d > 0.004) {
      const st = Math.min(d, 3.4 * dt);
      const bx = g.x, bz = g.z;
      this.trail.nudge(this.him.root, (dx / d) * st, (dz / d) * st, walls, 0.2);
      moved = Math.hypot(g.x - bx, g.z - bz);
    }
    const dy = Math.atan2(Math.sin(this.yaw - this.him.root.rotation.y), Math.cos(this.yaw - this.him.root.rotation.y));
    this.him.root.rotation.y += dy * Math.min(1, dt * 9);
    this.moving = dt > 0 && moved / dt > 0.2;
    return this.moving;
  }

  private arms(dt: number) {
    const her = this.her, him = this.him;
    if (!her.rig || !him.rig || !her.root.parent || !him.root.parent) return;
    const near = her.root.position.distanceTo(him.root.position) < 0.95;
    this.k += ((near ? 1 : 0) - this.k) * Math.min(1, dt * 5);
    const w = THREE.MathUtils.smoothstep(this.k, 0.05, 0.9);
    if (w <= 0.001) return;
    const B = (p: Person, n: string) => p.rig!.bones.get(n)!;
    // Él a la izquierda de ella: la mano de ella del lado de él y la de él del lado de ella
    const [herNear] = sideNames(her);
    const [, hisNear] = sideNames(him);
    const hs = B(her, herNear + 'Arm').getWorldPosition(_a);
    const gs = B(him, hisNear + 'Arm').getWorldPosition(_b);
    _fw.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // Las manos se juntan entre los dos, un poco por delante y a la altura de la cadera
    _t.copy(hs).lerp(gs, 0.5).addScaledVector(_fw, 0.2);
    _t.y = Math.min(hs.y, gs.y) - 0.5;
    // (el codo, hacia atrás y hacia fuera: el brazo cae relajado)
    _pole.copy(hs).addScaledVector(_fw, -0.4);
    _pole.y -= 0.3;
    twoBone(B(her, herNear + 'Arm'), B(her, herNear + 'ForeArm'), B(her, herNear + 'Hand'), _t, _pole, w);
    _pole.copy(gs).addScaledVector(_fw, -0.4);
    _pole.y -= 0.3;
    twoBone(B(him, hisNear + 'Arm'), B(him, hisNear + 'ForeArm'), B(him, hisNear + 'Hand'), _t, _pole, w);
  }
}
