# Plan de reparto en VRoid: todos los personajes como Azul en el capítulo 1

Documento para la IA que maneja el ordenador del dueño (hace clics en VRoid Studio y en el Finder, escribe en la terminal). Está escrito para que pueda trabajar sin más contexto. Fecha: 11-nov-2026. **Todo lo que necesitas está en el repo de GitHub `marcmnc7/juego-azul` (rama `main`) y en las carpetas de este Mac de la tabla «Rutas».**

**Qué se quiere:** que todas las personas del juego (protagonistas, personajes con nombre y extras) se vean como **Azul en el capítulo 1**: un modelo de **VRoid Studio** (estilo anime, sombreado MToon), en lugar de los muñecos de MakeHuman que se ven hoy. Los extras también, aunque sean casi todos el mismo modelo base cambiando el género, el peinado y la ropa.

**Cómo se reparte el trabajo:**

| Parte | Quién | Qué |
|---|---|---|
| A · Crear los modelos | **Tú (la IA con clics)** | VRoid Studio: duplicar proyectos, cambiar cara, pelo, cuerpo y ropa según las fichas de este documento, exportar cada `.vrm` con el nombre exacto |
| B · Meterlos en el juego | Tú, en la terminal | Aligerar cada `.vrm` con `scripts/vrm_slim.py` **dejándolo directamente en `src/assets/vrm/<nombre>.vrm`**. Nada más: el juego lo encuentra por su nombre y lo usa en todos los sitios donde sale ese personaje |
| C · Comprobar | Tú, en el navegador | Mirar al personaje en cada capítulo donde sale (sección 6) y enseñar capturas al dueño |

**No hay que tocar código.** El juego ya tiene cada personaje enlazado a su nombre de archivo (sección 5): mientras el archivo no existe, sale el modelo de antes; en cuanto existe, sale el de VRoid.

---

## Rutas (todo en este Mac)

`~` es la carpeta del usuario (`/Users/marc`).

| Qué | Ruta |
|---|---|
| Repo del juego en GitHub | `https://github.com/marcmnc7/juego-azul` (rama `main`) |
| **Tu copia del juego** (aquí trabajas) | `~/Documents/juego-azul` |
| Este plan | `~/Documents/juego-azul/docs/PLAN-reparto-vroid.md` |
| Fichas detalladas del cap. 1 | `~/Documents/juego-azul/docs/vroid-capitulo-1.md` |
| Rayas de la camiseta del Barça (para importar en VRoid) | `~/Documents/juego-azul/docs/vroid/barca_rayas.png` |
| Script para aligerar los VRM (Python 3, sin instalar nada) | `~/Documents/juego-azul/scripts/vrm_slim.py` |
| **Proyectos de VRoid originales (no tocar)** | `~/Documents/Azul.vroid`, `~/Documents/GasFerreries.vroid`, `~/Documents/Nino.vroid`, `~/Documents/Vecina.vroid` |
| Proyectos nuevos (cada «Guardar como») | `~/Documents/reparto/<nombre>.vroid` |
| VRM recién exportados de VRoid (sin aligerar) | `~/Desktop/characters/reparto/<nombre>.vrm` |
| VRM que ya exportó el dueño | `~/Desktop/characters/Azul-Ferre1(MadeMarc).vrm` (ya está en el juego), `~/Desktop/characters/Azul-Cap2(MadeMarc).vrm`, `~/Desktop/characters/Azul-Nadar(MadeMarc).vrm` |
| **VRM aligerados, dentro del juego** (los que usa) | `~/Documents/juego-azul/src/assets/vrm/<nombre>.vrm` |
| Capturas para el dueño | `~/Desktop/characters/reparto/capturas/<nombre>-frente.png`, `<nombre>-perfil.png`, `<nombre>-juego.png` |
| Quién usa qué archivo y cuántas copias (no hace falta tocarlo) | `~/Documents/juego-azul/src/data/characters.ts` (`CAST_BY_CHAPTER`) |

### Preparar tu copia (una vez)
```
git clone https://github.com/marcmnc7/juego-azul.git ~/Documents/juego-azul
cd ~/Documents/juego-azul
npm install
mkdir -p ~/Documents/reparto ~/Desktop/characters/reparto/capturas
```
Si `~/Documents/juego-azul` ya existe: `cd ~/Documents/juego-azul && git checkout main && git pull`. Hace falta tener `git`, `node`/`npm` y `python3` (vienen con las herramientas de desarrollo del Mac; si falta alguno, avisa).

