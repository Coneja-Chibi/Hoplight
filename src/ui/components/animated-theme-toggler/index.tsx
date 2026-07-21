/**
 * AnimatedThemeToggler adapts Magic UI's circular View Transition reveal to Vaude's controlled
 * paper/stage theme store and existing Stamp control. Unsupported browsers and reduced-motion users
 * get the same immediate theme switch without animation.
 * Source inspiration: https://magicui.design/docs/components/animated-theme-toggler (MIT).
 */
import { Moon, Sun } from "lucide-react";
import { useCallback, useRef } from "react";
import type { JSX } from "react";
import { flushSync } from "react-dom";
import { Stamp } from "../stamp";
import { circleTransitionClipPaths, transitionOrigin } from "./transition-core";
import styles from "./styles.module.css";

interface ThemeViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
}

type ThemeDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeViewTransition;
};

export interface AnimatedThemeTogglerProps {
  theme: "paper" | "stage";
  onToggle: () => void;
  duration?: number;
  fromCenter?: boolean;
  id?: string;
}

/** Switch between paper and stage with a reveal that grows from the control. */
export function AnimatedThemeToggler({
  theme,
  onToggle,
  duration = 400,
  fromCenter = false,
  id,
}: AnimatedThemeTogglerProps): JSX.Element {
  const transitioning = useRef(false);
  const isDark = theme === "stage";

  const toggle = useCallback(
    (button: HTMLButtonElement): void => {
      const root = document.documentElement;
      const viewDocument = document as ThemeDocument;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      if (!viewDocument.startViewTransition || reduceMotion) {
        onToggle();
        return;
      }
      if (transitioning.current || root.dataset.vaudeThemeTransition === "active") return;

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = button.getBoundingClientRect();
      const origin = transitionOrigin(rect, viewport, fromCenter);
      const clipPath = circleTransitionClipPaths(origin, viewport);

      transitioning.current = true;
      root.dataset.vaudeThemeTransition = "active";
      root.style.setProperty("--vaude-theme-transition-duration", `${duration}ms`);
      root.style.setProperty("--vaude-theme-transition-clip-from", clipPath[0]);

      const cleanup = (): void => {
        transitioning.current = false;
        delete root.dataset.vaudeThemeTransition;
        root.style.removeProperty("--vaude-theme-transition-duration");
        root.style.removeProperty("--vaude-theme-transition-clip-from");
      };

      let transition: ThemeViewTransition;
      try {
        transition = viewDocument.startViewTransition(() => flushSync(onToggle));
      } catch {
        cleanup();
        onToggle();
        return;
      }

      void transition.finished.then(cleanup, cleanup);
      void transition.ready.then(
        () => {
          root.animate(
            { clipPath },
            {
              duration,
              easing: "ease-in-out",
              fill: "forwards",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        },
        () => undefined,
      );
    },
    [duration, fromCenter, onToggle],
  );

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <Stamp id={id} onClick={(event) => toggle(event.currentTarget)} title={label} aria-label={label}>
      <span className={styles.iconStack} aria-hidden="true">
        <Moon className={isDark ? styles.hidden : styles.shown} size={17} strokeWidth={2.1} />
        <Sun className={isDark ? styles.shown : styles.hidden} size={17} strokeWidth={2.1} />
      </span>
    </Stamp>
  );
}
