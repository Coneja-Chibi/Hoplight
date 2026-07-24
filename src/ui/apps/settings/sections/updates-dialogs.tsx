/**
 * The version-switch modals: confirm (before a switch), progress (while it runs), and the post-restart
 * result popup. Presentational only, all state + orchestration lives in updates.tsx. The result popup is
 * honest per the safety review: a rollback to a version older than this feature warns that there is no
 * "done" popup afterward (that old code has none), so the confirm screen is the receipt.
 */
import type { JSX } from "react";
import { isFeatureAware } from "../../../_shared/switch-decision";
import type { SwitchOutcome } from "../../../_shared/pending-switch";
import styles from "./updates.module.css";

function Modal({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <div className={styles.overlay}>
      <div className={styles.popup}>{children}</div>
    </div>
  );
}

const CheckIcon = (): JSX.Element => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const XIcon = (): JSX.Element => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

/** Confirm a switch. Rollbacks read as danger; a rollback to a pre-feature version says so plainly. */
export function ConfirmSwitch({
  installed,
  target,
  kind,
  onConfirm,
  onCancel,
}: {
  installed: string;
  target: string;
  kind: "update" | "rollback";
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  const rollback = kind === "rollback";
  const noPopupAfter = rollback && !isFeatureAware(target);
  return (
    <Modal>
      <>
        <div className={styles.cardTitle}>{rollback ? `Roll back to ${target}?` : `Update to ${target}?`}</div>
        <div className={styles.jump}>
          {installed} <span className={styles.arrow}>&rarr;</span> {target}
        </div>
        {noPopupAfter && (
          <div className={styles.warnNote}>
            {target} is older than this Updates screen. After the restart it will not show a confirmation or
            an Undo button, so <b>this screen is your receipt</b>.
          </div>
        )}
        <div className={styles.cardBody}>
          Your studio folder (pieces, settings, keys) is never touched, only the program changes. Hoplight
          restarts itself when it is ready.
        </div>
        <div className={styles.actions}>
          <button type="button" className={rollback ? `${styles.btn} ${styles.btnDanger}` : styles.btn} onClick={onConfirm}>
            {rollback ? "Roll back" : "Update"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </>
    </Modal>
  );
}

/** Progress while a switch runs (the manager's status message). */
export function SwitchProgress({ message }: { message: string }): JSX.Element {
  return (
    <Modal>
      <>
        <div className={styles.cardTitle}>Switching version</div>
        <span className={styles.status}>
          <span className={`${styles.dot} ${styles.busy}`} />
          {message || "Working..."}
        </span>
        <div className={styles.cardBody}>Do not close Hoplight. It restarts itself when the switch is ready.</div>
      </>
    </Modal>
  );
}

/** The post-restart popup, from the pending-switch marker. Undo (back to where you came from) on success. */
export function SwitchResult({
  outcome,
  onDone,
  onUndo,
}: {
  outcome: SwitchOutcome;
  onDone: () => void;
  onUndo: (from: string) => void;
}): JSX.Element | null {
  if (outcome.kind === "success") {
    return (
      <Modal>
        <>
          <div className={`${styles.badge} ${styles.badgeOk}`}>
            <CheckIcon />
          </div>
          <div className={styles.big}>You are now on {outcome.to}</div>
          <div className={styles.sub}>Done. Everything is ready.</div>
          <div className={styles.actionsCenter}>
            <button type="button" className={styles.btn} onClick={onDone}>
              Done
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => onUndo(outcome.from)}>
              Undo, back to {outcome.from}
            </button>
          </div>
        </>
      </Modal>
    );
  }
  if (outcome.kind === "failed") {
    return (
      <Modal>
        <>
          <div className={`${styles.badge} ${styles.badgeBad}`}>
            <XIcon />
          </div>
          <div className={styles.big}>Still on {outcome.from}</div>
          <div className={styles.sub}>
            The switch to {outcome.to} did not complete, so nothing changed. Your app is exactly as it was.
          </div>
          <div className={styles.actionsCenter}>
            <button type="button" className={styles.btn} onClick={onDone}>
              OK
            </button>
          </div>
        </>
      </Modal>
    );
  }
  return null;
}
