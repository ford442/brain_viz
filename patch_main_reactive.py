import re

with open('src/main.js', 'r') as f:
    content = f.read()

reactive_logic = """            // 1. Audio Reactivity
            if (audioReactor.isActive) {
                audioReactor.update(renderer, player); // Process audio and extract features

                // Phase 3 Step 3: Music-Reactive Visual Parameters
                const features = audioReactor.getFeatures();

                // Keep track of base values (if we haven't stored them yet, assume default 0)
                if (window.baseParams === undefined) {
                    window.baseParams = {
                        zoom: renderer.camera.zoom || 2.5,
                        colorShift: renderer.params.colorShift || 0.0,
                        sparkle: renderer.params.sparkle || 0.0
                    };
                }

                // Energy -> Camera Zoom (Slight breathing of the view)
                // Higher energy = zoom in slightly (smaller zoom value)
                const targetZoom = window.baseParams.zoom - (features.energy * 0.3);
                renderer.setCameraParams({ zoom: targetZoom });

                // Bass -> Color Shift (Warmer colors)
                const targetColorShift = window.baseParams.colorShift + (features.bass * 2.5);
                renderer.setParams({ colorShift: targetColorShift });

                // Brightness -> Sparkle / Glow
                const targetSparkle = window.baseParams.sparkle + (features.brightness * 1.5);
                renderer.setParams({ sparkle: targetSparkle });

                // Onset -> Particle burst / flash
                if (features.onset > 0.5 && Math.random() > 0.5) {
                     // Inject stimulus at random coordinates
                     const r = 1.0 + Math.random() * 0.2;
                     const theta = Math.random() * Math.PI * 2;
                     const phi = Math.random() * Math.PI;

                     const x = r * Math.sin(phi) * Math.cos(theta);
                     const y = r * Math.sin(phi) * Math.sin(theta);
                     const z = r * Math.cos(phi);

                     renderer.injectStimulus(x, y, z, features.onset * 2.0);
                }

                // Sync UI sliders
"""

content = content.replace("            // 1. Audio Reactivity\n            if (audioReactor.isActive) {\n                audioReactor.update(renderer, player); // Pass player for Phase 3 Audio Reactivity\n                // Sync UI sliders\n", reactive_logic)

with open('src/main.js', 'w') as f:
    f.write(content)
