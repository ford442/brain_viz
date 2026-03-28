import re

with open('index.html', 'r') as f:
    content = f.read()

find_str = r'''        <div class="control-group">
            <label>Camera Shake <span id="val-shake" class="value">0\.0</span></label>
            <input type="range" id="shake" min="0\.0" max="0\.2" step="0\.01" value="0\.0">
        </div>'''

replace_str = r'''        <div class="control-group">
            <label>Camera Shake <span id="val-shake" class="value">0.0</span></label>
            <input type="range" id="shake" min="0.0" max="0.2" step="0.01" value="0.0">
        </div>

        <div class="control-group">
            <label>Stress (Distortion) <span id="val-stress" class="value">0.0</span></label>
            <input type="range" id="stress" min="0.0" max="2.0" step="0.05" value="0.0">
        </div>'''

content = re.sub(find_str, replace_str, content)

with open('index.html', 'w') as f:
    f.write(content)
