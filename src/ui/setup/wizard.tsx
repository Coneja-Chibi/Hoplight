/**
 * SetupWizard - the first-run wizard (CONTRACT V2 React) - the LOCKED vs-setup-hybrid brought to
 * life, one screen at a time. This component is a thin renderer: all logic lives in wizard-core
 * (pure, tested) and all content lives in the drop-in steps (src/ui/setup/steps/<name>/). The
 * wizard derives dots, progress, defaults, skip-all, the stage zones, the summary sentence, and
 * the recap chips from the step list alone; it names no step. The setup surface itself is always
 * paper (print) - App.tsx forces that theme while this component is mounted. The stage's CSS
 * custom properties (a step's `stageVars`, e.g. the accent step's live --accent repaint) are
 * merged in step order and painted onto the stage root, since steps no longer reach the DOM
 * directly.
 */
import { useEffect, useState } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";
import type { StudioSettings } from "../../studio/settings-shape";
import type { SetupContext, SetupDraft, SetupOption, SetupStep } from "./step-contract";
import { defaultValue, isPressed, nextMultiSelection, optionValue, progressLabel, sentencePlan } from "./wizard-core";

export interface SetupWizardProps {
  ctx: SetupContext;
  existing: StudioSettings;
  onComplete: (settings: StudioSettings) => void;
}

interface LoadedStep {
  step: SetupStep;
  options: SetupOption[];
}

