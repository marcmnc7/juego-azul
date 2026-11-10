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
  { id: 2, name: 'La piscinita', place: 'Sa Caleta, 27 de agosto de 2025', emoji: '🌙' },
  { id: 3, name: 'La ruta de las zamburiñas', place: 'Madrid → Marcial → el camping → San Vicente → Logroño', emoji: '🚗' },
  { id: 4, name: 'Fito bajo las estrellas', place: 'Estadio de Gran Canaria, marzo de 2026', emoji: '🎸' },
  { id: 5, name: 'MotoTrip4life', place: 'Costa Brava, del 30 de abril al 4 de mayo de 2026', emoji: '🏍️' },
  { id: 6, name: 'Sant Joan', place: 'Ciutadella, junio de 2026', emoji: '🐎' },
  { id: 7, name: 'Cena a escondidas', place: 'Sa Farola, 13 de julio de 2026', emoji: '🍝' },
  { id: 8, name: 'El eclipse', place: 'Ciutadella, 12 de agosto de 2026', emoji: '🌘' },
  { id: 9, name: 'Un año después', place: 'Ferreries, 25 de agosto de 2026', emoji: '💙' },
];

// Capítulo 1. Els de Ferreries parlen en menorquí; ella, en castellà, i entre ells dos, en castellà.
// El xat d'aquell vespre va tal qual a chats.ts (ferreriesTarde).
export const FERRERIES = {
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 de agosto de 2025. Último día de las fiestas de Sant Bartomeu: el jaleo de burros.' },
    { who: 'Narrador', text: 'Pistolas de agua, purpurina y confeti por todas partes. Has subido con tus amigas. Todavía no le conoces.' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Ei, al·lota! Jo som en Tòfol, i avui mano jo. Benvinguda a Ferreries: darrer dia de Sant Bartomeu.' },
    { who: 'Tòfol', text: 'Tot s’any som un poble tranquil. Avui no: pistoles d’aigua, purpurina, i ases pel mig de sa plaça amb tot es poble ballant-los devora. Aquí ningú torna sec a ca seva.' },
    { who: 'Tòfol', text: 'I alerta, que es jaleo té sa seva màgia. Un ve a passar sa tarda, i no sap mai què se’n durà.' },
    { who: 'Margaux', text: '¿Y qué se hace aquí?' },
    { who: 'Tòfol', text: 'Primera vegada an es jaleo d’ases? Dues coses: pomada a sa mà, i quan un ase s’atura, li fas una carícia. Du sort.' },
    { who: 'Margaux', text: '¿Una caricia? ¿Al burro?' },
    { who: 'Tòfol', text: 'Tres pomades i tres carícies. Ses pomades me les dus a mi, que tenc set. I alerta, que si un ase t’envesteix se’t cau es got.' },
  ] as Line[],
  tofolNotYet: [{ who: 'Tòfol', text: 'Encara no. Pomades i ases, que es jaleo no espera.' }] as Line[],
  tofolDone: [
    { who: 'Margaux', text: 'Toma: tus tres pomadas.' },
    { who: 'Tòfol', text: 'Ara sí! Ja ets de Ferreries, al·lota.' },
    { who: 'Margaux', text: '¡Y llena de purpurina!' },
    { who: 'Tòfol', text: 'Ara vés a ballar an es bar de Sa Font, que està molt guai. Na Carme ja hi és.' },
  ] as Line[],
  tofolAgain: [{ who: 'Tòfol', text: 'Què fas aquí encara? Vés a Sa Font!' }] as Line[],
  carme: [{ who: 'Carme', text: 'Ja era hora! Vina, balla!' }] as Line[],
  marcMeet: [
    { who: 'Marc', text: 'Carme! Què fas per aquí?' },
    { who: 'Carme', text: 'Res, aquí amb una amiga.' },
    { who: 'Marc', text: '¿Y tú? Yo soy Marc.' },
  ] as Line[],
  smallTalk: [
    { who: 'Marc', text: '¿Y de dónde eres?' },
    { who: 'Margaux', text: 'Vivo en Madrid. Pero soy francesa e italiana.' },
    { who: 'Marc', text: '¿Y habías venido alguna vez a las fiestas? ¿A Menorca?' },
    { who: 'Margaux', text: '¡Sí! Prácticamente todos los años.' },
    { who: 'Marc', text: '¿Todos los años? ¿Y cómo es que no te había visto nunca?' },
    { who: 'Carme', text: 'Perquè no mires, Marc.' },
    { who: 'Marc', text: 'Pues bienvenida otra vez. Aquí se baila como se puede.' },
  ] as Line[],
  hints: {
    pomada: '¡Pomada! 🍋',
    luck: '¡Caricia de la suerte! 🍀',
    dropped: '¡Uiii! Un burro te ha empujado y se te ha caído la pomada',
    rear: '¡Ahora! Hazle una caricia',
    perfect: '¡Caricia perfecta! ✨🍀',
    late: 'Por los pelos 🍀',
    allLuck: '¡Tres caricias! Toda la plaza te aplaude 👏',
    /** Con las tres en la mano, los burros se desbocan: hasta Tòfol sin derramar. */
    stampede: '🫏 ¡Se han desbocado! Llévale las pomadas a Tòfol sin derramarlas',
    spilled: ['🍋 ¡Se te ha derramado una!', '🍋 ¡Otra por el suelo!'],
    arrived: (n: number) =>
      n === 2
        ? [{ who: 'Margaux', text: 'Toma… las que han llegado.' }, { who: 'Tòfol', text: 'Dues de tres. Bé, amb dues ja faig via.' }]
        : [{ who: 'Margaux', text: 'Toma… la que ha llegado.' }, { who: 'Tòfol', text: 'Una?! Bé, sa intenció és lo que compta.' }],
  },
};

/** Lo que solo pasa en Ferreries: la mirada a cámara lenta, el baile, el beso y el número (a las 19:46 ya os escribíais por WhatsApp). */
export const FERRERIES_MEET = {
  /** Cuando ella se gira y él la ve: todo va a cámara lenta. */
  eyes: [{ who: 'Marc', text: '(Mare meva… quins ulls.)' }] as Line[],
  name: [
    { who: 'Margaux', text: 'Margaux.' },
    { who: 'Marc', text: 'Margaux… Encantado.' },
  ] as Line[],
  dance: [{ who: 'Carme', text: 'Bé, bé… jo me’n vaig a cercar una altra pomada.' }] as Line[],
  insta: [
    { who: 'Marc', text: 'Oye… ¿me das tu número?' },
    { who: 'Margaux', text: 'Apunta.' },
  ] as Line[],
};

