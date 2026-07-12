/**
 * PersonaEditor mount point (PERSONA-JEWEL-PLAN.md P1 stub; P4 replaces the body with the
 * RC-port editor). Loads the entity, shows the honest floor (name, brief-vs-content state,
 * section count); save is a no-op here - shown honestly, never faked.
 */
import { useMemo, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PersonaBody } from "../../../entities/persona/schema";

export interface PersonaEditorProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): PersonaBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as PersonaBody) : null;
  if (b && typeof b.name === "string" && typeof b.content === "string") return b;
  return { name: "Untitled persona", content: "" };
}

export function PersonaEditor({ entity, topRight }: PersonaEditorProps): JSX.Element {
  const body = useMemo(() => bodyFromEntity(entity), [entity]);
  const sectionCount = Object.values(body.sections ?? {}).filter(
    (s) => typeof s === "string" && s.trim() !== "",
  ).length;

  return (
    <div style={{ padding: "1.2rem", color: "var(--stage-soft)", fontFamily: "var(--font-body)" }}>
      {topRight}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.62rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--stage-kicker)",
        }}
      >
        Persona
      </p>
      <h2 style={{ color: "var(--stage-card)", fontFamily: "var(--font-big)", margin: "0.2rem 0" }}>
        {body.name || "Untitled persona"}
      </h2>
      <p>
        {body.content.trim() === ""
          ? "No identity text yet."
          : `${body.content.length} characters of identity text.`}{" "}
        {sectionCount > 0 ? `${sectionCount} structured section${sectionCount === 1 ? "" : "s"}.` : ""}
      </p>
      <p style={{ color: "var(--stage-text-dim)" }}>
        The full persona editor lands with the next slice; this view proves the plumbing.
      </p>
    </div>
  );
}
