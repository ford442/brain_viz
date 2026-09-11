// [Neuro-Weaver] Wires ReactivityRouter (the Brain DJ audio->param mapping
// matrix) into the routine player and adds a grid editor UI, mirroring the
// AudioReactor/SonificationEngine panels in main-sonification-integration.js.
// No mic permission of its own — reads AudioReactor's feature bus, which the
// caller is responsible for starting.
import { ReactivityRouter, REACTIVITY_SOURCES, REACTIVITY_TARGETS, REACTIVITY_CURVES, REACTIVITY_PRESETS } from './reactivity-router.js';

export function setupReactivityIntegration(renderer, player, audioReactor, controls) {
    const router = new ReactivityRouter(audioReactor);
    if (!router.loadFromLocalStorage()) {
        router.loadPreset('classic');
    }
    router.audioReactor = audioReactor;
    player.reactivityRouter = router;

    if (controls) buildReactivityPanel(router, controls);

    return router;
}

function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'style') Object.assign(node.style, value);
        else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value);
    });
    children.forEach((child) => node.appendChild(child));
    return node;
}

function optionList(values, labelFor = (v) => v) {
    return values.map((v) => el('option', { value: v }, [document.createTextNode(labelFor(v))]));
}

function buildReactivityPanel(router, controls) {
    const wrapper = el('div', {
        style: {
            marginTop: '8px', padding: '8px', border: '1px solid #335',
            borderRadius: '4px', background: 'rgba(10,15,30,0.4)',
        },
    });

    const header = el('div', {
        style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' },
    });

    const title = el('span', { style: { color: '#9cf', fontWeight: 'bold', marginRight: 'auto' } }, [
        document.createTextNode('Reactivity Router 🎛️'),
    ]);

    const enableToggle = el('input', { type: 'checkbox' });
    enableToggle.checked = router.enabled;
    enableToggle.addEventListener('change', () => {
        router.enabled = enableToggle.checked;
        if (router.enabled) router.resetBaselines();
        router.saveToLocalStorage();
    });
    const enableLabel = el('label', { style: { color: '#ccc', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' } }, [
        enableToggle, document.createTextNode('Enabled'),
    ]);

    const presetSelect = el('select', { title: 'Reactivity preset' },
        optionList(Object.keys(REACTIVITY_PRESETS), (key) => REACTIVITY_PRESETS[key].name));
    presetSelect.value = router.presetKey || Object.keys(REACTIVITY_PRESETS)[0];
    presetSelect.addEventListener('change', () => {
        router.loadPreset(presetSelect.value);
        router.saveToLocalStorage();
        renderRows();
    });

    header.appendChild(title);
    header.appendChild(presetSelect);
    header.appendChild(enableLabel);
    wrapper.appendChild(header);

    const grid = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
    wrapper.appendChild(grid);

    const footer = el('div', { style: { display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' } });

    const addBtn = el('button', {
        type: 'button',
        style: { background: '#224', borderColor: '#48d', color: '#9cf' },
        onclick: () => { router.addRoute(); router.saveToLocalStorage(); renderRows(); },
    }, [document.createTextNode('+ Add Route')]);

    const exportBtn = el('button', {
        type: 'button',
        onclick: () => exportRoutes(router),
    }, [document.createTextNode('Export JSON')]);

    const importInput = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
    importInput.addEventListener('change', async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            router.loadFromRoutes(parsed.routes, parsed.presetKey || null);
            if (parsed.enabled !== undefined) router.enabled = !!parsed.enabled;
            router.saveToLocalStorage();
            enableToggle.checked = router.enabled;
            presetSelect.value = router.presetKey || Object.keys(REACTIVITY_PRESETS)[0];
            renderRows();
        } catch (err) {
            console.warn('[ReactivityRouter] Failed to import mapping profile:', err);
            alert('Invalid reactivity mapping JSON.');
        } finally {
            importInput.value = '';
        }
    });
    const importBtn = el('button', {
        type: 'button',
        onclick: () => importInput.click(),
    }, [document.createTextNode('Import JSON')]);

    footer.appendChild(addBtn);
    footer.appendChild(exportBtn);
    footer.appendChild(importBtn);
    footer.appendChild(importInput);
    wrapper.appendChild(footer);

    function renderRows() {
        grid.innerHTML = '';
        if (router.routes.length === 0) {
            grid.appendChild(el('div', { style: { color: '#778', fontSize: '11px' } }, [
                document.createTextNode('No routes. Add one, or pick a preset above.'),
            ]));
        }
        router.routes.forEach((route) => grid.appendChild(buildRouteRow(router, route, renderRows)));
    }

    renderRows();
    controls.appendChild(wrapper);
}

function buildRouteRow(router, route, rerender) {
    const row = el('div', {
        style: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 52px 52px 68px 20px 20px',
            gap: '3px', alignItems: 'center', fontSize: '11px',
        },
    });

    const sourceSelect = el('select', {}, optionList(REACTIVITY_SOURCES));
    sourceSelect.value = route.source;
    sourceSelect.addEventListener('change', () => {
        router.updateRoute(route.id, { source: sourceSelect.value });
        router.saveToLocalStorage();
    });

    const targetSelect = el('select', {}, optionList(REACTIVITY_TARGETS));
    targetSelect.value = route.target;
    targetSelect.addEventListener('change', () => {
        router.updateRoute(route.id, { target: targetSelect.value });
        router.saveToLocalStorage();
    });

    const gainInput = el('input', { type: 'number', step: '0.05', title: 'Gain' });
    gainInput.value = route.gain;
    gainInput.addEventListener('change', () => {
        router.updateRoute(route.id, { gain: parseFloat(gainInput.value) || 0 });
        router.saveToLocalStorage();
    });

    const smoothingInput = el('input', { type: 'number', step: '0.05', min: '0', max: '0.98', title: 'Smoothing' });
    smoothingInput.value = route.smoothing;
    smoothingInput.addEventListener('change', () => {
        const v = Math.max(0, Math.min(0.98, parseFloat(smoothingInput.value) || 0));
        router.updateRoute(route.id, { smoothing: v });
        router.saveToLocalStorage();
    });

    const curveSelect = el('select', { title: 'Response curve' }, optionList(REACTIVITY_CURVES));
    curveSelect.value = route.curve;
    curveSelect.addEventListener('change', () => {
        router.updateRoute(route.id, { curve: curveSelect.value });
        router.saveToLocalStorage();
    });

    const enabledToggle = el('input', { type: 'checkbox', title: 'Route enabled' });
    enabledToggle.checked = route.enabled;
    enabledToggle.addEventListener('change', () => {
        router.updateRoute(route.id, { enabled: enabledToggle.checked });
        router.saveToLocalStorage();
    });

    const removeBtn = el('button', {
        type: 'button', title: 'Remove route',
        style: { padding: '0 4px', color: '#f88' },
        onclick: () => { router.removeRoute(route.id); router.saveToLocalStorage(); rerender(); },
    }, [document.createTextNode('✕')]);

    row.appendChild(sourceSelect);
    row.appendChild(targetSelect);
    row.appendChild(gainInput);
    row.appendChild(smoothingInput);
    row.appendChild(curveSelect);
    row.appendChild(enabledToggle);
    row.appendChild(removeBtn);
    return row;
}

function exportRoutes(router) {
    const blob = new Blob([JSON.stringify(router.toJSON(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reactivity-mapping.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
