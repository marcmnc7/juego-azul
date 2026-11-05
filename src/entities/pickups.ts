import * as THREE from 'three';
import { glowTexture, toon } from '../core/gfx';

// Lo que se recoge en la carretera: objetos de verdad que giran sobre sí mismos, con un halo suave
// detrás para verlos de lejos (antes eran emojis pegados en un cartel, con su recuadro alrededor).

function part(g: THREE.Group, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, emissive = 0x000000, metal = false) {
  const mesh = new THREE.Mesh(geo, toon({ color, emissive, ...(metal ? { metalness: 0.8, roughness: 0.35 } : { roughness: 0.55 }) }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

function halo(g: THREE.Group, color: number, size: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  g.add(s);
}

/** Una cámara de fotos: cuerpo, objetivo con su aro de metal, visor, flash y disparador. */
export function makeCameraPickup() {
  const g = new THREE.Group();
  g.userData.noCam = true;
  part(g, new THREE.BoxGeometry(0.86, 0.56, 0.34), 0x1d1f24);
  part(g, new THREE.BoxGeometry(0.88, 0.14, 0.36), 0x9a7a4a, 0, -0.1, 0); // banda de piel
  part(g, new THREE.BoxGeometry(0.34, 0.14, 0.24), 0x2a2d33, -0.1, 0.34, 0); // visor
  part(g, new THREE.BoxGeometry(0.16, 0.1, 0.06), 0xfff6d8, 0.27, 0.19, 0.18, 0xffe9a8); // flash
  part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), 0xc8ccd0, 0.3, 0.3, 0, 0x000000, true); // disparador
  const barrel = part(g, new THREE.CylinderGeometry(0.21, 0.23, 0.22, 24), 0xc8ccd0, 0, 0, 0.27, 0x000000, true);
  barrel.rotation.x = Math.PI / 2;
  const lens = part(g, new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), 0x10202e, 0, 0, 0.385, 0x0a2a44);
  lens.rotation.x = Math.PI / 2;
  halo(g, 0xfff0c0, 2.4);
  return g;
}

/** Un bidón de gasolina rojo, con asa y tapón. */
export function makeFuelPickup() {
  const g = new THREE.Group();
  g.userData.noCam = true;
  part(g, new THREE.BoxGeometry(0.62, 0.8, 0.3), 0xc8262c);
  part(g, new THREE.BoxGeometry(0.5, 0.06, 0.32), 0x8e1a1f, 0, 0.1, 0);
  part(g, new THREE.BoxGeometry(0.5, 0.06, 0.32), 0x8e1a1f, 0, -0.14, 0);
  part(g, new THREE.BoxGeometry(0.34, 0.07, 0.1), 0x8e1a1f, -0.06, 0.53, 0); // asa
  for (const sx of [-0.2, 0.08]) part(g, new THREE.BoxGeometry(0.06, 0.16, 0.08), 0x8e1a1f, sx, 0.46, 0);
  part(g, new THREE.CylinderGeometry(0.07, 0.08, 0.12, 12), 0xf2c230, 0.22, 0.46, 0); // tapón
  halo(g, 0xff9a50, 2.4);
  return g;
}

/** Una cajetilla de tabaco abierta, con los cigarrillos asomando. */
export function makeTobaccoPickup() {
  const g = new THREE.Group();
  g.userData.noCam = true;
  part(g, new THREE.BoxGeometry(0.5, 0.72, 0.24), 0xf1ece0);
  part(g, new THREE.BoxGeometry(0.51, 0.28, 0.25), 0xb8232f, 0, 0.2, 0);
  part(g, new THREE.BoxGeometry(0.52, 0.05, 0.26), 0xd6b35a, 0, 0.04, 0);
  for (const [x, h] of [[-0.14, 0.2], [0, 0.28], [0.14, 0.16]]) {
    part(g, new THREE.CylinderGeometry(0.036, 0.036, h, 10), 0xfbf7ee, x, 0.36 + h / 2, 0);
    part(g, new THREE.CylinderGeometry(0.037, 0.037, 0.06, 10), 0xc99a5a, x, 0.36 + h - 0.03, 0);
  }
  halo(g, 0xffd0a0, 2);
  return g;
}
