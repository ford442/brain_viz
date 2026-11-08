import dgram from 'node:dgram';
import { WebSocketServer } from 'ws';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
}));

const udpHost = options['udp-host'] || '127.0.0.1';
const udpPort = Number(options['udp-port'] || 12347);
const wsHost = options['ws-host'] || '127.0.0.1';
const wsPort = Number(options['ws-port'] || 8767);
let sequence = 0;

const webSockets = new WebSocketServer({ host: wsHost, port: wsPort });
webSockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', version: 1, role: 'external-bridge' }));
});

const broadcast = (message) => {
    for (const client of webSockets.clients) {
        if (client.readyState === 1) client.send(message);
    }
};

const udp = dgram.createSocket('udp4');
udp.on('message', (packet) => {
    try {
        const input = JSON.parse(packet.toString('utf8'));
        if (input.type !== 'external') return;
        broadcast(JSON.stringify({
            type: 'external',
            version: 1,
            sequence: sequence++,
            timestamp: performance.now(),
            channels: input.channels || {}
        }));
    } catch (error) {
        broadcast(JSON.stringify({ type: 'error', version: 1, message: error.message }));
    }
});

udp.bind(udpPort, udpHost, () => {
    console.log(`[Neuromodulation External API Bridge] UDP ${udpHost}:${udpPort} -> WS ${wsHost}:${wsPort}`);
});

const shutdown = () => {
    udp.close();
    webSockets.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);