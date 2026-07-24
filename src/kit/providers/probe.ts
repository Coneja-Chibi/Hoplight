/**
 * Provider probe: the proof-of-life behind /test (RC parity). One tiny chat call, no tools, timed
 * with the monotonic clock (never wall-clock subtraction), to confirm the configured provider is
 * reachable and actually answering, and to surface the model's own greeting as evidence rather than
 * a bare green check. The ChatFn is injected, so this is testable without touching the network.
 */
import type { ChatFn } from "./provider";

const PING = "Reply with a short, friendly one-line greeting confirming you can hear me.";

export interface Probe {
  text: string;
  ms: number;
}

export async function pingProvider(chat: ChatFn): Promise<Probe> {
  const start = performance.now();
  const reply = await chat([{ role: "user", content: PING }], []);
  const ms = Math.round(performance.now() - start);
  const text = reply.text.trim();
  return { text: text || "(the model replied with no text)", ms };
}
