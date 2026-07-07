/**
 * TourGuide - the one shared tutorial engine (the imperative shell over tour-core). Renders a docked
 * rail beside the live app and lights up the piece each step points at, so a tour teaches by pointing
 * at the real thing without blocking it. It is renderer-specific (the rail); the Tour data it reads
 * is renderer-agnostic, so a different feel later is a new engine over the same tours.
 *
 * Effects live here, not in the core: the DOM highlight (add/remove a global .tourHl class on the
 * step's [data-tour] anchor) and the pref writes (marking the tour seen, and any inline choice). All
 * sequencing math is delegated to tour-core. Tolerant: a step whose anchor is not in the DOM simply
 * shows without a highlight - never a crash.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Tour } from "../../tours/tour-contract";
import { nextIndex, positionAt, prevIndex, tourSeenKey } from "../../tours/tour-core";
import { MonoTag } from "../mono-tag";
import styles from "./styles.module.css";

/** global (un-hashed) class the engine toggles on the anchored element; styled via :global below */
const HL_CLASS = "tourHl";

export interface TourGuideProps {
  tour: Tour;
  ctx: AppContext;
  /** the shell unmounts the rail; called on finish or skip */
  onClose(): void;
}

export function TourGuide({ tour, ctx, onClose }: TourGuideProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const pos = positionAt(tour, index);
  const anchor = pos.step?.anchor;

  // highlight the current step's anchor and bring it into view; clean up on step change / unmount
  useEffect(() => {
    if (!anchor) return;
    const el = document.querySelector(`[data-tour="${anchor}"]`);
    if (!el) return; // tolerant: an absent anchor just gets no highlight
    el.classList.add(HL_CLASS);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return () => el.classList.remove(HL_CLASS);
  }, [anchor]);

  const finish = (): void => {
    ctx.prefs.set(tourSeenKey(tour.manifest.appId), true);
    onClose();
  };

  const step = pos.step;
  if (!step) return <></>; // empty tour: the shell guards with isRunnable; this is belt-and-braces

  return (
    <aside className={styles.rail} role="dialog" aria-label={`${tour.manifest.title} tour`}>
      <div className={styles.kick}>
        <MonoTag>{tour.manifest.title}</MonoTag>
        <button type="button" className={styles.skip} onClick={finish}>
          skip
        </button>
      </div>

      <div className={styles.dots} aria-hidden="true">
        {tour.steps.map((s, i) => (
          <i key={s.id} className={i < index ? styles.done : i === index ? styles.now : undefined} />
        ))}
      </div>
      <div className={styles.count}>
        {pos.human} of {pos.total}
      </div>

      <h3 className={styles.title}>{step.title}</h3>
      <p className={styles.body}>{step.body}</p>

      {step.choice && (
        <div className={styles.choice}>
          {step.choice.options.map((o) => {
            const on = ctx.prefs.get(step.choice!.prefKey) === o.value;
            return (
              <button
                key={o.value}
                type="button"
                className={on ? `${styles.pick} ${styles.pickOn}` : styles.pick}
                onClick={() => ctx.prefs.set(step.choice!.prefKey, o.value)}
                aria-pressed={on}
              >
                <b>{o.label}</b>
                {o.sub ? <span>{o.sub}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.ctl}>
        <button type="button" className={styles.back} disabled={pos.isFirst} onClick={() => setIndex(prevIndex(index))}>
          back
        </button>
        {pos.isLast ? (
          <button type="button" className={styles.next} onClick={finish}>
            Done
          </button>
        ) : (
          <button type="button" className={styles.next} onClick={() => setIndex(nextIndex(tour, index))}>
            Next
          </button>
        )}
      </div>
    </aside>
  );
}