const CSS = `
.vsetup{position:fixed;inset:0;z-index:100;overflow:auto;background:var(--paper);color:var(--ink);
  font-family:var(--font-body);line-height:1.5}
.vsetup .frame{max-width:73.75rem;margin:0 auto;padding:clamp(1.5rem,4vw,2.75rem) clamp(1rem,3vw,1.625rem) 4rem}
.vsetup .screen{display:grid;grid-template-columns:minmax(0,26.875rem) minmax(0,1fr);
  gap:clamp(1.5rem,4vw,2.375rem);align-items:start}
.vsetup .qcard{background:var(--panel);border:var(--ink-border);box-shadow:10px 10px 0 0 var(--ink);
  padding:clamp(1.25rem,3vw,1.875rem)}
.vsetup .lock{display:inline-flex;align-items:baseline;font-size:clamp(1.35rem,1rem+1.4vw,1.5625rem)}
.vsetup .lock svg{height:1.22em;width:auto;align-self:baseline;transform:translateY(.13em);margin-right:-.14em}
.vsetup .lock .txt{font-family:var(--font-big);font-weight:900;letter-spacing:-.01em}
.vsetup .lock .quad{display:inline-block;width:.17em;height:.17em;background:var(--rose);margin-left:.09em}
.vsetup .top{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  padding-bottom:.95rem;border-bottom:1.5px solid var(--ghost)}
.vsetup .prog{display:flex;align-items:center;gap:.6rem}
.vsetup .dots{display:flex;gap:6px}
.vsetup .dots i{width:9px;height:9px;border:2px solid var(--ink);background:var(--panel);display:block}
.vsetup .dots i.done{background:var(--ink)}
.vsetup .dots i.now{background:var(--rose);border-color:var(--rose)}
.vsetup .step-n{font-family:var(--font-mono);font-size:.6875rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--muted)}
.vsetup .q{font-family:var(--font-big);font-weight:900;font-size:clamp(1.9rem,1.2rem+2.6vw,2.3125rem);
  line-height:1.02;letter-spacing:-.02em;margin:1.4rem 0 .4rem}
.vsetup .q-say{font-style:italic;font-weight:600;font-size:clamp(1.05rem,1rem+.3vw,1.125rem);
  color:var(--muted);margin:0 0 1.35rem}
.vsetup .opt{display:block;width:100%;text-align:left;font:inherit;cursor:pointer;
  background:var(--panel);color:var(--ink);border:var(--ink-border);box-shadow:5px 5px 0 0 var(--ink);
  padding:.9rem 1.05rem;position:relative;
  transition:transform .1s ease-out,box-shadow .1s ease-out,border-color .1s ease-out}
.vsetup .opt:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 0 var(--ink)}
.vsetup .opt:active{transform:translate(4px,4px);box-shadow:1px 1px 0 0 var(--ink)}
.vsetup .opt.on{transform:translate(4px,4px);box-shadow:1px 1px 0 0 var(--rose);border-color:var(--rose)}
.vsetup .opt .on-mark{position:absolute;top:-3px;right:-3px;background:var(--rose);color:var(--stage-white);
  font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;
  padding:3px 7px;display:none}
.vsetup .opt.on .on-mark{display:block}
.vsetup .opt-title{font-family:var(--font-big);font-weight:600;
  font-size:clamp(1rem,.97rem+.2vw,1.0625rem);letter-spacing:-.01em}
.vsetup .opt-sub{font-size:clamp(.95rem,.92rem+.15vw,1rem);color:var(--muted);margin-top:2px}
.vsetup .default-tag{font-family:var(--font-mono);font-size:.625rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted);margin-left:.5rem;font-weight:400}
.vsetup .stack{display:flex;flex-direction:column;gap:.7rem}
.vsetup .controls{display:flex;align-items:center;justify-content:space-between;gap:.9rem;margin-top:1.6rem}
.vsetup .back{font-family:var(--font-mono);font-size:.75rem;letter-spacing:.08em;
  color:var(--muted);background:none;border:none;cursor:pointer;text-transform:uppercase;padding:.4rem 2px}
.vsetup .back:hover{color:var(--ink)}
.vsetup .back.ghost{visibility:hidden}
.vsetup .next{font-family:var(--font-big);font-weight:900;font-size:.875rem;letter-spacing:.1em;
  text-transform:uppercase;padding:.9rem 1.75rem;border:var(--ink-border);
  background:var(--rose);color:var(--stage-white);box-shadow:6px 6px 0 0 var(--ink);cursor:pointer;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.vsetup .next:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--ink)}
.vsetup .next:active{transform:translate(4px,4px);box-shadow:2px 2px 0 0 var(--ink)}
.vsetup .skip{text-align:center;margin-top:1rem}
.vsetup .skip a{font-family:var(--font-mono);font-size:.6875rem;letter-spacing:.06em;
  color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.vsetup .skip a:hover{color:var(--ink)}
.vsetup .house{position:sticky;top:1.5rem;display:flex;flex-direction:column}
.vsetup .house-cap{display:flex;align-items:baseline;justify-content:space-between;gap:.6rem;
  margin-bottom:.7rem;flex-wrap:wrap}
.vsetup .hc-k{font-family:var(--font-mono);font-size:.6875rem;letter-spacing:.28em;
  text-transform:uppercase;color:var(--ink)}
.vsetup .hc-s{font-family:var(--font-mono);font-size:.65625rem;letter-spacing:.04em;
  text-transform:uppercase;color:var(--muted)}
.vsetup.final-on .hc-s{color:var(--rose)}
.vsetup .proscenium{position:relative;background:var(--paper);border:var(--ink-border);
  box-shadow:10px 10px 0 0 var(--ink);padding:clamp(.85rem,2vw,1.1875rem)}
.vsetup .proscenium::before{content:"";position:absolute;inset:9px;border:1.5px solid var(--ink);
  pointer-events:none;z-index:4}
.vsetup .orn{position:absolute;width:11px;height:11px;background:var(--ink);transform:rotate(45deg);z-index:5}
.vsetup .orn.tl{left:14px;top:14px}.vsetup .orn.tr{right:14px;top:14px}
.vsetup .orn.bl{left:14px;bottom:14px}.vsetup .orn.br{right:14px;bottom:14px}
.vsetup .stage{position:relative;background:var(--stage);border:3px solid var(--stage-black);
  box-shadow:inset 9px 9px 0 0 rgba(0,0,0,.72);
  min-height:25rem;overflow:hidden;display:flex;flex-direction:column}
.vsetup .final-card{text-align:center}
.vsetup .final-card .q{font-size:clamp(2.1rem,1.4rem+2.8vw,2.75rem);margin-top:1.25rem}
.vsetup .summary{font-style:italic;font-weight:600;font-size:clamp(1.15rem,1rem+.6vw,1.25rem);
  color:var(--muted);margin:2px auto .5rem;max-width:22.5rem;line-height:1.4}
.vsetup .summary b{font-style:normal;font-weight:600;color:var(--ink)}
.vsetup .recap{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin:1.4rem 0 1.75rem}
.vsetup .recap span{font-family:var(--font-mono);font-size:.6875rem;letter-spacing:.05em;
  text-transform:uppercase;color:var(--muted);border:2px solid var(--ghost);padding:.4rem .7rem}
.vsetup .recap span b{color:var(--rose);font-weight:500}
.vsetup .open{font-family:var(--font-big);font-weight:900;font-size:1rem;letter-spacing:.1em;
  text-transform:uppercase;padding:1.1rem 2.6rem;border:var(--ink-border);
  background:var(--rose);color:var(--stage-white);box-shadow:8px 8px 0 0 var(--ink);cursor:pointer;
  display:inline-flex;align-items:baseline;gap:2px;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.vsetup .open:hover{transform:translate(-2px,-2px);box-shadow:10px 10px 0 0 var(--ink)}
.vsetup .open:active{transform:translate(5px,5px);box-shadow:3px 3px 0 0 var(--ink)}
.vsetup .open .q2{display:inline-block;width:.16em;height:.16em;background:var(--stage-white);margin-left:.06em}
.vsetup .change{font-style:italic;font-weight:600;font-size:clamp(1rem,.97rem+.2vw,1.0625rem);
  color:var(--muted);margin-top:1.1rem}
@media(prefers-reduced-motion:reduce){.vsetup *{transition:none!important}}
@media(max-width:57.5rem){
  .vsetup .screen{grid-template-columns:1fr;gap:1.6rem}
  .vsetup .house{position:static}
}
@media(max-width:32.5rem){
  .vsetup .controls{flex-direction:column-reverse;align-items:stretch;gap:.75rem}
  .vsetup .next{width:100%}
}
`;

