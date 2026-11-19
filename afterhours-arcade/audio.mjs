let context,bus,enabled=true,last=0;
try{enabled=localStorage.getItem('afterhours-audio')!=='off';}catch{}
export const audible=()=>enabled;
export function wake(){if(!enabled)return;try{if(!context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;context=new AC();bus=context.createGain();bus.gain.value=.12;bus.connect(context.destination);}if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
export function toggle(){enabled=!enabled;try{localStorage.setItem('afterhours-audio',enabled?'on':'off');}catch{}if(bus)bus.gain.value=enabled?.12:0;if(enabled)wake();return enabled;}
function chirp(freq,end,duration,type,vol=.4,delay=0){if(!enabled||!context||context.state!=='running')return;const osc=context.createOscillator(),amp=context.createGain(),t=context.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);amp.gain.setValueAtTime(.002,t);amp.gain.exponentialRampToValueAtTime(vol,t+.006);amp.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(amp);amp.connect(bus);osc.start(t);osc.stop(t+duration+.01);}
export function coin(){wake();chirp(540,770,.07,'square',.3);chirp(800,1050,.12,'triangle',.6,.07);}
function hiss(seconds,frequency,volume,delay=0){
 if(!enabled||!context||context.state!=='running')return;
 const length=Math.ceil(context.sampleRate*seconds),buffer=context.createBuffer(1,length,context.sampleRate),samples=buffer.getChannelData(0);
 for(let i=0;i<length;i++)samples[i]=(Math.random()*2-1)*(1-i/length)**2;
 const src=context.createBufferSource(),filter=context.createBiquadFilter(),amp=context.createGain();
 src.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;amp.gain.value=volume;
 src.connect(filter);filter.connect(amp);amp.connect(bus);src.start(context.currentTime+delay);
}
export function events(list=[]){
 if(!enabled||!list.length)return;
 const now=performance.now();
 for(const e of list.slice(-5)){
  switch(e.kind){
   case 'snap': hiss(.06,3200,1.3);chirp(165,38,.17,'triangle',.8);break;
   case 'gong': chirp(321,298,.48,'sine',.9);chirp(652,462,.42,'triangle',.6);break;
   case 'shoe': case 'dash': chirp(870,330,.105,'triangle',.45);break;
   case 'rebound': hiss(.18,2300,.8);chirp(600,960,.12,'sine',.45);break;
   case 'skill':
    if(e.hero==='kobe'){chirp(710,420,.08,'triangle',.48);hiss(.1,3200,.37,.04);}
    else if(e.hero==='iron')chirp(690,44,.23,'sawtooth',.45);
    else{chirp(125,36,.26,'triangle',1);hiss(.14,900,.6);}
    break;
   case 'attack':
    if(now-last<85)break;last=now;
    if(e.weapon==='basket'){chirp(172,56,.10,'sine',.8);hiss(.038,1050,.22);}
    else if(e.weapon==='bell'){chirp(620,595,.25,'sine',.7);chirp(910,890,.20,'sine',.25);}
    else chirp(e.weapon==='tray'?680:290,90,.07,'square',.25);
    break;
   case 'bossDown': case 'win': case 'clear': case 'equip': case 'revive':
    chirp(420,810,.16,'triangle',.8);chirp(760,1190,.19,'triangle',.45,.09);break;
   case 'hit': case 'hurt': case 'down': case 'ko':
    if(now-last<30)break;last=now;chirp(132,33,.085,'triangle',.9);break;
  }
 }
}
