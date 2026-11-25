'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const expected={
 str:'f8585756336871edd46e20db4d115eaf7f9a60c0',
 dex:'e5df173b1d1bc4c173268a9b229e1ba4684fcc37',
 con:'4e8555f17e5529a53b6ea09dbcbc2cf194aa56fc',
 int:'abcd40501e36243cfe33818a9eefaef047cdd1e3',
 wis:'9031a8ee417f79f35c7714c09cff40ae8c762606',
 cha:'7f5227fc004e248eaa103a2c7a4464fcdf4708ae'
};
test('ficha D&D utiliza los seis PNG originales de Luminos',()=>{
 for(const [id,sha]of Object.entries(expected)){
  const bytes=fs.readFileSync(path.join(root,'juego/assets/dnd-icons',id+'.png'));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a',id);
  const gitHash=crypto.createHash('sha1')
   .update(Buffer.from('blob '+bytes.length+String.fromCharCode(0))).update(bytes).digest('hex');
  assert.equal(gitHash,sha,id+' no coincide con el icono original');
 }
});
test('los iconos están conectados al HUD y al editor D&D',()=>{
 for(const file of ['juego/rules/dnd/fh-dnd-engine.js','juego/assets/fh-dnd-character-manager.js']){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(src.includes('assets/dnd-icons/'));
 }
});

const skillOriginals={
 "acrobatics": "db660463eb87d5272c2857b565f03a8899e581a0",
 "animal_handling": "0e514770afdc37fad11cbacad218be247e588ddd",
 "arcana": "f16f2cb229c9a433ab9d5a72b48ddf4d128cc795",
 "athletics": "8ae6a64a0ebf4402870121131c1edf61f445350b",
 "deception": "a94e6f5235c4af66eda0df27717601c59eb814df",
 "history": "95523086ed8a12a180001b74591f6f5c2ce6c7cc",
 "insight": "8f5d77d1d08edb6600de6046b9b877b8cb5c923d",
 "intimidation": "f5aee7dfd46c3cb0f629052c8b0c034e227c64dc",
 "investigation": "d2e9a46a3451e8eb3e7f652b8045a1d96de216c1",
 "medicine": "b4843322f978eb637299d25b11e9c1bbda037b84",
 "nature": "d086d666e70d3211e1ace8518b1fbe77122a599c",
 "perception": "c15ddb41036275c29b0d94a2b484ab8e45bc1ca5",
 "performance": "e25ef2dab5cdc336bd8b3bc2653dbe9b889eb5e8",
 "persuasion": "5fb2dc2f77d7e30f573d992d5b25c8d3f6904122",
 "religion": "73379c061550c0b283373c7b7fa6fd315b43a335",
 "sleight_of_hand": "d7860b751de78f4f07371b28f1cf0c790210f2e8",
 "stealth": "675fa973b6c8a5092cf00bdc29908283385f8bb5",
 "survival": "1058e2e204f28847c4edcddac945dd3844f0af05"
};
test('las 18 habilidades utilizan sus PNG originales, con equivalencias camelCase verificadas',()=>{
 const skills=Object.keys(require('../juego/rules/dnd/fh-dnd-sheet.js').SKILLS);
 assert.equal(skills.length,18);assert.equal(Object.keys(skillOriginals).length,18);
 for(const skill of skills){
  const name=skill.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
  const bytes=fs.readFileSync(path.join(root,'juego/assets/dnd-icons/skills',name+'.png'));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a',skill);
  const actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+String.fromCharCode(0))).update(bytes).digest('hex');
  assert.equal(actual,skillOriginals[name],skill+' conserva el PNG original de Luminos');
 }
});
