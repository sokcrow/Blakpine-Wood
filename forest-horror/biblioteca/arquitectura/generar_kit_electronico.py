"""Genera únicamente los cuatro modelos visuales del Kit 03.
Importa el constructor estructural existente; no regenera ni reemplaza GLB 01/02.
"""
import json
import struct
from pathlib import Path

import trimesh
from PIL import Image, ImageDraw
from trimesh.visual.material import PBRMaterial
from generar_kit import Build, glb_nearest, WIDTH, DOOR_H, FRAME_H

ROOT = Path(__file__).resolve().parent
NEW = ("puerta_electronica_reja", "puerta_electronica_opaca", "teclado_pin", "lector_tarjeta")
(ROOT / "modelos_glb").mkdir(exist_ok=True)
(ROOT / "texturas").mkdir(exist_ok=True)

def texture(name):
    im = Image.new("RGBA", (128, 128), (27, 33, 37, 255))
    d = ImageDraw.Draw(im)
    grid = name == "puerta_electronica_reja"
    door = name.startswith("puerta_")
    d.rectangle((0, 0, 63, 95), fill="#4c5b61" if grid else "#58626a")
    if door:
        for y in range(4, 95, 8):
            d.line((2, y, 61, y), fill="#465157", width=1)
            d.line((5, y + 1, 5, y + 3), fill="#879195", width=1)
        if not grid:
            d.rectangle((5, 8, 57, 86), outline="#2a353b", width=3)
            d.line((9, 12, 54, 12), fill="#9eaaa5", width=1)
            for y in (25, 43, 64, 78):
                d.line((11, y, 51, y), fill="#77848a", width=1)
        else:
            for x in (11, 25, 39, 53):
                d.line((x, 3, x, 93), fill="#818a8a", width=1)
    else:
        d.rectangle((3, 4, 60, 91), fill="#243238", outline="#b3b7ae", width=2)
        if name == "teclado_pin":
            d.rectangle((9, 10, 54, 29), fill="#173a33", outline="#78958d", width=1)
            d.text((16, 14), "----", fill="#a0e0a2")
            for row in range(4):
                for col in range(3):
                    x, y = 10 + col * 16, 36 + row * 12
                    d.rectangle((x, y, x + 11, y + 9), fill="#67777b", outline="#a1aaa5", width=1)
                    d.text((x + 3, y), "123456789*0#"[row * 3 + col], fill="#e1e4ce")
            d.ellipse((47, 7, 52, 12), fill="#8b2824")
        else:
            d.rectangle((10, 12, 54, 26), fill="#0d1d23", outline="#799899")
            d.rectangle((16, 39, 48, 46), fill="#10191b", outline="#a6aba7")
            d.arc((15, 49, 49, 74), 180, 360, fill="#78aaa2", width=2)
            d.arc((21, 55, 43, 70), 180, 360, fill="#78aaa2", width=2)
            d.rectangle((15, 79, 49, 84), fill="#3e7265")
            d.rectangle((44, 5, 53, 10), fill="#afc777")
    d.rectangle((64, 0, 95, 95), fill="#344349")
    for x in (66, 68, 91, 93):
        d.line((x, 0, x, 95), fill="#829094", width=1)
    for y in range(5, 95, 11):
        d.line((69, y, 90, y), fill="#243136")
    d.rectangle((96, 0, 127, 95), fill="#9ba6a5")
    for y in range(0, 95, 7):
        d.line((97, y, 126, y), fill="#5b7378")
    d.rectangle((0, 96, 63, 127), fill="#0f2128")
    d.rectangle((64, 96, 127, 127), fill="#183e3d")
    for x in (78, 108):
        d.line((x, 98, x + 12, 126), fill="#477477", width=2)
    im.save(ROOT / "texturas" / (name + ".png"))
    return im

