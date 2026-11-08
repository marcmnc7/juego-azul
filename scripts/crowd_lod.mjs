// Convierte un VRM de VRoid en una plantilla ligera para la multitud (como woman_mh_lod.glb):
//
//   node scripts/crowd_lod.mjs entrada.vrm salida.glb [triángulos=6000]
//
// - Una sola malla "Body" (cara + cuerpo + pelo) con una sola textura (atlas), sin blendshapes.
// - Huesos humanoides con los nombres de Mixamo ("mixamorigHips"…), para hornear las mismas animaciones.
// - Malla simplificada con meshoptimizer (por defecto ~6000 triángulos).
// - Cada vértice lleva su zona en el atributo _ZONE, para teñir a cada persona de la multitud:
//   1 piel · 2 pelo · 3 camiseta · 4 pantalón · 5 zapatos (tal cual) · 6 detalles de la cara (tal cual).
//   El pelo se reconoce por sus huesos (J_Sec_Hair…); la piel, por el color de la textura; camiseta y
//   pantalón, por grupos de color (lo de arriba del pecho es camiseta; lo de las rodillas, pantalón).
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
function piece(prim, isFace, budget) {
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
  const [out] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, uv, 2, [isFace ? 2 : 1, isFace ? 2 : 1], null, target - (target % 3), isFace ? 0.004 : 0.02, []);
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

const prims = meshNodes.flatMap((n) => n.getMesh().listPrimitives().map((p) => ({ p, isFace: /Face/i.test(n.getMesh().getName()) })));
const totalTris = prims.reduce((s, { p }) => s + p.getIndices().getCount() / 3, 0);
// presupuesto: la cara se queda con más detalle (ojos, cejas, boca)
const pieces = prims.map(({ p, isFace }) => piece(p, isFace, Math.round(((p.getIndices().getCount() / 3) / totalTris) * TARGET_TRIS * (isFace ? 1.6 : 0.9))));

// ---- Zonas ----
const yOf = (pc, i) => pc.pos[i * 3 + 1];
let yMin = Infinity, yMax = -Infinity;
for (const pc of pieces) for (let i = 0; i < pc.count; i++) { yMin = Math.min(yMin, yOf(pc, i)); yMax = Math.max(yMax, yOf(pc, i)); }
const Hgt = yMax - yMin;
const rel = (y) => (y - yMin) / Hgt;
const handJoints = new Set(joints.map((j, k) => (/Hand(Index|Middle|Ring|Pinky|Thumb)?\d?$/.test(j.getName()) && /mixamorig(Left|Right)Hand/.test(j.getName()) ? k : -1)).filter((k) => k >= 0));
const texel = (pc, i) => sample(decoded(pc.tex), pc.uv[i * 2], pc.uv[i * 2 + 1]);
const median = (cols) => [0, 1, 2].map((c) => cols.map((x) => x[c]).sort((a, b) => a - b)[cols.length >> 1] ?? 200);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Distancia de color perceptual (ΔE en CIELAB): distingue una camiseta crema de una piel clara. */
function lab(c) {
  const f = (x) => { x /= 255; return x > 0.04045 ? ((x + 0.055) / 1.055) ** 2.4 : x / 12.92; };
  const [r, g, b] = [f(c[0]), f(c[1]), f(c[2])];
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
}
const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hairW = (pc, i) => { let w = 0; for (let k = 0; k < 4; k++) if (isHairJoint[pc.jo[i * 4 + k]]) w += pc.we[i * 4 + k]; return w; };
const handW = (pc, i) => { let w = 0; for (let k = 0; k < 4; k++) if (handJoints.has(pc.jo[i * 4 + k])) w += pc.we[i * 4 + k]; return w; };

