import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";

import { cancelledOutcome, isAllow, selectedOutcome } from "../session/permission";

interface PermissionModalProps {
  request: RequestPermissionRequest;
  onResolve: (response: RequestPermissionResponse) => void;
}

/// A blocking prompt for a tool permission request, showing the tool and all
/// options the agent offered. Dismissing (backdrop / Esc) cancels.
export function PermissionModal({ request, onResolve }: PermissionModalProps) {
  const title = request.toolCall.title ?? "Permission request";

  return (
    <div className="modal-backdrop" onClick={() => onResolve(cancelledOutcome())}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Allow this action?</div>
        <div className="modal-tool">{title}</div>
        <div className="modal-options">
          {request.options.map((option) => (
            <button
              key={option.optionId}
              className={isAllow(option.kind) ? "allow" : "reject"}
              onClick={() => onResolve(selectedOutcome(option.optionId))}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
