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
   .update(Buffer.from('blob '+bytes.length+'\\0')).update(bytes).digest('hex');
  assert.equal(gitHash,sha,id+' no coincide con el icono original');
 }
});
test('los iconos están conectados al HUD y al editor D&D',()=>{
 for(const file of ['juego/rules/dnd/fh-dnd-engine.js','juego/assets/fh-dnd-character-manager.js']){
  const src=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(src.includes('assets/dnd-icons/'));
 }
});
