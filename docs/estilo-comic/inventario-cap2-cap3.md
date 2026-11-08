# Inventario estilo cómic · Capítulos 2 y 3

Generado el 9-nov-2026 leyendo el código (auditoría de solo lectura).

No he tocado ningún archivo de código. Todas las rutas son relativas a `src/`. Cito las decisiones D1–D6 de `docs/PLAN-estilo-comic.md`.

**Leyenda**
- **Clases:**
  - **A**: se convierte sola y queda bien.
  - **B**: no se convierte (Basic, Shader, Points, Sprite, Line) y hace falta una versión de tebeo hecha a mano.
  - **C**: se convierte, pero hay que cuidarla (instanciada, emisiva, transparente, poco subdividida, foto sin dibujo a mano, luz de noche).
- **Materiales:**
  - `toon()` = MeshStandard con el sombreador de grano (`core/gfx.ts:47`).
  - `Merger` = vertexMat/foliageMat (`entities/models.ts:27-44`): colores por vértice y atributo `surf`, **sin UV**.
  - `Basic` = MeshBasicMaterial.
- **Texturas:**
  - "surf:X": superficie triplanar del grano. **Se pierde** al pasar a cómic y queda color liso (D2).
  - "lienzo rep.": canvas con RepeatWrapping. Pasa por `drawnMap` automático.

---

## 0. Hallazgos que afectan a los dos capítulos

| # | Problema | Dónde | Efecto | Qué hacer |
|---|---|---|---|---|
| H1 | `comicScene` se ejecuta antes que `applyShadows` en la escena principal, pero después en las subescenas | `main.ts:530-531`; subescenas: `world/level2.ts:1278, 1354, 1395`, luego `main.ts:727-730`; `core/gfx.ts:314` | En las escenas principales (cap. 2 y 3) la hemisférica del cómic, de 1,35, queda ×0,55 = 0,74. En el camping, la terraza y la Laurel queda a **1,35 entera**. Son luces de ambiente distintas dentro del mismo capítulo, y el camping y la Laurel (de noche) quedan inundados de luz de día | Perfil de luz por escena (D1), con un orden fijo |
| H2 | Las estrellas de `Sky` escriben profundidad | `core/gfx.ts:622` (PointsMaterial sin `depthWrite:false`), a r=400 < far=500 (`main.ts:87`) | La pasada de tinta las trata como siluetas (`core/comic.ts:507-521`) y las oscurece ~60 % | `depthWrite:false`, o estrellas de tebeo |
| H3 | Se congela el desplazamiento de las texturas animadas | `drawnMap` y `withRepeat` copian el `offset` (`core/comic.ts:170, 233-240`) en una textura nueva | Carretera y suelo del cap. 3 (`world/level2.ts:963-965`): las líneas viajan con el coche y **no hay sensación de avance**. Cáusticas de la piscina (`world/level4.ts:710`): quietas | Que la textura dibujada comparta el `offset`, o que el nivel anime `mesh.material.map` |
| H4 | `drawnMap` baja el contraste al 45 % | `core/comic.ts:151-154` | Las líneas blancas de la carretera, las rayas del toldo, la grava, las baldosas y las cáusticas se apagan | Dibujos a mano (`userData.comic`) para estas texturas de lienzo |
| H5 | Geometría compartida que aparece de una en una se dobla varias veces | `handDrawn` cuenta usuarios en cada pasada (`core/comic.ts:364-375`); los obstáculos del cap. 3 reutilizan la geometría por tipo (`world/level2.ts:817`) | Cada coche o tractor nuevo que está solo en escena vuelve a doblar **la misma** geometría: la deformación se acumula (~10 cm por pasada) | `userData.comicBent = true` al crearlos, o doblarlos una vez en `buildObstacles` |
| H6 | Brillos aditivos | `core/comic.ts:399-417` | Points ≥0,6 → **ocultos**. El resto → opacidad ×0,4 **para siempre**, salvo que el nivel la reescriba cada fotograma. De noche hace falta lo contrario (D4) | Recetas de brillo de noche |
| H7 | Halos que se crean durante el juego | La pasada de cómic va cada 1 s (`main.ts:727`) | Salen al 100 % y al cabo de ≤1 s bajan al 40 %: parpadeo | Convertirlos al crearlos |
| H8 | Transparentes sin escritura de profundidad (agua de la piscina, mosaico) | `core/gfx.ts:908-911`; `world/level4.ts:584` | La tinta de lo que hay debajo se pinta **encima**. El alfa resultante quita la marca de personaje (`core/comic.ts:483`) | Contorno propio o `depthWrite` según el caso |
| H9 | Lo que se mueve se dobla una vez donde está al convertir (coches, hojas de puertas, vaca) | `core/comic.ts:371-389` (no mira si se mueve) | Queda torcido en su espacio local | Aceptarlo o marcar `comicBent` |
| H10 | Mesas dobladas con objetos encima sin doblar | `handOffset` a y≈0,76 mueve ~7 cm en horizontal | El plato, las copas y las zamburiñas de la terraza, el farolillo del camping y la plancha se desajustan | Marcar `comicBent` en esos muebles, o doblar también lo de encima |
| H11 | `Merger` no lleva UV (`entities/models.ts:59`), su `surf` se pierde y no está subdividido | Casi todo el decorado | Los dibujos a mano no se pueden aplicar. Liso, sin tinta interior, sin combarse | D2 (triplanar de tebeo) y D3 |
| H12 | Ventanas y luces "encendidas" hechas con `Merger` (0xffd9a0 y similares, sin emisivo) | Varias | Con tres tonos quedan sombreadas: **de noche no brillan**. Las de `Basic` sí brillan | Emisivo, o `Basic` + tinta |
| H13 | Líneas de acción por velocidad | `core/comic.ts:634` (>5 m/s) | En el cap. 3 salen durante **todo** el viaje (26 m/s, 37 con turbo) | Decidir si solo con el turbo o en los golpes |
| H14 | El tope del sol a 2,1 se anula | `world/level2.ts:896` reescribe 2,3·(1−0,6·mojado) cada fotograma | — | Respetar el tope en el nivel |
| H15 | Cielo nocturno | `Sky.night()` solo aclara la noche en el estilo pintado (`core/gfx.ts:553-557`) | En cómic la cúpula sale casi negra (0x02030f). El fondo azul que fuerza `comicScene` (`core/comic.ts:431`) **no se ve** porque la cúpula (r 420, `core/gfx.ts:548`) lo tapa | Cúpula de tebeo de noche (D1) |

