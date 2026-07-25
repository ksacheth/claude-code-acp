import type { SessionConfigOption } from "@agentclientprotocol/sdk";

/// Config-option id the engine uses for the session permission mode. Mode is
/// special-cased only because the engine also announces mode changes through
/// the legacy `current_mode_update` channel (e.g. auto-switching to plan mode).
export const MODE_CONFIG_ID = "mode";
export const MODEL_CONFIG_ID = "model";
export const EFFORT_CONFIG_ID = "effort";
export const FAST_MODE_CONFIG_ID = "fast";

/// A select-style config option flattened for rendering: the mode/model/effort/
/// agent/fast dropdowns all share this shape.
export interface SelectConfig {
  id: string;
  name: string;
  currentValue: string;
  options: { value: string; name: string; description?: string }[];
}

/// The renderable select configs: `type: "select"` options with a real choice
/// (≥2 values). Single-option selectors carry no decision, so we drop them
/// (matches the M2 `availableModes.length > 1` guard).
export function selectConfigs(options?: SessionConfigOption[]): SelectConfig[] {
  if (!options) return [];
  const selects: SelectConfig[] = [];
  for (const option of options) {
    if (option.type !== "select") continue;
    const values = flattenOptions(option.options);
    if (values.length < 2) continue;
    selects.push({
      id: option.id,
      name: option.name,
      currentValue: option.currentValue,
      options: option.id === MODEL_CONFIG_ID ? values.map(withModelVersion) : values,
    });
  }
  return selects;
}

/// Show which generation a model row actually is.
///
/// The engine reports bare family names ("Opus", "Sonnet") and states the
/// version only in the prose description, so the picker cannot tell you which
/// Opus you are about to select. This reads the version back out of the
/// description the engine already sends rather than hard-coding a model table
/// that would go stale with every release.
export function versionedModelName(name: string, description?: string): string {
  const family = name.trim();
  // No description to read, or a name that already carries its own version.
  if (!description || /\d/.test(family)) return family;
  // The version only counts when it directly follows this row's own family name.
  // Default repeats the description of whichever model it resolves to, so its
  // description opens with "Opus 4.8 …"; anchoring on the family name is what
  // stops Default from being labelled with a version that is not its own.
  const match = description.match(
    new RegExp(`\\b${escapeRegExp(family)}\\s+(\\d+(?:\\.\\d+)?)`, "i"),
  );
  return match ? `${family} ${match[1]}` : family;
}

function withModelVersion(
  option: SelectConfig["options"][number],
): SelectConfig["options"][number] {
  return { ...option, name: versionedModelName(option.name, option.description) };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/// Options may be a flat list or grouped; flatten to a single value list.
function flattenOptions(
  options: Extract<SessionConfigOption, { type: "select" }>["options"],
): SelectConfig["options"] {
  return options.flatMap((entry) =>
    "options" in entry
      ? entry.options.map((o) => ({
          value: o.value,
          name: o.name,
          description: o.description ?? undefined,
        }))
      : [{ value: entry.value, name: entry.name, description: entry.description ?? undefined }],
  );
}

/// Optimistically set one select option's `currentValue` (before the engine's
/// authoritative `set_config_option` response replaces the whole array).
export function patchCurrentValue(
  options: SessionConfigOption[] | undefined,
  configId: string,
  value: string,
): SessionConfigOption[] | undefined {
  if (!options) return options;
  return options.map((option) =>
    option.id === configId && option.type === "select"
      ? { ...option, currentValue: value }
      : option,
  );
}
