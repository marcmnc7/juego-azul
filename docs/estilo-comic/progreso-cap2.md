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

## Falta (común a varios capítulos)
- fps medidos en el móvil del dueño.
- Azul con su VRM también en el cap. 2 (hoy solo en el 1): pendiente de que el dueño lo decida.
