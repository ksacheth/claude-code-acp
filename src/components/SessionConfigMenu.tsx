import { useEffect, useRef, useState } from "react";

import type { SelectConfig } from "../session/config";

interface SessionConfigMenuProps {
  config: SelectConfig;
  kind: "mode" | "model";
  fastMode?: SelectConfig;
  disabled: boolean;
  onSetConfig: (configId: string, value: string) => void;
}

export function SessionConfigMenu({
  config,
  kind,
  fastMode,
  disabled,
  onSetConfig,
}: SessionConfigMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current =
    config.options.find((option) => option.value === config.currentValue) ?? config.options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      const shortcut = Number(event.key);
      const option = shortcut > 0 ? config.options[shortcut - 1] : undefined;
      if (option) {
        onSetConfig(config.id, option.value);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [config, onSetConfig, open]);

  if (!current) return null;

  const fastEnabled = fastMode?.currentValue === "on";
  return (
    <div className={`config-menu config-menu-${kind}`} ref={rootRef}>
      <button
        type="button"
        className={`config-menu-trigger config-${config.id}`}
        title={config.name}
        aria-label={`${config.name}: ${current.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {current.name}
      </button>
      <div
        className="config-menu-popover"
        role="menu"
        aria-label={kind === "model" ? "Models" : "Mode"}
        hidden={!open}
      >
        <div className="config-menu-heading">{kind === "model" ? "Models" : "Mode"}</div>
        <div className="config-menu-options">
          {config.options.map((option, index) => {
            const selected = option.value === config.currentValue;
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className="config-menu-option"
                key={option.value}
                onClick={() => {
                  onSetConfig(config.id, option.value);
                  setOpen(false);
                }}
              >
                <span className="config-menu-option-name">{option.name}</span>
                {selected && <span className="config-menu-check">✓</span>}
                {index < 9 && <span className="config-menu-shortcut">{index + 1}</span>}
              </button>
            );
          })}
        </div>
        {kind === "model" && fastMode && (
          <div className="config-menu-fast">
            <div>
              <div className="config-menu-section-label">Fast mode</div>
              <div>Enable fast mode</div>
            </div>
            <button
              type="button"
              className="config-toggle"
              role="switch"
              aria-checked={fastEnabled}
              aria-label="Enable fast mode"
              onClick={() => onSetConfig(fastMode.id, fastEnabled ? "off" : "on")}
            >
              <span />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
