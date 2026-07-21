/**
 * Sanitize a drop-in app's untrusted mark SVG. Only static drawing survives: scripts,
 * foreignObject, use/href indirection, animation, frames, and event handlers are stripped.
 */
export function sanitizeSvg(markup: string): SVGSVGElement | null {
  const withNs = markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const doc = new DOMParser().parseFromString(withNs, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;
  const banned = new Set(["script", "foreignobject", "use", "animate", "set", "iframe"]);
  for (const node of [root, ...root.querySelectorAll("*")]) {
    if (banned.has(node.nodeName.toLowerCase())) {
      node.remove();
      continue;
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "href" || name === "xlink:href") node.removeAttribute(attr.name);
    }
  }
  return document.importNode(root, true) as unknown as SVGSVGElement;
}
