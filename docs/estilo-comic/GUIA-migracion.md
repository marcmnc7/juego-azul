# Guía: migrar un capítulo como se migró el 2

Lo aprendido en las siete pasadas del capítulo 2 (`progreso-cap2.md`), escrito como receta para los demás capítulos. El plan general sigue en `docs/PLAN-estilo-comic.md`; esto es lo que el dueño pidió **además** del aspecto de tebeo, y que en el cap. 2 hubo que descubrir a base de quejas.

**Migrado no es solo «se ve en cómic»: es que se ve como el cap. 1, que todo tiene sentido en la vida real, que se juega sin pistas de más y que no hay ni un fallo.**

---

## 1. Lo que el dueño mira (y en qué orden se quejó)

| # | Qué | Regla | Cómo se hizo en el cap. 2 |
|---|---|---|---|
| 1 | Parecido con el cap. 1 | Mismas casas, mismo dibujo, misma tinta, misma luz | Casas con zócalo, cantoneras, cornisa y ventanas de marès con persianas (`menorcaTrim`, `menorcaWindow`); superficies dibujadas (D2) |
| 2 | Cosas que «no se sabe qué son» | Todo lo que se ve tiene que leerse a la primera | El abanico de los faros, los rótulos cruzados por su marco, las ventanas del Ajuntament como prismas negros: fuera o rehechos |
| 3 | Luces | **Las lámparas no iluminan nada**: ni charcos, ni abanicos, ni luces de punto. Una lámpara solo se ve encendida (su halo de tebeo) | Quitadas todas las `PointLight`/`SpotLight` de farolas, faroles, faros y piscina |
| 4 | Noche | De noche, pero **ni mucho menos tan oscuro** | Perfil `noche`, `hemiScale` 0,32, luna 0xb8c8ff a 2,0 con sombras; acné de sombra con `normalBias` 0,16 y `bias` -0,0012 |
| 5 | Realismo | Nada incoherente: si no pasaría en la vida real, se arregla | Pasos de cebra de bordillo a bordillo; sin luna (era casi luna nueva ese día); casa dormida (persiana del garaje bajada, ventanas apagadas); sombrilla cerrada de noche; bar abierto con gente; carretera como la de verdad (Street View) |
| 6 | Cortes | Nada de fundido a negro para saltarse algo que se puede jugar | Salir de la piscina nadando a la escalera y andando a las toallas, sin vestirse por arte de magia |
| 7 | Personajes | Ni flotar, ni brazos rotos, ni gestos sin sentido | Tumbados medidos y apoyados en la toalla; sin saludo con el codo torcido; sin el «asentir» automático |
| 8 | Bocadillos | Salen de quien habla, con su rabito | `bark(quién, texto, lado)`; en un coche, cada uno desde su asiento (`speakerPoint`) |
| 9 | Vehículos | Arrancan ya en marcha y van a su velocidad enseguida | Sale a 4 m/s y acelera a 4,5 m/s²; frena para girar; cámara detrás del coche desde el primer fotograma |
| 10 | Camino | Nada cambia «de golpe» (de carretera a calle, de suelo a suelo) | Cruce en T de verdad, con bordillos y aceras que doblan la esquina |
| 11 | Controles | Que el jugador pueda hacer lo que el juego le pide (y fallar) | El sigilo: se puede correr y correr hace ruido; de puntillas, con el joystick poco empujado o Mayúsculas |
| 12 | Pistas | **Sin pistas** salvo si se ha perdido | Flecha, columna y marcador a los 40 s sin avanzar (`Lost`); objetivos de un emoji o dos palabras; los avisos, en boca de un personaje |
| 13 | Ritmo | **Que no sea «pim pam»**: un poco más largo, con pasos que tengan sentido | Despedirse de los amigos, ir a por las toallas, una luz que se enciende y hay que quedarse quieta, Marco Polo de 7 rondas, él sale primero y ella va cuando quiere |
| 14 | Fallos | «Revisión de bugs espectacular»: jugarlo entero y arreglar todo lo que se vea | Minijuego que se repetía, personaje que flotaba 0,6 m, gente en la calzada, recuerdo tapado… |

---

## 2. Recetas (dónde está cada cosa)

### Común a todos (hecho una vez, no hay que repetirlo)
- **Sin gesto de asentir**: `rig.fidget` (apagado por defecto en `rig.ts`). No volver a encenderlo.
- **Saludo**: `animatePerson(p, dt, 'wave')` ya es un saludo natural (brazo arriba que va de lado a lado desde el hombro). Aun así, mejor que la gente que espera **no salude**: que espere quieta mirando (`'idle'` y girarla hacia el jugador).
- **Pistas**: `new Lost()` de `core/lost.ts`. Clave de avance + `tick(clave, dt, ocupado)`; solo cuando devuelve `true` se encienden `marker`, `hud.setArrow(ángulo)` y `beacon.at(objetivo)`. Si no, `hud.setArrow(null)` y `beacon.at(null)`.
- **Pintura de la calzada**: `paintMat()` de `core/gfx.ts` en un plano a ras de suelo (sin grosor). Nunca cajas finas: la tinta les dibuja dientes de sierra.
- **Casas**: `menorcaTrim` y `menorcaWindow` de `world/menorcaHouse.ts` sobre cualquier caja encalada con `Merger`.
- **Brillo de la pintura de los coches**: `COMIC_GLOSS` (automático en `MeshPhysical` con barniz).
- **Halos de tebeo de las lámparas**: automáticos de noche (`comicHaloTexture`); bombillas de guirnalda, `comicBulbTexture`; estrellas, `comicStarTexture`.
- **Polvo de los pasos**: `dust.tint(noche)` lo hace `setLook`.

