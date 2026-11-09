import * as THREE from 'three';
import { comicCloudTextures } from './comicTiles';
import type { Surf } from './surfaces';

// Aspecto visual común (estilo cómic: ver comic.ts): materiales del decorado, sombras, cielo con nubes de tebeo,
// agua de tebeo, confeti, fuegos y el ajuste de calidad que baja solo si el móvil no llega.

/** Móvil o tableta: menos sombras y mapas de sombra más pequeños. */
export const MOBILE =
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900));

export const quality = {
  /** Sombras de verdad (si el móvil no llega se quitan y quedan las "manchas" bajo cada cosa). */
  shadows: true,
};

/**
 * Material base del decorado. Al montar la escena, el cómic lo pasa a tres tonos y le pone encima el dibujo de
 * tebeo de su superficie (surf: encalado, teja, losas…; ver comicSurfaces.ts). Los de Merger la llevan por vértice.
 */
export function toon(allParams: THREE.MeshStandardMaterialParameters & { surf?: Surf; leafy?: boolean }) {
  const { surf, leafy, ...params } = allParams;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...params });
  m.userData.surf = surf ?? 0;
  m.userData.leafy = !!leafy;
  m.userData.grain = true;
  return m;
}

/**
 * Reparte la luz de ambiente de la escena una sola vez: sus hemisféricas propias se multiplican por
 * scene.userData.hemiScale (0,55 si no dice nada; Ferreries, 0,35). Es lo que antes hacía la luz de entorno del
 * cielo (HDRI) y es parte del aspecto de referencia del capítulo 1. La hemisférica del cómic no se toca: su
 * intensidad es la del perfil (comic.ts, LOOK_LIGHT).
 */
export function settleAmbient(scene: THREE.Scene) {
  if (scene.userData.ambientDone) return;
  scene.userData.ambientDone = true;
  const k = (scene.userData.hemiScale as number | undefined) ?? 0.55;
  scene.traverse((o) => {
    const h = o as THREE.HemisphereLight;
    if (h.isHemisphereLight && !h.userData.comicHemi) h.intensity *= k;
  });
}

/** Marca qué proyecta y recibe sombra. Llamar una vez construida la escena. */
export function applyShadows(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) return;
    if (m.userData.blob) {
      m.visible = !quality.shadows;
      return;
    }
    const mat = m.material as THREE.Material;
    if (mat.transparent || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
    m.receiveShadow = !m.userData.noReceive;
    m.castShadow = !m.userData.noCast;
  });
  if ((scene as THREE.Scene).isScene) settleAmbient(scene as THREE.Scene);
}

/** Sol con sombra que sigue a un punto (la jugadora o el coche). */
export class Sun {
  light: THREE.DirectionalLight;
  private offset: THREE.Vector3;

  constructor(scene: THREE.Scene, color: number, intensity: number, dir: THREE.Vector3, range = 22) {
    this.light = new THREE.DirectionalLight(color, intensity);
    this.offset = dir.clone().normalize().multiplyScalar(40);
    this.light.castShadow = quality.shadows;
    const s = this.light.shadow;
    s.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
    s.radius = 3;
    s.camera.left = s.camera.bottom = -range;
    s.camera.right = s.camera.top = range;
    s.camera.near = 1;
    s.camera.far = 100;
    s.bias = -0.0006;
    s.normalBias = 0.03;
    scene.add(this.light, this.light.target);
  }

  follow(p: THREE.Vector3) {
    // Ajuste a la rejilla del mapa de sombras para que no "tiemble" al moverse
    const step = 0.5;
    const x = Math.round(p.x / step) * step;
    const z = Math.round(p.z / step) * step;
    this.light.position.set(x + this.offset.x, this.offset.y, z + this.offset.z);
    this.light.target.position.set(x, 0, z);
  }
}

