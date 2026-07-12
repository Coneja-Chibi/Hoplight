/**
 * PersonaEditor mount point - re-exports the real editor (persona/persona-editor.tsx, the RC
 * PersonaPanel port per design/vs-persona-editor.html). The P1 stub lived here until P4.
 */
import type { JSX } from "react";
import { PersonaEditorView, type PersonaEditorViewProps } from "./persona/persona-editor";

export type PersonaEditorProps = PersonaEditorViewProps;

export function PersonaEditor(props: PersonaEditorProps): JSX.Element {
  return <PersonaEditorView {...props} />;
}
