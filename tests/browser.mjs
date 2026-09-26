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
const count0=original.model.numLayers-1>displayLayers.at(-2)?displayLayers.length+1:displayLayers.length;
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
    assert.equal(await page.locator('.tf-input').count(),0,'The prompt is not repeated above the diagram');
    assert.equal(await page.locator('.tf-word').first().evaluate(e=>getComputedStyle(e).fontWeight),'700');
    assert.equal(await page.locator('[data-layer]').count(),outputStage+1);
    assert.equal(await page.locator(`[data-layer="${outputStage-1}"]`).innerText(),'第N層');
    for(let stage=0;stage<=outputStage;stage++){
     await page.locator(`[data-layer="${stage}"]`).click();
     if(stage===outputStage-1)assert.equal(await page.locator('.tf-space-title').textContent(),'N層の空間');
     if(id==='gpt-representations-not'){
      const layouts=[];
      for(const mode of ['on','off']){await page.locator(`[data-negation="${mode}"]`).click();assert.equal(await page.locator('.tf-token').count(),original.cases[mode==='on'?1:0].tokens.length);await noOverflow(page,`${id} stage ${stage}`);layouts.push(await page.locator('.tf-token').evaluateAll(es=>es.map(e=>e.style.transform)));}
      if(stage>=1&&stage<outputStage)for(let i=0;i<original.cases[0].tokens.length;i++){
       if(stage===1)assert.equal(layouts[0][i],layouts[1][i],'Shared tokens keep their initial embedding positions');
       else assert.notEqual(layouts[0][i],layouts[1][i],'Illustrative layer layouts differ with not');
      }
     }else{
      assert.equal(await page.locator('[data-negation],.tf-case-controls').count(),0);
      assert.equal(await page.locator('.tf-token').count(),original.cases[0].tokens.length);
      await noOverflow(page,`${id} stage ${stage}`);
     }
    }
    assert.ok(await page.locator('figure').evaluate(e=>e.classList.contains('tf-output-ready')));
    assert.ok((await page.locator('.tf-output-chain').textContent()).includes(await page.evaluate(()=>Diagram.percent(Diagram.data.cases[0].candidates[0].probability))));
    await page.screenshot({path:root+`test-results/${id}-${width}.png`,fullPage:true});
   }
   if(id==='decoder-kv-cache'){
    // Earlier prompt tokens start cached; from the earliest position with recorded candidates, one token per cycle.
    const c=original.cases[0],n=c.tokens.length,N=original.model.numLayers;
    // The layer below the last is drawn as its own row when layers are skipped before it.
    const rows=N-1>displayLayers.at(-2)?[...displayLayers.slice(0,-1),N-1,N]:displayLayers,count=rows.length;let start=n-1;while(start>0&&c.tokens[start-1].candidates)start--;
    const cycleLength=count+3,total=(n-start)*cycleLength,positions=new Map();
    const visible='[data-node]:not(.is-hidden)';
    assert.equal(await page.locator('.dc-word:not(.is-hidden)').count(),start+1,'Only computed words are shown');
    assert.equal(await page.locator(`${visible}[data-state="cached"]`).count(),start*(count+1),'Earlier tokens start with cached K・V');
    assert.equal(await page.locator(visible).count(),start*(count+1)+1,'Uncomputed nodes are hidden');
    assert.equal(await page.locator('figcaption').count(),0);
    assert.ok((await page.locator('.dc-network').textContent()).includes('第N−1層'),'Skipped layers are counted from the end');
    for(let i=0;i<total;i++){
     const phase=i%cycleLength,to=start+Math.floor(i/cycleLength);
     assert.equal(await page.locator('figure').getAttribute('data-step'),String(i));
     // Cached nodes never move; only the colour says whether they are used in this step.
     const nodes=await page.locator(visible).evaluateAll(es=>es.map(e=>[e.dataset.node,e.dataset.state,[...e.attributes].filter(a=>a.name!=='class').map(a=>a.name+'='+a.value).join(' ')]));
     for(const [key,state,attrs] of nodes){if(positions.has(key)&&state==='cached')assert.equal(attrs,positions.get(key),'Cached nodes never change');if(state==='cached')positions.set(key,attrs);}
     assert.ok(nodes.every(([key])=>+key.split('-')[0]<=to));
     if(phase===count)assert.equal(await page.locator('figure').getAttribute('data-layer'),String(N));
     if(phase<=count)assert.equal(await page.locator('.dc-row-current').getAttribute('data-row-label'),String(phase));
     // While a layer is computed, information flows in from every earlier token's node in the row below, and only those circles are highlighted.
     // The row after the axis break has no flow: it is reached through the omitted layers.
     const gapK=[0,...rows].findIndex((v,k,a)=>k>0&&v>a[k-1]+1),layer=phase>=1&&phase<=count&&phase!==gapK;
     assert.equal(await page.locator('.dc-link').count(),layer?to:0);
     assert.equal(await page.locator('.dc-node.is-source').count(),layer?to+1:0);
     if(phase<=count)assert.equal(await page.locator('.dc-space-layer').textContent(),await page.locator('.dc-row-current').textContent());
     // After the last layer only the final representation remains, and the probabilities replace the space.
     assert.equal(await page.locator('.dc-right').evaluate(e=>e.classList.contains('is-probs')),phase>count);
     if(phase===count+1){
      assert.equal(await page.locator('.dc-net').evaluate(e=>getComputedStyle(e).opacity),'0');
      assert.ok((await page.locator('.dc-probs').textContent()).includes('%'));
      assert.equal(await page.locator('.dc-card-caption').textContent(),'第N層の表現');
      assert.equal((await page.locator('.dc-card-word').textContent()),c.tokens[to].text.trim());
     }
     if(phase===count+2)assert.equal((await page.locator('.dc-word:not(.is-hidden)').last().textContent()).trim(),(to<n-1?c.tokens[to+1].text:c.candidates[c.selectedIndex].text).trim());
     if(i<total-1)await page.locator('[data-dc-next]').click();
    }
    assert.equal(await page.locator('.dc-word:not(.is-hidden)').count(),n+1);
    assert.ok(await page.locator('[data-dc-next]').isDisabled());await page.locator('[data-dc-back]').click();assert.equal(await page.locator('figure').getAttribute('data-step'),String(total-2));
    await page.locator('[data-dc-next]').click();
    await page.screenshot({path:root+`test-results/decoder-${width}.png`,fullPage:true});await page.locator('[data-dc-reset]').click();assert.equal(await page.locator('figure').getAttribute('data-step'),'0');
   }
   if(id==='ngram-to-llm'){
    await page.locator('[data-stage="1"]').click();
    const positions=()=>page.locator('.ng-number').evaluateAll(es=>es.map(e=>[e.textContent,e.style.left,e.style.top]));const before=await positions();
    // Sorting advances one named operation per click: rows, columns, then the rest at once.
    const back=page.locator('[data-sort-back]'),next=page.locator('[data-sort-next]');assert.ok(await back.isDisabled());
    const labels=[];for(let i=0;i<3;i++){labels.push((await next.innerText()).trim());await next.click();}
    assert.equal(new Set(labels).size,3);assert.ok(labels.every(l=>!/進む|次へ/.test(l)));assert.ok(await next.isDisabled());
    const sorted=await positions();assert.notDeepEqual(sorted,before);
    for(let i=0;i<3;i++)await back.click();assert.deepEqual(await positions(),before);assert.ok(await back.isDisabled());
    await next.click();await page.locator('[data-stage="0"]').click();await page.locator('[data-stage="1"]').click();assert.equal((await back.innerText()).trim(),'◀ 行を元に戻す','Sort progress survives scene changes');
    await page.locator('[data-stage="2"]').click();assert.deepEqual((await positions()).map(p=>p.slice(1)),sorted.map(p=>p.slice(1)));assert.equal(await page.locator('.ng-hidden-value').count(),1);await page.locator('[data-reveal]').click();assert.equal(await page.locator('.ng-hidden-value').count(),0);assert.ok((await page.locator('.ng-matrix-note').innerText()).includes('1.3'));
    await page.screenshot({path:root+`test-results/ngram-matrix-${width}.png`,fullPage:true});
    // Scene 4 embeds the decoder diagram and computes only the last word of the chosen sentence.
    await page.locator('[data-stage="3"]').click();await page.locator('[data-dc-case="1"]').click();const nc=original.cases[1],nn=nc.tokens.length;
    assert.deepEqual((await page.locator('.decoder .dc-word:not(.is-hidden)').allTextContents()).map(t=>t.trim()),nc.tokens.map(t=>t.text.trim()));
    assert.equal(await page.locator('.decoder [data-node]:not(.is-hidden)').count(),(nn-1)*(count0+1)+1,'Earlier words are computed; the last word starts at its embedding');
    assert.equal(await page.locator('.dc-prob.is-top').count(),0);assert.equal(await page.locator('.dc-probs').evaluate(e=>getComputedStyle(e).visibility),'hidden','Candidates stay hidden before the output layer');
    while(!(await page.locator('[data-dc-next]').isDisabled())){await page.locator('[data-dc-next]').click();await noOverflow(page,`ngram flow ${width}`);if(await page.locator('[data-dc-next]').isDisabled())break;assert.equal(await page.locator('.decoder.is-ready').count(),0);}
    assert.ok(await page.locator('.decoder').evaluate(e=>e.classList.contains('is-output')));assert.equal(await page.locator('.dc-card-vector rect').count(),original.ngram.features.negative.length);
    await page.waitForFunction(()=>document.querySelector('.decoder').dataset.sub==='2');
    assert.ok((await page.locator('.dc-prob.is-top').textContent()).includes(nc.candidates.reduce((a,b)=>a.probability>b.probability?a:b).text.trim()));await noOverflow(page,`ngram prediction ${width}`);
    await page.screenshot({path:root+`test-results/ngram-prediction-${width}.png`,fullPage:true});
   }
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
 for(const id of ['gpt-representations-not','decoder-kv-cache','ngram-to-llm'])await variant(id,'edited-'+id,edit);
 const context=await browser.newContext({offline:true,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url('edited-gpt-representations-not'));
 assert.deepEqual(await page.evaluate(()=>[Diagram.format(1.001),Diagram.format(.000999),Diagram.format(-.000999),Diagram.format(-1.9999),Diagram.percent(.12345678)]),['1.001','0','0','−1.999','12.345%']);
 assert.equal(await page.locator('.tf-token').count(),original.cases[0].tokens.length+1);assert.equal(await page.locator('[data-layer="4"]').textContent(),'第N層');
 await page.locator('[data-layer="1"]').click();assert.equal(await page.locator('.tf-token').first().getAttribute('data-input-vector'),'[0.123987,-0.123987]');
 assert.equal(await page.locator('.tf-column tspan').first().textContent(),'0.123');
 await page.locator('[data-layer="5"]').click();assert.ok((await page.locator('.tf-output-chain').textContent()).includes('12.345%'));
 await page.goto(url('edited-decoder-kv-cache'));assert.ok((await page.locator('.dc-network').textContent()).includes('第N層'));
 while(!(await page.locator('[data-dc-next]').isDisabled()))await page.locator('[data-dc-next]').click();
 assert.equal(await page.locator('.dc-word:not(.is-hidden)').count(),original.cases[0].tokens.length+2);
 await page.goto(url('edited-ngram-to-llm'));await page.locator('[data-stage="2"]').click();await page.locator('[data-reveal]').click();assert.ok((await page.locator('.ng-matrix-note').textContent()).includes('2.987'));await page.locator('[data-stage="3"]').click();
 const flowLabels=[];while(!(await page.locator('[data-dc-next]').isDisabled())){await page.locator('[data-dc-next]').click();flowLabels.push(await page.locator('.dc-row-current').allTextContents());}
 assert.deepEqual(flowLabels,[['第1層'],['第2層'],['第N−1層'],['第N層'],[]]);assert.equal(await page.locator('.dc-card-caption').textContent(),'第N層の表現');
 assert.ok((await page.locator('.dc-prob.is-top').textContent()).includes('London'));
 await context.close();
 // Motion: merge happens on transition end; changing scenes cancels delayed effects.
 await variant('gpt-representations-not','motion-fixture',d=>{d.model.status='illustrative';d.model.positionEncoding={type:'sinusoidal',label:'sin/cos'};for(const c of d.cases)for(const t of [...c.tokens,...c.continuation.map(s=>s.token)]){t.position=t.embedding.map((_,i)=>i===0?0:1);t.input=t.embedding.map((n,i)=>n+t.position[i]);}});
 const motion=await browser.newContext({offline:true}),mp=await motion.newPage();mp.on('pageerror',e=>errors.push(e.message));
 await mp.goto(url('motion-fixture'));await mp.locator('[data-layer="1"]').click();
 assert.equal(await mp.locator('.tf-column tspan').first().textContent(),await mp.evaluate(()=>Diagram.format(Diagram.data.cases[0].tokens[0].embedding[0])));
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-position-added'));
 assert.equal(await mp.locator('.tf-column tspan').nth(1).textContent(),await mp.evaluate(()=>Diagram.format(Diagram.data.cases[0].tokens[0].input[1])));
 const vectorPositions=await mp.locator('.tf-token').evaluateAll(es=>es.map(e=>e.style.transform));
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-dot-forming'));
 assert.deepEqual(await mp.locator('.tf-token').evaluateAll(es=>es.map(e=>e.style.transform)),vectorPositions);
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-dot-hold'));
 await mp.waitForTimeout(100);
 assert.deepEqual(await mp.locator('.tf-token').evaluateAll(es=>es.map(e=>e.style.transform)),vectorPositions,'Dots pause before moving');
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-space-moving'));
 assert.ok((await mp.locator('.tf-token').first().evaluate(e=>getComputedStyle(e).transitionDuration)).includes('1.2s'));
 await mp.waitForFunction(()=>!document.querySelector('figure').classList.contains('tf-space-moving'));

 await mp.locator(`[data-layer="${outputStage}"]`).click();await mp.locator('[data-layer="0"]').click();await mp.waitForTimeout(2300);assert.equal(await mp.locator('figure').evaluate(e=>e.classList.contains('tf-output-ready')),false);
 // N-gram scene 4 (the embedded decoder): the new node appears first, information flows into it, then it forms.
 await mp.goto(url('ngram-to-llm'));await mp.locator('[data-stage="3"]').click();const flow=mp.locator('.decoder');
 await mp.locator('[data-dc-next]').click();
 assert.equal(await flow.getAttribute('data-sub'),'0');assert.equal(await mp.locator('.dc-row-current').getAttribute('data-row-label'),'1');assert.equal(await mp.locator('.dc-node.is-pending').count(),1);
 assert.equal(await mp.locator('.dc-link').first().evaluate(e=>getComputedStyle(e).opacity),'0','No information lines before the new node has appeared');
 await mp.waitForFunction(()=>document.querySelector('.decoder').dataset.sub==='1');await mp.waitForFunction(()=>document.querySelector('.decoder').dataset.sub==='2');
 assert.equal(await mp.locator('.dc-node.is-pending').count(),0);
 await mp.locator('[data-dc-next]').click();await mp.locator('[data-dc-back]').click();assert.equal(await flow.getAttribute('data-sub'),'2','Going back shows the finished step');assert.equal(await mp.locator('.dc-row-current').getAttribute('data-row-label'),'1');
 await mp.locator('[data-dc-next]').click();await mp.locator('[data-stage="2"]').click();await mp.waitForTimeout(2300);assert.equal(await flow.getAttribute('data-sub'),'2','Leaving the scene cancels delayed steps');
 await mp.locator('[data-stage="3"]').click();await mp.locator('[data-dc-reset]').click();assert.equal(await flow.getAttribute('data-step'),'0');
 // Representation continuity in both diagrams, including the selected not case.
 for(const id of ['gpt-representations','gpt-representations-not']){
 await mp.goto(url(id));
 assert.equal(await mp.locator('ellipse').evaluate(e=>getComputedStyle(e).opacity),'0');
 assert.equal(await mp.locator('.tf-tokens').evaluate(e=>e.getAnimations({subtree:true}).length),0,'Initial sentence has no animation');
 if(id==='gpt-representations-not')await mp.locator('[data-negation="on"]').click();
 assert.equal(new Set(await mp.locator('.tf-word').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().y)))).size,1,'Sentence stays on one line');
 assert.equal(await mp.locator('figcaption').count(),0);
 const sentenceX=await mp.locator('.tf-word').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2;}));
 await mp.evaluate(()=>window.originalWords=[...document.querySelectorAll('.tf-word')]);
 await mp.locator('[data-layer="1"]').click();await mp.waitForTimeout(950);
 const numericX=await mp.locator('.tf-column').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2;}));
 sentenceX.forEach((x,i)=>assert.ok(Math.abs(x-numericX[i])<1,'Word and vector share the same horizontal anchor'));
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-dot-hold'));
 assert.ok(await mp.evaluate(()=>window.originalWords.every((el,i)=>el===document.querySelectorAll('.tf-word')[i]&&getComputedStyle(el).opacity==='1')));
 const inside=()=>mp.locator('.tf-token').evaluateAll(es=>es.every(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return ((m.e-260)/242)**2+((m.f-220)/187)**2<1;}));
 assert.equal(await mp.locator('ellipse').evaluate(e=>getComputedStyle(e).opacity),'0','Ellipse waits while dots are on the sentence line');
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-space-moving'));
 await mp.waitForFunction(()=>!document.querySelector('figure').classList.contains('tf-space-moving'));
 assert.ok(await inside(),'Settled dots fit within the ellipse');
 await mp.locator(`[data-layer="${outputStage-1}"]`).click();await mp.waitForTimeout(3000);
 await mp.locator(`[data-layer="${outputStage}"]`).click();await mp.waitForTimeout(600);
 assert.equal(await mp.locator('.tf-linear').evaluate(e=>getComputedStyle(e).opacity),'0','Arrow waits for arriving vector');
 assert.equal(await mp.locator('.tf-scores').evaluate(e=>getComputedStyle(e).opacity),'0');
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-output-scores'));
 const scoreBars=await mp.locator('.tf-candidate rect').evaluateAll(es=>es.map(e=>[e.getAttribute('x'),e.getAttribute('y'),e.getAttribute('width')]));
 await mp.evaluate(()=>window.originalBars=[...document.querySelectorAll('.tf-candidate rect')]);
 await mp.waitForFunction(()=>document.querySelector('figure').classList.contains('tf-output-ready'));
 const probabilityBars=await mp.locator('.tf-candidate rect').evaluateAll(es=>es.map(e=>[e.getAttribute('x'),e.getAttribute('y'),e.getAttribute('width')]));
 assert.deepEqual(scoreBars.map(v=>v.slice(0,2)),probabilityBars.map(v=>v.slice(0,2)));
 assert.notDeepEqual(scoreBars.map(v=>v[2]),probabilityBars.map(v=>v[2]));
 assert.ok(await mp.evaluate(()=>window.originalBars.every((el,i)=>el===document.querySelectorAll('.tf-candidate rect')[i])));
 await mp.locator('[data-layer="0"]').click();await mp.locator(`[data-layer="${outputStage}"]`).click();
 assert.equal(await mp.locator('figure').evaluate(e=>e.classList.contains('tf-output-scores')),false,'Replay clears output phases');
 }
 await motion.close();
 const nojs=await browser.newContext({javaScriptEnabled:false,offline:true}),sp=await nojs.newPage();await sp.goto(url('gpt-representations'));assert.ok(await sp.locator('.tf-static').isVisible());await sp.goto(url('ngram-to-llm'));assert.ok(await sp.locator('.ng-fallback').isVisible());await nojs.close();
 assert.deepEqual(errors,[]);
 console.log('Passed: offline standalone files, 3 widths, all scenes, motion, cancellation, playback, editable-data replacements, precision, RoPE, variable tokens/layers, no-JS.');
}finally{await browser.close();await fs.rm(isolated,{recursive:true,force:true});}
