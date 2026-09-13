{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/components/stamp/styles.module.css */\n.topbtn_XRqkoA {\n  display: flex;\n  font-family: var(--font-big);\n  letter-spacing: .13em;\n  text-transform: uppercase;\n  color: var(--text);\n  background: var(--chrome);\n  cursor: pointer;\n  align-items:  center;\n  gap: .4rem;\n  padding: .45rem .7rem;\n  font-size: .625rem;\n  font-weight: 800;\n}\n\n.topbtn_XRqkoA svg {\n  display: block;\n}\n\n.topbtn_XRqkoA:disabled {\n  opacity: .45;\n  cursor: default;\n  pointer-events: none;\n}\n\n/* src/ui/apps/app-catalog/styles.module.css */\n.room_2PAwkA {\n  container-type: inline-size;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  gap: clamp(1rem, 2vw, 1.6rem);\n  min-height: 0;\n  padding: clamp(1rem, 3vw, 2.2rem);\n}\n\n.head_2PAwkA {\n  max-width: 52rem;\n}\n\n.eyebrow_2PAwkA, .status_2PAwkA {\n  font-family: var(--font-mono);\n  letter-spacing: .14em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .65rem;\n  font-weight: 800;\n}\n\n.title_2PAwkA {\n  font-family: var(--font-big);\n  font-size: var(--text-title);\n  color: var(--text);\n  margin: .25rem 0 .45rem;\n  line-height: 1;\n}\n\n.lede_2PAwkA, .description_2PAwkA {\n  color: var(--text-soft);\n  margin: 0;\n  line-height: 1.45;\n}\n\n.grid_2PAwkA {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));\n  gap: 1rem;\n}\n\n.card_2PAwkA {\n  position: relative;\n  display: flex;\n  background: var(--face);\n  border: 3px solid var(--edge);\n  box-shadow: 5px 5px 0 0 var(--a);\n  flex-direction: column;\n  gap: .8rem;\n  min-width: 0;\n  padding: 1rem;\n}\n\n.cardHead_2PAwkA {\n  display: flex;\n  align-items:  center;\n  gap: .75rem;\n}\n\n.mark_2PAwkA {\n  display: grid;\n  color: var(--stage-ink);\n  background: var(--a);\n  border: 3px solid var(--edge);\n  flex: none;\n  place-items:  center;\n  width: 2.6rem;\n  height: 2.6rem;\n}\n\n.mark_2PAwkA svg {\n  width: 1.2rem;\n  height: 1.2rem;\n}\n\n.name_2PAwkA {\n  font-family: var(--font-big);\n  color: var(--text);\n  min-width: 0;\n  margin: 0;\n  font-size: 1rem;\n  line-height: 1.1;\n}\n\n.description_2PAwkA {\n  flex: 1;\n  font-size: .9rem;\n}\n\n.cardFoot_2PAwkA {\n  display: flex;\n  justify-content: space-between;\n  align-items:  center;\n  gap: .75rem;\n}\n\n@container (width <= 38rem) {\n  .cardFoot_2PAwkA {\n    align-items:  flex-start;\n    flex-direction: column;\n  }\n}\n";document.head.append(s);}
// src/ui/apps/app-catalog/index.tsx
import { useEffect as useEffect2 } from "react";

// src/ui/components/app-mark/index.tsx
import { useEffect, useRef } from "react";

// src/ui/_shared/sanitize-svg.ts
function sanitizeSvg(markup) {
  const withNs = markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const doc = new DOMParser().parseFromString(withNs, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror"))
    return null;
  const banned = new Set(["script", "foreignobject", "use", "animate", "set", "iframe"]);
  for (const node of [root, ...root.querySelectorAll("*")]) {
    if (banned.has(node.nodeName.toLowerCase())) {
      node.remove();
      continue;
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "href" || name === "xlink:href")
        node.removeAttribute(attr.name);
    }
  }
  return document.importNode(root, true);
}

// src/ui/components/app-mark/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
function AppMark({ markSvg, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current;
    if (!box)
      return;
    box.replaceChildren();
    const svg = sanitizeSvg(markSvg);
    if (svg)
      box.append(svg);
  }, [markSvg]);
  return /* @__PURE__ */ jsxDEV("span", {
    ref,
    className
  }, undefined, false, undefined, this);
}

