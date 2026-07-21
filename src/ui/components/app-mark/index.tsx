/**
 * AppMark safely grafts a manifest's untrusted SVG mark into a caller-owned box. The Dock and Apps
 * catalog share this one renderer so third-party marks never gain a second, weaker path to the DOM.
 */
import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { sanitizeSvg } from "../../_shared/sanitize-svg";

export interface AppMarkProps {
  markSvg: string;
  className?: string;
}

/** Render one sanitized application mark. */
export function AppMark({ markSvg, className }: AppMarkProps): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.replaceChildren();
    const svg = sanitizeSvg(markSvg);
    if (svg) box.append(svg);
  }, [markSvg]);
  return <span ref={ref} className={className} />;
}
