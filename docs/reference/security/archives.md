---
id: reference/security/archives
title: Safe archive handling: .charx and .byaf
audience: dev
summary: How vaud bounds a .charx or .byaf ZIP before and after inflation to resist a zip bomb, and where entry names are (and are not yet) checked for path traversal before they can become a filesystem write or a re-exported archive path.
tags: [security, archive, zip, zip-bomb, path-traversal, charx, byaf, fflate]
related: [reference/formats/risu, reference/formats/backyard, reference/formats/lumiverse, reference/security/script-sandbox, reference/architecture]
---

# Safe archive handling: .charx and .byaf

Both `.charx` (RisuAI) and `.byaf` (Backyard) are ZIP archives, and vaud treats the bytes inside them as
untrusted until parsed. This page covers two properties of that handling, and they are proven to different
degrees:

- **Decompression limits against a zip bomb.** One shared bounded-unzip helper, `unzipBounded`
  (`src/core/archive.ts`), gates every `.charx` and `.byaf` inflate. This is real, shared, and unit-tested.
- **Path-traversal safety on entry names.** This is proven for exactly one place an untrusted entry name
  can turn into a fresh write: a BYAF greeting id resolving to a scenario file on export. It is not yet
  proven, and not yet tested, for two other places a name from the input archive is carried into a
  re-exported archive's entry table. Both are named below, in the same breath as the parts that are solid.

@fig pipeline

## Decompression limits against a zip bomb

### The shared bound

`CARD_ARCHIVE_BOUNDS` is the budget both `.charx` and `.byaf` are unzipped under: 96 MiB max archive size,
512 entries max, 64 MiB max per entry (compressed or inflated), 96 MiB max aggregate inflated size across
every selected entry (`src/core/archive.ts:30-36`). The Risu adapter's `safeUnzip` and the BYAF container's
`safeUnzip` are both thin wrappers that pin `bounds: CARD_ARCHIVE_BOUNDS` and forward to the same
`unzipBounded` (`src/formats/risu/index.ts:38-41`, `src/formats/backyard/byaf-container.ts:11-13`). Neither
format reimplements the check; both call the one helper in `src/core/archive.ts`.

### Reject before any unzip call

The full compressed archive length is checked first, against `maxArchiveBytes`, before `unzipSync` is
called at all (`archive.ts:71-73`). An archive over 96 MiB never reaches fflate.

### Pre-inflate, per entry

For entries fflate is about to consider, `unzipBounded` passes fflate an `UnzipFileInfo` filter callback
(`archive.ts:80-100`). fflate documents this filter as running during, and gating, extraction: whether the
callback returns true decides whether that entry gets decompressed at all (fflate `UnzipFileFilter`,
`node_modules/fflate/lib/index.d.ts:1403-1408`). Inside that callback, before any bytes are inflated:

