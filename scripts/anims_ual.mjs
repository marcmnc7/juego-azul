// Junta clips de la Universal Animation Library de Quaternius (CC0) en un .glb con el esqueleto de Mixamo:
//
//   node scripts/anims_ual.mjs UAL1.glb UAL2.glb src/assets/chars/anims_ual.glb
//
// UAL1: "AnimationLibrary_Godot_Standard.glb" (rig de Rigify, huesos DEF-*).
// UAL2: "UAL2_Standard.glb" (rig del maniquí de Unreal: pelvis, spine_01…).
// Los huesos se renombran a "mixamorig<Nombre>" (Hips, Spine, LeftArm…), como anims.glb: así rig.ts los
// adapta a cada personaje con el mismo retargeting. Sin malla ni texturas: solo esqueleto y animaciones.
// Los clips se renombran con los nombres que usa el juego (tabla CLIPS).
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { prune, resample } from '@gltf-transform/functions';

const [ual1, ual2, dst] = process.argv.slice(2);
if (!ual1 || !ual2 || !dst) {
  console.error('uso: node scripts/anims_ual.mjs UAL1.glb UAL2.glb salida.glb');
  process.exit(1);
}

const sides = (l, r) => [[l, 'Left'], [r, 'Right']];
function rigify() {
  const m = { 'DEF-hips': 'Hips', 'DEF-spine.001': 'Spine', 'DEF-spine.002': 'Spine1', 'DEF-spine.003': 'Spine2', 'DEF-neck': 'Neck', 'DEF-head': 'Head' };
  for (const [s, S] of sides('L', 'R')) {
    Object.assign(m, {
      [`DEF-shoulder.${s}`]: `${S}Shoulder`, [`DEF-upper_arm.${s}`]: `${S}Arm`, [`DEF-forearm.${s}`]: `${S}ForeArm`, [`DEF-hand.${s}`]: `${S}Hand`,
      [`DEF-thigh.${s}`]: `${S}UpLeg`, [`DEF-shin.${s}`]: `${S}Leg`, [`DEF-foot.${s}`]: `${S}Foot`, [`DEF-toe.${s}`]: `${S}ToeBase`,
    });
    for (let k = 1; k <= 3; k++) {
      m[`DEF-thumb.0${k}.${s}`] = `${S}HandThumb${k}`;
      for (const [f, F] of [['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) m[`DEF-f_${f}.0${k}.${s}`] = `${S}Hand${F}${k}`;
    }
  }
  return m;
}
function unreal() {
  const m = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', Head: 'Head' };
  for (const [s, S] of sides('l', 'r')) {
    Object.assign(m, {
      [`clavicle_${s}`]: `${S}Shoulder`, [`upperarm_${s}`]: `${S}Arm`, [`lowerarm_${s}`]: `${S}ForeArm`, [`hand_${s}`]: `${S}Hand`,
      [`thigh_${s}`]: `${S}UpLeg`, [`calf_${s}`]: `${S}Leg`, [`foot_${s}`]: `${S}Foot`, [`ball_${s}`]: `${S}ToeBase`,
    });
    for (let k = 1; k <= 3; k++) {
      m[`thumb_0${k}_${s}`] = `${S}HandThumb${k}`;
      for (const [f, F] of [['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) m[`${f}_0${k}_${s}`] = `${S}Hand${F}${k}`;
    }
  }
  return m;
}

// clip del pack → nombre en el juego
const CLIPS = {
  1: {
    Idle_Loop: 'idle2', Idle_Talking_Loop: 'talk', Walk_Loop: 'walk2', Jog_Fwd_Loop: 'jog', Sprint_Loop: 'sprint',
    Jump_Start: 'jumpStart', Jump_Loop: 'jumpLoop', Jump_Land: 'jumpLand',
    Sitting_Enter: 'sitEnter', Sitting_Idle_Loop: 'sit', Sitting_Talking_Loop: 'sitTalk', Sitting_Exit: 'sitExit',
    Driving_Loop: 'drive', Swim_Fwd_Loop: 'swim', Swim_Idle_Loop: 'swimIdle', Dance_Loop: 'dance2', Interact: 'reach', PickUp_Table: 'pickUp',
  },
  2: {
    Idle_FoldArms_Loop: 'foldArms', Idle_No_Loop: 'no', Yes: 'yes', Idle_TalkingPhone_Loop: 'phoneTalk', Consume: 'drink',
    Walk_Carry_Loop: 'carry', NinjaJump_Start: 'jumpStart2', NinjaJump_Idle_Loop: 'jumpLoop2', NinjaJump_Land: 'jumpLand2',
  },
};

const io = new NodeIO();
async function load(path, map, keep) {
  const doc = await io.read(path);
  const root = doc.getRoot();
  for (const n of root.listNodes()) {
    const to = map[n.getName()];
    if (to) n.setName('mixamorig' + to);
  }
  // sin malla, piel, materiales ni texturas
  for (const n of root.listNodes()) {
    if (n.getMesh()) n.setMesh(null);
    if (n.getSkin()) n.setSkin(null);
  }
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const a of root.listAnimations()) {
    const name = keep[a.getName()];
    if (!name) { a.dispose(); continue; }
    for (const m of root.listMaterials()) m.dispose();
    for (const t of root.listTextures()) t.dispose();
    a.setName(name);
    // solo canales de huesos con nombre de Mixamo (y sin escala: no la necesitamos)
    for (const c of a.listChannels()) {
      const n = c.getTargetNode();
      if (!n || !n.getName().startsWith('mixamorig') || c.getTargetPath() === 'scale' || (c.getTargetPath() === 'translation' && n.getName() !== 'mixamorigHips')) {
        c.dispose();
      }
    }
    // los muestreadores que se han quedado sin canal (si no, sus datos siguen en el archivo)
    const used = new Set(a.listChannels().map((c) => c.getSampler()));
    for (const s of a.listSamplers()) if (!used.has(s)) s.dispose();
  }
  await doc.transform(resample(), prune());
  // datos que ya no usa ninguna animación (prune no los quita todos)
  const keepAcc = new Set(root.listAnimations().flatMap((a) => a.listSamplers().flatMap((s) => [s.getInput(), s.getOutput()])));
  for (const acc of root.listAccessors()) if (!keepAcc.has(acc)) acc.dispose();
  return doc;
}

const d1 = await load(ual1, rigify(), CLIPS[1]);
const d2 = await load(ual2, unreal(), CLIPS[2]);
// Dos escenas en un archivo es incómodo de mezclar en gltf-transform: se guardan dos archivos y rig.ts
// carga ambos. (salida.glb → salida.glb y salida_2.glb)
fs.writeFileSync(dst, await io.writeBinary(d1));
const dst2 = dst.replace(/\.glb$/, '_2.glb');
fs.writeFileSync(dst2, await io.writeBinary(d2));
for (const [f, d] of [[dst, d1], [dst2, d2]])
  console.log(`${f}: ${(fs.statSync(f).size / 1e6).toFixed(2)} MB · ${d.getRoot().listAnimations().map((a) => a.getName()).join(', ')}`);
