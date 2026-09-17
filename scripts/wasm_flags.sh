#!/usr/bin/env bash
# scripts/wasm_flags.sh
# [Tensor Physics] The single definition of the BrainTensorEngine WASM build
# flags, sourced by scripts/build_wasm.sh and scripts/build_wasm_colab.sh.
#
# It exists because the two build scripts and a comment at the top of
# wasm/brain_tensor_engine.cpp used to carry three different em++ lines that
# drifted apart. There is one now, and the .cpp comment points here instead of
# restating it.
#
# Inputs (environment):
#   REPO_ROOT        repo checkout root (required)
#   OUT_DIR          output directory (required)
#   OUT_NAME         output basename without extension (required)
#   WASM_PTHREADS=1  opt into pthreads (off by default — see below)
#
# Sets:
#   BTE_SRC            the translation unit
#   BTE_OUTPUT         the emitted ES module
#   BTE_COMMON_FLAGS   flags shared by debug and release
#   BTE_RELEASE_FLAGS  release-only optimisation flags
#   BTE_DEBUG_FLAGS    debug-only instrumentation flags
#   BTE_CLANG_FLAGS    the subset that describes the language/include setup,
#                      for compile_commands.json (no -s linker settings)

BTE_SRC="${REPO_ROOT}/wasm/brain_tensor_engine.cpp"

# The glue is emitted as a real ES module (.mjs) so it can be `import()`ed with
# a URL built from import.meta.env.BASE_URL. The old CommonJS-ish .js was loaded
# from a hardcoded host-root '/wasm/…', which 404s under `base: '/brain-viz/'`.
BTE_OUTPUT="${OUT_DIR}/${OUT_NAME}.mjs"

BTE_CLANG_FLAGS=(
    -std=c++17
    -I"${REPO_ROOT}/wasm"
    -Wall
    -Wextra
)

BTE_COMMON_FLAGS=(
    "${BTE_CLANG_FLAGS[@]}"

    -s WASM=1
    -s MODULARIZE=1
    -s EXPORT_ES6=1
    -s EXPORT_NAME="BrainTensorEngineModule"
    -s ALLOW_MEMORY_GROWTH=1

    # No filesystem is touched by the engine; dropping it removes a sizeable
    # chunk of glue JS and its startup cost.
    -s FILESYSTEM=0

    # emmalloc is markedly smaller than dlmalloc and the engine's allocation
    # pattern is a handful of long-lived buffers, not churn.
    -s MALLOC=emmalloc

    -s EXPORTED_FUNCTIONS='[
        "_bte_create",
        "_bte_destroy",
        "_bte_params_byte_size",
        "_bte_set_params",
        "_bte_get_params",
        "_bte_set_fiber_affinities",
        "_bte_fill_reference_fiber_affinities",
        "_bte_set_ai_tensor",
        "_bte_update",
        "_bte_inject_stimulus",
        "_bte_get_tensor_data",
        "_bte_set_tensor_data",
        "_bte_reset",
        "_bte_get_voxel_count",
        "_bte_get_voxel_dim",
        "_bte_get_frame",
        "_bte_set_frame",
        "_bte_benchmark",
        "_malloc",
        "_free"
    ]'
    -s EXPORTED_RUNTIME_METHODS='["cwrap","getValue","setValue","HEAPF32","HEAPU8"]'

    -s ENVIRONMENT='web,worker'

    -o "${BTE_OUTPUT}"
)

BTE_RELEASE_FLAGS=(
    -O3
    -flto

    # 128-bit SIMD. The step is a stencil over 32³ (and, later, 64³) floats —
    # exactly the shape the vectoriser wants. Baseline simd128 is supported by
    # every browser that supports WebGPU, so this costs no reach.
    -msimd128

    # Relaxed SIMD would allow fused multiply-add, which changes rounding and
    # would put the C++ engine outside the golden fixture's epsilon against the
    # JS reference stepper. Turn it on only together with a re-measured epsilon
    # in tests/golden-scenario.js.
    # -mrelaxed-simd
)

BTE_DEBUG_FLAGS=(
    -O0
    -g
    -s ASSERTIONS=2
    -s SAFE_HEAP=1
)

# Pthreads stay OFF by default, deliberately. SharedArrayBuffer needs
# cross-origin isolation on *every* host that serves the app; vite.config.js
# sets COOP/COEP on the dev and preview servers, but the production host
# (deploy.py) does not yet. A pthreads build would simply fail to start there.
# Opt in with WASM_PTHREADS=1 once the production headers are in place.
if [[ "${WASM_PTHREADS:-0}" == "1" ]]; then
    echo "[wasm_flags] pthreads ENABLED — the serving host must send COOP/COEP." >&2
    BTE_COMMON_FLAGS+=(
        -s USE_PTHREADS=1
        -s PTHREAD_POOL_SIZE=4
        -s ENVIRONMENT='web,worker'
    )
fi
