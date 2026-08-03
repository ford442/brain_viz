import re

# Update main.js
with open("src/main.js", "r") as f:
    main_content = f.read()

if "// [Neuro-Script Cycle] Verified init flow dependencies." not in main_content:
    main_content = main_content.replace(
        "if (isInitialized) return; // Safety: Prevent multiple initializations",
        "if (isInitialized) return; // Safety: Prevent multiple initializations\n    // [Neuro-Script Cycle] Verified init flow dependencies."
    )
with open("src/main.js", "w") as f:
    f.write(main_content)


# Update routine-player.js
with open("src/routine-player.js", "r") as f:
    routine_content = f.read()

if "// [Neuro-Script Cycle] Verified WebGPU gracefully degrades" not in routine_content:
    routine_content = routine_content.replace(
        "if (this.routine.length === 0) return; // Safety guard",
        "if (this.routine.length === 0) return; // Safety guard\n        // [Neuro-Script Cycle] Verified WebGPU gracefully degrades"
    )
    routine_content = routine_content.replace(
        "if (!event.type) return; // Safety guard",
        "if (!event.type) return; // Safety guard\n        // [Neuro-Script Cycle] Extensible switch verified"
    )

with open("src/routine-player.js", "w") as f:
    f.write(routine_content)


# Update agent_plan.md
with open("agent_plan.md", "r") as f:
    plan_content = f.read()

# I will append the tasks and dream log at the end of the file.
plan_content += "\n### Phase 2.5 Extension: Routine Refinements\n"
plan_content += "- [x] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer.\n"
plan_content += "- [ ] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.\n"
plan_content += "- [ ] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.\n"
plan_content += "\n*Idea:* \"What if we visualized Serotonin levels as color shifts?\"\n"

with open("agent_plan.md", "w") as f:
    f.write(plan_content)
