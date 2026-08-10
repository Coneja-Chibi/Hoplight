/**
 * Managing models over HTTP, and the one rule that matters most.
 *
 * A KEY MAY GO IN AND MUST NEVER COME BACK. Every other property here is convenience; this one is
 * the reason the surface is safe to have at all, so it is asserted directly against real vault
 * contents rather than inferred from reading the redactor.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleAgentRoutes } from "./routes";

const SECRET = "sk-ant-DO-NOT-LEAK-THIS-abc123456789";
let home = "";
let previous: string | undefined;

beforeEach(async () => {
  // The vault lives under HOPLIGHT_HOME; pointing it at a temp dir keeps a real one untouched.
  home = await mkdtemp(join(tmpdir(), "hoplight-vault-"));
  previous = process.env["HOPLIGHT_HOME"];
  process.env["HOPLIGHT_HOME"] = home;
});

afterEach(async () => {
  if (previous === undefined) delete process.env["HOPLIGHT_HOME"];
  else process.env["HOPLIGHT_HOME"] = previous;
  await rm(home, { recursive: true, force: true });
});

const STUDIO = () => "C:/nowhere";

const post = (path: string, body: unknown): Request =>
  new Request(`http://127.0.0.1:8321${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const get = (path: string): Request => new Request(`http://127.0.0.1:8321${path}`);

async function saveOne(): Promise<string> {
  const res = await handleAgentRoutes(
    "/api/agent/providers/save",
    post("/api/agent/providers/save", {
      kind: "anthropic", model: "claude-opus-4-8", name: "Work", apiKey: SECRET,
    }),
    STUDIO,
  );
  const body = (await res?.json()) as { provider?: { id: string }; error?: string };
  if (!body.provider) throw new Error(`save failed: ${body.error ?? "unknown"}`);
  return body.provider.id;
}

describe("the provider surface", () => {
  test("THE KEY NEVER COMES BACK, in any response, in any form", async () => {
    /**
     * Asserted against the whole serialised body rather than against named fields, so a key that
     * escaped through some field nobody thought of still fails this. Not masked, not truncated, not
     * "sk-ant-...789": absent.
     */
    const id = await saveOne();

    const saveText = JSON.stringify(await (await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { id, kind: "anthropic", model: "claude-sonnet-5" }),
      STUDIO,
    ))?.json());
    const listText = JSON.stringify(await (await handleAgentRoutes(
      "/api/agent/providers", get("/api/agent/providers"), STUDIO,
    ))?.json());

    for (const text of [saveText, listText]) {
      expect(text).not.toContain(SECRET);
      // Not even a fragment: a prefix is enough to confirm which service a leaked key belongs to.
      expect(text).not.toContain("DO-NOT-LEAK");
      expect(text).not.toContain("apiKey");
    }
    // But it does say a key EXISTS, which is the whole of what the screen needs.
    expect(listText).toContain('"hasKey":true');
  });

  test("EDITING WITHOUT A KEY KEEPS THE SAVED ONE", async () => {
    /**
     * Changing a model id must not destroy the secret. The field is necessarily blank on an edit -
     * the server refuses to send the stored key - so blank has to mean "keep it". If it meant
     * "clear it", every model change would silently break the provider, and the failure would
     * surface later as an authentication error nobody could connect to the edit.
     */
    const id = await saveOne();

    await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { id, kind: "anthropic", model: "claude-sonnet-5" }),
      STUDIO,
    );

    const list = (await (await handleAgentRoutes(
      "/api/agent/providers", get("/api/agent/providers"), STUDIO,
    ))?.json()) as { providers: { id: string; model: string; hasKey: boolean }[] };

    const found = list.providers.find((p) => p.id === id);
    expect(found?.model).toBe("claude-sonnet-5");
    expect(found?.hasKey).toBe(true);
  });

  test("a new provider that needs a key and has none is refused at the form", async () => {
    // Refused here, where the message can name the field, rather than saved and left to fail at the
    // first turn with an opaque provider error.
    const res = await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { kind: "anthropic", model: "claude-opus-4-8" }),
      STUDIO,
    );
    expect(res?.status).toBe(400);
    expect(((await res?.json()) as { error: string }).error).toContain("API key");
  });

  test("AN UNKNOWN PROVIDER TYPE IS REFUSED, not stored to fail later", async () => {
    const res = await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { kind: "not-a-real-spoke", model: "x", apiKey: "k" }),
      STUDIO,
    );
    expect(res?.status).toBe(400);
    expect(((await res?.json()) as { error: string }).error).toContain("unknown provider type");
  });

  test("activating an id that matches nothing is refused", async () => {
    // Writing it would leave the studio pointing at no reachable model, with a settings screen
    // showing nothing selected and no obvious way back.
    const res = await handleAgentRoutes(
      "/api/agent/providers/activate",
      post("/api/agent/providers/activate", { id: "never-existed" }),
      STUDIO,
    );
    expect(res?.status).toBe(404);
  });

  test("switching the active provider is reflected in the listing", async () => {
    const first = await saveOne();
    await handleAgentRoutes(
      "/api/agent/providers/activate", post("/api/agent/providers/activate", { id: first }), STUDIO,
    );
    const list = (await (await handleAgentRoutes(
      "/api/agent/providers", get("/api/agent/providers"), STUDIO,
    ))?.json()) as { providers: { id: string; active: boolean }[] };
    expect(list.providers.find((p) => p.id === first)?.active).toBe(true);
  });

  test("removing one takes it out of the list", async () => {
    const id = await saveOne();
    const res = await handleAgentRoutes(
      "/api/agent/providers/remove", post("/api/agent/providers/remove", { id }), STUDIO,
    );
    const body = (await res?.json()) as { providers: { id: string }[] };
    expect(body.providers.some((p) => p.id === id)).toBe(false);
  });

  test("the provider catalog comes from the spokes on disk", async () => {
    // Folders-as-schema: a spoke dropped into src/kit/providers/spokes appears here without anybody
    // remembering to add it to a list in the UI.
    const body = (await (await handleAgentRoutes(
      "/api/agent/providers", get("/api/agent/providers"), STUDIO,
    ))?.json()) as { kinds: { id: string; keyless: boolean }[] };

    expect(body.kinds.length).toBeGreaterThan(5);
    expect(body.kinds.some((k) => k.id === "anthropic")).toBe(true);
    // The keyless flag is what decides whether the form demands a secret.
    expect(body.kinds.some((k) => k.keyless)).toBe(true);
  });

  test("A SUBSCRIPTION IS NOT ASKED FOR A BASE URL IT CANNOT HAVE", async () => {
    /**
     * A missing host meant two different things and was read as one. `custom` and `local` have no
     * host because the person supplies the endpoint; `claude-sub` has none because there is no
     * endpoint - it drives the Claude CLI as a subprocess. Asking anyway made the only keyless
     * provider in the list impossible to save: the form refused, and this route refused after it.
     */
    const body = (await (await handleAgentRoutes(
      "/api/agent/providers", get("/api/agent/providers"), STUDIO,
    ))?.json()) as { kinds: { id: string; needsBaseUrl: boolean }[] };
    const kind = (id: string): boolean =>
      body.kinds.find((k) => k.id === id)?.needsBaseUrl === true;

    expect(kind("claude-sub")).toBe(false);
    // And the ones that genuinely need a URL still say so, or this "fix" is just a removed check.
    expect(kind("custom")).toBe(true);
    expect(kind("local")).toBe(true);
    expect(kind("anthropic")).toBe(false);
  });

  test("and it SAVES, with no base URL anywhere in the request", async () => {
    const res = await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { kind: "claude-sub", model: "opus" }),
      STUDIO,
    );
    expect(res?.status).toBe(200);
    const listed = (await (await handleAgentRoutes(
      "/api/agent/providers", get("/api/agent/providers"), STUDIO,
    ))?.json()) as { providers: { kind: string; model: string }[] };
    expect(listed.providers.some((p) => p.kind === "claude-sub" && p.model === "opus")).toBe(true);
  });

  test("a custom endpoint with no base URL is still refused", async () => {
    // The guard above narrowed; it must not have been removed.
    const res = await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { kind: "custom", model: "gpt-4o", apiKey: "sk-test-key-1234" }),
      STUDIO,
    );
    expect(res?.status).toBe(400);
    expect(((await res?.json()) as { error: string }).error).toContain("base URL");
  });

  test("THE MODEL LIST ANSWERS FOR A DRAFT, not only for something already saved", async () => {
    /**
     * The list used to need a saved id, which is one screen too late: the model is chosen while
     * ADDING a provider, and there the field fell back to typing an id from memory.
     */
    const res = await handleAgentRoutes(
      "/api/agent/providers/models",
      post("/api/agent/providers/models", { kind: "custom" }),
      STUDIO,
    );
    /**
     * Asserted on WHERE IT GOT TO rather than on a list, because a list would mean a live provider
     * in a unit test. A draft `custom` with no endpoint cannot publish one and says so - and saying
     * so proves the draft was resolved to a spoke and handed on. The old code answered
     * "id is required" and never reached the provider at all.
     */
    expect(res?.status).not.toBe(400);
    // The spoke's own label can only come from the provider path; a rejected draft never gets here.
    expect(JSON.stringify(await res?.json())).toContain("Custom (OpenAI-compatible)");
  });

  test("a draft naming no provider at all is still refused", async () => {
    const res = await handleAgentRoutes(
      "/api/agent/providers/models", post("/api/agent/providers/models", {}), STUDIO,
    );
    expect(res?.status).toBe(400);
  });

  test("a draft naming a provider this build has no spoke for is refused", async () => {
    const res = await handleAgentRoutes(
      "/api/agent/providers/models",
      post("/api/agent/providers/models", { kind: "not-a-real-spoke" }),
      STUDIO,
    );
    expect(res?.status).toBe(400);
  });

  test("A SPOKE'S OWN CHOICES ARE SAVED, not advertised and thrown away", async () => {
    /**
     * `claude-sub` reads `options.writes` to decide whether its tool server starts read-only. This
     * route never read `options` from the body, so a provider saved from the window carried none and
     * the answer was always "no": an agent that could read the whole studio and stage nothing, with
     * no control anywhere in the window to change it.
     */
    const res = await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", {
        kind: "claude-sub", model: "sonnet", options: { writes: "on" },
      }),
      STUDIO,
    );
    expect(res?.status).toBe(200);
    const saved = (await res?.json()) as { provider: { options?: Record<string, string> } };
    expect(saved.provider.options?.["writes"]).toBe("on");
  });

  test("EDITING DOES NOT SILENTLY TAKE WRITE ACCESS AWAY", async () => {
    /**
     * A save REPLACES the whole entry, so an edit that omits options would have reset the posture to
     * read-only - the same shape as the blank-key bug this file already guards against, and just as
     * invisible: the model changes, and the agent quietly loses the ability to stage anything.
     */
    const first = (await (await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { kind: "claude-sub", model: "sonnet", options: { writes: "on" } }),
      STUDIO,
    ))?.json()) as { provider: { id: string } };

    // Change only the model, exactly as the form does when nobody touches the option control.
    const after = (await (await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", { id: first.provider.id, kind: "claude-sub", model: "opus[1m]" }),
      STUDIO,
    ))?.json()) as { provider: { model: string; options?: Record<string, string> } };

    expect(after.provider.model).toBe("opus[1m]");
    expect(after.provider.options?.["writes"]).toBe("on");
  });

  test("a value the spoke never offered is refused back to its default", async () => {
    // This arrives from a browser and lands in the vault; an unknown posture is nobody's setting.
    const saved = (await (await handleAgentRoutes(
      "/api/agent/providers/save",
      post("/api/agent/providers/save", {
        kind: "claude-sub", model: "sonnet", options: { writes: "everything", bogus: "x" },
      }),
      STUDIO,
    ))?.json()) as { provider: { options?: Record<string, string> } };

    expect(saved.provider.options?.["writes"]).toBe("off");
    expect(saved.provider.options?.["bogus"]).toBeUndefined();
  });

  test("an unknown subpath under providers is a 404", async () => {
    const res = await handleAgentRoutes(
      "/api/agent/providers/nonsense", post("/api/agent/providers/nonsense", {}), STUDIO,
    );
    expect(res?.status).toBe(404);
  });
});