---

## 1. Capítulo 2 · «La piscinita» (`Level4`, `world/level4.ts`): una sola escena, de noche

### 1.1 Fases, luz y qué rompe `comicScene`

| Fase | Lugar | Hora |
|---|---|---|
| intro / atBar | Born de Ciutadella, Bar Imperi (x≈−600) | noche |
| drive | Calle de casa (el coche entra de x=40 a 11) | noche |
| arrive | Calle → verja → pasillo | noche |
| toPool | Pasillo, grava, jardín (ventanas de los padres) | noche |
| diving / hug / swim | Piscina | noche |
| toTowels / love | Césped, toallas, mosaico | noche |
| stars / ending | Cámara en las toallas mirando al cielo (constelación) | noche |

**Cómo está montada la luz** (`world/level4.ts`):

| Elemento | Dónde | Valores |
|---|---|---|
| Niebla | :187 | Fog 0x0b1030, 35–140 |
| Cúpula | :188 | 0x02030f / 0x0b1440 / 0x1d2350, 1400 estrellas |
| Vía Láctea y luna | :190 → :324-347 | — |
| Hemisférica | :191 | 0x6f7fc0 / 0x1a2030, 1,1 |
| Luna (direccional con sombras) | :193 | `Sun` 0xa9bcff, 1,0 |
| Luz de la piscina | :194-196 | PointLight cian, 14 |
| Luz del porche | :197-199 | PointLight 10 |
| Luces del Born | :208-212 | 3 × PointLight 14/12 |
| Luz de casa | `world/homeStreet.ts:343-345` | PointLight 9 |
| HDRI | — | Ninguno (el 2 no está en `HD_DAY_CHAPTERS`, `main.ts:371`). Entorno PMREM sacado de la cúpula (`core/gfx.ts:296-316`) |

**Qué pasa con `comicScene`:**
- El fondo azul forzado queda oculto tras la cúpula, que sigue casi negra (H15).
- `environment = null`, pero después `applyShadows` lo vuelve a poner (sin efecto en los materiales toon).
- La luna (1,0) no se toca.
- Se añade la hemisférica de día 0xdff2ff/0xb59c84, que queda en 0,74 (H1): **la noche se aclara con tono de día**.
- Halos de farolas y ventanas → ocultos. Guirnalda, faros y farolas del Born → 40 %. Estrellas de la constelación → 40 % (rompe el minijuego). Estrellas del cielo entintadas (H2).

### 1.2 Inventario

**Cielo y luces**

| Objeto | Archivo:línea | Construcción | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|---|
| Cúpula nocturna | `world/level4.ts:188`, `core/gfx.ts:541-549` | Esfera r420, BackSide | Basic | colores por vértice | B | Cúpula de tebeo de noche (plana o en 2 bandas) |
| Estrellas (1400) | `core/gfx.ts:613-624` | Points 1,8 px | PointsMaterial (escribe profundidad) | — | B | Estrellas dibujadas, `depthWrite:false` (H2) |
| Vía Láctea (2500) | `world/level4.ts:324-342` | Points en `sky.group` | PointsMaterial 0,5 | — | B | Banda dibujada |
| Luna | `world/level4.ts:343-346` | Sprite escala 60 | SpriteMaterial | glow (degradado) | B | Luna de tebeo (disco plano + tinta) |
| Hemisférica, luna, PointLights | ver 1.1 | luces | — | — | C | Perfil "noche" (D1) |

**Born / Bar Imperi** (`world/born.ts`, origen `BORN_O`, `{cars, night}`)

