# Revisión de las animaciones de los personajes

Revisión hecha el 8 de noviembre de 2026 sobre el código de `main` y midiendo en el juego (capítulo 1, Azul con su VRM, `?hq#test`). Complementa a `docs/PLAN-personajes.md`: aquí está **qué falla en el movimiento, por qué y cómo arreglarlo**, por prioridad.

---

## 1. De dónde salen hoy las animaciones

Solo hay **5 capturas de movimiento** y un baile:

| Clip | Duración | Origen | Uso |
|---|---|---|---|
| `idle` | 2,50 s | `src/assets/chars/anims.glb` | De pie |
| `walk` | 0,97 s | ídem | Andar |
| `run` | 0,70 s | ídem | Correr |
| `agree` | 1,83 s | ídem | Asentir (gesto suelto en reposo, "charlar") |
| `headShake` | 2,57 s | ídem | Negar (multitud) |
| `SambaDance` | 18,2 s | `src/assets/chars/woman.glb` | **Todo** el baile del juego (Azul, Gas, Carme, la multitud) |

Son las animaciones del muñeco de ejemplo de three.js (Xbot, de Mixamo): pensadas para un maniquí, sin variantes, sin salto, sin giros, sin sentarse.

Todo lo demás **no es animación**, son ángulos calculados por código en `animatePerson` (`src/entities/models.ts`) y en cada nivel, que **sustituyen** a la captura en el brazo, pierna o tronco que tocan (`rig.ts` → `updateOne`, grupos `body/head/armL/armR/legL/legR`):
saludar (`wave`), hablar (`talk`), celebrar (`cheer`), sentarse, llevar cosas en la mano (pomadas, vasos), acariciar, besar/abrazar (`embrace.ts`), nadar (`level4.ts`), ir en moto o en coche, tirarse a la piscina, kayak…

El salto tampoco tiene animación: el clip `air` es **el de correr congelado en el 30 %** (`rig.ts`, `act.air`, `timeScale = 0`).

---

## 2. Problemas, por prioridad

### P1 · Correr (lo que más se nota)
**Medido:** el jugador corre a **5,2 m/s** (hasta ~6,5 con el acelerón de `walker.boost`). El clip `run` está hecho para unos **3 m/s**; para seguir el ritmo el juego lo acelera hasta el tope (`run.timeScale` = 1,6, límite en `updateOne`) y **aun así no llega**:
- Cadencia de **~270 pasos por minuto** (lo natural corriendo es 160–180): piernas frenéticas con zancada corta.
- **Los pies patinan**: velocidad media del pie apoyado en el suelo ~0,37 m/s (debería ser ~0).
- El clip es un trote de maniquí: tronco recto, brazos bajos y rígidos.

**Además, en el capítulo 1 corre con los brazos bloqueados delante del pecho** (capturas): llevar las pomadas pone `armR` (y `armL` con dos) en un ángulo fijo (`level1.ts`, `held > 0`), y `rig.ts` sustituye **todo el brazo**, así que deja de balancearse.

**Arreglo:**
1. Clips nuevos de **trote (~3 m/s), carrera (~5 m/s) y sprint (~6,5 m/s)**, en el sitio (sin desplazamiento), y mezclar por velocidad (como ya se hace entre andar y correr) en vez de acelerar un solo clip. Bajar el tope de `timeScale` a ~1,2.
2. Alternativa barata si no hay clips: bajar la velocidad punta a ~4 m/s (`walker.speed`) para que el clip actual no tenga que ir al 1,6×.
3. Llevar cosas sin congelar el brazo: que la mano siga a un punto delante del pecho con **IK de dos huesos** (ya existe `twoBone` en `embrace.ts`) y dejar que el hombro y el tronco sigan la captura; o un clip de "correr con algo en la mano".

### P2 · El cuerpo no se inclina (personajes con esqueleto)
`walker` calcula inclinación al acelerar (`leanFwd`) y hacia dentro en las curvas (`leanSide`), y `animatePerson` la aplica al cuerpo… **antes** de `rigSnapshot`. `rig.ts` solo aplica lo que cambia **después** de la foto, así que en Azul VRM y en todos los MakeHuman **la inclinación se pierde**: corren y giran tiesos.

**Arreglo:** para personas con `rig`, pasar la inclinación por `leanTorso(p, x, y, z)` (que ya existe y reparte el giro por la columna) en lugar de por `p.body.rotation`. Es un cambio pequeño en `animatePerson`.

### P3 · Saltar
Una pose de correr congelada desde que despega hasta que aterriza. No hay impulso ni aterrizaje (el aplastamiento al caer existe en `walker.land`, pero no llega al esqueleto).

