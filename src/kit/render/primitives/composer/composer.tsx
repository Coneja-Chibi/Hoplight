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
import { useKeyboard, usePaste } from "@opentui/react";
import { decodePasteBytes, defaultTextareaKeyBindings } from "@opentui/core";
import type { KeyBinding, KeyEvent, PasteEvent, TextareaRenderable } from "@opentui/core";
import type { KitCommand } from "../../../commands/command";
import { theme } from "../../theme";
import { rampAt } from "../../colors";
import { SweepLine } from "../sweep-line";
import { StatusBar, type ProviderStatus } from "../status-bar";
import { PasteCard } from "./paste-card";
import { commit, initRecall, recallNext, recallPrev, type RecallState } from "./recall";
import { buildSubmission, classifyPaste, type PasteCard as Card } from "./paste-classify";
import { matchingCommands } from "./command-menu-core";
import { CommandMenu } from "./command-menu";

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
  onSubmit,
}: {
  active: boolean;
  enabled?: boolean;
  provider: ProviderStatus;
  busy: boolean;
  commands: readonly KitCommand[];
  onSubmit: (value: string) => boolean;
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
  const commandMatches = matchingCommands(commands, slashDraft);
  const menuOpen = !menuDismissed && commandMatches.length > 0;

  const replaceCards = (next: Card[]): void => {
    cardsRef.current = next;
    setCards(next);
  };

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
    if (menuOpen && (e.name === "up" || e.name === "down")) {
      e.preventDefault();
      const delta = e.name === "up" ? -1 : 1;
      setCommandIndex((index) =>
        (index + delta + commandMatches.length) % commandMatches.length
      );
    } else if (menuOpen && e.name === "tab") {
      e.preventDefault();
      const command = commandMatches[commandIndex] ?? commandMatches[0];
      if (!command) return;
      ta.setText(`${command.name} `);
      setSlashDraft("");
      setMenuDismissed(true);
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

  usePaste((e: PasteEvent) => {
    if (!enabled) return;
    const classified = classifyPaste(decodePasteBytes(e.bytes));
    if (classified.kind === "card") {
      e.preventDefault();
      if (cardsRef.current.length >= MAX_CARDS) {
        setNotice("Paste not added: remove a card first.");
        return;
      }
      replaceCards([...cardsRef.current, classified]);
      setNotice("");
    }
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
      {active ? <SweepLine /> : <box height={1} />}
      <box
        flexDirection="column"
        border={["top"]}
        borderStyle="heavy"
        borderColor={theme.line}
        backgroundColor={theme.panel}
      >
        <box flexDirection="row" height={boxRows} backgroundColor={theme.panel} paddingRight={1}>
          <box backgroundColor={theme.roseDeep} width={4} alignItems="center" justifyContent="center">
            <text fg={theme.white}>{">"}</text>
          </box>
          <box width={1} backgroundColor={theme.edge} />
          <box width={1} />
          <textarea
            ref={ref}
            focused={enabled}
            flexGrow={1}
            placeholder="talk to your studio"
            keyBindings={KEYS}
            onSubmit={submit}
            onContentChange={() => {
              const text = ref.current?.plainText ?? "";
              setRows(ref.current?.lineCount ?? 1);
              setCommandIndex(0);
              setMenuDismissed(false);
              setSlashDraft(
                text.startsWith("/") && !text.includes("\n") && !/\s/.test(text) ? text : "",
              );
            }}
          />
        </box>
        <StatusBar provider={provider} busy={busy} />
      </box>
    </box>
  );
}
