import { describe, it, expect } from "vitest";
import { byteSinkToLineChannel, lineSourceToByteStream } from "./transport";

const encode = (s: string) => new TextEncoder().encode(s);
const decode = (b: Uint8Array) => new TextDecoder().decode(b);

describe("byteSinkToLineChannel", () => {
  it("splits a multi-line chunk into individual lines without newlines", async () => {
    const lines: string[] = [];
    const stream = byteSinkToLineChannel((l) => {
      lines.push(l);
    });
    const writer = stream.getWriter();
    await writer.write(encode('{"a":1}\n{"b":2}\n'));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("reassembles a line split across chunks", async () => {
    const lines: string[] = [];
    const stream = byteSinkToLineChannel((l) => {
      lines.push(l);
    });
    const writer = stream.getWriter();
    await writer.write(encode('{"hel'));
    await writer.write(encode('lo":true}\n'));
    expect(lines).toEqual(['{"hello":true}']);
  });

  it("drops blank lines", async () => {
    const lines: string[] = [];
    const stream = byteSinkToLineChannel((l) => {
      lines.push(l);
    });
    const writer = stream.getWriter();
    await writer.write(encode("\n\nx\n\n"));
    expect(lines).toEqual(["x"]);
  });

  it("awaits an async sendLine before continuing", async () => {
    const order: string[] = [];
    const stream = byteSinkToLineChannel(async (l) => {
      await Promise.resolve();
      order.push(l);
    });
    const writer = stream.getWriter();
    await writer.write(encode("a\nb\n"));
    expect(order).toEqual(["a", "b"]);
  });
});

describe("lineSourceToByteStream", () => {
  it("frames each emitted line with a trailing newline", async () => {
    let emit!: (line: string) => void;
    const stream = lineSourceToByteStream((onLine) => {
      emit = onLine;
      return () => {};
    });
    const reader = stream.getReader();

    emit('{"id":1}');
    const first = await reader.read();
    expect(decode(first.value!)).toBe('{"id":1}\n');

    emit('{"id":2}');
    const second = await reader.read();
    expect(decode(second.value!)).toBe('{"id":2}\n');
  });

  it("closes the stream when the agent exits", async () => {
    let close!: () => void;
    const stream = lineSourceToByteStream((_onLine, onClose) => {
      close = onClose;
      return () => {};
    });
    const reader = stream.getReader();
    close();
    const result = await reader.read();
    expect(result.done).toBe(true);
  });

  it("unsubscribes when the reader cancels", async () => {
    let unsubscribed = false;
    const stream = lineSourceToByteStream(() => () => {
      unsubscribed = true;
    });
    const reader = stream.getReader();
    await reader.cancel();
    expect(unsubscribed).toBe(true);
  });
});
