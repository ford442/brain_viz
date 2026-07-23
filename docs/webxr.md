# WebXR Immersive Mode

Neuro-Weaver can present the WebGL2 renderer through an immersive WebXR session. The normal WebGPU renderer remains the authoritative desktop path; XR uses WebGL2 because the interoperable WebXR composition surface is `XRWebGLLayer`.

## Requirements

- A browser and headset exposing `navigator.xr` with `immersive-vr` or `immersive-ar` support.
- HTTPS, except for browser-supported localhost development exemptions.
- The WebGL2 renderer. Open `?renderer=webgl`, or use **XR → Switch to WebGL2 for XR**.
- A user click on **Enter VR** or **Tabletop AR**. Browsers do not allow an immersive session to start automatically.

## Controls

| Input | Action |
|---|---|
| Headset movement | Walk around and inspect the anchored brain |
| Thumbstick horizontal | Orbit the brain / XR rig |
| Thumbstick vertical | Approach or retreat |
| Trigger | Raycast against the brain and inject a stimulus |
| Hold trigger | Paint repeated energy along the surface |
| Hand pinch | Paint energy when hand tracking emits WebXR select events |
| Grip / squeeze | Cycle global, frontal, occipital, temporal, parietal, and deep viewpoints |

Organic and Connectome styles are exposed as XR presets. Other renderer state, live BCI tensors, SynaptiX frames, and routine parameter events continue to update through the same renderer instance.

## Routine rail rides

The XR manager reads the existing renderer camera contract (`rotation`, `zoom`, and `fov`). Consequently, ordinary `camera` routine events, lobe presets, and spline paths from `routine-camera.js` move the XR rig without a parallel XR-only routine format. `RoutinePlayer` schedules its tick loop on the active `XRSession` while presenting and returns to the window animation loop when the session ends.

## AR tabletop mode

**Tabletop AR** requests `immersive-ar`, clears the XR layer transparently, and anchors a smaller brain approximately 65 cm in front of the viewer. This is intentionally a first-pass placement mode; plane detection, hit-test placement, and persistent anchors are not required.

## Fallback behavior

- WebXR unavailable: explains that the browser/context has no WebXR API.
- No immersive device/session: leaves entry controls disabled.
- WebGPU renderer active: offers a reload into the WebGL2 renderer and reopens the XR tab.

Ending XR restores the desktop WebGL render loop. A failed or rejected session request leaves desktop rendering active.

## Verification

```bash
python3 verification/verify_webxr.py
```

The verifier supplies a mocked `navigator.xr`, `XRSession`, stereo views, and `XRWebGLLayer`. It checks stereo frame submission, Organic/Connectome state, routine-driven rig movement, controller-ray stimulus, session teardown, and unavailable-browser fallback. Physical headset validation is still required before claiming a specific Quest, Vision Pro, or browser release as certified.
