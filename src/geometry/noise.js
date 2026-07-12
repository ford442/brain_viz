export function applyNoiseMethods(Target) {
    Target.prototype.saturate = function(v) {
        return Math.max(0.0, Math.min(1.0, v));
    };

    Target.prototype.random = function() {
        this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
        return this.randomState / 4294967296;
    };

    Target.prototype.hash3 = function(ix, iy, iz) {
        let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + this.seed * 1447) | 0;
        h = (h ^ (h >> 13)) * 1274126177;
        h ^= h >> 16;
        return ((h >>> 0) / 4294967295) * 2.0 - 1.0;
    };

    Target.prototype.smoothNoise3 = function(x, y, z) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;
        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uy = fy * fy * (3.0 - 2.0 * fy);
        const uz = fz * fz * (3.0 - 2.0 * fz);

        const n000 = this.hash3(ix, iy, iz);
        const n100 = this.hash3(ix + 1, iy, iz);
        const n010 = this.hash3(ix, iy + 1, iz);
        const n110 = this.hash3(ix + 1, iy + 1, iz);
        const n001 = this.hash3(ix, iy, iz + 1);
        const n101 = this.hash3(ix + 1, iy, iz + 1);
        const n011 = this.hash3(ix, iy + 1, iz + 1);
        const n111 = this.hash3(ix + 1, iy + 1, iz + 1);

        const nx00 = n000 + (n100 - n000) * ux;
        const nx10 = n010 + (n110 - n010) * ux;
        const nx01 = n001 + (n101 - n001) * ux;
        const nx11 = n011 + (n111 - n011) * ux;
        const nxy0 = nx00 + (nx10 - nx00) * uy;
        const nxy1 = nx01 + (nx11 - nx01) * uy;
        return nxy0 + (nxy1 - nxy0) * uz;
    };

    Target.prototype.fbm3 = function(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
        let amplitude = 0.5;
        let frequency = 1.0;
        let sum = 0.0;
        let norm = 0.0;
        for (let i = 0; i < octaves; i++) {
    sum += this.smoothNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
        }
        return norm > 0.0 ? sum / norm : 0.0;
    };

}
