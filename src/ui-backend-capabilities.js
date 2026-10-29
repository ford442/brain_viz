// ui-backend-capabilities.js
// [Neuro-Weaver] Mark every control the WebGL2 fallback ignores as "WebGPU only".
//
// The fallback is a simplified debug path (docs/webgl-fallback.md): it has no
// post-processing pass, no clipmap and no WASM hand-off, so those sliders used
// to stay live and silently do nothing. Explicit beats silent: each such
// control is disabled, badged and given a tooltip that says why. The
// renderer/fallback status line is untouched and stays visible.

export const WEBGPU_ONLY_NOTE = 'WebGPU only — not available on the WebGL2 fallback renderer.';

/**
 * DOM ids of controls with no effect on the WebGL2 fallback. Keep in step with
 * the "Post-processing" and "Clipmap" rows of the capability matrix in
 * docs/webgl-fallback.md. WASM and the field-resolution note are handled by
 * main-synaptix-integration.js, which owns those buttons.
 */
export const WEBGPU_ONLY_CONTROL_IDS = Object.freeze([
    // Post-processing pass (aberration, grain, depth of field, fog)
    'fogDensity', 'aberration', 'grain', 'focus', 'aperture',
    // Clipmap fine brick + cortical patch (src/ui-clipmap-panel.js)
    'clipmap-enable', 'clipmap-patch', 'clipmap-auto-quality', 'clipmap-focus',
]);

/**
 * Disable and annotate the WebGPU-only controls. A no-op on WebGPU.
 * @param {{usingWebGL?: boolean}} rendererInfo
 * @param {Document} [doc]
 * @returns {string[]} ids that were annotated
 */
export function annotateWebGPUOnlyControls(rendererInfo, doc = document) {
    if (!rendererInfo?.usingWebGL) return [];
    const done = [];
    for (const id of WEBGPU_ONLY_CONTROL_IDS) {
        const el = /** @type {HTMLInputElement|HTMLSelectElement|null} */ (doc.getElementById(id));
        if (!el) continue;
        el.disabled = true;
        el.title = WEBGPU_ONLY_NOTE;
        el.setAttribute('aria-disabled', 'true');
        el.classList.add('webgpu-only-disabled');

        // The label that owns the control: the enclosing <label> (checkboxes)
        // or the first label in its control-group (sliders, selects).
        const label = el.closest('label') || el.closest('.control-group')?.querySelector('label');
        if (label && !label.querySelector('.webgpu-only-badge')) {
            const badge = doc.createElement('span');
            badge.className = 'webgpu-only-badge';
            badge.textContent = 'WebGPU only';
            badge.title = WEBGPU_ONLY_NOTE;
            label.appendChild(badge);
            if (label.dataset.tooltip) label.dataset.tooltip += ` ${WEBGPU_ONLY_NOTE}`;
        }
        done.push(id);
    }
    // Clipmap's whole group: badge the heading label too so the panel reads as a unit.
    const group = doc.querySelector('.clipmap-panel');
    const heading = group?.querySelector(':scope > label');
    if (heading && !heading.querySelector('.webgpu-only-badge')) {
        const badge = doc.createElement('span');
        badge.className = 'webgpu-only-badge';
        badge.textContent = 'WebGPU only';
        heading.appendChild(badge);
    }
    return done;
}
