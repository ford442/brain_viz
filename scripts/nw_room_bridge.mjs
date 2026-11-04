import { WebSocketServer } from 'ws';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
}));

const wsHost = options['ws-host'] || '127.0.0.1';
const wsPort = Number(options['ws-port'] || 8766);

const webSockets = new WebSocketServer({ host: wsHost, port: wsPort });
let sequence = 0;

webSockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', version: 1, role: 'host' }));

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Expected protocol: { type: 'stimulus'|'tensor'|'note', voxelDim, payload }
            if (!['stimulus', 'tensor', 'note'].includes(data.type)) {
                return;
            }

            // Broadcast to all other connected clients
            const broadcastMessage = JSON.stringify({
                ...data,
                sequence: sequence++,
                timestamp: performance.now()
            });

            for (const client of webSockets.clients) {
                if (client !== socket && client.readyState === 1) {
                    client.send(broadcastMessage);
                }
            }
        } catch (error) {
            console.error(`[NW Room Bridge] Error parsing message: ${error.message}`);
        }
    });
});

webSockets.on('listening', () => {
    console.log(`[NW Room Bridge] Collaborative Room Host running at ws://${wsHost}:${wsPort}`);
});

const shutdown = () => {
    webSockets.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
