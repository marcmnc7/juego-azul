import * as THREE from 'three';
import { MOBILE } from '../core/gfx';
import { loadGLB } from '../core/assets';
import { rigKind, colorRigMaterial, vatTime, type Kind } from './rig';
import type { CrowdPose, PersonLook } from './models';
import womanLodUrl from '../assets/chars/woman_mh_lod.glb';
import manLodUrl from '../assets/chars/man_mh_lod.glb';

// Multitud con los mismos personajes glTF y la misma captura de movimiento, pero horneada en
// texturas (VAT, "vertex animation textures"): al cargar se calcula la posición de cada vértice en
// cada fotograma de cada animación, y luego cientos de personas se dibujan instanciadas (unas pocas
// llamadas de dibujo) leyendo su fotograma en el shader. Así el móvil aguanta la plaza llena.

const FPS = 15;
const H = THREE.DataUtils.toHalfFloat;
const W = 2048; // ancho de las texturas de animación
const CLIPS = ['idle', 'agree', 'headShake', 'dance'] as const;
type Clip = (typeof CLIPS)[number];

interface VatPart {
  name: string;
  geo: THREE.BufferGeometry;
  pos: THREE.DataTexture;
  nrm: THREE.DataTexture;
  V: number;
  /** Material del modelo grande (con sus texturas), para teñirlo como al personaje. */
  base: THREE.MeshStandardMaterial;
}
interface VatKind {
  parts: VatPart[];
  clips: Record<Clip, { start: number; frames: number }>;
}

const kinds: Partial<Record<Kind, VatKind>> = {};
let baking: Promise<void> | null = null;

