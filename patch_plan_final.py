import re
import datetime

with open('agent_plan.md', 'r') as f:
    content = f.read()

# Mark completed
content = re.sub(r'\- \[ \] \*\*Cognitive Stress Distortion:\*\*', r'- [x] **Cognitive Stress Distortion:**', content)

# Add to changelog
date_str = datetime.datetime.now().strftime("%Y-%m-%d")
changelog_entry = f"* [{date_str}] - Completed Phase 2 (Cognitive Stress Distortion). Implemented `stress` uniform in shaders for high-frequency vertex displacement. Added event handler in `routine-player.js` and updated UI/Panic Routine in `main.js`. Added Dream Log idea."

content = re.sub(r'(## 📜 Changelog\n)', r'\1' + changelog_entry + '\n', content)

# Add new idea to dream log
new_idea = '* *Idea:* "Brain-Computer Interface (BCI) Training Mode" - A gamified mode where users try to maintain specific brain states (e.g., keeping the `stress` level below a threshold) to complete objectives.\n'
content = re.sub(r'(## 🧪 "Dream" Log \(Future Concepts\)\n)', r'\1' + new_idea, content)

with open('agent_plan.md', 'w') as f:
    f.write(content)
