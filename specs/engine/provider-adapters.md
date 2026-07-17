# Spec: Provider Adapters

**Package:** `packages/ai` · **Milestone:** M2 · **Status:** draft
**Depends on:** `packages/core` (canonical types, no other engine package) ·
**VAUDEVILLE reference:** `apps/rc/src/lib/providers/types.ts`,
`apps/rc/src/lib/providers/adapters/base.ts`,
`apps/rc/src/lib/ai/prompted-tool-calls/index.ts` - reference reading for wire
facts and lessons learned; this package is a fresh implementation, not a port
(RC's code is server-side, multi-tenant, and entangled with its own DB/billing
layer; Vaudeville's adapters run entirely on the user's machine against keys
the user supplied)

## Purpose

`packages/ai` is the thin, provider-agnostic layer that turns a canonical
`ChatRequest` into a real HTTP call against whichever model provider the user
configured (Anthropic, OpenAI, Gemini, OpenRouter, or any OpenAI-compatible
endpoint including local runtimes like Ollama/LM Studio/koboldcpp), and turns
that provider's response - streamed or not - back into a canonical
`ChatResponse`/`ChatStreamEvent` sequence. It is the single point where
Vaudeville Studios' internal message/tool-call shape meets each provider's
wire format, including the differences in system-prompt handling, tool-call
encoding, streaming envelope, and reasoning/thinking round-trip. It also owns
the prompted-XML tool-calling fallback: the exact grammar a model without
native function-calling emits, and the parser that recovers structured tool
calls from it. Everything above this package (the agent loop, the Test Stage,
the CLI) talks only to `ChatRequest`/`ChatResponse` and never touches a
provider SDK or a raw fetch call directly.

This package assumes a **single resolved provider config per call** (provider
id, model id, decrypted key/base URL, sampler settings). Choosing which
provider/model to use for a given role (interview vs. treatment vs. test-stage
vs. audit) is `key-vault.md`'s job; this package receives the resolution as
input and does not select providers itself. It performs no cross-provider
fallback, no cost accounting, and no multi-tenant routing - those are the
concerns of RoleCall's separate `packages/router` (a billed, multi-tenant
aggregator-routing system) and are explicitly out of scope here (see
Non-goals).

## Behavior

### 1. Canonical request/response shape

`packages/ai` defines its own message/request/response types in terms of
`packages/core` primitives (token counter interface, ids) and nothing else.
The shape mirrors RC's `ProviderRequest`/`ProviderResponse`/`ChatMessage`
(`apps/rc/src/lib/providers/types.ts:340-522`) with the multi-tenant/billing
fields stripped:

- `ChatMessage` carries `role`, `content`, optional `images`, optional
  `toolCalls` (assistant turns), optional `toolCallId`/`toolName` (tool-result
  turns), and optional `reasoning` (provider-tagged, for round-trip).
- `ChatRequest` carries `messages`, `model` (already-resolved provider model
  id), `stream`, `samplers`, `tools`, `toolChoice`, and a `providerConfig`
  (auth + endpoint, resolved by the caller from the vault).
- `ChatResponse` carries `content`, `toolCalls`, `finishReason`, `usage`
  (token counts only - no cost fields), and optional `reasoning`.

Field names are normalized to camelCase; provider wire format is the
adapter's private concern.

### 2. Adapter contract

One adapter module per provider family. Every adapter implements:

```
detect the provider's config → build the outbound request (headers + body)
→ execute (fetch, streaming or not) → parse the response back to
ChatResponse / a ChatStreamEvent sequence
```

Two adapter styles, matching what RC's `base.ts` already discovered works:

- **OpenAI-compatible adapters** (OpenAI, OpenRouter, Ollama/LM
  Studio/koboldcpp and any other `/v1/chat/completions`-shaped endpoint):
  build the request body directly in OpenAI's wire shape; a single shared
  `openAICompatibleAdapter` handles all of them, parameterized by
  `providerConfig` (base URL, auth header style, which optional OpenAI
  fields - `stream_options`, `parallel_tool_calls` - are safe to send).
- **Translating adapters** (Anthropic, Gemini): the wire format differs
  enough (Anthropic Messages API, Gemini `generateContent`/`streamGenerateContent`)
  that the adapter translates canonical messages into the provider's native
  request shape and translates native streaming/response events back into
  canonical `ChatStreamEvent`s. This mirrors the `transformRequest` /
  `transformResponseStream` / `authHeaders` escape hatches in
  `packages/router/src/types.ts:110-134`, but scoped to a single-key, no-billing
  caller.

### 3. Message translation rules (grounded in production wire facts)

