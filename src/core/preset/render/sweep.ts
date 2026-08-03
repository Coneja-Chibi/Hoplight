/**
 * Render many presets at once and report what did not resolve.
 *
 * WHY THIS IS THE FAN-OUT WORTH HAVING. Every other concurrency idea in Kit runs into the same wall:
 * the tools touch a shared studio, so two of them writing at once is a correctness problem the
 * scheduler exists to prevent. Verification has no such problem. Rendering a preset reads a file,
 * spawns somebody else's engine, and reports what came back; nothing is written, nothing is shared,
 * and the work is embarrassingly parallel. It is also the slowest thing Hoplight does, because each
 * render is a whole process start.
 *
 * BOUNDED, because unbounded is not fast. Each render spawns an engine, and starting one process per
 * preset on a large library would thrash a machine rather than use it. The pool is small and fixed.
 *
 * A FAILED RENDER IS A RESULT, not an abort. One preset that cannot be read must not cost the report
 * on the other forty; a sweep whose value is "which of these are broken" cannot be the thing that
 * stops at the first broken one.
 */
import { runRenderer, type RendererCommand, type RunOptions } from "./runner";
import { unresolvedCount, type RenderOutcome } from "./contract";

/** One preset's verdict. `unresolved` is absent when the render did not happen at all. */
export interface SweepEntry {
  readonly preset: string;
  readonly ok: boolean;
  /** Total unresolved occurrences, when the engine answered. */
  readonly unresolved?: number;
  /** The distinct tokens, so a report can name them rather than just count them. */
  readonly tokens?: readonly string[];
  /** Why it did not render, when it did not. */
  readonly detail?: string;
}

export interface SweepReport {
  readonly entries: readonly SweepEntry[];
  /** Rendered and completely resolved. */
  readonly clean: number;
  /** Rendered, but something survived. */
  readonly dirty: number;
  /** Did not render at all. */
  readonly failed: number;
}

/** Concurrent process starts. Small: each one is an engine, not a request. */
export const DEFAULT_POOL = 4;

const entryFor = (preset: string, outcome: RenderOutcome): SweepEntry => {
  if (!outcome.ok) return { preset, ok: false, detail: outcome.detail };
  const tokens = outcome.unresolved.map((u) => u.token);
  return { preset, ok: true, unresolved: unresolvedCount(outcome), tokens };
};

/**
 * Run every preset through one renderer, at most `pool` at a time.
 *
 * Order is preserved regardless of which finishes first, because a report that reshuffles itself
 * between runs cannot be diffed against the last one.
 */
export async function sweepPresets(
  renderer: RendererCommand,
  presets: readonly string[],
  options: RunOptions & { pool?: number } = {},
): Promise<SweepReport> {
  const { pool = DEFAULT_POOL, ...run } = options;
  const entries: SweepEntry[] = new Array(presets.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= presets.length) return;
      const preset = presets[index]!;
      try {
        entries[index] = entryFor(preset, await runRenderer(renderer, { preset }, run));
      } catch (error) {
        // runRenderer returns failures as values, so reaching here means something unforeseen. It is
        // still one preset's problem and not the sweep's.
        entries[index] = { preset, ok: false, detail: (error as Error).message };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(pool, presets.length)) }, worker),
  );

  return {
    entries,
    clean: entries.filter((e) => e.ok && e.unresolved === 0).length,
    dirty: entries.filter((e) => e.ok && (e.unresolved ?? 0) > 0).length,
    failed: entries.filter((e) => !e.ok).length,
  };
}

/** The sweep as a readable summary. Markdown, so a transcript renders it like any other reply. */
export function formatSweep(report: SweepReport): string {
  if (report.entries.length === 0) return "**Preset sweep**\n\nNo presets to check.";
  const lines = [
    "**Preset sweep**",
    "",
    `${report.clean} clean · ${report.dirty} with unresolved macros · ${report.failed} could not render`,
    "",
  ];
  for (const entry of report.entries) {
    if (!entry.ok) {
      lines.push(`- \`${entry.preset}\` could not render: ${entry.detail ?? "unknown"}`);
      continue;
    }
    if ((entry.unresolved ?? 0) === 0) continue;
    // Only the distinct tokens, and only a few: a preset with sixty of one macro should read as one
    // problem rather than sixty lines.
    const shown = (entry.tokens ?? []).slice(0, 6).join(" ");
    const more = (entry.tokens?.length ?? 0) > 6 ? ` (+${entry.tokens!.length - 6} more)` : "";
    lines.push(`- \`${entry.preset}\` left ${entry.unresolved} unresolved: ${shown}${more}`);
  }
  if (report.dirty === 0 && report.failed === 0) lines.push("Every preset resolved completely.");
  return lines.join("\n");
}
