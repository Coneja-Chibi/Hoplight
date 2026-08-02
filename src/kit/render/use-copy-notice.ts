/**
 * Copy-to-clipboard with its own transient notice.
 *
 * One concept, lifted out of the render root: attempting a copy, turning whichever way it failed into
 * a sentence, and clearing that sentence after a beat. The timer is cleared on unmount and again on
 * every copy, so a rapid second copy replaces the first notice instead of letting the older timer
 * blank the newer one.
 */
import { useEffect, useRef, useState } from "react";
import { copyText, type CopyResult } from "./clipboard";

/** Every outcome named, so a silent failure is impossible: the union has no default branch. */
const MESSAGES: Record<CopyResult, string> = {
  requested: "copy requested",
  unsupported: "clipboard unavailable in this terminal",
  "too-large": "message too large for safe terminal copy",
  failed: "terminal refused the copy",
};

const NOTICE_MS = 2200;

export interface CopyNotice {
  /** The current notice, or null when there is nothing to say. */
  readonly notice: string | null;
  copy(text: string): void;
}

export function useCopyNotice(renderer: Parameters<typeof copyText>[0]): CopyNotice {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return {
    notice,
    copy: (text) => {
      setNotice(MESSAGES[copyText(renderer, text)]);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    },
  };
}
