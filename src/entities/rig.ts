import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../core/assets';
import { airOf } from '../core/air';
import type { Person, PersonLook, PersonMode } from './models';
import womanUrl from '../assets/chars/woman.glb';
import manUrl from '../assets/chars/man.glb';
import animsUrl from '../assets/chars/anims.glb';
import womanPartsUrl from '../assets/chars/woman_parts.png';

// Personajes de la prueba de concepto: modelos glTF con esqueleto (rig de Mixamo) y animaciones de
// captura de movimiento (Mixamo), con el mismo retargeting en espacio mundo de la prueba.
//
// Para que el código de los niveles siga funcionando igual, cada personaje conserva el "esqueleto"
// del muñeco de siempre (body, head, armL, kneeR…) como articulaciones invisibles. animatePerson las
// sigue moviendo, pero lo que se ve lo mueve la captura de movimiento (reposo, andar, correr,
// bailar). Cuando un nivel coloca una articulación a mano (llevar la pomada, el beso, tocar el
// fabiol) o el modo no tiene captura (saludar, celebrar, hablar), esa parte del cuerpo copia la
// articulación invisible, con una transición suave.

export type Kind = 'woman' | 'man';
const HEIGHT: Record<Kind, number> = { woman: 1.66, man: 1.78 };

interface KindData {
  gltf: GLTF;
  clips: Record<string, THREE.AnimationClip>;
  /** Rotación en mundo de cada hueso con los brazos caídos (la pose de reposo del muñeco). */
  down: Map<string, THREE.Quaternion>;
  walkSpeed: number;
  runSpeed: number;
  scale: number;
  minY: number;
}

let data: Partial<Record<Kind, KindData>> = {};
let parts: Uint8ClampedArray | null = null;
/** Parte del cuerpo de la mujer en una coordenada de textura (1 piel, 2 pelo, 3 top, 4 pantalón, 5 zapatos, 6 cara). */
export const womanPartAt = (u: number, v: number) => {
  if (!parts) return 0;
  const x = Math.min(511, Math.max(0, Math.floor(u * 512)));
  const y = Math.min(511, Math.max(0, Math.floor(v * 512)));
  return Math.round(parts[(y * 512 + x) * 4] / 36);
};
const partsTexCache = new Map<string, THREE.DataTexture>();
/**
 * La máscara de partes de la textura de ella en una textura (canal rojo = parte × 36), con las piernas
 * al aire si va con pantalón corto o mono: para recolorear cada parte en el shader (la multitud).
 */
export function womanPartsTexture(look: PersonLook) {
  if (!parts) return null;
  const k = look.jumpsuit ? 'j' : look.shorts ? 's' : '';
  let t = partsTexCache.get(k);
  if (t) return t;
  const over = look.jumpsuit ? shortSuit().mask : look.shorts ? legsMask() : null;
  const d = new Uint8Array(512 * 512);
  for (let i = 0; i < d.length; i++) d[i] = over && over[i] ? over[i] * 36 : parts[i * 4];
  t = new THREE.DataTexture(d, 512, 512, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  partsTexCache.set(k, t);
  return t;
}
let loading: Promise<void> | null = null;
let ready = false;

/** Nombre del hueso sin el prefijo de Mixamo ("mixamorigHips" → "Hips"). */
const key = (n: string) => n.replace(/^mixamorig:?/, '');

function bones(root: THREE.Object3D) {
  const list: THREE.Bone[] = [];
  // Las animaciones vienen en un esqueleto sin malla: sus huesos son nodos normales
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.name.startsWith('mixamorig')) list.push(o as THREE.Bone);
  });
  return list; // padres antes que hijos
}
function boneMap(root: THREE.Object3D) {
  return new Map(bones(root).map((b) => [key(b.name), b]));
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();

/** Gira un hueso (en mundo) para que apunte de él a su hijo en la dirección pedida. */
function aim(b: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  const root = b.parent!;
  root.updateWorldMatrix(true, true);
  b.getWorldPosition(_v1);
  child.getWorldPosition(_v2);
  const cur = _v2.sub(_v1).normalize();
  if (cur.lengthSq() < 1e-8) return;
  _q1.setFromUnitVectors(cur, dir.clone().normalize());
  b.getWorldQuaternion(_q2);
  _q2.premultiply(_q1);
  b.parent!.getWorldQuaternion(_q3);
  b.quaternion.copy(_q3.invert().multiply(_q2));
  b.updateWorldMatrix(false, true);
}

/**
 * Pone un rig en una T limpia (brazos horizontales, piernas rectas) o con los brazos caídos.
 * Todos los rigs (Xbot, Michelle, el avatar masculino) pasan por aquí, así que el retargeting
 * compara siempre la misma pose aunque cada modelo venga en T, en A o a medias.
 */
function setPose(root: THREE.Object3D, armsDown: boolean) {
  const B = boneMap(root);
  root.updateWorldMatrix(true, true);
  for (const side of ['Left', 'Right']) {
    const arm = B.get(side + 'Arm');
    if (!arm) continue;
    arm.getWorldPosition(_v1);
    B.get('Hips')!.getWorldPosition(_v2);
    const s = Math.sign(_v1.x - _v2.x) || (side === 'Left' ? 1 : -1);
    const dir = armsDown ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(s, 0, 0);
    for (const [a, b] of [['Arm', 'ForeArm'], ['ForeArm', 'Hand'], ['Hand', 'HandMiddle1']]) {
      const ba = B.get(side + a), bb = B.get(side + b);
      if (ba && bb) aim(ba, bb, dir);
    }
    for (const [a, b] of [['UpLeg', 'Leg'], ['Leg', 'Foot']]) {
      const ba = B.get(side + a), bb = B.get(side + b);
      if (ba && bb) aim(ba, bb, new THREE.Vector3(0, -1, 0));
    }
  }
}

interface Pose { q: Map<string, THREE.Quaternion>; p: Map<string, THREE.Vector3> }
function worldPose(root: THREE.Object3D): Pose {
  root.updateWorldMatrix(true, true);
  const pose: Pose = { q: new Map(), p: new Map() };
  for (const b of bones(root)) {
    pose.q.set(key(b.name), b.getWorldQuaternion(new THREE.Quaternion()));
    pose.p.set(key(b.name), b.getWorldPosition(new THREE.Vector3()));
  }
  return pose;
}
function saveLocal(root: THREE.Object3D) {
  return bones(root).map((b) => [b, b.quaternion.clone(), b.position.clone()] as const);
}
function restoreLocal(s: ReturnType<typeof saveLocal>) {
  for (const [b, q, p] of s) {
    b.quaternion.copy(q);
    b.position.copy(p);
  }
}

/** Retargeting de la prueba: rotación de cada hueso en mundo respecto a la T de cada rig. */
function retargetClip(src: THREE.Object3D, srcRest: Pose, clip: THREE.AnimationClip, dst: THREE.Object3D, dstRest: Pose, fps = 30) {
  const srcBones = boneMap(src);
  const dstBones = bones(dst).filter((b) => srcBones.has(key(b.name)) && dstRest.q.has(key(b.name)));
  const mixer = new THREE.AnimationMixer(src);
  const action = mixer.clipAction(clip).play();
  const n = Math.max(2, Math.ceil(clip.duration * fps) + 1);
  const times: number[] = [];
  const qv = new Map<string, number[]>(dstBones.map((b) => [b.name, []]));
  const pv: number[] = [];
  const k = dstRest.p.get('Hips')!.y / srcRest.p.get('Hips')!.y;
  const ws = new THREE.Quaternion(), wt = new THREE.Quaternion(), pw = new THREE.Quaternion(), loc = new THREE.Quaternion();
  const dstWorld = new Map<string, THREE.Quaternion>();
  const sp = new THREE.Vector3();
  const hips = dstBones.find((b) => key(b.name) === 'Hips')!;
  dst.updateWorldMatrix(true, true);
  for (let f = 0; f < n; f++) {
    const t = Math.min(clip.duration, f / fps);
    times.push(t);
    action.time = t;
    mixer.update(0);
    src.updateWorldMatrix(true, true);
    for (const b of dstBones) {
      const kb = key(b.name);
      srcBones.get(kb)!.getWorldQuaternion(ws);
      wt.copy(ws).multiply(_q1.copy(srcRest.q.get(kb)!).invert()).multiply(dstRest.q.get(kb)!);
      const parent = b.parent!;
      if (dstWorld.has(parent.name)) pw.copy(dstWorld.get(parent.name)!);
      else parent.getWorldQuaternion(pw);
      loc.copy(pw).invert().multiply(wt);
      qv.get(b.name)!.push(loc.x, loc.y, loc.z, loc.w);
      dstWorld.set(b.name, wt.clone());
    }
    srcBones.get('Hips')!.getWorldPosition(sp);
    const restS = srcRest.p.get('Hips')!, restD = dstRest.p.get('Hips')!;
    const target = new THREE.Vector3(restD.x + (sp.x - restS.x) * k, restD.y + (sp.y - restS.y) * k, restD.z + (sp.z - restS.z) * k);
    hips.parent!.worldToLocal(target);
    pv.push(target.x, target.y, target.z);
  }
  action.stop();
  mixer.uncacheRoot(src);
  const tracks: THREE.KeyframeTrack[] = dstBones.map((b) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, qv.get(b.name)!));
  tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, pv));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/** Velocidad a la que avanza el cuerpo en un ciclo sin desplazamiento (2 × recorrido del pie / duración). */
