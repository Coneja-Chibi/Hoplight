/**
 * Vendor stub: the ONE React instance for the whole page (ADR-008). React ships CJS and
 * `export * from` a CJS module yields NO named exports in the built artifact (the boot smoke
 * caught this before it became first-boot crash number four), so the full React 19 API is
 * re-exported EXPLICITLY, typed against the real module. Every other bundle marks "react"
 * external and resolves here through the page's import map.
 */
import * as ns from "react";

const r = (((ns as { default?: unknown }).default ?? ns) as typeof import("react"));

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
