/**
 * egress-ledger: the pure, append-only record of what left the machine. Kit sends only when you send;
 * each API call is one entry (which provider it reached, and the tokens it carried, input = the context,
 * output = the reply). The ledger is the receipts behind the "nothing leaves until you send" promise and
 * what /privacy reads back. Pure, total, and bounded: no I/O, no clock (the timestamp is stamped at the
 * impure edge and passed in), never throws, and the entry list is capped so a long session cannot grow
 * it without bound. The running totals are cumulative for the whole session (they are not recomputed from
 * the capped entry window), so they stay honest even after old entries roll off.
 */

/** One send: the provider it reached and the tokens it carried. `at` is epoch ms, stamped by the shell. */
export interface EgressEntry {
  readonly at: number;
  readonly provider: string;
  readonly input: number;
  readonly output: number;
}

/** The session's sends: the most recent entries (capped) plus cumulative token totals for the session. */
export interface EgressLedger {
  readonly entries: readonly EgressEntry[];
  readonly totalInput: number;
  readonly totalOutput: number;
  readonly sends: number;
}

export const EMPTY_LEDGER: EgressLedger = { entries: [], totalInput: 0, totalOutput: 0, sends: 0 };

/** Keep the most recent sends for display; a long session can make many calls. Totals stay cumulative. */
const MAX_ENTRIES = 500;

/** A finite, non-negative count, else 0 (the entry may carry a ragged number even after upstream cleaning). */
const nonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Record one send, immutably and bounded. The entry window is capped to the most recent sends; the
 * totals and the send count are cumulative across the whole session, so they never undercount after an
 * old entry rolls off the window. A ragged provider name is coerced to a readable placeholder.
 */
export const recordEgress = (ledger: EgressLedger, entry: EgressEntry): EgressLedger => {
  const clean: EgressEntry = {
    at: Number.isFinite(entry.at) ? entry.at : 0,
    provider: typeof entry.provider === "string" && entry.provider.length > 0 ? entry.provider : "provider",
    input: nonNeg(entry.input),
    output: nonNeg(entry.output),
  };
  return {
    entries: [...ledger.entries, clean].slice(-MAX_ENTRIES),
    totalInput: ledger.totalInput + clean.input,
    totalOutput: ledger.totalOutput + clean.output,
    sends: ledger.sends + 1,
  };
};

/** Compact a token count for display: 840 -> "840", 3100 -> "3.1k", 1_200_000 -> "1.2M". */
const compact = (n: number): string => {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
};

/** HH:MM (24h, local) for a send's timestamp; a zero or unknown stamp reads "--:--". */
const clockOf = (at: number): string => {
  if (!Number.isFinite(at) || at <= 0) return "--:--";
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Render the ledger as the /privacy readout: a plain, honest list of every send this session. Markdown,
 *  so the shell renders it as a normal reply. Pure but for local-time formatting of each stamp. */
export const formatLedger = (ledger: EgressLedger): string => {
  if (ledger.sends === 0) {
    return "**What has left this machine**\n\nNothing has left this machine yet. Kit sends only when you send.";
  }
  const plural = ledger.sends === 1 ? "" : "s";
  const head = `**What has left this machine**\n\n${ledger.sends} send${plural} · ${compact(ledger.totalInput)} in / ${compact(ledger.totalOutput)} out total\n`;
  const rows = ledger.entries.map(
    (e) => `- \`${clockOf(e.at)}\`  ${e.provider}  ${compact(e.input)} in / ${compact(e.output)} out`,
  );
  return [head, ...rows, "\nKeys never travel. Only what you sent, and the reads it carried."].join("\n");
};
