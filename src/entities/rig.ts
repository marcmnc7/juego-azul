import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../core/assets';
import { airOf } from '../core/air';
import type { Person, PersonLook, PersonMode } from './models';
// El baile (samba) con su esqueleto y su T, sacado del modelo de Michelle que se usaba antes
import danceUrl from '../assets/chars/dance_samba.glb';
import animsUrl from '../assets/chars/anims.glb';
// Universal Animation Library de Quaternius (CC0), con los huesos renombrados a Mixamo (scripts/anims_ual.mjs):
// trote, sprint, salto, hablar, sentarse, conducir, nadar, otro baile, sí/no, beber…
import animsUalUrl from '../assets/chars/anims_ual.glb';
import animsUal2Url from '../assets/chars/anims_ual_2.glb';
import { twoBone } from './embrace';
// Plantillas ligeras de VRoid (scripts/crowd_lod.mjs a partir de VRM del reparto): la gente sin VRM propio y la multitud
import tplM1Url from '../assets/crowd/vroid/extra_m1.glb';
import tplM2Url from '../assets/crowd/vroid/extra_m2.glb';
import tplH1Url from '../assets/crowd/vroid/extra_h1.glb';
import tplH2Url from '../assets/crowd/vroid/extra_h2.glb';
import tplIm1Url from '../assets/crowd/vroid/amiga_imperi_1.glb';
import tplIm2Url from '../assets/crowd/vroid/amiga_imperi_2.glb';
import tplImhUrl from '../assets/crowd/vroid/amigo_imperi.glb';
import tplH4Url from '../assets/crowd/vroid/extra_h4.glb';
import tplAzulUrl from '../assets/crowd/vroid/azul_diario.glb';
import tplGasUrl from '../assets/crowd/vroid/gas_diario.glb';
import tplKidUrl from '../assets/crowd/vroid/nino_3.glb';
import tplKidGirlUrl from '../assets/crowd/vroid/nino_2.glb';
import type { VRM } from '@pixiv/three-vrm';
import { loadVRM, copyVRM, disposeVRM, forgetVRM, resetVRM, tickVRM, newFace, type LoadedVRM, type VRMFace } from './vrm';

// Personajes de la prueba de concepto: modelos glTF con esqueleto (rig de Mixamo) y animaciones de
// captura de movimiento (Mixamo), con el mismo retargeting en espacio mundo de la prueba.
//
// Para que el código de los niveles siga funcionando igual, cada personaje conserva el "esqueleto"
// del muñeco de siempre (body, head, armL, kneeR…) como articulaciones invisibles. animatePerson las
// sigue moviendo, pero lo que se ve lo mueve la captura de movimiento (reposo, andar, correr,
// bailar). Cuando un nivel coloca una articulación a mano (llevar la pomada, el beso, tocar el
// fabiol) o el modo no tiene captura (saludar, celebrar, hablar), esa parte del cuerpo copia la
// articulación invisible, con una transición suave.

/**
 * Plantillas de VRoid: quién sale de cada una. crowd: la multitud (y la gente sin VRM de su tipo); azul, gas: ellos
 * cuando no queda copia de su VRM (en un coche, por ejemplo); kid: los niños sin VRM.
 */
export const TEMPLATES = [
  { key: 'tpl:extra_m1', url: tplM1Url, role: 'crowd', female: true, shorts: true, height: 1.63 },
  { key: 'tpl:extra_m2', url: tplM2Url, role: 'crowd', female: true, shorts: true, height: 1.63 },
  { key: 'tpl:extra_h1', url: tplH1Url, role: 'crowd', female: false, shorts: true, height: 1.74 },
  { key: 'tpl:extra_h2', url: tplH2Url, role: 'crowd', female: false, shorts: true, height: 1.74 },
  { key: 'tpl:amiga_imperi_1', url: tplIm1Url, role: 'crowd', female: true, shorts: false, height: 1.63 },
  { key: 'tpl:amiga_imperi_2', url: tplIm2Url, role: 'crowd', female: true, shorts: false, height: 1.63 },
  { key: 'tpl:amigo_imperi', url: tplImhUrl, role: 'crowd', female: false, shorts: false, height: 1.74 },
  { key: 'tpl:extra_h4', url: tplH4Url, role: 'crowd', female: false, shorts: false, height: 1.74 },
  { key: 'tpl:azul_diario', url: tplAzulUrl, role: 'azul', female: true, shorts: false, height: 1.66 },
  { key: 'tpl:gas_diario', url: tplGasUrl, role: 'gas', female: false, shorts: false, height: 1.8 },
  { key: 'tpl:nino_3', url: tplKidUrl, role: 'kid', female: false, shorts: true, height: 1.3 },
  { key: 'tpl:nino_2', url: tplKidGirlUrl, role: 'kid', female: true, shorts: true, height: 1.3 },
] as const;
export type TemplateKey = (typeof TEMPLATES)[number]['key'];
/** Las plantillas cargadas, intactas (para hornear la multitud) y su color de piel y luminosidad por zona. */
const tplSrc = new Map<string, { gltf: GLTF; info: TplInfo }>();
interface TplInfo { skin: THREE.Color; lum: THREE.Vector3 }