// Capítulo 6: Sant Joan en Ciutadella (junio de 2026). Buscar a Gas por sus ubicaciones entre caballos y avellanes.
export const SANTJOAN = {
  night: [{ who: 'Narrador', text: 'Ciutadella. Madrugada del 23 de junio de 2026. Mañana es Sant Joan.' }] as Line[],
  morning: [{ who: 'Narrador', text: 'Por la mañana.' }] as Line[],
  bandera: [{ who: 'Narrador', text: 'A las cinco y cuarto se acaba la bandera. Estás en la Plaça Espanya y hay que ir hacia el Born.' }] as Line[],
  huntHint: 'Ve hacia Correus por Ses Voltes 📍',
  correus: [{ who: 'Narrador', text: 'Correus. Ni rastro de Gas. Una hora después:' }] as Line[],
  exactHint: 'Mándale una foto exacta: que salga el obelisco 📷',
  notExact: 'Con esta foto no sabrá dónde estás. Que salga el obelisco 📷',
  comingHint: 'Gas viene hacia ti',
  meet: [{ who: 'Narrador', text: 'Con la foto, Gas te encuentra enseguida.' }] as Line[],
  /** Juntos a Sa Plaça d’es Bè a hacer botar caballos, y a dormir a casa de Azul. */
  toBe: [{ who: 'Gas', text: 'Venga, a Sa Plaça d’es Bè. A hacer botar caballos.' }] as Line[],
  beHint: 'Ve con Gas a Sa Plaça d’es Bè',
  beGo: 'Toca el pecho de los caballos cuando se pongan de manos',
  beCount: (n: number, of: number) => `🐎 ${n}/${of}`,
  /** Un caballo se desboca por Ses Voltes. */
  charge: '🐎 ¡Un caballo desbocado viene de frente! ¡Apártate a los soportales!',
  chargeOk: '¡Por poco! 😮‍💨',
  beDone: [
    { who: 'Margaux', text: '¿Te vienes a dormir a casa?' },
    { who: 'Gas', text: 'Sí. Vamos.' },
  ] as Line[],
  /** Ya de noche: al taxi de la Plaça Espanya, a paso de Gas. */
  taxiNight: [
    { who: 'Narrador', text: 'Ya es de noche. Después de todo el día de jaleo, Gas casi no puede andar.' },
    { who: 'Gas', text: 'Ay, ay, ay… No siento el pie.' },
    { who: 'Margaux', text: 'Agárrate a mí. Cogemos un taxi, está ahí, en la Plaça Espanya.' },
  ] as Line[],
  taxiHint: 'Sujeta a Gas y llévale hasta el taxi de la Plaça Espanya',
  taxiBtn: '🚕 Subir al taxi',
  taxiPals: [{ who: 'Taxista', text: '¿Adónde vais?' }, { who: 'Margaux', text: 'Camí de sa Farola, por favor.' }] as Line[],
  ride: [{ who: 'Narrador', text: 'De vuelta a casa, por el Camí de sa Farola.' }] as Line[],
  home: [{ who: 'Narrador', text: 'De madrugada, en tu casa. Los dos, muertos de sueño.' }] as Line[],
  homeHint: 'Entra en casa con Gas',
  sleepBtn: '😴 A dormir',
  after: [{ who: 'Narrador', text: 'Dos días después.' }] as Line[],
  hints: {
    pomada: '¡Avellanes! 🌰',
    luck: '¡Toque de suerte! 🐎',
    rear: '¡Ahora! Tócale el pecho',
    perfect: '¡Toque perfecto! ✨🐎',
    late: 'Uy, por los pelos 🐎',
  },
};

export const ROAD = {
  intro: [
    { who: 'Narrador', text: '24 de octubre de 2025. Él ha preparado un fin de semana por el norte. Tú le escribes con una duda.' },
  ] as Line[],
  introTrain: [
    { who: 'Narrador', text: '30 de octubre. Él viene a Madrid en tren, y va justísimo.' },
  ] as Line[],
  introGo: [
    { who: 'Narrador', text: 'Da lluvia. Así que coche: el tuyo. Y conduces tú.' },
    { who: 'Narrador', text: 'Por el camino, un juego: parar a comer en el primer restaurante que empiece por M.' },
  ] as Line[],
  /** Una vaca en mitad de la carretera: se para, se la saluda y se le pregunta el camino. */
  cowHint: '🐄 ¡Una vaca! Frena',
  cowBtn: '🐄 Saludar a la vaca',
  cowMissed: '🛑 ¡Frena, frena, que es una vaca!',
  cows: [
    [
      { who: 'Margaux', text: 'Hola, vaca. ¿Hacia dónde vamos?' },
      { who: 'Vaca', text: 'Muuu.' },
      { who: 'Marc', text: 'Dice que recto.' },
    ],
    [
      { who: 'Margaux', text: 'Otra. Hola. ¿Vamos bien para San Vicente?' },
      { who: 'Vaca', text: 'Muuuuu.' },
      { who: 'Marc', text: 'Eso es un sí. Se le ve segura.' },
    ],
    [
      { who: 'Margaux', text: 'Perdona, ¿Logroño?' },
      { who: 'Vaca', text: '…Muu.' },
      { who: 'Marc', text: 'Dice que por ahí hay fiesta.' },
    ],
  ] as Line[][],
  notM: (n: string) => `«${n}»… no empieza por M 😅`,
  missedM: '¡Eh, que ese empieza por M! Frena 🛑',
  marcial: [
    { who: 'Narrador', text: 'Cafetería Marcial. La primera con M. Juego ganado.' },
    { who: 'Narrador', text: '📷 Recuerdo desbloqueado: Cafetería Marcial.' },
  ] as Line[],
  named: [{ who: 'Narrador', text: 'Desde ese día, Marc es Gas.' }] as Line[],
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
  /** La noche del camping, entre Marcial y San Vicente. */
  camp: [
    { who: 'Narrador', text: 'Esa noche, a una cabaña de leña. Iba a ser cenita de camping: cartas y el camping gas.' },
    { who: 'Narrador', text: 'A él se le olvidó precisamente el gas.' },
  ] as Line[],
  campAfter: [{ who: 'Narrador', text: 'Y a la mañana siguiente, carretera otra vez. Al norte.' }] as Line[],
  terrace: [
    { who: 'Narrador', text: 'La terraza de El Ancla.' },
  ] as Line[],
  /** Lo que piensa ella cuando la prueba, a cámara lenta (como él con sus ojos en Ferreries). */
  zambEpic: [{ who: 'Margaux', text: '(Madre mía… qué zamburiña.)' }] as Line[],
  zambDone: [
    { who: 'Marc', text: 'No habrá mejor zamburiña en el mundo que la de San Vicente.' },
    { who: 'Margaux', text: 'Déjalo.' },
  ] as Line[],
  arriveLogrono: [{ who: 'Narrador', text: 'Logroño. Calle Laurel. Vais de fiesta.' }] as Line[],
  logronoEnd: [{ who: 'Narrador', text: '3 de noviembre. Él ya va en el primer tren a Barcelona.' }] as Line[],
  hit: ['¡Buu!', '¡Buu! Cuidado', '¡Buu buu!', 'Marc: «Como negocias, eh»'],
  smoke: ['Marc: «¿Otra vez?» 🚭', 'Marc: «Eso no es una foto, es un paquete de tabaco…» 🚭', 'Marc: «Te lo requiso. Por tu bien.» 🚭'],
  turbo: '¡Gasolina de 98 octanos! ⛽ Turbo',
  nearMiss: '¡Por los pelos! +1 📸',
  combo: (n: number) => `¡Racha de ${n} fotos! 📸`,
  stops: ['Madrid', 'San Vicente', 'Logroño'],
  /** «Si da lluvia, coshe»: la tromba de Cantabria. */
  storm: '🌧️ Tromba. Se ve fatal y el coche patina',
  stormOff: '🌤️ Ya escampa',
  zamb: { served: '¡Al plato! Déjalo 😋', burnt: '¡Buu! Quemada', raw: 'Todavía está cruda' },
};

