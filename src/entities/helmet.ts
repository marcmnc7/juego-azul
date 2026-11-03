import * as THREE from 'three';
import { quality } from '../core/gfx';

// Casco integral de moto: carcasa con la ventana de los ojos abierta, mentonera, visera ahumada que
// sobresale un poco, ribete de goma abajo, franja de color por encima y tomas de aire. Va
// pegado al hueso de la cabeza (origen en el centro de la cabeza, mirando hacia +Z).

export interface HelmetOpts {
  /** Color de la carcasa. */
  color: number;
  /** Franja de arriba (de delante atrás). */
  stripe?: number;
  /** Carcasa mate (sin barniz). */
  matte?: boolean;
  /** Visera transparente en vez de ahumada (se le ven los ojos). */
  clearVisor?: boolean;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

function mat(p: THREE.MeshPhysicalMaterialParameters) {
  if (quality.kind === 'standard') return new THREE.MeshPhysicalMaterial(p);
  const { clearcoat: _c, clearcoatRoughness: _cr, transmission: _t, ...rest } = p;
  void _c, void _cr, void _t;
  return new THREE.MeshStandardMaterial(rest as THREE.MeshStandardMaterialParameters);
}

// Ángulos de la esfera (theta desde arriba, phi alrededor; la cara mira a +Z, que es phi = π/2 en
// la SphereGeometry de three, donde x = -cos(phi)·sin(theta) y z = sin(phi)·sin(theta))
const R = 0.155;
const EYE_TOP = 1.0; // borde de arriba de la ventana
const EYE_BOT = 1.62; // borde de abajo (empieza la mentonera)
const BOTTOM = 2.3; // donde acaba la carcasa, a la altura de la nuca
const WIN = 0.82; // media anchura de la ventana
const FRONT = Math.PI / 2;

export function makeHelmet(o: HelmetOpts) {
  const g = new THREE.Group();
  const shellMat = mat({ color: o.color, roughness: o.matte ? 0.55 : 0.22, metalness: 0.15, clearcoat: o.matte ? 0 : 1, clearcoatRoughness: 0.06 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
  const visorMat = mat({ color: o.clearVisor ? 0xcfe3f0 : 0x1a2430, roughness: 0.04, metalness: o.clearVisor ? 0 : 0.35, clearcoat: 1, transparent: true, opacity: o.clearVisor ? 0.35 : 0.88 });
  const add = (gg: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.Mesh(gg, m);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  // Cúpula entera por arriba de la ventana
  add(geo('dome', () => new THREE.SphereGeometry(R, 40, 14, 0, Math.PI * 2, 0, EYE_TOP)), shellMat);
  // Laterales y nuca, sin la ventana de delante
  add(geo('sides', () => new THREE.SphereGeometry(R, 40, 12, FRONT + WIN, Math.PI * 2 - WIN * 2, EYE_TOP, BOTTOM - EYE_TOP)), shellMat);
  // Mentonera: la parte de delante por debajo de los ojos, un poco más saliente (morro)
  const chin = add(geo('chin', () => new THREE.SphereGeometry(R, 20, 8, FRONT - WIN, WIN * 2, EYE_BOT, BOTTOM - EYE_BOT)), shellMat);
  chin.scale.set(1, 1, 1.08);
  // Interior oscuro que se ve por la ventana (sin cara: con la visera ahumada no se ve)
  const inner = add(geo('inner', () => new THREE.SphereGeometry(R * 0.93, 20, 8, FRONT - WIN, WIN * 2, EYE_TOP, EYE_BOT - EYE_TOP)), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 1, side: THREE.BackSide }));
  inner.castShadow = false;
  // Visera: algo más grande que la carcasa, tapa la ventana y sube un poco por la frente
  const visor = add(geo('visor', () => new THREE.SphereGeometry(R * 1.035, 28, 10, FRONT - WIN - 0.08, WIN * 2 + 0.16, EYE_TOP - 0.12, EYE_BOT - EYE_TOP + 0.16)), visorMat);
  visor.castShadow = false;
  // Pivotes de la visera
  for (const sx of [-1, 1]) {
    const p = add(geo('pivot', () => new THREE.CylinderGeometry(0.018, 0.018, 0.012, 14).rotateZ(Math.PI / 2)), rubber);
    p.position.set(sx * R * 0.99, -0.005, 0.035);
  }
  // Ribete de goma alrededor del cuello
  const rim = add(geo('rim', () => new THREE.TorusGeometry(R * Math.sin(BOTTOM), 0.012, 8, 40).rotateX(Math.PI / 2)), rubber);
  rim.position.y = R * Math.cos(BOTTOM);
  // Franja de delante atrás por encima
  if (o.stripe !== undefined) {
    // Arco en el plano YZ: de la nuca, por encima, hasta justo encima de la visera
    const st = add(geo('stripe', () => new THREE.TorusGeometry(R * 0.995, 0.011, 6, 40, 2.9).rotateZ(-0.5).rotateY(Math.PI / 2)), mat({ color: o.stripe, roughness: 0.3, clearcoat: 1 }));
    st.scale.set(2.2, 1, 1); // más ancha que alta: una franja pintada, no un tubo
    st.castShadow = false;
  }
  // Dos tomas de aire en la frente, casi a ras de la carcasa (el alerón parecía una oreja)
  for (const sx of [-1, 1]) {
    const v = add(geo('vent', () => new THREE.BoxGeometry(0.028, 0.006, 0.026)), rubber);
    v.position.set(sx * 0.035, R * 0.9, R * 0.42);
    v.rotation.x = -0.45;
  }
  return g;
}