function strideSpeed(root: THREE.Object3D, clip: THREE.AnimationClip, scale: number) {
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(clip).play();
  const foot = boneMap(root).get('LeftFoot')!;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i <= 60; i++) {
    a.time = (clip.duration * i) / 60;
    mixer.update(0);
    root.updateWorldMatrix(true, true);
    foot.getWorldPosition(_v1);
    min = Math.min(min, _v1.z);
    max = Math.max(max, _v1.z);
  }
  a.stop();
  mixer.uncacheRoot(root);
  return (2 * (max - min) * scale) / clip.duration;
}

async function loadImageData(url: string, w: number, h: number) {
  const img = new Image();
  // onload y no decode(): decode() puede no resolverse nunca con la página en segundo plano
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('imagen ' + url));
    img.src = url;
  });
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

function prepareKind(kind: Kind, gltf: GLTF, anims: GLTF, animsBind: ReturnType<typeof saveLocal>, dance?: { clip: THREE.AnimationClip; rest: Pose; root: THREE.Object3D }): KindData {
  const model = gltf.scene;
  // Medir siempre en la misma pose: la T limpia
  const tpose = gltf.animations.find((c) => c.name === 'TPose');
  if (tpose) {
    const m = new THREE.AnimationMixer(model);
    const a = m.clipAction(tpose).play();
    m.update(0);
    a.stop();
    m.uncacheRoot(model);
  }
  setPose(model, false);
  const bind = saveLocal(model);
  const dstRest = worldPose(model);
  const box = new THREE.Box3();
  for (const p of dstRest.p.values()) box.expandByPoint(p);
  // De la planta del pie a la coronilla (el último hueso de la cabeza queda algo por debajo)
  const scale = HEIGHT[kind] / ((box.max.y - box.min.y) * 1.04);
  restoreLocal(animsBind);
  setPose(anims.scene, false);
  const srcRest = worldPose(anims.scene);
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const c of anims.animations) clips[c.name] = retargetClip(anims.scene, srcRest, c, model, dstRest);
  restoreLocal(bind);
  if (dance) clips.dance = dance.root === model ? dance.clip : retargetClip(dance.root, dance.rest, dance.clip, model, dstRest);
  restoreLocal(bind);
  setPose(model, true);
  const down = worldPose(model).q;
  restoreLocal(bind);
  return {
    gltf, clips, down, scale, minY: box.min.y,
    walkSpeed: strideSpeed(model, clips.walk, scale) || 1.4,
    runSpeed: strideSpeed(model, clips.run, scale) || 4.5,
  };
}

/** Carga los modelos y prepara las animaciones (una vez). */
export function preloadRig() {
  loading ??= (async () => {
    const [woman, man, anims] = await Promise.all([loadGLB(womanUrl), loadGLB(manUrl), loadGLB(animsUrl)]);
    parts = await loadImageData(womanPartsUrl, 512, 512);
    const samba = woman.animations.find((c) => c.name === 'SambaDance')!;
    // El baile de Michelle, respecto a su propia T
    const tp = woman.animations.find((c) => c.name === 'TPose');
    if (tp) {
      const m = new THREE.AnimationMixer(woman.scene);
      m.clipAction(tp).play();
      m.update(0);
      m.uncacheRoot(woman.scene);
    }
    const aBind = saveLocal(anims.scene);
    const wSave = saveLocal(woman.scene);
    setPose(woman.scene, false);
    const wRest = worldPose(woman.scene);
    restoreLocal(wSave);
    data = {};
    data.woman = prepareKind('woman', woman, anims, aBind, { clip: samba, rest: wRest, root: woman.scene });
    data.man = prepareKind('man', man, anims, aBind, { clip: samba, rest: wRest, root: woman.scene });
    ready = true;
  })().catch((e) => {
    failed = true;
    console.warn('[rig] no se pudieron cargar los personajes', e);
  });
  return loading;
}
export const rigReady = () => ready;
let failed = false;
/** Si los modelos no cargan, el capítulo sigue con los muñecos de siempre. */
export const rigFailed = () => failed;

// ---------- Colores de cada personaje ----------

const lin = (hex: number) => new THREE.Color(hex);
const texCache = new Map<string, THREE.Texture>();

/** Textura de Michelle recoloreada por partes (piel, pelo, camiseta, pantalón, zapatos). */
function womanTexture(src: THREE.Texture, look: PersonLook) {
  const k = `w${look.skin}.${look.hair}.${look.shirt}.${look.pants}.${look.shoes ?? 0}.${look.jumpsuit ? 'j' : look.shorts ? 's' : ''}`;
  const over = look.jumpsuit ? shortSuit().mask : look.shorts ? legsMask() : null;
  let t = texCache.get(k);
  if (t) return t;
  const img = src.image as HTMLImageElement | ImageBitmap;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, S, S);
  const id = g.getImageData(0, 0, S, S);
  const px = id.data;
  const sum = new Float64Array(7), cnt = new Float64Array(7);
  // 1 piel, 2 pelo, 3 camiseta, 4 pantalón, 5 zapatos, 6 cara (piel con menos detalle); 0 se queda igual
  const part = (i: number) => (over && over[i >> 2]) || Math.round((parts?.[i] ?? 0) / 36);
  for (let i = 0; i < px.length; i += 4) {
    const p = part(i);
    sum[p] += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    cnt[p]++;
  }
  // En sRGB, como los píxeles del lienzo
  const target = [0, look.skin, look.hair, look.shirt, look.pants, look.shoes ?? 0x2a2420, look.skin].map((h) => ({ r: ((h >> 16) & 255) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 }));
  for (let i = 0; i < px.length; i += 4) {
    const p = part(i);
    if (!p) continue;
    const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    const mean = sum[p] / Math.max(1, cnt[p]);
    const r = l / Math.max(8, mean);
    const f = p === 6 ? Math.min(1.25, Math.max(0.7, 1 + (r - 1) * 0.45)) : Math.min(1.7, Math.max(0.3, r));
    const col = target[p];
    px[i] = Math.min(255, col.r * 255 * f);
    px[i + 1] = Math.min(255, col.g * 255 * f);
    px[i + 2] = Math.min(255, col.b * 255 * f);
  }
  g.putImageData(id, 0, 0);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = src.flipY;
  t.anisotropy = 4;
  texCache.set(k, t);
  return t;
}

/** Textura en gris normalizado (media = blanco) para teñir la ropa con material.color. */
export function grayTexture(src: THREE.Texture) {
  const k = 'g' + src.uuid;
  let t = texCache.get(k);
  if (t) return t;
  const img = src.image as HTMLImageElement | ImageBitmap;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  const px = id.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
  const mean = sum / (px.length / 4);
  for (let i = 0; i < px.length; i += 4) {
    const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    const v = Math.min(255, Math.max(0, 215 + (l - mean) * 1.1));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  g.putImageData(id, 0, 0);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = src.flipY;
  texCache.set(k, t);
  return t;
}

/** Color medio (lineal) del centro de una textura: para teñir la piel de la cara sin perder detalle. */
const meanCache = new Map<string, THREE.Color>();
function meanColor(src: THREE.Texture) {
  let m = meanCache.get(src.uuid);
  if (m) return m;
  const img = src.image as HTMLImageElement | ImageBitmap;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, img.width * 0.3, img.height * 0.3, img.width * 0.4, img.height * 0.4, 0, 0, 32, 32);
  const px = g.getImageData(0, 0, 32, 32).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) {
    r += px[i];
    gg += px[i + 1];
    b += px[i + 2];
  }
  const n = (px.length / 4) * 255;
  m = new THREE.Color().setRGB(r / n, gg / n, b / n, THREE.SRGBColorSpace);
  meanCache.set(src.uuid, m);
  return m;
}

