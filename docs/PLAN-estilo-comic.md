# Plan: el estilo cómic del capítulo 1 en todo el juego

Documento para otra IA (o persona) que vaya a migrar el **aspecto del entorno** de todos los capítulos al estilo del capítulo 1 (Ferreries, el "Jaleo d'ases"). Está escrito para trabajar sin más contexto. La sección 7 es el **inventario objeto por objeto** de cada capítulo: es la lista de comprobación; no se da un capítulo por terminado hasta que todas sus filas estén hechas.

> Fecha de corte: 9 de noviembre de 2026. Los capítulos se abren uno al día del 20 al 28 de noviembre. Ver también `docs/PLAN-personajes.md` (personajes) y `docs/REVISION-animaciones.md` (animaciones): **este plan no toca personajes**, solo el entorno.

---

## 0. Objetivo y reglas

**Objetivo:** que todos los capítulos (2 a 9 y la carta final) se vean **exactamente** como el capítulo 1: mismo sombreado en tres tonos, misma tinta, mismas texturas dibujadas a mano, mismo cielo de tebeo, mismas nubes, mismo papel, mismas onomatopeyas y líneas de acción, misma interfaz de tebeo. Coherencia total: si una persona ve dos capítulos seguidos, tiene que parecer el mismo dibujante.

**Reglas:**
1. **El capítulo 1 es la referencia y no se cambia** salvo que el cambio sea necesario para la coherencia (p. ej. una mejora del sistema que también le aplica). Si un cambio afecta al capítulo 1, se hacen capturas antes/después del capítulo 1 y se enseñan al dueño.
2. **Ni un objeto sin migrar.** Cada objeto de la sección 7 tiene una fila; se marca cuando está hecho y comprobado en captura. Lo que no esté en la lista y se encuentre, se añade a la lista.
3. **Un capítulo cada vez**, con capturas y aprobación del dueño antes de pasar al siguiente. Orden recomendado en la sección 5.
4. **Nada se publica sin confirmación** (publicar = copiar `dist/` al repo `marcmnc7/pm-2611`). Commits locales; push solo cuando el dueño lo diga.
5. **Rendimiento en móvil**: el estilo cómic es una pasada a pantalla completa y conversiones de texturas al cargar. Medir fps y tiempo de carga de cada capítulo en el móvil del dueño (o, como mínimo, con la CPU ralentizada ×4 en Chrome).
6. Hablar con el dueño **en español**.

---

## 1. Cómo funciona hoy el estilo del capítulo 1

### 1.1 Activación
- `src/main.ts` → `setHd(on, n)`: `comic.on = COMIC_CHAPTERS.includes(n)`. Hoy `COMIC_CHAPTERS = [1, 9]`; el resto usa el estilo "pintado" (`core/paint.ts` + postproceso `core/post.ts`).
- **Vista previa:** `?estilo=comic` (añadido para esta migración) pone el cómic en **todos** los capítulos. `?estilo=pintado` lo quita de todos. Ejemplo: `http://localhost:5173/?hq&estilo=comic#test`.
- Cuando `comic.on`:
  - `drawComic()` (`core/comic.ts`) **sustituye al postproceso**: se dibuja la escena en un render target y una pasada a pantalla completa añade **tinta** (siluetas y aristas sacadas de la profundidad, con trazo que ondula y cambia de grosor), **color de imprenta** (saturación ×1,18), **papel** (blanco a crema `×(1, 0.978, 0.93)`) y **líneas de acción** (rayas radiales al ir a más de ~5 m/s de cámara o en un golpe, `comicBurst`).
  - Tono: `ACESFilmic`, exposición 0,95.
  - La interfaz lleva la clase `comic-mode` en `<html>`: bocadillos, cartuchos y avisos dibujados.
  - `juice.onWord` → onomatopeyas de tebeo (`comicWord`) en cada golpe o acierto.
  - Nubes: `core/gfx.ts` `Sky` usa `comicCloudTextures()` (nubes con contorno de tinta).

### 1.2 `comicScene(escena)` — lo que se convierte solo
Se llama al montar cada escena (`main.ts`: al empezar el capítulo, en `stage.onStart` para las misiones, y cada segundo en el bucle para lo que se añade después).
1. **Materiales con luz** (`MeshStandardMaterial`, `MeshLambertMaterial`, `MeshPhongMaterial`) → `MeshToonMaterial` con rampa de 3 tonos (decorado `[90, 170, 255]`; personajes `[188, 228, 255]`).
   - Textura **repetida** (foto de material, `RepeatWrapping`, sin `vertexColors`): si la textura trae `userData.comic` (uno de `slabs`, `mares`, `roof`, `roofGrey`, `wash`, `wood`, `doors`, puesto en `world/hd/materials.ts`), se cambia por el **dibujo hecho a mano** de `core/comicTiles.ts`; si no, se convierte la foto en dibujo automáticamente (`drawnMap`: color aplanado, relieve en dos tonos del mapa de normales, tinta en las juntas).
   - Textura suelta (carteles, pancartas): se queda.
   - **El sombreador de "grano"** (`addGrain` en `core/gfx.ts`: las texturas de superficie triplanares de `core/surfaces.ts` que llevan casi todo el decorado hecho con `toon()` / `Merger`) **se tira**: esos objetos quedan de **color liso**. Ver decisión D2.
   - Otros sombreadores propios (animación de la multitud, ropa) se conservan.