/** The locked beam-V geometry (vs-pick-4); the mark is ALWAYS brand rose. */
const BEAM_POLYGONS = ["60,92 4,12 34,3", "40,92 96,12 66,3"] as const;

function Lockup(): JSX.Element {
  return (
    <span className="lock">
      <svg viewBox="0 0 100 100" aria-label="Vaude">
        {BEAM_POLYGONS.map((points) => (
          <polygon key={points} points={points} fill="#e11d48" /> // hardcode-ok: locked brand mark, always rose, not a themed surface
        ))}
      </svg>
      <span className="txt">aude</span>
      <span className="quad" />
    </span>
  );
}

/** Fetch, import, and order the drop-in steps; resolve each step's (possibly async) options. */
async function loadSteps(ctx: SetupContext): Promise<LoadedStep[]> {
  const ids = (await (await fetch("/api/setup/steps")).json()) as string[];
  const loaded = await Promise.all(
    ids.map(async (id): Promise<LoadedStep> => {
      const mod = (await import(`/setup/steps/${id}.js`)) as { default: SetupStep };
      return { step: mod.default, options: await mod.default.options(ctx) };
    }),
  );
  return loaded.sort((a, b) => a.step.manifest.order - b.step.manifest.order);
}

function ensureDefault(steps: LoadedStep[], i: number, draft: SetupDraft): SetupDraft {
  const { step, options } = steps[i]!;
  const key = step.manifest.settingsKey;
  if (draft[key] !== undefined) return draft;
  return { ...draft, [key]: defaultValue(step.manifest, options) };
}

function fillAllDefaults(steps: LoadedStep[], draft: SetupDraft): SetupDraft {
  let next = draft;
  for (let i = 0; i < steps.length; i++) next = ensureDefault(steps, i, next);
  return next;
}

function DefaultOption({ opt, pressed, onPick }: { opt: SetupOption; pressed: boolean; onPick: () => void }): JSX.Element {
  return (
    <button className="opt" aria-pressed={pressed ? "true" : "false"} onClick={onPick}>
      {pressed && <span className="on-mark">Picked</span>}
      <div className="opt-title">
        {opt.title}
        {opt.isDefault && <span className="default-tag">default</span>}
      </div>
      {opt.sub && <div className="opt-sub">{opt.sub}</div>}
    </button>
  );
}

/** The stage well: every step's zone, in step order, under CSS vars every step contributes. */
function StageWell({ steps, draft }: { steps: LoadedStep[]; draft: SetupDraft }): JSX.Element {
  const vars: Record<string, string> = {};
  for (const { step } of steps) Object.assign(vars, step.stageVars?.(draft));
  return (
    <div className="stage" style={vars as CSSProperties}>
      {steps.map(({ step, options }) =>
        step.renderZone ? <div key={step.manifest.id}>{step.renderZone(draft, options)}</div> : null,
      )}
    </div>
  );
}

function House({ note, steps, draft }: { note: string; steps: LoadedStep[]; draft: SetupDraft }): JSX.Element {
  return (
    <div className="house">
      <div className="house-cap">
        <span className="hc-k">Your Stage</span>
        <span className="hc-s">{note}</span>
      </div>
      <div className="proscenium">
        <span className="orn tl" />
        <span className="orn tr" />
        <span className="orn bl" />
        <span className="orn br" />
        <StageWell steps={steps} draft={draft} />
      </div>
    </div>
  );
}

interface QuestionScreenProps {
  steps: LoadedStep[];
  index: number;
  draft: SetupDraft;
  onPick: (opt: SetupOption) => void;
  onBack: () => void;
  onNext: () => void;
  onSkipAll: () => void;
}