| Objeto | Archivo:línea | Construcción | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|---|
| Manzanas (estuco teñido) | `world/born.ts:96-105`, `world/hd/townHD.ts:28-34` | Builder subdividido | std (whites[0] clonado) | foto → dibujo `wash` | A | = cap. 1 |
| Cornisas | `world/hd/townHD.ts:33` | Builder | `M.mares` | `mares` | A | — |
| Zócalos, marcos, alféizares, losas de balcón | `world/hd/townHD.ts:49-69` | Builder | mares / maresDark | `mares` | A | — |
| Puertas y rejas (calcos del atlas) | `world/hd/townHD.ts:56, 59` | decal | `M.doors` | `doors` | A | — |
| Persianas de lamas | `world/hd/townHD.ts:63`, `world/hd/materials.ts:96-134` | decal | std | lienzo (sin repetir) | A | — |
| Barandillas de hierro | `world/hd/townHD.ts:66-68` | Builder (engordado) | `M.iron` | — | A | — |
| Calzada | `world/born.ts:130-133` | Plane | `toon` | surf:Asphalt | C | Dibujo de asfalto (falta) |
| Aceras | `world/born.ts:134-148` | Plane | `toon` | surf:Paving | C | `slabs` / D2 |
| Bordillos, zócalo de la explanada | `world/born.ts:142, 163` | `Merger` | `Merger` | Paving/Stone | C | D2, D3 |
| Marcas viales, pasos de cebra | `world/born.ts:151-161` | `Merger` | `Merger` | — | A | — |
| Explanada de adoquín | `world/born.ts:164-167` | Plane | `toon` | surf:Cobble | C | Dibujo de adoquín (falta) |
| Obelisco (gradas, lápidas, pilar, pirámide, remates) | `world/born.ts:171-184` | `Merger` low-poly | `Merger` | Mares/Stone | C | D2, D3 |
| Verja (28 barrotes, puntas, 2 aros) | `world/born.ts:185-191` | `Merger` | `Merger` | Metal | A | Barrotes finos (el Builder del cap. 1 los engorda) |
| Césped del obelisco | `world/born.ts:180` | `Merger` (cilindro) | `Merger` | Grass | C | Dibujo de hierba |
| 4 faroles del obelisco | `world/born.ts:192-195` | `Merger` | `Merger` | cristal 0xf4e6c0 | C | De noche no brillan (H12) |
| Ajuntament (almenas, torre, puerta, arco, reloj, ojivas, galería) | `world/born.ts:202-221` | `Merger` | `Merger` | surf | C | D2, D3 |
| Bar Imperi: zócalo, marco de puerta | `world/born.ts:226-228` | `Merger` + TownHD | — | — | A/C | — |
| Puerta verde del Imperi | `world/born.ts:229-231`; `world/homeStreet.ts:67-108` | Plane | Basic | lienzo | B | Puerta de tebeo; de noche brilla sola |
| Rótulo «Bar Imperi» + caja trasera | `world/born.ts:232-235`; `world/homeStreet.ts:48-65` | Plane | Basic | lienzo (cursiva) | B | Rótulo de tebeo |
| Persianas del Imperi (×4) + marcos | `world/born.ts:236-243` | Plane | `toon` | lienzo (sin repetir) | A | — |
| Farolillos del Imperi | `world/born.ts:245-248` | `Merger` | `Merger` | — | C | Sin luz visible (H12) |
| Toldo y terraza (3 mesas, sillas de director, vasos) | `world/born.ts:250-265` | `Merger` | `Merger` | — | A | — |
| Teatre des Born (columnas, entablamento, frontón, puertas) | `world/born.ts:269-274` | `Merger` | `Merger` | — | C | D3 |
| Buzón de Correus | `world/born.ts:279` | `Merger` | `Merger` | — | A | — |
| Palau (logia), Casino (pilastras, ventanas, medios cilindros, balcón corrido) | `world/born.ts:288-303` | `Merger` | `Merger` | — | C | D3 |
| 7 rótulos (Ajuntament, Teatre, Correus, Palau, Casino, Plaça des Born, Ses Voltes) | `world/born.ts:59-82` (+222, 275, 278, 293, 304, 315, 320) | Plane | Basic | lienzo (Georgia) | B | Rótulos de tebeo |
| 8 farolas fernandinas | `world/born.ts:325-329`; `entities/models.ts:1179-1192` | `Merger` | `Merger` | cristal sin emisivo | C | Encenderlas de noche |
| Halos de las farolas (×8) | `world/born.ts:362-368` | Sprite | SpriteMaterial aditivo (compartido) | glow | B | Al 40 %; bombilla de tebeo de noche |
| Araucaria | `world/born.ts:330`; `entities/models.ts:1160-1177` | `Merger` + copas | foliage | Foliage | C | Copas sin recorte de hojas |
| 3 ficus + alcorques | `world/born.ts:332-337` | `Merger` | `Merger` | — | C | — |
| 4 bancos de piedra | `world/born.ts:339-343` | `Merger` | `Merger` | — | A | — |
| 4 coches aparcados | `world/born.ts:346-356` | `makeCarHD` (vacíos) | ver «Coche» | — | C | H9 |

**Coche azul de Gas** (`world/level4.ts:172`, `makeCarHD` en `entities/vehiclesHD.ts:82-168`; los coches del Born se hacen igual)

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Carrocería lacada, techo, retrovisores | `entities/vehiclesHD.ts:106-116, 120, 134` | MeshPhysical (barniz, metal 0,6) | C | Pintura de coche de tebeo (brillo dibujado); se dobla una vez (H9) |
| Habitáculo de cristal tintado | `entities/vehiclesHD.ts:115` | Physical transparente 0,82 | C | Tapa la marca de personaje de los ocupantes |
| Plásticos, paragolpes, calandra, pilares | `entities/vehiclesHD.ts:98, 119, 123-127` | Standard | A | — |
| Cromo | `entities/vehiclesHD.ts:99, 128` | Physical metal 1 | A | Queda gris plano |
| Faros / pilotos | `entities/vehiclesHD.ts:101-102, 130-131` | emisivos | C | Luz de tebeo de noche |
| Matrículas | `entities/vehiclesHD.ts:135-136` | Standard | A | — |
| Ruedas (neumático, llanta, radios) | `entities/vehiclesHD.ts:139-153` | Standard (geometría compartida) | A | — |
| Sombra de mancha | `entities/models.ts:304-312, 1212` | Basic transparente | B | Solo se ve sin sombras reales |
| Haz de los faros | `world/level4.ts:221-224` | Sprite aditivo | B | Al 40 %; cono plano de tebeo |

