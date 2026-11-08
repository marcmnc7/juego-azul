import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// HERRAMIENTA (no entra en el juego): monta a Gas y al hombre genérico de los secundarios con MakeHuman (CC0)
// y los exporta como GLB a src/assets/chars (gas_mh.glb, man_mh.glb). Se abre en el servidor de desarrollo:
//   mh.html          → Gas          (window.__export() lo guarda)
//   mh.html?p=man    → hombre genérico (todo blanco/gris: el juego lo tiñe)
// Cuerpo base con los ajustes de hombre joven, ropa, zapatos, pelo, cejas, pestañas y ojos ajustados al cuerpo
// (.mhclo), esqueleto Mixamo de MPFB con sus pesos. El cuerpo sale en tres versiones (vestido, pantalón corto,
// sin ropa) y la camiseta y el pantalón en piezas aparte, para que el juego elija y tiña según el capítulo.
//
// Archivos fuente (CC0), en demo-mh/ (no se versionan; unos 46 MB):
//   github.com/makehumancommunity/makehuman  makehuman/data/3dobjs/base.obj
//     makehuman/data/targets/macrodetails/{universal-male-young-averagemuscle-averageweight,caucasian-male-young}.target
//   github.com/makehumancommunity/mpfb2      src/mpfb/data/rigs/standard/{rig,weights}.mixamo.json
//   files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip:
//     clothes/male_casualsuit06, clothes/shoes02, hair/short02, eyebrows/eyebrow001, eyelashes/eyelashes01,
//     eyes/high-poly, skins/young_caucasian_male   (.obj, .mhclo y la textura _diffuse de cada uno)

const DIR = '/demo-mh/';
const txt = (f: string) => fetch(DIR + f).then((r) => r.text());

interface Obj { v: number[][]; vt: number[][]; f: { v: number[]; t: number[]; g: string }[] }
function parseObj(s: string): Obj {
  const o: Obj = { v: [], vt: [], f: [] };
  let g = '';
  for (const line of s.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') o.v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'vt') o.vt.push([+p[1], +p[2]]);
    else if (p[0] === 'g') g = p[1] ?? '';
    else if (p[0] === 'f') {
      const v: number[] = [], t: number[] = [];
      for (const q of p.slice(1)) {
        const [a, b] = q.split('/');
        v.push(+a - 1);
        t.push(b ? +b - 1 : -1);
      }
      o.f.push({ v, t, g });
    }
  }
  return o;
}
function applyTarget(V: number[][], s: string, w = 1) {
  for (const line of s.split('\n')) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const i = +p[0];
    V[i][0] += w * +p[1];
    V[i][1] += w * +p[2];
    V[i][2] += w * +p[3];
  }
}
interface Clo { refs: { i: number[]; w: number[]; d: number[] }[]; scale: number[]; del: Set<number> }
function parseClo(s: string, V: number[][]): Clo {
  const sc: Record<string, [number, number, number]> = {};
  const refs: Clo['refs'] = [];
  const del = new Set<number>();
  let mode = '';
  for (const raw of s.split('\n')) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const p = line.split(/\s+/);
    if (/^[xyz]_scale$/.test(p[0])) { sc[p[0][0]] = [+p[1], +p[2], +p[3]]; continue; }
    if (p[0] === 'verts') { mode = 'v'; continue; }
    if (p[0] === 'delete_verts') { mode = 'd'; continue; }
    if (mode === 'v' && /^[\d.-]/.test(p[0])) {
      if (p.length >= 9) refs.push({ i: [+p[0], +p[1], +p[2]], w: [+p[3], +p[4], +p[5]], d: [+p[6], +p[7], +p[8]] });
      else if (p.length === 1) refs.push({ i: [+p[0], +p[0], +p[0]], w: [1, 0, 0], d: [0, 0, 0] });
      else mode = '';
      continue;
    }
    if (mode === 'd' && /^\d/.test(p[0])) {
      for (let k = 0; k < p.length; k++) {
        if (p[k + 1] === '-') { for (let n = +p[k]; n <= +p[k + 2]; n++) del.add(n); k += 2; }
        else del.add(+p[k]);
      }
      continue;
    }
  }
  const ax = (k: string, c: number) => (sc[k] ? Math.abs(V[sc[k][0]][c] - V[sc[k][1]][c]) / sc[k][2] : 1);
  return { refs, scale: [ax('x', 0), ax('y', 1), ax('z', 2)], del };
}
function fitClo(c: Clo, V: number[][], offsetMul = 1) {
  return c.refs.map((r) => {
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) out[a] += r.w[k] * V[r.i[k]][a];
    for (let a = 0; a < 3; a++) out[a] += r.d[a] * c.scale[a] * offsetMul;
    return out;
  });
}

