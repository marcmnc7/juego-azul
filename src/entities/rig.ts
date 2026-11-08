import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../core/assets';
import { airOf } from '../core/air';
import { comic } from '../core/comic';
import type { Person, PersonLook, PersonMode } from './models';
import womanUrl from '../assets/chars/woman.glb';
import womanMhUrl from '../assets/chars/woman_mh.glb';
import kidMhUrl from '../assets/chars/kid_mh.glb';
// Gas y el hombre genérico de los secundarios: MakeHuman (CC0), montados con src/demo/mhbuild.ts
import gasUrl from '../assets/chars/gas_mh.glb';
import manMhUrl from '../assets/chars/man_mh.glb';
import animsUrl from '../assets/chars/anims.glb';
import womanPartsUrl from '../assets/chars/woman_parts.png';
// Fotos de tela (CC0, de MakeHuman) para la ropa de Azul: vaquero y punto de camiseta
import denimUrl from '../assets/chars/denim_tile.jpg';
import knitUrl from '../assets/chars/knit_tile.jpg';

// Personajes de la prueba de concepto: modelos glTF con esqueleto (rig de Mixamo) y animaciones de
// captura de movimiento (Mixamo), con el mismo retargeting en espacio mundo de la prueba.
//
// Para que el código de los niveles siga funcionando igual, cada personaje conserva el "esqueleto"
// del muñeco de siempre (body, head, armL, kneeR…) como articulaciones invisibles. animatePerson las
// sigue moviendo, pero lo que se ve lo mueve la captura de movimiento (reposo, andar, correr,
// bailar). Cuando un nivel coloca una articulación a mano (llevar la pomada, el beso, tocar el
// fabiol) o el modo no tiene captura (saludar, celebrar, hablar), esa parte del cuerpo copia la
// articulación invisible, con una transición suave.

/** woman: Azul (su modelo); mhwoman: las demás chicas; man: los demás hombres; kid: los niños (MakeHuman). */
export type Kind = 'woman' | 'man' | 'gas' | 'mhwoman' | 'kid';
const HEIGHT: Record<Kind, number> = { woman: 1.66, man: 1.77, gas: 1.8, mhwoman: 1.64, kid: 1.3 };

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

/**
 * Pesos de piel sin negativos y normalizados. Los de la ropa de MakeHuman salen de un ajuste baricéntrico y
 * algunos eran negativos: al moverse, la puntera de los zapatos salía disparada en picos.
 */
function cleanWeights(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const sw = m.geometry.attributes.skinWeight as THREE.BufferAttribute;
    for (let i = 0; i < sw.count; i++) {
      let s = 0;
      const w = [0, 1, 2, 3].map((k) => {
        const x = Math.max(0, sw.getComponent(i, k));
        s += x;
        return x;
      });
      if (s > 0) w.forEach((x, k) => sw.setComponent(i, k, x / s));
    }
    sw.needsUpdate = true;
  });
}

function prepareKind(kind: Kind, gltf: GLTF, anims: GLTF, animsBind: ReturnType<typeof saveLocal>, dance?: { clip: THREE.AnimationClip; rest: Pose; root: THREE.Object3D }): KindData {
  const model = gltf.scene;
  if (kind !== 'woman') cleanWeights(model);
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
  // La suela, no el hueso del pie: el último hueso queda por encima de la suela y los pies se hundían en el suelo
  model.updateWorldMatrix(true, true);
  const soleY = new THREE.Box3().setFromObject(model, true).min.y;
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
    gltf, clips, down, scale, minY: Math.min(box.min.y, soleY),
    walkSpeed: strideSpeed(model, clips.walk, scale) || 1.4,
    runSpeed: strideSpeed(model, clips.run, scale) || 4.5,
  };
}

/** Carga los modelos y prepara las animaciones (una vez). */


