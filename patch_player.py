import re

with open('routine-player.js', 'r') as f:
    content = f.read()

stress_handler = r'''        // [Phase 2] Cognitive Stress Distortion
        this.registerHandler('stress', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            if (evt.duration) {
                this.startLerp({
                    key: 'stress',
                    value: intensity,
                    duration: evt.duration,
                    ease: evt.ease || 'linear'
                });
            } else {
                this.renderer.setParams({ stress: intensity });
            }
        });

        // [Phase 2] Camera Shake'''

content = re.sub(r'(        // \[Phase 2\] Camera Shake)', stress_handler, content)

with open('routine-player.js', 'w') as f:
    f.write(content)
