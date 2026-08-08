/** Coverage for the draft, review, and apply lifecycle inside the ReAct loop. */
import { expect, test } from "bun:test";
import type { ChatFn, ModelToolCall } from "../providers/provider";
import { runTurn } from "./loop-core";
import { deps, drain, scripted } from "./_shared/test-harness";

test("a turn that settles two apply calls records BOTH tool results", async () => {
  // A model can emit several change_apply calls in one reply. The loop used to return on the
  // first apply result, dropping the second call's result from history; the next request then
  // carried an assistant tool call with no matching tool result, which providers reject with
  // "Tool result is missing for tool call ...".
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [
        { id: "apply-a", name: "change_apply", args: { draftId: "draft-a" } },
        { id: "apply-b", name: "change_apply", args: { draftId: "draft-b" } },
      ],
    },
  ]);
  const { history } = await drain(runTurn("apply both", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply" ? "apply" : "read",
    dispatch: async (call) => ({
      summary: `${call.name} ok`,
      output: `applied ${(call.args as { draftId?: string }).draftId}`,
      outcome: "applied",
    }),
  })));
  const toolResults = history.filter((m) => m.role === "tool");
  expect(toolResults.map((m) => m.toolCallId).sort()).toEqual(["apply-a", "apply-b"]);
  const assistantCalls = history
    .filter((m) => m.role === "assistant" && m.toolCalls?.length)
    .flatMap((m) => m.toolCalls ?? []);
  const resultIds = new Set(toolResults.map((m) => m.toolCallId));
  for (const call of assistantCalls) {
    expect(resultIds.has(call.id), `tool call ${call.id} has a result`).toBe(true);
  }
});

test("a discarded draft emits a discarded terminal receipt", async () => {
  const chat = scripted([
    { kind: "use", text: "", calls: [{ id: "discard", name: "change_discard", args: {} }] },
    { kind: "say", text: "discarded" },
  ]);
  const { events } = await drain(runTurn("discard it", [], deps(chat, {
    effectFor: () => "draft",
    dispatch: async () => ({
      summary: "discard draft-1: discarded",
      output: "{}",
      outcome: "discarded",
    }),
  })));
  expect(events).toContainEqual({ type: "state", phase: "discarded" });
  expect(events.at(-1)).toEqual({ type: "say", text: "discarded" });
});

