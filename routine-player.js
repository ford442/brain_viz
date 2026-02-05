// routine-player.js
// orchestrates timed sequences of brain activity
export class RoutinePlayer {
    constructor(renderer, regionMap) {
        this.renderer = renderer;
        this.regions = regionMap; // Maps names like 'frontal' to [x,y,z]
        this.routine = [];
        this.isPlaying = false;
        this.startTime = 0;
        this.cursor = 0; // Index of the next event to fire
        this.loop = false;
        this.timerId = null;
        this.onEvent = null; // Callback for UI updates

        // [Phase 2] Easing Support
        this.activeLerps = []; // { key, startVal, endVal, startTime, duration }
    }

    loadRoutine(routineData, loop = false) {
        // Sort events by time to ensure correct playback order
        this.routine = routineData.sort((a, b) => a.time - b.time);
        this.loop = loop;
        this.stop();
        console.log(`[Routine] Loaded ${this.routine.length} events.`);
    }

    play() {
        if (this.routine.length === 0) return;
        this.isPlaying = true;
        this.startTime = performance.now();
        this.cursor = 0;
        this.activeLerps = [];
        this.tick();
        console.log("[Routine] Playback started");
    }

    stop() {
        this.isPlaying = false;
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
        this.cursor = 0;
        this.activeLerps = [];
    }

    tick() {
        if (!this.isPlaying) return;

        // Safety check: if renderer is lost or invalid
        if (!this.renderer) {
            console.error("[Routine] Renderer lost, stopping playback.");
            this.stop();
            return;
        }

        const now = performance.now();
        const currentTime = (now - this.startTime) / 1000.0; // Seconds

        // Execute all events that are due
        while (this.cursor < this.routine.length) {
            const event = this.routine[this.cursor];

            if (currentTime >= event.time) {
                this.executeEvent(event);
                this.cursor++;
            } else {
                // Next event is in the future
                break;
            }
        }

        // [Phase 2] Process Active Lerps
        this.processLerps(now);

        // Check for completion
        if (this.cursor >= this.routine.length && this.activeLerps.length === 0) {
            if (this.loop) {
                console.log("[Routine] Looping...");
                this.startTime = performance.now();
                this.cursor = 0;
            } else {
                console.log("[Routine] Finished");
                this.stop();
                return;
            }
        }

        this.timerId = requestAnimationFrame(() => this.tick());
    }

    processLerps(now) {
        if (this.activeLerps.length === 0) return;

        // Filter out completed lerps after processing
        this.activeLerps = this.activeLerps.filter(lerp => {
            const elapsed = (now - lerp.startTime) / 1000.0;
            const progress = Math.min(1.0, elapsed / lerp.duration);

            // Linear Interpolation
            const currentVal = lerp.startVal + (lerp.endVal - lerp.startVal) * progress;

            // Update Renderer
            this.renderer.setParams({ [lerp.key]: currentVal });

            // Notify UI
            if (this.onEvent) {
                this.onEvent({ type: 'param', key: lerp.key, value: currentVal });
            }

            return progress < 1.0;
        });
    }

    executeEvent(event) {
        // console.log(`[${event.time.toFixed(1)}s] Executing: ${event.type}`);

        switch (event.type) {
            case 'stimulus':
                this.handleStimulus(event);
                break;
            case 'style':
                this.renderer.setParams({ style: event.value });
                break;
            case 'param':
                this.renderer.setParams({ [event.key]: event.value });
                break;
            case 'lerp':
                this.startLerp(event);
                break;
            case 'calm':
                this.renderer.calmState();
                break;
            case 'reset':
                this.renderer.resetActivity();
                break;
        }

        // Notify listener (except for synthetic param updates handled in processLerps)
        if (this.onEvent) {
            this.onEvent(event);
        }
    }

    startLerp(event) {
        // Event: { type: 'lerp', key: 'flowSpeed', value: 8.0, duration: 2.0 }
        if (!this.renderer.params) return;

        const currentVal = this.renderer.params[event.key];
        if (currentVal === undefined) {
            console.warn(`[Routine] Cannot lerp unknown param: ${event.key}`);
            return;
        }

        // Remove any existing lerp for this key to avoid conflict
        this.activeLerps = this.activeLerps.filter(l => l.key !== event.key);

        this.activeLerps.push({
            key: event.key,
            startVal: currentVal,
            endVal: event.value,
            startTime: performance.now(),
            duration: event.duration || 1.0
        });
    }

    handleStimulus(evt) {
        let coords = [0,0,0];

        // Lookup region by name or use explicit coords
        if (typeof evt.target === 'string' && this.regions[evt.target]) {
            coords = this.regions[evt.target];
        } else if (Array.isArray(evt.target)) {
            coords = evt.target;
        }

        // Inject
        this.renderer.injectStimulus(coords[0], coords[1], coords[2], evt.intensity || 1.0);
    }
}
