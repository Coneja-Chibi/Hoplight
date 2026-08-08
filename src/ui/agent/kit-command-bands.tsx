/**
 * What a slash command drew: a listing, a diagnostic, or a picture.
 *
 * THREE WIDGETS FOR NINE COMMANDS, and that is on purpose. `/help`, `/tools`, `/session` and the
 * rewind picker are all "a titled band of rows, some of which you can choose"; building four
 * components for one shape is how a rendering layer drifts, because somebody fixes the keyboard
 * handling in one of them. `/image`, `/art` and `/gallery` are all "a picture, or a shelf of them".
 * The doctor gets its own, because a status is a colour and a wall of text is exactly what it must
 * not be.
 *
 * KIT'S GRAMMAR THROUGHOUT: a band with a spine, a dim uppercase header, a bright key beside a muted
 * label. Every colour is a `--kit-*` variable, so this cannot drift from the terminal's palette.
 */
import type { JSX } from "react";
import type { DoctorRow, KitWidget, WidgetRow } from "./command-core";

/**
 * The ink a status wears, from Kit's palette by MEANING rather than by mood: alive for a pass, gold
 * for the one worth reading, red for the one that is broken. Kit has no `--kit-ok` token, and
 * inventing one here would be a fourth colour authority in a file whose whole point is not being one.
 */
const STATUS_INK: Record<DoctorRow["status"], string> = {
  ok: "var(--kit-alive)",
  warn: "var(--kit-gold)",
  fail: "var(--kit-red)",
};

/**
 * A listing. Rows that DO something are buttons; rows that only say something are not.
 *
 * The difference is visible before it is clicked, because a row that looks pressable and is not is
 * a worse affordance than no affordance: `/tools` lists capabilities the model reaches, and none of
 * them is a thing a person can run from here.
 */
function Rows({
  title,
  rows,
  hint,
  onSend,
  onRewind,
}: {
  title: string;
  rows: readonly WidgetRow[];
  hint?: string;
  onSend: (line: string) => void;
  onRewind: (keep: number) => void;
}): JSX.Element {
  return (
    <div className="kit-list">
      <div className="kit-list__head">{title}</div>
      <div className="kit-list__rows">
        {rows.map((row, at) => {
          const label = <span className="kit-list__key">{row.label}</span>;
          const note = row.note === undefined ? null : <span className="kit-list__note">{row.note}</span>;
          const act = row.send !== undefined
            ? (): void => { onSend(row.send!); }
            : row.keep !== undefined
              ? (): void => { onRewind(row.keep!); }
              : null;
          const key = `${row.label}${String(at)}`;
          return act === null
            ? <div key={key} className="kit-list__row">{label}{note}</div>
            : (
              <button key={key} type="button" className="kit-list__row kit-list__row--act" onClick={act}>
                {label}{note}
              </button>
            );
        })}
      </div>
      {hint !== undefined && <p className="kit-list__hint">{hint}</p>}
    </div>
  );
}

/** The diagnostic playbill: one row per check, its status carried in ink rather than in a word. */
function Doctor({ rows }: { rows: readonly DoctorRow[] }): JSX.Element {
  return (
    <div className="kit-doctor">
      <div className="kit-list__head">{"DOCTOR"}</div>
      {rows.length === 0 && <p className="kit-list__hint">{"No checks are wired in this build."}</p>}
      {rows.map((row, at) => (
        <div key={`${row.label}${String(at)}`} className="kit-doctor__row" style={{ borderLeftColor: STATUS_INK[row.status] }}>
          <span className="kit-doctor__mark" style={{ color: STATUS_INK[row.status] }}>{row.status}</span>
          <span className="kit-list__key">{row.label}</span>
          <span className="kit-list__note">{row.detail}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A picture, or a shelf of them.
 *
 * `data:` URLs, which is the only image source the window's CSP allows and therefore the only one a
 * malformed payload could ever have been. The parse at the boundary already refused anything else;
 * this draws what survived.
 */
function Pictures({ title, images }: { title: string; images: KitWidget & { kind: "images" } }): JSX.Element {
  return (
    <div className="kit-shelf">
      <div className="kit-list__head">{title}</div>
      <div className="kit-shelf__strip">
        {images.images.map((image, at) => (
          <figure key={`${image.src.slice(-24)}${String(at)}`} className="kit-shelf__frame">
            {/* No alt beyond the caption: this is a picture of somebody's own file, and inventing a
                description of it would be the window claiming to have looked. */}
            <img src={image.src} alt={image.caption ?? "picture"} />
            {image.caption !== undefined && <figcaption>{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Draw whatever this line carried. */
export function KitCommandBand({
  title,
  widget,
  onSend,
  onRewind,
}: {
  title: string;
  widget: KitWidget;
  onSend: (line: string) => void;
  onRewind: (keep: number) => void;
}): JSX.Element {
  if (widget.kind === "doctor") return <Doctor rows={widget.rows} />;
  if (widget.kind === "images") return <Pictures title={title} images={widget} />;
  return (
    <Rows
      title={title}
      rows={widget.rows}
      {...(widget.hint === undefined ? {} : { hint: widget.hint })}
      onSend={onSend}
      onRewind={onRewind}
    />
  );
}
