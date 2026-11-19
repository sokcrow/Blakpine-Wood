// Mantener el editor en su ubicación conserva rutas, assets y guardados Legacy.
if (new URLSearchParams(location.search).get('editor') !== '1') {
 location.replace(new URL('./portal/', location.href).href);
}
