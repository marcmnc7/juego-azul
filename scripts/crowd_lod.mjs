// Convierte un VRM de VRoid en una plantilla ligera para la multitud (como woman_mh_lod.glb):
//
//   node scripts/crowd_lod.mjs entrada.vrm salida.glb [triángulos=6000]
//
// - Una sola malla "Body" (cara + cuerpo + pelo + ropa) con una sola textura (atlas: cada textura del VRM en
//   una celda de 512 × 512), sin blendshapes.
// - Huesos humanoides con los nombres de Mixamo ("mixamorigHips"…), para hornear las mismas animaciones.
// - Malla simplificada con meshoptimizer (por defecto ~6000 triángulos).
// - Cada vértice lleva su zona en el atributo _ZONE, para teñir a cada persona de la multitud:
//   1 piel · 2 pelo · 3 camiseta · 4 pantalón · 5 zapatos (tal cual) · 6 cara y detalles (tal cual).
//   La zona sale del material de cada pieza: el VRM tiene que estar exportado de VRoid sin fusionar materiales
//   (como todo el reparto: …_SKIN, …_HAIR, Tops, Bottoms, Shoes…).
// - En extras de la malla: color medio de la piel y luminosidad media de pelo, camiseta y pantalón.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { PNG } from 'pngjs';

const [src, dst, trisArg] = process.argv.slice(2);
if (!src || !dst) {
  console.error('uso: node scripts/crowd_lod.mjs entrada.vrm salida.glb [triángulos]');
  process.exit(1);
}
const TARGET_TRIS = Number(trisArg) || 6000;

// ---- Nombres de Mixamo para los huesos humanoides (igual que src/entities/vrm.ts) ----
const MIXAMO = { hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head', leftEye: 'LeftEye', rightEye: 'RightEye' };
for (const [s, S] of [['left', 'Left'], ['right', 'Right']]) {
  Object.assign(MIXAMO, {
    [`${s}Shoulder`]: `${S}Shoulder`, [`${s}UpperArm`]: `${S}Arm`, [`${s}LowerArm`]: `${S}ForeArm`, [`${s}Hand`]: `${S}Hand`,
    [`${s}UpperLeg`]: `${S}UpLeg`, [`${s}LowerLeg`]: `${S}Leg`, [`${s}Foot`]: `${S}Foot`, [`${s}Toes`]: `${S}ToeBase`,
    [`${s}ThumbMetacarpal`]: `${S}HandThumb1`, [`${s}ThumbProximal`]: `${S}HandThumb2`, [`${s}ThumbDistal`]: `${S}HandThumb3`,
  });
  for (const [f, F] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Little', 'Pinky']])
    Object.assign(MIXAMO, { [`${s}${f}Proximal`]: `${S}Hand${F}1`, [`${s}${f}Intermediate`]: `${S}Hand${F}2`, [`${s}${f}Distal`]: `${S}Hand${F}3` });
}

// ---- Leer: JSON crudo (para el humanoide del VRM) y documento glTF ----
const raw = fs.readFileSync(src);
const json = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString('utf8'));
const humanBones = json.extensions?.VRMC_vrm?.humanoid?.humanBones;
if (!humanBones) throw new Error('no es un VRM 1.0 (falta VRMC_vrm.humanoid)');
const io = new NodeIO();
const doc = await io.readBinary(new Uint8Array(raw));
const root = doc.getRoot();
const nodes = root.listNodes();
if (nodes.length !== json.nodes.length || nodes.some((n, i) => n.getName() !== (json.nodes[i].name ?? ''))) throw new Error('el orden de los nodos no coincide');
const hairNodes = new Set(nodes.filter((n) => /^J_Sec_Hair/.test(n.getName())));
for (const [hb, { node }] of Object.entries(humanBones)) if (MIXAMO[hb]) nodes[node].setName('mixamorig' + MIXAMO[hb]);

// ---- Mallas: cara y cuerpo (VRoid con materiales fusionados) o varias piezas ----
const meshNodes = nodes.filter((n) => n.getMesh() && n.getSkin());
const skin = meshNodes[0].getSkin();
const joints = skin.listJoints();
for (const n of meshNodes) if (n.getSkin().listJoints().some((j, i) => joints[i] !== j)) throw new Error('las mallas no comparten esqueleto');
const isHairJoint = joints.map((j) => hairNodes.has(j));

// Texturas decodificadas (base de cada material)
const texCache = new Map();
function decoded(tex) {
  if (!texCache.has(tex)) texCache.set(tex, PNG.sync.read(Buffer.from(tex.getImage())));
  return texCache.get(tex);
}
const sample = (img, u, v) => {
  const x = Math.min(img.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.width)));
  const y = Math.min(img.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.height)));
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
};

