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
# It is also the one place the engine's *source list* and its *host* flags
# live: scripts/test_golden.sh, scripts/bench_wasm.sh and
# scripts/gen_compile_commands.mjs all read them from here, so the editor's
# compile graph, the golden test and the shipped binary cannot disagree about
# which files make up the engine or how floating point is compiled.
#
# Inputs (environment):
#   REPO_ROOT        repo checkout root (required)
#   OUT_DIR          output directory (default: $REPO_ROOT/public/wasm)
#   OUT_NAME         output basename without extension (default: brain_tensor_engine)
#   WASM_PTHREADS=1  opt into pthreads (off by default — see below)
#
# Sets:
#   BTE_SRCS             the engine's translation units (array; spec-section split,
#                        see wasm/src/engine.h)
#   BTE_GOLDEN_SRC       the golden test TU (host and, optionally, wasm)
#   BTE_BENCH_SRC        the frame-budget benchmark TU
#   BTE_OUTPUT           the emitted ES module
#   BTE_MANIFEST         the build manifest next to it (read by src/wasm-engine.js)
#   BTE_CLANG_FLAGS      language/include/FP setup shared by EVERY graph
#   BTE_HOST_FLAGS       the host golden build (= BTE_CLANG_FLAGS + -O2)
#   BTE_TARGET_FLAGS     wasm target features, release and debug alike
#   BTE_COMMON_FLAGS     em++ flags shared by debug and release (incl. -s settings)
#   BTE_RELEASE_FLAGS    release-only optimisation flags
#   BTE_DEBUG_FLAGS      debug-only instrumentation flags
#   BTE_PTHREADS         1 if this configuration builds with pthreads, else 0

OUT_DIR="${OUT_DIR:-${REPO_ROOT}/public/wasm}"
OUT_NAME="${OUT_NAME:-brain_tensor_engine}"

# The engine, split by docs/tensor-physics.md section. Add a TU here and every
# consumer (em++, golden, bench, clangd) picks it up.
BTE_SRCS=(
    "${REPO_ROOT}/wasm/brain_tensor_engine.cpp"   # C ABI
    "${REPO_ROOT}/wasm/src/affinity.cpp"          # §7
    "${REPO_ROOT}/wasm/src/stencil.cpp"           # §6.2 (explicit SIMD)
    "${REPO_ROOT}/wasm/src/step.cpp"              # §6
    "${REPO_ROOT}/wasm/src/stimulus.cpp"          # §6.9 one-shot
)
BTE_GOLDEN_SRC="${REPO_ROOT}/wasm/tests/golden_step_test.cpp"
BTE_BENCH_SRC="${REPO_ROOT}/wasm/tests/bench_step.cpp"

# The glue is emitted as a real ES module (.mjs) so it can be `import()`ed with
# a URL built from import.meta.env.BASE_URL. The old CommonJS-ish .js was loaded
# from a hardcoded host-root '/wasm/…', which 404s under `base: '/brain-viz/'`.
BTE_OUTPUT="${OUT_DIR}/${OUT_NAME}.mjs"
BTE_MANIFEST="${OUT_DIR}/${OUT_NAME}.build.json"

BTE_CLANG_FLAGS=(
    -std=c++17
    -I"${REPO_ROOT}/wasm"
    -Wall
    -Wextra

    # Never fuse a*b+c into an FMA. The JS reference rounds every operation,
    # and the golden epsilon must stay a property of the algorithm, not of the
    # optimiser. Baseline wasm has no scalar or simd128 FMA to contract into,
    # so on em++ this only states the contract; on the host build (x86 FMA3,
    # aarch64) it is load-bearing.
    -ffp-contract=off
)

# The golden test's build: the same language setup, optimised like a release
# but with no Emscripten anywhere (CI has only a host compiler).
BTE_HOST_FLAGS=(
    "${BTE_CLANG_FLAGS[@]}"
    -O2
)

# 128-bit SIMD. A target feature, not an optimisation level, so the debug build
# runs the same §6.2 kernel the release does (src/stencil.cpp). Baseline simd128
# is supported by every browser that supports WebGPU, so this costs no reach.
#
# On its own the flag bought almost nothing: the old single-TU step was never
# auto-vectorised. The SIMD is written out in src/stencil.cpp under
# __wasm_simd128__, bit-identical to its scalar fallback.
BTE_TARGET_FLAGS=(
    -msimd128

    # Relaxed SIMD would allow fused multiply-add (relaxed_madd), which changes
    # rounding and would put the C++ engine outside the golden fixture's
    # epsilon against the JS reference stepper. Keep it off; src/stencil.cpp
    # relies on there being no FMA for its bit-identity argument.
    # -mrelaxed-simd
)

BTE_COMMON_FLAGS=(
    "${BTE_CLANG_FLAGS[@]}"
    "${BTE_TARGET_FLAGS[@]}"

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
        "_bte_params_layout_hash",
        "_bte_build_features",
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
)

BTE_RELEASE_FLAGS=(
    -O3
    -flto
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
# (deploy.py) is not confirmed to. A pthreads build cannot even be instantiated
# without isolation, so src/wasm-engine.js reads BTE_MANIFEST and refuses a
# pthreads build up front when `crossOriginIsolated` is false, rather than
# failing obscurely inside the glue. See docs/wasm-engine.md "Threads".
#
# Note the step itself is still single-threaded: WASM_PTHREADS=1 today only
# proves the plumbing. It buys nothing until bte_update() tiles z-slabs.
BTE_PTHREADS=0
if [[ "${WASM_PTHREADS:-0}" == "1" ]]; then
    echo "[wasm_flags] pthreads ENABLED — the serving host must send COOP/COEP." >&2
    BTE_PTHREADS=1
    BTE_COMMON_FLAGS+=(
        -pthread
        -s PTHREAD_POOL_SIZE=4
    )
fi

# Shared by both build scripts: everything after the em++ invocation.
# Writes the manifest src/wasm-engine.js reads *before* importing the glue
# (a pthreads build cannot be instantiated just to ask it whether it is one).
bte_write_manifest() {
    local debug="$1"
    cat > "${BTE_MANIFEST}" <<JSON
{
  "engine": "BrainTensorEngine",
  "simd128": true,
  "pthreads": $([[ "${BTE_PTHREADS}" == "1" ]] && echo true || echo false),
  "debug": ${debug}
}
JSON
}
