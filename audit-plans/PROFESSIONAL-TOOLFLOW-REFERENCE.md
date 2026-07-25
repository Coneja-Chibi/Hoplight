# Professional toolflow reference

Research date: 2026-07-25

Repository revision: `d18c65e`

Scope: non-security architecture for Kit's content capabilities, tool discovery, tool execution loop,
preview and apply lifecycle, and terminal presentation.

## Conclusion

Professional agent CLIs do not put hundreds of full tool schemas in every model request and do not
ask users to memorize hundreds of slash commands. They separate the runtime catalog from the small
tool surface visible for the current task.

Hoplight should use one canonical capability catalog and two views over it:

1. The model sees a small always-on tool belt plus at most five target-relevant typed capabilities.
2. The user sees the same catalog through `/tools`, grouped by piece, area, and action.

The catalog owns semantics. Kit, the Web UI, provider adapters, and the terminal are consumers. There
must not be a second catalog for prompts, a third for slash commands, or UI-only mutation logic that
Kit has to imitate.

## Evidence levels

- **Official documentation:** current public vendor documentation.
- **Official source:** code in the official cloned repository at the revision listed below.
- **Product inference:** a Hoplight design conclusion derived from official evidence and current
  Hoplight source.
- **Excluded:** the unlicensed `external-refs/claude-code-leak` mirror. It is not a design source.

## What the major systems do

### Codex

Official source revision: `external-refs/codex` at `4462b9deef21`

Codex explicitly distinguishes registered runtimes from model-visible tool specifications.
`PlannedTools` assigns tools an exposure such as direct, deferred, hidden, or model-only. Only direct
specifications enter the prompt immediately. Deferred executors remain callable after discovery.

Relevant source:

- `external-refs/codex/codex-rs/core/src/tools/spec_plan.rs`
- `external-refs/codex/codex-rs/core/src/tools/router.rs`
- `external-refs/codex/codex-rs/core/src/tools/registry.rs`
- `external-refs/codex/codex-rs/core/templates/search_tool/tool_description.md`
- `external-refs/codex/codex-rs/core-skills/src/render.rs`

Codex rebuilds the visible surface for the current environment, mode, provider, and turn. Skills use
the same progressive-disclosure principle: metadata is cheap and available first; the full skill
body and supporting files are loaded only when selected. MCP configuration can include or exclude
individual tools, and specialized subagents can receive smaller tool sets.

Official manuals:

