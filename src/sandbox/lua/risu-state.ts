/**
 * Plain serializable Test Bench state for Risu Lua host shims.
 * Crosses the worker boundary as JSON data (functions never cross).
 */

export interface RisuChatMessage {
  /** "user" | "char" | "system" | open string */
  role: string;
  /** message body text */
  data: string;
}

export interface RisuCardMeta {
  name: string;
  description: string;
  firstMessage: string;
  personaName: string;
  personaDescription: string;
  authorsNote: string;
  backgroundEmbedding: string;
}

export interface RisuState {
  chatVars: Record<string, string>;
  log: string[];
  /** Fake chat transcript the card may read/write in the sealed room. */
  chat: RisuChatMessage[];
  /** Character / persona fields seeded from the open card. */
  meta: RisuCardMeta;
}

export const emptyMeta = (): RisuCardMeta => ({
  name: "",
  description: "",
  firstMessage: "",
  personaName: "",
  personaDescription: "",
  authorsNote: "",
  backgroundEmbedding: "",
});

export const emptyRisuState = (): RisuState => ({
  chatVars: {},
  log: [],
  chat: [],
  meta: emptyMeta(),
});

/** Deep-ish clone safe for postMessage / before-after diffs. */
export function cloneRisuState(state: RisuState): RisuState {
  return {
    chatVars: { ...state.chatVars },
    log: [...state.log],
    chat: state.chat.map((m) => ({ role: m.role, data: m.data })),
    meta: { ...state.meta },
  };
}

/**
 * Snapshot subset that crosses the worker boundary (no functions).
 * Older callers may only send chatVars.
 */
export interface RisuStateWire {
  chatVars?: Record<string, string>;
  chat?: RisuChatMessage[];
  meta?: Partial<RisuCardMeta>;
  log?: string[];
}

export function stateFromWire(wire: RisuStateWire | undefined): RisuState {
  const base = emptyRisuState();
  if (!wire) return base;
  if (wire.chatVars) base.chatVars = { ...wire.chatVars };
  if (Array.isArray(wire.chat)) {
    base.chat = wire.chat.map((m) => ({
      role: typeof m?.role === "string" ? m.role : "char",
      data: typeof m?.data === "string" ? m.data : String(m?.data ?? ""),
    }));
  }
  if (wire.meta && typeof wire.meta === "object") {
    base.meta = { ...base.meta, ...wire.meta };
  }
  if (Array.isArray(wire.log)) base.log = wire.log.map(String);
  return base;
}

export function stateToWire(state: RisuState): RisuStateWire {
  return {
    chatVars: { ...state.chatVars },
    chat: state.chat.map((m) => ({ role: m.role, data: m.data })),
    meta: { ...state.meta },
    log: [...state.log],
  };
}
