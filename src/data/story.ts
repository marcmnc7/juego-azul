// Textos del juego. Todo el diálogo vive aquí para poder retocarlo sin tocar la lógica.
export interface Line {
  who: string;
  text: string;
}

export const NAMES = { player: 'Margaux', partner: 'Marc', playerNick: 'Azul', partnerNick: 'Gas', dog: 'Joy' };

export interface LevelInfo {
  id: number;
  name: string;
  place: string;
  emoji: string;
}

export const LEVELS: LevelInfo[] = [
  { id: 1, name: 'Jaleo d’ases', place: 'Ferreries, Menorca', emoji: '🫏' },
  { id: 2, name: 'La ruta de las zamburiñas', place: 'Madrid → San Vicente de la Barquera → Logroño', emoji: '🚗' },
  { id: 3, name: 'Fito bajo las estrellas', place: 'Canarias', emoji: '🎸' },
  { id: 4, name: 'Noche de piscina y estrellas', place: 'En casa', emoji: '🌙' },
];

export const FERRERIES = {
  intro: [
    { who: 'Narrador', text: "Ferreries, Menorca. Finales de agosto: Festes de Sant Bartomeu." },
    { who: 'Narrador', text: "Banderas de Menorca en los balcones, la fabiolera tocando en el Pla de l'Església y hoy toca Jaleo d'Ases." },
    { who: 'Narrador', text: 'Suenan el fabiol y el tamborí. Los ases salen a la calle con sus jinetes y los bares están a reventar.' },
    { who: 'Narrador', text: 'Esta noche va a pasar algo importante… aunque todavía no lo sabes.' },
    { who: 'Narrador', text: 'Habla con Tòfol, el del bar de la plaza. Él sabe de todo.' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Bon vespre! Primera vez en el Jaleo, ¿eh? Se te nota en la cara.' },
    { who: 'Tòfol', text: 'Aquí hay dos tradiciones: la pomada (gin de Menorca con limonada) y tocar a un ase cuando se pone de manos. ¡Da suerte!' },
    { who: 'Tòfol', text: 'Consigue 3 pomadas en los bares y 3 toques de suerte. Ojo, que si un ase te pilla se te cae el vaso.' },
    { who: 'Tòfol', text: 'Y luego vuelve a verme, que te presento a alguien…' },
  ] as Line[],
  tofolNotYet: [{ who: 'Tòfol', text: 'Todavía te faltan pomadas o toques de suerte. ¡Ánimo, que la noche es joven!' }] as Line[],
  tofolDone: [
    { who: 'Tòfol', text: '¡Molt bé! Ya eres de Ferreries de toda la vida.' },
    { who: 'Tòfol', text: "¿Ves a ese que baila fatal en el Bar Sa Plaça, junto a la iglesia? Se llama Marc. Lleva toda la noche mirándote." },
    { who: 'Tòfol', text: 'Llévale una pomada, anda.' },
  ] as Line[],
  marcMeet: [
    { who: 'Marc', text: '¡Hola! ¿Esa pomada es para mí? Qué detalle.' },
    { who: 'Marc', text: 'Soy Marc. Te he visto tocar a tres ases… eso es o mucha suerte o mucho valor.' },
    { who: 'Margaux', text: 'Buu… ¿y tú no tocas ninguno?' },
    { who: 'Marc', text: 'Yo soy más de bailar. Mal, pero con ganas. ¿Bailas? Prometo no pisarte. Mucho.' },
    { who: 'Narrador', text: "Bailáis hasta que el bar Sa Plaça pone la última canción. La música baja, la plaza se queda en silencio un segundo…" },
  ] as Line[],
  afterKiss: [
    { who: 'Narrador', text: 'Y así, entre ases, pomada y música, en pleno Sant Bartomeu, empezó todo.' },
    { who: 'Narrador', text: 'Él todavía no sabía que algún día sería Gas. Y ella, Azul.' },
  ] as Line[],
  hints: {
    pomada: '¡Pomada! 🍋',
    luck: '¡Toque de suerte! 🍀',
    dropped: '¡Buu! Un ase te ha pillado y se te ha caído la pomada',
    rear: '¡Ahora! Tócalo',
    perfect: '¡Toque perfecto! ✨🍀',
    late: 'Uy, por los pelos 🍀',
    allLuck: '¡Tres toques de suerte! La plaza entera te aplaude 👏',
  },
};

export const ROAD = {
  intro: [
    { who: 'Narrador', text: 'Unos meses después. Madrid, primera hora de la mañana.' },
    { who: 'Gas', text: 'Coche cargado, Joy en el asiento de atrás y 400 kilómetros hasta el mar. ¿Lista, Azul?' },
    { who: 'Azul', text: 'Lista. Pero conduzco yo, que tú te pierdes.' },
    { who: 'Narrador', text: 'Desliza el dedo (o toca ◀ ▶) para cambiar de carril. Recoge fotos del viaje 📸 y esquiva lo que se cruce.' },
    { who: 'Gas', text: 'Los ⛽ dan turbo. Y si ves tabaco 🚬 por la carretera… ni se te ocurra, Azul.' },
  ] as Line[],
  regions: {
    madrid: 'Saliendo de Madrid',
    meseta: 'La meseta castellana',
    cantabria: 'Cantabria: verde, verde y más verde',
    rioja: 'Camino de Logroño, entre viñedos',
  },
  arriveSV: [
    { who: 'Narrador', text: 'San Vicente de la Barquera. El puente, el castillo, el mar… y un olor a plancha que no se puede aguantar.' },
    { who: 'Gas', text: 'En El Ancla ponen las mejores zamburiñas del Cantábrico. Y el cocinero dice que, si las hacemos nosotros, invita él.' },
    { who: 'Narrador', text: 'Toca cada zamburiña cuando esté dorada. Si se quema… Buu.' },
  ] as Line[],
  zambDone: [
    { who: 'Gas', text: 'Las mejores zamburiñas de mi vida. ¿Cómo se dice zamburiña en inglés?' },
    { who: 'Azul', text: 'Scallop.' },
    { who: 'Gas', text: '¿Escalope? ¿Como el de la carne? Los ingleses están fatal.' },
    { who: 'Azul', text: 'El que está fatal eres tú. Venga, que nos queda Logroño.' },
  ] as Line[],
  arriveLogrono: [
    { who: 'Narrador', text: 'Logroño. Calle Laurel, un pincho en cada bar y un vino en cada pincho.' },
    { who: 'Gas', text: 'Por el mejor viaje. Y por la copiloto… digo, la conductora.' },
    { who: 'Joy', text: '¡Guau!' },
  ] as Line[],
  terrace: [
    { who: 'Narrador', text: 'La terraza de El Ancla, en San Vicente. Las zamburiñas que nunca se os van a olvidar.' },
    { who: 'Gas', text: 'Pide tú, que a mí no me entienden.' },
    { who: 'Narrador', text: 'Cómete una zamburiña.' },
  ] as Line[],
  terraceDone: [
    { who: 'Azul', text: 'Mmm… Siguen siendo las mejores.' },
    { who: 'Gas', text: 'Pues ahora, a Logroño. Que el vino no se bebe solo.' },
    { who: 'Joy', text: '¡Guau! (Joy también quiere una)' },
  ] as Line[],
  hit: ['¡Buu!', '¡Buu! Cuidado', '¡Buu buu!'],
  smoke: ['Gas: «Azul, ¿otra vez? ¡Que lo tienes que dejar!» 🚭', 'Gas: «Eso no es una foto, es un paquete de tabaco…» 🚭', 'Gas: «Te lo requisó. Por tu bien.» 🚭'],
  turbo: '¡Gasolina! ⛽ Turbo',
  nearMiss: '¡Por los pelos! +1 📸',
  combo: (n: number) => `¡Racha de ${n} fotos! Joy está flipando 🐶`,
  stops: ['Madrid', 'San Vicente', 'Logroño'],
  zamb: { served: '¡Al plato! 😋', burnt: '¡Buu! Quemada', raw: 'Todavía está cruda' },
};

export const CONCERT = {
  intro: [
    { who: 'Narrador', text: 'Canarias. Noche de verano y concierto de Fito al aire libre.' },
    { who: 'Narrador', text: 'Gas ha ido a por bebidas hace veinte minutos y no ha vuelto.' },
    { who: 'Azul', text: 'Este hombre se pierde hasta en un pasillo. Voy a buscarlo.' },
    { who: 'Narrador', text: 'Pregunta en la barra.' },
  ] as Line[],
  barman: [
    { who: 'Camarero', text: '¿Un chico moreno? Ha estado aquí intentando pedir a una pareja de ingleses…' },
    { who: 'Camarero', text: 'Les ha dicho “Uan bir, plis, and tu for mai guaif”. Los ingleses todavía se están riendo.' },
    { who: 'Camarero', text: 'Se fue hacia el escenario, por la izquierda.' },
    { who: 'Azul', text: 'Vale. Pero antes… baño. Con tanta cerveza no llego a la primera fila.' },
    { who: 'Narrador', text: 'Los WC portátiles están a la derecha. Busca uno con la luz verde.' },
  ] as Line[],
  barmanAgain: [{ who: 'Camarero', text: '¿Otra vez tú? Los baños, a la derecha. Y Gas, hacia el escenario.' }] as Line[],
  wcBusy: ['🚫 Ocupado. Alguien canta «Soldadito marinero» dentro…', '🚫 Ocupado. Busca la luz verde', '🚫 Toc, toc… «¡Ocupadooo!»'],
  wcBack: ['🚻 1/4 · Uf, qué alivio. Vuelve al concierto', '🚻 2/4 · Vuelve al concierto, que te lo pierdes', '🚻 3/4 · El de seguridad ya te saluda. Al concierto'],
  wcAgain: ['¡Otra vez al baño! 🚻 Las cervezas de Gas…', '¿Otra vez? 🚻 Esto es culpa de Gas', 'La última, prometido 🚻'],
  wcDone: [
    { who: 'Azul', text: 'Cuatro veces. Récord personal. Ahora sí: ¿dónde se ha metido este hombre?' },
    { who: 'Narrador', text: 'Gas está en primera fila, a la izquierda. Ábrete paso entre la multitud… y cuidado con los empujones.' },
  ] as Line[],
  pushes: ['¡Empujón! 😵', '¡Perdona, perdona!', '¡Uy, un pogo! 🤘', '¡Que no veo a Fito!', '¡Sin empujar, eh!'],
  smokeFound: '🚭 ¡A la papelera! Gas va a estar orgulloso',
  gasFound: [
    { who: 'Gas', text: '¡Azul! Te he guardado sitio en primera fila. Las cervezas… es una historia larga.' },
    { who: 'Azul', text: 'Ya me la ha contado el camarero. “And tu for mai guaif”.' },
    { who: 'Gas', text: 'Buu. Bueno, ¡que empieza! Esta me la sé entera.' },
  ] as Line[],
  gasSmoke: { who: 'Gas', text: 'Por cierto… ¿has tirado el tabaco? ¡Esa es mi chica!' } as Line,
  gasNoSmoke: { who: 'Gas', text: 'Por cierto, ¿no estarás fumando, eh? Que lo tienes que dejar…' } as Line,
  rhythm: 'Toca los botones cuando las notas lleguen a la línea',
  ending: [
    { who: 'Narrador', text: 'Las luces, la guitarra, miles de personas cantando… y vosotros dos en medio.' },
    { who: 'Gas', text: 'Oye, Azul. Gracias por todo esto. Por Ferreries, por la carretera, por esta noche.' },
    { who: 'Azul', text: 'Calla, que me vas a hacer llorar. Buu.' },
    { who: 'Gas', text: 'Pues prepárate, que esto no ha terminado…' },
  ] as Line[],
};

export const NIGHT = {
  bar: [
    { who: 'Narrador', text: 'Una noche de verano. Azul sale del Bar Imperi y, en la calle, la espera un coche con las luces puestas.' },
    { who: 'Gas', text: '¡Azul! Sube, que te llevo.' },
    { who: 'Azul', text: '¿A dónde?' },
    { who: 'Gas', text: 'A casa. Tengo piscina.' },
    { who: 'Azul', text: 'Buu. …Vale.' },
  ] as Line[],
  drive: [
    { who: 'Gas', text: '¿Te has dejado el tabaco en el bar? Dime que sí, porfa.' },
    { who: 'Azul', text: 'Conduce y calla, Gas.' },
    { who: 'Narrador', text: 'Ventanillas bajadas, la música bajita y olor a verano.' },
  ] as Line[],
  arrive: [
    { who: 'Gas', text: 'Ya estamos. Pasa, que Joy lleva toda la noche esperándote.' },
    { who: 'Joy', text: '¡Guau! ¡Guau! (detrás de la puerta, moviendo la cola)' },
  ] as Line[],
  intro: [
    { who: 'Narrador', text: 'Ya en casa. Hace calor, la piscina está iluminada y Joy no deja de dar vueltas.' },
    { who: 'Gas', text: 'Azul, he puesto velitas flotando en la piscina. ¿Te bañas?' },
    { who: 'Azul', text: '¿Velitas? ¿Tú? ¿Quién eres y qué has hecho con Gas?' },
    { who: 'Narrador', text: 'Baja al jardín y tírate a la piscina.' },
  ] as Line[],
  swim: [
    { who: 'Gas', text: '¡Recoge las seis velitas antes de que Joy se tire a por ellas!' },
  ] as Line[],
  swimDone: [
    { who: 'Gas', text: 'Esta noche hay lluvia de estrellas. ¿Nos tumbamos en el césped a verlas?' },
    { who: 'Azul', text: 'Vale, pero las toallas las pones tú.' },
    { who: 'Joy', text: '¡Guau! (Joy ya está tumbada encima de una toalla)' },
  ] as Line[],
  lie: [
    { who: 'Gas', text: 'Mira, allí… ¿ves esas estrellas? Si las unes, sale algo.' },
    { who: 'Narrador', text: 'Toca las estrellas en orden, empezando por la que parpadea.' },
  ] as Line[],
  starsDone: [
    { who: 'Azul', text: '…Es un corazón.' },
    { who: 'Gas', text: 'Lo he dibujado yo. Bueno, el universo. Pero la idea fue mía.' },
    { who: 'Narrador', text: 'Una estrella fugaz cruza el cielo.' },
    { who: 'Gas', text: '¡Pide un deseo, rápido!' },
    { who: 'Azul', text: 'Ya lo tengo todo. Bueno… que aprendas inglés.' },
    { who: 'Gas', text: 'Buu. Feliz cumpleaños, Azul. 💙' },
  ] as Line[],
  candle: (n: number) => `🕯️ ${n}/6`,
};

// Carta del regalo final. Marc: reescríbela con tus palabras.
export const FINAL_LETTER = {
  title: 'Feliz cumpleaños, Azul',
  paragraphs: [
    'Empezamos entre ases y pomadas en Ferreries, seguimos por carretera hasta las zamburiñas de San Vicente y acabamos cantando a Fito bajo las estrellas de Canarias.',
    'Gracias por cada kilómetro, por reírte de mi inglés y por aguantar mis bailes. Y por los “Buu”, que también te quiero por ellos.',
    'Joy y yo te deseamos el mejor 28 de octubre. Y que dejes de fumar, que lo sepas.',
  ],
  signature: 'Te quiere, Gas 💙 (y Joy 🐾)',
};
