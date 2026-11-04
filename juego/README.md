# Blakpine Wood · Forest Horror (versión web)

Esta carpeta publica el editor de mapas Forest Horror y su motor de prueba 3D integrado. Abrir **index.html** en un servidor HTTP permite usar **▶ Probar 3D** directamente sobre el mapa editado.

## Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**. Luego abre:

https://sokcrow.github.io/Blakpine-Wood/juego/

Si GitHub Pages ya está activo, solo hace falta esperar a que se despliegue el commit.

## Archivos

- `index.html`: interfaz, editor y código del juego original, sin modificar sus funciones.
- `assets/images.js`: imágenes que estaban embebidas en el HTML original.
- `assets/engine-00.js` a `engine-12.js`: fragmentos ordenados del motor 3D original codificado en Base64. **Deben permanecer en orden**. Se ensamblan automáticamente al abrir la página.

Los cambios de empaquetado evitan una sola transferencia de 12.7 MB al registrar archivos en GitHub; no cambian el esquema `forest-horror-map-v1`, los mapas, las colisiones ni la lógica del motor.

**Estado:** versión para un navegador. Los mapas y partidas se guardan localmente en cada dispositivo; **no existe todavía un servidor multijugador ni sincronización en tiempo real**.

La biblioteca adicional `Forest_Horror_Biblioteca_Completa_Pack06_Seguridad.zip` se mantiene como recurso separado, pendiente de integración con el motor. El editor y la prueba 3D no cargan automáticamente sus GLB.
