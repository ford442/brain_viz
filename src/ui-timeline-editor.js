// ui-timeline-editor.js
// Interactive Visual Timeline Editor for RoutinePlayer

export function setupTimelineEditor(player, container) {
    const btnEditor = document.createElement('button');
    btnEditor.textContent = 'Open Timeline Editor';
    btnEditor.dataset.tooltip = "Create and edit custom routines interactively";
    btnEditor.style.width = '100%';
    btnEditor.style.marginTop = '8px';
    btnEditor.style.padding = '6px 10px';
    btnEditor.style.background = '#2a1a3e';
    btnEditor.style.border = '1px solid #554466';
    btnEditor.style.borderRadius = '6px';
    btnEditor.style.color = '#ccaabb';
    btnEditor.style.cursor = 'pointer';

    container.appendChild(btnEditor);

    const editorModal = document.createElement('div');
    editorModal.style.position = 'fixed';
    editorModal.style.top = '10%';
    editorModal.style.left = '10%';
    editorModal.style.width = '80%';
    editorModal.style.height = '80%';
    editorModal.style.backgroundColor = 'rgba(10, 20, 30, 0.95)';
    editorModal.style.border = '2px solid #00e5e5';
    editorModal.style.zIndex = '1000';
    editorModal.style.display = 'none';
    editorModal.style.flexDirection = 'column';
    editorModal.style.color = '#fff';
    editorModal.style.fontFamily = 'monospace';
    editorModal.style.padding = '20px';
    editorModal.style.boxSizing = 'border-box';
    document.body.appendChild(editorModal);

    const editorHeader = document.createElement('h2');
    editorHeader.textContent = 'GUI Timeline Editor (WIP)';
    editorHeader.style.marginTop = '0';
    editorModal.appendChild(editorHeader);

    // Toolbar
    const editorControls = document.createElement('div');
    editorControls.style.display = 'flex';
    editorControls.style.gap = '10px';
    editorControls.style.marginBottom = '10px';
    editorModal.appendChild(editorControls);

    const btnAddEvent = document.createElement('button');
    btnAddEvent.textContent = '+ Add Event';
    editorControls.appendChild(btnAddEvent);

    const btnPlayEditor = document.createElement('button');
    btnPlayEditor.textContent = '▶ Play Routine';
    editorControls.appendChild(btnPlayEditor);

    const btnExport = document.createElement('button');
    btnExport.textContent = '💾 Export JSON';
    editorControls.appendChild(btnExport);

    const btnCloseEditor = document.createElement('button');
    btnCloseEditor.textContent = 'Close';
    btnCloseEditor.style.marginLeft = 'auto';
    editorControls.appendChild(btnCloseEditor);

    // Main layout: Timeline on left, Properties on right
    const editorBody = document.createElement('div');
    editorBody.style.display = 'flex';
    editorBody.style.flex = '1';
    editorBody.style.gap = '20px';
    editorBody.style.overflow = 'hidden';
    editorModal.appendChild(editorBody);

    // Left: Timeline Area
    const timelineContainer = document.createElement('div');
    timelineContainer.style.flex = '3';
    timelineContainer.style.border = '1px solid #444';
    timelineContainer.style.position = 'relative';
    timelineContainer.style.overflowX = 'auto';
    timelineContainer.style.overflowY = 'hidden';
    timelineContainer.style.backgroundColor = '#1a1a1a';
    editorBody.appendChild(timelineContainer);

    // The scrollable track inside the timeline container
    const timelineTrack = document.createElement('div');
    timelineTrack.style.position = 'relative';
    timelineTrack.style.height = '100%';
    timelineTrack.style.minWidth = '2000px'; // Arbitrary large width for scrolling
    timelineContainer.appendChild(timelineTrack);

    // Time Axis (Ruler)
    const timeAxis = document.createElement('div');
    timeAxis.style.position = 'absolute';
    timeAxis.style.top = '0';
    timeAxis.style.left = '0';
    timeAxis.style.right = '0';
    timeAxis.style.height = '30px';
    timeAxis.style.borderBottom = '1px solid #555';
    timeAxis.style.backgroundColor = '#222';
    timelineTrack.appendChild(timeAxis);

    // Add tick marks to time axis
    for (let i = 0; i < 100; i++) {
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = `${i * 100}px`; // 100px = 1 second
        tick.style.top = '0';
        tick.style.height = '100%';
        tick.style.borderLeft = '1px solid #555';
        tick.style.paddingLeft = '5px';
        tick.style.fontSize = '10px';
        tick.style.color = '#888';
        tick.textContent = `${i}s`;
        timeAxis.appendChild(tick);
    }

    // Playhead
    const playhead = document.createElement('div');
    playhead.style.position = 'absolute';
    playhead.style.top = '0';
    playhead.style.bottom = '0';
    playhead.style.width = '2px';
    playhead.style.backgroundColor = '#00e5e5';
    playhead.style.left = '0px';
    playhead.style.zIndex = '10';
    playhead.style.pointerEvents = 'none';
    timelineTrack.appendChild(playhead);

    // Right: Properties Panel
    const propertiesPanel = document.createElement('div');
    propertiesPanel.style.flex = '1';
    propertiesPanel.style.border = '1px solid #444';
    propertiesPanel.style.padding = '15px';
    propertiesPanel.style.backgroundColor = '#1a1a1a';
    propertiesPanel.style.display = 'flex';
    propertiesPanel.style.flexDirection = 'column';
    propertiesPanel.style.gap = '10px';
    editorBody.appendChild(propertiesPanel);

    const propertiesHeader = document.createElement('h3');
    propertiesHeader.textContent = 'Event Properties';
    propertiesHeader.style.marginTop = '0';
    propertiesPanel.appendChild(propertiesHeader);

    // Form inputs for Properties Panel
    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time (s):';
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.step = '0.1';
    timeInput.style.width = '100%';
    propertiesPanel.appendChild(timeLabel);
    propertiesPanel.appendChild(timeInput);

    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type:';
    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.style.width = '100%';
    propertiesPanel.appendChild(typeLabel);
    propertiesPanel.appendChild(typeInput);

    const paramsLabel = document.createElement('label');
    paramsLabel.textContent = 'Parameters (JSON):';
    const paramsInput = document.createElement('textarea');
    paramsInput.style.width = '100%';
    paramsInput.style.flex = '1';
    paramsInput.style.resize = 'none';
    paramsInput.style.fontFamily = 'monospace';
    propertiesPanel.appendChild(paramsLabel);
    propertiesPanel.appendChild(paramsInput);

    const btnRemove = document.createElement('button');
    btnRemove.textContent = 'Remove Event';
    btnRemove.style.marginTop = '10px';
    btnRemove.style.backgroundColor = '#662222';
    btnRemove.style.color = 'white';
    btnRemove.style.border = 'none';
    btnRemove.style.padding = '8px';
    btnRemove.style.cursor = 'pointer';
    propertiesPanel.appendChild(btnRemove);

    // --- State and Interaction Logic ---
    let editingRoutine = [];
    let selectedEventIndex = -1;
    let isDragging = false;
    let draggedEventIndex = -1;
    const PIXELS_PER_SECOND = 100;

    function getColorForType(type) {
        const colors = {
            'camera': '#00e5e5',
            'style': '#ffaa00',
            'lerp': '#ff00aa',
            'text': '#aaff00',
            'sound': '#00aaff',
            'stimulus': '#ff5555'
        };
        return colors[type] || '#888888';
    }

    function renderTimeline() {
        // Clear existing events, but keep timeAxis and playhead
        const children = Array.from(timelineTrack.children);
        children.forEach(child => {
            if (child !== timeAxis && child !== playhead) {
                timelineTrack.removeChild(child);
            }
        });

        editingRoutine.forEach((evt, idx) => {
            const eventBlock = document.createElement('div');
            eventBlock.style.position = 'absolute';
            eventBlock.style.left = `${evt.time * PIXELS_PER_SECOND}px`;
            eventBlock.style.top = '40px'; // Below time axis
            eventBlock.style.width = '80px';
            eventBlock.style.height = '30px';
            eventBlock.style.backgroundColor = getColorForType(evt.type);
            eventBlock.style.border = idx === selectedEventIndex ? '2px solid white' : '1px solid black';
            eventBlock.style.borderRadius = '4px';
            eventBlock.style.color = 'black';
            eventBlock.style.fontSize = '12px';
            eventBlock.style.display = 'flex';
            eventBlock.style.alignItems = 'center';
            eventBlock.style.justifyContent = 'center';
            eventBlock.style.cursor = 'grab';
            eventBlock.style.userSelect = 'none';
            eventBlock.textContent = evt.type;
            eventBlock.title = JSON.stringify(evt, null, 2);

            // Stacking to prevent overlaps (simple approach)
            eventBlock.style.marginTop = `${(idx % 5) * 35}px`;

            // Interactions
            eventBlock.onmousedown = (e) => {
                e.stopPropagation();
                selectedEventIndex = idx;
                isDragging = true;
                draggedEventIndex = idx;
                eventBlock.style.cursor = 'grabbing';
                populatePropertiesPanel();
                renderTimeline(); // Re-render to show selection border
            };

            timelineTrack.appendChild(eventBlock);
        });
    }

    function populatePropertiesPanel() {
        if (selectedEventIndex >= 0 && selectedEventIndex < editingRoutine.length) {
            const evt = editingRoutine[selectedEventIndex];
            timeInput.value = evt.time;
            typeInput.value = evt.type;
            const { time, type, ...params } = evt;
            paramsInput.value = JSON.stringify(params, null, 2);
            timeInput.disabled = false;
            typeInput.disabled = false;
            paramsInput.disabled = false;
            btnRemove.disabled = false;
        } else {
            timeInput.value = '';
            typeInput.value = '';
            paramsInput.value = '';
            timeInput.disabled = true;
            typeInput.disabled = true;
            paramsInput.disabled = true;
            btnRemove.disabled = true;
        }
    }

    // Property Panel Edit Listeners
    timeInput.onchange = (e) => {
        if (selectedEventIndex >= 0) {
            editingRoutine[selectedEventIndex].time = Math.max(0, parseFloat(e.target.value) || 0);
            renderTimeline();
            syncRoutineToPlayer();
        }
    };
    typeInput.onchange = (e) => {
        if (selectedEventIndex >= 0) {
            editingRoutine[selectedEventIndex].type = e.target.value;
            renderTimeline();
            syncRoutineToPlayer();
        }
    };
    paramsInput.onchange = (e) => {
        if (selectedEventIndex >= 0) {
            try {
                const parsed = JSON.parse(e.target.value);
                const evt = editingRoutine[selectedEventIndex];
                Object.keys(evt).forEach(k => {
                    if (k !== 'time' && k !== 'type') delete evt[k];
                });
                Object.assign(evt, parsed);
                renderTimeline();
                syncRoutineToPlayer();
            } catch (err) {
                alert('Invalid JSON parameters');
            }
        }
    };

    btnRemove.onclick = () => {
        if (selectedEventIndex >= 0) {
            editingRoutine.splice(selectedEventIndex, 1);
            selectedEventIndex = -1;
            populatePropertiesPanel();
            renderTimeline();
            syncRoutineToPlayer();
        }
    };

    btnAddEvent.onclick = () => {
        const newTime = player.elapsedTime || 0;
        editingRoutine.push({ time: newTime, type: 'text', message: 'New Event' });
        selectedEventIndex = editingRoutine.length - 1;
        populatePropertiesPanel();
        renderTimeline();
        syncRoutineToPlayer();
    };

    // Timeline Dragging and Scrubbing
    timelineTrack.onmousemove = (e) => {
        if (isDragging && draggedEventIndex >= 0) {
            const rect = timelineTrack.getBoundingClientRect();
            const x = e.clientX - rect.left + timelineContainer.scrollLeft;
            const newTime = Math.max(0, x / PIXELS_PER_SECOND);
            editingRoutine[draggedEventIndex].time = parseFloat(newTime.toFixed(1));
            timeInput.value = editingRoutine[draggedEventIndex].time;
            renderTimeline();
        }
    };

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            draggedEventIndex = -1;
            editingRoutine.sort((a, b) => a.time - b.time);
            // Update selected index after sort
            const selectedEvt = editingRoutine[selectedEventIndex];
            if (selectedEvt) {
                selectedEventIndex = editingRoutine.indexOf(selectedEvt);
            }
            renderTimeline();
            syncRoutineToPlayer();
        }
    });

    // Scrubbing
    timeAxis.onmousedown = (e) => {
        const rect = timelineTrack.getBoundingClientRect();
        const x = e.clientX - rect.left + timelineContainer.scrollLeft;
        const newTime = Math.max(0, x / PIXELS_PER_SECOND);
        player.elapsedTime = newTime;
        playhead.style.left = `${newTime * PIXELS_PER_SECOND}px`;
    };

    // Continuous Sync with Player (Phase 4)
    let syncAnimationFrame = null;

    function syncPlayhead() {
        if (editorModal.style.display === 'flex' && player) {
            playhead.style.left = `${(player.elapsedTime || 0) * PIXELS_PER_SECOND}px`;
        }
        syncAnimationFrame = requestAnimationFrame(syncPlayhead);
    }

    // Start the sync loop
    syncAnimationFrame = requestAnimationFrame(syncPlayhead);

    // Sync back to player seamlessly
    function syncRoutineToPlayer() {
        if (!player) return;
        const routineToPlay = JSON.parse(JSON.stringify(editingRoutine));
        routineToPlay.sort((a, b) => a.time - b.time);
        // Safely update player without stopping active playback if possible
        const wasPlaying = player.isPlaying;
        const currentElapsed = player.elapsedTime;
        player.loadRoutine(routineToPlay, player.loop);
        player.elapsedTime = currentElapsed;
        if (wasPlaying) {
            player.play();
        }
    }


    // Playback integration handled in Phase 4, but wire buttons here
    btnPlayEditor.onclick = () => {
        // Deep copy
        const routineToPlay = JSON.parse(JSON.stringify(editingRoutine));
        routineToPlay.sort((a, b) => a.time - b.time);

        // Use loadRoutine + play to update state without breaking existing playNow behavior
        player.loadRoutine(routineToPlay, false);
        player.play();
    };

    btnExport.onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(editingRoutine, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "custom_routine.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    btnEditor.onclick = () => {
        editingRoutine = JSON.parse(JSON.stringify(player.routine.length > 0 ? player.routine : []));
        selectedEventIndex = -1;
        populatePropertiesPanel();
        renderTimeline();
        editorModal.style.display = 'flex';
    };

    btnCloseEditor.onclick = () => {
        editorModal.style.display = 'none';
    };
}
