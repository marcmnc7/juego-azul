# Inventario estilo cómic · Capítulos 1 y 9

Generado el 9-nov-2026 leyendo el código (auditoría de solo lectura).

Todas las rutas son relativas a `…/juego-azul/src/`. No he editado nada del código.

## 0. Lo que no funciona como se describe

1. **Las bombillas no pasan a `comicBulbTexture` en el cap. 1: desaparecen.**
   - La conversión a bombilla (`comic.ts:403`) exige cuatro cosas: `map`, `vertexColors`, `size ≥ 0.6` y al menos 100 puntos.
   - Las bombillas de las guirnaldas y los faroles (`lights`, `ferreries.ts:690-693`) no tienen `vertexColors`.
   - Las guirnaldas de colores de los bares (`partyLights`, `ferreries.ts:696-713`) tienen 4 × 15 = 60 puntos.
   - Las dos caen en la rama de los halos (`comic.ts:412-415`), que pone `material.visible = false`. Del adorno solo queda el hilo.
   - `level1.ts:789-798` sigue animando su tamaño y su color, sin efecto.
2. **Los fuegos artificiales son lo único que se convierte en bombilla** (600 puntos, `vertexColors`, tamaño 1.6, `gfx.ts:786`).
   - Pasan a mezcla normal con `alphaTest`, pero su fundido baja el color (`gfx.ts:814`). Al apagarse acaban como discos negros.
3. **El cielo azul plano de `comicScene` (`comic.ts:431`) no se ve.**
   - La cúpula del `Sky` (radio 420, `gfx.ts:541-550`) sigue a la cámara y lo tapa, porque la cámara llega a 500 m (`main.ts:87`).
   - El cielo real del cap. 1 es el degradado «pintado» (`ferreries.ts:359-363`): 0x2a6fd0 / 0x7fbdf2 / 0xf6ead2, más las nubes de tebeo y el halo aditivo del sol.
4. **El orden de las luces cambia la iluminación de referencia.**
   - `applyShadows` llama a `applyEnvironment` después de `comicScene` (`main.ts:530-531`; en las misiones, `main.ts:199-203`).
   - Esto vuelve a poner el HDRI quarry en `scene.environment` (no lo usa ningún material Toon) y multiplica todas las HemisphereLight por 0.35 (`gfx.ts:295-298`).
   - Queda así: la del cómic baja de 1.35 a 0.47, la del pueblo de 1.0 a 0.35 y el sol se limita a 2.1.
   - El aspecto actual del cap. 1 ya incluye esa reducción. En las misiones el camino es `fromScene` y el factor es 0.55 (`gfx.ts:312-315`).
5. **El Ajuntament (`ferreries.ts:641-686`) se queda fuera de la receta HD.** Son cajas `Merger` sin subdividir y de color liso, sin las texturas dibujadas: desentona con las casas vecinas.
6. **El cap. 9 no tiene la guerra de pistolas de agua.** `startWater` solo corre si `!findFirst` (`level1.ts:414`).
7. **El cielo de las misiones de la playa y el parque es el físico** (`SkyMesh`), porque no miran `comic.on` (`beach.ts:51`, `park.ts:58`). Es el mismo cielo que `ferreries.ts:358` evita porque «salía morado». El mar de la playa es el `Water` realista.

## 1. Receta de referencia del cap. 1

