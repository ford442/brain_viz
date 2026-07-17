#!/usr/bin/env bash
# scripts/build_wasm.sh
# [Phase 1 WASM] Build script for BrainTensorEngine C++ → WebAssembly
#
# Prerequisites:
#   - Emscripten SDK (emsdk) installed and activated.
#     The .jules/setup.sh script handles SDK installation for CI.
#     For local dev: follow https://emscripten.org/docs/getting_started/downloads.html
#
# Usage:
#   ./scripts/build_wasm.sh          # release build (default)
#   ./scripts/build_wasm.sh --debug  # debug build with assertions
#
# Output: public/wasm/brain_tensor_engine.{js,wasm}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ─── Locate and activate the Emscripten SDK ──────────────────────────────────
# Resolution order:
#   1. em++ already on PATH — nothing to do.
#   2. $EMSDK env var pointing at an emsdk checkout.
#   3. emsdk cloned by .jules/setup.sh (git clone .../emsdk in the repo root
#      or the user's home directory).
if command -v em++ >/dev/null 2>&1; then
    : # already activated in this shell
elif [[ -n "${EMSDK:-}" && -f "${EMSDK}/emsdk_env.sh" ]]; then
    # shellcheck disable=SC1091
    source "${EMSDK}/emsdk_env.sh"
elif [[ -f "${REPO_ROOT}/emsdk/emsdk_env.sh" ]]; then
    # shellcheck disable=SC1091
    source "${REPO_ROOT}/emsdk/emsdk_env.sh"
elif [[ -f "${HOME}/emsdk/emsdk_env.sh" ]]; then
    # shellcheck disable=SC1091
    source "${HOME}/emsdk/emsdk_env.sh"
else
    echo "[build_wasm] ERROR: Emscripten SDK (em++) not found." >&2
    echo "[build_wasm] Install it via .jules/setup.sh, or set \$EMSDK to an" >&2
    echo "[build_wasm] emsdk checkout, or add em++ to PATH. See:" >&2
    echo "[build_wasm]   https://emscripten.org/docs/getting_started/downloads.html" >&2
    exit 1
fi
SRC="${REPO_ROOT}/wasm/brain_tensor_engine.cpp"
OUT_DIR="${REPO_ROOT}/public/wasm"
OUT_NAME="brain_tensor_engine"

mkdir -p "${OUT_DIR}"

# ─── Build flags ──────────────────────────────────────────────────────────────
COMMON_FLAGS=(
    -std=c++17
    -I"${REPO_ROOT}/wasm"

    # WASM output
    -s WASM=1
    -s MODULARIZE=1
    -s EXPORT_NAME="BrainTensorEngineModule"
    -s ALLOW_MEMORY_GROWTH=1

    # Export the C functions listed in brain_tensor_engine.h
    -s EXPORTED_FUNCTIONS='[
        "_bte_create",
        "_bte_destroy",
        "_bte_update",
        "_bte_inject_stimulus",
        "_bte_get_tensor_data",
        "_bte_reset",
        "_bte_get_voxel_count",
        "_bte_get_voxel_dim",
        "_bte_benchmark",
        "_malloc",
        "_free"
    ]'
    -s EXPORTED_RUNTIME_METHODS='["cwrap","getValue","setValue"]'

    # Environment: web workers are possible but not required for Phase 1
    -s ENVIRONMENT='web,worker'

    # Output
    -o "${OUT_DIR}/${OUT_NAME}.js"
)

if [[ "${1:-}" == "--debug" ]]; then
    echo "[build_wasm] Building DEBUG build…"
    em++ -O0 -g \
        -s ASSERTIONS=2 \
        -s SAFE_HEAP=1 \
        "${COMMON_FLAGS[@]}" \
        "${SRC}"
    echo "[build_wasm] Debug output → ${OUT_DIR}/${OUT_NAME}.{js,wasm}"
else
    echo "[build_wasm] Building RELEASE build…"
    em++ -O2 \
        "${COMMON_FLAGS[@]}" \
        "${SRC}"
    echo "[build_wasm] Release output → ${OUT_DIR}/${OUT_NAME}.{js,wasm}"
fi
