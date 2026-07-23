export function registerBciHandlers(handlers, player) {
    handlers.set('bci_connect', (event) => {
        const session = player.bciSession;
        if (!session) {
            console.warn('[BCI Routine] BCI session is unavailable');
            return;
        }
        const successSignal = event.successSignal || 'bci_connected';
        if (event.required !== false) player.waitingForSignal = successSignal;
        session.requestConnection?.({ adapter: event.adapter || 'muse', url: event.url });
    });

    handlers.set('bci_threshold', (event) => {
        const session = player.bciSession;
        if (!session || !event.metric || !Number.isFinite(event.value)) {
            console.warn('[BCI Routine] bci_threshold requires an active session, metric, and numeric value');
            return;
        }
        const successSignal = event.successSignal || `bci_threshold_${event.metric}`;
        const timeoutSignal = event.timeoutSignal || `${successSignal}_timeout`;
        player.waitingForSignal = successSignal;
        session.watchThreshold(event, (result) => {
            player.state.bciThreshold = { metric: event.metric, ...result };
            if (result.success) player.triggerSignal(successSignal);
            else {
                player.waitingForSignal = timeoutSignal;
                player.triggerSignal(timeoutSignal);
            }
        });
    });

    handlers.set('bci_record', (event) => {
        const session = player.bciSession;
        if (!session) return;
        if (event.action === 'start') session.startRecording(event.name);
        else if (event.action === 'stop') session.stopRecording();
        else console.warn("[BCI Routine] bci_record action must be 'start' or 'stop'");
    });
}
