import type * as THREE from 'three';
import type { Input } from '../core/input';
import { ANIVERSARIO } from '../data/story';
import { CHATS } from '../data/chats';
import { Level1, FERRERIES_VARIANT, type JaleoVariant } from './level1';
import type { LevelDone } from './level';

// Capítulo 9 · Un año después (25 de agosto de 2026). El mismo jaleo de Ferreries que el capítulo 1,
// pero ahora Gas está en el pueblo y va mandando ubicaciones. Antes, los chats reales de esa semana;
// al final, «Tenemos fecha nosotros?».

const VARIANT: JaleoVariant = {
  ...FERRERIES_VARIANT,
  text: ANIVERSARIO,
  hud: {
    ...FERRERIES_VARIANT.hud,
    find: 'Cerca en Marc: segueix ses ubicacions 📍',
  },
  introChats: [CHATS.tarde, CHATS.veintidos, CHATS.asesOnce, CHATS.bocata],
  endChats: [CHATS.fecha],
  // Un año después ya no va con el mono negro: vestido azul
  outfit: { shirt: 0x5aa9e6, pants: 0x5aa9e6, skirt: true, jumpsuit: false },
};

export class LevelAniversario extends Level1 {
  constructor(camera: THREE.PerspectiveCamera, input: Input, onComplete: LevelDone, onMenu: () => void) {
    super(camera, input, onComplete, onMenu, VARIANT);
  }
}