// Capítulo 4. Lo marcado «(inventado)» no sale de los chats: Marc, cámbialo por lo que pasó de verdad.
// Los avisos no van en letreros (no se ven): los dice alguien, en un bocadillo, como en la vida real.
export const CONCERT = {
  barmanAgain: [{ who: 'Camarero', text: '¿Buscas sitio? Desde el pasillo del centro se ve a Fito de lujo.' }] as Line[],
  airport: [
    { who: 'Narrador', text: 'Jueves 12 de marzo de 2026. Gas vuela desde Barcelona y tú, desde Madrid. Destino: Gran Canaria, a ver a Fito.' },
  ] as Line[],
  /** A quien se le escapa la maleta de la tienda (inventado). */
  suitcase: [
    { who: 'Una señora', text: '¡Ay, perdona! Que se me ha escapado.' },
    { who: 'Azul', text: '¡Uy! Otra maleta…' },
    { who: 'Un señor', text: '¡Perdón, perdón! ¡Que no frena!' },
  ] as Line[],
  /** El tabaco de Azul, a la papelera de la terminal (opcional; Gas se fija al final). */
  smokeBtn: 'Tirar el tabaco 🚭',
  smokeDone: 'Se acabó. 🚭',
  /** Megafonía de la puerta 26. */
  gateLast: '📢 Última llamada para el vuelo a Las Palmas de Gran Canaria. Puerta 26.',
  gateClosing: '📢 Pasajera Margaux, embarque inmediato por la puerta 26.',
  /** En el torno de embarque (inventado). */
  gateAsk: 'Tarjeta de embarque y DNI, por favor.',
  gateRush: '¡Corre, que cerramos!',
  gateThanks: 'Gracias. Buen vuelo.',
  gateBtn: '🎫 Tarjeta y DNI',
  gateLate: 'Por los pelos…',
  landed: [{ who: 'Narrador', text: 'Esa noche, en Gran Canaria.' }] as Line[],
  /** En la cafetería de llegadas, donde la esperaba Gas («dentro aún»). Adaptado del chat de esa noche. */
  arrivalsMeet: [
    { who: 'Gas', text: 'Vas tarde.' },
    { who: 'Azul', text: '¿VOY TARDE? Tú vas pronto.' },
    { who: 'Gas', text: 'Nos han dado un coche mejor. Por vip.' },
  ] as Line[],
  stadium: [
    { who: 'Narrador', text: 'Viernes 13 de marzo. Estadio de Gran Canaria. Fito está a punto de salir.' },
    { who: 'Narrador', text: 'Ahora juegas con Gas.' },
  ] as Line[],
  /** Se apagan las luces y sale la banda (el saludo, inventado). */
  showHello: '¡Buenas noches, Gran Canaria!',
  showWc: [{ who: 'Narrador', text: 'Y Gas tiene que ir al baño. Será la primera de muchas.' }] as Line[],
  filmIntro: [
    { who: 'Narrador', text: 'Y justo ahora Fito toca un temazo. Gas, en la cola del baño.' },
    { who: 'Azul', text: 'Se lo grabo. Que no se me escape Fito del encuadre.' },
  ] as Line[],
  /** (inventado) */
  filmDone: 'Grabado. Ya lo verá.',
  /** Gas, buscándola sin chat delante (inventado). */
  seekAgain: '¿Dónde se ha metido ahora?',
  /** Cada canción que pasa mientras la busca (inventado). */
  songLost: ['Pfff. Otra canción que me pierdo.', 'Y otra… ¿Dónde está?', 'Fito ya va por la siguiente.'],
  found: [
    [
      { who: 'Gas', text: '¡Por fin! Con tanta gente no veía nada.' },
      { who: 'Azul', text: 'Te he grabado el temón. Toma.' },
    ],
    [{ who: 'Gas', text: '¡Aquí estás! Te has movido…' }],
    [{ who: 'Gas', text: 'Ahora sí. No me muevo de aquí.' }],
  ] as Line[][],
  /** Antes de cada vuelta al baño (la segunda, a por las gafas: ver SIDE.glasses.intro). */
  goAgain: [
    [],
    [{ who: 'Narrador', text: 'Dos canciones después, Gas se toca la cabeza: no lleva las gafas de sol.' }],
    [
      { who: 'Narrador', text: 'Y otra vez. La cola, eterna.' },
      { who: 'Gas', text: 'La última, lo prometo.' },
    ],
  ] as Line[][],
  glassesBtn: '🕶️ Mirar en las cabinas',
  /** Los de la cola, al verle mirar las cabinas sin hacer cola (inventado). */
  queueComplain: '¡Eh, mi niño, que hay cola!',
  glassesReply: '¡Solo miro si están mis gafas!',
  gasSmoke: { who: 'Gas', text: '¿Y el tabaco? ¿A la papelera? Esa es mi Azul.' } as Line,
  /** Al acabar el ritmo (inventado). */
  rhythmDone: (hits: number, total: number) => `¡${hits} de ${total}! Qué concierto.`,
  ending: [{ who: 'Narrador', text: 'Lunes 16 de marzo. Cada uno vuelve a su ciudad.' }] as Line[],
};

