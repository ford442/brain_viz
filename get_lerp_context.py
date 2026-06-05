import sys

def get_context():
    with open("src/routine-player.js", "r") as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            if "cameraZoom" in line:
                start = max(0, i - 15)
                end = min(len(lines), i + 15)
                print("Context for cameraZoom:")
                for j in range(start, end):
                    print(f"{j+1}: {lines[j]}", end="")
                print("-" * 20)

get_context()