**Arreglo:** clips de **salto: impulso, en el aire (bucle) y aterrizaje**; elegir según `walker.vy` (sube/baja) y al tocar suelo reproducir el aterrizaje ~0,25 s.

### P4 · Arrancar, frenar y girar en el sitio
- Al girar parada, el cuerpo rota sobre sí mismo con los pies quietos en la animación: **los pies patinan**.
- Arranque y frenada son solo mezcla idle↔andar/correr (sin pasos de arranque ni de frenada).

**Arreglo:** clips de **giro en el sitio (90° y 180°)** y **paradas** (correr → parar), o fijar los pies al suelo con IK cuando la velocidad es baja (bloqueo de pies).

### P5 · Gestos por código (saludar, hablar, celebrar, acariciar)
Se ven mecánicos: senos perfectos, el brazo entero rígido desde el hombro, sin seguir el resto del cuerpo. En diálogos (que hay muchísimos) es lo que más se ve de cerca.

**Arreglo:** clips capturados de **saludar, hablar gesticulando (2–3 variantes), celebrar/aplaudir, acariciar/alcanzar algo** y **asentir/negar** ya existentes. Dejar el código solo para lo que tiene que apuntar a algo concreto (la mano al burro, al vaso), con IK.

### P6 · Sentarse, conducir, ir de paquete
Piernas dobladas a mano (`legL.rotation.x = -1.45`, `body.position.y = -0.4` en `level1.ts`, terraza, camping, taxi, cena, roca, coche y moto) y la cadera ajustada con números distintos según `kind === 'woman'` (no vale para los VRM). Rodillas y cadera suelen quedar raras y los brazos colgando.

**Arreglo:** clips de **sentado (en silla, en el suelo con piernas cruzadas, en la roca), conductor de coche, paquete de moto abrazada**, y una sola regla de altura de cadera para todos (medida del propio esqueleto, no por tipo).

### P7 · Baile
Una sola samba para todos, también para el baile de Azul y Gas (capítulo 1) y para cientos de personas de la multitud: se ve repetido y no pega con la música de cada momento.

**Arreglo:** 4–6 bailes cortos (fiesta de pueblo, bailar en pareja suave para Azul y Gas, saltar en un concierto, mover los brazos arriba) y repartirlos en la multitud con desfase.

### P8 · Nadar
Hecho por código en `level4.ts` (capítulo 2). No lo he visto en el juego en esta revisión: **revisar visualmente**. Lo natural sería clips de **braza y flotar en el sitio**.

### P9 · Reposo y conversación
`idle` es el del maniquí (postura neutra, masculina). Los gestos sueltos son solo `agree` (asentir) a ratos.

**Arreglo:** 2–3 reposos (femenino, masculino, con peso en una pierna, brazos cruzados) y elegir según el personaje; mirar a quien habla (en los VRM se puede usar `vrm.lookAt`).

### P10 · Multitud horneada
Usa los mismos clips (idle, asentir, negar, samba, andar; beber y móvil por IK) a **15 fotogramas por segundo** (`crowdRig.ts`, `FPS`). De lejos vale; los que están cerca se notan algo entrecortados. Con más clips (P5, P7, P9) ganaría mucha variedad sin coste extra en tiempo de juego (solo al hornear).

### Lo que está bien
- Retargeting en espacio mundo (`retargetClip`): funciona igual con MakeHuman y con VRM (por eso Azul VRM anda bien sin tocar nada).
- Andar: a ~1,5 m/s el clip encaja y apenas patina.
- Mezcla andar↔correr sincronizando la fase de los dos clips.
- Cara de los VRM (parpadeo, sonrisa, boca al hablar) y pelo con física.

---

## 3. De dónde sacar las animaciones nuevas

1. **Mixamo** (Adobe, gratis con cuenta): cientos de capturas en el mismo esqueleto que ya usa el juego (`mixamorig`), **así que entran sin tocar el retargeting**. Descargar "In Place", sin piel (sin malla), FBX → convertir a glTF (Blender o `FBX2glTF`) y juntar en `anims.glb`. Uso en juegos permitido (revisar sus términos).
2. **Quaternius – Universal Animation Library** (gratis; según su autor CC0, **comprobar la licencia** antes): correr, saltar, sentarse, saludar, nadar, bailar… en un esqueleto humanoide propio; necesitaría un mapa de nombres de huesos a Mixamo (como el de `vrm.ts`).
3. **Animaciones VRMA** (formato de animación de VRM): hay paquetes gratuitos de pixiv/VRoid; solo servirían para los personajes VRM, no para la multitud.

