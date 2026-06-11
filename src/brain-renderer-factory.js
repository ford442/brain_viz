import { BrainRenderer } from './brain-renderer.js';
import { BrainRendererWebGL } from './brain-renderer-webgl.js';

const STORAGE_KEY = 'neuro-weaver:renderer';

function getRequestedRenderer(searchParams = new URLSearchParams(window.location.search)) {
    if (searchParams.get('renderer')) {
        return searchParams.get('renderer').toLowerCase();
    }
    if (searchParams.has('webgl')) {
        return 'webgl';
    }
    if (searchParams.has('webgpu') || searchParams.has('wgpu')) {
        return 'webgpu';
    }
    return (localStorage.getItem(STORAGE_KEY) || 'webgpu').toLowerCase();
}

export function persistRendererPreference(rendererType) {
    try {
        localStorage.setItem(STORAGE_KEY, rendererType);
    } catch {
        // localStorage is convenience only.
    }
}

export function buildRendererUrl(rendererType) {
    const url = new URL(window.location.href);
    url.searchParams.set('renderer', rendererType);
    url.searchParams.delete('webgl');
    url.searchParams.delete('webgpu');
    url.searchParams.delete('wgpu');
    return url.toString();
}

export async function createBrainRenderer(canvas) {
    const requestedRenderer = getRequestedRenderer();
    const attempts = requestedRenderer === 'webgl'
        ? ['webgl', 'webgpu']
        : ['webgpu', 'webgl'];
    let fallbackReason = null;
    let lastError = null;

    for (const rendererType of attempts) {
        try {
            const renderer = rendererType === 'webgl'
                ? new BrainRendererWebGL(canvas)
                : new BrainRenderer(canvas);
            await renderer.initialize();
            persistRendererPreference(rendererType);
            renderer.backendType = rendererType;
            renderer.requestedRenderer = requestedRenderer;
            renderer.rendererFallbackReason = fallbackReason;
            return {
                renderer,
                rendererType,
                requestedRenderer,
                usingWebGPU: rendererType === 'webgpu',
                usingWebGL: rendererType === 'webgl',
                fallbackReason
            };
        } catch (error) {
            lastError = error;
            if (rendererType === requestedRenderer) {
                fallbackReason = `${rendererType.toUpperCase()} initialization failed: ${error.message}`;
            }
        }
    }

    throw lastError || new Error('No supported renderer backend was available.');
}
