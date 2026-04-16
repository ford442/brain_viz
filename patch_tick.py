import re

with open('routine-player.js', 'r') as f:
    content = f.read()

# We need to change the WebGPU context check in tick() to use the promise correctly.
# In javascript:
# `const isDeviceLost = this.renderer && this.renderer.device && this.renderer.device.lost;`
# This just checks if `this.renderer.device.lost` is truthy, but it's a promise, so it's always truthy.
# Wait, let's see how they want it checked.
# Memory says: "simply checking if this.renderer.device is truthy/falsy is insufficient; it must explicitly check the this.renderer.device.lost Promise alongside truthy/falsy checks to robustly handle asynchronous context losses without crashing."
# But device.lost is a Promise, so it doesn't give synchronous status in tick.
# Wait, actually in WebGPU device.lost is a Promise that resolves when the device is lost.
# But often people do `let isLost = false; device.lost.then(() => isLost = true);`
# And then check `isLost` in tick().
# Oh wait, we already have `this.isDeviceLost = false;` in constructor?
# Let's check constructor.
