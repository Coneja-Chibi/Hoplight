/**
 * The `SillyTavern` global the macro engine reads its variable store out of.
 *
 * THIS ONE CANNOT BE A STUB. Everything else the engine imports is scaffolding it merely has to
 * resolve, but variables are the substance: `{{setvar}}` writes here and `{{getvar}}` reads back, so
 * a proxy would make every variable read empty and the render would report a preset whose state
 * layer does nothing. That is the exact failure this renderer exists to detect, arriving as a false
 * positive instead of a finding.
 *
 * Values are stored as STRINGS because the engine treats them that way: `{{getvar}}` interpolates
 * into text, and a preset comparing a flag against "1" must see "1" and not 1.
 */
class VarStore {
  constructor() {
    this.data = new Map();
  }

  /** An indexed write keeps the whole object JSON-encoded under one key, which is how ST stores arrays. */
  set(name, value, opts = {}) {
    if (opts.index !== undefined) {
      let obj = this.data.get(name);
      if (typeof obj === "string") {
        try { obj = JSON.parse(obj); } catch { obj = {}; }
      }
      if (typeof obj !== "object" || obj === null) obj = {};
      obj[opts.index] = value;
      this.data.set(name, JSON.stringify(obj));
      return value;
    }
    this.data.set(name, String(value));
    return value;
  }

  get(name, opts = {}) {
    if (opts.index !== undefined) {
      const raw = this.data.get(name);
      if (raw === undefined) return "";
      try {
        return JSON.parse(raw)[opts.index] ?? "";
      } catch {
        return "";
      }
    }
    return this.data.get(name) ?? "";
  }

  /**
   * Numeric when both sides are plainly numbers, string append otherwise.
   *
   * The split matters: presets use `addvar` for both running totals and for building up a ledger by
   * concatenation, and treating "3" + "4" as "34" or "a" + "b" as NaN would each break one of them.
   */
  add(name, value) {
    const cur = this.data.get(name) ?? "";
    const numeric = (v) => /^-?\d+(\.\d+)?$/.test(String(v).trim());
    if (numeric(cur) && numeric(value)) {
      const sum = parseFloat(cur) + parseFloat(value);
      this.data.set(name, String(sum));
      return sum;
    }
    const out = String(cur) + String(value);
    this.data.set(name, out);
    return out;
  }

  inc(name) {
    const next = (parseFloat(this.data.get(name) ?? "0") || 0) + 1;
    this.data.set(name, String(next));
    return next;
  }

  dec(name) {
    const next = (parseFloat(this.data.get(name) ?? "0") || 0) - 1;
    this.data.set(name, String(next));
    return next;
  }

  has(name) { return this.data.has(name); }
  del(name) { this.data.delete(name); }
  clear() { this.data.clear(); }
}

export const variables = { local: new VarStore(), global: new VarStore() };

export function getContext() {
  return {
    variables,
    chat: [],
    chatId: "hoplight-render",
    characterId: 0,
    groupId: null,
    name1: "User",
    name2: "Character",
  };
}

/** Mounted where the engine looks for it, before any engine module evaluates. */
export function installContext() {
  globalThis.SillyTavern ??= { getContext };
  return variables;
}
