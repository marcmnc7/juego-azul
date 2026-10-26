import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Todo (código, wasm de Rapier, modelos, texturas, HDR) acaba dentro de un único HTML.
export default defineConfig({
  plugins: [viteSingleFile()],
  assetsInclude: ['**/*.glb', '**/*.hdr'],
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 },
});
