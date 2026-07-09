import { computeLineDiff, diffStat } from "../session/diff";

interface DiffViewProps {
  path: string;
  oldText?: string | null;
  newText: string;
}

/// A compact line-level diff for a file edit: a header with the path and a
/// +added/−removed stat, then the changed lines.
export function DiffView({ path, oldText, newText }: DiffViewProps) {
  const lines = computeLineDiff(oldText, newText);
  const { added, removed } = diffStat(lines);

  return (
    <div className="diff">
      <div className="diff-head">
        <span className="diff-path">{path}</span>
        <span className="diff-stat">
          <span className="diff-added">+{added}</span> <span className="diff-removed">−{removed}</span>
        </span>
      </div>
      <pre className="diff-body">
        {lines.map((line, i) => (
          <div key={i} className={`diff-line diff-${line.type}`}>
            <span className="diff-gutter">
              {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
            </span>
            {line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
