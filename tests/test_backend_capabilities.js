// Headless check for src/ui-backend-capabilities.js with a minimal fake DOM.
import assert from 'node:assert/strict';
import { annotateWebGPUOnlyControls, WEBGPU_ONLY_CONTROL_IDS, WEBGPU_ONLY_NOTE } from '../src/ui-backend-capabilities.js';

function fakeEl(id) {
    const children = [];
    const el = {
        id, disabled: false, title: '', attrs: {}, classes: new Set(), dataset: { }, children,
        setAttribute(k, v) { this.attrs[k] = v; },
        classList: { add: (c) => el.classes.add(c) },
        querySelector: (sel) => children.find((c) => sel.includes(c.className)) || null,
        appendChild: (c) => children.push(c),
    };
    const label = { ...el, children: [], dataset: {}, querySelector(sel) { return this.children.find((c) => sel.includes(c.className)) || null; }, appendChild(c) { this.children.push(c); } };
    el.closest = (sel) => (sel === 'label' ? null : { querySelector: () => label });
    el._label = label;
    return el;
}

const els = Object.fromEntries(WEBGPU_ONLY_CONTROL_IDS.map((id) => [id, fakeEl(id)]));
const doc = {
    getElementById: (id) => els[id] || null,
    createElement: () => ({ className: '', textContent: '', title: '' }),
    querySelector: () => null,
};

assert.deepEqual(annotateWebGPUOnlyControls({ usingWebGL: false }, doc), [], 'WebGPU: nothing touched');
assert.ok(Object.values(els).every((e) => !e.disabled));

const done = annotateWebGPUOnlyControls({ usingWebGL: true }, doc);
assert.deepEqual(done, [...WEBGPU_ONLY_CONTROL_IDS]);
for (const e of Object.values(els)) {
    assert.equal(e.disabled, true);
    assert.equal(e.title, WEBGPU_ONLY_NOTE);
    assert.equal(e._label.children.length, 1, 'one badge per label');
}
annotateWebGPUOnlyControls({ usingWebGL: true }, doc);
assert.ok(Object.values(els).every((e) => e._label.children.length === 1), 'idempotent');
console.log('test_backend_capabilities: ok');
