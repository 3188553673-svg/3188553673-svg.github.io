import { ArenaConnection } from './network.mjs';
import { CHARACTERS } from './engine.mjs';
import { ASSIST_PARTNERS } from './moves.mjs';
import { portrait } from './roster.mjs';

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function seatCard(player, index, room) {
  const slot = 'P' + (index + 1);
  if (!player) return `<li class="rr-slot vacant"><span class="rr-slot-label">${slot}</span><span class="rr-plus" aria-hidden="true">+</span><span class="rr-vacant-text">等待加入</span></li>`;
  const fighter = CHARACTERS[player.char];
  const mine = player.clientId === room.clientId;
  const label = mine ? '本机 ' + (player.seat + 1) + 'P' : '局域网玩家';
  const host = player.clientId === room.host && player.seat === 0;
  return `<li class="rr-slot occupied" style="--fighter:${esc(fighter.color)}">
    <img src="${esc(portrait(player.char))}" alt=""><span class="rr-slot-label">${slot}</span>
    <div class="rr-slot-caption"><strong>${esc(fighter.name)}</strong><span>${label}${host ? ' · 房主' : ''}</span><span>援助 · ${esc(CHARACTERS[player.assistChar || ASSIST_PARTNERS[player.char]].name)}</span></div></li>`;
}

function picker(selected) {
  return Object.entries(CHARACTERS).map(([id, fighter]) => `
    <button type="button" class="rr-pick" data-key="pick-${id}" data-pick="${id}" aria-pressed="${id === selected}" style="--fighter:${esc(fighter.color)}">
      <img src="${esc(portrait(id))}" alt=""><span>${esc(fighter.name)}</span>
    </button>`).join('');
}

