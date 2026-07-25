import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionInfo } from "@agentclientprotocol/sdk";

import { ensureChatsDir } from "../acp/tauriChannel";
import { buildSidebarTree, expandedWithActive, type SidebarTree } from "./projects";
import {
  loadProjectPrefs,
  saveProjectPrefs,
  withAlias,
  withToggledExpanded,
  withToggledHidden,
} from "./projectPrefs";
import type { SessionState } from "./sessions";
import type { Settings } from "./settings";

export interface SidebarModel {
  tree: SidebarTree;
  /// Project directories whose chats are showing, including the active chat's.
  expanded: Set<string>;
  /// Where a chat with no project is rooted, once the shell has resolved it.
  /// Undefined until then, which disables "New chat" rather than starting one
  /// in the wrong directory.
  chatsDir?: string;
  toggleProject: (cwd: string) => void;
  /// Set a project's display label, or clear it when `label` is blank.
  renameProject: (cwd: string, label: string) => void;
  /// Hide a project from the tree, or bring a hidden one back.
  toggleProjectHidden: (cwd: string) => void;
}

/// Everything the sidebar renders from: the grouped tree, which groups are open,
/// and the resolved chats directory. Kept out of the component so the tree stays
/// a pure transform of the session list and the app shell stays thin.
export function useSidebar(
  sessionList: SessionInfo[] | null,
  sessions: SessionState[],
  activeId: string | undefined,
  settings: Settings,
): SidebarModel {
  const [prefs, setPrefs] = useState(loadProjectPrefs);
  const [chatsDir, setChatsDir] = useState<string>();

  // Resolving creates the directory, so this also guarantees a new chat has
  // somewhere to be rooted. A failure leaves `chatsDir` unset: the project
  // picker still works, so the app stays usable.
  useEffect(() => {
    let current = true;
    ensureChatsDir(settings.chatsDir)
      .then((dir) => {
        if (current) setChatsDir(dir);
      })
      .catch((error) => {
        console.warn("[claude-tauri] could not resolve the chats directory:", error);
        if (current) setChatsDir(undefined);
      });
    return () => {
      current = false;
    };
  }, [settings.chatsDir]);

  const tree = useMemo(
    () =>
      buildSidebarTree({
        persisted: sessionList,
        open: sessions,
        aliases: prefs.aliases,
        chatsDir,
        unlistedDirs: settings.unlistedDirs,
        hiddenDirs: prefs.hidden,
      }),
    [sessionList, sessions, prefs.aliases, prefs.hidden, chatsDir, settings.unlistedDirs],
  );

  const expanded = useMemo(
    () => expandedWithActive(prefs.expanded, tree, activeId),
    [prefs.expanded, tree, activeId],
  );

  const update = useCallback((next: ReturnType<typeof loadProjectPrefs>) => {
    setPrefs(next);
    saveProjectPrefs(next);
  }, []);

  const toggleProject = useCallback(
    (cwd: string) => update(withToggledExpanded(prefs, cwd)),
    [prefs, update],
  );

  const renameProject = useCallback(
    (cwd: string, label: string) => update(withAlias(prefs, cwd, label)),
    [prefs, update],
  );

  const toggleProjectHidden = useCallback(
    (cwd: string) => update(withToggledHidden(prefs, cwd)),
    [prefs, update],
  );

  return { tree, expanded, chatsDir, toggleProject, renameProject, toggleProjectHidden };
}
