// src/training-engine.js
// [Neuro-Weaver] Neurofeedback Training Mode — gamified objectives that ask the
// player to hold a simulated brain-state metric inside a target band for a
// sustained duration. Playable with nothing but the existing sliders/keyboard;
// AudioReactor and SynaptiX resonance stats are used opportunistically when active.
//
// Course JSON schema (see docs/training-mode.md for the full write-up):
//   {
//     id, name, description,
//     objectives: [ { metric, target, tolerance, duration, label } ],
//     demoKey, demoParams: { [rendererParamKey]: value }
//   }

const HISTORY_KEY = 'neuro_weaver_training_history';
const HISTORY_LIMIT = 20;

/**
 * Metric samplers. Each returns a 0..1 value from live renderer/audio/SynaptiX
 * state. Metrics are intentionally simulated (no real EEG hardware required)
 * but are driven by real, user-controllable renderer parameters so a course
 * is genuinely playable via the existing sliders.
 */
export const METRICS = {
    calm: {
        label: 'Calm (inverse cognitive stress)',
        sample: (ctx) => {
            const stress = ctx.renderer?.params?.stress ?? 0;
            return clamp01(1.0 - stress / 2.0);
        }
    },
    occipitalAlpha: {
        label: 'Occipital Alpha Power',
        sample: (ctx) => {
            const p = ctx.renderer?.params || {};
            // Relaxed, eyes-closed-like states (low amplitude, high smoothing)
            // produce a stronger simulated posterior alpha rhythm.
            const relaxation = clamp01(1.0 - (p.amplitude ?? 0.5) / 1.2) * (p.smoothing ?? 0.9);
            const t = performance.now() / 1000;
            const envelope = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 0.12); // slow ~0.12Hz envelope wobble
            // Narrow wobble band (0.8-0.9x) so a fully relaxed state (relaxation ~= 0.98)
            // stays inside a target/tolerance band of 0.75+/-0.15 the whole cycle, while an
            // unrelaxed default state (relaxation ~= 0.5) stays clearly outside it.
            return clamp01(relaxation * (0.8 + 0.1 * envelope));
        }
    },
    flowResonance: {
        label: 'Flow / Resonance',
        sample: (ctx) => {
            const stats = ctx.synaptixEngine?.computeResonanceStats?.(ctx.renderer?._lastHumanTensor);
            if (stats && (stats.resonance || stats.humanEnergy || stats.aiEnergy)) {
                return clamp01(stats.resonance / 100);
            }
            if (ctx.audioReactor?.isActive) {
                return clamp01(ctx.audioReactor.getFeatures().energy);
            }
            const flowSpeed = ctx.renderer?.params?.flowSpeed ?? 4.0;
            return clamp01(flowSpeed / 10.0);
        }
    }
};

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

/** Built-in preset courses. Extend by pushing additional course objects here
 * or by loading external JSON matching the same shape via loadCourse(). */
export const BUILTIN_COURSES = [
    {
        id: 'calm-focus',
        name: 'Calm Focus',
        description: 'Relax into a steady, alert state — hold occipital alpha power in the target band for 20s.',
        objectives: [
            { metric: 'occipitalAlpha', target: 0.75, tolerance: 0.15, duration: 20, label: 'Hold Alpha' }
        ],
        demoKey: '6',
        demoParams: { amplitude: 0.0, smoothing: 0.98 }
    },
    {
        id: 'panic-recovery',
        name: 'Panic Recovery',
        description: 'Bring a cognitive-stress spike back down and hold calm for 15s.',
        objectives: [
            { metric: 'calm', target: 0.85, tolerance: 0.15, duration: 15, label: 'Recover Calm' }
        ],
        demoKey: '7',
        demoParams: { stress: 0.0 }
    },
    {
        id: 'flow-sustain',
        name: 'Flow Sustain',
        description: 'Sustain rising resonance across three checkpoints without dropping out of the zone.',
        objectives: [
            { metric: 'flowResonance', target: 0.6, tolerance: 0.2, duration: 10, label: 'Checkpoint 1' },
            { metric: 'flowResonance', target: 0.7, tolerance: 0.15, duration: 10, label: 'Checkpoint 2' },
            { metric: 'flowResonance', target: 0.8, tolerance: 0.15, duration: 10, label: 'Checkpoint 3' }
        ],
        demoKey: '8',
        demoParams: { flowSpeed: 7.5 }
    }
];

function readHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('[Training] Could not read session history from localStorage', e);
        return [];
    }
}

function writeHistory(entries) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
    } catch (e) {
        console.warn('[Training] Could not save session history to localStorage', e);
    }
}

export class TrainingEngine {
    constructor(renderer, audioReactor, synaptixEngine, player) {
        this.renderer = renderer;
        this.audioReactor = audioReactor;
        this.synaptixEngine = synaptixEngine;
        this.player = player;

        this.courses = [...BUILTIN_COURSES];
        this.activeCourse = null;
        this.objectiveIndex = 0;
        this.holdTime = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.driftPenalty = 0;
        this.elapsed = 0;
        this.isRunning = false;
        this.onEvent = null; // callback(evt) for UI wiring
    }

