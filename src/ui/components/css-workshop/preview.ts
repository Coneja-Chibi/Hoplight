/**
 * Sealed preview srcDoc builder for CssWorkshop. CSP + sandbox boundary.
 * Never injects into Studio chrome.
 */
import DOMPurify from "dompurify";
import { sanitizeWorkshopCss } from "./sanitize";

const BASE_MOCK_CSS = `
html, body {
  margin: 0;
  padding: 0;
  max-width: 100%;
  overflow: auto;
  font-family: system-ui, sans-serif;
  background: #0c0b10;
  color: #e8e4ef;
}
.page, .chub-root, .risu-stage, .jai-page {
  min-height: 100%;
  padding: 12px;
  box-sizing: border-box;
}
.card, .chub-bubble, .risu-panel, .jai-profile-card, .jai-bot-card {
  background: #1a1820;
  border: 1px solid #2e2a38;
  border-radius: 8px;
  padding: 12px;
}
.avatar, .chub-avatar, .jai-pfp, .jai-bot-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3a3548;
  flex-shrink: 0;
}
.card-header, .chub-message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
}
.name, .chub-name, .jai-username, .jai-bot-name, .risu-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
.body, .chub-text, .jai-bot-preview, .risu-body {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: #c9c2d6;
}
.tag, .jai-bot-tag, .risu-stat {
  display: inline-block;
  margin: 4px 4px 0 0;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #3a3545;
  font-size: 0.75rem;
}
.chub-user .chub-bubble { margin-left: auto; max-width: 85%; }
.jai-follow {
  margin-top: 8px;
  padding: 6px 12px;
  border: 1px solid #5b4d7a;
  background: #2a2440;
  color: #efeaf8;
  border-radius: 6px;
}
`.trim();

const FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "frame",
  "frameset",
];

/** Build a sealed srcDoc for mockHtml + author CSS. */
export function buildCssWorkshopSrcDoc(mockHtml: string, authorCss: string): string {
  const cleanHtml = DOMPurify.sanitize(mockHtml || "", {
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target", "type", "aria-hidden"],
  });
  // buttons in mock are decorative; if stripped, fine
  const cleanCss = sanitizeWorkshopCss(authorCss);
  const csp =
    "default-src 'none'; img-src data: blob: https: http:; media-src data: blob:; " +
    "style-src 'unsafe-inline'; script-src 'none'; font-src 'none'; connect-src 'none'; " +
    "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return (
    `<!doctype html><html><head>` +
    `<meta charset="utf-8"/>` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}"/>` +
    `<style>${BASE_MOCK_CSS}</style>` +
    `<style>${cleanCss}</style>` +
    `</head><body>${cleanHtml}</body></html>`
  );
}
