// [Phase 8] Data Integration: CSV Parser for RoutinePlayer
// Parses either a CSV event list (time,type,...) or an fMRI-style time-series
// (time,region1,region2,...) into a routine event array.

export function parseRoutineCSV(text, regions) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
        console.error("[Routine] CSV must have header and at least one row.");
        return [];
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1);
    const routine = [];

    // Detect Format
    if (header.includes('type')) {
        console.log("[Routine] Detected CSV Event List format.");
        // Format: time, type, key, value, duration, ease, message, target, intensity
        rows.forEach(row => {
            const cols = row.split(',').map(c => c.trim());
            const event = {};

            header.forEach((h, i) => {
                if (cols[i] !== undefined && cols[i] !== '') {
                    // Type inference
                    if (h === 'time' || h === 'duration' || h === 'intensity') {
                        event[h] = parseFloat(cols[i]);
                    } else if (h === 'value') {
                         const f = parseFloat(cols[i]);
                         event[h] = isNaN(f) ? cols[i] : f;
                    } else {
                        event[h] = cols[i];
                    }
                }
            });

            if (event.time !== undefined && event.type) {
                routine.push(event);
            }
        });
    } else {
        console.log("[Routine] Detected CSV Time-Series format (fMRI).");
        // Format: time, region1, region2...
        // Check which headers map to regions
        const regionIndices = {};
        header.forEach((h, i) => {
            // Check if header matches a known region
            const knownRegions = regions ? Object.keys(regions) : [];
            if (knownRegions.includes(h) || ['frontal', 'parietal', 'occipital', 'temporal', 'deep'].includes(h)) {
                regionIndices[i] = h;
            }
        });

        rows.forEach(row => {
            const cols = row.split(',').map(c => c.trim());
            const timeIndex = header.indexOf('time');
            if (timeIndex === -1) return;

            const time = parseFloat(cols[timeIndex]);

            if (!isNaN(time)) {
                Object.keys(regionIndices).forEach(idx => {
                    const val = parseFloat(cols[idx]);
                    if (!isNaN(val) && val > 0.05) { // Threshold
                         routine.push({
                             time: time,
                             type: 'stimulus',
                             target: regionIndices[idx],
                             intensity: val * 5.0 // Scale for visibility (0.2 -> 1.0)
                         });
                    }
                });
            }
        });
    }

    return routine.sort((a, b) => a.time - b.time);
}
