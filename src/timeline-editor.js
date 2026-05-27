export class TimelineEditor {
    constructor(player) {
        this.player = player;
        this.editingRoutine = [];
        this.modal = null;
        this.eventList = null;
        this.timelineTrack = null;
        this.playhead = null;
        this.animationFrameId = null;
        this.isDragging = false;
        this.dragEventIndex = -1;

        this.initDOM();
    }

    initDOM() {
        this.modal = document.createElement('div');
        this.modal.style.position = 'fixed';
        this.modal.style.top = '10%';
        this.modal.style.left = '10%';
        this.modal.style.width = '80%';
        this.modal.style.height = '80%';
        this.modal.style.backgroundColor = 'rgba(10, 20, 30, 0.95)';
        this.modal.style.border = '2px solid #00e5e5';
        this.modal.style.zIndex = '1000';
        this.modal.style.display = 'none';
        this.modal.style.flexDirection = 'column';
        this.modal.style.color = '#fff';
        this.modal.style.fontFamily = 'monospace';
        this.modal.style.padding = '20px';
        this.modal.style.boxSizing = 'border-box';
        document.body.appendChild(this.modal);

        const header = document.createElement('h2');
        header.textContent = 'GUI Timeline Editor';
        header.style.marginTop = '0';
        this.modal.appendChild(header);

        // Timeline Container
        const timelineContainer = document.createElement('div');
        timelineContainer.style.height = '150px';
        timelineContainer.style.backgroundColor = '#111';
        timelineContainer.style.border = '1px solid #444';
        timelineContainer.style.marginBottom = '20px';
        timelineContainer.style.position = 'relative';
        timelineContainer.style.overflowX = 'auto';
        timelineContainer.style.overflowY = 'hidden';
        this.modal.appendChild(timelineContainer);

        // Track inside the container
        this.timelineTrack = document.createElement('div');
        this.timelineTrack.style.height = '100%';
        this.timelineTrack.style.position = 'relative';
        this.timelineTrack.style.width = '2000px'; // Initial large width, updated dynamically
        this.timelineTrack.style.minWidth = '100%';
        timelineContainer.appendChild(this.timelineTrack);

        // Playhead
        this.playhead = document.createElement('div');
        this.playhead.style.position = 'absolute';
        this.playhead.style.top = '0';
        this.playhead.style.bottom = '0';
        this.playhead.style.width = '2px';
        this.playhead.style.backgroundColor = '#ff0055';
        this.playhead.style.zIndex = '100';
        this.playhead.style.pointerEvents = 'none';
        this.timelineTrack.appendChild(this.playhead);

        // Event List (Raw Editor)
        this.eventList = document.createElement('div');
        this.eventList.style.flex = '1';
        this.eventList.style.overflowY = 'auto';
        this.eventList.style.marginBottom = '10px';
        this.eventList.style.border = '1px solid #444';
        this.eventList.style.padding = '10px';
        this.modal.appendChild(this.eventList);

        // Controls
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        this.modal.appendChild(controls);

        const btnAdd = document.createElement('button');
        btnAdd.textContent = '+ Add Event';
        btnAdd.onclick = () => this.addEvent();
        controls.appendChild(btnAdd);

        const btnPlay = document.createElement('button');
        btnPlay.textContent = '▶ Play Routine';
        btnPlay.onclick = () => this.playRoutine();
        controls.appendChild(btnPlay);

        const btnExport = document.createElement('button');
        btnExport.textContent = '💾 Export JSON';
        btnExport.onclick = () => this.exportJSON();
        controls.appendChild(btnExport);

        const btnClose = document.createElement('button');
        btnClose.textContent = 'Close';
        btnClose.style.marginLeft = 'auto';
        btnClose.onclick = () => this.close();
        controls.appendChild(btnClose);

        // Timeline interaction
        this.timelineTrack.addEventListener('mousedown', (e) => this.onTimelineMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onTimelineMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onTimelineMouseUp(e));
    }

    getTimelineDuration() {
        let maxTime = 10;
        for (const evt of this.editingRoutine) {
            const end = evt.time + (evt.duration || 1);
            if (end > maxTime) maxTime = end;
        }
        return Math.max(maxTime + 5, 20); // Add padding
    }

    timeToPixels(time) {
        const duration = this.getTimelineDuration();
        if (!this._cachedWidth || Math.abs(this._cachedWidth - this.timelineTrack.parentElement.clientWidth) > 5) {
            this._cachedWidth = Math.max(this.timelineTrack.parentElement.clientWidth, 2000);
            this.timelineTrack.style.width = this._cachedWidth + 'px';
        }
        return (time / duration) * this._cachedWidth;
    }

    pixelsToTime(px) {
        const duration = this.getTimelineDuration();
        const width = this.timelineTrack.clientWidth;
        return (px / width) * duration;
    }

    open() {
        this.editingRoutine = JSON.parse(JSON.stringify(this.player.routine.length > 0 ? this.player.routine : []));
        this.render();
        this.modal.style.display = 'flex';
        this.updatePlayhead();
    }

    close() {
        this.modal.style.display = 'none';
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    addEvent() {
        this.editingRoutine.push({ time: 0, type: 'text', message: 'New Event' });
        this.render();
    }

    playRoutine() {
        this.player.playNow(JSON.parse(JSON.stringify(this.editingRoutine)));
    }

    exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.editingRoutine, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", "custom_routine.json");
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    render() {
        this.editingRoutine.sort((a, b) => a.time - b.time);
        this.renderTimeline();
        this.renderEventList();
    }

    getColorForType(type) {
        switch (type) {
            case 'camera': return '#4CAF50';
            case 'lerp': return '#2196F3';
            case 'style': return '#9C27B0';
            case 'sound': return '#FF9800';
            case 'text': return '#607D8B';
            default: return '#795548';
        }
    }

    renderTimeline() {
        // Clear track except playhead
        Array.from(this.timelineTrack.children).forEach(child => {
            if (child !== this.playhead) child.remove();
        });

        this.editingRoutine.forEach((evt, idx) => {
            const block = document.createElement('div');
            const left = this.timeToPixels(evt.time);
            const durationPx = this.timeToPixels(evt.duration || 1);

            block.style.position = 'absolute';
            block.style.left = left + 'px';
            block.style.top = '20px';
            block.style.width = Math.max(durationPx, 10) + 'px';
            block.style.height = '40px';
            block.style.backgroundColor = this.getColorForType(evt.type);
            block.style.borderRadius = '4px';
            block.style.border = '1px solid rgba(255,255,255,0.5)';
            block.style.cursor = 'grab';
            block.style.color = '#fff';
            block.style.fontSize = '12px';
            block.style.padding = '2px 4px';
            block.style.boxSizing = 'border-box';
            block.style.overflow = 'hidden';
            block.style.whiteSpace = 'nowrap';
            block.style.textOverflow = 'ellipsis';
            block.textContent = evt.type;

            block.dataset.index = idx;

            // Simple drag handling is registered on parent for wider area, but we can do it here too
            block.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // prevent parent from handling
                this.isDragging = true;
                this.dragEventIndex = idx;
                block.style.cursor = 'grabbing';
            });

            this.timelineTrack.appendChild(block);
        });
    }

    onTimelineMouseDown(e) {
        // Seeking if clicked empty space
        const rect = this.timelineTrack.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newTime = this.pixelsToTime(x);
        if (this.player) {
            this.player.elapsedTime = newTime;
        }
    }

    onTimelineMouseMove(e) {
        if (!this.isDragging || this.dragEventIndex === -1) return;

        const rect = this.timelineTrack.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, x);
        const newTime = this.pixelsToTime(x);

        this.editingRoutine[this.dragEventIndex].time = parseFloat(newTime.toFixed(1));

        // Re-render blocks instantly while dragging
        this.renderTimeline();
    }

    onTimelineMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragEventIndex = -1;
            this.render(); // Re-sort and render list
        }
    }

    updatePlayhead() {
        if (this.modal.style.display !== 'none' && this.player) {
            const x = this.timeToPixels(this.player.elapsedTime);
            this.playhead.style.left = x + 'px';
        }
        this.animationFrameId = requestAnimationFrame(() => this.updatePlayhead());
    }

    renderEventList() {
        this.eventList.innerHTML = '';
        this.editingRoutine.forEach((evt, idx) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '10px';
            row.style.marginBottom = '5px';
            row.style.alignItems = 'center';

            const timeInput = document.createElement('input');
            timeInput.type = 'number';
            timeInput.step = '0.1';
            timeInput.value = evt.time;
            timeInput.style.width = '60px';
            timeInput.onchange = (e) => {
                evt.time = parseFloat(e.target.value);
                this.render();
            };

            const typeInput = document.createElement('input');
            typeInput.type = 'text';
            typeInput.value = evt.type;
            typeInput.style.width = '100px';
            typeInput.onchange = (e) => {
                evt.type = e.target.value;
                this.render();
            };

            const paramsInput = document.createElement('input');
            paramsInput.type = 'text';
            paramsInput.style.flex = '1';

            const params = { ...evt };
            delete params.time;
            delete params.type;
            paramsInput.value = JSON.stringify(params);

            paramsInput.onchange = (e) => {
                try {
                    const parsed = JSON.parse(e.target.value);
                    // clear old params
                    Object.keys(evt).forEach(k => {
                        if (k !== 'time' && k !== 'type') delete evt[k];
                    });
                    Object.assign(evt, parsed);
                    this.renderTimeline(); // in case duration changed
                } catch (err) {
                    alert('Invalid JSON params');
                }
            };

            const btnRemove = document.createElement('button');
            btnRemove.textContent = 'X';
            btnRemove.onclick = () => {
                this.editingRoutine.splice(idx, 1);
                this.render();
            };

            row.appendChild(timeInput);
            row.appendChild(typeInput);
            row.appendChild(paramsInput);
            row.appendChild(btnRemove);
            this.eventList.appendChild(row);
        });
    }
}
