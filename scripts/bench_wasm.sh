#!/usr/bin/env bash
# scripts/bench_wasm.sh
# [Tensor Physics] Measure bte_update() per-step cost at 32³/48³/64³.
#
#   bash scripts/bench_wasm.sh               # or: npm run bench:wasm
#   BENCH_HOST=1 bash scripts/bench_wasm.sh  # also the host-compiled engine
#
# Builds wasm/tests/bench_step.cpp against the engine twice with em++ — the
# release flags (-O3 -flto -msimd128) and the same minus -msimd128 — and runs
# both under node, so the SIMD kernel's contribution is a measured number, not
# an assumption. The results table in docs/wasm-engine.md comes from here.
#
# Node's V8 runs the same wasm a browser does, but expect a browser tab
# (shared main thread, power management) to be somewhat slower.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
export REPO_ROOT
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/wasm_flags.sh"

if ! command -v em++ >/dev/null 2>&1; then
    echo "[bench_wasm] em++ not on PATH — activate emsdk (see scripts/build_wasm.sh)." >&2
    exit 1
fi

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "${BUILD_DIR}"' EXIT

NODE_FLAGS=(-s ENVIRONMENT=node -s ALLOW_MEMORY_GROWTH=1)
STEPS="${BENCH_STEPS:-40}"

echo "[bench_wasm] Building SIMD and scalar wasm benchmarks…"
em++ "${BTE_CLANG_FLAGS[@]}" "${BTE_TARGET_FLAGS[@]}" "${BTE_RELEASE_FLAGS[@]}" "${NODE_FLAGS[@]}" \
    "${BTE_SRCS[@]}" "${BTE_BENCH_SRC}" -o "${BUILD_DIR}/bench_simd.cjs"
em++ "${BTE_CLANG_FLAGS[@]}" "${BTE_RELEASE_FLAGS[@]}" "${NODE_FLAGS[@]}" \
    "${BTE_SRCS[@]}" "${BTE_BENCH_SRC}" -o "${BUILD_DIR}/bench_scalar.cjs"

node "${BUILD_DIR}/bench_simd.cjs" "wasm release" "${STEPS}"
node "${BUILD_DIR}/bench_scalar.cjs" "wasm no-simd" "${STEPS}"

if [[ "${BENCH_HOST:-0}" == "1" ]]; then
    "${CXX:-c++}" "${BTE_HOST_FLAGS[@]}" "${BTE_SRCS[@]}" "${BTE_BENCH_SRC}" -o "${BUILD_DIR}/bench_host"
    "${BUILD_DIR}/bench_host" "host -O2" "${STEPS}"
fi
