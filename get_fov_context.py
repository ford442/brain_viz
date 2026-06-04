import sys

def get_context():
    with open("src/routine-camera.js", "r") as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if "pathZoom" in line:
                start = max(0, i - 10)
                end = min(len(lines), i + 20)
                print("Context for pathZoom:")
                for j in range(start, end):
                    print(f"{j+1}: {lines[j]}", end="")
                print("-" * 20)

get_context()
