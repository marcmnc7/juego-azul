// Lo que convierte la historia en juego: el avance de cada día, lo que comentan al andar, las preguntas dentro
// de los chats y los recuerdos escondidos por los escenarios. Marc: todo el texto se retoca aquí.
import cocacola from '../assets/recuerdos/cocacola.jpg';
import diadema from '../assets/recuerdos/diadema.jpg';
import joyFoto from '../assets/recuerdos/joy.jpg';
import trenes from '../assets/recuerdos/trenes.jpg';
import ruta from '../assets/recuerdos/ruta.jpg';
import playaCB from '../assets/recuerdos/playa-costa-brava.jpg';
import amapolas from '../assets/recuerdos/amapolas.jpg';
import paella from '../assets/recuerdos/paella.jpg';
import cervezasCala from '../assets/recuerdos/cervezas-cala.jpg';
import cineAzotea from '../assets/recuerdos/cine-azotea.jpg';
import hipica from '../assets/recuerdos/hipica.jpg';
import madridCrema from '../assets/recuerdos/madrid-crema.jpg';
import paredRoja from '../assets/recuerdos/pared-roja.jpg';
import caballoJulio from '../assets/recuerdos/caballo-julio.jpg';
import bailando from '../assets/recuerdos/bailando.jpg';
import ferryFoto from '../assets/recuerdos/ferry.jpg';
import agostoPaseo from '../assets/recuerdos/agosto-paseo.jpg';
import piscinaNoche from '../assets/recuerdos/piscina-noche.jpg';
import cesped from '../assets/recuerdos/cesped.jpg';
import calaOlivas from '../assets/recuerdos/cala-olivas.jpg';
import fiestaSept from '../assets/recuerdos/fiesta-sept.jpg';
import ferreries46 from '../assets/recuerdos/ferreries-46.jpg';
import fiestaCarrete from '../assets/recuerdos/fiesta-carrete.jpg';
import dogfyCrew from '../assets/recuerdos/dogfy-crew.jpg';
import corazonDedos from '../assets/recuerdos/corazon-dedos.jpg';
import amigosCalle from '../assets/recuerdos/amigos-calle.jpg';
import calaCarrete from '../assets/recuerdos/cala-carrete.jpg';
import arroz from '../assets/recuerdos/arroz.jpg';
import tortilla from '../assets/recuerdos/tortilla.jpg';
import calaMayo from '../assets/recuerdos/cala-mayo.jpg';
import cenaCoreana from '../assets/recuerdos/cena-coreana.jpg';
import mascarillas from '../assets/recuerdos/mascarillas.jpg';
import mirador from '../assets/recuerdos/mirador.jpg';
import carnavalMonja from '../assets/recuerdos/carnaval-monja.jpg';
import carnavalVaquera from '../assets/recuerdos/carnaval-vaquera.jpg';
import sanSiro from '../assets/recuerdos/san-siro.jpg';
import granCanaria from '../assets/recuerdos/gran-canaria.jpg';

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
  /** Solo se oye cerca de este sitio [x, z, radio] (quien lo dice está ahí, no en todo el pueblo). */
  near?: [number, number, number];
}
const b = (who: string, text: string, near?: [number, number, number]): Bark => ({ who, text, near });
/** Sa Font, donde está Carme en el cap. 1. */
const FONT: [number, number, number] = [-5.2, 21.6, 13];

