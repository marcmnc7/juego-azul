# Texto para la IA que maneja el ordenador (reparto en VRoid)

Copiar tal cual, cambiando `[CARPETA]` por la carpeta donde está el proyecto `juego-azul`.

---

Vas a crear los personajes de un juego de cumpleaños hecho por mí (Marc) para mi pareja, Margaux («Azul»). Tienes control de mi Mac: puedes abrir aplicaciones, hacer clic, escribir y usar la terminal. Háblame siempre en español.

**Tu tarea:** crear en **VRoid Studio** todos los personajes del juego con el mismo estilo que **Azul del capítulo 1** (ya está hecha), exportarlos como VRM y dejarlos en el proyecto para que el juego los use. El plan completo, con una ficha por personaje, está en:

`[CARPETA]/juego-azul/docs/PLAN-reparto-vroid.md`

**Antes de empezar:**
1. Lee el plan entero. Después, `docs/vroid-capitulo-1.md` (fichas detalladas de Gas, Carme, Tòfol y la fabiolera). No hace falta tocar código: el juego ya busca cada personaje por el nombre de su archivo.
2. Comprueba que tienes VRoid Studio y los proyectos `~/Documents/Azul.vroid`, `GasFerreries.vroid`, `Nino.vroid` y `Vecina.vroid`. Si falta algo, para y avísame.
3. Crea las carpetas `~/Documents/reparto/` (proyectos nuevos) y `~/Desktop/characters/reparto/` (exportados).

**Reglas que no puedes saltarte:**
- Nunca abras, borres ni sobrescribas los proyectos originales: siempre **Archivo → Guardar como** con el nombre de la ficha antes de cambiar nada.
- No toques los archivos internos de VRoid (`.vroid` por dentro, `data.bin`).
- No descargues nada de internet (modelos, ropa, texturas) sin preguntarme.
- No publiques nada ni hagas `git push`. No borres archivos del proyecto.
- Si un personaje no se parece a su ficha, no lo des por bueno: pregúntame.

**Cómo trabajar:**
1. **Empieza por Gas (ficha G0).** Es el más difícil y el más importante: su modelo anterior salía con cara de chica. Haz el modelo, sácale capturas de frente, de perfil y de cuerpo entero, y **espera a que yo lo apruebe** antes de seguir. Sin Gas aprobado no hagas ninguno de sus conjuntos ni la base de hombre.
2. Luego las seis bases (sección 3 del plan) y, después, los personajes **capítulo a capítulo en el orden de la sección 7**.
3. Por cada personaje:
   - créalo según su ficha;
   - expórtalo como VRM con las opciones de la sección 2.2;
   - déjalo en el juego con este comando, desde la carpeta `juego-azul`:
     ```
     python3 scripts/vrm_slim.py ~/Desktop/characters/reparto/<nombre>.vrm src/assets/vrm/<nombre>.vrm
     ```
   - El `<nombre>` tiene que ser **exactamente** el de la ficha (minúsculas, sin acentos ni espacios). Si no coincide, el juego no lo encuentra.
4. **Al acabar cada capítulo**, compruébalo en el juego (sección 6 del plan):
   - En la carpeta `juego-azul`, ejecuta `npm run dev` y abre la dirección que salga, añadiendo `?hq#test` al final.
   - En la consola del navegador, `__dbg.go(n)` abre el capítulo n y `__dbg.level().debug()` lista sus fases.
   - Mira a cada personaje nuevo de pie, andando y sentado; que no flote ni atraviese nada, y que no haya errores en la consola.
   - Mándame capturas de cada personaje (frente y perfil) y un resumen de lo que has hecho.
   - Espera mi OK antes de pasar al capítulo siguiente.
5. Si en la consola sale `[rig] no queda copia libre de …`, apúntalo y dímelo: hay que subir un número en el código, y eso lo hago yo con Claude Code.

**Cuando termines o te atasques:** dime qué archivos has dejado en `src/assets/vrm/`, cuáles faltan y qué dudas tienes. Lo que no puedas hacer con VRoid (multitudes, cambios de código), apúntalo y lo hago yo con Claude Code.
