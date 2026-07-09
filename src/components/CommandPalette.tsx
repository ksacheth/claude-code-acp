import type { AvailableCommand } from "@agentclientprotocol/sdk";

interface CommandPaletteProps {
  matches: AvailableCommand[];
  /// Index of the highlighted entry.
  active: number;
  onPick: (command: AvailableCommand) => void;
}

/// The `/` autocomplete list shown above the composer input. Presentational:
/// the composer owns the draft, matching, and keyboard navigation.
export function CommandPalette({ matches, active, onPick }: CommandPaletteProps) {
  return (
    <ul className="command-palette" role="listbox">
      {matches.map((command, i) => (
        <li
          key={command.name}
          role="option"
          aria-selected={i === active}
          className={`command-item${i === active ? " active" : ""}`}
          onMouseDown={(e) => {
            // Keep focus on the input; mousedown fires before the input's blur.
            e.preventDefault();
            onPick(command);
          }}
        >
          <span className="command-name">/{command.name}</span>
          <span className="command-desc">{command.description}</span>
        </li>
      ))}
    </ul>
  );
}
