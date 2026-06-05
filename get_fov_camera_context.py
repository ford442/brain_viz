import sys

def get_context():
    with open("src/routine-camera.js", "r") as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if "pathZoom =" in line or "pathZoom.push" in line or "const pz =" in line or "prevZoom =" in line or "bump =" in line or "midZoom =" in line:
                start = max(0, i - 2)
                end = min(len(lines), i + 3)
                print(f"Context near {i+1}:")
                for j in range(start, end):
                    print(f"{j+1}: {lines[j]}", end="")
                print("-" * 20)

get_context()