/** Tiñe el material de una pieza del modelo con los colores del personaje. false = ocultar la pieza. */
export function colorRigMaterial(kind: Kind, name: string, mat: THREE.MeshStandardMaterial, look: PersonLook): boolean {
  mat.metalness = 0;
  if (name === 'Hair') {
    mat.color = lin(look.hair);
    mat.roughness = 0.9;
    mat.normalMap = hairNormal();
    mat.normalScale = new THREE.Vector2(0.6, 0.6);
    return true;
  }
  if (kind === 'woman') {
    if (mat.map) mat.map = womanTexture(mat.map, look);
    mat.roughness = 0.75;
    return true;
  }
  // La parte de arriba del modelo es una chaqueta de esmoquin (solapas y pajarita en la textura): se
  // cambia por tela lisa de algodón, que con el corte por la cintura queda una camisa normal
  if (/Outfit_Top/.test(name) && mat.map) {
    mat.map = fabricTexture();
    mat.normalMap = null;
    mat.color = lin(look.shirt);
    mat.roughness = 0.85;
  }
  else if (/Outfit_Bottom/.test(name) && mat.map) { mat.map = grayTexture(mat.map); mat.color = lin(look.pants); }
  else if (/Footwear/.test(name) && mat.map) { mat.map = grayTexture(mat.map); mat.color = lin(look.shoes ?? 0x2a2420); }
  else if (/Wolf3D_Body/.test(name)) mat.color = lin(look.skin);
  else if (/Wolf3D_Head/.test(name) && mat.map) {
    const mc = meanColor(mat.map);
    const t = lin(look.skin);
    mat.color.setRGB(Math.min(2, t.r / mc.r), Math.min(2, t.g / mc.g), Math.min(2, t.b / mc.b));
  } else if (/Beard/.test(name)) {
    mat.color = lin(look.hair);
    if (!look.beard) return false;
  }
  mat.roughness = Math.max(mat.roughness, 0.6);
  return true;
}

let fabric: THREE.Texture | null = null;
/** Tela de algodón: un grano muy suave que se repite (no depende de cómo vengan las UV del modelo). */
function fabricTexture() {
  if (fabric) return fabric;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(64, 64);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      // Trama de tejido (hilos en las dos direcciones) con un poco de ruido
      const v = 235 + ((x + y) % 2) * 6 + Math.floor(rnd() * 12) - 6;
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  fabric = new THREE.CanvasTexture(c);
  fabric.wrapS = fabric.wrapT = THREE.RepeatWrapping;
  fabric.repeat.set(10, 10);
  fabric.colorSpace = THREE.SRGBColorSpace;
  return fabric;
}

/** Datos ya preparados de un tipo de modelo (para la multitud). */
export const rigKind = (k: Kind) => data[k]!;

// ---------- Pelo del hombre ----------

const hairCache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
/** Casquete de pelo corto: los triángulos de la cabeza por encima del nacimiento del pelo, inflados. */
export function hairGeometry(src: THREE.BufferGeometry) {
  let g = hairCache.get(src);
  if (g) return g;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const nor = src.attributes.normal as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const H = box.max.y - box.min.y;
  const zc = (box.max.z + box.min.z) / 2;
  const D = box.max.z - box.min.z;
  // Nacimiento del pelo: alto en la frente, bajo en la nuca y a la altura de las orejas a los lados
  const keep = (i: number) => {
    const y = (pos.getY(i) - box.min.y) / H;
    const z = (pos.getZ(i) - zc) / D; // -0.5 nuca … +0.5 cara
    const front = THREE.MathUtils.smoothstep(z, -0.05, 0.35);
    return y > 0.5 + 0.3 * front + 0.04 * Math.max(0, -z - 0.3);
  };
  const index = src.index ? Array.from(src.index.array) : [...Array(pos.count).keys()];
  const out: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    if (keep(a) && keep(b) && keep(c)) out.push(a, b, c);
  }
  g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) if (src.attributes[k]) g.setAttribute(k, src.attributes[k].clone());
  const p2 = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p2.count; i++) {
    const y = (pos.getY(i) - box.min.y) / H;
    const puff = 0.006 + 0.01 * THREE.MathUtils.smoothstep(y, 0.75, 1); // más volumen arriba
    p2.setXYZ(i, pos.getX(i) + nor.getX(i) * puff, pos.getY(i) + nor.getY(i) * puff, pos.getZ(i) + nor.getZ(i) * puff);
  }
  g.setIndex(out);
  hairCache.set(src, g);
  return g;
}

let hairN: THREE.Texture | null = null;
/** Relieve de mechones finos para que el pelo no parezca un casco liso. */
function hairNormal() {
  if (hairN) return hairN;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(128,128,255)';
  g.fillRect(0, 0, 256, 256);
  let sd = 11;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * 256, y = rnd() * 256, l = 6 + rnd() * 18;
    const v = rnd() < 0.5 ? 90 : 166;
    g.strokeStyle = `rgba(${v},128,255,0.5)`;
    g.lineWidth = 1 + rnd();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y + l);
    g.stroke();
  }
  hairN = new THREE.CanvasTexture(c);
  hairN.wrapS = hairN.wrapT = THREE.RepeatWrapping;
  return hairN;
}

// ---------- Personaje ----------

type Group = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';

export interface Rig {
  kind: Kind;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  act: Record<string, THREE.AnimationAction>;
  w: Record<string, number>;
  mode: PersonMode;
  snap: Map<THREE.Object3D, [number, number, number]>;
  snapBodyY: number;
  gw: Record<Group, number>;
  bones: Map<string, THREE.Bone>;
  map: [THREE.Object3D, string, Group][];
  hipsY: number;
  last: THREE.Vector3;
  speed: number;
  /** Partes del cuerpo que mandan siempre las articulaciones del muñeco (p. ej. un jinete sentado). */
  force?: Partial<Record<Group, number>>;
  /** Altura de la cadera en reposo, en metros (sin la escala del personaje). */
  hipsHeight: number;
  /** Inclinación de cintura para arriba (ver leanTorso). */
  torso: THREE.Euler;
}

const people = new Set<Person>();
/** Tiempo común de la multitud horneada (crowdRig.ts). */
export const vatTime = { value: 0 };
/** Otras cosas animadas de los capítulos con glTF (los ases): se actualizan con los personajes. */
export const rigTickers = new Set<(dt: number) => void>();
/** Retoques después de animar a todos (abrazos y besos: manos que se apoyan en el otro). */
export const rigPost = new Set<(dt: number) => void>();

/** Ejes del personaje (x a su izquierda, y arriba, z adelante) pegados al hueso, en mundo. */
export function boneFrame(p: Person, bone: string, out: THREE.Quaternion) {
  const r = p.rig!;
  r.bones.get(bone)!.getWorldQuaternion(out);
  return out.multiply(_q3.copy(data[r.kind]!.down.get(bone)!).invert());
}