/** Lo que van diciendo mientras andas, sin parar el juego. Capítulo → fase → frases, en orden. */
export const BARKS: Record<number, Record<string, Bark[]>> = {
  1: {
    collect: [
      b('Tòfol', 'Pomades per ses terrasses, i alerta amb ses potes!'),
      b('Carme', 'Tens purpurina fins a ses orelles!', FONT),
      b('Una veïna', 'Quan s’aturi, una carícia. Du sort, al·lota.'),
      b('Tòfol', 'Aquest ase no mira on va. Aparta!'),
      b('Carme', 'Vina ja a Sa Font, que aquí no es balla.', FONT),
    ],
    returnTofol: [b('Tòfol', 'Vina, vina, que tenc set!'), b('Una veïna', 'Alerta, que no se t’abocin!')],
    findMarc: [b('Carme', 'Som aquí! Sa Font és per aquí!', FONT), b('Tòfol', 'Vés, vés, que es jaleo no espera.')],
  },
  2: {
    // (Gas no está en el bar: viene en coche; lo suyo son mensajes, no un bocadillo flotando por el Born)
    atBar: [b('Gas', '(WhatsApp) Arranco!')],
    toPool: [b('Gas', 'Silencio full, eh.'), b('Gas', 'Ni respires, eh.'), b('Gas', 'Molaría mazo que no se enteraran.')],
    // (lo de la piscina pequeñita ya no va suelto: es un diálogo al meterse, antes de Marco Polo)
    toTowels: [b('Gas', 'Mira qué cielo.'), b('Margaux', 'Soy una mujer con muchas sorpresas.')],
  },
  3: {
    // (conduciendo, nada de charla de fondo: solo las reacciones a lo que pasa en la carretera)
    camp: [b('Marc', 'Mira qué cabaña. Y tiene estufa.'), b('Margaux', 'Al menos dormiremos calentitos.')],
  },
  4: {
    airport: [
      b('Margaux', 'Tengo miedísimo de quedarme en Madrid.'),
      b('Gas', '(WhatsApp) Q puto asco el burguer. NUNCA más.'),
      b('Margaux', '26 palo, pero D top. Pasillo.'),
    ],
    // (el «pfffff temón» va en el chat, ya en la cola: aquí aún no ha empezado)
    toWc: [b('Gas', 'Justo ahora, tenía que ser.'), b('Un señor de Telde', '¿Esta es la cola? Pues vaya tela.')],
    seek: [b('Gas', 'Flash, pls.'), b('Gas', 'Estoy. Xo no veo.'), b('Una de Telde', 'Permiso, mi niño.')],
  },
  // 5: lo que se dicen en la moto va en MOTO.talk (story.ts): el nivel lo reparte por el viaje, cada uno desde su
  // asiento y sin pisar los saludos ni las fotos
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
  'Bueno dejame hablar con mis padres entender la dinamica': ['Ven ya y punto', 'Mis padres no salen nunca'],
  'Carbonara muy pesada': ['Carbonara, obvio', 'Pizza congelada y ya'],
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
  /** La foto (sin ella, es un hueco para una que Marc aún tiene que pasar: en el álbum sale «Foto pendiente»). */
  src?: string;
  caption: string;
}

/** Cap. 1 y 9: las fases en las que se anda por Ferreries. */
const M1 = ['talkTofol', 'collect', 'returnTofol', 'findMarc'];
const M9 = ['findMarc', 'toFont'];
/** Cap. 2: el jardín y la piscina de casa de Gas. */
const H2 = ['arrive', 'toPool', 'toTowels'];
/** Cap. 6: las calles de Ciutadella. */
const SJ6 = ['hunt', 'exact', 'coming', 'nuts', 'be'];
/** Cap. 7: las fases en las que se anda por el jardín (abrir a Gas, cocina, mesa, susto, el casco y a dormir). */
const C7 = ['toGate', 'toKitchen', 'toTable', 'alarm', 'seeOff', 'toBed'];

/**
 * Recuerdos escondidos (21 nov): solo fotos, como las que se desbloquean al acabar cada capítulo, repartidas por
 * todos los escenarios y lejos del camino, para que quien quiera tenerlas todas lo investigue todo. Las que aún no
 * tienen `src` esperan la foto de Marc.
 */
