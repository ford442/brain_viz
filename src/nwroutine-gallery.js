// @ts-check
// [Neuro-Weaver] Neuro-Script Exchange: the built-in routine gallery and the
// import path for routine files from disk.
//
// Local-first: there are no accounts and no upload server. The gallery is the
// routines shipped in public/routines/, each wrapped as a .nwroutine package
// with a stable `builtin:<name>` id so a fork of one records where it came
// from. Sharing is sending the exported file. The DOM side is
// src/ui-nwroutine-gallery.js; the format itself is src/nwroutine-format.js.

import {
  NWROUTINE_FORMAT,
  NWROUTINE_FORMAT_VERSION,
  parsePackage,
} from './nwroutine-format.js';

/**
 * @typedef {object} BuiltinRoutine
 * @property {string} id - stable package id (`builtin:<file stem>`)
 * @property {string} file - filename under public/routines/
 * @property {string} title
 * @property {string[]} tags - lowercase kebab-case
 * @property {string} description
 */

/**
 * Every JSON routine in public/routines/. tests/test_nwroutine.js fails if a
 * file is added there without an entry here (or an entry points at nothing).
 * @type {ReadonlyArray<BuiltinRoutine>}
 */
export const BUILTIN_ROUTINES = Object.freeze([
  {
    id: 'builtin:deep_thought',
    file: 'deep_thought.json',
    title: 'Deep Thought',
    tags: ['tour', 'stimulus', 'starter'],
    description: 'A guided pass from visual intake through association cortex to frontal reasoning.',
  },
  {
    id: 'builtin:altitude_simulation',
    file: 'altitude_simulation.json',
    title: 'Altitude Simulation',
    tags: ['hypoxia', 'physiology'],
    description: 'Ascends from sea level into hypoxia and back, driving the metabolic field parameters.',
  },
  {
    id: 'builtin:synaptix_resonance',
    file: 'synaptix_resonance.json',
    title: 'SynaptiX: Resonance Scan',
    tags: ['synaptix', 'phantom'],
    description: 'Built-in AI phantoms align with the human field region by region.',
  },
  {
    id: 'builtin:synaptix_hallucination',
    file: 'synaptix_hallucination.json',
    title: 'SynaptiX: Divergence and Confabulation',
    tags: ['synaptix', 'phantom', 'divergence'],
    description: 'Phantoms that stay plausible at the sensory boundary and drift apart deeper in.',
  },
  {
    id: 'builtin:synaptix_multi_brain',
    file: 'synaptix_multi_brain.json',
    title: 'SynaptiX: Two Minds',
    tags: ['synaptix', 'multi-brain', 'coupling'],
    description: 'Two cortices on screen with paired phantoms, mirror coupling and empathy pulses.',
  },
  {
    id: 'builtin:mirror_neuron_reach',
    file: 'mirror_neuron_reach.json',
    title: 'Multi-Brain: I Reach, You Move',
    tags: ['multi-brain', 'mirror-neuron', 'starter'],
    description: 'One cortex plans a reach; a beat later the partner\'s matching region echoes it.',
  },
]);

export const BUILTIN_AUTHOR = 'Neuro-Weaver';

/**
 * Wrap a built-in routine array as a package. Built-ins have no `created`
 * date: they are versioned by the repo, not stamped at load time.
 * @param {BuiltinRoutine} entry
 * @param {any[]} routine
 */
export function builtinPackage(entry, routine) {
  return {
    format: NWROUTINE_FORMAT,
    formatVersion: NWROUTINE_FORMAT_VERSION,
    manifest: {
      id: entry.id,
      title: entry.title,
      author: BUILTIN_AUTHOR,
      tags: [...entry.tags],
      description: entry.description,
      parentId: null,
    },
    routine,
    subRoutines: {},
    assets: {},
  };
}

/**
 * Fetch one built-in routine and wrap it. Built-ins are trusted content, so
 * they validate with sandboxed types allowed; the result still carries the
 * validator's errors and warnings so a broken shipped file is visible.
 * @param {BuiltinRoutine} entry
 * @param {{ fetchImpl?: typeof fetch, baseUrl?: string, extraAllowedTypes?: Iterable<string> }} [options]
 */
export async function loadBuiltinPackage(entry, { fetchImpl = fetch, baseUrl = '/routines/', extraAllowedTypes } = {}) {
  const response = await fetchImpl(`${baseUrl}${entry.file}`);
  if (!response.ok) throw new Error(`Failed to load ${entry.file}: ${response.status} ${response.statusText}`);
  const routine = await response.json();
  const pkg = builtinPackage(entry, routine);
  const result = parsePackage(pkg, { allowSandboxedTypes: true, extraAllowedTypes });
  return { ...result, package: pkg };
}

/**
 * Turn a filename into a display title for a bare routine array that came
 * without a manifest: "my_cool-routine.json" -> "my cool routine".
 * @param {string} fileName
 */
function titleFromFileName(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return stem || 'Untitled routine';
}

/**
 * Import a routine file the user picked from disk. Everything from disk is
 * untrusted by default: event types in SANDBOX_DISALLOWED_TYPES
 * (`bci_connect`, `drug_delivery`) are validation errors unless `trusted` is
 * set — the "I trust this file" checkbox. Accepts `.nwroutine` packages and,
 * for compatibility, bare `.json` routine arrays (wrapped with a manifest
 * titled after the file).
 *
 * CSV routines are parsed by RoutinePlayer (they need its region map), so the
 * caller passes the parsed event array as `parsedRoutine` and the same
 * sandbox check applies.
 *
 * @param {{ text?: string, parsedRoutine?: any[], fileName?: string, trusted?: boolean, extraAllowedTypes?: Iterable<string> }} input
 * @returns {{ valid: boolean, errors: string[], warnings: string[], package: any }}
 */
export function importRoutineFile({ text, parsedRoutine, fileName = 'routine.json', trusted = false, extraAllowedTypes }) {
  const options = { allowSandboxedTypes: trusted, extraAllowedTypes };
  const result = parsePackage(parsedRoutine ?? text ?? '', options);
  const pkg = result.package;
  // parsePackage wraps a bare array with a placeholder title; name it after
  // the file instead so the gallery shows something recognisable.
  if (pkg && (Array.isArray(parsedRoutine) || result.warnings[0]?.startsWith('input is a bare routine array'))) {
    pkg.manifest.title = titleFromFileName(fileName);
  }
  return { valid: result.valid, errors: result.errors, warnings: result.warnings, package: pkg };
}

/**
 * Short lineage label for UI: "forked from Deep Thought" when the parent is
 * known to the gallery, otherwise the raw parent id.
 * @param {any} manifest
 * @param {(id: string) => string | undefined} [titleForId]
 */
export function lineageLabel(manifest, titleForId = () => undefined) {
  const parentId = manifest?.parentId;
  if (typeof parentId !== 'string') return '';
  return `forked from ${titleForId(parentId) ?? parentId}`;
}