**Calle de casa** (`world/homeStreet.ts`)

| Objeto | Archivo:línea | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|
| Calzada | :177 | `Merger` | Asphalt | C | Dibujo de asfalto |
| Línea discontinua | :178 | `Merger` | — | A | — |
| Bordillos | :179 | `Merger` | — | C | — |
| Aceras de baldosa N y S | :180-189 (+ `tileTexture` :30-46) | `toon` | lienzo rep. (130,1) | C | `drawnMap` automático (H4); dibujo de baldosa |
| Pavimentos | :190-191 | `Merger` | Paving | C | D2 |
| Fachada amarilla, cornisa, alero de teja (ROOF_GEO), chimenea | :197-201 | `Merger` | Plaster/Roof | C | Teja sin dibujo (H11) |
| Ventanas con contraventanas (`window_`) | :138-144, 202-206, 306-307 | `Merger` | Louvre | C | Las encendidas no brillan (H12) |
| Barandilla del balcón | :204-205 | `Merger` | — | A | — |
| Garaje con luz (0xff9a3a) | :208-211 | `Merger` | — | C | H12 |
| Puerta de entrada, pomo, farolillo | :213-216 | `Merger` | — | C | Farolillo sin brillo |
| Patio, muros laterales | :218-224 | `Merger` | — | C | — |
| 4 pilares con remate | :226-230 | `Merger` | — | C | — |
| Puerta corredera de lamas (animada) | :232-240, `world/door.ts` | `Merger` en `leaf` | — | C | H9 |
| Muros, piedra seca, buzón | :242-246, 267 | `Merger` | DryStone | C | Dibujo de piedra seca |
| Puerta peatonal (animada) | :249-259 | `Merger` | — | C | H9 |
| Placa metálica, cartel de la alarma | :268, 294 | `Merger` | — | A | — |
| Placa «Sa Son 69 B4» | :270-293 | `toon` | lienzo con texto | A | Fuente de tebeo opcional |
| 3 palmeras | :297-299 (`palm` :131-135; `palmCrown` `entities/models.ts:1409`) | `Merger` | Bark/Foliage | C | — |
| Seto + copa | :300-301 | `Merger` | — | C | — |
| 2 casas vecinas blancas + muros | :302-309 | `Merger` | — | C | — |
| 17 casas de la urbanización (cuerpo, tejado, chimenea, ventanas) | :147-158, 312-324 | `Merger` | — | C | D2, D3 |
| 8 farolas (poste, brazo, cabeza) | :327-335 | `Merger` | — | C | Cabeza sin luz |
| Halos de farolas y farolillo (9) | :337-342 | Points 1,6, aditivos | glow | B | **Ocultos en cómic**: la calle se queda sin farolas encendidas |

**Alrededores** (`world/surround.ts`, `night:true`)

| Objeto | Archivo:línea | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|
| Suelo de campo | :61-76 | `Merger` | Grass | C | Dibujo de hierba |
| Casas (cuerpo, tejado o azotea con pretil) | :113-125 | `Merger` | Plaster/Roof | C | D2, D3 |
| Ventanas con persiana (algunas encendidas) | :127-143 | `Merger` | Louvre | C | H12 |
| Muros de jardín | :151-154 | `Merger` | — | C | — |
| Pinos, palmeras, acebuches | :78-94, 108-109, 155 | `Merger` | — | C | — |
| 26 lomas del horizonte | :160-167 | `Merger` (esferas enormes) | — | C | — |
| Brillo de las ventanas encendidas | :171-178 | Points 1,4, aditivos | glow | B | Ocultos en cómic |

**Casa y jardín** (`world/level4.ts`, `buildHouse`)

| Objeto | Archivo:línea | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|
| Césped propio y de los vecinos | :361-370 | `Merger` | Grass | C | Dibujo de hierba (falta) |
| Terraza de losas | :383 | `Merger` | — | C | `slabs` |
| Pasillo de baldosas + juntas | :419-420 | `Merger` | Paving | C | — |
| Muro del pasillo + 3 apliques | :422-424 | `Merger` | — | C | Apliques sin brillo |
| Casa (cuerpo amarillo, pretil, cuerpo trasero, franja, losa) | :427-432 | `Merger` | Plaster | C | D2, D3 |
| Placas solares con patas | :435-444 | `Merger` | — | A | — |
| Cristaleras iluminadas | :446-451 | Basic 0xffd9a0 | — | B | Aceptables (planas y con tinta) |
| Ventanas de los padres (se encienden) | :122, 453-456 (color en 764, 778, 1060) | Basic animado | — | B | Aceptables; quizá halo de tebeo al encenderse |
| Grava | :458-474 | `toon` | lienzo rep. | C | Dibujo de grava (H4) |
| 3 losas para pisar | :475 | `Merger` | — | A | — |
| Marcos, voladizo | :476-480 | `Merger` | — | A / C | — |
| Pérgola, mesa y pie, 2 sillas (`woodChair`, `entities/models.ts:1198`) | :482-487 | `Merger` | Wood | A | — |
| Sombrilla | :490-491 | `Merger` | — | A | — |
| 2 toallas de rayas | :493-522 | `toon` (Plane 8×20 segmentos) | lienzo (sin repetir) | A | — |
| Muros del jardín, seto | :525-528 | `Merger` | — | C | — |
| 3 macetas con mata | :529-536 | `Merger` + foliage | — | C | Sin recorte de hojas |
| Casas vecinas (cuerpo, tejado, ventanal encendido, muros) | :539-546 | `Merger` | — | C | H11, H12 |
| Piscinas vecinas (borde + agua) | :548-551 | `Merger` (caja azul) | — | C | Agua lisa: dibujo de agua |
| Palmera del vecino | :553-554 | `Merger` | — | C | — |
| ~410 matas de hierba | :556-558; `entities/models.ts:1418` | `Merger` | — | A | = cap. 1 |
| Guirnalda de la pérgola (17) | :562-568 | Points 0,55, aditivos, sin vertexColors | glow | B | No entra en la regla de bombillas (`core/comic.ts:403`) → 40 %; bombillas de tebeo |
| 40 luciérnagas | :569-575, 712-715 | Points 0,25, aditivos | glow | B | El ×0,4 se pierde (la opacidad se reescribe cada fotograma); punto de tebeo |