| Aspecto | Qué hace | file:line |
|---|---|---|
| Activación | `comic.on` solo en los caps. 1 y 9; `paintStyle = 0`; `hdSurfaces = 1` (todos los capítulos son HD); `hdEnvDefault = null` | `main.ts:378, 369, 413-421` |
| Tono | ACES con exposición 0.95, aplicado dentro de la pasada de tebeo; clase CSS `comic-mode` en la interfaz | `main.ts:426-431`; `comic.ts:478-480`; `style.css:1326+` |
| Cuándo se convierte | Al montar el capítulo; cada segundo o al cambiar de escena; al empezar una misión | `main.ts:530`, `727-731`, `199-203` |
| Pasada de dibujo | `drawComic` sustituye al postproceso. Tinta sacada de la profundidad (silueta y aristas); personajes marcados con alfa 0.5, solo con silueta; color un poco más vivo; papel crema; líneas de acción con `comicBurst` | `main.ts:185-188`; `comic.ts:458-645`; `juice.ts:55-65` |
| Consecuencia de la tinta | Lo que no escribe profundidad (`depthWrite:false`) no lleva contorno: cúpula, nubes, aros, red, vasos de la barra, sombras falsas | `comic.ts:493-536` |
| Paso de materiales a Toon | Rampa de 3 tonos [90,170,255] (personas [188,228,255]). Se descartan el grano y la foto de superficie de `toon()` (`userData.grain`), el `normalMap` y la rugosidad. Se conservan emisivo, transparencia, `side`, `depthWrite`, `polygonOffset`, `vertexColors` y niebla | `comic.ts:246-331`; `gfx.ts:47-77` |
| Texturas dibujadas | `materials.ts` marca las fotos: slabs, mares (también maresDark), roof (roofm), wash (whitewash y plaster), wood, doors. En los caps. 1 y 9 no se usan roofGrey ni plasterCream, y la conversión automática `drawnMap` no llega a ejecutarse | `materials.ts:29-45, 70-93`; `comicTiles.ts:420-443` |
| Geometría | En cómic, `Builder` parte las caras cada ~0.6 m y engorda lo fino (marcos, barrotes, postes); los piñones (`gable`) no se parten. `handDrawn` dobla las mallas grandes, fijas y no compartidas | `builder.ts:15, 38-40, 59-61, 74, 83-89`; `comic.ts:345-390` |
| Constructores | `FerreriesHD` (casas, barra, suelo, iglesia) + `Merger` (Toon con color por vértice; copas de árbol con material de hojas, que en cómic quedan como bloques macizos) + `toon()` + texturas de lienzo de `deco.ts` | `ferreriesHD.ts`; `models.ts:27-42, 45-134`; `deco.ts` |
| Cielo y niebla | `Sky` pintado + `comicCloudTextures` (25 m más altas y al 60 % de tamaño) + halo aditivo del sol; niebla 0xcfe0ee entre 70 y 180 m. El horizonte de la cúpula es crema y la niebla azulada, así que no casan | `ferreries.ts:355-369`; `gfx.ts:579-611`; `comicTiles.ts:356-416` |
| Luces y hora | Las 11:00 (`MORNING_DIR`). Hemisférica 1.0, sol 3.4 limitado a 2.1, hemisférica del cómic 1.35, ambas ×0.35 por el HDRI. Sombras activas | `ferreries.ts:344, 370-373`; `comic.ts:438-450` |
| Brillos | Puntos aditivos: los que cumplen las cuatro condiciones pasan a bombilla; el resto de puntos grandes se ocultan; los pequeños y los sprites aditivos se quedan al 40 %. Lo que cuelga del cielo no se toca | `comic.ts:397-419` |
| Personajes | La VRM de Azul lleva `noComic` (sombreado MToon propio); la ropa de los rigs sale lisa en cómic; la multitud instanciada se marca como persona | `vrm.ts:68`; `rig.ts:551`; `crowdRig.ts:468` |
| Interfaz | Onomatopeyas `comicWord` en golpes y aciertos | `main.ts:178`; `juice.ts:55-61` |

## 2. Inventario de los capítulos 1 y 9

Clases: **A** = la conversión automática basta. **B** = no se convierte (material sin luz, sombreador propio, puntos, sprite) y hace falta una versión cómic a mano. **C** = se convierte pero hay que vigilarlo. «—» = no se ve.

### 2.1 Cielo, atmósfera y luces

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cúpula del cielo | `gfx.ts:541-550` (`ferreries.ts:360`) | Esfera r = 420 | MeshBasic, color por vértice, cara trasera | — | B | Tapa el azul plano: decidir si se quiere el degradado o quitar la cúpula en cómic |
| Nubes | `gfx.ts:586-611` | Sprite | SpriteMaterial | `comicCloudTextures` | A | Ya hechas a mano |
| Halo del sol | `gfx.ts:579-585` | Sprite | aditivo | `glowTexture` | B | `comicScene` lo salta por estar en el cielo: sol de tebeo u ocultarlo |
| Niebla | `ferreries.ts:355` | Fog 0xcfe0ee, 70-180 | — | — | C | No casa con el horizonte crema 0xf6ead2 |
| Hemisférica del pueblo | `ferreries.ts:372` | — | — | — | C | 1.0 × 0.35 |
| Sol con sombras | `ferreries.ts:373`; `gfx.ts:380-408` | DirectionalLight 3.4 | — | — | C | Queda en 2.1 |
| Hemisférica del cómic | `comic.ts:447` | 1.35 | — | — | C | × 0.35 por el orden de llamadas |
| HDRI quarry | `ferreries.ts:370` | PMREM | — | quarry.hdr | C | Inútil con Toon: no ponerlo con `comic.on` (memoria de vídeo) |
| Luz del beso | `level1.ts:1414-1416` | PointLight 2.6 a 0.85 m | — | — | C | Puede quemar las caras al tono alto |

