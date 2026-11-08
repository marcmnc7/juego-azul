# Para Margaux · diseño

Juego 3D para el móvil (Three.js + Vite + TypeScript) para el cumpleaños de Margaux (28 de noviembre). Se juega como Azul (rubia, ojos verdes, vestida de azul); cada capítulo recrea un momento con Gas y termina desbloqueando un **vale regalo real**. El progreso se guarda en el propio móvil.

## Capítulos
Se abren uno al día, del 20 al 28 de noviembre (el último, el día del cumpleaños), y cada uno pide haber terminado el anterior.

| # | Capítulo | Qué se hace | Regalo |
|---|----------|-------------|--------|
| 1 | **Jaleo d'ases** · Ferreries, 25 de agosto de 2025 | Hablar con Tòfol, 3 pomadas y 3 caricias a los ases cuando se paran, bailar con Carme en Sa Font, la mirada a cámara lenta cuando aparece Marc, bailar juntos, el beso y el número. | Una noche de fiesta juntos |
| 2 | **La piscinita** · Sa Caleta, la noche siguiente | Los WhatsApp de esa noche, Gas la recoge en el Imperi, entrar en silencio por las losas, tirarse a la piscina, nadar juntos, tumbarse en el césped y unir las estrellas en un corazón. | — |
| 3 | **La ruta de las zamburiñas** · Atocha → San Vicente de la Barquera → Logroño | Conducir el Focus gris cambiando de carril, la Cafetería Marcial, las zamburiñas a la plancha y en la terraza de El Ancla, y la última noche de camping entre viñas: el hornillo sin gas y el nacimiento de «Gas». | Una cena en un buen restaurante |
| 4 | **Fito bajo las estrellas** · Barajas → Estadio de Gran Canaria, marzo de 2026 | Esquivar maletas hasta la puerta 26, la cola del baño, grabar el «temón», encontrarla a oscuras con su flash (escena de cine la primera vez) y el concierto con el minijuego de ritmo. | Billetes al Carnaval de Tenerife |
| 5 | **MotoTrip4life** · Costa Brava, del 30 de abril al 4 de mayo de 2026 | La mochila (solo lo de la lista de Gas) y la carretera de la costa hacia Cap de Creus: inclinarse en las curvas, saludar a las motos que vienen de frente (a los coches no), tres fotos y el último tramo hasta el faro, cortado. | — |
| 6 | **Sant Joan** · Ciutadella, junio de 2026 | Avellanes y toques de suerte a los caballos, buscar a Gas por Ses Voltes siguiendo sus ubicaciones y mandarle la foto exacta con el obelisco. | — |
| 7 | **Cena a escondidas** · Sa Farola, 13 de julio de 2026 | Seguir su vuelo en el móvil, vigilar a los padres, cocinar la carbonara (sin nata), cenar antes de las 22:50 y el WhatsApp de las 23:49. | — |
| 8 | **El eclipse** · Ciutadella, 12 de agosto de 2026 | Buscar la moto perdida en el aparcamiento del aeropuerto con la linterna, el kayak que nunca pasó, conocer a los padres, aparcar marcha atrás, Love Letter en la roca y la totalidad con corona y anillo de diamante (escena de cine). | — |
| 9 | **Un año después** · Ferreries, 25 de agosto de 2026 | Otra vez el jaleo, ahora juntos, buscándole por sus ubicaciones; el vóley de septiembre en la playa y Joy en el parque en octubre. Después, el crucigrama de Gas (las letras marcadas dicen TE QUIERO) y la carta. | — |
| 💌 | **La carta** | Escena de noche sobre el mar con las fotos flotando; la carta aparece párrafo a párrafo, escrita a mano, y acaba con fuegos. Se puede leer entera. | — |

