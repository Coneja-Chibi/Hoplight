/**
 * Pure helpers for canonical Voice (provider + voiceId + rate/pitch + disabled + extras).
 * Agnai wire maps service <-> provider and voiceDisabled <-> disabled in the format adapter.
 */
export const VOICE_SERVICES = [
  "elevenlabs",
  "webspeechsynthesis",
  "novel",
  "agnaistic",
  "openai",
  "vits",
] as const;

export type VoiceService = (typeof VOICE_SERVICES)[number] | string;

/** Canonical Voice shape (entities/character Voice). */
export interface VoiceValue {
  provider: string;
  voiceId: string;
  rate: number;
  pitch: number;
  disabled: boolean;
  extras: Record<string, string>;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Tolerant read of canonical Voice or legacy Agnai wire ({ service }).
 * Empty/missing -> sensible defaults (not written until the user edits).
 */
export function normalizeVoice(raw: unknown): VoiceValue {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { provider: "agnaistic", voiceId: "", rate: 1, pitch: 0, disabled: false, extras: {} };
  }
  const r = raw as Record<string, unknown>;
  const {
    provider,
    service,
    voiceId,
    rate,
    pitch,
    disabled,
    extras: rawExtras,
    ...rest
  } = r;
  const extras: Record<string, string> = {};
  if (rawExtras && typeof rawExtras === "object" && !Array.isArray(rawExtras)) {
    for (const [k, v] of Object.entries(rawExtras as Record<string, unknown>)) {
      if (v == null) continue;
      extras[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : JSON.stringify(v);
    }
  }
  for (const [k, v] of Object.entries(rest)) {
    if (v == null) continue;
    extras[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : JSON.stringify(v);
  }
  return {
    provider: str(provider) || str(service) || "agnaistic",
    voiceId: str(voiceId),
    rate: num(rate, 1),
    pitch: num(pitch, 0),
    disabled: disabled === true,
    extras,
  };
}

/** Emit canonical Voice object for body.persona.voice (omit default rate/pitch noise). */
export function voiceToCanonical(v: VoiceValue): Record<string, unknown> {
  const out: Record<string, unknown> = { provider: v.provider };
  if (v.voiceId) out.voiceId = v.voiceId;
  if (v.rate !== 1) out.rate = v.rate;
  if (v.pitch !== 0) out.pitch = v.pitch;
  if (v.disabled) out.disabled = true;
  if (Object.keys(v.extras).length > 0) {
    const extras: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.extras)) {
      if (!val) continue;
      const n = Number(val);
      extras[k] = val.trim() !== "" && Number.isFinite(n) && String(n) === val.trim() ? n : val;
    }
    if (Object.keys(extras).length > 0) out.extras = extras;
  }
  return out;
}

/** @deprecated use voiceToCanonical; kept for call sites mid-migration */
export const voiceToWire = voiceToCanonical;
