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
import { ThoughtRow } from "./thought-row";
import { ToolRow } from "./tool-row";
import { YouLine } from "./you-line";
import { WatchNote } from "./watch-note";
import { PastedImage } from "./pasted-image";
import { ChoiceList } from "./choice-list";

export function SettledLine({
  line,
  index,
  pieces,
  onCopy,
  onPick,
  onToggle,
}: {
  line: RenderLine;
  index: number;
  pieces: readonly EntitySummary[];
  onCopy: (text: string) => void;
  /** Fill the composer with a picked option. Never sends - the person still owns the message. */
  onPick?: (value: string) => void;
  onToggle: () => void;
}): ReactNode {
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
    return <ChoiceList question={line.question} options={line.options} onPick={onPick} />;
  }
  if (line.role === "image") {
    return <PastedImage bytes={line.bytes} width={line.width} height={line.height} note={line.note} />;
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
      open={line.open}
      onToggle={onToggle}
      onCopy={() => onCopy(line.text)}
      pieces={pieces}
    />
  );
}
