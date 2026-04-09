# Weekly Plan - Brain Visualization Enhancements

## Current Sprint: Environmental Stimulus Effects

### Feature: Brain Activity Animation for Environmental Exposures

**Objective:**  
Add animated effects to the Neuro-Weaver brain visualization that represent stimulus and changes in neural activity resulting from exposure to electrical and vapor-based environmental hazards (including mercury).

### Scope

#### 1. Electrical Exposure Effects
- **Trigger:** New UI button "Electrical Exposure" with configurable parameters
- **Expected Behavior:** Model neurological response to electrical stimulus
- **Parameters:** Intensity, duration (configurable by user)
- **Affected Regions:** Specific pattern of brain regions (to be determined during implementation with neuroscientific research)

#### 2. Vapor/Mercury Exposure Effects
- **Trigger:** New UI button "Vapor/Mercury Exposure" with configurable parameters
- **Expected Behavior:** Model neurological response to vapor inhalation and mercury exposure
- **Parameters:** Intensity, duration (configurable by user)
- **Affected Regions:** Different pattern from electrical exposure (to be determined during implementation with neuroscientific research)

### UI/UX Changes

#### Controls to Add
- **"Electrical Exposure" button** - Triggers electrical stimulus animation
- **"Vapor/Mercury Exposure" button** - Triggers vapor/mercury stimulus animation
- **Intensity slider** - Controls stimulus strength (0-100%)
- **Duration slider** - Controls effect duration in seconds (0-10s)

#### Visual Representation
- Use same visualization style as existing stimulus (no special colors/patterns)
- Behavioral differences in spread patterns and decay rates will distinguish each exposure type

### Implementation Plan

#### Phase 1: Research & Specification (Tomorrow)
- [ ] Research neurological patterns in electrical exposure
- [ ] Research neurological patterns in mercury/vapor exposure
- [ ] Document specific regional activation patterns for each
- [ ] Define temporal characteristics (onset, peak, decay)

#### Phase 2: Code Integration
- [ ] Add UI buttons and parameter controls
- [ ] Add electrical stimulus function to compute shader
- [ ] Add vapor/mercury stimulus function to compute shader
- [ ] Integrate region-specific patterns with existing volumetric engine

#### Phase 3: Testing & Validation
- [ ] Test with different visualization modes (Organic, Cyber, Connectome, Heatmap)
- [ ] Validate parameter ranges and responsiveness
- [ ] Cross-check neurological accuracy with research

### Technical Considerations
- Leverage existing `BrainRenderer` and volumetric tensor engine
- Extend compute shader to handle new stimulus injection types
- Maintain compatibility with existing stimulus modes (region-based injection)
- Keep performance consistent across visualization modes

### Related Files
- `src/BrainRenderer.js` - Main rendering engine
- `src/BrainGeometry.js` - Geometry and region definitions
- `src/shaders/` - WGSL compute and rendering shaders
- `index.html` - UI panel configuration

### Branch
Working on: `claude/add-brain-effects-animation-i2p8Z`

---

**Status:** Planned  
**Priority:** High  
**Estimated Effort:** 2-3 sessions
