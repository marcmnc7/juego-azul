import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGLB } from '../core/assets';
import horseUrl from '../assets/chars/horse.glb';
import { boneAnchor, makeRigPerson, rigTickers } from './rig';
import type { Donkey } from './models';

// Ases de la prueba de concepto: el caballo glTF de los ejemplos de three.js (galope con morph
// targets) convertido en ase: orejas largas, pelo pardo y hocico claro. El jinete es un personaje
// glTF sentado, con frac y bombín.

interface Prepared {
  geo: THREE.BufferGeometry;
  clip: THREE.AnimationClip;
  name: string;
  scale: number;
  minY: number;
  backY: number;
  /** Momento del galope con las cuatro patas más recogidas: la pose de estar parado. */
  standT: number;
  /** Metros que avanza en un ciclo de galope (para que las patas no patinen). */
  stride: number;
}

let prep: Prepared | null = null;
/** El mismo caballo sin alargar las orejas, para los caballos negros de Sant Joan. */
let prepHorse: Prepared | null = null;
let loading: Promise<void> | null = null;

export const donkeyReady = () => !!prep;

export function preloadDonkey() {
  loading ??= loadGLB(horseUrl)
    .then((g) => {
      const src = g.scene.getObjectByProperty('isMesh', true) as THREE.Mesh;
      prep = prepare(src, g.animations[0], 2.9, 1.15, true);
      prepHorse = prepare(src, g.animations[0], 1, 1.6);
    })
    .catch((e) => console.warn('[donkey] no se pudo cargar el ase', e));
  return loading;
}

function prepare(src: THREE.Mesh, clip: THREE.AnimationClip, earScale: number, backHeight: number, donkey = false): Prepared {
  const geo = src.geometry.clone();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const morphs = geo.morphAttributes.position as THREE.BufferAttribute[];
  const n = pos.count;

  // Orejas: los vértices de arriba de la cabeza, alargados desde su base (también en cada fotograma)
  const EAR_Y = 172, EAR_Z = 100, S = earScale;
  for (const side of [-1, 1]) {
    const ear: number[] = [];
    for (let i = 0; i < n; i++) if (pos.getY(i) > EAR_Y && pos.getZ(i) > EAR_Z && Math.sign(pos.getX(i) + 0.5) === side) ear.push(i);
    if (!ear.length) continue;
    const low = ear.filter((i) => pos.getY(i) < EAR_Y + 2.5);
    const baseOf = (get: (i: number) => THREE.Vector3) => {
      const c = new THREE.Vector3();
      for (const i of low.length ? low : ear) c.add(get(i));
      return c.divideScalar(low.length || ear.length);
    };
    const B = (i: number) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const P = baseOf(B);
    const nb = new Map<number, THREE.Vector3>();
    for (const i of ear) nb.set(i, B(i).sub(P).multiplyScalar(S).add(P));
    for (const m of morphs) {
      const A = (i: number) => B(i).add(new THREE.Vector3(m.getX(i), m.getY(i), m.getZ(i)));
      const Pk = baseOf(A);
      for (const i of ear) {
        const a = A(i).sub(Pk).multiplyScalar(S).add(Pk).sub(nb.get(i)!);
        m.setXYZ(i, a.x, a.y, a.z);
      }
    }
    for (const i of ear) pos.setXYZ(i, nb.get(i)!.x, nb.get(i)!.y, nb.get(i)!.z);
  }

  if (donkey) burro(pos, morphs);

  // Medidas: lomo (donde va la silla), suelo y hocico
  let minY = Infinity, backY = -Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pos.getY(i));
    if (Math.abs(pos.getZ(i)) < 25) backY = Math.max(backY, pos.getY(i));
  }
  const scale = backHeight / (backY - minY);

  // Pelo: el marrón del caballo pasa a ser el color del ase (lo pone el material), lo oscuro
  // (crin, cascos, cola) más oscuro y lo claro, crema
  const col = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) {
    const r = col.getX(i);
    if (r > 0.45) col.setXYZ(i, 2.2, 2.0, 1.8);
    else if (r > 0.2) col.setXYZ(i, 1, 1, 1);
    else col.setXYZ(i, 0.3, 0.27, 0.25);
  }
  geo.deleteAttribute('normal');

  // Pose de parado y zancada, midiendo las pezuñas a lo largo del galope
  const feet: number[] = [];
  for (let i = 0; i < n; i++) if (pos.getY(i) < minY + 12) feet.push(i);
  const dummy = new THREE.Mesh(src.geometry, new THREE.MeshBasicMaterial());
  dummy.name = src.name;
  dummy.updateMorphTargets();
  const mixer = new THREE.AnimationMixer(dummy);
  const act = mixer.clipAction(clip).play();
  let standT = 0, best = Infinity, reach = 0;
  for (let k = 0; k < 30; k++) {
    act.time = (k / 30) * clip.duration;
    mixer.update(0);
    let lo = Infinity, hi = -Infinity;
    for (const i of feet) {
      let z = pos.getZ(i);
      dummy.morphTargetInfluences!.forEach((w, m) => (z += w * morphs[m].getZ(i)));
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
    }
    if (hi - lo < best) (best = hi - lo), (standT = act.time);
    reach = Math.max(reach, hi - lo);
  }
  // El lomo de verdad es el de la pose de parado (el galope lo sube unos centímetros respecto a la
  // malla en reposo): ahí van la manta y el jinete, que si no se hundían en él
  act.time = standT;
  mixer.update(0);
  let standBack = -Infinity;
  for (let i = 0; i < n; i++) {
    let y = pos.getY(i), z = pos.getZ(i);
    dummy.morphTargetInfluences!.forEach((w, m) => {
      y += w * morphs[m].getY(i);
      z += w * morphs[m].getZ(i);
    });
    if (Math.abs(z) < 25) standBack = Math.max(standBack, y);
  }
  mixer.uncacheRoot(dummy);
  // Caras unidas y normales suaves: con facetas, los animales parecían de papiroflexia al lado de los personajes
  const smooth = mergeVertices(geo, 0.01);
  smooth.computeVertexNormals();
  return { geo: smooth, clip, name: src.name, scale, minY, backY: Math.max(backY, standBack), standT, stride: reach * scale * 1.6 };
}

