import re

with open('src/main.js', 'r') as f:
    content = f.read()

# Make audioReactor accessible on window so routine-player can read it
content = content.replace("const audioReactor = new AudioReactor();", "const audioReactor = new AudioReactor();\n        window.audioReactor = audioReactor;")

with open('src/main.js', 'w') as f:
    f.write(content)