### Entregar lo hecho (al acabar cada capítulo y con el OK del dueño)
Los modelos llegan al juego del dueño por GitHub, en una rama aparte (nunca en `main`):
```
cd ~/Documents/juego-azul
git checkout -B reparto-vroid
git add src/assets/vrm/*.vrm
git commit -m "Reparto VRoid: capítulo N"
git push origin reparto-vroid
```
Solo los `.vrm` de `src/assets/vrm/`: ni proyectos `.vroid` ni capturas. Claude Code une esa rama con el juego. **Ojo: el repo es público**, así que lo que subas se puede ver; pregunta al dueño antes del primer push.

---

## 0. Reglas (obligatorias)

1. **Si un modelo no se parece al personaje, no se mete.** Ya pasó con Gas: su VRM salía con cara de chica. Antes de exportar, compara con la ficha; si dudas, para y pregunta al dueño.
2. **No toques** los archivos internos de VRoid (`.vroid` por dentro, `data.bin`). Solo se usan desde VRoid Studio.
3. **No borres ni sobrescribas** los proyectos originales (`~/Documents/Azul.vroid`, `GasFerreries.vroid`, `Nino.vroid`, `Vecina.vroid`): duplica siempre con «Guardar como».
4. **Nada se publica.** No toques el repo `marcmnc7/pm-2611` (el juego publicado) ni la rama `main` de `juego-azul`. Lo único que subes es la rama `reparto-vroid`, con el OK del dueño (ver «Rutas»).
5. **No descargues** modelos, texturas ni ropa de internet sin permiso del dueño (licencias).
6. Habla con el dueño **en español**. Enséñale capturas de cada personaje (frente y perfil) antes de pasar al siguiente grupo.
7. Los **animales** (burros, caballos, Joy, la vaca) **no** entran en este plan: se quedan como están.

---

## 1. Lo que ya hay

| Qué | Dónde |
|---|---|
| Proyecto de Azul (la referencia de estilo) | `~/Documents/Azul.vroid` |
| Proyecto de Gas del cap. 1 (**no vale**: cara femenina, sin bigote; hay que rehacerlo, ficha G0) | `~/Documents/GasFerreries.vroid` |
| Proyecto de un niño | `~/Documents/Nino.vroid` |
| Proyecto de una vecina (mujer) | `~/Documents/Vecina.vroid` |
| Azul del cap. 1, exportada e integrada en el juego | `~/Desktop/characters/Azul-Ferre1(MadeMarc).vrm` → `src/assets/vrm/azul_ferreries.vrm` |
| Azul del cap. 2 vestida y en la piscina (exportadas por el dueño, **sin integrar**) | `~/Desktop/characters/Azul-Cap2(MadeMarc).vrm`, `Azul-Nadar(MadeMarc).vrm` |
| Fichas detalladas del cap. 1 (Gas, Carme, Tòfol, fabiolera, pistolas de agua) | `~/Documents/juego-azul/docs/vroid-capitulo-1.md` |
| Plan técnico anterior (arquitectura, multitud, rendimiento) | `~/Documents/juego-azul/docs/PLAN-personajes.md` |
| Rayas de la camiseta del Barça | `~/Documents/juego-azul/docs/vroid/barca_rayas.png` |

Repo del juego: `~/Documents/juego-azul` (ver «Rutas»). Para probar: `npm run dev` y abrir `http://localhost:5173/?hq#test` (o el puerto que diga Vite).

---

## 2. Cómo trabajar en VRoid Studio (paso a paso, con clics)

