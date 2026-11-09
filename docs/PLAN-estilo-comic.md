# Plan: el juego entero en estilo cómic

Documento para otra IA (o persona) que vaya a dejar **todos** los capítulos con el aspecto del capítulo 1 (Ferreries, el "Jaleo d'ases"). Está escrito para trabajar sin más contexto.

- La sección 7 es el **inventario objeto por objeto** de cada capítulo. Es la lista de comprobación: no se da un capítulo por terminado hasta que todas sus filas estén hechas.
- La sección 8 dice **qué está hecho ya** (base común, limpieza y capítulo 2) y qué falta.

> Fecha de corte: 9 de noviembre de 2026. Ver también `docs/PLAN-personajes.md` (personajes) y `docs/REVISION-animaciones.md` (animaciones). **Este plan no toca personajes**, solo el entorno.

---

## 0. Decisión, objetivo y reglas

**Decisión del dueño (9-nov-2026): el cómic es el único estilo del juego.**
- **No hay interruptor.** Se ha borrado todo lo que solo existía para otros estilos: estilo "pintado", postproceso de cine, fotos de materiales, cielos HDRI, cielo físico, grano fotográfico, `?estilo=…`, `COMIC_CHAPTERS` y `comic.on`. El detalle está en la sección 3b.
- Todo lo que se construya se construye **para el cómic**. Prohibido volver a meter ramas del tipo "si no es cómic…" o un segundo estilo.

**Objetivo:** que todos los capítulos (1 a 9, misiones y carta final) se vean **exactamente** como el capítulo 1:
- mismo sombreado en tres tonos y misma tinta;
- mismas texturas dibujadas a mano, mismo cielo de tebeo y mismas nubes;
- mismo papel, mismas onomatopeyas y líneas de acción, misma interfaz de tebeo.

Coherencia total: si alguien ve dos capítulos seguidos, tiene que parecer el mismo dibujante.

**Consecuencia de quitar el interruptor:** todos los capítulos se ven ya en cómic.
- Los migrados (1 y 2) se ven bien.
- Los demás se ven con la conversión automática (sección 2) hasta que les toque su fase.
- Los capítulos se abren por fecha. Si se publica a mitad de la migración, **cada capítulo tiene que estar migrado antes de su día**:

| Cap. | Se abre | Cap. | Se abre |
|---|---|---|---|
| 1 Jaleo d'ases | 20-nov | 6 Sant Joan | 25-nov |
| 2 La piscinita | 21-nov | 7 Cena a escondidas | 26-nov |
| 3 Ruta de las zamburiñas | 22-nov | 8 El eclipse | 27-nov |
| 4 Fito | 23-nov | 9 Un año después | 28-nov (cumpleaños) |
| 5 MotoTrip4life | 24-nov | Carta final | al terminar el 9 |

(Calendario en `ui/ui.ts`: `BIRTHDAY` y `openDay`. En modo prueba, `#test`, todo está abierto.)

**Reglas:**
1. **El capítulo 1 es la referencia.** Un cambio común que le afecte (p. ej. las superficies dibujadas del decorado de `Merger`) se comprueba con capturas antes/después del capítulo 1, que se enseñan al dueño.
2. **Ni un objeto sin migrar.** Cada objeto de la sección 7 tiene una fila; se marca cuando está hecho y comprobado en captura. Lo que no esté en la lista y se encuentre, se añade a la lista.
3. **Un capítulo cada vez, en el orden del calendario** (sección 5), con capturas de todas sus fases y aprobación del dueño antes de pasar al siguiente.
4. **Publicar** = copiar `dist/` al repo `marcmnc7/pm-2611`. Solo con permiso del dueño y después de:
   - `npx tsc --noEmit` y `npm run build` sin errores;
   - recorrer en `#test` los 9 capítulos y la carta sin errores en la consola.
   Commits locales; push solo cuando el dueño lo diga.
5. **Rendimiento en móvil.** Medir fps y tiempo de carga de cada capítulo en el móvil del dueño o, como mínimo, con la CPU ralentizada ×4 en Chrome.
6. Hablar con el dueño **en español**.

---

## 1. Cómo funciona el cómic (después de la limpieza)

### 1.1 Activación y luz
- Siempre activo:
  - `main.ts` dibuja cada fotograma con `drawComic` (`core/comic.ts`) y pasa cada escena por `comicScene`;
  - se convierte al montar el capítulo, en `stage.onStart` para las misiones, en la carta y, cada segundo, lo que se añade después.
- **Perfil de luz** (D1): `comic.look` = `'dia' | 'noche' | 'interior' | 'atardecer'`.
  - Lo fija `setLook(n)` en `main.ts` con la tabla `LOOKS` (capítulo → perfil).
  - Una escena puede pedir otro con `scene.userData.comicLook`.
  - Si un capítulo cambia de luz a mitad (`level.mood`), `main.ts` llama a `comicMood(escena, perfil)`.
