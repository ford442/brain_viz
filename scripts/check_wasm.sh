#!/usr/bin/env bash
# scripts/check_wasm.sh
# [Phase 1 WASM] Pre-build advisory check — warns (never fails) when the
# optional WASM engine hasn't been compiled. `npm run build` only produces
# the Vite web bundle; the WASM hybrid engine is opt-in via
# `npm run build:full` (or `npm run build:wasm`) and requires Emscripten.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# The release glue is an ES module (.mjs) since the build moved to EXPORT_ES6;
# a .js from an older build is still accepted, and src/wasm-engine.js falls back
# to it at runtime.
GLUE_MJS="${REPO_ROOT}/public/wasm/brain_tensor_engine.mjs"
GLUE_JS="${REPO_ROOT}/public/wasm/brain_tensor_engine.js"
GLUE_WASM="${REPO_ROOT}/public/wasm/brain_tensor_engine.wasm"

if [[ ( -f "${GLUE_MJS}" || -f "${GLUE_JS}" ) && -f "${GLUE_WASM}" ]]; then
    echo "[check_wasm] Found existing WASM build in public/wasm/."
else
    cat <<'EOF'
[check_wasm] Notice: public/wasm/brain_tensor_engine.{mjs,wasm} not found.
             This build will ship the WebGPU/WebGL renderer only — the
             optional C++ WASM hybrid engine will not be available
             (wasm-engine.js falls back gracefully at runtime).
             To include it, run `npm run build:full` (requires Emscripten;
             see .jules/setup.sh or docs/wasm-engine.md).
EOF
fi

exit 0
