/// A snapshot of context/cost usage from the engine's `usage_update`.
export interface Usage {
  /// Tokens currently in context.
  used: number;
  /// Total context-window size in tokens.
  size: number;
  /// Cumulative session cost, if the engine reports it.
  cost?: { amount: number; currency: string } | null;
  /// Claude subscription-limit windows reported by the engine, when applicable.
  rateLimits?: SubscriptionUsageLimit[];
}

export type SubscriptionLimitType =
  | "five_hour"
  | "seven_day"
  | "seven_day_opus"
  | "seven_day_sonnet"
  | "seven_day_overage_included"
  | "overage";

/// One Claude subscription usage window (for example, the five-hour limit).
export interface SubscriptionUsageLimit {
  type?: SubscriptionLimitType;
  status: "allowed" | "allowed_warning" | "rejected";
  utilization?: number;
  resetsAt?: number;
}

const LIMIT_LABELS: Record<NonNullable<SubscriptionUsageLimit["type"]>, string> = {
  five_hour: "5h limit",
  seven_day: "7d limit",
  seven_day_opus: "Opus 7d",
  seven_day_sonnet: "Sonnet 7d",
  seven_day_overage_included: "Weekly limit",
  overage: "Extra usage",
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/// Read a Claude rate-limit event from ACP's extensible metadata field.
/// Unknown or incomplete metadata is ignored so non-Claude engines remain
/// unaffected.
export function rateLimitFromMeta(meta: unknown): SubscriptionUsageLimit | undefined {
  const limit = record(record(meta)?.["_claude/rateLimit"]);
  if (!limit) return undefined;
  const status = limit.status;
  if (status !== "allowed" && status !== "allowed_warning" && status !== "rejected") {
    return undefined;
  }
  const type = limit.rateLimitType;
  const utilization = limit.utilization;
  const resetsAt = limit.resetsAt;
  return {
    status,
    ...(typeof type === "string" && type in LIMIT_LABELS
      ? { type: type as SubscriptionLimitType }
      : {}),
    ...(typeof utilization === "number" ? { utilization: Math.max(0, Math.min(100, utilization)) } : {}),
    ...(typeof resetsAt === "number" ? { resetsAt } : {}),
  };
}

/// Replace the matching time window while retaining any other reported limits.
export function mergeRateLimit(
  limits: SubscriptionUsageLimit[] | undefined,
  next: SubscriptionUsageLimit,
): SubscriptionUsageLimit[] {
  const key = next.type ?? "current";
  const matching = (limits ?? []).find((limit) => (limit.type ?? "current") === key);
  const withoutMatching = (limits ?? []).filter((limit) => (limit.type ?? "current") !== key);
  return [...withoutMatching, matching ? { ...matching, ...next } : next];
}

function resetIn(resetsAt: number, nowMs: number): string {
  // SDK events use epoch milliseconds; also tolerate a seconds timestamp from
  // a future engine version so the UI doesn't claim a reset in 1970.
  const resetMs = resetsAt < 10_000_000_000 ? resetsAt * 1000 : resetsAt;
  const minutes = Math.ceil((resetMs - nowMs) / 60_000);
  if (minutes <= 0) return "resetting now";
  if (minutes < 60) return `resets in ${minutes}m`;
  if (minutes < 24 * 60) return `resets in ${Math.ceil(minutes / 60)}h`;
  return `resets in ${Math.ceil(minutes / (24 * 60))}d`;
}

/// "5h limit: 37% used · resets in 2h".
export function formatRateLimit(limit: SubscriptionUsageLimit, nowMs = Date.now()): string {
  const label = limit.type ? LIMIT_LABELS[limit.type] : "Usage limit";
  const usage = typeof limit.utilization === "number" ? `${Math.round(limit.utilization)}% used` : limit.status;
  const reset = typeof limit.resetsAt === "number" ? ` · ${resetIn(limit.resetsAt, nowMs)}` : "";
  return `${label}: ${usage}${reset}`;
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
