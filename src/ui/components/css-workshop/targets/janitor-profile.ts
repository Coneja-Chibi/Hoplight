/**
 * Janitor profile CSS targets. Class IDs on the live site rot; this pack uses
 * stable mock classes + honesty help. Export is still plain CSS the user pastes.
 */
import type { CssTargetPack } from "./contract";

const pack: CssTargetPack = {
  id: "janitor-profile",
  order: 40,
  title: "Janitor profile",
  blurb: "Profile cosmetics (not cards). Live JAI class ids change; use Inspect if a selector fails.",
  mockHtml: `
<div class="jai-page">
  <aside class="jai-profile-card">
    <div class="jai-pfp"></div>
    <div class="jai-username">Creator</div>
    <div class="jai-followers">1.2k followers</div>
    <button type="button" class="jai-follow">Follow</button>
  </aside>
  <section class="jai-bots">
    <article class="jai-bot-card">
      <div class="jai-bot-img"></div>
      <div class="jai-bot-name">Bot name</div>
      <div class="jai-bot-preview">Bio preview text…</div>
      <span class="jai-bot-tag">tag</span>
    </article>
  </section>
</div>`.trim(),
  targets: [
    { id: "page", label: "Page", selector: ".jai-page" },
    { id: "profile", label: "Profile card", selector: ".jai-profile-card" },
    { id: "pfp", label: "Profile pic", selector: ".jai-pfp" },
    { id: "username", label: "Username", selector: ".jai-username" },
    { id: "follow", label: "Follow button", selector: ".jai-follow" },
    { id: "bot", label: "Bot card", selector: ".jai-bot-card" },
    { id: "botname", label: "Bot name", selector: ".jai-bot-name" },
    { id: "preview", label: "Bot preview", selector: ".jai-bot-preview" },
    { id: "tag", label: "Bot tag", selector: ".jai-bot-tag" },
    { id: "free", label: "Free selector", selector: "", help: "Paste a live .css-* id from Inspect" },
  ],
};

export default pack;
