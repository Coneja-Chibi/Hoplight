/** @jsxImportSource @opentui/react */
/**
 * InputBar: the rose-outlined, sunken input box and the command hints beneath it (the locked look).
 * Owns no state; the shell passes the draft and the handlers.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";
import { KeyHint, type Hint } from "./key-hint";

const HINTS: ReadonlyArray<Hint> = [
  { key: "/model", label: "provider" },
  { key: "/gates", label: "what asks first" },
  { key: "/cli", label: "classic verbs" },
  { key: "/quit" },
];

export function InputBar({
  draft,
  onInput,
  onSubmit,
}: {
  draft: string;
  onInput: (value: string) => void;
  onSubmit: (value: string) => void;
}): ReactNode {
  return (
    <box
      flexDirection="column"
      backgroundColor={theme.floor}
      border={["top"]}
      borderColor={theme.edge}
      paddingLeft={1}
      paddingRight={1}
    >
      <box
        flexDirection="row"
        backgroundColor={theme.sunken}
        border
        borderColor={theme.rose}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.rose}>{"> "}</text>
        <input
          focused
          flexGrow={1}
          value={draft}
          placeholder="talk to your studio"
          onInput={onInput}
          onSubmit={(value: unknown) => onSubmit(typeof value === "string" ? value : "")}
        />
      </box>
      <KeyHint hints={HINTS} />
    </box>
  );
}