- Compressed size (`f.size`, straight from the ZIP's own metadata) and declared original size
  (`f.originalSize`, falling back to the compressed size when `originalSize` is missing or not a valid
  non-negative number, `entryOriginal`, `archive.ts:55-60`) are checked against `maxEntryCompressed` and
  `maxEntryOriginal`. Either one over budget throws `ArchiveLimitError` (`archive.ts:85-89`).
- A running selected-entry count is checked against `maxEntries` (`archive.ts:90-92`).
- A running sum of declared original sizes is checked against `maxAggregateOriginal` (`archive.ts:93-95`).

An entry that fails `options.only` (a single named entry, used for detection) is skipped by returning
`false` before any of these checks run, so it is never inflated and never counted (`archive.ts:82`).

### Post-inflate, as a backstop

After `unzipSync` returns, `unzipBounded` walks the actual returned bytes a second time: per-entry
`data.byteLength` against `maxEntryOriginal`, and a running actual aggregate against
`maxAggregateOriginal` and `maxEntries` (`archive.ts:106-117`). This is what catches an entry whose
declared `originalSize` understated its real inflated size: the ZIP format lets a writer put whatever it
wants in that metadata field, so a hostile archive can claim a small original size and still inflate to
something much larger.

Be precise about what this backstop does and does not buy. By the time it runs, `unzipSync` has already
synchronously inflated every filter-accepted entry into memory; the recheck discards the oversized result
and throws, but it cannot stop the allocation that already happened. The 64 MiB `maxEntryCompressed` cap
bounds how much compressed input any one entry can carry, and raw DEFLATE's compression ratio has a
practical ceiling (on the order of 1000:1 for a pathological stream), so the worst case for a single entry
that lies about its original size is a large but bounded transient spike, not an unbounded one. There is no
evidence in this codebase of a streaming or incrementally-capped inflate that would reject such an entry
mid-decompression instead of after. No test in `src/core/archive.test.ts` constructs an entry whose declared
`originalSize` is smaller than its actual inflated size, so this specific backstop path is exercised by
review, not by a test.

### Fail closed on any read error

Anything `unzipSync` throws that is not already an `ArchiveLimitError` (a malformed ZIP, an unsupported
compression method, a truncated stream) is caught and rewrapped as `ArchiveLimitError("archive could not
be read safely")` (`archive.ts:101-104`). There is no partial-success path out of `unzipBounded`: either it
returns a fully-bounded `Record<string, Uint8Array>`, or it throws.

Callers differ in how they react to that throw, and it is worth being exact about the difference: Risu's
`detect()` catches everything and reports "not this format" (`src/formats/risu/index.ts:87-95`), while its
`toCanonical()` does not catch `ArchiveLimitError` at all and lets it propagate to the caller
(`risu/index.ts:97-99`). BYAF's `openByaf()` catches the throw internally and returns `null`
(`byaf-container.ts:40-44`), so a zip-bomb `.byaf` surfaces to `toCanonical()` as the generic `"byaf: not a
valid Backyard .byaf archive"` `Error`, not as `ArchiveLimitError` (`src/formats/backyard/byaf.ts:303-306`).
A caller that specifically checks `isArchiveLimitError` (`archive.ts:121-123`) will see it on the Risu path
and will not see it on the BYAF path; both paths fail closed, they just fail closed under different error
shapes.

### Detection is bounded too

Format detection never inflates a whole archive to check its shape. Risu's `detect()` calls `safeUnzip(b,
"card.json")`, so `unzipBounded`'s `only` filter skips every entry except `card.json` before any inflation
decision, while the entry that does match still passes the same compressed/original/count checks
(`risu/index.ts:87-95`). BYAF's detection reads only `manifest.json` the same way, through
`readManifestBytes` (`byaf-container.ts:142-148`, called from `byaf.ts:288-301`). A large hostile archive
being probed for its format cannot force a full inflate.

### The module.risum aside

A `.charx` can carry a `module.risum` sidecar. It is one more ordinary ZIP entry, so it is bounded by the
same `CARD_ARCHIVE_BOUNDS` as everything else in the archive; it adds no separate inflate step. Once
extracted, `module.risum` bytes are only ever run through RPack's byte substitution, a fixed 256-entry
table applied one byte at a time into a same-length output buffer, not a compression codec
(`src/formats/risu/rpack/codec.ts:8-19`). It cannot expand, so it introduces no additional zip-bomb surface
beyond the entry cap it already sits under.

@fig assurance

## Path-traversal safety on entry names

### fflate does not sanitize names

fflate's `unzipSync` returns each entry's name exactly as stored in the ZIP's own directory; there is no
`..`, backslash, or absolute-path filtering anywhere in `unzipBounded` or in fflate itself (no such handling
exists in `node_modules/fflate/esm/index.js` or `archive.ts`). A `.charx` or `.byaf` can legally contain an
entry named, for example, `../../../evil.json`, and `unzipBounded` will return it under that literal string
key if it fits the size and count budgets.

### Ingestion never turns a name into a filesystem write

That matters less than it would in a tool that extracts a ZIP to disk, because nothing in
`src/core/archive.ts`, `src/formats/risu/`, or `src/formats/backyard/` ever joins an entry name onto a real
OS path and writes it. Every entry name from `unzipBounded` is consumed one of two ways:

- As a key into an in-memory `Record<string, Uint8Array>` that gets base64-encoded straight onto the
  canonical `original` twin (Risu's `assetFiles`, `risu/index.ts:114-125`; BYAF's whole `files` map,
  `archiveToOriginal`, `byaf-container.ts:84-97`), or
- Reduced to just its basename before anything is decided from it (the sprite-pack ZIP importer takes
  `path.split("/").pop()` for both the "is this an image" check and the display label,
  `src/core/media/zip-import.ts:41,55`, so a `../` prefix there is inert).

There is no `Bun.write`, `writeFileSync`, or `fs.writeFile` call anywhere in `src/` that takes a zip entry
name as part of its target path (verified by search across the whole tree). A classic zip-slip, where
extracting a hostile archive overwrites a file outside the intended directory, has no code path to exploit
here today, because there is no code path that extracts an archive to disk by entry name at all.

### The one place a name becomes a fresh write, and it is checked

Export can still write a *new* file into a re-packed `.byaf`, and that one path is guarded. An alternate
greeting's id can name an archive-internal scenario path (`mintGreetingId`,
`src/formats/backyard/byaf-scenarios.ts:11-15`). On export, `resolveGreetingPath` is the only function
allowed to turn such an id back into a path, and it refuses anything shaped like traversal: an id must
start with the `byaf:` prefix, the remainder must not be empty, must not contain `..`, must not start with
`/`, and must not contain a backslash (`byaf-scenarios.ts:21-27`). Even past that filter, the resolved
path is only used if it is already a member of `knownPaths`, the set of scenario paths that existed in the
archive's own twin before the edit (`byaf-scenarios.ts:34`, called from `applyGreetingsToArchive`,
`byaf-scenarios.ts:131,137`). A hostile or unrecognized id can therefore at best name a scenario file that
was already legitimately part of the archive; it can never mint a new one. Any genuinely new scenario path
is generated by `freshScenarioPath`, which is never derived from user input at all
(`byaf-scenarios.ts:38-45`). This is exercised directly by test: `"hostile greeting id is never used as an
archive path"` feeds ids containing `../../../evil.json` and `scenarios/../manifest.json` through export and
asserts neither string appears as an output entry, and that every emitted scenario path still starts with
`scenarios/` and contains no `..` (`src/formats/backyard/byaf.test.ts:321-336`).

