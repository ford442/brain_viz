// @ts-check
// src/clipmap/frame-budget.js
// [Clipmap] GPU budget governor for the fine brick.
//
// The brick and the cortical patch are the most expensive optional work in a
// frame, so they are what gives way first when the GPU budget is blown. This
// module turns per-frame cost samples into two things:
//
//   pressure — 0 while the frame costs under ~75% of the budget, 1 at ~125%,
//              smoothed so a single slow frame does not change quality.
//   tier     — the brick quality level, chosen from
//              `lodLoad = max(params.cognitiveLoad, pressure)`.
//
// `cognitiveLoad` is the engine's existing "visual cortex fatigue" LoD knob
// (render-loop.js already downscales the canvas with it), so a routine or the
// user can force detail down through it. The governor *reads* it and never
// writes it: `cognitiveLoad` is also a physics input — avalancheCriticality()
// in docs/tensor-physics.md §3.3 — and a performance governor that raised it
// would make the simulation more critical whenever the GPU was slow.
//
// Downgrades caused by the budget (not by cognitiveLoad) arm an exponential
// backoff before the same tier may be retried. Without it a brick that
// genuinely does not fit oscillates: over budget → off → under budget → on →
// over budget, a visible flicker with a period of about a second.

/** Brick quality tiers, lowest first. */
export const BRICK_TIERS = Object.freeze({
    /** No brick, no patch. The coarse field only. */
    OFF: 0,
    /** Brick stepped every other frame, short in-brick raymarch, patch as point impostors. */
    REDUCED: 1,
    /** Brick stepped every frame, full in-brick raymarch, patch mesh + somas. */
    FULL: 2,
});

export const TIER_NAMES = Object.freeze(['off', 'reduced', 'full']);

/** lodLoad at or above which each tier is dropped. */
const DOWNGRADE_AT = Object.freeze({ [BRICK_TIERS.FULL]: 0.4, [BRICK_TIERS.REDUCED]: 0.75 });
/** lodLoad below which each tier may be (re)entered — below DOWNGRADE_AT, for hysteresis. */
const UPGRADE_BELOW = Object.freeze({ [BRICK_TIERS.FULL]: 0.3, [BRICK_TIERS.REDUCED]: 0.65 });

export const DEFAULT_GPU_BUDGET_MS = 12;
/**
 * Without timestamp queries the only signal is the rAF interval, which is
 * vsync-quantised: ~16.7 ms at 60 Hz is the floor, not a cost. Treat a frame
 * as over budget only when the interval stretches clearly past one refresh.
 */
export const DEFAULT_FRAME_INTERVAL_BUDGET_MS = 1000 / 60 * 1.25;

const BACKOFF_MIN_MS = 2000;
const BACKOFF_MAX_MS = 30000;
/** A tier held this long without a budget downgrade resets the backoff. */
const BACKOFF_RESET_MS = 60000;
/** Minimum time between upward tier steps — long enough for `ratio` to settle. */
const SETTLE_MS = 1000;

export class FrameBudget {
    /**
     * @param {{ budgetMs?: number, intervalBudgetMs?: number, smoothing?: number }} [opts]
     */
    constructor({ budgetMs = DEFAULT_GPU_BUDGET_MS, intervalBudgetMs = DEFAULT_FRAME_INTERVAL_BUDGET_MS, smoothing = 0.1 } = {}) {
        this.budgetMs = budgetMs;
        this.intervalBudgetMs = intervalBudgetMs;
        this.smoothing = smoothing;
        /** Smoothed cost / budget ratio. */
        this.ratio = 0;
        this.pressure = 0;
        /** 'gpu' when the last sample came from timestamps, 'interval' otherwise. */
        this.source = 'none';
        /** @type {number} A BRICK_TIERS value. */
        this.tier = BRICK_TIERS.FULL;
        this.lodLoad = 0;
        /** @type {Record<number, number>} tier -> earliest time it may be re-entered */
        this._blockedUntil = {};
        this._backoffMs = BACKOFF_MIN_MS;
        this._lastBudgetDowngradeAt = -Infinity;
        this._lastChangeAt = -Infinity;
    }