### 2.2 Suelo, casas e iglesia (FerreriesHD / Builder)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Suelo de losas 220 m | `ferreriesHD.ts:177-179` (`ferreries.ts:377`) | `b.box`, 20×20 trozos | `M.slabs` | slabs | A | — |
| Arena de la plaza | `ferreries.ts:546-550` | Círculo de 40 segmentos | `toon` (arena) | — | A | Color liso; podría llevar textura de arena dibujada |
| Muro de las casas (calle y plaza) | `ferreriesHD.ts:45` (`ferreries.ts:394, 405, 423`) | `b.box` partido | `M.whites` ×4 | wash | A | — |
| Zócalo, esquinas de marès, alero | `ferreriesHD.ts:47-49` | `b.box` | `mares` / `maresDark` | mares | A | — |
| Faldones del tejado | `ferreriesHD.ts:58` | `b.box` | `M.roof` | roof | A | — |
| Piñones | `ferreriesHD.ts:59-62`; `builder.ts:83-89` | Triángulo de 3 vértices | `M.whites` | wash | C | Sin partir: no se comba como el tejado; partir el triángulo |
| Marco, puerta (decal ARCH_DOOR) y escalón | `ferreriesHD.ts:72-74` | `box` + decal | `mares` / `doors` | mares / doors | A | — |
| Farol: brazo de hierro | `ferreriesHD.ts:78-79` | `box` | `M.iron` | — | A | Pierde el metal; queda oscuro y liso |
| Farol: linterna | `ferreriesHD.ts:80` | Cilindro de 6 lados | `M.lantern` emisivo 0.6 | — | C | Emisivo; su brillo (`lights`) está oculto |
| Ventana baja con reja | `ferreriesHD.ts:85-87` | `box` + decal BARRED_WIN | `mares` / `doors` | mares / doors | A | — |
| Ventana alta y persiana | `ferreriesHD.ts:90-91`; `materials.ts:96-134` | decal | `shutterMat` | Lienzo sin repetición, lamas con degradado | C | Sombreado casi fotográfico: dibujar una versión tebeo |
| Balcón: losa, 9 barrotes, barandilla | `ferreriesHD.ts:93-96` | `box` (barrotes engordados) | `mares` / `iron` | mares | A | — |
| Macetas, mata y flores del balcón | `ferreriesHD.ts:99-104` | Merger: cilindro + esferas | `vertexMat` / hojas | — | A | Las copas quedan macizas |
| Alféizar y maceta de ventana | `ferreriesHD.ts:106-111` | `box` + Merger | `mares` / `vertexMat` | mares | A | — |
| Chimenea | `ferreriesHD.ts:117-123` | `box` | whites / mares / roof | wash / mares / roof | A | — |
| Bajante de zinc | `ferreriesHD.ts:124` | `cyl` | `M.zinc` | — | A | — |
| Buganvilla | `ferreriesHD.ts:126-132` | Merger: esferas | `vertexMat` | — | A | — |
| Maceta grande | `ferreriesHD.ts:136-142` | Merger | `vertexMat` | — | A | — |
| Iglesia: nave, cornisa, pilastras, portal, escalones, campanario, impostas | `ferreriesHD.ts:184-222` | `b.box` | `mares` / `maresDark` / `roof` | mares / roof | A | — |
| Frontones de la iglesia | `ferreriesHD.ts:190-193` | `gable` | `mares` | mares | C | Sin partir |
| Puerta de la iglesia | `ferreriesHD.ts:201` | decal | `doors` | doors | A | — |
| Rosetón: vidrio, aro y radios | `ferreriesHD.ts:208-210` | Merger + `b.cyl` | `vertexMat` / `maresDark` | — | A | — |
| Huecos y arcos de las campanas | `ferreriesHD.ts:218-220` | Merger | `vertexMat` | — | A | — |
| Campana | `ferreriesHD.ts:221` | Cono de 4 caras | `vertexMat` | — | C | Es una pirámide: más segmentos |
| Chapitel | `ferreriesHD.ts:223-226` | Cono de 4×1 segmentos | `M.roof` | roof | C | Con 1 segmento no se dobla; subdividir |
| Cruz del campanario | `ferreriesHD.ts:227-228` | `box` | `iron` | — | A | — |
| Reloj del campanario | `ferreriesHD.ts:229-232` | Merger | `vertexMat` | — | A | — |