await MeshoptSimplifier.ready;

/** Una pieza (primitiva) simplificada, con sus vértices compactados. */
function piece(prim, isFace, budget, maxErr = isFace ? 0.004 : 0.02) {
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), U = prim.getAttribute('TEXCOORD_0');
  const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const n = P.getCount();
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), jo = new Uint16Array(n * 4), we = new Float32Array(n * 4);
  const e3 = [0, 0, 0], e2 = [0, 0], e4 = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    pos.set(P.getElement(i, e3), i * 3);
    nrm.set(N.getElement(i, e3), i * 3);
    uv.set(U.getElement(i, e2), i * 2);
    jo.set(J.getElement(i, e4), i * 4);
    we.set(W.getElement(i, e4), i * 4);
  }
  const idx = new Uint32Array(prim.getIndices().getArray());
  const target = Math.min(idx.length, Math.max(300, budget) * 3);
  // UV en la simplificación: que no se deformen las costuras de la textura
  const [out] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, uv, 2, [isFace ? 2 : 1, isFace ? 2 : 1], null, target - (target % 3), maxErr, []);
  // compactar
  const map = new Int32Array(n).fill(-1);
  let m = 0;
  for (const i of out) if (map[i] < 0) map[i] = m++;
  const sel = (arr, k) => {
    const r = new arr.constructor(m * k);
    for (let i = 0; i < n; i++) if (map[i] >= 0) for (let c = 0; c < k; c++) r[map[i] * k + c] = arr[i * k + c];
    return r;
  };
  return {
    isFace, tex: prim.getMaterial().getBaseColorTexture(), material: prim.getMaterial(),
    pos: sel(pos, 3), nrm: sel(nrm, 3), uv: sel(uv, 2), jo: sel(jo, 4), we: sel(we, 4), idx: Uint32Array.from(out, (i) => map[i]), count: m,
  };
}

