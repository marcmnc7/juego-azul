import type * as THREE from 'three';
import type { DebugItem } from '../ui/ui';

/** Lo que el bucle principal necesita de cada capítulo. */
export interface Level {
  readonly threeScene: THREE.Scene;
  update(dt: number): void;
  dispose(): void;
  /** Atajos del modo prueba. */
  debug(): DebugItem[];
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

/** Libera geometría, materiales y texturas de un objeto al salir del capítulo (si algo compartido se vuelve a usar, three lo sube otra vez). */
export function disposeObj(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  m.geometry?.dispose();
  const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
  for (const mat of mats) {
    for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose();
    mat.dispose();
  }
}