export class Rooms {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.room = null;
    this.localSeat = 0;
    this.root = document.getElementById('room');
    this.root.addEventListener('click', event => this.click(event));
    this.root.addEventListener('change',event=>{
      if(event.target.id!=='room-assist' || this.room?.phase!=='lobby')return;
      const seats=this.seatChoices();
      seats[this.localSeat].assistChar=event.target.value;
      this.connection.setSeats(seats);
    });
    this.connection = new ArenaConnection({
      onRoom: room => this.update(room),
      onState: state => this.handlers.onState?.(state),
      onError: message => { if (this.room) this.handlers.onNotice?.(message); },
      onClose: message => {
        if (!this.room) return;
        this.room = null;
        this.localSeat = 0;
        this.root.replaceChildren();
        this.handlers.onHome?.(message);
      }
    });
  }

  create(seats = ['doubao']) { this.localSeat = 0; return this.connection.create(seats); }
  join(code, seats = ['doubao']) { this.localSeat = 0; return this.connection.join(code, seats); }
  rematch() { if (this.room?.host === this.room?.clientId) this.connection.start(); }
  lobby() { if (this.room?.host === this.room?.clientId) this.connection.lobby(); }
  leave() {
    this.connection.leave();
    this.room = null; this.localSeat = 0;
    this.root.replaceChildren();
    this.handlers.onHome?.('');
  }

  update(room) {
    const previous = this.room;
    this.room = room;
    if (room.phase === 'lobby') {
      this.render();
      if (previous?.phase !== 'lobby' || previous.code !== room.code) this.handlers.onEnter?.(room);
    } else if (room.phase === 'game' && previous?.phase !== 'game') {
      this.handlers.onGame?.(this.connection, room);
    }
    if (room.notice) this.handlers.onNotice?.(room.notice);
  }

  mySeats() {
    return this.room?.players.filter(p => p.clientId === this.room.clientId).sort((a, b) => a.seat - b.seat) ?? [];
  }

  seatChoices() {
    return this.mySeats().map(({char,assistChar})=>({char,assistChar:assistChar||ASSIST_PARTNERS[char]}));
  }

  render() {
    const room = this.room;
    if (!room) return;
    const mine = this.mySeats(), total = room.players.length;
    this.localSeat = Math.min(this.localSeat, Math.max(0, mine.length - 1));
    const canStart = room.host === room.clientId;
    const selected = mine[this.localSeat]?.char;
    const focusKey = this.root.contains(document.activeElement) && document.activeElement.dataset.key;
    const code = esc(room.code);
    const invitationAvailable = !/^https?:\/\/(?:127\.|localhost)/.test(room.joinUrl);
    const startText = !canStart ? '等待房主开局' : total < 2 ? '等待另一名玩家' : '开始对战';
    const minusOrPlus = mine.length === 1 ? '添加同机 2P' : '移除同机 2P';
    this.root.innerHTML = `
      <header class="rr-head">
        <div><span class="rr-kicker"><i class="signal"></i> LAN LOBBY</span><h2>局域网房间</h2></div>
        <button class="utility rr-leave" data-key="leave" data-act="leave">离开房间</button>
      </header>
      <div class="rr-layout">
        <section class="rr-arena" aria-label="房间玩家">
          <div class="rr-stage"><span>夕照天台 · 扩建区</span><small>60 秒 · 先胜两回合</small></div>
          <div class="rr-seats-header"><h3>参战席位</h3><b>${total} <small>/ 4</small></b></div>
          <ol class="rr-slots">${Array.from({length:4}, (_,i) => seatCard(room.players[i], i, room)).join('')}</ol>
          <section class="rr-choice" aria-label="本机选人">
            <div class="rr-controls"><div class="rr-seat-tabs" role="group" aria-label="选择本机席位">
              ${mine.map(p => `<button type="button" data-key="seat-${p.seat}" data-seat="${p.seat}" aria-pressed="${p.seat === this.localSeat}">本机 ${p.seat+1}P</button>`).join('')}
            </div><button type="button" class="rr-change" data-act="change" data-key="change" ${mine.length === 1 && total >= 4 ? 'disabled title="房间已满"' : ''}>${minusOrPlus}</button></div>
            <div class="rr-picks" role="group" aria-label="给本机 ${this.localSeat + 1}P 选择斗士">${picker(selected)}</div>
            <label class="support-picker">援助斗士<select data-key="support" id="room-assist">${Object.entries(CHARACTERS).filter(([id])=>id!==selected).map(([id,f])=>'<option value="'+id+'" '+(id===(mine[this.localSeat]?.assistChar||ASSIST_PARTNERS[selected])?'selected':'')+'>'+esc(f.name)+'</option>').join('')}</select></label>
          </section>
        </section>
        <aside class="rr-invite"><h3>邀请好友</h3><p>连接同一局域网后，扫码加入房间。</p>
          ${invitationAvailable ? `<div class="rr-qr"><img src="${esc(room.qrUrl)}" alt="加入本房间的二维码"></div>` : '<p class="rr-fallback">主机当前没有可分享的局域网地址，请先连上 Wi-Fi。</p>'}
          <div class="rr-code"><span>房间码</span><b>${code.slice(0,3)} ${code.slice(3)}</b></div>
          ${invitationAvailable ? `<div class="rr-share"><input readonly aria-label="房间邀请链接" data-key="url" value="${esc(room.joinUrl)}"><button type="button" data-act="copy" data-key="copy">复制链接</button></div>` : ''}
          <button type="button" data-act="start" data-key="start" class="primary rr-start" ${!canStart || total < 2 ? 'disabled' : ''}>${startText}${canStart && total>=2 ? '<span aria-hidden="true"> →</span>' : ''}</button>
        </aside>
      </div>`;
    if (focusKey) {
      const next = [...this.root.querySelectorAll('[data-key]')].find(control => control.dataset.key === focusKey);
      next?.focus({preventScroll:true});
    }
  }

  async click(event) {
    const button = event.target.closest('button');
    if (!button || !this.root.contains(button) || button.disabled || !this.room) return;
    const mine = this.seatChoices();
    if ('seat' in button.dataset) {
      this.localSeat = Number(button.dataset.seat);
      this.render();
    } else if (button.dataset.pick && mine[this.localSeat].char !== button.dataset.pick) {
      const char=button.dataset.pick;
      mine[this.localSeat]={char,assistChar:mine[this.localSeat].assistChar===char?ASSIST_PARTNERS[char]:mine[this.localSeat].assistChar};
      this.connection.setSeats(mine);
    } else if (button.dataset.act === 'change') {
      if (mine.length === 1) {
        if (this.room.players.length >= 4) return;
        const taken = new Set(this.room.players.map(p => p.char));
        const char=Object.keys(CHARACTERS).find(id => !taken.has(id)) ?? 'rocket';
        mine.push({char,assistChar:ASSIST_PARTNERS[char]});
        this.localSeat = 1;
      } else {
        mine.pop(); this.localSeat = 0;
      }
      this.connection.setSeats(mine);
    } else if (button.dataset.act === 'copy') {
      const url = this.room.joinUrl;
      const field = this.root.querySelector('[data-key="url"]');
      try {
        await navigator.clipboard.writeText(url);
        this.handlers.onNotice?.('已复制房间邀请链接');
      } catch {
        // Clipboard API is unavailable on plain HTTP LAN origins in many browsers.
        field.focus(); field.select(); field.setSelectionRange(0, field.value.length);
        const copied = document.execCommand?.('copy');
        this.handlers.onNotice?.(copied ? '已复制房间邀请链接' : '邀请链接已选中，可手动复制');
        if (copied) button.focus();
      }
    } else if (button.dataset.act === 'leave') this.leave();
    else if (button.dataset.act === 'start') this.rematch();
  }
}
