#!/usr/bin/env bash
# scripts/build_wasm_colab.sh
# [Tensor Physics] Build BrainTensorEngine (C++ → WebAssembly) inside a Google
# Colab notebook, where the emsdk lives at a fixed /content path.
#
# Identical to scripts/build_wasm.sh except for how it finds emsdk — the flags
# come from the shared scripts/wasm_flags.sh, so the two builds can no longer
# produce differently-configured binaries.
#
# Prerequisites:
#   - Emscripten SDK (emsdk) installed and activated.
#     .jules/setup.sh handles SDK installation for CI. For local dev see
#     https://emscripten.org/docs/getting_started/downloads.html
#
# Usage:
#   ./scripts/build_wasm_colab.sh       # release: -O3 -flto -msimd128
#   ./scripts/build_wasm_colab.sh --debug  # -O0, assertions, safe heap
#   WASM_PTHREADS=1 ./scripts/build_wasm_colab.sh  # opt into pthreads (see wasm_flags.sh)
#
# Output: public/wasm/brain_tensor_engine.{mjs,wasm}, plus a regenerated
# compile_commands.json so clangd can analyse wasm/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ─── The generated C ABI header must match the live uniform layout ───────────
# A stale header means the C++ engine reads every parameter at the wrong offset.
# bte_params_byte_size() catches it at runtime; catching it here is cheaper.
if command -v node >/dev/null 2>&1; then
    node "${SCRIPT_DIR}/gen_wasm_params.mjs" --check
else
    echo "[build_wasm_colab] WARNING: node not found — cannot verify wasm/brain_tensor_params.h" >&2
fi

# ─── Activate the Colab emsdk checkout ───────────────────────────────────────
if ! command -v em++ >/dev/null 2>&1; then
    # shellcheck disable=SC1091
    source /content/buil*/emsdk/emsdk_env.sh
fi

OUT_DIR="${REPO_ROOT}/public/wasm"
OUT_NAME="brain_tensor_engine"
mkdir -p "${OUT_DIR}"

export REPO_ROOT OUT_DIR OUT_NAME
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/wasm_flags.sh"

if [[ "${1:-}" == "--debug" ]]; then
    echo "[build_wasm_colab] Building DEBUG build…"
    em++ "${BTE_DEBUG_FLAGS[@]}" "${BTE_COMMON_FLAGS[@]}" "${BTE_SRC}"
else
    echo "[build_wasm_colab] Building RELEASE build (-O3 -flto -msimd128)…"
    em++ "${BTE_RELEASE_FLAGS[@]}" "${BTE_COMMON_FLAGS[@]}" "${BTE_SRC}"
fi

echo "[build_wasm_colab] Output → ${BTE_OUTPUT} (+ .wasm)"

if command -v node >/dev/null 2>&1; then
    node "${SCRIPT_DIR}/gen_compile_commands.mjs"
fi