**Piscina**

| Objeto | Archivo:línea | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|
| Coronación | `world/level4.ts:384-390` | `Merger` | — | C | — |
| Fondo (caja) | `world/level4.ts:396` | `Merger` | — | A | — |
| Fondo con cáusticas | `world/level4.ts:292-322, 398-401, 710` | `toon` con map + emissiveMap | lienzo rep. animado | C | Quietas y apagadas (H3, H4); cáusticas de tebeo |
| Paredes del vaso | `world/level4.ts:402-405` | `Merger` | — | C | Dibujo de azulejo de piscina |
| Escalera (pasamanos, peldaños) | `world/level4.ts:407-412` | `Merger` | — | A | — |
| Agua con ondas (`PoolWater`) | `world/level4.ts:413-414`; `core/poolWater.ts:24-42`; `core/gfx.ts:875-924` | Water de three (ShaderMaterial, alfa 0,66, sin profundidad) | normales en DataTexture | B | Agua de tebeo que conserve la malla de ondas; H8 |
| Pelota de playa | `world/level4.ts:870-876`; `core/physics.ts:393` | `toon` | lienzo | A | — |
| Gotas y salpicaduras | `world/level4.ts:969, 975, 1332` → `entities/fx.ts:184-253` | Sprites (normales) | lienzo spray | B | Gotas de tebeo con contorno |
| Ropa en el borde | `world/level4.ts:248-254` | `Merger` (rbox) | — | A | — |

**Toallas, amor y estrellas**

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Mosaico de censura | `world/level4.ts:579-607, 1418-1420` | Basic con DataTexture, depthTest y depthWrite apagados | B | Las siluetas de los dos se entintan **por encima** (H8). Versión de tebeo (cartela «¡CENSURADO!» o corazones) |
| 10 estrellas de la constelación | `world/level4.ts:610-632, 1516-1522` | Sprite aditivo | B | **Quedan al 40 % para siempre**: el minijuego pierde sus estrellas. Estrella de 5 puntas dibujada |
| Línea del corazón | `world/level4.ts:633-637` | LineBasic aditiva (1 px) | B | Trazo gordo de tinta o rosa |
| Estrellas fugaces | `world/level4.ts:1536-1555` | Sprite aditivo | B | Trazo con estela de tebeo |
| Corazones del final | `world/level4.ts:1529`; `entities/fx.ts:26-32` | Sprites | B | Contorno de tinta |
| «🤫» al hacer ruido | `world/level4.ts:1050`; `entities/fx.ts:133-136` | Sprite (emoji del sistema) | B | Dibujarlo |

**Globales**

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Flecha de objetivo | `world/level4.ts:258-261` | `toon` emisivo | C | = cap. 1 |
| Polvo de los pasos | `core/dust.ts:21-53`; `main.ts:678` | Points ShaderMaterial | B | Nubecillas de tebeo |
| Columna de luz (`beacon`) | `core/beacon.ts:28-33` | Grupo vacío (el pilar y el aro nunca se añaden) | — | Nada |
| Recuerdos escondidos c2-cola, c2-joy, c2-cesped | `core/extras.ts:63-65, 112-135`; `data/extras.ts:188-190` | Basic + halo aditivo | B | Polaroid de tebeo; el halo queda al 40 % |

---

## 2. Capítulo 3 · «La ruta de las zamburiñas» (`Level2`, `world/level2.ts`)

### 2.1 Escenas y fases

| Fase | Escena | Hora | Cielo / niebla / luces | Con `comicScene` |
|---|---|---|---|---|
| intro, drive1 (Madrid → meseta), marcial, cow, tromba | Principal | Día | Cúpula con sol y 14 nubes (:285-291), colores por región (:42-47, 989-992); niebla (:284, 891-895, 993); hemisférica 1,6 (:293); sol 2,3 (:294, 896). HDRI quarry solo sin cómic (`main.ts:421`). Tromba: cielo gris (:49) | Nubes ya de tebeo. Hemisféricas ×0,55 (H1). Tope del sol anulado (H14). Líneas de acción todo el rato (H13) |
| camp | `Camp` (`world/camp.ts`) | **Noche** | Niebla (:47); cúpula con 2200 estrellas (:50); hemisférica 0,6 (:52); luna 0,6 (:53); farolillo (PointLight 9, :119-121) | **Hemisférica de día a 1,35 entera** (H1): se pierde la noche con el farolillo como única luz. Estrellas entintadas. Halo del farolillo al 40 % |
| arriveSV, grill, zambDone | Principal (San Vicente) | Día | Como drive1 | Como drive1 |
| terrace | `Terrace` (`world/terrace.ts`) | Día | Niebla (:78); cúpula con sol y 10 nubes (:79); hemisférica 0,95 (:81); sol 1,45 (:82) | Hemisférica de 1,35 entera: más clara que la escena principal |
| drive2 (Rioja) y llegada a Logroño | Principal + `buildLogronoTown` | Atardecer (cielo 0xf2a77d / 0x5a4a9a) | Niebla que se abre (:971-976) | Perfil "atardecer" (D1) |
| logrono, done | `Laurel` (`world/laurel.ts`) | **Noche** | Niebla (:44); cúpula con 700 estrellas (:45); hemisférica 1,05 (:47); luna 0,35 (:48); 3 PointLights 26 (:188-192) | Hemisférica de día 1,35 entera; guirnaldas al 40 % |

