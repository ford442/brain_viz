import re

with open('brain-renderer.js', 'r') as f:
    content = f.read()

# Add stress to this.params
content = re.sub(r'(dirIntensity: 0\.8 // \[Phase 2\] Directional Light Intensity\n)', r'\1            stress: 0.0 // [Phase 2] Cognitive Stress Distortion\n', content)

# Adjust buffer size. Old size was 56 floats (224 bytes) -> now we have 1 new float.
# It may need alignment padding depending on where it's inserted.
# The layout in shaders.js:
#   lightDir: vec3<f32>, (12 bytes)
#   ambientLight: f32, (4 bytes)
#   dirIntensity: f32, (4 bytes)
#   stress: f32, (4 bytes)
# Total for this block: 12 + 4 + 4 + 4 = 24 bytes.
# Let's check alignment:
# OFFSET_LIGHT_DIR was 48. vec3 must be 16-byte aligned!
# So lightDir is at float offset 48 (bytes 192).
# vec3 takes floats 48, 49, 50.
# float 51 is ambientLight.
# float 52 is dirIntensity.
# float 53 is stress.
#
# float array size 56 is still enough to hold 54 elements.
# Let's update the layout logic:

content = re.sub(r'(const OFFSET_DIR_INTENSITY = 52;\n)', r'\1        const OFFSET_STRESS = 53;\n', content)
content = re.sub(r'(uData\[OFFSET_DIR_INTENSITY\] = this\.params\.dirIntensity;\n)', r'\1        uData[OFFSET_STRESS] = this.params.stress;\n', content)

# Update calm state
content = re.sub(r"(this\.params\.aperture = 0\.0;\n)", r"\1        this.params.stress = 0.0;\n", content)

with open('brain-renderer.js', 'w') as f:
    f.write(content)
