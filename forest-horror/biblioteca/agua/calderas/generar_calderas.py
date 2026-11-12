"""GLB 3D reales para Forest Horror. Un mesh/material por prop, sin lógica hidráulica.
Mundo: +X derecha, +Y arriba, +Z frente. Unidades GLB en metros.
Pared: origen en el eje de la pared, parte posterior del mesh a >= .08 m.
"""
from pathlib import Path
import math, json, struct
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
R = Path(__file__).resolve().parent
FT = 0.3048
S = 512
TS = 128
for n in ('modelos_glb', 'miniaturas', 'texturas'):
    (R / n).mkdir(parents=True, exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
SPEC = [('calentador_domestico_vertical', 'Calentador doméstico vertical', 'floor', 2.0, 5.0, 2.0, 0, 'Hogar · tanque de reserva', 'tanque'), ('calentador_domestico_horizontal', 'Calentador doméstico horizontal', 'floor', 3.5, 2.5, 2.25, 0, 'Hogar · depósito compacto', 'tanque'), ('caldera_residencial_mediana', 'Caldera residencial mediana', 'floor', 3.25, 5.0, 2.75, 0, 'Edificio pequeño · caldera', 'caldera'), ('caldera_industrial_grande', 'Caldera industrial grande', 'floor', 5.5, 7.5, 4.5, 0, 'Edificio grande · sala de calderas', 'caldera'), ('tanque_expansion', 'Tanque de expansión', 'floor', 1.75, 3.0, 1.75, 0, 'Circuito cerrado · depósito auxiliar', 'tanque'), ('bomba_recirculacion', 'Bomba de recirculación', 'floor', 2.5, 1.75, 1.5, 0, 'Circulación de circuito · bomba', 'bomba'), ('colector_tuberias', 'Colector de tuberías', 'wall', 4.0, 3.0, 0.75, 3.0, 'Distribución · colector mural', 'conductos'), ('panel_control_caldera', 'Panel de control de caldera', 'wall', 1.75, 2.25, 0.75, 4.0, 'Panel técnico · control visual', 'panel')]
assert len(SPEC) == 8
T = {'main': 0, 'light': 1, 'edge': 2, 'dark': 3, 'brass': 4, 'copper': 5, 'black': 6, 'label': 7, 'dial': 8, 'red': 9, 'blue': 10, 'green': 11, 'warn': 12, 'grille': 13, 'screen': 14, 'rubber': 15}
PALETTES = {'calentador_domestico_vertical': [(176, 173, 156), (221, 214, 190), (100, 108, 106), (46, 54, 58), (186, 149, 79), (182, 112, 72), (25, 36, 42), (205, 199, 172), (223, 222, 198), (170, 91, 69), (68, 132, 150), (88, 145, 110), (219, 175, 80), (75, 92, 94), (62, 96, 100), (51, 61, 64)], 'calentador_domestico_horizontal': [(159, 179, 173), (203, 214, 191), (85, 109, 109), (40, 61, 63), (174, 144, 83), (184, 117, 70), (24, 43, 49), (206, 218, 199), (226, 220, 185), (182, 102, 73), (69, 135, 162), (111, 160, 124), (215, 177, 91), (70, 93, 99), (58, 100, 105), (44, 59, 66)], 'caldera_residencial_mediana': [(109, 126, 139), (176, 190, 190), (56, 72, 83), (23, 38, 49), (179, 148, 92), (155, 107, 67), (19, 31, 40), (208, 215, 201), (216, 211, 175), (176, 99, 87), (69, 131, 162), (103, 167, 130), (214, 171, 80), (64, 88, 98), (45, 111, 113), (40, 56, 64)], 'caldera_industrial_grande': [(84, 110, 112), (155, 180, 172), (51, 68, 69), (20, 38, 43), (200, 156, 86), (165, 101, 66), (16, 31, 36), (202, 207, 186), (221, 214, 182), (161, 88, 79), (83, 135, 153), (111, 174, 136), (231, 186, 75), (74, 97, 99), (47, 104, 98), (39, 54, 59)], 'tanque_expansion': [(150, 67, 69), (199, 110, 101), (99, 48, 51), (42, 39, 43), (172, 133, 78), (181, 114, 72), (26, 29, 38), (234, 218, 190), (222, 217, 186), (172, 80, 72), (64, 145, 167), (100, 168, 117), (220, 177, 80), (87, 65, 67), (57, 98, 106), (47, 48, 56)], 'bomba_recirculacion': [(73, 120, 103), (120, 159, 134), (46, 85, 79), (23, 44, 50), (198, 148, 82), (176, 110, 62), (18, 34, 38), (216, 214, 190), (214, 220, 190), (170, 79, 69), (73, 127, 165), (90, 160, 113), (216, 174, 82), (56, 94, 84), (47, 92, 107), (32, 54, 57)], 'colector_tuberias': [(87, 113, 112), (166, 184, 175), (53, 71, 72), (19, 33, 39), (191, 153, 85), (192, 115, 70), (17, 30, 36), (215, 215, 191), (210, 209, 182), (190, 98, 77), (70, 145, 184), (96, 158, 120), (223, 183, 90), (65, 92, 98), (49, 108, 105), (46, 54, 59)], 'panel_control_caldera': [(79, 110, 119), (151, 174, 178), (48, 72, 81), (18, 34, 45), (186, 156, 93), (155, 106, 65), (18, 26, 36), (220, 224, 200), (219, 216, 177), (189, 87, 78), (75, 144, 178), (81, 169, 120), (217, 173, 80), (68, 101, 114), (35, 101, 112), (32, 52, 60)]}

def C(col):
    return (*col, 255)

def texture(mid):
    colors = PALETTES[mid]
    im = Image.new('RGBA', (S, S))
    p = ImageDraw.Draw(im)
    for i, c in enumerate(colors):
        x = i % 4 * TS
        y = i // 4 * TS
        p.rectangle((x, y, x + 127, y + 127), fill=C(c))
        p.line((x + 1, y + 2, x + 125, y + 2), fill=C(tuple((min(255, v + 17) for v in c))), width=3)
        p.line((x + 2, y + 3, x + 2, y + 123), fill=C(tuple((min(255, v + 7) for v in c))), width=2)
        p.line((x + 3, y + 124, x + 125, y + 124), fill=C(tuple((max(0, v - 20) for v in c))), width=3)

    def tile_box(t, xy, clr, outline=None, width=1):
        x = t % 4 * TS
        y = t // 4 * TS
        a, b, c, d = xy
        p.rectangle((x + a, y + b, x + c, y + d), fill=C(clr), outline=C(outline) if outline else None, width=width)

    def tile_line(t, pts, clr, width=1):
        p.line([(t % 4 * TS + x, t // 4 * TS + y) for x, y in pts], fill=C(clr), width=width)

    def txt(t, xy, s, clr=(236, 224, 195), size=12):
        x = t % 4 * TS
        y = t // 4 * TS
        font = ImageFont.truetype(FONT, size)
        p.text((x + xy[0], y + xy[1]), s, fill=C(clr), font=font, stroke_width=0)
    fg = (227, 224, 203)
    drk = (22, 40, 44)
    gold = (229, 184, 89)
    if mid == 'calentador_domestico_vertical':
        tile_box(0, (10, 7, 117, 121), (194, 187, 162), (71, 77, 71), 3)
        tile_box(0, (23, 13, 104, 39), (57, 73, 73), drk, 2)
        txt(0, (30, 19), 'TERMO 80L', gold, 12)
        tile_box(0, (28, 66, 101, 87), (73, 86, 83), drk, 2)
        txt(0, (35, 70), 'AGUA', fg, 11)
        txt(0, (24, 98), 'CALIENTE', drk, 12)
        txt(0, (40, 112), 'CASA', drk, 8)
    elif mid == 'calentador_domestico_horizontal':
        tile_box(0, (8, 10, 119, 118), (170, 193, 178), (42, 71, 68), 3)
        tile_box(0, (21, 18, 108, 49), (42, 70, 69), drk, 2)
        txt(0, (26, 24), 'THERMAL', gold, 13)
        txt(0, (31, 70), 'TANQUE', drk, 14)
        txt(0, (38, 86), '120 L', drk, 11)
        for x in (15, 105):
            tile_box(0, (x, 12, x + 6, 113), (76, 110, 105))
    elif mid == 'caldera_residencial_mediana':
        tile_box(0, (7, 6, 120, 121), (111, 133, 145), drk, 3)
        tile_box(0, (17, 16, 109, 43), (30, 51, 66), drk, 2)
        txt(0, (28, 20), 'BOILER R2', gold, 12)
        tile_box(0, (18, 51, 108, 73), (33, 53, 62), drk, 2)
        txt(0, (26, 55), '00  65 C', fg, 11)
        for y in range(83, 109, 6):
            tile_line(0, [(24, y), (100, y)], (43, 64, 72), 3)
        txt(0, (34, 111), 'SERVICE', fg, 7)
    elif mid == 'caldera_industrial_grande':
        tile_box(0, (5, 7, 122, 121), (93, 121, 116), (30, 55, 55), 4)
        tile_box(0, (17, 17, 110, 39), (29, 49, 55), drk, 2)
        txt(0, (26, 20), 'PLANTA 01', gold, 12)
        tile_box(0, (16, 54, 112, 79), (35, 55, 54), drk, 2)
        txt(0, (26, 60), 'CALDERA', fg, 12)
        txt(0, (27, 93), 'PRESION', fg, 10)
        txt(0, (46, 105), 'BAR', gold, 10)
    elif mid == 'tanque_expansion':
        tile_box(0, (7, 7, 121, 120), (167, 80, 77), (76, 47, 49), 4)
        tile_box(0, (16, 27, 110, 69), (48, 52, 56), drk, 3)
        txt(0, (26, 32), 'EXPANSION', fg, 11)
        txt(0, (40, 49), '8 BAR', gold, 12)
        txt(0, (32, 89), 'CIRCUITO', fg, 9)
        txt(0, (35, 102), 'CERRADO', fg, 9)
    elif mid == 'bomba_recirculacion':
        tile_box(0, (8, 8, 120, 120), (91, 147, 123), (37, 72, 64), 3)
        tile_box(0, (13, 18, 114, 42), (25, 53, 54), drk, 3)
        txt(0, (28, 23), 'PUMP 02', gold, 13)
        for y in range(57, 105, 8):
            tile_line(0, [(16, y), (109, y)], (50, 99, 88), 3)
        txt(0, (32, 109), '0.5 HP', fg, 9)
    elif mid == 'colector_tuberias':
        tile_box(0, (8, 10, 118, 119), (70, 93, 96), drk, 3)
        tile_box(0, (14, 18, 112, 49), (25, 49, 54), drk, 3)
        txt(0, (21, 24), 'COLECTOR', fg, 11)
        tile_box(0, (15, 76, 113, 96), (30, 55, 57), drk, 2)
        txt(0, (22, 78), 'SUMINISTRO', gold, 9)
        txt(0, (25, 100), '6 SALIDAS', fg, 9)
    elif mid == 'panel_control_caldera':
        tile_box(0, (7, 7, 120, 121), (96, 125, 135), drk, 3)
        tile_box(0, (17, 18, 110, 46), (18, 44, 54), drk, 3)
        txt(0, (27, 21), 'BOILER OS', gold, 11)
        txt(0, (26, 58), 'T 065.0 C', fg, 12)
        txt(0, (25, 81), 'P 02.8 bar', fg, 10)
        for i, c in enumerate(((70, 186, 122), (222, 183, 82), (203, 84, 80))):
            x = 37 + 24 * i
            tile_box(0, (x, 100, x + 9, 109), c, drk, 1)
    x = 0
    y = 2 * TS
    p.ellipse((x + 5, y + 5, x + 122, y + 122), fill=C((38, 62, 68)), outline=C((179, 186, 171)), width=7)
    p.ellipse((x + 18, y + 18, x + 109, y + 109), fill=C((226, 220, 196)), outline=C((96, 127, 123)), width=3)
    for j in range(-4, 5):
        q = j * math.pi / 12
        xx = 64 + 33 * math.sin(q)
        yy = 65 - 33 * math.cos(q)
        tile_line(8, [(int(xx), int(yy)), (int(64 + 43 * math.sin(q)), int(65 - 43 * math.cos(q)))], drk, 3)
    tile_line(8, [(64, 67), (87, 41)], (177, 77, 67), 4)
    txt(8, (48, 88), 'bar', drk, 11)
    for y in range(17, 114, 13):
        tile_box(13, (18, y, 110, y + 5), (22, 40, 44))
    tile_box(14, (11, 15, 117, 113), (17, 43, 50), (97, 139, 145), 3)
    txt(14, (20, 36), '65.0 C', (178, 220, 175), 16)
    txt(14, (26, 69), 'READY', (130, 205, 174), 12)
    return im

class Mesh:

    def __init__(self):
        self.verts = []
        self.faces = []
        self.uv = []

    def tri(self, pts, t):
        k = len(self.verts)
        self.verts.extend(pts)
        self.faces.append((k, k + 1, k + 2))
        ox = t % 4 * TS
        oy = t // 4 * TS
        self.uv.extend([((ox + 14) / S, 1 - (oy + 112) / S), ((ox + 114) / S, 1 - (oy + 112) / S), ((ox + 64) / S, 1 - (oy + 14) / S)])

    def quad(self, pts, t):
        k = len(self.verts)
        self.verts.extend(pts)
        self.faces.extend([(k, k + 1, k + 2), (k, k + 2, k + 3)])
        ox = t % 4 * TS
        oy = t // 4 * TS
        self.uv.extend([((ox + 5) / S, 1 - (oy + 123) / S), ((ox + 123) / S, 1 - (oy + 123) / S), ((ox + 123) / S, 1 - (oy + 5) / S), ((ox + 5) / S, 1 - (oy + 5) / S)])

    def box(self, x0, x1, y0, y1, z0, z1, front=0, side=2, top=1, back=3, bottom=3):
        if not (x0 < x1 and y0 < y1 and (z0 < z1)):
            raise ValueError(f'box {(x0, x1, y0, y1, z0, z1)}')
        self.quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], front)
        self.quad([(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)], back)
        self.quad([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], side)
        self.quad([(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], side)
        self.quad([(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], top)
        self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], bottom)

    def tube_y(self, cx, cz, lo, hi, rx, rz, n=10, side=0, cap=1):
        ps = [(cx + rx * math.cos(2 * math.pi * i / n), cz + rz * math.sin(2 * math.pi * i / n)) for i in range(n)]
        for i in range(n):
            a, b = (ps[i], ps[(i + 1) % n])
            self.quad([(a[0], lo, a[1]), (b[0], lo, b[1]), (b[0], hi, b[1]), (a[0], hi, a[1])], side)
            self.tri([(cx, hi, cz), (a[0], hi, a[1]), (b[0], hi, b[1])], cap)
            self.tri([(cx, lo, cz), (b[0], lo, b[1]), (a[0], lo, a[1])], cap)

    def tube_x(self, lo, hi, cy, cz, ry, rz, n=10, side=0, cap=1):
        ps = [(cy + ry * math.cos(2 * math.pi * i / n), cz + rz * math.sin(2 * math.pi * i / n)) for i in range(n)]
        for i in range(n):
            a, b = (ps[i], ps[(i + 1) % n])
            self.quad([(lo, a[0], a[1]), (hi, a[0], a[1]), (hi, b[0], b[1]), (lo, b[0], b[1])], side)
            self.tri([(hi, cy, cz), (hi, a[0], a[1]), (hi, b[0], b[1])], cap)
            self.tri([(lo, cy, cz), (lo, b[0], b[1]), (lo, a[0], a[1])], cap)

    def ring_xy(self, cx, cy, z0, z1, rout, rin, n=10, front=4, side=2):
        for i in range(n):
            a = 2 * math.pi * i / n
            b = 2 * math.pi * (i + 1) / n
            x1, y1 = (cx + rout * math.cos(a), cy + rout * math.sin(a))
            x2, y2 = (cx + rout * math.cos(b), cy + rout * math.sin(b))
            X1, Y1 = (cx + rin * math.cos(a), cy + rin * math.sin(a))
            X2, Y2 = (cx + rin * math.cos(b), cy + rin * math.sin(b))
            self.quad([(x1, y1, z1), (x2, y2, z1), (X2, Y2, z1), (X1, Y1, z1)], front)
            self.quad([(x1, y1, z0), (x2, y2, z0), (x2, y2, z1), (x1, y1, z1)], side)

    def gauge(self, cx, cy, z0, z1, rx, ry, n=10, t=8):
        pts = [(cx + rx * math.cos(i * math.tau / n), cy + ry * math.sin(i * math.tau / n)) for i in range(n)]
        for i in range(n):
            a, b = (pts[i], pts[(i + 1) % n])
            self.quad([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], T['edge'])
            k = len(self.verts)
            self.verts.extend([(cx, cy, z1), (a[0], a[1], z1), (b[0], b[1], z1)])
            self.faces.append((k, k + 1, k + 2))
            ox = t % 4 * TS
            oy = t // 4 * TS
            for xx, yy in [(cx, cy), a, b]:
                self.uv.append(((ox + 64 + (xx - cx) / rx * 58) / S, 1 - (oy + 64 - (yy - cy) / ry * 58) / S))

    def export(self, path, img):
        geom = trimesh.Trimesh(vertices=np.array(self.verts, dtype='f4'), faces=np.array(self.faces, dtype='i4'), process=False)
        geom.visual = TextureVisuals(uv=np.array(self.uv, dtype='f4'), material=PBRMaterial(baseColorTexture=img, metallicFactor=0.07, roughnessFactor=0.89, doubleSided=True))
        sc = trimesh.Scene()
        sc.add_geometry(geom, node_name='CALDERA_PROPS', geom_name='CALDERA_PROPS')
        path.write_bytes(sc.export(file_type='glb'))
        return geom

def build(mid, W, H, D):
    m = Mesh()
    w = W / 2
    d = D / 2
    if mid == 'calentador_domestico_vertical':
        m.tube_y(0, 0, H * 0.075, H * 0.91, w * 0.87, d * 0.84, n=12, side=1, cap=1)
        m.tube_y(0, 0, H * 0.9, H * 0.95, w * 0.77, d * 0.74, n=12, side=1, cap=2)
        for x in (-w * 0.55, w * 0.55):
            m.box(x - w * 0.15, x + w * 0.15, 0, H * 0.085, -d * 0.23, d * 0.2, side=2)
            m.tube_y(x * 0.75, -d * 0.17, H * 0.945, H * 0.997, w * 0.12, d * 0.13, n=6, side=5, cap=4)
        m.box(-w * 0.46, w * 0.46, H * 0.44, H * 0.76, d * 0.82, d * 0.97, front=0, side=2)
        m.gauge(0, H * 0.54, d * 0.96, d * 0.997, w * 0.19, H * 0.045, 8)
        m.box(-w * 0.4, w * 0.4, H * 0.19, H * 0.31, d * 0.82, d * 0.93, front=7, side=2)
    elif mid == 'calentador_domestico_horizontal':
        cy = H * 0.56
        m.tube_x(-w * 0.84, w * 0.84, cy, 0, H * 0.34, d * 0.82, n=12, side=1, cap=1)
        for x in (-w * 0.57, w * 0.57):
            m.tube_x(x - W * 0.042, x + W * 0.042, cy, 0, H * 0.355, d * 0.845, n=10, side=2, cap=2)
            m.box(x - W * 0.13, x + W * 0.13, 0, H * 0.25, -d * 0.5, d * 0.5, front=2, side=3)
        m.box(-w * 0.32, w * 0.32, H * 0.41, H * 0.68, d * 0.77, d * 0.92, front=0, side=2)
        for x in (-w * 0.55, w * 0.55):
            m.tube_y(x, 0, H * 0.88, H * 0.99, w * 0.055, d * 0.08, n=6, side=5, cap=4)
    elif mid == 'caldera_residencial_mediana':
        m.box(-w * 0.94, w * 0.94, H * 0.045, H * 0.87, -d * 0.73, d * 0.68, front=1, side=2)
        m.box(-w * 0.84, w * 0.84, H * 0.37, H * 0.78, d * 0.68, d * 0.87, front=0, side=2)
        m.box(-w * 0.69, w * 0.69, H * 0.57, H * 0.66, d * 0.87, d * 0.92, front=14, side=3)
        m.box(-w * 0.73, w * 0.73, H * 0.19, H * 0.33, d * 0.68, d * 0.82, front=13, side=2)
        m.gauge(w * 0.37, H * 0.49, d * 0.87, d * 0.97, w * 0.15, H * 0.045, n=8)
        for x in (-w * 0.66, w * 0.66):
            m.box(x - w * 0.16, x + w * 0.16, 0, H * 0.05, -d * 0.42, d * 0.38, side=3)
        m.tube_y(0, -d * 0.12, H * 0.87, H * 0.992, w * 0.19, d * 0.22, n=8, side=2, cap=3)
        for x in (-w * 0.55, w * 0.55):
            m.box(x - w * 0.05, x + w * 0.05, H * 0.84, H * 0.91, d * 0.15, d * 0.37, front=5, side=4)
    elif mid == 'caldera_industrial_grande':
        cy = H * 0.48
        cz = -d * 0.04
        m.tube_x(-w * 0.82, w * 0.82, cy, cz, H * 0.285, d * 0.7, n=12, side=1, cap=1)
        for x in (-w * 0.62, w * 0.62):
            m.tube_x(x - W * 0.032, x + W * 0.032, cy, cz, H * 0.292, d * 0.72, n=10, side=2, cap=3)
            m.box(x - w * 0.075, x + w * 0.075, 0, H * 0.23, -d * 0.49, d * 0.47, side=2)
        m.box(-w * 0.42, w * 0.42, H * 0.37, H * 0.62, d * 0.67, d * 0.79, front=0, side=2)
        m.ring_xy(0, H * 0.47, d * 0.79, d * 0.85, min(w * 0.3, H * 0.13), min(w * 0.21, H * 0.095), n=12, front=4, side=2)
        m.gauge(w * 0.44, H * 0.58, d * 0.73, d * 0.84, w * 0.15, H * 0.037, n=10)
        m.tube_y(w * 0.14, 0, H * 0.72, H * 0.985, w * 0.13, d * 0.19, n=10, side=2, cap=3)
        m.box(-w * 0.65, w * 0.65, H * 0.71, H * 0.78, -d * 0.26, -d * 0.08, front=5, side=4)
        m.box(-w * 0.33, w * 0.25, H * 0.15, H * 0.25, d * 0.4, d * 0.76, front=12, side=3)
    elif mid == 'tanque_expansion':
        m.tube_y(0, 0, H * 0.08, H * 0.83, w * 0.86, d * 0.85, n=12, side=9, cap=1)
        m.tube_y(0, 0, H * 0.81, H * 0.91, w * 0.76, d * 0.76, n=12, side=1, cap=2)
        m.tube_y(0, 0, H * 0.9, H * 0.99, w * 0.11, d * 0.12, n=8, side=4, cap=2)
        m.box(-w * 0.45, w * 0.45, H * 0.38, H * 0.67, d * 0.84, d * 0.94, front=0, side=2)
        for x in (-w * 0.5, w * 0.5):
            m.box(x - w * 0.12, x + w * 0.12, 0, H * 0.08, -d * 0.19, d * 0.19, side=2)
    elif mid == 'bomba_recirculacion':
        m.box(-w * 0.91, w * 0.91, 0, H * 0.18, -d * 0.78, d * 0.79, front=2, side=3, top=2)
        m.tube_x(-w * 0.72, w * 0.28, H * 0.57, 0, H * 0.22, d * 0.53, n=10, side=1, cap=1)
        m.tube_x(-w * 0.78, -w * 0.69, H * 0.57, 0, H * 0.24, d * 0.57, n=8, side=2, cap=3)
        m.box(-w * 0.55, w * 0.12, H * 0.37, H * 0.76, d * 0.41, d * 0.66, front=0, side=2)
        m.ring_xy(w * 0.45, H * 0.56, d * 0.2, d * 0.65, min(w * 0.35, H * 0.23), min(w * 0.21, H * 0.13), n=10, front=4)
        m.tube_y(w * 0.47, 0, H * 0.65, H * 0.92, w * 0.13, d * 0.16, n=8, side=5, cap=4)
        for x in (-w * 0.35, -w * 0.15, w * 0.05):
            m.box(x - w * 0.025, x + w * 0.025, H * 0.72, H * 0.77, -d * 0.48, d * 0.38, front=2, side=3)
    elif mid == 'colector_tuberias':
        z = 0.08
        m.box(-w * 0.93, w * 0.93, H * 0.1, H * 0.87, z, z + D * 0.22, front=0, side=2)
        for y, t in [(H * 0.72, 5), (H * 0.33, 10)]:
            m.box(-w * 0.91, w * 0.91, y - H * 0.034, y + H * 0.034, z + D * 0.24, z + D * 0.52, front=t, side=4)
        for i in range(6):
            x = -w * 0.75 + i * (w * 1.5 / 5)
            m.box(x - W * 0.019, x + W * 0.019, H * 0.33, H * 0.72, z + D * 0.37, z + D * 0.55, front=5, side=4)
            m.box(x - W * 0.06, x + W * 0.06, H * 0.55, H * 0.59, z + D * 0.55, z + D * 0.7, front=4, side=2)
        m.box(-w * 0.62, w * 0.62, H * 0.02, H * 0.12, z + D * 0.23, z + D * 0.4, front=7, side=2)
    elif mid == 'panel_control_caldera':
        z = 0.08
        m.box(-w * 0.96, w * 0.96, H * 0.01, H * 0.95, z, z + D * 0.67, front=0, side=2)
        m.box(-w * 0.78, w * 0.78, H * 0.51, H * 0.81, z + D * 0.67, z + D * 0.86, front=14, side=2)
        m.box(-w * 0.78, w * 0.78, H * 0.22, H * 0.44, z + D * 0.67, z + D * 0.77, front=0, side=2)
        for x, t in [(-w * 0.51, 11), (0, 12), (w * 0.51, 9)]:
            m.box(x - w * 0.115, x + w * 0.115, H * 0.36, H * 0.4, z + D * 0.77, z + D * 0.94, front=t, side=3)
        m.box(-w * 0.64, -w * 0.25, H * 0.07, H * 0.15, z + D * 0.67, z + D * 0.84, front=4, side=3)
    else:
        raise ValueError(mid)
    return m

def force_nearest(path):
    data = path.read_bytes()
    ln, typ = struct.unpack_from('<II', data, 12)
    assert typ == 1313821514
    obj = json.loads(data[20:20 + ln])
    assert len(obj['textures']) == 1
    obj['samplers'] = [dict(magFilter=9728, minFilter=9984, wrapS=33071, wrapT=33071)]
    obj['textures'][0]['sampler'] = 0
    enc = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    enc += b' ' * (-len(enc) % 4)
    raw = bytearray(data[:12])
    raw += struct.pack('<II', len(enc), 1313821514) + enc + data[20 + ln:]
    struct.pack_into('<I', raw, 8, len(raw))
    path.write_bytes(raw)

def run():
    catalog = []
    for mid, name, mount, w, h, d, mountft, description, kind in SPEC:
        img = texture(mid)
        img.save(R / 'texturas' / f'{mid}.png', optimize=True)
        mesh = build(mid, w * FT, h * FT, d * FT)
        path = R / 'modelos_glb' / f'{mid}.glb'
        geom = mesh.export(path, img)
        force_nearest(path)
        catalog.append(dict(id=mid, name=name, description=description, category='Sala de calderas', placement=mount, widthFt=w, heightFt=h, depthFt=d, mountHeightFt=mountft, blocksMovement=mount != 'wall', type='misc', status='visual_only', glb=f'modelos_glb/{mid}.glb', thumbnail=f'miniaturas/{mid}.png', texture=f'texturas/{mid}.png', triangles=len(geom.faces), front='+Z', metersPerFoot=FT, geometryBackMinMeters=0.08 if mount == 'wall' else None, requiresServiceLogic=False, kind=kind))
        print(mid, len(geom.faces), 'triángulos', [round(float(x), 3) for x in geom.bounds[0]], [round(float(x), 3) for x in geom.bounds[1]])
    (R / 'catalogo_calderas.json').write_text(json.dumps({'schema': 'forest-horror-boilers-catalog-v1', 'kit': 'agua-02-calderas', 'version': 1, 'models': catalog}, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    (R / 'reporte_geometria.json').write_text(json.dumps({'modelos': 8, 'triangulosTotal': sum((c['triangles'] for c in catalog)), 'triangulosMaximo': max((c['triangles'] for c in catalog))}, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
if __name__ == '__main__':
    run()