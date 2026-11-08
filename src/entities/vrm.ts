import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { bytes } from '../core/assets';

// Personajes hechos en VRoid Studio (VRM 1.0): estilo anime con sombreado MToon, expresiones y pelo con física.
//
// Para aprovechar todo lo que ya hace rig.ts (retargeting de las capturas de Mixamo, articulaciones del muñeco,
// gestos, IK de los niveles), los huesos humanoides del VRM se renombran con los nombres de Mixamo. Así el VRM
// es, para rig.ts, un modelo más; lo propio del VRM (cara y pelo) se actualiza aparte con tickVRM.

/** Hueso humanoide del VRM → nombre de Mixamo (sin el prefijo "mixamorig"). */
const MIXAMO: Partial<Record<VRMHumanBoneName, string>> = {
  hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head',
  leftEye: 'LeftEye', rightEye: 'RightEye',
};
for (const [s, S] of [['left', 'Left'], ['right', 'Right']] as const) {
  Object.assign(MIXAMO, {
    [`${s}Shoulder`]: `${S}Shoulder`, [`${s}UpperArm`]: `${S}Arm`, [`${s}LowerArm`]: `${S}ForeArm`, [`${s}Hand`]: `${S}Hand`,
    [`${s}UpperLeg`]: `${S}UpLeg`, [`${s}LowerLeg`]: `${S}Leg`, [`${s}Foot`]: `${S}Foot`, [`${s}Toes`]: `${S}ToeBase`,
    [`${s}ThumbMetacarpal`]: `${S}HandThumb1`, [`${s}ThumbProximal`]: `${S}HandThumb2`, [`${s}ThumbDistal`]: `${S}HandThumb3`,
  });
  for (const [f, F] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Little', 'Pinky']])
    Object.assign(MIXAMO, {
      [`${s}${f}Proximal`]: `${S}Hand${F}1`, [`${s}${f}Intermediate`]: `${S}Hand${F}2`, [`${s}${f}Distal`]: `${S}Hand${F}3`,
    });
}

export interface LoadedVRM {
  gltf: GLTF;
  vrm: VRM;
}

const cache = new Map<string, Promise<LoadedVRM>>();

/** Carga un .vrm (una vez por archivo) y lo deja listo para rig.ts. */
export function loadVRM(url: string): Promise<LoadedVRM> {
  let p = cache.get(url);
  if (!p) {
    p = bytes(url).then(async (buf) => {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      // Igual que loadGLB: sin createImageBitmap, las texturas se cargan con <img> y blob:
      const g = globalThis as unknown as { createImageBitmap?: unknown };
      const saved = g.createImageBitmap;
      g.createImageBitmap = undefined;
      let gltf: GLTF;
      try {
        gltf = await loader.parseAsync(buf, '');
      } finally {
        g.createImageBitmap = saved;
      }
      const vrm = gltf.userData.vrm as VRM;
      if (!vrm) throw new Error('no es un VRM: ' + url);
      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      VRMUtils.combineSkeletons(vrm.scene);
      // rig.ts mueve los huesos de verdad; el VRM no debe sobrescribirlos con su esqueleto normalizado
      vrm.humanoid.autoUpdateHumanBones = false;
      for (const [hb, name] of Object.entries(MIXAMO)) {
        const node = vrm.humanoid.getRawBoneNode(hb as VRMHumanBoneName);
        if (node) node.name = name!;
      }
      vrm.scene.traverse((o) => {
        o.userData.vrmOrig = true;
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // Su propio sombreado anime (MToon): ni el paso de cómic ni el de pintura lo tocan
        m.userData.noComic = true;
        m.castShadow = true;
        m.receiveShadow = false;
        m.userData.noReceive = true;
        m.frustumCulled = false;
      });
      gltf.scene = vrm.scene;
      gltf.animations = [];
      return { gltf, vrm };
    });
    cache.set(url, p);
  }
  return p;
}

/**
 * Antes de volver a usar el modelo en otro capítulo: fuera lo que le colgaron los niveles (la mano para llevar
 * cosas, anclas, objetos en la mano) y la física del pelo a cero.
 */
export function resetVRM(v: LoadedVRM) {
  const extra: THREE.Object3D[] = [];
  v.vrm.scene.traverse((o) => {
    if (!o.userData.vrmOrig) extra.push(o);
  });
  for (const o of extra) if (o.parent?.userData.vrmOrig) o.removeFromParent();
  v.vrm.expressionManager?.resetValues();
  v.vrm.springBoneManager?.reset();
}

export interface VRMFace {
  blinkIn: number;
  blinkT: number;
  talkT: number;
  mood: number;
}
export const newFace = (): VRMFace => ({ blinkIn: 1 + Math.random() * 3, blinkT: -1, talkT: 0, mood: 0 });

/** Cara (parpadeo, sonrisa al bailar, boca al hablar) y física del pelo; después de colocar los huesos. */
export function tickVRM(vrm: VRM, face: VRMFace, mode: string, dt: number) {
  const em = vrm.expressionManager;
  if (em) {
    // Parpadeo: cerrar y abrir en 0,15 s, cada 2–5 s, a veces doble
    face.blinkIn -= dt;
    if (face.blinkIn <= 0 && face.blinkT < 0) {
      face.blinkT = 0;
      face.blinkIn = Math.random() < 0.15 ? 0.25 : 2 + Math.random() * 3;
    }
    let blink = 0;
    if (face.blinkT >= 0) {
      face.blinkT += dt;
      const t = face.blinkT / 0.15;
      blink = t < 0.5 ? t * 2 : Math.max(0, 2 - t * 2);
      if (t >= 1) face.blinkT = -1;
    }
    const happy = mode === 'dance' || mode === 'cheer' ? 0.7 : 0.15;
    face.mood += (happy - face.mood) * Math.min(1, dt * 4);
    em.setValue('happy', face.mood);
    // Con la sonrisa los párpados ya bajan algo: el parpadeo, encima sin pasarse
    em.setValue('blink', blink * (1 - face.mood * 0.6));
    if (mode === 'talk') {
      face.talkT += dt;
      const s = Math.max(0, Math.sin(face.talkT * 14) * 0.5 + Math.sin(face.talkT * 9.3) * 0.3);
      em.setValue('aa', s * 0.6);
      em.setValue('oh', Math.max(0, Math.sin(face.talkT * 6.1)) * 0.25);
    } else {
      em.setValue('aa', 0);
      em.setValue('oh', 0);
    }
  }
  vrm.scene.updateWorldMatrix(true, true);
  vrm.update(dt);
}
