import * as THREE from 'three';
import type { PersonLook } from './models';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGLB } from '../core/assets';
// Burro y caballo animados de Quaternius (Ultimate Animated Animal Pack, CC0), preparados con scripts/animal_glb.mjs:
// quietos, comiendo, al paso y al galope, con su esqueleto. El jinete es un personaje sentado encima.
import donkeyUrl from '../assets/chars/donkey.glb';
import horseUrl from '../assets/chars/horse_q.glb';
import { boneAnchor, makeRigPerson, rigTickers } from './rig';
import { castLook } from '../data/characters';
import type { Donkey } from './models';

interface Prepared {
  gltf: GLTF;
  clips: Record<string, THREE.AnimationClip>;
  scale: number;
  /** Altura del lomo (donde va la silla), ya en metros, y dónde cae a lo largo (para centrar la silla). */
  back: number;
  backZ: number;
  /** Velocidad (m/s) a la que el paso y el galope pisan sin patinar. */
  walkV: number;
  gallopV: number;
}

let prep: Prepared | null = null;
let prepHorse: Prepared | null = null;
let loading: Promise<void> | null = null;

export const donkeyReady = () => !!prep && !!prepHorse;

export function preloadDonkey() {
  loading ??= Promise.all([loadGLB(donkeyUrl), loadGLB(horseUrl)])
    .then(([d, h]) => {
      // Un burro menorquín: lomo a 1,15 m; los caballos de Sant Joan, altos (1,6 m a la cruz)
      prep = prepare(d, 1.15, 1.1, 4.2);
      prepHorse = prepare(h, 1.6, 1.55, 6.5);
    })
    .catch((e) => console.warn('[donkey] no se pudieron cargar los animales', e));
  return loading;
}

function prepare(gltf: GLTF, backHeight: number, walkV: number, gallopV: number): Prepared {
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const c of gltf.animations) clips[c.name] = c;
  // Caras unidas y normales suaves: con facetas parecían de papiroflexia al lado de los personajes
  gltf.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    // (sus atributos vienen intercalados en un solo búfer: se separan antes de unir los vértices)
    const flat = m.geometry.clone();
    for (const [k, a] of Object.entries(flat.attributes)) if ((a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) flat.setAttribute(k, (a as THREE.InterleavedBufferAttribute).clone());
    const g = mergeVertices(flat, 1e-4);
    g.computeVertexNormals();
    m.geometry = g;
  });
  // El lomo, medido en la pose de quieto: lo más alto de la parte central del cuerpo (sin cuello ni cabeza)
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clips.Idle).play();
  mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene, true);
  const z0 = box.min.z, L = box.max.z - box.min.z;
  let back = 0, backZ = 0;
  const v = new THREE.Vector3();
  gltf.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      m.applyBoneTransform(i, v);
      v.applyMatrix4(m.matrixWorld);
      const t = (v.z - z0) / L;
      // (la grupa y el lomo, por delante de la cola y por detrás de la cruz: ni cuello ni cabeza)
      if (t > 0.3 && t < 0.5 && v.y - box.min.y > back) {
        back = v.y - box.min.y;
        backZ = v.z;
      }
    }
  });
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
  return { gltf, clips, scale: backHeight / back, back: backHeight, backZ: backZ * (backHeight / back), walkV, gallopV };
}

const lin = (hex: number) => new THREE.Color(hex);
let riderN = 0;

