import re

with open('shaders.js', 'r') as f:
    content = f.read()

# Add to GHOST MODE
find_str = r'''    // --- GHOST MODE ---
    else {
        let displacement = input.normal \* activity \* 0.05;
        finalPos = input.position \+ displacement;
        finalColor = vec3<f32>\(0.2, 0.6, 1.0\);'''

replace_str = r'''    // --- GHOST MODE ---
    else {
        let displacement = input.normal * activity * 0.05;
        finalPos = input.position + displacement;

        // [Phase 2] Cognitive Stress Distortion
        if (uniforms.stress > 0.0) {
            let noiseFreq = 15.0;
            let stressDisp = sin(finalPos.x * noiseFreq + uniforms.time * 10.0) * cos(finalPos.y * noiseFreq + uniforms.time * 8.0) * sin(finalPos.z * noiseFreq);
            finalPos += input.normal * stressDisp * uniforms.stress * 0.5;
        }

        finalColor = vec3<f32>(0.2, 0.6, 1.0);'''

content = re.sub(find_str, replace_str, content)

with open('shaders.js', 'w') as f:
    f.write(content)
