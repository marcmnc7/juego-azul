"""Aligera un .vrm exportado de VRoid (VRM 1.0) para el juego, sin tocar su aspecto.

  python3 scripts/vrm_slim.py entrada.vrm salida.vrm

- Quita los blendshapes de la cara que no usa ninguna expresión (VRoid exporta ~57 y las expresiones usan ~14):
  es casi todo el peso del archivo.
- Quita la miniatura (2048×2048) que solo se ve en VRoid Hub.
- Rehace el buffer binario con solo lo que se usa.

Sin dependencias (solo la biblioteca estándar de Python).
"""
import json
import struct
import sys


def read_glb(path):
    b = open(path, 'rb').read()
    magic, version, _ = struct.unpack('<III', b[:12])
    assert magic == 0x46546C67 and version == 2, 'no es un GLB 2.0'
    off, j, bin_ = 12, None, b''
    while off < len(b):
        n, kind = struct.unpack('<II', b[off:off + 8])
        chunk = b[off + 8:off + 8 + n]
        if kind == 0x4E4F534A:
            j = json.loads(chunk)
        elif kind == 0x004E4942:
            bin_ = chunk
        off += 8 + n
    return j, bin_


def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    bin_ += b'\0' * (-len(bin_) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942) + bin_)


def slim(j):
    vrm = j['extensions']['VRMC_vrm']
    exprs = vrm.get('expressions', {})
    all_expr = list(exprs.get('preset', {}).values()) + list(exprs.get('custom', {}).values())

    # 1) Blendshapes usados por alguna expresión, por malla
    used = {}
    for e in all_expr:
        for bnd in e.get('morphTargetBinds', []):
            used.setdefault(j['nodes'][bnd['node']]['mesh'], set()).add(bnd['index'])
    remap = {}
    for mi, mesh in enumerate(j['meshes']):
        n = len(mesh['primitives'][0].get('targets', []))
        if not n:
            continue
        keep = sorted(used.get(mi, set()))
        remap[mi] = {old: new for new, old in enumerate(keep)}
        for p in mesh['primitives']:
            if keep:
                p['targets'] = [p['targets'][i] for i in keep]
            else:
                p.pop('targets', None)
        if 'weights' in mesh:
            mesh['weights'] = [mesh['weights'][i] for i in keep] if keep else None
            if mesh['weights'] is None:
                del mesh['weights']
        names = mesh.get('extras', {}).get('targetNames')
        if names:
            mesh['extras']['targetNames'] = [names[i] for i in keep]
        for p in mesh['primitives']:
            pn = p.get('extras', {}).get('targetNames')
            if pn:
                p['extras']['targetNames'] = [pn[i] for i in keep]
    for e in all_expr:
        for bnd in e.get('morphTargetBinds', []):
            bnd['index'] = remap[j['nodes'][bnd['node']]['mesh']][bnd['index']]

    # 2) Sin miniatura
    vrm['meta'].pop('thumbnailImage', None)

    # 3) Solo los accessors, imágenes y bufferViews que se usan
    acc_used = set()
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            acc_used.update(p['attributes'].values())
            if 'indices' in p:
                acc_used.add(p['indices'])
            for t in p.get('targets', []):
                acc_used.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            acc_used.add(s['inverseBindMatrices'])
    for a in j.get('animations', []):
        for smp in a['samplers']:
            acc_used.update([smp['input'], smp['output']])
    img_used = {t['source'] for t in j.get('textures', []) if 'source' in t}

    acc_map = {old: new for new, old in enumerate(sorted(acc_used))}
    img_map = {old: new for new, old in enumerate(sorted(img_used))}
    j['accessors'] = [j['accessors'][i] for i in sorted(acc_used)]
    j['images'] = [j['images'][i] for i in sorted(img_used)]
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = acc_map[p['indices']]
            if 'targets' in p:
                p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
    for a in j.get('animations', []):
        for smp in a['samplers']:
            smp['input'], smp['output'] = acc_map[smp['input']], acc_map[smp['output']]
    for t in j.get('textures', []):
        if 'source' in t:
            t['source'] = img_map[t['source']]

    bv_used = set()
    for a in j['accessors']:
        if 'bufferView' in a:
            bv_used.add(a['bufferView'])
        sp = a.get('sparse')
        if sp:
            bv_used.update([sp['indices']['bufferView'], sp['values']['bufferView']])
    for im in j['images']:
        if 'bufferView' in im:
            bv_used.add(im['bufferView'])
    return bv_used


def main(src, dst):
    j, bin_ = read_glb(src)
    bv_used = slim(j)
    new_bin = bytearray()
    bv_map, views = {}, []
    for old in sorted(bv_used):
        v = dict(j['bufferViews'][old])
        new_bin += b'\0' * (-len(new_bin) % 4)
        start = v.get('byteOffset', 0)
        data = bin_[start:start + v['byteLength']]
        v['byteOffset'] = len(new_bin)
        v['buffer'] = 0
        new_bin += data
        bv_map[old] = len(views)
        views.append(v)
    j['bufferViews'] = views
    for a in j['accessors']:
        if 'bufferView' in a:
            a['bufferView'] = bv_map[a['bufferView']]
        sp = a.get('sparse')
        if sp:
            sp['indices']['bufferView'] = bv_map[sp['indices']['bufferView']]
            sp['values']['bufferView'] = bv_map[sp['values']['bufferView']]
    for im in j['images']:
        if 'bufferView' in im:
            im['bufferView'] = bv_map[im['bufferView']]
    new_bin += b'\0' * (-len(new_bin) % 4)
    j['buffers'] = [{'byteLength': len(new_bin)}]
    write_glb(dst, j, bytes(new_bin))
    a, b = len(open(src, 'rb').read()), len(open(dst, 'rb').read())
    print(f'{src} → {dst}: {a / 1e6:.1f} MB → {b / 1e6:.1f} MB')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