2. **Materiales sin luz** (`MeshBasicMaterial`, `ShaderMaterial`, `Points`, `Sprite`, `Line`): **no se tocan**. Excepciones ya hechas para el capítulo 1: guirnaldas de bombillas (`Points` aditivos con mapa y colores → `comicBulbTexture()`), halos de farolas (`Points` grandes → ocultos de día), el resto de brillos aditivos a 40 % de opacidad.
3. **A mano alzada** (`handDrawn`): las mallas grandes (radio ≥ 0,8 m), estáticas, no instanciadas, sin piel y con geometría de uso único se deforman con un campo suave del mundo (paredes que se inclinan y comban, tejados que ceden, cornisas que ondulan). **Necesita geometría subdividida**: `world/hd/builder.ts` parte las caras grandes cuando `comic.on`; las cajas de `Merger` no están subdivididas y apenas se doblan.
4. **Cielo y luz — pensado solo para el día:** pone el fondo azul plano `0x76c3f0` (que **no se ve**: la cúpula del `Sky`, de radio 420 y pegada a la cámara, lo tapa; el cielo real del cap. 1 es el degradado pintado de `ferreries.ts:359-363`), quita `scene.environment`, limita las direccionales a 2,1 y añade una `HemisphereLight(0xdff2ff, 0xb59c84, 1.35)`. **Ojo con el orden:** justo después, `applyShadows` → `applyEnvironment` vuelve a poner el HDRI en `scene.environment` (que ningún material de cómic usa: memoria de vídeo gastada) y **multiplica todas las hemisféricas por 0,35** (`gfx.ts:295-298`; en las misiones, por 0,55 en `gfx.ts:312-315`). El aspecto actual del cap. 1 **incluye** esa reducción: la hemisférica del cómic queda en ~0,47 y la del pueblo en 0,35. Cualquier cambio de este orden cambia la referencia. Para las escenas de noche e interior, ver D1.
5. `userData.noComic = true` en un objeto lo deja fuera de la conversión.
6. **Brillos (puntos y sprites aditivos)**, `comic.ts:397-419`: solo se convierten en bombilla de tebeo (`comicBulbTexture`) los `Points` con mapa, **color por vértice**, tamaño ≥ 0,6 y **≥ 100 puntos**; los demás puntos grandes **se ocultan** y los pequeños quedan aditivos al 40 %. Consecuencia en el propio cap. 1: las bombillas de las guirnaldas y faroles (sin color por vértice) y las de los bares (60 puntos) **desaparecen**, y los fuegos artificiales sí se convierten pero al apagarse bajan el color y acaban en **discos negros**. Arreglarlo forma parte de F0 (ver inventario del cap. 1).

