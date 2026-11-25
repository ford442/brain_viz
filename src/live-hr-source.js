// [Neuro-Weaver] Bluetooth Heart Rate Profile; not a diagnostic measurement.
export class LiveHrSource {
    constructor(bluetooth = Reflect.get(globalThis.navigator || {}, 'bluetooth')) {
        this.bluetooth = bluetooth;
        this.features = ['hr', 'bpm'];
        this.hz = 30;
        this.status = 'Disconnected';
        this.onStatus = null;
        this.device = null;
        this.characteristic = null;
        this.bpm = 0;
        this.generation = 0;
        this.onMeasurement = (event) => {
            const value = event.target.value;
            if (!value || value.byteLength < 2) return;
            const wide = (value.getUint8(0) & 1) !== 0;
            if (wide && value.byteLength < 3) return;
            this.bpm = wide ? value.getUint16(1, true) : value.getUint8(1);
        };
        this.onDisconnect = () => this.disconnect();
    }

    setStatus(message) {
        this.status = message;
        this.onStatus?.(message);
    }

    async connect() {
        if (this.device) return;
        const generation = ++this.generation;
        this.setStatus('Connecting…');
        try {
            if (!this.bluetooth) throw new Error('Web Bluetooth is unavailable');
            const device = await this.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
            if (generation !== this.generation) return;
            this.device = device;
            device.addEventListener('gattserverdisconnected', this.onDisconnect);
            const server = await device.gatt.connect();
            if (generation !== this.generation) {
                if (server.connected) server.disconnect();
                return;
            }
            const service = await server.getPrimaryService('heart_rate');
            if (generation !== this.generation) return;
            const characteristic = await service.getCharacteristic('heart_rate_measurement');
            if (generation !== this.generation) return;
            this.characteristic = characteristic;
            characteristic.addEventListener('characteristicvaluechanged', this.onMeasurement);
            await characteristic.startNotifications();
            if (generation !== this.generation) {
                await characteristic.stopNotifications().catch(() => {});
                return;
            }
            this.setStatus(`Connected: ${device.name || 'Heart rate device'}`);
        } catch (error) {
            if (generation === this.generation) {
                this.disconnect();
                this.setStatus(`Heart rate: ${error instanceof Error ? error.message : String(error)}`);
            }
            throw error;
        }
    }

    sample() {
        return { bpm: this.bpm, hr: this.bpm ? Math.max(0, Math.min(1, (this.bpm - 40) / 140)) : 0 };
    }

    disconnect() {
        ++this.generation;
        this.characteristic?.removeEventListener('characteristicvaluechanged', this.onMeasurement);
        if (this.characteristic) this.characteristic.stopNotifications().catch(() => {});
        this.characteristic = null;
        if (this.device) {
            this.device.removeEventListener('gattserverdisconnected', this.onDisconnect);
            if (this.device.gatt.connected) this.device.gatt.disconnect();
        }
        this.device = null;
        this.bpm = 0;
        this.setStatus('Disconnected');
    }
}
