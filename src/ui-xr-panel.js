import { buildRendererUrl } from './brain-renderer-factory.js';
import { WebXRManager } from './webxr-manager.js';

export function setupXrPanel(renderer, player) {
    const manager = new WebXRManager(renderer, player);
    const status = document.getElementById('xr-status');
    const enterVr = document.getElementById('btn-xr-enter-vr');
    const enterAr = document.getElementById('btn-xr-enter-ar');
    const end = document.getElementById('btn-xr-end');
    const switchWebgl = document.getElementById('btn-xr-switch-webgl');
    const preset = document.getElementById('xr-lobe-preset');
    const style = document.getElementById('xr-style');

    const renderStatus = ({ status: message, support, presenting }) => {
        if (status) status.textContent = message;
        const webglReady = renderer.backendType === 'webgl';
        if (enterVr) enterVr.disabled = presenting || !webglReady || !support.vr;
        if (enterAr) enterAr.disabled = presenting || !webglReady || !support.ar;
        if (end) end.disabled = !presenting;
        if (switchWebgl) switchWebgl.style.display = webglReady ? 'none' : '';
    };
    manager.onStatus = renderStatus;

    const enter = async (mode) => {
        try {
            await manager.enter(mode);
        } catch (error) {
            manager.status = `Could not enter XR: ${error.message}`;
            manager._emitStatus();
        }
    };
    enterVr?.addEventListener('click', () => enter('immersive-vr'));
    enterAr?.addEventListener('click', () => enter('immersive-ar'));
    end?.addEventListener('click', () => manager.end());
    preset?.addEventListener('change', () => manager.teleportToPreset(preset.value));
    style?.addEventListener('change', () => renderer.setParams({ style: Number(style.value) }));
    switchWebgl?.addEventListener('click', () => {
        const url = new URL(buildRendererUrl('webgl'));
        url.searchParams.set('openTab', 'xr');
        window.location.assign(url.toString());
    });

    window.__xrDebug = {
        manager,
        getState: () => ({
            status: manager.status,
            support: { ...manager.support },
            presenting: manager.isPresenting,
            mode: manager.mode,
            frameCount: manager.frameCount,
            rig: { ...manager.rig, position: [...manager.rig.position] },
            renderer: renderer.backendType,
        }),
    };
    manager.checkSupport().catch((error) => {
        manager.status = `XR support check failed: ${error.message}`;
        manager._emitStatus();
    });
    return manager;
}
