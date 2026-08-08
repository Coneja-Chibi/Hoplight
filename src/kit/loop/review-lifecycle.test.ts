/** Coverage for the draft, review, and apply lifecycle inside the ReAct loop. */
import { expect, test } from "bun:test";
import type { ChatFn, ModelToolCall } from "../providers/provider";
import { runTurn } from "./loop-core";
import { deps, drain, scripted } from "./_shared/test-harness";

test("a turn that settles two apply calls records BOTH tool results", async () => {
  // A model can emit several change_apply calls in one reply. The loop used to return on the
  // first apply result, dropping the second call's result from history; the next request then
  // carried an assistant tool call with no matching tool result, which providers reject with
  // "Tool result is missing for tool call ...". The early return is gone now - a write closes a
  // cycle rather than the turn - so the reply that ENDS this turn is scripted explicitly.
  const chat = scripted([
    {
      kind: "use",
      text: "",
      calls: [
        { id: "apply-a", name: "change_apply", args: { draftId: "draft-a" } },
        { id: "apply-b", name: "change_apply", args: { draftId: "draft-b" } },
      ],
    },
    { kind: "say", text: "both applied" },
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

test("A TURN KEEPS GOING AFTER A WRITE LANDS, so 'make me three' makes three", async () => {
  /**
   * The behaviour this whole change exists for. Asked for three versions, the model drafted three,
   * the first apply landed, and the turn went home with two drafts stranded - because the loop
   * returned at the first settled apply. Three separate draft-apply cycles must now fit in one turn.
   */
  const chat = scripted([
    { kind: "use", text: "", calls: [{ id: "a1", name: "change_apply", args: { draftId: "v1" } }] },
    { kind: "use", text: "", calls: [{ id: "a2", name: "change_apply", args: { draftId: "v2" } }] },
    { kind: "use", text: "", calls: [{ id: "a3", name: "change_apply", args: { draftId: "v3" } }] },
    { kind: "say", text: "three versions are in the studio" },
  ]);
  const { events, history } = await drain(runTurn("make me three versions", [], deps(chat, {
    effectFor: () => "apply",
    dispatch: async (call) => ({
      summary: `${call.name} ok`,
      output: `applied ${(call.args as { draftId?: string }).draftId}`,
      outcome: "applied",
    }),
  })));

  const applied = history.filter((m) => m.role === "tool").map((m) => m.content);
  expect(applied).toEqual(["applied v1", "applied v2", "applied v3"]);
  // It ended because the model stopped asking for tools, not because a write cut it short.
  expect(events.at(-1)).toEqual({ type: "say", text: "three versions are in the studio" });
});

test("EACH WRITE IS STILL GATED ON ITS OWN", async () => {
  /**
   * The load-bearing half. Continuing after a write only stays safe because approval was never the
   * turn boundary's job: the Gate holds the loop on every apply, so three writes ask three times.
   * If a future change ever batches consent, this fails.
   */
  const asked: string[] = [];
  const chat = scripted([
    { kind: "use", text: "", calls: [{ id: "a1", name: "change_apply", args: { draftId: "v1" } }] },
    { kind: "use", text: "", calls: [{ id: "a2", name: "change_apply", args: { draftId: "v2" } }] },
    { kind: "say", text: "done" },
  ]);
  await drain(runTurn("two writes", [], deps(chat, {
    effectFor: () => "apply",
    // Stands in for the gate: a real one holds on requestConfirm, and this records that it was asked.
    dispatch: async (call) => {
      asked.push((call.args as { draftId?: string }).draftId ?? "?");
      return { summary: "ok", output: "applied", outcome: "applied" as const };
    },
  })));
  expect(asked).toEqual(["v1", "v2"]);
});

test("a stale write does not end the turn either", async () => {
  /**
   * Stale means the piece moved underneath and NOTHING was written. Ending there would leave the
   * model unable to re-read and try again in the same breath, which is the one moment it obviously
   * should.
   */
  const chat = scripted([
    { kind: "use", text: "", calls: [{ id: "a1", name: "change_apply", args: { draftId: "v1" } }] },
    { kind: "say", text: "that one was stale; re-reading" },
  ]);
  const { events } = await drain(runTurn("apply", [], deps(chat, {
    effectFor: () => "apply",
    dispatch: async () => ({ summary: "stale", output: "nothing written", outcome: "stale" as const }),
  })));
  expect(events.at(-1)).toEqual({ type: "say", text: "that one was stale; re-reading" });
});
