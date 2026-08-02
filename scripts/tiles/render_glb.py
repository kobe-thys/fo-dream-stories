#!/usr/bin/env python3
"""
Minimal software renderer for GLB files.

There is no GPU on this machine, so tile previews are rasterised on the CPU:
z-buffered textured triangles with a single directional light plus ambient.
Only what tile previews need -- no PBR, no shadows, no skinning.
"""
import json, struct, math, io, os, sys
import numpy as np
from PIL import Image

CT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: '<u1', 5122: '<i2', 5120: '<i1'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    d = open(path, 'rb').read()
    _, _, length = struct.unpack('<III', d[:12])
    off, js, bn = 12, None, None
    while off < length:
        clen, ctype = struct.unpack('<II', d[off:off + 8])
        ch = d[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A: js = json.loads(ch.decode())
        elif ctype == 0x004E4942: bn = ch
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return js, bn


def accessor(j, b, idx):
    a = j['accessors'][idx]
    n = NC[a['type']]
    dt = np.dtype(CT[a['componentType']])
    if 'bufferView' not in a:
        return np.zeros((a['count'], n))
    bv = j['bufferViews'][a['bufferView']]
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or n * dt.itemsize
    if stride == n * dt.itemsize:
        arr = np.frombuffer(b, dtype=dt, count=a['count'] * n, offset=base).reshape(a['count'], n)
    else:
        arr = np.stack([np.frombuffer(b, dtype=dt, count=n, offset=base + i * stride)
                        for i in range(a['count'])])
    arr = arr.astype(np.float64)
    if a.get('normalized') and dt.kind == 'u':
        arr /= np.iinfo(dt).max
    return arr


def trs(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    T = np.eye(4); R = np.eye(4); S = np.eye(4)
    if 't' in node or 'translation' in node:
        T[:3, 3] = node.get('translation', [0, 0, 0])
    if 'rotation' in node:
        x, y, z, w = node['rotation']
        R[:3, :3] = [[1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w)],
                     [2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y)]]
    if 'scale' in node:
        S[0, 0], S[1, 1], S[2, 2] = node['scale']
    return T @ R @ S


