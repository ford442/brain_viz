import { WebSocketServer } from 'ws';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
}));

const wsHost = options['ws-host'] || '127.0.0.1';
const wsPort = Number(options['ws-port'] || 8766);
const voxelDim = Number(options['voxel-dim'] || 32);

const webSockets = new WebSocketServer({ host: wsHost, port: wsPort });
console.log(`[NW Room Bridge] Hosting Collaborative Room on WS ${wsHost}:${wsPort} (voxelDim=${voxelDim})`);

webSockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', version: 1, voxelDim }));

    socket.on('message', (message) => {
        try {
            const msgStr = message.toString('utf8');
            const data = JSON.parse(msgStr);
            if (!['stimulus', 'tensor', 'note'].includes(data.type)) return;

            // Reject mismatched voxelDim
            if (data.voxelDim !== undefined && data.voxelDim !== voxelDim) {
                socket.send(JSON.stringify({ type: 'error', version: 1, message: `Mismatched voxelDim: expected ${voxelDim}, got ${data.voxelDim}` }));
                return;
            }

            // Broadcast to all other connected clients
            for (const client of webSockets.clients) {
                if (client !== socket && client.readyState === 1) {
                    client.send(msgStr);
                }
            }
        } catch (error) {
            socket.send(JSON.stringify({ type: 'error', version: 1, message: error.message }));
        }
    });
});

const shutdown = () => {
    webSockets.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
