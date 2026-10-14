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
