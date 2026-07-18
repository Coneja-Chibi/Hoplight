# Spec: Token Counting

**Package:** `packages/core` (interface) + a small counting implementation consumed by `packages/lore`,
`packages/assembly`, `packages/presets`, `apps/cli`, `apps/studio` · **Milestone:** M0 (interface in
`core`), M1 (a real counting implementation ships with the Converter's reports), M5 (used live by the
Test Stage / prompt assembly trace) · **Status:** draft
**Depends on:** specs/formats/canonical-model.md (defines `TokenCounter` as a `core` interface) ·
**VAUDEVILLE reference:** `packages/lorebook/src/tokenizer.ts`

## Purpose

Every part of the studio that reports a token count - lorebook budgets, preset/prompt assembly
traces, the CLI's `inspect`/`convert` reports, the Test Stage's cost line - needs a single, honest
way to turn text into a number. This component defines that contract: a small `TokenCounter`
interface with zero dependencies in `core`, plus the concrete counting strategy the studio ships
with (a local BPE approximation, with room for a provider-exact count when a network call is
acceptable). It exists so every caller reports the same number for the same string, so the studio
never claims false precision about a model it hasn't actually asked, and so token counts can be
computed offline (no network, no API key) for the Converter's core promise: `vaud convert/inspect`
work with zero AI key configured.

## Behavior

### Ground truth from VAUDEVILLE

VAUDEVILLE has three near-identical copies of the same tokenizer utility:
`packages/lorebook/src/tokenizer.ts`, `apps/rc/src/lib/lorebook/tokenizer.ts`, and
`packages/persona-editor/src/lib/tokenizer.ts` (`packages/persona-editor/src/lib/tokenizer.ts:1-90`
is the uncached variant; the other two add an LRU-ish cache, VVS-518). All three:

1. Use `gpt-tokenizer` (a JS/TS port of OpenAI's `cl100k_base` BPE encoding) as the single counting
   backend for every model, via `encode(text).length` (`packages/lorebook/src/tokenizer.ts:30-51`).
2. Document explicitly that this is an *approximation* for non-OpenAI models: "Most LLMs use similar
   tokenization, so this gives a good approximation even for Claude, Llama, etc." (file header,
   `packages/lorebook/src/tokenizer.ts:1-9`). There is no Claude-specific or Llama-specific tokenizer
   anywhere in VAUDEVILLE.
3. Fall back to `Math.ceil(text.length / 4)` (the universal "4 chars ≈ 1 token" heuristic) if
   `encode()` throws (`packages/lorebook/src/tokenizer.ts:38-44`).
4. Cache counts by exact string match, not by (string, model) pair - because there is only one
   model family (`packages/lorebook/src/tokenizer.ts:23-24,32-37`, `TOKEN_COUNT_CACHE`, max 1000
   entries, FIFO-ish eviction by re-inserting on hit to approximate LRU with a `Map`'s insertion
   order).
5. Additionally expose: `countEntryTokens` (content + title, ignoring triggers) for lorebook
   entries; `countTotalTokens` (sum across entries); `estimateTokens` (human string like
   `"~250 tokens"`, rounds to nearest 10 above 10); `getTokenIds` (raw `encode()` output, for
   logit-bias use cases).

`apps/rc/src/lib/ai/inference-engine.ts:517-539` (`countMessagesTokens`) layers a chat-format
estimate on top of the same `encode()`: 4 tokens of overhead per message (role + separators) plus
`encode(content).length` plus `encode(role).length`, plus a flat 3-token "assistant reply primer."
This is the same OpenAI chat-format heuristic (`<|start|>{role}/{name}\n{content}<|end|>`) applied
regardless of the actual provider.

Critically, `inference-engine.ts:1757-1760` and `:2510` show the *real* production pattern for
usage/cost accounting: **prefer the provider's reported token usage when it exists, and only fall
back to the local `encode()`-based estimate when the provider didn't report one**:

