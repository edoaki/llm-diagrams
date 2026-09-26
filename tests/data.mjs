import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateData} from '../scripts/validate-data.mjs';
const root=new URL('../',import.meta.url);
const source=await fs.readFile(new URL('components/gpt-representations-not/template.html',root),'utf8');
const extract=s=>JSON.parse(s.match(/<script type="application\/json" id="diagram-data">([\s\S]*?)<\/script>/)[1]);
const data=extract(source);
await validateData(data);
for(const change of [
 d=>d.cases[0].candidates[0].probability=2,
 d=>d.cases[0].tokens[0].embedding=[NaN,1],
 d=>d.model.numLayers=0,
 d=>d.cases[0].tokens[0].points[0]=[400,10],
 d=>d.ngram.matrix.hiddenCell=[99,1],
 d=>d.ngram.matrix.rowOrder=[0,0,0,0,0],
 d=>d.ngram.features.negative=[2],
 d=>d.cases[0].selectedIndex=999,
 d=>d.cases[0].continuation=[{token:d.cases[0].tokens[0],candidates:d.cases[0].candidates,selectedIndex:0}],
 d=>d.model.status='unknown',
 d=>d.ngram.status='measured',
 d=>d.ngram.matrix.status='measured',
 d=>d.cases[0].tokens[3].candidates[0].text=' was!',
 d=>d.cases[0].tokens.at(-1).candidates=d.cases[0].candidates
]){const bad=structuredClone(data);change(bad);await assert.rejects(()=>validateData(bad));}
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'diagram-import-'));
try{
 for(const dir of ['scripts','shared','components/gpt-representations-not'])await fs.mkdir(path.join(folder,dir),{recursive:true});
 for(const f of ['scripts/import-measurements.mjs','scripts/validate-data.mjs','shared/diagram-data.js','components/gpt-representations-not/template.html'])await fs.copyFile(new URL(f,root),path.join(folder,f));
 // Synthetic measured-shaped fixture verifies import mechanics, not provenance.
 const incoming=structuredClone(data);incoming.model.status='measured';incoming.model.id='test-fixture';incoming.model.extraction={hiddenStateDefinition:'synthetic test fixture'};
 for(const c of incoming.cases){c.tokens.forEach((t,i)=>t.id=i);c.tokens.forEach((t,i)=>t.candidates?.forEach((v,j)=>v.tokenId=v.text==='その他'?null:v.text===c.tokens[i+1].text?i+1:j+300));c.candidates.forEach((v,i)=>v.tokenId=v.text==='その他'?null:i+100);let selected=c.candidates[c.selectedIndex];for(const frame of c.continuation){frame.token.id=selected.tokenId;frame.token.text=selected.text;frame.candidates.forEach((v,i)=>v.tokenId=v.text==='その他'?null:i+200);selected=frame.candidates[frame.selectedIndex];}}
 incoming.ngram={shouldNotBeImported:true};
 const input=path.join(folder,'measurements.json'),target=path.join(folder,'components/gpt-representations-not/template.html');
 await fs.writeFile(input,JSON.stringify(incoming));
 execFileSync(process.execPath,[path.join(folder,'scripts/import-measurements.mjs'),input],{stdio:'pipe'});
 const after=extract(await fs.readFile(target,'utf8'));
 assert.equal(after.model.id,'test-fixture');assert.deepEqual(after.ngram,data.ngram);
 const before=await fs.readFile(target,'utf8');incoming.cases[0].candidates[0].probability=-1;await fs.writeFile(input,JSON.stringify(incoming));
 assert.throws(()=>execFileSync(process.execPath,[path.join(folder,'scripts/import-measurements.mjs'),input],{stdio:'pipe'}));
 assert.equal(await fs.readFile(target,'utf8'),before,'Invalid input must leave the original intact');
 console.log('Passed: data validation, invalid-value rejection, measured import and N-gram preservation.');
}finally{await fs.rm(folder,{recursive:true,force:true});}
