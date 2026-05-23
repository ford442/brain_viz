import re

with open('src/routine-player.js', 'r') as f:
    content = f.read()

# Replace the extra closing brace around line 535
pattern = r'            \}\n        \}\n        \}\n\n        \/\/ Advance timeline if not paused waiting for a signal'
replacement = r'            }\n        }\n\n        // Advance timeline if not paused waiting for a signal'
content = re.sub(pattern, replacement, content)

with open('src/routine-player.js', 'w') as f:
    f.write(content)
