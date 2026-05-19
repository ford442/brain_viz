import re

with open('agent_plan.md', 'r') as f:
    content = f.read()

# Update Respiration Simulation task
content = content.replace('- [ ] **Respiration Simulation:** Implement a respiration event type that links to heartbeat and modulates flow speed and overall scene intensity.', '- [x] **Respiration Simulation:** Implement a respiration event type that links to heartbeat and modulates flow speed and overall scene intensity.')

# Add new task to Phase 3
new_task = '- [ ] **Dynamic Environment Reactions:** Allow respiration rate to dynamically react to visual stimuli or events.'
content = re.sub(r'(### Phase 3: "Brain DJ" Mode \(Live Performance\)\n)', r'\1' + new_task + '\n', content)

# Add new idea to Dream Log
new_idea = '* *Idea:* "What if we visualized breathing rate as a subtle global illumination pulsing effect?"'
content = re.sub(r'(## 🧪 "Dream" Log \(Future Concepts\)\n)', r'\1' + new_idea + '\n', content)

with open('agent_plan.md', 'w') as f:
    f.write(content)