function bakeKind(kind: Kind, lod: THREE.Object3D) {
  // El hombre y la chica de MakeHuman en versión ligera, con su mismo esqueleto y sus animaciones
  const K = rigKind(kind === 'woman' ? 'mhwoman' : kind);
  const model = lod;
  model.scale.setScalar(K.scale);
  model.position.y = -K.minY * K.scale;
  const meshes: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && !/Teeth/.test(m.name)) meshes.push(m);
  });
  // Materiales con textura del modelo grande, por nombre de malla
  const full = new Map<string, THREE.MeshStandardMaterial>();
  K.gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) full.set(m.name, m.material as THREE.MeshStandardMaterial);
  });

  const mixer = new THREE.AnimationMixer(model);
  const clips = {} as VatKind['clips'];
  let total = 0;
  for (const c of CLIPS) {
    const frames = Math.max(2, Math.round(K.clips[c].duration * FPS));
    clips[c] = { start: total, frames };
    total += frames;
  }
  const parts: VatPart[] = [];
  const bv = new THREE.Vector3(), bn = new THREE.Vector3(), acc = new THREE.Vector3(), accN = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), tmp = new THREE.Vector3();
  const datas = meshes.map((m) => {
    const V = m.geometry.attributes.position.count;
    const rows = Math.ceil((total * V) / W);
    return { m, V, pos: new Uint16Array(W * rows * 4), nrm: new Uint16Array(W * rows * 4), rows };
  });
  // Vértices y normales en la pose de enlace, una vez
  model.updateWorldMatrix(true, true);
  const binds = meshes.map((m) => {
    const p = m.geometry.attributes.position as THREE.BufferAttribute;
    const n = m.geometry.attributes.normal as THREE.BufferAttribute;
    const P = new Float32Array(p.count * 3), N = new Float32Array(p.count * 3);
    const nm = new THREE.Matrix3().setFromMatrix4(m.bindMatrix);
    for (let i = 0; i < p.count; i++) {
      bv.fromBufferAttribute(p, i).applyMatrix4(m.bindMatrix);
      bn.fromBufferAttribute(n, i).applyMatrix3(nm);
      P.set([bv.x, bv.y, bv.z], i * 3);
      N.set([bn.x, bn.y, bn.z], i * 3);
    }
    return { P, N };
  });
  // Altura de cada vértice en reposo (0 pies … 1 cabeza): para el pantalón corto
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const { P } of binds)
    for (let i = 0; i < P.length; i += 3) {
      y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]);
      x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]);
    }
  const BH = y1 - y0, cx = (x0 + x1) / 2;
  const rests = binds.map(({ P }) => {
    const r = new Float32Array((P.length / 3) * 2);
    for (let i = 0; i < P.length / 3; i++) {
      r[i * 2] = (P[i * 3 + 1] - y0) / BH;
      r[i * 2 + 1] = Math.abs(P[i * 3] - cx) / BH;
    }
    return r;
  });
  for (const c of CLIPS) {
    const action = mixer.clipAction(K.clips[c]).play();
    const { start, frames } = clips[c];
    for (let f = 0; f < frames; f++) {
      action.time = (f / frames) * K.clips[c].duration;
      mixer.update(0);
      model.updateWorldMatrix(true, true);
      meshes.forEach((m, mi) => {
        m.skeleton.update();
        const B = m.skeleton.boneMatrices;
        const si = m.geometry.attributes.skinIndex as THREE.BufferAttribute;
        const sw = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
        const { P, N } = binds[mi];
        const d = datas[mi];
        for (let i = 0; i < d.V; i++) {
          acc.set(0, 0, 0);
          accN.set(0, 0, 0);
          for (let k = 0; k < 4; k++) {
            const w = sw.getComponent(i, k);
            if (!w) continue;
            m4.fromArray(B, si.getComponent(i, k) * 16);
            tmp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m4);
            acc.addScaledVector(tmp, w);
            tmp.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).transformDirection(m4);
            accN.addScaledVector(tmp, w);
          }
          // De mundo al espacio del personaje (el modelo está en el origen, así que coinciden)
          const o = ((start + f) * d.V + i) * 4;
          d.pos[o] = H(acc.x);
          d.pos[o + 1] = H(acc.y);
          d.pos[o + 2] = H(acc.z);
          accN.normalize();
          d.nrm[o] = H(accN.x);
          d.nrm[o + 1] = H(accN.y);
          d.nrm[o + 2] = H(accN.z);
        }
      });
    }
    action.stop();
  }
  const tex = (a: Uint16Array, rows: number) => {
    // Media precisión: basta para milímetros en un cuerpo de 2 m, y ocupa la mitad
    const t = new THREE.DataTexture(a, W, rows, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  datas.forEach((d) => {
    const g = new THREE.BufferGeometry();
    g.setIndex(d.m.geometry.index);
    g.setAttribute('position', d.m.geometry.attributes.position);
    g.setAttribute('normal', d.m.geometry.attributes.normal);
    if (d.m.geometry.attributes.uv) g.setAttribute('uv', d.m.geometry.attributes.uv);
    g.setAttribute('aRest', new THREE.BufferAttribute(rests[datas.indexOf(d)], 2));
    const base = full.get(d.m.name) ?? (full.values().next().value as THREE.MeshStandardMaterial);
    parts.push({ name: d.m.name, geo: g, pos: tex(d.pos, d.rows), nrm: tex(d.nrm, d.rows), V: d.V, base });
  });
  mixer.uncacheRoot(model);
  kinds[kind] = { parts, clips };
}

/** Hornea la multitud (después de preloadRig). Tarda un poco, una sola vez. */
export function preloadCrowd() {
  baking ??= (async () => {
    const [w, m] = await Promise.all([loadGLB(womanLodUrl), loadGLB(manLodUrl)]);
    const t0 = performance.now();
    bakeKind('woman', w.scene);
    bakeKind('man', m.scene);
    console.info(`[rig] multitud horneada en ${Math.round(performance.now() - t0)} ms`);
  })().catch((e) => console.warn('[rig] no se pudo hornear la multitud', e));
  return baking;
}
export const crowdReady = () => !!kinds.woman && !!kinds.man;

const VAT_COMMON = /* glsl */ `
uniform highp sampler2D vatPos;
uniform highp sampler2D vatNrm;
uniform float vatV;
uniform float vatTime;
attribute vec4 iAnim;
vec3 vatFetch(highp sampler2D t, float frame) {
  float idx = frame * vatV + float(gl_VertexID);
  float y = floor(idx / ${W}.0);
  return texelFetch(t, ivec2(int(idx - y * ${W}.0), int(y)), 0).xyz;
}
void vatFrame(out float f0, out float f1, out float fa) {
  float fr = mod(max(0.0, vatTime * iAnim.w + iAnim.z) * ${FPS}.0, iAnim.y);
  float a = floor(fr);
  fa = fr - a;
  f0 = iAnim.x + a;
  f1 = iAnim.x + mod(a + 1.0, iAnim.y);
}
`;

function vatify(mat: THREE.Material, part: VatPart) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.vatPos = { value: part.pos };
    sh.uniforms.vatNrm = { value: part.nrm };
    sh.uniforms.vatV = { value: part.V };
    sh.uniforms.vatTime = vatTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VAT_COMMON)
      .replace(
        '#include <beginnormal_vertex>',
        `float vf0, vf1, vfa;
        vatFrame(vf0, vf1, vfa);
        vec3 objectNormal = normalize(mix(vatFetch(vatNrm, vf0), vatFetch(vatNrm, vf1), vfa));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `float vp0, vp1, vpa;
        vatFrame(vp0, vp1, vpa);
        vec3 transformed = mix(vatFetch(vatPos, vp0), vatFetch(vatPos, vp1), vpa);`,
      );
  };
  mat.customProgramCacheKey = () => 'vat';
}

// ---------- Que no sean clones ----------
// Cada persona de la multitud lleva sus propios colores de pelo, camiseta, pantalón y piel, y su
// altura y complexión. El modelo se tiñe de un gris neutro y cada instancia multiplica por su color
// (en el shader), así sigue siendo una sola llamada de dibujo por pieza.

const NEUTRAL = 0x9a9a9a;
// El hombre de MakeHuman de la multitud viene con camiseta blanca, pantalón gris claro y pelo gris claro
const MH_TOP = 0xf2f2f2, MH_BOT = 0xd1d1d1, MH_HAIR = 0xd8d8d8, MH_SKIN = 0xe9bc9e;
const MH_HAIRS = ['MHHair', 'MHHair_short01', 'MHHair_short04'];
const MH_HAIRS_W = ['MHHair', 'MHHair_bob02'];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const HAIRS = [0x2b1d14, 0x3b2618, 0x5a3b22, 0x7a5434, 0x2a1c14, 0x33231a, 0xb08a52, 0xd8bb7e, 0x8a3b1e];
// De fiesta en verano: mucho blanco (en el jaleo se va de blanco) y colores vivos
const TOPS = [0xf6f3ec, 0xf6f3ec, 0xf6f3ec, 0xffffff, 0xe94f4f, 0x2f6fb5, 0x3fa37a, 0xf2c14e, 0xf08cae, 0x1d1d22, 0x7a5cc4, 0x9fd3e6, 0xf28f3b];
const BOTTOMS = [0x4b6a92, 0x4b6a92, 0x8aa6c8, 0x1f1f24, 0xeeeae0, 0xb8a27a, 0x5d6b3a, 0x2d3a5a];
const SKINS = [0xf6d7bd, 0xf0c8a6, 0xe8b894, 0xe0aa84, 0xcf9670, 0xb97c55, 0x8f5a3c];

const _c = new THREE.Color();
const _n = new THREE.Color();
/** Lo que hay que multiplicar a un color para que quede el otro (en lineal, como el shader). */
function ratio(to: number, from: number, out: Float32Array, i: number) {
  _c.setHex(to);
  _n.setHex(from);
  out[i] = Math.min(12, _c.r / Math.max(0.004, _n.r));
  out[i + 1] = Math.min(12, _c.g / Math.max(0.004, _n.g));
  out[i + 2] = Math.min(12, _c.b / Math.max(0.004, _n.b));
}

/** Gente de la multitud con modelo glTF: misma forma de usar que CrowdPeople. */
export class RigCrowd {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private anim: THREE.InstancedBufferAttribute;
  /** Altura y anchura de cada persona. */
  private size: Float32Array;
  constructor(look: PersonLook, count: number, dance = false) {
    const kind: Kind = look.male || look.beard || look.hairStyle === 'short' || look.hairStyle === 'cap' ? 'man' : 'woman';
    const K = kinds[kind]!;
    // Colores de cada uno: un tercio va como lo pensó el capítulo, el resto, a su aire
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const hair = new Float32Array(count * 3), top = new Float32Array(count * 3), bot = new Float32Array(count * 3), skin = new Float32Array(count * 3);
    this.size = new Float32Array(count * 2);
    // (MakeHuman: camiseta blanca, pantalón gris claro, pelo gris claro y su piel: se tiñe respecto a eso)
    const man = true;
    const HAIRS_K = kind === 'man' ? MH_HAIRS : MH_HAIRS_W;
    this.hv = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const own = Math.random() < 0.33;
      ratio(own ? look.hair : pick(HAIRS), man ? MH_HAIR : NEUTRAL, hair, i * 3);
      ratio(own ? look.shirt : pick(TOPS), man ? MH_TOP : NEUTRAL, top, i * 3);
      ratio(own ? look.pants : pick(BOTTOMS), man ? MH_BOT : NEUTRAL, bot, i * 3);
      ratio(own ? look.skin : pick(SKINS), man ? MH_SKIN : look.skin, skin, i * 3);
      this.hv[i] = Math.floor(Math.random() * HAIRS_K.length);
      this.size[i * 2] = 0.92 + Math.random() * 0.15;
      this.size[i * 2 + 1] = 0.93 + Math.random() * 0.14;
    }
    const neutral: PersonLook = { ...look, hair: NEUTRAL, shirt: NEUTRAL, pants: NEUTRAL };
    const a = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      // (charlando: la mayoría asiente o niega mientras habla; pocos se quedan solo de pie)
      const c: Clip = dance ? 'dance' : r < 0.35 ? 'idle' : r < 0.8 ? 'agree' : 'headShake';
      a.set([K.clips[c].start, K.clips[c].frames, Math.random() * 20, 0.85 + Math.random() * 0.3], i * 4);
    }
    this.anim = new THREE.InstancedBufferAttribute(a, 4);
    for (const part of K.parts) {
      if (/Beard/.test(part.name) && !look.beard) continue;
      // él: pantalón corto de verdad (la pieza corta y el cuerpo con las piernas) o el largo
      if (man && /^(PantsShort|BodyShort)$/.test(part.name) && !look.shorts) continue;
      if (man && /^(Pants|Body)$/.test(part.name) && look.shorts) continue;
      const g = new THREE.BufferGeometry();
      g.setIndex(part.geo.index);
      for (const k in part.geo.attributes) g.setAttribute(k, part.geo.attributes[k]);
      g.setAttribute('iAnim', this.anim);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
      const mat = part.base.clone();
      // Pantalón corto: a ella se lo pinta su textura (como el mono de Margaux); él lleva su pieza corta
      if (man) mat.color.set(0xffffff);
      else colorRigMaterial(kind, part.name, mat, neutral);
      vatify(mat, part);
      const im = new THREE.InstancedMesh(g, mat, count);
      // Él va por piezas: cada pieza se tiñe entera con el color de esa persona
      const tint = (/^MHHair/.test(part.name) ? hair : part.name === 'Shirt' ? top : /^Pants/.test(part.name) ? bot : /^Body/.test(part.name) ? skin : null);
      if (tint) {
        for (let i = 0; i < count; i++) im.setColorAt(i, _c.setRGB(tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]));
      }
      im.userData.person = true;
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      vatify(depth, part);
      im.customDepthMaterial = depth;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Se recorta con la esfera que envuelve a todo el grupo (se recalcula en commit): la gente que queda
      // detrás de la cámara no se dibuja
      im.frustumCulled = true;
      // Las piezas pequeñas (ojos) no hace falta que proyecten sombra; en el móvil, ninguna: la multitud
      // proyectándose en el mapa de sombras costaba tanto como dibujarla
      if (/Eye/.test(part.name) || MOBILE) im.userData.noCast = true;
      // peinado: cada hombre lleva uno de los tres (los demás, a escala cero)
      const hi = HAIRS_K.indexOf(part.name);
      if (hi >= 0) im.userData.hairVariant = hi;
      this.meshes.push(im);
      this.group.add(im);
    }
  }
  /** Coloca a la persona i en (x, z) mirando según q, con el balanceo de su postura. */
  set(i: number, x: number, z: number, q: THREE.Quaternion, p: CrowdPose, y = 0) {
    _q.copy(q).multiply(_q2.setFromAxisAngle(_Y, p.twist * 0.5)).multiply(_q2.setFromAxisAngle(_Z, p.sway * 0.5));
    _v.set(p.shift * 0.5, 0, 0).applyQuaternion(q);
    _s.set(this.size[i * 2 + 1], this.size[i * 2], this.size[i * 2 + 1]);
    _m.compose(_v.set(x + _v.x, y, z + _v.z), _q, _s);
    for (const im of this.meshes) im.setMatrixAt(i, im.userData.hairVariant === undefined || im.userData.hairVariant === this.hv[i] ? _m : ZERO);
  }
  /** Peinado de cada uno (índice en MH_HAIRS). */
  private hv: Uint8Array;
  commit() {
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true;
    // Las piezas comparten matrices: una esfera para todas, recalculada de vez en cuando (apenas se mueven)
    const c = this.commits++;
    if (this.meshes.length && (c < 5 || c % 30 === 0)) {
      const m0 = this.meshes[0];
      m0.computeBoundingSphere();
      for (const im of this.meshes) im.boundingSphere = m0.boundingSphere;
    }
  }
  private commits = 0;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _Y = new THREE.Vector3(0, 1, 0);
const _Z = new THREE.Vector3(0, 0, 1);
