import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
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
  img.src = url;
  await img.decode();
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
  const k = `w${look.skin}.${look.hair}.${look.shirt}.${look.pants}.${look.shoes ?? 0}`;
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
  const part = (i: number) => Math.round((parts?.[i] ?? 0) / 36);
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
  if (/Outfit_Top/.test(name) && mat.map) { mat.map = grayTexture(mat.map); mat.color = lin(look.shirt); }
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
}

const people = new Set<Person>();
/** Tiempo común de la multitud horneada (crowdRig.ts). */
export const vatTime = { value: 0 };
/** Otras cosas animadas de los capítulos con glTF (los ases): se actualizan con los personajes. */
export const rigTickers = new Set<(dt: number) => void>();

/** Crea un personaje glTF con las mismas articulaciones (invisibles) que el muñeco de siempre. */
export function makeRigPerson(look: PersonLook, scale: number, blob: THREE.Object3D): Person {
  const kind: Kind = look.male || look.beard ? 'man' : 'woman';
  const D = data[kind]!;
  const root = new THREE.Group();
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
    bones: B, map, hipsY: B.get('Hips')!.position.y, last: new THREE.Vector3(NaN, 0, 0), speed: 0,
    hipsHeight: B.get('Hips')!.getWorldPosition(new THREE.Vector3()).y / scale,
  };
  const p: Person = {
    root, body, head: headJ, eyes, legL, legR, armL, armR, handR,
    kneeL, kneeR, footL, footR, elbowL, elbowR,
    blink: 2 + Math.random() * 3, t: Math.random() * 10, rig,
  };
  people.add(p);
  return p;
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
  if (!any) return;
  p.root.updateWorldMatrix(true, true);
  p.root.getWorldQuaternion(_rootQ);
  const rootInv = _rootQ.clone().invert();
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
}

/** Una vez por fotograma, después de que el nivel haya movido a todos y antes de dibujar. */
export function updateRigPeople(dt: number) {
  vatTime.value += dt;
  for (const t of rigTickers) t(dt);
  for (const p of people) {
    if (!p.root.parent) continue;
    updateOne(p, dt);
  }
}

/** Al salir de un capítulo. */
export function clearRigPeople() {
  people.clear();
  rigTickers.clear();
}
