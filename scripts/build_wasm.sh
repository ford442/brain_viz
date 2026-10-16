#!/usr/bin/env bash
# scripts/build_wasm.sh
# [Tensor Physics] Build BrainTensorEngine (C++ → WebAssembly).
#
# The flags live in scripts/wasm_flags.sh, which this script and
# scripts/build_wasm_colab.sh both source. They used to be duplicated across
# both scripts and a comment in wasm/brain_tensor_engine.cpp, and all three had
# drifted apart.
#
# Prerequisites:
#   - Emscripten SDK (emsdk) installed and activated.
#     .jules/setup.sh handles SDK installation for CI. For local dev see
#     https://emscripten.org/docs/getting_started/downloads.html
#
# Usage:
#   ./scripts/build_wasm.sh             # release: -O3 -flto -msimd128
#   ./scripts/build_wasm.sh --debug     # -O0, assertions, safe heap
#   WASM_PTHREADS=1 ./scripts/build_wasm.sh   # opt into pthreads (see wasm_flags.sh)
#
# Output: public/wasm/brain_tensor_engine.{mjs,wasm,build.json}, plus a
# regenerated wasm/compile_commands.json (Emscripten graph) for clangd.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ─── The generated C ABI header must match the live uniform layout ───────────
# A stale header means the C++ engine reads every parameter at the wrong offset.
# bte_params_byte_size() catches it at runtime; catching it here is cheaper.
if command -v node >/dev/null 2>&1; then
    node "${SCRIPT_DIR}/gen_wasm_params.mjs" --check
else
    echo "[build_wasm] WARNING: node not found — cannot verify wasm/brain_tensor_params.h" >&2
fi

# ─── Locate and activate the Emscripten SDK ──────────────────────────────────
# Resolution order:
#   1. em++ already on PATH — nothing to do.
#   2. $EMSDK env var pointing at an emsdk checkout.
#   3. emsdk cloned by .jules/setup.sh (repo root or $HOME).
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

OUT_DIR="${REPO_ROOT}/public/wasm"
OUT_NAME="brain_tensor_engine"
mkdir -p "${OUT_DIR}"

export REPO_ROOT OUT_DIR OUT_NAME
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/wasm_flags.sh"

if [[ "${1:-}" == "--debug" ]]; then
    echo "[build_wasm] Building DEBUG build…"
    em++ "${BTE_DEBUG_FLAGS[@]}" "${BTE_COMMON_FLAGS[@]}" "${BTE_SRCS[@]}" -o "${BTE_OUTPUT}"
    bte_write_manifest true
else
    echo "[build_wasm] Building RELEASE build (-O3 -flto -msimd128, ${#BTE_SRCS[@]} TUs)…"
    em++ "${BTE_RELEASE_FLAGS[@]}" "${BTE_COMMON_FLAGS[@]}" "${BTE_SRCS[@]}" -o "${BTE_OUTPUT}"
    bte_write_manifest false
fi

echo "[build_wasm] Output → ${BTE_OUTPUT} (+ .wasm, $(basename "${BTE_MANIFEST}"))"

# em++ is known to be on PATH here, so give clangd the Emscripten graph
# (--target=wasm32, -msimd128: the SIMD branch of src/stencil.cpp is live).
# `npm run gen:compile-commands` switches back to the host graph.
if command -v node >/dev/null 2>&1; then
    node "${SCRIPT_DIR}/gen_compile_commands.mjs" --emscripten || \
        echo "[build_wasm] WARNING: could not write the Emscripten compile graph" >&2
fi
