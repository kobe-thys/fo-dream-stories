#!/usr/bin/env python3
"""
Render the whole dream map as one image, the way a child sees it.

    set -a && . /root/.secrets/tokens.env && set +a
    python3 scripts/tiles/render-map.py out.png [--angle=low|high|top] [--size=1600x1100]
    python3 scripts/tiles/render-map.py tile.png --around=-6,7 --radius=2

WHY THIS EXISTS
Every other render in this repo shows ONE tile on a white background. Nothing showed
the assembled world, so there was no way to judge whether a new tile actually belongs
beside its neighbours -- which is the question that matters once the tile factory
works. Reviewing tiles in isolation is how you end up with 178 individually fine tiles
that do not cohere.

`--around=q,r` renders one tile with its neighbours, which is the view to use when
deciding whether a NEW tile belongs where it is going. `--radius=1` is the tile and
its six touching hexes.

It reads tile placements straight from Supabase (position, model, rotation) and reuses
`render_glb.py`, which already accepts a list of models with per-model offsets and
yaws. No GPU needed; this is the same CPU rasteriser the previews use.

Positions come from `lib/hex.ts` -- pointy-top axial, x = √3·R·(q + r/2),
z = 1.5·R·r -- with R at the models' NATIVE 0.5774, because the renderer loads the
GLBs unscaled. The app multiplies by MODEL_SCALE 1.72 for the browser; applying that
here as well would space the tiles 1.72x too far apart and leave gaps between them.
"""
import os, sys, math, json, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_glb import render

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODELS = os.path.join(REPO, 'public', 'models')
SUPABASE = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://tdoqdiyalenignhitxgj.supabase.co')
KEY = os.environ.get('SUPABASE_SERVICE_ROLE')

KENNEY_R = 0.5774                      # native model circumradius; NOT scaled by 1.72
X_SPACING = math.sqrt(3) * KENNEY_R
Z_SPACING = 1.5 * KENNEY_R

args = [a for a in sys.argv[1:] if not a.startswith('--')]
flags = {a.split('=')[0][2:]: a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--') and '=' in a}
OUT = args[0] if args else 'map.png'
W, H = (int(x) for x in flags.get('size', '1600x1100').split('x'))
ANGLE = flags.get('angle', 'low')

if not KEY:
    sys.exit('SUPABASE_SERVICE_ROLE not set — source /root/.secrets/tokens.env')

req = urllib.request.Request(
    f'{SUPABASE}/rest/v1/tiles?select=position_q,position_r,model,rotation,type,name&limit=2000',
    headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
tiles = json.load(urllib.request.urlopen(req))
print(f'{len(tiles)} tiles from Supabase')

# --around=q,r --radius=N renders one tile WITH ITS NEIGHBOURS. Judging a tile alone
# on white says nothing about whether it belongs beside the things it touches, which
# is the question that actually decides whether the world hangs together.
around = None
if 'around' in flags:
    aq, ar = (int(v) for v in flags['around'].split(','))
    around = (aq, ar)
    radius = int(flags.get('radius', 2))

def hex_distance(q1, r1, q2, r2):
    return (abs(q1 - q2) + abs(r1 - r2) + abs(q1 + r1 - q2 - r2)) // 2

paths, offsets, yaws = [], [], []
missing = {}
for t in tiles:
    model = t.get('model')
    if not model:
        continue
    if around and hex_distance(t['position_q'], t['position_r'], *around) > radius:
        continue
    p = os.path.join(MODELS, model)
    if not os.path.exists(p):
        missing[model] = missing.get(model, 0) + 1
        continue
    q, r = t['position_q'], t['position_r']
    paths.append(p)
    offsets.append([X_SPACING * (q + r / 2), 0.0, Z_SPACING * r])
    # `rotation` counts 60-degree steps, matching the hex's own symmetry.
    yaws.append(math.radians(60 * (t.get('rotation') or 0)))

if missing:
    print('missing models (skipped):', ', '.join(f'{k} x{v}' for k, v in missing.items()))

xs = [o[0] for o in offsets]
zs = [o[2] for o in offsets]
cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
span = max(max(xs) - min(xs), max(zs) - min(zs)) or 1
print(f'placed {len(paths)} tiles, span {span:.1f} units, centre ({cx:.1f}, {cz:.1f})')

# Three framings. "low" is closest to the child's own camera; "top" is the one to use
# when judging layout and adjacency rather than looks.
CAMERAS = {
    'low':  (0.55, 0.75, 40.0),
    'high': (0.05, 1.25, 38.0),
    'top':  (0.02, 2.40, 30.0),
}
back, height, fov = CAMERAS.get(ANGLE, CAMERAS['low'])
dist = span * 0.95
eye = (cx, cz * 0 + dist * height, cz + dist * back)
target = (cx, 0.0, cz)

print(f'rendering {ANGLE} at {W}x{H} — this is a CPU rasteriser, expect minutes')
render(paths, OUT, size=(W, H), eye=eye, target=target, fov=fov,
       offsets=offsets, yaws=yaws)
print('wrote', OUT, f'{os.path.getsize(OUT)/1024:.0f} KB')
