/**
 * The rules behind the model settings screen.
 *
 * Two of these decide whether somebody loses an API key by editing a model id, which is the kind of
 * thing that is obvious once and invisible forever after.
 */
import { describe, expect, test } from "bun:test";
import {
  draftFrom,
  draftProblem,
  emptyDraft,
  providerLabel,
  saveBody,
  type ProviderKind,
  type SafeProvider,
} from "./models-core";

const ANTHROPIC: ProviderKind = {
  id: "anthropic", label: "Anthropic", brand: "#d97757",
  defaultModel: "claude-opus-4-8", keyless: false, needsBaseUrl: false,
};
const LOCAL: ProviderKind = {
  id: "local", label: "Local", brand: "#555", keyless: true, needsBaseUrl: true,
};

const saved: SafeProvider = {
  id: "p1", kind: "anthropic", model: "claude-opus-4-8", hasKey: true, active: true,
};

describe("draftProblem", () => {
  test("a new provider needs its key", () => {
    const draft = { ...emptyDraft(ANTHROPIC) };
    expect(draftProblem(draft, ANTHROPIC)).toContain("needs an API key");
  });

  test("EDITING A SAVED PROVIDER DOES NOT DEMAND THE KEY AGAIN", () => {
    /**
     * The server will not send a stored key back, so the field is necessarily empty when editing.
     * If blank counted as missing, changing a model id - the single most common edit here - would
     * mean digging the key out of wherever it came from every single time.
     */
    const draft = draftFrom(saved);
    expect(draft.apiKey).toBe("");
    expect(draftProblem(draft, ANTHROPIC, saved.hasKey)).toBeNull();
  });

  test("a saved provider WITHOUT a key still needs one", () => {
    // Being an existing entry is not the same as having a secret already.
    expect(draftProblem(draftFrom({ ...saved, hasKey: false }), ANTHROPIC, false))
      .toContain("needs an API key");
  });

  test("a keyless provider never asks", () => {
    const draft = { ...emptyDraft(LOCAL), model: "llama", baseURL: "http://localhost:1234/v1" };
    expect(draftProblem(draft, LOCAL)).toBeNull();
  });

  test("a base-URL provider says which field is missing", () => {
    const draft = { ...emptyDraft(LOCAL), model: "llama" };
    expect(draftProblem(draft, LOCAL)).toContain("base URL");
  });

  test("a model is always required", () => {
    expect(draftProblem({ ...emptyDraft(ANTHROPIC), model: "  " }, ANTHROPIC)).toContain("model");
  });
});

describe("saveBody", () => {
  test("A BLANK KEY IS OMITTED, NOT SENT AS AN EMPTY STRING", () => {
    /**
     * The difference between "keep the key you have" and "save an empty key". Sending "" would
     * destroy a working secret every time somebody edited a model id, and the failure would only
     * show up at the next turn as an authentication error nobody could explain.
     */
    const body = saveBody({ ...draftFrom(saved), model: "claude-sonnet-5" });
    expect(body).not.toHaveProperty("apiKey");
    expect(body["id"]).toBe("p1");
    expect(body["model"]).toBe("claude-sonnet-5");
  });

  test("a key that was typed is sent", () => {
    const body = saveBody({ ...draftFrom(saved), apiKey: "  sk-new  " });
    // Trimmed: a pasted key routinely carries a trailing space or newline, and the provider will
    // reject it with a message about the key being invalid rather than about whitespace.
    expect(body["apiKey"]).toBe("sk-new");
  });

  test("blank optional fields are left out rather than saved as empty", () => {
    const body = saveBody(emptyDraft(ANTHROPIC));
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("baseURL");
    expect(body).not.toHaveProperty("id");
  });
});

describe("providerLabel", () => {
  test("two entries of the same kind are told apart by their model", () => {
    // Running one provider twice is normal: a personal key and a work key, or two models on one
    // account. A label that said "Anthropic" twice would be useless in exactly that case.
    const a = providerLabel({ ...saved, model: "claude-opus-4-8" }, [ANTHROPIC]);
    const b = providerLabel({ ...saved, model: "claude-sonnet-5" }, [ANTHROPIC]);
    expect(a).not.toBe(b);
  });

  test("a name the user chose wins", () => {
    expect(providerLabel({ ...saved, name: "Work" }, [ANTHROPIC])).toBe("Work (Anthropic)");
  });

  test("an unknown kind still renders as something", () => {
    // A vault written by a newer build can name a spoke this one does not ship.
    expect(providerLabel({ ...saved, kind: "future" }, [ANTHROPIC])).toContain("future");
  });
});
