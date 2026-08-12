/**
 * Settings > Studio: the engine checkouts on this machine.
 *
 * WHY IT IS HERE AT ALL. Rendering a macro through SillyTavern's or Marinara's own engine needs a
 * copy of that engine on disk, and the only way to say where it lived was an environment variable
 * named in a refusal message. That is an interface for whoever launches programs from a terminal
 * and nobody else. A folder is the thing a person has; this takes the folder.
 *
 * THE SAME FOLDER KIT USES. Both read engines.json from the studio, so pointing at a checkout here
 * is what makes preset_verify offer itself in the terminal. One place, like the model vault.
 *
 * NOT ctx.prefs, which every other control in this room uses. A checkout path is an absolute path
 * on the host's disk, and settings are readable by a device tailed into this studio while these
 * routes are host-only whole. It rides its own surface for that reason - see engine-roots.ts.
 *
 * NO BROWSE BUTTON, because there is no honest one: a browser directory picker hands back relative
 * names, never the absolute path the spawn needs. Paste the path, press Save, and the answer comes
 * from looking for the engine's own file inside it.
 */
import { useCallback, useEffect, useState, type JSX } from "react";
import { apiFetchJson } from "../../../_shared/api-fetch";
import { SettingsRow } from "../section-contract";
import { engineState, type EngineRow } from "./engines-core";
import styles from "./engines.module.css";

/** One row per engine Hoplight can drive: where its checkout is, and whether one answered. */
export function EngineRoots(): JSX.Element {
  const [rows, setRows] = useState<EngineRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<Record<string, string>>({});

  const take = useCallback((next: EngineRow[]): void => {
    setRows(next);
    // The field follows the saved value, never the resolved one: showing a variable's path in an
    // editable box would invite somebody to "fix" a value this screen does not own.
    setDraft(Object.fromEntries(next.map((r) => [r.id, r.saved])));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const reply = await apiFetchJson<{ engines: EngineRow[] }>("/api/macro-lab/roots");
        take(reply.engines);
      } catch {
        // A studio with no macro-lab surface (an older build behind a newer window) simply has no
        // rows to show. Nothing here is worth an error banner over the rest of Settings.
        take([]);
      }
    })();
  }, [take]);

  const save = async (row: EngineRow, root: string): Promise<void> => {
    setBusy(row.id);
    setSaid((prior) => ({ ...prior, [row.id]: "" }));
    try {
      const reply = await apiFetchJson<{ engines: EngineRow[] }>("/api/macro-lab/roots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engine: row.id, root }),
      });
      take(reply.engines);
      setSaid((prior) => ({ ...prior, [row.id]: root ? "saved" : "cleared" }));
    } catch (error) {
      setSaid((prior) => ({
        ...prior,
        [row.id]: error instanceof Error ? error.message : "could not save that folder",
      }));
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return <></>;

  return (
    <>
      {rows.map((row) => {
        const { note, ok, locked } = engineState(row);
        return (
          <SettingsRow
            key={row.id}
            label={row.label}
            hint={
              locked
                ? `Set by ${row.rootVar} for this run, so the folder below is not being used. `
                  + "Unset the variable to go back to the saved one."
                : `The folder holding ${row.install}. Kit uses it too.`
            }
          >
            <div className={styles.field}>
              <input
                className={styles.path}
                value={draft[row.id] ?? ""}
                spellCheck={false}
                disabled={locked || busy !== null}
                placeholder="paste the folder's path"
                aria-label={`${row.label} folder`}
                onChange={(e) => { setDraft((prior) => ({ ...prior, [row.id]: e.target.value })); }}
              />
              {/*
                EVERY row's buttons wait on ANY save, not just this row's. The file holds both
                engines and a save is read-modify-write, so two in flight would each read the state
                before the other wrote and the second would drop the first engine's folder.
                engine-roots.ts serializes the write as well, because a second tab cannot see this.
              */}
              <div className={styles.acts}>
                <button
                  type="button"
                  disabled={locked || busy !== null}
                  onClick={() => { void save(row, draft[row.id] ?? ""); }}
                >
                  {"Save"}
                </button>
                {row.saved !== "" && (
                  <button
                    type="button"
                    disabled={locked || busy !== null}
                    onClick={() => { void save(row, ""); }}
                  >
                    {"Clear"}
                  </button>
                )}
              </div>
              <p className={ok ? styles.good : styles.note}>{note}</p>
              {/* The variable's own path, so "not being used" names what IS. */}
              {locked && <p className={styles.said}>{row.env}</p>}
              {said[row.id] && <p className={styles.said}>{said[row.id]}</p>}
            </div>
          </SettingsRow>
        );
      })}
    </>
  );
}