### 2.1 Crear un personaje a partir de una base
1. Abre **VRoid Studio**. En la pantalla de inicio, **Abrir** (Open) y elige la base que diga la ficha (sección 3: B-MUJER, B-HOMBRE, B-NIÑO…).
2. Nada más abrirlo: **Archivo → Guardar como** (File → Save As) con el nombre de la ficha, p. ej. `~/Documents/reparto/tofol.vroid`. Trabaja siempre sobre la copia.
3. Pestañas de arriba (los nombres pueden salir en español o en inglés):
   - **Cara / Rostro (Face):** forma de la cara, ojos (tamaño, color de iris), cejas, nariz, boca. Para barba, bigote o arrugas: en la cara, **Editar textura** (Edit texture) → capa nueva → pincel suave, como dice la ficha.
   - **Peinado (Hairstyle):** elige un peinado de la lista de prediseñados y ajusta el color en la paleta (código `#rrggbb` de la ficha). Para un peinado de la lista, basta pulsar su miniatura.
   - **Cuerpo (Body):** sexo/forma, altura, hombros, cintura, cuello. La altura la da la ficha.
   - **Atuendo / Ropa (Outfit):** camiseta (Tops), pantalón/falda (Bottoms), calzado (Shoes). Elige la prenda prediseñada y cambia el color en su textura (**Editar textura** → rellenar con el color de la ficha). Para un estampado (Barça, caballo, Fito), importa la imagen como capa en la textura de la camiseta.
   - **Accesorios:** solo si la ficha lo pide (gafas, gorra). Sombreros, cascos, delantales, instrumentos y móviles **los pone el juego**: no los añadas.
4. Comprueba con la cámara del editor: **de frente, de perfil y de cuerpo entero**. Haz una captura de cada vista (te las pedirá el dueño).
5. **Archivo → Guardar** (Save).

### 2.2 Exportar
1. Botón **Exportar** (Export, arriba a la derecha) → **Exportar como VRM** (Export as VRM).
2. Opciones (las mismas que Azul):

| Opción | Valor |
|---|---|
| Versión de VRM | **VRM 1.0** |
| Reducir polígonos | Pelo: sí (reducción media) · cuerpo: no |
| Resolución del atlas de texturas | **2048** para Azul, Gas y los de cerca (C); **1024** para el resto |
| Número de materiales | **No fusionar la ropa** (si hay casilla de «fusionar materiales» o «reducir materiales», déjala desactivada) |
| Borrar mallas transparentes | Sí |
| Datos del avatar (nombre, autor) | Nombre = id de la ficha; autor = Marc |

3. Guarda el `.vrm` en `~/Desktop/characters/reparto/` con el **nombre exacto de la ficha** (p. ej. `tofol.vrm`). Sin espacios ni acentos.

### 2.3 Aligerar y dejar en el juego (terminal)
```
cd ~/Documents/juego-azul
python3 scripts/vrm_slim.py ~/Desktop/characters/reparto/tofol.vrm src/assets/vrm/tofol.vrm
```
- El script quita expresiones de cara que no se usan y la miniatura (11 MB → ~6,5 MB). Si da error, **no** copies el archivo sin aligerar: avisa.
- Comprueba el tamaño: ≤ 7 MB para los de cerca, ≤ 4 MB para extras (atlas 1024).

---

## 3. Las bases (para que todo el reparto sea coherente)

Todas las caras salen de **dos proyectos** (Azul y el nuevo Gas): así todos parecen del mismo dibujante. Antes de nada, crea estas bases (`~/Documents/reparto/`):

| Base | Se hace desde | Qué cambiar respecto a su origen |
|---|---|---|
| **B-MUJER** `base_mujer.vroid` | `Azul.vroid` | Pelo castaño medio, ojos marrones, ropa lisa: camiseta blanca y vaqueros. Cara un poco distinta de Azul (ojos algo más redondos, nariz algo más corta) para que los extras no sean clones de ella |
| **B-HOMBRE** `base_hombre.vroid` | **El Gas nuevo (ficha G0)** una vez aprobado | Sin bigote ni perilla, pelo castaño corto liso, camiseta blanca, vaqueros |
| **B-MAYOR-M** `base_mayor_mujer.vroid` | B-MUJER | 55-65 años: cara algo más ancha, arrugas suaves pintadas (comisuras y ojos), pelo corto gris o castaño, cuerpo algo más ancho de cintura |
| **B-MAYOR-H** `base_mayor_hombre.vroid` | B-HOMBRE | 55-65 años: entradas, pelo gris, barriga ligera, arrugas suaves |
| **B-NIÑO** `base_nino.vroid` | `Nino.vroid` | Ropa lisa (camiseta y pantalón corto). 1,30 m |
| **B-NIÑA** `base_nina.vroid` | `Nino.vroid` | Pelo largo con coleta, 1,30 m |

Los extras (sección 4.3) salen de estas bases cambiando **solo** peinado, color de pelo, piel, ropa y altura.

---

## 4. Fichas

Distancia en el juego: **C** = de cerca (diálogos, escenas de cine), **M** = media distancia, **L** = lejos.

