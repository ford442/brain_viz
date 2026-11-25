// [Neuro-Weaver] Web MIDI values are shared by all channels and inputs.
export class LiveMidiSource {
    constructor(requestAccess = () => navigator.requestMIDIAccess()) {
        this.requestAccess = requestAccess;
        this.features = [...Array.from({ length: 128 }, (_, i) => `cc${i}`), 'note'];
        this.hz = 60;
        this.status = 'Disconnected';
        this.onStatus = null;
        this.access = null;
        /** @type {Map<MIDIInput, {cc: Map<number, {value:number, order:number}>, notes: Map<string, {value:number, order:number}>, handler: (event: MIDIMessageEvent) => void}>} */
        this.inputs = new Map();
        this.sequence = 0;
        this.generation = 0;
    }

    setStatus(message) {
        this.status = message;
        this.onStatus?.(message);
    }

    async connect() {
        if (this.access) return;
        const generation = ++this.generation;
        this.setStatus('Connecting…');
        try {
            const access = await this.requestAccess();
            if (generation !== this.generation) return;
            this.access = access;
            access.onstatechange = () => this.syncInputs();
            this.syncInputs();
        } catch (error) {
            if (generation === this.generation) this.setStatus(`MIDI: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    syncInputs() {
        if (!this.access) return;
        const active = new Set();
        for (const input of this.access.inputs.values()) {
            if (input.state === 'disconnected') continue;
            active.add(input);
            if (this.inputs.has(input)) continue;
            const state = { cc: new Map(), notes: new Map(), handler: (event) => this.handleMessage(state, event.data) };
            input.addEventListener('midimessage', state.handler);
            this.inputs.set(input, state);
        }
        for (const [input, state] of this.inputs) {
            if (active.has(input)) continue;
            input.removeEventListener('midimessage', state.handler);
            this.inputs.delete(input);
        }
        this.setStatus(this.inputs.size ? `Connected (${this.inputs.size} MIDI input${this.inputs.size === 1 ? '' : 's'})` : 'Waiting for MIDI input');
    }

    handleMessage(state, data) {
        if (!data || data.length < 3 || data[1] > 127 || data[2] > 127) return;
        const command = data[0] & 0xf0;
        if (command === 0xb0) {
            state.cc.set(data[1], { value: data[2] / 127, order: ++this.sequence });
        } else if (command === 0x90 && data[2] > 0) {
            state.notes.set(`${data[0] & 15}:${data[1]}`, { value: data[2] / 127, order: ++this.sequence });
        } else if (command === 0x80 || command === 0x90) {
            state.notes.delete(`${data[0] & 15}:${data[1]}`);
        }
    }

    sample() {
        const result = Object.fromEntries(this.features.map((feature) => [feature, 0]));
        const latest = new Map();
        for (const state of this.inputs.values()) {
            for (const [cc, entry] of state.cc) {
                const key = `cc${cc}`;
                if (!latest.has(key) || latest.get(key).order < entry.order) latest.set(key, entry);
            }
            for (const entry of state.notes.values()) {
                if (!latest.has('note') || latest.get('note').order < entry.order) latest.set('note', entry);
            }
        }
        for (const [key, entry] of latest) result[key] = entry.value;
        return result;
    }

    disconnect() {
        ++this.generation;
        if (this.access) this.access.onstatechange = null;
        for (const [input, state] of this.inputs) input.removeEventListener('midimessage', state.handler);
        this.inputs.clear();
        this.access = null;
        this.setStatus('Disconnected');
    }
}
