import * as THREE from 'three';
import { loadGLB } from '../core/assets';
import { quality } from '../core/gfx';
import foxUrl from '../assets/chars/fox.glb';
import { boneAnchor, grayTexture, makeRigPerson, rigTickers } from './rig';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeHelmet, type HelmetOpts } from './helmet';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MARC_LOOK, MARGAUX_LOOK } from '../data/characters';
import type { Dog, Person, PersonLook } from './models';

// Vehículos y animales de los capítulos con la calidad de la prueba de concepto:
// - coche: un compacto de cinco puertas hecho con piezas (el Ford Focus gris de Azul y los demás)
// - moto: hecha con piezas PBR (pintura, cromo, goma) y Gas sentado, con casco
// - Joy: el zorro animado de las muestras de glTF de Khronos, teñido de negro, con collar

let fox: GLTF | null = null;
let loading: Promise<void> | null = null;

export const vehiclesReady = () => !!fox;

export function preloadVehicles() {
  loading ??= loadGLB(foxUrl)
    .then((f) => {
      // El zorro no trae normales
      f.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      });
      fox = f;
    })
    .catch((e) => console.warn('[gfx] no se pudieron cargar los vehículos', e));
  return loading;
}

const lin = (hex: number) => new THREE.Color(hex);

function phys(p: THREE.MeshPhysicalMaterialParameters): THREE.MeshStandardMaterial {
  if (quality.kind === 'standard') return new THREE.MeshPhysicalMaterial(p);
  const { clearcoat: _c, clearcoatRoughness: _cr, ...rest } = p;
  void _c, void _cr;
  return new THREE.MeshStandardMaterial(rest as THREE.MeshStandardMaterialParameters);
}

const paintCache = new Map<number, THREE.MeshStandardMaterial>();
function paint(color: number) {
  let m = paintCache.get(color);
  if (!m) paintCache.set(color, (m = phys({ color: lin(color), metalness: 0.6, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04 })));
  return m;
}

/** Persona sentada (piernas hacia delante, manos al frente) que sigue con la animación de reposo arriba. */
function seated(look: PersonLook, scale: number, hands: number) {
  const p = makeRigPerson(look, scale, new THREE.Object3D());
  p.rig!.force = { legL: 1, legR: 1, armL: 1, armR: 1 };
  p.legL.rotation.set(-1.45, 0, -0.08);
  p.legR.rotation.set(-1.45, 0, 0.08);
  p.kneeL.rotation.x = p.kneeR.rotation.x = 1.35;
  p.armL.rotation.set(-hands, 0, -0.05);
  p.armR.rotation.set(-hands, 0, 0.05);
  p.elbowL.rotation.x = p.elbowR.rotation.x = -0.6;
  return p;
}


/** Perfil lateral (z hacia delante, y hacia arriba) extruido a lo ancho y centrado en x. */
function profile(pts: [number, number][], width: number, bevel: number) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // la x del perfil pasa a ser la z del mundo
  return toCreasedNormals(g, 0.5);
}

/**
 * Compacto de cinco puertas (el Ford Focus gris de Azul, el coche azul de Gas, los aparcados), hecho con
 * piezas PBR: carrocería lacada, habitáculo de cristal tintado, techo, pilares, plásticos, faros y ruedas
 * con llanta. Medidas de un Focus: 4,38 × 1,82 × 1,47 m y 2,70 m de batalla. Mira hacia +Z, con la misma
 * interfaz que el de los muñecos (root, body, joy, wheels, azul).
 */
