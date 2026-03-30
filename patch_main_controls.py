import re

with open('main.js', 'r') as f:
    content = f.read()

# Add stress to inputs and labels
inputs_find = r"        shake: document\.getElementById\('shake'\), // \[Phase 2\]"
inputs_replace = inputs_find + r"\n        stress: document.getElementById('stress'), // [Phase 2] Stress Distortion"
content = re.sub(inputs_find, inputs_replace, content)

labels_find = r"        shake: document\.getElementById\('val-shake'\), // \[Phase 2\]"
labels_replace = labels_find + r"\n        stress: document.getElementById('val-stress'), // [Phase 2] Stress Distortion"
content = re.sub(labels_find, labels_replace, content)

# Add stress to calm sync
calm_find = r"'shake', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'"
calm_replace = r"'shake', 'stress', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'"
content = re.sub(calm_find, calm_replace, content)

with open('main.js', 'w') as f:
    f.write(content)
