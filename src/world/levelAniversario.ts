import * as THREE from 'three';
import type { Input } from '../core/input';
import { ANIVERSARIO, ANIVERSARIO_GAS } from '../data/story';
import { CHATS, type ChatFrag } from '../data/chats';
import { dialogue } from '../ui/ui';
import { voley, joyTraining } from '../ui/minis';
import { Level1, FERRERIES_VARIANT, type JaleoVariant } from './level1';
import type { LevelDone } from './level';

// Capítulo 9 · Un año después (25 de agosto de 2026). El mismo jaleo de Ferreries que el capítulo 1,
// pero ahora Gas está en el pueblo y va mandando ubicaciones. Antes, los chats reales de esa semana;
// al final, «Tenemos fecha nosotros?».
//
// La búsqueda va con el chat real de esa tarde («bocata», de las 15:54 a las 16:51), por trozos: el «Dmd estass»
// y sus dos ubicaciones al empezar; al llegar a la primera ya no está, y llega lo de «Tengo bocata / Y patatas»
// con la ubicación buena (Sa Font); y al verle, el «Estoy». Las ubicaciones son la pista (un 📍 sobre el sitio).

/** Un trozo del chat real (mismos mensajes, misma fecha). */
const part = (f: ChatFrag, from: number, to?: number): ChatFrag => ({ ...f, msgs: f.msgs.slice(from, to) });

const VARIANT: JaleoVariant = {
  ...FERRERIES_VARIANT,
  text: ANIVERSARIO,
  hud: {
    ...FERRERIES_VARIANT.hud,
    find: '📍 Gas',
  },
  introChats: [CHATS.tarde, CHATS.veintidos, CHATS.asesOnce, part(CHATS.bocata, 0, 4)],
  findFirst: {
    // La primera ubicación (16:03): delante del bar Sa Penya, al otro extremo de la calle mayor
    first: new THREE.Vector3(30, 0, 0.2),
    atFirst: part(CHATS.bocata, 4, 11),
    found: [part(CHATS.bocata, 11)],
    lines: ANIVERSARIO_GAS,
  },
  endChats: [CHATS.fecha],
  meetScene: undefined,
  // Lo que vino después: el vóley de septiembre y Joy en octubre
  afterEnd: (next) => dialogue(ANIVERSARIO.september, () => voley(() => dialogue(ANIVERSARIO.october, () => joyTraining(next)))),
  // Un año después ya no va con el mono negro: vestido azul
  outfit: { shirt: 0x5aa9e6, pants: 0x5aa9e6, skirt: true, jumpsuit: false },
};

export class LevelAniversario extends Level1 {
  constructor(camera: THREE.PerspectiveCamera, input: Input, onComplete: LevelDone, onMenu: () => void) {
    super(camera, input, onComplete, onMenu, VARIANT);
  }
}
