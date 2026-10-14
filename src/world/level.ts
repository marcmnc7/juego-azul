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
