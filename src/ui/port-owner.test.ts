/** Real loopback identity checks keep launchers from opening another product. */
import { expect, test } from "bun:test";
import { claimPort, claimStudio, desktopPortOverride, findRunningStudio, runningHoplightAt } from "./port-owner";

test.each([
  [{ product: "bunzai", version: "1.0" }, false],
  [{ version: "1.0" }, false],
  [{ product: "hoplight", version: "0.1.41" }, true],
  [{ product: "hoplight", version: 1 }, false],
])("identifies the product answering /api/version: %j", async (body, expected) => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json(body) });
  try {
    expect(await runningHoplightAt(server.port!)).toBe(expected ? `http://127.0.0.1:${server.port}` : null);
  } finally { await server.stop(true); }
});

test("reuses only an identified same-product studio without starting or stopping it", async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: () => Response.json({ product: "hoplight", version: "fixture" }) });
  try {
    const claimed = await claimStudio(server.port!, 1, () => { throw new Error("must reuse"); });
    expect(claimed.url).toBe(`http://127.0.0.1:${server.port}`);
    claimed.stop();
    expect(await runningHoplightAt(server.port!)).toBe(claimed.url);
  } finally { await server.stop(true); }
});

test("foreign server survives fallback and the browser finder returns the actual port", async () => {
  const foreign = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: () => Response.json({ product: "bunzai", version: "fixture" }) });
  const started: ReturnType<typeof Bun.serve>[] = [];
  try {
    const claimed = await claimStudio(foreign.port!, 10, (port) => {
      if (port === foreign.port) throw new Error("occupied");
      const server = Bun.serve({ hostname: "127.0.0.1", port,
        fetch: () => Response.json({ product: "hoplight", version: "fixture", instanceId: "fixture-owned" }) });
      started.push(server);
      return { instanceId: "fixture-owned", stop: () => server.stop(true) };
    });
    expect(claimed.url).not.toBe(`http://127.0.0.1:${foreign.port}`);
    expect(await findRunningStudio(foreign.port!, 10)).toBe(claimed.url);
    expect(await (await fetch(`http://127.0.0.1:${foreign.port}`)).json()).toEqual({ product: "bunzai", version: "fixture" });
    claimed.stop();
  } finally {
    await foreign.stop(true);
    for (const server of started) await server.stop(true);
  }
});

test("a successful bind answered by a foreign server is stopped, never opened", async () => {
  const foreign = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: () => Response.json({ version: "generic" }) });
  let stopped = 0;
  try {
    await expect(claimStudio(foreign.port!, 1, () => ({ instanceId: "ours", stop() { stopped++; } }))).rejects.toThrow("no Hoplight port");
    expect(stopped).toBe(1);
    expect(await findRunningStudio(foreign.port!, 1)).toBeNull();
  } finally { await foreign.stop(true); }
});

test("desktop overrides are bounded decimals and never reuse an existing product", async () => {
  expect(desktopPortOverride(undefined)).toBeNull();
  expect(desktopPortOverride("45101")).toBe(45101);
  for (const value of ["", " 45101", "+45101", "45101x", "0", "1023", "65536"]) {
    expect(() => desktopPortOverride(value)).toThrow("HOPLIGHT_PORT");
  }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: () => Response.json({ product: "hoplight", version: "fixture" }) });
  try {
    const error = await claimStudio(server.port!, 1, () => { throw new Error("must not start"); }, false)
      .then(() => null, (cause: Error) => cause);
    expect(error?.message).toContain("already running");
  } finally { await server.stop(true); }
});

test("an isolated post-bind same-product competitor is never owned", async () => {
  let answering = false, stopped = 0;
  const competitor = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => answering
    ? Response.json({ product: "hoplight", version: "fixture", instanceId: "competitor" })
    : new Response("not ready", { status: 404 }) });
  try {
    const error = await claimStudio(competitor.port!, 1, () => {
      answering = true;
      return { instanceId: "ours", stop() { stopped++; } };
    }, false).then(() => null, (cause: Error) => cause);
    expect(error).toBeInstanceOf(Error);
    expect(stopped).toBe(1);
  } finally { await competitor.stop(true); }
});

test("default post-bind competition closes its candidate and intentionally reuses", async () => {
  let answering = false, stopped = 0;
  const competitor = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => answering
    ? Response.json({ product: "hoplight", version: "fixture", instanceId: "competitor" })
    : new Response("not ready", { status: 404 }) });
  try {
    const result = await claimStudio(competitor.port!, 1, () => {
      answering = true;
      return { instanceId: "ours", stop() { stopped++; } };
    });
    expect(result.url).toBe(`http://127.0.0.1:${competitor.port}`);
    expect(stopped).toBe(1);
    result.stop();
    expect(stopped).toBe(1);
  } finally { await competitor.stop(true); }
});

test.each(["competitor", "owned"])("CLI claim checks exact newly started instance %s", async (instanceId) => {
  let stopped = 0, closed = 0;
  const responder = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: () => Response.json({ product: "hoplight", version: "fixture", instanceId }) });
  try {
    const result = await claimPort(responder.port!, 1, () => ({ instanceId: "owned", stop() { stopped++; }, async close() { closed++; } }))
      .then((value) => ({ value, error: null }), (error: Error) => ({ value: null, error }));
    if (instanceId === "owned") { expect(result.value?.port).toBe(responder.port!); expect(stopped).toBe(0); expect(closed).toBe(0); }
    else { expect(result.error).toBeInstanceOf(Error); expect(stopped).toBe(1); expect(closed).toBe(1); }
  } finally { await responder.stop(true); }
});