### 2.3 Ajuntament (Merger, sin Builder)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cuerpo, ala, puerta de servicio, tejado, planta alta, imposta, cornisa, frontón, reloj | `ferreries.ts:644-655` | `G.box` / `ROOF_GEO` de 1 segmento | `vertexMat` | — | C | Rehacer con `Builder` y `M.whites` / `M.mares` / `M.roof`, que dan textura dibujada y lo parten para que se doble |
| Soportales: pilares, arcos y puertas del fondo | `ferreries.ts:657-665` | `box` + arco extruido | `vertexMat` | — | C | Igual |
| Ventanas: marco, hueco, persianas en relieve, alféizar, guardapolvo | `ferreries.ts:667-671` | `box` | `vertexMat` | — | C | Persianas de caja lisa en vez de `shutterMat` |
| Balcón corrido, barrotes y barandilla | `ferreries.ts:673-675` | `box` | `vertexMat` | — | C | Barrotes de 0.05 sin engordar |
| Rótulo «AJUNTAMENT DE FERRERIES» | `ferreries.ts:677-680` | Plano | MeshBasic transparente | `letteringTexture` | B | Sin luz |
| Mástiles | `ferreries.ts:683` | Merger | `vertexMat` | — | A | — |
| Banderas de los mástiles | `ferreries.ts:684-685` | `mergedPlanes` | `toon`, dos caras | Lienzo | A | — |

### 2.4 Los 4 bares (`ferreries.ts:510-516` → `bar()` 252-324)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Toldo a rayas y faldón | `ferreries.ts:270-274` | Merger | `vertexMat` | — | A | — |
| Postes del toldo | `ferreries.ts:275` | Merger | `vertexMat` | — | A | — |
| Barra de madera y sobre de marès | `ferreriesHD.ts:150-151` | `b.box` | `wood` / `mares` | wood / mares | A | — |
| Botellas (9) | `ferreriesHD.ts:152-158` | `b.cyl` ×3 | `M.glass`, transparente 0.75 | — | C | Vidrio transparente con tinta |
| Vasos (6) | `ferreriesHD.ts:160-161` | `b.cyl` | `M.cup`, opacidad 0.35 sin profundidad | — | C | Sin tinta y casi invisibles: opacos en cómic |
| Limonada | `ferreriesHD.ts:162` | `b.cyl` | transparente 0.85 | — | C | — |
| Garrafa de gin con asa | `ferreriesHD.ts:165-169` | `cyl` + toro | `M.gin` transparente | — | C | — |
| Etiqueta | `ferreriesHD.ts:170` | `box` | `M.label` | — | A | — |
| Barril | `ferreriesHD.ts:172` | `b.cyl` | `wood` | wood | A | — |
| Altavoz (caja y 2 conos) | `ferreries.ts:295-297` | Merger | `vertexMat` | — | A | — |
| Canto del letrero | `ferreries.ts:317-319` | Caja con 6 materiales | MeshLambert → Toon | — | A | — |
| Cara del letrero con el nombre | `ferreries.ts:300-318` | idem | MeshBasic | Lienzo | B | Sin sombreado: pasar a Toon con la misma textura |
| Patas del letrero | `ferreries.ts:323` | Merger | `vertexMat` | — | A | — |

