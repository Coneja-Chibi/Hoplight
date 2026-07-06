/**
 * Sanitize a drop-in app's mark SVG (moved verbatim out of the old boot.ts). The dock invites
 * third-party drop-in apps, so a manifest's `markSvg` is untrusted by doctrine (deny by absence).
 * Only static drawing survives: scripts, foreignObject, use/href indirection, and every on* handler
 * are stripped; a non-svg root is refused. This is NOT the IconBox seed (trusted, first-party
 * marks only) - Dock.tsx grafts the result in via its own ref + importNode, never innerHTML.
 */
export function sanitizeSvg(markup: string): SVGSVGElement | null {
  // tolerate manifests that omit xmlns (without it the parsed nodes never draw)
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