export interface KindData {
  gltf: GLTF;
  clips: Record<string, THREE.AnimationClip>;
  /** Rotación en mundo de cada hueso con los brazos caídos (la pose de reposo del muñeco). */
  down: Map<string, THREE.Quaternion>;
  walkSpeed: number;
  runSpeed: number;
  scale: number;
  minY: number;
  /**
   * Desplazamiento de las personas: andar, trotar y esprintar, de más lenta a más rápida, con la velocidad a la
   * que cada clip pisa sin patinar y la fase en que el pie izquierdo va más adelantado (para sincronizarlos).
   */
  loco: { clip: string; speed: number; phase: number }[];
  /** Instante del aterrizaje en jumpLand (la cadera más baja). */
  landAt: number;
}

/** Clips extra (de otros esqueletos ya renombrados a Mixamo), con su pose en T. */
interface ExtraSource { root: THREE.Object3D; rest: Pose; clips: THREE.AnimationClip[] }

/** Las plantillas de VRoid ("tpl:<nombre>") y cada VRM del reparto por su archivo ("vrm:<url>"). */
type DataKey = `tpl:${string}` | `vrm:${string}`;
let data: Partial<Record<DataKey, KindData>> = {};
/**
 * VRM cargados por archivo: una o varias copias (una por persona viva que lo lleve; ver castFor en characters.ts) y
 * quién lleva cada una. El modelo no se clona (romperia cara y pelo): cada copia es un VRM leído aparte.
 */
const vrmPool = new Map<string, LoadedVRM[]>();
const vrmOwner = new Map<LoadedVRM, Person>();
/** Lo que hace falta para preparar un VRM nuevo (las capturas y su pose), guardado al cargar los personajes. */
let vrmPrep: { anims: GLTF; aBind: ReturnType<typeof saveLocal>; dance: { clip: THREE.AnimationClip; rest: Pose; root: THREE.Object3D }; extras: ExtraSource[] } | null = null;
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



/** Fase (0…1) del ciclo en que el pie izquierdo va más adelantado: para que andar, trotar y correr pisen a la vez. */
function footPhase(root: THREE.Object3D, clip: THREE.AnimationClip) {
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(clip).play();
  const foot = boneMap(root).get('LeftFoot'), hips = boneMap(root).get('Hips');
  let best = 0, bz = -Infinity;
  if (foot && hips)
    for (let i = 0; i < 40; i++) {
      a.time = (clip.duration * i) / 40;
      mixer.update(0);
      root.updateWorldMatrix(true, true);
      const z = foot.getWorldPosition(_v1).z - hips.getWorldPosition(_v2).z;
      if (z > bz) { bz = z; best = i / 40; }
    }
  a.stop();
  mixer.uncacheRoot(root);
  return best;
}

/** Corrección de la zancada a velocidad real por tipo de marcha (ver prepareKind). */
const STRIDE_FACTOR: Record<string, number> = { walk: 1, walk2: 1, jog: 1.26, sprint: 1.52, run: 1.3 };

/** Instante de un clip en que la cadera está más baja (el golpe del aterrizaje). */
function lowestHips(clip: THREE.AnimationClip | undefined) {
  const tr = clip?.tracks.find((t) => /Hips/.test(t.name) && t.name.endsWith('.position'));
  if (!tr) return 0;
  let best = 0, by = Infinity;
  for (let i = 0; i < tr.times.length; i++) if (tr.values[i * 3 + 1] < by) { by = tr.values[i * 3 + 1]; best = tr.times[i]; }
  return best;
}

function prepareKind(gltf: GLTF, anims: GLTF, animsBind: ReturnType<typeof saveLocal>, dance: { clip: THREE.AnimationClip; rest: Pose; root: THREE.Object3D } | undefined, height: number, extras: ExtraSource[] = []): KindData {
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
  // La suela, no el hueso del pie: el último hueso queda por encima de la suela y los pies se hundían en el suelo
  model.updateWorldMatrix(true, true);
  const soleY = new THREE.Box3().setFromObject(model, true).min.y;
  // De la planta del pie a la coronilla (el último hueso de la cabeza queda algo por debajo)
  const scale = height / ((box.max.y - box.min.y) * 1.04);
  restoreLocal(animsBind);
  setPose(anims.scene, false);
  const srcRest = worldPose(anims.scene);
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const c of anims.animations) clips[c.name] = retargetClip(anims.scene, srcRest, c, model, dstRest);
  restoreLocal(bind);
  if (dance) clips.dance = dance.root === model ? dance.clip : retargetClip(dance.root, dance.rest, dance.clip, model, dstRest);
  restoreLocal(bind);
  for (const ex of extras)
    for (const c of ex.clips) {
      clips[c.name] = retargetClip(ex.root, ex.rest, c, model, dstRest);
      restoreLocal(bind);
    }
  setPose(model, true);
  const down = worldPose(model).q;
  restoreLocal(bind);
  const walkSpeed = strideSpeed(model, clips.walk, scale) || 1.4;
  const runSpeed = strideSpeed(model, clips.run, scale) || 4.5;
  // Andar, trotar y esprintar (los de la librería si están: son del mismo "actor" y casan entre sí)
  const loco: KindData['loco'] = [];
  for (const [name, fb] of [['walk2', 'walk'], ['jog', 'run'], ['sprint', '']] as const) {
    const n = clips[name] ? name : fb;
    if (!n || !clips[n] || loco.some((l) => l.clip === n)) continue;
    // Velocidad natural de cada clip: zancada (recorrido del pie respecto a la cadera) × un factor por tipo de
    // marcha. Andando el pie está apoyado medio ciclo y basta la zancada (coincide con medir el pie apoyado);
    // corriendo hay fase de vuelo y la zancada se queda corta. Los factores salen de medir los clips de la
    // librería en el juego (trote ≈ 3,2 m/s y sprint ≈ 5 m/s en Azul): así a la velocidad del jugador
    // (5,2 m/s) el sprint va a su ritmo natural, ~185 pasos por minuto, y no acelerado.
    const speed = strideSpeed(model, clips[n], scale) * (STRIDE_FACTOR[n] ?? 1);
    if (speed > 0.3) loco.push({ clip: n, speed, phase: footPhase(model, clips[n]) });
  }
  restoreLocal(bind);
  loco.sort((a, b) => a.speed - b.speed);
  return { gltf, clips, down, scale, minY: Math.min(box.min.y, soleY), walkSpeed, runSpeed, loco, landAt: lowestHips(clips.jumpLand) };
}

