// Textos del juego. Todo el diálogo vive aquí para poder retocarlo sin tocar la lógica.
export interface Line {
  who: string;
  text: string;
}

export interface LevelInfo {
  id: number;
  name: string;
  place: string;
  emoji: string;
  /** Cómo se juega, en una frase: sale en la ficha del capítulo antes de jugarlo. */
  how: string;
}

export const LEVELS: LevelInfo[] = [
  { id: 1, name: 'Jaleo d’ases', place: 'Ferreries, 25 de agosto de 2025', emoji: '🫏', how: 'Ferreries está de fiesta. Pasea, habla con la gente y déjate llevar por el jaleo.' },
  { id: 2, name: 'La piscinita', place: 'Sa Caleta, 26 de agosto de 2025', emoji: '🌙', how: 'Una noche de verano que no quiere acabarse. Esta vez, sin hacer ruido.' },
  { id: 3, name: 'La ruta de las zamburiñas', place: 'Madrid → Marcial → el camping → San Vicente → Logroño', emoji: '🚗', how: 'Un fin de semana en coche hacia el norte. La carretera tiene sus propias reglas.' },
  { id: 4, name: 'Fito bajo las estrellas', place: 'Estadio de Gran Canaria, marzo de 2026', emoji: '🎸', how: 'Gran Canaria y Fito. Antes, un aeropuerto donde nadie te va a decir por dónde ir.' },
  { id: 5, name: 'MotoTrip4life', place: 'Costa Brava, del 30 de abril al 4 de mayo de 2026', emoji: '🏍️', how: 'De paquete por la Costa Brava. Agárrate fuerte y disfruta del camino.' },
  { id: 6, name: 'Sant Joan', place: 'Ciutadella, junio de 2026', emoji: '🐎', how: 'Sant Joan en Ciutadella: caballos, mucha gente y un Gas al que encontrar.' },
  { id: 7, name: 'Cena a escondidas', place: 'Sa Farola, 13 de julio de 2026', emoji: '🍝', how: 'Tus padres salen a cenar. Lo demás, ya lo sabes.' },
  { id: 8, name: 'El eclipse', place: 'Ciutadella, 12 de agosto de 2026', emoji: '🌘', how: 'Un día largo, de los que se recuerdan. No te olvides de mirar al cielo.' },
  { id: 9, name: 'Un año después', place: 'Ferreries, 25 de agosto de 2026', emoji: '💙', how: 'Un año después, otra vez Ferreries. Como la primera vez, pero no igual.' },
];

// Capítulo 1. Els de Ferreries parlen en menorquí; ella, en castellà, i entre ells dos, en castellà.
// El xat d'aquell vespre va tal qual a chats.ts (ferreriesTarde).
export const FERRERIES = {
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 de agosto de 2025. Último día de las fiestas de Sant Bartomeu: el jaleo de burros.' },
    { who: 'Narrador', text: 'Pistolas de agua, purpurina y confeti por todas partes. Has subido con tus amigas. Todavía no le conoces.' },
  ] as Line[],
  /** (4.4.16) La primera charla, partida en dos: primero el regalo y la fiesta; lo de las pomadas, cuando ella vuelve a preguntar. */
  tofolHello: [
    // La primera persona con la que habla en todo el juego: presenta el regalo (inventado: Marc, cámbialo si quieres)
    { who: 'Tòfol', text: 'Ei, al·lota! Jo som en Tòfol. Abans de res, t’he de dir una cosa.' },
    { who: 'Tòfol', text: 'Te lo digo en castellano, que esto es importante: esto no es un juego cualquiera. Es un regalo. Para ti.' },
    { who: 'Tòfol', text: 'Cada capítulo es un trocito de vuestra historia. Se irán abriendo poco a poco.' },
    { who: 'Tòfol', text: 'Nadie te va a decir exactamente qué hacer: mira, escucha a la gente y ve descubriéndolo.' },
    { who: 'Tòfol', text: 'Y al final de cada capítulo te espera un regalo de verdad.' },
    { who: 'Margaux', text: '¿En serio?' },
    { who: 'Tòfol', text: 'Molt en serio. Espero que t’agradi: ell hi ha posat molt d’amor i molt de temps.' },
    { who: 'Tòfol', text: 'Bé, au! I avui aquí mano jo. Benvinguda a Ferreries: darrer dia de Sant Bartomeu.' },
    { who: 'Tòfol', text: 'Tot s’any som un poble tranquil. Avui no: pistoles d’aigua, purpurina, i ases pel mig de sa plaça amb tot es poble ballant-los devora. Aquí ningú torna sec a ca seva.' },
    { who: 'Tòfol', text: 'I alerta, que es jaleo té sa seva màgia. Un ve a passar sa tarda, i no sap mai què se’n durà.' },
    { who: 'Tòfol', text: 'I quan vulguis saber què toca fer avui, me demanes.' },
  ] as Line[],
  tofolQuest: [
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
  /** Si va a verla antes de tiempo: antes de hablar con Tòfol, y mientras busca las pomadas. */
  carmeEarly: [{ who: 'Carme', text: 'Primer vés a veure en Tòfol, que te cerca.' }] as Line[],
  carmePomadas: [{ who: 'Carme', text: 'Primer ses pomades, després ballam!' }] as Line[],
  /** Con el encargo de la pistola: Tòfol ya no la manda a Sa Font. */
  tofolGun: [{ who: 'Tòfol', text: 'Sa pistola de na Carme? Al final des carrer.' }] as Line[],
  /** Junto a Gas, antes de conocerse: para sí. */
  gasPeek: '(¿Y ese de la del Barça?)',
  /** (4.4.13) Antes de bailar, Carme le pide una pistola de agua: la vende un hombre al final del carrer. */
  gunAsk: [
    { who: 'Carme', text: 'Ja era hora! Escolta, m’han robat sa pistola i aquí tothom me banya.' },
    { who: 'Carme', text: 'Me’n compres una? Al final des carrer hi ha un home que en ven.' },
    { who: 'Margaux', text: '¡Voy!' },
  ] as Line[],
  gunWait: [{ who: 'Carme', text: 'Sa pistola! Que me deixen xopa.' }] as Line[],
  gunBuy: [
    { who: 'Venedor', text: 'Pistoles, galledes, pilotes… Què vols, al·lota?' },
    { who: 'Margaux', text: 'Una pistola de agua, por favor.' },
    { who: 'Venedor', text: 'Té, sa més grossa. Que no te mullin!' },
  ] as Line[],
  gunGive: [
    { who: 'Margaux', text: 'Toma: la más grande que había.' },
    { who: 'Carme', text: 'Ets la millor! Ara sí: vina, balla!' },
  ] as Line[],
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
  // (los toast no se ven en el cómic: lo que va entre ¡…! en mayúsculas es una onomatopeya (`comicWord`); lo demás,
  // un bocadillo de quien lo diría)
  hints: {
    pomada: '¡POMADA!',
    luck: '¡SUERTE!',
    /** Lo dice ella, en su bocadillo. */
    dropped: '¡Uiii! Se me ha caído la pomada…',
    droppedAll: '¡Nooo! Se me han caído todas… A por ellas otra vez a las mesas.',
    /** Etiqueta del botón de acción (solo se ve el icono). */
    rear: '¡Ahora! Hazle una caricia',
    perfect: '¡PERFECTA!',
    late: '¡POR LOS PELOS!',
    allLuck: '¡OLÉ!',
    /** Con las tres en la mano, los burros se desbocan: hasta Tòfol sin derramar. Lo dice ella. */
    stampede: 'Ahora a Tòfol, sin que me embista ningún ase…',
    stampedeWord: '¡HIIIAAA!',
    /** Ella, cada vez que se le derrama una. */
    spilled: ['¡Nooo! Se me ha derramado una…', '¡Otra! Esto no llega entero…'],
    arrived: (n: number) =>
      n === 2
        ? [{ who: 'Margaux', text: 'Toma… las que han llegado.' }, { who: 'Tòfol', text: 'Dues de tres. Bé, amb dues ja faig via.' }]
        : [{ who: 'Margaux', text: 'Toma… la que ha llegado.' }, { who: 'Tòfol', text: 'Una?! Bé, sa intenció és lo que compta.' }],
  },
};

/**
 * La gente de la fiesta que no sabe lo que toca: charla normal de jaleo (inventada). El pueblo habla en menorquín;
 * algún forastero, en castellano. who '*': la persona con la que hablas (su nombre lo pone el nivel).
 */
