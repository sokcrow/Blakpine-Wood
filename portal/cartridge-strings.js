export const C = Object.freeze({
 previewUnavailable:'La prueba 3D del cartucho se habilitará al integrar la sesión del anfitrión. Puedes usar la prueba 3D del editor independiente.',
 leaveUnsaved:'Hay cartuchos con cambios sin exportar o con errores de recuperación. ¿Cerrar sesión y descartar las copias de trabajo en memoria? Las recuperaciones que sí se guardaron seguirán en este navegador.',
 title:'Mapas del mundo', intro:'Biblioteca local del DM. Exporta el cartucho para llevarlo a otro equipo. La sala 3D todavía no sincroniza el mundo.',
 create:'Crear cartucho', open:'Abrir cartucho existente', add:'Crear mapa en el editor', importMap:'Importar mapa JSON',
 edit:'Editar', rename:'Cambiar nombre', save:'Guardar mapa en cartucho de trabajo', close:'Volver a la biblioteca',
 export:'Exportar cartucho', empty:'Este cartucho aún no contiene mapas.', name:'Nombre del mapa', defaultName:'Mapa nuevo',
 unsaved:'Hay cambios sin respaldar en un cartucho exportado.', backed:'Cartucho sin cambios desde la última apertura o solicitud de exportación.',
 download:'Descarga del cartucho solicitada. Comprueba que el archivo se guardó en tu equipo.',
 working:'Mapa guardado en el cartucho de trabajo. Todavía debes exportar el archivo.',
 replace:'¿Sustituir el cartucho de trabajo actual? Exporta primero los cambios que quieras conservar.',
 overwrite:'¿Guardar los cambios en este mapa? Se actualizará únicamente el mapa seleccionado.',
 loading:'Preparando el editor existente…', error:'No se pudo completar la operación. El cartucho actual se conserva. ',
 invalid:'Archivo o mapa incompatible, corrupto o demasiado grande para la memoria disponible.',
 access:'La sesión ya no tiene permiso de DM para una campaña Blakpine activa.',
 editorError:'No se pudo preparar el editor. Recarga la página o exporta el cartucho de trabajo.',
 recovery:'Guardado de recuperación local', exported:'Cartucho exportado a archivo',
 noStorage:'No se pudo guardar la recuperación local. Exporta el cartucho ahora. ',
 newer:'Existe una recuperación local diferente y más reciente o con una revisión en conflicto. ¿Quieres recuperarla? Cancelar conserva el archivo abierto.',
 recover:'Recuperar instantánea local', persistence:'Solicitar almacenamiento persistente',
 persistentYes:'El navegador concedió persistencia; conserva también una copia exportada.',
 persistentNo:'El navegador no garantizó persistencia. Conserva una copia exportada.',
 recoveryNone:'No hay una instantánea válida para esta cuenta y campaña.',
 recoveryDiscard:'La instantánea más reciente no es válida; se ofrece su predecesora validada.',
 recoveryFailed:'No se pudo validar la recuperación. El archivo abierto se conserva.',
 fileExtension:'Selecciona un archivo .lumen.json.',
 revision:'Revisión', maps:'mapas', editorDirty:'Cambios del editor pendientes de guardar en el cartucho.',
 localPending:'La recuperación local todavía no se ha guardado.',
});
export function cartridgeError(error) {
 if (/ACCESS|IDENTITY/.test(error?.message || '')) return C.access;
 if (/MAP_VALIDATOR|EDITOR/.test(error?.message || '')) return C.editorError;
 return C.invalid;
}

export function recoveryError(error) {
 const code=error?.code||error?.message||'';
 return /QUOTA/.test(code)?'Se agotó la cuota del navegador.':
 /CONFLICT/.test(code)?'Otra pestaña guardó una revisión distinta. Exporta tu copia antes de abrir una recuperación.':
 /PERMISSION/.test(code)?'El navegador denegó el acceso al almacenamiento.':
 /BLOCKED/.test(code)?'Otra pestaña bloquea la apertura del almacenamiento.':
 'El almacenamiento del navegador no está disponible.';
}
