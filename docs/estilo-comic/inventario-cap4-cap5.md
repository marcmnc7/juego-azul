# Inventario estilo cómic · Capítulos 4 y 5

Generado el 9-nov-2026 leyendo el código (auditoría de solo lectura).

# Auditoría cómic: capítulo 4 (Level3, «Fito bajo las estrellas») y capítulo 5 (LevelMoto, «MotoTrip4life»)

Solo he leído; no he cambiado nada. Mientras trabajaba, alguien estaba editando `main.ts`, así que sus números de línea pueden variar. Ahora mismo: `COMIC_CHAPTERS` 378 (ya acepta `?estilo=comic` para todos los capítulos), `HD_DAY_CHAPTERS` 371, `NIGHT_CHAPTERS` 392, `applyLook` 404, `setHd` 414, `comicScene` 530 (seguido de `applyShadows` en 531) y la repetición cada segundo en 727-731.

**Clases:** **A** se convierte solo y queda bien · **B** no se convierte y necesita versión cómic hecha a mano (la nota dice «vale casi tal cual» cuando ya es plano y la tinta de profundidad le basta) · **C** se convierte pero hay que cuidarlo.

**Hechos generales que afectan a casi todas las filas:**
- Todo lo hecho con `Merger` y con `toon()` es `MeshStandard` con `vertexColors`, así que pasa a toon con colores planos.
- La «foto» de superficie (`surf`, el sombreador de `addGrain`) se pierde siempre, porque lleva `userData.grain` y por tanto `carry=false`.
- `Merger.add` borra los UV (models.ts:64) y las geometrías propias de la pista, la ladera y el asfalto tampoco tienen UV. Sin UV no se puede poner una loseta dibujada.
- `handDrawn` dobla cualquier malla, también las `MeshBasic`, siempre que tenga radio ≥ 0,8 y geometría que no se comparta. Las cajas de `G.box` tienen un solo segmento: se tuercen en vez de combarse.
- Ojo: `userData.noComic` **no protege** a los `Points` ni a los `Sprite`. La rama de brillos va antes de esa comprobación (comic.ts:399-421). Para que no los toque hay que poner antes `material.userData.comicGlow = true`.

---

## 1. Luz por lugar o fase, y qué rompería `comicScene`

### Capítulo 4 (una sola escena; Barajas está en x≈290-302)

| Lugar o fase | Hora | Cielo, niebla, luces y entorno (file:line) | Qué rompe `comicScene` |
|---|---|---|---|
| **Barajas** (fase `airport`) | Día solo en teoría: `mood` es 'day' si x>100 (level3.ts:564-566) | La misma escena de noche: `Sky` nocturno con 900 estrellas (489), niebla 0x1a1340 de 40 a 260 (488), `Hemisphere` 0x9a8cff/0x4a3a50 a 1,5 (491), `Sun` rosa 0xffc0e0 a 1,6 que sigue a la jugadora (494, 2297). Cinco `PointLight` 0xfff6e8 de 22 (814-818). Los lucernarios son `MeshBasic` 0xeaf4ff, un cielo falso (744-751). Sin HDRI (el 4 no es capítulo de día y no tiene `userData.hdri`): `applyEnvironment` saca el entorno del cielo nocturno y multiplica las hemisféricas por 0,55 (gfx.ts:303-317). | El «día» solo existe en el etalonaje de `Post` (`applyLook`, main.ts:404-411, 722-724), y el cómic no usa `Post`. Barajas saldría con la luz de noche (sol rosa, ambiente violeta, niebla violeta), y por el vidrio de la puerta (587-594) se vería el cielo de noche. Se añade la hemisférica de día del cómic (comic.ts:445-449), que luego `applyEnvironment` deja en 1,35×0,55≈0,74 porque corre después (main.ts:531). |
| **Llegada (no hay vuelo)** | — | `board()` hace un fundido directo al estadio (960-985). No hay escena de vuelo. | — |
| **Estadio**: intro, cervezas, cola del WC, grabación | Noche | Lo mismo, más el foco de Fito (`SpotLight` 0xffe6c4 de 300, distancia 40), su relleno (`PointLight` 7) y su contraluz (9) (fito.ts:165-169). El foco de los WC (`PointLight` 0xdfe8ff 22, 1527-1529). Los haces de colores son falsos (1231-1244). | La hemisférica de día aclara la noche. El toon cuantiza los charcos de las `PointLight`/`SpotLight` en discos de borde duro. Sin bloom, pantallas y focos dejan de «brillar». La tinta (comic.ts:536, casi negra) apenas se ve sobre tonos violeta oscuros, y el degradado [90,170,255] deja las sombras de noche muy negras. |
| **Buscar a Azul a oscuras** (fases `seek` y `found`) | Noche, apagado | `setDark` (1862-1867): hemisférica a 0,42, sol a 0,3, focos apagados. El flash es una `PointLight` de 60 o 90 (454, 1920, 1978) más un `Sprite` aditivo (1852). Tres flashes de despiste de 40 (1855-1859, 1938). Mecheros visibles (2222). Destello de pantalla `juice.fx.flashScreen` (1986). | **Se rompe el juego.** `setDark` no toca la hemisférica del cómic (≈0,74), así que ya no está oscuro y el flash no destaca. **Los mecheros desaparecen**: son `Points` aditivos con size≥0,6 sin `vertexColors`, y `comicScene` pone `opacity=0` y `material.visible=false` (comic.ts:412-415). El `Sprite` del flash sigue siendo un halo borroso (el ×0,4 lo pisa el nivel en cada fotograma). `flashScreen` vive en `Post` (post.ts:250) y en cómic no se dibuja. |
| **Ritmo y final** | Noche, en directo | Luces encendidas otra vez; láseres (2214-2221), mecheros, pantallas animadas, fuegos (2292, 2331). | **Los fuegos se rompen.** `comicScene` los toma por guirnalda de bombillas (600 puntos con `vertexColors`, size 1,6; comic.ts:403-411): textura de bombilla, mezcla normal, `alphaTest`, tamaño ×0,32. Como el color se apaga a negro al morir (gfx.ts:813-817) y las partículas muertas no se recolocan, quedan **discos negros con aro de tinta colgados en el cielo**. Los láseres siguen siendo aditivos. |
| Todas las fases | — | Las estrellas son `Points` de 1,8 px con `depthWrite` (gfx.ts:617-627) a 400 m, dentro del `far` de 500 (main.ts:87). | La pasada de tinta encuentra cielo a profundidad 1 alrededor de cada estrella y la entinta entera: **las estrellas salen como puntos oscuros**. A las luces de los barrios (1129-1138) les pasa lo mismo, cada punto con aro negro. El fondo azul que pone el cómic queda tapado por la cúpula, así que no hace daño. |

