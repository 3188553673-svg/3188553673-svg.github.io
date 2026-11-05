const MAX_MESSAGE = 64 * 1024;
const MAX_CONTROL_FRAMES = 256;
const MAX_CONTROL_BYTES = 128 * 1024;
const MAX_STATE_BYTES = 1024 * 1024;

function frame(opcode, payload = Buffer.alloc(0)) {
  if (!Buffer.isBuffer(payload)) payload = Buffer.from(payload);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Small RFC 6455 server transport. Clients always mask; fragmented text and control frames are supported. */
export function websocket(socket, onMessage, onClose) {
  let buffer = Buffer.alloc(0);
  let fragments = [];
  let fragmentLength = 0;
  let fragmented = false;
  let closed = false;
  let reported = false;
  let blocked = false;
  let flushing = false;
  let latestState = null;
  let controlBytes = 0;
  const controls = [];
  const report = () => { if (!reported) { reported = true; onClose(); } };
  function clearPending() {
    latestState = null; controls.length = 0; controlBytes = 0;
    buffer = Buffer.alloc(0); fragments = []; fragmentLength = 0; fragmented = false;
    socket.off('drain', onDrain);
  }
  function finish() { closed = true; clearPending(); report(); }
  function flush() {
    if (closed || socket.destroyed || blocked || flushing) return;
    flushing = true;
    try {
      while (!closed && !socket.destroyed && !blocked) {
        let data;
        if (controls.length) { data = controls.shift(); controlBytes -= data.length; }
        else if (latestState) { data = latestState; latestState = null; }
        else break;
        // A false result still accepts this frame into Node's stream buffer.
        // Remove it before writing and resume only when drain fires.
        if (socket.write(data) === false) blocked = true;
      }
    } catch {
      finish(); socket.destroy();
    } finally { flushing = false; }
  }
  function onDrain() { blocked = false; flush(); }
  function enqueue(data, isState = false) {
    if (closed || socket.destroyed) return;
    if (isState) {
      if (data.length > MAX_STATE_BYTES) return connection.close(1013, 'State exceeds transport budget');
      latestState = data;
    } else {
      if (controls.length >= MAX_CONTROL_FRAMES || controlBytes + data.length > MAX_CONTROL_BYTES) {
        return connection.close(1013, 'Client is not reading');
      }
      controls.push(data); controlBytes += data.length;
    }
    flush();
  }
  const connection = {
    send(value) {
      if (closed || socket.destroyed) return;
      // A departed room's queued state cannot follow its leave acknowledgement.
      if (value?.type === 'left' || value?.type === 'welcome') latestState = null;
      enqueue(frame(1, JSON.stringify(value)), value?.type === 'state');
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      closed = true;
      clearPending();
      const message = Buffer.from(reason).subarray(0, 123);
      const data = Buffer.alloc(message.length + 2);
      data.writeUInt16BE(code);
      message.copy(data, 2);
      socket.end(frame(8, data));
      const timer = setTimeout(() => socket.destroy(), 500);
      timer.unref();
      report();
    },
    feed(chunk) {
      if (closed) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_MESSAGE + 1024) return connection.close(1009, 'Message too large');
      while (buffer.length >= 2 && !closed) {
        const first = buffer[0], second = buffer[1];
        const fin = Boolean(first & 0x80), opcode = first & 0x0f;
        if ((first & 0x70) || !(second & 0x80)) return connection.close(1002, 'Invalid frame');
        let length = second & 0x7f, offset = 2;
        if (length === 126) {
          if (buffer.length < 4) return;
          length = buffer.readUInt16BE(2);
          offset = 4;
          if (length < 126) return connection.close(1002, 'Invalid length');
        } else if (length === 127) {
          if (buffer.length < 10) return;
          const big = buffer.readBigUInt64BE(2);
          if (big > BigInt(MAX_MESSAGE)) return connection.close(1009, 'Message too large');
          length = Number(big);
          offset = 10;
          if (length <= 65535) return connection.close(1002, 'Invalid length');
        }
        if (length > MAX_MESSAGE || opcode < 8 && fragmentLength + length > MAX_MESSAGE) return connection.close(1009, 'Message too large');
        if (opcode >= 8 && (!fin || length > 125)) return connection.close(1002, 'Invalid control frame');
        if (buffer.length < offset + 4 + length) return;
        const mask = buffer.subarray(offset, offset + 4);
        offset += 4;
        const data = Buffer.from(buffer.subarray(offset, offset + length));
        buffer = buffer.subarray(offset + length);
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        if (opcode === 8) {
          if (data.length === 1) return connection.close(1002, 'Invalid close');
          closed = true;
          clearPending();
          socket.end(frame(8, data));
          report();
          return;
        }
        if (opcode === 9) { enqueue(frame(10, data)); continue; }
        if (opcode === 10) continue;
        if (opcode === 2) return connection.close(1003, 'Text messages only');
        if (opcode !== 0 && opcode !== 1) return connection.close(1002, 'Unknown opcode');
        if (opcode === 0 && !fragmented || opcode === 1 && fragmented) return connection.close(1002, 'Invalid continuation');
        if (opcode === 1 && !fin) { fragmented = true; fragments = [data]; fragmentLength = data.length; continue; }
        if (opcode === 0) { fragments.push(data); fragmentLength += data.length; if (!fin) continue; }
        const message = opcode === 0 ? Buffer.concat(fragments, fragmentLength) : data;
        fragments = []; fragmentLength = 0; fragmented = false;
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(message); }
        catch { return connection.close(1007, 'Invalid UTF-8'); }
        onMessage(text);
      }
    },
  };
  socket.on('data', connection.feed);
  socket.on('drain', onDrain);
  socket.on('error', finish);
  socket.on('close', finish);
  socket.setNoDelay(true);
  return connection;
}