test("a reviewable draft turns final model prose into application-owned review", async () => {
  let chatCalls = 0;
  const calls: ModelToolCall[] = [];
  const chat: ChatFn = async () => {
    chatCalls += 1;
    return chatCalls === 1
      ? {
          kind: "use",
          text: "",
          calls: [{ id: "rename", name: "character_identity_update", args: {} }],
        }
      : { kind: "say", text: "Would you like me to apply this change?" };
  };
  const { events, history } = await drain(runTurn("rename her", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply" ? "apply" : "draft",
    dispatch: async (call) => {
      calls.push(call);
      if (call.name === "change_apply") {
        return {
          summary: "apply draft-1: applied",
          output: '{"status":"applied"}',
          outcome: "applied",
        };
      }
      return {
        summary: "draft character.identity.update: 1 change",
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(chatCalls).toBe(2);
  expect(calls.map((call) => call.name)).toEqual([
    "character_identity_update",
    "change_apply",
  ]);
  expect(calls[1]?.args).toEqual({ draftId: "draft-1" });
  expect(events).toContainEqual({ type: "tool-start", name: "change_apply" });
  expect(events).toContainEqual({ type: "state", phase: "completed" });
  expect(events).not.toContainEqual({
    type: "say",
    text: "Would you like me to apply this change?",
  });
  // The apply call is recorded. Found by its CALL rather than by position, because the receipt now
  // lands after it and "the last assistant message" was never what this was really asserting.
  expect(
    history.filter((m) => m.role === "assistant" && m.toolCalls?.length).at(-1)?.toolCalls,
  ).toMatchObject([{ name: "change_apply", args: { draftId: "draft-1" } }]);

  // And the RECEIPT is in history as words, not only as raw JSON.
  //
  // Without it a resumed session showed the tool fold and then silence: a replay is a pure
  // projection of these messages, and the outcome the person saw lived only in a live UI event. The
  // model was in the same position - handed the payload twice and never told what it meant.
  const spoken = history.filter((m) => m.role === "assistant" && !m.toolCalls?.length);
  expect(spoken.at(-1)?.content).toContain("applied");
  expect(events.at(-1)).toEqual({ type: "say", text: "apply draft-1: applied" });
});

test("denying an automatic draft review discards it without a verbal follow-up", async () => {
  let chatCalls = 0;
  const calls: string[] = [];
  const { events } = await drain(runTurn("rename her", [], deps(async () => {
    chatCalls += 1;
    return chatCalls === 1
      ? {
          kind: "use",
          text: "",
          calls: [{ id: "rename", name: "character_identity_update", args: {} }],
        }
      : { kind: "say", text: "Would you like me to save or discard it?" };
  }, {
    effectFor: (call) => call.name === "change_apply"
      ? "apply"
      : call.name === "change_discard"
        ? "draft"
        : "draft",
    dispatch: async (call) => {
      calls.push(call.name);
      if (call.name === "change_apply") {
        return {
          summary: "change_apply: blocked",
          output: "Denied by the user.",
          gateDecision: "denied",
        };
      }
      if (call.name === "change_discard") {
        return {
          summary: "discard draft-1: discarded",
          output: '{"status":"discarded"}',
          outcome: "discarded",
        };
      }
      return {
        summary: "draft character.identity.update: 1 change",
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(chatCalls).toBe(2);
  expect(calls).toEqual([
    "character_identity_update",
    "change_apply",
    "change_discard",
  ]);
  expect(events).toContainEqual({ type: "state", phase: "discarded" });
});

test("multiple draft operations compose before the single review handoff", async () => {
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [{ id: "identity", name: "character_identity_update", args: {} }],
    },
    {
      kind: "use",
      text: "",
      calls: [{ id: "prompt", name: "character_prompts_update", args: {} }],
    },
    { kind: "say", text: "Ready to save both changes." },
  ]);
  const calls: string[] = [];
  await drain(runTurn("rename her and change the prompt", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply" ? "apply" : "draft",
    dispatch: async (call) => {
      calls.push(call.name);
      if (call.name === "change_apply") {
        return {
          summary: "apply draft-1: applied",
          output: '{"status":"applied"}',
          outcome: "applied",
        };
      }
      const composed = call.name === "character_prompts_update";
      return {
        summary: `draft ${call.name}`,
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: composed
            ? [
                { label: "name", before: "Aphrodite", after: "Dite" },
                { label: "system prompt", before: "Old", after: "New" },
              ]
            : [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(calls).toEqual([
    "character_identity_update",
    "character_prompts_update",
    "change_apply",
  ]);
});

test("denying a model-requested apply discards once instead of prompting again", async () => {
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [{ id: "rename", name: "character_identity_update", args: {} }],
    },
    {
      kind: "use",
      text: "",
      calls: [{ id: "apply", name: "change_apply", args: { draftId: "draft-1" } }],
    },
    { kind: "say", text: "Should I try that again?" },
  ]);
  const calls: string[] = [];
  const { events } = await drain(runTurn("rename her", [], deps(chat, {
    effectFor: (call) => call.name === "change_apply"
      ? "apply"
      : call.name === "change_discard"
        ? "draft"
        : "draft",
    dispatch: async (call) => {
      calls.push(call.name);
      if (call.name === "change_apply") {
        return {
          summary: "change_apply: blocked",
          output: "Denied by the user.",
          gateDecision: "denied",
        };
      }
      if (call.name === "change_discard") {
        return {
          summary: "discard draft-1: discarded",
          output: '{"status":"discarded"}',
          outcome: "discarded",
        };
      }
      return {
        summary: "draft character.identity.update: 1 change",
        output: '{"draftId":"draft-1"}',
        outcome: "draft",
        review: {
          draftId: "draft-1",
          target: { kind: "character", id: "aphrodite" },
          changes: [{ label: "name", before: "Aphrodite", after: "Dite" }],
          warningCount: 0,
        },
      };
    },
  })));

  expect(calls).toEqual([
    "character_identity_update",
    "change_apply",
    "change_discard",
  ]);
  expect(events).toContainEqual({ type: "state", phase: "discarded" });
  expect(events).not.toContainEqual({ type: "say", text: "Should I try that again?" });
});

test("a stale apply state cannot later become completed", async () => {
  let round = 0;
  const chat: ChatFn = async () => round++ === 0
    ? { kind: "use", text: "", calls: [{ id: "apply", name: "change_apply", args: {} }] }
    : { kind: "say", text: "I am done" };
  const { events } = await drain(runTurn("apply", [], deps(chat, {
    effectFor: () => "apply",
    dispatch: async () => ({ summary: "stale", output: "stale", outcome: "stale" }),
  })));
  const phases = events.filter((event) => event.type === "state").map((event) => event.phase);
  expect(phases).toContain("stale");
  expect(phases).not.toContain("completed");
});
