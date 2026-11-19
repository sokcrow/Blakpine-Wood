# LUMEN — Identidad visual y portal

**Identidad aprobada por el Director (19-11-2026):** negro y dorado, atmósfera de fantasía oscura, emblema original dorado de LUMEN, vela sobre libro, ornamentación cuidada y sensación de plataforma de rol. El boceto visual compartido es la referencia de composición, **no un archivo para colocar como imagen de fondo**. Esta entrega recrea su jerarquía y controles en HTML/CSS/SVG.

## Identidad

- **Marca:** LUMEN — Lienzo Unificado de Mundos, Escenas y Narrativas. El emblema oficial, originalmente suministrado por el Director, se incorpora como `portal/assets/lumen-logo.webp` (miniatura web optimizada y transparente).
- **Colores:** negro `#090909`, negro profundo `#050505`, panel bronce `#130f0b`, dorado `#d9ad61`, reflejo oro `#f4d493`, bordes oro tenue `#9e7842`, texto marfil `#f0e6d3`.
- **Composición:** cabecera sobria con logo oficial; portada con título LUMEN, libro y vela dibujados en SVG decorativo; panel del flujo DM; tarjetas de tres sistemas; accesos a Mis partidas. Los controles son HTML, nunca clics falsos en un bitmap.
- **Tipografía:** Georgia como serif editorial local y system-ui para datos y formularios. Sin fuentes externas.
- **Componentes:** bordes dobles de oro oscuro, bajos contrastes decorativos detrás del contenido y acentos dorados sobre negro. Acciones principales con oro lleno; secundarias con contorno.
- **Accesibilidad:** enlaces reales, iconografía decorativa oculta a lectores de pantalla, foco visible, media queries móviles, soporte `prefers-reduced-motion`.
- **Rendimiento:** sin frameworks UI ni efectos animados. Logo original optimizado a WebP; escenas recreadas con CSS y SVG livianos.

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

## Fotografías de portada — fuentes externas (19-11-2026)

El Director asignó las fuentes originales de Imgur:
- Blakpine Wood: https://imgur.com/UBTsf5O
- DnD: https://imgur.com/8xZm7SO
- Moon System: https://imgur.com/SQSSary
- Logotipo LUMEN: https://imgur.com/c0Cf2Yc

El código intenta cargar sus rutas CDN `i.imgur.com` con los ID anteriores (`.jpg` para los modos, `.png` para el logotipo) y mantiene respaldos locales `portal/assets/mode-*.webp` y `lumen-logo.webp`. El CSP permite únicamente `https://i.imgur.com` además de archivos locales. **Los binarios originales no se descargaron al repositorio en este cambio**, ya que el acceso HTTP externo a Imgur no funcionó desde el entorno disponible. Las extensiones CDN son conjeturas convencionales y faltan verificar en navegador. No eliminar respaldos hasta confirmar cada imagen original y almacenar una copia autorizada en GitHub.