These are real provider requirements observed in production
(`apps/rc/src/lib/providers/adapters/base.ts`), not invented:

- **OpenAI / OpenAI-compatible:** an assistant message whose only content is
  tool calls MUST have `content: null`, not `""` - several strict
  OpenAI-compatible servers (DeepSeek, some proxies) 400 or silently return an
  empty body otherwise (`base.ts:507-518`). Tool-result messages carry
  `tool_call_id` and `name`. When the user message includes images, content
  becomes an array of `{type:"text"}`/`{type:"image_url"}` parts.
- **Anthropic Messages API:** only the *contiguous leading* run of
  `role:system` messages is hoisted into the top-level `system` field; any
  system message appearing after the first user/assistant turn is rewritten
  to `role:user` and kept inline so it stays adjacent to the turn it
  anchors (`base.ts:544-565`). Tool-result messages become a `user`-role turn
  with a `tool_result` content block referencing the prior `tool_use` block's
  id - Anthropic rejects tool results sent as plain strings (`base.ts:585-604`).
  Consecutive same-role messages must be merged (Anthropic rejects repeated
  roles), and the first message must be `role:user` (synthesize a placeholder
  if not). Assistant turns with tool calls become a content array of an
  optional leading `text` block plus one `tool_use` block per call
  (`base.ts:610-647`). Extended-thinking round-trip requires the `thinking`
  content block (with its original `signature`) to be the *first* block of an
  assistant turn, or the API rejects the request (`base.ts:684-699`).
  Auth is `x-api-key` + `anthropic-version` header, not Bearer
  (`anthropic-direct.ts:47-55` - Router uses this same header set for the
  official direct API).
- **Gemini:** same contiguous-leading-system rule, mapped to
  `systemInstruction` (`base.ts:771-796`). Tool calls map to `functionCall`
  parts (role `model`); tool results map to `functionResponse` parts (role
  `function`). Gemini 2.0+/3+ thinking models attach a `thoughtSignature` to
  each `functionCall` part and REQUIRE it echoed back verbatim on the next
  request's matching functionCall, or the API 400s with "Function call is
  missing a thought_signature in functionCall parts" (`base.ts:822-830`,
  `types.ts:352-364`). This signature is opaque - never inspect or mutate it,
  only carry it.
- **OpenRouter:** reasoning round-trips through a `reasoning_details` array
  that must be echoed back **unmodified and in the same order** the model
  emitted it, on assistant messages that carry `tool_calls`. Without it,
  Gemini-3-class models routed through OpenRouter stall: they emit a fresh
  encrypted reasoning block with `finish_reason: "stop"` and zero tool calls
  instead of continuing (`types.ts:385-406`, `base.ts:520-534`).
- **Local / custom OpenAI-compatible endpoints:** many reject unknown
  OpenAI-only fields with a 400. `stream_options: {include_usage:true}` and
  `parallel_tool_calls: true` are opt-in per provider capability, never sent
  unconditionally (`types.ts:146-158`). Base-URL resolution must preserve an
  explicit version segment the user typed (e.g. `/v3`, `/v2`) rather than
  silently downgrading to `/v1` (`base.ts:196-303`, the exact bug pinned by
  RC's `buildUrl.test`).

### 4. Streaming

`ChatRequest.stream = true` yields an async iterable of `ChatStreamEvent`:

```ts
type ChatStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call-delta"; index: number; id?: string; name?: string; argsDelta?: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; finishReason: FinishReason }
  | { type: "error"; error: ProviderError };
```

Each adapter is responsible for converting its provider's native SSE (or
chunked JSON) format into this event sequence. OpenAI-compatible providers
emit `choices[].delta.content` / `.tool_calls` / `.reasoning_content` chunks
directly; translating adapters (Anthropic, Gemini) run their own SSE parser
and re-emit the same canonical events - there is no requirement to normalize
through an intermediate OpenAI-shaped SSE format the way RC's Router does
(`router/src/types.ts:126-134`); adapters here go straight from native wire to
canonical events. Usage is emitted as its own event when a provider streams
it (OpenAI-compatible providers with `stream_options.include_usage`,
Anthropic's final `message_delta`, Gemini's final chunk); providers that never
report usage on stream leave the `usage` event out - callers fall back to
`TokenCounter` estimates (see `token-counting.md`) and must treat the number
as approximate, never invented as if authoritative.

### 5. Native tool-use per provider

When `ChatRequest.tools` is set and the resolved model's capability profile
says it supports native tool-calling, the adapter sends tools in the
provider's native shape and parses native tool-call output into
`ChatResponse.toolCalls: Array<{id, name, arguments: string}>` - `arguments`
is always a JSON string (matches the OpenAI convention every downstream
caller expects), even though Anthropic and Gemini return already-parsed
objects natively; the adapter serializes them. Native tool-schema shapes,
confirmed against RC's per-provider adapters:

