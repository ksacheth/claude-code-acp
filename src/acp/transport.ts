import { ndJsonStream, type Stream } from "@agentclientprotocol/sdk";

/// A newline-delimited line channel to the agent subprocess. The Tauri
/// implementation wires `sendLine` to the `agent_send` command and `subscribe`
/// to the `agent-stdout` / `agent-exit` events; tests supply a fake.
export interface LineChannel {
  /// Send one complete line (no trailing newline) to the agent's stdin.
  sendLine(line: string): Promise<void> | void;
  /// Receive agent stdout lines. `onClose` fires when the agent exits.
  /// Returns an unsubscribe function.
  subscribe(onLine: (line: string) => void, onClose: () => void): () => void;
}

/// Turn a stream of agent stdout lines into the byte `ReadableStream` that
/// `ndJsonStream` parses. Each line is re-framed with a trailing newline.
export function lineSourceToByteStream(
  subscribe: LineChannel["subscribe"],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      unsubscribe = subscribe(
        (line) => {
          if (!closed) controller.enqueue(encoder.encode(line + "\n"));
        },
        () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed/errored — nothing to do.
          }
        },
      );
    },
    cancel() {
      unsubscribe();
    },
  });
}

/// Consume the byte `WritableStream` that `ndJsonStream` writes to, split it on
/// newlines, and forward each complete line via `sendLine`. Handles chunks that
/// split a line or carry several lines; blank lines are dropped.
export function byteSinkToLineChannel(
  sendLine: LineChannel["sendLine"],
): WritableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new WritableStream<Uint8Array>({
    async write(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.length > 0) await sendLine(line);
      }
    },
  });
}

/// Compose a `LineChannel` into the `Stream` expected by the ACP client.
export function createLineStream(channel: LineChannel): Stream {
  return ndJsonStream(
    byteSinkToLineChannel(channel.sendLine.bind(channel)),
    lineSourceToByteStream(channel.subscribe.bind(channel)),
  );
}
