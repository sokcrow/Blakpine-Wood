(function(root){
 'use strict';
 root.FH_ROOF_TEXT=Object.freeze({
  title:'Cubierta sobre este nivel',open:'Configurar cubierta',enabled:'Generar cubierta',
  help:'La cubierta se genera sobre el perímetro cerrado de paredes rojas. Si hay una planta superior, queda expuesta sólo la parte que sobresale. Los patios permanecen abiertos.',
  legacy:'Este mapa usa concreto y pretil de 0.25 tile por defecto. Puedes cambiar sus acabados y altura aquí.',
  height:'Altura del pretil (tiles)',floor:'Piso de azotea',wall:'Pared del pretil',
  shape:'Tipo de cubierta',auto:'Automática según reglamento',
  dndDefault:'D&D usa tejados a dos aguas sobre las casas y balcones planos junto a una planta superior.',
  dndHint:'Automática: cada casa tiene tejado a dos aguas; si continúa en una planta superior, el retranqueo queda plano. Para fijar una terraza o balcón, elige plano. Las cubiertas planas guardadas se conservan: selecciona Automática para adoptar el estilo D&D.',flat:'Azotea o balcón plano',gable:'Tejado a dos aguas (villa)',
  rise:'Altura de cumbrera (ft)',axis:'Dirección de cumbrera',
  axisAuto:'Automática (lado más largo)',axisX:'Este – oeste',axisZ:'Norte – sur',
  coverColor:'Color de tejas',invalidRise:'La cumbrera debe medir entre 1 y 30 pies.',
  material:'Material',color:'Color',save:'Guardar cubierta',close:'Cerrar',
  saved:'Configuración de cubierta guardada.',invalid:'La altura debe estar entre 0 y 2 tiles.',
  denied:'Sólo el creador del mapa puede configurar la cubierta.',cap:'Cubierta',
  defaultHint:'Las azoteas conservan el pretil. Para villas, elige tejado a dos aguas: tendrá cumbrera y tejas pixeladas.'
 });
})(typeof window!=='undefined'?window:globalThis);
