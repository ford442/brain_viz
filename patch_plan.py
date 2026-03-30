import re

with open('agent_plan.md', 'r') as f:
    content = f.read()

# Add to Phase 2
new_task = "- [ ] **Cognitive Stress Distortion:** Implement `stress` uniform to visualize cognitive load/stress via high-frequency surface vertex displacement."
content = re.sub(r'(### Phase 2: Advanced Choreography\n)', r'\1' + new_task + '\n', content)

# Remove the idea from dream log
content = re.sub(r'\* \*Idea:\* "What if we visualized stress levels as brain surface distortion\?"\n', '', content)

with open('agent_plan.md', 'w') as f:
    f.write(content)