### Por capítulo
| Problema | Receta | Ejemplo |
|---|---|---|
| Un cartel o una puerta planos atravesados por su marco combado | Partir el plano en trozos (`bendable(w, h)` en `born.ts`) y separarlo 2-3 cm del marco | Rótulo del Imperi |
| Algo que se mueve sale torcido | `userData.comicBent = true` en su raíz | Coches, puertas |
| Un color cae en la superficie equivocada | `setSurface(color, Surf.X)` | Azulejo de la piscina |
| Escena de otra hora dentro del capítulo | `scene.userData.comicLook = 'noche'` o `comicMood` | Camping del 3 |
| Luz de ambiente de una escena | `scene.userData.hemiScale` (0,32 de noche en el 2; 0,35 de día en el 1) | — |
| Persona tumbada o sentada | Postura forzada (`rig.force` + rotaciones de `p.armL`…), y medir la malla ya posada para apoyarla: ver `liePose` y `restOnTowel` en `level4.ts` (se repite durante 1,5 s mientras la postura entra) | Toallas |
| Sombra redonda debajo de alguien tumbado o sentado | `blob.userData.blobOff = true` (y una sombra de contacto alargada si hace falta) | Toallas |
| Bocadillo de alguien que no se encuentra (dentro de un coche, lejos) | `speakerPoint(quién)` en el nivel; devuelve el punto del mundo de donde sale | Coche de Gas |
| Dos que hablan uno al lado del otro | `bark(quién, texto, 'l' | 'r')` | Coche de Gas |
| Un minijuego que acaba | Bandera de «hecho» para que no vuelva a empezar | `mpDone` |
| Un aviso de texto («ve a…», «pulsa…») | Bocadillo de un personaje, dicho como en la vida real, o nada | «¿Y las toallas?» |
| Un objetivo que dice qué hacer | Uno o dos emojis, o una palabra | `🤫`, `💙` |

### Lo que no se toca sin el dueño
- Personajes VRM nuevos en los capítulos 2+ (solo el cap. 1 tiene a Azul en VRM).
- El VRM de Gas (está por rehacer).
- Los datos de VRoid.
- Inventar recuerdos: los textos nuevos que no salen de la historia se marcan en el informe para que el dueño los cambie por lo que pasó de verdad.

---

## 3. Cómo se prueba
- Servidor: `http://[::1]:5179/?hq#test` (la `127.0.0.1:5179` es de otra sesión).
- `__dbg.go(n)` abre el capítulo n (orden del juego: 1 Jaleo, 2 Piscinita, 3 Ruta, 4 Fito, 5 Moto, 6 Sant Joan, 7 Cena, 8 Eclipse, 9 Aniversario); `__dbg.level().debug()` da las fases (`run()`); `__dbg.skip()` pasa diálogos; `__dbg.level()` es el capítulo (sus campos privados se leen desde la consola).
- La página se recarga sola al guardar un archivo: volver a definir los ayudantes de prueba después de cada cambio.
- Capturas a escala 0,6 y `zoom` para los detalles; comparar con el cap. 1.
- **Medir lo que flota**: punto más bajo de la malla con piel (`Box3().setFromObject`) frente a la altura de lo que pisa.
- Cada fase con su captura, luego **una partida entera** de principio a fin, consola sin errores.

## 4. Lista de un capítulo (para darlo por migrado)
1. Filas del inventario (`inventario-*.md`) hechas y comprobadas en captura; las nuevas, añadidas.
2. Cada escena con su perfil de luz; nada demasiado oscuro; ninguna luz que no salga de una lámpara, y las lámparas sin charco.
3. Casas y calles como en el cap. 1; marcas viales planas; carteles legibles.
4. Repaso de realismo: hora, luna, tiempo, gente, tráfico, comercios abiertos o cerrados, señales, sentidos de circulación, objetos que no flotan ni se atraviesan.
5. Personajes: sin flotar, sin brazos rotos, sin gestos sin sentido, mirando a quien les habla.
6. Bocadillos que salen de quien habla.
7. Sin pistas de más; objetivos mínimos.
8. Ritmo: buscar los momentos «pim pam» (llegar y ya, pulsar y ya) y darles un paso más con sentido.
9. Partida entera sin errores.
10. `npx tsc --noEmit`, `progreso-capN.md` y commit local.
