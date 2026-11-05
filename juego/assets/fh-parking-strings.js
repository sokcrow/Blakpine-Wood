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
 note:'Las marcas se guardan en el JSON como parking_decal y se superponen al asfalto sin colisión.'
});
