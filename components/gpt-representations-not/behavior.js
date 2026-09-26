'use strict';
(() => {
 const {data,layers,additive,format,percent,esc,vec,note}=window.Diagram;
 const d=document.querySelector('.tf-representation'),q=s=>d.querySelector(s),qa=s=>[...d.querySelectorAll(s)];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let caseIndex=0,current=0,timers=[],clearMerge=null;
 const outputStage=layers.length+2,finalStage=outputStage-1;
 const stages=['文章','ベクトル化（埋め込み）',...layers.map(l=>`第${l}層`),'出力'];
 const colors=['#487bb6','#725789','#198d98','#348761','#b2703c','#b34769'];
 const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
 const c=()=>data.cases[caseIndex];
 const layerAt=stage=>stage<2?0:layers[Math.min(stage-2,layers.length-1)];
 const point=(t,stage,i)=>stage===0?[35+(i%5)*96,130+Math.floor(i/5)*125]:[50+t.points[layerAt(stage)][0]*390,75+t.points[layerAt(stage)][1]*260];
 const place=stage=>qa('.tf-token').forEach((el,i)=>{const [x,y]=point(c().tokens[i],stage,i);el.style.transform=`translate(${x}px,${y}px)`;});
 // Center each numerical row independently; reserve room below for position vectors.
 const vectorColumns=()=>Math.min(5,Math.ceil(c().tokens.length/Math.ceil(c().tokens.length/5)));
 const placeVectors=()=>{
  const cols=vectorColumns(),gap=100;
  qa('.tf-token').forEach((el,i)=>{
   const row=Math.floor(i/cols),count=Math.min(cols,c().tokens.length-row*cols);
   const x=260+(i%cols-(count-1)/2)*gap,y=120+row*220;
   el.style.transform=`translate(${x}px,${y}px)`;
  });
 };
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
  q('.tf-output-chain').innerHTML='<text x="260" y="130" text-anchor="middle" font-size="15">出力層 → softmax → 次トークンの確率</text>'+cs.map((v,i)=>`<text x="125" y="${178+i*35}" text-anchor="end" font-size="14">${esc(v.text)}</text><rect x="140" y="${164+i*35}" height="20" rx="4" width="${v.probability*235}" fill="#35664d"/><text x="385" y="${178+i*35}" font-size="13">${percent(v.probability)}</text>`).join('');
 }
 function show(stage){
  clearMerge?.();clearMerge=null;timers.forEach(clearTimeout);timers=[];
  const previous=current;current=stage;
  d.classList.remove('tf-numeric','tf-output-morph','tf-output-ready','tf-output-moving','tf-pe-visible','tf-pe-merge','tf-position-added');
  d.classList.toggle('tf-sentence',stage===0);d.classList.toggle('tf-final-layer',stage===finalStage);
  qa('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.layer===stage)));
  q('.tf-space svg').setAttribute('aria-label',`${c().prompt}：${stages[stage]}`);
  q('.tf-vector-label').textContent=additive?'埋め込み':data.model.positionEncoding.label+'（埋め込みへの加算は表示しません）';
  if(stage===1&&!reduced.matches){
   placeVectors();d.classList.add('tf-numeric');values(false);
   if(!additive){later(()=>{d.classList.remove('tf-numeric');place(1);},1800);return;}
   later(()=>{d.classList.add('tf-pe-visible');q('.tf-vector-label').textContent='＋ '+data.model.positionEncoding.label;},1100);
   later(()=>{
    const moving=q('.tf-pe');
    const merged=event=>{if(event.target!==moving||event.propertyName!=='transform')return;clearMerge?.();clearMerge=null;values(true);d.classList.add('tf-position-added');q('.tf-vector-label').textContent='埋め込み ＋ 位置ベクトル';later(()=>{d.classList.remove('tf-numeric','tf-pe-visible','tf-pe-merge');place(1);},650);};
    moving.addEventListener('transitionend',merged);clearMerge=()=>moving.removeEventListener('transitionend',merged);d.classList.add('tf-pe-merge');
   },2200);
  }else if(stage===outputStage){
   values(true,finalStage);if(previous!==finalStage)place(finalStage);d.classList.add('tf-output-moving');
   const morph=()=>{d.classList.add('tf-output-morph');q('.tf-last').style.transform='translate(260px,65px)';};
   if(reduced.matches){morph();d.classList.add('tf-output-ready');}
   else {later(morph,previous===finalStage?60:1000);later(()=>d.classList.add('tf-output-ready'),previous===finalStage?1200:2200);}
  }else{place(stage);values(true,stage);if(stage===1)d.classList.add('tf-position-added');}
 }
 function buildTokens(){
  q('.tf-input').textContent=c().prompt;
  const column=cls=>`<g class="${cls}"><path d="M-37 -28H-42V32H-37M37 -28H42V32H37" fill="none" stroke="currentColor"/><text font-family="monospace" font-size="12" text-anchor="middle"><tspan x="0" y="-10"></tspan><tspan x="0" y="9"></tspan><tspan x="0" y="27">⋮</tspan></text></g>`;
  q('.tf-tokens').innerHTML=c().tokens.map((t,i)=>`<g class="tf-token ${i===c().tokens.length-1?'tf-last':''}" data-word="${esc(t.text)}" style="color:${colors[i%colors.length]};fill:${colors[i%colors.length]}"><circle class="tf-halo" fill="none" r="22" stroke="#ba7147" stroke-width="3"/><rect class="tf-vector-shape" x="-8" y="-8" width="16" height="16" rx="8"/><text class="tf-word" x="12" y="5" font-size="16">${esc(t.text)}</text><text class="tf-numbers" text-anchor="middle" font-size="12" y="5"></text>${column('tf-column')}${column('tf-pe')}<text class="tf-pe-plus" x="0" y="60" text-anchor="middle" fill="#725789">＋</text></g>`).join('');
  // Grow the SVG for token rows and candidate rows; do not assume a tokenizer's length.
  q('.tf-space svg').setAttribute('viewBox',`0 0 520 ${Math.max(430,210+c().candidates.length*35,300+Math.floor((c().tokens.length-1)/vectorColumns())*220)}`);
  output();show(current);
 }
 stages.forEach((label,i)=>{if(i>=3&&i<outputStage&&layers[i-2]>layers[i-3]+1){const gap=document.createElement('span');gap.className='tf-ellipsis';gap.textContent='…';gap.title='中間の層を省略';q('.tf-steps').append(gap);}const b=document.createElement('button');b.type='button';b.dataset.layer=i;b.textContent=label;b.addEventListener('click',()=>show(i));q('.tf-steps').append(b);});
 data.cases.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.dataset.negation=i===0?'off':'on';b.textContent=item.label;b.setAttribute('aria-pressed',String(i===caseIndex));b.addEventListener('click',()=>{caseIndex=i;qa('[data-negation]').forEach((el,j)=>el.setAttribute('aria-pressed',String(i===j)));buildTokens();});q('.tf-case-controls').append(b);});
 q('figcaption').textContent=note()+` 表示する成分：${data.model.componentIndices.slice(0,2).join('・')}（0始まり）。位置情報：${data.model.positionEncoding.label}。中間の層は省略しています。`;
 reduced.addEventListener('change',()=>show(current));q('.tf-live').hidden=false;d.classList.add('tf-enhanced');buildTokens();
})();