### Capítulo 5

| Lugar o fase | Hora | Cielo, niebla, luces y entorno (file:line) | Qué rompe `comicScene` |
|---|---|---|---|
| **Mochila** (fase `pack`) | Hora dorada | Es DOM (`packBag`, ui/minis.ts:35) encima de la escena de la carretera. | Nada en 3D; el panel no tiene estilo cómic. |
| **Carretera** (fase `ride`) y llegada al faro (fase `creus`) | Hora dorada | Niebla 0xf2c99a de 70 a 330 (levelMoto.ts:112). `Sky` con degradado, sol (`Sprite` aditivo), 9 nubes y **cielo físico** (114). `Hemisphere` 0xcfe0ff/0x6a5a40 a 1,1 (116). `Sun` 0xffe2b8 a 2,1, bajo (117). En el estilo pintado hay HDRI quarry (main.ts:421); en cómic `url=null`, así que el entorno sale del cielo físico y las hemisféricas ×0,55. Mar `Water` (251). | `Sky` solo esquiva el cielo físico si está en estilo pintado (gfx.ts:556): en cómic sale el `SkyMesh`, que según el capítulo 1 «salía morado» (allí se evitó en ferreries.ts:359). Las nubes sí salen de tebeo solas (gfx.ts:588). La hemisférica de día neutra/azulada del cómic lava la hora dorada. El mar `Water` no se convierte (`ShaderMaterial` fotorrealista). El tope de 2,1 no cambia este sol. **Las líneas de velocidad salen todo el viaje**: la cámara va a 14 m/s y el umbral de `drawComic` es 5-11 m/s (comic.ts:634). |
| **Cala de las ranas** (`StoneSkip`, sideGames.ts:693-740) | Día | Escena aparte: `threeScene` cambia (levelMoto.ts:185-187) y el bucle principal la convierte antes de dibujarla (main.ts:727-731), lo cual está bien. Niebla 0xbcd8ea de 90 a 520, `Sky` degradado con 3 nubes (697), `Hemisphere` 1,3 (699), `Sun` 2,4 (700). Llama a `applyShadows` y `applyEnvironment` en su constructor (739-740). | Sol 2,4 → 2,1. El mar `Water` sin tocar. Como el entorno se calcula **antes** que `comicScene`, la hemisférica del cómic se queda a 1,35 entera (en la carretera es ×0,55): la cala sale con más luz de ambiente que la carretera. |

---

## 2. Inventario completo de objetos

### Capítulo 4 · Barajas (`buildAirport` level3.ts:713-843, `buildGate` 575-710)