// ---- Zona de cada pieza, por su material (VRoid exportado sin fusionar materiales) ----
// 1 piel · 2 pelo · 3 camiseta (o vestido) · 4 pantalón (o falda) · 5 zapatos · 6 cara y detalles (tal cual)
function zoneOf(name) {
  if (/_SKIN/.test(name)) return 1;
  if (/_HAIR/.test(name)) return 2;
  if (/_(FACE|EYE)/.test(name)) return 6;
  if (/(Tops|Onepiece|Dress|Coat|WholeBody)/i.test(name)) return 3;
  if (/(Bottoms|Skirt)/i.test(name)) return 4;
  if (/(Shoes|Socks)/i.test(name)) return 5;
  return 6;
}
const prims = meshNodes.flatMap((n) => n.getMesh().listPrimitives().map((p) => {
  const name = p.getMaterial()?.getName() ?? '';
  const zone = zoneOf(name);
  return { p, zone, isFace: zone === 6 || /Face/i.test(name) };
}));
if (!prims.some((x) => x.zone === 1) || !prims.some((x) => x.zone === 3)) throw new Error('no parece un VRM de VRoid con los materiales sin fusionar (faltan _SKIN o la ropa)');
const totalTris = prims.reduce((s, { p }) => s + p.getIndices().getCount() / 3, 0);
// presupuesto: la cara se queda con más detalle (ojos, cejas, boca)
// (el pelo de VRoid trae muchísimos triángulos: menos para él y más para la ropa, que es lo que se tiñe)
const WEIGHT = { 1: 0.9, 2: 0.45, 3: 1.6, 4: 1.6, 5: 1, 6: 1.6 };
const pieces = prims.map(({ p, zone, isFace }) => ({ ...piece(p, isFace, Math.round(((p.getIndices().getCount() / 3) / totalTris) * TARGET_TRIS * WEIGHT[zone]), zone === 2 ? 0.08 : undefined), zone }));
// ---- Fuera la piel que tapa la ropa ----
// El cuerpo de VRoid sigue entero debajo de la ropa (con ropa interior negra); con la ropa simplificada, al moverse
// asomaría. Un triángulo del cuerpo se quita si, desde su centro y hacia fuera, hay ropa a menos de 6 cm.
{
  const trisOf = (zs) => {
    const out = [];
    for (const pc of pieces) if (zs.includes(pc.zone))
      for (let t = 0; t < pc.idx.length; t += 3) out.push([0, 1, 2].map((k) => [pc.pos[pc.idx[t + k] * 3], pc.pos[pc.idx[t + k] * 3 + 1], pc.pos[pc.idx[t + k] * 3 + 2]]));
    return out;
  };
  const cloth = trisOf([3, 4, 5]), tops = trisOf([3]);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // rayo contra triángulo (Möller–Trumbore), por las dos caras: distancia o Infinity
  const hit = (o, d, [a, b, c]) => {
    const e1 = sub(b, a), e2 = sub(c, a), pv = cross(d, e2), det = dot(e1, pv);
    if (Math.abs(det) < 1e-9) return Infinity;
    const tv = sub(o, a), u = dot(tv, pv) / det;
    if (u < 0 || u > 1) return Infinity;
    const qv = cross(tv, e1), v = dot(d, qv) / det;
    if (v < 0 || u + v > 1) return Infinity;
    const t = dot(e2, qv) / det;
    return t > 0 ? t : Infinity;
  };
  let removed = 0;
  // (y la cintura del pantalón que queda debajo de la camiseta, más cerca: asomaba por el bajo)
  for (const pc of pieces) {
    const over = pc.zone === 1 && !pc.isFace ? cloth : pc.zone === 4 ? tops : null;
    const near = pc.zone === 4 ? 0.035 : 0.06;
    if (!over) continue;
    const keep = [];
    for (let t = 0; t < pc.idx.length; t += 3) {
      const ids = [pc.idx[t], pc.idx[t + 1], pc.idx[t + 2]];
      const o = [0, 1, 2].map((c) => ids.reduce((s, i) => s + pc.pos[i * 3 + c], 0) / 3);
      const n = [0, 1, 2].map((c) => ids.reduce((s, i) => s + pc.nrm[i * 3 + c], 0));
      const L = Math.hypot(...n) || 1;
      const d = n.map((x) => x / L);
      let covered = false;
      for (const tri of over) if (hit(o, d, tri) < near) { covered = true; break; }
      if (covered) removed++;
      else keep.push(...ids);
    }
    pc.idx = Uint32Array.from(keep);
  }
  // Triángulos de ropa que caen del todo en lo transparente de su textura (los flecos de un short deshilachado):
  // en el juego se pintaban negros
  let clear = 0;
  for (const pc of pieces) {
    if (pc.zone < 3 || pc.zone > 5) continue;
    const img = decoded(pc.tex);
    const keep = [];
    for (let t = 0; t < pc.idx.length; t += 3) {
      const ids = [pc.idx[t], pc.idx[t + 1], pc.idx[t + 2]];
      const uvs = ids.map((i) => [pc.uv[i * 2], pc.uv[i * 2 + 1]]);
      const cu = (uvs[0][0] + uvs[1][0] + uvs[2][0]) / 3, cv = (uvs[0][1] + uvs[1][1] + uvs[2][1]) / 3;
      const alphas = [...uvs, [cu, cv]].map(([u, v]) => sample(img, u, v)[3]);
      if (Math.max(...alphas) < 40) clear++;
      else keep.push(...ids);
    }
    pc.idx = Uint32Array.from(keep);
  }
  console.log(`  piel (y pantalón) tapados por la ropa: ${removed} triángulos fuera`);
  console.log(`  ropa transparente: ${clear} triángulos fuera`);
}
const zones = pieces.map((pc) => new Float32Array(pc.count).fill(pc.zone));
const texel = (pc, i) => sample(decoded(pc.tex), pc.uv[i * 2], pc.uv[i * 2 + 1]);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const median = (cols) => [0, 1, 2].map((c) => cols.map((x) => x[c]).sort((a, b) => a - b)[cols.length >> 1] ?? 200);
// Color de la piel: mediana de la textura del cuerpo (sin lo transparente)
const bodySkin = median(pieces.filter((pc) => pc.zone === 1).flatMap((pc) => [...Array(pc.count).keys()].map((i) => texel(pc, i)).filter((c) => c[3] > 200)));
const meanLum = (z) => {
  let s = 0, k = 0;
  for (const pc of pieces) if (pc.zone === z) for (let i = 0; i < pc.count; i++) { const c = texel(pc, i); if (c[3] > 128) { s += lum(c); k++; } }
  return k ? +(s / k / 255).toFixed(4) : 1;
};
const counts = [0, 0, 0, 0, 0, 0, 0];
for (const pc of pieces) counts[pc.zone] += pc.count;

