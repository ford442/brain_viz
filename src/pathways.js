const BRAIN_RANGE = 1.6;
const VOXEL_MAX = 31;

export const PATHWAYS = Object.freeze({
    'mesocorticolimbic-dopamine': Object.freeze({
        id: 'mesocorticolimbic-dopamine',
        numericId: 1,
        name: 'Mesocorticolimbic dopamine pathway',
        transmitter: 'dopamine',
        color: Object.freeze([1.0, 0.68, 0.12]),
        defaultPulseDuration: 3,
        schematic: true,
        landmarks: Object.freeze({
            vta: Object.freeze({ label: 'VTA', voxel: Object.freeze([16, 10, 14]) }),
            nacLeft: Object.freeze({ label: 'Nucleus accumbens (left)', voxel: Object.freeze([12, 13, 19]) }),
            nacRight: Object.freeze({ label: 'Nucleus accumbens (right)', voxel: Object.freeze([19, 13, 19]) }),
            pfcLeft: Object.freeze({ label: 'Prefrontal cortex (left)', voxel: Object.freeze([11, 17, 26]) }),
            pfcRight: Object.freeze({ label: 'Prefrontal cortex (right)', voxel: Object.freeze([20, 17, 26]) }),
        }),
        edges: Object.freeze([
            Object.freeze({ id: 'vta-nac-left', numericId: 1, source: 'vta', target: 'nacLeft', branch: 'mesolimbic' }),
            Object.freeze({ id: 'vta-nac-right', numericId: 2, source: 'vta', target: 'nacRight', branch: 'mesolimbic' }),
            Object.freeze({ id: 'vta-pfc-left', numericId: 3, source: 'vta', target: 'pfcLeft', branch: 'mesocortical' }),
            Object.freeze({ id: 'vta-pfc-right', numericId: 4, source: 'vta', target: 'pfcRight', branch: 'mesocortical' }),
        ]),
    }),
});

export const DOPAMINE_PATHWAY_DEMO = Object.freeze([
    { time: 0.0, type: 'style', value: 2 },
    { time: 0.0, type: 'param', key: 'lesionActive', value: 0 },
    { time: 0.0, type: 'pathway_block', pathway: 'mesocorticolimbic-dopamine', blocked: false },
    { time: 0.2, type: 'text', message: 'VTA dopamine projections: mesolimbic and mesocortical branches', duration: 3.5 },
    { time: 1.0, type: 'pathway_pulse', pathway: 'mesocorticolimbic-dopamine', duration: 3, intensity: 1 },
    { time: 7.0, type: 'stroke_lesion', target: { pathway: 'mesocorticolimbic-dopamine', edge: 'vta-pfc-left' }, intensity: 1, radius: 0.28, duration: 0.5 },
    { time: 8.0, type: 'text', message: 'Stroke mask suppresses the intersecting branch locally', duration: 3.5 },
    { time: 10.0, type: 'pathway_pulse', pathway: 'mesocorticolimbic-dopamine', duration: 3, intensity: 1 },
    { time: 16.0, type: 'pathway_block', pathway: 'mesocorticolimbic-dopamine', blocked: true },
    { time: 16.2, type: 'pathway_pulse', pathway: 'mesocorticolimbic-dopamine', duration: 3, intensity: 1 },
    { time: 16.2, type: 'text', message: 'Whole-path block suppresses static and pulsed emission', duration: 3.5 },
    { time: 22.0, type: 'pathway_block', pathway: 'mesocorticolimbic-dopamine', blocked: false },
    { time: 22.0, type: 'param', key: 'lesionActive', value: 0 },
    { time: 22.2, type: 'text', message: 'Pathway and lesion masks cleared', duration: 3.0 },
    { time: 25.5, type: 'debug', message: 'Mesocorticolimbic dopamine demo complete' },
]);

export function voxelToWorld(voxel) {
    return voxel.map((value) => ((value / VOXEL_MAX) * 2 - 1) * BRAIN_RANGE);
}

function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
}

function buildPolylineSampler(points) {
    const lengths = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const length = distance(points[i], points[i + 1]);
        lengths.push(length);
        total += length;
    }
    return (t) => {
        const target = t * total;
        let traversed = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (target <= traversed + lengths[i] || i === lengths.length - 1) {
                const local = lengths[i] > 0 ? (target - traversed) / lengths[i] : 0;
                return points[i].map((value, axis) => value + (points[i + 1][axis] - value) * local);
            }
            traversed += lengths[i];
        }
        return points[points.length - 1];
    };
}

function prepareCenterline(centerline, index) {
    const sample = buildPolylineSampler(centerline.pts);
    const samples = Array.from({ length: 13 }, (_, sampleIndex) => sample(sampleIndex / 12));
    const tangents = samples.slice(0, -1).map((point, sampleIndex) => normalize(
        samples[sampleIndex + 1].map((value, axis) => value - point[axis])
    ));
    return { centerline, index, samples, tangents };
}

