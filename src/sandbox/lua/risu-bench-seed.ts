/**
 * Pure seeders: character draft body + Test Bench vars -> RisuState for sealed runs.
 * No DOM, no IO. Workshop and tools call this before runModuleLua.
 */
import {
  emptyMeta,
  emptyRisuState,
  type RisuCardMeta,
  type RisuChatMessage,
  type RisuState,
} from "./risu-state";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Pull display meta from a canonical character body (tolerant). */
export function metaFromCharacterBody(body: unknown): RisuCardMeta {
  const meta = emptyMeta();
  if (!isRec(body)) return meta;
  const identity = isRec(body.identity) ? body.identity : {};
  const persona = isRec(body.persona) ? body.persona : {};
  const prompts = isRec(body.prompts) ? body.prompts : {};
  meta.name = str(identity.name);
  meta.description = str(identity.description);
  meta.personaName = str(identity.nickname) || "you";
  meta.personaDescription = str(persona.personality);
  meta.authorsNote = str(prompts.postHistoryInstructions) || str(prompts.systemPrompt);

  const greetings = body.greetings;
  if (Array.isArray(greetings) && greetings[0]) {
    const g0 = greetings[0];
    meta.firstMessage = typeof g0 === "string" ? g0 : str(isRec(g0) ? g0.text : "");
  }
  return meta;
}

/** Default two-bubble transcript so getChat* has something honest to return. */
export function defaultBenchChat(meta: RisuCardMeta): RisuChatMessage[] {
  const first = meta.firstMessage.trim() || "(no first message on this card)";
  return [
    { role: "char", data: first },
    { role: "user", data: "Hello." },
  ];
}

export interface SeedRisuBenchArgs {
  vars: ReadonlyArray<{ name: string; value: string }>;
  /** Canonical character body (optional). */
  body?: unknown;
  /** Override chat; default seeds from first message. */
  chat?: RisuChatMessage[];
}

/** Build a full Test Bench RisuState ready for createRisuApi / runModuleLua. */
export function seedRisuBench(args: SeedRisuBenchArgs): RisuState {
  const state = emptyRisuState();
  for (const r of args.vars) {
    if (r.name) state.chatVars[r.name] = r.value;
  }
  state.meta = metaFromCharacterBody(args.body);
  state.chat = args.chat ? args.chat.map((m) => ({ ...m })) : defaultBenchChat(state.meta);
  return state;
}
