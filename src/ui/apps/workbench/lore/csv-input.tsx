/**
 * CsvInput - a comma-separated list input that keeps the RAW string as local state (a controlled
 * value round-tripped through parse/join eats the comma as you type it) and commits the parsed
 * list on every change. Reseeds only when the committed list changes from outside.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { joinCsv, parseCsv } from "./entry-extras";

export interface CsvInputProps {
  value: readonly string[];
  onCommit: (next: string[]) => void;
  className: string | undefined;
  placeholder?: string;
  ariaLabel: string;
}

export function CsvInput({ value, onCommit, className, placeholder, ariaLabel }: CsvInputProps): JSX.Element {
  const [raw, setRaw] = useState(() => joinCsv(value));
  const lastCommitted = useRef(joinCsv(value));

  // adopt outside changes (entry switch, reconcile) without fighting in-progress typing
  useEffect(() => {
    const joined = joinCsv(value);
    if (joined !== lastCommitted.current) {
      lastCommitted.current = joined;
      setRaw(joined);
    }
  }, [value]);

  return (
    <input
      className={className}
      value={raw}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(ev) => {
        setRaw(ev.target.value);
        const parsed = parseCsv(ev.target.value);
        lastCommitted.current = joinCsv(parsed);
        onCommit(parsed);
      }}
    />
  );
}