### 1.3 Lo que es propio del capítulo 1 (receta de referencia)
| Aspecto | Qué hace | Dónde |
|---|---|---|
| Activación | `comic.on` en caps. 1 y 9; `paintStyle = 0`; `hdSurfaces = 1` en todos; sin HDRI por defecto | `main.ts:369-378, 413-431` |
| Tono | ACES, exposición 0,95, aplicado dentro de la pasada de tebeo; clase `comic-mode` en la interfaz | `main.ts:426-431`; `comic.ts:478-480`; `ui/style.css` (`.comic-mode`) |
| Cuándo se convierte | Al montar el capítulo, cada segundo o al cambiar de escena, y al empezar una misión | `main.ts:530, 727-731, 199-203` |
| Pasada de dibujo | Tinta por profundidad (silueta y aristas), personas marcadas en alfa 0,5 (solo silueta), color de imprenta, papel crema, líneas de acción | `comic.ts:458-645`; `juice.ts:55-65` |
| Sin tinta | Lo que no escribe profundidad (`depthWrite: false`): cúpula, nubes, aros, red, vasos de la barra, sombras falsas | `comic.ts:493-536` |
| Materiales | Rampa de 3 tonos; se descartan grano, foto de superficie, mapa de normales y rugosidad; se conservan emisivo, transparencia, caras, `depthWrite`, `polygonOffset`, color por vértice y niebla | `comic.ts:246-331`; `gfx.ts:47-77` |
| Texturas dibujadas | `hd/materials.ts` marca las fotos: slabs, mares (también maresDark), roof (roofm), wash (whitewash y plaster), wood, doors. En caps. 1 y 9 no se usa `roofGrey` y `drawnMap` no llega a ejecutarse | `materials.ts:29-45, 70-93`; `comicTiles.ts:420-443` |
| Geometría | En cómic, `Builder` parte las caras cada ~0,6 m y engorda lo fino (marcos, barrotes, postes); los piñones (`gable`) **no** se parten. `handDrawn` dobla lo grande, fijo y no compartido | `builder.ts:15, 38-40, 59-61, 74, 83-89`; `comic.ts:345-390` |
| Constructores | `FerreriesHD` (casas, barras, suelo, iglesia) + `Merger` (color por vértice; copas de árbol que en cómic quedan macizas) + `toon()` + lienzos de `deco.ts` | `hd/ferreriesHD.ts`; `entities/models.ts:27-134`; `world/deco.ts` |
| Cielo y niebla | `Sky` pintado (0x2a6fd0 / 0x7fbdf2 / 0xf6ead2) + nubes de tebeo (25 m más altas, al 60 %) + halo aditivo del sol; niebla 0xcfe0ee 70–180 m (no casa del todo con el horizonte crema) | `ferreries.ts:355-369`; `gfx.ts:579-611`; `comicTiles.ts:356-416` |
| Luz y hora | 11:00 (`MORNING_DIR`); hemisférica del pueblo 1,0 y del cómic 1,35, ambas ×0,35 por el orden de llamadas; sol 3,4 limitado a 2,1; sombras activas | `ferreries.ts:344, 370-373`; `comic.ts:438-450` |
| Personajes | VRM de Azul con `noComic` (MToon); ropa de los rigs lisa; multitud marcada como persona | `vrm.ts`; `rig.ts`; `crowdRig.ts:468` |
| Interfaz | Onomatopeyas `comicWord` en golpes y aciertos | `main.ts:178`; `juice.ts:55-61` |

**Lo que este análisis muestra que el cap. 1 tampoco tiene bien** (corregirlo en F0, porque si no se copiaría el defecto): bombillas y guirnaldas ocultas; fuegos artificiales que se apagan en negro; el Ajuntament hecho con cajas de `Merger` sin texturas dibujadas (desentona con las casas vecinas); piñones, chapitel y campana sin subdividir; persianas con sombreado casi fotográfico (`shutterMat`); carteles y rótulos en `MeshBasic` (sin luz); vasos casi invisibles y sin tinta; partículas y emojis (💕, 💦, ❗) con degradados o con el emoji del sistema; las manzanas lejanas (`surround.ts`) sin texturas dibujadas. Y las misiones del cap. 9 (playa y parque) usan el **cielo físico** y el **mar realista**, no el cielo pintado del cap. 1.

---

## 2. Lo que pasa hoy si se enciende el cómic en todo (`?estilo=comic`)

Capturas hechas al principio de cada capítulo con `?estilo=comic` (8-nov-2026):

| Cap. | Resultado | Problemas a la vista |
|---|---|---|
| 1 | Referencia: losas y casas dibujadas, tinta, papel | — |
| 2 | Born y calle de casa de Azul **con luz de día** | Es de **noche** y la luz de día que añade el cómic la aclara (D1). Asfalto, plaza, aceras, árboles: **color liso sin dibujo** (D2). Árboles de bloques sin tinta interior |
| 3 | Carretera, arena, edificios | Todo **color liso** (D2): fachadas sin ventanas dibujadas, arena y asfalto planos. Las líneas de acción salen al ir en coche (es lo esperado) |
| 4 | Pasillo del aeropuerto | Interior **lavado a blanco**; suelo sin dibujo. Además, Barajas está **en la misma escena de noche que el estadio**: su "día" solo existe en el etalonaje del postproceso, que el cómic no usa, así que en cómic sale con la luz de noche (sol rosa, ambiente violeta) |
| 5 | Moto por la costa | Color liso en carretera, campo, casas y mar; mar con el sombreador de agua sin pasar a cómic |
| 6 | Born de Ciutadella | **El más cercano**: usa `townHD` con las losas y fachadas dibujadas del cap. 1. Falta repasar árboles, bancos y carteles |
| 7 | Sa Farola de noche | La noche se mantiene (la cúpula del cielo tapa el fondo azul), pero la luz extra de día aclara; halos de farolas y estrellas sin estilo cómic |
| 8 | Aparcamiento de noche | Igual que el 7: halos de farolas y la luz del móvil en estilo antiguo; suelo y motos lisos |
| 9 | Ya es cómic (Ferreries) | Revisar las misiones de la playa y el parque (sección 7) |

---

