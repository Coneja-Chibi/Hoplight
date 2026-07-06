/**
 * Vendor bundle: the ENTIRE react family as one module, built with NO externals so React and both
 * JSX runtimes inline against a single React copy. The import map points "react",
 * "react/jsx-runtime" and "react/jsx-dev-runtime" all at this one URL; each importer picks the
 * names it needs. Why one module: Bun's `external: ["react"]` also externalizes react/* subpaths,
 * so separate runtime stubs came out as self-importing shims (the boot smoke caught the empty
 * namespace). One inlined family is the shape that cannot alias itself.
 */
import * as reactNs from "react";
import * as jsxNs from "react/jsx-runtime";
import * as jsxDevNs from "react/jsx-dev-runtime";

const r = (((reactNs as { default?: unknown }).default ?? reactNs) as typeof import("react"));
const jrt = ((jsxNs as { default?: Record<string, unknown> }).default ?? jsxNs) as Record<string, unknown>;
const jdev = ((jsxDevNs as { default?: Record<string, unknown> }).default ?? jsxDevNs) as Record<string, unknown>;

export default r;
export const Children = r.Children;
export const Component = r.Component;
export const Fragment = r.Fragment;
export const Profiler = r.Profiler;
export const PureComponent = r.PureComponent;
export const StrictMode = r.StrictMode;
export const Suspense = r.Suspense;
export const act = r.act;
export const cloneElement = r.cloneElement;
export const createContext = r.createContext;
export const createElement = r.createElement;
export const createRef = r.createRef;
export const forwardRef = r.forwardRef;
export const isValidElement = r.isValidElement;
export const lazy = r.lazy;
export const memo = r.memo;
export const startTransition = r.startTransition;
export const use = r.use;
export const useActionState = r.useActionState;
export const useCallback = r.useCallback;
export const useContext = r.useContext;
export const useDebugValue = r.useDebugValue;
export const useDeferredValue = r.useDeferredValue;
export const useEffect = r.useEffect;
export const useId = r.useId;
export const useImperativeHandle = r.useImperativeHandle;
export const useInsertionEffect = r.useInsertionEffect;
export const useLayoutEffect = r.useLayoutEffect;
export const useMemo = r.useMemo;
export const useOptimistic = r.useOptimistic;
export const useReducer = r.useReducer;
export const useRef = r.useRef;
export const useState = r.useState;
export const useSyncExternalStore = r.useSyncExternalStore;
export const useTransition = r.useTransition;
export const version = r.version;
// react-dom links to React through this internals export; dropping it crashes react-dom at module
// eval ("reading 'S'"). Not public API, but the renderer contract requires it.
export const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE =
  (r as unknown as Record<string, unknown>).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
// the automatic-JSX entries (importers of react/jsx-runtime and react/jsx-dev-runtime land here too)
export const jsx = jrt.jsx ?? (jsxNs as Record<string, unknown>).jsx;
export const jsxs = jrt.jsxs ?? (jsxNs as Record<string, unknown>).jsxs;
export const jsxDEV = jdev.jsxDEV ?? (jsxDevNs as Record<string, unknown>).jsxDEV;
