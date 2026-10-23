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
    { who: 'Narrador', text: "Ferreries, Menorca. Finales de agosto: Festes de Sant Bartomeu." },
    { who: 'Narrador', text: "Banderas de Menorca en los balcones, la fabiolera tocando en el Pla de l'Església y a las once, Jaleo d'Ases." },
    { who: 'Narrador', text: 'Suenan el fabiol y el tamborí. Los ases salen a la calle con sus jinetes y los bares están a reventar.' },
    { who: 'Narrador', text: 'Esta noche va a pasar algo importante… aunque todavía no lo sabes.' },
    { who: 'Narrador', text: 'Habla con Tòfol, el del bar de la plaza. Él sabe de todo.' },
  ] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Bon vespre! ¿Primera vez en el Jaleo de Ferreries? Se te nota en la cara.' },
    { who: 'Tòfol', text: 'Aquí hay dos tradiciones: la pomada (gin de Menorca con limonada) y tocar a un ase cuando se pone de manos. ¡Da suerte!' },
    { who: 'Tòfol', text: 'Consigue 3 pomadas en los bares y 3 toques de suerte. Ojo, que si un ase te pilla se te cae el vaso.' },
    { who: 'Tòfol', text: 'Y luego vuelve a verme, que te presento a alguien…' },
  ] as Line[],
  tofolNotYet: [{ who: 'Tòfol', text: 'Todavía te faltan pomadas o toques de suerte. ¡Ánimo, que la noche es joven!' }] as Line[],
  tofolDone: [
    { who: 'Tòfol', text: '¡Molt bé! Ya eres de Ferreries de toda la vida.' },
    { who: 'Tòfol', text: "¿Ves a ese que baila fatal en el Bar Sa Plaça, junto a la iglesia? Se llama Marc. Lleva toda la noche mirándote." },
    { who: 'Tòfol', text: 'Dice que tiene una piscina. Yo que tú no me lo creería. Llévale una pomada, anda.' },
  ] as Line[],
  marcMeet: [
    { who: 'Marc', text: '¡Hola! ¿Esa pomada es para mí? Qué detalle.' },
    { who: 'Marc', text: 'Soy Marc. Perdona que te mire tanto, pero… need esos ojos.' },
    { who: 'Margaux', text: '¿“Need”? Buu… ¿y tú no tocas ningún ase?' },
    { who: 'Marc', text: 'Yo soy más de bailar. Mal, pero con ganas. Bueno, y de mirar. Que te he visto bailar en Sant Joan y no te fijaste en mí.' },
    { who: 'Margaux', text: 'Yo iba a lo mío, no me fijaba en nadie.' },
    { who: 'Marc', text: 'Ya. Lo dejamos en que yo iba ciego. ¿Bailas? Prometo no pisarte. Mucho.' },
    { who: 'Narrador', text: "Bailáis hasta que el bar Sa Plaça pone la última canción. La música baja, la plaza se queda en silencio un segundo…" },
  ] as Line[],
  afterKiss: [
    { who: 'Narrador', text: 'Y así, entre ases, pomada y música, en pleno Sant Bartomeu, empezó todo.' },
    { who: 'Marc', text: 'Mañana, cuando llegues a Ciutadella, avísame. Te vengo a buscar.' },
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

// Capítulo 5: Sant Joan en Ciutadella (junio de 2026). Buscar a Gas por sus ubicaciones entre caballos y avellanes.
export const SANTJOAN = {
  huntIntro: [
    { who: 'Narrador', text: 'Ciutadella, 23 de junio. Sant Joan. A las cinco sale la bandera y el pueblo entero se echa a la calle.' },
    { who: 'Narrador', text: 'Gas lleva tu camiseta. Todo el día. «Husband material.»' },
    { who: 'Gas', text: '(WhatsApp) Llevo 30’ dando vueltas.' },
    { who: 'Azul', text: '(WhatsApp) ¿Dónde estássss?' },
    { who: 'Narrador', text: 'Te va mandando su ubicación por la Plaça Espanya, el Born y Correos. Síguela… aunque con él nunca se sabe.' },
  ] as Line[],
  exactHint: 'Mándale tu ubicación exacta 📍',
  sentLoc: '📍 Azul: «Obelisco. Lado del Ajuntament. No te muevas»',
  marcMeet: [
    { who: 'Gas', text: '¡Azul! Por fin. Llevo treinta minutos dando vueltas. ¿Me has aceptado la ubi o no?' },
    { who: 'Azul', text: 'Te la he aceptado tres veces. El que no sabe dónde está eres tú.' },
    { who: 'Gas', text: 'Buu. Mira, te he guardado avellanes. Y me he quemado. Me dijeron que eran 4 los uvas.' },
    { who: 'Azul', text: 'Sin crema te quemas, da igual el nivel de 🍇. Quemadito como un guiri.' },
    { who: 'Gas', text: 'Lo que tú digas. Esta noche cenamos en Maramao, ¿eh? MARamao es nuestro.' },
    { who: 'Narrador', text: 'Suena el fabiol. Los caballos entran en la plaza y todo el Born se pone a saltar…' },
  ] as Line[],
  afterKiss: [
    { who: 'Azul', text: 'Gracias por hacer de este Sant Joan algo muy especial. Imposible de olvidar.' },
    { who: 'Gas', text: 'Y la camiseta me la quedo. La llevaré cada 24 de junio.' },
    { who: 'Azul', text: 'Más te vale. Y aún no te has ido… y ya mi manchi.' },
    { who: 'Gas', text: 'De Ferreries a Sant Joan, un año entero. Y lo que queda. Feliz cumpleaños, Azul. 💙' },
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
    '📍 Gas: «Estoy en la Plaça Espanya»',
    '📍 Gas: «Ahora al lado de Correos. Creo»',
    '📍 Gas: «Por el Born. Al lado del obelisco»',
    '📍 Gas: «Llevo 30’ dando vueltas. Dime exacto pls»',
  ],
  pinHint: 'Sigue el último pin de Gas en el mapa 📍',
  /** Cuando te acercas, Gas se va a otro sitio (las dos primeras veces). */
  gasMoves: ['Gas: «Aceptame la UBI… que ya no estoy aquí» 📍', 'Gas: «Estoy al lado de Correos. Creo» 📍'],
};

export const ROAD = {
  intro: [
    { who: 'Narrador', text: 'Dos meses después. Gas llega a Sants con el tren a punto de salir: «MUY JUSTO. Toy semáforo y lo tengo en 7’». «No me lo creo. Estoy CHORREANDO.»' },
    { who: 'Narrador', text: 'Atocha, diez de la noche. «Aparcao.» «En posición.» Azul le espera con el Ford Focus gris, como prometió.' },
    { who: 'Azul', text: 'Malas noticias: no me dio tiempo a comprar el helado.' },
    { who: 'Gas', text: 'Eso sí que no te lo podré perdonar. Me tendrás que invitar a algo.' },
    { who: 'Azul', text: 'Te invito a una cerve. O un vino. O una Coca-Cola.' },
    { who: 'Gas', text: 'A una langosta. Trabajas en Amazon, te lo puedes permitir.' },
    { who: 'Gas', text: 'Plan A era Oporto en moto. Pero el pacto era: si llueve, coche. Y llueve.' },
    { who: 'Azul', text: 'Pues Ford Focus gris, Joy detrás y conduzco yo. Tú solo dime dónde vamos.' },
    { who: 'Gas', text: 'Eso es sorpresa. Tú conduce, que los caminitos los elijo yo.' },
    { who: 'Narrador', text: 'Desliza el dedo (o toca ◀ ▶) para cambiar de carril. Recoge fotos del viaje 📸 y esquiva lo que se cruce.' },
    { who: 'Gas', text: 'Los ⛽ dan turbo. Y si ves tabaco 🚬 por la carretera… ni se te ocurra, Azul.' },
  ] as Line[],
  regions: {
    madrid: 'Saliendo de Madrid (sin helado: no se lo perdona)',
    meseta: 'La meseta castellana',
    cantabria: 'Cantabria: verde, verde y más verde',
    rioja: 'La Rioja: Marqués de Riscal a la vista',
  },
  arriveSV: [
    { who: 'Narrador', text: 'San Vicente de la Barquera. El puente, el castillo, el mar… y un olor a plancha que no se puede aguantar.' },
    { who: 'Gas', text: 'Sorpresa. Hasta nos han guardado aparcamiento, que somos VIP. En El Ancla ponen las mejores zamburiñas del Cantábrico.' },
    { who: 'Gas', text: 'Y el cocinero dice que, si las hacemos nosotros, invita él.' },
    { who: 'Narrador', text: 'Toca cada zamburiña cuando esté dorada. Si se quema… Buu.' },
  ] as Line[],
  zambDone: [
    { who: 'Gas', text: 'Las mejores zamburiñas de mi vida. ¿Cómo se dice zamburiña en inglés?' },
    { who: 'Azul', text: 'Scallop.' },
    { who: 'Gas', text: 'Pues… we will always find good zamburiñas. 🥴' },
    { who: 'Azul', text: 'Hard task. Almost impossible. Después de estas, ninguna va a estar tan buena.' },
  ] as Line[],
  arriveLogrono: [
    { who: 'Narrador', text: 'Logroño. Calle Laurel, un pincho en cada bar y un vino en cada pincho. Y mañana, chuletón.' },
    { who: 'Gas', text: 'Por el viaje más random de mi vida. Planear un finde entero con alguien que casi no conoces… y que salga así.' },
    { who: 'Azul', text: 'No era el sitio, era el plan. Bueno, y la compañía.' },
    { who: 'Gas', text: 'Eso lo he dicho yo antes. Dame el mérito.' },
    { who: 'Joy', text: '¡Guau!' },
  ] as Line[],
  terrace: [
    { who: 'Narrador', text: 'La terraza de El Ancla, en San Vicente. Las zamburiñas que nunca se os van a olvidar.' },
    { who: 'Gas', text: 'Pide tú, que a mí no me entienden.' },
    { who: 'Narrador', text: 'Cómete una zamburiña.' },
  ] as Line[],
  terraceDone: [
    { who: 'Azul', text: 'Mmm… Déjalo. Ya sabes dónde se ha quedado mi corazón.' },
    { who: 'Gas', text: 'En San Vicente de la Barquera. Pues ahora, a Logroño, que el vino no se bebe solo.' },
    { who: 'Joy', text: '¡Guau! (Joy también quiere una)' },
  ] as Line[],
  hit: ['¡Buu!', '¡Buu! Cuidado', '¡Buu buu!', 'Gas: «¡Que me lo has dejado demasiado bien!»'],
  smoke: ['Gas: «Azul, ¿otra vez? ¡Que lo tienes que dejar!» 🚭', 'Gas: «Eso no es una foto, es un paquete de tabaco…» 🚭', 'Gas: «Te lo requiso. Por tu bien. Prueba con la panadera.» 🚭'],
  turbo: '¡Gasolina! ⛽ Turbo',
  nearMiss: '¡Por los pelos! +1 📸',
  combo: (n: number) => `¡Racha de ${n} fotos! Joy está flipando 🐶`,
  stops: ['Madrid', 'San Vicente', 'Logroño'],
  zamb: { served: '¡Al plato! Déjalo 😋', burnt: '¡Buu! Quemada', raw: 'Todavía está cruda' },
};

export const CONCERT = {
  barmanAgain: [{ who: 'Camarero', text: '¿Otra? Tu chico lleva un rato en la cola del baño. Dice que «pfff, temón».' }] as Line[],
  smokeFound: '🚭 ¡A la papelera! Gas va a estar orgulloso: en Canarias, ni uno',
  gasFound: [
    { who: 'Gas', text: '¡Azul! Por fin. Hay como mil flashes, pero el tuyo es el que más brilla.' },
    { who: 'Azul', text: 'Te he grabado la canción. Me debes una grande.' },
  ] as Line[],
  gasSmoke: { who: 'Gas', text: 'Por cierto… ¿has tirado el tabaco? ¡Esa es mi chica! Dijimos que en Canarias, ni uno.' } as Line,
  gasNoSmoke: { who: 'Gas', text: 'Por cierto, ¿no estarás fumando, eh? Que dijimos que en Canarias, ni uno…' } as Line,
  // --- Versión fiel al chat (para el capítulo rehecho: aeropuerto, cola, vídeo y flash) ---
  airport: [
    { who: 'Narrador', text: 'Jueves 12 de marzo. Gas vuela desde Barcelona; Azul, una hora después desde Madrid.' },
    { who: 'Gas', text: '(WhatsApp) Qué puto asco el burger. NUNCA más. Todo malo y caro, hasta la Fanta.' },
    { who: 'Gas', text: '(WhatsApp) Me han cambiado el asiento: 3B.' },
    { who: 'Azul', text: '(WhatsApp) Yo 26D. 26 palo, pero D top: ✨pasillo✨.' },
    { who: 'Gas', text: '(WhatsApp) Nos han dado un coche mejor. Por VIP. Y vas tarde.' },
    { who: 'Azul', text: '(WhatsApp) ¿¡VOY TARDE!? Tú vas pronto.' },
  ] as Line[],
  airportHint: 'Esquiva la hamburguesa del aeropuerto 🍔 y llega a la puerta',
  burgerHit: ['🍔 ¡Plaf! NUNCA más', '🍔 Todo malo y caro, hasta la Fanta', '🍔 Gas ya te lo avisó', '🍔 26D ✨pasillo✨… pero con kétchup'],
  queueIntro: [
    { who: 'Narrador', text: 'Viernes 13. Estadio de Gran Canaria. Gas se va al baño justo antes del concierto.' },
    { who: 'Gas', text: '(WhatsApp) Toy cola lavabos ya. Pfffff. Temón.' },
    { who: 'Narrador', text: 'Ayúdale a no perder el sitio: que no se le cuele nadie.' },
  ] as Line[],
  queueCut: ['¡Que se cuela! ✋', '¡Eh, que estábamos antes!', '«Solo voy a lavarme las manos»… sí, claro', '¡Ni de broma! ✋'],
  queueDone: '🚻 ¡Por fin! Y fuera suena un temón…',
  queueJoin: '🧍 Con Gas en la cola. «Toy cola lavabos ya. Pfffff»',
  queueCutIn: ['😤 Se os ha colado uno', '😤 «Es que voy con mi amiga, que está ahí delante»', '😤 Colado. Y Gas: «Temón… y yo aquí»'],
  filmIntro: [
    { who: 'Narrador', text: 'Y justo ahora Fito toca un temazo. Gas, en la cola.' },
    { who: 'Azul', text: '(WhatsApp) Hize vídeo, don’t worry.' },
    { who: 'Narrador', text: 'Grábale la canción: mantén a Fito dentro del encuadre aunque la gente salte delante.' },
  ] as Line[],
  filmDone: '🎥 Vídeo guardado. Gas no se lo pierde (casi)',
  flashIntro: [
    { who: 'Narrador', text: 'Gas sale del baño. El estadio está a oscuras y hay miles de personas.' },
    { who: 'Gas', text: '(WhatsApp) Flash.' },
    { who: 'Gas', text: '(WhatsApp) Pls.' },
    { who: 'Gas', text: '(WhatsApp) Estoy.' },
    { who: 'Gas', text: '(WhatsApp) Xo no veo.' },
    { who: 'Narrador', text: 'Enciende el flash del móvil cuando Gas mire hacia ti. Si lo enciendes mientras mira a otro lado, se va hacia otro flash.' },
  ] as Line[],
  flashHint: 'Enciende el flash cuando Gas mire hacia ti',
  flashHit: ['📱 «Flash» ¡Te ha visto!', '📱 «Pls» Viene hacia ti…', '📱 «Estoy» ¡Ya casi!', '📱 «Xo no veo»… ¡ya sí!'],
  flashWrong: ['Ese no era tu flash… 🙃', 'Gas se va hacia una señora con linterna', '¡Ahora no, que mira al otro lado!'],
  flashFound: [
    { who: 'Gas', text: '¡Azul! Hay como mil flashes, pero el tuyo es el que más brilla.' },
    { who: 'Azul', text: 'Te he grabado la canción. Me debes una grande.' },
    { who: 'Gas', text: 'Te debo muchas. Empezando por las entradas que compraste borracha. Por Ticketmaster, no por Viagogo.' },
  ] as Line[],
  rhythm: 'Toca los botones cuando las notas lleguen a la línea',
  ending: [
    { who: 'Narrador', text: 'Las luces, la guitarra, miles de personas cantando… y vosotros dos en medio.' },
    { who: 'Gas', text: 'Oye, Azul. Gracias por todo esto. Por Ferreries, por la carretera, por esta noche. Y por comprar las entradas borracha.' },
    { who: 'Azul', text: 'Me debes una grande. Y calla, que me vas a hacer llorar. Buu.' },
    { who: 'Gas', text: 'Todo lo que fuimos fue icónico. Y prepárate, que esto no ha terminado…' },
  ] as Line[],
};

export const NIGHT = {
  bar: [
    { who: 'Narrador', text: 'Ciutadella, 26 de agosto de 2025. La noche después de Ferreries.' },
    { who: 'Narrador', text: 'Azul está en el Imperi. Sigue con la Coca-Cola: «Tengo cuidado».' },
    { who: 'Gas', text: '(WhatsApp) Mañana me voy. No habrá otro chance. ¿Nos «despedimos»?' },
    { who: 'Gas', text: '(WhatsApp) Opciones: lanzarnos al mar y resfriarnos… o nadar en secreto.' },
    { who: 'Azul', text: '(WhatsApp) ¿Por dónde sería esa piscina?' },
    { who: 'Gas', text: '(WhatsApp) Si nos colamos en la municipal me detienen y pierdo el vuelo. Mejor la de casa.' },
    { who: 'Azul', text: '(WhatsApp) ¿Tienes una en casa?' },
    { who: 'Gas', text: '(WhatsApp) Muy pequeñita ella, pero sí, funciona. Y te ahorras 3.000 € de multa.' },
    { who: 'Narrador', text: '«Arranco.» «Ve hacia Pins.» «Creo que te he visto. Patrás.» «¿Coche o moto?» «Coche azul. Gira.»' },
  ] as Line[],
  drive: [
    { who: 'Narrador', text: 'Azul se sube al coche azul con un chiste de Uber que Gas no va a olvidar nunca.' },
    { who: 'Gas', text: 'Condición: silencio full, que mis padres están durmiendo y molaría que no se enterasen.' },
    { who: 'Azul', text: 'Entendido, jefe. 😇' },
    { who: 'Narrador', text: 'Ventanillas bajadas, la música bajita y olor a verano. Ella está nerviosa. Él, más.' },
  ] as Line[],
  arrive: [
    { who: 'Gas', text: 'Ya estamos. Sa Caleta. Pasa sin hacer ruido, porfa.' },
    { who: 'Azul', text: '(susurrando) ¿Y si se despiertan?' },
    { who: 'Gas', text: '(susurrando) Pues eres una amiga que ha venido a… ver la piscina. A la una de la mañana.' },
  ] as Line[],
  intro: [
    { who: 'Narrador', text: 'Ya en casa. Hace calor, la piscinita está iluminada y la casa entera duerme.' },
    { who: 'Gas', text: 'Es pequeñita, pero funciona. Y se le puede llamar piscina. He puesto velitas flotando. ¿Te bañas?' },
    { who: 'Azul', text: '¿Velitas? ¿Tú? ¿Quién eres y qué has hecho con Gas?' },
    { who: 'Narrador', text: 'Baja al jardín y tírate a la piscina. Sin hacer ruido.' },
  ] as Line[],
  swim: [
    { who: 'Gas', text: '¡Recoge las seis velitas! Y shhh, que se despiertan mis padres.' },
  ] as Line[],
  swimDone: [
    { who: 'Gas', text: 'Esta noche hay estrellas de las que no se ven en Madrid. ¿Nos tumbamos en el césped a verlas?' },
    { who: 'Azul', text: 'Vale, pero las toallas las pones tú.' },
    { who: 'Gas', text: 'Y no hay luz. Esta oscuridad tenebre va a tener su parte buena, ya verás.' },
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
    { who: 'Azul', text: 'Que no te vayas mañana.' },
    { who: 'Gas', text: 'Ese es difícil. Pide otro.' },
    { who: 'Azul', text: 'Pues que aprendas inglés.' },
    { who: 'Gas', text: 'Mientras no me hagas hablar inglés, puedes cambiar de idioma cuando quieras. 🥴' },
    { who: 'Narrador', text: 'A la una de la mañana, ya en casa, Azul le escribe: «Tb el césped con vista estrellas 10/10 💫».' },
    { who: 'Gas', text: 'Aún no me lo puedo creer. Qué poco me esperaba esto hoy.' },
  ] as Line[],
  candle: (n: number) => `🕯️ ${n}/6`,
  sneakHint: 'Silencio full: despacio y por las losas, que la grava cruje',
  lightOn: '💡 Se ha encendido una luz arriba… ¡quieta!',
  caught: [
    { who: 'Madre de Gas', text: '(desde la ventana) ¿Marc? ¿Eres tú?' },
    { who: 'Gas', text: '(susurrando) ¡Shhh! Sí, mamá… era el gato. Bueno, yo. Vuelve a dormir.' },
    { who: 'Narrador', text: 'Volvéis a la terraza conteniendo la risa. Otra vez, y ahora sí: silencio full.' },
  ] as Line[],
};

// Crucigrama antes de la carta: la vuelta del que Azul le hizo a Gas (MARGAUX, PORTUGAL…).
// Las letras marcadas, en orden, forman el mensaje escondido.
// Capítulo nuevo (si Marc lo elige): la cena a escondidas en casa de los padres de Azul, 13 de julio de 2026.
export const CENA = {
  intro: [
    { who: 'Narrador', text: 'Ciutadella, 13 de julio de 2026. Casi un año después de la piscinita… y ahora la que se cuela es otra.' },
    { who: 'Narrador', text: 'Los padres de Azul salen a cenar. Gas viene a cenar a escondidas. El plan: de 9 a 23, ni un minuto más.' },
    { who: 'Gas', text: '(WhatsApp) A partir de las 22.50 yo lo pasaré mal.' },
    { who: 'Azul', text: '(WhatsApp) ¿Qué cocinamos?' },
    { who: 'Gas', text: '(WhatsApp) Todo esto lo hago por una pasta.' },
    { who: 'Azul', text: '(WhatsApp) Carbonara muy pesada…' },
    { who: 'Gas', text: '(WhatsApp) 🙄' },
    { who: 'Azul', text: '(WhatsApp) Venga vale, carbo. Pero guanciale no está cada día en casa, eh.' },
    { who: 'Gas', text: '(WhatsApp) Bacon iba bien si tenías.' },
    { who: 'Azul', text: '(WhatsApp) Que dices.' },
  ] as Line[],
  waitIntro: [
    { who: 'Gas', text: '(WhatsApp) Voy tirando.' },
    { who: 'Azul', text: '(WhatsApp) ¡Nooo! Wait. Aún están. Hay una situación rara, apárcate más adelante.' },
    { who: 'Gas', text: '(WhatsApp) Estoy en un lugar estratégico. Cuando me digas voy y tardo 30 segundos.' },
    { who: 'Narrador', text: 'Vigila a tus padres. Dile «Ven» solo cuando se hayan ido de verdad.' },
  ] as Line[],
  waitEvents: ['Sale mi padre ahora…', 'No. Jdr. ¿Qué hace mi padre?', 'Se ha dejado algo. Vuelve a entrar…', 'Mi madre busca las llaves…'],
  tooSoon: [
    { who: 'Gas', text: '(WhatsApp) A ver QUE. Pero no apures tanto. No viene de 2’.' },
    { who: 'Narrador', text: '¡Casi os pillan! Espera a que el coche arranque.' },
  ] as Line[],
  comeIn: [
    { who: 'Azul', text: '(WhatsApp) Ya sí. Ven. Ahora sí.' },
    { who: 'Narrador', text: 'Treinta segundos después, Gas está en la puerta. «Voy pumpeado.» Viene del gym.' },
  ] as Line[],
  cookIntro: [
    { who: 'Gas', text: 'Bueno, chef. Yo con la pasta de atún llevo un 6,75. Y un 7 la 2.0. Cuando llegue al 9 empiezo con la carbonara.' },
    { who: 'Azul', text: 'Pues mira y aprende. Regla número uno: nada de nata.' },
    { who: 'Narrador', text: 'Guanciale crujiente, pasta al dente y la crema de huevo y pecorino fuera del fuego. Si se cuaja, son huevos revueltos.' },
  ] as Line[],
  steps: {
    guanciale: 'Toca cuando el guanciale esté dorado 🥓',
    pasta: 'Escurre la pasta al dente ⏱️',
    mix: 'Mezcla fuera del fuego: que no se cuaje 🥚',
    nata: 'Gas: «¿Y la nata?» — Azul: «Fuera de mi cocina.»',
    scrambled: '¡Buu! Huevos revueltos',
    burnt: '¡Buu! Guanciale quemado',
    raw: 'Todavía está dura',
  },
  grade: (n: number) =>
    n >= 10 ? 'Gas: «Un 10. La carbonara siempre es el 10.»'
    : n >= 9 ? `Gas: «Un ${n}. Casi casi.»`
    : n >= 7 ? `Gas: «Un ${n}. Como mi pasta de atún 2.0.»`
    : `Gas: «Un ${n}…» — Azul: «No acepto. Prueba otra vez.»`,
  dinner: [
    { who: 'Gas', text: 'Algo me pasa. Cuando me ponen una carbonara con nata me ofendo mucho. Con esta, en cambio… Déjalo.' },
    { who: 'Azul', text: 'Gracias por dejarme la palabra.' },
    { who: 'Narrador', text: 'Cenáis en la terraza, con la puerta de la calle vigilada y el reloj mirando hacia las 23:00.' },
  ] as Line[],
  leave: [
    { who: 'Narrador', text: '22:50. Gas se va justo a tiempo. ¿A qué hora volverán? Gas apuesta por las 00:15; Azul, por las 12:30.' },
    { who: 'Narrador', text: '23:49. Azul ya está en la cama. Coge el móvil.' },
    { who: 'Azul', text: '(WhatsApp) Me gustó mucho cenar contigo hoy.' },
    { who: 'Azul', text: '(WhatsApp) Quería decirte que te quiero.' },
    { who: 'Azul', text: '(WhatsApp) Poc a poc se me quitará la tontería de no decirte las cosas.' },
  ] as Line[],
};

// Epílogo antes del crucigrama: un año después, otra vez en el Jaleo de Ferreries.
export const EPILOGUE = {
  title: 'Un año después',
  place: 'Ferreries, 25 de agosto de 2026',
  lines: [
    { who: 'Narrador', text: 'Ferreries, 25 de agosto de 2026. Otra vez Sant Bartomeu. Otra vez el Jaleo.' },
    { who: 'Gas', text: '(WhatsApp) Es ases son a las 11.' },
    { who: 'Narrador', text: 'Os buscáis entre la gente con la ubicación. Como siempre.' },
    { who: 'Gas', text: '(WhatsApp) Tengo bocata. Y patatas.' },
    { who: 'Azul', text: 'Hace un año estaba aquí mismo, la noche antes de los ases. Y tú ibas ciego.' },
    { who: 'Gas', text: 'Y tú bailando sin fijarte en nadie. Solo te he visto 22 veces. Horas llevo 203.' },
    { who: 'Azul', text: 'Oye… ¿tenemos fecha nosotros? En la taza puse 25/08.' },
    { who: 'Gas', text: 'Te contesto por escrito. Pero antes, una cosa: tú me hiciste un crucigrama. Ahora me toca a mí.' },
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
    'Empezamos entre ases y pomadas en Ferreries, seguimos con una piscinita en silencio en Sa Caleta, un finde sorpresa hasta las zamburiñas de San Vicente y cantando a Fito en Gran Canaria. Luego vino Sant Joan, buscándote por Ciutadella con tu camiseta puesta, y una carbonara a escondidas en casa de tus padres que por fin sacó un 10.',
    'Gracias por las cartas, por el crucigrama, por reírte de mi inglés (que ya es B2, que conste) y por aguantar mis bailes. Y por los “Buu”, que también te quiero por ellos.',
    'Me preguntaste si teníamos fecha. Sigo pensando que es muy bonito no tenerla, porque así cualquier día puede ser el nuestro. Hoy es el tuyo.',
    'Joy y yo te deseamos el mejor 28 de noviembre. Y que dejes de fumar, que lo sepas.',
  ],
  signature: 'Te quiere, Gas 💙 (y Joy 🐾)',
};
