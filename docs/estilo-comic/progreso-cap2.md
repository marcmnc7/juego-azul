# Progreso · Capítulo 2 «La piscinita» (F1)

Hecho el 9-nov-2026. Perfil `noche`. Filas del inventario `inventario-cap2-cap3.md`, sección 1.2.

**Estado:**
- ✓ = hecho y comprobado en captura.
- **auto** = lo resuelve la base común (D1–D4).
- **aceptado** = se queda así a propósito (motivo al lado).
- **pendiente** = falta.

Capturas: todas las fases (A Bar Imperi, B Llegar a casa, 1 Ir a la piscina, 2 Nadar, 3 Al césped con la censura, 4 Unir estrellas, 5 Final), en desarrollo y en la versión compilada.

## Cielo y luces
| Objeto | Estado | Cómo |
|---|---|---|
| Cúpula nocturna | ✓ auto | `Sky` aclara la cúpula casi negra a azul ultramar |
| Estrellas (1400) | ✓ auto | Sin escribir profundidad: la tinta ya no las rodea |
| Vía Láctea | ✓ aceptado | Puntos tenues sin profundidad; se leen como banda de estrellas |
| Luna | ✓ | `comicMoonTexture`: disco con cráteres, tinta y anillo de luz |
| Hemisférica, luna, luces de punto | ✓ | Perfil `noche` (`LOOK_LIGHT`); luces de punto en anillos (`bandedLights`); la de la piscina, más corta para que su charco no suba por los muros |

## Born / Bar Imperi
| Objeto | Estado | Cómo |
|---|---|---|
| Manzanas, cornisas, zócalos, marcos, puertas, rejas, persianas de lamas, barandillas | ✓ auto | `TownHD`, como el cap. 1 |
| Calzada, aceras, bordillos, explanada | ✓ auto | Asfalto, losas y adoquín dibujados (D2) |
| Marcas viales | ✓ | — |
| Obelisco, Ajuntament, Teatre, Palau, Casino | ✓ auto | Superficie dibujada (D2) y combados (D3) |
| Verja | ✓ aceptado | Barrotes finos de `Merger` |
| Césped del obelisco | ✓ auto | Hierba dibujada |
| 4 faroles del obelisco, 8 farolas fernandinas | ✓ auto | Cristal `Surf.Glow`: sin sombra de noche |
| Halos de las farolas | ✓ auto | Luz de tebeo (`comicHaloTexture`) |
| Puerta verde y rótulo del Imperi | ✓ aceptado | Sin luz a propósito: es el bar abierto e iluminado |
| Persianas del Imperi, toldo, terraza, buzón, bancos, ficus, araucaria | ✓ auto | Copas lisas, como en el cap. 1 |
| Farolillos del Imperi | ✓ aceptado | Pantallas de metal oscuras; la luz la dan las farolas |
| 7 rótulos de piedra | ✓ | Ahora con luz (`MeshStandard` → tebeo): de noche no brillan solos |
| 4 coches aparcados | ✓ | `root.userData.comicBent` en `makeCarHD`: no se tuercen |

## Coche de Gas
| Objeto | Estado | Cómo |
|---|---|---|
| Carrocería, techo, retrovisores | **pendiente** (D6c, común a todos) | Toon plano correcto; falta el brillo dibujado de la pintura |
| Habitáculo, plásticos, cromo, matrículas, ruedas | ✓ aceptado | — |
| Faros y pilotos | ✓ | Emisivos |
| Haz de los faros | ✓ auto | Charco plano de luz de tebeo |
| Se mueve | ✓ | `comicBent` |

## Calle de casa
| Objeto | Estado | Cómo |
|---|---|---|
| Calzada, línea, bordillos, aceras de baldosa, pavimentos | ✓ auto | Asfalto y losas dibujados; la baldosa del lienzo, por `drawnMap` |
| Fachada, cornisa, alero, chimenea, casas vecinas, 17 casas de la urbanización | ✓ auto | Encalado y teja dibujados; combadas |
| Ventanas encendidas | ✓ auto | `Surf.Glow` |
| Luz del garaje (0xff9a3a) | ✓ | Añadida a `Surf.Glow` |
| Puerta corredera y puerta peatonal | ✓ | `Door.leaf.userData.comicBent`: no se doblan torcidas al moverse |
| Muros de piedra seca, buzón | ✓ auto | Piedra seca dibujada |
| Placas, cartel de la alarma, placa «Sa Son 69 B4» | ✓ | — |
| Palmeras, seto, farolas | ✓ auto | — |
| Halos de farolas y farolillo | ✓ auto | Luz de tebeo |

