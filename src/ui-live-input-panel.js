// ui-live-input-panel.js — wires the Live tab's mapping matrix to a
// LiveInputBus instance. Mirrors ui-training-panel.js / ui-bci-panel.js:
// static markup lives in src/ui/templates/tab-live.js, this file queries it
// by id and owns the dynamic mapping rows.
import { LIVE_INPUT_SINKS } from './live-input-bus.js';

function optionsFor(values, current, labelFor = (v) => v) {
    return values.map((v) => `<option value="${v}"${v === current ? ' selected' : ''}>${labelFor(v)}</option>`).join('');
}

function buildRow(bus, mapping, rerender) {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 48px 44px 44px 20px 20px;gap:3px;align-items:center;font-size:10px;';

    const featureOptions = bus.listFeatures();
    const sourceSelect = document.createElement('select');
    sourceSelect.innerHTML = optionsFor([...new Set(featureOptions.map((f) => f.source))], mapping.source);
    const featureSelect = document.createElement('select');

    const syncFeatureOptions = () => {
        const features = featureOptions.filter((f) => f.source === sourceSelect.value).map((f) => f.feature);
        featureSelect.innerHTML = optionsFor(features, mapping.feature);
    };
    syncFeatureOptions();

    sourceSelect.addEventListener('change', () => {
        syncFeatureOptions();
        bus.updateMapping(mapping.id, { source: sourceSelect.value, feature: featureSelect.value });
        bus.saveToLocalStorage();
    });
    featureSelect.addEventListener('change', () => {
        bus.updateMapping(mapping.id, { feature: featureSelect.value });
        bus.saveToLocalStorage();
    });

    const sinkSelect = document.createElement('select');
    sinkSelect.innerHTML = optionsFor(LIVE_INPUT_SINKS, mapping.sink);
    sinkSelect.addEventListener('change', () => {
        bus.updateMapping(mapping.id, { sink: sinkSelect.value });
        bus.saveToLocalStorage();
    });

    const scaleInput = document.createElement('input');
    scaleInput.type = 'number';
    scaleInput.step = '0.1';
    scaleInput.title = 'Scale';
    scaleInput.value = mapping.scale;
    scaleInput.addEventListener('change', () => {
        bus.updateMapping(mapping.id, { scale: parseFloat(scaleInput.value) || 0 });
        bus.saveToLocalStorage();
    });

    const attackInput = document.createElement('input');
    attackInput.type = 'number';
    attackInput.step = '0.05';
    attackInput.min = '0.001';
    attackInput.title = 'Attack (s)';
    attackInput.value = mapping.attack;
    attackInput.addEventListener('change', () => {
        bus.updateMapping(mapping.id, { attack: Math.max(0.001, parseFloat(attackInput.value) || 0.05) });
        bus.saveToLocalStorage();
    });

    const releaseInput = document.createElement('input');
    releaseInput.type = 'number';
    releaseInput.step = '0.05';
    releaseInput.min = '0.001';
    releaseInput.title = 'Release (s)';
    releaseInput.value = mapping.release;
    releaseInput.addEventListener('change', () => {
        bus.updateMapping(mapping.id, { release: Math.max(0.001, parseFloat(releaseInput.value) || 0.4) });
        bus.saveToLocalStorage();
    });

    const enabledToggle = document.createElement('input');
    enabledToggle.type = 'checkbox';
    enabledToggle.title = 'Mapping enabled';
    enabledToggle.checked = mapping.enabled;
    enabledToggle.addEventListener('change', () => {
        bus.updateMapping(mapping.id, { enabled: enabledToggle.checked });
        bus.saveToLocalStorage();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.title = 'Remove mapping';
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'padding:0 4px;color:#f88;';
    removeBtn.addEventListener('click', () => {
        bus.removeMapping(mapping.id);
        bus.saveToLocalStorage();
        rerender();
    });

    row.append(sourceSelect, featureSelect, sinkSelect, scaleInput, attackInput, releaseInput, enabledToggle, removeBtn);
    return row;
}

export function setupLiveInputPanel(bus) {
    const grid = document.getElementById('live-bus-grid');
    const enabledToggle = document.getElementById('live-bus-enabled');
    const addBtn = document.getElementById('btn-live-bus-add');
    const exportBtn = document.getElementById('btn-live-bus-export');
    const importBtn = document.getElementById('btn-live-bus-import');
    const importFile = document.getElementById('live-bus-import-file');

    if (!grid) return; // Live tab not present in this DOM

    function renderRows() {
        grid.innerHTML = '';
        if (bus.mappings.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#778;font-size:10px;';
            empty.textContent = 'No mappings yet. Add one to route a live feature to a renderer param.';
            grid.appendChild(empty);
            return;
        }
        bus.mappings.forEach((mapping) => grid.appendChild(buildRow(bus, mapping, renderRows)));
    }

    if (enabledToggle) {
        enabledToggle.checked = bus.enabled;
        enabledToggle.addEventListener('change', () => {
            bus.enabled = enabledToggle.checked;
            if (bus.enabled) bus.resetBaselines();
            bus.saveToLocalStorage();
        });
    }

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const [first] = bus.listFeatures();
            bus.addMapping(first ? { source: first.source, feature: first.feature } : {});
            bus.saveToLocalStorage();
            renderRows();
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(bus.toJSON(), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'live-input-bus-mapping.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        });
    }

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', async () => {
            const file = importFile.files?.[0];
            if (!file) return;
            try {
                const parsed = JSON.parse(await file.text());
                bus.loadFromMappings(parsed.mappings);
                if (parsed.enabled !== undefined) bus.enabled = !!parsed.enabled;
                bus.saveToLocalStorage();
                if (enabledToggle) enabledToggle.checked = bus.enabled;
                renderRows();
            } catch (err) {
                console.warn('[LiveInputBus] Failed to import mapping profile:', err);
                alert('Invalid live input mapping JSON.');
            } finally {
                importFile.value = '';
            }
        });
    }

    renderRows();
}
