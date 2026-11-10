// Lo que convierte la historia en juego: el avance de cada día, lo que comentan al andar, las preguntas dentro
// de los chats y los recuerdos escondidos por los escenarios. Marc: todo el texto se retoca aquí.
import { CHATS, type ChatMsg } from './chats';
import { STICKERS } from './memories';
import cocacola from '../assets/recuerdos/cocacola.jpg';
import diadema from '../assets/recuerdos/diadema.jpg';
import joyFoto from '../assets/recuerdos/joy.jpg';

/** Una pista de lo que viene. Se ve al acabar el capítulo anterior y en el mapa. */
export const TEASERS: Record<number, string> = {
  2: '«Silencio full», que la grava cruje.',
  3: 'El primer restaurante que empiece por M.',
  4: '26 palo, pero D top ✨pasillo✨',
  5: 'Ma menos, que no cabe.',
  6: 'Dime exacto, pls.',
  7: '¿Guanciale o bacon?',
  8: 'Ready para un día que vas a recordar toda tu vida.',
  9: 'Un año justo.',
};

export interface Bark {
  who: string;
  text: string;
}
const b = (who: string, text: string): Bark => ({ who, text });

/** Lo que van diciendo mientras andas, sin parar el juego. Capítulo → fase → frases, en orden. */
export const BARKS: Record<number, Record<string, Bark[]>> = {
  1: {
    collect: [
      b('Tòfol', 'Pomades per ses barres, i alerta amb ses potes!'),
      b('Carme', 'Tens purpurina fins a ses orelles!'),
      b('Una veïna', 'Quan s’aturi, una carícia. Du sort, al·lota.'),
      b('Tòfol', 'Aquest ase no mira on va. Aparta!'),
      b('Carme', 'Vina ja a Sa Font, que aquí no es balla.'),
    ],
    returnTofol: [b('Tòfol', 'Vina, vina, que tenc set!'), b('Una veïna', 'Alerta, que no se t’abocin!')],
    findMarc: [b('Carme', 'Som aquí! Sa Font és per aquí!'), b('Tòfol', 'Vés, vés, que es jaleo no espera.')],
  },
  2: {
    atBar: [b('Gas', 'Bale tabiso ara.'), b('Gas', 'Arranco!')],
    toPool: [b('Gas', 'Silencio full, eh.'), b('Gas', 'Ni respires, eh.'), b('Gas', 'Molaría mazo que no se enteraran.')],
    swim: [b('Gas', 'Muy pequeñita ella, pero sí, funciona.'), b('Gas', 'Y se le puede llamar piscina. Como tal.')],
    toTowels: [b('Gas', 'Mira qué cielo.'), b('Margaux', 'Soy una mujer con muchas sorpresas.')],
  },
  3: {
    drive1: [
      b('Marc', 'Si no da lluvia, moto. Si da lluvia, coshe.'),
      b('Marc', 'Y lo del helado, eso sí que no te lo podré perdonar.'),
      b('Margaux', 'Te invito a una cerve.'),
      b('Marc', 'A una langosta.'),
      b('Margaux', 'Muy bien. Humilde. Me gusta.'),
      b('Marc', 'Caminitos, no solo autopista.'),
    ],
    camp: [b('Marc', 'Lo llevo todo. Cartas, hornillo…'), b('Margaux', '¿Seguro que todo?')],
    drive2: [b('Gas', 'No habrá mejor zamburiña en el mundo.'), b('Margaux', 'Déjalo.'), b('Gas', 'Solo digo.')],
  },
  4: {
    airport: [
      b('Margaux', 'Tengo miedísimo de quedarme en Madrid.'),
      b('Gas', '(WhatsApp) Q puto asco el burguer. NUNCA más.'),
      b('Margaux', '26 palo, pero D top. Pasillo.'),
    ],
    toWc: [b('Gas', 'Pfffff. Temón.'), b('Un señor de Telde', '¿Esta es la cola? Pues vaya tela.'), b('Gas', 'Justo ahora, tenía que ser.')],
    seek: [b('Gas', 'Flash, pls.'), b('Gas', 'Estoy. Xo no veo.'), b('Una de Telde', 'Permiso, mi niño.')],
  },
  5: {
    ride: [
      b('Gas', 'Tú acompaña. Si yo me inclino, tú también.'),
      b('Gas', 'Más pegaítos, con el aire en la cara.'),
      b('Margaux', 'Ay, que eres lo mejor, te juro.'),
      b('Gas', '¿Ves? Ni tacones ni secador.'),
    ],
  },
  6: {
    hunt: [
      b('Gas', '(WhatsApp) Llevo 30’ dando vueltas.'),
      b('Una de Ciutadella', 'Avellanes! Qui en vol?'),
      b('Gas', '(WhatsApp) Dime exacto, pls.'),
      b('Un caixer', 'Alerta an es cavall!'),
    ],
    be: [b('Gas', 'Venga, hasta arriba, que este bota.'), b('Margaux', 'Cuidado, que te pisa.'), b('Una de Ciutadella', 'Jaleo! Jaleo!')],
    taxi: [
      b('Gas', 'Ay.'),
      b('Margaux', 'Ya casi.'),
      b('Gas', 'Ay, ay, ay.'),
      b('Margaux', 'Son veinte metros, Gas.'),
      b('Gas', 'Veinte metros, dice. Déjame aquí.'),
    ],
    home: [b('Gas', 'No siento el pie.'), b('Margaux', 'Shhh, que hay gente durmiendo.')],
  },
  7: {
    toKitchen: [b('Gas', 'Todo esto lo hago por una pasta.'), b('Gas', 'Bacon iba bien si tenías.'), b('Margaux', 'Que dices.')],
    toTable: [b('Gas', 'El 10 es la carbonara.'), b('Gas', 'Yo digo 00.15. A qué hora vuelven, digo.'), b('Margaux', 'Yo no sé. Creo que 12.30.')],
    alarm: [b('Gas', '¡Corre, corre!'), b('Margaux', '¡Mi casco no! ¡Tu casco!'), b('Gas', 'Yo ya me veo saltando el muro.')],
  },
  8: {
    walk: [b('Eric', '¡A hombros! ¡A hombros!'), b('Gas', 'Joy va a todas partes menos a donde vamos.'), b('Margaux', 'Ahí al fondo, el faro.')],
    back: [b('Gas', '¿Qué tal he estado con tu padre?'), b('Margaux', 'Te ha mirado de arriba abajo. Aprobado. Creo.')],
    toCar: [b('Gas', 'Vámonos, que no llegamos.')],
    marcParents: [b('Gas', 'Tranquila, que no muerden.'), b('Margaux', 'Eso lo dirás tú.')],
  },
  9: {
    findMarc: [b('Carme', 'Ell és per aquí. Segueix sa ubicació!'), b('Gas', '(WhatsApp) Tengo bocata.'), b('Gas', '(WhatsApp) Y patatas.')],
    collect: [
      b('Gas', 'Solo te he visto 22 veces.'),
      b('Margaux', 'No solo son el número de las veces que cuentan.'),
      b('Gas', 'Horas llevo 203.'),
      b('Tòfol', 'Alerta amb ses potes, parelleta!'),
    ],
    returnTofol: [b('Tòfol', 'Vinga, que tenc set!')],
  },
};

