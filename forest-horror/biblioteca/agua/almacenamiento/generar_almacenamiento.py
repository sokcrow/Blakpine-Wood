"""Agua 03: dos props GLB reales, no calderas, para Forest Horror.
Orientación +X derecha, +Y arriba, +Z frente; origen en el suelo; metros en GLB.
Solo se generan objetos VISUALES: sin conexión a FHServices, sin sistema de calor.
"""
from __future__ import annotations
from pathlib import Path
import json, math, struct
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
BASE = Path(__file__).resolve().parent
FT = 0.3048
ATLAS_SIZE = 512
TS = 128
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
ASSETS = {'tinaco_elevado': {'name': 'Tinaco elevado', 'category': 'Almacenamiento de agua', 'placement': 'floor', 'widthFt': 4.0, 'heightFt': 6.0, 'depthFt': 4.0, 'description': 'Depósito vertical con soporte para azotea; reserva para futura distribución por gravedad.', 'waterRole': 'elevated_reservoir', 'tags': ['agua', 'tinaco', 'azotea', 'gravedad', 'edificio']}, 'cisterna_principal': {'name': 'Cisterna principal', 'category': 'Almacenamiento de agua', 'placement': 'floor', 'widthFt': 8.0, 'heightFt': 4.5, 'depthFt': 5.0, 'description': 'Depósito rectangular de reserva potable para sótanos, plantas técnicas y exteriores.', 'waterRole': 'main_reservoir', 'tags': ['agua', 'cisterna', 'reserva', 'sotano', 'edificio']}}
TILES = {'tinaco_elevado': [(36, 51, 57), (56, 75, 80), (21, 32, 40), (86, 101, 100), (34, 50, 59), (55, 113, 145), (154, 164, 151), (8, 21, 28), (49, 76, 91), (92, 152, 180), (36, 47, 54), (109, 120, 112), (28, 35, 41), (88, 98, 92), (180, 194, 177), (25, 42, 50)], 'cisterna_principal': [(68, 102, 108), (87, 119, 119), (33, 61, 69), (21, 40, 48), (45, 85, 99), (72, 143, 165), (178, 185, 173), (26, 47, 54), (55, 86, 92), (82, 123, 127), (97, 124, 126), (31, 57, 67), (35, 64, 75), (70, 118, 141), (28, 47, 54), (189, 202, 187)]}

