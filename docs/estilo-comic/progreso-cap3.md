# Progreso · Capítulo 3 «La ruta de las zamburiñas» (F2)

Hecho el 10-nov-2026 con la guía `GUIA-migracion.md` (lo aprendido en el cap. 2). Perfil `dia`; camping y Calle Laurel, `noche`.

## Carretera y campo
| Problema | Arreglo |
|---|---|
| Líneas de la carretera negras y quietas respecto al coche (el lienzo pasado a tebeo, H3/H4) | Asfalto dibujado (en coordenadas del mundo: pasa bajo el coche) y la pintura plana encima (`paintMat`): líneas de borde continuas y discontinuas de 3,5 m cada 12 m, fijas en el suelo |
| Manchas del campo que viajaban con el coche | Fuera el lienzo: color de la región y dibujo de hierba o tierra |
| Líneas de velocidad del tebeo durante todo el viaje (26 m/s, H13) | `scene.userData.speedLines` (nuevo en `drawComic`): solo con el turbo |
| Sol a 2,3 cada fotograma (H14) | 2,1, el tope de tebeo |
| Coches y tractores con la geometría doblada una y otra vez (H5) | `comicBent` en el obstáculo y en su geometría |
| Restaurantes y señales a la izquierda (se conduce por la derecha y el coche se aparta a la derecha para parar) | Restaurantes reflejados a la derecha (rótulo aparte, para que no se lea al revés); señales a la derecha |
| Tractores en la A-1 y un barril de vino en mitad de la carretera de La Rioja | Camiones en la autovía; tractores en Cantabria y La Rioja |
| Tromba con el sol y nubes blancas de verano | `Sky.overcast(k)`: el sol se apaga y las nubes se vuelven grises; los Picos (sin niebla) no se ven en plena tromba |

## Avisos y pistas
| Problema | Arreglo |
|---|---|
| Los avisos (`toast`) no se ven en el cómic: «no empieza por M», «¡frena, que es una vaca!», turbo, golpes, rachas, la tromba, la plancha… se perdían | Bocadillos de quien lo diría (él desde su asiento; ella al volante) u onomatopeyas (`comicWord`: ¡TURBO!, ¡BUU!, ¡POR LOS PELOS!, ¡AL PLATO!, ¡QUEMADA!) |
| Nombres de región en un aviso | Carteles de comunidad en la carretera: Castilla y León, Cantabria, La Rioja |
| El botón del restaurante de la M parpadeaba (chivaba la respuesta del juego) | Todos igual |
| Objetivos que decían qué hacer («Toca cada zamburiña cuando esté dorada», «Cómete una zamburiña», «Entra en la cabaña») | 🔥, 🐚, 🏕️; la regla de la plancha la dice él |
| Flecha y columna del camping | Solo a los 40 s sin entrar (`Lost`) |
| Pinchos: «Ronda 1 de 3: escucha al camarero…», «Sírvelos en el mismo orden» | 🍢 1/3 y 👉 i/n; los fallos los dice el camarero en su bocadillo |

## Bocadillos
- En el coche, cada uno desde su asiento con el rabito hacia él (`speakerPoint`/`speakerSide` del nivel; `main.ts` y `bark` aceptan el lado del nivel, sirve para cualquier capítulo).
- Antes de la noche del camping todavía es **Marc** (el mote nace allí): los comentarios de la ida, con su nombre.
- El camarero de los pinchos habla desde su cabeza.

## Noches (camping y Calle Laurel)
- Receta del cap. 2: perfil `noche`, `hemiScale` 0,32, luna 0xb8c8ff a 2,0 con sombras y sin acné.
- Sin luces de punto (farolillo del camping, tres de la Laurel): las lámparas solo se ven encendidas.
- Camping: sin el resplandor del atardecer (a la hora de cenar de finales de octubre ya es noche cerrada); tierra más clara.
- Laurel: bombillas de tebeo (`comicBulbTexture`); losas a 3,2 m como el cap. 1; canal central menos negro.
- Al volver de una escena de noche a la carretera de día, `main.ts` vuelve a poner el perfil de la escena (las ventanas «encendidas» se quedaban sin sombra a pleno sol).

## Fallos
- Saltar de fase en el modo prueba durante la intro: al acabar la intro volvía a la salida de Madrid y disparaba Marcial y el camping.
- Los botones de los pinchos se quedaban en pantalla al saltar a otra fase.
- Plano de los pinchos con el frente de la barra tapando media pantalla: cámara más alta.

## Textos nuevos (inventados, para cambiar por lo que pasó)
- Ella en la tromba: «Madre mía, qué tromba. No veo nada…»; él: «Ya escampa ☀️».
- Él en la plancha: «Cuando estén doraditas, al plato. Ni antes ni después.»

## Pendiente
- El mar Cantábrico sale a la izquierda (yendo al oeste, estaría a la derecha) y las lomas se meten en él.
