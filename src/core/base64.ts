/** Runtime-neutral base64 helpers for codecs shared by Bun and browsers. */
const CHUNK = 0x8000;
const CANONICAL = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

interface HostBuffer {
  from(value: string | Uint8Array, encoding?: string): Uint8Array & { toString(encoding?: string): string };
}

const hostBuffer = (): HostBuffer | undefined =>
  (globalThis as typeof globalThis & { Buffer?: HostBuffer }).Buffer;

export function bytesToBase64(bytes: Uint8Array): string {
  const buffer = hostBuffer();
  if (buffer) return buffer.from(bytes).toString("base64");
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(encoded: string): Uint8Array {
  if (!CANONICAL.test(encoded)) throw new TypeError("invalid base64");
  const buffer = hostBuffer();
  if (buffer) return new Uint8Array(buffer.from(encoded, "base64"));
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const utf8ToBase64 = (value: string): string => {
  const buffer = hostBuffer();
  return buffer ? buffer.from(value, "utf8").toString("base64") : bytesToBase64(new TextEncoder().encode(value));
};

export const base64ToUtf8 = (value: string): string => {
  if (!CANONICAL.test(value)) throw new TypeError("invalid base64");
  const buffer = hostBuffer();
  return buffer ? buffer.from(value, "base64").toString("utf8") : new TextDecoder().decode(base64ToBytes(value));
};
