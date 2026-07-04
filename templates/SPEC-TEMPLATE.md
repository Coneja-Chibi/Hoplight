# Spec: <Title>

**Package:** `packages/<name>` · **Milestone:** M<n> · **Status:** draft | reviewed
**Depends on:** <spec links> · **VAUDEVILLE reference:** <paths from 05-EXTRACTION-MAP.md, or "none">

## Purpose

One paragraph: what this component does and why it exists. Written for an
implementing agent with no other context.

## Behavior

The heart of the spec. For format codecs: the field map table
(source field -> canonical field -> notes), detection rules, edge cases,
capabilities matrix (native/escrow/dropped per canonical field), byte-identity
level. For engines/features: inputs, outputs, state machine or event stream,
algorithms in prose + pseudocode where nontrivial.

## Public API sketch

```ts
// The exported surface, as TypeScript signatures. Implementations may refine
// internals but not this surface without a spec PR.
```

## Edge cases & failure modes

Numbered list. Every "what if" with its required behavior. Unknowns are marked
OPEN QUESTION, never guessed.

## Test plan

- Fixtures required (list each: source, what it exercises).
- Round-Trip Law applicability.
- Property/unit tests beyond fixtures.

## Non-goals

What this component explicitly does NOT do, to stop scope creep in tickets.

## Sources consulted

Links/paths: public spec documents, VAUDEVILLE files (with line refs), community
references. Every factual claim in Behavior should be traceable to one of these.