- **OpenAI-compatible:** `tools: [{type:"function", function:{name, description, parameters, strict?}}]`
  (matches `ProviderRequest.tools` already - pass-through, no translation).
- **Anthropic:** `tools: [{name, description, input_schema}]`, where
  `input_schema` is the OpenAI `function.parameters` JSON schema carried over
  unchanged (`apps/rc/src/lib/providers/adapters/anthropic.ts:184-193`).
  `tool_choice` maps `"required"` to `{type:"any", disable_parallel_tool_use:false}`,
  `"none"` to `{type:"none"}`, `"auto"`/an explicit function name to
  `{type:"auto"|"tool", ...}` - Anthropic disables parallel tool use by
  default under `"any"`/`"tool"` choice, so `disable_parallel_tool_use:false`
  must be sent explicitly to get multiple calls in one response
  (`anthropic.ts:195-220`). Anthropic also requires `max_tokens` on every
  request (adapter defaults to 4096 when the caller didn't set one) and
  rejects `temperature` and `top_p` set together - the adapter prefers
  `temperature` when both are present (`anthropic.ts:223-239`).
- **Gemini:** `tools: [{functionDeclarations: [{name, description, parameters}]}]`,
  with `parameters` passed through a Gemini-specific JSON-schema sanitizer
  (Gemini's schema dialect rejects some JSON-Schema keywords OpenAI/Anthropic
  accept) (`apps/rc/src/lib/providers/adapters/google.ts:258-264`). The
  endpoint itself switches on streaming: `:generateContent` for a plain call,
  `:streamGenerateContent` for `stream:true` (`google.ts:38,49`). Samplers map
  to a `generationConfig` object: `temperature`, `top_p`→`topP`,
  `top_k`→`topK`, `max_tokens`→`maxOutputTokens` (`google.ts:218-229`).

### 6. Prompted-XML fallback protocol (weak-model tool-calling)

Grounded verbatim in the production mechanism at
`apps/rc/src/lib/ai/prompted-tool-calls/index.ts` (same approach as Cline /
OpenHands / Aider). Used when the resolved model's capability profile says it
has no reliable native tool-calling, or when the caller explicitly forces
prompted mode (e.g. for eval-harness comparison).

**Wire grammar.** The model is instructed (via a system-prompt appendix) to
emit blocks of the exact form, inline in its normal text content:

```
<tool_call>
{"name": "tool_name_here", "args": { ... }}
</tool_call>
```

Rules of the grammar (all enforced by the renderer/parser, not left to model
discipline):

1. One tool call per `<tool_call>...</tool_call>` block. Multiple blocks in
   one reply mean multiple calls in that turn.
2. The body is a JSON object with a required string `name` and an optional
   object `args` (default `{}` if omitted).
3. No code-fence wrapping - the literal tags are the only delimiters. A
   leading ```` ```json ```` /```` ```xml ```` /```` ```tool_call ```` fence or a
   stray `json` prefix is stripped by the parser's pre-clean pass, but the
   renderer's instructions tell the model not to add one.
4. Arbitrary prose/thinking text may appear between, before, and after
   blocks; only text inside the tags is treated as a call.
5. The `tools` field is dropped from the outbound request body entirely in
   prompted mode - the call goes through the regular content/text path, no
   provider tool-calling wire feature is engaged.
6. When the model has no tools available this turn, the renderer emits a
   short "tool calling disabled" note instead of a catalog, so the model
   doesn't hallucinate calls.
7. The tool catalog rendered into the prompt is the complete, exhaustive
   list of names callable this turn; the instructions explicitly forbid the
   model from inventing snake_case tool names or claiming a tool exists that
   isn't listed.
8. Ending the loop: a reply with zero `<tool_call>` blocks is the model's
   final answer - the fallback protocol does not use a separate "done" marker.

**Rendering.** `renderToolCatalog(tools: PromptedTool[]): string` builds the
instruction block + one `###` entry per tool (name, one-line summary,
`Args:` list with type/required/enum/description per property), for
appending to the assembled system prompt. `PromptedTool` is the minimal
`{name, description, summary?, parameters}` shape - any canonical tool
definition satisfies it structurally.

**Parsing.** `parseToolCallBlocks(content: string, toolsByName: Map<string, PromptedTool>): Promise<ParsedToolCall[]>`:

1. Scan `content` for `<tool_call>`/`</tool_call>` spans. A block with no
   closing tag takes everything to the end of `content` and is flagged
   `parseError: "missing </tool_call> closing tag"` (but still attempted).
