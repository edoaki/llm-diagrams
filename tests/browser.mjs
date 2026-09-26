import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const items=JSON.parse(await fs.readFile(root+'components.json','utf8'));
const isolated=await fs.mkdtemp(path.join(os.tmpdir(),'llm-animation-'));
await fs.mkdir(root+'test-results',{recursive:true});
const browser=await chromium.launch();
const errors=[];
const dataRE=/(<script type="application\/json" id="diagram-data">)[\s\S]*?(<\/script>)/;
const source=await fs.readFile(root+'dist/gpt-representations-not.html','utf8');
const original=JSON.parse(source.match(/<script type="application\/json" id="diagram-data">([\s\S]*?)<\/script>/)[1]);
const displayLayers=[...new Set([1,Math.min(2,original.model.numLayers),original.model.numLayers])],outputStage=displayLayers.length+2;
const url=id=>pathToFileURL(path.join(isolated,id+'.html')).href;
const noOverflow=async(page,label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label);
async function variant(id,name,edit){const html=await fs.readFile(root+`dist/${id}.html`,'utf8'),d=structuredClone(original);edit(d);await fs.writeFile(path.join(isolated,name+'.html'),html.replace(dataRE,(_,a,b)=>a+JSON.stringify(d)+b));return d;}
try{
 for(const {id} of items)await fs.copyFile(root+`dist/${id}.html`,path.join(isolated,id+'.html'));
 for(const width of [960,390,320]){
  const context=await browser.newContext({viewport:{width,height:1100},offline:true,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>assert.ok(r.url().startsWith(pathToFileURL(isolated).href),'Standalone file must not load other resources'));
  for(const {id} of items){
   await page.goto(url(id));assert.equal(await page.locator('figure').count(),1);assert.equal(await page.locator('#diagram-data').count(),1);
   assert.equal(await page.locator('script[src],link[href],iframe').count(),0);await noOverflow(page,`${id} at ${width}`);
   assert.deepEqual(await page.evaluate(()=>Diagram.data),original,'All HTMLs share the canonical data');
   if(id.startsWith('gpt-representations')){
    assert.equal(await page.locator('[data-layer]').count(),outputStage+1);
    assert.equal(await page.locator(`[data-layer="${outputStage-1}"]`).innerText(),`第${original.model.numLayers}層`);
    for(let stage=0;stage<=outputStage;stage++){
     await page.locator(`[data-layer="${stage}"]`).click();
     for(const mode of ['on','off']){await page.locator(`[data-negation="${mode}"]`).click();assert.equal(await page.locator('.tf-token').count(),original.cases[mode==='on'?1:0].tokens.length);await noOverflow(page,`${id} stage ${stage}`);}
    }
    assert.ok(await page.locator('figure').evaluate(e=>e.classList.contains('tf-output-ready')));
    assert.ok((await page.locator('.tf-output-chain').textContent()).includes(await page.evaluate(()=>Diagram.percent(Diagram.data.cases[0].candidates[0].probability))));
    await page.screenshot({path:root+`test-results/${id}-${width}.png`,fullPage:true});
   }
   if(id==='decoder-kv-cache'){
    const fixed=()=>page.locator('[data-node^="0-"]').evaluateAll(es=>es.map(e=>e.outerHTML));const before=await fixed();
    const cycleLength=displayLayers.length*2+3,total=(original.cases[0].continuation.length+1)*cycleLength;
    for(let i=0;i<total;i++){
     assert.equal(await page.locator('figure').getAttribute('data-step'),String(i));assert.deepEqual(await fixed(),before);
     if(i%cycleLength===displayLayers.length*2)assert.equal(await page.locator('figure').getAttribute('data-layer'),String(original.model.numLayers));
     if(i%cycleLength===cycleLength-2)assert.ok((await page.locator('.dc-bars').textContent()).includes('%'));
     if(i<total-1)await page.locator('[data-dc-next]').click();
    }
    assert.ok(await page.locator('[data-dc-next]').isDisabled());await page.locator('[data-dc-back]').click();assert.equal(await page.locator('figure').getAttribute('data-step'),String(total-2));await page.locator('[data-dc-reset]').click();
    await page.screenshot({path:root+`test-results/decoder-${width}.png`,fullPage:true});
   }
   if(id==='ngram-to-llm'){
    await page.locator('[data-stage="1"]').click();
    const positions=()=>page.locator('.ng-number').evaluateAll(es=>es.map(e=>[e.textContent,e.style.left,e.style.top]));const before=await positions();
    await page.locator('[data-sort]').click();assert.notDeepEqual(await positions(),before);await page.locator('[data-sort-back]').click();assert.deepEqual(await positions(),before);
    for(let i=0;i<3;i++)await page.locator('[data-sort]').click();assert.ok(await page.locator('[data-sort]').isDisabled());
    await page.locator('[data-stage="2"]').click();assert.equal(await page.locator('.ng-hidden-value').count(),1);await page.locator('[data-reveal]').click();assert.ok((await page.locator('.ng-matrix-note').innerText()).includes('1.3'));
    const values=await page.locator('.ng-number').allTextContents();await page.locator('[data-layout="original"]').click();assert.deepEqual(await page.locator('.ng-number').allTextContents(),values);
    await page.screenshot({path:root+`test-results/ngram-matrix-${width}.png`,fullPage:true});
    await page.locator('[data-stage="3"]').click();await page.locator('[data-bank="river"]').click();assert.equal(await page.locator('.ng-sentence').textContent(),original.cases[1].prompt+' ?');
    assert.ok((await page.locator('.ng-top-prediction').textContent()).includes(original.cases[1].candidates.reduce((a,b)=>a.probability>b.probability?a:b).text.trim()));await noOverflow(page,`ngram prediction ${width}`);
    await page.screenshot({path:root+`test-results/ngram-prediction-${width}.png`,fullPage:true});
   }
   if(id==='autoregressive'){
    for(const mode of ['0','1']){await page.selectOption('select',mode);await page.locator('[data-next]').click();assert.ok(await page.locator('select').isDisabled());for(let j=0;j<original.cases[+mode].continuation.length;j++)await page.locator('[data-next]').click();assert.ok(await page.locator('[data-next]').isDisabled());assert.ok((await page.locator('.ld-status').textContent()).includes('記録の終わり'));await page.locator('[data-reset]').click();}
   }
   if(id==='token-embeddings')await page.screenshot({path:root+`test-results/embedding-${width}.png`,fullPage:true});
  }
  await context.close();
 }
 // Change only the embedded data, as a recipient would. Never touch rendering code.
 const edit=d=>{
  const oldLayers=d.model.numLayers;d.model.status='illustrative';d.model.hiddenSize=2;d.model.componentIndices=[0,1];
  d.model.numLayers=12;d.model.positionEncoding={type:'rope',label:'RoPE'};
  for(const c of d.cases){for(const t of [...c.tokens,...c.continuation.map(s=>s.token)]){t.layers={1:[.1,.2],2:[.2,.3],12:[.3,.4]};t.points={0:[.1,.2],1:[.2,.3],2:[.3,.4],12:[.4,.5]};t.embedding=t.embedding.slice(0,2);t.position=null;t.input=t.embedding.slice();}}
  d.cases[0].tokens[0].embedding=[.123987,-.123987];d.cases[0].tokens[0].input=[.123987,-.123987];
  d.cases[0].tokens.splice(2,0,structuredClone(d.cases[0].tokens[1]));d.cases[0].tokens[2].text=' split';d.cases[0].prompt=d.cases[0].tokens.map(t=>t.text).join('');
  d.cases[0].candidates=[{tokenId:null,text:' Paris',probability:.12345678},{tokenId:null,text:' London',probability:.71654322},{tokenId:null,text:' Berlin',probability:.04},{tokenId:null,text:'その他',probability:.12}];d.cases[0].selectedIndex=0;d.cases[0].continuation=[];
  d.ngram.matrix.values[3][1]=2.987654;
 };
 for(const id of ['gpt-representations-not','decoder-kv-cache','ngram-to-llm','token-embeddings'])await variant(id,'edited-'+id,edit);
 const context=await browser.newContext({offline:true,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url('edited-gpt-representations-not'));
 assert.deepEqual(await page.evaluate(()=>[Diagram.format(1.001),Diagram.format(.000999),Diagram.format(-.000999),Diagram.format(-1.9999),Diagram.percent(.12345678)]),['1.001','0','0','−1.999','12.345%']);
 assert.equal(await page.locator('.tf-token').count(),original.cases[0].tokens.length+1);assert.equal(await page.locator('[data-layer="4"]').textContent(),'第12層');
 await page.locator('[data-layer="1"]').click();assert.equal(await page.locator('.tf-token').first().getAttribute('data-input-vector'),'[0.123987,-0.123987]');
 assert.equal(await page.locator('.tf-column tspan').first().textContent(),'0.123');
 await page.locator('[data-layer="5"]').click();assert.ok((await page.locator('.tf-output-chain').textContent()).includes('12.345%'));
 await page.goto(url('edited-decoder-kv-cache'));assert.ok((await page.locator('.dc-network').textContent()).includes('第12層'));assert.equal(await page.locator('.dc-word').count(),original.cases[0].tokens.length+1);
 await page.goto(url('edited-ngram-to-llm'));await page.locator('[data-stage="2"]').click();await page.locator('[data-reveal]').click();assert.ok((await page.locator('.ng-matrix-note').textContent()).includes('2.987'));await page.locator('[data-stage="3"]').click();assert.ok((await page.locator('.ng-top-prediction').textContent()).includes('London'));
 await page.goto(url('edited-token-embeddings'));assert.ok((await page.locator('.embedding-content').textContent()).includes('加算は表示しません'));assert.equal(await page.locator('.embedding-grid section').count(),original.cases[0].tokens.length+1);
 await context.close();
 // Motion: merge happens on transition end; changing scenes cancels delayed effects.
 await variant('gpt-representations-not','motion-fixture',d=>{d.model.status='illustrative';d.model.positionEncoding={type:'sinusoidal',label:'sin/cos'};for(const c of d.cases)for(const t of [...c.tokens,...c.continuation.map(s=>s.token)]){t.position=t.embedding.map((_,i)=>i===0?0:1);t.input=t.embedding.map((n,i)=>n+t.position[i]);}});
 const motion=await browser.newContext({offline:true}),mp=await motion.newPage();mp.on('pageerror',e=>errors.push(e.message));
 await mp.goto(url('motion-fixture'));await mp.locator('[data-layer="1"]').click();
 assert.equal(await mp.locator('.tf-column tspan').first().textContent(),await mp.evaluate(()=>Diagram.format(Diagram.data.cases[0].tokens[0].embedding[0])));
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-position-added'));
 assert.equal(await mp.locator('.tf-column tspan').nth(1).textContent(),await mp.evaluate(()=>Diagram.format(Diagram.data.cases[0].tokens[0].input[1])));
 await mp.waitForFunction(()=>!document.querySelector('figure').classList.contains('tf-numeric'));
 await mp.locator(`[data-layer="${outputStage}"]`).click();await mp.locator('[data-layer="0"]').click();await mp.waitForTimeout(2300);assert.equal(await mp.locator('figure').evaluate(e=>e.classList.contains('tf-output-ready')),false);
 await mp.goto(url('ngram-to-llm'));await mp.locator('[data-stage="3"]').click();await mp.waitForFunction(()=>document.querySelector('[data-panel="attention"]').dataset.phase==='1');await mp.locator('[data-playback]').click();const phase=await mp.locator('[data-panel="attention"]').getAttribute('data-phase');await mp.waitForTimeout(1800);assert.equal(await mp.locator('[data-panel="attention"]').getAttribute('data-phase'),phase);await mp.locator('[data-replay]').click();await mp.waitForFunction(()=>document.querySelector('[data-panel="attention"]').dataset.phase==='2');
 await mp.goto(url('autoregressive'));await mp.locator('[data-play]').click();await mp.waitForFunction(()=>document.querySelector('[data-play]').disabled);await mp.locator('[data-reset]').click();await mp.locator('[data-play]').click();await mp.locator('[data-play]').click();await mp.waitForTimeout(1600);assert.equal(await mp.locator('.ld-token').count(),original.cases[0].tokens.length);
 await motion.close();
 const nojs=await browser.newContext({javaScriptEnabled:false,offline:true}),sp=await nojs.newPage();await sp.goto(url('gpt-representations'));assert.ok(await sp.locator('.tf-static').isVisible());await sp.goto(url('ngram-to-llm'));assert.ok(await sp.locator('.ng-fallback').isVisible());await nojs.close();
 assert.deepEqual(errors,[]);
 console.log('Passed: offline standalone files, 3 widths, all scenes, motion, cancellation, playback, editable-data replacements, precision, RoPE, variable tokens/layers, no-JS.');
}finally{await browser.close();await fs.rm(isolated,{recursive:true,force:true});}
