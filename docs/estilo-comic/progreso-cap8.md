# Progreso · Capítulo 8 «El eclipse»

Hecho el 10-nov-2026 con `GUIA-migracion.md`, **solo leyendo código** (sin navegador): todo lo de abajo está por comprobar en captura. Inventario: `inventario-cap6-cap8-carta.md`, 8.1 a 8.6.

## Horas y perfiles de luz
| Escena | Hora (chats y story.ts) | Perfil |
|---|---|---|
| Aparcamiento del aeropuerto (misión) | 2-8, 17:48 (el chat `motoPerdida`) | `dia`, sol por el oeste-suroeste. La versión de noche queda detrás de `NIGHT` en `parking.ts` (receta del cap. 2) |
| Kayak | mañana del 12-8 (plan que nunca pasó) | `dia`, hemisférica como el cap. 1 (1,0 × 0,35) |
| Casa de Azul | llegan a mediodía (12:28, `eclipseCoche`) | `dia`; tras el paseo, fundido y `atardecer` (sol bajo por el oeste): se van hacia las 20:05 |
| Calle de Gas, aparcar | ~20:05 | `atardecer` |
| Cocina | ~20:10 | `interior`, sin luz de punto |
| Rocas y eclipse | 20:31, sol a 2° | `atardecer` que se apaga con la totalidad (también la hemisférica del cómic) |

## Hecho
- **Pistas**: marcador, flecha y columna solo a los 40 s sin avanzar (`Lost`) en casa de Azul, la cocina y la moto. Objetivos de un emoji o dos palabras. Ningún `toast`: bocadillos (`bark`) de quien lo diría y onomatopeyas (`comicWord`).
- **Bocadillos**: en el coche, cada uno desde su asiento; en el kayak, a su lado; en las rocas (RockHop), desde los de RockHop; en la misión, desde los de la misión; Eric, desde su cabeza.
- **Luces**: fuera todas las `PointLight`/`SpotLight` (farolas y linterna del aeropuerto, cocina, relleno de las cartas). Motos aparcadas con las luces apagadas. De día, sin ventanas encendidas (calle de Gas con `day`, casa de Azul) ni guirnalda encendida (bombillas de tebeo apagadas).
- **Eclipse de tebeo**: disco del sol dibujado con el mordisco de la luna (la luna solo se ve donde tapa el sol, y es un 2 % más grande: total), corona de rayos planos con tinta y protuberancias, anillo de diamante en estrella, halo en dos bandas planas, Venus y unas pocas estrellas en la totalidad, horizonte naranja alrededor, mar y nubes que se oscurecen, destello `comicFlash`. Gafas: negro plano con un agujero de borde duro sobre el sol (antes, viñeta con degradado).
- **Inventario**: kayak, remos y ferry `comicBent`; estela y ola de proa de tebeo; espuma de RockHop de tebeo; rocas con dibujo de piedra (`setSurface`); roca de Es Castellar lisa (32×16); suelo de la cocina de barro dibujado; calendario dibujado (agosto de 2026, el 12 rodeado); juntas de armario y patillas de las gafas más gruesas; plazas del aeropuerto con `paintMat` y asfalto dibujado; rótulo del aeropuerto con tinta; zona de aparcar a trazos.
- **Vehículos**: el coche llega a casa de Azul a ~40 km/h (antes 61) y a la calle de Gas ya en marcha (7 m/s), con la cámara en su sitio desde el primer fotograma; ferry a 15 m/s (antes 26: 50 nudos). Sin líneas de acción en la casa de Azul y aparcando.
- **Personajes**: nadie saluda esperando (padres, Gas en RockHop); el padre de Azul dice adiós 2,6 s y se queda mirando.
- **Pasos nuevos**: Joy se escapa a oler algo llegando al faro y hay que ir a por ella; la tarde pasa (fundido) antes de volver; en la totalidad hay que quitarse las gafas para ver la corona (y para la foto se las vuelven a poner).
- **Fallos**: cadenas de diálogo/minijuego que pisaban una fase saltada (`chain`); RockHop que seguía vivo al saltar al eclipse; `totalT`, reloj, golpes y gafas sin reiniciar; cartas pendientes que caían en otra escena; el destello de la foto se quedaba en blanco al saltar; la hemisférica de las rocas se reescribía sin `hemiScale`.

## Por comprobar en captura
Todo. En especial: el disco con el mordisco y el agujero de las gafas, la corona, Venus, la oscuridad de la totalidad; la roca con dibujo de piedra; los sentados en el kayak y en la roca (no se ha medido); Joy llegando a su sitio sin chocar; la estela y la ola del ferry; la cocina con perfil interior.

## Pendiente
- Coche de 4,4 m en un patio de 4 m: aparcado, el morro sale por la corredera.
- El panel de Love Letter (`ui/minis.ts`) no es de tebeo (D6e).
- Los accesorios (gafas) esperan a D6b en `comic.ts` (`userData.person` en mallas normales).
