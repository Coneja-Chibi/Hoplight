/**
 * A question with options, as a panel you answer.
 *
 * WHY A PANEL AND NOT PROSE. The model could always write "which one: empty-base, paramnesia-vi-rc"
 * and every time it did, somebody had to read a comma-separated wall and retype an exact studio id
 * out of it, hyphens and all, from memory, having just been shown it. The information was there and
 * the ACTION was not. So the model emits DATA through `ask_choice`, the shell renders it, and the
 * rule holds: prose from a model is never the interaction surface.
 *
 * IT SENDS. Answering hands the model the answer and the conversation carries on, which is what a
 * question is for. The version Kit replaced filled the composer and stopped, so every answer needed
 * a second gesture nobody was told about.
 *
 * WHAT MAKES SENDING SAFE IS THE TWO STEPS. Clicking SELECTS; the send button sends. A mis-click
 * can no longer speak for you, which is the protection the fill-the-composer rule was buying
 * invisibly and charging for in confusion.
 *
 * A NOTE RIDES ALONG, in the same message. "Trackers, but only for the ones with art" is one
 * thought; sending the pick and the caveat separately would let the model answer the first before
 * reading the second.
 *
 * THE REASON GOES UNDER ITS OPTION, not out in the right margin - at a real width the option and
 * its explanation ended up sixty columns apart, once per option.
 */
import { useState, type JSX } from "react";
import { armedAnswer, askMessage, numberedRows, type AskState } from "../../kit/render/ask/ask-core";
import type { AskChoices } from "./kit-choice-core";

/**
 * An answered panel, collapsed to what was said.
 *
 * Leaving live options in the scrollback invites answering the same question twice, and the model
 * has already moved on.
 */
function Answered({ question, answer }: { question: string; answer: string }): JSX.Element {
  return (
    <div className="kit-ask kit-ask--done">
      <p className="kit-ask__q kit-ask__q--done">{question}</p>
      <p className="kit-ask__said">{`✓ ${answer.replace(/\n+/g, " · ")}`}</p>
    </div>
  );
}

export function ChoiceList({
  choices,
  answered,
  busy,
  onSend,
}: {
  choices: AskChoices;
  /** What was sent, once. An answered panel keeps its place but stops taking input. */
  answered?: string | undefined;
  busy?: boolean;
  onSend: (message: string) => void;
}): JSX.Element {
  /**
   * The cursor starts ON the first option rather than nowhere. Kit's note: nothing was lit until a
   * mouse crossed it, and hover is not discoverable - you do not go fishing with a pointer to learn
   * whether something is alive.
   */
  const [state, setState] = useState<AskState>({
    options: choices.options,
    cursor: 0,
    own: "",
    note: "",
  });

  if (answered !== undefined) return <Answered question={choices.question} answer={answered} />;

  const live: AskState = { ...state, options: choices.options };
  const armed = armedAnswer(live);
  const rows = numberedRows(choices.options);
  let pickIndex = -1;

  return (
    <div className="kit-ask">
      <div className="kit-ask__head">
        <span>{"PICK ONE"}</span>
        <span>{`${String(choices.options.length)} options`}</span>
      </div>
      <p className="kit-ask__q">{choices.question}</p>

      {rows.map((entry, at) => {
        // The rule separates answering the question from getting out of it.
        if (entry.row.kind === "rule") return <div key={`r${String(at)}`} className="kit-ask__rule" />;
        pickIndex += 1;
        const mine = pickIndex;
        const on = live.cursor === mine;
        const kind = entry.row.kind;
        const label = kind === "option"
          ? entry.row.value
          : kind === "own" ? "Write your own answer" : "Chat about this instead";
        return (
          <div key={`o${String(at)}`} className={on ? "kit-ask__opt kit-ask__opt--on" : "kit-ask__opt"}>
            <button
              type="button"
              className="kit-ask__pick"
              disabled={busy}
              /**
               * CLICK SELECTS, IT DOES NOT SEND. The two visible steps are what make sending
               * straight to the model safe: a click that sent would put words in somebody's mouth
               * on a mis-aim.
               */
              onClick={() => { setState((prior) => ({ ...prior, cursor: mine })); }}
            >
              <span className="kit-ask__caret">{on ? "❯" : " "}</span>
              <span className="kit-ask__num">{`${String(entry.number ?? 0)}. `}</span>
              <span className={kind === "option" ? "kit-ask__val" : "kit-ask__esc"}>{label}</span>
            </button>
            {kind === "option" && entry.row.note !== undefined && (
              <p className="kit-ask__note">{entry.row.note}</p>
            )}
            {kind === "own" && on && (
              <input
                className="kit-ask__own"
                type="text"
                value={live.own}
                placeholder="your answer"
                disabled={busy}
                onChange={(e) => { setState((prior) => ({ ...prior, own: e.target.value })); }}
              />
            )}
          </div>
        );
      })}

      {/*
        THE NOTE IS ALWAYS HERE AND IT IS NOT AN ANSWER. It was a numbered row for one draft, which
        put "add a note" among the things that answer the question - and it answers nothing. It
        qualifies whichever option is picked, so it costs one line and needs no choosing.
      */}
      <input
        className="kit-ask__noteField"
        type="text"
        value={live.note}
        placeholder="note - a caveat, a condition, a thought"
        disabled={busy}
        onChange={(e) => { setState((prior) => ({ ...prior, note: e.target.value })); }}
      />

      {/*
        THE ARMED BAR: what the button will send, spelled out before it goes. Nothing leaves this
        panel without being stated first, which is what earns the right to send at all.
      */}
      <div className={armed === null ? "kit-ask__arm" : "kit-ask__arm kit-ask__arm--ready"}>
        <span className="kit-ask__armText">
          {armed === null
            ? "pick one, then send it"
            : `sends ${armed}${live.note.trim() ? " · with your note" : ""}`}
        </span>
        <button
          type="button"
          className="kit-ask__send"
          disabled={busy || armed === null}
          onClick={() => {
            const message = askMessage(live);
            if (message !== null) onSend(message);
          }}
        >
          {"Send"}
        </button>
      </div>
    </div>
  );
}
