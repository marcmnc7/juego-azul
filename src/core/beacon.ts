import * as THREE from 'three';

// Columna de luz sobre el objetivo: se ve desde lejos y por encima de la gente, así no hay que
// adivinar dónde está "el bar de la plaza". Los capítulos la ponen junto a la flecha del HUD
// (beacon.at(objetivo) / beacon.at(null)); el bucle principal la coloca en la escena y la anima.

class Beacon {
  readonly group = new THREE.Group();
  private pillar: THREE.Mesh;
  private ring: THREE.Mesh;
  private target = new THREE.Vector3();
  private want = 0;
  private shown = 0;
  private t = 0;

  constructor() {
    const fade = (strength: number) => {
      // Mezcla normal (no aditiva): sobre paredes encaladas y cielo claro, una luz aditiva no se ve
      const m = new THREE.MeshBasicMaterial({ color: 0xffa81e, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
      Object.assign(m, { defines: { USE_UV: '' } });
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `diffuseColor.a *= ${strength.toFixed(2)} * pow(1.0 - vUv.y, 0.7) * smoothstep(0.0, 0.03, vUv.y);\n#include <opaque_fragment>`);
      };
      m.customProgramCacheKey = () => 'beacon' + strength;
      return m;
    };
    // Alta para asomar por encima de los tejados (las casas del pueblo tienen 6-9 m)
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 28, 20, 1, true).translate(0, 14, 0), fade(0.55));
    // (en el cilindro, la UV vertical va de 0 abajo a 1 arriba: la luz se deshace hacia el cielo)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe4a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.ring.position.y = 0.04;
    this.group.add(this.pillar, this.ring);
    this.group.visible = false;
    this.group.renderOrder = 3;
  }

  /** Objetivo actual (en el suelo) o null para esconderla. */
  at(v: THREE.Vector3 | null) {
    this.want = v ? 1 : 0;
    if (v) this.target.set(v.x, v.y, v.z);
  }

  attach(scene: THREE.Scene) {
    if (this.group.parent !== scene) {
      scene.add(this.group);
      this.want = this.shown = 0;
    }
  }

  update(dt: number, hidden: boolean, cam: THREE.Camera) {
    this.t += dt;
    const want = hidden ? 0 : this.want;
    this.shown += (want - this.shown) * Math.min(1, dt * 4);
    this.group.visible = this.shown > 0.02;
    if (!this.group.visible) return;
    this.group.position.lerp(this.target, this.shown < 0.1 ? 1 : Math.min(1, dt * 6));
    // De lejos se ensancha: así siempre mide lo mismo en pantalla y no se pierde al fondo de una calle
    const w = THREE.MathUtils.clamp(cam.position.distanceTo(this.group.position) * 0.04, 1, 3.5);
    this.pillar.scale.set(w, 1, w);
    const pulse = 0.85 + Math.sin(this.t * 3) * 0.15;
    (this.pillar.material as THREE.MeshBasicMaterial).opacity = this.shown * pulse;
    const k = (this.t * 0.6) % 1;
    this.ring.scale.setScalar(1 + k * 1.6);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = this.shown * (1 - k) * 0.8;
  }
}

export const beacon = new Beacon();
