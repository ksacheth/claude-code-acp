import type { ProjectGroup } from "../session/projects";
import { InlineRename } from "./InlineRename";
import { RowMenu } from "./RowMenu";

interface ProjectRowProps {
  project: ProjectGroup;
  expanded: boolean;
  renaming: boolean;
  onToggle: () => void;
  onStartRename: () => void;
  onRename: (label: string) => void;
  onResetName: () => void;
  onCancelRename: () => void;
  onToggleHidden: () => void;
}

/// A project's folder row: click to expand or collapse its chats.
///
/// Renaming a project only changes what this row shows, and hiding one only
/// keeps it out of the tree. A chat's project is its working directory, so
/// neither touches the directory or a single conversation: "Reset name" falls
/// back to the directory's own name, and "Unhide" brings the folder back.
export function ProjectRow({
  project,
  expanded,
  renaming,
  onToggle,
  onStartRename,
  onRename,
  onResetName,
  onCancelRename,
  onToggleHidden,
}: ProjectRowProps) {
  const chatCount = project.chats.length;
  return (
    <div className={`project-row${project.hidden ? " hidden-project" : ""}`}>
      {renaming ? (
        <InlineRename
          initial={project.label}
          label={`Rename ${project.label}`}
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      ) : (
        <>
          <button
            type="button"
            className="project-toggle"
            aria-expanded={expanded}
            title={project.cwd}
            onClick={onToggle}
          >
            <span className={`project-caret${expanded ? " open" : ""}`} aria-hidden="true">
              ▸
            </span>
            <svg className="project-icon" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span className="project-label">{project.label}</span>
            <span className="project-count">{chatCount}</span>
          </button>
          <RowMenu
            label={`Options for ${project.label}`}
            items={[
              { label: "Rename", onSelect: onStartRename },
              { label: "Reset name", onSelect: onResetName },
              { label: project.hidden ? "Unhide" : "Hide", onSelect: onToggleHidden },
            ]}
          />
        </>
      )}
    </div>
  );
}
