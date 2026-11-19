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
  { id: 'quien', kind: 'quien', after: 1, day: [2026, 10, 30], icon: '💬', title: '¿Quién lo dijo?', sub: 'Frases de nuestro chat: ¿tuya o mía?' },
  { id: 'sopa', kind: 'sopa', after: 2, day: [2026, 11, 3], icon: '🔤', title: 'Sopa de letras', sub: 'Las palabras que más nos decimos' },
  { id: 'orden', kind: 'orden', after: 3, day: [2026, 11, 7], icon: '🗓️', title: 'En orden', sub: 'Nuestra historia, de la primera a la última' },
  { id: 'crucigrama', kind: 'crucigrama', after: 4, day: [2026, 11, 10], icon: '✏️', title: 'El crucigrama de Gas', sub: 'Todo sale de nuestro chat' },
  { id: 'parejas', kind: 'parejas', after: 5, day: [2026, 11, 14], icon: '🃏', title: 'Parejas', sub: 'Nuestras fotos, de dos en dos' },
  { id: 'completa', kind: 'completa', after: 6, day: [2026, 11, 17], icon: '🧩', title: 'Completa la frase', sub: 'Nos las dijimos tal cual' },
  { id: 'ahorcado', kind: 'ahorcado', after: 7, day: [2026, 11, 20], icon: '🪢', title: 'El ahorcado', sub: 'Frases que solo entendemos nosotros' },
  { id: 'emojis', kind: 'emojis', after: 8, day: [2026, 11, 23], icon: '😍', title: 'En emojis', sub: '¿Qué momento es?' },
];

/** ¿Quién lo dijo? Literal del chat (sin tildes de más ni correcciones), quién y cuándo. */
export const WHO_SAID: { text: string; who: 'Azul' | 'Gas'; when: string }[] = [
  { text: 'Ara nam', who: 'Azul', when: '25 de agosto de 2025, el primer mensaje' },
  { text: 'Ve hacia pins', who: 'Gas', when: '26 de agosto, la noche de la piscinita' },
  { text: 'Solo el cesped sabe que pasó', who: 'Azul', when: '27 de agosto, a la 1:25' },
  { text: 'Si no da lluvia moto, si da lluvia coshe', who: 'Gas', when: '24 de octubre' },
  { text: 'Pero el mulletttty un poco da vibe surf o almenos chill sabes?', who: 'Azul', when: '20 de diciembre' },
  { text: 'Esa es mi Azul', who: 'Gas', when: '13 de noviembre' },
  { text: 'Eres lo mejor te juro', who: 'Azul', when: '11 de abril' },
  { text: 'Dime exacto pls', who: 'Gas', when: 'Sant Joan, 18:16' },
  { text: 'Podemos ir probando gildas para siempre', who: 'Azul', when: '29 de julio' },
  { text: 'Todo esto lo hago por una pasta', who: 'Gas', when: '13 de julio, antes de la carbonara' },
  { text: 'Que hace mi padre top', who: 'Azul', when: '13 de julio, 21:08' },
  { text: 'Con Joy todo tiene que ser mas divertido', who: 'Gas', when: '27 de agosto de 2025' },
];

/** Sopa de letras: las palabras más nuestras (cuántas veces salen en el chat, más o menos). */
export const SOUP_WORDS = ['TONSES', 'BRUTAL', 'PLANAZO', 'AMORE', 'TIERNO', 'BONANIT', 'HEAVY', 'FLIPAS', 'CHILL', 'JOY'];

/** En orden: los momentos de los nueve capítulos (el último ya sale en el 9, así que aquí, ocho). */
export const TIMELINE: { emoji: string; text: string; when: string }[] = [
  { emoji: '🫏', text: 'El jaleo d’ases y «quins ulls»', when: '25 ago 2025' },
  { emoji: '🌙', text: 'La piscina en silencio (y el césped)', when: '26 ago 2025' },
  { emoji: '☕', text: 'La Cafetería Marcial: la primera con M', when: 'oct 2025' },
  { emoji: '🎸', text: 'Fito en Gran Canaria', when: 'mar 2026' },
  { emoji: '🏍️', text: 'De paquete por la Costa Brava', when: 'may 2026' },
  { emoji: '🐎', text: 'Sant Joan: «Dime exacto pls»', when: 'jun 2026' },
  { emoji: '🍝', text: 'La carbonara a escondidas', when: '13 jul 2026' },
  { emoji: '🌘', text: 'El eclipse desde la roca', when: '12 ago 2026' },
];

/** Completa la frase: literal del chat, con un hueco y tres opciones (la buena, primero; se barajan). */
export const FILL: { before: string; after: string; options: [string, string, string]; who: string }[] = [
  { before: 'Muy dificil si….', after: '', options: ['Deslumbras', 'Te quiero', 'Bona nit'], who: 'Gas, 25 de junio' },
  { before: 'Podemos ir probando', after: 'para siempre', options: ['gildas', 'croquetas', 'vinitos'], who: 'Azul, 29 de julio' },
  { before: 'Solo el', after: 'sabe que pasó', options: ['cesped', 'coche', 'mar'], who: 'Azul, 27 de agosto' },
  { before: 'Si no da lluvia moto, si da lluvia', after: '', options: ['coshe', 'peli', 'siesta'], who: 'Gas, 24 de octubre' },
  { before: 'Con', after: 'todo tiene que ser mas divertido', options: ['Joy', 'Carme', 'Fito'], who: 'Gas, 27 de agosto' },
  { before: 'Todo esto lo hago por una', after: '', options: ['pasta', 'pizza', 'cerveza'], who: 'Gas, 13 de julio' },
  { before: 'Aceptame la', after: '', options: ['UBI', 'carta', 'llamada'], who: 'Gas, Sant Joan' },
  { before: 'Llevo 30’ dando', after: '', options: ['vueltas', 'saltos', 'gritos'], who: 'Gas, Sant Joan' },
];

/** El ahorcado: frases nuestras y una pista. */
export const HANGMAN: { phrase: string; hint: string }[] = [
  { phrase: 'DIME EXACTO PLS', hint: 'Sant Joan, delante de Correus' },
  { phrase: 'SOLO EL CESPED SABE QUE PASO', hint: 'La noche de la piscinita' },
  { phrase: 'BONANIT AMORE', hint: 'Cómo acaban muchas noches' },
  { phrase: 'VOY PUMPEADO', hint: 'Del gimnasio a la carbonara' },
  { phrase: 'EN UN LUGAR ESTRATEGICO', hint: 'Dónde esperaba con la moto' },
];

/** En emojis: cada momento y su respuesta (las otras opciones salen de los demás). */
export const EMOJI_ROUNDS: { emojis: string; answer: string }[] = [
  { emojis: '🫏💦🍋💃', answer: 'El jaleo d’ases en Ferreries' },
  { emojis: '🤫🏊‍♀️🌌⭐', answer: 'La piscinita' },
  { emojis: '🚗🐄Ⓜ️☕', answer: 'La ruta de las zamburiñas' },
  { emojis: '✈️🎸🍺🚽', answer: 'Fito en Gran Canaria' },
  { emojis: '🏍️🌬️🌹🗼', answer: 'La Costa Brava en moto' },
  { emojis: '🐎🌰📍📷', answer: 'Sant Joan en Ciutadella' },
  { emojis: '🍝🥚🚫🥛🏍️', answer: 'La cena a escondidas' },
  { emojis: '🕶️🌘🪨🐕', answer: 'El eclipse' },
];
