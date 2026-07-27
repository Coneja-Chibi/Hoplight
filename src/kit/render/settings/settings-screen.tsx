/** @jsxImportSource @opentui/react */
/**
 * Settings screen: the Panel Deck shell. It loads the spokes and the saved vault, routes every
 * keypress through the pure model (reduce), and runs the intents the model returns (close, save,
 * set-active). Clicks are mirrored through the same reduce so keyboard and mouse never diverge.
 *
 * Model discovery follows RC's proven flow: ~1.2s after the key or base URL last changed (and only
 * when they pass the fetch gate), the provider's live model list is fetched silently through the
 * egress-guarded spoke and lands under the model field as a filterable picker. The fetch is keyed
 * by a form signature so typing a model name never refires it, and stale responses are dropped.
 * This is imperative-shell only; all navigation logic lives in model.ts.
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
import {
  applyPaste,
  canFetchModels,
  draftConfig,
  formSignature,
  initialState,
  reduce,
  SECTIONS,
  type Intent,
  type ModelList,
  type SettingsState,
} from "./model";
import { readVault, removeProvider, saveProvider, setActive } from "../../providers/vault";
import { listModelsFor } from "../../providers/adapters";
import type { ProviderConfig } from "../../providers/config";
import type { ModelInfo } from "../../providers/models";
import type { Vault } from "../../providers/vault";

export interface SettingsVaultApi {
  read(): Promise<Vault>;
  save(config: ProviderConfig): Promise<ProviderConfig>;
  activate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const DEFAULT_VAULT_API: SettingsVaultApi = {
  read: readVault,
  save: saveProvider,
  activate: setActive,
  remove: removeProvider,
};

const printable = (event: KeyEvent): string | undefined => {
  if (event.ctrl || event.meta || event.option || event.super) return undefined;
  const seq = event.sequence;
  if (typeof seq === "string" && seq.length === 1 && seq >= " " && seq !== "") return seq;
  return undefined;
};

const BLURBS: Record<string, string> = {
  gates: "Saved writes pause at a Gate prompt. y allows once, a allows this session, n denies, ! locks down.",
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
  onChanged = () => {},
  listModels = listModelsFor,
  modelsDebounceMs = 1200,
  vaultApi = DEFAULT_VAULT_API,
}: {
  studioName: string;
  onClose: () => void;
  onSaved: (config: ProviderConfig) => void;
  onChanged?: () => void;
  /** Injectable for tests; defaults to the real egress-guarded spoke query. */
  listModels?: (config: ProviderConfig) => Promise<ModelInfo[] | null>;
  modelsDebounceMs?: number;
  vaultApi?: SettingsVaultApi;
}): ReactNode {
  const [state, setState] = useState<SettingsState | null>(null);
  const [operation, setOperation] = useState(false);
  const operationRef = useRef(false);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const stateRef = useRef<SettingsState | null>(state);
  stateRef.current = state;
  const alive = useRef(true);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSig = useRef("");

  useEffect(() => {
    alive.current = true;
    setError("");
    void (async () => {
      try {
        const [choices, vault] = await Promise.all([loadChoices(), vaultApi.read()]);
        if (!alive.current) return;
        setState(initialState(choices, vault.providers, vault.activeId));
        // A recovered vault comes back EMPTY rather than throwing, so without this the user would
        // see a blank provider list and no reason for it. The notice is the only account of where
        // their saved keys went.
        if (vault.notice) setError(vault.notice);
      } catch (caught) {
        if (alive.current) setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    return () => {
      alive.current = false;
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [loadAttempt, vaultApi]);

  const runIntent = async (intent: Intent): Promise<void> => {
    if (intent.kind === "close") return onClose();
    if (operationRef.current) return;
    operationRef.current = true;
    setOperation(true);
    setError("");
    try {
      if (intent.kind === "setActive" || intent.kind === "remove") {
        await (intent.kind === "remove" ? vaultApi.remove(intent.id) : vaultApi.activate(intent.id));
        const vault = await vaultApi.read();
        setState((prev) =>
          prev
            ? {
                ...prev,
                saved: vault.providers,
                activeId: vault.activeId,
                contentIndex: Math.min(prev.contentIndex, vault.providers.length),
              }
            : prev,
        );
        onChanged();
        return;
      }
      if (intent.kind === "save") onSaved(await vaultApi.save(intent.config));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      operationRef.current = false;
      setOperation(false);
    }
  };

  /** Patch the form's model list, advancing the ref so key bursts stay coherent. */
  const injectList = (patch: Partial<ModelList>): void => {
    const current = stateRef.current;
    if (!current?.form) return;
    const next = {
      ...current,
      form: { ...current.form, list: { ...current.form.list, ...patch } },
    };
    stateRef.current = next;
    setState(next);
  };

  const fireFetch = async (sig: string): Promise<void> => {
    const current = stateRef.current;
    const form = current?.mode === "form" ? current.form : null;
    if (!alive.current || !form || formSignature(form) !== sig) return;
    injectList({ state: "loading" });
    let models: ModelInfo[] | null;
    try {
      models = await listModels(draftConfig(form));
    } catch (caught) {
      const now = stateRef.current;
      const nowForm = now?.mode === "form" ? now.form : null;
      if (!alive.current || !nowForm || formSignature(nowForm) !== sig) return;
      injectList({
        state: "error",
        models: [],
        index: 0,
        error: caught instanceof Error ? caught.message : String(caught),
      });
      return;
    }
    const now = stateRef.current;
    const nowForm = now?.mode === "form" ? now.form : null;
    if (!alive.current || !nowForm || formSignature(nowForm) !== sig) return; // stale response
    if (models === null) {
      injectList({ state: "idle", models: [], index: 0 }); // no endpoint: manual entry
      return;
    }
    // Land the highlight on the current model when it is in the list (the prefilled default case).
    const current2 = nowForm.model.trim().toLowerCase();
    const at = models.findIndex((info) => info.id.toLowerCase() === current2);
    injectList({ state: "ready", models, index: Math.max(0, at) });
  };

  const maybeScheduleFetch = (next: SettingsState): void => {
    const form = next.mode === "form" ? next.form : null;
    if (!form) {
      lastSig.current = "";
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      return;
    }
    const sig = formSignature(form);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    if (!canFetchModels(form)) return;
    fetchTimer.current = setTimeout(() => void fireFetch(sig), modelsDebounceMs);
  };

  const apply = (next: SettingsState, intent?: Intent): void => {
    stateRef.current = next; // advance synchronously so a burst of keys chains off fresh state
    setState(next);
    maybeScheduleFetch(next);
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
    if (!current) {
      if (error && event.name === "escape") onClose();
      if (error && event.name === "return") {
        setState(null);
        setLoadAttempt((attempt) => attempt + 1);
      }
      return;
    }
    if (operationRef.current) return;
    if (current.form?.list.state === "error" && event.name === "r") {
      lastSig.current = "";
      maybeScheduleFetch(current);
      return;
    }
    const step = reduce(current, { name: event.name, char: printable(event) });
    apply(step.state, step.intent);
  });

  usePaste((event) => {
    if (operationRef.current) return;
    const current = stateRef.current;
    if (current) apply(applyPaste(current, new TextDecoder().decode(event.bytes)));
  });

  if (!state) {
    return (
      <box padding={1} backgroundColor={theme.well} width="100%" height="100%">
        <text fg={error ? theme.rose : theme.mut}>
          {error ? `Could not load providers: ${error}. Enter retries; Esc goes back.` : "Loading providers..."}
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.well}>
      <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
        <text>
          <span fg={theme.text}>Kit</span>
          <span fg={theme.rose}>.</span> <span fg={theme.mut}>settings</span>
        </text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{studioName}</text>
      </box>
      <box height={1} backgroundColor={theme.edge} />

      <box flexDirection="row" flexGrow={1}>
        <Panel index={1} title="Sections" focused={state.focus === "rail" && state.mode === "sections"} width={26}>
          <Rail
            state={state}
            onPick={(index) => {
              const current = stateRef.current;
              if (current) apply({ ...current, section: SECTIONS[index]!, focus: "rail" });
            }}
          />
        </Panel>
        <Panel index={2} title={contentTitle(state)} focused={state.focus === "content" || state.mode !== "sections"}>
          {state.mode === "picker" ? (
            <Picker state={state} onPick={(index) => activate({ pickerIndex: index })} />
          ) : state.mode === "form" && state.form ? (
            <Form
              form={state.form}
              onModel={(index) => {
                const current = stateRef.current;
                if (!current?.form) return;
                activate({
                  form: { ...current.form, field: "model", list: { ...current.form.list, index } },
                });
              }}
              onOption={(key, value) => {
                const current = stateRef.current;
                if (!current?.form) return;
                apply({
                  ...current,
                  form: {
                    ...current.form,
                    options: { ...current.form.options, [key]: value },
                    list: { state: "idle", models: [], index: 0 },
                  },
                });
              }}
            />
          ) : state.section === "providers" ? (
            <ProvidersContent state={state} onRow={(index) => activate({ focus: "content", contentIndex: index })} />
          ) : (
            <box paddingLeft={2}>
              <text fg={theme.mut}>{BLURBS[state.section]}</text>
            </box>
          )}
        </Panel>
      </box>

      <box height={1} backgroundColor={theme.edge} />
      {operation || error ? (
        <box backgroundColor={theme.sunken} paddingLeft={1} paddingRight={1}>
          <text fg={error ? theme.rose : theme.mut}>{error || "Saving provider..."}</text>
        </box>
      ) : null}
      <SettingsFooter
        mode={state.mode}
        providerActions={
          state.mode === "sections"
          && state.section === "providers"
          && state.focus === "content"
          && state.saved.length > 0
        }
      />
    </box>
  );
}