// Capítulo 2: los chats de esa noche van tal cual en src/data/chats.ts (imperi, pins, cesped, meGustas).
export const NIGHT = {
  intro: [{ who: 'Narrador', text: 'Ciutadella. 27 de agosto de 2025. Toda la tarde escribiéndoos. Él se va mañana.' }] as Line[],
  arrive: [{ who: 'Narrador', text: 'Sa Son 69 B4. Sus padres duermen.' }] as Line[],
  /** En la terraza del Imperi, antes de irse. */
  bye: [
    { who: 'Amiga', text: '¿Ya te vas? ¿Y con quién, si se puede saber? 👀' },
    { who: 'Azul', text: 'Con nadie… 🙃' },
    { who: 'Amigo', text: 'Ya, ya. Con nadie. Pásalo bien 😏' },
  ] as Line[],
  noBye: 'Uy… que no me he despedido de estos.',
  /** Al llegar: por dónde se entra sin hacer ruido. */
  sideWay: 'Por el lateral, que la puerta se oye desde arriba 🤫',
  towelsAsk: '¿Y las toallas? Las dejé en la mesa de la terraza.',
  towelsGot: 'Eso. Y ahora, a la piscina… despacito.',
  sneakLight: '¡Shh! ¡Quieta! La luz de arriba…',
  sneakLightOff: '…Vale. Se ha apagado. Sigue.',
  mpRules: 'Yo cierro los ojos. Digo «Marco» y tú «Polo»… y si te oigo chapotear, voy a por ti 😏',
  getOut: 'Me estoy quedando helado… ¿Nos tumbamos un rato?',
  /** En el coche, del Born a casa (bocadillos, sin parar el viaje). */
  drive: [
    { who: 'Gas', text: '¡Hola! ¿Qué tal?' },
    { who: 'Azul', text: 'Bien, bien… ¿y tú?' },
    { who: 'Gas', text: 'Bien. Oye… vas muy guapa.' },
    { who: 'Azul', text: 'Jajaja, gracias. Qué random todo, ¿no?' },
    { who: 'Gas', text: 'Un poco. A mí me gusta lo random.' },
    { who: 'Azul', text: '¿Y adónde vamos?' },
    { who: 'Gas', text: 'A casa de mis padres. Hay piscina.' },
    { who: 'Azul', text: '¿A estas horas? 😳' },
    { who: 'Gas', text: 'Te voy a pedir una cosa: en casa, silencio. Mis padres duermen.' },
    { who: 'Azul', text: 'Silencio full. Prometido 🤫' },
  ] as Line[],
  /** Después de hacer el amor en las toallas: lo que se dijeron esa noche. */
  love: [{ who: 'Narrador', text: 'Solo el césped sabe qué pasó.' }] as Line[],
  talk: [
    { who: 'Marc', text: 'Yo me voy a quedar sobre todo con tu chiste inicial del Uber. Ha sido un buen comienzo.' },
    { who: 'Marc', text: 'Es broma. Con tus ojazos.' },
    { who: 'Margaux', text: 'Estaba nerviosa. Y los tuyos también son bonitos.' },
    { who: 'Margaux', text: 'Qué pena no poder verlos bien esta noche.' },
    { who: 'Marc', text: 'Esa oscuridad tenebre ha tenido su parte buena también.' },
    { who: 'Margaux', text: 'Tuvo su porqué.' },
  ] as Line[],
  lie: [{ who: 'Narrador', text: 'Toca las estrellas, empezando por la que parpadea.' }] as Line[],
  sneakHint: 'Silencio full: despacio y por las losas, que la grava cruje',
  lightOn: '💡 Se ha encendido una luz arriba… ¡quieta!',
  caught: [{ who: 'Narrador', text: 'Se enciende una ventana. Quietos… y se apaga. Otra vez, despacito.' }] as Line[],
  /** En el agua: se enciende la luz de arriba y hay que quedarse quieta. */
  freeze: '💡 ¡La luz de arriba! Quieta, que no se mueva el agua',
  freezeMoved: 'Gas: «¡Shhh! ¡Quieta!»',
  freezeOff: 'Se apaga. Uf.',
  freezeHint: '💡 ¡Quieta! Ni un chapoteo',
};

// Crucigrama antes de la carta: lo del final.
// Capítulo 7: la cena a escondidas en casa de los padres de Azul, 13 de julio de 2026.
// Los chats van tal cual en src/data/chats.ts (cenaMenu, cenaEspera, cenaPronto, cenaVen, teQuiero, jazzbah).
export const CENA = {
  radarIntro: [{ who: 'Narrador', text: '9 de julio. Gas vuela a Menorca y tú le sigues en el radar, de Barcelona a Mahón.' }] as Line[],
  intro: [{ who: 'Narrador', text: 'Sa Farola, 13 de julio de 2026. Tus padres salen a cenar. Gas espera en un lugar estratégico, con la moto.' }] as Line[],
  /** Lo que le vas escribiendo mientras tus padres no acaban de irse (mensajes tuyos de esa noche). */
  waitEvents: ['Aun estan', 'Sale mi padre ahora', 'Que hace mi padre top', 'Tio'],
  // Tal cual en el chat: el del bacon era él, y la italiana es ella
  cookIntro: [
    { who: 'Gas', text: 'Bacon iba bien si tenías.' },
    { who: 'Margaux', text: '¿Qué dices? Guanciale. Y ni se te ocurra la nata.' },
    { who: 'Gas', text: 'Vale, vale. El 10 es la carbonara.' },
  ] as Line[],
  steps: {
    guanciale: 'Toca cuando el guanciale esté dorado 🥓',
    pasta: 'Escurre la pasta al dente ⏱️',
    mix: 'Mezcla fuera del fuego: que no se cuaje 🥚',
    nata: 'Gas: «¿Nata? ¿Tú? ¿La italiana?» 🙄',
    scrambled: '¡Buu! Huevos revueltos',
    burnt: '¡Buu! Guanciale quemado',
    raw: 'Todavía está dura',
  },
  grade: (n: number) =>
    n >= 10 ? 'Gas: «El 10 es la carbonara.»'
    : n >= 9 ? `Gas: «Un ${n}. Casi casi.»`
    : n >= 7 ? `Gas: «Un ${n}. Regulín.»`
    : n === 6 ? 'Gas: «Un 6’75.» Otra vez.'
    : `Gas: «Un ${n}…» Otra vez.`,
  dinner: [{ who: 'Narrador', text: 'Cenáis con un ojo en la puerta y otro en el reloj.' }] as Line[],
  /** Unos faros en la calle: ¿son tus padres? (No lo eran: volvieron a la 1.30.) */
  alarm: [
    { who: 'Gas', text: '¿Eso es un coche?' },
    { who: 'Margaux', text: '¡Son mis padres! ¡Recoge, recoge!' },
  ] as Line[],
  alarmHint: '🚗 ¡Unos faros! Quita de en medio los platos, la sartén y el casco de Gas',
  alarmItems: { plates: '🍽️ Platos, fuera', pan: '🍳 Sartén, fuera', helmet: '🪖 Casco escondido' },
  falseAlarm: [
    { who: 'Narrador', text: 'El coche pasa de largo. Era el del vecino.' },
    { who: 'Gas', text: 'Casi me da algo.' },
    { who: 'Margaux', text: 'Pero por si acaso, vete ya.' },
  ] as Line[],
  falseAlarmLate: [
    { who: 'Narrador', text: 'El coche pasa de largo. Era el del vecino. Menos mal, porque aún estaba todo por en medio.' },
    { who: 'Gas', text: 'Casi me da algo.' },
    { who: 'Margaux', text: 'Pero por si acaso, vete ya.' },
  ] as Line[],
  leave: [
    { who: 'Narrador', text: '22:50. Gas se va en la moto justo a tiempo.' },
    { who: 'Narrador', text: 'Tú subes a la cama. Tus padres siguen sin volver.' },
  ] as Line[],
};

export interface CrossClue {
  clue: string;
  answer: string;
  /** Casilla de inicio en la cuadrícula y sentido: A = horizontal, D = vertical. */
  row: number;
  col: number;
  dir: 'A' | 'D';
  /** Posición (desde 0) de la letra marcada, o -1 si no tiene. */
  mark: number;
  /** Qué letra del mensaje escondido da la marcada. */
  hiddenIdx: number;
}

