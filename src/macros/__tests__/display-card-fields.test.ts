// VVS-557: {{charPrompt}}/{{charInstruction}} resolved in the prompt but rendered raw/blank
// in the chat bubble. The bubble uses a SEPARATE macro context-builder (prompt-builder's
// buildMacroContext via processText) that never mapped the card-definition fields. The prior
// fix only wired the prompt-assembly context, and its test only exercised that path — so the
// display path stayed broken + untested. This test covers the display path directly.

import { describe, it, expect } from "vitest";
import { processText, type PromptBuildContext } from "../prompt-builder";

function makeCtx(
  card: Partial<{
    systemPrompt: string;
    postHistoryInstructions: string;
    creatorNotes: string;
  }>,
): PromptBuildContext {
  return {
    character: {
      name: "Char",
      systemPrompt: card.systemPrompt,
      postHistoryInstructions: card.postHistoryInstructions,
      creatorNotes: card.creatorNotes,
    },
    persona: { name: "User" },
    messages: [],
  };
}

describe("VVS-557 display-path card-field macros", () => {
  it("resolves {{charPrompt}} from the character's systemPrompt", () => {
    const r = processText("{{charPrompt}}", makeCtx({ systemPrompt: "SYSTEM PROMPT TEXT" }));
    expect(r.processedText).toBe("SYSTEM PROMPT TEXT");
  });

  it("resolves {{charInstruction}} from postHistoryInstructions", () => {
    const r = processText("{{charInstruction}}", makeCtx({ postHistoryInstructions: "POST HISTORY TEXT" }));
    expect(r.processedText).toBe("POST HISTORY TEXT");
  });

  it("resolves {{charCreatorNotes}} from creatorNotes", () => {
    const r = processText("{{charCreatorNotes}}", makeCtx({ creatorNotes: "CREATOR NOTES TEXT" }));
    expect(r.processedText).toBe("CREATOR NOTES TEXT");
  });

  it("an empty/undefined field resolves to empty string, never the raw token", () => {
    const r = processText("[{{charPrompt}}]", makeCtx({}));
    expect(r.processedText).toBe("[]");
  });
});
