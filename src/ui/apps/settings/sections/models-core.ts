/**
 * The model settings screen's decisions, with no React in them.
 *
 * Separate because the interesting parts are rules, not rendering: when a key is required, when a
 * blank key means "keep the one you have" rather than "remove it", and what a provider should be
 * called when nobody named it. Those are the things that go quietly wrong and the things worth
 * proving without a browser.
 */

/** A saved provider as the server is willing to describe it. Never carries a key. */
export interface SafeProvider {
  readonly id: string;
  readonly kind: string;
  readonly model: string;
  readonly name?: string;
  readonly hasKey: boolean;
  readonly baseURL?: string;
  readonly active: boolean;
  /** The spoke's own choices as saved. Not secret - they are settings, and the form has to show them. */
  readonly options?: Readonly<Record<string, string>>;
}

/** One provider-specific choice a spoke declares, e.g. the Claude subscription's write posture. */
export interface SpokeOption {
  readonly key: string;
  readonly label: string;
  readonly choices: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly defaultValue: string;
}

/** A provider type this build can talk to, from its spoke drop-in. */
export interface ProviderKind {
  readonly id: string;
  readonly label: string;
  readonly brand: string;
  readonly defaultModel?: string;
  readonly keyless: boolean;
  readonly needsBaseUrl: boolean;
  /**
   * The choices this provider offers.
   *
   * ADVERTISED SINCE THE BEGINNING AND NEVER DRAWN, which is how the Claude subscription ended up
   * permanently read-only from this window: the spoke declares "Let Kit make changes this session",
   * the server sent it in this payload, and the form ignored it. There was no control anywhere in
   * the window that could turn writes on, so the agent could read the whole studio and stage
   * nothing - and said so, correctly, forever.
   */
  readonly options?: ReadonlyArray<SpokeOption>;
}

/** What the form holds while somebody fills it in. */
export interface ProviderDraft {
  /** Set when editing an existing entry; absent when adding. */
  readonly id?: string;
  readonly kind: string;
  readonly model: string;
  readonly name: string;
  readonly apiKey: string;
  readonly baseURL: string;
  /** The spoke's own choices, seeded from their defaults so nothing is ever unset. */
  readonly options: Readonly<Record<string, string>>;
}

/** Every option a spoke declares, at its default. The safe posture, chosen by the spoke. */
export const defaultOptions = (kind: ProviderKind | undefined): Record<string, string> =>
  Object.fromEntries((kind?.options ?? []).map((o) => [o.key, o.defaultValue]));

export const emptyDraft = (kind: ProviderKind | undefined): ProviderDraft => ({
  kind: kind?.id ?? "",
  model: kind?.defaultModel ?? "",
  name: "",
  apiKey: "",
  baseURL: "",
  options: defaultOptions(kind),
});

/**
 * Open an existing provider for editing.
 *
 * THE KEY FIELD STARTS EMPTY, and it has to: the server will not send a stored key back, so there
 * is nothing to prefill it with. What matters is that blank then means "keep what is saved" rather
 * than "clear it" - see `draftProblem`, which only demands a key when there is not already one.
 */
export const draftFrom = (provider: SafeProvider, kind?: ProviderKind): ProviderDraft => ({
  id: provider.id,
  kind: provider.kind,
  model: provider.model,
  name: provider.name ?? "",
  apiKey: "",
  baseURL: provider.baseURL ?? "",
  /**
   * SEEDED FROM WHAT IS SAVED, defaults only for options this provider has never been asked about.
   *
   * Unlike the key, these come back from the server, and they have to: a form that opened with the
   * default would send the default, and since a save REPLACES the whole entry, editing the model on
   * a provider with writes enabled would quietly take that permission away again.
   */
  options: { ...defaultOptions(kind), ...(provider.options ?? {}) },
});

/**
 * Why this draft cannot be saved yet, or null.
 *
 * Checked here as well as on the server, and that is not duplication for its own sake: the server
 * has to refuse bad input whatever the browser does, and the browser can say which field is wrong
 * while somebody is still looking at it rather than after a round trip.
 */
export function draftProblem(
  draft: ProviderDraft,
  kind: ProviderKind | undefined,
  /** Does the saved entry being edited already hold a key? */
  hasStoredKey = false,
): string | null {
  if (!kind) return "Choose a provider.";
  if (!draft.model.trim()) return "Choose or type a model.";
  if (kind.needsBaseUrl && !draft.baseURL.trim()) return "This provider needs a base URL.";
  /**
   * A key is required unless the provider runs without one, or unless one is already stored. That
   * last clause is what lets somebody change the model on a saved provider without digging their
   * API key out again - which is the single most common edit and was worth not making annoying.
   */
  if (!kind.keyless && !draft.apiKey.trim() && !hasStoredKey) return `${kind.label} needs an API key.`;
  return null;
}

/** The body to POST. Blank optional fields are omitted rather than sent as empty strings. */
export function saveBody(draft: ProviderDraft): Record<string, unknown> {
  const body: Record<string, unknown> = { kind: draft.kind, model: draft.model.trim() };
  if (draft.id) body["id"] = draft.id;
  if (draft.name.trim()) body["name"] = draft.name.trim();
  if (draft.baseURL.trim()) body["baseURL"] = draft.baseURL.trim();
  // Omitted when blank, which the server reads as "keep the stored one". Sending "" would be a
  // request to save an empty key, and the difference decides whether an edit destroys a secret.
  if (draft.apiKey.trim()) body["apiKey"] = draft.apiKey.trim();
  /**
   * SENT, which this did not do. The spoke's options never left the browser, so a provider added
   * here had none - and `config.options?.writes === "on"` is what decides whether the Claude
   * subscription's tool server starts read-only. The answer was always no, and the only symptom was
   * an agent that could read everything and stage nothing.
   */
  if (Object.keys(draft.options).length > 0) body["options"] = { ...draft.options };
  return body;
}

/**
 * What to call a provider in the list.
 *
 * People run the same provider twice - a personal key and a work key, two models from one account -
 * so the label has to distinguish them. The user's own name wins; failing that the model does, since
 * that is what actually differs between two entries of the same kind.
 */
export function providerLabel(provider: SafeProvider, kinds: readonly ProviderKind[]): string {
  const kind = kinds.find((k) => k.id === provider.kind);
  const base = kind?.label ?? provider.kind;
  return provider.name ? `${provider.name} (${base})` : `${base} · ${provider.model}`;
}
