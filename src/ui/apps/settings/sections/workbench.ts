/**
 * Settings section: Workbench - the follow behavior for "sent to the Workbench". The follow
 * dialog's "Never ask me this again" checkbox maps to the ask/always/never choice here.
 */
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { row, segControl, type SettingsSection } from "../section-contract";

const section: SettingsSection = {
  id: "workbench",
  label: "Workbench",
  order: 30,
  render(ctx, host) {
    const follow = ctx.prefs.get(SETTING_KEYS.workbenchFollow);
    host.append(
      row(
        "After sending a piece",
        "Follow it to the Workbench, stay where you are, or ask every time.",
        segControl(
          [
            { value: "ask", label: "Ask me" },
            { value: "always", label: "Always follow" },
            { value: "never", label: "Stay" },
          ],
          follow === "always" || follow === "never" ? (follow as string) : "ask",
          (v) => {
            ctx.prefs.set(SETTING_KEYS.workbenchFollow, v);
            host.replaceChildren();
            void section.render(ctx, host);
          },
        ),
      ),
    );
  },
};

export default section;
