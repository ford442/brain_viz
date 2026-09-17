#!/usr/bin/env bash
# scripts/test_golden.sh
# [Tensor Physics] Compiles and runs the cross-implementation golden test:
# the C++ BrainTensorEngine against the fixture produced by the JavaScript
# reference stepper. No Emscripten required — a host C++17 compiler is enough,
# which is what makes this runnable in CI.
#
#   bash scripts/test_golden.sh        # or: npm run test:golden
#
# If the JS side of the contract changed on purpose, regenerate the fixture
# first: node scripts/gen_tensor_fixture.mjs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURE="${REPO_ROOT}/tests/fixtures/tensor-field-golden.bin"

if [[ ! -f "${FIXTURE}" ]]; then
    echo "[test_golden] Fixture missing. Run: node scripts/gen_tensor_fixture.mjs" >&2
    exit 2
fi

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

echo "[test_golden] Compiling with ${CXX_BIN}…"
# -ffp-contract=off keeps the compiler from fusing multiply-add pairs, which
# would change rounding relative to the JavaScript reference and make the
# epsilon a property of the optimiser rather than of the algorithm.
"${CXX_BIN}" -std=c++17 -O2 -ffp-contract=off -Wall -Wextra \
    -I"${REPO_ROOT}/wasm" \
    "${REPO_ROOT}/wasm/brain_tensor_engine.cpp" \
    "${REPO_ROOT}/wasm/tests/golden_step_test.cpp" \
    -o "${BUILD_DIR}/golden_step_test"

"${BUILD_DIR}/golden_step_test" "${FIXTURE}"
