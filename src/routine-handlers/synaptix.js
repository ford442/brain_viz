import { handleCamera } from '../routine-camera.js';

export function registerSynaptixHandlers(handlers, player) {
    handlers.set('synaptiXLoad', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        if (evt.pattern && typeof evt.pattern === 'string') {
            // Delegate to engine if available on renderer
            if (renderer.synaptixEngine) {
                renderer.synaptixEngine.generatePattern(evt.pattern);
            }
        } else if (evt.data && evt.data instanceof Float32Array) {
            renderer.setAITensorData(evt.data);
        }
        // Auto-enable SynaptiX style if not active
        if (renderer.params && renderer.params.style < 4.0) {
            renderer.setParams({ style: 4.0 });
        }
    });

    // Blend AI influence (0–1)
    handlers.set('synaptiXBlend', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        const value = evt.value !== undefined ? evt.value : 0.5;
        if (evt.duration) {
            player.startLerp({ key: 'aiInfluence', value: value, duration: evt.duration, ease: evt.ease || 'sineInOut' });
        } else {
            renderer.setParams({ aiInfluence: value });
        }
    });

    // Inject a stimulus into the AI tensor field
    handlers.set('injectAIStimulus', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        let coords = [0, 0, 0];
        if (typeof evt.target === 'string' && player.regions[evt.target]) {
            coords = player.regions[evt.target];
        } else if (Array.isArray(evt.target)) {
            coords = evt.target;
        }
        const intensity = evt.intensity || 1.0;
        // Write directly to AI tensor via a temporary Gaussian blob
        if (renderer.synaptixEngine) {
            const blob = new Float32Array(32 * 32 * 32);
            const dim = 32;
            const cx = Math.floor((coords[0] / 1.6 + 0.5) * dim);
            const cy = Math.floor((coords[1] / 1.6 + 0.5) * dim);
            const cz = Math.floor((coords[2] / 1.6 + 0.5) * dim);
            const radius = evt.radius || 4;
            for (let z = 0; z < dim; z++) {
                for (let y = 0; y < dim; y++) {
                    for (let x = 0; x < dim; x++) {
                        const d2 = (x-cx)*(x-cx) + (y-cy)*(y-cy) + (z-cz)*(z-cz);
                        if (d2 < radius*radius) {
                            blob[z*dim*dim + y*dim + x] = intensity * Math.exp(-d2 / (radius*0.5));
                        }
                    }
                }
            }
            renderer.synaptixEngine.setTensorData(blob);
        }
    });

    // Temporary resonance boost effect
    handlers.set('resonanceBurst', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 2.0;
        const baseThreshold = renderer.params.resonanceThreshold || 0.2;

        // Drop threshold → more resonance
        renderer.setParams({ resonanceThreshold: baseThreshold * (1.0 - intensity * 0.8) });

        // Flash AI influence up briefly
        const baseInfluence = renderer.params.aiInfluence || 0.5;
        renderer.setParams({ aiInfluence: Math.min(1.0, baseInfluence + intensity * 0.3) });

        // Revert after duration
        if (duration > 0 && player.routine) {
            const revertTime = player.elapsedTime + duration;
            const revertEvents = [
                { time: revertTime, type: 'param', key: 'resonanceThreshold', value: baseThreshold },
                { time: revertTime, type: 'param', key: 'aiInfluence', value: baseInfluence }
            ];
            let insertIdx = player.cursor;
            while (insertIdx < player.routine.length && player.routine[insertIdx].time < revertTime) {
                insertIdx++;
            }
            player.routine.splice(insertIdx, 0, ...revertEvents);
        }
    });

}