export function preloadRig() {
  loading ??= (async () => {
    const [woman, anims, gas, manMh, womanMh, kidMh] = await Promise.all([loadGLB(womanUrl), loadGLB(animsUrl), loadGLB(gasUrl), loadGLB(manMhUrl), loadGLB(womanMhUrl), loadGLB(kidMhUrl)]);
    parts = await loadImageData(womanPartsUrl, 512, 512);
    [denimPx, knitPx] = await Promise.all([loadImageData(denimUrl, FAB, FAB), loadImageData(knitUrl, FAB, FAB)]);
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
    data.mhwoman = prepareKind('mhwoman', womanMh, anims, aBind, { clip: samba, rest: wRest, root: woman.scene });
    data.kid = prepareKind('kid', kidMh, anims, aBind, { clip: samba, rest: wRest, root: woman.scene });
    data.man = prepareKind('man', manMh, anims, aBind, { clip: samba, rest: wRest, root: woman.scene });
    data.gas = prepareKind('gas', gas, anims, aBind, { clip: samba, rest: wRest, root: woman.scene });
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

/**
 * La cara, pintada encima de la textura: el modelo la trae diminuta y a manchas. Cejas del color del pelo,
 * ojos con su iris, algo de color en las mejillas, una sombra suave en las cuencas y bajo la nariz, y labios.
 * En la textura la cara está tumbada: la frente hacia la izquierda (x menor), la barbilla hacia la derecha.
 */
function paintFace(g: CanvasRenderingContext2D, look: PersonLook, M: number) {
  const C = 88.4;
  g.save();
  g.scale(M, M);
  const blob = (x: number, y: number, r: number, c: string, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c},${a})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const hairC = new THREE.Color(look.hair);
  const brow = `rgb(${Math.round(hairC.clone().convertLinearToSRGB().r * 255 * 0.5)},${Math.round(hairC.clone().convertLinearToSRGB().g * 255 * 0.42)},${Math.round(hairC.clone().convertLinearToSRGB().b * 255 * 0.36)})`;
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    blob(463, C + s * 25, 11, '228,118,104', 0.2); // mejilla
    blob(441.5, C + s * 15.5, 9.5, '150,98,74', 0.12); // cuenca del ojo
    // Ceja: más gruesa hacia la nariz y afinándose hacia fuera
    g.strokeStyle = brow;
    g.globalAlpha = 0.82;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(433.6, C + s * 6.5);
    g.quadraticCurveTo(430.2, C + s * 12, 430.6, C + s * 17);
    g.stroke();
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(430.6, C + s * 16);
    g.quadraticCurveTo(431.4, C + s * 22, 435.2, C + s * 26.5);
    g.stroke();
    g.globalAlpha = 1;
  }
  blob(450.8, C, 3.6, '160,100,80', 0.22); // bajo la nariz
  blob(461.5, C, 3.4, '160,100,80', 0.1); // bajo el labio
  // Labios: el de arriba con su arco, el de abajo más lleno, y la línea que los separa
  g.fillStyle = '#b5636a';
  g.beginPath();
  g.moveTo(456.1, C - 6);
  g.quadraticCurveTo(453.9, C - 2.3, 454.8, C);
  g.quadraticCurveTo(453.9, C + 2.3, 456.1, C + 6);
  g.quadraticCurveTo(456.9, C, 456.1, C - 6);
  g.fill();
  g.fillStyle = '#c67a7e';
  g.beginPath();
  g.moveTo(456.1, C - 6);
  g.quadraticCurveTo(459.6, C, 456.1, C + 6);
  g.quadraticCurveTo(456.9, C, 456.1, C - 6);
  g.fill();
  g.strokeStyle = 'rgba(112,38,48,.85)';
  g.lineWidth = 0.45;
  g.beginPath();
  g.moveTo(456.1, C - 6);
  g.quadraticCurveTo(456.9, C, 456.1, C + 6);
  g.stroke();
  // Los ojos: la esclerótica limpia, iris del color de sus ojos, pupila y un brillo
  const ic = new THREE.Color(look.eyes ?? 0x5a3a22).convertLinearToSRGB();
  const rgb = (k: number) => `rgb(${Math.round(ic.r * 255 * k)},${Math.round(ic.g * 255 * k)},${Math.round(ic.b * 255 * k)})`;
  for (const [x, y] of [[501.5, 484.5], [499.25, 503.4]]) {
    const R = 4.1;
    const gr = g.createRadialGradient(x, y, 1.1, x, y, R);
    gr.addColorStop(0, rgb(0.92));
    gr.addColorStop(0.7, rgb(0.62));
    gr.addColorStop(1, rgb(0.26));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0c0a0a';
    g.beginPath();
    g.arc(x, y, 1.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath();
    g.arc(x - 1.1, y - 1.2, 0.62, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Textura de Michelle recoloreada por partes (piel, pelo, camiseta, pantalón, zapatos). */
/** Tejidos para la ropa de Azul (vaquero y punto), en píxeles; se repiten en espejo para que no se vean costuras. */
let denimPx: Uint8ClampedArray | null = null, knitPx: Uint8ClampedArray | null = null;
const FAB = 192;
function mirror(v: number, n: number) {
  const m = v % (2 * n);
  return m < n ? m : 2 * n - 1 - m;
}
const jeansOn = (look: PersonLook) => !!look.jeans && !look.jumpsuit && !look.shorts && !look.nude;
let denimAvg: number[] | null = null;
/** Color medio de la foto de tela vaquera. */
function denimMean() {
  if (denimAvg) return denimAvg;
  const s = [0, 0, 0];
  const n = denimPx!.length / 4;
  for (let i = 0; i < denimPx!.length; i += 4) for (let q = 0; q < 3; q++) s[q] += denimPx![i + q] / n;
  return (denimAvg = s);
}

function womanTexture(src: THREE.Texture, look: PersonLook) {
  // En el cómic la ropa va en color liso: los pliegues y el sombreado de la foto, casi fuera (la luz la pone
  // el sombreado en tres tonos)
  const cm = comic.on;
  const k = `w${look.skin}.${look.hair}.${look.shirt}.${look.pants}.${look.shoes ?? 0}.${look.eyes ?? 0}.${look.jumpsuit ? 'j' : look.shorts ? 's' : jeansOn(look) ? 'J' : ''}${look.nude ? 'n' : ''}${cm ? 'C' : ''}`;
  const jeans = jeansOn(look);
  const over = look.jumpsuit ? shortSuit().mask : look.shorts ? legsMask() : jeans ? waistMask() : null;
  let t = texCache.get(k);
  if (t) return t;
  const img = src.image as HTMLImageElement | ImageBitmap;
  // Al doble que la máscara de partes: la cara ocupa muy poco de la textura y en los primeros planos se ve
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, S, S);
  const id = g.getImageData(0, 0, S, S);
  const px = id.data;
  const sum = new Float64Array(7), cnt = new Float64Array(7);
  // 1 piel, 2 pelo, 3 camiseta, 4 pantalón, 5 zapatos, 6 cara (piel con menos detalle); 0 se queda igual
  const part = (x: number, y: number) => {
    const m = (y >> 1) * 512 + (x >> 1);
    return (over && over[m]) || Math.round((parts?.[m * 4] ?? 0) / 36);
  };
  for (let y = 0, i = 0; y < S; y++)
    for (let x = 0; x < S; x++, i += 4) {
      const p = part(x, y);
      sum[p] += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      cnt[p]++;
    }
  // En sRGB, como los píxeles del lienzo
  const target = [0, look.skin, look.hair, look.shirt, look.pants, look.shoes ?? 0x2a2420, look.skin].map((h) => ({ r: ((h >> 16) & 255) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 }));
  for (let y = 0, i = 0; y < S; y++)
    for (let x = 0; x < S; x++, i += 4) {
      const p = part(x, y);
      if (!p) continue;
      const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      const mean = sum[p] / Math.max(1, cnt[p]);
      const r = l / Math.max(8, mean);
      // La cara, casi lisa y sin pasarse de su tono (por encima se saturaba y quedaba amarillo verdosa); los
      // rasgos se pintan después. Sin ropa, la piel es lisa: los pliegues y costuras la delatarían
      let f = p === 6 ? Math.min(1, Math.max(0.94, 0.985 + (r - 1) * 0.06)) : look.nude && p !== 2 ? 1 : p === 1 ? Math.min(1.08, Math.max(0.62, r)) : Math.min(1.7, Math.max(0.3, r));
      if (cm && (p === 1 || p === 3 || p === 4)) f = 1 + (f - 1) * (p === 1 ? 0.45 : 0.3);
      const col = target[p];
      if (jeans && p === 3 && knitPx) {
        // Top de punto: color liso con el relieve de una foto de tela (sin las costuras del top original)
        const fl = Math.min(1.04, Math.max(0.86, 0.96 + (f - 1) * 0.35));
        const j = (mirror(y * 3, FAB) * FAB + mirror(x * 3, FAB)) * 4;
        const k = fl * (cm ? 1 : 0.9 + 0.2 * ((knitPx[j] * 0.3 + knitPx[j + 1] * 0.59 + knitPx[j + 2] * 0.11) / 96 - 0.5));
        px[i] = Math.min(255, col.r * 255 * k);
        px[i + 1] = Math.min(255, col.g * 255 * k);
        px[i + 2] = Math.min(255, col.b * 255 * k);
        continue;
      }
      if (jeans && p === 4 && denimPx) {
        // Vaquero: foto de tela vaquera con los pliegues del pantalón (sin sus parches)
        const sh = Math.min(1.15, Math.max(0.78, 1 + (f - 1) * 0.55));
        const j = (mirror(Math.floor(y * 1.6), FAB) * FAB + mirror(Math.floor(x * 1.6), FAB)) * 4;
        if (cm) {
          // cómic: azul vaquero liso (el medio de la foto), con una pizca de su trama y las costuras
          const dm = denimMean();
          for (let q = 0; q < 3; q++) px[i + q] = Math.min(255, (dm[q] + (denimPx[j + q] - dm[q]) * 0.2) * sh);
          continue;
        }
        px[i] = Math.min(255, denimPx[j] * sh);
        px[i + 1] = Math.min(255, denimPx[j + 1] * sh);
        px[i + 2] = Math.min(255, denimPx[j + 2] * sh);
        continue;
      }
      px[i] = Math.min(255, col.r * 255 * f);
      px[i + 1] = Math.min(255, col.g * 255 * f);
      px[i + 2] = Math.min(255, col.b * 255 * f);
    }
  g.putImageData(id, 0, 0);
  paintFace(g, look, S / 512);
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
    // (mate: con brillo, el pelo oscuro de una sola pieza parecía de globos de látex negro)
    mat.roughness = 0.9;
    mat.envMapIntensity = 0.55;
    // Un poco de luz propia en la piel y la ropa: a la sombra, las caras no se quedan grises
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = mat.map;
    mat.emissiveIntensity = 0.09;
    if (look.nude) mat.normalMap = null;
    return true;
  }
  if (look.nude && /Outfit|Footwear/.test(name)) {
    mat.map = null;
    mat.normalMap = null;
    mat.color = lin(look.skin);
    mat.roughness = 0.62;
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
    mat.emissive = mat.color.clone();
    mat.emissiveMap = mat.map;
    mat.emissiveIntensity = 0.09;
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
  /** Gestos sueltos de pie (asentir, hablar con las manos): cuándo toca el próximo y cuánto le queda al de ahora. */
  fidNext?: number;
  fidLeft?: number;
  /** Sin gestos sueltos (en un abrazo o un beso, que mueven la cabeza y los brazos a mano). */
  noFidget?: boolean;
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
  const kind: Kind = look.gas ? 'gas' : look.kid ? 'kid' : look.male || look.beard ? 'man' : look.azul ? 'woman' : 'mhwoman';
  const D = data[kind]!;
  const mh = kind !== 'woman';
  const root = new THREE.Group();
  root.userData.noCam = true; // se mueve: la cámara no choca con ello
  const model = SkeletonUtils.clone(D.gltf.scene);
  model.scale.setScalar(D.scale);
  model.position.y = -D.minY * D.scale;
  root.add(model);

  const extra: [THREE.SkinnedMesh, THREE.SkinnedMesh][] = [];
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    // Sin sombra propia: en los primeros planos, la del pelo y la nariz les manchaba la cara de gris
    m.receiveShadow = false;
    m.userData.noReceive = true;
    m.frustumCulled = false;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    m.material = mat;
    if (mh) {
      // MakeHuman: cada pieza se enseña o no según la ropa, y se tiñe con los colores del personaje
      m.visible = mhPart(kind, m.name, mat, look);
      return;
    }
    if (colorRigMaterial(kind, m.name, mat, look) === false) m.visible = false;
    if (kind === 'woman' && (look.jumpsuit || look.shorts) && (m as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = m as THREE.SkinnedMesh;
      const src = sm.geometry;
      sm.geometry = jeansGeometry(shortSuit().geo.get(src.uuid) ?? src, true, sm.skeleton);
      // y encima, el pantalón corto de verdad (del color del pantalón: negro con el mono)
      const sg = shortSuit().shell.get(src.uuid);
      if (sg && sg.attributes.position.count) {
        const shorts = new THREE.SkinnedMesh(sg, new THREE.MeshStandardMaterial({ color: lin(look.pants), roughness: 0.85, side: THREE.DoubleSide }));
        shorts.name = 'Shorts';
        shorts.frustumCulled = false;
        shorts.castShadow = true;
        extra.push([sm, shorts]);
      }
    }
    else if (kind === 'woman' && jeansOn(look) && (m as THREE.SkinnedMesh).isSkinnedMesh) m.geometry = jeansGeometry(m.geometry);
  });

  for (const [m, shorts] of extra) {
    m.parent!.add(shorts);
    shorts.bind(m.skeleton, m.bindMatrix);
  }
  const B = boneMap(model);
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




// ---------- Camiseta a rayas (la del Barça) ----------




// ---------- Mono corto ----------

let short: { mask: Uint8Array; geo: Map<string, THREE.BufferGeometry>; shell: Map<string, THREE.BufferGeometry> } | null = null;
/**
 * Mono negro corto (Ferreries): tapa la barriga que deja ver el top de Michelle y deja las piernas
 * al aire desde medio muslo. Las perneras anchas del pantalón se ciñen a la forma de la pierna y su
 * textura pasa a ser piel; la barriga pasa a ser tela. Se calcula una vez para todas.
 */
function shortSuit() {
  if (short) return short;
  const mask = new Uint8Array(512 * 512);
  const geo = new Map<string, THREE.BufferGeometry>();
  const shell = new Map<string, THREE.BufferGeometry>();
  short = { mask, geo, shell };
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
    // (también el puño del pantalón, que en la máscara va con los zapatos: si no, la pierna se abría en el tobillo)
    const isLeg = (i: number) => pt[i] === 4 || (pt[i] === 5 && hOf(w[i]) > 0.075);
    // Perneras ceñidas: cada vértice del pantalón bajo el dobladillo se acerca al eje de su pierna
    const BIN = 0.015;
    const stat = new Map<string, { x: number; z: number; n: number; r: number }>();
    const key = (v: THREE.Vector3) => `${v.x > cx ? 1 : 0}:${Math.floor(hOf(v) / BIN)}`;
    for (let i = 0; i < pos.count; i++) {
      if (!isLeg(i) || hOf(w[i]) >= HEM + 0.03) continue;
      const k = key(w[i]);
      const st = stat.get(k) ?? { x: 0, z: 0, n: 0, r: 0 };
      st.x += w[i].x; st.z += w[i].z; st.n++;
      stat.set(k, st);
    }
    for (const st of stat.values()) { st.x /= st.n; st.z /= st.n; }
    for (let i = 0; i < pos.count; i++) {
      if (!isLeg(i) || hOf(w[i]) >= HEM + 0.03) continue;
      const st = stat.get(key(w[i]))!;
      st.r = Math.max(st.r, Math.hypot(w[i].x - st.x, w[i].z - st.z));
    }
    const out = src.clone();
    const op = out.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const W2 = w.map((q) => q.clone()); // posiciones en reposo después de ceñir las perneras
    for (let i = 0; i < pos.count; i++) {
      if (!isLeg(i)) continue;
      const h = hOf(w[i]);
      if (h >= HEM + 0.03) continue;
      const st = stat.get(key(w[i]))!;
      const k = Math.min(1, legR(Math.min(h, HEM)) / Math.max(1e-4, st.r));
      const blend = THREE.MathUtils.smoothstep(HEM + 0.03 - h, 0, 0.03); // sin escalón en el dobladillo
      const f = 1 + (k - 1) * blend;
      W2[i].set(st.x + (w[i].x - st.x) * f, w[i].y, st.z + (w[i].z - st.z) * f);
      v.copy(W2[i]).applyMatrix4(MS[mi][i].clone().invert());
      op.setXYZ(i, v.x, v.y, v.z);
    }
    out.computeVertexNormals();
    geo.set(src.uuid, out);
    // Pantalón corto de verdad: una prenda aparte, con grosor, por encima de la piel de cintura a medio muslo,
    // con el bajo recto y un poco acampanado (antes solo estaba pintado sobre la pierna)
    {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(W2.flatMap((q) => [q.x, q.y, q.z]), 3));
      wg.setIndex(index);
      wg.computeVertexNormals();
      const wn = wg.attributes.normal as THREE.BufferAttribute;
      const si = src.attributes.skinIndex as THREE.BufferAttribute, sw = src.attributes.skinWeight as THREE.BufferAttribute;
      const P: number[] = [], N: number[] = [], SI: number[] = [], SW: number[] = [], UV: number[] = [];
      const n = new THREE.Vector3(), q = new THREE.Vector3();
      const TOP = 0.615;
      for (let t = 0; t < index.length; t += 3) {
        const tri = [index[t], index[t + 1], index[t + 2]];
        const hs = tri.map((i) => hOf(W2[i]));
        const hc = (hs[0] + hs[1] + hs[2]) / 3;
        if (hc < HEM || hc > TOP || !tri.every((i) => pt[i] === 4 || pt[i] === 3 || pt[i] === 0)) continue;
        for (const i of tri) {
          const h = Math.max(HEM, hOf(W2[i]));
          n.fromBufferAttribute(wn, i);
          // grosor: fino en la cintura, más suelto abajo; el bajo se abre un poco
          const off = 0.007 + 0.012 * THREE.MathUtils.smoothstep(h, TOP, HEM + 0.04) + 0.012 * THREE.MathUtils.smoothstep(h, HEM + 0.035, HEM);
          q.copy(W2[i]).addScaledVector(n, off);
          q.y = box.min.y + h * H;
          q.applyMatrix4(MS[mi][i].clone().invert());
          P.push(q.x, q.y, q.z);
          N.push(n.x, n.y, n.z);
          UV.push(0.5, 0.5);
          for (let k = 0; k < 4; k++) { SI.push(si.getComponent(i, k)); SW.push(sw.getComponent(i, k)); }
        }
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      sg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      sg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
      sg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
      sg.computeVertexNormals();
      shell.set(src.uuid, sg);
    }
  });
  const px = g.getImageData(0, 0, 512, 512).data;
  const hp = hg.getImageData(0, 0, 512, 512).data;
  for (let i = 0; i < mask.length; i++) {
    mask[i] = px[i * 4] > 70 ? 3 : 0; // bordes suavizados del lienzo
    if (hp[i * 4 + 1] > 128 && hp[i * 4] / 255 < HEM) mask[i] = 6; // piel lisa, sin los pliegues del vaquero
  }
  return short;
}

let waist: Uint8Array | null = null;
/**
 * Con vaqueros: la franja de la máscara de partes que el modelo original tenía como «camiseta» en la cintura del
 * pantalón pasa a ser pantalón (salía una tira dentada del color del top encima del vaquero). Se decide por la
 * altura de cada triángulo en la pose de reposo.
 */
function waistMask() {
  if (waist) return waist;
  waist = new Uint8Array(512 * 512);
  const scene = data.woman?.gltf.scene;
  if (!scene || !parts) return waist;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.lineWidth = 2;
  g.fillStyle = g.strokeStyle = '#ff0000';
  scene.updateWorldMatrix(true, true);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && m.geometry.attributes.uv) meshes.push(m);
  });
  const box = new THREE.Box3();
  const W = meshes.map((m) => {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const w: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) w.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(skinMatrix(m, i)));
    w.forEach((v) => box.expandByPoint(v));
    return w;
  });
  const H = box.max.y - box.min.y;
  meshes.forEach((m, mi) => {
    const uv = m.geometry.attributes.uv as THREE.BufferAttribute;
    const w = W[mi];
    const partOf = (i: number) => {
      const x = Math.min(511, Math.max(0, Math.floor(uv.getX(i) * 512)));
      const y = Math.min(511, Math.max(0, Math.floor(uv.getY(i) * 512)));
      return Math.round(parts![(y * 512 + x) * 4] / 36);
    };
    const n = m.geometry.attributes.position.count;
    const index = m.geometry.index ? Array.from(m.geometry.index.array) : [...Array(n).keys()];
    for (let t = 0; t < index.length; t += 3) {
      const tri = [index[t], index[t + 1], index[t + 2]];
      // (la tira es «camiseta» o sin clasificar, que conserva el azul del conjunto original del modelo)
      if (!tri.some((q) => partOf(q) === 3 || partOf(q) === 0)) continue;
      const h = tri.reduce((s, q) => s + (w[q].y - box.min.y) / H, 0) / 3;
      // la tira llega hasta 0.64 de la altura; el top empieza en 0.66 (entre medias no hay triángulos)
      if (h > 0.645 || h < 0.42) continue;
      g.beginPath();
      g.moveTo(uv.getX(tri[0]) * 512, uv.getY(tri[0]) * 512);
      g.lineTo(uv.getX(tri[1]) * 512, uv.getY(tri[1]) * 512);
      g.lineTo(uv.getX(tri[2]) * 512, uv.getY(tri[2]) * 512);
      g.closePath();
      g.fill();
      g.stroke();
    }
  });
  const px = g.getImageData(0, 0, 512, 512).data;
  for (let i = 0; i < waist.length; i++) {
    const p = Math.round(parts[i * 4] / 36);
    if (px[i * 4] > 70 && (p === 3 || p === 0)) waist[i] = 4;
  }
  return waist;
}

