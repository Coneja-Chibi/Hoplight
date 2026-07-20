/** Regression coverage for the knowledge-refs.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import {
  attachKnowledgeRef,
  detachKnowledgeRef,
  missingKnowledgeRefs,
  reorderKnowledgeRef,
} from "./knowledge-refs";

describe("knowledgeRefs", () => {
  test("attach dedupes", () => {
    expect(attachKnowledgeRef(["a"], "b")).toEqual(["a", "b"]);
    expect(attachKnowledgeRef(["a"], "a")).toEqual(["a"]);
  });

  test("detach and reorder", () => {
    expect(detachKnowledgeRef(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(reorderKnowledgeRef(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  test("missing refs", () => {
    expect(missingKnowledgeRefs(["a", "b"], new Set(["a"]))).toEqual(["b"]);
  });
});
