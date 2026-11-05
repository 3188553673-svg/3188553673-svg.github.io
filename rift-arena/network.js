export class ArenaConnection extends EventTarget {
  constructor() {
    super(); this.readyState=0; this.closed=false; this.socket=null; this.abort=new AbortController();
    queueMicrotask(()=>this.connect());
  }
  progress(text) { if(!this.closed)this.dispatchEvent(new MessageEvent('progress',{data:text})); }
  async request(url,timeout=12000) {
    const c=new AbortController(), cancel=()=>c.abort();
    this.abort.signal.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(cancel,timeout);
    try {
      const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:c.signal});
      const data=response.ok?await response.json():null;
      return {ok:response.ok,status:response.status,data};
    }
    finally { clearTimeout(timer); this.abort.signal.removeEventListener('abort',cancel); }
  }
  async connect() {
    try {
      this.progress('正在读取房间设置…');
      const configResponse=await this.request(new URL('./connection.json',import.meta.url),9000);
      if(!configResponse.ok)throw Error('房间设置未能加载，请刷新后重试');
      const config=configResponse.data;
      if(config.mode!=='relay'||!config.serverUrl)throw Error('联机服务正在准备，请稍后刷新再试');
      const base=new URL(config.serverUrl);
      const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
      if(base.username||base.password||base.search||base.hash||base.pathname!=='/'||(base.protocol!=='https:'&&!(local&&base.protocol==='http:')))throw Error('联机地址无效，请稍后刷新重试');
      const deadline=Date.now()+90000; let healthy=false;
      for(let attempt=0;!this.closed&&Date.now()<deadline;attempt++) {
        this.progress(Date.now()+75000<deadline?'正在连接峡谷服务器…':'正在唤醒战场，首次进入可能需要约一分钟…');
        try {
          const r=await this.request(new URL('/api/health',base),Math.min(12000,deadline-Date.now()));
          const data=r.data;
          if(data?.ok&&data.mode==='relay'&&data.game==='rift-arena'){healthy=true;break;}
          if(data?.ok&&data.game!=='rift-arena')throw Error('WRONG_GAME');
        } catch(error) { if(error.message==='WRONG_GAME')throw Error('联机地址不是峡谷对决服务器，请刷新后重试'); }
        if(this.closed)return;
        await new Promise(resolve=>{const done=()=>{clearTimeout(t);this.abort.signal.removeEventListener('abort',done);resolve();};const t=setTimeout(done,Math.max(0,Math.min(1000*2**attempt,4500,deadline-Date.now())));this.abort.signal.addEventListener('abort',done,{once:true});});
      }
      if(this.closed)return;
      if(!healthy)throw Error('战场暂时未能启动，请稍后重试');
      const endpoint=new URL('/ws',base);endpoint.protocol=base.protocol==='https:'?'wss:':'ws:';
      const socket=new WebSocket(endpoint);this.socket=socket;
      const timer=setTimeout(()=>this.close('服务器连接超时，请重试'),12000);
      socket.addEventListener('open',()=>{clearTimeout(timer);if(this.closed)return socket.close();this.readyState=1;this.dispatchEvent(new Event('open'));});
      socket.addEventListener('message',e=>{if(!this.closed)this.dispatchEvent(new MessageEvent('message',{data:e.data}));});
      socket.addEventListener('close',()=>{clearTimeout(timer);this.close('与战场的连接已断开，请重新加入房间');});
      socket.addEventListener('error',()=>{});
    } catch(error) { if(!this.closed)this.close(error.message||'无法连接联机服务器，请重试'); }
  }
  send(data) { if(!this.closed&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(typeof data==='string'?data:JSON.stringify(data)); }
  close(reason='') { if(this.closed)return;this.closed=true;this.readyState=3;this.abort.abort();this.socket?.close();const event=new Event('close');Object.defineProperty(event,'reason',{value:reason});this.dispatchEvent(event); }
}