/** Textura desde PNG, opcionalmente retocada píxel a píxel (para teñir la camiseta, oscurecer los vaqueros). */
async function texture(file: string, edit?: (d: Uint8ClampedArray, w: number, h: number) => void, max = 1024) {
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error(file)); img.src = DIR + file; });
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, c.width, c.height);
  if (edit) {
    const id = g.getImageData(0, 0, c.width, c.height);
    edit(id.data, c.width, c.height);
    g.putImageData(id, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}

export interface MHOpts {
  female?: boolean;
  /** niño o niña de unos 8 años (los ajustes de edad 'child' de MakeHuman) */
  child?: boolean;
  shirt: number; jeansDark: number; hair: string; hairVolume: number; hairColor: number; mullet: number; quiff: number;
  /** Peinados de más, como mallas aparte (MHHair_<nombre>): el juego elige uno para cada hombre. */
  hairs?: string[];
  skinTone: [number, number, number];
  /** bigote y perilla pintados */
  facialHair?: boolean;
  /** 'gas' (Gas, con su pelo y su barba) o 'man' (hombre genérico para los secundarios: todo se tiñe en el juego) */
  tag?: 'gas' | 'man' | 'woman' | 'kid';
  /** pantalón gris liso para teñir (hombre genérico) en vez de vaquero */
  pantsGrey?: boolean;
  /** iris: centro, medio, borde */
  iris?: [string, string, string];
}

export async function buildMH(o: MHOpts) {
  const base = parseObj(await txt('base.obj'));
  const V = base.v.map((p) => p.slice());
  const sex = o.female ? 'female' : 'male';
  const age = o.child ? 'child' : 'young';
  applyTarget(V, await txt(`universal-${sex}-${age}-averagemuscle-averageweight.target`));
  applyTarget(V, await txt(`caucasian-${sex}-${age}.target`));
  const SUIT = o.female ? 'female_casualsuit01' : 'male_casualsuit06';

  // ---------- Esqueleto (MPFB, nombres de Mixamo) ----------
  const rig = JSON.parse(await txt('rig.mixamo.json')).bones as Record<string, { head: { vertex_indices?: number[]; cube_name?: string }; parent?: string }>;
  // Grupos "joint-*" del cuerpo base: cubitos en el centro de cada articulación
  const cubes = new Map<string, Set<number>>();
  for (const f of base.f) if (f.g.startsWith('joint')) {
    if (!cubes.has(f.g)) cubes.set(f.g, new Set());
    for (const i of f.v) cubes.get(f.g)!.add(i);
  }
  const headIdx = (h: { vertex_indices?: number[]; cube_name?: string }) => h.vertex_indices ?? [...(cubes.get(h.cube_name!) ?? [])];
  const mean = (idx: number[]) => {
    const m = [0, 0, 0];
    for (const i of idx) for (let a = 0; a < 3; a++) m[a] += V[i][a] / idx.length;
    return m;
  };
  const names = Object.keys(rig);
  const heads = new Map(names.map((n) => [n, mean(headIdx(rig[n].head))]));
  // Suelo en y = 0 y metros (MakeHuman trabaja en decímetros)
  let minY = Infinity;
  base.f.forEach((f) => { if (f.g === 'body') for (const i of f.v) minY = Math.min(minY, V[i][1]); });
  const W = (p: number[]) => new THREE.Vector3(p[0] * 0.1, (p[1] - minY) * 0.1, p[2] * 0.1);
  const bones = new Map<string, THREE.Bone>();
  for (const n of names) {
    const b = new THREE.Bone();
    b.name = n.replace(':', '');
    bones.set(n, b);
  }
  let root: THREE.Bone | null = null;
  for (const n of names) {
    const b = bones.get(n)!, par = rig[n].parent;
    const hp = W(heads.get(n)!);
    if (par && bones.has(par)) {
      bones.get(par)!.add(b);
      b.position.copy(hp.sub(W(heads.get(par)!)));
    } else {
      root = b;
      b.position.copy(hp);
    }
  }
  // Coronilla (como en los modelos de Mixamo): el juego mide la estatura hasta este hueso
  {
    const hd = rig['mixamorig:Head'] as unknown as { tail: { vertex_indices?: number[]; cube_name?: string } };
    const top = new THREE.Bone();
    top.name = 'mixamorigHeadTop_End';
    top.position.copy(W(mean(headIdx(hd.tail))).sub(W(heads.get('mixamorig:Head')!)));
    bones.get('mixamorig:Head')!.add(top);
    bones.set('mixamorig:HeadTop_End', top);
    names.push('mixamorig:HeadTop_End');
  }
  root!.updateMatrixWorld(true);
  const boneList = names.map((n) => bones.get(n)!);
  const boneIndex = new Map(names.map((n, i) => [n, i]));
  const skeleton = new THREE.Skeleton(boneList);

  // ---------- Pesos ----------
  const wj = JSON.parse(await txt('weights.mixamo.json')).weights as Record<string, [number, number][]>;
  const vw: [number, number][][] = V.map(() => []);
  for (const [bn, list] of Object.entries(wj)) {
    const bi = boneIndex.get(bn);
    if (bi === undefined) continue;
    for (const [vi, w] of list) vw[vi].push([bi, w]);
  }
  // (los vértices de ayuda que no traen pesos toman los del vértice del cuerpo más cercano)
  const bodyVerts = [...new Set(base.f.filter((f) => f.g === 'body').flatMap((f) => f.v))];
  const nearestW = (vi: number) => {
    if (vw[vi].length) return vw[vi];
    let best = bodyVerts[0], bd = Infinity;
    for (const j of bodyVerts) {
      const d = (V[j][0] - V[vi][0]) ** 2 + (V[j][1] - V[vi][1]) ** 2 + (V[j][2] - V[vi][2]) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    vw[vi] = vw[best];
    return vw[vi];
  };
  const top4 = (acc: Map<number, number>) => {
    const s = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = s.reduce((a, b) => a + b[1], 0) || 1;
    while (s.length < 4) s.push([0, 0]);
    return { i: s.map((x) => x[0]), w: s.map((x) => x[1] / sum) };
  };

  // ---------- Mallas ----------
  const group = new THREE.Group();
  group.name = 'MHMan';
  group.add(root!);
  const mkMesh = (name: string, pos: number[][], uv: number[][], faces: Obj['f'], weightsOf: (vi: number) => { i: number[]; w: number[] }, mat: THREE.Material, keep?: (f: Obj['f'][number]) => boolean) => {
    const P: number[] = [], T: number[] = [], SI: number[] = [], SW: number[] = [], I: number[] = [];
    const key = new Map<string, number>();
    const vert = (vi: number, ti: number) => {
      const k = vi + '/' + ti;
      let id = key.get(k);
      if (id === undefined) {
        id = P.length / 3;
        key.set(k, id);
        const w = W(pos[vi]);
        P.push(w.x, w.y, w.z);
        const t = uv[ti] ?? [0, 0];
        T.push(t[0], 1 - t[1]);
        const sw = weightsOf(vi);
        SI.push(...sw.i);
        // el ajuste de la ropa (pesos baricéntricos) puede dar pesos negativos: estiraban los zapatos en picos
        SW.push(...normWeights(sw.w));
      }
      return id;
    };
    for (const f of faces) {
      if (keep && !keep(f)) continue;
      const ids = f.v.map((vi, k) => vert(vi, f.t[k]));
      for (let k = 1; k + 1 < ids.length; k++) I.push(ids[0], ids[k], ids[k + 1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    g.setIndex(I);
    g.computeVertexNormals();
    if (/^(Shirt|Pants|PantsShort)$/.test(name)) smoothNormals(g, 4);
    const m = new THREE.SkinnedMesh(g, mat);
    m.name = name;
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
    m.bind(skeleton);
    return m;
  };
  const bodyW = (vi: number) => {
    const acc = new Map<number, number>();
    for (const [b, w] of nearestW(vi)) acc.set(b, (acc.get(b) ?? 0) + w);
    return top4(acc);
  };

  // Proxies ajustados al cuerpo
  const fitProxy = async (objFile: string, cloFile: string, offsetMul = 1, deform?: (pos: number[][]) => void) => {
    const ob = parseObj(await txt(objFile));
    const clo = parseClo(await txt(cloFile), V);
    const pos = fitClo(clo, V, offsetMul);
    deform?.(pos);
    const wOf = (pi: number) => {
      const r = clo.refs[pi];
      const acc = new Map<number, number>();
      for (let k = 0; k < 3; k++) for (const [b, w] of nearestW(r.i[k])) acc.set(b, (acc.get(b) ?? 0) + w * r.w[k]);
      return top4(acc);
    };
    return { ob, pos, wOf, del: clo.del };
  };
  // las posiciones del proxy van en coordenadas de MakeHuman, como las del cuerpo
  const proxy = async (name: string, objFile: string, cloFile: string, mat: THREE.Material, offsetMul = 1, deform?: (pos: number[][]) => void) => {
    const f = await fitProxy(objFile, cloFile, offsetMul, deform);
    return { mesh: mkMesh(name, f.pos, f.ob.vt, f.ob.f, f.wOf, mat), del: f.del };
  };

  // (el cubo de la boca queda algo por encima de la línea de los labios)
  const mouth = mean([...(cubes.get('joint-mouth') ?? [])]);
  mouth[1] += +(new URLSearchParams(location.search).get('my') ?? -0.24);
  const skinTex = await texture(`young_lightskinned_${sex}_diffuse.png`, (d, w, h) => {
    // la textura trae la ropa interior pintada en blanco: con pantalón corto asomaba por debajo como una franja.
    // Lo blanquecino (poco saturado y claro) pasa a ser piel, con el tono medio de la piel
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx > 90 && (mx - mn) / mx > 0.2) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sn++; }
    }
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx > 130 && (mx - mn) / mx < 0.2 && sn) { d[i] = sr / sn; d[i + 1] = sg / sn; d[i + 2] = sb / sn; }
    }
    for (let i = 0; i < d.length; i += 4) { d[i] *= o.skinTone[0]; d[i + 1] *= o.skinTone[1]; d[i + 2] *= o.skinTone[2]; }
    if (o.facialHair !== false && !o.female) paintFacialHair(d, w, h, base, V, mouth, o.hairColor);
  }, 1024);
  // Camiseta y pantalón vienen en la misma malla: la pieza conectada que queda por encima de la cadera es la camiseta
  const suitObj = parseObj(await txt(SUIT + '.obj'));
  const par = suitObj.v.map((_, i) => i);
  const find = (x: number) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (const f of suitObj.f) for (let k = 1; k < f.v.length; k++) par[find(f.v[k])] = find(f.v[0]);
  const ySum = new Map<number, number>(), yCnt = new Map<number, number>();
  suitObj.v.forEach((p, i) => { const r = find(i); ySum.set(r, (ySum.get(r) ?? 0) + p[1]); yCnt.set(r, (yCnt.get(r) ?? 0) + 1); });
  const hipsY = heads.get('mixamorig:Hips')![1];
  const shirtRoot = new Set([...ySum.keys()].filter((r) => ySum.get(r)! / yCnt.get(r)! > hipsY));
  let shirtUV: { m: Uint8ClampedArray; w: number; h: number } | null = null;
  // Una sola textura: la camiseta, blanca de punto (el juego le pone el color de cada capítulo); el pantalón,
  // vaquero (Gas) o gris liso para teñir (hombre genérico)
  const clothesTex = await texture(SUIT + '_diffuse.png', (d, w, h) => {
    const mc = document.createElement('canvas');
    mc.width = w; mc.height = h;
    const g = mc.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = g.strokeStyle = '#fff';
    g.lineWidth = 3;
    for (const f of suitObj.f) {
      if (!shirtRoot.has(find(f.v[0]))) continue;
      g.beginPath();
      f.t.forEach((ti, k) => { const t = suitObj.vt[ti]; const x = t[0] * w, y = (1 - t[1]) * h; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fill();
      g.stroke();
    }
    const m = g.getImageData(0, 0, w, h).data;
    shirtUV = { m, w, h };
    // y las piezas del pantalón, que mandan sobre la máscara de la camiseta (si no, el borde de la camiseta,
    // trazado grueso, se comía trozos del pantalón y salían manchas blancas)
    g.clearRect(0, 0, w, h);
    for (const f of suitObj.f) {
      if (shirtRoot.has(find(f.v[0]))) continue;
      g.beginPath();
      f.t.forEach((ti, k) => { const t = suitObj.vt[ti]; const x = t[0] * w, y = (1 - t[1]) * h; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fill();
      g.stroke();
    }
    const pm = g.getImageData(0, 0, w, h).data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      if (m[i] > 128 && !(o.pantsGrey && pm[i] > 128)) {
        // blanco casi liso (sin el logo del pecho), con un poco del relieve del punto
        const v = Math.min(255, 255 * (0.95 + (lum - 0.75) * 0.12));
        d[i] = d[i + 1] = d[i + 2] = v;
      } else if (o.pantsGrey) {
        // (opaco: las rotas del vaquero son agujeros transparentes y salían blancas)
        d[i + 3] = 255;
        // gris claro casi liso: el color lo pone el juego (sin las rotas del vaquero, que en pantalón de color
        // salían como manchas de piel)
        const v = 255 * (0.82 + Math.max(-0.03, Math.min(0.03, (lum - 0.45) * 0.3)));
        d[i] = d[i + 1] = d[i + 2] = v;
      } else {
        d[i] *= o.jeansDark; d[i + 1] *= o.jeansDark; d[i + 2] *= o.jeansDark * 1.05;
      }
    }
  });
  const hc = new THREE.Color(o.hairColor).convertLinearToSRGB();
  const hairTexOf = (h: string, size: number) => texture(h === 'afro01' ? 'afro_diffuse.png' : h + '_diffuse.png', (d) => {
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 765;
      d[i] = Math.min(255, hc.r * 255 * (0.55 + l * 1.4));
      d[i + 1] = Math.min(255, hc.g * 255 * (0.55 + l * 1.4));
      d[i + 2] = Math.min(255, hc.b * 255 * (0.55 + l * 1.4));
    }
  }, size);
  const hairTex = await hairTexOf(o.hair, 1024);

  // (las texturas sin transparencia van en JPEG dentro del GLB: ocupan mucho menos)
  skinTex.userData.mimeType = clothesTex.userData.mimeType = 'image/jpeg';
  const skinMat = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ map: clothesTex, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ map: clothesTex, roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ map: await texture('shoes02_diffuse.png', undefined, 512), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ map: hairTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
  const browMat = new THREE.MeshStandardMaterial({ map: await texture(o.female ? 'eyebrow006.png' : 'eyebrow001.png', undefined, 256), alphaTest: 0.3, transparent: true, depthWrite: false, roughness: 1 });
  const lashMat = new THREE.MeshStandardMaterial({ map: await texture(o.female ? 'eyelashes02.png' : 'eyelashes01.png', undefined, 256), alphaTest: 0.3, transparent: true, depthWrite: false, roughness: 1 });
  const eyeMat = new THREE.MeshStandardMaterial({ map: eyeTexture(o.iris), alphaTest: 0.5, roughness: 0.25 });

  // (es camiseta si es de su pieza o si su textura cae en la zona de la camiseta: el bajo metido en el pantalón)
  const isShirt = (f: Obj['f'][number]) => {
    if (shirtRoot.has(find(f.v[0]))) return true;
    if (!shirtUV) return false;
    let u = 0, v = 0;
    for (const ti of f.t) { u += suitObj.vt[ti][0] / f.t.length; v += suitObj.vt[ti][1] / f.t.length; }
    const px = Math.min(shirtUV.w - 1, Math.floor(u * shirtUV.w)), py = Math.min(shirtUV.h - 1, Math.floor((1 - v) * shirtUV.h));
    return shirtUV.m[(py * shirtUV.w + px) * 4] > 128;
  };
  const cent = (f: Obj['f'][number], pos: number[][]) => {
    const c = [0, 0, 0];
    for (const vi of f.v) for (let a = 0; a < 3; a++) c[a] += pos[vi][a] / f.v.length;
    return c;
  };
  const S = await fitProxy(SUIT + '.obj', SUIT + '.mhclo');
  mkMesh('Shirt', S.pos, S.ob.vt, S.ob.f, S.wOf, shirtMat, (f) => isShirt(f));
  mkMesh('Pants', S.pos, S.ob.vt, S.ob.f, S.wOf, pantsMat, (f) => !isShirt(f));
  // Pantalón corto (la playa): el mismo pantalón cortado un poco por encima de la rodilla, con el bajo recto
  const kneeY = heads.get('mixamorig:LeftLeg')![1];
  // (algo por encima de la rodilla y por debajo de donde acaba la ropa interior pintada en la piel)
  const hemY = kneeY + (hipsY - kneeY) * 0.22;
  const posShort = S.pos.map((p) => p.slice());
  const pantsVerts = new Set<number>();
  for (const f of S.ob.f) if (!isShirt(f)) for (const vi of f.v) pantsVerts.add(vi);
  const keepShort = new Map(S.ob.f.map((f) => [f, !isShirt(f) && cent(f, S.pos)[1] > hemY]));
  for (const vi of pantsVerts) if (posShort[vi][1] < hemY) posShort[vi][1] = hemY;
  mkMesh('PantsShort', posShort, S.ob.vt, S.ob.f, S.wOf, pantsMat, (f) => keepShort.get(f)!);
  const shoes = await proxy('Shoes', 'shoes02.obj', 'shoes02.mhclo', shoeMat);
  const hairFit = await fitProxy(o.hair + '.obj', o.hair + '.mhclo', o.hairVolume, (pos) => styleHair(pos, o));
  mkMesh('MHHair', hairFit.pos, hairFit.ob.vt, hairFit.ob.f, hairFit.wOf, hairMat);
  // Casquete bajo el pelo: la piel de la cabeza que tapa el peinado, en color liso (el juego le pone el del pelo).
  // Entre mechón y mechón se veía la piel, a manchas naranjas
  {
    const headC = heads.get('mixamorig:Head')!;
    const hp = hairFit.pos;
    const near = (p: number[]) => { for (const q of hp) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 < 0.09) return true; return false; };
    const capV = V.map((p) => {
      const d = [p[0] - headC[0], p[1] - headC[1], p[2] - headC[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
      return [p[0] + (d[0] / l) * 0.035, p[1] + (d[1] / l) * 0.035, p[2] + (d[2] / l) * 0.035];
    });
    const inCap = new Map<number, boolean>();
    const isCap = (vi: number) => {
      let c = inCap.get(vi);
      if (c === undefined) { c = V[vi][1] > headC[1] - 0.6 && near(V[vi]); inCap.set(vi, c); }
      return c;
    };
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    mkMesh('MHScalp', capV, base.vt, base.f, bodyW, capMat, (f) => f.g === 'body' && f.v.every(isCap));
  }
  for (const h of o.hairs ?? []) {
    const m = new THREE.MeshStandardMaterial({ map: await hairTexOf(h, 512), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
    await proxy('MHHair_' + h, h + '.obj', h + '.mhclo', m, o.hairVolume);
  }
  const brow = o.female ? 'eyebrow006' : 'eyebrow001', lash = o.female ? 'eyelashes02' : 'eyelashes01';
  await proxy('Eyebrows', brow + '.obj', brow + '.mhclo', browMat);
  await proxy('Eyelashes', lash + '.obj', lash + '.mhclo', lashMat);
  await proxy('Eyes', 'high-poly.obj', 'high-poly.mhclo', eyeMat);
  // Cuerpo en tres versiones: vestido (sin lo que tapan la ropa y los zapatos), con pantalón corto (la piel que
  // se borraba bajo la ropa solo se borra si de verdad queda tela cerca) y sin ropa (la piscina)
  const body = (f: Obj['f'][number], hidden: Set<number>) => f.g === 'body' && !f.v.some((vi) => hidden.has(vi));
  const hiddenAll = new Set([...S.del, ...shoes.del]);
  mkMesh('Body', V, base.vt, base.f, bodyW, skinMat, (f) => body(f, hiddenAll));
  const clothPts: number[][] = [];
  { const used = new Set<number>(); for (const f of S.ob.f) if (isShirt(f) || keepShort.get(f)) for (const vi of f.v) used.add(vi); for (const vi of used) clothPts.push(keepShort.size && pantsVerts.has(vi) ? posShort[vi] : S.pos[vi]); }
  // (la piel justo en el bajo del pantalón se queda: si no, quedaba un hueco por el que se veía el fondo)
  const covered = (vi: number) => { const p = V[vi]; if (p[1] < hemY + 0.25) return false; for (const q of clothPts) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 < 0.0144) return true; return false; };
  const hiddenShort = new Set([...[...S.del].filter(covered), ...shoes.del]);
  mkMesh('BodyShort', V, base.vt, base.f, bodyW, skinMat, (f) => body(f, hiddenShort));
  mkMesh('BodyFull', V, base.vt, base.f, bodyW, skinMat, (f) => f.g === 'body');
  group.userData = { mh: true, tag: o.tag ?? 'gas' };
  return group;
}

/** Normales promediadas con las vecinas: los pliegues de la ropa no hacen manchas de sombra en el cómic. */
/** Pesos de piel sin negativos y que suman 1. */
function normWeights(w: number[]) {
  const c = w.map((x) => Math.max(0, x));
  const s = c.reduce((a, b) => a + b, 0);
  return s > 0 ? c.map((x) => x / s) : [1, 0, 0, 0];
}

function smoothNormals(g: THREE.BufferGeometry, iters: number) {
  const n = g.attributes.normal as THREE.BufferAttribute;
  const p = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index!.array;
  // vértices en el mismo sitio (costuras de UV) cuentan como uno
  const key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  const weld = new Map<string, number>();
  const id = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) { const k = key(i); if (!weld.has(k)) weld.set(k, weld.size); id[i] = weld.get(k)!; }
  const nb: Set<number>[] = Array.from({ length: weld.size }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) nb[id[idx[t + a]]].add(id[idx[t + b]]);
  let cur = new Float32Array(weld.size * 3);
  for (let i = 0; i < p.count; i++) { cur[id[i] * 3] += n.getX(i); cur[id[i] * 3 + 1] += n.getY(i); cur[id[i] * 3 + 2] += n.getZ(i); }
  for (let it = 0; it < iters; it++) {
    const nx = new Float32Array(cur.length);
    for (let v = 0; v < nb.length; v++) {
      let x = cur[v * 3], y = cur[v * 3 + 1], z = cur[v * 3 + 2];
      for (const u of nb[v]) { x += cur[u * 3]; y += cur[u * 3 + 1]; z += cur[u * 3 + 2]; }
      const l = Math.hypot(x, y, z) || 1;
      nx[v * 3] = x / l; nx[v * 3 + 1] = y / l; nx[v * 3 + 2] = z / l;
    }
    cur = nx;
  }
  for (let i = 0; i < p.count; i++) n.setXYZ(i, cur[id[i] * 3], cur[id[i] * 3 + 1], cur[id[i] * 3 + 2]);
  n.needsUpdate = true;
}

/**
 * Mullet y tupé sobre el pelo corto: la nuca se alarga hacia el cuello (y algo hacia fuera) y la parte de delante y
 * de arriba sube y se adelanta. Coordenadas de MakeHuman (decímetros, y arriba, z hacia delante).
 */
function styleHair(pos: number[][], o: MHOpts) {
  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pos) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]); }
  const hY = maxY - minY, zc = (minZ + maxZ) / 2;
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (const p of pos) {
    // Mullet: detrás y por debajo de media cabeza
    const back = ss(zc, minZ + (zc - minZ) * 0.15, p[2]);
    const low = ss(minY + 0.5 * hY, minY, p[1]);
    const m = back * low;
    p[1] -= m * o.mullet;
    p[2] -= m * o.mullet * 0.18;
    p[0] *= 1 + m * 0.08;
    // Tupé: delante y arriba
    const front = ss(zc, maxZ, p[2]);
    const high = ss(minY + 0.55 * hY, maxY, p[1]);
    const q = front * high;
    p[1] += q * o.quiff;
    p[2] += q * o.quiff * 0.55;
  }
}

