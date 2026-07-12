/**
 * RegexSetEditor - the workbench mount point for a regex set. The chassis (header + toc | page | rail,
 * Pattern-mode rule authoring, the try-it rail) lives in ./regex/set-editor; this file only re-exports
 * it so src/ui/apps/workbench/index.tsx keeps importing one stable name.
 */
export { RegexSetEditor, type RegexSetEditorProps } from "./regex/set-editor";