- `drawComic`:
  - dibuja la escena en un render target y una pasada a pantalla completa añade **tinta**: siluetas y aristas sacadas de la profundidad, con trazo que ondula y cambia de grosor;
  - también aplica **color de imprenta** (saturación ×1,18), **papel** (crema `×(1, 0.978, 0.93)`), **líneas de acción** (al ir a más de ~5 m/s de cámara o en un golpe, `comicBurst`) y el **destello** de pantalla (`comicFlash`, lo usa `juice`).
- Tono: `ACESFilmic`, exposición 0,95.
- La interfaz lleva siempre la clase `comic-mode` en `<html>`: bocadillos, cartuchos y avisos dibujados.
- `juice.onWord` pone onomatopeyas de tebeo (`comicWord`) en cada golpe o acierto.
- Nubes: el `Sky` de `core/gfx.ts` usa siempre `comicCloudTextures()`.

### 1.2 `comicScene(escena)`: lo que se convierte solo
1. **Materiales con luz** (`MeshStandard`, `MeshLambert`, `MeshPhong`) pasan a `MeshToonMaterial` con rampa de 3 tonos (decorado `[90, 170, 255]`; personajes `[188, 228, 255]`).
   - **Textura repetida con `userData.comic`** (`slabs`, `mares`, `roof`, `roofGrey`, `wash`, `wood`, `doors`): son los materiales de `world/hd/materials.ts`, que ya nacen con el **dibujo hecho a mano** de `core/comicTiles.ts` (ya no hay fotos).
   - **Otra textura repetida** (lienzos de baldosas, grava…) se pasa a dibujo automáticamente (`drawnMap`): color aplanado y tinta en las juntas.
   - **Textura suelta** (carteles, pancartas): se queda.
   - **Superficies del decorado de `toon()` / `Merger`** (`userData.grain`): llevan el **dibujo de tebeo triplanar** de su tipo de superficie (`Surf`), que sustituye al antiguo grano fotográfico. Ver D2: `core/comicSurfaces.ts`.
   - **Colores que brillan por sí solos** (`Surf.Glow`: ventanas encendidas, faroles, luz del garaje): de noche se pintan sin sombra, a su color pleno.
   - Otros sombreadores propios (animación de la multitud, ropa) se conservan.
2. **Materiales sin luz** (`MeshBasic`, `ShaderMaterial`, `Points`, `Sprite`, `Line`): no se tocan, salvo los brillos (punto 6).
3. **A mano alzada** (`handDrawn`): las mallas grandes (radio ≥ 0,8 m), estáticas, no instanciadas, sin piel y con geometría de uso único se deforman con un campo suave del mundo: paredes que se inclinan y comban, tejados que ceden, cornisas que ondulan.
   - Necesita geometría subdividida. `world/hd/builder.ts` siempre parte las caras.
   - `Merger.add` parte las piezas de 1 a 40 m (D3).
   - `userData.comicBent = true` en una malla la deja sin doblar (ya convertida o que se mueve).
4. **Cielo y luz según el perfil** (D1):
   - Se limitan las direccionales: día ≤ 2,1, noche ≤ 1,0.
   - Se añade una `HemisphereLight` propia del cómic, con **intensidad final fija** que no depende del orden de llamadas. Se guarda en `scene.userData.comicHemi` para que los niveles la puedan modular, como en `setDark` del cap. 4.
   - Las hemisféricas propias de la escena se multiplican **una vez** por `scene.userData.hemiScale` (0,35 en Ferreries; 0,55 por defecto) en `applyShadows`. Este es el "ambiente" que antes venía del HDRI.
5. `userData.noComic = true` en una malla la deja fuera de la conversión (personajes VRM con MToon). **No protege `Points` ni `Sprite`**: para esos, `material.userData.comicGlow = true`.
6. **Brillos (puntos y sprites aditivos):**
   - **Guirnaldas** (`Points` con mapa, color por vértice, tamaño ≥ 0,6 y ≥ 100 puntos): bombilla de tebeo (`comicBulbTexture`).
   - **De día:** los demás puntos grandes se ocultan; los pequeños, al 40 %.
   - **De noche:** se dibujan como **luz de tebeo**: núcleo blanco con aro de tinta y uno o dos anillos planos del color de la luz (`comicHaloTexture`), sin mezcla aditiva. Así las farolas y ventanas encendidas se ven.