| Objeto | file:line | Cómo está hecho | Material o helper | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|---|
| Suelo de la terminal | level3.ts:717-720 | `PlaneGeometry` 14×66 | `toon` 0xe9ecef, `surf` Paving | baldosa solo vía sombreador (se pierde) | C | Queda liso. Hace falta loseta dibujada nueva (baldosa de terminal) puesta como `map` con repetición; el plano sí tiene UV. |
| Cristaleras laterales (paredes opacas), montantes cada 3 m, 2 largueros | 723-728 | `Merger` `G.box` | `vertexMat` | — | C | Una sola división: `handDrawn` solo mueve las esquinas mientras la cubierta sí se comba, y puede abrirse una rendija arriba por la que se cuela el cielo de noche. Subdividir o poner `comicBent`. |
| Lamas de bambú (~160) y vigas | 730-731 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Cubierta ondulada | 734-743 | `PlaneGeometry` de 2×90 divisiones, `DoubleSide` | `toon` 0xc9a468 | — | C | Se comba bien, pero las paredes y los lucernarios no la siguen (ver filas vecinas). |
| Lucernarios (discos de cielo), 18 | 744-751 | `CircleGeometry` r 0,72 | `MeshBasic` 0xeaf4ff, `toneMapped:false`, sin niebla | — | B | Plano blanco, vale casi tal cual. Con r<0,8 no se dobla y queda desalineado de la cubierta y de su aro. |
| Aros de los lucernarios | 745, 752-754 | `TorusGeometry` | `toon` 0xf2f2ee | — | C | Con r 0,81 sí se dobla, y se separa del disco. Doblar los dos o ninguno (`comicBent`). |
| Muro del fondo | 757 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Pilares en Y, del amarillo al rojo (18) | 768-776 | `Merger` `G.cyl` ×3 | `vertexMat` | — | A | — |
| Bancos de espera (10) | 778-785 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Tiendas (3: caja roja, marquesina amarilla, mostrador) | 787-793 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Rótulos DUTY FREE, CAFÉ, PRENSA | 795-812 | `PlaneGeometry` | `MeshBasic` | canvas con texto | B | Vale casi tal cual. Redibujar con borde de tinta y letra de tebeo. |
| Rótulo «Salidas · Departures» | 813 | lo mismo | `MeshBasic` | canvas | B | Lo mismo. |
| Cinco `PointLight` del techo | 814-818 | luces | — | — | C | En toon dan charcos de borde duro; revisar la intensidad. |
| Maletas que ruedan (6) | 820-833 | `Merger.build()` con geometría compartida | `vertexMat` | — | A | Al compartir geometría no se doblan, y está bien. |
| Maletas de los viajeros (4), pegadas al cuerpo | 837 | `Merger` `G.rbox` en `p.body` | `vertexMat` | — | C | Van con la persona pero no se marcan como «persona»: sombra más oscura y tinta de aristas. |
| Dintel y faldón de la cristalera de la puerta 26 | 581-582 | `Merger` | `vertexMat` | — | A | — |
| Montantes, larguero y jambas de la puerta | 584-586 | `Merger` | `vertexMat` | — | A | — |
| Vidrios de la cristalera (2) | 587-594 | `PlaneGeometry` | `toon` transparente 0,2, `depthWrite:false` | — | C | Pasa a toon sin reflejo y sin tinta. Detrás se ve el cielo de noche. |
| Hueco de la puerta / túnel del finger | 596-611 | `PlaneGeometry` | `MeshBasic` | canvas con degradado de perspectiva | B | Redibujar en tonos planos con tinta. |
| Pantalla de embarque «26 · Gran Canaria · EMBARCANDO» | 613-633 | `PlaneGeometry` 4,2×1,05 | `MeshBasic` | canvas con texto | B | Vale casi tal cual; añadir marco de tinta. |
| Marco de la pantalla de embarque | 634 | `Merger` | `vertexMat` | — | A | — |
| Mostradores de embarque (2: cuerpo, encimera, monitor, franja roja) | 636-642 | `Merger` `G.rbox`/`G.box` | `vertexMat` | — | A | — |
| Tornos (2) con luz verde y aletas | 649-653 | `Merger` | `vertexMat` | — | A | Las aletas «de cristal» son opacas. |
| Postes con cinta de la cola (8 postes con base, 6 cintas) | 655-662 | `Merger` `G.cyl`/`G.box` | `vertexMat` | — | A | — |
| Maletas de la gente de la cola (3) | 672 | `Merger` `G.rbox` en el cuerpo | `vertexMat` | — | C | Igual que las de los viajeros. |
| Asientos de embarque (4 filas de 4) | 677-686 | `Merger` | `vertexMat` | — | A | — |
| Pista del aeropuerto y líneas amarillas | 689-690 | `Merger` `G.box` 240×80 | `vertexMat` | — | A | Lisa; opcional loseta de asfalto (no tiene UV). |
| Avión (fuselaje, 2 franjas, 26 ventanillas, puerta, ala, motor y toma, deriva con logo, ruedas) | 691-702 | `Merger` | `vertexMat` | — | A | Low-poly; vale. |
| Finger (túnel, franja, pilar) | 704-706 | `Merger` | `vertexMat` | — | A | — |
| Paquete de tabaco | 526-527 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Aro amarillo del tabaco | 528-530 | `RingGeometry` | `MeshBasic` transparente 0,7 | — | B | Vale casi tal cual; no lleva tinta. |
| Marcador del objetivo (octaedro) | 534-535, 2276-2279 | `OctahedronGeometry` | `MeshBasic` 0xffd23f, sin niebla | — | B | Vale casi tal cual (plano y con tinta). |
| Partícula de maleta «🧳» | 951; fx.ts:100-109 | `Sprite` | `SpriteMaterial` normal | canvas | B | Dibujo sin contorno de tinta. |
| Columna y aro del objetivo (`beacon`) | beacon.ts:28-34 | — | `MeshBasic` | — | — | Siempre oculto («Marc los quitó»). |

