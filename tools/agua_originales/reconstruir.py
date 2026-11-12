#!/usr/bin/env python3
"""Reconstrucción reproducible SOLO en GitHub Actions de GLB/PNG del ZIP del autor.
No instala ni modifica nada en el equipo del usuario.
Las fuentes comprimidas son transcripciones reversibles de los generadores
entregados en Agua 02 y Agua 03. Cada GLB/PNG se valida contra el SHA256 original.
"""
from __future__ import annotations
from pathlib import Path
import base64
import hashlib
import lzma
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
LIBRARY = ROOT / 'forest-horror/biblioteca/agua'

GENERATORS = (
    ('calderas', 'calderas', 'generar_calderas.py', 8320),
    ('calderas', 'mini_calderas', 'crear_miniaturas.py', 2840),
    ('almacenamiento', 'almacenamiento', 'generar_almacenamiento.py', 6744),
    ('almacenamiento', 'mini_almacenamiento', 'crear_miniaturas.py', 3056),
)
SHAS = {
'calderas/miniaturas/bomba_recirculacion.png': '37454db658af35fe1068d7439d07774e401fc580cfcb36a5e2111b163bdada3c',
'calderas/miniaturas/caldera_industrial_grande.png': '96ef6cbc870016dc7345c1adaea2fabb97a9bc43e9a99da57a9806d1cfea5fb4',
'calderas/miniaturas/caldera_residencial_mediana.png': '36ec9e3d1dfe7c79c4bc82fd7c7d6ae9c84d080cd5f6ca936bda0835bd836a06',
'calderas/miniaturas/calentador_domestico_horizontal.png': '547af26db2a775f17281a4dbda491b8b21dc5708383491006662c6d956c1f2cc',
'calderas/miniaturas/calentador_domestico_vertical.png': '7fc869bf1182b9d168d14c61fd6173ddb2597f71cd60681786427bad5ab4414c',
'calderas/miniaturas/colector_tuberias.png': 'ab0193b5a3039d853a472ebe18b3a8635a777cdeaf36cce8a247b3cabd864e60',
'calderas/miniaturas/panel_control_caldera.png': '52698f368604ae42c7300703475cc80d859bbf6e1f183e12a2f3fe428e823dac',
'calderas/miniaturas/tanque_expansion.png': '3fc7b7d808c1a7f6b06923f06f521913828f399d09c124f272f94f36d86166dd',
'calderas/modelos_glb/bomba_recirculacion.glb': 'f0072d75adfd2a341ac806610b179ad651f00204cb60a265395bfb8102cecfeb',
'calderas/modelos_glb/caldera_industrial_grande.glb': '76acce7ce6da37d09c1f48463435b59a4c71b6a4ddd66e346fb6de23a50569d6',
'calderas/modelos_glb/caldera_residencial_mediana.glb': 'e22d0c93e85a51bc4e9ea508f3f0ad673d3a16e791aca51b45e08375a5e8ec1a',
'calderas/modelos_glb/calentador_domestico_horizontal.glb': '33f307680c6a31c2e9349bb7f5cefad293f660fa23729b61cc4c8fc498d070a2',
'calderas/modelos_glb/calentador_domestico_vertical.glb': '55083a8ca7b2c269d9f3a27fdd693541e4986915386ef771038f4cf86fea57e7',
'calderas/modelos_glb/colector_tuberias.glb': '50f00d1a70446ab07b72c3f2d60c3e27a5d60d14eb80a4e98dbdbef00407d84b',
'calderas/modelos_glb/panel_control_caldera.glb': '6bf0d983f063bb58dc83131a9fe50474f5517890cf90c2d606cda169141e3cfb',
'calderas/modelos_glb/tanque_expansion.glb': '92d26aa8aa4a34780c0041bda4c2a386b4042a0eec3c844713afae9c3aef677e',
'almacenamiento/miniaturas/cisterna_principal.png': '96ed44288c38d094605b461a2227ab786084d0625b38f37057be333e06ffe34f',
'almacenamiento/miniaturas/tinaco_elevado.png': 'cc5f0f22c123ae18a1b62724614e804e1694d268b3d0d3b40230add30dd1a926',
'almacenamiento/modelos_glb/cisterna_principal.glb': '3dad10dd20eb58c3897706d57e16938dff45727809599b29e63edacb154090ab',
'almacenamiento/modelos_glb/tinaco_elevado.glb': 'da35ee1c2b5d9a530905b66b726d7d429aaa8d82965f154f4e59464f32a12539',
}

def main():
    for directory, prefix, script_name, expected_length in GENERATORS:
        files = sorted(SOURCE.glob(prefix + '_[0-9][0-9].b64'))
        if not files:
            raise ValueError('No se encontró la fuente '+prefix)
        encoded = ''.join(file.read_text(encoding='ascii').strip() for file in files)
        if len(encoded) != expected_length:
            raise ValueError(f'Fragmentos incompletos: {prefix}, {len(encoded)} != {expected_length}')
        script = lzma.decompress(base64.b64decode(encoded, validate=True))
        target_dir = LIBRARY / directory
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / script_name
        target.write_bytes(script)
        subprocess.run([sys.executable, str(target)], cwd=target_dir, check=True)
        print('GENERADO', prefix, script_name, len(script))
    for relative, expected in SHAS.items():
        file = LIBRARY / relative
        if not file.exists():
            raise AssertionError('FALTA GLB/PNG: '+relative)
        actual = hashlib.sha256(file.read_bytes()).hexdigest()
        if actual != expected:
            raise AssertionError(f'GLB/PNG distinto del ZIP original: {relative} {actual} != {expected}')
        print('ORIGINAL VALIDADO',relative)
    print(f'OK: {len(SHAS)} assets originales verificados por SHA256')

if __name__ == '__main__':
    main()
