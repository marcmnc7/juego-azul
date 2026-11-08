# Plan: personajes de VRoid para todo el juego

Ver también `docs/REVISION-animaciones.md` (qué falla en las animaciones y cómo mejorarlas).

Documento para otra IA (o persona) que vaya a encargarse de los personajes de **Para Margaux** (este repo). Está escrito para poder trabajar sin más contexto: qué hay, qué falta, cómo hacerlo, en qué orden y cómo comprobar cada paso. La parte final es el **reparto por capítulo**.

> Fecha de corte: 8 de noviembre de 2026. Los capítulos se abren uno al día **del 20 al 28 de noviembre** (el 1 el día 20). El capítulo 1 tiene que estar terminado y publicado antes del 20.

---

## 0. Objetivo y reglas

**Objetivo:** que todas las personas del juego (protagonistas, secundarios con nombre, extras y multitudes) tengan el **mismo estilo anime de VRoid Studio** (sombreado MToon), sustituyendo a los modelos actuales de MakeHuman/Mixamo, que mezclan estilos y se ven mal.

**Reglas del dueño del proyecto (obligatorias):**
1. **Capítulo a capítulo.** Primero el capítulo 1 completo. No toques otro capítulo sin que el dueño lo apruebe (pidió expresamente no añadir nada al capítulo 2 y siguientes hasta nuevo aviso).
2. **Nada se publica sin confirmación.** Publicar = subir `dist/` al repo `marcmnc7/pm-2611` (GitHub Pages, lo ve Margaux). Haz commits locales; push y publicación, solo cuando el dueño lo diga.
3. **Si un modelo no se parece al personaje, no se mete.** Ya pasó con Gas: su VRM salía con cara de chica. Mejor el modelo viejo que uno que confunda.
4. **Animales fuera de alcance** (burros, caballos, Joy, la vaca, el zorro): se quedan como están.
5. Hablar con el dueño **en español**.

---

## 1. Estado actual (lo que ya está hecho)

Repo: `marcmnc7/juego-azul` (Three.js 0.180 + Vite + TypeScript). Hay 2 commits locales en `main` sin subir, más uno de trabajo en curso (ver 1.4).

### 1.1 Personajes VRM en el juego (hecho y probado)
- **`src/entities/vrm.ts`**: carga un `.vrm` con `@pixiv/three-vrm` y **renombra los huesos humanoides con los nombres de Mixamo** (`Hips`, `Spine`, `LeftArm`…). Así `rig.ts` lo trata como un modelo más: mismas animaciones (capturas de Mixamo en `src/assets/chars/anims.glb` + samba), mismas articulaciones del "muñeco" que mueven los niveles (pomada en la mano, beso, IK de sentarse). También: parpadeo, sonrisa al bailar, boca al hablar y física del pelo (`tickVRM`). Las mallas VRM llevan `userData.noComic = true` para que el paso de cómic (`core/comic.ts`) no les cambie el material MToon.
- **`src/entities/rig.ts`**: si el `look` de un personaje tiene `vrm: <url>` y ese VRM está cargado, usa el VRM (`kind = "vrm:<url>"`); si no, el modelo de antes.
- **`src/data/characters.ts`**: registro `VRM_FILES` (`[url, altura en m]`) y `AZUL_VRM`. Hoy solo: `AZUL_VRM.ferreries` (Azul con el mono negro del capítulo 1).
- **`src/world/level1.ts`**: Azul usa ese VRM en la variante normal del capítulo 1.

**Limitación importante:** cada archivo VRM se carga **una sola vez** y su escena **no se clona** (clonar rompe expresiones y física del pelo). Si dos personas de la misma escena piden el mismo VRM, la segunda sale con el modelo viejo. Ver fase F1.

### 1.2 Herramientas
- **`scripts/vrm_slim.py`** (Python, sin dependencias): aligera un VRM de VRoid sin cambiar su aspecto. Quita los blendshapes de la cara que ninguna expresión usa (57 → 14) y la miniatura. 11 MB → ~6,5 MB. **Usarlo siempre** antes de meter un VRM en `src/assets/vrm/`.
- **`scripts/crowd_lod.mjs`** (Node; trabajo en curso, ver 1.4): convierte un VRM en plantilla ligera para la multitud.
- **`docs/vroid-capitulo-1.md`**: fichas de VRoid del reparto del capítulo 1 (qué tocar en VRoid para cada personaje) y `docs/vroid/barca_rayas.png` (rayas de la camiseta del Barça).

