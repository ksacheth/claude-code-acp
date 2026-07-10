import {
  formatEnv,
  parseArgs,
  parseEnv,
  type Settings,
  type ThemeMode,
} from "./settings";

/// One MCP server as edited in the form: args and env are freeform text that
/// parse to argv / env pairs on save.
export interface ServerForm {
  name: string;
  command: string;
  argsText: string;
  envText: string;
}

/// The settings form's editable shape: scalars as strings, env/args as text.
export interface SettingsForm {
  enginePath: string;
  nodePath: string;
  defaultModel: string;
  defaultMode: string;
  theme: ThemeMode;
  envText: string;
  servers: ServerForm[];
}

export const emptyServerForm: ServerForm = { name: "", command: "", argsText: "", envText: "" };

/// Settings → editable form.
export function settingsToForm(settings: Settings): SettingsForm {
  return {
    enginePath: settings.enginePath ?? "",
    nodePath: settings.nodePath ?? "",
    defaultModel: settings.defaultModel ?? "",
    defaultMode: settings.defaultMode ?? "",
    theme: settings.theme,
    envText: formatEnv(settings.env),
    servers: settings.mcpServers.map((s) => ({
      name: s.name,
      command: s.command,
      argsText: s.args.join(" "),
      envText: formatEnv(s.env),
    })),
  };
}

/// Editable form → Settings. Trims scalars (empty → undefined), parses env/args,
/// and drops MCP servers missing a name or command.
export function formToSettings(form: SettingsForm): Settings {
  return {
    enginePath: trimmed(form.enginePath),
    nodePath: trimmed(form.nodePath),
    defaultModel: trimmed(form.defaultModel),
    defaultMode: trimmed(form.defaultMode),
    theme: form.theme,
    env: parseEnv(form.envText),
    mcpServers: form.servers
      .map((s) => ({
        name: s.name.trim(),
        command: s.command.trim(),
        args: parseArgs(s.argsText),
        env: parseEnv(s.envText),
      }))
      .filter((s) => s.name && s.command),
  };
}

function trimmed(value: string): string | undefined {
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}
