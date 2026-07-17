import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERIFICATION_DIR = ROOT / "verification"

SCRIPTS = [
    "verify_brain.py",
    "verify_stimulus.py",
    "verify_camera.py",
    "verify_routine.py",
    "verify_synaptix.py",
    "verify_neuromodulators.py",
    "verify_timeline_editor.py",
    "verify_ai_inference.py",
    "verify_cinematic_fx.py",
    "verify_neurochemical_fx.py",
    "verify_branching.py",
    "verify_glitch.py",
]


def run_script(name: str) -> bool:
    path = VERIFICATION_DIR / name
    if not path.exists():
        print(f"SKIP: {name} not found")
        return False
    print(f"\n=== Running {name} ===")
    result = subprocess.run(
        [sys.executable, str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"PASS: {name}")
        if result.stdout:
            print(result.stdout.strip())
        return True
    else:
        print(f"FAIL: {name}")
        if result.stdout:
            print(result.stdout.strip())
        if result.stderr:
            print(result.stderr.strip())
        return False


def main() -> None:
    results = {}
    for script in SCRIPTS:
        results[script] = run_script(script)

    print("\n" + "=" * 50)
    print("VERIFICATION SUITE RESULTS")
    print("=" * 50)
    passed = sum(1 for v in results.values() if v)
    total = len(SCRIPTS)
    for script, ok in results.items():
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {script}")
    print(f"\nTotal: {passed}/{total} passed")

    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    main()
