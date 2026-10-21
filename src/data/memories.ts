// Fotos y stickers sacados de nuestro chat. Cada capítulo desbloquea sus recuerdos en el álbum.
import diadema from '../assets/recuerdos/diadema.jpg';
import cocacola from '../assets/recuerdos/cocacola.jpg';
import ruta from '../assets/recuerdos/ruta.jpg';
import trenes from '../assets/recuerdos/trenes.jpg';
import joy from '../assets/recuerdos/joy.jpg';
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
  src: string;
  caption: string;
  /** Los stickers se pintan sin marco de polaroid. */
  sticker?: boolean;
}

export const MEMORIES: Memory[] = [
  { level: 1, src: stOso, caption: 'Así bailaba Gas en el Jaleo. Más o menos.', sticker: true },
  { level: 2, src: ruta, caption: 'El planning: 1.454 km. «A Coruña es muy ambicioso.»' },
  { level: 2, src: trenes, caption: 'Barcelona ⇄ Atocha. Lo demás, en tu coche.' },
  { level: 2, src: joy, caption: 'Joy. Con él todo tiene que ser más divertido.' },
  { level: 3, src: vueloLpa, caption: '«¿VOY TARDE?» «Tú vas pronto.»' },
  { level: 3, src: granCanaria, caption: 'Gran Canaria, marzo de 2026.' },
  { level: 3, src: carnaval, caption: 'Todo lo que fuimos fue icónico.' },
  { level: 4, src: diadema, caption: '«Aún no me lo puedo creer. Qué poco me esperaba esto hoy.»' },
  { level: 4, src: stPerroPiscina, caption: 'La piscinita: pequeñita pero funciona.', sticker: true },
  { level: 4, src: cocacola, caption: 'Una Coca-Cola con mi nombre. Como en el Imperi, pero oficial.' },
  { level: 5, src: caballos, caption: '«Dime exacto pls.» Así de exacto.' },
  { level: 5, src: santJoanSelfie, caption: 'Sant Joan, 24 de junio.' },
  { level: 5, src: santJoan, caption: 'Camisetas a juego. Un año después.' },
];

export const memoriesFor = (level: number) => MEMORIES.filter((m) => m.level === level);

/** Las tres que acompañan a la carta final: la primera noche, Gran Canaria y Sant Joan. */
export const LETTER_PHOTOS = [diadema, granCanaria, santJoan];
