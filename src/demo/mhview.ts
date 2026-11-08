import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import quarryHdr from '../assets/env/quarry.hdr';
import { buildMH, exportGLB, fuseCrowd } from './mhbuild';

// EJEMPLO: el hombre de MakeHuman montado, en reposo, para revisarlo (?v=1 cara) y exportarlo (window.__export).
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6ea);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
sun.position.set(2, 4, 3);
sun.castShadow = true;
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x998877, 0.8));
new RGBELoader().load(quarryHdr, (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.5;
});
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: 0xcfc6b8 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const params = new URLSearchParams(location.search);
let man: THREE.Object3D | null = null;
void (async () => {
  try {
    // ?p=man: hombre genérico para los secundarios (sin barba, todo blanco/gris para teñir); si no, Gas
    const P = params.get('p');
    // man: hombre genérico para los secundarios, con varios peinados; manlod: el mismo, ligero, para la multitud
    man = P === 'woman' || P === 'womanlod'
      ? await buildMH({ tag: 'woman', female: true, shirt: 0xffffff, jeansDark: 1, pantsGrey: true, hair: 'long01', hairVolume: 1.0, hairColor: 0xd8d8d8, mullet: 0, quiff: 0, skinTone: [1, 1, 1], facialHair: false, hairs: P === 'womanlod' ? ['bob02'] : ['bob02', 'afro01'] })
      : P === 'kid'
      ? await buildMH({ tag: 'kid', child: true, shirt: 0xffffff, jeansDark: 1, pantsGrey: true, hair: 'short02', hairVolume: 1.0, hairColor: 0xd8d8d8, mullet: 0, quiff: 0, skinTone: [1, 1, 1], facialHair: false, hairs: ['bob02', 'short04'] })
      : P === 'man' || P === 'manlod'
      ? await buildMH({ tag: 'man', shirt: 0xffffff, jeansDark: 1, pantsGrey: true, hair: 'short02', hairVolume: 1.0, hairColor: 0xd8d8d8, mullet: 0, quiff: 0, skinTone: [1, 1, 1], facialHair: false, hairs: P === 'manlod' ? ['short01', 'short04'] : ['short01', 'short03', 'short04'] })
      : await buildMH({ tag: 'gas', shirt: 0xffffff, jeansDark: 1.0, hair: params.get('h') ?? 'short02', hairVolume: +(params.get('hv') ?? 1.05), hairColor: 0x84593a, mullet: +(params.get('mu') ?? 0.75), quiff: +(params.get('qu') ?? 0.32), skinTone: [0.97, 0.86, 0.74] });
    if (P === 'manlod' || P === 'womanlod') {
      // la multitud: un cuerpo único por zonas (ver fuseCrowd)
      fuseCrowd(man, P === 'womanlod', 0.5);
    }
    // vista previa: la ropa normal, con el color de cada uno
    man.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (/^(BodyShort|BodyFull|PantsShort)$/.test(m.name)) m.visible = false;
      if (m.name === 'Shirt') (m.material as THREE.MeshStandardMaterial).color.set(params.get('p') === 'man' ? 0x3a6a5a : 0x5b6b3a);
      if (m.name === 'Pants' && params.get('p') === 'man') (m.material as THREE.MeshStandardMaterial).color.set(0x2a2a2a);
    });
    scene.add(man);
    (window as unknown as { __ok: boolean }).__ok = true;
  } catch (e) {
    console.error(e);
    (window as unknown as { __err: string }).__err = String(e);
  }
})();
function frame() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const yaw = +(params.get('yaw') ?? 0.35);
  if (params.get('v') === '1') {
    camera.position.set(Math.sin(yaw) * 0.85, 1.66, Math.cos(yaw) * 0.85);
    camera.lookAt(0, 1.63, 0);
  } else {
    camera.position.set(Math.sin(yaw) * 5.2, 1.0, Math.cos(yaw) * 5.2);
    camera.lookAt(0, 0.9, 0);
  }
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);
Object.assign(window, {
  __scene: scene,
  __shot: () => canvas.toDataURL('image/jpeg', 0.92),
  __export: async () => {
    // en el archivo van todas las piezas y sin teñir: el juego elige y tiñe
    man!.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.visible = true;
      if (/^(Shirt|Pants|PantsShort)$/.test(m.name)) (m.material as THREE.MeshStandardMaterial).color.set(0xffffff);
    });
    const buf = await exportGLB(man!);
    const r = await fetch('http://127.0.0.1:8097/' + (params.get('p') ? `${params.get('p')!.replace('lod', '')}_mh${params.get('p')!.endsWith('lod') ? '_lod' : ''}.glb` : 'gas_mh.glb'), { method: 'POST', body: 'data:application/octet-stream;base64,' + btoa(Array.from(new Uint8Array(buf), (c) => String.fromCharCode(c)).join('')) });
    return [buf.byteLength, await r.text()];
  },
});
