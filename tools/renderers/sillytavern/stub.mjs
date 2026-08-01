/**
 * Stand-in for every SillyTavern application module the macro engine imports.
 *
 * The engine reaches out of its own folder for the browser app around it: script.js, power-user.js,
 * utils.js, popup.js and a dozen more. None of them is needed to expand a macro, but every one has to
 * RESOLVE or the module graph never loads. This module answers for all of them.
 *
 * A proxy rather than a list of stubs on purpose. The set of names imported changes between
 * SillyTavern releases, and a fixed list would fail on the next one with an error naming a symbol
 * nobody has heard of. Anything destructured off this resolves to a callable that returns itself, so
 * an import that is merely present costs nothing and an import that is CALLED does not throw.
 *
 * The few real values are the ones the engine reads rather than calls: it checks flags on
 * `power_user` and passes strings through `substituteParams`, so those have to behave like the shapes
 * they stand for instead of like proxies.
 */
import * as chevrotainPkg from "chevrotain";
import momentPkg from "moment";
import * as seedrandomNs from "seedrandom";
import * as drollNs from "droll";

const any = new Proxy(function () {}, {
  get: (_t, k) => (k === "then" ? undefined : any), // `then` must stay undefined or `await` hangs
  apply: () => any,
  construct: () => any,
});

/**
 * The four libraries the engine takes from SillyTavern's `lib.js`, handed over FOR REAL.
 *
 * The barrel itself is not loaded. It re-exports the whole browser toolkit, some of it CommonJS that
 * only resolves under a bundler, so importing it outside one fails on a package the macro engine
 * never asked for. These four are what the macro folder actually imports (`chevrotain` for the
 * parser it is built on, plus moment, seedrandom and droll for the date and dice macros), and they
 * are ordinary packages sitting in the install's own node_modules.
 *
 * A proxy here would be worse than useless: a stubbed chevrotain yields an engine that loads and
 * cannot parse a single macro, which reads as "your preset has no macros" rather than as a failure.
 */
export const chevrotain = chevrotainPkg;
export const moment = momentPkg;
export const seedrandom = seedrandomNs.default ?? seedrandomNs;
export const droll = drollNs.default ?? drollNs;

export default any;

/** Read, not called: the engine branches on flags here. An empty object means "nothing enabled". */
export const power_user = {};

/**
 * Card fields, returned as real empty STRINGS rather than proxies.
 *
 * The env builder destructures these and feeds them to the name macros. A proxy satisfies the
 * destructuring and then fails inside the macro, which surfaces as `{{user}}` and `{{char}}`
 * arriving unresolved: a preset reported as broken because the harness was, which is the one result
 * this renderer must never produce.
 */
export const getCharacterCardFieldsLazy = () => ({
  description: "",
  personality: "",
  scenario: "",
  first_mes: "",
  mes_example: "",
});
export const getCharacterCardFields = getCharacterCardFieldsLazy;
export const parseMesExamples = () => [];

export const name1 = "User";
export const name2 = "Character";
export const chat = [];
export const characters = [];
export const groups = [];
export const this_chid = 0;
export const selected_group = null;
export const inject_ids = {};
export const event_types = {};
export const eventSource = { on() {}, emit() {}, removeAllListeners() {} };

/** Called with a string and expected to give one back; a proxy would poison the text. */
export const substituteParams = (text) => text;
export const substituteParamsExtended = (text) => text;

export const getContext = () => ({});
export const getStringHash = () => 0;
export const uuidv4 = () => "00000000-0000-0000-0000-000000000000";
export const debounce = (fn) => fn;
export const delay = () => Promise.resolve();
export const t = (strings, ...values) =>
  Array.isArray(strings) ? strings.reduce((out, s, i) => out + s + (values[i] ?? ""), "") : String(strings);

/** Named exports the engine has been seen to destructure. Everything else falls through the proxy. */
export {
  any as extension_settings,
  any as Popup,
  any as POPUP_TYPE,
  any as accountStorage,
  any as SimpleMutex,
};