export function makeCarHD(color: number, opts: { empty?: boolean; azul?: PersonLook; gas?: PersonLook } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = body) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const lacquer = paint(color);
  const glass = phys({ color: 0x141b22, metalness: 0.1, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.82 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.75 });
  const chrome = phys({ color: 0xc9ced4, metalness: 1, roughness: 0.22 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xfff3d6, emissiveIntensity: 0.6, roughness: 0.1 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x8a0d10, emissive: 0xff1a1a, emissiveIntensity: 0.45, roughness: 0.25 });
  const box = new THREE.BoxGeometry(1, 1, 1);

  // Carrocería hasta la línea de cintura: portón trasero casi vertical, capó corto y en pendiente
  add(
    profile(
      [[-2.12, 0.3], [2.1, 0.3], [2.19, 0.46], [2.17, 0.68], [2.02, 0.82], [1.2, 0.98], [0.98, 1.02], [-1.9, 1.06], [-2.12, 0.98], [-2.19, 0.62]],
      1.82,
      0.07,
    ),
    lacquer,
  );
  // Habitáculo de cristal, algo más estrecho, con el techo pintado encima
  add(profile([[-1.98, 1.02], [-1.78, 1.36], [-1.45, 1.44], [0.1, 1.43], [1.0, 1.0]], 1.58, 0.05), glass);
  add(profile([[-1.74, 1.38], [-1.45, 1.475], [0.12, 1.465], [0.32, 1.38]], 1.5, 0.04), lacquer);
  // Pilares B y C (los del parabrisas los marca el propio techo)
  for (const sx of [-0.8, 0.8]) {
    add(box, plastic, sx, 1.22, -0.32, 0.04, 0.42, 0.12);
    add(box, lacquer, sx * 0.99, 1.2, -1.62, 0.05, 0.36, 0.28);
  }
  // Paragolpes, faldones y pasos de rueda en plástico negro
  add(box, plastic, 0, 0.36, 2.15, 1.7, 0.16, 0.12);
  add(box, plastic, 0, 0.36, -2.15, 1.7, 0.16, 0.12);
  for (const sx of [-0.92, 0.92]) add(box, plastic, sx, 0.34, 0.05, 0.04, 0.12, 2.2);
  // Calandra, faros rasgados y pilotos traseros horizontales
  add(box, plastic, 0, 0.6, 2.18, 0.9, 0.16, 0.04);
  add(box, chrome, 0, 0.7, 2.19, 0.3, 0.05, 0.02);
  for (const sx of [-0.62, 0.62]) {
    add(box, lamp, sx, 0.74, 2.12, 0.42, 0.1, 0.06);
    add(box, tail, sx, 0.86, -2.17, 0.4, 0.09, 0.05);
  }
  // Retrovisores y matrícula
  for (const sx of [-0.98, 0.98]) add(box, lacquer, sx, 1.08, 0.85, 0.16, 0.1, 0.1);
  add(box, new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.5 }), 0, 0.5, 2.22, 0.52, 0.11, 0.01);
  add(box, new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.5 }), 0, 0.58, -2.21, 0.52, 0.11, 0.01);

  // Ruedas: cada una en un soporte propio, para que girar x las haga rodar hacia delante
  const wheels: THREE.Object3D[] = [];
  const tire = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 28).rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.21, 0.21, 0.23, 20).rotateZ(Math.PI / 2);
  const spoke = new THREE.BoxGeometry(0.235, 0.36, 0.05);
  for (const [x, z] of [[0.8, 1.38], [-0.8, 1.38], [0.8, -1.32], [-0.8, -1.32]] as const) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.32, z);
    add(tire, rubber, 0, 0, 0, 1, 1, 1, holder);
    add(rim, chrome, 0, 0, 0, 1, 1, 1, holder);
    for (let k = 0; k < 5; k++) add(spoke, plastic, 0, 0, 0, 1, 1, 1, holder).rotation.x = (k * Math.PI) / 5;
    root.add(holder);
    wheels.push(holder);
  }

  // Ocupantes: conductor a la izquierda (+x mirando a +Z) y copiloto
  const azul = new THREE.Group();
  const joy = new THREE.Group();
  if (!opts.empty) {
    const gas = seated(opts.gas ?? MARC_LOOK, 0.95, 0.9);
    gas.root.position.set(0.4, 0.62 - gas.rig!.hipsHeight * 0.95, -0.25);
    body.add(gas.root);
    const az = seated(opts.azul ?? MARGAUX_LOOK, 0.95, 0.35);
    az.root.position.set(-0.4, 0.62 - az.rig!.hipsHeight * 0.95, -0.25);
    azul.add(az.root);
    body.add(azul);
  }
  return { root, body, joy, wheels, azul };
}

/**
 * Moto naked de media cilindrada hecha por piezas (depósito, colín y tapas con perfil; chasis
 * multitubular, motor con aletas, radiador, escape, horquilla, guardabarros, faro con cúpula, cuadro,
 * retrovisores, intermitentes, matrícula, estriberas, discos y cadena), fundidas por material para que
 * cueste pocas llamadas de dibujo. Con el piloto montado y su casco integral. Mira hacia +Z.
 */
