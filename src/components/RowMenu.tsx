import { useEffect, useRef, useState } from "react";

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /// Styled as a destructive action.
  danger?: boolean;
}

interface RowMenuProps {
  /// Describes what the menu acts on, e.g. "Options for alpha".
  label: string;
  items: RowMenuItem[];
}

/// The `···` menu on a sidebar row. Opens on click and closes on Escape or a
/// pointer press outside it, the same way the header's config menus behave.
export function RowMenu({ label, items }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        type="button"
        className="row-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ···
      </button>
      <div className="row-menu-popover" role="menu" aria-label={label} hidden={!open}>
        {items.map((item) => (
          <button
            type="button"
            role="menuitem"
            key={item.label}
            className={`row-menu-item${item.danger ? " danger" : ""}`}
            onClick={() => {
              setOpen(false);
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
