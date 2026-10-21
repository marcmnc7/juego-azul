# Para Margaux · diseño

Juego 3D para el móvil (Three.js + Vite + TypeScript) para el cumpleaños de Margaux (28 de noviembre). Se juega como Azul (rubia, ojos verdes, vestida de azul); cada capítulo recrea un momento con Gas y termina desbloqueando un **vale regalo real**. El progreso se guarda en el propio móvil.

## Capítulos
| # | Capítulo | Qué se hace | Regalo |
|---|----------|-------------|--------|
| 1 | **Jaleo d'ases** · Ferreries, Festes de Sant Bartomeu | Hablar con Tòfol, conseguir 3 pomadas y 3 toques de suerte a los ases encabritados, encontrar a Marc en el Bar Sa Plaça y darle un beso. | Una noche de fiesta juntos |
| 2 | **La ruta de las zamburiñas** · Madrid → San Vicente de la Barquera → Logroño | Conducir con Joy asomada a la ventanilla, cambiar de carril para recoger fotos y esquivar coches, tractores y vacas. En San Vicente, hacer 8 zamburiñas a la plancha (tocarlas cuando están doradas) y comerse una en la terraza de El Ancla. Seguir entre viñedos hasta Logroño. | Una cena en un buen restaurante |
| 3 | **Fito bajo las estrellas** · Estadio de Gran Canaria | Ir 4 veces a los WC portátiles (Poly Clean, luz verde = libre, roja = ocupado) volviendo al concierto entre visita y visita, y después cruzar la multitud, que empuja, hasta llegar a Gas. Opcional: tirar el tabaco a la papelera (Gas lo comenta). Concierto con minijuego de ritmo y fuegos artificiales. | Billetes al Carnaval de Tenerife |
| 4 | **Noche de piscina y estrellas** · En casa | Gas recoge a Azul en coche en la puerta del Bar Imperi, van a casa (fachada, muro y puertas como en la foto de la calle) y entran. La casa y el jardín siguen la foto de satélite. Tirarse a la piscina, recoger 6 velitas flotantes nadando, tumbarse en las toallas y unir 10 estrellas en un corazón. | — (se puede añadir un vale en `gifts.ts` con `level: 4`) |
| 5 | **Sant Joan** · Ciutadella | El mismo jaleo que el capítulo 1 en versión Sant Joan: Carme de guía, 3 bolsitas de avellanes y 3 toques de suerte a caballos negros, y encontrar a Gas (con la camiseta de Azul), que se cambia de sitio dos veces porque no encuentra su ubicación. Carteles del Born y bares de Ciutadella (Imperi, Jazzbah, Es Pla, Maramao). | — (al terminar abre el crucigrama y la carta final) |
| 💌 | **Sorpresa final** | Crucigrama de Gas (8 pistas con bromas suyas; las letras marcadas dicen TE QUIERO) y después la carta de Gas (y Joy). | — |

