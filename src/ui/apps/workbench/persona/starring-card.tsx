/**
 * StarringCard (P4) - RC's identity block transcribed: portrait slot, big name lives in the
 * SPINE (not here, unlike RC - the binder grammar owns names), tagline, pronouns/height/age row,
 * the labeled palette with the SIGNATURE slot, and the BRIEF with its never-injected honesty
 * line. Portrait upload rides the import/media pipeline for now (deviation, stated on the slot).
 */
import type { JSX } from "react";
import type { PersonaBody } from "../../../../entities/persona/schema";
import { patchBody, patchIdentity, patchSwatch } from "./session";
import { personaStyles as s } from "./persona-styles";

export interface StarringCardProps {
  body: PersonaBody;
  onBody: (fn: (b: PersonaBody) => PersonaBody) => void;
  portraitUrl: string | null;
  monogram: string;
}

const FOG_HEX = "#8a8496"; // hardcode-ok: color inputs take literal hex only (deck-fog value)

export function StarringCard({ body, onBody, portraitUrl, monogram }: StarringCardProps): JSX.Element {
  const id = body.identity ?? {};
  const colors = body.presentation?.colors ?? [];
  const sig = body.presentation?.signatureColor;

  return (
    <div className={s.star}>
      <div
        className={s.avatar}
        style={portraitUrl ? { backgroundImage: `url("${portraitUrl}")` } : undefined}
        title="The portrait rides import for now; in-editor upload lands with the media slice"
      >
        {!portraitUrl && <span>{monogram}<br />portrait via import</span>}
      </div>
      <div className={s.starBody}>
        <div className={s.starKick}>&#10022; Starring &#10022;</div>
        <input
          className={s.starTag}
          value={id.tagline ?? ""}
          placeholder="A brief tagline..."
          aria-label="Tagline"
          onChange={(e) => onBody((b) => patchIdentity(b, { tagline: e.target.value }))}
        />
        <div className={s.idRow}>
          <input
            className={s.idIn}
            value={id.pronouns ?? ""}
            placeholder="pronouns"
            aria-label="Pronouns"
            onChange={(e) => onBody((b) => patchIdentity(b, { pronouns: e.target.value }))}
          />
          <input
            className={s.idIn}
            value={id.height ?? ""}
            placeholder="height"
            aria-label="Height"
            onChange={(e) => onBody((b) => patchIdentity(b, { height: e.target.value }))}
          />
          <input
            className={s.idIn}
            value={id.age ?? ""}
            placeholder="age"
            aria-label="Age"
            onChange={(e) => onBody((b) => patchIdentity(b, { age: e.target.value }))}
          />
        </div>

        <div className={`${s.pal}`} style={{ justifyContent: "center", marginTop: "0.6rem" }}>
          <span className={s.sw} title="The signature color themes this persona's cards">
            <input
              type="color"
              className={s.dot}
              value={sig || FOG_HEX}
              aria-label="Signature color"
              onChange={(e) =>
                onBody((b) => ({
                  ...b,
                  presentation: { ...(b.presentation ?? {}), signatureColor: e.target.value },
                }))
              }
            />
            <span className={`${s.swLabel} ${s.swSig}`} style={{ border: 0 }}>Signature</span>
          </span>
          {colors.map((c, i) => (
            <span className={s.sw} key={i}>
              <input
                type="color"
                className={s.dot}
                value={c.hex}
                aria-label={`${c.label ?? "color"} swatch`}
                onChange={(e) => onBody((b) => patchSwatch(b, i, { ...c, hex: e.target.value }))}
              />
              <input
                className={s.swName}
                value={c.name ?? ""}
                placeholder="name"
                aria-label="Color name"
                onChange={(e) => onBody((b) => patchSwatch(b, i, { ...c, name: e.target.value }))}
              />
              <input
                className={s.swLabel}
                value={c.label ?? ""}
                placeholder="label"
                aria-label="Color label"
                onChange={(e) => onBody((b) => patchSwatch(b, i, { ...c, label: e.target.value }))}
              />
            </span>
          ))}
          <button
            type="button"
            className={s.sw}
            title="Add a labeled color"
            onClick={() => onBody((b) => patchSwatch(b, colors.length, { label: "", name: "", hex: FOG_HEX }))}
          >
            <span className={`${s.dot} ${s.dotAdd}`}>+</span>
            <span className={s.swLabel} style={{ border: 0 }}>Add</span>
          </button>
        </div>

        <div className={s.brief}>
          <textarea
            className={s.briefTa}
            value={body.brief ?? ""}
            placeholder="Library card blurb..."
            aria-label="Brief (library blurb)"
            onChange={(e) => onBody((b) => patchBody(b, { brief: e.target.value }))}
          />
          <span className={s.honest}>the blurb stays on the shelf · never sent to the model</span>
        </div>
      </div>
    </div>
  );
}