// Crucigrama antes de la carta: todo sale del chat o de lo que pasó. Las letras marcadas dicen TE QUIERO.
export const CROSSWORD = {
  title: 'El crucigrama de Gas',
  intro: 'Tú me hiciste uno con letras remarcadas y PORTUGAL escondido. Ahora me toca a mí. Las casillas con círculo esconden algo, y esta vez van en orden.',
  hidden: 'TE QUIERO',
  rows: 14,
  cols: 14,
  clues: [
    { answer: 'DESLUMBRAS', row: 8, col: 4, dir: 'A', clue: "«Muy difícil sí… ...»", mark: 7, hiddenIdx: 6 },
    { answer: 'CARBONARA', row: 5, col: 10, dir: 'D', clue: "El 10 es la ... (sin nata)", mark: 4, hiddenIdx: 7 },
    { answer: 'APRENDIZ', row: 5, col: 5, dir: 'D', clue: "«Novato, 8 letras.» Me lo preguntaste desde el aeropuerto", mark: 6, hiddenIdx: 4 },
    { answer: 'ZAMBURIÑA', row: 12, col: 5, dir: 'A', clue: "«No habrá mejor ... en el mundo que la de San Vicente»", mark: 4, hiddenIdx: 3 },
    { answer: 'CARME', row: 6, col: 9, dir: 'A', clue: "La excusa para presentarme en Ferreries", mark: -1, hiddenIdx: -1 },
    { answer: 'MARCIAL', row: 2, col: 7, dir: 'D', clue: "Cafetería ...: el primer restaurante del camino que empezaba por M", mark: -1, hiddenIdx: -1 },
    { answer: 'IMPERI', row: 2, col: 6, dir: 'A', clue: "Donde estabas «aún con la cola» la noche de la piscinita", mark: -1, hiddenIdx: -1 },
    { answer: 'ATOCHA', row: 5, col: 0, dir: 'A', clue: "Donde me recogiste en coche en octubre", mark: -1, hiddenIdx: -1 },
    { answer: 'UBI', row: 8, col: 8, dir: 'D', clue: "«Acéptame la ...»", mark: -1, hiddenIdx: -1 },
    { answer: 'QUINTANA', row: 1, col: 1, dir: 'D', clue: "«Ya voy por dalt sa ...» (Sant Joan, a por la cami)", mark: 0, hiddenIdx: 2 },
    { answer: 'ASES', row: 0, col: 9, dir: 'D', clue: "«Es ... son a las 11»", mark: -1, hiddenIdx: -1 },
    { answer: 'GILDAS', row: 3, col: 0, dir: 'A', clue: "«Podemos ir probando ... para siempre»", mark: -1, hiddenIdx: -1 },
    { answer: 'ECLIPSE', row: 0, col: 13, dir: 'D', clue: "Lo vimos desde la roca, con las gafas puestas", mark: 0, hiddenIdx: 1 },
    { answer: 'CESPED', row: 10, col: 0, dir: 'A', clue: "«Solo el ... sabe qué pasó»", mark: 1, hiddenIdx: 5 },
    { answer: 'MAR', row: 11, col: 13, dir: 'D', clue: "«Casi paso delante de Cala ...»", mark: -1, hiddenIdx: -1 },
    { answer: 'FLASH', row: 1, col: 4, dir: 'D', clue: "«..., pls. Estoy. Xo no veo»", mark: -1, hiddenIdx: -1 },
    { answer: 'FITO', row: 1, col: 11, dir: 'D', clue: "Por él volamos a Gran Canaria", mark: 2, hiddenIdx: 0 },
    { answer: 'PINS', row: 10, col: 3, dir: 'D', clue: "«Ve hacia ...»", mark: -1, hiddenIdx: -1 },
    { answer: 'GAS', row: 13, col: 1, dir: 'A', clue: "Lo que se nos olvidó para el camping (y mi nombre)", mark: -1, hiddenIdx: -1 },
  ] as CrossClue[],
  solved: 'Ahora sí, abre la carta.',
};

// Carta del regalo final. Marc: reescríbela con tus palabras.
export const FINAL_LETTER = {
  title: 'Feliz cumpleaños, Azul',
  paragraphs: [
    'El 25 de agosto de 2025, en Ferreries, me puse a hablar con Carme para poder presentarme a ti. A los dos días me iba, y aun así acabaste subiendo a un coche azul cerca de Pins, en una piscina en silencio y en un césped que es el único que sabe lo que pasó.',
    'Después vino la lluvia que nos quitó la moto, la Cafetería Marcial, las zamburiñas de San Vicente y un gas de camping que se quedó en casa y me dio nombre. Vino Fito en Gran Canaria, la Costa Brava en moto y Sant Joan. Vino una carbonara a escondidas y un 23:49 en el que me escribiste que me querías. Y vino un eclipse desde la roca de Es Castellar, con las gafas puestas.',
    'El 1 de octubre me escribiste: «Desde que te conozco no hubo un dia donde no he pensado en ti. Y cada vez que te vas hasta el dia que te vuelvo a ver no pasa ni un dia sin que te eche de menos». Yo te dije que las mías serían más cortas pero querían decir lo mismo, y tú me dijiste «Me vale». Hoy van un poco más largas: yo igual, cada día.',
    'Un día me escribiste «Quiero que seas mi casa». Yo también lo quiero, cada día con más ganas.',
    'Feliz cumpleaños. Deja de fumar, que lo sepas. Y gracias a ti por hacer esta apuesta conmigo.',
  ],
  signature: 'Te quiere, Gas 💙',
};

