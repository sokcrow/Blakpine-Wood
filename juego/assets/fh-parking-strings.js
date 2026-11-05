/* Forest Horror · textos de estacionamiento (editor y vista). */
window.FH_PARKING_TEXT=Object.freeze({
 category:'Estacionamiento',settings:'Configurar marcas de piso',stall:'Cajones numerados',
 arrow:'Flecha de circulación',crosswalk:'Cebra peatonal',double_yellow:'Doble línea amarilla',
 dashed_yellow:'Línea amarilla discontinua',speed_bump:'Reductor de velocidad',curb:'Guarnición / banqueta',
 newParking:'Demo: 8 cajones y 4 coches',width:'Ancho (pies)',length:'Largo (pies)',
 count:'Número de cajones',gap:'Separación entre cajones (pies)',rotation:'Rotación (grados)',
 start:'Número inicial',prefix:'Prefijo opcional',accessible:'Cajones accesibles (posiciones 1, 2…)',
 color:'Color de la marca',instructions:'Configura y toca el mapa para colocar las marcas. Son decals planos sin colisión.',
 placed:n=>n===1?'Marca colocada':n+' marcas colocadas',limited:'La marca quedaría fuera de la cuadrícula.',
 replacement:'La demo sustituye los elementos del piso actual; los otros pisos no cambian. ¿Continuar?',
 demoSuccess:'Demo creada: 8 cajones numerados y 4 coches de 15 × 6 pies.',
 note:'Las marcas se guardan en el JSON como parking_decal y se superponen al asfalto sin colisión.',
 apply:'Aplicar medidas',close:'Cerrar',stallNumber:'Número del cajón',accessibleCheck:' Cajón accesible',
 markColor:'Color de marca',invalidConfig:'Comprueba las dimensiones, cantidad y rotación.',
 invalidAccessible:'Los cajones accesibles deben ser índices separados por coma, como 1,3.',
 ready:'Medidas preparadas. Toca el mapa para colocar.',
 deniedPaint:'Tu propiedad no permite pintar alguna de estas marcas.',
 deniedEdit:'No puedes editar esta marca.',invalidDimension:'Dimensión inválida',
 demoCreator:'La demo sólo puede cargarla el creador.',
 demoGrid:'La demo requiere al menos 16 columnas y 12 filas. Ajusta la cuadrícula antes.',
 demoAsphalt:'Asfalto del estacionamiento',carLabel:'Coche',spawnLabel:'Punto de aparición',
 surfaces:Object.freeze({asphalt:'Asfalto',alley:'Callejón manchado',sidewalk:'Banqueta',concrete:'Concreto',
  gravel:'Grava',cobblestone:'Adoquín',tile_floor:'Baldosa',carpet:'Alfombra',wood_floor:'Madera'}),
 tips:Object.freeze({
  parking_stall:'CAJONES: configura cantidad, dimensiones, separación, número y accesibilidad. Toca el centro del primer cajón.',
  parking_arrow:'FLECHA: configura dimensiones y toca el suelo.',
  parking_crosswalk:'CEBRA: coloca franjas planas sobre un pavimento.',
  parking_double_yellow:'DOBLE AMARILLA: pinta dos líneas paralelas.',
  parking_dashed_yellow:'DISCONTINUA: pinta tramos separados.',
  parking_speed_bump:'REDUCTOR: decal pintado, no crea colisiones.',
  parking_curb:'GUARNICIÓN: pinta el borde; no bloquea paso.'
 })
});
