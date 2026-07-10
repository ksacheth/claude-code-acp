import { useState } from "react";

import type { Settings, ThemeMode } from "../session/settings";
import {
  emptyServerForm,
  formToSettings,
  settingsToForm,
  type ServerForm,
  type SettingsForm,
} from "../session/settingsForm";
import { McpServerRow } from "./McpServerRow";

interface SettingsModalProps {
  settings: Settings;
  onSave: (next: Settings) => void;
  onClose: () => void;
}

/// The settings modal: engine spawn (node path, engine path, env), per-session
/// defaults (model/mode), and the MCP server list. Edits a local form draft and
/// persists it on Save. Spawn changes take effect on the next reconnect.
export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [form, setForm] = useState<SettingsForm>(() => settingsToForm(settings));
  const set = (patch: Partial<SettingsForm>) => setForm((f) => ({ ...f, ...patch }));

  const setServer = (i: number, next: ServerForm) =>
    set({ servers: form.servers.map((s, j) => (j === i ? next : s)) });
  const removeServer = (i: number) => set({ servers: form.servers.filter((_, j) => j !== i) });
  const addServer = () => set({ servers: [...form.servers, emptyServerForm] });

  const save = () => {
    onSave(formToSettings(form));
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Settings</div>

        <section className="settings-section">
          <h3>Appearance</h3>
          <label>
            Theme
            <select
              value={form.theme}
              onChange={(e) => set({ theme: e.currentTarget.value as ThemeMode })}
            >
              <option value="auto">Auto (match system)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </section>

        <section className="settings-section">
          <h3>Engine</h3>
          <label>
            Node path <span className="muted">(blank = "node" on PATH)</span>
            <input value={form.nodePath} onChange={(e) => set({ nodePath: e.currentTarget.value })} placeholder="node" />
          </label>
          <label>
            Engine path <span className="muted">(blank = auto-resolve dist/index.js)</span>
            <input
              value={form.enginePath}
              onChange={(e) => set({ enginePath: e.currentTarget.value })}
              placeholder="/path/to/claude-agent-acp/dist/index.js"
            />
          </label>
          <label>
            Environment <span className="muted">(one KEY=VALUE per line; e.g. a full PATH)</span>
            <textarea
              value={form.envText}
              onChange={(e) => set({ envText: e.currentTarget.value })}
              placeholder="PATH=/usr/local/bin:/usr/bin:/bin"
              rows={3}
            />
          </label>
          <p className="muted">Engine changes take effect on the next reconnect.</p>
        </section>

        <section className="settings-section">
          <h3>Session defaults</h3>
          <label>
            Default model <span className="muted">(alias or id; blank = engine default)</span>
            <input
              value={form.defaultModel}
              onChange={(e) => set({ defaultModel: e.currentTarget.value })}
              placeholder="opus"
            />
          </label>
          <label>
            Default mode
            <input
              value={form.defaultMode}
              onChange={(e) => set({ defaultMode: e.currentTarget.value })}
              placeholder="default"
            />
          </label>
        </section>

        <section className="settings-section">
          <h3>MCP servers</h3>
          {form.servers.map((server, i) => (
            <McpServerRow
              key={i}
              server={server}
              onChange={(next) => setServer(i, next)}
              onRemove={() => removeServer(i)}
            />
          ))}
          <button type="button" className="mcp-add" onClick={addServer}>
            + Add MCP server
          </button>
        </section>

        <div className="settings-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