function QuestionScreen({ steps, index, draft, onPick, onBack, onNext, onSkipAll }: QuestionScreenProps): JSX.Element {
  const entry = steps[index]!;
  const { manifest } = entry.step;
  const key = manifest.settingsKey;

  const optionNode = (opt: SetupOption): ReactNode => {
    const pressed = isPressed(opt, draft[key], manifest.multi);
    return entry.step.renderOption ? (
      <span key={opt.id}>{entry.step.renderOption(opt, pressed, () => onPick(opt))}</span>
    ) : (
      <DefaultOption key={opt.id} opt={opt} pressed={pressed} onPick={() => onPick(opt)} />
    );
  };

  return (
    <section className="screen">
      <div className="qcard">
        <div className="top">
          <Lockup />
          <div className="prog">
            <span className="dots">
              {steps.map((_, d) => (
                <i key={d} className={d < index ? "done" : d === index ? "now" : undefined} />
              ))}
            </span>
            <span className="step-n">{progressLabel(index, steps.length)}</span>
          </div>
        </div>
        <h1 className="q">
          {manifest.question.split("\n").map((line, n) => (
            <span key={n}>
              {n > 0 && <br />}
              {line}
            </span>
          ))}
        </h1>
        <p className="q-say">{manifest.say}</p>
        <div className={manifest.layoutClass ?? "stack"}>
          {entry.step.renderOptions ? entry.step.renderOptions(entry.options, draft, onPick) : entry.options.map(optionNode)}
        </div>
        <div className="controls">
          <button className={`back${index === 0 ? " ghost" : ""}`} onClick={onBack}>
            ← Back
          </button>
          <button className="next" onClick={onNext}>
            Next →
          </button>
        </div>
        <div className="skip">
          <a onClick={onSkipAll}>Skip all · you can change everything later</a>
        </div>
      </div>
      <House note={manifest.stageNote} steps={steps} draft={draft} />
    </section>
  );
}

function FinalScreen({ steps, draft, onOpen }: { steps: LoadedStep[]; draft: SetupDraft; onOpen: () => void }): JSX.Element {
  const plan = sentencePlan(steps.map(({ step, options }) => step.phrase(draft, options)));
  const chips = steps
    .map(({ step, options }) => step.recap(draft, options))
    .filter((c): c is { label: string; value: string } => c !== null);

  return (
    <section className="screen">
      <div className="qcard final-card">
        <Lockup />
        <h1 className="q">You&apos;re set.</h1>
        <p className="summary">
          {plan.map((frag, i) => (
            <span key={i}>
              {frag.pre}
              <b>{frag.strong}</b>
              {frag.post}
            </span>
          ))}
        </p>
        <div className="recap">
          {chips.map((chip, i) => (
            <span key={i}>
              {chip.label} <b>{chip.value}</b>
            </span>
          ))}
        </div>
        <button className="open" onClick={onOpen}>
          Open Vaude
          <span className="q2" />
        </button>
        <p className="change">Everything here can change later, whenever you want.</p>
      </div>
      <House note="fully set" steps={steps} draft={draft} />
    </section>
  );
}

/** Renders the wizard; calls onComplete with the draft (all keys filled) when OPEN VAUDE is pressed. */
export function SetupWizard({ ctx, existing, onComplete }: SetupWizardProps): JSX.Element | null {
  const [steps, setSteps] = useState<LoadedStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<SetupDraft>({});

  useEffect(() => {
    void (async () => {
      const loaded = await loadSteps(ctx);
      if (loaded.length === 0) {
        onComplete({ ...existing, setupComplete: true }); // no steps dropped in = nothing to ask
        return;
      }
      setSteps(loaded);
      setDraft(ensureDefault(loaded, 0, {}));
    })();
    // steps load exactly once per mount; ctx/existing/onComplete are stable for the wizard's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!steps) return null; // loading: nothing to paint yet

  const finished = index >= steps.length;

  const onPick = (opt: SetupOption): void => {
    const { step } = steps[index]!;
    const key = step.manifest.settingsKey;
    setDraft((d) => ({ ...d, [key]: step.manifest.multi ? nextMultiSelection(d[key], opt) : optionValue(opt) }));
  };

  const onBack = (): void => setIndex((i) => Math.max(0, i - 1));

  const onNext = (): void => {
    const next = index + 1;
    if (next < steps.length) setDraft((d) => ensureDefault(steps, next, d));
    setIndex(next);
  };

  const onSkipAll = (): void => {
    setDraft((d) => fillAllDefaults(steps, d));
    setIndex(steps.length);
  };

  const onOpen = (): void => onComplete({ ...existing, ...draft, setupComplete: true });

  const css = CSS + steps.map(({ step }) => step.css ?? "").join("\n");

  return (
    <div className={`vsetup${finished ? " final-on" : ""}`}>
      <style>{css}</style>
      <div className="frame">
        {finished ? (
          <FinalScreen steps={steps} draft={draft} onOpen={onOpen} />
        ) : (
          <QuestionScreen
            steps={steps}
            index={index}
            draft={draft}
            onPick={onPick}
            onBack={onBack}
            onNext={onNext}
            onSkipAll={onSkipAll}
          />
        )}
      </div>
    </div>
  );
}
