import type {
  PermissionOptionId,
  PermissionOptionKind,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";

/// The user chose a permission option.
export function selectedOutcome(optionId: PermissionOptionId): RequestPermissionResponse {
  return { outcome: { outcome: "selected", optionId } };
}

/// The request was dismissed/aborted without a choice.
export function cancelledOutcome(): RequestPermissionResponse {
  return { outcome: { outcome: "cancelled" } };
}

/// Whether an option grants (vs. rejects) — used to style the buttons.
export function isAllow(kind: PermissionOptionKind): boolean {
  return kind === "allow_once" || kind === "allow_always";
}