// ---------- MakeHuman (Gas y los hombres secundarios) ----------

/** Color medio de la piel de la textura del hombre genérico (sRGB): el tono de cada uno se saca respecto a él. */
const MH_SKIN = new THREE.Color(0xe9bc9e);
const stripeCache = new Map<string, THREE.Texture>();
/** La camiseta (blanca) con rayas verticales de dos colores: la del Barça. */
function stripedMap(src: THREE.Texture, cols: [number, number]) {
  const k = src.uuid + cols.join(',');
  let t = stripeCache.get(k);
  if (t) return t;
  const img = src.image as HTMLImageElement | ImageBitmap;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  const n = 26, w = c.width / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = '#' + new THREE.Color(cols[i % 2]).getHexString();
    g.fillRect(i * w, 0, w + 1, c.height);
  }
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = src.flipY;
  stripeCache.set(k, t);
  return t;
}
/**
 * Qué piezas lleva cada uno y de qué color. El modelo trae el cuerpo en tres versiones (vestido, con pantalón
 * corto y sin ropa), la camiseta blanca, el pantalón largo y el corto: según la ropa se enseñan unas u otras.
 * Gas trae su pelo, su barba y sus vaqueros; al genérico se le tiñen la piel, el pelo y el pantalón.
 */
/** Peinado de cada hombre secundario: sale de su aspecto, así el mismo personaje lleva siempre el mismo. */
export function mhHairFor(look: PersonLook, kind: Kind = 'man') {
  const k = (look.hair * 7 + look.shirt * 3 + look.skin) >>> 0;
  const longish = look.hairStyle === 'long' || look.hairStyle === 'straight' || look.hairStyle === 'pony' || look.hairStyle === 'bun' || !!look.skirt;
  if (kind === 'mhwoman') return look.hairStyle === 'long' || look.hairStyle === 'straight' ? 'MHHair' : k % 5 === 0 ? 'MHHair_afro01' : 'MHHair_bob02';
  if (kind === 'kid') return longish ? 'MHHair_bob02' : k % 2 ? 'MHHair' : 'MHHair_short04';
  const H = ['MHHair', 'MHHair_short01', 'MHHair_short03', 'MHHair_short04'];
  return H[k % H.length];
}

