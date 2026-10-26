import * as THREE from 'three';
import maresC from './assets/mares_c.jpg';
import maresN from './assets/mares_n.jpg';
import maresR from './assets/mares_r.jpg';
import plasterC from './assets/plaster_c.jpg';
import plasterN from './assets/plaster_n.jpg';
import plasterR from './assets/plaster_r.jpg';
import slabsC from './assets/slabs_c.jpg';
import slabsN from './assets/slabs_n.jpg';
import slabsR from './assets/slabs_r.jpg';
import roofC from './assets/roof_c.jpg';
import roofN from './assets/roof_n.jpg';
import roofR from './assets/roof_r.jpg';
import doorsC from './assets/doors_c.jpg';
import doorsN from './assets/doors_n.jpg';
import doorsR from './assets/doors_r.jpg';
import woodC from './assets/wood_c.jpg';
import waterN from './assets/water_n.jpg';

// Materiales PBR con texturas fotográficas: color, relieve (normal map) y rugosidad.
// En los .jpg de rugosidad de Sponza la rugosidad va en el canal G y el metal en el B (formato glTF).

const loader = new THREE.TextureLoader();
let anisotropy = 4;
export function setAnisotropy(a: number) { anisotropy = Math.min(8, a); }

function tex(url: string, color: boolean) {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pbr(c: string, n: string, r: string, opts: THREE.MeshStandardMaterialParameters = {}, normalScale = 1) {
  return new THREE.MeshStandardMaterial({
    map: tex(c, true), normalMap: tex(n, false), roughnessMap: tex(r, false), metalnessMap: undefined,
    roughness: 1, metalness: 0, normalScale: new THREE.Vector2(normalScale, normalScale), ...opts,
  });
}

export type Mats = ReturnType<typeof makeMaterials>;

export function makeMaterials() {
  const shutter = shutterTexture();
  const m = {
    mares: pbr(maresC, maresN, maresR, { color: 0xf3e2c4 }),
    maresDark: pbr(maresC, maresN, maresR, { color: 0xc9b596 }),
    plasterCream: pbr(plasterC, plasterN, plasterR, { color: 0xfff0d8 }, 0.8),
    plasterOchre: pbr(plasterC, plasterN, plasterR, { color: 0xf0c890 }, 0.8),
    plasterWhite: pbr(plasterC, plasterN, plasterR, { color: 0xffffff }, 0.6),
    slabs: pbr(slabsC, slabsN, slabsR, { color: 0xe8e0d2 }, 1.2),
    roof: pbr(roofC, roofN, roofR, {}, 1.2),
    doors: pbr(doorsC, doorsN, doorsR, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    shutter: new THREE.MeshStandardMaterial({ map: shutter, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.45, metalness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ map: tex(woodC, true), roughness: 0.7, color: 0xd9b48a }),
    awning: new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.8, side: THREE.DoubleSide }),
    lantern: new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffcf7a, emissiveIntensity: 0.6, roughness: 0.3 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1b5566, roughness: 0.06, metalness: 0.1, normalMap: tex(waterN, false), normalScale: new THREE.Vector2(0.35, 0.35) }),
  };
  m.water.normalMap!.repeat.set(24, 24);
  return m;
}

/** Persiana mallorquina verde, con lamas y marco: el sello de las fachadas de Ciutadella. */
function shutterTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f5a3a';
  g.fillRect(0, 0, 256, 512);
  for (const x of [0, 128]) {
    g.fillStyle = '#25693f';
    g.fillRect(x + 8, 8, 112, 496);
    for (let y = 20; y < 496; y += 13) {
      const grd = g.createLinearGradient(0, y, 0, y + 13);
      grd.addColorStop(0, '#3b8a5a'); grd.addColorStop(0.55, '#24663d'); grd.addColorStop(1, '#123822');
      g.fillStyle = grd;
      g.fillRect(x + 16, y, 96, 12);
    }
    g.strokeStyle = '#0d2a18'; g.lineWidth = 4; g.strokeRect(x + 10, 10, 108, 492);
  }
  // Desgaste del sol
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,230,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 6, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function awningTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3efe6' : '#8c1f2a'; g.fillRect(i * 32, 0, 32, 64); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function labelTexture(text: string, bg: string, fg: string, w = 512, h = 128, font = 'bold 64px Georgia, serif') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function clockTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9e1cf'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#222'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const roman = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  roman.forEach((r, i) => { const a = (i / 12) * Math.PI * 2; g.fillText(r, 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); });
  g.lineCap = 'round';
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 50 * Math.sin(5.4), 128 - 50 * Math.cos(5.4)); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 80 * Math.sin(3.1), 128 - 80 * Math.cos(3.1)); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
