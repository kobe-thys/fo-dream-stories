#!/usr/bin/env python3
"""
Recolour parts of a tile texture, selecting by GEOMETRY rather than by colour.

    python3 scripts/tiles/recolour-tile.py <tile.glb> <out.png> [--ground=#48c1a3] [--lighten-brown=0.38]

WHY GEOMETRY AND NOT COLOUR
A tile's texture is a UV atlas: the same colour is reused across unrelated parts.
On tinkle-trunk, #845442 is both the ground around the trunk AND the trunk itself,
so a plain colour swap turns the tree green. Instead we rasterise the UV triangles
of faces that are physically ground -- roughly horizontal, at the base-plate height
-- into a mask, and only repaint inside it. The trunk is then treated separately.

Kenney grass green is #48c1a3, measured off the top surface of grass.glb.
"""
import json, struct, sys, math, os, io
from collections import Counter
from PIL import Image, ImageDraw

# ── GLB / glTF plumbing ────────────────────────────────────────────────────
CT = {5126:'<f4',5123:'<u2',5125:'<u4',5121:'<u1',5122:'<i2',5120:'<i1'}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
SZ = {'<f4':4,'<u2':2,'<u4':4,'<u1':1,'<i2':2,'<i1':1}

def read_glb(path):
    d=open(path,'rb').read(); jl=struct.unpack('<I',d[12:16])[0]
    j=json.loads(d[20:20+jl]); off=20+jl; binc=b''
    while off<len(d):
        cl,ct=struct.unpack('<II',d[off:off+8])
        if ct==0x004E4942: binc=d[off+8:off+8+cl]
        off+=8+cl; off+=(-off)%4
    return j,binc

def acc(j,binc,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
    fmt=CT[a['componentType']]; n=NC[a['type']]; esz=SZ[fmt]*n
    stride=bv.get('byteStride') or esz
    base=bv.get('byteOffset',0)+a.get('byteOffset',0)
    ch={'<f4':'f','<u2':'H','<u4':'I','<u1':'B','<i2':'h','<i1':'b'}[fmt]
    return [struct.unpack_from('<'+ch*n,binc,base+k*stride) for k in range(a['count'])]

def mat_ident(): return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
def mat_mul(a,b):
    o=[0.0]*16
    for c in range(4):
        for r in range(4):
            o[c*4+r]=sum(a[k*4+r]*b[c*4+k] for k in range(4))
    return o
def trs(t,r,s):
    x,y,z,w=r; xx,yy,zz=x*x,y*y,z*z; xy,xz,yz=x*y,x*z,y*z; wx,wy,wz=w*x,w*y,w*z
    return [(1-2*(yy+zz))*s[0],(2*(xy+wz))*s[0],(2*(xz-wy))*s[0],0,
            (2*(xy-wz))*s[1],(1-2*(xx+zz))*s[1],(2*(yz+wx))*s[1],0,
            (2*(xz+wy))*s[2],(2*(yz-wx))*s[2],(1-2*(xx+yy))*s[2],0,t[0],t[1],t[2],1]
def nodemat(n):
    return list(n['matrix']) if 'matrix' in n else trs(
        n.get('translation',[0,0,0]),n.get('rotation',[0,0,0,1]),n.get('scale',[1,1,1]))
def xf(m,p):
    x,y,z=p
    return (m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14])