## Alrededores
| Objeto | Estado | Cómo |
|---|---|---|
| Campo, casas, muros, árboles | ✓ auto | Hierba, encalado y teja dibujados |
| Lomas | ✓ aceptado | Demasiado grandes para combarse (no se nota) |
| Ventanas encendidas y su brillo | ✓ auto | `Surf.Glow` + luz de tebeo |

## Casa y jardín
| Objeto | Estado | Cómo |
|---|---|---|
| Césped, terraza de losas, pasillo, muros, casa, voladizo, marcos | ✓ auto | — |
| Apliques del pasillo | ✓ auto | `Surf.Glow` |
| Placas solares, pérgola, mesa, sillas, sombrilla, toallas, macetas, matas | ✓ auto | Madera dibujada |
| Cristaleras y ventanas de los padres | ✓ aceptado | Luz plana encendida |
| Grava | ✓ auto | `drawnMap` (se lee bien) |
| Piscinas vecinas | ✓ | Agua de tebeo (`makeSea`) encima del vaso |
| Guirnalda de la pérgola y luciérnagas | ✓ auto | Luz de tebeo; la opacidad que anima el nivel ya no se pierde |

## Piscina
| Objeto | Estado | Cómo |
|---|---|---|
| Coronación, fondo, escalera, pelota, ropa | ✓ | — |
| Fondo con cáusticas | ✓ | El nivel mueve también la textura convertida (`poolFloor`) |
| Paredes del vaso | ✓ | Azulejo (`setSurface(0x3584c8, Surf.Terracotta)`) |
| Agua con ondas | ✓ | Agua de tebeo: bandas, trazos blancos a saltos y crestas de las ondas en blanco |
| Gotas y salpicaduras | ✓ | Gota de tebeo con contorno (`fx.ts`) |

## Toallas, amor y estrellas
| Objeto | Estado | Cómo |
|---|---|---|
| Mosaico de censura | ✓ | Cartela de tebeo: los píxeles dentro de un óvalo con tinta y «¡CENSURADO!». Escribe profundidad delante de todo: la tinta de debajo ya no la atraviesa |
| 10 estrellas de la constelación | ✓ | Estrella de cinco puntas dibujada (`comicStarTexture`) |
| Línea del corazón | ✓ | Trazo gordo rosa (cinta) con su contorno de tinta |
| Estrellas fugaces | ✓ | Trazo blanco que se afila, con contorno |
| Corazones del final | ✓ | Contorno de tinta en todas las partículas (`inkOutline`) |
| «🤫» | ✓ aceptado | Con contorno de tinta; sigue siendo el emoji del sistema |

## Globales
| Objeto | Estado | Cómo |
|---|---|---|
| Flecha de objetivo | ✓ | — |
| Polvo de los pasos | ✓ | Nubecilla plana con aro de tinta (`dust.ts`) |
| Recuerdos escondidos | ✓ aceptado | Polaroid plana; su halo, luz de tebeo de noche |

## Segunda pasada (9-nov, tarde): que se parezca de verdad al cap. 1
El dueño vio el cap. 2 «sin parecido» con el 1. Diferencias encontradas en capturas lado a lado y su arreglo:

