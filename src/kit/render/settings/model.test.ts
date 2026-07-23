/**
 * Settings model: prove the navigation and the add-provider flow end to end without a terminal.
 * The critical paths are the intents the shell acts on: close, set-active, and a save carrying a
 * correctly built ProviderConfig (with and without a base URL).
 */
import { describe, expect, test } from "bun:test";
import type { ProviderChoice, SettingsState } from "./model";
import { applyPaste, initialState, reduce } from "./model";

const CHOICES: ProviderChoice[] = [
  { id: "anthropic", label: "Claude", brand: "#DE7356", defaultModel: "claude-opus-4-8", keyless: false, needsBaseURL: false },
  { id: "custom", label: "Custom", brand: "#E11D48", defaultModel: "", keyless: false, needsBaseURL: true },
  { id: "local", label: "Local", brand: "#5AD07A", defaultModel: "", keyless: true, needsBaseURL: true },
];

const fresh = (): SettingsState => initialState(CHOICES, [], null);

const typeText = (state: SettingsState, text: string): SettingsState =>
  [...text].reduce((s, ch) => reduce(s, { name: ch, char: ch }).state, state);

describe("sections", () => {
  test("escape asks to close", () => {
    expect(reduce(fresh(), { name: "escape" }).intent).toEqual({ kind: "close" });
  });

  test("down in the rail moves through sections", () => {
    const s = reduce(fresh(), { name: "down" }).state;
    expect(s.section).toBe("gates");
  });

  test("enter on a saved provider makes it active", () => {
    const saved = [{ id: "p1", kind: "anthropic", model: "claude-opus-4-8" }];
    const state = initialState(CHOICES, saved, null); // focus starts on content
    expect(reduce(state, { name: "return" }).intent).toEqual({ kind: "setActive", id: "p1" });
  });
});

describe("add-provider flow", () => {
  test("add row opens the picker, enter opens the form", () => {
    const toContent = reduce(fresh(), { name: "2" }).state; // focus content (the add row)
    const picker = reduce(toContent, { name: "return" }).state;
    expect(picker.mode).toBe("picker");
    const form = reduce(picker, { name: "return" }).state; // pick anthropic
    expect(form.mode).toBe("form");
    expect(form.form?.choice.id).toBe("anthropic");
    expect(form.form?.model).toBe("claude-opus-4-8"); // prefilled default
  });

  test("a keyed provider saves with the pasted key and prefilled model", () => {
    let s = reduce(reduce(fresh(), { name: "2" }).state, { name: "return" }).state; // picker
    s = reduce(s, { name: "return" }).state; // form for anthropic (field = key)
    s = applyPaste(s, "sk-ant-pasted\n");
    const step = reduce(s, { name: "return" });
    expect(step.intent).toEqual({
      kind: "save",
      config: { kind: "anthropic", model: "claude-opus-4-8", name: "Claude", apiKey: "sk-ant-pasted" },
    });
  });

  test("enter with a required field empty focuses that field instead of saving", () => {
    let s = reduce(reduce(fresh(), { name: "2" }).state, { name: "return" }).state; // picker
    s = reduce(s, { name: "return" }).state; // anthropic form, key empty
    const step = reduce(s, { name: "return" });
    expect(step.intent).toBeUndefined();
    expect(step.state.form?.field).toBe("key");
  });

  test("a custom provider carries model, key, and base URL", () => {
    let s = reduce(reduce(fresh(), { name: "2" }).state, { name: "return" }).state; // picker
    s = reduce(s, { name: "down" }).state; // choose custom
    s = reduce(s, { name: "return" }).state; // form: fields key, baseURL, model
    s = typeText(s, "mykey");
    s = reduce(s, { name: "tab" }).state; // -> baseURL
    s = typeText(s, "https://proxy.example/v1");
    s = reduce(s, { name: "tab" }).state; // -> model
    s = typeText(s, "gpt-4o");
    const step = reduce(s, { name: "return" });
    expect(step.intent).toEqual({
      kind: "save",
      config: {
        kind: "custom",
        model: "gpt-4o",
        name: "Custom",
        apiKey: "mykey",
        baseURL: "https://proxy.example/v1",
      },
    });
  });
});
