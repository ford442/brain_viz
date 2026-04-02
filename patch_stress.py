import re

# 1. Update shaders.js
with open('shaders.js', 'r') as f:
    content = f.read()

find_str = r'''    // --- GHOST MODE ---
    else \{
        let displacement = input.normal \* activity \* 0\.05;
        finalPos = input.position \+ displacement;
        finalColor = vec3<f32>\(0\.2, 0\.6, 1\.0\);'''

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

# 2. Update brain-renderer.js
with open('brain-renderer.js', 'r') as f:
    content = f.read()

content = re.sub(r'(dirIntensity: 0\.8 // \[Phase 2\] Directional Light Intensity\n)', r'\1            stress: 0.0 // [Phase 2] Cognitive Stress Distortion\n', content)
content = re.sub(r'(const OFFSET_DIR_INTENSITY = 52;\n)', r'\1        const OFFSET_STRESS = 53;\n', content)
content = re.sub(r'(uData\[OFFSET_DIR_INTENSITY\] = this\.params\.dirIntensity;\n)', r'\1        uData[OFFSET_STRESS] = this.params.stress;\n', content)
content = re.sub(r"(this\.params\.aperture = 0\.0;\n)", r"\1        this.params.stress = 0.0;\n", content)

with open('brain-renderer.js', 'w') as f:
    f.write(content)

# 3. Update main.js
with open('main.js', 'r') as f:
    content = f.read()

inputs_find = r"        shake: document\.getElementById\('shake'\), // \[Phase 2\]"
inputs_replace = "        shake: document.getElementById('shake'), // [Phase 2]\n        stress: document.getElementById('stress'), // [Phase 2] Stress Distortion"
content = re.sub(inputs_find, inputs_replace, content)

labels_find = r"        shake: document\.getElementById\('val-shake'\), // \[Phase 2\]"
labels_replace = "        shake: document.getElementById('val-shake'), // [Phase 2]\n        stress: document.getElementById('val-stress'), // [Phase 2] Stress Distortion"
content = re.sub(labels_find, labels_replace, content)

calm_find = r"'shake', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'"
calm_replace = r"'shake', 'stress', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'"
content = re.sub(calm_find, calm_replace, content)

panic_find = r"        \{ time: 0\.0, type: 'shake', intensity: 0\.1, duration: 4\.0 \},"
panic_replace = "        { time: 0.0, type: 'shake', intensity: 0.1, duration: 4.0 },\n        { time: 0.0, type: 'stress', intensity: 1.5, duration: 2.0, ease: 'quadOut' },\n        { time: 2.0, type: 'stress', intensity: 0.0, duration: 2.0, ease: 'quadInOut' },"
content = re.sub(panic_find, panic_replace, content)

with open('main.js', 'w') as f:
    f.write(content)

# 4. Update index.html
with open('index.html', 'r') as f:
    html = f.read()

html_find = r'            <label>Camera Shake <span id="val-shake" class="value">0\.0</span></label>\n            <input type="range" id="shake" min="0\.0" max="0\.2" step="0\.01" value="0\.0">\n        </div>'
html_replace = '''            <label>Camera Shake <span id="val-shake" class="value">0.0</span></label>
            <input type="range" id="shake" min="0.0" max="0.2" step="0.01" value="0.0">
        </div>

        <div class="control-group">
            <label>Stress (Distortion) <span id="val-stress" class="value">0.0</span></label>
            <input type="range" id="stress" min="0.0" max="2.0" step="0.05" value="0.0">
        </div>'''
html = re.sub(html_find, html_replace, html)

with open('index.html', 'w') as f:
    f.write(html)

# 5. Update agent_plan.md
with open('agent_plan.md', 'r') as f:
    content = f.read()

content = re.sub(r'\- \[ \] \*\*Cognitive Stress Distortion:\*\*', r'- [x] **Cognitive Stress Distortion:**', content)

import datetime
date_str = datetime.datetime.now().strftime("%Y-%m-%d")
changelog_entry = f"* [{date_str}] - Completed Phase 2 (Cognitive Stress Distortion). Implemented `stress` uniform in shaders for high-frequency vertex displacement. Added event handler in `routine-player.js` and updated UI/Panic Routine in `main.js`. Added Dream Log idea."
content = re.sub(r'(## 📜 Changelog\n)', r'\1' + changelog_entry + '\n', content)

new_idea = '* *Idea:* "Brain-Computer Interface (BCI) Training Mode" - A gamified mode where users try to maintain specific brain states (e.g., keeping the `stress` level below a threshold) to complete objectives.\n'
content = re.sub(r'(## 🧪 "Dream" Log \(Future Concepts\)\n)', r'\1' + new_idea, content)

content = re.sub(r'\* \*Idea:\* "What if we visualized stress levels as brain surface distortion\?"\n', '', content)

with open('agent_plan.md', 'w') as f:
    f.write(content)