## Cómo se ve y se juega
- Estilo realista suave: materiales PBR iluminados por el cielo de cada nivel (reflejos de entorno), textura de grano en las superficies, sombras suaves de 2048, bloom en luces y focos, viñeta y corrección de color. Agua de piscina y mar con reflejos. Si el móvil va justo, baja la resolución, luego quita el postprocesado y por último las sombras. Con `?hq` en la URL no baja nunca la calidad (para capturas). Si en algún dispositivo un shader no compila, se quitan solos el grano, luego la luz de entorno y luego el postproceso; `?lite` arranca ya sin ellos. Además, al arrancar se dibuja un cubo de prueba invisible para el jugador; si no sale verde (GPUs que fallan sin dar error), se quitan grano, entorno, sombras y, si el PBR sale invisible (pasa en Mac M1 con ANGLE Metal), se usa Phong con brillos y grano; como último recurso, Lambert. Con `#test`, el contador muestra "seguro" y qué queda activo.
- Cap. 1: los ases avisan con un **!** antes de ponerse de manos; tocarlos en lo más alto (aro dorado) es un toque perfecto. Azul lleva la pomada en la mano; confeti y ovación al final.
- Ferreries: banderas de Menorca y senyeres en los balcones, pancartas de las Festes de Sant Bartomeu, placas de calle, iglesia con campanario, Ajuntament, fabiolera, bares con gente bailando y luces de fiesta.
- Cap. 2: carril deslizando el dedo o con ◀ ▶, barra de ruta, ⛽ turbo, 🚬 que Gas confisca, adelantamientos "por los pelos" y rachas de fotos con Joy ladrando.
- Cap. 3: seis cabinas azules de WC con luz libre/ocupado, multitud de más de 200 personas con un pasillo serpenteante; pantallas con ecualizador, láseres, mecheros en el público, chispas y fuegos con las rachas del minijuego.
- Cap. 4: casa adosada con placas solares, camino de losas, sombrilla azul, piscina con luz y Joy siguiéndola; de noche con vía láctea, luna y luciérnagas.
- Física y movimiento: Azul tiene masa (arranca en ~0,35 s, frena antes, girar en seco la frena), el paso va ligado a la distancia para que los pies no patinen, pasa de andar a correr con brazos doblados y tronco girando, se inclina al acelerar y hacia dentro en las curvas, los empujones la desplazan y le quitan el control un momento, y contra una pared se para en vez de resbalar. Cámara con muelle tipo steadicam y un leve balanceo al correr. El coche tiene suspensión (cabecea al acelerar y frenar, se inclina en las curvas, vibra con el asfalto) y cambia de carril con volante. Joy acelera, frena, gira en curva y pasa de trote a galope.
- Movimientos naturales: las personas tienen rodillas, tobillos y codos. Al andar la rodilla se dobla al levantar el pie, el pie apoya plano y empuja al despegar, los brazos se balancean con el codo doblado y el tronco sube y baja. Bailar, animar, saludar y hablar usan las articulaciones (sentadillas, saltos con aterrizaje, saludo desde el codo), en reposo cambian el peso de pierna y miran alrededor, y el paso de una animación a otra se funde en vez de saltar. En la terraza se sientan con las rodillas dobladas.
- Física del mundo (src/core/physics.ts, sin motor externo): gravedad, rebotes con pérdida, rozamiento que pasa de deslizar a rodar, arrastre del aire, flotación y oleaje. Vasos de plástico en Ferreries y en el concierto que aguantan un toque suave pero se vuelcan con uno fuerte y luego ruedan de lado (Azul y los ases los arrollan). Pelota de playa que el público va botando sobre las cabezas y que Azul puede cabecear o chutar. El público del concierto cede al empujarlo, se tambalea, choca en cadena con los de al lado y vuelve a su sitio. Piscina: salto en parábola real con el cuerpo siguiendo la trayectoria, frenazo al entrar y subida a flote con rebotes, nadar desliza (cuesta arrancar y frenar), pelota flotante que Azul y Joy empujan y ondas en el agua. Sonidos de golpe según el objeto.
- Cada capítulo empieza con un rótulo y acaba con una caja regalo que se abre con confeti, 1-3 estrellas y datos de la partida.

Guiños: Azul y Gas, los "Buu", el inglés de Gas (ahora B2 y con 🥴), dejar de fumar, Joy, "need esos ojos", "ya sabes dónde se quedó mi corazón", el flash en el concierto, "silencio full que duermen mis padres", Interstellar sin terminar.

Fotos del chat: al acabar cada capítulo caen sus polaroids («Recuerdo desbloqueado») y quedan en **📷 Nuestro álbum** del mapa; la carta final lleva tres fotos (la primera noche, Gran Canaria y Sant Joan). También hay algunos stickers nuestros (el oso bailando en la portada, «Escuchamos y juzgamos» en el crucigrama). Están en `src/assets/recuerdos/`, comprimidas para que el HTML único no pese.

## Modo prueba
Abrir el enlace añadiendo `#test` al final. Todo está desbloqueado, hay un botón amarillo 🛠 Prueba para saltar a cualquier fase o completar el capítulo, un contador de fps y un botón para borrar el progreso guardado.

## Cómo se cambia
- Regalos: `src/data/gifts.ts`
- Diálogos y carta final: `src/data/story.ts`
- Aspecto de Azul y Gas: `src/data/characters.ts`

## Compilar
`npm install && npm run build` genera `dist/index.html`, un único archivo que funciona sin servidor.
