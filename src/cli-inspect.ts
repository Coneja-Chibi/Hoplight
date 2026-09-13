/**
 * `inspect`'s per-kind summary: the few lines worth printing about each canonical kind.
 *
 * Split out of cli.ts because it is the one part of that file that grows with the MODEL rather than
 * with the command line - every new entity kind adds a branch here and nothing else there. cli.ts
 * has a 500-line cap and adding the seventh kind was what crossed it; shaving comments to fit would
 * have been the wrong fix twice, since this was always a separate concept sharing a file.
 */
import type { ParsedCanonicalEntity } from "./entities/runtime-schema";

/** Print what is worth knowing about one parsed entity. */
export function printEntitySummary(ent: ParsedCanonicalEntity, log: (line: string) => void): void {
  if (ent.kind === "lorebook") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    type     ${b.lorebookType ?? "(none)"}`);
    log(`    entries  ${b.entries.length}`);
    log(`    budget   ${b.tokenBudget} (${b.budgetMode})\n`);
  } else if (ent.kind === "persona") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    brief    ${b.brief ? `${b.brief.slice(0, 60)}...` : "(none)"}`);
    log(`    content  ${b.content ? `${b.content.length} chars` : "(empty)"}`);
    log(`    sections ${b.sections ? Object.keys(b.sections).join(", ") : "(none)"}\n`);
  } else if (ent.kind === "regex") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    rules    ${b.rules.length}\n`);
  } else if (ent.kind === "preset") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    prompts  ${b.prompts.length}`);
    log(`    groups   ${b.groups?.length ?? 0}`);
    log(`    choices  ${b.choices?.length ?? 0}\n`);
  } else if (ent.kind === "pack") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    assets   ${b.pack.items.length}`);
    log(`    groups   ${Object.keys(b.groups ?? {}).length}\n`);
  } else if (ent.kind === "htmldoc") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    summary  ${b.summary || "(none)"}`);
    log(`    size     ${b.html.length} characters`);
    log(`    tags     ${b.tags?.join(", ") || "(none)"}\n`);
  } else if (ent.kind === "quickreply") {
    const b = ent.body;
    log(`    name     ${b.name || "(unnamed)"}`);
    log(`    replies  ${b.replies.length}`);
    const labels = b.replies.map((r) => r.label || "(icon)").slice(0, 6).join(", ");
    if (labels) log(`    buttons  ${labels}${b.replies.length > 6 ? ", ..." : ""}\n`);
  } else {
    const b = ent.body;
    log(`    name     ${b.identity.name || "(unnamed)"}`);
    const g = b.greetings;
    log(`    greeting ${g.firstMessage ? `${g.firstMessage.slice(0, 60)}...` : "(none)"}`);
    log(`    alts     ${g.alternateGreetings?.length ?? 0}`);
    log(`    tags     ${b.discovery.tags?.join(", ") || "(none)"}\n`);
  }
}
