/**
 * The first-run wizard - the LOCKED vs-setup-hybrid brought to life, one screen at a time.
 * This file is a thin DOM shell: all logic lives in wizard-core (pure, tested) and all content
 * lives in the drop-in steps (src/ui/setup/steps/<name>/). The wizard derives dots, progress,
 * defaults, skip-all, the stage zones, the summary sentence, and the recap chips from the step
 * list alone; it names no step. The setup surface itself is always paper (print); the chosen
 * theme applies when the studio opens.
 */
import type { StudioSettings } from "../../studio/settings-shape";
import type { SetupContext, SetupDraft, SetupOption, SetupStep, SetupStepManifest } from "./step-contract";
import { defaultValue, isPressed, nextMultiSelection, optionValue, progressLabel, sentencePlan } from "./wizard-core";

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
.vsetup .opt .on-mark{position:absolute;top:-3px;right:-3px;background:var(--rose);color:#fff;
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
  background:var(--rose);color:#fff;box-shadow:6px 6px 0 0 var(--ink);cursor:pointer;
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
.vsetup .stage{position:relative;background:var(--stage);border:3px solid #000;
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
  background:var(--rose);color:#fff;box-shadow:8px 8px 0 0 var(--ink);cursor:pointer;
  display:inline-flex;align-items:baseline;gap:2px;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.vsetup .open:hover{transform:translate(-2px,-2px);box-shadow:10px 10px 0 0 var(--ink)}
.vsetup .open:active{transform:translate(5px,5px);box-shadow:3px 3px 0 0 var(--ink)}
.vsetup .open .q2{display:inline-block;width:.16em;height:.16em;background:#fff;margin-left:.06em}
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
const SVG_NS = "http://www.w3.org/2000/svg";

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

function lockup(): HTMLElement {
  const lock = h("span", "lock");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-label", "Vaude");
  for (const points of BEAM_POLYGONS) {
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", points);
    poly.setAttribute("fill", "#e11d48"); // brand rose, FIXED (DECISIONS #3): never the accent var
    svg.append(poly);
  }
  lock.append(svg, h("span", "txt", "aude"), h("span", "quad"));
  return lock;
}

interface LoadedStep {
  step: SetupStep;
  options: SetupOption[];
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

/** Mount the wizard; resolves with the draft (all keys filled) when OPEN VAUDE is pressed. */
export function runSetup(ctx: SetupContext, existing: StudioSettings): Promise<StudioSettings> {
  return new Promise((resolve) => {
    void (async () => {
      const steps = await loadSteps(ctx);
      const root = h("div", "vsetup");
      const style = document.createElement("style");
      style.textContent = CSS + steps.map((s) => s.step.css ?? "").join("\n");
      const frame = h("div", "frame");
      root.append(style, frame);
      document.body.append(root);

      const draft: SetupDraft = {};
      let index = 0;

      const ensureDefault = (i: number): void => {
        const { step, options } = steps[i]!;
        if (draft[step.manifest.settingsKey] === undefined) {
          draft[step.manifest.settingsKey] = defaultValue(step.manifest, options);
        }
      };

      const fillAllDefaults = (): void => {
        for (let i = 0; i < steps.length; i++) ensureDefault(i);
      };

      const finish = (): void => {
        root.remove();
        resolve({ ...existing, ...draft, setupComplete: true });
      };

      // -- the stage (right column): zones contributed by steps, in step order ----------------------
      function stage(): HTMLElement {
        const pros = h("div", "proscenium");
        for (const c of ["tl", "tr", "bl", "br"]) pros.append(h("span", `orn ${c}`));
        const well = h("div", "stage");
        for (const { step, options } of steps) {
          if (step.renderZone) well.append(step.renderZone(draft, options));
        }
        for (const { step } of steps) step.applyStage?.(well, draft);
        pros.append(well);
        return pros;
      }

      function house(note: string): HTMLElement {
        const side = h("div", "house");
        const cap = h("div", "house-cap");
        cap.append(h("span", "hc-k", "Your Stage"), h("span", "hc-s", note));
        side.append(cap, stage());
        return side;
      }

      // -- one question screen ----------------------------------------------------------------------
      function optionButton(entry: LoadedStep, opt: SetupOption): HTMLElement {
        const { step, options } = entry;
        const key = step.manifest.settingsKey;
        const btn = step.renderOption?.(opt) ?? defaultOptionCard(opt);
        btn.classList.toggle("on", isPressed(opt, draft[key], step.manifest.multi));
        btn.setAttribute("aria-pressed", btn.classList.contains("on") ? "true" : "false");
        if (!btn.querySelector(".on-mark") && btn.classList.contains("opt")) {
          btn.prepend(h("span", "on-mark", "Picked"));
        }
        btn.addEventListener("click", () => {
          draft[key] = step.manifest.multi ? nextMultiSelection(draft[key], opt) : optionValue(opt);
          render(); // presence updates: pressed states + every stage zone
        });
        return btn;
      }

      function defaultOptionCard(opt: SetupOption): HTMLElement {
        const btn = h("button", "opt");
        const title = h("div", "opt-title", opt.title);
        if (opt.isDefault) title.append(h("span", "default-tag", "default"));
        btn.append(title);
        if (opt.sub) btn.append(h("div", "opt-sub", opt.sub));
        return btn;
      }

      function questionScreen(i: number): HTMLElement {
        const entry = steps[i]!;
        const { manifest } = entry.step;
        const screen = h("section", "screen");
        const card = h("div", "qcard");

        const top = h("div", "top");
        const prog = h("div", "prog");
        const dots = h("span", "dots");
        steps.forEach((_, d) => dots.append(h("i", d < i ? "done" : d === i ? "now" : undefined)));
        prog.append(dots, h("span", "step-n", progressLabel(i, steps.length)));
        top.append(lockup(), prog);

        const q = h("h1", "q");
        manifest.question.split("\n").forEach((line, n) => {
          if (n > 0) q.append(document.createElement("br"));
          q.append(document.createTextNode(line));
        });

        const opts = h("div", manifest.layoutClass ?? "stack");
        for (const opt of entry.options) opts.append(optionButton(entry, opt));

        const controls = h("div", "controls");
        const back = h("button", `back${i === 0 ? " ghost" : ""}`, "← Back");
        back.addEventListener("click", () => {
          index = Math.max(0, index - 1);
          render();
        });
        const next = h("button", "next", "Next →");
        next.addEventListener("click", () => {
          index++;
          if (index < steps.length) ensureDefault(index);
          render();
        });
        controls.append(back, next);

        const skip = h("div", "skip");
        const a = h("a", undefined, "Skip all · you can change everything later");
        a.addEventListener("click", () => {
          fillAllDefaults();
          index = steps.length;
          render();
        });
        skip.append(a);

        card.append(top, q, h("p", "q-say", manifest.say), opts, controls, skip);
        screen.append(card, house(manifest.stageNote));
        return screen;
      }

      // -- the final screen ---------------------------------------------------------------------------
      function finalScreen(): HTMLElement {
        const screen = h("section", "screen");
        const card = h("div", "qcard final-card");
        card.append(lockup(), h("h1", "q", "You're set."));

        const summary = h("p", "summary");
        for (const frag of sentencePlan(steps.map((s) => s.step.phrase(draft, s.options)))) {
          if (frag.pre) summary.append(document.createTextNode(frag.pre));
          summary.append(Object.assign(h("b"), { textContent: frag.strong }));
          if (frag.post) summary.append(document.createTextNode(frag.post));
        }

        const recap = h("div", "recap");
        for (const { step, options } of steps) {
          const chip = step.recap(draft, options);
          if (!chip) continue;
          const span = h("span", undefined, `${chip.label} `);
          span.append(Object.assign(h("b"), { textContent: chip.value }));
          recap.append(span);
        }

        const open = h("button", "open", "Open Vaude");
        open.append(h("span", "q2"));
        open.addEventListener("click", finish);

        card.append(summary, recap, open, h("p", "change", "Everything here can change later, whenever you want."));
        screen.append(card, house("fully set"));
        return screen;
      }

      function render(): void {
        root.classList.toggle("final-on", index >= steps.length);
        frame.replaceChildren(index < steps.length ? questionScreen(index) : finalScreen());
      }

      if (steps.length === 0) return finish(); // no steps dropped in = nothing to ask
      ensureDefault(0);
      render();
    })();
  });
}
