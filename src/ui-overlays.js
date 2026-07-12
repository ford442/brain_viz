// ui-overlays.js
export function setupOverlays(player, filterOverlay, inputs, labels) {
    // [Phase 4] Narrative Overlay
    const narrative = document.createElement('div');
    narrative.id = 'narrative-overlay';
    Object.assign(narrative.style, {
        position: 'absolute',
        bottom: '15%',
        width: '100%',
        textAlign: 'center',
        color: 'rgba(200, 240, 255, 0.95)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '22px',
        letterSpacing: '1px',
        textShadow: '0 0 10px rgba(0,150,255,0.6), 0 0 40px rgba(0,100,200,0.3)',
        pointerEvents: 'none',
        transition: 'opacity 1.0s ease-in-out',
        opacity: '0',
        zIndex: '100'
    });
    const narrativeText = document.createElement('span');
    narrativeText.id = 'narrative-text';
    narrative.appendChild(narrativeText);
    const narrativeCursor = document.createElement('span');
    narrativeCursor.id = 'narrative-cursor';
    narrativeCursor.textContent = '|';
    narrativeCursor.style.color = '#00e5e5';
    narrativeCursor.style.fontWeight = '100';
    narrativeCursor.style.display = 'none';
    narrative.appendChild(narrativeCursor);
    document.body.appendChild(narrative);

    // [Phase 2] Interactive Visual Overlay Container
    const visualOverlay = document.createElement('div');
    visualOverlay.id = 'visual-overlay';
    Object.assign(visualOverlay.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 20, 40, 0.9)',
        border: '2px solid #00aaff',
        padding: '20px 40px',
        borderRadius: '10px',
        color: '#fff',
        fontFamily: 'monospace',
        textAlign: 'center',
        display: 'none',
        zIndex: '300',
        boxShadow: '0 0 20px rgba(0, 150, 255, 0.5)'
    });
    document.body.appendChild(visualOverlay);

    // Sync UI when routine executes events
    let narrativeTimeout = null;
    let typeInterval = null;

    player.onEvent = (event) => {
         if (event.type === 'choice') {
             if (event.choices) {
                 let html = `<h3>${event.message || 'Make a choice:'}</h3><div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">`;
                 event.choices.forEach((c, idx) => {
                     html += `<button id="choice-btn-${idx}" style="padding: 10px 20px; background: #0055aa; color: white; border: none; cursor: pointer; border-radius: 4px; font-family: monospace; font-size: 14px;">${c.text}</button>`;
                 });
                 html += `</div>`;

                 visualOverlay.innerHTML = html;
                 visualOverlay.style.display = 'block';

                 event.choices.forEach((c, idx) => {
                     const btn = document.getElementById(`choice-btn-${idx}`);
                     if (btn) {
                         btn.onmouseover = () => btn.style.background = '#0077ff';
                         btn.onmouseout = () => btn.style.background = '#0055aa';
                         btn.onclick = () => {
                             visualOverlay.style.display = 'none';

                             // Apply state updates if present
                             if (c.stateUpdates) {
                                 for (const [key, val] of Object.entries(c.stateUpdates)) {
                                     player.state[key] = val;
                                 }
                             }

                             // Execute branch if present
                             if (c.branch && player.subRoutines[c.branch]) {
                                 console.log(`[UI] Branching to: ${c.branch}`);
                                 // We use playNow which resets the current routine to the branch
                                 player.playNow(player.subRoutines[c.branch]);
                             } else {
                                 // Just resume if no branch
                                 player.resume();
                             }
                         };
                     }
                 });
             }
         }
         if (event.type === 'overlay') {
             if (event.content) {
                 visualOverlay.innerHTML = event.content;
                 visualOverlay.style.display = 'block';

                 if (event.interactive) {
                     player.pause();
                     const btn = document.createElement('button');
                     btn.textContent = event.buttonText || 'Continue';
                     Object.assign(btn.style, {
                         marginTop: '20px', padding: '10px 20px', background: '#0055aa',
                         color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px',
                         fontFamily: 'monospace', fontSize: '14px'
                     });
                     btn.onmouseover = () => btn.style.background = '#0077ff';
                     btn.onmouseout = () => btn.style.background = '#0055aa';
                     btn.onclick = () => {
                         visualOverlay.style.display = 'none';
                         player.resume();
                     };
                     visualOverlay.appendChild(btn);
                 } else if (event.duration) {
                     setTimeout(() => {
                         visualOverlay.style.display = 'none';
                     }, event.duration * 1000);
                 }
             } else {
                 visualOverlay.style.display = 'none';
             }
         }
         if (event.type === 'cssFilter') {
             if (event.filter) {
                 filterOverlay.applyFilter(event.filter);
             }
         }
         if (event.type === 'text') {
             if (event.message) {
                 // Simple Markdown parsing for bold, italic, and links
                 let htmlMessage = event.message
                     .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
                     .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
                     .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#00aaff;">$1</a>'); // Links

                 // Strip tags for typing
                 const tmp = document.createElement('div');
                 tmp.innerHTML = htmlMessage;
                 const plainText = tmp.textContent || '';

                 if (narrativeTimeout) clearTimeout(narrativeTimeout);
                 if (typeInterval) clearInterval(typeInterval);

                 narrative.style.opacity = '1';
                 narrativeText.textContent = '';
                 narrativeCursor.style.display = 'inline';

                 let i = 0;
                 const maxTypingTime = event.duration ? (event.duration * 1000) / 2 : Infinity;
                 const interval = plainText.length > 0 && maxTypingTime !== Infinity
                     ? Math.min(30, Math.floor(maxTypingTime / plainText.length))
                     : 30;

                 typeInterval = setInterval(() => {
                     i++;
                     narrativeText.textContent = plainText.substring(0, i);
                     if (i >= plainText.length) {
                         clearInterval(typeInterval);
                         typeInterval = null;
                         narrativeText.innerHTML = htmlMessage;
                         narrativeCursor.style.display = 'none';
                     }
                 }, interval);

                 // Optional: Auto-fade if duration is provided
                 if (event.duration) {
                     narrativeTimeout = setTimeout(() => {
                         narrative.style.opacity = '0';
                         narrativeTimeout = null;
                     }, event.duration * 1000);
                 }
             } else {
                 narrative.style.opacity = '0';
                 narrativeText.textContent = '';
                 narrativeCursor.style.display = 'none';
                 if (narrativeTimeout) {
                     clearTimeout(narrativeTimeout);
                     narrativeTimeout = null;
                 }
                 if (typeInterval) {
                     clearInterval(typeInterval);
                     typeInterval = null;
                 }
             }
         }
         if (event.type === 'param') {
             if (inputs[event.key]) inputs[event.key].value = event.value;
             if (labels[event.key]) labels[event.key].textContent = event.value.toFixed(2);
         }
         if (event.type === 'calm') {
             // Calm state modifies amplitude, frequency, smoothing
             // We should sync them if they are in the renderer params
             ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'cortisol', 'cognitiveLoad', 'fluidActive', 'fogDensity', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
                if (inputs[k]) inputs[k].value = player.renderer.params[k];
                if (labels[k]) labels[k].textContent = player.renderer.params[k].toFixed(2);
             });
         }
         if (event.type === 'reset') {
             // Reset might clear buffers but usually doesn't change params,
             // but if it did, we'd sync here.
         }
         if (event.type === 'speed') {
             const speedSlider = document.getElementById('routine-speed');
             const speedLabel = document.getElementById('routine-speed-label');
             if (speedSlider) speedSlider.value = event.value;
             if (speedLabel) speedLabel.textContent = `Speed: ${event.value.toFixed(1)}x`;
         }
    };

    return { narrative, narrativeText, narrativeCursor, visualOverlay };
}