## Cómo se ve y se juega
- Estilo pintado (`src/core/paint.ts` y `src/core/post.ts`): luz en franjas suaves, sombras de color en vez de negras, pinceladas en las superficies, perfil de luz en los personajes, filtro de óleo solo en el fondo lejano, tinta en las siluetas y grano de papel. Cielos de acuarela con nubes pintadas; las noches, azul ultramar. Cada capítulo tiene su paleta (y el de Fito cambia de día a noche al pasar de Barajas al estadio). `?estilo=antes` lo quita para comparar.
- Escenas de cine (`src/core/cinema.ts`): planos con travelling, cámara lenta, enfoque y bandas negras para la mirada en Ferreries, el camping en el que nace Gas, el flash en Fito, la totalidad del eclipse y la carta final. Durante las escenas se esconden los mandos.
- Movimiento: salto más alto si se mantiene el botón, acelerón al correr recto un rato (con polvo a los pies y la cámara abriendo el plano), polvo al aterrizar y al girar en seco, cámara que se adelanta hacia donde vas, y una columna de luz sobre el objetivo que asoma por encima de los tejados.
- Misiones (`src/core/stage.ts` y `src/world/missions/`): lo que antes eran minijuegos planos ahora se juega dentro del mundo, con los mismos personajes y el mismo estilo, como parte del capítulo (obligatorias, pero siempre se pueden acabar). La moto perdida es el aparcamiento del aeropuerto de noche con la linterna del móvil; el vóley, en la playa con red y pelota; Joy, en el parque (trucos con las órdenes de Gas y circuito de agility). El vuelo de Gas se sigue en una app del móvil y la mochila es un panel sobre la escena. Cada una empieza y acaba con su rótulo de misión.
- Love Letter en las rocas: se les ve a los dos sentados frente a frente con sus cartas; al jugar, la carta vuela al montón. Las cartas (`src/ui/cards.ts`) son ilustraciones propias hechas por código. Si se pierde tres veces, Gas se rinde (empieza el eclipse).
- Puertas (`src/world/door.ts`): nadie atraviesa una puerta cerrada. La cancela y la puerta de casa de Azul, la verja y la corredera de casa de Gas y los WC del concierto se abren cuando llega alguien y se cierran detrás.
- Moto y casco: moto naked por piezas (fundidas por material; las aparcadas, instanciadas) y casco integral con mentonera, visera, ribete y franja.
- El público no son clones: cada persona tiene sus colores de pelo, ropa y piel y su altura (en el shader, sin coste).
- Memoria: al salir de cada capítulo se liberan sombras, luz de entorno, esqueletos y texturas de los shaders, para poder rejugar sin que el móvil se quede sin memoria.
- Postproceso de cine (`src/core/post.ts`, con `postprocessing` y N8AO): oclusión ambiental a media resolución, bloom, tono AgX y un etalonaje por capítulo (sombras frías, luces cálidas). En los diálogos, bandas negras, un leve acercamiento y el fondo desenfocado enfocando a quien habla. Si el móvil no llega, primero se quita la oclusión y luego el resto.
- Sensación en los aciertos (`src/core/juice.ts`): cada sonido de premio dispara su efecto (micro-pausa, golpe de zoom, destello, aberración cromática en los golpes y vibración).
- Audio: la melodía de cada canción se armoniza sola (acorde por compás) con colchón, bajo, batería, reverb y eco. Ambiente de fondo por capítulo: plaza en Ferreries, grillos de noche, viento en la carretera, mar en la costa.
- Cámara en tercera persona más cercana y baja.
- Estilo realista suave: materiales PBR iluminados por el cielo de cada nivel (reflejos de entorno), textura de grano en las superficies, sombras suaves de 2048, bloom en luces y focos, viñeta y corrección de color. Agua de piscina y mar con reflejos. Si el móvil va justo, baja la resolución, luego quita el postprocesado y por último las sombras. Con `?hq` en la URL no baja nunca la calidad (para capturas). Si en algún dispositivo un shader no compila, se quitan solos el grano, luego la luz de entorno y luego el postproceso; `?lite` arranca ya sin ellos. Además, al arrancar se dibuja un cubo de prueba invisible para el jugador; si no sale verde (GPUs que fallan sin dar error), se quitan grano, entorno, sombras y, si el PBR sale invisible (pasa en Mac M1 con ANGLE Metal), se usa Phong con brillos y grano; como último recurso, Lambert. Con `#test`, el contador muestra "seguro" y qué queda activo.
- Cap. 1: los ases avisan con un **!** antes de ponerse de manos; tocarlos en lo más alto (aro dorado) es un toque perfecto. Azul lleva la pomada en la mano; confeti y ovación al final.
- Ferreries: banderas de Menorca y senyeres en los balcones, pancartas de las Festes de Sant Bartomeu, placas de calle, iglesia con campanario, Ajuntament, fabiolera, bares con gente bailando y luces de fiesta.
- Cap. 3: carril deslizando el dedo o con ◀ ▶, barra de ruta, ⛽ turbo, 🚬 que Marc confisca, adelantamientos "por los pelos" y rachas de fotos.
- Cap. 3: seis cabinas azules de WC con luz libre/ocupado, multitud de más de 200 personas con un pasillo serpenteante; pantallas con ecualizador, láseres, mecheros en el público, chispas y fuegos con las rachas del minijuego.
- Cap. 4: casa adosada con placas solares, camino de losas, sombrilla azul, piscina con luz y Joy siguiéndola; de noche con vía láctea, luna y luciérnagas.
- Física y movimiento: Azul tiene masa (arranca en ~0,35 s, frena antes, girar en seco la frena), el paso va ligado a la distancia para que los pies no patinen, pasa de andar a correr con brazos doblados y tronco girando, se inclina al acelerar y hacia dentro en las curvas, los empujones la desplazan y le quitan el control un momento, y contra una pared se para en vez de resbalar. Cámara con muelle tipo steadicam y un leve balanceo al correr. El coche tiene suspensión (cabecea al acelerar y frenar, se inclina en las curvas, vibra con el asfalto) y cambia de carril con volante. Joy acelera, frena, gira en curva y pasa de trote a galope.
- Movimientos naturales: las personas tienen rodillas, tobillos y codos. Al andar la rodilla se dobla al levantar el pie, el pie apoya plano y empuja al despegar, los brazos se balancean con el codo doblado y el tronco sube y baja. Bailar, animar, saludar y hablar usan las articulaciones (sentadillas, saltos con aterrizaje, saludo desde el codo), en reposo cambian el peso de pierna y miran alrededor, y el paso de una animación a otra se funde en vez de saltar. En la terraza se sientan con las rodillas dobladas.
- Física del mundo (src/core/physics.ts, sin motor externo): gravedad, rebotes con pérdida, rozamiento que pasa de deslizar a rodar, arrastre del aire, flotación y oleaje. Vasos de plástico en Ferreries y en el concierto que aguantan un toque suave pero se vuelcan con uno fuerte y luego ruedan de lado (Azul y los ases los arrollan). Pelota de playa que el público va botando sobre las cabezas y que Azul puede cabecear o chutar. El público del concierto cede al empujarlo, se tambalea, choca en cadena con los de al lado y vuelve a su sitio. Piscina: salto en parábola real con el cuerpo siguiendo la trayectoria, frenazo al entrar y subida a flote con rebotes, nadar desliza (cuesta arrancar y frenar), pelota flotante que Azul y Joy empujan y ondas en el agua. Sonidos de golpe según el objeto.
- Cada capítulo empieza con un rótulo y acaba con sus estrellas y datos de la partida: con una caja regalo que se abre con confeti si tiene vale, o con la pantalla de «¡Capítulo superado!» si no.

