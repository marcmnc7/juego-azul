# Prueba de concepto · Plaça des Born

Escena jugable para probar el motor nuevo del juego de Margaux (Three.js + física Rapier + personaje glTF con animaciones de captura de movimiento).

- `npm install && npm run build` genera `dist/index.html`, un único archivo con todo dentro (~13 MB).
- `?debug` en la URL muestra fps, llamadas de dibujo y triángulos.
- Controles: joystick a la izquierda, arrastrar a la derecha para la cámara, pellizcar para acercar; Saltar y Bailar. En ordenador: WASD, espacio, B, ratón, Mayús para andar.

## Qué hay en cada archivo
- `src/world.ts`: la plaza (geometría fusionada por material + colisionadores Rapier).
- `src/player.ts`: controlador de personaje de Rapier, mezcla de animaciones por velocidad y retargeting entre rigs de Mixamo.
- `src/camera.ts`: cámara en tercera persona con colisión (esfera lanzada contra el mundo).
- `src/materials.ts`: materiales PBR con mapas de color, relieve y rugosidad.
- `prep.mjs`: prepara los modelos (recolorea a Azul, deja solo las animaciones necesarias).

## Recursos y licencias
- Texturas de piedra, estuco, tejas y puertas: Sponza de Crytek (Frank Meinl), CC BY 3.0, vía KhronosGroup/glTF-Sample-Assets.
- Cielo HDRI: quarry_01 de Poly Haven (CC0), vía el repositorio de three.js.
- Personaje (Michelle) y animaciones (Xbot): Mixamo, de los ejemplos de three.js. Provisional: en el juego sería Azul hecha a medida.