def tex(mid):
    im = Image.new('RGB', (ATLAS_SIZE, ATLAS_SIZE))
    d = ImageDraw.Draw(im)
    palette = TILES[mid]
    for t, c in enumerate(palette):
        x = t % 4 * TS
        y = t // 4 * TS
        d.rectangle((x, y, x + 127, y + 127), fill=c)
        hi = tuple((min(255, k + 12) for k in c))
        sh = tuple((max(0, k - 17) for k in c))
        d.line((x + 3, y + 3, x + 125, y + 3), fill=hi, width=2)
        d.line((x + 3, y + 125, x + 125, y + 125), fill=sh, width=4)

    def rect(t, xy, fill, outline=None, width=1):
        x = t % 4 * TS
        y = t // 4 * TS
        a, b, c, e = xy
        d.rectangle((x + a, y + b, x + c, y + e), fill=fill, outline=outline, width=width)

    def line(t, coords, fill, width=1):
        x = t % 4 * TS
        y = t // 4 * TS
        d.line([(x + a, y + b) for a, b in coords], fill=fill, width=width)

    def text(t, xy, s, size=13, color=(224, 231, 210)):
        x = t % 4 * TS
        y = t // 4 * TS
        d.text((x + xy[0], y + xy[1]), s, font=ImageFont.truetype(FONT, size), fill=color)
    sea = (94, 175, 201)
    ink = (21, 39, 49)
    ivory = (211, 217, 200)
    if mid == 'tinaco_elevado':
        for j in range(10, 119, 15):
            line(4, [(j, 7), (j, 120)], (23, 37, 46), 3)
            line(4, [(j + 4, 7), (j + 4, 120)], (69, 91, 94), 2)
        for j in [17, 49, 81, 113]:
            line(4, [(5, j), (123, j)], (29, 44, 52), 3)
        rect(0, (8, 6, 120, 121), (39, 65, 76), (12, 29, 40), 3)
        rect(0, (17, 15, 111, 50), (24, 43, 53), (87, 133, 151), 2)
        text(0, (24, 21), 'AGUA', 23)
        text(0, (21, 60), 'RESERVA', 12, ivory)
        for k in range(3):
            y = 79 + k * 11
            line(0, [(22, y + 4), (39, y + 4), (49, y), (66, y + 4), (80, y + 4), (92, y), (105, y + 4)], (80 + k * 10, 151 + k * 8, 179 + k * 7), 4)
        rect(0, (20, 115, 108, 121), (13, 29, 37))
        for j in range(13, 113, 21):
            line(1, [(j, 16), (j, 114)], (47, 66, 71), 3)
        for j in range(14, 112, 19):
            line(3, [(10, j), (119, j)], (57, 74, 76), 2)
        rect(5, (18, 20, 109, 104), (47, 100, 128), (19, 45, 64), 4)
        text(5, (23, 32), 'SALIDA', 13, ivory)
        text(5, (27, 64), 'AGUA', 17, ivory)
        for j in range(4):
            line(8, [(15, 17 + j * 23), (111, 17 + j * 23)], (28, 46, 55), 3)
        rect(9, (16, 22, 113, 107), (64, 123, 144), (22, 55, 72), 4)
        text(9, (30, 48), 'TAPA', 16)
    else:
        for j in range(12, 121, 18):
            line(8, [(j, 9), (j, 119)], (35, 69, 75), 3)
            line(8, [(j + 4, 9), (j + 4, 119)], (83, 113, 112), 2)
        rect(0, (7, 10, 119, 118), (60, 99, 110), (23, 51, 63), 4)
        rect(0, (16, 20, 112, 59), (25, 59, 75), (110, 159, 169), 2)
        text(0, (25, 25), 'AGUA', 22, ivory)
        text(0, (22, 67), 'POTABLE', 16, (189, 224, 217))
        for k in range(3):
            y = 94 + k * 8
            line(0, [(20, y + 3), (35, y + 3), (45, y), (66, y + 4), (82, y + 4), (95, y), (106, y + 2)], sea, 3)
        rect(11, (10, 10, 118, 118), (44, 71, 77), (20, 44, 54), 4)
        for r in (44, 32):
            d.ellipse((3 * TS + 64 - r, 2 * TS + 64 - r, 3 * TS + 64 + r, 2 * TS + 64 + r), outline=(145, 165, 157), width=5)
        text(11, (28, 55), 'INSPECC.', 10, ivory)
        rect(13, (34, 9, 91, 119), (33, 59, 68), (18, 36, 47), 3)
        for k in range(8):
            rect(13, (40, 14 + k * 13, 86, 22 + k * 13), (79, 138, 155) if k > 3 else (45, 86, 105))
        text(13, (43, 113), 'NIVEL', 7, ivory)
        for j in range(18, 116, 18):
            line(10, [(7, j), (121, j)], (61, 94, 101), 2)
    return im