export const FERRERIES_CHATTER: Line[][] = [
  [
    { who: '*', text: 'Ja t’han tirat confeti? Idò ara sí que ets de sa festa.' },
    { who: 'Margaux', text: '¡Tengo purpurina hasta en las orejas!' },
    { who: '*', text: 'Això no se’n va fins a Nadal.' },
  ],
  [{ who: '*', text: 'Uf, quina calor! Me’n vaig a cercar una pomada ben fresca.' }],
  [
    { who: '*', text: 'Aquest vespre hi ha concert a sa plaça. Hi vendràs?' },
    { who: 'Margaux', text: '¡Si me quedan fuerzas!' },
    { who: '*', text: 'Idò ens hi veim!' },
  ],
  [{ who: '*', text: 'Sa meva padrina fa quaranta anys que no es perd es jaleo. És allà, a primera fila.' }],
  [{ who: '*', text: 'Venimos de Barcelona solo para esto. ¡Una locura, eh!' }],
  [
    { who: '*', text: 'T’agrada sa festa?' },
    { who: 'Margaux', text: '¡Me encanta! Es todo tan… vivo.' },
    { who: '*', text: 'Idò espera’t a sa nit, que encara és més bo.' },
  ],
  [{ who: '*', text: 'Compte amb es got, que aquí tothom balla i qualcú te’l tomba.' }],
  [{ who: '*', text: 'He perdut ses meves amigues fa una hora. Si veus tres al·lotes amb diademes de flors, digue’ls que som aquí!' }],
  [
    { who: '*', text: 'Perdona, ¿nos haces una foto?' },
    { who: 'Margaux', text: '¡Claro! Decid «pomada»…' },
    { who: '*', text: '¡Pomadaaa! Gracias, guapa.' },
  ],
  [{ who: '*', text: 'Me’n vaig a ca meva a mudar-me. Estic xop de cap a peus!' }],
  [{ who: '*', text: 'Mi hijo se ha gastado toda el agua de la pistola en mí. Toda.' }],
  [{ who: '*', text: 'Mon pare diu que abans es jaleo era més salvatge. Ho diu cada any.' }],
  [{ who: '*', text: 'Una pomada, dues pomades… i després ja no les compt.' }],
];
/** Si le vuelves a hablar a alguien que ya te ha contado lo suyo. */
export const FERRERIES_BYE = ['Bona festa!', 'Ens veim per aquí!', 'Vés, vés, que es jaleo no espera.', '¡Pásalo bien!', 'Adéu, guapa!'];

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
  night: [{ who: 'Narrador', text: 'Ciutadella, 22 de junio de 2026. Las fiestas de Sant Joan ya han empezado, y esta noche os buscáis entre la gente.' }] as Line[],
  morning: [{ who: 'Narrador', text: '23 de junio. Por la mañana.' }] as Line[],
  bandera: [{ who: 'Narrador', text: 'A las cinco y cuarto se acaba la bandera. Estás en la Plaça Espanya y hay que ir hacia el Born.' }] as Line[],
  // Objetivos: un emoji o dos palabras, sin decir qué hacer (las pistas solo salen si te pierdes)
  huntHint: '📍',
  correus: [{ who: 'Narrador', text: 'Correus. Ni rastro de Gas. Una hora después:' }] as Line[],
  exactHint: '📷 Foto al obelisco',
  /** (21 nov) La foto exacta, con el visor (como la del faro). */
  exactPhoto: { title: 'Que salga el obelisco', ask: 'Una foto del obelisco del Born: así sabrá dónde estoy.', bad: 'Uy, movida… Otra, que se vea bien el obelisco.' },
  /** Lo que contesta Gas a una foto en la que no sale nada que se reconozca (inventado; era un aviso de «que salga el obelisco»). */
  notExact: ['(WhatsApp) ¿Y eso dónde es? 😅', '(WhatsApp) Ni idea de dónde es eso', '(WhatsApp) Algo que se reconozca, pls 🙏'],
  comingHint: '💙',
  /** Gas, cuando la ve entre la gente (inventado). */
  spotted: '¡Azul! ¡Aquí!',
  meet: [{ who: 'Narrador', text: 'Con la foto, Gas te encuentra enseguida.' }] as Line[],
  /** Juntos a Sa Plaça d’es Bè a hacer botar caballos, y a dormir a casa de Azul. */
  toBe: [{ who: 'Gas', text: 'Venga, a Sa Plaça d’es Bè. Planazo: a hacer botar caballos.' }] as Line[],
  /** Cruzar la calle del Born de la mano, sin que os arrolle un caballo (inventado). */
  cross: {
    intro: [
      { who: 'Gas', text: 'Dame la mano. Que con tanta gente y tanto caballo, no te pierdo.' },
      { who: 'Margaux', text: '¿Por dónde cruzamos? No paran de dar vueltas.' },
      { who: 'Gas', text: 'Mira bien y, cuando haya un hueco, corremos. Tonses, al otro lado: Ses Voltes.' },
    ] as Line[],
    hint: '🤝',
    /** Lo grita el caixer del caballo que os arrolla. */
    hit: ['Alerta! Fora des mig!', 'Compte, al·lots!', 'Ep! Que no s\'atura!'],
    ok: 'Vivos. Y de la mano 😌',
  },
  beHint: '🐑 Es Bè',
  beGo: '🐎',
  beCount: (n: number, of: number) => `🐎 ${n}/${of}`,
  /** Un caballo se desboca por Ses Voltes: lo grita su caixer (inventado, en menorquí; era un aviso que decía qué hacer). */
  charge: 'Alerta! Fora des mig!',
  /** Ella, cuando el caballo pasa de largo. */
  chargeOk: '¡Uf! Por poco 😮‍💨',
  beDone: [
    { who: 'Margaux', text: '¿Te vienes a dormir a casa?' },
    { who: 'Gas', text: 'Sí. Vamos.' },
  ] as Line[],
  /** Ya de noche: al taxi de la Plaça Espanya, a paso de Gas. */
  taxiNight: [
    { who: 'Narrador', text: 'Ya es de noche. Después de todo el día de jaleo, Gas casi no puede andar.' },
    { who: 'Gas', text: 'Ay, ay, ay… No siento el pie. Esto es heavy.' },
    { who: 'Margaux', text: 'Agárrate a mí. Cogemos un taxi, está ahí, en la Plaça Espanya.' },
  ] as Line[],
  taxiHint: '🚕',
  /** A medio camino del taxi, Gas tiene que pararse (inventado). */
  rest: { stop: 'Para, para… Un segundo.', pulled: '¡Ay! Que no puedo…', go: 'Venga. Ya.' },
  taxiBtn: '🚕 Subir al taxi',
  taxiPals: [{ who: 'Taxista', text: '¿Adónde vais?' }, { who: 'Margaux', text: 'Camí de sa Farola, por favor.' }] as Line[],
  ride: [{ who: 'Narrador', text: 'De vuelta a casa, por el Camí de sa Farola.' }] as Line[],
  /**
   * Lo que hablan en el taxi, cada uno desde su asiento (inventado entero: Marc, cámbialo por lo que se dijo).
   * El taxista, delante a la izquierda; Azul, a su lado; Gas, detrás.
   */
  rideTalk: [
    { who: 'Taxista', text: 'Qué, ¿mucho jaleo hoy?' },
    { who: 'Margaux', text: 'Todo el día detrás de los caballos.' },
    { who: 'Gas', text: 'Y uno me ha pisado. Durísimo.' },
    { who: 'Taxista', text: 'Ja, ja. Això és Sant Joan.' },
    { who: 'Margaux', text: 'Lleva así desde las diez. Cojo.' },
    { who: 'Gas', text: 'Pero he tocado tres caballos. Tres. Brutal.' },
    { who: 'Taxista', text: 'Bé, bé. Ja quasi som.' },
  ] as Line[],
  /** Al parar delante de casa: pagar (inventado). */
  pay: [
    { who: 'Taxista', text: 'Són dotze euros.' },
    { who: 'Margaux', text: 'Toma. Buenas noches.' },
    { who: 'Taxista', text: 'Bona nit, i que se millori es peu.' },
  ] as Line[],
  home: [{ who: 'Narrador', text: 'De madrugada, en tu casa. Los dos, muertos de sueño.' }] as Line[],
  homeHint: '😴',
  /** La puerta, con las llaves y sin hacer ruido: duerme todo el mundo (inventado). */
  keysBtn: '🔑 Abrir',
  /** Si va a la puerta del porche: la de casa es la de arriba (inventado). */
  porch: 'Por aquí no, que es el porche. Arriba, por la escalera.',
  keys: 'Despacito… que la puerta cruje.',
  sleepBtn: '😴 A dormir',
  after: [{ who: 'Narrador', text: 'Dos días después.' }] as Line[],
  // (los avisos de texto no se ven en el cómic: los aciertos son onomatopeyas de tebeo, comicWord)
  hints: {
    pomada: '¡AVELLANES!',
    luck: '¡SUERTE!',
    rear: '🐎 Tocarle el pecho',
    perfect: '¡TOQUE PERFECTO!',
    late: '¡POR LOS PELOS!',
    /** Onomatopeya del caballo que te aparta. */
    hitWord: '¡PATAPAF!',
    /** Onomatopeya del caballo desbocado. */
    chargeWord: '¡CATACLOC!',
    /** El caixer, cuando su caballo te aparta (inventado; era un aviso «¡Buu! Un caballo te ha pillado»). */
    hit: 'Alerta, al·lota!',
  },
};

/**
 * Sant Joan: la gente del Born, de Ses Voltes y de Es Bè (todo inventado). Hablan de la fiesta, en menorquín o en
 * castellano; una de cada dos sabe lo que te toca y te lo dice a su manera (SANTJOAN_HINTS, por fase).
 * who '*': la persona con la que hablas.
 */
