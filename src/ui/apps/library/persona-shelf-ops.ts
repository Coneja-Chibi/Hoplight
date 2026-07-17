/**
 * Persona shelf ops + meta loader (P4, the regex-shelf-ops pattern): the Library reads each
 * persona body once per listing to compute the card facts (brief, pronouns, section count,
 * lorebook chip). The default persona is the "persona.default" studio pref.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PersonaBody } from "../../../entities/persona/schema";
import type { DeckViewContext } from "./view-contract";
import { createAndOpenPersona } from "./new-persona";

export type PersonaMeta = {
  brief?: string;
  pronouns?: string;
  sectionCount: number;
  hasLorebook: boolean;
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export async function loadPersonaMeta(
  ctx: AppContext,
  list: readonly StudioEntitySummary[],
): Promise<Record<string, PersonaMeta>> {
  const personas = list.filter((e) => e.kind === "persona");
  const next: Record<string, PersonaMeta> = {};
  for (const p of personas) {
    try {
      const raw = await ctx.api.getEntity(`kind=persona&id=${encodeURIComponent(p.id)}`);
      const body = isRec(raw) && isRec(raw.body) ? (raw.body as unknown as PersonaBody) : null;
      if (!body) continue;
      const pronouns =
        body.identity?.pronouns ??
        (body.identity?.pronounSet
          ? `${body.identity.pronounSet.subjective}/${body.identity.pronounSet.objective}`
          : undefined);
      next[p.id] = {
        brief: body.brief?.trim() || undefined,
        pronouns,
        sectionCount: Object.values(body.sections ?? {}).filter(
          (s) => typeof s === "string" && s.trim() !== "",
        ).length,
        hasLorebook: (body.knowledgeRefs ?? []).length > 0,
      };
    } catch {
      /* skip unreadable */
    }
  }
  return next;
}

export function makePersonaShelf(args: {
  ctx: AppContext;
  personaMeta: Record<string, PersonaMeta>;
  setEntities: (fn: (prev: StudioEntitySummary[]) => StudioEntitySummary[]) => void;
}): NonNullable<DeckViewContext["personaShelf"]> {
  const { ctx, personaMeta, setEntities } = args;
  return {
    briefOf: (e) => personaMeta[e.id]?.brief,
    pronounsOf: (e) => personaMeta[e.id]?.pronouns,
    sectionCountOf: (e) => personaMeta[e.id]?.sectionCount,
    hasLorebookOf: (e) => personaMeta[e.id]?.hasLorebook ?? false,
    defaultId: String(ctx.prefs.get("persona.default") ?? ""),
    onNew: () => {
      void (async () => {
        try {
          const summary = await createAndOpenPersona(ctx);
          setEntities((prev) =>
            prev.some((e) => e.kind === "persona" && e.id === summary.id) ? prev : [...prev, summary],
          );
          ctx.workbench.send(summary);
          ctx.setStatus(`opened persona · ${summary.name}`);
        } catch (err) {
          ctx.setStatus(err instanceof Error ? err.message : "could not create the persona");
        }
      })();
    },
  };
}