export function makeMotoHD(color: number, rider?: PersonLook, helmet: HelmetOpts = { color, stripe: 0xf2f2ee }, collect?: Map<THREE.Material, THREE.BufferGeometry[]>) {
  const root = new THREE.Group();
  const frame = new THREE.Group();
  root.add(frame);
  const body = paint(color);
  const chrome = phys({ color: 0xdfe3e8, metalness: 1, roughness: 0.15 });
  const darkMetal = phys({ color: 0x2a2c30, metalness: 0.8, roughness: 0.45 });
  const frameMat = phys({ color: 0x18191c, metalness: 0.5, roughness: 0.35, clearcoat: 0.6 });
  const alu = phys({ color: 0xa9adb3, metalness: 0.9, roughness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.62 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff7d8, emissive: 0xfff1c0, emissiveIntensity: 1.2, roughness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 0.8 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xff9a20, emissive: 0xff7a00, emissiveIntensity: 0.35, roughness: 0.3 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0c1418, emissive: 0x3aa0ff, emissiveIntensity: 0.5, roughness: 0.3 });
  const plate = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
  const smoke = phys({ color: 0x1c2630, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.7 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.4 });

  // Piezas agrupadas por material y fundidas al final (las ruedas, aparte, porque giran)
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const put = (into: Map<THREE.Material, THREE.BufferGeometry[]>, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    let gg = g.index ? g.toNonIndexed() : g.clone();
    gg.deleteAttribute('uv');
    if (gg.attributes.uv1) gg.deleteAttribute('uv1');
    gg = gg.applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
    let list = into.get(m);
    if (!list) into.set(m, (list = []));
    list.push(gg);
  };
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => put(parts, g, m, x, y, z, rx, ry, rz, sx, sy, sz);
  // collect: en vez de mallas, las piezas ya colocadas (para una flota de motos instanciadas)
  const flush = (from: Map<THREE.Material, THREE.BufferGeometry[]>, parent: THREE.Object3D, at?: THREE.Vector3) => {
    if (collect) {
      for (const [m, list] of from) {
        let to = collect.get(m);
        if (!to) collect.set(m, (to = []));
        for (const g of list) to.push(at ? g.clone().translate(at.x, at.y, at.z) : g);
      }
      return;
    }
    for (const [m, list] of from) {
      const mesh = new THREE.Mesh(mergeGeometries(list)!, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const sphere = new THREE.SphereGeometry(0.5, 20, 14);
  /** Tubo recto de a a b (radio r). */
  const tube = (a: [number, number, number], b: [number, number, number], r: number, m: THREE.Material) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 10).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    add(g, m, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  };

  // Depósito, sillín, colín y tapas laterales (perfiles de lado extruidos a lo ancho)
  add(profile([[0.46, 0.78], [0.36, 0.95], [0.12, 1.0], [-0.12, 0.96], [-0.2, 0.86], [-0.16, 0.76], [0.1, 0.72], [0.4, 0.71]], 0.38, 0.07), body, 0, 0, 0);
  add(profile([[-0.17, 0.83], [-0.22, 0.87], [-0.58, 0.87], [-0.72, 0.9], [-1.0, 0.91], [-1.03, 0.85], [-0.6, 0.8], [-0.2, 0.79]], 0.3, 0.05), leather, 0, 0, 0);
  add(profile([[-0.9, 0.82], [-1.0, 0.9], [-1.2, 0.89], [-1.24, 0.84], [-1.06, 0.78]], 0.22, 0.03), body, 0, 0, 0);
  add(profile([[-0.14, 0.6], [-0.18, 0.8], [-0.72, 0.8], [-0.58, 0.6]], 0.27, 0.02), darkMetal, 0, 0, 0);
  // Chasis multitubular: de la pipa de dirección al eje del basculante, por los dos lados
  for (const sx of [-1, 1]) {
    tube([sx * 0.06, 0.92, 0.5], [sx * 0.14, 0.82, 0.05], 0.022, frameMat);
    tube([sx * 0.14, 0.82, 0.05], [sx * 0.14, 0.5, -0.22], 0.022, frameMat);
    tube([sx * 0.06, 0.86, 0.46], [sx * 0.14, 0.55, 0.15], 0.02, frameMat);
    tube([sx * 0.14, 0.55, 0.15], [sx * 0.14, 0.5, -0.22], 0.02, frameMat);
    tube([sx * 0.14, 0.82, 0.05], [sx * 0.14, 0.55, 0.15], 0.016, frameMat);
    tube([sx * 0.14, 0.82, -0.2], [sx * 0.1, 0.84, -0.95], 0.016, frameMat); // subchasis
    tube([sx * 0.14, 0.52, -0.22], [sx * 0.1, 0.8, -0.8], 0.014, frameMat);
    // Basculante y estriberas (piloto y paquete)
    add(box, alu, sx * 0.13, 0.4, -0.5, 0.14, 0, 0, 0.05, 0.08, 0.6);
    add(cyl, darkMetal, sx * 0.2, 0.42, -0.24, 0, 0, Math.PI / 2, 0.025, 0.12, 0.025);
    add(cyl, darkMetal, sx * 0.2, 0.5, -0.7, 0, 0, Math.PI / 2, 0.022, 0.1, 0.022);
    // Asidero del paquete
    tube([sx * 0.12, 0.92, -0.78], [sx * 0.11, 0.95, -1.05], 0.012, darkMetal);
  }
  add(cyl, frameMat, 0, 0.9, 0.52, -0.38, 0, 0, 0.07, 0.18, 0.07); // pipa de dirección
  // Motor: cárter, culata con aletas, tapas de cromo y radiador delante
  add(box, darkMetal, 0, 0.44, -0.02, 0, 0, 0, 0.34, 0.24, 0.44);
  for (let k = 0; k < 5; k++) add(box, alu, 0, 0.6 + k * 0.035, 0.08 + k * 0.012, -0.25, 0, 0, 0.32, 0.014, 0.3);
  add(box, darkMetal, 0, 0.78, 0.13, -0.25, 0, 0, 0.26, 0.05, 0.22);
  for (const sx of [-0.18, 0.18]) add(cyl, chrome, sx, 0.44, -0.04, 0, 0, Math.PI / 2, 0.17, 0.05, 0.17);
  add(box, darkMetal, 0, 0.66, 0.39, -0.2, 0, 0, 0.36, 0.3, 0.05);
  for (let k = 0; k < 6; k++) add(box, alu, 0, 0.54 + k * 0.045, 0.415 - k * 0.009, -0.2, 0, 0, 0.32, 0.01, 0.012);
  // Escape: colectores por debajo y silencioso alto en el lado derecho
  const header = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.04, 0.6, 0.3), new THREE.Vector3(0.06, 0.34, 0.36), new THREE.Vector3(0.1, 0.24, 0.1), new THREE.Vector3(0.16, 0.3, -0.3), new THREE.Vector3(0.2, 0.42, -0.55)]), 24, 0.03, 8);
  add(header, chrome, 0, 0, 0);
  add(header, chrome, -0.08, 0, 0);
  add(cyl, alu, 0.21, 0.47, -0.72, Math.PI / 2 - 0.22, 0, 0, 0.14, 0.42, 0.14);
  add(cyl, darkMetal, 0.21, 0.52, -0.95, Math.PI / 2 - 0.22, 0, 0, 0.1, 0.04, 0.1);
  // Cadena y piñones
  for (const y of [0.45, 0.39]) tube([0.15, y, -0.08], [0.15, y - 0.05 + (y > 0.42 ? 0.03 : -0.03), -0.78], 0.009, darkMetal);
  add(cyl, darkMetal, 0.15, 0.42, -0.08, 0, 0, Math.PI / 2, 0.08, 0.02, 0.08);
  // Horquilla invertida con sus tijas, guardabarros delantero y trasero
  for (const sx of [-0.09, 0.09]) {
    tube([sx, 1.0, 0.5], [sx, 0.62, 0.66], 0.03, alu);
    tube([sx, 0.64, 0.65], [sx, 0.34, 0.8], 0.022, chrome);
  }
  add(box, darkMetal, 0, 0.97, 0.52, -0.38, 0, 0, 0.26, 0.04, 0.09);
  add(box, darkMetal, 0, 0.8, 0.59, -0.38, 0, 0, 0.24, 0.04, 0.08);
  const fender = (r: number, a0: number, a1: number) => new THREE.CylinderGeometry(r, r, 0.13, 20, 1, true, a0, a1).rotateZ(Math.PI / 2);
  add(fender(0.37, -0.35, 1.6), body, 0, 0.34, 0.8);
  add(fender(0.37, 3.6, 1.0), darkMetal, 0, 0.34, -0.78);
  // Faro redondo con aro de cromo y cúpula ahumada; cuadro digital; manillar, puños, manetas y espejos
  add(cyl, chrome, 0, 0.92, 0.72, Math.PI / 2, 0, 0, 0.22, 0.12, 0.22);
  add(cyl, lamp, 0, 0.92, 0.785, Math.PI / 2, 0, 0, 0.18, 0.01, 0.18);
  add(box, smoke, 0, 1.08, 0.66, -0.6, 0, 0, 0.24, 0.16, 0.01);
  add(box, darkMetal, 0, 1.03, 0.6, -0.5, 0, 0, 0.14, 0.09, 0.05);
  add(box, screen, 0, 1.05, 0.625, -0.5, 0, 0, 0.11, 0.06, 0.005);
  tube([-0.36, 1.04, 0.41], [0.36, 1.04, 0.41], 0.016, darkMetal);
  for (const sx of [-0.08, 0.08]) tube([sx, 1.0, 0.5], [sx, 1.05, 0.42], 0.014, darkMetal); // elevadores del manillar
  for (const sx of [-1, 1]) {
    add(cyl, rubber, sx * 0.33, 1.04, 0.41, 0, 0, Math.PI / 2, 0.045, 0.13, 0.045);
    add(box, alu, sx * 0.27, 1.05, 0.47, 0, sx * 0.25, 0, 0.16, 0.012, 0.02);
    tube([sx * 0.22, 1.05, 0.43], [sx * 0.3, 1.25, 0.39], 0.008, darkMetal);
    add(sphere, darkMetal, sx * 0.31, 1.27, 0.39, 0, 0, 0, 0.13, 0.08, 0.03);
    // Intermitentes y tapas del radiador
    add(box, amber, sx * 0.14, 0.86, 0.72, 0, 0, 0, 0.06, 0.03, 0.04);
    add(box, amber, sx * 0.1, 0.8, -1.22, 0, 0, 0, 0.05, 0.03, 0.04);
    add(box, body, sx * 0.19, 0.68, 0.36, 0, sx * 0.35, 0, 0.03, 0.3, 0.2);
  }
  // Piloto, portamatrículas y matrícula
  add(box, tail, 0, 0.86, -1.24, 0.2, 0, 0, 0.13, 0.05, 0.03);
  add(box, darkMetal, 0, 0.74, -1.18, 0.6, 0, 0, 0.12, 0.02, 0.22);
  add(box, plate, 0, 0.66, -1.26, -0.15, 0, 0, 0.2, 0.14, 0.01);
  flush(parts, frame);

  // Ruedas: neumático, llanta de cinco radios, disco y pinza (cada una gira sobre su eje)
  const wheels: THREE.Object3D[] = [];
  const tire = new THREE.TorusGeometry(0.265, 0.075, 14, 36).rotateY(Math.PI / 2);
  const rimRing = new THREE.TorusGeometry(0.2, 0.016, 8, 32).rotateY(Math.PI / 2);
  for (const [z, front] of [[0.8, true], [-0.78, false]] as const) {
    const w = new THREE.Group();
    w.position.set(0, 0.34, z);
    const wp = new Map<THREE.Material, THREE.BufferGeometry[]>();
    put(wp, tire, rubber, 0, 0, 0);
    put(wp, rimRing, darkMetal, 0, 0, 0);
    for (let k = 0; k < 5; k++) put(wp, box, darkMetal, 0, 0, 0, (k * Math.PI * 2) / 5, 0, 0, 0.03, 0.36, 0.035);
    put(wp, cyl, alu, 0, 0, 0, 0, 0, Math.PI / 2, 0.08, 0.1, 0.08);
    put(wp, cyl, chrome, front ? -0.07 : 0.07, 0, 0, 0, 0, Math.PI / 2, front ? 0.3 : 0.24, 0.008, front ? 0.3 : 0.24);
    flush(wp, w, w.position);
    root.add(w);
    wheels.push(w);
    // Pinza de freno (no gira con la rueda)
    const calMat = caliperMat;
    if (collect) {
      const cp = new Map<THREE.Material, THREE.BufferGeometry[]>();
      put(cp, box, calMat, front ? -0.08 : 0.08, 0.34 + 0.11, z - 0.06, 0, 0, 0, 0.04, 0.09, 0.06);
      flush(cp, root);
      continue;
    }
    const cal = new THREE.Mesh(box, calMat);
    cal.scale.set(0.04, 0.09, 0.06);
    cal.position.set(front ? -0.08 : 0.08, 0.34 + 0.11, z - 0.06);
    root.add(cal);
  }
  if (collect) return { root, wheels, rider: null };

  let person: Person | null = null;
  if (rider) {
    const p = makeRigPerson(rider, 1, new THREE.Object3D());
    p.rig!.force = { body: 1, legL: 1, legR: 1, armL: 1, armR: 1 };
    // Un poco echado hacia delante, pies en las estriberas y manos en los puños
    p.body.rotation.x = 0.3;
    p.legL.rotation.set(-1.4, 0, -0.24);
    p.legR.rotation.set(-1.4, 0, 0.24);
    p.kneeL.rotation.x = p.kneeR.rotation.x = 1.95;
    p.armL.rotation.set(-1.25, 0, -0.3);
    p.armR.rotation.set(-1.25, 0, 0.3);
    p.elbowL.rotation.x = p.elbowR.rotation.x = -0.25;
    p.root.position.set(0, 0.94 - p.rig!.hipsHeight, -0.45); // cadera 7 cm sobre el sillín
    const h = makeHelmet(helmet);
    h.position.set(0, 0.12, 0.01); // el centro del casco, en el centro de la cabeza (el hueso está en la base)
    h.scale.set(1, 1.05, 1.08);
    boneAnchor(p, 'Head').add(h);
    root.add(p.root);
    person = p;
  }
  return { root, wheels, rider: person };
}