/**
 * Del caballo al burro: patas más cortas, barriga más ancha y una cabeza grande y pesada.
 * Se deforma la posición final de cada vértice (base y base + cada morph), así el galope sigue valiendo.
 */
function burro(pos: THREE.BufferAttribute, morphs: THREE.BufferAttribute[]) {
  const n = pos.count;
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    y0 = Math.min(y0, pos.getY(i)); y1 = Math.max(y1, pos.getY(i));
    z0 = Math.min(z0, pos.getZ(i)); z1 = Math.max(z1, pos.getZ(i));
  }
  const H = y1 - y0, L = z1 - z0;
  const legTop = y0 + H * 0.42; // por encima, cuerpo; por debajo, patas
  const neckZ = z1 - L * 0.3; // a partir de aquí, cuello y cabeza
  const hp = new THREE.Vector3(0, y0 + H * 0.62, neckZ); // la cabeza crece desde la base del cuello
  const f = (v: THREE.Vector3) => {
    if (v.y < legTop) v.y = legTop - (legTop - v.y) * 0.58;
    else v.x *= 1 + 0.16 * Math.min(1, (v.y - legTop) / (H * 0.15));
    if (v.z > neckZ && v.y > hp.y - H * 0.1) {
      const k = Math.min(1, (v.z - neckZ) / (L * 0.12));
      v.sub(hp).multiplyScalar(1 + 0.22 * k).add(hp);
      v.y -= k * H * 0.06; // la lleva más baja que un caballo
    }
    return v;
  };
  const b = new THREE.Vector3(), a = new THREE.Vector3();
  const base: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) base.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  for (const m of morphs)
    for (let i = 0; i < n; i++) {
      a.set(m.getX(i), m.getY(i), m.getZ(i)).add(base[i]);
      f(a).sub(f(b.copy(base[i])));
      m.setXYZ(i, a.x, a.y, a.z);
    }
  for (let i = 0; i < n; i++) {
    f(b.copy(base[i]));
    pos.setXYZ(i, b.x, b.y, b.z);
  }
}

const lin = (hex: number) => new THREE.Color(hex);
let riderN = 0;