// ---- Atlas: cada textura distinta en una celda de 512 × 512 (4 por fila) ----
const CELL = 512, PAD = 4, COLS = 4;
const texs = [...new Set(pieces.map((pc) => pc.tex))];
const rows = Math.ceil(texs.length / COLS);
const AW = CELL * Math.min(COLS, texs.length), AH = CELL * (rows <= 1 ? 1 : rows <= 2 ? 2 : 4);
if (rows > 4) throw new Error(`demasiadas texturas (${texs.length})`);
const atlas = new PNG({ width: AW, height: AH });
function blit(img, ox, oy, size) {
  // reducción por media de bloques (o ampliación por vecino si la textura es más pequeña)
  const fx = img.width / size, fy = img.height / size;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      let k = 0;
      const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * img.width + xx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += img.data[o + c];
          k++;
        }
      const d = ((oy + y) * AW + ox + x) * 4;
      for (let c = 0; c < 4; c++) atlas.data[d + c] = Math.round(acc[c] / Math.max(1, k));
    }
}
const cellOf = new Map();
texs.forEach((t, k) => {
  const ox = (k % COLS) * CELL, oy = Math.floor(k / COLS) * CELL;
  blit(decoded(t), ox, oy, CELL);
  cellOf.set(t, [ox, oy]);
});
for (const pc of pieces) {
  const [ox, oy] = cellOf.get(pc.tex);
  for (let i = 0; i < pc.count; i++) {
    const u = Math.min(1, Math.max(0, pc.uv[i * 2])), v = Math.min(1, Math.max(0, pc.uv[i * 2 + 1]));
    // (un poco hacia dentro de la celda: que el filtrado no coja la vecina)
    pc.uv[i * 2] = (ox + PAD + u * (CELL - 2 * PAD)) / AW;
    pc.uv[i * 2 + 1] = (oy + PAD + v * (CELL - 2 * PAD)) / AH;
  }
}

// ---- Una sola primitiva ----
const V = pieces.reduce((s, p) => s + p.count, 0);
const POS = new Float32Array(V * 3), NRM = new Float32Array(V * 3), UV = new Float32Array(V * 2), JO = new Uint16Array(V * 4), WE = new Float32Array(V * 4), ZO = new Float32Array(V);
const IDX = new Uint32Array(pieces.reduce((s, p) => s + p.idx.length, 0));
let vo = 0, io2 = 0;
pieces.forEach((pc, pi) => {
  POS.set(pc.pos, vo * 3); NRM.set(pc.nrm, vo * 3); UV.set(pc.uv, vo * 2); JO.set(pc.jo, vo * 4); WE.set(pc.we, vo * 4); ZO.set(zones[pi], vo);
  for (let k = 0; k < pc.idx.length; k++) IDX[io2 + k] = pc.idx[k] + vo;
  vo += pc.count; io2 += pc.idx.length;
});
const buffer = root.listBuffers()[0];
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
const atlasTex = doc.createTexture('atlas').setMimeType('image/png').setImage(new Uint8Array(PNG.sync.write(atlas)));
const mat = doc.createMaterial('Body').setBaseColorTexture(atlasTex).setAlphaMode('MASK').setAlphaCutoff(0.5).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(false);
const prim = doc.createPrimitive().setMaterial(mat).setIndices(acc('SCALAR', IDX))
  .setAttribute('POSITION', acc('VEC3', POS)).setAttribute('NORMAL', acc('VEC3', NRM)).setAttribute('TEXCOORD_0', acc('VEC2', UV))
  .setAttribute('JOINTS_0', acc('VEC4', JO)).setAttribute('WEIGHTS_0', acc('VEC4', WE)).setAttribute('_ZONE', acc('SCALAR', ZO));
const skinCol = bodySkin.map((x) => +(x / 255).toFixed(4));
const mesh = doc.createMesh('Body').addPrimitive(prim).setExtras({ crowd: { skin: skinCol, lum: { 2: meanLum(2), 3: meanLum(3), 4: meanLum(4) } } });
const bodyNode = meshNodes.find((n) => !/Face/i.test(n.getMesh().getName())) ?? meshNodes[0];
for (const n of meshNodes) n.setMesh(null);
bodyNode.setName('Body').setMesh(mesh).setSkin(skin);
// Fuera todo lo del VRM que no se usa (extensiones, materiales MToon, miniatura…)
for (const ext of root.listExtensionsUsed()) ext.dispose();
for (const m of root.listMaterials()) if (m !== mat) m.dispose();
for (const t of root.listTextures()) if (t !== atlasTex) t.dispose();
await doc.transform(prune({ keepLeaves: true }));
fs.writeFileSync(dst, await io.writeBinary(doc));
console.log(`${src} → ${dst}: ${IDX.length / 3} triángulos, ${V} vértices, ${(fs.statSync(dst).size / 1e6).toFixed(2)} MB`);
console.log(`  zonas: piel ${counts[1]} · pelo ${counts[2]} · camiseta ${counts[3]} · pantalón ${counts[4]} · zapatos ${counts[5]} · cara ${counts[6]}`);
console.log(`  piel ${bodySkin} · ${texs.length} texturas en un atlas de ${AW}×${AH}`);
