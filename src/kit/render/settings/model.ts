/**
 * Settings navigation model: the pure, testable core of the Panel Deck. It holds where focus is
 * (which section, rail vs content, which row) and drives the add-provider flow (pick a provider,
 * then fill a small form). reduce() maps a keypress to the next state plus an optional intent the
 * shell executes (close, save, set-active); it never touches the vault, the screen, or the clock.
 */
import type { ProviderConfig } from "../../providers/config";

export type Section = "providers" | "gates" | "studio" | "about";
export const SECTIONS: readonly Section[] = ["providers", "gates", "studio", "about"];

export interface ProviderChoice {
  id: string; // spoke id, e.g. "anthropic", "custom"
  label: string;
  brand: string; // hex accent
  defaultModel: string;
  keyless: boolean; // local endpoints need no key
  needsBaseURL: boolean; // custom / local endpoints need a URL
}

export type Field = "key" | "baseURL" | "model";

export interface FormState {
  choice: ProviderChoice;
  key: string;
  baseURL: string;
  model: string;
  field: Field;
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
  | { kind: "setActive"; id: string };

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
  fields.push("model");
  return fields;
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

const startForm = (choice: ProviderChoice): FormState => ({
  choice,
  key: "",
  baseURL: "",
  model: choice.defaultModel,
  field: formFields(choice)[0] ?? "model",
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
    default:
      return { state };
  }
}

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
  switch (key.name) {
    case "escape":
      return { state: { ...state, mode: "picker", form: null } };
    case "tab":
    case "down":
      return { state: { ...state, form: { ...form, field: fields[(pos + 1) % fields.length]! } } };
    case "up":
      return { state: { ...state, form: { ...form, field: fields[(pos - 1 + fields.length) % fields.length]! } } };
    case "backspace":
      return { state: { ...state, form: editField(form, form.field, (v) => v.slice(0, -1)) } };
    case "return":
      return submitForm(state, form);
    default:
      if (key.char) {
        return { state: { ...state, form: editField(form, form.field, (v) => v + key.char) } };
      }
      return { state };
  }
}

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
