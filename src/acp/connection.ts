import {
  client as acpClient,
  methods,
  type ClientContext,
  type InitializeResponse,
  type RequestPermissionResponse,
  type SessionNotification,
} from "@agentclientprotocol/sdk";

import { createLineStream, type LineChannel } from "./transport";

export interface ConnectHandlers {
  /// Streaming session updates: message/thought chunks, tool calls, plans, usage.
  onSessionUpdate?: (update: SessionNotification) => void;
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
/// M0 advertises no client capabilities and auto-cancels permission requests
/// (logged), matching the SPEC — real permission UI and fs access arrive in M2.
export async function connectAgent(
  channel: LineChannel,
  handlers: ConnectHandlers = {},
): Promise<AgentConnection> {
  const stream = createLineStream(channel);

  const connection = acpClient({ name: "claude-tauri" })
    .onNotification(methods.client.session.update, (ctx) => {
      handlers.onSessionUpdate?.(ctx.params);
    })
    .onRequest(methods.client.session.requestPermission, async (ctx): Promise<RequestPermissionResponse> => {
      console.warn("[acp] permission request auto-cancelled (M0):", ctx.params);
      return { outcome: { outcome: "cancelled" } };
    })
    .connect(stream);

  const init = await connection.agent.request(methods.agent.initialize, {
    protocolVersion: 1,
    clientCapabilities: {},
  });

  return {
    agentInfo: init.agentInfo,
    capabilities: init.agentCapabilities,
    ctx: connection.agent,
    closed: connection.closed,
  };
}
