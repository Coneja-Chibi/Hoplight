/**
 * PresetEditor mount point (PRESET-JEWEL-PLAN.md P1 stub; P4 replaces the body with the hybrid
 * editor per design/vs-preset-hybrid.html). Loads the entity, shows the honest floor (name, block
 * count, group count, choice-walkthrough count); no save here - the plumbing is what's proven.
 */
import { useMemo, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PresetBody } from "../../../entities/preset";

export interface PresetEditorProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): PresetBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as PresetBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.prompts)) return b;
  return { name: "Untitled preset", prompts: [] };
}

export function PresetEditor({ entity, topRight }: PresetEditorProps): JSX.Element {
  const body = useMemo(() => bodyFromEntity(entity), [entity]);
  const blockCount = body.prompts.length;
  const enabledCount = body.prompts.filter((p) => p.enabled).length;
  const groupCount = body.groups?.length ?? 0;
  const choiceCount = body.choices?.length ?? 0;

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
        Preset
      </p>
      <h2 style={{ color: "var(--stage-card)", fontFamily: "var(--font-big)", margin: "0.2rem 0" }}>
        {body.name || "Untitled preset"}
      </h2>
      <p>
        {blockCount === 0
          ? "No prompt blocks yet."
          : `${blockCount} prompt block${blockCount === 1 ? "" : "s"} · ${enabledCount} enabled.`}{" "}
        {groupCount > 0 ? `${groupCount} group${groupCount === 1 ? "" : "s"}.` : ""}{" "}
        {choiceCount > 0 ? `${choiceCount} choice${choiceCount === 1 ? "" : "s"} in the walkthrough.` : ""}
      </p>
      <p style={{ color: "var(--stage-text-dim)" }}>
        The full preset editor lands with the next slice; this view proves the plumbing.
      </p>
    </div>
  );
}
