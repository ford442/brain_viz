import re

with open('main.js', 'r') as f:
    content = f.read()

# Add new mini-routine 'u'
noradrenaline_routine = """    'u': [ // Noradrenaline Spike
        { time: 0.0, type: 'text', message: 'Noradrenaline Spike: Global Alertness!', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'sound', frequency: 1200, oscType: 'square', duration: 0.3, volume: 0.6 },
        { time: 0.0, type: 'noradrenaline', intensity: 1.5, duration: 3.0 },
        { time: 3.0, type: 'text', message: 'Alertness returning to baseline.', duration: 2.0 },
        { time: 4.0, type: 'calm' }
    ],
    'a': [ // Adrenaline Surge"""

content = content.replace("    'a': [ // Adrenaline Surge", noradrenaline_routine)

# Update UI Legend
old_legend = "l=Lighting, g=Glitch, d=Dopamine, e=Endorphin, j=Melatonin, a=Adrenaline, m=Memory"
new_legend = "l=Lighting, g=Glitch, d=Dopamine, e=Endorphin, j=Melatonin, a=Adrenaline, u=Noradrenaline, m=Memory"
content = content.replace(old_legend, new_legend)

with open('main.js', 'w') as f:
    f.write(content)

