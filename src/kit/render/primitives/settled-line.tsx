/** @jsxImportSource @opentui/react */
/** SettledLine: the replay-safe renderer for one durable transcript line. */
import { Fragment } from "react";
import type { ReactNode } from "react";
import type { EntitySummary } from "../../bridge";
import type { RenderLine } from "../turn-events";
import { BackstageRow } from "./backstage-row";
import { DoctorCard } from "./doctor-card";
import { ErrorRow } from "./error-row";
import { SayLine } from "./say-line";
import { saysOpen } from "../say-fold";
import { ThoughtRow } from "./thought-row";
import { ToolRow } from "./tool-row";
import { YouLine } from "./you-line";
import { WatchNote } from "./watch-note";
import { PastedImage } from "./pasted-image";
import { PortraitBlock } from "./portrait-block";
import { useTerminalDimensions } from "@opentui/react";
import { ChoiceList } from "./choice-list";
import type { AskState } from "../ask/ask-core";

export function SettledLine({
  line,
  index,
  lines,
  pieces,
  onCopy,
  ask,
  onToggle,
}: {
  line: RenderLine;
  index: number;
  /** Every settled line, so the newest reply can be shown open. See say-fold.ts. */
  lines: readonly RenderLine[];
  pieces: readonly EntitySummary[];
  onCopy: (text: string) => void;
  /** Fill the composer with a picked option. Never sends - the person still owns the message. */
  /**
   * The live question's cursor and fields, when THIS line is the live one.
   *
   * Absent on every other choices line, which is what stops a number key reaching back into a
   * question further up the transcript that has already been answered or abandoned.
   */
  ask?: {
    state: AskState;
    writing: boolean;
    select: (index: number, kind: "option" | "own" | "chat") => void;
    editNote: () => void;
  };
  onToggle: () => void;
}): ReactNode {
  const term = useTerminalDimensions();
  if (line.role === "you") {
    return (
      <Fragment>
        {index > 0 ? <box height={1} /> : null}
        <YouLine text={line.text} onCopy={() => onCopy(line.text)} />
      </Fragment>
    );
  }
  if (line.role === "tool") return <ToolRow summary={line.text} />;
  if (line.role === "error") {
    return <ErrorRow text={line.text} onCopy={() => onCopy(line.text)} />;
  }
  if (line.role === "choices") {
    return (
      <ChoiceList
        question={line.question}
        options={line.options}
        answered={line.answered ?? null}
        {...(ask ? { state: ask.state, writing: ask.writing, onSelect: ask.select, onEditNote: ask.editNote } : {})}
      />
    );
  }
  if (line.role === "image") {
    return <PastedImage bytes={line.bytes} width={line.width} height={line.height} note={line.note} />;
  }
  if (line.role === "portrait") {
    // Card art is 2:3, so height bounds it. Sized from the terminal rather than fixed: a 24x16 box
    // resamples a 1024px card into 32 vertical pixels, which is what made the first one look like a
    // mosaic. A third of the screen is big enough to recognise a face and small enough that three in
    // a row do not bury the conversation.
    const rows = Math.max(10, Math.min(28, Math.floor(term.height * 0.34)));
    return (
      <PortraitBlock
        source={line.bytes}
        width={Math.max(8, Math.round(rows * 2 * 2 / 3))}
        height={rows}
        caption={line.caption}
        {...(line.accent ? { accent: line.accent } : {})}
      />
    );
  }
  if (line.role === "watch") return <WatchNote text={line.text} {...(line.path ? { path: line.path } : {})} onCopy={onCopy} />;
  if (line.role === "thought") {
    return (
      <ThoughtRow
        text={line.text}
        seconds={line.seconds}
        open={line.open}
        onToggle={onToggle}
      />
    );
  }
  if (line.role === "backstage") {
    return (
      <BackstageRow
        moves={line.moves}
        seconds={line.seconds}
        phase={line.phase}
        open={line.open}
        onToggle={onToggle}
      />
    );
  }
  if (line.role === "doctor") return <DoctorCard checks={line.checks} />;
  return (
    <SayLine
      text={line.text}
      // NOT line.open: undefined means nobody has toggled it, and the NEWEST reply is the one being
      // read rather than scrollback. A long answer used to fold itself the instant it settled.
      open={saysOpen(lines, index, line)}
      onToggle={onToggle}
      onCopy={() => onCopy(line.text)}
      pieces={pieces}
    />
  );
}
