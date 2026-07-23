import { BUILTIN_PATTERNS } from './tensor-player.js';
import { BCISession } from './bci/bci-session.js';
import { MuseAdapter } from './bci/muse-adapter.js';
import { OpenBCIAdapter } from './bci/openbci-adapter.js';
import { REGION_NAMES } from './bci/tensor-resampler.js';

const byId = (id) => document.getElementById(id);

export function setupBciPanel(renderer, controls, tensorPlayer, player) {
    const session = new BCISession(renderer, tensorPlayer);
    const source = byId('bci-device-source');
    const urlRow = byId('bci-openbci-url-row');
    const status = byId('bci-device-status');
    const qualityBar = byId('bar-bci-quality');
    const qualityValue = byId('val-bci-quality');
    const bands = byId('bci-band-values');
    const channelQuality = byId('bci-channel-quality');
    const mapping = byId('bci-channel-mapping');
    const calibrationStatus = byId('bci-calibration-status');
    const download = byId('btn-bci-download');
    let recordingBlob = null;
    let calibrationTimer = null;

    const activateTab = () => document.querySelector('.tab-btn[data-tab="tab-bci"]')?.click();
    const renderMapping = () => {
        mapping.innerHTML = '';
        for (const [channel, region] of Object.entries(session.mapping)) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:5px;align-items:center;margin:3px 0;font-size:10px;';
            const label = document.createElement('span');
            label.textContent = channel;
            label.style.width = '48px';
            const select = document.createElement('select');
            select.style.flex = '1';
            for (const name of REGION_NAMES) select.add(new Option(name, name));
            select.value = region;
            select.addEventListener('change', () => session.setMapping(channel, select.value));
            row.append(label, select);
            mapping.appendChild(row);
        }
    };

    const connectSelected = async () => {
        const selected = source.value;
        const button = byId('btn-bci-connect');
        button.disabled = true;
        try {
            const adapter = selected === 'muse'
                ? new MuseAdapter()
                : new OpenBCIAdapter(byId('bci-openbci-url').value.trim());
            await session.connect(adapter, { mappingId: selected });
            renderMapping();
            player?.triggerSignal('bci_connected');
        } catch (error) {
            console.warn('[BCI] Connection failed', error);
            session._setStatus({ state: 'error', message: error.message });
            if (player?.waitingForSignal === 'bci_connected') player.waitingForSignal = 'bci_connection_failed';
            player?.triggerSignal('bci_connection_failed');
        } finally {
            button.disabled = false;
        }
    };

    session.requestConnection = ({ adapter = 'muse', url } = {}) => {
        source.value = adapter === 'openbci' ? 'cyton' : 'muse';
        if (url) byId('bci-openbci-url').value = url;
        source.dispatchEvent(new Event('change'));
        activateTab();
        if (adapter === 'openbci') return connectSelected();
        session._setStatus({ state: 'permission', message: 'Click Scan / Connect to grant Muse access' });
        return Promise.resolve(false);
    };

    session.onStatus = (next) => {
        status.textContent = `${next.message || next.state}${next.protocol ? ` · ${next.protocol}` : ''}${next.battery != null ? ` · ${Math.round(next.battery)}% battery` : ''}`;
        status.dataset.state = next.state;
    };
    session.onFeatures = (features) => {
        const percent = Math.round(features.quality * 100);
        qualityValue.textContent = `${percent}%`;
        qualityBar.style.width = `${percent}%`;
        qualityBar.style.background = percent >= 70 ? '#00dd88' : percent >= 40 ? '#ffcc44' : '#ff5566';
        bands.textContent = `α ${features.bands.alpha.toFixed(2)} · β ${features.bands.beta.toFixed(2)} · γ ${features.bands.gamma.toFixed(2)} · ${session.updateRate} Hz`;
        channelQuality.textContent = Object.entries(features.channels)
            .map(([name, value]) => `${name} ${Math.round(value.quality * 100)}%`).join(' · ');
    };

    source.addEventListener('change', () => {
        urlRow.style.display = source.value === 'muse' ? 'none' : 'block';
        session.mappingId = source.value;
        const presets = source.value === 'muse' ? 'muse' : source.value;
        session.mapping = session._loadMapping(presets,
            presets === 'muse' ? session.resampler.mapping : {});
        renderMapping();
    });
    byId('btn-bci-connect').addEventListener('click', connectSelected);
    byId('btn-bci-disconnect').addEventListener('click', () => session.disconnect());
    byId('btn-bci-reset-mapping').addEventListener('click', () => { session.resetMapping(); renderMapping(); });

    byId('btn-bci-calibrate').addEventListener('click', () => {
        if (calibrationTimer) return;
        let elapsed = 0;
        session.startCalibration('neutral');
        calibrationStatus.textContent = 'Eyes open · 10s';
        calibrationTimer = setInterval(() => {
            elapsed++;
            if (elapsed === 10) {
                session.startCalibration('relaxed');
            }
            calibrationStatus.textContent = elapsed < 10
                ? `Eyes open · ${10 - elapsed}s`
                : `Eyes closed · ${20 - elapsed}s`;
            if (elapsed >= 20) {
                clearInterval(calibrationTimer);
                calibrationTimer = null;
                session.finishCalibration();
                calibrationStatus.textContent = 'Calibration complete';
            }
        }, 1000);
    });

    byId('btn-bci-record').addEventListener('click', async () => {
        await session.startRecording();
        recordingBlob = null;
        download.disabled = true;
    });
    byId('btn-bci-record-stop').addEventListener('click', async () => {
        recordingBlob = await session.stopRecording();
        download.disabled = !recordingBlob;
    });
    download.addEventListener('click', () => {
        if (!recordingBlob) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(recordingBlob);
        link.download = `${session.recordingName || 'neuro-weaver-bci'}-${new Date().toISOString().replace(/[:.]/g, '-')}.nwbci`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
    byId('bci-replay-file').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) await session.replay(file, { realtime: false });
    });

    const patternSelect = byId('bci-pattern');
    const loadPattern = async (id) => {
        const pattern = BUILTIN_PATTERNS.find((entry) => entry.id === id);
        if (!pattern) return;
        await session.disconnect();
        tensorPlayer.loadFrames(await Promise.resolve(pattern.generate(tensorPlayer)));
        tensorPlayer.play();
    };
    byId('btn-bci-play').addEventListener('click', () => {
        if (tensorPlayer.isPlaying) tensorPlayer.pause();
        else if (tensorPlayer.totalFrames) tensorPlayer.play();
        else loadPattern(patternSelect.value || 'alpha-waves');
    });
    byId('btn-bci-pause').addEventListener('click', () => tensorPlayer.pause());
    byId('btn-bci-stop').addEventListener('click', () => tensorPlayer.stop());
    patternSelect.addEventListener('change', () => patternSelect.value && loadPattern(patternSelect.value));
    byId('bci-speed').addEventListener('input', (event) => {
        tensorPlayer.setSpeed(Number(event.target.value));
        byId('val-bci-speed').textContent = `${Number(event.target.value).toFixed(1)}×`;
    });
    byId('bci-scrubber').addEventListener('input', (event) => tensorPlayer.seek(Number(event.target.value)));
    tensorPlayer.onFrameChange = (frame, total) => {
        byId('bci-frame-label').textContent = `${frame}/${total}`;
        byId('bci-scrubber').max = Math.max(1, total - 1);
        byId('bci-scrubber').value = frame;
    };
    byId('bci-tensor-file').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const frames = file.name.endsWith('.npy') ? await tensorPlayer.loadNPY(file)
            : file.name.endsWith('.csv') ? await tensorPlayer.loadCSVSeries(file)
            : await tensorPlayer.loadBinary(file);
        tensorPlayer.loadFrames(frames);
        tensorPlayer.play();
    });

    renderMapping();
    window.__bciDebug = {
        getState: () => ({ ...session.status, source: session.source, updateRate: session.updateRate,
            tensorUpdateCount: session.tensorUpdateCount, features: session.latestFeatures, mapping: session.mapping }),
        session,
        connect: connectSelected,
        disconnect: () => session.disconnect(),
        replay: (recording) => session.replay(recording),
    };
    if (player) player.bciSession = session;
    return session;
}