    getCourse(id) {
        return this.courses.find((c) => c.id === id) || null;
    }

    /** Register an externally-loaded course (must match the BUILTIN_COURSES shape). */
    loadCourse(course) {
        if (!course || !course.id || !Array.isArray(course.objectives) || course.objectives.length === 0) {
            console.warn('[Training] Rejected invalid course definition', course);
            return false;
        }
        this.courses = this.courses.filter((c) => c.id !== course.id);
        this.courses.push(course);
        return true;
    }

    startCourse(courseId) {
        const course = this.getCourse(courseId);
        if (!course) {
            console.warn(`[Training] Unknown course: ${courseId}`);
            return false;
        }
        this.activeCourse = course;
        this.objectiveIndex = 0;
        this.holdTime = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.driftPenalty = 0;
        this.elapsed = 0;
        this.isRunning = true;

        console.log(`[Training] Course started: ${course.name}`);
        this._emit({ type: 'start', course });
        return true;
    }

    stopCourse(reason = 'aborted') {
        if (!this.isRunning) return;
        this.isRunning = false;
        this._emit({ type: 'end', course: this.activeCourse, success: false, reason, stars: 0 });
        this.activeCourse = null;
    }

    get currentObjective() {
        return this.activeCourse ? this.activeCourse.objectives[this.objectiveIndex] : null;
    }

    /** Called once per animation frame from the main update loop. */
    update(dt) {
        if (!this.isRunning || !this.activeCourse) return;
        const objective = this.currentObjective;
        if (!objective) return;

        const metric = METRICS[objective.metric];
        if (!metric) {
            console.warn(`[Training] Unknown metric: ${objective.metric}`);
            this.stopCourse('bad_metric');
            return;
        }

        const ctx = { renderer: this.renderer, audioReactor: this.audioReactor, synaptixEngine: this.synaptixEngine };
        const value = metric.sample(ctx);
        const low = objective.target - objective.tolerance;
        const high = objective.target + objective.tolerance;
        const inZone = value >= low && value <= high;

        this.elapsed += dt;

        if (inZone) {
            this.holdTime += dt;
            this.streak += dt;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
        } else {
            this.holdTime = Math.max(0, this.holdTime - dt * 1.5);
            this.driftPenalty += dt;
            this.streak = 0;
        }

        this._emit({
            type: 'progress',
            course: this.activeCourse,
            objectiveIndex: this.objectiveIndex,
            objective,
            value,
            band: [low, high],
            inZone,
            holdTime: this.holdTime,
            streak: this.streak,
            bestStreak: this.bestStreak
        });

        if (this.holdTime >= objective.duration) {
            this._advanceObjective();
            return;
        }

        // Generous overall time budget: 4x the total objective duration across the course.
        const totalDuration = this.activeCourse.objectives.reduce((sum, o) => sum + o.duration, 0);
        if (this.elapsed > totalDuration * 4) {
            this._completeCourse(false);
        }
    }

    _advanceObjective() {
        const course = this.activeCourse;
        const passedIndex = this.objectiveIndex;
        this._emit({ type: 'checkpoint', course, objectiveIndex: passedIndex, passed: true });
        if (this.player) {
            this.player.executeEvent({
                type: 'training_checkpoint',
                course: course.id,
                index: passedIndex,
                label: course.objectives[passedIndex].label
            });
        }

        if (this.objectiveIndex + 1 >= course.objectives.length) {
            this._completeCourse(true);
        } else {
            this.objectiveIndex += 1;
            this.holdTime = 0;
            this.streak = 0;
        }
    }

    _completeCourse(success) {
        const course = this.activeCourse;
        const stars = success ? this._computeStars() : 0;

        this.isRunning = false;
        addHistoryEntry({
            courseId: course.id,
            name: course.name,
            date: new Date().toISOString(),
            success,
            stars,
            driftPenalty: Math.round(this.driftPenalty * 10) / 10,
            elapsed: Math.round(this.elapsed * 10) / 10
        });

        this._emit({ type: 'end', course, success, stars, driftPenalty: this.driftPenalty });
        if (this.player) {
            this.player.executeEvent({
                type: 'training_end',
                course: course.id,
                success,
                stars,
                autoBranchSuccess: course.onSuccessRoutine,
                autoBranchFail: course.onFailRoutine
            });
        }
        this.activeCourse = null;
    }

    _computeStars() {
        const totalDuration = this.activeCourse.objectives.reduce((sum, o) => sum + o.duration, 0);
        const driftRatio = this.driftPenalty / Math.max(1, totalDuration);
        if (driftRatio <= 0.05) return 3;
        if (driftRatio <= 0.3) return 2;
        return 1;
    }

    _emit(evt) {
        if (typeof this.onEvent === 'function') {
            this.onEvent(evt);
        }
    }
}

export function addHistoryEntry(entry) {
    const history = readHistory();
    history.unshift(entry);
    writeHistory(history);
    return history;
}

export function getHistory() {
    return readHistory();
}

export function clearHistory() {
    writeHistory([]);
}