- [Customization overview](https://learn.chatgpt.com/docs/customization/overview.md)
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp.md)
- [Skills and plugins](https://learn.chatgpt.com/docs/skills-and-plugins.md)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents.md)

**Useful for Hoplight:** make exposure first-class metadata and build a turn-scoped visible surface
without unregistering the full runtime catalog.

### Claude

Official SDK source revision: `external-refs/claude-agent-sdk-python` at `e6e07f1c9b05`

Anthropic supports deferred tool loading and a tool-search tool for large catalogs. Its documentation
recommends tool search once a surface grows beyond roughly 20 tools. The initial context carries the
search tool and non-deferred tools. Search returns a small set of matching tool references, while
strict schemas still validate the eventual call.

Relevant official sources:

- [Tool reference](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference)
- [Manage tool context](https://platform.claude.com/docs/en/agents-and-tools/tool-use/manage-tool-context)
- [Tool search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- `external-refs/claude-agent-sdk-python/src/claude_agent_sdk/types.py`

Agent definitions can carry allowed tools, disallowed tools, skills, MCP servers, turn limits, and
permission modes. Runtime context reports whether tools are loaded or deferred.

**Useful for Hoplight:** return full schemas only for the few capabilities relevant to the current
target and request. Keep the selected operation typed even though discovery is fuzzy.

### Grok Build

Official source revision: `external-refs/grok-build` at `a5727c596045`

Grok Build combines native direct tools with a stable two-tool integration surface:

- `search_tool` searches a backend-independent catalog and returns a handful of matches with schemas.
- `use_tool` dispatches only a discovered integration tool.

This keeps the prompt tool set stable while MCP servers connect or change. Native tools remain direct
and are not routed through `use_tool`. Tool metadata includes semantic kind, namespace, capabilities,
and read-only status. Tool execution streams progress events and exactly one terminal result.

Relevant source:

- `external-refs/grok-build/crates/common/xai-tool-runtime/src/tool.rs`
- `external-refs/grok-build/crates/common/xai-tool-runtime/src/search.rs`
- `external-refs/grok-build/crates/xai-grok-tools/src/implementations/search_tool/mod.rs`
- `external-refs/grok-build/crates/xai-grok-tools/src/implementations/use_tool/mod.rs`
- `external-refs/grok-build/crates/xai-grok-agent/src/builder.rs`

xAI's public API also separates server-side tools from caller-executed custom functions and supports
multiple tool calls in one turn:

- [Function calling](https://docs.x.ai/developers/tools/function-calling)
- [Tool usage details](https://docs.x.ai/developers/tools/tool-usage-details)
- [Advanced tool usage](https://docs.x.ai/developers/tools/advanced-usage)

**Useful for Hoplight:** a stable discovery surface is valuable, but Hoplight can reveal a selected
capability as a direct typed function on the next model call because Kit controls every provider
request. A generic dispatcher is a compatibility fallback, not a second architecture.

### Gemini CLI

Official source revision: `external-refs/gemini-cli` at `87f785192c34`

Gemini CLI maintains all known tools separately from currently active tools. Its scheduler models
tool execution as an observable lifecycle: scheduled, validating, awaiting approval, executing, and
terminal success, error, or cancellation. It handles batches, progress events, hooks, and
tool-not-found suggestions. Slash commands have a separate provider-based registry.

Relevant source:

- `external-refs/gemini-cli/packages/core/src/tools/tool-registry.ts`
- `external-refs/gemini-cli/packages/core/src/scheduler/scheduler.ts`
- `external-refs/gemini-cli/packages/cli/src/services/CommandService.ts`

**Useful for Hoplight:** the terminal should render real execution state from one scheduler rather
than infer status from prose or component-local timers.

## What Orison gets right

The inspected Orison surface has 260 registry tools, with 253 deferred from its ordinary direct
surface. Its useful ideas are:

- dynamic tool discovery;
- mount-scoped actions;
- surface manifests;
- an act, observe, verify rhythm;
- bounded result spill and context handling;
- evaluations for whether the right tool is found and used.

Those ideas are worth keeping.

## What Hoplight must not copy from Orison

Orison also demonstrates how a large catalog becomes incoherent:

- several competing search and consult routers;
- duplicate server and UI action inventories;
- inconsistent naming;
- behavior inferred from names instead of explicit metadata;
- tool availability that is documented before it exists;
- an undo ledger that can mark an action reverted without restoring state;
- 260 registry entries beside 482 UI actions, with no single semantic authority.

Hoplight should not make one tool per form control, one tool per platform field, or one slash command
per mutation. It should not expose undo until a stored snapshot can actually restore the entity.

## Is "loop engineering" relevant?

Yes, but it is a useful name for established control-loop work, not a reason to add autonomous
machinery.

Addy Osmani defines a loop as a repeated system that gathers context, acts, verifies, records state,
and continues until an explicit condition is met. He separates the agent's inner execution loop from
the human-owned outer loop that decides whether evidence is sufficient:

- [Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
- [Own the Outer Loop](https://addyosmani.com/blog/own-the-outer-loop/)

IBM's current overview similarly describes act, observe, decide, and iterate, with persistent state,
verification, and stop conditions:

- [What is loop engineering?](https://www.ibm.com/think/topics/loop-engineering)

For Kit, the relevant application is concrete:

```text
resolve target
  -> inspect canonical state and provenance
  -> discover relevant capabilities
  -> draft a semantic change
  -> preview the exact effect
  -> apply through the canonical store
  -> re-read and verify
  -> emit a truthful receipt
  -> stop, or continue with new evidence
```

This is Kit's **inner tool loop**. It should be deterministic around the model: the model chooses a
capability and arguments, while the harness owns validation, state transitions, application,
verification, budgets, and terminal events.

The **outer product loop** is how Hoplight closes Web UI parity:

```text
inventory editor operations
  -> compare them to capability manifests
  -> implement one missing semantic bundle
  -> run parity, reducer, integration, and live checks
  -> update reference docs
  -> repeat
```

The phrase does not justify scheduled autonomous editing, background mutations, or an agent grading
its own success. Those would be separate product decisions.

## Recommended Hoplight structure

### One semantic catalog

Each capability is a drop-in module with explicit metadata:

```ts
interface ContentCapability<Input, Entity> {
  id: `${ContentKind}.${string}`;
  kind: ContentKind;
  area: string;
  action: string;
  summary: string;
  aliases: readonly string[];
  platforms: readonly string[] | "canonical";
  exposure: "direct" | "deferred" | "hidden";
  effect: "read" | "draft";
  concurrencyKey(input: Input): string;
  input: z.ZodType<Input>;
  preview(entity: Entity, input: Input): CapabilityPreview<Entity>;
}
```

Provider-safe function names are derived from stable dotted IDs by replacing dots with underscores.
Names never determine effect, recovery, or scheduling behavior.

### A small always-on tool belt

Kit should start each turn with approximately six direct tools:

1. `studio_list`
2. `studio_search`
3. `studio_read`
4. `capability_find`
5. `change_apply`
6. `change_discard`

`capability_find` searches metadata for the current target and returns at most five matches. Those
matches become direct typed tool specifications on the next model call. Calling a content capability
creates or updates an in-memory change draft and returns a preview. It does not save the entity.

`change_apply` is the only capability-layer write boundary. It applies the composed draft once,
re-reads the entity, validates the expected result, and returns a receipt. A future compatibility
adapter may provide a stable `capability_use(id, input)` function for providers that cannot accept a
changing tool list, but it must consume the same catalog and dispatcher.

### Semantic bundles, not field tools

A card should not create separate tools for `name`, `description`, `first_mes`, and every platform
override. It should expose coherent operations such as:

- `character.identity.update`
- `character.prompts.update`
- `character.greetings.manage`
- `character.examples.manage`
- `character.media.manage`
- `character.variants.manage`
- `character.platform.update`

The same pattern covers lorebook settings and entries, preset settings and prompt blocks, regex set
settings and rules, persona identity and injection, and pack media. Platform operations are typed by
the same format-native manifests the Web UI uses.

### One observable loop

The turn scheduler owns:

- the current visible tool set;
- model-call, tool-call, elapsed-time, and no-progress budgets;
- batch scheduling;
- draft state;
- event emission;
- the final receipt.

Independent reads may run in parallel with output order preserved. Any batch containing a draft or
apply operation runs in declared order. Mutations against the same target compose into one draft and
save once.

The no-progress detector must compare the call and observation digest. Repeating the same query is
not stuck when the observation changed. Repeating the same call with the same observation is.

### One user-facing catalog

Bare `/` remains the registry-driven command menu. `/tools` opens a target-aware capability browser:

```text
Characters / Mira / Greetings
  Change the primary greeting
  Add an alternate greeting
  Reorder alternate greetings
  Remove an alternate greeting
```

The browser shows plain language, breadcrumbs, platform applicability, and preview availability. It
does not show raw JSON schema unless the user asks for details.

## Decision

Adopt the Codex and Claude progressive-disclosure model, Grok's stable discovery discipline, and
Gemini's explicit execution lifecycle. Keep Orison's search idea and reject its multiplied routers.
Apply loop engineering to evidence and stopping behavior, not to uncontrolled autonomy.
