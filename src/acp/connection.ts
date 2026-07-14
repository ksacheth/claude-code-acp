import {
  client as acpClient,
  methods,
  type ClientContext,
  type CreateElicitationRequest,
  type CreateElicitationResponse,
  type InitializeResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
} from "@agentclientprotocol/sdk";

import { createLineStream, type LineChannel } from "./transport";

export interface ConnectHandlers {
  /// Streaming session updates: message/thought chunks, tool calls, plans, usage.
  onSessionUpdate?: (update: SessionNotification) => void;
  /// Decide a permission request. Defaults to auto-cancel (logged) when unset.
  onPermissionRequest?: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  /// Render a form elicitation such as Claude's AskUserQuestion tool.
  onElicitationRequest?: (request: CreateElicitationRequest) => Promise<CreateElicitationResponse>;
}

export interface AgentConnection {
  /// Info from the `initialize` handshake (name, title, version).
  agentInfo: InitializeResponse["agentInfo"];
  /// Full capabilities reported by the agent.
  capabilities: InitializeResponse["agentCapabilities"];
  /// Context for calling agent-side methods (`session/new`, `session/prompt`, …).
  ctx: ClientContext;
  /// Resolves when the connection closes (engine exit or transport error).
  closed: Promise<void>;
}

/// Connect to a running agent over `channel` and complete the `initialize`
/// handshake. The agent process must already be started.
///
/// Advertises no client fs capability (the engine's SDK does its own file I/O).
/// Permission requests are routed to `onPermissionRequest`, or auto-cancelled
/// when no handler is provided.
export async function connectAgent(
  channel: LineChannel,
  handlers: ConnectHandlers = {},
): Promise<AgentConnection> {
  const stream = createLineStream(channel);

  const connection = acpClient({ name: "claude-tauri" })
    .onNotification(methods.client.session.update, (ctx) => {
      handlers.onSessionUpdate?.(ctx.params);
    })
    .onRequest(methods.client.session.requestPermission, (ctx): Promise<RequestPermissionResponse> => {
      if (handlers.onPermissionRequest) return handlers.onPermissionRequest(ctx.params);
      console.warn("[acp] permission request auto-cancelled (no handler):", ctx.params);
      return Promise.resolve({ outcome: { outcome: "cancelled" } });
    })
    .onRequest(methods.client.elicitation.create, (ctx): Promise<CreateElicitationResponse> => {
      if (handlers.onElicitationRequest) return handlers.onElicitationRequest(ctx.params);
      console.warn("[acp] elicitation auto-cancelled (no handler):", ctx.params);
      return Promise.resolve({ action: "cancel" });
    })
    .connect(stream);

  const init = await connection.agent.request(methods.agent.initialize, {
    protocolVersion: 1,
    clientCapabilities: { elicitation: { form: {} } },
  });

  return {
    agentInfo: init.agentInfo,
    capabilities: init.agentCapabilities,
    ctx: connection.agent,
    closed: connection.closed,
  };
}
