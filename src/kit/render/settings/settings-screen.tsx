/** @jsxImportSource @opentui/react */
/**
 * Settings screen: the Panel Deck shell. It loads the spokes and the saved vault, routes every
 * keypress through the pure model (reduce), and runs the intents the model returns (close, save,
 * set-active). Clicks are mirrored through the same reduce so keyboard and mouse never diverge. This
 * is imperative-shell only; all navigation logic lives in model.ts.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useKeyboard, usePaste } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { theme } from "../theme";
import { Panel } from "./panel";
import { Rail } from "./rail";
import { ProvidersContent } from "./content-providers";
import { Picker } from "./content-picker";
import { Form } from "./content-form";
import { SettingsFooter } from "./footer";
import { loadChoices } from "./providers-data";
import { applyPaste, initialState, reduce, SECTIONS, type Intent, type SettingsState } from "./model";
import { readVault, saveProvider, setActive } from "../../providers/vault";
import type { ProviderConfig } from "../../providers/config";

const printable = (event: KeyEvent): string | undefined => {
  if (event.ctrl || event.meta || event.option || event.super) return undefined;
  const seq = event.sequence;
  if (typeof seq === "string" && seq.length === 1 && seq >= " " && seq !== "") return seq;
  return undefined;
};

const BLURBS: Record<string, string> = {
  gates: "What Kit asks before it acts. Coming soon.",
  studio: "Where your studio lives on disk. Coming soon.",
  about: "Kit v0.1 · Hoplight Studio.",
};

const contentTitle = (state: SettingsState): string => {
  if (state.mode === "picker") return "Add provider";
  if (state.mode === "form") return state.form?.choice.label ?? "Add provider";
  return state.section;
};

export function SettingsScreen({
  studioName,
  onClose,
  onSaved,
}: {
  studioName: string;
  onClose: () => void;
  onSaved: (config: ProviderConfig) => void;
}): ReactNode {
  const [state, setState] = useState<SettingsState | null>(null);
  const stateRef = useRef<SettingsState | null>(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [choices, vault] = await Promise.all([loadChoices(), readVault()]);
      if (alive) setState(initialState(choices, vault.providers, vault.activeId));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runIntent = async (intent: Intent): Promise<void> => {
    if (intent.kind === "close") return onClose();
    if (intent.kind === "setActive") {
      await setActive(intent.id);
      const vault = await readVault();
      setState((prev) => (prev ? { ...prev, saved: vault.providers, activeId: vault.activeId } : prev));
      return;
    }
    if (intent.kind === "save") onSaved(await saveProvider(intent.config));
  };

  const apply = (next: SettingsState, intent?: Intent): void => {
    setState(next);
    if (intent) void runIntent(intent);
  };

  const activate = (patch: Partial<SettingsState>): void => {
    const current = stateRef.current;
    if (!current) return;
    const step = reduce({ ...current, ...patch }, { name: "return" });
    apply(step.state, step.intent);
  };

  useKeyboard((event: KeyEvent) => {
    const current = stateRef.current;
    if (!current) return;
    const step = reduce(current, { name: event.name, char: printable(event) });
    apply(step.state, step.intent);
  });

  usePaste((event) => {
    const current = stateRef.current;
    if (current) setState(applyPaste(current, new TextDecoder().decode(event.bytes)));
  });

  if (!state) {
    return (
      <box padding={1} backgroundColor={theme.well} width="100%" height="100%">
        <text fg={theme.mut}>Loading providers...</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.well}>
      <box
        flexDirection="row"
        backgroundColor={theme.panel}
        border={["bottom"]}
        borderColor={theme.roseDeep}
        paddingLeft={1}
        paddingRight={1}
      >
        <text>
          <span fg={theme.text}>Kit</span>
          <span fg={theme.rose}>.</span> <span fg={theme.mut}>settings</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{studioName}</text>
      </box>

      <box flexDirection="row" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
        <Panel index={1} title="Sections" focused={state.focus === "rail" && state.mode === "sections"} width={28}>
          <Rail
            state={state}
            onPick={(index) => setState({ ...state, section: SECTIONS[index]!, focus: "rail" })}
          />
        </Panel>
        <box width={1} />
        <Panel index={2} title={contentTitle(state)} focused={state.focus === "content" || state.mode !== "sections"}>
          {state.mode === "picker" ? (
            <Picker state={state} onPick={(index) => activate({ pickerIndex: index })} />
          ) : state.mode === "form" && state.form ? (
            <Form form={state.form} />
          ) : state.section === "providers" ? (
            <ProvidersContent state={state} onRow={(index) => activate({ focus: "content", contentIndex: index })} />
          ) : (
            <text fg={theme.mut}>{BLURBS[state.section]}</text>
          )}
        </Panel>
      </box>

      <SettingsFooter mode={state.mode} />
    </box>
  );
}
