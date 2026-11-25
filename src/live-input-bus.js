// live-input-bus.js — [Neuro-Weaver] Live Input Bus. One mapping table that
// routes named features from any registered live source (mic, BCI, training
// metrics, and future MIDI/HR/OSC sources) to renderer param sinks, instead
// of each live-data panel growing its own audio-reactor-shaped mapping table.
// See docs/live-input-bus.md.
//
// This module does not read hardware or the DOM itself. A source is
// registered with a `sample()` closure supplied by the integration code in
// src/main-live-input-integration.js, which already has audioReactor/
// bciSession/trainingEngine in scope; the bus only throttles, smooths, and
// applies. This keeps AudioReactor, BCISession, and TrainingEngine exactly as
// they are (see CLAUDE.md "route through one bus", not rewrite).

// Curated allowlist of renderer.params keys (plus the special 'zoom' camera
// target) safe to drive continuously from a live feature. Bounds follow the
// corresponding UI controls, or the renderer's camera limits for zoom.
const SINK_BOUNDS = Object.freeze({
    zoom: [2, 10], colorShift: [0, 1], sparkle: [0, 1], amplitude: [0, 2],
    flowSpeed: [0, 10], decayRate: [0.8, 1], diffusionRate: [0, 0.5],
    pulseSaturation: [0, 3], trailLength: [0, 5], pointCloudDensity: [0, 2],
    fiberCoupling: [0, 1], resonanceThreshold: [0.05, 0.5], aiLayer: [0, 63],
    shake: [0, 0.5], aberration: [0, 2], grain: [0, 1], fogDensity: [0, 0.5],
    stress: [0, 2], cortisol: [0, 1],
});
export const LIVE_INPUT_SINKS = Object.freeze(Object.keys(SINK_BOUNDS));

function isValidSink(sink) {
    return typeof sink === 'string' && Object.hasOwn(SINK_BOUNDS, sink);
}

const STORAGE_KEY = 'neuroWeaver.liveInputBus.mappings';

let mappingIdCounter = 0;
function nextMappingId() {
    return `live_${Date.now().toString(36)}_${(mappingIdCounter++).toString(36)}`;
}

/** @param {Partial<{id:string,source:string,feature:string,sink:string,scale:number,attack:number,release:number,enabled:boolean}>} overrides */
export function createMapping(overrides = {}) {
    return {
        id: overrides.id || nextMappingId(),
        source: overrides.source || '',
        feature: overrides.feature || '',
        sink: isValidSink(overrides.sink) ? overrides.sink : LIVE_INPUT_SINKS[0],
        // scale: raw [0,1] feature value * scale is the sink's offset from its baseline.
        scale: overrides.scale !== undefined ? overrides.scale : 1,
        // attack/release: one-pole smoothing time constants in seconds, applied
        // separately depending on whether the raw value is rising or falling —
        // e.g. a fast attack + slow release makes an onset punch in and decay out.
        attack: overrides.attack !== undefined ? overrides.attack : 0.05,
        release: overrides.release !== undefined ? overrides.release : 0.4,
        enabled: overrides.enabled !== undefined ? overrides.enabled : true,
    };
}

export class LiveInputBus {
    constructor(renderer) {
        this.renderer = renderer;
        this.enabled = true;
        /** @type {Map<string, {hz:number, features:string[], sample:Function}>} */
        this.sources = new Map();
        this.mappings = [];
        this._latestRaw = new Map();   // sourceId -> { feature: value }
        this._smoothed = new Map();    // mappingId -> smoothed value
        this._baselines = new Map();   // sink -> renderer value captured before routing started
        this._lastSampleAt = new Map(); // sourceId -> ms timestamp, for hz throttling
    }

    /**
     * Registers a live source. `sample()` is called at most every `1000/hz`ms
     * and must return a plain `{ featureName: number, ... }` object (values
     * are expected in roughly [0,1] but are not clamped here).
     * @param {string} id
     * @param {{hz?: number, features: string[], sample: () => Object}} def
     */
    registerSource(id, { hz = 60, features = [], sample }) {
        if (typeof sample !== 'function') {
            throw new Error(`[LiveInputBus] source '${id}' needs a sample() function`);
        }
        this.sources.set(id, { hz, features: [...features], sample });
    }

    unregisterSource(id) {
        this.sources.delete(id);
        this._latestRaw.delete(id);
        this._lastSampleAt.delete(id);
    }

    /** All {source, feature} pairs any registered source currently exposes, for UI dropdowns. */
    listFeatures() {
        const out = [];
        for (const [sourceId, source] of this.sources) {
            for (const feature of source.features) out.push({ source: sourceId, feature });
        }
        return out;
    }

    addMapping(overrides = {}) {
        const mapping = createMapping(overrides);
        if (overrides.sink !== undefined && !isValidSink(overrides.sink)) mapping.sink = overrides.sink;
        this.mappings.push(mapping);
        return mapping;
    }

    removeMapping(id) {
        this.mappings = this.mappings.filter((m) => m.id !== id);
        this._smoothed.delete(id);
    }

    updateMapping(id, patch) {
        const mapping = this.mappings.find((m) => m.id === id);
        if (!mapping) return;
        Object.assign(mapping, patch);
        this._smoothed.delete(id);
    }

    clear() {
        this.mappings = [];
        this._smoothed.clear();
        this._baselines.clear();
    }

    /** Last sampled value for a source's feature (0 if never sampled). Used by
     * both the mapping matrix UI and RoutinePlayer's `if: "live.…"` sugar. */
    getFeatureValue(sourceId, feature) {
        return this._latestRaw.get(sourceId)?.[feature] ?? 0;
    }