### 2.2 Inventario

**Escena principal: suelo, cielo, agua**

| Objeto | Archivo:línea | Construcción | Material | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|---|
| Cúpula, sol y 14 nubes | :285-292; `core/gfx.ts:541-611` | Basic + Sprites | — | nubes de tebeo | B | = cap. 1 |
| Suelo 400×400 que sigue al coche | :298-319, 962-963, 994-1002 | Plane | `toon` (surf Grass/Sand) | lienzo rep. con offset animado | C | H3, H4; dibujos de hierba seca, hierba verde y tierra roja |
| Carretera 9×400 | :321-339, 964-965 | Plane | `toon` | lienzo rep. (asfalto + líneas) | C | **Las líneas se mueven con el coche** (H3); dibujo de asfalto con marcas |
| Mar Cantábrico | :341-344, 966, 995 | Plane | Water (Shader) | — | B | Agua de tebeo |
| Lluvia de la tromba (420) | :861-889 | LineSegments | LineBasic transparente | — | B | Rayas de lluvia de tebeo |

**Decorado repetido** (`Scatter`, :109-163, 519-541). Todo es InstancedMesh con `mergedMat`: clase **C** (no se dobla, D5; sin dibujo de superficie).

| Objeto | Archivo:línea | Nota |
|---|---|---|
| Bloques de pisos revocados (20) | :428-460, 520 | — |
| Bloques de ladrillo (14) | :461, 521 | Falta dibujo de ladrillo |
| Pino piñonero (18) | :463-469, 523 | — |
| Balas de paja (20) | :483, 524 | — |
| Molinos: torre, cono, aspas (6) | :484-489, 525 | — |
| Toro de Osborne (1) | :510-517, 526 | Negro plano: ya queda de tebeo |
| Colinas (10) | :490, 527 | — |
| Picos de Europa (6) | :505-509, 528, 540 | Sin niebla (se respeta) |
| Robles (22) | :471-477, 529 | — |
| Vacas frisonas en los prados (8) | :530; `entities/cow.ts:53-62` | — |
| Vacas tudancas en los prados (5) | :531 | — |
| Viñedos: caballones, cepas, racimos (24) | :492-503, 532 | — |
| Matas y piedras de cuneta (40) | :479-482, 533 | — |
| Hierba seca / verde / riojana (70 / 90 / 40) | :176-180, 535-537 | — |

**Tráfico y obstáculos** (Mesh + `vertexMat`, geometría compartida por tipo; :544-612, 817)

| Objeto | Archivo:línea | Clase | Qué hacer |
|---|---|---|---|
| Cono de obra | :545 | A | — |
| Turismos, monovolumen, furgoneta (4 tipos, 7 colores) | :547-597, 607-610 | C | **H5** (doblado acumulativo) |
| Tractor | :598-603 | C | H5 |
| Barril | :604 | A | Radio ≈0,8, en el límite de H5 |

**Recogibles**

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Cámara de fotos (cuerpo, banda, visor, flash emisivo, disparador y objetivo metálicos, lente emisiva) | `entities/pickups.ts:22-36`; :826 | `toon` por pieza | C | Emisivos y metal planos |
| Bidón de gasolina | `entities/pickups.ts:39-50`; :836 | `toon` | A | — |
| Cajetilla de tabaco | `entities/pickups.ts:53-65` | `toon` | A | — |
| Halo detrás de cada uno | `entities/pickups.ts:15-19` | Sprite aditivo | B | Parpadeo (H7) |
| Partículas: ✨ 📸 ⚡ 💨 💥 y polvo del turbo | :944, 1038-1066; `entities/fx.ts` | Sprites | B | Dibujos de tebeo con contorno |

**Vehículos, animales y carteles**

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Focus gris de Azul (`makeCarHD`, conduce ella) + suspensión | :200, 957-959 | igual que el coche del cap. 2 | C | H9 |
| Vaca en mitad de la carretera (cuerpo, cabeza, patas, cola) | :1214-1220; `entities/cow.ts:71-118` | `Merger` | A | El cuerpo se dobla una vez |
| Paneles de carretera (A-1, San Vicente, LOGROÑO, 4 restaurantes) | :77-106, 360, 363, 371, 1488 | Basic + lienzo con texto | B | Rótulos de tebeo |
| Trasera y postes de los paneles | :98-104 | `Merger` | A | — |

**Restaurantes ×4** (Asador El Cruce, Bar Los Arcos, Hostal La Parada, Cafetería Marcial; `buildEatery` :1448-1492)