```ts
const inputTokens = tokensFromUsage.prompt || countMessagesTokens(capturedMessages);
```

This is the load-bearing precedent for this spec: VAUDEVILLE never claims its local count *is* the
provider's real count. It uses the local count only as a pre-flight estimate (context budgeting,
lorebook trimming, UI display) or as a last-resort fallback for logging when the API didn't return
usage. Nothing in VAUDEVILLE calls a provider-side token-counting endpoint (e.g. Anthropic's
`POST /v1/messages/count_tokens`) before making a request.

### Why the studio does not do model-exact counting by default

1. **The Converter (v0.1) has zero AI key configured.** Any counting strategy that requires calling
   a provider's `count_tokens` endpoint is unavailable in the CLI's core codec/report path. The
   default counter must be fully local and offline.
2. Multiple model families are supported (`docs/02-ARCHITECTURE.md`: Anthropic, OpenRouter, OpenAI,
   Gemini, Ollama, OpenAI-compatible). Each has its own real tokenizer (Anthropic's is not public;
   OpenAI's is `cl100k_base`/`o200k_base` depending on model; Gemini's is different again). No
   single local library counts all of them exactly.
3. VAUDEVILLE's own resolution to this problem - one `cl100k_base`-based approximation used
   everywhere, documented as approximate, overridden by provider-reported usage after the fact - is
   the proven, ship-tested answer. This spec adopts it as the default strategy and additionally
   defines an opt-in exact path for callers that have a configured provider and want precision (the
   Test Stage cost line, `vaud inspect --exact-tokens`), consistent with the "honest counts, not
   fake precision" principle in canonical-model.md's `## Token counting` section.

### Public contract

`packages/core` defines the `TokenCounter` interface (canonical-model.md:66-70 already establishes
this exists in `core`; this spec fills in its shape and the studio's default implementation, which
lives outside `core` per the "ZERO deps on other packages" rule for `core`, docs/02-ARCHITECTURE.md
packages table). Canonical entities never store token counts - they are always computed on demand
through a `TokenCounter`.

### Counting strategies (model family selection)

| Strategy | Backend | Availability | Accuracy | Used by default for |
|---|---|---|---|---|
| `approximate` | Local BPE (`cl100k_base`-equivalent JS encoder, ported from VAUDEVILLE's `gpt-tokenizer` dependency) | Always, offline, no key | Approximation for every non-OpenAI-cl100k model (VAUDEVILLE's own documented caveat) | `vaud convert/inspect/validate`, lorebook budget UI, any report generated with no provider configured |
| `provider-exact` | The configured provider's own counting endpoint or local exact tokenizer, when the provider adapter (`packages/ai`) exposes one | Requires a configured BYOK key and network access | Exact for that provider/model | Test Stage cost line, prompt-assembly trace when a model is selected, `vaud inspect --exact-tokens <model>` |
| `charLength` | `Math.ceil(text.length / 4)` | Always | Coarsest; used only when `approximate` throws | Internal fallback inside `approximate`, never surfaced as a first-class strategy choice |

`provider-exact` is OPEN QUESTION in scope for M0/M1 (no provider adapters exist yet - `packages/ai`
is an M2 deliverable). This spec defines the interface shape so
`packages/ai` can implement it later without an interface break; M0/M1 ship `approximate` only.

### Model-family routing inside `approximate`

Because `approximate` is a single encoder applied to all models (matching VAUDEVILLE precedent),
routing by "model family" in M0/M1 is a no-op: every `model` argument maps to the same encoder. The
interface still accepts an optional `model` hint so that (a) call sites are already shaped correctly
for M2's `provider-exact` upgrade, and (b) the report can honestly print which model, if any, the
count was estimated *for* versus computed with a generic approximation. `TokenCounter.count` never
throws on an unrecognized model string - it always falls through to the generic approximation and
records that fact in `TokenCountResult.exact = false`.

