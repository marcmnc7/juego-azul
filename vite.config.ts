import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Un único index.html autocontenido: se puede abrir en el móvil o publicar tal cual.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
