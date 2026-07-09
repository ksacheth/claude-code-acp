import type { ServerForm } from "../session/settingsForm";

interface McpServerRowProps {
  server: ServerForm;
  onChange: (next: ServerForm) => void;
  onRemove: () => void;
}

/// One editable stdio MCP server: name, command, args, and env. Presentational —
/// the settings modal owns the list and persistence.
export function McpServerRow({ server, onChange, onRemove }: McpServerRowProps) {
  const set = (patch: Partial<ServerForm>) => onChange({ ...server, ...patch });
  return (
    <div className="mcp-row">
      <div className="mcp-row-head">
        <input
          className="mcp-name"
          value={server.name}
          onChange={(e) => set({ name: e.currentTarget.value })}
          placeholder="name (e.g. filesystem)"
        />
        <button type="button" className="mcp-remove" onClick={onRemove} aria-label="Remove server">
          ✕
        </button>
      </div>
      <input
        value={server.command}
        onChange={(e) => set({ command: e.currentTarget.value })}
        placeholder="command (e.g. npx)"
      />
      <input
        value={server.argsText}
        onChange={(e) => set({ argsText: e.currentTarget.value })}
        placeholder="args (e.g. -y @modelcontextprotocol/server-filesystem /path)"
      />
      <textarea
        value={server.envText}
        onChange={(e) => set({ envText: e.currentTarget.value })}
        placeholder="env, one KEY=VALUE per line"
        rows={2}
      />
    </div>
  );
}