## 3. Decisiones técnicas (tomarlas antes de tocar ningún capítulo)

### D1 · Cómic de noche, de interior y de atardecer
`comicScene` supone día. Hay que darle **perfiles de luz** y que cada capítulo (y cada fase que cambia de luz) diga cuál usa:

| Perfil | Fondo / cielo | Luz de ambiente del cómic | Sol / luna | Papel y tinta |
|---|---|---|---|---|
| `dia` (cap. 1) | cúpula pintada del cap. 1 (`0x2a6fd0` / `0x7fbdf2` / `0xf6ead2`) + nubes de tebeo | resultado final del cap. 1: hemisférica del lugar ≈0,35 + la del cómic `(0xdff2ff, 0xb59c84)` ≈0,47 | ≤ 2,1 | crema, tinta `#0b090e` |
| `noche` | azul noche plano (p. ej. `0x14213f`) con estrellas dibujadas (puntos con contorno, no brillo aditivo) y luna de tebeo | `Hemisphere` azul frío y suelo violeta, más baja (≈0,6) | luna ≤ 1,0, fría | papel algo más frío; la tinta igual |
| `interior` | el del interior (techo/paredes) | `Hemisphere` neutra ≈0,9 | luces del techo como direccionales/puntuales suaves, sin sol de día | igual que día |
| `atardecer` (eclipse) | degradado plano en 2–3 bandas (sin degradado continuo) | cálida | sol bajo ≤ 1,8 | igual |

Implementación recomendada: `comicScene(scene, perfil)` o `scene.userData.comicLook = 'noche'` antes de la conversión; los capítulos ya saben si son de noche (`NIGHT_CHAPTERS = [2, 4, 7]` en `main.ts`). **No** usar el fondo azul fijo si la escena tiene cúpula de cielo propia: se sustituye la cúpula por su versión de tebeo del perfil.

Además:
- **Cambio de luz dentro de una misma escena.** Hoy `mood` (`applyLook(n, paint, mood)`, `main.ts`) solo cambia el etalonaje del postproceso, que en cómic no se dibuja. Ejemplo: en el cap. 4, Barajas (x ≈ 290–302) es "de día" solo por eso (`level3.ts:564-566`). Hace falta un enganche de `mood` que cambie hemisférica, sol, niebla y cielo del perfil en el momento.
- **Las escenas que oscurecen a propósito** (cap. 4, buscar a Azul con el flash: `setDark`, `level3.ts:1862-1867`) bajan su hemisférica y su sol, pero no conocen la hemisférica que añade el cómic: no se oscurece y el juego deja de funcionar. Guardar esa luz en `scene.userData` para que los niveles la puedan modular.
- **Orden de llamadas:** fijar la intensidad final de la luz del cómic independientemente de si `applyEnvironment` corre antes o después. Hoy varía de escena en escena: en las escenas del constructor la hemisférica del cómic queda ×0,55 o ×0,35, y en las que se montan a mitad de capítulo (cala de las ranas del cap. 5, taxi `camiFarola.ts:879-884`, casa de Azul `levelSantJoan.ts:1447`, escenas del eclipse `levelEclipse.ts:617/821/845/919`) entra entera a 1,35. La referencia del cap. 1 es hemisférica del pueblo 1,0 + cómic 1,35, ambas ×0,35: replicar ese **resultado** (≈0,35 + 0,47) en cada perfil de día, sin depender del orden.
- **Puntos de luz que de noche son la iluminación** (ventanas encendidas, farolas de Sa Farola, faroles de calle): hoy se ocultan (rama de halos). De noche son imprescindibles: versión de tebeo (ventana = rectángulo amarillo plano con marco de tinta; farola = bombilla con aro y un halo de 1–2 anillos planos).
- **El cielo físico** (`SkyMesh`) solo lo evita el cap. 1 a mano (`ferreries.ts:359`); en la moto, la playa y el parque sale y "sale morado". Que `Sky` ignore `physical` cuando `comic.on`.

### D2 · Las texturas de superficie (el decorado de `toon()` / `Merger`)
Casi todo el decorado de los capítulos 2–8 se construye con `Merger` + `toon()`, y su dibujo de superficie (encalado, teja, marès, piedra seca, asfalto, arena, adoquín, hierba, madera…) es el sombreador triplanar de `addGrain`, que el cómic tira. Sin arreglo, esos capítulos quedan de colores lisos y no se parecen al 1, que tiene dibujo en suelos y paredes.

