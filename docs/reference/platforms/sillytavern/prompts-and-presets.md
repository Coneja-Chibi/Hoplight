---
id: reference/platforms/sillytavern/prompts-and-presets
title: SillyTavern prompts and presets
audience: user
summary: How SillyTavern assembles model context and separates Text Completion templates, Chat Completion Prompt Manager entries, character overrides, Author's Note, and generation presets.
tags: [platform, sillytavern, prompt, preset, template, authors-note]
related: [reference/platforms/sillytavern/README, reference/entities/preset, reference/formats/sillytavern]
---

# SillyTavern prompts and presets

SillyTavern builds each model request from multiple authored and runtime sources. A preset is not one
universal prompt file: Text Completion and Chat Completion use different assembly controls, while sampler
settings, character overrides, lore, and history join at runtime.

Primary sources: [Prompts](https://docs.sillytavern.app/usage/prompts/),
[Advanced Formatting](https://docs.sillytavern.app/usage/core-concepts/advancedformatting/),
[Context Template](https://docs.sillytavern.app/usage/prompts/context-template/),
[Instruct Mode](https://docs.sillytavern.app/usage/prompts/instructmode/),
[Prompt Manager](https://docs.sillytavern.app/usage/prompts/prompt-manager/),
[CFG](https://docs.sillytavern.app/usage/prompts/cfg/), and
[Reasoning](https://docs.sillytavern.app/usage/prompts/reasoning/).

## Prompt layers and precedence

A request can include main instructions, character definitions, persona description, World Info, Data Bank
retrieval, summaries, external results, example dialogue, chat history, the current user message, and final
instructions. Position and role affect priority as much as prose.

Main Prompt or System Prompt supplies general behavior. Post-History Instructions arrive near the end and
usually have stronger immediate influence. Character cards may override either when user preferences permit;
`{{original}}` composes a global prompt into the character-specific value. Author's Note can sit after
Scenario or inside history at a selected depth and frequency.

Changing a distant system instruction may have limited effect against established recent history. Authors
can test with a new chat, repair contradictory history, use examples, or place a narrow reminder closer to
the generation boundary.

## Text Completion templates

Advanced Formatting governs Text Completion prompt construction. A Context Template's Story String
arranges system prompt, character description, personality, scenario, persona, and other macro-expanded
components. Instruct Mode wraps story, system, user, and assistant content in model-specific sequences.

Instruct templates can define story-string prefix and suffix, role prefixes and suffixes, first or last
message variants, separators, stop sequences, and alignment filler. Include Names and wrapping options
change whether participant labels are authored into the serialized request. These values describe wire
formatting for a model, not character identity.

Custom stopping strings and reply prefill are generation controls adjacent to templates. A stop array can
be provider-limited, while Start Reply With may become a final text prefix or assistant-role prefill. A
portable preset must keep these controls typed rather than concatenating them into one prompt block.

## Chat Completion Prompt Manager

Prompt Manager represents context as ordered messages with roles. Utility prompts include format templates,
new-chat and new-example markers, group nudges, continuation nudges, and empty-message replacements.
Editable prompt entries have a name, role, trigger conditions, enabled state, position, depth, and order.

Prompt Manager can place entries at a relative position or at an in-chat depth. It also controls behaviors
such as character-name handling, continuation postfix or prefill, system-message squashing, inline media,
reasoning requests, function calling, and provider-dependent system-role use.

The visible list is an assembly plan. Removing, disabling, or reordering one entry changes the request even
if every prose block stays identical. Hoplight should preserve ordered prompt blocks and their roles rather
than flattening a Chat Completion preset into a single string.

## Preset and interoperability boundaries

SillyTavern content commonly divides among sampler presets, Context Templates, Instruct templates, system
prompts, Prompt Manager configurations, Quick Reply presets, and extension-specific settings. Similar UI
grouping does not make them one file format.

Hoplight's canonical preset models sampler settings, prompt blocks, and groups where adapters provide a
semantic mapping. Platform-only ordering or provider controls may remain in escrow for same-format export.
When converting to another platform, report unsupported roles, triggers, template sequences, and extension
settings instead of presenting a partially flattened prompt as lossless.

Inspect the final prompt when diagnosing behavior. An authored block may be valid but absent because its
trigger did not fire, its position was disabled, context budget removed it, or a character override replaced
the global value.

## Classifier-free guidance (CFG)

Primary source: [CFG](https://docs.sillytavern.app/usage/prompts/cfg/) (`Usage/Prompts/CFG.md`).

CFG mixes differences between positive and negative guidance streams (LLM "prompt mixing", not Stable
Diffusion negative tags). Supported backends named by the pin: oobabooga textgen WebUI, NovelAI, TabbyAPI.
VRAM use rises because more than one prompt is ingested; OOM recovery is reduce context, smaller model, or
disable CFG.

Access is alongside Author's Note (hamburger). Four scopes: **Chat CFG**, **Character CFG**, **Global CFG**
(overrides model preset CFG), and **CFG Advanced Settings** (formerly Prompt Cascading) to combine prompts
from the three scopes and set insertion depth. Guidance scale `1` is off: nothing CFG-related is sent.
Scale `>1` increases guidance strength; scale `<1` inverts emphasis toward the negative stream. Suggested
starting scale is about `1.5`. Positive and negative prompts are optional; scale alone can still affect
output.

Group chats remove Character CFG and add **Use Character CFG Scales** (per-character scale) and
**Character Negatives** (append character negatives when cascading). Insertion depth defaults to `1` for
chat flexibility; depth `0` is allowed but can dominate the response and is not recommended with cascading.

Treat CFG as runtime generation control, not character-card prose, unless a format explicitly stores it.

## Tokenizer selection and padding

Primary source: [Tokenizer](https://docs.sillytavern.app/usage/prompts/tokenizer/)
(`Usage/Prompts/tokenizer.md` at pin `70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`).

A tokenizer splits text into tokens (~3-4 characters each). SillyTavern's **Best match** chooses a tokenizer
from the API family. **Text Completion (overridable)** best-match order: NovelAI Clio → NerdStash; Kayra →
NerdStash v2; Text Completion → API tokenizer if supported else Llama; KoboldAI Classic / AI Horde → Llama;
KoboldCpp → model API tokenizer. **Chat Completion is non-overridable** and uses provider-specific tokenizers
(OpenAI tiktoken, Claude WebTokenizers, OpenRouter model families, Google Gemma, AI21/Cohere/MistralAI/DeepSeek
downloadable models, fallback GPT-3.5 turbo).

Override choices for Text Completion: None (~3.3 chars/token, rounded up; try if prompts cut off at high
context), Llama, Llama 3, NerdStash, NerdStash v2, Mistral V1, Mistral Nemo, Yi, Gemma, DeepSeek, API tokenizer
(ooba, koboldcpp, TabbyAPI, Aphrodite). Additional downloadable tokenizers (Qwen2, Command-R/A, Mistral V3
Nemo, DeepSeek chat) download once unless `enableDownloadableTokenizers: false` in config.yaml; manual JSON
files can live under `./data/_cache`. If required model is uncached and downloads disabled, fallback is Llama 3.

**Token Padding** applies to Text Completion only (Chat Completion always uses the matching tokenizer).
Estimated counts can drop or trim prompt pieces near max context; padding reserves room so character
definitions are not truncated. **Negative padding** allows allocating more than the stated maximum tokens.

## Reasoning and chain-of-thought blocks

Primary source: [Reasoning](https://docs.sillytavern.app/usage/prompts/reasoning/)
(`Usage/Prompts/reasoning.md`, ST `>=1.12.12` docs tag).

Hidden reasoning can consume Max Response Length; incomplete/empty answers often need 1024-4096 response
tokens on reasoning models. Blocks appear collapsible; **Auto-Expand** and **Show Hidden** (time-only when
thoughts are not returned) are Advanced Formatting options. Edit/copy when expanded.

### Adding reasoning

- **Manual**: message edit lightbulb, or extensions writing `extra.reasoning`.
- **Command**: `/reasoning-set at=<id> <text>` (default last message).
- **Backend**: "Request model reasoning" in AI Response Configuration when the source supports it. For most
  sources this does not disable thinking; it only toggles request where the API allows. Named sources in
  the pin include Claude, DeepSeek, Google AI Studio/Vertex, OpenRouter, xAI, AI/ML API, Z.AI, Pollinations,
  MistralAI, Electron Hub, Chutes, NanoGPT, Moonshot. Claude/Google Flash can toggle thinking; Z.AI and
  Moonshot map disable to `thinking.type`; OpenRouter disable+minimal effort may reject depending on model.
- **Parse**: Auto-Parse with Prefix/Suffix (DeepSeek-style `<think>` defaults) for unparsed streams
  (e.g. MiniMax, Perplexity).

### Prompting with reasoning

Default: reasoning is **not** resent. **Add to Prompts** wraps content with Prefix, Suffix, Separator;
**Max Additions** counts from the end of the prompt. Providers often discourage multi-turn CoT resend.
**Continue** may resend incomplete reasoning-only messages without Add to Prompts so the model can finish
thinking then emit content.

### Regex and effort

Regex Affects can include **Reasoning**. Ephemerality: none = permanent rewrite; run-on-edit re-applies;
alter display only; alter outgoing prompts only. **Reasoning Effort** (Chat Completion AI Response panel)
maps Auto/Minimum/Low/Medium/High/Maximum to provider-specific budgets or keywords (Claude token budgets
or adaptive thinking; OpenAI/OpenRouter/xAI/Perplexity/NanoGPT keywords; Google thinkingBudget/thinkingLevel
tables for 2.5/3.x models). Auto usually omits the parameter. Effort is connection configuration, not a
character-card field.
