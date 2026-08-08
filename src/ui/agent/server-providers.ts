/**
 * Managing which models this studio can reach, from the window.
 *
 * KEYS TRAVEL IN ONE DIRECTION ONLY. A key may be sent browser to server, because that is how you
 * add one; it is NEVER sent server to browser, not even to the owner, not even masked. The listing
 * carries a name, a kind, a model, and whether a key is present - and `hasKey: true` is the whole of
 * what it says about the secret. There is no endpoint here that reads a key out of the vault, so
 * there is no bug that can be introduced that leaks one through this surface.
 *
 * That rule is what makes the redaction in server-agent.ts a second line rather than the only one.
 *
 * HOST-ONLY, enforced upstream by isHostOnlyRoute. Adding a provider spends the host's money on
 * every turn afterwards, and a guest permitted to read a shared studio has not been given that.
 *
 * KIT'S VAULT, NOT A SECOND ONE. Every provider configured here is a provider the terminal sees,
 * and every provider configured there shows up here. One place to paste a key.
 */
import { json } from "../server-security";
import { spokes } from "../../kit/providers/registry";
import {
  activeProvider,
  readVault,
  removeProvider,
  saveProvider,
  setActive,
} from "../../kit/providers/vault";
import type { ProviderConfig } from "../../kit/providers/config";
import { listModelsFor } from "../../kit/providers/adapters";
import { makeChat } from "../../kit/providers/chat";
import { pingProvider } from "../../kit/providers/probe";
import { redactSecrets } from "./server-agent";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A saved provider as the browser is allowed to see it.
 *
 * Built by naming every field rather than by deleting `apiKey` from the stored object. A
 * delete-based redaction is one new field away from leaking: add `token` to ProviderConfig next
 * year and it ships to the browser silently. This way a new secret field is invisible by default,
 * and making it visible takes a deliberate edit here.
 */
export interface SafeProvider {
  readonly id: string;
  readonly kind: string;
  readonly model: string;
  readonly name?: string;
  /** Whether a key is stored. Never which key, never any part of it. */
  readonly hasKey: boolean;
  /** Shown so somebody running a proxy can tell two entries apart. Not a secret; it is their URL. */
  readonly baseURL?: string;
  readonly active: boolean;
}

function safe(config: ProviderConfig, activeId: string | null): SafeProvider {
  return {
    id: config.id ?? "",
    kind: config.kind,
    model: config.model,
    ...(config.name ? { name: config.name } : {}),
    hasKey: typeof config.apiKey === "string" && config.apiKey.length > 0,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    active: config.id !== undefined && config.id === activeId,
  };
}

/** Everything the settings screen needs to draw the list, plus the catalog to add from. */
export async function handleProviderList(): Promise<Response> {
  const [vault, catalog] = await Promise.all([readVault(), spokes()]);
  return json({
    providers: vault.providers.map((p) => safe(p, vault.activeId)),
    /**
     * The provider types this build can talk to, straight from the spoke drop-ins. Not a hand-kept
     * list in the UI: a spoke added to src/kit/providers/spokes shows up here without anybody
     * remembering to add it, which is the same folders-as-schema rule the apps themselves follow.
     */
    kinds: [...catalog.values()].map((spoke) => ({
      id: spoke.id,
      label: spoke.label,
      brand: spoke.brand,
      ...(spoke.defaultModel ? { defaultModel: spoke.defaultModel } : {}),
      keyless: spoke.keyless === true,
      /** Base-URL-only providers have no fixed host; the form asks for a URL instead. */
      needsBaseUrl: spoke.host === undefined,
      ...(spoke.options ? { options: spoke.options } : {}),
    })),
    /** A notice from a vault that could not be recovered. Surfaced, never swallowed. */
    ...(vault.notice ? { notice: vault.notice } : {}),
  });
}

/** Add or update one provider. The key arrives here and stops here. */
export async function handleProviderSave(body: unknown): Promise<Response> {
  if (!isRecord(body)) return json({ error: "expected an object" }, 400);

  const kind = body["kind"];
  const model = body["model"];
  if (typeof kind !== "string" || !kind) return json({ error: "kind is required" }, 400);
  if (typeof model !== "string" || !model) return json({ error: "model is required" }, 400);

  const known = await spokes();
  const spoke = known.get(kind);
  // A kind with no spoke is a provider this build cannot talk to. Saving it would produce an entry
  // that fails only later, at the first turn, with a much worse message.
  if (!spoke) return json({ error: `unknown provider type: ${kind.slice(0, 40)}` }, 400);

  const apiKey = body["apiKey"];
  const baseURL = body["baseURL"];
  const name = body["name"];
  const id = body["id"];

  if (apiKey !== undefined && typeof apiKey !== "string") return json({ error: "apiKey must be a string" }, 400);
  if (baseURL !== undefined && typeof baseURL !== "string") return json({ error: "baseURL must be a string" }, 400);
  if (name !== undefined && typeof name !== "string") return json({ error: "name must be a string" }, 400);
  if (id !== undefined && typeof id !== "string") return json({ error: "id must be a string" }, 400);

  /**
   * A provider that needs a key and was given none is refused HERE rather than saved and left to
   * fail on the first turn. The failure at turn time is an opaque provider error; this one can say
   * which field is missing while somebody is still looking at the form.
   */
  const needsKey = spoke.keyless !== true;
  const keyGiven = typeof apiKey === "string" && apiKey.length > 0;
  // An existing entry keeps its stored key when the field is left blank, which is what makes
  // "change the model on my saved provider" not require re-pasting the secret.
  const editing = typeof id === "string" && id.length > 0;
  if (needsKey && !keyGiven && !editing) return json({ error: `${spoke.label} needs an API key` }, 400);

  if (spoke.host === undefined && !(typeof baseURL === "string" && baseURL.length > 0)) {
    return json({ error: `${spoke.label} needs a base URL` }, 400);
  }

  /**
   * A BLANK KEY ON AN EDIT KEEPS THE STORED ONE, and it has to be carried forward explicitly.
   *
   * `saveProvider` replaces the whole entry rather than merging, so simply omitting `apiKey` wrote
   * a provider with no key at all - which meant changing a model id silently destroyed a working
   * secret, and the damage only surfaced at the next turn as an authentication error with nothing
   * connecting it to the edit. The field is necessarily blank when editing, because the stored key
   * is never sent to the browser, so this path is the normal one and not an edge case.
   */
  const stored = editing
    ? (await readVault()).providers.find((p) => p.id === id)
    : undefined;
  const keptKey = !keyGiven && stored?.apiKey ? stored.apiKey : undefined;

  const config: ProviderConfig = {
    kind,
    model,
    ...(editing ? { id: id as string } : {}),
    ...(keyGiven ? { apiKey: apiKey as string } : keptKey ? { apiKey: keptKey } : {}),
    ...(typeof baseURL === "string" && baseURL ? { baseURL } : {}),
    ...(typeof name === "string" && name ? { name } : {}),
  };

  try {
    const saved = await saveProvider(config);
    const vault = await readVault();
    // The saved entry back, redacted. Never an echo of what was posted.
    return json({ provider: safe(saved, vault.activeId) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "could not save" }, 500);
  }
}

