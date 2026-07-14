import { useEffect, useRef, useState } from "react";

import type { SelectConfig } from "../session/config";

interface EffortControlProps {
  config: SelectConfig;
  disabled: boolean;
  onSetConfig: (configId: string, value: string) => void;
}

export function EffortControl({ config, disabled, onSetConfig }: EffortControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentIndex = Math.max(
    0,
    config.options.findIndex((option) => option.value === config.currentValue),
  );
  const current = config.options[currentIndex];

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
    <div className="effort-control" ref={rootRef}>
      <button
        type="button"
        className="effort-trigger"
        title="Effort"
        aria-label={`Effort: ${current.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {current.name}
      </button>
      {open && (
        <div className="effort-popover" role="dialog" aria-label="Choose effort">
          <div className="effort-popover-heading">
            <span>
              Effort <strong>{current.name}</strong>
            </span>
            <span className="effort-help" title={config.name} aria-hidden="true">
              ?
            </span>
          </div>
          <div className="effort-scale-labels" aria-hidden="true">
            <span>Faster</span>
            <span>Smarter</span>
          </div>
          <div className="effort-slider-wrap">
            <div className="effort-ticks" aria-hidden="true">
              {config.options.map((option, index) => (
                <span key={option.value} className={index === currentIndex ? "active" : ""} />
              ))}
            </div>
            <input
              className="effort-slider"
              type="range"
              min={0}
              max={config.options.length - 1}
              step={1}
              value={currentIndex}
              aria-label="Effort level"
              aria-valuetext={current.name}
              onChange={(event) => {
                const option = config.options[Number(event.currentTarget.value)];
                if (option) onSetConfig(config.id, option.value);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
