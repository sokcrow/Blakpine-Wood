"""Rasterizador de miniaturas de Agua 03: lee GLB reales, UV y texturas embebidas.
No dibuja renders ilustrativos: la superficie se obtiene de los triángulos del GLB.
"""
from pathlib import Path
import math, json
import numpy as np, trimesh
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE = Path(__file__).resolve().parent
CAT = json.loads((BASE / 'catalogo_almacenamiento_agua.json').read_text(encoding='utf8'))['models']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def render(glb, size=340, azim=32, elev=22):
    scene = trimesh.load(glb, force='scene')
    geom = next(iter(scene.geometry.values()))
    v = np.asarray(geom.vertices, dtype=np.float64)
    f = np.asarray(geom.faces)
    uv = np.asarray(geom.visual.uv)
    tex = np.asarray(geom.visual.material.baseColorTexture.convert('RGB'))
    mid = (geom.bounds[0] + geom.bounds[1]) / 2
    azim = math.radians(azim)
    elev = math.radians(elev)
    dr = np.array([math.sin(azim) * math.cos(elev), math.sin(elev), math.cos(azim) * math.cos(elev)])
    eye = mid + dr * 8
    fw = mid - eye
    fw /= np.linalg.norm(fw)
    right = np.cross(fw, [0.0, 1.0, 0.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fw)
    up /= np.linalg.norm(up)
    cv = v - mid
    px = cv @ right
    py = cv @ up
    spanx = max(0.001, np.ptp(px))
    spany = max(0.001, np.ptp(py))
    scale = min(size * 0.78 / spanx, size * 0.78 / spany)
    sx = px * scale + size * 0.5
    sy = -py * scale + size * 0.48
    depth = (v - eye) @ fw
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    zb = np.full((size, size), np.inf, dtype=np.float32)
    light = np.array([-0.5, 0.84, 0.67])
    light /= np.linalg.norm(light)
    for j, tri in enumerate(f):
        x = sx[tri]
        y = sy[tri]
        xlo = max(0, int(math.floor(x.min())))
        xhi = min(size - 1, int(math.ceil(x.max())))
        ylo = max(0, int(math.floor(y.min())))
        yhi = min(size - 1, int(math.ceil(y.max())))
        if xlo > xhi or ylo > yhi:
            continue
        x0, x1, x2 = x
        y0, y1, y2 = y
        denominator = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(denominator) < 1e-05:
            continue
        gy, gx = np.mgrid[ylo:yhi + 1, xlo:xhi + 1]
        gx = gx.astype(np.float32) + 0.5
        gy = gy.astype(np.float32) + 0.5
        a = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / denominator
        b = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / denominator
        c = 1 - a - b
        mask = (a >= -0.0001) & (b >= -0.0001) & (c >= -0.0001)
        if not mask.any():
            continue
        dz = a * depth[tri[0]] + b * depth[tri[1]] + c * depth[tri[2]]
        zsub = zb[ylo:yhi + 1, xlo:xhi + 1]
        visible = mask & (dz < zsub)
        if not visible.any():
            continue
        uu = a * uv[tri[0], 0] + b * uv[tri[1], 0] + c * uv[tri[2], 0]
        vv = a * uv[tri[0], 1] + b * uv[tri[1], 1] + c * uv[tri[2], 1]
        tx = np.clip((uu * (tex.shape[1] - 1)).astype(np.int32), 0, tex.shape[1] - 1)
        ty = np.clip(((1 - vv) * (tex.shape[0] - 1)).astype(np.int32), 0, tex.shape[0] - 1)
        col = tex[ty, tx]
        normal = geom.face_normals[j]
        bright = np.clip(0.8 + np.dot(normal, light) * 0.2, 0.64, 1.04)
        colored = np.clip(col * bright, 0, 255).astype(np.uint8)
        p = rgba[ylo:yhi + 1, xlo:xhi + 1]
        p[visible, :3] = colored[visible]
        p[visible, 3] = 255
        zsub[visible] = dz[visible]
    return Image.fromarray(rgba, 'RGBA')

def main():
    (BASE / 'miniaturas').mkdir(exist_ok=True)
    allimg = []
    for e in CAT:
        im = render(BASE / e['glb'], size=360, azim=28, elev=23)
        im.save(BASE / e['thumbnail'], optimize=True)
        allimg.append(im)
        print(e['id'], 'thumbnail', im.size)
    im = Image.new('RGB', (1000, 610), (16, 25, 32))
    d = ImageDraw.Draw(im)
    title = ImageFont.truetype(BOLD, 33)
    subtitle = ImageFont.truetype(FONT, 17)
    label = ImageFont.truetype(BOLD, 23)
    small = ImageFont.truetype(FONT, 15)
    d.text((40, 22), 'AGUA 03   /   ALMACENAMIENTO', font=title, fill=(233, 230, 214))
    d.text((43, 72), 'Tinaco elevado + cisterna principal   •   Pack independiente de Calderas 02', font=subtitle, fill=(153, 193, 204))
    for i, (e, thumb) in enumerate(zip(CAT, allimg)):
        x = 34 + i * 490
        y = 110
        d.rounded_rectangle((x, y, x + 468, y + 455), radius=10, fill=(28, 42, 51), outline=(65, 94, 104), width=2)
        shadow = Image.new('RGBA', (410, 360), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.ellipse((90, 294, 320, 323), fill=(0, 0, 0, 94))
        shadow = shadow.filter(ImageFilter.GaussianBlur(8))
        im.paste(shadow, (x + 29, y + 13), shadow)
        im.paste(thumb, (x + 54, y + 12), thumb)
        d.text((x + 22, y + 382), e['name'], font=label, fill=(236, 234, 220))
        d.text((x + 22, y + 417), f"{e['widthFt']:.2f} × {e['depthFt']:.2f} × {e['heightFt']:.2f} ft  •  {e['triangles']} triángulos", font=small, fill=(153, 187, 194))
    im.save(BASE / 'hoja_miniaturas_tinaco_cisterna.png', optimize=True)
    compare = Image.new('RGB', (900, 440), (15, 25, 30))
    dc = ImageDraw.Draw(compare)
    for i, e in enumerate(CAT):
        r = render(BASE / e['glb'], size=350, azim=0, elev=7)
        compare.paste(r, (45 + i * 450, 20), r)
        dc.text((35 + i * 450, 386), e['id'], font=ImageFont.truetype(BOLD, 19), fill=(220, 222, 212))
    compare.save(BASE / 'revision_frontal.png', optimize=True)
if __name__ == '__main__':
    main()