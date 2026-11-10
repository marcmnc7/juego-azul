# Progreso · Capítulo 6 «Sant Joan» (F5)

Hecho el 10-nov-2026 con `GUIA-migracion.md`. Día en Ciutadella (perfil `dia`, `hemiScale` 0,35 como el cap. 1); taxi y casa de Azul de madrugada con la noche del cap. 2.

## Hecho
| Qué | Cómo |
|---|---|
| Pistas | Flecha, columna, pin de Correus y rombo de la puerta solo a los 40 s sin avanzar (`Lost`); objetivos de un emoji |
| Luces | Fuera las luces de punto de la calle, de Es Bè, la estatua, el porche y el foco del taxi; faroles de hierro en Ses Voltes y fernandinas en la Plaça Espanya; halos solo de noche, ya en versión de tebeo |
| Edificios de piedra (D6a) | Sillería (`TownHD.wall(…, { stone })`, `born.ts` `stone`) en la Catedral, el campanario, el pórtico, las casas señoriales, el Ajuntament y Es Bè |
| Accesorios (D6b) | Bombín del caixer y estampados marcados `userData.person`; `comicScene` ya los trata como persona |
| Avisos | Sin `toast`: el grito del caixer, Gas (también por WhatsApp) y Azul en bocadillo; aciertos y golpes en onomatopeya |
| Bocadillos | Taxista, el caixer y la gente desde su cabeza; en el taxi, cada uno desde su asiento (`speakerPoint`/`speakerSide`) |
| Taxi | Sale ya en marcha, cámara detrás desde el primer fotograma, sin líneas de velocidad; asfalto, tierra, pinar y piedra seca dibujados, discontinua plana; ocupado sin luz verde; se paga al llegar; Gas se baja por detrás |
| Casa de madrugada | Ventanas de arriba, apliques y guirnalda apagados (los padres duermen) |
| Fallos | El minijuego de las avellanes se creaba dos veces; Gas aparecía dentro de la verja; solo cuentan los caballos de la plaza en Es Bè |

## Pasos nuevos (textos inventados, en `story.ts`)
- De camino al taxi, Gas se para («Para, para… Un segundo.»).
- Conversación en el taxi (`rideTalk`) y pagar al llegar (`pay`).
- La llave de la puerta («Despacito… que la puerta cruje.»).

## Comprobado en captura
Plaça Espanya, Es Bè, el taxi de noche por el Camí de sa Farola y la llegada a casa: se leen bien, globos anclados, sin luces que manchen.

## Pendiente
- Luna: el 24-6-2026 hay creciente gibosa que se pone hacia las 3:30; no está puesta.
- Una partida entera seguida.
