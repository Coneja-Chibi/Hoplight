/**
 * Settings - built entirely from DROP-IN SECTIONS (sections/registry): the tab bar derives from
 * the registry, each tab renders its section's controls, and every control is call-and-response
 * against the live settings (the shell applies theme/accent instantly). Adding a settings tab =
 * one file + one registry line; this room names no section.
 */
import type { AppContext, VaudeApp } from "../../app-contract";
import { h } from "./section-contract";
import { settingsSections } from "./sections/registry";

/** the locked gear mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.1"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>';

const STYLE = `
.setroom{flex:1;min-height:0;display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem)}
.set-tabs{display:flex;gap:.4rem;flex-wrap:wrap;flex:none}
.set-tab{font-family:var(--font-big);font-weight:800;font-size:.6875rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--text-dim);background:var(--face);border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);padding:.4rem .8rem;cursor:pointer;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.set-tab:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.set-tab.on{background:var(--stamp-bg);color:var(--stamp-fg);box-shadow:3px 3px 0 0 var(--accent)}
.set-body{flex:1;min-height:0;overflow-y:auto;background:var(--shell-panel);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:clamp(.8rem,2vw,1.4rem);display:flex;flex-direction:column;gap:1rem}
.set-row{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  border-bottom:2px solid var(--seam);padding-bottom:1rem}
.set-row:last-child{border-bottom:none;padding-bottom:0}
.set-tx{min-width:12rem;flex:1}
.set-label{font-family:var(--font-big);font-weight:800;font-size:.9rem;color:var(--text)}
.set-hint{font-size:.95rem;color:var(--text-dim);margin-top:.15rem}
.set-seg{display:flex;flex-wrap:wrap;border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge)}
.set-seg button{border:none;border-left:3px solid var(--edge);background:var(--face);color:var(--text-dim);
  font-family:var(--font-big);font-weight:800;font-size:.6875rem;letter-spacing:.08em;text-transform:uppercase;
  padding:.45rem .8rem;cursor:pointer}
.set-seg button:first-child{border-left:none}
.set-seg button.on{background:var(--stamp-bg);color:var(--stamp-fg)}
.set-plates{display:flex;gap:.4rem;flex-wrap:wrap;max-width:26rem}
.set-plate{font-family:var(--font-mono);font-size:.6875rem;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:var(--text-dim);background:transparent;border:2px dashed var(--text-faint);
  padding:.45rem .7rem;cursor:pointer}
.set-plate.on{border:3px solid var(--accent);border-style:solid;color:var(--text);background:var(--face)}
.setroom *{scrollbar-width:thin;scrollbar-color:#2b2833 transparent}
@media(max-width:40rem){
  .setroom{padding:.5rem;gap:.5rem}
  .set-row{flex-direction:column;gap:.5rem}
}
`;

function render(ctx: AppContext, activeId: string): void {
  const sections = settingsSections();
  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  if (!active) return;

  const room = h("div", "setroom");
  const style = document.createElement("style");
  style.textContent = STYLE;
  room.append(style);

  const tabs = h("div", "set-tabs");
  for (const s of sections) {
    const b = h("button", `set-tab${s.id === active.id ? " on" : ""}`, s.label);
    b.addEventListener("click", () => render(ctx, s.id));
    tabs.append(b);
  }
  const body = h("div", "set-body");
  void active.render(ctx, body);

  room.append(tabs, body);
  ctx.root.replaceChildren(room);
  ctx.setStatus(active.label.toLowerCase());
}

const app: VaudeApp = {
  manifest: {
    id: "settings",
    title: "Settings",
    markSvg: MARK_SVG,
    accent: "#8a8496",
    order: 100,
    subtitle: "app",
    dockFoot: true,
  },
  mount(ctx) {
    render(ctx, settingsSections()[0]?.id ?? "");
  },
};

export default app;
