/**
 * PresetEditor mount point - re-exports the real editor (preset/preset-editor.tsx, the hybrid wire
 * per design/vs-preset-hybrid.html). The P1 stub lived here until P4 slice 1 (the manuscript spine).
 */
import type { JSX } from "react";
import { PresetEditorView, type PresetEditorViewProps } from "./preset/preset-editor";

export type PresetEditorProps = PresetEditorViewProps;

export function PresetEditor(props: PresetEditorProps): JSX.Element {
  return <PresetEditorView {...props} />;
}
