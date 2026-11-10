import re

with open('agent_plan.md', 'r') as f:
    content = f.read()

# Instead of fully changing the prompt instruction which we can't do, let's mark the specific "[ ]" task as "[x]" if any exists
if "[ ] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer." in content:
    content = content.replace("[ ] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer.", "[x] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer.")
elif "[ ] **Neuro-Script Implementation Cycle:**" in content:
    content = re.sub(r'\[ \] \*\*Neuro-Script Implementation Cycle:\*\*', '[x] **Neuro-Script Implementation Cycle:**', content)

with open('agent_plan.md', 'w') as f:
    f.write(content)
