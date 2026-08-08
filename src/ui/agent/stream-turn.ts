/**
 * Reading one turn's stream in the browser.
 *
 * Pure over a `Response`, so every branch is testable without a server: a stream that ends mid-frame,
 * a frame that is not JSON, a turn that is cancelled. None of that needs a DOM and all of it happens.
 *
 * SERVER-SENT EVENTS BY HAND, not `EventSource`, because EventSource only does GET and this turn is
 * a POST carrying the conversation. The format is the same; the parser is nine lines.
 */

/** What the window does with each frame. Named events, so no kind-parsing at the call site. */
export interface TurnHandlers {
  /** A fragment of the answer being typed. `reasoning` is the model thinking, not its reply. */
  onDelta?: (kind: "text" | "reasoning", text: string) => void;
  /** A complete assistant message. */
  onSay?: (text: string) => void;
  /** A tool is running / has run. */
  onToolStart?: (name: string) => void;
  /**
   * `choices` is present when the call was `ask_choice`.
   *
   * IT WAS ARRIVING AND BEING DROPPED. The server has always put this on the tool frame - see
   * `frameFor` in turn-stream.ts - and this parser read only the name and the summary, so a
   * question the agent asked reached the window as the sentence "ask_choice: 3 options" and the
   * list itself was thrown away here. Passed on raw: the shell parses it once, at the boundary.
   */
  onTool?: (name: string, summary: string, choices?: unknown) => void;
  /** A piece was written; whatever is showing it should re-read. */
  onWrote?: (kind: string, id: string) => void;
  /** The agent is asking permission and the loop is PARKED until it is answered. */
  onGate?: (request: unknown) => void;
  onUsage?: (usage: unknown) => void;
  /** Which model answered. */
  onModel?: (label: string) => void;
  /** The turn stopped early: a budget, a cancel. */
  onStopped?: (reason: string, recovery?: string) => void;
  onFailed?: (error: string) => void;
}

/**
 * Consume the stream to its end.
 *
 * Never throws. A turn that dies mid-flight reports through `onFailed`, because the caller is a
 * click handler and a rejected promise there is an unhandled rejection plus a window stuck on
 * "thinking" with nothing to retry.
 */
export async function readTurnStream(response: Response, on: TurnHandlers): Promise<void> {
  if (!response.body) {
    on.onFailed?.("The server sent no stream.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. Anything after the last one is a partial frame and
      // stays in the buffer: splitting on every chunk boundary would tear frames in half.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) dispatch(frame, on);
    }
    // A frame with no trailing blank line, which happens when a stream ends cleanly on the last one.
    if (buffer.trim()) dispatch(buffer, on);
  } catch (error) {
    /**
     * An abort is not a failure. Cancelling is something somebody chose, and reporting it as an
     * error would put a red box on screen for doing exactly what the stop button says it does.
     */
    const name = (error as { name?: string }).name;
    if (name === "AbortError") on.onStopped?.("Stopped.");
    else on.onFailed?.(error instanceof Error ? error.message : String(error));
  } finally {
    // Releasing matters: an un-released reader keeps the connection, and this window is left open.
    try { reader.releaseLock(); } catch { /* already released by the stream ending */ }
  }
}

function dispatch(frame: string, on: TurnHandlers): void {
  let event = "";
  let raw = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) raw = line.slice(6);
  }
  if (!event) return;

  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null) data = parsed as Record<string, unknown>;
  } catch {
    // A frame we cannot read is dropped rather than taking the turn down. The stream keeps going;
    // the alternative is one malformed frame ending an otherwise working answer.
    return;
  }

  const str = (key: string): string => (typeof data[key] === "string" ? data[key] : "");

  switch (event) {
    case "delta":
      on.onDelta?.(data["kind"] === "reasoning" ? "reasoning" : "text", str("text"));
      return;
    case "say": on.onSay?.(str("text")); return;
    case "tool-start": on.onToolStart?.(str("name")); return;
    case "tool": on.onTool?.(str("name"), str("summary"), data["choices"]); return;
    case "wrote": on.onWrote?.(str("kind"), str("id")); return;
    case "gate": on.onGate?.(data); return;
    case "usage": on.onUsage?.(data["usage"]); return;
    case "model": on.onModel?.(str("label")); return;
    case "stopped": {
      const recovery = str("recovery");
      on.onStopped?.(str("reason"), recovery || undefined);
      return;
    }
    case "failed": on.onFailed?.(str("error")); return;
    default: return;
  }
}