function softCircleTex(stops: [number, string][], size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let glowTex: THREE.Texture | null = null;
/** Halo suave para bombillas, focos y el sol. */
export function glowTexture() {
  glowTex ??= softCircleTex([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.8)'], [0.5, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);
  return glowTex;
}

export interface SkyOptions {
  top: number;
  mid: number;
  bottom: number;
  sun?: { color: number; dir: THREE.Vector3; size?: number };
  /** Nubes de tebeo (ver comicTiles.ts). */
  clouds?: { count: number; tint: number };
  /** Dirección que las nubes no deben tapar (un sol que no es el del cielo, como el del eclipse). */
  avoid?: THREE.Vector3;
  stars?: number;
}

/** Cúpula de cielo con degradado, sol con halo, nubes de tebeo y estrellas. Sigue a la cámara. */
export class Sky {
  group = new THREE.Group();
  private colors: THREE.BufferAttribute;
  private ys: Float32Array;
  private clouds: THREE.Sprite[] = [];

  constructor(opts: SkyOptions) {
    const geo = new THREE.SphereGeometry(420, 32, 16);
    const pos = geo.attributes.position;
    this.ys = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) this.ys[i] = pos.getY(i) / 420;
    this.colors = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute('color', this.colors);
    this.group.userData.sky = true;
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    this.group.add(dome);
    // La noche de tebeo no es negra sino azul ultramar: una cúpula casi negra se aclara
    const night = (hex: number, deep: number) => {
      const c = new THREE.Color(hex);
      return c.getHSL({ h: 0, s: 0, l: 0 }).l < 0.12 ? c.lerp(new THREE.Color(deep), 0.7).getHex() : hex;
    };
    this.setColors(night(opts.top, 0x0b1846), night(opts.mid, 0x1c2f6e), night(opts.bottom, 0x34407e));

    if (opts.sun) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: opts.sun.color, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.copy(opts.sun.dir).normalize().multiplyScalar(380);
      s.scale.setScalar(opts.sun.size ?? 120);
      s.renderOrder = -9;
      this.group.add(s);
    }
    if (opts.clouds) {
      // Nubes de tebeo con su contorno: opacas, bajas y no muy grandes (una nube enorme encima del pueblo pesa mucho)
      const maps = comicCloudTextures();
      for (let i = 0; i < opts.clouds.count; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: maps[i % maps.length], color: opts.clouds.tint, fog: false, depthWrite: false, transparent: true, opacity: 1 }));
        let a = (i / opts.clouds.count) * Math.PI * 2 + Math.random() * 0.4;
        // Son opacas: ninguna delante del sol (en el eclipse tapaban justo el momento)
        const keepClear = opts.sun?.dir ?? opts.avoid;
        if (keepClear) {
          const sa = Math.atan2(keepClear.z, keepClear.x);
          const off = Math.atan2(Math.sin(a - sa), Math.cos(a - sa));
          if (Math.abs(off) < 0.6) a = sa + (off < 0 ? -0.6 : 0.6) - off * 0.2;
        }
        const r = 300 + Math.random() * 60;
        sp.position.set(Math.cos(a) * r, 57 + Math.random() * 55, Math.sin(a) * r);
        const w = (130 + Math.random() * 90) * 0.6;
        sp.scale.set(w, w / 2, 1);
        sp.renderOrder = -8;
        sp.userData.a = a;
        sp.userData.r = r;
        this.clouds.push(sp);
        this.group.add(sp);
      }
    }
    if (opts.stars) {
      const p = new Float32Array(opts.stars * 3);
      for (let i = 0; i < opts.stars; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.random() * Math.PI * 0.46;
        p.set([Math.sin(ph) * Math.cos(th) * 400, Math.cos(ph) * 400, Math.sin(ph) * Math.sin(th) * 400], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      // (sin escribir profundidad: si no, la pasada de tinta las rodeaba de negro)
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6dc, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }));
      pts.renderOrder = -9;
      this.group.add(pts);
    }
  }

  setColors(top: number, mid: number, bottom: number) {
    const t = new THREE.Color(top);
    const m = new THREE.Color(mid);
    const b = new THREE.Color(bottom);
    const c = new THREE.Color();
    for (let i = 0; i < this.ys.length; i++) {
      const h = this.ys[i];
      if (h > 0.12) c.copy(m).lerp(t, Math.min(1, (h - 0.12) / 0.55));
      else c.copy(b).lerp(m, Math.max(0, (h + 0.05) / 0.17));
      this.colors.setXYZ(i, c.r, c.g, c.b);
    }
    this.colors.needsUpdate = true;
  }

  update(cam: THREE.Camera, dt: number) {
    this.group.position.copy(cam.position);
    for (const s of this.clouds) {
      s.userData.a += dt * 0.004;
      s.position.x = Math.cos(s.userData.a) * s.userData.r;
      s.position.z = Math.sin(s.userData.a) * s.userData.r;
    }
  }
}

/** Confeti instanciado que cae alrededor de un punto. */
export class Confetti {
  mesh: THREE.InstancedMesh;
  private p: Float32Array;
  private v: Float32Array;
  private r: Float32Array;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3(1, 1, 1);
  private tmp = new THREE.Vector3();
  active = true;

