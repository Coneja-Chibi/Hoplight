/**
 * Risu backdrop targets for behavior.backgroundCSS (pairs with backgroundHTML).
 */
import type { CssTargetPack } from "./contract";

const pack: CssTargetPack = {
  id: "risu-backdrop",
  order: 30,
  title: "Risu backdrop",
  blurb: "Game-screen / backdrop shell for Risu backgroundCSS.",
  mockHtml: `
<div class="risu-stage">
  <div class="risu-panel">
    <h1 class="risu-title">Scene title</h1>
    <p class="risu-body">Backdrop HTML + CSS live here in chat.</p>
    <div class="risu-hud"><span class="risu-stat">HP 12</span><span class="risu-stat">Gold 3</span></div>
  </div>
</div>`.trim(),
  targets: [
    { id: "stage", label: "Stage", selector: ".risu-stage" },
    { id: "panel", label: "Panel", selector: ".risu-panel" },
    { id: "title", label: "Title", selector: ".risu-title" },
    { id: "body", label: "Body", selector: ".risu-body" },
    { id: "hud", label: "HUD", selector: ".risu-hud" },
    { id: "stat", label: "Stat chip", selector: ".risu-stat" },
    { id: "free", label: "Free selector", selector: "" },
  ],
};

export default pack;
