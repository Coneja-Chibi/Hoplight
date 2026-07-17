/**
 * Value-only sandbox protocol: version, allowlist, token absence, size/shape negatives.
 */
import { describe, expect, test } from "bun:test";
import {
  encodeErrorResponse,
  encodeResultResponse,
  encodeRunRequest,
  messageContainsForbiddenKeys,
  parseRunRequest,
  parseRunResponse,
  SANDBOX_PROTOCOL_VERSION,
  SandboxProtocolError,
} from "./protocol";

describe("encodeRunRequest / parseRunRequest", () => {
  test("round-trips a minimal run", () => {
    const msg = encodeRunRequest({
      runId: 1,
      code: "return 1",
      state: { chatVars: { a: "b" } },
      memoryMaxBytes: 1024,
      timeoutMs: 500,
      withPrelude: true,
    });
    expect(msg.v).toBe(SANDBOX_PROTOCOL_VERSION);
    expect(msg.type).toBe("run");
    const parsed = parseRunRequest(msg);
    expect(parsed.code).toBe("return 1");
    expect(parsed.state.chatVars?.a).toBe("b");
  });

  test("rejects wrong version", () => {
    expect(() =>
      parseRunRequest({
        v: 99,
        type: "run",
        runId: 1,
        code: "x",
        state: {},
        memoryMaxBytes: 1,
        timeoutMs: 1,
        withPrelude: false,
      }),
    ).toThrow(SandboxProtocolError);
  });

  test("rejects unknown message type", () => {
    expect(() =>
      parseRunRequest({
        v: 1,
        type: "explode",
        runId: 1,
        code: "x",
        state: {},
        memoryMaxBytes: 1,
        timeoutMs: 1,
        withPrelude: false,
      }),
    ).toThrow(SandboxProtocolError);
  });

  test("rejects token / secret keys at top level", () => {
    expect(() =>
      parseRunRequest({
        v: 1,
        type: "run",
        runId: 1,
        code: "x",
        state: {},
        memoryMaxBytes: 1,
        timeoutMs: 1,
        withPrelude: false,
        token: "leak",
      }),
    ).toThrow(/forbidden key|unexpected key/);
  });

  test("rejects token nested under state", () => {
    expect(() =>
      parseRunRequest({
        v: 1,
        type: "run",
        runId: 1,
        code: "x",
        state: { token: "nope" },
        memoryMaxBytes: 1,
        timeoutMs: 1,
        withPrelude: false,
      }),
    ).toThrow(SandboxProtocolError);
  });

  test("rejects unexpected top-level fields", () => {
    expect(() =>
      parseRunRequest({
        v: 1,
        type: "run",
        runId: 1,
        code: "x",
        state: {},
        memoryMaxBytes: 1,
        timeoutMs: 1,
        withPrelude: false,
        extra: true,
      }),
    ).toThrow(/unexpected key/);
  });

  test("rejects non-plain prototype-bearing objects", () => {
    const weird = Object.create({ x: 1 });
    weird.v = 1;
    weird.type = "run";
    weird.runId = 1;
    weird.code = "x";
    weird.state = {};
    weird.memoryMaxBytes = 1;
    weird.timeoutMs = 1;
    weird.withPrelude = false;
    expect(() => parseRunRequest(weird)).toThrow(SandboxProtocolError);
  });

  test("rejects negative runId", () => {
    expect(() =>
      encodeRunRequest({
        runId: -1,
        code: "x",
        state: {},
        memoryMaxBytes: 1,
        timeoutMs: 1,
        withPrelude: false,
      }),
    ).toThrow(SandboxProtocolError);
  });
});

describe("parseRunResponse", () => {
  test("round-trips result", () => {
    const msg = encodeResultResponse({
      runId: 7,
      result: { ok: true, value: 42 },
      chatVars: { m: "ok" },
      log: ["hi"],
      state: { chatVars: { m: "ok" } },
    });
    const parsed = parseRunResponse(msg);
    expect(parsed.type).toBe("result");
    if (parsed.type === "result") {
      expect(parsed.result).toEqual({ ok: true, value: 42 });
      expect(parsed.runId).toBe(7);
    }
  });

  test("rejects malformed error", () => {
    expect(() =>
      parseRunResponse({
        v: 1,
        type: "error",
        runId: 1,
        reason: "nope",
        message: "x",
        chatVars: {},
        log: [],
        state: {},
      }),
    ).toThrow(SandboxProtocolError);
  });

  test("rejects response carrying authorization", () => {
    expect(() =>
      parseRunResponse({
        v: 1,
        type: "result",
        runId: 1,
        result: { ok: true, value: 1 },
        chatVars: {},
        log: [],
        state: {},
        authorization: "Bearer x",
      }),
    ).toThrow(SandboxProtocolError);
  });

  test("encodeErrorResponse has no forbidden keys", () => {
    const msg = encodeErrorResponse({
      runId: 2,
      reason: "protocol",
      message: "bad",
      state: {},
    });
    expect(messageContainsForbiddenKeys(msg)).toBe(false);
  });
});

describe("messageContainsForbiddenKeys", () => {
  test("detects nested session token keys", () => {
    expect(messageContainsForbiddenKeys({ a: { "vaude-session": "x" } })).toBe(true);
    expect(messageContainsForbiddenKeys({ code: "return 1", state: {} })).toBe(false);
  });
});