Guiños: Azul y Gas, los "Buu", el inglés de Gas (ahora B2 y con 🥴), dejar de fumar, Joy, "need esos ojos", "ya sabes dónde se quedó mi corazón", el flash en el concierto, "silencio full que duermen mis padres", Interstellar sin terminar.

Fotos del chat: al acabar cada capítulo caen sus polaroids («Recuerdo desbloqueado») y quedan en **📷 Nuestro álbum** del mapa; la carta final lleva tres fotos (la primera noche, Gran Canaria y Sant Joan). También hay algunos stickers nuestros (el oso bailando en la portada, «Escuchamos y juzgamos» en el crucigrama). Están en `src/assets/recuerdos/`, comprimidas para que la primera descarga no pese.

## Carga y lugares reales
- La portada no deja empezar hasta que todo está cargado (el botón va mostrando el porcentaje), y cada capítulo compila sus materiales detrás del rótulo, así abre sin tirones.
- Ferreries: el jaleo d'ases es el 25 de agosto a las 11 en el Pla de l'Església, con el Ajuntament en la plaza: luz de media mañana.
- Ciutadella: del Born se sale por el Carrer Major des Born, se pasa por la Catedral y empieza Ses Voltes, que acaba en la Plaça Nova, junto a la Plaça Espanya.
- Eclipse: en Ciutadella la totalidad fue a las 20:30 con el sol a 1,9° sobre el mar, hacia el oeste-noroeste, y duró 1 min 14 s.
- Los coches son compactos de cinco puertas hechos con piezas (el de Azul, un Ford Focus gris).

## Modo prueba
Abrir el enlace añadiendo `#test` al final. Todo está desbloqueado, hay un botón amarillo 🛠 Prueba para saltar a cualquier fase o completar el capítulo, un contador de fps y un botón para borrar el progreso guardado. Desde la consola, `__dbg` permite ir a un capítulo (`go(n)`), saltar de fase (`phase('2 ·')`), pasar diálogos (`skip()`), capturar el lienzo a resolución real (`view()`) y mantener vivo el bucle con la pestaña en segundo plano (`keepAlive(true)`).

## Cómo se cambia
- Regalos: `src/data/gifts.ts`
- Diálogos y carta final: `src/data/story.ts`
- Aspecto de Azul y Gas: `src/data/characters.ts`

## Compilar
`npm install && npm run build` genera la carpeta `dist/`: `index.html` (el código, unos 5 MB) y `dist/assets/` con los archivos grandes (modelos, personajes de VRoid, música, fotos y cielos). Así ningún archivo se acerca al límite de 100 MB de GitHub.

Para publicar en GitHub Pages hay que subir **la carpeta `dist/` entera** (con `assets/`), no solo el HTML. Necesita servirse por HTTP: abierto como archivo suelto (`file://`) no carga los assets. La primera vez que se abre por HTTPS, el modo sin conexión (`sw.js`) guarda todos los archivos de `assets/` en el móvil.

## Personajes de VRoid
Los personajes de VRoid Studio (VRM 1.0) van en `src/assets/vrm/` y se registran en `VRM_FILES` de `src/data/characters.ts` con su altura; un personaje los usa con `vrm: <url>` en su look. Se animan con las mismas capturas que los demás (`src/entities/vrm.ts` renombra sus huesos a los de Mixamo) y tienen parpadeo, sonrisa al bailar, boca al hablar y pelo con física.
