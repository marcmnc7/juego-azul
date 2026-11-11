# Texto para la IA que maneja el ordenador (reparto en VRoid)

Copiar tal cual.

---

Vas a crear los personajes de un juego de cumpleaños hecho por mí (Marc) para mi pareja, Margaux («Azul»). Tienes control de mi Mac: puedes abrir aplicaciones, hacer clic, escribir y usar la terminal. Háblame siempre en español.

**Tu tarea:** crear en **VRoid Studio** todos los personajes del juego con el mismo estilo que **Azul del capítulo 1** (ya está hecha), exportarlos como VRM y dejarlos en el juego para que los use.

**Primero, prepara tu copia del juego** (en la Terminal):
```
git clone https://github.com/marcmnc7/juego-azul.git ~/Documents/juego-azul
cd ~/Documents/juego-azul
npm install
mkdir -p ~/Documents/reparto ~/Desktop/characters/reparto/capturas
```
(Si `~/Documents/juego-azul` ya existe: `cd ~/Documents/juego-azul && git checkout main && git pull`.)

**Después, lee el plan entero:** `~/Documents/juego-azul/docs/PLAN-reparto-vroid.md`. Tiene una ficha por personaje, el orden de trabajo y una tabla «Rutas» con todas las carpetas que vas a usar. Luego lee `~/Documents/juego-azul/docs/vroid-capitulo-1.md` (fichas detalladas de Gas, Carme, Tòfol y la fabiolera). No hace falta tocar código: el juego ya busca cada personaje por el nombre de su archivo.

**Comprueba** que existen VRoid Studio y los proyectos `~/Documents/Azul.vroid`, `~/Documents/GasFerreries.vroid`, `~/Documents/Nino.vroid` y `~/Documents/Vecina.vroid`. Si falta algo, para y avísame.

**Reglas que no puedes saltarte:**
- Nunca borres ni sobrescribas los proyectos originales: nada más abrir uno, **Archivo → Guardar como** en `~/Documents/reparto/<nombre>.vroid`, y trabaja sobre esa copia.
- No toques los archivos internos de VRoid (`.vroid` por dentro, `data.bin`).
- No descargues nada de internet (modelos, ropa, texturas) sin preguntarme.
- No toques la rama `main` ni el repo `pm-2611`. Lo único que puedes subir es la rama `reparto-vroid`, y solo cuando yo te dé el OK.
- Si un personaje no se parece a su ficha, no lo des por bueno: pregúntame.

**Cómo trabajar:**
1. **Empieza por Gas (ficha G0).** Es el más difícil y el más importante: su modelo anterior salía con cara de chica. Haz el modelo y guarda capturas de frente, de perfil y de cuerpo entero en `~/Desktop/characters/reparto/capturas/`. Enséñamelas y **espera a que lo apruebe** antes de seguir: sin Gas aprobado no hagas sus conjuntos ni la base de hombre.
2. Luego las seis bases (sección 3 del plan) y, después, los personajes **capítulo a capítulo en el orden de la sección 7**.
3. Por cada personaje:
   - créalo según su ficha;
   - expórtalo como VRM con las opciones de la sección 2.2 en `~/Desktop/characters/reparto/<nombre>.vrm`;
   - déjalo en el juego con:
     ```
     cd ~/Documents/juego-azul
     python3 scripts/vrm_slim.py ~/Desktop/characters/reparto/<nombre>.vrm src/assets/vrm/<nombre>.vrm
     ```
   - El `<nombre>` tiene que ser **exactamente** el de la ficha (minúsculas, sin acentos ni espacios). Si no coincide, el juego no lo encuentra.
4. **Al acabar cada capítulo**, compruébalo en el juego (sección 6 del plan):
   - `cd ~/Documents/juego-azul && npm run dev` y abre `http://localhost:5173/?hq#test` (o el puerto que diga la terminal).
   - En la consola del navegador, `__dbg.go(n)` abre el capítulo n y `__dbg.level().debug()` lista sus fases.
   - Mira a cada personaje nuevo de pie, andando y sentado: que no flote ni atraviese nada y que no haya errores en la consola.
   - Guarda una captura de cada uno dentro del juego en `~/Desktop/characters/reparto/capturas/`.
   - Mándame las capturas y un resumen, y espera mi OK.
5. **Con mi OK, entrega el capítulo:**
   ```
   cd ~/Documents/juego-azul
   git checkout -B reparto-vroid
   git add src/assets/vrm/*.vrm
   git commit -m "Reparto VRoid: capítulo N"
   git push origin reparto-vroid
   ```
   Solo los `.vrm` de `src/assets/vrm/`. Luego sigue con el capítulo siguiente en esa misma rama.
6. Si en la consola sale `[rig] no queda copia libre de …`, apúntalo y dímelo: hay que subir un número en el código, y eso lo hago yo con Claude Code.

**Cuando termines o te atasques:** dime qué archivos hay en `~/Documents/juego-azul/src/assets/vrm/`, cuáles faltan según la lista de la sección 8 del plan y qué dudas tienes. Lo que no puedas hacer con VRoid (multitudes, cambios de código), apúntalo y lo hago yo con Claude Code.
