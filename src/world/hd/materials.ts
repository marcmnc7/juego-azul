import * as THREE from 'three';
import { comicTile } from '../../core/comicTiles';

// Materiales del pueblo de tebeo (Ferreries, el Born, Ciutadella): cada uno con su dibujo hecho a mano de
// comicTiles.ts (losas, sillares de marès, encalado, teja árabe, madera, puertas y ventanas), que se repite por los
// UV que pone builder.ts. El cómic los pasa a tres tonos al montar la escena (comic.ts).

/** Dibujo de tebeo de ese tipo, marcado para que el cómic lo reconozca (userData.comic). */
function tex(kind: string) {
  const t = comicTile(kind)!;
  t.userData.comic = kind;
  return t;
}

function std(p: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial(p);
}

function drawn(kind: string, opts: THREE.MeshStandardMaterialParameters = {}) {
  return std({ map: tex(kind), roughness: 1, metalness: 0, ...opts });
}

export type HdMats = ReturnType<typeof createHdMaterials>;
let cached: HdMats | null = null;

export function makeHdMaterials(): HdMats {
  return (cached ??= createHdMaterials());
}

function createHdMaterials() {
  const deco = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  return {
    mares: drawn('mares', { color: 0xf3e2c4 }),
    maresDark: drawn('mares', { color: 0xc9b596 }),
    // Ferreries es un pueblo encalado: encalado teñido de blanco roto
    whites: [0xffffff, 0xfffaf2, 0xfdf8ee, 0xf8f3ea].map((c) => drawn('wash', { color: c })),
    plasterCream: drawn('wash', { color: 0xfff0d8 }),
    slabs: drawn('slabs', { color: 0xe8e0d2 }),
    roof: drawn('roof'),
    roofGrey: drawn('roofGrey'),
    doors: drawn('doors', deco),
    shutters: new Map<number, THREE.MeshStandardMaterial>(),
    iron: std({ color: 0x1d1f22, roughness: 0.45, metalness: 0.85 }),
    zinc: std({ color: 0x8a8e90, roughness: 0.4, metalness: 0.7 }),
    wood: std({ map: tex('wood'), roughness: 0.7, color: 0xd9b48a }),
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