function mhPart(kind: Kind, name: string, mat: THREE.MeshStandardMaterial, look: PersonLook) {
  const nude = !!look.nude, shorts = (!!look.shorts || !!look.jumpsuit) && !nude;
  const generic = kind !== 'gas';
  switch (name) {
    case 'Body':
    case 'BodyShort':
    case 'BodyFull':
      if (generic) {
        const s = lin(look.skin).convertLinearToSRGB();
        mat.color.setRGB(Math.min(1.15, s.r / MH_SKIN.r), Math.min(1.15, s.g / MH_SKIN.g), Math.min(1.15, s.b / MH_SKIN.b), THREE.SRGBColorSpace);
      }
      return name === (nude ? 'BodyFull' : shorts ? 'BodyShort' : 'Body');
    case 'Shirt':
      if (look.stripes && mat.map) {
        mat.map = stripedMap(mat.map, look.stripes);
        mat.color.set(0xffffff);
      } else mat.color = lin(look.shirt);
      return !nude;
    case 'Pants':
    case 'PantsShort':
      if (generic) mat.color = lin(look.pants);
      return name === 'Pants' ? !nude && !shorts : shorts;
    case 'Shoes':
      return !nude;
    case 'MHScalp':
      // el casquete bajo el pelo, del color del pelo
      mat.color = lin(look.hair).multiplyScalar(generic ? 1.0 : 0.85);
      return true;
    case 'MHHair':
    case 'MHHair_short01':
    case 'MHHair_short03':
    case 'MHHair_short04':
    case 'MHHair_bob02':
    case 'MHHair_afro01':
      if (generic) mat.color = lin(look.hair).multiplyScalar(1.15);
      // (más tupido: con el recorte de antes se veía la piel de la cabeza a manchas naranjas)
      mat.alphaTest = 0.2;
      return !generic || name === mhHairFor(look, kind);
    default:
      return true;
  }
}

