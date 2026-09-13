/** Shared Bun browser-bundle helpers for the desktop bake and static Pages build. */
export const REACT_EXTERNALS = ["react", "react/jsx-runtime", "react-dom/client", "react-dom"];

/** Fold Bun's separate CSS-module artifact into its owning JavaScript module. */
export async function withCssInjected(outputs: Bun.BuildArtifact[]): Promise<string> {
  let js = "";
  let css = "";
  for (const output of outputs) {
    if (output.path.endsWith(".css")) css += await output.text();
    else js += await output.text();
  }
  if (!css) return js;
  const inject =
    `{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";` +
    `s.textContent=${JSON.stringify(css)};document.head.append(s);}\n`;
  return inject + js;
}

export async function bundleBrowser(
  entry: string,
  external: string[] = REACT_EXTERNALS,
): Promise<string> {
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm", external });
  if (!built.success) {
    throw new Error(`bundle failed for ${entry}: ${built.logs.map((log) => log.message).join("; ")}`);
  }
  return withCssInjected(built.outputs);
}

export const VENDOR_SPECS: Record<string, { entry: string; external: string[] }> = {
  "react-family": { entry: "vendor/react-family.ts", external: [] },
  "react-dom-client": { entry: "vendor/react-dom-client.ts", external: ["react"] },
};