/**
 * Muchas motos aparcadas con muy pocas llamadas de dibujo: la misma moto, fundida por material e
 * instanciada; cada una con su color de carrocería (y su sitio y su giro).
 */
export function motoFleet(spots: { x: number; z: number; ry: number; color: number }[]) {
  const collect = new Map<THREE.Material, THREE.BufferGeometry[]>();
  makeMotoHD(0xffffff, undefined, undefined, collect);
  const body = paint(0xffffff);
  const g = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  for (const [mat, list] of collect) {
    const im = new THREE.InstancedMesh(mergeGeometries(list)!, mat, spots.length);
    spots.forEach((p, i) => {
      im.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, 0, p.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry), one));
      if (mat === body) im.setColorAt(i, new THREE.Color(p.color));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    g.add(im);
  }
  return g;
}

/** Joy: perra negra mediana, animada (quieta, al paso o corriendo según lo rápido que se mueva). Mira hacia +Z. */
export function makeDogHD(shadow: THREE.Object3D): Dog {
  const src = fox!;
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(src.scene);
  const box = new THREE.Box3().setFromObject(src.scene);
  const s = 0.72 / (box.max.y - box.min.y);
  model.scale.setScalar(s);
  root.add(model);
  let coat: THREE.MeshStandardMaterial | null = null;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    // Pelo negro con el pecho y el hocico claros: la textura del zorro en gris, teñida
    if (!coat) {
      const src = m.material as THREE.MeshStandardMaterial;
      coat = new THREE.MeshStandardMaterial({ map: src.map ? grayTexture(src.map) : null, color: lin(0x24201e), roughness: 0.6 });
    }
    m.material = coat;
    m.castShadow = true;
    m.frustumCulled = false;
  });
  root.add(shadow);
  const mixer = new THREE.AnimationMixer(model);
  const clip = (n: string) => src.animations.find((a) => a.name === n)!;
  const act = { idle: mixer.clipAction(clip('Survey')).play(), walk: mixer.clipAction(clip('Walk')).play(), run: mixer.clipAction(clip('Run')).play() };
  const w = { idle: 1, walk: 0, run: 0 };
  const last = new THREE.Vector3(NaN, 0, 0);
  let speed = 0;
  rigTickers.add((dt) => {
    if (!root.parent) return;
    const p = root.getWorldPosition(new THREE.Vector3());
    if (Number.isNaN(last.x)) last.copy(p);
    const d = Math.hypot(p.x - last.x, p.z - last.z);
    last.copy(p);
    const v = dt > 0 && d < 3 ? d / dt : 0;
    speed += (v - speed) * Math.min(1, dt * 6);
    const tw = speed < 0.15 ? { idle: 1, walk: 0, run: 0 } : speed < 2.2 ? { idle: 0, walk: 1, run: 0 } : { idle: 0, walk: 0, run: 1 };
    const k = 1 - Math.exp(-8 * dt);
    for (const n of ['idle', 'walk', 'run'] as const) {
      w[n] += (tw[n] - w[n]) * k;
      act[n].setEffectiveWeight(w[n]);
    }
    act.walk.timeScale = THREE.MathUtils.clamp(speed / 1.0, 0.5, 2);
    act.run.timeScale = THREE.MathUtils.clamp(speed / 3.5, 0.6, 1.8);
    mixer.update(dt);
  });
  // Cola y patas: las mueve el nivel en los muñecos; aquí solo están para que no falten
  const tail = new THREE.Group();
  const legs = [0, 1, 2, 3].map(() => new THREE.Group());
  root.add(tail, ...legs);
  return { root, tail, legs };
}
