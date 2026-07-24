/** @jsxImportSource @opentui/react */
/**
 * Provider form: the fields for the chosen provider, RC-style. The API key renders as dots (never
 * shown or logged); the focused field is rose-outlined with a caret. Provider-declared options
 * (e.g. NanoGPT's plan) render as chip rows, left/right or click to choose. Under the model field
 * lives the live picker: models fetched from the provider, filtered by what you type, a windowed
 * list with context chips and an N-of-M line. Typed text stays the escape hatch when nothing
 * matches. Clicking a model row does what enter would: pick it and save.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { formatContext } from "../../providers/models";
import { filteredModels, formFields, optionOf, type Field, type FormState } from "./model";

const WINDOW = 8;

const labelFor = (form: FormState, field: Field): string => {
  if (field === "key") return "API key";
  if (field === "baseURL") return "Base URL";
  if (field === "model") return "Model";
  return optionOf(form.choice, field)?.label ?? field;
};

const shownValue = (form: FormState, field: Field): string => {
  // Mask the key. The design bible bans the • bullet glyph; use the filled circle for the mask.
  if (field === "key") return form.key.length ? "●".repeat(form.key.length) : "";
  if (field === "baseURL") return form.baseURL;
  return form.model;
};

function ModelRows({ form, onModel }: { form: FormState; onModel: (index: number) => void }): ReactNode {
  if (form.list.state === "loading") {
    return <text fg={theme.mut}>Looking up models from {form.choice.label}...</text>;
  }
  if (form.list.state !== "ready") return null;
  const total = form.list.models.length;
  if (total === 0) {
    return (
      <text fg={theme.soft}>
        <span fg={theme.rose}>{"! "}</span>No models returned. Check the key
        {form.choice.needsBaseURL ? " and base URL" : ""}.
      </text>
    );
  }
  const filtered = filteredModels(form);
  if (filtered.length === 0) {
    return (
      <text fg={theme.mut}>
        no match in {String(total)} models · enter uses what you typed
      </text>
    );
  }
  const start = Math.min(Math.max(form.list.index - 3, 0), Math.max(filtered.length - WINDOW, 0));
  const visible = filtered.slice(start, start + WINDOW);
  return (
    <box flexDirection="column">
      {visible.map((info, offset) => {
        const index = start + offset;
        const selected = index === form.list.index;
        return (
          <box
            key={info.id}
            flexDirection="row"
            backgroundColor={selected ? theme.row : theme.panel}
            paddingRight={1}
            onMouseDown={() => onModel(index)}
          >
            <text fg={theme.rose}>{selected ? "▌ " : "  "}</text>
            <text fg={selected ? theme.text : theme.soft}>{info.id}</text>
            <box flexGrow={1} />
            <text fg={theme.mut}>{formatContext(info.context)}</text>
          </box>
        );
      })}
      <text fg={theme.mut}>
        {String(filtered.length)} of {String(total)} models · up/down pick · enter save
      </text>
    </box>
  );
}

function OptionChips({
  form,
  field,
  active,
  onOption,
}: {
  form: FormState;
  field: Field;
  active: boolean;
  onOption: (key: string, value: string) => void;
}): ReactNode {
  const option = optionOf(form.choice, field);
  if (!option) return null;
  const picked = form.options[option.key] ?? option.defaultValue;
  return (
    <box flexDirection="row">
      {option.choices.map((choice) => (
        <box key={choice.value} flexDirection="row">
          <box
            border
            borderColor={picked === choice.value ? (active ? theme.rose : theme.soft) : theme.line}
            backgroundColor={picked === choice.value ? theme.row : theme.sunken}
            paddingLeft={1}
            paddingRight={1}
            onMouseDown={() => onOption(option.key, choice.value)}
          >
            <text fg={picked === choice.value ? theme.text : theme.soft}>{choice.label}</text>
          </box>
          <box width={1} />
        </box>
      ))}
      {active ? (
        <box paddingTop={1}>
          <text fg={theme.mut}>left/right choose</text>
        </box>
      ) : null}
    </box>
  );
}

export function Form({
  form,
  onModel,
  onOption,
}: {
  form: FormState;
  onModel: (index: number) => void;
  onOption: (key: string, value: string) => void;
}): ReactNode {
  const fields = formFields(form.choice);
  return (
    <box flexDirection="column" paddingLeft={2} paddingRight={2}>
      <text fg={theme.mut}>
        <span fg={theme.text}>{form.choice.label}</span> · paste your key, enter to save
      </text>
      <box flexDirection="column" paddingTop={1}>
        {fields.map((field) => {
          const active = field === form.field;
          const isOption = optionOf(form.choice, field) !== undefined;
          return (
            <box key={field} flexDirection="column" paddingBottom={1}>
              <text fg={active ? theme.rose : theme.mut}>{labelFor(form, field)}</text>
              {isOption ? (
                <OptionChips form={form} field={field} active={active} onOption={onOption} />
              ) : (
                <box
                  border
                  borderColor={active ? theme.rose : theme.line}
                  backgroundColor={theme.sunken}
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <text fg={theme.text}>
                    {shownValue(form, field)}
                    {active ? <span fg={theme.rose}>{"▏"}</span> : null}
                  </text>
                </box>
              )}
              {field === "model" && active ? <ModelRows form={form} onModel={onModel} /> : null}
            </box>
          );
        })}
      </box>
    </box>
  );
}
