/**
 * The Codex subscription provider against the real service, driven through Kit's own ChatFn.
 *
 * Opt-in only, via HOPLIGHT_LIVE_CODEX=1: run `HOPLIGHT_LIVE_CODEX=1 bun test src/kit/providers/codex.live.test.ts`.
 * A live run spends somebody's subscription, so it must never fire just because `bun test` found a
 * login on disk. The pure decisions are covered in codex-auth.test.ts; these are the four facts that
 * can only be established by asking the service, and all four were wrong in the first draft:
 *
 *   1. the endpoint speaks the Responses API and 404s on chat completions;
 *   2. it refuses any `version` header it does not recognise as a Codex client;
 *   3. it refuses `store: true`, which is the SDK's default;
 *   4. it refuses the public OpenAI model names, including every `*-codex` id.
 *
 * A unit test cannot notice any of them. If the service changes one, this is what says so.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { makeChat } from "./chat";
import { codexAuthPath, readCodexAuth } from "./codex-auth";
import { spokes } from "./registry";
import { guardedFetch } from "./egress";

const HAVE = existsSync(codexAuthPath());
const RUN_LIVE = process.env.HOPLIGHT_LIVE_CODEX === "1";

/** Read from the live catalogue rather than pinned, so a retired model id fails as a skip, not a lie. */
async function liveModel(): Promise<string> {
  const spoke = (await spokes()).get("codex")!;
  const models = await spoke.listModels!({ kind: "codex", model: "" }, guardedFetch(spoke.host!));
  return models[0]?.id ?? "";
}

describe.skipIf(!HAVE || !RUN_LIVE)("Codex subscription provider, live", () => {
  test("the login on this machine is readable and carries an unexpired token", async () => {
    const auth = await readCodexAuth();
    expect(auth.accessToken.length).toBeGreaterThan(20);
    if (auth.expiresAt !== undefined) expect(auth.expiresAt).toBeGreaterThan(Date.now());
  }, 60_000);

  test("the service lists the models this subscription may actually drive", async () => {
    const spoke = (await spokes()).get("codex")!;
    const models = await spoke.listModels!({ kind: "codex", model: "" }, guardedFetch(spoke.host!));
    expect(models.length).toBeGreaterThan(0);
    // Not the public OpenAI names: asking for "gpt-5" here is refused outright.
    expect(models.every((m) => typeof m.id === "string" && m.id.length > 0)).toBe(true);
  }, 60_000);

  test("a whole turn comes back, streamed, with real token counts", async () => {
    const model = await liveModel();
    const chat = makeChat({ kind: "codex", model });
    let streamed = "";
    const reply = await chat(
      [{ role: "user", content: "Reply with exactly the two characters: OK" }],
      [],
      (delta) => { if (delta.kind === "text") streamed += delta.text; },
    );
    expect(reply.kind).toBe("say");
    expect(reply.text.trim().length).toBeGreaterThan(0);
    // The deltas must carry the answer too, or the screen stays blank while the reply arrives.
    expect(streamed.trim()).toBe(reply.text.trim());
    // The egress ledger reports these numbers; zeros would make it claim nothing was sent.
    expect(reply.usage?.input).toBeGreaterThan(0);
    expect(reply.usage?.output).toBeGreaterThan(0);
  }, 180_000);

  test("tool calls come back UNRUN, which is what Kit's loop requires", async () => {
    // The deciding capability. A provider that cannot return tool calls is a text box, not something
    // Kit's agent loop can drive, so this is the test that says whether the provider is usable at all.
    const model = await liveModel();
    const chat = makeChat({ kind: "codex", model });
    const reply = await chat(
      [{ role: "user", content: "What is the weather in Osaka? Use the tool." }],
      [{
        name: "get_weather",
        description: "Get the current weather for a city.",
        schema: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
          additionalProperties: false,
        },
      }],
    );
    expect(reply.kind).toBe("use");
    if (reply.kind !== "use") return;
    expect(reply.calls).toHaveLength(1);
    expect(reply.calls[0]!.name).toBe("get_weather");
    expect(reply.calls[0]!.id.length).toBeGreaterThan(0);
    expect((reply.calls[0]!.args as { city?: string }).city).toMatch(/osaka/i);
  }, 180_000);
});