def frame():
    f = Build()
    f.box(.045, FRAME_H / 2, 0, .09, FRAME_H, .15, faces=(64, 0, 95, 95))
    f.box(WIDTH - .045, FRAME_H / 2, 0, .09, FRAME_H, .15, faces=(64, 0, 95, 95))
    f.box(WIDTH / 2, FRAME_H - .042, 0, WIDTH, .084, .15, faces=(64, 0, 95, 95))
    return f

def handle(leaf, grated=False):
    for side in (-1, 1):
        leaf.box(WIDTH - .235, 1.015, side * .072, .10, .155, .035, faces=(96, 0, 127, 95))
        leaf.box(WIDTH - .235, 1.015, side * .125, .065, .080, .070, faces=(96, 0, 127, 95))
    if grated:
        leaf.box(WIDTH - .245, .72, 0, .13, .50, .10, faces=(64, 0, 95, 95))

def door_model(name, material):
    f = frame()
    leaf = Build()
    grated = name.endswith("_reja")
    if grated:
        for x in (0.115, .29, .465, .64, .815, .99, 1.165, 1.34, WIDTH - .11):
            leaf.box(x, DOOR_H / 2, 0, .041, DOOR_H - .10, .07, faces=(64, 0, 95, 95))
        for y in (.10, .80, 1.45, DOOR_H - .10):
            leaf.box(WIDTH / 2, y, 0, WIDTH - .16, .055, .078, faces=(64, 0, 95, 95))
    else:
        leaf.box(WIDTH / 2, DOOR_H / 2, 0, WIDTH - .16, DOOR_H, .065, faces=(0, 0, 63, 95))
        for y in (.18, DOOR_H - .18):
            leaf.box(WIDTH / 2, y, .036, WIDTH - .2, .038, .016, faces=(96, 0, 127, 95))
        for x in (.12, WIDTH - .12):
            leaf.box(x, DOOR_H / 2, .04, .018, DOOR_H - .17, .017, faces=(64, 0, 95, 95))
    handle(leaf, grated)
    scene = trimesh.Scene()
    scene.add_geometry(f.geom("MARCO_FIJO", material), node_name="MARCO_FIJO", geom_name="MARCO_FIJO")
    scene.add_geometry(leaf.geom("HOJA_PIVOTE", material), node_name="HOJA_PIVOTE", geom_name="HOJA_PIVOTE")
    return scene

def reader_model(name, material):
    scene = trimesh.Scene()
    body = Build()
    width, height, depth = (.145, .265, .044) if name == "teclado_pin" else (.125, .23, .043)
    body.box(0, height / 2, 0, width, height, depth, faces=(64, 0, 95, 95))
    body.box(0, height / 2, depth / 2 + .002, width - .022, height - .024, .008,
             faces=(0, 0, 63, 95), trim=(64, 0, 95, 95))
    scene.add_geometry(body.geom("PANEL_ACCESO", material),
                       node_name="PANEL_ACCESO", geom_name="PANEL_ACCESO")
    return scene

def generate():
    report = []
    for name in NEW:
        image = texture(name)
        material = PBRMaterial(name="PIXEL_ART_NEAREST", baseColorTexture=image,
                               metallicFactor=0, roughnessFactor=.94, doubleSided=False)
        scene = door_model(name, material) if name.startswith("puerta_") else reader_model(name, material)
        glb = glb_nearest(scene.export(file_type="glb"))
        (ROOT / "modelos_glb" / (name + ".glb")).write_bytes(glb)
        length = struct.unpack_from("<I", glb, 12)[0]
        gltf = json.loads(glb[20:20 + length])
        count = sum(len(mesh.faces) for mesh in trimesh.load(
            ROOT / "modelos_glb" / (name + ".glb"), force="scene").dump())
        report.append({"id": name, "triangles": count, "meshes": len(gltf["meshes"])})
        print(name, count, "triángulos")
    (ROOT / "reporte_arquitectura_03.json").write_text(
        json.dumps({"models": report}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    generate()
