# LUMEN — Identidad visual y portal

**Identidad aprobada por el Director (19-11-2026):** negro y dorado, atmósfera de fantasía oscura, emblema original dorado de LUMEN, ilustración independiente como fondo del recuadro principal, ornamentación cuidada y sensación de plataforma de rol. El boceto visual compartido es la referencia de composición, **no un archivo para colocar como imagen de fondo**. Esta entrega recrea su jerarquía y controles en HTML/CSS/SVG.

## Identidad

- **Marca:** LUMEN — Lienzo Unificado de Mundos, Escenas y Narrativas. El emblema oficial, originalmente suministrado por el Director, se incorpora como `portal/assets/lumen-logo.webp` (miniatura web optimizada y transparente).
- **Colores:** negro `#090909`, negro profundo `#050505`, panel bronce `#130f0b`, dorado `#d9ad61`, reflejo oro `#f4d493`, bordes oro tenue `#9e7842`, texto marfil `#f0e6d3`.
- **Composición:** cabecera sobria con logo oficial; portada con título LUMEN, símbolo oficial discreto y arte de fondo separado; panel del flujo DM; tarjetas de tres sistemas; accesos a Mis partidas. Los controles son HTML, nunca clics falsos en un bitmap.
- **Tipografía:** Georgia como serif editorial local y system-ui para datos y formularios. Sin fuentes externas.
- **Componentes:** bordes dobles de oro oscuro, bajos contrastes decorativos detrás del contenido y acentos dorados sobre negro. Acciones principales con oro lleno; secundarias con contorno.
- **Accesibilidad:** enlaces reales, iconografía decorativa oculta a lectores de pantalla, foco visible, media queries móviles, soporte `prefers-reduced-motion`.
- **Rendimiento:** sin frameworks UI ni efectos animados. Logo original optimizado a WebP; ilustración de portada local y estilos CSS sin SVG de libro abierto.

## Identidad de los modos

- **Blakpine Wood:** horror contemporáneo, oscuridad y calidez rojiza, con el editor y la prueba 3D existentes.
- **DnD:** ilustración abstracta de combate y fuego; **solo prototipo**, nunca declarar 5e completa ni elección de edición.
- **Moon System:** **ciudad industrial/distópica, arquitectura vertical, tecnología desgastada y estructuras corporativas**; visualmente distinta de una luna astronómica. La atmósfera remite a las obras de Project Moon sin copiar personajes, ilustraciones o marcas. El reglamento Moon permanece en especificación, el modo no es jugable y sus sistemas de monedas/Power/Coin Power no se implementan aquí.

La definición técnica de Moon procede de `docs/REGLAS_MODO_MOON_SYSTEM.md`, con perfil distópico urbano. La referencia temática del Director no cambia reglas de combate.

## Pantallas cubiertas

1. **Inicio:** marca, registro, acceso, explicación breve, tres sistemas y tarjetas de navegación hacia Mis partidas.
2. **Registro, inicio de sesión, recuperación:** conservan Firebase Authentication; reciben colores y estilo visual.
3. **Mis partidas:** crear/unirse y campañas propias/de membresía conservan su contrato Firestore.
4. **Panel DM y sala de espera:** estilo compartido, acciones de sesión 3D siguen deshabilitadas hasta existir integración.

## Límites y pruebas

No se cambia `firestore.rules`, `firebaseConfig`, las operaciones sensibles de Firebase, el editor ni los motores de juego.

Esta implementación visual requiere inspección manual de navegador en resoluciones 320, 390, 768, 1280 y 1440 px, teclado y contraste en UI real. Las comprobaciones estáticas y de lógica no equivalen a una aceptación visual ni al recorrido con dos cuentas reales. El PR #219 continúa abierto hasta completar las condiciones de la Etapa 4.2.

## Ilustraciones definitivas de alta resolución

El Director proporcionó estos cuatro recursos originales y se incorporaron como archivos **locales** al repositorio:
- Blakpine Wood: `portal/assets/mode-blakpine.webp` (fuente: https://imgur.com/UBTsf5O).
- DnD: `portal/assets/mode-dnd.webp` (fuente: https://imgur.com/8xZm7SO).
- Moon System: `portal/assets/mode-moon.webp` (fuente: https://imgur.com/SQSSary).
- Fondo de la portada LUMEN: `portal/assets/lumen-hero.webp` (fuente: https://imgur.com/c0Cf2Yc).\n- Logotipo de LUMEN: `portal/assets/lumen-logo.webp`, restaurado del emblema dorado oficial suministrado anteriormente por el Director.

Las tres escenas de modos y la ilustración de portada se descargaron mediante GitHub Actions y quedaron como WebP en `main`. El emblema dorado oficial se restauró del archivo original del historial de Git. La página los consume mediante sus rutas locales existentes. Se retiró automáticamente el workflow temporal utilizado para esta única importación. No se mantienen dependencias de imágenes remotas.
