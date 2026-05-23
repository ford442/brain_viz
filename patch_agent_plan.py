import re

with open('agent_plan.md', 'r') as f:
    content = f.read()

# Update tasks in Phase 3
content = content.replace("- [x] **Audio Reactivity:** Connect the Web Audio API to drive `amplitude` and `stimulus` intensity based on microphone input or music.",
"""- [x] **Audio Reactivity:** Connect the Web Audio API to drive `amplitude` and `stimulus` intensity based on microphone input or music.
- [x] **Central Reactivity Bus:** Implement normalized and smoothed properties for `bass`, `energy`, `brightness`, and `onset`.
- [x] **Dynamic Continuous Respiration:** Make respiration a continuous loop driven by audio energy instead of a one-shot event.
- [x] **Music-Reactive Visual Parameters:** Map audio features to visual elements (e.g., energy -> zoom, bass -> colorShift, onset -> sparkle).""")

# Add to Dream Log
dream_log_addition = """* *Idea:* "What if we visualized breathing rate visually using volumetric particle condensation near the olfactory bulb?"
* *Idea:* "What if we allowed users to map their own custom audio features to arbitrary parameters via a GUI matrix?"""

content = content.replace('* *Idea:* "What if we visualized breathing rate visually using volumetric particle condensation near the olfactory bulb?"', dream_log_addition)

with open('agent_plan.md', 'w') as f:
    f.write(content)
