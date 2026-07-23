/**
 * Settings navigation model: the pure, testable core of the Panel Deck. It holds where focus is
 * (which section, rail vs content, which row) and drives the add-provider flow (pick a provider,
 * then fill a small form). reduce() maps a keypress to the next state plus an optional intent the
 * shell executes (close, save, set-active); it never touches the vault, the screen, or the clock.
 */
import type { ProviderConfig } from "../../providers/config";
import type { ModelInfo } from "../../providers/models";
import type { SpokeOption } from "../../providers/spoke";

export type Section = "providers" | "gates" | "studio" | "about";
export const SECTIONS: readonly Section[] = ["providers", "gates", "studio", "about"];

export interface ProviderChoice {
  id: string; // spoke id, e.g. "anthropic", "custom"
  label: string;
  brand: string; // hex accent
  defaultModel: string;
  keyless: boolean; // local endpoints need no key
  needsBaseURL: boolean; // custom / local endpoints need a URL
  options: ReadonlyArray<SpokeOption>; // provider-specific choices (e.g. NanoGPT's plan)
}

/** Text fields plus one focusable entry per provider-declared option ("opt:plan"). */
export type Field = "key" | "baseURL" | "model" | `opt:${string}`;

export const optionOf = (choice: ProviderChoice, field: Field): SpokeOption | undefined =>
  field.startsWith("opt:") ? choice.options.find((o) => `opt:${o.key}` === field) : undefined;

/** The live model list under the model field: idle until a fetch fires, then loading, then ready
 * (possibly empty, which the form shows as "check the key"). index highlights within the FILTERED
 * view, what the user's typed text currently matches. */
export interface ModelList {
  state: "idle" | "loading" | "ready";
  models: ModelInfo[];
  index: number;
}

export interface FormState {
  choice: ProviderChoice;
  key: string;
  baseURL: string;
  model: string;
  options: Record<string, string>; // per-option picked values, seeded from defaults
  field: Field;
  list: ModelList;
}

export type Mode = "sections" | "picker" | "form";
export type Focus = "rail" | "content";

export interface SettingsState {
  mode: Mode;
  section: Section;
  focus: Focus;
  saved: ProviderConfig[]; // saved providers, for the content list
  activeId: string | null;
  contentIndex: number; // 0..saved.length; the last row is "add a provider"
  choices: ProviderChoice[]; // available spokes, for the picker
  pickerIndex: number;
  form: FormState | null;
}

export type Intent =
  | { kind: "close" }
  | { kind: "save"; config: ProviderConfig }
  | { kind: "setActive"; id: string }
  | { kind: "remove"; id: string };

export interface Step {
  state: SettingsState;
  intent?: Intent;
}

/** A keypress reduced to what the model cares about: a name, and the printable char if any. */
export interface KeyInput {
  name: string;
  char?: string;
}

export function initialState(
  choices: ProviderChoice[],
  saved: ProviderConfig[],
  activeId: string | null,
): SettingsState {
  return {
    mode: "sections",
    section: "providers",
    focus: saved.length > 0 ? "content" : "rail",
    saved,
    activeId,
    contentIndex: 0,
    choices,
    pickerIndex: 0,
    form: null,
  };
}

