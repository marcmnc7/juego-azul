// Los «conecta»: juegos cortos entre capítulo y capítulo, cada uno con su día (entre los de los dos capítulos que
// une). Todo lo que sale aquí está sacado de nuestro chat: las frases son literales (quién las escribió y cuándo,
// tal cual) y las palabras, las que más usamos o las que solo entendemos nosotros.

export type PuzzleKind = 'quien' | 'sopa' | 'orden' | 'crucigrama' | 'parejas' | 'completa' | 'ahorcado' | 'emojis';

export interface PuzzleInfo {
  id: string;
  kind: PuzzleKind;
  /** Entre el capítulo `after` y el siguiente. */
  after: number;
  /** Día en que se abre (mes 0 = enero). */
  day: [number, number, number];
  icon: string;
  title: string;
  /** Una línea de qué va (sin pistas de más). */
  sub: string;
}

export const PUZZLES: PuzzleInfo[] = [
  { id: 'quien', kind: 'quien', after: 1, day: [2026, 10, 30], icon: '💬', title: '¿Quién lo dijo?', sub: 'Nos lo escribimos: ¿tuya o mía?' },
  { id: 'sopa', kind: 'sopa', after: 2, day: [2026, 11, 3], icon: '🔤', title: 'Sopa de letras', sub: 'Cómo nos damos las buenas noches' },
  { id: 'orden', kind: 'orden', after: 3, day: [2026, 11, 7], icon: '🗓️', title: 'En orden', sub: 'Lo que pasó entre capítulo y capítulo' },
  { id: 'crucigrama', kind: 'crucigrama', after: 4, day: [2026, 11, 10], icon: '✏️', title: 'El crucigrama de Gas', sub: 'Cosas nuestras que no salen en ningún capítulo' },
  { id: 'parejas', kind: 'parejas', after: 5, day: [2026, 11, 14], icon: '🃏', title: 'Parejas', sub: 'Nuestras fotos, de dos en dos' },
  { id: 'completa', kind: 'completa', after: 6, day: [2026, 11, 17], icon: '🧩', title: 'Completa la frase', sub: 'Nos las dijimos tal cual' },
  { id: 'ahorcado', kind: 'ahorcado', after: 7, day: [2026, 11, 20], icon: '🪢', title: 'El ahorcado', sub: 'Frases que solo entendemos nosotros' },
  { id: 'emojis', kind: 'emojis', after: 8, day: [2026, 11, 23], icon: '😍', title: 'En emojis', sub: 'Momentos de nuestro chat: ¿cuál es?' },
];

/**
 * ¿Quién lo dijo? Frases literales del chat (tal cual se escribieron) que no salen en ningún capítulo: quién y cuándo.
 * (Ninguna se repite en los otros juegos.)
 */
export const WHO_SAID: { text: string; who: 'Azul' | 'Gas'; when: string }[] = [
  { text: 'Quiero bailar contigo para siempre', who: 'Azul', when: '31 de mayo' },
  { text: 'Si dormir poco es dormir contigo donde firmo?', who: 'Azul', when: '24 de febrero' },
  { text: 'Tu eres la excepcion en todo', who: 'Gas', when: '4 de mayo, después de la moto' },
  { text: 'Contigo en la llamada lo tengo todo', who: 'Gas', when: '2 de septiembre' },
  { text: 'Regla n1 contigo nunca enfadada', who: 'Azul', when: '11 de mayo' },
  { text: 'Tatuate el momento en el que lo veamos juntos', who: 'Gas', when: '6 de mayo' },
  { text: 'Despertar contigo es algo que no se explica', who: 'Azul', when: '26 de mayo' },
  { text: 'Si con alguien no me podre enfadar es contigo', who: 'Gas', when: '10 de mayo' },
  { text: 'Pq amo el amor mierdaaaaaa', who: 'Azul', when: '18 de julio' },
  { text: 'He deseado estar contigo prácticamente en toda la noche, eres muy divertida', who: 'Gas', when: '11 de abril, el cumple de Carme' },
  { text: 'Del haberse visto dos noches en agosto a pasar 4 dias juntos', who: 'Azul', when: '25 de octubre de 2025' },
  { text: 'Esos primeros 45’ son de reunion contigo', who: 'Gas', when: '26 de octubre de 2025' },
];

/** Sopa de letras: cómo nos damos las buenas noches (y lo que va detrás). Al encontrar cada una, de dónde sale. */
export const SOUP_WORDS = ['BONANIT', 'BUONANOTTE', 'NANIT', 'BACI', 'BESITOS', 'ABRAZOS', 'AMORE', 'TIERNO', 'MUA'];