2. Pre-clean the body (strip a leading `json` token, strip accidental code
   fences).
3. Repair-parse the envelope (`{name, args}`) through a forgiving
   JSON-repair pipeline (tolerates trailing commas, unquoted keys, smart
   quotes, truncated braces) against a generic `{name: string, args?: object}`
   schema.
4. If a `name` was recovered and it matches a known tool, repair-parse `args`
   a second time against *that tool's* parameter schema (coercing types,
   dropping unrecognized fields) for a stronger recovery than a schema-less
   parse.
5. If `name` doesn't match any known tool, still return best-effort parsed
   `args` (schema-less) so the caller can report "tool not in scope" instead
   of a hard parse failure.
6. Every parsed call gets a synthetic, deterministic `id` (hash of tool name
   + block index + raw block text) so results are stable to dedup across
   repeated turns.

`parseToolCallBlocks` returns `ParsedToolCall` - the richer prompted-mode
product, carrying source spans (`startIndex`/`endIndex`/`rawBlock`) needed
for stripping the block from displayed text and an `args: object` (not yet
JSON-stringified). This is deliberately a different shape from the native
`ToolCall`. The agent loop is the single place these converge: for each
successfully parsed call with no `parseError`, it normalizes to the
canonical `ToolCall` via `{id, name, arguments: JSON.stringify(args)}` before
handing it to the same dispatch path native tool calls use. This package
never performs that normalization itself - see the agent-loop boundary note
below.

**Streaming display.** `stripToolCallBlocksStreaming(prefix: string, chunk: string): {visible: string; carry: string}` strips `<tool_call>` spans from a live token stream so the UI shows prose only, never the literal call markup, while the *unstripped* accumulated text is what actually gets parsed for dispatch. Callers must feed `carry` from the previous call in as `prefix` on the next chunk to handle a tag boundary split across stream chunks.

**Boundary with the agent loop.** This package defines the grammar and the
render/parse functions only. Deciding *when* to switch a given model to
prompted mode (the capability profile), enforcing one-tool-call-per-turn on
weak models, dispatching the parsed calls against the live tool registry, and
retrying on parse failure are the agent loop's job (`agent-loop.md`).

### 7. Retries, timeouts, and error classification

No cross-provider fallback (single resolved provider per call - that's a
router concern, out of scope here). Within a single provider, adapters apply:

- **Retryable** (same-provider, exponential backoff): HTTP 429, 5xx, and
  network-level failures (connect refused/reset, DNS failure, timeout).
  Design default: up to 3 attempts, base delay 1s, backoff factor 2, honoring
  a provider's `Retry-After` header when present.
- **Fail-hard, no retry** (surface to caller immediately): HTTP 401/403
  (bad or unauthorized key - `provider_misconfigured`), HTTP 400 (malformed
  request - `input_rejected`), and content-policy refusals (provider-specific
  shape, classified `content_policy_refusal`, not a transport failure).
- **Timeouts** (design defaults, all configurable): connect/first-byte
  timeout 30s, per-chunk stream idle timeout 60s (a stream that stops
  producing bytes for this long is treated as `stream_interrupted`), total
  call timeout 10 minutes (generous for slow local models / long generations).
- Every error surfaces as a typed `ProviderError` with a stable `code`. It
  extends RC's non-routing `RouteErrorCode` members (`provider_misconfigured`,
  `input_rejected`, `content_policy_refusal`, `stream_interrupted` - see
  `packages/router/src/types.ts:150-157`) with three codes this single-key
  context needs that the multi-provider router does not (`rate_limited`,
  `timeout`, `network_error`), plus a `unknown` catch-all. Full vocabulary:
  `provider_misconfigured | input_rejected | content_policy_refusal |
  stream_interrupted | rate_limited | timeout | network_error | unknown`. This
  lets callers (CLI reports, agent loop, Test Stage) render a consistent
  message without inspecting provider-specific error bodies.

### 8. OpenAI-compatible catch-all for local models

Any endpoint not natively recognized is handled by the shared OpenAI-compatible
adapter, parameterized entirely by user config: base URL (with the
version-segment-preserving resolution described in §3), optional explicit
`chat_completions_endpoint`/`models_endpoint` overrides, auth style (`bearer`,
`none`, or a custom header), and capability flags the user or a connection
test determines (`supportsStreamOptions`, `supportsParallelToolCalls`,
`isOpenAICompatible` sampler support). This is the single code path for
Ollama, LM Studio, koboldcpp, vLLM, and any unnamed OpenAI-compatible proxy -
no per-tool special-casing beyond the generic override fields.

