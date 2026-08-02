#!/usr/bin/env python3
"""
Turn the Gemini isometric tile renders into two sets of cutouts:

  art/cutouts/full/  background removed, hex base kept   -> billboard tiles
  art/cutouts/prop/  background removed, hex base cut    -> input for image-to-3D

Background removal is a border flood-fill over near-white pixels, so light
areas *inside* the artwork (the pale rock under the mother tree, snow, clouds)
survive -- a naive white-key would eat them.
"""
import os, sys, json, glob
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = 'art/source'
OUT = 'art/cutouts'
WHITE_TOL = 22          # max per-channel distance from pure white to count as background
FEATHER   = 1.0         # gaussian blur radius on the alpha edge

def remove_background(im):
    """Alpha = 0 for the white region connected to the image border."""
    rgb = np.asarray(im.convert('RGB')).astype(np.int16)
    near_white = (255 - rgb).max(axis=2) <= WHITE_TOL
    lbl, n = ndimage.label(near_white)
    if n == 0:
        return im.convert('RGBA'), np.ones(rgb.shape[:2], bool)
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border.discard(0)
    bg = np.isin(lbl, list(border))
    fg = ~bg
    # drop specks
    lbl2, n2 = ndimage.label(fg)
    if n2 > 1:
        sizes = ndimage.sum(fg, lbl2, range(1, n2 + 1))
        keep = (np.arange(1, n2 + 1))[sizes > 0.001 * fg.size]
        fg = np.isin(lbl2, keep)
    out = im.convert('RGBA')
    a = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(FEATHER))
    out.putalpha(a)
    return out, fg

def find_base_cut(fg):
    """
    Row index where the hex base starts. The silhouette of these renders is
    wide (canopy) -> narrow (trunk/neck) -> wide (hex base). Starting at the
    base's widest row, walk UPWARD while the silhouette keeps narrowing; the
    row where it starts widening again is the neck, and that is the cut.
    (Taking a global argmin instead finds the apex of the canopy -- the
    narrowest row overall is always the topmost one.)
    Returns None when there is no clear neck, e.g. a mountain that stays wide
    all the way down; caller then leaves that image uncut.
    """
    w = fg.sum(axis=1).astype(float)
    w = ndimage.uniform_filter1d(w, size=9)     # smooth out silhouette noise
    rows = np.flatnonzero(fg.sum(axis=1) > 0)
    if len(rows) < 20:
        return None
    top, bot = int(rows[0]), int(rows[-1])
    lower = slice(top + (bot - top) // 2, bot + 1)       # base lives in the bottom half
    base_max = int(np.argmax(w[lower])) + lower.start

    i = base_max
    while i - 1 > top and w[i - 1] <= w[i]:
        i -= 1
    neck = i

    # The base always sits at the bottom of the frame. Requiring the neck below
    # the subject's vertical midpoint rejects false necks found higher up -- e.g.
    # the gap between a castle's towers and its body.
    if neck <= top + 0.50 * (bot - top) or neck >= base_max:
        return None
    if w[neck] > 0.65 * w[base_max]:            # neck must be markedly narrower than the base
        return None
    return neck


def tight_crop(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im

report = []
for path in sorted(glob.glob(f'{SRC}/*/*.png')):
    rel  = os.path.relpath(path, SRC)
    name = os.path.basename(path)
    im   = Image.open(path)
    cut, fg = remove_background(im)

    full = tight_crop(cut)
    full.save(f'{OUT}/full/{name}')

    neck = find_base_cut(fg)
    prop = None
    if neck is not None:
        upper = cut.crop((0, 0, cut.width, neck))
        if upper.getbbox():                     # guard: neck may leave nothing above it
            prop = tight_crop(upper)
            prop.save(f'{OUT}/prop/{name}')
        else:
            neck = None
    status = f'cut@{neck}' if neck is not None else 'NO CUT (no clear neck)'
    pct = 100 * fg.mean()
    report.append({'file': rel, 'subject_pct': round(pct, 1), 'base_cut_row': neck,
                   'full_size': full.size, 'prop_size': prop.size if prop else None})
    print(f'{name[:34]:36s} subject={pct:4.1f}%  {status}')

json.dump(report, open(f'{OUT}/report.json', 'w'), indent=1)
print(f'\n{len(report)} images -> {OUT}/full  and  {OUT}/prop')
