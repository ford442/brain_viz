with open("agent_plan.md", "r") as f:
    text = f.read()
if "Phase 22" not in text:
    print("WARNING: Phase 22 not in agent_plan.md")
else:
    print("SUCCESS: Phase 22 is in agent_plan.md")