/** Choose which saved provider every turn uses, here and in the terminal. */
export async function handleProviderActivate(body: unknown): Promise<Response> {
  if (!isRecord(body)) return json({ error: "expected an object" }, 400);
  const id = body["id"];
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);

  const vault = await readVault();
  // Checked before writing: setting an id nothing matches would leave the studio with no reachable
  // model and a settings screen showing nothing selected.
  if (!vault.providers.some((p) => p.id === id)) return json({ error: "no such provider" }, 404);

  await setActive(id);
  const after = await activeProvider();
  return json({ active: after ? safe(after, id) : null });
}

/** Forget one. */
export async function handleProviderRemove(body: unknown): Promise<Response> {
  if (!isRecord(body)) return json({ error: "expected an object" }, 400);
  const id = body["id"];
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);

  await removeProvider(id);
  const vault = await readVault();
  return json({ providers: vault.providers.map((p) => safe(p, vault.activeId)) });
}

/**
 * Ask one saved provider whether it actually answers.
 *
 * WORTH ITS OWN ENDPOINT because "saved" and "works" are different states and the settings screen
 * showed only the first. A typo'd key, an expired one, a proxy that moved: all of them look
 * identical to a correct setup until the next turn fails, and by then somebody is in the middle of
 * asking a question rather than in the middle of configuring.
 *
 * A REAL CALL. It sends a token to the real endpoint and reads the real reply, because the failure
 * modes worth catching - a key that authenticates but has no credit, a model id that does not exist
 * on this account - are invisible to anything cheaper.
 */
export async function handleProviderTest(body: unknown, signal?: AbortSignal): Promise<Response> {
  if (!isRecord(body)) return json({ error: "expected an object" }, 400);
  const id = body["id"];
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);

  const vault = await readVault();
  const config = vault.providers.find((p) => p.id === id);
  if (!config) return json({ error: "no such provider" }, 404);

  try {
    const probe = await pingProvider(makeChat(config, signal));
    return json({ ok: true, ms: probe.ms, text: probe.text.slice(0, 200) });
  } catch (error) {
    /**
     * The provider's own words, redacted. An expired key, a wrong model id and a dead host need
     * three different fixes, and "could not connect" sends somebody to check their wifi. Redacted
     * because these messages routinely echo the key back and name the private endpoint.
     */
    const detail = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: redactSecrets(detail).slice(0, 300) });
  }
}

/**
 * What models this provider actually offers.
 *
 * So the model is a CHOICE rather than a string somebody has to know and type exactly. A typo here
 * is indistinguishable from an outage at the next turn.
 *
 * Best-effort by design: plenty of endpoints have no model list, and a provider without one is
 * perfectly usable by typing the id. An empty list is a normal answer, not a failure.
 */
export async function handleProviderModels(body: unknown, signal?: AbortSignal): Promise<Response> {
  if (!isRecord(body)) return json({ error: "expected an object" }, 400);
  const id = body["id"];
  if (typeof id !== "string" || !id) return json({ error: "id is required" }, 400);

  const vault = await readVault();
  const config = vault.providers.find((p) => p.id === id);
  if (!config) return json({ error: "no such provider" }, 404);

  try {
    const found = await listModelsFor(config);
    /**
     * NULL AND EMPTY ARE DIFFERENT ANSWERS. Null means this provider publishes no list at all and
     * the form should simply take a typed model id; an empty array means it published a list with
     * nothing in it, which is usually a key without access. Collapsing them would send somebody
     * hunting for a fault in the first case and hide a real one in the second.
     */
    if (found === null) return json({ models: [], manual: true });
    return json({
      models: found.map((m) => ({
        id: m.id,
        ...(m.label ? { label: m.label } : {}),
        ...(m.context ? { context: m.context } : {}),
      })),
    });
  } catch (error) {
    // A failed lookup stays an error so the form can explain and offer a retry, rather than
    // misreporting every network blip as "this provider has no models".
    const detail = error instanceof Error ? error.message : String(error);
    return json({ error: redactSecrets(detail).slice(0, 300) }, 502);
  }
}
