/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the local session state and composes the
 * render/primitives widgets, nothing more. No chrome is drawn inline; every visible piece is a widget
 * in primitives/, so the look lives in one place per concept. The agent loop plugs into onSubmit next.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import type { DeckCount } from "../bridge";
import { theme } from "./theme";
import { Masthead } from "./primitives/masthead";
import { SessionStrip } from "./primitives/session-strip";
import { Scrollback } from "./primitives/scrollback";
import { YouLine } from "./primitives/you-line";
import { SayLine } from "./primitives/say-line";
import { InputBar } from "./primitives/input-bar";

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
  { role: "say", text: "Talk to your studio. Nothing leaves your machine until you send." },
  { role: "say", text: "Scripts stay sealed as text and never run." },
];

const isQuit = (value: string): boolean => value === "/quit" || value === "/q";

/** The window shell: session state plus composed widgets. */
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
      <Masthead studioName={studioName} totalPieces={totalPieces} />
      <SessionStrip decks={decks} />
      <Scrollback>
        {lines.map((line, index) =>
          line.role === "you" ? <YouLine key={index} text={line.text} /> : <SayLine key={index} text={line.text} />,
        )}
      </Scrollback>
      <InputBar draft={draft} onInput={setDraft} onSubmit={submit} />
    </box>
  );
}
