import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  // [Phase 1 WASM] Ensure the Emscripten-generated WASM glue JS in public/wasm/
  // is served as-is and not processed by Vite's optimizer.
  assetsInclude: ['**/*.wasm'],
  build: {
    // Do not inline WASM binaries — they are loaded at runtime by the Emscripten glue.
    assetsInlineLimit: 0
  }
});