### 1.3 Lo que es propio del capítulo 1 (receta de referencia)
| Aspecto | Qué hace | Dónde |
|---|---|---|
| Perfil | `dia` | `main.ts` (`LOOKS`) |
| Tono | ACES, exposición 0,95, aplicado dentro de la pasada de tebeo | `main.ts` (`setLook`); `comic.ts` |
| Pasada de dibujo | Tinta por profundidad (silueta y aristas), personas marcadas en alfa 0,5 (solo silueta), color de imprenta, papel crema, líneas de acción, destello | `comic.ts` (`PASS_FRAG`, `drawComic`) |
| Sin tinta | Lo que no escribe profundidad (`depthWrite: false`): cúpula, nubes, aros, red, vasos de la barra, sombras falsas | `comic.ts` |
| Materiales | Rampa de 3 tonos; se conservan emisivo, transparencia, caras, `depthWrite`, `polygonOffset`, color por vértice y niebla | `comic.ts` (`toToon`) |
| Texturas dibujadas | `hd/materials.ts` usa directamente los dibujos: `slabs`, `mares` (también `maresDark`), `roof`, `wash` (encalado y estuco), `wood`, `doors` | `materials.ts`; `comicTiles.ts` |
| Geometría | `Builder` parte las caras cada ~0,6 m y engorda lo fino (marcos, barrotes, postes); los piñones (`gable`) **no** se parten. `handDrawn` dobla lo grande, fijo y no compartido | `builder.ts`; `comic.ts` |
| Constructores | `FerreriesHD` (casas, barras, suelo, iglesia) + `Merger` (color por vértice, con superficie dibujada triplanar) + `toon()` + lienzos de `deco.ts` | `hd/ferreriesHD.ts`; `entities/models.ts`; `world/deco.ts` |
| Cielo y niebla | `Sky` (0x2a6fd0 / 0x7fbdf2 / 0xf6ead2) + nubes de tebeo (25 m más altas, al 60 %) + halo aditivo del sol; niebla 0xcfe0ee 70–180 m | `ferreries.ts`; `gfx.ts` (`Sky`); `comicTiles.ts` |
| Luz y hora | 11:00 (`MORNING_DIR`); hemisférica del pueblo 1,0 × `hemiScale` 0,35; hemisférica del cómic 0,47; sol 3,4 limitado a 2,1; sombras activas | `ferreries.ts`; `comic.ts` (`LOOK_LIGHT`) |
| Personajes | VRM de Azul con `noComic` (MToon); ropa de los rigs lisa; multitud marcada como persona | `vrm.ts`; `rig.ts`; `crowdRig.ts` |

**Defectos que el cap. 1 todavía tiene** (pendientes; no se copian a otros capítulos):
- fuegos artificiales que se apagan en negro;
- el Ajuntament hecho con cajas de `Merger`: ahora lleva superficie dibujada, pero no los sillares del `Builder`;
- piñones, chapitel y campana sin subdividir;
- persianas con degradado casi fotográfico (`shutterMat`);
- carteles y rótulos en `MeshBasic` (sin luz);
- vasos casi invisibles y sin tinta;
- partículas y emojis (💕, 💦, ❗) con degradados o con el emoji del sistema.

Las misiones del cap. 9 (playa y parque) ya no usan el cielo físico, pero el mar es el de tebeo genérico: revisar en F8.

---

## 2. Estado de partida de cada capítulo sin migrar

Capturas del 8-nov-2026 de cada capítulo pasado a cómic con la conversión automática. Desde la limpieza es lo que se ve en los capítulos que aún no tienen su fase hecha.

| Cap. | Resultado | Problemas a la vista |
|---|---|---|
| 1 | Referencia: losas y casas dibujadas, tinta, papel | Defectos de 1.3 |
| 2 | **Migrado** (sección 8) | — |
| 3 | Carretera, arena, edificios | Antes, color liso; con D2 ya llevan dibujo. Falta: carretera que no avanza (5b), líneas de acción todo el viaje (D6f), sub-escenas de noche (camping, Laurel) con perfil `noche` |
| 4 | Pasillo del aeropuerto | Interior lavado a blanco (perfil `interior`). Barajas está en la misma escena de noche que el estadio: su "día" se hace con `level.mood = 'day'` → `comicMood` (D1) |
| 5 | Moto por la costa | Mar de tebeo genérico; revisar bandas y espuma de la costa |
| 6 | Born de Ciutadella | **El más cercano**: usa `townHD` con las losas y fachadas dibujadas del cap. 1. Falta repasar árboles, bancos y carteles |
| 7 | Sa Farola de noche | Perfil `noche`; halos de farolas y estrellas con las recetas nuevas: comprobar |
| 8 | Aparcamiento de noche, kayak, eclipse | Varios perfiles; el eclipse necesita diseño propio |
| 9 | Cómic (Ferreries) | Revisar las misiones de la playa y el parque (sección 7) |

---

## 3. Decisiones técnicas

