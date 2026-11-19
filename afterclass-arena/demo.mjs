import { drawFighter } from './fighters.mjs';

// Draw the selected fighters on the rooftop at the same pixel scale as the match.
export function lobbyDemo(canvas, getPair, visible) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let last = -100;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible() || document.hidden || now - last < 65) return;
    last = now;
    const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
    ctx.clearRect(0,0,w,h); ctx.imageSmoothingEnabled=false;
    const one = w < 510, tick = reduced.matches ? 0 : Math.floor(now * .040);
    const floor = Math.round(h*.83), start = Math.round(w*(one?.69:.54)), end = w+5;
    const left = start-26;
    ctx.fillStyle='#2f263a';
    ctx.beginPath(); ctx.moveTo(start,floor); ctx.lineTo(end,floor); ctx.lineTo(end,h+2);
    ctx.lineTo(left+48,h+2); ctx.lineTo(left+26,floor+13); ctx.fill();
    ctx.fillStyle='#ffd590';ctx.fillRect(start,floor,end-start,3);
    ctx.fillStyle='#a97169';ctx.fillRect(start+3,floor+3,end-start-3,4);
    ctx.fillStyle='#6c4b56';ctx.fillRect(start+9,floor+9,end-start,3);
    for(let x=start+20;x<w;x+=41){
      ctx.fillStyle='#564051'; ctx.fillRect(x,floor+16,27,4);
      ctx.fillStyle='#87616b';ctx.fillRect(x+1,floor+16,11,1);
    }
    const chars=getPair();
    const scale = one ? Math.min(h/85,1.5) : Math.min(h/95,2.85);
    const distance = Math.min(w*.19,220), mid = w*.765;
    function fighter(char,x,face,phase) {
      ctx.save();ctx.translate(Math.round(x),floor);ctx.scale(scale,scale);
      ctx.fillStyle='#201b29a0';ctx.fillRect(-18,-1,37,3);
      const action = !reduced.matches && phase>=95 && phase<116 ? 'attack' : 'idle';
      drawFighter(ctx,{x:0,y:0,char,facing:face,action,actionTick:action==='attack'?phase-95:tick},tick);
      ctx.restore();
    }
    if(one) fighter(chars[0],w*.836,-1,tick%210);
    else { fighter(chars[0],mid-distance/2,1,tick%220);fighter(chars[1],mid+distance/2,-1,(tick+100)%220); }
  }
  requestAnimationFrame(frame);
}
