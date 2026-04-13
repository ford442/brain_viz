import re
from datetime import datetime

with open('agent_plan.md', 'r') as f:
    content = f.read()

# Check off task
content = content.replace(
    '- [ ] **Noradrenaline Spike:** Implement `noradrenaline` event handler to visualize Noradrenaline as a sudden spike in connectome frequency and global alertness.',
    '- [x] **Noradrenaline Spike:** Implement `noradrenaline` event handler to visualize Noradrenaline as a sudden spike in connectome frequency and global alertness.'
)

# Add to changelog (top of latest changelog block)
today = datetime.now().strftime('%Y-%m-%d')
changelog_entry = f"* [{today}] - Completed Phase 5 (Noradrenaline Spike). Implemented `noradrenaline` event handler in `routine-player.js` to simulate global alertness via connectome frequency and flow speed. Bound to 'u' key in `main.js`. Added Histamine idea to Dream Log.\n"
content = content.replace("## 📜 Changelog\n", f"## 📜 Changelog\n{changelog_entry}", 1)

# Add new idea to Dream Log
new_idea = "* *Idea:* \"What if we visualized Histamine release as a localized inflammatory response/color shift?\"\n"
content = content.replace("## 📜 Changelog", f"{new_idea}\n## 📜 Changelog", 1)

with open('agent_plan.md', 'w') as f:
    f.write(content)
