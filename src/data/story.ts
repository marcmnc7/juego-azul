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
  { id: 5, name: 'MotoTrip4life', place: 'Costa Brava, del 30 de abril al 4 de mayo de 2026', emoji: '🏍️' },
  { id: 6, name: 'Sant Joan', place: 'Ciutadella, junio de 2026', emoji: '🐎' },
  { id: 7, name: 'Cena a escondidas', place: 'Sa Farola, 13 de julio de 2026', emoji: '🍝' },
  { id: 8, name: 'El eclipse', place: 'Ciutadella, 12 de agosto de 2026', emoji: '🌘' },
  { id: 9, name: 'Un año después', place: 'Ferreries, 25 de agosto de 2026', emoji: '💙' },
];

// Capítulo 1, tot en menorquí. El xat d'aquell vespre va tal qual a chats.ts (ferreriesTarde).
export const FERRERIES = {
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 d’agost de 2025, Sant Bartomeu. Es ases són a les onze.' },
    { who: 'Narrador', text: 'Has pujat amb ses amigues. Encara no el coneixes.' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Primera vegada an es jaleo? Dues coses: pomada a sa mà, i quan un ase s’atura, li fas una carícia. Du sort.' },
    { who: 'Tòfol', text: 'Tres pomades i tres carícies. I alerta, que si un ase t’envesteix se’t cau es tassó.' },
  ] as Line[],
  tofolNotYet: [{ who: 'Tòfol', text: 'Encara no. Pomades i ases, que es jaleo no espera.' }] as Line[],
  tofolDone: [
    { who: 'Tòfol', text: 'Ja ets de Ferreries, al·lota.' },
    { who: 'Tòfol', text: 'Ara vés a ballar an aquell bar, que està molt guai. Na Carme ja hi és.' },
  ] as Line[],
  tofolAgain: [{ who: 'Tòfol', text: 'Què fas aquí encara? Vés an es bar!' }] as Line[],
  carme: [{ who: 'Carme', text: 'Ja era hora! Vina, balla!' }] as Line[],
  marcMeet: [
    { who: 'Marc', text: 'Carme! Què fas per aquí?' },
    { who: 'Carme', text: 'Ballar. Millor que tu, segur.' },
    { who: 'Marc', text: 'I tu? Jo som en Marc.' },
    { who: 'Margaux', text: 'Margaux.' },
    { who: 'Marc', text: 'Margaux. Increïble.' },
  ] as Line[],
  smallTalk: [
    { who: 'Marc', text: 'I què, ets d’aquí?' },
    { who: 'Margaux', text: 'Visc a Madrid. Però som una mica de tot: francesa, italiana i espanyola.' },
    { who: 'Marc', text: 'I havies vingut mai a ses festes de Ferreries, o és sa primera vegada?' },
    { who: 'Margaux', text: 'A Menorca hi vaig viure més d’un any, en plena pandèmia… però festes, cap ni una. Aquestes són ses primeres.' },
    { who: 'Marc', text: 'Idò benvinguda a ses de veres. Ja veus que aquí es balla com es pot.' },
  ] as Line[],
  hints: {
    pomada: 'Pomada! 🍋',
    luck: 'Carícia de sort! 🍀',
    dropped: 'Uiii! Un ase t’ha envestit i se t’ha caigut sa pomada',
    rear: 'Ara! Fes-li una carícia',
    perfect: 'Carícia perfecta! ✨🍀',
    late: 'Pels pèls 🍀',
    allLuck: 'Tres carícies! Sa plaça sencera t’aplaudeix 👏',
  },
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
  notM: (n: string) => `«${n}»… no empieza por M 😅`,
  missedM: '¡Eh, que ese empieza por M! Frena 🛑',
  marcial: [
    { who: 'Narrador', text: 'Cafetería Marcial. La primera con M. Juego ganado.' },
    { who: 'Narrador', text: '📷 Recuerdo desbloqueado: Cafetería Marcial.' },
  ] as Line[],
  threeDays: [{ who: 'Narrador', text: 'Tres días después.' }] as Line[],
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
    { who: 'Narrador', text: 'A él se le olvidó precisamente el gas.' },
    { who: 'Narrador', text: '3 de noviembre. Él ya va en el primer tren a Barcelona.' },
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
  barmanAgain: [{ who: 'Camarero', text: '¿Buscas sitio? Desde el pasillo del centro se ve a Fito de lujo.' }] as Line[],
  smokeFound: '🚭 Tabaco a la papelera',
  airport: [
    { who: 'Narrador', text: 'Jueves 12 de marzo de 2026. Gas vuela desde Barcelona y Azul, desde Madrid. Destino: Gran Canaria, a ver a Fito.' },
  ] as Line[],
  airportHint: 'Esquiva las hamburguesas 🍔 y llega a la puerta de embarque',
  burgerHit: ['🍔 ¡Plaf! «NUNCA más»', '🍔 «Todo malo y caro, hasta la fanta»', '🍔 Gas ya te avisó'],
  landed: [{ who: 'Narrador', text: 'Esa noche, en Gran Canaria. Él ha llegado antes.' }] as Line[],
  stadium: [
    { who: 'Narrador', text: 'Viernes 13 de marzo. Estadio de Gran Canaria. Fito está a punto de tocar y Gas se ha ido a la cola del baño.' },
    { who: 'Narrador', text: 'Busca un buen sitio en el pasillo del centro.' },
  ] as Line[],
  filmIntro: [{ who: 'Narrador', text: 'Grábaselo: mantén a Fito dentro del recuadro aunque la gente salte delante.' }] as Line[],
  filmDone: '🎥 Vídeo guardado para Gas',
  flashIntro: [
    { who: 'Narrador', text: 'Gas ya ha salido, pero entre canción y canción está todo a oscuras y no te encuentra.' },
    { who: 'Narrador', text: 'Enciende el flash cuando mire hacia ti.' },
  ] as Line[],
  flashHint: 'Enciende el flash cuando Gas mire hacia ti',
  flashHit: ['📸 Te ha visto', '📸 Viene hacia ti', '📸 Ya casi', '📸 ¡Aquí!'],
  flashWrong: ['Ahora no, que mira hacia otro lado', 'Gas va hacia otro flash', 'Has deslumbrado a un señor de Telde'],
  gasFound: [
    { who: 'Gas', text: '¡Por fin! Con tanta gente no veía nada.' },
    { who: 'Azul', text: 'Te he grabado el temón. Toma.' },
  ] as Line[],
  gasSmoke: { who: 'Gas', text: '¿Y el tabaco? ¿A la papelera? Esa es mi Azul.' } as Line,
  rhythm: 'Toca los botones cuando las notas lleguen a la línea',
  ending: [{ who: 'Narrador', text: 'Lunes 16 de marzo. Cada uno vuelve a su ciudad.' }] as Line[],
};

