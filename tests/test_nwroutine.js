// tests/test_nwroutine.js
// [Neuro-Script] Pins the .nwroutine exchange: every shipped routine is in
// the gallery catalog and validates as a package, files from disk cannot run
// sandboxed event types unless trusted, forks record their parent, and a
// package survives a serialize/parse round trip. docs/nwroutine.md.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createManifest,
  createPackage,
  forkPackage,
  generatePackageId,
  packageFileName,
  parsePackage,
  serializePackage,
  validateManifest,
  validatePackage,
  KNOWN_EVENT_TYPES,
  SANDBOX_DISALLOWED_TYPES,
} from '../src/nwroutine-format.js';
import {
  BUILTIN_ROUTINES,
  builtinPackage,
  importRoutineFile,
  lineageLabel,
  loadBuiltinPackage,
} from '../src/nwroutine-gallery.js';
import { RoutinePlayer } from '../src/routine-player.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTINES_DIR = join(ROOT, 'public', 'routines');

// Types the app registers with player.registerHandler() outside
// src/routine-handlers/ (main-synaptix-integration.js). In the app the
// gallery passes the live handler keys instead.
const HOST_TYPES = ['synaptix', 'mirror_coupling', 'empathy_pulse', 'divergence_storm'];

// --- 1. Catalog <-> public/routines/*.json -------------------------------

{
  const onDisk = readdirSync(ROUTINES_DIR).filter(f => f.endsWith('.json')).sort();
  const listed = BUILTIN_ROUTINES.map(r => r.file).sort();
  assert.deepEqual(listed, onDisk, 'every public/routines/*.json needs a BUILTIN_ROUTINES entry (and no entry may point at a missing file)');

  const ids = new Set();
  for (const entry of BUILTIN_ROUTINES) {
    assert.equal(entry.id, `builtin:${entry.file.replace(/\.json$/, '')}`, `${entry.file}: id must be builtin:<stem>`);
    assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
    ids.add(entry.id);
  }
}

// --- 2. Every built-in validates as a package, with no unknown types -----

for (const entry of BUILTIN_ROUTINES) {
  const routine = JSON.parse(readFileSync(join(ROUTINES_DIR, entry.file), 'utf8'));
  const pkg = builtinPackage(entry, routine);
  const result = validatePackage(pkg, { allowSandboxedTypes: true, extraAllowedTypes: HOST_TYPES });
  assert.deepEqual(result.errors, [], `${entry.file} errors`);
  assert.deepEqual(result.warnings, [], `${entry.file} warnings (typo in an event type?)`);
}

// loadBuiltinPackage goes through fetch; serve it from disk.
{
  const fetchImpl = async (url) => {
    const file = String(url).split('/').pop();
    const text = readFileSync(join(ROUTINES_DIR, file), 'utf8');
    return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(text) };
  };
  const entry = BUILTIN_ROUTINES.find(r => r.id === 'builtin:mirror_neuron_reach');
  assert.ok(entry, 'mirror-neuron demo is in the gallery');
  const result = await loadBuiltinPackage(entry, { fetchImpl, extraAllowedTypes: HOST_TYPES });
  assert.equal(result.valid, true);
  assert.equal(result.package.manifest.id, 'builtin:mirror_neuron_reach');
  assert.equal(result.package.manifest.parentId, null);
  assert.ok(result.package.routine.some(e => e.type === 'multi_brain'));
}

// --- 3. Sandbox: untrusted files cannot open or actuate devices ----------

{
  assert.deepEqual([...SANDBOX_DISALLOWED_TYPES].sort(), ['bci_connect', 'drug_delivery']);

  for (const type of SANDBOX_DISALLOWED_TYPES) {
    const routine = [{ time: 0, type: 'text', message: 'hi' }, { time: 1, type }];
    const pkgText = serializePackage(createPackage(createManifest({ title: 'Sneaky', author: 'x' }), routine));

    const untrusted = importRoutineFile({ text: pkgText, fileName: 'sneaky.nwroutine' });
    assert.equal(untrusted.valid, false, `${type}: untrusted package must be rejected`);
    assert.ok(untrusted.errors.some(e => e.includes(`"${type}" is disallowed`)), untrusted.errors.join('\n'));

    const trusted = importRoutineFile({ text: pkgText, fileName: 'sneaky.nwroutine', trusted: true });
    assert.equal(trusted.valid, true, `${type}: trusted package loads`);

    // A bare JSON array from disk gets the same check.
    const bare = importRoutineFile({ text: JSON.stringify(routine), fileName: 'old.json' });
    assert.equal(bare.valid, false, `${type}: bare JSON array is still sandboxed`);

    // As does a CSV the player already parsed.
    const csv = importRoutineFile({ parsedRoutine: routine, fileName: 'events.csv' });
    assert.equal(csv.valid, false, `${type}: parsed CSV is still sandboxed`);

    // Hiding it in a sub-routine does not help.
    const hidden = createPackage(
      createManifest({ title: 'Hidden', author: 'x' }),
      [{ time: 0, type: 'call', routine: 'inner' }],
      { subRoutines: { inner: [{ time: 0, type }] } },
    );
    const hiddenResult = importRoutineFile({ text: serializePackage(hidden), fileName: 'hidden.nwroutine' });
    assert.equal(hiddenResult.valid, false, `${type}: sandboxed type in a sub-routine is rejected`);
  }
}

// --- 4. Bare arrays are wrapped and titled after the file ----------------

