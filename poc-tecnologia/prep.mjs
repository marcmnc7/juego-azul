import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
// Personaje: Michelle con la textura recoloreada (rubia, de azul) y solo el baile
const m = await io.read('../assets/models_gltf_Michelle.glb');
for (const a of m.getRoot().listAnimations()) if (a.getName() === 'TPose') a.dispose();
for (const t of m.getRoot().listTextures()) if (t.getName() === 'Ch03_1001_Diffuse') t.setImage(fs.readFileSync('../assets/mich_diffuse_azul.jpg')).setMimeType('image/jpeg');
await m.transform(prune(), dedup());
await io.write('src/assets/azul.glb', m);
// Animaciones: el esqueleto de Xbot (mismo rig de Mixamo) sin mallas
const x = await io.read('../assets/models_gltf_Xbot.glb');
for (const n of x.getRoot().listNodes()) if (n.getMesh()) { n.setMesh(null); n.setSkin(null); }
for (const me of x.getRoot().listMeshes()) me.dispose();
for (const a of x.getRoot().listAnimations()) if (!['idle','walk','run'].includes(a.getName())) a.dispose();
await x.transform(prune({ keepLeaves: true }), dedup());
await io.write('src/assets/anims.glb', x);
