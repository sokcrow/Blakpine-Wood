# Iconos D&D (estadísticas)

Seis iconos PNG originales tomados del repositorio del mismo proyecto:
`sokcrow/Luminos-Character-Maker`, ruta `Assets/Icons/stats/`.

Correspondencias: `str` Fuerza, `dex` Destreza, `con` Constitución,
`int` Inteligencia, `wis` Sabiduría y `cha` Carisma.

Se incorporaron como blobs binarios idénticos (SHA Git original).
Se conservan los originales, sin dependencia externa en tiempo de ejecución.
`tests/dnd-visual-icons.test.cjs` comprueba formato y fidelidad de estos seis recursos.

También se incluyen los 18 PNG originales de `Assets/Icons/skills/`, en `skills/`.
Se reutilizan en la lista de habilidades de la ficha; las salvaciones reutilizan
los seis iconos de atributos. No hay modificaciones de imagen ni peticiones a
Luminos en tiempo de juego. `animalHandling` y `sleightOfHand` conservan sus
nombres de reglamento y se enlazan a `animal_handling.png` y `sleight_of_hand.png`.
