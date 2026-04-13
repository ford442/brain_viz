import re

with open('routine-player.js', 'r') as f:
    content = f.read()

# 1. Update tick() loop to check a flag rather than device.lost truthiness directly
# In constructor we have:
#         if (this.renderer && this.renderer.device && this.renderer.device.lost) {
#              this.renderer.device.lost.then((lostInfo) => {
#                  console.error("[Routine Player] WebGPU Context is Lost. Halting routine playback safely.", lostInfo);
#                  this.stop();
#              });
#         }
# We should also add `this._deviceLost = false;` to constructor and set it to true in the promise.
constructor_patch = """        this.handlers = new Map();
        this.setupDefaultHandlers();

        this._deviceLost = false;

        // [Safety Requirement] Graceful degradation if WebGPU context is lost or invalid
        if (this.renderer && this.renderer.device && this.renderer.device.lost) {
             this.renderer.device.lost.then((lostInfo) => {
                 console.error("[Routine Player] WebGPU Context is Lost. Halting routine playback safely.", lostInfo);
                 this._deviceLost = true;
                 this.stop();
             });
        }"""
content = content.replace("        this.handlers = new Map();\n        this.setupDefaultHandlers();\n\n        // [Safety Requirement] Graceful degradation if WebGPU context is lost or invalid\n        if (this.renderer && this.renderer.device && this.renderer.device.lost) {\n             this.renderer.device.lost.then((lostInfo) => {\n                 console.error(\"[Routine Player] WebGPU Context is Lost. Halting routine playback safely.\", lostInfo);\n                 this.stop();\n             });\n        }", constructor_patch)

tick_patch = """        // Ensure WebGPU context gracefully degrades
        const isDeviceLost = this._deviceLost;
        const rendererMissing = !this.renderer || !this.renderer.device;

        if (rendererMissing || isDeviceLost) {"""
content = content.replace("        // Ensure WebGPU context gracefully degrades\n        const isDeviceLost = this.renderer && this.renderer.device && this.renderer.device.lost;\n        const rendererMissing = !this.renderer || !this.renderer.device;\n\n        if (rendererMissing || isDeviceLost) {", tick_patch)

# 2. Add noradrenaline handler
noradrenaline_handler = """        // [Phase 5] Noradrenaline Spike
        this.registerHandler('noradrenaline', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 2.0;

            // Instantly boost flowSpeed, amplitude, and frequency for global alertness
            this.renderer.setParams({
                flowSpeed: 25.0 * intensity,
                amplitude: 1.5 * intensity,
                frequency: 15.0 * intensity
            });

            // Fade back
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
                this.startLerp({ key: 'frequency', value: 2.0, duration: duration, ease: ease });
            }
        });

        // [Phase 2] Adrenaline Surge"""

content = content.replace("        // [Phase 2] Adrenaline Surge", noradrenaline_handler)

with open('routine-player.js', 'w') as f:
    f.write(content)
