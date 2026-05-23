import re

with open('src/routine-player.js', 'r') as f:
    content = f.read()

# Modify constructor to add respiration states
constructor_mod = """        this.customPresets = {}; // [Phase 2] Custom Camera Presets
        this.state = {
            respirationRate: 1.0 // [Phase 3] Dynamic Environment Reactions
        }; // [Phase 2] Internal State for Branching

        // [Phase 3] Continuous Respiration System
        this.respirationActive = true; // Always on by default, or we can toggle it
        this.respirationPhaseTime = 0.0;
        this.currentRespirationRate = 1.0;

        // [Phase 2] Event Synchronization"""
content = content.replace("        this.customPresets = {}; // [Phase 2] Custom Camera Presets\n        this.state = {\n            respirationRate: 1.0 // [Phase 3] Dynamic Environment Reactions\n        }; // [Phase 2] Internal State for Branching\n\n        // [Phase 2] Event Synchronization", constructor_mod)

tick_mod = """        const deltaTime = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;

        // [Phase 3] Continuous Audio-Driven Respiration
        if (this.respirationActive) {
            // Read target energy directly from AudioReactor if available, otherwise fallback to base logic
            let targetRate = 1.0;
            if (window.audioReactor && window.audioReactor.isActive) {
                const features = window.audioReactor.getFeatures();
                targetRate = 1.0 + (features.energy * 2.5); // Higher energy -> faster breathing
            }

            // Add stimulus-driven boost from state (temporary bursts)
            if (this.state.respirationRate > 1.0) {
                targetRate = Math.max(targetRate, this.state.respirationRate);
            }

            // Smooth the transition of the respiration rate so breathing doesn't change too abruptly
            this.currentRespirationRate += (targetRate - this.currentRespirationRate) * 0.05;

            const baseCycleDuration = 4.0;
            const cycleDuration = baseCycleDuration / this.currentRespirationRate;

            this.respirationPhaseTime += deltaTime;
            if (this.respirationPhaseTime >= cycleDuration) {
                this.respirationPhaseTime = this.respirationPhaseTime % cycleDuration;
                // Optional: Inject heartbeat at peak of inhale
                // this.executeEvent({ type: 'heartbeat', intensity: 0.8, duration: 0.5 });
            }

            const phase = this.respirationPhaseTime / cycleDuration; // 0 to 1
            // Inhale (0-0.4), Exhale (0.4-1.0)
            let breathPulse = 0;
            if (phase < 0.4) {
                // Sine Out for inhale
                const t = phase / 0.4;
                breathPulse = Math.sin(t * Math.PI / 2);
            } else {
                // Sine InOut for exhale
                const t = (phase - 0.4) / 0.6;
                breathPulse = 1.0 - (0.5 * (1 - Math.cos(Math.PI * t))); // Easing out smoothly
            }

            // We apply it dynamically but without polluting activeLerps
            if (this.renderer && this.renderer.params) {
                // Base values + breath modulation
                this.renderer.params.flowSpeed = 2.0 + (breathPulse * 4.0);
                this.renderer.params.amplitude = 0.2 + (breathPulse * 1.0);

                // Keep ambient base light around 0.2
                this.renderer.params.ambientLight = 0.2 + (breathPulse * 0.3);
            }
        }

        // [Phase 3] Gentle decay for state respirationRate (stimulus boost) back to baseline
        if (this.state.respirationRate > 1.0) {
            this.state.respirationRate -= deltaTime * 0.5;
            if (this.state.respirationRate < 1.0) {
                this.state.respirationRate = 1.0;
            }
        }"""
content = re.sub(r'        const deltaTime = \(now - this\.lastFrameTime\) \/ 1000\.0;\n        this\.lastFrameTime = now;\n\n        \/\/ \[Phase 3\] Gentle decay for respirationRate back to baseline.*?        \}', tick_mod, content, flags=re.DOTALL)

with open('src/routine-player.js', 'w') as f:
    f.write(content)