| Objeto | Archivo:línea | Clase | Qué hacer |
|---|---|---|---|
| Muro y fachada (TownHD) | :1452-1456 | A | — |
| Tejado (ROOF_GEO) | :1458 | C | Teja sin dibujo (H11) |
| Chimenea, zócalo | :1459-1461 | C | — |
| Interior iluminado, barra, 12 botellas, carpintería | :1462-1468 | A | De día |
| Puerta, cristal, pomo | :1469-1471 | A | — |
| Toldo de rayas y faldón | :1474-1475 | A | — |
| Terraza: suelo, 3 mesas, 6 sillas | :1477-1483 | A | — |
| Aparcamiento: asfalto y líneas | :1484-1485 | C | Dibujo de asfalto |

**San Vicente de la Barquera** (`buildSanVicente` :614-694)

| Objeto | Archivo:línea | Clase | Qué hacer |
|---|---|---|---|
| Ría | :618 | C | Caja azul lisa: dibujo de agua |
| Puente de la Maza (pilas, arcos, tablero) | :620-624 | C | D3 |
| 7 casas (TownHD) | :626-639 | A | — |
| Tejados de las casas | :637 | C | H11 |
| Castillo del Rey y almenas | :641-642 | C | — |
| Colina y Santa María (nave, torre, chapitel) | :644-647 | C | — |
| Plataforma de losas y bordillo de El Ancla | :651-652 | C | `slabs` |
| Fachada con soportales (TownHD) | :655-657 | A | — |
| 3 soportales: arco, jambas, interior iluminado, barra, estante, botellas | :660-670 | A / C | — |
| Toldo azul y blanco, faldón | :671-672 | A | — |
| 5 mesas, 10 sillas, platos y vasos | :674-690 | A | — |

**Plancha** (fase grill; `buildGrill` :697-717)

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Encimera, plancha, plato, limón, perejil | :700-707 | `Merger` | C | Se dobla: la plancha ondula unos cm bajo las zamburiñas (H10) |
| 6 zamburiñas (concha con colores por vértice, carne, coral, ajo y perejil) | :709-715; `entities/models.ts:1328-1405` | Standard | A | El cambio de color de la carne sigue funcionando sobre el material convertido |

**Llegada a Logroño** (`world/logrono.ts`, dentro de la escena principal)

| Objeto | Archivo:línea | Clase | Qué hacer |
|---|---|---|---|
| Casas (TownHD: muro y fachada) | :79-117 | A | — |
| Tejados, chimeneas, bajantes | :88-93 | C | H11 |
| Suelo de losa del casco viejo | :119 | C | `slabs` |
| Muros de las calles | :120-124 | A | — |
| Concatedral: 2 torres (fuste, pilastras, campanario, tambor, cúpula de pizarra, cruz) y fachada con nave | :29-60, 127-139 | C | D3 |
| Torres de Santiago y San Bartolomé | :142-147 | C | — |
| El Ebro | :150-152 | B | Water: agua de tebeo |
| Muros del muelle, barandilla, chopos, farolas | :153-164 | C | — |
| Paseo y bancos | :166-171 | A / C | — |
| Parque: césped, aceras, plátanos de sombra, setos, bancos | :174-202 | C | Dibujo de hierba |
| Puente de Piedra (extrusión con arcos), tajamares | :206-227 | C | — |
| Tablero de asfalto, aceras, pretil, farolas del puente | :229-235 | C | — |
| Rampas, marcas viales | :237-255 | C | — |
| Campo 1400×1000, sierra al fondo | :258-259 | C | — |

**Camping de noche** (`world/camp.ts`)

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Cúpula y estrellas | :50 | Basic / Points | B | Noche de tebeo; H2 |
| Tierra y claro de grava | :58-59 | `Merger` | C | Dibujo de tierra |
| Matorral (instanciado, color por instancia) | :61-86 | `toon` leafy | C | Instanciado; sin recorte de hojas |
| 8 pinos | :76-79 | `Merger` | C | — |
| Cabaña: troncos, marco, suelo de tablas, tejado, piñones, ventanita encendida, leña | :146-190 | `Merger` | C | La ventana no brilla (H12); el marco doblado puede descuadrarse con la puerta |
| Puerta de la cabaña (animada) | :191-196 | `Merger` | C | H9 |
| Mesa plegable, 2 sillas, cartas, hornillo con olla, base del farolillo | :89-105 | `Merger` | A | H10 |
| Focus aparcado | :109-113 | Physical | C | — |
| Cristal del farolillo | :116-118 | Standard emisivo 2,4 | C | Farol de tebeo |
| Halo del farolillo | :122-125 | Sprite aditivo | B | Queda al 40 % para siempre |
| 6 chispas del hornillo | :127-133 | Sprites aditivos | B | Chispas dibujadas |

**Terraza de El Ancla** (`world/terrace.ts`)

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Suelos: terraza, bordillo, calle | :91-93 | `Merger` | C | — |
| Edificio, interior del bar, estantes con botellas, pilares, dintel | :96-104 | `Merger` | C | — |
| Puerta, carteles, paellas | :106-110 | `Merger` | A | — |
| Mesas interiores | :112 | `Merger` | A | — |
| Balcones de madera con rejas | :114-120 | `Merger` | A | — |
| Aire acondicionado | :121 | `Merger` | A | — |
| Ropa tendida | :123-124 | `Merger` | A | — |
| 2 toldos de rayas | :127-135, 154-160 | `toon` | C | Lienzo rep.: las rayas pierden contraste (H4); dibujo de toldo |
| Faldones «EL ANCLA · TABLAS» y «ARROCERÍA · PICOTEO» | :136-161 | Basic + lienzo con texto | B | Rótulos de tebeo |
| Toldo recogido | :163 | `Merger` | A | — |
| Cervecería y su rótulo | :166-174 | `Merger` + Basic | C / B | — |
| Pared de piedra del vecino | :16-29, 176-179 | `toon` + lienzo rep. | C | Dibujo de piedra |
| 7 mesas, 20 sillas, 2 sombrillas cerradas | :182-213 | `Merger` | A | H10 |
| Cesta del pan | :216-218 | `Merger` | A | — |
| 2 copas de albariño y el vino | :221-236 | Standard transparente (copa sin profundidad) | C | Sin tinta; contorno propio (H8) |
| Plato con 6 zamburiñas | :239-251 | `toon` + Standard | A | H10 |
| Brillo de la zamburiña | :58 | Sprite aditivo | B | La opacidad se reescribe cada fotograma, así que no le afecta el ×0,4 |
| Partículas (creadas, sin uso) | :83 | Sprites | B | — |

