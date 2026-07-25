import type { ReactNode } from "react";

import type { ProjectGroup as Group } from "../session/projects";
import { ProjectRow } from "./ProjectRow";

interface ProjectGroupProps {
  project: Group;
  expanded: boolean;
  renaming: boolean;
  onToggle: () => void;
  onStartRename: () => void;
  onRename: (label: string) => void;
  onResetName: () => void;
  onCancelRename: () => void;
  /// The project's chat rows, rendered only while it is expanded.
  chats: ReactNode;
}

/// One project in the sidebar: its folder row, and its chats when open.
export function ProjectGroup({ project, expanded, chats, ...row }: ProjectGroupProps) {
  return (
    <li className="project-item">
      <ProjectRow project={project} expanded={expanded} {...row} />
      {expanded && <ul className="chat-list nested">{chats}</ul>}
    </li>
  );
}
