import { useCallback, useEffect, useRef, useState } from "react";

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Checks for updates on startup and exposes the same check for Settings. */
export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoCheckStarted = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (checking || installing) {
      return;
    }

    setChecking(true);
    setMessage(null);
    try {
      const available = await check();
      setUpdate(available);
      if (!available) {
        setMessage("You are up to date.");
      }
    } catch (error) {
      setMessage(`Could not check for updates: ${errorMessage(error)}`);
    } finally {
      setChecking(false);
    }
  }, [checking, installing]);

  useEffect(() => {
    if (autoCheckStarted.current) {
      return;
    }
    autoCheckStarted.current = true;
    void checkForUpdates();
  }, [checkForUpdates]);

  const installUpdate = useCallback(async () => {
    if (!update) {
      return;
    }

    setInstalling(true);
    setMessage(null);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (error) {
      setMessage(`Could not install update: ${errorMessage(error)}`);
      setInstalling(false);
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    const dismissed = update;
    setUpdate(null);
    void dismissed?.close();
  }, [update]);

  return {
    update,
    checking,
    installing,
    message,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  };
}