{
  const result = importRoutineFile({ text: JSON.stringify([{ time: 0, type: 'calm' }]), fileName: 'my_cool-routine.json' });
  assert.equal(result.valid, true);
  assert.equal(result.package.manifest.title, 'my cool routine');
  assert.match(result.warnings[0], /bare routine array/);
  assert.equal(typeof result.package.manifest.id, 'string');

  const broken = importRoutineFile({ text: '{ nope', fileName: 'x.nwroutine' });
  assert.equal(broken.valid, false);
  assert.match(broken.errors[0], /invalid JSON/);
}

// --- 5. Fork lineage ----------------------------------------------------

{
  const entry = BUILTIN_ROUTINES[0];
  const source = builtinPackage(entry, [{ time: 0, type: 'calm' }]);
  const fork = forkPackage(source);

  assert.notEqual(fork.manifest.id, source.manifest.id, 'fork gets a fresh id');
  assert.equal(fork.manifest.parentId, source.manifest.id, 'fork records its parent');
  assert.equal(fork.manifest.title, `${entry.title} (fork)`);
  assert.deepEqual(fork.manifest.tags, source.manifest.tags);
  assert.equal(typeof fork.manifest.created, 'string');
  assert.equal(validatePackage(fork).valid, true);
  assert.equal(lineageLabel(fork.manifest, id => (id === entry.id ? entry.title : undefined)), `forked from ${entry.title}`);
  assert.equal(lineageLabel(source.manifest), '');

  // Deep copy: editing the fork leaves the source alone.
  fork.routine.push({ time: 5, type: 'reset' });
  fork.manifest.tags.push('mine');
  assert.equal(source.routine.length, 1);
  assert.ok(!source.manifest.tags.includes('mine'));

  // Overrides (the timeline editor's edited routine) replace the copy.
  const edited = forkPackage(source, { routine: [{ time: 2, type: 'reset' }], title: 'Edited', author: 'me' });
  assert.deepEqual(edited.routine, [{ time: 2, type: 'reset' }]);
  assert.equal(edited.manifest.title, 'Edited');
  assert.equal(edited.manifest.author, 'me');

  // A fork of a fork points at its immediate parent.
  const grandchild = forkPackage(fork);
  assert.equal(grandchild.manifest.parentId, fork.manifest.id);

  // A legacy package with no id has nothing to point back to.
  const legacy = { ...source, manifest: { title: 'Old', author: 'x' } };
  assert.equal(forkPackage(legacy).manifest.parentId, null);
}

// --- 6. Round trip + manifest id rules ----------------------------------

{
  const pkg = forkPackage(builtinPackage(BUILTIN_ROUTINES[1], [{ time: 0, type: 'calm' }]));
  const text = serializePackage(pkg);
  const parsed = parsePackage(text);
  assert.equal(parsed.valid, true, parsed.errors.join('\n'));
  assert.deepEqual(parsed.package, JSON.parse(JSON.stringify(pkg)));

  assert.equal(validateManifest({ title: 't', author: 'a', id: 'has spaces' }).valid, false);
  assert.equal(validateManifest({ title: 't', author: 'a', id: 'x'.repeat(129) }).valid, false);
  assert.equal(validateManifest({ title: 't', author: 'a', id: 'same', parentId: 'same' }).valid, false);
  assert.equal(validateManifest({ title: 't', author: 'a', id: 'builtin:deep_thought' }).valid, true);

  assert.equal(packageFileName({ title: 'SynaptiX: Two Minds (fork)' }), 'synaptix-two-minds-fork.nwroutine');
  assert.equal(packageFileName({ title: '!!!' }), 'routine.nwroutine');
}

// --- 7. Package ids without crypto.randomUUID (insecure context) ---------

{
  const a = generatePackageId();
  assert.match(a, /^[0-9a-f-]{32,36}$/);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (b) => b.fill(7) }, configurable: true });
    assert.equal(generatePackageId(), '07'.repeat(16));
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
}

// --- 8. RoutinePlayer.loadPackage + the multi_brain event ----------------

{
  const renderer = { params: { style: 0, dualAvatarEnabled: false }, setParams(p) { Object.assign(this.params, p); } };
  const player = new RoutinePlayer(renderer, {}, {});
  assert.ok(KNOWN_EVENT_TYPES.has('multi_brain'), 'multi_brain is a known event type');
  assert.ok(player.handlers.has('multi_brain'), 'multi_brain has a default handler');

  const pkg = createPackage(
    createManifest({ title: 'Pkg', author: 'a' }),
    [{ time: 0, type: 'call', routine: 'intro' }, { time: 3, type: 'multi_brain', enabled: true, partnerInfluence: 0.4 }],
    { subRoutines: { intro: [{ time: 0, type: 'calm' }, { time: 1, type: 'reset' }] } },
  );
  player.loadPackage(pkg);
  assert.equal(player.activePackage, pkg);
  assert.deepEqual(player.routine.map(e => e.type), ['calm', 'reset', 'multi_brain'], 'package sub-routines are registered and expanded');

  player.loadRoutine([{ time: 0, type: 'calm' }]);
  assert.equal(player.activePackage, null, 'loading a plain routine clears the package');

  player.executeEvent({ time: 0, type: 'multi_brain', enabled: true, partnerInfluence: 0.4 });
  assert.equal(renderer.params.dualAvatarEnabled, true);
  assert.equal(renderer.params.style, 4.0, 'enabling multi-brain switches to SynaptiX');
  assert.equal(renderer.params.partnerInfluence, 0.4);

  player.executeEvent({ time: 0, type: 'multi_brain', enabled: false });
  assert.equal(renderer.params.dualAvatarEnabled, false);
  assert.equal(renderer.params.style, 4.0, 'disabling leaves the style alone');
}

console.log('test_nwroutine passed');
