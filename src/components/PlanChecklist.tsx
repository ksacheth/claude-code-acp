import type { PlanEntry, PlanEntryStatus } from "@agentclientprotocol/sdk";

const STATUS_MARK: Record<PlanEntryStatus, string> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
};

/// The agent's live execution plan as a checklist. The agent replaces the whole
/// plan on each update, so this always reflects the latest snapshot.
export function PlanChecklist({ entries }: { entries: PlanEntry[] }) {
  if (entries.length === 0) return null;
  const done = entries.filter((e) => e.status === "completed").length;

  return (
    <details className="plan" open>
      <summary>
        Plan <span className="plan-count">{done}/{entries.length}</span>
      </summary>
      <ul className="plan-list">
        {entries.map((entry, i) => (
          <li key={i} className={`plan-entry plan-${entry.status}`}>
            <span className="plan-mark">{STATUS_MARK[entry.status]}</span>
            {entry.content}
          </li>
        ))}
      </ul>
    </details>
  );
}
