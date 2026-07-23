const SERVICE_UUID = 0xfe8d;
const UUID_BASE = (id) => `273e${id}-4c4d-454d-96be-f03bac821358`;
const CONTROL_UUID = UUID_BASE('0001');
const SENSOR_UUID = UUID_BASE('0013');
const BATTERY_UUID = UUID_BASE('000b');
const ACCEL_UUID = UUID_BASE('000a');
const CLASSIC_EEG = Object.freeze({
    TP9: UUID_BASE('0003'), AF7: UUID_BASE('0004'), AF8: UUID_BASE('0005'),
    TP10: UUID_BASE('0006'), AUX: UUID_BASE('0007'),
});
const ATHENA_CHANNELS = Object.freeze({
    4: ['TP9', 'AF7', 'AF8', 'TP10'],
    8: ['TP9', 'AF7', 'AF8', 'TP10', 'FPz', 'AUX_R', 'AUX_L', 'CH8'],
});
const ATHENA_CONFIG = Object.freeze({
    0x11: { type: 'eeg', channels: 4, samples: 4, length: 28 },
    0x12: { type: 'eeg', channels: 8, samples: 2, length: 28 },
    0x47: { type: 'motion', channels: 6, samples: 3, length: 36 },
    0x34: { type: 'ignore', length: 30 },
    0x35: { type: 'ignore', length: 40 },
    0x36: { type: 'ignore', length: 40 },
    0x88: { type: 'ignore', length: 188 },
    0x98: { type: 'ignore', length: 20 },
});

function valueBytes(value) {
    return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength);
}

export function encodeMuseCommand(command) {
    const text = new TextEncoder().encode(command);
    const result = new Uint8Array(text.length + 2);
    result[0] = text.length + 1;
    result.set(text, 1);
    result[result.length - 1] = 0x0a;
    return result;
}

export function decodeClassicEEG(value) {
    const bytes = value instanceof Uint8Array ? value : valueBytes(value);
    const payload = bytes.subarray(2);
    const samples = new Float32Array(Math.floor(payload.length * 2 / 3));
    let output = 0;
    for (let i = 0; i + 2 < payload.length; i += 3) {
        const first = (payload[i] << 4) | (payload[i + 1] >> 4);
        const second = ((payload[i + 1] & 0x0f) << 8) | payload[i + 2];
        samples[output++] = 0.48828125 * (first - 0x800);
        samples[output++] = 0.48828125 * (second - 0x800);
    }
    return samples;
}

function unpackLSB14(bytes, count) {
    const output = new Float32Array(count);
    let bitOffset = 0;
    for (let valueIndex = 0; valueIndex < count; valueIndex++) {
        let value = 0;
        for (let bit = 0; bit < 14; bit++, bitOffset++) {
            if ((bytes[bitOffset >> 3] >> (bitOffset & 7)) & 1) value |= 1 << bit;
        }
        output[valueIndex] = value * (1450 / 16383);
    }
    return output;
}

export function decodeAthenaEEG(bytes, channelCount) {
    const sampleCount = channelCount === 4 ? 4 : 2;
    const values = unpackLSB14(bytes.subarray(0, 28), sampleCount * channelCount);
    const channels = Array.from({ length: channelCount }, () => new Float32Array(sampleCount));
    for (let sample = 0; sample < sampleCount; sample++) {
        for (let channel = 0; channel < channelCount; channel++) {
            channels[channel][sample] = values[sample * channelCount + channel];
        }
    }
    return channels;
}

export class MuseAdapter {
    constructor({ bluetooth = globalThis.navigator?.bluetooth, device = null } = {}) {
        this.bluetooth = bluetooth;
        this.device = device;
        this.type = 'muse';
        this.name = 'Muse';
        this.protocol = null;
        this.sampleRate = 256;
        this.channels = [];
        this.battery = null;
        this.onSamples = null;
        this.onStatus = null;
        this.sequence = 0;
        this.latestMotion = null;
        this.characteristics = [];
        this.control = null;
        this._disconnectHandler = () => {
            this.onStatus?.({ state: 'disconnected', message: 'Muse connection lost' });
        };
    }

    async connect() {
        if (!this.bluetooth && !this.device) throw new Error('Web Bluetooth is unavailable in this browser');
        if (!globalThis.isSecureContext && globalThis.location?.hostname !== 'localhost' && !this.device) {
            throw new Error('Web Bluetooth requires HTTPS or localhost');
        }
        if (!this.device) {
            this.device = await this.bluetooth.requestDevice({
                filters: [{ services: [SERVICE_UUID] }],
                optionalServices: [SERVICE_UUID],
            });
        }
        this.name = this.device.name || 'Muse';
        this.device.addEventListener?.('gattserverdisconnected', this._disconnectHandler);
        const server = await this.device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const all = service.getCharacteristics ? await service.getCharacteristics() : [];
        const byUuid = new Map(all.map((characteristic) => [characteristic.uuid.toLowerCase(), characteristic]));
        const get = async (uuid) => byUuid.get(uuid) || service.getCharacteristic(uuid);
        this.control = await get(CONTROL_UUID);
        await this._subscribe(this.control, () => {});

        let sensor = byUuid.get(SENSOR_UUID);
        if (!sensor) {
            try { sensor = await service.getCharacteristic(SENSOR_UUID); } catch { sensor = null; }
        }
        if (sensor) await this._connectAthena(sensor);
        else await this._connectClassic(get);
        this.onStatus?.({
            state: 'connected', protocol: this.protocol, device: this.name,
            sampleRate: this.sampleRate, channels: this.channels, battery: this.battery,
        });
    }

