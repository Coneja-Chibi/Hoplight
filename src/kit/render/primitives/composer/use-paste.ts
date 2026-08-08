/**
 * What happens when something is pasted into the composer.
 *
 * Three outcomes, and only one of them is "text goes in the box". A big or multi-line paste becomes
 * a CARD held above the input, so a wall of text does not swallow the field it was pasted into. A
 * paste carrying no text at all is a pasted picture, because Ctrl+V belongs to the terminal and the
 * terminal only sends text: when the clipboard holds an image there is nothing to send, and asking
 * the OS is the only way to find out what it was. Everything else is left alone.
 */
import { usePaste } from "@opentui/react";
import { decodePasteBytes } from "@opentui/core";
import type { PasteEvent } from "@opentui/core";
import { classifyPaste, type PasteCard } from "./paste-classify";
import { isEmptyPaste } from "./image-paste";
import { readClipboardImage } from "../../clipboard-read";

export interface PasteHandlers {
  /** False while a gate or search owns the input; nothing is consumed. */
  enabled: boolean;
  /** How many cards are already held, read at paste time rather than captured. */
  cardCount: () => number;
  /** The cap, so the refusal names the fix rather than silently dropping the paste. */
  maxCards: number;
  addCard: (card: PasteCard) => void;
  notify: (text: string) => void;
  onImage?: (bytes: Uint8Array) => void;
}

export function useComposerPaste(handlers: PasteHandlers): void {
  usePaste((event: PasteEvent) => {
    if (!handlers.enabled) return;
    const text = decodePasteBytes(event.bytes);

    if (isEmptyPaste(text)) {
      event.preventDefault();
      void readClipboardImage().then((image) => {
        if (image) handlers.onImage?.(image.bytes);
      });
      return;
    }

    const classified = classifyPaste(text);
    if (classified.kind !== "card") return;
    event.preventDefault();
    if (handlers.cardCount() >= handlers.maxCards) {
      // Named rather than dropped: a paste that vanishes reads as Kit having missed the keystroke.
      handlers.notify("Paste not added: remove a card first.");
      return;
    }
    handlers.addCard(classified);
    handlers.notify("");
  });
}
