// [Neuro-Weaver] Neuro-Script Exchange: .nwroutine package format + validation.
//
// A .nwroutine package is a single JSON document wrapping a routine (the
// flat event-array format already consumed by RoutinePlayer.loadRoutine)
// together with a manifest describing it for sharing/discovery. This module
// only defines the format and validates it — import/export UI, the gallery
// browser, and fork lineage are separate follow-up work.

export const NWROUTINE_FORMAT = 'nwroutine';
export const NWROUTINE_FORMAT_VERSION = '1.0.0';

// Every event type registered by src/routine-handlers/*.js plus the
// hardcoded fallback switch in RoutinePlayer.executeEvent(). Kept here as a
// flat allowlist so imported packages can be linted without instantiating
// the engine. RoutinePlayer.registerHandler() lets consumers add custom
// types at runtime; such types must be listed explicitly via
// validateRoutine's `extraAllowedTypes` option rather than silently passing.
export const KNOWN_EVENT_TYPES = new Set([
  // core.js
  'stimulus', 'style', 'mode-transition', 'param', 'lerp', 'calm', 'reset',
  'stress', 'synapse_kinetics', 'dynamic_weather', 'flow_state',
  'stroke_lesion', 'pathway_pulse', 'pathway_block', 'tms_distortion',
  'apply_tms', 'fluid', 'visual_cortex_filter',
  // neuromodulators.js
  'serotonin', 'cortisol', 'shake', 'light', 'dopamine', 'endorphin',
  'glial_cleanup', 'gaba', 'atp_depletion', 'endocannabinoid', 'melatonin',
  'sleep_deprivation', 'immune_migration', 'immune_surge', 'immune_resolve',
  'histamine', 'electrical',
  'mercury', 'heavy_metal', 'cognitive_load', 'myelin_degradation',
  'heartbeat', 'acetylcholine', 'noradrenaline', 'sensory_overload',
  'drug_delivery', 'adrenaline',
  // effects-audio.js
  'cinematic', 'modulate_speed', 'glitch', 'camera', 'haptic', 'clip',
  'binaural', 'sound',
  // narrative-flow.js
  'circadian_rhythm', 'flashback', 'dmn', 'dmn_to_tpn', 'oxytocin', 'speed',
  'text', 'cssFilter', 'overlay', 'choice', 'call', 'branch', 'state',
  'wait', 'signal', 'math', 'visual_cortex_fatigue', 'auditory_hallucination',
  'neuroplasticity', 'neuroplasticity_decay', 'dendritic_growth',
  'memory_formation', 'dynamic_topology', 'sync_burst',
  'spatial_memory_retrieval', 'psychedelic_trip', 'signal_trails',
  'spatial_memory',
  // synaptix.js
  'synaptiXLoad', 'synaptiXBlend', 'injectAIStimulus', 'resonanceBurst',
  // biosync.js
  'neural_pruning', 'neuromodulator', 'environmental_noise',
  'pupillary_dilation', 'gsr_sync', 'neurotransmitter_depletion',
  'cognitive_dissonance', 'hrv_sync', 'hypothermia', 'cellular_apoptosis',
  // training.js
  'training_start', 'training_checkpoint', 'training_end',
  // bci.js
  'bci_connect', 'bci_threshold', 'bci_record',
  // paint.js
  'paint_enable', 'paint_disable', 'paint_snapshot',
  // sonification.js
  'sonify_enable', 'sonify_disable', 'sonify_preset', 'sonify_param',
  // reactivity.js
  'reactivity_map',
  // fallback switch in routine-player.js
  'clear_lerps', 'marker', 'pause', 'resume', 'stop',
]);

// Event types that are structurally valid but disallowed in imported
// community packages by default: they can pause/redirect playback in ways
// that let a routine surprise the host page (e.g. hijack signals it doesn't
// own) or that only make sense for locally-authored content. Callers that
// trust the source (e.g. loading their own timeline-editor export) can pass
// `allowSandboxedTypes: true` to validateRoutine to skip this check.
export const SANDBOX_DISALLOWED_TYPES = new Set([
  'bci_connect',   // opens a hardware/websocket connection
  'drug_delivery', // simulates external device actuation
]);

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a package manifest. Returns { valid, errors }.
 * Required: title (non-empty string), author (non-empty string).
 * Optional but type-checked: tags (array of lowercase-kebab strings),
 * minEngineVersion (semver-ish "x.y.z"), description, parentId, created.
 */