export const SANTJOAN_CHATTER: Line[][] = [
  [{ who: '*', text: 'Has vist es caragol des Born? Quina bogeria, cada any més gent.' }],
  [
    { who: '*', text: 'Primera vegada per Sant Joan?' },
    { who: 'Margaux', text: 'Primera vez de verdad, sí.' },
    { who: '*', text: 'Idò alerta amb els cavalls, que aquí no s\'aturen per ningú.' },
  ],
  [{ who: '*', text: 'Jo vinc cada any des de Barcelona. Això no ho canvio per res.' }],
  [{ who: '*', text: 'Una pomada ben fresca i a esperar que botin els cavalls. Això és Sant Joan.' }],
  [
    { who: '*', text: '¿Tienes avellanas? Toma, que me sobran.' },
    { who: 'Margaux', text: 'Gracias… creo.' },
  ],
  [{ who: '*', text: 'Mon pare diu que abans no hi havia tanta gent. Ho diu cada any.' }],
  [{ who: '*', text: 'He perdut els meus amics fa una hora. Amb tanta gent, impossible.' }],
  [{ who: '*', text: 'Mira-la, la del cavall blanc! Diuen que és el primer any que surt.' }],
  [{ who: '*', text: 'Uf, quina calor. I encara queda tota la nit.' }],
  [
    { who: '*', text: '¿De dónde eres?' },
    { who: 'Margaux', text: 'Italiana y francesa. Bueno, de aquí ya un poco.' },
    { who: '*', text: 'Això és el que passa amb Menorca: ja no te\'n vas.' },
  ],
];
export const SANTJOAN_BYE = ['Bon Sant Joan!', 'Ens veim per aquí!', '¡Pásalo bien!', 'Alerta amb els cavalls!', 'Adéu, guapa!'];
/** Lo que te dicen si saben lo que toca (por fase del capítulo). */
export const SANTJOAN_HINTS: Record<string, string[]> = {
  hunt: ['Correus? A l\'altra banda des Born, l\'edifici groc.', 'Per arribar al Born des de la Plaça Espanya, tot recte per Ses Voltes.', 'Si un cavall s\'aixeca davant teu, toca-li el pit: du sort.'],
  exact: ['¿Te están buscando y no te encuentran? Mándale una foto de algo que se vea desde lejos.', 'Aquí el que no es perd mai és l\'obelisc. Tothom el coneix.'],
  coming: ['Espera aquí, que amb tanta gent costa trobar-se.'],
  nuts: ['Les avellanes es tornen! Tira-les a qui te les tira, quan s\'aturin.', 'Fixa\'t en la diana: quan brilla, és el moment.'],
  be: ['A Sa Plaça d\'es Bè? Per Ses Voltes, tot recte fins al final.', 'A Es Bè els cavalls boten en rotllana. Acosta\'t quan s\'aixequin.'],
  taxi: ['Taxis? A la Plaça Espanya, sempre n\'hi ha un parell.', 'Uf, el teu amic coixeja… Un taxi, que a peu no hi arribau.'],
};

