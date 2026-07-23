/** @jsxImportSource @opentui/react */
/**
 * Provider form: the small set of fields for the chosen provider. The API key renders as dots (it is
 * never shown or logged); the focused field is rose-outlined with a caret. The fields shown depend on
 * the provider (a key unless it is keyless, a base URL only for custom / local endpoints, the model).
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { formFields, type Field, type FormState } from "./model";

const LABELS: Record<Field, string> = { key: "API key", baseURL: "Base URL", model: "Model" };

const shownValue = (form: FormState, field: Field): string => {
  if (field === "key") return form.key.length ? "•".repeat(form.key.length) : "";
  if (field === "baseURL") return form.baseURL;
  return form.model;
};

export function Form({ form }: { form: FormState }): ReactNode {
  const fields = formFields(form.choice);
  return (
    <box flexDirection="column">
      <text fg={theme.mut}>
        <span fg={theme.text}>{form.choice.label}</span> · paste your key, enter to save
      </text>
      <box flexDirection="column" paddingTop={1}>
        {fields.map((field) => {
          const active = field === form.field;
          const value = shownValue(form, field);
          return (
            <box key={field} flexDirection="column" paddingBottom={1}>
              <text fg={active ? theme.rose : theme.mut}>{LABELS[field]}</text>
              <box
                border
                borderColor={active ? theme.rose : theme.line}
                backgroundColor={theme.sunken}
                paddingLeft={1}
                paddingRight={1}
              >
                <text fg={theme.text}>
                  {value}
                  {active ? <span fg={theme.rose}>{"▏"}</span> : null}
                </text>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
