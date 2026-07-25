/** Verifies the copyable SSH-forwarding receipt for Studio and sandbox listeners. */
import { describe, expect, test } from "bun:test";
import { forwardingGuide } from "./forwarding";

describe("forwardingGuide", () => {
  test("includes both known loopback listeners in one command", () => {
    expect(forwardingGuide("9321", "49152")).toEqual({
      localUrl: "http://localhost:9321",
      sshCommand:
        "ssh -L 9321:127.0.0.1:9321 -L 49152:127.0.0.1:49152 user@server",
    });
  });

  test("falls back safely and omits an unavailable sandbox listener", () => {
    expect(forwardingGuide("not-a-port")).toEqual({
      localUrl: "http://localhost:8321",
      sshCommand: "ssh -L 8321:127.0.0.1:8321 user@server",
    });
  });
});