**Calle Laurel de noche** (`world/laurel.ts`) y juego de pinchos (`world/sideGames.ts:340-386`)

| Objeto | Archivo:línea | Material | Clase | Qué hacer |
|---|---|---|---|---|
| Suelo de losa (TownHD) | :55 | `slabs` | A | Repetición de 2 m frente a 3,2 m en el cap. 1: losas más pequeñas |
| Canal de agua y bordes de piedra | :57-58 | `Merger` | C | — |
| Fachadas y casas de los extremos (TownHD) | :69-70, 133-139 | std | A | — |
| Tejados, chimeneas, impostas, bajantes | :73-77 | `Merger` | C | H11 |
| Bajos de madera de cada bar: moldura, puerta abierta, barra, botellas, jambas, tira de luz | :82-94 | `Merger` | C | De noche, las luces no brillan (H12) |
| Escaparates: botellas, jamones, parteluces | :97-110 | `Merger` | C | Iluminados sin emisivo |
| Cristal de los escaparates | :111-114 | `toon` transparente 0,13 | C | — |
| Barriles de vino con copas | :116-127 | `Merger` | A | — |
| Barras de los rótulos | :130 | `Merger` | A | — |
| Rótulos de bandera de los bares (por las dos caras) | :145-166 | Basic + lienzo con texto | B | Rótulos de tebeo; de noche brillan solos |
| Bombillas de las guirnaldas (~143) | :169-177 | Sprites aditivos (material compartido) | B | Al 40 %: bombillas de tebeo |
| Cable de las guirnaldas | :170-187 | `Merger` | A | — |
| Vasos de vino en la mano de la gente | :195-207 | `toon` emisivo | C | — |
| Barra de pinchos en la calle, platos, 5 botellas | `world/sideGames.ts:357-366` | `Merger` | A | — |
| 5 pinchos sobre su plato | `world/sideGames.ts:289-337, 367-375` | `Merger` | A | — |

**Globales del cap. 3**: partículas de la escena principal (:350), polvo (`core/dust.ts`, B), recuerdos escondidos c3-pacto, c3-camp y c3-langosta (`data/extras.ts:192-194`, B).

---

## 3. Lo que el cap. 1 tiene y aquí falta

| Falta | Dónde se necesita | Propuesta |
|---|---|---|
| Dibujos a mano: asfalto (con marcas), baldosa, adoquín, grava, hierba seca y verde, tierra roja, arena, piedra seca, piedra de sillería, ladrillo, troncos y tablas, corteza, follaje, azulejo de piscina, agua, persiana, toldo de rayas | Calles, Born, carretera, piscina, viñedos, Logroño, camping, terraza | Ampliar `core/comicTiles.ts` y llevarlos por triplanar al `Merger` (D2); `userData.comic` para las texturas de lienzo |
| Tejados de `Merger` con dibujo de teja | ROOF_GEO en todas partes | Pasar los tejados al Builder, o triplanar (H11) |
| Arquitectura subdividida para el «a mano alzada» | Todo el decorado de `Merger` | D3 |
| Perfiles de luz noche y atardecer | Cap. 2 entero, camping, Laurel, Rioja | D1, y arreglar H1 |
| Cúpula de noche, estrellas, luna y Vía Láctea de tebeo | Cap. 2, camping, Laurel | D1, H2 |
| Brillos de noche: farolas, ventanas encendidas, guirnaldas, faros, luciérnagas, farolillos | Varias | Círculo plano con tinta, como `comicBulbTexture` (D4) |
| Agua de tebeo | Piscina, mar, Ebro, ría | D4, conservando la malla de ondas de la piscina |
| Pintura, cromo y cristal de coche de tebeo | Todos los coches | Brillo dibujado |
| Rótulos y lienzos con texto en fuente de tebeo | Todos los rótulos Basic | Fuente y borde de tinta como los carteles del cap. 1 |
| Partículas, mosaico de censura, lluvia, estrellas del minijuego, recuerdos de tebeo | Varias | D4 |
| Arreglos del sistema | — | Que no se congele el desplazamiento de las texturas (H3); un poco más de contraste en `drawnMap` (H4); no volver a doblar lo ya doblado (H5); convertir los halos al crearlos (H7) |

**Interfaz (en la página, no en 3D):** solo `.bark`, `.dialogue` y `.toast` tienen estilo `.comic-mode`. Faltan:
- el chat del móvil (`.phone-overlay`);
- la barra de ruta y los botones de carril del cap. 3;
- los botones y el panel de los pinchos (`.side-spot`, `.side-panel`);
- el rótulo de cine «GAS»;
- el aviso de recuerdo encontrado;
- el objetivo y los contadores del HUD.
