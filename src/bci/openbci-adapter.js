export class OpenBCIAdapter {
    constructor(url = 'ws://127.0.0.1:8765', { WebSocketImpl = globalThis.WebSocket } = {}) {
        this.url = url;
        this.WebSocketImpl = WebSocketImpl;
        this.type = 'openbci';
        this.name = 'OpenBCI';
        this.sampleRate = 250;
        this.channels = [];
        this.socket = null;
        this.onSamples = null;
        this.onStatus = null;
    }

    connect() {
        if (!this.WebSocketImpl) return Promise.reject(new Error('WebSocket is unavailable'));
        return new Promise((resolve, reject) => {
            let settled = false;
            const socket = new this.WebSocketImpl(this.url);
            this.socket = socket;
            socket.onopen = () => this.onStatus?.({ state: 'connected', message: 'OpenBCI bridge connected' });
            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
                    if (message.type === 'hello') {
                        if (message.version !== 1) throw new Error(`Unsupported OpenBCI bridge protocol: ${message.version}`);
                        this.name = message.board || 'OpenBCI';
                        this.sampleRate = message.sampleRate;
                        this.channels = message.channels;
                        if (!settled) { settled = true; resolve(); }
                    } else if (message.type === 'samples') {
                        if (!Array.isArray(message.data) || message.data.length !== this.channels.length) return;
                        this.onSamples?.({
                            source: 'openbci', deviceId: this.name, timestamp: message.timestamp,
                            sequence: message.sequence, sampleRate: this.sampleRate, channels: this.channels,
                            samples: message.data.map((values) => Float32Array.from(values)),
                            motion: message.motion || null, battery: null,
                        });
                    } else if (message.type === 'error') {
                        this.onStatus?.({ state: 'error', message: message.message });
                    }
                } catch (error) {
                    this.onStatus?.({ state: 'error', message: `Invalid bridge packet: ${error.message}` });
                }
            };
            socket.onerror = () => {
                const error = new Error(`Could not connect to OpenBCI bridge at ${this.url}`);
                if (!settled) { settled = true; reject(error); }
                this.onStatus?.({ state: 'error', message: error.message });
            };
            socket.onclose = () => {
                if (!settled) { settled = true; reject(new Error('OpenBCI bridge closed before handshake')); }
                this.onStatus?.({ state: 'disconnected', message: 'OpenBCI bridge disconnected' });
            };
        });
    }

    disconnect() {
        if (this.socket && this.socket.readyState < 2) this.socket.close();
        this.socket = null;
    }
}