**Hacer:** una versión **de tebeo** de esas texturas de superficie, con la misma técnica que `comicTiles.ts` (piezas de color plano, bisel de luz arriba, sombra abajo, junta de tinta `rgba(52,38,30,0.92)`), **una por cada tipo de `Surf`** (`core/surfaces.ts`: Plaster, Roof, Mares, Stone, Asphalt, Wood, Foliage, Grass, Louvre, Paving, Terracotta, Sand, Cobble, DryStone, Bark, Metal…). Reutilizar los dibujos que ya existen donde coincidan (Plaster→`wash`, Roof→`roof`, Mares→`mares`, Paving→`slabs`, Wood→`wood`). En `toToon`, si el material trae `userData.grain`, añadir un `onBeforeCompile` que proyecte esa textura de tebeo en triplanar (como hace `addGrain`, con el atributo `surf` de `Merger` o `userData.surf`) y la multiplique por el color. **Misma escala de pieza** que en el capítulo 1, para que las piezas tengan el mismo tamaño en pantalla en todo el juego. Medidas del capítulo 1 (metros que ocupa una repetición de la textura, `tile` en `hd/builder.ts`; cada dibujo de `comicTiles.ts` es de 512 px):

| Dibujo | Repetición en el cap. 1 | Pieza resultante |
|---|---|---|
| `slabs` (suelo) | 3,2 m (`FerreriesHD.ground`) | 6 hileras → losas de ~0,53 m de alto × 0,6–1 m |
| `mares` (sillares) | 1,5 m (casi siempre), 2–2,2 m en la iglesia | 11 hileras → sillares de ~0,14–0,2 m |
| `wash` (encalado) | 3 m (`wall`) | — |
| `roof` / `roofGrey` (teja) | 2 m | — |
| `wood` | 0,8–1,2 m | — |

En triplanar, la escala de cada `Surf` de tebeo debe dar estas mismas medidas.

Esto también cambia los objetos de `Merger` del capítulo 1 (hoy lisos): **validar con capturas antes/después del capítulo 1** y que el dueño lo apruebe. Si no lo aprueba, aplicar las superficies de tebeo solo a arquitectura y suelos (Plaster, Roof, Mares, Stone, DryStone, Paving, Cobble, Asphalt, Sand, Terracotta, Louvre, Grass) y dejar los objetos pequeños lisos, como en el capítulo 1.

### D3 · A mano alzada en el decorado de `Merger`
Para que las casas y muros de los otros capítulos se inclinen y comben como los del 1, su geometría tiene que estar subdividida. Cuando `comic.on`, en `Merger.add` (o al construir), usar cajas y planos subdivididos para piezas grandes (lado > 1 m), con el mismo criterio que `hd/builder.ts` (`segs()`). Las piezas compartidas por varias mallas no se doblan (`handDrawn` lo evita): no duplicar geometría solo para esto.

### D4 · Lo que no tiene luz (clase B)
Cada objeto de clase B del inventario necesita su versión de tebeo, con estas recetas comunes:
- **Brillos y halos** (puntos o sprites aditivos): de día, fuera (como en el cap. 1); de noche, **círculo de color plano con contorno de tinta** (como `comicBulbTexture`) y un halo de 1–2 anillos de color plano, nunca un degradado.
- **Agua** (mar, piscina): sombreador propio de tebeo: 2–3 bandas de color plano según la profundidad/ángulo, reflejos como trazos blancos cortos que se mueven, espuma como línea blanca con tinta en la orilla. Sin `Water` de three.js en cómic.
- **Cielo**: plano o en 2–3 bandas, nubes `comicCloudTextures()`; de noche, estrellas dibujadas y luna de tebeo.
- **Fuego, chispas, fuegos artificiales, confeti, purpurina**: formas planas con contorno (estrellas, gotas, rombos) en vez de puntos aditivos; colores de imprenta.
- **Pantallas, láseres, focos de escenario**: color plano saturado + tinta; los haces de luz como conos planos semitransparentes con borde marcado, sin degradado.
- **Texturas de lienzo con texto** (carteles, móviles, pantallas): pasar el texto a una fuente de tebeo, colores planos y borde de tinta, como los carteles del cap. 1.
- **Marcadores, columnas de luz, flechas** (la "columna de luz" sobre el objetivo, `core/beacon.ts`): versión plana con contorno.
- **Ojo: `userData.noComic` no protege `Points` ni `Sprite`** (la rama de brillos de `comicScene` va antes de esa comprobación). Para que `comicScene` no los toque, marcar antes `material.userData.comicGlow = true`.
- **Estrellas, luces de ciudad y puntos lejanos** escriben profundidad y la pasada de tinta los rodea: salen como puntos oscuros. Ponerles `depthWrite: false` (y a la cúpula del cielo).
- **Destello de pantalla** (`juice.fx.flashScreen`, vive en `post.ts`): en cómic no se dibuja. Añadir un uniforme de destello a la pasada de tebeo.
- **Fuegos artificiales:** hoy `comicScene` los toma por guirnalda de bombillas y, al apagarse, quedan discos negros colgados (caps. 1, 4, 9). Marcarlos `comicGlow` y hacer un estallido dibujado propio (líneas radiales y estrellas con tinta, que se apaga por tamaño o alfa, no por color).

