/** @jsxImportSource @opentui/react */
/**
 * Kit's render root: the imperative shell. It holds the session state and composes the
 * render/primitives widgets. Typing runs a turn through the session; its events (say / tool / stopped
 * / error) stream in as the matching widget. No chrome is drawn inline; the look lives in primitives/.
 */
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import type { DeckCount } from "../bridge";
import type { ModelMessage } from "../providers/provider";
import type { Session } from "../session";
import { theme } from "./theme";
import { OpeningBanner } from "./primitives/opening-banner";
import { SessionStrip } from "./primitives/session-strip";
import { Scrollback } from "./primitives/scrollback";
import { YouLine } from "./primitives/you-line";
import { SayLine } from "./primitives/say-line";
import { ToolRow } from "./primitives/tool-row";
import { ErrorRow } from "./primitives/error-row";
import { InputBar } from "./primitives/input-bar";
import { StatusRow } from "./primitives/status-row";
import { ThoughtBox } from "./primitives/thought-box";
import { ThoughtRow } from "./primitives/thought-row";
import { BackstageBox } from "./primitives/backstage-box";
import { BackstageRow } from "./primitives/backstage-row";
import { SettingsScreen } from "./settings/settings-screen";
import { applyTurnEvent, settleTurn, toggleTrace, type RenderLine, type TurnView } from "./turn-events";

export interface AppProps {
  studioName: string;
  totalPieces: number;
  decks: DeckCount[];
  session: Session;
  onQuit: () => void;
}

const isQuit = (value: string): boolean => value === "/quit" || value === "/q";

/** The window shell: session state plus composed widgets. */
export function App({ studioName, totalPieces, decks, session, onQuit }: AppProps): ReactNode {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState<TurnView>({
    lines: [],
    live: { phase: "idle" },
    label: "",
    tools: null,
    toolsSeen: false,
  });
  const [startedAt, setStartedAt] = useState(0);
  const [view, setView] = useState<"session" | "settings">(
    process.env.KIT_SMOKE_VIEW === "settings" ? "settings" : "session",
  );
  const history = useRef<ModelMessage[]>([]);
  const add = (line: RenderLine): void =>
    setTurn((prev) => ({ ...prev, lines: [...prev.lines, line] }));

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
    setStartedAt(Date.now());
    setTurn((prev) => ({ ...prev, live: { phase: "waiting" } }));
    const onEvent = (event: Parameters<typeof applyTurnEvent>[1]): void =>
      setTurn((prev) => applyTurnEvent(prev, event, Date.now()));
    if (value === "/test") await session.probe(onEvent);
    else history.current = await session.runTurn(value, history.current, onEvent);
    setTurn((prev) => settleTurn(prev, Date.now()));
    setBusy(false);
  };

  useKeyboard((event: KeyEvent) => {
    // ctrl+o toggles the latest foldable trace, thought or backstage (plain o would hit the composer)
    if (view === "session" && event.ctrl && event.name === "o") {
      setTurn((prev) => toggleTrace(prev));
    }
  });

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
      <SessionStrip decks={decks} />
      <Scrollback>
        <OpeningBanner studioName={studioName} totalPieces={totalPieces} animate={turn.lines.length === 0} />
        {turn.lines.map((line, index) =>
          line.role === "you" ? (
            <YouLine key={index} text={line.text} />
          ) : line.role === "tool" ? (
            <ToolRow key={index} summary={line.text} />
          ) : line.role === "error" ? (
            <ErrorRow key={index} text={line.text} />
          ) : line.role === "thought" ? (
            <ThoughtRow
              key={index}
              text={line.text}
              seconds={line.seconds}
              open={line.open}
              onToggle={() => setTurn((prev) => toggleTrace(prev, index))}
            />
          ) : line.role === "backstage" ? (
            <BackstageRow
              key={index}
              moves={line.moves}
              seconds={line.seconds}
              open={line.open}
              onToggle={() => setTurn((prev) => toggleTrace(prev, index))}
            />
          ) : (
            <SayLine key={index} text={line.text} />
          ),
        )}
        {turn.tools ? <BackstageBox moves={turn.tools.moves} /> : null}
        {turn.live.phase === "typing" ? <SayLine text={turn.live.text} streaming /> : null}
        {turn.live.phase === "thinking" ? (
          <ThoughtBox text={turn.live.text} startedAt={startedAt} />
        ) : null}
        {turn.live.phase === "waiting" && !turn.toolsSeen && !turn.tools ? (
          <StatusRow startedAt={startedAt} />
        ) : null}
      </Scrollback>
      <InputBar
        draft={draft}
        active={turn.live.phase === "waiting" || turn.live.phase === "thinking" || turn.tools != null}
        onInput={setDraft}
        onSubmit={submit}
      />
    </box>
  );
}