class Mesh:

    def __init__(self):
        self.verts = []
        self.faces = []
        self.uv = []

    def quad(self, pts, t, coord=None):
        if coord is None:
            coord = [(5, 123), (123, 123), (123, 5), (5, 5)]
        i = len(self.verts)
        self.verts.extend(pts)
        self.faces.extend([(i, i + 1, i + 2), (i, i + 2, i + 3)])
        for u, v in coord:
            self.uv.append(((t % 4 * TS + u) / ATLAS_SIZE, 1 - (t // 4 * TS + v) / ATLAS_SIZE))

    def tri(self, pts, t, coord=None):
        i = len(self.verts)
        self.verts.extend(pts)
        self.faces.append((i, i + 1, i + 2))
        for u, v in coord or [(64, 9), (119, 118), (9, 118)]:
            self.uv.append(((t % 4 * TS + u) / ATLAS_SIZE, 1 - (t // 4 * TS + v) / ATLAS_SIZE))

    def box(self, x0, x1, y0, y1, z0, z1, front=0, side=2, top=1, back=3, bottom=3):
        if not x0 < x1 or not y0 < y1 or (not z0 < z1):
            raise ValueError('Caja degenerada')
        self.quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], front)
        self.quad([(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)], back)
        self.quad([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], side)
        self.quad([(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], side)
        self.quad([(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], top)
        self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], bottom)

    def cylinder_y(self, cx, cz, lo, hi, rx, rz, n=12, side=4, cap=1):
        for i in range(n):
            a = 2 * math.pi * i / n
            b = 2 * math.pi * (i + 1) / n
            x0 = cx + rx * math.cos(a)
            x1 = cx + rx * math.cos(b)
            z0 = cz + rz * math.sin(a)
            z1 = cz + rz * math.sin(b)
            self.quad([(x0, lo, z0), (x1, lo, z1), (x1, hi, z1), (x0, hi, z0)], side)
            self.tri([(cx, hi, cz), (x0, hi, z0), (x1, hi, z1)], cap)
            self.tri([(cx, lo, cz), (x1, lo, z1), (x0, lo, z0)], cap)

    def tapered_y(self, cx, cz, y0, y1, rx0, rz0, rx1, rz1, n=12, side=1, top=2):
        for i in range(n):
            a = i * math.tau / n
            b = (i + 1) * math.tau / n
            x0, x1 = (math.cos(a), math.cos(b))
            z0, z1 = (math.sin(a), math.sin(b))
            self.quad([(cx + rx0 * x0, y0, cz + rz0 * z0), (cx + rx0 * x1, y0, cz + rz0 * z1), (cx + rx1 * x1, y1, cz + rz1 * z1), (cx + rx1 * x0, y1, cz + rz1 * z0)], side)
            self.tri([(cx, y1, cz), (cx + rx1 * x0, y1, cz + rz1 * z0), (cx + rx1 * x1, y1, cz + rz1 * z1)], top)

    def cylinder_z(self, cx, cy, z0, z1, rx, ry, n=8, side=5, cap=6):
        for i in range(n):
            a = i * math.tau / n
            b = (i + 1) * math.tau / n
            x0, x1 = (cx + rx * math.cos(a), cx + rx * math.cos(b))
            y0, y1 = (cy + ry * math.sin(a), cy + ry * math.sin(b))
            self.quad([(x0, y0, z0), (x0, y0, z1), (x1, y1, z1), (x1, y1, z0)], side)
            self.tri([(cx, cy, z1), (x0, y0, z1), (x1, y1, z1)], cap)
            self.tri([(cx, cy, z0), (x1, y1, z0), (x0, y0, z0)], cap)

    def beam(self, start, end, width, depth, t=3):
        p = np.array(start, float)
        q = np.array(end, float)
        d = q - p
        d /= np.linalg.norm(d)
        axis = np.array([0.0, 0.0, 1.0])
        if abs(np.dot(d, axis)) > 0.95:
            axis = np.array([0.0, 1.0, 0.0])
        right = np.cross(d, axis)
        right /= np.linalg.norm(right)
        up = np.cross(right, d)
        r = right * width / 2
        u = up * depth / 2
        a = p - r - u
        b = p + r - u
        c = p + r + u
        e = p - r + u
        A = q - r - u
        B = q + r - u
        C = q + r + u
        E = q - r + u
        for pts in [[a, b, B, A], [b, c, C, B], [c, e, E, C], [e, a, A, E], [A, B, C, E], [e, c, b, a]]:
            self.quad(pts, t)

    def beveled_box(self, xhalf, zhalf, bevel, y0, y1, side=8, front=0, top=10):
        a = xhalf
        b = zhalf
        c = bevel
        ring = [(-a + c, -b), (a - c, -b), (a, -b + c), (a, b - c), (a - c, b), (-a + c, b), (-a, b - c), (-a, -b + c)]
        for i, (x0, z0) in enumerate(ring):
            x1, z1 = ring[(i + 1) % len(ring)]
            face = front if i == 4 else side
            self.quad([(x0, y0, z0), (x1, y0, z1), (x1, y1, z1), (x0, y1, z0)], face)
            self.tri([(0, y1, 0), (x0, y1, z0), (x1, y1, z1)], top)
            self.tri([(0, y0, 0), (x1, y0, z1), (x0, y0, z0)], 3)

    def export(self, mid, texture):
        geometry = trimesh.Trimesh(vertices=np.asarray(self.verts, dtype=np.float32), faces=np.asarray(self.faces, dtype=np.int32), process=False)
        geometry.visual = TextureVisuals(uv=np.asarray(self.uv, dtype=np.float32), material=PBRMaterial(baseColorTexture=texture, metallicFactor=0.01, roughnessFactor=0.96, doubleSided=True))
        scene = trimesh.Scene()
        scene.add_geometry(geometry, geom_name=mid, node_name=mid)
        path = BASE / 'modelos_glb' / f'{mid}.glb'
        path.write_bytes(scene.export(file_type='glb'))
        ensure_nearest(path)
        return geometry

def make_tinaco(W, H, D):
    m = Mesh()
    w = W / 2
    d = D / 2
    for x in (-w * 0.71, w * 0.71):
        for z in (-d * 0.71, d * 0.71):
            m.box(x - w * 0.087, x + w * 0.087, 0, H * 0.225, z - d * 0.087, z + d * 0.087, front=3, side=3, top=6)
            m.box(x - w * 0.137, x + w * 0.137, 0, H * 0.024, z - d * 0.137, z + d * 0.137, front=2, side=3)
    for z in (-d * 0.71, d * 0.71):
        m.beam((-w * 0.69, H * 0.046, z), (w * 0.69, H * 0.205, z), w * 0.06, d * 0.05, 3)
    m.box(-w * 0.91, w * 0.91, H * 0.205, H * 0.25, -d * 0.91, d * 0.91, front=3, side=3, top=6)
    m.cylinder_y(0, 0, H * 0.252, H * 0.836, w * 0.91, d * 0.91, n=12, side=4, cap=2)
    for y in (H * 0.325, H * 0.54, H * 0.77):
        m.cylinder_y(0, 0, y, y + H * 0.018, w * 0.929, d * 0.929, n=12, side=10, cap=2)
    m.tapered_y(0, 0, H * 0.836, H * 0.93, w * 0.91, d * 0.91, w * 0.73, d * 0.73, n=12, side=1, top=2)
    m.cylinder_y(0, 0, H * 0.928, H * 0.956, w * 0.73, d * 0.73, n=12, side=2, cap=1)
    m.cylinder_y(0, 0, H * 0.953, H * 0.983, w * 0.34, d * 0.34, n=12, side=5, cap=9)
    m.cylinder_y(0, 0, H * 0.981, H * 0.998, w * 0.29, d * 0.29, n=10, side=3, cap=1)
    m.cylinder_y(w * 0.58, -d * 0.43, H * 0.91, H * 0.982, w * 0.07, d * 0.07, n=8, side=6, cap=6)
    m.cylinder_z(w * 0.42, H * 0.34, d * 0.83, d * 0.99, w * 0.07, H * 0.025, n=8, side=5, cap=6)
    m.cylinder_z(w * 0.42, H * 0.34, d * 0.975, d * 0.999, w * 0.115, H * 0.038, n=8, side=6, cap=5)
    m.box(-w * 0.32, w * 0.32, H * 0.5, H * 0.66, d * 0.91, d * 0.927, front=0, side=3, top=3)
    return m

def make_cisterna(W, H, D):
    m = Mesh()
    w = W / 2
    d = D / 2
    for x in (-w * 0.69, w * 0.69):
        m.box(x - w * 0.11, x + w * 0.11, 0, H * 0.115, -d * 0.69, d * 0.69, front=7, side=3, top=3)
    m.beveled_box(w * 0.957, d * 0.937, min(w * 0.06, d * 0.085), H * 0.1, H * 0.88, side=8, front=0, top=10)
    for x in (-w * 0.8, -w * 0.6, w * 0.6, w * 0.8):
        m.box(x - W * 0.016, x + W * 0.016, H * 0.12, H * 0.845, d * 0.936, d * 0.952, front=2, side=8)
    m.box(-w * 0.43, w * 0.43, H * 0.34, H * 0.7, d * 0.936, d * 0.965, front=0, side=7, top=7)
    m.cylinder_y(w * 0.4, -d * 0.17, H * 0.878, H * 0.945, w * 0.18, d * 0.26, n=12, side=11, cap=11)
    m.cylinder_y(w * 0.4, -d * 0.17, H * 0.941, H * 0.972, w * 0.151, d * 0.218, n=12, side=2, cap=10)
    m.cylinder_y(-w * 0.68, -d * 0.54, H * 0.875, H * 0.985, w * 0.045, d * 0.066, n=8, side=6, cap=3)
    m.cylinder_y(-w * 0.68, -d * 0.54, H * 0.978, H * 0.994, w * 0.075, d * 0.08, n=8, side=6, cap=3)
    for x, y, side in [(-w * 0.72, H * 0.22, 5), (w * 0.71, H * 0.22, 6)]:
        m.cylinder_z(x, y, d * 0.92, d * 0.999, w * 0.067, H * 0.052, n=8, side=side, cap=6)
        m.cylinder_z(x, y, d * 0.97, d * 0.997, w * 0.1, H * 0.073, n=8, side=6, cap=side)
    m.box(w * 0.47, w * 0.54, H * 0.36, H * 0.73, d * 0.947, d * 0.972, front=13, side=6)
    m.box(w * 0.46, w * 0.55, H * 0.35, H * 0.37, d * 0.94, d * 0.98, front=6, side=6)
    m.box(w * 0.46, w * 0.55, H * 0.72, H * 0.74, d * 0.94, d * 0.98, front=6, side=6)
    return m

def ensure_nearest(path):
    data = path.read_bytes()
    jlen, jtyp = struct.unpack_from('<II', data, 12)
    assert jtyp == 1313821514
    obj = json.loads(data[20:20 + jlen])
    assert len(obj['textures']) == 1
    obj['samplers'] = [dict(magFilter=9728, minFilter=9984, wrapS=33071, wrapT=33071)]
    obj['textures'][0]['sampler'] = 0
    js = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    body = bytearray(data[:12])
    body += struct.pack('<II', len(js), 1313821514) + js + data[20 + jlen:]
    struct.pack_into('<I', body, 8, len(body))
    path.write_bytes(body)

def main():
    for name in ('modelos_glb', 'miniaturas', 'texturas'):
        (BASE / name).mkdir(exist_ok=True)
    catalog = []
    for mid, spec in ASSETS.items():
        im = tex(mid)
        im.save(BASE / 'texturas' / f'{mid}.png', optimize=True)
        W = spec['widthFt'] * FT
        H = spec['heightFt'] * FT
        D = spec['depthFt'] * FT
        mesh = make_tinaco(W, H, D) if mid == 'tinaco_elevado' else make_cisterna(W, H, D)
        geom = mesh.export(mid, im)
        faces = len(geom.faces)
        cat = dict(id=mid, name=spec['name'], category=spec['category'], placement=spec['placement'], widthFt=spec['widthFt'], heightFt=spec['heightFt'], depthFt=spec['depthFt'], widthTiles=spec['widthFt'] / 5, depthTiles=spec['depthFt'] / 5, blocksMovement=True, front='+Z', origin='centro de la huella, Y=0', waterRole=spec['waterRole'], functional=False, pack='agua_03_almacenamiento', description=spec['description'], tags=spec['tags'], glb=f'modelos_glb/{mid}.glb', thumbnail=f'miniaturas/{mid}.png', triangles=faces)
        catalog.append(cat)
        print(mid, 'TRIS', faces, 'BOUNDS', geom.bounds.tolist())
    out = {'schema': 'forest-horror-props-catalog-v1', 'version': 1, 'pack': 'Agua 03 — Tinaco y Cisterna', 'independentOf': ['Agua 01', 'Agua 02 — Calderas'], 'units': {'length': 'ft', 'metersPerFoot': FT, 'feetPerCell': 5}, 'renderTarget': 'Three.js r128', 'style': 'low-poly / pixel art', 'visualOnly': True, 'models': catalog}
    (BASE / 'catalogo_almacenamiento_agua.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
if __name__ == '__main__':
    main()