/**
 * Ambient module declaration for CSS Modules (*.module.css). Bun's bundler resolves these natively
 * at build/dev time into a class-name map (docs/bundler/css.mdx); tsc needs this shape declared to
 * type-check the import. Ambient, so it applies to every *.module.css import under src/ui.
 */
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}
