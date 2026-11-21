// Fotos y stickers sacados de nuestro chat. Cada capítulo desbloquea sus recuerdos en el álbum.
import type { ChatMsg } from './chats';
import lpaDesayuno from '../assets/recuerdos/lpa-desayuno.jpg';
import lpaAscensor from '../assets/recuerdos/lpa-ascensor.jpg';
import lpaConcierto from '../assets/recuerdos/lpa-concierto.jpg';
import lpaCarnaval from '../assets/recuerdos/lpa-carnaval.jpg';
import caballos from '../assets/recuerdos/caballos.jpg';
import santJoan from '../assets/recuerdos/sant-joan.jpg';
import santJoanSelfie from '../assets/recuerdos/sant-joan-selfie.jpg';
import marcialFoto from '../assets/recuerdos/marcial.jpg';
import torreznos from '../assets/recuerdos/torreznos.jpg';
import cabana from '../assets/recuerdos/cabana.jpg';
import ferreriesSelfie from '../assets/recuerdos/ferreries-selfie.jpg';
import moto1 from '../assets/recuerdos/moto-1.jpg';
import moto2 from '../assets/recuerdos/moto-2.jpg';
import moto3 from '../assets/recuerdos/moto-3.jpg';
import motoVideo from '../assets/recuerdos/moto-video.mp4';
import motoPoster from '../assets/recuerdos/moto-video.jpg';
import ferreriesVideo from '../assets/recuerdos/ferreries-video.mp4';
import ferreriesPoster from '../assets/recuerdos/ferreries-video.jpg';
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
  /** Un vídeo (src es su fotograma de portada). */
  video?: string;
}

export const MEMORIES: Memory[] = [
  { level: 1, src: ferreriesSelfie, caption: 'Ferreries, 25 de agosto. Purpurina y pomada.' },
  { level: 1, src: ferreriesPoster, video: ferreriesVideo, caption: 'El jaleo, en directo.' },
  { level: 3, src: marcialFoto, caption: 'Cafetería Marcial. La primera con M.' },
  { level: 3, src: torreznos, caption: 'Y sus torreznos.' },
  { level: 3, src: cabana, caption: 'La cabaña. Sin gas, pero con cama.' },
  { level: 4, src: lpaDesayuno, caption: 'Gran Canaria, marzo de 2026. Desayuno al sol.' },
  { level: 4, src: lpaAscensor, caption: 'Camiseta de Fito puesta. Listos.' },
  { level: 4, src: lpaConcierto, caption: 'Fito, en directo. Y nosotros.' },
  { level: 4, src: lpaCarnaval, caption: 'Todo lo que fuimos fue icónico.' },
  { level: 5, src: moto1, caption: 'La moto. Y el garaje, antes de salir.' },
  { level: 5, src: motoPoster, video: motoVideo, caption: 'Cargando la moto: casco, chupa y maleta.' },
  { level: 5, src: moto2, caption: 'Comiendo en la Costa Brava.' },
  { level: 5, src: moto3, caption: 'Cena en L’Escala.' },
  { level: 6, src: caballos, caption: '«Dime exacto pls.» Así de exacto.' },
  { level: 6, src: santJoanSelfie, caption: 'Sant Joan, 24 de junio.' },
  { level: 6, src: santJoan, caption: '«Muy dificil si…. Deslumbras»' },
];

export const memoriesFor = (level: number) => MEMORIES.filter((m) => m.level === level);
