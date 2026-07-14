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
      options: values,
    });
  }
  return selects;
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