/** The fields a form shows, in order, given the chosen provider. */
export function formFields(choice: ProviderChoice): Field[] {
  const fields: Field[] = [];
  if (!choice.keyless) fields.push("key");
  if (choice.needsBaseURL) fields.push("baseURL");
  for (const option of choice.options) fields.push(`opt:${option.key}`);
  fields.push("model");
  return fields;
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

const startForm = (choice: ProviderChoice): FormState => ({
  choice,
  key: "",
  baseURL: "",
  model: choice.defaultModel,
  options: Object.fromEntries(choice.options.map((o) => [o.key, o.defaultValue])),
  field: formFields(choice)[0] ?? "model",
  list: { state: "idle", models: [], index: 0 },
});

/** The fetched models the typed text currently matches (case-insensitive substring). Text that
 * exactly equals a model id is a selection, not a search: the full list stays browsable (RC's
 * behavior, so a prefilled default never collapses the list to one row). */
export function filteredModels(form: FormState): ModelInfo[] {
  const needle = form.model.trim().toLowerCase();
  if (!needle) return form.list.models;
  if (form.list.models.some((info) => info.id.toLowerCase() === needle)) return form.list.models;
  return form.list.models.filter(
    (info) => info.id.toLowerCase().includes(needle) || (info.label ?? "").toLowerCase().includes(needle),
  );
}

/** RC's gate for firing a model fetch: enough of a key (8+ chars unless keyless), and a base URL
 * when the provider needs one. */
export function canFetchModels(form: FormState): boolean {
  if (!form.choice.keyless && form.key.trim().length < 8) return false;
  if (form.choice.needsBaseURL && form.baseURL.trim().length === 0) return false;
  return true;
}

/** What the key, base URL, and options currently are, as one string: the shell refetches models
 * only when this changes (typing a model name must not refire the fetch). */
export const formSignature = (form: FormState): string =>
  `${form.choice.id}|${form.key}|${form.baseURL.trim()}|${JSON.stringify(form.options)}`;

/** A config good enough to query the provider's model list with (the model itself may be unset). */
export const draftConfig = (form: FormState): ProviderConfig => ({
  kind: form.choice.id,
  model: form.model.trim() || form.choice.defaultModel || "draft",
  ...(form.choice.keyless ? {} : { apiKey: form.key }),
  ...(form.choice.needsBaseURL ? { baseURL: form.baseURL.trim() } : {}),
  ...(Object.keys(form.options).length ? { options: { ...form.options } } : {}),
});

const firstInvalidField = (form: FormState): Field | null => {
  for (const field of formFields(form.choice)) {
    if (field === "model" && form.model.trim().length === 0) return "model";
    if (field === "key" && form.key.trim().length === 0) return "key";
    if (field === "baseURL" && form.baseURL.trim().length === 0) return "baseURL";
  }
  return null;
};

const toConfig = (form: FormState): ProviderConfig => ({
  kind: form.choice.id,
  model: form.model.trim(),
  name: form.choice.label,
  ...(form.choice.keyless ? {} : { apiKey: form.key }),
  ...(form.choice.needsBaseURL ? { baseURL: form.baseURL.trim() } : {}),
  ...(Object.keys(form.options).length ? { options: { ...form.options } } : {}),
});

/** Reduce a keypress to the next state, plus an optional intent for the shell to run. Total: it
 * always returns a state, never throws, and returns the same state for keys it does not handle. */
export function reduce(state: SettingsState, key: KeyInput): Step {
  if (state.mode === "form" && state.form) return reduceForm(state, state.form, key);
  if (state.mode === "picker") return reducePicker(state, key);
  return reduceSections(state, key);
}

function reduceSections(state: SettingsState, key: KeyInput): Step {
  const rows = state.saved.length + 1; // saved providers + "add" row
  switch (key.name) {
    case "escape":
    case "q":
      return { state, intent: { kind: "close" } };
    case "1":
    case "left":
      return { state: { ...state, focus: "rail" } };
    case "2":
    case "right":
      return { state: { ...state, focus: "content" } };
    case "tab":
      return { state: { ...state, focus: state.focus === "rail" ? "content" : "rail" } };
    case "up":
      return state.focus === "rail"
        ? { state: { ...state, section: SECTIONS[stepSection(state.section, -1)]! } }
        : { state: { ...state, contentIndex: clamp(state.contentIndex - 1, 0, rows - 1) } };
    case "down":
      return state.focus === "rail"
        ? { state: { ...state, section: SECTIONS[stepSection(state.section, 1)]! } }
        : { state: { ...state, contentIndex: clamp(state.contentIndex + 1, 0, rows - 1) } };
    case "return":
      return activateSections(state, rows);
    case "d": // make the highlighted saved provider the default (what enter also does)
      return savedRowIntent(state, (id) => ({ kind: "setActive", id }));
    case "x": // remove the highlighted saved provider
      return savedRowIntent(state, (id) => ({ kind: "remove", id }));
    default:
      return { state };
  }
}

const savedRowIntent = (state: SettingsState, make: (id: string) => Intent): Step => {
  if (state.focus !== "content" || state.section !== "providers") return { state };
  const provider = state.saved[state.contentIndex];
  if (!provider?.id) return { state };
  return { state, intent: make(provider.id) };
};

function activateSections(state: SettingsState, rows: number): Step {
  if (state.focus === "rail") return { state: { ...state, focus: "content" } };
  if (state.section !== "providers") return { state };
  const isAddRow = state.contentIndex === rows - 1;
  if (isAddRow) {
    return { state: { ...state, mode: "picker", pickerIndex: 0 } };
  }
  const provider = state.saved[state.contentIndex];
  if (!provider?.id) return { state };
  return { state, intent: { kind: "setActive", id: provider.id } };
}

function reducePicker(state: SettingsState, key: KeyInput): Step {
  const last = state.choices.length - 1;
  switch (key.name) {
    case "escape":
      return { state: { ...state, mode: "sections" } };
    case "up":
      return { state: { ...state, pickerIndex: clamp(state.pickerIndex - 1, 0, last) } };
    case "down":
      return { state: { ...state, pickerIndex: clamp(state.pickerIndex + 1, 0, last) } };
    case "return": {
      const choice = state.choices[state.pickerIndex];
      if (!choice) return { state };
      return { state: { ...state, mode: "form", form: startForm(choice) } };
    }
    default:
      return { state };
  }
}

function reduceForm(state: SettingsState, form: FormState, key: KeyInput): Step {
  const fields = formFields(form.choice);
  const pos = fields.indexOf(form.field);
  // On the model field with a live list showing, up/down/enter drive the list, not the fields.
  const picking = form.field === "model" && form.list.state === "ready" && filteredModels(form).length > 0;
  switch (key.name) {
    case "escape":
      return { state: { ...state, mode: "picker", form: null } };
    case "tab":
      return { state: { ...state, form: { ...form, field: fields[(pos + 1) % fields.length]! } } };
    case "down":
      return picking
        ? { state: { ...state, form: moveList(form, 1) } }
        : { state: { ...state, form: { ...form, field: fields[(pos + 1) % fields.length]! } } };
    case "up":
      return picking
        ? { state: { ...state, form: moveList(form, -1) } }
        : { state: { ...state, form: { ...form, field: fields[(pos - 1 + fields.length) % fields.length]! } } };
    case "left":
      return { state: { ...state, form: cycleOption(form, -1) } };
    case "right":
      return { state: { ...state, form: cycleOption(form, 1) } };
    case "backspace":
      if (optionOf(form.choice, form.field)) return { state };
      return { state: { ...state, form: resetListIndex(editField(form, form.field, (v) => v.slice(0, -1))) } };
    case "return": {
      const chosen = picking ? filteredModels(form)[form.list.index] : undefined;
      return submitForm(state, chosen ? { ...form, model: chosen.id } : form);
    }
    default:
      if (key.char) {
        if (optionOf(form.choice, form.field)) {
          // space cycles a choice row; other typing has no meaning there
          return key.char === " " ? { state: { ...state, form: cycleOption(form, 1) } } : { state };
        }
        return { state: { ...state, form: resetListIndex(editField(form, form.field, (v) => v + key.char)) } };
      }
      return { state };
  }
}

/** Step an option field's value through its declared choices. No-op on text fields. */
const cycleOption = (form: FormState, delta: number): FormState => {
  const option = optionOf(form.choice, form.field);
  if (!option) return form;
  const values = option.choices.map((c) => c.value);
  const at = Math.max(0, values.indexOf(form.options[option.key] ?? option.defaultValue));
  const next = values[(at + delta + values.length) % values.length]!;
  return { ...form, options: { ...form.options, [option.key]: next } };
};

const moveList = (form: FormState, delta: number): FormState => {
  const last = filteredModels(form).length - 1;
  return { ...form, list: { ...form.list, index: clamp(form.list.index + delta, 0, last) } };
};

/** Editing the filter text re-anchors the highlight to the top match. */
const resetListIndex = (form: FormState): FormState =>
  form.field === "model" ? { ...form, list: { ...form.list, index: 0 } } : form;

function submitForm(state: SettingsState, form: FormState): Step {
  const missing = firstInvalidField(form);
  if (missing) return { state: { ...state, form: { ...form, field: missing } } };
  return { state, intent: { kind: "save", config: toConfig(form) } };
}

const editField = (form: FormState, field: Field, edit: (value: string) => string): FormState => {
  if (field === "key") return { ...form, key: edit(form.key) };
  if (field === "baseURL") return { ...form, baseURL: edit(form.baseURL) };
  return { ...form, model: edit(form.model) };
};

const stepSection = (section: Section, delta: number): number =>
  clamp(SECTIONS.indexOf(section) + delta, 0, SECTIONS.length - 1);

/** Paste lands in the focused form field (how API keys actually get entered). No-op elsewhere. */
export function applyPaste(state: SettingsState, text: string): SettingsState {
  if (state.mode !== "form" || !state.form) return state;
  const clean = text.replace(/[\r\n]+/g, "").trim();
  if (!clean) return state;
  return { ...state, form: editField(state.form, state.form.field, (v) => v + clean) };
}
