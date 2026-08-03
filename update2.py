import re

with open("agent_plan.md", "r") as f:
    plan_content = f.read()

plan_content = plan_content.replace(
"- [ ] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.",
"- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation."
)
plan_content = plan_content.replace(
"- [ ] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.",
"- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles."
)

with open("agent_plan.md", "w") as f:
    f.write(plan_content)