/** Carga los modelos y prepara las animaciones (una vez). */

export function preloadRig() {
  loading ??= (async () => {
    const [dance, anims, ual1, ual2, ...tpls] = await Promise.all([
      loadGLB(danceUrl), loadGLB(animsUrl), loadGLB(animsUalUrl).catch(() => null), loadGLB(animsUal2Url).catch(() => null),
      ...TEMPLATES.map((t) => loadGLB(t.url).catch(() => null)),
    ]);
    const t0 = performance.now();
    // Clips de la librería: cada esqueleto en su T (sus huesos ya tienen los nombres de Mixamo)
    const SKIP = /^(pickUp|jumpStart2|jumpLoop2|jumpLand2|phoneTalk)$/;
    const extras: ExtraSource[] = [];
    for (const g of [ual1, ual2]) {
      if (!g) continue;
      const root = g.scene;
      setPose(root, false);
      extras.push({ root, rest: worldPose(root), clips: g.animations.filter((c) => !SKIP.test(c.name)) });
    }
    const samba = dance.animations.find((c) => c.name === 'SambaDance')!;
    // El baile de Michelle, respecto a su propia T
    const tp = dance.animations.find((c) => c.name === 'TPose');
    if (tp) {
      const m = new THREE.AnimationMixer(dance.scene);
      m.clipAction(tp).play();
      m.update(0);
      m.uncacheRoot(dance.scene);
    }
    const aBind = saveLocal(anims.scene);
    const wSave = saveLocal(dance.scene);
    setPose(dance.scene, false);
    const wRest = worldPose(dance.scene);
    restoreLocal(wSave);
    data = {};
    const danceSrc = { clip: samba, rest: wRest, root: dance.scene };
    // Las plantillas de VRoid: una copia intacta para la multitud y otra preparada para la gente suelta
    TEMPLATES.forEach((t, i) => {
      const g = tpls[i];
      if (!g) return;
      const body = g.scene.getObjectByName('Body') as THREE.SkinnedMesh | undefined;
      const c = body?.userData.crowd as { skin: number[]; lum: Record<string, number> } | undefined;
      if (!body || !c) return;
      // (la zona de cada vértice, con el nombre que espera el shader)
      if (body.geometry.attributes._zone) body.geometry.setAttribute('aZone', body.geometry.attributes._zone);
      const info = {
        skin: new THREE.Color().setRGB(c.skin[0], c.skin[1], c.skin[2], THREE.SRGBColorSpace),
        lum: new THREE.Vector3(...[c.lum[2], c.lum[3], c.lum[4]].map((l) => Math.max(0.02, Math.pow(l, 2.2)))),
      };
      tplSrc.set(t.key, { gltf: { ...g, scene: SkeletonUtils.clone(g.scene) as THREE.Group }, info });
      data[t.key] = prepareKind(g, anims, aBind, danceSrc, t.height, extras);
    });
    // Personajes de VRoid: se cargan al empezar cada capítulo (ensureVRMs), solo los suyos
    vrmPrep = { anims, aBind, dance: danceSrc, extras };
    console.info(`[rig] personajes y animaciones preparados en ${Math.round(performance.now() - t0)} ms`);
    // (modo prueba: datos de animación a mano desde la consola, para medir y ajustar)
    if (location.hash === '#test') (globalThis as unknown as { __rigData: typeof data }).__rigData = data;
    ready = true;
  })().catch((e) => {
    console.warn('[rig] no se pudieron cargar los personajes', e);
  });
  return loading;
}
export const rigReady = () => ready;

// ---------- Colores de cada personaje ----------

const lin = (hex: number) => new THREE.Color(hex);
const texCache = new Map<string, THREE.Texture>();

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