### 4.1 Protagonistas

**Azul (Margaux)** — mujer, 1,66 m, rubia miel (`#cfa767`) con melena por los hombros, ojos verdes (`#2f9e5b`). Sale de `Azul.vroid`; cada conjunto es **la misma cara y el mismo pelo**, solo cambia la ropa (Guardar como `azul_<conjunto>.vroid`).

| Archivo | Capítulos | Ropa |
|---|---|---|
| `azul_ferreries.vrm` | 1 | **Hecho** (mono negro) |
| `azul_diario.vrm` | 2 (vestida), 3, 4, 7, 8, misiones del 9 | Top corto blanco de punto (`#f2eee6`), vaqueros azules (`#4a6f9c`), zapatillas blancas. **Mirar primero** `Azul-Cap2(MadeMarc).vrm`: si es este conjunto, se usa ese |
| `azul_piscina.vrm` | 2 (piscina, césped, estrellas) | Bañador o biquini. **Mirar primero** `Azul-Nadar(MadeMarc).vrm` |
| `azul_moto.vrm` | 5 | Como el diario, con chaqueta/sudadera oscura (`#2a2624`) por la tramontana. El casco lo pone el juego |
| `azul_santjoan.vrm` | 6 | Camiseta blanca con un caballo dibujado (estampado negro en el pecho), pantalón corto azul claro (`#6f8fb8`) |
| `azul_aniversario.vrm` | 9 | Vestido azul claro (`#5aa9e6`) por la rodilla, sandalias |
| `azul_playa.vrm` | 9 (vóley) | Top del diario y pantalón corto vaquero, descalza o con chanclas |

**Gas (Marc)** — hombre, 1,80 m. **Ficha G0** (la base de todos sus conjuntos) en `docs/vroid-capitulo-1.md`, sección 1: ojos pequeños y alargados, cejas gruesas rectas, mandíbula marcada, **bigote fino y perilla** pintados en la cara (`#3a2618`), pelo castaño oscuro (`#84593a`) **rizado con volumen arriba**, corto de lados. Que se le reconozca como un chico de 30 años: si sale femenino, ojos más pequeños y cejas más gruesas. **El dueño tiene que aprobar G0 antes de hacer los conjuntos.**

| Archivo | Capítulos | Ropa |
|---|---|---|
| `gas_ferreries.vrm` | 1 | Camiseta del Barça (`docs/vroid/barca_rayas.png`), pantalón corto azul marino (`#1f2a44`), zapatillas blancas |
| `gas_diario.vrm` | 2 (vestido), 3, 7, 8, 9, misiones | Camiseta verde militar (`#5b6b3a`), vaqueros (`#3f5f8a`) |
| `gas_piscina.vrm` | 2 | Bañador corto azul |
| `gas_fito.vrm` | 4 | Camiseta azul de Fito (`#1f4fa8`) con el nombre del grupo en el pecho, vaqueros |
| `gas_moto.vrm` | 5 | Chaqueta de moto oscura (`#24201e`), vaqueros. El casco lo pone el juego |
| `gas_santjoan.vrm` | 6 | Camiseta blanca con el caballo, pantalón corto azul marino (`#2d3a55`) |
| `gas_playa.vrm` | 9 (vóley) | Camiseta verde y bañador |

### 4.2 Personajes con nombre (VRM propio)