    async disconnect() {
        if (this.control) await this._send('h').catch(() => {});
        for (const characteristic of this.characteristics) {
            await characteristic.stopNotifications?.().catch?.(() => {});
        }
        this.characteristics = [];
        this.device?.removeEventListener?.('gattserverdisconnected', this._disconnectHandler);
        if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    }

    async _connectClassic(get) {
        this.protocol = 'classic';
        this.channels = ['TP9', 'AF7', 'AF8', 'TP10'];
        for (const [channel, uuid] of Object.entries(CLASSIC_EEG)) {
            try {
                const characteristic = await get(uuid);
                await this._subscribe(characteristic, (event) => {
                    const data = decodeClassicEEG(event.target.value);
                    this.onSamples?.({
                        source: 'muse', deviceId: this.device.id, timestamp: performance.now(),
                        sequence: this.sequence++, sampleRate: 256, channels: [channel], samples: [data],
                        motion: this.latestMotion, battery: this.battery,
                    });
                });
            } catch (error) {
                if (channel !== 'AUX') throw error;
            }
        }
        try {
            const accel = await get(ACCEL_UUID);
            await this._subscribe(accel, (event) => this._decodeClassicMotion(event.target.value));
        } catch (error) { console.warn('[BCI] Muse accelerometer unavailable', error); }
        try {
            const battery = await get(BATTERY_UUID);
            await this._subscribe(battery, (event) => {
                this.battery = event.target.value.getUint16(2) / 512;
            });
        } catch (error) { console.warn('[BCI] Muse battery unavailable', error); }
        await this._send('h');
        await this._send('p50');
        await this._send('s');
        await this._send('d');
    }

    async _connectAthena(sensor) {
        this.protocol = 'athena';
        this.channels = [...ATHENA_CHANNELS[4]];
        await this._subscribe(sensor, (event) => this._decodeAthenaPayload(valueBytes(event.target.value)));
        for (const command of ['v6', 's', 'h', 'p21', 's', 'dc001', 'L1', 'h', 'p1034', 's', 'dc001', 'L1']) {
            await this._send(command);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }

    _decodeClassicMotion(value) {
        const view = value instanceof DataView ? value : new DataView(value.buffer, value.byteOffset, value.byteLength);
        if (view.byteLength < 8) return;
        const offset = view.byteLength >= 20 ? 14 : 2;
        this.latestMotion = {
            x: view.getInt16(offset, false) * 0.0000610352,
            y: view.getInt16(offset + 2, false) * 0.0000610352,
            z: view.getInt16(offset + 4, false) * 0.0000610352,
        };
    }

    _decodeAthenaPayload(payload) {
        if (payload.length < 15) return;
        const firstTag = payload[9];
        let offset = 14;
        let tag = firstTag;
        while (offset < payload.length) {
            const config = ATHENA_CONFIG[tag];
            if (!config || offset + config.length > payload.length) break;
            const data = payload.subarray(offset, offset + config.length);
            if (config.type === 'eeg') {
                const samples = decodeAthenaEEG(data, config.channels);
                this.channels = [...ATHENA_CHANNELS[config.channels]];
                this.onSamples?.({
                    source: 'muse', deviceId: this.device.id, timestamp: performance.now(),
                    sequence: this.sequence++, sampleRate: 256, channels: this.channels, samples,
                    motion: this.latestMotion, battery: this.battery,
                });
            } else if (config.type === 'motion') {
                const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                this.latestMotion = {
                    x: view.getInt16(0, true) * 0.0000610352,
                    y: view.getInt16(2, true) * 0.0000610352,
                    z: view.getInt16(4, true) * 0.0000610352,
                };
            }
            offset += config.length;
            if (offset + 5 > payload.length) break;
            tag = payload[offset];
            offset += 5;
        }
    }

    async _subscribe(characteristic, handler) {
        characteristic.addEventListener?.('characteristicvaluechanged', handler);
        characteristic.oncharacteristicvaluechanged = handler;
        await characteristic.startNotifications();
        this.characteristics.push(characteristic);
    }

    async _send(command) {
        if (!this.control) return;
        const bytes = encodeMuseCommand(command);
        if (this.control.writeValueWithoutResponse) await this.control.writeValueWithoutResponse(bytes);
        else await this.control.writeValue(bytes);
    }
}