### 1.3 Build y publicación
- `npm run build` genera `dist/`: `index.html` (~5 MB, el código) + `dist/assets/` (modelos, VRM, música, fotos, cielos). Así ningún archivo pasa del **límite de 100 MB por archivo de GitHub** (antes era un HTML único de 105 MB y no se podía subir).
- `public/sw.js` (modo sin conexión) precachea todo `assets/`; la lista la rellena `vite.config.ts` al compilar.
- Publicar = copiar **la carpeta `dist/` entera** al repo `marcmnc7/pm-2611` (sitio en `https://marcmnc7.github.io/pm-2611/`). Necesita HTTP: abierto como archivo suelto no carga los assets.

### 1.4 Trabajo en curso: multitud con VRoid (sin integrar)
- `scripts/crowd_lod.mjs entrada.vrm salida.glb [triángulos]` produce una malla única `Body` (~6000 triángulos, <1 MB) con atlas de textura, huesos `mixamorig*`, sin blendshapes, y un atributo **`_ZONE`** por vértice: 1 piel · 2 pelo · 3 camiseta · 4 pantalón · 5 zapatos · 6 detalles de cara. Detecta el pelo por sus huesos (`J_Sec_Hair*`) y por altura (sobre el cuello), la piel por color (ΔE en CIELAB) y camiseta/pantalón por dos grupos de color.
- Plantillas ya generadas en `src/assets/crowd/`: `mujer_a` (de `vecina.vrm`: sudadera roja, falda de cuadros), `mujer_b` (de `vecina2.vrm`: camiseta crema, shorts vaqueros), `nino` (de `nino.vrm`: camiseta azul, shorts), `hombre_a` (de `gas.vrm`: camiseta verde, vaqueros). Los VRM de origen están en `~/Documents` del dueño.
- **Pendiente conocido:** en los bordes entre prendas la zona se mezcla (el bajo de la camiseta sale como "pantalón"). Solución prevista: asignar la zona **por pieza conectada** de la malla (unión de vértices por índices) con voto de mayoría. `vecina30.vrm` y `gas30.vrm` no sirven (pierden ropa y pelo con la textura: usan UV de otra forma); descartados.
- **No está conectado al juego** (`crowdRig.ts` sigue con MakeHuman). Ver fase F6.

---

## 2. Arquitectura que hay que conocer

| Archivo | Qué hace |
|---|---|
| `src/entities/models.ts` | `makePerson(look)` crea a cualquier persona. Si hay calidad alta y los modelos están cargados, llama a `makeRigPerson` (rig.ts); si no, un muñeco de primitivas. `PersonLook`: colores (`skin`, `shirt`, `pants`, `hair`…), `hairStyle`, banderas (`male`, `kid`, `shorts`, `jumpsuit`, `nude`…) y ahora `vrm`. `makeCrowd()` crea multitudes (`RigCrowd` o `CrowdPeople`). `seatTop`/`seated` ajustan alturas al sentarse (comprueban `rig.kind === 'woman'`). |
| `src/entities/rig.ts` | Personajes con esqueleto. `preloadRig()` carga MakeHuman (`man_mh`, `woman_mh`, `kid_mh`, `gas_mh`), Azul vieja (`woman.glb`), animaciones y los VRM de `VRM_FILES`; `prepareKind()` hace el retargeting de las capturas a cada modelo; `makeRigPerson()` monta la persona; `updateRigPeople()` la anima cada fotograma. |
| `src/entities/vrm.ts` | Carga VRM, renombra huesos, cara y pelo (`tickVRM`). |
| `src/entities/crowdRig.ts` | Multitud "horneada" (VAT): anima un modelo ligero al cargar, guarda la posición de cada vértice por fotograma en texturas y dibuja cientos de personas instanciadas. Tiñe por zonas (`zoneTint`) según `aZone` (de color de vértice). Hoy usa `woman_mh_lod.glb` y `man_mh_lod.glb`. Clips: idle, agree, headShake, dance, walk, drink, phone. |
| `src/entities/donkeyHD.ts` | Burros y caballos con **jinete** (`makeRigPerson`): caixers de Sant Joan (frac negro, pantalón blanco, bombín) y gente del pueblo en los burros de Ferreries. |
| `src/entities/print.ts` | Estampados en el pecho (`shirtPrint`, p. ej. camisetas de Fito o del caballo); comprueba `rig.kind === 'woman'`. |
| `src/core/comic.ts` | Paso de "cómic" que reemplaza materiales de toda la escena salvo `userData.noComic`. |
| `src/data/characters.ts` | Looks de Azul (`MARGAUX_LOOK`) y Gas (`MARC_LOOK`) + registro de VRM. |
| `src/data/story.ts` | Textos y diálogos por capítulo (quién habla). |
| `main.ts` → `LEVEL_CLASSES` | Capítulo 1 `Level1` · 2 `Level4` · 3 `Level2` · 4 `Level3` · 5 `LevelMoto` · 6 `LevelSantJoan` · 7 `LevelCena` · 8 `LevelEclipse` · 9 `LevelAniversario` (variante de `Level1`). |