### 2.5 Mobiliario, vegetación y adornos (Merger del pueblo)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| 7 mesas, cada una con 2 sillas y un vaso | `ferreries.ts:326-337, 520-521` | Merger | `vertexMat` | — | A | — |
| 2 pinos (tronco, 2 copas, alcorque) | `ferreries.ts:525-529` | Merger | `vertexMat` / hojas | — | A | Las copas quedan macizas |
| 3 bancos | `ferreries.ts:532-543` | Merger | `vertexMat` | — | A | — |
| Vallas del final de la calle | `ferreries.ts:495-500` | Merger | `vertexMat` | — | A | — |
| Vallas junto a la iglesia | `ferreries.ts:502-505` | Merger | `vertexMat` | — | A | — |
| Banderines | `ferreries.ts:553-569` | Cono de 3 caras | `vertexMat` | — | A | — |
| Hilo de banderines y bombillas | `ferreries.ts:575-588` | Tubo fusionado | MeshBasic 0x2e2620 | — | B | Ya es oscuro y hace de tinta; se dobla con el resto |

### 2.6 Banderas, pancartas y placas

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Banderas de Menorca en los balcones | `ferreries.ts:598, 603` | `mergedPlanes` de 1 segmento | `toon`, dos caras | `menorcaFlagTexture` | A | — |
| Senyeres | `ferreries.ts:599, 604` | `mergedPlanes` | `toon` | `senyeraTexture` | A | — |
| Pancartas (3, de dos caras) | `ferreries.ts:607-616` | `mergedPlanes` | `toon` | `bannerTexture` | C | `handDrawn` las mueve ~0.2 m a 5-6 m de altura y los cables no se mueven: se pueden despegar |
| Cables de las pancartas | `ferreries.ts:618-625` | `G.box` compartida | MeshBasic | — | B | No se doblan (geometría compartida) |
| Placa «Carrer de Sant Bartomeu» | `ferreries.ts:628-629` | Plano | MeshBasic | `streetSignTexture` | B | Sin luz |
| Placas «Pla de l'Església» (2 y su clon) | `ferreries.ts:630-635` | Plano compartido | MeshBasic | `streetSignTexture` | B/C | No se doblan y la pared de detrás sí: quedan hundidas o flotando |

### 2.7 Luces y brillos

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Bombillas de las guirnaldas y los faroles (`lights`, ~120) | `ferreries.ts:690-693` | Points | aditivo, sin color por vértice | `glowTexture` | B (—) | Ocultas en cómic: añadir color por vértice o usar esferas Toon instanciadas |
| Guirnaldas de los bares (`partyLights`, 60) | `ferreries.ts:696-713`; animadas en `level1.ts:791-798` | Points | aditivo, con color por vértice | `glowTexture` | B (—) | Ocultas (no llegan a 100 puntos): bajar el umbral o hacerlas a mano |
| Fuegos artificiales | `gfx.ts:767-820`; `level1.ts:183, 294, 1077, 1428` | Points, 600 | → bombilla | `comicBulbTexture` | C | Acaban como discos negros: apagarlos con alfa o tamaño, o hacer estrellas de tebeo |
| Purpurina | `gfx.ts:717-764`; `level1.ts:185, 296, 1368` | Points, 130, tamaño 0.09 | aditivo | `glowTexture` | B | Se queda aditiva al 40 % |
| Confeti | `gfx.ts:653-714`; `level1.ts:161, 399-401` | InstancedMesh | MeshBasic | — | — | Nunca se ve |

### 2.8 Objetos del nivel (`level1.ts`)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| 36 vasos de plástico por el suelo (con física) | `level1.ts:714-737` | Cilindro compartido | `toon` transparente 0.55 / 0.7 | — | C | Transparentes |
| 3 pomadas que flotan | `level1.ts:338-362` | Merger.build: vaso, limón, pajita | `toon` color por vértice, emisivo 0x4a3a00 | — | C | Emisivo |
| 3 pomadas en la mano | `level1.ts:367-373` | idem | idem | — | C | — |
| Vaso de Tòfol | `level1.ts:1175-1178` | idem | idem | — | C | — |
| Flecha del objetivo | `level1.ts:390-397` | Cono + cilindro | `toon` emisivo | — | — | Siempre oculta (`level1.ts:1053`) |
| «!» de aviso de los burros | `level1.ts:97-117, 311-316` | Sprite sin prueba de profundidad | SpriteMaterial | Lienzo | B | Ya es de tebeo (disco con aro): vale |
| Aro de la caricia | `level1.ts:306, 317-320` | Anillo | MeshBasic transparente, sin profundidad | — | B | Sin tinta: aro con borde dibujado |
| Delantal de Tòfol | `level1.ts:233-236` | Caja en el hueso de la cadera | MeshStandard | — | A | No se marca como persona: lleva tinta interior |
| Bombín, ala, fabiol y tamborí de la fabiolera | `level1.ts:259-282` | Esfera / cilindro | MeshStandard | — | A | Igual que el delantal |
| Pistolas de los 7 tiradores (cuerpo, empuñadura, depósito, cañón) | `level1.ts:1308-1323` | Caja / cilindro | MeshStandard; depósito transparente 0.6 | — | C | Depósito transparente |
| Chorros de los tiradores | `level1.ts:1356-1359` (`fx.ts:220-234`) | Sprites | normal | `sprayTexture` | B | Gotas difusas |
| Partículas: polvo 612, 🍋 621/627, 💕 691, ✨ 697/990, 🍀 704, 🎵🎶 804, ❤️ 1076, 📍 1123 (solo cap. 9) | `level1.ts:212`; `fx.ts:184-254` | 120 sprites | normal | Lienzo; 💕 sale con el emoji del sistema | B | Sin adaptar (degradados): versión con contorno y 💕 dibujado |

