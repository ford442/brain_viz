#!/usr/bin/env bash
# scripts/test_golden.sh
# [Tensor Physics] Compiles and runs the cross-implementation golden test:
# the C++ BrainTensorEngine against the fixture produced by the JavaScript
# reference stepper. No Emscripten required — a host C++17 compiler is enough,
# which is what makes this runnable in CI.
#
#   bash scripts/test_golden.sh        # or: npm run test:golden
#   GOLDEN_WASM=1 bash scripts/test_golden.sh
#       additionally builds the same test with em++ and the release target
#       flags (-O3 -flto -msimd128) and runs it under node. The host build can
#       only exercise the scalar path of src/stencil.cpp; this runs the SIMD
#       one, with Emscripten's libm, against the same fixtures and epsilon.
#       Needs em++ on PATH; skips loudly without it.
#
# Sources and flags come from scripts/wasm_flags.sh (BTE_SRCS, BTE_HOST_FLAGS),
# the same definitions the release build and the clangd compile graph use.
#
# If the JS side of the contract changed on purpose, regenerate the fixture
# first: node scripts/gen_tensor_fixture.mjs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURE_DIR="${REPO_ROOT}/tests/fixtures"

export REPO_ROOT
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/wasm_flags.sh"

for stem in tensor-field-golden tensor-field-golden-neuromod; do
    if [[ ! -f "${FIXTURE_DIR}/${stem}.bin" ]]; then
        echo "[test_golden] Fixture ${stem}.bin missing. Run: node scripts/gen_tensor_fixture.mjs" >&2
        exit 2
    fi
done

CXX_BIN="${CXX:-}"
if [[ -z "${CXX_BIN}" ]]; then
    for candidate in c++ clang++ g++; do
        if command -v "${candidate}" >/dev/null 2>&1; then CXX_BIN="${candidate}"; break; fi
    done
fi
if [[ -z "${CXX_BIN}" ]]; then
    echo "[test_golden] SKIP: no C++ compiler found (set \$CXX to run this check)." >&2
    exit 0
fi

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "[test_golden] Compiling ${#BTE_SRCS[@]} engine TUs with ${CXX_BIN} (${BTE_HOST_FLAGS[*]})…"
"${CXX_BIN}" "${BTE_HOST_FLAGS[@]}" \
    "${BTE_SRCS[@]}" "${BTE_GOLDEN_SRC}" \
    -o "${BUILD_DIR}/golden_step_test"

"${BUILD_DIR}/golden_step_test" "${FIXTURE_DIR}"

if [[ "${GOLDEN_WASM:-0}" == "1" ]]; then
    if ! command -v em++ >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
        echo "[test_golden] GOLDEN_WASM=1 but em++ or node is not on PATH — SKIPPING the wasm SIMD run." >&2
        exit 0
    fi
    echo "[test_golden] Compiling the wasm SIMD build (${BTE_RELEASE_FLAGS[*]} ${BTE_TARGET_FLAGS[*]})…"
    # NODERAWFS lets the unmodified test fopen() the fixtures from disk.
    em++ "${BTE_CLANG_FLAGS[@]}" "${BTE_TARGET_FLAGS[@]}" "${BTE_RELEASE_FLAGS[@]}" \
        -s ENVIRONMENT=node -s NODERAWFS=1 -s ALLOW_MEMORY_GROWTH=1 \
        "${BTE_SRCS[@]}" "${BTE_GOLDEN_SRC}" \
        -o "${BUILD_DIR}/golden_step_test.cjs"
    node "${BUILD_DIR}/golden_step_test.cjs" "${FIXTURE_DIR}"
fi
