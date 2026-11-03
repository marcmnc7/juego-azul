import * as THREE from 'three';
import type { Input } from './input';

// Misiones dentro del capítulo: el aparcamiento del aeropuerto, la playa del vóley, el pipicán de Joy…
// Cada una tiene su escena 3D, con los mismos personajes y el mismo estilo que el resto del juego. Mientras
// dura, el bucle principal dibuja su escena en lugar de la del capítulo (que espera en pausa) y al acabar
// todo vuelve a como estaba: la cámara, el HUD del capítulo y el control.

export interface Mission {
  readonly scene: THREE.Scene;
  update(dt: number): void;
  dispose(): void;
}

export interface MissionCtx {
  camera: THREE.PerspectiveCamera;
  input: Input;
}

class Stage {
  current: Mission | null = null;
  private ctx: MissionCtx | null = null;
  private camPos = new THREE.Vector3();
  private camQuat = new THREE.Quaternion();
  private camFov = 60;
  /** Lo pone main: prepara la escena nueva (estilo pintado, sombras, shaders compilados). */
  onStart: ((scene: THREE.Scene) => void) | null = null;

  setContext(ctx: MissionCtx) {
    this.ctx = ctx;
  }

  get active() {
    return !!this.current;
  }

  /** Empieza una misión: `make` construye su escena (y su HUD) con la cámara y el control del juego. walk: si se anda (si no, fuera el joystick). */
  start(make: (ctx: MissionCtx) => Mission, walk = true) {
    const c = this.ctx!;
    this.end();
    this.camPos.copy(c.camera.position);
    this.camQuat.copy(c.camera.quaternion);
    this.camFov = c.camera.fov;
    c.input.reset();
    document.getElementById('ui')?.classList.add('mission');
    document.getElementById('ui')?.classList.toggle('mission-static', !walk);
    this.current = make(c);
    this.onStart?.(this.current.scene);
  }

  /** Termina la misión en curso (si la hay) y devuelve la cámara y el HUD del capítulo. */
  end() {
    const m = this.current;
    if (!m) return;
    this.current = null;
    m.dispose();
    const c = this.ctx!;
    c.camera.position.copy(this.camPos);
    c.camera.quaternion.copy(this.camQuat);
    c.camera.fov = this.camFov;
    c.camera.updateProjectionMatrix();
    c.input.reset();
    document.getElementById('ui')?.classList.remove('mission', 'mission-static');
  }
}

export const stage = new Stage();
