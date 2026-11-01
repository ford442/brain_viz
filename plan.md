1.  **Give `pulseSaturation` a render meaning in `src/shaders/soma-render.js`**.
    - Modify the soma fragment shader to use `uniforms.pulseSaturation`. I will scale the emissive core intensity and the sparkle intensity (as it relates to pulse saturation). I'll ensure it modifies the color dynamically based on its value.
2.  **Add a handler and mini-routine for `pulseSaturation`**.
    - I will add a new handler `pulse_saturation_surge` in `src/routine-handlers/neuromodulators.js` that lerps the `pulseSaturation` property up and back down.
    - I will add a mini-routine triggered by the `'q'` key to `src/mini-routines/part2.js` that triggers the `pulse_saturation_surge`.
3.  **Update `src/ui-legend-panel.js`**:
    - Add the `'q'` key to the legend, describing it as "Pulse Saturation Surge".
4.  **Update `src/ui-neuromodulator-panel.js`**:
    - Remove the `scope: 'unwired'` and `unwired: { text: 'not wired'... }` so it's a fully integrated visual parameter. Update the tooltip to describe the new visual effect.
5.  **Update `docs/ROADMAP.md`**:
    - Check off the `pulseSaturation` Open Items list indicating it now has a render meaning.
6.  **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
7.  **Submit the code changes.**