/**
 * Bigote fino y perilla pintados en la textura de la piel: cada cara del cuerpo cerca de la boca se rasteriza en
 * su UV y en cada píxel se mira su posición 3D respecto a la boca.
 */
function paintFacialHair(d: Uint8ClampedArray, w: number, h: number, base: Obj, V: number[][], M: number[], hairColor: number) {
  const hc = new THREE.Color(hairColor).convertLinearToSRGB();
  const col = [hc.r * 255 * 0.5, hc.g * 255 * 0.46, hc.b * 255 * 0.42];
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const mask = (x: number, y: number, z: number) => {
    if (z < M[2] - 0.6) return 0;
    const ax = Math.abs(x - M[0]), dy = y - M[1];
    // Bigote: una banda fina sobre el labio, que cae un poco hacia las comisuras
    let a = 0;
    if (ax < 0.36) {
      const yc = 0.038 - 0.32 * ax * ax;
      const t = 0.04 * Math.sqrt(Math.max(0, 1 - (ax / 0.36) ** 2)) + 0.005;
      a = Math.max(a, 1 - ss(t * 0.6, t, Math.abs(dy - yc)));
    }
    // Perilla: bajo el labio inferior y en la barbilla
    // Perilla: solo en la barbilla (con piel entre el labio y la perilla), y rodeándola un poco por debajo
    if (dy < -0.32) {
      const ex = ax / 0.2, ey = (dy + 0.55) / 0.2;
      a = Math.max(a, (1 - ss(0.78, 1.0, Math.hypot(ex, ey))) * ss(-0.32, -0.37, dy));
    }
    return a;
  };
  for (const f of base.f) {
    if (f.g !== 'body') continue;
    const near = f.v.every((vi) => Math.hypot(V[vi][0] - M[0], V[vi][1] - M[1], V[vi][2] - M[2]) < 1.8);
    if (!near) continue;
    for (let k = 1; k + 1 < f.v.length; k++) {
      const ids = [0, k, k + 1];
      const P = ids.map((j) => V[f.v[j]]);
      const T = ids.map((j) => { const t = base.vt[f.t[j]]; return [t[0] * w, (1 - t[1]) * h]; });
      const x0 = Math.floor(Math.min(T[0][0], T[1][0], T[2][0])), x1 = Math.ceil(Math.max(T[0][0], T[1][0], T[2][0]));
      const y0 = Math.floor(Math.min(T[0][1], T[1][1], T[2][1])), y1 = Math.ceil(Math.max(T[0][1], T[1][1], T[2][1]));
      const den = (T[1][1] - T[2][1]) * (T[0][0] - T[2][0]) + (T[2][0] - T[1][0]) * (T[0][1] - T[2][1]);
      if (!den) continue;
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        const b0 = ((T[1][1] - T[2][1]) * (cx - T[2][0]) + (T[2][0] - T[1][0]) * (cy - T[2][1])) / den;
        const b1 = ((T[2][1] - T[0][1]) * (cx - T[2][0]) + (T[0][0] - T[2][0]) * (cy - T[2][1])) / den;
        const b2 = 1 - b0 - b1;
        if (b0 < -0.02 || b1 < -0.02 || b2 < -0.02 || px < 0 || py < 0 || px >= w || py >= h) continue;
        const X = b0 * P[0][0] + b1 * P[1][0] + b2 * P[2][0];
        const Y = b0 * P[0][1] + b1 * P[1][1] + b2 * P[2][1];
        const Z = b0 * P[0][2] + b1 * P[1][2] + b2 * P[2][2];
        let a = mask(X, Y, Z);
        if (a <= 0) continue;
        a *= 0.78 + 0.22 * hash(px, py);
        const i = (py * w + px) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - a) + col[c] * a;
      }
    }
  }
}