### Capítulo 4 · Estadio (`buildWorld` 1042-1298, `buildToilets` 1462-1531, `buildProps` 1309-1346, `buildFlash` 1850-1860)

| Objeto | file:line | Cómo está hecho | Material o helper | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|---|
| Suelo de planchas (césped tapado), 500×500 | 1045-1072 | `PlaneGeometry` | `toon({map})` | canvas con rejilla, `RepeatWrapping` ×40 | C | Pasa por `drawnMap` (el canvas convertido a dibujo, con tinta en la rejilla). Mejor una loseta dibujada nueva de «planchas». |
| Luna | 1075-1077 | `SphereGeometry` r 8 | `MeshBasic` 0xfff6d8, sin niebla | — | B | Vale casi tal cual (plana, con contorno). Se dobla unos 3 m, sin daño. Opcional: luna dibujada. |
| Tartán de la pista | 1095-1109 | `BufferGeometry` propia de 160 tramos, sin UV | `toon` 0xa8433a, `surf` Asphalt | — | C | Queda lisa. Para dibujarla hace falta generar UV o mapear en coordenadas del mundo. |
| Nueve calles blancas | 1110 | tiras | `toon` 0xf4f1ea | — | A | — |
| Franja de césped | 1113 | tira | `toon` 0x35603a, `surf` Grass | — | C | Lisa. |
| Tribuna del anexo (7 gradas, 210 asientos, 4 pilares, visera) | 1114-1119 | `Merger` | `vertexMat` | — | A | — |
| Estadio grande (40 tramos de grada y 40 de visera) | 1121-1126 | `Merger` | `vertexMat` | — | A | Está lejos. |
| Luces de los barrios (700) | 1129-1138 | `Points` size 1,4, mezcla normal, sin niebla | `PointsMaterial` 0xffc070 | — | B | No se convierte, pero escribe profundidad y la tinta rodea cada punto. Cambiar por puntos con textura de bombilla, o `depthWrite:false`. |
| Teide y montes | 1143-1145 | `Merger` `ConeGeometry` de 6 y 7 lados | `vertexMat` | — | A | Se dobla (la cima se mueve unos 2 m); vale. |
| Tarima y telón del escenario | 1148-1149 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Estructura del escenario (4 torres y 2 vigas a 11 m) | 1150-1152, 1157-1158 | `Merger` `G.box` | `vertexMat` | — | C | Una sola división a 11 m: el doblado las tuerce. Aceptable, o `comicBent`. |
| Altavoces (2 cajas con 2 paneles cada una) | 1153-1155 | `Merger` | `vertexMat` | — | A | — |
| Batería (bombo, caja, plato) | 1160-1162 | `Merger` `G.cyl` | `vertexMat` | — | A | — |
| Valla delante del escenario | 1164 | `Merger` | `vertexMat` | — | A | — |
| Valla del recinto (5 tramos con 2 barras y postes) | 1167-1179 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Barra (mostrador, encimera, pared trasera, 8 botellas, laterales) | 1182-1188 | `Merger` | `vertexMat` | — | A | — |
| Palmeras (8: tronco de 6 cilindros y 15 pencas) | 1191-1196; models.ts:1409 | `Merger` `G.cyl` y `G.frond` | `vertexMat` | — | A | — |
| WC portátiles (6: cabina, techo, base) | 1487-1492 | `Merger` | `vertexMat` | — | A | — |
| Interior oscuro de cada WC | 1494-1497 | `PlaneGeometry` 1×2 | `MeshBasic` 0x0c1220 | — | B | Vale casi tal cual. |
| Puertas de los WC (hoja, rejilla, tirador) | 1501-1506 | `Door` con `Merger` | `vertexMat` | — | A | Se dobla con el mismo campo que la cabina, así que cerrada encaja. |
| Cartel WC de la puerta | 1464-1486, 1507-1509 | `PlaneGeometry` 0,5 | `MeshBasic` con map y color 0xcfd6e6 | canvas | B | Vale casi tal cual; trazo de tinta. |
| Indicador libre/ocupado | 1511-1513 | `BoxGeometry` | `MeshBasic` verde o rojo | — | B | Vale casi tal cual. |
| Piloto grande encima de la puerta | 1517-1520 | `SphereGeometry` r 0,12 | `MeshBasic` (el mismo material) | — | B | Sin bloom no brilla. Bombilla de tebeo (`comicBulbTexture`) o halo dibujado. |
| Foco de los baños (poste y cabeza) | 1524-1526 | `Merger` | `vertexMat` | — | A | — |
| `PointLight` de los baños | 1527-1529 | luz | — | — | C | Charco de luz de borde duro. |
| Pantallas del escenario (2), ecualizador «FITO & Fitipaldis» | 1201-1216, 2057-2097 | `PlaneGeometry` 8×4,5, canvas redibujado a 15 fps | `MeshBasic`, sin niebla | canvas con degradados y `shadowBlur` | B | Redibujar el canvas en tebeo: colores planos, letras con contorno, tramas. |
| Postes de las pantallas | 1213-1214 | `Merger` | `vertexMat` | — | A | — |
| Láseres (8) | 1219-1228, 2214-2221 | `BoxGeometry` compartida 0,08×0,08×60 | `MeshBasic` aditivo | — | B | Siguen como haz que brilla. Versión cómic: rayo de color opaco con borde de tinta, o plano con rayo dibujado. |
| Haces de los focos (5 conos) | 1231-1244, 2140-2148 | `ConeGeometry` abierto | `MeshBasic` aditivo con `onBeforeCompile` | — | B | Haz difuso. Versión cómic: cono de color plano semitransparente con rayas y borde. |
| Guitarra Les Paul de Fito (cuerpo extruido, mástil, diapasón, incrustaciones, pala, clavijas, pastillas, puente, cordal, golpeador, potes, cuerdas, correa) | fito.ts:55-100 | mallas sueltas en el hueso Spine | `MeshStandard` | sunburst en canvas (sin repetir) | C | Se convierte, pero no cuenta como «persona»: sombra oscura de decorado y tinta en aristas. El sunburst es un degradado; redibujarlo plano. Las cuerdas de 1,2 mm parpadean. |
| Sombrero de Fito (ala, copa, hendidura, cinta) | fito.ts:103-116 | mallas en el hueso Head | `MeshStandard` | — | C | Igual que la guitarra. |
| Foco de Fito, relleno y contraluz | fito.ts:165-169, 187-191 | `SpotLight` 300, `PointLight` 7 y 9 | — | — | C | En toon, círculo duro sobre el escenario. Puede quedar bien como foco de tebeo; ajustar. |
| Bajo del bajista | 1253 | `Merger` en el cuerpo | `vertexMat` | — | C | Accesorio de persona. |
| Estampado de Fito en la camiseta de Gas | 508; print.ts:55-90 | `PlaneGeometry` curvada en el hueso Spine2 | `MeshStandard` transparente, `depthWrite:false` | canvas | C | Pasa a toon, pero al ser transparente pisa la marca de personaje (alfa 0,5) y la pasada lo trata como decorado. |
| Vaso y móvil de la multitud | crowdRig.ts:101-140 | instanciado y marcado como persona | — | — | A | (Aquí `makeCrowd` va sin comportamientos de beber o mirar el móvil.) |
| Mecheros (~77) | 1286-1297, 2222-2224 | `Points` size 0,7 | aditivo con `glowTexture` | halo | **B (desaparecen)** | `comicScene` los apaga. Poner `comicGlow` antes y hacer una llamita dibujada con aro de tinta. |
| Vasos de plástico por el suelo (34) | 1313-1338 | `CylinderGeometry` compartida | `toon` ×3 | — | A | — |
| Pelota de playa | 1339-1345 | `SphereGeometry` | `toon({map})` | canvas `beachBallTexture` (physics.ts:393) | A | — |
| Bandeja y 3 cervezas (`BeerRun`) | sideGames.ts:516-531 | `Merger(false)` | `vertexMat` | — | A | — |
| Partícula «🍺» al derramar | sideGames.ts:589 | `Sprite` | normal | **emoji del sistema** (no está en `PAINT`) | B | Dibujarla. |
| Flash del móvil de Azul | 1852-1854, 1919-1923, 1976-1981 | `Sprite` | aditivo con `glowTexture` | halo | B | Sigue siendo un halo borroso. Versión cómic: estrella o destello dibujado con tinta. Nota: Azul no tiene móvil modelado, solo levanta el brazo (2199-2203). |
| Luz del flash y 3 de despiste | 454, 1855-1859 | `PointLight` | — | — | C | El toon cuantiza el destello. El juego depende de verlo a oscuras. |
| Destello de pantalla blanca | 1986 → post.ts:250 | `Post` | — | — | B | Se pierde en cómic. Añadir un destello a la pasada de tebeo o hacerlo con un div. |
| Partículas ❤️ (1962, 2293), ✨ y 🎵 (2329), ✨ del tabaco (2241) | fx.ts:25-124 | `Sprite` | normal | canvas | B | Sin contorno de tinta; ✨ es un halo. |
| Fuegos artificiales | 498; gfx.ts:767-821; 2292, 2331 | `Points` 600, size 1,6, `vertexColors` | aditivo con `glowTexture` | halo | **B (roto)** | Se convierten en discos negros que se quedan colgados. Marcar `comicGlow` y hacer un estallido dibujado propio. |
| Cúpula del cielo de noche | gfx.ts:542-550 (vía 489) | `SphereGeometry` | `MeshBasic` `vertexColors` | — | B | No se toca y está bien. |
| Estrellas (900) | gfx.ts:617-627 | `Points` de 1,8 px con `depthWrite` | — | — | **B (roto)** | Salen como puntos oscuros. `depthWrite:false` para que se dibujen como cielo. |
| Sombra de mancha de las personas | models.ts:304-311, 460 | `PlaneGeometry` | `MeshBasic` transparente | — | B | Oculta mientras haya sombras reales. |