// src/ui/components/stamp/index.tsx
import { useMemo } from "react";

// src/ui/components/stamp/styles.module.css
var styles_module_default = {
  topbtn: "topbtn_XRqkoA"
};

// src/ui/components/stamp/index.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
function Stamp({
  children,
  onClick,
  disabled,
  accent,
  title,
  type = "button",
  id,
  "aria-label": ariaLabel
}) {
  const style = useMemo(() => accent ? { background: accent } : undefined, [accent]);
  return /* @__PURE__ */ jsxDEV2("button", {
    id,
    type,
    className: `stamp ${styles_module_default.topbtn}`,
    style,
    onClick,
    disabled,
    title,
    "aria-label": ariaLabel,
    children
  }, undefined, false, undefined, this);
}

// src/ui/apps/app-catalog/catalog-core.ts
function officialCatalogApps(manifests) {
  return manifests.filter((app) => !app.comingSoon && !app.dockFoot && !app.appCatalog).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

// src/ui/apps/app-catalog/styles.module.css
var styles_module_default2 = {
  room: "room_2PAwkA",
  head: "head_2PAwkA",
  eyebrow: "eyebrow_2PAwkA",
  status: "status_2PAwkA",
  title: "title_2PAwkA",
  lede: "lede_2PAwkA",
  description: "description_2PAwkA",
  grid: "grid_2PAwkA",
  card: "card_2PAwkA",
  cardHead: "cardHead_2PAwkA",
  mark: "mark_2PAwkA",
  name: "name_2PAwkA",
  cardFoot: "cardFoot_2PAwkA"
};

// src/ui/apps/app-catalog/index.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/>' + '<rect x="4" y="14" width="6" height="6"/><path d="M17 14v6M14 17h6"/></svg>';
var descriptionFor = (app) => app.agentSurface?.describe ?? `${app.title} is included with this build of Hoplight.`;
function AppCard({ app, ctx }) {
  return /* @__PURE__ */ jsxDEV3("article", {
    className: styles_module_default2.card,
    style: { "--a": app.accent },
    children: [
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default2.cardHead,
        children: [
          /* @__PURE__ */ jsxDEV3(AppMark, {
            markSvg: app.markSvg,
            className: styles_module_default2.mark
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3("h2", {
            className: styles_module_default2.name,
            children: app.title
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV3("p", {
        className: styles_module_default2.description,
        children: descriptionFor(app)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default2.cardFoot,
        children: [
          /* @__PURE__ */ jsxDEV3("span", {
            className: styles_module_default2.status,
            children: app.catalogOnly ? "Included app" : "On your Dock"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3(Stamp, {
            onClick: () => ctx.openApp(app.id),
            children: "Open"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function AppCatalog({ ctx }) {
  const apps = officialCatalogApps(ctx.apps());
  useEffect2(() => {
    ctx.setStatus(`apps · ${apps.length} included`);
  }, [apps.length, ctx]);
  return /* @__PURE__ */ jsxDEV3("div", {
    className: styles_module_default2.room,
    children: [
      /* @__PURE__ */ jsxDEV3("header", {
        className: styles_module_default2.head,
        children: [
          /* @__PURE__ */ jsxDEV3("span", {
            className: styles_module_default2.eyebrow,
            children: "Apps in this build"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3("h1", {
            className: styles_module_default2.title,
            children: "Official Hoplight apps"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3("p", {
            className: styles_module_default2.lede,
            children: "Everything here shipped with this copy of Hoplight. Open a room when you need it; compact specialist tools stay here instead of crowding your everyday Dock."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV3("section", {
        className: styles_module_default2.grid,
        "aria-label": "Official packaged apps",
        children: apps.map((app) => /* @__PURE__ */ jsxDEV3(AppCard, {
          app,
          ctx
        }, app.id, false, undefined, this))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var app = {
  manifest: {
    id: "app-catalog",
    title: "Apps",
    markSvg: MARK_SVG,
    accent: "#5b8def",
    order: 80,
    catalogOnly: true,
    appCatalog: true,
    agentSurface: { describe: "Catalog of official applications packaged with this build of Hoplight." }
  },
  Component: AppCatalog
};
var app_catalog_default = app;
export {
  app_catalog_default as default,
  AppCatalog
};