/** Crea un personaje glTF con las mismas articulaciones (invisibles) que el muñeco de siempre. */
export function makeRigPerson(look: PersonLook, scale: number, blob: THREE.Object3D): Person {
  const kind: Kind = look.male || look.beard ? 'man' : 'woman';
  const D = data[kind]!;
  const root = new THREE.Group();
  root.userData.noCam = true; // se mueve: la cámara no choca con ello
  const model = SkeletonUtils.clone(D.gltf.scene);
  model.scale.setScalar(D.scale);
  model.position.y = -D.minY * D.scale;
  root.add(model);

  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (colorRigMaterial(kind, m.name, mat, look) === false) m.visible = false;
    m.material = mat;
    // La parte de arriba del modelo de hombre es una chaqueta con faldones (parecía un chaqué): a él
    // siempre se le recortan por la cintura y queda una camisa; la de rayas es la camiseta del Barça
    if ((look.stripes || kind === 'man') && /Outfit_Top/.test(m.name) && (m as THREE.SkinnedMesh).isSkinnedMesh) {
      const tee = teeFor(m as THREE.SkinnedMesh, kind);
      m.userData.restSrc = m.geometry;
      m.geometry = tee.geo;
      if (look.stripes) stripes(mat, tee.axis, tee.period, look.stripes);
    }
    // Ropa de verano: pantalón corto y manga corta (a ella se lo pinta su textura)
    if (kind === 'man' && look.shorts && /Outfit_(Bottom|Top)/.test(m.name) && (m as THREE.SkinnedMesh).isSkinnedMesh) {
      const rest = restHeights(m as THREE.SkinnedMesh, kind, m.userData.restSrc);
      if (m.geometry.attributes.position === rest.attributes.position) m.geometry = rest;
      else m.geometry.setAttribute('aRest', rest.attributes.aRest);
      bareShader(mat, look.skin, /Bottom/.test(m.name) ? 'legs' : 'arms');
    }
    if (kind === 'woman' && (look.jumpsuit || look.shorts) && (m as THREE.SkinnedMesh).isSkinnedMesh) m.geometry = shortSuit().geo.get(m.geometry.uuid) ?? m.geometry;
  });

  const B = boneMap(model);
  // Pelo corto del hombre (el avatar viene sin pelo, era para un sombrero): una copia algo
  // inflada de la parte de arriba de la cabeza, con el mismo esqueleto
  if (kind === 'man') {
    let head: THREE.SkinnedMesh | null = null;
    model.traverse((o) => {
      if (/Wolf3D_Head/.test(o.name) && (o as THREE.SkinnedMesh).isSkinnedMesh) head = o as THREE.SkinnedMesh;
    });
    if (head) {
      const hm = head as THREE.SkinnedMesh;
      const hmat = new THREE.MeshStandardMaterial();
      colorRigMaterial(kind, 'Hair', hmat, look);
      const hair = new THREE.SkinnedMesh(hairGeometry(hm.geometry), hmat);
      hair.castShadow = true;
      hair.frustumCulled = false;
      hm.parent!.add(hair);
      hair.bind(hm.skeleton, hm.bindMatrix);
    }
  }

  // Articulaciones del muñeco (invisibles): las mueve animatePerson y el código de los niveles
  const body = new THREE.Group();
  const headJ = new THREE.Group();
  headJ.position.y = 1.3;
  const eyes = new THREE.Group();
  eyes.position.y = 0.33;
  headJ.add(eyes);
  body.add(headJ);
  const limb = (x: number, y: number, l1: number, l2: number) => {
    const a = new THREE.Group();
    a.position.set(x, y, 0);
    const b = new THREE.Group();
    b.position.y = -l1;
    a.add(b);
    const c = new THREE.Group();
    c.position.y = -l2;
    b.add(c);
    body.add(a);
    return [a, b, c] as const;
  };
  const [legL, kneeL, footL] = limb(-0.11, 0.66, 0.26, 0.25);
  const [legR, kneeR, footR] = limb(0.11, 0.66, 0.26, 0.25);
  const [armL, elbowL] = limb(-0.29, 1.17, 0.24, 0.24);
  const [armR, elbowR] = limb(0.29, 1.17, 0.24, 0.24);
  root.add(body);
  root.add(blob);
  root.scale.setScalar(scale);

  // Lado de cada hueso: el del muñeco en -x es el hueso del modelo que queda en -x
  model.updateWorldMatrix(true, true);
  const sideOf = (n: string) => B.get(n)!.getWorldPosition(new THREE.Vector3()).x;
  const neg = sideOf('LeftArm') < 0 ? 'Left' : 'Right';
  const pos = neg === 'Left' ? 'Right' : 'Left';

  // Mano para llevar cosas (en el lado de armR): -y del muñeco = a lo largo de los dedos
  const hand = B.get(pos + 'Hand')!;
  const handR = new THREE.Object3D();
  hand.add(handR);
  {
    const ws = hand.getWorldScale(new THREE.Vector3());
    handR.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
    // Ejes del personaje con los brazos caídos (la pose de reposo del muñeco)
    handR.quaternion.copy(D.down.get(pos + 'Hand')!).invert();
    handR.position.set(0, 0.05 / ws.y, 0);
  }

  const map: [THREE.Object3D, string, Group][] = [
    [body, 'Hips', 'body'],
    [headJ, 'Head', 'head'],
    [armL, neg + 'Arm', 'armL'], [elbowL, neg + 'ForeArm', 'armL'],
    [armR, pos + 'Arm', 'armR'], [elbowR, pos + 'ForeArm', 'armR'],
    [legL, neg + 'UpLeg', 'legL'], [kneeL, neg + 'Leg', 'legL'], [footL, neg + 'Foot', 'legL'],
    [legR, pos + 'UpLeg', 'legR'], [kneeR, pos + 'Leg', 'legR'], [footR, pos + 'Foot', 'legR'],
  ];

  const mixer = new THREE.AnimationMixer(model);
  const act: Record<string, THREE.AnimationAction> = {};
  for (const n of ['idle', 'walk', 'run', 'dance', 'agree']) act[n] = mixer.clipAction(D.clips[n]).play();
  const air = mixer.clipAction(D.clips.run.clone());
  air.play();
  air.time = D.clips.run.duration * 0.3;
  air.timeScale = 0;
  act.air = air;
  const w: Record<string, number> = { idle: 1, walk: 0, run: 0, dance: 0, agree: 0, air: 0 };
  for (const k in act) act[k].setEffectiveWeight(w[k]);
  act.idle.time = Math.random() * D.clips.idle.duration;
  act.dance.time = Math.random() * D.clips.dance.duration;

  const rig: Rig = {
    kind, model, mixer, act, w, mode: 'idle', snap: new Map(), snapBodyY: 0,
    gw: { body: 0, head: 0, armL: 0, armR: 0, legL: 0, legR: 0 },
    bones: B, map, hipsY: B.get('Hips')!.position.y, last: new THREE.Vector3(NaN, 0, 0), speed: 0, torso: new THREE.Euler(0, 0, 0, 'YXZ'),
    hipsHeight: B.get('Hips')!.getWorldPosition(new THREE.Vector3()).y / scale,
  };
  const p: Person = {
    root, body, head: headJ, eyes, legL, legR, armL, armR, handR,
    kneeL, kneeR, footL, footR, elbowL, elbowR,
    blink: 2 + Math.random() * 3, t: Math.random() * 10, rig,
  };
  if (kind === 'woman' && look.hairStyle === 'straight') straightHair(p, look);
  if (kind === 'man' && (look.curls || look.stache)) gasFace(p, look);
  people.add(p);
  return p;
}

/** Matriz de un vértice con el esqueleto en su pose actual, de la geometría al mundo. */
function skinMatrix(m: THREE.SkinnedMesh, i: number) {
  const g = m.geometry, si = g.attributes.skinIndex as THREE.BufferAttribute, sw = g.attributes.skinWeight as THREE.BufferAttribute;
  const acc = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const t = new THREE.Matrix4();
  for (let k = 0; k < 4; k++) {
    const wt = sw.getComponent(i, k);
    if (!wt) continue;
    const bi = si.getComponent(i, k);
    t.multiplyMatrices(m.skeleton.bones[bi].matrixWorld, m.skeleton.boneInverses[bi]);
    for (let e = 0; e < 16; e++) acc.elements[e] += t.elements[e] * wt;
  }
  return new THREE.Matrix4().multiplyMatrices(m.matrixWorld, m.bindMatrixInverse).multiply(acc).multiply(m.bindMatrix);
}

// ---------- Pantalón corto ----------

let legs: Uint8Array | null = null;
/** Solo las piernas del mono corto (sin taparle la barriga): pantalón corto de ella. */
function legsMask() {
  legs ??= shortSuit().mask.map((v) => (v === 6 ? 6 : 0));
  return legs;
}


const restCache = new Map<string, THREE.BufferGeometry>();
/** La geometría con, para cada vértice en la pose de carga, su altura (0 pies … 1 cabeza) y lo lejos que está del centro (los brazos) como atributo aRest. */
function restHeights(m: THREE.SkinnedMesh, kind: Kind, srcGeo: THREE.BufferGeometry = m.geometry) {
  const hit = restCache.get(srcGeo.uuid);
  if (hit) return hit;
  const src = data[kind]!.gltf.scene;
  let orig: THREE.SkinnedMesh | null = null;
  src.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).geometry === srcGeo) orig = o as THREE.SkinnedMesh;
  });
  src.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  src.traverse((q) => {
    if ((q as THREE.Mesh).isMesh) box.expandByObject(q);
  });
  const pos = srcGeo.attributes.position as THREE.BufferAttribute;
  const r = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3();
  const H = box.max.y - box.min.y || 1, cx = (box.max.x + box.min.x) / 2;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(skinMatrix((orig ?? m) as THREE.SkinnedMesh, i));
    r[i * 2] = (v.y - box.min.y) / H;
    r[i * 2 + 1] = Math.abs(v.x - cx) / H;
  }
  const geo = srcGeo.clone();
  geo.setAttribute('aRest', new THREE.BufferAttribute(r, 2));
  restCache.set(srcGeo.uuid, geo);
  return geo;
}

