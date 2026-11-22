# D&D — reglamento de la partida piloto

**Referencia de reglas:** System Reference Document 5.2.1 (mecánicas revisadas de 2024). Publicación oficial: https://www.dndbeyond.com/srd

Las reglas procedentes del SRD 5.2.1 se utilizan de acuerdo con **Creative Commons Attribution 4.0 International (CC BY 4.0)**: https://creativecommons.org/licenses/by/4.0/

Este proyecto no está afiliado ni respaldado por Wizards of the Coast. La implementación y sus pruebas son propias de Blakpine-Wood. No se reproducen aquí los textos completos del SRD.

## Contrato de personaje

- `fh-dnd-sheet.js`: seis características, modificadores, competencia por nivel, 18 habilidades, seis salvaciones, CA, iniciativa, velocidad, PG, dados de golpe, ataques y recursos **por característica de clase**. La ficha está completamente separada de `FHCharacterCore` (Legacy).
- `fh-dnd-combat.js`: ataque d20 contra CA, fallo natural 1, crítico natural 20 (doble dado), daño con tipo, resistencia, vulnerabilidad e inmunidad. Todas las tiradas del daño se originan en el coordinador. No existe una reserva universal de PE.
- `fh-dnd-engine.js`: partida piloto en 3D. Usa solo la ficha DnD, presenta habilidades y salvaciones, y permite atacar al blanco de entrenamiento sin destruirlo.
- `fh-dnd-save-adapter.js`: persiste `GameState.dnd` y puede importar viejos guardados v1 del prototipo, descartando cualquier propiedad `energy` / `energyCost` ficticia y datos de Sombras Legacy.

## Ficha inicial para probar el mapa

Se utiliza **Guerrero nivel 1, trasfondo Soldado**, matriz estándar con ajustes de +2 Fuerza y +1 Constitución. PG 12, CA 17 (cota de malla y estilo Defensa), velocidad 30 pies, competencia +2. El ataque inicial usa **mayal, +5 para impactar y 1d8+3 contundente**. Los atributos y las competencias se consultan desde la ficha D&D; ni los PG ni las tiradas proceden de atributos Legacy.

El personaje gráfico del motor compartido y el mapa siguen siendo reutilizables. La identidad y el guardado del piloto tienen espacio de claves propio de DnD.

## Qué NO está terminado

Esta entrega es una **prueba de exploración y tiradas DnD**, no un emulador íntegro de todos los personajes ni un reemplazo de las reglas.

- No hay todavía creador completo de las doce clases, dotes elegibles, progresión ni magias de nivel superior.
- Los rasgos de clase y origen (Segundo aliento, Ataque salvaje, maestrías de armas) **se registran pero sus acciones especiales aún no se ejecutan**.
- Las tiradas de salvación y habilidad admiten CD y ventaja/desventaja en el núcleo, pero el menú piloto no interpreta automáticamente todos los peligros y condiciones del mapa.
- El manejo de turnos, reacciones, condiciones, cobertura, visión en oscuridad, concentración, ranuras de conjuro y hechizos se incorporará a cada sistema DnD con pruebas propias.
- El pack de luces medievales proviene del PR #227. Sus modelos, combustible y radios son compartidos; fuego, humo, temperatura y propagación de incendio NO se consideran implementados por esta ficha.

**Prueba de navegador pendiente:** iniciar Villa medieval + DnD, entrar sin pasar por el creador Legacy, ver la ficha oficial, lanzar pruebas de habilidades/salvaciones, atacar al dummy, interactuar con las nueve luces, cerrar/reabrir y verificar guardado.
