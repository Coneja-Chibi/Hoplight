/** @jsxImportSource @opentui/react */
/**
 * Composer: the multiline input (replaces input-bar). Owns the OpenTUI <textarea> (uncontrolled), a
 * fused prompter rail: one open heavy rule, a rose cap, the input plate, and its quiet provider
 * register. Text lives in the textarea's own buffer; Kit reads plainText and writes setText only at
 * four discrete moments (submit, history recall, ghost restore, clear), never per keystroke. Wires
 * the pure cores: history recall + draft ghost (up/down at the buffer edge, suppressing native
 * cursor move only there), and paste-as-card (a big/multi-line paste is held above and spliced in at
 * submit). Editing shortcuts: Enter submits / Shift+Enter newlines, plus the Windows-standard
 * ctrl+z/y/a the textarea defaults skip, and double-escape to clear. The caret is a color-shifting
 * underscore. Grows up to MAX_ROWS lines then scrolls.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import { defaultTextareaKeyBindings, MouseButton } from "@opentui/core";
import type { KeyBinding, KeyEvent, MouseEvent, TextareaRenderable } from "@opentui/core";
import type { DeckCount, EntitySummary } from "../../../bridge";
import type { ArgSuggestion, KitCommand } from "../../../commands/command";
import { theme } from "../../theme";
import { rampAt } from "../../colors";
import { SweepLine } from "../sweep-line";
import { StatusBar, type ProviderStatus } from "../status-bar";
import { PasteCard } from "./paste-card";
import { commit, initRecall, recallNext, recallPrev, type RecallState } from "./recall";
import { buildSubmission, type PasteCard as Card } from "./paste-classify";
import { useComposerPaste } from "./use-paste";
import { applyArg, argContext, matchingArgs, matchingCommands } from "./command-menu-core";
import { CommandMenu } from "./command-menu";
import { applyMention, matchingPieces, mentionDraft } from "./mention-menu-core";
import { MentionMenu } from "./mention-menu";
import { draftSuggestion } from "./suggestion";
import { readClipboardImage, readClipboardText } from "../../clipboard-read";
import { isImagePasteKey } from "./image-paste";
import { emptyDraftAction } from "./empty-draft-keys";

const CURSOR_RAMP = [
  "#3b82f6", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#3b82f6",
];
const CURSOR_STEP_MS = 90;
const CURSOR_FLOW = 0.01;
const BLINK_ON = 7;
const BLINK_OFF = 5;
const MAX_ROWS = 6; // composer grows to this many lines, then the textarea scrolls
const DOUBLE_ESC_MS = 500;
const MAX_CARDS = 5;

// Enter submits, Shift+Enter newlines, and the Windows-standard edit shortcuts (the defaults use
// ctrl+-/super+z). Later entries win per combo, so these override the defaults where they collide.
const KEYS: KeyBinding[] = [
  ...defaultTextareaKeyBindings,
  { name: "return", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "z", ctrl: true, action: "undo" },
  { name: "y", ctrl: true, action: "redo" },
  { name: "a", ctrl: true, action: "select-all" },
];

export function Composer({
  active,
  enabled = true,
  provider,
  busy,
  commands,
  decks = [],
  pieces = [],
  completeArg,
  onImage,
  insert,
  onInserted,
  onSubmit,
  onFocus,
  onStepRail,
  onFocusRail,
  onAskKey,
}: {
  active: boolean;
  enabled?: boolean;
  provider: ProviderStatus;
  busy: boolean;
  commands: readonly KitCommand[];
  decks?: readonly DeckCount[];
  pieces?: readonly EntitySummary[];
  /**
   * Load the candidates for a command's argument.
   *
   * Passed in rather than reached for: the completer needs a CommandContext, the shell already owns
   * one, and giving the composer its own would make the input a second route into the studio.
   */
  completeArg?: (command: KitCommand, prefix: string) => Promise<readonly ArgSuggestion[]>;
  /** An image was pasted with alt+V. The shell decides what to do with the bytes. */
  onImage?: (bytes: Uint8Array) => void;
  /**
   * Text to drop into the draft, from something the person picked rather than typed.
   *
   * A one-shot VALUE, cleared through `onInserted`, so picking the same option twice still inserts
   * and a re-render never repeats it.
   */
  insert?: string | null;
  onInserted?: () => void;
  onSubmit: (value: string) => boolean;
  /** A left-click landed in the composer, so whatever else holds the keyboard should let go. */
  onFocus?: () => void;
  /** Thumb the rail to the next (+1) or previous (-1) preset, from an EMPTY draft only. */
  onStepRail?: (delta: number) => void;
  /**
   * Hand the rail the keyboard. Tab, because that is what Tab means, replacing ctrl+b. Without a key
   * here the rail would be mouse-only, which a terminal app must never be.
   */
  onFocusRail?: () => void;
  /** Offer a key to the open question panel; true when it used it. It goes ahead of the rail. */
  onAskKey?: (key: string, sequence?: string) => boolean;
}): ReactNode {
  const ref = useRef<TextareaRenderable | null>(null);
  const recall = useRef<RecallState>(initRecall());
  const lastEsc = useRef(0);
  const [cards, setCards] = useState<Card[]>([]);
  const cardsRef = useRef<Card[]>([]);
  const [notice, setNotice] = useState("");
  const [rows, setRows] = useState(1);
  const [slashDraft, setSlashDraft] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [mentionText, setMentionText] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const commandMatches = matchingCommands(commands, slashDraft);
  const argCtx = argContext(commands, slashDraft);
  // The ARGUMENT popup wins once there is one. Both were gated on each other before, so a draft that
  // had an argument context and a command match showed the command and hid the argument.
  const menuOpen = !menuDismissed && !argCtx && commandMatches.length > 0;

  // Argument suggestions, loaded on demand: a completer reads the studio, and doing that per
  // keystroke would put a disk read behind the letter "s". Only CHANGING COMMAND re-reads; the
  // prefix filters the loaded list locally.
  const [argRows, setArgRows] = useState<readonly ArgSuggestion[]>([]);
  const [argFor, setArgFor] = useState<string | null>(null);
  const [argIndex, setArgIndex] = useState(0);
  useEffect(() => {
    const name = argCtx?.command.name ?? null;
    if (name === argFor) return;
    setArgFor(name);
    setArgIndex(0);
    if (!argCtx || !completeArg) { setArgRows([]); return; }
    let alive = true;
    void completeArg(argCtx.command, argCtx.prefix)
      .then((rows: readonly ArgSuggestion[]) => { if (alive) setArgRows(rows); })
      // A completer that fails costs suggestions, never the command: you can still type the id.
      .catch(() => { if (alive) setArgRows([]); });
    return () => { alive = false; };
  }, [argCtx, argFor, completeArg]);

  const argMatches = argCtx ? matchingArgs(argRows, argCtx.prefix) : [];
  const argOpen = !menuDismissed && argMatches.length > 0;
  const pieceMatches = matchingPieces(pieces, mentionText);
  const mentionOpen = !menuOpen && !mentionDismissed && pieceMatches.length > 0;

  const replaceCards = (next: Card[]): void => {
    cardsRef.current = next;
    setCards(next);
  };

  // Insert a picked option. APPENDED, not substituted: somebody may have been mid-sentence when they
  // clicked, and replacing what they wrote would make a convenience destructive.
  useEffect(() => {
    if (!insert) return;
    const ta = ref.current;
    if (!ta) return;
    const at = ta.plainText;
    ta.setText(at && !at.endsWith(" ") ? `${at} ${insert}` : `${at}${insert}`);
    setRows(ta.lineCount ?? 1);
    onInserted?.();
  }, [insert, onInserted]);

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.cursorStyle = { style: "underline", blinking: false };
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      const on = n % (BLINK_ON + BLINK_OFF) < BLINK_ON;
      ta.cursorColor = on ? rampAt(CURSOR_RAMP, n * CURSOR_FLOW) : theme.panel;
    }, CURSOR_STEP_MS);
    return () => clearInterval(id);
  }, []);

  const submit = (): void => {
    const ta = ref.current;
    if (!ta) return;
    const draft = ta.plainText;
    const text = buildSubmission(draft, cardsRef.current);
    if (!text.trim() || !onSubmit(text)) return;
    recall.current = commit(recall.current, draft);
    replaceCards([]);
    setNotice("");
    ta.setText("");
    setRows(1);
  };

  useKeyboard((e: KeyEvent) => {
    if (!enabled) return;
    const ta = ref.current;
    if (!ta) return;

    // Which keys mean "paste a picture", and why, live in image-paste.ts.
    if (isImagePasteKey(e)) {
      e.preventDefault();
      void readClipboardImage().then((image) => {
        if (image) onImage?.(image.bytes);
      });
      return;
    }

    /**
     * KEYS THAT REACH PAST THE COMPOSER, in the order they get a say: a popup, then TAB, then the
     * open question, then the rail. Tab works with text in the box because moving focus is not
     * something a half-written sentence should block; the rest need an empty draft, because an arrow
     * in a sentence is a cursor move and nothing may take it. See empty-draft-keys.ts.
     */
    const popup = menuOpen || argOpen || mentionOpen;
    if (!popup) {
      if (onFocusRail && e.name === "tab") { e.preventDefault(); onFocusRail(); return; }
      if (onAskKey && ta.plainText === "" && onAskKey(e.name ?? "", e.sequence)) {
        e.preventDefault();
        return;
      }
    }

    const empty = emptyDraftAction(e, {
      draft: ta.plainText,
      menuOpen: popup,
      railOpen: onStepRail !== undefined,
    });
    if (empty) {
      e.preventDefault();
      onStepRail?.(empty.delta);
      return;
    }
    if (mentionOpen && (e.name === "up" || e.name === "down")) {
      e.preventDefault();
      const delta = e.name === "up" ? -1 : 1;
      setMentionIndex((index) =>
        (index + delta + pieceMatches.length) % pieceMatches.length
      );
    } else if (mentionOpen && (e.name === "tab" || e.name === "return")) {
      e.preventDefault();
      const piece = pieceMatches[mentionIndex] ?? pieceMatches[0];
      if (!piece) return;
      ta.setText(applyMention(ta.plainText, piece));
      setMentionText("");
      setMentionDismissed(true);
    } else if (mentionOpen && e.name === "escape") {
      e.preventDefault();
      setMentionDismissed(true);
    } else if (argOpen && (e.name === "up" || e.name === "down")) {
      e.preventDefault();
      const delta = e.name === "up" ? -1 : 1;
      setArgIndex((index) => (index + delta + argMatches.length) % argMatches.length);
    } else if (argOpen && e.name === "return") {
      /**
       * Enter RUNS the highlighted one, because arrowing to a preset and pressing enter is the whole
       * gesture. Requiring Tab first and then Enter would make the list something to get past rather
       * than something to pick from.
       *
       * The highlighted row is what runs, which is why arrowing has to move a real selection rather
       * than only scroll: `argIndex` is the answer, not the cursor position in the text.
       */
      e.preventDefault();
      const pick = argMatches[argIndex] ?? argMatches[0];
      if (!pick) return;
      const line = applyArg(ta.plainText, pick.value);
      if (!onSubmit(line)) return;
      recall.current = commit(recall.current, line);
      ta.setText("");
      setSlashDraft("");
      setRows(1);
    } else if (argOpen && e.name === "tab") {
      // Tab COMPLETES without running, so a wrong guess is one more Tab rather than a retype.
      e.preventDefault();
      const pick = argMatches[argIndex] ?? argMatches[0];
      if (!pick) return;
      // Computed ONCE. Reading plainText again after setText applies the completion to text that has
      // already been completed, so a second Tab could double the argument.
      const completed = applyArg(ta.plainText, pick.value);
      ta.setText(completed);
      setSlashDraft(completed);
    } else if (argOpen && e.name === "escape") {
      e.preventDefault();
      setMenuDismissed(true);
    } else if (menuOpen && (e.name === "up" || e.name === "down")) {
      e.preventDefault();
      const delta = e.name === "up" ? -1 : 1;
      setCommandIndex((index) =>
        (index + delta + commandMatches.length) % commandMatches.length
      );
    } else if (menuOpen && e.name === "tab") {
      e.preventDefault();
      const command = commandMatches[commandIndex] ?? commandMatches[0];
      if (!command) return;
      /**
       * COMPLETING THE NAME MUST HAND OVER TO THE ARGUMENT, not close the popup.
       *
       * This wrote the completed text and then cleared the draft to "" and dismissed the menu, so
       * `argContext` saw nothing and the argument list could never open. Tab was the one gesture
       * most likely to be used before typing an argument, and it was the one that made the argument
       * list impossible. Reported twice as "why is it not auto completing".
       *
       * The draft becomes the completed text instead, and the menu is NOT dismissed: `matchingCommands`
       * already refuses a draft containing whitespace, so the command popup closes on its own while
       * the argument popup opens in its place.
       */
      const completed = `${command.name} `;
      ta.setText(completed);
      setSlashDraft(completed);
      setArgIndex(0);
    } else if (menuOpen && e.name === "return") {
      e.preventDefault();
      const command = commandMatches[commandIndex] ?? commandMatches[0];
      if (!command || !onSubmit(command.name)) return;
      recall.current = commit(recall.current, command.name);
      ta.setText("");
      setSlashDraft("");
      setRows(1);
    } else if (menuOpen && e.name === "escape") {
      e.preventDefault();
      setMenuDismissed(true);
    } else if (e.name === "up" && ta.logicalCursor.row === 0) {
      e.preventDefault();
      const r = recallPrev(recall.current, ta.plainText);
      recall.current = r.state;
      ta.setText(r.text);
    } else if (
      e.name === "down"
      && recall.current.index !== null
      && ta.logicalCursor.row === ta.lineCount - 1
    ) {
      e.preventDefault();
      const r = recallNext(recall.current);
      recall.current = r.state;
      ta.setText(r.text);
    } else if (e.name === "escape") {
      const t = performance.now();
      if (t - lastEsc.current < DOUBLE_ESC_MS) {
        ta.setText("");
        replaceCards([]);
        setNotice("");
        setRows(1);
        lastEsc.current = 0;
      } else {
        lastEsc.current = t;
      }
    }
  });

  useComposerPaste({
    enabled,
    cardCount: () => cardsRef.current.length,
    maxCards: MAX_CARDS,
    addCard: (card) => replaceCards([...cardsRef.current, card]),
    notify: setNotice,
    ...(onImage ? { onImage } : {}),
  });

  const boxRows = Math.min(MAX_ROWS, Math.max(1, rows));
  return (
    <box flexDirection="column" backgroundColor={theme.well} paddingLeft={1} paddingRight={1}>
      {cards.map((card, i) => (
        <PasteCard
          key={i}
          card={card}
          onRemove={() => {
            replaceCards(cardsRef.current.filter((_, j) => j !== i));
            setNotice("");
          }}
        />
      ))}
      {notice ? (
        <box height={1} backgroundColor={theme.sunken} paddingLeft={1}>
          <text fg={theme.gold}>{notice}</text>
        </box>
      ) : null}
      {menuOpen ? (
        <CommandMenu
          commands={commandMatches}
          activeIndex={Math.min(commandIndex, commandMatches.length - 1)}
          onChoose={(command) => {
            ref.current?.setText(`${command.name} `);
            setSlashDraft("");
            setMenuDismissed(true);
          }}
        />
      ) : null}
      {argOpen ? (
        <CommandMenu
          rows={argMatches.map((a) => ({ label: a.value, ...(a.note ? { note: a.note } : {}) }))}
          heading={argFor ? `${argFor.toUpperCase()} ...` : "OPTIONS"}
          activeIndex={Math.min(argIndex, argMatches.length - 1)}
          onChooseRow={(row) => {
            const ta = ref.current;
            if (!ta) return;
            ta.setText(applyArg(ta.plainText, row.label));
            setSlashDraft(applyArg(ta.plainText, row.label));
          }}
        />
      ) : null}
      {mentionOpen ? (
        <MentionMenu
          pieces={pieceMatches}
          activeIndex={Math.min(mentionIndex, pieceMatches.length - 1)}
          onChoose={(piece) => {
            const ta = ref.current;
            if (!ta) return;
            ta.setText(applyMention(ta.plainText, piece));
            setMentionText("");
            setMentionDismissed(true);
          }}
        />
      ) : null}
      {active ? <SweepLine /> : <box height={1} />}
      <box
        flexDirection="column"
        border={["top"]}
        borderStyle="heavy"
        borderColor={theme.line}
        backgroundColor={theme.panel}
      >
        <box
          flexDirection="row"
          height={boxRows}
          backgroundColor={theme.panel}
          paddingRight={1}
          /**
           * RIGHT-CLICK PASTES, the way every other text field on the machine does. It asks the
           * OPERATING SYSTEM rather than the terminal, because OSC52 read-back is disabled almost
           * everywhere - a program that can silently read your clipboard can read the password you
           * copied a minute ago - and only on a button somebody pressed, which is the same consent
           * a right-click carries anywhere else. Inserted at the cursor rather than replacing the
           * draft, because clobbering a half-written sentence is the expensive way to be wrong.
           */
          onMouseDown={(event: MouseEvent) => {
            // A LEFT-CLICK IN HERE MEANS "I AM TYPING HERE". Clicking the rail took the keyboard and
            // clicking the box you type in did nothing, so only a chord could undo it.
            if (event.button !== MouseButton.RIGHT) { onFocus?.(); return; }
            event.preventDefault();
            const ta = ref.current;
            if (!ta || !enabled) return;
            void readClipboardText().then((text) => {
              if (!text) return;
              const at = ta.plainText;
              ta.setText(at + text);
              setNotice("");
            });
          }}
        >
          <box backgroundColor={theme.roseDeep} width={4} alignItems="center" justifyContent="center">
            <text fg={theme.white}>{">"}</text>
          </box>
          <box width={1} backgroundColor={theme.edge} />
          <box width={1} />
          <textarea
            ref={ref}
            focused={enabled}
            flexGrow={1}
            placeholder={draftSuggestion(decks, pieces)}
            keyBindings={KEYS}
            onSubmit={submit}
            onContentChange={() => {
              const text = ref.current?.plainText ?? "";
              setRows(ref.current?.lineCount ?? 1);
              setCommandIndex(0);
              setMenuDismissed(false);
              setMentionIndex(0);
              setMentionDismissed(false);
              /**
               * KEEP THE DRAFT PAST THE FIRST SPACE.
               *
               * This used to clear the moment the text contained ANY whitespace, which was correct
               * while the popup only completed command NAMES - and silently made argument
               * completion impossible, because `/rail ` cleared the draft to "" before anything
               * could look at what came after the space. Chi typed `/rail ` and got nothing.
               *
               * Safe to widen: `matchingCommands` refuses a draft containing whitespace itself, so
               * the command popup still closes exactly when it did before. Only `argContext` sees
               * more, which is the whole point.
               */
              setSlashDraft(text.startsWith("/") && !text.includes("\n") ? text : "");
              setMentionText(mentionDraft(text));
            }}
          />
        </box>
        <StatusBar provider={provider} busy={busy} />
      </box>
    </box>
  );
}
