/**
 * Host API shims for Risu Lua cards over a plain RisuState (Test Bench / sealed room).
 * Chat transcript + card meta are real local state. Network/LLM/image stay empty (deny-by-absence).
 * Nothing here reaches the real app, filesystem, or network.
 *
 * Every state-mutating capability enforces RisuStateBudget before assignment: failed ops leave state
 * byte-for-byte unchanged. Aggregate host-state bytes are measured with UTF-8 TextEncoder counts.
 */
import type { Capability } from "./engine";
import {
  assertStateWithinBudget,
  LuaResourceLimitError,
  measureHostStateBytes,
  RELEASE_LUA_LIMITS,
  type RisuStateBudget,
  utf8Bytes,
} from "./limits";
import {
  emptyRisuState,
  type RisuCardMeta,
  type RisuChatMessage,
  type RisuState,
} from "./risu-state";
import { asString, asIndex, commitIfBudgeted } from "./risu-host-budget";

export type { RisuState, RisuChatMessage, RisuCardMeta } from "./risu-state";
export { emptyRisuState, emptyMeta, cloneRisuState, stateFromWire, stateToWire } from "./risu-state";
export type { RisuStateBudget } from "./limits";

/**
 * Build card-facing globals over the given state.
 * getChatVar/setChatVar match Risu: (chatId, key[, value]) - chatId ignored in Test Bench.
 */