### Caching

Per VAUDEVILLE VVS-518 (`packages/lorebook/src/tokenizer.ts:13-24`): BPE `encode()` is measurably
expensive under repeated re-tokenization of unchanged text (profiled at ~27% of JS time on a
fold-device UI that re-renders live token counts during streaming). The studio's counter must
reproduce this optimization:

- Cache key: the exact source string (not hashed, not truncated) - VAUDEVILLE caches on `text`
  alone, not `(text, model)`, which is only valid because it has one encoder; this spec's cache key
  is `(text, strategyId)` where `strategyId` is `approximate` for M0/M1 (equivalent to VAUDEVILLE's
  behavior) but leaves room for `provider-exact` results to cache separately per provider/model
  without colliding with the approximate cache.
- Bounded size (VAUDEVILLE: 1000 entries), FIFO/LRU-ish eviction (re-insert on hit to keep hot
  strings alive, per `packages/lorebook/src/tokenizer.ts:33-37`).
- Cache lives inside the `TokenCounter` implementation, never exposed on the canonical entity itself
  (canonical-model.md: "Every canonical entity exposes computed token stats through it, never stores
  them").
- Cache is per-process, in-memory only. No persistence, no cross-run sharing. Callers that need
  stable output across two runs (e.g. `vaud convert --json` piped into a diff) must not rely on
  cache state; the same input string always yields the same count regardless of cache hit/miss.

### Entry/aggregate helpers

Ported 1:1 from VAUDEVILLE's proven shape (`packages/lorebook/src/tokenizer.ts:56-98`), generalized
off "lorebook entry" to any titled/content-bearing unit so `packages/assembly` and `packages/presets`
can reuse them:

- `countTextTokens(text, opts?)` - the base primitive.
- `countUnitTokens(unit: { title?: string; content?: string })` - sums `content` + `title` token
  counts; does NOT count `triggers`/keywords (VAUDEVILLE's comment: triggers are matched against, not
  injected into the prompt, so they cost nothing at injection time - `packages/lorebook/src/tokenizer.ts:74-76`).
- `countTotalTokens(units[])` - sums `countUnitTokens` across a list.
- `estimateTokensLabel(text)` - human string: `"0 tokens"` for 0, exact for <10, else rounded to
  nearest 10 with a `~` prefix (`packages/lorebook/src/tokenizer.ts:91-98`, byte-identical logic).
- `getTokenIds(text)` - raw token ID array, kept for future logit-bias-style use cases even though
  no current spec consumes it; VAUDEVILLE exposes it (`packages/lorebook/src/tokenizer.ts:107-115`).

### Chat-message overhead estimate

`packages/assembly`'s prompt-assembly trace (specs/engine/prompt-assembly.md) needs a token count
for an assembled message list, not just raw text. Port VAUDEVILLE's `countMessagesTokens`
(`apps/rc/src/lib/ai/inference-engine.ts:517-539`) as `countMessagesTokens(messages[], opts?)`:
per-message overhead of 4 tokens (role + separator bookkeeping) + `count(content)` +
`count(role)`, plus a flat +3 for the assistant-reply primer. This is itself an approximation of
OpenAI's chat-format overhead and is documented as such - it is not claimed to be exact for
Anthropic/Gemini/local models, consistent with the rest of this spec's honesty requirement.

### Honest reporting

Every `TokenCountResult` carries an `exact: boolean` and a `basis` string (e.g.
`"cl100k_base-approx"`, `"claude-opus-4-8-exact"`, `"char/4-fallback"`). Any surface that prints a
token count (CLI report tables, lorebook budget bar, Test Stage cost line) must show this basis
when `--verbose`/equivalent is set, and MUST NOT print a bare number that implies provider-exact
precision when `exact` is false. `vaud inspect` without a configured provider prints counts with an
explicit `~` prefix (reusing `estimateTokensLabel`'s convention) to signal approximation.

## Public API sketch

```ts
// packages/core - zero-dependency interface + shared result/option types.
export type TokenCountBasis =
  | "cl100k_base-approx"
  | "char4-fallback"
  | `${string}-exact`; // e.g. "claude-opus-4-8-exact", provider/model specific

export interface TokenCountResult {
  count: number;
  /** true only when this came from a provider-exact count for the given model */
  exact: boolean;
  /** which strategy/encoder actually produced the number, for honest UI/report display */
  basis: TokenCountBasis;
  /** the model hint that was passed in, echoed back for trace/report purposes; undefined if none given */
  model?: string;
}

export interface TokenCountOptions {
  /** optional model identifier (e.g. "claude-opus-4-8", "gpt-4o"); a hint only in M0/M1 */
  model?: string;
  /** if true, callers are asking for provider-exact counting; implementations that cannot honor
   *  this MUST still return a result (exact: false) rather than throwing, so offline paths never break */
  requireExact?: boolean;
}

export interface TokenCounter {
  /** Count tokens in a single string. Never throws; falls back to char/4 estimate on internal encoder failure. */
  count(text: string, opts?: TokenCountOptions): TokenCountResult;

  /** Count content + title of a titled/content-bearing unit (lorebook entry, preset prompt, etc). Ignores trigger/keyword lists. */
  countUnit(unit: { title?: string; content?: string }, opts?: TokenCountOptions): TokenCountResult;

  /** Sum countUnit across a list of units. */
  countTotal(units: Array<{ title?: string; content?: string }>, opts?: TokenCountOptions): TokenCountResult;

  /** Estimate a chat message list's token cost (role/content overhead heuristic; see Behavior). */
  countMessages(
    messages: Array<{ role: string; content: string }>,
    opts?: TokenCountOptions
  ): TokenCountResult;

  /** Human-readable label: "0 tokens", "7 tokens", "~250 tokens". Never exact-prefixed. */
  estimateLabel(text: string, opts?: TokenCountOptions): string;

  /** Raw token IDs for the encoder actually used. Returns [] for an empty string. Reserved for
   *  future logit-bias-style consumers; no current spec calls this. */
  getTokenIds(text: string, opts?: TokenCountOptions): number[];
}

// packages/core - factory the rest of the engine imports. The concrete encoder implementation
// (bundled BPE data, cache) lives in a small internal module, NOT in core itself, per core's
// zero-deps rule; core only defines the shape + a lazy-loaded default.
export function createDefaultTokenCounter(): TokenCounter;

// packages/ai (M2) - extends the counter with provider-exact counting once an adapter/key exists.
// Not implemented in M0/M1; documented here so the M2 spec/ticket has a fixed target shape.
export interface ProviderTokenCounter extends TokenCounter {
  /** True if this provider/model can produce an exact count right now (key configured, network ok). */
  supportsExact(model: string): boolean;
}
```

## Edge cases & failure modes

1. **Empty string.** `count("")` returns `{ count: 0, exact: <depends on basis>, basis }`. Matches
   VAUDEVILLE's `if (!text) return 0;` guard (`packages/lorebook/src/tokenizer.ts:31`).
2. **Encoder throws (malformed input, encoder library bug).** Caught internally; falls back to
   `Math.ceil(text.length / 4)` with `basis: "char4-fallback"`, `exact: false`. Never propagates the
   exception to the caller. Matches VAUDEVILLE's `try/catch` around `encode()`
   (`packages/lorebook/src/tokenizer.ts:38-44`).
3. **`requireExact: true` but no provider configured (M0/M1, or M2 with no key set).** Returns the
   approximate result anyway with `exact: false` - never throws, never blocks a `vaud convert` run.
   Callers that need to *know* exactness failed check `.exact`, not a thrown error. This is required
   by the "works with zero AI key" invariant.
4. **Very large input (a whole production's worth of lorebook entries, multi-MB).** No explicit size
   cap in VAUDEVILLE; `encode()` scales with input size. This spec does not add a cap either, but
   notes it as a potential perf issue for `vaud inspect --exact-tokens` on huge productions -
   OPEN QUESTION: should there be a size threshold above which the CLI warns before running a
   provider-exact count (cost implications if `provider-exact` ever bills tokens for counting)?
5. **Cache growth under a long-running process (`apps/studio`, `vaud` REPL).** Bounded at the same
   1000-entry ceiling as VAUDEVILLE, evicted FIFO with hit-based re-insertion. A caller that streams
   many distinct large strings through `count()` (e.g. live-typing token counter) will see cache
   thrash but never unbounded memory growth.
6. **Two different models produce different counts for the same text, both routed through
   `approximate`.** By design in M0/M1: `approximate` ignores the `model` hint entirely for the
   actual counting math (same encoder for everything) but still echoes `model` back in the result
   for trace purposes. This is intentional and matches VAUDEVILLE precedent, not a bug - the
   `exact: false` flag is the signal that the number should not be trusted as model-specific.
7. **`countMessages` with a message whose `content` is empty string.** Still charges the fixed
   4-token per-message overhead (role/separator bookkeeping) even if content is empty, matching
   `inference-engine.ts:524-532`.
8. **Provider reports usage tokens that disagree with the local estimate (M2+).** Not this spec's
   concern to reconcile - `packages/ai`/`packages/agent` must prefer the provider's reported
   `usage.input_tokens`/`usage.output_tokens` over any local `TokenCounter` result for
   billing/logging, exactly as VAUDEVILLE does (`inference-engine.ts:1759-1760`: `tokensFromUsage.prompt
   || countMessagesTokens(...)`). This spec's counter is the *fallback*, never the source of truth,
   once a provider is in the loop.
9. **Unicode / multi-byte content (emoji, CJK, RTL scripts).** No VAUDEVILLE-documented special
   casing found; the BPE encoder handles this natively as part of its normal operation. No
   additional logic required here. OPEN QUESTION: has VAUDEVILLE observed any encoder crashes on
   specific Unicode edge cases that fed the `try/catch` fallback in practice? Not evidenced in the
   read source; flagging rather than guessing.

## Test plan

- Fixtures required:
  - `fixtures/token-counting/plain-ascii.txt` - exercises the base `count()` path against a known
    reference count (compute once with the bundled encoder and pin the expected number as a
    regression fixture).
  - `fixtures/token-counting/empty-string.txt` - exercises edge case 1.
  - `fixtures/token-counting/unicode-mixed.txt` (emoji + CJK + RTL) - exercises edge case 9,
    confirms no throw.
  - `fixtures/token-counting/lorebook-entry-sample.json` - a `{title, content, triggers}` object;
    confirms `countUnit` sums title+content and ignores `triggers`.
  - `fixtures/token-counting/chat-messages-sample.json` - an array of `{role, content}` messages;
    confirms `countMessages` overhead math (4/message + role + content + 3 flat).
- Round-Trip Law applicability: none - this is not a codec, no parse/serialize round trip applies.
- Property/unit tests beyond fixtures:
  - `count(text).count >= 0` for all inputs, including empty and pathological (very long single
    "word" with no whitespace) strings.
  - Cache correctness: calling `count()` twice on the identical string returns the identical
    `TokenCountResult` (same `count`, `basis`, `exact`) without re-invoking the encoder a second
    time (spy/mock the encoder call count).
  - Cache bound: pushing >1000 distinct strings through `count()` never grows the internal cache
    map beyond 1000 entries (inspect internal state in a white-box test, or expose a debug-only
    `cacheSize()` for the test).
  - Encoder-failure fallback: monkeypatch the encoder to throw; assert `basis === "char4-fallback"`
    and `count === Math.ceil(text.length / 4)`.
  - `estimateLabel` boundary values: 0 → `"0 tokens"`; 9 → `"9 tokens"`; 10 → `"~10 tokens"`; 247 →
    `"~250 tokens"` (matches VAUDEVILLE's round-to-nearest-10 behavior,
    `packages/lorebook/src/tokenizer.ts:94-97`).
  - `requireExact: true` with no provider configured never throws and always returns `exact: false`.

## Non-goals

- Does not implement a provider-exact tokenizer for any specific model family in M0/M1. That is
  explicitly deferred to `packages/ai` (M2) via the `ProviderTokenCounter` extension point sketched
  above.
- Does not attempt to replicate Anthropic's, OpenAI's `o200k_base`, or Gemini's actual tokenizers
  locally. VAUDEVILLE never did this either; replicating it is out of scope for this component and,
  if ever wanted, belongs in a provider adapter that calls the real counting endpoint rather than a
  local re-implementation.
- Does not persist or share the token-count cache across processes or sessions.
- Does not compute or store token counts on canonical entities themselves - per canonical-model.md,
  token stats are always computed on demand through this interface, never stored as entity fields.
- Does not handle cost/pricing calculation (dollars per token) - that is a provider-adapter/billing
  concern layered on top of a token count, not part of this spec.
- Does not define the UI/CLI rendering of token counts (progress bars, budget meters) - only the
  data (`TokenCountResult`, `estimateLabel`) those surfaces consume.

## Sources consulted

- `<RoleCall>\packages\lorebook\src\tokenizer.ts` (full file, lines 1-116):
  primary reference - `countTokens`, `TOKEN_COUNT_CACHE`/VVS-518 caching rationale, `countEntryTokens`,
  `countTotalTokens`, `estimateTokens`, `getTokenIds`, the `gpt-tokenizer`/`cl100k_base`
  approximation-for-all-models documentation in the file header.
- `<RoleCall>\apps\rc\src\lib\lorebook\tokenizer.ts` (lines 1-119): duplicate
  of the above with an expanded cache-recency comment; confirms the pattern is intentionally
  repeated app-side, not a one-off.
- `<RoleCall>\packages\persona-editor\src\lib\tokenizer.ts` (lines 1-90):
  third copy, uncached variant; confirms the core counting logic (`encode().length`, char/4
  fallback) is stable across all three copies.
- `<RoleCall>\apps\rc\src\lib\ai\inference-engine.ts` lines 31, 513-539
  (`countMessagesTokens`, the per-message/role overhead heuristic), and lines 1750-1770, 2505-2515
  (`tokensFromUsage.prompt || countMessagesTokens(...)` - provider-usage-first pattern that
  justifies this spec's `exact`/`basis` fields and the "local counter is a fallback, not a source of
  truth once a provider is in play" rule).
- `docs\02-ARCHITECTURE.md`: `packages/core` "token
  counting interfaces… ZERO deps on other packages" and `packages/ai` provider-adapter description
  (BYOK Anthropic/OpenRouter/OpenAI/Gemini/Ollama) - basis for the `core` interface / provider-adapter
  split and for `ProviderTokenCounter` being an M2 concern.
- `specs\formats\canonical-model.md`: `## Token counting`
  section ("`core` defines `TokenCounter` as an interface... implementations live outside core...
  never stores them") - the authoritative statement this spec fills in.
- Anthropic's public API documentation: confirms a real
  provider-exact endpoint exists (`POST /v1/messages/count_tokens`, model-specific, "Do not use
  `tiktoken`... undercounts Claude tokens by ~15-20%"). Cited only as external corroboration that
  local BPE approximations are provider-inexact in practice, and as the shape a future
  `ProviderTokenCounter` implementation for Anthropic would call. No VAUDEVILLE code calls this
  endpoint today, so it is not treated as ground truth for this codebase's current behavior - it is
  the target for the M2 OPEN QUESTION item on `provider-exact`.
