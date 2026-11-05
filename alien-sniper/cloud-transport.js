/** Server-authoritative connection over HTTPS/WebSocket. Does not use WebRTC. */
export class CloudTransport extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  constructor(serverUrl) {
    super();
    this.readyState = 0;
    this.closed = false;
    this.socket = null;
    this.abort = new AbortController();
    this.startedAt = Date.now();
    this.serverUrl = serverUrl;
    queueMicrotask(() => this._connect());
  }

  _progress(message) {
    this.dispatchEvent(new MessageEvent('progress', { data: message }));
  }

  async _connect() {
    try {
      const base = new URL(this.serverUrl);
      const health = new URL('/api/health', base);
      const deadline = this.startedAt + 90000;
      this._progress('正在连接联机服务器…');
      let reachable = false;
      for (let attempt = 0; !this.closed && Date.now() < deadline; attempt++) {
        const request = new AbortController();
        const cancel = () => request.abort();
        this.abort.signal.addEventListener('abort', cancel, { once: true });
        const timeout = setTimeout(cancel, Math.min(12000, deadline - Date.now()));
        try {
          const response = await fetch(health, {
            cache: 'no-store', credentials: 'omit',
            signal: request.signal,
          });
          const data = response.ok ? await response.json() : null;
          if (data?.ok && data.mode === 'relay') { reachable = true; break; }
        } catch {}
        finally { clearTimeout(timeout); this.abort.signal.removeEventListener('abort', cancel); }
        if (this.closed) return;
        this._progress('正在唤醒联机服务器，首次连接可能需要约一分钟…');
        await new Promise(resolve => {
          const finish = () => { clearTimeout(delay); this.abort.signal.removeEventListener('abort', finish); resolve(); };
          const delay = setTimeout(finish, Math.max(0, Math.min(1000 * 2 ** attempt, 5000, deadline - Date.now())));
          this.abort.signal.addEventListener('abort', finish, { once: true });
        });
      }
      if (this.closed) return;
      if (!reachable) return this.close('暂时无法连接联机服务器，请稍后重试');
      const url = new URL('/ws', base);
      url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      this.socket = socket;
      const opening = setTimeout(() => this.close('联机服务器连接超时，请重试'), 12000);
      socket.addEventListener('open', () => {
        clearTimeout(opening);
        if (this.closed) return socket.close();
        this.readyState = 1;
        this.dispatchEvent(new Event('open'));
      });
      socket.addEventListener('message', event => {
        if (!this.closed) this.dispatchEvent(new MessageEvent('message', { data: event.data }));
      });
      socket.addEventListener('close', () => {
        clearTimeout(opening);
        this.close('与联机服务器的连接已断开，请重新加入房间');
      });
      socket.addEventListener('error', () => {});
    } catch {
      this.close('联机服务器地址无效，请联系房主');
    }
  }

  send(message) {
    if (!this.closed && this.socket?.readyState === WebSocket.OPEN) this.socket.send(message);
  }

  close(reason = '') {
    if (this.closed) return;
    this.closed = true;
    this.readyState = 3;
    this.abort.abort();
    this.socket?.close();
    this.dispatchEvent(new CloseEvent('close', { reason }));
  }
}