### Two places that are not checked the same way

Two other spots carry a name from the untrusted input archive into the entry table of a freshly-built
output archive, and neither has `resolveGreetingPath`'s traversal check or a test covering the hostile
case.

- **BYAF image rows.** `pathForLabel` looks up an existing `ch.images[]` row by label and, on a match,
  returns that row's `path` field verbatim (`src/formats/backyard/byaf.ts:196-204`). That value comes
  straight from the archive being read, so a hostile `.byaf` can put an arbitrary string there. The caller
  joins it onto the character directory (slashes normalized, backslashes flattened to forward slashes)
  and writes it as a key into the in-memory files map, `arc.files[full] = parsed.bytes`
  (`byaf.ts:210-212`), and `packByaf` later zips every key in that map, unmodified, as the output entry
  name (`byaf-container.ts:127-139`). Only the *fallback* filename, used when no existing row matches the
  label, is sanitized (strips everything but word characters, dot, and hyphen, `byaf.ts:221`); a path read
  from an existing row is not.
- **Risu `.charx` asset filenames.** The literal entry name captured during import
  (`assetFiles[path] = b64(data)`, iterating `Object.entries(files)`, `risu/index.ts:114-125`) is written
  back as the export entry name unmodified (`files[path] = unb64(s)`, `risu/index.ts:170-171`), then
  passed straight to `zipSync` (`risu/index.ts:181`).

Neither of these ever becomes a real filesystem write in this codebase, for the same reason ingestion does
not: the result is bytes handed back from `fromCanonical`, not a set of files extracted to disk. The
residual risk is downstream: the `.byaf` or `.charx` vaud re-exports can carry a ZIP entry whose name still
contains `..`, and a *different*, less careful tool that later unzips that exported archive by joining
entry names onto a real path could be the one that turns it into a traversal write. That is a real gap
against the goal of never re-emitting a traversal-shaped name, not a same-process exploit against vaud
itself. Call it what it is: verified as unguarded, and untested, not "safe by design" the way the greeting-id
path is.

## What is not yet proven

Proven and enforced: the pre-inflate archive-size, per-entry, count, and aggregate caps in
`unzipBounded`, all exercised by `archive.test.ts`; the fail-closed wrapping of any unzip error into
`ArchiveLimitError`; the `only`-mode short-circuit that keeps format detection cheap on a hostile archive;
and `resolveGreetingPath`'s traversal-and-known-path gate on the one BYAF export write path, exercised by
a hostile-id test.

Not yet proven:

- The post-inflate size backstop exists in code (`archive.ts:106-117`) but no test fabricates an entry
  whose declared `originalSize` understates its real inflated size, so the specific "lying header" case it
  exists to catch has not been exercised by a test, only reasoned about from the code.
- The BYAF image-row path (`byaf.ts:196-204,210-212`) and the Risu `.charx` asset filename
  (`risu/index.ts:114-125,170-171`) carry no traversal check before becoming an export entry name, and no
  test exercises a hostile path or filename on either one. Do not read the greeting-id defense as covering
  these; it does not.

Do not describe archive handling in this codebase as fully sandboxed against a hostile archive, or as
having path traversal solved in general. It is solved, and tested, for one specific write path. The rest of
this page is the honest map of what still needs the same treatment.
