import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Lo que pase de este tamaño (modelos, VRM, música, fotos, cielos) va en dist/assets/, no dentro del HTML. */
const INLINE_MAX = 64 * 1024;

/**
 * Modo sin conexión: cada compilación cambia la versión de sw.js (el móvil descarga el juego nuevo una vez)
 * y le pasa la lista de archivos de dist/assets/ para que los guarde todos la primera vez.
 */
function swVersion() {
  return {
    name: 'sw-version',
    closeBundle() {
      const f = resolve(__dirname, 'dist/sw.js');
      if (!existsSync(f)) return;
      const dir = resolve(__dirname, 'dist/assets');
      const assets = existsSync(dir) ? readdirSync(dir).map((n) => './assets/' + n) : [];
      writeFileSync(f, readFileSync(f, 'utf8').replace('__VERSION__', String(Date.now())).replace("'__ASSETS__'", JSON.stringify(assets).slice(1, -1)));
    },
  };
}

// index.html con el código dentro y, al lado, dist/assets/ con los archivos grandes. Ningún archivo se acerca
// a los 100 MB que admite GitHub, por muchos personajes que se añadan. Hay que publicar la carpeta dist entera.
export default defineConfig({
  plugins: [viteSingleFile({ useRecommendedBuildConfig: false }), swVersion()],
  // Rutas relativas: el mismo index.html sirve en cualquier carpeta (GitHub Pages, un servidor propio…)
  base: './',
  // Modelos glTF, personajes de VRoid y cielos HDRI
  assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.vrm'],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 100000,
    cssCodeSplit: false,
    assetsInlineLimit: (_file: string, content: Buffer) => content.length <= INLINE_MAX,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        // El JS y el CSS acaban dentro de index.html: se generan en la raíz para que las rutas relativas que
        // Vite calcula desde ellos ("assets/…") sigan valiendo desde el HTML. El resto, en assets/.
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (a) => (a.names?.[0] ?? a.name ?? '').endsWith('.css') ? '[name]-[hash][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