| Diferencia | Arreglo |
|---|---|
| Noche lila y plana: mucha luz de ambiente y la luna floja (1,0), todo del mismo tono | Perfil `noche` nuevo (`LOOK_LIGHT`): ambiente azul oscuro y tope de luna 2,5. En el cap. 2, `hemiScale` 0,14 y luna azul (0xa9bcff) a 2,5 con sombras: cara iluminada fría y clara, sombra azul intenso, como el sol del cap. 1 |
| Casas de la urbanización = cajas blancas con rectángulos | `world/menorcaHouse.ts`: zócalo, cantoneras y cornisa de marès (`menorcaTrim`) y ventanas con marco y alféizar de marès y persianas de lamas (`menorcaWindow`). Lo usan la calle de casa, los vecinos del jardín y los alrededores (`surround.ts`, también en los caps. 1, 6, 7 y 8) |
| Ventanas de los padres: cuadrados grises | Marco blanco, alféizar y persianas de lamas blancas |
| Rayas finas en las paredes largas del pasillo | Acné de la sombra de la luna (va baja): `normalBias` 0,16 y `bias` -0,0012 solo en esta luna |
| Diana de anillos en la fachada trasera | Luz del porche separada de la pared y más floja; `comicBand` con tres anillos como mucho y tope 1,5 (ya no quema a blanco) |
| El Born parecía un atardecer naranja | Sus tres luces, al 60 % y con 12 m de alcance |
| Calle sin luz bajo las farolas | `comicLightPool`: charco plano de dos discos bajo cada farola (malla plana: no cuesta como una luz de verdad); solo de noche (`buildStreet({ night })`) |
| Coches = bloque de color | Brillo dibujado en la pintura (`COMIC_GLOSS`): mancha blanca donde refleja la luna o el sol y raya clara del horizonte (D6c hecho, sirve para todos los coches) |
| Explanada del Born de «ladrillitos» de foto | Adoquín a 2,6 m por repetición (antes 1,6) |
| Grava de ruido de puntitos | Guijarros dibujados con contorno de tinta |
| Olas de la piscina como manchas blancas borrosas | Cara de la ola un tono más clara y su borde una línea blanca de trazo duro |
| Halo de la luna: disco gris | Dos aros planos azul pálido |

Comprobado: capturas de todas las fases; cap. 1 sin cambios visibles; caps. 4 y 7 (noche) siguen legibles; consola sin errores (solo el aviso de vibración de la prueba automática).

## Tercera pasada (9-nov, noche): lo que vio el dueño
| Problema | Arreglo |
|---|---|
| El rótulo del Bar Imperi, atravesado por una mancha negra | Su marco negro se combaba a mano alzada y el rótulo (un plano de una pieza) no: lo atravesaba. Rótulo, puerta, persianas y rótulos de piedra del Born, partidos en trozos de 0,4 m (`bendable`) y el rótulo separado del marco |
| Sillas de la terraza del Imperi con el respaldo flotando | Silla de director de verdad (`directorChair`): patas traseras hasta el respaldo, brazos, aspas y lona de asiento y respaldo |
| Un disco con aro delante del coche de Gas «que no se sabe qué es» | Era el brillo de los faros pasado a halo. Ahora, el haz en el suelo: un abanico plano que se abre delante del coche (`comicLightFan`) |
| Luces «aleatorias», que no salen de ninguna lámpara (discos amarillos en la fachada del Imperi, en la de casa y en la terraza) | Fuera las luces sueltas (tres en el Born, la del patio, la del porche). La luz se dibuja donde hay lámpara: charco al pie de cada farola del Born y de la calle, abanico bajando por la fachada desde cada farol de pared (Imperi y farolillo de la puerta de casa), luz de las cristaleras en la terraza. La de la piscina se queda, más corta, dentro del vaso |
| Al salir de la piscina, fundido a negro y vestidos | Salen desnudos y sin corte: Azul nada a la escalera, sube y sale al borde; Gas, detrás (`climbing`). De ahí, a pie a las toallas. Siguen sin ropa en las toallas y en las estrellas (la ropa se queda en el borde) |

## Cuarta pasada (9-nov, noche): menos oscuridad y Marco Polo
Decisión del dueño: **las lámparas no iluminan nada**. Ni farolas, ni faroles de pared, ni faros, ni la luz de la piscina dan luz o reflejo en ningún sitio: solo se ven encendidas (su halo). Se han quitado los charcos, los abanicos de luz (y sus funciones `comicLightPool` / `comicLightFan`), el haz de los faros y la luz de la piscina; las tablas de arriba que los mencionan quedan como historia.

