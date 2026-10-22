// @ts-nocheck — checkJs backlog; see the comment in jsconfig.json before removing.
// ui-clipmap-panel.js
// [Clipmap] Activity tab: fine-brick controls and the GPU-time HUD.
//
// The HUD is the first reader of GPUTimer: per-pass GPU time (coarse field,
// fine brick, scene, post), the budget the governor holds the clipmap to, and
// what the clipmap is doing about it. It reads only the shared facade
// (getFrameTimings / getClipmapState / setClipmapOptions), so it works — with
// less to say — on the WebGL2 fallback too.

const fmt = (value, digits = 2) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—');
const vec = (v) => (Array.isArray(v) ? `(${v.map((x) => x.toFixed(2)).join(',')})` : '—');

/**
 * The HUD text: short two-column lines, sized for the ~280 px control panel.
 * @param {import('./renderer-contract.js').BrainRendererFacade} renderer
 */
function describe(renderer) {
    const t = renderer.getFrameTimings();
    const c = renderer.getClipmapState();
    const lines = [];
    const row = (key, value) => lines.push(`${key.padEnd(9)}${value}`);

    if (t.gpuTimestamps && t.totalMs !== null) {
        row('GPU ms', `field ${fmt(t.fieldMs)}  brick ${fmt(t.brickMs)}`);
        row('', `scene ${fmt(t.sceneMs)}  post ${fmt(t.postMs)}`);
        row('total', `${fmt(t.totalMs)} / ${fmt(t.budgetMs, 1)} ms budget`);
    } else if (t.backend === 'webgpu') {
        row('GPU', t.gpuTimestamps ? 'waiting for timestamps…' : 'no timestamp-query');
        row('frame', `${fmt(t.cpuFrameMs, 1)} ms (budget signal)`);
    } else {
        row('frame', `${fmt(t.cpuFrameMs, 1)} ms (no GPU timing)`);
        row('CPU step', `${fmt(t.cpuFieldStepMs)} ms`);
    }
    row('pressure', `${fmt(t.pressure)}  LoD load ${fmt(t.lodLoad)}`);

    if (!c.supported) {
        row('Brick', 'WebGPU only');
    } else if (!c.active) {
        row('Brick', !c.options?.enabled ? 'disabled' : c.tier === 0 ? `off (tier ${c.tierName})` : 'off — zoom in');
    } else {
        row('Brick', `${c.mode} · ${c.tierName} · w ${fmt(c.weight)}`);
        row('', `${c.brickDim}³ of ${c.latticeDim}³ at ${vec(c.center)}`);
        const a = c.affinity;
        row('tracts', `${a.resident}/${a.resident + a.pending} chunks · ${(a.cacheBytes / 1048576).toFixed(1)} MB`);
    }
    if (c.supported && c.patch) {
        const p = c.patch;
        row('Patch', p.state === 'off' ? 'off'
            : p.state === 'building' ? 'generating…'
                : `${p.state} · ${p.vertices} v · ${p.somas} somas`);
    }
    return { text: lines.join('\n'), timings: t, state: c };
}

/**
 * @param {import('./renderer-contract.js').BrainRendererFacade} renderer
 */
export function setupClipmapPanel(renderer) {
    const enable = /** @type {HTMLInputElement|null} */ (document.getElementById('clipmap-enable'));
    const patch = /** @type {HTMLInputElement|null} */ (document.getElementById('clipmap-patch'));
    const autoQuality = /** @type {HTMLInputElement|null} */ (document.getElementById('clipmap-auto-quality'));
    const focus = /** @type {HTMLSelectElement|null} */ (document.getElementById('clipmap-focus'));
    const hud = document.getElementById('gpu-hud');
    const fill = document.getElementById('gpu-budget-fill');

    const apply = () => renderer.setClipmapOptions({
        enabled: enable ? enable.checked : true,
        patch: patch ? patch.checked : true,
        autoQuality: autoQuality ? autoQuality.checked : true,
        focus: focus ? focus.value : 'auto',
    });
    const supported = apply();
    for (const el of [enable, patch, autoQuality, focus]) {
        if (!el) continue;
        el.addEventListener('change', apply);
        if (!supported) el.disabled = true;
    }

    const update = () => {
        const { text, timings } = describe(renderer);
        if (hud) hud.textContent = text;
        if (fill) {
            const cost = timings.totalMs ?? null;
            const ratio = cost !== null && timings.budgetMs ? cost / timings.budgetMs : timings.pressure * 1.25;
            fill.style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;
            fill.classList.toggle('over', ratio > 1);
        }
    };
    update();
    const timer = setInterval(update, 250);

    // Same convention as __xrDebug / __bciDebug: a console/automation handle.
    window.__clipmapDebug = {
        renderer,
        getState: () => renderer.getClipmapState(),
        getTimings: () => renderer.getFrameTimings(),
        setOptions: (options) => renderer.setClipmapOptions(options),
        describe: () => describe(renderer).text,
    };
    return { update, dispose: () => clearInterval(timer) };
}