// Capítulo 5: la Costa Brava en moto (30 de abril – 4 de mayo de 2026). Chats: motoPlan, mochila, motoTrip.
export const MOTO = {
  intro: [
    { who: 'Narrador', text: 'Barcelona, abril de 2026. Él lo organiza todo: moto alquilada, dos noches en L’Escala.' },
    { who: 'Narrador', text: 'Tú no has ido nunca tanto rato de paquete.' },
  ] as Line[],
  packIntro: [{ who: 'Narrador', text: 'La víspera, a las 00:44, te manda la lista de la mochila. Hazla tal cual: no cabe nada más.' }] as Line[],
  ride: [
    { who: 'Narrador', text: 'Sábado. De L’Escala hacia Cap de Creus por la costa.' },
    { who: 'Gas', text: 'Tú solo acompaña las curvas conmigo. Si yo me inclino, tú también.' },
    { who: 'Gas', text: 'Y si viene una moto de frente, se saluda. A los coches, no.' },
  ] as Line[],
  rideHint: 'Inclínate con las curvas y saluda a las motos (a los coches, no)',
  wave: {
    btn: '✌️ Saludar',
    ok: ['✌️ Saludo motero', '✌️ Te devuelve el saludo', '✌️ Hermandad de la carretera'],
    car: ['🚗 ¡A los coches no se les saluda!', '🚗 Eso era un coche…', '🚗 El del coche no entiende nada'],
    missed: '🏍️ Te ha saludado… y no le has devuelto el saludo',
  },
  photoHint: '📷 ¡Foto!',
  photoOk: ['📷 Foto guardada', '📷 Otra para el álbum', '📷 Esta es la buena'],
  lean: { good: 'Fluida ✨', bad: 'Uy, acompaña la curva' },
  /** La tramontana de Cap de Creus: racha de viento, inclinarse hacia la flecha. */
  wind: '🌬️ ¡Tramontana! Inclínate hacia donde marca la flecha',
  windBad: '🌬️ ¡Que nos lleva!',
  windOff: 'Pasó la racha 😮‍💨',
  windHint: '🌬️ Inclínate hacia la flecha',
  creus: [
    { who: 'Narrador', text: 'El faro de Cap de Creus, ahí delante… y la carretera, cortada. El último tramo está cerrado.' },
    { who: 'Narrador', text: 'Hasta aquí llegasteis. Media vuelta, con el faro de fondo.' },
    { who: 'Narrador', text: 'Esa noche, cena y helado en L’Escala. Con el conjunto de paseo, claro.' },
  ] as Line[],
  back: [{ who: 'Narrador', text: 'El lunes por la mañana devolvéis la moto.' }] as Line[],
  stats: (fluid: number, photos: number, waves: number, motos: number, wrong: number) =>
    [['Curvas fluidas', `${fluid}%`], ['Saludos moteros', `${waves}/${motos}${wrong ? ` · ${wrong} a coches 🚗` : ''}`], ['Fotos', `${photos}/3`]] as [string, string][],
  pack: [
    { icon: '🏍️', label: 'Conjunto de moto (tejanos, chupa, guantes)', ok: true },
    { icon: '👕', label: '2 camisetas finas de manga larga', ok: true },
    { icon: '👟', label: 'Zapatillas Nike', ok: true },
    { icon: '🧦', label: '3 calcetines largos', ok: true },
    { icon: '🍦', label: 'Conjunto de paseo (cenar y helado)', ok: true },
    { icon: '👙', label: 'Biquinis y un vestidito', ok: true },
    { icon: '🌙', label: 'Pijama', ok: true },
    { icon: '💍', label: 'Accesorios (joyitas, gafas de sol, reloj)', ok: true },
    { icon: '👠', label: 'Tacones', ok: false },
    { icon: '💇‍♀️', label: 'Plancha del pelo', ok: false },
    { icon: '🧳', label: 'Maleta de ruedas', ok: false },
    { icon: '👗', label: 'Un tercer vestido', ok: false },
    { icon: '💨', label: 'Secador', ok: false },
    { icon: '🥾', label: 'Botas de montaña', ok: false },
  ],
};

// Capítulo 8: el día del eclipse, 12 de agosto de 2026. Chats: eclipseReady, eclipseCoche, eclipseFin, luna.
export const ECLIPSE = {
  motoIntro: [{ who: 'Narrador', text: '2 de agosto, en el parking del aeropuerto. Gas no tiene ni idea de dónde dejó la moto.' }] as Line[],
  kayakIntro: [
    { who: 'Narrador', text: 'El plan de Gas: ver el eclipse desde el mar, en kayak, de Sa Farola hacia Sa Caleta.' },
  ] as Line[],
  kayakHint: 'Rema: toca 🛶 sin parar hasta Sa Caleta',
  ferryWarn: '⛴️ ¡¡Un ferry!!',
  kayakEnd: [
    { who: 'Gas', text: 'Tu padre tenía razón.' },
    { who: 'Narrador', text: 'Vale. Ese plan nunca pasó: al final no hubo kayak.' },
    { who: 'Narrador', text: 'Y menos mal. Así empieza el día de verdad.' },
  ] as Line[],
  arriveAzul: [
    { who: 'Narrador', text: 'Vais juntos en su coche a casa de tus padres. Hoy los conoce.' },
  ] as Line[],
  afterMoto: [{ who: 'Narrador', text: 'Diez días después, el 12 de agosto.' }] as Line[],
  parentsHint: 'Saluda a tus padres con Gas',
  meetAzulParents: [
    { who: 'Gas', text: 'Hola, encantado. Soy Marc.' },
    { who: 'Narrador', text: 'Tus padres le miran de arriba abajo. Aprobado. Creo.' },
    { who: 'Margaux', text: 'Vamos a dar una vuelta con Joy y Eric.' },
  ] as Line[],
  walkHint: 'Da una vuelta con Joy y Eric hasta la farola',
  walkDone: [
    { who: 'Narrador', text: 'Eric quiere ir a hombros. Joy quiere ir a todas partes.' },
    { who: 'Margaux', text: 'Venga, para casa, que se nos hace tarde.' },
  ] as Line[],
  backHint: 'Volved a casa de tus padres con Joy y Eric',
  byeHint: 'Despídete de tu padre',
  byeBtn: '👋 Despedirse',
  byeDad: [
    { who: 'Margaux', text: 'Papá, nos tenemos que ir, que si no, no llegamos a ver el eclipse.' },
    { who: 'Gas', text: 'Lo vamos a ver desde las rocas, cerca de mi casa. Encantado, de verdad.' },
    { who: 'Padre de Azul', text: 'Id, id. Y nada de kayak, ¿eh?' },
    { who: 'Gas', text: 'Nada de kayak.' },
  ] as Line[],
  carHint: 'Sube al coche: a casa de Gas',
  carBtn: '🚗 Subir al coche',
  driveIntro: [{ who: 'Narrador', text: 'Ahora, a casa de Gas. Toca aparcar marcha atrás dentro, en la entrada.' }] as Line[],
  parkHint: 'Marcha atrás: mete el coche dentro de la entrada',
  parkBump: 'Uy, el muro 😬',
  parkOk: 'Aparcado. A la primera (casi) 🅿️',
  /** El reloj: en cuanto os vais, cuenta hacia atrás hasta el eclipse. */
  clockLow: 'Gas: «Que no llegamos, eh»',
  clockHit: '💥 Dos minutos menos',
  meetMarcParents: [
    { who: 'Narrador', text: 'Entráis los dos. Sus padres están en la cocina.' },
    { who: 'Margaux', text: 'Hola, soy Margaux.' },
    { who: 'Madre de Gas', text: '¡Por fin! Pasa, pasa, que Marc no para de hablar de ti.' },
    { who: 'Padre de Gas', text: 'Nos ha dicho que vives en Madrid. ¿Y a qué te dedicas?' },
    { who: 'Margaux', text: 'Trabajo en Amazon, de account manager.' },
    { who: 'Padre de Gas', text: 'Amazon… Entonces ya sé a quién reclamarle los paquetes.' },
  ] as Line[],
  meetMarcParents2: [
    { who: 'Madre de Gas', text: '¿Y de dónde eres? Marc nos dijo algo, pero se hizo un lío.' },
    { who: 'Margaux', text: 'Soy italiana y francesa. Pero mis padres tienen casa aquí, en Sa Farola.' },
    { who: 'Margaux', text: 'Vengo prácticamente todos los años.' },
    { who: 'Madre de Gas', text: '¿En Sa Farola? ¿Tan cerca, todos los años, y os conocéis en Ferreries?' },
    { who: 'Gas', text: 'Bueno, nos vamos a las rocas, que empieza el eclipse.' },
    { who: 'Narrador', text: 'Ahora sí: los cuatro padres, en un solo día.' },
  ] as Line[],
  rocks: [
    { who: 'Narrador', text: 'Por fin solos. A la roca de Es Castellar, a esperar el eclipse.' },
    { who: 'Gas', text: '¿Una partida a Love Letter mientras tanto?' },
  ] as Line[],
  afterCards: [{ who: 'Narrador', text: 'Le has ganado. Como siempre. Y empieza el eclipse.' }] as Line[],
  glassesHint: 'Ponte las gafas de eclipse 🕶️',
  noGlasses: '¡Sin gafas no! Ponte las gafas 🕶️',
  photo: '📸 Los dos, con las gafas puestas, en el momento exacto',
  kitchenHint: 'Entra con Gas: sus padres están en la cocina',
  totality: '🌘 Ya está',
  end: [{ who: 'Narrador', text: 'La luna tapa el sol. Se hace de noche un momento.' }] as Line[],
  stats: (rounds: number, parkTries: number) => [['Rondas de Love Letter', `${rounds}`], ['Intentos aparcando', `${parkTries}`]] as [string, string][],
};

