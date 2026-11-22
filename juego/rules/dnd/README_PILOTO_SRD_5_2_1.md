# D&D — fichas de personaje y pruebas en el motor 3D

**Referencia de reglas:** System Reference Document 5.2.1 (mecánicas revisadas de 2024). Publicación oficial: https://www.dndbeyond.com/srd

Las reglas procedentes del SRD 5.2.1 se utilizan de acuerdo con **Creative Commons Attribution 4.0 International (CC BY 4.0)**: https://creativecommons.org/licenses/by/4.0/

Este proyecto no está afiliado ni respaldado por Wizards of the Coast. La implementación y sus pruebas son propias de Blakpine-Wood. No se reproducen aquí los textos completos del SRD.

## Contrato de personaje

- `fh-dnd-sheet.js`: seis características, modificadores, competencia por nivel, 18 habilidades, seis salvaciones, CA, iniciativa, velocidad, PG, dados de golpe, ataques y recursos **por característica de clase**. La ficha está completamente separada de `FHCharacterCore` (Legacy).
- `fh-dnd-combat.js`: ataque d20 contra CA, fallo natural 1, crítico natural 20 (doble dado), daño con tipo, resistencia, vulnerabilidad e inmunidad. Todas las tiradas del daño se originan en el coordinador. No existe una reserva universal de PE.
- `fh-dnd-engine.js`: partida 3D del usuario. Lee la ficha DnD elegida, presenta habilidades y salvaciones, y permite atacar al blanco de entrenamiento sin destruirlo.
- `juego/assets/fh-dnd-character-manager.js`: selección y formulario manual de fichas. Permite crear, modificar y elegir personajes distintos, sin forzar una clase ni utilizar `FHCharacterCore`.
- `fh-dnd-save-adapter.js`: persiste `GameState.dnd` y puede importar viejos guardados v1 del prototipo, descartando cualquier propiedad `energy` / `energyCost` ficticia y datos de Sombras Legacy.

## Personajes y apertura de partida

Al iniciar **Villa medieval + D&D**, la página abre el selector de personajes D&D. Puedes crear una ficha o elegir otra previamente guardada. Cada ficha tiene un ID D&D y un guardado de partida independiente, incluso en el mismo mapa.

El formulario permite definir manualmente nombre, clase (Bárbaro, Bardo, Clérigo, Druida, Guerrero, Monje, Paladín, Explorador, Pícaro, Hechicero, Brujo o Mago), nivel, seis características, PG, CA, velocidad, dados de golpe, competencias en salvaciones y habilidades, ataques, rasgos y datos de conjuros en JSON. **No asigna automáticamente una clase ni valores de un Guerrero.** Los valores son responsabilidad de quien crea la partida; la interfaz no es un asistente completo de generación de personajes conforme al SRD.

`createPilot()` permanece como **fixture de pruebas automáticas exclusivamente**; nunca se utiliza para arrancar una partida D&D. El motor permite fichas válidas de personajes D&D también en `GameState.dnd.actors`, pero la automatización de NPC y sus IA queda fuera de este cambio.

El mundo, las luces GLB y el personaje visual siguen compartiendo el mismo motor 3D. Sólo cambian las reglas, los datos del personaje y su guardado. Al reabrir, la ficha definida por el usuario es la fuente de clase y atributos; el estado de la sesión conserva sus PG actuales y condiciones.

## Qué NO está terminado

Esta entrega permite **abrir partidas propias con fichas distintas y probar el motor 3D y las tiradas DnD**. No es todavía un VTT con todas las reglas automáticas.

- El formulario permite elegir cualquiera de las doce clases y editar datos manualmente, pero todavía **no** calcula automáticamente competencias de clase, dotes elegibles, progresión ni hechizos de nivel superior.
- Los rasgos de clase y origen se pueden registrar en la ficha, pero **sus acciones especiales aún no se ejecutan**.
- Las tiradas de salvación y habilidad admiten CD y ventaja/desventaja en el núcleo, pero el HUD no interpreta automáticamente todos los peligros y condiciones del mapa.
- El manejo de turnos, reacciones, condiciones, cobertura, visión en oscuridad, concentración, ranuras de conjuro y hechizos se incorporará a cada sistema DnD con pruebas propias.
- El pack de luces medievales proviene del PR #227. Sus modelos, combustible y radios son compartidos; fuego, humo, temperatura y propagación de incendio NO se consideran implementados por esta ficha.

**Prueba de navegador pendiente:** iniciar Villa medieval + DnD, seleccionar una ficha creada, verificar nombre y clase en HUD, probar salvaciones y ataques, usar luces, cerrar/reabrir y verificar guardado independiente.
