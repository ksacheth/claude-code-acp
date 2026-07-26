/// What to show the user when a request to the engine fails.
///
/// A thrown Error crosses JSON-RPC as a generic "Internal error" whose message
/// says nothing: the real text is carried in `data.details` (or `data.message`,
/// when the engine sent structured data). Prefer that, and fall back to the
/// error's own message when there is nothing better.
export function requestErrorMessage(error: unknown): string {
  const data = (error as { data?: unknown } | null)?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    for (const key of ["details", "message"] as const) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
