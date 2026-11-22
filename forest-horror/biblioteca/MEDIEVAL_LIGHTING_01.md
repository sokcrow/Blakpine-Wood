# Blakpine Wood — Iluminación medieval funcional (DnD)

## Alcance

El editor **común** reconoce nueve luminarias en la pestaña **Luz** cuando el
reglamento de la campaña es `dnd`. Las luminarias modernas siguen disponibles en Legacy
y Moon, pero no aparecen entre las herramientas de DnD. El catálogo general de muebles
continúa existiendo; las luminarias se colocan con su herramienta de luz y tipo
`light_fixture`, nunca desde la sección `Muebles`.

| Luminaria | ID GLB | Luz brillante | Luz tenue adicional | Combustible inicial |
| --- | --- | ---: | ---: | ---: |
| Antorcha de pared | `antorcha_pared_medieval` | 20 ft | 10 ft | 60 minutos |
| Antorcha de mano | `antorcha_mano_medieval` | 20 ft | 10 ft | 60 minutos |
| Vela | `vela_medieval` | 5 ft | 5 ft | 120 minutos |
| Candelabro | `candelabro_medieval` | 10 ft | 5 ft | 180 minutos |
| Farol de aceite | `farol_aceite_medieval` | 15 ft | 10 ft | 240 minutos |
| Brasero | `brasero_medieval` | 20 ft | 10 ft | 180 minutos |
| Fogata | `fogata_medieval` | 25 ft | 15 ft | 120 minutos |
| Chimenea | `chimenea_medieval` | 20 ft | 10 ft | 240 minutos |
| Cristal mágico | `cristal_magico_medieval` | 30 ft | 15 ft | Permanente |

Estos valores son configurables por el creador al colocar la luminaria; **no se afirma
que sean reglas oficiales de D&D**. Se usan los pies, luz brillante, franja tenue y
obstrucción reales del sistema de visibilidad ya existente en Blakpine Wood.

## Funcionamiento real

- `FHLights.resolve` lee la luminaria desde la misma estructura que las luces modernas.
  `FHMedievalRuntime.lit` determina si está encendida y tiene combustible, sin requerir
  breaker, circuito eléctrico o suministro de energía.
- `FHLightCoverage` conserva paredes, puertas y ángulos de visión. En 3D se reutiliza
  el pool de luces dinámicas **limitado por el motor**; no se crea una `PointLight`
  independiente por llama ni se reescriben colisiones o Fog of War.
- Las luminarias admiten encender/apagar por la interacción `use` existente. El consumo
  avanza por **minutos del reloj del juego**, nunca por FPS, y solo cuando están encendidas.
- Al agotarse una fuente, deja de aportar luz. Se puede reabastecer consumiendo un
  ítem compatible que **ya exista en el inventario de partida**:
  `resina_antorcha`, `cera_vela`, `aceite_lampara` o `lena`.
  No se inventa un catálogo de comercio ni se regalan consumibles.
- El cristal mágico no consume combustible, pero se puede apagar o encender.
- La antorcha de mano se recoge con su interacción y se convierte en fuente luminosa
  dinámica ligada a las coordenadas reales del personaje; se puede soltar mediante el
  botón táctil **Soltar antorcha**. La posición del objeto de la partida se actualiza
  en el suelo de origen, sin alterar el JSON del mapa editado. Por ahora, solamente
  puede soltarse en la **misma planta** donde fue recogida.
- El estado de encendido, cantidad restante y si está cargada la antorcha se guardan
  en `GameState.medievalLighting` y se recuperan en la partida.

## Geometría y carga

- Nueve GLB independientes GLB 2.0, texturas pixel art 64×64 incrustadas y
  nueve miniaturas PNG transparentes 64×64.
- La suma original es **988 triángulos**. Se reutiliza `FHAssets.attach` para
  cargar los modelos y su FOW; los datos de escala siguen en pies en el catálogo.
- El renderizado conserva un pool acotado de luces dinámicas. **No hay benchmark FPS
  validado**: probar en Chromium y móvil con varias decenas de luces.

## Límites explícitos

- La biblioteca de mapas DnD ya admite colocar y guardar los objetos; el **modo jugable
  DnD del portal sigue sin estar habilitado** hasta que se cierre su adaptador de partida.
  El módulo 3D queda preparado para cargarse cuando se ejecute ese motor.
- No se han implementado daño por fuego, propagación de incendios, calor ambiental,
  partículas o humo. El alcance, oclusión, activación, combustible e interacción sí tienen
  estado y lógica real.
- La carga de combustible requiere un ítem ya existente en la partida. Crear esos
  consumibles y conseguirlos por comercio o fabricación corresponde al inventario general,
  no a esta integración.
- El selector conserva la iluminación eléctrica y los mapas anteriores de Legacy/Moon.

Pruebas reproducibles: `node --test tests/dnd-medieval-lighting.test.cjs`.
