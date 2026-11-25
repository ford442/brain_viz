import dgram from 'node:dgram';
import { WebSocketServer } from 'ws';

// UDP JSON: { t?: number, channels: { name: finiteNumber, ... } }.
// Legacy type: 'external' is accepted; other types are ignored. Names must
// match CHANNEL_NAME and not be constructor/prototype. Limits: 16 KiB per
// packet, 64 channels, values within +/-1e6, and finite t within
// +/-Number.MAX_SAFE_INTEGER. Invalid packets emit an error envelope.
const MAX_PACKET_BYTES = 16 * 1024;
const MAX_CHANNELS = 64;
const MAX_CHANNEL_VALUE = 1e6;
const CHANNEL_NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const RESERVED_NAMES = new Set(['constructor', 'prototype']);

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
        if (packet.length > MAX_PACKET_BYTES) throw new Error('UDP packet too large');
        const input = JSON.parse(packet.toString('utf8'));
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a JSON object');
        if (input.type !== undefined && input.type !== 'external') return;
        if (input.t !== undefined && (typeof input.t !== 'number' || !Number.isFinite(input.t) || Math.abs(input.t) > Number.MAX_SAFE_INTEGER)) {
            throw new Error('Invalid timestamp');
        }
        if (!input.channels || typeof input.channels !== 'object' || Array.isArray(input.channels)) throw new Error('Expected a channels object');
        const entries = Object.entries(input.channels);
        if (entries.length > MAX_CHANNELS) throw new Error('Too many channels');
        for (const [name, value] of entries) {
            if (!CHANNEL_NAME.test(name) || RESERVED_NAMES.has(name) ||
                typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_CHANNEL_VALUE) {
                throw new Error('Invalid channel');
            }
        }
        broadcast(JSON.stringify({
            type: 'external',
            version: 1,
            sequence: sequence++,
            timestamp: performance.now(),
            ...(input.t === undefined ? {} : { t: input.t }),
            channels: input.channels
        }));
    } catch (error) {
        broadcast(JSON.stringify({ type: 'error', version: 1, message: error instanceof SyntaxError ? 'Invalid JSON' : error.message }));
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
