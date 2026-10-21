import type * as THREE from 'three';
import type { Input } from '../core/input';
import type { LevelDone } from './level';
import { Level1, SANTJOAN_VARIANT } from './level1';

// Capítulo 4 · Sant Joan en Ciutadella. Mismo jaleo que Ferreries, pero con caballos negros,
// avellanes, Carme de guía y Gas (con la camiseta de Azul) que no encuentra su propia ubicación.
export class LevelSantJoan extends Level1 {
  constructor(camera: THREE.PerspectiveCamera, input: Input, onComplete: LevelDone, onMenu: () => void) {
    super(camera, input, onComplete, onMenu, SANTJOAN_VARIANT);
  }
}
