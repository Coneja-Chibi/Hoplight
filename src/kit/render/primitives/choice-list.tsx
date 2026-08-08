/** @jsxImportSource @opentui/react */
/**
 * A question with options, as a panel you answer.
 *
 * IT SENDS. Answering hands the model your answer and the conversation carries on, which is what a
 * question is for. The version this replaces filled the composer and stopped, so every answer needed
 * a second gesture nobody was told about until a grey footer explained it after the fact.
 *
 * WHAT MAKES SENDING SAFE IS THE TWO STEPS. Clicking or pressing a number SELECTS; enter sends. A
 * mis-click can no longer speak for you, which is the protection the fill-the-composer rule was
 * buying invisibly and charging for in confusion.
 *
 * A CURSOR SITS ON IT FROM THE START. Nothing was lit until a mouse crossed it, and hover is not
 * discoverable in a terminal - you do not go fishing with a pointer to learn whether text is alive.
 *
 * THE REASON GOES UNDER ITS OPTION. It used to be pushed to the right margin by a flex spacer, so at
 * a real width the option and its explanation sat sixty columns apart, once per option.
 *
 * DRAWN, NOT DRIVEN. Every bit of state arrives as a prop: the composer owns the keyboard, so a
 * panel holding its own cursor could not be moved by the keys that are meant to move it. See
 * use-ask.ts for the owner.
 */
import type { ReactNode } from "react";
import { MouseButton } from "@opentui/core";
import type { MouseEvent } from "@opentui/core";
import { theme } from "../theme";
import { armedAnswer, numberedRows, type AskOption, type AskState } from "../ask/ask-core";

export function ChoiceList({
  question,
  options,
  state,
  writing,
  answered,
  onSelect,
  onEditNote,
}: {
  question: string;
  options: readonly AskOption[];
  /** Cursor, typed answer and note. Null when this panel is not the live one. */
  state?: AskState | null;
  /** Is the write-your-own field open? */
  writing?: boolean;
  /** What was sent, once. An answered panel keeps its place but stops taking input. */
  answered?: string | null;
  /** A row was clicked: select it. Never sends - that is what enter is for. */
  onSelect?: (index: number, kind: "option" | "own" | "chat") => void;
  /** The note was clicked: put the cursor in it. */
  onEditNote?: () => void;
}): ReactNode {
  if (answered) {
    /**
     * ANSWERED PANELS COLLAPSE to what was said. Leaving live options in the scrollback invites
     * answering the same question twice, and the model has already moved on.
     */
    return (
      <box flexDirection="column" paddingTop={1}>
        <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
          <box width={1} backgroundColor={theme.tealDeep} />
          <text fg={theme.quiet}>{` ${question}`}</text>
        </box>
        <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
          <box width={1} backgroundColor={theme.teal} />
          <text fg={theme.soft}>{` ✓ ${answered.replace(/\n+/g, " · ")}`}</text>
        </box>
      </box>
    );
  }

  const live = state ?? { options, cursor: 0, own: "", note: "" };
  const armed = armedAnswer(live);
  const rows = numberedRows(options);
  let pickIndex = -1;

  return (
    <box flexDirection="column" paddingTop={1}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingRight={1}>
        <box width={1} backgroundColor={theme.teal} />
        <text fg={theme.quiet}>{" PICK ONE"}</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{`${options.length} options`}</text>
      </box>
      <box flexDirection="row" backgroundColor={theme.recess} paddingRight={1}>
        <box width={1} backgroundColor={theme.teal} />
        <text fg={theme.text}>{` ${question}`}</text>
      </box>

      {rows.map((entry, at) => {
        if (entry.row.kind === "rule") {
          // The rule separates answering the question from getting out of it.
          return (
            <box key={`rule-${String(at)}`} flexDirection="row" backgroundColor={theme.recess}>
              <box width={1} backgroundColor={theme.tealDeep} />
              <text fg={theme.div}>{"  ────"}</text>
            </box>
          );
        }
        pickIndex += 1;
        const mine = pickIndex;
        const on = live.cursor === mine;
        const kind = entry.row.kind;
        const label = kind === "option"
          ? entry.row.value
          : kind === "own" ? "Write your own answer" : "Chat about this instead";
        return (
          <box key={`row-${String(at)}`} flexDirection="column">
            <box
              flexDirection="row"
              backgroundColor={on ? theme.lift : theme.recess}
              paddingRight={1}
              /**
               * CLICK SELECTS, IT DOES NOT SEND. The two visible steps are what make sending
               * straight to the model safe: a click that sent would put words in somebody's mouth
               * on a mis-aim, which is what the old fill-the-composer rule existed to prevent.
               */
              onMouseDown={(event: MouseEvent) => {
                if (event.button !== MouseButton.LEFT) return;
                event.preventDefault();
                onSelect?.(mine, kind);
              }}
            >
              <box width={1} backgroundColor={on ? theme.teal : theme.tealDeep} />
              <text fg={theme.teal}>{on ? " ❯ " : "   "}</text>
              <text fg={on ? theme.teal : theme.mut}>{`${String(entry.number)}. `}</text>
              <text fg={on ? theme.text : kind === "option" ? theme.soft : theme.quiet}>{label}</text>
            </box>
            {kind === "option" && entry.row.note ? (
              <box flexDirection="row" backgroundColor={on ? theme.lift : theme.recess} paddingRight={1}>
                <box width={1} backgroundColor={on ? theme.teal : theme.tealDeep} />
                <text fg={on ? theme.soft : theme.quiet}>{`       ${entry.row.note}`}</text>
              </box>
            ) : null}
            {kind === "own" && writing ? (
              <box flexDirection="row" backgroundColor={theme.sunken} paddingRight={1}>
                <box width={1} backgroundColor={theme.teal} />
                <text fg={theme.quiet}>{"    your answer: "}</text>
                <text fg={theme.text}>{live.own}</text>
                <text fg={theme.rose}>{"_"}</text>
              </box>
            ) : null}
          </box>
        );
      })}

      {/*
        THE NOTE IS ALWAYS HERE AND IT IS NOT AN ANSWER. It was a numbered row for one draft, which
        put "add a note" among the things that answer the question - and it answers nothing. It
        qualifies whichever option is picked, so it costs one line and needs no choosing.
      */}
      <box
        flexDirection="row"
        backgroundColor={theme.sunken}
        paddingRight={1}
        onMouseDown={(event: MouseEvent) => {
          if (event.button !== MouseButton.LEFT) return;
          event.preventDefault();
          onEditNote?.();
        }}
      >
        <box width={1} backgroundColor={theme.tealDeep} />
        <text fg={theme.quiet}>{"    note: "}</text>
        <text fg={live.note ? theme.text : theme.mut}>
          {live.note || "n or click · a caveat, a condition, a thought"}
        </text>
      </box>

      {/*
        THE ARMED BAR: what enter will send, spelled out before it goes. Nothing leaves this panel
        without being stated first, which is what earns the right to send at all.
      */}
      <box
        flexDirection="row"
        backgroundColor={armed === null ? theme.recess : theme.panel}
        paddingRight={1}
      >
        <box width={1} backgroundColor={theme.teal} />
        {armed === null ? (
          <text fg={theme.quiet}>{"    pick one, then enter sends it"}</text>
        ) : (
          <text fg={theme.soft}>
            <span fg={theme.teal}>{"    enter sends "}</span>
            {armed}
            {live.note ? " · with your note" : ""}
          </text>
        )}
      </box>
    </box>
  );
}
