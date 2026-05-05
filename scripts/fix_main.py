with open("main.js", "r") as f:
    content = f.read()

content = content.replace(r"\{ time: 0\.0, type: 'shake', intensity: 0\.1, duration: 4\.0 \},", r"{ time: 0.0, type: 'shake', intensity: 0.1, duration: 4.0 },")
content = content.replace(r"shake: document\.getElementById\('shake'\), // \[Phase 2\]", r"shake: document.getElementById('shake'), // [Phase 2]")
content = content.replace(r"shake: document\.getElementById\('val-shake'\), // \[Phase 2\]", r"shake: document.getElementById('val-shake'), // [Phase 2]")

with open("main.js", "w") as f:
    f.write(content)