**Paneles 2D del capítulo 4.** El estilo cómic en `style.css` solo cubre `.bark`, `.dialogue` y `.toast`; todo lo demás es **B**:
- minijuego de ritmo `Rhythm` (157-379)
- marco de grabación del móvil, con REC y manos emoji (1774-1825)
- urinario `PeeAim` (sideGames.ts:1571)
- cabinas `GlassesHunt` (1867)
- medidor de la bandeja `.tray-meter` (547-551)
- chat del móvil `phoneChat` (ui.ts:1455)

### Capítulo 5 · Carretera de la costa (`buildCoast` levelMoto.ts:191-360)

| Objeto | file:line | Cómo está hecho | Material o helper | Textura | Clase | Qué hacer |
|---|---|---|---|---|---|---|
| Ladera, arcén y acantilado (perfil de 8 puntos por 420 tramos) | 198-245 | `BufferGeometry` con colores por vértice, sin UV | `toon` `vertexColors` `DoubleSide`, `surf` Grass | — | C | Pierde la foto de hierba y queda el degradado de colores (en tebeo vale). Para dibujo de hierba o roca hacen falta UV. |
| Asfalto con línea discontinua | 226-235, 247 | `BufferGeometry` con colores por vértice | `toon`, `surf` Asphalt | — | A | Liso; vale. |
| **Mar** 1400×1400 | 251-253; gfx.ts:875-929 | `makeSea` → `Water` | `ShaderMaterial` con reflejo y olas | normales de olas | **B** | No se convierte: es lo más fotorrealista del capítulo. Hace falta agua de tebeo (plano toon con olas dibujadas o un sombreador de bandas). |
| Quitamiedos (unos 208 postes y bandas) | 264-267 | `Merger` `G.box` | `vertexMat` | — | A | — |
| Bancales de piedra seca | 270-275 | `Merger` `G.box` | `vertexMat` | — | A | Opcional dibujo de piedra seca (no tienen UV). |
| Olivos (tronco retorcido y copa) | 277-283 | `Merger` `G.cyl` y `G.bush` | `vertexMat` y `foliageMat` (con hojas recortadas) | — | C | El recorte de las hojas depende del sombreador de grano y se pierde: la copa queda como una bola lisa. Aceptable en tebeo. |
| Pinos piñoneros | 285-292 | lo mismo | lo mismo | — | C | Igual. |
| Matas de lentisco y brezo | 293-296 | `G.bush` | `foliageMat` | — | C | Igual. |
| Rocas del acantilado (unas 416) | 298-301 | `Merger` `G.crag` | `vertexMat` | — | A | — |
| Rocas en el agua | 303-307 | `Merger` `G.rock` y `G.rock2` | `vertexMat` | — | A | — |
| Casitas de L'Escala (6, caja y tejado plano) | 310-316 | `Merger` `G.box` | `vertexMat` | — | A | Sin dibujo de tejas ni encalado (no tienen UV). |
| Cadaqués (roca, 26 casas con tejado, iglesia, campanario, ventana) | 318-333 | `Merger` | `vertexMat` | — | A | Está lejos. |
| Faro de Cap de Creus (2 promontorios y una roca, edificio, cornisa, 8 contraventanas verdes, torre, cornisa, linterna 0xbfe4f0, cúpula) | 335-350 | `Merger` | `vertexMat` | — | A | La linterna no tiene luz ni cristal; de día vale. Opcional un destello dibujado. |
| Montañas (10) y bosque (60 matas) | 352-358 | `Merger` `G.rock2` y `G.bush` | `vertexMat` y `foliageMat` | — | A y C | Las matas como en los olivos. |
| Cielo físico, cúpula, sol aditivo y 9 nubes | 114; gfx.ts:542-608 | `SkyMesh`, `MeshBasic`, `Sprite` | `ShaderMaterial` y otros | — | B | En cómic sigue saliendo el cielo físico. Hacer como en ferreries.ts:359 (`painted \|\| comic.on`) o que `Sky` ignore `physical` cuando el cómic está encendido. Las nubes ya salen de tebeo. |
| Moto de Gas (HD): depósito, sillín, colín y tapas extruidos, chasis tubular, basculante, estriberas, asidero, pipa, motor y aletas, tapas de cromo, radiador, escape, silencioso, cadena, horquilla y tijas, guardabarros, faro con cúpula ahumada, cuadro y pantalla, manillar, puños, manetas, retrovisores, intermitentes, piloto, portamatrícula, matrícula | 80; models.ts:1273-1278 → vehiclesHD.ts:176-310 | geometrías fundidas por material | `MeshPhysical` (pintura con barniz y metal 0,6), cromo, metales, goma, cuero, luces emisivas, ahumado transparente | — | C | Todo pasa a toon: se pierden el metal, el cromo y el barniz (el cromo queda gris plano) y las luces emisivas quedan blancas puras. Las piezas grandes se doblan en la posición del primer paso y viajan dobladas: poner `userData.comicBent=true` (no `noComic`). Los tubos de 1-2 cm parpadean y la tinta los engorda. |
| Ruedas de la moto (neumático, aro, 5 radios, buje, disco) ×2 | vehiclesHD.ts:313-327 | por material | lo mismo | — | C | Giran. Con r<0,8 no se doblan, bien. El disco de cromo queda plano. |
| Pinzas de freno | vehiclesHD.ts:336-339 | `BoxGeometry` | `MeshStandard` | — | A | — |
| Casco de Gas (cúpula, laterales, mentonera, interior, visera ahumada, pivotes, ribete, franja, tomas) | vehiclesHD.ts:356-359; helmet.ts:42-87 | mallas en el hueso Head | `MeshPhysical` y `MeshStandard`, visera transparente 0,88 | — | C | No cuenta como «persona»: más oscuro que la cara y con tinta por dentro. La visera queda negra plana; pintarle un brillo blanco. |
| Casco de Azul (blanco con franja azul) | 151-154 | lo mismo | lo mismo | — | C | Igual. |
| Motos que vienen de frente (2) con piloto y casco | 598-605 | `makeMotoHD` | lo mismo | — | C | Igual que la de Gas. |
| Coches que vienen de frente (2: carrocería y habitáculo extruidos, techo, pilares, paragolpes, faldones, calandra, cromado, faros y pilotos emisivos, retrovisores, matrículas, ruedas con 5 radios) | 606-615 → vehiclesHD.ts:82-168 | `profile`, `BoxGeometry`, `CylinderGeometry` | `MeshPhysical` y `MeshStandard` | — | C | La carrocería (r≈2,2) se dobla: `comicBent`. El cristal (0,82) en toon deja ver al conductor; está bien. |
| Sombras de mancha de los vehículos | models.ts:1211, 1275 | `PlaneGeometry` | `MeshBasic` | — | B | Ocultas mientras haya sombras reales. |
| Corte de carretera: 4 bloques rojos y blancos con franja, valla de obra (postes, pies, largueros, 40 barrotes), 4 conos con franja, 2 postes | 762-787 | `Merger` | `vertexMat` | — | A | — |
| Señal de prohibido el paso | 795-805 | `PlaneGeometry` | `toon({map})` `DoubleSide` | canvas (sin repetir) | A | Se queda el dibujo, con luz en tres tonos y tinta. |
| Cartel «CARRETERA CORTADA · Accés tancat» | 807-821 | lo mismo | lo mismo | canvas | A | — |
| Flash de la foto en los miradores | 169-171, 412-413, 562-563 | `Sprite` de escala 6 | aditivo con `glowTexture` | halo | B | Halo borroso. Destello dibujado o destello de la pasada. |
| Partícula «📷» (es el mismo dibujo que ✨, un halo) | 415 | `Sprite` | normal | canvas | B | Dibujarla. |
| Polvo de la tramontana | 463; fx.ts:154-164 | `Sprite` | normal | degradado radial | B | Nubecillas con contorno, como «💨». |