export const ROAD = {
  intro: [
    { who: 'Narrador', text: '24 de octubre de 2025. Él ha preparado un fin de semana por el norte, y te lo manda.' },
  ] as Line[],
  introTrain: [
    { who: 'Narrador', text: '30 de octubre. Él viene a Madrid en tren, y va justísimo.' },
  ] as Line[],
  introGo: [
    { who: 'Narrador', text: 'Da lluvia. Así que coche: el tuyo. Pero conduce él.' },
    { who: 'Narrador', text: 'Por el camino, un juego: parar a comer en el primer restaurante que empiece por M.' },
  ] as Line[],
  /** Una vaca en mitad de la carretera: se para, se la saluda y se le pregunta el camino. */
  cowBtn: '🐄 Saludar a la vaca',
  cowMissed: '¡Que había que parar a saludar a la vaca! Volvemos.',
  /** Al volver al último punto bueno (inventado). */
  rewind: 'Venga, otra vez desde aquí.',
  cows: [
    [
      { who: 'Margaux', text: 'Hola, vaca. ¿Hacia dónde vamos?' },
      { who: 'Vaca', text: 'Muuu.' },
      { who: 'Marc', text: 'Dice que recto.' },
    ],
    [
      { who: 'Margaux', text: 'Otra. Hola. ¿Vamos bien para San Vicente?' },
      { who: 'Vaca', text: 'Muuuuu.' },
      { who: 'Marc', text: 'Eso es un sí. Brutal, se le ve segura.' },
    ],
    [
      { who: 'Margaux', text: 'Perdona, ¿Logroño?' },
      { who: 'Vaca', text: '…Muu.' },
      { who: 'Marc', text: 'Dice que por ahí hay fiesta.' },
    ],
  ] as Line[][],
  notM: (n: string) => `«${n}»… no empieza por M 😅 Aquí no era: volvemos atrás.`,
  /** Al empezar cada tramo: lo que hace falta. */
  /** Al empezar a conducir, una vez: lo que vale en toda la carretera. */
  rules: (max: number) => `Por el camino, fotos 📸. Y ojo: conos, coches y tabaco son golpes; más de ${max} y repetimos el tramo 😘`,
  tramoInfo: (need: number, max: number) => (need > 0 ? `Este tramo: ${need} fotos, y como mucho ${max} golpes (conos, coches o tabaco) 📸` : `Como mucho ${max} golpes en este tramo, ¿eh? 😘`),
  missedM: '¡Eh, que ese empezaba por M! Media vuelta…',
  /** Al llegar al final de un tramo sin las fotos que tocaban (21 nov). */
  fewPhotos: (got: number, need: number) => `Solo ${got} ${got === 1 ? 'foto' : 'fotos'} en este tramo, y quería ${need}. Otra vez desde el principio del tramo.`,
  /** Después de Marcial, en el coche (bocadillos mientras conduce, sin parar): lo del gas. at: metro de la carretera. */
  gasTalk: [
    { at: 830, who: 'Margaux', text: 'Oye, ¿y el gas para el hornillo? ¿Lo llevas?' },
    { at: 910, who: 'Marc', text: 'No. Lo compramos en una gasolinera antes de llegar.' },
    { at: 990, who: 'Margaux', text: '¿Y si no tienen?' },
    { at: 1060, who: 'Marc', text: 'Tendrán. Es camping gas: lo tienen en todas.' },
    { at: 1120, who: 'Margaux', text: 'Confío…' },
    { at: 1200, who: 'Marc', text: 'Mira, ahí hay una. Paramos.' },
  ],
  gasBtn: '⛽ Parar en la gasolinera',
  missedGas: '¡La gasolinera! Nos la hemos pasado. Media vuelta…',
  /** Gas vuelve de la tienda (inventado: Marc, cámbialo si quieres). */
  gasNone: [
    { who: 'Marc', text: 'Nada. No tienen cartuchos.' },
    { who: 'Margaux', text: '«Tendrán», decías.' },
    { who: 'Marc', text: 'Ya improvisaremos en la cabaña. Algo habrá.' },
  ] as Line[],
  marcial: [
    { who: 'Narrador', text: 'Cafetería Marcial. La primera con M. Juego ganado.' },
    { who: 'Narrador', text: '📷 Recuerdo desbloqueado: Cafetería Marcial.' },
  ] as Line[],
  named: [{ who: 'Narrador', text: 'Desde ese día, Marc es Gas.' }] as Line[],
  /** En la Laurel: a qué bar se entra. */
  toBar: 'Al Blanco y Negro, el de la derecha, que tienen los mejores pinchos 🍷',
  arriveSV: [
    { who: 'Narrador', text: 'San Vicente de la Barquera.' },
    { who: 'Marc', text: 'Nos han habilitado aparcamiento especial. Y aparcacoches. Somos VIP.' },
  ] as Line[],
  /** La noche del camping, entre Marcial y San Vicente. */
  camp: [
    { who: 'Narrador', text: 'Esa noche, a una cabaña de leña. Iba a ser cenita de camping: cartas y el camping gas.' },
    { who: 'Narrador', text: 'Ni gas, ni estufa. Esa noche no se cocinó.' },
  ] as Line[],
  // Sin gas: Gas ya sabía que no lo llevaba, contaba con comprarlo en la gasolinera de al lado. No tenían, y la estufa
  // de pellets de la cabaña tampoco sirvió para cocinar (lo que pasó; las frases, inventadas: Marc, cámbialas si quieres)
  // En la cabaña, sin gas (en la gasolinera no tenían): el pollo, directamente encima de la estufa de pellets. Salió
  // mal y no se pudo cocinar (lo que pasó; las frases, inventadas: Marc, cámbialas si quieres)
  campStove: [
    { who: 'Marc', text: 'Bueno. Sin gas, el hornillo no sirve de nada.' },
    { who: 'Margaux', text: '¿Y el pollo?' },
    { who: 'Marc', text: 'Plan B: esa estufa de pellets. Lo ponemos encima, directamente.' },
  ] as Line[],
  pelletTry: [{ who: 'Narrador', text: 'El pollo, directamente encima de la estufa de pellets. ¿Qué podría salir mal?' }] as Line[],
  pelletFail: [
    { who: 'Narrador', text: 'Humo. Mucho humo. Y el pollo, crudo.' },
    { who: 'Margaux', text: 'Marc… creo que así no.' },
    { who: 'Marc', text: 'Vale. Esta noche no se cocina. Tonses, cartas y a dormir.' },
  ] as Line[],
  campHint: {
    estufa: 'La estufa de pellets, la del rincón de la cabaña.',
    abridor: 'El abridor está en la guantera del coche. Fuera, al lado de la cabaña.',
    sofa: 'Ven al sofá, que el vino no se sirve solo.',
  },
  // (21 nov, inventadas: Marc, cámbialas si quieres) Mientras el pollo se hace en la estufa: el abridor y el vino
  wineAsk: [
    { who: 'Marc', text: 'Mientras se hace… ¿abrimos el vino?' },
    { who: 'Margaux', text: '¿Y el abridor?' },
    { who: 'Marc', text: 'En el coche, en la guantera. ¿Vas tú? Yo vigilo el pollo.' },
  ] as Line[],
  wineFound: '¡Aquí está! Abridor encontrado 🍷',
  wineSofa: [
    { who: 'Narrador', text: 'Vino en el sofá, mientras el pollo se hace en la estufa.' },
    { who: 'Margaux', text: 'Esto sí que es un plan.' },
    { who: 'Marc', text: 'Por la aventura.' },
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
  hit: ['¡BUU!', '¡PUMBA!', '¡BUU BUU!'],
  hitLine: 'Como negocias, eh',
  smoke: ['¿Otra vez? 🚭', 'Eso no es una foto, es un paquete de tabaco… 🚭', 'Te lo requiso. Por tu bien. 🚭'],
  turbo: '¡TURBO!',
  nearMiss: '¡POR LOS PELOS!',
  combo: (n: number) => `¡${n} FOTOS!`,
  stops: ['Madrid', 'San Vicente', 'Logroño'],
  /** «Si da lluvia, coshe»: la tromba de Cantabria. */
  storm: 'Madre mía, qué tromba. No veo nada…',
  stormOff: 'Ya escampa ☀️',
  zamb: { served: '¡AL PLATO!', burnt: '¡QUEMADA!', raw: 'Todavía está cruda', rule: 'Cuando estén doraditas, al plato. Ni antes ni después.' },
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
    { who: 'Margaux', text: '¡Uy! Otra maleta…' },
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
  /** En una puerta que no es la suya (lee la pantalla). */
  wrongGate: (to: string) => `${to}… Esta no es la mía.`,
  /** Al empezar, en Barajas (inventado). */
  whichGate: 'Vale. ¿Y mi puerta cuál era?',
  landed: [{ who: 'Narrador', text: 'Esa noche, en Gran Canaria.' }] as Line[],
  /** En la cafetería de en medio de llegadas: no es esa (inventado). */
  otherCafe: 'Aquí no está… «Justo en la salida», dijo.',
  /** En la cafetería de llegadas, donde la esperaba Gas («dentro aún»). Lo del chat ya se ha leído: aquí, en persona (inventado). */
  arrivalsMeet: [
    { who: 'Gas', text: '¡Por fin! Ya pensaba que te quedabas en Madrid.' },
    { who: 'Margaux', text: '¡Qué va! 26D, pasillo. Ni tan mal.' },
    { who: 'Gas', text: 'Pues vámonos, que el coche vip nos espera. Y mañana, Fito. Planazo.' },
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
    { who: 'Margaux', text: 'Se lo grabo. Que no se me escape Fito del encuadre.' },
  ] as Line[],
  /** (inventado) */
  filmDone: 'Grabado. Ya lo verá.',
  /** Gas, buscándola sin chat delante (inventado). */
  seekAgain: '¿Dónde se ha metido ahora?',
  /** Cada canción que pasa mientras la busca (inventado). */
  songLost: ['Pfff. Otra canción que me pierdo.', 'Y otra… ¿Dónde está?', 'Fito ya va por la siguiente.'],
  found: [
    [
      { who: 'Gas', text: '¡Por fin! Flipas, con tanta gente no veía nada.' },
      { who: 'Margaux', text: 'Te he grabado el temón. Toma.' },
    ],
    [{ who: 'Gas', text: '¡Aquí estás! Te has movido…' }],
    [{ who: 'Gas', text: 'Ahora sí. No me muevo de aquí, tierna.' }],
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
  /** Lo que se dice en la cola de los baños mientras Gas espera (inventado). */
  queueBanter: ['¡Venga, que se acaba el concierto!', '¿Pero qué hace ahí dentro tanto rato?', 'Tres averiadas, mi niño. Tres.', 'Esta me la sé… ¡y me la estoy perdiendo!', '¡Toc, toc! ¿Te queda mucho?'],
  gasSmoke: { who: 'Gas', text: '¿Y el tabaco? ¿A la papelera? Esa es mi Azul.' } as Line,
  /** Al acabar el ritmo (inventado). */
  rhythmDone: (hits: number, total: number) => `¡${hits} de ${total}! Qué concierto.`,
  ending: [{ who: 'Narrador', text: 'Lunes 16 de marzo. Cada uno vuelve a su ciudad.' }] as Line[],
};

// Capítulo 2: los chats de esa noche van tal cual en src/data/chats.ts (imperi, pins, cesped, meGustas).
export const NIGHT = {
  /** La gente suelta del centro de Ciutadella: solo saludan (Marc, 4.4.2). */
  passerHi: (male: boolean) =>
    [
      { who: male ? 'Un ciutadellenc' : 'Una ciutadellenca', text: 'Hey! Tot bé?' },
      { who: 'Margaux', text: 'Sí, gracias.' },
    ] as Line[],
  intro: [{ who: 'Narrador', text: 'Ciutadella. 26 de agosto de 2025. Toda la tarde escribiéndoos. Él se va mañana.' }] as Line[],
  arrive: [{ who: 'Narrador', text: 'Sa Son 69 B4. Sus padres duermen.' }] as Line[],
  /** En la terraza del Imperi, antes de irse. */
  bye: [
    { who: 'Amiga', text: '¿Ya te vas? ¿Y con quién, si se puede saber? 👀' },
    { who: 'Margaux', text: 'Con nadie… 🙃' },
    { who: 'Amigo', text: 'Ya, ya. Con nadie. Pásalo bien 😏' },
  ] as Line[],
  noBye: 'Uy… que no me he despedido de estos.',
  /** Al llegar: por dónde se entra sin hacer ruido. */
  sideWay: 'Por el lateral, que la puerta se oye desde arriba 🤫',
  towelsAsk: '¿Y las toallas? Las dejé en la mesa de la terraza.',
  towelsGot: 'Eso. Y ahora, a la piscina… despacito.',
  sneakLight: '¡Shh! ¡Quieta! La luz de arriba…',
  sneakLightOff: '…Vale. Se ha apagado. Sigue.',
  /** El ruido al tope: se abre la ventana de sus padres. Si se queda quieta, se salva. */
  alertWho: '¡Han abierto la ventana! Ni respires…',
  alertSafe: 'Uf… la han cerrado. Más despacito, que despacio no se oye.',
  /** Se ha movido con la ventana abierta: otra vez desde la entrada (o desde el último punto). */
  caughtWho: '¡Nos han visto! Otra vez, y más despacito…',
  /** Ya en el agua, antes de nada (lo de su chat de esa tarde, casi literal). */
  smallPool: [
    { who: 'Gas', text: 'Y sí, esa es mi piscina… si es que se le puede llamar como tal.' },
    { who: 'Gas', text: 'Es muy pequeñita.' },
  ] as Line[],
  mpRules: 'Yo cierro los ojos. Digo «Marco» y tú «Polo»… y si te oigo chapotear, voy a por ti 😏',
  getOut: 'Me estoy quedando helado… ¿Nos tumbamos un rato?',
  /** En el coche, del Born a casa (bocadillos, sin parar el viaje). */
  drive: [
    { who: 'Gas', text: '¡Hola! ¿Qué tal?' },
    { who: 'Margaux', text: 'Bien, bien… ¿y tú?' },
    { who: 'Gas', text: 'Bien. Oye… vas muy guapa.' },
    { who: 'Margaux', text: 'Jajaja, gracias. Qué random todo, ¿no?' },
    { who: 'Gas', text: 'Un poco. A mí me gusta lo random.' },
    { who: 'Gas', text: 'Te voy a pedir una cosa: en casa, silencio. Mis padres duermen.' },
    { who: 'Margaux', text: 'Silencio full. Prometido 🤫' },
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
    // (inventado salvo la idea de Gas: Marc, retócalo si quieres)
    { who: 'Marc', text: 'Mira eso. Aquí no hay ni una luz y se ven todas.' },
    { who: 'Margaux', text: 'Es increíble. En Madrid no se ve ni una.' },
    { who: 'Marc', text: '¿Sabes? Uno de mis objetivos en la vida es vivir en un sitio donde pueda aparcar en la puerta de casa…' },
    { who: 'Marc', text: '…y donde me baste con levantar la cabeza para ver unas estrellas como estas.' },
    { who: 'Margaux', text: 'Suena a muy buen plan.' },
  ] as Line[],
  lie: [{ who: 'Narrador', text: 'Une estrellas tocándolas una detrás de otra y cierra la figura volviendo a la primera. Entre todas, hay un corazón.' }] as Line[],
  lightOn: '💡 Se ha encendido una luz arriba… ¡quieta!',
  caught: [{ who: 'Narrador', text: 'Se enciende una ventana. Quietos… y se apaga. Otra vez, despacito.' }] as Line[],
  /** En el agua: se enciende la luz de arriba y hay que quedarse quieta. */
  freeze: '💡 ¡La luz de arriba! Quieta, que no se mueva el agua',
  freezeMoved: 'Gas: «¡Shhh! ¡Quieta!»',
  freezeOff: 'Se apaga. Uf.',
};

// Crucigrama antes de la carta: lo del final.
// Capítulo 7: la cena a escondidas en casa de los padres de Azul, 13 de julio de 2026.
// Los chats van tal cual en src/data/chats.ts (cenaMenu, cenaEspera, cenaPronto, cenaVen, teQuiero, jazzbah).
export const CENA = {
  /** El día, desde la tarde: el plan con Gas (a qué hora bajan tus padres) y luego qué se cocina. */
  dayIntro: [{ who: 'Narrador', text: '13 de julio de 2026. Esta noche tus padres bajan a cenar fuera. Y tú tienes un plan.' }] as Line[],
  menuIntro: [{ who: 'Narrador', text: '19:43. Falta lo más importante: qué se cocina.' }] as Line[],
  intro: [{ who: 'Narrador', text: 'Sa Farola, 13 de julio de 2026. Tus padres salen a cenar. Gas espera en un lugar estratégico, con la moto.' }] as Line[],
  /** Lo que le vas escribiendo mientras tus padres no acaban de irse (mensajes tuyos de esa noche). */
  waitEvents: ['Aun estan', 'Sale mi padre ahora', 'Que hace mi padre top', 'Tio'],
  // Gas llega y espera en la cancela. (La primera sale del chat de esa tarde, «Cuando me digas voy y tardo 30 sec»;
  // las otras dos son inventadas: Marc, cámbialas por lo que dijisteis)
  atGate: 'Ya estoy. Treinta segundos, dije.',
  atGateWait: 'Ábreme, que me van a ver los vecinos.',
  letIn: 'Shhh. Pasa, pasa.',
  // Tal cual en el chat: el del bacon era él, y la italiana es ella
  cookIntro: [
    { who: 'Gas', text: 'Bacon iba bien si tenías.' },
    { who: 'Margaux', text: '¿Qué dices? Guanciale. Y ni se te ocurra la nata.' },
    { who: 'Gas', text: 'Vale, vale. El 10 es la carbonara.' },
  ] as Line[],
  // Antes de cocinar, los ingredientes por el patio (paso nuevo, inventado: Marc, cámbialo si quieres)
  pantryAsk: [
    { who: 'Gas', text: '¿Y dónde guardáis las cosas? Yo aquí no encuentro nada.' },
    { who: 'Margaux', text: 'Mi madre lo deja todo por ahí. Busca conmigo, tierno.' },
  ] as Line[],
  /** Lo que dice ella al coger cada cosa. */
  pantry: { cesta: '🥚 Huevos y espaguetis.', queso: '🧀 El pecorino.', nevera: '🥓 Guanciale. El de verdad.' },
  pantryBacon: 'Bacon no. Esto es una carbonara.',
  pantryNata: 'Nata… ni de broma.',
  /** Gas, si tardas: una pista por cada cosa que falta. */
  pantryHints: { cesta: '¿Los huevos no estarán en la cesta de la cocina?', queso: 'El queso lo he visto en la mesa del jardín, ¿no?', nevera: 'La carne estará en la nevera de abajo. Entra por la puerta del porche.' },
  pantryDone: 'Ya está todo. Al fuego.',
  /** Lo que dice Gas mientras cocinas (los dice él, en su bocadillo). */
  steps: {
    guanciale: 'Toca cuando el guanciale esté dorado 🥓',
    pasta: 'Escurre la pasta al dente ⏱️',
    mix: 'Mezcla fuera del fuego: que no se cuaje 🥚',
    nata: '¿Nata? ¿Tú? ¿La italiana? 🙄',
    scrambled: 'Buu. Huevos revueltos.',
    burnt: 'Buu. Guanciale quemado.',
    raw: 'Todavía está dura.',
  },
  /** La nota de Gas (en su bocadillo). */
  grade: (n: number) =>
    n >= 10 ? 'El 10 es la carbonara.'
    : n >= 9 ? `Un ${n}. Casi casi.`
    : n >= 8 ? `Un ${n}. Regulín, pero pasa.`
    : n === 7 ? 'Un 7. Así no: otra vez.'
    : n === 6 ? 'Un 6’75. Otra vez.'
    : `Un ${n}… Otra vez.`,
  // Antes de cenar, la guirnalda de la terraza (inventado: Marc, cámbialo si no fue así)
  lightsHint: '¿Encendemos las lucecitas?',
  lightsOn: 'Así sí.',
  // La cena: lo que hablaron por el chat esa tarde (cenaPlan, 16:10), dicho en la mesa
  dinner: [
    { who: 'Narrador', text: 'Cenáis con un ojo en la puerta y otro en el reloj.' },
    { who: 'Margaux', text: 'Si a las 9.30 se sientan, imposible que terminen antes de las 11.30.' },
    { who: 'Gas', text: 'A partir de las 22.50 yo lo pasaré mal.' },
    { who: 'Margaux', text: 'Tranqui, le diré a mi madre que me avise.' },
  ] as Line[],
  /** Se acaba la cena (del mismo chat: «A partir de 22.50 yo lo pasaré mal»). */
  lateNow: 'Casi las 22.50…',
  /** Unos faros en la calle: ¿son tus padres? (No lo eran: volvieron a la 1.30.) */
  alarm: [
    { who: 'Gas', text: '¿Eso es un coche?' },
    { who: 'Margaux', text: '¡Son mis padres! ¡Recoge, recoge!' },
  ] as Line[],
  // Gas, nada más levantarse (inventado; antes era un aviso de texto)
  alarmHint: '¡Los platos y la sartén, rápido!',
  /** Lo que dice ella al quitar cada cosa de en medio. */
  alarmItems: { plates: '🍽️ ¡Platos, fuera!', pan: '🍳 ¡Sartén, fuera!', helmet: '🪖 Casco escondido.' },
  falseAlarm: [
    { who: 'Narrador', text: 'El coche pasa de largo. Era el del vecino.' },
    { who: 'Gas', text: 'Casi me da algo. Heavy.' },
    { who: 'Margaux', text: 'Pero por si acaso, vete ya, tierno.' },
  ] as Line[],
  falseAlarmLate: [
    { who: 'Narrador', text: 'El coche pasa de largo. Era el del vecino. Menos mal, porque aún estaba todo por en medio.' },
    { who: 'Gas', text: 'Casi me da algo. Heavy.' },
    { who: 'Margaux', text: 'Pero por si acaso, vete ya, tierno.' },
  ] as Line[],
  // Antes de irse, su casco (inventado: Marc, cámbialo por lo que dijisteis al despediros)
  /** Antes de irse, a la cancela: que le acompañe (inventado). */
  helmetAsk: '¿Me acompañas a la puerta?',
  helmetNag: '¿No me vas a decir adiós?',
  bye: 'Corre, que no vuelvan. 🤍',
  /** Al irse en la moto, antes de dejar la mesa como estaba. */
  gone: [{ who: 'Narrador', text: '22:50. Gas se va en la moto justo a tiempo.' }] as Line[],
  leave: [{ who: 'Narrador', text: 'Tú subes a la cama. Tus padres siguen sin volver.' }] as Line[],
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
  // Palabras de nuestro año (21 nov: fuera las que no pintaban nada, como arroz o mullet); la cuadrícula la encaja
  // un script para que quepa a lo ancho en el móvil, y las casillas con círculo, en orden, dicen el mensaje
  intro: 'Los círculos esconden algo.',
  hidden: 'ERES MI AZUL',
  rows: 16,
  cols: 13,
  clues: [
    { answer: 'GUAPISSIMA', row: 8, col: 2, dir: 'A', clue: "«Bona nit ..., muchas ganas de dormir contigo»", mark: 5, hiddenIdx: 3 },
    { answer: 'CARBONARA', row: 7, col: 4, dir: 'D', clue: "«El 10 es la ...»: la cena a escondidas en Sa Farola", mark: 2, hiddenIdx: 1 },
    { answer: 'ZAMBURIÑA', row: 6, col: 10, dir: 'D', clue: "«No habrá mejor ... en el mundo que la de San Vicente»", mark: 0, hiddenIdx: 7 },
    { answer: 'SUDADERA', row: 8, col: 8, dir: 'D', clue: "«Por mucho que quieras la ..., no quiero dates incómodos»", mark: 5, hiddenIdx: 0 },
    { answer: 'CABALLOS', row: 1, col: 7, dir: 'D', clue: "Sant Joan: «Pero he tocado tres ...»", mark: -1, hiddenIdx: -1 },
    { answer: 'TORTILLA', row: 5, col: 1, dir: 'A', clue: "De sobrassada y queso: «de las mejores que he probado en mi vida»", mark: 5, hiddenIdx: 9 },
    { answer: 'ECLIPSE', row: 1, col: 6, dir: 'A', clue: "12 de agosto de 2026: lo miramos juntos en Ciutadella", mark: -1, hiddenIdx: -1 },
    { answer: 'MILAN', row: 15, col: 1, dir: 'A', clue: "«Mañana es derby day: ...-Inter»", mark: 0, hiddenIdx: 4 },
    { answer: 'LAUREL', row: 11, col: 7, dir: 'A', clue: "La calle de los pinchos en Logroño", mark: -1, hiddenIdx: -1 },
    { answer: 'VOLEY', row: 9, col: 12, dir: 'D', clue: "«Te quiero ver jugar a ...: me da curiosidad»", mark: 3, hiddenIdx: 2 },
    { answer: 'OJOS', row: 11, col: 2, dir: 'A', clue: "«Need esos ...» (la primera tarde, a las 19:48)", mark: -1, hiddenIdx: -1 },
    { answer: 'OPORTO', row: 1, col: 1, dir: 'D', clue: "«¿Y por qué tantas ganas de ir a ...?» (el plan B de octubre)", mark: -1, hiddenIdx: -1 },
    { answer: 'CARTA', row: 14, col: 6, dir: 'A', clue: "«Estoy feliz de que te haya gustado recibir la ... y las fotos»", mark: -1, hiddenIdx: -1 },
    { answer: 'FITO', row: 0, col: 9, dir: 'D', clue: "«Pilla 2 entradas para ...»", mark: 1, hiddenIdx: 5 },
    { answer: 'JOY', row: 10, col: 2, dir: 'D', clue: "«3 abrazos pa ti, de mi parte y de la de ...»", mark: -1, hiddenIdx: -1 },
    { answer: 'GAS', row: 13, col: 3, dir: 'A', clue: "Mi mote, desde una noche de camping sin hornillo", mark: -1, hiddenIdx: -1 },
    { answer: 'ASES', row: 0, col: 11, dir: 'D', clue: "Ferreries, 25 de agosto de 2025: jaleo d’...", mark: 0, hiddenIdx: 6 },
    { answer: 'SURF', row: 3, col: 3, dir: 'D', clue: "«El plan de los 5 días es easy: ..., playa…»", mark: 1, hiddenIdx: 8 },
    { answer: 'DOGFY', row: 1, col: 0, dir: 'A', clue: "Trabajo Marc", mark: -1, hiddenIdx: -1 },
    { answer: 'TONSES', row: 3, col: 0, dir: 'A', clue: "Cómo digo yo «entonces»", mark: -1, hiddenIdx: -1 },
  ] as CrossClue[],
  solved: '¿Lo ves? Brutal. 💙',
};

// Capítulo 5: la Costa Brava en moto (30 de abril – 4 de mayo de 2026). Chats: motoPlan, mochila, motoTrip.
export const MOTO = {
  intro: [
    { who: 'Narrador', text: 'Barcelona, abril de 2026. Él lo organiza todo: moto alquilada, dos noches en L’Escala.' },
    { who: 'Narrador', text: 'Tú no has ido nunca tanto rato de paquete.' },
  ] as Line[],
  packIntro: [{ who: 'Narrador', text: 'La víspera, a las 00:44, te manda la lista de la mochila. Hazla tal cual: no cabe nada más.' }] as Line[],
  ride: [{ who: 'Narrador', text: 'Sábado. De L’Escala hacia Cap de Creus por la costa.' }] as Line[],
  /**
   * Lo que se dicen por el camino, cada uno desde su asiento (llevan intercomunicador en el casco). at: dónde de la
   * ruta (0 a 1). Las dos primeras son las normas que Gas daba antes de salir. [inventada]: no sale de la historia.
   */
  talk: [
    { at: 0.03, who: 'Gas', text: 'Tú solo acompaña las curvas conmigo. Si yo me inclino, tú también.' },
    { at: 0.07, who: 'Gas', text: 'Y si viene una moto de frente, se saluda. A los coches, no.' },
    { at: 0.3, who: 'Gas', text: 'Más pegaítos, con el aire en la cara.' },
    { at: 0.32, who: 'Margaux', text: 'Ay, que eres lo mejor, te juro.' },
    { at: 0.45, who: 'Gas', text: '¿Ves? Ni tacones ni secador.' },
    // [inventadas]
    { at: 0.535, who: 'Gas', text: 'Parc Natural de Cap de Creus. Ya casi. Brutal, ¿eh?' },
    { at: 0.77, who: 'Gas', text: 'Mira, allí enfrente: Cadaqués.' },
    { at: 0.9, who: 'Margaux', text: '¿Aquello blanco es el faro, amore?' },
    { at: 0.915, who: 'Gas', text: 'El de Cap de Creus. Lo más al este de la Península.' },
  ] as (Line & { at: number })[],
  wave: {
    btn: '✌️ Saludar',
    /** (Gas, al ver que saludas bien, a un coche o que no contestas) [inventadas] */
    ok: ['Eso es. Saludo motero ✌️', 'Te ha devuelto el saludo.', 'Hermandad de la carretera.'],
    car: ['¡A los coches no se les saluda! 😂', 'Eso era un coche…', 'El del coche no entiende nada.'],
    missed: 'Te ha saludado… ¡y tú nada!',
  },
  photoHint: '📷 ¡Foto!',
  /** En cada apartadero de ida, ya parados: ella, antes de arrancar (lo pidió Marc), y Gas si no hace la foto. */
  bayGo: 'Qué bonito… ¡Vámonos!',
  bayNag: '¿No le haces una foto?',
  /** El túnel: el brrruuum de dentro (inventado salvo la idea). */
  tunnel: {
    warn: 'Túnel. Ya sabes lo que toca dentro…',
    btn: '🏍️ ¡Brrruuum!',
    ok: '¡JAJAJA! ¡Flipas cómo retumba!',
    miss: '¡Eh! En los túneles se hace brrruuum. Otra vez.',
  },
  /** (ella, al sacar la foto en un mirador) [inventadas] */
  photoOk: ['¡Qué bonito! 📷', 'Otra para el álbum.', 'Esta es la buena.'],
  /** (Gas, cuando no le acompañas en la curva) [inventadas] */
  lean: { bad: ['¡Échate conmigo, que me sacas de la curva!', 'Acompaña, acompaña…', 'Conmigo, conmigo.'] },
  /** La tramontana de Cap de Creus: rachas de viento, hay que echarse contra el viento. [inventada] */
  wind: '¡Tramontana! Agárrate y échate contra el viento.',
  windBad: '¡Que nos lleva!',
  windOff: 'Pasó la racha 😮‍💨',
  /** Al llegar a la valla [inventada] */
  closed: 'Anda… cortada.',
  creus: [
    { who: 'Narrador', text: 'El faro de Cap de Creus, ahí delante… y la carretera, cortada. El último tramo está cerrado.' },
    { who: 'Narrador', text: 'Hasta aquí llegasteis. Media vuelta, con el faro de fondo.' },
  ] as Line[],
  /** La foto del faro antes de dar la vuelta (paso nuevo). [inventadas] */
  faroAsk: '¿Le haces una al faro antes de dar la vuelta?',
  faroLost: 'Venga, la foto del faro, que nos vamos.',
  faroPhoto: {
    btn: '📷 El faro',
    title: 'Que salga el faro entero',
    zones: ['Torcida', 'El faro', 'Cortado'],
    good: 'Ya está. El faro y la valla, para que conste.',
    bad: 'Uy, torcida. Otra.',
    meh: 'Bueno… se intuye el faro.',
  },
  /** Media vuelta y a la cala (pasos nuevos). [inventadas] */
  uturn: 'Media vuelta. ¿Has visto antes ese campo de rosas?',
  calaStop: 'Aquí, junto a las rosas. Paramos un rato.',
  back: [
    { who: 'Narrador', text: 'Esa noche, cena y helado en L’Escala. Con el conjunto de paseo, claro.' },
    { who: 'Narrador', text: 'El lunes por la mañana devolvéis la moto.' },
  ] as Line[],
  stats: (fluid: number, photos: number, waves: number, motos: number, wrong: number) =>
    [['Curvas fluidas', `${fluid}%`], ['Saludos moteros', `${waves}/${motos}${wrong ? ` · ${wrong} a coches 🚗` : ''}`], ['Fotos', `${photos}/4`]] as [string, string][],
  pack: [
    { icon: '🏍️', label: 'Conjunto de moto', ok: true },
    { icon: '👕', label: '2 camisetas finas', ok: true },
    { icon: '👟', label: 'Zapatillas Nike', ok: true },
    { icon: '🧦', label: '3 calcetines largos', ok: true },
    { icon: '🍦', label: 'Ropa de paseo', ok: true },
    { icon: '👙', label: 'Biquinis y vestidito', ok: true },
    { icon: '🌙', label: 'Pijama', ok: true },
    { icon: '💍', label: 'Joyitas, gafas, reloj', ok: true },
    { icon: '👠', label: 'Tacones', ok: false },
    { icon: '💇‍♀️', label: 'Plancha del pelo', ok: false },
    { icon: '🧳', label: 'Maleta de ruedas', ok: false },
    { icon: '👗', label: 'Un tercer vestido', ok: false },
    { icon: '💨', label: 'Secador', ok: false },
    { icon: '🥾', label: 'Botas de montaña', ok: false },
  ],
};

// Capítulo 8: el día del eclipse, 12 de agosto de 2026. Chats: eclipseReady, eclipseCoche, eclipseFin, luna.
// Los avisos ya no son letreros (en el tebeo no se ven): los dice alguien en su bocadillo. Los objetivos, mínimos.
// «(inventado)»: textos nuevos que no salen de la historia, para cambiarlos por lo que pasó de verdad.
export const ECLIPSE = {
  kayakIntro: [
    { who: 'Narrador', text: 'El plan de Gas: ver el eclipse desde el mar, en kayak, de Sa Farola hacia Sa Caleta.' },
  ] as Line[],
  kayakHint: '🛶 Sa Caleta',
  ferryWarn: '¡¡Un ferry!! ⛴️',
  kayakEnd: [
    { who: 'Gas', text: 'Tu padre tenía razón.' },
    { who: 'Narrador', text: 'Vale. Ese plan nunca pasó: al final no hubo kayak.' },
    { who: 'Narrador', text: 'Y menos mal. Así empieza el día de verdad.' },
  ] as Line[],
  arriveAzul: [
    { who: 'Narrador', text: 'Ya en casa de tus padres, juntos, en su coche. Hoy los conoce.' },
  ] as Line[],
  dateIntro: [{ who: 'Narrador', text: '12 de agosto, en Menorca.' }] as Line[],
  parentsHint: '👋',
  meetAzulParents: [
    { who: 'Gas', text: 'Hola, encantado. Soy Marc.' },
    { who: 'Narrador', text: 'Tus padres le miran de arriba abajo. Aprobado. Creo.' },
    { who: 'Margaux', text: 'Vamos a dar una vuelta con Joy y Eric.' },
  ] as Line[],
  walkHint: 'Sa Farola',
  /** (inventado) Llegando al faro, Joy se va calle arriba a oler algo y hay que ir a por él. */
  joyRuns: '¡Joy! ¿Adónde vas? Se ha ido a oler algo 🙄',
  joyBtn: '🐕 ¡Joy, ven!',
  joyCall: '¡Joy! Ven aquí, bonito.',
  walkDone: [
    { who: 'Narrador', text: 'Eric quiere ir a hombros. Joy quiere ir a todas partes.' },
    { who: 'Margaux', text: 'Venga, para casa, que se nos hace tarde.' },
    // (inventado) para el salto de horas: llegan a mediodía y se van hacia las ocho
    { who: 'Narrador', text: 'Entre una cosa y otra, se os pasa la tarde.' },
  ] as Line[],
  backHint: '🏡',
  byeBtn: '👋 Despedirse',
  byeDad: [
    { who: 'Margaux', text: 'Papá, nos tenemos que ir, que si no, no llegamos a ver el eclipse.' },
    { who: 'Gas', text: 'Lo vamos a ver desde las rocas, cerca de mi casa. Encantado, de verdad.' },
    { who: 'Padre de Azul', text: 'Id, id. Y nada de kayak, ¿eh?' },
    { who: 'Gas', text: 'Nada de kayak.' },
  ] as Line[],
  carHint: '🚗',
  carBtn: '🚗 Subir al coche',
  driveIntro: [{ who: 'Narrador', text: 'Ahora, a casa de Gas. Toca aparcar marcha atrás dentro, en la entrada.' }] as Line[],
  parkHint: '🅿️',
  /** (inventado) Ella le guía desde el asiento de al lado. */
  parkGuide: 'Marcha atrás y por la corredera. Yo te aviso 😏',
  parkBump: 'Uy, el muro 😬',
  parkOk: 'Aparcado. A la primera (casi) 🅿️',
  /** El reloj: en cuanto os vais, cuenta hacia atrás hasta el eclipse. */
  clockLow: 'Que no llegamos, eh',
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
    { who: 'Gas', text: 'Bueno, tonses nos vamos a las rocas, que empieza el eclipse.' },
    { who: 'Narrador', text: 'Ahora sí: los cuatro padres, en un solo día.' },
  ] as Line[],
  rocks: [
    { who: 'Narrador', text: 'Por fin solos. A la roca de Es Castellar, a esperar el eclipse.' },
    { who: 'Gas', text: '¿Una partida a Love Letter mientras tanto?' },
  ] as Line[],
  afterCards: [{ who: 'Narrador', text: 'Le has ganado. Como siempre. Y empieza el eclipse.' }] as Line[],
  glassesHint: '🕶️',
  noGlasses: '¡Sin gafas no, que te quemas los ojos! 🕶️',
  kitchenHint: '👋',
  /** (inventado) En la totalidad, y solo entonces, se pueden quitar las gafas para ver la corona. */
  totality: '¡Ya está! Ahora sí: fuera gafas, que se puede mirar 😎',
  totalityNag: 'Quítatelas, que dura nada',
  end: [
    { who: 'Narrador', text: 'La luna tapa el sol. Se hace de noche un momento.' },
    { who: 'Narrador', text: 'Y una foto de los dos, con las gafas puestas, en el momento exacto.' },
  ] as Line[],
  stats: (rounds: number, parkTries: number) => [['Rondas de Love Letter', `${rounds}`], ['Intentos aparcando', `${parkTries}`]] as [string, string][],
};

// Capítulo 9: un año después, otra vez Ferreries. Como en el 1, el pueblo habla en menorquín y ella y Gas, en castellano. Chats: bocata (esa tarde) y fecha.
export const ANIVERSARIO = {
  ...FERRERIES,
  intro: [
    { who: 'Narrador', text: 'Ferreries. 25 de agosto de 2026, Sant Bartomeu. Un año justo.' },
    { who: 'Narrador', text: 'Esta vez ya le conoces. Y está por el pueblo, en algún sitio.' },
  ] as Line[],
  tofolHello: [] as Line[],
  tofolQuest: [
    { who: 'Tòfol', text: 'Tu altra vegada! I aquest any acompanyada.' },
    { who: 'Tòfol', text: 'Ja sabeu com va: tres pomades i tres carícies, però ara a dues mans.' },
  ] as Line[],
  tofolDone: [
    { who: 'Margaux', text: 'Toma, tus pomadas. Otro año más.' },
    { who: 'Tòfol', text: 'Ja sou més de Ferreries que jo.' },
    // (inventado: antes era «I ara, que és Sant Bartomeu, un petó»; ahora el beso llega bailando en Sa Font)
    { who: 'Tòfol', text: 'I ara, cap a Sa Font a ballar, que allà va començar tot.' },
  ] as Line[],
  tofolAgain: [{ who: 'Tòfol', text: 'Encara aquí? Vinga, que es jaleo no espera!' }] as Line[],
  september: [{ who: 'Narrador', text: 'Septiembre. Gas se apunta a vóley playa.' }] as Line[],
  october: [{ who: 'Narrador', text: 'Octubre. Joy, listo para campeonatos.' }] as Line[],
  carme: [{ who: 'Carme', text: 'Ell és per aquí. Segueix sa ubicació!' }] as Line[],
  marcMeet: [
    { who: 'Marc', text: 'Ya era hora. Un año justo, ¿eh?' },
    // (inventado: antes «Y sigues bailando igual»; cuando le encuentra está con su bocata, como en el chat)
    { who: 'Margaux', text: 'Un año. Y tú, con tu bocata.' },
  ] as Line[],
  smallTalk: [
    { who: 'Marc', text: 'El año pasado tuve que hablar con Carme para presentarme.' },
    { who: 'Marc', text: 'Este año ya no me hace falta excusa.' },
  ] as Line[],
  hints: { ...FERRERIES.hints },
};

/**
 * Capítulo 9: lo que dice Gas cuando va al lado de Azul y lo de la búsqueda por ubicaciones. Todo inventado
 * (salvo «Tres caricias, y esta vez juntos», que ya estaba) para que el dueño lo cambie por lo que pasó.
 */
export const ANIVERSARIO_GAS = {
  /** Si tarda en llegar a la ubicación, se la vuelve a mandar. */
  again: '(WhatsApp) 📍 Ubicación',
  /** Llega a la primera ubicación y ya no está. */
  notHere: 'Aquí no está… ¿Dónde se ha metido?',
  allLuck: 'Tres caricias, y esta vez juntos 👏',
  stampede: 'Ahora a Tòfol, que no nos embista ningún ase 😂',
  toFont: '¿Vamos? Donde nos conocimos 💙',
  carmeAfter: [{ who: 'Carme', text: 'Mira-los! Un any ja… Vinga, a ballar!' }] as Line[],
};

// Minijuegos cortos que salen al acabar algunos capítulos (y desde el mapa).
export const MINIS = {
  pack: {
    title: 'La mochila',
    hint: 'Solo lo de la lista de Gas: en la moto no cabe nada más.',
    nope: 'Ma menos. Eso no estaba en la lista.',
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
  tricks: {
    title: 'Adiestrar a Joy',
    hint: 'Gas da la orden: toca el gesto correcto. Hasta que no los haga todos, no hay circuito',
    commands: [
      { say: 'Seu', label: 'Seu', icon: '🪑' },
      { say: 'Abajo', label: 'Abajo', icon: '⬇️' },
      { say: 'Pata', label: 'Pata', icon: '🐾' },
      { say: 'Vuelta', label: 'Vuelta', icon: '🔄' },
    ],
    /** Onomatopeyas (`comicWord`): Joy no entiende la orden o se despista. */
    wrong: '¿¿GUAU??',
    slow: '¡SNIF, SNIF!',
    done: (ok: number) => `${ok} trucos. Ahora, el circuito 🏁`,
  },
  agility: {
    title: 'Joy, campeón de agility',
    hint: 'Corres a su lado: con el joystick llévale a cada obstáculo, y toca para saltar vallas y aros (los túneles, sin saltar)',
    missed: '¡POR AHÍ NO!',
    again: (n: number, need: number) => `${n} DE ${need}… ¡OTRA VUELTA!`,
    btn: '🐕 ¡Salta!',
    /** Onomatopeyas (`comicWord`). */
    knock: '¡CLONC!',
    overTunnel: '¡POR DENTRO!',
    done: (hits: number) => `Joy: ${hits} obstáculos perfectos. A campeonatos 🏆`,
  },
  voley: {
    title: 'Vóley playa nivel 6',
    hint: 'Corre al aro amarillo y dale cuando llegue. Haz 4 puntos',
    btn: '🏐 ¡Toca!',
    /** Onomatopeyas (`comicWord`): los toast no se ven en el cómic. */
    miss: '¡AL SUELO!',
    early: '¡PRONTO!',
    late: '¡TARDE!',
    far: '¡NO LLEGAS!',
    done: '¡Muy bieeeen! El nivel 6 te lo has ganado 🏐',
    again: 'Otra vez: hay que hacer 4 puntos',
    short: (n: number) => `${n} PUNTOS… ¡OTRA!`,
  },
};

/** Los minijuegos que hay que pasar para seguir con la historia (se inventan, no son chats ni hechos reales). */
export const SIDE = {
  water: {
    intro: [
      { who: 'Narrador', text: 'Unos críos te cortan el paso.' },
      { who: 'Un crío', text: 'D\'aquí no passes si no mus banyes!' },
      // (inventado: antes lo contaba el narrador; ahora la regla la dice el crío)
      { who: 'Un crío', text: 'Té, una pistola. Som cinc: mus has de banyar dues vegades a cadascú!' },
    ] as Line[],
    hint: '💦',
    btn: '💦 Disparar',
    /** Onomatopeyas (`comicWord`) de cada crío rendido. */
    out: ['¡UNO!', '¡DOS!', '¡TRES!', '¡CUATRO!', '¡TODOS!'],
    soaked: '¡CHOF!',
    end: [{ who: 'Un crío', text: 'Vale, vale! Passa, passa.' }] as Line[],
  },
  pinchos: {
    intro: [
      { who: 'Camarero', text: '¡Va, que hay cola! Te canto la ronda y me la sacas en orden.' },
      { who: 'Gas', text: 'Si aciertas, la siguiente la pago yo.' },
    ] as Line[],
    listen: (r: number, of: number) => `Escucha · ronda ${r} de ${of}`,
    yourTurn: (i: number, n: number) => `Tu turno · ${i}/${n}`,
    /** Lo dice el camarero, en su bocadillo (y vuelve a cantar la ronda). */
    wrong: ['Ese no era, majo. Otra vez.', 'Pero bueno… Otra vez.', 'Que no, que no. Otra vez.'],
    /** Más de tres fallos en una ronda: desde el principio. */
    restart: 'Uf, así no hay quien trabaje. ¡Desde el principio!',
    good: '¡RONDA!',
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
  /** Cap. 5: las fotos en el campo de rosas (lo de pararse a hacerle fotos pasó; las frases, inventadas). */
  roses: {
    start: [
      { who: 'Narrador', text: 'De vuelta, una planicie entera llena de rosas de colores.' },
      { who: 'Margaux', text: '¡Para, para, para! ¡Hazme fotos aquí!' },
      { who: 'Gas', text: 'Tú posa, que yo disparo. Va a ser épico.' },
    ] as Line[],
    hint: 'Apunta arrastrando · dispara cuando pose',
    btn: '📸 Disparar',
    ok: ['¡Esa! Esa me la quedo.', '¡Qué bien sale el fondo!', '¡Perfecta! Ya tienes foto de perfil.'],
    blur: '¡Que me estaba moviendo! Espera a que pose.',
    cut: '¡Me has cortado! Encuádrame bien.',
    poseName: { arriba: '🌹 ¡Brazos arriba!', cadera: '🌹 Mano en la cadera', beso: '🌹 Un beso', rosa: '🌹 Con una rosa', saludo: '🌹 ¡Hola!' } as Record<string, string>,
    end: [
      { who: 'Margaux', text: 'A ver, a ver… ¡Brutales! Mándamelas todas, amore.' },
      { who: 'Gas', text: 'Venga, que se nos hace de noche.' },
    ] as Line[],
  },
  stones: {
    start: [
      { who: 'Gas', text: 'Ya que no se puede llegar al faro: a ver quién hace más ranas.' },
      { who: 'Margaux', text: 'Empieza tú, que quiero ver cómo pierdes.' },
      { who: 'Gas', text: 'Vale. Tú, mientras, búscate tres piedras planas. Las redondas no botan.' },
    ] as Line[],
    // Antes de tirar, las piedras (paso nuevo, inventado: Marc, cámbialo si quieres)
    flat: ['Esta. Plana como una galleta.', 'Otra.', 'Y la tercera. Ya puedes ir preparándote.'],
    round: 'Esa es una bola. Plana, plana.',
    hint: 'Las buenas son planas y finas. Mira entre las rocas.',
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
      { who: 'Una de Ciutadella', text: 'Avellanes! Qui en vol? Aquí al Born tothom en tira, i qui no en torna, no surt.' },
      { who: 'Gas', text: 'Toma la bolsa. Devuélveselas, que si no no nos dejan salir de aquí.' },
    ] as Line[],
    hint: '🌰',
    btn: '🌰 Tirar',
    /** Lo dice Gas (inventado: era un aviso «Acércate más»). */
    far: 'Desde ahí no llegas',
    /** Lo dice Gas (era un aviso que decía qué hacer). */
    miss: '¡Uy! Se ha movido',
    /** Cuando te da una avellana: lo dice quien lo diría (la última, inventada). */
    pelted: [
      { who: 'Margaux', text: '¡Au! 🌰' },
      { who: 'Gas', text: '¡En toda la cabeza! Heavy 🌰' },
      { who: 'Gas', text: '¡Cuidado, que viene otra!' },
    ] as Line[],
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
      // («en las altas no te pilla»: inventado, para decir la regla de las olas en su boca)
      { who: 'Gas', text: 'El mejor sitio está en aquellas rocas. Yo ya he cruzado. Salta cuando no venga ola: en las altas no te pilla.' },
      { who: 'Margaux', text: 'Si me mojo el vestido, te tiro al agua, gasss.' },
    ] as Line[],
    hint: '🪨',
    btn: '🪨 Saltar',
    /** Lo dice Gas cuando la ola la pilla (y vuelve a la última roca alta). */
    fall: ['¡La ola! Desde el principio 💦', '¡Otra vez desde la primera! Deja que pase 💦', '¿Está fría? 😂 Venga, desde el principio'],
    end: [{ who: 'Gas', text: 'Seca. Lo dudaba. Brutal.' }] as Line[],
  },
  pee: {
    first: [{ who: 'Narrador', text: 'Por fin le toca a Gas. Tres cervezas después, con prisa y con una mosca pintada dentro del váter, mirándole.' }] as Line[],
    again: [{ who: 'Narrador', text: 'Otra vez a la cola del váter. Y otra cerveza más que la última.' }] as Line[],
    title: '🎯 Apunta a la mosca',
    hint: 'Arrastra el dedo para apuntar dentro del váter. Al final pierde fuerza: apunta más al fondo',
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
    hint: 'Acércate a una puerta y ábrela',
    door: '🚪 Abrir',
    knock: '✊ Llamar',
    /** Lo que contestan desde dentro de una ocupada (inventado). */
    knockReply: ['¡Ocupado!', '¡Que hay cola, eh!', '¡Un momento, hombre!'],
    /** En la de las gafas, quien está dentro (inventado). */
    hasThem: '¿Unas gafas de sol? Sí, aquí hay unas… ¡Ya salgo!',
    handed: 'Ahí las tienes, en la repisa.',
    already: 'Aquí ya he mirado',
    broken: 'Averiado. Esta ni se abre',
    /** La voz de quien está dentro (inventado). */
    occupied: '¡OCUPADO!',
    empty: ['Aquí no están', 'Tampoco. Qué asco, por cierto', 'Nada. Solo papel por el suelo', 'Ni rastro'],
    found: '🕶️ ¡Mis gafas! En la repisa, donde las dejé.',
  },
};

/** Pruebas que no han salido (la tarjeta de «Otra vez»): qué ha pasado, en una línea. */
export const FAIL = {
  soakMax: 6,
  water: { title: 'Empapada', text: 'Los críos te han ganado. Que no te den tanto: muévete cuando te apunten.' },
  /** (4.4.13) Cap. 1: tres embestidas de ase y se repite esa parte. */
  donkeyMax: 3,
  donkeys: { title: '¡Embestida!', text: 'Los ases te han embestido tres veces. Otra vez desde aquí.' },
  pomadas: { title: 'Sin pomadas', text: 'Se han caído las tres. Otra vez desde la barra, y cuidado con los ases.' },
  lateAse: 'Uy, a destiempo… Cuando se ponga de manos.',
  marco: { title: '¡Pillada!', text: 'Tres veces te ha cogido. Contesta «Polo» a tiempo y no chapotees cuando esté cerca.' },
  crashes: 'Tres golpes ya… Volvemos atrás y con calma, ¿eh?',
  burntMax: 4,
  grill: { title: 'Así no', text: 'Tres fallos: ni crudas ni quemadas. Al plato cuando brillen, ni antes ni después.' },
  rhythmMin: 0.92, // (4.4.4, mucho más difícil: antes el 90 %)
  skillMin: 0.75,
  /** Grabar a Fito: el 60 % del vídeo con él en plano. */
  filmMin: 0.6,
  /** El baño: el 85 % dentro de la taza. */
  peeMin: 0.93,
  suitcase: { title: '¡Maletazo!', text: 'Te ha dado una maleta. Otra vez desde la entrada: mira bien de qué tienda sale cada una.' },
  rhythm: { title: 'Desafinada', text: (h: number, t: number) => `${h} de ${t} notas (${Math.round((h / Math.max(1, t)) * 100)} %). Hace falta el 92 % para que Fito te lo perdone (y sin tocar a lo loco): otra vez.` },
  film: { title: 'Movidísimo', text: (p: number) => `Fito solo ha salido en plano el ${p} % del vídeo. Hace falta el 60 %: otra vez, con pulso.` },
  pee: { title: 'Fuera de la taza', text: (p: number) => `Solo el ${p} % ha caído dentro. Hace falta el 93 %: otra vez, apuntando bien.` },
  pack: { title: 'Mochila llena de nada', text: 'Tres cosas que no estaban en la lista de Gas. En la moto no cabe nada más: otra vez.' },
  windSecs: 3,
  lean: { title: '¡Patapam!', text: 'En las curvas, inclínate con Gas hacia el mismo lado. Si no, la moto se cae: otra vez desde el principio de este tramo.' },
  waveCar: { title: 'Eso era un coche', text: 'El saludo motero ✌️ es solo para las motos. A los coches, nada: otra vez desde este tramo.' },
  waveMissed: { title: 'Sin saludo', text: 'Una moto te ha saludado y no has contestado. Cuando venga una de frente, ✌️: otra vez desde este tramo.' },
  wind: { title: '¡Al suelo!', text: 'La tramontana se ha llevado la moto. Échate hacia donde sopla la racha, siempre en contra.' },
  peltMax: 6,
  nuts: { title: 'Coscorrón', text: 'Te han dado seis veces. Cuando veas el círculo en el suelo, apártate.' },
  alarm: { title: 'Os han pillado', text: 'Si llegan a ser tus padres… Platos y sartén fuera de la vista antes de que el coche llegue a la puerta.' },
  wall: { title: '¡Clonc!', text: 'Has tocado el muro. Otra vez desde la calle: despacio, que Azul te guía.' },
  eclipse: { title: 'Te lo has perdido', text: 'El eclipse no espera. Aparca a tiempo y sin tocar nada.' },
  starsReset: 'Eso no es un corazón… Otra vez 😉',
};

/**
 * El final del año (21 nov), después del regalo del cap. 9: llega Barcelona y, con ella, lo que les gusta hacer juntos
 * (vóley, Joy y los caballos). Inventado salvo las fechas: Marc, cámbialo si quieres.
 */
export const FINALE = {
  barcelona: [
    { who: 'Narrador', text: 'Y después de Ferreries… llega Barcelona.' },
    { who: 'Gas', text: 'Ahora sí: tú y yo, en la misma ciudad.' },
    { who: 'Azul', text: 'Y con todo lo que nos gusta hacer juntos.' },
    { who: 'Narrador', text: 'Vóley en la playa, Joy en el parque y caballos. Lo que viene, juntos.' },
  ] as Line[],
  horses: [
    { who: 'Narrador', text: 'Y los caballos: ella, desde siempre; él, aprendiendo a su lado.' },
    { who: 'Gas', text: 'Tú delante, que yo te sigo. Salto a salto.' },
  ] as Line[],
  // (inventadas: Marc, cámbialas si quieres) El surf: lo de él («Yo caballo y surf»), y ahora también lo de ella
  surf: [
    { who: 'Narrador', text: 'Y el surf: lo suyo de siempre. Ahora, también lo de ella.' },
    { who: 'Gas', text: 'Tú rema fuerte, que la ola te la busco yo.' },
  ] as Line[],
  end: [{ who: 'Narrador', text: 'Y así se acaba este año. Solo este.' }] as Line[],
  credits: [
    ['Azul', 'Margaux'],
    ['Gas', 'Marc'],
    ['Joy', 'Joysito'],
    ['Otros', 'Eric, Carme, tus suegros, mis suegros'],
    ['Música', 'Bad Bunny, James Blunt, PAWSA, De Vega, Fito & Fitipaldis, Josean Log, Prince Royce, Quevedo, AC Radio Show'],
    ['Ases, caballos y vacas', 'sin que ninguno saliera herido'],
    ['Escrito, dibujado y programado por', 'Marc y Claude'],
  ] as [string, string][],
};