### 2.9 Guerra de agua (solo cap. 1, `sideGames.ts`)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Gotas | `sideGames.ts:28-72` | InstancedMesh de esferas 6×5 | MeshBasic transparente 0.9 | — | B | Gotas de tebeo |
| Pistola de Azul | `sideGames.ts:85-91, 108-110` | Merger | `vertexMat` | — | A | — |
| Pistolas de los 5 críos | `sideGames.ts:116-118` | Merger | `vertexMat` | — | A | — |
| 💦 y ❗ | `sideGames.ts:175, 250, 263` | Sprites | normal | Emoji del sistema | B | Dibujarlos en `PAINT` |

### 2.10 Animales, lo que llevan y lo que lleva la gente

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| 4 burros HD | `models.ts:979-980`; `donkeyHD.ts:194-203` | Malla con morph, compartida | MeshStandard color por vértice | — | A | No se dobla; tinta completa |
| Manta, asiento, arzón, borrén, cincha, correas y estribos | `donkeyHD.ts:207-239` | Primitivas | MeshStandard | — | A | — |
| Sombra falsa de los burros | `models.ts:304-312` | Plano | MeshBasic | Lienzo | — | Oculta con sombras activas |
| Vasos y móviles de la multitud | `crowdRig.ts:454-468` | InstancedMesh marcada como persona | MeshStandard | — | A | Rampa de persona, sin tinta interior |

### 2.11 Lo que el bucle principal mete en la escena

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Polvo de los pies | `dust.ts:20-60` (`main.ts:686`) | Points | ShaderMaterial | `glowTexture` | B | Nubecillas de tebeo |
| Baliza | `beacon.ts:44-46` | Grupo vacío | — | — | — | No se ve |
| Recuerdos (polaroids): cap. 1 `data/extras.ts:184-186`, cap. 9 `216-218` | `extras.ts:63-65, 112-135` | Caja + 2 planos + sprite | MeshBasic; halo aditivo | Lienzo | B | Halo al 40 %; cuerpo sin luz |

### 2.12 Alrededores

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Manzanas de casas (caja, tejado y persianas de caja) | `ferreries.ts:819-822` → `surround.ts:96-147` | Merger, 1 segmento | `vertexMat` | — | C | Sin texturas dibujadas: otro estilo que la primera fila; usar `Builder` o dejarlas a la niebla |
| Lomas (esferas gigantes) | `surround.ts:160-167` | Merger | `vertexMat` | — | A | No hay suelo de campo (`field:false`) |

### 2.13 Código que no se ejecuta en cómic

Con `hdSurfaces = 1` estos caminos no se usan nunca en los caps. 1 y 9:
- `house()` (`ferreries.ts:167-247`) y `groundTexture` (126-160).
- Iglesia sin HD (449-487) y laterales de la plaza sin HD (428-438).
- Barra y botellas sin HD (279-280, 285-293).
- `makeDonkey` y `makeDog` con Merger: solo si falla la carga (`models.ts:981-1035`, `1122+`).

## 3. Misiones del cap. 9

`voley` y `joyTraining` (`minis.ts:660-670`) abren primero un chat en 2D y después una misión 3D (`stage`). `comic.on` sigue encendido durante las misiones, y `comicScene` se aplica en `stage.onStart` y en el bucle.

