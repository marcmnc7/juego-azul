import type * as THREE from 'three';
import type { DebugItem } from '../ui/ui';

/** Lo que el bucle principal necesita de cada capítulo. */
export interface Level {
  readonly threeScene: THREE.Scene;
  update(dt: number): void;
  dispose(): void;
  /** Atajos del modo prueba. */
  debug(): DebugItem[];
  /** Capítulos que mezclan día y noche (Barajas y el concierto): la luz y el etalonaje siguen a esto. */
  readonly mood?: 'day' | 'night';
}

/** Resultado de un capítulo: estrellas (1-3) y un par de datos curiosos. */
export interface LevelResult {
  stars: number;
  stats: [string, string][];
}

export type LevelDone = (r: LevelResult) => void;

export function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Libera geometría, materiales y texturas de un objeto al salir del capítulo (si algo compartido se vuelve
 * a usar, three lo sube otra vez). También las texturas de los shaders (el reflejo del agua) y los mapas
 * de sombras de las luces: sin esto, la memoria de vídeo crecía con cada capítulo jugado.
 */
export function disposeObj(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  m.geometry?.dispose();
  const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
  for (const mat of mats) {
    for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose();
    const uniforms = (mat as THREE.ShaderMaterial).uniforms;
    if (uniforms) for (const u of Object.values(uniforms)) if ((u?.value as THREE.Texture | null)?.isTexture) (u.value as THREE.Texture).dispose();
    mat.dispose();
  }
  const light = o as THREE.Light;
  if (light.isLight) light.dispose();
  // Cada personaje con esqueleto guarda sus huesos en una textura: hay que soltarla también
  (o as THREE.SkinnedMesh).skeleton?.dispose();
}

/** Libera una escena entera: todo lo de dentro y su luz de entorno (cada escena genera la suya). */
export function disposeScene(sc: THREE.Scene) {
  sc.traverse(disposeObj);
  // La luz de entorno es un render target: hay que liberarlo entero, no solo su textura
  const envRT = sc.userData.envRT as THREE.WebGLRenderTarget | undefined;
  if (envRT) envRT.dispose();
  else sc.environment?.dispose();
  sc.environment = null;
  sc.userData.envRT = undefined;
  if ((sc.background as THREE.Texture | null)?.isTexture) (sc.background as THREE.Texture).dispose();
}