| Cambio | Cómo |
|---|---|
| Noche menos exagerada | Perfil `noche`: ambiente azul claro (0x9aa8e0 / 0x4a4a70, 1,0). Cap. 2: `hemiScale` 0,32 y luna 0xb8c8ff a 2,0. Se ve de noche, pero las fachadas en sombra se leen (antes casi negras) |
| Grava | Guijarros más grandes, menos y con la tinta suave: de lejos era un ruido blanco y negro |
| Minijuego: Marco Polo susurrado | Tras la luz de los padres, Gas propone jugar «flojito» y cierra los ojos. Cinco «¡Marco!» (bocadillo sobre Gas); hay 2,6 s para pulsar «🗣️ ¡Polo!» y Gas nada a ciegas hacia donde has contestado (si no contestas, va directo y más rápido). Nadar sin parar hace ruido: a los ~2,4 s te oye y va a por ti; hay que nadar a ratos. Si te alcanza, «¡PILLADA!» (una vez por «Marco»). Al final, el resultado en un bocadillo y en la pantalla del capítulo («Marco Polo: ni una vez 🏆» / «te pilló N veces 😘»), y a la escalera. Panel de prueba: «M · Marco Polo» |

## Quinta pasada (9-nov, noche): viaje, cuerpo, agua y partida completa
| Problema | Arreglo |
|---|---|
| Al subir al coche, la cámara empezaba entre paredes y persianas de la calle | El viaje ya no empieza en la calle: cámara detrás del coche desde el primer fotograma |
| Viaje corto y recto, sin hablar | `world/countryRoad.ts`: camino de campo con curvas (unos 260 m), paredes de piedra seca, barreras de acebuche, acebuches, pinos y dos llocs; entra en la calle de casa por el este. Dura ~33 s, lo que tardan en hablar: diez bocadillos en `NIGHT.drive` (story.ts) — hola, qué tal, vas muy guapa, qué random, a casa de mis padres, silencio que duermen… |
| Cuerpo sin ropa de Azul: su modelo pintado de piel (un mono con el bulto del pantalón) | Cuerpo de mujer de MakeHuman en su versión sin ropa, con su piel, su pelo y sus ojos. Nota: la cara es la del modelo de MakeHuman, no la suya |
| El agua sobresalía de la piscina | La malla de ondas iba ganando o perdiendo agua con cada brazada y el nivel se desplazaba. Ahora conserva el volumen (se quita la subida media) y las olas tienen tope de 14 cm (el agua está 22 cm bajo el borde) |

Partida completa jugada con el teclado, de la intro a «¡Capítulo superado!», sin errores en la consola. Fallos encontrados por el camino y arreglados:
- **Sigilo imposible con teclado o joystick a fondo**: en el jardín Azul iba a 5 m/s y los padres se despertaban al segundo. Ahora, de puntillas (2,3 m/s, sin acelerón): solo la grava hace ruido.
- La animación de andar, según la velocidad real (de puntillas ya no corre).
- Polvo de los pies en el jardín (el acelerón): quitado al ir de puntillas.
- Guirnalda de la pérgola: eran halos enormes; ahora bombillas de tebeo.
- Gas atravesaba la pelota nadando: ahora también la aparta.
- Las copas de los ficus del Born tapaban la cámara: más altas.

## Sexta pasada (9-nov, noche): realismo y coherencia
| Problema | Arreglo |
|---|---|
| Tumbados, flotaban sobre la toalla | Se mide la malla ya posada y se apoya en la toalla (`restOnTowel`); postura de tumbado fija (`liePose`: brazos a lo largo, sin los gestos de estar de pie, que levantaban un brazo); sombra de contacto alargada debajo; la sombra redonda de los pies, apagada (de canto parecía que flotaban). `userData.blobOff` hace que siga apagada al quitar las sombras en el móvil |
| Pasos de cebra que no llevaban a ningún sitio | De bordillo a bordillo: a Correus y al Imperi; el de Ses Voltes solo cuando la calle sigue (Sant Joan) |
| Carretera «cutre» | `countryRoad.ts` rehecho como la de Son Oleo (Street View del dueño): dos carriles con discontinua y líneas de borde, carril bici rojo con armadillos negros y amarillos, bordillo y acera de baldosa roja, pared seca con remate de marès y lentisco y acebuche detrás; al otro lado, acera y casas encaladas de la urbanización con murete blanco y pilares, palmeras, araucarias y buganvillas; farolas altas de un brazo; señales de «Urb. Son Oleo». Curvas suaves; entra en la calle de casa |
| Luna llena en el cielo | Fuera: el 27-8-2025 era casi luna nueva y a la una ya no estaba (por eso la Vía Láctea y la «oscuridad tenebre» del diálogo) |
| Casa de los padres «despierta» a la una | Garaje con la basculante bajada y sin luz, ventanas de la fachada apagadas, las cristaleras de la terraza solo con una lámpara baja (`buildStreet({ night })`) |
| Sombrilla abierta de noche, atravesada por la guirnalda | Cerrada y atada |
| Bar Imperi abierto y vacío | Tres de tertulia en la terraza, de pie junto a la mesa del fondo |
| Polvo de los pasos color crema de noche (parecía que brillaba) | Gris azulado de noche (`dust.tint`) |
| Luciérnagas grandes; una pegada a la cámara en las estrellas | Más pequeñas; ocultas mientras se miran las estrellas |
| Objetivo «al otro lado de la piscina» | «en el césped junto a la casa», que es donde están |

