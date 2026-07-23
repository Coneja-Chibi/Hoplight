/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the session state and composes the
 * render/primitives widgets. Typing runs a turn through the session; its events (say / tool / stopped
 * / error) stream in as the matching widget. No chrome is drawn inline; the look lives in primitives/.
 */
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DeckCount } from "../bridge";
import type { ModelMessage } from "../providers/provider";
import type { Session } from "../session";
import { theme } from "./theme";
import { Masthead } from "./primitives/masthead";
import { SessionStrip } from "./primitives/session-strip";
import { Scrollback } from "./primitives/scrollback";
import { YouLine } from "./primitives/you-line";
import { SayLine } from "./primitives/say-line";
import { ToolRow } from "./primitives/tool-row";
import { ErrorRow } from "./primitives/error-row";
import { InputBar } from "./primitives/input-bar";
import { SettingsScreen } from "./settings/settings-screen";

export interface AppProps {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  session: Session;
  onQuit: () => void;
}

type RenderLine =
  | { role: "you"; text: string }
  | { role: "say"; text: string }
  | { role: "tool"; text: string }
  | { role: "error"; text: string };

const WELCOME: RenderLine[] = [
  { role: "say", text: "Talk to your studio. Nothing leaves your machine until you send." },
  { role: "say", text: "Scripts stay sealed as text and never run." },
];

const isQuit = (value: string): boolean => value === "/quit" || value === "/q";

/** The window shell: session state plus composed widgets. */
export function App({ studioName, totalPieces, decks, session, onQuit }: AppProps): ReactNode {
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<RenderLine[]>(WELCOME);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"session" | "settings">(
    process.env.KIT_SMOKE_VIEW === "settings" ? "settings" : "session",
  );
  const history = useRef<ModelMessage[]>([]);
  const add = (line: RenderLine): void => setLines((prev) => [...prev, line]);

  const submit = async (raw: string): Promise<void> => {
    const value = raw.trim();
    setDraft("");
    if (!value) return;
    if (value === "/model" || value === "/providers") {
      setView("settings");
      return;
    }
    if (busy) return;
    if (isQuit(value)) {
      onQuit();
      return;
    }
    add({ role: "you", text: value });
    setBusy(true);
    history.current = await session.runTurn(value, history.current, (event) => {
      if (event.type === "say") add({ role: "say", text: event.text });
      else if (event.type === "tool") add({ role: "tool", text: event.summary });
      else if (event.type === "stopped") add({ role: "say", text: event.reason });
      else if (event.type === "error") add({ role: "error", text: event.message });
    });
    setBusy(false);
  };

  if (view === "settings") {
    return (
      <SettingsScreen
        studioName={studioName}
        onClose={() => setView("session")}
        onSaved={(config) => {
          setView("session");
          add({ role: "say", text: `Connected ${config.name ?? config.kind}. Talk to your studio.` });
        }}
      />
    );
  }

  return (
    <box flexDirection="column" backgroundColor={theme.well} width="100%" height="100%">
      <Masthead studioName={studioName} totalPieces={totalPieces} />
      <SessionStrip decks={decks} />
      <Scrollback>
        {lines.map((line, index) =>
          line.role === "you" ? (
            <YouLine key={index} text={line.text} />
          ) : line.role === "tool" ? (
            <ToolRow key={index} summary={line.text} />
          ) : line.role === "error" ? (
            <ErrorRow key={index} text={line.text} />
          ) : (
            <SayLine key={index} text={line.text} />
          ),
        )}
      </Scrollback>
      <InputBar draft={draft} onInput={setDraft} onSubmit={submit} />
    </box>
  );
}