// Capítulo 9: un año después, otra vez Ferreries. Como en el 1, el pueblo habla en menorquín y ella y Gas, en castellano. Chats: tarde, veintidos, asesOnce, bocata, fecha.
export const ANIVERSARIO = {
  ...FERRERIES,
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 de agosto de 2026, Sant Bartomeu. Un año justo.' },
    { who: 'Narrador', text: 'Esta vez ya le conoces. La semana ha ido así:' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Tu altra vegada! I aquest any acompanyada.' },
    { who: 'Tòfol', text: 'Ja sabeu com va: tres pomades i tres carícies, però ara a dues mans.' },
  ] as Line[],
  tofolDone: [
    { who: 'Margaux', text: 'Toma, tus pomadas. Otro año más.' },
    { who: 'Tòfol', text: 'Ja sou més de Ferreries que jo.' },
    { who: 'Tòfol', text: 'I ara, que és Sant Bartomeu, un petó.' },
  ] as Line[],
  tofolAgain: [{ who: 'Tòfol', text: 'Encara aquí? Vinga, que es jaleo no espera!' }] as Line[],
  september: [{ who: 'Narrador', text: 'Septiembre. Gas se apunta a vóley playa.' }] as Line[],
  october: [{ who: 'Narrador', text: 'Octubre. Joy, lista para campeonatos.' }] as Line[],
  carme: [{ who: 'Carme', text: 'Ell és per aquí. Segueix sa ubicació!' }] as Line[],
  gasMoves: ['📍 Ubicación nueva', '📍 Y otra', '📍 «Tengo bocata»'],
  marcMeet: [
    { who: 'Marc', text: 'Ya era hora. Un año justo, ¿eh?' },
    { who: 'Margaux', text: 'Un año. Y sigues bailando igual.' },
  ] as Line[],
  smallTalk: [
    { who: 'Marc', text: 'El año pasado tuve que hablar con Carme para presentarme.' },
    { who: 'Marc', text: 'Este año ya no me hace falta excusa.' },
  ] as Line[],
  hints: { ...FERRERIES.hints, allLuck: 'Tres caricias, y esta vez juntos 👏' },
};

// Minijuegos cortos que salen al acabar algunos capítulos (y desde el mapa).
export const MINIS = {
  pack: {
    title: 'La mochila',
    hint: 'Toca solo lo de la lista de Gas. Lo demás no cabe.',
    nope: 'Gas: «Ma menos»',
  },
  princesa: {
    title: 'Love Letter',
    start: 'Gana quien llegue a 3 corazones. Cada ronda, una carta en la mano y otra que robas: juega una.',
    concede: 'Gas: «Venga, va, te la dejo: que empieza el eclipse».',
    next: 'Siguiente ronda',
    match: 'Partida para ti 👑',
    matchGas: 'Partida para Gas. Revancha, que no puedes dejarlo así.',
    princeWho: 'Príncipe: ¿quién descarta?',
    princeGas: 'Gas',
    princeMe: 'Yo',
    countess: 'Con el Rey o el Príncipe en la mano, la Condesa se juega sí o sí',
    guess: '¿Qué carta crees que tiene Gas?',
    win: 'Ganas tú 👑',
    lose: 'Gana Gas…',
    winBtn: 'Seguir',
    again: 'Revancha',
    gasPeeks: 'Sacerdote: Gas mira tu carta y sonríe.',
    princessOut: 'Has tenido que descartar la Princesa… Gana Gas.',
  },
  radar: {
    title: 'Mirarte en vuelo',
    hint: 'Sigue el avión de Barcelona a Menorca con el dedo',
    good: (pct: number) => `Mirado el ${pct}% del vuelo ✈️ Love language`,
    ok: (pct: number) => `Mirado el ${pct}% del vuelo. Gas: «Pues no»`,
  },
  moto: {
    title: '¿Dónde está la moto?',
    hint: 'Busca la moto de Gas con la linterna',
    goal: 'Busca con la linterna la moto de Gas: negra, con su casco rojo encima',
    check: '🔦 ¿Es esta?',
    found: '¡Ahí está! 🏍️',
    nope: 'Esa no es…',
    hint1: 'Gas: «Era negra. Y con mi casco encima, eso seguro»',
    hint2: 'Gas: «¡Ahora me acuerdo! Al fondo, cerca de una farola». Mira la luz',
  },
  tricks: {
    title: 'Adiestrar a Joy',
    hint: 'Gas da la orden: toca el gesto correcto antes de que Joy se despiste',
    commands: [
      { say: 'Sienta', label: 'Sienta', icon: '🪑' },
      { say: 'Tumba', label: 'Tumba', icon: '⬇️' },
      { say: 'Pata', label: 'Pata', icon: '🐾' },
      { say: 'Gira', label: 'Gira', icon: '🔄' },
    ],
    wrong: 'Joy te mira sin entender nada',
    slow: 'Joy se ha ido a oler algo',
    done: (ok: number) => `${ok} trucos. Ahora, el circuito 🏁`,
  },
  agility: {
    title: 'Joy, campeona de agility',
    hint: 'Toca para saltar vallas y aros. En los túneles, no saltes',
    btn: '🐕 ¡Salta!',
    knock: '¡Uy, la barra!',
    overTunnel: 'Por el túnel se pasa por dentro 😅',
    done: (hits: number) => `Joy: ${hits} obstáculos perfectos. A campeonatos 🏆`,
  },
  voley: {
    title: 'Vóley playa nivel 6',
    hint: 'Dale justo cuando la pelota te llegue',
    btn: '🏐 ¡Toca!',
    miss: '¡Al suelo!',
    early: 'Muy pronto',
    late: 'Tarde',
    done: (passes: number) => `${passes} pases. Nivel 6 (apuntado al 3) 🧐`,
  },
};

