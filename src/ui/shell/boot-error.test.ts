/** Verifies that Studio boot failures give specific, safe recovery instructions. */
import { describe, expect, test } from "bun:test";
import { genericBootProblem, settingsBootProblem } from "./boot-error";

describe("settingsBootProblem", () => {
  test("a forwarded 403 explains the localhost URL, tunnel, and sandbox limitation", () => {
    const problem = settingsBootProblem(403, "forbidden", { port: "9321" });

    expect(problem.localUrl).toBe("http://localhost:9321");
    expect(problem.remoteSetupUrl).toBe(
      "http://localhost:9321/#settings/remote-access",
    );
    expect(problem.sshCommand).toBe("ssh -L 9321:127.0.0.1:9321 user@server");
    expect(problem.message).toContain("refused the address");
    expect(problem.sandboxNote).toContain("two-port SSH command");
  });

  test("the default port is useful when the page URL omits one", () => {
    expect(settingsBootProblem(403, "forbidden", { port: "" }).localUrl).toBe(
      "http://localhost:8321",
    );
  });

  test("non-forbidden failures retain the server's useful message", () => {
    expect(settingsBootProblem(500, "settings are unreadable", { port: "8321" })).toEqual({
      message: "settings are unreadable",
    });
  });
});

test("genericBootProblem keeps thrown Error messages", () => {
  expect(genericBootProblem(new Error("could not load app roster")).message).toBe(
    "could not load app roster",
  );
});
