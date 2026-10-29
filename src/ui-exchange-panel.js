export function setupExchangePanel(player) {
    const btnExport = document.getElementById('btn-exchange-export');
    const btnImport = document.getElementById('btn-exchange-import');
    const importFile = document.getElementById('exchange-import-file');
    const librarySelect = document.getElementById('exchange-library-select');
    const btnLoadBundled = document.getElementById('btn-exchange-load-bundled');

    if (!btnExport || !btnImport || !importFile || !librarySelect || !btnLoadBundled) {
        return;
    }

    // Export current routine
    btnExport.addEventListener('click', () => {
        if (!player || !player.routine) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(player.routine, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `neuro-routine-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Trigger file dialog
    btnImport.addEventListener('click', () => {
        importFile.click();
    });

    // Handle file selection
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (player) {
                    player.loadRoutine(parsed, false);
                    if (!player.isPlaying) {
                        player.play();
                    }
                }
            } catch (err) {
                console.error("[Exchange] Failed to parse routine JSON:", err);
                alert("Invalid routine JSON file.");
            }
        };
        reader.readAsText(file);
        // Clear input to allow re-uploading the same file
        e.target.value = '';
    });

    // Load bundled routine
    btnLoadBundled.addEventListener('click', () => {
        const selected = librarySelect.value;
        if (!selected || !player) return;

        player.loadRoutineFromFile('/routines/' + selected, false).then(() => {
            if (!player.isPlaying) {
                player.play();
            }
        }).catch(err => {
            console.error(`[Exchange] Failed to load bundled routine ${selected}:`, err);
            alert(`Failed to load ${selected}`);
        });
    });
}