// ---------- Vaqueros ----------

const jeansCache = new Map<string, THREE.BufferGeometry>();
/**
 * Vaqueros rectos para el pantalón ancho de Michelle: en la malla en reposo (las piernas ya van rectas), cada
 * pernera, rodaja a rodaja, pasa a ser casi un tubo que se estrecha poco a poco del muslo al bajo, sin el
 * bajo fruncido. Todo lo que queda bajo la entrepierna y no es piel cuenta como pernera (el mapa de partes
 * solo marca como pantalón la cadera; el puño del tobillo va marcado como zapato).
 */
function jeansGeometry(src: THREE.BufferGeometry, bare = false, skel?: THREE.Skeleton) {
  const ck = src.uuid + (bare ? 'b' : '');
  const hit = jeansCache.get(ck);
  if (hit) return hit;
  const uv = src.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv || !parts) return src;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const pt = (i: number) => {
    const x = Math.min(511, Math.max(0, Math.floor(uv.getX(i) * 512)));
    const y = Math.min(511, Math.max(0, Math.floor(uv.getY(i) * 512)));
    return Math.round(parts![(y * 512 + x) * 4] / 36);
  };
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) { y0 = Math.min(y0, pos.getY(i)); y1 = Math.max(y1, pos.getY(i)); }
  // (con pantalón corto, hasta más arriba: si no, entre los muslos quedaba una telilla bajo el pantalón)
  const H = y1 - y0, TOP = bare ? 0.52 : 0.48, LOW = 0.055, SL = 0.02;
  const hb = (i: number) => (pos.getY(i) - y0) / H;
  const leg = (i: number) => { const h = hb(i); return h < TOP && h > LOW && pt(i) !== 1 && pt(i) !== 6; };
  // (izquierda y derecha respecto al centro de verdad de las piernas: el modelo no está centrado en x = 0 y las
  // dos piernas caían en el mismo grupo y se juntaban)
  let cxs = 0, cxn = 0;
  for (let i = 0; i < pos.count; i++) if (leg(i)) { cxs += pos.getX(i); cxn++; }
  const cx0 = cxn ? cxs / cxn : 0;
  // y mejor aún, por el hueso que la mueve (pierna izquierda o derecha): las costuras de dentro del pantalón
  // ancho quedan casi en el centro y, por posición, se iban a la otra pierna y estiraban triángulos entre las dos
  const si = src.attributes.skinIndex as THREE.BufferAttribute | undefined, sw = src.attributes.skinWeight as THREE.BufferAttribute | undefined;
  const sideOf = (i: number) => {
    if (skel && si && sw) {
      let l = 0, r = 0;
      for (let k = 0; k < 4; k++) {
        const n = skel.bones[si.getComponent(i, k)]?.name ?? '';
        if (/Left(UpLeg|Leg|Foot|ToeBase)/.test(n)) l += sw.getComponent(i, k);
        else if (/Right(UpLeg|Leg|Foot|ToeBase)/.test(n)) r += sw.getComponent(i, k);
      }
      if (l + r > 0.2) return l > r ? 'L' : 'R';
    }
    return pos.getX(i) > cx0 ? 'L' : 'R';
  };
  const sides = new Array<string>(pos.count);
  for (let i = 0; i < pos.count; i++) sides[i] = sideOf(i);
  const bk = (i: number) => `${sides[i]}:${Math.floor(hb(i) / SL)}`;
  const bins = new Map<string, { x: number; z: number; n: number }>();
  for (let i = 0; i < pos.count; i++) {
    if (!leg(i)) continue;
    const b = bins.get(bk(i)) ?? { x: 0, z: 0, n: 0 };
    b.x += pos.getX(i); b.z += pos.getZ(i); b.n++;
    bins.set(bk(i), b);
  }
  for (const b of bins.values()) { b.x /= b.n; b.z /= b.n; }
  // con esqueleto, el eje de la pierna de verdad (cadera, rodilla, tobillo): el centro de la pernera ancha
  // no lo es, y la pierna salía torcida y con bultos
  if (skel) {
    const at = (re: RegExp) => {
      const j = skel.bones.findIndex((b) => re.test(b.name));
      return j < 0 ? null : new THREE.Vector3().setFromMatrixPosition(skel.boneInverses[j].clone().invert());
    };
    for (const side of ['L', 'R'] as const) {
      const n = side === 'L' ? 'Left' : 'Right';
      const pts = [at(new RegExp(n + 'Foot$')), at(new RegExp(n + 'Leg$')), at(new RegExp(n + 'UpLeg$'))].filter(Boolean) as THREE.Vector3[];
      if (pts.length < 3) continue;
      pts.sort((a, b) => a.y - b.y);
      for (const [k, b] of bins) {
        if (!k.startsWith(side + ':')) continue;
        const y = y0 + (Number(k.split(':')[1]) + 0.5) * SL * H;
        const [p0, p1] = y < pts[1].y ? [pts[0], pts[1]] : [pts[1], pts[2]];
        const u = THREE.MathUtils.clamp((y - p0.y) / (p1.y - p0.y), 0, 1);
        b.x = THREE.MathUtils.lerp(p0.x, p1.x, u);
        b.z = THREE.MathUtils.lerp(p0.z, p1.z, u) + 0.006;
      }
    }
  }
  const out = src.clone();
  const op = out.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (!leg(i)) continue;
    const h = hb(i), b = bins.get(bk(i))!;
    const dx = pos.getX(i) - b.x, dz = pos.getZ(i) - b.z, d = Math.max(1e-6, Math.hypot(dx, dz));
    // con pantalón corto, la pierna desnuda: muslo, rodilla, gemelo y tobillo de una pierna de verdad
    const target = bare ? H * legBare(h) : H * THREE.MathUtils.lerp(0.033, 0.049, THREE.MathUtils.clamp((h - LOW) / (0.45 - LOW), 0, 1));
    const blend = THREE.MathUtils.smoothstep(TOP - h, 0, 0.035); // sin escalón en la cadera
    const nd = bare ? d + (target - d) * blend : d + (0.12 * d + 0.88 * target - d) * blend;
    op.setXYZ(i, b.x + (dx / d) * nd, pos.getY(i), b.z + (dz / d) * nd);
  }
  out.computeVertexNormals();
  jeansCache.set(ck, out);
  return out;
}

