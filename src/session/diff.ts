export type DiffLineType = "context" | "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/// `table[i][j]` = length of the longest common subsequence of `a[i:]`, `b[j:]`.
function buildLcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

/// Walk the LCS table front-to-back, emitting context / remove / add lines.
function backtrack(a: string[], b: string[], table: number[][]): DiffLine[] {
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: "context", text: a[i++] });
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      lines.push({ type: "remove", text: a[i++] });
    } else {
      lines.push({ type: "add", text: b[j++] });
    }
  }
  while (i < a.length) lines.push({ type: "remove", text: a[i++] });
  while (j < b.length) lines.push({ type: "add", text: b[j++] });
  return lines;
}

/// Compute a line-level diff via an LCS, yielding an ordered list of context /
/// added / removed lines. A null/empty `oldText` (new file) yields all
/// additions.
export function computeLineDiff(oldText: string | null | undefined, newText: string): DiffLine[] {
  const a = oldText ? oldText.split("\n") : [];
  const b = newText ? newText.split("\n") : [];
  return backtrack(a, b, buildLcsTable(a, b));
}

/// Count added and removed lines for a compact summary (e.g. "+3 −1").
export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "add") added++;
    else if (line.type === "remove") removed++;
  }
  return { added, removed };
}