// ---------- Plantillas de VRoid para la gente sin VRM propio ----------

/** Sombreado de dibujo animado barato, como el MToon de los VRM: dos tonos. */
const TOON = (() => {
  const t = new THREE.DataTexture(new Uint8Array([168, 168, 168, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

/** Plantilla para alguien sin VRM: la suya si es Azul, Gas o un niño; si no, una de su tipo y su ropa. */
function templateFor(look: PersonLook): TemplateKey | null {
  const has = (k: TemplateKey) => !!data[k];
  if (look.azul && has('tpl:azul_diario')) return 'tpl:azul_diario';
  if (look.gas && has('tpl:gas_diario')) return 'tpl:gas_diario';
  if (look.kid) {
    const girl = look.hairStyle === 'long' || look.hairStyle === 'bun' || look.hairStyle === 'pony' || look.hairStyle === 'straight';
    const k = girl ? 'tpl:nino_2' : 'tpl:nino_3';
    if (has(k)) return k;
  }
  const female = !(look.male || look.beard || look.gas || look.hairStyle === 'short' || look.hairStyle === 'cap');
  const crowd = TEMPLATES.filter((t) => t.role === 'crowd' && t.female === female && has(t.key));
  // con falda, la de la falda; con pantalón corto o largo, las que van así
  let pool: readonly (typeof TEMPLATES)[number][] = crowd.filter((t) => t.shorts === !!(look.shorts || look.nude));
  if (look.skirt && !look.shorts) pool = crowd.filter((t) => t.key === 'tpl:amiga_imperi_1');
  if (!pool.length) pool = crowd;
  if (!pool.length) return (TEMPLATES.find((t) => has(t.key))?.key as TemplateKey | undefined) ?? null;
  // (siempre la misma para el mismo personaje)
  const h = ((look.hair * 7 + look.shirt * 3 + look.pants * 5 + look.skin) >>> 0) % pool.length;
  return pool[h].key;
}

const tplMats = new Map<string, THREE.Material>();
/**
 * Material de una plantilla teñido con los colores del personaje: la piel, su textura × (su piel ÷ la de la
 * plantilla); pelo, camiseta y pantalón, el color × la luminosidad de la textura ÷ su media (se ven los pliegues);
 * zapatos y cara, tal cual.
 */
function templateMaterial(key: string, base: THREE.MeshStandardMaterial, look: PersonLook) {
  const src = tplSrc.get(key)!;
  const bottoms = look.nude ? look.skin : look.pants;
  const id = `${key}|${look.hair}|${look.shirt}|${bottoms}|${look.skin}`;
  let mat = tplMats.get(id);
  if (mat) return mat;
  const skin = lin(look.skin);
  const ratio = new THREE.Vector3(skin.r / Math.max(0.004, src.info.skin.r), skin.g / Math.max(0.004, src.info.skin.g), skin.b / Math.max(0.004, src.info.skin.b));
  const col = (h: number) => { const c = lin(h); return new THREE.Vector3(c.r, c.g, c.b); };
  const U = { uHair: { value: col(look.hair) }, uTop: { value: col(look.shirt) }, uBot: { value: col(bottoms) }, uSkin: { value: ratio }, uLum: { value: src.info.lum } };
  const m = new THREE.MeshToonMaterial({ map: base.map, gradientMap: TOON, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aZone;\nvarying float vZone;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvZone = aZone;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uHair, uTop, uBot, uSkin, uLum;\nvarying float vZone;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float zn = floor(vZone + 0.5);
        float lu = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        if (zn < 1.5) diffuseColor.rgb *= uSkin;
        else if (zn < 2.5) diffuseColor.rgb = uHair * clamp(lu / uLum.x, 0.3, 1.7);
        else if (zn < 3.5) diffuseColor.rgb = uTop * clamp(lu / uLum.y, 0.3, 1.7);
        else if (zn < 4.5) diffuseColor.rgb = uBot * clamp(lu / uLum.z, 0.3, 1.7);`,
      );
  };
  m.customProgramCacheKey = () => 'tplPerson';
  mat = m;
  tplMats.set(id, mat);
  return mat;
}

/** Datos de una plantilla para la multitud: su modelo intacto y lo preparado (null si no cargó). */
export function crowdTemplate(key: string) {
  const src = tplSrc.get(key), K = data[key as DataKey];
  return src && K ? { gltf: src.gltf, info: src.info, K } : null;
}

// ---------- Personaje ----------

type Group = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';

export interface Rig {
  kind: DataKey;
  /** Personaje de VRoid: su cara (expresiones) y la física del pelo se actualizan aparte. */
  vrm?: VRM;
  /** Ya ha estado en una escena (si luego se le saca de ella, su VRM queda libre para otro). */
  shown?: boolean;
  face?: VRMFace;
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
  /** Qué gesto suelto está haciendo (agree, yes, no). */
  fidKey?: string;
  /** Sin gestos sueltos (en un abrazo o un beso, que mueven la cabeza y los brazos a mano). */
  noFidget?: boolean;
  /**
   * Gestos sueltos de pie (asentir, decir que sí) cada pocos segundos. Apagados para todos desde el cap. 2: el dueño
   * los veía sin sentido («¿por qué hacen el gesto ese siempre?»). Solo si un capítulo los pide para alguien.
   */
  fidget?: boolean;
  /** Altura de la cadera en reposo, en metros (sin la escala del personaje). */
  hipsHeight: number;
  /** Inclinación de cintura para arriba (ver leanTorso). */
  torso: THREE.Euler;
  /** Inclinación por la marcha (adelante al acelerar, hacia dentro en las curvas): la pone animatePerson. */
  lean: { fwd: 0 | number; side: number };
  /** Manos que llevan algo delante (0…1, la pone el nivel cada fotograma con carryHand). */
  carry: { R: number; L: number };
  /** Lado del modelo ('Left'/'Right') que hace de brazo derecho e izquierdo del muñeco. */
  sideR: string;
  sideL: string;
  /** Baila con el segundo baile en vez de la samba. */
  danceAlt: boolean;
  wasAir: boolean;
  /** Tiempo que le queda al aterrizaje. */
  landT: number;
  yawPrev: number;
  /** Peso de los pasitos al girar sin avanzar. */
  turnStep: number;
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

/**
 * Una copia libre del VRM: sin dueño, o con un dueño que ya no está (su escena se liberó, o lo sacaron de la escena
 * después de haberse visto). Si el dueño anterior sigue en la lista, se le quita: dos personas no pueden mover los
 * mismos huesos.
 */
function takeVRM(url: string): LoadedVRM | undefined {
  const pool = vrmPool.get(url);
  if (!pool || !data[`vrm:${url}`]) return undefined;
  for (const v of pool) {
    const o = vrmOwner.get(v);
    if (o && !ownerGone(o)) continue;
    if (o) people.delete(o);
    return v;
  }
  if (location.hash === '#test') console.warn('[rig] no queda copia libre de', url, '(sube su número en castFor)');
  return undefined;
}

function ownerGone(o: Person) {
  if (!people.has(o)) return true;
  let top: THREE.Object3D = o.root;
  while (top.parent) top = top.parent;
  if ((top as THREE.Scene).isScene) return !!top.userData.disposed;
  return !!o.rig?.shown;
}

/**
 * Deja cargados y preparados los VRM de un capítulo, con su número de copias (los que no existan o no carguen, esos
 * personajes salen con su modelo de antes). Prepararlos (pasarles las capturas) se hace una vez por archivo.
 */
export async function ensureVRMs(need: [url: string, count: number, height: number][]) {
  await (loading ?? preloadRig());
  if (!vrmPrep) return;
  const P = vrmPrep;
  for (const [url, count, height] of need) {
    try {
      let pool = vrmPool.get(url);
      if (!pool) {
        const v = await loadVRM(url);
        pool = [v];
        vrmPool.set(url, pool);
        data[`vrm:${url}`] = prepareKind(v.gltf, P.anims, P.aBind, P.dance, height, P.extras);
      }
      while (pool.length < count) pool.push(await copyVRM(url, pool[0]));
    } catch (e) {
      console.warn('[rig] VRM no cargado', url, e);
    }
  }
}

/** Suelta los VRM que el capítulo siguiente no usa (memoria de vídeo y de los bytes del archivo). */
export function releaseVRMs(keep: Set<string>) {
  for (const [url, pool] of vrmPool) {
    if (keep.has(url)) continue;
    for (const v of pool) {
      const o = vrmOwner.get(v);
      if (o) people.delete(o);
      vrmOwner.delete(v);
      disposeVRM(v);
    }
    vrmPool.delete(url);
    delete data[`vrm:${url}`];
    forgetVRM(url);
  }
}

/** Crea un personaje glTF con las mismas articulaciones (invisibles) que el muñeco de siempre. */
export function makeRigPerson(look: PersonLook, scale: number, blob: THREE.Object3D): Person {
  // Con su VRM de VRoid si lo tiene, está cargado y queda una copia libre (si no, su modelo de antes)
  const loaded = look.vrm ? takeVRM(look.vrm) : undefined;
  // (si no, una plantilla de VRoid de su tipo, teñida con sus colores)
  const kind: DataKey = loaded ? `vrm:${look.vrm}` : templateFor(look)!;
  const D = data[kind]!;
  const root = new THREE.Group();
  root.userData.noCam = true; // se mueve: la cámara no choca con ello
  if (loaded) resetVRM(loaded);
  const model = loaded ? loaded.vrm.scene : SkeletonUtils.clone(tplSrc.get(kind)!.gltf.scene);
  model.scale.setScalar(D.scale);
  model.position.y = -D.minY * D.scale;
  root.add(model);

  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh || loaded) return;
    m.castShadow = true;
    // Sin sombra propia: en los primeros planos, la del pelo y la nariz les manchaba la cara de gris
    m.receiveShadow = false;
    m.userData.noReceive = true;
    // Su propio sombreado de dibujo animado, como los VRM: el paso de cómic no lo toca
    m.userData.noComic = true;
    m.frustumCulled = false;
    m.material = templateMaterial(kind, m.material as THREE.MeshStandardMaterial, look);
  });
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
  // Básicos y, si están, los de la librería (desplazamiento, salto, hablar, otro baile, sí y no)
  const names = ['idle', 'walk', 'run', 'dance', 'agree', ...D.loco.map((l) => l.clip), 'dance2', 'talk', 'yes', 'no', 'jumpLand'];
  for (const n of names) if (D.clips[n] && !act[n]) act[n] = mixer.clipAction(D.clips[n]).play();
  if (D.clips.jumpLoop) act.air = mixer.clipAction(D.clips.jumpLoop).play();
  else {
    // sin clip de salto: la pose de correr congelada
    const air = mixer.clipAction(D.clips.run.clone());
    air.play();
    air.time = D.clips.run.duration * 0.3;
    air.timeScale = 0;
    act.air = air;
  }
  if (act.jumpLand) act.jumpLand.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
  const w: Record<string, number> = {};
  for (const k in act) {
    w[k] = k === 'idle' ? 1 : 0;
    act[k].setEffectiveWeight(w[k]);
  }
  act.idle.time = Math.random() * D.clips.idle.duration;
  act.dance.time = Math.random() * D.clips.dance.duration;
  if (act.talk) act.talk.time = Math.random() * act.talk.getClip().duration;

  const rig: Rig = {
    kind, model, mixer, act, w, mode: 'idle', snap: new Map(), snapBodyY: 0,
    gw: { body: 0, head: 0, armL: 0, armR: 0, legL: 0, legR: 0 },
    bones: B, map, hipsY: B.get('Hips')!.position.y, last: new THREE.Vector3(NaN, 0, 0), speed: 0, torso: new THREE.Euler(0, 0, 0, 'YXZ'),
    hipsHeight: B.get('Hips')!.getWorldPosition(new THREE.Vector3()).y / scale,
    vrm: loaded?.vrm, face: loaded ? newFace() : undefined,
    lean: { fwd: 0, side: 0 }, carry: { R: 0, L: 0 }, sideR: pos, sideL: neg,
    danceAlt: !!act.dance2 && Math.random() < 0.5, wasAir: false, landT: 0, yawPrev: NaN, turnStep: 0,
  };
  const p: Person = {
    root, body, head: headJ, eyes, legL, legR, armL, armR, handR,
    kneeL, kneeR, footL, footR, elbowL, elbowR,
    blink: 2 + Math.random() * 3, t: Math.random() * 10, rig,
  };
  if (loaded) vrmOwner.set(loaded, p);
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

/** Cuánto sprint como máximo en la mezcla de la marcha (el resto, trote): menos zancada y menos braceo. */
const SPRINT_MAX = 0.55;
/** Tronco algo más erguido al esprintar (radianes con el sprint entero): el clip se inclina ~34°. */
const SPRINT_UPRIGHT = 0.3;

/** Pesos de andar/trotar/esprintar para una velocidad: entre los dos clips cuya velocidad la rodea. */
function locoWeights(L: KindData['loco'], sp: number) {
  const w = L.map(() => 0);
  if (!L.length) return w;
  if (sp <= L[0].speed) w[0] = 1;
  else if (sp >= L[L.length - 1].speed) w[L.length - 1] = 1;
  else
    for (let i = 0; i < L.length - 1; i++)
      if (sp < L[i + 1].speed) {
        // lineal: así la zancada mezclada coincide con la velocidad real y los clips van a su ritmo natural
        const f = (sp - L[i].speed) / (L[i + 1].speed - L[i].speed);
        w[i] = 1 - f;
        w[i + 1] = f;
        break;
      }
  // Carrera más suave: el sprint de la librería es de atleta; como mucho SPRINT_MAX de él y el resto, trote
  if (L.length >= 3 && w[L.length - 1] > SPRINT_MAX) {
    w[L.length - 2] += w[L.length - 1] - SPRINT_MAX;
    w[L.length - 1] = SPRINT_MAX;
  }
  return w;
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _ca = new THREE.Vector3();
const _cc = new THREE.Vector3();
const _ch = new THREE.Vector3();
const _ct = new THREE.Vector3();
const _cp = new THREE.Vector3();
const _co = new THREE.Vector3();

/** El nivel la llama cada fotograma mientras la persona lleva algo en esa mano (brazo del muñeco: 'R' o 'L'). */
export function carryHand(p: Person, side: 'R' | 'L', w = 1) {
  if (p.rig) p.rig.carry[side] = Math.max(p.rig.carry[side], w);
}

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
  // Cuánto gira sobre sí mismo (para dar pasitos en vez de patinar)
  const yaw = p.root.rotation.y;
  const yawRate = !Number.isNaN(r.yawPrev) && dt > 0 ? Math.atan2(Math.sin(yaw - r.yawPrev), Math.cos(yaw - r.yawPrev)) / dt : 0;
  r.yawPrev = yaw;

  const airS = airOf.get(p.root.position);
  const inAir = !!airS && airS.hop > 0.05;
  // Aterrizaje: el golpe del clip (rodillas que ceden) justo al tocar el suelo
  if (r.wasAir && !inAir && r.act.jumpLand) {
    r.landT = 0.5;
    const a = r.act.jumpLand;
    a.reset();
    a.time = Math.max(0, D.landAt - 0.1);
    a.timeScale = 1.2;
    a.play();
  }
  r.wasAir = inAir;
  r.landT = Math.max(0, r.landT - dt);

  const L = D.loco;
  const tw: Record<string, number> = {};
  for (const n in r.act) tw[n] = 0;
  if (inAir) tw.air = 1;
  else if (r.mode === 'dance' || r.mode === 'cheer') tw[r.danceAlt ? 'dance2' : 'dance'] = 1;
  else {
    const moving = r.mode === 'walk' ? THREE.MathUtils.smoothstep(sp, 0.05, 0.5) : 0;
    locoWeights(L, sp).forEach((w, i) => (tw[L[i].clip] += moving * w));
    let rest = 1 - moving;
    // Girando sin avanzar: pasitos (el clip de andar, despacio) en vez de pivotar con los pies clavados
    const turnWant = rest > 0.5 && Math.abs(yawRate) > 1.2 ? Math.min(0.75, 0.35 + (Math.abs(yawRate) - 1.2) * 0.35) : 0;
    r.turnStep += (turnWant - r.turnStep) * Math.min(1, dt * 8);
    if (r.turnStep > 0.01 && L.length) {
      tw[L[0].clip] += r.turnStep * rest;
      rest *= 1 - r.turnStep;
    }
    // Hablando: el clip de hablar gesticulando (si no lo hay, el muñeco mueve el brazo)
    const still = r.mode === 'talk' && r.act.talk ? 'talk' : 'idle';
    tw[still] += rest;
    // De pie, de vez en cuando asiente o dice que sí, como charlando: solo quien lo tenga pedido (`fidget`)
    if (r.mode === 'idle' && r.fidget && !r.noFidget) {
      r.fidNext ??= 1 + Math.random() * 6;
      r.fidNext -= dt;
      if (r.fidNext <= 0 && !(r.fidLeft! > 0) && moving < 0.1) {
        const opts = ['agree', 'agree', 'yes'].filter((n) => r.act[n]);
        r.fidKey = opts[Math.floor(Math.random() * opts.length)];
        const a = r.act[r.fidKey];
        const du = a.getClip().duration;
        r.fidLeft = Math.min(du, 2.2) * (0.8 + Math.random() * 0.5);
        a.time = Math.random() * du * 0.3;
        a.timeScale = 0.8 + Math.random() * 0.35;
        r.fidNext = 2.5 + Math.random() * 5;
      }
      if (r.fidLeft! > 0 && r.fidKey) {
        r.fidLeft! -= dt;
        const f = 0.8 * Math.min(1, r.fidLeft! / 0.4) * tw.idle;
        tw[r.fidKey] += f;
        tw.idle -= f;
      }
    }
    // Recién aterrizada: encima de lo demás (menos si ya va corriendo)
    if (r.landT > 0 && r.act.jumpLand) {
      const f = Math.min(1, r.landT / 0.2) * (moving > 0.5 ? 0.4 : 0.85);
      for (const n in tw) tw[n] *= 1 - f;
      tw.jumpLand = f;
    }
  }
  const k = 1 - Math.exp(-10 * dt);
  for (const n in tw) {
    r.w[n] += (tw[n] - r.w[n]) * k;
    if (r.w[n] < 1e-3) r.w[n] = 0;
    r.act[n].setEffectiveWeight(r.w[n]);
  }
  // Cadencia: todos los clips de marcha al mismo ritmo y en la misma fase, para que el pie apoyado no patine
  let lead: KindData['loco'][number] | null = null, lw = 0, wsum = 0, dist = 0;
  for (const l of L) {
    const ww = r.w[l.clip];
    if (ww > lw) { lw = ww; lead = l; }
    wsum += ww;
    dist += ww * l.speed * r.act[l.clip].getClip().duration;
  }
  if (lead && wsum > 0.01) {
    dist /= wsum;
    const effSp = Math.max(sp, r.turnStep > 0.05 ? L[0].speed * 0.55 : 0);
    const leadDur = r.act[lead.clip].getClip().duration;
    // ciclos por segundo, sin pasarse de lo que el clip aguanta sin verse acelerado o a cámara lenta
    const rate = THREE.MathUtils.clamp(effSp / dist, 0.55 / leadDur, 1.3 / leadDur);
    const la = r.act[lead.clip];
    const ph = (la.time / leadDur - lead.phase + 1) % 1;
    for (const l of L) {
      const a = r.act[l.clip];
      const du = a.getClip().duration;
      a.timeScale = rate * du;
      if (l !== lead) a.time = ((ph + l.phase) % 1) * du;
    }
  }
  r.mixer.update(dt);

  // Partes del cuerpo que mandan las articulaciones del muñeco (saludar: solo el brazo que saluda)
  const forcedR = r.mode === 'wave' || (r.mode === 'talk' && !r.act.talk);
  const want: Record<Group, number> = {
    // (bajar el cuerpo de verdad, como al sentarse, sí cuenta; unos centímetros no: el nivel 1 pone la altura
    // del muñeco a 0 después de animarlo, eso solo quitaba el bote de la marcha y hacía que la cadera de la
    // captura se sustituyera por la del muñeco, recta: corría tiesa y "sentada")
    body: changed(r, p.body) || Math.abs(p.body.position.y - r.snapBodyY) > 0.1 ? 1 : 0,
    head: changed(r, p.head) ? 1 : 0,
    armL: changed(r, p.armL) || changed(r, p.elbowL) ? 1 : 0,
    armR: forcedR || changed(r, p.armR) || changed(r, p.elbowR) ? 1 : 0,
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
  // (con algo de sprint en la mezcla, el tronco un poco más erguido: ver SPRINT_UPRIGHT)
  const lf = r.lean.fwd - (L.length >= 3 ? SPRINT_UPRIGHT * r.w[L[L.length - 1].clip] : 0), ls = r.lean.side;
  const lean = t.x !== 0 || t.y !== 0 || t.z !== 0 || Math.abs(lf) > 1e-4 || Math.abs(ls) > 1e-4;
  const carrying = r.carry.R > 0.01 || r.carry.L > 0.01;
  if (!any && !lean && !carrying) return;
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
  const turn = (b: THREE.Object3D | undefined, x: number, y: number, z: number) => {
    if (!b) return;
    _torsoE.set(x, y, z, 'YXZ');
    _torsoQ.setFromEuler(_torsoE);
    // Giro en los ejes del personaje, pasado a mundo y aplicado encima de la pose del hueso
    _torsoW.copy(_rootQ).multiply(_torsoQ).multiply(rootInv);
    b.getWorldQuaternion(_target).premultiply(_torsoW);
    b.parent!.getWorldQuaternion(_parent);
    b.quaternion.copy(_parent.invert()).multiply(_target);
    b.updateWorldMatrix(false, true);
  };
  if (lean) {
    // La marcha: hacia dentro en las curvas con todo el cuerpo (desde la cadera); adelante, con la columna
    if (Math.abs(ls) > 1e-4) turn(r.bones.get('Hips'), 0, 0, ls * 0.7);
    // De cintura para arriba: la columna reparte el giro y caderas y piernas no se enteran
    for (const [bn, w] of TORSO) turn(r.bones.get(bn), (t.x + lf) * w, t.y * w, (t.z + ls * 0.3) * w);
  }
  if (carrying) {
    // Llevar algo delante sin congelar el brazo: la mano va hacia un punto delante del pecho (con algo del
    // balanceo de la animación) y el codo se dobla solo (IK); la mano, recta, para que el vaso no se vuelque
    const chest = r.bones.get('Spine2') ?? r.bones.get('Spine1');
    _fwd.set(0, 0, 1).applyQuaternion(_rootQ);
    for (const side of ['R', 'L'] as const) {
      const w = r.carry[side];
      if (w < 0.01 || !chest) continue;
      const S = side === 'R' ? r.sideR : r.sideL;
      const up = r.bones.get(S + 'Arm'), lo = r.bones.get(S + 'ForeArm'), hand = r.bones.get(S + 'Hand');
      if (!up || !lo || !hand) continue;
      const wsc = p.root.getWorldScale(_co).x;
      chest.getWorldPosition(_cc);
      up.getWorldPosition(_ca);
      hand.getWorldPosition(_ch);
      const out = _co.subVectors(_ca, _cc).projectOnPlane(_up).normalize();
      _ct.copy(_cc).addScaledVector(_fwd, 0.27 * wsc).addScaledVector(out, 0.13 * wsc).addScaledVector(_up, -0.13 * wsc);
      _ct.lerp(_ch, 0.2);
      _cp.copy(_ca).addScaledVector(_up, -0.3 * wsc).addScaledVector(out, 0.3 * wsc).addScaledVector(_fwd, -0.15 * wsc);
      twoBone(up, lo, hand, _ct, _cp, w);
      const down = D.down.get(S + 'Hand');
      if (down) {
        _target.copy(_rootQ).multiply(down);
        hand.parent!.getWorldQuaternion(_parent);
        _local.copy(_parent.invert()).multiply(_target);
        hand.quaternion.slerp(_local, w * 0.85);
        hand.updateWorldMatrix(false, true);
      }
    }
  }
  r.carry.R = r.carry.L = 0;
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
    p.rig!.shown = true;
    updateOne(p, dt);
  }
  for (const f of rigPost) f(dt);
  // Cara y pelo de los VRM al final, con la pose ya terminada (también abrazos y besos)
  for (const p of people) {
    const r = p.rig!;
    if (r.vrm && p.root.parent) tickVRM(r.vrm, r.face!, r.mode, dt);
  }
}

/** Al salir de un capítulo. */
export function clearRigPeople() {
  // Los que el capítulo sacó de la escena antes de salir no los libera su dispose: sus huesos, aquí
  for (const p of people)
    p.root.traverse((o) => {
      (o as THREE.SkinnedMesh).skeleton?.dispose();
    });
  people.clear();
  vrmOwner.clear();
  rigTickers.clear();
  rigPost.clear();
}
