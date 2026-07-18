# ADR-004: Code reuse, extract and adapt from RoleCall

**Status:** accepted

## Context

The author previously built RoleCall, a closed product whose engine solved several of the same
problems this project needs solved: character-card format parsing, lorebook round-trips, a macro
tokenizer, regex tooling. The same person holds the copyright on both codebases, so reusing that
work here is the author relicensing their own code, which a copyright holder may do; the AGPL choice
(ADR-002) binds licensees, not the holder.

## Decision

Port the format/engine layers from RoleCall into this project and evolve them freely here. A
detailed file-level map of that port is not kept in this repo, because it documents the internal
layout of a closed product.

What was ported, in broad strokes: preset parse/serialize, the lorebook engine (types, validation,
detection, parser/serializer, diff), character-card format codecs (PNG chunk read/write among them),
the macro tokenizer, and the regex builder core.

What was NOT ported: anything touching RoleCall's database, its UI components, or its agent
implementation. Lessons from those carried over as design input only (ADR-006).

## Rules that governed the port

1. Copy, then adapt: strip app-specific imports, retarget onto this project's canonical types, keep
   the original algorithm intact on the first pass.
2. Port the tests too. Characterization corpora (macro tests, lorebook round-trip tests) are more
   valuable than the code they pin.
3. Direction of flow is one-way (RoleCall -> here). The two lineages are cousins, not mirrors, and
   they are expected to drift.
