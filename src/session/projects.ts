import type { SessionInfo } from "@agentclientprotocol/sdk";

import { titleFromCwd, type SessionState } from "./sessions";

/// One chat row in the sidebar.
export interface ChatEntry {
  id: string;
  cwd: string;
  title: string;
  /// ISO timestamp of last activity; absent for a chat with no turns yet.
  updatedAt?: string;
  /// Loaded in the app, so selecting it needs no session/load.
  open: boolean;
  /// Its turn is streaming right now.
  streaming: boolean;
}

/// All chats sharing one project directory.
export interface ProjectGroup {
  cwd: string;
  /// What the row shows: the user's alias, else the directory's basename.
  label: string;
  chats: ChatEntry[];
}

/// The sidebar's whole contents: chats with no project first (flat, no folder
/// header), then one collapsible group per project directory.
export interface SidebarTree {
  loose: ChatEntry[];
  projects: ProjectGroup[];
}

export const emptyTree: SidebarTree = { loose: [], projects: [] };

export interface TreeInput {
  /// Persisted sessions from session/list (null while the first load is in
  /// flight, which is treated the same as none).
  persisted: SessionInfo[] | null;
  /// Sessions loaded in this app run, which may include ones not yet on disk.
  open: SessionState[];
  /// Per-project display labels, keyed by cwd.
  aliases: Record<string, string>;
  /// The directory that holds chats with no project.
  chatsDir?: string;
  /// Directories the user does not want shown as projects.
  unlistedDirs: string[];
}

/// Strip a trailing slash so `/a/b` and `/a/b/` compare equal. Paths reach us
/// from a directory picker, settings text, and the engine, so they disagree.
export function normalizeDir(dir: string): string {
  const trimmed = dir.trim();
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.replace(/\/+$/, "");
  return trimmed;
}

/// Sort key for recency, descending as a plain string compare (ISO timestamps
/// order lexicographically). An open chat with no activity yet is the newest
/// thing there is, so it sorts above every timestamp; a persisted chat missing
/// one sorts last, since we know nothing about it.
function recencyKey(chat: ChatEntry): string {
  if (chat.updatedAt) return chat.updatedAt;
  return chat.open ? "￿" : "";
}

function byRecency(a: ChatEntry, b: ChatEntry): number {
  const keyA = recencyKey(a);
  const keyB = recencyKey(b);
  return keyA === keyB ? a.id.localeCompare(b.id) : keyA < keyB ? 1 : -1;
}

/// The best title available for a chat.
///
/// An open session's title only beats the persisted one once the engine has sent
/// a real one: until then it is the cwd basename, which every chat in a project
/// would share. The persisted title comes from the engine too (a custom title,
/// the generated summary, or the first prompt), so it wins over that placeholder.
function bestTitle(persisted: SessionInfo | undefined, open: SessionState | undefined): string {
  if (open?.titleSource === "engine") return open.title;
  const stored = persisted?.title?.trim();
  if (stored) return stored;
  if (open) return open.title;
  return titleFromCwd(persisted?.cwd ?? "");
}

/// Merge the persisted list with the open sessions into one chat per id. Open
/// sessions with nothing on disk yet (created this run, no turn taken) are
/// included, so a new chat appears the moment it exists.
function mergeChats(persisted: SessionInfo[], open: SessionState[]): ChatEntry[] {
  const openById = new Map(open.map((session) => [session.id, session]));
  const chats: ChatEntry[] = persisted.map((info) => {
    const live = openById.get(info.sessionId);
    openById.delete(info.sessionId);
    return {
      id: info.sessionId,
      cwd: normalizeDir(info.cwd),
      title: bestTitle(info, live),
      ...(info.updatedAt ? { updatedAt: info.updatedAt } : {}),
      open: !!live,
      streaming: !!live?.transcript.turnActive,
    };
  });
  for (const live of openById.values()) {
    chats.push({
      id: live.id,
      cwd: normalizeDir(live.cwd),
      title: bestTitle(undefined, live),
      open: true,
      streaming: live.transcript.turnActive,
    });
  }
  return chats;
}

/// Group chats by project directory and sort everything by recency: chats within
/// a project, and projects by their most recent chat.
///
/// A chat in the chats directory or a directory the user marked unlisted goes to
/// `loose` instead, which is how "a chat with no project" is presented. The
/// protocol has no such thing (every session has a cwd), so this is the whole
/// mechanism behind it.
export function buildSidebarTree(input: TreeInput): SidebarTree {
  const looseDirs = new Set(
    [...input.unlistedDirs, ...(input.chatsDir ? [input.chatsDir] : [])]
      .map(normalizeDir)
      .filter(Boolean),
  );
  const loose: ChatEntry[] = [];
  const byProject = new Map<string, ChatEntry[]>();

  for (const chat of mergeChats(input.persisted ?? [], input.open)) {
    if (looseDirs.has(chat.cwd)) {
      loose.push(chat);
      continue;
    }
    const existing = byProject.get(chat.cwd);
    if (existing) existing.push(chat);
    else byProject.set(chat.cwd, [chat]);
  }

  const projects = [...byProject.entries()].map(([cwd, chats]) => ({
    cwd,
    label: input.aliases[cwd]?.trim() || titleFromCwd(cwd),
    chats: chats.sort(byRecency),
  }));
  // Each group's first chat is its newest, so groups order by that same key.
  projects.sort((a, b) => byRecency(a.chats[0], b.chats[0]));

  return { loose: loose.sort(byRecency), projects };
}

/// Filter the tree to what matches `query` (case-insensitive, on chat titles and
/// project labels). A project whose label matches keeps all its chats; otherwise
/// only its matching chats survive, and a group left with none is dropped.
export function filterTree(tree: SidebarTree, query: string): SidebarTree {
  const needle = query.trim().toLowerCase();
  if (!needle) return tree;
  const matches = (text: string) => text.toLowerCase().includes(needle);

  return {
    loose: tree.loose.filter((chat) => matches(chat.title)),
    projects: tree.projects.flatMap((project) => {
      if (matches(project.label)) return [project];
      const chats = project.chats.filter((chat) => matches(chat.title));
      return chats.length ? [{ ...project, chats }] : [];
    }),
  };
}

/// Every chat in the tree, in display order. Used to look a chat up by id
/// without the caller having to walk the groups.
export function allChats(tree: SidebarTree): ChatEntry[] {
  return [...tree.loose, ...tree.projects.flatMap((project) => project.chats)];
}

/// The title an inline rename should commit, or undefined to cancel.
///
/// A blank value is not a rename (clearing a chat's title is meaningless), and
/// neither is one that matches what is already there, so both cancel rather than
/// round-tripping a request that changes nothing.
export function renamedTitle(value: string, initial: string): string | undefined {
  const next = value.trim();
  return next && next !== initial ? next : undefined;
}

/// Which project directories should start expanded: the saved set, plus the
/// project owning the active chat so the selection is never hidden.
export function expandedWithActive(
  expanded: string[],
  tree: SidebarTree,
  activeId?: string,
): Set<string> {
  const set = new Set(expanded.map(normalizeDir));
  if (!activeId) return set;
  const active = tree.projects.find((project) =>
    project.chats.some((chat) => chat.id === activeId),
  );
  if (active) set.add(active.cwd);
  return set;
}
