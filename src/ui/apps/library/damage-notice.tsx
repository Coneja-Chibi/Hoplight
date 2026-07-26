/**
 * Library-local notice for studio JSON files that failed closed during canonical decoding.
 */
import type { JSX } from "react";
import type { StudioDamagedEntry } from "../../app-contract";

const reasonText = (reason: StudioDamagedEntry["reason"]): string => {
  switch (reason) {
    case "unreadable-json": return "is not readable JSON";
    case "schema-mismatch": return "does not match this Hoplight data version";
    case "kind-mismatch": return "contains a different content type";
    case "id-mismatch": return "contains a different piece id";
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
