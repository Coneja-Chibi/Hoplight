/**
 * Chub card-oriented targets. Selectors are generic mocks; real Chub DOM differs.
 * Author CSS still exports as plain string for extensions.chub.custom_css.
 */
import type { CssTargetPack } from "./contract";

const pack: CssTargetPack = {
  id: "chub-card",
  order: 20,
  title: "Chub card",
  blurb: "Mock chat card chrome for Chub custom_css. Real site classes may differ.",
  mockHtml: `
<div class="chub-root">
  <div class="chub-chat">
    <div class="chub-message chub-char">
      <div class="chub-avatar"></div>
      <div class="chub-bubble">
        <div class="chub-name">Character</div>
        <div class="chub-text">Hello. This is a sealed preview of your card CSS.</div>
      </div>
    </div>
    <div class="chub-message chub-user">
      <div class="chub-bubble">
        <div class="chub-name">You</div>
        <div class="chub-text">User message styling goes here.</div>
      </div>
    </div>
  </div>
</div>`.trim(),
  targets: [
    { id: "root", label: "Chat root", selector: ".chub-root" },
    { id: "chat", label: "Chat area", selector: ".chub-chat" },
    { id: "msg", label: "All messages", selector: ".chub-message" },
    { id: "char", label: "Character row", selector: ".chub-char" },
    { id: "user", label: "User row", selector: ".chub-user" },
    { id: "bubble", label: "Bubble", selector: ".chub-bubble" },
    { id: "name", label: "Name", selector: ".chub-name" },
    { id: "text", label: "Message text", selector: ".chub-text" },
    { id: "avatar", label: "Avatar", selector: ".chub-avatar" },
    { id: "free", label: "Free selector", selector: "" },
  ],
};

export default pack;
