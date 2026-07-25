import { useEffect, useRef, useState } from "react";

import { renamedTitle } from "../session/projects";

interface InlineRenameProps {
  initial: string;
  /// Describes the field, e.g. "Rename alpha".
  label: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/// An in-place editor that replaces a sidebar row's label while renaming. Enter
/// commits, Escape or losing focus cancels, so a stray click never renames
/// anything. A blank value cancels too: clearing a chat's title is not a rename,
/// and clearing a project's is handled by the caller as "drop the alias".
export function InlineRename({ initial, label, onCommit, onCancel }: InlineRenameProps) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const next = renamedTitle(value, initial);
    if (next) onCommit(next);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      className="inline-rename"
      aria-label={label}
      value={value}
      autoFocus
      onChange={(event) => setValue(event.currentTarget.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={onCancel}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") commit();
        else if (event.key === "Escape") onCancel();
      }}
    />
  );
}
