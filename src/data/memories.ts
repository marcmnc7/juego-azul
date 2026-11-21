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
import lpaCarteles from '../assets/recuerdos/lpa-carteles.jpg';
import gcVideo from '../assets/recuerdos/gc-acantilado.mp4';
import gcPoster from '../assets/recuerdos/gc-acantilado-video.jpg';
import tossa from '../assets/recuerdos/tossa.jpg';
import cadaques from '../assets/recuerdos/cadaques.jpg';
import saBarca from '../assets/recuerdos/sa-barca.jpg';
import motoComida from '../assets/recuerdos/moto-comida.mp4';
import motoComidaPoster from '../assets/recuerdos/moto-comida-video.jpg';
import santJoanBaile from '../assets/recuerdos/sant-joan-baile.jpg';
import barca from '../assets/recuerdos/barca.mp4';
import barcaPoster from '../assets/recuerdos/barca-video.jpg';
import carbonara from '../assets/recuerdos/carbonara.jpg';
import gafasEclipse from '../assets/recuerdos/gafas-eclipse.jpg';
import eclipseVideo from '../assets/recuerdos/eclipse.mp4';
import eclipsePoster from '../assets/recuerdos/eclipse-video.jpg';
import bailePiscina from '../assets/recuerdos/baile-piscina.mp4';
import bailePiscinaPoster from '../assets/recuerdos/baile-piscina-video.jpg';
import atardecer from '../assets/recuerdos/atardecer.jpg';
import amigos from '../assets/recuerdos/amigos.mp4';
import amigosPoster from '../assets/recuerdos/amigos-video.jpg';
import motoAmapolas from '../assets/recuerdos/moto-amapolas.jpg';
import farolaAzotea from '../assets/recuerdos/farola-azotea.jpg';
import joySiesta from '../assets/recuerdos/joy-siesta.jpg';
import botasHipica from '../assets/recuerdos/botas-hipica.jpg';
import gcTerraza from '../assets/recuerdos/gc-terraza.jpg';
import wakeboard from '../assets/recuerdos/wakeboard.mp4';
import wakeboardPoster from '../assets/recuerdos/wakeboard-video.jpg';
import ferryBaile from '../assets/recuerdos/ferry-baile.mp4';
import ferryBailePoster from '../assets/recuerdos/ferry-baile-video.jpg';
import junioMar from '../assets/recuerdos/junio-mar.mp4';
import junioMarPoster from '../assets/recuerdos/junio-mar-video.jpg';
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
  { level: 4, src: lpaCarteles, caption: 'Las Palmas, la víspera: Fito por todas las paredes.' },
  { level: 4, src: lpaCarnaval, caption: 'Todo lo que fuimos fue icónico.' },
  { level: 4, src: gcPoster, video: gcVideo, caption: 'Gran Canaria, en lo alto. 15 de marzo.' },
  { level: 4, src: gcTerraza, caption: 'Gran Canaria, 15 de marzo: comer al sol.' },
  { level: 5, src: moto1, caption: 'La moto. Y el garaje, antes de salir.' },
  { level: 5, src: motoPoster, video: motoVideo, caption: 'Cargando la moto: casco, chupa y maleta.' },
  { level: 5, src: moto2, caption: 'Comiendo en la Costa Brava.' },
  { level: 5, src: moto3, caption: 'Cena en L’Escala.' },
  { level: 5, src: tossa, caption: 'Tossa de Mar, 1 de mayo.' },
  { level: 5, src: motoComidaPoster, video: motoComida, caption: 'Comer con ganas. Muchas.' },
  { level: 5, src: cadaques, caption: 'Cadaqués, desde arriba.' },
  { level: 5, src: saBarca, caption: 'Sa Barca: a ver qué pedimos.' },
  { level: 5, src: motoAmapolas, caption: 'La moto, entre amapolas de verdad.' },
  { level: 6, src: caballos, caption: '«Dime exacto pls.» Así de exacto.' },
  { level: 6, src: santJoanSelfie, caption: 'Sant Joan, 24 de junio.' },
  { level: 6, src: santJoan, caption: '«Muy dificil si…. Deslumbras»' },
  { level: 6, src: santJoanBaile, caption: 'Sant Joan, 23 de junio: ¡arriba!' },
  { level: 6, src: barcaPoster, video: barca, caption: 'Mayo, en barca por las calas.' },
  { level: 6, src: junioMarPoster, video: junioMar, caption: 'Finales de junio, al agua.' },
  { level: 7, src: carbonara, caption: 'La carbonara de verdad. 13 de julio, 22:15.' },
  { level: 7, src: farolaAzotea, caption: 'Sa Farola, desde la azotea.' },
  { level: 8, src: gafasEclipse, caption: 'Gafas puestas: 12 de agosto de 2026.' },
  { level: 8, src: eclipsePoster, video: eclipseVideo, caption: 'El eclipse, desde las rocas.' },
  { level: 8, src: bailePiscinaPoster, video: bailePiscina, caption: '15 de agosto, bailando junto a la piscina.' },
  { level: 8, src: wakeboardPoster, video: wakeboard, caption: '12 de agosto por la mañana: antes del eclipse, wakeboard.' },
  { level: 8, src: ferryBailePoster, video: ferryBaile, caption: 'En el ferry, 8 de agosto.' },
  { level: 8, src: joySiesta, caption: 'Joy y Gas: siesta en el sofá.' },
  { level: 9, src: atardecer, caption: 'Un año después: 25 de agosto de 2026.' },
  { level: 9, src: amigosPoster, video: amigos, caption: 'Y con todos, a finales de agosto.' },
  { level: 9, src: botasHipica, caption: 'Botas de montar: lo que viene.' },
];

export const memoriesFor = (level: number) => MEMORIES.filter((m) => m.level === level);
