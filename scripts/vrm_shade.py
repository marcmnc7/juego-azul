#!/usr/bin/env python3
"""Ajusta el color de sombra MToon de la ropa teñida en un VRM ya exportado.

VRoid deja la sombra por defecto (lila/rosa claro) aunque se cambie el color base de la prenda;
en el juego el lado en sombra sale de otro color. Aquí: sombra = color base x sombra por defecto,
solo en materiales *_CLOTH con color base teñido y sombra todavía clara.
Uso: python3 scripts/vrm_shade.py src/assets/vrm/<nombre>.vrm  (una sola vez, después de vrm_slim.py)
"""
import json, struct, sys


def fix(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    rest = b[20 + jl:]
    n = 0
    for m in j.get('materials', []):
        if 'CLOTH' not in m.get('name', ''):
            continue
        e = m.get('extensions', {}).get('VRMC_materials_mtoon')
        base = m.get('pbrMetallicRoughness', {}).get('baseColorFactor')
        if not e or not base:
            continue
        sh = e.get('shadeColorFactor', [1, 1, 1])
        if min(base[:3]) > 0.9:  # sin teñir: la textura ya lleva el color
            continue
        if sum(sh[:3]) / 3 < 0.45:  # ya tiene una sombra oscura puesta a mano
            continue
        e['shadeColorFactor'] = [round(base[i] * sh[i], 5) for i in range(3)]
        n += 1
    data = json.dumps(j, separators=(',', ':')).encode()
    data += b' ' * ((4 - len(data) % 4) % 4)
    total = 12 + 8 + len(data) + len(rest)
    out = b[:8] + struct.pack('<I', total) + struct.pack('<I', len(data)) + b'JSON' + data + rest
    open(path, 'wb').write(out)
    return n


for p in sys.argv[1:]:
    print(p.split('/')[-1], fix(p))
