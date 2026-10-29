# Neuro-Script Exchange (`.nwroutine`)

A `.nwroutine` file is one routine packaged for sharing: the event array
`RoutinePlayer` already plays, plus a manifest saying what it is and where it
came from. The exchange is **local-first**. There are no accounts and no upload
server: the gallery is the routines shipped in `public/routines/`, and sharing
means sending the file.

| Piece | Where |
|---|---|
| Format, validation, fork, serialize | [`src/nwroutine-format.js`](../src/nwroutine-format.js) |
| Built-in catalog, file import | [`src/nwroutine-gallery.js`](../src/nwroutine-gallery.js) |
| Routine-tab gallery UI, export | [`src/ui-nwroutine-gallery.js`](../src/ui-nwroutine-gallery.js) |
| Loading into the player | `RoutinePlayer.loadPackage(pkg, loop)` |
| Tests | `tests/test_nwroutine.js` (`npm test`), `verification/verify_nwroutine.py` |

## Package

```json
{
  "format": "nwroutine",
  "formatVersion": "1.0.0",
  "manifest": {
    "id": "6f1c…",
    "title": "Deep Thought (fork)",
    "author": "ada",
    "tags": ["tour", "starter"],
    "description": "…",
    "parentId": "builtin:deep_thought",
    "created": "2026-10-22T12:00:00.000Z"
  },
  "routine": [ { "time": 0, "type": "reset" } ],
  "subRoutines": { "intro": [ … ] },
  "assets": {}
}
```

- `title` and `author` are required. `tags` are lowercase kebab-case.
- `id` names the package: a UUID for packages made in the app, or
  `builtin:<file stem>` for the shipped gallery.
- `parentId` is the `id` of the package this one was forked from, or `null` for
  an original. It can't equal `id`.
- `subRoutines` are registered with the player before the routine loads, so
  `call` and `branch` events inside the package resolve.

A bare JSON event array (the older `public/routines/*.json` shape) still
imports. It's wrapped with a manifest titled after the file, and a warning says
so.

## Sandbox

Every file opened from disk is **untrusted**, whether it's `.nwroutine`, `.json`
or `.csv`. Event types in `SANDBOX_DISALLOWED_TYPES` fail validation, and the
file doesn't load:

- `bci_connect` opens a hardware or WebSocket connection.
- `drug_delivery` simulates driving an external device.

The check covers sub-routines too. CSV event lists are parsed by
`RoutinePlayer` first, then held to the same check. To run such a file anyway,
tick **"I trust this file"** before importing. Built-in routines are trusted
content.

Event types the validator doesn't recognise are warnings, not errors. A host
can register custom handlers, and the gallery passes the player's registered
handler names so these don't warn.

## Fork lineage

`forkPackage(pkg, overrides)` deep-copies a package and gives it a fresh `id`
whose `parentId` is the source's `id`. Lineage then survives the file being
passed around. In the app:

- **⑂ Fork** on a gallery row creates the fork, loads it, and lists it as
  "forked from …".
- **📦 Export .nwroutine** in the Timeline Editor exports the edited routine.
  - If the editor was opened on a built-in or an imported package, the export
    is a fork of it.
  - If it was opened on a package made this session (a fork you haven't shared
    yet), the export keeps that package's `id` and parent. So fork → edit →
    export yields one package whose parent is the routine you forked.
  - With no package loaded, the export is a new original.
- **⤓** on a gallery row exports that package unchanged.

A legacy package with no `id` forks with `parentId: null`, because there is
nothing to point back to. Session forks and imports live only until reload.
Export a package to keep it.

## Adding a built-in routine

1. Put the event array in `public/routines/<name>.json`.
2. Add an entry to `BUILTIN_ROUTINES` in `src/nwroutine-gallery.js`, with `id:
   'builtin:<name>'`, a title, tags and a description.
3. Run `npm test`. `tests/test_nwroutine.js` fails if a routine file has no
   catalog entry, if an entry points at nothing, or if a shipped routine uses an
   event type no handler knows (usually a typo).

## Out of scope

Out of scope by design: no cloud gallery, accounts, payments or ratings. A
static gallery in the repo (or on GitHub Pages) is enough. LLM-generated
routines are a separate dream-backlog item. Collaborative rooms are a separate
follow-up; see [`ROADMAP.md`](ROADMAP.md) → *Open Items*.
