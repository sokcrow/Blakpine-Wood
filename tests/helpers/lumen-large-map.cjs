const fs=require('node:fs');
module.exports=function largeMap(stress=false){
 const project=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Circuitos_Identificados.json'));
 project.units.columns=120;project.units.rows=120;
 if(stress){
  const source=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Silla_Comedor_Mesa.json'));
  const chair=source.floors[0].items.find(i=>i.type==='chair');
  for(const floor of project.floors)for(let y=0;y<120;y+=2)for(let x=0;x<120;x+=2)
   floor.items.push({...structuredClone(chair),id:`stress-${floor.id}-${x}-${y}`,x:x+.5,y:y+.5});
 }
 return project;
};
