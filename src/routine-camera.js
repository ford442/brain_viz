export const CAMERA_PRESETS = {
    'frontal': { rotation: { x: 0.1, y: 0 }, zoom: 3.0 },     // Face on
    'occipital': { rotation: { x: 0.2, y: Math.PI }, zoom: 3.0 }, // Back
    'temporal': { rotation: { x: 0, y: -Math.PI / 2 }, zoom: 3.5 }, // Right Side
    'parietal': { rotation: { x: 1.0, y: 0 }, zoom: 3.5 },    // Top-ish
    'deep': { rotation: { x: 0.3, y: 0.3 }, zoom: 2.5 },      // Close up angle
    'global': { rotation: { x: 0.3, y: 0 }, zoom: 3.5 },      // Standard view
    // [Phase 2] Expanded Presets
    'top': { rotation: { x: 1.57, y: 0 }, zoom: 3.5 },        // Direct Top-down
    'bottom': { rotation: { x: -1.57, y: 0 }, zoom: 3.5 },    // Bottom-up
    'iso': { rotation: { x: 0.5, y: 0.5 }, zoom: 3.0 }        // Isometric-like
};

export function handleCamera(player, evt) {
    let params = {};

    const getPresetParams = (target) => {
        if (typeof target === 'string') {
            const preset = CAMERA_PRESETS[target] || player.cameraMap[target] || player.customPresets[target];
            if (preset) {
                return { ...preset };
            } else if (player.cameraRegions && player.cameraRegions.has(target)) {
                // Dynamic camera coordinate region mapping calculation
                const regionConfig = player.cameraRegions.get(target);
                const coords = regionConfig.coords;
                const x = coords.x !== undefined ? coords.x : coords[0];
                const y = coords.y !== undefined ? coords.y : coords[1];
                const z = coords.z !== undefined ? coords.z : coords[2];
                const rotX = Math.atan2(y, Math.sqrt(x**2 + z**2));
                const rotY = Math.atan2(x, z);

                // If the event didn't override duration/easing, try using the region defaults
                if (evt.duration === undefined && regionConfig.duration !== undefined) {
                    evt.duration = regionConfig.duration / 1000.0; // from ms to s
                }
                if (evt.ease === undefined && regionConfig.easing !== undefined) {
                    evt.ease = regionConfig.easing;
                }

                return { rotation: { x: rotX, y: rotY }, zoom: 3.5, fov: Math.PI / 4 };
            } else if (player.regions[target]) {
                // Auto-calculate camera angles for region coordinates
                const coords = player.regions[target];
                const rotX = Math.atan2(coords[1], Math.sqrt(coords[0]**2 + coords[2]**2));
                const rotY = Math.atan2(coords[0], coords[2]);
                return { rotation: { x: rotX, y: rotY }, zoom: 3.5, fov: Math.PI / 4 };
            } else {
                console.warn(`[Routine] Unknown camera target: ${target}`);
                return null;
            }
        } else if (target && target.rotation) {
            return target;
        }
        return null;
    };

    if (evt.target && player.splineMap && player.splineMap[evt.target]) {
        evt.path = player.splineMap[evt.target];
    }

    if (evt.path && Array.isArray(evt.path) && evt.duration && evt.duration > 0 && player.renderer.targetRotation) {
        console.log(`[Routine] Spline Camera Transition started (${evt.duration}s)`);
        const duration = evt.duration;
        const ease = evt.ease || 'linear';

        player.activeLerps = player.activeLerps.filter(l => !l.isCamera);

        let pathX = [player.renderer.targetRotation.x];
        let pathY = [player.renderer.targetRotation.y];
        let pathZoom = [player.renderer.targetZoom];
        let pathFov = [player.renderer.targetFov || Math.PI / 4];

        let hasValidPath = false;

        for (const step of evt.path) {
            const stepParams = getPresetParams(step);
            if (stepParams) {
                hasValidPath = true;
                if (stepParams.rotation && stepParams.rotation.x !== undefined) {
                    pathX.push(stepParams.rotation.x);
                } else {
                    pathX.push(pathX[pathX.length - 1]);
                }

                if (stepParams.rotation && stepParams.rotation.y !== undefined) {
                    pathY.push(stepParams.rotation.y);
                } else {
                    pathY.push(pathY[pathY.length - 1]);
                }

                if (stepParams.zoom !== undefined) {
                    pathZoom.push(stepParams.zoom);
                } else {
                    pathZoom.push(pathZoom[pathZoom.length - 1]);
                }

                if (stepParams.fov !== undefined) {
                    pathFov.push(stepParams.fov);
                } else {
                    pathFov.push(pathFov[pathFov.length - 1]);
                }
            }
        }

        if (hasValidPath) {
            player.activeLerps.push({
                key: 'cameraRotX',
                startVal: player.renderer.targetRotation.x,
                path: pathX,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

            player.activeLerps.push({
                key: 'cameraRotY',
                startVal: player.renderer.targetRotation.y,
                path: pathY,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

            player.activeLerps.push({
                key: 'cameraZoom',
                startVal: player.renderer.targetZoom,
                path: pathZoom,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

            player.activeLerps.push({
                key: 'cameraFov',
                startVal: player.renderer.targetFov || Math.PI / 4,
                path: pathFov,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });
        }
        return;
    }

    params = getPresetParams(evt.target) || {};
    if (evt.rotation) {
        params.rotation = evt.rotation;
    }

    if (evt.zoom !== undefined) {
        params.zoom = evt.zoom;
    }

    if (evt.fov !== undefined) {
        params.fov = evt.fov;
    }

    if (evt.duration && evt.duration > 0 && player.renderer.targetRotation) {
        console.log(`[Routine] Camera Transition started (${evt.duration}s)`);
        const duration = evt.duration;
        const ease = evt.ease || 'linear';

        player.activeLerps = player.activeLerps.filter(l => !l.isCamera);

        if (evt.path && Array.isArray(evt.path)) {
            const pathRotX = [player.renderer.targetRotation.x];
            const pathRotY = [player.renderer.targetRotation.y];
            const pathZoom = [player.renderer.targetZoom];
            const pathFov = [player.renderer.targetFov || Math.PI / 4];

            let prevX = player.renderer.targetRotation.x;
            let prevY = player.renderer.targetRotation.y;
            let prevZoom = player.renderer.targetZoom;
            let prevFov = player.renderer.targetFov || Math.PI / 4;

            for (const point of evt.path) {
                let pointParams = {};
                if (typeof point === 'string') {
                    const preset = CAMERA_PRESETS[point] || player.cameraMap[point] || player.customPresets[point];
                    if (preset) pointParams = { ...preset };
                    else console.warn(`[Routine] Unknown camera target in path: ${point}`);
                } else {
                    pointParams = { ...point };
                }

                const px = (pointParams.rotation && pointParams.rotation.x !== undefined) ? pointParams.rotation.x : prevX;
                const py = (pointParams.rotation && pointParams.rotation.y !== undefined) ? pointParams.rotation.y : prevY;
                const pz = pointParams.zoom !== undefined ? pointParams.zoom : prevZoom;
                const pf = pointParams.fov !== undefined ? pointParams.fov : prevFov;

                pathRotX.push(px);
                pathRotY.push(py);
                pathZoom.push(pz);
                pathFov.push(pf);

                prevX = px;
                prevY = py;
                prevZoom = pz;
                prevFov = pf;
            }

            player.activeLerps.push({
                key: 'cameraRotX',
                startVal: player.renderer.targetRotation.x,
                path: pathRotX,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

            player.activeLerps.push({
                key: 'cameraRotY',
                startVal: player.renderer.targetRotation.y,
                path: pathRotY,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

            player.activeLerps.push({
                key: 'cameraZoom',
                startVal: player.renderer.targetZoom,
                path: pathZoom,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

            player.activeLerps.push({
                key: 'cameraFov',
                startVal: player.renderer.targetFov || Math.PI / 4,
                path: pathFov,
                elapsed: 0,
                duration: duration,
                isCamera: true,
                ease: ease
            });

        } else {
            // Standard linear/eased lerp or Pathfinding arc
            const currentRotX = player.renderer.targetRotation.x;
            const currentRotY = player.renderer.targetRotation.y;
            const currentZoom = player.renderer.targetZoom;
            const currentFov = player.renderer.targetFov || Math.PI / 4;

            const targetRotX = (params.rotation && params.rotation.x !== undefined) ? params.rotation.x : currentRotX;
            const targetRotY = (params.rotation && params.rotation.y !== undefined) ? params.rotation.y : currentRotY;
            const targetZoom = params.zoom !== undefined ? params.zoom : currentZoom;
            const targetFov = params.fov !== undefined ? params.fov : currentFov;

            const deltaY = Math.abs(targetRotY - currentRotY);
            const deltaX = Math.abs(targetRotX - currentRotX);

            if (evt.avoidCollision && (deltaY > 2.0 || deltaX > 2.0)) {
                // Pathfinding: Create a 4-point spline path that arcs outward to avoid clipping through the center
                console.log(`[Routine] Pathfinding Camera Transition started (${duration}s) to avoid collision.`);

                let targetRotYAdj = targetRotY;
                if (Math.abs(currentRotY - targetRotY) > Math.PI) {
                    targetRotYAdj += (currentRotY < targetRotY) ? -2 * Math.PI : 2 * Math.PI;
                }

                const q1RotX = currentRotX + (targetRotX - currentRotX) * 0.33;
                const q2RotX = currentRotX + (targetRotX - currentRotX) * 0.67;

                const q1RotY = currentRotY + (targetRotYAdj - currentRotY) * 0.33;
                const q2RotY = currentRotY + (targetRotYAdj - currentRotY) * 0.67;

                // Dynamically calculate bump based on rotation magnitude
                const rotMag = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const bump = Math.min(rotMag * 1.5, 8.0); // Cap the bump distance

                // Push the zoom out at the midpoints
                const maxZoom = Math.max(currentZoom, targetZoom);
                const midZoom = maxZoom + bump;

                // Temporary cinematic FOV push during pathfinding
                const fovBump = Math.min(rotMag * 0.1, Math.PI / 4); // Up to 45 deg extra FOV
                const midFov = Math.min(currentFov + fovBump, Math.PI - 0.2);

                player.activeLerps.push({
                    key: 'cameraRotX',
                    startVal: currentRotX,
                    path: [currentRotX, q1RotX, q2RotX, targetRotX],
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                player.activeLerps.push({
                    key: 'cameraRotY',
                    startVal: currentRotY,
                    path: [currentRotY, q1RotY, q2RotY, targetRotYAdj],
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                player.activeLerps.push({
                    key: 'cameraZoom',
                    startVal: currentZoom,
                    path: [currentZoom, midZoom, midZoom, targetZoom],
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                player.activeLerps.push({
                    key: 'cameraFov',
                    startVal: currentFov,
                    path: [currentFov, midFov, midFov, targetFov],
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });
            } else {
                if (params.rotation && params.rotation.x !== undefined) {
                    player.activeLerps.push({
                        key: 'cameraRotX',
                        startVal: currentRotX,
                        endVal: targetRotX,
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });
                }

                if (params.rotation && params.rotation.y !== undefined) {
                    player.activeLerps.push({
                        key: 'cameraRotY',
                        startVal: currentRotY,
                        endVal: targetRotY,
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });
                }

                if (params.zoom !== undefined) {
                    player.activeLerps.push({
                        key: 'cameraZoom',
                        startVal: currentZoom,
                        endVal: targetZoom,
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });
                }

                if (params.fov !== undefined) {
                    player.activeLerps.push({
                        key: 'cameraFov',
                        startVal: currentFov,
                        endVal: targetFov,
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });
                }
            }
        }
        return;
    }

    if (player.renderer.setCameraParams && Object.keys(params).length > 0) {
        player.renderer.setCameraParams(params);
    }
}
