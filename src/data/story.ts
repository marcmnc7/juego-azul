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
  { id: 1, name: 'Jaleo d’ases', place: 'Ferreries, 25 de agosto de 2025', emoji: '🫏' },
  { id: 2, name: 'La piscinita', place: 'Sa Caleta, la noche siguiente', emoji: '🌙' },
  { id: 3, name: 'La ruta de las zamburiñas', place: 'Atocha → San Vicente de la Barquera → Logroño', emoji: '🚗' },
  { id: 4, name: 'Fito bajo las estrellas', place: 'Estadio de Gran Canaria, marzo de 2026', emoji: '🎸' },
  { id: 5, name: 'Sant Joan', place: 'Ciutadella, junio de 2026', emoji: '🐎' },
  { id: 6, name: 'Cena a escondidas', place: 'Sa Farola, 13 de julio de 2026', emoji: '🍝' },
];

export const FERRERIES = {
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 de agosto de 2025, Sant Bartomeu. Es ases son a las once.' },
    { who: 'Narrador', text: 'Tú has subido con tus amigas. Él lleva una pomada de más. Todavía no os conocéis.' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Primera vegada al jaleo? Dues regles: pomada a la mà i, quan un ase s’aixeca, el toques. Dona sort.' },
    { who: 'Tòfol', text: 'Tres pomadas y tres toques. Y si un ase te pilla, se te cae el vaso.' },
  ] as Line[],
  tofolNotYet: [{ who: 'Tòfol', text: 'Encara no. Pomadas y ases, que el jaleo no espera.' }] as Line[],
  tofolDone: [
    { who: 'Tòfol', text: 'Ja ets de Ferreries.' },
    { who: 'Tòfol', text: 'Y aquel de Sa Plaça que baila tan mal no te quita el ojo. Llévale una pomada, a ver qué pasa.' },
  ] as Line[],
  marcMeet: [
    { who: 'Marc', text: '…' },
    { who: 'Marc', text: 'Margaux. Increíble.' },
    { who: 'Margaux', text: 'Vas un poco borracho, ¿no?' },
    { who: 'Marc', text: 'Un poco. No cuenta. Esta noche, cuando llegues a Ciutadella, avísame.' },
  ] as Line[],
  afterKiss: [
    { who: 'Narrador', text: 'Esa misma tarde, 19:46.' },
    { who: 'Margaux', text: '(WhatsApp) Holaaaaa' },
    { who: 'Margaux', text: '(WhatsApp) Aquí estoyyy' },
    { who: 'Marc', text: '(WhatsApp) Ets a Ciutadella? Te vengo a buscar' },
    { who: 'Marc', text: '(WhatsApp) Margaux increíble' },
    { who: 'Marc', text: '(WhatsApp) Need esos ojos' },
    { who: 'Margaux', text: '(WhatsApp) 🫠🫠🫠' },
    { who: 'Marc', text: '(WhatsApp) Vienes a nadar??????????' },
    { who: 'Margaux', text: '(WhatsApp) ¿Ahora?! Estoy cenando' },
    { who: 'Margaux', text: '(WhatsApp) ¿Tienes piscina???' },
    { who: 'Marc', text: '(WhatsApp) Para ti sí' },
    { who: 'Margaux', text: '(WhatsApp) Ves a dormir. Nos vemos otro día' },
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

// Capítulo 5: Sant Joan en Ciutadella (junio de 2026). Buscar a Gas por sus ubicaciones entre caballos y avellanes.
export const SANTJOAN = {
  huntIntro: [
    { who: 'Narrador', text: 'Ciutadella. 23 de junio de 2026, las dos de la mañana. Mañana es Sant Joan y lleváis días sin entenderos.' },
    { who: 'Azul', text: '(WhatsApp) Lo que no me cabe en la cabeza es lo mucho que yo te quiero cerca' },
    { who: 'Gas', text: '(WhatsApp) No sé explicarlo ni decirlo de otra manera' },
    { who: 'Azul', text: '(WhatsApp) Yo quiero que lo sea porque yo te quiero' },
    { who: 'Azul', text: '(WhatsApp) Yo creo solo que aquí hay algo muy bonito. Y tengo miedo de que se eche a perder todo' },
    { who: 'Gas', text: '(WhatsApp) Eres espectacular y la persona más afín a mí que he conocido nunca' },
    { who: 'Azul', text: '(WhatsApp) Mañana es Sant Joan' },
    { who: 'Gas', text: '(WhatsApp) Me la sopla Sant Joan. Mañana a las 10.45 estoy ahí' },
    { who: 'Gas', text: '(WhatsApp) Te quiero' },
    { who: 'Narrador', text: 'A las 10.45 está ahí. A las cinco sale la bandera y os perdéis entre el pueblo entero.' },
    { who: 'Gas', text: '(WhatsApp) Acéptame la UBI' },
    { who: 'Azul', text: '(WhatsApp) Tuuuu maldito' },
  ] as Line[],
  exactHint: 'Mándale tu ubicación exacta 📍',
  sentLoc: '📍 Azul: «¿Dónde estássss?»',
  marcMeet: [
    { who: 'Gas', text: 'Treinta minutos dando vueltas. Te he dicho exacto.' },
    { who: 'Azul', text: 'Y yo te he mandado la ubi. Ven aquí.' },
    { who: 'Narrador', text: 'Suena el fabiol. Los caballos entran en el Born.' },
  ] as Line[],
  afterKiss: [
    { who: 'Narrador', text: '24 de junio. Gas se pasa el día con tu camiseta puesta.' },
    { who: 'Gas', text: '(WhatsApp) Top la cami' },
    { who: 'Azul', text: '(WhatsApp) ¿Te dijeron cosas?' },
    { who: 'Gas', text: '(WhatsApp) Tod@s' },
    { who: 'Azul', text: '(WhatsApp) Tendrán sospechas, supongo' },
    { who: 'Azul', text: '(WhatsApp) Quizás me escondes muy bien' },
    { who: 'Gas', text: '(WhatsApp) Muy difícil, sí… Deslumbras' },
  ] as Line[],
  hints: {
    pomada: '¡Avellanes! 🌰',
    luck: '¡Toque de suerte! 🐎',
    dropped: '¡Buu! Un caballo te ha pillado y se te han caído las avellanes',
    rear: '¡Ahora! Tócalo',
    perfect: '¡Toque perfecto! ✨🐎',
    late: 'Uy, por los pelos 🐎',
    allLuck: '¡Tres caballos! El Born entero te aplaude 👏',
  },
  /** Mensajes de ubicación de Gas mientras le buscas (para la versión con pins que se mueven). */
  pins: [
    '📍 Gas: «Finito bandera ya. Ve pa’l Born»',
    '📍 Azul: «Vamos Correos»',
    '📍 Gas: «Llevo 30’ dando vueltas»',
    '📍 Gas: «Dime exacto pls»',
  ],
  pinHint: 'Sigue la última ubi de Gas en el mapa 📍',
  /** Cuando te acercas, Gas se va a otro sitio (las dos primeras veces). */
  gasMoves: ['Gas: «No te he visto. Vuelvo» 📍', 'Gas: «Acéptame la UBI… que ya no estoy aquí» 📍'],
};

export const ROAD = {
  intro: [
    { who: 'Narrador', text: '30 de octubre de 2025. Dos meses sin veros. Él ha propuesto el plan; tú has dicho que sí sin saber adónde.' },
    { who: 'Marc', text: '(WhatsApp) MUY JUSTO aún no sé. Toy semáforo y el tren lo tengo en 7’' },
    { who: 'Margaux', text: '(WhatsApp) A ver si el destino está de nuestra parte' },
    { who: 'Marc', text: '(WhatsApp) Estoy. No me lo creo, que justo. Estoy CHORREANDO' },
    { who: 'Margaux', text: '(WhatsApp) Tampoco tuve tiempo de comprar el helado…' },
    { who: 'Marc', text: '(WhatsApp) Eso sí que no te lo podré perdonar' },
    { who: 'Margaux', text: '(WhatsApp) Te invito a una cerve. O un vino. O una Coca-Cola' },
    { who: 'Marc', text: '(WhatsApp) A una langosta' },
    { who: 'Margaux', text: '(WhatsApp) Muy bien. Humilde. Me gusta' },
    { who: 'Marc', text: '(WhatsApp) Aparcao' },
    { who: 'Marc', text: '(WhatsApp) En posición' },
    { who: 'Narrador', text: 'El pacto era: si no llueve, moto. Si llueve, coche. Llueve. Conduces tú.' },
  ] as Line[],
  regions: {
    madrid: 'Saliendo de Madrid (sin helado)',
    meseta: 'La meseta. Caminitos, no solo autopista',
    cantabria: 'Cantabria: verde, verde y más verde',
    rioja: 'La Rioja',
  },
  arriveSV: [
    { who: 'Narrador', text: 'San Vicente de la Barquera.' },
    { who: 'Marc', text: 'Nos han habilitado aparcamiento especial. Y aparcacoches. Somos VIP.' },
  ] as Line[],
  zambDone: [
    { who: 'Marc', text: 'No habrá mejor zamburiña en el mundo que la de San Vicente.' },
  ] as Line[],
  arriveLogrono: [
    { who: 'Narrador', text: 'La última noche iba a ser cenita de camping: estrellas, cartas y el camping gas.' },
    { who: 'Narrador', text: 'Se os olvidó precisamente el gas.' },
    { who: 'Narrador', text: '3 de noviembre, 6:01. Él ya va en el primer tren a Barcelona.' },
    { who: 'Margaux', text: '(WhatsApp) Ojalá todos los findes improvisados salieran así!! Gracias por hacer esta apuesta conmigo' },
    { who: 'Narrador', text: 'Tres días después.' },
    { who: 'Margaux', text: '(WhatsApp) Bonanit gass' },
    { who: 'Marc', text: '(WhatsApp) ¿¿Por qué Gas???' },
    { who: 'Margaux', text: '(WhatsApp) Cómo que por qué gassss. Por nuestro intento fallido de camping gas y tu dedicación a la aventura' },
    { who: 'Margaux', text: '(WhatsApp) Ya te dije que iba a ser tu nombre' },
    { who: 'Marc', text: '(WhatsApp) Pues entre las facturas del gas aparecerá Azul' },
  ] as Line[],
  terrace: [
    { who: 'Narrador', text: 'La terraza de El Ancla.' },
  ] as Line[],
  terraceDone: [
    { who: 'Margaux', text: 'Déjalo.' },
  ] as Line[],
  hit: ['¡Buu!', '¡Buu! Cuidado', '¡Buu buu!', 'Marc: «Como negocias, eh»'],
  smoke: ['Marc: «¿Otra vez?» 🚭', 'Marc: «Eso no es una foto, es un paquete de tabaco…» 🚭', 'Marc: «Te lo requiso. Por tu bien.» 🚭'],
  turbo: '¡Gasolina de 98 octanos! ⛽ Turbo',
  nearMiss: '¡Por los pelos! +1 📸',
  combo: (n: number) => `¡Racha de ${n} fotos! 📸`,
  stops: ['Madrid', 'San Vicente', 'Logroño'],
  zamb: { served: '¡Al plato! Déjalo 😋', burnt: '¡Buu! Quemada', raw: 'Todavía está cruda' },
};

export const CONCERT = {
  barmanAgain: [{ who: 'Camarero', text: '¿Otra? Tu chico lleva un rato en la cola del baño.' }] as Line[],
  smokeFound: '🚭 ¡A la papelera! Gas va a estar orgulloso',
  gasFound: [
    { who: 'Gas', text: '¡Azul!' },
    { who: 'Azul', text: 'Te he grabado el temón. Don’t worry.' },
  ] as Line[],
  gasSmoke: { who: 'Gas', text: '¿Y el tabaco? ¿A la papelera? Esa es mi Azul.' } as Line,
  gasNoSmoke: { who: 'Gas', text: '¿No estarás fumando, eh?' } as Line,
  airport: [
    { who: 'Narrador', text: '12 de marzo de 2026. Él vuela desde Barcelona; tú, una hora después desde Madrid. Destino: Gran Canaria, Fito.' },
    { who: 'Azul', text: '(WhatsApp) Gasssss estoy demasiado emocionada' },
    { who: 'Gas', text: '(WhatsApp) Qué puto asco el burger. NUNCA más' },
    { who: 'Gas', text: '(WhatsApp) Todo malo y caro, hasta la Fanta' },
    { who: 'Gas', text: '(WhatsApp) Me han cambiado el asiento. Ahora 3B' },
    { who: 'Azul', text: '(WhatsApp) Yo tengo 26D. 26 palo pero D top ✨pasillo✨' },
  ] as Line[],
  airportHint: 'Esquiva la hamburguesa del aeropuerto 🍔 y llega a la puerta',
  burgerHit: ['🍔 ¡Plaf! NUNCA más', '🍔 Todo malo y caro, hasta la Fanta', '🍔 Gas ya te lo avisó', '🍔 26D ✨pasillo✨… pero con kétchup'],
  queueIntro: [
    { who: 'Narrador', text: '13 de marzo. Estadio de Gran Canaria. Fito a punto de salir y Gas se va al baño.' },
    { who: 'Gas', text: '(WhatsApp) Toy cola lavabos ya' },
    { who: 'Gas', text: '(WhatsApp) Pfffff temón' },
  ] as Line[],
  queueCut: ['¡Que se cuela! ✋', '¡Eh, que estábamos antes!', '«Solo voy a lavarme las manos»… sí, claro', '¡Ni de broma! ✋'],
  queueDone: '🚻 ¡Por fin! (¿Ese que ha entrado al baño era Fito?)',
  queueJoin: '🧍 Con Gas en la cola. «Pfffff temón»',
  queueCutIn: ['😤 Se os ha colado uno', '😤 «Es que voy con mi amiga, que está ahí delante»', '😤 Colado. Y fuera, el temón'],
  filmIntro: [
    { who: 'Azul', text: '(WhatsApp) Noooo. Qué penaaaa' },
    { who: 'Azul', text: '(WhatsApp) Hize vídeo don’t worry' },
  ] as Line[],
  filmDone: '🎥 Vídeo guardado. Para Gas',
  flashIntro: [
    { who: 'Narrador', text: 'Gas sale del baño. Se ha hecho de noche y hay miles de personas.' },
    { who: 'Gas', text: '(WhatsApp) Flash' },
    { who: 'Gas', text: '(WhatsApp) Pls' },
    { who: 'Gas', text: '(WhatsApp) Estoy' },
    { who: 'Gas', text: '(WhatsApp) Xo no veo' },
  ] as Line[],
  flashHint: 'Enciende el flash cuando Gas mire hacia ti',
  flashHit: ['📱 «Flash» ¡Te ha visto!', '📱 «Pls» Viene hacia ti…', '📱 «Estoy» ¡Ya casi!', '📱 «Xo no veo»… ¡ya sí!'],
  flashWrong: ['Ese no era tu flash… 🙃', 'Gas se va hacia una señora con linterna', '¡Ahora no, que mira al otro lado!'],
  flashFound: [
    { who: 'Gas', text: 'Ahí estás.' },
    { who: 'Azul', text: 'Te he grabado el temón. Me debes una.' },
  ] as Line[],
  rhythm: 'Toca los botones cuando las notas lleguen a la línea',
  ending: [
    { who: 'Narrador', text: '16 de marzo. Aeropuerto. Él sale antes.' },
    { who: 'Gas', text: '(WhatsApp) Ha ido súper, ¡no se puede estar triste!!!!' },
    { who: 'Azul', text: '(WhatsApp) Ya sé, ha sido top' },
    { who: 'Azul', text: '(WhatsApp) Pero no quiero no verte' },
    { who: 'Gas', text: '(WhatsApp) Tengo que pasar esta resaca emocional' },
    { who: 'Azul', text: '(WhatsApp) Hablar mal del finde es IMPOSIBLE cuando todo lo que fuimos fue icónico' },
  ] as Line[],
};

export const NIGHT = {
  bar: [
    { who: 'Narrador', text: 'Ciutadella, 26 de agosto de 2025. Al día siguiente de Ferreries.' },
    { who: 'Marc', text: '(WhatsApp) Pues we have a problema… ¡porque me voy mañana!' },
    { who: 'Margaux', text: '(WhatsApp) ¿Y me lo dices así?! Yo pensaba verte otra vez' },
    { who: 'Marc', text: '(WhatsApp) Nos podemos «despedir» si quieres aún. No habrá otro chanceeee' },
    { who: 'Margaux', text: '(WhatsApp) Pues ahora estoy en el Imperi. Sigo aún con la cola' },
    { who: 'Marc', text: '(WhatsApp) Ir a ver esa peli, lanzarnos al mar y resfriarnos… o nadar en secreto y silencio en esa pisci. Dependiendo de lo aventurera que seas' },
    { who: 'Margaux', text: '(WhatsApp) ¿Por dónde sería esa piscina?' },
    { who: 'Marc', text: '(WhatsApp) Si nos colamos en la municipal me detienen y pierdo el vuelo de mañana. Mejor la de casa' },
    { who: 'Marc', text: '(WhatsApp) Muy pequeñita ella pero sí, funciona' },
    { who: 'Marc', text: '(WhatsApp) Condición: silencio full, que están mis padres durmiendo' },
    { who: 'Margaux', text: '(WhatsApp) Vale, entendido jefe 😇' },
    { who: 'Marc', text: '(WhatsApp) Arranco!' },
  ] as Line[],
  drive: [
    { who: 'Marc', text: '(WhatsApp) Ve hacia Pins' },
    { who: 'Marc', text: '(WhatsApp) Creo que te he visto. Patrássss' },
    { who: 'Margaux', text: '(WhatsApp) ¿Coche? ¿Moto?' },
    { who: 'Marc', text: '(WhatsApp) Coche azul. Gira' },
    { who: 'Narrador', text: 'Te subes con un chiste de Uber. Él todavía se ríe.' },
  ] as Line[],
  arrive: [
    { who: 'Marc', text: '(susurrando) Silencio full.' },
  ] as Line[],
  intro: [
    { who: 'Narrador', text: 'Sa Caleta. La casa duerme. La piscinita, pequeñita, funciona.' },
  ] as Line[],
  swim: [
    { who: 'Marc', text: '(susurrando) Shhh.' },
  ] as Line[],
  swimDone: [
    { who: 'Narrador', text: 'Os tumbáis en el césped. Esa oscuridad tenebre.' },
  ] as Line[],
  lie: [
    { who: 'Narrador', text: 'Toca las estrellas, empezando por la que parpadea.' },
  ] as Line[],
  starsDone: [
    { who: 'Narrador', text: 'Esa noche, 01:01. Él ya en casa; tú también.' },
    { who: 'Marc', text: '(WhatsApp) Aún no me lo puedo creer' },
    { who: 'Marc', text: '(WhatsApp) Qué poco me esperaba esto hoy' },
    { who: 'Margaux', text: '(WhatsApp) Soy una mujer con muchas sorpresas' },
    { who: 'Margaux', text: '(WhatsApp) Me caíste bien, borracho y sobrio. 10/10' },
    { who: 'Margaux', text: '(WhatsApp) Tb el césped con vista estrellas 10/10 💫' },
    { who: 'Marc', text: '(WhatsApp) Me voy a quedar sobre todo con tu chiste inicial del Uber' },
    { who: 'Marc', text: '(WhatsApp) Es broma. Con tus ojazos' },
    { who: 'Marc', text: '(WhatsApp) Por aquí todo parece correcto. Siguen roncando' },
    { who: 'Margaux', text: '(WhatsApp) Solo el césped sabe qué pasó' },
    { who: 'Margaux', text: '(WhatsApp) Me gustas tú' },
    { who: 'Marc', text: '(WhatsApp) 😳😳😳' },
    { who: 'Marc', text: '(WhatsApp) Ahí te ha quedado bien. Admito.' },
  ] as Line[],
  candle: (n: number) => `🕯️ ${n}/6`,
  sneakHint: 'Silencio full: despacio y por las losas, que la grava cruje',
  lightOn: '💡 Se ha encendido una luz arriba… ¡quieta!',
  caught: [
    { who: 'Narrador', text: 'Se enciende una ventana. Os quedáis quietos sin respirar… y se apaga.' },
    { who: 'Marc', text: '(susurrando) Otra vez. Y ahora sí: silencio full.' },
  ] as Line[],
};

// Crucigrama antes de la carta: la vuelta del que Azul le hizo a Gas (MARGAUX, PORTUGAL…).
// Las letras marcadas, en orden, forman el mensaje escondido.
// Capítulo nuevo (si Marc lo elige): la cena a escondidas en casa de los padres de Azul, 13 de julio de 2026.
export const CENA = {
  intro: [
    { who: 'Narrador', text: 'Sa Farola, 13 de julio de 2026. Casi un año después de la piscinita. Ahora la casa es la de tus padres.' },
    { who: 'Gas', text: '(WhatsApp) Si quieres a las 9 ya estoy por la zona. A la que me digas go, entro y hago hasta las 22.50' },
    { who: 'Gas', text: '(WhatsApp) A partir de las 22.50 yo lo pasaré mal' },
    { who: 'Azul', text: '(WhatsApp) ¿Qué cocinamos?' },
    { who: 'Gas', text: '(WhatsApp) Todo esto lo hago por una pasta' },
    { who: 'Azul', text: '(WhatsApp) Carbonara muy pesada' },
    { who: 'Gas', text: '(WhatsApp) 🙄' },
    { who: 'Azul', text: '(WhatsApp) Venga vale, carbo. Guanciale no está cada día en casa' },
    { who: 'Gas', text: '(WhatsApp) Bacon iba bien si tenías' },
    { who: 'Azul', text: '(WhatsApp) Qué dices' },
  ] as Line[],
  waitIntro: [
    { who: 'Gas', text: '(WhatsApp) Voy tirando' },
    { who: 'Azul', text: '(WhatsApp) Nooo. Wait. Aún están' },
    { who: 'Azul', text: '(WhatsApp) Hay una situación rara, apárcate más adelante' },
    { who: 'Gas', text: '(WhatsApp) Estoy en un lugar estratégico. Cuando me digas voy y tardo 30 sec' },
  ] as Line[],
  waitEvents: ['Sale mi padre ahora…', 'No. Jdr. ¿Qué hace mi padre?', 'Se ha dejado algo. Vuelve a entrar…', 'Mi madre busca las llaves…'],
  tooSoon: [
    { who: 'Gas', text: '(WhatsApp) A ver QUÉ. Pero no apures tanto' },
    { who: 'Gas', text: '(WhatsApp) No viene de 2’' },
  ] as Line[],
  comeIn: [
    { who: 'Azul', text: '(WhatsApp) Ya sí. Ven. Ahora sí' },
    { who: 'Gas', text: '(WhatsApp) Voy pumpeado' },
  ] as Line[],
  cookIntro: [
    { who: 'Gas', text: 'Venga. A ver esas carbonaras tuyas. Ya sabes que el 10 es la carbonara.' },
    { who: 'Azul', text: 'Mira y aprende. Nada de nata.' },
  ] as Line[],
  steps: {
    guanciale: 'Toca cuando el guanciale esté dorado 🥓',
    pasta: 'Escurre la pasta al dente ⏱️',
    mix: 'Mezcla fuera del fuego: que no se cuaje 🥚',
    nata: 'Gas: «¿Con nata? ¿Estamos locos o qué?»',
    scrambled: '¡Buu! Huevos revueltos',
    burnt: '¡Buu! Guanciale quemado',
    raw: 'Todavía está dura',
  },
  grade: (n: number) =>
    n >= 10 ? 'Gas: «Un 10. El 10 es la carbonara.»'
    : n >= 9 ? `Gas: «Un ${n}. Casi casi.»`
    : n >= 7 ? `Gas: «Un ${n}. Regulín.»`
    : `Gas: «Un ${n}…» Azul: «No acepto. Otra vez.»`,
  dinner: [
    { who: 'Gas', text: 'Déjalo.' },
    { who: 'Narrador', text: 'Cenáis con un ojo en la puerta y otro en el reloj.' },
  ] as Line[],
  leave: [
    { who: 'Narrador', text: '22:50. Gas sale justo a tiempo. Él apuesta a que vuelven a las 00:15; tú, a las 00:30.' },
    { who: 'Narrador', text: '23:49. Ya estás en la cama. Coges el móvil.' },
    { who: 'Azul', text: '(WhatsApp) Me gustó mucho cenar contigo hoy' },
    { who: 'Azul', text: '(WhatsApp) Quería decirte que te quiero' },
    { who: 'Azul', text: '(WhatsApp) Poc a poc se me quitará la tontería de no decirte las cosas' },
  ] as Line[],
};

// Epílogo antes del crucigrama: un año después, otra vez en el Jaleo de Ferreries.
export const EPILOGUE = {
  title: 'Un año después',
  place: 'Ferreries, 25 de agosto de 2026',
  lines: [
    { who: 'Narrador', text: 'Ferreries, 25 de agosto de 2026. Sant Bartomeu otra vez.' },
    { who: 'Gas', text: '(WhatsApp) Es ases son a las 11' },
    { who: 'Narrador', text: 'A media tarde os buscáis entre la gente, ubicación va, ubicación viene. Como siempre.' },
    { who: 'Gas', text: '(WhatsApp) Tengo bocata' },
    { who: 'Gas', text: '(WhatsApp) Y patatas' },
    { who: 'Azul', text: '(WhatsApp) Estoy' },
    { who: 'Narrador', text: 'Unos días antes él había hecho cuentas.' },
    { who: 'Gas', text: '(WhatsApp) Solo te he visto 22 veces' },
    { who: 'Azul', text: '(WhatsApp) Pero no solo son el número de las veces que cuentan…' },
    { who: 'Gas', text: '(WhatsApp) Horas llevo 203' },
    { who: 'Narrador', text: 'Y dos días después:' },
    { who: 'Azul', text: '(WhatsApp) ¿Tenemos fecha nosotros?' },
    { who: 'Gas', text: '(WhatsApp) Es muy bonito no tener fecha porque todo el mundo tiene' },
    { who: 'Azul', text: '(WhatsApp) Pesado' },
    { who: 'Gas', text: '(WhatsApp) No entiendes la vibra' },
    { who: 'Azul', text: '(WhatsApp) Tú ni la viste la vibra' },
  ] as Line[],
};

export interface CrossClue {
  clue: string;
  answer: string;
  /** Posición (desde 0) de la letra marcada. */
  mark: number;
}

export const CROSSWORD = {
  title: 'El crucigrama de Gas',
  intro: 'Tú me hiciste uno con MARGAUX, un boli de tinta invisible y PORTUGAL escondido. Ahora me toca a mí. Las letras marcadas esconden algo.',
  hidden: 'TE QUIERO',
  clues: [
    { clue: 'La peli que nunca terminamos', answer: 'INTERSTELLAR', mark: 2 },
    { clue: "Jaleo d'… (Ferreries, a las once)", answer: 'ASES', mark: 2 },
    { clue: 'Le ganó a 🚬 en tu ranking (por los pelos)', answer: 'QUEVEDO', mark: 0 },
    { clue: 'Cómo quiero que te llame todo el mundo', answer: 'AZUL', mark: 2 },
    { clue: 'Bar de Ciutadella donde te recogí aquella noche', answer: 'IMPERI', mark: 0 },
    { clue: 'Lo que vimos el 12 de agosto, sin cruzar la bocana', answer: 'ECLIPSE', mark: 0 },
    { clue: 'Lo único que saca un 10 (sin nata, por favor)', answer: 'CARBONARA', mark: 2 },
    { clue: 'El intensito que duerme contigo la noche antes de irte', answer: 'JOY', mark: 1 },
  ] as CrossClue[],
  solved: '¡Te quiero! Ahora sí, abre la carta.',
};

// Carta del regalo final. Marc: reescríbela con tus palabras.
export const FINAL_LETTER = {
  title: 'Feliz cumpleaños, Azul',
  paragraphs: [
    'El 25 de agosto de 2025 un borracho con una pomada de más te dijo que tenías unos ojos increíbles. Al día siguiente me iba. «No habrá otro chance», te dije. Y lo hubo: un Imperi con Coca-Cola, un coche azul cerca de Pins, una piscina en silencio y un césped que es el único que sabe lo que pasó.',
    'Después vinieron 1.454 km con la lluvia ganándole a la moto, las zamburiñas de San Vicente y un gas de camping que se quedó en casa y me dio nombre. Vino Fito, y el aeropuerto donde me dijiste que no querías no verme. Vino una noche de junio a las dos de la mañana en la que casi lo rompemos todo, y a las 10.45 estaba ahí. Y vino un 23:49 en el que me escribiste que me querías.',
    'Me preguntaste si teníamos fecha. Yo te dije que quiero que seas mi casa. Sigo queriendo lo mismo, solo que ahora con más ganas y menos miedo.',
    'Feliz cumpleaños. Deja de fumar, que lo sepas. Y gracias por hacer esta apuesta conmigo.',
  ],
  signature: 'Te quiere, Gas 💙',
};
