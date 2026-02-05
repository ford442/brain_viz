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
        this.tick();
        console.log("[Routine] Playback started");
    }

    stop() {
        this.isPlaying = false;
        cancelAnimationFrame(this.timerId);
        this.cursor = 0;
    }

    tick() {
        if (!this.isPlaying) return;

        const currentTime = (performance.now() - this.startTime) / 1000.0; // Seconds

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

        // Check for completion
        if (this.cursor >= this.routine.length) {
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
            case 'calm':
                this.renderer.calmState();
                break;
            case 'reset':
                this.renderer.resetActivity();
                break;
        }

        // Notify listener
        if (this.onEvent) {
            this.onEvent(event);
        }
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