    /**
     * Feed one frame's cost. Prefer GPU time; fall back to the frame interval.
     * @param {{ gpuMs?: number|null, intervalMs?: number|null }} sample
     */
    observe({ gpuMs = null, intervalMs = null }) {
        /** @type {number|null} */
        let ratio = null;
        let source = this.source;
        if (typeof gpuMs === 'number' && Number.isFinite(gpuMs) && gpuMs >= 0) {
            ratio = gpuMs / this.budgetMs;
            source = 'gpu';
        } else if (typeof intervalMs === 'number' && Number.isFinite(intervalMs) && intervalMs > 0) {
            // Ignore stalls (tab switch, breakpoint, page load) — they are not a cost.
            if (intervalMs > 250) return this.pressure;
            ratio = intervalMs / this.intervalBudgetMs;
            source = 'interval';
        }
        if (ratio === null) return this.pressure;
        if (source !== this.source) this.ratio = ratio; // the two scales are not comparable
        this.source = source;
        this.ratio += (ratio - this.ratio) * this.smoothing;
        // GPU time has headroom below the budget, so pressure starts at 75% of
        // it (0 at 9 ms, 1 at 15 ms for a 12 ms budget). The rAF interval
        // cannot drop below the refresh period, so a healthy vsync-bound frame
        // already sits at ~80% of its budget: there pressure starts only once
        // the budget is exceeded (0 down to ~48 fps, 1 at 30 fps).
        this.pressure = source === 'gpu'
            ? Math.max(0, Math.min(1, (this.ratio - 0.75) / 0.5))
            : Math.max(0, Math.min(1, (this.ratio - 1) / 0.6));
        return this.pressure;
    }

    /**
     * Choose the brick tier for this frame.
     * @param {number} cognitiveLoad - `params.cognitiveLoad`, read-only.
     * @param {number} now - ms timestamp.
     * @param {{ auto?: boolean }} [opts] - `auto: false` ignores budget pressure
     *   (only cognitiveLoad lowers the tier) — for verification on software
     *   adapters that can never meet a real-time budget.
     * @returns {number} A BRICK_TIERS value.
     */
    chooseTier(cognitiveLoad, now, { auto = true } = {}) {
        const load = Math.max(0, Math.min(1, Number(cognitiveLoad) || 0));
        const pressure = auto ? this.pressure : 0;
        const lodLoad = Math.max(load, pressure);
        this.lodLoad = lodLoad;
        const budgetDriven = pressure > load;

        let tier = this.tier;
        // Drop as far as the load demands in one decision.
        while (tier > BRICK_TIERS.OFF && lodLoad >= DOWNGRADE_AT[tier]) tier--;
        if (tier < this.tier) {
            if (budgetDriven) {
                // One backoff per downgrade event, shared by every tier it
                // dropped, doubling per event (not per tier dropped).
                for (let t = tier + 1; t <= this.tier; t++) this._blockedUntil[t] = now + this._backoffMs;
                this._backoffMs = Math.min(BACKOFF_MAX_MS, this._backoffMs * 2);
                this._lastBudgetDowngradeAt = now;
            }
            this._lastChangeAt = now;
        } else if (tier < BRICK_TIERS.FULL && now - this._lastChangeAt >= SETTLE_MS) {
            // Climb back one tier at a time: below the hysteresis line, once any
            // backoff expired, and only after the smoothed cost has had time to
            // reflect the tier we are on (or it would leap straight back up to
            // the tier that blew the budget).
            const up = tier + 1;
            if (lodLoad < UPGRADE_BELOW[up] && now >= (this._blockedUntil[up] ?? -Infinity)) {
                tier = up;
                this._lastChangeAt = now;
            }
        }
        if (now - this._lastBudgetDowngradeAt > BACKOFF_RESET_MS) this._backoffMs = BACKOFF_MIN_MS;
        this.tier = tier;
        return tier;
    }

    /** Snapshot for the HUD. */
    getState() {
        return {
            budgetMs: this.budgetMs,
            intervalBudgetMs: this.intervalBudgetMs,
            ratio: this.ratio,
            pressure: this.pressure,
            source: this.source,
            lodLoad: this.lodLoad,
            tier: this.tier,
            tierName: TIER_NAMES[this.tier],
        };
    }
}
