/**
 * Pictures pasted since the last send, waiting to ride with the next message.
 *
 * HELD RATHER THAN SENT IMMEDIATELY, because an image is rarely the question. Somebody pastes a
 * picture and then types what they want asking about it, so sending on paste would fire a turn with
 * no question in it.
 *
 * WHETHER TO HOLD ONE AT ALL IS THE PROVIDER'S ANSWER. Kit used to caption every pasted image "shown
 * to you only - Kit's providers take text", which was a blanket claim about other people's software
 * and wrong for most of it. A provider that reads images gets the picture; one that does not keeps it
 * on screen, and the caption says which. Queuing for a provider that cannot read it would be worse
 * than not queuing at all: the image would sit there looking attached and then error the turn.
 */
import { useRef, useState } from "react";

/** Just enough of the active provider to decide and to say so. */
export interface ImageAudience {
  name: string;
  images?: boolean;
}

export interface PendingImages {
  /** The caption for a freshly pasted picture, and whether it was queued to send. */
  accept: (bytes: Uint8Array) => { note: string; queued: boolean };
  /** Everything waiting, cleared in the same breath. Called once, at send. */
  take: () => readonly Uint8Array[];
  /** How many are waiting, for chrome that wants to say so. */
  count: number;
}

export function usePendingImages(provider: ImageAudience | null): PendingImages {
  const [pending, setPending] = useState<readonly Uint8Array[]>([]);
  /**
   * Read through a ref at SEND time.
   *
   * runPrompt is called from a settled turn as well as from typing, so a captured value would attach
   * whatever happened to be pending when that closure was built rather than what is pending now.
   */
  const ref = useRef<readonly Uint8Array[]>([]);
  ref.current = pending;

  return {
    accept(bytes) {
      const who = provider?.name ?? "this provider";
      if (provider?.images !== true) {
        return { note: `shown to you only - ${who} takes text, so this is not sent`, queued: false };
      }
      setPending((prev) => [...prev, bytes]);
      return { note: `goes to ${who} with your next message`, queued: true };
    },
    take() {
      const taken = ref.current;
      ref.current = [];
      setPending([]);
      return taken;
    },
    count: pending.length,
  };
}
