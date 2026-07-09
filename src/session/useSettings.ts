import { useCallback, useState } from "react";

import { loadSettings, saveSettings, type Settings } from "./settings";

export interface SettingsHandle {
  settings: Settings;
  /// Persist and apply new settings. Engine-path/env changes take effect on the
  /// next reconnect; mcp/default changes on the next new session.
  save: (next: Settings) => void;
}

/// App settings backed by localStorage, seeded once from the persisted blob.
export function useSettings(): SettingsHandle {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const save = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  return { settings, save };
}
