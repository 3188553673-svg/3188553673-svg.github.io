function box(c,x,y,w,h,color) {
  c.fillStyle=color;
  c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function line(c,x,y,x2,y2,color,width=1) {
  c.strokeStyle=color; c.lineWidth=width;
  c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
}
function ellipse(c,x,y,rx,ry,color,thickness=0) {
  if(rx<=0||ry<=0)return;
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  if(thickness){c.strokeStyle=color;c.lineWidth=thickness;c.stroke();}
  else {c.fillStyle=color;c.fill();}
}
function poly(c,coords,color,outline) {
  c.beginPath(); c.moveTo(coords[0],coords[1]);
  for(let i=2;i<coords.length;i+=2)c.lineTo(coords[i],coords[i+1]);
  c.closePath();c.fillStyle=color;c.fill();
  if(outline){c.strokeStyle=outline;c.lineWidth=1;c.stroke();}
}
function type(c,str,x,y,color,size=7,align='left') {
  c.save();c.font='bold '+size+'px ui-monospace, Menlo, "PingFang SC", "Microsoft YaHei", monospace';
  c.textAlign=align;c.fillStyle=color;c.fillText(str,x,y);c.restore();
}
function rng(seed) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function plus(c,x,y,r,color) {
  box(c,x-1,y-r,2,r*2,color);box(c,x-r,y-1,r*2,2,color);
}
export { box, line, ellipse, poly, type, rng, plus };