/**
 * Preguntas dentro de los chats: antes de un mensaje suyo, adivinar qué contestó. La clave es el texto exacto del
 * mensaje, que no se toca nunca; los valores son las respuestas falsas, que solo salen como opciones y se descartan.
 */
export const QUIZ: Record<string, string[]> = {
  // 1
  'Ahora?!': ['Voy corriendo', 'Yo de noche no nado'],
  'Tienes piscina???': ['Playita, playita', '¿Con este frío?'],
  // 2
  'Y me lo dices asi?!': ['Pues buen viaje', 'Llévame contigo'],
  'Tienes una en casa ? Ahahaja': ['La municipal está guay', 'Yo tengo una, ven'],
  'Valeeee entendido jefe 😇': ['No prometo nada', 'Yo no hago ruido nunca'],
  'Me gustas tu': ['A mí también', 'Es la adrenalina'],
  // 3
  'A ver si el destino esta de nuestra parte': ['Corre, Forrest', 'Pillo otro tren y ya'],
  'Muy bien': ['Ni loca', 'Pagas tú'],
  'Como que porque gassss, por nuestro intento fallido de camping gas y tu dedicación a la aventura': [
    'Porque corres mucho con la moto',
    'Porque te lo pusieron en Ferreries',
  ],
  // 4
  'Pilla tu': ['Déjame mirar el calendario', '¿Cuánto cuestan?'],
  'Yo tengo 26D.. 26 palo pero D top ✨pasillo✨': ['Yo tengo ventana, ja', 'A mí me han subido a business'],
  'Hice video no te preocupes': ['Ya te la canto yo', 'Haber aguantado'],
  // 5
  'Ay es que eres lo mejor te juro': ['¿Y la maleta dónde va?', '¿Cuánto ha costado?'],
  'Hasta cuando ?': ['Trabajo mañana', 'Porque me echas de casa'],
  // 6
  'Que estaba escrito solo MAR': ['Que me lo dijo mi madre', 'Que lo vi en la tele'],
  'Es a las dooos': ['Ya casi', 'Estoy aparcando'],
  'Quizas me escondes muy bien': ['Quizás les dio igual', 'Quizás no miran'],
  'Si, y por eso imposible de olvidar 🤍': ['Alguna, sí', 'Eso me lo enseñaste tú'],
  // 7
  'Nooo': ['Vale, ven', 'Trae vino'],
  'Que dices': ['Buena idea', 'Tengo chorizo'],
  'Que hace mi padre top': ['Se ha olvidado la cartera', 'Mi madre no encuentra las llaves'],
  // 8
  'Estoy euforicaaaa': ['Estoy dormidaaa', '¿Hay que madrugar?'],
  'Sii dia cargado': ['Mañana más', 'Yo aún tiemblo'],
  // 9
  'Respuesta incorrecta': ['Buena respuesta', '¿De quién?'],
  'Usuario desbloqueado': ['Bloqueado para siempre', 'Explícate'],
  'Pesado': ['Qué bonito', '¿Y si ponemos una?'],
};