**Depuración en el navegador:** abrir con `#test` (todo desbloqueado). En consola, `__dbg.go(n)` va al capítulo n, `__dbg.skip()` salta diálogos, `__dbg.phase('…')` salta de fase, `__dbg.shot()` devuelve una captura del lienzo, `__dbg.keepAlive(true)` mantiene el bucle con la pestaña oculta, `__dbg.level()` da el nivel (con `player`, `marc`, `carme`, `tofol`…). Para capturas de cerca se puede sustituir `camera.updateMatrixWorld` para colocar la cámara delante de un personaje.

---

## 3. Plan por fases

Cada fase termina con **criterios de aceptación**. No pases a la siguiente sin cumplirlos y sin capturas que lo demuestren.

### F0 · Preparación (½ día)
1. Leer este documento, `docs/vroid-capitulo-1.md`, `src/entities/vrm.ts`, `rig.ts` (sobre todo `prepareKind`, `makeRigPerson`, `updateOne`) y `crowdRig.ts`.
2. `npm install`, `npm run dev`, abrir `http://localhost:5173/?hq#test`, `__dbg.go(1)` y ver a Azul (VRM) frente a los demás (MakeHuman).
3. Decidir con el dueño **cómo se crearán los modelos de VRoid** (ver F2): VRoid Studio es una app de escritorio sin API ni línea de comandos, y su formato `.vroid` es binario interno (protobuf sin documentar): **no se puede generar por código**.

**Aceptación:** el juego arranca en local y se ve a Azul VRM en el capítulo 1.

### F1 · Varias personas con el mismo VRM (1 día)
Hoy un VRM = una persona por escena. Hace falta para extras, para las versiones "con/sin ropa" del mismo personaje y para que un secundario aparezca dos veces.
- Opción recomendada: en `VRM_FILES`, un número de **instancias** por archivo (`[url, altura, instancias]`). En `preloadRig`, guardar el `ArrayBuffer` una vez (`bytes(url)`) y **parsearlo N veces** con `GLTFLoader.parseAsync` (cada parseo es un VRM independiente con su física de pelo y expresiones). `makeRigPerson` toma la primera instancia libre (no usada por una persona viva de la escena).
- Cuidado con la memoria: cada instancia comparte nada con las otras; un VRM de 6,5 MB ocupa bastante más en GPU. Límite práctico en móvil: **≤ 8 VRM completos por escena**.
- Para extras a media distancia **no** usar VRM completos: usar las plantillas ligeras (F5).

**Aceptación:** dos personas con el mismo `vrm` en la misma escena se ven, se animan y parpadean por separado; al cambiar de capítulo y volver no hay fugas (comprobar `renderer.info.memory` antes y después).

### F2 · Producción de modelos (en paralelo con F1)
Hace falta (ver reparto en la sección 4): **modelos únicos** para protagonistas y secundarios con nombre, **variantes de ropa** de Azul y Gas por capítulo, y **plantillas** para extras y multitud.

Formas de conseguirlos, de mejor a peor resultado:
1. **VRoid Studio manejado por alguien** (una persona, o una IA con control del escritorio del Mac) siguiendo fichas como `docs/vroid-capitulo-1.md`. Para Azul y Gas, partir de sus proyectos (`~/Documents/Azul.vroid`, `GasFerreries.vroid`) y **duplicar por cada conjunto de ropa** (misma cara y pelo, solo cambia la ropa).
2. **Encargo a un artista de VRoid** (VGen, Fiverr, Booth): las fichas sirven de encargo. Coste orientativo 20–60 € por personaje; varios días.
3. **Modelos de muestra CC0 de VRoid** (p. ej. AvatarSample de pixiv, alojados en OpenGameArt): dan caras y peinados distintos para extras y plantillas. **Verificar la licencia de cada archivo** antes de usarlo y pedir permiso al dueño antes de descargar.
4. **Variantes por código** a partir de VRM existentes: cambiar colores de pelo/ropa/piel, altura y pintar sobre la textura de la cara (bigote, barba). Válido para extras; **no** para Gas, Carme ni Tòfol.

