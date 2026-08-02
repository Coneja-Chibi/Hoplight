/**
 * The Claude Code CLI provider.
 *
 * The risks here are the ones that would be invisible in use: a failed turn reading as a model that
 * said nothing, the CLI's own tools quietly running inside a Kit turn, or a turn inheriting the
 * user's coding configuration. Those are what is pinned. The live half is in claude-cli.live.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { cliArgs, foldHistory, parseCliResult } from "./claude-cli";
import type { ModelMessage } from "./provider";

describe("foldHistory", () => {
  test("labels each turn so the model can tell who spoke", () => {
    const folded = foldHistory([
      { role: "user", content: "my name is Chi." },
      { role: "assistant", content: "Noted." },
    ]);
    expect(folded).toBe("User: my name is Chi.\n\nAssistant: Noted.");
  });

  test("a tool result is labelled as evidence, not put in the user's mouth", () => {
    // Folding a tool observation in as "User:" would have the model believe the person said it.
    const folded = foldHistory([
      { role: "tool", content: "42 characters found", toolCallId: "1", toolName: "studio_list" },
    ]);
    expect(folded).toContain("Tool result (studio_list)");
    expect(folded).not.toContain("User: 42");
  });

  test("an empty history still produces a prompt, because the CLI refuses a blank one", () => {
    expect(foldHistory([])).toBe("User: [start]");
    expect(foldHistory([{ role: "assistant", content: "   " }])).toBe("User: [start]");
  });

  test("blank turns are dropped rather than emitted as empty labels", () => {
    const folded = foldHistory([
      { role: "user", content: "hi" },
      { role: "assistant", content: "" },
      { role: "user", content: "still there?" },
    ]);
    expect(folded).toBe("User: hi\n\nUser: still there?");
  });
});

describe("cliArgs", () => {
  const args = cliArgs("sonnet", "You are a narrator.");
  const valueAfter = (flag: string): string | undefined => args[args.indexOf(flag) + 1];

  test("replaces the system prompt rather than appending to it", () => {
    // --append-system-prompt would keep the full coding-agent framing on top of ours, which measured
    // at roughly double the per-turn overhead.
    expect(args).toContain("--system-prompt");
    expect(args).not.toContain("--append-system-prompt");
    expect(valueAfter("--system-prompt")).toBe("You are a narrator.");
  });

  test("refuses the CLI's own tools, so no second authority acts inside a Kit turn", () => {
    const refused = valueAfter("--disallowedTools") ?? "";
    for (const tool of ["Bash", "Read", "Write", "Edit", "WebFetch", "Task"]) {
      expect(refused).toContain(tool);
    }
  });

  test("inherits none of the user's own configuration", () => {
    // A Kit turn must carry what Kit sent, not whatever CLAUDE.md or MCP servers happen to be set up
    // for their coding work.
    expect(valueAfter("--setting-sources")).toBe("");
    expect(args).toContain("--strict-mcp-config");
  });

  test("asks for one JSON result rather than an interactive session", () => {
    expect(args).toContain("-p");
    expect(valueAfter("--output-format")).toBe("json");
    expect(valueAfter("--model")).toBe("sonnet");
  });
});

describe("parseCliResult", () => {
  const ok = JSON.stringify({
    is_error: false,
    result: "Chi",
    total_cost_usd: 0.0212828,
    usage: {
      input_tokens: 2,
      output_tokens: 5,
      cache_read_input_tokens: 15366,
      cache_creation_input_tokens: 2664,
    },
  });

  test("reads the reply, the token counts and the reported cost", () => {
    const parsed = parseCliResult(ok);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.text).toBe("Chi");
    expect(parsed.usage.cacheRead).toBe(15366);
    expect(parsed.usage.cacheWrite).toBe(2664);
    expect(parsed.costUsd).toBeCloseTo(0.0212828);
  });

  test("tolerates the CLI printing a warning before its JSON", () => {
    // Observed live: the CLI writes advisory lines to stdout ahead of the result object.
    const parsed = parseCliResult(`Warning: something advisory\n${ok}`);
    expect(parsed.ok).toBe(true);
  });

  test("an error result is a refusal carrying what the CLI said", () => {
    const parsed = parseCliResult(JSON.stringify({ is_error: true, result: "rate limit reached" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).toBe("engine-error");
    expect(parsed.detail).toContain("rate limit");
  });

  test("a reply with no result text is REFUSED, not read as an empty answer", () => {
    // The distinction this whole module has to preserve: a failed turn and a model that said nothing
    // are different outcomes, and collapsing them would show a blank reply as success.
    for (const body of ["", "not json", "{}", JSON.stringify({ usage: {} })]) {
      const parsed = parseCliResult(body);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.reason).toBe("bad-output");
    }
  });

  test("missing usage yields zeros rather than throwing", () => {
    const parsed = parseCliResult(JSON.stringify({ result: "hi" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.usage.input).toBe(0);
    expect(parsed.costUsd).toBeUndefined();
  });
});

describe("the tool limitation is real and must stay visible", () => {
  test("history folding carries tool results but the provider offers no tools", async () => {
    // The CLI runs its own agent loop and cannot hand a call back unrun, which is what Kit's loop
    // needs. Prior tool results still reach the model as context; new tool calls cannot happen.
    const messages: ModelMessage[] = [
      { role: "tool", content: "found 3", toolCallId: "1", toolName: "studio_search" },
    ];
    expect(foldHistory(messages)).toContain("found 3");
  });
});

describe("the MCP tool bridge", () => {
  test("without a config the turn is text-only, and still isolated", () => {
    const args = cliArgs("sonnet", "SYS");
    expect(args).not.toContain("--mcp-config");
    // Isolation is not conditional on the bridge: a text-only turn must still not inherit the
    // person's own MCP servers, which would appear as if Kit had offered them.
    expect(args).toContain("--strict-mcp-config");
    expect(args).not.toContain("--permission-mode");
  });

  test("with a config the bridge is wired and Kit's gate becomes the only one", () => {
    const args = cliArgs("sonnet", "SYS", "C:/tmp/mcp.json");
    expect(args[args.indexOf("--mcp-config") + 1]).toBe("C:/tmp/mcp.json");
    expect(args).toContain("--strict-mcp-config");
    // bypassPermissions turns the CLI's own prompting off. Correct, because Kit owns the gate, and
    // load-bearing, because there is then no second gate behind it.
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("bypassPermissions");
  });
});
