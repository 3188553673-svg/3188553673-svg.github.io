import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { websocket } from '../server/websocket.js';

class SlowSocket extends EventEmitter {
  constructor(acceptWrites=false) { super();this.acceptWrites=acceptWrites;this.writes=[];this.ends=[];this.destroyed=false;this.writableLength=0; }
  write(data) { this.writes.push(Buffer.from(data));this.writableLength+=data.length;return this.acceptWrites; }
  end(data) { if(data)this.ends.push(Buffer.from(data));this.emit('close'); }
  destroy() { this.destroyed=true;this.emit('close'); }
  setNoDelay(value) { this.noDelay=value; }
  drain(acceptWrites=true) { this.writableLength=0;this.acceptWrites=acceptWrites;this.emit('drain'); }
}
function decoded(data) {
  const opcode=data[0]&15;let length=data[1]&127,offset=2;
  if(length===126){length=data.readUInt16BE(2);offset=4;}
  else if(length===127){length=Number(data.readBigUInt64BE(2));offset=10;}
  const payload=data.subarray(offset,offset+length);
  return {opcode,payload,message:opcode===1?JSON.parse(payload.toString()):null};
}
function masked(opcode,payload=Buffer.alloc(0),fin=true) {
  payload=Buffer.from(payload);const mask=Buffer.from([4,19,23,7]);let header;
  if(payload.length<126)header=Buffer.from([(fin?128:0)|opcode,128|payload.length]);
  else if(payload.length<=65535){header=Buffer.alloc(4);header[0]=(fin?128:0)|opcode;header[1]=254;header.writeUInt16BE(payload.length,2);}
  else {header=Buffer.alloc(10);header[0]=(fin?128:0)|opcode;header[1]=255;header.writeBigUInt64BE(BigInt(payload.length),2);}
  const body=Buffer.from(payload);for(let i=0;i<body.length;i++)body[i]^=mask[i%4];
  return Buffer.concat([header,mask,body]);
}
function setup(acceptWrites=false) {
  const socket=new SlowSocket(acceptWrites),messages=[];let closes=0;
  const connection=websocket(socket,text=>messages.push(text),()=>closes++);
  return {socket,connection,messages,get closes(){return closes;}};
}

test('slow readers retain one latest snapshot and drain controls before that snapshot',()=>{
  const {socket,connection}=setup();connection.send({type:'state',state:{tick:0}});
  for(let tick=1;tick<=2000;tick++)connection.send({type:'state',state:{tick}});
  connection.send({type:'pong',at:123});connection.send({type:'input_ack',seq:7,accepted:true});
  assert.equal(socket.writes.length,1,'false accepts the first frame and prevents further writes');
  socket.drain();
  assert.deepEqual(socket.writes.map(x=>decoded(x).message),[
    {type:'state',state:{tick:0}},{type:'pong',at:123},{type:'input_ack',seq:7,accepted:true},{type:'state',state:{tick:2000}},
  ]);
  assert.equal(socket.noDelay,true);
});

test('a false write during drain is never repeated on a subsequent drain',()=>{
  const {socket,connection}=setup();connection.send({type:'state',state:{tick:0}});
  connection.send({type:'input_ack',seq:1});connection.send({type:'pong',at:2});connection.send({type:'state',state:{tick:3}});
  socket.drain(false);assert.equal(socket.writes.length,2);assert.equal(decoded(socket.writes[1]).message.seq,1);
  connection.send({type:'state',state:{tick:4}});socket.drain();
  assert.deepEqual(socket.writes.map(x=>decoded(x).message.type),['state','input_ack','pong','state']);
  assert.equal(decoded(socket.writes.at(-1)).message.state.tick,4);
});

test('control queue overflow closes explicitly instead of silently dropping pong or acknowledgements',()=>{
  const p=setup();p.connection.send({type:'state',state:{tick:0}});
  for(let i=0;i<256;i++)p.connection.send({type:'input_ack',seq:i});
  assert.equal(p.socket.ends.length,0);p.connection.send({type:'pong',at:1});
  assert.equal(p.socket.ends.length,1);assert.equal(decoded(p.socket.ends[0]).payload.readUInt16BE(0),1013);assert.equal(p.closes,1);
  p.socket.drain();assert.equal(p.socket.writes.length,1,'closed transport cannot flush stale queues');
});

test('control byte budget is bounded independently of frame count',()=>{
  const p=setup();p.connection.send({type:'state',state:{tick:0}});
  p.connection.send({type:'error',message:'x'.repeat(70*1024)});assert.equal(p.socket.ends.length,0);
  p.connection.send({type:'error',message:'x'.repeat(70*1024)});
  assert.equal(decoded(p.socket.ends[0]).payload.readUInt16BE(0),1013);assert.equal(p.closes,1);
});

test('RFC ping/pong respects backpressure while fragmented text remains intact',()=>{
  const p=setup();p.connection.send({type:'state',state:{tick:0}});
  p.connection.feed(masked(1,'hel',false));p.connection.feed(masked(9,'probe'));p.connection.feed(masked(0,'lo'));
  assert.deepEqual(p.messages,['hello']);assert.equal(p.socket.writes.length,1);
  p.connection.send({type:'state',state:{tick:2}});p.socket.drain();
  assert.equal(decoded(p.socket.writes[1]).opcode,10);assert.equal(decoded(p.socket.writes[1]).payload.toString(),'probe');
  assert.equal(decoded(p.socket.writes[2]).message.state.tick,2);
});

test('an interleaved RFC ping does not count toward a fragmented text message limit',()=>{
  const p=setup(true);p.connection.feed(masked(1,'x'.repeat(65530),false));
  p.connection.feed(masked(9,'1234567890'));p.connection.feed(masked(0,'y'.repeat(6)));
  assert.equal(p.socket.ends.length,0);assert.equal(p.messages[0].length,65536);assert.equal(decoded(p.socket.writes[0]).opcode,10);
});

test('close and error discard pending state and controls and report cleanup exactly once',()=>{
  for(const event of ['close','error']) {
    const p=setup();p.connection.send({type:'state',state:{tick:0}});p.connection.send({type:'state',state:{tick:1}});p.connection.send({type:'pong',at:1});
    p.connection.feed(masked(1,'partial',false));p.socket.emit(event,new Error('reader ended'));
    p.socket.drain();p.socket.emit('close');p.connection.send({type:'input_ack',seq:1});
    assert.equal(p.socket.writes.length,1);assert.equal(p.closes,1);assert.equal(p.socket.listenerCount('drain'),0);
  }
});

test('leave invalidates a stale queued room state and masked close is echoed once',()=>{
  const p=setup();p.connection.send({type:'state',state:{tick:0}});p.connection.send({type:'state',state:{tick:1}});p.connection.send({type:'left'});p.socket.drain();
  assert.deepEqual(p.socket.writes.map(x=>decoded(x).message.type),['state','left']);
  const payload=Buffer.alloc(2);payload.writeUInt16BE(1000);p.connection.feed(masked(8,payload));p.socket.emit('close');
  assert.equal(p.socket.ends.length,1);assert.equal(decoded(p.socket.ends[0]).opcode,8);assert.equal(p.closes,1);
});

test('unmasked and invalid control frames retain RFC protocol rejection',()=>{
  for(const incoming of [Buffer.from([129,1,97]),masked(9,'fragment',false)]) {
    const p=setup(true);p.connection.feed(incoming);assert.equal(decoded(p.socket.ends[0]).payload.readUInt16BE(0),1002);assert.equal(p.closes,1);
  }
});