**Exportación desde VRoid (todos):** VRM 1.0 · atlas de texturas 1024 (2048 para Azul y Gas) · reducir polígonos del pelo · borrar mallas transparentes · **sin fusionar materiales** de ropa (así cada prenda es un material y se puede teñir en el juego; los VRM actuales de `vecina`/`nino`/`gas` están fusionados y por eso `crowd_lod.mjs` tiene que adivinar zonas por color). Después: `python3 scripts/vrm_slim.py exportado.vrm src/assets/vrm/<nombre>.vrm`.

**Nombres de archivo:** `<personaje>_<capítulo o conjunto>.vrm`, p. ej. `azul_ferreries.vrm`, `gas_barca.vrm`, `carme_ferreries.vrm`, `tofol.vrm`.

**Aceptación por modelo:** captura de frente, de perfil y de cara en el juego; el dueño lo reconoce como ese personaje; ≤ 7 MB tras `vrm_slim.py`; las 14 expresiones presentes.

### F3 · Protagonistas por capítulo (Azul y Gas)
Para cada capítulo, en su nivel, añadir `vrm: AZUL_VRM.<conjunto>` / `vrm: GAS_VRM.<conjunto>` al look correspondiente (tabla de la sección 4). Atención a:
- **Versiones dobles** del mismo personaje en la misma escena (capítulo 2: vestidos y en la piscina; `setNude()` intercambia dos personas): cada una con su VRM.
- **Sentados** (`seated`, terraza, camping, taxi, cena, roca): `models.ts` ajusta la cadera con `rig.kind === 'woman'`; revisar que el VRM queda bien sentado (caderas a la altura del asiento, sin piernas atravesando).
- **En vehículos** (coche, moto): conductor/pasajero se crean dentro de `makeCar`/`makeMoto` con un look; pasarles el `vrm`.
- **Estampados** (`print.ts`: camiseta de Fito, la del caballo de Sant Joan): con VRM, mejor pintarlos en la textura de la camiseta en VRoid; si se usa `shirtPrint`, ajustar el radio del pecho (hoy depende de `kind === 'woman'`).
- **Casco** (moto) y otros objetos que se cuelgan de huesos (`boneAnchor`): comprobar que siguen en su sitio (los huesos se llaman igual).

**Aceptación:** en cada fase del capítulo, Azul y Gas se ven con el VRM correcto, sin el modelo viejo en ninguna escena (incluidas escenas de cine, sentados y vehículos).

### F4 · Secundarios con nombre
Igual que F3, con sus VRM únicos (tabla). Los objetos que añade el juego encima (delantal de Tòfol, bombín y tamborí de la fabiolera) van colgados de `boneAnchor(persona, 'Hips' | 'Head')`: comprobar posición y escala con el VRM.

**Aceptación:** capturas de cada secundario hablando (boca), de cerca y a media distancia.

### F5 · Extras sueltos (personas creadas con `makePerson` en minijuegos y escenarios)
Son pocos por escena (4–20) y se ven a media distancia. Recomendado: **plantillas ligeras como "kind" de rig**:
- Usar los `.glb` de `crowd_lod.mjs` (huesos `mixamorig*`, sin blendshapes ni física) como un tipo más en `rig.ts` (como `man`/`mhwoman`): se pueden **clonar** con `SkeletonUtils.clone` sin romper nada, son baratos y comparten estilo con la multitud.
- Tinte por zonas con el color del `look` de cada uno (misma lógica que la multitud, en el material del clon).
- Asignar plantilla según el look: `male`/`beard`/`hairStyle` corto → hombre; `kid` → niño/niña; resto → mujer.

**Aceptación:** ningún extra MakeHuman en el capítulo; variedad visible (no clones del mismo color).

