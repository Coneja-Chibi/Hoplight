/** The engine core. Pure TypeScript, zero UI, zero framework, zero DB. */
export * from "./canonical";
export * from "./adapter";
export * from "./archive";
export * as registry from "./registry";
/** The one impure edge: filesystem-driven format discovery (kept out of the pure registry). */
export { loadFormats } from "./loader";
