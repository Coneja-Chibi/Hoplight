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
  /** Build the AI SDK model, lazy-importing the vendor adapter and wiring the guarded fetch. */
  model(config: ProviderConfig, fetch: FetchFunction): Promise<LanguageModel>;
}