### F6 · Multitudes horneadas (VAT)
1. Arreglar las zonas de `crowd_lod.mjs` por pieza conectada (ver 1.4) y revisar con la vista de zonas (colorear `_ZONE`).
2. En `rig.ts`, cargar las plantillas y pasarlas por `prepareKind` (retargeting a su esqueleto).
3. En `crowdRig.ts`:
   - `bakeKind` aceptando un `KindData` (no solo `Kind`); leer la zona de `geometry.attributes._zone`.
   - `RigCrowd`: repartir a las personas entre **varias plantillas** con un `InstancedMesh` por plantilla y su propio número de instancias (no el truco de escala cero de los peinados: multiplicaría el coste de vértices).
   - Material: `MeshToonMaterial` con mapa de gradiente de 3 tonos (aspecto MToon barato) + `vatify` + tinte por zonas para VRoid: piel = textura × (color piel / piel de la plantilla); pelo, camiseta y pantalón = luminancia de la textura × color ÷ luminancia media de la zona (en `mesh.userData.crowd.lum`); zapatos y cara tal cual. `userData.noComic = true`.
   - Vaso y móvil (`addProps`) funcionan igual (buscan `RightHand`, `RightHandIndex1`…).
4. Rendimiento: ~6000 triángulos por persona. Ferreries tiene ~100 personas (68 + bailarines), el concierto ~230, Sant Joan ~290. Si en el móvil baja de 30 fps, reducir triángulos (`crowd_lod.mjs … 3500`) o número de personas lejanas.

**Aceptación:** plaza de Ferreries, concierto y Born de Sant Joan con multitud VRoid; ≥ 30 fps en un iPhone de gama media (comprobar con el contador de `#test`); sin MakeHuman a la vista.

### F7 · Limpieza y tamaño
Cuando ningún capítulo use MakeHuman, quitar `man_mh*`, `woman_mh*`, `kid_mh`, `gas_mh`, `woman.glb` (≈ 25 MB) de `src/assets/chars/` y su código. Mantener `anims.glb` (capturas). Presupuesto de descarga total del juego: < 100 MB (hoy ~76 MB).

### F8 · Pruebas y publicación (cada capítulo)
1. `npx tsc --noEmit` sin errores y `npm run build`.
2. Recorrer el capítulo entero en `#test` con `__dbg.phase()` y capturas de cada fase con personajes.
3. Probar el build servido bajo una subcarpeta (como Pages): `python3 -m http.server` sobre una carpeta que contenga `pm-2611 → dist`; abrir `/pm-2611/#test`.
4. Enseñar capturas al dueño. **Solo con su OK:** commit, push a `juego-azul` y copiar `dist/` a `pm-2611` (sin dejar archivos viejos), push.

---

## 4. Reparto por capítulo

Distancia: **C** = de cerca (diálogos, escenas de cine), **M** = media distancia, **L** = lejos (multitud). Tipo: **Único** = VRM propio; **Conjunto** = mismo personaje con otra ropa (duplicar su proyecto de VRoid); **Plantilla** = extras (F5) o multitud (F6). Los colores son los que usa hoy el juego (`look` en el código): sirven de referencia para la ropa.

### Protagonistas: conjuntos de ropa

| Conjunto | Capítulos | Azul (Margaux) | Gas (Marc) |
|---|---|---|---|
| **Diario** (`MARGAUX_LOOK` / `MARC_LOOK`) | 2 (inicio), 3, 4*, 5, 7, 8, 9 | Top corto blanco de punto, vaqueros azules (`#4a6f9c`), rubia miel, ojos verdes | Camiseta verde militar (`#5b6b3a`), vaqueros (`#3f5f8a`), pelo castaño oscuro rizado con volumen, bigote fino y perilla |
| **Jaleo de Ferreries** | 1 | Mono negro de una pieza ajustado (**hecho**: `azul_ferreries.vrm`) | Camiseta del Barça (rayas `#0a3d8f`/`#a50044`), pantalón corto azul marino |
| **Piscina** | 2 | Baño (hoy el juego la pone "sin ropa" con piel lisa; en VRoid, bañador o biquini) — existe `Azul-Nadar(MadeMarc).vrm` del dueño | Bañador |
| **Fito** | 4 | Diario | Camiseta de Fito azul (`#1f4fa8`) |
| **Moto** | 5 | Diario + casco blanco (el casco lo pone el juego) | Diario + casco (conduce la moto) |
| **Sant Joan** | 6 | Camiseta blanca con un caballo dibujado, pantalón corto azul claro (`#6f8fb8`) | Camiseta blanca con el caballo, pantalón corto azul marino (`#2d3a55`) |
| **Un año después** | 9 | Vestido azul claro (`#5aa9e6`) | Diario |
| **Playa (vóley)** | 9 | Diario con pantalón corto | Diario con pantalón corto |