| Archivo | Quién (capítulo, distancia) | Base | Ficha |
|---|---|---|---|
| `tofol.vrm` | Tòfol, el del bar de Ferreries (1, 9 · C) | B-MAYOR-H | `docs/vroid-capitulo-1.md` §3: 60 años, pelo y barba corta gris (`#9a9a9a`), piel morena (`#d9a27c`), camiseta blanca, pantalón corto azul grisáceo. El delantal lo pone el juego |
| `carme.vrm` | Carme, amiga de Azul (1, 9 · C/M) | B-MUJER | §2: 1,64 m, rubia clara (`#f3dc8f`) corta tipo bob, ojos azules, el mismo mono negro que Azul |
| `fabiolera.vrm` | La fabiolera (1, 9 · M) | B-MUJER | §4: moño bajo castaño (`#5a3a22`), blusa negra, pantalón blanco largo. Bombín y tamborí los pone el juego |
| `amigo_imperi.vrm` | Amigo de la terraza del Imperi (2 · M) | B-HOMBRE | Pelo castaño oscuro corto, camiseta blanca, pantalón largo azul grisáceo (`#3b4a6b`) |
| `amiga_imperi_1.vrm` | Amiga del Imperi (2 · M) | B-MUJER | Melena larga castaña (`#5a3a22`), camiseta verde azulado (`#1b998b`), falda negra |
| `amiga_imperi_2.vrm` | Amiga del Imperi (2 · M) | B-MUJER | Coleta castaño claro (`#b07a3a`), camiseta roja (`#d7263d`), pantalón negro |
| `camarero_laurel.vrm` | Camarero de los pinchos (3 · M) | B-HOMBRE | Pelo castaño oscuro corto, barba corta, camisa blanca, pantalón negro |
| `camarero_fito.vrm` | Camarero de la barra del concierto (4 · C/M) | B-HOMBRE | Piel morena (`#c98e64`), pelo negro corto, todo de negro |
| `agente_aeropuerto_h.vrm` / `agente_aeropuerto_m.vrm` | Personal de Barajas (4 · M) | B-HOMBRE / B-MUJER | Uniforme azul marino (`#1f2d4d`): polo y pantalón; ella con melena recogida |
| `fito.vrm` | El cantante (4 · M) | B-MAYOR-H (unos 55) | Rockero estilizado, **sin buscar parecido fotográfico**: pelo corto negro con canas, perilla, camisa negra, vaqueros negros. Sombrero y guitarra los pone el juego |
| `bajista.vrm`, `saxofonista.vrm`, `bateria.vrm` | Músicos (4 · M) | B-HOMBRE / B-MAYOR-H | Bajista: pelo largo castaño, camisa gris oscura. Saxo: piel morena, camisa amarilla (`#f4d35e`). Batería: pelo gris, camisa blanca. Pantalón negro los tres |
| `taxista.vrm` | Taxista (6 · M, sentado) | B-MAYOR-H | Pelo gris oscuro corto, camisa blanca, pantalón oscuro |
| `caixer.vrm` | Caixer a caballo (6 · M; se repite) | B-HOMBRE | Frac negro, camisa blanca, pantalón blanco ajustado, botas negras. El bombín lo pone el juego |
| `padre_azul.vrm` | Padre de Azul (7, 8 · C/M) | B-MAYOR-H | Pelo gris (`#b8b8b8`), barba corta gris, polo azul marino (`#2c3e66`), pantalón beige (`#cbb994`) |
| `madre_azul.vrm` | Madre de Azul (7, 8 · C/M) | B-MAYOR-M | Pelo castaño liso (`#7a5232`) media melena, blusa crema (`#f4efe2`), falda granate (`#9a4d5e`) |
| `vecino.vrm` | El vecino del coche (7 · L, conduce) | B-HOMBRE | Pelo castaño (`#4a3a2a`), camiseta verde oliva (`#6a7a5a`) |
| `padre_gas.vrm` | Padre de Gas (8 · C) | B-MAYOR-H | Pelo gris (`#7d7672`), camisa azul claro (`#6b8fb5`), pantalón gris. **Que se parezca un poco a Gas** (misma forma de ojos y cejas) |
| `madre_gas.vrm` | Madre de Gas (8 · C) | B-MAYOR-M | Pelo castaño oscuro liso (`#5a3a26`), blusa rosa fuerte (`#c85a6a`), pantalón oscuro |
| `eric.vrm` | Eric, el niño (8 · C/M) | B-NIÑO | Rubio (`#d9b56a`), camiseta amarilla (`#f2c94c`), pantalón azul (`#3b6ea8`) |

### 4.3 Extras (todos desde las bases, en lotes)

Para cada lote: abre la base, **Guardar como** con el nombre, cambia solo lo de la tabla, exporta con atlas **1024**. Un archivo por fila; **no hagas más de los que pide la tabla** (el juego no buscaría los que no conoce).