/** En orden: momentos de entre capítulos (ninguno es un capítulo), con su fecha de verdad. */
export const TIMELINE: { emoji: string; text: string; when: string }[] = [
  { emoji: '🍝', text: 'La pasta del congelador: «gracias a mi yo del pasado»', when: '1 sep 2025' },
  { emoji: '✉️', text: 'Tu carta por correo, con fotos', when: 'nov 2025' },
  { emoji: '🎂', text: '«Muchas felicidades mi Azul»: tu cumple', when: '28 nov 2025' },
  { emoji: '☀️', text: 'Gas va a pedir info a los rayos UVA', when: '8 ene 2026' },
  { emoji: '💌', text: '«Tú, Azul, eres para mí… una persona fantástica»', when: '15 ene 2026' },
  { emoji: '📞', text: 'El juego de las llamadas para el cumple de Carme', when: '11 abr 2026' },
  { emoji: '🏡', text: '«Sí que me haría ilu vivir contigo»', when: '31 may 2026' },
  { emoji: '🔑', text: 'Gas va a ver el piso', when: '13 oct 2026' },
];

/** Completa la frase: literal del chat, con un hueco y tres opciones (la buena, primero; se barajan). */
export const FILL: { before: string; after: string; options: [string, string, string]; who: string }[] = [
  { before: 'Necesito agua, cafe, y', after: '', options: ['abrazos', 'dormir', 'vacaciones'], who: 'Azul, 23 de abril' },
  { before: 'Si cierro los ojos te vuelvo a ver', after: '', options: ['aqui', 'mañana', 'en sueños'], who: 'Azul, 15 de febrero' },
  { before: 'Contigo solo es', after: '', options: ['emocion', 'calma', 'risa'], who: 'Azul, 25 de mayo' },
  { before: 'Cada momento que salimos juntos en vdd son los que mas me', after: '', options: ['llegan', 'cansan', 'cuestan'], who: 'Azul, 6 de mayo' },
  { before: 'Si algo hay de mi ahi esta en las babas de', after: '', options: ['Joy', 'Eric', 'Carme'], who: 'Gas, 8 de junio' },
  { before: 'Se me hizo corto, un poco como cualquier finde contigo al final, nunca es', after: '', options: ['bastante', 'igual', 'tarde'], who: 'Azul, 8 de junio' },
  { before: 'Creo que me traje de vuelta un poco de', after: 'contigo', options: ['nostalgia', 'arena', 'sol'], who: 'Azul, 4 de mayo' },
  { before: 'Me encantas, ojala te quedes en mi vida', after: '', options: ['siempreeee', 'un rato', 'este verano'], who: 'Azul, 11 de abril' },
];

/** El ahorcado: frases nuestras (tal cual, sin tildes) y una pista. */
export const HANGMAN: { phrase: string; hint: string }[] = [
  { phrase: 'MAS QUE AYER Y MENOS QUE MAÑANA', hint: 'Cuánto me echabas de menos (9 de mayo)' },
  { phrase: 'PARTE DE TU MAGIA', hint: 'Lo que es que contigo haya pocas cosas típicas' },
  { phrase: 'BESOS ABRAZOS Y ALGO MAS', hint: 'Cómo nos despedíamos en mayo' },
  { phrase: 'OPTIMISTA INCURABLE', hint: 'Cómo te describiste en enero' },
  { phrase: 'QUIERO JOY Y CASA', hint: 'Lo que echaba de menos Gas en abril' },
];

/** En emojis: momentos de nuestro chat que no son capítulos. */
export const EMOJI_ROUNDS: { emojis: string; answer: string }[] = [
  { emojis: '💅💙', answer: 'Tus uñas azules, por primera vez' },
  { emojis: '👨‍🏫💯🙋‍♀️', answer: '«Te quiero de profe 100%»' },
  { emojis: '🎬🌪️💔', answer: 'Cumbres borrascosas' },
  { emojis: '🍫🍫🍫🤯', answer: 'Tu atracón de chocolates en las tiendas' },
  { emojis: '💍👀✨', answer: 'La primera pedida que viste' },
  { emojis: '🎂2️⃣7️⃣', answer: 'El cumple de Gas' },
  { emojis: '⚽🔴⚫🔵', answer: 'El derby Milan-Inter' },
  { emojis: '🏄‍♂️💨🌊', answer: 'Gas, de surf (y sin olas por el viento)' },
];