\* En el capítulo 4 Azul lleva el diario y Gas la camiseta de Fito.
Archivos existentes del dueño: `Azul-Ferre1` (integrado), `Azul-Cap2` (¿conjunto diario del capítulo 2?) y `Azul-Nadar` (piscina), en `~/Desktop/characters`; **no integrar los dos últimos hasta que el dueño apruebe el capítulo 2.** El VRM de Gas existente (`gas_ferreries.vrm`) **no vale** (cara femenina, sin bigote ni perilla, camiseta blanca).

---

### Capítulo 1 · Jaleo d'ases (Ferreries, 25-ago-2025) — `level1.ts`, `ferreries.ts`, `sideGames.ts` (`WaterFight`)
Fiesta de día en la plaza. **Prioridad máxima.**

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul | C | Conjunto "Jaleo" | **Hecho** |
| Gas | C (mirada, baile, beso) | Conjunto "Jaleo" | Ver tabla de protagonistas + `docs/vroid-capitulo-1.md` |
| Tòfol (el del bar; da las misiones; habla mucho) | C | Único | Hombre ~60 años, pelo y barba gris (`#9a9a9a`), piel morena (`#d9a27c`), camiseta blanca, pantalón corto azul grisáceo; el delantal verde lo pone el juego |
| Carme (amiga; baila en Sa Font; habla) | C/M | Único | Mujer, pelo rubio claro corto (`#f3dc8f`), ojos azules, el mismo mono negro que Azul |
| La fabiolera (toca el fabiol ante la iglesia) | M | Único | Mujer, moño bajo castaño (`#5a3a22`), blusa negra, pantalón blanco; bombín y tamborí los pone el juego |
| Los 4 de las pistolas de agua (alrededor de la plaza) | M | Plantilla (F5) | Pantalón corto; camisetas blanca, verde azulado `#1b998b`, amarilla `#f4d35e`, roja `#d7263d`; pelos melena castaña, corto moreno, coleta negra, corto castaño |
| Niños de la guerra de agua (`WaterFight`, 5) | M | Plantilla niño/niña | Pantalón corto; camisetas rosa, turquesa, amarilla, azul, naranja |
| Jinetes de los burros (gente del pueblo) | M | Plantilla (jinete, `donkeyHD.ts`) | Ropa de verano, sin sombrero; colores variados |
| Multitud de la plaza (~68) | L | Plantilla (F6) | 6 looks de verano con pantalón corto (camisetas blancas, rojas, verdes, amarillas, azules; gorra, coleta, moño) |
| Bailarines ante los bares (~33) | L | Plantilla (F6) | 3 looks de fiesta, bailando |

### Capítulo 2 · La piscinita (Sa Caleta, 27-ago-2025) — `level4.ts`
Noche: Gas la recoge en el Imperi, entran en silencio, piscina, césped, estrellas.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul vestida | C | Conjunto "Diario" (o el de `Azul-Cap2`) | Top blanco de punto, vaqueros |
| Azul en la piscina | C | Conjunto "Piscina" | `Azul-Nadar` |
| Gas vestido | C | Conjunto "Diario" | |
| Gas en la piscina | C | Conjunto "Piscina" | Bañador |
| (sin extras) | | | Coche de Gas sin conductor visible fuera de escena |

### Capítulo 3 · La ruta de las zamburiñas — `level2.ts`, `terrace.ts`, `camp.ts`, `laurel.ts` (`PinchoGame`), `logrono.ts`
Coche (Ford Focus gris: conduce Azul, Gas de copiloto), Cafetería Marcial, terraza de El Ancla, camping, calle Laurel en Logroño.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul (conduce, sentada en terrazas y camping) | C | "Diario" | |
| Gas (copiloto, sentado) | C | "Diario" | |
| Camarero de la calle Laurel (`PinchoGame`) | M | Único sencillo o Plantilla | Hombre, camisa blanca, pantalón negro, pelo castaño oscuro corto, barba |
| Gente de la calle Laurel con su vaso (~20) | M | Plantilla (F5) | Ropa de calle oscura y granate, hombres y mujeres |

