export class Tensor {
    constructor(data, shape) {
        if (!(data instanceof Float32Array)) {
            throw new Error("Data must be a Float32Array");
        }
        if (!Array.isArray(shape) || shape.some(d => !Number.isInteger(d) || d <= 0)) {
            throw new Error("Shape must be an array of positive integers");
        }

        const shapeSize = shape.reduce((a, b) => a * b, 1);
        if (data.length !== shapeSize) {
            throw new Error(`Data length (${data.length}) does not match shape size (${shapeSize})`);
        }

        this.data = data;
        this.shape = shape;
    }

    get size() {
        return this.data.length;
    }

    reshape(newShape) {
        if (!Array.isArray(newShape) || newShape.some(d => !Number.isInteger(d) || d <= 0)) {
            throw new Error("New shape must be an array of positive integers");
        }
        const newSize = newShape.reduce((a, b) => a * b, 1);
        if (newSize !== this.size) {
            throw new Error(`New shape size (${newSize}) does not match current size (${this.size})`);
        }
        return new Tensor(this.data, newShape);
    }

    normalize(min = 0, max = 1) {
        const currentMin = this.data.reduce((a, b) => Math.min(a, b), Infinity);
        const currentMax = this.data.reduce((a, b) => Math.max(a, b), -Infinity);

        if (currentMin === currentMax) {
             // Avoid division by zero if all values are the same. Return a tensor of mins.
             const newData = new Float32Array(this.size).fill(min);
             return new Tensor(newData, this.shape);
        }

        const range = currentMax - currentMin;
        const targetRange = max - min;

        const newData = new Float32Array(this.size);
        for(let i = 0; i < this.size; i++) {
            newData[i] = min + ((this.data[i] - currentMin) / range) * targetRange;
        }

        return new Tensor(newData, this.shape);
    }
}
