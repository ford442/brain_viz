import { PATHWAYS } from './pathways.js';

function nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function createPathwayState() {
    return {
        selectedId: null,
        blockedIds: new Set(),
        pulse: null,
        metrics: { selectedVertexCount: 0, emissiveVertexCount: 0, maxEmission: 0, peakProgress: 0, edges: {} },
    };
}

export function computePathwayEmission(meta, state, worldPosition, lesion) {
    if (!meta || meta[0] <= 0 || state.blocked || state.selectedNumericId !== meta[0]) return 0;
    const progress = meta[2];
    const weight = meta[3];
    let emission = 0.18 * weight;
    if (state.pulseIntensity > 0) {
        const head = 1 - Math.min(1, Math.abs(progress - state.progress) / 0.12);
        const behind = state.progress - progress;
        const tail = behind >= 0 && behind <= 0.22 ? (1 - behind / 0.22) * 0.55 : 0;
        emission += Math.max(head, tail) * state.pulseIntensity * weight;
    }
    if (lesion?.active > 0 && lesion.radius > 0) {
        const distance = Math.hypot(worldPosition[0] - lesion.center[0], worldPosition[1] - lesion.center[1], worldPosition[2] - lesion.center[2]);
        if (distance < lesion.radius) emission *= 1 - lesion.active * (1 - distance / lesion.radius);
    }
    return Math.max(0, emission);
}

export function applyPathwayMethods(Target) {
    Target.prototype.selectPathway = function(id) {
        if (id !== null && !PATHWAYS[id]) {
            console.warn(`[Pathways] Unknown pathway ID: ${id}`);
            return false;
        }
        this.pathwayState.selectedId = id;
        return true;
    };

    Target.prototype.pulsePathway = function(id, options = {}) {
        const pathway = PATHWAYS[id];
        if (!pathway) {
            console.warn(`[Pathways] Unknown pathway ID: ${id}`);
            return false;
        }
        const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : pathway.defaultPulseDuration;
        const intensity = Number.isFinite(options.intensity) ? Math.max(0, options.intensity) : 1;
        this.selectPathway(id);
        this.pathwayState.pulse = { id, startedAt: nowMs(), duration, intensity };
        return true;
    };

    Target.prototype.setPathwayBlocked = function(id, blocked) {
        if (!PATHWAYS[id]) {
            console.warn(`[Pathways] Unknown pathway ID: ${id}`);
            return false;
        }
        if (blocked) this.pathwayState.blockedIds.add(id);
        else this.pathwayState.blockedIds.delete(id);
        return true;
    };

    Target.prototype.getPathwayRenderState = function() {
        const selected = this.pathwayState.selectedId ? PATHWAYS[this.pathwayState.selectedId] : null;
        const pulse = this.pathwayState.pulse;
        const elapsed = pulse ? Math.max(0, (nowMs() - pulse.startedAt) / 1000) : 0;
        const progress = pulse ? Math.min(1, elapsed / pulse.duration) : 0;
        const pulseIntensity = pulse && elapsed <= pulse.duration ? pulse.intensity : 0;
        return {
            selected,
            selectedNumericId: selected?.numericId || 0,
            blocked: selected ? this.pathwayState.blockedIds.has(selected.id) : false,
            progress,
            pulseIntensity,
            pulseActive: pulseIntensity > 0,
        };
    };

    Target.prototype.getPathwayState = function() {
        const renderState = this.getPathwayRenderState();
        const selection = (this.pathwaySelections || []).filter((item) => !renderState.selected || item.pathwayId === renderState.selected.id);
        const edges = renderState.selected ? renderState.selected.edges.map((edge) => ({
            id: edge.id,
            branch: edge.branch,
            source: edge.source,
            target: edge.target,
            selections: selection.filter((item) => item.edgeId === edge.id),
        })) : [];
        return {
            selectedId: renderState.selected?.id || null,
            transmitter: renderState.selected?.transmitter || null,
            color: renderState.selected ? [...renderState.selected.color] : null,
            schematic: renderState.selected?.schematic || false,
            blocked: renderState.blocked,
            pulseActive: renderState.pulseActive,
            progress: renderState.progress,
            intensity: renderState.pulseIntensity,
            edges,
            metrics: this.pathwayState.metrics,
        };
    };

    Target.prototype.updatePathwayStateBuffer = function() {
        if (!this.device || !this.pathwayStateBuffer) return;
        const state = this.getPathwayRenderState();
        const color = state.selected?.color || [0, 0, 0];
        this.device.queue.writeBuffer(this.pathwayStateBuffer, 0, new Float32Array([
            state.selectedNumericId, state.progress, state.pulseIntensity, state.blocked ? 1 : 0,
            color[0], color[1], color[2], state.selected ? 0.18 : 0,
        ]));
    };
}
