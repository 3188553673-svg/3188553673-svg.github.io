// Short, locally synthesized arcade cues. One gain stage owns the global mute.
let audio,master,noiseBuffer,muted=false;
const playedAt=new Map();
const MIN_GAPS={hit:35,swing:50,land:95,jump:55,dodge:65,skill:55,blast:75,ko:100,counter:75};

export function wakeAudio(){
  try{
    if(!audio){
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!Audio)return;
      audio=new Audio();
      master=audio.createGain();master.gain.value=muted?0:0.52;
      const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=8;limiter.ratio.value=6;
      master.connect(limiter);limiter.connect(audio.destination);
      noiseBuffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.35),audio.sampleRate);
      const samples=noiseBuffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    }
    if(audio.state==='suspended'||audio.state==='interrupted')audio.resume().catch(()=>{});
  }catch{/* A browser may deny audio while the page is in the background. */}
}
export function setMuted(value){
  muted=!!value;
  if(master)master.gain.setTargetAtTime(muted?0:.52,audio.currentTime,.012);
}
function envelope(node,at,duration,peak){
  const g=audio.createGain();
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(peak,at+.004);
  g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  node.connect(g);g.connect(master);
  return g;
}
function tone(startFrequency,endFrequency,duration,peak,type='triangle',delay=0){
  const at=audio.currentTime+delay;
  const osc=audio.createOscillator();osc.type=type;osc.frequency.setValueAtTime(startFrequency,at);
  osc.frequency.exponentialRampToValueAtTime(endFrequency,at+duration);
  const g=envelope(osc,at,duration,peak);osc.start(at);osc.stop(at+duration+.006);
  osc.onended=()=>{osc.disconnect();g.disconnect();};
}
function noise(freq,duration,peak,mode='bandpass',quality=1){
  const at=audio.currentTime,src=audio.createBufferSource(),filter=audio.createBiquadFilter();
  src.buffer=noiseBuffer;filter.type=mode;filter.frequency.value=freq;filter.Q.value=quality;
  src.connect(filter);const g=envelope(filter,at,duration,peak);
  src.start(at);src.stop(at+duration+.004);src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect();};
}
// Individual moves share a character's timbre and carry their own rhythmic cue.
const signatures={
  doubao:{wave:'sine',spec:[783,1175],qcf:[420,630,1260],qcb:[1047,830,1175,1397]},
  jianguo:{wave:'triangle',spec:[140,66],qcf:[180,102,59],qcb:[159,91,43,49]},
  rocket:{wave:'square',spec:[1047,831],qcf:[462,938,187],qcb:[1390,620,1047,466]},
  iron:{wave:'sawtooth',spec:[185,930],qcf:[220,550,1040],qcb:[147,294,588,1176]},
  liangzi:{wave:'triangle',spec:[297,188],qcf:[128,245,115],qcb:[240,150,270,115]},
  xujingyu:{wave:'sine',spec:[254,761],qcf:[410,539,685],qcb:[523,176,880,523]},
  nailong:{wave:'sine',spec:[172,520],qcf:[316,178,440],qcb:[523,698,194,82]}
};
function skillVoice(char,move){
  const kit=signatures[char];if(!kit)return;
  const register=move==='qcb'||['downSkill','downAttack','downSuper','hoverDive'].includes(move)?'qcb':
    move==='qcf'||['upSkill','upAttack','upSuper','airSuper'].includes(move)?'qcf':'spec';
  const notes=kit[register];
  const step=char==='xujingyu'?.075:char==='rocket'?.043:.055;
  notes.forEach((note,i)=>{
    const tail=i===notes.length-1,decay=tail?.15:.067,peak=kit.wave==='sawtooth'||kit.wave==='square'?.085:.19;
    tone(note,tail?note*.69:note*1.05,decay,peak,kit.wave,i*step);
  });
  if(char==='jianguo'||char==='liangzi')noise(char==='jianguo'?470:720,.085,.20,'lowpass');
  if(char==='rocket'||char==='iron')noise(char==='rocket'?3350:2150,.057,.17,'bandpass',1.4);
}
export function soundEvent(kind,power=1,move){
  if(muted||!audio||audio.state!=='running')return;
  const now=performance.now(),last=playedAt.get(kind)??-10000;
  if(now-last<(MIN_GAPS[kind]||24))return;
  playedAt.set(kind,now);
  if(kind.startsWith("skill-")){skillVoice(kind.slice(6),move);return;}
  switch(kind){
    case 'bookmarkBlink':tone(970,350,.09,.09,'sine');tone(530,1220,.09,.10,'sine',.055);break;
    case 'bookmarkEcho':tone(880,1170,.08,.10,'sine');tone(1170,1380,.095,.10,'sine',.06);break;
    case 'minePrime':tone(670,980,.053,.055,'square');tone(920,1210,.05,.055,'square',.07);break;
    case 'thrusterLift':noise(1300,.13,.12,'bandpass');tone(155,382,.16,.065,'sawtooth');break;
    case 'thrusterDive':tone(570,100,.14,.09,'sawtooth');break;
    case 'verdict':tone(194,67,.12,.21,'triangle');noise(620,.08,.18,'lowpass');break;
    case 'packThrow':noise(420,.10,.16,'lowpass');tone(145,60,.13,.15,'sine');break;
    case 'reboundCatch':tone(280,127,.08,.12,'sine');tone(521,681,.07,.08,'triangle',.05);break;
    case 'bellySlam':tone(118,43,.21,.23,'sine');tone(94,219,.10,.10,'sine',.08);break;
    case 'dummyPalm':noise(540,.06,.12,'lowpass');tone(350,138,.07,.07,'triangle');break;
    case 'swing': noise(1650,.055,.055,'bandpass',.75);break;
    case 'hit':{
      const heavy=power>=12,finisher=power>=20;
      tone(heavy?122:185,heavy?40:67,heavy?.145:.082,heavy?.39:.25,'sine');
      noise(heavy?1400:2500,heavy?.095:.055,heavy?.54:.34,'lowpass',.65);
      tone(heavy?730:1050,230,.032,.065,'square');
      if(finisher){noise(720,.15,.34,'bandpass',.65);tone(77,35,.21,.26,'sine',.028);}
      break;
    }
    case 'counter':tone(166,52,.2,.33,'sine');tone(1010,540,.11,.12,'square');noise(2700,.085,.30);break;
    case 'blast':tone(133,32,.26,.42,'sine');noise(1100,.21,.50,'lowpass',.6);break;
    
    case 'block':noise(2900,.048,.22,'bandpass',1.6);tone(1318,700,.079,.10,'triangle');break;
    case 'guardbreak':noise(2000,.13,.29);tone(600,210,.11,.15,'square');break;
    case 'skill':tone(320,730,.082,.09);break;
    case 'jump':tone(power>1?370:240,power>1?790:510,.077,.075);break;
    case 'land':if(power>=8)noise(530,.048,.10,'lowpass',.7);break;
    case 'dodge':noise(2500,.08,.13,'bandpass',.8);break;
    case 'ko':tone(690,112,.28,.18,'sawtooth');tone(182,41,.32,.37,'sine');noise(790,.2,.25,'lowpass');break;
    case 'respawn':tone(440,660,.075,.11);tone(660,920,.115,.095,'triangle',.075);break;
    case 'count':tone(415,380,.09,.095,'square');break;
    case 'start':tone(523,559,.10,.12);tone(740,890,.18,.14,'triangle',.085);break;
    case 'win':for(const [i,n] of [440,554,659,880].entries())tone(n,n*1.02,i===3?.30:.14,.125,'triangle',i*.087);break;
    case 'select':case 'ui':tone(620,780,.06,.08);break;
  }
}
