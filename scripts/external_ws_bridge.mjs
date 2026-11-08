import { WebSocketServer } from 'ws';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
}));

const wsHost = options['ws-host'] || '127.0.0.1';
const wsPort = Number(options['ws-port'] || 8767);
const updateInterval = Number(options['interval'] || 100); // Send mocked data every 100ms by default

const webSockets = new WebSocketServer({ host: wsHost, port: wsPort });

console.log(`[External Bridge] Hosting Neuromodulation External API on WS ${wsHost}:${wsPort}`);

webSockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', version: 1, role: 'external_ingest' }));

    // If we wanted to accept real data from an external source and pipe it out to clients,
    // we would handle 'message' here or accept UDP data like openbci_ws_bridge.mjs.
    // For this minimal demo/bridge, we'll act as a mock telemetry server that broadcasts
    // a sine wave for alpha and stress, to prove the connection works.

    // In a real production deployment, you would pipe data from an OSC listener or UDP port
    // into this bridge, instead of mocking it inside the setInterval.
    const intervalId = setInterval(() => {
        if (socket.readyState !== 1) return;

        const time = performance.now() / 1000;
        const mockData = {
            channels: {
                alpha: (Math.sin(time) + 1.0) / 2.0,
                beta: (Math.cos(time * 0.8) + 1.0) / 2.0,
                stress: (Math.sin(time * 0.5) + 1.0) / 2.0,
                focus: (Math.sin(time * 1.2) + 1.0) / 2.0
            }
        };
        socket.send(JSON.stringify(mockData));
    }, updateInterval);

    socket.on('close', () => {
        clearInterval(intervalId);
    });

    socket.on('message', (message) => {
        try {
             // In the future we can accept OSC-formatted JSON here and broadcast it to clients
             const msgStr = message.toString('utf8');
             const data = JSON.parse(msgStr);

             if (data.type === 'ingest' && data.channels) {
                 // Broadcast to all other connected clients
                 for (const client of webSockets.clients) {
                    if (client !== socket && client.readyState === 1) {
                        client.send(JSON.stringify({ channels: data.channels }));
                    }
                 }
             }
        } catch (error) {
            console.error(`[External Bridge] Error parsing message: ${error.message}`);
        }
    });
});

webSockets.on('listening', () => {
    console.log(`[External Bridge] Running at ws://${wsHost}:${wsPort}`);
});

const shutdown = () => {
    webSockets.close();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
