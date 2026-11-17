// Prepara un animal de Quaternius (Ultimate Animated Animal Pack, CC0) para el juego: deja solo las animaciones que
// se usan, sin los duplicados «AnimalArmature|…», y lo guarda en src/assets/chars.
//   node scripts/animal_glb.mjs entrada.glb salida.glb
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
const [src, dst] = process.argv.slice(2);
const KEEP = new Set(['Idle', 'Idle_2', 'Idle_Headlow', 'Eating', 'Walk', 'Gallop']);
const io = new NodeIO();
const doc = await io.read(src);
for (const a of doc.getRoot().listAnimations()) if (!KEEP.has(a.getName())) a.dispose();
await doc.transform(prune(), dedup());
await io.write(dst, doc);
console.log(dst, doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