function scoreOrientation(candidate, source, target, reversed) {
    const samples = reversed ? [...candidate.samples].reverse() : candidate.samples;
    const tangents = reversed
        ? [...candidate.tangents].reverse().map((tangent) => tangent.map((value) => -value))
        : candidate.tangents;
    const edgeVector = target.map((value, axis) => value - source[axis]);
    const edgeDirection = normalize(edgeVector);
    const endpointScore = distance(samples[0], source) + distance(samples[12], target);
    let sampleScore = 0;
    let tangentPenalty = 0;
    for (let i = 0; i < 13; i++) {
        const t = i / 12;
        const expected = source.map((value, axis) => value + edgeVector[axis] * t);
        sampleScore += distance(samples[i], expected);
        if (i < 12) {
            const tangent = tangents[i];
            tangentPenalty += 1 - Math.max(0, tangent[0] * edgeDirection[0] + tangent[1] * edgeDirection[1] + tangent[2] * edgeDirection[2]);
        }
    }
    return endpointScore * 2.5 + sampleScore / 13 + tangentPenalty / 12;
}

function projectProgress(position, points, reversed) {
    const oriented = reversed ? [...points].reverse() : points;
    let total = 0;
    const lengths = [];
    for (let i = 0; i < oriented.length - 1; i++) {
        const length = distance(oriented[i], oriented[i + 1]);
        lengths.push(length);
        total += length;
    }
    let bestDistance = Infinity;
    let bestProgress = 0;
    let traversed = 0;
    for (let i = 0; i < lengths.length; i++) {
        const a = oriented[i];
        const b = oriented[i + 1];
        const ab = b.map((value, axis) => value - a[axis]);
        const denom = lengths[i] * lengths[i] || 1;
        const local = Math.max(0, Math.min(1, ((position[0] - a[0]) * ab[0] + (position[1] - a[1]) * ab[1] + (position[2] - a[2]) * ab[2]) / denom));
        const closest = a.map((value, axis) => value + ab[axis] * local);
        const candidateDistance = distance(position, closest);
        if (candidateDistance < bestDistance) {
            bestDistance = candidateDistance;
            bestProgress = total > 0 ? (traversed + lengths[i] * local) / total : 0;
        }
        traversed += lengths[i];
    }
    return bestProgress;
}

export function buildPathwayMetadata(centerlines, fiberPositions) {
    const metadata = new Float32Array((fiberPositions.length / 3) * 4);
    const selections = [];
    const used = new Set();
    const preparedCenterlines = centerlines.map(prepareCenterline);

    for (const pathway of Object.values(PATHWAYS)) {
        for (const edge of pathway.edges) {
            const source = voxelToWorld(pathway.landmarks[edge.source].voxel);
            const target = voxelToWorld(pathway.landmarks[edge.target].voxel);
            const candidates = preparedCenterlines
                .map((prepared) => {
                    const { centerline, index } = prepared;
                    if (centerline.bundleId >= 100 || !centerline.vertexCount) return null;
                    const forward = scoreOrientation(prepared, source, target, false);
                    const reverse = scoreOrientation(prepared, source, target, true);
                    return { centerline, index, score: Math.min(forward, reverse), reversed: reverse < forward };
                })
                .filter(Boolean)
                .sort((a, b) => a.score - b.score || a.index - b.index);
            const selected = [];
            for (const candidate of candidates) {
                if (used.has(candidate.index)) continue;
                used.add(candidate.index);
                selected.push(candidate);
                if (selected.length === 3) break;
            }

            selected.forEach((candidate, rank) => {
                const { centerline } = candidate;
                const weight = Math.max(0.35, (1 / (1 + candidate.score * 0.35)) * (1 - rank * 0.08));
                for (let vertex = centerline.vertexStart; vertex < centerline.vertexStart + centerline.vertexCount; vertex++) {
                    const position = [fiberPositions[vertex * 3], fiberPositions[vertex * 3 + 1], fiberPositions[vertex * 3 + 2]];
                    metadata[vertex * 4] = pathway.numericId;
                    metadata[vertex * 4 + 1] = edge.numericId;
                    metadata[vertex * 4 + 2] = projectProgress(position, centerline.pts, candidate.reversed);
                    metadata[vertex * 4 + 3] = weight;
                }
                selections.push({
                    pathwayId: pathway.id,
                    edgeId: edge.id,
                    edgeNumericId: edge.numericId,
                    branch: edge.branch,
                    centerlineIndex: candidate.index,
                    score: candidate.score,
                    weight,
                    reversed: candidate.reversed,
                    vertexStart: centerline.vertexStart,
                    vertexCount: centerline.vertexCount,
                    samplePosition: buildPolylineSampler(candidate.reversed ? [...centerline.pts].reverse() : centerline.pts)(0.5),
                });
            });
        }
    }
    return { metadata, selections };
}
