import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Versión del modo sin conexión: cada compilación cambia sw.js, y el móvil descarga el juego nuevo una vez. */
function swVersion() {
  return {
    name: 'sw-version',
    closeBundle() {
      const f = resolve(__dirname, 'dist/sw.js');
      if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace('__VERSION__', String(Date.now())));
    },
  };
}

// Un único index.html autocontenido: se puede abrir en el móvil o publicar tal cual.
export default defineConfig({
  plugins: [viteSingleFile(), swVersion()],
  // Rutas relativas: el mismo index.html sirve en cualquier carpeta (GitHub Pages, un servidor propio…)
  base: './',
  // Modelos glTF y cielos HDRI (capítulo 1 con la calidad de la prueba de concepto)
  assetsInclude: ['**/*.glb', '**/*.hdr'],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