### 3.1 Playa (`beach.ts`)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cielo físico | `beach.ts:51`; `gfx.ts:559-577` | SkyMesh | ShaderMaterial | — | B | Usar el cielo pintado si `comic.on`, como en `ferreries.ts:359` |
| Nubes | `gfx.ts:588` | Sprite | — | `comicCloudTextures` | A | — |
| Halo del sol | `gfx.ts:579` | Sprite | aditivo | — | B | — |
| Niebla 0xcfe3ee, 40-220 | `beach.ts:50` | — | — | — | C | — |
| Hemisférica 0.8 y sol 1.9 | `beach.ts:53-54` | — | — | — | C | Ambiente × 0.55 en vez de × 0.35 |
| Arena 120×60 | `beach.ts:55-58` | Plano | `toon` (arena) | — | C | Lisa; no hay textura dibujada de arena |
| Mar | `beach.ts:59-61`; `gfx.ts:875-922` | Water de three.js | ShaderMaterial | Normales de olas | B | Mar de tebeo: Toon plano con espuma dibujada |
| Arena mojada | `beach.ts:62-64` | Plano | `toon` | — | A | — |
| Postes, bases, cinta, líneas de la pista, sombrilla, toallas | `beach.ts:66-78` | Merger | `vertexMat` | — | C | Sombrilla en cono de 4 caras (pirámide); nada subdividido |
| Red | `beach.ts:79-101` | Plano | MeshBasic transparente, sin profundidad | Lienzo con repetición | B | Sin tinta |
| Pelota | `beach.ts:110-112` | Esfera 20×14 | `toon` | `beachBallTexture` | A | — |
| Sombra falsa de la pelota | `beach.ts:113-115` | Círculo | MeshBasic al 0.25 | — | B | Duplica la sombra real |

### 3.2 Parque (`park.ts`)

| Objeto | file:line | Construcción | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cielo físico | `park.ts:58` | SkyMesh | ShaderMaterial | — | B | Igual que la playa |
| Niebla 0xd8e8f0, 40-160 | `park.ts:57` | — | — | — | C | — |
| Hemisférica 0.9 y sol 2.0 | `park.ts:60-61` | — | — | — | C | Ambiente × 0.55 |
| Césped 160×80 | `park.ts:62-65` | Plano | `toon` (hierba) | — | C | Liso, sin textura dibujada |
| Pista, postes de las vallas, marcos de los aros | `park.ts:68, 73, 80-81` | Merger | `vertexMat` | — | A | — |
| Barras de las vallas | `park.ts:74-78` | Cilindro r = 0.025 | `toon` | — | A | Finas, sin engordar |
| Aros | `park.ts:82-85` | Toro | `toon` | — | A | — |
| Túneles | `park.ts:87-90` | Medio cilindro abierto, dos caras | `toon` | — | A | — |
| 18 árboles | `park.ts:95-100` | Merger | `vertexMat` / hojas | — | A | Copas macizas |
| Banco y valla del parque | `park.ts:101-104` | Merger | `vertexMat` | — | A | — |
| Joy (animal) | `park.ts:113`; `vehiclesHD.ts:392-412` | Con esqueleto | MeshStandard | Foto en gris | A | Se trata como persona |
| Sombra falsa de Joy | `models.ts:304` | Plano | MeshBasic | — | — | Oculta con sombras |

### 3.3 Diferencias con el cap. 1

1. **Cielo:** físico en vez del degradado pintado; con ACES hay riesgo de que salga morado.
2. **Mar:** `Water` realista con reflejos.
3. **Luz:** ambiente × 0.55 (≈1.18-1.24) frente a × 0.35 (≈0.82) en el cap. 1, y sol 1.9-2.0 frente a 2.1. Las sombras salen más planas.
4. **Suelos:** arena y césped lisos, frente a las losas dibujadas del cap. 1.
5. **Geometría:** nada pasa por `Builder`, así que nada se parte ni se engorda. Sombrilla y conos en pirámide.
6. **Sin tinta:** red y sombra falsa (MeshBasic sin profundidad).
7. **Niebla:** otros colores, sin cuidar que case con el horizonte.
8. **Partículas:** las misiones no tienen. Las del cap. 9 en la plaza (📍, ❤️, 🍋, 🍀, ✨, polvo, chorros) siguen sin adaptar, igual que en el cap. 1.