def load_texture(j, b, tex_index, glb_dir=''):
    """Textures are either embedded in the BIN chunk or referenced by relative
    URI. The Kenney kit uses the latter -- every tile points at a sibling
    Textures/colormap.png -- so URI resolution is not optional here."""
    try:
        t = j['textures'][tex_index]
        # WebP/KTX2 textures put the image index under an extension rather than
        # 'source' -- gltf-transform emits EXT_texture_webp by default.
        src_idx = t.get('source')
        if src_idx is None:
            for ext in (t.get('extensions') or {}).values():
                if isinstance(ext, dict) and 'source' in ext:
                    src_idx = ext['source']; break
        if src_idx is None:
            return None
        img = j['images'][src_idx]
        if 'bufferView' in img:
            bv = j['bufferViews'][img['bufferView']]
            data = b[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
            src = io.BytesIO(data)
        elif 'uri' in img:
            uri = img['uri']
            if uri.startswith('data:'):
                import base64
                src = io.BytesIO(base64.b64decode(uri.split(',', 1)[1]))
            else:
                from urllib.parse import unquote
                src = os.path.join(glb_dir, unquote(uri))
        else:
            return None
        return np.asarray(Image.open(src).convert('RGBA')).astype(np.float64) / 255.0
    except Exception as e:
        print(f'  ! texture {tex_index} failed: {e}', file=sys.stderr)
        return None


def gather(path):
    """Flatten the glTF scene graph into world-space triangles."""
    j, b = read_glb(path)
    glb_dir = os.path.dirname(os.path.abspath(path))
    tris = []
    textures = {}

    def walk(ni, parent):
        node = j['nodes'][ni]
        M = parent @ trs(node)
        if 'mesh' in node:
            for prim in j['meshes'][node['mesh']]['primitives']:
                if prim.get('mode', 4) != 4:
                    continue
                P = accessor(j, b, prim['attributes']['POSITION'])
                P = (M @ np.c_[P, np.ones(len(P))].T).T[:, :3]
                uv = accessor(j, b, prim['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in prim['attributes'] else np.zeros((len(P), 2))
                idx = accessor(j, b, prim['indices'])[:, 0].astype(int) if 'indices' in prim else np.arange(len(P))
                mat = j.get('materials', [{}])[prim['material']] if 'material' in prim else {}
                pbr = mat.get('pbrMetallicRoughness', {})
                base = pbr.get('baseColorFactor', [1, 1, 1, 1])
                ti = pbr.get('baseColorTexture', {}).get('index')
                if ti is not None and ti not in textures:
                    textures[ti] = load_texture(j, b, ti, glb_dir)
                alpha_mode = mat.get('alphaMode', 'OPAQUE')
                cutoff = mat.get('alphaCutoff', 0.5)
                for k in range(0, len(idx) - 2, 3):
                    a, c, d = idx[k], idx[k+1], idx[k+2]
                    tris.append((P[[a, c, d]], uv[[a, c, d]], base, ti, alpha_mode, cutoff))
        for ch in node.get('children', []):
            walk(ch, M)

    scene = j['scenes'][j.get('scene', 0)]
    for ni in scene.get('nodes', []):
        walk(ni, np.eye(4))
    return tris, textures


def render(paths, out, size=(760, 620), eye=(2.6, 2.2, 3.4), target=(0, 0.45, 0),
           bg=(0.94, 0.95, 0.97), fov=32.0, offsets=None, yaws=None):
    W, H = size
    img = np.ones((H, W, 3)) * np.array(bg)
    zbuf = np.full((H, W), np.inf)

    eye = np.array(eye, float); target = np.array(target, float)
    fwd = target - eye; fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    V = np.eye(4); V[:3, :3] = np.stack([right, up, -fwd]); V[:3, 3] = -V[:3, :3] @ eye
    f = 1.0 / math.tan(math.radians(fov) / 2)
    near, far = 0.05, 100.0
    Pm = np.array([[f * H / W, 0, 0, 0], [0, f, 0, 0],
                   [0, 0, (far + near) / (near - far), 2 * far * near / (near - far)],
                   [0, 0, -1, 0]])
    light = np.array([0.45, 0.8, 0.4]); light /= np.linalg.norm(light)

    for pi, path in enumerate(paths):
        tris, textures = gather(path)
        shift = np.array(offsets[pi] if offsets else [0, 0, 0], float)
        yaw = float(yaws[pi]) if yaws else 0.0          # billboards yaw to face the camera
        cy, sy_ = math.cos(yaw), math.sin(yaw)
        Ry = np.array([[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]])
        for P, uv, base, ti, amode, cutoff in tris:
            P = (P @ Ry.T) + shift
            n = np.cross(P[1] - P[0], P[2] - P[0])
            ln = np.linalg.norm(n)
            if ln < 1e-12:
                continue
            n /= ln
            lam = 0.35 + 0.75 * max(0.0, abs(float(n @ light)))

            clip = (Pm @ V @ np.c_[P, np.ones(3)].T).T
            if np.any(clip[:, 3] <= 1e-6):
                continue
            ndc = clip[:, :3] / clip[:, 3:4]
            sx = (ndc[:, 0] * 0.5 + 0.5) * W
            sy = (1 - (ndc[:, 1] * 0.5 + 0.5)) * H
            zs = clip[:, 3]

            x0, x1 = max(0, int(np.floor(sx.min()))), min(W - 1, int(np.ceil(sx.max())))
            y0, y1 = max(0, int(np.floor(sy.min()))), min(H - 1, int(np.ceil(sy.max())))
            if x1 < x0 or y1 < y0:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = ((sy[1]-sy[2])*(sx[0]-sx[2]) + (sx[2]-sx[1])*(sy[0]-sy[2]))
            if abs(d) < 1e-12:
                continue
            w0 = ((sy[1]-sy[2])*(X-sx[2]) + (sx[2]-sx[1])*(Y-sy[2])) / d
            w1 = ((sy[2]-sy[0])*(X-sx[2]) + (sx[0]-sx[2])*(Y-sy[2])) / d
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            iw = w0/zs[0] + w1/zs[1] + w2/zs[2]
            z = np.where(iw != 0, 1.0/np.where(iw == 0, 1, iw), np.inf)
            sub = zbuf[y0:y1+1, x0:x1+1]
            hit = inside & (z < sub)
            if not hit.any():
                continue

            col = np.tile(np.array(base[:3]) * lam, (*hit.shape, 1))
            tex = textures.get(ti) if ti is not None else None
            if tex is not None:
                pu = (w0/zs[0]*uv[0,0] + w1/zs[1]*uv[1,0] + w2/zs[2]*uv[2,0]) * z
                pv = (w0/zs[0]*uv[0,1] + w1/zs[1]*uv[1,1] + w2/zs[2]*uv[2,1]) * z
                th, tw = tex.shape[:2]
                tx = np.clip((pu % 1.0) * (tw-1), 0, tw-1).astype(int)
                ty = np.clip((pv % 1.0) * (th-1), 0, th-1).astype(int)
                texel = tex[ty, tx]
                col = texel[..., :3] * np.array(base[:3]) * lam
                if amode in ('MASK', 'BLEND'):
                    hit &= texel[..., 3] > (cutoff if amode == 'MASK' else 0.5)
                    if not hit.any():
                        continue
            sub_img = img[y0:y1+1, x0:x1+1]
            sub_img[hit] = np.clip(col[hit], 0, 1)
            sub[hit] = z[hit]

    Image.fromarray((img * 255).astype(np.uint8)).save(out)
    return out


if __name__ == '__main__':
    render([sys.argv[1]], sys.argv[2] if len(sys.argv) > 2 else 'out.png')