### D5 · Lo instanciado (clase C)
`InstancedMesh` (coches aparcados, motos, árboles repetidos, multitud) se convierte de material pero **no** se dobla a mano alzada. Aceptable: es lo mismo en el capítulo 1.

### D6a · Arquitectura que no se dobla o con la textura equivocada
- `TownHD.wall` (`world/hd/townHD.ts:17-34`) usa **siempre** el encalado (`wash`) teñido, también en los edificios de piedra del cap. 6 (Catedral, campanario, Ajuntament, Sa Plaça d'es Bè): salen "encalados color marès" en vez de sillería. Darle a `wall` la opción de material `mares`.
- Las paredes hechas con `Merger` (casa de Azul, casa de Gas, cocina, `surround.ts`, el Ajuntament del cap. 1) no se comban como las de `Builder`: migrarlas a `Builder`/`TownHD` (mejor: textura dibujada + doblado igual que el cap. 1) o, como mínimo, subdividir (D3).

### D6b · Accesorios de los personajes
`comicScene` solo trata como persona (rampa clara, sin tinta interior) las `SkinnedMesh` y las instanciadas con `userData.person`. Los accesorios pegados a huesos (cascos, guitarra y sombrero de Fito, delantal de Tòfol, bombín de la fabiolera, maletas, estampados de camisetas) salen con sombra de decorado y tinta por dentro. Que `toToon` respete `userData.person` también en mallas normales y marcar esos accesorios.

### D6c · Vehículos
Coches y motos (`entities/vehiclesHD.ts`, `MeshPhysical` con barniz, cromo y metal) quedan planos en toon: pintar brillos (una franja blanca en cromados, viseras y cristales). Las piezas grandes que se mueven se doblan a mano alzada una sola vez en una posición cualquiera y viajan dobladas: marcar `userData.comicBent = true` (que pasen a toon pero no se doblen). Tubos de 1–2 cm parpadean: engordarlos en cómic como hace `builder.ts`.

### D6d · Sin UV en casi todo el decorado
`Merger.add` borra los UV (`models.ts:64`) y muchas geometrías propias (pistas, laderas, asfalto) no los tienen: no se puede poner una loseta dibujada por UV. Por eso D2 se hace **en coordenadas del mundo (triplanar)**, como ya hace `addGrain`.

### D6e · Paneles 2D
El estilo de tebeo de la interfaz (`.comic-mode` en `ui/style.css`) solo cubre `.bark`, `.dialogue` y `.toast`. Todo lo demás necesita su versión de tebeo: minijuego de ritmo, marco de grabación del móvil, urinario, cabinas de las gafas, medidor de la bandeja, mochila, flecha del viento, calibres, contador de la cala, chats del móvil (`phoneChat`), app de vuelos, cartas de Love Letter, crucigrama, álbum. Mismos colores de imprenta, borde de tinta, letra de tebeo.

### D6f · Líneas de velocidad
Salen cuando la cámara va a más de ~5 m/s (`comic.ts:634`). En la moto (14 m/s) y en el coche salen **todo el viaje**. Decidir con el dueño: dejarlas, o limitarlas a acelerones, adelantamientos y golpes.

### D7 · Calidad baja y móvil
Comprobar que el cómic funciona con `quality.kind` = `phong` y `lambert` (dispositivos que no pintan bien el PBR) y con `?lite`. `drawnMap` hace trabajo de CPU al cargar cada textura (desenfoques de 512×512): medir el tiempo de carga de cada capítulo y, si se pasa de ~1 s extra en el móvil, pregenerar los dibujos al compilar o reducir a 256.

---

## 4. Herramientas y forma de trabajar

- **Vista previa:** `?hq&estilo=comic#test`. `__dbg.go(n)`, `__dbg.phase('…')`, `__dbg.skip()`, `__dbg.shot()`, `__dbg.keepAlive(true)` (ver `README.md`, "Modo prueba").
- **Capturas comparables:** colocar la cámara en el mismo sitio en el cap. 1 y en el capítulo migrado (sustituir `camera.updateMatrixWorld` para fijar posición y objetivo; técnica en `docs/PLAN-personajes.md`, sección 2) y comparar a la par: grosor de tinta, tamaño de las piezas dibujadas, saturación, color del papel, rampa de tres tonos.
- **Lista de comprobación de cada capítulo** (todas las fases del capítulo, no solo el principio):
  1. Ningún material con luz que no sea `MeshToonMaterial` (consulta en consola: recorrer la escena y listar `material.type`).
  2. Ningún `Points`/`Sprite`/`ShaderMaterial` sin versión de tebeo, salvo los marcados `noComic` a propósito.
  3. Ningún degradado continuo visible (cielo, agua, halos).
  4. Tinta en todas las aristas de la arquitectura; nada "a regla" que en el cap. 1 esté a mano alzada.
  5. Piezas dibujadas (losas, tejas, sillares) del mismo tamaño en pantalla que en el cap. 1.
  6. Luz del perfil correcto (día, noche, interior, atardecer) en cada fase.
  7. fps ≥ 30 en el móvil y tiempo de carga razonable.
- **Al terminar un capítulo:** añadirlo a `COMIC_CHAPTERS` (y quitarlo de los del estilo pintado), compilar (`npx tsc --noEmit`, `npm run build`), capturas de todas las fases, aprobación del dueño, commit local.

---

## 5. Orden de trabajo

| # | Paso | Por qué en este orden |
|---|---|---|
| F0 | Infraestructura común: D1 (perfiles de luz), D2 (superficies de tebeo), D3 (subdivisión), recetas de D4 como funciones reutilizables, D6a–D6f, las trampas de la sección 5b y los defectos del propio cap. 1 (sección 1.3); prueba en el cap. 1 (que no cambie o que el dueño apruebe el cambio) | Todo lo demás depende de esto |
| F1 | Capítulo 6 (Sant Joan) | Ya comparte `townHD` con el 1: el más rápido; sirve para validar F0 |
| F2 | Capítulo 3 (ruta: carretera, cafeterías, terraza, camping de noche, Logroño) | Mucho decorado de `Merger` de día: valida D2/D3 a lo grande |
| F3 | Capítulo 5 (moto por la costa) | Día, carretera, mar: valida el agua de tebeo |
| F4 | Capítulo 2 (piscinita, noche) | Primera noche: valida D1 noche y la piscina |
| F5 | Capítulo 7 (cena, noche) | Noche e interior de casa |
| F6 | Capítulo 8 (eclipse: aparcamiento de noche, kayak, casa, rocas, atardecer y totalidad) | Varios perfiles en un capítulo; el eclipse necesita diseño propio |
| F7 | Capítulo 4 (aeropuerto de interior + concierto de noche) | El más difícil: interior, escenario, pantallas, láseres, multitud enorme |
| F8 | Carta final (`letterScene.ts`) | Noche sobre el mar, fotos flotando, fuegos. **Hoy no pasa nunca por el cómic**: `startLetter` llama a `setHd(true, 2)` (`main.ts:331-342`) y no a `comicScene`. Darle su propio indicador. Decidir con el dueño si las fotos reales se quedan como fotos (recomendado: sí, con marco de polaroid dibujado) |
| F9 | Capítulo 9: misiones de playa y parque | Ya es cómic, pero revisar que las misiones no se queden atrás |
| F10 | Repaso global: los 9 capítulos seguidos con las mismas capturas; quitar el estilo pintado si ya no lo usa nadie | Coherencia final |

---

## 5b. Trampas del sistema de cómic que hay que arreglar en F0
Encontradas al inventariar; afectan a varios capítulos (detalle y líneas en los inventarios de la sección 7):

| Trampa | Dónde | Efecto | Arreglo |
|---|---|---|---|
| Se congela el desplazamiento de las texturas animadas | `drawnMap`/`withRepeat` copian el `offset` a una textura nueva (`comic.ts:170, 233-240`) | Cap. 3: las líneas de la carretera y el suelo viajan con el coche (no hay sensación de avance). Cap. 2: las cáusticas de la piscina quedan quietas | Que la textura dibujada comparta `offset` con la original, o que el nivel anime `mesh.material.map` |
| `drawnMap` baja el contraste al 45 % | `comic.ts:151-154` | Líneas de la carretera, rayas de toldos, grava, baldosas y cáusticas se apagan | Dibujos a mano (`userData.comic`) para esas texturas de lienzo |
| El doblado se acumula en geometría compartida que aparece de una en una | `handDrawn` cuenta usuarios en cada pasada (`comic.ts:364-375`); obstáculos del cap. 3 (`level2.ts:817`) | Cada coche o tractor que está solo en escena vuelve a doblar la misma geometría (~10 cm más cada vez) | Marcar `geometry.userData.comicBent`/`mesh.userData.comicBent` al crearlos |
| Lo que se mueve se dobla una vez donde esté | `comic.ts:371-389` | Coches, taxi, kayak, ferry, remos, hojas de puertas, vaca: quedan torcidos | `userData.comicBent = true` |
| Muebles doblados con cosas encima sin doblar | `handOffset` a ~0,76 m mueve ~7 cm | Platos, copas, zamburiñas, plancha, farolillo descolocados | Marcar esos muebles `comicBent`, o doblar también lo de encima |
| Halos que se crean durante el juego | La pasada de cómic corre cada 1 s (`main.ts:727`) | Salen al 100 % y al poco bajan al 40 %: parpadeo | Convertir al crear (o crear ya en versión de tebeo) |
| Opacidades que el nivel reescribe cada fotograma | Luciérnagas, brillo de la zamburiña | El ×0,4 del cómic se pierde | Recetas de brillo propias (D4) |
| Ventanas y luces "encendidas" hechas con colores de `Merger` | Varias (cap. 2, 3, 6, 7, 8) | En tres tonos quedan sombreadas: de noche no brillan | Emisivo, o `MeshBasic` + tinta |
| Transparentes sin profundidad encima de personajes | Agua de la piscina, mosaico de censura (cap. 2), copas | La tinta de lo de debajo se pinta encima y se pierde la marca de personaje | Contorno propio o `depthWrite` según el caso |
| El nivel reescribe la intensidad del sol cada fotograma | `level2.ts:896` | Se anula el tope de 2,1 del cómic | Respetar el tope en el nivel (o aplicarlo en el perfil, D1) |
| Escala de las losas distinta | Laurel (`laurel.ts:55`, 2 m) frente a 3,2 m en el cap. 1 | Losas más pequeñas | Misma escala que el cap. 1 (tabla de D2) |

## 6. Riesgos conocidos
- Cambiar `comicScene` (D1, D2) afecta al capítulo 1: siempre capturas antes/después del 1.
- `drawnMap` lee las imágenes con canvas: texturas de otro origen sin CORS o aún sin cargar quedan en color medio hasta la siguiente pasada (`settlePending`). Comprobar que todas acaban dibujadas.
- Las escenas que cambian de luz a mitad (Fito: Barajas de día → estadio de noche; eclipse: del día a la totalidad) necesitan cambiar el perfil en ese momento, no solo al cargar.
- `userData.noComic` hoy lo llevan los personajes VRM (para conservar MToon). No quitarlo.
- **Efectos que hoy solo existen en el postproceso** y se pierden en cómic: destello de pantalla (`flashScreen`), desenfoque de los diálogos (`cinema.focus`), bloom de lo emisivo. Decidir su versión de tebeo (el destello, en la pasada de tinta; el desenfoque de diálogo, sustituirlo por bandas negras y acercamiento, que ya existen; el brillo, con D4).
- La pasada de tinta usa la profundidad: objetos sin escritura de profundidad (transparentes, `depthWrite: false`) no tienen tinta; darles contorno propio si deben tenerlo.

---

## 7. Inventario objeto por objeto
Los inventarios completos, objeto por objeto, están en archivos aparte (uno por grupo de capítulos), generados leyendo el código el 9-nov-2026. Cada fila tiene: objeto, archivo:línea, cómo se construye, material, textura, **clase** y qué hacer:
- **A** = la conversión automática basta (comprobar en captura).
- **B** = no se convierte (material sin luz, sombreador propio, puntos, sprite, línea): hace falta su versión de tebeo a mano.
- **C** = se convierte pero hay que cuidarlo (instanciado, emisivo, transparente, poco subdividido, foto sin dibujo a mano, noche, se mueve).

| Archivo | Capítulos | Contenido |
|---|---|---|
| [`estilo-comic/inventario-cap1-cap9.md`](estilo-comic/inventario-cap1-cap9.md) | 1 y 9 (referencia), misiones de playa y parque | Receta exacta del cap. 1 y sus defectos; inventario de Ferreries; playa y parque |
| [`estilo-comic/inventario-cap2-cap3.md`](estilo-comic/inventario-cap2-cap3.md) | 2 (piscinita) y 3 (ruta) | Born, calle de casa, casa y piscina, cielo de noche; carretera, restaurantes, San Vicente, plancha, Logroño, camping, terraza, Laurel |
| [`estilo-comic/inventario-cap4-cap5.md`](estilo-comic/inventario-cap4-cap5.md) | 4 (Fito) y 5 (moto) | Barajas, estadio, escenario, efectos; carretera de la costa, faro, vehículos, cala de las ranas; paneles 2D |
| [`estilo-comic/inventario-cap6-cap8-carta.md`](estilo-comic/inventario-cap6-cap8-carta.md) | 6 (Sant Joan), 7 (cena), 8 (eclipse) y carta final | Born, Ses Voltes, caballos, taxi; Sa Farola, casa, cocina; aparcamiento, kayak, casa de Gas, rocas, eclipse; carta |

**Cómo usarlos:** al empezar un capítulo, copiar sus tablas a un archivo de trabajo (`docs/estilo-comic/progreso-capN.md`) con una columna "Hecho" y otra "Captura", e ir marcando. Si al recorrer el capítulo aparece algo que no está en la tabla, añadirlo. El capítulo no se da por terminado mientras quede una fila sin marcar.