| Archivo | Base | Pelo | Ropa | Lo usan |
|---|---|---|---|---|
| `extra_m1.vrm` | B-MUJER | Melena larga castaña | Camiseta blanca, shorts vaqueros | Cap. 1 y 9 (pistolas de agua), cap. 5 (conductora) |
| `extra_m2.vrm` | B-MUJER | Coleta negra | Camiseta amarilla (`#f4d35e`), pantalón corto marrón | Caps. 1 y 9 (pistolas de agua) |
| `extra_h1.vrm` | B-HOMBRE | Corto moreno | Camiseta verde azulado (`#1b998b`), pantalón corto negro | Caps. 1 y 9 (pistolas de agua) |
| `extra_h2.vrm` | B-HOMBRE | Corto castaño claro | Camiseta roja (`#d7263d`), pantalón corto vaquero | Caps. 1 y 9 (pistolas de agua) |
| `extra_h3.vrm` | B-HOMBRE | Rapado, barba corta | Chaqueta oscura (`#1b1b22`), vaqueros | Cap. 5 (motero de frente) |
| `extra_h4.vrm` | B-HOMBRE | Corto castaño | Camiseta granate (`#8a2a2a`), pantalón oscuro | Cap. 5 (motero y conductor) |
| `extra_mayor_m.vrm` | B-MAYOR-M | Corto gris | Camiseta azul clara (`#5aa9e6`), pantalón claro | Cap. 8 (paseante de Sa Farola) |
| `extra_mayor_h.vrm` | B-MAYOR-H | Gris, entradas | Camiseta blanca, pantalón azul | Cap. 8 (paseante de Sa Farola) |
| `nino_1.vrm` … `nino_3.vrm` | B-NIÑO / B-NIÑA | Corto castaño · coleta · rizado | Camisetas rosa, turquesa, naranja; pantalón corto | Cap. 1 (guerra de agua) |

El resto de la gente (los viajeros de Barajas, el público, la calle Laurel, los burros de Ferreries, el Born de Sant Joan) va con las **multitudes** (abajo).

**Multitudes** (cientos de personas en la plaza de Ferreries, el concierto y el Born de Sant Joan): no se hacen con VRM completos (el móvil no aguanta). Se hacen con **plantillas ligeras** a partir de 4 de los extras de arriba (`extra_m1`, `extra_m2`, `extra_h1`, `extra_h2`) con `scripts/crowd_lod.mjs`. Eso es trabajo de código (sección 5.3): tú solo exporta esos cuatro también **sin fusionar materiales**.

---

## 5. Meterlos en el juego (ya preparado en el código)

Hecho por Claude Code el 10-nov-2026:
- **Registro por nombre** (`src/data/characters.ts`): cada archivo de `src/assets/vrm/` se encuentra por su nombre sin extensión (`castVrm('tofol')`). Cada personaje del juego tiene puesto su nombre (`castLook(look, 'tofol')`); si el archivo no está, sale con su modelo de antes.
- **Varias personas con el mismo VRM** (las dos Azul del cap. 3 en el coche y en el camping, los nueve caixers…): cada una lleva su propia copia (cara, pelo y huesos), y las copias comparten geometría y texturas, así que apenas gastan memoria.
- **Carga por capítulo**: al empezar un capítulo se cargan solo sus VRM (lista `CAST_BY_CHAPTER` en `characters.ts`, con cuántas copias de cada uno) y se sueltan los del anterior.
- La altura de cada uno sale de su nombre (`vrmHeight`): Azul 1,66; Gas 1,80; niños 1,30; mujeres 1,63; hombres 1,74; los de altura propia (Carme, Tòfol, Eric, los padres…) están en la tabla `HEIGHT`.
- Los estampados que el juego pegaba en el pecho (caballo de Sant Joan, Fito) no se pegan en un VRM: **píntalos en la textura de la camiseta en VRoid**.

**Lo único que tienes que hacer tú por cada archivo:**
```
python3 scripts/vrm_slim.py ~/Desktop/characters/reparto/<nombre>.vrm src/assets/vrm/<nombre>.vrm
```
con el nombre **exacto** de la ficha (sección 8). Si el nombre no coincide, el juego no lo encuentra (no da error: sigue el modelo de antes).

**Si un nombre necesita más copias** (en la consola del modo prueba sale `[rig] no queda copia libre de …`): sube su número en `CAST_BY_CHAPTER` de `src/data/characters.ts` y avisa a Claude Code.

### Multitudes (código, lo hace Claude Code)
Fase F6 de `docs/PLAN-personajes.md`: plantillas con `scripts/crowd_lod.mjs` a partir de `extra_m1`, `extra_m2`, `extra_h1` y `extra_h2`, conectar `crowdRig.ts` y medir fps en el móvil (≥ 30).

---

