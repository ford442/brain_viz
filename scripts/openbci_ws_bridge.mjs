import dgram from 'node:dgram';
import { WebSocketServer } from 'ws';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
}));
const board = options.board === 'cyton-daisy' ? 'cyton-daisy' : 'cyton';
const channelCount = board === 'cyton-daisy' ? 16 : 8;
const sampleRate = Number(options['sample-rate'] || (board === 'cyton-daisy' ? 125 : 250));
const udpHost = options['udp-host'] || '127.0.0.1';
const udpPort = Number(options['udp-port'] || 12345);
const wsHost = options['ws-host'] || '127.0.0.1';
const wsPort = Number(options['ws-port'] || 8765);
const channels = Array.from({ length: channelCount }, (_, index) => `CH${index + 1}`);
let sequence = 0;

const webSockets = new WebSocketServer({ host: wsHost, port: wsPort });
webSockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', version: 1, board, sampleRate, channels }));
});

const udp = dgram.createSocket('udp4');
udp.on('message', (packet) => {
    try {
        const input = JSON.parse(packet.toString('utf8'));
        if (!['timeSeriesRaw', 'timeSeriesFilt'].includes(input.type)) return;
        if (!Array.isArray(input.data) || input.data.length < channelCount) throw new Error(`Expected ${channelCount} channels`);
        const data = input.data.slice(0, channelCount).map((values) => values.map(Number));
        const message = JSON.stringify({
            type: 'samples', version: 1, sequence: sequence++, timestamp: performance.now(), data,
        });
        for (const client of webSockets.clients) if (client.readyState === 1) client.send(message);
    } catch (error) {
        const message = JSON.stringify({ type: 'error', version: 1, message: error.message });
        for (const client of webSockets.clients) if (client.readyState === 1) client.send(message);
    }
});
udp.bind(udpPort, udpHost, () => {
    console.log(`[OpenBCI Bridge] UDP ${udpHost}:${udpPort} -> WS ${wsHost}:${wsPort} (${board}, ${sampleRate} Hz)`);
});

const shutdown = () => {
    udp.close();
    webSockets.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
