// Fotos y stickers sacados de nuestro chat. Cada capítulo desbloquea sus recuerdos en el álbum.
import { CHATS, type ChatMsg } from './chats';
import ruta from '../assets/recuerdos/ruta.jpg';
import trenes from '../assets/recuerdos/trenes.jpg';
import vueloLpa from '../assets/recuerdos/vuelo-lpa.jpg';
import granCanaria from '../assets/recuerdos/gran-canaria.jpg';
import carnaval from '../assets/recuerdos/carnaval.jpg';
import caballos from '../assets/recuerdos/caballos.jpg';
import santJoan from '../assets/recuerdos/sant-joan.jpg';
import santJoanSelfie from '../assets/recuerdos/sant-joan-selfie.jpg';
import stOso from '../assets/recuerdos/st-oso.webp';
import stJuzgamos from '../assets/recuerdos/st-juzgamos.webp';
import stCarita from '../assets/recuerdos/st-carita.webp';
import stPerroPiscina from '../assets/recuerdos/st-perro-piscina.webp';

export const STICKERS = { oso: stOso, juzgamos: stJuzgamos, carita: stCarita, perroPiscina: stPerroPiscina };

export interface Memory {
  level: number;
  src?: string;
  caption: string;
  /** Recuerdo sin foto: un trozo literal del chat de ese día. */
  chat?: ChatMsg[];
  /** Hueco reservado para una foto que aún falta. */
  pending?: boolean;
  /** Los stickers se pintan sin marco de polaroid. */
  sticker?: boolean;
}

export const MEMORIES: Memory[] = [
  { level: 1, src: stOso, caption: 'Así bailaba aquel de Sa Font. Más o menos.', sticker: true },
  { level: 2, chat: CHATS.cesped.msgs.slice(-4, -1), caption: '27 de agosto, 1:17' },
  { level: 2, chat: CHATS.meGustas.msgs.slice(4, 8), caption: '27 de agosto, 1:30' },
  { level: 2, chat: CHATS.joyPiscina.msgs, caption: 'Joy, 3 de abril de 2026. De una.' },
  { level: 3, src: ruta, caption: 'El planning. «A coruña es muy ambicioso.»' },
  { level: 3, src: trenes, caption: 'Barcelona ⇄ Atocha. Lo demás, en tu coche.' },
  { level: 3, pending: true, caption: 'Cafetería Marcial. La primera con M.' },
  { level: 3, chat: CHATS.vuelta.msgs, caption: '3 de noviembre, de vuelta a Barcelona' },
  { level: 3, chat: CHATS.zamburinasCumple.msgs, caption: 'Tu cumpleaños, 28 de noviembre' },
  { level: 3, chat: CHATS.sanVicente.msgs, caption: '«Ya sabes dónde se quedó mi corazón»' },
  { level: 4, src: vueloLpa, caption: '«VOY TARDEEEE?!» «tu vas pronto»' },
  { level: 4, src: granCanaria, caption: 'Gran Canaria, marzo de 2026.' },
  { level: 4, src: carnaval, caption: 'Todo lo que fuimos fue icónico.' },
  { level: 6, src: caballos, caption: '«Dime exacto pls.» Así de exacto.' },
  { level: 6, src: santJoanSelfie, caption: 'Sant Joan, 24 de junio.' },
  { level: 6, src: santJoan, caption: '«Muy dificil si…. Deslumbras»' },
];

export const memoriesFor = (level: number) => MEMORIES.filter((m) => m.level === level);

/** Las tres que acompañan a la carta final: Gran Canaria y Sant Joan. */
export const LETTER_PHOTOS = [granCanaria, santJoanSelfie, santJoan];
