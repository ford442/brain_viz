import re

with open('main.js', 'r') as f:
    content = f.read()

# Add to panic attack
panic_find = r"        \{ time: 0\.0, type: 'shake', intensity: 0\.1, duration: 4\.0 \},"
panic_replace = panic_find + r"\n        { time: 0.0, type: 'stress', intensity: 1.5, duration: 2.0, ease: 'quadOut' },\n        { time: 2.0, type: 'stress', intensity: 0.0, duration: 2.0, ease: 'quadInOut' },"

content = re.sub(panic_find, panic_replace, content)

with open('main.js', 'w') as f:
    f.write(content)

with open('index.html', 'r') as f:
    html = f.read()

html_find = r'            <label>Camera Shake <span id="val-shake" class="value">0\.0</span></label>\n            <input type="range" id="shake" min="0\.0" max="0\.2" step="0\.01" value="0\.0">\n        </div>'
html_replace = html_find + r'''

        <div class="control-group">
            <label>Stress (Distortion) <span id="val-stress" class="value">0.0</span></label>
            <input type="range" id="stress" min="0.0" max="2.0" step="0.05" value="0.0">
        </div>'''

html = re.sub(html_find, html_replace, html)

with open('index.html', 'w') as f:
    f.write(html)
