/**
 * ExpressionStage - sealed local match: sample text -> pack face. No network.
 */
import { useMemo, useState, type JSX } from "react";
import {
  matchExpression,
  normalizePack,
  resolvePackFace,
  type ExpressionProfile,
  type SpritePackValue,
} from "../../../core/media";
import styles from "./styles.module.css";

export interface ExpressionStageProps {
  pack: SpritePackValue;
  profile?: ExpressionProfile;
}

const MOODS = ["neutral", "happy", "sad", "angry", "surprised"] as const;

export function ExpressionStage({ pack, profile }: ExpressionStageProps): JSX.Element {
  const p = normalizePack(pack);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<string | null>(null);

  const hitLabel = useMemo(() => {
    if (mood) {
      const face = resolvePackFace(p, mood);
      return face?.label ?? matchExpression(mood, p, profile);
    }
    return matchExpression(text, p, profile);
  }, [text, mood, p, profile]);

  const face = resolvePackFace(p, hitLabel);

  return (
    <div className={styles.wrap}>
      <span className={styles.seal}>Sealed · local match · no network</span>
      <div className={styles.row}>
        <div className={styles.face}>
          {face?.ref ? (
            <img src={face.ref} alt={face.label} />
          ) : (
            <span>{hitLabel || "—"}</span>
          )}
          {face ? <span>{face.label}</span> : null}
        </div>
        <div>
          <div className={styles.moods}>
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.mood}${mood === m ? ` ${styles.moodOn}` : ""}`}
                onClick={() => {
                  setMood(m);
                  setText("");
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            className={styles.ta}
            placeholder="Sample character line…"
            value={text}
            onChange={(e) => {
              setMood(null);
              setText(e.target.value);
            }}
          />
          <div className={styles.hit}>
            Match → <b>{hitLabel ?? "none"}</b>
            {profile ? ` · ${profile.label}` : ""} · keyword
          </div>
        </div>
      </div>
    </div>
  );
}
