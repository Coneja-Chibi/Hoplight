/** @jsxImportSource @opentui/react */
/**
 * Kit's render root in the LOCKED look (DECISIONS #23, wireframes/vs-kit-look.html): the Default
 * session screen. Marquee crossed with Hard Stamp, translated to terminal-honest primitives: a big
 * block-letter masthead (the mockup's display font), a rose-deep bottom rule where the browser had an
 * offset shadow, solid stage fills where it had a gradient, hard edges, and a rose-outlined input.
 * This is the imperative shell's view only; the agent loop and tools plug into onSubmit next.
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
  { role: "say", text: "Talk to your studio. Nothing leaves your machine until you send." },
  { role: "say", text: "Scripts stay sealed as text and never run." },
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
      <Masthead studioName={studioName} totalPieces={totalPieces} />
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

function Masthead({ studioName, totalPieces }: { studioName: string; totalPieces: number }): ReactNode {
  const kicker = `studio · ${studioName} · ${totalPieces} pieces`.toUpperCase();
  return (
    <box
      flexDirection="column"
      backgroundColor={theme.panel}
      border={["bottom"]}
      borderColor={theme.roseDeep}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row">
        <ascii-font text="Kit" font="block" color={theme.text} />
        <ascii-font text="." font="block" color={theme.rose} />
      </box>
      <text fg={theme.mut}>{kicker}</text>
    </box>
  );
}

function SessionStrip({ decks }: { decks: DeckCount[] }): ReactNode {
  const shown = decks.filter((deck) => deck.count > 0);
  const parts = shown.length > 0 ? shown : decks;
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.floor}
      border={["bottom"]}
      borderColor={theme.edge}
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
      backgroundColor={theme.floor}
      border={["top"]}
      borderColor={theme.edge}
      paddingLeft={1}
      paddingRight={1}
    >
      <box
        flexDirection="row"
        backgroundColor="#0a0a0b"
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
      <text fg={theme.mut}>
        <span fg={theme.text}>/model </span>provider {"  "}
        <span fg={theme.text}>/gates </span>what asks first {"  "}
        <span fg={theme.text}>/cli </span>classic verbs {"  "}
        <span fg={theme.text}>/quit</span>
      </text>
    </box>
  );
}
