// reactivity-router.js — [Neuro-Weaver] Brain DJ mapping matrix. Lets users
// route any AudioReactor feature (bass, energy, brightness, onset, or a
// custom band) to any renderer.params key (or camera zoom) via a data-driven
// routing table, instead of the fixed bass->colorShift/energy->zoom/
// brightness->sparkle mapping that used to be hardcoded in
// main-update-loop.js. That fixed mapping is preserved as the 'classic'
// preset so default behavior is unchanged until a user edits the matrix.
export const REACTIVITY_SOURCES = ['bass', 'energy', 'brightness', 'onset'];

// Curated allowlist of renderer.params keys (plus the special 'zoom' camera
// target) safe to drive continuously from an audio feature. 'zoom' is
// special-cased in apply() to go through renderer.setCameraParams instead of
// renderer.setParams.
export const REACTIVITY_TARGETS = [
    'zoom', 'colorShift', 'sparkle', 'amplitude', 'flowSpeed',
    'pointCloudDensity', 'fiberCoupling', 'resonanceThreshold', 'aiLayer',
    'shake', 'growth', 'foldStrength', 'aberration', 'grain', 'dopamineTrails'
];

export const REACTIVITY_CURVES = ['linear', 'exp', 'log', 'gate'];

function applyCurve(value, curve) {
    const v = Math.max(0, Math.min(1, value));
    switch (curve) {
        case 'exp': return v * v;
        case 'log': return Math.sqrt(v);
        case 'gate': return v > 0.5 ? 1 : 0;
        case 'linear':
        default: return v;
    }
}

let routeIdCounter = 0;
function nextRouteId() {
    return `route_${Date.now().toString(36)}_${(routeIdCounter++).toString(36)}`;
}

export function createRoute(overrides = {}) {
    return {
        id: overrides.id || nextRouteId(),
        source: REACTIVITY_SOURCES.includes(overrides.source) ? overrides.source : 'bass',
        target: overrides.target || 'colorShift',
        gain: overrides.gain !== undefined ? overrides.gain : 0.5,
        smoothing: overrides.smoothing !== undefined ? overrides.smoothing : 0.8,
        curve: REACTIVITY_CURVES.includes(overrides.curve) ? overrides.curve : 'linear',
        enabled: overrides.enabled !== undefined ? overrides.enabled : true,
    };
}

// Preset routing tables, selectable from the Brain DJ panel or loadable via
// the `reactivity_map` routine event's `preset` field.
export const REACTIVITY_PRESETS = {
    classic: {
        name: 'Classic (default)',
        routes: [
            createRoute({ source: 'energy', target: 'zoom', gain: -0.4, smoothing: 0.8, curve: 'linear' }),
            createRoute({ source: 'bass', target: 'colorShift', gain: 2.8, smoothing: 0.8, curve: 'linear' }),
            createRoute({ source: 'brightness', target: 'sparkle', gain: 1.8, smoothing: 0.8, curve: 'linear' }),
        ],
    },
    club: {
        name: 'Club Mode',
        routes: [
            createRoute({ source: 'bass', target: 'amplitude', gain: 0.9, smoothing: 0.5, curve: 'exp' }),
            createRoute({ source: 'onset', target: 'sparkle', gain: 2.5, smoothing: 0.3, curve: 'gate' }),
            createRoute({ source: 'energy', target: 'flowSpeed', gain: 1.5, smoothing: 0.6, curve: 'linear' }),
            createRoute({ source: 'brightness', target: 'colorShift', gain: 3.0, smoothing: 0.5, curve: 'linear' }),
        ],
    },
    meditation: {
        name: 'Meditation',
        routes: [
            createRoute({ source: 'energy', target: 'flowSpeed', gain: 0.3, smoothing: 0.95, curve: 'log' }),
            createRoute({ source: 'brightness', target: 'sparkle', gain: 0.5, smoothing: 0.9, curve: 'log' }),
        ],
    },
    panic_detector: {
        name: 'Panic Detector',
        routes: [
            createRoute({ source: 'onset', target: 'shake', gain: 1.0, smoothing: 0.1, curve: 'gate' }),
            createRoute({ source: 'energy', target: 'aiLayer', gain: 1.0, smoothing: 0.4, curve: 'exp' }),
        ],
    },
};

const STORAGE_KEY = 'neuroWeaver.reactivityRoutes';

export class ReactivityRouter {
    constructor(audioReactor = null) {
        this.audioReactor = audioReactor;
        this.enabled = true;
        this.routes = [];
        this.presetKey = null; // null once user edits routes away from a preset
        this._smoothed = new Map();  // routeId -> smoothed [0,1] feature value
        this._baselines = new Map(); // target -> renderer value captured before routing started
    }