export interface Keepsake {
  id: string;
  chapter: number;
  /** Fases del capítulo en las que está (la escena y quien la recoge dependen de la fase). */
  phases: string[];
  x: number;
  z: number;
  y?: number;
  /** Radio para cogerlo (por defecto, 1,5 m; en la carretera, solo el carril). */
  r?: number;
  /** Moto: posición en la ruta (0 a 1) y a qué lado cuelga: hay que inclinarse hacia él para cogerlo. */
  u?: number;
  side?: number;
  src?: string;
  chat?: ChatMsg[];
  sticker?: boolean;
  caption: string;
}

const M1 = ['talkTofol', 'collect', 'returnTofol', 'findMarc'];

/** Recuerdos escondidos: fotos reales y trozos literales de los chats, fuera del camino que marca la luz. */
export const KEEPSAKES: Keepsake[] = [
  // Ferreries
  { id: 'c1-atesoro', chapter: 1, phases: M1, x: -44, z: 2.5, chat: CHATS.atesoro.msgs, caption: 'Que ese día es nuestro' },
  { id: 'c1-ojos', chapter: 1, phases: M1, x: 11, z: 24.5, chat: CHATS.ferreriesTarde.msgs.slice(9, 12), caption: '25 de agosto de 2025' },
  { id: 'c1-diadema', chapter: 1, phases: M1, x: -8, z: 22, src: diadema, caption: 'Y la diadema.' },
  // Bar Imperi y casa de Gas
  { id: 'c2-cola', chapter: 2, phases: ['atBar'], x: -616, z: 1, chat: CHATS.imperi.msgs.slice(82, 84), caption: 'Sigo aún con la cola' },
  { id: 'c2-joy', chapter: 2, phases: ['arrive', 'toPool', 'toTowels'], x: -5.5, z: -7, src: joyFoto, caption: '«Siii es un perrito negro, bueno, no tan chiquito»' },
  { id: 'c2-cesped', chapter: 2, phases: ['toTowels'], x: 3.4, z: 13, chat: CHATS.cesped.msgs.slice(19, 22), caption: 'Tb el césped' },
  // La carretera (un carril concreto) y el camping
  { id: 'c3-pacto', chapter: 3, phases: ['drive1'], x: 2.6, z: 305, r: 1.9, chat: CHATS.pacto.msgs.slice(5, 7), caption: 'El pacto' },
  { id: 'c3-camp', chapter: 3, phases: ['camp'], x: 8, z: -9, chat: CHATS.muyJusto.msgs.slice(8, 11), caption: '30 de octubre: logrado' },
  { id: 'c3-langosta', chapter: 3, phases: ['drive2'], x: -2.6, z: 1965, r: 1.9, chat: CHATS.helado.msgs.slice(10, 14), caption: 'Humilde' },
  // Barajas y el estadio
  { id: 'c4-burger', chapter: 4, phases: ['airport'], x: 292, z: 14, chat: CHATS.burger.msgs.slice(0, 2), caption: 'NUNCA más' },
  { id: 'c4-asiento', chapter: 4, phases: ['airport'], x: 301, z: 8, chat: CHATS.burger.msgs.slice(15, 19), caption: 'Q cabrones' },
  { id: 'c4-entradas', chapter: 4, phases: ['toWc', 'seek'], x: 19, z: 24, chat: CHATS.somosLas.msgs.slice(1, 3), caption: '17 de enero, 21:52' },
  // La moto: cuelgan a un lado de la carretera
  { id: 'c5-plan', chapter: 5, phases: ['ride'], x: 0, z: 0, u: 0.21, side: 1, chat: CHATS.motoPlan.msgs.slice(2, 4), caption: 'Ya tenemos moto' },
  { id: 'c5-juzgamos', chapter: 5, phases: ['ride'], x: 0, z: 0, u: 0.46, side: 1, src: STICKERS.juzgamos, sticker: true, caption: 'Nadie juzga. Solo un poco.' },
  { id: 'c5-pequena', chapter: 5, phases: ['ride'], x: 0, z: 0, u: 0.74, side: 1, chat: CHATS.motoTrip.msgs.slice(8, 12), caption: 'QUE PEQUEÑA' },
  // Sant Joan
  { id: 'c6-mar', chapter: 6, phases: ['hunt', 'exact', 'coming', 'be'], x: 87, z: 10, src: cocacola, caption: '«Que estaba escrito solo MAR. Y no creo en las coincidencias»' },
  { id: 'c6-ubi', chapter: 6, phases: ['hunt', 'exact', 'coming', 'be'], x: 34, z: 3.6, chat: CHATS.ubi.msgs.slice(0, 5), caption: 'Tuuuu maldito' },
  { id: 'c6-sueno', chapter: 6, phases: ['be'], x: 124, z: 9, chat: CHATS.arranco.msgs.slice(0, 2), caption: '23 de junio de 2026' },
  // La cena
  { id: 'c7-pasta', chapter: 7, phases: ['toKitchen', 'toTable', 'alarm'], x: 4, z: 1.6, chat: CHATS.cenaMenu.msgs.slice(0, 4), caption: 'Todo esto lo hago por una pasta' },
  { id: 'c7-hora', chapter: 7, phases: ['toKitchen', 'toTable', 'alarm'], x: -3.5, z: 8, chat: CHATS.cenaPlan.msgs.slice(8, 10), caption: 'A partir de las 22.50' },
  { id: 'c7-carita', chapter: 7, phases: ['toKitchen', 'toTable', 'alarm'], x: 4.2, z: 8.8, src: STICKERS.carita, sticker: true, caption: 'Esa cara' },
  // El día del eclipse
  { id: 'c8-ready', chapter: 8, phases: ['parents', 'walk', 'back', 'toCar'], x: 4, z: 8.8, chat: CHATS.eclipseReady.msgs.slice(0, 2), caption: '12 de agosto de 2026' },
  { id: 'c8-luna', chapter: 8, phases: ['walk', 'back'], x: -70, z: 11.5, chat: CHATS.luna.msgs, caption: '16 de agosto de 2026' },
  { id: 'c8-cosas', chapter: 8, phases: ['marcParents'], x: 3.6, z: -1.8, chat: CHATS.eclipseFin.msgs.slice(2, 4), caption: 'Cama' },
  // Un año después
  { id: 'c9-22', chapter: 9, phases: M1, x: -44, z: -3.5, chat: CHATS.veintidos.msgs.slice(0, 5), caption: 'Solo te he visto 22 veces' },
  { id: 'c9-bocata', chapter: 9, phases: M1, x: 32.5, z: 4.5, chat: CHATS.bocata.msgs.slice(5, 8), caption: 'Y patatas' },
  { id: 'c9-fecha', chapter: 9, phases: M1, x: 20, z: -3.5, chat: CHATS.fecha.msgs.slice(0, 3), caption: 'Tenemos fecha nosotros?' },
];

export const keepsakesFor = (chapter: number) => KEEPSAKES.filter((k) => k.chapter === chapter);
