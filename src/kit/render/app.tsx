/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the live-session chrome (title bar, session strip, scrollback, input).
 * Transcribed from the locked harness face. This is the imperative shell's view only; it holds
 * no engine logic. For this skeleton the input echoes locally and /quit exits; the agent loop and
 * tool surface plug into onSubmit next. Nothing here reaches a network or a model.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import type { DeckCount } from "../bridge";
import { theme } from "./theme";

export interface AppProps {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  onQuit: () => void;
}

interface Line {
  role: "you" | "say";
  text: string;
}

const WELCOME: Line[] = [
  { role: "say", text: "This is Kit, a terminal way to work your studio by talking to it." },
  { role: "say", text: "Nothing leaves your machine until you send, and scripts stay sealed as text." },
];

const isQuit = (value: string): boolean => value === "/quit" || value === "/q";

/** The window chrome and local session state for a Kit run. */
export function App({ studioName, totalPieces, decks, onQuit }: AppProps): ReactNode {
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<Line[]>(WELCOME);

  const submit = (raw: string): void => {
    const value = raw.trim();
    setDraft("");
    if (!value) return;
    if (isQuit(value)) {
      onQuit();
      return;
    }
    setLines((prev) => [
      ...prev,
      { role: "you", text: value },
      { role: "say", text: "Kit can read your studio, but the agent loop lands next; nothing was sent." },
    ]);
  };

  return (
    <box flexDirection="column" backgroundColor={theme.well} width="100%" height="100%">
      <TitleBar studioName={studioName} totalPieces={totalPieces} />
      <SessionStrip decks={decks} />
      <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} gap={1}>
        {lines.map((line, index) => (
          <ScrollLine key={index} line={line} />
        ))}
      </box>
      <InputBar draft={draft} onInput={setDraft} onSubmit={submit} />
    </box>
  );
}

function TitleBar({ studioName, totalPieces }: { studioName: string; totalPieces: number }): ReactNode {
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.stage}
      border={["bottom"]}
      borderColor={theme.edge}
      paddingLeft={1}
      paddingRight={1}
    >
      <text>
        <span fg={theme.text}>hoplight</span>
        <span fg={theme.rose}>.</span>
        <span fg={theme.text}> kit</span>
      </text>
      <box flexGrow={1} />
      <text fg={theme.soft}>
        studio <span fg={theme.text}>{studioName}</span> {"  "}
        <span fg={theme.text}>{String(totalPieces)}</span> pieces
      </text>
    </box>
  );
}

function SessionStrip({ decks }: { decks: DeckCount[] }): ReactNode {
  const shown = decks.filter((deck) => deck.count > 0);
  const parts = shown.length > 0 ? shown : decks;
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.row}
      border={["bottom"]}
      borderColor={theme.line}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={theme.soft}>
        <span fg={theme.text}>decks </span>
        {parts.map((deck, index) => (
          <span key={deck.kind} fg={theme.soft}>
            {index > 0 ? <span fg={theme.rose}> · </span> : null}
            {deck.label.toLowerCase()} <span fg={theme.text}>{String(deck.count)}</span>
          </span>
        ))}
      </text>
      <box flexGrow={1} />
      <text fg={theme.soft}>
        <span fg={theme.text}>egress </span>only when you send <span fg={theme.rose}>·</span> scripts sealed
      </text>
    </box>
  );
}

function ScrollLine({ line }: { line: Line }): ReactNode {
  if (line.role === "you") {
    return (
      <text>
        <span fg={theme.rose}>{"> "}</span>
        <span fg={theme.text}>{line.text}</span>
      </text>
    );
  }
  return <text fg={theme.soft}>{line.text}</text>;
}

function InputBar({
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
      backgroundColor={theme.stage}
      border={["top"]}
      borderColor={theme.edge}
      paddingLeft={1}
      paddingRight={1}
    >
      <box
        flexDirection="row"
        backgroundColor={theme.well}
        border
        borderColor={theme.line}
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
      <text fg={theme.soft}>
        <span fg={theme.text}>/model </span>provider {"  "}
        <span fg={theme.text}>/gates </span>what asks first {"  "}
        <span fg={theme.text}>/cli </span>classic verbs {"  "}
        <span fg={theme.text}>/quit</span>
      </text>
    </box>
  );
}
