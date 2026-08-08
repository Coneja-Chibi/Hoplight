/**
 * The transcript itself: every line, in the band its role earns it.
 *
 * WHY THIS IS ITS OWN FILE. The room owns the window - the header, the composer, the Gate, the
 * brief - and the transcript is now the part with real behaviour in it: markdown, folding, copying,
 * a question you can answer. Leaving it inline would have pushed the room past its line cap and
 * buried the layout under the rendering.
 *
 * THE GRAMMAR IS UNCHANGED. Bands, spines, tonal contrast, no rules between turns; your line lifts,
 * a reply recesses, a tool row wears its verb colour. What is added is what each band can DO.
 */
import type { JSX } from "react";
import { verbOf } from "./kit-vars";
import { CopyableBand, ErrorRow, FoldedSay } from "./kit-bands";
import { isFoldable, sayIsOpen } from "./kit-bands-core";
import { ChoiceList } from "./kit-choice";
import { KitCommandBand } from "./kit-command-bands";
import { KitMarkdown } from "./kit-markdown";
import type { ChatLine } from "./turn";

/** What a command line can do when one of its rows is chosen. */
export interface CommandActs {
  onSend: (line: string) => void;
  onRewind: (keep: number) => void;
}

/** One settled line. */
function Line({
  line,
  index,
  lines,
  busy,
  acts,
  onFold,
  onNotice,
  onAnswer,
}: {
  line: ChatLine;
  index: number;
  lines: readonly ChatLine[];
  busy: boolean;
  acts: CommandActs;
  onFold: (index: number, open: boolean) => void;
  onNotice: (message: string) => void;
  onAnswer: (index: number, message: string) => void;
}): JSX.Element {
  /**
   * A COMMAND'S OUTPUT IS NOT A MESSAGE, so it does not wear a message's band.
   *
   * It has no `who`, because nobody said it, and no fold, because it is not scrollback from a
   * conversation - it is a thing that was asked for and answered on the spot. A widget draws itself;
   * a plain `say` is markdown, which is what Kit's own transcript does with the same text.
   */
  if (line.role === "kit") {
    return (
      <div className="agent-room__line agent-room__line--kit">
        {line.widget
          ? <KitCommandBand title={line.text} widget={line.widget} onSend={acts.onSend} onRewind={acts.onRewind} />
          : (
            <CopyableBand className="agent-room__body" text={line.text} onNotice={onNotice}>
              <KitMarkdown text={line.text} />
            </CopyableBand>
          )}
      </div>
    );
  }

  /**
   * A LONG REPLY FOLDS, and the newest one does not. Folding exists to keep scrollback from being a
   * wall, and the reply you are reading is not scrollback - so the rule is about POSITION, which
   * means a reloaded transcript folds exactly the way the live one did.
   *
   * THE CLICK SAYS WHICH WAY, taken from what is actually on screen rather than from the stored
   * flag. That flag is undefined until somebody touches a line, so "flip it" had no answer for a
   * reply folded by position: the first click wrote the state it was already in and did nothing.
   */
  const foldable = line.role === "assistant" && isFoldable(line.text, false);
  const open = sayIsOpen(lines, index);
  if (foldable && !open) {
    return <FoldedSay text={line.text} onToggle={() => { onFold(index, true); }} />;
  }

  const who = line.role === "user" ? "you" : line.role === "tool" ? "did" : "agent";

  return (
    <div
      className={`agent-room__line agent-room__line--${line.role}`}
      /* A tool row wears its VERB colour, exactly as Kit does: cool reads, warm writes, red
         destroys. Risk is legible before any of the words are. */
      {...(line.tool ? { style: { borderLeftColor: verbOf(line.tool) } } : {})}
    >
      <CopyableBand
        className="agent-room__body"
        text={line.text}
        onNotice={onNotice}
        {...(foldable
          ? {
              onClick: (): void => {
                /**
                 * NOT WHILE SOMETHING IS SELECTED. Kit folds on a click anywhere in the band, which
                 * is right in a terminal; in a browser, dragging across a long reply to select part
                 * of it ends in a click, and collapsing what somebody just highlighted would make
                 * the fold actively hostile to the thing a transcript is for.
                 */
                if ((window.getSelection()?.toString() ?? "") !== "") return;
                onFold(index, false);
              },
            }
          : {})}
      >
        <span className="agent-room__who">{who}</span>
        {/*
          THE AGENT'S WORDS ARE MARKDOWN AND EVERYTHING ELSE IS NOT. Your own line is what you
          typed and should read back exactly as typed; a tool summary is a machine's one-liner.
          Parsing either would let a stray asterisk restyle somebody's own sentence.
        */}
        {line.role === "assistant"
          ? <KitMarkdown text={line.text} />
          : <p className="agent-room__said">{line.text}</p>}
      </CopyableBand>
      {/* The question this call asked, drawn from the tool's data rather than from its prose. */}
      {line.choices !== undefined && (
        <ChoiceList
          choices={line.choices}
          {...(line.answered === undefined ? {} : { answered: line.answered })}
          busy={busy}
          onSend={(message) => { onAnswer(index, message); }}
        />
      )}
    </div>
  );
}

/**
 * The whole transcript.
 *
 * The streaming reply is drawn as its own band rather than appended to the list, because it is not
 * a line yet - it has no place in the fold ordering and nothing to copy until it settles.
 */
export function Transcript({
  lines,
  streaming,
  busy,
  problem,
  acts,
  onFold,
  onNotice,
  onAnswer,
}: {
  lines: readonly ChatLine[];
  streaming: string;
  busy: boolean;
  problem: string | null;
  acts: CommandActs;
  onFold: (index: number, open: boolean) => void;
  onNotice: (message: string) => void;
  onAnswer: (index: number, message: string) => void;
}): JSX.Element {
  return (
    <>
      {lines.map((line, i) => (
        <Line
          key={`${line.role}${String(i)}`}
          line={line}
          index={i}
          lines={lines}
          busy={busy}
          acts={acts}
          onFold={onFold}
          onNotice={onNotice}
          onAnswer={onAnswer}
        />
      ))}
      {streaming && (
        <div className="agent-room__line agent-room__line--assistant">
          <div className="agent-room__body">
            <span className="agent-room__who">{"agent"}</span>
            {/* Rendered as markdown while it arrives: Kit's parser is tolerant, so half a fence and
                an unclosed bold marker still read as text rather than snapping into shape at the end. */}
            <KitMarkdown text={streaming} />
          </div>
        </div>
      )}
      {/* A failure is a band with a red spine, not a loose paragraph that reads like something the
          agent said. Capped at Kit's ERROR_ROW_CHARS so an HTML error page cannot take the log. */}
      {problem !== null && <ErrorRow text={problem} onNotice={onNotice} />}
    </>
  );
}
