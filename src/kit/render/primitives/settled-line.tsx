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

export function SettledLine({
  line,
  index,
  pieces,
  onCopy,
  onToggle,
}: {
  line: RenderLine;
  index: number;
  pieces: readonly EntitySummary[];
  onCopy: (text: string) => void;
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
