/** Verifies provider egress accounting and its user-facing summary. */
import { test, expect } from "bun:test";
import { EMPTY_LEDGER, recordEgress, formatLedger } from "./egress-ledger";

test("recordEgress accumulates entries, totals, and the send count", () => {
  let ledger = EMPTY_LEDGER;
  ledger = recordEgress(ledger, { at: 1, provider: "claude", input: 3100, output: 840 });
  ledger = recordEgress(ledger, { at: 2, provider: "claude", input: 5400, output: 1200 });
  expect(ledger.entries.length).toBe(2);
  expect(ledger.sends).toBe(2);
  expect(ledger.totalInput).toBe(8500);
  expect(ledger.totalOutput).toBe(2040);
  expect(ledger.entries[0]!.provider).toBe("claude");
});

test("recordEgress is immutable (the input ledger is unchanged)", () => {
  const before = recordEgress(EMPTY_LEDGER, { at: 1, provider: "claude", input: 100, output: 10 });
  const after = recordEgress(before, { at: 2, provider: "claude", input: 200, output: 20 });
  expect(before.entries.length).toBe(1);
  expect(after.entries.length).toBe(2);
  expect(EMPTY_LEDGER.entries.length).toBe(0);
});

test("recordEgress cleans ragged counts and a blank provider (tolerant)", () => {
  const ledger = recordEgress(EMPTY_LEDGER, {
    at: Number.NaN,
    provider: "",
    input: Number.NaN,
    output: -5,
  });
  const entry = ledger.entries[0]!;
  expect(entry.provider).toBe("provider");
  expect(entry.input).toBe(0);
  expect(entry.output).toBe(0);
  expect(entry.at).toBe(0);
  expect(ledger.totalInput).toBe(0);
});

test("recordEgress caps the entry window but keeps totals cumulative", () => {
  let ledger = EMPTY_LEDGER;
  for (let i = 0; i < 520; i += 1) {
    ledger = recordEgress(ledger, { at: i, provider: "claude", input: 10, output: 1 });
  }
  expect(ledger.entries.length).toBe(500); // window capped
  expect(ledger.sends).toBe(520); // count is cumulative
  expect(ledger.totalInput).toBe(5200); // totals stay honest after eviction
});

test("formatLedger: an empty ledger reads honestly", () => {
  expect(formatLedger(EMPTY_LEDGER)).toContain("Nothing has left this machine yet");
});

test("formatLedger: lists each send with provider and compact tokens", () => {
  let ledger = EMPTY_LEDGER;
  ledger = recordEgress(ledger, { at: 0, provider: "claude", input: 3100, output: 840 });
  const out = formatLedger(ledger);
  expect(out).toContain("1 send ");
  expect(out).toContain("claude");
  expect(out).toContain("3.1k in / 840 out");
  expect(out).toContain("Credentials authenticate only to your configured provider");
  expect(out).not.toContain("Keys never travel");
});
