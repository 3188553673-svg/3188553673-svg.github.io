let musicTap;
let audioPrepared = false;

export function prepareLan() {
  if (audioPrepared || !window.AudioNode || !window.AudioDestinationNode) return;
  audioPrepared = true;
  const taps = new WeakMap();
  const proto = AudioNode.prototype;
  const {connect, disconnect} = proto;
  proto.connect = function(destination, ...args) {
    if (!(destination instanceof AudioDestinationNode)) return connect.call(this, destination, ...args);
    let tap=taps.get(destination);
    if (!tap) {
      try {
        const mix=this.context.createGain();
        const record=this.context.createMediaStreamDestination();
        connect.call(mix,destination);
        connect.call(mix,record);
        tap={mix,record};taps.set(destination,tap);
      } catch {return connect.call(this,destination,...args);}
    }
    musicTap=tap.record;
    connect.call(this,tap.mix,...args);
    return destination;
  };
  proto.disconnect=function(...args) {
    const tap=args[0] && taps.get(args[0]);
    if (tap) args[0]=tap.mix;
    return disconnect.apply(this,args);
  };
}

const inputMap={KeyA:'ArrowLeft',KeyD:'ArrowRight',KeyW:'ArrowUp',KeyS:'ArrowDown',KeyJ:'Numpad1',KeyK:'Numpad2',KeyL:'Numpad3',KeyU:'Numpad4',KeyI:'Numpad5',KeyO:'Numpad6'};
const keys=new Map(Object.values(inputMap).map(code=>[code,code.startsWith('Numpad')?[code.slice(-1),96+Number(code.slice(-1)),3]:[code,{ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40}[code],0]]));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function dispatchInput(player, code, down) {
  const [key,keyCode,location]=keys.get(code);
  if (typeof player.sendGameKey==='function') {
    player.sendGameKey(keyCode,down);
    return;
  }
  player.focus({preventScroll:true});
  const canvas=player.shadowRoot?.querySelector('canvas') || player;
  canvas.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key,code,keyCode,which:keyCode,location,bubbles:true,cancelable:true,composed:true}));
}
function make(tag, label, className) {
  const node=document.createElement(tag);
  if(label) node.textContent=label;
  if(className) node.className=className;
  return node;
}
async function request(endpoint, data) {
  const res=await fetch('/__lan/'+endpoint,data===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const answer=await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(answer.error || '局域网服务尚未启动');
  return answer;
}

export async function mountLan({container, player, stage}) {
  if (!container || !stage) throw Error('缺少房间或游戏容器');
  const game=typeof player==='function'?player:()=>player;
  const search=new URLSearchParams(location.search);
  const initialCode=search.get('room');
  let room=null,events=null,info=null,stream=null,streamTask=null,serial=0;
  const peers=new Map();
  const held=new Set();
  const button=(label,fn)=>{
    const b=make('button',label);b.type='button';
    b.addEventListener('click',()=>Promise.resolve().then(fn).catch(error=>status.textContent=error.message));
    return b;
  };
  const bar=make('div',null,'bvn-lan-bar');
  const status=make('span',null,'bvn-lan-status');status.setAttribute('role','status');
  const share=make('input');share.readOnly=true;share.setAttribute('aria-label','二号玩家邀请链接');
  const invite=make('div',null,'bvn-lan-invite');invite.hidden=true;
  const copy=button('复制邀请链接',async()=>{try{await navigator.clipboard.writeText(share.value);status.textContent='邀请链接已复制';}catch{share.focus();share.select();if(document.execCommand('copy')) status.textContent='邀请链接已复制';else status.textContent='选中链接后即可复制';}});
  invite.append(share,copy);
  const create=button('创建局域网房间',()=>openRoom(''));
  const code=make('input');code.maxLength=6;code.placeholder='六位房间号';code.setAttribute('aria-label','六位房间号');
  const join=button('加入房间',()=>{
    const value=code.value.trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(value)) throw Error('请输入六位房间号');
    const dest=new URL(location.href);dest.searchParams.set('room',value);location.assign(dest);
  });
  const exit=button('离开房间',()=>{
    closeRoom();
    if(initialCode){const u=new URL(location.href);u.searchParams.delete('room');location.assign(u);}
  });
  exit.hidden=true;
  bar.append(create,code,join,exit,status);container.append(bar,invite);
  let remoteLayer=null,video=null;
  const publishState=()=>{
    const host=room && peers.get(room.host);
    if (host?.channel?.readyState==='open') host.channel.send(JSON.stringify([...held]));
  };
  function keyEvent(event,down) {
    if (room?.role!=='guest' || event.target?.matches?.('input,textarea,[contenteditable=true]')) return;
    const code=inputMap[event.code] || event.code;
    if (!keys.has(code)) return;
    event.preventDefault();
    if (down ? held.has(code) : !held.has(code)) return;
    if (down) held.add(code);else held.delete(code);
    publishState();
  }
  function releaseGuest() {if(held.size){held.clear();publishState();}}
  function showGuest() {
    remoteLayer=make('div',null,'bvn-lan-stage');
    video=make('video');video.autoplay=true;video.playsInline=true;video.muted=true;
    const controls=make('div',null,'bvn-lan-remote-tools');
    const audio=button('开启对战声音',async()=>{video.muted=false;await video.play();audio.hidden=true;});
    controls.append(audio);remoteLayer.append(video,controls);stage.append(remoteLayer);
    if (room.role==='guest') {
      const pad=make('div',null,'bvn-lan-pad');
      for(const [title,key] of Object.entries({'←':'ArrowLeft','→':'ArrowRight','↑':'ArrowUp','防':'ArrowDown','攻':'Numpad1','跳':'Numpad2','闪':'Numpad3','技':'Numpad4','怒':'Numpad5','援':'Numpad6'})){
        const b=make('button',title);b.type='button';
        b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(key);publishState();});
        for(const kind of ['pointerup','lostpointercapture','pointercancel']) b.addEventListener(kind,()=>{if(held.delete(key))publishState();});
        pad.append(b);
      }
      controls.append(pad);
    }
    video.addEventListener('playing',()=>{if(room)status.textContent=room.role==='guest'?'二号玩家已连接 · WASD 移动，JKL / UIO 出招':'正在观战';});
  }
  async function capture() {
    if(stream) return stream;
    if(!streamTask) {
      const id=serial;
      streamTask=(async()=>{
        let canvas;
        for(let n=0;n<160 && id===serial;n++){
          canvas=game()?.shadowRoot?.querySelector('canvas') || game()?.querySelector?.('canvas');
          if(canvas && canvas.width>1) break;
          await delay(250);
        }
        if(id!==serial) throw Error('房间已关闭');
        if(!canvas?.captureStream) throw Error('当前浏览器无法传送游戏画面');
        const result=canvas.captureStream(30);
        for(const track of musicTap?.stream.getAudioTracks() || []) result.addTrack(track.clone());
        stream=result;return result;
      })().finally(()=>streamTask=null);
    }
    return streamTask;
  }
  function removePeer(id) {
    const peer=peers.get(id);if(!peer)return;
    peers.delete(id);
    for(const key of peer.down) {const r=game();if(r)dispatchInput(r,key,false);}
    peer.down.clear();
    if(peer.disconnectTimer)clearTimeout(peer.disconnectTimer);
    peer.pc.close();
  }
  function closeRoom() {
    serial++;
    releaseGuest();
    if(room) navigator.sendBeacon('/__lan/leave?key='+room.secret,'{}');
    events?.close();events=null;room=null;
    for(const id of [...peers.keys()])removePeer(id);
    for(const track of stream?.getTracks() || []) track.stop();
    stream=null;remoteLayer?.remove();remoteLayer=null;video=null;
    invite.hidden=exit.hidden=true;create.hidden=join.hidden=code.hidden=false;status.textContent='';
  }
  function wireChannel(peer,channel) {
    peer.channel=channel;
    if(room.role==='host') {
      channel.onmessage=event=>{
        if(peer.role!=='guest' || !peers.has(peer.id)) return;
        let next;try{next=JSON.parse(event.data);}catch{return;}
        if(!Array.isArray(next) || next.length>keys.size || next.some(c=>!keys.has(c))) return;
        const r=game();if(!r)return;
        const wanted=new Set(next);
        for(const code of peer.down) if(!wanted.has(code))dispatchInput(r,code,false);
        for(const code of wanted) if(!peer.down.has(code))dispatchInput(r,code,true);
        peer.down=wanted;
      };
      channel.onclose=()=>{for(const code of peer.down){const r=game();if(r)dispatchInput(r,code,false);}peer.down.clear();};
    } else channel.onopen=publishState;
  }
  function createPeer(id,role) {
    const pc=new RTCPeerConnection({iceServers:[]});
    const peer={id,pc,role,down:new Set(),early:[],channel:null};
    peers.set(id,peer);
    const secret=room.secret;
    const signal=signal=>request('signal?key='+secret,{to:id,signal});
    pc.onicecandidate=e=>{if(e.candidate)signal({type:'candidate',candidate:e.candidate.toJSON()}).catch(()=>{});};
    pc.ondatachannel=e=>wireChannel(peer,e.channel);
    pc.ontrack=e=>{
      if(!video)return;
      if(e.streams[0]) video.srcObject=e.streams[0];
      else {if(!video.srcObject)video.srcObject=new MediaStream();video.srcObject.addTrack(e.track);}
      video.play().catch(()=>{});
    };
    pc.onconnectionstatechange=()=>{
      if(!room || peers.get(id)!==peer) return;
      if(pc.connectionState==='connected') {
        clearTimeout(peer.disconnectTimer);
        if(room.role==='host') status.textContent=Array.from(peers.values()).some(p=>p.role==='guest' && p.pc.connectionState==='connected')?'二号玩家已连接':'观众已连接，等待二号玩家';
      } else if(pc.connectionState==='failed' || pc.connectionState==='disconnected') {
        status.textContent='连接中断，可重新加入房间';
        for(const code of peer.down){const r=game();if(r)dispatchInput(r,code,false);}peer.down.clear();
      }
    };
    peer.signal=signal;return peer;
  }
  async function handle(message) {
    if(!room)return;
    switch(message.type) {
      case 'joined':{
        const peer=createPeer(message.id,message.role);
        const media=await capture();
        if(!room || peers.get(peer.id)!==peer)return;
        for(const track of media.getTracks()) peer.pc.addTrack(track,media);
        wireChannel(peer,peer.pc.createDataChannel('p2',{ordered:true}));
        await peer.pc.setLocalDescription(await peer.pc.createOffer());
        await peer.signal(peer.pc.localDescription.toJSON());break;
      }
      case 'signal':{
        const signal=message.signal;
        const peer=peers.get(message.from) || createPeer(message.from,'host');
        if(signal.type==='candidate'){
          if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(signal.candidate);
          else peer.early.push(signal.candidate);
          break;
        }
        await peer.pc.setRemoteDescription(signal);
        for(const item of peer.early.splice(0))await peer.pc.addIceCandidate(item);
        if(signal.type==='offer'){
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          await peer.signal(peer.pc.localDescription.toJSON());
        }
        break;
      }
      case 'left':removePeer(message.id);if(room.role==='host')status.textContent='房间已开启，可继续邀请';break;
      case 'ended':closeRoom();status.textContent='房主已关闭房间';break;
    }
  }
  async function openRoom(value) {
    if(room)return;
    if(!window.RTCPeerConnection)throw Error('当前浏览器不支持实时对战连接');
    create.disabled=join.disabled=true;
    try {
      room=await request('open',value?{code:value}:{});
      create.hidden=join.hidden=code.hidden=true;exit.hidden=false;
      if(room.role==='host') {
        const target=new URL(location.href);
        if(['localhost','127.0.0.1','[::1]'].includes(target.hostname) && info?.addresses[0]) target.hostname=info.addresses[0];
        target.searchParams.set('room',room.code);share.value=target.href;invite.hidden=false;
        status.textContent='房间 '+room.code+' · 等待二号玩家';
        game()?.focus({preventScroll:true});
      } else {showGuest();status.textContent='正在连接房主画面…';}
      events=new EventSource('/__lan/events?key='+room.secret);
      let pending=Promise.resolve();
      events.onmessage=event=>{pending=pending.then(()=>handle(JSON.parse(event.data))).catch(error=>{status.textContent='连接未完成 · '+error.message;});};
    } finally {create.disabled=join.disabled=false;}
  }
  window.addEventListener('keydown',e=>keyEvent(e,true),true);
  window.addEventListener('keyup',e=>keyEvent(e,false),true);
  window.addEventListener('blur',releaseGuest);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseGuest();});
  window.addEventListener('pagehide',closeRoom);
  try {
    info=await request('info');
    if(initialCode)await openRoom(initialCode);
  } catch(error) {
    if(!initialCode) {create.hidden=join.hidden=code.hidden=true;status.textContent='局域网双人请通过随包的局域网启动器进入。';}
    else status.textContent=error.message;
  }
  return {close:closeRoom,get room(){return room;},get peers(){return peers;}};
}
