/**
 * The one shape a provider is (hub-and-spoke). A provider is a drop-in file in spokes/ that
 * default-exports a ProviderSpoke; registry.ts discovers them like the tool and format loaders.
 * One file owns everything about that provider: its label and brand for the setup screen, the one
 * host the egress gate allows, whether it can run keyless, and how it builds its AI SDK model.
 * Adding a provider is copy-paste: duplicate spokes/_template.ts, nothing central to edit.
 */
import type { FetchFunction } from "@ai-sdk/provider-utils";
import type { LanguageModel } from "ai";
import type { ProviderConfig } from "./config";
import type { ModelInfo } from "./models";
import type { ChatFn } from "./provider";

/** A provider-specific choice the setup form renders as a chip row (RC's schema-driven fields),
 * e.g. NanoGPT's plan. The picked value lands in config.options under the option's key. */
export interface SpokeOption {
  key: string;
  label: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  defaultValue: string;
}

export interface ProviderSpoke {
  /** Stable id stored in config.kind. */
  id: string;
  /** Display name for the setup screen preset card. */
  label: string;
  /** Brand hex for the setup card (researched, exact). */
  brand: string;
  /** The one host this provider talks to, for the egress allowlist. Omit for base-URL-only (custom). */
  host?: string;
  /** A sensible model id to pre-fill in the setup form. */
  defaultModel?: string;
  /** May run without a key (local / openai-compatible endpoints). */
  keyless?: boolean;
  /**
   * Does this provider accept images in a user message?
   *
   * DECLARED, not assumed. Kit used to caption every pasted picture "shown to you only - Kit's
   * providers take text", which was a blanket claim about other people's software and wrong for most
   * of them: the subscription providers and every current frontier model read images happily. A
   * capability belongs to the spoke that knows it.
   *
   * Absent means NO, deliberately. Sending an image to a text-only model is not a soft failure that
   * degrades to text, it is a request that errors, so the safe default is the one that never breaks a
   * turn - and a spoke that gains vision says so in one line.
   */
  images?: boolean;
  /**
   * Does this provider require assistant reasoning (thinking) content to be passed back on the wire?
   *
   * DECLARED, not assumed. The openai-compatible family expresses thinking as `reasoning_content`,
   * and a DeepSeek-style reasoning backend REJECTS a history whose assistant turns lack the thought
   * they originally produced ("The reasoning_content in the thinking mode must be passed back to
   * the API"). Native adapters differ: anthropic and google need their own signature metadata and
   * skip the block without it, openai chat-completions drops reasoning parts, and mistral would
   * fold the thought into the visible text - so only a spoke whose SDK carries the field back
   * declares this. Absent means NO, and Kit then never attaches the thought to a request.
   */
  reasoningEcho?: boolean;
  /** Provider-specific setup choices (plan tiers, endpoint variants). Rendered by the form. */
  options?: ReadonlyArray<SpokeOption>;
  /** Build the AI SDK model, lazy-importing the vendor adapter and wiring the guarded fetch.
   * Optional only for a spoke that supplies `chat` instead; every spoke must have one or the other. */
  model?(config: ProviderConfig, fetch: FetchFunction): Promise<LanguageModel>;
  /**
   * Supply the chat function directly, for a provider that is NOT an HTTP model.
   *
   * The Claude subscription provider runs a local CLI over stdio, so there is no request for
   * guardedFetch to gate and no LanguageModel to build. Faking one would be dishonest twice over: it
   * would claim an HTTP shape that does not exist, and it would imply the egress gate is watching
   * something it cannot see. A spoke that sets this is asked for its chat and never for its model.
   *
   * A spoke with `chat` must say what it does about egress in its own file, because the ledger's
   * usual source, our own fetch, is not in the path.
   */
  chat?(config: ProviderConfig, signal?: AbortSignal): Promise<ChatFn>;
  /** Query the provider's live model list (through the guarded fetch). Omit when the provider has
   * no usable models endpoint; the setup form then falls back to manual model entry. */
  listModels?(config: ProviderConfig, fetch: FetchFunction): Promise<ModelInfo[]>;
}
