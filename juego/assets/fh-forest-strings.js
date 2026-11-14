(function(root){
 'use strict';
 const text=Object.freeze({button:'Bosque y relieve',title:'Terreno natural',enabled:'Activar bosque y relieve',
  explanation:'Se genera en el terreno libre de PB. El suelo permanece plano durante 15 ft alrededor de construcciones y calles. Las semillas se guardan con el mapa; la tala de una partida no modifica este diseño.',
  terrainSeed:'Semilla del relieve',forestSeed:'Semilla del bosque',amplitude:'Amplitud del relieve (metros)',wavelength:'Tamaño de las lomas (metros)',
  density:'Densidad del bosque (0 a 1)',spacing:'Separación base entre árboles (metros)',snow:'Permitir pinos nevados en este entorno',
  preview:'Actualizar previsualización',save:'Guardar',cancel:'Cerrar',saved:'Configuración del terreno guardada.',
  exclusions:'Árboles excluidos del diseño (un ID por línea)',selected:'Árbol seleccionado',exclude:'Excluir árbol seleccionado',
  previewHelp:'Selecciona un tronco en la vista para excluirlo permanentemente del diseño. Las áreas reservadas quedan despejadas.',
  summary:n=>n+' árboles · vista de PB · las copas no representan colisiones',
  versionError:'Versión ambiental incompatible',terrainLimit:'El relieve supera el límite de generación',forestLimit:'El bosque supera el límite de generación',constructionInvalid:'Superficie de construcción inválida',queryLimit:'Superficie de consulta demasiado grande',
  assetError:'No se pudo cargar un árbol del bosque. Revisa los recursos 3D.',invalid:'Revisa la configuración del terreno.'});
 if(typeof module==='object'&&module.exports)module.exports=text;
 if(root)root.FH_FOREST_TEXT=text;
})(typeof globalThis!=='undefined'?globalThis:this);