// Capítulo 2: los chats de esa noche van tal cual en src/data/chats.ts (imperi, pins, cesped, meGustas).
export const NIGHT = {
  intro: [{ who: 'Narrador', text: 'Ciutadella. 26 de agosto de 2025. Tú estás en el Imperi. Él se va mañana.' }] as Line[],
  arrive: [{ who: 'Narrador', text: 'Sa Son 69 B4. Sus padres duermen.' }] as Line[],
  swimDone: [{ who: 'Narrador', text: 'Al césped. Esa oscuridad tenebre.' }] as Line[],
  lie: [{ who: 'Narrador', text: 'Toca las estrellas, empezando por la que parpadea.' }] as Line[],
  candle: (n: number) => `🕯️ ${n}/6`,
  sneakHint: 'Silencio full: despacio y por las losas, que la grava cruje',
  lightOn: '💡 Se ha encendido una luz arriba… ¡quieta!',
  caught: [{ who: 'Narrador', text: 'Se enciende una ventana. Quietos… y se apaga. Otra vez, despacito.' }] as Line[],
};

// Crucigrama antes de la carta: lo del final.
// Capítulo 7: la cena a escondidas en casa de los padres de Azul, 13 de julio de 2026.
// Los chats van tal cual en src/data/chats.ts (cenaMenu, cenaEspera, cenaPronto, cenaVen, teQuiero, jazzbah).
export const CENA = {
  radarIntro: [{ who: 'Narrador', text: '9 de julio. Gas vuela a Menorca y tú le sigues en el radar, de Barcelona a Mahón.' }] as Line[],
  intro: [{ who: 'Narrador', text: 'Sa Farola, 13 de julio de 2026. Tus padres salen a cenar. Gas espera en un lugar estratégico, con la moto.' }] as Line[],
  /** Lo que le vas escribiendo mientras tus padres no acaban de irse (mensajes tuyos de esa noche). */
  waitEvents: ['Aun estan', 'Sale mi padre ahora', 'Que hace mi padre top', 'Tio'],
  cookIntro: [{ who: 'Gas', text: 'El 10 es la carbonara. Y sin nata.' }] as Line[],
  steps: {
    guanciale: 'Toca cuando el guanciale esté dorado 🥓',
    pasta: 'Escurre la pasta al dente ⏱️',
    mix: 'Mezcla fuera del fuego: que no se cuaje 🥚',
    nata: 'Gas: «¿Con nata? Regulín.»',
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
    'El 25 de agosto de 2025, en Ferreries, me puse a hablar con Carme para poder presentarme a ti. Al día siguiente me iba, y aun así acabaste subiendo a un coche azul cerca de Pins, en una piscina en silencio y en un césped que es el único que sabe lo que pasó.',
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
  ] as Line[],
  rideHint: 'Inclínate con las curvas: izquierda o derecha',
  photoHint: '📷 ¡Foto!',
  photoOk: ['📷 Foto guardada', '📷 Otra para el álbum', '📷 Esta es la buena'],
  lean: { good: 'Fluida ✨', bad: 'Uy, acompaña la curva' },
  creus: [
    { who: 'Narrador', text: 'Cap de Creus. Ya no queda carretera, solo mar.' },
    { who: 'Narrador', text: 'Esa noche, cena y helado en L’Escala. Con el conjunto de paseo, claro.' },
  ] as Line[],
  back: [{ who: 'Narrador', text: 'El lunes por la mañana devolvéis la moto.' }] as Line[],
  stats: (fluid: number, photos: number) => [['Curvas fluidas', `${fluid}%`], ['Fotos', `${photos}/3`]] as [string, string][],
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
  walkDone: [{ who: 'Narrador', text: 'Eric quiere ir a hombros. Joy quiere ir a todas partes.' }] as Line[],
  driveIntro: [{ who: 'Narrador', text: 'Ahora, a casa de Gas. Toca aparcar marcha atrás dentro, en la entrada.' }] as Line[],
  parkHint: 'Marcha atrás: mete el coche dentro de la entrada',
  parkBump: 'Uy, el muro 😬',
  parkOk: 'Aparcado. A la primera (casi) 🅿️',
  meetMarcParents: [
    { who: 'Narrador', text: 'Entráis los dos. Sus padres están en la cocina.' },
    { who: 'Margaux', text: 'Hola, soy Margaux.' },
    { who: 'Narrador', text: 'Ahora sí: los cuatro padres, en un solo día.' },
  ] as Line[],
  rocks: [
    { who: 'Narrador', text: 'Por fin solos. A la roca de Es Castellar, a esperar el eclipse.' },
    { who: 'Gas', text: '¿Una partida a La Princesa mientras tanto?' },
  ] as Line[],
  afterCards: [{ who: 'Narrador', text: 'Te ha ganado ella. Como siempre. Y empieza el eclipse.' }] as Line[],
  glassesHint: 'Ponte las gafas de eclipse 🕶️',
  noGlasses: '¡Sin gafas no! Ponte las gafas 🕶️',
  photo: '📸 Los dos, con las gafas puestas, en el momento exacto',
  kitchenHint: 'Entra con Gas: sus padres están en la cocina',
  totality: '🌘 Ya está',
  end: [{ who: 'Narrador', text: 'La luna tapa el sol. Se hace de noche un momento.' }] as Line[],
  stats: (rounds: number, parkTries: number) => [['Partidas a La Princesa', `${rounds}`], ['Intentos aparcando', `${parkTries}`]] as [string, string][],
};