export function createRisuApi(
  state: RisuState,
  budget: RisuStateBudget = RELEASE_LUA_LIMITS.state,
): { globals: Record<string, Capability> } {
  // Seed must already be legal; reject oversized initial state at the boundary (callers should too).
  assertStateWithinBudget(state, budget);

  const getChatVar: Capability = (...args: unknown[]): string => {
    const key = asString(args.length >= 2 ? args[1] : args[0]);
    return Object.hasOwn(state.chatVars, key) ? state.chatVars[key]! : "";
  };

  const setChatVar: Capability = (...args: unknown[]): void => {
    const key = asString(args.length >= 3 ? args[1] : args[0]);
    const value = asString(args.length >= 3 ? args[2] : args[1]);
    if (utf8Bytes(key) > budget.maxChatVarKeyBytes) {
      throw new LuaResourceLimitError(
        "chat-var",
        `chatVar key ${utf8Bytes(key)} bytes exceeds cap ${budget.maxChatVarKeyBytes}`,
      );
    }
    if (utf8Bytes(value) > budget.maxChatVarValueBytes) {
      throw new LuaResourceLimitError(
        "chat-var",
        `chatVar value ${utf8Bytes(value)} bytes exceeds cap ${budget.maxChatVarValueBytes}`,
      );
    }
    const isNew = !Object.hasOwn(state.chatVars, key);
    if (isNew && Object.keys(state.chatVars).length >= budget.maxChatVarCount) {
      throw new LuaResourceLimitError(
        "chat-var",
        `chatVar count would exceed cap ${budget.maxChatVarCount}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.chatVars[key] = value;
    });
  };

  const log: Capability = (...args: unknown[]): void => {
    const line = asString(args[0]);
    if (utf8Bytes(line) > budget.maxLogEntryBytes) {
      throw new LuaResourceLimitError(
        "log",
        `log entry ${utf8Bytes(line)} bytes exceeds cap ${budget.maxLogEntryBytes}`,
      );
    }
    if (state.log.length >= budget.maxLogCount) {
      throw new LuaResourceLimitError(
        "log",
        `log count would exceed cap ${budget.maxLogCount}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.log.push(line);
    });
  };

  const alertLog =
    (prefix: string): Capability =>
    (...args: unknown[]): string => {
      const msg = asString(args.length >= 2 ? args[1] : args[0]);
      const line = `${prefix}: ${msg}`;
      if (utf8Bytes(line) > budget.maxLogEntryBytes) {
        throw new LuaResourceLimitError(
          "log",
          `log entry ${utf8Bytes(line)} bytes exceeds cap ${budget.maxLogEntryBytes}`,
        );
      }
      if (state.log.length >= budget.maxLogCount) {
        throw new LuaResourceLimitError(
          "log",
          `log count would exceed cap ${budget.maxLogCount}`,
        );
      }
      commitIfBudgeted(state, budget, () => {
        state.log.push(line);
      });
      return "";
    };

  const asyncWrap: Capability = (...args: unknown[]): unknown => args[0];
  const emptyJson: Capability = (): string => "[]";
  const emptyStr: Capability = (): string => "";
  const zero: Capability = (): number => 0;
  const sleep: Capability = (): void => {
    /* Test Bench: no real wait */
  };
  const reload: Capability = (): void => {
    const line = "reload: display (no-op in Test Bench)";
    if (state.log.length >= budget.maxLogCount) {
      throw new LuaResourceLimitError(
        "log",
        `log count would exceed cap ${budget.maxLogCount}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.log.push(line);
    });
  };

  const metaGet =
    (key: keyof RisuCardMeta): Capability =>
    (): string =>
      state.meta[key] ?? "";

  const metaSet =
    (key: keyof RisuCardMeta): Capability =>
    (...args: unknown[]): void => {
      const value = asString(args[0]);
      if (utf8Bytes(value) > budget.maxMetaFieldBytes) {
        throw new LuaResourceLimitError(
          "meta",
          `meta.${key} ${utf8Bytes(value)} bytes exceeds cap ${budget.maxMetaFieldBytes}`,
        );
      }
      commitIfBudgeted(state, budget, () => {
        state.meta[key] = value;
      });
    };

  const getChatLength: Capability = (): number => state.chat.length;

  const getChatAt: Capability = (...args: unknown[]): string => {
    const i = asIndex(args[0], state.chat.length);
    if (i === null) return "";
    return state.chat[i]!.data;
  };

  const getChatRoleAt: Capability = (...args: unknown[]): string => {
    const i = asIndex(args[0], state.chat.length);
    if (i === null) return "";
    return state.chat[i]!.role;
  };

  const getFullChat: Capability = (): string => {
    const json = JSON.stringify(state.chat.map((m) => ({ role: m.role, data: m.data })));
    if (utf8Bytes(json) > budget.maxFullChatJsonBytes) {
      throw new LuaResourceLimitError(
        "wire-size",
        `getFullChat ${utf8Bytes(json)} bytes exceeds cap ${budget.maxFullChatJsonBytes}`,
      );
    }
    return json;
  };

  const pushChat = (msg: RisuChatMessage): void => {
    if (utf8Bytes(msg.role) > budget.maxChatRoleBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat role ${utf8Bytes(msg.role)} bytes exceeds cap ${budget.maxChatRoleBytes}`,
      );
    }
    if (utf8Bytes(msg.data) > budget.maxChatMessageBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat message ${utf8Bytes(msg.data)} bytes exceeds cap ${budget.maxChatMessageBytes}`,
      );
    }
    if (state.chat.length >= budget.maxChatMessageCount) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat length would exceed cap ${budget.maxChatMessageCount}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.chat.push(msg);
    });
  };

  const setChat: Capability = (...args: unknown[]): void => {
    // setChat(index, data) or setChat(data) on last
    if (args.length >= 2) {
      const i = asIndex(args[0], state.chat.length);
      if (i === null) return;
      const data = asString(args[1]);
      if (utf8Bytes(data) > budget.maxChatMessageBytes) {
        throw new LuaResourceLimitError(
          "message-count",
          `chat message ${utf8Bytes(data)} bytes exceeds cap ${budget.maxChatMessageBytes}`,
        );
      }
      commitIfBudgeted(state, budget, () => {
        state.chat[i] = { ...state.chat[i]!, data };
      });
      return;
    }
    if (state.chat.length === 0) {
      pushChat({ role: "char", data: asString(args[0]) });
      return;
    }
    const data = asString(args[0]);
    if (utf8Bytes(data) > budget.maxChatMessageBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat message ${utf8Bytes(data)} bytes exceeds cap ${budget.maxChatMessageBytes}`,
      );
    }
    const last = state.chat.length - 1;
    commitIfBudgeted(state, budget, () => {
      state.chat[last] = { ...state.chat[last]!, data };
    });
  };

  const setChatRole: Capability = (...args: unknown[]): void => {
    const i = asIndex(args[0], state.chat.length);
    if (i === null) return;
    const role = asString(args[1]) || state.chat[i]!.role;
    if (utf8Bytes(role) > budget.maxChatRoleBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat role ${utf8Bytes(role)} bytes exceeds cap ${budget.maxChatRoleBytes}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.chat[i] = { ...state.chat[i]!, role };
    });
  };

  const addChat: Capability = (...args: unknown[]): void => {
    // addChat(role, data) or addChat(data) as char
    if (args.length >= 2) {
      pushChat({ role: asString(args[0]) || "char", data: asString(args[1]) });
      return;
    }
    pushChat({ role: "char", data: asString(args[0]) });
  };

  const insertChat: Capability = (...args: unknown[]): void => {
    // insertChat(index, role, data) or insertChat(index, data)
    const i = asIndex(args[0], state.chat.length + 1);
    if (i === null) return;
    const msg: RisuChatMessage =
      args.length >= 3
        ? { role: asString(args[1]) || "char", data: asString(args[2]) }
        : { role: "char", data: asString(args[1]) };
    if (utf8Bytes(msg.role) > budget.maxChatRoleBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat role ${utf8Bytes(msg.role)} bytes exceeds cap ${budget.maxChatRoleBytes}`,
      );
    }
    if (utf8Bytes(msg.data) > budget.maxChatMessageBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat message ${utf8Bytes(msg.data)} bytes exceeds cap ${budget.maxChatMessageBytes}`,
      );
    }
    if (state.chat.length >= budget.maxChatMessageCount) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat length would exceed cap ${budget.maxChatMessageCount}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.chat.splice(i, 0, msg);
    });
  };

  const removeChat: Capability = (...args: unknown[]): void => {
    const i = asIndex(args[0], state.chat.length);
    if (i === null) return;
    // Shrink always frees budget; no pre-check needed.
    state.chat.splice(i, 1);
  };

  const cutChat: Capability = (...args: unknown[]): void => {
    // cutChat(start, end) half-open when possible
    const start = asIndex(args[0], state.chat.length);
    if (start === null) return;
    const endRaw = args.length >= 2 ? asIndex(args[1], state.chat.length + 1) : state.chat.length;
    const end = endRaw === null ? state.chat.length : Math.max(start, endRaw);
    state.chat.splice(start, end - start);
  };

  const setFullChat: Capability = (...args: unknown[]): void => {
    const raw = asString(args[0]);
    if (utf8Bytes(raw) > budget.maxFullChatJsonBytes) {
      throw new LuaResourceLimitError(
        "wire-size",
        `setFullChat input ${utf8Bytes(raw)} bytes exceeds cap ${budget.maxFullChatJsonBytes}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      /* keep chat on bad JSON */
      return;
    }
    if (!Array.isArray(parsed)) return;
    if (parsed.length > budget.maxChatMessageCount) {
      throw new LuaResourceLimitError(
        "message-count",
        `setFullChat length ${parsed.length} exceeds cap ${budget.maxChatMessageCount}`,
      );
    }
    const next: RisuChatMessage[] = parsed.map((row) => {
      if (typeof row === "string") return { role: "char", data: row };
      if (row && typeof row === "object") {
        const r = row as Record<string, unknown>;
        return { role: asString(r.role) || "char", data: asString(r.data ?? r.content ?? r.message) };
      }
      return { role: "char", data: "" };
    });
    for (const m of next) {
      if (utf8Bytes(m.role) > budget.maxChatRoleBytes) {
        throw new LuaResourceLimitError(
          "message-count",
          `chat role ${utf8Bytes(m.role)} bytes exceeds cap ${budget.maxChatRoleBytes}`,
        );
      }
      if (utf8Bytes(m.data) > budget.maxChatMessageBytes) {
        throw new LuaResourceLimitError(
          "message-count",
          `chat message ${utf8Bytes(m.data)} bytes exceeds cap ${budget.maxChatMessageBytes}`,
        );
      }
    }
    // Atomic swap: build candidate, measure aggregate with temp state, then assign.
    const candidate: RisuState = {
      chatVars: state.chatVars,
      log: state.log,
      chat: next,
      meta: state.meta,
    };
    const total = measureHostStateBytes(candidate);
    if (total > budget.maxHostStateBytes) {
      throw new LuaResourceLimitError(
        "host-state",
        `host state ${total} bytes exceeds cap ${budget.maxHostStateBytes}`,
      );
    }
    state.chat = next;
  };

  const lastByRole =
    (role: string): Capability =>
    (): string => {
      for (let i = state.chat.length - 1; i >= 0; i--) {
        if (state.chat[i]!.role === role) return state.chat[i]!.data;
      }
      return "";
    };

  const stopChat: Capability = (): void => {
    const line = "stopChat: flagged (no live chat to stop)";
    if (state.log.length >= budget.maxLogCount) {
      throw new LuaResourceLimitError(
        "log",
        `log count would exceed cap ${budget.maxLogCount}`,
      );
    }
    commitIfBudgeted(state, budget, () => {
      state.log.push(line);
    });
  };

  return {
    globals: {
      // vars
      getChatVar,
      setChatVar,
      getvar: getChatVar,
      setvar: setChatVar,
      getGlobalVar: getChatVar,
      // logging / UI
      log,
      logMain: log,
      alertError: alertLog("error"),
      alertNormal: alertLog("note"),
      alertInput: alertLog("input"),
      alertSelect: alertLog("select"),
      alertConfirm: alertLog("confirm"),
      alertCustom: alertLog("custom"),
      // chat (real local transcript)
      getChatLength,
      getChatMain: getChatAt,
      getChat: getChatAt,
      getChatRole: getChatRoleAt,
      getFullChatMain: getFullChat,
      getFullChat,
      setChat,
      setChatRole,
      cutChat,
      removeChat,
      addChat,
      insertChat,
      setFullChatMain: setFullChat,
      setFullChat,
      stopChat,
      getCharacterLastMessage: lastByRole("char"),
      getUserLastMessage: lastByRole("user"),
      // meta (seeded from open card)
      getName: metaGet("name"),
      setName: metaSet("name"),
      getDescription: metaGet("description"),
      setDescription: metaSet("description"),
      getCharacterFirstMessage: metaGet("firstMessage"),
      setCharacterFirstMessage: metaSet("firstMessage"),
      getPersonaName: metaGet("personaName"),
      getPersonaDescription: metaGet("personaDescription"),
      getAuthorsNote: metaGet("authorsNote"),
      getBackgroundEmbedding: metaGet("backgroundEmbedding"),
      setBackgroundEmbedding: metaSet("backgroundEmbedding"),
      // display
      reloadDisplay: reload,
      reloadChat: reload,
      updateUI: reload,
      // timing
      sleep,
      async: asyncWrap,
      // power APIs stay weak - no network, no model, no image
      getTokens: zero,
      cbs: emptyStr,
      similarity: emptyJson,
      request: emptyStr,
      generateImage: emptyStr,
      getCharacterImageMain: emptyStr,
      getPersonaImageMain: emptyStr,
      hash: emptyStr,
      LLMMain: emptyStr,
      simpleLLM: emptyStr,
      axLLMMain: emptyStr,
      getLoreBooksMain: emptyJson,
      upsertLocalLoreBook: emptyStr,
      loadLoreBooksMain: emptyJson,
      getField: emptyStr,
      getActive: emptyStr,
      // listenEdit real body lives in Lua prelude when prepended
      listenEdit: emptyStr,
    },
  };
}

/** Seed chatVars only (legacy). Prefer seedRisuBench for full meta/chat. */
export function seedRisuState(
  rows: ReadonlyArray<{ name: string; value: string }>,
): RisuState {
  const state = emptyRisuState();
  for (const r of rows) {
    if (r.name) state.chatVars[r.name] = r.value;
  }
  return state;
}

/** Diff chatVars before/after a run for the Test Bench pills. */
export function diffChatVars(
  before: Record<string, string>,
  after: Record<string, string>,
): Array<{ name: string; before: string; after: string; moved: boolean }> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].map((name) => ({
    name,
    before: before[name] ?? "",
    after: after[name] ?? "",
    moved: (before[name] ?? "") !== (after[name] ?? ""),
  }));
}

