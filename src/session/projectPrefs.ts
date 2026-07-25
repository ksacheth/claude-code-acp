/// How the user has arranged the sidebar: per-project display names and which
/// groups are open. Keyed by project directory, since that is a project's
/// identity (a chat's project *is* its cwd).
export interface ProjectPrefs {
  /// cwd → display label. A project with no entry shows its basename.
  aliases: Record<string, string>;
  /// Project directories whose group is expanded.
  expanded: string[];
}

export const emptyProjectPrefs: ProjectPrefs = { aliases: {}, expanded: [] };

const STORAGE_KEY = "claude-tauri.projectPrefs";

/// Load sidebar prefs, tolerating absent or corrupt data.
export function loadProjectPrefs(storage: Pick<Storage, "getItem"> = localStorage): ProjectPrefs {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProjectPrefs;
    return normalizeProjectPrefs(JSON.parse(raw));
  } catch {
    return emptyProjectPrefs;
  }
}

/// Persist sidebar prefs. Never throws: losing a label is not worth an error.
export function saveProjectPrefs(
  prefs: ProjectPrefs,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be full or blocked; the in-memory prefs still work.
  }
}

/// Coerce an untrusted parsed blob into valid prefs: string labels only, and a
/// de-duplicated list of expanded paths.
export function normalizeProjectPrefs(input: unknown): ProjectPrefs {
  const raw = (input ?? {}) as Record<string, unknown>;
  return { aliases: aliasMap(raw.aliases), expanded: pathList(raw.expanded) };
}

/// A record, as opposed to null, an array, or a primitive. Stored data is
/// untrusted, so `aliases` could be any of those.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/// Keep only entries whose label is a non-blank string, trimmed.
function aliasMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const aliases: Record<string, string> = {};
  for (const [cwd, label] of Object.entries(value)) {
    if (typeof label === "string" && label.trim()) aliases[cwd] = label.trim();
  }
  return aliases;
}

/// Keep only non-blank strings, de-duplicated.
function pathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((entry): entry is string => typeof entry === "string" && !!entry)),
  ];
}

/// Set a project's display label, or clear it when `label` is blank so the row
/// falls back to the directory's basename.
export function withAlias(prefs: ProjectPrefs, cwd: string, label: string): ProjectPrefs {
  const trimmed = label.trim();
  const aliases = { ...prefs.aliases };
  if (trimmed) aliases[cwd] = trimmed;
  else delete aliases[cwd];
  return { ...prefs, aliases };
}

/// Toggle whether a project's group is expanded.
export function withToggledExpanded(prefs: ProjectPrefs, cwd: string): ProjectPrefs {
  const expanded = prefs.expanded.includes(cwd)
    ? prefs.expanded.filter((entry) => entry !== cwd)
    : [...prefs.expanded, cwd];
  return { ...prefs, expanded };
}
