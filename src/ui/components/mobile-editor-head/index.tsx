/**
 * MobileEditorHead - the narrow-pane editor header: back / name / save / kebab, all thumb-sized
 * (design/vs-mobile-editors.html frame 1). Export, scale and mode switches live in the kebab.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import styles from "./styles.module.css";

export interface MobileMenuItem {
  label: string;
  onPick(): void;
  disabled?: boolean;
}

export interface MobileEditorHeadProps {
  name: string;
  /** Quiet second line under the name, e.g. "character · saved locally". */
  sub: string;
  dirty: boolean;
  saving: boolean;
  onBack(): void;
  onSave(): void;
  menu: readonly MobileMenuItem[];
}

/** Back / name / save / kebab at 2.2rem touch targets; the kebab holds the long tail. */
export function MobileEditorHead({ name, sub, dirty, saving, onBack, onSave, menu }: MobileEditorHeadProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (menuRef.current !== null && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={styles.head}>
      <button type="button" className={styles.back} aria-label="Close" onClick={onBack}>
        &#8592;
      </button>
      <span className={styles.name}>
        <b>{name}</b>
        <i>{sub}</i>
      </span>
      <button
        type="button"
        className={styles.save}
        disabled={saving || !dirty}
        aria-label={saving ? "Saving" : dirty ? "Save" : "Saved"}
        title="Save · ctrl+s"
        onClick={onSave}
      >
        &#10003;
      </button>
      <div className={styles.kebabWrap} ref={menuRef}>
        <button type="button" className={styles.kebab} aria-label="More actions" aria-expanded={open} onClick={() => setOpen((p) => !p)}>
          &#8942;
        </button>
        {open && (
          <div className={styles.menu} role="menu">
            {menu.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled === true}
                onClick={() => {
                  setOpen(false);
                  item.onPick();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
