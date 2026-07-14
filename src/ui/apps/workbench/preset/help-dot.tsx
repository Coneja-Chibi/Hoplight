/**
 * HelpDot - the small "?" help affordance next to a field label (RC's RichTooltip showHelpButton,
 * reduced to a native-title dot). Hover shows the transcribed field help. Decorative to AT via
 * aria-label; the same text sits in the title attribute for sighted hover.
 */
import type { JSX } from "react";
import { type FieldHelp, helpText } from "./help";
import s from "./sidebar.module.css";

export function HelpDot({ help }: { help: FieldHelp }): JSX.Element {
  const text = helpText(help);
  return (
    <span className={s.help} title={text} aria-label={`${help.title} help`} role="img">
      ?
    </span>
  );
}
