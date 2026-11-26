"""Assemble the verified original 3.3 game library and the seven-character expansion."""
import base64,hashlib,json,os,subprocess,sys,tarfile,urllib.request
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent
out=root.parent/'assembled';out.mkdir(exist_ok=True)
manifest=json.loads((root/'game.json').read_text())
mp=root/'seven.zip'
def sha(data):return hashlib.sha256(data).hexdigest()
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'BVN-community-mod-builder/1.0'})
    with urllib.request.urlopen(req,timeout=55) as res:return res.read()
for candidate in manifest['sources']:
    try:
        data=fetch(candidate)
        if sha(data)==manifest['baseSha256']:break
    except OSError:pass
else:raise RuntimeError('Original resource library unavailable')
host=(root/manifest['host']).read_bytes();assert sha(host)==manifest['hostSha256']
assert sha(mp.read_bytes())==manifest['modSha256']
with ZipFile(mp) as z:
    sources=[data,host]+[z.read(name) for name in manifest['names'][2:]]
outmovie=b''.join(memoryview(sources[n])[a:a+b] for n,a,b in manifest['segments'])
assert sha(outmovie)==manifest['sha256'] and len(outmovie)==manifest['size']
(out/'game.swf').write_bytes(outmovie)
runtime=fetch('https://registry.npmjs.org/@ruffle-rs/ruffle/-/ruffle-0.8.0.tgz')
integrity=(root/'ruffle-integrity.txt').read_text().strip()
assert base64.b64encode(hashlib.sha512(runtime).digest()).decode()==integrity.split('-',1)[1]
player=out/'player';player.mkdir(exist_ok=True)
with tarfile.open(fileobj=BytesIO(runtime),mode='r:gz') as tf:
    for item in tf:
        name=item.name.removeprefix('package/')
        if '/' not in name and (name.endswith('.wasm') or name in ('ruffle.js','LICENSE_APACHE','LICENSE_MIT')):
            (player/name).write_bytes(tf.extractfile(item).read())
print('Verified original game library, character pack, linked game, and Ruffle runtime.')
# The download includes platform runtimes. On first launch it caches the above verified game files.
import shutil
with ZipFile(root/'shell.zip') as shell, ZipFile(root.parent/'afterclass-arena/v3.1/afterclass-arena-lan-v3.1.zip') as previous, ZipFile(out/'lan-kit.zip','w',ZIP_DEFLATED,compresslevel=6) as kit:
    for entry in shell.infolist():
        original=entry.filename
        # Recreate the entry to keep the input ZipFile name index intact.
        from zipfile import ZipInfo
        target=ZipInfo('BVN-LAN/'+original);target.compress_type=ZIP_DEFLATED;target.external_attr=entry.external_attr
        with shell.open(original) as reader:kit.writestr(target,reader.read())
    runtime=[entry for entry in previous.infolist() if any(entry.filename.endswith('/runtime/'+x) for x in ('node','node.exe','LICENSE-node.txt'))]
    assert len(runtime)==3
    for entry in runtime:
        target=ZipInfo('BVN-LAN/runtime/'+entry.filename.rsplit('/',1)[-1]);target.external_attr=entry.external_attr;target.compress_type=ZIP_DEFLATED
        kit.writestr(target,previous.read(entry))
with ZipFile(out/'lan-kit.zip') as result:assert result.testzip() is None