/** Radio de la pierna desnuda (respecto a la altura) según la altura: tobillo, gemelo, rodilla y muslo. */
function legBare(h: number) {
  const K: [number, number][] = [[0.055, 0.018], [0.12, 0.022], [0.2, 0.029], [0.27, 0.025], [0.33, 0.03], [0.45, 0.041], [0.52, 0.047]];
  for (let k = 1; k < K.length; k++) if (h <= K[k][0]) return THREE.MathUtils.lerp(K[k - 1][1], K[k][1], (h - K[k - 1][0]) / (K[k][0] - K[k - 1][0]));
  return K[K.length - 1][1];
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
      const hairline = cy + ry * (0.55 - 0.25 * Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(a - 0.377), Math.cos(a - 0.377))) / 1.15)); // flequillo ladeado
      // (la malla solo se quita con margen: el borde exacto lo recorta el sombreador, sin escalones)
      keep.push(!(front > 0.56 && y < hairline - ry * 0.28));
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
  // El contorno de la cara, recortado píxel a píxel: flequillo ladeado con el borde limpio y algo de mecha
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHair = { value: new THREE.Vector4(cx, cz, cy, ry) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHairP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHairP;\nuniform vec4 uHair;').replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      {
        vec2 hd = vHairP.xz - uHair.xy;
        float ha = atan(hd.x, hd.y);
        if (ha < 0.0) ha += 6.28318;
        float hdA = abs(mod(ha - 0.377 + 3.14159, 6.28318) - 3.14159);
        float hl = uHair.z + uHair.w * (0.55 - 0.25 * max(0.0, 1.0 - hdA / 1.15)) + uHair.w * (0.009 * sin(ha * 37.0) + 0.006 * sin(ha * 83.0));
        if (cos(ha) > 0.42 && vHairP.y < hl) discard;
      }`,
    );
  };
  mat.customProgramCacheKey = () => 'hair-clip';
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
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
    // Nadie está quieto del todo: de pie, de vez en cuando asiente y habla con las manos, como charlando
    if (r.mode === 'idle' && !r.noFidget) {
      r.fidNext ??= 1 + Math.random() * 6;
      r.fidNext -= dt;
      if (r.fidNext <= 0 && !(r.fidLeft! > 0) && moving < 0.1) {
        r.fidLeft = D.clips.agree.duration * (0.8 + Math.random() * 0.8);
        r.act.agree.time = Math.random() * D.clips.agree.duration * 0.3;
        r.act.agree.timeScale = 0.75 + Math.random() * 0.4;
        r.fidNext = 2.5 + Math.random() * 5;
      }
      if (r.fidLeft! > 0) {
        r.fidLeft! -= dt;
        const f = 0.8 * Math.min(1, r.fidLeft! / 0.4) * tw.idle;
        tw.agree = f;
        tw.idle -= f;
      }
    }
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
