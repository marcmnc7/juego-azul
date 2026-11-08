# Inventario estilo cómic · Capítulos 6, 7, 8 y carta final

Generado el 9-nov-2026 leyendo el código (auditoría de solo lectura).

**Leyenda.** **A** = `comicScene` lo convierte y queda bien. **B** = no se convierte (MeshBasic, Sprite, Points, ShaderMaterial) y hace falta una versión de tebeo hecha a mano; pongo «vale tal cual» cuando el aspecto plano ya encaja. **C** = se convierte, pero hay que cuidarlo (instanciado, emisivo, transparente, pocos polígonos, foto sin dibujo a mano, noche).

**Abreviaturas de material.**
- **Merger**: `Merger` + `vertexMat()` (models.ts:27), que es `toon({vertexColors})`. Pasa a toon de color plano. Pierde el atributo `surf` y el grano, igual que en el cap. 1. Las piezas no tienen segmentos, así que `handDrawn` solo dobla sus vértices (una caja larga se queda recta).
- **Merger‑hoja**: `foliageMat()` (models.ts:36). Pierde el recorte de hojas, igual que en el cap. 1.
- **HD‑wash / mares / doors / slabs / iron**: materiales de `TownHD`/`Builder` (townHD.ts, materials.ts). En cómic llevan su dibujo de `comicTiles` y se segmentan.
- **Basic**: `MeshBasicMaterial`.
- **Spr+**: Sprite aditivo. `comicScene` solo multiplica su opacidad por 0,4 (comic.ts:416).
- **Pts+≥0.6**: Points aditivos de tamaño ≥ 0,6 sin vertexColors. `comicScene` los oculta (comic.ts:412‑415).

---

## 0. Problemas que afectan a todos los capítulos

| # | Problema | Dónde | Efecto |
|---|---|---|---|
| 1 | **El orden entre `comicScene` y `applyShadows`.** En la escena del constructor, `comicScene` se ejecuta antes de `applyShadows` → `applyEnvironment` (main.ts:527‑528; stage main.ts:199‑202), así que la HemisphereLight de cómic (1,35) queda escalada ×0,55 (entorno sacado del cielo) o ×0,35/0,4 (HDRI). Las escenas que se montan a mitad de capítulo llaman a `applyShadows` antes (TaxiRide camiFarola.ts:879‑884, casa SJ levelSantJoan.ts:1447, eclipse levelEclipse.ts:617/821/845/919). En esas, la hemi de cómic entra entera, a 1,35. | gfx.ts:295‑315; comic.ts:445‑449 | El ambiente varía de escena a escena y nunca coincide con el del cap. 1 (que es 1,0+1,35 escalado ×0,35 por su HDRI). |
| 2 | **La hemi de cómic es de día** (0xdff2ff/0xb59c84) y no se anima. | comic.ts:447 | Las escenas de noche (taxi, casa de Azul, cena, parking, carta) y el oscurecimiento del eclipse salen claras. |
| 3 | **Los Points de luz** (ventanas encendidas, farolas de Sa Farola, farolas de la calle) se ocultan. | comic.ts:412‑415 | De noche se apagan las luces del decorado. |
| 4 | **Los Fireworks** (600 puntos, vertexColors, tamaño 1,6) caen en la rama de «guirnaldas»: bombilla opaca, mezcla normal, alphaTest. | comic.ts:403‑411; gfx.ts:786 | Los fuegos de la carta se convierten en bolas opacas que, al apagarse, se vuelven negras. |
| 5 | **El cielo físico** (`SkyMesh`, ShaderMaterial) del día del cap. 8 no se toca. El cap. 1 lo evita con `painted = paintStyle || comic.on` (ferreries.ts:357‑359). | levelEclipse.ts:238‑240; gfx.ts:559 | Cielo morado o realista en lugar del degradado plano. |
| 6 | **Efectos que solo existen en el postproceso** (`flashScreen`, DOF de `cinema.focus`, bloom) se pierden con `drawComic`. | main.ts:185‑188; levelEclipse.ts:1145 | No hay destello en la totalidad, ni desenfoque en los diálogos, ni brillo en lo emisivo. |
| 7 | **`handDrawn` deja el doblado fijo en lo que se mueve**: coches, taxi, kayak, ferry, remos, hojas de puertas. Se doblan donde están al convertir y se llevan esa deformación. `userData.noComic` NO sirve, porque también se salta el material. | comic.ts:373‑389 | Deformación pequeña; para evitarla, poner `userData.comicBent = true`. |
| 8 | **`TownHD.wall` siempre tiñe el estuco `wash`**, también en los edificios de piedra (Catedral, campanario, Ajuntament, Bè). | townHD.ts:17‑34 | Salen encalados de color marès en vez de sillería `mares`. |
| 9 | **La carta final no es de cómic**: `startLetter` llama a `setHd(true, 2)` y no a `comicScene`. | main.ts:331‑342 | Haría falta su propio indicador de cómic. |
| 10 | **La fusión de mallas de `Merger`** no segmenta (al contrario que `Builder`). | models.ts:59‑133 | Las barras y vigas largas (soportales, balcón del Casino, cables) no se comban como las paredes HD que tienen detrás. |

---

## 1. Hora, cielo y luces por lugar, y qué rompe `comicScene`

