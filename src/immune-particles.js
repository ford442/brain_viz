// immune-particles.js
// [Phase 6] Immune cell migration particle pool.
//
// Shared CPU-side model for the immune-cell particle streams that spawn during
// inflammatory events (`histamine`, `immune_migration`, `immune_surge`).
//
// The pool is allocated once at startup and recycled — no per-frame allocation.
// Both backends consume the same buffer:
//   * WebGPU uploads it verbatim as an instance buffer and evaluates the
//     trajectory in WGSL (src/shaders/immune.js).
//   * WebGL2 evaluates the same trajectory on the CPU via sampleImmuneParticle()
//     and streams point sprites (simplified fallback path).
//
// Layout (IMMUNE_STRIDE floats per particle, 4 x vec4 for WGSL alignment):
//   [ 0.. 2] origin  xyz  — vascular entry point on the pial surface
//   [ 3]     stagger      — 0..1 phase offset so a surge streams in over time
//   [ 4.. 6] target  xyz  — inflammation site
//   [ 7]     spawnTime    — seconds; < 0 marks the slot inactive
//   [ 8..10] control xyz  — quadratic Bezier control point (vessel-like arc)
//   [11]     seed         — 0..1, gates the particle against spawn intensity
//   [12]     speed        — 1 / travel time
//   [13]     intensity    — per-particle brightness scale
//   [14..15] padding

export const IMMUNE_STRIDE = 16;
export const IMMUNE_MAX_PARTICLES = 2048;

/** Radius of the notional pial vasculature that immune cells stream in from. */
const VASCULAR_RADIUS = 1.62;

/**
 * Allocate a recycled immune particle pool.
 * @param {number} capacity Maximum simultaneous particles (capped at IMMUNE_MAX_PARTICLES).
 */
export function createImmunePool(capacity = IMMUNE_MAX_PARTICLES) {
    const count = Math.max(0, Math.min(IMMUNE_MAX_PARTICLES, Math.floor(capacity)));
    const pool = {
        capacity: count,
        activeCount: 0,
        data: new Float32Array(count * IMMUNE_STRIDE),
        dirty: false
    };
    clearImmunePool(pool);
    return pool;
}

/** Deactivate every slot (used by `glial_cleanup` / `immune_resolve`). */
export function clearImmunePool(pool) {
    if (!pool) return;
    for (let i = 0; i < pool.capacity; i++) {
        pool.data[i * IMMUNE_STRIDE + 7] = -1.0; // spawnTime < 0 => inactive
    }
    pool.activeCount = 0;
    pool.dirty = true;
}

function hash01(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Seed (or re-seed) a surge of immune cells converging on `target`.
 *
 * Particles are laid out deterministically from `seedOffset` so repeated surges
 * look varied without needing a RNG the WebGL/WebGPU paths would disagree on.
 *
 * @param {object} pool          Pool from createImmunePool().
 * @param {number[]} target      [x, y, z] inflammation site in brain space.
 * @param {number} intensity     0..N event intensity; scales count and brightness.
 * @param {number} time          Current renderer time in seconds.
 * @param {number} seedOffset    Varies the deterministic layout between surges.
 */
export function seedImmuneSurge(pool, target, intensity, time, seedOffset = 0) {
    if (!pool || pool.capacity === 0) return 0;
    const strength = Math.max(0.0, Math.min(2.0, intensity));
    if (strength <= 0.0) {
        clearImmunePool(pool);
        return 0;
    }

    const tx = target[0] || 0.0;
    const ty = target[1] || 0.0;
    const tz = target[2] || 0.0;
    const count = Math.max(1, Math.min(pool.capacity, Math.round(pool.capacity * Math.min(1.0, strength * 0.6))));
    const data = pool.data;

    for (let i = 0; i < pool.capacity; i++) {
        const base = i * IMMUNE_STRIDE;
        if (i >= count) {
            data[base + 7] = -1.0;
            continue;
        }

        const h = seedOffset + i * 1.618;
        // Golden-spiral distribution over the pial surface => even vessel entries.
        const u = hash01(h);
        const phi = Math.acos(1.0 - 2.0 * ((i + 0.5) / count));
        const theta = Math.PI * (1.0 + Math.sqrt(5.0)) * i + u * 0.6;
        const ox = Math.sin(phi) * Math.cos(theta) * VASCULAR_RADIUS;
        const oy = Math.cos(phi) * VASCULAR_RADIUS;
        const oz = Math.sin(phi) * Math.sin(theta) * VASCULAR_RADIUS;

        // Vessel-like arc: bow the path away from the straight line, biased
        // outward so cells hug the surface before diving toward the lesion.
        const mx = (ox + tx) * 0.5;
        const my = (oy + ty) * 0.5;
        const mz = (oz + tz) * 0.5;
        const bow = 0.25 + hash01(h + 3.3) * 0.45;
        const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1.0;

        data[base + 0] = ox;
        data[base + 1] = oy;
        data[base + 2] = oz;
        data[base + 3] = hash01(h + 7.7);
        data[base + 4] = tx;
        data[base + 5] = ty;
        data[base + 6] = tz;
        data[base + 7] = time;
        data[base + 8] = mx + (mx / ml) * bow;
        data[base + 9] = my + (my / ml) * bow;
        data[base + 10] = mz + (mz / ml) * bow;
        data[base + 11] = hash01(h + 11.1);
        data[base + 12] = 1.0 / (2.4 + hash01(h + 17.9) * 2.2); // 2.4-4.6s transit
        data[base + 13] = 0.6 + hash01(h + 23.4) * 0.6;
        data[base + 14] = 0.0;
        data[base + 15] = 0.0;
    }

    pool.activeCount = count;
    pool.dirty = true;
    return count;
}

/**
 * CPU evaluation of one particle at `time`, mirroring the WGSL in
 * src/shaders/immune.js. Used by the WebGL2 fallback.
 *
 * @returns {{x:number,y:number,z:number,alpha:number,size:number,burst:number}|null}
 *          null when the slot is inactive or gated out at this intensity.
 */
export function sampleImmuneParticle(pool, index, time, immuneActivity) {
    const base = index * IMMUNE_STRIDE;
    const data = pool.data;
    const spawnTime = data[base + 7];
    if (spawnTime < 0.0) return null;

    const activity = Math.max(0.0, Math.min(1.0, immuneActivity));
    if (activity <= 0.001) return null;
    // Spawn rate tied to intensity: a particle only streams once activity has
    // risen past its seed.
    if (data[base + 11] > activity) return null;

    const raw = (time - spawnTime) * data[base + 12] - data[base + 3];
    if (raw < 0.0) return null;
    const t = raw - Math.floor(raw);

    const inv = 1.0 - t;
    const w0 = inv * inv;
    const w1 = 2.0 * inv * t;
    const w2 = t * t;
    const x = data[base + 0] * w0 + data[base + 8] * w1 + data[base + 4] * w2;
    const y = data[base + 1] * w0 + data[base + 9] * w1 + data[base + 5] * w2;
    const z = data[base + 2] * w0 + data[base + 10] * w1 + data[base + 6] * w2;

    // Phagocytosis burst on arrival, then fade out.
    const burst = smoothstep(0.86, 1.0, t);
    const fade = 1.0 - smoothstep(0.94, 1.0, t);
    const ramp = smoothstep(0.0, 0.08, t);
    const intensity = data[base + 13] * activity;

    return {
        x, y, z,
        burst,
        size: 1.0 + burst * 2.2,
        alpha: intensity * ramp * fade
    };
}

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
}
