import re

with open('src/routine-handlers.js', 'r') as f:
    content = f.read()

handler_code = """
    // [Phase 2] Respiration Simulation
    handlers.set('respiration', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 4.0; // Total duration of respiration cycle

        const inhaleDuration = duration * 0.4;
        const exhaleDuration = duration * 0.6;

        // Inhale phase
        player.startLerp({ key: 'flowSpeed', value: 6.0 * intensity, duration: inhaleDuration, ease: 'sineOut' });
        player.startLerp({ key: 'amplitude', value: 1.2 * intensity, duration: inhaleDuration, ease: 'sineOut' });
        // Enhance overall scene intensity via ambient light for inhale
        const currentAmbient = player.renderer.params.ambientLight || 0.2;
        player.startLerp({ key: 'ambientLight', value: currentAmbient + (0.3 * intensity), duration: inhaleDuration, ease: 'sineOut' });

        // Exhale phase
        setTimeout(() => {
            if (!player.isPlaying) return;
            player.startLerp({ key: 'flowSpeed', value: 2.0, duration: exhaleDuration, ease: 'sineInOut' });
            player.startLerp({ key: 'amplitude', value: 0.5, duration: exhaleDuration, ease: 'sineInOut' });
            player.startLerp({ key: 'ambientLight', value: currentAmbient, duration: exhaleDuration, ease: 'sineInOut' });
        }, inhaleDuration * 1000);

        // Schedule a heartbeat event at the peak of the inhale
        if (player.routine) {
            const peakTime = player.elapsedTime + inhaleDuration;
            const heartbeatEvent = {
                time: peakTime,
                type: 'heartbeat',
                intensity: intensity * 1.2,
                duration: 1.0
            };

            let insertIdx = player.currentEventIndex ?? player.cursor;
            while (insertIdx < player.routine.length && player.routine[insertIdx].time < peakTime) {
                insertIdx++;
            }
            player.routine.splice(insertIdx, 0, heartbeatEvent);
        }
    });
"""

# Insert before 'heartbeat' handler
content = re.sub(r"(\s*// \[Phase 2\] Heartbeat Simulation)", handler_code + r"\1", content)

with open('src/routine-handlers.js', 'w') as f:
    f.write(content)
