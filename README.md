# Para Margaux · diseño

Juego 3D para el móvil (Three.js + Vite + TypeScript) para el cumpleaños de Margaux (28 de octubre). Se juega como Azul (rubia, ojos verdes, vestida de azul); cada capítulo recrea un momento con Gas y termina desbloqueando un **vale regalo real**. El progreso se guarda en el propio móvil.

## Capítulos
| # | Capítulo | Qué se hace | Regalo |
|---|----------|-------------|--------|
| 1 | **Jaleo d'ases** · Ferreries | Hablar con Tòfol, conseguir 3 pomadas y 3 toques de suerte a los ases encabritados, encontrar a Marc y bailar. | Una noche de fiesta juntos |
| 2 | **La ruta de las zamburiñas** · Madrid → San Vicente de la Barquera → Logroño | Conducir con Joy asomada a la ventanilla, cambiar de carril para recoger fotos y esquivar coches, tractores y vacas. En San Vicente, hacer 8 zamburiñas a la plancha (tocarlas cuando están doradas). Seguir entre viñedos hasta Logroño. | Una cena en un buen restaurante |
| 3 | **Fito bajo las estrellas** · Canarias | Buscar a Gas, que se ha perdido pidiendo cervezas en "inglés". Opcional: tirar el tabaco a la papelera (Gas lo comenta). Concierto con minijuego de ritmo y fuegos artificiales. | Billetes al Carnaval de Tenerife |
| 💌 | **Sorpresa final** | Carta de Gas (y Joy) al terminar los tres capítulos. | — |

## Cómo se ve y se juega
- Estilo dibujo animado: sombreado "cel", contornos, sombras reales, cielo con nubes (atardecer en Ferreries, días por regiones en la ruta, estrellas en Canarias). Si el móvil va justo, baja la resolución y luego quita las sombras solo.
- Cap. 1: los ases avisan con un **!** antes de ponerse de manos; tocarlos en lo más alto (aro dorado) es un toque perfecto. Azul lleva la pomada en la mano; confeti y ovación al final.
- Cap. 2: carril deslizando el dedo o con ◀ ▶, barra de ruta, ⛽ turbo, 🚬 que Gas confisca, adelantamientos "por los pelos" y rachas de fotos con Joy ladrando.
- Cap. 3: pantallas con ecualizador, láseres, mecheros en el público, chispas y fuegos con las rachas del minijuego.
- Cada capítulo empieza con un rótulo y acaba con una caja regalo que se abre con confeti, 1-3 estrellas y datos de la partida.

Guiños: Azul y Gas, los "Buu", el inglés de Gas, dejar de fumar, Joy.

## Modo prueba
Abrir el enlace añadiendo `#test` al final. Todo está desbloqueado, hay un botón amarillo 🛠 Prueba para saltar a cualquier fase o completar el capítulo, un contador de fps y un botón para borrar el progreso guardado.

## Cómo se cambia
- Regalos: `src/data/gifts.ts`
- Diálogos y carta final: `src/data/story.ts`
- Aspecto de Azul y Gas: `src/data/characters.ts`

## Compilar
`npm install && npm run build` genera `dist/index.html`, un único archivo que funciona sin servidor.