### D1 · Perfiles de luz (hecho en F0)
| Perfil | Fondo / cielo | Hemisférica del cómic | Sol / luna | Uso |
|---|---|---|---|---|
| `dia` (cap. 1) | cúpula pintada de la escena + nubes de tebeo; `background` azul plano detrás | `(0xdff2ff, 0xb59c84)` a 0,47 (resultado exacto del cap. 1) | ≤ 2,1 | caps. 1, 3, 5, 6, 9; Barajas |
| `noche` | la cúpula de la escena, aclarada a azul ultramar si es casi negra (`Sky`); estrellas sin escribir profundidad | `(0x9fb4ff, 0x3a2f4a)` a 0,55 | luna ≤ 1,0 | caps. 2, 4 (estadio), 7; camping y Laurel del 3 |
| `interior` | el del interior | `(0xfff4e6, 0x8a7a6a)` a 0,9 | ≤ 1,4 | pasillo del aeropuerto, casas por dentro |
| `atardecer` | la cúpula de la escena | `(0xffd2a8, 0x6a4a5a)` a 0,55 | ≤ 1,8 | eclipse |

Valores en `LOOK_LIGHT` (`core/comic.ts`). Se ajustan con capturas al migrar cada capítulo; si se cambian los de `dia`, cambia el cap. 1.

**Queda por hacer en los capítulos:**
- Las escenas que se montan a mitad de capítulo y son de otra hora deben poner `scene.userData.comicLook`. Ejemplos: camping y Laurel del cap. 3 (`level2.ts`), taxi (`camiFarola.ts`), casa de Azul (`levelSantJoan.ts`), escenas del eclipse (`levelEclipse.ts`).
- **Las escenas que oscurecen a propósito** (cap. 4, buscar a Azul con el flash: `setDark` en `level3.ts`) tienen que bajar también `scene.userData.comicHemi`.

### D2 · Superficies dibujadas del decorado (hecho en F0)
`core/comicSurfaces.ts`:
- Una textura por capas con un dibujo de tebeo por cada `Surf`: encalado, teja, sillares de marès, piedra, asfalto, madera, hierba, persiana, losas, baldosa de barro, arena, adoquín, piedra seca y corteza.
- Misma técnica que `comicTiles.ts`: piezas de color plano, bisel de luz arriba, sombra abajo y junta de tinta.
- `toToon` la proyecta en **triplanar** (coordenadas del mundo, porque `Merger` no tiene UV) en todo material hecho con `toon()`. La multiplica por el color normalizada a su color medio, así que **respeta el color elegido**.
- `Foliage` se queda liso, como las copas del cap. 1.
- `Glow` y `Metal` no llevan dibujo. `Glass` tampoco.

**Escala de las piezas: la misma que en el capítulo 1** (metros que ocupa una repetición, en `SCALE`):

| Dibujo | Repetición | Pieza resultante |
|---|---|---|
| losas (`Paving`) | 3,2 m (como `FerreriesHD.ground`) | losas de ~0,53 m de alto × 0,6–1 m |
| sillares (`Mares`) | 1,5 m | sillares de ~0,14 m |
| encalado (`Plaster`) | 3 m | — |
| teja (`Roof`) | 2 m | — |
| madera (`Wood`) | 1 m | — |

Al migrar cada capítulo, comprobar en capturas que cada superficie sale con el dibujo correcto. La superficie sale de `surfaceFor(color)` en `core/surfaces.ts`; si un color cae en el tipo equivocado, se fija con `setSurface(color, Surf.X)`.

### D3 · A mano alzada en el decorado de `Merger` (hecho en F0)
- `Merger.add` subdivide los triángulos de las piezas de 1 a 40 m (aristas de más de ~0,9 m; como mucho 12 trozos por lado), salvo los que están a ras de suelo, para que `handDrawn` las doble como las de `Builder`.
- Lo de más de 40 m (lomas, terreno, mar) no se subdivide: no se notaría y dispararía los triángulos.

### D4 · Lo que no tiene luz (clase B)
Recetas comunes (las que ya existen como función están marcadas):
- **Brillos y halos** de noche: `comicHaloTexture()` (automático en `comicScene`). De día, fuera.
- **Agua** (mar, piscina): `makeSea` hace siempre **agua de tebeo** (`comicWaterMaterial` en `gfx.ts`):
  - dos o tres bandas de color plano según el ángulo;
  - reflejos como trazos blancos cortos que se mueven a saltos;
  - en la piscina, crestas de las ondas de la malla en blanco.
  Ya no existe el `Water` de three.js.
- **Cielo:** la cúpula de cada escena + nubes de tebeo. De noche, la cúpula se aclara a azul ultramar y las estrellas no escriben profundidad (si no, la tinta las rodeaba de negro).
- **Luna, estrellas sueltas, estrellas fugaces:** disco o estrella plana con contorno de tinta (`comicMoonTexture`, `comicStarTexture`).
- **Fuego, chispas, fuegos artificiales, confeti, purpurina:** formas planas con contorno (estrellas, gotas, rombos) en vez de puntos aditivos; colores de imprenta.
  - Los fuegos artificiales hoy se apagan oscureciendo el color y quedan discos negros (caps. 1, 4, 9). Marcarlos `comicGlow` y que se apaguen por tamaño o alfa.
