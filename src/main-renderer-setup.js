// main-renderer-setup.js — WebGPU/WebGL renderer bootstrap and debug controls
import { createBrainRenderer, buildRendererUrl, persistRendererPreference } from './brain-renderer-factory.js';

export async function setupRendererBackend(canvas) {
    const rendererInfo = await createBrainRenderer(canvas);
    const renderer = rendererInfo.renderer;

    const rendererBackendInput = document.getElementById('renderer-backend');
    const webglDebugWireframeInput = document.getElementById('webgl-debug-wireframe');
    const webglDebugTensorInput = document.getElementById('webgl-debug-tensor');
    const webglDebugIsolateInput = document.getElementById('webgl-debug-isolate');
    const rendererStatus = document.getElementById('renderer-status');
    const rendererNotes = document.getElementById('renderer-reload-note');
    const webglDebugPanel = document.getElementById('webgl-debug-controls');

    if (rendererBackendInput) {
        rendererBackendInput.value = rendererInfo.rendererType;
        rendererBackendInput.addEventListener('change', (evt) => {
            const nextRenderer = evt.target.value === 'webgl' ? 'webgl' : 'webgpu';
            persistRendererPreference(nextRenderer);
            window.location.assign(buildRendererUrl(nextRenderer));
        });
    }

    if (rendererStatus) {
        const fallbackText = rendererInfo.fallbackReason ? ` | fallback: ${rendererInfo.fallbackReason}` : '';
        rendererStatus.textContent = `active: ${rendererInfo.rendererType}${fallbackText}`;
    }
    if (rendererNotes) {
        rendererNotes.textContent = rendererInfo.rendererType === 'webgl'
            ? 'WebGL2 debug renderer active. Switch back to WebGPU for the full WGSL pipeline.'
            : 'WebGPU renderer active. Switch to WebGL2 when you need easier automated inspection.';
    }

    const isWebGLRenderer = rendererInfo.rendererType === 'webgl';
    if (webglDebugPanel) {
        webglDebugPanel.style.display = isWebGLRenderer ? '' : 'none';
    }
    if (webglDebugWireframeInput) {
        webglDebugWireframeInput.checked = renderer.getDebugOptions ? renderer.getDebugOptions().wireframe : false;
        webglDebugWireframeInput.addEventListener('change', (evt) => {
            renderer.setDebugOptions?.({ wireframe: evt.target.checked });
        });
    }
    if (webglDebugTensorInput) {
        webglDebugTensorInput.checked = renderer.getDebugOptions ? renderer.getDebugOptions().tensorField : false;
        webglDebugTensorInput.addEventListener('change', (evt) => {
            renderer.setDebugOptions?.({ tensorField: evt.target.checked });
        });
    }
    if (webglDebugIsolateInput) {
        webglDebugIsolateInput.value = renderer.getDebugOptions ? renderer.getDebugOptions().isolate : 'all';
        webglDebugIsolateInput.addEventListener('change', (evt) => {
            renderer.setDebugOptions?.({ isolate: evt.target.value });
        });
    }

    return { renderer, rendererInfo };
}
