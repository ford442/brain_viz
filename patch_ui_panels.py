import re

with open('src/ui-panels.js', 'r') as f:
    content = f.read()

# Add to the "Systems" section, right after Heartbeat
content = re.sub(r'(<div class="legend-item"><span class="legend-key">H</span><span>Heartbeat</span></div>)', r'\1\n                <div class="legend-item"><span class="legend-key">R</span><span>Respiration</span></div>', content)

with open('src/ui-panels.js', 'w') as f:
    f.write(content)