/**
 * Textura de los ojos dibujada aquí (la de MakeHuman trae el alfa a cero y pierde el color al pasar por un
 * canvas): misma disposición, un ojo en cada círculo, con esclerótica, iris marrón con su anillo y pupila.
 */
function eyeTexture(iris: [string, string, string] = ['#8a5a34', '#6b4226', '#4a2c19']) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ece8e2';
  g.fillRect(0, 0, S, S);
  for (const [cx, cy] of [[0.705, 0.29], [0.29, 0.705]]) {
    const x = cx * S, y = cy * S;
    let gr = g.createRadialGradient(x, y, S * 0.1, x, y, S * 0.26);
    gr.addColorStop(0, '#f3f0eb');
    gr.addColorStop(1, '#e2cfc8');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, S * 0.26, 0, Math.PI * 2); g.fill();
    gr = g.createRadialGradient(x, y, S * 0.02, x, y, S * 0.105);
    gr.addColorStop(0, iris[0]);
    gr.addColorStop(0.55, iris[1]);
    gr.addColorStop(0.9, iris[2]);
    gr.addColorStop(1, '#2e1b10');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, S * 0.105, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d0907';
    g.beginPath(); g.arc(x, y, S * 0.038, 0, Math.PI * 2); g.fill();
  }
  // La córnea (casquete de delante) usa el circulito de la esquina: transparente, para ver el iris debajo
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(0.934 * S, 0.927 * S, 0.075 * S, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}