    loadPreset(key) {
        const preset = REACTIVITY_PRESETS[key];
        if (!preset) return;
        this.presetKey = key;
        this.routes = preset.routes.map((r) => createRoute(r));
        this._smoothed.clear();
        this._baselines.clear();
    }

    addRoute(overrides = {}) {
        const route = createRoute(overrides);
        this.routes.push(route);
        this.presetKey = null;
        return route;
    }

    removeRoute(id) {
        this.routes = this.routes.filter((r) => r.id !== id);
        this._smoothed.delete(id);
        this.presetKey = null;
    }

    updateRoute(id, patch) {
        const route = this.routes.find((r) => r.id === id);
        if (!route) return;
        Object.assign(route, patch);
        this.presetKey = null;
    }

    clear() {
        this.routes = [];
        this._smoothed.clear();
        this._baselines.clear();
        this.presetKey = null;
    }

    _baseline(renderer, target) {
        if (this._baselines.has(target)) return this._baselines.get(target);
        const value = target === 'zoom' ? renderer.zoom : (renderer.params[target] ?? 0);
        this._baselines.set(target, value);
        return value;
    }

    // Call once per frame while audioReactor.isActive. Additively offsets each
    // routed target from a baseline captured the first time that target is
    // seen, mirroring the old per-session window.baseParams approach but
    // keyed per-target so multiple routes can share a target without
    // clobbering each other's baseline.
    apply(renderer) {
        if (!this.enabled || !this.audioReactor || this.routes.length === 0) return;
        const features = this.audioReactor.getFeatures();

        const deltas = {}; // target -> accumulated delta this frame
        for (const route of this.routes) {
            if (!route.enabled) continue;
            const raw = features[route.source] ?? 0;

            const prevSmoothed = this._smoothed.get(route.id) ?? 0;
            const smoothed = prevSmoothed + (raw - prevSmoothed) * (1 - route.smoothing);
            this._smoothed.set(route.id, smoothed);

            const curved = applyCurve(smoothed, route.curve);
            deltas[route.target] = (deltas[route.target] || 0) + curved * route.gain;
        }

        for (const target of Object.keys(deltas)) {
            const value = this._baseline(renderer, target) + deltas[target];
            if (target === 'zoom') {
                renderer.setCameraParams({ zoom: value });
            } else {
                renderer.setParams({ [target]: value });
            }
        }
    }

    // Baselines are captured lazily on first use; drop them so re-enabling
    // (or a fresh preset) re-captures the renderer's current resting state
    // instead of offsetting from a stale one.
    resetBaselines() {
        this._baselines.clear();
    }

    toJSON() {
        return {
            enabled: this.enabled,
            presetKey: this.presetKey,
            routes: this.routes.map((r) => ({ ...r })),
        };
    }

    static fromJSON(json) {
        const router = new ReactivityRouter();
        if (!json || typeof json !== 'object') return router;
        router.enabled = json.enabled !== undefined ? !!json.enabled : true;
        router.presetKey = json.presetKey || null;
        router.routes = Array.isArray(json.routes) ? json.routes.map((r) => createRoute(r)) : [];
        return router;
    }

    loadFromRoutes(routes, presetKey = null) {
        this.routes = Array.isArray(routes) ? routes.map((r) => createRoute(r)) : [];
        this.presetKey = presetKey;
        this._smoothed.clear();
        this._baselines.clear();
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
        } catch (err) {
            console.warn('[ReactivityRouter] Failed to persist routes:', err);
        }
    }

    loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            this.enabled = parsed.enabled !== undefined ? !!parsed.enabled : true;
            this.loadFromRoutes(parsed.routes, parsed.presetKey || null);
            return true;
        } catch (err) {
            console.warn('[ReactivityRouter] Failed to load persisted routes:', err);
            return false;
        }
    }

    // Routine-format bridge: `{ type: 'reactivity_map', routes, enabled, preset }`
    toRoutineEvent(time = 0) {
        return { time, type: 'reactivity_map', ...this.toJSON() };
    }

    applyRoutineEvent(evt) {
        if (evt.preset && REACTIVITY_PRESETS[evt.preset]) {
            this.loadPreset(evt.preset);
        } else if (Array.isArray(evt.routes)) {
            this.loadFromRoutes(evt.routes, evt.presetKey || null);
        }
        if (evt.enabled !== undefined) this.enabled = !!evt.enabled;
    }
}