// Alturas de cuello y cadera en la pose de enlace (de las matrices inversas del esqueleto)
const ibm = skin.getInverseBindMatrices();
function jointY(name) {
  const k = joints.findIndex((j) => j.getName() === 'mixamorig' + name);
  if (k < 0 || !ibm) return null;
  const m = ibm.getElement(k, new Array(16).fill(0));
  // inversa de una matriz rígida (por columnas): la posición del hueso es -Rᵀ·t; su y, -(columna 1 · t)
  return -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]);
}
const neckRel = rel(jointY('Neck') ?? yMin + Hgt * 0.83);
const hipsRel = rel(jointY('Hips') ?? yMin + Hgt * 0.5);
// Piel: mediana de las manos (cuerpo) y de la parte central de la cara
const bodySkin = median(pieces.filter((p) => !p.isFace).flatMap((pc) => [...Array(pc.count).keys()].filter((i) => handW(pc, i) > 0.9).map((i) => texel(pc, i))));
const faceSkin = median(pieces.filter((p) => p.isFace).flatMap((pc) => [...Array(pc.count).keys()].map((i) => texel(pc, i)).filter((c) => c[3] > 200)));
const zones = pieces.map((pc) => new Float32Array(pc.count));
const clothes = [];
pieces.forEach((pc, pi) => {
  for (let i = 0; i < pc.count; i++) {
    const c = texel(pc, i);
    if (pc.isFace) { zones[pi][i] = dE(c, faceSkin) < 12 ? 1 : 6; continue; }
    if (hairW(pc, i) > 0.5) { zones[pi][i] = 2; continue; }
    if (dE(c, bodySkin) < 11) { zones[pi][i] = 1; continue; }
    // por encima del cuello y sin ser piel: el pelo de la base (cuelga de la cabeza, no de huesos de pelo)
    if (rel(yOf(pc, i)) > neckRel + 0.01) { zones[pi][i] = 2; continue; }
    if (rel(yOf(pc, i)) < 0.06) { zones[pi][i] = 5; continue; }
    clothes.push([pi, i, c, rel(yOf(pc, i))]);
  }
});
// Camiseta y pantalón: dos grupos de color, sembrados con lo del pecho y lo de los muslos (con pantalón
// corto las rodillas son piel)
const chest = [hipsRel + (neckRel - hipsRel) * 0.45, hipsRel + (neckRel - hipsRel) * 0.85];
const thigh = [hipsRel * 0.68, hipsRel * 0.9];
let topC = median(clothes.filter((x) => x[3] > chest[0] && x[3] < chest[1]).map((x) => x[2]));
let botC = median(clothes.filter((x) => x[3] > thigh[0] && x[3] < thigh[1]).map((x) => x[2]));
for (let it = 0; it < 6; it++) {
  const a = [], b = [];
  for (const x of clothes) (dist(x[2], topC) <= dist(x[2], botC) ? a : b).push(x[2]);
  if (a.length) topC = median(a);
  if (b.length) botC = median(b);
}
for (const [pi, i, c, h] of clothes) {
  const top = dist(c, topC) <= dist(c, botC);
  // (sin un pantalón de verdad debajo de la cintura, todo es camiseta, y al revés)
  zones[pi][i] = top ? (h < thigh[0] * 0.6 ? 4 : 3) : h > chest[0] ? 3 : 4;
}
console.log(`  cuello ${neckRel.toFixed(2)} · cadera ${hipsRel.toFixed(2)}`);
const meanLum = (z) => {
  let s = 0, k = 0;
  pieces.forEach((pc, pi) => { for (let i = 0; i < pc.count; i++) if (zones[pi][i] === z) { s += lum(texel(pc, i)); k++; } });
  return k ? s / k / 255 : 1;
};
const counts = [0, 0, 0, 0, 0, 0, 0];
zones.forEach((z) => z.forEach((v) => counts[v]++));

// ---- Atlas: cuerpo a 1024 y cara a 512, uno al lado del otro (1536 × 1024) ----
const AW = 1536, AH = 1024;
const atlas = new PNG({ width: AW, height: AH });
function blit(img, ox, oy, size) {
  // reducción por media de bloques (las texturas de VRoid son cuadradas)
  const f = img.width / size;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      let k = 0;
      for (let yy = Math.floor(y * f); yy < Math.floor((y + 1) * f); yy++)
        for (let xx = Math.floor(x * f); xx < Math.floor((x + 1) * f); xx++) {
          const o = (yy * img.width + xx) * 4;
          for (let c = 0; c < 4; c++) acc[c] += img.data[o + c];
          k++;
        }
      const d = ((oy + y) * AW + ox + x) * 4;
      for (let c = 0; c < 4; c++) atlas.data[d + c] = Math.round(acc[c] / Math.max(1, k));
    }
}
const bodyTex = pieces.find((p) => !p.isFace).tex, faceTex = pieces.find((p) => p.isFace)?.tex;
blit(decoded(bodyTex), 0, 0, 1024);
if (faceTex) blit(decoded(faceTex), 1024, 0, 512);
for (const pc of pieces) {
  for (let i = 0; i < pc.count; i++) {
    const u = Math.min(1, Math.max(0, pc.uv[i * 2])), v = Math.min(1, Math.max(0, pc.uv[i * 2 + 1]));
    if (pc.tex === bodyTex) { pc.uv[i * 2] = (u * 1024) / AW; pc.uv[i * 2 + 1] = v; }
    else { pc.uv[i * 2] = (1024 + u * 512) / AW; pc.uv[i * 2 + 1] = (v * 512) / AH; }
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
console.log(`  piel ${bodySkin} · camiseta ${topC} · pantalón ${botC}`);