## Séptima pasada (10-nov): revisión de fallos y capítulo menos «pim pam»
| Problema | Arreglo |
|---|---|
| Ventanas del Ajuntament: rectángulo negro con un triángulo encima | Ventanas ojivales de verdad: marco de marès con su arco, cristal con el mismo arco, parteluz y alféizar; la galería alta con columnitas |
| Pasos de cebra y discontinua con bordes de dientes de sierra | Pintura plana sobre el asfalto (`paintMat`, sin grosor y adelantada en profundidad); la tinta ya no les dibuja borde |
| Gas saludando con el brazo roto | Ya no saluda: espera quieto, mirándola |
| El gesto de «asentir» que hacían siempre | `noFidget` en Azul y Gas (vestidos y sin ropa) |
| El coche arrancaba lentísimo | Sale ya en marcha (4 m/s) y acelera fuerte a su velocidad de crucero; frena para girar y para delante del vecino |
| Los globos del coche salían centrados y sin rabito | Cada uno sale de su asiento (`speakerPoint`): el de Gas a la izquierda, el de Azul a la derecha, con el rabito apuntando a quien habla (`bark(…, side)`, `--tail-x`) |
| No se podía ir rápido en el jardín y la barra no subía | Se anda a velocidad normal y se puede correr; correr y la grava hacen ruido. De puntillas con el joystick poco empujado o con Mayúsculas |
| La carretera cambiaba de golpe a la calle de casa | Cruce en T: la carretera de Son Oleo pasa por delante (de sur a norte) y la calle de casa sale de ella; el coche frena y gira a la derecha. Bordillos y aceras con su esquina |
| Recuerdo «la cola» tapado por la tertulia | La tertulia, en la otra mesa de la terraza, sobre la acera |
| Al acabar Marco Polo empezaba otra partida | `mpDone` |
| Gas tumbado flotaba medio metro | La postura de tumbado llega a los huesos fundiéndose; se vuelve a apoyar en la toalla durante su primer segundo y medio (`lieSettle`) |

**Más largo y sin pistas**
- Sin flecha, sin columna de luz y sin la flecha del HUD salvo si lleva 40 s sin avanzar (`lostT`). Objetivos cortos (🤫, 💙…), sin decir qué hacer; los avisos de texto, como bocadillos de Gas.
- Nuevos pasos: despedirse de la tertulia del Imperi antes de irse (si no, «Uy… que no me he despedido de estos»); un cartel «Pins →» en el Born; las toallas están dobladas en la mesa de la terraza, bajo la ventana de los padres, y hay que ir a por ellas antes de la piscina; a medio camino del jardín, una luz arriba sin haber hecho nada: quieta hasta que se apague; Marco Polo de 7 rondas; al acabar, Gas sale el primero, va a su toalla y se tumba, y ella va cuando quiere.
- Viaje: ~33 s con la conversación, por la carretera de Son Oleo con su cruce.

Comprobado jugando: despedida, Pins, viaje y cruce, llegada, sigilo corriendo (sube la barra, salta la luz, se para), toallas, Marco Polo completo (y que no se repite), Gas saliendo y tumbándose, los dos en las toallas apoyados (2-3 cm), estrellas; consola sin errores.

## Falta (común a varios capítulos)
- fps medidos en el móvil del dueño.
- Azul con su VRM también en el cap. 2 (hoy solo en el 1): pendiente de que el dueño lo decida.
