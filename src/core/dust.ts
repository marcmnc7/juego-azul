import * as THREE from 'three';
import { glowTexture } from './gfx';

// Polvo a los pies: nubecillas que se levantan al aterrizar, al arrancar a correr y al girar en seco.
// Un único Points compartido que el bucle principal pone en la escena del capítulo; cualquiera puede
// pedir una nubecilla con dust.puff().

const N = 160;

class Dust {
  readonly points: THREE.Points;
  private pos = new Float32Array(N * 3);
  private vel = new Float32Array(N * 3);
  private life = new Float32Array(N);
  private max = new Float32Array(N);
  private size = new Float32Array(N);
  private alpha = new Float32Array(N);
  private next = 0;

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos.fill(-999);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, color: { value: new THREE.Color(0xe8dcc4) }, scale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        varying float vA;
        uniform float scale;
        void main() {
          vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 color;
        varying float vA;
        void main() {
          float a = texture2D(map, gl_PointCoord).a * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(color, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  /** Pone el polvo en la escena del capítulo (y lo quita de la anterior). */
  attach(scene: THREE.Scene) {
    if (this.points.parent !== scene) scene.add(this.points);
  }

  /** Nubecilla de n motas en (x, y, z); fuerza 0-1 (un aterrizaje fuerte levanta más). */
  puff(x: number, y: number, z: number, n = 6, strength = 0.5) {
    for (let k = 0; k < n; k++) {
      const i = (this.next = (this.next + 1) % N);
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 0.9) * (0.5 + strength);
      this.pos.set([x + Math.cos(a) * 0.15, y + 0.05, z + Math.sin(a) * 0.15], i * 3);
      this.vel.set([Math.cos(a) * sp, 0.25 + Math.random() * 0.5 * strength, Math.sin(a) * sp], i * 3);
      this.max[i] = this.life[i] = 0.5 + Math.random() * 0.5;
      this.size[i] = 0.25 + Math.random() * 0.2 + strength * 0.2;
    }
  }

  update(dt: number) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      for (let a = 0; a < 3; a++) {
        this.vel[i * 3 + a] *= 1 - dt * 3.5;
        this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      }
      // Crece y se desvanece, como el polvo de verdad
      this.size[i] += dt * 0.6;
      this.alpha[i] = Math.sin(k * Math.PI) * 0.45;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
  }
}

export const dust = new Dust();
