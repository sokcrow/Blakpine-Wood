# LUMEN — Dirección visual del portal (propuesta)

**Estado:** PROPUESTA DE DISEÑO, no identidad de marca aprobada por el Director. Implementada en el PR #219 para revisión visual. Se conserva la separación técnica de reglamentos, cuentas y mapa.

## Producto y audiencia

LUMEN significa **Lienzo Unificado de Mundos, Escenas y Narrativas**. Es un espacio de trabajo para quienes dirigen campañas y para quienes se unen como jugadores. El usuario debe poder identificar sin esfuerzo tres tareas: **crear campaña**, **unirse con código** y **entrar a Mis partidas**.

El portal no es un juego de terror ni un editor 3D. Blakpine Wood, DnD y Moon System mantienen sus estéticas propias dentro del contenido, pero el contenedor LUMEN debe ser neutral y duradero.

## Lenguaje visual propuesto

- **Personalidad:** editorial, sólida, directa, de herramienta de producción. Sin paneles «vidrio», degradados arbitrarios, fondos de bosque decorativos o efectos que compitan con las funciones.
- **Color:** lona mineral `#f5f5f0`, papel `#fffefa`, tinta `#17251f`, texto secundario `#52635b`, verde profundo `#254d42`. Acento `#d1ed78` restringido al diagrama del recorrido; **no se asocia con ningún reglamento**.
- **Tipografía:** familia del sistema, títulos sans compactos con jerarquía de tamaño y peso; etiquetas de flujo en monoespaciada para evidenciar pasos. No descarga fuentes ni bloquea primera pintura.
- **Composición:** portada editorial con mensaje concreto a la izquierda y flujo funcional DM → invitación → grupo a la derecha. Sección de reglamentos claramente secundaria. Panel Mis partidas como área de trabajo, con acciones de creación e ingreso separadas y estados vacíos.
- **Marca:** logotipo tipográfico LUMEN. y símbolo de cuatro celdas; identifica un lienzo modular, no invoca un bosque o una franquicia particular. Es un identificador provisional construido en CSS, no un logotipo final registrado.
- **Interacción:** foco de teclado visible, controles de al menos 40–46 px, colores de estado diferenciados, mensajes de error legibles. Botones no operativos se mantienen deshabilitados con una explicación textual.
- **Responsive:** columnas de portada y paneles se apilan a 720px; cabecera y navegación permiten dos filas; pantalla mínima 320px. Sin menú oculto sin implementación.
- **Movimiento:** solo transiciones discretas en controles; respeta `prefers-reduced-motion`.

## Principios de contenido

- No presentar Moon como jugable. DnD se comunica como prototipo de D20, no edición aprobada.
- No presentar la sala DM-host como operativa antes de implementar el host.
- No fabricar reseñas, estadísticas de uso, campañas falsas ni miembros de muestra en producción.
- Todos los mensajes visibles del portal viven en `portal/strings.js`.

## Lista de verificación

### Comprobado mediante revisión del código
- Semántica `header/nav/main`, encabezados y enlaces de navegación.
- Clases de portada, área de trabajo y estados vacíos.
- `:focus-visible`, media query móvil y `prefers-reduced-motion`.
- Sin imports, SDK o componentes añadidos por esta tarea visual.

### Pendiente de validación en navegador
- Revisión de 320, 390, 768, 1280 y 1440 px.
- Acceso por teclado, mensajes de error de Firebase y flujos de formulario.
- Contraste y captura visual comparativa en entorno real.
- Aprobación de identidad y estilo por el Director.

**Fuera de alcance:** reglas Firestore, flujo Auth, guardados, motores, combate y multijugador.
