/**
 * The one terminal clipboard boundary. OSC52 support and renderer refusal are checked explicitly,
 * and payloads are byte-bounded so Kit never silently asks a terminal to copy a truncated value.
 */
export const OSC52_BYTE_CAP = 50_000;

export interface ClipboardRenderer {
  isOsc52Supported(): boolean;
  copyToClipboardOSC52(text: string): boolean;
}

export type CopyResult = "requested" | "unsupported" | "too-large" | "failed";

export const copyText = (renderer: ClipboardRenderer, text: string): CopyResult => {
  if (!renderer.isOsc52Supported()) return "unsupported";
  if (new TextEncoder().encode(text).byteLength > OSC52_BYTE_CAP) return "too-large";
  return renderer.copyToClipboardOSC52(text) ? "requested" : "failed";
};
