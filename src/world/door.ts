import * as THREE from 'three';
import { audio } from '../core/audio';

// Puertas de verdad: nadie atraviesa una puerta cerrada. Cuando alguien se acerca se abre (girando
// sobre sus bisagras, o corriendo si es una corredera), le deja pasar y, cuando ya no hay nadie cerca,
// se cierra sola. La hoja la construye quien la pone: el grupo `leaf` va de la bisagra hacia +x local.

export interface DoorOpts {
  /** Eje de la bisagra (abajo) en el mundo; en una corredera, el canto de la hoja cerrada. */
  hinge: THREE.Vector3;
  /** Giro del marco: con 0, la hoja cerrada va de la bisagra hacia +x y la puerta mira a ±z. */
  ry: number;
  width: number;
  /** Cuánto gira al abrirse (radianes; el signo dice hacia qué lado). Ignorado si es corredera. */
  swing?: number;
  /** Corredera: metros que se desliza (hacia -x local) en vez de girar. */
  slide?: number;
  /** Distancia a la que se abre al acercarse alguien (desde el centro del hueco). */
  reach?: number;
  /** Segundos que tarda en abrirse. */
  speed?: number;
  sound?: 'wood' | 'metal' | 'plastic' | 'none';
}

const ease = (k: number) => k * k * (3 - 2 * k);

export class Door {
  /** Marco: en la bisagra, girado ry. */
  readonly group = new THREE.Group();
  /** La hoja que se mueve: se le añaden las piezas (de x = 0 a x = width). */
  readonly leaf = new THREE.Group();
  private k = 0;
  private holdT = 0;
  private wasOpen = false;
  private readonly center = new THREE.Vector3();

  constructor(readonly o: DoorOpts) {
    this.group.position.copy(o.hinge);
    this.group.rotation.y = o.ry;
    this.group.add(this.leaf);
    // Centro del hueco, en el mundo (para saber quién se acerca)
    this.center.set(o.width / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.ry).add(o.hinge);
  }

  /** Cuánto está abierta (0 cerrada … 1 abierta del todo). */
  get open() {
    return this.k;
  }

  /** Que se quede abierta un rato aunque no haya nadie (alguien acaba de entrar o va a salir). */
  hold(secs: number) {
    this.holdT = Math.max(this.holdT, secs);
  }

  /** Abre si alguno de `who` (posiciones en el suelo) está cerca; si no, cierra. `ear`: la cámara (el ruido baja con la distancia). */
  update(dt: number, who: readonly THREE.Vector3[], ear?: THREE.Vector3) {
    this.ear = ear;
    const r = this.o.reach ?? 1.5;
    let near = false;
    for (const p of who) if (Math.hypot(p.x - this.center.x, p.z - this.center.z) < r) near = true;
    this.holdT -= dt;
    const want = near || this.holdT > 0 ? 1 : 0;
    const v = dt / (this.o.speed ?? 0.45);
    this.k = want ? Math.min(1, this.k + v) : Math.max(0, this.k - v * 0.8);
    const e = ease(this.k);
    if (this.o.slide) this.leaf.position.x = -this.o.slide * e;
    else this.leaf.rotation.y = (this.o.swing ?? 1.7) * e;
    // Ruido del picaporte al abrir y un golpe suave al cerrar
    const opening = want === 1 && this.k > 0 && this.k < 1;
    if (opening && !this.wasOpen) this.click(true);
    if (this.k === 0 && this.wasOpen) this.click(false);
    this.wasOpen = this.k > 0;
  }

  private ear?: THREE.Vector3;
  private click(open: boolean) {
    const s = this.o.sound ?? 'wood';
    if (s === 'none') return;
    const d = this.ear ? this.ear.distanceTo(this.center) : 0;
    if (d > 16) return;
    const f = s === 'metal' ? (open ? 1400 : 900) : s === 'plastic' ? (open ? 900 : 520) : open ? 700 : 260;
    audio.knock((open ? 0.18 : 0.3) / (1 + d * 0.25), f, open ? 0.04 : 0.07);
  }
}
