import './vendor/peerjs.min.js';
import { createPlayer, createRoom, addPlayer, removePlayer, advanceRoom, applyAction, snapshot, eventMessages } from './engine.js';

const PREFIX = 'hide-snipe-duel-v3-';
const clone = value => JSON.parse(JSON.stringify(value));
const roomCode = () => String(1000 + crypto.getRandomValues(new Uint32Array(1))[0] % 9000);

/** GitHub Pages hosts the files; WebRTC carries the match between the two browsers. */
export class P2PTransport extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  constructor() {
    super();
    this.readyState = 0;
    this.peer = null;
    this.conn = null;
    this.room = null;
    this.player = null;
    this.isHost = false;
    this.connections = new Map();
    this.cursors = new Map();
    this.revision = 0;
    this.joining = false;
    this.closed = false;
    this.tickTimer = null;
    this.joinTimer = null;
    this.registration = 0;
    this.lastShotSeq = 0;
    queueMicrotask(() => {
      if (this.closed) return;
      this.readyState = 1;
      this.dispatchEvent(new Event('open'));
    });
  }

  _emit(message) {
    if (this.closed) return;
    if (message.type === 'shot' && Number.isFinite(message.seq)) {
      if (message.seq <= this.lastShotSeq) return;
      this.lastShotSeq = message.seq;
    }
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
  _error(code, message) { this._emit({ type: 'error', code, message }); }
  _fatal(message) {
    this._error('NETWORK', message);
    this.close(message);
  }

  send(value) {
    if (this.readyState !== 1 || this.closed) return;
    let action;
    try { action = typeof value === 'string' ? JSON.parse(value) : value; } catch { return; }
    if (!action || typeof action.type !== 'string') return;
    if (action.type === 'join') { this._join(action); return; }
    if (action.type === 'leave') { this.close(); return; }
    if (!this.player) return;
    if (action.type === 'ping') {
      if (this.isHost) this._emit({ type: 'pong', at: action.at });
      else if (this.conn?.open) this.conn.send({ type: 'ping', at: action.at });
      return;
    }
    action = { ...action, actionId: crypto.randomUUID() };
    if (this.isHost) this._act(this.player.id, action);
    else if (this.conn?.open) this.conn.send({ type: 'action', action });
  }

  _newPeer(id) {
    const Peer = window.Peer;
    if (!Peer) throw new Error('联机组件未能加载，请刷新页面');
    return id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
  }
  _join(action) {
    if (this.joining || this.player || this.closed) return;
    this.joining = true;
    const code = String(action.room || '').trim();
    if (code && !/^\d{4}$/.test(code)) return this._error('ROOM', '请输入四位房间码');
    this.joinTimer = setTimeout(() => this._fatal('连接超时，请确认双方网络允许浏览器联机'), 28000);
    try {
      if (!code || action.create) this._create(action.name);
      else this._connect(code, action.name);
    } catch (error) { this._fatal(error.message || '无法建立浏览器连接'); }
  }
  _create(name) {
    if (this.closed) return;
    const attempt = ++this.registration, code = roomCode();
    const peer = this._newPeer(PREFIX + code);
    this.peer = peer;
    peer.on('open', () => {
      if (this.closed || this.peer !== peer) return;
      clearTimeout(this.joinTimer);
      this.isHost = true;
      this.player = createPlayer(name);
      this.room = createRoom(code, this.player);
      this.cursors.set(this.player.id, 0);
      this._emit({ type: 'welcome', id: this.player.id, room: code, hostId: this.player.id });
      this._publish();
      this.tickTimer = setInterval(() => {
        if (!this.room || this.closed) return;
        // The local player is here while this page remains open.
        this.room.players.find(p => p.id === this.player.id).lastSeen = Date.now();
        advanceRoom(this.room);
        for (const [playerId, conn] of this.connections) {
          if (!this.room.players.some(player => player.id === playerId)) {
            this.connections.delete(playerId);
            this.cursors.delete(playerId);
            conn.close();
          }
        }
        this._publish();
      }, 1000 / 15);
    });
    peer.on('connection', conn => this._accept(conn));
    peer.on('error', error => {
      if (this.peer !== peer || this.closed) return;
      if (error.type === 'unavailable-id' && attempt < 8 && !this.room) { peer.destroy(); this._create(name); return; }
      this._peerError(error);
    });
    peer.on('disconnected', () => { if (!this.closed && !peer.destroyed) peer.reconnect(); });
  }
  _connect(code, name) {
    const peer = this._newPeer(); this.peer = peer;
    peer.on('open', () => {
      if (this.closed || this.peer !== peer) return;
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json', metadata: { game: PREFIX } });
      this.conn = conn;
      conn.on('open', () => conn.send({ type: 'hello', name }));
      conn.on('data', message => {
        if (this.closed || !message || typeof message !== 'object') return;
        if (message.type === 'welcome') {
          clearTimeout(this.joinTimer);
          this.player = { id: message.id };
          this._emit(message);
        } else if (message.type === 'packet' && Array.isArray(message.messages)) {
          for (const item of message.messages) this._emit(item);
        } else if (message.type === 'host_closed') this._fatal('房主已关闭网页，房间已结束');
        else if (['error', 'pong'].includes(message.type)) this._emit(message);
      });
      conn.on('close', () => { if (!this.closed) this._fatal('与房主的连接已断开，请重新加入'); });
      conn.on('error', () => { if (!this.closed) this._fatal('浏览器之间的连接未能建立'); });
    });
    peer.on('error', error => this._peerError(error));
    peer.on('disconnected', () => { if (!this.closed && !peer.destroyed) peer.reconnect(); });
  }
  _peerError(error) {
    if (this.closed) return;
    const message = error.type === 'peer-unavailable' ? '没有找到房间，请确认房主仍保持网页开启'
      : error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error' ? '无法连接公共联机服务，请检查网络后重试'
      : error.type === 'browser-incompatible' ? '当前浏览器不支持联机，请使用新版 Chrome、Edge 或 Safari'
      : '浏览器联机连接失败，请重新创建或加入房间';
    this._error(error.type === 'peer-unavailable' ? 'ROOM' : 'NETWORK', message);
    this.close(message);
  }

  _accept(conn) {
    if (this.closed || !this.room || conn.metadata?.game !== PREFIX) { conn.close(); return; }
    let playerId = null, count = 0, rateAt = Date.now();
    const timer = setTimeout(() => { if (!playerId) conn.close(); }, 10000);
    conn.on('data', message => {
      if (this.closed || !message || typeof message !== 'object') return;
      const now = Date.now();
      if (now - rateAt >= 1000) { rateAt = now; count = 0; }
      if (++count > 80 || JSON.stringify(message).length > 16384) { conn.close(); return; }
      if (message.type === 'hello' && !playerId) {
        try {
          const player = createPlayer(message.name);
          advanceRoom(this.room);
          addPlayer(this.room, player);
          playerId = player.id; clearTimeout(timer);
          this.connections.set(playerId, conn);
          this.cursors.set(playerId, this.room.eventSeq);
          conn.send({ type: 'welcome', id: playerId, room: this.room.code, hostId: this.room.hostId });
          this._publish();
        } catch (error) {
          conn.send({ type: 'error', code: error.code || 'FULL', message: error.message || '房间已满' });
          setTimeout(() => conn.close(), 150);
        }
        return;
      }
      if (!playerId) return;
      const player = this.room.players.find(p => p.id === playerId);
      if (!player) { conn.close(); return; }
      player.lastSeen = now;
      if (message.type === 'ping') conn.send({ type: 'pong', at: message.at });
      if (message.type === 'action' && message.action && typeof message.action.type === 'string') this._act(playerId, message.action);
    });
    const disconnected = () => {
      clearTimeout(timer);
      if (this.closed || !playerId || !this.room) return;
      this.connections.delete(playerId); this.cursors.delete(playerId);
      if (removePlayer(this.room, playerId)) this._publish();
      playerId = null;
    };
    conn.on('close', disconnected); conn.on('error', disconnected);
  }

  _act(playerId, action) {
    if (!this.room || this.closed) return;
    try {
      advanceRoom(this.room);
      applyAction(this.room, playerId, action);
      this._publish();
    } catch (error) {
      if (action.type === 'move' && ['PHASE', 'ROLE'].includes(error.code)) return;
      const message = { type: 'error', code: error.code || 'MESSAGE', message: error.message || '操作未完成' };
      if (playerId === this.player.id) this._emit(message);
      else this.connections.get(playerId)?.send(message);
    }
  }
  _publish() {
    if (!this.room || this.closed) return;
    const now = Date.now(), revision = ++this.revision;
    for (const player of this.room.players) {
      const messages = [...eventMessages(this.room, this.cursors.get(player.id) || 0), { type: 'state', state: snapshot(this.room, player.id, now, revision) }];
      this.cursors.set(player.id, this.room.eventSeq);
      if (player.id === this.player.id) for (const message of messages) this._emit(message);
      else { const conn = this.connections.get(player.id); if (conn?.open) conn.send({ type: 'packet', messages }); }
    }
  }

  close(reason = '') {
    if (this.closed) return;
    this.closed = true; this.readyState = 3;
    clearTimeout(this.joinTimer); clearInterval(this.tickTimer);
    if (this.isHost) {
      for (const conn of this.connections.values()) {
        if (conn.open) conn.send({ type: 'host_closed' });
        setTimeout(() => conn.close(), 100);
      }
      this.connections.clear();
    } else this.conn?.close();
    setTimeout(() => this.peer?.destroy(), 150);
    this.dispatchEvent(new CloseEvent('close', { reason }));
  }
}
