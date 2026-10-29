// @ts-check
// [Neuro-Weaver] Neuro-Script Exchange UI (Routine tab): the built-in gallery,
// file import with the "I trust this file" sandbox override, fork, and
// .nwroutine export. Logic lives in src/nwroutine-gallery.js and
// src/nwroutine-format.js; this file is DOM only. docs/nwroutine.md.
//
// Everything a package carries (title, tags, author) can come from a stranger's
// file, so it is only ever written with textContent — never innerHTML.

import {
  createManifest,
  createPackage,
  forkPackage,
  packageFileName,
  serializePackage,
  SANDBOX_DISALLOWED_TYPES,
} from './nwroutine-format.js';
import {
  BUILTIN_ROUTINES,
  importRoutineFile,
  lineageLabel,
  loadBuiltinPackage,
} from './nwroutine-gallery.js';

const AUTHOR_STORAGE_KEY = 'nw.nwroutine.author';

/**
 * @typedef {object} GalleryEntry
 * @property {string} id
 * @property {string} title
 * @property {string[]} tags
 * @property {string} description
 * @property {string} origin - 'builtin' | 'imported' | 'session'
 * @property {boolean} trusted - may run sandboxed event types
 * @property {any} [package] - loaded package (built-ins fetch on first use)
 * @property {import('./nwroutine-gallery.js').BuiltinRoutine} [builtin]
 */

/** @type {GalleryEntry[]} */
const entries = BUILTIN_ROUTINES.map(builtin => ({
  id: builtin.id,
  title: builtin.title,
  tags: [...builtin.tags],
  description: builtin.description,
  origin: 'builtin',
  trusted: true,
  builtin,
}));

/**
 * Packages created in this session (forks and new exports) that have not
 * been passed around yet. Exporting an edit of one of these keeps its id
 * rather than forking it again, so "fork, edit, export" yields one package
 * whose parent is the routine you forked — not a chain of unsaved forks.
 * @type {WeakSet<object>}
 */
const sessionCreated = new WeakSet();

/** @type {(() => void) | null} */
let rerender = null;
/** @type {((message: string, tone?: 'ok' | 'warn' | 'error') => void) | null} */
let setStatus = null;

/** @param {string} id */
function titleForId(id) {
  return entries.find(e => e.id === id)?.title;
}

/** @param {any} player */
function registeredTypes(player) {
  return player?.handlers instanceof Map ? [...player.handlers.keys()] : [];
}

function readAuthor() {
  try { return localStorage.getItem(AUTHOR_STORAGE_KEY) || ''; } catch { return ''; }
}

/** @param {string} author */
function rememberAuthor(author) {
  try { localStorage.setItem(AUTHOR_STORAGE_KEY, author); } catch { }
}

/**
 * Add (or replace, by id) a package in the session gallery.
 * @param {any} pkg
 * @param {'imported' | 'session'} origin
 * @param {boolean} trusted
 */
function upsertEntry(pkg, origin, trusted) {
  const m = pkg.manifest;
  const entry = {
    id: typeof m.id === 'string' ? m.id : `local:${entries.length}`,
    title: m.title,
    tags: Array.isArray(m.tags) ? m.tags : [],
    description: typeof m.description === 'string' ? m.description : '',
    origin,
    trusted,
    package: pkg,
  };
  const existing = entries.findIndex(e => e.id === entry.id && e.origin !== 'builtin');
  if (existing >= 0) entries[existing] = entry; else entries.push(entry);
  rerender?.();
  return entry;
}

/**
 * Save a package as a .nwroutine file.
 * @param {any} pkg
 */
