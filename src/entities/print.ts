import * as THREE from 'three';
import { boneAnchor } from './rig';
import type { Person } from './models';

// Lo que va estampado en una camiseta: un dibujo en un lienzo, en una lámina un poco curvada, pegada al
// pecho y que se mueve con él. Vale para los dos modelos (y para los muñecos del modo ligero).

function printTexture(draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  draw(cv.getContext('2d')!, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let horseTex: THREE.Texture | null = null;
/** La de Sant Joan: blanca con un caballo de manos dibujado y el nombre debajo. */
export function horsePrint() {
  return (horseTex ??= printTexture((c, S) => {
    const k = S / 100;
    c.clearRect(0, 0, S, S);
    c.fillStyle = c.strokeStyle = '#1b1b20';
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const pts = [[70, 86], [67, 72], [70, 60], [74, 50], [78, 43], [72, 34], [62, 28], [52, 21], [46, 12], [42, 6], [38, 3], [34, 7], [28, 10], [20, 18], [22, 22], [30, 20], [34, 23], [38, 30], [30, 34], [20, 30], [14, 34], [22, 40], [34, 42], [28, 49], [18, 47], [14, 53], [26, 56], [40, 50], [50, 54], [56, 61], [54, 73], [50, 86], [56, 86], [60, 75], [64, 66], [64, 76], [64, 86]];
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k)));
    c.closePath();
    c.fill();
    // Cola y crin
    c.lineWidth = 3.2 * k;
    c.beginPath();
    c.moveTo(78 * k, 43 * k);
    c.quadraticCurveTo(92 * k, 50 * k, 88 * k, 72 * k);
    c.stroke();
    c.lineWidth = 2.2 * k;
    for (const [x, y] of [[45, 10], [50, 17], [56, 23]]) {
      c.beginPath();
      c.moveTo(x * k, y * k);
      c.lineTo((x + 8) * k, (y - 5) * k);
      c.stroke();
    }
    c.fillStyle = '#c8202c';
    c.font = `bold ${10 * k}px Georgia, serif`;
    c.textAlign = 'center';
    c.fillText('Sant Joan', 50 * k, 98 * k);
  }));
}

let fitoTex: THREE.Texture | null = null;
/** La de Fito, en rojo sobre la camiseta azul. */
export function fitoPrint() {
  return (fitoTex ??= printTexture((c, S) => {
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#d7263d';
    c.fillRect(0, S * 0.12, S, S * 0.76);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `900 ${S * 0.36}px Impact, 'Arial Black', sans-serif`;
    c.fillText('FITO', S / 2, S * 0.4);
    c.font = `bold ${S * 0.12}px Georgia, serif`;
    c.fillText('& Fitipaldis', S / 2, S * 0.7);
  }));
}

/** Estampa `tex` en el pecho. size: ancho en metros; y, z: posición respecto al hueso del pecho. */
export function shirtPrint(p: Person, tex: THREE.Texture, size = 0.25) {
  // En un personaje de VRoid el estampado va pintado en la textura de su camiseta (ver docs/PLAN-reparto-vroid.md)
  if (p.rig?.kind.startsWith('vrm:')) return;
  const woman = p.rig?.kind === 'woman';
  const geo = new THREE.PlaneGeometry(size, size, 8, 1);
  const P = geo.attributes.position as THREE.BufferAttribute;
  const R = woman ? 0.16 : 0.2; // el pecho es curvo: la lámina también
  for (let i = 0; i < P.count; i++) P.setZ(i, -(P.getX(i) * P.getX(i)) / (2 * R));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  m.userData.noCast = true;
  m.frustumCulled = false;
  if (p.rig) {
    const a = boneAnchor(p, 'Spine2');
    m.position.set(0, woman ? -0.02 : -0.03, woman ? 0.135 : 0.155);
    a.add(m);
  } else {
    m.position.set(0, 1.0, 0.17);
    p.body.add(m);
  }
  return m;
}