// Capítulo 9: un año después, otra vez Ferreries y en menorquí, como el 1. Chats: tarde, veintidos, asesOnce, bocata, fecha.
export const ANIVERSARIO = {
  ...FERRERIES,
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 d’agost de 2026, Sant Bartomeu. Un any just.' },
    { who: 'Narrador', text: 'Aquesta vegada ja el coneixes. Sa setmana ha anat així:' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Tu altra vegada! I aquest any acompanyada.' },
    { who: 'Tòfol', text: 'Ja sabeu com va: tres pomades i tres carícies, però ara a dues mans.' },
  ] as Line[],
  tofolDone: [
    { who: 'Tòfol', text: 'Ja sou més de Ferreries que jo.' },
    { who: 'Tòfol', text: 'I ara, que és Sant Bartomeu, un petó.' },
  ] as Line[],
  tofolAgain: [{ who: 'Tòfol', text: 'Encara aquí? Vinga, que es jaleo no espera!' }] as Line[],
  september: [{ who: 'Narrador', text: 'Setembre. Gas s’apunta a vòlei platja.' }] as Line[],
  october: [{ who: 'Narrador', text: 'Octubre. Joy, a punt per a campionats.' }] as Line[],
  carme: [{ who: 'Carme', text: 'Ell és per aquí. Segueix sa ubicació!' }] as Line[],
  gasMoves: ['📍 Ubicació nova', '📍 I una altra', '📍 «Tinc bocata»'],
  marcMeet: [
    { who: 'Marc', text: 'Ja era hora. Un any just, eh?' },
    { who: 'Margaux', text: 'Un any. I encara balles igual.' },
  ] as Line[],
  smallTalk: [
    { who: 'Marc', text: 'L’any passat vaig haver de parlar amb na Carme per presentar-me.' },
    { who: 'Marc', text: 'Enguany ja no em fa falta excusa.' },
  ] as Line[],
  hints: { ...FERRERIES.hints, allLuck: 'Tres carícies, i aquesta vegada junts 👏' },
};

// Minijuegos cortos que salen al acabar algunos capítulos (y desde el mapa).
export const MINIS = {
  pack: {
    title: 'La mochila',
    hint: 'Toca solo lo de la lista de Gas. Lo demás no cabe.',
    nope: 'Gas: «Ma menos»',
  },
  princesa: {
    title: 'La Princesa',
    start: 'Tú tienes la Princesa 👑. Si la descartas o te eliminan, pierdes. Toca una carta para jugarla.',
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
    found: '¡Ahí está! 🏍️',
    nope: 'Esa no es…',
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
    done: (hits: number) => `Joy: ${hits} obstáculos perfectos. A campeonatos 🏆`,
  },
  voley: {
    title: 'Vóley playa nivel 6',
    hint: 'Toca justo cuando la pelota llegue a Gas',
    miss: '¡Al suelo!',
    early: 'Muy pronto',
    late: 'Tarde',
    done: (passes: number) => `${passes} pases. Nivel 6 (apuntado al 3) 🧐`,
  },
};
