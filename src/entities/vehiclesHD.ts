import * as THREE from 'three';
import { loadGLB } from '../core/assets';
import { quality } from '../core/gfx';
import foxUrl from '../assets/chars/fox.glb';
import { boneAnchor, grayTexture, makeRigPerson, rigTickers } from './rig';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

/** Moto realista con el piloto montado y casco. Mira hacia +Z. */
export function makeMotoHD(color: number, rider?: PersonLook) {
  const root = new THREE.Group();
  const frame = new THREE.Group();
  root.add(frame);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = frame) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const body = paint(color);
  const chrome = phys({ color: 0xdfe3e8, metalness: 1, roughness: 0.15 });
  const darkMetal = phys({ color: 0x2a2c30, metalness: 0.8, roughness: 0.45 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff7d8, emissive: 0xfff1c0, emissiveIntensity: 1.2, roughness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 0.8 });
  const sphere = new THREE.SphereGeometry(0.5, 24, 16);
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const box = new THREE.BoxGeometry(1, 1, 1);

  add(sphere, body, 0, 0.78, 0.18, 0.12, 0, 0, 0.34, 0.24, 0.62); // depósito
  add(sphere, leather, 0, 0.8, -0.42, 0, 0, 0, 0.3, 0.1, 0.62); // asiento
  add(sphere, body, 0, 0.82, -0.86, -0.2, 0, 0, 0.22, 0.12, 0.42); // colín
  add(box, darkMetal, 0, 0.5, -0.08, 0, 0, 0, 0.3, 0.3, 0.62); // motor
  for (const sx of [-0.16, 0.16]) add(cyl, chrome, sx, 0.5, -0.06, Math.PI / 2, 0, 0, 0.16, 0.12, 0.16); // tapas
  add(cyl, chrome, 0.19, 0.4, -0.55, Math.PI / 2 - 0.12, 0, 0, 0.09, 0.8, 0.09); // escape
  add(cyl, darkMetal, 0.19, 0.44, -0.97, Math.PI / 2 - 0.12, 0, 0, 0.1, 0.1, 0.1);
  for (const sx of [-0.09, 0.09]) add(cyl, chrome, sx, 0.66, 0.66, -0.38, 0, 0, 0.045, 0.72, 0.045); // horquilla
  add(cyl, darkMetal, 0, 1.0, 0.56, 0, 0, Math.PI / 2, 0.035, 0.7, 0.035); // manillar
  for (const sx of [-0.33, 0.33]) add(cyl, rubber, sx, 1.0, 0.56, 0, 0, Math.PI / 2, 0.045, 0.12, 0.045); // puños
  add(sphere, chrome, 0, 0.9, 0.76, 0, 0, 0, 0.2, 0.2, 0.16); // faro
  add(sphere, lamp, 0, 0.9, 0.83, 0, 0, 0, 0.16, 0.16, 0.04);
  add(box, tail, 0, 0.84, -1.07, 0, 0, 0, 0.12, 0.05, 0.03); // piloto
  add(box, darkMetal, 0, 0.62, -0.55, -0.5, 0, 0, 0.06, 0.06, 0.62); // basculante

  const wheels: THREE.Object3D[] = [];
  const tire = new THREE.TorusGeometry(0.27, 0.07, 14, 32).rotateY(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 24).rotateZ(Math.PI / 2);
  const spoke = new THREE.BoxGeometry(0.03, 0.4, 0.025);
  for (const z of [0.8, -0.78]) {
    const w = new THREE.Group();
    w.position.set(0, 0.34, z);
    add(tire, rubber, 0, 0, 0, 0, 0, 0, 1, 1, 1, w);
    add(rim, chrome, 0, 0, 0, 0, 0, 0, 1, 1, 1, w);
    for (let k = 0; k < 3; k++) add(spoke, darkMetal, 0, 0, 0, (k * Math.PI) / 3, 0, 0, 1, 1, 1, w);
    root.add(w);
    wheels.push(w);
  }

  let person: Person | null = null;
  if (rider) {
    const p = makeRigPerson(rider, 1, new THREE.Object3D());
    p.rig!.force = { legL: 1, legR: 1, armL: 1, armR: 1 };
    p.legL.rotation.set(-1.15, 0, -0.22);
    p.legR.rotation.set(-1.15, 0, 0.22);
    p.kneeL.rotation.x = p.kneeR.rotation.x = 1.65;
    p.armL.rotation.set(-1.0, 0, -0.18);
    p.armR.rotation.set(-1.0, 0, 0.18);
    p.elbowL.rotation.x = p.elbowR.rotation.x = -0.35;
    p.root.position.set(0, 0.84 - p.rig!.hipsHeight, -0.45);
    // Casco integral con visera
    const helmet = new THREE.Group();
    add(new THREE.SphereGeometry(0.15, 24, 16), body, 0, 0.12, 0.01, 0, 0, 0, 1, 1.05, 1.08, helmet);
    add(new THREE.SphereGeometry(0.152, 24, 12, -0.9, 1.8, 1.05, 0.75), phys({ color: 0x223040, metalness: 0.2, roughness: 0.05, clearcoat: 1 }), 0, 0.12, 0.012, 0, 0, 0, 1, 1.05, 1.08, helmet);
    boneAnchor(p, 'Head').add(helmet);
    root.add(p.root);
    person = p;
  }
  return { root, wheels, rider: person };
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
