import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Carga de los archivos incrustados (modelos glTF y cielos HDRI). El visor de artefactos no deja
// hacer fetch() de URLs data:, así que se decodifican a mano y se pasan a los loaders con parse(),
// igual que en la prueba de concepto.

function dataUrlToBuffer(url: string) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function bytes(url: string) {
  if (url.startsWith('data:')) return dataUrlToBuffer(url);
  return (await fetch(url)).arrayBuffer();
}

const gltfCache = new Map<string, Promise<GLTF>>();
export function loadGLB(url: string): Promise<GLTF> {
  let p = gltfCache.get(url);
  if (!p) {
    p = bytes(url).then(async (buf) => {
      // Sin createImageBitmap, GLTFLoader usa <img> con blob: (permitido) en vez de fetch (bloqueado)
      const g = globalThis as unknown as { createImageBitmap?: unknown };
      const saved = g.createImageBitmap;
      g.createImageBitmap = undefined;
      try {
        return await new GLTFLoader().parseAsync(buf, '');
      } finally {
        g.createImageBitmap = saved;
      }
    });
    gltfCache.set(url, p);
  }
  return p;
}

export interface Hdri {
  texture: THREE.DataTexture;
  /** Dirección del punto más brillante (el sol) en el espacio del mapa equirectangular. */
  sun: THREE.Vector3;
}

const hdrCache = new Map<string, Hdri>();
/** Cielo fotografiado (HDRI) como textura equirectangular lineal. Síncrono si el archivo va incrustado. */
export function loadHdriSync(url: string): Hdri | null {
  const c = hdrCache.get(url);
  if (c) return c;
  if (!url.startsWith('data:')) return null;
  const d = new RGBELoader().parse(dataUrlToBuffer(url)) as unknown as { data: Uint16Array | Float32Array; width: number; height: number; type: THREE.TextureDataType };
  const t = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
  t.colorSpace = THREE.LinearSRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.flipY = true;
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.needsUpdate = true;
  // Busca el sol (el texel más brillante) para poder girar el cielo y que cuadre con el de la escena
  const toF = d.type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat : (v: number) => v;
  let best = -1, bi = 0;
  for (let i = 0; i < d.width * d.height; i++) {
    const l = toF(d.data[i * 4]) + toF(d.data[i * 4 + 1]) + toF(d.data[i * 4 + 2]);
    if (l > best) { best = l; bi = i; }
  }
  const u = ((bi % d.width) + 0.5) / d.width;
  const v = 1 - (Math.floor(bi / d.width) + 0.5) / d.height; // la fila 0 del HDR es la de arriba
  const phi = (u - 0.5) * Math.PI * 2;
  const el = (v - 0.5) * Math.PI;
  const sun = new THREE.Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
  const h = { texture: t, sun };
  hdrCache.set(url, h);
  return h;
}
