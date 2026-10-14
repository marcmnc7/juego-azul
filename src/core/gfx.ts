import * as THREE from 'three';

// Aspecto visual común: materiales físicos (PBR) iluminados por el propio cielo de cada nivel,
// sombras suaves, bloom en las luces, cielo con nubes y un ajuste de calidad que baja solo si el
// móvil no llega. (El antiguo estilo "dibujo animado" con contornos se puede recuperar con
// quality.outlines = true.)

export const quality = {
  shadows: true,
  outlines: false,
  post: true,
  /** Grano procedural en las superficies. Se apaga solo si el shader no compila en el dispositivo. */
  grain: true,
  /** Luz de entorno a partir del cielo (PMREM). */
  env: true,
  /**
   * Tipo de material. 'standard' es PBR; algunos Mac con M1 (ANGLE Metal) lo pintan invisible, y
   * entonces se usa 'phong' (con brillos) o, como último recurso, 'lambert'.
   */
  kind: 'standard' as 'standard' | 'phong' | 'lambert',
};

/** Material base de todo el juego: PBR mate (nombre heredado de cuando era toon). */
export function toon(params: THREE.MeshStandardMaterialParameters) {
  if (quality.kind !== 'standard') {
    const { roughness, metalness: _m, envMapIntensity: _e, ...rest } = params;
    void _m, void _e;
    if (quality.kind === 'lambert') return new THREE.MeshLambertMaterial(rest as THREE.MeshLambertMaterialParameters) as unknown as THREE.MeshStandardMaterial;
    // Phong imitando la rugosidad: mate casi sin brillo, el agua muy brillante
    const smooth = 1 - (roughness ?? 0.82);
    const ph = new THREE.MeshPhongMaterial({
      shininess: 4 + 90 * smooth * smooth,
      specular: new THREE.Color().setScalar(0.03 + 0.3 * smooth * smooth),
      ...(rest as THREE.MeshPhongMaterialParameters),
    });
    addGrain(ph);
    return ph as unknown as THREE.MeshStandardMaterial;
  }
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...params });
  addGrain(m);
  return m;
}

/**
 * Variación sutil de color y rugosidad según la posición en el mundo (ruido en dos escalas), para
 * que ninguna superficie sea un color plano: paredes con manchas, suelo con desgaste, ropa con textura.
 */
export function addGrain(m: THREE.Material, amount = 0.14) {
  m.onBeforeCompile = (sh) => {
    if (!quality.grain) return;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying highp vec3 vGrainPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vGrainPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vGrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying highp vec3 vGrainPos;
        float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float gNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), f.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), f.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gN = gNoise(vGrainPos * 0.6) * 0.6 + gNoise(vGrainPos * 4.0) * 0.3 + gNoise(vGrainPos * 19.0) * 0.1;
        diffuseColor.rgb *= 1.0 + (gN - 0.5) * ${(amount * 2).toFixed(3)};`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (gN - 0.5) * 0.25, 0.04, 1.0);`,
      );
  };
  m.customProgramCacheKey = () => (quality.grain ? 'grain' + amount : 'plain');
}

/**
 * Luz ambiente realista: convierte el cielo del nivel (cúpula, sol, nubes, estrellas) en un mapa
 * de entorno prefiltrado, para que cada material recoja el color del cielo de forma física.
 */
let pmrem: THREE.PMREMGenerator | null = null;
export function setEnvRenderer(r: THREE.WebGLRenderer) {
  pmrem = new THREE.PMREMGenerator(r);
}
export function applyEnvironment(scene: THREE.Scene) {
  if (!pmrem || !quality.env || scene.userData.envDone) return;
  scene.userData.envDone = true;
  let sky: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (o.userData.sky) sky = o;
  });
  const tmp = new THREE.Scene();
  if (sky) {
    const c = (sky as THREE.Object3D).clone();
    c.position.set(0, 0, 0);
    tmp.add(c);
  } else tmp.background = scene.background instanceof THREE.Color ? scene.background : new THREE.Color(0x888899);
  const rt = pmrem.fromScene(tmp, 0.03, 0.1, 1000);
  scene.environment = rt.texture;
  scene.environmentIntensity = 0.9;
  // Con el cielo aportando luz, las luces hemisféricas sobran en parte
  scene.traverse((o) => {
    const h = o as THREE.HemisphereLight;
    if (h.isHemisphereLight) h.intensity *= 0.55;
  });
}

/** Quita la luz de entorno de una escena (modo seguro) y devuelve las luces hemisféricas a su valor. */
export function removeEnvironment(scene: THREE.Scene) {
  if (!scene.userData.envDone || !scene.environment) return;
  scene.environment = null;
  scene.traverse((o) => {
    const h = o as THREE.HemisphereLight;
    if (h.isHemisphereLight) h.intensity /= 0.55;
  });
}

// Contorno: se dibuja la cara trasera inflada a lo largo de la normal.
const outlineMats = new Map<number, THREE.MeshBasicMaterial>();
export function outlineMat(thickness = 0.025) {
  let m = outlineMats.get(thickness);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: 0x2a1a2e, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normal * ${thickness.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => 'outline' + thickness;
    outlineMats.set(thickness, m);
  }
  return m;
}

/** Añade contorno a todas las mallas de un objeto (personajes, animales, coche). */
export function addOutline(obj: THREE.Object3D, thickness = 0.025) {
  if (!quality.outlines) return obj;
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.blob && !m.userData.outline && !(m.material as THREE.Material).transparent) meshes.push(m);
  });
  for (const m of meshes) {
    const o = new THREE.Mesh(m.geometry, outlineMat(thickness));
    o.userData.outline = true;
    o.castShadow = false;
    o.receiveShadow = false;
    m.add(o);
  }
  return obj;
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
    if (m.userData.outline) return;
    const mat = m.material as THREE.Material;
    if (mat.transparent || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
    m.receiveShadow = true;
    m.castShadow = !m.userData.noCast;
  });
  if ((scene as THREE.Scene).isScene) applyEnvironment(scene as THREE.Scene);
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
    s.mapSize.set(2048, 2048);
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

let cloudTex: THREE.Texture | null = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const blobs = [[70, 80, 40], [120, 60, 52], [170, 78, 40], [100, 88, 34], [150, 92, 34], [200, 92, 26], [50, 96, 24]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}

export interface SkyOptions {
  top: number;
  mid: number;
  bottom: number;
  sun?: { color: number; dir: THREE.Vector3; size?: number };
  clouds?: { count: number; tint: number };
  stars?: number;
}

/** Cúpula de cielo con degradado, sol con halo, nubes y estrellas. Sigue a la cámara. */
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
    this.setColors(opts.top, opts.mid, opts.bottom);

    if (opts.sun) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: opts.sun.color, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.copy(opts.sun.dir).normalize().multiplyScalar(380);
      s.scale.setScalar(opts.sun.size ?? 120);
      s.renderOrder = -9;
      this.group.add(s);
    }
    if (opts.clouds) {
      for (let i = 0; i < opts.clouds.count; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), color: opts.clouds.tint, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
        const a = (i / opts.clouds.count) * Math.PI * 2 + Math.random() * 0.4;
        const r = 300 + Math.random() * 60;
        sp.position.set(Math.cos(a) * r, 50 + Math.random() * 70, Math.sin(a) * r);
        const w = 90 + Math.random() * 90;
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
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
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