## 6. Cómo se comprueba cada personaje (en el navegador)
1. `cd ~/Documents/juego-azul && npm run dev` y abrir en el navegador la dirección que salga (normalmente `http://localhost:5173/`) con `?hq#test` al final: `http://localhost:5173/?hq#test`.
2. En la consola: `__dbg.go(n)` (n = capítulo; orden del juego: 1 Jaleo, 2 Piscinita, 3 Ruta, 4 Fito, 5 Moto, 6 Sant Joan, 7 Cena, 8 Eclipse, 9 Un año después), `__dbg.skip()` pasa diálogos, `__dbg.level().debug()` lista las fases (`.run()` salta a una).
3. Para cada personaje nuevo, en cada fase donde sale:
   - se ve el VRM (no el muñeco de antes) y se le reconoce;
   - de pie, andando, sentado (terrazas, camping, cena, taxi, kayak, roca) y en vehículos: sin piernas atravesando el asiento ni flotando;
   - lo que pone el juego encima (casco, sombrero, delantal, móvil, guitarra) queda en su sitio;
   - la boca se mueve al hablar y parpadea;
   - la consola, sin errores.
4. Capturas de frente y perfil (en VRoid) y una dentro del juego, en `~/Desktop/characters/reparto/capturas/`, para el dueño. **Si el dueño no lo reconoce, se queda el modelo de antes** (borra su archivo de `src/assets/vrm/`).

---

## 7. Orden de trabajo (por calendario: los capítulos se abren del 20 al 28 de noviembre)

1. **G0 · Gas nuevo** → aprobación del dueño. Sin esto no se hace nada de Gas ni la base de hombre.
2. Bases B-MUJER, B-HOMBRE, B-MAYOR-M, B-MAYOR-H, B-NIÑO, B-NIÑA.
3. **Cap. 1** (20-nov): `gas_ferreries`, `tofol`, `carme`, `fabiolera`, `nino_1…3`, `extra_m1`, `extra_m2`, `extra_h1`, `extra_h2`.
4. **Cap. 2** (21-nov): `azul_diario` (o el `Azul-Cap2` del dueño), `azul_piscina` (o `Azul-Nadar`), `gas_diario`, `gas_piscina`, los tres del Imperi.
5. **Cap. 3** (22-nov): `camarero_laurel`.
6. **Cap. 4** (23-nov): `gas_fito`, `camarero_fito`, `agente_aeropuerto_h`, `agente_aeropuerto_m`, `fito`, `bajista`, `saxofonista`, `bateria`.
7. **Cap. 5** (24-nov): `azul_moto`, `gas_moto`, `extra_h3`, `extra_h4`.
8. **Cap. 6** (25-nov): `azul_santjoan`, `gas_santjoan`, `taxista`, `caixer`.
9. **Cap. 7** (26-nov): `padre_azul`, `madre_azul`, `vecino`.
10. **Cap. 8** (27-nov): `padre_gas`, `madre_gas`, `eric`, `extra_mayor_m`, `extra_mayor_h`.
11. **Cap. 9** (28-nov): `azul_aniversario`, `azul_playa`, `gas_playa`.

Después de cada capítulo: capturas al dueño y, solo con su permiso, entrega por la rama `reparto-vroid` (ver «Rutas»). Publicar el juego (el repo `pm-2611`) no es cosa tuya: lo hace el dueño con Claude Code.

---

## 8. Lista de archivos (para ir tachando)

**Protagonistas (13):** azul_diario · azul_piscina · azul_moto · azul_santjoan · azul_aniversario · azul_playa · gas_ferreries · gas_diario · gas_piscina · gas_fito · gas_moto · gas_santjoan · gas_playa

**Con nombre (22):** tofol · carme · fabiolera · amigo_imperi · amiga_imperi_1 · amiga_imperi_2 · camarero_laurel · camarero_fito · agente_aeropuerto_h · agente_aeropuerto_m · fito · bajista · saxofonista · bateria · taxista · caixer · padre_azul · madre_azul · vecino · padre_gas · madre_gas · eric

**Extras (11):** extra_m1 · extra_m2 · extra_h1 · extra_h2 · extra_h3 · extra_h4 · extra_mayor_m · extra_mayor_h · nino_1 · nino_2 · nino_3

**Bases (6, no van al juego):** base_mujer · base_hombre · base_mayor_mujer · base_mayor_hombre · base_nino · base_nina
