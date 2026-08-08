/**
 * Library-local notice for studio JSON files that failed closed during canonical decoding.
 */
import type { JSX } from "react";
import type { StudioDamagedEntry } from "../../app-contract";

/**
 * Why one file did not open, in words that say what to do about it.
 *
 * NO DEFAULT CASE, deliberately. The reason union is the studio's own, imported rather than copied,
 * so a reason nobody has written a sentence for stops the build. It used to be a private list of
 * four beside a union of five, and the missing one printed on screen as the word `undefined`.
 */
const reasonText = (reason: StudioDamagedEntry["reason"]): string => {
  switch (reason) {
    case "unreadable-json": return "is not readable JSON";
    /**
     * Not "damaged". By the time this shows, every format Hoplight ships has been offered the file
     * and declined it - so the honest statement is that nothing here recognises it, which is a fact
     * about Hoplight rather than an accusation about somebody's preset.
     */
    case "schema-mismatch": return "is not in a format Hoplight recognises";
    case "kind-mismatch": return "holds a different kind of piece than this folder is for";
    case "id-mismatch": return "holds a different piece id than its filename";
    case "unusable-filename":
      return "has characters its name cannot keep - rename it without spaces or punctuation";
  }
};

export function DamageNotice(props: {
  entries: readonly StudioDamagedEntry[];
  studioDir?: string;
}): JSX.Element | null {
  if (props.entries.length === 0) return null;
  const count = props.entries.length;
  return (
    <section className="damage-note" role="region" aria-labelledby="damage-note-title">
      <strong id="damage-note-title">
        {`${count} ${count === 1 ? "file" : "files"} in your studio folder could not be read`}
      </strong>
      <p>The files are still on disk and Hoplight did not change them.</p>
      <details>
        <summary>Show files and recovery details</summary>
        <ul>
          {props.entries.map((entry) => (
            <li key={`${entry.kind}:${entry.id}`}>
              <code>{`${entry.kind}/${entry.id}.json`}</code>
              {` ${reasonText(entry.reason)}.`}
            </li>
          ))}
        </ul>
        {props.studioDir && <p><code>{props.studioDir}</code></p>}
        <p>Restore a file from backup, or remove it yourself to clear this notice.</p>
      </details>
    </section>
  );
}