export function validateManifest(manifest) {
  const errors = [];

  if (!isPlainObject(manifest)) {
    return { valid: false, errors: ['manifest must be an object'] };
  }

  if (typeof manifest.title !== 'string' || manifest.title.trim() === '') {
    errors.push('manifest.title is required and must be a non-empty string');
  }
  if (typeof manifest.author !== 'string' || manifest.author.trim() === '') {
    errors.push('manifest.author is required and must be a non-empty string');
  }

  if (manifest.tags !== undefined) {
    if (!Array.isArray(manifest.tags)) {
      errors.push('manifest.tags must be an array of strings');
    } else {
      manifest.tags.forEach((tag, i) => {
        if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
          errors.push(`manifest.tags[${i}] must be lowercase kebab-case (e.g. "biofeedback"), got ${JSON.stringify(tag)}`);
        }
      });
    }
  }

  if (manifest.minEngineVersion !== undefined) {
    if (typeof manifest.minEngineVersion !== 'string' || !SEMVER_PATTERN.test(manifest.minEngineVersion)) {
      errors.push('manifest.minEngineVersion must be a semver string like "0.1.0"');
    }
  }

  if (manifest.description !== undefined && typeof manifest.description !== 'string') {
    errors.push('manifest.description must be a string');
  }

  if (manifest.parentId !== undefined && manifest.parentId !== null && typeof manifest.parentId !== 'string') {
    errors.push('manifest.parentId must be a string or null');
  }

  if (manifest.created !== undefined) {
    if (typeof manifest.created !== 'string' || Number.isNaN(Date.parse(manifest.created))) {
      errors.push('manifest.created must be an ISO-8601 date string');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a routine event array (the same shape RoutinePlayer.loadRoutine
 * consumes). Returns { valid, errors, warnings }.
 *
 * options:
 *   allowSandboxedTypes  - skip the SANDBOX_DISALLOWED_TYPES check (default false)
 *   extraAllowedTypes    - iterable of additional type strings to accept as known
 *                          (for host-registered custom handlers)
 */
export function validateRoutine(routine, options = {}) {
  const errors = [];
  const warnings = [];
  const allowedTypes = options.extraAllowedTypes
    ? new Set([...KNOWN_EVENT_TYPES, ...options.extraAllowedTypes])
    : KNOWN_EVENT_TYPES;

  if (!Array.isArray(routine)) {
    return { valid: false, errors: ['routine must be an array of events'], warnings };
  }

  const subRoutineNames = new Set();
  routine.forEach((event, i) => {
    if (!isPlainObject(event)) {
      errors.push(`routine[${i}] must be an object`);
      return;
    }
    if (typeof event.time !== 'number' || Number.isNaN(event.time) || event.time < 0) {
      errors.push(`routine[${i}].time must be a non-negative number`);
    }
    if (typeof event.type !== 'string' || event.type.trim() === '') {
      errors.push(`routine[${i}].type must be a non-empty string`);
      return;
    }
    if (!allowedTypes.has(event.type)) {
      warnings.push(`routine[${i}].type "${event.type}" is not a recognized event type (may be a custom handler)`);
    }
    if (!options.allowSandboxedTypes && SANDBOX_DISALLOWED_TYPES.has(event.type)) {
      errors.push(`routine[${i}].type "${event.type}" is disallowed in imported packages (pass allowSandboxedTypes to override)`);
    }
    if (event.type === 'call') {
      if (typeof event.routine !== 'string') {
        errors.push(`routine[${i}] ("call") must have a string "routine" field naming the sub-routine`);
      } else {
        subRoutineNames.add(event.routine);
      }
    }
    if (event.type === 'branch') {
      if (typeof event.trueBranch !== 'string' && typeof event.falseBranch !== 'string') {
        errors.push(`routine[${i}] ("branch") must have a "trueBranch" and/or "falseBranch" string field`);
      }
      if (typeof event.trueBranch === 'string') subRoutineNames.add(event.trueBranch);
      if (typeof event.falseBranch === 'string') subRoutineNames.add(event.falseBranch);
    }
  });

  return { valid: errors.length === 0, errors, warnings, referencedSubRoutines: [...subRoutineNames] };
}

/**
 * Build a manifest object with sane defaults for the optional fields.
 */
export function createManifest({ title, author, tags = [], description = '', minEngineVersion, parentId = null }) {
  return {
    title,
    author,
    tags,
    description,
    minEngineVersion,
    parentId,
    created: new Date().toISOString(),
  };
}

/**
 * Wrap a manifest + routine (+ optional sub-routines/assets) into a
 * .nwroutine package object. Does not validate — call validatePackage()
 * (or validateManifest/validateRoutine) on the result before publishing.
 */
export function createPackage(manifest, routine, { subRoutines = {}, assets = {} } = {}) {
  return {
    format: NWROUTINE_FORMAT,
    formatVersion: NWROUTINE_FORMAT_VERSION,
    manifest,
    routine,
    subRoutines,
    assets,
  };
}

/**
 * Validate a full .nwroutine package object (as produced by createPackage
 * or parsed from an uploaded/imported file). Returns
 * { valid, errors, warnings }, aggregating manifest + routine (+
 * sub-routine) checks.
 */
export function validatePackage(pkg, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(pkg)) {
    return { valid: false, errors: ['package must be a JSON object'], warnings };
  }

  if (pkg.format !== NWROUTINE_FORMAT) {
    errors.push(`package.format must be "${NWROUTINE_FORMAT}", got ${JSON.stringify(pkg.format)}`);
  }
  if (typeof pkg.formatVersion !== 'string' || !SEMVER_PATTERN.test(pkg.formatVersion)) {
    errors.push('package.formatVersion must be a semver string like "1.0.0" or "1.0"');
  } else {
    const [major] = pkg.formatVersion.split('.');
    const [supportedMajor] = NWROUTINE_FORMAT_VERSION.split('.');
    if (major !== supportedMajor) {
      warnings.push(`package.formatVersion major "${major}" differs from supported "${supportedMajor}"; some fields may not be understood`);
    }
  }

  const manifestResult = validateManifest(pkg.manifest);
  errors.push(...manifestResult.errors);

  const routineResult = validateRoutine(pkg.routine, options);
  errors.push(...routineResult.errors);
  warnings.push(...(routineResult.warnings || []));

  const declaredSubRoutines = isPlainObject(pkg.subRoutines) ? pkg.subRoutines : {};
  if (pkg.subRoutines !== undefined && !isPlainObject(pkg.subRoutines)) {
    errors.push('package.subRoutines must be an object mapping name -> routine array');
  } else {
    for (const [name, subRoutine] of Object.entries(declaredSubRoutines)) {
      const subResult = validateRoutine(subRoutine, options);
      subResult.errors.forEach(e => errors.push(`subRoutines.${name}: ${e}`));
      (subResult.warnings || []).forEach(w => warnings.push(`subRoutines.${name}: ${w}`));
    }
  }

  (routineResult.referencedSubRoutines || []).forEach(name => {
    if (!(name in declaredSubRoutines)) {
      warnings.push(`routine references sub-routine "${name}" which is not included in package.subRoutines`);
    }
  });

  if (pkg.assets !== undefined && !isPlainObject(pkg.assets)) {
    errors.push('package.assets must be an object (e.g. { audio: [...], tensors: [...] })');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parse and validate a raw JSON string/object as a .nwroutine package.
 * Also accepts a bare legacy routine array (no manifest wrapper) for
 * backward compatibility with existing public/routines/*.json files,
 * returning it wrapped with a minimal placeholder manifest and a warning.
 */
export function parsePackage(raw, options = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return { valid: false, errors: [`invalid JSON: ${e.message}`], warnings: [], package: null };
  }

  if (Array.isArray(data)) {
    const pkg = createPackage(
      createManifest({ title: 'Untitled routine', author: 'unknown' }),
      data,
    );
    const result = validatePackage(pkg, options);
    result.warnings = ['input is a bare routine array, not an .nwroutine package; wrapped with a placeholder manifest', ...result.warnings];
    return { ...result, package: pkg };
  }

  const result = validatePackage(data, options);
  return { ...result, package: data };
}