### Capítulo 5 · Cala de las ranas (`StoneSkip`, sideGames.ts:693-905)

| Objeto | file:line | Cómo está hecho | Material o helper | Clase | Qué hacer |
|---|---|---|---|---|---|
| Cielo con degradado y 3 nubes | 697 | `Sky` | `MeshBasic` y `Sprite` | B | Vale casi tal cual; las nubes salen de tebeo. |
| Mar 900×900 | 701-703 | `makeSea` → `Water` | `ShaderMaterial` | B | Agua de tebeo. |
| Losa de pizarra donde están | 707 | `Merger` `G.rock2` | `vertexMat` | A | — |
| Rocas del suelo (46) | 708-714 | `G.rock` y `G.crag` | `vertexMat` | A | — |
| Brazos de la cala (34 rocas) y matas | 716-723 | `Merger` | `vertexMat` y `foliageMat` | A y C | Las matas como bolas lisas. |
| Cabo del fondo (18) | 724 | `G.rock2` | `vertexMat` | A | — |
| Piedras de la orilla (16) | 725-728 | `G.crag` | `vertexMat` | A | — |
| Piedra que se lanza | 736-738 | `SphereGeometry` r 0,06 | `MeshStandard` | A | — |
| Anillos de salpicadura | 835-842 | `RingGeometry` | `MeshBasic` transparente | B | Vale casi tal cual; quizá ondas con tinta. |

