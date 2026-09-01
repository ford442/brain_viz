import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Deployed under test.1ink.us/brain-viz/ (see deploy.py). Without this,
  // Vite emits all asset URLs (including the ONNX Runtime .mjs/.wasm
  // dynamic imports in src/inference-engine.js) at host-root '/assets/'
  // instead of '/brain-viz/assets/', 404ing them in production and
  // forcing InferenceEngine to fall back to synthetic activations. Only
  // applied to `build` — the dev server (and scripts/test_run.py,
  // verification/verify_suite.py) still expect localhost:5173 root.
  base: command === 'build' ? '/brain-viz/' : '/',
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
}));
