import * as THREE from 'three';
import type { Input } from '../core/input';
import { ANIVERSARIO, ANIVERSARIO_GAS } from '../data/story';
import { CHATS, type ChatFrag } from '../data/chats';
import { Level1, FERRERIES_VARIANT, type JaleoVariant } from './level1';
import type { LevelDone } from './level';

// Capítulo 9 · Un año después (25 de agosto de 2026). El mismo jaleo de Ferreries que el capítulo 1,
// pero ahora Gas está en el pueblo y va mandando ubicaciones. Antes, el chat real de esa misma tarde;
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
  // (21 nov) El bar de la primera ubicación se llama como en el chat: «Feymar»
  town: { ...FERRERIES_VARIANT.town, bars: ['Bar Es Pla', 'Cas Ferrer', 'Feymar', 'Bar Sa Font'] },
  introChats: [part(CHATS.bocata, 0, 4)],
  findFirst: {
    // La primera ubicación (16:03): delante del bar Feymar, al otro extremo de la calle mayor
    first: new THREE.Vector3(30, 0, 0.2),
    atFirst: part(CHATS.bocata, 4, 11),
    found: [part(CHATS.bocata, 11)],
    lines: ANIVERSARIO_GAS,
  },
  endChats: [CHATS.fecha],
  meetScene: undefined,
  // (21 nov) El vóley, Joy y la hípica ya no van aquí: se juegan después del regalo, como final del año (ui/finale.ts)
};

export class LevelAniversario extends Level1 {
  constructor(camera: THREE.PerspectiveCamera, input: Input, onComplete: LevelDone, onMenu: () => void) {
    super(camera, input, onComplete, onMenu, VARIANT);
  }
}