    /**
     * Evaluates a routine condition of the form `"live.<feature> OP number"`
     * or `"live.<source>.<feature> OP number"` (OP is one of > >= < <= ==).
     * Returns true (fail-open) for anything it can't parse or for a bare
     * feature name with no matching source, so a malformed `if:` never
     * silently blocks a routine event.
     */
    evaluateCondition(expr) {
        if (typeof expr !== 'string') return true;
        const match = expr.trim().match(/^live\.([a-zA-Z0-9_.]+)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/);
        if (!match) {
            console.warn(`[LiveInputBus] Unrecognized condition expression: '${expr}'`);
            return true;
        }
        const [, path, op, numStr] = match;
        const threshold = parseFloat(numStr);
        const parts = path.split('.');
        let value;
        if (parts.length >= 2) {
            const feature = parts.pop();
            const source = parts.join('.');
            value = this.getFeatureValue(source, feature);
        } else {
            const [feature] = parts;
            let found = false;
            for (const [sourceId] of this.sources) {
                if (this._latestRaw.get(sourceId) && feature in this._latestRaw.get(sourceId)) {
                    value = this.getFeatureValue(sourceId, feature);
                    found = true;
                    break;
                }
            }
            if (!found) return true;
        }
        switch (op) {
            case '>': return value > threshold;
            case '>=': return value >= threshold;
            case '<': return value < threshold;
            case '<=': return value <= threshold;
            case '==': return value === threshold;
            default: return true;
        }
    }

    _baseline(sink) {
        if (this._baselines.has(sink)) return this._baselines.get(sink);
        const value = sink === 'zoom' ? this.renderer.zoom : (this.renderer.params?.[sink] ?? 0);
        if (Number.isFinite(value)) this._baselines.set(sink, value);
        return value;
    }

    /** Drop captured baselines so the next tick re-captures the renderer's
     * current resting state instead of offsetting from a stale one. */
    resetBaselines() {
        this._baselines.clear();
    }

    /**
     * Call once per frame. Samples every due source, smooths each enabled
     * mapping's raw feature value with its attack/release time constants, and
     * additively offsets each sink from a baseline captured on first use —
     * multiple mappings can safely share a sink.
     * @param {number} dt - seconds since the last tick
     * @param {number} [timestampMs]
     */
    tick(dt, timestampMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
        if (!this.enabled || !this.renderer) return;

        for (const [id, source] of this.sources) {
            const period = 1000 / Math.max(1, source.hz);
            const last = this._lastSampleAt.has(id) ? this._lastSampleAt.get(id) : -Infinity;
            if (timestampMs - last < period) continue;
            this._lastSampleAt.set(id, timestampMs);
            try {
                this._latestRaw.set(id, source.sample() || {});
            } catch (err) {
                console.warn(`[LiveInputBus] source '${id}' sample() failed:`, err);
            }
        }

        const deltas = new Map(); // sink -> accumulated delta this frame
        for (const mapping of this.mappings) {
            if (!mapping.enabled || !isValidSink(mapping.sink) ||
                !Number.isFinite(mapping.scale) || !Number.isFinite(mapping.attack) ||
                !Number.isFinite(mapping.release)) continue;
            const raw = this.getFeatureValue(mapping.source, mapping.feature);
            if (!Number.isFinite(raw)) continue;
            const prev = this._smoothed.has(mapping.id) ? this._smoothed.get(mapping.id) : raw;
            const rising = raw >= prev;
            const timeConstant = Math.max(0.001, rising ? mapping.attack : mapping.release);
            const alpha = Number.isFinite(dt) && dt > 0 ? 1 - Math.exp(-dt / timeConstant) : 0;
            const smoothed = prev + (raw - prev) * alpha;
            if (!Number.isFinite(smoothed)) continue;
            this._smoothed.set(mapping.id, smoothed);
            const delta = smoothed * mapping.scale;
            const sum = (deltas.get(mapping.sink) ?? 0) + delta;
            if (Number.isFinite(delta) && Number.isFinite(sum)) deltas.set(mapping.sink, sum);
        }

        for (const [sink, delta] of deltas) {
            const baseline = this._baseline(sink);
            if (!Number.isFinite(baseline)) continue;
            const [min, max] = SINK_BOUNDS[sink];
            const value = Math.max(min, Math.min(max, baseline + delta));
            if (sink === 'zoom') {
                this.renderer.setCameraParams({ zoom: value });
            } else {
                this.renderer.setParams({ [sink]: value });
            }
        }
    }

    toJSON() {
        return {
            enabled: this.enabled,
            mappings: this.mappings.map((m) => ({ ...m })),
        };
    }

    loadFromMappings(mappings) {
        this.mappings = Array.isArray(mappings)
            ? mappings.filter((m) => m && typeof m === 'object' && isValidSink(m.sink)).map((m) => createMapping(m))
            : [];
        this._smoothed.clear();
        this._baselines.clear();
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
        } catch (err) {
            console.warn('[LiveInputBus] Failed to persist mappings:', err);
        }
    }

    /** @returns {boolean} true if persisted mappings were found and loaded */
    loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            this.enabled = parsed.enabled !== undefined ? !!parsed.enabled : true;
            this.loadFromMappings(parsed.mappings);
            return true;
        } catch (err) {
            console.warn('[LiveInputBus] Failed to load persisted mappings:', err);
            return false;
        }
    }
}