export function downloadPackage(pkg) {
  const blob = new Blob([serializePackage(pkg)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packageFileName(pkg.manifest);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Export a routine edited in the timeline editor as a .nwroutine. `source`
 * is the package the editor was opened on (player.activePackage at open):
 *   - none            -> a new original package
 *   - made this session -> same id, routine replaced
 *   - anything else   -> a fork whose parentId is the source's id
 * Returns the exported package (the editor keeps it as its new source), or
 * null if the user cancelled the title prompt.
 * @param {any[]} routine
 * @param {any} source
 */
export function exportEditedRoutine(routine, source) {
  const routineCopy = JSON.parse(JSON.stringify(routine)).sort((a, b) => a.time - b.time);
  let pkg;
  if (source && sessionCreated.has(source)) {
    pkg = { ...source, routine: routineCopy };
  } else {
    const defaultTitle = source ? `${source.manifest?.title || 'Untitled routine'} (fork)` : 'Custom routine';
    const title = window.prompt('Routine title', defaultTitle);
    if (title === null) return null;
    const author = window.prompt('Author', readAuthor() || 'anonymous');
    if (author === null) return null;
    rememberAuthor(author.trim() || 'anonymous');
    pkg = source
      ? forkPackage(source, { routine: routineCopy, title: title.trim() || defaultTitle, author: author.trim() || 'anonymous' })
      : createPackage(createManifest({ title: title.trim() || defaultTitle, author: author.trim() || 'anonymous' }), routineCopy);
  }
  sessionCreated.add(pkg);
  upsertEntry(pkg, 'session', true);
  downloadPackage(pkg);
  setStatus?.(`Exported ${packageFileName(pkg.manifest)}`, 'ok');
  return pkg;
}

/**
 * Mount the gallery + import controls into the Routine tab.
 * @param {any} player - RoutinePlayer
 * @param {HTMLElement} container
 */
export function setupNwroutineGallery(player, container) {
  const root = document.createElement('div');
  root.className = 'nwroutine-gallery';
  root.style.marginTop = '10px';

  const heading = document.createElement('div');
  heading.textContent = 'Neuro-Script Gallery';
  heading.style.fontSize = '11px';
  heading.style.fontWeight = '600';
  heading.style.color = '#8899aa';
  heading.style.marginBottom = '6px';
  root.appendChild(heading);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  list.style.maxHeight = '220px';
  list.style.overflowY = 'auto';
  root.appendChild(list);

  // --- Import -------------------------------------------------------------
  const importLabel = document.createElement('label');
  importLabel.textContent = 'Import Routine (.nwroutine / .json / .csv)';
  importLabel.dataset.tooltip = 'Load a routine file. Untrusted files cannot open devices (bci_connect) or actuate them (drug_delivery).';
  Object.assign(importLabel.style, {
    display: 'inline-block', width: '100%', padding: '6px 10px', marginTop: '8px',
    background: '#1a1a2e', border: '1px solid #445566', borderRadius: '6px',
    color: '#aabbcc', fontFamily: "'Inter', sans-serif", fontWeight: '600', fontSize: '11px',
    cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box',
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.nwroutine,.json,.csv';
  fileInput.style.display = 'none';
  importLabel.addEventListener('click', () => fileInput.click());

  const trustRow = document.createElement('label');
  Object.assign(trustRow.style, {
    display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px',
    fontSize: '10px', color: '#8899aa', cursor: 'pointer',
  });
  const trustBox = document.createElement('input');
  trustBox.type = 'checkbox';
  trustBox.id = 'nwroutine-trust';
  trustBox.style.width = 'auto';
  trustBox.style.margin = '0';
  const trustText = document.createElement('span');
  trustText.textContent = `I trust this file (allows ${[...SANDBOX_DISALLOWED_TYPES].join(', ')})`;
  trustRow.appendChild(trustBox);
  trustRow.appendChild(trustText);

  const status = document.createElement('div');
  status.style.fontSize = '10px';
  status.style.marginTop = '4px';
  status.style.whiteSpace = 'pre-wrap';
  status.style.wordBreak = 'break-word';
  status.setAttribute('role', 'status');

  root.appendChild(importLabel);
  root.appendChild(fileInput);
  root.appendChild(trustRow);
  root.appendChild(status);
  container.appendChild(root);

  setStatus = (message, tone = 'ok') => {
    status.textContent = message;
    status.style.color = tone === 'error' ? '#ff6677' : tone === 'warn' ? '#ffcc66' : '#66ddaa';
  };

  /** @param {GalleryEntry} entry */
  async function packageFor(entry) {
    if (entry.package) return entry.package;
    if (!entry.builtin) throw new Error(`No package for ${entry.id}`);
    const result = await loadBuiltinPackage(entry.builtin, { extraAllowedTypes: registeredTypes(player) });
    if (!result.valid) throw new Error(result.errors.join('\n'));
    entry.package = result.package;
    return entry.package;
  }

  /** @param {GalleryEntry} entry */
  async function play(entry) {
    try {
      const pkg = await packageFor(entry);
      player.loadPackage(pkg, player.loop);
      player.play();
      setStatus?.(`Playing "${pkg.manifest.title}"`, 'ok');
    } catch (err) {
      setStatus?.(`Could not play: ${/** @type {Error} */ (err).message}`, 'error');
    }
  }

  /** @param {GalleryEntry} entry */
  async function fork(entry) {
    try {
      const source = await packageFor(entry);
      const forked = forkPackage(source, { author: readAuthor() || 'anonymous' });
      sessionCreated.add(forked);
      upsertEntry(forked, 'session', entry.trusted);
      player.loadPackage(forked, player.loop);
      setStatus?.(`Forked "${source.manifest.title}" — loaded; edit it in the Timeline Editor, then export to keep it.`, 'ok');
    } catch (err) {
      setStatus?.(`Could not fork: ${/** @type {Error} */ (err).message}`, 'error');
    }
  }

  /** @param {GalleryEntry} entry */
  async function exportEntry(entry) {
    try {
      downloadPackage(await packageFor(entry));
    } catch (err) {
      setStatus?.(`Could not export: ${/** @type {Error} */ (err).message}`, 'error');
    }
  }

  /**
   * @param {string} label
   * @param {string} title
   * @param {() => void} onClick
   */
  function smallButton(label, title, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    // The panel's global button rule is full-width; these sit in a row.
    Object.assign(b.style, { width: 'auto', flex: '0 0 auto', padding: '2px 6px', fontSize: '11px', minWidth: '0', marginTop: '0' });
    b.addEventListener('click', onClick);
    return b;
  }

  rerender = () => {
    list.replaceChildren();
    for (const entry of entries) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px',
        background: 'rgba(0,0,0,0.25)', borderRadius: '4px',
      });

      const text = document.createElement('div');
      text.style.flex = '1';
      text.style.minWidth = '0';
      const title = document.createElement('div');
      title.textContent = entry.title;
      Object.assign(title.style, { fontSize: '11px', color: '#ccddee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
      title.title = entry.description || entry.title;
      const meta = document.createElement('div');
      const lineage = lineageLabel(entry.package?.manifest, titleForId);
      const badges = [entry.origin === 'builtin' ? '' : entry.origin, entry.origin === 'imported' && entry.trusted ? 'trusted' : ''].filter(Boolean);
      meta.textContent = [...badges, ...entry.tags.map(t => `#${t}`), lineage].filter(Boolean).join(' · ');
      Object.assign(meta.style, { fontSize: '9px', color: '#667788', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
      text.appendChild(title);
      text.appendChild(meta);

      row.appendChild(text);
      row.appendChild(smallButton('▶', 'Play', () => play(entry)));
      row.appendChild(smallButton('⑂', 'Fork (records this routine as the parent)', () => fork(entry)));
      row.appendChild(smallButton('⤓', 'Export .nwroutine', () => exportEntry(entry)));
      list.appendChild(row);
    }
  };
  rerender();

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const trusted = trustBox.checked;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const extraAllowedTypes = registeredTypes(player);
      let result;
      if (file.name.toLowerCase().endsWith('.csv')) {
        // CSV event lists can name any event type, so they get the same
        // sandbox check as JSON once RoutinePlayer has parsed them.
        const parsed = player.parseCSV(text);
        if (!parsed.length) {
          setStatus?.(`${file.name}: no events found in CSV`, 'error');
          return;
        }
        result = importRoutineFile({ parsedRoutine: parsed, fileName: file.name, trusted, extraAllowedTypes });
      } else {
        result = importRoutineFile({ text, fileName: file.name, trusted, extraAllowedTypes });
      }

      if (!result.valid) {
        const sandboxed = result.errors.some(e => e.includes('disallowed in imported packages'));
        const hint = sandboxed ? '\nCheck "I trust this file" to allow it.' : '';
        setStatus?.(`${file.name} was not loaded:\n${result.errors.slice(0, 4).join('\n')}${hint}`, 'error');
        console.warn('[Neuro-Script] Import rejected:', result.errors);
        return;
      }

      upsertEntry(result.package, 'imported', trusted);
      player.loadPackage(result.package, false);
      player.play();
      const warnCount = result.warnings.length;
      setStatus?.(`Loaded "${result.package.manifest.title}"${warnCount ? ` (${warnCount} warning${warnCount === 1 ? '' : 's'}, see console)` : ''}`, warnCount ? 'warn' : 'ok');
      if (warnCount) console.warn('[Neuro-Script] Import warnings:', result.warnings);
    };
    reader.onerror = () => setStatus?.(`Could not read ${file.name}`, 'error');
    reader.readAsText(file);
  });

  return { root, setStatus };
}
