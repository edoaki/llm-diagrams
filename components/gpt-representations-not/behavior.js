'use strict';
(() => {
 const {data,layers,additive,format,percent,esc,vec}=window.Diagram;
 const d=document.querySelector('.tf-representation'),q=s=>d.querySelector(s),qa=s=>[...d.querySelectorAll(s)];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let caseIndex=0,current=0,timers=[],clearMerge=null;
 // One tempo for every spatial move, with a brief pause after dots form.
 const MOVE=1200,BEAT=900,DOT_HOLD=300;d.style.setProperty('--tf-move',MOVE+'ms');
 const outputStage=layers.length+2,finalStage=outputStage-1;
 const layerLabel=layer=>layer===data.model.numLayers?'N':layer;
 const stages=['文章','ベクトル化（埋め込み）',...layers.map(l=>`第${layerLabel(l)}層`),'出力'];
 const colors=['#487bb6','#725789','#198d98','#348761','#b2703c','#b34769'];
 const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
 const c=()=>data.cases[caseIndex];
 const layerAt=stage=>stage<2?0:layers[Math.min(stage-2,layers.length-1)];
 // The sentence stays on one line; the canvas widens around x=260 instead of wrapping.
 const columnPoint=i=>[260+(i-(c().tokens.length-1)/2)*100,150];
 const frame=height=>{
  const width=Math.max(520,c().tokens.length*100+20),svg=q('.tf-space svg');
  svg.setAttribute('viewBox',`${260-width/2} 0 ${width} ${height}`);svg.style.maxWidth=width+'px';
 };
 // Map the square projection into a disk, leaving room for labels and the final halo.
 const inSpace=([u,v],stage,i)=>{
  const x=u*2-1,y=v*2-1;
  let px=x*Math.sqrt(1-y*y/2),py=y*Math.sqrt(1-x*x/2);
  if(stage>=2&&data.model.projection.status==='illustrative'){
   // Deliberately distinct teaching layouts, never modify measured projections.
   // Separate case layouts only after embedding; measured coordinates stay intact.
   const angle=(stage-1)*1.05+(i%2?-.28:.28)*(stage-1)+caseIndex*.85;
   const radius=Math.hypot(px,py),a=Math.atan2(py,px)+angle;
   const spread=Math.min(.92,Math.max(.28,radius*(1+(i%3-1)*.2)));
   px=Math.cos(a)*spread;py=Math.sin(a)*spread;
  }
  return [260+175*px,220+115*py];
 };
 const point=(t,stage,i)=>{
  if(stage===0)return columnPoint(i);
  const points=c().tokens.map((token,j)=>inSpace(token.points[layerAt(stage)],stage,j));
  if(stage>=2&&data.model.projection.status==='illustrative'){
   // Keep the teaching layout's words readable after the layer-specific change.
   for(let pass=0;pass<20;pass++){
    for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){
     const dx=points[b][0]-points[a][0],dy=points[b][1]-points[a][1],distance=Math.hypot(dx,dy)||.01;
     if(distance<76){const push=(76-distance)/2;const ux=distance===.01?1:dx/distance,uy=dy/distance;
      points[a][0]-=ux*push;points[a][1]-=uy*push;points[b][0]+=ux*push;points[b][1]+=uy*push;}
    }
    points.forEach(p=>{const r=Math.hypot((p[0]-260)/175,(p[1]-220)/115);if(r>1){p[0]=260+(p[0]-260)/r;p[1]=220+(p[1]-220)/r;}});
   }
  }
  return points[i];
 };
 const place=stage=>qa('.tf-token').forEach((el,i)=>{
  const [x,y]=point(c().tokens[i],stage,i);
  el.style.transform=`translate(${x}px,${y}px)`;
 });
 const placeVectors=()=>qa('.tf-token').forEach((el,i)=>{const [x,y]=columnPoint(i);el.style.transform=`translate(${x}px,${y}px)`;});
 function values(added,stage=1){
  qa('.tf-token').forEach((el,i)=>{
   const t=c().tokens[i],v=stage>=2?t.layers[layerAt(stage)]:added?t.input:t.embedding;
   el.dataset.inputVector=JSON.stringify(t.input);
   [...el.querySelectorAll('.tf-column tspan')].slice(0,2).forEach((s,j)=>s.textContent=format(v[j]));
   [...el.querySelectorAll('.tf-pe tspan')].slice(0,2).forEach((s,j)=>s.textContent=additive?format(t.position[j]):'');
   el.querySelector('.tf-numbers').textContent=vec(v);
  });
 }
 function output(){
  const cs=c().candidates;
  // Candidate data has probabilities, not logits. Reconstruct equivalent relative
  // scores (up to a shared constant).
  const logs=cs.map(v=>Math.log(Math.max(v.probability,1e-9))),base=Math.min(...logs)-.35;
  const scores=logs.map(v=>v-base),max=Math.max(...scores);
  q('.tf-output-chain').innerHTML=
   '<g class="tf-linear"><path d="M260 98V124m-5 -7 5 7 5 -7" fill="none" stroke="#738679" stroke-width="2"/><rect x="155" y="132" width="210" height="38" rx="6" fill="#eef3f7" stroke="#9db7d3"/><text x="260" y="156" text-anchor="middle" font-size="15">出力層</text></g>'+
   '<g class="tf-scores"><path d="M260 180V207m-5 -7 5 7 5 -7" fill="none" stroke="#738679" stroke-width="2"/><text class="tf-chart-title" x="260" y="235" text-anchor="middle" font-size="14">候補ごとのスコア</text>'+cs.map((v,i)=>`<g class="tf-candidate"><text x="120" y="${276+i*36}" text-anchor="end" font-size="14">${esc(v.text)}</text><rect x="135" y="${261+i*36}" height="21" rx="4" width="${scores[i]/max*225}" data-score-width="${scores[i]/max*225}" data-prob-width="${v.probability*225}" fill="#35664d"/><text class="tf-bar-value" x="378" y="${276+i*36}" data-score="${format(scores[i])}" font-size="13">${format(scores[i])}</text></g>`).join('')+'</g>';
 }
 function scaleOutput(probabilities){
  qa('.tf-candidate').forEach((el,i)=>{
   const bar=el.querySelector('rect'),label=el.querySelector('.tf-bar-value');
   bar.setAttribute('width',probabilities?bar.dataset.probWidth:bar.dataset.scoreWidth);
   label.textContent=probabilities?percent(c().candidates[i].probability):label.dataset.score;
  });
  q('.tf-chart-title').textContent=probabilities?'次トークンの確率':'候補ごとのスコア';
 }
 function formDots(){
  // Collapse at the existing numerical positions, pause, then move through space.
  d.classList.add('tf-dot-forming');q('.tf-vector-label').textContent='';
  later(()=>{
   d.classList.remove('tf-numeric','tf-pe-visible','tf-pe-merge','tf-dot-forming');
   d.classList.add('tf-dot-hold');
   later(()=>{
    d.classList.remove('tf-dot-hold');d.classList.add('tf-space-moving');place(1);
    later(()=>d.classList.remove('tf-space-moving'),MOVE+100);
   },DOT_HOLD);
  },800);
 }
 function show(stage){
  clearMerge?.();clearMerge=null;timers.forEach(clearTimeout);timers=[];
  const previous=current;current=stage;
  frame(stage===outputStage?280+c().candidates.length*36:430);
  d.classList.remove('tf-numeric','tf-output-morph','tf-output-ready','tf-output-moving','tf-pe-visible','tf-pe-merge','tf-position-added','tf-dot-forming','tf-dot-hold','tf-space-moving','tf-output-linear','tf-output-scores','tf-output-softmax','tf-leaving-space');
  scaleOutput(false);
  d.classList.toggle('tf-sentence',stage===0);d.classList.toggle('tf-final-layer',stage===finalStage);
  qa('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.layer===stage)));
  q('.tf-space svg').setAttribute('aria-label',`${c().prompt}：${stages[stage]}`);
  q('.tf-space-title').textContent=stage===1?'初期埋め込みの空間':stage>=2&&stage<=finalStage?`${layerLabel(layerAt(stage))}層の空間`:'';
  q('.tf-vector-label').textContent=(additive?'埋め込み':data.model.positionEncoding.label+'（埋め込みへの加算は表示しません）');
  if(stage===1&&!reduced.matches){
   // Coming back from the space, return the dots to their columns before showing numbers.
   const lead=previous>=2?MOVE:0,step=(fn,ms)=>later(fn,lead+ms);
   if(lead)d.classList.add('tf-leaving-space');
   placeVectors();values(false);
   step(()=>d.classList.add('tf-numeric'),0);
   if(!additive){step(formDots,1700);return;}
   step(()=>{d.classList.add('tf-pe-visible');q('.tf-vector-label').textContent='＋ '+data.model.positionEncoding.label;},1700);
   step(()=>{
    const moving=q('.tf-pe');
    const merged=event=>{if(event.target!==moving||event.propertyName!=='transform')return;clearMerge?.();clearMerge=null;values(true);d.classList.add('tf-position-added');q('.tf-vector-label').textContent='埋め込み ＋ 位置エンコーディング';later(formDots,BEAT);};
    moving.addEventListener('transitionend',merged);clearMerge=()=>moving.removeEventListener('transitionend',merged);d.classList.add('tf-pe-merge');
   },1700+BEAT+600);
  }else if(stage===outputStage){
   values(true,finalStage);if(previous!==finalStage)place(finalStage);d.classList.add('tf-output-moving');
   const morph=()=>{d.classList.add('tf-output-morph');q('.tf-last').style.transform='translate(260px,65px)';};
   if(reduced.matches){morph();d.classList.add('tf-output-linear','tf-output-scores','tf-output-softmax','tf-output-ready');scaleOutput(true);}
   else {
    const delay=previous===finalStage?60:MOVE,arrive=delay+MOVE;
    later(morph,delay);
    later(()=>d.classList.add('tf-output-linear'),arrive);
    later(()=>d.classList.add('tf-output-scores'),arrive+BEAT);
    later(()=>{d.classList.add('tf-output-softmax');q('.tf-chart-title').textContent='softmax でスコアを確率に変換';},arrive+BEAT*2);
    later(()=>{d.classList.add('tf-output-ready');scaleOutput(true);},arrive+BEAT*3);
   }
  }else{
   if(stage>=2&&previous<=1&&!reduced.matches){d.classList.add('tf-space-moving');later(()=>d.classList.remove('tf-space-moving'),MOVE+100);}
   place(stage);values(true,stage);if(stage===1)d.classList.add('tf-position-added');}
 }
 function buildTokens(){
  d.classList.add('tf-initializing');
  const column=cls=>`<g class="${cls}"><path d="M-37 -28H-42V32H-37M37 -28H42V32H37" fill="none" stroke="currentColor"/><text font-family="monospace" font-size="12" text-anchor="middle"><tspan x="0" y="-10"></tspan><tspan x="0" y="9"></tspan><tspan x="0" y="27">⋮</tspan></text></g>`;
  q('.tf-tokens').innerHTML=c().tokens.map((t,i)=>`<g class="tf-token ${i===c().tokens.length-1?'tf-last':''}" data-word="${esc(t.text)}" style="color:${colors[i%colors.length]};fill:${colors[i%colors.length]}"><circle class="tf-halo" fill="none" r="31" stroke="#ba7147" stroke-width="3"/><rect class="tf-vector-shape" x="-8" y="-8" width="16" height="16" rx="8"/><text class="tf-word" x="0" y="-22" text-anchor="middle" font-size="16">${esc(t.text)}</text><text class="tf-numbers" text-anchor="middle" font-size="12" y="5"></text>${column('tf-column')}${column('tf-pe')}<text class="tf-pe-plus" x="0" y="60" text-anchor="middle" fill="#725789">＋</text></g>`).join('');
  // Grow the SVG for token rows and candidate rows; do not assume a tokenizer's length.
  output();show(current);
  // Commit new token positions before enabling transitions, including case switches.
  void d.offsetWidth;d.classList.remove('tf-initializing');
 }
 stages.forEach((label,i)=>{if(i>=3&&i<outputStage&&layers[i-2]>layers[i-3]+1){const gap=document.createElement('span');gap.className='tf-ellipsis';gap.textContent='…';gap.title='中間の層を省略';q('.tf-steps').append(gap);}const b=document.createElement('button');b.type='button';b.dataset.layer=i;b.textContent=label;b.addEventListener('click',()=>show(i));q('.tf-steps').append(b);});
 data.cases.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.dataset.negation=i===0?'off':'on';b.textContent=item.label;b.setAttribute('aria-pressed',String(i===caseIndex));b.addEventListener('click',()=>{caseIndex=i;qa('[data-negation]').forEach((el,j)=>el.setAttribute('aria-pressed',String(i===j)));buildTokens();});q('.tf-case-controls').append(b);});
 reduced.addEventListener('change',()=>show(current));q('.tf-live').hidden=false;d.classList.add('tf-enhanced');buildTokens();
})();