### Capítulo 4 · Fito bajo las estrellas (Barajas → Gran Canaria, marzo 2026) — `level3.ts`, `entities/fito.ts`, `sideGames.ts` (`BeerRun`, `PeeAim`, `GlassesHunt`)
Aeropuerto (maletas, puerta 26), cola del baño, concierto de noche.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul | C | "Diario" | |
| Gas | C | "Fito" | Camiseta azul de Fito |
| Camarero de la barra (habla: "Camarero") | C/M | Único sencillo | Hombre, piel morena (`#c98e64`), todo de negro, pelo negro corto |
| Personal del aeropuerto (2) | M | Plantilla | Uniforme azul marino (`#1f2d4d`); un hombre y una mujer |
| Viajeros con prisa (4) y gente en cola / baños (6 looks) | M | Plantilla (F5) | Ropa de calle variada, gorra, coleta, moño, uno con barba |
| Gente que cruza el pasillo (`BeerRun`, 4) | M | Plantilla | Ropa de noche, colores apagados |
| Músicos: bajista, saxofonista, batería | M | Únicos sencillos o Plantilla | Bajista pelo largo y camisa gris oscura; saxo camisa amarilla; batería camisa blanca y pelo gris |
| Cantante (`fito.ts`, modelo propio con sombrero y guitarra) | M | Único | Cantante de rock de negro con sombrero (estilizado, sin buscar parecido fotográfico) |
| Público del concierto (~230, bailando) | L | Plantilla (F6) | 4 looks de concierto |

### Capítulo 5 · MotoTrip4life (Costa Brava, 30-abr a 4-may 2026) — `levelMoto.ts`, `sideGames.ts` (`StoneSkip`)
Mochila, carretera de la costa en moto (Gas conduce, Azul detrás), saludo motero, fotos, faro.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul (de paquete, con casco blanco) | C | "Diario" | |
| Gas (conduce, con casco) | C | "Diario" | Va dentro de `makeMoto(…, MARC_LOOK)` |
| Moteros que vienen de frente | L | Plantilla | Con casco; ropa de moto oscura |
| Conductores de coches (2 looks) | L | Plantilla | Camiseta blanca / azul |
| (la vaca habla; animal, fuera de alcance) | | | |

### Capítulo 6 · Sant Joan (Ciutadella, junio 2026) — `levelSantJoan.ts`, `camiFarola.ts`, `sideGames.ts` (`NutThrow`), `donkeyHD.ts`
Avellanas, caballos, Ses Voltes, foto con el obelisco; vuelta en taxi.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul | C | "Sant Joan" | Camiseta blanca con caballo, pantalón corto azul claro |
| Gas | C | "Sant Joan" | Igual, pantalón corto azul marino |
| Caixers a caballo (4 + 2 por las calles) | M | Único (uno, repetido) | Frac negro, pantalón blanco, botas, bombín |
| Gente en los balcones (`NutThrow`, 4) | M | Plantilla | De blanco (la tradición), pantalón corto o largo oscuro |
| Taxista | C/M (sentado) | Único sencillo o Plantilla | Hombre, camisa blanca, pantalón oscuro, pelo gris oscuro corto |
| Gente que vuelve por el arcén (4) | M | Plantilla | De blanco, alguno cojeando |
| "Una de Ciutadella" y "Un crío" (frases en los minijuegos, `SIDE` en `story.ts`) | M | Plantilla | Comprobar en qué minijuego aparecen |
| Multitud del Born, Ses Voltes y Plaça d'es Bè (~290) | L | Plantilla (F6) | 5 looks de verano, mucha camiseta blanca |

### Capítulo 7 · Cena a escondidas (Sa Farola, 13-jul-2026) — `levelCena.ts`, `saFarola.ts`, `sideGames.ts` (`TableMemory`)
Vigilar a los padres de Azul, carbonara, cena.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul | C | "Diario" | |
| Gas | C | "Diario" | |
| Padre de Azul (conduce su coche; habla en el cap. 8) | C/M | Único | Hombre mayor, pelo gris (`#b8b8b8`), barba, polo azul marino, pantalón beige |
| Madre de Azul | C/M | Único | Mujer, pelo castaño liso (`#7a5232`), blusa crema, falda granate |
| Gente paseando por el paseo (3, de día) | M | Plantilla | Verano; uno mayor con pelo gris |