  constructor(private count = 160, private area = 14, private height = 9) {
    const geo = new THREE.PlaneGeometry(0.12, 0.2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), count);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count);
    this.r = new Float32Array(count * 2);
    const palette = [0xd7263d, 0xf4d35e, 0x1b998b, 0x2e86ab, 0xffffff, 0xe2547a];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      this.reset(i, new THREE.Vector3(), true);
      this.mesh.setColorAt(i, c.set(palette[i % palette.length]));
    }
  }

  private reset(i: number, center: THREE.Vector3, anyHeight: boolean) {
    this.p[i * 3] = center.x + (Math.random() - 0.5) * this.area * 2;
    this.p[i * 3 + 1] = anyHeight ? Math.random() * this.height : this.height;
    this.p[i * 3 + 2] = center.z + (Math.random() - 0.5) * this.area * 2;
    this.v[i] = 0.6 + Math.random() * 0.8;
    this.r[i * 2] = Math.random() * 6;
    this.r[i * 2 + 1] = 2 + Math.random() * 4;
  }

  private next = 0;
  /** Un puñado de confeti lanzado al aire desde `at` (cae desde ahí y luego vuelve a la lluvia normal). */
  toss(at: THREE.Vector3, n = 14) {
    for (let k = 0; k < n; k++) {
      const i = (this.next = (this.next + 1) % this.count);
      this.p[i * 3] = at.x + (Math.random() - 0.5) * 1.4;
      this.p[i * 3 + 1] = at.y + Math.random() * 1.2;
      this.p[i * 3 + 2] = at.z + (Math.random() - 0.5) * 1.4;
    }
  }

  update(dt: number, center: THREE.Vector3, t: number) {
    for (let i = 0; i < this.count; i++) {
      this.p[i * 3 + 1] -= this.v[i] * dt;
      this.p[i * 3] += Math.sin(t * 2 + i) * dt * 0.4;
      if (this.p[i * 3 + 1] < 0.05) {
        if (this.active) this.reset(i, center, false);
        else this.p[i * 3 + 1] = -5;
      }
      const a = this.r[i * 2] + t * this.r[i * 2 + 1];
      this.q.setFromEuler(this.e.set(a, a * 0.7, a * 0.3));
      this.mesh.setMatrixAt(i, this.m.compose(this.tmp.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]), this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Purpurina en el aire: motas doradas, plateadas y rosas que flotan y destellan alrededor de un punto. */
export class Glitter {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private base: Float32Array;
  private ph: Float32Array;
  constructor(private N = 260, private area = 7, private height = 3.2) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    this.base = new Float32Array(N * 3);
    this.ph = new Float32Array(N);
    const pal = [0xffd76a, 0xfff2c0, 0xd8dde6, 0xff8fc8, 0xb88cff, 0x8fe3ff];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.pos.set([(Math.random() - 0.5) * area * 2, Math.random() * height, (Math.random() - 0.5) * area * 2], i * 3);
      c.set(pal[i % pal.length]);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.ph[i] = Math.random() * 40;
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, map: glowTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false;
  }
  update(dt: number, center: THREE.Vector3, t: number) {
    const A = this.area;
    for (let i = 0; i < this.N; i++) {
      const j = i * 3;
      this.pos[j + 1] -= dt * (0.12 + (i % 7) * 0.03);
      this.pos[j] += Math.sin(t * 0.9 + this.ph[i]) * dt * 0.25;
      // Se recoloca al otro lado cuando se aleja del centro: siempre hay purpurina alrededor
      if (this.pos[j] - center.x > A) this.pos[j] -= 2 * A;
      if (this.pos[j] - center.x < -A) this.pos[j] += 2 * A;
      if (this.pos[j + 2] - center.z > A) this.pos[j + 2] -= 2 * A;
      if (this.pos[j + 2] - center.z < -A) this.pos[j + 2] += 2 * A;
      if (this.pos[j + 1] < 0.05) this.pos[j + 1] = this.height;
      // Destello: casi apagada la mayor parte del tiempo y de golpe muy brillante
      const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (5 + (i % 5)) + this.ph[i]), 8);
      const k = 0.25 + tw * 2.2;
      this.col[j] = this.base[j] * k;
      this.col[j + 1] = this.base[j + 1] * k;
      this.col[j + 2] = this.base[j + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** Fuegos artificiales con un único THREE.Points y mezcla aditiva. */
export class Fireworks {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private base: Float32Array;
  private next = 0;
  private N = 600;

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 3).fill(-999);
    this.col = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    this.base = new Float32Array(this.N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, map: glowTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.points.frustumCulled = false;
  }

  burst(at: THREE.Vector3) {
    const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    for (let k = 0; k < 80; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.N;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 9 + Math.random() * 3;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], i * 3);
      this.base.set([c.r, c.g, c.b], i * 3);
      this.life[i] = 1.6;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / 1.6);
      this.vel[i * 3 + 1] -= 6 * dt;
      for (let a = 0; a < 3; a++) {
        this.vel[i * 3 + a] *= 1 - dt * 1.5;
        this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
        this.col[i * 3 + a] = this.base[i * 3 + a] * k;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** Vibración corta (Android). En iPhone no hace nada. */
export function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sin vibración */
  }
}

const WATER_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uTime, uAlpha, uNight, uStroke;
varying vec3 vW;
varying vec3 vN;
#include <common>
#include <fog_pars_fragment>
float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 V = normalize(cameraPosition - vW);
  vec3 n = normalize(vN);
  float facing = clamp(dot(n, V), 0.0, 1.0);
  // tres bandas planas: hondo a los pies, medio y, rasante hacia el horizonte, el reflejo claro del cielo
  vec3 deep = uColor * 0.82;
  vec3 mid = uColor * 1.15 + 0.02;
  // (de noche, el reflejo del cielo es azul oscuro: si no, el mar parecía un suelo claro)
  vec3 far = uNight > 0.5 ? mix(uColor * 1.25 + 0.02, vec3(0.16, 0.22, 0.45), 0.25) : mix(uColor * 1.45 + 0.05, vec3(0.82, 0.9, 1.0), 0.3);
  vec3 col = facing > 0.6 ? deep : facing > 0.25 ? mid : far;
  col += uEmissive;
  // reflejos: trazos blancos cortos que cambian a saltos (6 por segundo), como dibujados
  float t = floor(uTime * 6.0) / 6.0;
  vec2 q = vW.xz * vec2(0.55, 1.6) * uStroke + vec2(t * 0.35, t * 0.12);
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float on = step(0.8, wh(cell + floor(t * 1.5)));
  float len = 0.2 + 0.45 * wh(cell + 7.1);
  float stroke = on * step(abs(f.y - 0.5), 0.07) * step(abs(f.x - 0.5), len * 0.5);
  stroke *= 1.0 - smoothstep(35.0, 110.0, length(cameraPosition - vW));
  col = mix(col, uNight > 0.5 ? vec3(0.8, 0.86, 1.0) : vec3(1.0), stroke * (uNight > 0.5 ? 0.6 : 0.9));
  // olas de la malla (la piscina), dibujadas: la cara de la ola, un tono plano más claro, y su borde, una línea
  // blanca de trazo duro (rellenas de blanco con borde suave parecían manchas de luz borrosas)
  float slope = length(n.xz);
  col = mix(col, col * 1.15 + 0.04, step(0.15, slope));
  col = mix(col, vec3(0.95, 0.98, 1.0), step(0.12, slope) * (1.0 - step(0.15, slope)) * 0.8);
  gl_FragColor = vec4(col, uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/**
 * Mar, piscina o lago de tebeo: bandas de color plano según el ángulo, reflejos como trazos blancos que se mueven
 * a saltos y, si la malla tiene olas (la piscina), sus crestas en blanco. El plano se tumba girando la malla, así
 * que quien lo use solo debe tocar su posición. sunDir se conserva por compatibilidad (el agua de tebeo no lo usa).
 */
export function makeSea(size: [number, number], color: number, _sunDir: THREE.Vector3, opts: { night?: boolean; emissive?: number; alpha?: number; geometry?: THREE.BufferGeometry; ripples?: boolean } = {}) {
  const geo = opts.geometry ?? new THREE.PlaneGeometry(size[0], size[1]);
  const alpha = opts.alpha ?? 1;
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uEmissive: { value: new THREE.Color(opts.emissive ?? 0).multiplyScalar(0.6) },
        uTime: { value: 0 },
        uAlpha: { value: alpha },
        uNight: { value: opts.night ? 1 : 0 },
        // (en un vaso pequeño, los trazos más apretados)
        uStroke: { value: opts.ripples ? 2.6 : 1 },
      },
    ]),
    fog: true,
    transparent: alpha < 1,
    depthWrite: alpha >= 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const t0 = performance.now();
  mesh.onBeforeRender = () => {
    mat.uniforms.uTime.value = (performance.now() - t0) / 1000;
  };
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.noCast = true;
  // (el agua no se dobla a mano alzada: la de la piscina mueve sus vértices cada fotograma)
  mesh.userData.comicBent = true;
  return mesh;
}