- **Pantallas, láseres, focos de escenario:** color plano saturado + tinta. Los haces de luz, como conos planos semitransparentes con borde marcado, sin degradado.
- **Texturas de lienzo con texto** (carteles, móviles, pantallas): fuente de tebeo, colores planos y borde de tinta, como los carteles del cap. 1.
- **Marcadores, flechas:** versión plana con contorno.
- **Destello de pantalla:** `comicFlash` (hecho; `juice` ya lo usa).

### D5 · Lo instanciado (clase C)
`InstancedMesh` (coches aparcados, motos, árboles repetidos, multitud) se convierte de material pero **no** se dobla a mano alzada. Es igual en el capítulo 1.

### D6a · Arquitectura que no se dobla o con la textura equivocada
- `TownHD.wall` (`world/hd/townHD.ts`) usa **siempre** el encalado (`wash`) teñido, también en los edificios de piedra del cap. 6 (Catedral, campanario, Ajuntament, Sa Plaça d'es Bè): salen "encalados color marès" en vez de sillería. Darle a `wall` la opción de material `mares`.
- Las paredes hechas con `Merger` ya se comban (D3) y llevan dibujo (D2).

### D6b · Accesorios de los personajes
`comicScene` solo trata como persona (rampa clara, sin tinta interior) las `SkinnedMesh` y las instanciadas con `userData.person`.
- Los accesorios pegados a huesos salen con sombra de decorado y tinta por dentro: cascos, guitarra y sombrero de Fito, delantal de Tòfol, bombín de la fabiolera, maletas, estampados de camisetas.
- Arreglo: que `toToon` respete `userData.person` también en mallas normales, y marcar esos accesorios.

### D6c · Vehículos
Coches y motos (`entities/vehiclesHD.ts`, con barniz, cromo y metal) quedan planos en toon.
- Pintar brillos: una franja blanca en cromados, viseras y cristales.
- Las piezas que se mueven llevan `userData.comicBent = true` (en el cap. 2 ya lo llevan los coches).
- Tubos de 1–2 cm parpadean: engordarlos como hace `builder.ts`.

### D6d · Sin UV en casi todo el decorado
`Merger.add` borra los UV y muchas geometrías propias (pistas, laderas, asfalto) no los tienen. Por eso D2 es triplanar.

### D6e · Paneles 2D
El estilo de tebeo de la interfaz (`.comic-mode` en `ui/style.css`) solo cubre `.bark`, `.dialogue` y `.toast`. Todo lo demás necesita su versión de tebeo (mismos colores de imprenta, borde de tinta, letra de tebeo):
- minijuego de ritmo, marco de grabación del móvil, urinario, cabinas de las gafas, medidor de la bandeja;
- mochila, flecha del viento, calibres, contador de la cala;
- chats del móvil (`phoneChat`), app de vuelos, cartas de Love Letter, crucigrama, álbum.

### D6f · Líneas de velocidad
Salen cuando la cámara va a más de ~5 m/s (`drawComic`). En la moto y en el coche salen **todo el viaje**. Decidir con el dueño: dejarlas, o limitarlas a acelerones, adelantamientos y golpes.

### D7 · Calidad baja y móvil
- Ya no hay "modo seguro" de materiales (todo acaba en `MeshToon`). La autocomprobación de arranque solo decide si hay sombras.
- `drawnMap` y `comicSurfaces` hacen trabajo de CPU al cargar. Medir el tiempo de carga de cada capítulo; si se pasa de ~1 s extra en el móvil, pregenerar al compilar o bajar a 256 px.

---

## 3b. Limpieza (F0a, hecha): lo que se ha borrado

| Qué | Dónde estaba | Sustituto |
|---|---|---|
| Interruptor `?estilo=…`, `COMIC_CHAPTERS`, `PAINT_CHAPTERS`, `comic.on`, `HD_CHAPTERS`, `HD_DAY_CHAPTERS` | `main.ts`, `comic.ts` y todos los `if (comic.on)` | Cómic siempre; `LOOKS` (perfil por capítulo) |
| Estilo pintado: `core/paint.ts`, `paintStyle`, `paintScene`, `paintPalette`, `PAINT_LIGHT`, `paintGrade`, nubes de acuarela, noche "Ghibli" | `paint.ts`, `main.ts`, `gfx.ts`, `ferreries.ts` | — (la noche ultramar pasa al `Sky` siempre) |
| Postproceso de cine: `core/post.ts` (oclusión ambiental, profundidad de campo en los diálogos, bloom, etalonaje `GRADES`, bandas de cine, aberración cromática, SMAA), dependencias `postprocessing` y `n8ao` | `post.ts`, `main.ts`, `package.json` | `drawComic`; destello con `comicFlash` |
| `applyLook` y su cambio de etalonaje por `mood` | `main.ts` | `comicMood` (D1) |
| Cielos HDRI (`quarry.hdr`, `venice_sunset.hdr`, `preloadHdri`, `hdEnvDefault`, `scene.userData.hdri`) y la luz de entorno PMREM | `main.ts`, `gfx.ts` (`applyEnvironment`), `assets.ts`, `ferreries.ts`, `levelEclipse.ts` | `scene.userData.hemiScale` (solo el reparto de la hemisférica, que es lo que se veía) |
| Cielo físico (`SkyMesh`, opción `physical`) | `gfx.ts`, `ferreries.ts`, `missions/park.ts` | La cúpula de degradado de cada escena |
| Grano y fotos de superficie (`addGrain` con su sombreador, `surfaceTexture`, `hdSurfaceTexture`, `hdSurfaces`, `surf-photo.jpg`, `assets/pbr/*`) | `gfx.ts`, `surfaces.ts` | `core/comicSurfaces.ts` (D2) |
| Fotos de Sponza (`assets/hd/*.jpg`: color, relieve, rugosidad) | `world/hd/materials.ts` | Los dibujos de `comicTiles.ts` directamente |
| `Water` de three.js | `gfx.ts` (`makeSea`) | Agua de tebeo (D4) |
| Calidad `quality.grain`, `quality.env`, `quality.post`, `quality.kind` (phong/lambert), `?lite`, el "modo seguro" que los iba quitando, contornos antiguos (`addOutline`) | `gfx.ts`, `main.ts`, `materials.ts` | Solo `quality.shadows` |

Resultado: unos 9 MB menos de imágenes en el paquete publicado, menos tiempo de carga y menos memoria de vídeo.

---

## 4. Herramientas y forma de trabajar

**Vista de prueba:** `http://localhost:5179/?hq#test`. Se manda con `__dbg.go(n)`, `__dbg.phase('…')`, `__dbg.skip()`, `__dbg.shot()` y `__dbg.keepAlive(true)` (ver `README.md`, "Modo prueba").

**Capturas comparables:** colocar la cámara en el mismo sitio en el cap. 1 y en el capítulo migrado (`?cam=x,y,z,lx,ly,lz` o `window.__cam`) y compararlas a la par: grosor de tinta, tamaño de las piezas dibujadas, saturación, color del papel y rampa de tres tonos.

**Lista de comprobación de cada capítulo** (todas sus fases, no solo el principio):
1. Ningún material con luz que no sea `MeshToonMaterial` (en consola: recorrer la escena y listar `material.type`).
2. Ningún `Points`, `Sprite` ni `ShaderMaterial` sin versión de tebeo, salvo los marcados `noComic` a propósito.
3. Ningún degradado continuo visible en halos ni agua.
4. Tinta en todas las aristas de la arquitectura; nada "a regla" que en el cap. 1 esté a mano alzada.
5. Piezas dibujadas (losas, tejas, sillares) del mismo tamaño en pantalla que en el cap. 1.
6. Luz del perfil correcto (día, noche, interior, atardecer) en cada fase.
7. fps ≥ 30 en el móvil y tiempo de carga razonable.

**Al terminar un capítulo:**
- poner su perfil en `LOOKS` si no lo tiene;
- compilar (`npx tsc --noEmit`, `npm run build`);
- capturas de todas las fases y aprobación del dueño;
- marcar sus filas en `docs/estilo-comic/progreso-capN.md`;
- commit local.

---

## 5. Orden de trabajo (por calendario)

| # | Paso | Abre | Notas |
|---|---|---|---|
| F0 | Base común: limpieza (3b), D1, D2, D3, agua y brillos de noche (D4), destello | — | **Hecho** |
| F1 | Capítulo 2 (piscinita, noche) | 21-nov | **Hecho** (sección 8) |
| F2 | Capítulo 3 (ruta: carretera, cafeterías, terraza, camping de noche, Logroño) | 22-nov | Mucho `Merger` de día; trampas de la carretera (5b) |
| F3 | Capítulo 4 (aeropuerto de interior + concierto de noche) | 23-nov | **El más difícil**: interior, escenario, pantallas, láseres, multitud enorme, `setDark`. Si no da tiempo por orden, empezarlo en paralelo a F2 |
| F4 | Capítulo 5 (moto por la costa) | 24-nov | Día, carretera, mar, cala de las ranas |
| F5 | Capítulo 6 (Sant Joan) | 25-nov | Ya comparte `townHD` con el 1; D6a (sillería) |
| F6 | Capítulo 7 (cena, noche) | 26-nov | Noche e interior de casa |
| F7 | Capítulo 8 (eclipse: aparcamiento de noche, kayak, casa, rocas, atardecer y totalidad) | 27-nov | Varios perfiles; el eclipse necesita diseño propio |
| F8 | Capítulo 9: misiones de playa y parque + defectos del cap. 1 (1.3) | 28-nov | Ferreries ya es cómic |
| F9 | Carta final (`letterScene.ts`) | tras el 9 | Noche sobre el mar, fotos flotando, fuegos. Decidir con el dueño si las fotos reales se quedan como fotos (recomendado: sí, con marco de polaroid dibujado) |
| F10 | Repaso global: los 9 capítulos seguidos con las mismas capturas | — | Coherencia final |

---

## 5b. Trampas del sistema de cómic
Encontradas al inventariar; afectan a varios capítulos (detalle y líneas en los inventarios de la sección 7):

| Trampa | Dónde | Efecto | Arreglo | Estado |
|---|---|---|---|---|
| Se congela el desplazamiento de las texturas animadas | `drawnMap`/`withRepeat` copian el `offset` a una textura nueva (`comic.ts`) | Cap. 3: las líneas de la carretera viajan con el coche. Cap. 2: cáusticas quietas | Que el nivel anime `mesh.material.map` (el convertido) | Cap. 2 hecho (cáusticas de tebeo propias); cap. 3 pendiente |
| `drawnMap` baja el contraste al 45 % | `comic.ts` | Líneas de la carretera, rayas de toldos, grava, baldosas y cáusticas se apagan | Dibujos a mano para esas texturas de lienzo | Cap. 2 hecho (grava, baldosas); resto pendiente |
| El doblado se acumulaba en geometría compartida que aparece de una en una | `handDrawn` | Cada coche o tractor solo en escena volvía a doblar la misma geometría | `handDrawn` marca también la geometría (`geometry.userData.comicBent`) | Hecho |
| Lo que se mueve se dobla una vez donde esté | `handDrawn` | Coches, taxi, kayak, ferry, remos, hojas de puertas, vaca: quedan torcidos | `userData.comicBent = true` | Cap. 2 hecho (coches, puertas); resto pendiente |
| Muebles doblados con cosas encima sin doblar | `handOffset` a ~0,76 m mueve ~7 cm | Platos, copas, zamburiñas, plancha, farolillo descolocados | Marcar esos muebles `comicBent` | Pendiente (caps. 3, 7) |
| Halos que se crean durante el juego | La pasada de cómic corre cada 1 s | Salen al 100 % y al poco cambian | Crearlos ya en versión de tebeo | Pendiente donde aparezcan |
| Opacidades que el nivel reescribe cada fotograma | Luciérnagas, brillo de la zamburiña | El ×0,4 de día se pierde | De noche ya no se toca la opacidad; de día, receta propia | Cap. 2 hecho |
| Ventanas y luces "encendidas" hechas con colores de `Merger` | Varias (caps. 2, 3, 6, 7, 8) | En tres tonos quedaban sombreadas: de noche no brillaban | `Surf.Glow` (D2): sin sombra de noche | Hecho (comprobar sus colores en cada capítulo) |
| Transparentes sin profundidad encima de personajes | Agua de la piscina, mosaico de censura (cap. 2), copas | La tinta de lo de debajo se pinta encima | Contorno propio o `depthWrite` según el caso | Cap. 2 hecho |
| El nivel reescribe la intensidad del sol cada fotograma | `level2.ts` | Se anula el tope de 2,1 del cómic | Respetar el tope en el nivel | Pendiente (cap. 3) |
| Escala de las losas distinta | Laurel (`laurel.ts`, 2 m) frente a 3,2 m en el cap. 1 | Losas más pequeñas | Misma escala que el cap. 1 | Pendiente (cap. 3) |

## 6. Riesgos conocidos
- Cambiar `comicScene`, `LOOK_LIGHT.dia` o `comicSurfaces` afecta al capítulo 1: siempre capturas antes/después del 1.
- `drawnMap` lee las imágenes con canvas. Texturas de otro origen sin CORS, o aún sin cargar, quedan en color medio hasta la siguiente pasada (`settlePending`). Comprobar que todas acaban dibujadas.
- Las escenas que cambian de luz a mitad (Fito: Barajas de día → estadio de noche; eclipse: del día a la totalidad) cambian el perfil con `comicMood`, no solo al cargar.
- `userData.noComic` lo llevan los personajes VRM (para conservar MToon). No quitarlo.
- **Lo que hacía el postproceso y ya no existe:** desenfoque de los diálogos, bloom de lo emisivo, bandas de cine, aberración cromática. Sustitutos:
  - el destello, en la pasada de tinta (hecho);
  - el diálogo, con acercamiento de cámara (ya existe);
  - el brillo, con las recetas de D4.
- La pasada de tinta usa la profundidad: lo que no escribe profundidad (transparentes, `depthWrite: false`) no tiene tinta. Darle contorno propio si debe tenerlo.

---

## 7. Inventario objeto por objeto
Los inventarios completos están en archivos aparte (uno por grupo de capítulos), generados leyendo el código el 9-nov-2026, **antes** de la limpieza: los números de línea pueden haberse movido unas líneas. Cada fila tiene objeto, archivo:línea, cómo se construye, material, textura, **clase** y qué hacer:
- **A:** la conversión automática basta (comprobar en captura).
- **B:** no se convierte (material sin luz, sombreador propio, puntos, sprite, línea); hace falta su versión de tebeo a mano.
- **C:** se convierte pero hay que cuidarlo (instanciado, emisivo, transparente, poco subdividido, foto sin dibujo a mano, noche, se mueve).

Desde F0, muchas filas C de "color liso, D2/D3" ya están resueltas por la base común. Hay que comprobarlas en captura igualmente.

| Archivo | Capítulos | Contenido |
|---|---|---|
| [`estilo-comic/inventario-cap1-cap9.md`](estilo-comic/inventario-cap1-cap9.md) | 1 y 9 (referencia), misiones de playa y parque | Receta exacta del cap. 1 y sus defectos; inventario de Ferreries; playa y parque |
| [`estilo-comic/inventario-cap2-cap3.md`](estilo-comic/inventario-cap2-cap3.md) | 2 (piscinita) y 3 (ruta) | Born, calle de casa, casa y piscina, cielo de noche; carretera, restaurantes, San Vicente, plancha, Logroño, camping, terraza, Laurel |
| [`estilo-comic/inventario-cap4-cap5.md`](estilo-comic/inventario-cap4-cap5.md) | 4 (Fito) y 5 (moto) | Barajas, estadio, escenario, efectos; carretera de la costa, faro, vehículos, cala de las ranas; paneles 2D |
| [`estilo-comic/inventario-cap6-cap8-carta.md`](estilo-comic/inventario-cap6-cap8-carta.md) | 6 (Sant Joan), 7 (cena), 8 (eclipse) y carta final | Born, Ses Voltes, caballos, taxi; Sa Farola, casa, cocina; aparcamiento, kayak, casa de Gas, rocas, eclipse; carta |

**Cómo usarlos:**
- Al empezar un capítulo, copiar sus tablas a `docs/estilo-comic/progreso-capN.md`, con una columna "Hecho" y otra "Captura", e ir marcando.
- Si al recorrer el capítulo aparece algo que no está en la tabla, añadirlo.
- El capítulo no se da por terminado mientras quede una fila sin marcar.
- Ejemplo terminado: `progreso-cap2.md`.

---

## 8. Estado

Se rellena al terminar cada fase.

**F0 (base común + limpieza), hecho el 9-nov-2026.** Lo borrado está en 3b. Lo nuevo:
- `core/comic.ts`:
  - perfiles `LOOK_LIGHT`, `comicMood` y `comic.look`;
  - brillos de noche con `comicHaloTexture`;
  - luces de punto y foco en anillos (`bandedLights`);
  - superficies triplanar en `toToon`;
  - `handDrawn` no dobla lo que va dentro de algo marcado `comicBent` ni dobla dos veces una geometría reutilizada;
  - destello `comicFlash`.
- `core/comicSurfaces.ts` + dibujos nuevos en `core/comicTiles.ts`: asfalto, hierba, baldosa, adoquín, arena, piedra seca, piedra, persiana, corteza, luna, estrella y luz de tebeo.
- `core/surfaces.ts`: solo el tipo de superficie por color, con `Surf.Glow` nuevo.
- `core/gfx.ts`: `toon()` marca la superficie; `settleAmbient` sustituye a la luz de entorno; el `Sky` siempre de tebeo; `makeSea` con agua de tebeo.
- `entities/models.ts`: `Merger.add` subdivide las piezas grandes.
- `entities/fx.ts` y `core/dust.ts`: partículas con contorno de tinta, gotas y polvo de tebeo.
- Coches, motos y hojas de puertas, marcados `comicBent`.
- Carta final: luna de tebeo y fotos sin halo borroso. El resto de la carta sigue pendiente (F9).

Comprobado:
- capturas del cap. 1 antes/después (sin cambios a la vista);
- los 9 capítulos y la carta se abren sin errores en la consola, en desarrollo y en la versión compilada.

**F1 (capítulo 2), hecho el 9-nov-2026:** ver `docs/estilo-comic/progreso-cap2.md`.

**Siguiente: F2 (capítulo 3, se abre el 22-nov).**
