/**
 * Settings model: prove the navigation and the add-provider flow end to end without a terminal.
 * The critical paths are the intents the shell acts on: close, set-active, and a save carrying a
 * correctly built ProviderConfig (with and without a base URL).
 */
import { describe, expect, test } from "bun:test";
import type { FormState, ProviderChoice, SettingsState } from "./model";
import { applyPaste, canFetchModels, filteredModels, formSignature, initialState, reduce } from "./model";

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

  test("a ready model list turns up/down/enter into pick-from-list", () => {
    let s = reduce(reduce(fresh(), { name: "2" }).state, { name: "return" }).state; // picker
    s = reduce(s, { name: "return" }).state; // anthropic form
    s = applyPaste(s, "sk-ant-long-enough");
    // shell injects fetched models; simulate that, then focus the model field
    const withList: SettingsState = {
      ...s,
      form: {
        ...s.form!,
        model: "",
        field: "model",
        list: {
          state: "ready",
          index: 0,
          models: [
            { id: "claude-haiku-4-5", context: 200000 },
            { id: "claude-opus-4-8", context: 1000000 },
          ],
        },
      },
    };
    const down = reduce(withList, { name: "down" }).state;
    expect(down.form?.list.index).toBe(1); // moved the highlight, not the field
    expect(down.form?.field).toBe("model");
    const step = reduce(down, { name: "return" });
    expect(step.intent).toEqual({
      kind: "save",
      config: { kind: "anthropic", model: "claude-opus-4-8", name: "Claude", apiKey: "sk-ant-long-enough" },
    });
  });

  test("typing filters the list and enter falls back to typed text when nothing matches", () => {
    let s = reduce(reduce(fresh(), { name: "2" }).state, { name: "return" }).state;
    s = reduce(s, { name: "return" }).state;
    s = applyPaste(s, "sk-ant-long-enough");
    const withList: SettingsState = {
      ...s,
      form: {
        ...s.form!,
        model: "",
        field: "model",
        list: { state: "ready", index: 1, models: [{ id: "alpha" }, { id: "beta" }] },
      },
    };
    const typed = [..."bet"].reduce((st, ch) => reduce(st, { name: ch, char: ch }).state, withList);
    expect(filteredModels(typed.form!)).toEqual([{ id: "beta" }]);
    expect(typed.form?.list.index).toBe(0); // filter edits re-anchor the highlight

    const noMatch = [..."zzz"].reduce((st, ch) => reduce(st, { name: ch, char: ch }).state, withList);
    const step = reduce(noMatch, { name: "return" });
    expect(step.intent?.kind).toBe("save");
    if (step.intent?.kind === "save") expect(step.intent.config.model).toBe("zzz");
  });

  test("fetch gate and signature", () => {
    const form = (over: Partial<FormState>): FormState => ({
      choice: CHOICES[0]!,
      key: "",
      baseURL: "",
      model: "",
      field: "key",
      list: { state: "idle", models: [], index: 0 },
      ...over,
    });
    expect(canFetchModels(form({ key: "short" }))).toBe(false);
    expect(canFetchModels(form({ key: "sk-long-enough" }))).toBe(true);
    expect(canFetchModels(form({ choice: CHOICES[2]!, key: "" }))).toBe(false); // local: keyless but needs URL
    expect(canFetchModels(form({ choice: CHOICES[2]!, baseURL: "http://localhost:1234/v1" }))).toBe(true);
    // model text must not change the signature (picking must not refire the fetch)
    expect(formSignature(form({ key: "k".repeat(9), model: "a" }))).toBe(
      formSignature(form({ key: "k".repeat(9), model: "b" })),
    );
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
