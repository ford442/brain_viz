// ui-training-panel.js — wires the Training tab (course picker, progress ring,
// live metric gauge, session history) to a TrainingEngine instance.
import { getHistory, clearHistory } from './training-engine.js';

function formatSeconds(s) {
    return `${s.toFixed(1)}s`;
}

function renderHistoryList(listEl) {
    const history = getHistory();
    if (history.length === 0) {
        listEl.innerHTML = '<div style="color:#556677;">No sessions yet.</div>';
        return;
    }
    listEl.innerHTML = history.map((entry) => {
        const stars = '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars);
        const status = entry.success ? stars : 'incomplete';
        const date = new Date(entry.date);
        const dateStr = isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
        return `<div>${dateStr} — <b>${entry.name}</b>: ${status}</div>`;
    }).join('');
}

export function setupTrainingPanel(trainingEngine) {
    const courseSelect = document.getElementById('training-course-select');
    const courseDesc = document.getElementById('training-course-desc');
    const btnStart = document.getElementById('btn-training-start');
    const btnStop = document.getElementById('btn-training-stop');
    const ring = document.getElementById('training-ring');
    const ringLabel = document.getElementById('training-ring-label');
    const objectiveLabel = document.getElementById('training-objective-label');
    const metricBar = document.getElementById('training-metric-bar');
    const metricVal = document.getElementById('training-metric-val');
    const streakVal = document.getElementById('val-training-streak');
    const bestVal = document.getElementById('val-training-best');
    const historyList = document.getElementById('training-history-list');
    const btnClearHistory = document.getElementById('btn-training-clear-history');

    if (!courseSelect) return; // Training tab not present in this DOM

    const syncDescription = () => {
        const course = trainingEngine.getCourse(courseSelect.value);
        if (courseDesc) courseDesc.textContent = course ? course.description : '';
    };

    const resetRing = () => {
        if (ring) ring.style.background = 'conic-gradient(#334455 0deg, #334455 360deg)';
        if (ringLabel) ringLabel.textContent = '--';
        if (objectiveLabel) objectiveLabel.textContent = 'No active course';
        if (metricBar) metricBar.style.width = '0%';
        if (metricVal) metricVal.textContent = 'value: -- · band: --';
        if (streakVal) streakVal.textContent = '0.0s';
        if (bestVal) bestVal.textContent = '0.0s';
    };

    courseSelect.addEventListener('change', syncDescription);
    syncDescription();
    renderHistoryList(historyList);

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            trainingEngine.startCourse(courseSelect.value);
        });
    }
    if (btnStop) {
        btnStop.addEventListener('click', () => {
            trainingEngine.stopCourse('manual');
        });
    }
    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', () => {
            clearHistory();
            renderHistoryList(historyList);
        });
    }

    trainingEngine.onEvent = (evt) => {
        if (evt.type === 'start') {
            if (courseSelect && courseSelect.value !== evt.course.id) {
                courseSelect.value = evt.course.id;
                syncDescription();
            }
            if (objectiveLabel) objectiveLabel.textContent = `${evt.course.name}: ${evt.course.objectives[0].label}`;
            return;
        }

        if (evt.type === 'progress') {
            const pct = Math.min(1, evt.holdTime / evt.objective.duration);
            const color = evt.inZone ? '#00e5e5' : '#ffaa00';
            if (ring) ring.style.background = `conic-gradient(${color} ${Math.round(pct * 360)}deg, #223344 ${Math.round(pct * 360)}deg)`;
            if (ringLabel) ringLabel.textContent = `${Math.round(pct * 100)}%`;
            if (objectiveLabel) {
                objectiveLabel.textContent = `${evt.course.name}: ${evt.objective.label} (${evt.objectiveIndex + 1}/${evt.course.objectives.length})`;
            }
            if (metricBar) {
                metricBar.style.width = `${Math.round(evt.value * 100)}%`;
                metricBar.style.background = color;
            }
            if (metricVal) {
                metricVal.textContent = `value: ${evt.value.toFixed(2)} · band: ${evt.band[0].toFixed(2)}–${evt.band[1].toFixed(2)}`;
            }
            if (streakVal) streakVal.textContent = formatSeconds(evt.streak);
            if (bestVal) bestVal.textContent = formatSeconds(evt.bestStreak);
            return;
        }

        if (evt.type === 'end') {
            if (objectiveLabel) {
                objectiveLabel.textContent = evt.success
                    ? `${evt.course.name} complete! ${'★'.repeat(evt.stars)}${'☆'.repeat(3 - evt.stars)}`
                    : `${evt.course.name}: session ended (${evt.reason || 'time limit'})`;
            }
            renderHistoryList(historyList);
        }
    };

    resetRing();
}
