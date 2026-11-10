# Progreso · Capítulo 7 «Cena a escondidas» (F6)

Primera pasada hecha el 10-nov-2026 **solo leyendo código** (sin navegador): todo está pendiente de comprobar en captura. Perfil `noche` (`LOOKS[7]`). Filas del inventario `inventario-cap6-cap8-carta.md`, secciones 7.1 a 7.5.

**Estado:** **código** = resuelto en código, falta la captura · **auto** = lo resuelve la base común · **aceptado** = se queda así · **ver** = necesita verse para decidir · **8** = solo de día, lo decide el cap. 8.

Regla para la casa y Sa Farola, que comparten los caps. 6 y 8: **todo lo nuevo va solo de noche** (`day === false`). De día el cap. 8 ve lo mismo que antes; los arreglos de Sa Farola que le pueden servir están en `buildSaFarola(…, opts)`.

## Hora, cielo y luces
| Qué | Estado | Cómo |
|---|---|---|
| La hora | código | El 13-7-2026 el sol se pone en Ciutadella a las 21:13 (NO, sobre el mar); crepúsculo civil hasta las 21:45, noche cerrada a las 22:25. El cielo, la niebla, la luz principal, la hemisférica del nivel y la del cómic siguen al reloj del capítulo: atardecer (21:05) → hora azul (21:45) → noche como el cap. 2 (`TINTS`, `DUSK`). Las estrellas salen al oscurecer; el mar pasa del azul del atardecer al de noche |
| Luna | código | No había: era la víspera de la luna nueva (la siguiente fue la del eclipse del 12-8). Sin disco de luna |
| Noche | código | Valores del cap. 2: hemisférica 0x6f7fc0/0x1a2030 a 0,35, luz 0xb8c8ff a 2,0, `normalBias` 0,16, `bias` -0,0012 |
| Luces de punto | código | Fuera las dos `PointLight` (porche y cocina). Ninguna lámpara alumbra nada |
| Lámparas que se ven encendidas | código | Dos apliques en la fachada (a los lados de la puerta) con su halo; las farolas, al ponerse el sol; el faro, con la linterna encendida (color que brilla solo) y su luz de tebeo que destella cuando la óptica apunta a la cámara. Sin el haz en el aire |
| Faros de coches y moto | código | Sin halos grandes delante: los faros emisivos del modelo. El del vecino, dos luces pequeñas de tebeo |

## 7.1 Casa de los padres
| Objeto | Estado | Cómo |
|---|---|---|
| Losas, calle, tierra, casa, ventanales, persianas, porticones, escalera, toldo, pérgola, muros, casas vecinas, pinos, araucaria | auto | Superficie dibujada (D2) y `Merger` partido (D3) |
| Barandillas, antena, retrovisores del escúter, cables | código | De noche, 2 cm más gruesos (`fat`) |
| Luz por la puerta y ventanas encendidas | aceptado de noche / **8** | De día siguen encendidas: diff propuesto en el informe |
| Buganvilla de matas pequeñas | ver | Hecho así a propósito en su día («flores y hojas, no bolas»); mirar la tinta |
| Cancela y puerta (`Door`) | auto | `leaf.userData.comicBent` |
| Cristal de la puerta | aceptado | Transparente, sin tinta |
| Cocina de fuera | código | De noche, malla aparte sin doblar: la sartén se queda en el fogón. La olla ya no flota 6 cm |
| Mesa, mantel y sillas | código | De noche, malla aparte sin doblar (5b): platos, vela, frutero y quien se sienta quedan en su sitio. Los platos de siempre, apoyados en el mantel (flotaban 1 cm) |
| Vapor ×4 | código | Nubecillas de tebeo con contorno; crecen y se deshacen al subir |
| Guirnalda ×17 | código | De noche, bombillas de tebeo (`Points` + `comicBulbTexture`); apagadas hasta que Azul le da al interruptor |
| Farolas (halo) | código | Luz de tebeo automática; se encienden al ponerse el sol |
| Luz del faro / haz | código | Ver arriba |

## 7.2 Valle y cala
| Objeto | Estado | Cómo |
|---|---|---|
| Terreno | ver | Lleva `surf` por triángulo; comprobar que sale roca, arena y monte dibujados |
| Agua de la cala y mar abierto | código | De noche, agua de tebeo (`makeSea`), la misma del mar del faro |
| Muro de marès de 274 m | código | De noche, en diez tramos (se parten y se comban) |
| Rocas | ver | Facetas duras: mirar si hace falta roca dibujada |
| Casas de la otra orilla | auto | Ventanas 0xffd9a0 = `Surf.Glow` |
| Sombrillas de la playita | código | Solo de día (de noche no queda nadie) |

## 7.3 Sa Farola (también el cap. 8, de día)
| Objeto | Estado | Cómo |
|---|---|---|
| Discontinua del Camí | código | Pintura plana (`paintMat`) de noche; el 8 puede pedirla con `{ paintLine: true }` |
| Coches de cajas | código / **8** | `{ hdCars: true }` pone coches HD; por defecto no (desde la casa no se ven) |
| Cable | código | De noche, 5 cm |
| Luces de las farolas (`Points`) | auto | Luz de tebeo de noche |
| Torre del faro | código | De noche, partida en altura (`bentTower`) |
| Linterna | código | De noche, encendida |
| Mar | auto | `makeSea` |
| Rocas de marès, charcos | ver | — |

## 7.4 Alrededores
Común (`surround.ts`): luces de las ventanas, auto de noche.

## 7.5 Vehículos, juego y efectos
| Objeto | Estado | Cómo |
|---|---|---|
| Coche de los padres | código | `comicBent` (HD); aparcado en el lado del valle mirando al pueblo; vacío hasta que suben (el padre ya no sale dos veces) y con la madre de copiloto; sale ya en marcha (2,5 m/s, 4,5 m/s²) apartándose del bordillo |
| Moto de Gas | código | No está hasta que le dice «Ven»; llega ya en marcha (8 m/s), frena y aparca «más adelante» (como ella le pidió a las 20:58), en la pata de cabra. Al irse, da la vuelta en la calle inclinándose y acelera |
| Coche del vecino | código | Creado al cargar (antes, a mitad de juego); con conductor; pasa de largo y aparca más abajo (antes se quedaba parado delante de la cancela para siempre) |
| Casco de Gas | código | Lo lleva en la mano, lo deja en el suelo junto al escúter (antes flotaba a 72 cm sobre nada), ella lo esconde con el susto y se lo devuelve |
| Platos de la cena | código | Salen al sentarse (antes solo existían durante el susto) |
| Anillos amarillos | código | Fuera (eran pistas) |
| Marcador, flecha, columna | código | Solo a los 40 s sin avanzar (`Lost`) |
| `TableMemory` | código | La mesa está puesta como en la foto desde el principio, se ve movida en la cena y queda como en la foto al acabar; tallos más gruesos; llama de la vela que brilla sola |
| Paneles del minijuego, radar, chats | **común** | D6e (CSS) |

## Pasos nuevos (ritmo)
1. Gas espera en la cancela: hay que ir a abrirle.
2. Antes de cenar, encender la guirnalda.
3. Después del susto, el casco: ir a por él y dárselo; él sale, se monta y se va (sin fundido).
4. Al final, ir a la puerta de casa para subir a la cama.

## Falta
- Capturas de todas las fases y una partida entera.
- Lo marcado «ver» y «8».
