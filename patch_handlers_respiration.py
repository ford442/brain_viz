import re

with open('src/routine-handlers.js', 'r') as f:
    content = f.read()

# Remove the old `respiration` handler since it's now a continuous loop in `routine-player.js`.
# Actually we can keep it as a toggle or ignore it, but the user requested: "Change the respiration system from event-based to a continuous loop."
# Let's remove the whole 'respiration' handler block.
pattern = r'    // \[Phase 2, 3\] Respiration Simulation \(Dynamic\)\n    handlers.set\(\'respiration\', \(evt\) => \{.*?\n            \}\n        \}\n    \}\);\n\n\n'
content = re.sub(pattern, '', content, flags=re.DOTALL)

with open('src/routine-handlers.js', 'w') as f:
    f.write(content)
