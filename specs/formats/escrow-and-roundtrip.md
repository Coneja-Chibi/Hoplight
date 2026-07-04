# Spec: Escrow and the Round-Trip Law

The constitution of the format engine. Every codec spec and codec ticket links here.

## The Round-Trip Law

For every fixture F of format X:
`serialize(parse(F), X)` must be **semantically identical** to F.

"Semantically identical" means: parsing both again yields deep-equal canonical
entities AND deep-equal escrow. Byte-identity is NOT required (key order, whitespace,
PNG chunk ordering may differ) but is preferred where cheap. Each codec spec declares
its byte-identity level: `byte` (identical bytes), `canonical-json` (identical after
stable stringify), or `semantic` (the base guarantee).

CI enforcement: the harness auto-discovers `fixtures/<format>/**` and runs the law
against every fixture. A codec PR that reduces the pass count is rejected.

## Escrow envelope

```ts
interface Escrow {
  // fields the canonical model has no home for, keyed by the format that owns them
  [format: string]: {
    fields: Record<string, unknown>;  // JSON-pointer-ish keys -> original values
    version?: string;                 // source format/spec version
  };
}
```

Rules:

1. **Parse:** any source field a codec cannot map to canonical goes into
   `escrow[sourceFormat].fields` under its original name/path. Nothing is dropped,
   ever, at parse time.
2. **Serialize to the origin format:** escrowed fields for that format merge back
   into their original locations. This is what makes the Law hold.
3. **Serialize to a foreign format:** the codec expresses what it can from canonical;
   escrow from other formats is carried inside the target's extension mechanism when
   one exists (V2/V3 `extensions.vaudeville.escrow`, charx equivalents), else noted
   as `dropped` in the report.
4. **Conflict rule:** if a canonical field AND an escrowed field would write to the
   same output location, canonical wins (the user may have edited it) and the codec
   records `escrowShadowed` in the report.
5. Escrow is opaque to editing surfaces: editors never write into escrow; the agent
   may READ escrow to answer questions ("this card has a Risu-only field").

## Reports

`ParseReport` / `SerializeReport` (in `core`): counts + named lists of
`escrowed`, `dropped`, `escrowShadowed`, `warnings`. `vaud convert` prints them
honestly; `--strict` exits nonzero if `dropped` is nonempty.

## Capabilities matrix

Each codec exports `capabilities: Record<CanonicalFieldPath, "native"|"escrow"|"dropped">`.
The docs site's format-support matrix is generated from these exports (never
hand-edited), and the matrix is itself snapshot-tested so support changes are
visible in review.

## Fixture corpus rules

- Real files from real tools wherever possible (sanitize personal content).
- Every past misdetection/parsing bug becomes a permanent fixture (port the two PNG
  misdetection cases documented in VAUDEVILLE `content-detector.ts:40`).
- Each fixture folder: the input file, `expected.json` (canonical + escrow),
  `notes.md` (provenance: which app exported it, version, why it's interesting).
