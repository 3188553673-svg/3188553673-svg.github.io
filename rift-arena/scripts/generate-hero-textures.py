"""Generate original painted material/normal maps. No source game assets.
Uses only Python's standard library; images are deterministic and reproducible.
"""
from pathlib import Path
import math, random, struct, zlib
ROOT=Path(__file__).resolve().parents[1]/'assets/original-heroes'
ROOT.mkdir(parents=True,exist_ok=True)
N=256

def png(path, pixels):
 def chunk(kind, data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
 rows=b''.join(b'\0'+bytes(pixels[y*N*3:(y+1)*N*3]) for y in range(N))
 data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',N,N,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')
 path.write_bytes(data)

def line(p,x0,y0,x1,y1,value,width=1,alpha=.4):
 steps=max(abs(int(x1-x0)),abs(int(y1-y0)),1)
 for k in range(steps+1):
  x=int(x0+(x1-x0)*k/steps);y=int(y0+(y1-y0)*k/steps)
  for dx in range(-width,width+1):
   for dy in range(-width,width+1):
    xx=(x+dx)%N;yy=(y+dy)%N;i=(yy*N+xx)*3
    if dx*dx+dy*dy>width*width:continue
    for c in range(3):p[i+c]=round(p[i+c]*(1-alpha)+value*alpha)

for kind,seed in [('metal',117),('cloth',219),('skin',327),('hair',431),('leather',547)]:
 rng=random.Random(seed);pixels=bytearray(N*N*3);heights=[0.]*(N*N)
 for y in range(N):
  v=y/N
  for x in range(N):
   u=x/N;noise=rng.uniform(-1,1)
   broad=math.sin(u*math.tau*3+.3*math.sin(v*math.tau))*math.sin(v*math.tau+.7)
   if kind=='metal':
    brush=math.sin(v*math.tau*73+u*2)*2+math.sin((u+v*.15)*math.tau*17)*2
    value=202+20*math.cos(u*math.tau)+10*broad+brush+noise*4
    height=noise*.3+.12*math.sin(v*math.tau*73+u*2)
   elif kind=='cloth':
    folds=math.sin(u*math.tau*5+math.sin(v*math.tau)*.3)*34+math.sin(u*math.tau*11)*6
    weave=(1 if (x%4)<2 else -1)*(1 if (y%4)<2 else -1)*2
    value=205+folds+broad*15+noise*3+weave
    height=weave*.12+noise*.08
   elif kind=='skin':
    value=236+math.cos(u*math.tau)*4+broad*2+noise*1.5
    height=noise*.025
   elif kind=='hair':
    strand=math.sin((u+math.sin(v*math.tau)*.025)*math.tau*45)
    value=178+strand*22+broad*8+noise*5
    height=strand*.4+noise*.1
   else:
    value=196+broad*13+noise*8+math.sin(u*math.tau*25+v*math.tau)*3
    height=noise*.2+broad*.15
   value=max(0,min(255,round(value)));i=(y*N+x)*3;pixels[i:i+3]=bytes([value,value,value]);heights[y*N+x]=height
 if kind=='metal':
  for _ in range(280):
   x=rng.randrange(N);y=rng.randrange(N);line(pixels,x,y,x+rng.randint(3,30),y+rng.randint(-2,2),rng.choice([130,240]),0,.14)
 elif kind=='cloth':
  # Broad brush glazes and fine woven threads, deliberately no repeated emblem.
  for _ in range(110):
   x=rng.randrange(N);y=rng.randrange(N);line(pixels,x,y,x+rng.randint(-5,5),y+rng.randint(15,90),rng.choice([185,245]),1,.08)
 elif kind=='leather':
  for _ in range(100):
   x=rng.randrange(N);y=rng.randrange(N);line(pixels,x,y,x+rng.randint(4,22),y+rng.randint(1,10),125,0,.16)
 png(ROOT/(kind+'-paint.png'),pixels)
 normal=bytearray(N*N*3)
 for y in range(N):
  for x in range(N):
   dx=(heights[y*N+(x+1)%N]-heights[y*N+(x-1)%N])*.18
   dy=(heights[((y+1)%N)*N+x]-heights[((y-1)%N)*N+x])*.18
   length=math.sqrt(dx*dx+dy*dy+1);i=(y*N+x)*3
   normal[i:i+3]=bytes(max(0,min(255,round(channel/4)*4)) for channel in [127.5-dx/length*127.5,127.5+dy/length*127.5,127.5+1/length*127.5])
 png(ROOT/(kind+'-normal.png'),normal)
 print(kind)