/**
 * Ropa de verano pintada en el shader: pantalón corto (por debajo de medio muslo, piel) o manga corta
 * (en los brazos, lejos del cuerpo, piel; y sin faldones de chaqueta). Necesita el atributo aRest (altura, distancia al centro).
 */
export function bareShader(mat: THREE.Material, skin: number, part: 'legs' | 'arms') {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey.bind(mat);
  const cond = part === 'legs' ? 'vRest.x < 0.37' : 'vRest.y > 0.15';
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.bareSkin = { value: lin(skin) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRest;\nvarying vec2 vRest;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvRest = aRest;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 bareSkin;\nvarying vec2 vRest;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>\n${part === 'arms' ? 'if (vRest.x < 0.53) discard;' : ''}\nif (${cond}) diffuseColor.rgb = bareSkin * 0.92;`);
  };
  mat.customProgramCacheKey = () => prevKey() + '|bare-' + part;
}

/** Sin los faldones de la chaqueta del modelo de hombre (lo de debajo de la cintura): una camisa normal. */
export function noTails(mat: THREE.Material) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    if (sh.fragmentShader.includes('varying vec2 vRest;')) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\nif (vRest.x < 0.53) discard;');
      return;
    }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRest;\nvarying vec2 vRest;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvRest = aRest;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRest;').replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\nif (vRest.x < 0.53) discard;');
  };
  mat.customProgramCacheKey = () => prevKey() + '|notails';
}

// ---------- Camiseta a rayas (la del Barça) ----------

const teeCache = new Map<string, { geo: THREE.BufferGeometry; axis: string; period: number }>();
/**
 * Camiseta de fútbol sobre la chaqueta del modelo: fuera los faldones (lo que cuelga por debajo de
 * la cintura) y rayas verticales. Medido con el esqueleto del modelo original en su pose de carga.
 */
function teeFor(m: THREE.SkinnedMesh, kind: Kind) {
  const src = data[kind]!.gltf.scene;
  let orig: THREE.SkinnedMesh | null = null;
  src.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).geometry === m.geometry) orig = o as THREE.SkinnedMesh;
  });
  let c = teeCache.get(m.geometry.uuid);
  if (c) return c;
  const geo0 = m.geometry;
  const o = (orig ?? m) as THREE.SkinnedMesh;
  src.updateWorldMatrix(true, true);
  const pos = geo0.attributes.position as THREE.BufferAttribute;
  const w = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(skinMatrix(o, i)));
  const box = new THREE.Box3();
  src.traverse((q) => {
    if ((q as THREE.Mesh).isMesh) box.expandByObject(q);
  });
  const H = box.max.y - box.min.y || 1;
  const hOf = (v: THREE.Vector3) => (v.y - box.min.y) / H;
  // Cintura: el borde de abajo de la camiseta
  const WAIST = 0.53;
  const index = geo0.index ? Array.from(geo0.index.array) : [...Array(pos.count).keys()];
  const out: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, cc] = [index[t], index[t + 1], index[t + 2]];
    if ((hOf(w[a]) + hOf(w[b]) + hOf(w[cc])) / 3 > WAIST) out.push(a, b, cc);
  }
  const geo = geo0.clone();
  geo.setIndex(out);
  // Eje de lado a lado en el espacio de la geometría: el que más cambia de un hombro al otro
  // (con un vértice del pecho, que solo mueve la espalda)
  const cx = (box.max.x + box.min.x) / 2;
  let chest = 0, best = Infinity;
  w.forEach((v, i) => {
    const d = Math.abs(hOf(v) - 0.68) * 4 + Math.abs(v.x - cx) / H;
    if (d < best) { best = d; chest = i; }
  });
  const inv = skinMatrix(o, chest).invert();
  const l = new THREE.Vector3(1, 0, 0).transformDirection(inv);
  const ax = Math.abs(l.x) >= Math.abs(l.y) && Math.abs(l.x) >= Math.abs(l.z) ? 'x' : Math.abs(l.y) >= Math.abs(l.z) ? 'y' : 'z';
  // Ancho de una raya: unos 4,5 cm en metros del mundo, pasado a unidades de la geometría
  const unit = new THREE.Vector3().setFromMatrixScale(skinMatrix(o, chest)).x || 1;
  c = { geo, axis: ax, period: 0.09 / unit };
  teeCache.set(geo0.uuid, c);
  return c;
}

/** Rayas verticales de dos colores sobre la camiseta. */
function stripes(mat: THREE.MeshStandardMaterial, axis: string, period: number, [a, b]: [number, number]) {
  mat.color.set(0xffffff);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.stA = { value: new THREE.Color(a) };
    sh.uniforms.stB = { value: new THREE.Color(b) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vStripe;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvStripe = position.${axis} / ${period.toFixed(6)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vStripe;\nuniform vec3 stA;\nuniform vec3 stB;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat sf = fract(vStripe);\ndiffuseColor.rgb *= mix(stA, stB, smoothstep(0.46, 0.54, sf) - smoothstep(0.96, 1.0, sf));');
  };
  mat.customProgramCacheKey = () => 'stripes' + a + b + axis;
}


// ---------- Mono corto ----------

let short: { mask: Uint8Array; geo: Map<string, THREE.BufferGeometry> } | null = null;
/**
 * Mono negro corto (Ferreries): tapa la barriga que deja ver el top de Michelle y deja las piernas
 * al aire desde medio muslo. Las perneras anchas del pantalón se ciñen a la forma de la pierna y su
 * textura pasa a ser piel; la barriga pasa a ser tela. Se calcula una vez para todas.
 */
function shortSuit() {
  if (short) return short;
  const mask = new Uint8Array(512 * 512);
  const geo = new Map<string, THREE.BufferGeometry>();
  short = { mask, geo };
  const scene = data.woman?.gltf.scene;
  if (!scene || !parts) return short;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.lineWidth = 2;
  const hc = document.createElement('canvas');
  hc.width = hc.height = 512;
  const hg = hc.getContext('2d', { willReadFrequently: true })!;
  hg.lineWidth = 1.5;
  scene.updateWorldMatrix(true, true);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && m.geometry.attributes.uv) meshes.push(m);
  });
  const box = new THREE.Box3();
  const MS = meshes.map(() => [] as THREE.Matrix4[]);
  const skinM = skinMatrix;
  const W = meshes.map((m, mi) => {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const w: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const M = skinM(m, i);
      MS[mi].push(M);
      w.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(M));
    }
    w.forEach((v) => box.expandByPoint(v));
    return w;
  });
  const H = box.max.y - box.min.y;
  const cx = (box.max.x + box.min.x) / 2;
  const hOf = (v: THREE.Vector3) => (v.y - box.min.y) / H;
  const HEM = 0.455; // a medio muslo
  // Grosor de la pierna (radio respecto a la altura) del muslo al tobillo
  const legR = (h: number) => H * (h > 0.3 ? THREE.MathUtils.lerp(0.034, 0.05, (h - 0.3) / (HEM - 0.3)) : h > 0.17 ? THREE.MathUtils.lerp(0.03, 0.034, (h - 0.17) / 0.13) : THREE.MathUtils.lerp(0.02, 0.03, Math.max(0, h - 0.05) / 0.12));
  meshes.forEach((m, mi) => {
    const src = m.geometry;
    const uv = src.attributes.uv as THREE.BufferAttribute;
    const pos = src.attributes.position as THREE.BufferAttribute;
    const w = W[mi];
    const partOf = (i: number) => {
      const x = Math.min(511, Math.max(0, Math.floor(uv.getX(i) * 512)));
      const y = Math.min(511, Math.max(0, Math.floor(uv.getY(i) * 512)));
      return Math.round(parts![(y * 512 + x) * 4] / 36);
    };
    const pt = Array.from({ length: pos.count }, (_, i) => partOf(i));
    // Texturas: perneras por debajo del dobladillo → piel; barriga → tela del mono
    const index = src.index ? Array.from(src.index.array) : [...Array(pos.count).keys()];
    for (let t = 0; t < index.length; t += 3) {
      const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
      const h = (hOf(w[a]) + hOf(w[b]) + hOf(w[c])) / 3;
      const ax = Math.abs((w[a].x + w[b].x + w[c].x) / 3 - cx) / H;
      let to = 0;
      if (pt[a] === 4 && pt[b] === 4 && pt[c] === 4) {
        // Altura de cada píxel del pantalón (función lineal en el triángulo = degradado lineal): el
        // dobladillo sale recto y no en dientes de sierra como los triángulos
        const P = [a, b, c].map((q) => [uv.getX(q) * 512, uv.getY(q) * 512, hOf(w[q])]);
        const [x0, y0, h0] = P[0], [x1, y1, h1] = P[1], [x2, y2, h2] = P[2];
        const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        let gx = 0, gy = 0;
        if (Math.abs(det) > 1e-6) {
          gx = ((h1 - h0) * (y2 - y0) - (h2 - h0) * (y1 - y0)) / det;
          gy = ((h2 - h0) * (x1 - x0) - (h1 - h0) * (x2 - x0)) / det;
        }
        const g2 = gx * gx + gy * gy;
        if (g2 > 1e-12) {
          const s0 = -h0 / g2, s1 = (1 - h0) / g2;
          const gr = hg.createLinearGradient(x0 + gx * s0, y0 + gy * s0, x0 + gx * s1, y0 + gy * s1);
          gr.addColorStop(0, 'rgb(0,255,0)');
          gr.addColorStop(1, 'rgb(255,255,0)');
          hg.fillStyle = hg.strokeStyle = gr;
        } else hg.fillStyle = hg.strokeStyle = `rgb(${Math.round(h0 * 255)},255,0)`;
        hg.beginPath();
        hg.moveTo(x0, y0);
        hg.lineTo(x1, y1);
        hg.lineTo(x2, y2);
        hg.closePath();
        hg.fill();
        hg.stroke();
        continue;
      } else if (pt[a] === 1 && pt[b] === 1 && pt[c] === 1 && h > 0.5 && h < 0.69 && ax < 0.1) to = 3;
      if (!to) continue;
      g.fillStyle = g.strokeStyle = `rgb(${to * 36},0,0)`;
      g.beginPath();
      g.moveTo(uv.getX(a) * 512, uv.getY(a) * 512);
      g.lineTo(uv.getX(b) * 512, uv.getY(b) * 512);
      g.lineTo(uv.getX(c) * 512, uv.getY(c) * 512);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // Perneras ceñidas: cada vértice del pantalón bajo el dobladillo se acerca al eje de su pierna
    const BIN = 0.015;
    const stat = new Map<string, { x: number; z: number; n: number; r: number }>();
    const key = (v: THREE.Vector3) => `${v.x > cx ? 1 : 0}:${Math.floor(hOf(v) / BIN)}`;
    for (let i = 0; i < pos.count; i++) {
      if (pt[i] !== 4 || hOf(w[i]) >= HEM + 0.03) continue;
      const k = key(w[i]);
      const st = stat.get(k) ?? { x: 0, z: 0, n: 0, r: 0 };
      st.x += w[i].x; st.z += w[i].z; st.n++;
      stat.set(k, st);
    }
    for (const st of stat.values()) { st.x /= st.n; st.z /= st.n; }
    for (let i = 0; i < pos.count; i++) {
      if (pt[i] !== 4 || hOf(w[i]) >= HEM + 0.03) continue;
      const st = stat.get(key(w[i]))!;
      st.r = Math.max(st.r, Math.hypot(w[i].x - st.x, w[i].z - st.z));
    }
    const out = src.clone();
    const op = out.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      if (pt[i] !== 4) continue;
      const h = hOf(w[i]);
      if (h >= HEM + 0.03) continue;
      const st = stat.get(key(w[i]))!;
      const k = Math.min(1, legR(Math.min(h, HEM)) / Math.max(1e-4, st.r));
      const blend = THREE.MathUtils.smoothstep(HEM + 0.03 - h, 0, 0.03); // sin escalón en el dobladillo
      const f = 1 + (k - 1) * blend;
      v.set(st.x + (w[i].x - st.x) * f, w[i].y, st.z + (w[i].z - st.z) * f).applyMatrix4(MS[mi][i].clone().invert());
      op.setXYZ(i, v.x, v.y, v.z);
    }
    out.computeVertexNormals();
    geo.set(src.uuid, out);
  });
  const px = g.getImageData(0, 0, 512, 512).data;
  const hp = hg.getImageData(0, 0, 512, 512).data;
  for (let i = 0; i < mask.length; i++) {
    mask[i] = px[i * 4] > 70 ? 3 : 0; // bordes suavizados del lienzo
    if (hp[i * 4 + 1] > 128 && hp[i * 4] / 255 < HEM) mask[i] = 6; // piel lisa, sin los pliegues del vaquero
  }
  return short;
}

// ---------- Melena lisa ----------

const noHairCache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
/** La misma malla sin los triángulos del pelo de Michelle (los dos moños). */
function withoutHair(src: THREE.BufferGeometry) {
  let g = noHairCache.get(src);
  if (g) return g;
  const uv = src.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv || !parts) return src;
  const isHair = (i: number) => {
    const x = Math.min(511, Math.max(0, Math.floor(uv.getX(i) * 512)));
    const y = Math.min(511, Math.max(0, Math.floor(uv.getY(i) * 512)));
    return Math.round(parts![(y * 512 + x) * 4] / 36) === 2;
  };
  const index = src.index ? Array.from(src.index.array) : [...Array(src.attributes.position.count).keys()];
  const out: number[] = [];
  for (let t = 0; t < index.length; t += 3) if (!(isHair(index[t]) && isHair(index[t + 1]) && isHair(index[t + 2]))) out.push(index[t], index[t + 1], index[t + 2]);
  g = src.clone();
  g.setIndex(out);
  noHairCache.set(src, g);
  return g;
}

/** Puntos de una parte del modelo (por la textura de partes) en los ejes de un ancla de hueso. */
function partPointsIn(p: Person, anchor: THREE.Object3D, bone: string, part: number) {
  const out: THREE.Vector3[] = [];
  const b = p.rig!.bones.get(bone)!;
  anchor.updateMatrix();
  const invA = anchor.matrix.clone().invert();
  p.rig!.model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !parts) return;
    const bi = m.skeleton.bones.indexOf(b as THREE.Bone);
    if (bi < 0) return;
    const uv = m.geometry.attributes.uv as THREE.BufferAttribute | undefined;
    if (!uv) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const toBone = m.skeleton.boneInverses[bi].clone().multiply(m.bindMatrix);
    for (let i = 0; i < pos.count; i += 2) {
      const x = Math.min(511, Math.max(0, Math.floor(uv.getX(i) * 512)));
      const y = Math.min(511, Math.max(0, Math.floor(uv.getY(i) * 512)));
      if (Math.round(parts[(y * 512 + x) * 4] / 36) !== part) continue;
      out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toBone).applyMatrix4(invA));
    }
  });
  return out;
}

/**
 * Melena lisa, rubia y a la altura de los hombros (Margaux): quita los moños del modelo y pone en
 * la cabeza una melena con raya al lado, que deja la cara al aire y cae por detrás y por los lados.
 */
function straightHair(p: Person, look: PersonLook) {
  p.rig!.model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) m.geometry = withoutHair(m.geometry);
  });
  const anchor = boneAnchor(p, 'Head');
  const face = partPointsIn(p, anchor, 'Head', 6);
  if (face.length < 20) return;
  const box = new THREE.Box3().setFromPoints(face);
  const c = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  if ((window as unknown as { __hairDbg?: unknown[] }).__hairDbg) (window as unknown as { __hairDbg: unknown[] }).__hairDbg.push({ n: face.length, min: box.min.toArray(), max: box.max.toArray() });
  // Cráneo: tan ancho como la cara, algo más hondo, con el centro un poco detrás de ella
  const rx = sz.x * 0.56, ry = sz.y * 0.5, rz = Math.max(sz.z, sz.x) * 0.56;
  const cx = c.x, cy = c.y + sz.y * 0.08, cz = c.z - rz * 0.18;
  const A = 48, S = 30;
  const pos: number[] = [], idx: number[] = [], col: number[] = [], uvs: number[] = [];
  const keep: boolean[] = [];
  const hair = new THREE.Color(look.hair);
  const root = hair.clone().multiplyScalar(0.72);
  const tipLen = sz.y * 0.95; // por debajo de la oreja, hasta los hombros
  for (let j = 0; j <= S; j++) {
    const s = j / S;
    for (let i = 0; i <= A; i++) {
      const a = (i / A) * Math.PI * 2; // 0 = delante (+z)
      const sa = Math.sin(a), ca = Math.cos(a);
      let x: number, y: number, z: number;
      // Raya al lado: el pelo cae algo más por la izquierda
      const part = 1 + 0.06 * Math.sin(a + 0.6);
      if (s < 0.5) {
        const phi = (s / 0.5) * (Math.PI / 2); // de la coronilla al ecuador
        x = cx + sa * Math.sin(phi) * rx * 1.1 * part;
        y = cy + Math.cos(phi) * ry * 1.12;
        z = cz + ca * Math.sin(phi) * rz * 1.1 * part;
      } else {
        const t = (s - 0.5) / 0.5; // cae recto, abriéndose un poco y metiéndose hacia dentro en las puntas
        const flare = 1.1 + 0.16 * Math.sin(t * Math.PI * 0.8) - 0.05 * t * t;
        x = cx + sa * rx * flare * part;
        y = cy - t * tipLen - (Math.abs(ca) < 0.3 ? 0 : 0.02 * t) ;
        z = cz + ca * rz * flare * part - 0.02 * t;
      }
      pos.push(x, y, z);
      uvs.push((i / A) * 6, s * 3);
      // Fuera la cara: por delante, por debajo de la línea de la frente
      const front = ca; // 1 = justo delante
      const hairline = cy + ry * (0.55 - 0.25 * Math.max(0, 1 - Math.abs(a - Math.PI * 0.12) / 0.9)); // flequillo ladeado
      keep.push(!(front > 0.42 && y < hairline));
      const k = Math.min(1, s * 1.6);
      const cc = root.clone().lerp(hair, k).multiplyScalar(0.92 + 0.16 * Math.sin(i * 2.7) * Math.sin(i * 1.3));
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let j = 0; j < S; j++)
    for (let i = 0; i < A; i++) {
      const a = j * (A + 1) + i, b = a + A + 1;
      if (keep[a] && keep[a + 1] && keep[b] && keep[b + 1]) idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, normalMap: hairNormal(), normalScale: new THREE.Vector2(0.8, 0.8) });
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  anchor.add(mesh);
}

/** Vértices de las mallas que cumplen `test`, en el espacio de un ancla de hueso (pose de reposo). */
function meshPointsIn(p: Person, anchor: THREE.Object3D, bone: string, test: (name: string) => boolean) {
  const out: THREE.Vector3[] = [];
  const b = p.rig!.bones.get(bone)!;
  anchor.updateMatrix();
  const invA = anchor.matrix.clone().invert();
  p.rig!.model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !test(m.name)) return;
    const bi = m.skeleton.bones.indexOf(b as THREE.Bone);
    if (bi < 0) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const toBone = m.skeleton.boneInverses[bi].clone().multiply(m.bindMatrix);
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toBone).applyMatrix4(invA));
  });
  return out;
}

/**
 * Gas, sacado de las fotos: rizos castaños con volumen arriba (sobre el pelo corto del modelo) y
 * bigote fino con perilla. Los rizos son bolitas de pelo fusionadas en una sola malla.
 */
function gasFace(p: Person, look: PersonLook) {
  const anchor = boneAnchor(p, 'Head');
  const pts = meshPointsIn(p, anchor, 'Head', (n) => /Wolf3D_Head/.test(n));
  if (pts.length < 50) return;
  const box = new THREE.Box3().setFromPoints(pts);
  const c = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  const hair = new THREE.Color(look.hair);
  const parts: THREE.BufferGeometry[] = [];
  const ball = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz2 = 1, col = hair) => {
    const g = new THREE.SphereGeometry(r, 9, 7);
    g.scale(sx, sy, sz2);
    g.translate(x, y, z);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    parts.push(g);
  };
  if (look.curls) {
    // Una sola masa de pelo con relieve de rizos (ruido 3D) y más oscura en los huecos: se lee como
    // pelo rizado, no como bolitas. Volumen arriba y delante (el tupé de las fotos), lados pegados
    const rx = sz.x * 0.55, ry = sz.y * 0.5, rz = Math.max(sz.z, sz.x) * 0.56;
    const cx = c.x, cy = c.y + sz.y * 0.06, cz = c.z - rz * 0.12;
    const hash = (x: number, y: number, z: number) => {
      const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
      return h - Math.floor(h);
    };
    const vnoise = (x: number, y: number, z: number) => {
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      const fx = x - ix, fy = y - iy, fz = z - iz;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
      const L = (a: number, b: number, t: number) => a + (b - a) * t;
      return L(
        L(L(hash(ix, iy, iz), hash(ix + 1, iy, iz), u), L(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v),
        L(L(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u), L(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v),
        w,
      );
    };
    const A = 72, S = 44;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const keep: boolean[] = [];
    const tone = new THREE.Color();
    for (let j = 0; j <= S; j++) {
      const phi = (j / S) * Math.PI * 0.72; // de la coronilla hasta algo por debajo del ecuador
      for (let i = 0; i <= A; i++) {
        const th = (i / A) * Math.PI * 2; // 0 = delante (+z)
        const d = new THREE.Vector3(Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th));
        const top = Math.max(0, d.y);
        const side = Math.abs(d.x) > 0.55 && d.y < 0.5;
        // Rizos: dos escalas de ruido, en bultos redondeados
        const n = vnoise(d.x * 11 + 3, d.y * 11, d.z * 11) * 0.62 + vnoise(d.x * 23, d.y * 23 + 7, d.z * 23) * 0.38;
        const bump = Math.pow(n, 1.6);
        const lift = (side ? 1.0 : 1.02 + top * top * 0.2 + (d.z > 0.1 && d.y > 0.35 ? 0.07 : 0)) + bump * (side ? 0.06 : 0.16);
        pos.push(cx + d.x * rx * lift, cy + d.y * ry * lift + 0.006, cz + d.z * rz * lift);
        tone.copy(hair).multiplyScalar(0.45 + bump * 0.9);
        col.push(tone.r, tone.g, tone.b);
        keep.push(!(d.z > 0.3 && d.y < 0.42) && !(d.y < -0.05 && d.z > -0.55));
      }
    }
    for (let j = 0; j < S; j++)
      for (let i = 0; i < A; i++) {
        const a = j * (A + 1) + i, b = a + A + 1;
        if (keep[a] && keep[a + 1] && keep[b] && keep[b + 1]) idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const curls = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    curls.castShadow = true;
    curls.userData.person = true;
    anchor.add(curls);
  }
  if (look.stache) {
    // Perfil de la cara por el centro: la nariz es lo que más sale; la barbilla, lo más bajo de delante
    const mid = pts.filter((q) => Math.abs(q.x - c.x) < sz.x * 0.06);
    const nose = mid.reduce((a, q) => (q.z > a.z ? q : a), mid[0]);
    const front = mid.filter((q) => q.z > nose.z - sz.z * 0.35);
    const chin = front.reduce((a, q) => (q.y < a.y ? q : a), front[0]);
    const faceZ = (y: number) => front.filter((q) => Math.abs(q.y - y) < sz.y * 0.03).reduce((a, q) => Math.max(a, q.z), -Infinity);
    const dark = hair.clone().multiplyScalar(0.85);
    // Bigote fino justo encima del labio, casi pegado a la piel
    const my = nose.y - (nose.y - chin.y) * 0.21;
    const mz = faceZ(my);
    if (isFinite(mz)) {
      ball(0.012, c.x - 0.012, my, mz - 0.003, 1.45, 0.34, 0.4, dark);
      ball(0.012, c.x + 0.012, my, mz - 0.003, 1.45, 0.34, 0.4, dark);
    }
    // Perilla: una mancha corta en la barbilla, sin salir de la cara
    const gy = chin.y + (nose.y - chin.y) * 0.12;
    const gz = faceZ(gy);
    if (isFinite(gz)) ball(0.013, c.x, gy, gz - 0.006, 0.8, 1.0, 0.32, dark);
  }
  if (!parts.length) return;
  const geo = mergeGeometries(parts);
  if (!geo) return;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  mesh.castShadow = true;
  mesh.userData.person = true;
  anchor.add(mesh);
}

/**
 * Punto pegado a un hueso (Head, Hips, Spine2...) con los ejes del personaje en reposo y en metros:
 * para colgar sombreros, delantales o un tambor que sigan al cuerpo animado.
 */
export function boneAnchor(p: Person, bone: string) {
  const r = p.rig!;
  const b = r.bones.get(bone)!;
  const a = new THREE.Object3D();
  b.add(a);
  p.root.updateWorldMatrix(true, true);
  const ws = b.getWorldScale(new THREE.Vector3()).divide(p.root.getWorldScale(new THREE.Vector3()));
  a.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  a.quaternion.copy(data[r.kind]!.down.get(bone)!).invert();
  return a;
}

const TORSO: [string, number][] = [['Spine', 0.4], ['Spine1', 0.3], ['Spine2', 0.3]];
const _torsoE = new THREE.Euler(0, 0, 0, 'YXZ');
const _torsoQ = new THREE.Quaternion();
const _torsoW = new THREE.Quaternion();

const JOINTS = (p: Person) => [p.body, p.head, p.armL, p.armR, p.elbowL, p.elbowR, p.legL, p.legR, p.kneeL, p.kneeR, p.footL, p.footR];

/** Lo llama animatePerson al terminar: así se sabe qué ha tocado después el nivel a mano. */
export function rigSnapshot(p: Person, mode: PersonMode) {
  const r = p.rig!;
  r.mode = mode;
  for (const j of JOINTS(p)) {
    const s = r.snap.get(j);
    if (s) {
      s[0] = j.rotation.x;
      s[1] = j.rotation.y;
      s[2] = j.rotation.z;
    } else r.snap.set(j, [j.rotation.x, j.rotation.y, j.rotation.z]);
  }
  r.snapBodyY = p.body.position.y;
}

const changed = (r: Rig, j: THREE.Object3D) => {
  const s = r.snap.get(j);
  if (!s) return false;
  return Math.abs(s[0] - j.rotation.x) + Math.abs(s[1] - j.rotation.y) + Math.abs(s[2] - j.rotation.z) > 1e-4;
};

const _rootQ = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _target = new THREE.Quaternion();
const _parent = new THREE.Quaternion();
const _local = new THREE.Quaternion();

function updateOne(p: Person, dt: number) {
  const r = p.rig!;
  const D = data[r.kind]!;
  // Velocidad real del personaje (para mezclar y ajustar la cadencia, como en la prueba)
  const pos = p.root.position;
  if (Number.isNaN(r.last.x)) r.last.copy(pos);
  const d = Math.hypot(pos.x - r.last.x, pos.z - r.last.z);
  r.last.copy(pos);
  const sc = p.root.scale.x || 1;
  const v = dt > 0 && d < 2 ? d / dt / sc : 0;
  r.speed += (v - r.speed) * Math.min(1, dt * 10);
  const sp = r.speed;

  const airS = airOf.get(p.root.position);
  const inAir = !!airS && airS.hop > 0.05;
  const tw: Record<string, number> = { idle: 0, walk: 0, run: 0, dance: 0, agree: 0, air: 0 };
  if (inAir) tw.air = 1;
  else if (r.mode === 'dance' || r.mode === 'cheer') tw.dance = 1;
  else {
    const wr = THREE.MathUtils.smoothstep(sp, D.walkSpeed * 1.1, D.runSpeed * 0.8);
    const moving = r.mode === 'walk' ? THREE.MathUtils.smoothstep(sp, 0.05, 0.6) : 0;
    tw.idle = 1 - moving;
    tw.walk = moving * (1 - wr);
    tw.run = moving * wr;
  }
  const k = 1 - Math.exp(-10 * dt);
  for (const n in tw) {
    r.w[n] += (tw[n] - r.w[n]) * k;
    r.act[n].setEffectiveWeight(r.w[n]);
  }
  const walk = r.act.walk, run = r.act.run;
  walk.timeScale = THREE.MathUtils.clamp(sp / D.walkSpeed, 0.5, 2.2);
  run.timeScale = THREE.MathUtils.clamp(sp / D.runSpeed, 0.6, 1.6);
  if (r.w.walk > 0.05 && r.w.run > 0.05) {
    const ph = walk.time / walk.getClip().duration;
    run.time = ph * run.getClip().duration;
    const blend = r.w.run / (r.w.run + r.w.walk);
    const rate = THREE.MathUtils.lerp(sp / D.walkSpeed / walk.getClip().duration, sp / D.runSpeed / run.getClip().duration, blend);
    walk.timeScale = rate * walk.getClip().duration;
    run.timeScale = rate * run.getClip().duration;
  }
  r.mixer.update(dt);

  // Partes del cuerpo que mandan las articulaciones del muñeco
  const forced = r.mode === 'wave' || r.mode === 'talk';
  const want: Record<Group, number> = {
    body: changed(r, p.body) || Math.abs(p.body.position.y - r.snapBodyY) > 1e-4 ? 1 : 0,
    head: changed(r, p.head) ? 1 : 0,
    armL: forced || changed(r, p.armL) || changed(r, p.elbowL) ? 1 : 0,
    armR: forced || changed(r, p.armR) || changed(r, p.elbowR) ? 1 : 0,
    legL: changed(r, p.legL) || changed(r, p.kneeL) || changed(r, p.footL) ? 1 : 0,
    legR: changed(r, p.legR) || changed(r, p.kneeR) || changed(r, p.footR) ? 1 : 0,
  };
  if (r.force) Object.assign(want, r.force);
  const kg = 1 - Math.exp(-8 * dt);
  let any = false;
  for (const g in want) {
    const gk = g as Group;
    r.gw[gk] += (want[gk] - r.gw[gk]) * kg;
    if (r.gw[gk] < 0.002) r.gw[gk] = 0;
    if (r.gw[gk] > 0) any = true;
  }
  const t = r.torso;
  const lean = t.x !== 0 || t.y !== 0 || t.z !== 0;
  if (!any && !lean) return;
  p.root.updateWorldMatrix(true, true);
  p.root.getWorldQuaternion(_rootQ);
  const rootInv = _rootQ.clone().invert();
  if (any)
    for (const [j, bn, g] of r.map) {
      const wgt = r.gw[g];
      if (!wgt) continue;
      const b = r.bones.get(bn);
      const down = D.down.get(bn);
      if (!b || !down) continue;
      // Rotación de la articulación respecto al personaje × pose de reposo (brazos caídos) del hueso
      j.getWorldQuaternion(_pq).premultiply(rootInv);
      _target.copy(_rootQ).multiply(_pq).multiply(down);
      b.parent!.getWorldQuaternion(_parent);
      _local.copy(_parent.invert()).multiply(_target);
      b.quaternion.slerp(_local, wgt);
      b.updateWorldMatrix(false, true);
    }
  if (lean) {
    // De cintura para arriba: la columna reparte el giro y caderas y piernas no se enteran
    for (const [bn, w] of TORSO) {
      const b = r.bones.get(bn);
      if (!b) continue;
      _torsoE.set(t.x * w, t.y * w, t.z * w, 'YXZ');
      _torsoQ.setFromEuler(_torsoE);
      // Giro en los ejes del personaje, pasado a mundo y aplicado encima de la pose del hueso
      _torsoW.copy(_rootQ).multiply(_torsoQ).multiply(rootInv);
      b.getWorldQuaternion(_target).premultiply(_torsoW);
      b.parent!.getWorldQuaternion(_parent);
      b.quaternion.copy(_parent.invert()).multiply(_target);
      b.updateWorldMatrix(false, true);
    }
  }
}

/** Pone un hueso en su pose de reposo respecto al personaje (p. ej. el pie plano, tras un IK de la pierna). */
export function boneLevel(p: Person, bone: string, pitch = 0) {
  const r = p.rig!;
  const b = r.bones.get(bone);
  const down = data[r.kind]!.down.get(bone);
  if (!b || !down) return;
  p.root.getWorldQuaternion(_rootQ);
  _target.copy(_rootQ).multiply(_torsoQ.setFromEuler(_torsoE.set(pitch, 0, 0, 'YXZ'))).multiply(down);
  b.parent!.getWorldQuaternion(_parent);
  b.quaternion.copy(_parent.invert()).multiply(_target);
  b.updateWorldMatrix(false, true);
}

/**
 * Inclina a alguien solo de cintura para arriba (x adelante, y girar, z de lado; ejes del personaje):
 * caderas y piernas se quedan como están. Sin esqueleto, se inclina el muñeco entero.
 */
export function leanTorso(p: Person, x: number, y: number, z: number) {
  if (p.rig) p.rig.torso.set(x, y, z);
  else p.body.rotation.set(x, y, z);
}

/** Una vez por fotograma, después de que el nivel haya movido a todos y antes de dibujar. */
export function updateRigPeople(dt: number) {
  vatTime.value += dt;
  for (const t of rigTickers) t(dt);
  for (const p of people) {
    if (!p.root.parent) continue;
    updateOne(p, dt);
  }
  for (const f of rigPost) f(dt);
}

/** Al salir de un capítulo. */
export function clearRigPeople() {
  // Los que el capítulo sacó de la escena antes de salir no los libera su dispose: sus huesos, aquí
  for (const p of people)
    p.root.traverse((o) => {
      (o as THREE.SkinnedMesh).skeleton?.dispose();
    });
  people.clear();
  rigTickers.clear();
  rigPost.clear();
}