| Cap. / lugar | Hora | Cielo, niebla y luces (file:line) | Qué rompe `comicScene` |
|---|---|---|---|
| 6 · Born, Ses Voltes, Plaça Espanya, Bè | tarde | Fog 0xf3dcc0 60‑190 :196. Sky en degradado sin sol, sin nubes y sin estrellas :198. Hemi 1,6 :200. Sun 0xfff0d8 1,7 :201. PointLights :552 (16), :582‑586 (4×18), :647 (8). Sin HDRI (en cómic `hdEnvDefault` es null) → entorno sacado del Sky (gfx.ts:301). | Ambiente demasiado alto (1,6+1,35)×0,55 frente al cap. 1. Faltan las nubes y el sol del cap. 1. Los halos de farola se atenúan. La niebla es cálida y no como la del cap. 1. |
| 6 · misma plaza de noche (`goNight`) | noche | Sky nocturno con 1400 estrellas :1320. Fog 0x0d1430 26‑165 :1322‑1325. Todas las hemis a 0,42 nocturnas :1326‑1332 (incluida la de cómic, bien). PointLights ×1,2. Sun 0,55 :1336‑1337. | Sale razonable. Los halos ya estaban ×0,4 y las farolas casi no lucen. Sin bloom. |
| 6 · taxi por el Camí de sa Farola | madrugada | camiFarola.ts: Fog 0x090e24 :850. Sky con estrellas :851. Hemi 1,15 :853. Luna 0,7 :854. 2 PointLights que llegan a 95 :841/:1394‑1406. SpotLight 80 :1246. `applyShadows`+`applyEnvironment` en el constructor :879‑884. | La hemi de cómic entra entera (1,35, de día): parece de día. Los halos se atenúan. El polvo del faro queda ×0,4. Los haces aditivos se quedan como están. |
| 6 · casa de Azul (llegada) | madrugada | levelSantJoan.ts: Fog :1409. Sky :1410. Hemi 1,15 :1412. Sun 0,9 :1413. Porche 12 :1417. Faros SpotLight 50 :1436. `applyShadows` :1447. | Igual que el taxi: hemi de día entera. Ventanas y farolas en Points ocultas. Guirnalda ×0,4. |
| 7 · Sa Farola, casa, cocina y mesa | noche 21:05 | levelCena.ts: Fog 0x14183a :116. Sky con 900 estrellas :117. Hemi 1,15 :119. Sun 0xb0c0ff 0,9 :120. Porche 16 :121. Cocina 10 :124. | Hemi de día ×0,55 sumada: la noche se ve de día. Ventanas del alrededor (Points) y farolas de Sa Farola (Points) ocultas. Guirnalda y haz del faro con Spr+. El mar es Water (no cambia). |
| 8 · parking del aeropuerto (misión) | noche | parking.ts: Fog :55. Sky con 700 estrellas :56. Hemi 0,55 :58. Luna 0,35 :59. 5 PointLights 16 :89. Linterna SpotLight 40 :136. | Hemi de día ×0,55 que se come la oscuridad y con ella la gracia de la linterna. Halos ×0,4. Las motos con faros emisivos sin bloom. |
| 8 · kayak (Sa Farola desde el mar) | día | levelEclipse.ts: `newScene` :210‑222 (Fog 0xcfe6f4 110‑420, Hemi 0,75, Sun 2,2 → 2,1). `daySky` :238‑240 (físico y 8 nubes). | El cielo físico no cambia (ver #5). El mar es Water. Ambiente ×0,55 (escena del constructor). |
| 8 · casa de Azul de día, calle de Gas, cocina | día | :285, :333, :361 (Sun 1,8/1,8/1,6; Hemi 0,62 en la cocina :362). homeLight 9 en homeStreet.ts:343. PointLight 3 en la cocina :461. `applyShadows` :617/:821/:845. | Hemi de cómic entera (1,35) más la de la escena: muy plano y quemado. Cielo físico. |
| 8 · rocas, Love Letter y eclipse | atardecer → totalidad | :483‑487: Sky de atardecer con 5 nubes y 600 estrellas. Fog 0xf3b27a. Sun 1,8. HDRI venice_sunset (×0,4 a las hemis existentes). Oscurecimiento animado :1499‑1521 (colores del cielo, hemi 0,75→0,25, sol, entorno, estrellas, corona, diamante, halo). PointLight de relleno 5 :1000. | La hemi de cómic (1,35, se añade después de `applyShadows` :919) no se oscurece: la totalidad sale con luz de día. El destello de la totalidad se pierde. La corona y el diamante siguen siendo brillos aditivos de foto. El halo ×0,4 se sobrescribe en cada fotograma. |
| Carta final | noche | letterScene.ts: Fog :32. Sky con 2600 estrellas :33. Hemi 0,7 :35. DirectionalLight 0,8 :44. Disco de luna :37. Mar :47. main.ts:335 `setHd(true, 2)`. | Ahora no se convierte. Si se convirtiera: hemi de día, fuegos rotos (#4), halos de fotos y de luna ×0,4. |

---

## 2. Inventario

### Capítulo 6 · Sant Joan

#### 6.1 Suelo y arquitectura (Born, Ses Voltes, Catedral, Plaça Nova/Espanya, Bè)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Suelo de losas de marès | levelSantJoan.ts:405 | `Builder.box` | HD‑slabs | slabs_c → `slabs` | A | — |
| Calzada del Born | born.ts:130 | Plane | `toon` (surf Asphalt) | ninguna (se pierde el surf) | C | Color plano: dibujar una loseta de asfalto. |
| Aceras del Born | born.ts:134‑139 | Plane | `toon` (surf Paving) | — | C | Loseta de acera. |
| Bordillos de acera | born.ts:142 | G.box | Merger | — | A | — |
| Marcas viales y pasos de cebra | born.ts:151‑161 | G.box de 1 cm | Merger | — | C | Pueden entintarse o parpadear: subirlas o pintarlas en la loseta. |
| Zócalo de la explanada | born.ts:163 | G.box | Merger | — | A | — |
| Adoquín de la explanada | born.ts:164‑167 | Plane | `toon` (surf Cobble) | — | C | Loseta de adoquín. |
| Manzanas de Ses Voltes | levelSantJoan.ts:423 → townHD.ts:28‑34 | `Builder.box` | HD‑wash teñido + cornisa HD‑mares | wash / mares | A | — |
| Pilares de los soportales | levelSantJoan.ts:426 | G.box (1 segmento) | Merger | — | C | Sin segmentos: no se comban como la pared. Pasarlos a `Builder`. |
| Arcos de los soportales | levelSantJoan.ts:429 | Torus 6×12 | Merger | — | A | — |
| Viga o forjado sobre los arcos (40 m) | levelSantJoan.ts:431 | G.box | Merger | — | C | Caja larga recta junto a paredes combadas: pasarla a `Builder`. |
| Fachadas (zócalo, portales, ventanas con reja, persianas, balcones, alféizares) | levelSantJoan.ts:437,469,474‑481,535‑539 → townHD.ts:40‑72 | `Builder` + decal | HD‑mares/maresDark/doors/iron + `shutterMat` | mares, doors, lienzo de persiana | A | Persianas: lienzo con degradado de lamas (igual que en el cap. 1). |
| Fachadas del Born | born.ts:107‑125 → townHD | ídem | ídem | ídem | A | — |
| Catedral: nave y campanario | levelSantJoan.ts:446,464 | `TownHD.wall` | HD‑wash teñido MARES | wash | C | Es sillería: usar el dibujo `mares` (ver #8). |
| Catedral: contrafuertes, columnas, entablamento, frontón (Extrude), portal, rosetón, remate octogonal, ventanas del campanario | levelSantJoan.ts:448‑466 | G.box, G.cyl, Extrude | Merger | — | A | Columnas de 12 lados: bien. |
| Casas señoriales | levelSantJoan.ts:468‑469 | TownHD | HD | — | A | — |
| Manzanas de la Plaça Espanya y de la calle a Bè | levelSantJoan.ts:472‑481 | TownHD | HD‑wash | — | A | — |
| Bè: tres manzanas y fachadas | levelSantJoan.ts:530‑539 | TownHD | HD | — | A | — |
| Ajuntament: bloque y torre | born.ts:202‑205 | TownHD.wall + G.box | HD‑wash ocre + Merger | — | C | Piedra: dibujo `mares`. La torre es una caja Merger. |
| Ajuntament: portal, arco, imposta, reloj y agujas, ventanas ojivales, galería | born.ts:206‑221 | G.box, Cylinder, Cone | Merger | — | A | — |
| Bar Imperi: bloque | born.ts:226 | TownHD | HD‑wash amarillo | — | A | — |
| Bar Imperi: zócalo, marco, fondo del rótulo, farolillos, toldo | born.ts:227‑251 | G.box, G.cone | Merger | — | A | — |
| Bar Imperi: puerta | born.ts:229‑231 | Plane | Basic | `barDoorTexture` (homeStreet.ts:67) | B | Vale tal cual. Los cristales «encendidos» no brillan. |
| Bar Imperi: rótulo | born.ts:232‑234 | Plane | Basic | `barSignTexture` | B | Vale tal cual. |
| Bar Imperi: persianas | born.ts:236‑243 | Plane | `toon` con mapa | `shutterTexture` (lienzo) | A | — |
| Terraza del Imperi: mesas, sillas, taza | born.ts:252‑265 | G.box, G.cyl | Merger | — | A | — |
| Teatre des Born: columnas, frontón, puertas | born.ts:269‑274 | G.cyl, Cone, G.box | Merger + TownHD | — | A | — |
| Correus: bloque y fachada | born.ts:276‑277 | TownHD | HD | — | A | — |
| Correus: buzón amarillo | born.ts:279 | G.box | Merger | — | A | — |
| Palau Torre‑Saura: logia y frontón | born.ts:286‑292 | TownHD + Merger | — | — | A | — |
| Casino: pilastras, ventanales, persianas, frontones | born.ts:295‑301 | Merger | — | — | A | — |
| **Balcón corrido del Casino** (donde se tiran las avellanas) | born.ts:302‑303 | G.box 15,6 m | Merger | — | C | Largo y sin segmentos. |
| Esquinas y manzanas del este | born.ts:309‑314 | TownHD | — | — | A | — |
| Rótulo en `NutThrow` | sideGames.ts:957‑963 | G.box 0,018 | Merger | — | C | Barrotes finos: engordar como hace `Builder` (`thin`), si no la tinta tiembla. |

#### 6.2 Mobiliario, vegetación, rótulos y luces

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| **Obelisco**: zócalo escalonado, peana, lápidas, remates, cornisa, fuste (Cylinder de 4 lados) y piramidión | born.ts:171‑184 | G.box, Cylinder(4), Cone(4) | Merger | — | A | El fuste se inclina entero (vértices solo arriba y abajo): queda bien. |
| Césped del obelisco | born.ts:180 | G.cyl | Merger | — | A | — |
| Verja del obelisco: 28 barrotes, puntas y 2 aros | born.ts:185‑191 | G.cyl 0,05, Torus 0,04 | Merger | — | C | Finos: engordar. |
| Cuatro farolas de esquina del obelisco | born.ts:192‑195 | G.cyl + G.box crema | Merger | — | C | El farol no es emisivo. De día vale. |
| Farolas fernandinas ×8 | born.ts:325‑329 → models.ts:1179‑1192 | `streetLamp` Merger | Merger | — | A | Cristal crema no emisivo. |
| Halos de las farolas del Born | born.ts:362‑368 | Sprite | Spr+ | `glowTexture` | B | De día: quitarlos. De noche: hace falta un farol encendido de tebeo. |
| Araucaria | born.ts:330 → models.ts:1160‑1176 | Merger + G.bush | Merger / Merger‑hoja | — | A | — |
| Ficus ×3 y alcorques | born.ts:332‑337 | G.cyl + G.bush | Merger / Merger‑hoja | — | A | — |
| Bancos de piedra | born.ts:339‑343 | G.box | Merger | — | A | — |
| Árboles de la Plaça Espanya ×6 | levelSantJoan.ts:482‑486 | G.cyl + G.sphere 0x2f6b3a | Merger / Merger‑hoja | — | A | — |
| Bancos de madera y hierro ×4 | levelSantJoan.ts:487‑497 | G.box | Merger | — | A | — |
| Barra del rótulo de Ses Voltes | levelSantJoan.ts:499‑500 | G.box 0,07 / 0,03 | Merger | — | C | Fina: engordar. |
| Escaparates ×~28 (hueco, fondo «iluminado», marco, zócalo, puerta, cristal, pomo, estantes) | levelSantJoan.ts:295‑313 | G.box, G.sphere | Merger | — | A | El fondo iluminado es solo un color, no emisivo: de día vale. |
| Género: avarcas, sobrasadas, quesos, ropa en perchas, joyas | levelSantJoan.ts:314‑338 | G.rbox, G.capsule, G.cyl, G.sphere | Merger | — | A | Piezas muy pequeñas: posible ruido de tinta a distancia. |
| Rótulos de las tiendas | levelSantJoan.ts:503‑517 (`mergedPlanes` deco.ts:149) | Planes | Basic | lienzo | B | Vale tal cual. |
| Rótulos de calle (`sign()`): Ses Voltes, Carrer Major des Born, Catedral, Plaça Nova, Plaça Espanya, Maramao, Sa Plaça d'es Bè ×2 | levelSantJoan.ts:365‑388, 521‑526, 550‑551 | Plane | Basic | lienzo con Georgia | B | Vale tal cual (opcional: letra de tebeo). |
| Rótulos del Born: AJUNTAMENT, Teatre, CORREUS, Palau, Casino, Plaça des Born | born.ts:59‑82, 222,275,278,293,304,315 | Plane | Basic | lienzo | B | Vale tal cual. |
| **Farolas de Ses Voltes ×4**: solo el halo, sin farola | levelSantJoan.ts:575‑581 | Sprite | Spr+ | `glow` | B | Puntos flotando sin poste: modelar un farol de pared o quitarlos. |
| PointLights de la calle ×4, de la plaza y de la estatua | levelSantJoan.ts:552, 582‑586, 647 | luces | — | — | C | Con la rampa de 3 tonos quedan charcos duros: revisar intensidades. |
| Banderines del Born y de Ses Voltes | levelSantJoan.ts:558‑572 | ConeGeometry de 3 lados, escala z 0,15 | Merger | — | C | No hay cordel (flotan en fila): añadir la cuerda con una línea de tinta. |
| Banderines de Bè | levelSantJoan.ts:541‑547 | ídem | Merger | — | C | ídem. |
| **Estatua del Bè**: columna, desconchones, zócalo y placa | levelSantJoan.ts:596‑607 | Merger con textura | Merger | — | A | — |
| Cordero de bronce (70 vellones), cuernos, asta y bandera | levelSantJoan.ts:609‑644 | Merger(false) | Merger | — | C | Pierde el brillo metálico: bronce plano. Opcional: un toque de luz pintado. |

#### 6.3 Fiesta, caballos y juego

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Caballo (malla glTF con morph targets, compartida) ×9 | levelSantJoan.ts:693‑714 → donkeyHD.ts:194‑203 | Mesh con morphs | MeshStandard vertexColors | — | A | No se dobla (geometría compartida). Bien. |
| Arreos: manta | donkeyHD.ts:211‑213 | Cylinder abierto | MeshStandard DoubleSide | — | A | — |
| Arreos: asiento, arzón y borrén | donkeyHD.ts:214‑223 | Sphere | MeshStandard | — | A | — |
| Arreos: cincha y latiguillos | donkeyHD.ts:226‑231 | Cylinder, Box | MeshStandard | — | A | — |
| Arreos: estribos | donkeyHD.ts:233‑236 | Torus | MeshStandard metal 0,8 | — | A | Se pierde el metal: queda gris plano. |
| Caixer | donkeyHD.ts:244‑261 | rig | Skinned → persona | — | — | Excluido (persona). |
| Bombín negro del caixer (copa y ala) | donkeyHD.ts:262‑273 | Sphere, Cylinder sobre el hueso | MeshStandard | — | A | — |
| Sombra difusa del caballo | models.ts:304 | Plane | Basic transparente | degradado | B | Se oculta si hay sombras. |
| Aviso «!» del caballo | levelSantJoan.ts:696,707 (tex :108‑125) | Sprite | SpriteMaterial normal, sin depthTest | lienzo | B | Vale tal cual (ya es de tebeo). |
| Pin de ubicación: esfera y cono | levelSantJoan.ts:229‑231 | Sphere, Cone | `toon` emisivo | — | C | Emisivo plano sin bloom: bien. |
| Pin: punto blanco | levelSantJoan.ts:232 | Sphere | Basic | — | B | Vale tal cual. |
| Pin: halo | levelSantJoan.ts:235 | Sprite | Spr+ | `glow` | B | Cambiar por un aro de tinta. |
| Bolsitas de avellanas ×8 | levelSantJoan.ts:717‑725 | Merger compartido | `vertexMat` | — | A | — |
| Fuegos artificiales | levelSantJoan.ts:140, 213 (gfx.ts:767‑788) | Points | PointsMaterial aditivo | `glow` | B | Nunca se lanzan: quitarlos, o se convierten en bombillas (#4). |
| Partículas (🌰 👋 ✨ polvo) | levelSantJoan.ts:212 → fx.ts:184‑200 | Pool de Sprites | SpriteMaterial normal | emoji del sistema o lienzo | B | 🌰 y 👋 salen del emoji del sistema: dibujarlos. El polvo es un degradado (fx.ts:154): nube de tebeo. |
| Estampado de caballo en las camisetas | levelSantJoan.ts:217,224 → print.ts:71‑89 | Plane curvo en el hueso Spine2 | MeshStandard transparente | lienzo | C | Transparente, sin tinta: bien. |
| Barandilla del balcón (`NutThrow`) | sideGames.ts:957‑963 | G.box | Merger | — | C | Engordar los barrotes. |
| Dianas sobre los del balcón | sideGames.ts:970‑974 (tex :916‑930) | Sprite | SpriteMaterial normal | lienzo | B | Añadir aro de tinta. |
| Avellana lanzada | sideGames.ts:948‑949, 994 | Sphere(8,6) | MeshStandard | — | A | — |
| Anillo de caída | sideGames.ts:1104 | Ring | Basic transparente | — | B | Vale tal cual (si acaso, borde de tinta). |
| Minimapa | levelSantJoan.ts:241‑245 | lienzo del DOM | — | — | — | 2D, no le afecta. |

#### 6.4 Alrededores de Ciutadella

`buildSurroundings` se llama en levelSantJoan.ts:207 con `town` y sin campo; el código está en surround.ts.

| Objeto | file:line | Material | Cl. | Qué hacer |
|---|---|---|---|---|
| Manzanas de casas (G.box) con tejados `ROOF_GEO` | surround.ts:113‑125 | Merger | C | Cajas de 1 segmento de hasta 13 m: se doblan poco. Valen de fondo. |
| Ventanas y persianas | surround.ts:128‑143 | Merger | A | — |
| Lomas | surround.ts:160‑167 | G.sphere grande | Merger | A | — |

#### 6.5 Taxi y Camí de sa Farola

La escena es `TaxiRide`, en camiFarola.ts.

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Carretera (asfalto, arcén, línea, grietas) | :887‑896 (tex :67‑213) | Plane | MeshStandard map+bumpMap | lienzo 2048×6144 repetido | C | `drawnMap` lo reduce a 512² y la línea discontinua y las grietas desaparecen. Hace falta una loseta de asfalto dibujada. |
| Suelo del pinar | :897‑900 (tex :216‑241) | Plane | MeshStandard | lienzo repetido | C | `drawnMap` automático: aceptable. Mejor una loseta de pinaza. |
| Fundidos de los extremos | :901‑913 | Plane | Basic transparente | degradado | B | Vale tal cual. |
| Muro de piedra seca | :918‑943 (tex :244‑310) | Plane desplazado (seg 323×4) | MeshStandard map+bump | lienzo repetido | C | Se pierde el relieve; `drawnMap` aceptable. Hace falta una loseta de piedra seca. |
| Piedras del remate y del pie del muro | :944‑948 | G.rock, G.crag | Merger | — | A | — |
| Matas detrás del muro | :950 | G.bush | Merger‑hoja | — | A | — |
| Arcén: matorral, matas, piñas, piedras, leña | :955‑974 | G.bush, G.tuft, G.ball, G.crag, G.cyl | Merger | — | A | — |
| Cancelas: pilares, bolas, barreras de acebuche o verjas, azulejo, buzón | :977‑1008 | G.box, G.ball, G.rbox | Merger | — | C | Verjas de 0,022: engordar. |
| Faroles de las cancelas | :1006 | G.box | Basic (`glow` Merger) | — | B | Vale tal cual. |
| Villas: volúmenes, tejados, persianas, porche, ciprés | :1014‑1046 | G.box, G.cyl, G.ball | Merger | — | A | — |
| Villas: ventanas encendidas y luz del porche | :1032, 1042 | G.box, G.ball | Basic vertexColors (:867) | — | B | Vale tal cual: brillo plano. |
| Postes, crucetas, aisladores y cables | :1053‑1069 | Cylinder, G.box 0,02 | Merger | — | C | Cables de 2 cm: tinta irregular. Engordar o pintarlos como línea. |
| Transformador | :1071‑1073 | G.rbox, G.box | Merger | — | A | — |
| Contenedores | :1075‑1080 | G.rbox, G.cyl | Merger | — | A | — |
| Señales (velocidad, peligro) | :1082‑1098 | Cylinder | Merger | — | A | Son discos sin número: opcional dibujar el cartel. |
| Camino de tierra del cruce y espejo | :1100‑1103 | G.box, Cylinder | Merger | — | A | — |
| Coches aparcados ×32 (5 modelos) | :1107‑1143 (modelos :569‑721, mats :729‑735) | InstancedMesh | MeshPhysical / MeshStandard vertexColors | — | C | Instanciados: se pierden el clearcoat y la metalización y no se doblan. Faros y pilotos no emisivos. |
| Farolas de hormigón: postes, brazos y luminarias | :1150‑1159 | Cylinder, G.box, G.rbox | Merger | — | A | — |
| Farolas: bombilla | :1160, 1166 | Box | Basic sin toneMapping | — | B | Vale tal cual. |
| Farolas: halo | :1161, 1170 | Sprite | Spr+ | `glow` | B | Haz o estrella de tebeo. |
| Farolas: charco de luz | :1162, 1174 | Plane | Basic aditivo | `glow` | B | Mancha de luz plana con borde duro. |
| Halos de los faroles de las cancelas | :1181‑1187 | Sprite | Spr+ | `glow` | B | ídem. |
| Pinos: troncos | :1191‑1222 (geo :366‑461) | InstancedMesh (tubos) | MeshStandard map+bump | lienzo de corteza repetido | C | Instanciado; `drawnMap` en la corteza. |
| Pinos: copas | ídem | InstancedMesh, 170 láminas | MeshStandard map vertexColors alphaTest | lienzo de agujas | C | Las láminas recortadas llenan la copa de tinta: copa de tebeo maciza o con menos láminas. |
| Placa «Camí de sa Farola» | :1226‑1232 | Plane | Basic | `streetSignTexture` | B | Vale tal cual. |
| Poste de la placa | :1232 | Merger | Merger | — | A | — |
| **Taxi**: carrocería, cristal y molduras | :738‑753 | `loft` + Merger | MeshPhysical (pintura clonada) / MeshStandard | — | C | Doblado fijo al moverse (#7). |
| Taxi: ruedas | :755‑774 | Merger | `M.trim` | — | A | — |
| Taxi: cajetín «TAXI» | :785‑796 | Box | Basic sin toneMapping | lienzo | B | Vale tal cual. |
| Taxi: luz verde | :797‑799 | Sphere | Basic | — | B | Vale tal cual. |
| Taxi: rótulo de las puertas | :801‑817 | Plane | Basic transparente | lienzo | B | Vale tal cual. |
| Taxi: pilotos | :819‑825 | Sprite | Spr+ | `glow` | B | Brillo rojo de tebeo. |
| Taxi: taxista y Azul sentados | :778‑784 | rig | persona | — | — | Excluido. |
| Taxi: haz de los faros | :1250‑1277 | Plane ×2 | Basic aditivo | lienzo | B | Haz volumétrico de foto: rehacerlo como cuña plana. |
| Taxi: brillos de los faros | :1278‑1284 | Sprite | Spr+ | — | B | ídem. |
| Taxi: SpotLight | :1246 | luz | — | — | C | Con la rampa de 3 tonos la elipse queda dura: revisar. |
| Polillas | :1288‑1297 | Points | PointsMaterial normal | — | B | Vale tal cual. |
| Polvo en el haz | :1300‑1311 | Points | aditivo, tamaño 0,028 | — | B | Queda ×0,4: casi invisible. |
| Coches de frente: carrocería | :1332‑1363 | modelos | MeshPhysical clonado | — | C | — |
| Coches de frente: faros, pilotos y haz | ídem | Sprite y Plane | Spr+ ×2, Basic aditivo | `glow` | B | ídem que el taxi. |

#### 6.6 Casa de Azul de madrugada

Es la misma `buildAzulHouse(night)` de 7.1 (levelSantJoan.ts:1415). Las diferencias:

| Objeto | file:line | Material | Cl. | Qué hacer |
|---|---|---|---|---|
| Luz del porche | levelSantJoan.ts:1417 | PointLight | C | — |
| Taxi | levelSantJoan.ts:1431‑1435 | ver 6.5 | C | — |
| Faros del taxi (SpotLight) | levelSantJoan.ts:1436‑1439 | luz | C | — |
| Marcador de la puerta | levelSantJoan.ts:1440 | Octahedron, Basic amarillo | B | Rombo con tinta (opcional). |

---

### Capítulo 7 · Cena a escondidas (y la casa que usan también los caps. 6 y 8)

#### 7.1 Casa de los padres de Azul (`buildAzulHouse`, levelCena.ts:944‑1269)

| Objeto | file:line | Cómo se construye | Material | Cl. | Qué hacer |
|---|---|---|---|---|---|
| Losas del patio | :954 | G.box 10×10 | Merger | C | Color plano: loseta de barro o piedra clara. |
| Calle de hormigón (156 m) | :955 | G.box | Merger | C | Loseta de hormigón. Caja enorme sin segmentos. |
| Tierra y jardines (140×52) | :956 | G.box | Merger | C | Plano. |
| Casa: planta baja, forjado, primer piso, cuerpo saliente | :958‑963 | G.box | Merger | C | Paredes de 1 segmento: no se comban como en el cap. 1. Pasar a `Builder`/`TownHD`. |
| Ventanales con persianas beis y lamas | :965‑969 | G.box | Merger | A | — |
| Barandilla del primer piso | :970‑972 | G.box 0,03 | Merger | C | Fina: engordar. |
| Ventana pequeña y persianas verdes | :974‑975 | G.box | Merger | A | — |
| Azotea: pretil, barandilla tubular, antena, chimenea | :977‑983 | G.box | Merger | C | Barandilla y antena de 0,04–0,05: finas. |
| Porticones de lamas | :986‑989 | G.box | Merger | A | — |
| Dintel y placa de la cruz de Malta | :990‑991 | G.box | Merger | A | — |
| Escalera exterior: peldaños y obra | :993‑998 | G.box | Merger | A | — |
| Toldo verde y armazón | :1001‑1006 | G.box | Merger | A | — |
| Luz por la puerta y ventanas encendidas | :1007‑1011 | G.box | Basic vertexColors | B | Vale de noche. **De día (cap. 8) las ventanas siguen encendidas (:1010):** corregirlo. |
| Pérgola de hierro | :1013‑1018 | G.box | Merger | A | — |
| Buganvilla (190 matas pequeñas más las de los postes) | :1019‑1031 | G.bush | Merger‑hoja | C | Muchas piezas pequeñas: tinta ruidosa. Agrupar en masas grandes. |
| Limonero con limones | :1033‑1039 | G.cyl, G.bush, G.sphere | Merger / Merger‑hoja | A | — |
| Arbusto junto al muro, contenedor y sus ruedas | :1040‑1044 | G.bush, G.rbox, G.cyl | Merger | A | — |
| Escúter blanco: ruedas, plataforma, escudo, guardabarros, trasera, piloto, asiento, manillar, faro, retrovisores, baúl | :1046‑1064 | Merger | Merger | C | Retrovisores de 0,012: finos. El faro no es emisivo. |
| Maceta de barro con mata | :1066‑1067 | G.cyl, G.bush | Merger | A | — |
| Muro bajo encalado, pilares gordos, placa del nombre, tirador | :1070‑1079 | G.box | Merger | A | — |
| Cancela de acebuche (hoja de `Door`) | :1082‑1091 (door.ts) | Merger en la hoja | Merger | C | Se mueve: doblado fijo (#7). |
| Puerta de casa: marco | :1093‑1098 | Merger | Merger | A | — |
| Puerta de casa: cristal | :1099‑1101 | Box | MeshStandard transparente 0,45 | C | Transparente: sin tinta. |
| Adelfas | :1104 | G.bush | Merger‑hoja | A | — |
| Muros laterales | :1105‑1108 | G.box | Merger | A | — |
| Cocina de fuera: encimera, fogón, bombona de butano, estante y botes | :1110‑1117 | G.box, G.cyl | Merger | A | — |
| Sartén y olla (grupo móvil) | :1119‑1126 | Merger | Merger | A | — |
| Vapor ×4 | :1127‑1134 | Sprite | SpriteMaterial normal, opacidad 0,25 | B | Nubecitas de vapor de tebeo. |
| Mesa con mantel, pie, 2 sillas y 2 platos | :1136‑1149 | G.cyl, G.box | Merger | A | — |
| Postes de la guirnalda | :1150 | G.cyl | Merger | A | — |
| **Guirnalda de bombillas ×17** | :1151‑1158 | Sprite | Spr+ | B | `comicScene` solo convierte guirnaldas de Points, no de Sprites. Rehacerla como Points para que use `comicBulbTexture` (y de noche que se vean encendidas). |
| Casa vecina: volumen, tejado, chimenea, ventanas, muro | :1161‑1170 | G.box, `ROOF_GEO` | Merger | A | — |
| Muro de piedra seca y casa de la derecha | :1172‑1175 | G.box | Merger | A | — |
| Pinos ×3 | :1176‑1183 | G.cyl, G.bush | Merger / Merger‑hoja | A | — |
| Araucaria | :1185 | Merger | Merger | A | — |
| Muros de piedra seca hasta el faro, con pilares | :1187‑1197 | G.box | Merger | A | — |
| Callejones | :1199‑1202 | G.box | Merger | A | — |
| Cancela de hierro de la bajada al mar | :1204‑1205 | G.box 0,05 | Merger | C | Fina. |
| Postes de madera y cables | :1207‑1213 | G.cyl, G.box 0,03 | Merger | C | Cables finos. |
| Farolas: postes | :1214‑1221 | G.cyl | Merger | A | — |
| Farolas: halo | :1217 | Sprite (material de la guirnalda) | Spr+ | B | Farol encendido de tebeo. |
| Luz del faro | :1246‑1250 | Sprite | Spr+ | B | Solo de noche: estrella o destello de tebeo. |
| **Haz del faro** | :1252‑1267 | Cone abierto | Basic aditivo con degradado | B | Cuña plana con borde, solo de noche. |

#### 7.2 Valle y cala delante de casa (`buildValley`, levelCena.ts:810‑938)

| Objeto | file:line | Cómo se construye | Material | Cl. | Qué hacer |
|---|---|---|---|---|---|
| Terreno (Plane 150×140 desplazado) | :826‑859 | Plane | `toon` vertexColors (surf por triángulo) | C | Se pierde el surf: monte, roca y arena de color plano. Opcional: losetas. |
| Agua de la cala y mar abierto | :862‑873 | Plane | `toon` transparente 0,93 y emisivo | C | Se convierte a plano: hace falta un mar de tebeo (bandas y espuma). |
| Muro de marès de la calle (274 m) | :877 | G.box | Merger | C | Caja larga sin segmentos. |
| Rocas de la punta y del mar de fuera | :879‑883 | G.rock, G.rock2 | Merger | C | Pocos polígonos: facetas duras en toon. Hace falta una roca dibujada. |
| Pinos y matas de la ladera | :885‑896 | G.cyl, G.bush | Merger / Merger‑hoja | A | — |
| Rocas de la orilla | :898‑903 | G.rock | Merger | C | ídem. |
| Barcas fondeadas | :905‑908 | G.capsule, G.box | Merger | A | — |
| Casas de la otra orilla y sus ventanas | :913‑926 | G.box, `ROOF_GEO` | Merger | C | Ventanas 0xffd9a0 por color, no emisivas: de noche, con la hemi de día, no destacan. |
| Sombrillas | :931‑937 | G.cyl, G.cone | Merger | A | — |

#### 7.3 Sa Farola (`buildSaFarola`, saFarola.ts:84‑270; también en el cap. 8, de día)

| Objeto | file:line | Material | Cl. | Qué hacer |
|---|---|---|---|---|
| Asfalto de la bajada y del Camí | :92‑93 | Merger (G.box) | C | Asfalto plano: loseta. |
| Línea discontinua | :94 | Merger | C | 1 cm: tinta irregular. |
| Arcén | :95 | Merger | A | — |
| Pretil de marès (74 m) | :97‑98 | Merger | C | Caja larga. |
| Matorral y señales | :101‑106 | Merger | A | — |
| Muros de piedra seca con pilares, cancelas y adelfas | :109‑115 | Merger | A | — |
| Palmeras datileras | :117‑122 (`palmCrown` models.ts:1409) | Merger | A | — |
| Pinos | :123‑127 | Merger | A | — |
| Chalets (`villa`): volumen, tejado o azotea, ventanas y persianas, puerta, toldo, chimenea, muro, buganvilla, palmera | :39‑75, 130‑131 | Merger | A | — |
| Casas detrás del muro | :132‑143 | Merger | A | — |
| Coches aparcados de cajas | :145‑150 | G.rbox, G.cyl | Merger | C | Mucho más simples que los coches HD de los demás: sustituirlos por coches HD. |
| Postes, brazos, farolas y cable | :153‑161 | Merger | C | Cable de 0,03: fino. |
| **Luces de las farolas** (solo de noche) | :162‑168 | Points aditivos, tamaño 2,4 | B | `comicScene` las oculta: hacen falta farolas encendidas de tebeo. |
| Placita del faro: adoquín, acera, bordillo | :172‑174 | Merger | C | Adoquín plano: loseta. |
| Bancos | :175‑180 | Merger | A | — |
| Árbol grande y alcorque | :181‑185 | Merger | A | — |
| Panel informativo | :186‑188 | Merger | A | — |
| Papelera | :189 | Merger | A | — |
| Muro bajo hacia el agua | :192‑195 | Merger | A | — |
| Casita blanca con tejado blanco y seto | :197‑202 | Merger | A | — |
| Plataforma de rocas de marès | :205‑209 | G.rock | Merger | C | Roca facetada: dibujo de marès. |
| Charcos | :210 | G.cyl | Merger | C | Agua opaca plana. |
| Faro: roca y muro de hormigón | :214‑215 | Merger | C | Roca facetada. |
| Faro: casa del farero | :216‑218 | Merger | A | — |
| Faro: torre con franjas | :220‑222 | Cylinder abierto de 1 segmento, `toon` con mapa de franjas (lienzo) | C | Sin segmentos verticales: se inclina recta. Opcional: segmentarla. |
| Faro: galerías, cuerpo, linterna y cúpula | :223‑227 | Merger | C | La linterna (0x9fd3e8) no es emisiva: de noche debería brillar. |
| Castell de Sant Nicolau: muros, cilindro, cornisa, almenas, puerta, roca | :229‑240 | Merger | A | — |
| Llaüts | :242‑245 | Merger | A | — |
| **El mar** | :249‑251 → gfx.ts:875‑928 | Water (ShaderMaterial); si la calidad baja, `toon` | B | Hace falta un mar de tebeo; no tiene equivalente en el cap. 1. |
| Paseantes (de día) | :255‑268 | personas | — | Excluidos. |

#### 7.4 Alrededores de noche (`buildSurroundings` con `night`, levelCena.ts:1228‑1245)

| Objeto | file:line | Material | Cl. | Qué hacer |
|---|---|---|---|---|
| Campo | surround.ts:61‑76 | Merger (G.box) | C | Verde plano: loseta de campo. |
| Pinos, palmeras, acebuches | surround.ts:78‑94 | Merger / Merger‑hoja | A | — |
| Casas, tejados, azoteas, ventanas, muros de jardín | surround.ts:113‑155 | Merger | A | — |
| Rocas del lado del mar | surround.ts:103 | Merger | C | Facetadas. |
| Lomas | surround.ts:160‑167 | Merger | A | — |
| **Luces de las ventanas** | surround.ts:171‑178 | Points aditivos, tamaño 1,4 | B | Se ocultan: de noche faltan. Hace falta otra forma de mostrarlas. |

#### 7.5 Vehículos, juego y efectos del cap. 7 (levelCena.ts)

| Objeto | file:line | Cómo se construye | Material | Cl. | Qué hacer |
|---|---|---|---|---|---|
| Coche de los padres (`makeCar` HD con el padre al volante) | :74 → vehiclesHD.ts:82‑168 | profile/Extrude | lacado MeshPhysical metal 0,6 | C | Se pierden metal y clearcoat. |
| Coche de los padres: faros y pilotos | vehiclesHD.ts:101‑102, 129‑132 | Box | MeshStandard emisivo 0,6 / 0,45 | C | Emisivo sin bloom: aceptable. Faltan haces de noche. |
| Coche de los padres: cristal | vehiclesHD.ts:97 | profile | MeshPhysical transparente 0,82 | C | — |
| Coche de los padres: ruedas, llantas, matrículas, plásticos, cromo | vehiclesHD.ts:98‑100, 135‑153 | varios | MeshStandard / MeshPhysical metal 1 | A | El cromo queda gris plano. |
| Moto de Gas (`makeMotoHD` con piloto y casco) | :75 → vehiclesHD.ts:176‑360 | piezas | lacado, cromo, aluminio, goma, cuero | C | Muchas piezas metálicas y finas. |
| Moto de Gas: faro, piloto, intermitentes, cuadro | vehiclesHD.ts:188‑191 | — | emisivos 1,2 / 0,8 / 0,35 / 0,5 | C | — |
| Casco del piloto | helmet.ts:42‑ | Sphere | MeshPhysical; visera transparente | C | — |
| Brillo de faros del coche y de la moto | :155‑160 | Sprite | Spr+ | B | Haz o destello de tebeo. |
| Marcador amarillo | :165‑169 | Cone, Cylinder | `toon` emisivo | C | — |
| Platos de la cena (alarma) | :402‑410 | Merger(false) | Merger | A | — |
| Casco de Gas en el murete | :412‑415 (helmet.ts) | Sphere | MeshPhysical | C | — |
| Anillos de «recoger aquí» | :416‑423 | Ring | Basic transparente | B | Vale tal cual. |
| Coche del vecino (HD) | :431 | ver arriba | ver arriba | C | — |
| Coche del vecino: brillo de faros | :433‑439 | Sprite | Spr+ | B | Cuña de faro de tebeo. |
| Coche del vecino: haz en el suelo | :440‑443 | Plane | Basic aditivo `glow` | B | ídem. |
| `TableMemory`: jarrón con flores | sideGames.ts:1175‑1183 | Merger(false) | Merger | A | Tallos de 0,008: finísimos. |
| `TableMemory`: frutero | sideGames.ts:1186‑1190 | Merger(false) | Merger | A | — |
| `TableMemory`: vela con llama | sideGames.ts:1193‑1198 | Merger(false) | Merger | C | La llama no es emisiva: debería brillar plana. |
| `TableMemory`: jarra | sideGames.ts:1201‑1206 | Merger(false) | Merger | A | — |
| `TableMemory`: salero y pimentero | sideGames.ts:1209‑1215 | Merger(false) | Merger | A | — |
| Partículas | :133 → fx.ts | Sprites | normal | B | ídem que en 6.3. |
| Radar de vuelos en el móvil | ui/minis.ts:470 | lienzo del DOM | — | — | 2D, no le afecta (revisar el CSS `comic-mode`). |
| Encuesta de nata y chats | DOM | — | — | — | 2D. |

---

### Capítulo 8 · El eclipse

#### 8.1 Parking del aeropuerto de noche (missions/parking.ts)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Asfalto | :62‑75 | Plane | `toon` con mapa | lienzo repetido | C | `drawnMap` automático: aceptable; mejor una loseta de asfalto. |
| Rayas de las plazas | :77‑80 | G.box de 1 cm | Merger | — | C | Finas: posible parpadeo de la tinta. |
| Bordillo y seto perimetral | :82‑85 | G.box | Merger | — | A | — |
| Farolas: postes y luminarias | :86‑88 | G.cyl, G.box | Merger | — | A | — |
| Farolas: PointLights ×5 | :89‑91 | luz | — | — | C | Charcos de luz duros en toon. |
| Farolas: halo | :92‑95 | Sprite | Spr+ | `glow` | B | Farol de tebeo. |
| Terminal | :98 | G.box | Merger | — | A | — |
| Ventanales de la terminal | :99 | G.box | Merger 0xffd890 | — | C | No emisivo: de noche no brilla. |
| Rótulo «AEROPORT DE MENORCA» | :101‑112 | Plane | Basic | lienzo | B | Vale tal cual. |
| Motos aparcadas ×~25 (`motoFleet`) | :121 → vehiclesHD.ts:370‑389 | InstancedMesh | MeshPhysical y MeshStandard (faros emisivos 1,2) | — | C | Instanciadas; todos los faros encendidos sin bloom. |
| Casco rojo sobre la moto de Gas | :123‑126 | helmet.ts | MeshPhysical; visera transparente | — | C | — |
| Móvil en la mano | :140‑142 | Box | MeshStandard emisivo 0xdfe8ff | — | C | — |
| Linterna del móvil (SpotLight) | :136‑139 | luz | — | — | C | Cono de luz en toon: borde duro. Revisar. |
| Columna de luz (`beacon`) | core/beacon.ts | grupo vacío | — | — | — | No dibuja nada (se quitó). |

#### 8.2 Kayak frente a Sa Farola, de día (levelEclipse.ts:254‑282)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cielo de día (físico) y nubes | :238‑240 → gfx.ts:559‑577 | SkyMesh + Sprites | ShaderMaterial + nubes de cómic | — | B | Usar el degradado de cómic como en ferreries.ts:359. Las nubes ya salen de cómic. |
| Costa y faro (`buildSaFarola` de día, faro movido) | :257 | ver 7.3 | ver 7.3 | — | ver 7.3 | — |
| Rocas de marès de la orilla y escollos | :260‑267 | G.crag | Merger | — | C | Facetadas: hace falta una roca dibujada. |
| Casco del kayak | kayak.ts:100‑105 (geo :11‑39) | geometría propia 56×32 | MeshPhysical clearcoat | — | A | Se dobla fijo en su posición inicial (#7, poco). |
| Kayak: bañeras, brazolas, tambuchos, gomas, asas, timón | kayak.ts:107‑124 | Merger(false) | Merger | — | C | Gomas de 0,012: finas. |
| Remos ×2 | kayak.ts:69‑79, 160‑161 | Merger | Merger | — | C | Se mueven y quedan doblados fijos: marcarlos con `comicBent`. |
| Estela | kayak.ts:126‑131 (tex :42‑67) | Plane | Basic transparente | lienzo | B | Espuma de tebeo (líneas en V). |
| **Ferry**: casco, franja, cubiertas, ventanas, puente, ojos de buey, chimenea, botes, mástil | kayak.ts:227‑264 | Extrude y Merger(false) | Merger | — | C | Enorme y se mueve: doblado fijo. |
| Ferry: ola de proa | kayak.ts:266‑273 | Plane | Basic transparente | lienzo | B | Espuma de tebeo. |
| Salpicaduras 💦 | fx.ts | Sprite | normal | emoji del sistema | B | Dibujar la gota. |
| Marcador | levelEclipse.ts:194‑195 | Cone, Cylinder | `toon` emisivo | — | C | — |

#### 8.3 Casa de Azul de día (`buildAzulHouse(day)`, levelEclipse.ts:284‑330)

Es la misma tabla de 7.1, 7.2, 7.3 y 7.4, con estas diferencias:

| Objeto | file:line | Material | Cl. | Qué hacer |
|---|---|---|---|---|
| Ventanas encendidas de día | levelCena.ts:1010 | Basic | B | Apagarlas cuando sea de día. |
| Guirnalda de día | levelCena.ts:1151 | Spr+ | B | Bombillas de cómic apagadas. |
| Luz y haz del faro | levelCena.ts:1246‑1267 | ocultos de día | — | — |
| Mar de día | saFarola.ts:249 | Water | B | — |
| Coche azul de Gas con los dos dentro | levelEclipse.ts:322 | HD | C | — |
| Joy (`makeDogHD`) | levelEclipse.ts:310 → vehiclesHD.ts:392‑ | SkinnedMesh, MeshStandard con mapa gris | A | Va como personaje (sin tinta interior). |
| Eric y los padres | — | personas | — | Excluidos. |

#### 8.4 Calle de casa de Gas y la maniobra de aparcar (`buildStreet`, homeStreet.ts:170‑350)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Carretera | :177 | G.box | Merger | — | C | Asfalto plano: loseta. |
| Línea discontinua | :178 | G.box | Merger | — | C | — |
| Bordillos | :179 | G.box | Merger | — | A | — |
| Aceras ×2 | :180‑189 (tex :30‑46) | Plane | `toon` con mapa | lienzo repetido (130×1) | C | `drawnMap` automático. |
| Pavimentos | :190‑191 | G.box | Merger | — | C | Planos. |
| Fachada amarilla, cornisa, alero de teja, chimenea | :197‑201 | G.box, `ROOF_GEO` | Merger | — | C | Pared Merger de 1 segmento: no se comba como en el cap. 1. Pasar a `TownHD`. |
| Ventanas con contraventanas | :138‑144, 202‑206 | G.box | Merger | — | C | Algunas encendidas (0xffd9a0) de día. |
| Barandilla del balcón | :204‑205 | G.box 0,03 | Merger | — | C | Fina. |
| Garaje con luz | :208‑211 | G.box | Merger | — | A | — |
| Puerta de entrada y farolillo | :213‑216 | G.box, G.sphere | Merger | — | A | — |
| Patio y muros | :218‑224 | G.box | Merger | — | A | — |
| Pilares con remate | :226‑230 | G.box, G.cone | Merger | — | A | — |
| Corredera (hoja de `Door`) | :232‑240 | Merger | Merger | — | C | Se mueve: doblado fijo. |
| Muro, piedra seca, buzón, placa metálica, cartel de la alarma | :242‑268, 294 | G.box | Merger | — | A | — |
| Puerta peatonal (hoja de `Door`) | :250‑259 | Merger | Merger | — | C | Se mueve. |
| Placa «Sa Son 69 B4» | :270‑293 | Plane | `toon` con mapa | lienzo | A | — |
| Palmeras | :131‑135, 297‑299 | Merger | Merger | — | A | — |
| Seto | :300‑301 | G.box, G.bush | Merger / Merger‑hoja | — | A | — |
| Vecinos y casas genéricas | :147‑158, 302‑324 | Merger | Merger | — | A | Algunas ventanas encendidas al azar de día (:154‑155). |
| Farolas | :328‑335 | Merger | Merger | — | A | — |
| Brillos de farolas | :338‑342 | Points aditivos, tamaño 1,6 | — | — | B | Ocultos (de día ya se ocultan en levelEclipse.ts:336). |
| PointLight de casa | :343‑345 | luz | — | — | C | Es de día: sobra. |
| Zona de aparcar | levelEclipse.ts:345‑350 | Plane | Basic verde transparente | — | B | Rectángulo de tebeo con borde discontinuo. |
| Coche de Gas (HD) | levelEclipse.ts:338 | ver 7.5 | ver 7.5 | — | C | Se mueve: doblado fijo. |

#### 8.5 Cocina de los padres de Gas (levelEclipse.ts:360‑480)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Suelo de barro cocido | :364‑379 | Plane | `toon` con mapa | lienzo repetido | C | `drawnMap` automático; mejor una loseta de barro dibujada. |
| Patio exterior | :381‑384 | Plane | `toon` (surf Paving) | — | C | Plano. |
| Alrededores de día | :386 | ver 7.4 | ver 7.4 | — | — | — |
| Muros del patio y macetas | :390‑397 | Merger | Merger | — | A | — |
| Paredes y vigas | :399‑401 | G.box | Merger | — | C | Paredes de 1 segmento: no se comban como en el cap. 1 (aceptable en un interior). |
| Encimera, fregadero, fogones | :404‑407 | G.box | Merger | — | A | — |
| Armarios con juntas y tiradores | :408‑414 | G.box | Merger | — | A | Juntas de 0,006: finas. |
| Nevera | :415 | G.rbox | Merger | — | A | — |
| Ventana con persianas | :418‑419 | G.box | Merger | — | A | — |
| Azulejos | :421 | G.box | Merger | — | A | — |
| Campana extractora | :422‑423 | G.box | Merger | — | A | — |
| Botes y olla | :424‑425 | G.cyl | Merger | — | A | — |
| Aparador con platos | :427‑429 | G.box, G.cyl | Merger | — | A | — |
| Puerta y pomo | :431‑432 | G.box, G.sphere | Merger | — | A | — |
| Reloj | :433‑434 | G.cyl, G.box | Merger | — | A | — |
| Calendario | :436‑439 | G.box | Merger | — | A | Cuadritos de 4 mm: ruido de tinta. |
| Lámpara colgante | :441‑442 | G.box, G.cone | Merger | — | C | No es emisiva. |
| Alfombra de esparto | :443 | G.box | Merger | — | A | — |
| Maceta de potos | :445‑448 | G.cyl, G.sphere, G.bush | Merger / Merger‑hoja | — | A | — |
| Mesa con hule y sillas | :451‑455 (`woodChair` models.ts:1198) | G.box | Merger | — | A | — |
| Frutero, naranja y manzana | :456‑458 | G.cyl, G.sphere | Merger | — | A | — |
| PointLight de interior | :461 | luz | — | — | C | Más el sol y la hemi de cómic entera: interior quemado. |

#### 8.6 Rocas: Love Letter, saltos entre rocas y eclipse (levelEclipse.ts:482‑568, 939‑1160, 1460‑1528)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cielo del atardecer y estrellas (opacidad animada) | :483, 487‑490, 1502‑1510 | Sky en degradado y Points en el cielo | Basic / Points | — | B | El degradado vale. Las estrellas se respetan. |
| Nubes del atardecer ×5 | :483 → gfx.ts:586‑612 | Sprites del cielo | nubes de cómic teñidas 0xffc9a0 | — | A | Comprobar el tinte. |
| Mar | :491‑493 | Water | ShaderMaterial | — | B | Mar de tebeo al atardecer, con el reflejo del sol dibujado. |
| Roca grande (G.sphere 16×3,2×12) | :495 | G.sphere 12×8 | Merger | — | C | Pocos polígonos: facetas muy marcadas en toon. Hace falta una roca de tebeo. |
| Piedras sueltas | :497‑505 | G.rock, G.crag | Merger | — | C | ídem. |
| Rocas grandes y bloques de la orilla | :506‑508 | G.rock, G.rock2 | Merger | — | C | ídem. |
| Gafas de eclipse (en el hueso Head) | :523‑533 | Merger | Merger | — | A | Patillas de 0,008: finas. |
| **Disco del sol** | :537‑539 | Circle(40) | Basic sin niebla | — | B | Lleva silueta de tinta (escribe profundidad): puede quedar bien. Marcarlo con `comicBent`. |
| **Luna** | :540‑541, 563‑568 | Circle | Basic casi negra | — | B | ídem. |
| **Corona** | :542‑544 (tex :38‑72) | Sprite | aditivo, opacidad animada | lienzo de rayos finos | B | Hace falta una corona de tebeo: rayos de tinta y halo plano. |
| **Anillo de diamante** | :548‑551 | Sprite | aditivo animado | `glow` | B | Estrella de tebeo con rayos. |
| Halo del sol | :552‑557, 1520‑1521 | Sprite | aditivo animado | `glow` | B | Halo plano en bandas. |
| Destello de la totalidad | :1145 | postproceso | — | — | B | Se pierde: hacer un destello en DOM o en la pasada de cómic. |
| Oscurecimiento (cielo, hemi, sol, entorno) | :1499‑1510 | luces | — | — | C | Añadir también la hemi de cómic al oscurecimiento. |
| Cartas de La Princesa (cara y dorso), montones, abanicos en la mano | :963‑987, 1004‑1036 (`cardCanvas` ui/cards.ts:318) | Plane 0,09×0,126 | MeshStandard con mapa | lienzo | A | Tamaño minúsculo: la tinta puede comerse la carta en planos lejanos. |
| Luz de relleno | :1000 | PointLight 5 | — | — | C | — |
| `RockHop`: rocas y caras planas | sideGames.ts:1438‑1446 | G.rock, G.crag, Cylinder | Merger | — | C | Facetadas. |
| `RockHop`: espuma de la ola | sideGames.ts:1447‑1452 | Plane | Basic transparente `glow` | — | B | Ola de tebeo. |
| Velo de las gafas, juego de Love Letter, flash de la foto | DOM | — | — | — | — | 2D. |

---

### Carta final (letterScene.ts)

| Objeto | file:line | Cómo se construye | Material | Textura | Cl. | Qué hacer |
|---|---|---|---|---|---|---|
| Cielo nocturno con 2600 estrellas | :33 | Sky | Basic / Points | — | B | Vale tal cual. |
| Luna | :37‑39 | Circle | Basic | — | B | Vale tal cual (tendrá silueta de tinta). |
| Halo de la luna | :40‑43 | Sprite | Spr+ | `glow` | B | Halo plano en bandas. |
| Luz de luna | :44‑46 | DirectionalLight 0,8 | — | — | C | — |
| Mar en calma | :47‑51 | Water con distorsión 0,22 | ShaderMaterial | — | B | Mar de tebeo nocturno, con el reflejo de la luna en trazos. |
| **Fuegos artificiales** | :19, 52, 149‑156 | Points | aditivo, vertexColors, 600 puntos | `glow` | B | `comicScene` los rompe (bolas opacas que se vuelven negras): marcarlos con `noComic` y hacer chispas de tebeo. |
| Marco blanco de las polaroids | :68 | Plane | Basic DoubleSide | — | B | Vale tal cual. |
| Fotos | :57‑65, 69‑70 | Plane | Basic | fotos reales | B | Mantenerlas como fotos (son los recuerdos), con borde de tinta. |
| Halo detrás de las fotos | :71‑74 | Sprite | Spr+ opacidad 0,35 | `glow` | B | Faroles de tebeo. |
| Texto de la carta | :86‑133 | DOM | — | — | — | 2D. |

---

## 3. Lo que el cap. 1 no tiene y habrá que diseñar

| Necesidad | Dónde | Nota |
|---|---|---|
| **Luz de noche de cómic**: hemi nocturna, rampa de 3 tonos para luz de luna y charcos de farola | 6 (noche, taxi, casa), 7, 8 (parking), carta | `comicScene` supone día. Hace falta un modo noche: hemi azul y baja, sin `background` de día, y luces puntuales con la rampa. |
| **Luces encendidas de tebeo**: farolas, faroles, ventanas, guirnaldas de Sprites, faros de coche, linterna, faro de Sa Farola | 6, 7, 8 | En el cap. 1 solo hay guirnaldas de Points de día. Ahora los halos se apagan o se atenúan. |
| **Mar de tebeo** | 7, 8 (kayak y rocas), carta | Water se queda fotorrealista. Hacen falta variantes de día, de atardecer y de noche, y espuma (estela del kayak, ola del ferry, ola del `RockHop`). |
| **Rocas y acantilados dibujados** | 7, 8 | La roca facetada de pocos polígonos en toon queda tosca. Hace falta un dibujo de marès o una roca con tinta. |
| **Losetas dibujadas que faltan**: asfalto, hormigón, tierra, adoquín, barro cocido, piedra seca, pinaza, campo, monte | 6, 7, 8 | `comicTiles` solo tiene slabs, mares, roof, roofGrey, wash, wood y doors. |
| **Eclipse en cómic**: disco, luna, corona, diamante, cielo que oscurece, estrellas que aparecen | 8 | No hay referencia. Además el oscurecimiento no afecta a la hemi de cómic y el destello de la totalidad se pierde. |
| **Fuegos artificiales de cómic** | carta (y SJ, que no los usa) | La conversión actual los rompe. |
| **Atardecer de cómic** (paleta cálida, nubes teñidas) | 8 (rocas) | El cap. 1 es a mediodía. |
| **Cielo de día sin dispersión física** en otros capítulos | 8 | Copiar la regla `painted || comic.on` de ferreries.ts:359. |
| **Interiores en toon** (cocina con PointLight) | 8 | Sin precedente. |
| **Vehículos HD en cómic** (lacado, cristal, cromo, faros) y la flota instanciada | 6, 7, 8 | En el cap. 1 no hay coches. Pierden metal y clearcoat y se doblan fijos al moverse. |
| **Volúmenes de luz** (haces de faros, del faro, de la linterna) | 6, 7, 8 | Ahora son MeshBasic aditivos de foto. |
| **Fotos reales en una escena de tebeo** | carta | Decidir si se quedan como fotos. |
| **Efectos que hoy dependen del postproceso**: destello, DOF en los diálogos, bloom de lo emisivo | todos | `drawComic` sustituye a `post`. |
| **Edificios de piedra con `TownHD`** | 6 | Usar `mares` en vez de `wash` teñido (Catedral, Ajuntament, Bè). |
| **Las paredes Merger de baja resolución** (casa de Azul, casa de Gas, cocina) frente a las paredes `Builder` del cap. 1 | 7, 8 | No se comban: el look «a mano alzada» no coincide. Migrar a `Builder`/`TownHD` o segmentar. |
| **Que la carta tenga su propio indicador de cómic y llame a `comicScene`** | main.ts:331‑342 | Ahora usa `setHd(true, 2)`. |
