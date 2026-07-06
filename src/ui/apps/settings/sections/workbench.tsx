/**
 * Settings section: Workbench - the follow behavior for "sent to the Workbench". The follow
 * dialog's "Never ask me this again" checkbox maps to the ask/always/never choice here.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { SegControl, SettingsRow, type SettingsSection } from "../section-contract";

type Follow = "ask" | "always" | "never";

function WorkbenchSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [follow, setFollow] = useState<Follow>(() => {
    const f = ctx.prefs.get(SETTING_KEYS.workbenchFollow);
    return f === "always" || f === "never" ? f : "ask";
  });

  return (
    <SettingsRow label="After sending a piece" hint="Follow it to the Workbench, stay where you are, or ask every time.">
      <SegControl<Follow>
        options={[
          { value: "ask", label: "Ask me" },
          { value: "always", label: "Always follow" },
          { value: "never", label: "Stay" },
        ]}
        current={follow}
        onPick={(v) => {
          ctx.prefs.set(SETTING_KEYS.workbenchFollow, v);
          setFollow(v);
        }}
      />
    </SettingsRow>
  );
}

const section: SettingsSection = {
  id: "workbench",
  label: "Workbench",
  order: 30,
  Component: WorkbenchSection,
};

export default section;
