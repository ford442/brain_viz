import re

with open('src/mini-routines.js', 'r') as f:
    content = f.read()

routine_code = """    'R': [ // Respiration Cycle
        { time: 0.0, type: 'text', message: 'Respiration Cycle: Inhale', duration: 1.6 },
        { time: 0.0, type: 'respiration', intensity: 1.0, duration: 4.0 },
        { time: 1.6, type: 'text', message: 'Exhale...', duration: 2.4 },
        { time: 4.5, type: 'calm' }
    ],
"""

# Insert before 'E' routine
content = re.sub(r"(\s*'E': \[ // Electrical Exposure)", routine_code + r"\1", content)

with open('src/mini-routines.js', 'w') as f:
    f.write(content)
