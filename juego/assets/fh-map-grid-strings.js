window.FH_MAP_GRID_TEXT=Object.freeze({
 noReference:'Sin referencia',title:'Cuadrícula y escala',
 gridHint:'El mapa define sus columnas y filas. Las casillas son cuadradas; la imagen de referencia se ajusta por separado.',
 nominal:'Píxeles por casilla cuadrada',
 metrics:(columns,rows,pixels)=>`${columns} columnas × ${rows} filas = ${columns*rows} casillas. Cada casilla mide ${pixels} × ${pixels} px.`,
 referenceTitle:'Imagen de referencia',referenceHint:'La imagen solo sirve como guía del editor. Puedes ocultarla o quitarla sin cambiar paredes, muebles ni coordenadas. Conserva sus proporciones.',
 importReference:'Importar imagen',exampleReference:'Usar imagen de ejemplo',visible:'Mostrar referencia en el editor',
 referenceWidth:'Ancho de la imagen (casillas)',referenceX:'Desplazar imagen X (casillas)',referenceY:'Desplazar imagen Y (casillas)',
 opacity:'Opacidad de la referencia',remove:'Quitar referencia',apply:'Aplicar',close:'Cerrar',
 imported:'Imagen importada como referencia. La cuadrícula conserva sus medidas.',
 exportTooLarge:'El mapa es demasiado grande para exportar PNG en este dispositivo.',
 help:'Los mapas nuevos tienen 40 × 40 casillas cuadradas. Puedes cambiar columnas y filas. La imagen de fondo es una guía opcional: impórtala, escálala, desplázala, ocúltala o quítala desde Imagen de referencia.'
});