export const KEEPSAKES: Keepsake[] = [
  // 1 · Ferreries
  { id: 'r1-diadema', chapter: 1, phases: M1, x: -8, z: 22, src: diadema, caption: 'Y la diadema.' },
  { id: 'r1-a', chapter: 1, phases: M1, x: -44, z: 2.5, src: fiestaCarrete, caption: 'Pistolas de agua y fiesta, en carrete' },
  { id: 'r1-b', chapter: 1, phases: M1, x: 11, z: 24.5, src: dogfyCrew, caption: 'DOGFY CREW, de fiesta' },
  { id: 'r1-c', chapter: 1, phases: M1, x: 44, z: 1.9, src: corazonDedos, caption: 'Un corazón con los dedos' },
  { id: 'r1-d', chapter: 1, phases: M1, x: 23.5, z: 4.4, src: amigosCalle, caption: 'Con los amigos, de paseo' },
  // 2 · Ciutadella (Ses Voltes, Plaça Espanya, Es Bè y Pins) y casa de Gas
  { id: 'r2-a', chapter: 2, phases: ['atBar'], x: -514, z: -1.5, src: calaCarrete, caption: 'En carrete, en la cala' },
  { id: 'r2-b', chapter: 2, phases: ['atBar'], x: -571, z: -14.8, src: arroz, caption: 'Arroz con carne, a medias' },
  { id: 'r2-c', chapter: 2, phases: ['atBar'], x: -601.5, z: -48.5, src: tortilla, caption: 'La tortilla, con su cerveza' },
  { id: 'r2-d', chapter: 2, phases: H2, x: 3.4, z: -15.6, src: calaMayo, caption: 'Una cala para nosotros' },
  { id: 'r2-e', chapter: 2, phases: ['atBar'], x: -476, z: -3.5, src: cenaCoreana, caption: 'Cena coreana' },
  // 3 · La carretera (un carril concreto) y el camping
  { id: 'r3-trenes', chapter: 3, phases: ['drive1'], x: 2.6, z: 305, r: 1.9, src: trenes, caption: 'Sants–Atocha, 30 de octubre' },
  { id: 'r3-ruta', chapter: 3, phases: ['drive1'], x: -2.6, z: 1040, r: 1.9, src: ruta, caption: 'El primer planning: 1.454 km' },
  { id: 'r3-a', chapter: 3, phases: ['camp'], x: 8, z: -9, src: mascarillas, caption: 'Mascarilla y sofá: el plan' },
  { id: 'r3-b', chapter: 3, phases: ['drive2'], x: -2.6, z: 1965, r: 1.9, src: mirador, caption: 'Otro viaje, otro mirador' },
  // 4 · Barajas, las llegadas de Gran Canaria y el estadio
  { id: 'r4-a', chapter: 4, phases: ['airport'], x: 292, z: 14, src: carnavalMonja, caption: 'Carnaval: monja de guardia' },
  { id: 'r4-b', chapter: 4, phases: ['airport'], x: 336, z: 30.9, src: carnavalVaquera, caption: 'Carnaval: vaquera' },
  { id: 'r4-gc', chapter: 4, phases: ['arrivals'], x: 430.4, z: 12.1, src: granCanaria, caption: 'Gran Canaria, gafas puestas' },
  { id: 'r4-c', chapter: 4, phases: ['arrivals'], x: 371.4, z: 22.1, src: sanSiro, caption: 'Derby day: Milan–Inter' },
  // 5 · La moto: cuelgan a un lado de la carretera
  { id: 'r5-a', chapter: 5, phases: ['ride'], x: 0, z: 0, u: 0.21, side: 1, src: playaCB, caption: 'Tumbados en la arena, Costa Brava' },
  { id: 'r5-b', chapter: 5, phases: ['ride'], x: 0, z: 0, u: 0.34, side: -1, src: amapolas, caption: 'Un campo de amapolas, 2 de mayo' },
  // 6 · Sant Joan
  { id: 'r6-mar', chapter: 6, phases: SJ6, x: 87, z: 10, src: cocacola, caption: '«Que estaba escrito solo MAR. Y no creo en las coincidencias»' },
  { id: 'r6-a', chapter: 6, phases: SJ6, x: 34, z: 3.6, src: paella, caption: 'La paella con todos, 24 de mayo' },
  { id: 'r6-b', chapter: 6, phases: SJ6, x: -16.5, z: 0.5, src: cervezasCala, caption: 'Unas cervezas en la cala, 25 de mayo' },
  { id: 'r6-c', chapter: 6, phases: SJ6, x: 102, z: -10.5, src: cineAzotea, caption: 'Cine en la azotea, con telescopio' },
  { id: 'r6-d', chapter: 6, phases: ['be'], x: 124, z: 9, src: hipica, caption: 'A caballo, 23 de mayo' },
  { id: 'r6-e', chapter: 6, phases: ['home'], x: -8, z: 14.1, src: madridCrema, caption: 'Madrid, 6 de junio: la crema catalana' },
  // 7 · La cena
  { id: 'r7-a', chapter: 7, phases: C7, x: 4, z: 1.6, src: paredRoja, caption: '25 de julio, de fiesta' },
  { id: 'r7-b', chapter: 7, phases: C7, x: -3.5, z: 8, src: caballoJulio, caption: 'Otra vez caballos, 25 de julio' },
  // 8 · El día del eclipse
  { id: 'r8-joy', chapter: 8, phases: ['walk', 'back'], x: -70, z: 11.5, src: joyFoto, caption: 'Joy, con su pelota' },
  { id: 'r8-a', chapter: 8, phases: ['parents', 'walk', 'back', 'toCar'], x: 4, z: 8.8, src: agostoPaseo, caption: '11 de agosto, la víspera' },
  { id: 'r8-b', chapter: 8, phases: ['walk', 'back'], x: 39, z: 13.1, src: bailando, caption: 'Bailando, 6 de agosto' },
  { id: 'r8-c', chapter: 8, phases: ['marcParents'], x: 3.6, z: -1.8, src: ferryFoto, caption: 'En el ferry, 8 de agosto' },
  { id: 'r8-d', chapter: 8, phases: ['walk', 'back'], x: -31, z: 14.6, src: piscinaNoche, caption: 'De noche, junto a la piscina' },
  // 9 · Un año después
  { id: 'r9-a', chapter: 9, phases: M9, x: -44, z: -3.5, src: cesped, caption: 'Siesta en el césped, 23 de agosto' },
  { id: 'r9-b', chapter: 9, phases: M9, x: 32.5, z: 4.5, src: calaOlivas, caption: 'Olivas en la cala, 22 de agosto' },
  { id: 'r9-c', chapter: 9, phases: M9, x: 20, z: -3.5, src: ferreries46, caption: 'Otra vez de fiesta, 26 de agosto' },
  { id: 'r9-d', chapter: 9, phases: M9, x: 7.5, z: 7.4, src: fiestaSept, caption: '6 de septiembre' },
];

export const keepsakesFor = (chapter: number) => KEEPSAKES.filter((k) => k.chapter === chapter);
