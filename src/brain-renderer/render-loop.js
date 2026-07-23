export function applyRenderLoopMethods(Target) {
    Target.prototype.render = function() {
        // [V2.3] Main Render Loop
        if (!this.isRunning) return;

        if (this.tms) {
    const elapsed = performance.now() - this.tms.startTime;
    if (elapsed > this.tms.duration) {
        this.tms = null;
        this.params.tmsActive = 0.0;
        this.params.tmsPulse = 0.0;
    } else {
        const rawProgress = elapsed / this.tms.duration;
        // smooth 0 -> 1 -> 0 pulse using sine
        this.params.tmsPulse = Math.sin(rawProgress * Math.PI) * this.tms.strength;

        // Add volumetric bias (energy impact)
        // We'll do this by injecting stimulus each frame of the pulse
        const pulseIntensity = this.params.tmsPulse * 0.1;
        if (pulseIntensity > 0.01) {
            this.injectStimulus(this.params.tmsCenterX, this.params.tmsCenterY, this.params.tmsCenterZ, pulseIntensity, 0.0);
        }
    }
        }
        if (this.geometryDirty && (!this.lastGeometryRebuildTime || performance.now() - this.lastGeometryRebuildTime >= this.geometryRebuildIntervalMs)) {
    this.rebuildGeometry();
        }
        
        const load = Math.max(0, Math.min(1, this.params.cognitiveLoad));
        const scale = Math.max(0.1, 1.0 - load); // Stronger load = more aggressive downscaling

        const targetWidth = Math.max(1, Math.floor(this.canvas.clientWidth * scale));
        const targetHeight = Math.max(1, Math.floor(this.canvas.clientHeight * scale));

        if (Math.abs(this.canvas.width - targetWidth) > 20 || Math.abs(this.canvas.height - targetHeight) > 20) {
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({ size: [targetWidth, targetHeight], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });

    // Resize Render Target
    this.createRenderTarget(targetWidth, targetHeight);
    console.log(`[BrainRenderer] LoD adjusted: ${targetWidth}x${targetHeight} (load=${load.toFixed(2)})`);
        }

        this.time += 0.016;
        this.updateAltitudeState(); // Update altitude/hypoxia parameters before uniforms
        this.updateUniforms();
        if (this.params.style >= 4.0) this.updateSynaptiXBridges();
        
        const commandEncoder = this.device.createCommandEncoder();

        // Skip physics simulation when tensor playback is driving the voxel buffer directly
        if (!this.tensorPlaybackMode) {
    if (this.wasmMode && this.wasmEngine.available) {
        // [Phase 1 WASM] Hybrid path: C++ engine runs simulation on CPU,
        // result is uploaded to the WebGPU storage buffer each frame.
        this.wasmEngine.update(this.time, {
            ...this.params,
            _electricalActive: this.stimulus.electricalActive,
            _mercuryActive:    this.stimulus.mercuryActive
        });
        const tensorData = this.wasmEngine.getTensorData();
        if (tensorData) {
            this._lastHumanTensor.set(tensorData);
            this.device.queue.writeBuffer(this.tensorBuffer, 0, tensorData);
        }
    } else {
        // Default path: WebGPU compute shader handles tensor physics on GPU.
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.voxelBufferSize / 64));
        computePass.end();
    }
        }
        
        // --- PASS 1: RENDER SCENE TO TEXTURE ---
        const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: this.renderTarget.createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, 
        loadOp: 'clear', storeOp: 'store'
    }],
    depthStencilAttachment: { view: this.depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });
        
        renderPass.setBindGroup(0, this.bindGroup);
        
        const isSynaptiX = this.params.style >= 4.0;
        const isConnectome = this.params.style >= 2.0 && this.params.style < 3.0;
        const pointDensity = Math.max(0.0, this.params.pointCloudDensity ?? 1.0);
        const pointCloudDrawCount = Math.floor(this.pointCloudInstanceCount * Math.min(1.0, pointDensity));
        const somaDrawCount = Math.floor(this.somaInstanceCount * Math.min(1.0, 0.35 + pointDensity * 0.65));

        if (isConnectome) {
    // --- CONNECTOME / SYNAPTIX MODE ---

    // 1. Draw Fibers
    renderPass.setPipeline(this.fiberPipeline);
    renderPass.setVertexBuffer(0, this.fiberBuffer);
    renderPass.setVertexBuffer(1, this.fiberNormalBuffer);
    renderPass.setVertexBuffer(2, this.fiberMetaBuffer);
    renderPass.setVertexBuffer(3, this.fiberPathBuffer);
    renderPass.draw(this.fiberVertexCount);

    // 2. Draw Dense Point Cloud (Boutons / Varicosities) [V3.1]
    if (pointCloudDrawCount > 0) {
        renderPass.setPipeline(this.pointCloudPipeline);
        renderPass.setVertexBuffer(0, this.pointCloudQuadBuffer);
        renderPass.setVertexBuffer(1, this.pointCloudInstanceBuffer);
        renderPass.draw(6, pointCloudDrawCount);
    }

    // 3. Draw Instanced Mesh Somas (Hubs / Medium) [V3.1 Pipeline]
    if (somaDrawCount > 0) {
        renderPass.setPipeline(this.somaPipeline);
        renderPass.setVertexBuffer(0, this.somaVertexBuffer); // Mesh
        renderPass.setVertexBuffer(1, this.somaInstanceBuffer); // Rich instance data
        renderPass.setIndexBuffer(this.somaIndexBuffer, 'uint16');
        renderPass.drawIndexed(this.somaIndexCount, somaDrawCount);
    }

    // 4. Draw Emissive Sparks / Vesicles
    if (this.sparkInstanceCount > 0) {
        renderPass.setPipeline(this.sparkPipeline);
        renderPass.setVertexBuffer(0, this.sparkQuadBuffer);
        renderPass.setVertexBuffer(1, this.sparkInstanceBuffer);
        renderPass.draw(6, this.sparkInstanceCount);
    }
        }

        if (isSynaptiX && (this.params.dualAvatarEnabled ?? true)) {
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.normalBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
    renderPass.setBindGroup(0, this.avatarABindGroup);
    renderPass.drawIndexed(this.indexCount);
    renderPass.setBindGroup(0, this.partnerBindGroup);
    renderPass.drawIndexed(this.indexCount);

    renderPass.setPipeline(this.synaptixBridgePipeline);
    renderPass.setBindGroup(0, this.synaptixBridgeBindGroup);
    renderPass.setVertexBuffer(0, this.synaptixBridgeBuffer);
    renderPass.draw(this.synaptixBridgeVertexCount);

    const singleWorkUnits = this.indexCount + this.fiberVertexCount + this.somaIndexCount * somaDrawCount + pointCloudDrawCount * 6 + this.sparkInstanceCount * 6;
    const dualWorkUnits = this.indexCount * 2 + this.synaptixBridgeVertexCount;
    this.synaptixPerformance = {
        singleWorkUnits,
        dualWorkUnits,
        workRatio: dualWorkUnits / Math.max(1, singleWorkUnits)
    };
        } else if (!isConnectome) {
    // --- SOLID MESH MODE (Organic / Cyber / Heatmap / SynaptiX overlay) ---
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.normalBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
    renderPass.drawIndexed(this.indexCount);
        }
        
        renderPass.end();

        // --- PASS 2: POST-PROCESSING TO SCREEN ---
        const postPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'clear', storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
    }]
        });

        postPass.setPipeline(this.postPipeline);
        postPass.setBindGroup(0, this.postBindGroup);
        postPass.draw(6); // Draw full-screen quad
        postPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(() => this.render());
    };

    Target.prototype.getSynaptiXPerformanceStats = function() {
        return { ...(this.synaptixPerformance || { singleWorkUnits: 0, dualWorkUnits: 0, workRatio: 1 }) };
    };

}
