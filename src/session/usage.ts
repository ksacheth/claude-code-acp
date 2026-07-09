/// A snapshot of context/cost usage from the engine's `usage_update`.
export interface Usage {
  /// Tokens currently in context.
  used: number;
  /// Total context-window size in tokens.
  size: number;
  /// Cumulative session cost, if the engine reports it.
  cost?: { amount: number; currency: string } | null;
}

/// Compact token count: 850, 12.3k, 200k.
export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  const thousands = n / 1000;
  return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1)}k`;
}

/// Percent of the context window in use (0 when size is unknown).
export function contextPercent(usage: Usage): number {
  if (usage.size <= 0) return 0;
  return Math.round((usage.used / usage.size) * 100);
}

/// "12.3k / 200k (6%)".
export function formatContext(usage: Usage): string {
  return `${formatTokens(usage.used)} / ${formatTokens(usage.size)} (${contextPercent(usage)}%)`;
}

/// "$0.0421" / "$1.20" / "EUR 2.00", or null when no cost is reported.
export function formatCost(cost: Usage["cost"]): string | null {
  if (!cost) return null;
  const prefix = cost.currency === "USD" ? "$" : `${cost.currency} `;
  const digits = cost.amount < 1 ? 4 : 2;
  return `${prefix}${cost.amount.toFixed(digits)}`;
}