### 9. Model capability profiles

Each configured model carries a small capability profile (native tool-calling
yes/no, supports streaming usage, supports extended thinking/reasoning,
default context window) that adapters and callers consult to decide native
vs. prompted tool-calling and whether to request reasoning round-trip. The
profile is data (a lookup table keyed by provider + model id pattern, with a
manual override in the model-role config), not hardcoded per adapter.
OPEN QUESTION: exact source/format of the capability-profile table (bundled
static list vs. fetched-and-cached vs. user-editable) is not decided; punt to
the eval-harness ticket (ADR-006 pt. 5) which needs the same data.

## Provider capability matrix

| Provider | Auth method | Native tool-use | Streaming shape | Reasoning/signature round-trip | Sampler support | Usage in stream |
|---|---|---|---|---|---|---|
| Anthropic | `x-api-key` + `anthropic-version` header | Yes (`tools`, `tool_use`/`tool_result` blocks) | Native SSE (Messages API), translated to canonical events | `thinking` block + `signature`, must lead the assistant turn | `temperature` OR `top_p` (mutually exclusive, temperature preferred when both set), `top_k`, `max_tokens` (required - adapter defaults 4096); no frequency/presence penalty; temperature/top_p/top_k all dropped when extended thinking is enabled | Final `message_delta` usage frame |
| OpenAI | `Authorization: Bearer` | Yes (`tools`, `tool_calls`) | OpenAI chat-completion-chunk SSE | `reasoning_content` on o-series/reasoning models (same-model gated) | temperature, top_p, frequency_penalty, presence_penalty, max_tokens | Only with `stream_options.include_usage` |
| Gemini | `?key=` query param (or OAuth for Vertex, out of v1 scope) | Yes (`functionDeclarations`, `functionCall`/`functionResponse`) | Native SSE (`:streamGenerateContent` endpoint variant), translated to canonical events | `thoughtSignature` on functionCall parts; MUST be echoed on the next request's matching call or the API 400s | `temperature`, `top_p`→`topP`, `top_k`→`topK`, `max_tokens`→`maxOutputTokens`, all nested under `generationConfig`; no frequency/presence penalty | Reported on final chunk |
| OpenRouter | `Authorization: Bearer` | Yes, proxied per underlying model | OpenAI-compatible SSE | `reasoning_details` array - must round-trip verbatim, same order, unmodified | Passthrough of underlying model's supported set | With `include_reasoning`/usage opt-in |
| OpenAI-compatible (local: Ollama/LM Studio/koboldcpp/vLLM/custom) | Bearer, none, or custom header | Varies - many report no native tool-calling; prompted-XML fallback is the default assumption | OpenAI-compatible SSE (implementation quality varies) | None assumed unless the profile says otherwise | Varies; unknown fields (`stream_options`, `parallel_tool_calls`) can 400 - gated by capability flags | Rare; assume absent unless capability-tested |

## Public API sketch

```ts
// packages/ai/src/types.ts - imports only from packages/core.

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  /** Always a JSON string, even for providers that return parsed objects natively. */
  arguments: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
  images?: string[];
  toolCalls?: ToolCall[];       // assistant turns that initiated tool calls
  toolCallId?: string;          // tool-result turns
  toolName?: string;            // tool-result turns
  reasoning?: {
    text: string;
    signature?: string;         // Anthropic thinking signature / Gemini thoughtSignature
    provider?: "anthropic" | "openai" | "openrouter" | "gemini";
  };
  reasoningDetails?: Array<Record<string, unknown>>; // OpenRouter verbatim echo
}

export interface ProviderConfig {
  providerId: "anthropic" | "openai" | "gemini" | "openrouter" | "openai-compatible";
  /** Decrypted secret, resolved by the caller from the key vault. Never logged. */
  apiKey?: string;
  baseUrl?: string;               // openai-compatible only
  chatCompletionsEndpoint?: string; // explicit override
  customHeaders?: Record<string, string>;
  capabilities?: {
    supportsStreamOptions?: boolean;
    supportsParallelToolCalls?: boolean;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  summary?: string;
  parameters: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;               // already-resolved provider model id
  stream: boolean;
  samplers: {
    temperature?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    maxTokens?: number;
  };
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  /** Force prompted-XML mode regardless of the model's native tool-calling capability. */
  forcePromptedTools?: boolean;
  provider: ProviderConfig;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** True when derived from TokenCounter estimate, not provider-reported. */
  approximate: boolean;
}

export type FinishReason = "stop" | "length" | "content_filter" | "tool_calls";

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: FinishReason;
  usage?: TokenUsage;
  reasoning?: { text: string; signature?: string };
}

export type ChatStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call-delta"; index: number; id?: string; name?: string; argsDelta?: string }
  | { type: "usage"; usage: TokenUsage }
  | { type: "done"; finishReason: FinishReason }
  | { type: "error"; error: ProviderError };

export type ProviderErrorCode =
  | "provider_misconfigured"
  | "input_rejected"
  | "content_policy_refusal"
  | "stream_interrupted"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "unknown";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly providerId: string,
    public readonly cause?: unknown,
  ) { super(message); }
}

// packages/ai/src/adapter.ts

export interface ProviderAdapter {
  readonly id: ProviderConfig["providerId"];
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatStreamEvent>;
  /** Lightweight connectivity/key check, used by the vault's "test connection" UI. */
  testConnection(config: ProviderConfig): Promise<{ ok: boolean; error?: string; models?: string[] }>;
}

export function getAdapter(providerId: ProviderConfig["providerId"]): ProviderAdapter;

// packages/ai/src/prompted-tools.ts

export interface PromptedTool {
  name: string;
  description: string;
  summary?: string;
  parameters: ToolDefinition["parameters"];
}

export interface ParsedToolCall {
  startIndex: number;
  endIndex: number;
  rawBlock: string;
  name: string;
  args: Record<string, unknown>;
  id: string;
  parseError?: string;
}

export function renderToolCatalog(tools: PromptedTool[]): string;
export function parseToolCallBlocks(
  content: string,
  toolsByName: Map<string, PromptedTool>,
): Promise<ParsedToolCall[]>;
export function stripToolCallBlocksStreaming(
  prefix: string,
  chunk: string,
): { visible: string; carry: string };
```

