# Publicación: HTML sin las fotos ni los modelos (van como archivos al lado; los binarios, dentro de PNG)
import base64, os, sys, subprocess
out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
src = open('/home/claude/juego-azul/dist/index.html', encoding='utf-8').read()
start = src.index('<script type="module"')
end = src.index('</style>', start) + len('</style>')
body = src[src.index('<body>'):src.index('</body>') + len('</body>')]
out = '<title>Para Margaux</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + src[start:end] + '\n\n' + body
A = '/home/claude/juego-azul/src/assets/'
files = []
n = 0
for sub in ['recuerdos', 'hd', 'pbr', 'chars', 'env']:
    d = A + sub
    for f in sorted(os.listdir(d)):
        raw = open(os.path.join(d, f), 'rb').read()
        b64 = base64.b64encode(raw).decode()
        mime = {'webp': 'image/webp', 'jpg': 'image/jpeg', 'png': 'image/png', 'glb': 'model/gltf-binary', 'hdr': 'application/octet-stream'}[f.rsplit('.', 1)[1]]
        key = f'data:{mime};base64,{b64}'
        c = out.count(key)
        if not c:
            print('no inline for', sub, f)
            continue
        if f.endswith(('.glb', '.hdr')):
            pub = 'bin/' + f + '.bin.png'
            os.makedirs(os.path.join(out_dir, 'bin'), exist_ok=True)
            subprocess.check_call(['python3', '/home/claude/packbin.py', os.path.join(d, f), os.path.join(out_dir, pub)])
        else:
            pub = sub + '/' + f
            if sub != 'recuerdos':
                os.makedirs(os.path.join(out_dir, sub), exist_ok=True)
                open(os.path.join(out_dir, pub), 'wb').write(raw)
        out = out.replace(key, pub)
        n += c
        if sub != 'recuerdos': files.append(pub)
open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(out)
open(os.path.join(out_dir, 'files.txt'), 'w').write('\n'.join(files))
print('replaced', n, 'size', len(out))