Lista mínima para cubrir P1–P9 (~30 clips): trote, correr, sprint, salto (3), giro 90°/180°, parar, 3 reposos, 3 hablar, saludar, aplaudir/celebrar, alcanzar/acariciar, beber, sentado (silla, suelo, roca), conductor, paquete de moto, 5 bailes, braza, flotar.

---

## 4. Orden recomendado (para quien lo implemente)

| # | Tarea | Esfuerzo | Efecto |
|---|---|---|---|
| 1 | P2: inclinación con `leanTorso` en personajes con esqueleto | Pequeño (código) | Medio |
| 2 | P1.3: llevar cosas con IK sin congelar el brazo (capítulo 1) | Pequeño–medio | Alto en el cap. 1 |
| 3 | P1.1: trote/carrera/sprint mezclados por velocidad (o P1.2 si no hay clips a tiempo) | Medio | **Muy alto** |
| 4 | P3: salto en tres fases | Medio | Alto |
| 5 | P5 + P9: gestos y reposos capturados en diálogos | Medio | Alto (se ve de cerca) |
| 6 | P6: sentarse/conducir con clips | Medio | Medio |
| 7 | P7: bailes variados (incluido el de Azul y Gas) | Medio | Medio |
| 8 | P4: giros y paradas / bloqueo de pies | Medio–alto | Medio |
| 9 | P8, P10 | Medio | Bajo–medio |

Para el capítulo 1 (se abre el 20 de noviembre) bastan 1–4 y el baile de pareja de P7.

**Cómo comprobar cada cambio:** en `?hq#test`, `__dbg.go(1)`, correr en línea recta por la calle de salida y medir: `rig.act.run.timeScale` (debería quedar ≤ 1,2), velocidad del pie apoyado (≈ 0) y capturas de perfil a 4 fotogramas por ciclo. Ver la técnica de capturas en `docs/PLAN-personajes.md` (sección 2).

---

## 5. Aplicado (8 de noviembre de 2026)

Con los clips CC0 de Quaternius (`src/assets/chars/anims_ual.glb` y `anims_ual_2.glb`, 0,8 MB; ver `CREDITOS-animaciones.txt` y `scripts/anims_ual.mjs`), adaptados a todos los personajes con el mismo retargeting:

- **P1 Correr:** andar, trote y sprint mezclados por velocidad, con pesos lineales y los tres clips sincronizados en fase (pie izquierdo adelantado a la vez). Velocidad natural de cada clip = zancada × factor por tipo de marcha (`STRIDE_FACTOR` en `rig.ts`: los clips de la librería apenas apoyan el pie, así que medir "el pie apoyado" no sirve). Resultado en Azul: andar 1,0 m/s, trote 3,2, sprint 5,0; a 5,2 m/s el sprint va a ~1,05× (antes, el trote de Mixamo a 1,6× y con tope). Ritmo límite por clip 0,55×–1,3×.
- **P1.3 Llevar cosas:** `carryHand(persona, 'R'|'L')` (rig.ts) lleva la mano con IK delante del pecho, con algo del balanceo, y la mantiene recta; el resto del cuerpo sigue la carrera. Usado con las pomadas del capítulo 1.
- **P2 Inclinación:** `animatePerson` ya no pone la inclinación en el muñeco para personajes con esqueleto: va a `rig.lean` y `rig.ts` la aplica (adelante con la columna, hacia dentro en curvas desde la cadera).
- **P3 Salto:** en el aire, el clip `jumpLoop`; al tocar suelo, `jumpLand` desde el golpe (cadera más baja). Ojo: **el jugador no tiene botón de saltar** (`requestJump` no se llama en ningún sitio); esto solo se ve cuando el juego levanta a alguien del suelo.
- **P4 Girar parado:** pasitos con el clip de andar cuando gira sin avanzar (antes pivotaba con los pies clavados).
- **P5 Hablar:** el modo `talk` usa el clip de hablar gesticulando; los brazos solo los manda el código si el nivel los coloca (p. ej. la fabiolera tocando). Saludar solo fuerza el brazo que saluda.
- **P7 Baile:** cada persona baila la samba o el segundo baile, al azar.
- **P9 Reposo:** gestos sueltos variados (asentir, decir que sí).
- **Arreglo de paso:** el bombín de la fabiolera flotaba 4–5 cm sobre la cabeza.

**Pendiente:** saludar, celebrar, más bailes y bailar en pareja (no hay clips libres en estas librerías: harían falta de Mixamo); sentarse, conducir y nadar con clips (los clips ya están cargados: `sit`, `sitTalk`, `drive`, `swim`, `swimIdle`; falta usarlos en cada nivel, y esos niveles son de los capítulos 2 en adelante); multitud horneada con los clips nuevos; botón de saltar si se quiere.