/** Los minijuegos que hay que pasar para seguir con la historia (se inventan, no son chats ni hechos reales). */
export const SIDE = {
  water: {
    intro: [
      { who: 'Narrador', text: 'Pistolas de agua por todas partes. Unos críos te cortan el paso.' },
      { who: 'Un crío', text: 'D\'aquí no passes si no ens mulles!' },
      { who: 'Narrador', text: 'Te han prestado una pistola. Moja a los cinco: dos veces cada uno.' },
    ] as Line[],
    hint: '💦 Moja a los críos: dos veces a cada uno',
    btn: '💦 Disparar',
    out: ['¡Uno rendido! 💦', '¡Dos!', '¡Tres! Ya huyen', '¡Solo queda uno!', '¡Todos mojados!'],
    soaked: '💦 ¡Te han dado!',
    end: [{ who: 'Un crío', text: 'Vale, vale! Passa, passa.' }] as Line[],
  },
  pinchos: {
    intro: [
      { who: 'Camarero', text: '¡Va, que hay cola! Te canto la ronda y me la sacas en orden.' },
      { who: 'Gas', text: 'Si aciertas, la siguiente la pago yo.' },
    ] as Line[],
    listen: (r: number, of: number) => `Ronda ${r} de ${of}: escucha al camarero…`,
    yourTurn: (i: number, n: number) => `Sírvelos en el mismo orden (${i}/${n})`,
    wrong: ['«Ese no era, majo.» Otra vez', '«Pero bueno.» Otra vez', '«Que no, que no.» Otra vez'],
    good: '¡Esa ronda, bien!',
    won: '¡Todas servidas! 🍢',
    end: [{ who: 'Camarero', text: 'Con este ritmo te contrato. ¡Hala, a bailar!' }] as Line[],
  },
  beers: {
    intro: [
      { who: 'Margaux', text: 'Antes de que empiece: ¿vas a por cervezas? La barra está ahí detrás.' },
      { who: 'Gas', text: 'Pido tres, que por este pasillo alguna se cae.' },
      { who: 'Margaux', text: 'Con que lleguen dos me vale. Te espero aquí.' },
    ] as Line[],
    btn: '🍺 Tres, por favor',
    give: '🍺 Toma',
    /** Lo dice Gas (bocadillo), al caérsele una. */
    spilled: ['¡No! Otra al suelo. Me queda una.', '¡Uy! Una al suelo. Me quedan dos.'],
    empty: 'Todas al suelo… Vuelta a la barra.',
    /** Lo dice quien cruza el pasillo y se choca con él. */
    bump: '¡Cuidado, que pasamos!',
    few: [{ who: 'Margaux', text: '¿Una? ¿Y la tuya? Anda, otra ronda.' }] as Line[],
    done: (n: number) => [{ who: 'Margaux', text: n === 3 ? '¡Las tres y sin derramar! Esta de más, para luego.' : 'Dos de tres. Una para cada uno, perfecto.' }] as Line[],
  },
  stones: {
    start: [
      { who: 'Gas', text: 'Ya que no se puede llegar al faro: a ver quién hace más ranas.' },
      { who: 'Margaux', text: 'Empieza tú, que quiero ver cómo pierdes.' },
    ] as Line[],
    gasDone: [{ who: 'Gas', text: 'Cinco. Te toca.' }] as Line[],
    angle: 'Agáchate: la piedra tiene que salir rasante',
    power: 'Y ahora, fuerte pero sin pasarse',
    win: (n: number) => [
      { who: 'Margaux', text: `${n}. Dime otra vez cuántas hiciste tú.` },
      { who: 'Gas', text: 'Ha sido el viento.' },
    ] as Line[],
    lose: (n: number, tries: number) => [{ who: 'Gas', text: tries > 2 ? `${n}. Va, que casi. Inténtalo otra vez.` : `${n}. Tengo tiempo. Otra.` }] as Line[],
  },
  nuts: {
    intro: [
      { who: 'Una de Ciutadella', text: 'Avellanes! Qui en vol? Els del balcó del Casino no paren de tirar-ne.' },
      { who: 'Gas', text: 'Toma la bolsa. Devuélveselas, que si no no nos dejan salir de aquí.' },
    ] as Line[],
    hint: '🌰 Acierta a los del balcón cuando se paren',
    btn: '🌰 Tirar',
    far: 'Acércate más al balcón',
    miss: 'Se ha movido. ¡Tira cuando se pare!',
    pelted: ['🌰 ¡En toda la cabeza!', '🌰 ¡Au!', '🌰 Mira el anillo del suelo: ahí cae'],
    end: [
      { who: 'Una de Ciutadella', text: 'Molt bé! Ja et pots quedar la bossa.' },
    ] as Line[],
  },
  table: {
    intro: [
      { who: 'Narrador', text: 'Gas se ha ido. Queda lo más difícil: que tu madre no note nada.' },
      { who: 'Margaux', text: 'Menos mal que hice una foto de la mesa antes de empezar.' },
    ] as Line[],
    caption: '📷 Antes de que llegara Gas',
    memorize: 'Mira bien la foto: cada cosa en su sitio',
    place: 'Elige abajo y toca su sitio en la mesa',
    good: '¡Igual que en la foto!',
    wrong: (n: number) => `${n} de 5. Tu madre lo notaría. Otra vez la foto…`,
    end: [{ who: 'Margaux', text: 'Ni una miga. Aquí no ha venido nadie.' }] as Line[],
  },
  hop: {
    intro: [
      { who: 'Gas', text: 'El mejor sitio está en aquellas rocas. Yo ya he cruzado. Salta cuando no venga ola.' },
      { who: 'Margaux', text: 'Si me mojo el vestido, te tiro al agua.' },
    ] as Line[],
    hint: '🪨 Salta de roca en roca. Espera las olas en las rocas altas',
    btn: '🪨 Saltar',
    fall: ['💦 ¡La ola! A la última roca alta', '💦 ¡Otra vez! Espera a que pase', '💦 ¡Que está fría!'],
    end: [{ who: 'Gas', text: 'Seca. Lo dudaba.' }] as Line[],
  },
  pee: {
    first: [{ who: 'Narrador', text: 'Por fin le toca a Gas. Tres cervezas después, con prisa y con la mosca pegada en el urinario de la cabina mirándole.' }] as Line[],
    again: [{ who: 'Narrador', text: 'Otra vez el urinario. Y otra cerveza más que la última.' }] as Line[],
    title: '🎯 Apunta a la mosca',
    hint: 'Arrastra el dedo para apuntar. Al final pierde fuerza: apunta más arriba',
    tank: 'Vejiga',
    great: '🎯 Ni una gota fuera. Así da gusto',
    ok: '🎯 Casi todo dentro. Nadie tiene que saberlo',
    bad: '🎯 Uy. Mejor salir rápido de aquí',
    fly: ' · 🪰 ¡En toda la mosca!',
  },
  glasses: {
    intro: [
      { who: 'Gas', text: 'Espera. ¿Y mis gafas de sol?' },
      { who: 'Gas', text: 'Me las he dejado en el baño. Seguro. Ahora vuelvo.' },
    ] as Line[],
    title: '🕶️ ¿En qué cabina te las has dejado?',
    hint: 'Toca las puertas para mirar dentro',
    broken: 'Averiado. Esta ni se abre',
    /** La voz de quien está dentro (inventado). */
    occupied: '¡OCUPADO!',
    empty: ['Aquí no están', 'Tampoco. Qué asco, por cierto', 'Nada. Solo papel por el suelo', 'Ni rastro'],
    found: '🕶️ ¡Aquí estaban, en la repisa!',
  },
};