/**
 * Versión ligera de una malla con piel (para la multitud): se simplifica la geometría y cada vértice que queda
 * (el simplificador solo junta vértices: los que quedan son de los de antes) recupera sus pesos de piel.
 */
export function lightSkinned(m: THREE.SkinnedMesh, keep: number) {
  const src = m.geometry;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const si = src.attributes.skinIndex as THREE.BufferAttribute, sw = src.attributes.skinWeight as THREE.BufferAttribute;
  const key = (x: number, y: number, z: number) => `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
  const at = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) at.set(key(pos.getX(i), pos.getY(i), pos.getZ(i)), i);
  const merged = mergeVertices(src.clone());
  const n = merged.attributes.position.count;
  const g = new SimplifyModifier().modify(merged, Math.floor(n * (1 - keep)));
  const p2 = g.attributes.position as THREE.BufferAttribute;
  const SI = new Uint16Array(p2.count * 4), SW = new Float32Array(p2.count * 4);
  for (let i = 0; i < p2.count; i++) {
    const j = at.get(key(p2.getX(i), p2.getY(i), p2.getZ(i))) ?? 0;
    for (let k = 0; k < 4; k++) { SI[i * 4 + k] = si.getComponent(j, k); SW[i * 4 + k] = sw.getComponent(j, k); }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.computeVertexNormals();
  // la ropa, un poco hacia fuera: al simplificar cuerpo y ropa por separado, la piel asomaba a manchas
  // (la camiseta, por fuera del pantalón: con el mismo grosor se peleaban y salían trozos de una en la otra)
  const inflate = m.name === 'Shirt' ? 0.02 : /^(Pants|PantsShort)$/.test(m.name) ? 0.011 : 0;
  if (inflate) {
    const n = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < p2.count; i++) p2.setXYZ(i, p2.getX(i) + n.getX(i) * inflate, p2.getY(i) + n.getY(i) * inflate, p2.getZ(i) + n.getZ(i) * inflate);
  }
  const out = new THREE.SkinnedMesh(g, m.material);
  out.name = m.name;
  m.parent!.add(out);
  out.bind(m.skeleton, m.bindMatrix);
  m.removeFromParent();
  return out;
}

export async function exportGLB(obj: THREE.Object3D) {
  const ex = new GLTFExporter();
  const buf = (await ex.parseAsync(obj, { binary: true, maxTextureSize: 1024 })) as ArrayBuffer;
  return buf;
}
