import * as THREE from 'three';
import { Sky as SkyMesh } from 'three/examples/jsm/objects/Sky.js';
import { loadHdriSync } from './assets';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { surfaceTexture, surfMeans, SURF_SCALE, SURF_STRENGTH, SURF_NORMAL, hdSurfaceTexture, hdNormalTexture, hdMeans, hdRoughMeans, type Surf } from './surfaces';

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

/**
 * Calidad de la prueba de concepto (texturas fotográficas con relieve y rugosidad). Es un uniforme
 * compartido por todos los materiales: se enciende al entrar en un capítulo que la usa y se apaga
 * al salir, sin recompilar nada. De momento, solo el capítulo 1.
 */
export const hdSurfaces = { value: 0 };
const HD_STRENGTH = SURF_STRENGTH.map((v, i) => ([1, 2, 3, 10].includes(i) ? 1 : v));
// Las texturas HD solo se crean si algún capítulo HD llega a dibujarse
const hdColorUniform = { get value() { return hdSurfaces.value ? hdSurfaceTexture() : surfaceTexture(); } };
const hdNormalUniform = { get value() { return hdSurfaces.value ? hdNormalTexture() : surfaceTexture(); } };

/** Material base de todo el juego: PBR mate (nombre heredado de cuando era toon). */
export function toon(allParams: THREE.MeshStandardMaterialParameters & { surf?: Surf }) {
  const { surf, ...params } = allParams;
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
    ph.userData.surf = surf ?? 0;
    addGrain(ph);
    return ph as unknown as THREE.MeshStandardMaterial;
  }
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...params });
  m.userData.surf = surf ?? 0;
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
    sh.uniforms.surfTex = { value: surfaceTexture() };
    sh.uniforms.surfScale = { value: SURF_SCALE.map((v) => 1 / v) };
    sh.uniforms.surfStrength = { value: SURF_STRENGTH };
    sh.uniforms.surfMean = { value: surfMeans };
    sh.uniforms.uSurf = { value: (m.userData.surf as number) ?? 0 };
    sh.uniforms.uHD = hdSurfaces;
    sh.uniforms.hdTex = hdColorUniform;
    sh.uniforms.hdNrm = hdNormalUniform;
    sh.uniforms.hdMean = { value: hdMeans };
    sh.uniforms.hdRoughMean = { value: hdRoughMeans };
    sh.uniforms.hdStrength = { value: HD_STRENGTH };
    sh.uniforms.hdNormal = { value: SURF_NORMAL };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying highp vec3 vGrainPos;\nvarying vec3 vGrainN;\nattribute float surf;\nvarying float vSurf;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vGrainPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vGrainN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vGrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vGrainN = normalize(mat3(modelMatrix) * objectNormal);
        #endif
        vSurf = surf;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying highp vec3 vGrainPos;
        varying vec3 vGrainN;
        varying float vSurf;
        uniform highp sampler2DArray surfTex;
        uniform float surfScale[16];
        uniform float surfStrength[16];
        uniform float surfMean[16];
        uniform float uSurf;
        uniform float uHD;
        uniform highp sampler2DArray hdTex;
        uniform highp sampler2DArray hdNrm;
        uniform vec3 hdMean[16];
        uniform float hdRoughMean[16];
        uniform float hdStrength[16];
        uniform float hdNormal[16];
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
        diffuseColor.rgb *= 1.0 + (gN - 0.5) * ${(amount * 2).toFixed(3)};
        // Textura de la superficie (encalado, teja, marès…) proyectada desde los tres ejes del mundo
        int sIdx = int(max(vSurf, uSurf) + 0.5);
        vec3 bw = pow(abs(vGrainN), vec3(4.0));
        bw /= (bw.x + bw.y + bw.z + 1e-4);
        vec3 sp = vGrainPos * surfScale[sIdx];
        float sl = float(sIdx);
        bool hdOn = uHD > 0.5 && sIdx > 0;
        if (hdOn) {
          // Foto en color (Sponza) proyectada en los tres ejes, normalizada a su color medio para
          // respetar el color elegido de cada pared
          vec3 sdc = texture(hdTex, vec3(sp.zy, sl)).rgb * bw.x
                   + texture(hdTex, vec3(sp.xz, sl)).rgb * bw.y
                   + texture(hdTex, vec3(sp.xy * vec2(1.0, -1.0), sl)).rgb * bw.z;
          vec2 mpc = bw.y > 0.5 ? sp.xz : (bw.x > bw.z ? sp.zy : sp.xy);
          vec3 smc = texture(hdTex, vec3(mat2(0.8, -0.6, 0.6, 0.8) * mpc * 0.23 + 0.37, sl)).rgb;
          diffuseColor.rgb *= mix(vec3(1.0), (sdc * 0.7 + smc * 0.3) / hdMean[sIdx], hdStrength[sIdx]);
        } else if (sIdx > 0) {
          float sd = texture(surfTex, vec3(sp.zy, sl)).r * bw.x
                   + texture(surfTex, vec3(sp.xz, sl)).r * bw.y
                   + texture(surfTex, vec3(sp.xy * vec2(1.0, -1.0), sl)).r * bw.z;
          // Segunda muestra a escala grande (y girada) en el plano dominante: rompe la repetición
          // y da las manchas grandes que tienen las superficies reales
          vec2 mp = bw.y > 0.5 ? sp.xz : (bw.x > bw.z ? sp.zy : sp.xy);
          float sm = texture(surfTex, vec3(mat2(0.8, -0.6, 0.6, 0.8) * mp * 0.23 + 0.37, sl)).r;
          diffuseColor.rgb *= mix(1.0, (sd * 0.65 + sm * 0.35) / surfMean[sIdx], surfStrength[sIdx]);
        }
        // Suciedad y humedad al pie de las paredes, y desgaste en las aristas altas: lo que hace que
        // un muro encalado parezca de verdad y no una caja
        float gWall = 1.0 - abs(vGrainN.y);
        float gFoot = (1.0 - smoothstep(0.0, 0.75, vGrainPos.y)) * step(-0.3, vGrainPos.y) * gWall;
        diffuseColor.rgb *= 1.0 - gFoot * (0.16 + gN * 0.12);
        float gStreak = gWall * smoothstep(0.55, 0.9, gNoise(vec3(vGrainPos.x * 3.0 + vGrainPos.z * 3.0, vGrainPos.y * 0.25, 0.0)));
        diffuseColor.rgb *= 1.0 - gStreak * 0.06;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (gN - 0.5) * 0.25, 0.04, 1.0);
        if (hdOn) {
          float rS = texture(hdNrm, vec3(sp.zy, sl)).a * bw.x
                   + texture(hdNrm, vec3(sp.xz, sl)).a * bw.y
                   + texture(hdNrm, vec3(sp.xy * vec2(1.0, -1.0), sl)).a * bw.z;
          roughnessFactor = clamp(roughnessFactor * mix(1.0, rS / hdRoughMean[sIdx], 0.8), 0.04, 1.0);
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (hdOn) {
          // Relieve triplanar (mezcla "whiteout"): juntas, grietas y teja con volumen de verdad
          vec3 nW = normalize(inverseTransformDirection(normal, viewMatrix));
          float ns = hdNormal[sIdx];
          vec3 tx = texture(hdNrm, vec3(sp.zy, sl)).xyz * 2.0 - 1.0;
          vec3 ty = texture(hdNrm, vec3(sp.xz, sl)).xyz * 2.0 - 1.0;
          vec3 tz = texture(hdNrm, vec3(sp.xy * vec2(1.0, -1.0), sl)).xyz * 2.0 - 1.0;
          tx.xy *= ns; ty.xy *= ns; tz.xy *= ns; tz.y = -tz.y;
          tx = vec3(tx.xy + nW.zy, abs(tx.z) * nW.x);
          ty = vec3(ty.xy + nW.xz, abs(ty.z) * nW.y);
          tz = vec3(tz.xy + nW.xy, abs(tz.z) * nW.z);
          vec3 nb = normalize(tx.zyx * bw.x + ty.xzy * bw.y + tz.xyz * bw.z);
          normal = normalize((viewMatrix * vec4(nb, 0.0)).xyz);
        }`,
      );
  };
  m.customProgramCacheKey = () => (quality.grain ? 'grain' + amount + 's' + (m.userData.surf ?? 0) : 'plain');
}

/**
 * Luz ambiente realista: convierte el cielo del nivel (cúpula, sol, nubes, estrellas) en un mapa
 * de entorno prefiltrado, para que cada material recoja el color del cielo de forma física.
 */
let pmrem: THREE.PMREMGenerator | null = null;
/** Sentido del giro del HDRI (comprobado con una esfera espejo). */
export let ENV_ROT_SIGN = 1;
export function setEnvRotSign(v: number) {
  ENV_ROT_SIGN = v;
}
export function setEnvRenderer(r: THREE.WebGLRenderer) {
  pmrem = new THREE.PMREMGenerator(r);
}
/** Cielo HDRI para los capítulos de día con la calidad de la prueba que no ponen uno propio. */
export const hdEnvDefault: { url: string | null } = { url: null };

function sunDirOf(scene: THREE.Scene) {
  let dir: THREE.Vector3 | undefined;
  scene.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (!dir && l.isDirectionalLight) dir = l.position.clone().sub(l.target.position).normalize();
  });
  return dir;
}

export function applyEnvironment(scene: THREE.Scene) {
  if (!pmrem || !quality.env || scene.userData.envDone) return;
  scene.userData.envDone = true;
  let sky: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (o.userData.sky) sky = o;
  });
  // Capítulos con la calidad de la prueba: luz de un cielo real fotografiado (HDRI), girado para
  // que su sol caiga donde está el sol de la escena
  const hd = (scene.userData.hdri ??
    (hdSurfaces.value && hdEnvDefault.url && !scene.userData.noHdri ? { url: hdEnvDefault.url, intensity: 0.85, sunDir: sunDirOf(scene), hemi: 0.4 } : undefined)) as
    | { url: string; intensity?: number; sunDir?: THREE.Vector3; hemi?: number }
    | undefined;
  const h = hd ? loadHdriSync(hd.url) : null;
  if (hd && h) {
    scene.environment = pmrem.fromEquirectangular(h.texture).texture;
    scene.environmentIntensity = hd.intensity ?? 0.75;
    if (hd.sunDir) scene.environmentRotation.y = ENV_ROT_SIGN * (Math.atan2(hd.sunDir.z, hd.sunDir.x) - Math.atan2(h.sun.z, h.sun.x));
    // Con un cielo real dando la luz ambiente, la hemisférica casi sobra y el sol manda (como en la prueba)
    scene.traverse((o) => {
      const hl = o as THREE.HemisphereLight;
      if (hl.isHemisphereLight) hl.intensity *= hd.hemi ?? 0.3;
    });
    return;
  }
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
  /** Cielo físico (dispersión atmosférica) en lugar del degradado, con el sol en esa dirección. */
  physical?: { sunDir: THREE.Vector3; turbidity?: number; rayleigh?: number };
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
    if (opts.physical) {
      const ph = new SkyMesh();
      ph.scale.setScalar(410);
      const u = ph.material.uniforms;
      u.turbidity.value = opts.physical.turbidity ?? 3.2;
      u.rayleigh.value = opts.physical.rayleigh ?? 1.4;
      u.mieCoefficient.value = 0.004;
      u.mieDirectionalG.value = 0.82;
      u.sunPosition.value.copy(opts.physical.sunDir).normalize();
      // El cielo de three.js está pensado para una exposición de 0.5: lo bajamos aquí para que no queme
      // ni el cielo ni la luz de entorno que se saca de él
      const sm = ph.material as THREE.ShaderMaterial;
      sm.fragmentShader = sm.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * 0.42, 1.0 );');
      ph.material.depthWrite = false;
      (ph.material as THREE.ShaderMaterial).fog = false;
      ph.renderOrder = -10;
      dome.visible = false;
      this.group.add(ph);
    }

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

/** Mapa de normales del oleaje, dibujado en un canvas (suma de ondas) para no depender de imágenes. */
let waveNormals: THREE.Texture | null = null;
function waveNormalTexture() {
  if (waveNormals) return waveNormals;
  const N = 256;
  const h = new Float32Array(N * N);
  const waves: [number, number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const k = 1 + Math.floor(Math.random() * (2 + i));
    waves.push([Math.round(Math.cos(a) * k), Math.round(Math.sin(a) * k), 1 / (1 + i * 0.6), Math.random() * 6.28]);
  }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0;
      for (const [kx, ky, amp, ph] of waves) v += amp * Math.sin(((kx * x + ky * y) / N) * Math.PI * 2 + ph);
      h[y * N + x] = v;
    }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)];
      const dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
      const i = (y * N + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  waveNormals = t;
  return t;
}

/**
 * Mar con reflejos del cielo, oleaje animado y brillo del sol (Water de three.js). En móviles que
 * bajan de calidad se queda en un plano PBR brillante. El plano se tumba girando la malla, así que
 * quien lo use solo debe tocar su posición.
 */
export function makeSea(size: [number, number], color: number, sunDir: THREE.Vector3, opts: { night?: boolean; emissive?: number } = {}) {
  const geo = new THREE.PlaneGeometry(size[0], size[1]);
  let mesh: THREE.Mesh;
  if (quality.kind === 'standard' && quality.post) {
    const w = new Water(geo, {
      textureWidth: 256,
      textureHeight: 256,
      waterNormals: waveNormalTexture(),
      sunDirection: sunDir.clone().normalize(),
      sunColor: opts.night ? 0x445577 : 0xfff2d8,
      waterColor: color,
      distortionScale: opts.night ? 0.8 : 1.3,
      fog: true,
    });
    const u = (w.material as THREE.ShaderMaterial).uniforms;
    u.size.value = 6;
    let last = performance.now();
    w.onBeforeRender = ((orig) =>
      function (this: THREE.Mesh, ...args: unknown[]) {
        const now = performance.now();
        u.time.value += Math.min(0.1, (now - last) / 1000) * 0.6;
        last = now;
        (orig as (...a: unknown[]) => void).apply(this, args);
      })(w.onBeforeRender);
    mesh = w;
  } else {
    mesh = new THREE.Mesh(geo, toon({ color, emissive: opts.emissive ?? 0x06283a, roughness: 0.12, metalness: 0.12 }));
  }
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.noCast = true;
  return mesh;
}
