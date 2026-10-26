import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Cámara en tercera persona: órbita alrededor de la cabeza, colisión con una esfera lanzada por
// Rapier (se acerca de golpe si algo se interpone y se aleja con suavidad), y recentrado detrás
// del personaje cuando se camina sin tocar la cámara.

export class FollowCam {
  yaw = 0;
  pitch = 0.28;
  dist = 4.4;
  private cur = 4.4;
  private target = new THREE.Vector3();
  private ball = new RAPIER.Ball(0.22);
  private rot = { x: 0, y: 0, z: 0, w: 1 };

  constructor(public cam: THREE.PerspectiveCamera, private world: RAPIER.World, private exclude: RAPIER.Collider) {}

  update(dt: number, head: THREE.Vector3, look: { dx: number; dy: number; zoom: number }, playerYaw: number, speed: number, idleLook: boolean) {
    this.yaw -= look.dx * 0.0055;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy * 0.004, -0.35, 1.2);
    this.dist = THREE.MathUtils.clamp(this.dist + look.zoom, 2.2, 8);
    // Recentrado suave detrás de Azul al moverse
    if (idleLook && speed > 0.5) {
      let d = playerYaw + Math.PI - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 0.9 * Math.min(speed / 2, 1.5)));
    }
    // El punto de mira sigue a la cabeza con un ligero retraso vertical (no tiembla al saltar)
    this.target.x = head.x;
    this.target.z = head.z;
    this.target.y += (head.y - this.target.y) * (1 - Math.exp(-dt * 7));
    if (Math.abs(head.y - this.target.y) > 2) this.target.y = head.y;

    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const hit = this.world.castShape(this.target, this.rot, dir, this.ball, 0, this.dist, true, undefined, undefined, this.exclude, undefined,
      (c) => !(c.parent()?.isDynamic()));
    const allowed = hit ? Math.max(0.6, hit.time_of_impact - 0.05) : this.dist;
    // Acercarse al instante (nunca atraviesa), alejarse despacio
    this.cur = allowed < this.cur ? allowed : this.cur + (allowed - this.cur) * (1 - Math.exp(-dt * 3));
    this.cam.position.copy(this.target).addScaledVector(dir, this.cur);
    this.cam.lookAt(this.target.x, this.target.y + 0.05, this.target.z);
  }

  snap(head: THREE.Vector3) { this.target.copy(head); }
}