/** Ase con jinete; la misma interfaz que el de los muñecos (root, pivot, patas, cabeza). */
export function makeDonkeyHD(coat: number, shadow: THREE.Object3D, horse = false): Donkey {
  const P = horse ? prepHorse! : prep!;
  const root = new THREE.Group();
  root.userData.noCam = true; // se mueve: la cámara no choca con ello
  const pivot = new THREE.Group();
  pivot.position.z = -0.75;
  root.add(pivot);
  const inner = new THREE.Group();
  inner.position.z = 0.75;
  pivot.add(inner);

  const mat = new THREE.MeshStandardMaterial({ color: lin(coat), vertexColors: true, roughness: horse ? 0.55 : 0.9, metalness: 0 });
  const mesh = new THREE.Mesh(P.geo, mat);
  mesh.name = P.name;
  mesh.scale.setScalar(P.scale);
  mesh.position.y = -P.minY * P.scale;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.updateMorphTargets();
  inner.add(mesh);
  const back = (P.backY - P.minY) * P.scale;

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
    horse
      ? { skin: 0xe8b894, shirt: 0x1b1b22, pants: 0xf3f0ea, hair: 0x2a1d14, hairStyle: 'short', male: true, shoes: 0x111111 }
      : { skin: [0xe8b894, 0xd9a27c, 0xf0c8a6, 0xc98e64][R0 % 4], shirt: [0xffffff, 0x2f6b8a, 0xd7263d, 0xe9c75a][R0 % 4], pants: [0x3b4a6b, 0xc9b48a, 0x6f8fb8, 0x2d2d3a][R0 % 4], hair: [0x2a1d14, 0x6b3f22, 0x1f1610, 0x8a6a40][R0 % 4], hairStyle: 'short', male: true, shorts: true },
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
  if (horse) {
    const black = new THREE.MeshStandardMaterial({ color: lin(0x111111), roughness: 0.55 });
    const hat = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), black);
    crown.scale.y = 1.1;
    crown.position.y = 0.17;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 24), black);
    brim.position.y = 0.175;
    hat.add(crown, brim);
    hat.traverse((o) => (o.castShadow = true));
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

  const mixer = new THREE.AnimationMixer(mesh);
  const act = mixer.clipAction(P.clip).play();
  act.time = horse ? Math.random() * P.clip.duration : P.standT; // el burro empieza parado, no a medio galope
  const last = new THREE.Vector3(NaN, 0, 0);
  let speed = 0;
  let walk = 0;
  const tick = (dt: number) => {
    if (!root.parent) return;
    const p = root.position;
    if (Number.isNaN(last.x)) last.copy(p);
    const d = Math.hypot(p.x - last.x, p.z - last.z);
    last.copy(p);
    const v = dt > 0 && d < 2 ? d / dt / (root.scale.z || 1) : 0;
    speed += (v - speed) * Math.min(1, dt * 6);
    if (!horse && speed > 0.2) {
      // El burro va al paso: las patas van y vienen alrededor de la pose de parado, sin galopar
      // (a la cadencia de un burro: una zancada y media por segundo, con el lomo balanceándose y el jinete encima)
      walk += dt * (4.2 + speed * 3.2);
      const D = P.clip.duration;
      act.time = (P.standT + Math.sin(walk) * D * 0.12 + D) % D;
      act.timeScale = 0;
      mixer.update(0);
      inner.position.y = Math.abs(Math.sin(walk)) * 0.035;
      inner.rotation.z = Math.sin(walk) * 0.022;
      inner.rotation.y = Math.sin(walk) * 0.018;
    } else if (speed > 0.2) {
      act.timeScale = THREE.MathUtils.clamp((speed / P.stride) * P.clip.duration, 0.3, 1.6);
      mixer.update(dt);
    } else {
      // Parado: vuelve poco a poco a la pose con las cuatro patas en el suelo
      inner.position.y *= 0.9;
      inner.rotation.z *= 0.9;
      inner.rotation.y *= 0.9;
      let dtT = P.standT - act.time;
      const D = P.clip.duration;
      dtT -= Math.round(dtT / D) * D;
      act.time = (act.time + dtT * Math.min(1, dt * 4) + D) % D;
      act.timeScale = 0;
      mixer.update(0);
    }
  };
  rigTickers.add(tick);
  return { root, pivot, legs, head };
}
