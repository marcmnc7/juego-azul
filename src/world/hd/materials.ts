import * as THREE from 'three';
import { quality } from '../../core/gfx';
import maresC from '../../assets/hd/mares_c.jpg';
import maresN from '../../assets/hd/mares_n.jpg';
import maresR from '../../assets/hd/mares_r.jpg';
import plasterC from '../../assets/hd/plaster_c.jpg';
import plasterN from '../../assets/hd/plaster_n.jpg';
import plasterR from '../../assets/hd/plaster_r.jpg';
import slabsC from '../../assets/hd/slabs_c.jpg';
import slabsN from '../../assets/hd/slabs_n.jpg';
import slabsR from '../../assets/hd/slabs_r.jpg';
import roofC from '../../assets/hd/roof_c.jpg';
import roofN from '../../assets/hd/roof_n.jpg';
import roofR from '../../assets/hd/roof_r.jpg';
import doorsC from '../../assets/hd/doors_c.jpg';
import doorsN from '../../assets/hd/doors_n.jpg';
import doorsR from '../../assets/hd/doors_r.jpg';
import woodC from '../../assets/hd/wood_c.jpg';
// Variantes de Menorca: el estuco encalado (blanco) y la teja árabe anaranjada
import whitewashC from '../../assets/hd/whitewash_c.jpg';
import roofMC from '../../assets/hd/roofm_c.jpg';

// Materiales PBR de la prueba de concepto: texturas fotográficas con color, relieve (normal map) y
// rugosidad. En los .jpg de rugosidad de Sponza la rugosidad va en el canal G (formato glTF).

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
/** Qué dibujo de tebeo sustituye a cada foto en el estilo cómic (ver core/comicTiles.ts). */
const COMIC_KIND = new Map<string, string>([
  [slabsC, 'slabs'], [maresC, 'mares'], [roofMC, 'roof'], [roofC, 'roofGrey'],
  [whitewashC, 'wash'], [plasterC, 'wash'], [woodC, 'wood'],
]);
function tex(url: string, color: boolean) {
  let t = texCache.get(url);
  if (!t) {
    t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    const kind = color ? COMIC_KIND.get(url) : undefined;
    if (kind) t.userData.comic = kind;
    texCache.set(url, t);
  }
  return t;
}

/** MeshStandardMaterial; en los dispositivos que no lo pintan bien, Phong con los mismos mapas. */
function std(p: THREE.MeshStandardMaterialParameters) {
  if (quality.kind === 'standard') return new THREE.MeshStandardMaterial(p);
  const { roughness, metalness: _m, roughnessMap: _r, metalnessMap: _mm, ...rest } = p;
  void _m, void _r, void _mm;
  const smooth = 1 - (roughness ?? 0.8);
  return new THREE.MeshPhongMaterial({ shininess: 4 + 90 * smooth * smooth, ...(rest as THREE.MeshPhongMaterialParameters) }) as unknown as THREE.MeshStandardMaterial;
}

function pbr(c: string, n: string, r: string, opts: THREE.MeshStandardMaterialParameters = {}, normalScale = 1) {
  return std({
    map: tex(c, true), normalMap: tex(n, false), roughnessMap: tex(r, false),
    roughness: 1, metalness: 0, normalScale: new THREE.Vector2(normalScale, normalScale), ...opts,
  });
}

export type HdMats = ReturnType<typeof createHdMaterials>;
let cached: HdMats | null = null;

export function makeHdMaterials(): HdMats {
  return (cached ??= createHdMaterials());
}

function createHdMaterials() {
  const deco = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  return {
    mares: pbr(maresC, maresN, maresR, { color: 0xf3e2c4 }),
    maresDark: pbr(maresC, maresN, maresR, { color: 0xc9b596 }),
    // Ferreries es un pueblo encalado: el estuco de Sponza teñido de blanco roto
    whites: [0xffffff, 0xfffaf2, 0xfdf8ee, 0xf8f3ea].map((c) => pbr(whitewashC, plasterN, plasterR, { color: c }, 0.7)),
    plasterCream: pbr(plasterC, plasterN, plasterR, { color: 0xfff0d8 }, 0.8),
    slabs: pbr(slabsC, slabsN, slabsR, { color: 0xe8e0d2 }, 1.2),
    roof: pbr(roofMC, roofN, roofR, {}, 1.2),
    roofGrey: pbr(roofC, roofN, roofR, {}, 1.2),
    doors: pbr(doorsC, doorsN, doorsR, deco),
    shutters: new Map<number, THREE.MeshStandardMaterial>(),
    iron: std({ color: 0x1d1f22, roughness: 0.45, metalness: 0.85 }),
    zinc: std({ color: 0x8a8e90, roughness: 0.4, metalness: 0.7 }),
    wood: std({ map: tex(woodC, true), roughness: 0.7, color: 0xd9b48a }),
    glass: [0x2f7d4a, 0xbfe3ee, 0x8a5a1c].map((c) => std({ color: c, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.75 })),
    cup: std({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    lemonade: std({ color: 0xf2e27a, roughness: 0.2, transparent: true, opacity: 0.85 }),
    gin: std({ color: 0xa8d4b8, roughness: 0.1, transparent: true, opacity: 0.8 }),
    label: std({ color: 0xf4efe2, roughness: 0.7 }),
    lantern: std({ color: 0xfff1c9, emissive: 0xffcf7a, emissiveIntensity: 0.6, roughness: 0.3 }),
  };
}

/** Persiana mallorquina (de lamas) del color pedido, con marco y desgaste del sol. */
export function shutterMat(M: HdMats, color: number) {
  let m = M.shutters.get(color);
  if (m) return m;
  const base = new THREE.Color(color);
  const css = (k: number) => '#' + base.clone().multiplyScalar(k).getHexString();
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = css(0.85);
  g.fillRect(0, 0, 256, 512);
  for (const x of [0, 128]) {
    g.fillStyle = css(1);
    g.fillRect(x + 8, 8, 112, 496);
    for (let y = 20; y < 496; y += 13) {
      const grd = g.createLinearGradient(0, y, 0, y + 13);
      grd.addColorStop(0, css(1.45));
      grd.addColorStop(0.55, css(0.98));
      grd.addColorStop(1, css(0.5));
      g.fillStyle = grd;
      g.fillRect(x + 16, y, 96, 12);
    }
    g.strokeStyle = css(0.35);
    g.lineWidth = 4;
    g.strokeRect(x + 10, 10, 108, 492);
  }
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,230,${rnd() * 0.06})`;
    g.fillRect(rnd() * 256, rnd() * 512, 2 + rnd() * 6, 1 + rnd() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  m = std({ map: t, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.shutters.set(color, m);
  return m;
}