**Paneles 2D del capítulo 5 (todos B):**
- mochila `packBag` (ui/minis.ts:35)
- flecha del viento `.wind-arrow` (levelMoto.ts:432-434)
- calibres `timingGauge` y contador `.side-count` de la cala
- chats `phoneChat`

**Fuera de este capítulo:** no hay vaca en el capítulo 5. `makeRoadCow` (entities/cow.ts) solo se usa en level2.ts, que es el capítulo 3. Las «fotos» del capítulo 5 son solo el flash, un aviso y partículas: no hay ningún objeto de foto.

---

## 3. Lo que el capítulo 1 no tiene resuelto

| Hace falta | Por qué | Propuesta |
|---|---|---|
| **Noche en cómic** | `comicScene` supone día: fondo azul, hemisférica 0xdff2ff a 1,35, tope del sol. `setDark` no conoce la hemisférica del cómic. La tinta casi negra no se ve de noche y el degradado [90,170,255] deja las sombras negras. | Un parámetro en `comicScene` (`night`, colores e intensidad de la hemisférica) y guardar esa luz para que el nivel la module. Tinta y degradado propios de noche. |
| **Día y noche en la misma escena** (Barajas frente al estadio) | En cómic, `mood` solo cambia el etalonaje de `Post` (main.ts:404-411, 722-724), que no se dibuja. | Un enganche de `mood` que cambie hemisférica, sol, niebla y cielo por zona. |
| **Brillos sin bloom** (pantallas, láseres, haces, pilotos, mecheros, fuegos, flash, estrellas, luces de ciudad, faros) | `comicScene` solo sabe convertir guirnaldas de bombillas o borrar halos. Y `noComic` no protege `Points` ni `Sprite`. | Versiones dibujadas: bombilla con aro (ya existe `comicBulbTexture`), llamita, estallido con tinta, rayos opacos. Usar `comicGlow` para excluir. |
| **Fuegos artificiales de tebeo** | Mal tomados por guirnalda: discos negros que no se apagan. | Un sprite de estallido o líneas radiales propias. |
| **Luces de escenario en toon** (`SpotLight` 300, `PointLight` del flash) | Charcos de luz con borde duro. | Ajustar intensidad y alcance, o simular el foco con emisivo o contraluz. |
| **Pantallas de concierto en cómic** | El canvas usa degradados y `shadowBlur`. | Redibujar con paleta plana, letras con contorno y trama. |
| **Láseres y haces de luz en cómic** | Son `MeshBasic` aditivos con sombreador propio. | Rayo o cono de color plano con borde de tinta o rayas. |
| **Destello de pantalla** (`flashScreen`) | Vive en `Post`; `drawComic` no lo dibuja. | Añadir un uniforme de destello a la pasada de tebeo. |
| **Mar o agua de tebeo** | El capítulo 1 no tiene. El `Water` no se convierte (capítulos 5 y 8). | Plano toon con olas dibujadas, o un sombreador de bandas con espuma entintada. |
| **Cielo físico en cómic** | Solo el capítulo 1 lo evita, a mano (ferreries.ts:359). | Que `Sky` ignore `physical` cuando `comic.on`. |
| **Estrellas y puntos lejanos** | Escriben profundidad, así que la pasada los entinta. | `depthWrite:false` en `Sky`, en las estrellas y en las luces de ciudad. |
| **Losetas dibujadas nuevas** | Hoy solo existen slabs, mares, roof, roofGrey, wash, wood y doors. | Baldosa de terminal, tartán con calles, planchas de rejilla, asfalto, hierba seca y matorral, pizarra o roca de Cap de Creus, piedra seca, olas. **Ojo: casi ninguna malla tiene UV** (`Merger` los borra; la pista, la ladera y el asfalto no los tienen), así que hay que generarlos o mapear en coordenadas del mundo (triplanar) con `onBeforeCompile` en el toon. |
| **Vehículos** | Metal, cromo, cristal y barniz quedan planos. Las piezas en movimiento se doblan una vez en una posición cualquiera. | Brillos pintados (franja blanca en cromo y viseras). `userData.comicBent=true` para que no se doblen pero sí pasen a toon. |
| **Accesorios en personas** (cascos, guitarra, sombrero, estampado, maletas, bajo) | `comicScene` solo marca como persona las `SkinnedMesh` y las instanciadas con `userData.person`. | Respetar `userData.person` también en mallas normales. |
| **Doblado sin cortes** | Las cajas de `Merger` tienen una sola división; el capítulo 1 subdivide en hd/builder.ts:35-74. | Subdividir o `comicBent`: cubierta de Barajas contra paredes, disco del lucernario contra su aro, estructura del escenario. |
| **Partículas** | «🍺» sin dibujo propio (sale el emoji del sistema); ✨, polvo y spray son halos. | Dibujos con contorno de tinta. |
| **Paneles 2D** | `comic-mode` solo cubre `.bark`, `.dialogue` y `.toast`. | Estilo de tebeo para ritmo, grabación, urinario, cabinas, bandeja, mochila, viento, calibres y `phoneChat`. |
| **Luz de ambiente desigual** | En las escenas cuyo entorno se calcula antes que `comicScene` (`StoneSkip`), la hemisférica del cómic no se multiplica por 0,55. | Calcular siempre el entorno antes de añadir la hemisférica del cómic, o fijar su intensidad final. |
| **Líneas de velocidad** | En la moto (14 m/s) salen durante todo el viaje (comic.ts:634). | Decidir si se quieren ahí, o limitarlas a acelerones y adelantamientos. |
