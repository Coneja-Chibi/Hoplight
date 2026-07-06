/**
 * IconBox - a bordered square housing a parsed SVG mark (transcribed from src/ui/index.html's
 * .apptile .mk rule: 2rem square, 3px ink border, centered 18px mark). Renders TRUSTED, first-party
 * static SVG markup only (never a drop-in/user-supplied string - that path is boot.ts's
 * sanitizeSvg). The gate bans innerHTML/dangerouslySetInnerHTML, so the markup is parsed with
 * DOMParser and grafted in via document.importNode, the same primitive the vanilla dock tile uses.
 */
import { useEffect, useRef } from "react";
import type { JSX } from "react";
import styles from "./styles.module.css";

export interface IconBoxProps {
  /** trusted, first-party static SVG markup (never user-supplied/drop-in content) */
  svg: string;
  /** box side length in rem (defaults to the dock tile's 2rem mark box) */
  size?: number;
}

/** A bordered square that parses and mounts a static SVG mark. */
export function IconBox({ svg, size = 2 }: IconBoxProps): JSX.Element {
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.replaceChildren();
    const withNs = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const doc = new DOMParser().parseFromString(withNs, "image/svg+xml");
    const root = doc.documentElement;
    if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return; // fail closed
    box.append(document.importNode(root, true));
  }, [svg]);

  return (
    <span ref={boxRef} className={styles.box} style={{ width: `${size}rem`, height: `${size}rem` }} aria-hidden="true" />
  );
}
