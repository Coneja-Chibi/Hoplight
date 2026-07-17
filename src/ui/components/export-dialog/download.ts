/**
 * Pure helpers to turn an ExportResult into a browser download (imperative edge is the caller).
 */
export interface ExportPayload {
  suggestedExtension: string;
  text?: string;
  bytesB64?: string;
}

/** Build a Blob + filename for a successful export payload. */
export function exportBlob(payload: ExportPayload, baseName: string): { blob: Blob; filename: string } {
  const ext = payload.suggestedExtension.replace(/^\./, "") || "bin";
  const safe = (baseName.trim() || "card").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80);
  const filename = `${safe}.${ext}`;
  if (typeof payload.text === "string") {
    return { blob: new Blob([payload.text], { type: "application/octet-stream" }), filename };
  }
  if (payload.bytesB64) {
    const bin = atob(payload.bytesB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: "application/octet-stream" }), filename };
  }
  throw new Error("export: empty payload (no text or bytes)");
}

/** Trigger a one-shot object-URL download (DOM edge). */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