## Edge cases & failure modes

1. **No key configured for any provider.** The adapter layer must not be
   invoked; callers check `key-vault.md`'s resolution first. AI is optional
   (ADR-006 pt. 2) - every non-AI command must work with zero adapters wired.
2. **Prompted block with no closing tag.** Parser takes content to end of
   string, still attempts JSON repair, and flags
   `parseError: "missing </tool_call> closing tag"`. Caller may still dispatch
   if `name` recovered cleanly.
3. **Malformed JSON inside a prompted block.** Repair pipeline attempts
   recovery (unquoted keys, trailing commas, smart quotes); on total failure
   the call is returned with a `parseError` and the caller (agent loop) is
   expected to retry-on-parse-fail rather than crash the turn.
4. **Multiple `<tool_call>` blocks with prose between them.** All are parsed
   independently in document order; prose outside blocks is not touched.
5. **Model invents a tool name not in the catalog.** Parsed with best-effort
   schema-less args; caller reports "tool not in scope," not a parse crash.
6. **OpenAI-compatible target rejects `content:""` + `tool_calls`.** Adapter
   must normalize empty string content to `null` on any assistant message
   carrying `tool_calls` before serializing (see §3).
7. **Gemini thinking model missing `thoughtSignature` on a follow-up
   `functionCall`.** Provider returns HTTP 400. The adapter must always echo
   the `thoughtSignature` it received on a prior `ChatMessage.toolCalls[]`
   entry back onto the corresponding `functionCall` part when that message is
   re-sent as history - if the caller fails to preserve the signature across
   turns, that is a caller bug the adapter cannot repair for; adapter tests
   must assert the signature is preserved end-to-end by the translation
   function itself (canonical in, native out, canonical back).
8. **Anthropic conversation doesn't start with `role:user`.** Adapter
   synthesizes a placeholder leading user turn rather than sending an invalid
   request.
9. **Anthropic tool_result sent for a `tool_use` id that doesn't exist in the
   preceding assistant turn.** Not repairable at the adapter layer; surfaces
   as `input_rejected` from the 400 the API returns. Caller (agent loop) is
   responsible for keeping tool_use/tool_result pairing intact.