/** Ase con jinete; la misma interfaz que el de los muñecos (root, pivot, patas, cabeza). */
/** riderLook: otra jinete (21 nov: Azul en la hípica), con casco de montar en vez de bombín. */
export function makeDonkeyHD(coat: number, shadow: THREE.Object3D, horse = false, riderLook?: PersonLook): Donkey {
  const P = horse ? prepHorse! : prep!;
  const root = new THREE.Group();
  root.userData.noCam = true; // se mueve: la cámara no choca con ello
  root.userData.person = true; // (se aparta si se cruza pegado a la cámara, como la gente)
  const pivot = new THREE.Group();
  pivot.position.z = -0.75;
  root.add(pivot);
  const inner = new THREE.Group();
  inner.position.z = 0.75;
  pivot.add(inner);

  // El animal, con su pelo del color que pide la escena (cuerpo, tonos claros y oscuros) y la crin más oscura
  const model = SkeletonUtils.clone(P.gltf.scene);
  model.scale.setScalar(P.scale);
  // (el lomo, justo debajo de la silla)
  model.position.z = -P.backZ - 0.05;
  const base = lin(coat);
  const shade = (k: number) => base.clone().multiplyScalar(k);
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const src = m.material as THREE.MeshStandardMaterial;
    // (el caballo menorquín, negro con brillo: algo de reflejo para que se le vea el volumen)
    const mat = new THREE.MeshStandardMaterial({ name: src.name, color: src.color.clone(), roughness: horse ? 0.36 : 0.9, metalness: horse ? 0.12 : 0 });
    if (src.name === 'Main') mat.color.copy(horse ? base.clone().lerp(new THREE.Color(0x3a2e28), 0.25) : base);
    else if (src.name === 'Main_Light') mat.color.copy(horse ? base.clone().lerp(new THREE.Color(0x6a5446), 0.3) : base.clone().lerp(new THREE.Color(0xe8e0d4), 0.55));
    else if (src.name === 'Main_Dark') mat.color.copy(shade(0.72));
    else if (src.name === 'Hair') mat.color.copy(horse ? shade(0.5) : shade(0.45));
    else if (src.name === 'Muzzle') mat.color.copy(horse ? shade(0.6) : new THREE.Color(0xd8cfc2));
    m.material = mat;
  });
  inner.add(model);
  const back = P.back;

  // La silla: manta que abraza el lomo, asiento de cuero con arzón y borrén, cincha y estribos
  const tack = new THREE.Group();
  tack.position.set(0, back, -0.05);
  const std = (color: number, roughness: number) => new THREE.MeshStandardMaterial({ color: lin(color), roughness, side: THREE.DoubleSide });
  const R = 0.36;
  const padMat = std(horse ? 0x2c1216 : 0x9b2335, 0.9);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.72, 20, 1, true, Math.PI - 1.0, 2.0).rotateX(Math.PI / 2), padMat);
  pad.position.y = 0.012 - R;
  const leather = std(horse ? 0x17100c : 0x6e4526, 0.5);
  const seat = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), leather);
  seat.scale.set(0.36, 0.09, 0.58);
  seat.position.y = 0.05;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), leather);
  pommel.scale.set(0.2, 0.13, 0.13);
  pommel.position.set(0, 0.1, 0.27);
  const cantle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), leather);
  cantle.scale.set(0.28, 0.17, 0.1);
  cantle.position.set(0, 0.11, -0.3);
  const iron = new THREE.MeshStandardMaterial({ color: lin(0x8f9296), roughness: 0.35, metalness: 0.8 });
  const dark = std(0x17100c, 0.7);
  const girth = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.07, 22, 1, true, Math.PI - 1.5, 3.0).rotateX(Math.PI / 2), dark);
  girth.position.set(0, 0.012 - R, 0.1);
  tack.add(pad, seat, pommel, cantle, girth);
  for (const sx of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.03), dark);
    strap.position.set(sx * 0.335, -0.27, 0.08);
    strap.rotation.z = sx * 0.1;
    const stirrup = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14), iron);
    stirrup.position.set(sx * 0.36, -0.52, 0.08);
    stirrup.rotation.y = Math.PI / 2;
    tack.add(strap, stirrup);
  }
  tack.traverse((o) => (o.castShadow = true));
  inner.add(tack);

  // Jinete. En los caballos, el caixer: frac negro, pantalón blanco, botas y bombín. En los burros de
  // Ferreries, uno del pueblo en ropa de verano y sin sombrero.
  const R0 = riderN++;
  const rider = makeRigPerson(
    riderLook ??
    (horse
      ? castLook({ skin: 0xe8b894, shirt: 0x1b1b22, pants: 0xf3f0ea, hair: 0x2a1d14, hairStyle: 'short', male: true, shoes: 0x111111 }, 'caixer')
      : { skin: [0xe8b894, 0xd9a27c, 0xf0c8a6, 0xc98e64][R0 % 4], shirt: [0xffffff, 0x2f6b8a, 0xd7263d, 0xe9c75a][R0 % 4], pants: [0x3b4a6b, 0xc9b48a, 0x6f8fb8, 0x2d2d3a][R0 % 4], hair: [0x2a1d14, 0x6b3f22, 0x1f1610, 0x8a6a40][R0 % 4], hairStyle: 'short', male: true, shorts: true }),
    1,
    new THREE.Object3D(),
  );
  // La cadera unos centímetros por encima del asiento
  rider.root.position.set(0, back + 0.13 - rider.rig!.hipsHeight, -0.05);
  inner.add(rider.root);
  rider.rig!.force = { legL: 1, legR: 1, armL: 1, armR: 1 };
  // A horcajadas de verdad: las piernas por fuera de la barriga (antes se le metían dentro)
  rider.legL.rotation.set(-1.12, 0, -0.78);
  rider.legR.rotation.set(-1.12, 0, 0.78);
  rider.kneeL.rotation.x = rider.kneeR.rotation.x = 1.3;
  rider.armL.rotation.set(-0.45, 0, -0.1);
  rider.armR.rotation.set(-0.45, 0, 0.1);
  rider.elbowL.rotation.x = rider.elbowR.rotation.x = -0.9;
  if (riderLook) {
    // Casco de montar: casquete oscuro con su visera
    const mat = new THREE.MeshStandardMaterial({ color: lin(0x1e2230), roughness: 0.45 });
    const helmet = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    shell.scale.set(1.05, 0.95, 1.12);
    shell.position.y = 0.1;
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), mat);
    peak.position.set(0, 0.1, 0.1);
    helmet.add(shell, peak);
    helmet.traverse((o) => {
      o.castShadow = true;
      o.userData.person = true;
    });
    boneAnchor(rider, 'Head').add(helmet);
  } else if (horse) {
    const black = new THREE.MeshStandardMaterial({ color: lin(0x111111), roughness: 0.55 });
    const hat = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), black);
    crown.scale.y = 1.1;
    crown.position.y = 0.17;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 24), black);
    brim.position.y = 0.175;
    hat.add(crown, brim);
    hat.traverse((o) => {
      o.castShadow = true;
      o.userData.person = true;
    });
    boneAnchor(rider, 'Head').add(hat);
  }

  // Patas y cabeza: las mueve el nivel; aquí solo sirven para saber si anda
  const head = new THREE.Group();
  head.position.set(0, 1.45, 0.75);
  inner.add(head);
  const legs = [0, 1, 2, 3].map(() => {
    const l = new THREE.Group();
    inner.add(l);
    return l;
  });
  root.add(shadow);

  // Quieto, al paso y al galope, mezclados según lo rápido que vaya; quieto, de vez en cuando baja la cabeza o
  // come (el burro más que el caballo)
  const mixer = new THREE.AnimationMixer(model);
  const act = {
    idle: mixer.clipAction(P.clips.Idle).play(),
    rest: mixer.clipAction(P.clips[horse ? 'Idle_2' : 'Eating'] ?? P.clips.Idle).play(),
    walk: mixer.clipAction(P.clips.Walk).play(),
    gallop: mixer.clipAction(P.clips.Gallop).play(),
  };
  const w = { idle: 1, rest: 0, walk: 0, gallop: 0 };
  for (const k of Object.keys(act) as (keyof typeof act)[]) {
    act[k].time = Math.random() * act[k].getClip().duration;
    act[k].setEffectiveWeight(w[k]);
  }
  const last = new THREE.Vector3(NaN, 0, 0);
  let speed = 0;
  let restT = 4 + Math.random() * 8;
  const tick = (dt: number) => {
    if (!root.parent) return;
    const p = root.position;
    if (Number.isNaN(last.x)) last.copy(p);
    const d = Math.hypot(p.x - last.x, p.z - last.z);
    last.copy(p);
    const v = dt > 0 && d < 2 ? d / dt / (root.scale.z || 1) : 0;
    speed += (v - speed) * Math.min(1, dt * 5);
    // Cuánto de cada uno: parado, al paso hasta ~1,6 veces su paso natural y luego al galope
    const moving = THREE.MathUtils.smoothstep(speed, 0.08, 0.35);
    const gal = THREE.MathUtils.smoothstep(speed, P.walkV * 1.5, P.walkV * 2.4);
    if (moving < 0.05) restT -= dt;
    else restT = 4 + Math.random() * 8;
    const resting = restT < 0 && restT > -(horse ? 3.3 : 6) ? 1 : 0;
    if (restT < -(horse ? 3.3 : 6)) restT = 5 + Math.random() * 10;
    const want = { idle: (1 - moving) * (1 - resting), rest: (1 - moving) * resting, walk: moving * (1 - gal), gallop: moving * gal };
    for (const k of Object.keys(act) as (keyof typeof act)[]) {
      w[k] += (want[k] - w[k]) * Math.min(1, dt * 5);
      act[k].setEffectiveWeight(w[k]);
    }
    // Las patas al ritmo de lo que avanza (sin patinar), dentro de un margen natural
    act.walk.timeScale = THREE.MathUtils.clamp(speed / P.walkV, 0.55, 1.5);
    act.gallop.timeScale = THREE.MathUtils.clamp(speed / P.gallopV, 0.6, 1.4);
    mixer.update(dt);
  };
  rigTickers.add(tick);
  return { root, pivot, legs, head };
}
