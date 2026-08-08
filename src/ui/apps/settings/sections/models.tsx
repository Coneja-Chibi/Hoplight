/**
 * Settings > Models: which models this studio can reach, and which one it uses.
 *
 * THE SAME VAULT THE TERMINAL USES. A provider added here is a provider Kit sees, and one added
 * with Kit's /model shows up here. There is no second store, no second key to paste, and no way for
 * the two to disagree about which model is active.
 *
 * A KEY GOES IN AND NEVER COMES BACK. The field is empty even when editing a provider that has one,
 * because the server will not send a stored key to the browser at all - not masked, not truncated.
 * Blank therefore means "keep the one you have", which is what makes changing a model on a saved
 * provider not require finding the key again.
 */
import { useCallback, useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { apiFetchJson } from "../../../_shared/api-fetch";
import { SettingsRow, type SettingsSection } from "../section-contract";
import styles from "./models.module.css";
import {
  draftFrom,
  draftProblem,
  emptyDraft,
  providerLabel,
  saveBody,
  type ProviderDraft,
  type ProviderKind,
  type SafeProvider,
} from "./models-core";

interface ListReply {
  providers: SafeProvider[];
  kinds: ProviderKind[];
  notice?: string;
}

function ModelsSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [providers, setProviders] = useState<SafeProvider[]>([]);
  const [kinds, setKinds] = useState<ProviderKind[]>([]);
  const [notice, setNotice] = useState<string>();
  const [draft, setDraft] = useState<ProviderDraft | null>(null);
  const [models, setModels] = useState<{ id: string; label?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tested, setTested] = useState<Record<string, string>>({});

  const reload = useCallback(async (): Promise<void> => {
    try {
      const reply = await apiFetchJson<ListReply>("/api/agent/providers");
      setProviders(reply.providers);
      setKinds(reply.kinds);
      // A vault that could not be recovered says so. Never swallowed: somebody whose saved
      // providers vanished needs to know why rather than finding an empty list.
      setNotice(reply.notice);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "could not read the model list");
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const kindOf = (id: string): ProviderKind | undefined => kinds.find((k) => k.id === id);
  const editing = draft?.id ? providers.find((p) => p.id === draft.id) : undefined;

  const save = async (): Promise<void> => {
    if (!draft) return;
    const why = draftProblem(draft, kindOf(draft.kind), editing?.hasKey ?? false);
    if (why) { setProblem(why); return; }
    setBusy(true);
    setProblem(null);
    try {
      await apiFetchJson("/api/agent/providers/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveBody(draft)),
      });
      setDraft(null);
      setModels([]);
      await reload();
      ctx.setStatus("model saved");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "could not save");
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, id: string, then: string): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      await apiFetchJson(`/api/agent/providers/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await reload();
      ctx.setStatus(then);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "that did not work");
    } finally {
      setBusy(false);
    }
  };

  /** A real call to the real endpoint: "saved" and "works" are different states. */
  const test = async (id: string): Promise<void> => {
    setTested((prior) => ({ ...prior, [id]: "asking..." }));
    try {
      const reply = await apiFetchJson<{ ok: boolean; ms?: number; error?: string }>(
        "/api/agent/providers/test",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) },
      );
      setTested((prior) => ({
        ...prior,
        [id]: reply.ok ? `answered in ${String(reply.ms ?? 0)}ms` : (reply.error ?? "no answer"),
      }));
    } catch (error) {
      setTested((prior) => ({ ...prior, [id]: error instanceof Error ? error.message : "no answer" }));
    }
  };

  /** Ask the provider what it offers, so the model is a choice rather than a string to get right. */
  const loadModels = async (id: string): Promise<void> => {
    try {
      const reply = await apiFetchJson<{ models: { id: string; label?: string }[] }>(
        "/api/agent/providers/models",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) },
      );
      setModels(reply.models);
    } catch {
      // Plenty of providers publish no list, and typing the id is a perfectly good path.
      setModels([]);
    }
  };

  return (
    <>
      {notice && <p className={styles.notice}>{notice}</p>}

      <SettingsRow
        label="Models"
        hint="Shared with Kit in the terminal. Adding one here adds it there."
      >
        <span />
      </SettingsRow>

      <ul className={styles.list}>
        {providers.length === 0 && <li className={styles.empty}>No models connected yet.</li>}
        {providers.map((p) => (
          <li key={p.id} className={p.active ? `${styles.row} ${styles.rowActive}` : styles.row}>
            <label className={styles.pick}>
              {/* A radio, because exactly one provider is active and that is worth looking like. */}
              <input
                type="radio"
                name="active-provider"
                checked={p.active}
                disabled={busy}
                onChange={() => { void act("activate", p.id, "model switched"); }}
              />
              <span className={styles.name}>{providerLabel(p, kinds)}</span>
            </label>
            <span className={styles.model}>{p.model}</span>
            {/* Never the key. Only whether there is one. */}
            <span className={styles.key}>{p.hasKey ? "key saved" : "no key"}</span>
            <span className={styles.tested}>{tested[p.id] ?? ""}</span>
            <span className={styles.acts}>
              <button type="button" disabled={busy} onClick={() => { void test(p.id); }}>{"Test"}</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setDraft(draftFrom(p)); setModels([]); void loadModels(p.id); }}
              >
                {"Edit"}
              </button>
              <button type="button" disabled={busy} onClick={() => { void act("remove", p.id, "model removed"); }}>
                {"Remove"}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {draft === null ? (
        <button
          type="button"
          className={styles.add}
          disabled={busy || kinds.length === 0}
          onClick={() => { setDraft(emptyDraft(kinds[0])); }}
        >
          {"Add a model"}
        </button>
      ) : (
        <div className={styles.form}>
          <label>
            {"Provider"}
            <select
              value={draft.kind}
              // Changing provider resets the model to that provider's default: a model id from one
              // provider is meaningless on another, and carrying it over produces a saved entry
              // that only fails at the first turn.
              onChange={(e) => {
                const next = kindOf(e.target.value);
                setDraft({ ...draft, kind: e.target.value, model: next?.defaultModel ?? "" });
                setModels([]);
              }}
            >
              {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>

          <label>
            {"Model"}
            <input
              value={draft.model}
              list="model-suggestions"
              placeholder={kindOf(draft.kind)?.defaultModel ?? "model id"}
              onChange={(e) => { setDraft({ ...draft, model: e.target.value }); }}
            />
            {/* A datalist rather than a select: the live list helps, and typing still works when a
                provider publishes none or offers something newer than its own index. */}
            <datalist id="model-suggestions">
              {models.map((m) => <option key={m.id} value={m.id}>{m.label ?? m.id}</option>)}
            </datalist>
          </label>

          <label>
            {"Name (optional)"}
            <input
              value={draft.name}
              placeholder="Personal, Work"
              onChange={(e) => { setDraft({ ...draft, name: e.target.value }); }}
            />
          </label>

          {kindOf(draft.kind)?.needsBaseUrl && (
            <label>
              {"Base URL"}
              <input
                value={draft.baseURL}
                placeholder="http://localhost:1234/v1"
                onChange={(e) => { setDraft({ ...draft, baseURL: e.target.value }); }}
              />
            </label>
          )}

          {!kindOf(draft.kind)?.keyless && (
            <label>
              {"API key"}
              <input
                type="password"
                value={draft.apiKey}
                autoComplete="off"
                placeholder={editing?.hasKey ? "leave blank to keep the saved key" : "paste your key"}
                onChange={(e) => { setDraft({ ...draft, apiKey: e.target.value }); }}
              />
            </label>
          )}

          <div className={styles.formActs}>
            <button type="button" disabled={busy} onClick={() => { void save(); }}>{"Save"}</button>
            <button type="button" disabled={busy} onClick={() => { setDraft(null); setProblem(null); }}>
              {"Cancel"}
            </button>
          </div>
        </div>
      )}

      {problem !== null && <p className={styles.problem}>{problem}</p>}
    </>
  );
}

const section: SettingsSection = {
  id: "models",
  label: "Models",
  // Straight after appearance: it is the thing somebody comes to Settings to do once the studio
  // itself is set up, and burying it under Updates would be hiding the point of the agent window.
  order: 15,
  Component: ModelsSection,
};

export default section;