### Capítulo 8 · El eclipse (Ciutadella, 12-ago-2026) — `levelEclipse.ts`, `missions/parking.ts`, `kayak.ts`, `sideGames.ts` (`RockHop`)
Moto perdida en el aparcamiento, kayak, conocer a los padres de Gas, aparcar, Love Letter en la roca, totalidad.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul (también sentada en la roca) | C | "Diario" | |
| Gas (también sentado) | C | "Diario" | |
| Padre de Azul | C | Único (el del cap. 7) | |
| Madre de Azul | C | Único (el del cap. 7) | |
| Eric (niño, va con Gas) | C/M | Único | Niño rubio (`#d9b56a`), camiseta amarilla, pantalón azul |
| Padre de Gas (habla) | C | Único | Hombre mayor, pelo gris (`#7d7672`), camisa azul claro, pantalón gris |
| Madre de Gas (habla) | C | Único | Mujer, pelo castaño oscuro liso, blusa rosa fuerte (`#c85a6a`), pantalón oscuro |
| Gente paseando (3, de día, `saFarola.ts`) | M | Plantilla | Como en el cap. 7 |

### Capítulo 9 · Un año después (Ferreries, 25-ago-2026) — `levelAniversario.ts` (variante de `Level1`), `missions/beach.ts`, `missions/park.ts`
El jaleo otra vez, ahora juntos; vóley en la playa; Joy en el parque; crucigrama y carta.

| Personaje | Distancia | Tipo | Aspecto |
|---|---|---|---|
| Azul | C | "Un año después" | Vestido azul claro |
| Gas | C | "Diario" | |
| Tòfol, Carme, la fabiolera | C/M | Los únicos del cap. 1 | Mismos modelos (comprobar ropa de esta variante en `level1.ts`) |
| Extras y multitud de Ferreries | M/L | Como en el cap. 1 | |
| Azul y Gas en la playa | C | "Playa" | Pantalón corto |
| Azul y Gas en el parque | C | "Diario" | |

### Escena final · La carta — `letterScene.ts`
Sin personas (fotos flotando sobre el mar).

---

## 5. Lista consolidada de modelos a crear

**Únicos (VRoid, cara propia):**
1. Gas (base) — con conjuntos: Jaleo (Barça), Diario, Piscina, Fito, Sant Joan, Playa → **6 VRM**
2. Azul — conjuntos: ~~Jaleo~~ (hecho), Diario, Piscina, Sant Joan, Un año después, Playa → **5 VRM más**
3. Tòfol
4. Carme
5. La fabiolera
6. Padre de Azul
7. Madre de Azul
8. Padre de Gas
9. Madre de Gas
10. Eric (niño)
11. Caixer (uno, se repite)
12. Cantante del concierto
13. (Opcionales, o plantilla con ropa a juego) camarero de la calle Laurel, camarero del concierto, taxista, músicos (3)

**Plantillas para extras y multitud (F5/F6):** al menos 8 con caras y peinados distintos: mujer joven ×3, hombre joven ×3, mujer mayor, hombre mayor, niña, niño. Ropa lisa y clara (camiseta + pantalón corto o largo) para que el tinte por zonas funcione bien; exportadas **sin fusionar materiales**.

**Orden recomendado:** Gas "Jaleo" → Tòfol → Carme → fabiolera → plantillas (para cap. 1) → integrar y publicar el cap. 1 → resto por capítulo, cada uno con el OK del dueño.

---

## 6. Riesgos y trampas conocidas
- **Una persona por VRM** hasta que se haga F1.
- **Paso de cómic:** cualquier malla nueva de personaje sin `userData.noComic` pierde su material.
- **`kind === 'woman'`** está escrito a mano en varios sitios (`print.ts`, `models.ts` al sentarse, `rig.ts`): los VRM tienen `kind = "vrm:<url>"`, así que esas ramas no se aplican; revisar cada caso.
- **Exportaciones "fusionadas"** de VRoid: un solo material para todo el cuerpo; no se puede teñir por prenda sin adivinar (por eso pedir exportar sin fusionar).
- **Rendimiento en móvil:** cada VRM completo (~40k triángulos, MToon con contorno) cuesta; la multitud debe ser horneada.
- **Tamaño:** cada VRM ~6,5 MB tras `vrm_slim.py`; la primera descarga del juego no debería pasar de ~100 MB en total.
- **Fechas:** el capítulo 1 se abre el 20 de noviembre de 2026; el resto, uno al día hasta el 28.
