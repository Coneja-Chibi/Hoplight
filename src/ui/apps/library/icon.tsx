/**
 * A first-party icon constant, parsed into a live SVG node.
 *
 * NEVER innerHTML - the house rule. These strings are ours, not authored content, but the rule is
 * kept whole so there is no innerHTML in the codebase to copy from.
 */
import { useEffect, useRef, type JSX } from "react";

export function Icon({ svg }: { svg: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.replaceChildren();
    box.append(document.importNode(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement, true));
  }, [svg]);
  return <span ref={ref} className="ico" />;
}