def load_image(j,binc,idx):
    im=j['images'][idx]; bv=j['bufferViews'][im['bufferView']]
    return Image.open(io.BytesIO(binc[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB')

# ── args ───────────────────────────────────────────────────────────────────
args=sys.argv[1:]
SRC=args[0]; DST=args[1]
def flag(n,d):
    h=[a for a in args if a.startswith(f'--{n}=')]
    return h[0].split('=',1)[1] if h else d
GROUND=flag('ground','#48c1a3')
LIGHTEN=float(flag('lighten-brown','0.38'))
GY_LO=float(flag('ground-lo','0.12')); GY_HI=float(flag('ground-hi','0.32'))
# Skirt: the tile's outer wall. Tiles built before --rebuild-base have no separate
# base mesh, so their sides live in the artwork texture and can only be reached by
# masking the geometry that forms the rim.
SKIRT=flag('skirt',None)
SKIRT_TOP=float(flag('skirt-top','0.21'))
NORMAL_MIN=float(flag('normal-min','0.6'))
# Trunk mask threshold, independent of the ground mask so widening one does not
# starve the other of texels.
TRUNK_LO=float(flag('trunk-lo','0.22'))
gr,gg,gb=(int(GROUND[1:3],16),int(GROUND[3:5],16),int(GROUND[5:7],16))

j,binc=read_glb(SRC)
img=load_image(j,binc,0).copy()
W,H=img.size
mask=Image.new('1',(W,H),0)
md=ImageDraw.Draw(mask)
# Second mask: everything standing ABOVE the ground plane — trunk and foliage.
# Needed because the darkest part of the trunk is a cool charcoal, not a brown,
# so a hue-based rule skips it; the shadow is baked into the generated texture.
above=Image.new('1',(W,H),0)
ad=ImageDraw.Draw(above)
skirt=Image.new('1',(W,H),0)
sd=ImageDraw.Draw(skirt)

R_HEX=0.5774; EDGE=R_HEX*math.cos(math.pi/6); KSEC=math.pi/3
def hexr(x,z):
    a=math.atan2(z,x); aa=((a+math.pi/6)%KSEC+KSEC)%KSEC-KSEC/2
    return math.hypot(x,z)*math.cos(aa)/EDGE

# ── rasterise UV triangles of ground-facing faces into the mask ────────────
tris_total=tris_ground=tris_skirt=0
def walk(ni,par):
    global tris_total,tris_ground,tris_skirt
    n=j['nodes'][ni]; m=mat_mul(par,nodemat(n))
    if 'mesh' in n:
        for pr in j['meshes'][n['mesh']].get('primitives',[]):
            at=pr.get('attributes',{})
            if 'POSITION' not in at or 'TEXCOORD_0' not in at: continue
            pos=[xf(m,p) for p in acc(j,binc,at['POSITION'])]
            uv=acc(j,binc,at['TEXCOORD_0'])
            idx=[i[0] for i in acc(j,binc,pr['indices'])] if pr.get('indices') is not None else range(len(pos))
            idx=list(idx)
            for t in range(0,len(idx)-2,3):
                a,b,c=idx[t],idx[t+1],idx[t+2]
                tris_total+=1
                pa,pb,pc=pos[a],pos[b],pos[c]
                ys=[pa[1],pb[1],pc[1]]
                # Outer wall: out at the rim, near-vertical, below the surface.
                if SKIRT and max(ys) <= SKIRT_TOP:
                    rr=[hexr(pa[0],pa[2]),hexr(pb[0],pb[2]),hexr(pc[0],pc[2])]
                    ux2,uy2,uz2=(pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2])
                    vx2,vy2,vz2=(pc[0]-pa[0],pc[1]-pa[1],pc[2]-pa[2])
                    ny2=uz2*vx2-ux2*vz2
                    ln2=math.sqrt((uy2*vz2-uz2*vy2)**2+ny2**2+(ux2*vy2-uy2*vx2)**2) or 1
                    if min(rr) > 0.80 and abs(ny2/ln2) < 0.6:
                        tris_skirt+=1
                        sd.polygon([(uv[a][0]*W,uv[a][1]*H),(uv[b][0]*W,uv[b][1]*H),(uv[c][0]*W,uv[c][1]*H)],fill=1)
                if min(ys) > TRUNK_LO:
                    ad.polygon([(uv[a][0]*W,uv[a][1]*H),(uv[b][0]*W,uv[b][1]*H),(uv[c][0]*W,uv[c][1]*H)],fill=1)
                if not all(GY_LO<=y<=GY_HI for y in ys): continue
                # face normal — keep only near-horizontal, upward faces
                ux,uy,uz=(pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2])
                vx,vy,vz=(pc[0]-pa[0],pc[1]-pa[1],pc[2]-pa[2])
                nx,ny,nz=(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx)
                ln=math.sqrt(nx*nx+ny*ny+nz*nz) or 1
                if ny/ln < NORMAL_MIN: continue
                tris_ground+=1
                md.polygon([(uv[a][0]*W,uv[a][1]*H),(uv[b][0]*W,uv[b][1]*H),(uv[c][0]*W,uv[c][1]*H)],fill=1)
    for ch in n.get('children',[]): walk(ch,m)

sc=j.get('scenes',[{}])[j.get('scene',0)]
for r in sc.get('nodes',[]): walk(r,mat_ident())

# Grow the mask slightly so UV seams do not leave a fringe of the old colour.
MaxFilter=__import__('PIL.ImageFilter',fromlist=['MaxFilter']).MaxFilter
mask=mask.filter(MaxFilter(5))
above=above.filter(MaxFilter(3))
skirt=skirt.filter(MaxFilter(3))

# ── apply ──────────────────────────────────────────────────────────────────
px=img.load(); mk=mask.load(); ab=above.load(); sk=skirt.load()
sr=sg=sb=0
if SKIRT: sr,sg,sb=(int(SKIRT[1:3],16),int(SKIRT[3:5],16),int(SKIRT[5:7],16))
skirted=0
DARKLIFT=float(flag('dark-lift','0.42'))
painted=lightened=lifted=0
for y in range(H):
    for x in range(W):
        r,g,b=px[x,y]
        if SKIRT and sk[x,y]:
            px[x,y]=(sr,sg,sb); skirted+=1
            continue
        if mk[x,y]:
            px[x,y]=(gr,gg,gb); painted+=1
            continue
        mx,mn=max(r,g,b),min(r,g,b)
        # Trunk shadow: dark, near-neutral texels standing above the ground. Lifted
        # toward a warm brown rather than plain grey, so it reads as bark not soot.
        if ab[x,y] and mx<115 and (mx-mn)<45:
            f=DARKLIFT
            px[x,y]=(min(255,int(r+(150-r)*f)),
                     min(255,int(g+(116-g)*f)),
                     min(255,int(b+(92-b)*f)))
            lifted+=1
            continue
        # Soften the trunk: warm dark browns only (r>g>b), leave greys/greens alone.
        if r>g>b and (mx-mn)>18 and mx<190:
            f=LIGHTEN
            nr=min(255,int(r+(255-r)*f))
            ng=min(255,int(g+(255-g)*f*0.95))
            nb=min(255,int(b+(255-b)*f*0.80))   # keep it warm, not washed grey
            px[x,y]=(nr,ng,nb); lightened+=1

img.save(DST)
print(f'  triangles {tris_total:,}, ground-facing {tris_ground:,}, skirt {tris_skirt:,}')
if SKIRT: print(f'  skirt {100*skirted/(W*H):.1f}% -> {SKIRT}')
print(f'  painted {100*painted/(W*H):.1f}% {GROUND}, lightened {100*lightened/(W*H):.1f}% (browns), lifted {100*lifted/(W*H):.1f}% (dark trunk)')
print(f'  -> {DST}')