10. **OpenRouter `reasoning_details` reordered or dropped by the caller.**
    Not detectable by the adapter (it's opaque data); documented as a hard
    caller contract, covered by a round-trip test at the message-translation
    level, not a runtime guard.
11. **Local endpoint 400s on `stream_options` or `parallel_tool_calls`.**
    Adapter only sends these fields when `ProviderConfig.capabilities` opts
    in; default is omitted.
12. **Explicit version segment in a custom base URL (`/v2`, `/v3`) getting
    silently downgraded to `/v1`.** URL-building must preserve any `/v\d+$`
    segment already present rather than stripping and re-appending `/v1`.
13. **401 (bad key) vs. 429 (rate limited) vs. 400 (bad request).** 401 fails
    hard with `provider_misconfigured`; 400 fails hard with `input_rejected`;
    429 is retried with backoff, honoring `Retry-After` if present; after
    exhausting retries it surfaces as `rate_limited`.
14. **Streaming requested but the provider returns a non-streaming body (some
    proxies ignore `stream:true`).** Adapter detects a non-SSE content-type on
    the response and falls back to treating the full body as one `text-delta`
    followed by `done`, rather than hanging waiting for chunks.
15. **Mid-stream network interruption.** Surfaces as `stream_interrupted`
    with whatever partial `content`/`toolCalls` had accumulated preserved on
    the thrown error's `cause`, so the caller can decide whether to resume,
    retry, or show partial output.
16. **`max_tokens` too small to fit tool-call arguments.** Not silently
    truncated: this is a caller-side (agent loop / prompt-assembly) budgeting
    concern; this package documents the constraint (leave headroom for tool
    args in `max_tokens`) but does not enforce it.
17. **A provider's model doesn't support the requested reasoning/thinking
    mode.** Adapter omits the reasoning request fields silently rather than
    erroring - reasoning round-trip is best-effort, gated by capability
    profile, never assumed present.
18. **Prompted mode forced (`forcePromptedTools: true`) on a model that also
    has native tool-calling.** Adapter honors the override and drops `tools`
    from the native request regardless of capability profile - used by the
    eval harness to A/B native vs. prompted behavior on the same model.

## Test plan

- Fixtures required (message-translation unit tests, no live network):
  - `fixtures/ai/anthropic/leading-system-only.json` - contiguous leading
    system messages hoist to `system`; a system message after turn 1 does not.
  - `fixtures/ai/anthropic/tool-use-roundtrip.json` - assistant tool_use +
    matching tool_result by id; verifies rejection-shape avoidance.
  - `fixtures/ai/anthropic/thinking-signature-leads.json` - thinking block
    with signature must be first content block on the assistant turn.
  - `fixtures/ai/anthropic/consecutive-role-merge.json` - two adjacent
    user-role entries (from a rewritten mid-chat system message) merge into
    one.
  - `fixtures/ai/gemini/thought-signature-echo.json` - functionCall with a
    thoughtSignature on turn N; the same signature must appear verbatim on
    the request for turn N+1.
  - `fixtures/ai/gemini/leading-system-only.json` - same rule as Anthropic,
    targeting `systemInstruction`.
  - `fixtures/ai/openai/tool-call-content-null.json` - assistant message with
    `toolCalls` and empty string content must serialize with `content: null`.
  - `fixtures/ai/openrouter/reasoning-details-verbatim.json` - array order
    and contents preserved unmodified across a round-trip.
  - `fixtures/ai/prompted/single-block.txt`,
    `multi-block-with-prose.txt`,
    `unclosed-block.txt`,
    `malformed-json-recoverable.txt` (trailing comma / smart quotes),
    `unknown-tool-name.txt`,
    `code-fenced-block.txt` - one fixture per parser edge case in §6/Edge
    cases 2-5.
  - `fixtures/ai/local-openai-compatible/custom-version-segment.json` - base
    URL `.../api/coding/paas/v4` must not be downgraded to `/v1`.
- Round-Trip Law applicability: **not applicable in the codec sense** -
  adapters are not format codecs and there is no `parse -> serialize` pair
  over a fixture file. The equivalent correctness invariant is
  **signature/reasoning round-trip**: translate canonical → native → canonical
  and assert the reasoning/tool-call signature fields (Anthropic `thinking`
  signature, Gemini `thoughtSignature`, OpenRouter `reasoning_details`) are
  byte-identical after the round trip. These get their own test file per
  provider (`anthropic-signature-roundtrip.test.ts`, etc.), not the fixture
  corpus harness.
- Property/unit tests beyond fixtures:
  - `stripToolCallBlocksStreaming` fed a `<tool_call>` tag split across
    arbitrary chunk boundaries (fuzz over split points) never leaks a partial
    tag into `visible`.
  - Retry policy unit tests: 429 with `Retry-After` honored; 500 retried up to
    the cap then surfaced as `unknown`/exhausted; 401 and 400 never retried.
  - `buildUrl`-equivalent unit tests for the OpenAI-compatible base-URL
    resolver: bare base, base with `/chat/completions`, base with explicit
    version segment, base with `/models` suffix pasted by mistake.
  - Capability-gated field omission: `stream_options`/`parallel_tool_calls`
    never appear on the request body unless the config opts in.

## Non-goals

- **No cross-provider fallback or provider selection.** The caller supplies
  an already-resolved `ProviderConfig`; there is no attempt chain, no health
  probing, no "try OpenRouter if Anthropic fails." That is RC's
  `packages/router`'s job and does not belong in a single-key BYOK tool.
- **No cost accounting.** `ChatResponse.usage` carries token counts only -
  no `cost_cents`, no pricing tables, no billing boundary. Vaudeville Studios
  has no operator-side inference to bill for.
- **No key storage or model-role resolution.** Owned by `key-vault.md`. This
  package receives a decrypted `ProviderConfig` as a parameter; it never
  reads the vault, never persists a key, never logs one.
- **No agent-loop turn-driving.** This package renders/parses the prompted-
  XML grammar and exposes native tool-call parsing, but deciding when to use
  prompted vs. native mode at runtime, enforcing one-tool-call-per-turn on
  weak models, dispatching parsed calls against the live tool/resource
  registry, and context compaction are `agent-loop.md`'s job.
- **No token counting implementation.** `TokenUsage.approximate` signals when
  a provider didn't report usage and the caller should fall back to
  `TokenCounter` (owned by `token-counting.md`); this package never
  implements a tokenizer itself.
- **No multi-tenant health probing, no telemetry.** Consistent with the
  privacy invariants in `02-ARCHITECTURE.md` - no network calls beyond the
  provider the user configured.

## Sources consulted

- the master plan (private planning notes) - locked decisions (BYOK, "agent must survive weak
  models"), milestone M2 scope.
- `docs/02-ARCHITECTURE.md:22-26,54-69` - `packages/ai` package description;
  Orison-derived agent lessons (tiny tool surface, resource verbs, spill
  store, staged edits, model capability profiles, eval harness).
- `docs/decisions/ADR-006-ai-and-agent.md` - BYOK provider list, AI-optional
  requirement, weak-model design constraints, model-role mapping, eval
  harness timing.
- `specs/formats/canonical-model.md` - shared entity envelope pattern,
  `TokenCounter` interface location (owned by core, implementations outside).
- `specs/formats/escrow-and-roundtrip.md` - Round-Trip Law definition, used
  above to explain why it does not apply to this package in the codec sense.
- `templates/SPEC-TEMPLATE.md` - section structure.
- VAUDEVILLE `apps/rc/src/lib/providers/types.ts` (lines 1-24 BYOK type
  header, 340-458 `ChatMessage`/`ProviderRequest`, 460-522
  `ProviderResponse`/`ProviderStreamChunk`, 528-578 `ProviderAdapter`
  interface) - canonical request/response shape source.
- VAUDEVILLE `apps/rc/src/lib/providers/adapters/base.ts` (lines 25-73
  OpenAI-compatible URL helpers, 107-149 auth header building, 196-303
  `buildUrl` version-segment preservation, 308-334 sampler filtering,
  460-542 `toOpenAIMessages`, 544-733 `toAnthropicMessages`, 751-880
  `toGoogleMessages`) - provider-specific wire translation rules, all cited
  inline above.
- VAUDEVILLE `apps/rc/src/lib/ai/prompted-tool-calls/index.ts` (lines 1-30
  module header/mechanism description, 84-122 `renderToolCatalog`, 200-229
  `findToolCallSpans`, 246-374 `parseToolCallBlocks`, 397-486
  `stripToolCallBlocksStreaming`) - prompted-XML grammar, source of the exact
  wire format and parser behavior in §6.
- VAUDEVILLE `packages/router/src/types.ts` (lines 62-135 `ProviderAdapter`
  translation-adapter escape hatches, 150-168 `RouteErrorCode`) - contrasting
  analog for the translating-adapter pattern and error taxonomy; explicitly
  NOT the model for this package's scope (multi-tenant billing router, see
  Non-goals).
- VAUDEVILLE `packages/router/src/providers/anthropic-direct.ts` (lines
  16-64) - confirms Anthropic direct-API auth header set
  (`x-api-key`/`anthropic-version`) and bare-model-name mapping independent
  of RC's BYOK layer.
- VAUDEVILLE `apps/rc/src/lib/ai/streaming/base.ts` (lines 1-116) - an older,
  simpler `LLMProvider` interface and error taxonomy (`AuthenticationError`,
  `RateLimitError`, `ModelNotFoundError`), read for error-classification
  precedent; superseded in RC by the adapters under `lib/providers/`, cited
  here only as corroborating evidence for the retry/error-class split in §7.

## Open questions

- OPEN QUESTION: exact source/format of the model capability-profile table
  (native tool-use, reasoning support, context window) - bundled static list,
  fetched-and-cached from a models endpoint, or fully user-editable. Deferred
  to the M2 eval-harness ticket, which needs the same data for its model
  matrix (ADR-006 pt. 5).
