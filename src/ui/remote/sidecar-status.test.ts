/** Tests for the pure remote-access status core: tolerant parsing + total reduction. */
import { describe, expect, test } from "bun:test";
import {
  OFF,
  parseDevicesLine,
  parseStatusLine,
  reduceRemoteState,
  type RemoteState,
} from "./sidecar-status";

describe("parseStatusLine", () => {
  test("parses a needs-login event with the sign-in URL", () => {
    const ev = parseStatusLine(
      '{"event":"status","state":"needs-login","authUrl":"https://login.tailscale.com/a/abc"}',
    );
    expect(ev).toEqual({ state: "needs-login", authUrl: "https://login.tailscale.com/a/abc" });
  });

  test("parses a running event with the dns name", () => {
    const ev = parseStatusLine('{"event":"status","state":"running","dnsName":"studio.tail1234.ts.net"}');
    expect(ev).toEqual({ state: "running", dnsName: "studio.tail1234.ts.net" });
  });

  test("parses a needs-https event", () => {
    expect(parseStatusLine('{"event":"status","state":"needs-https"}')).toEqual({ state: "needs-https" });
  });

  test("returns null for non-status json", () => {
    expect(parseStatusLine('{"event":"log","msg":"whatever"}')).toBeNull();
    expect(parseStatusLine('{"level":"info"}')).toBeNull();
  });

  test("returns null for an unknown state", () => {
    expect(parseStatusLine('{"event":"status","state":"exploded"}')).toBeNull();
  });

  test("returns null for malformed or partial lines, never throws", () => {
    expect(parseStatusLine("")).toBeNull();
    expect(parseStatusLine("   ")).toBeNull();
    expect(parseStatusLine('{"event":"status"')).toBeNull(); // truncated
    expect(parseStatusLine("not json at all")).toBeNull();
    expect(parseStatusLine("[1,2,3]")).toBeNull();
    expect(parseStatusLine("null")).toBeNull();
  });

  test("drops non-string optional fields", () => {
    expect(parseStatusLine('{"event":"status","state":"error","message":42}')).toEqual({ state: "error" });
  });
});

describe("reduceRemoteState", () => {
  test("drives the full happy path off -> starting -> needs-login -> connected", () => {
    let s: RemoteState = OFF;
    s = reduceRemoteState(s, { state: "starting" });
    expect(s.phase).toBe("starting");
    s = reduceRemoteState(s, { state: "needs-login", authUrl: "https://login.tailscale.com/a/x" });
    expect(s).toEqual({ phase: "needs-login", signInUrl: "https://login.tailscale.com/a/x" });
    s = reduceRemoteState(s, { state: "running", dnsName: "n.tail.ts.net" });
    expect(s).toEqual({ phase: "connected", url: "https://n.tail.ts.net" });
  });

  test("stopped returns to off", () => {
    expect(reduceRemoteState({ phase: "connected", url: "x" }, { state: "stopped" })).toEqual(OFF);
  });

  test("error carries its message", () => {
    expect(reduceRemoteState(OFF, { state: "error", message: "listen tls: denied" })).toEqual({
      phase: "error",
      error: "listen tls: denied",
    });
  });

  test("needs-https is its own guided phase", () => {
    expect(reduceRemoteState({ phase: "needs-login", signInUrl: "x" }, { state: "needs-https" })).toEqual({
      phase: "needs-https",
    });
  });

  test("a bare needs-login keeps a URL already shown", () => {
    const withUrl: RemoteState = { phase: "needs-login", signInUrl: "https://login.tailscale.com/a/x" };
    expect(reduceRemoteState(withUrl, { state: "needs-login" })).toEqual(withUrl);
  });

  test("running without a dns name still connects", () => {
    expect(reduceRemoteState(OFF, { state: "running" })).toEqual({ phase: "connected" });
  });
});

describe("parseDevicesLine", () => {
  test("parses a devices event, dropping malformed entries", () => {
    const line = JSON.stringify({
      event: "devices",
      devices: [
        { nodeId: "n1", name: "phone", login: "o@x", lastSeen: 1000 },
        { name: "no-id" }, // dropped: no nodeId
        { nodeId: "n2" }, // kept with defaults
      ],
    });
    expect(parseDevicesLine(line)).toEqual([
      { nodeId: "n1", name: "phone", login: "o@x", lastSeen: 1000 },
      { nodeId: "n2", name: "", login: "", lastSeen: 0 },
    ]);
  });

  test("returns null for a status line or malformed input", () => {
    expect(parseDevicesLine('{"event":"status","state":"running"}')).toBeNull();
    expect(parseDevicesLine("not json")).toBeNull();
    expect(parseDevicesLine('{"event":"devices"}')).toBeNull(); // no devices array
  });
});
