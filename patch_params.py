import re
with open('brain-renderer.js', 'r') as f:
    content = f.read()

# Fix syntax error
content = content.replace(
    "dirIntensity: 0.8 // [Phase 2] Directional Light Intensity\n            stress: 0.0 // [Phase 2] Cognitive Stress Distortion",
    "dirIntensity: 0.8, // [Phase 2] Directional Light Intensity\n            stress: 0.0 // [Phase 2] Cognitive Stress Distortion"
)

# Fix calm state list
content = content.replace(
    "'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'",
    "'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ', 'stress'"
)

with open('brain-renderer.js', 'w') as f:
    f.write(content)
