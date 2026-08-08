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
type Layout = "bento" | "playbill";
type Mode = "grid" | "interview";
/** SegControl is generic over strings, so an on/off reads as one rather than widening the control. */
type OnOff = "on" | "off";

// the editor's own preference keys (mirror PREF_EDITOR_LAYOUT / PREF_EDITOR_MODE in the editor); the
// editor seeds from these on open, so a change here lands the next time a character is opened. Their
// header toggles retire once the workbench tour has taught them - this is their permanent home.
const PREF_LAYOUT = "editor.layout";
const PREF_MODE = "editor.mode";

/**
 * Autosave, and remembering what was open.
 *
 * Both live in prefs rather than as new settings fields, so they persist into the studio own
 * settings record and travel with the studio rather than the machine.
 */
const PREF_AUTOSAVE = "workbench.autosave";
const PREF_RESTORE = "workbench.restoreSession";

function WorkbenchSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [follow, setFollow] = useState<Follow>(() => {
    const f = ctx.prefs.get(SETTING_KEYS.workbenchFollow);
    return f === "always" || f === "never" ? f : "ask";
  });
  const [layout, setLayout] = useState<Layout>(() => (ctx.prefs.get(PREF_LAYOUT) === "playbill" ? "playbill" : "bento"));
  const [mode, setMode] = useState<Mode>(() => (ctx.prefs.get(PREF_MODE) === "grid" ? "grid" : "interview"));
  const [autosave, setAutosave] = useState(() => ctx.prefs.get(PREF_AUTOSAVE) === true);
  const [restore, setRestore] = useState(() => ctx.prefs.get(PREF_RESTORE) === true);

  return (
    <>
      {/*
        AUTOSAVE FIRST, because it is the one that changes what happens to your work rather than
        how it looks. Off by default: a setting that writes to somebody's files on a timer is not
        one to switch on for them.
      */}
      <SettingsRow
        label="Autosave"
        hint="Save half a second after you stop typing. Ctrl+S still works, and still saves at once."
      >
        <SegControl<OnOff>
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
          current={autosave ? "on" : "off"}
          onPick={(v) => {
            ctx.prefs.set(PREF_AUTOSAVE, v === "on");
            setAutosave(v === "on");
          }}
        />
      </SettingsRow>
      <SettingsRow
        label="Reopen where you left off"
        hint="Restore the pieces you had open, and which one you were editing, after a restart or a crash."
      >
        <SegControl<OnOff>
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
          current={restore ? "on" : "off"}
          onPick={(v) => {
            ctx.prefs.set(PREF_RESTORE, v === "on");
            setRestore(v === "on");
          }}
        />
      </SettingsRow>
      <SettingsRow label="Editor layout" hint="Bento shows every field at once; Playbill turns them into acts you page through.">
        <SegControl<Layout>
          options={[
            { value: "bento", label: "Bento" },
            { value: "playbill", label: "Playbill" },
          ]}
          current={layout}
          onPick={(v) => {
            ctx.prefs.set(PREF_LAYOUT, v);
            setLayout(v);
          }}
        />
      </SettingsRow>
      <SettingsRow label="How you fill it in" hint="Grid shows every field to edit directly; Steps walks you through like a quiz.">
        <SegControl<Mode>
          options={[
            { value: "grid", label: "Grid" },
            { value: "interview", label: "Steps" },
          ]}
          current={mode}
          onPick={(v) => {
            ctx.prefs.set(PREF_MODE, v);
            setMode(v);
          }}
        />
      </SettingsRow>
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
    </>
  );
}

const section: SettingsSection = {
  id: "workbench",
  label: "Workbench",
  order: 30,
  Component: WorkbenchSection,
};

export default section;
